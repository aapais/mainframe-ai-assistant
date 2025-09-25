const React = require('react');
const { useState, useEffect } = React;

const DataSettings = ({ settings, onExport, onImport, onReset }) => {
  const [exportFormat, setExportFormat] = useState(settings?.export_format || 'json');
  const [autoSave, setAutoSave] = useState(settings?.auto_save !== false);
  const [autoSaveInterval, setAutoSaveInterval] = useState(settings?.auto_save_interval || 30);
  const [searchHistoryEnabled, setSearchHistoryEnabled] = useState(
    settings?.search_history_enabled !== false
  );
  const [recentSearchesLimit, setRecentSearchesLimit] = useState(
    settings?.recent_searches_limit || 10
  );
  const [exportInProgress, setExportInProgress] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  useEffect(() => {
    setExportFormat(settings?.export_format || 'json');
    setAutoSave(settings?.auto_save !== false);
    setAutoSaveInterval(settings?.auto_save_interval || 30);
    setSearchHistoryEnabled(settings?.search_history_enabled !== false);
    setRecentSearchesLimit(settings?.recent_searches_limit || 10);

    // Load last backup timestamp from localStorage
    const lastBackupTime = localStorage.getItem('mainframe_ai_last_backup');
    if (lastBackupTime) {
      setLastBackup(new Date(lastBackupTime));
    }
  }, [settings]);

  const exportFormats = [
    {
      id: 'json',
      name: 'JSON',
      description: 'JavaScript Object Notation - best for reimporting',
      extension: '.json',
      icon: '📝',
    },
    {
      id: 'csv',
      name: 'CSV',
      description: 'Comma-Separated Values - good for spreadsheets',
      extension: '.csv',
      icon: '📈',
    },
    {
      id: 'xml',
      name: 'XML',
      description: 'Extensible Markup Language - structured format',
      extension: '.xml',
      icon: '📰',
    },
  ];

  const handleExport = async () => {
    setExportInProgress(true);
    try {
      await onExport();

      // Update last backup timestamp
      const now = new Date();
      localStorage.setItem('mainframe_ai_last_backup', now.toISOString());
      setLastBackup(now);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export settings: ' + error.message);
    } finally {
      setExportInProgress(false);
    }
  };

  const handleImport = event => {
    const file = event.target.files[0];
    if (!file) return;

    setImportInProgress(true);
    onImport(event).finally(() => {
      setImportInProgress(false);
      event.target.value = ''; // Reset file input
    });
  };

  const handleReset = async () => {
    if (
      confirm('This will reset ALL settings to default values and cannot be undone. Are you sure?')
    ) {
      await onReset();
    }
  };

  const handleAutoSaveToggle = async enabled => {
    setAutoSave(enabled);
    // This would typically call onUpdate from parent, but DataSettings is read-only
    // The actual update would be handled by the parent component
    console.log('Auto-save toggled:', enabled);
  };

  const handleAutoSaveIntervalChange = interval => {
    setAutoSaveInterval(interval);
    console.log('Auto-save interval changed:', interval);
  };

  const clearSearchHistory = () => {
    if (confirm('This will permanently delete your search history. Are you sure?')) {
      localStorage.removeItem('mainframe_ai_search_history');
      localStorage.removeItem('mainframe_ai_recent_searches');
      alert('Search history has been cleared.');
    }
  };

  const clearAllLocalData = () => {
    if (
      confirm(
        'This will delete ALL local data including settings, cache, and search history. This action cannot be undone. Are you sure?'
      )
    ) {
      // Clear all mainframe AI related data
      Object.keys(localStorage).forEach(key => {
        if (key.includes('mainframe_ai') || key.includes('settings') || key.includes('cache')) {
          localStorage.removeItem(key);
        }
      });

      // Clear session storage
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('mainframe_ai') || key.includes('settings') || key.includes('cache')) {
          sessionStorage.removeItem(key);
        }
      });

      alert('All local data has been cleared. The page will reload.');
      window.location.reload();
    }
  };

  const getDataSize = () => {
    let totalSize = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.includes('mainframe_ai') || key.includes('settings')) {
        totalSize += new Blob([localStorage[key]]).size;
      }
    });

    if (totalSize < 1024) {
      return `${totalSize} bytes`;
    } else if (totalSize < 1024 * 1024) {
      return `${(totalSize / 1024).toFixed(1)} KB`;
    } else {
      return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    }
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
            'Data Management'
          ),
          React.createElement(
            'p',
            {
              key: 'description',
              className: 'text-sm text-gray-600 dark:text-gray-400',
            },
            'Export, import, and manage your application data and settings'
          ),
        ]
      ),

      // Data Overview
      React.createElement(
        'div',
        {
          key: 'data-overview',
          className:
            'bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'overview-title',
              className: 'font-medium text-gray-900 dark:text-white mb-3',
            },
            'Data Overview'
          ),
          React.createElement(
            'div',
            {
              key: 'overview-stats',
              className: 'grid grid-cols-2 md:grid-cols-4 gap-4 text-sm',
            },
            [
              React.createElement(
                'div',
                {
                  key: 'storage-size',
                  className: 'text-center',
                },
                [
                  React.createElement(
                    'div',
                    {
                      key: 'size-value',
                      className: 'text-lg font-semibold text-blue-600 dark:text-blue-400',
                    },
                    getDataSize()
                  ),
                  React.createElement(
                    'div',
                    {
                      key: 'size-label',
                      className: 'text-gray-600 dark:text-gray-400',
                    },
                    'Storage Used'
                  ),
                ]
              ),
              React.createElement(
                'div',
                {
                  key: 'last-backup-stat',
                  className: 'text-center',
                },
                [
                  React.createElement(
                    'div',
                    {
                      key: 'backup-value',
                      className: 'text-lg font-semibold text-green-600 dark:text-green-400',
                    },
                    lastBackup ? lastBackup.toLocaleDateString() : 'Never'
                  ),
                  React.createElement(
                    'div',
                    {
                      key: 'backup-label',
                      className: 'text-gray-600 dark:text-gray-400',
                    },
                    'Last Backup'
                  ),
                ]
              ),
              React.createElement(
                'div',
                {
                  key: 'auto-save-stat',
                  className: 'text-center',
                },
                [
                  React.createElement(
                    'div',
                    {
                      key: 'autosave-value',
                      className: `text-lg font-semibold ${
                        autoSave
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`,
                    },
                    autoSave ? 'On' : 'Off'
                  ),
                  React.createElement(
                    'div',
                    {
                      key: 'autosave-label',
                      className: 'text-gray-600 dark:text-gray-400',
                    },
                    'Auto-save'
                  ),
                ]
              ),
              React.createElement(
                'div',
                {
                  key: 'format-stat',
                  className: 'text-center',
                },
                [
                  React.createElement(
                    'div',
                    {
                      key: 'format-value',
                      className: 'text-lg font-semibold text-purple-600 dark:text-purple-400',
                    },
                    exportFormat.toUpperCase()
                  ),
                  React.createElement(
                    'div',
                    {
                      key: 'format-label',
                      className: 'text-gray-600 dark:text-gray-400',
                    },
                    'Export Format'
                  ),
                ]
              ),
            ]
          ),
        ]
      ),

      // Export Settings
      React.createElement(
        'div',
        {
          key: 'export-section',
          className: 'space-y-4',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'export-title',
              className: 'font-medium text-gray-900 dark:text-white',
            },
            'Export Data'
          ),
          React.createElement(
            'p',
            {
              key: 'export-desc',
              className: 'text-sm text-gray-600 dark:text-gray-400',
            },
            'Download your settings and preferences as a backup file'
          ),

          // Export Format Selection
          React.createElement(
            'div',
            {
              key: 'export-format',
              className: 'space-y-3',
            },
            [
              React.createElement(
                'label',
                {
                  key: 'format-label',
                  className: 'block text-sm font-medium text-gray-700 dark:text-gray-300',
                },
                'Export Format:'
              ),
              React.createElement(
                'div',
                {
                  key: 'format-options',
                  className: 'grid grid-cols-1 md:grid-cols-3 gap-3',
                },
                exportFormats.map(format =>
                  React.createElement(
                    'button',
                    {
                      key: format.id,
                      onClick: () => setExportFormat(format.id),
                      className: `p-3 border-2 rounded-lg text-left transition-all ${
                        exportFormat === format.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`,
                    },
                    [
                      React.createElement(
                        'div',
                        {
                          key: 'format-header',
                          className: 'flex items-center gap-2 mb-1',
                        },
                        [
                          React.createElement(
                            'span',
                            {
                              key: 'format-icon',
                              className: 'text-lg',
                            },
                            format.icon
                          ),
                          React.createElement(
                            'span',
                            {
                              key: 'format-name',
                              className: 'font-medium text-gray-900 dark:text-white',
                            },
                            format.name
                          ),
                        ]
                      ),
                      React.createElement(
                        'p',
                        {
                          key: 'format-desc',
                          className: 'text-xs text-gray-600 dark:text-gray-400',
                        },
                        format.description
                      ),
                    ]
                  )
                )
              ),
            ]
          ),

          // Export Button
          React.createElement(
            'button',
            {
              key: 'export-btn',
              onClick: handleExport,
              disabled: exportInProgress,
              className: `flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed ${
                exportInProgress ? 'animate-pulse' : ''
              }`,
            },
            [
              React.createElement(
                'span',
                {
                  key: 'export-icon',
                },
                exportInProgress ? '⏳' : '💾'
              ),
              React.createElement(
                'span',
                {
                  key: 'export-text',
                },
                exportInProgress ? 'Exporting...' : 'Export Settings'
              ),
            ]
          ),
        ]
      ),

      // Import Settings
      React.createElement(
        'div',
        {
          key: 'import-section',
          className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'import-title',
              className: 'font-medium text-gray-900 dark:text-white',
            },
            'Import Data'
          ),
          React.createElement(
            'p',
            {
              key: 'import-desc',
              className: 'text-sm text-gray-600 dark:text-gray-400',
            },
            'Restore settings from a previously exported backup file'
          ),

          React.createElement(
            'div',
            {
              key: 'import-controls',
              className: 'flex items-center gap-4',
            },
            [
              React.createElement('input', {
                key: 'import-input',
                type: 'file',
                id: 'import-file',
                accept: '.json,.csv,.xml',
                onChange: handleImport,
                className: 'hidden',
              }),
              React.createElement(
                'label',
                {
                  key: 'import-label',
                  htmlFor: 'import-file',
                  className: `flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer ${
                    importInProgress ? 'opacity-50 cursor-not-allowed' : ''
                  }`,
                },
                [
                  React.createElement(
                    'span',
                    {
                      key: 'import-icon',
                    },
                    importInProgress ? '⏳' : '📁'
                  ),
                  React.createElement(
                    'span',
                    {
                      key: 'import-text',
                    },
                    importInProgress ? 'Importing...' : 'Choose File to Import'
                  ),
                ]
              ),
            ]
          ),

          // Import Warning
          React.createElement(
            'div',
            {
              key: 'import-warning',
              className:
                'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded p-3',
            },
            [
              React.createElement(
                'p',
                {
                  key: 'warning-text',
                  className: 'text-sm text-yellow-700 dark:text-yellow-300',
                },
                '⚠️ Importing will overwrite your current settings. Make sure to export your current settings first as a backup.'
              ),
            ]
          ),
        ]
      ),

      // Auto-save Settings
      React.createElement(
        'div',
        {
          key: 'autosave-section',
          className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'autosave-title',
              className: 'font-medium text-gray-900 dark:text-white',
            },
            'Auto-save Settings'
          ),

          React.createElement(
            'div',
            {
              key: 'autosave-toggle',
              className: 'flex items-center justify-between',
            },
            [
              React.createElement(
                'div',
                {
                  key: 'autosave-info',
                },
                [
                  React.createElement(
                    'label',
                    {
                      key: 'autosave-label',
                      className: 'text-sm font-medium text-gray-900 dark:text-white',
                    },
                    'Enable Auto-save'
                  ),
                  React.createElement(
                    'p',
                    {
                      key: 'autosave-desc',
                      className: 'text-xs text-gray-600 dark:text-gray-400 mt-1',
                    },
                    'Automatically save changes as you make them'
                  ),
                ]
              ),
              React.createElement(
                'button',
                {
                  key: 'autosave-switch',
                  onClick: () => handleAutoSaveToggle(!autoSave),
                  className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoSave ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`,
                },
                [
                  React.createElement('span', {
                    key: 'autosave-handle',
                    className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSave ? 'translate-x-6' : 'translate-x-1'
                    }`,
                  }),
                ]
              ),
            ]
          ),

          autoSave &&
            React.createElement(
              'div',
              {
                key: 'autosave-interval',
                className: 'space-y-2',
              },
              [
                React.createElement(
                  'label',
                  {
                    key: 'interval-label',
                    className: 'block text-sm font-medium text-gray-700 dark:text-gray-300',
                  },
                  `Auto-save Interval: ${autoSaveInterval} seconds`
                ),
                React.createElement('input', {
                  key: 'interval-slider',
                  type: 'range',
                  min: 10,
                  max: 300,
                  step: 10,
                  value: autoSaveInterval,
                  onChange: e => handleAutoSaveIntervalChange(parseInt(e.target.value)),
                  className:
                    'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer',
                }),
                React.createElement(
                  'div',
                  {
                    key: 'interval-labels',
                    className: 'flex justify-between text-xs text-gray-600 dark:text-gray-400',
                  },
                  [
                    React.createElement(
                      'span',
                      {
                        key: 'min-label',
                      },
                      '10s'
                    ),
                    React.createElement(
                      'span',
                      {
                        key: 'mid-label',
                      },
                      '2m'
                    ),
                    React.createElement(
                      'span',
                      {
                        key: 'max-label',
                      },
                      '5m'
                    ),
                  ]
                ),
              ]
            ),
        ]
      ),

      // Data Cleanup
      React.createElement(
        'div',
        {
          key: 'cleanup-section',
          className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'cleanup-title',
              className: 'font-medium text-gray-900 dark:text-white text-red-700 dark:text-red-400',
            },
            '🧹 Data Cleanup'
          ),
          React.createElement(
            'p',
            {
              key: 'cleanup-desc',
              className: 'text-sm text-gray-600 dark:text-gray-400',
            },
            'Remove stored data to free up space or start fresh'
          ),

          React.createElement(
            'div',
            {
              key: 'cleanup-buttons',
              className: 'space-y-3',
            },
            [
              React.createElement(
                'button',
                {
                  key: 'clear-search',
                  onClick: clearSearchHistory,
                  className:
                    'block w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-left',
                },
                '🔍 Clear Search History'
              ),

              React.createElement(
                'button',
                {
                  key: 'reset-settings',
                  onClick: handleReset,
                  className:
                    'block w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-left',
                },
                '⚙️ Reset All Settings to Defaults'
              ),

              React.createElement(
                'button',
                {
                  key: 'clear-all',
                  onClick: clearAllLocalData,
                  className:
                    'block w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-left',
                },
                '🗑️ Clear All Local Data'
              ),
            ]
          ),
        ]
      ),

      // Data Info
      React.createElement(
        'div',
        {
          key: 'data-info',
          className:
            'bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700',
        },
        [
          React.createElement(
            'h4',
            {
              key: 'info-title',
              className: 'font-medium text-blue-900 dark:text-blue-100 mb-2',
            },
            '📊 Data Information'
          ),
          React.createElement(
            'ul',
            {
              key: 'info-list',
              className: 'text-sm text-blue-800 dark:text-blue-200 space-y-1',
            },
            [
              React.createElement(
                'li',
                {
                  key: 'info1',
                },
                '• Your data is stored locally in your browser'
              ),
              React.createElement(
                'li',
                {
                  key: 'info2',
                },
                '• Regular backups help prevent data loss'
              ),
              React.createElement(
                'li',
                {
                  key: 'info3',
                },
                '• Export before major browser updates or computer changes'
              ),
              React.createElement(
                'li',
                {
                  key: 'info4',
                },
                '• API keys are encrypted and not included in basic exports'
              ),
              React.createElement(
                'li',
                {
                  key: 'info5',
                },
                '• Search history and cache can be cleared separately'
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
  window.DataSettings = DataSettings;
}

module.exports = DataSettings;
