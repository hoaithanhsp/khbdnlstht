import React from 'react';
import { Subject, Textbook } from '../types';

interface LessonFormProps {
  textbook: Textbook;
  setTextbook: (val: Textbook) => void;
  subject: Subject;
  setSubject: (val: Subject) => void;
  grade: number;
  setGrade: (val: number) => void;
}

const LessonForm: React.FC<LessonFormProps> = ({
  textbook,
  setTextbook,
  subject,
  setSubject,
  grade,
  setGrade,
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 mb-6">
      <div className="flex items-center mb-4">
        <div className="h-8 w-1 bg-blue-600 rounded-full mr-3"></div>
        <h2 className="text-lg font-semibold text-blue-900">Thông tin Kế hoạch bài dạy</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Textbook */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Bộ sách</label>
          <div className="relative">
            <select
              value={textbook}
              onChange={(e) => setTextbook(e.target.value as Textbook)}
              className="block w-full rounded-lg border-slate-200 bg-slate-50 border p-2.5 text-slate-700 focus:border-blue-500 focus:ring-blue-500 transition-colors"
            >
              {Object.values(Textbook).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Môn học</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as Subject)}
            className="block w-full rounded-lg border-slate-200 bg-slate-50 border p-2.5 text-slate-700 focus:border-blue-500 focus:ring-blue-500 transition-colors"
          >
            {Object.values(Subject).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Grade */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Khối lớp</label>
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="block w-full rounded-lg border-slate-200 bg-slate-50 border p-2.5 text-slate-700 focus:border-blue-500 focus:ring-blue-500 transition-colors"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>Lớp {g}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default LessonForm;
