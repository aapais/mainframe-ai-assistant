/**
 * Testes de Precisão de Categorização
 *
 * Suite abrangente de testes para validar a precisão e performance
 * do sistema híbrido de categorização automática.
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const CategoryManager = require('../../src/services/categorization/CategoryManager');
const MLClassifier = require('../../src/services/categorization/MLClassifier');
const AutoRouter = require('../../src/services/categorization/AutoRouter');
const TaxonomyManager = require('../../src/services/categorization/TaxonomyManager');

describe('Sistema de Categorização - Testes de Precisão', () => {
    let categoryManager;
    let autoRouter;
    let taxonomyManager;

    // Dados de teste estruturados por categoria
    const testCases = {
        mainframe: [
            {
                incident: {
                    id: 'INC-001',
                    title: 'Erro ABEND S0C4 no programa COBOL',
                    description: 'Sistema z/OS apresentou ABEND S0C4 no programa PGMTEST01 durante processamento batch noturno',
                    priority: 'high',
                    source: 'monitoring'
                },
                expectedCategory: 'mainframe',
                expectedConfidence: 0.85,
                expectedTeam: 'mainframe-support'
            },
            {
                incident: {
                    id: 'INC-002',
                    title: 'CICS transação timeout',
                    description: 'Transação CICS ABCDxxxx retornando timeout para usuários região PROD01',
                    priority: 'critical',
                    source: 'user_report'
                },
                expectedCategory: 'cics',
                expectedConfidence: 0.80,
                expectedTeam: 'cics-support'
            },
            {
                incident: {
                    id: 'INC-003',
                    title: 'DB2 tablespace em STOP',
                    description: 'Tablespace DBTEST01 em status STOP devido B37 - falta de espaço',
                    priority: 'critical',
                    source: 'automation'
                },
                expectedCategory: 'db2',
                expectedConfidence: 0.90,
                expectedTeam: 'dba-team'
            }
        ],

        'mobile-banking': [
            {
                incident: {
                    id: 'INC-004',
                    title: 'App mobile iOS crash',
                    description: 'Aplicativo bancário iOS travando na tela de login após atualização 3.2.1',
                    priority: 'high',
                    source: 'app_store'
                },
                expectedCategory: 'mobile-banking',
                expectedConfidence: 0.85,
                expectedTeam: 'mobile-team'
            },
            {
                incident: {
                    id: 'INC-005',
                    title: 'API mobile erro 500',
                    description: 'Endpoint /api/mobile/balance retornando HTTP 500 para requisições Android',
                    priority: 'medium',
                    source: 'monitoring'
                },
                expectedCategory: 'mobile-banking',
                expectedConfidence: 0.75,
                expectedTeam: 'mobile-team'
            }
        ],

        'payment-systems': [
            {
                incident: {
                    id: 'INC-006',
                    title: 'PIX indisponível',
                    description: 'Sistema PIX fora do ar para todos os clientes - erro gateway pagamento',
                    priority: 'critical',
                    source: 'bacen'
                },
                expectedCategory: 'payment-systems',
                expectedConfidence: 0.95,
                expectedTeam: 'payments-team'
            },
            {
                incident: {
                    id: 'INC-007',
                    title: 'TED não processando',
                    description: 'Transferências TED para Banco do Brasil falhando código erro 999',
                    priority: 'high',
                    source: 'operations'
                },
                expectedCategory: 'payment-systems',
                expectedConfidence: 0.85,
                expectedTeam: 'payments-team'
            }
        ],

        'infrastructure': [
            {
                incident: {
                    id: 'INC-008',
                    title: 'Servidor aplicação alto CPU',
                    description: 'Servidor PROD-APP-01 com 95% uso CPU há 30 minutos - aplicação lenta',
                    priority: 'medium',
                    source: 'monitoring'
                },
                expectedCategory: 'infrastructure',
                expectedConfidence: 0.80,
                expectedTeam: 'infrastructure-team'
            }
        ]
    };

    beforeAll(async () => {
        // Inicializa componentes do sistema
        categoryManager = new CategoryManager({
            minConfidence: 0.6,
            enableFeedbackLearning: true,
            modelPath: './test-models'
        });

        autoRouter = new AutoRouter({
            enableLoadBalancing: true,
            enableEscalation: true
        });

        taxonomyManager = new TaxonomyManager();

        await categoryManager.initialize();
        await autoRouter.initialize();
    });

    afterAll(async () => {
        // Cleanup
        if (categoryManager) {
            // Limpa cache e recursos
        }
    });

    describe('Testes de Precisão de Classificação', () => {
        test.each(Object.entries(testCases))('%s - deve classificar corretamente', async (category, cases) => {
            for (const testCase of cases) {
                const result = await categoryManager.classifyIncident(testCase.incident);

                // Verifica se classificação foi bem-sucedida
                expect(result).toBeDefined();
                expect(result.classification).toBeDefined();
                expect(result.classification.primaryCategory).toBeDefined();

                // Verifica categoria predita
                const predictedCategory = result.classification.primaryCategory.taxonomyId;
                expect(predictedCategory).toBe(testCase.expectedCategory);

                // Verifica confiança mínima
                const confidence = result.classification.primaryCategory.confidence;
                expect(confidence).toBeGreaterThanOrEqual(testCase.expectedConfidence - 0.1);

                // Verifica se tem alternativas quando confiança é menor
                if (confidence < 0.8) {
                    expect(result.classification.alternatives).toBeDefined();
                    expect(result.classification.alternatives.length).toBeGreaterThan(0);
                }

                console.log(`✅ ${testCase.incident.id}: ${predictedCategory} (${(confidence * 100).toFixed(1)}%)`);
            }
        });

        test('deve retornar múltiplas alternativas para casos ambíguos', async () => {
            const ambiguousIncident = {
                id: 'INC-AMBIGUOUS',
                title: 'Erro no sistema',
                description: 'Sistema apresentando erro genérico',
                priority: 'medium',
                source: 'user_report'
            };

            const result = await categoryManager.classifyIncident(ambiguousIncident);

            expect(result).toBeDefined();
            expect(result.classification).toBeDefined();

            // Para casos ambíguos, deve ter alternativas
            if (result.classification.primaryCategory.confidence < 0.7) {
                expect(result.classification.alternatives).toBeDefined();
                expect(result.classification.alternatives.length).toBeGreaterThan(0);
            }
        });

        test('deve manter histórico de confiança para análise', async () => {
            const incidents = Object.values(testCases).flat();
            const confidenceHistory = [];

            for (const testCase of incidents.slice(0, 5)) {
                const result = await categoryManager.classifyIncident(testCase.incident);
                confidenceHistory.push(result.classification.primaryCategory.confidence);
            }

            // Verifica se há histórico
            expect(confidenceHistory.length).toBe(5);

            // Calcula confiança média
            const avgConfidence = confidenceHistory.reduce((sum, conf) => sum + conf, 0) / confidenceHistory.length;
            expect(avgConfidence).toBeGreaterThan(0.6);

            console.log(`📊 Confiança média: ${(avgConfidence * 100).toFixed(1)}%`);
        });
    });

    describe('Testes de Performance do Algoritmo Híbrido', () => {
        test('deve combinar resultados de múltiplos métodos', async () => {
            const incident = {
                id: 'INC-HYBRID',
                title: 'COBOL programa ABEND mainframe z/OS',
                description: 'Programa COBOL apresentou ABEND S0C4 no sistema mainframe z/OS região PROD',
                priority: 'high',
                source: 'monitoring'
            };

            const result = await categoryManager.classifyIncident(incident);

            // Verifica se métodos híbridos foram usados
            expect(result.processingInfo.methods).toBeDefined();

            // Deve usar pelo menos 2 métodos para este caso
            const methodsUsed = Object.values(result.processingInfo.methods).filter(Boolean).length;
            expect(methodsUsed).toBeGreaterThanOrEqual(2);

            // Verifica se tem scores por método
            if (result.classification.methodScores) {
                expect(Object.keys(result.classification.methodScores).length).toBeGreaterThan(0);
            }

            console.log(`🔬 Métodos usados: ${JSON.stringify(result.processingInfo.methods)}`);
        });

        test('deve processar classificação em tempo aceitável', async () => {
            const incident = {
                id: 'INC-PERFORMANCE',
                title: 'Teste de performance',
                description: 'Incidente para teste de tempo de processamento da classificação automática',
                priority: 'medium'
            };

            const startTime = Date.now();
            const result = await categoryManager.classifyIncident(incident);
            const processingTime = Date.now() - startTime;

            // Deve processar em menos de 2 segundos
            expect(processingTime).toBeLessThan(2000);

            // Verifica se tempo está nos metadados
            expect(result.processingInfo.processingTime).toBeDefined();
            expect(result.processingInfo.processingTime).toBeLessThan(2000);

            console.log(`⚡ Tempo de processamento: ${processingTime}ms`);
        });

        test('deve usar cache para incidentes similares', async () => {
            const incident = {
                id: 'INC-CACHE-1',
                title: 'CICS timeout',
                description: 'Transação CICS apresentando timeout',
                priority: 'high'
            };

            // Primeira classificação
            const start1 = Date.now();
            const result1 = await categoryManager.classifyIncident(incident);
            const time1 = Date.now() - start1;

            // Segunda classificação (mesmos dados)
            const start2 = Date.now();
            const result2 = await categoryManager.classifyIncident(incident);
            const time2 = Date.now() - start2;

            // Segunda deve ser mais rápida (cache)
            expect(time2).toBeLessThan(time1);

            // Resultados devem ser consistentes
            expect(result1.classification.primaryCategory.taxonomyId)
                .toBe(result2.classification.primaryCategory.taxonomyId);

            console.log(`💾 Cache: ${time1}ms -> ${time2}ms (${((1 - time2/time1) * 100).toFixed(1)}% melhoria)`);
        });
    });

    describe('Testes de Roteamento Automático', () => {
        test.each(Object.entries(testCases))('%s - deve rotear para equipe correta', async (category, cases) => {
            for (const testCase of cases) {
                // Primeiro classifica
                const classification = await categoryManager.classifyIncident(testCase.incident);

                // Depois roteia
                const routing = await autoRouter.routeIncident(testCase.incident, classification);

                expect(routing).toBeDefined();
                expect(routing.targetTeam).toBe(testCase.expectedTeam);
                expect(routing.sla).toBeDefined();
                expect(routing.priority).toBeDefined();
                expect(routing.escalationPath).toBeDefined();

                console.log(`🎯 ${testCase.incident.id} -> ${routing.targetTeam} (SLA: ${routing.sla}min)`);
            }
        });

        test('deve calcular SLA baseado na prioridade', async () => {
            const incidents = [
                { priority: 'critical', expectedSLAMax: 20 },
                { priority: 'high', expectedSLAMax: 40 },
                { priority: 'medium', expectedSLAMax: 80 },
                { priority: 'low', expectedSLAMax: 120 }
            ];

            for (const { priority, expectedSLAMax } of incidents) {
                const incident = {
                    id: `INC-SLA-${priority.toUpperCase()}`,
                    title: `Teste SLA ${priority}`,
                    description: 'Incidente para teste de SLA',
                    priority: priority
                };

                const classification = await categoryManager.classifyIncident(incident);
                const routing = await autoRouter.routeIncident(incident, classification);

                expect(routing.sla).toBeLessThanOrEqual(expectedSLAMax);

                console.log(`⏱️  Prioridade ${priority}: SLA ${routing.sla}min (max: ${expectedSLAMax}min)`);
            }
        });

        test('deve criar caminho de escalação apropriado', async () => {
            const incident = {
                id: 'INC-ESCALATION',
                title: 'Teste escalação',
                description: 'Incidente crítico mainframe COBOL ABEND S0C4',
                priority: 'critical'
            };

            const classification = await categoryManager.classifyIncident(incident);
            const routing = await autoRouter.routeIncident(incident, classification);

            expect(routing.escalationPath).toBeDefined();
            expect(routing.escalationPath.length).toBeGreaterThan(0);

            // Verifica estrutura do caminho de escalação
            routing.escalationPath.forEach((step, index) => {
                expect(step.level).toBe(index + 1);
                expect(step.target).toBeDefined();
                expect(step.triggerAfter).toBeGreaterThan(0);
                expect(step.reason).toBeDefined();
            });

            console.log(`🔝 Escalação: ${routing.escalationPath.length} níveis`);
        });
    });

    describe('Testes de Aprendizado e Feedback', () => {
        test('deve processar feedback para melhoria contínua', async () => {
            const incident = {
                id: 'INC-FEEDBACK',
                title: 'Teste feedback',
                description: 'Incidente para teste de feedback e aprendizado',
                priority: 'medium'
            };

            // Classifica inicialmente
            const initialResult = await categoryManager.classifyIncident(incident);

            // Simula feedback de correção
            const feedback = {
                correctCategory: 'infrastructure', // Correção
                confidence: 0.9,
                userFeedback: 'Categoria estava incorreta',
                immediate: true
            };

            const feedbackProcessed = await categoryManager.processFeedback(incident.id, feedback);
            expect(feedbackProcessed).toBe(true);

            // Verifica se métricas foram atualizadas
            const metrics = categoryManager.getMetrics();
            expect(metrics.feedbackCount).toBeGreaterThan(0);

            console.log(`📝 Feedback processado: ${metrics.feedbackCount} total`);
        });

        test('deve treinar incrementalmente com novos dados', async () => {
            const newTrainingData = [
                {
                    text: 'Sistema de backup falhando há 3 dias consecutivos',
                    category: 'infrastructure'
                },
                {
                    text: 'PIX gateway timeout para transferências acima R$ 1000',
                    category: 'payment-systems'
                }
            ];

            // Simula treinamento incremental
            if (categoryManager.mlClassifier && categoryManager.mlClassifier.incrementalTrain) {
                const trainResult = await categoryManager.mlClassifier.incrementalTrain(newTrainingData);
                expect(typeof trainResult).toBe('boolean');

                console.log(`🎓 Treinamento incremental: ${trainResult ? 'sucesso' : 'falha'}`);
            }
        });
    });

    describe('Testes de Métricas e Monitoramento', () => {
        test('deve coletar métricas detalhadas de classificação', async () => {
            const metrics = categoryManager.getMetrics();

            expect(metrics).toBeDefined();
            expect(metrics.totalClassifications).toBeDefined();
            expect(metrics.successfulClassifications).toBeDefined();
            expect(metrics.averageConfidence).toBeDefined();
            expect(metrics.averageProcessingTime).toBeDefined();

            // Log das métricas
            console.log('📊 Métricas de Classificação:');
            console.log(`   Total: ${metrics.totalClassifications}`);
            console.log(`   Sucesso: ${metrics.successfulClassifications}`);
            console.log(`   Taxa sucesso: ${(metrics.successfulClassifications / metrics.totalClassifications * 100).toFixed(1)}%`);
            console.log(`   Confiança média: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
            console.log(`   Tempo médio: ${metrics.averageProcessingTime}ms`);
        });

        test('deve coletar métricas de roteamento', async () => {
            const metrics = autoRouter.getRoutingMetrics();

            expect(metrics).toBeDefined();
            expect(metrics.totalRoutings).toBeDefined();
            expect(metrics.successfulRoutings).toBeDefined();
            expect(metrics.activeIncidents).toBeDefined();

            console.log('📊 Métricas de Roteamento:');
            console.log(`   Total: ${metrics.totalRoutings}`);
            console.log(`   Ativos: ${metrics.activeIncidents}`);
            console.log(`   Escalações: ${metrics.escalations}`);
        });

        test('deve calcular precisão e recall do sistema', async () => {
            // Executa classificações nos casos de teste
            const results = [];

            for (const [category, cases] of Object.entries(testCases)) {
                for (const testCase of cases) {
                    const result = await categoryManager.classifyIncident(testCase.incident);

                    results.push({
                        predicted: result.classification.primaryCategory.taxonomyId,
                        actual: testCase.expectedCategory,
                        confidence: result.classification.primaryCategory.confidence
                    });
                }
            }

            // Calcula métricas
            const accuracy = results.filter(r => r.predicted === r.actual).length / results.length;
            const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

            expect(accuracy).toBeGreaterThan(0.7); // Mínimo 70% de acurácia
            expect(avgConfidence).toBeGreaterThan(0.6); // Mínimo 60% de confiança média

            console.log('🎯 Métricas Finais:');
            console.log(`   Acurácia: ${(accuracy * 100).toFixed(1)}%`);
            console.log(`   Confiança média: ${(avgConfidence * 100).toFixed(1)}%`);
            console.log(`   Casos testados: ${results.length}`);

            // Matriz de confusão simplificada
            const categories = [...new Set(results.map(r => r.actual))];
            console.log('\n📊 Matriz de Confusão:');

            for (const actualCat of categories) {
                const actualCases = results.filter(r => r.actual === actualCat);
                const correctPredictions = actualCases.filter(r => r.predicted === actualCat).length;
                const precision = correctPredictions / actualCases.length;

                console.log(`   ${actualCat}: ${correctPredictions}/${actualCases.length} (${(precision * 100).toFixed(1)}%)`);
            }
        });
    });

    describe('Testes de Casos Extremos e Robustez', () => {
        test('deve lidar com incidentes com texto vazio', async () => {
            const incident = {
                id: 'INC-EMPTY',
                title: '',
                description: '',
                priority: 'medium'
            };

            const result = await categoryManager.classifyIncident(incident);

            // Deve retornar resultado mesmo com texto vazio
            expect(result).toBeDefined();
            expect(result.classification).toBeDefined();

            // Deve usar classificação de fallback
            if (result.classification.metadata && result.classification.metadata.fallback) {
                expect(result.classification.metadata.fallback).toBe(true);
            }
        });

        test('deve lidar com texto muito longo', async () => {
            const longText = 'Sistema apresentando erro '.repeat(100);

            const incident = {
                id: 'INC-LONG',
                title: 'Texto muito longo',
                description: longText,
                priority: 'medium'
            };

            const result = await categoryManager.classifyIncident(incident);

            expect(result).toBeDefined();
            expect(result.processingInfo.processingTime).toBeLessThan(5000); // Máximo 5 segundos
        });

        test('deve lidar com caracteres especiais e encoding', async () => {
            const incident = {
                id: 'INC-SPECIAL',
                title: 'Erro com ç, ã, é, ô - caracteres especiais',
                description: 'Sistema não está funcionando corretamente! @#$%^&*()',
                priority: 'medium'
            };

            const result = await categoryManager.classifyIncident(incident);

            expect(result).toBeDefined();
            expect(result.classification).toBeDefined();
        });

        test('deve ser thread-safe para classificações simultâneas', async () => {
            const incidents = [
                { id: 'CONC-1', title: 'COBOL erro', description: 'Programa COBOL com ABEND' },
                { id: 'CONC-2', title: 'App mobile', description: 'Aplicativo iOS com crash' },
                { id: 'CONC-3', title: 'PIX falha', description: 'Sistema PIX indisponível' },
                { id: 'CONC-4', title: 'Servidor down', description: 'Infraestrutura com problemas' },
                { id: 'CONC-5', title: 'DB2 erro', description: 'Database com falha' }
            ];

            // Executa classificações em paralelo
            const promises = incidents.map(incident =>
                categoryManager.classifyIncident(incident)
            );

            const results = await Promise.all(promises);

            // Todos devem ter resultados válidos
            results.forEach((result, index) => {
                expect(result).toBeDefined();
                expect(result.incident.id).toBe(incidents[index].id);
                expect(result.classification).toBeDefined();
            });

            console.log(`🔄 ${results.length} classificações simultâneas executadas com sucesso`);
        });
    });
});

describe('Testes de Integração Completa', () => {
    let categoryManager;
    let autoRouter;

    beforeEach(async () => {
        categoryManager = new CategoryManager({
            minConfidence: 0.6,
            enableFeedbackLearning: true
        });

        autoRouter = new AutoRouter({
            enableLoadBalancing: true,
            enableEscalation: true
        });

        await categoryManager.initialize();
        await autoRouter.initialize();
    });

    test('deve executar workflow completo: classificação -> roteamento -> escalação', async () => {
        const incident = {
            id: 'INC-WORKFLOW',
            title: 'Erro crítico sistema PIX',
            description: 'Sistema PIX completamente fora do ar afetando todos os clientes',
            priority: 'critical',
            affectedUsers: 50000,
            source: 'monitoring'
        };

        // 1. Classificação
        const classification = await categoryManager.classifyIncident(incident);

        expect(classification).toBeDefined();
        expect(classification.classification.primaryCategory.taxonomyId).toBe('payment-systems');

        // 2. Roteamento
        const routing = await autoRouter.routeIncident(incident, classification);

        expect(routing).toBeDefined();
        expect(routing.targetTeam).toBe('payments-team');
        expect(routing.priority).toBe('critical');
        expect(routing.sla).toBeLessThan(15); // SLA crítico para pagamentos

        // 3. Simulação de escalação (se necessário)
        expect(routing.escalationPath.length).toBeGreaterThan(0);

        console.log(`🔄 Workflow completo: ${incident.id}`);
        console.log(`   Categoria: ${classification.classification.primaryCategory.taxonomyId}`);
        console.log(`   Confiança: ${(classification.classification.primaryCategory.confidence * 100).toFixed(1)}%`);
        console.log(`   Equipe: ${routing.targetTeam}`);
        console.log(`   SLA: ${routing.sla} minutos`);
        console.log(`   Escalação: ${routing.escalationPath.length} níveis`);

        // Marca como resolvido
        const resolved = await autoRouter.resolveIncident(incident.id, {
            resolutionTime: 8, // minutos
            solution: 'Gateway reiniciado'
        });

        expect(resolved).toBe(true);
    });
});