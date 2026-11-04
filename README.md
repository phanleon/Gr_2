🚀 Gr_2 — Ứng dụng Desktop Electron Học Tập & Tương Tác
Ứng dụng bài học tương tác trên nền tảng Electron JS — Tích hợp sẵn bộ công cụ tự động hóa cài đặt & vận hành 1-Click đỉnh cao!

📖 Hướng Dẫn Tải • ⚡ Khởi Chạy 1-Click • 🛠️ Kiến Trúc Module • ⭐ Kêu Gọi Star

📑 Mục Lục Quick-Nav
📌 Giới Thiệu Dự Án
✨ Tính Năng Nổi Bật
📋 Yêu Cầu Tiền Đề
📥 Hướng Dẫn Tải Ứng Dụng
🚀 Hướng Dẫn Sử Dụng Chi Tiết
🛠️ Cấu Trúc Thư Mục & Kiến Trúc Dự Án
❓ Xử Lý Sự Cố Thường Gặp (Troubleshooting)
⭐ Chiến Lược Bứt Phá 1,000 Stars
📌 Giới Thiệu Dự Án
Gr_2 là ứng dụng Desktop chuyên biệt phát triển bởi (nhánh LeonBrank), xây dựng trên nền tảng Electron JS hiện đại [1].

Ứng dụng giúp giải quyết triệt để rào cản kỹ thuật cho người dùng phổ thông nhờ hệ thống script tự động hóa 1-Click, giúp bạn không cần biết gõ câu lệnh vẫn có thể trải nghiệm các bài học tương tác phong phú một cách nhanh chóng và an toàn nhất [1].

💡 Điểm khác biệt: Thay vì phải cài đặt thủ công qua Terminal phức tạp, Gr_2 cung cấp sẵn INSTALL_AND_RUN.bat giúp tự động tải phụ thuộc và kích hoạt ứng dụng chỉ bằng một cú nhấp chuột [1].

✨ Tính Năng Nổi Bật
Tính Năng	Mô Tả Chi Tiết	Lợi Ích
⚡ Cài đặt 1-Click	Bộ script INSTALL_AND_RUN.bat & RUN.bat tự động phát hiện môi trường, cài gói npm và bật ứng dụng [1].	Tiết kiệm 95% thời gian thao tác cho người dùng.
🎓 Bài Học Tương Tác	Module lesson_preload.js chuyên phụ trách nạp và hiển thị các kịch bản bài học linh hoạt [1].	Trải nghiệm học tập mượt mà, trực quan.
🔒 Bảo Mật IPC Đạt Chuẩn	Phân tách nghiêm ngặt giữa Main Process (main.js) và Renderer Process qua cầu nối (preload.js) [1].	An toàn hệ thống tuyệt đối, chống leak dữ liệu.
📊 Ghi Vết Nhật Ký (STATUS.txt)	Theo dõi chi tiết tiến trình vận hành và nhật ký lỗi hệ thống [1].	Giúp người dùng & Dev dễ dàng bảo trì.
📋 Yêu Cầu Tiền Đề (Prerequisites)
Trước khi tiến hành tải và chạy dự án, hãy đảm bảo máy tính của bạn đáp ứng các yêu cầu sau:

🟢 Node.js (LTS Version): Yêu cầu phiên bản Node.js 16.x trở lên. (Đã đi kèm npm).
💻 Hệ Điều Hành:
Windows 10/11: Hỗ trợ tốt nhất (khuyên dùng tính năng 1-Click .bat).
macOS / Linux: Hỗ trợ đầy đủ qua dòng lệnh Terminal.
📥 Hướng Dẫn Tải Ứng Dụng (Download)
Bạn có thể lựa chọn 1 trong 2 phương thức tải dưới đây:

🌟 Cách 1: Tải Bản Đóng Gói ZIP (Dành cho Người Dùng Phổ Thông)
Truy cập kho lưu trữ GitHub chính thức: phanleon/Gr_2 [1].
Click vào nút xanh Code ở góc phải màn hình.
Chọn Download ZIP.
Giải nén tệp .zip vừa tải về vào thư mục bất kỳ trên máy tính (VD: C:\Gr_2).
🛠️ Cách 2: Tải Qua Git CLI (Dành cho Lập Trình Viên)
Mở cửa sổ Terminal / Command Prompt và thực hiện lệnh:

git clone https://github.com/phanleon/Gr_2.git
cd Gr_2
🚀 Hướng Dẫn Sử Dụng Chi Tiết (Usage Guide)
🔴 1. Dành Cho Người Dùng Windows (Khuyên Dùng 1-Click)
Bước 1: Khởi Chạy Lần Đầu Tiên (Tự Động Cài Đặt)

Mở thư mục chứa dự án Gr_2.
Nhấp đúp chuột (Double-click) vào tệp INSTALL_AND_RUN.bat [1].
Cửa sổ lệnh sẽ tự động tải các thư viện cần thiết (npm install) và khởi động ngay ứng dụng.
Bước 2: Cho Các Lần Sử Dụng Sau

Chỉ cần nhấp đúp chuột vào tệp RUN.bat để mở ứng dụng ngay tức thì mà không cần tải lại [1].
🔵 2. Dành Cho Người Dùng macOS / Linux / Developer
Mở Terminal và chuyển hướng tới thư mục dự án:
cd path/to/Gr_2
Cài đặt các gói phụ thuộc (chỉ thực hiện 1 lần đầu):
npm install
Chạy ứng dụng:
npm start
🖥️ Thao Tác & Vận Hành Trong Ứng Dụng
Giao diện bài học: Sau khi ứng dụng mở ra, module lesson_preload.js sẽ nạp các bài học tương tác theo cấu trúc bài giảng [1].
Ghi chép & Nhật ký trạng thái: Bạn có thể kiểm tra tệp STATUS.txt trong thư mục ứng dụng để xem lịch sử ghi log và trạng thái hoạt động của hệ thống [1].
Cấu hình nâng cao: Các lập trình viên có thể tùy biến các quy trình chính trong main.js hoặc giao diện cầu nối IPC trong preload.js [1].
🛠️ Cấu Trúc Thư Mục & Kiến Trúc Dự Án
Sơ đồ tổ chức mã nguồn ứng dụng Gr_2:

Gr_2/
├── 📄 main.js             # Quy trình chính (Main Process) quản lý cửa sổ & vòng đời ứng dụng [1]
├── 🔒 preload.js          # Cầu nối IPC bảo mật giữa Main Process và Renderer Process [1]
├── 🎓 lesson_preload.js   # Module xử lý & nạp giao diện bài học tương tác [1]
├── ⚡ INSTALL_AND_RUN.bat # Script 1-Click tự động cài phụ thuộc & khởi chạy ứng dụng [1]
├── 🚀 RUN.bat             # Script khởi chạy nhanh ứng dụng (sau khi đã cài phụ thuộc) [1]
├── 📊 STATUS.txt          # File nhật ký ghi chép trạng thái hoạt động ứng dụng [1]
├── 📦 package.json        # Khai báo cấu hình dự án và danh sách thư viện phụ thuộc [1]
└── 📖 README_VI.md        # Tài liệu hướng dẫn sử dụng tiếng Việt hoàn chỉnh [1]
❓ Xử Lý Sự Cố Thường Gặp (Troubleshooting)
Hiện Tượng Sự Cố	Nguyên Nhân	Giải Pháp Khắc Phục
Báo lỗi 'node' hoặc 'npm' không tồn tại	Máy tính chưa được cài đặt Node.js	Tải và cài đặt Node.js LTS, sau đó khởi động lại máy tính.
Script .bat tự đóng ngay khi mở	Gián đoạn kết nối Internet khi tải npm	Kiểm tra lại kết nối WiFi/Mạng và chạy lại INSTALL_AND_RUN.bat.
Màn hình ứng dụng hiển thị khoảng trắng	Module bài học chưa nạp xong	Chạy ứng dụng qua Terminal bằng lệnh npm start để xem chi tiết log hiển thị.
