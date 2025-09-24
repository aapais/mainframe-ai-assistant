/**
 * RAG Pipeline - Retrieval Augmented Generation for Banking Systems
 * Advanced pipeline combining semantic search, document retrieval, and context injection
 */

const logger = require('../../core/logging/Logger');
const EmbeddingService = require('./EmbeddingService');
const VectorDatabase = require('./embeddings/VectorDatabase');
const { RAGError, RetrievalError } = require('./utils/LLMErrors');

class RAGPipeline {
    constructor(config = {}) {
        this.config = {
            // Retrieval configuration
            retrieval: {
                topK: config.retrieval?.topK || parseInt(process.env.RAG_TOP_K_RESULTS) || 5,
                similarityThreshold: config.retrieval?.similarityThreshold ||
                    parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
                maxContextLength: config.retrieval?.maxContextLength || 4000,
                rerank: config.retrieval?.rerank ?? (process.env.RAG_RERANK_RESULTS === 'true'),
                diversityFactor: config.retrieval?.diversityFactor || 0.2
            },

            // Document processing
            documents: {
                chunkSize: config.documents?.chunkSize || parseInt(process.env.RAG_CHUNK_SIZE) || 1000,
                chunkOverlap: config.documents?.chunkOverlap || parseInt(process.env.RAG_CHUNK_OVERLAP) || 200,
                enableMetadata: config.documents?.enableMetadata ?? true,
                preserveFormatting: config.documents?.preserveFormatting ?? false
            },

            // Banking-specific settings
            banking: {
                enableComplianceFilter: config.banking?.enableComplianceFilter ?? true,
                anonymizeResults: config.banking?.anonymizeResults ?? true,
                prioritizeRegulatory: config.banking?.prioritizeRegulatory ?? true,
                includeRiskContext: config.banking?.includeRiskContext ?? true
            },

            // Performance settings
            performance: {
                cacheEnabled: config.performance?.cacheEnabled ?? true,
                cacheTTL: config.performance?.cacheTTL || 3600000, // 1 hour
                parallelRetrieval: config.performance?.parallelRetrieval ?? true,
                maxConcurrency: config.performance?.maxConcurrency || 5
            }
        };

        this.embeddingService = new EmbeddingService(config.embeddings);
        this.vectorDatabase = new VectorDatabase(config.vectorDatabase);

        this.cache = new Map();
        this.metrics = {
            retrievalCalls: 0,
            totalDocuments: 0,
            avgRetrievalTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            relevanceScores: []
        };

        this.initialize();
    }

    /**
     * Initialize RAG pipeline
     */
    async initialize() {
        try {
            await this.vectorDatabase.initialize();
            logger.info('RAG Pipeline initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize RAG Pipeline:', error);
            throw new RAGError('RAG Pipeline initialization failed', error);
        }
    }

    /**
     * Main retrieval method - get relevant context for a query
     */
    async retrieve(query, options = {}) {
        const startTime = Date.now();

        try {
            const retrievalOptions = {
                ...this.config.retrieval,
                ...options
            };

            // Check cache first
            if (this.config.performance.cacheEnabled) {
                const cached = await this.checkCache(query, retrievalOptions);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
                this.metrics.cacheMisses++;
            }

            // Generate query embedding
            const queryEmbedding = await this.embeddingService.generateEmbeddings(query);

            // Retrieve relevant documents
            const retrievedDocs = await this.performRetrieval(queryEmbedding, retrievalOptions);

            // Post-process and rank results
            const rankedDocs = await this.rankAndFilter(query, retrievedDocs, retrievalOptions);

            // Apply banking-specific filters
            const filteredDocs = await this.applyBankingFilters(rankedDocs, retrievalOptions);

            // Generate final context
            const context = await this.generateContext(filteredDocs, retrievalOptions);

            // Cache results
            if (this.config.performance.cacheEnabled) {
                await this.cacheResults(query, retrievalOptions, context);
            }

            // Update metrics
            this.updateMetrics(startTime, context.length);

            return context;

        } catch (error) {
            logger.error('RAG retrieval failed:', error);
            throw new RetrievalError('Failed to retrieve relevant documents', error);
        }
    }

    /**
     * Enhanced retrieval with banking domain knowledge
     */
    async retrieveBankingContext(query, domain, options = {}) {
        const bankingOptions = {
            ...options,
            filters: {
                ...options.filters,
                domain: domain,
                type: this.getBankingDocumentTypes(domain)
            },
            prioritizeBy: this.getBankingPriorities(domain),
            includeRegulatory: true
        };

        return await this.retrieve(query, bankingOptions);
    }

    /**
     * Perform vector similarity search
     */
    async performRetrieval(queryEmbedding, options) {
        try {
            const searchResults = await this.vectorDatabase.similaritySearch(
                queryEmbedding,
                {
                    k: Math.min(options.topK * 3, 50), // Retrieve more for better ranking
                    threshold: options.similarityThreshold * 0.8, // Lower threshold for initial retrieval
                    filters: options.filters,
                    includeMetadata: true,
                    includeScores: true
                }
            );

            return searchResults.map(result => ({
                content: result.content,
                metadata: result.metadata || {},
                score: result.score || 0,
                id: result.id
            }));

        } catch (error) {
            throw new RetrievalError('Vector database search failed', error);
        }
    }

    /**
     * Rank and filter retrieved documents
     */
    async rankAndFilter(query, documents, options) {
        if (documents.length === 0) return documents;

        let rankedDocs = [...documents];

        // Apply semantic reranking if enabled
        if (options.rerank) {
            rankedDocs = await this.semanticRerank(query, rankedDocs);
        }

        // Apply diversity filter to reduce redundancy
        if (options.diversityFactor > 0) {
            rankedDocs = await this.applyDiversityFilter(rankedDocs, options);
        }

        // Filter by similarity threshold
        rankedDocs = rankedDocs.filter(doc => doc.score >= options.similarityThreshold);

        // Limit to topK results
        rankedDocs = rankedDocs.slice(0, options.topK);

        return rankedDocs;
    }

    /**
     * Semantic reranking using cross-encoder model
     */
    async semanticRerank(query, documents) {
        try {
            // Simple reranking based on content relevance
            // In production, you might use a dedicated reranking model
            const reranked = documents.map(doc => {
                // Calculate relevance based on query term overlap and semantic similarity
                const relevanceScore = this.calculateRelevanceScore(query, doc.content);
                return {
                    ...doc,
                    rerankScore: relevanceScore,
                    combinedScore: (doc.score * 0.7) + (relevanceScore * 0.3)
                };
            });

            // Sort by combined score
            reranked.sort((a, b) => b.combinedScore - a.combinedScore);

            return reranked;

        } catch (error) {
            logger.warn('Semantic reranking failed, using original ranking:', error);
            return documents;
        }
    }

    /**
     * Calculate relevance score for reranking
     */
    calculateRelevanceScore(query, content) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const contentLower = content.toLowerCase();

        let score = 0;
        let termMatches = 0;

        queryTerms.forEach(term => {
            if (contentLower.includes(term)) {
                termMatches++;
                // Boost score for exact matches
                const exactMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
                score += exactMatches * 0.1;
            }
        });

        // Add bonus for term coverage
        const termCoverage = termMatches / queryTerms.length;
        score += termCoverage * 0.5;

        return Math.min(score, 1.0);
    }

    /**
     * Apply diversity filter to reduce redundant results
     */
    async applyDiversityFilter(documents, options) {
        if (documents.length <= 1) return documents;

        const diverseDocs = [documents[0]]; // Always include the top result
        const diversityThreshold = 1 - options.diversityFactor;

        for (let i = 1; i < documents.length; i++) {
            const candidate = documents[i];
            let shouldAdd = true;

            // Check similarity with already selected documents
            for (const selected of diverseDocs) {
                const similarity = this.calculateContentSimilarity(candidate.content, selected.content);
                if (similarity > diversityThreshold) {
                    shouldAdd = false;
                    break;
                }
            }

            if (shouldAdd) {
                diverseDocs.push(candidate);
            }

            // Stop if we have enough diverse results
            if (diverseDocs.length >= options.topK) break;
        }

        return diverseDocs;
    }

    /**
     * Calculate content similarity for diversity filtering
     */
    calculateContentSimilarity(content1, content2) {
        // Simple Jaccard similarity for content diversity
        const words1 = new Set(content1.toLowerCase().split(/\s+/));
        const words2 = new Set(content2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * Apply banking-specific filters
     */
    async applyBankingFilters(documents, options) {
        if (!this.config.banking.enableComplianceFilter) return documents;

        let filtered = [...documents];

        // Prioritize regulatory documents if enabled
        if (this.config.banking.prioritizeRegulatory) {
            filtered = this.prioritizeRegulatoryContent(filtered);
        }

        // Apply compliance filtering
        filtered = await this.filterComplianceContent(filtered, options);

        // Anonymize sensitive information if enabled
        if (this.config.banking.anonymizeResults) {
            filtered = await this.anonymizeResults(filtered);
        }

        return filtered;
    }

    /**
     * Prioritize regulatory and compliance content
     */
    prioritizeRegulatoryContent(documents) {
        const regulatoryKeywords = [
            'regulation', 'compliance', 'basel', 'ccar', 'dodd-frank',
            'kyc', 'aml', 'gdpr', 'pci', 'sox', 'ffiec'
        ];

        return documents.map(doc => {
            const content = doc.content.toLowerCase();
            const regulatoryScore = regulatoryKeywords.reduce((score, keyword) => {
                return score + (content.includes(keyword) ? 0.1 : 0);
            }, 0);

            return {
                ...doc,
                regulatoryScore,
                adjustedScore: doc.score + regulatoryScore
            };
        }).sort((a, b) => b.adjustedScore - a.adjustedScore);
    }

    /**
     * Filter content based on compliance requirements
     */
    async filterComplianceContent(documents, options) {
        // Filter out potentially non-compliant content
        return documents.filter(doc => {
            const metadata = doc.metadata || {};

            // Check compliance tags
            if (metadata.complianceLevel === 'restricted' && !options.includeRestricted) {
                return false;
            }

            // Check classification level
            if (metadata.classification === 'confidential' && !options.includeConfidential) {
                return false;
            }

            return true;
        });
    }

    /**
     * Anonymize sensitive information in results
     */
    async anonymizeResults(documents) {
        return documents.map(doc => ({
            ...doc,
            content: this.anonymizeContent(doc.content),
            metadata: {
                ...doc.metadata,
                anonymized: true
            }
        }));
    }

    /**
     * Anonymize sensitive content
     */
    anonymizeContent(content) {
        // Basic anonymization patterns
        let anonymized = content;

        // Account numbers
        anonymized = anonymized.replace(/\b\d{8,20}\b/g, '[ACCOUNT_NUMBER]');

        // Credit card numbers
        anonymized = anonymized.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD_NUMBER]');

        // SSN patterns
        anonymized = anonymized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

        // Phone numbers
        anonymized = anonymized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

        // Email addresses
        anonymized = anonymized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

        return anonymized;
    }

    /**
     * Generate final context from filtered documents
     */
    async generateContext(documents, options) {
        if (documents.length === 0) return [];

        let totalLength = 0;
        const context = [];

        for (const doc of documents) {
            // Check if adding this document would exceed max context length
            if (totalLength + doc.content.length > options.maxContextLength) {
                // Try to fit a truncated version
                const remainingLength = options.maxContextLength - totalLength;
                if (remainingLength > 100) { // Only if we have reasonable space left
                    context.push({
                        ...doc,
                        content: doc.content.substring(0, remainingLength - 3) + '...',
                        truncated: true
                    });
                }
                break;
            }

            context.push(doc);
            totalLength += doc.content.length;
        }

        return context;
    }

    /**
     * Add documents to the vector database
     */
    async addDocuments(documents, options = {}) {
        try {
            const processedDocs = await this.processDocumentsForStorage(documents, options);

            const embeddings = await this.embeddingService.generateEmbeddingsBatch(
                processedDocs.map(doc => doc.content),
                { continueOnError: true }
            );

            const results = await this.vectorDatabase.addDocuments(processedDocs, embeddings);

            logger.info(`Added ${processedDocs.length} documents to vector database`);
            return results;

        } catch (error) {
            logger.error('Failed to add documents:', error);
            throw new RAGError('Failed to add documents to vector database', error);
        }
    }

    /**
     * Process documents for storage in vector database
     */
    async processDocumentsForStorage(documents, options) {
        const processed = [];

        for (const doc of documents) {
            if (typeof doc === 'string') {
                // Simple text document
                const chunks = this.chunkDocument(doc, options);
                chunks.forEach((chunk, index) => {
                    processed.push({
                        content: chunk,
                        metadata: {
                            chunkIndex: index,
                            totalChunks: chunks.length,
                            ...options.metadata
                        }
                    });
                });
            } else if (doc && typeof doc === 'object') {
                // Structured document
                const content = doc.content || doc.text || '';
                const chunks = this.chunkDocument(content, options);

                chunks.forEach((chunk, index) => {
                    processed.push({
                        content: chunk,
                        metadata: {
                            ...doc.metadata,
                            chunkIndex: index,
                            totalChunks: chunks.length,
                            originalId: doc.id,
                            title: doc.title,
                            domain: doc.domain || 'banking'
                        }
                    });
                });
            }
        }

        return processed;
    }

    /**
     * Chunk document into smaller pieces
     */
    chunkDocument(text, options = {}) {
        const chunkSize = options.chunkSize || this.config.documents.chunkSize;
        const chunkOverlap = options.chunkOverlap || this.config.documents.chunkOverlap;

        if (text.length <= chunkSize) {
            return [text];
        }

        const chunks = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            let chunk = text.substring(start, end);

            // Try to break at sentence boundaries
            if (end < text.length) {
                const lastPeriod = chunk.lastIndexOf('.');
                const lastNewline = chunk.lastIndexOf('\n');
                const breakPoint = Math.max(lastPeriod, lastNewline);

                if (breakPoint > start + chunkSize * 0.7) {
                    chunk = text.substring(start, breakPoint + 1);
                    start = breakPoint + 1 - chunkOverlap;
                } else {
                    start = end - chunkOverlap;
                }
            } else {
                start = end;
            }

            chunks.push(chunk.trim());
        }

        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * Get banking document types for filtering
     */
    getBankingDocumentTypes(domain) {
        const typeMap = {
            compliance: ['regulation', 'policy', 'procedure', 'guideline'],
            risk: ['risk_assessment', 'risk_model', 'stress_test'],
            fraud: ['fraud_pattern', 'investigation_report', 'alert_rule'],
            customer: ['customer_profile', 'kyc_document', 'onboarding'],
            transaction: ['transaction_log', 'payment_instruction', 'settlement'],
            regulatory: ['regulatory_report', 'submission', 'correspondence'],
            credit: ['credit_application', 'credit_report', 'underwriting'],
            market: ['market_analysis', 'pricing_model', 'research_report']
        };

        return typeMap[domain] || [];
    }

    /**
     * Get banking priorities for ranking
     */
    getBankingPriorities(domain) {
        const priorityMap = {
            compliance: ['regulatory', 'mandatory', 'critical'],
            risk: ['high_risk', 'material', 'systemic'],
            fraud: ['confirmed', 'suspicious', 'pattern'],
            customer: ['high_value', 'priority', 'escalated'],
            transaction: ['high_value', 'unusual', 'cross_border'],
            regulatory: ['deadline', 'mandatory', 'submission'],
            credit: ['default', 'delinquent', 'review'],
            market: ['material', 'significant', 'trending']
        };

        return priorityMap[domain] || [];
    }

    /**
     * Cache management
     */
    async checkCache(query, options) {
        if (!this.config.performance.cacheEnabled) return null;

        const cacheKey = this.getCacheKey(query, options);
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.config.performance.cacheTTL) {
            return cached.result;
        }

        return null;
    }

    async cacheResults(query, options, result) {
        if (!this.config.performance.cacheEnabled) return;

        const cacheKey = this.getCacheKey(query, options);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });

        // Clean old cache entries if cache is getting large
        if (this.cache.size > 1000) {
            this.cleanCache();
        }
    }

    getCacheKey(query, options) {
        const optionsKey = JSON.stringify({
            topK: options.topK,
            threshold: options.similarityThreshold,
            filters: options.filters
        });
        return `rag_${Buffer.from(query + optionsKey).toString('base64').substring(0, 32)}`;
    }

    cleanCache() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 20% of entries
        const removeCount = Math.floor(entries.length * 0.2);
        for (let i = 0; i < removeCount; i++) {
            this.cache.delete(entries[i][0]);
        }
    }

    /**
     * Update metrics
     */
    updateMetrics(startTime, contextLength) {
        const retrievalTime = Date.now() - startTime;

        this.metrics.retrievalCalls++;
        this.metrics.totalDocuments += contextLength;
        this.metrics.avgRetrievalTime = (
            (this.metrics.avgRetrievalTime * (this.metrics.retrievalCalls - 1)) + retrievalTime
        ) / this.metrics.retrievalCalls;
    }

    /**
     * Get pipeline metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
            avgDocumentsPerRetrieval: this.metrics.totalDocuments / this.metrics.retrievalCalls || 0,
            vectorDatabase: this.vectorDatabase.getMetrics(),
            embeddings: this.embeddingService.getMetrics()
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const testQuery = 'banking compliance test';
            const results = await this.retrieve(testQuery, { topK: 1 });

            return {
                status: 'healthy',
                componentsChecked: {
                    vectorDatabase: await this.vectorDatabase.healthCheck(),
                    embeddings: await this.embeddingService.healthCheck()
                },
                testResults: {
                    query: testQuery,
                    resultsCount: results.length
                },
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                metrics: this.getMetrics()
            };
        }
    }
}

module.exports = RAGPipeline;