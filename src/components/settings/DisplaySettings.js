const React = require('react');
const { useState, useEffect } = React;

const DisplaySettings = ({ settings, onUpdate, onMarkChanged }) => {
    const [displayDensity, setDisplayDensity] = useState(settings?.display_density || 'normal');
    const [fontSize, setFontSize] = useState(settings?.font_size || 14);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(settings?.sidebar_collapsed || false);
    const [showLineNumbers, setShowLineNumbers] = useState(settings?.show_line_numbers !== false);
    const [cacheEnabled, setCacheEnabled] = useState(settings?.cache_enabled !== false);

    useEffect(() => {
        setDisplayDensity(settings?.display_density || 'normal');
        setFontSize(settings?.font_size || 14);
        setSidebarCollapsed(settings?.sidebar_collapsed || false);
        setShowLineNumbers(settings?.show_line_numbers !== false);
        setCacheEnabled(settings?.cache_enabled !== false);
    }, [settings]);

    const densityOptions = [
        {
            id: 'compact',
            name: 'Compact',
            description: 'Dense layout with smaller spacing',
            preview: { padding: '2px', lineHeight: '1.2' }
        },
        {
            id: 'normal',
            name: 'Normal',
            description: 'Balanced spacing for comfortable viewing',
            preview: { padding: '4px', lineHeight: '1.5' }
        },
        {
            id: 'comfortable',
            name: 'Comfortable',
            description: 'Spacious layout for better readability',
            preview: { padding: '8px', lineHeight: '1.7' }
        }
    ];

    const fontSizes = [
        { value: 10, label: 'Extra Small', description: '10px' },
        { value: 12, label: 'Small', description: '12px' },
        { value: 14, label: 'Normal', description: '14px' },
        { value: 16, label: 'Medium', description: '16px' },
        { value: 18, label: 'Large', description: '18px' },
        { value: 20, label: 'Extra Large', description: '20px' },
        { value: 24, label: 'Huge', description: '24px' }
    ];

    const handleDensityChange = async (density) => {
        setDisplayDensity(density);
        onMarkChanged();
        
        // Apply density change immediately
        const root = document.documentElement;
        root.setAttribute('data-density', density);
        
        // Update settings in backend
        const result = await onUpdate({ display_density: density });
        
        if (!result.success) {
            // Revert on error
            setDisplayDensity(settings?.display_density || 'normal');
            root.setAttribute('data-density', settings?.display_density || 'normal');
        }
    };

    const handleFontSizeChange = async (size) => {
        setFontSize(size);
        onMarkChanged();
        
        // Apply font size change immediately
        const root = document.documentElement;
        root.style.setProperty('--font-size-base', `${size}px`);
        
        // Update settings in backend
        const result = await onUpdate({ font_size: size });
        
        if (!result.success) {
            // Revert on error
            setFontSize(settings?.font_size || 14);
            root.style.setProperty('--font-size-base', `${settings?.font_size || 14}px`);
        }
    };

    const handleSidebarToggle = async (collapsed) => {
        setSidebarCollapsed(collapsed);
        onMarkChanged();
        
        // Apply sidebar change immediately
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            if (collapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }
        
        // Update settings in backend
        const result = await onUpdate({ sidebar_collapsed: collapsed });
        
        if (!result.success) {
            // Revert on error
            setSidebarCollapsed(settings?.sidebar_collapsed || false);
            if (sidebar) {
                if (settings?.sidebar_collapsed) {
                    sidebar.classList.add('collapsed');
                } else {
                    sidebar.classList.remove('collapsed');
                }
            }
        }
    };

    const handleLineNumbersToggle = async (enabled) => {
        setShowLineNumbers(enabled);
        onMarkChanged();
        
        // Apply line numbers change immediately
        const codeElements = document.querySelectorAll('pre, code');
        codeElements.forEach(el => {
            if (enabled) {
                el.classList.add('show-line-numbers');
            } else {
                el.classList.remove('show-line-numbers');
            }
        });
        
        // Update settings in backend
        const result = await onUpdate({ show_line_numbers: enabled });
        
        if (!result.success) {
            // Revert on error
            setShowLineNumbers(settings?.show_line_numbers !== false);
            codeElements.forEach(el => {
                if (settings?.show_line_numbers !== false) {
                    el.classList.add('show-line-numbers');
                } else {
                    el.classList.remove('show-line-numbers');
                }
            });
        }
    };

    const handleCacheToggle = async (enabled) => {
        setCacheEnabled(enabled);
        onMarkChanged();
        
        // Update settings in backend
        const result = await onUpdate({ cache_enabled: enabled });
        
        if (!result.success) {
            // Revert on error
            setCacheEnabled(settings?.cache_enabled !== false);
        }
    };

    const previewText = "Sample text to demonstrate the current display settings. This includes code blocks and various UI elements.";

    return React.createElement('div', {
        className: 'space-y-6'
    }, [
        // Header
        React.createElement('div', {
            key: 'header'
        }, [
            React.createElement('h3', {
                key: 'title',
                className: 'text-lg font-semibold text-gray-900 dark:text-white mb-2'
            }, 'Display Settings'),
            React.createElement('p', {
                key: 'description',
                className: 'text-sm text-gray-600 dark:text-gray-400'
            }, 'Customize the visual layout and appearance of the interface')
        ]),
        
        // Live Preview Box
        React.createElement('div', {
            key: 'preview-box',
            className: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4'
        }, [
            React.createElement('h4', {
                key: 'preview-title',
                className: 'font-medium text-gray-900 dark:text-white mb-3'
            }, 'Live Preview'),
            React.createElement('div', {
                key: 'preview-content',
                className: `preview-area transition-all duration-300`,
                style: {
                    fontSize: `${fontSize}px`,
                    padding: densityOptions.find(d => d.id === displayDensity)?.preview.padding || '4px',
                    lineHeight: densityOptions.find(d => d.id === displayDensity)?.preview.lineHeight || '1.5'
                }
            }, [
                React.createElement('p', {
                    key: 'preview-text',
                    className: 'text-gray-700 dark:text-gray-300 mb-2'
                }, previewText),
                React.createElement('pre', {
                    key: 'preview-code',
                    className: `bg-gray-100 dark:bg-gray-700 rounded p-2 text-sm ${
                        showLineNumbers ? 'show-line-numbers' : ''
                    }`,
                    style: { fontSize: `${fontSize * 0.9}px` }
                }, `function example() {
    console.log('Display settings preview');
    return 'success';
}`)
            ])
        ]),
        
        // Display Density
        React.createElement('div', {
            key: 'density-settings',
            className: 'space-y-4'
        }, [
            React.createElement('h4', {
                key: 'density-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Display Density'),
            React.createElement('p', {
                key: 'density-desc',
                className: 'text-sm text-gray-600 dark:text-gray-400 mb-4'
            }, 'Choose how much information fits on screen'),
            
            React.createElement('div', {
                key: 'density-options',
                className: 'grid grid-cols-1 md:grid-cols-3 gap-4'
            }, densityOptions.map(option => 
                React.createElement('button', {
                    key: option.id,
                    onClick: () => handleDensityChange(option.id),
                    className: `relative p-4 border-2 rounded-lg text-left transition-all ${
                        displayDensity === option.id 
                            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50 dark:bg-blue-900' 
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`
                }, [
                    React.createElement('div', {
                        key: 'option-preview',
                        className: 'mb-3 bg-gray-100 dark:bg-gray-700 rounded',
                        style: {
                            padding: option.preview.padding,
                            lineHeight: option.preview.lineHeight
                        }
                    }, [
                        React.createElement('div', {
                            key: 'preview-lines',
                            className: 'space-y-1'
                        }, [
                            React.createElement('div', {
                                key: 'line1',
                                className: 'h-2 bg-gray-400 dark:bg-gray-500 rounded',
                                style: { width: '80%' }
                            }),
                            React.createElement('div', {
                                key: 'line2',
                                className: 'h-2 bg-gray-400 dark:bg-gray-500 rounded',
                                style: { width: '60%' }
                            })
                        ])
                    ]),
                    React.createElement('h5', {
                        key: 'option-name',
                        className: 'font-medium text-gray-900 dark:text-white mb-1'
                    }, option.name),
                    React.createElement('p', {
                        key: 'option-desc',
                        className: 'text-xs text-gray-600 dark:text-gray-400'
                    }, option.description),
                    displayDensity === option.id && React.createElement('div', {
                        key: 'selected',
                        className: 'absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center'
                    }, React.createElement('span', {
                        className: 'text-white text-xs'
                    }, '✓'))
                ])
            ))
        ]),
        
        // Font Size
        React.createElement('div', {
            key: 'font-settings',
            className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('div', {
                key: 'font-header',
                className: 'flex items-center justify-between'
            }, [
                React.createElement('div', {
                    key: 'font-info'
                }, [
                    React.createElement('h4', {
                        key: 'font-title',
                        className: 'font-medium text-gray-900 dark:text-white'
                    }, 'Font Size'),
                    React.createElement('p', {
                        key: 'font-desc',
                        className: 'text-sm text-gray-600 dark:text-gray-400'
                    }, 'Adjust text size for better readability')
                ]),
                React.createElement('span', {
                    key: 'font-current',
                    className: 'px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium'
                }, `${fontSize}px`)
            ]),
            
            React.createElement('div', {
                key: 'font-slider-container',
                className: 'space-y-4'
            }, [
                React.createElement('input', {
                    key: 'font-slider',
                    type: 'range',
                    min: 10,
                    max: 24,
                    value: fontSize,
                    onChange: (e) => handleFontSizeChange(parseInt(e.target.value)),
                    className: 'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer'
                }),
                React.createElement('div', {
                    key: 'font-options',
                    className: 'flex flex-wrap gap-2'
                }, fontSizes.map(size => 
                    React.createElement('button', {
                        key: size.value,
                        onClick: () => handleFontSizeChange(size.value),
                        className: `px-3 py-1 rounded text-sm transition-colors ${
                            fontSize === size.value 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`
                    }, size.label)
                ))
            ])
        ]),
        
        // Interface Options
        React.createElement('div', {
            key: 'interface-options',
            className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('h4', {
                key: 'interface-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Interface Options'),
            
            React.createElement('div', {
                key: 'interface-toggles',
                className: 'space-y-4'
            }, [
                // Sidebar Toggle
                React.createElement('div', {
                    key: 'sidebar-toggle',
                    className: 'flex items-center justify-between'
                }, [
                    React.createElement('div', {
                        key: 'sidebar-info'
                    }, [
                        React.createElement('label', {
                            key: 'sidebar-label',
                            className: 'text-sm font-medium text-gray-900 dark:text-white'
                        }, 'Collapse Sidebar by Default'),
                        React.createElement('p', {
                            key: 'sidebar-desc',
                            className: 'text-xs text-gray-600 dark:text-gray-400 mt-1'
                        }, 'Start with sidebar minimized to save screen space')
                    ]),
                    React.createElement('button', {
                        key: 'sidebar-switch',
                        onClick: () => handleSidebarToggle(!sidebarCollapsed),
                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            sidebarCollapsed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`
                    }, [
                        React.createElement('span', {
                            key: 'sidebar-handle',
                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                sidebarCollapsed ? 'translate-x-6' : 'translate-x-1'
                            }`
                        })
                    ])
                ]),
                
                // Line Numbers Toggle
                React.createElement('div', {
                    key: 'linenumbers-toggle',
                    className: 'flex items-center justify-between'
                }, [
                    React.createElement('div', {
                        key: 'linenumbers-info'
                    }, [
                        React.createElement('label', {
                            key: 'linenumbers-label',
                            className: 'text-sm font-medium text-gray-900 dark:text-white'
                        }, 'Show Line Numbers'),
                        React.createElement('p', {
                            key: 'linenumbers-desc',
                            className: 'text-xs text-gray-600 dark:text-gray-400 mt-1'
                        }, 'Display line numbers in code blocks')
                    ]),
                    React.createElement('button', {
                        key: 'linenumbers-switch',
                        onClick: () => handleLineNumbersToggle(!showLineNumbers),
                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            showLineNumbers ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`
                    }, [
                        React.createElement('span', {
                            key: 'linenumbers-handle',
                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                showLineNumbers ? 'translate-x-6' : 'translate-x-1'
                            }`
                        })
                    ])
                ]),
                
                // Cache Toggle
                React.createElement('div', {
                    key: 'cache-toggle',
                    className: 'flex items-center justify-between'
                }, [
                    React.createElement('div', {
                        key: 'cache-info'
                    }, [
                        React.createElement('label', {
                            key: 'cache-label',
                            className: 'text-sm font-medium text-gray-900 dark:text-white'
                        }, 'Enable Caching'),
                        React.createElement('p', {
                            key: 'cache-desc',
                            className: 'text-xs text-gray-600 dark:text-gray-400 mt-1'
                        }, 'Cache frequently accessed data for better performance')
                    ]),
                    React.createElement('button', {
                        key: 'cache-switch',
                        onClick: () => handleCacheToggle(!cacheEnabled),
                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            cacheEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`
                    }, [
                        React.createElement('span', {
                            key: 'cache-handle',
                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                cacheEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`
                        })
                    ])
                ])
            ])
        ]),
        
        // Current Settings Summary
        React.createElement('div', {
            key: 'summary',
            className: 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4'
        }, [
            React.createElement('h4', {
                key: 'summary-title',
                className: 'font-medium text-gray-900 dark:text-white mb-2'
            }, 'Current Display Settings'),
            React.createElement('div', {
                key: 'summary-content',
                className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1'
            }, [
                React.createElement('div', {
                    key: 'density-info'
                }, `Density: ${densityOptions.find(d => d.id === displayDensity)?.name || 'Unknown'}`),
                React.createElement('div', {
                    key: 'font-info'
                }, `Font Size: ${fontSize}px (${fontSizes.find(f => f.value === fontSize)?.label || 'Custom'})`),
                React.createElement('div', {
                    key: 'sidebar-info'
                }, `Sidebar: ${sidebarCollapsed ? 'Collapsed' : 'Expanded'} by default`),
                React.createElement('div', {
                    key: 'features-info'
                }, `Features: ${[showLineNumbers && 'Line Numbers', cacheEnabled && 'Caching'].filter(Boolean).join(', ') || 'None'}`)
            ])
        ])
    ]);
};

// Make component available globally
if (typeof window !== 'undefined') {
    window.DisplaySettings = DisplaySettings;
}

module.exports = DisplaySettings;
