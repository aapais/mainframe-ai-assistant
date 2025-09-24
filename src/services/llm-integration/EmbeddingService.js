/**
 * Embedding Service - Advanced Text Vectorization for Banking Systems
 * Supports multiple embedding providers with intelligent caching and batch processing
 */

const { OpenAI } = require('openai');
const logger = require('../../core/logging/Logger');
const { EmbeddingError, RateLimitError } = require('./utils/LLMErrors');

class EmbeddingService {
    constructor(config = {}) {
        this.config = {
            provider: config.provider || process.env.EMBEDDING_PROVIDER || 'openai',
            model: config.model || process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
            dimensions: config.dimensions || parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536,
            batchSize: config.batchSize || parseInt(process.env.EMBEDDING_BATCH_SIZE) || 100,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            timeout: config.timeout || 30000,
            cache: {
                enabled: config.cache?.enabled ?? true,
                ttl: config.cache?.ttl || parseInt(process.env.EMBEDDING_CACHE_TTL) || 86400000, // 24 hours
                maxSize: config.cache?.maxSize || 10000
            },
            rateLimit: {
                rpm: config.rateLimit?.rpm || 3000, // requests per minute
                tpm: config.rateLimit?.tpm || 1000000, // tokens per minute
                concurrent: config.rateLimit?.concurrent || 10
            }
        };

        this.client = null;
        this.cache = new Map();
        this.rateLimiter = {
            requests: [],
            tokens: [],
            activeRequests: 0
        };

        this.metrics = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalTokens: 0,
            errors: 0,
            avgLatency: 0
        };

        this.initialize();
    }

    /**
     * Initialize embedding client
     */
    initialize() {
        try {
            switch (this.config.provider) {
                case 'openai':
                    this.client = new OpenAI({
                        apiKey: process.env.OPENAI_API_KEY,
                        timeout: this.config.timeout
                    });
                    break;
                default:
                    throw new EmbeddingError(`Unsupported embedding provider: ${this.config.provider}`);
            }

            logger.info(`EmbeddingService initialized with provider: ${this.config.provider}`);
        } catch (error) {
            logger.error('Failed to initialize EmbeddingService:', error);
            throw new EmbeddingError('Embedding service initialization failed', error);
        }
    }

    /**
     * Generate embeddings for single text or array of texts
     */
    async generateEmbeddings(input, options = {}) {
        const startTime = Date.now();

        try {
            // Normalize input to array
            const texts = Array.isArray(input) ? input : [input];

            if (texts.length === 0) {
                throw new EmbeddingError('Input cannot be empty');
            }

            // Validate and preprocess texts
            const processedTexts = await this.preprocessTexts(texts, options);

            // Check cache for existing embeddings
            const { cached, missing, cacheKeys } = await this.checkCache(processedTexts);

            // Generate embeddings for missing texts
            let newEmbeddings = [];
            if (missing.length > 0) {
                newEmbeddings = await this.generateNewEmbeddings(missing, options);

                // Cache new embeddings
                if (this.config.cache.enabled) {
                    await this.cacheEmbeddings(missing, newEmbeddings, cacheKeys);
                }
            }

            // Combine cached and new embeddings in original order
            const allEmbeddings = this.combineEmbeddings(processedTexts, cached, newEmbeddings, missing);

            // Update metrics
            this.updateMetrics(startTime, texts.length, cached.length, missing.length);

            // Return single embedding for single input, array for multiple
            return Array.isArray(input) ? allEmbeddings : allEmbeddings[0];

        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to generate embeddings:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for banking documents with domain-specific preprocessing
     */
    async generateBankingEmbeddings(documents, options = {}) {
        const bankingOptions = {
            ...options,
            preprocessor: 'banking',
            chunkSize: options.chunkSize || 1000,
            chunkOverlap: options.chunkOverlap || 200,
            includeMetadata: options.includeMetadata ?? true
        };

        const processedDocs = await this.preprocessBankingDocuments(documents, bankingOptions);
        return await this.generateEmbeddings(processedDocs, bankingOptions);
    }

    /**
     * Batch processing for large datasets
     */
    async generateEmbeddingsBatch(texts, options = {}) {
        const batchSize = options.batchSize || this.config.batchSize;
        const results = [];

        logger.info(`Processing ${texts.length} texts in batches of ${batchSize}`);

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            try {
                await this.checkRateLimit(batch.length);
                const batchEmbeddings = await this.generateEmbeddings(batch, options);
                results.push(...batchEmbeddings);

                logger.debug(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
            } catch (error) {
                logger.error(`Failed to process batch ${Math.floor(i / batchSize) + 1}:`, error);

                if (options.continueOnError) {
                    // Add null embeddings for failed batch
                    results.push(...new Array(batch.length).fill(null));
                } else {
                    throw error;
                }
            }
        }

        return results;
    }

    /**
     * Calculate similarity between embeddings
     */
    calculateSimilarity(embedding1, embedding2, method = 'cosine') {
        if (!embedding1 || !embedding2) {
            throw new EmbeddingError('Both embeddings must be provided');
        }

        if (embedding1.length !== embedding2.length) {
            throw new EmbeddingError('Embeddings must have the same dimensions');
        }

        switch (method.toLowerCase()) {
            case 'cosine':
                return this.cosineSimilarity(embedding1, embedding2);
            case 'euclidean':
                return this.euclideanDistance(embedding1, embedding2);
            case 'dot_product':
                return this.dotProduct(embedding1, embedding2);
            default:
                throw new EmbeddingError(`Unsupported similarity method: ${method}`);
        }
    }

    /**
     * Find most similar embeddings
     */
    findSimilar(queryEmbedding, candidateEmbeddings, options = {}) {
        const {
            topK = 5,
            threshold = 0.7,
            method = 'cosine',
            includeScores = true
        } = options;

        const similarities = candidateEmbeddings.map((embedding, index) => ({
            index,
            embedding,
            similarity: this.calculateSimilarity(queryEmbedding, embedding, method)
        }));

        // Sort by similarity (descending for cosine, ascending for euclidean)
        const ascending = method.toLowerCase() === 'euclidean';
        similarities.sort((a, b) => ascending ? a.similarity - b.similarity : b.similarity - a.similarity);

        // Filter by threshold and limit to topK
        let results = similarities.filter(item =>
            ascending ? item.similarity <= threshold : item.similarity >= threshold
        ).slice(0, topK);

        if (!includeScores) {
            results = results.map(item => ({
                index: item.index,
                embedding: item.embedding
            }));
        }

        return results;
    }

    /**
     * Preprocess texts for embedding generation
     */
    async preprocessTexts(texts, options = {}) {
        const {
            maxLength = 8000,
            truncate = true,
            cleanText = true,
            normalizeWhitespace = true
        } = options;

        return texts.map(text => {
            if (typeof text !== 'string') {
                text = String(text);
            }

            if (cleanText) {
                // Remove control characters and normalize
                text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            }

            if (normalizeWhitespace) {
                // Normalize whitespace
                text = text.replace(/\s+/g, ' ').trim();
            }

            if (text.length > maxLength) {
                if (truncate) {
                    text = text.substring(0, maxLength);
                    logger.warn(`Text truncated to ${maxLength} characters`);
                } else {
                    throw new EmbeddingError(`Text exceeds maximum length of ${maxLength} characters`);
                }
            }

            return text;
        });
    }

    /**
     * Preprocess banking documents with domain-specific logic
     */
    async preprocessBankingDocuments(documents, options = {}) {
        const processed = [];

        for (const doc of documents) {
            if (typeof doc === 'string') {
                processed.push(await this.preprocessBankingText(doc, options));
            } else if (doc && typeof doc === 'object') {
                const text = doc.content || doc.text || JSON.stringify(doc);
                processed.push(await this.preprocessBankingText(text, options));
            } else {
                processed.push('');
            }
        }

        return processed;
    }

    /**
     * Banking-specific text preprocessing
     */
    async preprocessBankingText(text, options = {}) {
        // Anonymize sensitive information if needed
        if (options.anonymize !== false) {
            text = await this.anonymizeBankingData(text);
        }

        // Extract key banking terms and normalize
        text = this.normalizeBankingTerms(text);

        // Chunk large documents if needed
        if (options.chunkSize && text.length > options.chunkSize) {
            return this.chunkText(text, options.chunkSize, options.chunkOverlap || 0);
        }

        return text;
    }

    /**
     * Anonymize sensitive banking data
     */
    async anonymizeBankingData(text) {
        // Account numbers
        text = text.replace(/\b\d{8,20}\b/g, '[ACCOUNT]');

        // Credit card numbers
        text = text.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD]');

        // SSN patterns
        text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

        // Phone numbers
        text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

        // Email addresses
        text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

        return text;
    }

    /**
     * Normalize banking terminology
     */
    normalizeBankingTerms(text) {
        const termMappings = {
            'checking account': 'checking_account',
            'savings account': 'savings_account',
            'credit card': 'credit_card',
            'debit card': 'debit_card',
            'wire transfer': 'wire_transfer',
            'ach transfer': 'ach_transfer',
            'mobile banking': 'mobile_banking',
            'online banking': 'online_banking'
        };

        for (const [original, normalized] of Object.entries(termMappings)) {
            const regex = new RegExp(original, 'gi');
            text = text.replace(regex, normalized);
        }

        return text;
    }

    /**
     * Chunk text into smaller pieces
     */
    chunkText(text, chunkSize, overlap = 0) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            chunks.push(text.substring(start, end));
            start = end - overlap;
        }

        return chunks;
    }

    /**
     * Check cache for existing embeddings
     */
    async checkCache(texts) {
        if (!this.config.cache.enabled) {
            return {
                cached: [],
                missing: texts,
                cacheKeys: texts.map(text => this.getCacheKey(text))
            };
        }

        const cached = [];
        const missing = [];
        const cacheKeys = [];

        for (const text of texts) {
            const cacheKey = this.getCacheKey(text);
            cacheKeys.push(cacheKey);

            const cachedEmbedding = this.cache.get(cacheKey);
            if (cachedEmbedding && Date.now() - cachedEmbedding.timestamp < this.config.cache.ttl) {
                cached.push(cachedEmbedding.embedding);
                this.metrics.cacheHits++;
            } else {
                cached.push(null);
                missing.push(text);
                this.metrics.cacheMisses++;
            }
        }

        return { cached, missing, cacheKeys };
    }

    /**
     * Generate embeddings for new texts
     */
    async generateNewEmbeddings(texts, options = {}) {
        await this.checkRateLimit(texts.length);

        try {
            const response = await this.callEmbeddingAPI(texts, options);
            return response.data.map(item => item.embedding);
        } catch (error) {
            if (error.status === 429) {
                throw new RateLimitError('Rate limit exceeded for embedding generation', error);
            }
            throw new EmbeddingError('Failed to generate embeddings', error);
        }
    }

    /**
     * Call embedding API
     */
    async callEmbeddingAPI(texts, options = {}) {
        const model = options.model || this.config.model;

        switch (this.config.provider) {
            case 'openai':
                return await this.client.embeddings.create({
                    model,
                    input: texts,
                    encoding_format: 'float'
                });
            default:
                throw new EmbeddingError(`Unsupported provider: ${this.config.provider}`);
        }
    }

    /**
     * Cache embeddings
     */
    async cacheEmbeddings(texts, embeddings, cacheKeys) {
        for (let i = 0; i < texts.length; i++) {
            // Clean cache if at max size
            if (this.cache.size >= this.config.cache.maxSize) {
                this.cleanCache();
            }

            const missingIndex = i;
            const cacheKey = this.getCacheKey(texts[i]);

            this.cache.set(cacheKey, {
                embedding: embeddings[i],
                timestamp: Date.now()
            });
        }
    }

    /**
     * Combine cached and new embeddings
     */
    combineEmbeddings(originalTexts, cached, newEmbeddings, missingTexts) {
        const result = [];
        let newIndex = 0;

        for (let i = 0; i < originalTexts.length; i++) {
            if (cached[i] !== null) {
                result.push(cached[i]);
            } else {
                result.push(newEmbeddings[newIndex++]);
            }
        }

        return result;
    }

    /**
     * Generate cache key for text
     */
    getCacheKey(text) {
        // Simple hash function for cache key
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `emb_${this.config.provider}_${this.config.model}_${hash}`;
    }

    /**
     * Clean old cache entries
     */
    cleanCache() {
        const now = Date.now();
        const toDelete = [];

        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.config.cache.ttl) {
                toDelete.push(key);
            }
        }

        toDelete.forEach(key => this.cache.delete(key));

        // If still at max size, remove oldest entries
        if (this.cache.size >= this.config.cache.maxSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

            const removeCount = Math.floor(this.config.cache.maxSize * 0.1); // Remove 10%
            for (let i = 0; i < removeCount; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
    }

    /**
     * Rate limiting check
     */
    async checkRateLimit(textCount) {
        const now = Date.now();
        const windowMs = 60000; // 1 minute

        // Clean old requests
        this.rateLimiter.requests = this.rateLimiter.requests.filter(
            time => now - time < windowMs
        );
        this.rateLimiter.tokens = this.rateLimiter.tokens.filter(
            time => now - time < windowMs
        );

        // Check request rate limit
        if (this.rateLimiter.requests.length >= this.config.rateLimit.rpm) {
            throw new RateLimitError('Request rate limit exceeded');
        }

        // Check concurrent requests
        if (this.rateLimiter.activeRequests >= this.config.rateLimit.concurrent) {
            throw new RateLimitError('Concurrent request limit exceeded');
        }

        // Add current request
        this.rateLimiter.requests.push(now);
        this.rateLimiter.activeRequests++;

        // Estimate tokens (rough approximation)
        const estimatedTokens = textCount * 100; // Rough estimate
        this.rateLimiter.tokens.push(now);
    }

    /**
     * Similarity calculation methods
     */
    cosineSimilarity(a, b) {
        const dotProduct = this.dotProduct(a, b);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    euclideanDistance(a, b) {
        return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
    }

    dotProduct(a, b) {
        return a.reduce((sum, val, i) => sum + val * b[i], 0);
    }

    /**
     * Update service metrics
     */
    updateMetrics(startTime, totalTexts, cacheHits, cacheMisses) {
        const latency = Date.now() - startTime;

        this.metrics.requests++;
        this.metrics.totalTokens += totalTexts * 100; // Rough estimate
        this.metrics.avgLatency = (this.metrics.avgLatency * (this.metrics.requests - 1) + latency) / this.metrics.requests;

        this.rateLimiter.activeRequests--;
    }

    /**
     * Get service metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
            cacheSize: this.cache.size,
            rateLimiter: {
                activeRequests: this.rateLimiter.activeRequests,
                recentRequests: this.rateLimiter.requests.length,
                recentTokens: this.rateLimiter.tokens.length
            }
        };
    }

    /**
     * Clear cache and reset metrics
     */
    reset() {
        this.cache.clear();
        this.metrics = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalTokens: 0,
            errors: 0,
            avgLatency: 0
        };
        logger.info('EmbeddingService reset completed');
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const testEmbedding = await this.generateEmbeddings('health check test');
            return {
                status: 'healthy',
                provider: this.config.provider,
                model: this.config.model,
                dimensions: testEmbedding.length,
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                provider: this.config.provider,
                error: error.message,
                metrics: this.getMetrics()
            };
        }
    }
}

module.exports = EmbeddingService;