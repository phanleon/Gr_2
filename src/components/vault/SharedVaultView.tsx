import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Lock,
  Shield,
  RefreshCw,
  Search,
  Server,
  FileCode,
  FileKey,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export const SharedVaultView: React.FC = () => {
  const { token, serverUrl, user } = useAuth();
  const { socket } = useSocket();

  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [visibleSecrets, setVisibleSecrets] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'CREDENTIAL' | 'API_KEY' | 'SERVER_ACCESS' | 'LICENSE' | 'NOTE'>('CREDENTIAL');
  const [newUsernameOrKey, setNewUsernameOrKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchVault = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/vault`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/rooms/lobby`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableRooms(data.rooms || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVault();
    fetchRooms();

    if (socket) {
      socket.on('vault:item_added', () => fetchVault());
      socket.on('vault:item_deleted', () => fetchVault());
    }

    return () => {
      socket?.off('vault:item_added');
      socket?.off('vault:item_deleted');
    };
  }, [token, serverUrl, socket]);

  const handleCreateVaultItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSecretValue.trim()) {
      setFormError('Vui lòng nhập đầy đủ tiêu đề và giá trị bí mật.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`${serverUrl}/api/vault`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          username_or_key: newUsernameOrKey.trim(),
          secret_value: newSecretValue.trim(),
          description: newDescription.trim(),
          room_id: newRoomId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setNewTitle('');
        setNewUsernameOrKey('');
        setNewSecretValue('');
        setNewDescription('');
        setNewRoomId('');
        fetchVault();
      } else {
        setFormError(data.error || 'Lỗi lưu trữ bí mật');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bí mật này khỏi Két dùng chung?')) return;
    try {
      await fetch(`${serverUrl}/api/vault/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchVault();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopySecret = (id: string, value: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'SERVER_ACCESS':
        return { label: '💻 Truy cập máy chủ', icon: <Server className="w-4 h-4 text-emerald-400" /> };
      case 'API_KEY':
        return { label: '⚡ API Key & Token', icon: <FileCode className="w-4 h-4 text-amber-400" /> };
      case 'LICENSE':
        return { label: '📜 Bản quyền phần mềm', icon: <FileKey className="w-4 h-4 text-indigo-400" /> };
      case 'NOTE':
        return { label: '📝 Ghi chú bí mật', icon: <Shield className="w-4 h-4 text-pink-400" /> };
      default:
        return { label: '🔑 Tài khoản & Mật khẩu', icon: <KeyRound className="w-4 h-4 text-purple-400" /> };
    }
  };

  const filteredItems = items.filter((item) => {
    const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.username_or_key && item.username_or_key.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-100 flex items-center space-x-2.5">
            <span className="text-2xl">🔐</span>
            <span>Két Mật Khẩu & Bí Mật Dùng Chung (Shared Vault)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Lưu trữ và chia sẻ an toàn tài khoản máy chủ, API key, chứng chỉ nội bộ chuẩn phân quyền Zero-Trust
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchVault}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
            title="Làm mới Két"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {(user?.role === 'SERVER_ADMIN' || user?.role === 'ROOM_OWNER') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-purple-900/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Bí Mật Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm tài khoản, API key, máy chủ..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'CREDENTIAL', label: '🔑 Tài khoản' },
            { key: 'API_KEY', label: '⚡ API Key' },
            { key: 'SERVER_ACCESS', label: '💻 Máy chủ' },
            { key: 'LICENSE', label: '📜 Bản quyền' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                categoryFilter === f.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vault Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800">
            <Lock className="w-10 h-10 mx-auto text-slate-700 stroke-1 mb-2" />
            <p className="font-semibold text-slate-400">Két bí mật đang trống hoặc không có mục nào khớp tìm kiếm</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Admin hoặc Trưởng phòng có thể bấm "Thêm Bí Mật Mới" để chia sẻ thông tin tài khoản cho phòng ban.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const catInfo = getCategoryDetails(item.category);
            const isVisible = visibleSecrets[item.id] || false;
            const isCopied = copiedId === item.id;
            const canManage = user?.role === 'SERVER_ADMIN' || user?.role === 'ROOM_OWNER';

            return (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 space-y-3 hover:border-purple-500/40 transition group shadow-md"
              >
                {/* Header of Item */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl shrink-0">
                      {catInfo.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs md:text-sm font-bold text-slate-100 truncate">
                        {item.title}
                      </h3>
                      <div className="text-[10px] text-purple-300 font-medium">
                        Phòng: {item.room_name || 'Toàn Công Ty'} • Tạo bởi: {item.creator_name}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="Xóa bí mật này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Username / Key row */}
                {item.username_or_key && (
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">Tên đăng nhập / Khóa:</span>
                    <span className="text-slate-200 font-bold select-all">{item.username_or_key}</span>
                  </div>
                )}

                {/* Secret Value Row */}
                <div className="p-2.5 bg-slate-950 border border-purple-500/30 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 font-mono text-xs">
                    {isVisible ? (
                      <span className="text-emerald-300 font-bold break-all select-all">{item.secret_value}</span>
                    ) : (
                      <span className="text-slate-500 tracking-widest">••••••••••••••••••••</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => toggleVisibility(item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition"
                      title={isVisible ? 'Ẩn bí mật' : 'Hiện bí mật'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleCopySecret(item.id, item.secret_value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition border ${
                        isCopied
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-purple-950/80 hover:bg-purple-900 text-purple-200 border-purple-800/60'
                      }`}
                      title="Sao chép mật khẩu / bí mật vào bộ nhớ tạm"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-purple-400" />}
                      <span>{isCopied ? 'Đã chép!' : 'Chép'}</span>
                    </button>
                  </div>
                </div>

                {item.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add Vault Secret */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🔐</span>
                <h3 className="text-sm font-bold text-slate-100">Lưu Trữ Bí Mật Mới Vào Két Dùng Chung</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateVaultItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tiêu đề mục bí mật *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Tài khoản máy chủ Database, AWS S3 API Token..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Danh mục bí mật
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="CREDENTIAL">🔑 Tài khoản & Mật khẩu</option>
                    <option value="API_KEY">⚡ API Key & Token</option>
                    <option value="SERVER_ACCESS">💻 Truy cập máy chủ SSH/RDP</option>
                    <option value="LICENSE">📜 Bản quyền phần mềm</option>
                    <option value="NOTE">📝 Ghi chú bí mật</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thuộc phòng ban
                  </label>
                  <select
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Toàn Công Ty / Chung</option>
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_name} ({r.room_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tên đăng nhập / Mã khóa (Username / Key ID)
                </label>
                <input
                  type="text"
                  value={newUsernameOrKey}
                  onChange={(e) => setNewUsernameOrKey(e.target.value)}
                  placeholder="Ví dụ: root, admin_dev, AKIAIOSFODNN7EXAMPLE..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật khẩu / Giá trị bí mật (Password / Secret Value) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  placeholder="Nhập mật khẩu hoặc chuỗi bí mật..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mô tả hướng dẫn sử dụng
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Ghi chú IP máy chủ kết nối, cổng dịch vụ, lưu ý khi đăng nhập..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Vào Két An Toàn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

