const React = require('react');
const { useState, useEffect } = React;

const ThemeSettings = ({ settings, onUpdate, onMarkChanged }) => {
  const [currentTheme, setCurrentTheme] = useState(settings?.theme || 'light');
  const [previewTheme, setPreviewTheme] = useState(null);
  const [enableAnimations, setEnableAnimations] = useState(settings?.enable_animations !== false);

  useEffect(() => {
    setCurrentTheme(settings?.theme || 'light');
    setEnableAnimations(settings?.enable_animations !== false);
  }, [settings]);

  const themes = [
    {
      id: 'light',
      name: 'Light',
      description: 'Clean, bright interface perfect for daytime use',
      preview: {
        bg: '#ffffff',
        text: '#1f2937',
        accent: '#3b82f6',
        border: '#e5e7eb',
      },
    },
    {
      id: 'dark',
      name: 'Dark',
      description: 'Easy on the eyes, ideal for low-light environments',
      preview: {
        bg: '#1f2937',
        text: '#f9fafb',
        accent: '#60a5fa',
        border: '#374151',
      },
    },
    {
      id: 'auto',
      name: 'Auto',
      description: 'Automatically switches based on system preferences',
      preview: {
        bg: 'linear-gradient(45deg, #ffffff 50%, #1f2937 50%)',
        text: '#6b7280',
        accent: '#8b5cf6',
        border: '#9ca3af',
      },
    },
  ];

  const handleThemeChange = async themeId => {
    setCurrentTheme(themeId);
    onMarkChanged();

    // Apply theme immediately for live preview
    if (window.themeManager) {
      window.themeManager.applyTheme(themeId);
    }

    // Update settings in backend
    const result = await onUpdate({ theme: themeId });
    if (!result.success) {
      // Revert on error
      setCurrentTheme(settings?.theme || 'light');
      if (window.themeManager) {
        window.themeManager.applyTheme(settings?.theme || 'light');
      }
    }
  };

  const handleAnimationToggle = async enabled => {
    setEnableAnimations(enabled);
    onMarkChanged();

    // Apply animation settings immediately
    const root = document.documentElement;
    if (enabled) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }

    // Update settings in backend
    const result = await onUpdate({ enable_animations: enabled });
    if (!result.success) {
      // Revert on error
      setEnableAnimations(settings?.enable_animations !== false);
      if (settings?.enable_animations !== false) {
        root.classList.remove('no-animations');
      } else {
        root.classList.add('no-animations');
      }
    }
  };

  const previewThemeTemporarily = themeId => {
    setPreviewTheme(themeId);
    if (window.themeManager) {
      window.themeManager.applyTheme(themeId);
    }

    // Auto-revert after 3 seconds
    setTimeout(() => {
      setPreviewTheme(null);
      if (window.themeManager) {
        window.themeManager.applyTheme(currentTheme);
      }
    }, 3000);
  };

  return React.createElement(
    'div',
    {
      className: 'space-y-6',
    },
    [
      // Header
      React.createElement(
        'div',
        {
          key: 'header',
        },
        [
          React.createElement(
            'h3',
            {
              key: 'title',
              className: 'text-lg font-semibold text-gray-900 dark:text-white mb-2',
            },
            'Theme & Appearance'
          ),
          React.createElement(
            'p',
            {
              key: 'description',
              className: 'text-sm text-gray-600 dark:text-gray-400',
            },
            'Customize the visual appearance of the Mainframe AI Assistant'
          ),
        ]
      ),

      // Theme Selection
      React.createElement(
        'div',
        {
          key: 'theme-selection',
          className: 'space-y-4',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'subtitle',
              className: 'font-medium text-gray-900 dark:text-white',
            },
            'Color Theme'
          ),

          React.createElement(
            'div',
            {
              key: 'themes-grid',
              className: 'grid grid-cols-1 md:grid-cols-3 gap-4',
            },
            themes.map(theme =>
              React.createElement(
                'div',
                {
                  key: theme.id,
                  className: `relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    currentTheme === theme.id
                      ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${previewTheme === theme.id ? 'ring-2 ring-yellow-400' : ''}`,
                  onClick: () => handleThemeChange(theme.id),
                },
                [
                  // Theme Preview
                  React.createElement(
                    'div',
                    {
                      key: 'preview',
                      className: 'mb-3 p-3 rounded border',
                      style: {
                        background: theme.preview.bg,
                        borderColor: theme.preview.border,
                      },
                    },
                    [
                      React.createElement(
                        'div',
                        {
                          key: 'preview-header',
                          className: 'flex items-center gap-2 mb-2',
                        },
                        [
                          React.createElement(
                            'div',
                            {
                              key: 'circles',
                              className: 'flex gap-1',
                            },
                            [
                              React.createElement('div', {
                                key: 'circle1',
                                className: 'w-2 h-2 rounded-full',
                                style: { backgroundColor: '#ef4444' },
                              }),
                              React.createElement('div', {
                                key: 'circle2',
                                className: 'w-2 h-2 rounded-full',
                                style: { backgroundColor: '#f59e0b' },
                              }),
                              React.createElement('div', {
                                key: 'circle3',
                                className: 'w-2 h-2 rounded-full',
                                style: { backgroundColor: '#10b981' },
                              }),
                            ]
                          ),
                        ]
                      ),
                      React.createElement(
                        'div',
                        {
                          key: 'preview-content',
                          className: 'space-y-1',
                        },
                        [
                          React.createElement('div', {
                            key: 'line1',
                            className: 'h-2 rounded',
                            style: {
                              backgroundColor: theme.preview.text,
                              opacity: 0.8,
                              width: '60%',
                            },
                          }),
                          React.createElement('div', {
                            key: 'line2',
                            className: 'h-2 rounded',
                            style: {
                              backgroundColor: theme.preview.text,
                              opacity: 0.5,
                              width: '80%',
                            },
                          }),
                          React.createElement('div', {
                            key: 'accent',
                            className: 'h-2 rounded',
                            style: { backgroundColor: theme.preview.accent, width: '40%' },
                          }),
                        ]
                      ),
                    ]
                  ),

                  // Theme Info
                  React.createElement(
                    'div',
                    {
                      key: 'info',
                    },
                    [
                      React.createElement(
                        'h5',
                        {
                          key: 'name',
                          className: 'font-medium text-gray-900 dark:text-white mb-1',
                        },
                        theme.name
                      ),
                      React.createElement(
                        'p',
                        {
                          key: 'desc',
                          className: 'text-xs text-gray-600 dark:text-gray-400',
                        },
                        theme.description
                      ),
                    ]
                  ),

                  // Selection indicator
                  currentTheme === theme.id &&
                    React.createElement(
                      'div',
                      {
                        key: 'selected',
                        className:
                          'absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center',
                      },
                      React.createElement(
                        'span',
                        {
                          className: 'text-white text-xs',
                        },
                        '✓'
                      )
                    ),

                  // Preview button
                  React.createElement(
                    'button',
                    {
                      key: 'preview-btn',
                      className:
                        'absolute bottom-2 right-2 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded',
                      onClick: e => {
                        e.stopPropagation();
                        previewThemeTemporarily(theme.id);
                      },
                    },
                    'Preview'
                  ),
                ]
              )
            )
          ),

          // Preview notification
          previewTheme &&
            React.createElement(
              'div',
              {
                key: 'preview-notification',
                className:
                  'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3',
              },
              [
                React.createElement(
                  'p',
                  {
                    key: 'preview-text',
                    className: 'text-sm text-yellow-800 dark:text-yellow-200',
                  },
                  `Previewing ${themes.find(t => t.id === previewTheme)?.name} theme (will revert in 3 seconds)`
                ),
              ]
            ),
        ]
      ),

      // Animation Settings
      React.createElement(
        'div',
        {
          key: 'animation-settings',
          className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'anim-title',
              className: 'font-medium text-gray-900 dark:text-white',
            },
            'Animations'
          ),

          React.createElement(
            'div',
            {
              key: 'anim-toggle',
              className: 'flex items-center justify-between',
            },
            [
              React.createElement(
                'div',
                {
                  key: 'anim-info',
                },
                [
                  React.createElement(
                    'label',
                    {
                      key: 'anim-label',
                      className: 'text-sm font-medium text-gray-900 dark:text-white',
                    },
                    'Enable Animations'
                  ),
                  React.createElement(
                    'p',
                    {
                      key: 'anim-desc',
                      className: 'text-xs text-gray-600 dark:text-gray-400 mt-1',
                    },
                    'Disable to improve performance on slower devices'
                  ),
                ]
              ),

              React.createElement(
                'button',
                {
                  key: 'anim-switch',
                  onClick: () => handleAnimationToggle(!enableAnimations),
                  className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enableAnimations ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`,
                },
                [
                  React.createElement('span', {
                    key: 'anim-handle',
                    className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enableAnimations ? 'translate-x-6' : 'translate-x-1'
                    }`,
                  }),
                ]
              ),
            ]
          ),
        ]
      ),

      // Current Settings Summary
      React.createElement(
        'div',
        {
          key: 'summary',
          className: 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-6',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'summary-title',
              className: 'font-medium text-gray-900 dark:text-white mb-2',
            },
            'Current Settings'
          ),
          React.createElement(
            'div',
            {
              key: 'summary-content',
              className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1',
            },
            [
              React.createElement(
                'div',
                {
                  key: 'theme-info',
                },
                `Theme: ${themes.find(t => t.id === currentTheme)?.name || 'Unknown'}`
              ),
              React.createElement(
                'div',
                {
                  key: 'anim-info',
                },
                `Animations: ${enableAnimations ? 'Enabled' : 'Disabled'}`
              ),
            ]
          ),
        ]
      ),
    ]
  );
};

// Make component available globally
if (typeof window !== 'undefined') {
  window.ThemeSettings = ThemeSettings;
}

module.exports = ThemeSettings;
