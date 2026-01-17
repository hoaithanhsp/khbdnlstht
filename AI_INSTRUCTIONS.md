# Các quy tắc phát triển và vận hành dự án (AI Instructions)

Tài liệu này ghi lại các quy tắc đã được thống nhất để AI hoặc các nhà phát triển sau này tuân thủ khi chỉnh sửa dự án.
Tôi đang triển khai ứng dụng từ github qua vercel, hãy kiểm tra giúp tôi các file vercel.json, index.html có tham chiếu đúng chưa và hướng dẫn tôi setup api key gemini để người dùng tự nhập API key của họ để chạy app
## 1. Cấu hình Model AI
- **Model mặc định**: `gemini-2.5-flash`
- **Lý do**: Cân bằng tốc độ và hiệu suất tốt nhất hiện tại.
- **Vị trí cấu hình**: `services/geminiService.ts`

## 2. Quản lý API Key
- **Cơ chế**: Ưu tiên API Key người dùng nhập vào (lưu trong `localStorage`) hơn biến môi trường.
- **Giao diện**: Nếu thiếu key, phải hiện popup/modal yêu cầu người dùng nhập. Không được hardcode key vào source code.
- **Xử lý lỗi**: Nếu gặp lỗi `429` (Quota exceeded) hoặc `403/400`, phải hiển thị thông báo chi tiết màu đỏ lên UI để người dùng biết (không hiện chung chung "Đã xảy ra lỗi").

## 3. Triển khai (Deployment)
- **Nền tảng**: Vercel.
- **Cấu hình Routing**: Bắt buộc phải có file `vercel.json` ở thư mục gốc để xử lý SPA routing (tránh lỗi 404 khi f5 trang con).
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```

## 4. UI/UX
- Khi có lỗi API, hiển thị nguyên văn message trả về (ví dụ: `RESOURCE_EXHAUSTED`, `API key not valid`) để dễ tìm nguyên nhân.

## 5. Cơ chế hoạt động (XML Injection & Bảo toàn OLE)

### 5.1. Giữ nguyên File gốc (XML Injection)
- **Mô tả**: Hệ thống sử dụng kỹ thuật **XML Injection** để chèn nội dung vào cấu trúc file Word (.docx) hiện tại thay vì tạo file mới từ đầu.
- **Nguyên lý hoạt động**:
  1. File DOCX thực chất là file ZIP chứa các file XML bên trong (document.xml, styles.xml, v.v.).
  2. Hệ thống sử dụng **JSZip** để:
     - Giải nén file DOCX gốc
     - Đọc file `word/document.xml`
     - Chèn nội dung NLS (màu đỏ) vào trước thẻ `</w:body>`
     - Đóng gói lại thành file DOCX mới
  3. **Kết quả**: Giữ nguyên 100% định dạng, style, công thức, hình ảnh của file gốc.

### 5.2. Bảo toàn OLE Objects
- **Mô tả**: Công thức MathType và Hình vẽ nhúng (OLE Objects) **không bị ảnh hưởng** vì không thông qua quá trình chuyển đổi định dạng.
- **Lý do**:
  1. Các file OLE nằm trong thư mục `word/embeddings/` được giữ nguyên
  2. Các file media (hình ảnh) trong `word/media/` được giữ nguyên
  3. Tham chiếu đến OLE objects trong document.xml không bị thay đổi
  4. Chỉ **CHÈN THÊM** nội dung mới, không xóa hay sửa đổi nội dung có sẵn

### 5.3. Định dạng nội dung NLS bổ sung
- Nội dung NLS được chèn vào **cuối file gốc** (trước `</w:body>`)
- Hiển thị **màu đỏ** (không in đậm) để giáo viên dễ nhận biết
- Có dòng phân cách "═══ NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ ═══"

### 5.4. Xử lý file PPCT
- Nếu có file **Phân phối chương trình (PPCT)**:
  1. AI trích xuất **chính xác** cột "Năng lực số" từ PPCT cho bài học tương ứng
  2. Gắn vào phần Mục tiêu chung của giáo án
  3. Tích hợp các hoạt động NLS vào tiến trình dạy học
- **Quy tắc**: KHÔNG tự ý thêm năng lực số ngoài PPCT khi có file PPCT.

### 5.5. Thư viện sử dụng
- **JSZip**: Đọc và ghi file DOCX (ZIP)
- Workflow:
  ```
  File DOCX gốc → JSZip (giải nén) → Chèn NLS vào document.xml → Đóng gói lại → File DOCX mới (giữ nguyên OLE)
  ```

