/**
 * Testes de Validação para Sistema de Categorização Automática
 *
 * Suite completa de testes para validar a precisão da classificação,
 * qualidade do roteamento e integração dos componentes.
 */

const TaxonomyManager = require('../../src/services/categorization/TaxonomyManager');
const TechnologyClassifier = require('../../src/services/categorization/TechnologyClassifier');
const TaggingService = require('../../src/services/categorization/TaggingService');
const RoutingEngine = require('../../src/services/categorization/RoutingEngine');

describe('Sistema de Categorização Automática', () => {
    let taxonomyManager;
    let classifier;
    let taggingService;
    let routingEngine;

    beforeEach(() => {
        taxonomyManager = new TaxonomyManager();
        classifier = new TechnologyClassifier();
        taggingService = new TaggingService();
        routingEngine = new RoutingEngine();
    });

    describe('TaxonomyManager', () => {
        test('deve inicializar taxonomias corretamente', () => {
            const stats = taxonomyManager.getStatistics();

            expect(stats.total).toBeGreaterThan(0);
            expect(stats.byLevel[1]).toBeGreaterThan(0); // Taxonomias de nível 1
            expect(stats.byLevel[2]).toBeGreaterThan(0); // Taxonomias de nível 2
        });

        test('deve buscar taxonomias por palavra-chave', () => {
            const results = taxonomyManager.searchByKeyword('mainframe');

            expect(results).toHaveLength(1);
            expect(results[0].taxonomyId).toBe('mainframe');
        });

        test('deve buscar taxonomias por pattern', () => {
            const text = 'Erro S0C4 no sistema';
            const results = taxonomyManager.searchByPattern(text);

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].taxonomyId).toBe('mainframe');
        });

        test('deve obter caminho hierárquico completo', () => {
            const path = taxonomyManager.getTaxonomyPath('cobol');

            expect(path).toHaveLength(2);
            expect(path[0].id).toBe('mainframe');
            expect(path[1].id).toBe('cobol');
        });

        test('deve validar estrutura de taxonomia', () => {
            const validTaxonomy = {
                id: 'test',
                name: 'Test Taxonomy',
                description: 'Test description',
                level: 1
            };

            expect(() => taxonomyManager.validateTaxonomy(validTaxonomy)).not.toThrow();

            const invalidTaxonomy = {
                id: 'test',
                // name ausente
                description: 'Test description',
                level: 1
            };

            expect(() => taxonomyManager.validateTaxonomy(invalidTaxonomy)).toThrow();
        });
    });

    describe('TechnologyClassifier', () => {
        describe('Classificação por Keywords', () => {
            test('deve classificar incidente mainframe corretamente', async () => {
                const incident = {
                    id: 'TEST-001',
                    title: 'Erro S0C4 em programa COBOL',
                    description: 'Programa PGPAY001 apresentou abend S0C4 durante execução do batch de pagamentos'
                };

                const result = await classifier.classifyIncident(incident);

                expect(result.primaryCategory).toBeDefined();
                expect(result.primaryCategory.category).toBe('mainframe');
                expect(result.confidence).toBeGreaterThan(0.8);
                expect(result.classifications).toContainEqual(
                    expect.objectContaining({
                        category: 'mainframe',
                        method: expect.stringMatching(/keyword|pattern/)
                    })
                );
            });

            test('deve classificar incidente PIX corretamente', async () => {
                const incident = {
                    id: 'TEST-002',
                    title: 'Falha no processamento PIX',
                    description: 'Sistema PIX apresentando timeout nas transferências instantâneas'
                };

                const result = await classifier.classifyIncident(incident);

                expect(result.primaryCategory.category).toBe('payment-systems');
                expect(result.confidence).toBeGreaterThan(0.7);
                expect(result.classifications.some(c => c.matches.includes('pix'))).toBe(true);
            });

            test('deve classificar incidente mobile corretamente', async () => {
                const incident = {
                    id: 'TEST-003',
                    title: 'App mobile não abre',
                    description: 'Aplicativo iOS do banco não está abrindo para os clientes',
                    source: 'mobile-app'
                };

                const result = await classifier.classifyIncident(incident);

                expect(result.primaryCategory.category).toBe('mobile-banking');
                expect(result.confidence).toBeGreaterThan(0.6);
            });
        });

        describe('Classificação por Patterns', () => {
            test('deve detectar patterns de erro mainframe', async () => {
                const incident = {
                    id: 'TEST-004',
                    title: 'Sistema indisponível',
                    description: 'Erro S0C7 detectado no job BATCH001'
                };

                const result = await classifier.classifyIncident(incident);

                expect(result.classifications).toContainEqual(
                    expect.objectContaining({
                        category: 'mainframe',
                        method: 'pattern'
                    })
                );
            });

            test('deve detectar patterns de API timeout', async () => {
                const incident = {
                    id: 'TEST-005',
                    title: 'Timeout no API Gateway',
                    description: 'API Gateway apresentando timeout nas requisições'
                };

                const result = await classifier.classifyIncident(incident);

                expect(result.classifications).toContainEqual(
                    expect.objectContaining({
                        category: 'internet-banking',
                        method: 'pattern'
                    })
                );
            });
        });

        describe('Classificação Contextual', () => {
            test('deve considerar fonte do incidente', async () => {
                const incident = {
                    id: 'TEST-006',
                    title: 'Problema no sistema',
                    description: 'Sistema apresentando lentidão',
                    source: 'atm'
                };

                const result = await classifier.classifyIncident(incident);

                expect(result.classifications).toContainEqual(
                    expect.objectContaining({
                        category: 'atm-network',
                        method: 'context'
                    })
                );
            });

            test('deve considerar horário do incidente', async () => {
                const incident = {
                    id: 'TEST-007',
                    title: 'Sistema indisponível',
                    description: 'Sistema fora do ar',
                    timestamp: '2024-09-22T02:00:00Z' // Madrugada
                };

                const result = await classifier.classifyIncident(incident);

                // Deve sugerir ATM com menor confiança (mais problemas fora do horário)
                const atmClassification = result.classifications.find(c => c.category === 'atm-network');
                if (atmClassification) {
                    expect(atmClassification.method).toBe('context');
                }
            });
        });

        describe('Combinação de Métodos', () => {
            test('deve combinar múltiplos métodos de classificação', async () => {
                const incident = {
                    id: 'TEST-008',
                    title: 'Falha no processamento de cartões',
                    description: 'Sistema de cartões apresentando erro de comunicação ISO8583 com ATMs',
                    source: 'payment-gateway'
                };

                const result = await classifier.classifyIncident(incident);

                // Deve classificar tanto como payment-systems quanto atm-network
                const categories = result.classifications.map(c => c.category);
                expect(categories).toContain('payment-systems');
                expect(categories).toContain('atm-network');
            });
        });

        describe('Métricas e Performance', () => {
            test('deve manter métricas de performance', async () => {
                const incident = {
                    id: 'TEST-009',
                    title: 'Teste de performance',
                    description: 'Incidente para teste de métricas'
                };

                await classifier.classifyIncident(incident);
                const metrics = classifier.getMetrics();

                expect(metrics.totalClassifications).toBeGreaterThan(0);
                expect(metrics.averageProcessingTime).toBeGreaterThan(0);
                expect(metrics.successRate).toBeGreaterThanOrEqual(0);
            });

            test('deve processar classificação em tempo aceitável', async () => {
                const incident = {
                    id: 'TEST-010',
                    title: 'Teste de velocidade',
                    description: 'Incidente para teste de velocidade de processamento'
                };

                const startTime = Date.now();
                await classifier.classifyIncident(incident);
                const processingTime = Date.now() - startTime;

                expect(processingTime).toBeLessThan(1000); // Máximo 1 segundo
            });
        });
    });

    describe('TaggingService', () => {
        describe('Tags Automáticas', () => {
            test('deve aplicar tags automáticas baseadas na classificação', async () => {
                const incident = {
                    id: 'TEST-011',
                    title: 'Erro crítico no mainframe',
                    description: 'Sistema mainframe com problema crítico',
                    timestamp: '2024-09-22T14:30:00Z'
                };

                const classification = {
                    primaryCategory: {
                        category: 'mainframe',
                        confidence: 0.9,
                        taxonomy: { priority: 'critical' }
                    },
                    classifications: [
                        { category: 'mainframe', confidence: 0.9 }
                    ]
                };

                const result = await taggingService.applyAutoTags(incident, classification);

                expect(result.applied).toBeGreaterThan(0);
                expect(result.tags).toContainEqual(
                    expect.objectContaining({
                        id: 'system_mainframe',
                        type: 'system'
                    })
                );
                expect(result.tags).toContainEqual(
                    expect.objectContaining({
                        id: 'status_classified',
                        type: 'status'
                    })
                );
            });

            test('deve aplicar tags temporais corretamente', async () => {
                const businessHoursIncident = {
                    id: 'TEST-012',
                    title: 'Problema durante horário comercial',
                    description: 'Problema no sistema',
                    timestamp: '2024-09-23T14:30:00Z' // Segunda-feira às 14:30
                };

                const classification = { primaryCategory: null, classifications: [] };
                const result = await taggingService.applyAutoTags(businessHoursIncident, classification);

                expect(result.tags).toContainEqual(
                    expect.objectContaining({
                        id: 'time_business_hours',
                        type: 'temporal'
                    })
                );
            });

            test('deve aplicar tags de fim de semana', async () => {
                const weekendIncident = {
                    id: 'TEST-013',
                    title: 'Problema no fim de semana',
                    description: 'Problema no sistema',
                    timestamp: '2024-09-21T14:30:00Z' // Sábado
                };

                const classification = { primaryCategory: null, classifications: [] };
                const result = await taggingService.applyAutoTags(weekendIncident, classification);

                expect(result.tags).toContainEqual(
                    expect.objectContaining({
                        id: 'time_weekend',
                        type: 'temporal'
                    })
                );
            });
        });

        describe('Tags Manuais', () => {
            test('deve permitir adicionar tag manual', async () => {
                const incidentId = 'TEST-014';
                const tagId = 'impact_critical';
                const userId = 'user123';

                const result = await taggingService.addManualTag(incidentId, tagId, userId, 'Adicionado pelo analista');

                expect(result).toBe(true);

                const incidentTags = taggingService.getIncidentTags(incidentId);
                expect(incidentTags).toContainEqual(
                    expect.objectContaining({
                        id: tagId,
                        appliedBy: userId,
                        isManual: true
                    })
                );
            });

            test('deve impedir adicionar tag duplicada', async () => {
                const incidentId = 'TEST-015';
                const tagId = 'impact_high';
                const userId = 'user123';

                // Primeira adição
                await taggingService.addManualTag(incidentId, tagId, userId);

                // Segunda adição (deve falhar)
                await expect(
                    taggingService.addManualTag(incidentId, tagId, userId)
                ).rejects.toThrow('Tag already applied to incident');
            });
        });

        describe('Hierarquia de Tags', () => {
            test('deve retornar hierarquia de tags corretamente', () => {
                const hierarchy = taggingService.getTagHierarchy();

                expect(Array.isArray(hierarchy)).toBe(true);
                expect(hierarchy.length).toBeGreaterThan(0);

                // Verificar se tem estrutura hierárquica
                const mainframeTag = hierarchy.find(tag => tag.id === 'system_mainframe');
                if (mainframeTag) {
                    expect(mainframeTag.children).toBeDefined();
                    expect(Array.isArray(mainframeTag.children)).toBe(true);
                }
            });
        });

        describe('Busca de Tags', () => {
            test('deve buscar tags por critérios', () => {
                const systemTags = taggingService.searchTags({ type: 'system' });
                expect(systemTags.length).toBeGreaterThan(0);
                expect(systemTags.every(tag => tag.type === 'system')).toBe(true);

                const statusTags = taggingService.searchTags({ type: 'status' });
                expect(statusTags.length).toBeGreaterThan(0);
                expect(statusTags.every(tag => tag.type === 'status')).toBe(true);
            });
        });

        describe('Estatísticas', () => {
            test('deve gerar estatísticas de tags', () => {
                const stats = taggingService.getTagStatistics();

                expect(stats.totalTags).toBeGreaterThan(0);
                expect(stats.byType).toBeDefined();
                expect(stats.byType.system).toBeGreaterThan(0);
                expect(stats.byType.status).toBeGreaterThan(0);
            });
        });
    });

    describe('RoutingEngine', () => {
        describe('Roteamento Básico', () => {
            test('deve rotear incidente mainframe para equipe correta', async () => {
                const incident = {
                    id: 'TEST-016',
                    title: 'Erro crítico COBOL',
                    description: 'Programa COBOL com abend S0C4',
                    timestamp: '2024-09-22T14:30:00Z'
                };

                const classification = {
                    primaryCategory: {
                        category: 'mainframe',
                        confidence: 0.9,
                        taxonomy: { priority: 'critical' }
                    },
                    classifications: [
                        { category: 'mainframe', confidence: 0.9 }
                    ]
                };

                const result = await routingEngine.routeIncident(incident, classification);

                expect(result.routing.team.id).toBe('mainframe-support');
                expect(result.routing.escalationRequired).toBe(true);
                expect(result.routing.sla.response).toBeLessThanOrEqual(15);
            });

            test('deve rotear incidente PIX para equipe de pagamentos', async () => {
                const incident = {
                    id: 'TEST-017',
                    title: 'PIX indisponível',
                    description: 'Sistema PIX fora do ar',
                    timestamp: '2024-09-22T14:30:00Z'
                };

                const classification = {
                    primaryCategory: {
                        category: 'payment-systems',
                        confidence: 0.95,
                        taxonomy: { priority: 'critical' }
                    },
                    classifications: [
                        { category: 'payment-systems', confidence: 0.95 }
                    ]
                };

                const result = await routingEngine.routeIncident(incident, classification);

                expect(result.routing.team.id).toBe('payments-team');
                expect(result.routing.sla.response).toBeLessThanOrEqual(5);
            });

            test('deve rotear incidente mobile para equipe mobile', async () => {
                const incident = {
                    id: 'TEST-018',
                    title: 'App mobile com problema',
                    description: 'Aplicativo não está funcionando',
                    source: 'mobile-app',
                    timestamp: '2024-09-23T10:30:00Z' // Horário comercial
                };

                const classification = {
                    primaryCategory: {
                        category: 'mobile-banking',
                        confidence: 0.8,
                        taxonomy: { priority: 'high' }
                    },
                    classifications: [
                        { category: 'mobile-banking', confidence: 0.8 }
                    ]
                };

                const result = await routingEngine.routeIncident(incident, classification);

                expect(result.routing.team.id).toBe('mobile-team');
            });
        });

        describe('Load Balancing', () => {
            test('deve considerar capacidade da equipe no roteamento', async () => {
                // Simular equipe sobrecarregada
                const team = routingEngine.teams.get('mobile-team');
                team.capacity.current = team.capacity.max; // Capacidade máxima

                const incident = {
                    id: 'TEST-019',
                    title: 'Problema mobile não crítico',
                    description: 'Lentidão no app',
                    timestamp: '2024-09-23T10:30:00Z'
                };

                const classification = {
                    primaryCategory: {
                        category: 'mobile-banking',
                        confidence: 0.8,
                        taxonomy: { priority: 'medium' }
                    },
                    classifications: [
                        { category: 'mobile-banking', confidence: 0.8 }
                    ]
                };

                const result = await routingEngine.routeIncident(incident, classification);

                // Deve rotear para equipe alternativa ou escalação
                expect(result.routing.team.id).not.toBe('mobile-team');
            });
        });

        describe('Disponibilidade de Equipes', () => {
            test('deve verificar disponibilidade da equipe baseada no horário', () => {
                const mobileTeam = routingEngine.teams.get('mobile-team');

                // Horário comercial (segunda-feira 10:00)
                const businessHours = new Date('2024-09-23T10:00:00Z');
                expect(routingEngine.isTeamAvailable(mobileTeam, businessHours)).toBe(true);

                // Fora do horário (madrugada)
                const afterHours = new Date('2024-09-23T02:00:00Z');
                expect(routingEngine.isTeamAvailable(mobileTeam, afterHours)).toBe(false);

                // Equipe 24x7 sempre disponível
                const mainframeTeam = routingEngine.teams.get('mainframe-support');
                expect(routingEngine.isTeamAvailable(mainframeTeam, afterHours)).toBe(true);
            });
        });

        describe('SLA e Escalação', () => {
            test('deve calcular SLA corretamente baseado na categoria e prioridade', () => {
                const incident = { id: 'TEST-020' };
                const criticalPayment = {
                    primaryCategory: {
                        category: 'payment-systems',
                        taxonomy: { priority: 'critical' }
                    }
                };

                const sla = routingEngine.calculateSLA(incident, criticalPayment);

                expect(sla.response).toBeLessThanOrEqual(5);
                expect(sla.resolution).toBeLessThanOrEqual(30);
                expect(sla.escalation).toBeLessThanOrEqual(10);
            });

            test('deve agendar escalação para incidentes críticos', async () => {
                const incident = {
                    id: 'TEST-021',
                    title: 'Sistema crítico fora do ar',
                    description: 'Core banking indisponível',
                    timestamp: '2024-09-22T14:30:00Z'
                };

                const classification = {
                    primaryCategory: {
                        category: 'core-banking',
                        confidence: 0.95,
                        taxonomy: { priority: 'critical' }
                    },
                    classifications: [
                        { category: 'core-banking', confidence: 0.95 }
                    ]
                };

                const result = await routingEngine.routeIncident(incident, classification);

                expect(result.routing.escalationRequired).toBe(true);
                expect(result.actions).toContainEqual(
                    expect.objectContaining({
                        type: 'escalation_scheduled'
                    })
                );
            });
        });

        describe('Métricas de Roteamento', () => {
            test('deve manter métricas de roteamento', async () => {
                const incident = {
                    id: 'TEST-022',
                    title: 'Teste métricas',
                    description: 'Incidente para teste de métricas'
                };

                const classification = {
                    primaryCategory: {
                        category: 'infrastructure',
                        confidence: 0.7,
                        taxonomy: { priority: 'medium' }
                    },
                    classifications: []
                };

                await routingEngine.routeIncident(incident, classification);
                const metrics = routingEngine.getRoutingMetrics();

                expect(metrics.totalRoutings).toBeGreaterThan(0);
                expect(metrics.successRate).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Integração Completa', () => {
        test('deve executar fluxo completo de categorização e roteamento', async () => {
            const incident = {
                id: 'TEST-023',
                title: 'Falha no processamento de pagamentos PIX',
                description: 'Sistema PIX apresentando erro de timeout durante transferências instantâneas. Múltiplos clientes afetados.',
                source: 'payment-gateway',
                timestamp: '2024-09-22T15:30:00Z',
                affectedUsers: 1500
            };

            // 1. Classificação
            const classification = await classifier.classifyIncident(incident);

            expect(classification.primaryCategory).toBeDefined();
            expect(classification.primaryCategory.category).toBe('payment-systems');
            expect(classification.confidence).toBeGreaterThan(0.7);

            // 2. Tagging
            const taggingResult = await taggingService.applyAutoTags(incident, classification);

            expect(taggingResult.applied).toBeGreaterThan(0);
            expect(taggingResult.tags.some(tag => tag.type === 'system')).toBe(true);

            // 3. Roteamento
            const routingResult = await routingEngine.routeIncident(incident, classification);

            expect(routingResult.routing.team.id).toBe('payments-team');
            expect(routingResult.routing.sla.response).toBeLessThanOrEqual(5);
            expect(routingResult.routing.escalationRequired).toBe(true);

            // 4. Verificar notificações
            expect(routingResult.notifications.length).toBeGreaterThan(0);
        });

        test('deve tratar incidente com baixa confiança de classificação', async () => {
            const incident = {
                id: 'TEST-024',
                title: 'Problema no sistema',
                description: 'Sistema apresentando lentidão',
                timestamp: '2024-09-22T16:30:00Z'
            };

            const classification = await classifier.classifyIncident(incident);

            // Se a confiança for baixa, deve ser marcado para revisão manual
            if (classification.confidence < 0.7) {
                const taggingResult = await taggingService.applyAutoTags(incident, classification);

                expect(taggingResult.tags).toContainEqual(
                    expect.objectContaining({
                        id: 'status_manual_review',
                        type: 'status'
                    })
                );
            }

            // Deve ser roteado para infraestrutura como fallback
            const routingResult = await routingEngine.routeIncident(incident, classification);
            expect(routingResult.routing.team).toBeDefined();
        });

        test('deve processar múltiplos incidentes em batch', async () => {
            const incidents = [
                {
                    id: 'BATCH-001',
                    title: 'Erro COBOL programa PGPAY',
                    description: 'Abend S0C4 no mainframe',
                    timestamp: '2024-09-22T17:00:00Z'
                },
                {
                    id: 'BATCH-002',
                    title: 'PIX fora do ar',
                    description: 'Sistema PIX indisponível',
                    timestamp: '2024-09-22T17:01:00Z'
                },
                {
                    id: 'BATCH-003',
                    title: 'App mobile não abre',
                    description: 'Aplicativo iOS com problema',
                    timestamp: '2024-09-22T17:02:00Z'
                }
            ];

            const startTime = Date.now();
            const results = [];

            for (const incident of incidents) {
                const classification = await classifier.classifyIncident(incident);
                const tagging = await taggingService.applyAutoTags(incident, classification);
                const routing = await routingEngine.routeIncident(incident, classification);

                results.push({
                    incident: incident.id,
                    category: classification.primaryCategory?.category,
                    team: routing.routing.team.id,
                    confidence: classification.confidence
                });
            }

            const processingTime = Date.now() - startTime;

            expect(results).toHaveLength(3);
            expect(results[0].category).toBe('mainframe');
            expect(results[0].team).toBe('mainframe-support');
            expect(results[1].category).toBe('payment-systems');
            expect(results[1].team).toBe('payments-team');
            expect(results[2].category).toBe('mobile-banking');
            expect(results[2].team).toBe('mobile-team');

            // Deve processar todos em menos de 5 segundos
            expect(processingTime).toBeLessThan(5000);
        });
    });

    describe('Casos Extremos e Tratamento de Erros', () => {
        test('deve tratar incidente com dados incompletos', async () => {
            const incident = {
                id: 'ERROR-001'
                // title e description ausentes
            };

            const classification = await classifier.classifyIncident(incident);

            expect(classification).toBeDefined();
            expect(classification.error).toBeUndefined(); // Não deve gerar erro
            expect(classification.confidence).toBeLessThanOrEqual(0.5);
        });

        test('deve tratar classificação sem categoria identificada', async () => {
            const incident = {
                id: 'ERROR-002',
                title: 'xyz abc def',
                description: 'qwe rty uio'
            };

            const classification = await classifier.classifyIncident(incident);
            const routingResult = await routingEngine.routeIncident(incident, classification);

            // Deve usar rota de fallback
            expect(routingResult.routing.team).toBeDefined();
        });

        test('deve tratar equipe indisponível', async () => {
            const incident = {
                id: 'ERROR-003',
                title: 'Problema no app mobile',
                description: 'App não funciona',
                timestamp: '2024-09-22T02:00:00Z' // Madrugada - equipe mobile indisponível
            };

            const classification = {
                primaryCategory: {
                    category: 'mobile-banking',
                    confidence: 0.8,
                    taxonomy: { priority: 'medium' }
                },
                classifications: [
                    { category: 'mobile-banking', confidence: 0.8 }
                ]
            };

            const routingResult = await routingEngine.routeIncident(incident, classification);

            // Deve escalar ou usar equipe alternativa
            expect(routingResult.routing.team).toBeDefined();
            expect(routingResult.routing.team.id).not.toBe('mobile-team');
        });
    });

    describe('Performance e Escalabilidade', () => {
        test('deve manter performance com cache', async () => {
            const incident = {
                id: 'PERF-001',
                title: 'Teste de cache',
                description: 'Incidente para teste de cache'
            };

            // Primeira execução
            const start1 = Date.now();
            await classifier.classifyIncident(incident);
            const time1 = Date.now() - start1;

            // Segunda execução (deve usar cache)
            const start2 = Date.now();
            await classifier.classifyIncident(incident);
            const time2 = Date.now() - start2;

            expect(time2).toBeLessThan(time1); // Cache deve ser mais rápido
        });

        test('deve limpar cache quando necessário', () => {
            const result = classifier.clearCache();
            expect(result).toBe(true);

            const metrics = classifier.getMetrics();
            expect(metrics.cacheSize).toBe(0);
        });
    });

    describe('Auditoria e Logs', () => {
        test('deve registrar histórico de roteamento', async () => {
            const incident = {
                id: 'AUDIT-001',
                title: 'Teste de auditoria',
                description: 'Incidente para teste de auditoria'
            };

            const classification = {
                primaryCategory: {
                    category: 'infrastructure',
                    confidence: 0.7
                },
                classifications: []
            };

            await routingEngine.routeIncident(incident, classification);
            const metrics = routingEngine.getRoutingMetrics();

            expect(metrics.recentRoutings).toBeDefined();
            expect(Array.isArray(metrics.recentRoutings)).toBe(true);
        });
    });
});

describe('Casos de Teste Específicos do Ambiente Bancário', () => {
    let classifier, taggingService, routingEngine;

    beforeEach(() => {
        classifier = new TechnologyClassifier();
        taggingService = new TaggingService();
        routingEngine = new RoutingEngine();
    });

    describe('Cenários Mainframe', () => {
        test('deve classificar erro de compilação COBOL', async () => {
            const incident = {
                id: 'MF-001',
                title: 'Erro de compilação programa PGCONTA',
                description: 'Programa COBOL PGCONTA apresenta erro de compilação. SQLCODE -911 durante bind do package.',
                timestamp: '2024-09-22T08:30:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('mainframe');
            expect(result.classifications.some(c => c.matches.includes('cobol'))).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        test('deve classificar problema em CICS', async () => {
            const incident = {
                id: 'MF-002',
                title: 'CICS transaction abend',
                description: 'Transaction PAYM falhou com DFHAC2001. Terminal user reporta tela em branco.',
                timestamp: '2024-09-22T09:00:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('mainframe');
            expect(result.classifications.some(c => c.matches.includes('cics'))).toBe(true);
        });

        test('deve classificar problema em DB2', async () => {
            const incident = {
                id: 'MF-003',
                title: 'DB2 tablespace full',
                description: 'Tablespace TSACCT01 atingiu 100% de utilização. SQLCODE -904 sendo retornado.',
                timestamp: '2024-09-22T10:15:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('mainframe');
            expect(result.classifications.some(c => c.matches.includes('db2'))).toBe(true);
        });
    });

    describe('Cenários de Pagamentos', () => {
        test('deve priorizar incidentes PIX críticos', async () => {
            const incident = {
                id: 'PAY-001',
                title: 'PIX indisponível para todos os clientes',
                description: 'Sistema PIX completamente fora do ar. Nenhuma transferência sendo processada.',
                timestamp: '2024-09-22T14:30:00Z',
                affectedUsers: 50000
            };

            const classification = await classifier.classifyIncident(incident);
            const routing = await routingEngine.routeIncident(incident, classification);

            expect(classification.primaryCategory.category).toBe('payment-systems');
            expect(routing.routing.team.id).toBe('payments-team');
            expect(routing.routing.sla.response).toBeLessThanOrEqual(5);
            expect(routing.routing.escalationRequired).toBe(true);
        });

        test('deve classificar problemas TED/DOC', async () => {
            const incident = {
                id: 'PAY-002',
                title: 'TED não processando',
                description: 'Transferências TED ficando pendentes no sistema. DOC funcionando normalmente.',
                timestamp: '2024-09-22T11:00:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('payment-systems');
            expect(result.classifications.some(c => c.matches.includes('ted'))).toBe(true);
        });

        test('deve identificar problemas com cartões', async () => {
            const incident = {
                id: 'PAY-003',
                title: 'Cartões de débito recusados',
                description: 'Cartões de débito sendo recusados em comerciantes. Crédito funcionando.',
                timestamp: '2024-09-22T16:45:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('payment-systems');
            expect(result.classifications.some(c => c.matches.includes('cartao'))).toBe(true);
        });
    });

    describe('Cenários Mobile Banking', () => {
        test('deve rotear problemas iOS para horário correto', async () => {
            const incident = {
                id: 'MOB-001',
                title: 'App iOS crashando na abertura',
                description: 'Aplicativo iOS do banco está crashando logo após abertura. Versão 2.3.1',
                source: 'mobile-app',
                timestamp: '2024-09-23T09:30:00Z' // Segunda-feira, horário comercial
            };

            const classification = await classifier.classifyIncident(incident);
            const routing = await routingEngine.routeIncident(incident, classification);

            expect(classification.primaryCategory.category).toBe('mobile-banking');
            expect(routing.routing.team.id).toBe('mobile-team');
        });

        test('deve escalar problema mobile fora do horário', async () => {
            const incident = {
                id: 'MOB-002',
                title: 'App Android com erro crítico',
                description: 'Aplicativo Android não permite login. Usuários não conseguem acessar.',
                source: 'mobile-app',
                timestamp: '2024-09-22T22:30:00Z' // Fora do horário da equipe mobile
            };

            const classification = await classifier.classifyIncident(incident);
            const routing = await routingEngine.routeIncident(incident, classification);

            expect(classification.primaryCategory.category).toBe('mobile-banking');
            // Deve escalar para equipe disponível 24x7
            expect(routing.routing.team.id).not.toBe('mobile-team');
        });
    });

    describe('Cenários ATM', () => {
        test('deve identificar problemas de hardware ATM', async () => {
            const incident = {
                id: 'ATM-001',
                title: 'ATM 12345 fora de serviço',
                description: 'ATM na Av. Paulista apresenta erro de hardware. Display não funciona.',
                source: 'atm',
                timestamp: '2024-09-22T20:00:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('atm-network');
            expect(result.classifications.some(c => c.matches.includes('hardware'))).toBe(true);
        });

        test('deve identificar problemas de comunicação ISO 8583', async () => {
            const incident = {
                id: 'ATM-002',
                title: 'Erro de comunicação ATM rede',
                description: 'Múltiplos ATMs reportando timeout ISO8583. Transações não processam.',
                timestamp: '2024-09-22T19:30:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('atm-network');
            expect(result.classifications.some(c => c.matches.includes('iso8583'))).toBe(true);
        });
    });

    describe('Cenários Core Banking', () => {
        test('deve priorizar problemas críticos core banking', async () => {
            const incident = {
                id: 'CORE-001',
                title: 'Sistema de contas indisponível',
                description: 'Módulo de contas correntes fora do ar. Clientes não conseguem verificar saldos.',
                timestamp: '2024-09-22T10:00:00Z',
                affectedUsers: 100000
            };

            const classification = await classifier.classifyIncident(incident);
            const routing = await routingEngine.routeIncident(incident, classification);

            expect(classification.primaryCategory.category).toBe('core-banking');
            expect(routing.routing.team.id).toBe('core-banking-team');
            expect(routing.routing.sla.response).toBeLessThanOrEqual(10);
            expect(routing.routing.escalationRequired).toBe(true);
        });

        test('deve identificar problemas batch', async () => {
            const incident = {
                id: 'CORE-002',
                title: 'Batch de fechamento falhou',
                description: 'Job de fechamento diário BATCH001 falhou na etapa de consolidação.',
                timestamp: '2024-09-22T03:00:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            expect(result.primaryCategory.category).toBe('core-banking');
            expect(result.classifications.some(c => c.matches.includes('batch'))).toBe(true);
        });
    });

    describe('Cenários de Múltiplas Categorias', () => {
        test('deve identificar incidente cross-platform', async () => {
            const incident = {
                id: 'CROSS-001',
                title: 'Falha na integração PIX-Core Banking',
                description: 'Sistema PIX não consegue debitar contas no core banking. Erro de comunicação SOA.',
                timestamp: '2024-09-22T15:00:00Z'
            };

            const result = await classifier.classifyIncident(incident);

            // Deve identificar múltiplas categorias
            const categories = result.classifications.map(c => c.category);
            expect(categories).toContain('payment-systems');
            expect(categories).toContain('core-banking');
        });

        test('deve rotear incidente complexo para equipe mais específica', async () => {
            const incident = {
                id: 'CROSS-002',
                title: 'Mobile app não mostra saldo PIX',
                description: 'Aplicativo mobile não exibe saldo PIX. Web banking funcionando normalmente.',
                timestamp: '2024-09-22T12:00:00Z'
            };

            const classification = await classifier.classifyIncident(incident);
            const routing = await routingEngine.routeIncident(incident, classification);

            // Deve priorizar mobile por ser mais específico
            expect(classification.primaryCategory.category).toBe('mobile-banking');
            expect(routing.routing.team.id).toBe('mobile-team');
        });
    });

    describe('Cenários de Sazonalidade e Volume', () => {
        test('deve ajustar SLA para alta demanda', async () => {
            const incident = {
                id: 'PEAK-001',
                title: 'Lentidão no internet banking',
                description: 'Portal web apresentando lentidão durante pico de acesso.',
                timestamp: '2024-12-20T18:00:00Z', // Época de alto movimento
                affectedUsers: 25000
            };

            const classification = await classifier.classifyIncident(incident);
            const routing = await routingEngine.routeIncident(incident, classification);

            expect(classification.primaryCategory.category).toBe('internet-banking');
            expect(routing.routing.team.id).toBe('web-team');

            // SLA pode ser ajustado para períodos de pico
            expect(routing.routing.sla.response).toBeDefined();
        });
    });
});

// Helper functions para testes
function generateTestIncident(type, severity = 'medium') {
    const templates = {
        mainframe: {
            title: 'Erro no mainframe',
            description: 'Sistema mainframe com problema COBOL',
            keywords: ['mainframe', 'cobol', 'abend']
        },
        payment: {
            title: 'Problema no PIX',
            description: 'Sistema PIX apresentando falhas',
            keywords: ['pix', 'pagamento', 'transferencia']
        },
        mobile: {
            title: 'App mobile não funciona',
            description: 'Aplicativo mobile com erro',
            keywords: ['mobile', 'app', 'smartphone']
        }
    };

    const template = templates[type];
    return {
        id: `TEST-${Date.now()}`,
        title: template.title,
        description: template.description,
        timestamp: new Date().toISOString(),
        severity
    };
}

function expectValidClassification(result) {
    expect(result).toBeDefined();
    expect(result.primaryCategory).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.classifications)).toBe(true);
}

function expectValidRouting(result) {
    expect(result).toBeDefined();
    expect(result.routing).toBeDefined();
    expect(result.routing.team).toBeDefined();
    expect(result.routing.team.id).toBeDefined();
    expect(result.routing.sla).toBeDefined();
    expect(result.routing.sla.response).toBeGreaterThan(0);
}

module.exports = {
    generateTestIncident,
    expectValidClassification,
    expectValidRouting
};