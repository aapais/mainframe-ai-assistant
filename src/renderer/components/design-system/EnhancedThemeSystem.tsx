import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { useTheme } from './ThemeSystem';

/**
 * Enhanced Theme System with Sophisticated Color Management
 *
 * Features:
 * - Advanced color palette management
 * - WCAG AA/AAA accessibility compliance
 * - Smooth theme transitions
 * - High contrast mode support
 * - Color animation effects
 * - Dynamic color adjustments
 * - Gradient support
 * - Mainframe heritage themes
 */

export type EnhancedThemeName = 'light' | 'dark' | 'light-hc' | 'dark-hc' | 'mainframe' | 'mainframe-amber' | 'auto';

export interface ColorPreferences {
  reducedContrast: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  colorBlindnessSupport: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  customPrimaryColor?: string;
  customAccentColor?: string;
}

export interface ThemeAnimations {
  enabled: boolean;
  colorTransitions: boolean;
  gradientEffects: boolean;
  glowEffects: boolean;
  duration: 'fast' | 'normal' | 'slow';
}

export interface EnhancedThemeContextValue {
  themeName: EnhancedThemeName;
  setTheme: (theme: EnhancedThemeName) => void;
  toggleTheme: () => void;
  colorPreferences: ColorPreferences;
  updateColorPreferences: (preferences: Partial<ColorPreferences>) => void;
  themeAnimations: ThemeAnimations;
  updateAnimations: (animations: Partial<ThemeAnimations>) => void;
  isSystemDark: boolean;
  supportsColorScheme: boolean;
  contrastRatio: (foreground: string, background: string) => number;
  generateColorVariants: (baseColor: string) => Record<string, string>;
  currentColors: Record<string, string>;
}

const EnhancedThemeContext = createContext<EnhancedThemeContextValue | null>(null);

export interface EnhancedThemeProviderProps {
  children: ReactNode;
  defaultTheme?: EnhancedThemeName;
  storageKey?: string;
  enableSystemDetection?: boolean;
  enableAnimations?: boolean;
  enableAccessibilityFeatures?: boolean;
}

export const EnhancedThemeProvider: React.FC<EnhancedThemeProviderProps> = ({
  children,
  defaultTheme = 'auto',
  storageKey = 'enhanced-theme',
  enableSystemDetection = true,
  enableAnimations = true,
  enableAccessibilityFeatures = true
}) => {
  const [themeName, setThemeNameState] = useState<EnhancedThemeName>(defaultTheme);
  const [isSystemDark, setIsSystemDark] = useState(false);
  const [supportsColorScheme, setSupportsColorScheme] = useState(false);
  const [currentColors, setCurrentColors] = useState<Record<string, string>>({});

  const [colorPreferences, setColorPreferences] = useState<ColorPreferences>({
    reducedContrast: false,
    reducedMotion: false,
    highContrast: false,
    colorBlindnessSupport: 'none'
  });

  const [themeAnimations, setThemeAnimations] = useState<ThemeAnimations>({
    enabled: enableAnimations,
    colorTransitions: true,
    gradientEffects: true,
    glowEffects: true,
    duration: 'normal'
  });

  // Load preferences from storage
  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) as EnhancedThemeName;
    const storedPreferences = localStorage.getItem(`${storageKey}-preferences`);
    const storedAnimations = localStorage.getItem(`${storageKey}-animations`);

    if (storedTheme && storedTheme !== 'auto') {
      setThemeNameState(storedTheme);
    }

    if (storedPreferences) {
      try {
        setColorPreferences(JSON.parse(storedPreferences));
      } catch (e) {
        console.warn('Failed to parse color preferences:', e);
      }
    }

    if (storedAnimations) {
      try {
        setThemeAnimations(JSON.parse(storedAnimations));
      } catch (e) {
        console.warn('Failed to parse theme animations:', e);
      }
    }
  }, [storageKey]);

  // System theme detection
  useEffect(() => {
    if (!enableSystemDetection) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateSystemPreferences = () => {
      setIsSystemDark(mediaQuery.matches);
      setSupportsColorScheme(true);

      if (enableAccessibilityFeatures) {
        setColorPreferences(prev => ({
          ...prev,
          highContrast: highContrastQuery.matches,
          reducedMotion: reducedMotionQuery.matches
        }));

        setThemeAnimations(prev => ({
          ...prev,
          enabled: !reducedMotionQuery.matches && prev.enabled,
          colorTransitions: !reducedMotionQuery.matches,
          gradientEffects: !reducedMotionQuery.matches,
          glowEffects: !reducedMotionQuery.matches
        }));
      }

      // Auto theme switching
      if (themeName === 'auto') {
        const autoTheme = highContrastQuery.matches
          ? (mediaQuery.matches ? 'dark-hc' : 'light-hc')
          : (mediaQuery.matches ? 'dark' : 'light');
        applyTheme(autoTheme);
      }
    };

    updateSystemPreferences();

    mediaQuery.addEventListener('change', updateSystemPreferences);
    highContrastQuery.addEventListener('change', updateSystemPreferences);
    reducedMotionQuery.addEventListener('change', updateSystemPreferences);

    return () => {
      mediaQuery.removeEventListener('change', updateSystemPreferences);
      highContrastQuery.removeEventListener('change', updateSystemPreferences);
      reducedMotionQuery.removeEventListener('change', updateSystemPreferences);
    };
  }, [themeName, enableSystemDetection, enableAccessibilityFeatures]);

  // Apply theme to DOM
  const applyTheme = useCallback((theme: EnhancedThemeName) => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark', 'theme-light-hc', 'theme-dark-hc', 'theme-mainframe', 'theme-mainframe-amber');
    root.removeAttribute('data-theme');
    root.removeAttribute('data-contrast');

    // Apply new theme
    if (theme !== 'auto') {
      root.classList.add(`theme-${theme}`);
      root.setAttribute('data-theme', theme.includes('mainframe') ? 'mainframe' : theme.split('-')[0]);

      if (theme.includes('-hc')) {
        root.setAttribute('data-contrast', 'high');
      }
    }

    // Apply color preferences
    if (colorPreferences.highContrast && !theme.includes('-hc')) {
      root.setAttribute('data-contrast', 'high');
    }

    // Apply custom colors if provided
    if (colorPreferences.customPrimaryColor) {
      root.style.setProperty('--primary-500', colorPreferences.customPrimaryColor);
      root.style.setProperty('--color-primary', colorPreferences.customPrimaryColor);
    }

    if (colorPreferences.customAccentColor) {
      root.style.setProperty('--secondary-500', colorPreferences.customAccentColor);
      root.style.setProperty('--color-secondary', colorPreferences.customAccentColor);
    }

    // Apply animation preferences
    if (!themeAnimations.enabled || colorPreferences.reducedMotion) {
      root.style.setProperty('--transition-theme', 'none');
      root.style.setProperty('--transition-all-colors', 'none');
    } else {
      const duration = themeAnimations.duration === 'fast' ? '150ms' :
                      themeAnimations.duration === 'slow' ? '400ms' : '250ms';
      root.style.setProperty('--transition-duration-theme', duration);
    }

    // Color blindness support
    if (colorPreferences.colorBlindnessSupport !== 'none') {
      root.classList.add(`colorblind-${colorPreferences.colorBlindnessSupport}`);
    }

    // Extract current colors for context
    const computedStyle = getComputedStyle(root);
    setCurrentColors({
      primary: computedStyle.getPropertyValue('--primary-500').trim(),
      secondary: computedStyle.getPropertyValue('--secondary-500').trim(),
      success: computedStyle.getPropertyValue('--success-500').trim(),
      warning: computedStyle.getPropertyValue('--warning-500').trim(),
      error: computedStyle.getPropertyValue('--error-500').trim(),
      textPrimary: computedStyle.getPropertyValue('--text-primary').trim(),
      surfacePrimary: computedStyle.getPropertyValue('--surface-primary').trim()
    });

    // Screen reader announcement
    const announcement = `Theme changed to ${theme === 'auto' ? 'automatic' : theme.replace('-', ' ')}`;
    announceThemeChange(announcement);
  }, [colorPreferences, themeAnimations]);

  // Theme change announcement
  const announceThemeChange = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-theme-announcement';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  // Contrast ratio calculation (WCAG standards)
  const contrastRatio = useCallback((foreground: string, background: string): number => {
    const getLuminance = (color: string): number => {
      const rgb = color.match(/\d+/g);
      if (!rgb) return 0;

      const [r, g, b] = rgb.map(c => {
        const sRGB = parseInt(c) / 255;
        return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum1 = getLuminance(foreground);
    const lum2 = getLuminance(background);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  }, []);

  // Generate color variants
  const generateColorVariants = useCallback((baseColor: string): Record<string, string> => {
    // Simple HSL manipulation for generating variants
    // In production, use a proper color manipulation library
    const variants: Record<string, string> = {};

    try {
      // This is a simplified version - would use proper color library in production
      const hsl = baseColor; // Placeholder

      variants['50'] = baseColor + '0d';
      variants['100'] = baseColor + '1a';
      variants['200'] = baseColor + '33';
      variants['300'] = baseColor + '4d';
      variants['400'] = baseColor + '66';
      variants['500'] = baseColor;
      variants['600'] = baseColor + 'cc';
      variants['700'] = baseColor + 'b3';
      variants['800'] = baseColor + '99';
      variants['900'] = baseColor + '80';
      variants['950'] = baseColor + '66';
    } catch (e) {
      console.warn('Failed to generate color variants:', e);
    }

    return variants;
  }, []);

  const setTheme = useCallback((theme: EnhancedThemeName) => {
    setThemeNameState(theme);
    localStorage.setItem(storageKey, theme);
    applyTheme(theme);
  }, [storageKey, applyTheme]);

  const toggleTheme = useCallback(() => {
    const themes: EnhancedThemeName[] = ['light', 'dark', 'mainframe'];
    const currentIndex = themes.indexOf(themeName as EnhancedThemeName);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  }, [themeName, setTheme]);

  const updateColorPreferences = useCallback((preferences: Partial<ColorPreferences>) => {
    const updated = { ...colorPreferences, ...preferences };
    setColorPreferences(updated);
    localStorage.setItem(`${storageKey}-preferences`, JSON.stringify(updated));
    applyTheme(themeName);
  }, [colorPreferences, storageKey, themeName, applyTheme]);

  const updateAnimations = useCallback((animations: Partial<ThemeAnimations>) => {
    const updated = { ...themeAnimations, ...animations };
    setThemeAnimations(updated);
    localStorage.setItem(`${storageKey}-animations`, JSON.stringify(updated));
    applyTheme(themeName);
  }, [themeAnimations, storageKey, themeName, applyTheme]);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(themeName);
  }, [applyTheme, themeName]);

  const contextValue: EnhancedThemeContextValue = useMemo(() => ({
    themeName,
    setTheme,
    toggleTheme,
    colorPreferences,
    updateColorPreferences,
    themeAnimations,
    updateAnimations,
    isSystemDark,
    supportsColorScheme,
    contrastRatio,
    generateColorVariants,
    currentColors
  }), [
    themeName, setTheme, toggleTheme,
    colorPreferences, updateColorPreferences,
    themeAnimations, updateAnimations,
    isSystemDark, supportsColorScheme,
    contrastRatio, generateColorVariants, currentColors
  ]);

  return (
    <EnhancedThemeContext.Provider value={contextValue}>
      {children}
    </EnhancedThemeContext.Provider>
  );
};

export const useEnhancedTheme = (): EnhancedThemeContextValue => {
  const context = useContext(EnhancedThemeContext);
  if (!context) {
    throw new Error('useEnhancedTheme must be used within an EnhancedThemeProvider');
  }
  return context;
};

/**
 * Enhanced Theme Toggle Component
 */
export interface EnhancedThemeToggleProps {
  showLabel?: boolean;
  variant?: 'button' | 'select' | 'segmented';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const EnhancedThemeToggle: React.FC<EnhancedThemeToggleProps> = ({
  showLabel = true,
  variant = 'button',
  size = 'md',
  className = ''
}) => {
  const { themeName, setTheme, toggleTheme } = useEnhancedTheme();

  const themes = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'mainframe', label: 'Mainframe', icon: '💻' },
    { value: 'auto', label: 'Auto', icon: '🔄' }
  ];

  if (variant === 'select') {
    return (
      <div className={`theme-select ${className}`}>
        {showLabel && <label htmlFor="theme-select">Theme:</label>}
        <select
          id="theme-select"
          value={themeName}
          onChange={(e) => setTheme(e.target.value as EnhancedThemeName)}
          className="theme-select__control"
        >
          {themes.map((theme) => (
            <option key={theme.value} value={theme.value}>
              {theme.icon} {theme.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (variant === 'segmented') {
    return (
      <div className={`theme-segmented ${size} ${className}`} role="radiogroup" aria-label="Theme selection">
        {themes.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => setTheme(theme.value as EnhancedThemeName)}
            className={`theme-segmented__option ${themeName === theme.value ? 'active' : ''}`}
            role="radio"
            aria-checked={themeName === theme.value}
            title={`Switch to ${theme.label} theme`}
          >
            <span className="theme-segmented__icon">{theme.icon}</span>
            {showLabel && <span className="theme-segmented__label">{theme.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Default button variant
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${size} ${className}`}
      title={`Current theme: ${themeName}. Click to cycle themes.`}
      aria-label={`Switch theme. Current: ${themeName}`}
    >
      <span className="theme-toggle__icon">
        {themeName === 'light' && '☀️'}
        {themeName === 'dark' && '🌙'}
        {themeName === 'mainframe' && '💻'}
        {themeName === 'auto' && '🔄'}
        {themeName.includes('-hc') && '🔍'}
      </span>
      {showLabel && (
        <span className="theme-toggle__label">
          {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
        </span>
      )}
    </button>
  );
};

/**
 * Color Palette Display Component
 */
export interface ColorPaletteProps {
  palette?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral' | 'all';
  showLabels?: boolean;
  showContrast?: boolean;
  className?: string;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  palette = 'all',
  showLabels = true,
  showContrast = false,
  className = ''
}) => {
  const { currentColors, contrastRatio } = useEnhancedTheme();

  const palettes = {
    primary: ['primary-50', 'primary-100', 'primary-200', 'primary-300', 'primary-400', 'primary-500', 'primary-600', 'primary-700', 'primary-800', 'primary-900'],
    secondary: ['secondary-50', 'secondary-100', 'secondary-200', 'secondary-300', 'secondary-400', 'secondary-500', 'secondary-600', 'secondary-700', 'secondary-800', 'secondary-900'],
    success: ['success-50', 'success-100', 'success-200', 'success-300', 'success-400', 'success-500', 'success-600', 'success-700', 'success-800', 'success-900'],
    warning: ['warning-50', 'warning-100', 'warning-200', 'warning-300', 'warning-400', 'warning-500', 'warning-600', 'warning-700', 'warning-800', 'warning-900'],
    error: ['error-50', 'error-100', 'error-200', 'error-300', 'error-400', 'error-500', 'error-600', 'error-700', 'error-800', 'error-900'],
    neutral: ['neutral-50', 'neutral-100', 'neutral-200', 'neutral-300', 'neutral-400', 'neutral-500', 'neutral-600', 'neutral-700', 'neutral-800', 'neutral-900']
  };

  const displayPalettes = palette === 'all' ? Object.entries(palettes) : [[palette, palettes[palette as keyof typeof palettes]]];

  return (
    <div className={`color-palette ${className}`}>
      {displayPalettes.map(([name, colors]) => (
        <div key={name} className="color-palette__group">
          <h3 className="color-palette__title">{name.charAt(0).toUpperCase() + name.slice(1)}</h3>
          <div className="color-palette__swatches">
            {colors.map((color) => {
              const colorValue = getComputedStyle(document.documentElement).getPropertyValue(`--${color}`).trim();
              const contrast = showContrast ? contrastRatio('#ffffff', colorValue) : 0;

              return (
                <div key={color} className="color-palette__swatch">
                  <div
                    className="color-palette__color"
                    style={{ backgroundColor: `var(--${color})` }}
                    title={`${color}: ${colorValue}${showContrast ? ` (Contrast: ${contrast.toFixed(2)}:1)` : ''}`}
                  />
                  {showLabels && (
                    <div className="color-palette__info">
                      <span className="color-palette__name">{color.split('-')[1]}</span>
                      {showContrast && (
                        <span className="color-palette__contrast">{contrast.toFixed(1)}:1</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnhancedThemeProvider;