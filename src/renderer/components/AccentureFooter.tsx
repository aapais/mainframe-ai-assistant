/**
 * Professional Accenture Footer Component
 * Implements official Accenture branding with copyright and corporate styling
 */

import React from 'react';
import { AccentureFooterLogo } from './AccentureLogo';

interface AccentureFooterProps {
  className?: string;
  showLinks?: boolean;
  showLogo?: boolean;
}

export const AccentureFooter: React.FC<AccentureFooterProps> = ({
  className = '',
  showLinks = true,
  showLogo = true
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`bg-white border-t border-gray-200 ${className}`}
      role="contentinfo"
      aria-label="Accenture footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-6 lg:space-y-0">

            {/* Left Section - Logo and Copyright */}
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
              {showLogo && (
                <div className="flex-shrink-0">
                  <AccentureFooterLogo />
                </div>
              )}

              <div className="text-center sm:text-left">
                <p className="text-sm text-gray-600 font-medium">
                  © {currentYear} Accenture. All rights reserved.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Mainframe AI Assistant - Enterprise Knowledge Management
                </p>
              </div>
            </div>

            {/* Right Section - Links */}
            {showLinks && (
              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-6">
                <div className="flex items-center space-x-4 text-sm">
                  <a
                    href="#privacy"
                    className="text-gray-600 hover:text-accenture-purple transition-colors duration-200 font-medium"
                    aria-label="Privacy Policy"
                  >
                    Privacy Policy
                  </a>
                  <span className="text-gray-300">|</span>
                  <a
                    href="#terms"
                    className="text-gray-600 hover:text-accenture-purple transition-colors duration-200 font-medium"
                    aria-label="Terms of Service"
                  >
                    Terms of Service
                  </a>
                  <span className="text-gray-300">|</span>
                  <a
                    href="#accessibility"
                    className="text-gray-600 hover:text-accenture-purple transition-colors duration-200 font-medium"
                    aria-label="Accessibility Statement"
                  >
                    Accessibility
                  </a>
                </div>

                {/* Accenture Corporate Badge */}
                <div className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                  <div className="w-2 h-2 bg-accenture-purple rounded-full"></div>
                  <span className="text-xs font-medium text-gray-700">Enterprise Grade</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section - Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
              <div className="text-xs text-gray-500 text-center md:text-left">
                <span className="font-medium">Security:</span> SOC 2 Type II Certified |
                <span className="font-medium ml-2">Compliance:</span> GDPR, CCPA, HIPAA Ready |
                <span className="font-medium ml-2">Support:</span> 24/7 Enterprise Support
              </div>

              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>Version 1.0.0</span>
                <span>•</span>
                <span>Build {process.env.NODE_ENV === 'development' ? 'DEV' : 'PROD'}</span>
                <span>•</span>
                <span className="text-green-600 font-medium">● Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Minimal footer variant for compact layouts
export const AccentureFooterMinimal: React.FC<{ className?: string }> = ({ className = '' }) => (
  <footer className={`bg-white border-t border-gray-200 py-4 ${className}`}>
    <div className="max-w-7xl mx-auto px-4 text-center">
      <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
        <AccentureFooterLogo />
        <span className="text-sm text-gray-600">
          © {new Date().getFullYear()} Accenture. All rights reserved.
        </span>
      </div>
    </div>
  </footer>
);

export default AccentureFooter;