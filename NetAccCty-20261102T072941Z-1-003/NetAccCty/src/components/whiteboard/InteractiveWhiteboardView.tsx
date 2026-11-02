import React, { useState, useRef, useEffect } from 'react';
import {
  PenTool,
  Eraser,
  Highlighter,
  Square,
  Circle,
  Minus,
  StickyNote,
  Download,
  Save,
  Trash2,
  Users,
  Palette,
  Sparkles,
  Share2,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

interface WhiteboardProps {
  roomId: string | null;
  roomName: string;
}

interface StickyNoteItem {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export const InteractiveWhiteboardView: React.FC<WhiteboardProps> = ({ roomId, roomName }) => {
  const { user, token, serverUrl } = useAuth();
  const { socket } = useSocket();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Tool states
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'circle'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#a855f7');
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Sticky notes state
  const [stickyNotes, setStickyNotes] = useState<StickyNoteItem[]>([]);
  const [activeStickyId, setActiveStickyId] = useState<string | null>(null);

  // Remote collaborators pointer cursors
  const [remoteCursors, setRemoteCursors] = useState<{ [userId: string]: { x: number; y: number; userName: string } }>({});

  // Whiteboard metadata
  const [boardTitle, setBoardTitle] = useState(`Ý Tưởng Họp - ${roomName}`);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);

  // Preset Colors
  const colors = [
    '#ffffff', // White
    '#a855f7', // Purple
    '#6366f1', // Indigo
    '#38bdf8', // Sky Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f43f5e', // Rose
  ];

  // Initialize Canvas Size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill dark background
        ctx.fillStyle = '#0f172a'; // slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Socket.io Real-time Collaborative Synchronization
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleRemoteDraw = ({ stroke, userName }: any) => {
      drawRemoteStroke(stroke);
    };

    const handleRemoteClear = ({ userName }: any) => {
      clearLocalCanvas();
    };

    const handleRemoteCursor = ({ x, y, userId, userName }: any) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { x, y, userName },
      }));
    };

    const handleRemoteSticky = ({ note }: any) => {
      setStickyNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === note.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = note;
          return updated;
        }
        return [...prev, note];
      });
    };

    socket.on('whiteboard:draw', handleRemoteDraw);
    socket.on('whiteboard:clear', handleRemoteClear);
    socket.on('whiteboard:cursor', handleRemoteCursor);
    socket.on('whiteboard:sticky', handleRemoteSticky);

    return () => {
      socket.off('whiteboard:draw', handleRemoteDraw);
      socket.off('whiteboard:clear', handleRemoteClear);
      socket.off('whiteboard:cursor', handleRemoteCursor);
      socket.off('whiteboard:sticky', handleRemoteSticky);
    };
  }, [socket, roomId]);

  const drawRemoteStroke = (stroke: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = stroke.width || 20;
    } else if (stroke.tool === 'highlighter') {
      ctx.strokeStyle = `${stroke.color}40`; // 25% opacity
      ctx.lineWidth = stroke.width * 3;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
    }

    if (stroke.tool === 'pen' || stroke.tool === 'highlighter' || stroke.tool === 'eraser') {
      if (stroke.points && stroke.points.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0], stroke.points[1]);
        for (let i = 2; i < stroke.points.length; i += 2) {
          ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
        }
        ctx.stroke();
      }
    } else if (stroke.tool === 'rect') {
      ctx.strokeRect(stroke.x, stroke.y, stroke.w, stroke.h);
    } else if (stroke.tool === 'circle') {
      ctx.beginPath();
      ctx.ellipse(stroke.cx, stroke.cy, Math.abs(stroke.rx), Math.abs(stroke.ry), 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (stroke.tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(stroke.x1, stroke.y1);
      ctx.lineTo(stroke.x2, stroke.y2);
      ctx.stroke();
    }

    ctx.restore();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Canvas Mouse / Touch Handlers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPoint(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'eraser') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = lineWidth * 3;
    } else if (activeTool === 'highlighter') {
      ctx.strokeStyle = `${selectedColor}40`;
      ctx.lineWidth = lineWidth * 3;
    } else {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWidth;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Broadcast live collaborator cursor
    if (socket && roomId) {
      socket.emit('whiteboard:cursor', {
        roomId,
        x: coords.x,
        y: coords.y,
      });
    }

    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      // Broadcast stroke slice
      if (socket && roomId && startPoint) {
        socket.emit('whiteboard:draw', {
          roomId,
          stroke: {
            tool: activeTool,
            color: selectedColor,
            width: lineWidth,
            points: [startPoint.x, startPoint.y, coords.x, coords.y],
          },
        });
        setStartPoint(coords);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas || !startPoint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      if (socket && roomId) {
        socket.emit('whiteboard:draw', {
          roomId,
          stroke: {
            tool: 'line',
            color: selectedColor,
            width: lineWidth,
            x1: startPoint.x,
            y1: startPoint.y,
            x2: coords.x,
            y2: coords.y,
          },
        });
      }
    } else if (activeTool === 'rect') {
      const w = coords.x - startPoint.x;
      const h = coords.y - startPoint.y;
      ctx.strokeRect(startPoint.x, startPoint.y, w, h);

      if (socket && roomId) {
        socket.emit('whiteboard:draw', {
          roomId,
          stroke: {
            tool: 'rect',
            color: selectedColor,
            width: lineWidth,
            x: startPoint.x,
            y: startPoint.y,
            w,
            h,
          },
        });
      }
    } else if (activeTool === 'circle') {
      const rx = (coords.x - startPoint.x) / 2;
      const ry = (coords.y - startPoint.y) / 2;
      const cx = startPoint.x + rx;
      const cy = startPoint.y + ry;

      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
      ctx.stroke();

      if (socket && roomId) {
        socket.emit('whiteboard:draw', {
          roomId,
          stroke: {
            tool: 'circle',
            color: selectedColor,
            width: lineWidth,
            cx,
            cy,
            rx,
            ry,
          },
        });
      }
    }

    ctx.restore();
    setStartPoint(null);
  };

  // Add Sticky Note
  const handleAddStickyNote = () => {
    const newSticky: StickyNoteItem = {
      id: `sticky_${Date.now()}`,
      text: 'Ghi chú ý tưởng...',
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 150,
      color: '#fef08a', // light yellow
    };
    setStickyNotes([...stickyNotes, newSticky]);

    if (socket && roomId) {
      socket.emit('whiteboard:sticky', { roomId, note: newSticky });
    }
  };

  const handleUpdateStickyText = (id: string, text: string) => {
    const updated = stickyNotes.map((n) => (n.id === id ? { ...n, text } : n));
    setStickyNotes(updated);
    const target = updated.find((n) => n.id === id);
    if (socket && roomId && target) {
      socket.emit('whiteboard:sticky', { roomId, note: target });
    }
  };

  const handleDeleteSticky = (id: string) => {
    setStickyNotes(stickyNotes.filter((n) => n.id !== id));
  };

  // Clear Canvas
  const handleClearAll = () => {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ bảng vẽ này?')) return;
    clearLocalCanvas();
    setStickyNotes([]);
    if (socket && roomId) {
      socket.emit('whiteboard:clear', { roomId });
    }
  };

  // Save Whiteboard Snapshot
  const handleSaveSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSaving(true);
    setSaveStatusMsg(null);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const payload = {
        roomId: roomId || null,
        title: boardTitle,
        canvasData: JSON.stringify({
          stickyNotes,
          timestamp: Date.now(),
        }),
        thumbnailUrl: dataUrl,
      };

      const res = await fetch(`${serverUrl}/api/whiteboard/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveStatusMsg('Đã lưu bảng vẽ thành công!');
        setTimeout(() => setSaveStatusMsg(null), 3000);
      } else {
        alert(data.error || 'Lỗi lưu bảng vẽ');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Download Local PNG
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${boardTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden text-slate-100 select-none relative">
      {/* Top Floating Whiteboard Toolbar */}
      <div className="p-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
        {/* Left: Title & Room info */}
        <div className="flex items-center space-x-2.5">
          <span className="text-xl">🎨</span>
          <div>
            <input
              type="text"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 font-bold text-xs md:text-sm text-slate-100 focus:outline-none transition max-w-xs"
            />
            <div className="text-[10px] text-slate-400">
              Phòng: <span className="text-purple-300 font-semibold">{roomName}</span> • Đồng bộ thời gian thực
            </div>
          </div>
        </div>

        {/* Center: Drawing Tools Palette */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-xl transition ${
              activeTool === 'pen' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Bút vẽ tự do (Pen)"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('highlighter')}
            className={`p-2 rounded-xl transition ${
              activeTool === 'highlighter' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Bút dạ quang đánh dấu (Highlighter)"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-xl transition ${
              activeTool === 'eraser' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tẩy xóa (Eraser)"
          >
            <Eraser className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-slate-800 mx-1" />

          <button
            onClick={() => setActiveTool('line')}
            className={`p-2 rounded-xl transition ${
              activeTool === 'line' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Đường thẳng (Line)"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`p-2 rounded-xl transition ${
              activeTool === 'rect' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hình chữ nhật (Rectangle)"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2 rounded-xl transition ${
              activeTool === 'circle' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hình tròn / Ellipse"
          >
            <Circle className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-slate-800 mx-1" />

          {/* Color Presets */}
          <div className="flex items-center space-x-1 px-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`w-5 h-5 rounded-full transition transform hover:scale-110 ${
                  selectedColor === c ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-950 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-[1px] h-5 bg-slate-800 mx-1" />

          {/* Stroke Width Selector */}
          <select
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 rounded-lg px-1.5 py-1 focus:outline-none"
          >
            <option value="2">Mảnh (2px)</option>
            <option value="4">Vừa (4px)</option>
            <option value="8">Đậm (8px)</option>
            <option value="16">Rất Đậm (16px)</option>
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {/* Add Sticky Note */}
          <button
            onClick={handleAddStickyNote}
            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
            title="Thêm nhãn dán ghi chú (Sticky Note)"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thêm Ghi Chú</span>
          </button>

          {/* Download PNG */}
          <button
            onClick={handleDownloadPng}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
            title="Tải ảnh về máy (.PNG)"
          >
            <Download className="w-4 h-4 text-purple-400" />
          </button>

          {/* Save Snapshot */}
          <button
            onClick={handleSaveSnapshot}
            disabled={isSaving}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50"
            title="Lưu bản vẽ vào hệ thống"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Bản Vẽ'}</span>
          </button>

          {/* Clear Canvas */}
          <button
            onClick={handleClearAll}
            className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl transition border border-slate-700"
            title="Xóa trắng bảng vẽ"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save Notification Toast */}
      {saveStatusMsg && (
        <div className="absolute top-16 right-6 z-30 bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <span>✅</span>
          <span>{saveStatusMsg}</span>
        </div>
      )}

      {/* Main Interactive Drawing Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-900 cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDrawing) {
              setIsDrawing(false);
              setStartPoint(null);
            }
          }}
          className="w-full h-full block"
        />

        {/* Remote Collaborators Pointers */}
        {Object.entries(remoteCursors).map(([uid, pos]) => (
          <div
            key={uid}
            className="absolute pointer-events-none transition-all duration-75 z-20 flex items-center space-x-1"
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
            <span className="px-1.5 py-0.5 rounded-md bg-purple-950/90 border border-purple-700 text-[10px] text-purple-200 font-bold whitespace-nowrap shadow-md">
              {pos.userName}
            </span>
          </div>
        ))}

        {/* Sticky Notes Layer */}
        {stickyNotes.map((sticky) => (
          <div
            key={sticky.id}
            style={{ left: sticky.x, top: sticky.y, backgroundColor: sticky.color }}
            className="absolute w-48 p-3 rounded-2xl shadow-2xl border border-yellow-300/40 text-slate-900 cursor-move group z-10 transition-shadow hover:shadow-yellow-500/20"
          >
            <div className="flex items-center justify-between pb-1 border-b border-black/10 mb-1">
              <span className="text-[10px] font-bold text-black/60 uppercase">📌 Ý Tưởng</span>
              <button
                onClick={() => handleDeleteSticky(sticky.id)}
                className="text-black/40 hover:text-rose-600 transition"
                title="Xóa ghi chú"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <textarea
              value={sticky.text}
              onChange={(e) => handleUpdateStickyText(sticky.id, e.target.value)}
              className="w-full bg-transparent resize-none border-none focus:outline-none text-xs font-medium text-slate-900 leading-snug h-20"
              placeholder="Nhập nội dung ý tưởng..."
            />
          </div>
        ))}
      </div>
    </div>
  );
};

