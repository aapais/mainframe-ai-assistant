const React = require('react');
const { useState, useEffect } = React;

const SettingsModal = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState('theme');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load user settings on modal open
  useEffect(() => {
    if (isOpen && user?.id) {
      loadSettings();
    }
  }, [isOpen, user?.id]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${user.id}`);
      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
      } else {
        setError(result.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to connect to settings service');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async updates => {
    setSaving(true);
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
        setHasChanges(false);

        // Apply theme changes immediately
        if (updates.theme) {
          window.themeManager?.applyTheme(updates.theme);
        }

        // Apply language changes
        if (updates.language) {
          window.i18n?.setLanguage(updates.language);
        }

        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (
      !confirm(
        'Are you sure you want to reset all settings to defaults? This action cannot be undone.'
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${user.id}/reset`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
        setHasChanges(false);

        // Apply default theme
        window.themeManager?.applyTheme('light');
        window.i18n?.setLanguage('en');

        alert('Settings have been reset to defaults.');
      } else {
        throw new Error(result.error || 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const exportSettings = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${user.id}/export`);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mainframe-ai-settings-${user.username}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to export settings');
      }
    } catch (error) {
      console.error('Error exporting settings:', error);
      alert('Failed to export settings: ' + error.message);
    }
  };

  const importSettings = event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const importData = JSON.parse(e.target.result);

        const response = await fetch(`http://localhost:3001/api/settings/${user.id}/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(importData),
        });

        const result = await response.json();

        if (result.success) {
          setSettings(result.data);
          setHasChanges(false);

          // Apply imported settings
          if (result.data.theme) {
            window.themeManager?.applyTheme(result.data.theme);
          }
          if (result.data.language) {
            window.i18n?.setLanguage(result.data.language);
          }

          alert(`Successfully imported ${result.imported_fields.length} settings.`);
        } else {
          throw new Error(result.error || 'Failed to import settings');
        }
      } catch (error) {
        console.error('Error importing settings:', error);
        alert('Failed to import settings: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handleClose = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    setHasChanges(false);
    onClose();
  };

  const tabs = [
    { id: 'theme', label: 'Theme & Appearance', icon: '🎨' },
    { id: 'language', label: 'Language', icon: '🌐' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'display', label: 'Display', icon: '📺' },
    { id: 'apikeys', label: 'API Keys', icon: '🔑' },
    { id: 'data', label: 'Data Management', icon: '💾' },
  ];

  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
      onClick: e => e.target === e.currentTarget && handleClose(),
    },
    [
      React.createElement(
        'div',
        {
          key: 'modal',
          className:
            'bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col',
        },
        [
          // Modal Header
          React.createElement(
            'div',
            {
              key: 'header',
              className:
                'flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600',
            },
            [
              React.createElement(
                'h2',
                {
                  key: 'title',
                  className: 'text-2xl font-bold text-gray-900 dark:text-white',
                },
                'Settings'
              ),
              React.createElement(
                'button',
                {
                  key: 'close',
                  onClick: handleClose,
                  className:
                    'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold leading-none',
                },
                '×'
              ),
            ]
          ),

          // Modal Body with Tabs
          React.createElement(
            'div',
            {
              key: 'body',
              className: 'flex flex-1 overflow-hidden',
            },
            [
              // Sidebar with tabs
              React.createElement(
                'div',
                {
                  key: 'sidebar',
                  className:
                    'w-64 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 overflow-y-auto',
                },
                [
                  React.createElement(
                    'nav',
                    {
                      key: 'nav',
                      className: 'p-4 space-y-2',
                    },
                    tabs.map(tab =>
                      React.createElement(
                        'button',
                        {
                          key: tab.id,
                          onClick: () => setActiveTab(tab.id),
                          className: `w-full text-left p-3 rounded-lg transition-colors ${
                            activeTab === tab.id
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`,
                        },
                        [
                          React.createElement(
                            'div',
                            {
                              key: 'content',
                              className: 'flex items-center gap-3',
                            },
                            [
                              React.createElement(
                                'span',
                                {
                                  key: 'icon',
                                  className: 'text-lg',
                                },
                                tab.icon
                              ),
                              React.createElement(
                                'span',
                                {
                                  key: 'label',
                                  className: 'font-medium',
                                },
                                tab.label
                              ),
                            ]
                          ),
                        ]
                      )
                    )
                  ),
                ]
              ),

              // Content area
              React.createElement(
                'div',
                {
                  key: 'content',
                  className: 'flex-1 overflow-y-auto',
                },
                [
                  loading
                    ? React.createElement(
                        'div',
                        {
                          key: 'loading',
                          className: 'flex items-center justify-center h-full',
                        },
                        [
                          React.createElement('div', {
                            key: 'spinner',
                            className:
                              'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500',
                          }),
                        ]
                      )
                    : error
                      ? React.createElement(
                          'div',
                          {
                            key: 'error',
                            className: 'p-6',
                          },
                          [
                            React.createElement(
                              'div',
                              {
                                key: 'alert',
                                className:
                                  'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4',
                              },
                              [
                                React.createElement(
                                  'p',
                                  {
                                    key: 'message',
                                    className: 'text-red-700 dark:text-red-300',
                                  },
                                  error
                                ),
                                React.createElement(
                                  'button',
                                  {
                                    key: 'retry',
                                    onClick: loadSettings,
                                    className:
                                      'mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700',
                                  },
                                  'Retry'
                                ),
                              ]
                            ),
                          ]
                        )
                      : settings
                        ? React.createElement(
                            'div',
                            {
                              key: 'settings-content',
                              className: 'p-6',
                            },
                            [
                              // Render active tab component
                              activeTab === 'theme' &&
                                React.createElement(window.ThemeSettings || 'div', {
                                  key: 'theme-settings',
                                  settings,
                                  onUpdate: updateSettings,
                                  onMarkChanged: () => setHasChanges(true),
                                }),
                              activeTab === 'language' &&
                                React.createElement(window.LanguageSettings || 'div', {
                                  key: 'language-settings',
                                  settings,
                                  onUpdate: updateSettings,
                                  onMarkChanged: () => setHasChanges(true),
                                }),
                              activeTab === 'notifications' &&
                                React.createElement(window.NotificationSettings || 'div', {
                                  key: 'notification-settings',
                                  settings,
                                  onUpdate: updateSettings,
                                  onMarkChanged: () => setHasChanges(true),
                                }),
                              activeTab === 'display' &&
                                React.createElement(window.DisplaySettings || 'div', {
                                  key: 'display-settings',
                                  settings,
                                  onUpdate: updateSettings,
                                  onMarkChanged: () => setHasChanges(true),
                                }),
                              activeTab === 'apikeys' &&
                                React.createElement(window.ApiKeySettings || 'div', {
                                  key: 'apikey-settings',
                                  settings,
                                  onUpdate: updateSettings,
                                  onMarkChanged: () => setHasChanges(true),
                                }),
                              activeTab === 'data' &&
                                React.createElement(window.DataSettings || 'div', {
                                  key: 'data-settings',
                                  settings,
                                  onExport: exportSettings,
                                  onImport: importSettings,
                                  onReset: resetSettings,
                                }),
                            ]
                          )
                        : null,
                ]
              ),
            ]
          ),

          // Modal Footer
          React.createElement(
            'div',
            {
              key: 'footer',
              className:
                'flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700',
            },
            [
              React.createElement(
                'div',
                {
                  key: 'status',
                  className: 'flex items-center gap-2',
                },
                [
                  hasChanges &&
                    React.createElement(
                      'span',
                      {
                        key: 'changes',
                        className: 'text-sm text-yellow-600 dark:text-yellow-400',
                      },
                      '• Unsaved changes'
                    ),
                  saving &&
                    React.createElement(
                      'span',
                      {
                        key: 'saving',
                        className:
                          'text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2',
                      },
                      [
                        React.createElement('div', {
                          key: 'spinner',
                          className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500',
                        }),
                        'Saving...',
                      ]
                    ),
                ]
              ),
              React.createElement(
                'div',
                {
                  key: 'actions',
                  className: 'flex gap-3',
                },
                [
                  React.createElement(
                    'button',
                    {
                      key: 'cancel',
                      onClick: handleClose,
                      className:
                        'px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100',
                    },
                    'Close'
                  ),
                ]
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
  window.SettingsModal = SettingsModal;
}

module.exports = SettingsModal;
