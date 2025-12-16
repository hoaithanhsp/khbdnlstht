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
