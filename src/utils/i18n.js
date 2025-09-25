/**
 * i18n (Internationalization) System
 * Provides translation support for multiple languages with fallbacks
 */

class I18nManager {
  constructor() {
    this.currentLanguage = 'en';
    this.currentLocale = 'en-US';
    this.fallbackLanguage = 'en';
    this.translations = {};
    this.observers = [];

    this.init();
  }

  /**
   * Initialize i18n system
   */
  init() {
    // Load built-in translations
    this.loadBuiltinTranslations();

    // Load saved language preference
    const savedLanguage = localStorage.getItem('mainframe_ai_language');
    const savedLocale = localStorage.getItem('mainframe_ai_locale');

    if (savedLanguage) {
      this.setLanguage(savedLanguage, savedLocale);
    } else {
      // Detect browser language
      this.detectBrowserLanguage();
    }
  }

  /**
   * Load built-in translations
   */
  loadBuiltinTranslations() {
    this.translations = {
      en: {
        // Navigation
        'nav.home': 'Home',
        'nav.incidents': 'Incidents',
        'nav.knowledge_base': 'Knowledge Base',
        'nav.search': 'Search',
        'nav.settings': 'Settings',
        'nav.help': 'Help',
        'nav.logout': 'Logout',

        // Common actions
        'action.save': 'Save',
        'action.cancel': 'Cancel',
        'action.delete': 'Delete',
        'action.edit': 'Edit',
        'action.add': 'Add',
        'action.remove': 'Remove',
        'action.search': 'Search',
        'action.filter': 'Filter',
        'action.export': 'Export',
        'action.import': 'Import',
        'action.reset': 'Reset',
        'action.close': 'Close',
        'action.submit': 'Submit',
        'action.confirm': 'Confirm',
        'action.back': 'Back',
        'action.next': 'Next',
        'action.previous': 'Previous',
        'action.refresh': 'Refresh',

        // Status messages
        'status.loading': 'Loading...',
        'status.saving': 'Saving...',
        'status.saved': 'Saved',
        'status.error': 'Error',
        'status.success': 'Success',
        'status.warning': 'Warning',
        'status.info': 'Information',
        'status.no_results': 'No results found',
        'status.empty': 'No data available',

        // Forms
        'form.required': 'This field is required',
        'form.invalid_email': 'Please enter a valid email address',
        'form.password_mismatch': 'Passwords do not match',
        'form.min_length': 'Must be at least {min} characters',
        'form.max_length': 'Must be no more than {max} characters',

        // Search
        'search.placeholder': 'Search knowledge base...',
        'search.no_results': 'No results found for "{query}"',
        'search.results_count': '{count} result(s) found',
        'search.recent_searches': 'Recent Searches',
        'search.clear_history': 'Clear Search History',

        // Settings
        'settings.title': 'Settings',
        'settings.theme': 'Theme',
        'settings.language': 'Language',
        'settings.notifications': 'Notifications',
        'settings.display': 'Display',
        'settings.api_keys': 'API Keys',
        'settings.data': 'Data Management',
        'settings.theme.light': 'Light',
        'settings.theme.dark': 'Dark',
        'settings.theme.auto': 'Auto',
        'settings.save_success': 'Settings saved successfully',
        'settings.save_error': 'Failed to save settings',
        'settings.reset_confirm': 'Are you sure you want to reset all settings?',

        // Incidents
        'incidents.title': 'Incident Management',
        'incidents.new': 'New Incident',
        'incidents.status.open': 'Open',
        'incidents.status.in_progress': 'In Progress',
        'incidents.status.resolved': 'Resolved',
        'incidents.status.closed': 'Closed',
        'incidents.priority.low': 'Low',
        'incidents.priority.medium': 'Medium',
        'incidents.priority.high': 'High',
        'incidents.priority.critical': 'Critical',

        // Knowledge Base
        'kb.title': 'Knowledge Base',
        'kb.categories': 'Categories',
        'kb.articles': 'Articles',
        'kb.tags': 'Tags',
        'kb.last_updated': 'Last Updated',
        'kb.created_by': 'Created by',

        // AI Assistant
        'ai.welcome': 'Welcome to Mainframe AI Assistant',
        'ai.thinking': 'AI is thinking...',
        'ai.error': 'AI service is currently unavailable',
        'ai.suggestion': 'AI Suggestion',
        'ai.analysis': 'AI Analysis',

        // Time formats
        'time.now': 'now',
        'time.minutes_ago': '{minutes} minute(s) ago',
        'time.hours_ago': '{hours} hour(s) ago',
        'time.days_ago': '{days} day(s) ago',
        'time.weeks_ago': '{weeks} week(s) ago',
        'time.months_ago': '{months} month(s) ago',

        // Errors
        'error.network': 'Network connection error',
        'error.server': 'Server error occurred',
        'error.permission': 'Permission denied',
        'error.not_found': 'Resource not found',
        'error.timeout': 'Request timed out',
        'error.unknown': 'An unknown error occurred',
      },

      pt: {
        // Navigation
        'nav.home': 'Início',
        'nav.incidents': 'Incidentes',
        'nav.knowledge_base': 'Base de Conhecimento',
        'nav.search': 'Pesquisar',
        'nav.settings': 'Configurações',
        'nav.help': 'Ajuda',
        'nav.logout': 'Sair',

        // Common actions
        'action.save': 'Salvar',
        'action.cancel': 'Cancelar',
        'action.delete': 'Excluir',
        'action.edit': 'Editar',
        'action.add': 'Adicionar',
        'action.remove': 'Remover',
        'action.search': 'Pesquisar',
        'action.filter': 'Filtrar',
        'action.export': 'Exportar',
        'action.import': 'Importar',
        'action.reset': 'Redefinir',
        'action.close': 'Fechar',
        'action.submit': 'Enviar',
        'action.confirm': 'Confirmar',
        'action.back': 'Voltar',
        'action.next': 'Próximo',
        'action.previous': 'Anterior',
        'action.refresh': 'Atualizar',

        // Status messages
        'status.loading': 'Carregando...',
        'status.saving': 'Salvando...',
        'status.saved': 'Salvo',
        'status.error': 'Erro',
        'status.success': 'Sucesso',
        'status.warning': 'Aviso',
        'status.info': 'Informação',
        'status.no_results': 'Nenhum resultado encontrado',
        'status.empty': 'Nenhum dado disponível',

        // Forms
        'form.required': 'Este campo é obrigatório',
        'form.invalid_email': 'Por favor, insira um endereço de email válido',
        'form.password_mismatch': 'As senhas não coincidem',
        'form.min_length': 'Deve ter pelo menos {min} caracteres',
        'form.max_length': 'Deve ter no máximo {max} caracteres',

        // Search
        'search.placeholder': 'Pesquisar base de conhecimento...',
        'search.no_results': 'Nenhum resultado encontrado para "{query}"',
        'search.results_count': '{count} resultado(s) encontrado(s)',
        'search.recent_searches': 'Pesquisas Recentes',
        'search.clear_history': 'Limpar Histórico de Pesquisa',

        // Settings
        'settings.title': 'Configurações',
        'settings.theme': 'Tema',
        'settings.language': 'Idioma',
        'settings.notifications': 'Notificações',
        'settings.display': 'Exibição',
        'settings.api_keys': 'Chaves de API',
        'settings.data': 'Gerenciamento de Dados',
        'settings.theme.light': 'Claro',
        'settings.theme.dark': 'Escuro',
        'settings.theme.auto': 'Automático',
        'settings.save_success': 'Configurações salvas com sucesso',
        'settings.save_error': 'Falha ao salvar configurações',
        'settings.reset_confirm': 'Tem certeza que deseja redefinir todas as configurações?',

        // AI Assistant
        'ai.welcome': 'Bem-vindo ao Assistente de IA Mainframe',
        'ai.thinking': 'IA está pensando...',
        'ai.error': 'Serviço de IA está indisponível no momento',
        'ai.suggestion': 'Sugestão da IA',
        'ai.analysis': 'Análise da IA',
      },

      es: {
        // Navigation
        'nav.home': 'Inicio',
        'nav.incidents': 'Incidentes',
        'nav.knowledge_base': 'Base de Conocimientos',
        'nav.search': 'Buscar',
        'nav.settings': 'Configuración',
        'nav.help': 'Ayuda',
        'nav.logout': 'Cerrar Sesión',

        // Common actions
        'action.save': 'Guardar',
        'action.cancel': 'Cancelar',
        'action.delete': 'Eliminar',
        'action.edit': 'Editar',
        'action.add': 'Añadir',
        'action.remove': 'Quitar',
        'action.search': 'Buscar',
        'action.filter': 'Filtrar',
        'action.export': 'Exportar',
        'action.import': 'Importar',
        'action.reset': 'Restablecer',
        'action.close': 'Cerrar',
        'action.submit': 'Enviar',
        'action.confirm': 'Confirmar',
        'action.back': 'Atrás',
        'action.next': 'Siguiente',
        'action.previous': 'Anterior',
        'action.refresh': 'Actualizar',

        // Status messages
        'status.loading': 'Cargando...',
        'status.saving': 'Guardando...',
        'status.saved': 'Guardado',
        'status.error': 'Error',
        'status.success': 'Éxito',
        'status.warning': 'Advertencia',
        'status.info': 'Información',
        'status.no_results': 'No se encontraron resultados',
        'status.empty': 'No hay datos disponibles',

        // AI Assistant
        'ai.welcome': 'Bienvenido al Asistente de IA Mainframe',
        'ai.thinking': 'IA está pensando...',
        'ai.error': 'El servicio de IA no está disponible actualmente',
        'ai.suggestion': 'Sugerencia de IA',
        'ai.analysis': 'Análisis de IA',
      },
    };
  }

  /**
   * Detect browser language and set as default
   */
  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0];

    if (this.translations[langCode]) {
      this.setLanguage(langCode, browserLang);
    } else {
      this.setLanguage(this.fallbackLanguage, 'en-US');
    }
  }

  /**
   * Set the current language
   * @param {string} language - Language code (en, pt, es)
   * @param {string} locale - Full locale code (en-US, pt-BR, es-ES)
   */
  setLanguage(language, locale = null) {
    const previousLanguage = this.currentLanguage;

    if (!this.translations[language]) {
      console.warn(`Language '${language}' not supported, using fallback`);
      language = this.fallbackLanguage;
    }

    this.currentLanguage = language;
    this.currentLocale = locale || this.getDefaultLocale(language);

    // Save preferences
    localStorage.setItem('mainframe_ai_language', language);
    localStorage.setItem('mainframe_ai_locale', this.currentLocale);

    // Update document language
    document.documentElement.lang = language;

    // Update page content
    this.updatePageContent();

    // Notify observers
    this.notifyObservers({
      language: language,
      locale: this.currentLocale,
      previousLanguage: previousLanguage,
    });

    console.log(`Language set to: ${language} (${this.currentLocale})`);
  }

  /**
   * Get default locale for language
   * @param {string} language - Language code
   * @returns {string} Default locale
   */
  getDefaultLocale(language) {
    const localeMap = {
      en: 'en-US',
      pt: 'pt-BR',
      es: 'es-ES',
    };
    return localeMap[language] || 'en-US';
  }

  /**
   * Set locale (regional formatting)
   * @param {string} locale - Full locale code
   */
  setLocale(locale) {
    this.currentLocale = locale;
    localStorage.setItem('mainframe_ai_locale', locale);

    // Update number and date formatting
    this.updateFormatting();
  }

  /**
   * Get translated text
   * @param {string} key - Translation key
   * @param {Object} params - Parameters for interpolation
   * @param {string} fallbackLang - Fallback language if key not found
   * @returns {string} Translated text
   */
  t(key, params = {}, fallbackLang = null) {
    let translation = this.getTranslation(key, this.currentLanguage);

    if (!translation && fallbackLang) {
      translation = this.getTranslation(key, fallbackLang);
    }

    if (!translation) {
      translation = this.getTranslation(key, this.fallbackLanguage);
    }

    if (!translation) {
      console.warn(`Translation not found for key: ${key}`);
      return key; // Return key as fallback
    }

    // Interpolate parameters
    return this.interpolate(translation, params);
  }

  /**
   * Get translation for specific language
   * @param {string} key - Translation key
   * @param {string} language - Language code
   * @returns {string|null} Translation or null if not found
   */
  getTranslation(key, language) {
    const langTranslations = this.translations[language];
    if (!langTranslations) return null;

    // Support nested keys with dot notation
    const keys = key.split('.');
    let value = langTranslations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  }

  /**
   * Interpolate parameters in translation
   * @param {string} text - Text with placeholders
   * @param {Object} params - Parameters to interpolate
   * @returns {string} Interpolated text
   */
  interpolate(text, params) {
    return text.replace(/\{([^}]+)\}/g, (match, key) => {
      return params.hasOwnProperty(key) ? params[key] : match;
    });
  }

  /**
   * Update page content with current language
   */
  updatePageContent() {
    // Update elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);

      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    });

    // Update title attributes
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const translation = this.t(key);
      element.title = translation;
    });
  }

  /**
   * Update number and date formatting
   */
  updateFormatting() {
    // This would be used by date/number formatting functions
    console.log(`Formatting updated for locale: ${this.currentLocale}`);
  }

  /**
   * Format number according to current locale
   * @param {number} number - Number to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted number
   */
  formatNumber(number, options = {}) {
    try {
      return new Intl.NumberFormat(this.currentLocale, options).format(number);
    } catch (error) {
      return number.toString();
    }
  }

  /**
   * Format date according to current locale
   * @param {Date} date - Date to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted date
   */
  formatDate(date, options = {}) {
    try {
      return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
    } catch (error) {
      return date.toString();
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   * @param {Date} date - Date to format
   * @returns {string} Formatted relative time
   */
  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMinutes < 1) {
      return this.t('time.now');
    } else if (diffHours < 1) {
      return this.t('time.minutes_ago', { minutes: diffMinutes });
    } else if (diffDays < 1) {
      return this.t('time.hours_ago', { hours: diffHours });
    } else if (diffWeeks < 1) {
      return this.t('time.days_ago', { days: diffDays });
    } else if (diffMonths < 1) {
      return this.t('time.weeks_ago', { weeks: diffWeeks });
    } else {
      return this.t('time.months_ago', { months: diffMonths });
    }
  }

  /**
   * Add custom translations
   * @param {string} language - Language code
   * @param {Object} translations - Translation object
   */
  addTranslations(language, translations) {
    if (!this.translations[language]) {
      this.translations[language] = {};
    }

    Object.assign(this.translations[language], translations);
  }

  /**
   * Get current language
   * @returns {string} Current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get current locale
   * @returns {string} Current locale code
   */
  getCurrentLocale() {
    return this.currentLocale;
  }

  /**
   * Get available languages
   * @returns {Array} Array of available language codes
   */
  getAvailableLanguages() {
    return Object.keys(this.translations);
  }

  /**
   * Check if translation exists
   * @param {string} key - Translation key
   * @param {string} language - Language code (optional)
   * @returns {boolean} Whether translation exists
   */
  hasTranslation(key, language = null) {
    const lang = language || this.currentLanguage;
    return this.getTranslation(key, lang) !== null;
  }

  /**
   * Subscribe to language changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.observers.push(callback);

    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Notify observers of language change
   * @param {Object} changeInfo - Change information
   */
  notifyObservers(changeInfo) {
    this.observers.forEach(callback => {
      try {
        callback(changeInfo);
      } catch (error) {
        console.error('i18n observer error:', error);
      }
    });
  }

  /**
   * Get translation statistics
   * @returns {Object} Translation stats
   */
  getStats() {
    const stats = {};

    for (const [lang, translations] of Object.entries(this.translations)) {
      stats[lang] = {
        keyCount: Object.keys(translations).length,
        completeness:
          lang === this.fallbackLanguage
            ? 100
            : Math.round(
                (Object.keys(translations).length /
                  Object.keys(this.translations[this.fallbackLanguage]).length) *
                  100
              ),
      };
    }

    return {
      currentLanguage: this.currentLanguage,
      currentLocale: this.currentLocale,
      languages: stats,
      observers: this.observers.length,
    };
  }
}

// Create and export singleton instance
const i18n = new I18nManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.i18n = i18n;

  // Add global translation function
  window.t = (key, params) => i18n.t(key, params);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
}

export default i18n;
