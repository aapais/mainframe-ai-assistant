import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

/**
 * Comprehensive Design System with Theming
 */

// Theme types and interfaces
export interface ColorToken {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface SemanticColors {
  primary: ColorToken;
  secondary: ColorToken;
  success: ColorToken;
  warning: ColorToken;
  error: ColorToken;
  neutral: ColorToken;
}

export interface ThemeColors extends SemanticColors {
  // Mainframe-specific colors
  mainframe: {
    green: string;
    amber: string;
    blue: string;
    terminal: {
      background: string;
      text: string;
      cursor: string;
    };
  };
  // Component-specific colors
  background: {
    default: string;
    paper: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
  };
  border: {
    default: string;
    focus: string;
    error: string;
    success: string;
  };
}

export interface Typography {
  fontFamily: {
    sans: string;
    mono: string;
    mainframe: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  fontWeight: {
    thin: number;
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    extrabold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
  };
}

export interface Spacing {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
  32: string;
  40: string;
  48: string;
  56: string;
  64: string;
}

export interface Shadows {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
  glow: string;
  mainframeGlow: string;
}

export interface BorderRadius {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface Transitions {
  duration: {
    fast: string;
    normal: string;
    slow: string;
  };
  easing: {
    default: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    bounce: string;
  };
}

export interface Breakpoints {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ZIndices {
  hide: number;
  base: number;
  docked: number;
  dropdown: number;
  sticky: number;
  banner: number;
  overlay: number;
  modal: number;
  popover: number;
  skipLink: number;
  toast: number;
  tooltip: number;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  typography: Typography;
  spacing: Spacing;
  shadows: Shadows;
  borderRadius: BorderRadius;
  transitions: Transitions;
  breakpoints: Breakpoints;
  zIndices: ZIndices;
  customProperties: Record<string, string>;
}

// Default color tokens
const createColorToken = (baseColor: string): ColorToken => {
  // This is a simplified version - in production, use a proper color generation library
  return {
    50: `${baseColor}0d`,
    100: `${baseColor}1a`,
    200: `${baseColor}33`,
    300: `${baseColor}4d`,
    400: `${baseColor}66`,
    500: baseColor,
    600: `${baseColor}cc`,
    700: `${baseColor}b3`,
    800: `${baseColor}99`,
    900: `${baseColor}80`,
    950: `${baseColor}66`,
  };
};

// Light theme
const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: createColorToken('#3b82f6'),
    secondary: createColorToken('#6b7280'),
    success: createColorToken('#10b981'),
    warning: createColorToken('#f59e0b'),
    error: createColorToken('#ef4444'),
    neutral: createColorToken('#6b7280'),
    mainframe: {
      green: '#00ff00',
      amber: '#ffb000',
      blue: '#0080ff',
      terminal: {
        background: '#000000',
        text: '#00ff00',
        cursor: '#ffffff',
      },
    },
    background: {
      default: '#ffffff',
      paper: '#f9fafb',
      elevated: '#f3f4f6',
    },
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      disabled: '#9ca3af',
      inverse: '#ffffff',
    },
    border: {
      default: '#e5e7eb',
      focus: '#3b82f6',
      error: '#ef4444',
      success: '#10b981',
    },
  },
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Courier New", monospace',
      mainframe: '"Courier New", "Monaco", "SF Mono", monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      thin: 100,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
    },
  },
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    glow: '0 0 20px rgba(59, 130, 246, 0.5)',
    mainframeGlow: '0 0 15px rgba(0, 255, 0, 0.5)',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  transitions: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: {
      default: 'ease',
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  breakpoints: {
    xs: '475px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  zIndices: {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
  customProperties: {},
};

// Dark theme
const darkTheme: Theme = {
  ...lightTheme,
  name: 'dark',
  colors: {
    ...lightTheme.colors,
    background: {
      default: '#111827',
      paper: '#1f2937',
      elevated: '#374151',
    },
    text: {
      primary: '#f9fafb',
      secondary: '#d1d5db',
      disabled: '#6b7280',
      inverse: '#111827',
    },
    border: {
      default: '#374151',
      focus: '#60a5fa',
      error: '#f87171',
      success: '#34d399',
    },
  },
};

// Mainframe theme
const mainframeTheme: Theme = {
  ...darkTheme,
  name: 'mainframe',
  colors: {
    ...darkTheme.colors,
    primary: createColorToken('#00ff00'),
    background: {
      default: '#000000',
      paper: '#0a0a0a',
      elevated: '#1a1a1a',
    },
    text: {
      primary: '#00ff00',
      secondary: '#ffb000',
      disabled: '#666666',
      inverse: '#000000',
    },
    border: {
      default: '#333333',
      focus: '#00ff00',
      error: '#ff0000',
      success: '#00ff00',
    },
  },
  typography: {
    ...darkTheme.typography,
    fontFamily: {
      ...darkTheme.typography.fontFamily,
      sans: '"Courier New", "Monaco", "SF Mono", monospace',
    },
  },
  shadows: {
    ...darkTheme.shadows,
    base: '0 0 10px rgba(0, 255, 0, 0.2)',
    md: '0 0 15px rgba(0, 255, 0, 0.3)',
    lg: '0 0 20px rgba(0, 255, 0, 0.4)',
    glow: '0 0 25px rgba(0, 255, 0, 0.6)',
  },
};

// Theme registry
const themes = {
  light: lightTheme,
  dark: darkTheme,
  mainframe: mainframeTheme,
};

export type ThemeName = keyof typeof themes;

// Theme context
export interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  toggleTheme: () => void;
  customizeTheme: (customizations: Partial<Theme>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Theme provider
export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeName;
  storageKey?: string;
  enableSystemTheme?: boolean;
  customThemes?: Record<string, Theme>;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  storageKey = 'kb-assistant-theme',
  enableSystemTheme = true,
  customThemes = {},
}) => {
  const allThemes = { ...themes, ...customThemes };
  const [themeName, setThemeNameState] = useState<ThemeName>(defaultTheme);
  const [customizations, setCustomizations] = useState<Partial<Theme>>({});

  // Load theme from storage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) as ThemeName;
    
    if (storedTheme && allThemes[storedTheme]) {
      setThemeNameState(storedTheme);
    } else if (enableSystemTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeNameState(prefersDark ? 'dark' : 'light');
    }

    // Load customizations
    const storedCustomizations = localStorage.getItem(`${storageKey}-customizations`);
    if (storedCustomizations) {
      try {
        setCustomizations(JSON.parse(storedCustomizations));
      } catch (error) {
        console.warn('Failed to parse stored theme customizations:', error);
      }
    }
  }, [storageKey, enableSystemTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystemTheme) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(storageKey)) {
        setThemeNameState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [storageKey, enableSystemTheme]);

  const setTheme = (newThemeName: ThemeName) => {
    if (allThemes[newThemeName]) {
      setThemeNameState(newThemeName);
      localStorage.setItem(storageKey, newThemeName);
    }
  };

  const toggleTheme = () => {
    const themeNames = Object.keys(allThemes) as ThemeName[];
    const currentIndex = themeNames.indexOf(themeName);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    setTheme(themeNames[nextIndex]);
  };

  const customizeTheme = (newCustomizations: Partial<Theme>) => {
    const updatedCustomizations = { ...customizations, ...newCustomizations };
    setCustomizations(updatedCustomizations);
    localStorage.setItem(
      `${storageKey}-customizations`,
      JSON.stringify(updatedCustomizations)
    );
  };

  const resetTheme = () => {
    setCustomizations({});
    localStorage.removeItem(`${storageKey}-customizations`);
  };

  // Merge base theme with customizations
  const theme: Theme = {
    ...allThemes[themeName],
    ...customizations,
    colors: {
      ...allThemes[themeName].colors,
      ...customizations.colors,
    },
  };

  // Apply CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme colors as CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'string') {
            root.style.setProperty(`--color-${key}-${subKey}`, subValue);
          } else if (typeof subValue === 'object') {
            Object.entries(subValue).forEach(([subSubKey, subSubValue]) => {
              root.style.setProperty(`--color-${key}-${subKey}-${subSubKey}`, subSubValue as string);
            });
          }
        });
      }
    });

    // Apply spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    // Apply typography
    Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });

    // Apply shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply border radius
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });

    // Apply custom properties
    Object.entries(theme.customProperties).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Set theme class on body
    document.body.className = `theme-${theme.name}`;
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    themeName,
    setTheme,
    toggleTheme,
    customizeTheme,
    resetTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme hook
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Utility hooks
export const useThemeColor = (colorPath: string) => {
  const { theme } = useTheme();
  
  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };
  
  return getNestedValue(theme.colors, colorPath);
};

export const useResponsiveValue = <T,>(values: Record<string, T>): T => {
  const { theme } = useTheme();
  const [currentValue, setCurrentValue] = useState<T>(values.base || Object.values(values)[0]);

  useEffect(() => {
    const updateValue = () => {
      const width = window.innerWidth;
      const breakpoints = theme.breakpoints;
      
      if (width >= parseInt(breakpoints['2xl']) && values['2xl']) {
        setCurrentValue(values['2xl']);
      } else if (width >= parseInt(breakpoints.xl) && values.xl) {
        setCurrentValue(values.xl);
      } else if (width >= parseInt(breakpoints.lg) && values.lg) {
        setCurrentValue(values.lg);
      } else if (width >= parseInt(breakpoints.md) && values.md) {
        setCurrentValue(values.md);
      } else if (width >= parseInt(breakpoints.sm) && values.sm) {
        setCurrentValue(values.sm);
      } else if (values.xs) {
        setCurrentValue(values.xs);
      } else {
        setCurrentValue(values.base || Object.values(values)[0]);
      }
    };

    updateValue();
    window.addEventListener('resize', updateValue);
    return () => window.removeEventListener('resize', updateValue);
  }, [theme.breakpoints, values]);

  return currentValue;
};

// Theme-aware styled system
export const createStyledSystem = (theme: Theme) => ({
  // Color utilities
  color: (colorPath: string) => {
    const getNestedValue = (obj: any, path: string) => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    return getNestedValue(theme.colors, colorPath);
  },
  
  // Spacing utilities
  space: (key: keyof Spacing) => theme.spacing[key],
  
  // Typography utilities
  fontSize: (key: keyof Typography['fontSize']) => theme.typography.fontSize[key],
  fontWeight: (key: keyof Typography['fontWeight']) => theme.typography.fontWeight[key],
  
  // Shadow utilities
  shadow: (key: keyof Shadows) => theme.shadows[key],
  
  // Border radius utilities
  radius: (key: keyof BorderRadius) => theme.borderRadius[key],
  
  // Responsive utilities
  responsive: <T,>(values: Partial<Record<keyof Breakpoints | 'base', T>>) => {
    const breakpointKeys = Object.keys(theme.breakpoints) as (keyof Breakpoints)[];
    let styles = '';
    
    if (values.base) {
      styles += `${values.base}; `;
    }
    
    breakpointKeys.forEach(breakpoint => {
      if (values[breakpoint]) {
        styles += `@media (min-width: ${theme.breakpoints[breakpoint]}) { ${values[breakpoint]} } `;
      }
    });
    
    return styles;
  }
});

// Export theme objects
export { lightTheme, darkTheme, mainframeTheme };
export default themes;
