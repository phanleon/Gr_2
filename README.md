tôi muốn thiết kế readme đẹp nhìn chibi và dễ thương nội dung readme "# Auto Lesson Downloader V4 — FULL AUTO

## Mục tiêu

Bạn chỉ cần:

```text
Mở website
→ đăng nhập
→ mở bài muốn bắt đầu
→ bấm FULL AUTO TỪ BÀI HIỆN TẠI
```

Sau đó:

```text
Bài hiện tại
→ phát hiện HLS/M3U8
→ tải video + audio
→ lưu MP4
→ tự bấm "Bài sau"
→ chờ video bài mới
→ tải tiếp
→ lặp lại đến khi không còn nút Bài sau
```

## Rename thứ tự tự động

V4 ưu tiên lấy số bài từ tiêu đề.

Ví dụ:

```text
Bài 4: Cấu trúc câu đơn
```

sẽ lưu:

```text
004_Bài 4 - Cấu trúc câu đơn.mp4
```

Nếu tiêu đề không có số bài, V4 dùng số thứ tự của phiên Full Auto:

```text
001_...
002_...
003_...
```

Bạn có thể chọn `Số thứ tự bắt đầu`.

## Bỏ qua bài đã tải

V4 dùng:

```text
Downloads\AutoLessonAutoSave\history.json
```

Nếu một bài đã tải thành công và file vẫn tồn tại, Full Auto bỏ qua bài đó rồi chuyển sang bài tiếp theo.

## Cấu hình Bài sau

Mặc định:

```text
Next text = Bài sau
```

V4 sẽ tìm các phần tử:

```text
button
a
[role=button]
input button/submit
```

và bấm phần tử có chữ `Bài sau`.

Nếu website có selector riêng, nhập vào `Next selector`.

## Chạy

Cài Node.js LTS một lần.

Sau đó:

```powershell
npm install
npm start
```

Hoặc:

```text
INSTALL_AND_RUN.bat
```

## File lưu

```text
Downloads\
└── AutoLessonAutoSave\
    ├── 001_....mp4
    ├── 002_....mp4
    ├── 003_....mp4
    └── history.json
```

## Âm thanh

Player trên trang có thể mute/pause. File tải trực tiếp vẫn giữ audio nếu stream HLS có audio.

## Giới hạn

V4 không lấy khóa, không phá DRM và không vượt protected media.

Nếu playlist có `#EXT-X-KEY` với phương thức khác `NONE`, app sẽ không cố tải khóa.

Nếu website dùng iframe hoặc cơ chế chuyển bài đặc biệt, selector `Bài sau` có thể cần chỉnh.
"
