// Advanced Settings Modal Component for Browser
// Focused only on technical and advanced configuration options
// Basic settings are handled by individual menu modals

window.AdvancedSettingsModal = function({ isOpen, onClose, userId }) {
    const [settings, setSettings] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('api');
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
            toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
            toast.textContent = 'Configurações avançadas salvas!';
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
            [key]: value
        }));
        setHasChanges(true);

        // Apply immediately for preview
        if (key === 'font_size') {
            document.documentElement.style.setProperty('--font-size-base', value + 'px');
        } else if (key === 'display_density') {
            document.body.setAttribute('data-density', value);
        }
    };

    if (!isOpen) return null;

    // Only 4 tabs for truly advanced settings
    const tabs = [
        { id: 'api', label: 'API Integration', icon: '🔌' },
        { id: 'performance', label: 'Performance & Display', icon: '⚡' },
        { id: 'data', label: 'Data Management', icon: '💾' },
        { id: 'system', label: 'System & Security', icon: '🔐' }
    ];

    // Tab content renderers
    const renderApiTab = () => {
        if (!settings) return null;

        return React.createElement('div', { className: 'space-y-6' }, [
            React.createElement('div', { key: 'api-header', className: 'mb-4' }, [
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-800 mb-2' }, '🔌 API Integration'),
                React.createElement('p', { className: 'text-sm text-gray-500' },
                    'Configure external API connections and integration settings')
            ]),

            // API Keys
            React.createElement('div', { key: 'api-keys', className: 'space-y-4' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'API Keys'),

                // OpenAI
                React.createElement('div', { key: 'openai' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'OpenAI API Key'),
                    React.createElement('input', {
                        type: 'password',
                        value: settings.api_keys?.openai || '',
                        onChange: (e) => updateSetting('api_keys', { ...settings.api_keys, openai: e.target.value }),
                        className: 'w-full px-3 py-2 border rounded-lg font-mono text-sm',
                        placeholder: 'sk-...'
                    })
                ]),

                // Anthropic
                React.createElement('div', { key: 'anthropic' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'Anthropic API Key'),
                    React.createElement('input', {
                        type: 'password',
                        value: settings.api_keys?.anthropic || '',
                        onChange: (e) => updateSetting('api_keys', { ...settings.api_keys, anthropic: e.target.value }),
                        className: 'w-full px-3 py-2 border rounded-lg font-mono text-sm',
                        placeholder: 'sk-ant-...'
                    })
                ]),

                // Google
                React.createElement('div', { key: 'google' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'Google API Key'),
                    React.createElement('input', {
                        type: 'password',
                        value: settings.api_keys?.google || '',
                        onChange: (e) => updateSetting('api_keys', { ...settings.api_keys, google: e.target.value }),
                        className: 'w-full px-3 py-2 border rounded-lg font-mono text-sm',
                        placeholder: 'AIza...'
                    })
                ])
            ]),

            // API Settings
            React.createElement('div', { key: 'api-settings', className: 'space-y-4 pt-4 border-t' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'API Configuration'),

                React.createElement('div', { key: 'rate-limit' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'Rate Limit (requests/min)'),
                    React.createElement('input', {
                        type: 'number',
                        value: settings.api_rate_limit || 60,
                        onChange: (e) => updateSetting('api_rate_limit', e.target.value),
                        className: 'w-full px-3 py-2 border rounded-lg',
                        min: 1,
                        max: 1000
                    })
                ]),

                React.createElement('div', { key: 'timeout' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'Request Timeout (seconds)'),
                    React.createElement('input', {
                        type: 'number',
                        value: settings.api_timeout || 30,
                        onChange: (e) => updateSetting('api_timeout', e.target.value),
                        className: 'w-full px-3 py-2 border rounded-lg',
                        min: 5,
                        max: 300
                    })
                ])
            ])
        ]);
    };

    const renderPerformanceTab = () => {
        if (!settings) return null;

        return React.createElement('div', { className: 'space-y-6' }, [
            React.createElement('div', { key: 'perf-header', className: 'mb-4' }, [
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-800 mb-2' }, '⚡ Performance & Display'),
                React.createElement('p', { className: 'text-sm text-gray-500' },
                    'Optimize performance and customize display settings')
            ]),

            // Display Settings
            React.createElement('div', { key: 'display-settings', className: 'space-y-4' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Display Configuration'),

                // Font Size
                React.createElement('div', { key: 'font-size' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' },
                        `Font Size: ${settings.font_size || 14}px`),
                    React.createElement('input', {
                        type: 'range',
                        value: settings.font_size || 14,
                        onChange: (e) => updateSetting('font_size', parseInt(e.target.value)),
                        className: 'w-full',
                        min: 10,
                        max: 20
                    })
                ]),

                // Display Density
                React.createElement('div', { key: 'density' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'Display Density'),
                    React.createElement('select', {
                        value: settings.display_density || 'normal',
                        onChange: (e) => updateSetting('display_density', e.target.value),
                        className: 'w-full px-3 py-2 border rounded-lg'
                    }, [
                        React.createElement('option', { key: 'compact', value: 'compact' }, 'Compact'),
                        React.createElement('option', { key: 'normal', value: 'normal' }, 'Normal'),
                        React.createElement('option', { key: 'comfortable', value: 'comfortable' }, 'Comfortable')
                    ])
                ]),

                // Toggle Settings
                React.createElement('div', { key: 'toggles', className: 'space-y-3' }, [
                    React.createElement('label', { key: 'sidebar', className: 'flex items-center gap-3' }, [
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: settings.sidebar_collapsed || false,
                            onChange: (e) => updateSetting('sidebar_collapsed', e.target.checked),
                            className: 'w-5 h-5'
                        }),
                        React.createElement('span', { className: 'text-sm' }, 'Collapse sidebar by default')
                    ]),

                    React.createElement('label', { key: 'line-numbers', className: 'flex items-center gap-3' }, [
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: settings.show_line_numbers || false,
                            onChange: (e) => updateSetting('show_line_numbers', e.target.checked),
                            className: 'w-5 h-5'
                        }),
                        React.createElement('span', { className: 'text-sm' }, 'Show line numbers in code blocks')
                    ]),

                    React.createElement('label', { key: 'animations', className: 'flex items-center gap-3' }, [
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: settings.enable_animations || false,
                            onChange: (e) => updateSetting('enable_animations', e.target.checked),
                            className: 'w-5 h-5'
                        }),
                        React.createElement('span', { className: 'text-sm' }, 'Enable animations')
                    ])
                ])
            ]),

            // Performance Settings
            React.createElement('div', { key: 'perf-settings', className: 'space-y-4 pt-4 border-t' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Performance Optimization'),

                React.createElement('label', { key: 'cache', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.cache_enabled || false,
                        onChange: (e) => updateSetting('cache_enabled', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Enable cache for faster loading')
                ]),

                React.createElement('div', { key: 'search-limit' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' },
                        'Recent searches limit'),
                    React.createElement('input', {
                        type: 'number',
                        value: settings.recent_searches_limit || 10,
                        onChange: (e) => updateSetting('recent_searches_limit', parseInt(e.target.value)),
                        className: 'w-full px-3 py-2 border rounded-lg',
                        min: 5,
                        max: 50
                    })
                ])
            ])
        ]);
    };

    const renderDataTab = () => {
        if (!settings) return null;

        return React.createElement('div', { className: 'space-y-6' }, [
            React.createElement('div', { key: 'data-header', className: 'mb-4' }, [
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-800 mb-2' }, '💾 Data Management'),
                React.createElement('p', { className: 'text-sm text-gray-500' },
                    'Manage data storage, backup, and export settings')
            ]),

            // Export Settings
            React.createElement('div', { key: 'export-settings', className: 'space-y-4' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Export Configuration'),

                React.createElement('div', { key: 'format' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' }, 'Default Export Format'),
                    React.createElement('select', {
                        value: settings.export_format || 'json',
                        onChange: (e) => updateSetting('export_format', e.target.value),
                        className: 'w-full px-3 py-2 border rounded-lg'
                    }, [
                        React.createElement('option', { key: 'json', value: 'json' }, 'JSON'),
                        React.createElement('option', { key: 'csv', value: 'csv' }, 'CSV'),
                        React.createElement('option', { key: 'xml', value: 'xml' }, 'XML'),
                        React.createElement('option', { key: 'excel', value: 'excel' }, 'Excel')
                    ])
                ])
            ]),

            // Auto-save Settings
            React.createElement('div', { key: 'autosave', className: 'space-y-4 pt-4 border-t' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Auto-save Configuration'),

                React.createElement('label', { key: 'autosave-toggle', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.auto_save || false,
                        onChange: (e) => updateSetting('auto_save', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Enable auto-save')
                ]),

                settings.auto_save && React.createElement('div', { key: 'interval' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' },
                        'Auto-save interval (seconds)'),
                    React.createElement('input', {
                        type: 'number',
                        value: settings.auto_save_interval || 30,
                        onChange: (e) => updateSetting('auto_save_interval', parseInt(e.target.value)),
                        className: 'w-full px-3 py-2 border rounded-lg',
                        min: 10,
                        max: 300
                    })
                ])
            ]),

            // Data Actions
            React.createElement('div', { key: 'actions', className: 'space-y-4 pt-4 border-t' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Data Actions'),

                React.createElement('div', { className: 'flex gap-3' }, [
                    React.createElement('button', {
                        key: 'export',
                        onClick: () => {
                            const dataStr = JSON.stringify(settings, null, 2);
                            const dataBlob = new Blob([dataStr], {type: 'application/json'});
                            const url = URL.createObjectURL(dataBlob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = 'settings.json';
                            link.click();
                        },
                        className: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                    }, '📥 Export Settings'),

                    React.createElement('button', {
                        key: 'import',
                        onClick: () => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json';
                            input.onchange = (e) => {
                                const file = e.target.files[0];
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                    try {
                                        const imported = JSON.parse(evt.target.result);
                                        setSettings(imported);
                                        setHasChanges(true);
                                    } catch (err) {
                                        alert('Invalid settings file');
                                    }
                                };
                                reader.readAsText(file);
                            };
                            input.click();
                        },
                        className: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'
                    }, '📤 Import Settings'),

                    React.createElement('button', {
                        key: 'clear',
                        onClick: () => {
                            if (confirm('Clear all data? This cannot be undone.')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        },
                        className: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'
                    }, '🗑️ Clear Data')
                ])
            ])
        ]);
    };

    const renderSystemTab = () => {
        if (!settings) return null;

        return React.createElement('div', { className: 'space-y-6' }, [
            React.createElement('div', { key: 'system-header', className: 'mb-4' }, [
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-800 mb-2' }, '🔐 System & Security'),
                React.createElement('p', { className: 'text-sm text-gray-500' },
                    'System configuration and security settings')
            ]),

            // Security Settings
            React.createElement('div', { key: 'security', className: 'space-y-4' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Security Configuration'),

                React.createElement('label', { key: 'https', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.force_https || false,
                        onChange: (e) => updateSetting('force_https', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Force HTTPS connections')
                ]),

                React.createElement('label', { key: 'audit', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.enable_audit_trail || false,
                        onChange: (e) => updateSetting('enable_audit_trail', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Enable audit trail logging')
                ]),

                React.createElement('div', { key: 'session-timeout' }, [
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-600 mb-1' },
                        'Session timeout (minutes)'),
                    React.createElement('input', {
                        type: 'number',
                        value: settings.session_timeout || 30,
                        onChange: (e) => updateSetting('session_timeout', parseInt(e.target.value)),
                        className: 'w-full px-3 py-2 border rounded-lg',
                        min: 5,
                        max: 1440
                    })
                ])
            ]),

            // Developer Settings
            React.createElement('div', { key: 'developer', className: 'space-y-4 pt-4 border-t' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700' }, 'Developer Options'),

                React.createElement('label', { key: 'debug', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.debug_mode || false,
                        onChange: (e) => updateSetting('debug_mode', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Enable debug mode')
                ]),

                React.createElement('label', { key: 'console', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.verbose_console || false,
                        onChange: (e) => updateSetting('verbose_console', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Verbose console output')
                ]),

                React.createElement('label', { key: 'devtools', className: 'flex items-center gap-3' }, [
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: settings.enable_devtools || false,
                        onChange: (e) => updateSetting('enable_devtools', e.target.checked),
                        className: 'w-5 h-5'
                    }),
                    React.createElement('span', { className: 'text-sm' }, 'Enable developer tools')
                ])
            ]),

            // System Info
            React.createElement('div', { key: 'info', className: 'space-y-2 pt-4 border-t' }, [
                React.createElement('h4', { className: 'font-medium text-gray-700 mb-2' }, 'System Information'),
                React.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg space-y-1 text-sm font-mono' }, [
                    React.createElement('div', { key: 'version' }, `Version: 2.0.0`),
                    React.createElement('div', { key: 'build' }, `Build: ${new Date().toISOString().split('T')[0]}`),
                    React.createElement('div', { key: 'browser' }, `Browser: ${navigator.userAgent.split(' ').pop()}`),
                    React.createElement('div', { key: 'platform' }, `Platform: ${navigator.platform}`)
                ])
            ])
        ]);
    };

    return React.createElement('div', {
        className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    }, [
        React.createElement('div', {
            key: 'modal-content',
            className: 'bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden fade-in'
        }, [
            // Header
            React.createElement('div', {
                key: 'header',
                className: 'px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-700'
            }, [
                React.createElement('h2', {
                    key: 'title',
                    className: 'text-2xl font-semibold text-white'
                }, '⚙️ Configurações Avançadas'),
                React.createElement('button', {
                    key: 'close',
                    onClick: onClose,
                    className: 'p-2 hover:bg-white/10 rounded-lg text-white'
                }, '✕')
            ]),

            // Tabs
            React.createElement('div', {
                key: 'tabs',
                className: 'px-6 py-3 border-b bg-gray-50 flex space-x-1 overflow-x-auto'
            }, tabs.map(tab =>
                React.createElement('button', {
                    key: tab.id,
                    onClick: () => setActiveTab(tab.id),
                    className: `px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-200 text-gray-600'
                    }`
                }, [
                    React.createElement('span', { key: 'icon' }, tab.icon),
                    React.createElement('span', { key: 'label' }, tab.label)
                ])
            )),

            // Content
            React.createElement('div', {
                key: 'content',
                className: 'px-6 py-4 overflow-y-auto',
                style: { maxHeight: 'calc(90vh - 200px)' }
            }, loading ?
                React.createElement('div', { className: 'text-center py-8' }, 'Loading...') :
                activeTab === 'api' ? renderApiTab() :
                activeTab === 'performance' ? renderPerformanceTab() :
                activeTab === 'data' ? renderDataTab() :
                activeTab === 'system' ? renderSystemTab() :
                null
            ),

            // Footer
            React.createElement('div', {
                key: 'footer',
                className: 'px-6 py-4 border-t bg-gray-50 flex justify-between items-center'
            }, [
                React.createElement('div', { key: 'warning', className: 'text-xs text-amber-600 flex items-center gap-2' }, [
                    React.createElement('span', {}, '⚠️'),
                    React.createElement('span', {}, 'Estas são configurações avançadas. Alterações incorretas podem afetar o sistema.')
                ]),
                React.createElement('div', { key: 'actions', className: 'flex gap-3' }, [
                    React.createElement('button', {
                        key: 'reset',
                        onClick: () => {
                            if (confirm('Restaurar configurações padrão?')) {
                                setSettings(window.SettingsService.getDefaultSettings());
                                setHasChanges(true);
                            }
                        },
                        className: 'px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg'
                    }, 'Restaurar Padrões'),

                    React.createElement('button', {
                        key: 'cancel',
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg'
                    }, 'Cancelar'),

                    React.createElement('button', {
                        key: 'save',
                        onClick: handleSave,
                        disabled: !hasChanges,
                        className: `px-6 py-2 rounded-lg ${
                            hasChanges
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    }, hasChanges ? 'Salvar Alterações' : 'Sem Alterações')
                ])
            ])
        ])
    ]);
};

// Keep the old SettingsModal as an alias for compatibility
window.SettingsModal = window.AdvancedSettingsModal;