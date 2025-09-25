// Settings Integration for Browser
// Versão adaptada para funcionar diretamente no browser

window.SettingsService = {
  baseUrl: 'http://localhost:3001/api/settings',
  cache: new Map(),

  async getSettings(userId) {
    try {
      if (this.cache.has(userId)) {
        return this.cache.get(userId);
      }

      const response = await fetch(`${this.baseUrl}/${userId}`);
      const result = await response.json();

      if (result.success) {
        const settings = result.settings || result.data;
        this.cache.set(userId, settings);
        return settings;
      }
      throw new Error(result.error || 'Failed to get settings');
    } catch (error) {
      console.error('Error fetching settings:', error);
      return this.getDefaultSettings();
    }
  },

  async updateSettings(userId, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.success) {
        const settings = result.settings || result.data;
        this.cache.set(userId, settings);
        this.applySettings(settings);
        return settings;
      }
      throw new Error(result.error || 'Failed to update settings');
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  applySettings(settings) {
    // Apply theme
    if (settings.theme) {
      this.applyTheme(settings.theme);
    }

    // Apply language
    if (settings.language) {
      this.applyLanguage(settings.language);
    }

    // Apply display settings
    if (settings.font_size) {
      document.documentElement.style.setProperty('--font-size-base', settings.font_size + 'px');
    }

    if (settings.display_density) {
      document.body.setAttribute('data-density', settings.display_density);
    }

    // Apply animations
    if (!settings.enable_animations) {
      document.body.classList.add('no-animations');
    } else {
      document.body.classList.remove('no-animations');
    }
  },

  applyTheme(theme) {
    document.body.classList.remove('light', 'dark');

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }

    document.body.classList.add(theme);
    localStorage.setItem('theme', theme);
  },

  applyLanguage(language) {
    document.documentElement.lang = language;
    localStorage.setItem('language', language);

    // Update UI texts based on language
    if (window.i18n) {
      window.i18n.setLanguage(language);
    }
  },

  getDefaultSettings() {
    return {
      theme: 'light',
      language: 'en',
      locale: 'en-US',
      display_density: 'normal',
      sidebar_collapsed: false,
      show_line_numbers: true,
      font_size: 14,
      notifications: {
        email: true,
        desktop: true,
        sound: true,
        incident_updates: true,
        system_alerts: true,
        mentions: true,
      },
      recent_searches_limit: 10,
      search_history_enabled: true,
      auto_save: true,
      auto_save_interval: 30,
      export_format: 'json',
      api_keys: {},
      enable_shortcuts: true,
      keyboard_shortcuts: {
        search: 'Ctrl+K',
        newIncident: 'Ctrl+N',
        settings: 'Ctrl+,',
        help: 'F1',
      },
      enable_animations: true,
      cache_enabled: true,
    };
  },
};

// Basic i18n support
window.i18n = {
  currentLanguage: 'en',

  translations: {
    en: {
      settings: 'Settings',
      theme: 'Theme',
      language: 'Language',
      notifications: 'Notifications',
      display: 'Display',
      apiKeys: 'API Keys',
      data: 'Data',
      save: 'Save',
      cancel: 'Cancel',
      reset: 'Reset to Defaults',
      light: 'Light',
      dark: 'Dark',
      auto: 'Auto',
      english: 'English',
      portuguese: 'Portuguese',
      spanish: 'Spanish',
    },
    pt: {
      settings: 'Configurações',
      theme: 'Tema',
      language: 'Idioma',
      notifications: 'Notificações',
      display: 'Exibição',
      apiKeys: 'Chaves API',
      data: 'Dados',
      save: 'Salvar',
      cancel: 'Cancelar',
      reset: 'Restaurar Padrões',
      light: 'Claro',
      dark: 'Escuro',
      auto: 'Automático',
      english: 'Inglês',
      portuguese: 'Português',
      spanish: 'Espanhol',
    },
    es: {
      settings: 'Ajustes',
      theme: 'Tema',
      language: 'Idioma',
      notifications: 'Notificaciones',
      display: 'Pantalla',
      apiKeys: 'Claves API',
      data: 'Datos',
      save: 'Guardar',
      cancel: 'Cancelar',
      reset: 'Restablecer valores predeterminados',
      light: 'Claro',
      dark: 'Oscuro',
      auto: 'Automático',
      english: 'Inglés',
      portuguese: 'Portugués',
      spanish: 'Español',
    },
  },

  setLanguage(lang) {
    this.currentLanguage = lang;
    document.documentElement.lang = lang;
  },

  t(key) {
    return this.translations[this.currentLanguage]?.[key] || this.translations.en[key] || key;
  },
};
