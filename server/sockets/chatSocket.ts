import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/authMiddleware';
import { db, getUserById, getRoomById, getUserRoomPermission, getMessages } from '../db/database';
import { logActivity } from '../middleware/auditLogger';

// Map of userId -> Set of active socket instances
export const connectedUserSockets = new Map<string, Set<Socket>>();
export const activeVoiceUsersByRoom = new Map<string, Map<string, {
  userId: string;
  userName: string;
  username: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}>>();
let chatIoInstance: Server | null = null;

export function getIo(): Server | null {
  return chatIoInstance;
}

export function registerChatSocket(io: Server) {
  chatIoInstance = io;
  // Socket.io JWT Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded: any = jwt.verify(token as string, JWT_SECRET);
      const user = getUserById(decoded.id);
      if (!user || user.is_active === 0) {
        return next(new Error('User inactive or invalid'));
      }
      (socket as any).user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (!user) return socket.disconnect();

    // Register active user socket
    if (!connectedUserSockets.has(user.id)) {
      connectedUserSockets.set(user.id, new Set());
    }
    connectedUserSockets.get(user.id)!.add(socket);

    // Broadcast online presence
    broadcastPresence(io);

    console.log(`[ChatSocket] User connected: ${user.username} (${user.role}) - Socket ID: ${socket.id}`);

    // Join Room
    socket.on('chat:join_room', ({ roomId }: { roomId: string }) => {
      const room = getRoomById(roomId);
      if (!room) {
        return socket.emit('chat:error', { message: 'Phòng không tồn tại' });
      }

      // If not global, verify permission
      if (room.is_global !== 1 && user.role !== 'SERVER_ADMIN' && room.owner_id !== user.id) {
        const perm = getUserRoomPermission(roomId, user.id);
        if (!perm || perm.status !== 'ALLOWED') {
          return socket.emit('chat:error', { message: 'Bạn không có quyền tham gia phòng này' });
        }
      }

      socket.join(`room_${roomId}`);
      console.log(`[ChatSocket] ${user.username} joined room_${roomId}`);

      // Send recent message history
      const history = getMessages(roomId);
      socket.emit('chat:history', { roomId, messages: history });
    });

    // Leave Room
    socket.on('chat:leave_room', ({ roomId }: { roomId: string }) => {
      socket.leave(`room_${roomId}`);
      console.log(`[ChatSocket] ${user.username} left room_${roomId}`);
    });

    // Send Room Message (Group Chat)
    socket.on('chat:send_room_message', ({ roomId, content, fileMetadata }: { roomId: string; content?: string; fileMetadata?: any }) => {
      const room = getRoomById(roomId);
      if (!room) return;

      // Check Mute state
      if (room.is_global !== 1 && user.role !== 'SERVER_ADMIN' && room.owner_id !== user.id) {
        const perm = getUserRoomPermission(roomId, user.id);
        if (perm?.is_muted === 1) {
          return socket.emit('chat:error', { message: 'Bạn đã bị Trưởng phòng tắt tiếng (Muted)' });
        }
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fileMetaJson = fileMetadata ? JSON.stringify(fileMetadata) : null;

      db.prepare(`
        INSERT INTO messages (id, room_id, sender_id, receiver_id, content, file_metadata)
        VALUES (?, ?, ?, NULL, ?, ?)
      `).run(msgId, roomId, user.id, content || '', fileMetaJson);

      const messagePayload = {
        id: msgId,
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.full_name,
        sender_username: user.username,
        sender_role: user.role,
        content: content || '',
        file_metadata: fileMetadata || null,
        created_at: new Date().toISOString(),
      };

      io.to(`room_${roomId}`).emit('chat:room_message', messagePayload);
    });

    // Send 1-on-1 Direct Message
    socket.on('chat:send_direct_message', ({ receiverId, content, fileMetadata }: { receiverId: string; content?: string; fileMetadata?: any }) => {
      const targetUser = getUserById(receiverId);
      if (!targetUser) {
        return socket.emit('chat:error', { message: 'Người nhận không tồn tại' });
      }

      const msgId = `msg_dm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fileMetaJson = fileMetadata ? JSON.stringify(fileMetadata) : null;

      db.prepare(`
        INSERT INTO messages (id, room_id, sender_id, receiver_id, content, file_metadata)
        VALUES (?, NULL, ?, ?, ?, ?)
      `).run(msgId, user.id, receiverId, content || '', fileMetaJson);

      const messagePayload = {
        id: msgId,
        room_id: null,
        sender_id: user.id,
        sender_name: user.full_name,
        sender_username: user.username,
        receiver_id: receiverId,
        content: content || '',
        file_metadata: fileMetadata || null,
        created_at: new Date().toISOString(),
      };

      // Deliver to recipient's sockets
      const recipientSockets = connectedUserSockets.get(receiverId);
      if (recipientSockets) {
        for (const s of recipientSockets) {
          s.emit('chat:direct_message', messagePayload);
        }
      }

      // Echo back to sender
      socket.emit('chat:direct_message', messagePayload);
    });

    // Get Chat History
    socket.on('chat:get_history', ({ roomId, peerId }: { roomId?: string; peerId?: string }) => {
      if (roomId) {
        const history = getMessages(roomId);
        socket.emit('chat:history', { roomId, messages: history });
      } else if (peerId) {
        const history = getMessages(null, user.id, peerId);
        socket.emit('chat:history', { peerId, messages: history });
      }
    });

    // Collaborative Real-Time Whiteboard Events
    socket.on('whiteboard:draw', ({ roomId, stroke }: { roomId: string; stroke: any }) => {
      if (!roomId) return;
      socket.to(`room_${roomId}`).emit('whiteboard:draw', {
        stroke,
        userId: user.id,
        userName: user.full_name,
      });
    });

    socket.on('whiteboard:clear', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      socket.to(`room_${roomId}`).emit('whiteboard:clear', {
        userId: user.id,
        userName: user.full_name,
      });
    });

    socket.on('whiteboard:cursor', ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
      if (!roomId) return;
      socket.to(`room_${roomId}`).emit('whiteboard:cursor', {
        x,
        y,
        userId: user.id,
        userName: user.full_name,
      });
    });

    socket.on('whiteboard:sticky', ({ roomId, note }: { roomId: string; note: any }) => {
      if (!roomId) return;
      socket.to(`room_${roomId}`).emit('whiteboard:sticky', {
        note,
        userId: user.id,
        userName: user.full_name,
      });
    });

    // ==========================================
    // Voice Lounge / Walkie-Talkie Real-time Events
    // ==========================================
    let currentVoiceRoomId: string | null = null;

    socket.on('voice:join', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      currentVoiceRoomId = roomId;

      if (!activeVoiceUsersByRoom.has(roomId)) {
        activeVoiceUsersByRoom.set(roomId, new Map());
      }
      const roomUsers = activeVoiceUsersByRoom.get(roomId)!;
      const userInfo = {
        userId: user.id,
        userName: user.full_name,
        username: user.username,
        isSpeaking: false,
        isMuted: false,
        isDeafened: false,
      };
      roomUsers.set(user.id, userInfo);

      // Send current room voice members to this socket
      socket.emit('voice:state', {
        roomId,
        users: Array.from(roomUsers.values()),
      });

      // Broadcast to other sockets in room
      socket.to(`room_${roomId}`).emit('voice:user_joined', {
        roomId,
        user: userInfo,
      });
    });

    socket.on('voice:leave', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      currentVoiceRoomId = null;
      const roomUsers = activeVoiceUsersByRoom.get(roomId);
      if (roomUsers) {
        roomUsers.delete(user.id);
        if (roomUsers.size === 0) {
          activeVoiceUsersByRoom.delete(roomId);
        }
      }
      socket.to(`room_${roomId}`).emit('voice:user_left', {
        roomId,
        userId: user.id,
        userName: user.full_name,
      });
    });

    socket.on('voice:speaking', ({ roomId, isSpeaking }: { roomId: string; isSpeaking: boolean }) => {
      if (!roomId) return;
      const roomUsers = activeVoiceUsersByRoom.get(roomId);
      if (roomUsers && roomUsers.has(user.id)) {
        roomUsers.get(user.id)!.isSpeaking = isSpeaking;
      }
      socket.to(`room_${roomId}`).emit('voice:user_speaking', {
        roomId,
        userId: user.id,
        isSpeaking,
      });
    });

    socket.on('voice:mute_status', ({ roomId, isMuted, isDeafened }: { roomId: string; isMuted: boolean; isDeafened: boolean }) => {
      if (!roomId) return;
      const roomUsers = activeVoiceUsersByRoom.get(roomId);
      if (roomUsers && roomUsers.has(user.id)) {
        const u = roomUsers.get(user.id)!;
        u.isMuted = isMuted;
        u.isDeafened = isDeafened;
      }
      socket.to(`room_${roomId}`).emit('voice:user_mute_status', {
        roomId,
        userId: user.id,
        isMuted,
        isDeafened,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (currentVoiceRoomId) {
        const roomUsers = activeVoiceUsersByRoom.get(currentVoiceRoomId);
        if (roomUsers) {
          roomUsers.delete(user.id);
          if (roomUsers.size === 0) {
            activeVoiceUsersByRoom.delete(currentVoiceRoomId);
          }
        }
        socket.to(`room_${currentVoiceRoomId}`).emit('voice:user_left', {
          roomId: currentVoiceRoomId,
          userId: user.id,
          userName: user.full_name,
        });
      }

      const userSockets = connectedUserSockets.get(user.id);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          connectedUserSockets.delete(user.id);
        }
      }
      broadcastPresence(io);
      console.log(`[ChatSocket] User disconnected: ${user.username}`);
    });
  });
}

function broadcastPresence(io: Server) {
  const onlineUserIds = Array.from(connectedUserSockets.keys());
  io.emit('presence:update', { onlineUserIds });
}

