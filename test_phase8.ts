import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import { startServer } from './server/index';
import { db, getUserById, getUserByUsername } from './server/db/database';

async function runPhase8Tests() {
  console.log('=== STARTING PHASE 8 AUTOMATED TEST SUITE ===');

  const PORT = 8092;
  const server = await startServer(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  const request = async (endpoint: string, method: string = 'GET', body?: any, token?: string) => {
    return new Promise<{ status: number; data: any; headers: any }>((resolve, reject) => {
      const url = new URL(endpoint, baseUrl);
      const req = http.request(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            let data = raw;
            try {
              data = JSON.parse(raw);
            } catch (e) {}
            resolve({ status: res.statusCode || 500, data, headers: res.headers });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };

  try {
    // [1] Admin Login
    console.log('\n[1] Testing Admin Login & Auth Token...');
    const adminLogin = await request('/api/auth/login', 'POST', {
      username: 'admin',
      password: 'Server@123456',
    });
    if (adminLogin.status !== 200) throw new Error('Admin login failed');
    const adminToken = adminLogin.data.token;
    console.log('Admin login status:', adminLogin.status, 'OK');

    // [2] Create a test staff user
    console.log('\n[2] Provisioning Test Staff User for Phase 8...');
    const testUsername = `staff_p8_${Date.now()}`;
    const initialPass = 'OldPass@123';
    const createStaff = await request('/api/admin/users', 'POST', {
      username: testUsername,
      password: initialPass,
      full_name: 'Test Staff Phase 8',
      role: 'CLIENT',
      department: 'QA Testing',
    }, adminToken);
    if (createStaff.status !== 201) throw new Error('Failed to create staff');
    const staffId = createStaff.data.user.id;
    console.log('Staff created:', testUsername, 'ID:', staffId);

    // [3] Staff Self Change Password (POST /api/auth/change-password)
    console.log('\n[3] Testing Staff Self-Service Password Change...');
    const staffLogin1 = await request('/api/auth/login', 'POST', {
      username: testUsername,
      password: initialPass,
    });
    const staffToken1 = staffLogin1.data.token;

    // 3a. Wrong current password (Expect 401)
    const badChange = await request('/api/auth/change-password', 'POST', {
      current_password: 'WrongPassword!',
      new_password: 'NewValidPass@456',
    }, staffToken1);
    console.log('Wrong current pass status (Expect 401):', badChange.status, badChange.data.error);
    if (badChange.status !== 401) throw new Error('Password change should reject invalid current password');

    // 3b. Correct password change (Expect 200)
    const newPass = 'NewValidPass@456';
    const goodChange = await request('/api/auth/change-password', 'POST', {
      current_password: initialPass,
      new_password: newPass,
    }, staffToken1);
    console.log('Valid password change status (Expect 200):', goodChange.status, goodChange.data.message);
    if (goodChange.status !== 200) throw new Error('Password change failed');

    // 3c. Verify login with new password
    const staffLoginNew = await request('/api/auth/login', 'POST', {
      username: testUsername,
      password: newPass,
    });
    console.log('Login with new password status (Expect 200):', staffLoginNew.status);
    if (staffLoginNew.status !== 200) throw new Error('Failed to login with new password');

    // [4] Admin Force Reset Password (POST /api/admin/users/:id/reset-password)
    console.log('\n[4] Testing Admin Password Reset Override...');
    const adminResetPass = 'AdminOverridePass@999';
    const resetRes = await request(`/api/admin/users/${staffId}/reset-password`, 'POST', {
      new_password: adminResetPass,
    }, adminToken);
    console.log('Admin reset password status (Expect 200):', resetRes.status, resetRes.data.message);
    if (resetRes.status !== 200) throw new Error('Admin reset password failed');

    // Verify staff login with reset password
    const staffLoginReset = await request('/api/auth/login', 'POST', {
      username: testUsername,
      password: adminResetPass,
    });
    console.log('Login with admin-reset password status (Expect 200):', staffLoginReset.status);
    if (staffLoginReset.status !== 200) throw new Error('Failed to login with admin-reset password');

    // [5] User Deactivation & Blocked Login Check
    console.log('\n[5] Testing User Deactivation & Login Enforcement...');
    // Lock account (is_active = 0)
    const lockRes = await request(`/api/admin/users/${staffId}/status`, 'PATCH', {
      is_active: false,
    }, adminToken);
    console.log('Lock user status:', lockRes.status, lockRes.data.message);

    // Try login with locked account (Expect 403)
    const lockedLogin = await request('/api/auth/login', 'POST', {
      username: testUsername,
      password: adminResetPass,
    });
    console.log('Login with locked account status (Expect 403):', lockedLogin.status, lockedLogin.data.error);
    if (lockedLogin.status !== 403) throw new Error('Locked user should be blocked from login');

    // Unlock account (is_active = 1)
    await request(`/api/admin/users/${staffId}/status`, 'PATCH', {
      is_active: true,
    }, adminToken);

    // [6] Export Centralized Audit Logs to CSV (GET /api/admin/audit-logs/export)
    console.log('\n[6] Testing CSV Audit Logs Export...');
    const exportRes = await request('/api/admin/audit-logs/export', 'GET', null, adminToken);
    console.log('Export Audit status:', exportRes.status);
    console.log('Content-Type header:', exportRes.headers['content-type']);
    if (exportRes.status !== 200) throw new Error('Audit export failed');
    if (!exportRes.headers['content-type']?.includes('text/csv')) throw new Error('Export header must be text/csv');
    if (!exportRes.data.includes('Thoi Gian') && !exportRes.data.includes('Hanh Dong')) {
      throw new Error('CSV output missing expected headers');
    }
    console.log('CSV Export contains expected UTF-8 data headers and logs.');

    // [7] UltraViewer Pro Signaling Events (Clipboard, Quality, File Transfer)
    console.log('\n[7] Testing UltraViewer Pro Socket.io Real-Time Signals...');
    const operatorSocket = ClientIO(baseUrl, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });

    const targetStaffToken = staffLoginReset.data.token;
    const targetSocket = ClientIO(baseUrl, {
      auth: { token: targetStaffToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Test Clipboard Sync
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Clipboard sync timed out')), 4000);
      targetSocket.on('desktop:clipboard_sync', (data: any) => {
        console.log('Target received synchronized clipboard:', data.text, 'From:', data.from);
        if (data.text === 'ZERO_TRUST_PRO_CLIPBOARD_TEXT') {
          clearTimeout(timeout);
          resolve();
        }
      });

      operatorSocket.emit('desktop:clipboard_sync', {
        targetSocketId: targetSocket.id,
        text: 'ZERO_TRUST_PRO_CLIPBOARD_TEXT',
      });
    });

    // Test Quality Mode Change
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Quality change timed out')), 4000);
      targetSocket.on('desktop:quality_change', (data: any) => {
        console.log('Target received quality mode update:', data.quality, 'FPS:', data.fps);
        if (data.quality === 'high' && data.fps === 60) {
          clearTimeout(timeout);
          resolve();
        }
      });

      operatorSocket.emit('desktop:quality_change', {
        targetSocketId: targetSocket.id,
        quality: 'high',
        fps: 60,
      });
    });

    // Test Remote File Transfer Signal
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('File transfer timed out')), 4000);
      targetSocket.on('desktop:file_transfer', (data: any) => {
        console.log('Target received remote file transfer:', data.fileName, 'Size:', data.fileSize);
        if (data.fileName === 'system_patch.txt') {
          clearTimeout(timeout);
          resolve();
        }
      });

      operatorSocket.emit('desktop:file_transfer', {
        targetSocketId: targetSocket.id,
        fileName: 'system_patch.txt',
        fileSize: 1024,
        fileData: Buffer.from('PATCH_CONTENTS').toString('base64'),
      });
    });

    operatorSocket.disconnect();
    targetSocket.disconnect();

    console.log('\n=== ALL PHASE 8 TESTS PASSED PERFECTLY (100%)! ===');
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase8Tests().catch((err) => {
  console.error('\n❌ PHASE 8 TEST FAILED:', err);
  process.exit(1);
});

