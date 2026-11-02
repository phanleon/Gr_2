import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Calendar,
  X,
  Sparkles,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export const ProjectTaskBoardView: React.FC = () => {
  const { token, serverUrl, user } = useAuth();
  const { socket } = useSocket();

  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedRoomId
        ? `${serverUrl}/api/tasks?roomId=${selectedRoomId}`
        : `${serverUrl}/api/tasks`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [roomsRes, usersRes] = await Promise.all([
        fetch(`${serverUrl}/api/rooms/lobby`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${serverUrl}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setAvailableRooms(roomsData.rooms || []);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAvailableUsers(usersData.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchMeta();

    if (socket) {
      socket.on('task:new', () => fetchTasks());
      socket.on('task:status_changed', () => fetchTasks());
      socket.on('task:deleted', () => fetchTasks());
    }

    return () => {
      socket?.off('task:new');
      socket?.off('task:status_changed');
      socket?.off('task:deleted');
    };
  }, [selectedRoomId, token, serverUrl, socket]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Vui lòng nhập tiêu đề nhiệm vụ.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`${serverUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority,
          room_id: newRoomId || null,
          assignee_id: newAssigneeId || null,
          due_date: newDueDate ? new Date(newDueDate).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewDueDate('');
        setNewAssigneeId('');
        setNewRoomId('');
        fetchTasks();
      } else {
        setFormError(data.error || 'Lỗi tạo nhiệm vụ');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE') => {
    try {
      await fetch(`${serverUrl}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    try {
      await fetch(`${serverUrl}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityBadge = (pr: string) => {
    switch (pr) {
      case 'URGENT':
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">⚡ Khẩn cấp</span>;
      case 'HIGH':
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/40">Cao</span>;
      case 'LOW':
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-500/20 text-slate-400 border border-slate-500/40">Thấp</span>;
      default:
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">Trung bình</span>;
    }
  };

  const columns: { key: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'; label: string; emoji: string; color: string }[] = [
    { key: 'TODO', label: 'Cần Làm (To-Do)', emoji: '📌', color: 'border-slate-800' },
    { key: 'IN_PROGRESS', label: 'Đang Triển Khai', emoji: '⚡', color: 'border-indigo-800/60' },
    { key: 'REVIEW', label: 'Chờ Nghiệm Thu', emoji: '🔍', color: 'border-amber-800/60' },
    { key: 'DONE', label: 'Hoàn Thành', emoji: '✅', color: 'border-emerald-800/60' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-100 flex items-center space-x-2.5">
            <span className="text-2xl">🎯</span>
            <span>Bảng Quản Lý Dự Án & Nhiệm Vụ (Agile Kanban)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Theo dõi tiến độ theo phòng ban, phân công nhiệm vụ và cập nhật trạng thái thời gian thực
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Room Filter Dropdown */}
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">Tất cả phòng ban & dự án</option>
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name} ({r.room_code})
              </option>
            ))}
          </select>

          <button
            onClick={fetchTasks}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
            title="Làm mới danh sách nhiệm vụ"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-purple-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Nhiệm Vụ</span>
          </button>
        </div>
      </div>

      {/* Kanban 4-Column Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 items-start">
        {columns.map((col, colIdx) => {
          const colTasks = tasks.filter((t) => t.status === col.key);

          return (
            <div
              key={col.key}
              className={`bg-slate-900/80 border ${col.color} rounded-2xl p-3.5 space-y-3 flex flex-col min-h-[420px]`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span>{col.emoji}</span>
                  <span className="text-xs font-bold text-slate-200 tracking-wide">
                    {col.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List in Column */}
              <div className="space-y-2.5 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-slate-500 italic">
                    Chưa có nhiệm vụ
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/40 rounded-xl space-y-2 transition group shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-1">
                        {getPriorityBadge(task.priority)}

                        <div className="flex items-center space-x-1">
                          {(user?.role === 'SERVER_ADMIN' || user?.id === task.creator_id) && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-slate-500 hover:text-rose-400 p-0.5"
                              title="Xóa nhiệm vụ"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 leading-snug">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      <div className="pt-1 border-t border-slate-900 flex flex-wrap items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate max-w-[120px] text-purple-300 font-medium">
                          👤 {task.assignee_name || 'Chưa gán'}
                        </span>

                        {task.due_date && (
                          <span className="font-mono text-slate-400 flex items-center space-x-1">
                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                            <span>{new Date(task.due_date).toLocaleDateString('vi-VN')}</span>
                          </span>
                        )}
                      </div>

                      {/* Move Column Shortcut Buttons */}
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        {colIdx > 0 ? (
                          <button
                            onClick={() => handleUpdateStatus(task.id, columns[colIdx - 1].key)}
                            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-md flex items-center space-x-1 transition"
                            title="Chuyển về trạng thái trước"
                          >
                            <ArrowLeft className="w-2.5 h-2.5" />
                            <span>Lùi</span>
                          </button>
                        ) : <span />}

                        {colIdx < columns.length - 1 && (
                          <button
                            onClick={() => handleUpdateStatus(task.id, columns[colIdx + 1].key)}
                            className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 rounded-md flex items-center space-x-1 transition ml-auto font-semibold"
                            title="Chuyển sang trạng thái tiếp theo"
                          >
                            <span>Tiếp</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🎯</span>
                <h3 className="text-sm font-bold text-slate-100">Thêm Nhiệm Vụ Mới Vào Bảng Kanban</h3>
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

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tiêu đề nhiệm vụ *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Nâng cấp phiên bản CSDL, Triển khai diễn tập bảo mật..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">⚡ Khẩn cấp</option>
                    <option value="LOW">Thấp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Hạn chót hoàn thành
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gán cho thành viên
                  </label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Chưa gán (Bất kỳ ai)</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.username})
                      </option>
                    ))}
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
                  Mô tả chi tiết công việc
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Ghi rõ yêu cầu nghiệm thu, tài liệu liên quan..."
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
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Nhiệm Vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

