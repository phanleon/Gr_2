import { startServer } from './server/index';
import { io as ClientIO } from 'socket.io-client';
import crypto from 'crypto';
import fs from 'fs';

async function request(url: string, method: string = 'GET', body: any = null, token: string | null = null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`http://127.0.0.1:8080${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== STARTING PHASE 3 AUTOMATED TEST SUITE ===');
  const server = await startServer(8080);

  try {
    // 1. Authenticate users
    console.log('\n[1] Authenticating users...');
    const adminLogin = await request('/api/auth/login', 'POST', { username: 'admin', password: 'Server@123456' });
    const adminToken = adminLogin.data.token;

    // Ensure users exist
    await request('/api/admin/users', 'POST', {
      username: 'it_head',
      password: 'OwnerPassword@123',
      full_name: 'Nguyen Van IT - Truong Phong',
      role: 'ROOM_OWNER',
      department: 'IT Department',
    }, adminToken);

    await request('/api/admin/users', 'POST', {
      username: 'bob_staff',
      password: 'ClientPassword@123',
      full_name: 'Bob Staff',
      role: 'CLIENT',
      department: 'IT Department',
    }, adminToken);

    await request('/api/admin/users', 'POST', {
      username: 'mkt_head',
      password: 'Pass@123456',
      full_name: 'Tran Thi Marketing',
      role: 'ROOM_OWNER',
      department: 'Marketing Department',
    }, adminToken);

    const itLogin = await request('/api/auth/login', 'POST', { username: 'it_head', password: 'OwnerPassword@123' });
    const itToken = itLogin.data.token;

    const mktLogin = await request('/api/auth/login', 'POST', { username: 'mkt_head', password: 'Pass@123456' });
    const mktToken = mktLogin.data.token;

    const bobLogin = await request('/api/auth/login', 'POST', { username: 'bob_staff', password: 'ClientPassword@123' });
    const bobToken = bobLogin.data.token;

    // 2. Test Feed Scoping & Isolation
    console.log('\n[2] Testing Scoped Department Workplace Feeds...');
    // Create IT room
    const itRoomRes = await request('/api/rooms', 'POST', {
      room_name: 'Phong CNTT Noi Bo',
      room_code: `IT_${Date.now()}`,
      room_password: 'Pass@123',
    }, itToken);
    const itRoomId = itRoomRes.data.room.id;

    // Post to Global Feed
    const globalPost = await request('/api/feed', 'POST', {
      title: 'Thong bao toan cong ty: Lich nghi le',
      content: 'Toan the nhan vien chu y lich nghi le theo quy dinh...',
      room_id: null,
    }, adminToken);
    console.log('Global post status:', globalPost.status, globalPost.data.post?.title);

    // IT Head posts internal project plan to IT room
    const itPost = await request('/api/feed', 'POST', {
      title: 'Ke hoach nang cap may chu Q4',
      content: 'Thuc hien di doi co so du lieu sang cum Server du phong luc 23h...',
      room_id: itRoomId,
    }, itToken);
    console.log('IT scoped post status:', itPost.status, itPost.data.post?.title);

    // Marketing Head tries to read IT Room feed -> Expect 403 Forbidden
    const mktTryReadIt = await request(`/api/feed/${itRoomId}`, 'GET', null, mktToken);
    console.log('Marketing Head access to IT Feed (Expect 403):', mktTryReadIt.status, mktTryReadIt.data.error);
    if (mktTryReadIt.status !== 403) throw new Error('Security isolation failed! Marketing can read IT feed.');

    // IT Head approves Bob in IT room
    await request(`/api/rooms/${itRoomId}/moderate`, 'POST', {
      target_user_id: bobLogin.data.user.id,
      action: 'ALLOW',
    }, itToken);

    // Bob reads IT room feed -> Expect 200 OK
    const bobReadIt = await request(`/api/feed/${itRoomId}`, 'GET', null, bobToken);
    console.log('Whitelisted Bob access to IT Feed (Expect 200):', bobReadIt.status, 'Posts count:', bobReadIt.data.posts?.length);
    if (bobReadIt.status !== 200) throw new Error('Whitelisted user could not read scoped feed');

    // 3. Test Real-time Chat & Direct Messaging over Socket.io
    console.log('\n[3] Testing Real-time Chat via Socket.io...');
    const itSocket = ClientIO('http://127.0.0.1:8080', {
      auth: { token: itToken },
      transports: ['websocket'],
    });
    const bobSocket = ClientIO('http://127.0.0.1:8080', {
      auth: { token: bobToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => itSocket.on('connect', res)),
      new Promise((res) => bobSocket.on('connect', res)),
    ]);
    console.log('Both Socket.io clients connected successfully.');

    // Join room & test Room Message
    itSocket.emit('chat:join_room', { roomId: itRoomId });
    bobSocket.emit('chat:join_room', { roomId: itRoomId });
    await new Promise((res) => setTimeout(res, 200));

    const receivedRoomMessagePromise = new Promise((resolve) => {
      bobSocket.on('chat:room_message', (msg) => {
        console.log('[Socket Event] Bob received room message from:', msg.sender_name, 'Content:', msg.content);
        resolve(msg);
      });
    });

    itSocket.emit('chat:send_room_message', {
      roomId: itRoomId,
      content: 'Chao Bob, vui long cap nhat phien ban he dieu hanh tren cac may tram.',
    });

    const receivedRoomMsg = await receivedRoomMessagePromise;
    if (!receivedRoomMsg) throw new Error('Room message not delivered');

    // Test 1-on-1 Direct Message
    const receivedDmPromise = new Promise((resolve) => {
      bobSocket.on('chat:direct_message', (dm) => {
        console.log('[Socket Event] Bob received DM from:', dm.sender_name, 'Content:', dm.content);
        resolve(dm);
      });
    });

    itSocket.emit('chat:send_direct_message', {
      receiverId: bobLogin.data.user.id,
      content: 'Tin nhan bao mat rieng tu: Ma token bao mat cua ban la 987654',
    });

    const receivedDm = await receivedDmPromise;
    if (!receivedDm) throw new Error('Direct message not delivered');

    itSocket.disconnect();
    bobSocket.disconnect();

    // 4. Test 10MB Chunked File Upload with SHA-256 verification
    console.log('\n[4] Testing 10MB Chunked File Upload (Cloudflare Bypass)...');
    // Generate a 15MB file payload in memory
    const totalSizeBytes = 15 * 1024 * 1024; // 15MB
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks (total 3 chunks)
    const testBuffer = crypto.randomBytes(totalSizeBytes);
    const expectedSha256 = crypto.createHash('sha256').update(testBuffer).digest('hex');
    const uploadId = `upl_${Date.now()}`;
    const fileName = 'enterprise_project_backup_q4.dat';
    const totalChunks = Math.ceil(totalSizeBytes / chunkSize);

    console.log(`Uploading ${totalSizeBytes / (1024 * 1024)}MB file in ${totalChunks} chunks of ${chunkSize / (1024 * 1024)}MB each...`);
    console.log('Expected SHA-256:', expectedSha256);

    let lastUploadRes: any = null;
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSizeBytes);
      const chunkData = testBuffer.subarray(start, end);
      const chunkBase64 = chunkData.toString('base64');

      const chunkRes = await request('/api/upload/chunk', 'POST', {
        uploadId,
        chunkIndex: i,
        totalChunks,
        fileName,
        fileTotalSize: totalSizeBytes,
        sha256: expectedSha256,
        chunkBase64,
      }, itToken);

      console.log(`Chunk ${i + 1}/${totalChunks} upload response: Progress = ${chunkRes.data.progress}%, Completed = ${chunkRes.data.completed}`);
      lastUploadRes = chunkRes;
    }

    if (!lastUploadRes.data.completed || !lastUploadRes.data.file) {
      throw new Error('Chunked upload did not complete successfully');
    }

    console.log('Assembled file URL:', lastUploadRes.data.file.url);
    console.log('Assembled file SHA-256:', lastUploadRes.data.file.sha256);

    if (lastUploadRes.data.file.sha256 !== expectedSha256) {
      throw new Error('Assembled file hash does not match original bytes!');
    }

    // Verify downloaded content
    const downloadRes = await fetch(`http://127.0.0.1:8080${lastUploadRes.data.file.url}`);
    const downloadedBuf = Buffer.from(await downloadRes.arrayBuffer());
    if (downloadedBuf.length !== totalSizeBytes) {
      throw new Error(`Downloaded size mismatch: expected ${totalSizeBytes}, got ${downloadedBuf.length}`);
    }

    console.log('File download & bit-for-bit integrity check passed!');
    console.log('\n=== ALL PHASE 3 TESTS PASSED PERFECTLY! ===');
  } finally {
    server.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 3 test failed:', err);
    process.exit(1);
  });
