import { startServer } from './server/index';
import { initDatabase, getUserByUsername } from './server/db/database';

async function testAuthAccounts() {
  console.log('=== STARTING THOROUGH AUTHENTICATION & SEED VERIFICATION ===');
  
  // 1. Initialize database & seed
  initDatabase();

  const server = await startServer(8125);
  const baseUrl = 'http://127.0.0.1:8125';

  async function loginRequest(username: string, password: string, edition: 'SERVER' | 'CLIENT') {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-edition': edition,
      },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  try {
    // Test 1: Admin on Server Edition
    console.log('\n[1] Testing admin login on Server Edition (Expected: 200)...');
    const r1 = await loginRequest('admin', 'Server@123456', 'SERVER');
    console.log('Status:', r1.status, 'User:', r1.data.user?.username, 'Role:', r1.data.user?.role);
    if (r1.status !== 200 || !r1.data.token || r1.data.user?.role !== 'SERVER_ADMIN') {
      throw new Error(`Admin login on Server failed: ${JSON.stringify(r1.data)}`);
    }

    // Test 2: Admin on Client Edition
    console.log('\n[2] Testing admin login on Client Edition (Expected: 200)...');
    const r2 = await loginRequest('admin', 'Server@123456', 'CLIENT');
    console.log('Status:', r2.status, 'User:', r2.data.user?.username);
    if (r2.status !== 200 || !r2.data.token) {
      throw new Error(`Admin login on Client failed: ${JSON.stringify(r2.data)}`);
    }

    // Test 3: staff_bob on Client Edition
    console.log('\n[3] Testing staff_bob login on Client Edition (Expected: 200)...');
    const r3 = await loginRequest('staff_bob', 'Staff@123456', 'CLIENT');
    console.log('Status:', r3.status, 'User:', r3.data.user?.username, 'Role:', r3.data.user?.role);
    if (r3.status !== 200 || !r3.data.token || r3.data.user?.role !== 'CLIENT') {
      throw new Error(`staff_bob login on Client failed: ${JSON.stringify(r3.data)}`);
    }

    // Test 4: it_head on Client Edition
    console.log('\n[4] Testing it_head login on Client Edition (Expected: 200)...');
    const r4 = await loginRequest('it_head', 'Owner@123456', 'CLIENT');
    console.log('Status:', r4.status, 'User:', r4.data.user?.username, 'Role:', r4.data.user?.role);
    if (r4.status !== 200 || !r4.data.token || r4.data.user?.role !== 'ROOM_OWNER') {
      throw new Error(`it_head login on Client failed: ${JSON.stringify(r4.data)}`);
    }

    // Test 5: staff_alice on Client Edition
    console.log('\n[5] Testing staff_alice login on Client Edition (Expected: 200)...');
    const r5 = await loginRequest('staff_alice', 'Staff@123456', 'CLIENT');
    console.log('Status:', r5.status, 'User:', r5.data.user?.username, 'Role:', r5.data.user?.role);
    if (r5.status !== 200 || !r5.data.token || r5.data.user?.role !== 'CLIENT') {
      throw new Error(`staff_alice login on Client failed: ${JSON.stringify(r5.data)}`);
    }

    // Test 6: staff_bob on Server Edition (Expected: 403 Forbidden)
    console.log('\n[6] Testing staff_bob on Server Edition (Expected: 403 Forbidden)...');
    const r6 = await loginRequest('staff_bob', 'Staff@123456', 'SERVER');
    console.log('Status:', r6.status, 'Error Message:', r6.data.error);
    if (r6.status !== 403) {
      throw new Error(`staff_bob should be rejected on Server Edition, got ${r6.status}`);
    }

    // Test 7: it_head on Server Edition (Expected: 403 Forbidden)
    console.log('\n[7] Testing it_head on Server Edition (Expected: 403 Forbidden)...');
    const r7 = await loginRequest('it_head', 'Owner@123456', 'SERVER');
    console.log('Status:', r7.status, 'Error Message:', r7.data.error);
    if (r7.status !== 403) {
      throw new Error(`it_head should be rejected on Server Edition, got ${r7.status}`);
    }

    // Test 8: Wrong password (Expected: 401 Unauthorized)
    console.log('\n[8] Testing wrong password (Expected: 401 Unauthorized)...');
    const r8 = await loginRequest('staff_bob', 'WrongPass123', 'CLIENT');
    console.log('Status:', r8.status, 'Error Message:', r8.data.error);
    if (r8.status !== 401) {
      throw new Error(`Wrong password should return 401, got ${r8.status}`);
    }

    console.log('\n=== ALL AUTHENTICATION TESTS PASSED 100% PERFECTLY! ===\n');
  } finally {
    server.close();
  }
}

testAuthAccounts().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

