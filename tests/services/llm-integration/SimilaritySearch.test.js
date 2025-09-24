/**
 * Testes unitários para SimilaritySearch
 */

const SimilaritySearch = require('../../../src/services/llm-integration/SimilaritySearch');
const { OpenAI } = require('openai');
const { SimilaritySearchError } = require('../../../src/services/llm-integration/utils/LLMErrors');

// Mocks
jest.mock('openai');

describe('SimilaritySearch', () => {
    let similaritySearch;
    let mockConfig;
    let mockOpenAIClient;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = {
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small'
            },
            search: {
                defaultThreshold: 0.75,
                algorithms: ['cosine', 'euclidean'],
                weightingStrategy: 'adaptive'
            },
            cache: {
                enabled: true,
                ttl: 1800
            }
        };

        // Mock OpenAI client
        mockOpenAIClient = {
            embeddings: {
                create: jest.fn().mockResolvedValue({
                    data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }]
                })
            }
        };

        OpenAI.mockImplementation(() => mockOpenAIClient);

        similaritySearch = new SimilaritySearch(mockConfig);
    });

    describe('Inicialização', () => {
        test('deve inicializar com configuração padrão', () => {
            const service = new SimilaritySearch();
            expect(service.config.embeddings.provider).toBe('openai');
            expect(service.config.search.defaultThreshold).toBe(0.75);
        });

        test('deve inicializar índices de busca', () => {
            expect(similaritySearch.searchIndex.incidents).toBeInstanceOf(Map);
            expect(similaritySearch.searchIndex.patterns).toBeInstanceOf(Map);
            expect(similaritySearch.searchIndex.embeddings).toBeInstanceOf(Map);
        });

        test('deve inicializar cache se habilitado', () => {
            expect(similaritySearch.cache).toBeInstanceOf(Map);
            expect(similaritySearch.cacheStats).toBeDefined();
        });
    });

    describe('generateQueryEmbedding', () => {
        test('deve gerar embedding para texto válido', async () => {
            const text = 'Database connection timeout error';

            const embedding = await similaritySearch.generateQueryEmbedding(text);

            expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
            expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-3-small',
                input: text,
                encoding_format: 'float'
            });
        });

        test('deve usar cache para embeddings repetidos', async () => {
            const text = 'Same text for caching';

            // Primeira chamada
            await similaritySearch.generateQueryEmbedding(text);

            // Segunda chamada (deve usar cache)
            mockOpenAIClient.embeddings.create.mockClear();
            const embedding = await similaritySearch.generateQueryEmbedding(text);

            expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
            expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
            expect(similaritySearch.cacheStats.embeddingHits).toBe(1);
        });

        test('deve truncar texto muito longo', async () => {
            const longText = 'a'.repeat(10000);

            await similaritySearch.generateQueryEmbedding(longText);

            const call = mockOpenAIClient.embeddings.create.mock.calls[0][0];
            expect(call.input.length).toBeLessThanOrEqual(8000);
        });

        test('deve falhar para provider não suportado', async () => {
            similaritySearch.config.embeddings.provider = 'unsupported';

            await expect(similaritySearch.generateQueryEmbedding('test'))
                .rejects.toThrow(SimilaritySearchError);
        });
    });

    describe('Algoritmos de Similaridade', () => {
        const vector1 = [1, 0, 0];
        const vector2 = [0, 1, 0];
        const vector3 = [1, 0, 0]; // Idêntico ao vector1

        test('cosineSimilarity deve calcular corretamente', () => {
            const sim1 = similaritySearch.cosineSimilarity(vector1, vector3);
            const sim2 = similaritySearch.cosineSimilarity(vector1, vector2);

            expect(sim1).toBeCloseTo(1.0); // Vetores idênticos
            expect(sim2).toBeCloseTo(0.0); // Vetores perpendiculares
        });

        test('euclideanSimilarity deve calcular corretamente', () => {
            const sim1 = similaritySearch.euclideanSimilarity(vector1, vector3);
            const sim2 = similaritySearch.euclideanSimilarity(vector1, vector2);

            expect(sim1).toBeCloseTo(1.0); // Distância zero = similaridade máxima
            expect(sim2).toBeLessThan(sim1); // Maior distância = menor similaridade
        });

        test('manhattanSimilarity deve calcular corretamente', () => {
            const sim = similaritySearch.manhattanSimilarity(vector1, vector2);
            expect(sim).toBeGreaterThan(0);
            expect(sim).toBeLessThan(1);
        });

        test('dotProductSimilarity deve calcular corretamente', () => {
            const sim1 = similaritySearch.dotProductSimilarity(vector1, vector3);
            const sim2 = similaritySearch.dotProductSimilarity(vector1, vector2);

            expect(sim1).toBeGreaterThan(sim2);
        });

        test('deve falhar com vetores de tamanhos diferentes', () => {
            expect(() => similaritySearch.cosineSimilarity([1, 2], [1, 2, 3]))
                .toThrow('Vetores devem ter o mesmo tamanho');
        });
    });

    describe('calculateCompositeScore', () => {
        const similarities = {
            cosine: 0.8,
            euclidean: 0.7,
            manhattan: 0.6
        };

        test('estratégia uniform deve calcular média', () => {
            const score = similaritySearch.calculateCompositeScore(similarities, 'uniform');
            expect(score).toBeCloseTo(0.7); // (0.8 + 0.7 + 0.6) / 3
        });

        test('estratégia cosine_heavy deve priorizar coseno', () => {
            const score = similaritySearch.calculateCompositeScore(similarities, 'cosine_heavy');
            expect(score).toBeGreaterThan(0.7); // Deve ser maior que a média uniforme
        });

        test('estratégia best deve usar maior score', () => {
            const score = similaritySearch.calculateCompositeScore(similarities, 'best');
            expect(score).toBe(0.8);
        });

        test('estratégia adaptive deve funcionar', () => {
            similaritySearch.calculateAdaptiveScore = jest.fn().mockReturnValue(0.75);

            const score = similaritySearch.calculateCompositeScore(similarities, 'adaptive');
            expect(score).toBe(0.75);
            expect(similaritySearch.calculateAdaptiveScore).toHaveBeenCalledWith(similarities);
        });
    });

    describe('calculateAdaptiveScore', () => {
        test('deve usar média quando variância é baixa', () => {
            const similarities = { cosine: 0.8, euclidean: 0.81, manhattan: 0.79 };

            const score = similaritySearch.calculateAdaptiveScore(similarities);
            expect(score).toBeCloseTo(0.8); // Variância baixa = média
        });

        test('deve usar máximo quando variância é alta', () => {
            const similarities = { cosine: 0.9, euclidean: 0.3, manhattan: 0.2 };

            const score = similaritySearch.calculateAdaptiveScore(similarities);
            expect(score).toBe(0.9); // Variância alta = máximo
        });
    });

    describe('search', () => {
        beforeEach(() => {
            // Mock dos métodos internos
            similaritySearch.generateQueryEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
            similaritySearch.getIncidentsFromDatabase = jest.fn().mockResolvedValue([
                {
                    id: 'incident-1',
                    title: 'Database timeout',
                    description: 'Connection timeout error',
                    type: 'database',
                    priority: 'High',
                    resolved: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'incident-2',
                    title: 'API error',
                    description: 'Service unavailable',
                    type: 'application',
                    priority: 'Medium',
                    resolved: true,
                    createdAt: new Date(Date.now() - 86400000).toISOString() // 1 dia atrás
                }
            ]);
            similaritySearch.getIncidentEmbedding = jest.fn().mockResolvedValue([0.2, 0.3, 0.4]);
        });

        test('deve executar busca completa com sucesso', async () => {
            const searchQuery = {
                text: 'database connection error',
                threshold: 0.7,
                limit: 5
            };

            const results = await similaritySearch.search(searchQuery);

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(similaritySearch.generateQueryEmbedding).toHaveBeenCalledWith(searchQuery.text);
        });

        test('deve aplicar filtros corretamente', async () => {
            const searchQuery = {
                text: 'error',
                filters: {
                    type: 'database',
                    priority: 'High',
                    resolved: true
                },
                threshold: 0.5
            };

            const results = await similaritySearch.search(searchQuery);

            // Deve filtrar apenas incidentes do tipo database
            const dbIncidents = results.filter(r => r.type === 'database');
            expect(dbIncidents.length).toBeGreaterThan(0);
        });

        test('deve usar cache quando disponível', async () => {
            const searchQuery = { text: 'test query', threshold: 0.7 };

            // Primeira busca
            await similaritySearch.search(searchQuery);

            // Segunda busca (deve usar cache)
            similaritySearch.generateQueryEmbedding.mockClear();
            const results = await similaritySearch.search(searchQuery);

            expect(similaritySearch.generateQueryEmbedding).not.toHaveBeenCalled();
            expect(similaritySearch.cacheStats.hits).toBe(1);
        });

        test('deve aplicar threshold corretamente', async () => {
            const searchQuery = {
                text: 'test',
                threshold: 0.9 // Threshold alto
            };

            const results = await similaritySearch.search(searchQuery);

            // Todos os resultados devem ter score >= threshold
            results.forEach(result => {
                expect(result.score || result.finalScore).toBeGreaterThanOrEqual(0.9);
            });
        });

        test('deve rankear resultados por múltiplos critérios', async () => {
            const searchQuery = {
                text: 'database error',
                limit: 10
            };

            const results = await similaritySearch.search(searchQuery);

            // Resultados devem estar ordenados por score final (desc)
            for (let i = 1; i < results.length; i++) {
                const currentScore = results[i].finalScore || results[i].score;
                const previousScore = results[i-1].finalScore || results[i-1].score;
                expect(currentScore).toBeLessThanOrEqual(previousScore);
            }
        });
    });

    describe('applyFilters', () => {
        const mockResults = [
            {
                id: '1',
                type: 'database',
                category: 'infrastructure',
                priority: 'High',
                resolved: true,
                createdAt: new Date().toISOString(),
                affectedSystems: ['database', 'api']
            },
            {
                id: '2',
                type: 'application',
                category: 'software',
                priority: 'Medium',
                resolved: false,
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                affectedSystems: ['web', 'mobile']
            }
        ];

        test('deve filtrar por tipo', () => {
            const filtered = similaritySearch.applyFilters(mockResults, { type: 'database' });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].type).toBe('database');
        });

        test('deve filtrar por prioridade (array)', () => {
            const filtered = similaritySearch.applyFilters(mockResults, {
                priority: ['High', 'Critical']
            });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].priority).toBe('High');
        });

        test('deve filtrar por status resolvido', () => {
            const filtered = similaritySearch.applyFilters(mockResults, { resolved: true });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].resolved).toBe(true);
        });

        test('deve filtrar por range de tempo', () => {
            similaritySearch.isWithinTimeRange = jest.fn().mockReturnValue(true);

            const filtered = similaritySearch.applyFilters(mockResults, { timeRange: '24h' });
            expect(filtered).toHaveLength(2);
            expect(similaritySearch.isWithinTimeRange).toHaveBeenCalledTimes(2);
        });

        test('deve filtrar por sistemas afetados', () => {
            similaritySearch.hasSystemOverlap = jest.fn()
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false);

            const filtered = similaritySearch.applyFilters(mockResults, {
                systems: ['database']
            });
            expect(filtered).toHaveLength(1);
        });

        test('deve retornar todos se sem filtros', () => {
            const filtered = similaritySearch.applyFilters(mockResults, {});
            expect(filtered).toEqual(mockResults);
        });
    });

    describe('isWithinTimeRange', () => {
        test('deve validar range de 24h', () => {
            const now = new Date();
            const recent = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h atrás
            const old = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h atrás

            expect(similaritySearch.isWithinTimeRange(recent.toISOString(), '24h')).toBe(true);
            expect(similaritySearch.isWithinTimeRange(old.toISOString(), '24h')).toBe(false);
        });

        test('deve validar range de 7d', () => {
            const now = new Date();
            const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 dias
            const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 dias

            expect(similaritySearch.isWithinTimeRange(recent.toISOString(), '7d')).toBe(true);
            expect(similaritySearch.isWithinTimeRange(old.toISOString(), '7d')).toBe(false);
        });
    });

    describe('hasSystemOverlap', () => {
        test('deve detectar overlap entre sistemas', () => {
            const incidentSystems = ['database', 'api', 'web'];
            const filterSystems = ['database', 'mobile'];

            const hasOverlap = similaritySearch.hasSystemOverlap(incidentSystems, filterSystems);
            expect(hasOverlap).toBe(true);
        });

        test('deve detectar falta de overlap', () => {
            const incidentSystems = ['web', 'mobile'];
            const filterSystems = ['database', 'mainframe'];

            const hasOverlap = similaritySearch.hasSystemOverlap(incidentSystems, filterSystems);
            expect(hasOverlap).toBe(false);
        });

        test('deve retornar true para valores nulos', () => {
            expect(similaritySearch.hasSystemOverlap(null, ['database'])).toBe(true);
            expect(similaritySearch.hasSystemOverlap(['database'], null)).toBe(true);
        });
    });

    describe('Ranking Factors', () => {
        test('calculateRecencyFactor deve priorizar documentos recentes', () => {
            const now = new Date().toISOString();
            const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 dias

            const recentFactor = similaritySearch.calculateRecencyFactor(now);
            const oldFactor = similaritySearch.calculateRecencyFactor(old);

            expect(recentFactor).toBeGreaterThan(oldFactor);
            expect(recentFactor).toBeCloseTo(1, 1);
            expect(oldFactor).toBeCloseTo(Math.E ** -1, 1); // e^-1
        });

        test('calculateResolutionFactor deve priorizar incidentes resolvidos', () => {
            const resolved = { resolved: true, resolutionTime: 2 * 60 * 60 * 1000 }; // 2h
            const unresolved = { resolved: false };

            const resolvedFactor = similaritySearch.calculateResolutionFactor(resolved);
            const unresolvedFactor = similaritySearch.calculateResolutionFactor(unresolved);

            expect(resolvedFactor).toBeGreaterThan(unresolvedFactor);
            expect(unresolvedFactor).toBe(0.3);
        });

        test('calculateComplexityFactor deve penalizar alta complexidade', () => {
            const simple = { affectedSystems: ['database'] };
            const complex = { affectedSystems: ['database', 'api', 'web', 'mobile', 'mainframe'] };

            const simpleFactor = similaritySearch.calculateComplexityFactor(simple);
            const complexFactor = similaritySearch.calculateComplexityFactor(complex);

            expect(simpleFactor).toBeGreaterThan(complexFactor);
        });

        test('calculateAuthorityFactor deve priorizar resolvedores experientes', () => {
            const expert = { resolverLevel: 'expert' };
            const junior = { resolverLevel: 'junior' };

            const expertFactor = similaritySearch.calculateAuthorityFactor(expert);
            const juniorFactor = similaritySearch.calculateAuthorityFactor(junior);

            expect(expertFactor).toBeGreaterThan(juniorFactor);
            expect(expertFactor).toBe(1.0);
            expect(juniorFactor).toBe(0.4);
        });
    });

    describe('findPatterns', () => {
        beforeEach(() => {
            const mockIncidents = [
                {
                    type: 'database',
                    category: 'timeout',
                    createdAt: new Date('2024-01-15T10:30:00Z').toISOString()
                },
                {
                    type: 'database',
                    category: 'timeout',
                    createdAt: new Date('2024-01-15T10:45:00Z').toISOString()
                },
                {
                    type: 'api',
                    category: 'error',
                    createdAt: new Date('2024-01-15T14:20:00Z').toISOString()
                }
            ];

            similaritySearch.getIncidentsForPatternAnalysis = jest.fn().mockResolvedValue(mockIncidents);
        });

        test('deve analisar padrões de frequência', async () => {
            const patterns = await similaritySearch.findPatterns({
                timeRange: '30d',
                systems: ['database']
            });

            expect(patterns.frequency).toBeDefined();
            expect(patterns.frequency.topPatterns).toHaveLength(2);
            expect(patterns.frequency.topPatterns[0].pattern).toBe('database_timeout');
            expect(patterns.frequency.topPatterns[0].count).toBe(2);
        });

        test('deve analisar padrões temporais', async () => {
            const patterns = await similaritySearch.findPatterns({ timeRange: '30d' });

            expect(patterns.temporal).toBeDefined();
            expect(patterns.temporal.peakHours).toBeDefined();
            expect(patterns.temporal.patterns.hourly).toHaveLength(24);
        });

        test('deve falhar graciosamente em caso de erro', async () => {
            similaritySearch.getIncidentsForPatternAnalysis = jest.fn().mockRejectedValue(
                new Error('Database error')
            );

            await expect(similaritySearch.findPatterns({}))
                .rejects.toThrow(SimilaritySearchError);
        });
    });

    describe('Health Check', () => {
        test('deve retornar status saudável', async () => {
            similaritySearch.generateQueryEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);

            const health = await similaritySearch.healthCheck();

            expect(health.status).toBe('healthy');
            expect(health.services.embeddingProvider).toBe('connected');
            expect(health.services.searchIndex).toBe('loaded');
        });

        test('deve detectar falha no embedding provider', async () => {
            similaritySearch.generateQueryEmbedding = jest.fn().mockRejectedValue(
                new Error('Embedding failed')
            );

            const health = await similaritySearch.healthCheck();

            expect(health.status).toBe('unhealthy');
            expect(health.error).toContain('Embedding failed');
        });
    });

    describe('Cache Management', () => {
        test('deve gerar chaves de cache consistentes', () => {
            const config1 = { text: 'test', threshold: 0.8 };
            const config2 = { text: 'test', threshold: 0.8 };

            const key1 = similaritySearch.generateSearchCacheKey(config1);
            const key2 = similaritySearch.generateSearchCacheKey(config2);

            expect(key1).toBe(key2);
        });

        test('deve gerenciar cache corretamente', () => {
            const key = 'test-key';
            const data = [{ id: '1', content: 'test' }];

            similaritySearch.setSearchCache(key, data);
            const cached = similaritySearch.getSearchFromCache(key);

            expect(cached).toEqual(data);
        });

        test('deve limpar cache quando TTL expira', async () => {
            const key = 'test-key';
            const data = [{ id: '1', content: 'test' }];

            similaritySearch.config.cache.ttl = 0.001; // 1ms
            similaritySearch.setSearchCache(key, data);

            await new Promise(resolve => setTimeout(resolve, 10));

            const cached = similaritySearch.getSearchFromCache(key);
            expect(cached).toBeNull();
        });
    });

    describe('Tratamento de Erros', () => {
        test('deve validar query de busca', async () => {
            await expect(similaritySearch.search(null))
                .rejects.toThrow();
        });

        test('deve lidar com embedding inválido', async () => {
            mockOpenAIClient.embeddings.create.mockResolvedValue({
                data: [{ embedding: null }]
            });

            await expect(similaritySearch.generateQueryEmbedding('test'))
                .rejects.toThrow(SimilaritySearchError);
        });

        test('deve lidar com falha na busca de incidentes', async () => {
            similaritySearch.generateQueryEmbedding = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
            similaritySearch.getIncidentsFromDatabase = jest.fn().mockRejectedValue(
                new Error('Database connection failed')
            );

            await expect(similaritySearch.search({ text: 'test' }))
                .rejects.toThrow(SimilaritySearchError);
        });
    });
});