import React, { useState, useEffect } from 'react';
import {
  Layers,
  Lock,
  Unlock,
  Users,
  Search,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  KeyRound,
  CheckCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RoomLobbyProps {
  onEnterRoom: (room: any, userState: any) => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ onEnterRoom }) => {
  const { token, serverUrl, user } = useAuth();

  const [rooms, setRooms] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [roomPassword, setRoomPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLobby = async () => {
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
    fetchLobby();
  }, [token, serverUrl]);

  const handleRequestAccess = async (roomId: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/rooms/${roomId}/request-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchLobby();
      } else {
        alert(data.error || 'Lỗi yêu cầu vào phòng');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEnterRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setErrorMsg(null);

    try {
      const res = await fetch(`${serverUrl}/api/rooms/${selectedRoom.id}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ room_password: roomPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onEnterRoom(data.room, data.user_state);
        setSelectedRoom(null);
        setRoomPassword('');
      } else {
        setErrorMsg(data.error || 'Không thể tham gia phòng');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.room_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Layers className="w-7 h-7 text-purple-400" />
            <span>Sảnh Phòng Ban Doanh Nghiệp (Dual-Lock Room Lobby)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cơ chế bảo mật Khóa Kép: Whitelist cấp phép (Khóa 1) + Mật khẩu mã hóa phòng (Khóa 2)
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên hoặc mã phòng..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRooms.map((room) => {
          const { status, can_moderate } = room.user_access;
          const isAllowed = status === 'ALLOWED' || room.is_global === 1 || user?.role === 'SERVER_ADMIN';

          return (
            <div
              key={room.id}
              className={`p-5 bg-slate-900 border rounded-2xl flex flex-col justify-between transition hover:shadow-xl ${
                room.is_global === 1
                  ? 'border-cyan-500/40 bg-gradient-to-b from-cyan-950/20 to-slate-900'
                  : isAllowed
                  ? 'border-emerald-500/30'
                  : 'border-slate-800'
              }`}
            >
              <div>
                {/* Badges Top */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {room.room_code}
                  </span>

                  {room.is_global === 1 ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                      Kênh toàn công ty
                    </span>
                  ) : isAllowed ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Được phép (Allowed)</span>
                    </span>
                  ) : status === 'PENDING' ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Đang chờ duyệt</span>
                    </span>
                  ) : status === 'KICKED' ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center space-x-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Bị đuổi</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Khóa kép</span>
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-100 mb-1">{room.room_name}</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Trưởng phòng: <span className="text-slate-300 font-medium">{room.owner_name}</span>
                </p>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center space-x-1 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  <span>{room.member_count} thành viên</span>
                </div>

                {isAllowed ? (
                  <button
                    onClick={() => {
                      if (room.is_global === 1 || user?.role === 'SERVER_ADMIN' || can_moderate) {
                        onEnterRoom(room, room.user_access);
                      } else {
                        setSelectedRoom(room);
                        setErrorMsg(null);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-md shadow-emerald-900/20"
                  >
                    <span>Vào phòng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : status === 'PENDING' ? (
                  <span className="text-xs text-amber-400 font-medium">Chờ Trưởng phòng duyệt</span>
                ) : status === 'KICKED' ? (
                  <span className="text-xs text-rose-400 font-medium">Bị chặn</span>
                ) : (
                  <button
                    onClick={() => handleRequestAccess(room.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-800/50 rounded-lg text-xs font-medium transition"
                  >
                    Xin cấp quyền (Whitelist)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dual-Lock Password Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-slate-100">Xác thực Khóa 2 (Mật khẩu phòng)</h3>
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Đóng
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Bạn đã vượt qua <span className="text-emerald-400 font-semibold">Khóa 1 (Whitelist ACL)</span>.
              Vui lòng nhập mật khẩu phòng ban <span className="text-slate-200 font-semibold">"{selectedRoom.room_name}"</span> để mở Khóa 2.
            </p>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleEnterRoom} className="space-y-4">
              <div>
                <input
                  type="password"
                  required
                  autoFocus
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="Nhập mật khẩu phòng..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoom(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Mở khóa kép & Vào phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

