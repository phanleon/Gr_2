import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Info,
  Clock,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { audioNotification } from '../../utils/audioNotification';

interface NotificationBellProps {
  onNavigate: (view: 'feed' | 'calendar' | 'approvals' | 'tasks' | 'admin' | 'audit' | 'video', id?: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { token, serverUrl } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (socket) {
      socket.on('notification:refresh', (payload: any) => {
        fetchNotifications();
        audioNotification.playNotificationPing();
      });
    }

    return () => {
      socket?.off('notification:refresh');
    };
  }, [token, serverUrl, socket]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${serverUrl}/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (n: any) => {
    if (n.is_read === 0) {
      handleMarkAsRead(n.id, { stopPropagation: () => {} } as any);
    }
    setIsOpen(false);

    if (n.link_view === 'calendar') {
      onNavigate('calendar', n.link_id);
    } else if (n.link_view === 'approvals') {
      onNavigate('approvals', n.link_id);
    } else if (n.link_view === 'tasks') {
      onNavigate('tasks', n.link_id);
    } else if (n.link_view === 'admin') {
      onNavigate('admin');
    } else if (n.link_view === 'audit') {
      onNavigate('audit');
    } else {
      onNavigate('feed', n.link_id);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'EVENT':
        return <span className="text-base">🎉</span>;
      case 'POST':
        return <span className="text-base">📢</span>;
      case 'CHAT':
        return <span className="text-base">💬</span>;
      case 'SECURITY':
        return <span className="text-base">🛡️</span>;
      default:
        return <span className="text-base">🔔</span>;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl transition relative ${
          isOpen
            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
            : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800'
        }`}
        title="Trung tâm thông báo thời gian thực"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full text-[9px] font-black shadow-md shadow-rose-950/80 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center space-x-2">
              <span className="text-base">🔔</span>
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Thông Báo ({unreadCount} mới)
              </span>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đọc hết</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                <Bell className="w-8 h-8 mx-auto text-slate-700 stroke-1" />
                <p>Không có thông báo mới nào</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 transition cursor-pointer flex items-start space-x-3 text-left ${
                    n.is_read === 0
                      ? 'bg-purple-950/20 hover:bg-purple-950/40'
                      : 'hover:bg-slate-800/40 opacity-75'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
                    {getNotifIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-slate-200 truncate">
                        {n.title}
                      </span>
                      {n.is_read === 0 && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0 ml-1.5" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                      • {new Date(n.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {n.is_read === 0 && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="p-1 text-slate-500 hover:text-purple-400 shrink-0"
                      title="Đánh dấu đã đọc"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

