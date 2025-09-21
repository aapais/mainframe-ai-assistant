import React from 'react';

interface SkipNavigationProps {
  /** Custom CSS classes for styling */
  className?: string;
  /** Custom skip links configuration */
  skipLinks?: Array<{
    href: string;
    label: string;
    id: string;
  }>;
}

/**
 * SkipNavigation Component
 *
 * Provides skip navigation links that allow keyboard users to bypass
 * repetitive content and jump directly to main content areas.
 *
 * WCAG 2.1 Compliance: 2.4.1 Bypass Blocks (Level A)
 *
 * Features:
 * - Visually hidden until focused
 * - High contrast styling when visible
 * - Smooth transitions
 * - Customizable skip links
 * - Screen reader optimized
 */
const SkipNavigation: React.FC<SkipNavigationProps> = ({
  className = '',
  skipLinks = [
    { href: '#main-content', label: 'Skip to main content', id: 'skip-main' },
    { href: '#navigation', label: 'Skip to navigation', id: 'skip-nav' },
    { href: '#search', label: 'Skip to search', id: 'skip-search' }
  ]
}) => {
  const baseClasses = `
    absolute left-6 transform -translate-y-full
    bg-gray-900 text-white px-4 py-2 rounded-md
    text-sm font-medium z-[9999]
    transition-transform duration-200 ease-in-out
    focus:translate-y-0 focus:outline-none
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    hover:bg-gray-800 no-underline
    border-2 border-transparent focus:border-blue-300
  `;

  return (
    <div className={`skip-navigation ${className}`} role="banner">
      {skipLinks.map((link) => (
        <a
          key={link.id}
          id={link.id}
          href={link.href}
          className={baseClasses}
          style={{
            clipPath: 'inset(50%)',
            height: '1px',
            overflow: 'hidden',
            position: 'absolute',
            whiteSpace: 'nowrap',
            width: '1px'
          }}
          onFocus={(e) => {
            // Remove clipping when focused to make visible
            e.target.style.clipPath = 'none';
            e.target.style.height = 'auto';
            e.target.style.overflow = 'visible';
            e.target.style.position = 'absolute';
            e.target.style.whiteSpace = 'normal';
            e.target.style.width = 'auto';
            e.target.style.top = '6px';
          }}
          onBlur={(e) => {
            // Re-apply clipping when focus is lost
            e.target.style.clipPath = 'inset(50%)';
            e.target.style.height = '1px';
            e.target.style.overflow = 'hidden';
            e.target.style.position = 'absolute';
            e.target.style.whiteSpace = 'nowrap';
            e.target.style.width = '1px';
            e.target.style.top = 'auto';
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
};

export default SkipNavigation;