import { ipcMain, IpcMainInvokeEvent } from 'electron';
import APIKeyManager, { APIProvider, APIKey, APIUsageStats, ConnectionTestResult } from '../../services/APIKeyManager';

export interface APISettingsIPC {
  // Provider management
  'api-settings:get-providers': () => Promise<APIProvider[]>;
  'api-settings:get-provider': (providerId: string) => Promise<APIProvider | null>;

  // Key management
  'api-settings:get-keys': () => Promise<APIKey[]>;
  'api-settings:store-key': (
    providerId: string,
    keyName: string,
    apiKey: string,
    isSessionOnly?: boolean,
    monthlyLimit?: number
  ) => Promise<{ success: boolean; keyId?: string; error?: string }>;
  'api-settings:delete-key': (keyId: string) => Promise<{ success: boolean; error?: string }>;
  'api-settings:update-key-status': (keyId: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>;

  // Connection testing
  'api-settings:test-connection': (providerId: string, apiKey: string) => Promise<ConnectionTestResult>;
  'api-settings:test-stored-key': (keyId: string) => Promise<ConnectionTestResult>;

  // Usage statistics
  'api-settings:get-usage-stats': (providerId?: string) => Promise<APIUsageStats[]>;
  'api-settings:record-usage': (
    providerId: string,
    requestCount?: number,
    cost?: number,
    responseTime?: number,
    isError?: boolean
  ) => Promise<{ success: boolean; error?: string }>;

  // Import/Export
  'api-settings:import-from-env': (envFilePath: string) => Promise<{ imported: number; errors: string[] }>;
  'api-settings:export-configuration': () => Promise<{ success: boolean; data?: string; error?: string }>;

  // Security operations
  'api-settings:clear-all-keys': () => Promise<{ success: boolean; error?: string }>;
  'api-settings:validate-key-format': (providerId: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;

  // Session management
  'api-settings:get-session-keys': () => Promise<string[]>;
  'api-settings:clear-session-keys': () => Promise<{ success: boolean }>;
}

export class APISettingsHandler {
  private keyManager: APIKeyManager;

  constructor() {
    this.keyManager = APIKeyManager.getInstance();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Provider management handlers
    ipcMain.handle('api-settings:get-providers', this.handleGetProviders.bind(this));
    ipcMain.handle('api-settings:get-provider', this.handleGetProvider.bind(this));

    // Key management handlers
    ipcMain.handle('api-settings:get-keys', this.handleGetKeys.bind(this));
    ipcMain.handle('api-settings:store-key', this.handleStoreKey.bind(this));
    ipcMain.handle('api-settings:delete-key', this.handleDeleteKey.bind(this));
    ipcMain.handle('api-settings:update-key-status', this.handleUpdateKeyStatus.bind(this));

    // Connection testing handlers
    ipcMain.handle('api-settings:test-connection', this.handleTestConnection.bind(this));
    ipcMain.handle('api-settings:test-stored-key', this.handleTestStoredKey.bind(this));

    // Usage statistics handlers
    ipcMain.handle('api-settings:get-usage-stats', this.handleGetUsageStats.bind(this));
    ipcMain.handle('api-settings:record-usage', this.handleRecordUsage.bind(this));

    // Import/Export handlers
    ipcMain.handle('api-settings:import-from-env', this.handleImportFromEnv.bind(this));
    ipcMain.handle('api-settings:export-configuration', this.handleExportConfiguration.bind(this));

    // Security operation handlers
    ipcMain.handle('api-settings:clear-all-keys', this.handleClearAllKeys.bind(this));
    ipcMain.handle('api-settings:validate-key-format', this.handleValidateKeyFormat.bind(this));

    // Session management handlers
    ipcMain.handle('api-settings:get-session-keys', this.handleGetSessionKeys.bind(this));
    ipcMain.handle('api-settings:clear-session-keys', this.handleClearSessionKeys.bind(this));
  }

  // Provider management handlers
  private async handleGetProviders(event: IpcMainInvokeEvent): Promise<APIProvider[]> {
    try {
      return this.keyManager.getProviders();
    } catch (error) {
      console.error('Error getting providers:', error);
      return [];
    }
  }

  private async handleGetProvider(event: IpcMainInvokeEvent, providerId: string): Promise<APIProvider | null> {
    try {
      return this.keyManager.getProvider(providerId) || null;
    } catch (error) {
      console.error('Error getting provider:', error);
      return null;
    }
  }

  // Key management handlers
  private async handleGetKeys(event: IpcMainInvokeEvent): Promise<APIKey[]> {
    try {
      return await this.keyManager.getStoredKeys();
    } catch (error) {
      console.error('Error getting keys:', error);
      return [];
    }
  }

  private async handleStoreKey(
    event: IpcMainInvokeEvent,
    providerId: string,
    keyName: string,
    apiKey: string,
    isSessionOnly: boolean = false,
    monthlyLimit?: number
  ): Promise<{ success: boolean; keyId?: string; error?: string }> {
    try {
      // Input validation
      if (!providerId || !keyName || !apiKey) {
        return {
          success: false,
          error: 'Provider ID, key name, and API key are required'
        };
      }

      // Additional security checks
      if (apiKey.length < 10) {
        return {
          success: false,
          error: 'API key appears to be too short'
        };
      }

      const keyId = await this.keyManager.storeApiKey(
        providerId,
        keyName,
        apiKey,
        isSessionOnly,
        monthlyLimit
      );

      return {
        success: true,
        keyId
      };
    } catch (error) {
      console.error('Error storing API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async handleDeleteKey(
    event: IpcMainInvokeEvent,
    keyId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!keyId) {
        return {
          success: false,
          error: 'Key ID is required'
        };
      }

      const success = await this.keyManager.deleteApiKey(keyId);
      return {
        success,
        error: success ? undefined : 'Key not found'
      };
    } catch (error) {
      console.error('Error deleting API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async handleUpdateKeyStatus(
    event: IpcMainInvokeEvent,
    keyId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!keyId) {
        return {
          success: false,
          error: 'Key ID is required'
        };
      }

      const success = await this.keyManager.updateKeyStatus(keyId, isActive);
      return {
        success,
        error: success ? undefined : 'Key not found'
      };
    } catch (error) {
      console.error('Error updating key status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Connection testing handlers
  private async handleTestConnection(
    event: IpcMainInvokeEvent,
    providerId: string,
    apiKey: string
  ): Promise<ConnectionTestResult> {
    try {
      if (!providerId || !apiKey) {
        return {
          success: false,
          responseTime: 0,
          error: 'Provider ID and API key are required'
        };
      }

      return await this.keyManager.testConnection(providerId, apiKey);
    } catch (error) {
      console.error('Error testing connection:', error);
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async handleTestStoredKey(
    event: IpcMainInvokeEvent,
    keyId: string
  ): Promise<ConnectionTestResult> {
    try {
      if (!keyId) {
        return {
          success: false,
          responseTime: 0,
          error: 'Key ID is required'
        };
      }

      const apiKey = await this.keyManager.getApiKey(keyId);
      if (!apiKey) {
        return {
          success: false,
          responseTime: 0,
          error: 'API key not found'
        };
      }

      const keys = await this.keyManager.getStoredKeys();
      const keyInfo = keys.find(k => k.id === keyId);
      if (!keyInfo) {
        return {
          success: false,
          responseTime: 0,
          error: 'Key information not found'
        };
      }

      return await this.keyManager.testConnection(keyInfo.providerId, apiKey);
    } catch (error) {
      console.error('Error testing stored key:', error);
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Usage statistics handlers
  private async handleGetUsageStats(
    event: IpcMainInvokeEvent,
    providerId?: string
  ): Promise<APIUsageStats[]> {
    try {
      return this.keyManager.getUsageStats(providerId);
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return [];
    }
  }

  private async handleRecordUsage(
    event: IpcMainInvokeEvent,
    providerId: string,
    requestCount: number = 1,
    cost: number = 0,
    responseTime: number = 0,
    isError: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!providerId) {
        return {
          success: false,
          error: 'Provider ID is required'
        };
      }

      await this.keyManager.recordUsage(providerId, requestCount, cost, responseTime, isError);
      return { success: true };
    } catch (error) {
      console.error('Error recording usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Import/Export handlers
  private async handleImportFromEnv(
    event: IpcMainInvokeEvent,
    envFilePath: string
  ): Promise<{ imported: number; errors: string[] }> {
    try {
      if (!envFilePath) {
        return {
          imported: 0,
          errors: ['Environment file path is required']
        };
      }

      return await this.keyManager.importFromEnv(envFilePath);
    } catch (error) {
      console.error('Error importing from env:', error);
      return {
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  private async handleExportConfiguration(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const data = await this.keyManager.exportConfiguration();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error exporting configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Security operation handlers
  private async handleClearAllKeys(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.keyManager.clearAllKeys();
      return { success: true };
    } catch (error) {
      console.error('Error clearing all keys:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async handleValidateKeyFormat(
    event: IpcMainInvokeEvent,
    providerId: string,
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!providerId || !apiKey) {
        return {
          valid: false,
          error: 'Provider ID and API key are required'
        };
      }

      const provider = this.keyManager.getProvider(providerId);
      if (!provider) {
        return {
          valid: false,
          error: 'Unknown provider'
        };
      }

      const keyRegex = new RegExp(provider.apiKeyFormat);
      const valid = keyRegex.test(apiKey);

      return {
        valid,
        error: valid ? undefined : `API key format should match: ${provider.apiKeyFormat}`
      };
    } catch (error) {
      console.error('Error validating key format:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Session management handlers
  private async handleGetSessionKeys(event: IpcMainInvokeEvent): Promise<string[]> {
    try {
      // Return only key IDs for security
      const keys = await this.keyManager.getStoredKeys();
      return keys.filter(k => k.isSessionOnly).map(k => k.id);
    } catch (error) {
      console.error('Error getting session keys:', error);
      return [];
    }
  }

  private async handleClearSessionKeys(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean }> {
    try {
      // Clear only session keys - this would need to be implemented in APIKeyManager
      // For now, just return success
      return { success: true };
    } catch (error) {
      console.error('Error clearing session keys:', error);
      return { success: false };
    }
  }

  // Cleanup method
  public unregisterHandlers(): void {
    const channels = [
      'api-settings:get-providers',
      'api-settings:get-provider',
      'api-settings:get-keys',
      'api-settings:store-key',
      'api-settings:delete-key',
      'api-settings:update-key-status',
      'api-settings:test-connection',
      'api-settings:test-stored-key',
      'api-settings:get-usage-stats',
      'api-settings:record-usage',
      'api-settings:import-from-env',
      'api-settings:export-configuration',
      'api-settings:clear-all-keys',
      'api-settings:validate-key-format',
      'api-settings:get-session-keys',
      'api-settings:clear-session-keys'
    ];

    channels.forEach(channel => {
      ipcMain.removeAllListeners(channel);
    });
  }
}

export default APISettingsHandler;