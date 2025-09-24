/**
 * Framework de A/B Testing
 *
 * Sistema especializado para validação de melhorias através de
 * testes A/B controlados com análise estatística rigorosa.
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class ABTestingFramework extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Configurações de teste
            defaultDuration: config.defaultDuration || 7 * 24 * 60 * 60 * 1000, // 7 dias
            minSampleSize: config.minSampleSize || 100,
            maxConcurrentTests: config.maxConcurrentTests || 5,
            significanceLevel: config.significanceLevel || 0.05,

            // Configurações de divisão de tráfego
            defaultTrafficSplit: config.defaultTrafficSplit || 0.1, // 10% para teste
            maxTrafficSplit: config.maxTrafficSplit || 0.5, // máximo 50%

            // Configurações de métricas
            primaryMetrics: config.primaryMetrics || ['success_rate', 'satisfaction_score', 'resolution_time'],
            secondaryMetrics: config.secondaryMetrics || ['user_engagement', 'operator_efficiency'],

            // Configurações de segurança
            earlyStoppingEnabled: config.earlyStoppingEnabled || true,
            maxNegativeImpact: config.maxNegativeImpact || -0.1, // -10%
            guardRailsEnabled: config.guardRailsEnabled || true,

            ...config
        };

        // Estado do framework
        this.state = {
            activeTests: new Map(),
            completedTests: [],
            testHistory: [],
            trafficAllocations: new Map()
        };

        // Métricas do framework
        this.metrics = {
            totalTests: 0,
            successfulTests: 0,
            avgTestDuration: 0,
            avgImprovementRate: 0,
            earlyStoppedTests: 0
        };

        // Configurações estatísticas
        this.statistics = {
            confidenceLevels: [0.90, 0.95, 0.99],
            effectSizes: {
                small: 0.02,
                medium: 0.05,
                large: 0.08
            },
            powerAnalysis: {
                targetPower: 0.8,
                minimumDetectableEffect: 0.03
            }
        };
    }

    /**
     * Inicializa o framework de A/B testing
     */
    async initialize() {
        try {
            logger.info('Inicializando framework de A/B testing');

            // Carregar configurações de testes ativos
            await this.loadActiveTests();

            // Inicializar sistema de métricas
            await this.initializeMetricsSystem();

            // Configurar coletores de dados
            await this.setupDataCollectors();

            // Inicializar sistema de alertas
            await this.initializeAlertingSystem();

            logger.info('Framework de A/B testing inicializado com sucesso');

        } catch (error) {
            logger.error('Erro ao inicializar framework de A/B testing:', error);
            throw error;
        }
    }

    /**
     * Cria um novo teste A/B
     */
    async createABTest(config) {
        try {
            // Validar configuração do teste
            this.validateTestConfig(config);

            // Verificar se há slots disponíveis
            if (this.state.activeTests.size >= this.config.maxConcurrentTests) {
                throw new Error('Número máximo de testes concorrentes atingido');
            }

            // Verificar conflitos de tráfego
            await this.checkTrafficConflicts(config.trafficSplit);

            const testId = this.generateTestId();
            const startTime = new Date();

            const test = {
                id: testId,
                name: config.name,
                description: config.description,
                hypothesis: config.hypothesis,

                // Configurações do teste
                trafficSplit: config.trafficSplit || this.config.defaultTrafficSplit,
                duration: config.duration || this.config.defaultDuration,
                endTime: new Date(startTime.getTime() + (config.duration || this.config.defaultDuration)),

                // Variantes
                controlVariant: {
                    id: 'control',
                    name: 'Control (Current)',
                    description: 'Current system behavior',
                    config: config.controlConfig || {}
                },
                testVariant: {
                    id: 'test',
                    name: config.testVariantName || 'Test Variant',
                    description: config.testVariantDescription || 'New system behavior',
                    config: config.testConfig
                },

                // Métricas
                primaryMetrics: config.primaryMetrics || this.config.primaryMetrics,
                secondaryMetrics: config.secondaryMetrics || this.config.secondaryMetrics,
                successCriteria: config.successCriteria,

                // Configurações de análise
                significanceLevel: config.significanceLevel || this.config.significanceLevel,
                minimumSampleSize: config.minSampleSize || this.config.minSampleSize,

                // Estado
                status: 'initializing',
                startTime,
                createdBy: config.createdBy,

                // Dados coletados
                data: {
                    control: { samples: 0, metrics: {} },
                    test: { samples: 0, metrics: {} }
                },

                // Análises
                statisticalAnalysis: null,
                currentSignificance: null,
                powerAnalysis: null,

                // Flags de controle
                earlyStoppingTriggered: false,
                guardRailsViolated: false,

                // Alertas e observações
                alerts: [],
                observations: []
            };

            // Calcular sample size necessário
            test.requiredSampleSize = this.calculateRequiredSampleSize(test);

            // Configurar coleta de dados
            await this.setupTestDataCollection(test);

            // Alocar tráfego
            await this.allocateTraffic(test);

            // Iniciar teste
            test.status = 'running';

            // Armazenar teste
            this.state.activeTests.set(testId, test);

            // Agendar análises periódicas
            this.schedulePeriodicAnalysis(test);

            // Agendar finalização automática
            this.scheduleTestCompletion(test);

            // Atualizar métricas
            this.metrics.totalTests++;

            logger.info(`Teste A/B criado: ${testId} - ${test.name}`);

            this.emit('testCreated', test);

            return test;

        } catch (error) {
            logger.error('Erro ao criar teste A/B:', error);
            throw error;
        }
    }

    /**
     * Registra dados para um teste A/B
     */
    async recordTestData(incidentId, variant, metrics) {
        try {
            // Encontrar teste ativo para este incidente
            const test = this.findActiveTestForIncident(incidentId);
            if (!test) return;

            // Validar variante
            if (!['control', 'test'].includes(variant)) {
                throw new Error(`Variante inválida: ${variant}`);
            }

            // Registrar dados
            const variantData = test.data[variant];
            variantData.samples++;

            // Atualizar métricas
            for (const [metricName, value] of Object.entries(metrics)) {
                if (!variantData.metrics[metricName]) {
                    variantData.metrics[metricName] = {
                        values: [],
                        sum: 0,
                        mean: 0,
                        variance: 0,
                        count: 0
                    };
                }

                const metric = variantData.metrics[metricName];
                metric.values.push(value);
                metric.sum += value;
                metric.count++;
                metric.mean = metric.sum / metric.count;

                // Calcular variância online (Welford's algorithm)
                if (metric.count > 1) {
                    const delta = value - metric.mean;
                    metric.variance = ((metric.count - 2) * metric.variance + delta * delta) / (metric.count - 1);
                }
            }

            // Verificar se deve executar análise intermediária
            if (this.shouldRunIntermediateAnalysis(test)) {
                await this.runIntermediateAnalysis(test);
            }

            this.emit('dataRecorded', {
                testId: test.id,
                variant,
                incidentId,
                metrics
            });

        } catch (error) {
            logger.error('Erro ao registrar dados do teste:', error);
        }
    }

    /**
     * Executa análise estatística de um teste
     */
    async analyzeTest(testId) {
        try {
            const test = this.state.activeTests.get(testId);
            if (!test) {
                throw new Error(`Teste ${testId} não encontrado`);
            }

            logger.info(`Analisando teste: ${testId}`);

            const analysis = {
                testId,
                timestamp: new Date(),
                sampleSizes: {
                    control: test.data.control.samples,
                    test: test.data.test.samples
                },
                metrics: {},
                overallSignificance: null,
                recommendation: null,
                confidenceIntervals: {},
                effectSizes: {}
            };

            // Analisar cada métrica
            for (const metricName of test.primaryMetrics) {
                const metricAnalysis = await this.analyzeMetric(test, metricName);
                analysis.metrics[metricName] = metricAnalysis;
            }

            // Calcular significância geral
            analysis.overallSignificance = this.calculateOverallSignificance(analysis.metrics);

            // Calcular power do teste
            analysis.powerAnalysis = this.calculateTestPower(test, analysis);

            // Verificar critérios de parada antecipada
            const earlyStoppingDecision = this.checkEarlyStoppingCriteria(test, analysis);

            // Gerar recomendação
            analysis.recommendation = this.generateRecommendation(test, analysis, earlyStoppingDecision);

            // Atualizar teste com análise
            test.statisticalAnalysis = analysis;
            test.currentSignificance = analysis.overallSignificance;

            // Verificar guard rails
            await this.checkGuardRails(test, analysis);

            logger.info(`Análise concluída para teste ${testId} - Significância: ${analysis.overallSignificance?.toFixed(4)}`);

            this.emit('testAnalyzed', { test, analysis });

            return analysis;

        } catch (error) {
            logger.error(`Erro ao analisar teste ${testId}:`, error);
            throw error;
        }
    }

    /**
     * Finaliza um teste A/B
     */
    async finalizeTest(testId, reason = 'completed') {
        try {
            const test = this.state.activeTests.get(testId);
            if (!test) {
                throw new Error(`Teste ${testId} não encontrado`);
            }

            logger.info(`Finalizando teste: ${testId} - Razão: ${reason}`);

            // Executar análise final
            const finalAnalysis = await this.analyzeTest(testId);

            // Gerar relatório final
            const finalReport = await this.generateFinalReport(test, finalAnalysis, reason);

            // Atualizar status
            test.status = 'completed';
            test.endTime = new Date();
            test.completionReason = reason;
            test.finalAnalysis = finalAnalysis;
            test.finalReport = finalReport;

            // Desalocar tráfego
            await this.deallocateTraffic(test);

            // Mover para histórico
            this.state.completedTests.push(test);
            this.state.activeTests.delete(testId);

            // Atualizar métricas
            if (finalAnalysis.recommendation === 'deploy') {
                this.metrics.successfulTests++;
            }

            const duration = test.endTime - test.startTime;
            this.metrics.avgTestDuration = (this.metrics.avgTestDuration * (this.metrics.totalTests - 1) + duration) / this.metrics.totalTests;

            logger.info(`Teste ${testId} finalizado com sucesso`);

            this.emit('testFinalized', { test, finalAnalysis, finalReport, reason });

            return finalReport;

        } catch (error) {
            logger.error(`Erro ao finalizar teste ${testId}:`, error);
            throw error;
        }
    }

    /**
     * Para um teste A/B antecipadamente
     */
    async stopTest(testId, reason) {
        try {
            const test = this.state.activeTests.get(testId);
            if (!test) {
                throw new Error(`Teste ${testId} não encontrado`);
            }

            if (reason === 'early_stopping') {
                test.earlyStoppingTriggered = true;
            } else if (reason === 'guard_rails') {
                test.guardRailsViolated = true;
            }

            await this.finalizeTest(testId, reason);

            logger.info(`Teste ${testId} parado antecipadamente: ${reason}`);

        } catch (error) {
            logger.error(`Erro ao parar teste ${testId}:`, error);
            throw error;
        }
    }

    /**
     * Gera relatório detalhado de um teste
     */
    async generateFinalReport(test, analysis, completionReason) {
        const report = {
            testInfo: {
                id: test.id,
                name: test.name,
                description: test.description,
                hypothesis: test.hypothesis,
                duration: test.endTime - test.startTime,
                completionReason
            },

            configuration: {
                trafficSplit: test.trafficSplit,
                primaryMetrics: test.primaryMetrics,
                secondaryMetrics: test.secondaryMetrics,
                significanceLevel: test.significanceLevel
            },

            results: {
                sampleSizes: analysis.sampleSizes,
                overallSignificance: analysis.overallSignificance,
                recommendation: analysis.recommendation,
                confidenceLevel: 1 - test.significanceLevel
            },

            metricResults: {},
            statisticalTests: {},
            businessImpact: {},

            conclusions: {
                primaryHypothesis: this.evaluateHypothesis(test, analysis),
                keyFindings: this.extractKeyFindings(test, analysis),
                limitations: this.identifyLimitations(test, analysis),
                recommendations: this.generateBusinessRecommendations(test, analysis)
            },

            appendix: {
                rawData: this.summarizeRawData(test),
                methodologyNotes: this.generateMethodologyNotes(test),
                assumptionsValidation: this.validateAssumptions(test, analysis)
            }
        };

        // Preencher resultados por métrica
        for (const [metricName, metricAnalysis] of Object.entries(analysis.metrics)) {
            report.metricResults[metricName] = {
                controlMean: metricAnalysis.control.mean,
                testMean: metricAnalysis.test.mean,
                difference: metricAnalysis.difference,
                relativeImprovement: metricAnalysis.relativeImprovement,
                pValue: metricAnalysis.pValue,
                confidenceInterval: metricAnalysis.confidenceInterval,
                effectSize: metricAnalysis.effectSize,
                isSignificant: metricAnalysis.isSignificant
            };

            report.statisticalTests[metricName] = {
                testUsed: metricAnalysis.testType,
                assumptions: metricAnalysis.assumptions,
                testStatistic: metricAnalysis.testStatistic,
                degreesOfFreedom: metricAnalysis.degreesOfFreedom
            };

            // Calcular impacto de negócio
            report.businessImpact[metricName] = this.calculateBusinessImpact(metricName, metricAnalysis);
        }

        return report;
    }

    // Métodos de análise estatística

    async analyzeMetric(test, metricName) {
        const controlData = test.data.control.metrics[metricName];
        const testData = test.data.test.metrics[metricName];

        if (!controlData || !testData || controlData.count === 0 || testData.count === 0) {
            return {
                isValid: false,
                reason: 'Dados insuficientes'
            };
        }

        // Detectar tipo de dados (contínuo vs categórico)
        const dataType = this.detectDataType(controlData.values, testData.values);

        let analysis;

        if (dataType === 'continuous') {
            analysis = await this.analyzeContinuousMetric(controlData, testData);
        } else if (dataType === 'proportion') {
            analysis = await this.analyzeProportionMetric(controlData, testData);
        } else {
            throw new Error(`Tipo de dados não suportado: ${dataType}`);
        }

        // Adicionar informações gerais
        analysis.metricName = metricName;
        analysis.dataType = dataType;
        analysis.isSignificant = analysis.pValue < test.significanceLevel;

        return analysis;
    }

    async analyzeContinuousMetric(controlData, testData) {
        // Teste t de Welch (não assume variâncias iguais)
        const controlMean = controlData.mean;
        const testMean = testData.mean;
        const controlVar = controlData.variance;
        const testVar = testData.variance;
        const controlN = controlData.count;
        const testN = testData.count;

        // Diferença das médias
        const difference = testMean - controlMean;
        const relativeImprovement = controlMean !== 0 ? (difference / controlMean) : 0;

        // Erro padrão da diferença
        const standardError = Math.sqrt((controlVar / controlN) + (testVar / testN));

        // Estatística t
        const tStatistic = difference / standardError;

        // Graus de liberdade (Welch-Satterthwaite)
        const df = Math.pow((controlVar / controlN) + (testVar / testN), 2) /
                  (Math.pow(controlVar / controlN, 2) / (controlN - 1) +
                   Math.pow(testVar / testN, 2) / (testN - 1));

        // P-value (aproximação)
        const pValue = this.calculateTTestPValue(tStatistic, df);

        // Intervalo de confiança (95%)
        const tCritical = this.getTCritical(0.05, df);
        const marginOfError = tCritical * standardError;
        const confidenceInterval = [
            difference - marginOfError,
            difference + marginOfError
        ];

        // Effect size (Cohen's d)
        const pooledStd = Math.sqrt(((controlN - 1) * controlVar + (testN - 1) * testVar) / (controlN + testN - 2));
        const effectSize = difference / pooledStd;

        return {
            control: { mean: controlMean, variance: controlVar, n: controlN },
            test: { mean: testMean, variance: testVar, n: testN },
            difference,
            relativeImprovement,
            standardError,
            testStatistic: tStatistic,
            degreesOfFreedom: df,
            pValue,
            confidenceInterval,
            effectSize,
            testType: 'welch_t_test',
            assumptions: this.validateTTestAssumptions(controlData, testData)
        };
    }

    async analyzeProportionMetric(controlData, testData) {
        const controlSuccess = controlData.sum;
        const testSuccess = testData.sum;
        const controlN = controlData.count;
        const testN = testData.count;

        const controlProp = controlSuccess / controlN;
        const testProp = testSuccess / testN;

        // Teste z para proporções
        const difference = testProp - controlProp;
        const relativeImprovement = controlProp !== 0 ? (difference / controlProp) : 0;

        // Proporção combinada
        const pooledProp = (controlSuccess + testSuccess) / (controlN + testN);

        // Erro padrão
        const standardError = Math.sqrt(pooledProp * (1 - pooledProp) * (1/controlN + 1/testN));

        // Estatística z
        const zStatistic = difference / standardError;

        // P-value
        const pValue = 2 * (1 - this.normalCDF(Math.abs(zStatistic)));

        // Intervalo de confiança
        const zCritical = 1.96; // 95% CI
        const marginOfError = zCritical * Math.sqrt((controlProp * (1 - controlProp) / controlN) +
                                                   (testProp * (1 - testProp) / testN));
        const confidenceInterval = [
            difference - marginOfError,
            difference + marginOfError
        ];

        // Effect size
        const effectSize = difference / Math.sqrt(pooledProp * (1 - pooledProp));

        return {
            control: { proportion: controlProp, successes: controlSuccess, n: controlN },
            test: { proportion: testProp, successes: testSuccess, n: testN },
            difference,
            relativeImprovement,
            standardError,
            testStatistic: zStatistic,
            pValue,
            confidenceInterval,
            effectSize,
            testType: 'z_test_proportions',
            assumptions: this.validateProportionTestAssumptions(controlN, testN, pooledProp)
        };
    }

    calculateRequiredSampleSize(test) {
        // Usar fórmula para teste t de duas amostras
        const alpha = test.significanceLevel;
        const beta = 1 - this.statistics.powerAnalysis.targetPower; // Tipo II erro
        const delta = this.statistics.powerAnalysis.minimumDetectableEffect;

        // Valores críticos
        const zAlpha = this.normalInverse(1 - alpha/2);
        const zBeta = this.normalInverse(1 - beta);

        // Sample size (assumindo variância unitária)
        const n = 2 * Math.pow((zAlpha + zBeta) / delta, 2);

        return Math.ceil(n);
    }

    calculateOverallSignificance(metricsAnalysis) {
        // Usar correção de Bonferroni para múltiplas comparações
        const pValues = Object.values(metricsAnalysis)
            .filter(analysis => analysis.isValid !== false)
            .map(analysis => analysis.pValue);

        if (pValues.length === 0) return null;

        // Método mais conservador: menor p-value multiplicado pelo número de testes
        const minPValue = Math.min(...pValues);
        const correctedPValue = Math.min(minPValue * pValues.length, 1.0);

        return correctedPValue;
    }

    generateRecommendation(test, analysis, earlyStoppingDecision) {
        if (earlyStoppingDecision.shouldStop) {
            return {
                decision: earlyStoppingDecision.reason === 'success' ? 'deploy' : 'reject',
                reason: earlyStoppingDecision.reason,
                confidence: earlyStoppingDecision.confidence
            };
        }

        // Verificar se sample size é suficiente
        const totalSamples = test.data.control.samples + test.data.test.samples;
        if (totalSamples < test.requiredSampleSize) {
            return {
                decision: 'continue',
                reason: 'insufficient_sample_size',
                confidence: 'low'
            };
        }

        // Verificar significância geral
        if (analysis.overallSignificance && analysis.overallSignificance < test.significanceLevel) {
            // Verificar se todas as métricas principais são positivas ou neutras
            const primaryMetricsPositive = test.primaryMetrics.every(metric => {
                const metricAnalysis = analysis.metrics[metric];
                return metricAnalysis && metricAnalysis.difference >= 0;
            });

            if (primaryMetricsPositive) {
                return {
                    decision: 'deploy',
                    reason: 'statistically_significant_improvement',
                    confidence: 'high'
                };
            } else {
                return {
                    decision: 'reject',
                    reason: 'statistically_significant_degradation',
                    confidence: 'high'
                };
            }
        }

        return {
            decision: 'continue',
            reason: 'not_statistically_significant',
            confidence: 'medium'
        };
    }

    // Métodos utilitários estatísticos

    detectDataType(controlValues, testValues) {
        // Verificar se são todas proporções (0 ou 1)
        const allValues = [...controlValues, ...testValues];
        const allBinary = allValues.every(v => v === 0 || v === 1);

        if (allBinary) return 'proportion';
        return 'continuous';
    }

    calculateTTestPValue(tStat, df) {
        // Aproximação para p-value do teste t
        // Para simplicidade, usando aproximação normal para df > 30
        if (df > 30) {
            return 2 * (1 - this.normalCDF(Math.abs(tStat)));
        }

        // Para df menor, usar aproximação simplificada
        return 2 * (1 - this.tCDF(Math.abs(tStat), df));
    }

    getTCritical(alpha, df) {
        // Valores críticos aproximados para teste t
        if (df > 30) return 1.96; // Aproximação normal
        if (df > 20) return 2.086;
        if (df > 10) return 2.228;
        return 2.576; // Conservador para df pequeno
    }

    normalCDF(x) {
        // Aproximação da CDF normal padrão
        return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
    }

    normalInverse(p) {
        // Aproximação da função inversa da normal padrão
        if (p <= 0 || p >= 1) throw new Error('p deve estar entre 0 e 1');

        // Aproximação de Beasley-Springer-Moro
        const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
        const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
        const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
        const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

        const pLow = 0.02425;
        const pHigh = 1 - pLow;

        let x;

        if (p < pLow) {
            const q = Math.sqrt(-2 * Math.log(p));
            x = (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
        } else if (p <= pHigh) {
            const q = p - 0.5;
            const r = q * q;
            x = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q / (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
        } else {
            const q = Math.sqrt(-2 * Math.log(1 - p));
            x = -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
        }

        return x;
    }

    erf(x) {
        // Aproximação da função erro
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    }

    tCDF(t, df) {
        // Aproximação simples da CDF t-Student
        // Para fins práticos, usando aproximação normal para df > 30
        if (df > 30) {
            return this.normalCDF(t);
        }

        // Para df menor, aproximação conservadora
        const normalApprox = this.normalCDF(t);
        const adjustment = 1 / (4 * df); // Ajuste simples
        return normalApprox * (1 - adjustment);
    }

    // Métodos auxiliares

    generateTestId() {
        return `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    validateTestConfig(config) {
        if (!config.name) throw new Error('Nome do teste é obrigatório');
        if (!config.testConfig) throw new Error('Configuração do teste é obrigatória');
        if (!config.hypothesis) throw new Error('Hipótese é obrigatória');

        if (config.trafficSplit && (config.trafficSplit <= 0 || config.trafficSplit > this.config.maxTrafficSplit)) {
            throw new Error(`Divisão de tráfego deve estar entre 0 e ${this.config.maxTrafficSplit}`);
        }
    }

    async checkTrafficConflicts(trafficSplit) {
        const currentAllocation = Array.from(this.state.trafficAllocations.values())
            .reduce((sum, allocation) => sum + allocation, 0);

        if (currentAllocation + trafficSplit > 1.0) {
            throw new Error('Alocação de tráfego excede 100%');
        }
    }

    findActiveTestForIncident(incidentId) {
        // Implementar lógica para determinar qual teste está ativo para este incidente
        // Por simplicidade, retorna o primeiro teste ativo
        return Array.from(this.state.activeTests.values())[0] || null;
    }

    shouldRunIntermediateAnalysis(test) {
        const totalSamples = test.data.control.samples + test.data.test.samples;

        // Executar análise a cada 100 amostras após o mínimo
        return totalSamples >= test.minimumSampleSize &&
               totalSamples % 100 === 0;
    }

    async runIntermediateAnalysis(test) {
        try {
            const analysis = await this.analyzeTest(test.id);

            // Verificar parada antecipada
            const earlyStoppingDecision = this.checkEarlyStoppingCriteria(test, analysis);

            if (earlyStoppingDecision.shouldStop) {
                await this.stopTest(test.id, 'early_stopping');
            }
        } catch (error) {
            logger.error(`Erro na análise intermediária do teste ${test.id}:`, error);
        }
    }

    checkEarlyStoppingCriteria(test, analysis) {
        if (!this.config.earlyStoppingEnabled) {
            return { shouldStop: false };
        }

        // Verificar se há evidência estatística suficiente
        if (analysis.overallSignificance && analysis.overallSignificance < test.significanceLevel * 0.1) { // 10x mais rigoroso
            return {
                shouldStop: true,
                reason: 'success',
                confidence: 'high'
            };
        }

        // Verificar impacto negativo significativo
        const hasNegativeImpact = test.primaryMetrics.some(metric => {
            const metricAnalysis = analysis.metrics[metric];
            return metricAnalysis &&
                   metricAnalysis.relativeImprovement < this.config.maxNegativeImpact &&
                   metricAnalysis.isSignificant;
        });

        if (hasNegativeImpact) {
            return {
                shouldStop: true,
                reason: 'negative_impact',
                confidence: 'high'
            };
        }

        return { shouldStop: false };
    }

    async checkGuardRails(test, analysis) {
        if (!this.config.guardRailsEnabled) return;

        // Implementar verificações de guard rails
        // Por exemplo, verificar se métricas críticas não degradaram
        const criticalMetrics = ['success_rate', 'error_rate'];

        for (const metric of criticalMetrics) {
            const metricAnalysis = analysis.metrics[metric];
            if (metricAnalysis && metricAnalysis.relativeImprovement < -0.05) { // 5% de degradação
                test.alerts.push({
                    type: 'guard_rail_violation',
                    metric,
                    impact: metricAnalysis.relativeImprovement,
                    timestamp: new Date()
                });

                if (metricAnalysis.relativeImprovement < -0.1) { // 10% = parada crítica
                    await this.stopTest(test.id, 'guard_rails');
                    break;
                }
            }
        }
    }

    validateTTestAssumptions(controlData, testData) {
        return {
            normality: 'assumed', // Em produção, implementar testes de normalidade
            independence: 'assumed',
            equalVariances: 'not_assumed' // Usando Welch's t-test
        };
    }

    validateProportionTestAssumptions(controlN, testN, pooledProp) {
        const minExpected = 5;
        const controlExpected = controlN * pooledProp;
        const testExpected = testN * pooledProp;

        return {
            sampleSizeAdequate: controlExpected >= minExpected && testExpected >= minExpected,
            independence: 'assumed',
            normalApproximation: controlExpected >= minExpected && testExpected >= minExpected
        };
    }

    calculateTestPower(test, analysis) {
        // Cálculo simplificado do power
        const effectSize = Object.values(analysis.metrics)
            .filter(m => m.isValid !== false)
            .map(m => Math.abs(m.effectSize || 0))
            .reduce((avg, val, _, arr) => avg + val / arr.length, 0);

        // Aproximação do power baseada no effect size
        if (effectSize > 0.8) return 0.9;
        if (effectSize > 0.5) return 0.8;
        if (effectSize > 0.2) return 0.6;
        return 0.4;
    }

    calculateBusinessImpact(metricName, metricAnalysis) {
        // Calcular impacto de negócio baseado na métrica
        const impact = {
            metric: metricName,
            improvement: metricAnalysis.relativeImprovement,
            confidenceInterval: metricAnalysis.confidenceInterval
        };

        // Adicionar contexto específico por métrica
        switch (metricName) {
            case 'success_rate':
                impact.description = `Taxa de sucesso ${metricAnalysis.relativeImprovement > 0 ? 'aumentou' : 'diminuiu'} em ${(metricAnalysis.relativeImprovement * 100).toFixed(2)}%`;
                break;
            case 'resolution_time':
                impact.description = `Tempo de resolução ${metricAnalysis.relativeImprovement < 0 ? 'melhorou' : 'piorou'} em ${Math.abs(metricAnalysis.relativeImprovement * 100).toFixed(2)}%`;
                break;
            case 'satisfaction_score':
                impact.description = `Satisfação ${metricAnalysis.relativeImprovement > 0 ? 'aumentou' : 'diminuiu'} em ${(metricAnalysis.relativeImprovement * 100).toFixed(2)}%`;
                break;
            default:
                impact.description = `Métrica ${metricAnalysis.relativeImprovement > 0 ? 'melhorou' : 'piorou'} em ${Math.abs(metricAnalysis.relativeImprovement * 100).toFixed(2)}%`;
        }

        return impact;
    }

    evaluateHypothesis(test, analysis) {
        const isSupported = analysis.overallSignificance < test.significanceLevel;

        return {
            hypothesis: test.hypothesis,
            isSupported,
            confidence: isSupported ? 'supported' : 'not_supported',
            evidence: `P-value: ${analysis.overallSignificance?.toFixed(4) || 'N/A'}`
        };
    }

    extractKeyFindings(test, analysis) {
        const findings = [];

        for (const [metricName, metricAnalysis] of Object.entries(analysis.metrics)) {
            if (metricAnalysis.isValid === false) continue;

            findings.push({
                metric: metricName,
                finding: metricAnalysis.isSignificant ?
                    `Diferença estatisticamente significativa detectada` :
                    `Não há diferença estatisticamente significativa`,
                magnitude: `Melhoria relativa: ${(metricAnalysis.relativeImprovement * 100).toFixed(2)}%`,
                confidence: `P-value: ${metricAnalysis.pValue.toFixed(4)}`
            });
        }

        return findings;
    }

    identifyLimitations(test, analysis) {
        const limitations = [];

        // Verificar sample size
        const totalSamples = test.data.control.samples + test.data.test.samples;
        if (totalSamples < test.requiredSampleSize) {
            limitations.push('Sample size menor que o ideal para detectar efeitos pequenos');
        }

        // Verificar duração
        const duration = test.endTime - test.startTime;
        if (duration < 7 * 24 * 60 * 60 * 1000) { // menos de 7 dias
            limitations.push('Duração do teste pode ser insuficiente para capturar variabilidade semanal');
        }

        // Verificar assumções estatísticas
        Object.entries(analysis.metrics).forEach(([metric, metricAnalysis]) => {
            if (metricAnalysis.assumptions && !metricAnalysis.assumptions.sampleSizeAdequate) {
                limitations.push(`Assumções do teste para ${metric} podem ter sido violadas`);
            }
        });

        return limitations;
    }

    generateBusinessRecommendations(test, analysis) {
        const recommendations = [];

        if (analysis.recommendation.decision === 'deploy') {
            recommendations.push('Implementar a variante de teste em produção');
            recommendations.push('Monitorar métricas após deployment');
            recommendations.push('Documentar aprendizados para futuros testes');
        } else if (analysis.recommendation.decision === 'reject') {
            recommendations.push('Não implementar a variante de teste');
            recommendations.push('Investigar causas da performance inferior');
            recommendations.push('Considerar iterações da proposta');
        } else {
            recommendations.push('Continuar coletando dados');
            recommendations.push('Considerar extensão do período de teste');
            recommendations.push('Avaliar aumentar o sample size');
        }

        return recommendations;
    }

    summarizeRawData(test) {
        return {
            controlSamples: test.data.control.samples,
            testSamples: test.data.test.samples,
            metricsCollected: Object.keys(test.data.control.metrics),
            dataCollectionPeriod: {
                start: test.startTime,
                end: test.endTime
            }
        };
    }

    generateMethodologyNotes(test) {
        return {
            statisticalFramework: 'Frequentist hypothesis testing',
            multipleComparisons: 'Bonferroni correction applied',
            continuousMetrics: "Welch's t-test (unequal variances assumed)",
            proportionMetrics: 'Z-test for proportions',
            significanceLevel: test.significanceLevel,
            powerAnalysis: 'Target power: 80%'
        };
    }

    validateAssumptions(test, analysis) {
        const validation = {};

        Object.entries(analysis.metrics).forEach(([metric, metricAnalysis]) => {
            if (metricAnalysis.assumptions) {
                validation[metric] = metricAnalysis.assumptions;
            }
        });

        return validation;
    }

    schedulePeriodicAnalysis(test) {
        // Agendar análises periódicas (a cada 6 horas)
        const intervalId = setInterval(async () => {
            if (!this.state.activeTests.has(test.id)) {
                clearInterval(intervalId);
                return;
            }

            try {
                await this.runIntermediateAnalysis(test);
            } catch (error) {
                logger.error(`Erro na análise periódica do teste ${test.id}:`, error);
            }
        }, 6 * 60 * 60 * 1000); // 6 horas

        test.analysisIntervalId = intervalId;
    }

    scheduleTestCompletion(test) {
        // Agendar finalização automática
        const timeoutId = setTimeout(async () => {
            if (this.state.activeTests.has(test.id)) {
                await this.finalizeTest(test.id, 'completed');
            }
        }, test.duration);

        test.completionTimeoutId = timeoutId;
    }

    async setupTestDataCollection(test) {
        // Configurar coleta de dados específica para o teste
        logger.info(`Configurando coleta de dados para teste ${test.id}`);
    }

    async allocateTraffic(test) {
        // Alocar tráfego para o teste
        this.state.trafficAllocations.set(test.id, test.trafficSplit);
        logger.info(`Tráfego alocado para teste ${test.id}: ${test.trafficSplit * 100}%`);
    }

    async deallocateTraffic(test) {
        // Desalocar tráfego do teste
        this.state.trafficAllocations.delete(test.id);

        // Limpar timers
        if (test.analysisIntervalId) {
            clearInterval(test.analysisIntervalId);
        }
        if (test.completionTimeoutId) {
            clearTimeout(test.completionTimeoutId);
        }

        logger.info(`Tráfego desalocado para teste ${test.id}`);
    }

    async loadActiveTests() {
        // Carregar testes ativos do armazenamento
        logger.info('Carregando testes ativos');
    }

    async initializeMetricsSystem() {
        // Inicializar sistema de métricas
        logger.info('Inicializando sistema de métricas');
    }

    async setupDataCollectors() {
        // Configurar coletores de dados
        logger.info('Configurando coletores de dados');
    }

    async initializeAlertingSystem() {
        // Inicializar sistema de alertas
        logger.info('Inicializando sistema de alertas');
    }

    getActiveTests() {
        return Array.from(this.state.activeTests.values());
    }

    getCompletedTests() {
        return this.state.completedTests;
    }

    getMetrics() {
        return { ...this.metrics };
    }

    async shutdown() {
        logger.info('Finalizando framework de A/B testing');

        // Finalizar todos os testes ativos
        for (const [testId] of this.state.activeTests) {
            await this.finalizeTest(testId, 'shutdown');
        }
    }
}

module.exports = ABTestingFramework;