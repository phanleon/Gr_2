import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { db, getAuditLogs, getSshCommandLogs } from '../db/database';
import { logActivity } from '../middleware/auditLogger';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

async function queryOllama(prompt: string, systemPrompt?: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        system: systemPrompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      return data.response?.trim() || null;
    }
  } catch (err) {
    // Ollama offline or timed out -> graceful fallback
  }
  return null;
}

// 1. Summarize Department Project Post into 3 Bullet Points
export async function summarizePost(req: AuthenticatedRequest, res: Response) {
  const { postId, title, content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Nội dung bài viết không được để trống' });
  }

  const prompt = `Tóm tắt nội dung kế hoạch dự án sau đây thành đúng 3 gạch đầu dòng ngắn gọn, súc tích bằng tiếng Việt:\nTiêu đề: ${title || ''}\nNội dung: ${content}`;
  const systemPrompt = 'Bạn là trợ lý AI chuyên nghiệp phân tích kế hoạch và công việc nội bộ doanh nghiệp.';

  let summary = await queryOllama(prompt, systemPrompt);

  if (!summary) {
    // Intelligent extractive fallback
    const sentences = content
      .split(/[.\n]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 15);

    const firstPoint = sentences[0] || (title ? `Kế hoạch: ${title}` : 'Triển khai công việc theo đúng tiến độ đề ra.');
    const secondPoint = sentences[1] || 'Đảm bảo tuân thủ tiêu chuẩn an toàn bảo mật và kiểm soát truy cập dữ liệu.';
    const thirdPoint = sentences[2] || 'Các phòng ban liên quan phối hợp báo cáo định kỳ cho Ban Quản trị.';

    summary = `• ${firstPoint}\n• ${secondPoint}\n• ${thirdPoint}`;
  }

  // Update in DB if postId provided
  if (postId) {
    db.prepare('UPDATE feed_posts SET ai_summary = ? WHERE id = ?').run(summary, postId);
  }

  return res.json({
    summary,
    source: summary.startsWith('•') ? 'rule_engine' : 'ollama_local_ai',
  });
}

// 2. AI SSH Copilot: Natural language to Shell Command
export async function sshCopilot(req: AuthenticatedRequest, res: Response) {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt không được để trống' });
  }

  const systemPrompt = 'You are an expert DevOps engineer. Output ONLY the exact executable PowerShell or Linux Bash command corresponding to the request. Do NOT include markdown code blocks, explanation, or quotes.';
  let command = await queryOllama(prompt, systemPrompt);

  if (command) {
    command = command.replace(/```[a-z]*\n?/gi, '').trim();
  }

  if (!command) {
    // Smart heuristic command translation with accent normalization
    const cleanP = prompt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (cleanP.includes('dung luong') || cleanP.includes('o dia') || cleanP.includes('disk') || cleanP.includes('storage')) {
      command = 'Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N="Free(GB)";E={[math]::round($_.Free/1GB,2)}}';
    } else if (cleanP.includes('tien trinh') || cleanP.includes('process') || cleanP.includes('ram') || cleanP.includes('cpu')) {
      command = 'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 ProcessName, Id, @{N="RAM(MB)";E={[math]::round($_.WorkingSet64/1MB,2)}}';
    } else if (cleanP.includes('ip') || cleanP.includes('mang') || cleanP.includes('network') || cleanP.includes('card')) {
      command = 'Get-NetIPAddress | Where-Object AddressFamily -eq IPv4 | Select-Object InterfaceAlias, IPAddress';
    } else if (cleanP.includes('port') || cleanP.includes('cong') || cleanP.includes('listening')) {
      command = 'Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess';
    } else if (cleanP.includes('dich vu') || cleanP.includes('service')) {
      command = 'Get-Service | Where-Object Status -eq "Running" | Select-Object -First 15 DisplayName, Status';
    } else if (cleanP.includes('restart') || cleanP.includes('khoi dong lai')) {
      command = 'Restart-Computer -Force -WhatIf';
    } else {
      command = `Write-Host "[AI Copilot] Yêu cầu: ${prompt}"`;
    }
  }

  return res.json({ command });
}

// 3. AI Security Guard: Analyze Audit Logs & Flag Anomalies
export async function analyzeSecurityLogs(req: AuthenticatedRequest, res: Response) {
  const auditLogs = getAuditLogs(100);
  const sshLogs = getSshCommandLogs(100);

  // Heuristic Anomaly Evaluation
  const blockedSshCount = sshLogs.filter((l) => l.was_blocked === 1).length;
  const criticalAuditCount = auditLogs.filter((l) => l.risk_level === 'CRITICAL').length;
  const highAuditCount = auditLogs.filter((l) => l.risk_level === 'HIGH').length;
  const failedLogins = auditLogs.filter((l) => l.action_type === 'LOGIN_FAILED' || l.action_type === 'HTTP_POST_401').length;
  const unauthAccess = auditLogs.filter((l) => l.action_type === 'HTTP_POST_403' || l.action_type === 'FEED_ACCESS_DENIED').length;

  let score = 0;
  score += blockedSshCount * 30;
  score += criticalAuditCount * 25;
  score += highAuditCount * 15;
  score += failedLogins * 5;
  score += unauthAccess * 8;

  score = Math.min(100, score);

  let riskLevel: 'SECURE' | 'ELEVATED' | 'CRITICAL' = 'SECURE';
  if (score >= 50 || blockedSshCount > 0) {
    riskLevel = 'CRITICAL';
  } else if (score >= 20) {
    riskLevel = 'ELEVATED';
  }

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (blockedSshCount > 0) {
    findings.push(`Phát hiện ${blockedSshCount} lần kích hoạt Tường lửa SSH ngăn chặn các câu lệnh hủy diệt nguy hiểm.`);
    recommendations.push('Đề nghị Quản trị viên thu hồi quyền can_ssh của các tài khoản có hành vi gõ lệnh bất thường.');
  }

  if (unauthAccess > 0) {
    findings.push(`Ghi nhận ${unauthAccess} nỗ lực truy cập vượt quyền hoặc vào phòng ban khi chưa được Whitelist.`);
    recommendations.push('Duy trì chính sách Khóa Kép nghiêm ngặt và kiểm tra lại danh sách thành viên ALLOWED.');
  }

  if (failedLogins > 0) {
    findings.push(`Có ${failedLogins} lần đăng nhập không thành công.`);
    recommendations.push('Giám sát các địa chỉ IP phát sinh lỗi xác thực liên tiếp.');
  }

  if (findings.length === 0) {
    findings.push('Hệ thống hoạt động ổn định, không phát hiện vi phạm bảo mật hoặc hành vi xâm nhập.');
    recommendations.push('Tiếp tục duy trì sao lưu cơ sở dữ liệu và kiểm tra tunnel định kỳ.');
  }

  logActivity(req.user!, 'AI_SECURITY_SCAN_PERFORMED', { score, riskLevel, blockedSshCount }, req.ip, 'LOW');

  return res.json({
    riskScore: score,
    riskLevel,
    totalAuditLogsAnalyzed: auditLogs.length,
    totalSshCommandsAnalyzed: sshLogs.length,
    blockedCommandsDetected: blockedSshCount,
    findings,
    recommendations,
    timestamp: new Date().toISOString(),
  });
}
