# PROJECT SPECIFICATION: SECURE REMOTE WORKSPACE & ZERO-TRUST SSH/DESKTOP SYSTEM

> **AGENT DIRECTIVE FOR ANTIGRAVITY (`agy`):**
> You are the Lead Full-Stack Systems Architect & Autonomous Coding Agent for this repository.
> 1. Read this specification and `PROGRESS_NOTES.md` completely before writing any code.
> 2. Execute the project strictly following the **6 Execution Phases** defined below.
> 3. Maintain a **100% Free ($0 Cost)** architecture: DO NOT use paid APIs, paid TURN servers, or cloud databases.
> 4. After completing each sub-task or module, you MUST update the checkboxes `[ ]` to `[x]` and append an implementation log in `PROGRESS_NOTES.md`.

---

## 1. SYSTEM OVERVIEW & CORE OBJECTIVES
Build a cross-network Windows Desktop Application suite packaged as standalone `.exe` binaries (`Server_Admin.exe` and `Client_Workspace.exe`) enabling two or more laptops on completely different, dynamic networks (Wi-Fi, 4G/5G, CGNAT) to connect securely with zero router configuration.

### Core Capabilities:
1. **Zero-Config Dynamic Network Discovery ($0 Cost):**
   - `Server_Admin.exe` embeds `cloudflared.exe` to spawn an outbound Quick Tunnel (`*.trycloudflare.com`) and automatically publishes the active WSS/HTTPS URL to a fixed **GitHub Gist Discovery Registry** via GitHub REST API.
   - Network Watchdog monitors IP/interface changes every 5 seconds; if the server switches Wi-Fi/4G, it respawns the tunnel, updates the Gist, and all `Client_Workspace.exe` instances auto-reconnect and restore JWT/Room sessions seamlessly.
2. **Strict 3-Tier RBAC & Dual-Lock Room Architecture:**
   - **Roles:** `SERVER_ADMIN` (Root Boss), `ROOM_OWNER` (Department Head), `CLIENT` (Staff).
   - **Account Provisioning:** No public sign-up. Only `SERVER_ADMIN` can create `ROOM_OWNER` and `CLIENT` accounts.
   - **Dual-Lock Rooms:** All clients see the list of created rooms in the Lobby, and each room has its own `room_code` (ID) and `room_password`. However, a Client CANNOT enter a room even with the correct password unless `SERVER_ADMIN` or that room's `ROOM_OWNER` explicitly grants permission (`ALLOWED` in `room_permissions` whitelist).
   - **Room Owner Moderation:** Create department rooms, approve/add clients, kick clients, and force-mute client microphones.
3. **Enterprise Social Workplace & Scoped Department Feeds:**
   - **Global Broadcast Channel:** Posts/videos/plans published here are visible to all `ROOM_OWNER` and `CLIENT` accounts.
   - **Scoped Department Rooms (e.g., IT Room, Marketing Room, Accounting Room):** Posts, project plans, images, and videos uploaded inside a specific room are strictly isolated to permitted members of that room.
   - **Real-Time Communication:** 1-on-1 Direct Messaging, Room Group Chat, Chunked File Transfer (10MB chunks to bypass Cloudflare 100MB free limit), and WebRTC Group Video Calls.
4. **UltraViewer-Style Remote Desktop Control:**
   - Low-latency screen sharing via Electron `desktopCapturer` + WebRTC (`MediaStream`) with automatic WebSocket JPEG/WebP frame relay fallback if UDP P2P is blocked.
   - Remote Mouse & Keyboard injection on Windows using native `user32.dll` (`SetCursorPos`, `mouse_event`, `keybd_event` via `koffi`) with normalized screen coordinates (`xRatio`, `yRatio`).
   - Emergency local disconnect hotkey (`F12`).
5. **Standout Feature — Zero-Trust SSH Tunneling & Audited WebTerminal:**
   - Built-in interactive Terminal (`xterm.js` frontend + `node-pty` / `ssh2` stream multiplexer over WebSocket/WebRTC DataChannel).
   - Allows authorized IT Room Owners / Server Admin to open a remote shell (PowerShell / CMD / Bash / SSH) to a target Client machine across different networks **without opening Port 22**.
   - **Real-time Command Interception & Audit:** Every command executed in the SSH session is logged to `ssh_command_logs` on the Server.
   - **Dangerous Command Firewall:** Blocks destructive patterns (`rm -rf`, `format`, `del /f /s /q`, `Remove-Item -Recurse -Force C:\`) and triggers an instant high-risk alert on the Server Dashboard.
6. **Centralized Audit Logging & Local On-Premise AI (Ollama):**
   - Append-only `audit_logs` recording all logins, room actions, file transfers, remote desktop sessions, and SSH commands.
   - Local integration with **Ollama** (`http://127.0.0.1:11434`, model `qwen2.5:3b` or `llama3.2`) for:
     - Summarizing Department Project Posts & Meeting transcripts.
     - **AI SSH Copilot:** Translating `#ai <natural language request>` into executable shell commands.
     - **AI Security Guard:** Analyzing `audit_logs` and `ssh_command_logs` to flag anomalous user behavior.

---

## 2. TECH STACK & ZERO-COST DEPENDENCIES
- **Runtime & Desktop Shell:** Electron + Node.js + TypeScript (`electron`, `electron-builder`).
- **Frontend UI:** React 18 + Vite + TailwindCSS + Lucide Icons + `xterm` + `xterm-addon-fit`.
- **Backend & Real-Time Engine (Embedded in Server Mode):** Express + Socket.io (`socket.io`, `socket.io-client`) + JWT (`jsonwebtoken`, `bcryptjs`).
- **Database:** `better-sqlite3` (Zero-config embedded SQLite stored on Server Laptop disk with WAL mode enabled).
- **Native Windows Control & SSH:**
  - `koffi` (Direct FFI bindings to Windows `user32.dll` for UltraViewer mouse/keyboard control without requiring C++ build tools).
  - `node-pty` / `child_process` PowerShell & SSH bridge for the Zero-Trust SSH terminal.
- **Networking & Tunneling:** `cloudflared.exe` binary spawned via Node `child_process` + GitHub Gist API for dynamic endpoint resolution.

---

## 3. TARGET DIRECTORY STRUCTURE
```text
secure-remote-workspace/
├── bin/
│   └── cloudflared.exe                 # Bundled Cloudflare tunnel binary
├── electron/
│   ├── main.ts                         # Electron Main Process entry (Mode selector: Server vs Client)
│   ├── preload.ts                      # Secure IPC contextBridge
│   ├── services/
│   │   ├── tunnelWatchdog.ts           # Spawns cloudflared, parses URL, updates GitHub Gist, auto-heals
│   │   ├── gistDiscovery.ts            # Reads/Writes encrypted Server URL from/to GitHub Gist
│   │   ├── win32RemoteControl.ts       # koffi user32.dll mouse & keyboard injection + F12 panic hook
│   │   └── sshPtyBridge.ts             # Zero-Trust SSH / PowerShell PTY stream & Command Firewall
├── server/
│   ├── index.ts                        # Express + Socket.io Server bootstrapper
│   ├── db/
│   │   ├── schema.sql                  # Complete SQLite database schema
│   │   └── database.ts                 # better-sqlite3 initialization & DAO helpers
│   ├── middleware/
│   │   ├── authMiddleware.ts           # JWT verification & Role guards (SERVER_ADMIN, ROOM_OWNER, CLIENT)
│   │   └── auditLogger.ts              # Append-only audit & SSH command interceptor
│   ├── controllers/
│   │   ├── adminController.ts          # User creation (Owner/Client), Global Audit Logs
│   │   ├── roomController.ts           # Dual-lock room creation, Whitelist ACL, Mute/Kick
│   │   ├── feedController.ts           # Global Broadcast & Scoped Department Feeds + Chunked Upload
│   │   └── aiCopilotController.ts      # Local Ollama API integration (Feed summary, SSH Copilot, Log Audit)
│   └── sockets/
│       ├── signalingSocket.ts          # WebRTC SDP/ICE signaling + WebSocket Frame Fallback
│       ├── chatSocket.ts               # 1-on-1 DM, Room Chat, Chunked File Relay
│       └── sshSocket.ts                # Multiplexed SSH Terminal streams + Live Command Auditing
├── src/                                # React Frontend
│   ├── App.tsx
│   ├── context/
│   │   ├── AuthContext.tsx             # Auto-Discovery connection state + JWT session persistence
│   │   └── SocketContext.tsx           # Auto-reconnecting Socket.io client with Gist fallback
│   ├── components/
│   │   ├── server/
│   │   │   ├── AdminDashboard.tsx      # Create Room Owners/Clients, Manage Rooms, Tunnel Status
│   │   │   └── LiveAuditMonitor.tsx    # Real-time Activity & SSH Command Logs with AI Risk Badges
│   │   ├── rooms/
│   │   │   ├── RoomLobby.tsx           # Displays all rooms + Dual-Lock check (ACL + Room ID/Pass)
│   │   │   ├── DepartmentFeed.tsx      # FB-style scoped workplace posts, video/image plans + AI Summary
│   │   │   └── RoomModerationBar.tsx   # Room Owner controls: Approve, Kick, Force Mute, Invite
│   │   ├── communication/
│   │   │   ├── ChatPanel.tsx           # Room Chat, 1-on-1 DM, 10MB Chunked File Uploader
│   │   │   └── VideoCallGrid.tsx       # WebRTC Group Video + Server-enforced Mute
│   │   └── remote/
│   │       ├── UltraViewerCanvas.tsx   # Remote Desktop viewer + normalized mouse/key capture
│   │       └── SshTerminalModal.tsx    # xterm.js Zero-Trust SSH console + #ai command assistant
├── ANTIGRAVITY_SPEC.md
├── PROGRESS_NOTES.md
├── package.json
└── electron-builder.json
```

---

## 4. DATABASE SCHEMA (`server/db/schema.sql`)
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Users (Strictly created by SERVER_ADMIN)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SERVER_ADMIN', 'ROOM_OWNER', 'CLIENT')),
    department TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms (Created by SERVER_ADMIN or ROOM_OWNER)
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    room_name TEXT NOT NULL,
    room_password_hash TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id),
    is_global INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dual-Lock Room Permissions (Whitelist ACL + Moderation State)
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

-- 4. Scoped Department Feed & Global Broadcast Posts
CREATE TABLE IF NOT EXISTS feed_posts (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE, -- NULL = Global Channel
    author_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    media_files TEXT DEFAULT '[]', -- JSON array of local file paths
    ai_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Direct & Room Messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE, -- NULL if 1-on-1 DM
    sender_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT REFERENCES users(id),               -- Populated if 1-on-1 DM
    content TEXT,
    file_metadata TEXT,                                  -- JSON: { name, size, path, sha256 }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Zero-Trust SSH Sessions & Command Audit Logs
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

-- 7. System-Wide Immutable Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT REFERENCES users(id),
    actor_username TEXT,
    actor_role TEXT,
    action_type TEXT NOT NULL,
    target_details TEXT NOT NULL, -- JSON payload
    ip_address TEXT,
    risk_level TEXT DEFAULT 'LOW',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. STEP-BY-STEP EXECUTION PHASES FOR ANTIGRAVITY

### PHASE 1: Scaffolding, SQLite Core & Auto-Healing Cloudflare Tunnel
1. Initialize the Electron + React + TypeScript + Vite project and install dependencies (`better-sqlite3`, `socket.io`, `socket.io-client`, `express`, `jsonwebtoken`, `bcryptjs`, `xterm`, `lucide-react`, `tailwindcss`).
2. Implement `server/db/database.ts` executing `schema.sql` and seeding the default fixed `SERVER_ADMIN` account (`admin` / `Server@123456`) and the Global Broadcast room.
3. Implement `electron/services/tunnelWatchdog.ts` and `gistDiscovery.ts`:
   - Spawn `cloudflared tunnel --url http://127.0.0.1:8080`.
   - Extract the `https://*.trycloudflare.com` URL from `stderr`.
   - Push the URL to the configured GitHub Gist ID (with local LAN/localhost fallback if offline testing).
   - Run a 5-second health check loop to auto-restart the tunnel if the laptop switches Wi-Fi/4G networks.
4. Update `PROGRESS_NOTES.md` upon completion.

### PHASE 2: 3-Tier RBAC, Dual-Lock Rooms & Comprehensive Audit Middleware
1. Build `authMiddleware.ts` and `auditLogger.ts` so every API call and WebSocket action records an entry in `audit_logs`.
2. Build `adminController.ts`:
   - `POST /api/admin/users`: Allows ONLY `SERVER_ADMIN` to create `ROOM_OWNER` and `CLIENT` accounts.
   - `GET /api/admin/audit-logs`: Streams real-time activity logs and SSH logs to the Server Dashboard.
3. Build `roomController.ts`:
   - `POST /api/rooms`: Allows `SERVER_ADMIN` and `ROOM_OWNER` to create rooms with dedicated `room_code` and `room_password`.
   - `GET /api/rooms/lobby`: Returns all rooms so Clients see the 5+ department rooms in the UI, along with whether the calling Client is `ALLOWED` in `room_permissions`.
   - `POST /api/rooms/:id/enter`: Enforces **Dual-Lock Verification** — checks (1) `room_permissions.status === 'ALLOWED'` AND (2) `bcrypt.compare(roomPassword, room.room_password_hash)`.
   - `POST /api/rooms/:id/moderate`: Allows `SERVER_ADMIN` or the room's `ROOM_OWNER` to `ALLOW`, `KICK`, or `MUTE` (`is_muted = 1`) any Client and emit instant Socket.io events (`room:kicked`, `room:force_mute`).
4. Update `PROGRESS_NOTES.md`.

### PHASE 3: Scoped Department Workplace Feed, Chat & 10MB Chunked File Transfer
1. Implement `feedController.ts`:
   - `POST /api/feed`: Allows posting project plans, images, and videos to either the Global Channel (`room_id = NULL`) or a specific Department Room (`room_id = X`).
   - `GET /api/feed/:roomId`: Strictly verifies that the user belongs to `:roomId` before returning department posts (Marketing cannot see IT posts).
2. Implement `chatSocket.ts` and Chunked Upload API (`/api/upload/chunk`):
   - Splits files > 10MB on the Client into 10MB chunks, sends them over Cloudflare Tunnel, reassembles on Server disk, verifies SHA-256 hash, and broadcasts the download link in Room Chat or 1-on-1 DM.
3. Update `PROGRESS_NOTES.md`.

### PHASE 4: Zero-Trust SSH Multiplexer & Audited WebTerminal (Standout Module)
1. Implement `electron/services/sshPtyBridge.ts` and `server/sockets/sshSocket.ts`:
   - When an authorized `SERVER_ADMIN` or `ROOM_OWNER` initiates an SSH session to a Client in their room (`ssh:request_session`), the target `Client_Workspace.exe` spawns a local shell process (`powershell.exe` on Windows or `bash` on Linux) bridged over encrypted Socket.io binary streams.
   - Implement **Command Buffer Interception**: Every time the operator presses `Enter` (`\r`), capture the full command string on the Server before forwarding execution.
   - Run the **Dangerous Command Firewall**: If the command matches high-risk regex (`/(rm\s+-rf|format\s+[a-z]:|del\s+\/[fsq]|Remove-Item.*-Force|reg\s+delete)/i`), block execution, send a warning to the terminal, and insert a `CRITICAL` record into `ssh_command_logs` and `audit_logs`.
2. Build `src/components/remote/SshTerminalModal.tsx` using `xterm.js` with split-screen support, live session latency indicator, and `#ai` inline command generation.
3. Update `PROGRESS_NOTES.md`.

### PHASE 5: UltraViewer Remote Desktop & WebRTC Video Call with Moderation
1. Implement `signalingSocket.ts` and `VideoCallGrid.tsx`:
   - Multi-peer WebRTC Video/Audio calls inside rooms using free Google/Cloudflare STUN servers (`stun:stun.l.google.com:19302`, `stun:stun.cloudflare.com:3478`).
   - Enforce `is_muted` state from `room_permissions`: if the Room Owner mutes a Client, disable their audio track both locally and at the signaling relay.
2. Implement `win32RemoteControl.ts` and `UltraViewerCanvas.tsx`:
   - Stream target screen via `desktopCapturer` (WebRTC video track + automatic WebSocket compressed JPEG frame fallback if P2P UDP fails).
   - Capture normalized mouse `(xRatio, yRatio)`, clicks, and keycodes on the controller canvas; inject on target Windows machine using `koffi` (`user32.dll`) and register global shortcut `F12` to immediately terminate remote control.
3. Update `PROGRESS_NOTES.md`.

### PHASE 6: Local Ollama AI Integration & Windows `.exe` Packaging
1. Implement `aiCopilotController.ts` connecting to `http://127.0.0.1:11434/api/generate` (with graceful rule-based fallback if Ollama is not running):
   - Endpoint 1: Summarize long Department Project Plans into 3 bullet points.
   - Endpoint 2: Convert `#ai <prompt>` inside the SSH Terminal into exact Windows PowerShell / Linux Bash commands.
   - Endpoint 3: Analyze recent `audit_logs` and `ssh_command_logs` to highlight security anomalies on the Server Admin Dashboard.
2. Configure `electron-builder` in `package.json` to build `SecureWorkspace_Portable.exe` and `SecureWorkspace_Setup.exe` for Windows x64.
3. Perform end-to-end verification and mark all items completed in `PROGRESS_NOTES.md`.