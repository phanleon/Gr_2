"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DANGEROUS_COMMAND_REGEX = void 0;
exports.registerSshSocket = registerSshSocket;
const database_1 = require("../db/database");
const auditLogger_1 = require("../middleware/auditLogger");
const chatSocket_1 = require("./chatSocket");
const activeSshSessions = new Map();
// Regex firewall pattern for dangerous commands
exports.DANGEROUS_COMMAND_REGEX = /(rm\s+-rf|format\s+[a-z]:|del\s+\/[fsq]|Remove-Item.*-Force|reg\s+delete|mkfs|dd\s+if=)/i;
function registerSshSocket(io) {
    io.on('connection', (socket) => {
        const user = socket.user;
        if (!user)
            return;
        // 1. Operator requests remote shell session
        socket.on('ssh:request_session', ({ targetClientId, roomId }) => {
            const isAdmin = user.role === 'SERVER_ADMIN';
            let hasSshPermission = isAdmin;
            if (!isAdmin) {
                if (roomId) {
                    const room = (0, database_1.getRoomById)(roomId);
                    const isOwner = room && room.owner_id === user.id;
                    const perm = (0, database_1.getUserRoomPermission)(roomId, user.id);
                    if (isOwner || (perm && perm.status === 'ALLOWED' && perm.can_ssh === 1)) {
                        hasSshPermission = true;
                    }
                }
                else if (user.role === 'ROOM_OWNER') {
                    // Check if operator owns a room containing target client
                    const shared = database_1.db.prepare(`
            SELECT rp.room_id FROM room_permissions rp
            JOIN rooms r ON rp.room_id = r.id
            WHERE r.owner_id = ? AND rp.user_id = ? AND rp.status = 'ALLOWED'
          `).get(user.id, targetClientId);
                    if (shared) {
                        hasSshPermission = true;
                    }
                }
            }
            if (!hasSshPermission) {
                (0, auditLogger_1.logActivity)(user, 'SSH_SESSION_UNAUTHORIZED', { targetClientId, roomId }, socket.handshake.address, 'HIGH');
                return socket.emit('ssh:error', {
                    message: 'Từ chối truy cập: Bạn không có quyền Zero-Trust SSH đối với máy này.',
                });
            }
            // Find target client active socket
            const targetSockets = chatSocket_1.connectedUserSockets.get(targetClientId);
            if (!targetSockets || targetSockets.size === 0) {
                return socket.emit('ssh:error', {
                    message: 'Máy trạm đích hiện đang Ngoại tuyến (Offline).',
                });
            }
            const targetSocket = Array.from(targetSockets)[0];
            const sessionId = `ssh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            activeSshSessions.set(sessionId, {
                sessionId,
                operatorId: user.id,
                operatorSocketId: socket.id,
                targetClientId,
                targetSocketId: targetSocket.id,
                roomId: roomId || null,
                commandBuffer: '',
                startedAt: new Date().toISOString(),
            });
            // Join both to socket room
            socket.join(`ssh_room_${sessionId}`);
            targetSocket.join(`ssh_room_${sessionId}`);
            // Dispatch spawn instruction to target Client machine
            targetSocket.emit('ssh:spawn_shell', {
                sessionId,
                operator: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                },
            });
            socket.emit('ssh:session_initializing', { sessionId, targetClientId });
            (0, auditLogger_1.logActivity)(user, 'SSH_SESSION_INITIATED', { sessionId, targetClientId, roomId }, socket.handshake.address, 'LOW');
        });
        // 2. Target client acknowledges shell spawned successfully
        socket.on('ssh:shell_ready', ({ sessionId }) => {
            const session = activeSshSessions.get(sessionId);
            if (!session)
                return;
            io.to(`ssh_room_${sessionId}`).emit('ssh:session_active', {
                sessionId,
                message: 'Zero-Trust Audited SSH Tunnel established successfully.',
            });
        });
        // 3. Target client shell sends output -> Relay to Operator terminal
        socket.on('ssh:shell_output', ({ sessionId, data }) => {
            const session = activeSshSessions.get(sessionId);
            if (!session)
                return;
            const operatorSocket = io.sockets.sockets.get(session.operatorSocketId);
            if (operatorSocket) {
                operatorSocket.emit('ssh:terminal_data', { sessionId, data });
            }
        });
        // 4. Operator types input -> Buffer, Firewall Check on Enter, and Forward
        socket.on('ssh:operator_input', ({ sessionId, data }) => {
            const session = activeSshSessions.get(sessionId);
            if (!session)
                return;
            const targetSocket = io.sockets.sockets.get(session.targetSocketId);
            if (!targetSocket)
                return;
            // Handle character keystrokes
            for (let i = 0; i < data.length; i++) {
                const char = data[i];
                if (char === '\r' || char === '\n') {
                    // ENTER pressed: Inspect command in buffer
                    const command = session.commandBuffer.trim();
                    session.commandBuffer = '';
                    if (command.length > 0) {
                        // Check Dangerous Command Firewall
                        const isDangerous = exports.DANGEROUS_COMMAND_REGEX.test(command);
                        if (isDangerous) {
                            // BLOCK EXECUTION
                            (0, database_1.addSshCommandLog)(sessionId, session.operatorId, session.targetClientId, session.roomId, command, 1, // was_blocked = true
                            'CRITICAL');
                            (0, auditLogger_1.logActivity)(user, 'SSH_COMMAND_FIREWALL_BLOCK', { sessionId, command, blocked: true }, socket.handshake.address, 'CRITICAL');
                            // Broadcast High-Risk Alert to Server Dashboard
                            io.emit('ssh:critical_alert', {
                                sessionId,
                                operatorName: user.full_name,
                                targetClientId: session.targetClientId,
                                command,
                                timestamp: new Date().toISOString(),
                            });
                            // Send warning directly back to Operator's xterm display
                            const alertMsg = `\r\n\x1b[31;1m[SECURITY FIREWALL BLOCKED]\x1b[0m Câu lệnh bị cấm vì nguy hiểm cao: "${command}"\r\n\x1b[33mPhiên làm việc đã bị ghi nhận vào Nhật ký Bảo mật Vi phạm!\x1b[0m\r\n$ `;
                            socket.emit('ssh:terminal_data', { sessionId, data: alertMsg });
                            return; // Do NOT forward to target shell
                        }
                        else {
                            // Command is safe, record in audit logs
                            (0, database_1.addSshCommandLog)(sessionId, session.operatorId, session.targetClientId, session.roomId, command, 0, // allowed
                            'LOW');
                        }
                    }
                    // Forward Enter keystroke to target shell
                    targetSocket.emit('ssh:shell_input', { sessionId, data: '\r\n' });
                }
                else if (char === '\x7f' || char === '\b') {
                    // Backspace
                    session.commandBuffer = session.commandBuffer.slice(0, -1);
                    targetSocket.emit('ssh:shell_input', { sessionId, data: char });
                }
                else {
                    session.commandBuffer += char;
                    targetSocket.emit('ssh:shell_input', { sessionId, data: char });
                }
            }
        });
        // 5. Operator or Client terminates SSH session
        socket.on('ssh:terminate_session', ({ sessionId }) => {
            const session = activeSshSessions.get(sessionId);
            if (!session)
                return;
            io.to(`ssh_room_${sessionId}`).emit('ssh:session_terminated', { sessionId });
            const targetSocket = io.sockets.sockets.get(session.targetSocketId);
            if (targetSocket) {
                targetSocket.emit('ssh:kill_shell', { sessionId });
            }
            (0, auditLogger_1.logActivity)(user, 'SSH_SESSION_TERMINATED', { sessionId }, socket.handshake.address, 'LOW');
            activeSshSessions.delete(sessionId);
        });
        // Clean up on disconnect
        socket.on('disconnect', () => {
            for (const [sId, sess] of activeSshSessions.entries()) {
                if (sess.operatorSocketId === socket.id || sess.targetSocketId === socket.id) {
                    io.to(`ssh_room_${sId}`).emit('ssh:session_terminated', { sessionId: sId });
                    activeSshSessions.delete(sId);
                }
            }
        });
    });
}
