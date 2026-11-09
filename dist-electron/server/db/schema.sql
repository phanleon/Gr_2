PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SERVER_ADMIN', 'ROOM_OWNER', 'CLIENT')),
    department TEXT,
    is_active INTEGER DEFAULT 1,
    two_factor_secret TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_recovery_codes TEXT DEFAULT '[]',
    provisioned_password TEXT,
    ultra_id TEXT,
    ultra_pass TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    room_name TEXT NOT NULL,
    room_password_hash TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id),
    is_global INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Room Permissions
CREATE TABLE IF NOT EXISTS room_permissions (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('ALLOWED', 'PENDING', 'KICKED')),
    is_muted INTEGER DEFAULT 0,
    can_ssh INTEGER DEFAULT 0,
    granted_by TEXT REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

-- 4. Scoped Feed Posts
CREATE TABLE IF NOT EXISTS feed_posts (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    media_files TEXT DEFAULT '[]',
    ai_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT REFERENCES users(id),
    content TEXT,
    file_metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. SSH Command Logs
CREATE TABLE IF NOT EXISTS ssh_command_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    operator_id TEXT NOT NULL REFERENCES users(id),
    target_client_id TEXT NOT NULL REFERENCES users(id),
    room_id TEXT REFERENCES rooms(id),
    command_text TEXT NOT NULL,
    was_blocked INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT REFERENCES users(id),
    actor_username TEXT,
    actor_role TEXT,
    action_type TEXT NOT NULL,
    target_details TEXT NOT NULL,
    ip_address TEXT,
    risk_level TEXT DEFAULT 'LOW',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Events
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATETIME NOT NULL,
    location_room_id TEXT REFERENCES rooms(id),
    creator_id TEXT NOT NULL REFERENCES users(id),
    category TEXT DEFAULT 'MEETING',
    is_important INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'SYSTEM',
    link_view TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Project Tasks
CREATE TABLE IF NOT EXISTS project_tasks (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES users(id),
    assignee_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'TODO',
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Shared Vault Items
CREATE TABLE IF NOT EXISTS shared_vault_items (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'CREDENTIAL',
    username_or_key TEXT,
    secret_value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. IT Assets
CREATE TABLE IF NOT EXISTS it_assets (
    id TEXT PRIMARY KEY,
    asset_tag TEXT UNIQUE NOT NULL,
    asset_name TEXT NOT NULL,
    category TEXT DEFAULT 'HARDWARE',
    serial_number TEXT,
    assigned_to_user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'IN_USE',
    purchase_date DATETIME,
    specs_info TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Software Licenses
CREATE TABLE IF NOT EXISTS software_licenses (
    id TEXT PRIMARY KEY,
    software_name TEXT NOT NULL,
    license_key TEXT NOT NULL,
    seats_allocated INTEGER DEFAULT 1,
    seats_used INTEGER DEFAULT 0,
    expires_at DATETIME,
    vendor TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_time DATETIME NOT NULL,
    check_out_time DATETIME,
    work_mode TEXT DEFAULT 'REMOTE',
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Approvals
CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id),
    approver_id TEXT REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Room Polls
CREATE TABLE IF NOT EXISTS room_polls (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES users(id),
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    is_closed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Room Poll Votes
CREATE TABLE IF NOT EXISTS room_poll_votes (
    poll_id TEXT NOT NULL REFERENCES room_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, user_id)
);

-- 18. Whiteboard Snapshots
CREATE TABLE IF NOT EXISTS whiteboard_snapshots (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    snapshot_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. Wiki Articles
CREATE TABLE IF NOT EXISTS wiki_articles (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'GENERAL',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
