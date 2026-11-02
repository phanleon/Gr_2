"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREE_STUN_SERVERS = void 0;
exports.registerSignalingSocket = registerSignalingSocket;
const database_1 = require("../db/database");
const auditLogger_1 = require("../middleware/auditLogger");
const chatSocket_1 = require("./chatSocket");
exports.FREE_STUN_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];
function registerSignalingSocket(io) {
    io.on('connection', (socket) => {
        const user = socket.user;
        if (!user)
            return;
        // 1. Join Video Call Room
        socket.on('webrtc:join_call', ({ roomId }) => {
            const room = (0, database_1.getRoomById)(roomId);
            if (!room)
                return;
            const perm = room.is_global !== 1 && user.role !== 'SERVER_ADMIN' && room.owner_id !== user.id
                ? (0, database_1.getUserRoomPermission)(roomId, user.id)
                : null;
            const isMuted = perm ? perm.is_muted === 1 : false;
            socket.join(`call_room_${roomId}`);
            console.log(`[Signaling] ${user.username} joined call in room_${roomId} (Muted: ${isMuted})`);
            // Notify others in room
            socket.to(`call_room_${roomId}`).emit('webrtc:peer_joined', {
                peerId: user.id,
                peerName: user.full_name,
                peerRole: user.role,
                socketId: socket.id,
                isMuted,
            });
            // Send list of current peers in room to caller
            const roomSockets = io.sockets.adapter.rooms.get(`call_room_${roomId}`);
            const peers = [];
            if (roomSockets) {
                for (const sId of roomSockets) {
                    if (sId !== socket.id) {
                        const peerSock = io.sockets.sockets.get(sId);
                        const peerUser = peerSock?.user;
                        if (peerUser) {
                            const peerPerm = (0, database_1.getUserRoomPermission)(roomId, peerUser.id);
                            peers.push({
                                peerId: peerUser.id,
                                peerName: peerUser.full_name,
                                peerRole: peerUser.role,
                                socketId: sId,
                                isMuted: peerPerm?.is_muted === 1,
                            });
                        }
                    }
                }
            }
            socket.emit('webrtc:current_peers', { peers, isMuted });
        });
        // 2. Leave Video Call
        socket.on('webrtc:leave_call', ({ roomId }) => {
            socket.leave(`call_room_${roomId}`);
            socket.to(`call_room_${roomId}`).emit('webrtc:peer_left', {
                peerId: user.id,
                socketId: socket.id,
            });
        });
        // 3. WebRTC SDP Offer Relay
        socket.on('webrtc:offer', ({ toSocketId, offer, type }) => {
            io.to(toSocketId).emit('webrtc:offer', {
                fromSocketId: socket.id,
                fromUserId: user.id,
                fromUserName: user.full_name,
                offer,
                type: type || 'call',
            });
        });
        // 4. WebRTC SDP Answer Relay
        socket.on('webrtc:answer', ({ toSocketId, answer }) => {
            io.to(toSocketId).emit('webrtc:answer', {
                fromSocketId: socket.id,
                fromUserId: user.id,
                answer,
            });
        });
        // 5. ICE Candidate Relay
        socket.on('webrtc:ice_candidate', ({ toSocketId, candidate }) => {
            io.to(toSocketId).emit('webrtc:ice_candidate', {
                fromSocketId: socket.id,
                candidate,
            });
        });
        // 6. UltraViewer Remote Desktop Signaling
        socket.on('desktop:request_control', ({ targetClientId }) => {
            const targetSockets = chatSocket_1.connectedUserSockets.get(targetClientId);
            if (!targetSockets || targetSockets.size === 0) {
                return socket.emit('desktop:error', { message: 'Máy trạm đích ngoại tuyến' });
            }
            const targetSocket = Array.from(targetSockets)[0];
            const sessionId = `desk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            targetSocket.emit('desktop:control_requested', {
                sessionId,
                operator: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                },
            });
            (0, auditLogger_1.logActivity)(user, 'DESKTOP_CONTROL_REQUESTED', { sessionId, targetClientId }, socket.handshake.address, 'LOW');
            socket.emit('desktop:session_pending', { sessionId });
        });
        socket.on('desktop:accept_control', ({ sessionId, operatorSocketId }) => {
            io.to(operatorSocketId).emit('desktop:control_accepted', {
                sessionId,
                targetSocketId: socket.id,
            });
            (0, auditLogger_1.logActivity)(user, 'DESKTOP_CONTROL_ACCEPTED', { sessionId }, socket.handshake.address, 'LOW');
        });
        // Remote mouse & keyboard input relay
        socket.on('desktop:input_event', ({ targetSocketId, event }) => {
            io.to(targetSocketId).emit('desktop:input_event', event);
        });
        // Frame fallback relay when P2P UDP fails
        socket.on('desktop:frame_data', ({ operatorSocketId, frameBase64, timestamp }) => {
            io.to(operatorSocketId).emit('desktop:frame_data', { frameBase64, timestamp });
        });
        // UltraViewer Pro: Clipboard sync
        socket.on('desktop:clipboard_sync', ({ targetSocketId, text }) => {
            io.to(targetSocketId).emit('desktop:clipboard_sync', { text, from: user.username });
        });
        // UltraViewer Pro: Quality / FPS adjustment
        socket.on('desktop:quality_change', ({ targetSocketId, quality, fps }) => {
            io.to(targetSocketId).emit('desktop:quality_change', { quality, fps });
        });
        // UltraViewer Pro: Remote File Transfer during session
        socket.on('desktop:file_transfer', ({ targetSocketId, fileData, fileName, fileSize }) => {
            io.to(targetSocketId).emit('desktop:file_transfer', {
                from: user.full_name,
                fileName,
                fileSize,
                fileData,
            });
            (0, auditLogger_1.logActivity)(user, 'DESKTOP_FILE_TRANSFERRED', { fileName, fileSize }, socket.handshake.address, 'LOW');
        });
        // Emergency disconnect / Session terminate
        socket.on('desktop:terminate_control', ({ targetSocketId, sessionId }) => {
            io.to(targetSocketId).emit('desktop:terminate_control', { sessionId });
            (0, auditLogger_1.logActivity)(user, 'DESKTOP_CONTROL_TERMINATED', { sessionId }, socket.handshake.address, 'LOW');
        });
    });
}
