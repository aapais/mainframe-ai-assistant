/**
 * Embedding Service Configuration
 * Manages API keys and provider settings for multi-model embeddings
 */

class EmbeddingConfig {
  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    // Load from environment variables or default settings
    this.config = {
      // Default provider and model
      defaultProvider: process.env.EMBEDDING_PROVIDER || 'openai',
      defaultModel: process.env.EMBEDDING_MODEL || 'ada-002',

      // OpenAI Configuration
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        models: {
          'ada-002': {
            name: 'text-embedding-ada-002',
            dimensions: 1536,
            maxTokens: 8191,
            cost: 0.0001 // per 1K tokens
          },
          '3-small': {
            name: 'text-embedding-3-small',
            dimensions: 1536,
            maxTokens: 8191,
            cost: 0.00002
          },
          '3-large': {
            name: 'text-embedding-3-large',
            dimensions: 3072,
            maxTokens: 8191,
            cost: 0.00013
          }
        }
      },

      // Google Gemini Configuration
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        models: {
          'embedding-001': {
            name: 'models/embedding-001',
            dimensions: 768,
            maxTokens: 2048,
            cost: 0.00001 // Estimated
          }
        }
      },

      // Azure OpenAI Configuration
      azure: {
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'text-embedding-ada-002',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-12-01-preview',
        models: {
          'ada-002': {
            name: 'text-embedding-ada-002',
            dimensions: 1536,
            maxTokens: 8191,
            cost: 0.0001
          }
        }
      },

      // Database Schema Compatibility
      vectorDimensions: {
        // Current PostgreSQL schema supports 1536 dimensions
        supported: [1536],
        // Would need schema change for these
        needsSchemaUpdate: [768, 3072]
      },

      // Performance settings
      performance: {
        cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
        batchSize: 10,
        rateLimitDelay: 1000, // 1 second between batches
        maxRetries: 3
      }
    };
  }

  /**
   * Get configuration for a specific provider
   */
  getProviderConfig(provider) {
    return this.config[provider] || null;
  }

  /**
   * Get model information
   */
  getModelInfo(provider, model) {
    const providerConfig = this.getProviderConfig(provider);
    return providerConfig?.models[model] || null;
  }

  /**
   * Check if provider is configured (has API key)
   */
  isProviderConfigured(provider) {
    const providerConfig = this.getProviderConfig(provider);

    switch (provider) {
      case 'openai':
        return !!providerConfig?.apiKey;
      case 'gemini':
        return !!providerConfig?.apiKey;
      case 'azure':
        return !!(providerConfig?.apiKey && providerConfig?.endpoint);
      default:
        return false;
    }
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders() {
    const providers = ['openai', 'gemini', 'azure'];
    return providers.filter(provider => this.isProviderConfigured(provider));
  }

  /**
   * Get compatible models for current database schema
   */
  getCompatibleModels() {
    const compatible = [];
    const supportedDimensions = this.config.vectorDimensions.supported;

    for (const provider of ['openai', 'gemini', 'azure']) {
      const providerConfig = this.getProviderConfig(provider);
      if (!providerConfig || !this.isProviderConfigured(provider)) continue;

      for (const [modelKey, modelInfo] of Object.entries(providerConfig.models)) {
        if (supportedDimensions.includes(modelInfo.dimensions)) {
          compatible.push({
            provider,
            model: modelKey,
            name: modelInfo.name,
            dimensions: modelInfo.dimensions,
            cost: modelInfo.cost,
            maxTokens: modelInfo.maxTokens
          });
        }
      }
    }

    return compatible;
  }

  /**
   * Get recommended model based on requirements
   */
  getRecommendedModel(requirements = {}) {
    const compatible = this.getCompatibleModels();

    if (requirements.lowCost) {
      // Sort by cost, lowest first
      return compatible.sort((a, b) => a.cost - b.cost)[0];
    }

    if (requirements.highDimension) {
      // Sort by dimensions, highest first
      return compatible.sort((a, b) => b.dimensions - a.dimensions)[0];
    }

    // Default: return first compatible model or OpenAI ada-002
    return compatible.find(m => m.provider === 'openai' && m.model === 'ada-002') || compatible[0];
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    // Check if any provider is configured
    const configured = this.getConfiguredProviders();
    if (configured.length === 0) {
      errors.push('No embedding providers configured. Please set API keys.');
    }

    // Check default provider
    if (!this.isProviderConfigured(this.config.defaultProvider)) {
      warnings.push(`Default provider '${this.config.defaultProvider}' is not configured.`);
    }

    // Check database compatibility
    const compatible = this.getCompatibleModels();
    if (compatible.length === 0) {
      errors.push('No models compatible with current database schema (1536 dimensions).');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      configured,
      compatible: compatible.length
    };
  }

  /**
   * Generate environment file template
   */
  generateEnvTemplate() {
    return `# Embedding Service Configuration
# Choose your preferred provider and model

# Default settings
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=ada-002

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2023-12-01-preview

# Performance settings (optional)
# EMBEDDING_CACHE_TIMEOUT=86400000
# EMBEDDING_BATCH_SIZE=10
# EMBEDDING_RATE_LIMIT_DELAY=1000
`;
  }
}

module.exports = EmbeddingConfig;