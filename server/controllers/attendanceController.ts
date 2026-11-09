import { Request, Response } from 'express';
import {
  getTodayAttendance,
  recordCheckIn,
  recordCheckOut,
  getAttendanceHistory,
  addAuditLog,
} from '../db/database';
import { getIo } from '../sockets/chatSocket';

export const getMyTodayStatus = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const record = getTodayAttendance(user.id, todayStr);
    res.json({ todayDate: todayStr, record: record || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const handleCheckIn = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const todayStr = new Date().toISOString().split('T')[0];
  const { notes } = req.body;

  try {
    const existing = getTodayAttendance(user.id, todayStr);
    if (existing) {
      res.status(400).json({ error: 'Bạn đã thực hiện Check-in cho ngày hôm nay rồi.' });
      return;
    }

    const checkInId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    recordCheckIn(checkInId, user.id, nowIso, todayStr, clientIp, notes || '');

    addAuditLog(
      user.id,
      user.username,
      user.role,
      'ATTENDANCE_CHECK_IN',
      JSON.stringify({ checkInId, workDate: todayStr, ip: clientIp }),
      clientIp,
      'LOW'
    );

    const io = getIo();
    if (io) {
      io.emit('attendance:update', { userId: user.id, type: 'CHECK_IN', time: nowIso });
    }

    res.status(201).json({ message: 'Điểm danh vào ca (Check-in) thành công!', checkInId, time: nowIso });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const handleCheckOut = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const todayStr = new Date().toISOString().split('T')[0];
  const { notes } = req.body;

  try {
    const existing = getTodayAttendance(user.id, todayStr);
    if (!existing) {
      res.status(400).json({ error: 'Bạn chưa Check-in ngày hôm nay nên không thể Check-out.' });
      return;
    }

    if (existing.check_out_time) {
      res.status(400).json({ error: 'Bạn đã Check-out kết ca cho ngày hôm nay rồi.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const checkInTime = new Date(existing.check_in_time).getTime();
    const checkOutTime = new Date(nowIso).getTime();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / 60000));

    recordCheckOut(existing.id, nowIso, durationMinutes, notes || '');

    addAuditLog(
      user.id,
      user.username,
      user.role,
      'ATTENDANCE_CHECK_OUT',
      JSON.stringify({ checkInId: existing.id, workDate: todayStr, durationMinutes }),
      req.ip || '127.0.0.1',
      'LOW'
    );

    const io = getIo();
    if (io) {
      io.emit('attendance:update', { userId: user.id, type: 'CHECK_OUT', time: nowIso, durationMinutes });
    }

    res.json({ message: 'Điểm danh kết ca (Check-out) thành công!', time: nowIso, durationMinutes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const listAttendanceHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { viewAll } = req.query;

  try {
    // If SERVER_ADMIN or ROOM_OWNER asks for all, return all; otherwise return self
    const targetUserId = (user.role === 'SERVER_ADMIN' || user.role === 'ROOM_OWNER') && viewAll === 'true'
      ? undefined
      : user.id;

    const records = getAttendanceHistory(targetUserId, 200);
    res.json({ records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const exportAttendanceCsv = async (req: Request, res: Response) => {
  try {
    const records = getAttendanceHistory(undefined, 1000);

    const headers = ['ID', 'Ho va Ten', 'Ten dang nhap', 'Phong ban', 'Ngay lam viec', 'Gio Check-in', 'Gio Check-out', 'Tong thoi gian (Phut)', 'Trang thai', 'IP Check-in', 'Ghi chu'];
    const rows = records.map((r: any) => [
      `"${r.id}"`,
      `"${r.full_name || ''}"`,
      `"${r.username || ''}"`,
      `"${r.department || ''}"`,
      `"${r.work_date}"`,
      `"${r.check_in_time ? new Date(r.check_in_time).toLocaleString('vi-VN') : ''}"`,
      `"${r.check_out_time ? new Date(r.check_out_time).toLocaleString('vi-VN') : 'Dang trong ca'}"`,
      `"${r.work_duration_minutes || 0}"`,
      `"${r.status}"`,
      `"${r.check_in_ip || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

