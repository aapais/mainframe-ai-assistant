const React = require('react');
const { useState, useEffect } = React;

const ApiKeySettings = ({ settings, onUpdate, onMarkChanged }) => {
    const [apiKeys, setApiKeys] = useState(settings?.api_keys || {});
    const [showKeys, setShowKeys] = useState({});
    const [editingKey, setEditingKey] = useState(null);
    const [tempKeyValue, setTempKeyValue] = useState('');
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        setApiKeys(settings?.api_keys || {});
    }, [settings]);

    const supportedServices = [
        {
            id: 'openai',
            name: 'OpenAI',
            description: 'GPT models for text generation and analysis',
            icon: '🤖',
            placeholder: 'sk-...',
            testEndpoint: 'https://api.openai.com/v1/models',
            required: false
        },
        {
            id: 'anthropic',
            name: 'Anthropic Claude',
            description: 'Claude AI for advanced reasoning and analysis',
            icon: '🧠',
            placeholder: 'sk-ant-...',
            testEndpoint: null, // Custom test logic
            required: false
        },
        {
            id: 'gemini',
            name: 'Google Gemini',
            description: 'Google\'s multimodal AI model',
            icon: '✨',
            placeholder: 'AI...',
            testEndpoint: 'https://generativelanguage.googleapis.com/v1/models',
            required: false
        },
        {
            id: 'azure',
            name: 'Azure OpenAI',
            description: 'Microsoft Azure OpenAI Service',
            icon: '☁️',
            placeholder: 'your-api-key',
            testEndpoint: null, // Custom test logic
            required: false
        },
        {
            id: 'custom',
            name: 'Custom API',
            description: 'Custom or enterprise API endpoint',
            icon: '🔧',
            placeholder: 'your-custom-key',
            testEndpoint: null,
            required: false
        }
    ];

    const handleKeyUpdate = async (serviceId, value) => {
        const updatedKeys = {
            ...apiKeys,
            [serviceId]: value
        };
        
        setApiKeys(updatedKeys);
        onMarkChanged();
        
        // Update settings in backend
        const result = await onUpdate({ api_keys: updatedKeys });
        
        if (!result.success) {
            // Revert on error
            setApiKeys(settings?.api_keys || {});
        } else {
            // Clear test results when key changes
            setTestResults(prev => ({ ...prev, [serviceId]: null }));
        }
        
        setEditingKey(null);
        setTempKeyValue('');
    };

    const handleKeyDelete = async (serviceId) => {
        if (!confirm(`Are you sure you want to delete the ${serviceId} API key?`)) {
            return;
        }
        
        const updatedKeys = { ...apiKeys };
        delete updatedKeys[serviceId];
        
        setApiKeys(updatedKeys);
        onMarkChanged();
        
        // Update settings in backend
        const result = await onUpdate({ api_keys: updatedKeys });
        
        if (!result.success) {
            // Revert on error
            setApiKeys(settings?.api_keys || {});
        } else {
            // Clear test results
            setTestResults(prev => ({ ...prev, [serviceId]: null }));
        }
    };

    const testApiKey = async (serviceId) => {
        if (!apiKeys[serviceId]) {
            alert('Please enter an API key first.');
            return;
        }
        
        setTesting(true);
        setTestResults(prev => ({ ...prev, [serviceId]: 'testing' }));
        
        try {
            const service = supportedServices.find(s => s.id === serviceId);
            let testResult;
            
            if (serviceId === 'openai') {
                testResult = await testOpenAIKey(apiKeys[serviceId]);
            } else if (serviceId === 'anthropic') {
                testResult = await testAnthropicKey(apiKeys[serviceId]);
            } else if (serviceId === 'gemini') {
                testResult = await testGeminiKey(apiKeys[serviceId]);
            } else if (serviceId === 'azure') {
                testResult = await testAzureKey(apiKeys[serviceId]);
            } else {
                testResult = { success: false, message: 'Custom API testing not implemented' };
            }
            
            setTestResults(prev => ({
                ...prev,
                [serviceId]: testResult
            }));
        } catch (error) {
            console.error(`Error testing ${serviceId} API key:`, error);
            setTestResults(prev => ({
                ...prev,
                [serviceId]: { success: false, message: error.message }
            }));
        } finally {
            setTesting(false);
        }
    };

    const testOpenAIKey = async (apiKey) => {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    message: `Valid! Found ${data.data?.length || 0} models available.`
                };
            } else {
                return {
                    success: false,
                    message: `Invalid key (${response.status}: ${response.statusText})`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`
            };
        }
    };

    const testAnthropicKey = async (apiKey) => {
        // Anthropic doesn't have a simple test endpoint, so we'll do a basic validation
        if (apiKey.startsWith('sk-ant-') && apiKey.length > 20) {
            return {
                success: true,
                message: 'Key format appears valid (full test requires API call)'
            };
        } else {
            return {
                success: false,
                message: 'Invalid key format (should start with sk-ant-)'
            };
        }
    };

    const testGeminiKey = async (apiKey) => {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    message: `Valid! Found ${data.models?.length || 0} models available.`
                };
            } else {
                return {
                    success: false,
                    message: `Invalid key (${response.status}: ${response.statusText})`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`
            };
        }
    };

    const testAzureKey = async (apiKey) => {
        // Azure testing requires endpoint and deployment info, so just validate format
        if (apiKey && apiKey.length > 10) {
            return {
                success: true,
                message: 'Key format appears valid (full test requires endpoint configuration)'
            };
        } else {
            return {
                success: false,
                message: 'Invalid key format'
            };
        }
    };

    const toggleKeyVisibility = (serviceId) => {
        setShowKeys(prev => ({
            ...prev,
            [serviceId]: !prev[serviceId]
        }));
    };

    const startEditing = (serviceId) => {
        setEditingKey(serviceId);
        setTempKeyValue(apiKeys[serviceId] || '');
    };

    const cancelEditing = () => {
        setEditingKey(null);
        setTempKeyValue('');
    };

    const saveKey = () => {
        handleKeyUpdate(editingKey, tempKeyValue);
    };

    const maskKey = (key) => {
        if (!key) return '';
        if (key.length <= 8) return '••••••••';
        return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
    };

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
            }, 'API Key Management'),
            React.createElement('p', {
                key: 'description',
                className: 'text-sm text-gray-600 dark:text-gray-400'
            }, 'Securely store API keys for various AI services. Keys are encrypted and stored locally.')
        ]),
        
        // Security Notice
        React.createElement('div', {
            key: 'security-notice',
            className: 'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4'
        }, [
            React.createElement('div', {
                key: 'notice-header',
                className: 'flex items-center gap-2 mb-2'
            }, [
                React.createElement('span', {
                    key: 'icon',
                    className: 'text-lg'
                }, '🔒'),
                React.createElement('h4', {
                    key: 'title',
                    className: 'font-medium text-yellow-800 dark:text-yellow-200'
                }, 'Security Information')
            ]),
            React.createElement('ul', {
                key: 'security-points',
                className: 'text-sm text-yellow-700 dark:text-yellow-300 space-y-1'
            }, [
                React.createElement('li', {
                    key: 'point1'
                }, '• API keys are encrypted before storage'),
                React.createElement('li', {
                    key: 'point2'
                }, '• Keys are only transmitted over secure connections'),
                React.createElement('li', {
                    key: 'point3'
                }, '• Test your keys to ensure they\'re working properly'),
                React.createElement('li', {
                    key: 'point4'
                }, '• Regularly rotate your API keys for better security')
            ])
        ]),
        
        // API Key Configuration
        React.createElement('div', {
            key: 'api-keys',
            className: 'space-y-4'
        }, [
            React.createElement('h4', {
                key: 'keys-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Configure API Keys'),
            
            React.createElement('div', {
                key: 'keys-list',
                className: 'space-y-4'
            }, supportedServices.map(service => {
                const hasKey = apiKeys[service.id];
                const isEditing = editingKey === service.id;
                const testResult = testResults[service.id];
                
                return React.createElement('div', {
                    key: service.id,
                    className: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4'
                }, [
                    // Service Header
                    React.createElement('div', {
                        key: 'service-header',
                        className: 'flex items-center gap-3 mb-3'
                    }, [
                        React.createElement('span', {
                            key: 'service-icon',
                            className: 'text-2xl'
                        }, service.icon),
                        React.createElement('div', {
                            key: 'service-info',
                            className: 'flex-1'
                        }, [
                            React.createElement('h5', {
                                key: 'service-name',
                                className: 'font-medium text-gray-900 dark:text-white'
                            }, service.name),
                            React.createElement('p', {
                                key: 'service-desc',
                                className: 'text-sm text-gray-600 dark:text-gray-400'
                            }, service.description)
                        ]),
                        hasKey && React.createElement('span', {
                            key: 'configured-badge',
                            className: 'px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-medium'
                        }, 'Configured')
                    ]),
                    
                    // Key Input/Display
                    React.createElement('div', {
                        key: 'key-input-section',
                        className: 'space-y-3'
                    }, [
                        isEditing ? [
                            // Editing Mode
                            React.createElement('div', {
                                key: 'edit-input',
                                className: 'flex gap-2'
                            }, [
                                React.createElement('input', {
                                    key: 'input',
                                    type: 'password',
                                    value: tempKeyValue,
                                    onChange: (e) => setTempKeyValue(e.target.value),
                                    placeholder: service.placeholder,
                                    className: 'flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                                    onKeyPress: (e) => e.key === 'Enter' && saveKey()
                                }),
                                React.createElement('button', {
                                    key: 'save',
                                    onClick: saveKey,
                                    className: 'px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700'
                                }, '✓'),
                                React.createElement('button', {
                                    key: 'cancel',
                                    onClick: cancelEditing,
                                    className: 'px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600'
                                }, '×')
                            ])
                        ] : [
                            // Display Mode
                            React.createElement('div', {
                                key: 'display-key',
                                className: 'flex items-center gap-2'
                            }, [
                                React.createElement('div', {
                                    key: 'key-display',
                                    className: 'flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm'
                                }, hasKey ? (showKeys[service.id] ? apiKeys[service.id] : maskKey(apiKeys[service.id])) : 'No API key configured'),
                                
                                hasKey && React.createElement('button', {
                                    key: 'toggle-visibility',
                                    onClick: () => toggleKeyVisibility(service.id),
                                    className: 'p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }, showKeys[service.id] ? '🙈' : '👁️'),
                                
                                React.createElement('button', {
                                    key: 'edit',
                                    onClick: () => startEditing(service.id),
                                    className: 'p-2 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300'
                                }, '✏️'),
                                
                                hasKey && React.createElement('button', {
                                    key: 'delete',
                                    onClick: () => handleKeyDelete(service.id),
                                    className: 'p-2 text-red-500 hover:text-red-700 dark:hover:text-red-300'
                                }, '🗑️')
                            ])
                        ],
                        
                        // Test Button and Results
                        hasKey && !isEditing && React.createElement('div', {
                            key: 'test-section',
                            className: 'flex items-center gap-3'
                        }, [
                            React.createElement('button', {
                                key: 'test-btn',
                                onClick: () => testApiKey(service.id),
                                disabled: testing,
                                className: `px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm ${
                                    testing && testResults[service.id] === 'testing' ? 'animate-pulse' : ''
                                }`
                            }, testing && testResults[service.id] === 'testing' ? 'Testing...' : 'Test Key'),
                            
                            testResult && testResult !== 'testing' && React.createElement('div', {
                                key: 'test-result',
                                className: `flex items-center gap-2 text-sm ${
                                    testResult.success 
                                        ? 'text-green-600 dark:text-green-400' 
                                        : 'text-red-600 dark:text-red-400'
                                }`
                            }, [
                                React.createElement('span', {
                                    key: 'result-icon'
                                }, testResult.success ? '✓' : '✗'),
                                React.createElement('span', {
                                    key: 'result-message'
                                }, testResult.message)
                            ])
                        ])
                    ])
                ]);
            }))
        ]),
        
        // Best Practices
        React.createElement('div', {
            key: 'best-practices',
            className: 'bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700'
        }, [
            React.createElement('h4', {
                key: 'practices-title',
                className: 'font-medium text-blue-900 dark:text-blue-100 mb-2'
            }, '💡 Best Practices'),
            React.createElement('ul', {
                key: 'practices-list',
                className: 'text-sm text-blue-800 dark:text-blue-200 space-y-1'
            }, [
                React.createElement('li', {
                    key: 'practice1'
                }, '• Use separate API keys for different applications'),
                React.createElement('li', {
                    key: 'practice2'
                }, '• Set usage limits and monitoring on your API accounts'),
                React.createElement('li', {
                    key: 'practice3'
                }, '• Regularly review and rotate your API keys'),
                React.createElement('li', {
                    key: 'practice4'
                }, '• Never share API keys or commit them to version control'),
                React.createElement('li', {
                    key: 'practice5'
                }, '• Test keys after configuration to ensure they work properly')
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
            }, 'API Key Status'),
            React.createElement('div', {
                key: 'summary-content',
                className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1'
            }, [
                React.createElement('div', {
                    key: 'configured-count'
                }, `Configured Services: ${Object.keys(apiKeys).filter(k => apiKeys[k]).length} of ${supportedServices.length}`),
                React.createElement('div', {
                    key: 'services-list'
                }, `Active: ${Object.keys(apiKeys).filter(k => apiKeys[k]).join(', ') || 'None'}`),
                React.createElement('div', {
                    key: 'last-tested'
                }, 'Last tested: Click "Test Key" buttons to verify connectivity')
            ])
        ])
    ]);
};

// Make component available globally
if (typeof window !== 'undefined') {
    window.ApiKeySettings = ApiKeySettings;
}

module.exports = ApiKeySettings;
