import React from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-800 rounded-lg">
            <GraduationCap size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SOẠN GIÁO ÁN NLS THT</h1>
            <p className="text-blue-100 text-sm">Hệ thống hỗ trợ tích hợp Năng lực số toàn cấp</p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-2 text-blue-100 bg-blue-700 px-4 py-2 rounded-full text-sm">
          <BookOpen size={16} />
          <span>Powered by Gemini 2.5</span>
        </div>
      </div>
    </header>
  );
};

export default Header;