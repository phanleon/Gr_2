import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.getPath === 'function') {
      const userDataDir = app.getPath('userData');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      return path.join(userDataDir, 'workspace.db');
    }
  } catch (e) {
    // Non-electron environment (tests, standalone node server)
  }
  return path.resolve(process.cwd(), 'workspace.db');
}

function getSchemaPath(): string {
  const candidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../server/db/schema.sql'),
    path.resolve(process.cwd(), 'server/db/schema.sql'),
    path.resolve(process.cwd(), 'dist-electron/server/db/schema.sql'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

let _rawDb: Database.Database | null = null;

function ensureDb(): Database.Database {
  if (!_rawDb) {
    const dbPath = getDbPath();
    try {
      _rawDb = new Database(dbPath);
      _rawDb.pragma('journal_mode = WAL');
      _rawDb.pragma('foreign_keys = ON');
    } catch (err: any) {
      console.error(`[Database] Failed to open SQLite at ${dbPath}:`, err);
      const fallbackPath = path.resolve(process.cwd(), 'workspace.db');
      if (dbPath !== fallbackPath) {
        console.warn(`[Database] Retrying with fallback path: ${fallbackPath}`);
        _rawDb = new Database(fallbackPath);
        _rawDb.pragma('journal_mode = WAL');
        _rawDb.pragma('foreign_keys = ON');
      } else {
        throw err;
      }
    }
  }
  return _rawDb;
}

export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const instance = ensureDb();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(_target, prop, value) {
    const instance = ensureDb();
    (instance as any)[prop] = value;
    return true;
  }
});

export function closeDatabase() {
  if (_rawDb && _rawDb.open) {
    _rawDb.close();
    _rawDb = null;
  }
}

export function reloadDatabase() {
  closeDatabase();
  ensureDb();
}

// Initialize schema and seed default data
export function initDatabase() {
  const instance = ensureDb();
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  // Read and run schema.sql
  const schemaPath = getSchemaPath();
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  instance.exec(schemaSql);

  // Safe migrations for 2FA
  try {
    instance.prepare('ALTER TABLE users ADD COLUMN two_factor_secret TEXT').run();
  } catch (e) {}
  try {
    instance.prepare('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0').run();
  } catch (e) {}
  try {
    instance.prepare("ALTER TABLE users ADD COLUMN two_factor_recovery_codes TEXT DEFAULT '[]'").run();
  } catch (e) {}
  try {
    instance.prepare('ALTER TABLE users ADD COLUMN provisioned_password TEXT').run();
  } catch (e) {}
  try {
    instance.prepare('ALTER TABLE users ADD COLUMN ultra_id TEXT').run();
  } catch (e) {}
  try {
    instance.prepare('ALTER TABLE users ADD COLUMN ultra_pass TEXT').run();
  } catch (e) {}

  // Seed default SERVER_ADMIN if not present
  const adminUser = instance.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
  let adminId = 'user_admin_root';
  if (!adminUser) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Server@123456', salt);
    instance.prepare(`
      INSERT INTO users (id, username, password_hash, full_name, role, department, is_active, provisioned_password, ultra_id, ultra_pass)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'Server@123456', '10 000 001', '1234')
    `).run(adminId, 'admin', hash, 'Root Server Administrator', 'SERVER_ADMIN', 'Executive Board');
    
    // Log creation
    addAuditLog(
      adminId,
      'admin',
      'SERVER_ADMIN',
      'SYSTEM_INIT',
      JSON.stringify({ message: 'Default SERVER_ADMIN provisioned' }),
      '127.0.0.1',
      'LOW'
    );
  } else {
    adminId = adminUser.id;
    if (!adminUser.ultra_id || !adminUser.ultra_pass) {
      instance.prepare("UPDATE users SET ultra_id = '10 000 001', ultra_pass = '1234' WHERE id = ?").run(adminId);
    }
  }

  // Seed default demonstration staff & room owner accounts
  const defaultStaffAccounts = [
    {
      id: 'user_it_head',
      username: 'it_head',
      password: 'Owner@123456',
      full_name: 'Nguyễn Văn IT - Trưởng Phòng Kỹ Thuật',
      role: 'ROOM_OWNER',
      department: 'Phòng Kỹ Thuật & Hệ Thống',
      ultra_id: '20 000 002',
      ultra_pass: '5678',
    },
    {
      id: 'user_staff_bob',
      username: 'staff_bob',
      password: 'Staff@123456',
      full_name: 'Bob Staff - Chuyên Viên Kỹ Thuật',
      role: 'CLIENT',
      department: 'Phòng Kỹ Thuật',
      ultra_id: '30 000 003',
      ultra_pass: '8888',
    },
    {
      id: 'user_staff_alice',
      username: 'staff_alice',
      password: 'Staff@123456',
      full_name: 'Alice Staff - Chuyên Viên Kinh Doanh',
      role: 'CLIENT',
      department: 'Phòng Kinh Doanh',
      ultra_id: '40 000 004',
      ultra_pass: '9999',
    },
  ];

  for (const staff of defaultStaffAccounts) {
    const existing = instance.prepare('SELECT * FROM users WHERE username = ?').get(staff.username) as any;
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(staff.password, salt);
      instance.prepare(`
        INSERT INTO users (id, username, password_hash, full_name, role, department, is_active, provisioned_password, ultra_id, ultra_pass)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(staff.id, staff.username, hash, staff.full_name, staff.role, staff.department, staff.password, staff.ultra_id, staff.ultra_pass);
      console.log(`[Database] Seeded demo user: ${staff.username} (${staff.role})`);
    } else {
      // Guarantee the demo credentials & Ultra credentials are valid
      const isMatch = bcrypt.compareSync(staff.password, existing.password_hash);
      if (!isMatch || existing.is_active === 0 || !existing.provisioned_password || !existing.ultra_id || !existing.ultra_pass) {
        const hash = bcrypt.hashSync(staff.password, 10);
        instance.prepare('UPDATE users SET password_hash = ?, provisioned_password = ?, ultra_id = ?, ultra_pass = ?, is_active = 1 WHERE id = ?')
          .run(hash, staff.password, staff.ultra_id, staff.ultra_pass, existing.id);
        console.log(`[Database] Refreshed credentials for demo user: ${staff.username}`);
      }
    }
  }

  // Ensure all existing accounts have ultra_id and ultra_pass
  try {
    const unseededUsers = instance.prepare("SELECT id, username FROM users WHERE ultra_id IS NULL OR ultra_pass IS NULL").all() as any[];
    let seedIndex = 50000000;
    for (const u of unseededUsers) {
      seedIndex += 1;
      const s = seedIndex.toString();
      const formattedUltraId = `${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5)}`;
      const randomPass = Math.floor(1000 + Math.random() * 9000).toString();
      instance.prepare('UPDATE users SET ultra_id = ?, ultra_pass = ? WHERE id = ?').run(formattedUltraId, randomPass, u.id);
    }
  } catch (e) {}

  // Seed default Global Broadcast room if not present
  const globalRoom = db.prepare('SELECT * FROM rooms WHERE is_global = 1').get() as any;
  if (!globalRoom) {
    const globalRoomId = 'room_global_broadcast';
    const roomPasswordHash = bcrypt.hashSync('Global@123', 10);
    db.prepare(`
      INSERT INTO rooms (id, room_code, room_name, room_password_hash, owner_id, is_global)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(globalRoomId, 'GLOBAL', 'Kênh Truyền Chung Toàn Công Ty', roomPasswordHash, adminId);

    // Give admin ALLOWED permission
    db.prepare(`
      INSERT OR REPLACE INTO room_permissions (room_id, user_id, status, is_muted, can_ssh, granted_by)
      VALUES (?, ?, 'ALLOWED', 0, 1, ?)
    `).run(globalRoomId, adminId, adminId);

    // Initial broadcast post
    db.prepare(`
      INSERT INTO feed_posts (id, room_id, author_id, title, content, media_files, ai_summary)
      VALUES (?, NULL, ?, ?, ?, '[]', ?)
    `).run(
      'post_welcome_global',
      adminId,
      'Chào mừng tới Không Gian Làm Việc Số Bảo Mật Zero-Trust',
      'Hệ thống kết nối từ xa đa mạng và không gian làm việc an toàn đã được kích hoạt thành công. Mọi kênh truyền thông nội bộ, bảng tin phòng ban và phiên điều khiển đều được mã hóa và kiểm toán chặt chẽ.',
      'Khởi tạo thành công hệ thống Zero-Trust Workspace bảo mật toàn diện.'
    );
  }

  // Ensure staff accounts have ALLOWED permission in Global room
  for (const staffId of ['user_it_head', 'user_staff_bob', 'user_staff_alice']) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO room_permissions (room_id, user_id, status, is_muted, can_ssh, granted_by)
        VALUES ('room_global_broadcast', ?, 'ALLOWED', 0, 1, ?)
      `).run(staffId, adminId);
    } catch (e) {}
  }

  // Seed default Enterprise Events if not present
  try {
    const eventCount = (db.prepare('SELECT COUNT(*) as count FROM events').get() as any)?.count || 0;
    if (eventCount === 0) {
      const now = new Date();
      const futureDate1 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const futureDate2 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO events (id, title, description, event_date, location_room_id, creator_id, category, is_important)
        VALUES (?, ?, ?, ?, NULL, ?, 'CELEBRATION', 1)
      `).run(
        'event_q4_kickoff',
        '🎉 Hội Nghị Triển Khai Kế Hoạch Q4 & Tổng Kết Năm 2026',
        'Họp toàn thể thành viên công ty triển khai kế hoạch mục tiêu chuyển đổi số, an ninh mạng và chính sách khen thưởng xuất sắc.',
        futureDate1,
        adminId
      );

      db.prepare(`
        INSERT INTO events (id, title, description, event_date, location_room_id, creator_id, category, is_important)
        VALUES (?, ?, ?, ?, NULL, ?, 'MEETING', 1)
      `).run(
        'event_tech_review',
        '🛡️ Đánh Giá An Ninh & Diễn Tập Tường Lửa Zero-Trust',
        'Diễn tập cô lập tấn công, kiểm tra tường lửa SSH Terminal và kiểm thử năng lực chịu tải đường truyền.',
        futureDate2,
        adminId
      );

      // Seed a welcome notification for admin
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link_view, is_read)
        VALUES (?, ?, ?, ?, 'SYSTEM', 'feed', 0)
      `).run(
        'notif_admin_welcome',
        adminId,
        'Chào mừng đến với Secure Remote Workspace!',
        'Hệ thống đã nâng cấp kiến trúc Lịch sự kiện doanh nghiệp và Chuông thông báo thời gian thực.'
      );
    }

    // Seed default tasks if empty
    const taskCount = (db.prepare('SELECT COUNT(*) as count FROM project_tasks').get() as any)?.count || 0;
    if (taskCount === 0) {
      db.prepare(`
        INSERT INTO project_tasks (id, room_id, creator_id, assignee_id, title, description, priority, status, due_date)
        VALUES (?, NULL, ?, ?, ?, ?, 'HIGH', 'IN_PROGRESS', ?)
      `).run(
        'task_q4_audit',
        adminId,
        adminId,
        '🛡️ Kiểm thử thâm nhập & Diễn tập bảo mật Zero-Trust',
        'Tiến hành rà soát các câu lệnh SSH nguy hiểm và xác minh cơ chế Khóa Kép theo đúng chuẩn an ninh.',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );

      db.prepare(`
        INSERT INTO project_tasks (id, room_id, creator_id, assignee_id, title, description, priority, status, due_date)
        VALUES (?, NULL, ?, ?, ?, ?, 'MEDIUM', 'TODO', ?)
      `).run(
        'task_q4_backup',
        adminId,
        adminId,
        '📦 Hoàn tất sao lưu toàn bộ cơ sở dữ liệu và mã nguồn',
        'Thiết lập định kỳ sao lưu snapshot và kiểm tra độ toàn vẹn bit-for-bit SHA-256.',
        new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      );
    }

    // Seed default Shared Vault Item if empty
    const vaultCount = (db.prepare('SELECT COUNT(*) as count FROM shared_vault_items').get() as any)?.count || 0;
    if (vaultCount === 0) {
      db.prepare(`
        INSERT INTO shared_vault_items (id, room_id, creator_id, title, category, username_or_key, secret_value, description)
        VALUES (?, NULL, ?, ?, 'SERVER_ACCESS', ?, ?, ?)
      `).run(
        'vault_root_vpn',
        adminId,
        '🔑 Zero-Trust Gateway Root Token',
        'gateway_admin',
        'ZTRUST_SEC_TOKEN_8921#X99@ALPHA',
        'Mã truy cập cổng Zero-Trust Gateway nội bộ dành cho đội ngũ vận hành hệ thống.'
      );
    }

    // Seed default IT Assets if empty
    const assetCount = (db.prepare('SELECT COUNT(*) as count FROM it_assets').get() as any)?.count || 0;
    if (assetCount === 0) {
      db.prepare(`
        INSERT INTO it_assets (id, asset_tag, asset_name, category, serial_number, assigned_to_user_id, status, purchase_date, specs_info, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'ast_mbp_001',
        'AST-2026-001',
        'MacBook Pro 16" M3 Max',
        'LAPTOP',
        'C02G9988XKLM',
        adminId,
        'IN_USE',
        '2026-01-15',
        'Apple M3 Max 16-Core, 64GB Unified RAM, 1TB SSD',
        'Thiết bị máy trạm xách tay cấp phát cho Quản trị viên hệ thống.'
      );

      db.prepare(`
        INSERT INTO it_assets (id, asset_tag, asset_name, category, serial_number, assigned_to_user_id, status, purchase_date, specs_info, notes)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `).run(
        'ast_mon_002',
        'AST-2026-002',
        'Dell UltraSharp 32" 4K USB-C Hub Monitor (U3223QE)',
        'MONITOR',
        'CN-0M389L-74445',
        'AVAILABLE',
        '2026-03-20',
        '31.5 inch, 4K IPS Black, 98% DCI-P3, USB-C 90W PD',
        'Màn hình dự phòng trong kho thiết bị CNTT, sẵn sàng cấp phát khi có đề xuất.'
      );
    }

    // Seed default Software Licenses if empty
    const licenseCount = (db.prepare('SELECT COUNT(*) as count FROM software_licenses').get() as any)?.count || 0;
    if (licenseCount === 0) {
      db.prepare(`
        INSERT INTO software_licenses (id, software_name, license_type, license_key, total_seats, assigned_seats, expiry_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'lic_jetbrains_all',
        'JetBrains All Products Pack Commercial',
        'SITE_LICENSE',
        'JB-CORP-98821-XKLMN-8921-VIP',
        20,
        5,
        '2027-12-31',
        'Bản quyền phần mềm lập trình trọn gói cho toàn bộ lập trình viên công ty.'
      );
    }

    // Seed default Wiki Articles if empty
    const wikiCount = (db.prepare('SELECT COUNT(*) as count FROM wiki_articles').get() as any)?.count || 0;
    if (wikiCount === 0) {
      db.prepare(`
        INSERT INTO wiki_articles (id, category, title, content, author_id, is_pinned, view_count)
        VALUES (?, ?, ?, ?, ?, 1, 12)
      `).run(
        'wiki_onboarding_guide',
        'ONBOARDING',
        '🚀 Cẩm Nang Nhập Môn & Hướng Dẫn Nhân Sự Mới (Onboarding Guide)',
        `# CHÀO MỪNG ĐẾN VỚI DOANH NGHIỆP!

Chào mừng bạn đã gia nhập đội ngũ làm việc của chúng tôi. Tài liệu này cung cấp các bước thiết lập môi trường và quy định an toàn để bạn bắt đầu công việc thuận lợi.

---

### 1. Thiết Lập Môi Trường Làm Việc Số
- **Ứng dụng làm việc:** Khởi chạy **Secure Remote Workspace** trên máy tính hoặc truy cập link Cloudflare nội bộ qua trình duyệt.
- **Tài khoản:** Đăng nhập bằng tên tài khoản và mật khẩu được Ban Quản Trị cấp phát.
- **Bảo mật Khóa Kép:** Khi vào phòng ban chuyên môn, hãy nhập mật khẩu phòng được Trưởng phòng cung cấp.

---

### 2. Quy Định Điểm Danh & Chấm Công
- Thực hiện **Điểm danh (Check-in)** vào đầu ca làm việc buổi sáng tại mục **Điểm Danh Chấm Công**.
- Cuối ngày trước khi nghỉ làm, thực hiện **Check-out** để hệ thống ghi nhận chính xác thời lượng lao động.

---

### 3. Đề Xuất Cấp Phát Thiết Bị
- Nếu cần cấp máy tính, màn hình rời, hoặc tài khoản truy cập server, hãy vào mục **Trình Ký & Đề Xuất** để gửi phiếu cho Ban Lãnh Đạo phê duyệt.
`,
        adminId
      );

      db.prepare(`
        INSERT INTO wiki_articles (id, category, title, content, author_id, is_pinned, view_count)
        VALUES (?, ?, ?, ?, ?, 1, 8)
      `).run(
        'wiki_security_policy',
        'SECURITY',
        '🛡️ Quy Định An Toàn Thông Tin & Bảo Mật Zero-Trust',
        `# QUY ĐỊNH AN TOÀN THÔNG TIN NỘI BỘ

Toàn thể nhân sự phải tuân thủ nghiêm ngặt chính sách bảo mật Zero-Trust nhằm ngăn chặn thất thoát dữ liệu.

---

### 1. Nguyên Tắc "Không Tin Tưởng Bất Kỳ Ai" (Never Trust, Always Verify)
- Mọi kết nối từ xa đều được xác thực danh tính qua mã JWT và phân quyền RBAC.
- Không chia sẻ mật khẩu tài khoản cá nhân, mã token bảo mật hay mật khẩu phòng ban cho người ngoài.

---

### 2. Kiểm Soát Lệnh SSH & Thao Tác Từ Xa
- Tường lửa AI tự động phát hiện và chặn các câu lệnh nguy hiểm (như \`rm -rf /\`, \`chmod 777\`, quét cổng trái phép).
- Mọi câu lệnh và thao tác điều khiển màn hình đều được lưu vào **Nhật ký kiểm toán bất biến (Audit Logs)**.

---

### 3. Bảo Vệ Két Mật Khẩu (Vault)
- Chỉ xem mật khẩu máy chủ khi cần thiết cho công việc.
- Tuyệt đối không sao chép mật khẩu ra các kênh mạng xã hội công cộng bên ngoài.
`,
        adminId
      );
    }
  } catch (err) {
    console.error('[Database] Failed to seed events/notifications/vault/assets/wiki:', err);
  }

  console.log(`[Database] SQLite initialized successfully at ${getDbPath()} with WAL mode.`);
}

// DAO Helpers
export function addAuditLog(
  actorId: string | null,
  actorUsername: string | null,
  actorRole: string | null,
  actionType: string,
  targetDetails: string,
  ipAddress: string | null = '127.0.0.1',
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (actor_id, actor_username, actor_role, action_type, target_details, ip_address, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(actorId, actorUsername, actorRole, actionType, targetDetails, ipAddress, riskLevel);
}

export function addSshCommandLog(
  sessionId: string,
  operatorId: string,
  targetClientId: string,
  roomId: string | null,
  commandText: string,
  wasBlocked: number = 0,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
) {
  const stmt = db.prepare(`
    INSERT INTO ssh_command_logs (session_id, operator_id, target_client_id, room_id, command_text, was_blocked, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(sessionId, operatorId, targetClientId, roomId, commandText, wasBlocked, riskLevel);
}

export function getUserById(id: string) {
  return db.prepare('SELECT id, username, full_name, role, department, is_active, created_at FROM users WHERE id = ?').get(id) as any;
}

export function getUserWithPassword(id: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
}

export function getUserByUsername(username: string) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
}

export function getAllUsers() {
  return db.prepare('SELECT id, username, full_name, role, department, is_active, provisioned_password, ultra_id, ultra_pass, created_at FROM users ORDER BY created_at DESC').all() as any[];
}

export function getRooms() {
  return db.prepare(`
    SELECT r.*, u.full_name as owner_name, u.username as owner_username,
      (SELECT COUNT(*) FROM room_permissions rp WHERE rp.room_id = r.id AND rp.status = 'ALLOWED') as member_count
    FROM rooms r
    JOIN users u ON r.owner_id = u.id
    ORDER BY r.is_global DESC, r.created_at ASC
  `).all() as any[];
}

export function getRoomById(id: string) {
  return db.prepare(`
    SELECT r.*, u.full_name as owner_name 
    FROM rooms r 
    JOIN users u ON r.owner_id = u.id 
    WHERE r.id = ?
  `).get(id) as any;
}

export function getRoomPermissions(roomId: string) {
  return db.prepare(`
    SELECT rp.*, u.username, u.full_name, u.role, u.department
    FROM room_permissions rp
    JOIN users u ON rp.user_id = u.id
    WHERE rp.room_id = ?
  `).all(roomId) as any[];
}

export function getUserRoomPermission(roomId: string, userId: string) {
  return db.prepare(`
    SELECT * FROM room_permissions
    WHERE room_id = ? AND user_id = ?
  `).get(roomId, userId) as any;
}

export function getAuditLogs(limit: number = 100, offset: number = 0) {
  return db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];
}

export function getSshCommandLogs(limit: number = 100, offset: number = 0) {
  return db.prepare(`
    SELECT l.*, op.full_name as operator_name, op.username as operator_username,
           cl.full_name as target_client_name, cl.username as target_client_username
    FROM ssh_command_logs l
    JOIN users op ON l.operator_id = op.id
    JOIN users cl ON l.target_client_id = cl.id
    ORDER BY l.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];
}

export function getFeedPosts(roomId: string | null = null) {
  if (roomId) {
    return db.prepare(`
      SELECT p.*, u.full_name as author_name, u.role as author_role
      FROM feed_posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.room_id = ?
      ORDER BY p.created_at DESC
    `).all(roomId) as any[];
  } else {
    // Global Channel
    return db.prepare(`
      SELECT p.*, u.full_name as author_name, u.role as author_role
      FROM feed_posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.room_id IS NULL
      ORDER BY p.created_at DESC
    `).all() as any[];
  }
}

export function getMessages(roomId: string | null, userA?: string, userB?: string) {
  if (roomId) {
    return db.prepare(`
      SELECT m.*, u.full_name as sender_name, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
    `).all(roomId) as any[];
  } else if (userA && userB) {
    return db.prepare(`
      SELECT m.*, u.full_name as sender_name, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id IS NULL AND (
        (m.sender_id = ? AND m.receiver_id = ?) OR
        (m.sender_id = ? AND m.receiver_id = ?)
      )
      ORDER BY m.created_at ASC
    `).all(userA, userB, userB, userA) as any[];
  }
  return [];
}

// 8. Event Management DAO
export function getAllEvents() {
  return db.prepare(`
    SELECT e.*, u.full_name as creator_name, r.room_name as location_name
    FROM events e
    JOIN users u ON e.creator_id = u.id
    LEFT JOIN rooms r ON e.location_room_id = r.id
    ORDER BY e.event_date ASC
  `).all() as any[];
}

export function createEvent(
  id: string,
  title: string,
  description: string,
  eventDate: string,
  locationRoomId: string | null,
  creatorId: string,
  category: 'EVENT' | 'MEETING' | 'DEADLINE' | 'CELEBRATION' = 'EVENT',
  isImportant: number = 1
) {
  return db.prepare(`
    INSERT INTO events (id, title, description, event_date, location_room_id, creator_id, category, is_important)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description, eventDate, locationRoomId, creatorId, category, isImportant);
}

export function deleteEvent(id: string) {
  return db.prepare('DELETE FROM events WHERE id = ?').run(id);
}

// 9. Notification DAO
export function getUserNotifications(userId: string) {
  return db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId) as any[];
}

export function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'INFO' | 'EVENT' | 'POST' | 'CHAT' | 'SECURITY' | 'SYSTEM' = 'INFO',
  linkView: string = 'feed',
  linkId: string | null = null
) {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, link_view, link_id, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(notifId, userId, title, message, type, linkView, linkId);
  return notifId;
}

export function markNotificationRead(id: string, userId: string) {
  return db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
}

export function markAllNotificationsRead(userId: string) {
  return db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
}

export function broadcastNotification(
  title: string,
  message: string,
  type: 'INFO' | 'EVENT' | 'POST' | 'CHAT' | 'SECURITY' | 'SYSTEM' = 'INFO',
  linkView: string = 'feed',
  linkId: string | null = null
) {
  const users = getAllUsers();
  const insertStmt = db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, link_view, link_id, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const createdIds: string[] = [];
  const transaction = db.transaction(() => {
    for (const u of users) {
      if (u.is_active === 1) {
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        insertStmt.run(notifId, u.id, title, message, type, linkView, linkId);
        createdIds.push(notifId);
      }
    }
  });
  transaction();
  return createdIds;
}

// 10. Interactive Polls DAO
export function createPostPoll(id: string, postId: string, question: string, options: string[]) {
  return db.prepare(`
    INSERT INTO post_polls (id, post_id, question, options)
    VALUES (?, ?, ?, ?)
  `).run(id, postId, question, JSON.stringify(options));
}

export function getPollByPostId(postId: string, currentUserId?: string) {
  const poll = db.prepare('SELECT * FROM post_polls WHERE post_id = ?').get(postId) as any;
  if (!poll) return null;

  const options = JSON.parse(poll.options || '[]');
  const votes = db.prepare('SELECT option_index, user_id FROM poll_votes WHERE poll_id = ?').all(poll.id) as any[];

  const votesCount = options.map((_: any, idx: number) => {
    return votes.filter((v) => v.option_index === idx).length;
  });

  const userVote = currentUserId ? votes.find((v) => v.user_id === currentUserId) : null;

  return {
    id: poll.id,
    post_id: poll.post_id,
    question: poll.question,
    options,
    votesCount,
    totalVotes: votes.length,
    hasVoted: !!userVote,
    userVotedIndex: userVote ? userVote.option_index : null,
  };
}

export function votePoll(pollId: string, userId: string, optionIndex: number) {
  return db.prepare(`
    INSERT OR REPLACE INTO poll_votes (poll_id, user_id, option_index)
    VALUES (?, ?, ?)
  `).run(pollId, userId, optionIndex);
}

// 11. Workspace File Drive DAO
export function getAllWorkspaceFiles() {
  const files: any[] = [];

  // Files from Messages
  const msgFiles = db.prepare(`
    SELECT m.id, m.created_at, m.file_metadata, u.full_name as sender_name, u.username as sender_username, r.room_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    LEFT JOIN rooms r ON m.room_id = r.id
    WHERE m.file_metadata IS NOT NULL
    ORDER BY m.created_at DESC
  `).all() as any[];

  for (const m of msgFiles) {
    try {
      const meta = JSON.parse(m.file_metadata);
      if (meta && meta.name) {
        files.push({
          id: `msg_file_${m.id}`,
          name: meta.name,
          size: meta.size || 0,
          url: meta.url || meta.path,
          sha256: meta.sha256 || 'N/A',
          source: 'Tin nhắn ' + (m.room_name ? `[${m.room_name}]` : '[Trực tiếp 1-1]'),
          uploader: m.sender_name,
          created_at: m.created_at,
        });
      }
    } catch (_) {}
  }

  // Files from Feed Posts
  const postFiles = db.prepare(`
    SELECT p.id, p.created_at, p.media_files, p.title, u.full_name as author_name, r.room_name
    FROM feed_posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN rooms r ON p.room_id = r.id
    WHERE p.media_files IS NOT NULL AND p.media_files != '[]'
    ORDER BY p.created_at DESC
  `).all() as any[];

  for (const p of postFiles) {
    try {
      const mediaList = JSON.parse(p.media_files);
      if (Array.isArray(mediaList)) {
        for (const item of mediaList) {
          const name = typeof item === 'string' ? item.split('/').pop() || item : item.name;
          const url = typeof item === 'string' ? item : item.url;
          files.push({
            id: `post_file_${p.id}_${Math.random().toString(36).substring(2, 6)}`,
            name,
            size: item.size || 1024 * 1024,
            url,
            sha256: item.sha256 || 'VERIFIED_OK',
            source: `Bảng tin: ${p.title}`,
            uploader: p.author_name,
            created_at: p.created_at,
          });
        }
      }
    } catch (_) {}
  }

  return files;
}

// 12. Internal E-Approval & Proposal Workflows DAO
export function getApprovals(userId: string, role: string, roomId?: string | null) {
  if (role === 'SERVER_ADMIN') {
    return db.prepare(`
      SELECT a.*, req.full_name as requester_name, req.username as requester_username,
             appr.full_name as approver_name, r.room_name
      FROM approvals a
      JOIN users req ON a.requester_id = req.id
      LEFT JOIN users appr ON a.approver_id = appr.id
      LEFT JOIN rooms r ON a.room_id = r.id
      ORDER BY a.created_at DESC
    `).all() as any[];
  } else if (role === 'ROOM_OWNER') {
    return db.prepare(`
      SELECT a.*, req.full_name as requester_name, req.username as requester_username,
             appr.full_name as approver_name, r.room_name
      FROM approvals a
      JOIN users req ON a.requester_id = req.id
      LEFT JOIN users appr ON a.approver_id = appr.id
      LEFT JOIN rooms r ON a.room_id = r.id
      WHERE a.requester_id = ? OR a.room_id IN (SELECT id FROM rooms WHERE owner_id = ?)
      ORDER BY a.created_at DESC
    `).all(userId, userId) as any[];
  } else {
    // Regular CLIENT: only own proposals
    return db.prepare(`
      SELECT a.*, req.full_name as requester_name, req.username as requester_username,
             appr.full_name as approver_name, r.room_name
      FROM approvals a
      JOIN users req ON a.requester_id = req.id
      LEFT JOIN users appr ON a.approver_id = appr.id
      LEFT JOIN rooms r ON a.room_id = r.id
      WHERE a.requester_id = ?
      ORDER BY a.created_at DESC
    `).all(userId) as any[];
  }
}

export function getApprovalById(id: string) {
  return db.prepare(`
    SELECT a.*, req.full_name as requester_name, req.username as requester_username
    FROM approvals a
    JOIN users req ON a.requester_id = req.id
    WHERE a.id = ?
  `).get(id) as any;
}

export function createApproval(
  id: string,
  requesterId: string,
  roomId: string | null,
  title: string,
  category: string,
  content: string,
  priority: string = 'NORMAL'
) {
  return db.prepare(`
    INSERT INTO approvals (id, requester_id, approver_id, room_id, title, category, content, priority, status)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'PENDING')
  `).run(id, requesterId, roomId, title, category, content, priority);
}

export function decideApproval(
  id: string,
  approverId: string,
  status: 'APPROVED' | 'REJECTED',
  feedback: string = ''
) {
  return db.prepare(`
    UPDATE approvals
    SET approver_id = ?, status = ?, feedback = ?, decided_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(approverId, status, feedback, id);
}

// 13. Project Task Board & Kanban DAO
export function getProjectTasks(roomId?: string | null) {
  if (roomId) {
    return db.prepare(`
      SELECT t.*, cr.full_name as creator_name, asg.full_name as assignee_name, r.room_name
      FROM project_tasks t
      JOIN users cr ON t.creator_id = cr.id
      LEFT JOIN users asg ON t.assignee_id = asg.id
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.room_id = ?
      ORDER BY t.created_at DESC
    `).all(roomId) as any[];
  } else {
    return db.prepare(`
      SELECT t.*, cr.full_name as creator_name, asg.full_name as assignee_name, r.room_name
      FROM project_tasks t
      JOIN users cr ON t.creator_id = cr.id
      LEFT JOIN users asg ON t.assignee_id = asg.id
      LEFT JOIN rooms r ON t.room_id = r.id
      ORDER BY t.created_at DESC
    `).all() as any[];
  }
}

export function createProjectTask(
  id: string,
  roomId: string | null,
  creatorId: string,
  assigneeId: string | null,
  title: string,
  description: string,
  priority: string = 'MEDIUM',
  dueDate: string | null = null
) {
  return db.prepare(`
    INSERT INTO project_tasks (id, room_id, creator_id, assignee_id, title, description, priority, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'TODO', ?)
  `).run(id, roomId, creatorId, assigneeId, title, description, priority, dueDate);
}

export function updateTaskStatus(taskId: string, status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE') {
  const completedAt = status === 'DONE' ? new Date().toISOString() : null;
  return db.prepare(`
    UPDATE project_tasks
    SET status = ?, completed_at = ?
    WHERE id = ?
  `).run(status, completedAt, taskId);
}

export function deleteProjectTask(taskId: string) {
  return db.prepare('DELETE FROM project_tasks WHERE id = ?').run(taskId);
}

// 14. Remote Attendance & Shift Records DAO
export function getTodayAttendance(userId: string, dateStr: string) {
  return db.prepare(`
    SELECT * FROM attendance_records
    WHERE user_id = ? AND work_date = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, dateStr) as any;
}

export function recordCheckIn(
  id: string,
  userId: string,
  checkInTime: string,
  workDate: string,
  ip: string,
  notes: string = ''
) {
  return db.prepare(`
    INSERT INTO attendance_records (id, user_id, check_in_time, work_date, check_in_ip, notes, status, work_duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, 'ON_TIME', 0)
  `).run(id, userId, checkInTime, workDate, ip, notes);
}

export function recordCheckOut(
  id: string,
  checkOutTime: string,
  durationMinutes: number,
  notes: string = ''
) {
  return db.prepare(`
    UPDATE attendance_records
    SET check_out_time = ?, work_duration_minutes = ?, notes = CASE WHEN notes != '' THEN notes || ' | ' || ? ELSE ? END
    WHERE id = ?
  `).run(checkOutTime, durationMinutes, notes, notes, id);
}

export function getAttendanceHistory(userId?: string, limit: number = 100) {
  if (userId) {
    return db.prepare(`
      SELECT a.*, u.full_name, u.username, u.department
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];
  } else {
    return db.prepare(`
      SELECT a.*, u.full_name, u.username, u.department
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit) as any[];
  }
}

// 15. Shared Secrets & Password Vault DAO
export function getSharedVaultItems(userId: string, role: string, roomId?: string | null) {
  if (role === 'SERVER_ADMIN') {
    if (roomId) {
      return db.prepare(`
        SELECT v.*, cr.full_name as creator_name, r.room_name
        FROM shared_vault_items v
        JOIN users cr ON v.creator_id = cr.id
        LEFT JOIN rooms r ON v.room_id = r.id
        WHERE v.room_id = ?
        ORDER BY v.created_at DESC
      `).all(roomId) as any[];
    } else {
      return db.prepare(`
        SELECT v.*, cr.full_name as creator_name, r.room_name
        FROM shared_vault_items v
        JOIN users cr ON v.creator_id = cr.id
        LEFT JOIN rooms r ON v.room_id = r.id
        ORDER BY v.created_at DESC
      `).all() as any[];
    }
  } else {
    // ROOM_OWNER or CLIENT: items in rooms they are ALLOWED in or Global items (room_id IS NULL)
    return db.prepare(`
      SELECT v.*, cr.full_name as creator_name, r.room_name
      FROM shared_vault_items v
      JOIN users cr ON v.creator_id = cr.id
      LEFT JOIN rooms r ON v.room_id = r.id
      WHERE v.room_id IS NULL OR v.room_id IN (
        SELECT room_id FROM room_permissions WHERE user_id = ? AND status = 'ALLOWED'
      ) OR v.room_id IN (
        SELECT id FROM rooms WHERE owner_id = ?
      )
      ORDER BY v.created_at DESC
    `).all(userId, userId) as any[];
  }
}

export function createSharedVaultItem(
  id: string,
  roomId: string | null,
  creatorId: string,
  title: string,
  category: string,
  usernameOrKey: string,
  secretValue: string,
  description: string
) {
  return db.prepare(`
    INSERT INTO shared_vault_items (id, room_id, creator_id, title, category, username_or_key, secret_value, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomId, creatorId, title, category, usernameOrKey, secretValue, description);
}

export function deleteSharedVaultItem(id: string) {
  return db.prepare('DELETE FROM shared_vault_items WHERE id = ?').run(id);
}

// ==========================================
// 15. EXECUTIVE METRICS & AI REPORTS
// ==========================================

export function getLiveAnalyticsMetrics() {
  const usersRow = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM users').get() as any;
  const today = new Date().toISOString().split('T')[0];
  const attRow = db.prepare(`
    SELECT 
      COUNT(*) as today_count,
      SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as today_late,
      SUM(COALESCE(work_duration_minutes, 0)) as total_minutes
    FROM attendance_records
    WHERE work_date = ?
  `).get(today) as any;

  const tasksRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'TODO' THEN 1 ELSE 0 END) as todo_count,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
      SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done_count
    FROM project_tasks
  `).get() as any;

  const apprRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_count
    FROM approvals
  `).get() as any;

  const eventsCount = (db.prepare('SELECT COUNT(*) as count FROM events').get() as any)?.count || 0;
  const auditRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN risk_level IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END) as high_risk_count
    FROM audit_logs
  `).get() as any;

  const vaultCount = (db.prepare('SELECT COUNT(*) as count FROM shared_vault_items').get() as any)?.count || 0;
  const driveFilesCount = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE file_metadata IS NOT NULL').get() as any)?.count || 0;

  const totalTasks = tasksRow?.total || 0;
  const doneTasks = tasksRow?.done_count || 0;
  const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  return {
    users: {
      total: usersRow?.total || 0,
      active: usersRow?.active || 0,
    },
    attendance: {
      todayCount: attRow?.today_count || 0,
      todayLate: attRow?.today_late || 0,
      todayTotalMinutes: attRow?.total_minutes || 0,
      todayAttendanceRate: (usersRow?.active || 1) > 0 ? Math.round(((attRow?.today_count || 0) / (usersRow?.active || 1)) * 100) : 0,
    },
    tasks: {
      total: totalTasks,
      todo: tasksRow?.todo_count || 0,
      inProgress: tasksRow?.in_progress_count || 0,
      review: tasksRow?.review_count || 0,
      done: doneTasks,
      completionRate: taskCompletionRate,
    },
    approvals: {
      total: apprRow?.total || 0,
      pending: apprRow?.pending_count || 0,
      approved: apprRow?.approved_count || 0,
      rejected: apprRow?.rejected_count || 0,
    },
    eventsCount,
    security: {
      totalAuditLogs: auditRow?.total || 0,
      highRiskIncidents: auditRow?.high_risk_count || 0,
      securityScore: Math.max(70, 100 - (auditRow?.high_risk_count || 0) * 5),
    },
    resources: {
      vaultItems: vaultCount,
      driveFiles: driveFilesCount,
    },
  };
}

export function saveExecutiveReport(
  id: string,
  authorId: string,
  reportTitle: string,
  periodType: string,
  metricsJson: string,
  aiAnalysis: string
) {
  return db.prepare(`
    INSERT INTO executive_reports (id, author_id, report_title, period_type, metrics_json, ai_analysis)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, authorId, reportTitle, periodType, metricsJson, aiAnalysis);
}

export function getExecutiveReports() {
  return db.prepare(`
    SELECT r.*, u.full_name as author_name, u.role as author_role
    FROM executive_reports r
    JOIN users u ON r.author_id = u.id
    ORDER BY r.created_at DESC
  `).all() as any[];
}

export function deleteExecutiveReport(id: string) {
  return db.prepare('DELETE FROM executive_reports WHERE id = ?').run(id);
}

// ==========================================
// 16. COLLABORATIVE WHITEBOARD SNAPSHOTS
// ==========================================

export function saveWhiteboardSnapshot(
  id: string,
  roomId: string | null,
  creatorId: string,
  title: string,
  canvasData: string,
  thumbnailUrl: string | null
) {
  return db.prepare(`
    INSERT INTO whiteboard_snapshots (id, room_id, creator_id, title, canvas_data, thumbnail_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      canvas_data = excluded.canvas_data,
      thumbnail_url = excluded.thumbnail_url,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, roomId, creatorId, title, canvasData, thumbnailUrl);
}

export function getWhiteboardSnapshots(roomId: string | null) {
  if (roomId) {
    return db.prepare(`
      SELECT w.*, u.full_name as creator_name
      FROM whiteboard_snapshots w
      JOIN users u ON w.creator_id = u.id
      WHERE w.room_id = ?
      ORDER BY w.updated_at DESC
    `).all(roomId) as any[];
  } else {
    return db.prepare(`
      SELECT w.*, u.full_name as creator_name
      FROM whiteboard_snapshots w
      JOIN users u ON w.creator_id = u.id
      ORDER BY w.updated_at DESC
    `).all() as any[];
  }
}

export function getWhiteboardById(id: string) {
  return db.prepare(`
    SELECT w.*, u.full_name as creator_name
    FROM whiteboard_snapshots w
    JOIN users u ON w.creator_id = u.id
    WHERE w.id = ?
  `).get(id) as any;
}

export function deleteWhiteboardSnapshot(id: string) {
  return db.prepare('DELETE FROM whiteboard_snapshots WHERE id = ?').run(id);
}

// ==========================================
// 17. IT HARDWARE ASSETS DAO
// ==========================================

export function getItAssets() {
  return db.prepare(`
    SELECT a.*, u.full_name as assigned_user_name, u.username as assigned_username
    FROM it_assets a
    LEFT JOIN users u ON a.assigned_to_user_id = u.id
    ORDER BY a.created_at DESC
  `).all() as any[];
}

export function createItAsset(
  id: string,
  assetTag: string,
  assetName: string,
  category: string,
  serialNumber: string | null,
  assignedToUserId: string | null,
  status: string,
  purchaseDate: string | null,
  specsInfo: string | null,
  notes: string | null
) {
  return db.prepare(`
    INSERT INTO it_assets (id, asset_tag, asset_name, category, serial_number, assigned_to_user_id, status, purchase_date, specs_info, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, assetTag, assetName, category, serialNumber, assignedToUserId, status, purchaseDate, specsInfo, notes);
}

export function updateItAsset(
  id: string,
  assetName: string,
  category: string,
  serialNumber: string | null,
  assignedToUserId: string | null,
  status: string,
  specsInfo: string | null,
  notes: string | null
) {
  return db.prepare(`
    UPDATE it_assets
    SET asset_name = ?, category = ?, serial_number = ?, assigned_to_user_id = ?, status = ?, specs_info = ?, notes = ?
    WHERE id = ?
  `).run(assetName, category, serialNumber, assignedToUserId, status, specsInfo, notes, id);
}

export function deleteItAsset(id: string) {
  return db.prepare('DELETE FROM it_assets WHERE id = ?').run(id);
}

// ==========================================
// 18. SOFTWARE LICENSES DAO
// ==========================================

export function getSoftwareLicenses() {
  return db.prepare('SELECT * FROM software_licenses ORDER BY created_at DESC').all() as any[];
}

export function createSoftwareLicense(
  id: string,
  softwareName: string,
  licenseType: string,
  licenseKey: string,
  totalSeats: number,
  assignedSeats: number,
  expiryDate: string | null,
  notes: string | null
) {
  return db.prepare(`
    INSERT INTO software_licenses (id, software_name, license_type, license_key, total_seats, assigned_seats, expiry_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, softwareName, licenseType, licenseKey, totalSeats, assignedSeats, expiryDate, notes);
}

export function deleteSoftwareLicense(id: string) {
  return db.prepare('DELETE FROM software_licenses WHERE id = ?').run(id);
}

// ==========================================
// 19. INTERNAL WIKI & KNOWLEDGE BASE DAO
// ==========================================

export function getWikiArticles(category?: string, search?: string) {
  let query = `
    SELECT w.*, u.full_name as author_name, u.role as author_role
    FROM wiki_articles w
    JOIN users u ON w.author_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (category && category !== 'ALL') {
    query += ' AND w.category = ?';
    params.push(category);
  }

  if (search && search.trim() !== '') {
    query += ' AND (w.title LIKE ? OR w.content LIKE ?)';
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  query += ' ORDER BY w.is_pinned DESC, w.updated_at DESC';
  return db.prepare(query).all(...params) as any[];
}

export function getWikiArticleById(id: string) {
  return db.prepare(`
    SELECT w.*, u.full_name as author_name, u.role as author_role
    FROM wiki_articles w
    JOIN users u ON w.author_id = u.id
    WHERE w.id = ?
  `).get(id) as any;
}

export function createWikiArticle(
  id: string,
  category: string,
  title: string,
  content: string,
  authorId: string,
  isPinned: number = 0
) {
  return db.prepare(`
    INSERT INTO wiki_articles (id, category, title, content, author_id, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, category, title, content, authorId, isPinned);
}

export function updateWikiArticle(
  id: string,
  category: string,
  title: string,
  content: string,
  isPinned: number
) {
  return db.prepare(`
    UPDATE wiki_articles
    SET category = ?, title = ?, content = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(category, title, content, isPinned, id);
}

export function deleteWikiArticle(id: string) {
  return db.prepare('DELETE FROM wiki_articles WHERE id = ?').run(id);
}

export function incrementWikiViewCount(id: string) {
  return db.prepare('UPDATE wiki_articles SET view_count = view_count + 1 WHERE id = ?').run(id);
}

// ==========================================
// 20. TWO-FACTOR AUTHENTICATION (2FA) DAO
// ==========================================

export function setUser2FaSecret(userId: string, secret: string, recoveryCodes: string[]) {
  return db.prepare(`
    UPDATE users
    SET two_factor_secret = ?, two_factor_recovery_codes = ?, two_factor_enabled = 0
    WHERE id = ?
  `).run(secret, JSON.stringify(recoveryCodes), userId);
}

export function enableUser2Fa(userId: string) {
  return db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(userId);
}

export function disableUser2Fa(userId: string) {
  return db.prepare(`
    UPDATE users
    SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_recovery_codes = '[]'
    WHERE id = ?
  `).run(userId);
}

export function getUser2FaData(userId: string) {
  return db.prepare(`
    SELECT two_factor_secret, two_factor_enabled, two_factor_recovery_codes
    FROM users
    WHERE id = ?
  `).get(userId) as any;
}

export function consumeRecoveryCode(userId: string, code: string): boolean {
  const user = db.prepare('SELECT two_factor_recovery_codes FROM users WHERE id = ?').get(userId) as any;
  if (!user || !user.two_factor_recovery_codes) return false;

  try {
    const codes: string[] = JSON.parse(user.two_factor_recovery_codes);
    const cleanCode = code.trim().toUpperCase();
    const idx = codes.findIndex((c) => c.toUpperCase() === cleanCode);
    if (idx >= 0) {
      codes.splice(idx, 1);
      db.prepare('UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?').run(JSON.stringify(codes), userId);
      return true;
    }
  } catch (e) {}
  return false;
}

// Auto-run if executed directly
if (require.main === module) {
  initDatabase();
  console.log('Database verification successful.');
}





// ==========================================
// Phase 17: Real-time Room Polls & Voting
// ==========================================
export function insertPoll(poll: {
  id: string;
  roomId: string;
  creatorId: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  allowMultiple: boolean;
  expiresAt: string | null;
}) {
  return db.prepare(`
    INSERT INTO room_polls (id, room_id, creator_id, question, options, is_anonymous, allow_multiple, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    poll.id,
    poll.roomId,
    poll.creatorId,
    poll.question,
    JSON.stringify(poll.options),
    poll.isAnonymous ? 1 : 0,
    poll.allowMultiple ? 1 : 0,
    poll.expiresAt
  );
}

export function getPollRowById(pollId: string) {
  return db.prepare(`
    SELECT p.*, u.full_name AS creator_name, u.username AS creator_username
    FROM room_polls p LEFT JOIN users u ON u.id = p.creator_id
    WHERE p.id = ?
  `).get(pollId) as any;
}

export function getPollRowsByRoom(roomId: string, limit: number = 50) {
  return db.prepare(`
    SELECT p.*, u.full_name AS creator_name, u.username AS creator_username
    FROM room_polls p LEFT JOIN users u ON u.id = p.creator_id
    WHERE p.room_id = ?
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ?
  `).all(roomId, limit) as any[];
}

export function getPollVotes(pollId: string) {
  return db.prepare(`
    SELECT v.user_id, v.option_index, u.full_name, u.username
    FROM room_poll_votes v LEFT JOIN users u ON u.id = v.user_id
    WHERE v.poll_id = ?
    ORDER BY v.created_at ASC
  `).all(pollId) as any[];
}

/** Atomically replaces a user's ballot for a poll. */
export function replacePollVotes(pollId: string, userId: string, optionIndexes: number[]) {
  // Built lazily because `db` may be re-opened after a backup restore.
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM room_poll_votes WHERE poll_id = ? AND user_id = ?').run(pollId, userId);
    const ins = db.prepare('INSERT INTO room_poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)');
    for (const idx of optionIndexes) ins.run(pollId, userId, idx);
  });
  tx();
}

export function closePollRow(pollId: string) {
  return db.prepare('UPDATE room_polls SET is_closed = 1, closed_at = CURRENT_TIMESTAMP WHERE id = ?').run(pollId);
}

export function deletePollRow(pollId: string) {
  db.prepare('DELETE FROM room_poll_votes WHERE poll_id = ?').run(pollId);
  return db.prepare('DELETE FROM room_polls WHERE id = ?').run(pollId);
}
