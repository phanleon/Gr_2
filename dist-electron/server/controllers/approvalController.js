"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processApprovalDecision = exports.submitApproval = exports.listApprovals = void 0;
const database_1 = require("../db/database");
const chatSocket_1 = require("../sockets/chatSocket");
const listApprovals = async (req, res) => {
    const user = req.user;
    const { roomId } = req.query;
    try {
        const approvals = (0, database_1.getApprovals)(user.id, user.role, roomId);
        res.json({ approvals });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.listApprovals = listApprovals;
const submitApproval = async (req, res) => {
    const user = req.user;
    const { title, category, content, room_id, priority } = req.body;
    if (!title || !content || !category) {
        res.status(400).json({ error: 'Tiêu đề, danh mục và nội dung đề xuất không được để trống.' });
        return;
    }
    try {
        const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        (0, database_1.createApproval)(approvalId, user.id, room_id || null, title.trim(), category, content.trim(), priority || 'NORMAL');
        (0, database_1.addAuditLog)(user.id, user.username, user.role, 'SUBMIT_APPROVAL', JSON.stringify({ approvalId, title, category }), req.ip || '127.0.0.1', 'LOW');
        const io = (0, chatSocket_1.getIo)();
        if (io) {
            io.emit('approval:new', {
                id: approvalId,
                title,
                category,
                requester_name: user.full_name,
                room_id,
                priority,
            });
            io.emit('notification:refresh', { type: 'APPROVAL' });
        }
        res.status(201).json({ message: 'Gửi phiếu đề xuất thành công!', approvalId });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.submitApproval = submitApproval;
const processApprovalDecision = async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { status, feedback } = req.body;
    if (status !== 'APPROVED' && status !== 'REJECTED') {
        res.status(400).json({ error: 'Trạng thái phê duyệt phải là APPROVED hoặc REJECTED.' });
        return;
    }
    // Only SERVER_ADMIN or ROOM_OWNER can approve/reject
    if (user.role !== 'SERVER_ADMIN' && user.role !== 'ROOM_OWNER') {
        res.status(403).json({ error: 'Chỉ Quản trị viên hoặc Trưởng phòng mới có thẩm quyền phê duyệt đề xuất này.' });
        return;
    }
    try {
        const approval = (0, database_1.getApprovalById)(id);
        if (!approval) {
            res.status(404).json({ error: 'Phiếu đề xuất không tồn tại.' });
            return;
        }
        (0, database_1.decideApproval)(id, user.id, status, feedback || '');
        // Notify the requester directly
        const statusText = status === 'APPROVED' ? 'ĐƯỢC PHÊ DUYỆT' : 'BỊ TỪ CHỐI';
        (0, database_1.createNotification)(approval.requester_id, `📋 Đề xuất '${approval.title}' đã ${statusText}`, feedback ? `Ý kiến từ người duyệt (${user.full_name}): ${feedback}` : `Phiếu đề xuất của bạn đã được ${user.full_name} xử lý.`, 'SYSTEM', 'approvals', id);
        (0, database_1.addAuditLog)(user.id, user.username, user.role, 'DECIDE_APPROVAL', JSON.stringify({ approvalId: id, status, feedback }), req.ip || '127.0.0.1', 'MEDIUM');
        const io = (0, chatSocket_1.getIo)();
        if (io) {
            io.emit('approval:decided', { id, status, approver_name: user.full_name, feedback });
            io.emit('notification:refresh', { type: 'APPROVAL' });
        }
        res.json({ message: `Đã ${status === 'APPROVED' ? 'phê duyệt' : 'từ chối'} đề xuất thành công!` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.processApprovalDecision = processApprovalDecision;
