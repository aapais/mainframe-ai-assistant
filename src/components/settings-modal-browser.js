// Settings Modal Component for Browser
// React component that works directly in the browser with Babel

window.SettingsModal = function ({ isOpen, onClose, userId }) {
  const [settings, setSettings] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('theme');
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, userId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await window.SettingsService.getSettings(userId || 1);
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettings(window.SettingsService.getDefaultSettings());
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setLoading(true);
    try {
      await window.SettingsService.updateSettings(userId || 1, settings);
      setHasChanges(false);

      // Show success message
      const toast = document.createElement('div');
      toast.className =
        'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
      toast.textContent = window.i18n.t('settingsSaved') || 'Settings saved successfully!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setLoading(false);
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);

    // Apply immediately for preview
    if (key === 'theme') {
      window.SettingsService.applyTheme(value);
    } else if (key === 'language') {
      window.SettingsService.applyLanguage(value);
    } else if (key === 'font_size') {
      document.documentElement.style.setProperty('--font-size-base', value + 'px');
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'theme', label: window.i18n.t('theme'), icon: '🎨' },
    { id: 'language', label: window.i18n.t('language'), icon: '🌍' },
    { id: 'notifications', label: window.i18n.t('notifications'), icon: '🔔' },
    { id: 'display', label: window.i18n.t('display'), icon: '💻' },
    { id: 'apiKeys', label: window.i18n.t('apiKeys'), icon: '🔑' },
    { id: 'data', label: window.i18n.t('data'), icon: '💾' },
  ];

  return React.createElement(
    'div',
    {
      className:
        'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 settings-modal',
    },
    [
      React.createElement(
        'div',
        {
          key: 'modal-content',
          className:
            'bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden fade-in',
        },
        [
          // Header
          React.createElement(
            'div',
            {
              key: 'header',
              className:
                'px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between',
            },
            [
              React.createElement(
                'h2',
                {
                  key: 'title',
                  className: 'text-2xl font-semibold dark:text-white',
                },
                window.i18n.t('settings')
              ),
              React.createElement(
                'button',
                {
                  key: 'close',
                  onClick: onClose,
                  className: 'p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg',
                },
                '✕'
              ),
            ]
          ),

          // Tabs
          React.createElement(
            'div',
            {
              key: 'tabs',
              className: 'flex border-b dark:border-gray-700',
            },
            tabs.map(tab =>
              React.createElement(
                'button',
                {
                  key: tab.id,
                  onClick: () => setActiveTab(tab.id),
                  className: `px-4 py-3 flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`,
                },
                [
                  React.createElement('span', { key: 'icon' }, tab.icon),
                  React.createElement('span', { key: 'label' }, tab.label),
                ]
              )
            )
          ),

          // Content
          React.createElement(
            'div',
            {
              key: 'content',
              className: 'p-6 overflow-y-auto',
              style: { maxHeight: 'calc(90vh - 200px)' },
            },
            loading
              ? React.createElement('div', { className: 'text-center py-8' }, 'Loading...')
              : React.createElement(TabContent, {
                  activeTab,
                  settings,
                  updateSetting,
                })
          ),

          // Footer
          React.createElement(
            'div',
            {
              key: 'footer',
              className: 'px-6 py-4 border-t dark:border-gray-700 flex justify-between',
            },
            [
              React.createElement(
                'button',
                {
                  key: 'reset',
                  onClick: () => {
                    if (confirm('Reset all settings to defaults?')) {
                      setSettings(window.SettingsService.getDefaultSettings());
                      setHasChanges(true);
                    }
                  },
                  className:
                    'px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg',
                },
                window.i18n.t('reset')
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
                      onClick: onClose,
                      className:
                        'px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg',
                    },
                    window.i18n.t('cancel')
                  ),
                  React.createElement(
                    'button',
                    {
                      key: 'save',
                      onClick: handleSave,
                      disabled: !hasChanges || loading,
                      className: `px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${hasChanges ? 'pulse' : ''}`,
                    },
                    window.i18n.t('save')
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

// Tab Content Component
window.TabContent = function ({ activeTab, settings, updateSetting }) {
  if (!settings) return null;

  switch (activeTab) {
    case 'theme':
      return React.createElement(ThemeTab, { settings, updateSetting });
    case 'language':
      return React.createElement(LanguageTab, { settings, updateSetting });
    case 'notifications':
      return React.createElement(NotificationsTab, { settings, updateSetting });
    case 'display':
      return React.createElement(DisplayTab, { settings, updateSetting });
    case 'apiKeys':
      return React.createElement(ApiKeysTab, { settings, updateSetting });
    case 'data':
      return React.createElement(DataTab, { settings, updateSetting });
    default:
      return null;
  }
};

// Theme Tab
window.ThemeTab = function ({ settings, updateSetting }) {
  const themes = [
    { id: 'light', label: window.i18n.t('light'), icon: '☀️', color: 'bg-yellow-100' },
    { id: 'dark', label: window.i18n.t('dark'), icon: '🌙', color: 'bg-gray-800' },
    { id: 'auto', label: window.i18n.t('auto'), icon: '🔄', color: 'bg-blue-100' },
  ];

  return React.createElement('div', { className: 'space-y-6' }, [
    React.createElement(
      'div',
      { key: 'theme-selector', className: 'grid grid-cols-3 gap-4' },
      themes.map(theme =>
        React.createElement(
          'button',
          {
            key: theme.id,
            onClick: () => updateSetting('theme', theme.id),
            className: `p-6 rounded-lg border-2 transition-all ${
              settings.theme === theme.id
                ? 'border-blue-500 shadow-lg scale-105'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`,
          },
          [
            React.createElement('div', { key: 'icon', className: 'text-3xl mb-2' }, theme.icon),
            React.createElement('div', { key: 'label', className: 'font-medium' }, theme.label),
          ]
        )
      )
    ),
    React.createElement(
      'div',
      {
        key: 'animations',
        className: 'flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg',
      },
      [
        React.createElement('label', { className: 'font-medium' }, 'Enable Animations'),
        React.createElement('input', {
          type: 'checkbox',
          checked: settings.enable_animations,
          onChange: e => updateSetting('enable_animations', e.target.checked),
          className: 'w-5 h-5',
        }),
      ]
    ),
  ]);
};

// Language Tab
window.LanguageTab = function ({ settings, updateSetting }) {
  const languages = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'pt', label: 'Português', flag: '🇵🇹' },
    { id: 'es', label: 'Español', flag: '🇪🇸' },
  ];

  return React.createElement(
    'div',
    { className: 'space-y-4' },
    languages.map(lang =>
      React.createElement(
        'button',
        {
          key: lang.id,
          onClick: () => updateSetting('language', lang.id),
          className: `w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
            settings.language === lang.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`,
        },
        [
          React.createElement('div', { key: 'info', className: 'flex items-center gap-3' }, [
            React.createElement('span', { key: 'flag', className: 'text-2xl' }, lang.flag),
            React.createElement('span', { key: 'label', className: 'font-medium' }, lang.label),
          ]),
          settings.language === lang.id &&
            React.createElement('span', { key: 'check', className: 'text-blue-500' }, '✓'),
        ]
      )
    )
  );
};

// Notifications Tab
window.NotificationsTab = function ({ settings, updateSetting }) {
  const notificationTypes = [
    { id: 'email', label: 'Email Notifications', icon: '📧' },
    { id: 'desktop', label: 'Desktop Notifications', icon: '💻' },
    { id: 'sound', label: 'Sound Alerts', icon: '🔊' },
    { id: 'incident_updates', label: 'Incident Updates', icon: '🚨' },
    { id: 'system_alerts', label: 'System Alerts', icon: '⚠️' },
    { id: 'mentions', label: 'Mentions', icon: '👤' },
  ];

  return React.createElement(
    'div',
    { className: 'space-y-4' },
    notificationTypes.map(type =>
      React.createElement(
        'div',
        {
          key: type.id,
          className: 'flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg',
        },
        [
          React.createElement('div', { key: 'info', className: 'flex items-center gap-3' }, [
            React.createElement('span', { key: 'icon', className: 'text-xl' }, type.icon),
            React.createElement('span', { key: 'label', className: 'font-medium' }, type.label),
          ]),
          React.createElement('input', {
            key: 'toggle',
            type: 'checkbox',
            checked: settings.notifications[type.id],
            onChange: e =>
              updateSetting('notifications', {
                ...settings.notifications,
                [type.id]: e.target.checked,
              }),
            className: 'w-5 h-5',
          }),
        ]
      )
    )
  );
};

// Display Tab
window.DisplayTab = function ({ settings, updateSetting }) {
  return React.createElement('div', { className: 'space-y-6' }, [
    // Font Size
    React.createElement('div', { key: 'font-size', className: 'space-y-2' }, [
      React.createElement(
        'label',
        { className: 'font-medium' },
        `Font Size: ${settings.font_size}px`
      ),
      React.createElement('input', {
        type: 'range',
        min: 10,
        max: 24,
        value: settings.font_size,
        onChange: e => updateSetting('font_size', parseInt(e.target.value)),
        className: 'w-full',
      }),
    ]),

    // Display Density
    React.createElement('div', { key: 'density', className: 'space-y-2' }, [
      React.createElement('label', { className: 'font-medium' }, 'Display Density'),
      React.createElement(
        'select',
        {
          value: settings.display_density,
          onChange: e => updateSetting('display_density', e.target.value),
          className: 'w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700',
        },
        [
          React.createElement('option', { key: 'compact', value: 'compact' }, 'Compact'),
          React.createElement('option', { key: 'normal', value: 'normal' }, 'Normal'),
          React.createElement(
            'option',
            { key: 'comfortable', value: 'comfortable' },
            'Comfortable'
          ),
        ]
      ),
    ]),

    // Other display options
    React.createElement('div', { key: 'options', className: 'space-y-3' }, [
      React.createElement('label', { key: 'sidebar', className: 'flex items-center gap-3' }, [
        React.createElement('input', {
          type: 'checkbox',
          checked: settings.sidebar_collapsed,
          onChange: e => updateSetting('sidebar_collapsed', e.target.checked),
          className: 'w-5 h-5',
        }),
        React.createElement('span', {}, 'Collapse Sidebar by Default'),
      ]),
      React.createElement('label', { key: 'lines', className: 'flex items-center gap-3' }, [
        React.createElement('input', {
          type: 'checkbox',
          checked: settings.show_line_numbers,
          onChange: e => updateSetting('show_line_numbers', e.target.checked),
          className: 'w-5 h-5',
        }),
        React.createElement('span', {}, 'Show Line Numbers'),
      ]),
    ]),
  ]);
};

// API Keys Tab
window.ApiKeysTab = function ({ settings, updateSetting }) {
  const [showKeys, setShowKeys] = React.useState({});

  const apiServices = [
    { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { id: 'anthropic', label: 'Anthropic Claude', placeholder: 'sk-ant-...' },
    { id: 'google', label: 'Google Gemini', placeholder: 'AIza...' },
  ];

  return React.createElement(
    'div',
    { className: 'space-y-4' },
    apiServices.map(service =>
      React.createElement(
        'div',
        {
          key: service.id,
          className: 'p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2',
        },
        [
          React.createElement('label', { key: 'label', className: 'font-medium' }, service.label),
          React.createElement('div', { key: 'input-group', className: 'flex gap-2' }, [
            React.createElement('input', {
              key: 'input',
              type: showKeys[service.id] ? 'text' : 'password',
              value: settings.api_keys[service.id] || '',
              onChange: e =>
                updateSetting('api_keys', {
                  ...settings.api_keys,
                  [service.id]: e.target.value,
                }),
              placeholder: service.placeholder,
              className: 'flex-1 p-2 border rounded dark:bg-gray-900 dark:border-gray-700',
            }),
            React.createElement(
              'button',
              {
                key: 'toggle',
                onClick: () => setShowKeys(prev => ({ ...prev, [service.id]: !prev[service.id] })),
                className: 'px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300',
              },
              showKeys[service.id] ? '🙈' : '👁️'
            ),
          ]),
        ]
      )
    )
  );
};

// Data Tab
window.DataTab = function ({ settings, updateSetting }) {
  return React.createElement('div', { className: 'space-y-6' }, [
    // Export Format
    React.createElement('div', { key: 'export', className: 'space-y-2' }, [
      React.createElement('label', { className: 'font-medium' }, 'Export Format'),
      React.createElement(
        'select',
        {
          value: settings.export_format,
          onChange: e => updateSetting('export_format', e.target.value),
          className: 'w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700',
        },
        [
          React.createElement('option', { key: 'json', value: 'json' }, 'JSON'),
          React.createElement('option', { key: 'csv', value: 'csv' }, 'CSV'),
          React.createElement('option', { key: 'xml', value: 'xml' }, 'XML'),
        ]
      ),
    ]),

    // Auto Save
    React.createElement(
      'div',
      {
        key: 'autosave',
        className: 'flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg',
      },
      [
        React.createElement('label', { className: 'font-medium' }, 'Auto Save'),
        React.createElement('input', {
          type: 'checkbox',
          checked: settings.auto_save,
          onChange: e => updateSetting('auto_save', e.target.checked),
          className: 'w-5 h-5',
        }),
      ]
    ),

    // Actions
    React.createElement('div', { key: 'actions', className: 'space-y-3' }, [
      React.createElement(
        'button',
        {
          key: 'export',
          className: 'w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
        },
        '📥 Export Settings'
      ),
      React.createElement(
        'button',
        {
          key: 'import',
          className: 'w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700',
        },
        '📤 Import Settings'
      ),
      React.createElement(
        'button',
        {
          key: 'clear',
          className: 'w-full p-3 bg-red-600 text-white rounded-lg hover:bg-red-700',
        },
        '🗑️ Clear All Data'
      ),
    ]),
  ]);
};
