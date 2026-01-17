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
  2. Thay vì tạo file DOCX mới hoàn toàn, hệ thống:
     - Giải nén file DOCX gốc (không làm thay đổi file gốc)
     - Đọc và phân tích cấu trúc XML của tài liệu
     - Chèn nội dung NLS (Năng lực số) vào đúng vị trí trong cấu trúc XML
     - Đóng gói lại thành file DOCX mới với nội dung đã được bổ sung
  3. Ưu điểm: Giữ nguyên toàn bộ định dạng, style, và đối tượng nhúng của file gốc.

### 5.2. Bảo toàn OLE Objects
- **Mô tả**: Công thức MathType và Hình vẽ nhúng (OLE Objects) không bị ảnh hưởng vì không thông qua quá trình chuyển đổi định dạng.
- **Lý do**:
  1. OLE (Object Linking and Embedding) là các đối tượng nhúng trong file Word như:
     - Công thức MathType/Equation Editor
     - Hình vẽ từ các ứng dụng khác (Visio, Excel Chart, v.v.)
     - Các đối tượng nhúng khác
  2. Khi sử dụng kỹ thuật XML Injection:
     - Các file nhúng OLE (trong thư mục `embeddings/`) được giữ nguyên
     - Tham chiếu đến OLE objects trong document.xml không bị thay đổi
     - Chỉ chèn thêm nội dung mới, không xóa hay sửa đổi nội dung có sẵn
  3. Kết quả: Công thức toán học và hình vẽ vẫn hiển thị đúng và có thể chỉnh sửa được.

### 5.3. So sánh với phương pháp truyền thống
| Phương pháp | Ưu điểm | Nhược điểm |
|-------------|---------|------------|
| **Tạo file mới (docx library)** | Đơn giản, dễ implement | Mất OLE objects, mất định dạng phức tạp |
| **XML Injection (đề xuất)** | Giữ nguyên OLE, định dạng gốc | Phức tạp hơn, cần xử lý cấu trúc XML |

### 5.4. Thư viện đề xuất (cho implementation tương lai)
- **JSZip**: Giải nén và đóng gói file DOCX (ZIP)
- **xml2js** hoặc **fast-xml-parser**: Parse và chỉnh sửa XML
- Workflow:
  ```
  File DOCX gốc → JSZip (giải nén) → Parse XML → Chèn nội dung NLS → Đóng gói lại → File DOCX mới
  ```
