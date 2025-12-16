export enum Textbook {
  CTST = "Chân trời sáng tạo",
  KNTT = "Kết nối tri thức",
  CD = "Cánh diều"
}

export enum Subject {
  TOAN = "Toán",
  VAN = "Ngữ Văn",
  LY = "Vật Lí",
  HOA = "Hóa Học",
  SINH = "Sinh Học",
  ANH = "Tiếng Anh",
  SU = "Lịch Sử",
  DIA = "Địa Lí",
  GDCD = "GDCD",
  CONG_NGHE = "Công Nghệ",
  TIN = "Tin Học",
  THE_DUC = "Thể Dục",
  NQTN = "Nghệ thuật",
  HDKH = "Hoạt động trải nghiệm"
}

export interface LessonInfo {
  textbook: Textbook;
  subject: Subject;
  grade: number;
  content: string; 
  distributionContent?: string; // Nội dung phân phối chương trình
}

export interface ProcessingOptions {
  analyzeOnly: boolean;
  detailedReport: boolean;
  comparisonExport: boolean;
  apiKey?: string;
}

export interface GeminiResponse {
  rawText: string;
}