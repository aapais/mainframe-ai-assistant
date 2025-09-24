/**
 * RAG Pipeline Integration Tests
 * Comprehensive test suite for Retrieval Augmented Generation
 */

const RAGPipeline = require('../../../src/services/llm-integration/RAGPipeline');
const EmbeddingService = require('../../../src/services/llm-integration/EmbeddingService');
const VectorDatabase = require('../../../src/services/llm-integration/embeddings/VectorDatabase');
const { RAGError, RetrievalError } = require('../../../src/services/llm-integration/utils/LLMErrors');

// Mock dependencies
jest.mock('../../../src/services/llm-integration/EmbeddingService');
jest.mock('../../../src/services/llm-integration/embeddings/VectorDatabase');

describe('RAG Pipeline Integration Tests', () => {
    let ragPipeline;
    let mockEmbeddingService;
    let mockVectorDatabase;
    let mockConfig;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        mockConfig = {
            retrieval: {
                topK: 5,
                similarityThreshold: 0.7,
                maxContextLength: 4000,
                rerank: true,
                diversityFactor: 0.2
            },
            documents: {
                chunkSize: 1000,
                chunkOverlap: 200,
                enableMetadata: true
            },
            banking: {
                enableComplianceFilter: true,
                anonymizeResults: true,
                prioritizeRegulatory: true
            },
            performance: {
                cacheEnabled: true,
                cacheTTL: 3600000,
                parallelRetrieval: true
            }
        };

        // Mock EmbeddingService
        mockEmbeddingService = {
            generateEmbeddings: jest.fn(),
            generateEmbeddingsBatch: jest.fn()
        };
        EmbeddingService.mockImplementation(() => mockEmbeddingService);

        // Mock VectorDatabase
        mockVectorDatabase = {
            initialize: jest.fn().mockResolvedValue(true),
            similaritySearch: jest.fn(),
            addDocuments: jest.fn(),
            getMetrics: jest.fn().mockReturnValue({}),
            healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
        };
        VectorDatabase.mockImplementation(() => mockVectorDatabase);

        ragPipeline = new RAGPipeline(mockConfig);
    });

    describe('Initialization', () => {
        test('should initialize with correct configuration', () => {
            expect(ragPipeline.config.retrieval.topK).toBe(5);
            expect(ragPipeline.config.banking.enableComplianceFilter).toBe(true);
            expect(ragPipeline.config.performance.cacheEnabled).toBe(true);
        });

        test('should initialize embedding service and vector database', () => {
            expect(EmbeddingService).toHaveBeenCalled();
            expect(VectorDatabase).toHaveBeenCalled();
        });

        test('should handle initialization errors', async () => {
            mockVectorDatabase.initialize.mockRejectedValue(new Error('DB initialization failed'));

            await expect(ragPipeline.initialize()).rejects.toThrow(RAGError);
        });
    });

    describe('Document Retrieval', () => {
        beforeEach(() => {
            // Mock successful embedding generation
            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);

            // Mock successful vector search
            mockVectorDatabase.similaritySearch.mockResolvedValue([
                {
                    content: 'Banking regulation regarding compliance requirements',
                    metadata: { type: 'regulation', category: 'compliance' },
                    score: 0.85,
                    id: 'doc1'
                },
                {
                    content: 'Fraud detection patterns in banking transactions',
                    metadata: { type: 'fraud_pattern', category: 'security' },
                    score: 0.80,
                    id: 'doc2'
                },
                {
                    content: 'Risk assessment methodology for credit evaluation',
                    metadata: { type: 'risk_model', category: 'credit' },
                    score: 0.75,
                    id: 'doc3'
                }
            ]);
        });

        test('should retrieve relevant documents for query', async () => {
            const query = 'banking compliance requirements';
            const results = await ragPipeline.retrieve(query);

            expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledWith(query);
            expect(mockVectorDatabase.similaritySearch).toHaveBeenCalled();
            expect(results).toHaveLength(3);
            expect(results[0].content).toContain('Banking regulation');
        });

        test('should apply similarity threshold filtering', async () => {
            // Add low-score result that should be filtered
            mockVectorDatabase.similaritySearch.mockResolvedValue([
                {
                    content: 'High relevance document',
                    metadata: {},
                    score: 0.85,
                    id: 'doc1'
                },
                {
                    content: 'Low relevance document',
                    metadata: {},
                    score: 0.5, // Below threshold of 0.7
                    id: 'doc2'
                }
            ]);

            const results = await ragPipeline.retrieve('test query');

            expect(results).toHaveLength(1);
            expect(results[0].score).toBe(0.85);
        });

        test('should limit results to topK', async () => {
            // Create 10 documents, but topK is 5
            const manyDocs = Array.from({ length: 10 }, (_, i) => ({
                content: `Document ${i}`,
                metadata: {},
                score: 0.8 - (i * 0.01), // Decreasing scores
                id: `doc${i}`
            }));

            mockVectorDatabase.similaritySearch.mockResolvedValue(manyDocs);

            const results = await ragPipeline.retrieve('test query');

            expect(results).toHaveLength(5);
        });

        test('should handle empty search results', async () => {
            mockVectorDatabase.similaritySearch.mockResolvedValue([]);

            const results = await ragPipeline.retrieve('test query');

            expect(results).toHaveLength(0);
        });
    });

    describe('Banking Domain Features', () => {
        test('should retrieve banking context with domain filtering', async () => {
            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockResolvedValue([
                {
                    content: 'Fraud detection in banking',
                    metadata: { domain: 'fraud', type: 'fraud_pattern' },
                    score: 0.9,
                    id: 'fraud1'
                }
            ]);

            const results = await ragPipeline.retrieveBankingContext('fraud detection', 'fraud');

            expect(mockVectorDatabase.similaritySearch).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({
                    filters: expect.objectContaining({
                        domain: 'fraud'
                    })
                })
            );
            expect(results).toHaveLength(1);
        });

        test('should prioritize regulatory content', async () => {
            const docs = [
                {
                    content: 'Regular banking procedure',
                    metadata: {},
                    score: 0.8,
                    id: 'doc1'
                },
                {
                    content: 'Basel III regulation requirements',
                    metadata: {},
                    score: 0.75,
                    id: 'doc2'
                }
            ];

            mockVectorDatabase.similaritySearch.mockResolvedValue(docs);

            const results = await ragPipeline.retrieve('banking requirements');

            // Regulatory content should be prioritized despite lower original score
            expect(results[0].content).toContain('regulation');
            expect(results[0].regulatoryScore).toBeGreaterThan(0);
        });

        test('should anonymize sensitive information', async () => {
            const docsWithSensitiveInfo = [
                {
                    content: 'Account number 1234567890123456 shows suspicious activity',
                    metadata: {},
                    score: 0.8,
                    id: 'doc1'
                }
            ];

            mockVectorDatabase.similaritySearch.mockResolvedValue(docsWithSensitiveInfo);

            const results = await ragPipeline.retrieve('suspicious activity');

            expect(results[0].content).toContain('[ACCOUNT_NUMBER]');
            expect(results[0].content).not.toContain('1234567890123456');
            expect(results[0].metadata.anonymized).toBe(true);
        });

        test('should filter compliance content based on clearance', async () => {
            const docs = [
                {
                    content: 'Public banking information',
                    metadata: { complianceLevel: 'public' },
                    score: 0.8,
                    id: 'doc1'
                },
                {
                    content: 'Restricted banking information',
                    metadata: { complianceLevel: 'restricted' },
                    score: 0.9,
                    id: 'doc2'
                }
            ];

            mockVectorDatabase.similaritySearch.mockResolvedValue(docs);

            const results = await ragPipeline.retrieve('banking information', {
                includeRestricted: false
            });

            expect(results).toHaveLength(1);
            expect(results[0].metadata.complianceLevel).toBe('public');
        });
    });

    describe('Document Processing', () => {
        test('should chunk large documents properly', () => {
            const largeText = 'a'.repeat(2500); // Larger than default chunk size
            const chunks = ragPipeline.chunkDocument(largeText);

            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks[0].length).toBeLessThanOrEqual(ragPipeline.config.documents.chunkSize);
        });

        test('should handle document overlap correctly', () => {
            const text = 'a'.repeat(1500);
            const chunks = ragPipeline.chunkDocument(text, {
                chunkSize: 1000,
                chunkOverlap: 200
            });

            expect(chunks.length).toBe(2);
            // Second chunk should start before the end of first chunk (overlap)
            expect(chunks[1].length).toBeGreaterThan(500);
        });

        test('should preserve sentence boundaries when chunking', () => {
            const text = 'First sentence. Second sentence. Third sentence. '.repeat(50);
            const chunks = ragPipeline.chunkDocument(text);

            // Most chunks should end with complete sentences
            const chunksEndingWithPeriod = chunks.filter(chunk => chunk.trim().endsWith('.'));
            expect(chunksEndingWithPeriod.length).toBeGreaterThan(chunks.length * 0.7);
        });
    });

    describe('Document Addition', () => {
        test('should add documents to vector database', async () => {
            const documents = [
                {
                    content: 'Banking regulation document',
                    metadata: { type: 'regulation', domain: 'banking' }
                },
                'Simple text document'
            ];

            mockEmbeddingService.generateEmbeddingsBatch.mockResolvedValue([
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6]
            ]);

            mockVectorDatabase.addDocuments.mockResolvedValue({ success: true, count: 2 });

            const result = await ragPipeline.addDocuments(documents);

            expect(mockEmbeddingService.generateEmbeddingsBatch).toHaveBeenCalled();
            expect(mockVectorDatabase.addDocuments).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        test('should process structured documents with metadata', async () => {
            const structuredDoc = {
                id: 'doc1',
                title: 'Banking Compliance Guide',
                content: 'Detailed compliance information',
                metadata: { domain: 'compliance', priority: 'high' }
            };

            mockEmbeddingService.generateEmbeddingsBatch.mockResolvedValue([[0.1, 0.2, 0.3]]);
            mockVectorDatabase.addDocuments.mockResolvedValue({ success: true });

            await ragPipeline.addDocuments([structuredDoc]);

            const addDocumentsCall = mockVectorDatabase.addDocuments.mock.calls[0];
            const processedDocs = addDocumentsCall[0];

            expect(processedDocs[0]).toHaveProperty('metadata');
            expect(processedDocs[0].metadata.originalId).toBe('doc1');
            expect(processedDocs[0].metadata.title).toBe('Banking Compliance Guide');
        });
    });

    describe('Semantic Reranking', () => {
        test('should rerank documents based on relevance', async () => {
            const query = 'banking fraud detection';
            const docs = [
                {
                    content: 'General banking information without fraud content',
                    score: 0.8,
                    id: 'doc1'
                },
                {
                    content: 'Fraud detection patterns in banking systems',
                    score: 0.7,
                    id: 'doc2'
                }
            ];

            const reranked = await ragPipeline.semanticRerank(query, docs);

            // Doc with fraud content should have higher combined score
            expect(reranked[0].content).toContain('Fraud detection');
            expect(reranked[0]).toHaveProperty('rerankScore');
            expect(reranked[0]).toHaveProperty('combinedScore');
        });

        test('should calculate relevance scores correctly', () => {
            const query = 'fraud detection banking';
            const content1 = 'Banking fraud detection systems are essential';
            const content2 = 'General banking operations and procedures';

            const score1 = ragPipeline.calculateRelevanceScore(query, content1);
            const score2 = ragPipeline.calculateRelevanceScore(query, content2);

            expect(score1).toBeGreaterThan(score2);
            expect(score1).toBeLessThanOrEqual(1.0);
            expect(score2).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Diversity Filtering', () => {
        test('should apply diversity filter to reduce redundancy', async () => {
            const similarDocs = [
                {
                    content: 'Banking fraud detection systems',
                    score: 0.9,
                    id: 'doc1'
                },
                {
                    content: 'Banking fraud detection methods', // Very similar
                    score: 0.85,
                    id: 'doc2'
                },
                {
                    content: 'Regulatory compliance requirements', // Different topic
                    score: 0.8,
                    id: 'doc3'
                }
            ];

            const diverse = await ragPipeline.applyDiversityFilter(similarDocs, {
                topK: 3,
                diversityFactor: 0.3
            });

            // Should include doc1 (highest score) and doc3 (different topic)
            // May exclude doc2 due to similarity with doc1
            expect(diverse).toContain(similarDocs[0]); // Always include top result
            expect(diverse).toContain(similarDocs[2]); // Different topic should be included
        });

        test('should calculate content similarity correctly', () => {
            const content1 = 'banking fraud detection systems';
            const content2 = 'banking fraud detection methods';
            const content3 = 'regulatory compliance requirements';

            const similarity12 = ragPipeline.calculateContentSimilarity(content1, content2);
            const similarity13 = ragPipeline.calculateContentSimilarity(content1, content3);

            expect(similarity12).toBeGreaterThan(similarity13);
            expect(similarity12).toBeGreaterThan(0.5); // High similarity
            expect(similarity13).toBeLessThan(0.3); // Low similarity
        });
    });

    describe('Caching', () => {
        test('should cache retrieval results', async () => {
            ragPipeline.config.performance.cacheEnabled = true;

            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockResolvedValue([
                { content: 'Test result', score: 0.8, id: 'doc1' }
            ]);

            const query = 'test query';

            // First call
            const result1 = await ragPipeline.retrieve(query);

            // Second call with same query should use cache
            const result2 = await ragPipeline.retrieve(query);

            expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledTimes(1);
            expect(mockVectorDatabase.similaritySearch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual(result2);
        });

        test('should respect cache TTL', async () => {
            ragPipeline.config.performance.cacheEnabled = true;
            ragPipeline.config.performance.cacheTTL = 100; // Very short TTL

            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockResolvedValue([
                { content: 'Test result', score: 0.8, id: 'doc1' }
            ]);

            const query = 'test query';

            // First call
            await ragPipeline.retrieve(query);

            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 150));

            // Second call should not use expired cache
            await ragPipeline.retrieve(query);

            expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledTimes(2);
            expect(mockVectorDatabase.similaritySearch).toHaveBeenCalledTimes(2);
        });
    });

    describe('Context Generation', () => {
        test('should respect max context length', async () => {
            const longDocs = Array.from({ length: 5 }, (_, i) => ({
                content: 'a'.repeat(1000), // Each doc is 1000 chars
                score: 0.8,
                id: `doc${i}`
            }));

            mockVectorDatabase.similaritySearch.mockResolvedValue(longDocs);

            const results = await ragPipeline.retrieve('test query', {
                maxContextLength: 3500 // Should fit ~3.5 documents
            });

            const totalLength = results.reduce((sum, doc) => sum + doc.content.length, 0);
            expect(totalLength).toBeLessThanOrEqual(3500);
        });

        test('should truncate documents when necessary', async () => {
            const largeDocs = [
                {
                    content: 'a'.repeat(3000),
                    score: 0.9,
                    id: 'doc1'
                },
                {
                    content: 'b'.repeat(2000),
                    score: 0.8,
                    id: 'doc2'
                }
            ];

            mockVectorDatabase.similaritySearch.mockResolvedValue(largeDocs);

            const results = await ragPipeline.retrieve('test query', {
                maxContextLength: 4000
            });

            // First doc should fit completely, second should be truncated
            expect(results[0].content.length).toBe(3000);
            expect(results[1].content.length).toBeLessThan(2000);
            expect(results[1]).toHaveProperty('truncated', true);
        });
    });

    describe('Error Handling', () => {
        test('should handle embedding generation failures', async () => {
            mockEmbeddingService.generateEmbeddings.mockRejectedValue(new Error('Embedding failed'));

            await expect(ragPipeline.retrieve('test query'))
                .rejects.toThrow(RetrievalError);
        });

        test('should handle vector database failures', async () => {
            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockRejectedValue(new Error('DB search failed'));

            await expect(ragPipeline.retrieve('test query'))
                .rejects.toThrow(RetrievalError);
        });

        test('should handle reranking failures gracefully', async () => {
            const docs = [{ content: 'test', score: 0.8, id: 'doc1' }];

            // Mock a reranking failure (implementation would need to simulate this)
            const originalRerank = ragPipeline.semanticRerank;
            ragPipeline.semanticRerank = jest.fn().mockRejectedValue(new Error('Rerank failed'));

            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockResolvedValue(docs);

            // Should fallback to original ranking
            const results = await ragPipeline.retrieve('test query');

            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('test');

            // Restore original method
            ragPipeline.semanticRerank = originalRerank;
        });
    });

    describe('Metrics and Health Check', () => {
        test('should track retrieval metrics', async () => {
            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockResolvedValue([
                { content: 'Test result', score: 0.8, id: 'doc1' }
            ]);

            await ragPipeline.retrieve('test query');

            const metrics = ragPipeline.getMetrics();

            expect(metrics.retrievalCalls).toBe(1);
            expect(metrics.totalDocuments).toBe(1);
            expect(metrics.avgRetrievalTime).toBeGreaterThan(0);
        });

        test('should perform health check', async () => {
            mockEmbeddingService.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
            mockVectorDatabase.similaritySearch.mockResolvedValue([]);

            const health = await ragPipeline.healthCheck();

            expect(health.status).toBe('healthy');
            expect(health.componentsChecked).toHaveProperty('vectorDatabase');
            expect(health.componentsChecked).toHaveProperty('embeddings');
        });

        test('should report unhealthy status on errors', async () => {
            mockEmbeddingService.generateEmbeddings.mockRejectedValue(new Error('Health check failed'));

            const health = await ragPipeline.healthCheck();

            expect(health.status).toBe('unhealthy');
            expect(health.error).toContain('Health check failed');
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});