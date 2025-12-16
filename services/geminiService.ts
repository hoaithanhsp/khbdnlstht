import { GoogleGenAI } from "@google/genai";
import { LessonInfo, ProcessingOptions } from "../types";
import { SYSTEM_INSTRUCTION, NLS_FRAMEWORK_DATA } from "../constants";

export const generateNLSLessonPlan = async (
  info: LessonInfo,
  options: ProcessingOptions
): Promise<string> => {

  // Initialize inside function to avoid top-level execution issues
  // Prioritize API Key from options (user input), then environment variable
  const apiKey = options.apiKey || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Missing API_KEY. Vui lòng nhập API Key trong phần cài đặt.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const modelId = "gemini-2.5-flash";

  let distributionContext = "";
  if (info.distributionContent && info.distributionContent.trim().length > 0) {
    distributionContext = `
      =========================================================
      🚨 QUY TẮC TỐI THƯỢNG (KHI CÓ PPCT - STRICT MODE):
      Người dùng ĐÃ CUNG CẤP nội dung Phân phối chương trình (PPCT).
      Đây là văn bản pháp quy, bạn phải tuân thủ TUYỆT ĐỐI các yêu cầu sau:

      1. Đọc tên bài học trong "NỘI DUNG GIÁO ÁN GỐC".
      2. Tìm bài học tương ứng trong nội dung PPCT.
      3. Trích xuất NGUYÊN VĂN, CHÍNH XÁC nội dung cột "Năng lực số" (hoặc YCCĐ năng lực số) của bài học đó.
      4. Đưa nội dung trích xuất đó vào phần Mục tiêu Năng lực số.
      
      ⛔️ CÁC ĐIỀU CẤM (STRICTLY PROHIBITED):
      - CẤM TUYỆT ĐỐI việc tự ý thêm bất kỳ năng lực số nào khác không có trong PPCT của bài học này.
      - CẤM tự ý nâng cao hay thay đổi cấp độ nếu PPCT không yêu cầu.
      - CẤM dùng Khung năng lực số tham chiếu để bịa thêm mục tiêu. CHỈ dùng những gì PPCT ghi.
      - Nếu cột năng lực số trong PPCT để trống, thì mục tiêu NLS ghi là: "Không có (theo PPCT)".

      Đánh dấu mục tiêu này bằng dòng chữ: "(Nội dung trích xuất nguyên văn từ PPCT)".

      NỘI DUNG PPCT:
      ${info.distributionContent}
      =========================================================
      `;
  }

  const userPrompt = `
    DỮ LIỆU THAM CHIẾU KHUNG NĂNG LỰC SỐ (Chỉ sử dụng khi KHÔNG CÓ file PPCT hoặc để hiểu rõ mã năng lực trong PPCT):
    ${NLS_FRAMEWORK_DATA}

    THÔNG TIN GIÁO ÁN ĐẦU VÀO:
    - Bộ sách: ${info.textbook}
    - Môn học: ${info.subject}
    - Khối lớp: ${info.grade}
    
    ${distributionContext}

    YÊU CẦU XỬ LÝ NỘI DUNG:
    ${options.analyzeOnly ? "- Chỉ phân tích, không chỉnh sửa chi tiết." : "- Chỉnh sửa giáo án và TÍCH HỢP NĂNG LỰC SỐ vào các hoạt động dạy học."}
    ${options.detailedReport ? "- Kèm theo bảng giải thích chi tiết mã năng lực đã chọn ở cuối bài." : ""}
    
    YÊU CẦU VỀ ĐỊNH DẠNG (BẮT BUỘC):
    1. GIỮ NGUYÊN ĐỊNH DẠNG GỐC: Bạn phải giữ nguyên các đoạn in đậm (**text**), in nghiêng (*text*) của văn bản gốc. Không được làm mất định dạng này.
    2. TOÁN HỌC: Tất cả công thức toán phải viết dạng LaTeX trong dấu $. Ví dụ: $x^2$. Không dùng unicode.
    3. BẢNG: Sử dụng Markdown Table chuẩn.
    4. NLS BỔ SUNG: Dùng thẻ <u>...</u> để gạch chân nội dung bạn thêm vào.
    
    LƯU Ý VỀ TÍCH HỢP HOẠT ĐỘNG (KHI CÓ PPCT):
    - Các hoạt động dạy học (trong phần Tiến trình) cũng chỉ được thiết kế xoay quanh các năng lực số đã trích xuất từ PPCT. Không thiết kế hoạt động cho các năng lực nằm ngoài PPCT.
    
    ĐỊNH DẠNG ĐẦU RA:
    - Trả về toàn bộ nội dung giáo án đã chỉnh sửa dưới dạng Markdown.
    
    NỘI DUNG GIÁO ÁN GỐC:
    ${info.content}
  `;

  // Retry mechanism for 503 Overloaded errors
  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1, // Giảm nhiệt độ xuống thấp nhất để đảm bảo AI làm đúng chỉ dẫn cứng
        },
        contents: userPrompt,
      });

      const text = response.text;
      if (!text) {
        throw new Error("API trả về kết quả rỗng.");
      }
      return text;
    } catch (error: any) {
      attempt++;
      console.error(`Gemini API Error (Attempt ${attempt}/${maxRetries}):`, error);

      // Handle raw JSON errors (e.g. 503 Overloaded)
      let errorMessage = error.message || "";
      if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
        try {
          const errorObj = JSON.parse(errorMessage);
          if (errorObj.error && errorObj.error.message) {
            errorMessage = errorObj.error.message;
          }
        } catch (e) { /* ignore JSON parse error */ }
      }

      // Update error message for cleaner display
      error.message = errorMessage;

      // If it's a 503 or "overloaded" error, retry
      if (attempt < maxRetries && (errorMessage.includes("503") || errorMessage.toLowerCase().includes("overloaded") || errorMessage.includes("UNAVAILABLE"))) {
        console.log("Model overloaded, retrying in 3 seconds...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      // Pass through specific error messages
      if (error.message && (
        error.message.includes("429") ||
        error.message.includes("403") ||
        error.message.includes("400") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.message.includes("API key not valid")
      )) {
        throw error;
      }

      throw new Error(error.message || "Đã xảy ra lỗi khi kết nối với AI. Vui lòng kiểm tra API Key hoặc thử lại sau.");
    }
  }

  throw new Error("Đã hết số lần thử lại nhưng vẫn lỗi. Vui lòng thử lại sau.");
};
