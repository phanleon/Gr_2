"""
Physical Layer Agent - đọc thông số tầng vật lý (Layer 1) của card mạng bằng psutil
và cung cấp cho trang web đo tốc độ qua http://127.0.0.1:8765/nic

Cách chạy:
    pip install psutil
    python physical_layer_agent.py
(Giữ cửa sổ này mở, tải lại trang web đo tốc độ. Nhấn Ctrl+C để dừng.)
Chỉ lắng nghe trên 127.0.0.1 nên chỉ máy của bạn truy cập được.
"""
import json
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer

import psutil

PORT = 8765
DUPLEX = {psutil.NIC_DUPLEX_FULL: "full", psutil.NIC_DUPLEX_HALF: "half"}


def local_ip():
    """IP của máy khi ra Internet (không gửi dữ liệu thật, chỉ để hệ điều hành chọn card mạng)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def read_nics():
    stats = psutil.net_if_stats()          # Layer 1: trạng thái, tốc độ liên kết, duplex
    addrs = psutil.net_if_addrs()
    ip = local_ip()
    nics, active = [], None
    for name, st in stats.items():
        info = {
            "name": name,
            "isup": st.isup,
            "speed": st.speed,             # Mbps; 0 = không xác định
            "duplex": DUPLEX.get(st.duplex, "unknown"),
            "mtu": st.mtu,
        }
        nics.append(info)
        if ip and any(a.family == socket.AF_INET and a.address == ip for a in addrs.get(name, [])):
            active = info                  # card đang dùng để ra Internet
    return {"active": active, "all": nics}


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] != "/nic":
            self.send_response(404); self.end_headers(); return
        body = json.dumps(read_nics()).encode()
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    data = read_nics()
    print("Card mạng đang dùng:", json.dumps(data["active"], ensure_ascii=False))
    print(f"Agent đang chạy tại http://127.0.0.1:{PORT}/nic  (Ctrl+C để dừng)")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
