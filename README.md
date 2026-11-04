<div align="center">

# 🌸 Auto Lesson Downloader V4
### `FULL AUTO` — Trợ lý tải bài học tự động

<p><strong>૮꒰ ˶• ༝ •˶꒱ა ♡</strong></p>
<p><em>Mở bài học · Bấm một nút · Để V4 lo phần còn lại!</em></p>

![Platform](https://img.shields.io/badge/Platform-Windows-9B8AFB?style=for-the-badge&logo=windows&logoColor=white)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%20LTS-8CCF9B?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Stream](https://img.shields.io/badge/Stream-HLS%20%2F%20M3U8-F4A7C5?style=for-the-badge)
![Mode](https://img.shields.io/badge/Mode-Full%20Auto-B8A8E8?style=for-the-badge)

**Tự động phát hiện stream HLS/M3U8, tải video và audio, lưu MP4 rồi chuyển sang bài tiếp theo.**

`✦` ─────────────── `♡` ─────────────── `✦`

</div>

## 🌷 Mục tiêu

Bạn không cần tải từng bài một. Chỉ cần:

1. Mở website học tập.
2. Đăng nhập tài khoản của bạn.
3. Mở bài học muốn bắt đầu.
4. Nhấn **FULL AUTO TỪ BÀI HIỆN TẠI**.

> ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა Sau đó cứ để V4 tự động xử lý nhé!

## 🐾 V4 hoạt động như thế nào?

```text
┌──────────────────────────────┐
│       BÀI HỌC HIỆN TẠI       │
└──────────────┬───────────────┘
               ↓
       Phát hiện HLS / M3U8
               ↓
       Tải video + audio
               ↓
          Lưu thành MP4
               ↓
        Tìm và bấm "Bài sau"
               ↓
       Chờ video bài mới xuất hiện
               ↓
          Tải bài tiếp theo
               ↓
       Lặp lại quy trình trên
               ↓
    Hết nút "Bài sau" thì dừng lại ♡
```

## ✨ Tính năng chính

| Tính năng | Mô tả |
|:--|:--|
| 🎬 Tự phát hiện stream | Phát hiện playlist video HLS/M3U8 của bài học hiện tại. |
| 🎧 Tải video + audio | Tải các thành phần stream và lưu thành file MP4. |
| 🐰 Tự chuyển bài | Tự tìm và nhấn nút **Bài sau** sau khi tải xong. |
| ⏳ Chờ bài mới | Chờ video của bài tiếp theo xuất hiện rồi mới tải. |
| 🔁 Full Auto | Lặp lại cho đến khi không còn nút **Bài sau** phù hợp. |
| 📚 Đánh số file | Ưu tiên số bài trong tiêu đề; nếu không có thì dùng số thứ tự phiên tải. |
| 💾 Ghi nhớ lịch sử | Bỏ qua bài đã tải thành công nếu file tương ứng vẫn còn tồn tại. |

## 🎀 Đặt tên file tự động

V4 ưu tiên lấy số bài trực tiếp từ tiêu đề bài học.

**Ví dụ tiêu đề:**

```text
Bài 4: Cấu trúc câu đơn
```

**Tên file được tạo:**

```text
004_Bài 4 - Cấu trúc câu đơn.mp4
```

Nếu tiêu đề không có số bài, V4 sử dụng số thứ tự của phiên Full Auto:

```text
001_...
002_...
003_...
```

Bạn cũng có thể chọn **Số thứ tự bắt đầu** để tiếp tục đánh số theo ý muốn.

## 💗 Tự bỏ qua bài đã tải

V4 lưu lịch sử tại:

```text
Downloads\AutoLessonAutoSave\history.json
```

Một bài sẽ được bỏ qua khi:

- Bài đó đã được ghi nhận tải thành công trong lịch sử.
- File video tương ứng vẫn còn tồn tại.

Nhờ vậy, khi chạy Full Auto lần nữa, ứng dụng không cần tải lại những bài đã hoàn tất và còn file trên máy.

## 👉 Cấu hình nút “Bài sau”

Mặc định, V4 tìm nút có nội dung:

```text
Next text = Bài sau
```

Ứng dụng kiểm tra các phần tử giao diện phổ biến:

```css
button
a
[role="button"]
input[type="button"]
input[type="submit"]
```

Nếu website sử dụng nút chuyển bài đặc biệt, bạn có thể nhập **Next selector** để chỉ định CSS selector riêng.

| Tùy chọn | Ý nghĩa |
|:--|:--|
| `Next text` | Nội dung chữ dùng để nhận diện nút chuyển bài. Mặc định: `Bài sau`. |
| `Next selector` | CSS selector riêng nếu website có cấu trúc nút đặc biệt. |
| `Số thứ tự bắt đầu` | Số dùng để đánh tên file khi tiêu đề không có số bài. |

## 🚀 Cài đặt và chạy

### 1. Cài Node.js

Cài đặt **Node.js LTS** trên Windows trước khi chạy ứng dụng.

### 2. Cài thư viện

Mở PowerShell tại thư mục dự án và chạy:

```powershell
npm install
```

### 3. Khởi động ứng dụng

```powershell
npm start
```

Hoặc chạy file sau để cài đặt và khởi động theo script có sẵn:

```text
INSTALL_AND_RUN.bat
```

### 4. Bắt đầu tải bài

Mở website, đăng nhập, chọn bài muốn bắt đầu rồi nhấn **FULL AUTO TỪ BÀI HIỆN TẠI**.

## 📁 Thư mục lưu video

Video và lịch sử tải được lưu trong:

```text
Downloads\
└── AutoLessonAutoSave\
    ├── 001_....mp4
    ├── 002_....mp4
    ├── 003_....mp4
    └── history.json
```

## 🎧 Về âm thanh

Player trên website có thể đang ở trạng thái mute hoặc pause. Tuy nhiên, file tải trực tiếp vẫn có audio **nếu playlist HLS có chứa luồng âm thanh**.

## ⚠️ Giới hạn và lưu ý

- V4 **không lấy khóa, không phá DRM và không vượt cơ chế bảo vệ nội dung**.
- Nếu playlist có `#EXT-X-KEY` với phương thức khác `NONE`, ứng dụng sẽ không cố lấy khóa để tải nội dung được bảo vệ.
- Nếu website phát video trong iframe hoặc dùng cơ chế chuyển bài riêng, tính năng nhận diện nút **Bài sau** có thể cần cấu hình `Next selector`.
- Khả năng tải audio phụ thuộc vào cấu trúc playlist HLS của website.
- Chỉ sử dụng ứng dụng với nội dung bạn có quyền truy cập và tải xuống; hãy tuân thủ điều khoản của website và quy định bản quyền.

---

<div align="center">

### 🌼 Chúc bạn học tập thật hiệu quả! 🌼

`Made with ♡` · `Auto Lesson Downloader V4`

<sub>(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ Happy learning! ✧ﾟ･:ヽ(◕ヮ◕ヽ)</sub>

</div>
