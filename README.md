<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0984E3,25:6C5CE7,50:A29BFE,75:00CEC9,100:00B894&height=270&section=header&text=Secure%20Remote%20Workspace&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=ZERO-TRUST%20SSH%20%E2%80%A2%20ULTRAVIEWER%20DESKTOP%20%E2%80%A2%20AI%20COPILOT%20%E2%9C%A8&descSize=19&descAlignY=62" width="100%" />

### 🛡️ Enterprise Zero-Trust Remote Workspace & Audited Desktop System
*Hệ thống Không gian làm việc từ xa chuẩn Zero-Trust: Điều khiển Desktop kiểu UltraViewer, Terminal SSH bảo mật có Firewall chặn lệnh nguy hiểm, mạng P2P tự phục hồi $0 chi phí.*

<br/>

[![GitHub Stars](https://img.shields.io/github/stars/phanleon/Gr_2?style=for-the-badge&logo=github&color=FFD700&logoColor=white)](https://github.com/phanleon/Gr_2/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/phanleon/Gr_2?style=for-the-badge&logo=github&color=6C5CE7&logoColor=white)](https://github.com/phanleon/Gr_2/network/members)
[![Release Version](https://img.shields.io/badge/Release-V1.0.0_Enterprise-00CEC9?style=for-the-badge&logo=electron)](https://github.com/phanleon/Gr_2)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20Linux-0984E3?style=for-the-badge&logo=windows)](https://github.com/phanleon/Gr_2)
[![Security Level](https://img.shields.io/badge/Security-Zero--Trust%20RBAC-D63031?style=for-the-badge&logo=shield)](https://github.com/phanleon/Gr_2)
[![Author](https://img.shields.io/badge/Author-Phan%20Minh%20Nhựt-6C5CE7?style=for-the-badge&logo=github)](https://github.com/phanleon/Gr_2)

<br/>

<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=1000&color=00CEC9&center=true&vCenter=true&width=650&lines=Zero-Config+Cross-Network+Discovery+($0+Cost);UltraViewer-Style+Low-Latency+Remote+Desktop;Audited+WebTerminal+with+Command+Firewall;3-Tier+RBAC+Dual-Lock+Department+Rooms;On-Premise+AI+Copilot+Integration+(Ollama)" alt="Typing SVG" />
</a>

<br/>

> 🌟 **Nếu bạn thấy dự án hữu ích, hãy bấm tặng 1 Star ⭐ ở góc trên bên phải để ủng hộ nhóm phát triển nhé!** 🌟

`🛡️` ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ `🛡️`

</div>

## 📌 Mục lục

- [🌟 Giới thiệu tổng quan](#-giới-thiệu-tổng-quan)
- [🎬 Video Demo & Nguyên Lý Vận Hành](#-video-demo--nguyên-lý-vận-hành)
- [✨ Các tính năng nổi bật (Standout Features)](#-các-tính-năng-nổi-bật-standout-features)
- [🔄 Sơ đồ kiến trúc bảo mật (Architecture)](#-sơ-đồ-kiến-trúc-bảo-mật-architecture)
- [🚀 Hướng dẫn cài đặt & Chạy siêu tốc (Quick Start)](#-hướng-dẫn-cài-đặt--chạy-siêu-tốc-quick-start)
- [🔐 Tài khoản thử nghiệm mặc định](#-tài-khoản-thử-nghiệm-mặc-định)
- [📂 Cấu trúc mã nguồn dự án](#-cấu-trúc-mã-nguồn-dự-án)
- [🤖 Tích hợp Trí tuệ nhân tạo (Local AI Copilot)](#-tích-hợp-trí-tuệ-nhân-tạo-local-ai-copilot)
- [💖 Đóng góp & Star History](#-đóng-góp--star-history)

---

## 🌟 Giới thiệu tổng quan

**Secure Remote Workspace** là bộ giải pháp máy tính để bàn (Desktop Application) toàn diện xây dựng trên nền tảng **Electron + React + Express + SQLite + TypeScript**, cho phép kết nối an toàn giữa các máy tính cá nhân qua các mạng Internet khác nhau (Wi-Fi công cộng, 4G/5G, CGNAT) mà **hoàn toàn không cần mở port modem / router (Zero Router Config)** với chi phí hạ tầng **0đ**.

### Điểm khác biệt cốt lõi:
1. **Kiến trúc Zero-Trust:** Không ai được tin cậy mặc định. Mỗi phòng ban đều có cơ chế khóa kép (Dual-Lock): mật khẩu phòng + sự phê duyệt trực tiếp của Trưởng phòng hoặc Quản trị viên.
2. **Tường lửa lệnh SSH (Command Firewall):** Tự động phát hiện và chặn đứng tức thì các câu lệnh phá hoại hệ thống (`rm -rf`, `format`, `Remove-Item -Force`) trước khi chúng được thực thi trên máy nhân viên.
3. **Điều khiển máy từ xa chuyên nghiệp:** Chia sẻ màn hình thời gian thực độ trễ thấp và can thiệp chuột/bàn phím gốc Windows qua thư viện FFI `user32.dll`.

---

## 🎬 Video Demo & Nguyên Lý Vận Hành

Xem video trực quan giải thích chi tiết **Cách Internet & Mạng LAN vận hành qua Đường hầm SSH Bảo Mật**:

<div align="center">

### 📺 Video: Cách Internet / LAN Vận Hành & Thiết Lập Đường Hầm SSH Zero-Trust

https://github.com/phanleon/Gr_2/raw/main/docs/videos/Cach_InternetLAN_Van_Hanh_Duong_Ham_SSH.mp4

<br/>

[![Xem Video Demo](https://img.shields.io/badge/▶_BẤM_VÀO_ĐÂY_ĐỂ_XEM_VIDEO_FULL_HD-00CEC9?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/phanleon/Gr_2/raw/main/docs/videos/Cach_InternetLAN_Van_Hanh_Duong_Ham_SSH.mp4)

<br/>

> 💡 *Nếu trình duyệt không tự động phát video trực tiếp ở trên, bạn có thể bấm vào nút phía trên hoặc mở file [**`docs/videos/Cach_InternetLAN_Van_Hanh_Duong_Ham_SSH.mp4`**](docs/videos/Cach_InternetLAN_Van_Hanh_Duong_Ham_SSH.mp4) để xem chất lượng cao trực tiếp trên GitHub.*

</div>

#### 📌 Nội dung then chốt được giải mã trong video:
1. **Bản chất mạng Internet & CGNAT/Firewall:** Tại sao hai máy tính khác mạng (ở nhà và công ty) bình thường không thể kết nối trực tiếp nếu không mở cổng modem router.
2. **Nguyên lý Đường Hầm SSH Zero-Trust (Reverse Tunneling):** Cơ chế máy trạm chủ động tạo kết nối ra ngoài (Outbound Connection) an toàn, vượt qua mọi lớp tường lửa và NAT mà không cần can thiệp router.
3. **Mã hóa điểm cuối & Kiểm toán lệnh:** Gói tin được bảo vệ toàn vẹn, kết hợp tường lửa chặn các câu lệnh phá hoại trước khi chạm tới hệ điều hành.

---

## ✨ Các tính năng nổi bật (Standout Features)

| Icon | Tính năng | Mô tả chi tiết |
|:---:|:---|:---|
| 🌐 | **Zero-Config Discovery ($0)** | Sử dụng Quick Tunnel (`*.trycloudflare.com`) tự động phát hiện đổi IP / đổi Wi-Fi để cập nhật điểm nối qua GitHub Gist Registry. Tự động phục hồi kết nối trong 5 giây. |
| 🖥️ | **UltraViewer Remote Desktop** | Chia sẻ màn hình WebRTC (kèm fallback JPEG qua WebSocket). Bơm sự kiện chuột/bàn phím chính xác từng pixel qua `koffi` (`user32.dll`). Phím nóng ngắt khẩn cấp **`F12`**. |
| 🛡️ | **Zero-Trust WebTerminal & SSH** | Tích hợp console `xterm.js` cho phép IT mở shell điều khiển máy trạm từ xa **không cần mở Port 22**. Ghi nhật ký từng phím gõ vào hệ thống kiểm toán Server. |
| 🛑 | **Dangerous Command Firewall** | Chặn đứng tức thì các mã độc hại (`del /f /s /q`, `Remove-Item C:\`, `reg delete`...) và phát cảnh báo mức `CRITICAL` lên bảng điều khiển Server. |
| 🏢 | **Không gian làm việc phòng ban** | Tường mạng xã hội doanh nghiệp phân quyền theo phòng (IT, Kế toán, Marketing...). Phòng ban nào chỉ xem được kế hoạch và dữ liệu của phòng ban đó. |
| 📦 | **Truyền file phân mảnh 10MB** | Cơ chế tự động cắt nhỏ file lớn thành từng khối 10MB để vượt qua giới hạn dung lượng miễn phí của Cloudflare và ráp lại an toàn với mã hash SHA-256. |
| 🤖 | **Local AI Copilot (Ollama)** | Trợ lý AI cục bộ tự động tóm tắt biên bản họp, tóm tắt kế hoạch dự án và chuyển đổi câu lệnh tự nhiên thành mã lệnh PowerShell/Bash (`#ai <yêu cầu>`). |

---

## 🔄 Sơ đồ kiến trúc bảo mật (Architecture)

```mermaid
flowchart TD
    subgraph ClientZone ["🏢 Máy trạm Nhân viên (Client Edition)"]
        ClientApp["💻 Client_Workspace.exe"]
        ScreenCap["📹 Desktop Capturer & Screen Stream"]
        LocalPty["⚡ Local PTY Shell Bridge"]
    end

    subgraph TunnelCloud ["☁️ Dynamic Tunnel & Discovery ($0)"]
        CFTunnel["🌐 Cloudflare Outbound Quick Tunnel"]
        GistRegistry["📡 GitHub Gist Discovery Registry"]
    end

    subgraph ServerZone ["🛡️ Máy chủ Quản trị (Server Edition)"]
        ServerApp["🖥️ Server_Admin.exe"]
        AuthRBAC["🔑 3-Tier RBAC & Dual-Lock Guard"]
        CmdFirewall{"🛑 Dangerous Command Firewall"}
        AuditDB[("💾 SQLite WAL Database")]
        OllamaAI["🤖 Local AI Ollama Guard"]
    end

    ClientApp -->|"1. Đọc Endpoint active"| GistRegistry
    ServerApp -->|"Tạo Tunnel & Publish Endpoint"| CFTunnel
    CFTunnel -->|"Cập nhật URL tự động"| GistRegistry
    ClientApp <==|"Kết nối mã hóa WSS/WebRTC"| ServerApp

    ClientApp -.->|"Stream màn hình"| ScreenCap
    ScreenCap ==>|"WebRTC Video Track"| ServerApp
    ServerApp ==>|"Koffi Win32 Mouse/Key Injection"| ClientApp

    LocalPty <-->|"Kênh lệnh Shell"| CmdFirewall
    CmdFirewall -- "Lệnh an toàn" --> AuditDB
    CmdFirewall -- "Lệnh nguy hiểm" -->|"CHẶN & Báo động Đỏ"| ServerApp
    AuditDB -.->|"Phân tích nhật ký bất thường"| OllamaAI

    classDef blue fill:#DCEEFF,stroke:#85BAFF,color:#285C91,stroke-width:2px
    classDef mint fill:#D9FBE8,stroke:#7ED9AC,color:#236B49,stroke-width:2px
    classDef pink fill:#FFE0EF,stroke:#FF80B5,color:#8A3159,stroke-width:2px
    classDef yellow fill:#FFF5CC,stroke:#F3CE65,color:#85631B,stroke-width:2px
```

---

## 🚀 Hướng dẫn cài đặt & Chạy siêu tốc (Quick Start)

### Yêu cầu môi trường:
- Hệ điều hành: **Windows 10 / 11** (Hỗ trợ cả Linux).
- Đã cài đặt **[Node.js (Bản LTS)](https://nodejs.org/)** (v18 hoặc v20+).

---

### Cách 1: Khởi động 1-Click trên Windows (Khuyên dùng ⭐)

1. Tải toàn bộ mã nguồn về máy: Nhấn **Code > Download ZIP** trên GitHub rồi giải nén.
2. Cài đặt và mở app lần đầu bằng cách nhấp đúp:
   ```text
   INSTALL_AND_RUN.bat
   ```
   *File này tự kiểm tra môi trường, tự chạy `npm install` và mở ứng dụng.*
3. Để chạy các chế độ riêng biệt:
   * **Chạy giao diện Máy Chủ:** Mở file `RUN_SERVER.bat` (hoặc `npm run electron:server`).
   * **Chạy giao diện Máy Nhân Viên:** Mở file `RUN_CLIENT.bat` (hoặc `npm run electron:client`).

---

### Cách 2: Chạy qua dòng lệnh Terminal

```bash
# 1. Clone repository
git clone https://github.com/phanleon/Gr_2.git
cd Gr_2

# 2. Cài đặt các thư viện cần thiết
npm install

# 3. Chạy giao diện Web phát triển (Vite)
npm run dev

# 4. Khởi chạy Electron đồng thời cả Máy Chủ & Máy Trạm
npm run dev:both:electron
```

---

### Cách 3: Sử dụng bản Portable đóng gói sẵn (Không cần cài Node.js)
Trong thư mục `dist-release/`:
* [**`dist-release/SecureWorkspace_Portable.exe`**](dist-release/SecureWorkspace_Portable.exe) (~103 MB) — Chỉ cần nhấp đúp là phần mềm khởi chạy ngay lập tức!

---

## 🔐 Tài khoản thử nghiệm mặc định

Hệ thống được khởi tạo sẵn tài khoản Quản trị cấp cao nhất:

| Vai trò | Tên đăng nhập | Mật khẩu mặc định | Quyền hạn |
|:---|:---:|:---:|:---|
| **SERVER_ADMIN (Root)** | `admin` | `Server@123456` | Toàn quyền tạo phòng, cấp phép nhân viên, xem toàn bộ log kiểm toán và điều khiển máy từ xa. |
| **ROOM_OWNER** | *Tạo từ Dashboard* | *Tùy chọn* | Quản lý thành viên phòng ban, duyệt người vào phòng, kick, tắt tiếng (mute) mic. |
| **CLIENT** | *Tạo từ Dashboard* | *Tùy chọn* | Tham gia phòng được cấp phép, nhắn tin, gọi video, chia sẻ màn hình. |

---

## 📂 Cấu trúc mã nguồn dự án

```text
Gr_2/
├── dist/                              # Bản build giao diện HTML/CSS/JS đã biên dịch
│   ├── assets/
│   │   ├── index-BNDu8XHC.js          # JavaScript bundle chính
│   │   └── index-BwycqhT4.css         # CSS Tailwind bundle
│   └── index.html                     # Entry point UI
├── dist-electron/                     # Bản build backend & electron main
│   ├── electron/                      # Main process & Native FFI Windows Bridge
│   └── server/                        # Express API, Socket.io & SQLite DB
├── dist-release/                      # Chứa file thực thi Portable đóng gói
│   └── SecureWorkspace_Portable.exe   # Bản Portable 1-Click Launch
├── docs/                              # Tài liệu & Media
│   └── videos/                        # Video hướng dẫn & giải thích cơ chế
│       └── Cach_InternetLAN_Van_Hanh_Duong_Ham_SSH.mp4
├── electron/                          # Mã nguồn TypeScript cho Electron
│   ├── main.ts                        # Electron Main selector (Server/Client mode)
│   └── services/                      # Watchdog, Win32 Remote Control, SSH PTY
├── server/                            # Mã nguồn TypeScript cho Backend
│   ├── controllers/                   # Xử lý Logic phòng ban, người dùng, upload
│   ├── db/                            # SQLite Schema & Database DAO
│   ├── middleware/                    # Tường lửa JWT, Audit Log
│   └── sockets/                       # Signaling WebRTC, Chat, SSH Terminal Socket
├── src/                               # Giao diện người dùng React 18
│   ├── components/                    # Dashboard, Lobby, Vault, Whiteboard, Feed
│   ├── context/                       # Quản lý Socket & Auth State
│   └── main.tsx                       # React mount point
├── INSTALL_AND_RUN.bat                # 1-Click cài đặt và chạy tự động
├── RUN_SERVER.bat                     # 1-Click mở Server Edition
├── RUN_CLIENT.bat                     # 1-Click mở Client Edition
├── package.json                       # Khai báo phụ thuộc dự án
├── tsconfig.electron.json             # Cấu hình TypeScript cho Electron
├── vite.config.ts                     # Cấu hình đóng gói Vite React
└── README.md                          # Tài liệu hướng dẫn chính thức
```

---

## 🤖 Tích hợp Trí tuệ nhân tạo (Local AI Copilot)

Ứng dụng hỗ trợ kết nối trực tiếp với **[Ollama](https://ollama.com/)** chạy trên máy chủ nội bộ (`http://127.0.0.1:11434`):
* **Tự động tóm tắt kế hoạch:** Bấm nút *AI Summary* tại bất kỳ bài đăng phòng ban nào để rút gọn nội dung thành 3 gạch đầu dòng then chốt.
* **AI SSH Copilot:** Trong cửa sổ terminal SSH, gõ `#ai <yêu cầu>` (ví dụ: `#ai kiểm tra cổng mạng đang mở`) để AI tự sinh cú pháp lệnh PowerShell chính xác.
* **AI Security Guard:** Tự động quét `audit_logs` để đánh dấu các phiên đăng nhập lạ hoặc các nỗ lực vượt tường lửa.

---

## 💖 Đóng góp & Star History

Dự án được xây dựng với mục tiêu mang lại giải pháp làm việc từ xa an toàn, hiện đại và hoàn toàn miễn phí cho cộng đồng!

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=phanleon/Gr_2&type=Date)](https://star-history.com/#phanleon/Gr_2&Date)

<br/>

### 🌸 Cảm ơn bạn đã quan tâm đến Secure Remote Workspace! 🌸

**Đừng quên bấm ⭐ Star ở đầu trang để theo dõi các cập nhật mới nhất nhé!**

`🛡️` · `Designed & Maintained by Phan Minh Nhựt` · `✨`

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00B894,30:00CEC9,60:6C5CE7,100:0984E3&height=140&section=footer&animation=fadeIn" width="100%" />

</div>
