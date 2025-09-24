/**
 * Testes unitários para RAGService
 */

const RAGService = require('../../../src/services/llm-integration/RAGService');
const { ChromaClient } = require('chromadb');
const { OpenAI } = require('openai');
const { RAGError, EmbeddingError } = require('../../../src/services/llm-integration/utils/LLMErrors');

// Mocks
jest.mock('chromadb');
jest.mock('openai');

describe('RAGService', () => {
    let ragService;
    let mockConfig;
    let mockChromaClient;
    let mockOpenAIClient;
    let mockCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = {
            vectorDB: {
                host: 'localhost',
                port: 8000,
                collectionName: 'test_collection'
            },
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small'
            },
            cache: {
                enabled: true,
                ttl: 3600
            }
        };

        // Mock collection
        mockCollection = {
            query: jest.fn(),
            add: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            get: jest.fn(),
            count: jest.fn(),
            peek: jest.fn()
        };

        // Mock ChromaDB client
        mockChromaClient = {
            getOrCreateCollection: jest.fn().mockResolvedValue(mockCollection),
            listCollections: jest.fn(),
            deleteCollection: jest.fn(),
            heartbeat: jest.fn()
        };

        ChromaClient.mockImplementation(() => mockChromaClient);

        // Mock OpenAI client
        mockOpenAIClient = {
            embeddings: {
                create: jest.fn()
            }
        };

        OpenAI.mockImplementation(() => mockOpenAIClient);

        ragService = new RAGService(mockConfig);
    });

    describe('Inicialização', () => {
        test('deve inicializar com configuração padrão', () => {
            const service = new RAGService();
            expect(service.config.vectorDB.host).toBe('localhost');
            expect(service.config.embeddings.provider).toBe('openai');
        });

        test('deve inicializar ChromaDB client', async () => {
            await ragService.initializeVectorDB();

            expect(ChromaClient).toHaveBeenCalledWith({
                path: 'http://localhost:8000'
            });
            expect(mockChromaClient.getOrCreateCollection).toHaveBeenCalled();
        });

        test('deve falhar se ChromaDB não estiver disponível', async () => {
            mockChromaClient.getOrCreateCollection.mockRejectedValue(
                new Error('Connection failed')
            );

            await expect(ragService.initializeVectorDB())
                .rejects.toThrow(RAGError);
        });
    });

    describe('generateEmbedding', () => {
        beforeEach(() => {
            mockOpenAIClient.embeddings.create.mockResolvedValue({
                data: [{ embedding: [0.1, 0.2, 0.3] }]
            });
        });

        test('deve gerar embedding para texto válido', async () => {
            const text = 'Test banking incident description';

            const embedding = await ragService.generateEmbedding(text);

            expect(embedding).toEqual([0.1, 0.2, 0.3]);
            expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-3-small',
                input: text,
                encoding_format: 'float'
            });
        });

        test('deve truncar texto muito longo', async () => {
            const longText = 'a'.repeat(10000);

            await ragService.generateEmbedding(longText);

            const call = mockOpenAIClient.embeddings.create.mock.calls[0][0];
            expect(call.input.length).toBeLessThanOrEqual(8003); // 8000 + '...'
        });

        test('deve falhar para texto vazio', async () => {
            await expect(ragService.generateEmbedding(''))
                .rejects.toThrow(EmbeddingError);
        });

        test('deve falhar para texto inválido', async () => {
            await expect(ragService.generateEmbedding(null))
                .rejects.toThrow(EmbeddingError);
        });

        test('deve lidar com erro da API OpenAI', async () => {
            mockOpenAIClient.embeddings.create.mockRejectedValue(
                new Error('API Error')
            );

            await expect(ragService.generateEmbedding('test'))
                .rejects.toThrow(EmbeddingError);
        });
    });

    describe('query', () => {
        beforeEach(() => {
            ragService.generateEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);

            mockCollection.query.mockResolvedValue({
                documents: [['Document 1', 'Document 2']],
                metadatas: [[{ id: '1', category: 'test' }, { id: '2', category: 'test' }]],
                distances: [[0.1, 0.2]]
            });

            ragService.rerankResults = jest.fn().mockImplementation(results => results);
            ragService.optimizeContextWindow = jest.fn().mockImplementation(results => results);
            ragService.enrichResults = jest.fn().mockImplementation(results =>
                results.map(r => ({ ...r, enriched: true }))
            );
        });

        test('deve executar query básica com sucesso', async () => {
            const query = 'database connection timeout';

            const results = await ragService.query(query);

            expect(ragService.generateEmbedding).toHaveBeenCalledWith(query);
            expect(mockCollection.query).toHaveBeenCalled();
            expect(results).toHaveLength(2);
            expect(results[0].enriched).toBe(true);
        });

        test('deve aplicar filtros na query', async () => {
            const query = 'database error';
            const options = {
                threshold: 0.8,
                limit: 5,
                filters: { category: 'database' }
            };

            await ragService.query(query, options);

            const queryCall = mockCollection.query.mock.calls[0][0];
            expect(queryCall.nResults).toBe(10); // limit * 2 for reranking
        });

        test('deve usar cache quando disponível', async () => {
            const query = 'test query';

            // Primeira chamada
            await ragService.query(query);

            // Segunda chamada (deve usar cache)
            ragService.generateEmbedding.mockClear();
            await ragService.query(query);

            expect(ragService.generateEmbedding).not.toHaveBeenCalled();
        });

        test('deve lidar com query complexa (objeto)', async () => {
            const query = {
                text: 'database error',
                filters: { type: 'incident' },
                threshold: 0.9
            };

            const results = await ragService.query(query);

            expect(results).toBeDefined();
        });

        test('deve falhar com query inválida', async () => {
            await expect(ragService.query(null))
                .rejects.toThrow(RAGError);
        });
    });

    describe('vectorSearch', () => {
        test('deve executar busca vetorial no ChromaDB', async () => {
            const queryEmbedding = [0.1, 0.2, 0.3];
            const config = { limit: 10, filters: { category: 'test' } };

            mockCollection.query.mockResolvedValue({
                documents: [['Test document']],
                metadatas: [[{ id: 'test-1' }]],
                distances: [[0.15]]
            });

            const results = await ragService.vectorSearch(queryEmbedding, config);

            expect(mockCollection.query).toHaveBeenCalledWith({
                queryEmbeddings: [queryEmbedding],
                nResults: 20, // limit * 2
                include: ['documents', 'metadatas', 'distances'],
                where: { category: 'test' }
            });

            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('Test document');
        });
    });

    describe('rerankResults', () => {
        test('deve re-rankear resultados por múltiplos critérios', async () => {
            const results = [
                {
                    content: 'Recent high-authority document',
                    metadata: {
                        timestamp: new Date().toISOString(),
                        source_type: 'official_documentation'
                    },
                    score: 0.7
                },
                {
                    content: 'Old low-authority document',
                    metadata: {
                        timestamp: '2020-01-01T00:00:00Z',
                        source_type: 'forum_post'
                    },
                    score: 0.8
                }
            ];

            ragService.calculateContentRelevance = jest.fn().mockReturnValue(0.5);

            const reranked = await ragService.rerankResults(results, 'test query', {});

            expect(reranked).toHaveLength(2);
            expect(reranked[0].finalScore).toBeGreaterThan(reranked[1].finalScore);
        });

        test('deve retornar resultados originais se re-ranking falhar', async () => {
            const results = [{ content: 'test', score: 0.8 }];

            ragService.calculateContentRelevance = jest.fn().mockImplementation(() => {
                throw new Error('Reranking failed');
            });

            const reranked = await ragService.rerankResults(results, 'test', {});

            expect(reranked).toEqual(results);
        });
    });

    describe('optimizeContextWindow', () => {
        test('deve otimizar resultados para caber no context window', () => {
            const results = [
                { content: 'a'.repeat(1000), score: 0.9 },
                { content: 'b'.repeat(1000), score: 0.8 },
                { content: 'c'.repeat(1000), score: 0.7 },
                { content: 'd'.repeat(3000), score: 0.6 } // Muito longo
            ];

            const config = { maxContextLength: 2500 };

            const optimized = ragService.optimizeContextWindow(results, config);

            expect(optimized).toHaveLength(2); // Apenas os 2 primeiros cabem
        });

        test('deve truncar documento parcialmente se necessário', () => {
            const results = [
                { content: 'a'.repeat(1800), score: 0.9 },
                { content: 'b'.repeat(1000), score: 0.8 }
            ];

            const config = { maxContextLength: 2000 };

            const optimized = ragService.optimizeContextWindow(results, config);

            expect(optimized).toHaveLength(2);
            expect(optimized[1].truncated).toBe(true);
        });
    });

    describe('Gerenciamento de Documentos', () => {
        beforeEach(() => {
            ragService.generateEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
        });

        test('deve adicionar documento à knowledge base', async () => {
            const document = {
                id: 'doc-1',
                content: 'Test banking procedure',
                metadata: { category: 'procedure' }
            };

            await ragService.addDocument(document);

            expect(ragService.generateEmbedding).toHaveBeenCalledWith(document.content);
            expect(mockCollection.add).toHaveBeenCalledWith({
                ids: [document.id],
                embeddings: [[0.1, 0.2, 0.3]],
                documents: [document.content],
                metadatas: [document.metadata]
            });
        });

        test('deve atualizar documento existente', async () => {
            const documentId = 'doc-1';
            const newContent = 'Updated banking procedure';
            const newMetadata = { category: 'updated_procedure' };

            await ragService.updateDocument(documentId, newContent, newMetadata);

            expect(mockCollection.update).toHaveBeenCalledWith({
                ids: [documentId],
                embeddings: [[0.1, 0.2, 0.3]],
                documents: [newContent],
                metadatas: [newMetadata]
            });
        });

        test('deve remover documento da knowledge base', async () => {
            const documentId = 'doc-1';

            await ragService.removeDocument(documentId);

            expect(mockCollection.delete).toHaveBeenCalledWith({
                ids: [documentId]
            });
        });
    });

    describe('Cache Management', () => {
        test('deve gerar chave de cache consistente', () => {
            const query = 'test query';
            const config = { limit: 10, threshold: 0.8 };

            const key1 = ragService.generateCacheKey(query, config);
            const key2 = ragService.generateCacheKey(query, config);

            expect(key1).toBe(key2);
        });

        test('deve armazenar e recuperar do cache', () => {
            const key = 'test-key';
            const data = { results: ['test'] };

            ragService.setCache(key, data);
            const cached = ragService.getFromCache(key);

            expect(cached).toEqual(data);
        });

        test('deve expirar cache após TTL', async () => {
            const key = 'test-key';
            const data = { results: ['test'] };

            ragService.config.cache.ttl = 0.001; // 1ms
            ragService.setCache(key, data);

            await new Promise(resolve => setTimeout(resolve, 10));

            const cached = ragService.getFromCache(key);
            expect(cached).toBeNull();
        });

        test('deve limpar cache quando limite é atingido', () => {
            ragService.config.cache.maxSize = 2;

            ragService.setCache('key1', 'data1');
            ragService.setCache('key2', 'data2');
            ragService.setCache('key3', 'data3'); // Deve remover key1

            expect(ragService.getFromCache('key1')).toBeNull();
            expect(ragService.getFromCache('key2')).not.toBeNull();
            expect(ragService.getFromCache('key3')).not.toBeNull();
        });
    });

    describe('Health Check', () => {
        test('deve retornar status saudável quando tudo funciona', async () => {
            ragService.isConnected = true;
            mockCollection.count.mockResolvedValue(100);
            ragService.generateEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);

            const health = await ragService.healthCheck();

            expect(health.status).toBe('healthy');
            expect(health.services.vectorDB).toBe('connected');
            expect(health.services.embeddingProvider).toBe('connected');
        });

        test('deve retornar status não saudável quando há problemas', async () => {
            ragService.isConnected = false;

            const health = await ragService.healthCheck();

            expect(health.status).toBe('unhealthy');
        });

        test('deve detectar falha na geração de embedding', async () => {
            ragService.generateEmbedding = jest.fn().mockRejectedValue(
                new Error('Embedding failed')
            );

            const health = await ragService.healthCheck();

            expect(health.status).toBe('unhealthy');
            expect(health.error).toContain('Embedding failed');
        });
    });

    describe('Análise de Similaridade', () => {
        test('deve calcular relevância de conteúdo corretamente', () => {
            const content = 'database connection timeout error occurred';
            const query = 'database timeout connection';

            const relevance = ragService.calculateContentRelevance(content, query);

            expect(relevance).toBeGreaterThan(0.5); // Deve encontrar overlap significativo
        });

        test('deve calcular score de recência corretamente', () => {
            const recentTimestamp = new Date().toISOString();
            const oldTimestamp = '2020-01-01T00:00:00Z';

            const recentScore = ragService.calculateRecencyScore(recentTimestamp);
            const oldScore = ragService.calculateRecencyScore(oldTimestamp);

            expect(recentScore).toBeGreaterThan(oldScore);
        });

        test('deve calcular score de autoridade baseado na fonte', () => {
            const officialDoc = { source_type: 'official_documentation' };
            const forumPost = { source_type: 'forum_post' };

            const officialScore = ragService.calculateAuthorityScore(officialDoc);
            const forumScore = ragService.calculateAuthorityScore(forumPost);

            expect(officialScore).toBeGreaterThan(forumScore);
        });
    });

    describe('Tratamento de Erros', () => {
        test('deve lidar com falha na conexão ChromaDB', async () => {
            mockChromaClient.getOrCreateCollection.mockRejectedValue(
                new Error('ChromaDB connection failed')
            );

            await expect(ragService.initializeVectorDB())
                .rejects.toThrow(RAGError);
        });

        test('deve lidar com embedding inválido', async () => {
            mockOpenAIClient.embeddings.create.mockResolvedValue({
                data: [{ embedding: null }]
            });

            await expect(ragService.generateEmbedding('test'))
                .rejects.toThrow(EmbeddingError);
        });

        test('deve lidar com query malformada no ChromaDB', async () => {
            mockCollection.query.mockRejectedValue(
                new Error('Invalid query format')
            );

            ragService.generateEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);

            await expect(ragService.query('test'))
                .rejects.toThrow(RAGError);
        });
    });
});