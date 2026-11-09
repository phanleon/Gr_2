import { Request, Response } from 'express';
import {
  saveWhiteboardSnapshot,
  getWhiteboardSnapshots,
  getWhiteboardById,
  deleteWhiteboardSnapshot,
} from '../db/database';
import { logActivity } from '../middleware/auditLogger';

export async function listWhiteboards(req: Request, res: Response) {
  try {
    const { roomId } = req.query;
    const snapshots = getWhiteboardSnapshots(roomId ? String(roomId) : null);
    res.json({ success: true, snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getWhiteboard(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const snapshot = getWhiteboardById(id);
    if (!snapshot) {
      return res.status(404).json({ error: 'Không tìm thấy bảng vẽ' });
    }
    res.json({ success: true, snapshot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function saveWhiteboard(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { id, roomId, title, canvasData, thumbnailUrl } = req.body;

    if (!title || !canvasData) {
      return res.status(400).json({ error: 'Tiêu đề và nội dung bảng vẽ là bắt buộc' });
    }

    const snapshotId = id || `wb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const canvasJson = typeof canvasData === 'string' ? canvasData : JSON.stringify(canvasData);

    saveWhiteboardSnapshot(
      snapshotId,
      roomId || null,
      user.id,
      title,
      canvasJson,
      thumbnailUrl || null
    );

    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'WHITEBOARD_SAVED',
      {
        snapshotId,
        title,
        roomId,
      }
    );

    res.status(201).json({
      success: true,
      snapshotId,
      message: 'Bảng vẽ ý tưởng đã được lưu thành công',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeWhiteboard(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const existing = getWhiteboardById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy bảng vẽ' });
    }

    if (user.role !== 'SERVER_ADMIN' && existing.creator_id !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bảng vẽ của người khác' });
    }

    deleteWhiteboardSnapshot(id);
    res.json({ success: true, message: 'Đã xóa bảng vẽ' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
