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

interface ResultDisplayProps {
  result: string | null;
  loading: boolean;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, loading }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

  // Helper: Tạo đối tượng Table cho docx từ mảng string Markdown table
  const createTableFromMarkdown = (tableLines: string[]): Table | null => {
    try {
        // Lọc bỏ dòng phân cách (---|---)
        const validLines = tableLines.filter(line => !line.match(/^\|?\s*[-:]+[-|\s:]*\|?\s*$/));
        
        const rows = validLines.map(line => {
            // Tách các cell dựa trên ký tự |, xử lý escape pipe nếu cần (đơn giản hóa ở đây)
            const cells = line.split('|');
            
            // Loại bỏ phần tử rỗng ở đầu/cuối do split nếu có pipe ở đầu/cuối dòng
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

  // Helper: Parse text with bold (**), italic (* or _), underline (<u>)
  const parseTextWithFormatting = (text: string): TextRun[] => {
    // Tokenizer đơn giản cho Bold, Italic, Underline.
    // Regex này tách chuỗi thành các phần dựa trên các ký hiệu format.
    // Lưu ý: Regex này xử lý lồng nhau đơn giản hoặc tuần tự.
    // Order: Bold (**), Italic (*), Underline (<u>)
    
    // Split by markers, keeping markers
    // Group 1: **...** (Bold)
    // Group 2: *...* (Italic)
    // Group 3: <u>...</u> (Underline)
    
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>)/g);
    
    return parts.map(part => {
      // Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({
          text: part.slice(2, -2),
          bold: true
        });
      }
      
      // Italic (using * delimiter)
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) { // Avoid single *
        return new TextRun({
          text: part.slice(1, -1),
          italics: true
        });
      }

       // Italic (using _ delimiter, though typical markdown from gemini uses *)
       if (part.startsWith('_') && part.endsWith('_')) {
        return new TextRun({
          text: part.slice(1, -1),
          italics: true
        });
      }
      
      // Underline
      if (part.startsWith('<u>') && part.endsWith('</u>')) {
          const cleanText = part.replace(/<u>/g, '').replace(/<\/u>/g, '');
          return new TextRun({
              text: cleanText,
              underline: {
                  type: UnderlineType.SINGLE,
              }
          });
      }
      
      // Normal text
      return new TextRun({ text: part });
    });
  };

  const generateDocx = async () => {
    if (!result) return;
    setIsGeneratingDoc(true);

    try {
      const lines = result.split('\n');
      const children: (Paragraph | Table)[] = [];
      let tableBuffer: string[] = [];
      let inTable = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimEnd(); // Keep indentation if any, but trim end
        const trimmed = line.trim();

        // Detect Table Start/End
        if (trimmed.startsWith('|')) {
            inTable = true;
            tableBuffer.push(line);
            continue;
        } else if (inTable) {
            // End of table block detected
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
            const content = trimmed.substring(2);
            children.push(new Paragraph({
                children: parseTextWithFormatting(content),
                bullet: { level: 0 }
            }));
        }
        // Normal text
        else {
             children.push(new Paragraph({
                children: parseTextWithFormatting(trimmed),
                spacing: { after: 100 },
                alignment: AlignmentType.JUSTIFIED
            }));
        }
      }

      // Flush remaining table buffer if file ends with table
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
      FileSaver.saveAs(blob, "Giao_an_NLS.docx");
    } catch (error) {
      console.error("Lỗi tạo file docx:", error);
      alert("Không thể tạo file .docx chuẩn (Lỗi parser). Hệ thống sẽ tải về file văn bản thô.");
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