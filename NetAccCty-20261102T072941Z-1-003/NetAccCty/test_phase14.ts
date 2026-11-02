import assert from 'assert';
import { io as ioClient, Socket } from 'socket.io-client';
import { startServer } from './server/index';
import { initDatabase } from './server/db/database';
import { generateTotp } from './server/utils/totp';

const TEST_PORT = 8104;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

async function runPhase14Tests() {
  console.log('=== STARTING PHASE 14 AUTOMATED TEST SUITE (2FA TOTP & VOICE LOUNGE) ===');
  initDatabase();
  const server = await startServer(TEST_PORT);

  try {
    // 1. Authenticate Admin and create test user
    console.log('\n[1] Authenticating Admin and creating test user for 2FA...');
    const adminLoginRes = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Server@123456' }),
    });
    const adminLogin = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200);
    const adminToken = adminLogin.token;

    const testUsername = `user_2fa_${Date.now()}`;
    const testPassword = 'Password@2fa123';
    const createUserRes = await fetch(`${SERVER_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
        full_name: 'David 2FA Security',
        role: 'CLIENT',
        department: 'Security Operations',
      }),
    });
    assert.strictEqual(createUserRes.status, 201);

    // Initial Login without 2FA
    const initLoginRes = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: testPassword }),
    });
    const initLogin = await initLoginRes.json();
    assert.strictEqual(initLoginRes.status, 200);
    assert.ok(initLogin.token);
    assert.strictEqual(initLogin.requires2Fa, undefined);
    const userToken = initLogin.token;
    console.log('User logged in normally before 2FA.');

    // 2. Test 2FA Setup & Enabling
    console.log('\n[2] Testing 2FA Setup & Verification...');
    const setup2FaRes = await fetch(`${SERVER_URL}/api/auth/2fa/setup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(setup2FaRes.status, 200);
    const setupData = await setup2FaRes.json();
    assert.ok(setupData.secret);
    assert.ok(setupData.otpauthUrl.includes('otpauth://totp/'));
    assert.strictEqual(setupData.recoveryCodes.length, 8);
    const secret = setupData.secret;
    const recoveryCode1 = setupData.recoveryCodes[0];
    console.log('2FA Secret generated successfully:', secret);

    // Verify with invalid code (Expect 400)
    const invalidVerifyRes = await fetch(`${SERVER_URL}/api/auth/2fa/verify-and-enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ code: '000000' }),
    });
    assert.strictEqual(invalidVerifyRes.status, 400);

    // Generate valid TOTP code
    const validOtp = generateTotp(secret);
    const validVerifyRes = await fetch(`${SERVER_URL}/api/auth/2fa/verify-and-enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ code: validOtp }),
    });
    assert.strictEqual(validVerifyRes.status, 200);
    console.log('2FA verified and enabled successfully with valid TOTP code:', validOtp);

    // Check status
    const statusRes = await fetch(`${SERVER_URL}/api/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.enabled, true);

    // 3. Test Login Challenge with 2FA
    console.log('\n[3] Testing Login Enforcement with 2FA Challenge...');
    const challengeLoginRes = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: testPassword }),
    });
    assert.strictEqual(challengeLoginRes.status, 200);
    const challengeData = await challengeLoginRes.json();
    assert.strictEqual(challengeData.requires2Fa, true);
    assert.ok(challengeData.tempToken);
    const tempToken = challengeData.tempToken;
    console.log('Server correctly enforced 2FA challenge on login.');

    // Authenticate 2FA with wrong code (Expect 401)
    const bad2FaAuthRes = await fetch(`${SERVER_URL}/api/auth/2fa/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: '123456' }),
    });
    assert.strictEqual(bad2FaAuthRes.status, 401);

    // Authenticate 2FA with valid TOTP
    const liveOtp = generateTotp(secret);
    const good2FaAuthRes = await fetch(`${SERVER_URL}/api/auth/2fa/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: liveOtp }),
    });
    assert.strictEqual(good2FaAuthRes.status, 200);
    const finalAuthData = await good2FaAuthRes.json();
    assert.ok(finalAuthData.token);
    assert.strictEqual(finalAuthData.user.username, testUsername);
    console.log('Login completed successfully via 2FA TOTP code!');

    // 4. Test Backup Recovery Code Login
    console.log('\n[4] Testing Login with Backup Recovery Code...');
    const challenge2Res = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: testPassword }),
    });
    const challenge2Data = await challenge2Res.json();
    const recoveryAuthRes = await fetch(`${SERVER_URL}/api/auth/2fa/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: challenge2Data.tempToken, code: recoveryCode1 }),
    });
    assert.strictEqual(recoveryAuthRes.status, 200);
    console.log('Login completed successfully via Emergency Recovery Code:', recoveryCode1);

    // Disable 2FA
    const disable2FaRes = await fetch(`${SERVER_URL}/api/auth/2fa/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finalAuthData.token}`,
      },
      body: JSON.stringify({ password: testPassword }),
    });
    if (disable2FaRes.status !== 200) {
      console.error('disable2Fa error payload:', await disable2FaRes.text());
    }
    assert.strictEqual(disable2FaRes.status, 200);
    console.log('2FA disabled successfully.');

    // 5. Test Voice Lounge / Walkie-Talkie Real-time Socket.io Signaling
    console.log('\n[5] Testing Voice Lounge / Walkie-Talkie Socket.io Signaling...');
    const adminSocket: Socket = ioClient(SERVER_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });
    const userSocket: Socket = ioClient(SERVER_URL, {
      auth: { token: userToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      let count = 0;
      const check = () => {
        count++;
        if (count === 2) resolve();
      };
      adminSocket.on('connect', check);
      userSocket.on('connect', check);
    });

    const testRoomId = 'room_global_broadcast';
    adminSocket.emit('chat:join_room', { roomId: testRoomId });
    userSocket.emit('chat:join_room', { roomId: testRoomId });
    await new Promise((r) => setTimeout(r, 150));

    // Admin joins voice lounge
    const voiceStatePromise = new Promise<any>((resolve) => {
      adminSocket.on('voice:state', (payload) => {
        resolve(payload);
      });
    });
    adminSocket.emit('voice:join', { roomId: testRoomId });
    const voiceState = await voiceStatePromise;
    assert.strictEqual(voiceState.roomId, testRoomId);
    assert.ok(voiceState.users.find((u: any) => u.userId === 'user_admin_root'));
    console.log('Admin joined voice lounge. Current users count:', voiceState.users.length);

    // User joins voice lounge -> Admin should receive voice:user_joined
    const userJoinedPromise = new Promise<any>((resolve) => {
      adminSocket.on('voice:user_joined', (payload) => {
        resolve(payload);
      });
    });
    userSocket.emit('voice:join', { roomId: testRoomId });
    const joinedPayload = await userJoinedPromise;
    assert.strictEqual(joinedPayload.roomId, testRoomId);
    assert.strictEqual(joinedPayload.user.username, testUsername);
    console.log('Admin received notification of user joining voice lounge:', joinedPayload.user.userName);

    // Speaking signal
    const speakingPromise = new Promise<any>((resolve) => {
      adminSocket.on('voice:user_speaking', (payload) => {
        resolve(payload);
      });
    });
    userSocket.emit('voice:speaking', { roomId: testRoomId, isSpeaking: true });
    const speakingPayload = await speakingPromise;
    assert.strictEqual(speakingPayload.isSpeaking, true);
    console.log('Voice Activity Detection (VAD) signal received in real-time!');

    // Clean up
    adminSocket.disconnect();
    userSocket.disconnect();

    console.log('\n=== ALL PHASE 14 TESTS PASSED PERFECTLY (100%)! ===');
  } finally {
    server.close();
  }
}

runPhase14Tests().catch((err) => {
  console.error('Phase 14 test failed:', err);
  process.exit(1);
});
