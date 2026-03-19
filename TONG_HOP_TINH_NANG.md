# Tổng Hợp Tính Năng Miru

Tài liệu này tổng hợp các tính năng hiện có của hệ thống Miru ở thời điểm hiện tại, bao gồm cả phía người dùng, nhà trị liệu, trí tuệ nhân tạo, thông báo, hồ sơ công khai và các luồng hỗ trợ chuyên môn.

## 1. Tổng quan sản phẩm

Miru là một ứng dụng hỗ trợ sức khỏe tinh thần với hai nhóm người dùng chính:

- Thân chủ
- Nhà trị liệu

Hệ thống hiện có các lớp chức năng lớn sau:

- Đăng nhập và xác thực người dùng
- Chat với AI
- Bộ nhớ ngắn hạn và dài hạn của AI
- Nhật ký, theo dõi cảm xúc và check-in hằng ngày
- Kết nối giữa thân chủ và nhà trị liệu
- Nhắn tin, lịch hẹn, bài tập trị liệu
- Hồ sơ công khai của nhà trị liệu
- Gửi yêu cầu liên hệ trực tiếp từ danh bạ therapist
- Đánh giá tâm lý dạng biểu mẫu
- Chia sẻ dữ liệu với nhà trị liệu
- Kế hoạch trị liệu
- PWA, cài ứng dụng, thông báo đẩy và nhắc chủ động

## 2. Tính năng chung cho toàn hệ thống

### 2.1. Đăng nhập và xác thực

- Đăng nhập bằng Google OAuth
- Callback đăng nhập quay về frontend sau khi backend xử lý xong
- Duy trì phiên đăng nhập bằng token
- Đăng xuất khỏi hệ thống
- Tự nhận diện vai trò người dùng theo dữ liệu hiện có

### 2.2. Cam kết và chấp thuận sử dụng

- Yêu cầu người dùng chấp thuận điều khoản trước khi dùng ứng dụng
- Lưu trạng thái chấp thuận của từng người dùng
- Tách riêng consent chung của ứng dụng với consent chia sẻ dữ liệu cho nhà trị liệu

### 2.3. PWA và trải nghiệm như ứng dụng

- Có manifest để cài ứng dụng trên desktop và điện thoại
- Có service worker
- Có thể mở như một ứng dụng đã cài thay vì chỉ là một trang web
- Hỗ trợ thông báo hệ thống qua PWA

### 2.4. Thông báo

- Xin quyền thông báo từ trình duyệt
- Đồng bộ subscription thông báo đẩy thật với backend
- Gửi thông báo cho các sự kiện quan trọng

Các loại thông báo đang hỗ trợ:

- AI trả lời tin nhắn chat
- Nhà trị liệu nhắn tin cho thân chủ
- Thân chủ nhắn tin cho nhà trị liệu
- Nhà trị liệu giao bài tập mới
- Cảnh báo dấu hiệu khủng hoảng do AI phát hiện
- Tin nhắn chủ động sau khoảng thời gian người dùng im lặng
- Nhắc bài tập sắp đến hạn

## 3. Tính năng dành cho thân chủ

### 3.1. Trang chủ

- Xem tóm tắt tình trạng hiện tại
- Xem lịch sử cảm xúc gần đây
- Xem check-in trong các ngày gần nhất
- Nhận gợi ý hoặc tin nhắn chủ động từ AI
- Xem nhanh nhật ký gần đây

### 3.2. Chat với AI

- Gửi và nhận tin nhắn thời gian thực qua WebSocket
- Có trạng thái AI đang suy nghĩ
- Có streaming nội dung phản hồi theo từng đoạn
- Lưu lịch sử chat theo phiên
- Gắn chat với trí nhớ ngắn hạn và dài hạn
- Kích hoạt cảnh báo nếu AI phát hiện nội dung có dấu hiệu tự hại hoặc khủng hoảng

### 3.3. Bộ nhớ AI

- Bộ nhớ ngắn hạn theo phiên chat
- Bộ nhớ dài hạn cá nhân hóa
- Xem danh sách ký ức đã lưu
- Xem timeline ký ức
- Xem graph hoặc cụm thông tin bộ nhớ
- Chỉnh sửa hoặc xóa ký ức thuộc về chính mình

### 3.4. Nhật ký và cảm xúc

- Viết nhật ký
- Xem lịch sử nhật ký
- Check-in trạng thái hiện tại
- Xem streak hoặc trạng thái check-in gần đây
- Theo dõi diễn biến cảm xúc trong một khoảng thời gian

### 3.5. Cài đặt cá nhân

- Bật thông báo
- Cài ứng dụng PWA
- Kết nối với nhà trị liệu bằng mã
- Xóa dữ liệu bộ nhớ của chính mình
- Xem trạng thái tài khoản và phiên đăng nhập

### 3.6. Liên kết với nhà trị liệu

- Nhập mã kết nối do nhà trị liệu tạo
- Sau khi kết nối thành công, mở ra các tính năng làm việc nội bộ với nhà trị liệu
- Xem nhà trị liệu đang được liên kết
- Nhắn tin với nhà trị liệu
- Xem lịch hẹn
- Xem bài tập được giao

### 3.7. Mục Trị Liệu

Mục này hiện đã được tách thành nhiều thành phần giao diện nhỏ hơn để dễ bảo trì và dễ mở rộng.

Trong mục trị liệu, thân chủ có thể:

- Xem thông tin nhà trị liệu đang liên kết
- Xem các bài tập được giao
- Xem tiến độ từng bài tập
- Tick checklist từng bước của bài tập
- Ghi chú tiến độ hoặc ghi chú hoàn thành
- Nộp sản phẩm cho bài tập
- Đánh dấu hoàn thành bài tập
- Xem lịch hẹn với nhà trị liệu
- Xác nhận hoặc theo dõi lịch hẹn
- Nhắn tin với nhà trị liệu

### 3.8. Nộp sản phẩm bài tập

Khi nhà trị liệu giao bài tập, thân chủ có thể nộp sản phẩm dưới các định dạng sau:

- PDF
- DOCX
- MP3
- M4A
- MP4
- PNG
- JPG

Ứng dụng hỗ trợ:

- Cập nhật tiến độ trước khi nộp
- Ghi chú đi kèm bài nộp
- Lưu file nộp gắn với đúng bài tập
- Chỉ cho phép chính thân chủ của bài tập đó nộp bài

### 3.9. Chia sẻ dữ liệu với nhà trị liệu

Người dùng có thể cấu hình mức chia sẻ dữ liệu cho nhà trị liệu:

- Không chia sẻ
- Chia sẻ báo cáo AI
- Chia sẻ trực tiếp nhiều hơn

Mức chia sẻ này được lưu tách biệt với consent chung của ứng dụng.

### 3.10. Biểu mẫu đánh giá

Thân chủ có thể:

- Nhận bài đánh giá từ nhà trị liệu
- Làm các thang đo như PHQ-9, GAD-7, DASS-21
- Gửi kết quả
- Xem hoặc biết trạng thái bài đánh giá đã được giao

### 3.11. Kế hoạch trị liệu

- Xem kế hoạch trị liệu đã được nhà trị liệu xuất bản
- Chỉ đọc, không chỉnh sửa
- Theo dõi các mục tiêu, bước thực hiện và định hướng mà nhà trị liệu đưa ra

## 4. Tính năng dành cho nhà trị liệu

### 4.1. Onboarding và xác minh

- Gửi hồ sơ đăng ký làm nhà trị liệu
- Theo dõi trạng thái duyệt hồ sơ
- Chỉ khi được duyệt thì mới truy cập đầy đủ cổng therapist
- Tách biệt rõ bằng chứng xác minh với media công khai trên hồ sơ

### 4.2. Dashboard nhà trị liệu

- Xem tổng quan hoạt động
- Xem danh sách thân chủ đang liên kết
- Xem bài tập đang hoạt động
- Xem cảnh báo khủng hoảng
- Xem hội thoại hoặc trạng thái nhắn tin

### 4.3. Quản lý thân chủ

- Xem danh sách thân chủ
- Mở hồ sơ chi tiết từng thân chủ
- Xem thông tin tổng quan
- Xem bối cảnh và dữ liệu đã được phép chia sẻ
- Xem bài tập, lịch hẹn, tin nhắn và một số dữ liệu liên quan

### 4.4. Mã kết nối therapist-client

- Tạo mã kết nối
- Gửi mã cho thân chủ
- Thân chủ nhập mã ở cài đặt để liên kết
- Nếu môi trường thật chưa có đủ schema hỗ trợ pending code, hệ thống có fallback an toàn

### 4.5. Liên hệ trực tiếp từ danh bạ

Đây là lớp pre-pairing mới đứng trước bước kết nối bằng mã.

Nhà trị liệu có thể:

- Nhận yêu cầu liên hệ từ người dùng ngay trên danh bạ công khai
- Xem inbox yêu cầu liên hệ riêng
- Chấp nhận yêu cầu
- Từ chối yêu cầu
- Lưu trữ yêu cầu
- Trả lời ngắn cho yêu cầu
- Khi chấp nhận, có thể gửi kèm pairing code

### 4.6. Nhắn tin với thân chủ

- Xem danh sách hội thoại
- Mở cuộc trò chuyện theo từng thân chủ
- Gửi tin nhắn cho thân chủ
- Đọc tin nhắn từ thân chủ
- Đánh dấu đã đọc
- Nhận thông báo khi có tin nhắn mới

### 4.7. Lịch hẹn

- Tạo lịch hẹn với thân chủ
- Theo dõi trạng thái lịch hẹn
- Xác nhận, hoàn tất hoặc hủy lịch
- Thân chủ có thể xem lại lịch hẹn phía client

### 4.8. Giao bài tập

Nhà trị liệu hiện có thể:

- Tạo bài tập cho từng thân chủ
- Nhập tiêu đề và mô tả
- Chọn loại bài tập
- Chọn mức ưu tiên
- Chọn hạn hoàn thành
- Tạo checklist động gồm nhiều bước
- Theo dõi tiến độ hoàn thành
- Xem số bước đã hoàn thành
- Xem ghi chú hoàn thành của thân chủ
- Xem file mà thân chủ nộp lên
- Nhận thông báo khi tạo bài tập mới hoặc khi gần đến hạn

### 4.9. Hồ sơ công khai của nhà trị liệu

Nhà trị liệu có thể quản lý hồ sơ công khai gồm:

- Tên hiển thị
- Headline
- Giới thiệu chi tiết
- Chuyên môn
- Ảnh đại diện công khai
- Chứng chỉ hoặc bằng cấp công khai
- Kênh liên hệ công khai
- Trạng thái có công khai trên danh bạ hay không

### 4.10. Giá tiền và lộ trình làm việc công khai

Hồ sơ công khai hiện đã hỗ trợ:

- Có đang nhận thân chủ mới hay không
- Miễn phí, có phí, hoặc cả hai
- Giá khởi điểm
- Đơn vị giá
- Ghi chú giá
- Ghi chú thanh toán công khai
- Lộ trình làm việc công khai từ 3 đến 5 bước

### 4.11. Billing profile nội bộ

Nhà trị liệu có thể lưu thông tin thanh toán riêng tư để dùng sau khi tiếp nhận thân chủ:

- Tên chủ tài khoản
- Ngân hàng
- Số tài khoản
- Số MoMo hoặc ZaloPay
- Cú pháp chuyển khoản

Phần này không hiển thị công khai trên danh bạ.

### 4.12. Đánh giá tâm lý

Nhà trị liệu có thể:

- Giao biểu mẫu đánh giá cho thân chủ
- Theo dõi trạng thái nộp
- Xem kết quả
- Xem trang chi tiết kết quả đánh giá

### 4.13. Chia sẻ dữ liệu

- Xem hoặc sử dụng mức chia sẻ dữ liệu mà thân chủ đã cho phép
- Phân biệt rõ giữa dữ liệu chia sẻ và dữ liệu không được phép truy cập

### 4.14. Kế hoạch trị liệu

Nhà trị liệu có thể:

- Tạo kế hoạch trị liệu theo từng thân chủ
- Chỉnh sửa nội dung kế hoạch
- Xuất bản kế hoạch
- Sau khi xuất bản, thân chủ mới nhìn thấy ở phía client

## 5. Tính năng công khai cho người chưa kết nối

### 5.1. Danh bạ therapist công khai

- Xem danh sách therapist công khai
- Tìm kiếm therapist
- Xem badge trạng thái hỗ trợ:
  - Miễn phí
  - Có phí từ mức nào đó
  - Miễn phí hoặc có phí
  - Tạm ngừng nhận thân chủ
- Xem chuyên môn nổi bật
- Xem mô tả ngắn
- Xem hồ sơ chi tiết

### 5.2. Hồ sơ therapist công khai

Người dùng có thể xem:

- Tên therapist
- Trạng thái xác minh
- Headline
- Chuyên môn
- Giới thiệu chi tiết
- Lộ trình làm việc công khai
- Giá khởi điểm
- Hình thức hỗ trợ
- Ghi chú thanh toán công khai
- Kênh liên hệ ngoài app
- Ảnh chứng chỉ công khai

### 5.3. Gửi yêu cầu liên hệ trực tiếp

Nếu therapist cho phép nhận yêu cầu:

- Người dùng có thể bấm “Liên hệ ngay”
- Nếu chưa đăng nhập, hệ thống sẽ đưa tới login rồi quay lại đúng hồ sơ đó
- Nếu đã đăng nhập, mở form gửi yêu cầu liên hệ

Form gửi yêu cầu gồm:

- Lời nhắn ngắn
- Kênh liên hệ mong muốn
- Số điện thoại tùy chọn
- Zalo tùy chọn
- Nhu cầu miễn phí, có phí hoặc chưa rõ

### 5.4. Luồng sau khi gửi yêu cầu liên hệ

- Yêu cầu xuất hiện trong inbox của nhà trị liệu
- Nhà trị liệu có thể approve, decline hoặc archive
- Nếu approve, therapist có thể gửi kèm pairing code
- Sau đó thân chủ tiếp tục kết nối nội bộ bằng mã, không auto-pair ngay

## 6. Tính năng AI và trí nhớ

### 6.1. Bộ nhớ ngắn hạn

- Lưu theo phiên chat
- Dùng để giữ ngữ cảnh ngắn hạn đang diễn ra

### 6.2. Bộ nhớ dài hạn

- Lưu các ký ức quan trọng của người dùng
- Hỗ trợ truy hồi khi AI cần nhắc lại thông tin liên quan
- Dùng trong chat và trong proactive AI

### 6.3. Tin nhắn chủ động từ AI

Hệ thống có hai lớp:

- Tin nhắn chủ động theo API khi giao diện cần tải
- Push chủ động thật qua scheduler nền

Push chủ động thật hiện:

- Kiểm tra người dùng đã im lặng bao lâu
- Mặc định có thể kích hoạt ở mốc 12 giờ
- Dùng cả bộ nhớ ngắn hạn và bộ nhớ dài hạn để viết nội dung nhắn phù hợp hơn

### 6.4. Phát hiện khủng hoảng

- AI có thể phát hiện dấu hiệu tự hại hoặc nguy cơ cao trong hội thoại
- Ghi log cảnh báo
- Hiển thị cho nhà trị liệu nếu có quan hệ phù hợp
- Có thể gửi thông báo khi có cảnh báo mới

## 7. Tính năng kỹ thuật trên frontend

### 7.1. Kiến trúc fetch dữ liệu

Frontend đã được chuyển sang dùng TanStack Query cho nhiều luồng chính với các mục tiêu:

- Cache dữ liệu
- Tránh request trùng lặp
- Giữ dữ liệu khi chuyển trang
- Prefetch khi hover menu

### 7.2. Layout bền vững

- Sidebar và header không bị remount lại mỗi lần chuyển route
- Cảm giác điều hướng mượt hơn, ít tải lại dữ liệu hơn

### 7.3. Tách component

- Một số màn lớn như mục trị liệu đã được tách thành nhiều component nhỏ
- Giúp dễ bảo trì, dễ sửa lỗi và dễ mở rộng

## 8. Tính năng kỹ thuật trên backend

- Backend chính dùng FastAPI
- Chat dùng WebSocket
- Push notification dùng Web Push
- Scheduler nền dùng cho proactive push
- Memory, insight và chat chạy trực tiếp trong backend chính
- Không còn cần sidecar MCP riêng
- Có nhiều lớp fallback để chịu được schema DB cũ hơn môi trường local

## 9. Bảo vệ dữ liệu và phân quyền

Hệ thống hiện đã được siết lại ở các luồng chính:

- Không cho người dùng tự ý đổi `user_id` ở request để xem dữ liệu người khác
- Các route therapist phải kiểm tra quan hệ therapist-client đang hoạt động
- Route bài tập, file nộp bài, nhắn tin và lịch hẹn đều đi qua kiểm tra quyền
- Consent và sharing preference được tách riêng
- Billing profile của therapist là riêng tư, không lộ ra hồ sơ công khai

## 10. Nhóm vai trò trong hệ thống

Hiện hệ thống có các nhóm vai trò sau:

- Người dùng thông thường hoặc thân chủ
- Nhà trị liệu
- Người duyệt hồ sơ therapist
- Quản trị viên ở một số luồng đặc biệt

## 11. Tóm tắt trạng thái sản phẩm

Miru hiện không còn chỉ là một ứng dụng chat AI đơn giản, mà đã có đầy đủ nhiều lớp chức năng:

- AI đồng hành
- Bộ nhớ cá nhân hóa
- Theo dõi cảm xúc và nhật ký
- Ghép cặp thân chủ với nhà trị liệu
- Liên hệ trực tiếp từ danh bạ therapist
- Hồ sơ công khai chuyên nghiệp cho therapist
- Bài tập trị liệu, lịch hẹn, nhắn tin
- Đánh giá tâm lý
- Kế hoạch trị liệu
- PWA và thông báo đẩy

## 12. Gợi ý sử dụng tài liệu này

Bạn có thể dùng file này cho:

- Bàn giao dự án
- Làm tài liệu nội bộ
- Viết mô tả sản phẩm
- Kiểm tra lại phạm vi tính năng trước khi triển khai tiếp
- Làm nền để viết tài liệu người dùng hoặc tài liệu nhà trị liệu
