"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriftDetector = void 0;

const events_1 = require("events");
const logger = require('../../utils/logger');

class DriftDetector extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            driftThreshold: config.driftThreshold || 0.1,
            windowSize: config.windowSize || 1000,
            statisticalTests: config.statisticalTests || ['ks_test', 'chi_square', 'psi'],
            minSamplesForTest: config.minSamplesForTest || 100,
            alertThreshold: config.alertThreshold || 0.05,
            ...config
        };

        this.referenceData = new Map(); // Dados de referência por feature
        this.currentWindow = new Map(); // Janela atual de dados
        this.driftHistory = [];
        this.featureStats = new Map();
        this.isInitialized = false;
    }

    async initialize() {
        logger.info('Inicializando DriftDetector');
        this.isInitialized = true;
        this.emit('initialized');
    }

    async shutdown() {
        logger.info('Finalizando DriftDetector');
        this.isInitialized = false;
        this.emit('shutdown');
    }

    async checkForDrift(feedbackData) {
        if (!this.isInitialized) {
            return null;
        }

        // Extrair features do feedback
        const features = this.extractFeatures(feedbackData);

        // Atualizar janela atual
        this.updateCurrentWindow(features);

        // Verificar drift para cada feature
        const driftResults = [];
        for (const [featureName, values] of features) {
            const driftResult = await this.detectFeatureDrift(featureName, values);
            if (driftResult.isDrift) {
                driftResults.push(driftResult);
            }
        }

        // Se detectou drift em alguma feature
        if (driftResults.length > 0) {
            const overallDrift = this.calculateOverallDrift(driftResults);
            await this.handleDriftDetection(overallDrift);
            return overallDrift;
        }

        return null;
    }

    extractFeatures(feedbackData) {
        const features = new Map();

        if (Array.isArray(feedbackData)) {
            // Processar batch de feedback
            for (const feedback of feedbackData) {
                this.extractSingleFeedbackFeatures(feedback, features);
            }
        } else {
            // Processar feedback único
            this.extractSingleFeedbackFeatures(feedbackData, features);
        }

        return features;
    }

    extractSingleFeedbackFeatures(feedback, features) {
        // Features numéricas
        const numericFeatures = ['rating', 'usefulness', 'accuracy', 'relevance'];
        for (const feature of numericFeatures) {
            if (feedback[feature] !== undefined && feedback[feature] !== null) {
                if (!features.has(feature)) {
                    features.set(feature, []);
                }
                features.get(feature).push(Number(feedback[feature]));
            }
        }

        // Features categóricas
        if (feedback.metadata) {
            if (feedback.metadata.suggestionType) {
                const feature = 'suggestion_type';
                if (!features.has(feature)) {
                    features.set(feature, []);
                }
                features.get(feature).push(feedback.metadata.suggestionType);
            }

            if (feedback.metadata.userSegment) {
                const feature = 'user_segment';
                if (!features.has(feature)) {
                    features.set(feature, []);
                }
                features.get(feature).push(feedback.metadata.userSegment);
            }

            if (feedback.metadata.deviceType) {
                const feature = 'device_type';
                if (!features.has(feature)) {
                    features.set(feature, []);
                }
                features.get(feature).push(feedback.metadata.deviceType);
            }
        }

        // Features derivadas
        if (feedback.context) {
            // Comprimento do contexto
            const contextLength = JSON.stringify(feedback.context).length;
            if (!features.has('context_length')) {
                features.set('context_length', []);
            }
            features.get('context_length').push(contextLength);

            // Número de campos no contexto
            const contextFields = Object.keys(feedback.context).length;
            if (!features.has('context_complexity')) {
                features.set('context_complexity', []);
            }
            features.get('context_complexity').push(contextFields);
        }

        // Features temporais
        const hour = new Date().getHours();
        const dayOfWeek = new Date().getDay();

        if (!features.has('hour_of_day')) {
            features.set('hour_of_day', []);
        }
        features.get('hour_of_day').push(hour);

        if (!features.has('day_of_week')) {
            features.set('day_of_week', []);
        }
        features.get('day_of_week').push(dayOfWeek);
    }

    updateCurrentWindow(features) {
        for (const [featureName, values] of features) {
            if (!this.currentWindow.has(featureName)) {
                this.currentWindow.set(featureName, []);
            }

            const currentData = this.currentWindow.get(featureName);
            currentData.push(...values);

            // Manter tamanho da janela
            if (currentData.length > this.config.windowSize) {
                currentData.splice(0, currentData.length - this.config.windowSize);
            }

            // Se não há dados de referência, usar os primeiros dados como referência
            if (!this.referenceData.has(featureName) && currentData.length >= this.config.minSamplesForTest) {
                this.referenceData.set(featureName, [...currentData.slice(0, Math.floor(currentData.length / 2))]);
            }
        }
    }

    async detectFeatureDrift(featureName, currentValues) {
        const referenceValues = this.referenceData.get(featureName);
        const windowValues = this.currentWindow.get(featureName);

        if (!referenceValues || !windowValues ||
            referenceValues.length < this.config.minSamplesForTest ||
            windowValues.length < this.config.minSamplesForTest) {
            return { isDrift: false, reason: 'insufficient_data' };
        }

        const testResults = [];

        // Determinar tipo de feature (numérica ou categórica)
        const isNumeric = this.isNumericFeature(referenceValues);

        if (isNumeric) {
            // Testes para features numéricas
            if (this.config.statisticalTests.includes('ks_test')) {
                const ksResult = this.kolmogorovSmirnovTest(referenceValues, windowValues);
                testResults.push({ test: 'ks_test', ...ksResult });
            }

            if (this.config.statisticalTests.includes('psi')) {
                const psiResult = this.populationStabilityIndex(referenceValues, windowValues);
                testResults.push({ test: 'psi', ...psiResult });
            }
        } else {
            // Testes para features categóricas
            if (this.config.statisticalTests.includes('chi_square')) {
                const chiResult = this.chiSquareTest(referenceValues, windowValues);
                testResults.push({ test: 'chi_square', ...chiResult });
            }
        }

        // Avaliar resultados dos testes
        const significantTests = testResults.filter(result => result.pValue < this.config.alertThreshold);

        if (significantTests.length > 0) {
            const maxDriftScore = Math.max(...testResults.map(r => r.driftScore || 0));

            return {
                isDrift: true,
                featureName,
                driftScore: maxDriftScore,
                testResults,
                severity: this.calculateDriftSeverity(maxDriftScore),
                recommendation: this.getDriftRecommendation(maxDriftScore)
            };
        }

        return { isDrift: false, featureName, testResults };
    }

    isNumericFeature(values) {
        return values.every(val => typeof val === 'number' && !isNaN(val));
    }

    kolmogorovSmirnovTest(sample1, sample2) {
        // Implementação simplificada do teste Kolmogorov-Smirnov
        const n1 = sample1.length;
        const n2 = sample2.length;

        // Ordenar amostras
        const sorted1 = [...sample1].sort((a, b) => a - b);
        const sorted2 = [...sample2].sort((a, b) => a - b);

        // Calcular função de distribuição empírica
        const allValues = [...new Set([...sorted1, ...sorted2])].sort((a, b) => a - b);

        let maxDiff = 0;
        for (const value of allValues) {
            const cdf1 = sorted1.filter(x => x <= value).length / n1;
            const cdf2 = sorted2.filter(x => x <= value).length / n2;
            const diff = Math.abs(cdf1 - cdf2);
            maxDiff = Math.max(maxDiff, diff);
        }

        // Calcular estatística de teste
        const ksStatistic = maxDiff;
        const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));

        return {
            statistic: ksStatistic,
            criticalValue,
            pValue: this.approximateKSPValue(ksStatistic, n1, n2),
            driftScore: ksStatistic / criticalValue
        };
    }

    approximateKSPValue(statistic, n1, n2) {
        // Aproximação do p-value para KS test
        const n = (n1 * n2) / (n1 + n2);
        const lambda = statistic * Math.sqrt(n);

        // Aproximação para lambda grande
        if (lambda > 1) {
            return 2 * Math.exp(-2 * lambda * lambda);
        }

        return 1; // Aproximação conservadora para lambda pequeno
    }

    populationStabilityIndex(reference, current) {
        // Calcular PSI (Population Stability Index)
        const bins = 10;
        const refHist = this.createHistogram(reference, bins);
        const curHist = this.createHistogram(current, bins);

        let psi = 0;
        for (let i = 0; i < bins; i++) {
            const refProp = refHist[i] / reference.length;
            const curProp = curHist[i] / current.length;

            if (refProp > 0 && curProp > 0) {
                psi += (curProp - refProp) * Math.log(curProp / refProp);
            }
        }

        return {
            psi,
            driftScore: psi,
            pValue: psi > 0.1 ? 0.01 : psi > 0.05 ? 0.05 : 0.1 // Aproximação
        };
    }

    createHistogram(data, bins) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const binWidth = (max - min) / bins;
        const histogram = new Array(bins).fill(0);

        for (const value of data) {
            const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
            histogram[binIndex]++;
        }

        return histogram;
    }

    chiSquareTest(reference, current) {
        // Teste qui-quadrado para features categóricas
        const refCounts = this.getCategoryCounts(reference);
        const curCounts = this.getCategoryCounts(current);

        const allCategories = new Set([...Object.keys(refCounts), ...Object.keys(curCounts)]);

        let chiSquare = 0;
        let degreesOfFreedom = 0;

        for (const category of allCategories) {
            const refCount = refCounts[category] || 0;
            const curCount = curCounts[category] || 0;
            const refTotal = reference.length;
            const curTotal = current.length;

            const expected = (refCount / refTotal) * curTotal;
            if (expected > 5) { // Regra mínima para qui-quadrado
                chiSquare += Math.pow(curCount - expected, 2) / expected;
                degreesOfFreedom++;
            }
        }

        degreesOfFreedom = Math.max(1, degreesOfFreedom - 1);

        return {
            statistic: chiSquare,
            degreesOfFreedom,
            pValue: this.approximateChiSquarePValue(chiSquare, degreesOfFreedom),
            driftScore: chiSquare / (degreesOfFreedom * 2) // Normalizado
        };
    }

    getCategoryCounts(data) {
        const counts = {};
        for (const item of data) {
            counts[item] = (counts[item] || 0) + 1;
        }
        return counts;
    }

    approximateChiSquarePValue(statistic, df) {
        // Aproximação simples para p-value do qui-quadrado
        if (df === 1) {
            return statistic > 3.84 ? 0.05 : statistic > 6.64 ? 0.01 : 0.1;
        }
        if (df === 2) {
            return statistic > 5.99 ? 0.05 : statistic > 9.21 ? 0.01 : 0.1;
        }
        // Para df maior, usar aproximação conservadora
        return statistic > (df + 2 * Math.sqrt(2 * df)) ? 0.05 : 0.1;
    }

    calculateOverallDrift(driftResults) {
        const maxDriftScore = Math.max(...driftResults.map(r => r.driftScore));
        const affectedFeatures = driftResults.map(r => r.featureName);

        return {
            isDrift: true,
            driftScore: maxDriftScore,
            affectedFeatures,
            results: driftResults,
            severity: this.calculateDriftSeverity(maxDriftScore),
            type: this.classifyDriftType(driftResults),
            timestamp: Date.now()
        };
    }

    calculateDriftSeverity(driftScore) {
        if (driftScore > 0.5) return 'high';
        if (driftScore > 0.2) return 'medium';
        return 'low';
    }

    classifyDriftType(driftResults) {
        const featureTypes = driftResults.map(r => {
            if (r.featureName.includes('rating') || r.featureName.includes('accuracy')) {
                return 'performance';
            }
            if (r.featureName.includes('user') || r.featureName.includes('device')) {
                return 'demographic';
            }
            if (r.featureName.includes('time') || r.featureName.includes('hour')) {
                return 'temporal';
            }
            return 'behavioral';
        });

        // Retornar tipo mais comum
        const typeCounts = {};
        for (const type of featureTypes) {
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }

        return Object.keys(typeCounts).reduce((a, b) =>
            typeCounts[a] > typeCounts[b] ? a : b
        );
    }

    getDriftRecommendation(driftScore) {
        if (driftScore > 0.5) {
            return 'immediate_retrain';
        }
        if (driftScore > 0.2) {
            return 'investigate';
        }
        return 'monitor';
    }

    async handleDriftDetection(driftEvent) {
        // Registrar no histórico
        this.driftHistory.push(driftEvent);

        // Manter apenas últimos 100 eventos
        if (this.driftHistory.length > 100) {
            this.driftHistory.shift();
        }

        logger.warn(`Drift detectado: ${driftEvent.type} - Score: ${driftEvent.driftScore.toFixed(3)} - Features: ${driftEvent.affectedFeatures.join(', ')}`);

        this.emit('driftDetected', driftEvent);
    }

    async getCurrentStatus() {
        const recentDrifts = this.driftHistory.slice(-10);
        const affectedFeatures = new Set();

        for (const drift of recentDrifts) {
            drift.affectedFeatures.forEach(feature => affectedFeatures.add(feature));
        }

        return {
            isMonitoring: this.isInitialized,
            recentDrifts: recentDrifts.length,
            affectedFeatures: Array.from(affectedFeatures),
            currentWindowSize: Math.max(...Array.from(this.currentWindow.values()).map(w => w.length)),
            referenceDatasets: this.referenceData.size,
            lastDriftDetected: recentDrifts.length > 0 ? recentDrifts[recentDrifts.length - 1].timestamp : null
        };
    }

    getDriftHistory(limit = 50) {
        return this.driftHistory.slice(-limit);
    }

    async updateReferenceData(featureName, newReference) {
        this.referenceData.set(featureName, newReference);
        logger.info(`Dados de referência atualizados para feature: ${featureName}`);
        this.emit('referenceUpdated', { featureName, size: newReference.length });
    }

    async resetDetector() {
        this.referenceData.clear();
        this.currentWindow.clear();
        this.driftHistory = [];
        this.featureStats.clear();

        logger.info('Detector de drift resetado');
        this.emit('detectorReset');
    }

    getFeatureStats() {
        const stats = {};

        for (const [featureName, values] of this.currentWindow) {
            if (values.length > 0) {
                const numericValues = values.filter(v => typeof v === 'number');
                if (numericValues.length > 0) {
                    stats[featureName] = {
                        count: values.length,
                        mean: numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length,
                        min: Math.min(...numericValues),
                        max: Math.max(...numericValues),
                        std: this.calculateStandardDeviation(numericValues)
                    };
                } else {
                    // Feature categórica
                    const counts = this.getCategoryCounts(values);
                    stats[featureName] = {
                        count: values.length,
                        categories: Object.keys(counts).length,
                        distribution: counts
                    };
                }
            }
        }

        return stats;
    }

    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
}

exports.DriftDetector = DriftDetector;