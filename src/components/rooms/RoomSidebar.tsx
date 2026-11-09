import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Search,
  Lock,
  Unlock,
  Users,
  Shield,
  Layers,
  Sparkles,
  Terminal,
  Monitor,
  Settings,
  Activity,
  Video,
  KeyRound,
  X,
  CheckCircle2,
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RoomSidebarProps {
  currentRoom: any | null;
  onSelectRoom: (room: any, userState?: any) => void;
  currentView: 'feed' | 'calendar' | 'approvals' | 'tasks' | 'attendance' | 'vault' | 'analytics' | 'whiteboard' | 'assets' | 'wiki' | 'backup' | 'admin' | 'audit' | 'video';
  onViewChange: (view: 'feed' | 'calendar' | 'approvals' | 'tasks' | 'attendance' | 'vault' | 'analytics' | 'whiteboard' | 'assets' | 'wiki' | 'backup' | 'admin' | 'audit' | 'video') => void;
  onOpenSsh: () => void;
  onOpenUltraViewer: () => void;
  onOpenDrive: () => void;
}

export const RoomSidebar: React.FC<RoomSidebarProps> = ({
  currentRoom,
  onSelectRoom,
  currentView,
  onViewChange,
  onOpenSsh,
  onOpenUltraViewer,
  onOpenDrive,
}) => {
  const { user, token, serverUrl } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dual-Lock Password Modal State
  const [targetRoomToEnter, setTargetRoomToEnter] = useState<any | null>(null);
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [isVerifyingPass, setIsVerifyingPass] = useState(false);

  // Create Room Modal State
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [createRoomMsg, setCreateRoomMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/rooms/lobby`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [token, serverUrl]);

  // Pick cute icon for room
  const getRoomIcon = (code: string, name: string) => {
    const text = (code + ' ' + name).toLowerCase();
    if (text.includes('it') || text.includes('tech') || text.includes('ha tang') || text.includes('infra')) return '💻';
    if (text.includes('bao mat') || text.includes('sec') || text.includes('an ninh')) return '🛡️';
    if (text.includes('mkt') || text.includes('marketing') || text.includes('truyen thong')) return '🎨';
    if (text.includes('hr') || text.includes('nhan su')) return '👥';
    if (text.includes('ke toan') || text.includes('tai chinh') || text.includes('finance')) return '📊';
    if (text.includes('kinh doanh') || text.includes('sales')) return '🚀';
    if (text.includes('cafe') || text.includes('relax') || text.includes('thu gian')) return '☕';
    return '💬';
  };

  const handleRoomClick = (room: any) => {
    // If Global channel or user is Admin/Owner, enter directly
    if (room.is_global === 1 || room.owner_id === user?.id || user?.role === 'SERVER_ADMIN') {
      onSelectRoom(room, { is_allowed: true, is_moderator: room.owner_id === user?.id || user?.role === 'SERVER_ADMIN' });
      onViewChange('feed');
      return;
    }

    const access = room.user_access?.status || 'NONE';
    if (access === 'ALLOWED') {
      // Prompt password (Lock 2)
      setTargetRoomToEnter(room);
      setRoomPasswordInput('');
      setPassError(null);
    } else if (access === 'PENDING') {
      alert(`Yêu cầu vào phòng '${room.room_name}' đang chờ Trưởng phòng phê duyệt.`);
    } else if (access === 'KICKED') {
      alert(`Bạn đã bị cấm vào phòng ban '${room.room_name}'.`);
    } else {
      // Request access
      if (confirm(`Bạn chưa được cấp quyền vào '${room.room_name}'. Gửi yêu cầu xin cấp quyền tới Trưởng phòng ngay?`)) {
        handleRequestAccess(room.id);
      }
    }
  };

  const handleRequestAccess = async (roomId: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/rooms/${roomId}/request-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert('Đã gửi yêu cầu vào phòng thành công!');
        fetchRooms();
      } else {
        alert(data.error || 'Gửi yêu cầu thất bại');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoomToEnter) return;
    setIsVerifyingPass(true);
    setPassError(null);

    try {
      const res = await fetch(`${serverUrl}/api/rooms/${targetRoomToEnter.id}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ room_password: roomPasswordInput }),
      });
      const data = await res.json();
      if (res.ok) {
        onSelectRoom(targetRoomToEnter, data.user_state);
        onViewChange('feed');
        setTargetRoomToEnter(null);
      } else {
        setPassError(data.error || 'Mật khẩu phòng không chính xác');
      }
    } catch (err: any) {
      setPassError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsVerifyingPass(false);
    }
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingRoom(true);
    setCreateRoomMsg(null);
    try {
      const res = await fetch(`${serverUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_name: newRoomName,
          room_code: newRoomCode.toUpperCase(),
          room_password: newRoomPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateRoomMsg({ type: 'success', text: 'Tạo phòng thành công!' });
        setTimeout(() => {
          setIsCreateRoomOpen(false);
          setNewRoomName('');
          setNewRoomCode('');
          setNewRoomPassword('');
          setCreateRoomMsg(null);
          fetchRooms();
        }, 1000);
      } else {
        setCreateRoomMsg({ type: 'error', text: data.error || 'Lỗi tạo phòng' });
      }
    } catch (err: any) {
      setCreateRoomMsg({ type: 'error', text: err.message });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const globalRoom = rooms.find((r) => r.is_global === 1);
  const departmentRooms = rooms.filter(
    (r) =>
      r.is_global !== 1 &&
      (r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.room_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="w-64 md:w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Top Header of Room List */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🏢</span>
          <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">
            Phòng Ban & Kênh
          </span>
        </div>

        {(user?.role === 'SERVER_ADMIN' || user?.role === 'ROOM_OWNER') && (
          <button
            onClick={() => setIsCreateRoomOpen(true)}
            className="p-1 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 shadow-sm transition"
            title="Tạo phòng ban mới"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo</span>
          </button>
        )}
      </div>

      {/* Quick Search Bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm phòng..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
      </div>

      {/* Rooms Scrollable List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
        {/* GLOBAL COMPANY BROADCAST CHANNEL */}
        {globalRoom && (
          <button
            onClick={() => {
              onSelectRoom(globalRoom, { is_allowed: true });
              onViewChange('feed');
            }}
            className={`w-full p-2.5 rounded-2xl flex items-center justify-between text-left transition group ${
              currentRoom?.id === globalRoom.id && currentView === 'feed'
                ? 'bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-purple-900/10 border border-purple-500/40 text-purple-200 shadow-md shadow-purple-950/50'
                : 'hover:bg-slate-800/60 text-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition">
                📢
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-100 truncate flex items-center space-x-1">
                  <span>Kênh Toàn Thể</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                    Chung
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Bảng tin & sự kiện công ty
                </div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
          </button>
        )}

        {/* Section Divider */}
        <div className="pt-3 pb-1 px-2 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>Phòng ban chuyên môn</span>
          <span className="text-slate-400 font-normal">({departmentRooms.length})</span>
        </div>

        {/* Department Room Items */}
        {departmentRooms.map((room) => {
          const isSelected = currentRoom?.id === room.id && currentView === 'feed';
          const icon = getRoomIcon(room.room_code, room.room_name);
          const isAllowed =
            room.owner_id === user?.id ||
            user?.role === 'SERVER_ADMIN' ||
            room.user_access?.status === 'ALLOWED';

          return (
            <button
              key={room.id}
              onClick={() => handleRoomClick(room)}
              className={`w-full p-2.5 rounded-2xl flex items-center justify-between text-left transition group ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-purple-900/10 border border-purple-500/40 text-purple-200 shadow-md shadow-purple-950/50'
                  : 'hover:bg-slate-800/50 text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition">
                  {icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {room.room_name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate flex items-center space-x-1">
                    <span className="font-mono text-purple-400">{room.room_code}</span>
                    <span>•</span>
                    <span>{room.member_count || 1} tv</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 ml-1">
                {isAllowed ? (
                  <span className="text-[10px] text-emerald-400 font-medium px-1.5 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/50">
                    Vào
                  </span>
                ) : (
                  <Lock className="w-3.5 h-3.5 text-yellow-500/80" />
                )}
              </div>
            </button>
          );
        })}

        {departmentRooms.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-500">
            Không tìm thấy phòng ban nào
          </div>
        )}
      </div>

      {/* Bottom Utilities Menu */}
      <div className="p-3 border-t border-slate-800 space-y-1 bg-slate-950/60">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
          Tiện ích làm việc
        </div>

        <button
          onClick={() => onViewChange('calendar')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'calendar'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">📅</span>
          <span>Lịch Sự Kiện & Họp</span>
        </button>

        <button
          onClick={() => onViewChange('approvals')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'approvals'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">📋</span>
          <span>Trình Ký & Đề Xuất</span>
        </button>

        <button
          onClick={() => onViewChange('tasks')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'tasks'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">🎯</span>
          <span>Bảng Kanban Dự Án</span>
        </button>

        <button
          onClick={() => onViewChange('attendance')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'attendance'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">⏰</span>
          <span>Điểm Danh Chấm Công</span>
        </button>

        <button
          onClick={() => onViewChange('vault')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'vault'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">🔐</span>
          <span>Két Mật Khẩu (Vault)</span>
        </button>

        <button
          onClick={() => onViewChange('analytics')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'analytics'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">📊</span>
          <span>Báo Cáo Điều Hành AI</span>
        </button>

        <button
          onClick={() => onViewChange('whiteboard')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'whiteboard'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">🎨</span>
          <span>Bảng Vẽ Ý Tưởng Họp</span>
        </button>

        <button
          onClick={() => onViewChange('assets')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'assets'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">💻</span>
          <span>Tài Sản & License IT</span>
        </button>

        <button
          onClick={() => onViewChange('wiki')}
          className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
            currentView === 'wiki'
              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
              : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <span className="text-base">📚</span>
          <span>Cẩm Nang Doanh Nghiệp</span>
        </button>

        <button
          onClick={onOpenDrive}
          className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-amber-300 hover:bg-slate-800 flex items-center space-x-2.5 transition"
        >
          <span className="text-base">📁</span>
          <span>Kho Tệp Tin (Drive)</span>
        </button>

        <button
          onClick={onOpenUltraViewer}
          className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-blue-300 hover:bg-slate-800 flex items-center space-x-2.5 transition"
        >
          <span className="text-base">🖥️</span>
          <span>UltraViewer Pro</span>
        </button>

        {(user?.role === 'SERVER_ADMIN' || user?.role === 'ROOM_OWNER') && (
          <button
            onClick={onOpenSsh}
            className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-emerald-300 hover:bg-slate-800 flex items-center space-x-2.5 transition"
          >
            <span className="text-base">💻</span>
            <span>SSH WebTerminal</span>
          </button>
        )}

        {user?.role === 'SERVER_ADMIN' && (
          <>
            <button
              onClick={() => onViewChange('admin')}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
                currentView === 'admin'
                  ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
                  : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-base">⚙️</span>
              <span>Quản Trị Server</span>
            </button>

            <button
              onClick={() => onViewChange('audit')}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
                currentView === 'audit'
                  ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
                  : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-base">📊</span>
              <span>Giám Sát An Ninh AI</span>
            </button>

            <button
              onClick={() => onViewChange('backup')}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition ${
                currentView === 'backup'
                  ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
                  : 'text-slate-300 hover:text-purple-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-base">💾</span>
              <span>Sao Lưu & Phục Hồi</span>
            </button>
          </>
        )}
      </div>

      {/* Dual-Lock Password Verification Modal */}
      {targetRoomToEnter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🔐</span>
                <h3 className="text-sm font-bold text-slate-100">Mở Khóa Kép Vào Phòng</h3>
              </div>
              <button
                onClick={() => setTargetRoomToEnter(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Bạn đã vượt qua <span className="text-emerald-400 font-semibold">Khóa 1 (Whitelist ACL)</span>. Nhập mật khẩu bí mật của phòng <span className="text-purple-400 font-bold font-mono">'{targetRoomToEnter.room_name}'</span> để vào:
            </p>

            {passError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300">
                {passError}
              </div>
            )}

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <input
                type="password"
                required
                autoFocus
                value={roomPasswordInput}
                onChange={(e) => setRoomPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu phòng..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setTargetRoomToEnter(null)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPass}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30"
                >
                  {isVerifyingPass ? 'Đang mở...' : 'Mở Khóa & Vào'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {isCreateRoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xl">✨</span>
                <h3 className="text-sm font-bold text-slate-100">Tạo Phòng Ban Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateRoomOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createRoomMsg && (
              <div
                className={`p-3 rounded-xl text-xs ${
                  createRoomMsg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                }`}
              >
                {createRoomMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateRoomSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Tên phòng ban
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Phòng Thiết Kế Sáng Tạo"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Mã phòng (Viết tắt)
                </label>
                <input
                  type="text"
                  required
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DESIGN_TEAM"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 uppercase font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Mật khẩu phòng (Khóa 2)
                </label>
                <input
                  type="password"
                  required
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  placeholder="Mật khẩu vào phòng..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30"
                >
                  {isCreatingRoom ? 'Đang tạo...' : 'Tạo phòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

