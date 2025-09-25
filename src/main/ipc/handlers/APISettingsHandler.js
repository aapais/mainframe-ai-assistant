const { ipcMain, safeStorage, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * APISettingsHandler - Manages API provider settings and secure key storage
 * Handles OpenAI, Anthropic, Google Gemini, and GitHub Copilot integrations
 */
class APISettingsHandler {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'api-settings.json');
    this.encryptionKey = null;
    this.providers = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI GPT models for conversational AI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        testEndpoint: '/models',
        requiresApiKey: true,
        enabled: false,
        isDefault: false,
      },
      anthropic: {
        id: 'anthropic',
        name: 'Anthropic Claude',
        description: 'Anthropic Claude models for advanced reasoning',
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        testEndpoint: '/messages',
        requiresApiKey: true,
        enabled: false,
        isDefault: false,
      },
      gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Google Gemini models for multimodal AI',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-pro', 'gemini-pro-vision'],
        testEndpoint: '/models',
        requiresApiKey: true,
        enabled: false,
        isDefault: false,
      },
      copilot: {
        id: 'copilot',
        name: 'GitHub Copilot',
        description: 'GitHub Copilot for code completion',
        baseUrl: 'https://api.github.com/copilot',
        models: ['copilot-codex'],
        testEndpoint: '/completions',
        requiresApiKey: true,
        enabled: false,
        isDefault: false,
      },
      local: {
        id: 'local',
        name: 'Local LLM',
        description: 'Local language model server',
        baseUrl: 'http://localhost:11434',
        models: ['llama2', 'codellama', 'mistral'],
        testEndpoint: '/api/tags',
        requiresApiKey: false,
        enabled: false,
        isDefault: false,
      },
    };

    this.setupHandlers();
    this.initializeSettings();
  }

  /**
   * Initialize encryption and load settings
   */
  async initializeSettings() {
    try {
      // Initialize encryption for secure key storage
      if (safeStorage.isEncryptionAvailable()) {
        this.encryptionKey = crypto.randomBytes(32);
        console.log('Secure storage available for API keys');
      } else {
        console.warn('Secure storage not available, using basic encryption');
        this.encryptionKey = crypto.scryptSync('fallback-key', 'salt', 32);
      }

      // Load existing settings
      await this.loadSettings();
    } catch (error) {
      console.error('Failed to initialize API settings:', error);
    }
  }

  /**
   * Load settings from disk
   */
  async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(data);

      // Merge with default providers
      Object.keys(settings.providers || {}).forEach(providerId => {
        if (this.providers[providerId]) {
          this.providers[providerId] = {
            ...this.providers[providerId],
            ...settings.providers[providerId],
          };
        }
      });

      console.log('API settings loaded successfully');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load API settings:', error);
      }
      // File doesn't exist yet, will be created on first save
    }
  }

  /**
   * Save settings to disk
   */
  async saveSettings() {
    try {
      const settings = {
        providers: {},
        lastUpdated: new Date().toISOString(),
      };

      // Save provider configurations (without keys)
      Object.keys(this.providers).forEach(providerId => {
        const provider = this.providers[providerId];
        settings.providers[providerId] = {
          enabled: provider.enabled,
          isDefault: provider.isDefault,
          baseUrl: provider.baseUrl,
          selectedModel: provider.selectedModel,
        };
      });

      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
      console.log('API settings saved successfully');
    } catch (error) {
      console.error('Failed to save API settings:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(text).toString('base64');
      } else {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-ctr', this.encryptionKey);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
      }
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encryptedText, 'base64');
        return safeStorage.decryptString(buffer);
      } else {
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedData = parts[1];
        const decipher = crypto.createDecipher('aes-256-ctr', this.encryptionKey);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(providerId, apiKey, customEndpoint = null) {
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const baseUrl = customEndpoint || provider.baseUrl;
    const testUrl = `${baseUrl}${provider.testEndpoint}`;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Accenture-Mainframe-AI-Assistant/1.0.0',
      };

      // Add authentication headers based on provider
      switch (providerId) {
        case 'openai':
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'anthropic':
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
          break;
        case 'gemini':
          // Gemini uses API key as query parameter
          break;
        case 'copilot':
          headers['Authorization'] = `token ${apiKey}`;
          break;
        case 'local':
          // Local models typically don't require authentication
          break;
      }

      // Use built-in fetch (Node.js 18+) or dynamic import as fallback
      const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
      const response = await fetchFn(testUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful',
          status: response.status,
          provider: provider.name,
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`,
          status: response.status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error.message}`,
        error: error.code,
      };
    }
  }

  /**
   * Setup IPC handlers
   */
  setupHandlers() {
    // Get all available providers
    ipcMain.handle('api-settings:get-providers', async () => {
      try {
        const providers = Object.values(this.providers);
        const providersWithKeyStatus = await Promise.all(
          providers.map(async provider => ({
            id: provider.id,
            name: provider.name,
            description: provider.description,
            enabled: provider.enabled,
            isDefault: provider.isDefault,
            requiresApiKey: provider.requiresApiKey,
            models: provider.models,
            hasValidKey: await this.hasValidApiKey(provider.id),
          }))
        );
        return providersWithKeyStatus;
      } catch (error) {
        console.error('Failed to get providers:', error);
        return [];
      }
    });

    // Get specific provider details
    ipcMain.handle('api-settings:get-provider', async (event, providerId) => {
      try {
        const provider = this.providers[providerId];
        if (!provider) {
          throw new Error(`Provider ${providerId} not found`);
        }

        return {
          ...provider,
          hasValidKey: await this.hasValidApiKey(providerId),
        };
      } catch (error) {
        console.error('Failed to get provider:', error);
        throw error;
      }
    });

    // Save API key securely
    ipcMain.handle(
      'api-settings:save-key',
      async (event, providerId, apiKey, customEndpoint = null) => {
        try {
          if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('Invalid API key provided');
          }

          const provider = this.providers[providerId];
          if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
          }

          // Encrypt and store the API key
          const encryptedKey = this.encrypt(apiKey);
          const keyPath = path.join(app.getPath('userData'), `${providerId}-key.enc`);
          await fs.writeFile(keyPath, encryptedKey);

          // Update provider settings
          if (customEndpoint) {
            provider.baseUrl = customEndpoint;
          }
          provider.enabled = true;

          await this.saveSettings();

          console.log(`API key saved for provider: ${providerId}`);
          return { success: true, message: 'API key saved successfully' };
        } catch (error) {
          console.error('Failed to save API key:', error);
          return { success: false, message: error.message };
        }
      }
    );

    // Get API key (returns boolean to indicate if key exists)
    ipcMain.handle('api-settings:has-key', async (event, providerId) => {
      try {
        return await this.hasValidApiKey(providerId);
      } catch (error) {
        console.error('Failed to check API key:', error);
        return false;
      }
    });

    // Delete API key
    ipcMain.handle('api-settings:delete-key', async (event, providerId) => {
      try {
        const keyPath = path.join(app.getPath('userData'), `${providerId}-key.enc`);

        try {
          await fs.unlink(keyPath);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }

        // Update provider settings
        const provider = this.providers[providerId];
        if (provider) {
          provider.enabled = false;
          provider.isDefault = false;
        }

        await this.saveSettings();

        console.log(`API key deleted for provider: ${providerId}`);
        return { success: true, message: 'API key deleted successfully' };
      } catch (error) {
        console.error('Failed to delete API key:', error);
        return { success: false, message: error.message };
      }
    });

    // Test API connection
    ipcMain.handle('api-settings:test-connection', async (event, providerId, testKey = null) => {
      try {
        let apiKey = testKey;

        if (!apiKey) {
          apiKey = await this.getApiKey(providerId);
          if (!apiKey) {
            return {
              success: false,
              message: 'No API key found for this provider',
            };
          }
        }

        const result = await this.testConnection(providerId, apiKey);
        console.log(`Connection test for ${providerId}:`, result);
        return result;
      } catch (error) {
        console.error('Connection test failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }
    });

    // Set default provider
    ipcMain.handle('api-settings:set-default', async (event, providerId) => {
      try {
        // Clear existing default
        Object.values(this.providers).forEach(provider => {
          provider.isDefault = false;
        });

        // Set new default
        const provider = this.providers[providerId];
        if (!provider) {
          throw new Error(`Provider ${providerId} not found`);
        }

        provider.isDefault = true;
        provider.enabled = true;

        await this.saveSettings();

        console.log(`Default provider set to: ${providerId}`);
        return { success: true, message: `Default provider set to ${provider.name}` };
      } catch (error) {
        console.error('Failed to set default provider:', error);
        return { success: false, message: error.message };
      }
    });

    // Get default provider
    ipcMain.handle('api-settings:get-default', async () => {
      try {
        const defaultProvider = Object.values(this.providers).find(p => p.isDefault);
        return defaultProvider ? defaultProvider.id : 'openai';
      } catch (error) {
        console.error('Failed to get default provider:', error);
        return 'openai';
      }
    });

    // Enable/disable provider
    ipcMain.handle('api-settings:toggle-provider', async (event, providerId, enabled) => {
      try {
        const provider = this.providers[providerId];
        if (!provider) {
          throw new Error(`Provider ${providerId} not found`);
        }

        provider.enabled = enabled;

        // If disabling the default provider, find another enabled one
        if (!enabled && provider.isDefault) {
          provider.isDefault = false;
          const enabledProvider = Object.values(this.providers).find(
            p => p.enabled && p.id !== providerId
          );
          if (enabledProvider) {
            enabledProvider.isDefault = true;
          }
        }

        await this.saveSettings();

        console.log(`Provider ${providerId} ${enabled ? 'enabled' : 'disabled'}`);
        return {
          success: true,
          message: `Provider ${provider.name} ${enabled ? 'enabled' : 'disabled'}`,
        };
      } catch (error) {
        console.error('Failed to toggle provider:', error);
        return { success: false, message: error.message };
      }
    });

    // Update provider configuration
    ipcMain.handle('api-settings:update-provider', async (event, providerId, config) => {
      try {
        const provider = this.providers[providerId];
        if (!provider) {
          throw new Error(`Provider ${providerId} not found`);
        }

        // Update allowed configuration options
        if (config.baseUrl) provider.baseUrl = config.baseUrl;
        if (config.selectedModel) provider.selectedModel = config.selectedModel;
        if (typeof config.enabled === 'boolean') provider.enabled = config.enabled;

        await this.saveSettings();

        console.log(`Provider ${providerId} configuration updated`);
        return { success: true, message: 'Provider configuration updated' };
      } catch (error) {
        console.error('Failed to update provider:', error);
        return { success: false, message: error.message };
      }
    });

    // Get usage statistics (placeholder for future implementation)
    ipcMain.handle('api-settings:get-usage-stats', async (event, providerId) => {
      try {
        // Placeholder - implement actual usage tracking
        return {
          provider: providerId,
          totalRequests: 0,
          totalTokens: 0,
          lastUsed: null,
          dailyLimit: null,
          remainingQuota: null,
        };
      } catch (error) {
        console.error('Failed to get usage stats:', error);
        return null;
      }
    });

    console.log('APISettingsHandler IPC handlers registered');
  }

  /**
   * Check if provider has a valid API key
   */
  async hasValidApiKey(providerId) {
    try {
      const keyPath = path.join(app.getPath('userData'), `${providerId}-key.enc`);
      await fs.access(keyPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get decrypted API key for a provider
   */
  async getApiKey(providerId) {
    try {
      const keyPath = path.join(app.getPath('userData'), `${providerId}-key.enc`);
      const encryptedKey = await fs.readFile(keyPath, 'utf-8');
      return this.decrypt(encryptedKey);
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  }

  /**
   * Cleanup handlers when shutting down
   */
  unregisterHandlers() {
    const handlers = [
      'api-settings:get-providers',
      'api-settings:get-provider',
      'api-settings:save-key',
      'api-settings:has-key',
      'api-settings:delete-key',
      'api-settings:test-connection',
      'api-settings:set-default',
      'api-settings:get-default',
      'api-settings:toggle-provider',
      'api-settings:update-provider',
      'api-settings:get-usage-stats',
    ];

    handlers.forEach(handler => {
      ipcMain.removeHandler(handler);
    });

    console.log('APISettingsHandler handlers unregistered');
  }

  /**
   * Export settings for backup
   */
  async exportSettings() {
    try {
      const settings = {
        providers: {},
        exportDate: new Date().toISOString(),
        version: '1.0.0',
      };

      // Export provider configurations (without keys for security)
      const providerIds = Object.keys(this.providers);
      for (const providerId of providerIds) {
        const provider = this.providers[providerId];
        settings.providers[providerId] = {
          name: provider.name,
          enabled: provider.enabled,
          isDefault: provider.isDefault,
          baseUrl: provider.baseUrl,
          selectedModel: provider.selectedModel,
          hasKey: await this.hasValidApiKey(providerId),
        };
      }

      return settings;
    } catch (error) {
      console.error('Failed to export settings:', error);
      throw error;
    }
  }
}

module.exports = APISettingsHandler;
