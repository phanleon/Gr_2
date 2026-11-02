"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoomSocketIO = setRoomSocketIO;
exports.createRoom = createRoom;
exports.getLobbyRooms = getLobbyRooms;
exports.requestRoomAccess = requestRoomAccess;
exports.enterRoom = enterRoom;
exports.moderateRoom = moderateRoom;
exports.getRoomMembers = getRoomMembers;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../db/database");
const auditLogger_1 = require("../middleware/auditLogger");
// Reference to Socket.io server instance for broadcasting events
let ioInstance = null;
function setRoomSocketIO(io) {
    ioInstance = io;
}
// 1. Create Room (SERVER_ADMIN or ROOM_OWNER)
function createRoom(req, res) {
    const { room_name, room_code, room_password } = req.body;
    const user = req.user;
    if (!room_name || !room_code || !room_password) {
        return res.status(400).json({ error: 'Vui lòng cung cấp: room_name, room_code, room_password' });
    }
    const cleanCode = room_code.trim().toUpperCase();
    // Check code uniqueness
    const existing = database_1.db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(cleanCode);
    if (existing) {
        return res.status(409).json({ error: `Mã phòng '${cleanCode}' đã được sử dụng` });
    }
    const salt = bcryptjs_1.default.genSaltSync(10);
    const passwordHash = bcryptjs_1.default.hashSync(room_password, salt);
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    database_1.db.prepare(`
    INSERT INTO rooms (id, room_code, room_name, room_password_hash, owner_id, is_global)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(roomId, cleanCode, room_name, passwordHash, user.id);
    // Automatically grant creator full ALLOWED permissions with SSH access
    database_1.db.prepare(`
    INSERT INTO room_permissions (room_id, user_id, status, is_muted, can_ssh, granted_by)
    VALUES (?, ?, 'ALLOWED', 0, 1, ?)
  `).run(roomId, user.id, user.id);
    (0, auditLogger_1.logActivity)(user, 'ROOM_CREATED', { roomId, room_name, room_code: cleanCode }, req.ip, 'LOW');
    if (ioInstance) {
        ioInstance.emit('room:created', {
            roomId,
            room_name,
            room_code: cleanCode,
            owner_name: user.full_name,
        });
    }
    return res.status(201).json({
        message: 'Phòng ban đã được tạo thành công',
        room: {
            id: roomId,
            room_code: cleanCode,
            room_name,
            owner_id: user.id,
            is_global: 0,
        },
    });
}
// 2. Room Lobby Listing with Dual-Lock permission state
function getLobbyRooms(req, res) {
    const user = req.user;
    const allRooms = (0, database_1.getRooms)();
    const lobbyRooms = allRooms.map((room) => {
        const isOwner = room.owner_id === user.id;
        const isAdmin = user.role === 'SERVER_ADMIN';
        const isGlobal = room.is_global === 1;
        let permission = (0, database_1.getUserRoomPermission)(room.id, user.id);
        let status = 'NONE';
        let isMuted = 0;
        let canSsh = 0;
        if (isGlobal || isAdmin || isOwner) {
            status = 'ALLOWED';
            canSsh = 1;
        }
        else if (permission) {
            status = permission.status;
            isMuted = permission.is_muted;
            canSsh = permission.can_ssh;
        }
        return {
            id: room.id,
            room_code: room.room_code,
            room_name: room.room_name,
            owner_name: room.owner_name,
            owner_username: room.owner_username,
            owner_id: room.owner_id,
            is_global: room.is_global,
            member_count: room.member_count,
            created_at: room.created_at,
            user_access: {
                status,
                is_muted: isMuted === 1,
                can_ssh: canSsh === 1,
                can_moderate: isAdmin || isOwner,
            },
        };
    });
    return res.json({ rooms: lobbyRooms });
}
// 3. Request Room Whitelist Access
function requestRoomAccess(req, res) {
    const { id } = req.params;
    const user = req.user;
    const room = (0, database_1.getRoomById)(id);
    if (!room) {
        return res.status(404).json({ error: 'Không tìm thấy phòng ban' });
    }
    const existing = (0, database_1.getUserRoomPermission)(id, user.id);
    if (existing) {
        if (existing.status === 'ALLOWED') {
            return res.json({ message: 'Bạn đã có trong danh sách được phép vào phòng' });
        }
        if (existing.status === 'KICKED') {
            return res.status(403).json({ error: 'Bạn đã bị mời ra khỏi phòng bởi điều hành viên' });
        }
        return res.json({ message: 'Yêu cầu vào phòng đang chờ duyệt' });
    }
    database_1.db.prepare(`
    INSERT INTO room_permissions (room_id, user_id, status, is_muted, can_ssh, granted_by)
    VALUES (?, ?, 'PENDING', 0, 0, NULL)
  `).run(id, user.id);
    (0, auditLogger_1.logActivity)(user, 'ROOM_ACCESS_REQUESTED', { roomId: id, room_code: room.room_code }, req.ip, 'LOW');
    if (ioInstance) {
        ioInstance.to(`room_${id}`).emit('room:access_requested', {
            roomId: id,
            user: { id: user.id, username: user.username, full_name: user.full_name },
        });
    }
    return res.json({ message: 'Đã gửi yêu cầu vào phòng tới Trưởng phòng' });
}
// 4. Enter Room (Dual-Lock Enforcement)
function enterRoom(req, res) {
    const { id } = req.params;
    const { room_password } = req.body;
    const user = req.user;
    const room = (0, database_1.getRoomById)(id);
    if (!room) {
        return res.status(404).json({ error: 'Phòng không tồn tại' });
    }
    const isAdmin = user.role === 'SERVER_ADMIN';
    const isOwner = room.owner_id === user.id;
    const isGlobal = room.is_global === 1;
    // LOCK 1: Whitelist ACL Verification
    if (!isGlobal && !isAdmin && !isOwner) {
        const permission = (0, database_1.getUserRoomPermission)(id, user.id);
        if (!permission) {
            (0, auditLogger_1.logActivity)(user, 'ROOM_ENTRY_REJECTED', { roomId: id, reason: 'Not in ACL whitelist' }, req.ip, 'MEDIUM');
            return res.status(403).json({
                error: 'Khóa 1 không thành công: Bạn chưa được Trưởng phòng hoặc Quản trị viên cấp quyền (Whitelist ALLOWED).',
            });
        }
        if (permission.status === 'KICKED') {
            (0, auditLogger_1.logActivity)(user, 'ROOM_ENTRY_REJECTED', { roomId: id, reason: 'Kicked by moderator' }, req.ip, 'MEDIUM');
            return res.status(403).json({
                error: 'Khóa 1 không thành công: Bạn đã bị đuổi khỏi phòng ban này.',
            });
        }
        if (permission.status !== 'ALLOWED') {
            (0, auditLogger_1.logActivity)(user, 'ROOM_ENTRY_REJECTED', { roomId: id, reason: 'Status is PENDING' }, req.ip, 'LOW');
            return res.status(403).json({
                error: 'Khóa 1 không thành công: Yêu cầu cấp quyền của bạn đang chờ phê duyệt.',
            });
        }
    }
    // LOCK 2: Room Password Verification
    if (!isGlobal && !isAdmin && !isOwner) {
        if (!room_password) {
            return res.status(400).json({ error: 'Khóa 2 yêu cầu: Vui lòng nhập mật khẩu phòng' });
        }
        const isPassValid = bcryptjs_1.default.compareSync(room_password, room.room_password_hash);
        if (!isPassValid) {
            (0, auditLogger_1.logActivity)(user, 'ROOM_ENTRY_REJECTED', { roomId: id, reason: 'Invalid room password' }, req.ip, 'MEDIUM');
            return res.status(401).json({
                error: 'Khóa 2 không thành công: Mật khẩu phòng ban không chính xác.',
            });
        }
    }
    // Dual-Lock Passed Successfully
    (0, auditLogger_1.logActivity)(user, 'ROOM_ENTRY_SUCCESS', { roomId: id, room_code: room.room_code }, req.ip, 'LOW');
    const permission = (0, database_1.getUserRoomPermission)(id, user.id);
    return res.json({
        success: true,
        message: 'Mở khóa kép thành công! Đã tham gia phòng ban.',
        room: {
            id: room.id,
            room_code: room.room_code,
            room_name: room.room_name,
            owner_id: room.owner_id,
            owner_name: room.owner_name,
            is_global: room.is_global,
        },
        user_state: {
            is_muted: permission?.is_muted === 1,
            can_ssh: isAdmin || isOwner || permission?.can_ssh === 1,
            is_moderator: isAdmin || isOwner,
        },
    });
}
// 5. Room Moderation (Approve, Kick, Force Mute, Grant SSH)
function moderateRoom(req, res) {
    const { id } = req.params;
    const { target_user_id, action } = req.body;
    const user = req.user;
    const room = (0, database_1.getRoomById)(id);
    if (!room) {
        return res.status(404).json({ error: 'Phòng không tồn tại' });
    }
    const isAdmin = user.role === 'SERVER_ADMIN';
    const isOwner = room.owner_id === user.id;
    if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Chỉ Trưởng phòng hoặc Quản trị viên mới có quyền điều hành phòng này' });
    }
    if (!target_user_id || !action) {
        return res.status(400).json({ error: 'Vui lòng cung cấp: target_user_id, action' });
    }
    switch (action) {
        case 'ALLOW': {
            database_1.db.prepare(`
        INSERT INTO room_permissions (room_id, user_id, status, is_muted, can_ssh, granted_by)
        VALUES (?, ?, 'ALLOWED', 0, 0, ?)
        ON CONFLICT(room_id, user_id) DO UPDATE SET status = 'ALLOWED', granted_by = ?
      `).run(id, target_user_id, user.id, user.id);
            break;
        }
        case 'KICK': {
            database_1.db.prepare(`
        INSERT INTO room_permissions (room_id, user_id, status, is_muted, can_ssh, granted_by)
        VALUES (?, ?, 'KICKED', 0, 0, ?)
        ON CONFLICT(room_id, user_id) DO UPDATE SET status = 'KICKED'
      `).run(id, target_user_id, user.id);
            if (ioInstance) {
                ioInstance.to(`room_${id}`).emit('room:kicked', { roomId: id, userId: target_user_id });
            }
            break;
        }
        case 'MUTE': {
            database_1.db.prepare(`
        UPDATE room_permissions SET is_muted = 1 WHERE room_id = ? AND user_id = ?
      `).run(id, target_user_id);
            if (ioInstance) {
                ioInstance.to(`room_${id}`).emit('room:force_mute', { roomId: id, userId: target_user_id, isMuted: true });
            }
            break;
        }
        case 'UNMUTE': {
            database_1.db.prepare(`
        UPDATE room_permissions SET is_muted = 0 WHERE room_id = ? AND user_id = ?
      `).run(id, target_user_id);
            if (ioInstance) {
                ioInstance.to(`room_${id}`).emit('room:force_mute', { roomId: id, userId: target_user_id, isMuted: false });
            }
            break;
        }
        case 'GRANT_SSH': {
            database_1.db.prepare(`
        UPDATE room_permissions SET can_ssh = 1 WHERE room_id = ? AND user_id = ?
      `).run(id, target_user_id);
            break;
        }
        case 'REVOKE_SSH': {
            database_1.db.prepare(`
        UPDATE room_permissions SET can_ssh = 0 WHERE room_id = ? AND user_id = ?
      `).run(id, target_user_id);
            break;
        }
        default:
            return res.status(400).json({ error: `Hành động không hợp lệ: ${action}` });
    }
    (0, auditLogger_1.logActivity)(user, 'ROOM_MODERATION', { roomId: id, target_user_id, action }, req.ip, action === 'KICK' ? 'MEDIUM' : 'LOW');
    if (ioInstance) {
        ioInstance.to(`room_${id}`).emit('room:permission_updated', {
            roomId: id,
            targetUserId: target_user_id,
            action,
        });
    }
    return res.json({ message: `Đã thực hiện thao tác '${action}' thành công.` });
}
// 6. Get Room Permissions / Whitelist
function getRoomMembers(req, res) {
    const { id } = req.params;
    const user = req.user;
    const room = (0, database_1.getRoomById)(id);
    if (!room) {
        return res.status(404).json({ error: 'Phòng không tồn tại' });
    }
    const permissions = (0, database_1.getRoomPermissions)(id);
    return res.json({ members: permissions });
}
