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
- **Mô tả**: Hệ thống sử dụng kỹ thuật **XML Injection** để chèn nội dung vào cấu trúc file Word (.docx) hiện tại.
- **Nguyên lý hoạt động**:
  1. File DOCX = file ZIP chứa các file XML
  2. Sử dụng **JSZip** để giải nén và đọc `word/document.xml`
  3. **Tìm vị trí** các phần trong giáo án (Mục tiêu, Nội dung, Tổ chức)
  4. **Chèn NLS vào đúng vị trí** tương ứng
  5. Đóng gói lại thành file DOCX mới

### 5.2. Bảo toàn OLE Objects
- Công thức MathType và Hình vẽ **không bị ảnh hưởng**
- Các file trong `word/embeddings/` và `word/media/` được giữ nguyên
- Chỉ **CHÈN THÊM** nội dung, không xóa/sửa nội dung cũ

### 5.3. Cấu trúc đầu ra từ AI
AI trả về nội dung theo 3 section với markers rõ ràng:
- `===NLS_MỤC_TIÊU===` ... `===END_MỤC_TIÊU===`: Chèn sau phần Thái độ/Phẩm chất
- `===NLS_NỘI_DUNG===` ... `===END_NỘI_DUNG===`: Chèn sau phần b) Nội dung
- `===NLS_TỔ_CHỨC===` ... `===END_TỔ_CHỨC===`: Chèn vào phần d) Tổ chức thực hiện

### 5.4. Vị trí chèn thông minh
Hệ thống tìm các pattern trong file gốc để chèn vào đúng vị trí:
- **Mục tiêu**: Sau "Thái độ", "Phẩm chất", "Năng lực chung"
- **Nội dung**: Sau "b) Nội dung", "Sản phẩm"
- **Tổ chức**: Sau "d) Tổ chức thực hiện", "Hoạt động của GV"

### 5.5. Định dạng nội dung NLS
- Hiển thị **màu đỏ** (không in đậm) để dễ nhận biết
- Sử dụng thẻ `<red>...</red>` trong Markdown

### 5.6. Thư viện sử dụng
- **JSZip**: Đọc và ghi file DOCX (ZIP)
- Workflow:
  ```
  File gốc → JSZip → Tìm vị trí → Chèn NLS màu đỏ → Đóng gói → File DOCX mới
  ```


