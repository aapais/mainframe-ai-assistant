/**
 * Settings Service - Frontend API client for user settings
 * Handles all communication with the settings API backend
 */

class SettingsService {
  constructor() {
    this.baseUrl = '/api/settings';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get user settings by ID, with caching
   * @param {number} userId - User ID
   * @param {boolean} forceRefresh - Skip cache and fetch fresh data
   * @returns {Promise<Object>} Settings data
   */
  async getSettings(userId, forceRefresh = false) {
    try {
      const cacheKey = `settings_${userId}`;

      // Check cache first
      if (!forceRefresh && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      const response = await fetch(`${this.baseUrl}/${userId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });

      return result.data;
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      throw new Error(`Failed to load settings: ${error.message}`);
    }
  }

  /**
   * Update user settings (partial updates allowed)
   * @param {number} userId - User ID
   * @param {Object} updates - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(userId, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Update cache
      const cacheKey = `settings_${userId}`;
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  /**
   * Reset settings to defaults
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Default settings
   */
  async resetSettings(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/${userId}/reset`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Update cache with defaults
      const cacheKey = `settings_${userId}`;
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  }

  /**
   * Export settings as downloadable file
   * @param {number} userId - User ID
   * @param {string} format - Export format (json, csv, xml)
   * @returns {Promise<void>} Downloads file
   */
  async exportSettings(userId, format = 'json') {
    try {
      const response = await fetch(`${this.baseUrl}/${userId}/export`);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `mainframe-ai-settings-${userId}-${Date.now()}.json`;

      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      // Create and download file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
      throw new Error(`Failed to export settings: ${error.message}`);
    }
  }

  /**
   * Import settings from file
   * @param {number} userId - User ID
   * @param {Object} importData - Settings data to import
   * @returns {Promise<Object>} Import result
   */
  async importSettings(userId, importData) {
    try {
      const response = await fetch(`${this.baseUrl}/${userId}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Update cache with imported settings
      const cacheKey = `settings_${userId}`;
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error(`Failed to import settings: ${error.message}`);
    }
  }

  /**
   * Batch update multiple settings efficiently
   * @param {number} userId - User ID
   * @param {Array} updates - Array of {key, value} objects
   * @returns {Promise<Object>} Updated settings
   */
  async batchUpdateSettings(userId, updates) {
    try {
      const updateObject = {};
      updates.forEach(update => {
        updateObject[update.key] = update.value;
      });

      return await this.updateSettings(userId, updateObject);
    } catch (error) {
      console.error('Failed to batch update settings:', error);
      throw error;
    }
  }

  /**
   * Update a single setting
   * @param {number} userId - User ID
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<Object>} Updated settings
   */
  async updateSingleSetting(userId, key, value) {
    return await this.updateSettings(userId, { [key]: value });
  }

  /**
   * Get a specific setting value
   * @param {number} userId - User ID
   * @param {string} key - Setting key
   * @param {*} defaultValue - Default value if not found
   * @returns {Promise<*>} Setting value
   */
  async getSetting(userId, key, defaultValue = null) {
    try {
      const settings = await this.getSettings(userId);
      return settings[key] !== undefined ? settings[key] : defaultValue;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Check if settings service is available
   * @returns {Promise<boolean>} Service health status
   */
  async isServiceHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Settings service health check failed:', error);
      return false;
    }
  }

  /**
   * Clear local cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      timeout: this.cacheTimeout,
    };
  }

  /**
   * Preload settings for a user (warm cache)
   * @param {number} userId - User ID
   */
  async preloadSettings(userId) {
    try {
      await this.getSettings(userId, true); // Force refresh
      console.log(`Settings preloaded for user ${userId}`);
    } catch (error) {
      console.warn(`Failed to preload settings for user ${userId}:`, error);
    }
  }

  /**
   * Subscribe to settings changes (if real-time updates are implemented)
   * @param {number} userId - User ID
   * @param {Function} callback - Change callback
   */
  subscribeToChanges(userId, callback) {
    // This would implement WebSocket or Server-Sent Events for real-time updates
    console.warn('Real-time settings updates not yet implemented');
    // TODO: Implement WebSocket subscription
  }

  /**
   * Validate settings object structure
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validateSettings(settings) {
    const errors = [];
    const warnings = [];

    // Validate theme
    if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
      errors.push('Invalid theme value');
    }

    // Validate language
    if (settings.language && !['en', 'pt', 'es'].includes(settings.language)) {
      errors.push('Invalid language value');
    }

    // Validate font size
    if (settings.font_size && (settings.font_size < 10 || settings.font_size > 24)) {
      errors.push('Font size must be between 10 and 24');
    }

    // Validate display density
    if (
      settings.display_density &&
      !['compact', 'normal', 'comfortable'].includes(settings.display_density)
    ) {
      errors.push('Invalid display density value');
    }

    // Validate auto-save interval
    if (settings.auto_save_interval && settings.auto_save_interval < 10) {
      warnings.push('Auto-save interval less than 10 seconds may impact performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Create and export singleton instance
const settingsService = new SettingsService();

// Make available globally for browser usage
if (typeof window !== 'undefined') {
  window.settingsService = settingsService;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = settingsService;
}

export default settingsService;
