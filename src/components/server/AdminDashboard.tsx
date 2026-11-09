import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Layers,
  Globe,
  Radio,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Key,
  FolderPlus,
  Download,
  KeyRound,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export const AdminDashboard: React.FC = () => {
  const { token, serverUrl } = useAuth();
  const { socket } = useSocket();

  const [users, setUsers] = useState<any[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [visibleUltraPass, setVisibleUltraPass] = useState<Record<string, boolean>>({});
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [copiedUltraKey, setCopiedUltraKey] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [tunnelStatus, setTunnelStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'ROOM_OWNER' | 'CLIENT'>('CLIENT');
  const [newDepartment, setNewDepartment] = useState('IT Department');
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Room Form State
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [roomMsg, setRoomMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Export & Reset Password State
  const [isExporting, setIsExporting] = useState(false);
  const [resettingUser, setResettingUser] = useState<any | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const handleExportAuditLogs = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/audit-logs/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export audit logs failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !adminNewPassword) return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: adminNewPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetMsg(`Đã đổi mật khẩu cho ${resettingUser.username} thành công!`);
        setTimeout(() => {
          setResettingUser(null);
          setAdminNewPassword('');
          setResetMsg(null);
        }, 1500);
      } else {
        setResetMsg(data.error || 'Thao tác thất bại');
      }
    } catch (err: any) {
      setResetMsg(err.message);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, roomsRes, statusRes] = await Promise.all([
        fetch(`${serverUrl}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${serverUrl}/api/rooms/lobby`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${serverUrl}/api/status`),
      ]);

      if (usersRes.ok) {
        const u = await usersRes.json();
        const userList = u.users || [];
        setUsers(userList);

        // Update online set from server initial status
        const onlineSet = new Set<string>();
        userList.forEach((userItem: any) => {
          if (userItem.is_online) onlineSet.add(userItem.id);
        });
        if (onlineSet.size > 0) {
          setOnlineUserIds((prev) => new Set([...prev, ...onlineSet]));
        }
      }
      if (roomsRes.ok) {
        const r = await roomsRes.json();
        setRooms(r.rooms || []);
      }
      if (statusRes.ok) {
        const s = await statusRes.json();
        setTunnelStatus(s);
      }
    } catch (err) {
      console.error('[AdminDashboard] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, serverUrl]);

  // Real-time Presence and User Sync via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handlePresence = ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(ids || []));
    };

    const handleUserChanged = () => {
      fetchData();
    };

    socket.on('presence:update', handlePresence);
    socket.on('admin:user_created', handleUserChanged);
    socket.on('admin:user_updated', handleUserChanged);

    return () => {
      socket.off('presence:update', handlePresence);
      socket.off('admin:user_created', handleUserChanged);
      socket.off('admin:user_updated', handleUserChanged);
    };
  }, [socket]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    try {
      const res = await fetch(`${serverUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          full_name: newFullName,
          role: newRole,
          department: newDepartment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserMsg({
          type: 'success',
          text: `Cấp tài khoản '${data.user.username}' thành công! (UltraViewer ID: ${data.user.ultra_id || '—'} | PIN: ${data.user.ultra_pass || '—'})`,
        });
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
        fetchData();
      } else {
        setUserMsg({ type: 'error', text: data.error || 'Lỗi cấp tài khoản' });
      }
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomMsg(null);
    try {
      const res = await fetch(`${serverUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_name: roomName,
          room_code: roomCode,
          room_password: roomPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoomMsg({ type: 'success', text: 'Phòng ban đã được tạo thành công!' });
        setRoomName('');
        setRoomCode('');
        setRoomPassword('');
        fetchData();
      } else {
        setRoomMsg({ type: 'error', text: data.error || 'Lỗi tạo phòng ban' });
      }
    } catch (err: any) {
      setRoomMsg({ type: 'error', text: err.message });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: number) => {
    try {
      await fetch(`${serverUrl}/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: currentStatus === 1 ? 0 : 1 }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-100">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Shield className="w-7 h-7 text-emerald-400" />
            <span>Server Administration & Zero-Trust Command</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản trị viên tối cao: Cấp phát tài khoản, kiểm soát phòng ban & giám sát đường hầm
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportAuditLogs}
            disabled={isExporting}
            className="px-3.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Đang xuất...' : 'Xuất Kiểm Toán (CSV)'}</span>
          </button>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg flex items-center space-x-1.5 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Tổng người dùng</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{users.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Được quản lý tập trung</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Phòng ban hoạt động</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{rooms.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Bảo vệ bởi Khóa Kép</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Trạng thái Server</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-emerald-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{tunnelStatus?.status || 'ONLINE'}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {tunnelStatus?.mode || 'Zero-Trust Workspace'}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Đường hầm Cloudflare ($0)</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xs font-mono text-cyan-300 truncate" title={serverUrl}>
            {serverUrl}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Auto-Healing Watchdog 5s</div>
        </div>
      </div>

      {/* Action Forms Row: User Provisioning + Room Creation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create User Form */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            <span>Cấp tài khoản mới (RBAC)</span>
          </h2>

          {userMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                userMsg.type === 'success'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}
            >
              {userMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{userMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tên đăng nhập (Username)</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. it_lead, staff_sarah"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Mật khẩu khởi tạo</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Họ và tên nhân viên</label>
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Nguyen Van A"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Phân quyền vai trò</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="CLIENT">CLIENT (Nhân viên)</option>
                  <option value="ROOM_OWNER">ROOM_OWNER (Trưởng phòng)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Phòng ban</label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="e.g. IT, Marketing, Kế toán"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center space-x-1"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cấp phát tài khoản</span>
            </button>
          </form>
        </div>

        {/* Create Room Form */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
            <FolderPlus className="w-5 h-5 text-purple-400" />
            <span>Tạo phòng ban Khóa Kép</span>
          </h2>

          {roomMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                roomMsg.type === 'success'
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}
            >
              {roomMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{roomMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tên phòng ban</label>
              <input
                type="text"
                required
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Phòng Công Nghệ Thông Tin & Bảo Mật"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Mã phòng (Room Code)</label>
                <input
                  type="text"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. IT_DEPT, MKT_ROOM"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Mật khẩu phòng (Khóa 2)</label>
                <input
                  type="password"
                  required
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="Mật khẩu vào phòng"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center space-x-1"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Tạo phòng ban</span>
            </button>
          </form>
        </div>
      </div>

      {/* Users Table */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-base font-semibold text-slate-100">Danh sách tài khoản hệ thống</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Họ và tên</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Mật khẩu cấp phát</th>
                <th className="py-2.5 px-3">UltraViewer ID & PIN</th>
                <th className="py-2.5 px-3">Vai trò</th>
                <th className="py-2.5 px-3">Phòng ban</th>
                <th className="py-2.5 px-3">Trạng thái thực tế</th>
                <th className="py-2.5 px-3">Tài khoản</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-200">{u.full_name}</td>
                  <td className="py-2.5 px-3 font-mono text-purple-300 font-semibold">{u.username}</td>

                  {/* Password Column with Eye Toggle & Copy */}
                  <td className="py-2.5 px-3 font-mono">
                    <div className="inline-flex items-center space-x-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-200 tracking-wider">
                        {visiblePasswords[u.id]
                          ? (u.provisioned_password || '••••••••')
                          : '••••••••'}
                      </span>
                      {u.provisioned_password && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setVisiblePasswords((prev) => ({
                                ...prev,
                                [u.id]: !prev[u.id],
                              }))
                            }
                            className="text-slate-400 hover:text-purple-300 transition"
                            title={visiblePasswords[u.id] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {visiblePasswords[u.id] ? (
                              <EyeOff className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(u.provisioned_password);
                              setCopiedUserId(u.id);
                              setTimeout(() => setCopiedUserId(null), 2000);
                            }}
                            className="text-slate-400 hover:text-emerald-300 transition"
                            title="Sao chép mật khẩu"
                          >
                            {copiedUserId === u.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                  {/* UltraViewer ID & PIN Column */}
                  <td className="py-2.5 px-3 font-mono">
                    {u.ultra_id ? (
                      <div className="flex flex-col space-y-1">
                        {/* Ultra ID */}
                        <div className="inline-flex items-center space-x-1.5 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                          <span className="text-[10px] text-cyan-400 font-bold tracking-wider">ID:</span>
                          <span className="text-[11px] text-cyan-200 font-bold">{u.ultra_id}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(u.ultra_id);
                              setCopiedUltraKey(`id_${u.id}`);
                              setTimeout(() => setCopiedUltraKey(null), 2000);
                            }}
                            className="text-slate-400 hover:text-cyan-300 transition"
                            title="Sao chép ID UltraViewer"
                          >
                            {copiedUltraKey === `id_${u.id}` ? (
                              <Check className="w-3 h-3 text-cyan-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Ultra Pass / PIN */}
                        <div className="inline-flex items-center space-x-1.5 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                          <span className="text-[10px] text-amber-400 font-bold tracking-wider">PIN:</span>
                          <span className="text-[11px] text-amber-200">
                            {visibleUltraPass[u.id] ? (u.ultra_pass || '••••') : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleUltraPass((prev) => ({
                                ...prev,
                                [u.id]: !prev[u.id],
                              }))
                            }
                            className="text-slate-400 hover:text-amber-300 transition"
                            title={visibleUltraPass[u.id] ? 'Ẩn PIN' : 'Hiện PIN'}
                          >
                            {visibleUltraPass[u.id] ? (
                              <EyeOff className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(u.ultra_pass || '');
                              setCopiedUltraKey(`pass_${u.id}`);
                              setTimeout(() => setCopiedUltraKey(null), 2000);
                            }}
                            className="text-slate-400 hover:text-amber-300 transition"
                            title="Sao chép PIN UltraViewer"
                          >
                            {copiedUltraKey === `pass_${u.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.role === 'SERVER_ADMIN'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : u.role === 'ROOM_OWNER'
                          ? 'bg-purple-950 text-purple-400 border border-purple-800'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}
                    >
                      {u.role === 'SERVER_ADMIN' ? '🛡️ Quản trị viên' : u.role === 'ROOM_OWNER' ? '👑 Trưởng phòng' : '💻 Nhân viên'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{u.department || '—'}</td>

                  {/* Real-time Presence Column */}
                  <td className="py-2.5 px-3">
                    {onlineUserIds.has(u.id) ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>🟢 Đang hoạt động</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/60 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>⚪ Ngoại tuyến</span>
                      </span>
                    )}
                  </td>

                  {/* Account Status Column */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center space-x-1 text-[11px] ${
                        u.is_active === 1 ? 'text-slate-300' : 'text-rose-400 font-semibold'
                      }`}
                    >
                      <span>{u.is_active === 1 ? 'Bình thường' : 'Đã khóa'}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    {u.role !== 'SERVER_ADMIN' && (
                      <>
                        <button
                          onClick={() => {
                            setResettingUser(u);
                            setAdminNewPassword('');
                            setResetMsg(null);
                          }}
                          title="Đặt lại mật khẩu cho nhân viên"
                          className="px-2 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition inline-flex items-center space-x-1"
                        >
                          <KeyRound className="w-3 h-3 text-purple-400" />
                          <span>Đổi Pass</span>
                        </button>
                        <button
                          onClick={() => toggleUserStatus(u.id, u.is_active)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                            u.is_active === 1
                              ? 'bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
                          }`}
                        >
                          {u.is_active === 1 ? 'Khóa' : 'Kích hoạt'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Admin Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>Đặt Lại Mật Khẩu</span>
              </h3>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Đặt lại mật khẩu cho tài khoản: <span className="text-purple-400 font-semibold">{resettingUser.username}</span> ({resettingUser.full_name})
            </p>

            {resetMsg && (
              <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-purple-300">
                {resetMsg}
              </div>
            )}

            <form onSubmit={handleAdminResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới (>= 6 ký tự)..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
                >
                  Lưu mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

