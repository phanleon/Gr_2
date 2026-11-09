import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Pin,
  Eye,
  User,
  Sparkles,
  Edit2,
  Trash2,
  X,
  FileText,
  Shield,
  Layers,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const KnowledgeBaseView: React.FC = () => {
  const { user, token, serverUrl } = useAuth();
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeArticle, setActiveArticle] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('ONBOARDING');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIsPinned, setEditIsPinned] = useState(false);

  const categories = [
    { id: 'ALL', name: 'Tất Cả Tài Liệu', icon: '🌐' },
    { id: 'ONBOARDING', name: 'Nhập Môn & Hội Nhập', icon: '🚀' },
    { id: 'SECURITY', name: 'Chính Sách Bảo Mật', icon: '🛡️' },
    { id: 'TECH_SOP', name: 'Quy Trình Kỹ Thuật (SOP)', icon: '💻' },
    { id: 'HR_POLICY', name: 'Nội Quy & Chế Độ Nhân Sự', icon: '👥' },
    { id: 'GENERAL', name: 'Cẩm Nang Chung', icon: '📑' },
  ];

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const url = new URL(`${serverUrl}/api/wiki/articles`);
      if (selectedCategory !== 'ALL') url.searchParams.set('category', selectedCategory);
      if (searchTerm) url.searchParams.set('search', searchTerm);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        if (data.articles?.length > 0 && (!activeArticle || !data.articles.find((a: any) => a.id === activeArticle.id))) {
          loadArticleDetail(data.articles[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadArticleDetail = async (id: string) => {
    try {
      setAiSummary(null);
      const res = await fetch(`${serverUrl}/api/wiki/articles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveArticle(data.article);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [token, serverUrl, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles();
  };

  const handleOpenCreateModal = () => {
    setEditingArticleId(null);
    setEditCategory('ONBOARDING');
    setEditTitle('');
    setEditContent('');
    setEditIsPinned(false);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (article: any) => {
    setEditingArticleId(article.id);
    setEditCategory(article.category);
    setEditTitle(article.title);
    setEditContent(article.content);
    setEditIsPinned(article.is_pinned === 1);
    setIsEditorOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingArticleId
        ? `${serverUrl}/api/wiki/articles/${editingArticleId}`
        : `${serverUrl}/api/wiki/articles`;
      const method = editingArticleId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: editCategory,
          title: editTitle,
          content: editContent,
          isPinned: editIsPinned,
        }),
      });

      if (res.ok) {
        setIsEditorOpen(false);
        fetchArticles();
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi lưu bài viết');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết cẩm nang này?')) return;
    try {
      const res = await fetch(`${serverUrl}/api/wiki/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActiveArticle(null);
        fetchArticles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAiSummarize = async () => {
    if (!activeArticle) return;
    setIsSummarizing(true);
    try {
      const res = await fetch(`${serverUrl}/api/wiki/articles/${activeArticle.id}/ai-summarize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden text-slate-100 select-none">
      {/* Top Header */}
      <div className="p-4 md:px-6 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span>Thư Viện Kiến Thức & Cẩm Nang Doanh Nghiệp (Wiki)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                Knowledge Base
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Quy chuẩn làm việc (SOP), hướng dẫn nhân viên mới và chính sách an toàn thông tin nội bộ
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {(user?.role === 'SERVER_ADMIN' || user?.role === 'ROOM_OWNER') && (
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Viết Bài Mới</span>
            </button>
          )}

          <button
            onClick={fetchArticles}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Sidebar Categories & Article Viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sub-Sidebar: Categories & Article List */}
        <div className="w-80 md:w-96 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm quy trình, hướng dẫn..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </form>

          {/* Categories Pill Horizontal Scroller */}
          <div className="p-2 border-b border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition flex items-center space-x-1 ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Articles List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {articles.map((art) => {
              const isSelected = activeArticle?.id === art.id;
              return (
                <div
                  key={art.id}
                  onClick={() => loadArticleDetail(art.id)}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition flex items-start justify-between group ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-md'
                      : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-1.5">
                      {art.is_pinned === 1 && (
                        <span className="p-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                          <Pin className="w-3 h-3" />
                        </span>
                      )}
                      <h4 className="text-xs font-bold truncate text-slate-100 group-hover:text-purple-300 transition">
                        {art.title}
                      </h4>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
                      <span>{art.author_name}</span>
                      <span>•</span>
                      <span>{art.view_count || 0} lượt xem</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition shrink-0 mt-0.5" />
                </div>
              );
            })}

            {articles.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                Chưa có tài liệu nào trong chuyên mục này
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Article Reader & AI Summary */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950">
          {activeArticle ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header Info */}
              <div className="pb-4 border-b border-slate-800 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                      {activeArticle.category}
                    </span>
                    {activeArticle.is_pinned === 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <Pin className="w-3 h-3" />
                        <span>Ghim Bắt Buộc Đọc</span>
                      </span>
                    )}
                  </div>

                  <h1 className="text-base md:text-xl font-bold text-slate-100">
                    {activeArticle.title}
                  </h1>

                  <div className="text-xs text-slate-400 flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{activeArticle.author_name}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>{activeArticle.view_count} lượt xem</span>
                    </span>
                    <span>•</span>
                    <span>Cập nhật: {new Date(activeArticle.updated_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleAiSummarize}
                    disabled={isSummarizing}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                    <span>{isSummarizing ? 'Đang đọc...' : 'AI Tóm Tắt Nhanh'}</span>
                  </button>

                  {(user?.role === 'SERVER_ADMIN' || user?.id === activeArticle.author_id) && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(activeArticle)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                        title="Sửa bài viết"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteArticle(activeArticle.id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl transition"
                        title="Xóa bài viết"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* AI Summary Banner */}
              {aiSummary && (
                <div className="p-4 bg-purple-950/40 border border-purple-500/40 rounded-2xl animate-in fade-in space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-200 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Trợ Lý AI Tóm Lược Quy Trình Cốt Lõi</span>
                    </span>
                    <button
                      onClick={() => setAiSummary(null)}
                      className="text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                    {aiSummary}
                  </div>
                </div>
              )}

              {/* Markdown Content Body */}
              <div className="text-xs md:text-sm text-slate-300 leading-relaxed space-y-4 whitespace-pre-wrap selection:bg-purple-600/30 font-sans">
                {activeArticle.content}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <BookOpen className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-xs">Chọn một bài viết cẩm nang bên trái để xem nội dung chi tiết</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleSaveArticle}
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>📚</span>
                <span>{editingArticleId ? 'Chỉnh Sửa Bài Viết Cẩm Nang' : 'Soạn Bài Viết Cẩm Nang Mới'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Chuyên Mục</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="ONBOARDING">🚀 Nhập Môn Onboarding</option>
                  <option value="SECURITY">🛡️ Chính Sách Bảo Mật</option>
                  <option value="TECH_SOP">💻 Quy Trình Kỹ Thuật (SOP)</option>
                  <option value="HR_POLICY">👥 Nội Quy Nhân Sự</option>
                  <option value="GENERAL">📑 Cẩm Nang Chung</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsPinned}
                    onChange={(e) => setEditIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 bg-slate-950 border-slate-800"
                  />
                  <span className="text-xs text-slate-200 font-semibold flex items-center space-x-1">
                    <Pin className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ghim bắt buộc nhân sự mới đọc</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold">Tiêu Đề Bài Viết</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="VD: Hướng dẫn cấu hình môi trường phát triển & SSH..."
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold">Nội Dung Cẩm Nang (Định dạng Markdown)</label>
              <textarea
                required
                rows={10}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="# Tiêu đề lớn&#10;&#10;Nội dung hướng dẫn chi tiết theo từng bước..."
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Xuất Bản Bài Viết
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

