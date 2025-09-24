/**
 * Testes para o Sistema de Auditoria
 * Validações de compliance, integridade e performance
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const AuditService = require('../../src/services/audit-logging/AuditService');
const LogAnalytics = require('../../src/services/audit-logging/LogAnalytics');
const ComplianceReporter = require('../../src/services/audit-logging/ComplianceReporter');
const RetentionManager = require('../../src/services/audit-logging/RetentionManager');
const CryptoManager = require('../../src/services/audit-logging/utils/CryptoManager');

// Mock das dependências
jest.mock('winston');
jest.mock('winston-daily-rotate-file');

describe('Sistema de Auditoria', () => {
    let auditService;
    let logAnalytics;
    let complianceReporter;
    let retentionManager;
    let cryptoManager;

    beforeEach(() => {
        // Configura mocks dos loggers
        const mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        };

        // Inicializa serviços
        auditService = new AuditService({
            enableEncryption: false, // Desabilita para testes
            retentionDays: 30
        });

        // Mock dos loggers
        auditService.auditLogger = mockLogger;
        auditService.performanceLogger = mockLogger;
        auditService.complianceLogger = mockLogger;

        logAnalytics = new LogAnalytics(auditService, {
            analysisInterval: 1000 // Reduz intervalo para testes
        });

        complianceReporter = new ComplianceReporter(auditService, logAnalytics, {
            autoSchedule: false // Desabilita agendamento automático
        });

        retentionManager = new RetentionManager(auditService, {
            automaticCleanup: false // Desabilita limpeza automática
        });

        cryptoManager = new CryptoManager({
            enableKeyEscrow: false // Desabilita key escrow para testes
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (logAnalytics) logAnalytics.stop();
        if (complianceReporter) complianceReporter.stop();
        if (retentionManager) retentionManager.stop();
        if (cryptoManager) cryptoManager.secureCleanup();
    });

    describe('AuditService', () => {
        describe('Logging de Interações LLM', () => {
            test('deve registrar interação LLM completa', async () => {
                const llmData = {
                    incidentId: 'INC-001',
                    operatorId: 'OP-001',
                    provider: 'openai',
                    model: 'gpt-4',
                    prompt: 'Analise este incidente bancário',
                    response: 'Baseado na análise...',
                    inputTokens: 100,
                    outputTokens: 150,
                    estimatedCost: 0.05,
                    confidence: 0.85,
                    executionTime: 2000,
                    classification: 'CONFIDENTIAL'
                };

                const auditEntry = await auditService.logLLMInteraction(llmData);

                expect(auditEntry).toBeDefined();
                expect(auditEntry.eventType).toBe('LLM_INTERACTION');
                expect(auditEntry.incidentId).toBe(llmData.incidentId);
                expect(auditEntry.llmProvider).toBe(llmData.provider);
                expect(auditEntry.confidence).toBe(llmData.confidence);
                expect(auditEntry.compliance).toBeDefined();
                expect(auditEntry.compliance.dataClassification).toContain('CONFIDENTIAL');
            });

            test('deve sanitizar dados sensíveis', async () => {
                const sensitiveData = {
                    incidentId: 'INC-002',
                    operatorId: 'OP-001',
                    provider: 'openai',
                    model: 'gpt-4',
                    prompt: {
                        text: 'Analise conta',
                        cpf: '12345678901',
                        account: '1234567-8'
                    },
                    response: 'Análise concluída',
                    inputTokens: 50,
                    outputTokens: 75,
                    confidence: 0.9,
                    executionTime: 1500,
                    classification: 'RESTRICTED'
                };

                const auditEntry = await auditService.logLLMInteraction(sensitiveData);

                // Verifica se dados sensíveis foram sanitizados
                expect(auditEntry.prompt.cpf).not.toBe('12345678901');
                expect(auditEntry.prompt.account).not.toBe('1234567-8');
            });

            test('deve classificar adequadamente o impacto regulatório', async () => {
                const financialData = {
                    incidentId: 'INC-003',
                    operatorId: 'OP-001',
                    provider: 'anthropic',
                    model: 'claude-3',
                    prompt: {
                        transaction: 'PIX de R$ 10.000',
                        account: '9999-1'
                    },
                    response: 'Transação aprovada',
                    inputTokens: 75,
                    outputTokens: 25,
                    confidence: 0.95,
                    executionTime: 1200,
                    classification: 'FINANCIAL'
                };

                const auditEntry = await auditService.logLLMInteraction(financialData);

                expect(auditEntry.compliance.regulatoryImpact).toContain('BACEN');
                expect(auditEntry.compliance.approvalRequired).toBe(true);
            });
        });

        describe('Logging de Ações de Operador', () => {
            test('deve registrar ação manual do operador', async () => {
                const operatorData = {
                    incidentId: 'INC-004',
                    operatorId: 'OP-002',
                    action: 'MANUAL_OVERRIDE',
                    description: 'Override de limite de transação',
                    beforeState: { limit: 1000 },
                    afterState: { limit: 5000 },
                    justification: 'Cliente VIP solicitou aumento emergencial',
                    ipAddress: '192.168.1.100',
                    userAgent: 'Mozilla/5.0...',
                    sessionId: 'sess-123',
                    authMethod: 'MFA',
                    executionTime: 30000,
                    impact: {
                        severity: 'HIGH',
                        affectedSystems: ['CORE_BANKING'],
                        businessImpact: 'HIGH'
                    },
                    approvedBy: 'MGR-001',
                    approvalTimestamp: new Date().toISOString()
                };

                const auditEntry = await auditService.logOperatorAction(operatorData);

                expect(auditEntry.eventType).toBe('OPERATOR_ACTION');
                expect(auditEntry.operatorId).toBe(operatorData.operatorId);
                expect(auditEntry.action).toBe(operatorData.action);
                expect(auditEntry.impact.severity).toBe('HIGH');
                expect(auditEntry.compliance.requiresApproval).toBe(true);
                expect(auditEntry.compliance.approvedBy).toBe('MGR-001');
            });

            test('deve detectar ações que requerem aprovação', async () => {
                const criticalAction = {
                    incidentId: 'INC-005',
                    operatorId: 'OP-003',
                    action: 'SYSTEM_SHUTDOWN',
                    description: 'Desligamento emergencial do sistema',
                    justification: 'Ameaça de segurança detectada',
                    ipAddress: '10.0.0.50',
                    authMethod: 'TOKEN',
                    impact: {
                        severity: 'CRITICAL',
                        affectedSystems: ['ALL'],
                        businessImpact: 'CRITICAL'
                    }
                };

                const auditEntry = await auditService.logOperatorAction(criticalAction);

                expect(auditEntry.compliance.requiresApproval).toBe(true);
                expect(auditEntry.compliance.regulatoryCategory).toBe('OPERATIONAL');
            });
        });

        describe('Logging de Decisões do Sistema', () => {
            test('deve registrar decisão automática', async () => {
                const systemDecision = {
                    incidentId: 'INC-006',
                    engine: 'FRAUD_DETECTION',
                    algorithm: 'RANDOM_FOREST',
                    version: '2.1.0',
                    inputs: {
                        transactionAmount: 50000,
                        accountHistory: 'clean',
                        location: 'BR'
                    },
                    decision: 'APPROVE',
                    confidence: 0.92,
                    reasoning: 'Transaction pattern matches historical behavior',
                    alternatives: [
                        { decision: 'REVIEW', confidence: 0.07 },
                        { decision: 'REJECT', confidence: 0.01 }
                    ],
                    executionTime: 150,
                    accuracy: 0.95,
                    precision: 0.94,
                    recall: 0.96
                };

                const auditEntry = await auditService.logSystemDecision(systemDecision);

                expect(auditEntry.eventType).toBe('SYSTEM_DECISION');
                expect(auditEntry.decisionEngine).toBe('FRAUD_DETECTION');
                expect(auditEntry.confidence).toBe(0.92);
                expect(auditEntry.reasoning).toBeDefined();
                expect(auditEntry.compliance.explainabilityScore).toBeGreaterThan(0);
                expect(auditEntry.compliance.biasAssessment).toBeDefined();
                expect(auditEntry.compliance.fairnessMetrics).toBeDefined();
            });
        });

        describe('Métricas de SLA', () => {
            test('deve registrar métricas de SLA', async () => {
                const slaData = {
                    incidentId: 'INC-007',
                    slaType: 'RESPONSE_TIME',
                    target: 300000, // 5 minutos
                    actual: 180000, // 3 minutos
                    severity: 'MEDIUM',
                    category: 'TECHNICAL',
                    responseTime: 180000,
                    resolutionTime: 1800000,
                    customerImpact: 'LOW',
                    businessImpact: 'MEDIUM',
                    regulatoryDeadline: new Date(Date.now() + 86400000).toISOString()
                };

                const auditEntry = await auditService.logSLAMetrics(slaData);

                expect(auditEntry.eventType).toBe('SLA_METRICS');
                expect(auditEntry.breach).toBe(false);
                expect(auditEntry.compliance.complianceStatus).toBe('COMPLIANT');
            });

            test('deve detectar violação de SLA', async () => {
                const slaViolation = {
                    incidentId: 'INC-008',
                    slaType: 'RESOLUTION_TIME',
                    target: 3600000, // 1 hora
                    actual: 7200000, // 2 horas
                    severity: 'HIGH',
                    category: 'CRITICAL',
                    customerImpact: 'HIGH',
                    businessImpact: 'HIGH'
                };

                const auditEntry = await auditService.logSLAMetrics(slaViolation);

                expect(auditEntry.breach).toBe(true);
                expect(auditEntry.compliance.complianceStatus).toBe('BREACH');
                expect(auditService.auditMetrics.criticalEvents).toBeGreaterThan(0);
            });
        });

        describe('Audit Trail', () => {
            test('deve criar audit trail completo', async () => {
                const auditData = {
                    operatorId: 'OP-004',
                    description: 'Alteração de configuração crítica',
                    justification: 'Melhoria de performance solicitada',
                    method: 'API',
                    location: 'CONFIG_SERVICE',
                    previousValue: { timeout: 30 },
                    newValue: { timeout: 60 },
                    changeReason: 'Otimização de performance',
                    approvals: [{
                        approvedBy: 'MGR-002',
                        approvalTimestamp: new Date().toISOString(),
                        approvalReason: 'Melhoria necessária'
                    }]
                };

                const trail = await auditService.createAuditTrail(
                    'INC-009',
                    'CONFIG_CHANGE',
                    auditData
                );

                expect(trail.trailId).toBeDefined();
                expect(trail.incidentId).toBe('INC-009');
                expect(trail.action).toBe('CONFIG_CHANGE');
                expect(trail.who).toBe('OP-004');
                expect(trail.digitalSignature).toBeDefined();
                expect(trail.checksum).toBeDefined();
                expect(trail.compliance).toBeDefined();
            });
        });

        describe('Busca e Exportação', () => {
            test('deve buscar logs por critérios', async () => {
                // Adiciona alguns logs de teste
                await auditService.logOperatorAction({
                    incidentId: 'INC-010',
                    operatorId: 'OP-005',
                    action: 'TEST_ACTION',
                    description: 'Ação de teste',
                    justification: 'Teste',
                    ipAddress: '127.0.0.1',
                    authMethod: 'PASSWORD',
                    impact: { severity: 'LOW', businessImpact: 'LOW' }
                });

                const results = await auditService.searchLogs({
                    operatorId: 'OP-005',
                    eventType: 'OPERATOR_ACTION'
                });

                expect(results.results).toBeDefined();
                expect(results.total).toBeGreaterThan(0);
                expect(results.criteria).toEqual({
                    operatorId: 'OP-005',
                    eventType: 'OPERATOR_ACTION'
                });
            });

            test('deve exportar logs para compliance', async () => {
                const startDate = new Date(Date.now() - 86400000); // 24h atrás
                const endDate = new Date();

                const exportData = await auditService.exportForCompliance(
                    startDate,
                    endDate,
                    'json'
                );

                expect(exportData.exportId).toBeDefined();
                expect(exportData.period.startDate).toBe(startDate);
                expect(exportData.period.endDate).toBe(endDate);
                expect(exportData.format).toBe('json');
                expect(exportData.logs).toBeDefined();
                expect(exportData.metadata).toBeDefined();
            });
        });

        describe('Métricas', () => {
            test('deve fornecer métricas do sistema', () => {
                const metrics = auditService.getMetrics();

                expect(metrics.totalEvents).toBeDefined();
                expect(metrics.criticalEvents).toBeDefined();
                expect(metrics.complianceViolations).toBeDefined();
                expect(metrics.performanceMetrics).toBeDefined();
                expect(metrics.bufferSize).toBeDefined();
                expect(metrics.sessionId).toBeDefined();
                expect(metrics.uptime).toBeDefined();
            });
        });
    });

    describe('LogAnalytics', () => {
        test('deve processar nova entrada em tempo real', () => {
            const entry = {
                eventType: 'LLM_INTERACTION',
                timestamp: new Date().toISOString(),
                executionTime: 1500,
                confidence: 0.8
            };

            // Simula entrada de auditoria
            logAnalytics.processNewEntry(entry);

            // Verifica se métricas foram atualizadas
            const dayKey = new Date().toISOString().split('T')[0];
            expect(logAnalytics.analytics.realTimeMetrics[dayKey]).toBeDefined();
            expect(logAnalytics.analytics.realTimeMetrics[dayKey].totalEvents).toBeGreaterThan(0);
        });

        test('deve detectar anomalias de performance', () => {
            const slowEntry = {
                eventType: 'SYSTEM_DECISION',
                timestamp: new Date().toISOString(),
                executionTime: 10000, // 10 segundos - muito lento
                confidence: 0.9
            };

            const anomaliesBefore = logAnalytics.analytics.alerts.length;
            logAnalytics.processNewEntry(slowEntry);
            const anomaliesAfter = logAnalytics.analytics.alerts.length;

            expect(anomaliesAfter).toBeGreaterThan(anomaliesBefore);
        });

        test('deve gerar insights automáticos', () => {
            // Simula dados de baixa compliance
            logAnalytics.analytics.trendData.resolutionMetrics = {
                slaCompliance: 0.85 // Abaixo do target de 0.98
            };

            const insights = logAnalytics.generateInsights();

            expect(insights).toBeDefined();
            expect(insights.length).toBeGreaterThan(0);
            expect(insights.some(i => i.type === 'PERFORMANCE')).toBe(true);
        });

        test('deve exportar relatório de analytics', () => {
            const report = logAnalytics.exportAnalyticsReport();

            expect(report.reportId).toBeDefined();
            expect(report.timestamp).toBeDefined();
            expect(report.data).toBeDefined();
            expect(report.summary).toBeDefined();
        });
    });

    describe('ComplianceReporter', () => {
        test('deve gerar relatório SOX', async () => {
            const period = {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString()
            };

            const report = await complianceReporter.generateSOXReport(period);

            expect(report.reportId).toBeDefined();
            expect(report.regulation).toBe('SOX');
            expect(report.filePath).toBeDefined();
            expect(report.metadata).toBeDefined();
        });

        test('deve calcular período de relatório corretamente', () => {
            const period = complianceReporter.calculateReportingPeriod('quarterly');

            expect(period.start).toBeDefined();
            expect(period.end).toBeDefined();
            expect(new Date(period.end)).toBeInstanceOf(Date);
            expect(new Date(period.start)).toBeInstanceOf(Date);
        });
    });

    describe('RetentionManager', () => {
        test('deve determinar ação de retenção correta', () => {
            const fileAge30 = 30; // dias
            const fileAge400 = 400; // dias
            const retentionDays = 365;
            const archiveThreshold = 90;

            const action30 = retentionManager.determineRetentionAction(
                fileAge30, retentionDays, archiveThreshold
            );
            const action400 = retentionManager.determineRetentionAction(
                fileAge400, retentionDays, archiveThreshold
            );

            expect(action30).toBe('RETAIN');
            expect(action400).toBe('DELETE');
        });

        test('deve calcular idade do arquivo', () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const age = retentionManager.calculateFileAge(yesterday.toISOString());

            expect(age).toBe(1);
        });

        test('deve calcular expiração de retenção', () => {
            const expiry = retentionManager.calculateRetentionExpiry('FINANCIAL');
            const expiryDate = new Date(expiry);
            const now = new Date();

            expect(expiryDate).toBeInstanceOf(Date);
            expect(expiryDate > now).toBe(true);
        });

        test('deve gerar relatório de retenção', () => {
            const report = retentionManager.generateRetentionReport();

            expect(report.reportId).toBeDefined();
            expect(report.timestamp).toBeDefined();
            expect(report.status).toBeDefined();
            expect(report.policies).toBeDefined();
            expect(report.archives).toBeDefined();
            expect(report.recommendations).toBeDefined();
        });
    });

    describe('CryptoManager', () => {
        test('deve criptografar e descriptografar dados', async () => {
            const originalData = {
                message: 'Dados sensíveis de teste',
                cpf: '12345678901'
            };

            const encrypted = await cryptoManager.encryptSensitiveData(
                originalData,
                'CONFIDENTIAL'
            );
            const decrypted = await cryptoManager.decryptSensitiveData(encrypted);

            expect(encrypted.encrypted).toBe(true);
            expect(encrypted.algorithm).toBeDefined();
            expect(encrypted.classification).toBe('CONFIDENTIAL');
            expect(decrypted).toEqual(originalData);
        });

        test('deve calcular hash para integridade', () => {
            const data = 'teste de integridade';
            const hash1 = cryptoManager.calculateHash(data);
            const hash2 = cryptoManager.calculateHash(data);

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256
        });

        test('deve criar e verificar assinatura digital', async () => {
            const data = 'documento importante';
            const signature = await cryptoManager.createDigitalSignature(data);
            const verification = await cryptoManager.verifyDigitalSignature(data, signature);

            expect(signature.algorithm).toBe('sha256');
            expect(signature.hash).toBeDefined();
            expect(verification.valid).toBe(true);
        });

        test('deve gerar token seguro', () => {
            const token = cryptoManager.generateSecureToken(32);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.length).toBeGreaterThan(0);
        });

        test('deve derivar chave para propósito específico', () => {
            const key1 = cryptoManager.deriveKeyForPurpose('audit-logs');
            const key2 = cryptoManager.deriveKeyForPurpose('audit-logs');
            const key3 = cryptoManager.deriveKeyForPurpose('different-purpose');

            expect(key1).toEqual(key2);
            expect(key1).not.toEqual(key3);
        });

        test('deve fornecer status do sistema', () => {
            const status = cryptoManager.getStatus();

            expect(status.masterKeyId).toBeDefined();
            expect(status.algorithm).toBeDefined();
            expect(status.systemHealth).toBe('OPERATIONAL');
        });
    });

    describe('Integração entre Componentes', () => {
        test('deve funcionar em fluxo completo de auditoria', async () => {
            // 1. Log de interação LLM
            const llmEntry = await auditService.logLLMInteraction({
                incidentId: 'INC-INTEGRATION',
                operatorId: 'OP-INTEGRATION',
                provider: 'openai',
                model: 'gpt-4',
                prompt: 'Análise de fraude',
                response: 'Não detectada',
                inputTokens: 50,
                outputTokens: 25,
                confidence: 0.95,
                executionTime: 1200,
                classification: 'FINANCIAL'
            });

            // 2. Analytics processa entrada
            logAnalytics.processNewEntry(llmEntry);

            // 3. Verifica se métricas foram atualizadas
            const metrics = auditService.getMetrics();
            expect(metrics.totalEvents).toBeGreaterThan(0);

            // 4. Gera relatório de compliance
            const period = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString()
            };

            const report = await complianceReporter.generateSOXReport(period);
            expect(report.reportId).toBeDefined();

            // 5. Exporta para compliance
            const exportData = await auditService.exportForCompliance(
                new Date(period.start),
                new Date(period.end),
                'json'
            );
            expect(exportData.logs).toBeDefined();
        });

        test('deve detectar e reportar violações de compliance', async () => {
            // Simula ação crítica sem aprovação
            const unauthorizedAction = await auditService.logOperatorAction({
                incidentId: 'INC-VIOLATION',
                operatorId: 'OP-VIOLATION',
                action: 'CRITICAL_SYSTEM_CHANGE',
                description: 'Mudança crítica sem aprovação',
                justification: 'Emergência',
                ipAddress: '192.168.1.200',
                authMethod: 'PASSWORD',
                impact: {
                    severity: 'CRITICAL',
                    businessImpact: 'HIGH'
                }
                // Nota: sem approvedBy - violação
            });

            // Analytics deve detectar
            logAnalytics.processNewEntry(unauthorizedAction);

            // Deve gerar alerta
            expect(logAnalytics.analytics.alerts.length).toBeGreaterThan(0);

            // Deve aparecer em insights
            const insights = logAnalytics.generateInsights();
            expect(insights.some(i => i.severity === 'CRITICAL')).toBe(true);
        });
    });

    describe('Performance e Escalabilidade', () => {
        test('deve processar grande volume de logs', async () => {
            const startTime = Date.now();
            const logCount = 1000;

            // Gera muitos logs
            const promises = Array.from({ length: logCount }, (_, i) =>
                auditService.logOperatorAction({
                    incidentId: `INC-PERF-${i}`,
                    operatorId: `OP-PERF-${i}`,
                    action: 'PERFORMANCE_TEST',
                    description: `Log de performance ${i}`,
                    justification: 'Teste de performance',
                    ipAddress: '127.0.0.1',
                    authMethod: 'TOKEN',
                    executionTime: Math.random() * 1000,
                    impact: {
                        severity: 'LOW',
                        businessImpact: 'LOW'
                    }
                })
            );

            await Promise.all(promises);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Deve processar em tempo razoável (< 10 segundos)
            expect(duration).toBeLessThan(10000);

            // Verifica se todos foram registrados
            const metrics = auditService.getMetrics();
            expect(metrics.totalEvents).toBeGreaterThanOrEqual(logCount);
        });

        test('deve manter buffer dentro dos limites', async () => {
            const maxBufferSize = auditService.maxBufferSize;

            // Gera mais logs que o tamanho do buffer
            for (let i = 0; i < maxBufferSize + 100; i++) {
                await auditService.logOperatorAction({
                    incidentId: `INC-BUFFER-${i}`,
                    operatorId: 'OP-BUFFER',
                    action: 'BUFFER_TEST',
                    description: 'Teste de buffer',
                    justification: 'Teste',
                    ipAddress: '127.0.0.1',
                    authMethod: 'TOKEN',
                    impact: { severity: 'LOW', businessImpact: 'LOW' }
                });
            }

            // Buffer não deve exceder o limite
            expect(auditService.logBuffer.length).toBeLessThanOrEqual(maxBufferSize);
        });
    });
});

describe('Validação de Schemas', () => {
    const AuditSchema = require('../../src/services/audit-logging/models/AuditSchema');

    test('deve validar entrada de auditoria LLM', () => {
        const validEntry = {
            eventType: 'LLM_INTERACTION',
            timestamp: new Date().toISOString(),
            incidentId: '123e4567-e89b-12d3-a456-426614174000',
            llmProvider: 'openai',
            model: 'gpt-4',
            prompt: 'teste',
            response: 'resposta',
            tokens: { input: 10, output: 15 },
            confidence: 0.8,
            classification: 'INTERNAL',
            compliance: {
                dataClassification: ['PUBLIC'],
                approvalRequired: false,
                regulatoryImpact: []
            },
            controlData: {
                sequence: 1,
                checksum: 'a'.repeat(64),
                signature: {
                    algorithm: 'sha256',
                    hash: 'b'.repeat(64),
                    timestamp: new Date().toISOString(),
                    signedBy: 'system'
                }
            }
        };

        expect(() => {
            AuditSchema.validateAuditEntry(validEntry);
        }).not.toThrow();
    });

    test('deve rejeitar entrada inválida', () => {
        const invalidEntry = {
            eventType: 'INVALID_TYPE', // Tipo inválido
            timestamp: 'invalid-date', // Data inválida
            // Campos obrigatórios faltando
        };

        expect(() => {
            AuditSchema.validateAuditEntry(invalidEntry);
        }).toThrow();
    });

    test('deve sanitizar dados sensíveis', () => {
        const sensitiveData = {
            cpf: '12345678901',
            password: 'secret123',
            account: '1234567-8',
            normalField: 'normal value'
        };

        const sanitized = AuditSchema.sanitizeForLogging(sensitiveData);

        expect(sanitized.cpf).toBe('[SANITIZED]');
        expect(sanitized.password).toBe('[SANITIZED]');
        expect(sanitized.account).toBe('[SANITIZED]');
        expect(sanitized.normalField).toBe('normal value');
    });

    test('deve criar template de entrada válido', () => {
        const template = AuditSchema.createAuditEntryTemplate('LLM_INTERACTION');

        expect(template.eventType).toBe('LLM_INTERACTION');
        expect(template.timestamp).toBeDefined();
        expect(template.incidentId).toBeDefined();
        expect(template.llmProvider).toBeDefined();
        expect(template.compliance).toBeDefined();
    });
});