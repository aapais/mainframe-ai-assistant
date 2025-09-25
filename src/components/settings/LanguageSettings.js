const React = require('react');
const { useState, useEffect } = React;

const LanguageSettings = ({ settings, onUpdate, onMarkChanged }) => {
    const [currentLanguage, setCurrentLanguage] = useState(settings?.language || 'en');
    const [currentLocale, setCurrentLocale] = useState(settings?.locale || 'en-US');

    useEffect(() => {
        setCurrentLanguage(settings?.language || 'en');
        setCurrentLocale(settings?.locale || 'en-US');
    }, [settings]);

    const languages = [
        {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            flag: '🇺🇸',
            locales: [
                { code: 'en-US', name: 'United States', flag: '🇺🇸' },
                { code: 'en-GB', name: 'United Kingdom', flag: '🇬🇧' },
                { code: 'en-CA', name: 'Canada', flag: '🇨🇦' },
                { code: 'en-AU', name: 'Australia', flag: '🇦🇺' }
            ]
        },
        {
            code: 'pt',
            name: 'Portuguese',
            nativeName: 'Português',
            flag: '🇧🇷',
            locales: [
                { code: 'pt-BR', name: 'Brasil', flag: '🇧🇷' },
                { code: 'pt-PT', name: 'Portugal', flag: '🇵🇹' }
            ]
        },
        {
            code: 'es',
            name: 'Spanish',
            nativeName: 'Español',
            flag: '🇪🇸',
            locales: [
                { code: 'es-ES', name: 'España', flag: '🇪🇸' },
                { code: 'es-MX', name: 'México', flag: '🇲🇽' },
                { code: 'es-AR', name: 'Argentina', flag: '🇦🇷' },
                { code: 'es-CO', name: 'Colombia', flag: '🇨🇴' }
            ]
        }
    ];

    const translations = {
        en: {
            welcome: 'Welcome to Mainframe AI Assistant',
            search_placeholder: 'Search knowledge base...',
            incidents: 'Incidents',
            knowledge_base: 'Knowledge Base',
            settings: 'Settings',
            logout: 'Logout'
        },
        pt: {
            welcome: 'Bem-vindo ao Assistente de IA Mainframe',
            search_placeholder: 'Pesquisar base de conhecimento...',
            incidents: 'Incidentes',
            knowledge_base: 'Base de Conhecimento',
            settings: 'Configurações',
            logout: 'Sair'
        },
        es: {
            welcome: 'Bienvenido al Asistente de IA Mainframe',
            search_placeholder: 'Buscar en la base de conocimientos...',
            incidents: 'Incidentes',
            knowledge_base: 'Base de Conocimientos',
            settings: 'Configuración',
            logout: 'Cerrar Sesión'
        }
    };

    const handleLanguageChange = async (languageCode) => {
        setCurrentLanguage(languageCode);
        onMarkChanged();
        
        // Find default locale for this language
        const language = languages.find(lang => lang.code === languageCode);
        const defaultLocale = language?.locales[0]?.code || `${languageCode}-${languageCode.toUpperCase()}`;
        setCurrentLocale(defaultLocale);
        
        // Apply language change immediately
        if (window.i18n) {
            window.i18n.setLanguage(languageCode);
        }
        
        // Update document language
        document.documentElement.lang = languageCode;
        
        // Update settings in backend
        const result = await onUpdate({ 
            language: languageCode,
            locale: defaultLocale
        });
        
        if (!result.success) {
            // Revert on error
            setCurrentLanguage(settings?.language || 'en');
            setCurrentLocale(settings?.locale || 'en-US');
            if (window.i18n) {
                window.i18n.setLanguage(settings?.language || 'en');
            }
            document.documentElement.lang = settings?.language || 'en';
        }
    };

    const handleLocaleChange = async (localeCode) => {
        setCurrentLocale(localeCode);
        onMarkChanged();
        
        // Apply locale change immediately
        if (window.i18n) {
            window.i18n.setLocale(localeCode);
        }
        
        // Update settings in backend
        const result = await onUpdate({ locale: localeCode });
        
        if (!result.success) {
            // Revert on error
            setCurrentLocale(settings?.locale || 'en-US');
            if (window.i18n) {
                window.i18n.setLocale(settings?.locale || 'en-US');
            }
        }
    };

    const getLanguageProgress = (languageCode) => {
        // Mock translation completion percentages
        const progress = {
            en: 100,
            pt: 95,
            es: 87
        };
        return progress[languageCode] || 0;
    };

    const currentLanguageObj = languages.find(lang => lang.code === currentLanguage);
    const availableLocales = currentLanguageObj?.locales || [];

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
            }, 'Language Settings'),
            React.createElement('p', {
                key: 'description',
                className: 'text-sm text-gray-600 dark:text-gray-400'
            }, 'Choose your preferred language and regional settings')
        ]),
        
        // Language Selection
        React.createElement('div', {
            key: 'language-selection',
            className: 'space-y-4'
        }, [
            React.createElement('h4', {
                key: 'lang-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Interface Language'),
            
            React.createElement('div', {
                key: 'languages-grid',
                className: 'grid grid-cols-1 md:grid-cols-3 gap-4'
            }, languages.map(language => 
                React.createElement('div', {
                    key: language.code,
                    className: `relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        currentLanguage === language.code 
                            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50 dark:bg-blue-900' 
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`,
                    onClick: () => handleLanguageChange(language.code)
                }, [
                    // Language Header
                    React.createElement('div', {
                        key: 'lang-header',
                        className: 'flex items-center gap-3 mb-3'
                    }, [
                        React.createElement('span', {
                            key: 'flag',
                            className: 'text-2xl'
                        }, language.flag),
                        React.createElement('div', {
                            key: 'names'
                        }, [
                            React.createElement('h5', {
                                key: 'name',
                                className: 'font-medium text-gray-900 dark:text-white'
                            }, language.name),
                            React.createElement('p', {
                                key: 'native',
                                className: 'text-sm text-gray-600 dark:text-gray-400'
                            }, language.nativeName)
                        ])
                    ]),
                    
                    // Translation Progress
                    React.createElement('div', {
                        key: 'progress',
                        className: 'mb-3'
                    }, [
                        React.createElement('div', {
                            key: 'progress-header',
                            className: 'flex justify-between items-center mb-1'
                        }, [
                            React.createElement('span', {
                                key: 'progress-label',
                                className: 'text-xs text-gray-600 dark:text-gray-400'
                            }, 'Translation'),
                            React.createElement('span', {
                                key: 'progress-percent',
                                className: 'text-xs font-medium text-gray-700 dark:text-gray-300'
                            }, `${getLanguageProgress(language.code)}%`)
                        ]),
                        React.createElement('div', {
                            key: 'progress-bar',
                            className: 'w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'
                        }, [
                            React.createElement('div', {
                                key: 'progress-fill',
                                className: `h-2 rounded-full transition-all ${
                                    getLanguageProgress(language.code) === 100 ? 'bg-green-500' : 
                                    getLanguageProgress(language.code) >= 90 ? 'bg-blue-500' : 'bg-yellow-500'
                                }`,
                                style: { width: `${getLanguageProgress(language.code)}%` }
                            })
                        ])
                    ]),
                    
                    // Preview Text
                    React.createElement('div', {
                        key: 'preview',
                        className: 'bg-gray-50 dark:bg-gray-700 rounded p-2 mb-2'
                    }, [
                        React.createElement('p', {
                            key: 'preview-text',
                            className: 'text-xs text-gray-600 dark:text-gray-400'
                        }, translations[language.code]?.welcome || 'Preview not available')
                    ]),
                    
                    // Selection Indicator
                    currentLanguage === language.code && React.createElement('div', {
                        key: 'selected',
                        className: 'absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center'
                    }, React.createElement('span', {
                        className: 'text-white text-xs'
                    }, '✓'))
                ])
            ))
        ]),
        
        // Locale Selection
        availableLocales.length > 1 && React.createElement('div', {
            key: 'locale-selection',
            className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('h4', {
                key: 'locale-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Regional Format'),
            React.createElement('p', {
                key: 'locale-desc',
                className: 'text-sm text-gray-600 dark:text-gray-400'
            }, 'Choose your regional preferences for dates, numbers, and currency'),
            
            React.createElement('div', {
                key: 'locale-select',
                className: 'relative'
            }, [
                React.createElement('select', {
                    key: 'select',
                    value: currentLocale,
                    onChange: (e) => handleLocaleChange(e.target.value),
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }, availableLocales.map(locale => 
                    React.createElement('option', {
                        key: locale.code,
                        value: locale.code
                    }, `${locale.flag} ${locale.name}`)
                ))
            ])
        ]),
        
        // Language Pack Info
        React.createElement('div', {
            key: 'language-info',
            className: 'bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700'
        }, [
            React.createElement('h4', {
                key: 'info-title',
                className: 'font-medium text-blue-900 dark:text-blue-100 mb-2'
            }, '💡 Language Pack Information'),
            React.createElement('div', {
                key: 'info-content',
                className: 'text-sm text-blue-800 dark:text-blue-200 space-y-1'
            }, [
                React.createElement('p', {
                    key: 'info-1'
                }, '• Changes take effect immediately without restarting'),
                React.createElement('p', {
                    key: 'info-2'
                }, '• Some technical terms may remain in English'),
                React.createElement('p', {
                    key: 'info-3'
                }, '• Regional formats affect date and number display'),
                React.createElement('p', {
                    key: 'info-4'
                }, '• Help improve translations by reporting issues')
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
            }, 'Current Language Settings'),
            React.createElement('div', {
                key: 'summary-content',
                className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1'
            }, [
                React.createElement('div', {
                    key: 'lang-info',
                    className: 'flex items-center gap-2'
                }, [
                    React.createElement('span', {
                        key: 'flag'
                    }, currentLanguageObj?.flag || '🌐'),
                    React.createElement('span', {
                        key: 'name'
                    }, `Language: ${currentLanguageObj?.name || 'Unknown'} (${currentLanguage})`)
                ]),
                React.createElement('div', {
                    key: 'locale-info'
                }, `Regional Format: ${currentLocale}`),
                React.createElement('div', {
                    key: 'progress-info'
                }, `Translation Progress: ${getLanguageProgress(currentLanguage)}%`)
            ])
        ])
    ]);
};

// Make component available globally
if (typeof window !== 'undefined') {
    window.LanguageSettings = LanguageSettings;
}

module.exports = LanguageSettings;
