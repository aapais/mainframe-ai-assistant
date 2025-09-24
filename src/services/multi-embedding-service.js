/**
 * Multi-Provider Embedding Service
 * Supports OpenAI, Google Gemini, Azure OpenAI for vector embeddings
 */

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class MultiEmbeddingService {
  constructor(config = {}) {
    this.config = {
      openai: config.openai,
      gemini: config.gemini,
      azure: config.azure,
      provider: config.provider || 'openai', // default provider
      model: config.model || 'ada-002'
    };

    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours

    this.initializeProviders();
  }

  initializeProviders() {
    // OpenAI
    if (this.config.openai?.apiKey) {
      this.openai = new OpenAI({ apiKey: this.config.openai.apiKey });
      console.log('✅ OpenAI embeddings initialized');
    }

    // Google Gemini
    if (this.config.gemini?.apiKey) {
      this.gemini = new GoogleGenerativeAI(this.config.gemini.apiKey);
      console.log('✅ Google Gemini embeddings initialized');
    }

    // Azure OpenAI
    if (this.config.azure?.apiKey && this.config.azure?.endpoint) {
      this.azure = new OpenAI({
        apiKey: this.config.azure.apiKey,
        baseURL: `${this.config.azure.endpoint}/openai/deployments/${this.config.azure.deployment}`,
        defaultQuery: { 'api-version': this.config.azure.apiVersion || '2023-12-01-preview' },
        defaultHeaders: {
          'api-key': this.config.azure.apiKey,
        }
      });
      console.log('✅ Azure OpenAI embeddings initialized');
    }
  }

  /**
   * Get model dimensions and info
   */
  getModelInfo(provider = this.config.provider, model = this.config.model) {
    const modelSpecs = {
      openai: {
        'ada-002': { dimensions: 1536, maxTokens: 8191, name: 'text-embedding-ada-002' },
        '3-small': { dimensions: 1536, maxTokens: 8191, name: 'text-embedding-3-small' },
        '3-large': { dimensions: 3072, maxTokens: 8191, name: 'text-embedding-3-large' }
      },
      gemini: {
        'embedding-001': { dimensions: 768, maxTokens: 2048, name: 'models/embedding-001' }
      },
      azure: {
        'ada-002': { dimensions: 1536, maxTokens: 8191, name: 'text-embedding-ada-002' }
      }
    };

    return modelSpecs[provider]?.[model] || { dimensions: 1536, maxTokens: 8191, name: 'unknown' };
  }

  /**
   * Generate embedding using specified provider
   */
  async generateEmbedding(text, options = {}) {
    const provider = options.provider || this.config.provider;
    const model = options.model || this.config.model;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('Invalid text provided for embedding generation');
      return null;
    }

    const cleanText = this.preprocessText(text);
    const cacheKey = this.getCacheKey(cleanText, provider, model);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📄 Using cached ${provider} embedding`);
        return cached.embedding;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    try {
      let embedding;
      const modelInfo = this.getModelInfo(provider, model);

      switch (provider) {
        case 'openai':
          embedding = await this.generateOpenAIEmbedding(cleanText, modelInfo);
          break;

        case 'gemini':
          embedding = await this.generateGeminiEmbedding(cleanText, modelInfo);
          break;

        case 'azure':
          embedding = await this.generateAzureEmbedding(cleanText, modelInfo);
          break;

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      if (embedding) {
        // Cache the result
        this.cache.set(cacheKey, {
          embedding,
          timestamp: Date.now(),
          provider,
          model,
          dimensions: embedding.length
        });

        console.log(`✅ Generated ${provider} embedding (${embedding.length}D)`);
        return embedding;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error generating ${provider} embedding:`, error.message);
      return null;
    }
  }

  /**
   * OpenAI embedding generation
   */
  async generateOpenAIEmbedding(text, modelInfo) {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    const response = await this.openai.embeddings.create({
      model: modelInfo.name,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Google Gemini embedding generation
   */
  async generateGeminiEmbedding(text, modelInfo) {
    if (!this.gemini) {
      throw new Error('Gemini not initialized');
    }

    const model = this.gemini.getGenerativeModel({ model: 'embedding-001' });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  /**
   * Azure OpenAI embedding generation
   */
  async generateAzureEmbedding(text, modelInfo) {
    if (!this.azure) {
      throw new Error('Azure OpenAI not initialized');
    }

    const response = await this.azure.embeddings.create({
      model: modelInfo.name,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.max(-1, Math.min(1, similarity)); // Clamp between -1 and 1
  }

  /**
   * Batch embedding generation with rate limiting
   */
  async generateBatchEmbeddings(texts, options = {}) {
    const batchSize = options.batchSize || 10;
    const delay = options.delay || 1000; // 1 second between batches
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);

      const batchPromises = batch.map(text => this.generateEmbedding(text, options));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // Rate limiting delay
      if (i + batchSize < texts.length) {
        await this.sleep(delay);
      }
    }

    return results;
  }

  /**
   * Preprocess text for embedding
   */
  preprocessText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sáéíóúàèìòùâêîôûãõç\-_.,!?]/gi, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Generate cache key
   */
  getCacheKey(text, provider, model) {
    const textHash = text.substring(0, 100) + text.length;
    return `${provider}_${model}_${textHash}`;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      providers: [...new Set(Array.from(this.cache.values()).map(v => v.provider))],
      totalDimensions: Array.from(this.cache.values()).reduce((sum, v) => sum + v.dimensions, 0)
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Embedding cache cleared');
  }

  /**
   * Check provider availability
   */
  getAvailableProviders() {
    const available = [];

    if (this.openai) available.push('openai');
    if (this.gemini) available.push('gemini');
    if (this.azure) available.push('azure');

    return available;
  }
}

module.exports = MultiEmbeddingService;