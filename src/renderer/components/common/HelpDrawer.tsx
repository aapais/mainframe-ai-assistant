import React from 'react';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-96 h-full p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-4">Help & Documentation</h2>
        <div className="space-y-4">
          <section>
            <h3 className="font-semibold mb-2">Quick Start</h3>
            <p className="text-gray-600">Welcome to the Accenture Mainframe AI Assistant!</p>
          </section>
          <section>
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="list-disc list-inside text-gray-600">
              <li>Incident Management</li>
              <li>AI-Powered Search</li>
              <li>Knowledge Base</li>
              <li>Dashboard Analytics</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HelpDrawer;