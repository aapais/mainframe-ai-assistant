import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface APIProvider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKeyFormat: string;
  testEndpoint: string;
  pricingInfo: {
    inputCostPer1K: number;
    outputCostPer1K: number;
    currency: string;
  };
  documentationUrl: string;
  setupInstructions: string[];
  requiredHeaders?: Record<string, string>;
}

export interface APIKey {
  id: string;
  providerId: string;
  keyName: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  costThisMonth: number;
  monthlyLimit?: number;
  isSessionOnly: boolean;
}

export interface APIUsageStats {
  providerId: string;
  requestCount: number;
  totalCost: number;
  lastRequest: Date;
  errorCount: number;
  averageResponseTime: number;
}

export interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  statusCode?: number;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

export class APIKeyManager {
  private static instance: APIKeyManager;
  private encryptionKey: Buffer;
  private storePath: string;
  private sessionKeys: Map<string, string> = new Map();
  private usageStats: Map<string, APIUsageStats> = new Map();

  // Supported API providers configuration
  private providers: APIProvider[] = [
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT models for text generation and completion',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyFormat: 'sk-.*',
      testEndpoint: '/models',
      pricingInfo: {
        inputCostPer1K: 0.0015,
        outputCostPer1K: 0.002,
        currency: 'USD'
      },
      documentationUrl: 'https://platform.openai.com/docs',
      setupInstructions: [
        'Go to OpenAI Platform (platform.openai.com)',
        'Sign in to your account',
        'Navigate to API Keys section',
        'Click "Create new secret key"',
        'Copy the key (it starts with sk-)'
      ],
      requiredHeaders: {
        'Authorization': 'Bearer {key}',
        'Content-Type': 'application/json'
      }
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Claude AI models for advanced reasoning',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKeyFormat: 'sk-ant-.*',
      testEndpoint: '/messages',
      pricingInfo: {
        inputCostPer1K: 0.008,
        outputCostPer1K: 0.024,
        currency: 'USD'
      },
      documentationUrl: 'https://docs.anthropic.com',
      setupInstructions: [
        'Visit console.anthropic.com',
        'Create an account or sign in',
        'Go to Settings > API Keys',
        'Generate a new API key',
        'Copy the key (starts with sk-ant-)'
      ],
      requiredHeaders: {
        'x-api-key': '{key}',
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google\'s multimodal AI models',
      baseUrl: 'https://generativelanguage.googleapis.com/v1',
      apiKeyFormat: 'AIza.*',
      testEndpoint: '/models',
      pricingInfo: {
        inputCostPer1K: 0.00035,
        outputCostPer1K: 0.00105,
        currency: 'USD'
      },
      documentationUrl: 'https://ai.google.dev/docs',
      setupInstructions: [
        'Go to Google AI Studio (aistudio.google.com)',
        'Sign in with your Google account',
        'Click "Get API key"',
        'Create a new API key',
        'Copy the key (starts with AIza)'
      ],
      requiredHeaders: {
        'Content-Type': 'application/json'
      }
    },
    {
      id: 'github-copilot',
      name: 'GitHub Copilot',
      description: 'AI-powered code completion and suggestions',
      baseUrl: 'https://api.githubcopilot.com/v1',
      apiKeyFormat: 'ghu_.*',
      testEndpoint: '/user',
      pricingInfo: {
        inputCostPer1K: 0.0,
        outputCostPer1K: 0.0,
        currency: 'USD'
      },
      documentationUrl: 'https://docs.github.com/en/copilot',
      setupInstructions: [
        'Go to GitHub.com and sign in',
        'Navigate to Settings > Developer settings',
        'Click on Personal access tokens',
        'Generate new token with copilot scope',
        'Copy the token (starts with ghu_)'
      ],
      requiredHeaders: {
        'Authorization': 'Bearer {key}',
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  ];

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'api-keys-secure.dat');
    this.initializeEncryption();
    this.loadUsageStats();
  }

  public static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager();
    }
    return APIKeyManager.instance;
  }

  private initializeEncryption(): void {
    const keyPath = path.join(app.getPath('userData'), 'master.key');

    try {
      // Try to load existing key
      const keyData = require('fs').readFileSync(keyPath);
      this.encryptionKey = keyData;
    } catch (error) {
      // Generate new encryption key
      this.encryptionKey = crypto.randomBytes(32);
      require('fs').writeFileSync(keyPath, this.encryptionKey, { mode: 0o600 });
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('api-key-data'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('api-key-data'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length);

    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.max(8, apiKey.length - 8));

    return start + middle + end;
  }

  private async loadStoredKeys(): Promise<APIKey[]> {
    try {
      const data = await fs.readFile(this.storePath, 'utf8');
      const decryptedData = this.decrypt(data);
      return JSON.parse(decryptedData, (key, value) => {
        if (key === 'createdAt' || key === 'lastUsed') {
          return value ? new Date(value) : undefined;
        }
        return value;
      });
    } catch (error) {
      return [];
    }
  }

  private async saveStoredKeys(keys: APIKey[]): Promise<void> {
    const jsonData = JSON.stringify(keys);
    const encryptedData = this.encrypt(jsonData);
    await fs.writeFile(this.storePath, encryptedData, { mode: 0o600 });
  }

  private async loadUsageStats(): Promise<void> {
    try {
      const statsPath = path.join(app.getPath('userData'), 'api-usage-stats.json');
      const data = await fs.readFile(statsPath, 'utf8');
      const stats = JSON.parse(data, (key, value) => {
        if (key === 'lastRequest') {
          return value ? new Date(value) : undefined;
        }
        return value;
      });

      this.usageStats = new Map(Object.entries(stats));
    } catch (error) {
      // Stats file doesn't exist yet
    }
  }

  private async saveUsageStats(): Promise<void> {
    const statsPath = path.join(app.getPath('userData'), 'api-usage-stats.json');
    const statsObject = Object.fromEntries(this.usageStats);
    await fs.writeFile(statsPath, JSON.stringify(statsObject, null, 2));
  }

  // Public API methods
  public getProviders(): APIProvider[] {
    return [...this.providers];
  }

  public getProvider(providerId: string): APIProvider | undefined {
    return this.providers.find(p => p.id === providerId);
  }

  public async getStoredKeys(): Promise<APIKey[]> {
    const keys = await this.loadStoredKeys();
    return keys.map(key => ({
      ...key,
      maskedKey: this.maskApiKey(key.maskedKey) // Re-mask for safety
    }));
  }

  public async storeApiKey(
    providerId: string,
    keyName: string,
    apiKey: string,
    isSessionOnly: boolean = false,
    monthlyLimit?: number
  ): Promise<string> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    // Validate API key format
    const keyRegex = new RegExp(provider.apiKeyFormat);
    if (!keyRegex.test(apiKey)) {
      throw new Error(`Invalid API key format for ${provider.name}`);
    }

    const keyId = crypto.randomUUID();
    const newKey: APIKey = {
      id: keyId,
      providerId,
      keyName,
      maskedKey: apiKey, // Will be encrypted when stored
      isActive: true,
      createdAt: new Date(),
      usageCount: 0,
      costThisMonth: 0,
      monthlyLimit,
      isSessionOnly
    };

    if (isSessionOnly) {
      this.sessionKeys.set(keyId, apiKey);
    } else {
      const keys = await this.loadStoredKeys();
      keys.push(newKey);
      await this.saveStoredKeys(keys);
    }

    return keyId;
  }

  public async getApiKey(keyId: string): Promise<string | null> {
    // Check session keys first
    if (this.sessionKeys.has(keyId)) {
      return this.sessionKeys.get(keyId)!;
    }

    // Check stored keys
    const keys = await this.loadStoredKeys();
    const key = keys.find(k => k.id === keyId);
    return key ? key.maskedKey : null; // This is actually the encrypted key
  }

  public async deleteApiKey(keyId: string): Promise<boolean> {
    // Remove from session keys
    if (this.sessionKeys.has(keyId)) {
      this.sessionKeys.delete(keyId);
      return true;
    }

    // Remove from stored keys
    const keys = await this.loadStoredKeys();
    const index = keys.findIndex(k => k.id === keyId);
    if (index !== -1) {
      keys.splice(index, 1);
      await this.saveStoredKeys(keys);
      return true;
    }

    return false;
  }

  public async testConnection(
    providerId: string,
    apiKey: string
  ): Promise<ConnectionTestResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        success: false,
        responseTime: 0,
        error: `Unknown provider: ${providerId}`
      };
    }

    const startTime = Date.now();

    try {
      const url = `${provider.baseUrl}${provider.testEndpoint}`;
      const headers: Record<string, string> = {};

      // Build headers based on provider requirements
      if (provider.requiredHeaders) {
        for (const [key, value] of Object.entries(provider.requiredHeaders)) {
          headers[key] = value.replace('{key}', apiKey);
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          responseTime,
          statusCode: response.status,
          rateLimitInfo: this.extractRateLimitInfo(response)
        };
      } else {
        return {
          success: false,
          responseTime,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private extractRateLimitInfo(response: Response): { limit: number; remaining: number; resetTime: Date } | undefined {
    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        resetTime: new Date(parseInt(reset) * 1000)
      };
    }

    return undefined;
  }

  public async recordUsage(
    providerId: string,
    requestCount: number = 1,
    cost: number = 0,
    responseTime: number = 0,
    isError: boolean = false
  ): Promise<void> {
    const current = this.usageStats.get(providerId) || {
      providerId,
      requestCount: 0,
      totalCost: 0,
      lastRequest: new Date(),
      errorCount: 0,
      averageResponseTime: 0
    };

    current.requestCount += requestCount;
    current.totalCost += cost;
    current.lastRequest = new Date();
    if (isError) current.errorCount++;

    // Update average response time
    const totalTime = current.averageResponseTime * (current.requestCount - requestCount);
    current.averageResponseTime = (totalTime + responseTime) / current.requestCount;

    this.usageStats.set(providerId, current);
    await this.saveUsageStats();
  }

  public getUsageStats(providerId?: string): APIUsageStats[] {
    if (providerId) {
      const stats = this.usageStats.get(providerId);
      return stats ? [stats] : [];
    }
    return Array.from(this.usageStats.values());
  }

  public async importFromEnv(envFilePath: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const envContent = await fs.readFile(envFilePath, 'utf8');
      const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      for (const line of envLines) {
        const [key, value] = line.split('=', 2);
        if (!key || !value) continue;

        const cleanKey = key.trim();
        const cleanValue = value.trim().replace(/^["']|["']$/g, '');

        // Map environment variable names to provider IDs
        let providerId: string | undefined;
        let keyName = cleanKey;

        if (cleanKey.includes('OPENAI')) {
          providerId = 'openai';
        } else if (cleanKey.includes('ANTHROPIC') || cleanKey.includes('CLAUDE')) {
          providerId = 'anthropic';
        } else if (cleanKey.includes('GEMINI') || cleanKey.includes('GOOGLE')) {
          providerId = 'gemini';
        } else if (cleanKey.includes('GITHUB') || cleanKey.includes('COPILOT')) {
          providerId = 'github-copilot';
        }

        if (providerId && cleanValue) {
          try {
            await this.storeApiKey(providerId, keyName, cleanValue, false);
            imported++;
          } catch (error) {
            errors.push(`Failed to import ${cleanKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Failed to read env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { imported, errors };
  }

  public async exportConfiguration(): Promise<string> {
    const keys = await this.getStoredKeys();
    const stats = this.getUsageStats();

    const config = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      keys: keys.map(key => ({
        id: key.id,
        providerId: key.providerId,
        keyName: key.keyName,
        isActive: key.isActive,
        createdAt: key.createdAt,
        monthlyLimit: key.monthlyLimit,
        // Note: Actual keys are not exported for security
      })),
      stats: stats,
      providers: this.providers.map(p => ({ id: p.id, name: p.name }))
    };

    return JSON.stringify(config, null, 2);
  }

  public async clearAllKeys(): Promise<void> {
    this.sessionKeys.clear();
    await this.saveStoredKeys([]);
    this.usageStats.clear();
    await this.saveUsageStats();
  }

  public async updateKeyStatus(keyId: string, isActive: boolean): Promise<boolean> {
    if (this.sessionKeys.has(keyId)) {
      // Session keys are always active while in memory
      return true;
    }

    const keys = await this.loadStoredKeys();
    const key = keys.find(k => k.id === keyId);
    if (key) {
      key.isActive = isActive;
      await this.saveStoredKeys(keys);
      return true;
    }

    return false;
  }
}

export default APIKeyManager;