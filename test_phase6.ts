import { startServer } from './server/index';
import { db, getFeedPosts } from './server/db/database';
import fs from 'fs';
import path from 'path';

async function request(url: string, method: string = 'GET', body: any = null, token: string | null = null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:8080${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function runTests() {
  console.log('=== STARTING PHASE 6 AUTOMATED TEST SUITE ===');
  const server = await startServer(8080);

  try {
    // 1. Authenticate Admin
    console.log('\n[1] Authenticating Admin...');
    const adminLogin = await request('/api/auth/login', 'POST', { username: 'admin', password: 'Server@123456' });
    const adminToken = adminLogin.data.token;

    // 2. Test AI Summarizer (3 Bullet Points)
    console.log('\n[2] Testing AI Project Plan Summarizer (3 Bullet Points)...');
    const posts = getFeedPosts(null);
    const testPost = posts[0];

    const longContent = `Kế hoạch chuyển đổi số và nâng cấp hạ tầng đám mây cho quý 4 năm 2026.
Toàn bộ hệ thống cơ sở dữ liệu sẽ được di chuyển sang kiến trúc phân tán đa vùng với độ sẵn sàng cao 99.99%.
Thời gian triển khai dự kiến bắt đầu từ ngày 15/11 và kết thúc trước ngày 20/12/2026.
Đội ngũ an toàn thông tin chịu trách nhiệm rà soát toàn bộ quyền truy cập và kiểm thử xâm nhập trước khi Golive.`;

    const summaryRes = await request('/api/ai/summarize-post', 'POST', {
      postId: testPost ? testPost.id : null,
      title: 'Kế hoạch nâng cấp hạ tầng đám mây Q4',
      content: longContent,
    }, adminToken);

    console.log('AI Summarize Status:', summaryRes.status);
    console.log('Generated AI Summary:\n', summaryRes.data.summary);

    if (summaryRes.status !== 200 || !summaryRes.data.summary) {
      throw new Error('AI Summarize failed');
    }

    // 3. Test AI SSH Copilot (Natural Language -> Shell Command)
    console.log('\n[3] Testing AI SSH Copilot (Natural Language Translation)...');
    const queries = [
      'Kiểm tra dung lượng ổ đĩa còn trống',
      'Xem các tiến trình ngốn nhiều RAM nhất',
      'Xem địa chỉ IP mạng máy tính',
    ];

    for (const q of queries) {
      const copilotRes = await request('/api/ai/ssh-copilot', 'POST', { prompt: q }, adminToken);
      console.log(`Prompt: "${q}" -> Command: $ ${copilotRes.data.command}`);
      if (!copilotRes.data.command) throw new Error(`Copilot failed on prompt: ${q}`);
    }

    // 4. Test AI Security Log Analysis & Anomaly Scoring
    console.log('\n[4] Testing AI Security Guard (Audit & SSH Command Log Analysis)...');
    const secRes = await request('/api/ai/analyze-security-logs', 'POST', {}, adminToken);
    console.log('AI Security Analysis Status:', secRes.status);
    console.log('Risk Score:', secRes.data.riskScore, '/ 100 | Risk Level:', secRes.data.riskLevel);
    console.log('Findings:', secRes.data.findings);
    console.log('Recommendations:', secRes.data.recommendations);

    if (secRes.status !== 200 || secRes.data.riskScore === undefined) {
      throw new Error('AI Security analysis failed');
    }

    // 5. Test Build Artifacts & Windows Packaging Configurations
    console.log('\n[5] Verifying Production Distribution Artifacts & Windows Packaging Config...');
    const distHtml = path.resolve(process.cwd(), 'dist', 'index.html');
    const distJs = fs.readdirSync(path.resolve(process.cwd(), 'dist', 'assets')).filter((f) => f.endsWith('.js'));
    const distCss = fs.readdirSync(path.resolve(process.cwd(), 'dist', 'assets')).filter((f) => f.endsWith('.css'));
    const electronMain = path.resolve(process.cwd(), 'dist-electron', 'electron', 'main.js');
    const serverIndex = path.resolve(process.cwd(), 'dist-electron', 'server', 'index.js');
    const cloudflaredExe = path.resolve(process.cwd(), 'bin', 'cloudflared.exe');

    console.log('dist/index.html exists:', fs.existsSync(distHtml));
    console.log('dist JavaScript bundle:', distJs);
    console.log('dist CSS bundle:', distCss);
    console.log('dist-electron/electron/main.js exists:', fs.existsSync(electronMain));
    console.log('dist-electron/server/index.js exists:', fs.existsSync(serverIndex));
    console.log('bin/cloudflared.exe exists:', fs.existsSync(cloudflaredExe));

    if (!fs.existsSync(distHtml) || distJs.length === 0 || !fs.existsSync(electronMain) || !fs.existsSync(serverIndex) || !fs.existsSync(cloudflaredExe)) {
      throw new Error('Missing critical production build artifacts!');
    }

    // Verify electron-builder.json
    const builderJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'electron-builder.json'), 'utf-8'));
    console.log('electron-builder targets:', builderJson.win?.target);
    console.log('electron-builder portable artifact:', builderJson.portable?.artifactName);

    if (builderJson.portable?.artifactName !== 'SecureWorkspace_Portable.exe') {
      throw new Error('Portable artifact name mismatch');
    }

    console.log('\n=== ALL PHASE 6 TESTS PASSED PERFECTLY! ===');
  } finally {
    server.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 6 test failed:', err);
    process.exit(1);
  });
