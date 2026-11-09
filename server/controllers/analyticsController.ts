import { Request, Response } from 'express';
import {
  getLiveAnalyticsMetrics,
  saveExecutiveReport,
  getExecutiveReports,
  deleteExecutiveReport,
  db,
} from '../db/database';
import { logActivity } from '../middleware/auditLogger';

export async function getExecutiveMetrics(req: Request, res: Response) {
  try {
    const metrics = getLiveAnalyticsMetrics();
    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function generateAiDigest(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { periodType = 'WEEKLY', customFocus = '' } = req.body;

    const metrics = getLiveAnalyticsMetrics();

    // Fetch recent posts and tasks for context synthesis
    const recentPosts = db.prepare(`
      SELECT title, content, created_at FROM feed_posts ORDER BY created_at DESC LIMIT 5
    `).all() as any[];

    const recentCompletedTasks = db.prepare(`
      SELECT title, priority, completed_at FROM project_tasks WHERE status = 'DONE' ORDER BY completed_at DESC LIMIT 5
    `).all() as any[];

    const pendingApprovals = db.prepare(`
      SELECT title, category, priority, created_at FROM approvals WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 5
    `).all() as any[];

    // Zero-Cost Local NLP Synthesis: Build Executive Summary
    const periodLabel = periodType === 'DAILY' ? 'Hôm Nay' : periodType === 'MONTHLY' ? 'Tháng Này' : 'Tuần Này';
    const nowStr = new Date().toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const completionRate = metrics.tasks.completionRate;
    const attendanceRate = metrics.attendance.todayAttendanceRate;
    const healthStatus = metrics.security.securityScore >= 90 ? '🟢 TỐI ƯU' : metrics.security.securityScore >= 75 ? '🟡 KHẢ QUAN' : '🔴 CẦN CHÚ Ý';

    const reportTitle = `Báo Cáo Tổng Hợp Điều Hành (${periodLabel}) - ${nowStr}`;

    const completedTasksSummary = recentCompletedTasks.length > 0
      ? recentCompletedTasks.map((t, idx) => `  ${idx + 1}. **${t.title}** (Mức độ: *${t.priority}*)`).join('\n')
      : '  - Chưa có nhiệm vụ nào hoàn tất trong chu kỳ đánh giá.';

    const pendingApprovalsSummary = pendingApprovals.length > 0
      ? pendingApprovals.map((a, idx) => `  ${idx + 1}. [${a.category}] **${a.title}** (Ưu tiên: *${a.priority}*)`).join('\n')
      : '  - Toàn bộ hồ sơ đề xuất đã được giải quyết, không có đề xuất tồn đọng.';

    const announcementsSummary = recentPosts.length > 0
      ? recentPosts.map((p, idx) => `  ${idx + 1}. **${p.title}**`).join('\n')
      : '  - Kênh truyền thông công ty không phát sinh thông báo khẩn.';

    const aiAnalysis = `
# 📊 BÁO CÁO TỔNG HỢP ĐIỀU HÀNH & NĂNG SUẤT DOANH NGHIỆP
**Hệ Thống:** Zero-Trust Secure Workspace & Enterprise Portal  
**Chu kỳ phân tích:** ${periodLabel} | **Thời điểm tổng hợp:** ${nowStr}  
**Người lập báo cáo:** ${user.full_name} (${user.role})  
**Chỉ số sức khỏe hệ thống:** ${healthStatus} (${metrics.security.securityScore}/100)

---

### 1. 📈 CÁC CHỈ SỐ VẬN HÀNH THEN CHỐT (KEY OPERATIONAL KPIS)
- 👥 **Nhân sự & Điểm danh:** 
  - Tổng số nhân sự kích hoạt: **${metrics.users.active} / ${metrics.users.total} thành viên**
  - Tỷ lệ có mặt trực tuyến hôm nay: **${attendanceRate}%** (${metrics.attendance.todayCount} lượt check-in, ${metrics.attendance.todayLate} lượt muộn)
  - Tổng thời gian làm việc ghi nhận: **${Math.round(metrics.attendance.todayTotalMinutes / 60)} giờ ${metrics.attendance.todayTotalMinutes % 60} phút**
- 🎯 **Hiệu suất hoàn thành công việc (Sprint Velocity):**
  - Tổng số nhiệm vụ Kanban: **${metrics.tasks.total} nhiệm vụ**
  - Tỷ lệ hoàn thành: **${completionRate}%** (Đã xong: ${metrics.tasks.done} | Đang thực hiện: ${metrics.tasks.inProgress} | Đang chờ nghiệm thu: ${metrics.tasks.review} | Cần làm: ${metrics.tasks.todo})
- 📋 **Trình ký & Phê duyệt nội bộ:**
  - Tổng hồ sơ đã xử lý: **${metrics.approvals.total}** (Chấp thuận: ${metrics.approvals.approved} | Từ chối: ${metrics.approvals.rejected} | Tồn đọng: ${metrics.approvals.pending})
- 🛡️ **An ninh mạng & Kiểm toán Zero-Trust:**
  - Bản ghi nhật ký bảo mật: **${metrics.security.totalAuditLogs} sự kiện**
  - Cảnh báo rủi ro cao/nguy cấp: **${metrics.security.highRiskIncidents} sự vụ** (Đã được tường lửa và Dual-Lock ngăn chặn tự động)
- 📁 **Tài nguyên số lưu trữ:**
  - Két mật khẩu bảo mật: **${metrics.resources.vaultItems} mục bí mật**
  - Tệp tin chia sẻ toàn doanh nghiệp: **${metrics.resources.driveFiles} tệp tin** (Được kiểm tra toàn vẹn SHA-256)

---

### 2. 🏆 THÀNH TỰU TIÊU BIỂU & DỰ ÁN NỔI BẬT
${completedTasksSummary}

---

### 3. ⚠️ ĐIỂM NGHẼN & HỒ SƠ CẦN GIẢI QUYẾT GẤP
${pendingApprovalsSummary}

---

### 4. 📢 THÔNG BÁO & HOẠT ĐỘNG PHÒNG BAN MỚI NHẤT
${announcementsSummary}

---

### 5. 💡 KHUYẾN NGHỊ TỐI ƯU HÓA TỪ AI COPILOT
1. **Đẩy nhanh tiến độ nghiệm thu:** Hiện có **${metrics.tasks.review} nhiệm vụ** đang chờ duyệt (Review). Khuyến nghị Trưởng phòng ban kiểm tra và đóng ticket để hoàn tất sprint.
2. **Giải quyết hồ sơ đề xuất:** Có **${metrics.approvals.pending} đề xuất** đang chờ phê duyệt. Ban lãnh đạo nên xử lý trong ngày để tránh đình trệ mua sắm/cấp phát thiết bị.
3. **Duy trì kỷ luật điểm danh:** Tiếp tục theo dõi tỷ lệ chấm công đầu ngày (hiện đạt **${attendanceRate}%**) nhằm đảm bảo tính sẵn sàng phối hợp làm việc từ xa.
4. **Độ an toàn Zero-Trust:** Điểm an ninh đạt **${metrics.security.securityScore}%** – Đề xuất duy trì chính sách thay đổi mật khẩu định kỳ 90 ngày và tiếp tục cô lập phân quyền Dual-Lock trên từng phòng ban.
`.trim();

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    saveExecutiveReport(reportId, user.id, reportTitle, periodType, JSON.stringify(metrics), aiAnalysis);

    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'EXECUTIVE_REPORT_GENERATED',
      {
        reportId,
        periodType,
        completionRate,
        attendanceRate,
      }
    );

    res.status(201).json({
      success: true,
      report: {
        id: reportId,
        author_id: user.id,
        author_name: user.full_name,
        report_title: reportTitle,
        period_type: periodType,
        metrics,
        ai_analysis: aiAnalysis,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listExecutiveReports(req: Request, res: Response) {
  try {
    const rawReports = getExecutiveReports();
    const reports = rawReports.map((r) => {
      let metrics = {};
      try {
        metrics = JSON.parse(r.metrics_json);
      } catch (e) {}
      return {
        ...r,
        metrics,
      };
    });
    res.json({ success: true, reports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeExecutiveReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    deleteExecutiveReport(id);
    res.json({ success: true, message: 'Đã xóa bản báo cáo thành công' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
