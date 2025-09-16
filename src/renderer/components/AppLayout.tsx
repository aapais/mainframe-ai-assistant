import React from 'react';
import { Container } from './ui/Layout';
import { AccentureNavLogo } from './AccentureLogo';
import { AccentureFooterMinimal } from './AccentureFooter';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen bg-white text-black font-accenture ${className}`}>
      {/* Skip Links - Hidden by default, visible on focus */}
      <div className="skip-links">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <a href="#navigation" className="skip-link">
          Skip to navigation
        </a>
        <a href="#search" className="skip-link">
          Skip to search
        </a>
      </div>

      {/* Main Navigation */}
      <nav
        id="navigation"
        className="bg-white border-b-2 border-accenture-purple sticky top-0 z-50 shadow-lg"
        role="navigation"
        aria-label="Main navigation"
      >
        <Container>
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <AccentureNavLogo />
              <div className="h-8 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-black">
                <span className="sr-only">Accenture Mainframe KB Assistant - </span>
                Knowledge Base
              </h1>
            </div>

            {/* Quick Navigation */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-accenture-purple border border-accenture-purple rounded-md hover:bg-purple-50 transition-colors duration-200"
                aria-label="Open keyboard shortcuts help"
              >
                Keyboard Shortcuts
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium bg-accenture-purple text-white rounded-md hover:bg-primary-600 transition-colors duration-200"
                aria-label="Toggle accessibility panel"
              >
                Accessibility
              </button>
            </div>
          </div>
        </Container>
      </nav>

      {/* Main Content Area */}
      <main
        id="main-content"
        className="flex-1"
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        {children}
      </main>

      {/* Accenture Footer */}
      <AccentureFooterMinimal className="mt-auto" />
    </div>
  );
};

export default AppLayout;