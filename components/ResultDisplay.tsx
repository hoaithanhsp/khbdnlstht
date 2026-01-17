import React, { useState } from 'react';
import { Download, CheckCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  UnderlineType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType
} from 'docx';
import FileSaver from 'file-saver';
import JSZip from 'jszip';
import { OriginalDocxFile } from '../types';

interface ResultDisplayProps {
  result: string | null;
  loading: boolean;
  originalDocx?: OriginalDocxFile | null;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, loading, originalDocx }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

  // Helper: Tạo đối tượng Table cho docx từ mảng string Markdown table
  const createTableFromMarkdown = (tableLines: string[]): Table | null => {
    try {
      const validLines = tableLines.filter(line => !line.match(/^\|?\s*[-:]+[-|\s:]*\|?\s*$/));

      const rows = validLines.map(line => {
        const cells = line.split('|');
        if (line.trim().startsWith('|')) cells.shift();
        if (line.trim().endsWith('|')) cells.pop();

        return new TableRow({
          children: cells.map(cellContent => new TableCell({
            children: [new Paragraph({
              children: parseTextWithFormatting(cellContent.trim())
            })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            width: {
              size: 100 / cells.length,
              type: WidthType.PERCENTAGE,
            }
          }))
        });
      });

      return new Table({
        rows: rows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        }
      });
    } catch (e) {
      console.error("Lỗi parse table:", e);
      return null;
    }
  };

  // Helper: Parse text with bold, italic, underline, and RED color for NLS content
  const parseTextWithFormatting = (text: string): TextRun[] => {
    // Thêm regex cho thẻ <red>...</red>
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>|<red>.*?<\/red>)/g);

    return parts.map(part => {
      // Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({ text: part.slice(2, -2), bold: true });
      }
      // Italic
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return new TextRun({ text: part.slice(1, -1), italics: true });
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return new TextRun({ text: part.slice(1, -1), italics: true });
      }
      // Underline
      if (part.startsWith('<u>') && part.endsWith('</u>')) {
        const cleanText = part.replace(/<u>/g, '').replace(/<\/u>/g, '');
        return new TextRun({ text: cleanText, underline: { type: UnderlineType.SINGLE } });
      }
      // RED color for NLS content
      if (part.startsWith('<red>') && part.endsWith('</red>')) {
        const cleanText = part.replace(/<red>/g, '').replace(/<\/red>/g, '');
        return new TextRun({
          text: cleanText,
          color: "FF0000", // Màu đỏ
          bold: true
        });
      }
      return new TextRun({ text: part });
    });
  };

  // Hàm tạo file DOCX mới từ Markdown với NLS xen kẽ và copy OLE từ file gốc
  const createDocxWithOLE = async (content: string, originalBuffer?: ArrayBuffer): Promise<Blob> => {
    // Bước 1: Tạo file DOCX mới từ Markdown
    const newDocBlob = await createNewDocx(content);

    // Bước 2: Nếu có file gốc, copy OLE objects vào file mới
    if (originalBuffer) {
      try {
        const originalZip = await JSZip.loadAsync(originalBuffer);
        const newZip = await JSZip.loadAsync(await newDocBlob.arrayBuffer());

        // Copy các file OLE embeddings từ file gốc
        const embeddings = originalZip.folder('word/embeddings');
        if (embeddings) {
          embeddings.forEach(async (relativePath, file) => {
            if (!file.dir) {
              const fileContent = await file.async('arraybuffer');
              newZip.file(`word/embeddings/${relativePath}`, fileContent);
            }
          });
        }

        // Copy các file media (hình ảnh) từ file gốc
        const media = originalZip.folder('word/media');
        if (media) {
          media.forEach(async (relativePath, file) => {
            if (!file.dir) {
              const fileContent = await file.async('arraybuffer');
              newZip.file(`word/media/${relativePath}`, fileContent);
            }
          });
        }

        // Xuất file mới với OLE objects
        const finalBlob = await newZip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        return finalBlob;
      } catch (error) {
        console.warn('Không thể copy OLE objects, sử dụng file mới:', error);
        return newDocBlob;
      }
    }

    return newDocBlob;
  };

  // Hàm tạo file DOCX mới từ Markdown (với NLS xen kẽ)
  const createNewDocx = async (content: string): Promise<Blob> => {
    const lines = content.split('\n');
    const children: (Paragraph | Table)[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      const trimmed = line.trim();

      if (trimmed.startsWith('|')) {
        inTable = true;
        tableBuffer.push(line);
        continue;
      } else if (inTable) {
        if (tableBuffer.length > 0) {
          const tableNode = createTableFromMarkdown(tableBuffer);
          if (tableNode) {
            children.push(tableNode);
            children.push(new Paragraph({ text: "" }));
          }
          tableBuffer = [];
        }
        inTable = false;
      }

      if (!trimmed) {
        children.push(new Paragraph({ text: "" }));
        continue;
      }

      // Kiểm tra nếu dòng chứa <red> tag - đây là nội dung NLS
      const isNLSContent = trimmed.includes('<red>') || trimmed.includes('</red>');

      // Heading 1 (##)
      if (trimmed.startsWith('## ')) {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed.replace('## ', '')),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 100 }
        }));
      }
      // Heading 2 (###)
      else if (trimmed.startsWith('### ')) {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed.replace('### ', '')),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 50 }
        }));
      }
      // Heading 3 (####)
      else if (trimmed.startsWith('#### ')) {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed.replace('#### ', '')),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 }
        }));
      }
      // List items
      else if (trimmed.startsWith('- ') || trimmed.startsWith('+ ') || trimmed.startsWith('* ')) {
        const listContent = trimmed.substring(2);
        children.push(new Paragraph({
          children: parseTextWithFormatting(listContent),
          bullet: { level: 0 }
        }));
      }
      // Normal text (with potential red NLS content)
      else {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed),
          spacing: { after: 100 },
          alignment: AlignmentType.JUSTIFIED
        }));
      }
    }

    if (tableBuffer.length > 0) {
      const tableNode = createTableFromMarkdown(tableBuffer);
      if (tableNode) children.push(tableNode);
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    return blob;
  };

  // Hàm chính xuất file DOCX
  const generateDocx = async () => {
    if (!result) return;
    setIsGeneratingDoc(true);

    try {
      let blob: Blob;
      let fileName: string;

      // Tạo file DOCX mới từ Markdown (với NLS xen kẽ) và copy OLE từ file gốc (nếu có)
      console.log('Tạo file DOCX với NLS xen kẽ...');
      blob = await createDocxWithOLE(result, originalDocx?.arrayBuffer);

      if (originalDocx?.fileName) {
        fileName = originalDocx.fileName.replace('.docx', '_NLS.docx');
      } else {
        fileName = 'Giao_an_NLS.docx';
      }

      FileSaver.saveAs(blob, fileName);
    } catch (error) {
      console.error("Lỗi tạo file docx:", error);
      alert("Không thể tạo file .docx. Hệ thống sẽ tải về file văn bản thô.");
      handleDownloadTxt();
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain' });
    FileSaver.saveAs(blob, 'Giao_an_NLS.txt');
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-xl shadow-sm border border-blue-100 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-6"></div>
        <h3 className="text-lg font-semibold text-blue-900 animate-pulse">Đang xử lý...</h3>
        <p className="text-slate-500 mt-2 text-sm">Đang đối chiếu PPCT và tích hợp năng lực số.</p>
      </div>
    );
  }

  if (!result) return null;

  // Custom component để render thẻ <red> màu đỏ trong preview
  const components = {
    red: ({ children }: { children: React.ReactNode }) => (
      <span style={{ color: 'red', fontWeight: 'bold' }}>{children}</span>
    ),
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden animate-fade-in-up">
      <div className="bg-blue-50 px-6 py-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-4 bg-green-100 rounded-full">
          <CheckCircle className="text-green-600" size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-blue-900">Soạn giáo án thành công!</h2>
          <p className="text-slate-600 mt-2 max-w-lg mx-auto">
            Hệ thống đã tích hợp xong năng lực số vào bài dạy của bạn.
            {result.includes("(Nội dung trích xuất nguyên văn từ PPCT)") && (
              <span className="block text-green-700 font-medium mt-1 text-sm bg-green-100 p-2 rounded">
                * Đã áp dụng CHÍNH XÁC năng lực số từ PPCT.
              </span>
            )}
          </p>
          <p className="text-red-600 font-medium mt-2 text-sm bg-red-50 p-2 rounded">
            📌 Nội dung NLS bổ sung được hiển thị <strong>màu đỏ</strong> và xen kẽ trong giáo án
          </p>
          {originalDocx && (
            <p className="text-blue-600 font-medium mt-2 text-sm bg-blue-100 p-2 rounded">
              ✓ Đã copy hình ảnh và công thức từ file gốc (nếu có)
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-md">
          <button
            onClick={generateDocx}
            disabled={isGeneratingDoc}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-4 bg-blue-600 text-white rounded-xl text-lg font-bold hover:bg-blue-700 transition-all shadow-md transform hover:-translate-y-1"
          >
            {isGeneratingDoc ? (
              <span className="animate-pulse">Đang tạo file...</span>
            ) : (
              <>
                <Download size={24} />
                <span>Tải về .docx</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownloadTxt}
            className="flex-none flex items-center justify-center px-4 py-4 bg-white text-slate-600 rounded-xl font-medium border border-slate-300 hover:bg-slate-50 transition-colors"
            title="Tải bản text dự phòng"
          >
            <FileText size={24} />
          </button>
        </div>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center text-blue-600 text-sm font-medium hover:underline mt-4"
        >
          {showPreview ? (
            <>Thu gọn xem trước <ChevronUp size={16} className="ml-1" /></>
          ) : (
            <>Xem trước nội dung <ChevronDown size={16} className="ml-1" /></>
          )}
        </button>
      </div>

      {showPreview && (
        <div className="p-8 prose prose-blue max-w-none prose-p:text-slate-700 prose-headings:text-blue-900 border-t border-slate-100 bg-slate-50/50">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={components as any}
          >
            {result}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
