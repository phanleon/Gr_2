"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializePoll = serializePoll;
exports.sweepExpiredPolls = sweepExpiredPolls;
exports.listRoomPolls = listRoomPolls;
exports.createRoomPoll = createRoomPoll;
exports.voteOnPoll = voteOnPoll;
exports.closeRoomPoll = closeRoomPoll;
exports.deleteRoomPoll = deleteRoomPoll;
exports.exportPollCsv = exportPollCsv;
const database_1 = require("../db/database");
const chatSocket_1 = require("../sockets/chatSocket");
const auditLogger_1 = require("../middleware/auditLogger");
const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;
const MAX_QUESTION_LEN = 300;
const MAX_OPTION_LEN = 120;
// ------------------------------------------------------------------
// Access helpers
// ------------------------------------------------------------------
/** Mirrors the chat-room access rules: global room, admin, owner, or whitelisted (ALLOWED). */
function canAccessRoom(room, user) {
    if (!room)
        return false;
    if (room.is_global === 1 || user.role === 'SERVER_ADMIN' || room.owner_id === user.id)
        return true;
    const perm = (0, database_1.getUserRoomPermission)(room.id, user.id);
    return !!perm && perm.status === 'ALLOWED';
}
function isMutedInRoom(room, user) {
    if (room.is_global === 1 || user.role === 'SERVER_ADMIN' || room.owner_id === user.id)
        return false;
    const perm = (0, database_1.getUserRoomPermission)(room.id, user.id);
    return perm?.is_muted === 1;
}
/** Creator, SERVER_ADMIN or the room owner may close/delete a poll. */
function canModeratePoll(poll, room, user) {
    return poll.creator_id === user.id || user.role === 'SERVER_ADMIN' || (room && room.owner_id === user.id);
}
function isExpired(poll) {
    if (!poll.expires_at)
        return false;
    return new Date(poll.expires_at).getTime() <= Date.now();
}
// ------------------------------------------------------------------
// Serialisation
// ------------------------------------------------------------------
/**
 * Builds the public representation of a poll.
 * - Anonymous polls never expose who voted for what (only counts).
 * - `myVotes` is only included when a viewer id is supplied (HTTP responses);
 *   socket broadcasts omit it, and clients keep their own ballot locally.
 */
function serializePoll(pollRow, viewerId) {
    const options = safeParseArray(pollRow.options);
    const votes = (0, database_1.getPollVotes)(pollRow.id);
    const isAnonymous = pollRow.is_anonymous === 1;
    const counts = options.map(() => 0);
    const voters = options.map(() => []);
    const distinctVoters = new Set();
    const myVotes = [];
    for (const v of votes) {
        if (v.option_index < 0 || v.option_index >= options.length)
            continue;
        counts[v.option_index]++;
        distinctVoters.add(v.user_id);
        if (!isAnonymous) {
            voters[v.option_index].push({ userId: v.user_id, fullName: v.full_name, username: v.username });
        }
        if (viewerId && v.user_id === viewerId)
            myVotes.push(v.option_index);
    }
    const totalVotes = counts.reduce((a, b) => a + b, 0);
    return {
        id: pollRow.id,
        roomId: pollRow.room_id,
        question: pollRow.question,
        creatorId: pollRow.creator_id,
        creatorName: pollRow.creator_name || pollRow.creator_username || 'Không rõ',
        isAnonymous,
        allowMultiple: pollRow.allow_multiple === 1,
        isClosed: pollRow.is_closed === 1,
        expiresAt: pollRow.expires_at || null,
        closedAt: pollRow.closed_at || null,
        createdAt: pollRow.created_at,
        totalVotes,
        totalVoters: distinctVoters.size,
        options: options.map((text, idx) => ({
            index: idx,
            text,
            votes: counts[idx],
            percent: totalVotes > 0 ? Math.round((counts[idx] / totalVotes) * 1000) / 10 : 0,
            voters: isAnonymous ? undefined : voters[idx],
        })),
        ...(viewerId !== undefined ? { myVotes } : {}),
    };
}
function safeParseArray(json) {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
}
function broadcast(roomId, event, payload) {
    const io = (0, chatSocket_1.getIo)();
    if (io)
        io.to(`room_${roomId}`).emit(event, payload);
}
/** Closes a poll whose deadline has passed and notifies the room. Returns the fresh row. */
function autoCloseIfExpired(pollRow) {
    if (pollRow && pollRow.is_closed !== 1 && isExpired(pollRow)) {
        (0, database_1.closePollRow)(pollRow.id);
        const fresh = (0, database_1.getPollRowById)(pollRow.id);
        broadcast(fresh.room_id, 'poll:closed', serializePoll(fresh));
        return fresh;
    }
    return pollRow;
}
/** Periodic sweep so rooms see expiring polls close live, not only on next read. */
function sweepExpiredPolls() {
    try {
        const rows = database_1.db
            .prepare(`SELECT id FROM room_polls WHERE is_closed = 0 AND expires_at IS NOT NULL AND expires_at <= ?`)
            .all(new Date().toISOString());
        for (const r of rows)
            autoCloseIfExpired((0, database_1.getPollRowById)(r.id));
    }
    catch (err) {
        console.warn('[Polls] Expiry sweep failed:', err.message);
    }
}
const sweepTimer = setInterval(sweepExpiredPolls, 15000);
if (typeof sweepTimer.unref === 'function')
    sweepTimer.unref();
// ------------------------------------------------------------------
// HTTP handlers
// ------------------------------------------------------------------
async function listRoomPolls(req, res) {
    try {
        const user = req.user;
        const room = (0, database_1.getRoomById)(req.params.roomId);
        if (!room)
            return res.status(404).json({ error: 'Phòng không tồn tại' });
        if (!canAccessRoom(room, user)) {
            return res.status(403).json({ error: 'Bạn không có quyền xem bình chọn của phòng này' });
        }
        const polls = (0, database_1.getPollRowsByRoom)(room.id).map((row) => serializePoll(autoCloseIfExpired(row), user.id));
        res.json({ success: true, polls });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function createRoomPoll(req, res) {
    try {
        const user = req.user;
        const room = (0, database_1.getRoomById)(req.params.roomId);
        if (!room)
            return res.status(404).json({ error: 'Phòng không tồn tại' });
        if (!canAccessRoom(room, user)) {
            return res.status(403).json({ error: 'Bạn không có quyền tạo bình chọn trong phòng này' });
        }
        if (isMutedInRoom(room, user)) {
            return res.status(403).json({ error: 'Bạn đã bị Trưởng phòng tắt tiếng (Muted), không thể tạo bình chọn' });
        }
        const { question, options, isAnonymous, allowMultiple, durationMinutes } = req.body || {};
        const cleanQuestion = typeof question === 'string' ? question.trim() : '';
        if (!cleanQuestion)
            return res.status(400).json({ error: 'Vui lòng nhập câu hỏi bình chọn' });
        if (cleanQuestion.length > MAX_QUESTION_LEN) {
            return res.status(400).json({ error: `Câu hỏi tối đa ${MAX_QUESTION_LEN} ký tự` });
        }
        if (!Array.isArray(options))
            return res.status(400).json({ error: 'Danh sách phương án không hợp lệ' });
        const seen = new Set();
        const cleanOptions = [];
        for (const o of options) {
            const t = typeof o === 'string' ? o.trim() : '';
            if (!t)
                continue;
            if (t.length > MAX_OPTION_LEN) {
                return res.status(400).json({ error: `Mỗi phương án tối đa ${MAX_OPTION_LEN} ký tự` });
            }
            const key = t.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            cleanOptions.push(t);
        }
        if (cleanOptions.length < MIN_OPTIONS || cleanOptions.length > MAX_OPTIONS) {
            return res
                .status(400)
                .json({ error: `Cần từ ${MIN_OPTIONS} đến ${MAX_OPTIONS} phương án khác nhau` });
        }
        let expiresAt = null;
        const mins = Number(durationMinutes);
        if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== '' && mins !== 0) {
            if (!Number.isFinite(mins) || mins < 1 || mins > 60 * 24 * 30) {
                return res.status(400).json({ error: 'Thời hạn bình chọn phải từ 1 phút đến 30 ngày' });
            }
            expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();
        }
        const id = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        (0, database_1.insertPoll)({
            id,
            roomId: room.id,
            creatorId: user.id,
            question: cleanQuestion,
            options: cleanOptions,
            isAnonymous: !!isAnonymous,
            allowMultiple: !!allowMultiple,
            expiresAt,
        });
        const row = (0, database_1.getPollRowById)(id);
        broadcast(room.id, 'poll:created', serializePoll(row));
        (0, auditLogger_1.logActivity)(user, 'POLL_CREATED', {
            pollId: id,
            roomId: room.id,
            question: cleanQuestion.slice(0, 80),
            isAnonymous: !!isAnonymous,
        });
        res.status(201).json({ success: true, poll: serializePoll(row, user.id) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function voteOnPoll(req, res) {
    try {
        const user = req.user;
        let poll = (0, database_1.getPollRowById)(req.params.id);
        if (!poll)
            return res.status(404).json({ error: 'Cuộc bình chọn không tồn tại' });
        const room = (0, database_1.getRoomById)(poll.room_id);
        if (!canAccessRoom(room, user)) {
            return res.status(403).json({ error: 'Bạn không có quyền bình chọn trong phòng này' });
        }
        poll = autoCloseIfExpired(poll);
        if (poll.is_closed === 1) {
            return res.status(409).json({ error: 'Cuộc bình chọn đã kết thúc' });
        }
        const optionCount = safeParseArray(poll.options).length;
        const raw = req.body?.optionIndexes;
        if (!Array.isArray(raw))
            return res.status(400).json({ error: 'optionIndexes phải là một mảng' });
        const indexes = Array.from(new Set(raw.map((n) => Number(n))));
        if (indexes.some((n) => !Number.isInteger(n) || n < 0 || n >= optionCount)) {
            return res.status(400).json({ error: 'Phương án bình chọn không hợp lệ' });
        }
        if (poll.allow_multiple !== 1 && indexes.length > 1) {
            return res.status(400).json({ error: 'Cuộc bình chọn này chỉ cho phép chọn 1 phương án' });
        }
        // Empty array = retract ballot
        (0, database_1.replacePollVotes)(poll.id, user.id, indexes);
        const fresh = (0, database_1.getPollRowById)(poll.id);
        broadcast(fresh.room_id, 'poll:updated', serializePoll(fresh));
        res.json({ success: true, poll: serializePoll(fresh, user.id) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function closeRoomPoll(req, res) {
    try {
        const user = req.user;
        const poll = (0, database_1.getPollRowById)(req.params.id);
        if (!poll)
            return res.status(404).json({ error: 'Cuộc bình chọn không tồn tại' });
        const room = (0, database_1.getRoomById)(poll.room_id);
        if (!canModeratePoll(poll, room, user)) {
            return res.status(403).json({ error: 'Chỉ người tạo, Trưởng phòng hoặc Quản trị viên mới được kết thúc bình chọn' });
        }
        if (poll.is_closed === 1) {
            return res.json({ success: true, poll: serializePoll(poll, user.id) });
        }
        (0, database_1.closePollRow)(poll.id);
        const fresh = (0, database_1.getPollRowById)(poll.id);
        broadcast(fresh.room_id, 'poll:closed', serializePoll(fresh));
        (0, auditLogger_1.logActivity)(user, 'POLL_CLOSED', { pollId: poll.id, roomId: poll.room_id });
        res.json({ success: true, poll: serializePoll(fresh, user.id) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function deleteRoomPoll(req, res) {
    try {
        const user = req.user;
        const poll = (0, database_1.getPollRowById)(req.params.id);
        if (!poll)
            return res.status(404).json({ error: 'Cuộc bình chọn không tồn tại' });
        const room = (0, database_1.getRoomById)(poll.room_id);
        if (!canModeratePoll(poll, room, user)) {
            return res.status(403).json({ error: 'Chỉ người tạo, Trưởng phòng hoặc Quản trị viên mới được xóa bình chọn' });
        }
        (0, database_1.deletePollRow)(poll.id);
        broadcast(poll.room_id, 'poll:deleted', { id: poll.id, roomId: poll.room_id });
        (0, auditLogger_1.logActivity)(user, 'POLL_DELETED', { pollId: poll.id, roomId: poll.room_id }, req.ip, 'MEDIUM');
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
/** Exports results as CSV (UTF-8 BOM for Excel). Voter names only for public polls. */
async function exportPollCsv(req, res) {
    try {
        const user = req.user;
        const poll = (0, database_1.getPollRowById)(req.params.id);
        if (!poll)
            return res.status(404).json({ error: 'Cuộc bình chọn không tồn tại' });
        const room = (0, database_1.getRoomById)(poll.room_id);
        if (!canAccessRoom(room, user)) {
            return res.status(403).json({ error: 'Bạn không có quyền xuất kết quả bình chọn này' });
        }
        const data = serializePoll(poll);
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [];
        lines.push([esc('Câu hỏi'), esc(data.question)].join(','));
        lines.push([esc('Hình thức'), esc(data.isAnonymous ? 'Bỏ phiếu kín' : 'Công khai')].join(','));
        lines.push([esc('Tổng người tham gia'), esc(data.totalVoters)].join(','));
        lines.push('');
        lines.push([esc('STT'), esc('Phương án'), esc('Số phiếu'), esc('Tỷ lệ (%)'), esc('Người bình chọn')].join(','));
        for (const o of data.options) {
            const names = data.isAnonymous ? '(Ẩn danh)' : (o.voters || []).map((v) => v.fullName).join('; ');
            lines.push([esc(o.index + 1), esc(o.text), esc(o.votes), esc(o.percent), esc(names)].join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="poll_${poll.id}.csv"`);
        res.send(Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf-8'));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
