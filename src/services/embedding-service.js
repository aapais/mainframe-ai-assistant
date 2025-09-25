/**
 * Vector Embedding Service
 * Handles generating and managing embeddings for semantic search
 */

const OpenAI = require('openai');
const ModelValidationService = require('./model-validation-service');

class EmbeddingService {
  constructor(apiKey, settings = null) {
    this.settings = settings;
    this.modelValidator = new ModelValidationService();
    this.activeModel = null;
    this.cache = new Map(); // Simple in-memory cache
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours

    // Initialize with legacy constructor for backward compatibility
    if (apiKey && !settings) {
      this.openai = new OpenAI({ apiKey });
      this.activeModel = {
        provider: 'openai',
        apiKey: apiKey,
        model: 'text-embedding-ada-002',
        client: this.openai,
      };
    } else if (settings) {
      this.initializeFromSettings(settings);
    } else {
      console.warn('⚠️ No API configuration provided. Embedding generation will be disabled.');
      this.openai = null;
    }
  }

  /**
   * Initialize embedding service from settings with fallback
   */
  async initializeFromSettings(settings) {
    if (!settings || !settings.useAI) {
      console.warn('⚠️ AI not enabled in settings');
      return false;
    }

    const modelConfigs = this.modelValidator.generateModelConfigurations(settings);
    if (modelConfigs.length === 0) {
      console.error('❌ No valid model configurations found');
      return false;
    }

    console.log('🔄 Finding working model with fallback...');
    const result = await this.modelValidator.findWorkingModel(modelConfigs);

    if (result.success) {
      this.activeModel = result.activeModel;

      // Create OpenAI client for active model
      if (this.activeModel.provider === 'openai') {
        this.openai = new OpenAI({ apiKey: this.activeModel.apiKey });
      } else if (this.activeModel.provider === 'azure') {
        this.openai = new OpenAI({
          apiKey: this.activeModel.apiKey,
          baseURL: `${this.activeModel.azureEndpoint}/openai/deployments`,
          defaultQuery: { 'api-version': '2023-12-01-preview' },
        });
      }

      this.activeModel.client = this.openai;

      if (result.fallbackUsed) {
        console.log(`⚠️ Using fallback model: ${this.activeModel.model}`);
      } else {
        console.log(`✅ Using default model: ${this.activeModel.model}`);
      }

      return true;
    } else {
      console.error('❌ No working models found:', result.error);
      return false;
    }
  }

  /**
   * Generate embedding for text using OpenAI's ada-002 model
   * @param {string} text - Text to generate embedding for
   * @param {object} options - Optional parameters
   * @returns {Promise<number[]|null>} - Vector embedding or null
   */
  async generateEmbedding(text, options = {}) {
    if (!this.activeModel?.client) {
      console.warn('No active model available. Skipping embedding generation.');
      return null;
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('Invalid text provided for embedding generation');
      return null;
    }

    // Clean and prepare text
    const cleanText = this.preprocessText(text);
    const cacheKey = this.getCacheKey(cleanText);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📄 Using cached embedding');
        return cached.embedding;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    try {
      console.log(`🧠 Generating new embedding with ${this.activeModel.model}...`);

      const response = await this.activeModel.client.embeddings.create({
        model: options.model || this.activeModel.model,
        input: cleanText,
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      this.cache.set(cacheKey, {
        embedding,
        timestamp: Date.now(),
      });

      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error(`❌ Error generating embedding with ${this.activeModel.model}:`, error.message);

      // Handle specific API errors
      if (error.status === 429) {
        console.warn('⏰ Rate limit hit. Consider implementing exponential backoff.');
      } else if (error.status === 401) {
        console.error('🔐 Invalid API key. Check your OpenAI configuration.');
      }

      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {string[]} texts - Array of texts
   * @param {object} options - Optional parameters
   * @returns {Promise<Array<number[]|null>>} - Array of embeddings
   */
  async generateBatchEmbeddings(texts, options = {}) {
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }

    const batchSize = options.batchSize || 10;
    const delay = options.delay || 1000; // 1 second between batches

    console.log(`🔄 Generating embeddings for ${texts.length} texts in batches of ${batchSize}`);

    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(
        `📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`
      );

      const batchPromises = batch.map(text => this.generateEmbedding(text, options));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        console.log(`⏰ Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Preprocess text for embedding generation
   * @param {string} text - Raw text
   * @returns {string} - Cleaned text
   */
  preprocessText(text) {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.-]/g, ' ') // Remove special characters except basic punctuation
      .substring(0, 8000); // Limit length to avoid API limits
  }

  /**
   * Generate cache key for text
   * @param {string} text - Text to generate key for
   * @returns {string} - Cache key
   */
  getCacheKey(text) {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {number[]} a - First embedding
   * @param {number[]} b - Second embedding
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Create embedding text from incident data
   * @param {object} incident - Incident object
   * @returns {string} - Combined text for embedding
   */
  createIncidentEmbeddingText(incident) {
    const parts = [
      incident.title || '',
      incident.description || '',
      incident.resolution || '',
      incident.technical_area || '',
      incident.business_area || '',
    ].filter(part => part.trim().length > 0);

    return parts.join(' ');
  }

  /**
   * Create embedding text from knowledge base entry
   * @param {object} entry - Knowledge base entry
   * @returns {string} - Combined text for embedding
   */
  createKnowledgeBaseEmbeddingText(entry) {
    const parts = [
      entry.title || '',
      entry.content || '',
      entry.summary || '',
      Array.isArray(entry.tags) ? entry.tags.join(' ') : '',
      entry.category || '',
    ].filter(part => part.trim().length > 0);

    return parts.join(' ');
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Embedding cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        timestamp: new Date(value.timestamp).toISOString(),
        age: Date.now() - value.timestamp,
      })),
    };
  }

  /**
   * Check if embedding service is available
   * @returns {boolean} - True if service is available
   */
  isAvailable() {
    return this.activeModel?.client !== null;
  }

  /**
   * Get active model information
   * @returns {object|null} - Active model details or null
   */
  getActiveModel() {
    return this.activeModel;
  }
}

module.exports = EmbeddingService;
