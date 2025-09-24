/**
 * Testes unitários para LLMService
 */

const LLMService = require('../../../src/services/llm-integration/LLMService');
const PromptTemplates = require('../../../src/services/llm-integration/PromptTemplates');
const RAGService = require('../../../src/services/llm-integration/RAGService');
const SimilaritySearch = require('../../../src/services/llm-integration/SimilaritySearch');
const { LLMError, RateLimitError, TimeoutError } = require('../../../src/services/llm-integration/utils/LLMErrors');

// Mocks
jest.mock('../../../src/services/llm-integration/PromptTemplates');
jest.mock('../../../src/services/llm-integration/RAGService');
jest.mock('../../../src/services/llm-integration/SimilaritySearch');
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

describe('LLMService', () => {
    let llmService;
    let mockConfig;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        mockConfig = {
            openai: {
                enabled: true,
                apiKey: 'test-openai-key',
                model: 'gpt-4-turbo-preview'
            },
            claude: {
                enabled: true,
                apiKey: 'test-claude-key',
                model: 'claude-3-sonnet-20240229'
            },
            timeout: 30000
        };

        // Mock das dependências
        PromptTemplates.mockImplementation(() => ({
            getTemplate: jest.fn().mockReturnValue({
                systemPrompt: 'Test system prompt',
                chainOfThoughtInstructions: 'Test instructions',
                responseFormat: 'Test format'
            }),
            buildPrompt: jest.fn().mockReturnValue('Test built prompt')
        }));

        RAGService.mockImplementation(() => ({
            query: jest.fn().mockResolvedValue([
                {
                    title: 'Test KB Article',
                    content: 'Test knowledge base content',
                    relevance: 0.9
                }
            ])
        }));

        SimilaritySearch.mockImplementation(() => ({
            search: jest.fn().mockResolvedValue([
                {
                    id: 'similar-1',
                    title: 'Similar incident',
                    solution: 'Test solution',
                    similarity: 0.85
                }
            ]),
            findPatterns: jest.fn().mockResolvedValue({
                frequency: { pattern: 'test', count: 5 }
            })
        }));

        llmService = new LLMService(mockConfig);
    });

    describe('Inicialização', () => {
        test('deve inicializar com configuração padrão', () => {
            const service = new LLMService();
            expect(service.config.providers.openai.enabled).toBe(false);
            expect(service.config.providers.claude.enabled).toBe(false);
        });

        test('deve inicializar com configuração customizada', () => {
            expect(llmService.config.providers.openai.enabled).toBe(true);
            expect(llmService.config.providers.claude.enabled).toBe(true);
        });

        test('deve inicializar rate limiting', () => {
            expect(llmService.requestQueue).toBeInstanceOf(Map);
            expect(llmService.rateLimiter).toBeDefined();
        });
    });

    describe('analyzeIncident', () => {
        let mockIncident;

        beforeEach(() => {
            mockIncident = {
                id: 'test-incident-1',
                title: 'Database connection timeout',
                description: 'Unable to connect to primary database',
                type: 'database',
                priority: 'High',
                category: 'infrastructure',
                affectedSystems: ['database', 'api'],
                errorMessages: ['Connection timeout after 30 seconds']
            };
        });

        test('deve analisar incidente com sucesso', async () => {
            // Mock dos métodos internos
            llmService.extractRelevantContext = jest.fn().mockResolvedValue({
                startTime: Date.now(),
                incidentData: mockIncident,
                extractedEntities: {
                    systems: ['database'],
                    errorCodes: ['TIMEOUT-30'],
                    databases: ['postgresql'],
                    services: ['api']
                }
            });

            llmService.enrichWithHistoricalData = jest.fn().mockResolvedValue({
                incidentData: mockIncident,
                enrichment: {
                    historicalPattern: { frequency: 3 },
                    resolutionStats: { averageResolutionTime: '2 hours' }
                }
            });

            llmService.generateAnalysis = jest.fn().mockResolvedValue({
                rootCause: 'Database connection pool exhaustion',
                severity: 'High',
                confidence: 0.85,
                suggestedActions: [
                    {
                        action: 'Restart database connection pool',
                        priority: 'Immediate',
                        estimatedTime: '5 minutes'
                    }
                ],
                estimatedResolutionTime: '30 minutes'
            });

            const result = await llmService.analyzeIncident(mockIncident);

            expect(result).toBeDefined();
            expect(result.incidentId).toBe(mockIncident.id);
            expect(result.analysis).toBeDefined();
            expect(result.analysis.rootCause).toBe('Database connection pool exhaustion');
            expect(result.confidence).toBe(0.85);
        });

        test('deve lidar com erro de validação', async () => {
            const invalidIncident = {
                // Falta campos obrigatórios
                title: 'Test'
            };

            await expect(llmService.analyzeIncident(invalidIncident))
                .rejects.toThrow();
        });

        test('deve retornar análise de fallback em caso de erro', async () => {
            llmService.extractRelevantContext = jest.fn().mockRejectedValue(
                new Error('Test error')
            );

            const result = await llmService.analyzeIncident(mockIncident);

            expect(result.analysis.fallback).toBe(true);
            expect(result.analysis.rootCause).toContain('Análise automática falhou');
        });
    });

    describe('extractRelevantContext', () => {
        test('deve extrair contexto relevante do incidente', async () => {
            const incident = {
                id: 'test-1',
                title: 'API Gateway Error 500',
                description: 'Internal server error in payment API',
                type: 'application',
                priority: 'Critical'
            };

            const context = await llmService.extractRelevantContext(incident);

            expect(context.incidentData.id).toBe(incident.id);
            expect(context.startTime).toBeDefined();
            expect(context.extractedEntities).toBeDefined();
        });

        test('deve extrair entidades técnicas do texto', async () => {
            const incident = {
                id: 'test-1',
                title: 'Oracle database ORA-12541 connection error',
                description: 'Cannot connect to database server 192.168.1.10 on port 1521',
                type: 'database'
            };

            llmService.extractSystemNames = jest.fn().mockReturnValue(['oracle', 'database']);
            llmService.extractErrorCodes = jest.fn().mockReturnValue(['ORA-12541']);
            llmService.extractIPAddresses = jest.fn().mockReturnValue(['192.168.1.10']);

            const context = await llmService.extractRelevantContext(incident);

            expect(context.extractedEntities.systems).toContain('oracle');
            expect(context.extractedEntities.errorCodes).toContain('ORA-12541');
            expect(context.extractedEntities.ips).toContain('192.168.1.10');
        });
    });

    describe('generateAnalysis', () => {
        test('deve gerar análise usando provider disponível', async () => {
            const mockData = {
                incident: {
                    incidentData: {
                        type: 'database',
                        category: 'infrastructure'
                    }
                },
                similarIncidents: [],
                knowledgeBase: []
            };

            llmService.getAvailableProviders = jest.fn().mockReturnValue(['openai']);
            llmService.checkRateLimit = jest.fn().mockResolvedValue(true);
            llmService.callProvider = jest.fn().mockResolvedValue({
                rootCause: 'Test cause',
                confidence: 0.8,
                suggestedActions: []
            });

            const result = await llmService.generateAnalysis(mockData);

            expect(result.rootCause).toBe('Test cause');
            expect(result.confidence).toBe(0.8);
        });

        test('deve usar fallback quando provider principal falha', async () => {
            const mockData = {
                incident: { incidentData: { type: 'database' } },
                similarIncidents: [],
                knowledgeBase: []
            };

            llmService.getAvailableProviders = jest.fn().mockReturnValue(['openai', 'claude']);
            llmService.checkRateLimit = jest.fn().mockResolvedValue(true);

            // Primeiro provider falha
            llmService.callProvider = jest.fn()
                .mockRejectedValueOnce(new Error('OpenAI failed'))
                .mockResolvedValueOnce({
                    rootCause: 'Fallback analysis',
                    confidence: 0.7
                });

            const result = await llmService.generateAnalysis(mockData);

            expect(result.rootCause).toBe('Fallback analysis');
            expect(llmService.callProvider).toHaveBeenCalledTimes(2);
        });

        test('deve falhar quando todos os providers falharam', async () => {
            const mockData = {
                incident: { incidentData: { type: 'database' } },
                similarIncidents: [],
                knowledgeBase: []
            };

            llmService.getAvailableProviders = jest.fn().mockReturnValue(['openai']);
            llmService.checkRateLimit = jest.fn().mockResolvedValue(true);
            llmService.callProvider = jest.fn().mockRejectedValue(new Error('All providers failed'));

            await expect(llmService.generateAnalysis(mockData))
                .rejects.toThrow('All providers failed');
        });
    });

    describe('Rate Limiting', () => {
        test('deve respeitar rate limit', async () => {
            llmService.rateLimiter.requests = new Array(25).fill({
                provider: 'openai',
                timestamp: Date.now()
            });

            const withinLimit = await llmService.checkRateLimit('openai');
            expect(withinLimit).toBe(false);
        });

        test('deve permitir requests dentro do limite', async () => {
            llmService.rateLimiter.requests = [];

            const withinLimit = await llmService.checkRateLimit('openai');
            expect(withinLimit).toBe(true);
        });
    });

    describe('Extração de Entidades', () => {
        test('deve extrair nomes de sistemas', () => {
            const text = 'Core banking system and payment gateway are down';
            const systems = llmService.extractSystemNames(text);

            expect(systems).toContain('core banking');
            expect(systems).toContain('payment gateway');
        });

        test('deve extrair códigos de erro', () => {
            const text = 'Error ERR-1234 occurred, also see ABC123 and 5000-6000';
            const errorCodes = llmService.extractErrorCodes(text);

            expect(errorCodes).toContain('ERR-1234');
            expect(errorCodes).toContain('ABC123');
            expect(errorCodes).toContain('5000-6000');
        });

        test('deve extrair endereços IP', () => {
            const text = 'Cannot connect to 192.168.1.10 or 10.0.0.1';
            const ips = llmService.extractIPAddresses(text);

            expect(ips).toContain('192.168.1.10');
            expect(ips).toContain('10.0.0.1');
        });

        test('deve extrair URLs', () => {
            const text = 'Service at https://api.bank.com/v1 is failing';
            const urls = llmService.extractURLs(text);

            expect(urls).toContain('https://api.bank.com/v1');
        });
    });

    describe('parseAnalysisResponse', () => {
        test('deve parsear resposta JSON válida', () => {
            const response = JSON.stringify({
                rootCause: 'Database timeout',
                severity: 'High',
                confidence: 0.9,
                suggestedActions: [
                    { action: 'Restart service', priority: 'Immediate' }
                ]
            });

            const parsed = llmService.parseAnalysisResponse(response, 'openai');

            expect(parsed.rootCause).toBe('Database timeout');
            expect(parsed.severity).toBe('High');
            expect(parsed.confidence).toBe(0.9);
            expect(parsed.provider).toBe('openai');
        });

        test('deve criar fallback para resposta inválida', () => {
            const invalidResponse = 'Invalid JSON response';

            const parsed = llmService.parseAnalysisResponse(invalidResponse, 'openai');

            expect(parsed.fallback).toBe(true);
            expect(parsed.confidence).toBe(0.3);
            expect(parsed.provider).toBe('openai');
            expect(parsed.rawResponse).toContain('Invalid JSON');
        });
    });

    describe('Error Handling', () => {
        test('deve tratar RateLimitError corretamente', async () => {
            const mockData = { incident: { incidentData: { type: 'test' } } };

            llmService.getAvailableProviders = jest.fn().mockReturnValue(['openai']);
            llmService.checkRateLimit = jest.fn().mockResolvedValue(true);
            llmService.callProvider = jest.fn().mockRejectedValue(
                new RateLimitError('Rate limit exceeded', 60000)
            );
            llmService.wait = jest.fn().mockResolvedValue();

            await expect(llmService.generateAnalysis(mockData))
                .rejects.toThrow(RateLimitError);

            expect(llmService.wait).toHaveBeenCalledWith(60000);
        });

        test('deve criar análise de fallback para erros críticos', async () => {
            const incident = { id: 'test-1', priority: 'High' };
            const error = new Error('Critical system failure');

            const result = await llmService.handleAnalysisError(error, incident);

            expect(result.analysis.fallback).toBe(true);
            expect(result.analysis.escalationRecommendation).toBe(true);
            expect(result.confidence).toBe(0.1);
        });
    });

    describe('Métricas e Estatísticas', () => {
        test('deve calcular estatísticas de resolução', async () => {
            const stats = await llmService.getResolutionStatistics('database');

            expect(stats).toBeDefined();
            expect(stats.averageResolutionTime).toBeDefined();
            expect(stats.successRate).toBeDefined();
        });

        test('deve avaliar fatores de risco', () => {
            const context = {
                incidentData: {
                    priority: 'Critical',
                    type: 'security'
                },
                extractedEntities: {
                    systems: ['core banking', 'mainframe']
                }
            };

            const historicalPattern = { frequency: 8 };

            const risks = llmService.assessRiskFactors(context, historicalPattern);

            expect(risks).toContain('high_priority');
            expect(risks).toContain('recurring_pattern');
            expect(risks).toContain('critical_system');
        });
    });

    describe('Integração com Serviços', () => {
        test('deve integrar com RAGService para knowledge base', async () => {
            const context = {
                incidentData: { type: 'database', category: 'performance' },
                extractedEntities: { systems: ['postgresql'] }
            };

            const results = await llmService.queryKnowledgeBase(context);

            expect(llmService.ragService.query).toHaveBeenCalled();
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Test KB Article');
        });

        test('deve integrar com SimilaritySearch para incidentes similares', async () => {
            const context = {
                incidentData: {
                    title: 'Database error',
                    description: 'Connection timeout',
                    type: 'database',
                    category: 'infrastructure'
                }
            };

            const results = await llmService.findSimilarIncidents(context);

            expect(llmService.similaritySearch.search).toHaveBeenCalled();
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Similar incident');
        });
    });
});

describe('LLMService Integration Tests', () => {
    test('deve executar pipeline completo de análise', async () => {
        // Este seria um teste de integração mais completo
        // que testaria o fluxo end-to-end sem mocks
    });
});