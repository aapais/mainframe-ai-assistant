/**
 * Theme Manager - Handles theme application and DOM manipulation
 * Provides smooth transitions and system theme detection
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.systemPreference = 'light';
    this.observers = [];
    this.transitionDuration = 300;

    this.init();
  }

  /**
   * Initialize theme manager
   */
  init() {
    // Detect system preference
    this.detectSystemPreference();

    // Listen for system preference changes
    this.setupSystemPreferenceListener();

    // Load saved theme from localStorage or use system preference
    const savedTheme = localStorage.getItem('mainframe_ai_theme');
    const initialTheme = savedTheme || 'auto';

    this.applyTheme(initialTheme);

    // Setup CSS custom properties
    this.setupCSSVariables();
  }

  /**
   * Apply a theme to the DOM
   * @param {string} theme - Theme name ('light', 'dark', 'auto')
   */
  applyTheme(theme) {
    const previousTheme = this.currentTheme;
    this.currentTheme = theme;

    // Determine actual theme to apply
    let actualTheme = theme;
    if (theme === 'auto') {
      actualTheme = this.systemPreference;
    }

    // Save theme preference
    localStorage.setItem('mainframe_ai_theme', theme);

    // Apply theme to DOM
    this.applyThemeToDOM(actualTheme);

    // Update meta theme-color
    this.updateMetaThemeColor(actualTheme);

    // Notify observers
    this.notifyObservers({
      theme: theme,
      actualTheme: actualTheme,
      previousTheme: previousTheme,
    });

    console.log(`Theme applied: ${theme} (actual: ${actualTheme})`);
  }

  /**
   * Apply theme styles to DOM elements
   * @param {string} theme - Actual theme to apply ('light' or 'dark')
   */
  applyThemeToDOM(theme) {
    const root = document.documentElement;
    const body = document.body;

    // Add transition class for smooth changes
    body.classList.add('theme-transition');

    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark', 'light-theme', 'dark-theme');

    // Add new theme classes
    root.classList.add(theme);
    body.classList.add(theme, `${theme}-theme`);

    // Update data attribute for CSS selectors
    root.setAttribute('data-theme', theme);

    // Update CSS custom properties based on theme
    this.updateCSSProperties(theme);

    // Apply theme-specific styles to components
    this.applyComponentStyles(theme);

    // Remove transition class after animation
    setTimeout(() => {
      body.classList.remove('theme-transition');
    }, this.transitionDuration);
  }

  /**
   * Update CSS custom properties for theme
   * @param {string} theme - Theme to apply
   */
  updateCSSProperties(theme) {
    const root = document.documentElement;

    if (theme === 'dark') {
      // Dark theme colors
      root.style.setProperty('--bg-primary', '#1a1a1a');
      root.style.setProperty('--bg-secondary', '#2d2d2d');
      root.style.setProperty('--bg-tertiary', '#404040');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#b3b3b3');
      root.style.setProperty('--text-muted', '#808080');
      root.style.setProperty('--border-primary', '#404040');
      root.style.setProperty('--border-secondary', '#606060');
      root.style.setProperty('--accent-primary', '#3b82f6');
      root.style.setProperty('--accent-secondary', '#1e40af');
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.5)');
    } else {
      // Light theme colors
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8f9fa');
      root.style.setProperty('--bg-tertiary', '#e9ecef');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#6c757d');
      root.style.setProperty('--text-muted', '#adb5bd');
      root.style.setProperty('--border-primary', '#dee2e6');
      root.style.setProperty('--border-secondary', '#adb5bd');
      root.style.setProperty('--accent-primary', '#0d6efd');
      root.style.setProperty('--accent-secondary', '#0a58ca');
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)');
    }
  }

  /**
   * Apply theme-specific styles to components
   * @param {string} theme - Theme to apply
   */
  applyComponentStyles(theme) {
    // Update syntax highlighting
    this.updateSyntaxHighlighting(theme);

    // Update scrollbars
    this.updateScrollbarStyles(theme);

    // Update selection colors
    this.updateSelectionColors(theme);

    // Update focus indicators
    this.updateFocusStyles(theme);

    // Update specific component styles
    this.updateModalStyles(theme);
    this.updateTooltipStyles(theme);
    this.updateTableStyles(theme);
  }

  /**
   * Update syntax highlighting colors
   * @param {string} theme - Theme to apply
   */
  updateSyntaxHighlighting(theme) {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.style.setProperty('--code-bg', '#2d2d2d');
      root.style.setProperty('--code-text', '#f8f8f2');
      root.style.setProperty('--code-comment', '#6a6a6a');
      root.style.setProperty('--code-keyword', '#ff79c6');
      root.style.setProperty('--code-string', '#f1fa8c');
      root.style.setProperty('--code-number', '#bd93f9');
    } else {
      root.style.setProperty('--code-bg', '#f8f9fa');
      root.style.setProperty('--code-text', '#212529');
      root.style.setProperty('--code-comment', '#6c757d');
      root.style.setProperty('--code-keyword', '#d63384');
      root.style.setProperty('--code-string', '#198754');
      root.style.setProperty('--code-number', '#6f42c1');
    }
  }

  /**
   * Update scrollbar styles
   * @param {string} theme - Theme to apply
   */
  updateScrollbarStyles(theme) {
    const style = document.getElementById('scrollbar-styles') || document.createElement('style');
    style.id = 'scrollbar-styles';

    if (theme === 'dark') {
      style.textContent = `
                ::-webkit-scrollbar {
                    width: 12px;
                }
                ::-webkit-scrollbar-track {
                    background: #2d2d2d;
                }
                ::-webkit-scrollbar-thumb {
                    background: #555;
                    border-radius: 6px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #777;
                }
            `;
    } else {
      style.textContent = `
                ::-webkit-scrollbar {
                    width: 12px;
                }
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                ::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 6px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8;
                }
            `;
    }

    if (!document.head.contains(style)) {
      document.head.appendChild(style);
    }
  }

  /**
   * Update text selection colors
   * @param {string} theme - Theme to apply
   */
  updateSelectionColors(theme) {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.style.setProperty('--selection-bg', '#3b82f6');
      root.style.setProperty('--selection-text', '#ffffff');
    } else {
      root.style.setProperty('--selection-bg', '#b3d4fc');
      root.style.setProperty('--selection-text', '#000000');
    }
  }

  /**
   * Update focus indicator styles
   * @param {string} theme - Theme to apply
   */
  updateFocusStyles(theme) {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.style.setProperty('--focus-ring-color', '#60a5fa');
      root.style.setProperty('--focus-ring-shadow', '0 0 0 3px rgba(96, 165, 250, 0.3)');
    } else {
      root.style.setProperty('--focus-ring-color', '#3b82f6');
      root.style.setProperty('--focus-ring-shadow', '0 0 0 3px rgba(59, 130, 246, 0.3)');
    }
  }

  /**
   * Update modal styles
   * @param {string} theme - Theme to apply
   */
  updateModalStyles(theme) {
    const modals = document.querySelectorAll('.modal, [role="dialog"]');
    modals.forEach(modal => {
      if (theme === 'dark') {
        modal.style.backgroundColor = 'var(--bg-secondary)';
        modal.style.color = 'var(--text-primary)';
      } else {
        modal.style.backgroundColor = 'var(--bg-primary)';
        modal.style.color = 'var(--text-primary)';
      }
    });
  }

  /**
   * Update tooltip styles
   * @param {string} theme - Theme to apply
   */
  updateTooltipStyles(theme) {
    const tooltips = document.querySelectorAll('.tooltip, [data-tooltip]');
    tooltips.forEach(tooltip => {
      if (theme === 'dark') {
        tooltip.style.backgroundColor = '#404040';
        tooltip.style.color = '#ffffff';
      } else {
        tooltip.style.backgroundColor = '#212529';
        tooltip.style.color = '#ffffff';
      }
    });
  }

  /**
   * Update table styles
   * @param {string} theme - Theme to apply
   */
  updateTableStyles(theme) {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      if (theme === 'dark') {
        table.style.backgroundColor = 'var(--bg-secondary)';
        table.style.borderColor = 'var(--border-primary)';
      } else {
        table.style.backgroundColor = 'var(--bg-primary)';
        table.style.borderColor = 'var(--border-primary)';
      }
    });
  }

  /**
   * Update meta theme-color for mobile browsers
   * @param {string} theme - Theme to apply
   */
  updateMetaThemeColor(theme) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    metaThemeColor.content = theme === 'dark' ? '#1a1a1a' : '#ffffff';
  }

  /**
   * Setup CSS variables for theme system
   */
  setupCSSVariables() {
    const style = document.createElement('style');
    style.id = 'theme-variables';
    style.textContent = `
            .theme-transition * {
                transition: background-color ${this.transitionDuration}ms ease,
                           color ${this.transitionDuration}ms ease,
                           border-color ${this.transitionDuration}ms ease,
                           box-shadow ${this.transitionDuration}ms ease;
            }
            
            ::selection {
                background-color: var(--selection-bg);
                color: var(--selection-text);
            }
            
            :focus {
                outline: 2px solid var(--focus-ring-color);
                outline-offset: 2px;
            }
            
            .no-animations * {
                transition: none !important;
                animation: none !important;
            }
        `;

    document.head.appendChild(style);
  }

  /**
   * Detect system color scheme preference
   */
  detectSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.systemPreference = 'dark';
    } else {
      this.systemPreference = 'light';
    }
  }

  /**
   * Setup listener for system preference changes
   */
  setupSystemPreferenceListener() {
    if (window.matchMedia) {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      darkModeMediaQuery.addEventListener('change', e => {
        this.systemPreference = e.matches ? 'dark' : 'light';

        // If current theme is auto, apply the new system preference
        if (this.currentTheme === 'auto') {
          this.applyTheme('auto');
        }
      });
    }
  }

  /**
   * Get current theme
   * @returns {string} Current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Get actual applied theme (resolves 'auto' to 'light'/'dark')
   * @returns {string} Actual theme
   */
  getActualTheme() {
    return this.currentTheme === 'auto' ? this.systemPreference : this.currentTheme;
  }

  /**
   * Get system preference
   * @returns {string} System preference
   */
  getSystemPreference() {
    return this.systemPreference;
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const currentActual = this.getActualTheme();
    const newTheme = currentActual === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  /**
   * Subscribe to theme changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.observers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all observers of theme change
   * @param {Object} changeInfo - Theme change information
   */
  notifyObservers(changeInfo) {
    this.observers.forEach(callback => {
      try {
        callback(changeInfo);
      } catch (error) {
        console.error('Theme observer error:', error);
      }
    });
  }

  /**
   * Enable or disable animations
   * @param {boolean} enabled - Whether animations are enabled
   */
  setAnimationsEnabled(enabled) {
    const root = document.documentElement;
    if (enabled) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  }

  /**
   * Get theme statistics
   * @returns {Object} Theme stats
   */
  getStats() {
    return {
      currentTheme: this.currentTheme,
      actualTheme: this.getActualTheme(),
      systemPreference: this.systemPreference,
      observers: this.observers.length,
      transitionDuration: this.transitionDuration,
    };
  }

  /**
   * Cleanup theme manager
   */
  destroy() {
    this.observers = [];

    // Remove custom styles
    const themeStyles = document.getElementById('theme-variables');
    if (themeStyles) {
      themeStyles.remove();
    }

    const scrollbarStyles = document.getElementById('scrollbar-styles');
    if (scrollbarStyles) {
      scrollbarStyles.remove();
    }
  }
}

// Create and export singleton instance
const themeManager = new ThemeManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = themeManager;
}

export default themeManager;
