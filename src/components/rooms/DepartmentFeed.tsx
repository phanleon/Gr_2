import React, { useState, useEffect } from 'react';
import {
  FileText,
  Send,
  Sparkles,
  Paperclip,
  Image,
  RefreshCw,
  Clock,
  User,
  Shield,
  Layers,
  Heart,
  MessageCircle,
  Share2,
  Smile,
  Megaphone,
  PartyPopper,
  Flame,
  Star,
  CheckCircle2,
  BarChart2,
  PlusCircle,
  X,
  Calendar,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

interface DepartmentFeedProps {
  roomId: string | null; // null = Global Channel
  roomName: string;
  onOpenCalendar?: () => void;
}

export const DepartmentFeed: React.FC<DepartmentFeedProps> = ({ roomId, roomName, onOpenCalendar }) => {
  const { token, serverUrl, user } = useAuth();
  const { socket } = useSocket();

  const [posts, setPosts] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postCategory, setPostCategory] = useState<'EVENT' | 'NOTICE' | 'IDEA' | 'PROGRESS' | 'RELAX'>('EVENT');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summarizingPostId, setSummarizingPostId] = useState<string | null>(null);

  // Poll Form State
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Đồng ý', 'Cần thảo luận thêm']);

  // Local Reactions State (Likes, Claps, Stars)
  const [reactions, setReactions] = useState<{ [postId: string]: { [type: string]: number } }>({});
  const [userReacted, setUserReacted] = useState<{ [postId: string]: string }>({});

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const endpoint = roomId ? `${serverUrl}/api/feed/${roomId}` : `${serverUrl}/api/feed/global`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUpcomingEvents((data.events || []).slice(0, 3));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchUpcomingEvents();

    if (socket) {
      socket.on('feed:new_post', (post: any) => {
        if (!roomId || post.room_id === roomId) {
          setPosts((prev) => [post, ...prev]);
        }
      });

      socket.on('feed:poll_voted', ({ pollId, updatedPoll }: any) => {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.poll && p.poll.id === pollId) {
              return { ...p, poll: updatedPoll };
            }
            return p;
          })
        );
      });

      socket.on('calendar:new_event', () => fetchUpcomingEvents());
    }

    return () => {
      socket?.off('feed:new_post');
      socket?.off('feed:poll_voted');
      socket?.off('calendar:new_event');
    };
  }, [roomId, token, serverUrl, socket]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const finalTitle = title.trim() || (
      postCategory === 'EVENT' ? '🎉 Sự kiện mới toàn công ty' :
      postCategory === 'NOTICE' ? '📢 Thông báo quan trọng' :
      postCategory === 'IDEA' ? '💡 Ý tưởng & Sáng kiến mới' :
      postCategory === 'PROGRESS' ? '🚀 Báo cáo tiến độ dự án' : '☕ Góc thư giãn & trò chuyện'
    );

    const pollPayload =
      isPollOpen && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2
        ? {
            question: pollQuestion.trim(),
            options: pollOptions.filter((o) => o.trim()),
          }
        : null;

    try {
      const res = await fetch(`${serverUrl}/api/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: finalTitle,
          content,
          room_id: roomId,
          media_files: [],
          poll: pollPayload,
        }),
      });

      if (res.ok) {
        setTitle('');
        setContent('');
        setIsPollOpen(false);
        setPollQuestion('');
        setPollOptions(['Đồng ý', 'Cần thảo luận thêm']);
        fetchFeed();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVotePoll = async (pollId: string, optionIndex: number) => {
    try {
      const res = await fetch(`${serverUrl}/api/feed/polls/${pollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ optionIndex }),
      });
      if (res.ok) {
        fetchFeed();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAiSummary = async (post: any) => {
    setSummarizingPostId(post.id);
    try {
      const res = await fetch(`${serverUrl}/api/ai/summarize-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          title: post.title,
          content: post.content,
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, ai_summary: data.summary } : p))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizingPostId(null);
    }
  };

  const handleReact = (postId: string, type: string) => {
    setUserReacted((prev) => ({
      ...prev,
      [postId]: prev[postId] === type ? '' : type,
    }));
    setReactions((prev) => {
      const postReactions = prev[postId] || { heart: 8, clap: 5, star: 3 };
      const current = postReactions[type] || 0;
      return {
        ...prev,
        [postId]: {
          ...postReactions,
          [type]: userReacted[postId] === type ? Math.max(0, current - 1) : current + 1,
        },
      };
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* 🌟 1. BANNER SỰ KIỆN NỔI BẬT CHÍNH GIỮA */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-pink-950/50 border border-purple-500/30 rounded-3xl p-5 md:p-6 shadow-2xl space-y-3">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-pink-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md flex items-center space-x-1.5 animate-pulse">
              <PartyPopper className="w-3.5 h-3.5" />
              <span>SỰ KIỆN NỔI BẬT TOÀN THỂ</span>
            </span>
            <span className="text-xs text-purple-300 font-semibold hidden sm:inline">
              ✨ Tin tức mới nhất hôm nay
            </span>
          </div>

          <button
            onClick={() => { fetchFeed(); fetchUpcomingEvents(); }}
            disabled={isLoading}
            className="p-1.5 text-purple-300 hover:text-white bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/50 rounded-xl transition"
            title="Làm mới bảng tin"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative z-10 space-y-1.5">
          <h1 className="text-base md:text-lg font-black text-slate-100 tracking-tight flex items-center space-x-2">
            <span>🎉 Chào mừng toàn thể thành viên đến với Secure Remote Workspace!</span>
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            Hệ thống Không Gian Làm Việc Bảo Mật Zero-Trust chính thức đi vào hoạt động thông suốt xuyên qua mạng Internet toàn cầu với $0 chi phí. Mọi thông báo sự kiện, tiến độ dự án, tài liệu và các cuộc gọi video đều được mã hóa an toàn tuyệt đối. Chúc toàn thể anh chị em một tuần làm việc tràn đầy năng lượng và sáng tạo! 🚀
          </p>
        </div>

        {/* Reaction Buttons on Banner */}
        <div className="relative z-10 pt-2 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => handleReact('featured_banner', 'heart')}
            className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 transition ${
              userReacted['featured_banner'] === 'heart'
                ? 'bg-rose-500 text-white border-rose-400 font-bold'
                : 'bg-purple-950/60 hover:bg-purple-900/80 text-rose-300 border-purple-800/60'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${userReacted['featured_banner'] === 'heart' ? 'fill-white' : 'fill-rose-400'}`} />
            <span>Thả tim ({reactions['featured_banner']?.heart || 24})</span>
          </button>

          <button
            onClick={() => handleReact('featured_banner', 'clap')}
            className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 transition ${
              userReacted['featured_banner'] === 'clap'
                ? 'bg-yellow-500 text-slate-950 border-yellow-400 font-bold'
                : 'bg-purple-950/60 hover:bg-purple-900/80 text-yellow-300 border-purple-800/60'
            }`}
          >
            <span>👏 Hoan hô ({reactions['featured_banner']?.clap || 18})</span>
          </button>

          <button
            onClick={() => handleReact('featured_banner', 'star')}
            className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 transition ${
              userReacted['featured_banner'] === 'star'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-purple-950/60 hover:bg-purple-900/80 text-amber-300 border-purple-800/60'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span>Tuyệt vời ({reactions['featured_banner']?.star || 15})</span>
          </button>
        </div>
      </div>

      {/* 📅 MINI CAROUSEL: SỰ KIỆN SẮP DIỄN RA */}
      {upcomingEvents.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-base">📅</span>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Lịch Sự Kiện Sắp Diễn Ra
              </span>
            </div>

            {onOpenCalendar && (
              <button
                onClick={onOpenCalendar}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center space-x-1 transition"
              >
                <span>Xem tất cả lịch</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {upcomingEvents.map((evt) => {
              const dateObj = new Date(evt.event_date);
              const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

              return (
                <div
                  key={evt.id}
                  onClick={onOpenCalendar}
                  className="p-3 bg-slate-950 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl transition cursor-pointer space-y-1.5 group"
                >
                  <div className="flex items-center justify-between text-[10px] text-purple-300 font-mono">
                    <span className="font-bold bg-purple-950/80 px-2 py-0.5 rounded-lg border border-purple-800/50">
                      {dateStr} • {timeStr}
                    </span>
                    <span className="text-slate-500 group-hover:text-purple-400 transition">➡️</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-purple-200 transition">
                    {evt.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {evt.description || 'Sự kiện nội bộ toàn công ty'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 📝 2. HỘP ĐĂNG BÀI & BÌNH CHỌN (POLL) */}
      <form
        onSubmit={handleCreatePost}
        className="p-4 md:p-5 bg-slate-900 border border-slate-800/90 rounded-3xl shadow-xl space-y-3"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 p-0.5 shadow-md shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xs font-bold text-purple-300">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-200">
              {user?.full_name} <span className="font-normal text-slate-400 font-mono">(@{user?.username})</span>
            </div>
            <div className="text-[11px] text-purple-400 font-medium">
              Đang đăng tại: <span className="underline font-semibold">{roomName}</span>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
          <button
            type="button"
            onClick={() => setPostCategory('EVENT')}
            className={`px-2.5 py-1 rounded-xl transition flex items-center space-x-1 ${
              postCategory === 'EVENT'
                ? 'bg-purple-600 text-white font-bold'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>🎉 Sự kiện</span>
          </button>

          <button
            type="button"
            onClick={() => setPostCategory('NOTICE')}
            className={`px-2.5 py-1 rounded-xl transition flex items-center space-x-1 ${
              postCategory === 'NOTICE'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>📢 Thông báo</span>
          </button>

          <button
            type="button"
            onClick={() => setPostCategory('IDEA')}
            className={`px-2.5 py-1 rounded-xl transition flex items-center space-x-1 ${
              postCategory === 'IDEA'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>💡 Sáng kiến</span>
          </button>

          <button
            type="button"
            onClick={() => setPostCategory('PROGRESS')}
            className={`px-2.5 py-1 rounded-xl transition flex items-center space-x-1 ${
              postCategory === 'PROGRESS'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>🚀 Tiến độ</span>
          </button>

          <button
            type="button"
            onClick={() => setPostCategory('RELAX')}
            className={`px-2.5 py-1 rounded-xl transition flex items-center space-x-1 ${
              postCategory === 'RELAX'
                ? 'bg-pink-600 text-white font-bold'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>☕ Trò chuyện</span>
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề bài viết (tùy chọn)..."
          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
        />

        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Chào ${user?.full_name || 'bạn'}! Hôm nay bạn có sự kiện, tiến độ hay ý tưởng gì mới muốn chia sẻ cùng mọi người không? ✨`}
          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none transition leading-relaxed"
        />

        {/* Poll Builder Section */}
        {isPollOpen && (
          <div className="p-4 bg-slate-950 border border-purple-500/30 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                <BarChart2 className="w-4 h-4 text-purple-400" />
                <span>Thăm dò ý kiến / Bình chọn (Poll)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsPollOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Câu hỏi bình chọn (Ví dụ: Địa điểm tổ chức Year-End Party?)..."
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            />

            <div className="space-y-2">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 w-4 font-mono">{idx + 1}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[idx] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                    placeholder={`Lựa chọn ${idx + 1}...`}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 5 && (
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ''])}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center space-x-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Thêm lựa chọn</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            {!isPollOpen && (
              <button
                type="button"
                onClick={() => setIsPollOpen(true)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                <span>+ Thêm bình chọn</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!content.trim()}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition shadow-lg shadow-purple-900/30"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Đăng bài viết</span>
          </button>
        </div>
      </form>

      {/* 📰 3. DÒNG THỜI GIAN BÀI VIẾT (TIMELINE FEED) */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="p-5 bg-slate-900/95 border border-slate-800/80 hover:border-purple-500/30 rounded-3xl shadow-xl space-y-3 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5 shrink-0">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xs font-bold text-purple-300">
                    {post.author_name?.charAt(0) || 'U'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                    <span>{post.author_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-400 font-medium">
                      {post.author_role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(post.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              </div>

              {!post.ai_summary && (
                <button
                  onClick={() => handleGenerateAiSummary(post)}
                  disabled={summarizingPostId === post.id}
                  className="px-3 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                >
                  {summarizingPostId === post.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  )}
                  <span>✨ AI Tóm tắt 3 ý</span>
                </button>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-1.5">{post.title}</h3>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{post.content}</p>
            </div>

            {/* Interactive Poll Display */}
            {post.poll && (
              <div className="p-4 bg-slate-950 border border-purple-500/30 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <BarChart2 className="w-4 h-4 text-purple-400" />
                    <span>{post.poll.question}</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {post.poll.totalVotes} lượt bình chọn
                  </span>
                </div>

                <div className="space-y-2">
                  {post.poll.options.map((opt: string, idx: number) => {
                    const votes = post.poll.votesCount[idx] || 0;
                    const percent = post.poll.totalVotes > 0 ? Math.round((votes / post.poll.totalVotes) * 100) : 0;
                    const isVotedByUser = post.poll.userVotedIndex === idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleVotePoll(post.poll.id, idx)}
                        className={`w-full relative overflow-hidden p-2.5 rounded-xl text-left border transition ${
                          isVotedByUser
                            ? 'border-purple-500 bg-purple-950/40 text-purple-200 font-bold'
                            : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        {/* Progress Bar Background */}
                        <div
                          className="absolute inset-y-0 left-0 bg-purple-600/20 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />

                        <div className="relative z-10 flex items-center justify-between text-xs">
                          <span className="flex items-center space-x-2">
                            {isVotedByUser && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                            <span>{opt}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {percent}% ({votes})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Executive Summary Card */}
            {post.ai_summary && (
              <div className="p-3.5 bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-slate-900 border border-purple-800/40 rounded-2xl space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-300">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Trợ lý AI phân tích & tóm tắt 3 điểm trọng yếu:</span>
                </div>
                <div className="text-xs text-purple-200 whitespace-pre-line font-medium leading-relaxed pl-2 border-l-2 border-purple-500">
                  {post.ai_summary}
                </div>
              </div>
            )}

            {/* Post Reactions Bar */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleReact(post.id, 'heart')}
                  className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 transition ${
                    userReacted[post.id] === 'heart'
                      ? 'bg-rose-950/80 text-rose-400 font-bold'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${userReacted[post.id] === 'heart' ? 'fill-rose-400' : ''}`} />
                  <span>{reactions[post.id]?.heart || 6}</span>
                </button>

                <button
                  onClick={() => handleReact(post.id, 'clap')}
                  className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 transition ${
                    userReacted[post.id] === 'clap'
                      ? 'bg-yellow-950/80 text-yellow-400 font-bold'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>👏</span>
                  <span>{reactions[post.id]?.clap || 4}</span>
                </button>

                <button
                  onClick={() => handleReact(post.id, 'star')}
                  className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 transition ${
                    userReacted[post.id] === 'star'
                      ? 'bg-purple-950/80 text-purple-400 font-bold'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${userReacted[post.id] === 'star' ? 'fill-yellow-400' : ''}`} />
                  <span>{reactions[post.id]?.star || 2}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                💬 Trao đổi tại khung Chat bên phải
              </div>
            </div>
          </div>
        ))}

        {posts.length === 0 && !isLoading && (
          <div className="py-12 text-center space-y-2 bg-slate-900/60 rounded-3xl border border-slate-800">
            <span className="text-3xl">☕</span>
            <p className="text-xs text-slate-400">
              Chưa có bài viết nào trong bảng tin này. Hãy là người đầu tiên chia sẻ sự kiện nhé!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
