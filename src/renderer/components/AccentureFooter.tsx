// Accenture Footer Component
import React from 'react';

const AccentureFooter: React.FC = () => {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-4 px-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          © 2024 Accenture - All rights reserved
        </div>
        <div className="text-sm text-gray-500">
          Mainframe AI Assistant v1.0.0
        </div>
      </div>
    </footer>
  );
};

export default AccentureFooter;