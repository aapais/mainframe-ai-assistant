/**
 * Official Accenture Logo Component
 * Implements the official Accenture brand guidelines with purple ">" symbol
 */

import React from 'react';

interface AccentureLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xl';
  variant?: 'horizontal' | 'stacked' | 'symbol-only';
  className?: string;
  color?: 'default' | 'white' | 'black';
  showTagline?: boolean;
}

export const AccentureLogo: React.FC<AccentureLogoProps> = ({
  size = 'medium',
  variant = 'horizontal',
  className = '',
  color = 'default',
  showTagline = false
}) => {
  // Size configurations
  const sizes = {
    small: {
      logoHeight: 'h-6',
      textSize: 'text-lg',
      symbolSize: 'text-sm',
      taglineSize: 'text-xs',
      gap: 'gap-2',
      symbolOffset: '-mt-1'
    },
    medium: {
      logoHeight: 'h-8',
      textSize: 'text-2xl',
      symbolSize: 'text-base',
      taglineSize: 'text-sm',
      gap: 'gap-3',
      symbolOffset: '-mt-1'
    },
    large: {
      logoHeight: 'h-12',
      textSize: 'text-4xl',
      symbolSize: 'text-xl',
      taglineSize: 'text-base',
      gap: 'gap-4',
      symbolOffset: '-mt-2'
    },
    xl: {
      logoHeight: 'h-16',
      textSize: 'text-5xl',
      symbolSize: 'text-2xl',
      taglineSize: 'text-lg',
      gap: 'gap-6',
      symbolOffset: '-mt-3'
    }
  };

  // Color configurations
  const colors = {
    default: {
      text: 'text-black',
      symbol: 'text-accenture-purple',
      tagline: 'text-gray-600'
    },
    white: {
      text: 'text-white',
      symbol: 'text-accenture-purple',
      tagline: 'text-gray-200'
    },
    black: {
      text: 'text-black',
      symbol: 'text-accenture-purple',
      tagline: 'text-gray-800'
    }
  };

  const sizeConfig = sizes[size];
  const colorConfig = colors[color];

  // Purple ">" symbol positioned above the "t"
  const AccentureSymbol = () => (
    <div className="relative inline-block">
      <span className={`${colorConfig.symbol} ${sizeConfig.symbolSize} font-bold absolute left-1/2 transform -translate-x-1/2 ${sizeConfig.symbolOffset} leading-none`}>
        &gt;
      </span>
    </div>
  );

  // Main logo text with symbol positioned over "t"
  const LogoText = () => (
    <div className="relative inline-flex items-center">
      <span className={`${colorConfig.text} ${sizeConfig.textSize} font-normal lowercase tracking-wide leading-none`}>
        accen
        <span className="relative inline-block">
          t
          <AccentureSymbol />
        </span>
        ure
      </span>
    </div>
  );

  // Symbol only variant
  if (variant === 'symbol-only') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <div className={`${colorConfig.symbol} ${sizeConfig.textSize} font-bold`}>
          &gt;
        </div>
      </div>
    );
  }

  // Stacked variant (logo above tagline)
  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center ${sizeConfig.gap} ${className}`}>
        <LogoText />
        {showTagline && (
          <span className={`${colorConfig.tagline} ${sizeConfig.taglineSize} font-light tracking-wide`}>
            Let there be change
          </span>
        )}
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className={`inline-flex items-center ${sizeConfig.gap} ${className}`}>
      <LogoText />
      {showTagline && (
        <span className={`${colorConfig.tagline} ${sizeConfig.taglineSize} font-light tracking-wide ml-4`}>
          Let there be change
        </span>
      )}
    </div>
  );
};

// Preset combinations for common use cases
export const AccentureHeaderLogo: React.FC<{ className?: string; showTagline?: boolean }> = ({
  className,
  showTagline = false
}) => (
  <AccentureLogo
    size="large"
    variant="horizontal"
    className={className}
    showTagline={showTagline}
  />
);

export const AccentureFooterLogo: React.FC<{ className?: string }> = ({ className }) => (
  <AccentureLogo
    size="small"
    variant="horizontal"
    className={className}
  />
);

export const AccentureNavLogo: React.FC<{ className?: string }> = ({ className }) => (
  <AccentureLogo
    size="medium"
    variant="horizontal"
    className={className}
  />
);

export const AccentureSymbolOnly: React.FC<{ size?: 'small' | 'medium' | 'large' | 'xl'; className?: string }> = ({
  size = 'medium',
  className
}) => (
  <AccentureLogo
    size={size}
    variant="symbol-only"
    className={className}
  />
);

export default AccentureLogo;