# InternetLAN Go

Ứng dụng mạng ngang hàng/Host-Relay viết bằng Go, dùng giao diện web cục bộ để không cần framework GUI bên thứ ba.

## Tính năng hiện có

- Tạo mạng (Host) trên TCP port tùy chọn.
- Tham gia mạng qua IP/hostname + port + password.
- Xác thực challenge-response HMAC-SHA256: password không được gửi trực tiếp qua đường truyền.
- Cấp Virtual IP logic dạng `10.10.0.x`.
- Danh sách thiết bị đang online.
- Chat nhóm.
- Chat riêng theo tên thiết bị.
- Gửi file nhóm hoặc gửi riêng.
- File nhận được lưu trong `downloads/`.
- Log kết nối, lỗi, gửi/nhận file.
- Hiển thị IPv4 LAN của máy để test nhanh trong cùng Wi-Fi/LAN.
- Chỉ dùng Go standard library; không cần Fyne/Electron/Node.js.

## Điều quan trọng

Virtual IP `10.10.0.x` ở phiên bản này là IP logic bên trong InternetLAN, **chưa phải adapter mạng ảo thật của Windows**. Vì vậy lệnh như:

```powershell
ping 10.10.0.2
```

chưa hoạt động qua InternetLAN.

Để có LAN ảo thực sự cho game/app khác nhìn thấy, giai đoạn tiếp theo cần TUN/virtual adapter và packet routing.

## Yêu cầu

- Go 1.22 trở lên.
- Windows 10/11, Linux hoặc macOS.
- Hai máy có thể kết nối TCP với nhau.

## Chạy nhanh

```powershell
go run .
```

Mở:

```text
http://127.0.0.1:8787
```

Chương trình cũng cố gắng tự mở trình duyệt.

## Build Windows

```powershell
go build -o InternetLAN.exe .
.\InternetLAN.exe
```

## Test trên cùng máy

1. Chạy bản thứ nhất, chọn **Tạo mạng**:
   - Tên: `Host-PC`
   - Port: `50000`
   - Password: `123456`

2. Do local UI dùng port 8787 cố định nên để test nhiều instance trên cùng một máy, hãy chạy instance thứ hai ở máy khác hoặc chỉnh port UI trong `main.go`.

## Test trong cùng Wi-Fi/LAN

Trên máy Host:

```powershell
ipconfig
```

Ví dụ Host có IPv4:

```text
192.168.1.10
```

Máy Client nhập:

- Server: `192.168.1.10`
- Port: `50000`
- Password: password của Host

Nếu Windows Firewall hỏi quyền cho ứng dụng Go, chỉ cho phép trên mạng bạn tin cậy.

## Kết nối qua Internet

Nếu Host nằm sau router NAT, cần:

1. Port Forward TCP `50000` từ router vào IP LAN của Host.
2. Client dùng Public IP của router để kết nối.

Nếu ISP dùng CGNAT, port forwarding thường không đủ. Phiên bản hiện tại chưa có STUN/UDP hole punching hoặc relay server độc lập.

## Bảo mật hiện tại

Xác thực dùng challenge-response:

```text
Host -> Client: random challenge
Client -> Host: HMAC-SHA256(password, challenge | deviceName)
```

Password không được gửi nguyên văn.

Tuy nhiên nội dung chat/file ở phiên bản này **chưa được mã hóa end-to-end**. Không nên dùng trên Internet công cộng cho dữ liệu nhạy cảm.

Giai đoạn tiếp theo nên thêm TLS 1.3 cho transport.

## Cấu trúc

```text
internetlan-go/
├── main.go
├── go.mod
├── internal/
│   └── core/
│       ├── app.go
│       ├── client.go
│       ├── host.go
│       └── protocol.go
├── web/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── downloads/
```

## Kiến trúc

```text
Browser UI
    |
    | HTTP localhost:8787
    v
Go InternetLAN Engine
    |
    +-- Host TCP Server
    |
    +-- Client TCP Connection
    |
    +-- HMAC authentication
    |
    +-- Chat routing
    |
    +-- File routing
```

## Roadmap đề xuất

### v0.2
- TLS 1.3.
- Resume/reconnect.
- SHA-256 integrity cho file.
- Giới hạn tốc độ file.
- Progress file thực theo byte mạng.

### v0.3
- UDP transport.
- STUN.
- NAT traversal / UDP hole punching.
- Relay server độc lập.

### v0.4
- TUN/virtual adapter.
- IP ảo thật trên hệ điều hành.
- Routing packet.
- Ping giữa `10.10.0.x`.
- LAN game/app support.

### v0.5
- SSH/SFTP module.
- Quyền truy cập từng peer.
- Mã hóa E2E giữa peer.
