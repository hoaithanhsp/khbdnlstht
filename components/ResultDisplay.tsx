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
  originalDocx?: OriginalDocxFile | null; // File DOCX gốc cho XML Injection
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

  // Helper: Parse text with bold, italic, underline
  const parseTextWithFormatting = (text: string): TextRun[] => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>)/g);

    return parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({ text: part.slice(2, -2), bold: true });
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return new TextRun({ text: part.slice(1, -1), italics: true });
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return new TextRun({ text: part.slice(1, -1), italics: true });
      }
      if (part.startsWith('<u>') && part.endsWith('</u>')) {
        const cleanText = part.replace(/<u>/g, '').replace(/<\/u>/g, '');
        return new TextRun({ text: cleanText, underline: { type: UnderlineType.SINGLE } });
      }
      return new TextRun({ text: part });
    });
  };

  // Escape XML special characters
  const escapeXml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Chuyển Markdown sang Word XML paragraphs
  const convertMarkdownToWordXml = (markdown: string): string => {
    const lines = markdown.split('\n');
    let xml = '';

    // Thêm dòng phân cách trước nội dung NLS
    xml += `
      <w:p>
        <w:pPr><w:pBdr><w:top w:val="single" w:sz="12" w:space="1" w:color="0066CC"/></w:pBdr></w:pPr>
      </w:p>
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r>
          <w:rPr><w:b/><w:color w:val="0066CC"/><w:sz w:val="28"/></w:rPr>
          <w:t>--- NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (AI Generated) ---</w:t>
        </w:r>
      </w:p>
    `;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        xml += '<w:p/>';
        continue;
      }

      if (trimmed.startsWith('## ')) {
        const content = escapeXml(trimmed.replace('## ', ''));
        xml += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${content}</w:t></w:r></w:p>`;
      } else if (trimmed.startsWith('### ')) {
        const content = escapeXml(trimmed.replace('### ', ''));
        xml += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${content}</w:t></w:r></w:p>`;
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const content = escapeXml(trimmed.slice(2, -2));
        xml += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${content}</w:t></w:r></w:p>`;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = escapeXml(trimmed.substring(2));
        xml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${content}</w:t></w:r></w:p>`;
      } else if (trimmed.includes('<u>') && trimmed.includes('</u>')) {
        const content = escapeXml(trimmed.replace(/<\/?u>/g, ''));
        xml += `<w:p><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0066CC"/></w:rPr><w:t>${content}</w:t></w:r></w:p>`;
      } else {
        const content = escapeXml(trimmed);
        xml += `<w:p><w:r><w:t>${content}</w:t></w:r></w:p>`;
      }
    }

    return xml;
  };

  // XML Injection: Chèn nội dung vào file DOCX gốc
  const injectContentToDocx = async (
    originalArrayBuffer: ArrayBuffer,
    contentToInject: string
  ): Promise<Blob> => {
    const zip = await JSZip.loadAsync(originalArrayBuffer);

    const documentXmlFile = zip.file('word/document.xml');
    if (!documentXmlFile) {
      throw new Error('File DOCX không hợp lệ: không tìm thấy word/document.xml');
    }

    let documentXml = await documentXmlFile.async('string');
    const nlsContent = convertMarkdownToWordXml(contentToInject);

    if (documentXml.includes('</w:body>')) {
      documentXml = documentXml.replace('</w:body>', `${nlsContent}</w:body>`);
    } else {
      throw new Error('Không tìm thấy thẻ </w:body> trong document.xml');
    }

    zip.file('word/document.xml', documentXml);

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    return blob;
  };

  // Hàm tạo file DOCX mới (fallback)
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

      if (trimmed.startsWith('## ')) {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed.replace('## ', '')),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 100 }
        }));
      } else if (trimmed.startsWith('### ')) {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed.replace('### ', '')),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 50 }
        }));
      } else if (trimmed.startsWith('#### ')) {
        children.push(new Paragraph({
          children: parseTextWithFormatting(trimmed.replace('#### ', '')),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 }
        }));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('+ ') || trimmed.startsWith('* ')) {
        const listContent = trimmed.substring(2);
        children.push(new Paragraph({
          children: parseTextWithFormatting(listContent),
          bullet: { level: 0 }
        }));
      } else {
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

      if (originalDocx?.arrayBuffer) {
        // Sử dụng XML Injection - giữ nguyên file gốc và bảo toàn OLE
        console.log('Sử dụng XML Injection để giữ nguyên file gốc...');
        blob = await injectContentToDocx(originalDocx.arrayBuffer, result);
        fileName = originalDocx.fileName.replace('.docx', '_NLS.docx');
      } else {
        // Fallback: tạo file mới
        console.log('Không có file gốc, tạo file DOCX mới...');
        blob = await createNewDocx(result);
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
          {originalDocx && (
            <p className="text-blue-600 font-medium mt-2 text-sm bg-blue-100 p-2 rounded">
              ✓ Sử dụng XML Injection - Giữ nguyên công thức MathType và hình vẽ
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
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {result}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;