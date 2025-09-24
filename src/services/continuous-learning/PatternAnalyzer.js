/**
 * Analisador de Padrões
 *
 * Responsável por identificar novos tipos de incidentes,
 * detectar mudanças de comportamento, analisar tendências
 * e encontrar correlações entre sistemas.
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class PatternAnalyzer extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Configurações de análise
            analysisWindow: config.analysisWindow || 30 * 24 * 60 * 60 * 1000, // 30 dias
            minSamplesForPattern: config.minSamplesForPattern || 5,
            significanceThreshold: config.significanceThreshold || 0.05,

            // Configurações de detecção
            newTypeThreshold: config.newTypeThreshold || 0.7, // Similaridade para considerar novo tipo
            behaviorChangeThreshold: config.behaviorChangeThreshold || 0.3,
            correlationThreshold: config.correlationThreshold || 0.6,

            // Configurações de tendências
            trendDetectionWindow: config.trendDetectionWindow || 7 * 24 * 60 * 60 * 1000, // 7 dias
            seasonalityWindow: config.seasonalityWindow || 365 * 24 * 60 * 60 * 1000, // 1 ano

            // Configurações avançadas
            useAnomalyDetection: config.useAnomalyDetection || true,
            anomalyThreshold: config.anomalyThreshold || 2.5, // Desvios padrão
            clusteringMethod: config.clusteringMethod || 'kmeans',
            numClusters: config.numClusters || 10,

            ...config
        };

        // Estado do analisador
        this.state = {
            knownPatterns: new Map(),
            behaviorBaselines: new Map(),
            trendHistory: [],
            correlationMatrix: new Map(),
            anomalies: []
        };

        // Caches para performance
        this.caches = {
            embeddings: new Map(),
            clusters: new Map(),
            similarities: new Map()
        };

        // Métricas de análise
        this.metrics = {
            patternsDiscovered: 0,
            behaviorChangesDetected: 0,
            trendsIdentified: 0,
            correlationsFound: 0,
            anomaliesDetected: 0
        };
    }

    /**
     * Inicializa o analisador de padrões
     */
    async initialize() {
        try {
            logger.info('Inicializando analisador de padrões');

            // Carregar padrões conhecidos
            await this.loadKnownPatterns();

            // Estabelecer baselines de comportamento
            await this.establishBehaviorBaselines();

            // Inicializar modelos de análise
            await this.initializeAnalysisModels();

            logger.info('Analisador de padrões inicializado com sucesso');

        } catch (error) {
            logger.error('Erro ao inicializar analisador de padrões:', error);
            throw error;
        }
    }

    /**
     * Analisa padrões recentes
     */
    async analyzeRecentPatterns() {
        try {
            logger.info('Analisando padrões recentes');

            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - this.config.analysisWindow);

            // Coletar dados do período
            const incidentData = await this.collectIncidentData(startTime, endTime);

            // Executar análises em paralelo
            const [
                newTypes,
                behaviorChanges,
                trends,
                correlations,
                seasonality,
                anomalies
            ] = await Promise.all([
                this.detectNewIncidentTypes(incidentData),
                this.detectBehaviorChanges(incidentData),
                this.analyzeTrends(incidentData),
                this.analyzeCorrelations(incidentData),
                this.analyzeSeasonality(incidentData),
                this.detectAnomalies(incidentData)
            ]);

            // Gerar recomendações baseadas nas análises
            const recommendations = this.generateRecommendations({
                newTypes,
                behaviorChanges,
                trends,
                correlations,
                seasonality,
                anomalies
            });

            // Atualizar estado e métricas
            this.updateState({ newTypes, behaviorChanges, trends, correlations });
            this.updateMetrics({ newTypes, behaviorChanges, trends, correlations, anomalies });

            const result = {
                newTypes,
                behaviorChanges,
                trends,
                correlations,
                seasonality,
                anomalies,
                recommendations,
                analysisWindow: { startTime, endTime },
                totalIncidents: incidentData.length
            };

            logger.info(`Análise concluída - ${newTypes.length} novos tipos, ${behaviorChanges.length} mudanças de comportamento`);

            this.emit('analysisComplete', result);

            return result;

        } catch (error) {
            logger.error('Erro durante análise de padrões:', error);
            throw error;
        }
    }

    /**
     * Detecta novos tipos de incidentes
     */
    async detectNewIncidentTypes(incidentData) {
        logger.info('Detectando novos tipos de incidentes');

        const newTypes = [];

        // Gerar embeddings para todos os incidentes
        const embeddings = await this.generateEmbeddings(incidentData);

        // Comparar com padrões conhecidos
        for (let i = 0; i < incidentData.length; i++) {
            const incident = incidentData[i];
            const embedding = embeddings[i];

            // Verificar similaridade com tipos conhecidos
            const maxSimilarity = await this.findMaxSimilarity(embedding, this.state.knownPatterns);

            if (maxSimilarity < this.config.newTypeThreshold) {
                // Possível novo tipo - verificar se é um cluster
                const similarIncidents = await this.findSimilarIncidents(
                    embedding,
                    embeddings,
                    incidentData,
                    this.config.newTypeThreshold
                );

                if (similarIncidents.length >= this.config.minSamplesForPattern) {
                    const newType = await this.analyzeNewType(incident, similarIncidents);
                    newTypes.push(newType);

                    // Adicionar aos padrões conhecidos
                    this.state.knownPatterns.set(newType.id, newType);

                    this.emit('newTypeDetected', newType);
                }
            }
        }

        logger.info(`${newTypes.length} novos tipos detectados`);

        return newTypes;
    }

    /**
     * Detecta mudanças de comportamento
     */
    async detectBehaviorChanges(incidentData) {
        logger.info('Detectando mudanças de comportamento');

        const behaviorChanges = [];

        // Agrupar incidentes por categoria e sistema
        const groupedData = this.groupIncidentsBySystem(incidentData);

        for (const [systemId, incidents] of groupedData.entries()) {
            const baseline = this.state.behaviorBaselines.get(systemId);
            if (!baseline) continue;

            // Calcular métricas atuais
            const currentMetrics = this.calculateSystemMetrics(incidents);

            // Comparar com baseline
            const changes = this.compareWithBaseline(currentMetrics, baseline);

            // Verificar se mudanças são significativas
            for (const change of changes) {
                if (Math.abs(change.deviation) > this.config.behaviorChangeThreshold) {
                    const behaviorChange = {
                        id: this.generateId('behavior_change'),
                        systemId,
                        metric: change.metric,
                        previousValue: change.baselineValue,
                        currentValue: change.currentValue,
                        deviation: change.deviation,
                        significance: change.significance,
                        detectedAt: new Date(),
                        possibleCauses: await this.identifyPossibleCauses(change, incidents),
                        recommendedActions: this.recommendActions(change)
                    };

                    behaviorChanges.push(behaviorChange);

                    this.emit('behaviorChangeDetected', behaviorChange);
                }
            }

            // Atualizar baseline
            this.updateBaseline(systemId, currentMetrics);
        }

        logger.info(`${behaviorChanges.length} mudanças de comportamento detectadas`);

        return behaviorChanges;
    }

    /**
     * Analisa tendências temporais
     */
    async analyzeTrends(incidentData) {
        logger.info('Analisando tendências');

        const trends = [];

        // Agrupar dados por períodos de tempo
        const timeWindows = this.createTimeWindows(incidentData, this.config.trendDetectionWindow);

        // Analisar diferentes métricas
        const metrics = ['volume', 'severity', 'resolutionTime', 'category'];

        for (const metric of metrics) {
            const timeSeries = this.extractTimeSeries(timeWindows, metric);

            // Detectar tendências usando regressão linear
            const trend = this.detectTrend(timeSeries);

            if (trend.significance > 0.05) { // Tendência significativa
                const trendAnalysis = {
                    id: this.generateId('trend'),
                    metric,
                    direction: trend.slope > 0 ? 'increasing' : 'decreasing',
                    slope: trend.slope,
                    correlation: trend.correlation,
                    significance: trend.significance,
                    projectedValue: this.projectFutureValue(timeSeries, trend, 30), // 30 dias no futuro
                    detectedAt: new Date(),
                    description: this.generateTrendDescription(metric, trend),
                    recommendations: this.generateTrendRecommendations(metric, trend)
                };

                trends.push(trendAnalysis);
            }
        }

        // Detectar tendências sazonais
        const seasonalTrends = await this.detectSeasonalTrends(incidentData);
        trends.push(...seasonalTrends);

        logger.info(`${trends.length} tendências identificadas`);

        return trends;
    }

    /**
     * Analisa correlações entre sistemas
     */
    async analyzeCorrelations(incidentData) {
        logger.info('Analisando correlações entre sistemas');

        const correlations = [];

        // Criar matriz de co-ocorrência
        const cooccurrenceMatrix = this.buildCooccurrenceMatrix(incidentData);

        // Identificar correlações significativas
        const systems = Array.from(new Set(incidentData.map(i => i.systemId)));

        for (let i = 0; i < systems.length; i++) {
            for (let j = i + 1; j < systems.length; j++) {
                const systemA = systems[i];
                const systemB = systems[j];

                const correlation = this.calculateCorrelation(
                    incidentData,
                    systemA,
                    systemB
                );

                if (Math.abs(correlation.coefficient) > this.config.correlationThreshold) {
                    const correlationAnalysis = {
                        id: this.generateId('correlation'),
                        systemA,
                        systemB,
                        coefficient: correlation.coefficient,
                        strength: this.categorizeCorrelationStrength(correlation.coefficient),
                        timelag: correlation.timelag || 0, // Em horas
                        significance: correlation.pValue,
                        detectedAt: new Date(),
                        type: correlation.coefficient > 0 ? 'positive' : 'negative',
                        description: this.generateCorrelationDescription(systemA, systemB, correlation),
                        implications: await this.analyzeCorrelationImplications(systemA, systemB, correlation),
                        recommendations: this.generateCorrelationRecommendations(correlation)
                    };

                    correlations.push(correlationAnalysis);

                    // Atualizar matriz de correlação
                    this.updateCorrelationMatrix(systemA, systemB, correlation);
                }
            }
        }

        logger.info(`${correlations.length} correlações encontradas`);

        return correlations;
    }

    /**
     * Analisa sazonalidade
     */
    async analyzeSeasonality(incidentData) {
        logger.info('Analisando sazonalidade');

        // Analisar padrões por hora do dia
        const hourlyPatterns = this.analyzeHourlyPatterns(incidentData);

        // Analisar padrões por dia da semana
        const weeklyPatterns = this.analyzeWeeklyPatterns(incidentData);

        // Analisar padrões mensais
        const monthlyPatterns = this.analyzeMonthlyPatterns(incidentData);

        return {
            hourly: hourlyPatterns,
            weekly: weeklyPatterns,
            monthly: monthlyPatterns,
            hasSeasonality: this.detectSignificantSeasonality([
                hourlyPatterns,
                weeklyPatterns,
                monthlyPatterns
            ])
        };
    }

    /**
     * Detecta anomalias
     */
    async detectAnomalies(incidentData) {
        if (!this.config.useAnomalyDetection) return [];

        logger.info('Detectando anomalias');

        const anomalies = [];

        // Detectar anomalias por volume
        const volumeAnomalies = this.detectVolumeAnomalies(incidentData);
        anomalies.push(...volumeAnomalies);

        // Detectar anomalias por padrão temporal
        const temporalAnomalies = this.detectTemporalAnomalies(incidentData);
        anomalies.push(...temporalAnomalies);

        // Detectar anomalias por conteúdo
        const contentAnomalies = await this.detectContentAnomalies(incidentData);
        anomalies.push(...contentAnomalies);

        // Filtrar anomalias significativas
        const significantAnomalies = anomalies.filter(
            a => a.severity >= this.config.anomalyThreshold
        );

        logger.info(`${significantAnomalies.length} anomalias detectadas`);

        return significantAnomalies;
    }

    /**
     * Gera recomendações baseadas nas análises
     */
    generateRecommendations(analysisResults) {
        const recommendations = [];

        // Recomendações para novos tipos
        if (analysisResults.newTypes.length > 0) {
            recommendations.push({
                type: 'new_types',
                priority: 'high',
                title: 'Novos tipos de incidentes detectados',
                description: `${analysisResults.newTypes.length} novos tipos de incidentes foram identificados`,
                actions: [
                    'Criar templates de resolução para novos tipos',
                    'Treinar equipe sobre novos padrões',
                    'Atualizar base de conhecimento',
                    'Implementar monitoramento específico'
                ],
                impact: 'Melhoria na velocidade de resolução de novos tipos de incidentes'
            });
        }

        // Recomendações para mudanças de comportamento
        if (analysisResults.behaviorChanges.length > 0) {
            const criticalChanges = analysisResults.behaviorChanges.filter(c => Math.abs(c.deviation) > 0.5);

            if (criticalChanges.length > 0) {
                recommendations.push({
                    type: 'behavior_changes',
                    priority: 'critical',
                    title: 'Mudanças críticas de comportamento detectadas',
                    description: `${criticalChanges.length} sistemas apresentam mudanças significativas`,
                    actions: [
                        'Investigar causas das mudanças',
                        'Ajustar thresholds de monitoramento',
                        'Implementar alertas preventivos',
                        'Revisar capacidade dos sistemas'
                    ],
                    impact: 'Prevenção de possíveis falhas sistêmicas'
                });
            }
        }

        // Recomendações para tendências
        if (analysisResults.trends.length > 0) {
            const negativeTrends = analysisResults.trends.filter(t => t.direction === 'increasing' && t.metric !== 'resolutionTime');

            if (negativeTrends.length > 0) {
                recommendations.push({
                    type: 'trends',
                    priority: 'medium',
                    title: 'Tendências de aumento em métricas críticas',
                    description: `Detectado aumento em ${negativeTrends.map(t => t.metric).join(', ')}`,
                    actions: [
                        'Analisar causas raiz das tendências',
                        'Implementar medidas preventivas',
                        'Revisar processos operacionais',
                        'Considerar aumento de capacidade'
                    ],
                    impact: 'Melhoria proativa na qualidade do serviço'
                });
            }
        }

        // Recomendações para correlações
        if (analysisResults.correlations.length > 0) {
            const strongCorrelations = analysisResults.correlations.filter(c => Math.abs(c.coefficient) > 0.8);

            if (strongCorrelations.length > 0) {
                recommendations.push({
                    type: 'correlations',
                    priority: 'medium',
                    title: 'Correlações fortes entre sistemas detectadas',
                    description: `${strongCorrelations.length} correlações fortes identificadas`,
                    actions: [
                        'Implementar monitoramento correlacionado',
                        'Desenvolver planos de contingência conjuntos',
                        'Considerar arquitetura de isolamento',
                        'Criar alertas em cascata'
                    ],
                    impact: 'Melhoria na resposta a incidentes correlacionados'
                });
            }
        }

        return recommendations;
    }

    // Métodos auxiliares

    async generateEmbeddings(incidentData) {
        const embeddings = [];

        for (const incident of incidentData) {
            const cacheKey = this.generateEmbeddingCacheKey(incident);

            if (this.caches.embeddings.has(cacheKey)) {
                embeddings.push(this.caches.embeddings.get(cacheKey));
            } else {
                const embedding = await this.computeEmbedding(incident);
                this.caches.embeddings.set(cacheKey, embedding);
                embeddings.push(embedding);
            }
        }

        return embeddings;
    }

    async computeEmbedding(incident) {
        // Implementar geração de embedding real
        // Combinar descrição, categoria, severidade, etc.
        const text = `${incident.description} ${incident.category} ${incident.severity}`;

        // Placeholder - usar modelo de embeddings real
        return Array.from({ length: 384 }, () => Math.random());
    }

    async findMaxSimilarity(embedding, knownPatterns) {
        let maxSimilarity = 0;

        for (const [patternId, pattern] of knownPatterns.entries()) {
            const similarity = this.calculateCosineSimilarity(embedding, pattern.embedding);
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        return maxSimilarity;
    }

    calculateCosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async findSimilarIncidents(targetEmbedding, allEmbeddings, incidentData, threshold) {
        const similar = [];

        for (let i = 0; i < allEmbeddings.length; i++) {
            const similarity = this.calculateCosineSimilarity(targetEmbedding, allEmbeddings[i]);

            if (similarity >= threshold) {
                similar.push({
                    incident: incidentData[i],
                    similarity
                });
            }
        }

        return similar;
    }

    async analyzeNewType(primaryIncident, similarIncidents) {
        const centroidEmbedding = this.calculateCentroid(similarIncidents.map(s => s.similarity));

        return {
            id: this.generateId('new_type'),
            name: this.generateTypeName(primaryIncident),
            description: this.generateTypeDescription(primaryIncident, similarIncidents),
            embedding: centroidEmbedding,
            examples: similarIncidents.slice(0, 3).map(s => s.incident),
            frequency: similarIncidents.length,
            avgSeverity: this.calculateAverage(similarIncidents.map(s => s.incident.severity)),
            commonKeywords: this.extractCommonKeywords(similarIncidents.map(s => s.incident.description)),
            detectedAt: new Date()
        };
    }

    groupIncidentsBySystem(incidentData) {
        const grouped = new Map();

        for (const incident of incidentData) {
            const systemId = incident.systemId || 'unknown';

            if (!grouped.has(systemId)) {
                grouped.set(systemId, []);
            }

            grouped.get(systemId).push(incident);
        }

        return grouped;
    }

    calculateSystemMetrics(incidents) {
        return {
            volume: incidents.length,
            avgSeverity: this.calculateAverage(incidents.map(i => i.severity || 1)),
            avgResolutionTime: this.calculateAverage(incidents.map(i => i.resolutionTime || 0)),
            categoryDistribution: this.calculateDistribution(incidents, 'category'),
            hourlyDistribution: this.calculateHourlyDistribution(incidents)
        };
    }

    compareWithBaseline(currentMetrics, baseline) {
        const changes = [];

        for (const [metric, currentValue] of Object.entries(currentMetrics)) {
            if (typeof currentValue === 'number' && baseline[metric] != null) {
                const baselineValue = baseline[metric];
                const deviation = (currentValue - baselineValue) / baselineValue;

                changes.push({
                    metric,
                    currentValue,
                    baselineValue,
                    deviation,
                    significance: Math.abs(deviation) > 0.1 ? 'significant' : 'minor'
                });
            }
        }

        return changes;
    }

    createTimeWindows(incidentData, windowSize) {
        const windows = new Map();

        for (const incident of incidentData) {
            const timestamp = new Date(incident.timestamp);
            const windowStart = new Date(Math.floor(timestamp.getTime() / windowSize) * windowSize);

            if (!windows.has(windowStart.getTime())) {
                windows.set(windowStart.getTime(), []);
            }

            windows.get(windowStart.getTime()).push(incident);
        }

        return Array.from(windows.entries()).map(([time, incidents]) => ({
            timestamp: new Date(time),
            incidents
        }));
    }

    extractTimeSeries(timeWindows, metric) {
        return timeWindows.map(window => {
            let value;

            switch (metric) {
                case 'volume':
                    value = window.incidents.length;
                    break;
                case 'severity':
                    value = this.calculateAverage(window.incidents.map(i => i.severity || 1));
                    break;
                case 'resolutionTime':
                    value = this.calculateAverage(window.incidents.map(i => i.resolutionTime || 0));
                    break;
                default:
                    value = window.incidents.length;
            }

            return {
                timestamp: window.timestamp,
                value
            };
        });
    }

    detectTrend(timeSeries) {
        if (timeSeries.length < 3) {
            return { slope: 0, correlation: 0, significance: 1 };
        }

        const x = timeSeries.map((_, i) => i);
        const y = timeSeries.map(point => point.value);

        // Regressão linear simples
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calcular correlação
        const meanX = sumX / n;
        const meanY = sumY / n;

        const correlation = x.reduce((sum, xi, i) => {
            return sum + (xi - meanX) * (y[i] - meanY);
        }, 0) / Math.sqrt(
            x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0) *
            y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0)
        );

        // Teste de significância simples (t-test aproximado)
        const tStat = Math.abs(correlation) * Math.sqrt((n - 2) / (1 - correlation ** 2));
        const significance = tStat > 2 ? 0.05 : 0.5; // Simplificado

        return { slope, correlation, significance, intercept };
    }

    buildCooccurrenceMatrix(incidentData) {
        const matrix = new Map();

        // Agrupar incidentes por janelas de tempo
        const timeWindows = this.createTimeWindows(incidentData, 60 * 60 * 1000); // 1 hora

        for (const window of timeWindows) {
            const systems = new Set(window.incidents.map(i => i.systemId));
            const systemsArray = Array.from(systems);

            // Registrar co-ocorrências
            for (let i = 0; i < systemsArray.length; i++) {
                for (let j = i + 1; j < systemsArray.length; j++) {
                    const key = `${systemsArray[i]}-${systemsArray[j]}`;
                    matrix.set(key, (matrix.get(key) || 0) + 1);
                }
            }
        }

        return matrix;
    }

    calculateCorrelation(incidentData, systemA, systemB) {
        // Criar séries temporais para cada sistema
        const timeWindows = this.createTimeWindows(incidentData, 60 * 60 * 1000); // 1 hora

        const seriesA = timeWindows.map(w => w.incidents.filter(i => i.systemId === systemA).length);
        const seriesB = timeWindows.map(w => w.incidents.filter(i => i.systemId === systemB).length);

        // Calcular correlação de Pearson
        const correlation = this.pearsonCorrelation(seriesA, seriesB);

        return {
            coefficient: correlation,
            pValue: this.calculatePValue(correlation, seriesA.length)
        };
    }

    pearsonCorrelation(x, y) {
        if (x.length !== y.length) return 0;

        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    analyzeHourlyPatterns(incidentData) {
        const hourlyCount = new Array(24).fill(0);

        for (const incident of incidentData) {
            const hour = new Date(incident.timestamp).getHours();
            hourlyCount[hour]++;
        }

        const total = hourlyCount.reduce((a, b) => a + b, 0);
        const hourlyDistribution = hourlyCount.map(count => count / total);

        return {
            distribution: hourlyDistribution,
            peakHours: this.findPeakHours(hourlyDistribution),
            variance: this.calculateVariance(hourlyDistribution),
            isSignificant: this.calculateVariance(hourlyDistribution) > 0.01
        };
    }

    analyzeWeeklyPatterns(incidentData) {
        const weeklyCount = new Array(7).fill(0);

        for (const incident of incidentData) {
            const day = new Date(incident.timestamp).getDay();
            weeklyCount[day]++;
        }

        const total = weeklyCount.reduce((a, b) => a + b, 0);
        const weeklyDistribution = weeklyCount.map(count => count / total);

        return {
            distribution: weeklyDistribution,
            weekendRatio: (weeklyCount[0] + weeklyCount[6]) / total,
            variance: this.calculateVariance(weeklyDistribution),
            isSignificant: this.calculateVariance(weeklyDistribution) > 0.01
        };
    }

    analyzeMonthlyPatterns(incidentData) {
        const monthlyCount = new Array(12).fill(0);

        for (const incident of incidentData) {
            const month = new Date(incident.timestamp).getMonth();
            monthlyCount[month]++;
        }

        const total = monthlyCount.reduce((a, b) => a + b, 0);
        const monthlyDistribution = monthlyCount.map(count => count / total);

        return {
            distribution: monthlyDistribution,
            variance: this.calculateVariance(monthlyDistribution),
            isSignificant: this.calculateVariance(monthlyDistribution) > 0.01
        };
    }

    detectVolumeAnomalies(incidentData) {
        const timeWindows = this.createTimeWindows(incidentData, 60 * 60 * 1000); // 1 hora
        const volumes = timeWindows.map(w => w.incidents.length);

        const mean = this.calculateAverage(volumes);
        const std = Math.sqrt(this.calculateVariance(volumes));

        const anomalies = [];

        for (let i = 0; i < volumes.length; i++) {
            const zScore = Math.abs((volumes[i] - mean) / std);

            if (zScore > this.config.anomalyThreshold) {
                anomalies.push({
                    type: 'volume',
                    timestamp: timeWindows[i].timestamp,
                    severity: zScore,
                    value: volumes[i],
                    expected: mean,
                    description: `Volume anômalo: ${volumes[i]} incidentes (esperado: ${mean.toFixed(1)})`
                });
            }
        }

        return anomalies;
    }

    detectTemporalAnomalies(incidentData) {
        // Implementar detecção de anomalias temporais
        return [];
    }

    async detectContentAnomalies(incidentData) {
        // Implementar detecção de anomalias de conteúdo
        return [];
    }

    // Métodos utilitários

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateAverage(values) {
        const validValues = values.filter(v => v != null && !isNaN(v));
        return validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
    }

    calculateVariance(values) {
        const mean = this.calculateAverage(values);
        const squaredDiffs = values.map(v => (v - mean) ** 2);
        return this.calculateAverage(squaredDiffs);
    }

    calculateDistribution(items, property) {
        const distribution = {};
        for (const item of items) {
            const value = item[property] || 'unknown';
            distribution[value] = (distribution[value] || 0) + 1;
        }
        return distribution;
    }

    calculateHourlyDistribution(incidents) {
        const distribution = new Array(24).fill(0);
        for (const incident of incidents) {
            const hour = new Date(incident.timestamp).getHours();
            distribution[hour]++;
        }
        return distribution;
    }

    calculateCentroid(embeddings) {
        if (embeddings.length === 0) return [];

        const dimensions = embeddings[0].length;
        const centroid = new Array(dimensions).fill(0);

        for (const embedding of embeddings) {
            for (let i = 0; i < dimensions; i++) {
                centroid[i] += embedding[i];
            }
        }

        return centroid.map(sum => sum / embeddings.length);
    }

    generateTypeName(incident) {
        // Gerar nome baseado em palavras-chave
        const keywords = this.extractKeywords(incident.description);
        return keywords.slice(0, 3).join('_') || `type_${incident.category}`;
    }

    generateTypeDescription(primaryIncident, similarIncidents) {
        const commonKeywords = this.extractCommonKeywords(
            similarIncidents.map(s => s.incident.description)
        );

        return `Novo tipo de incidente caracterizado por: ${commonKeywords.slice(0, 5).join(', ')}`;
    }

    extractKeywords(text) {
        // Implementar extração de palavras-chave simples
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 10);
    }

    extractCommonKeywords(descriptions) {
        const allKeywords = descriptions.flatMap(desc => this.extractKeywords(desc));
        const frequency = {};

        for (const keyword of allKeywords) {
            frequency[keyword] = (frequency[keyword] || 0) + 1;
        }

        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([keyword]) => keyword);
    }

    findPeakHours(distribution) {
        const peaks = [];
        const threshold = this.calculateAverage(distribution) * 1.5;

        for (let i = 0; i < distribution.length; i++) {
            if (distribution[i] > threshold) {
                peaks.push(i);
            }
        }

        return peaks;
    }

    calculatePValue(correlation, sampleSize) {
        // Cálculo simplificado de p-value
        const tStat = Math.abs(correlation) * Math.sqrt((sampleSize - 2) / (1 - correlation ** 2));
        return tStat > 2 ? 0.05 : 0.5;
    }

    categorizeCorrelationStrength(coefficient) {
        const abs = Math.abs(coefficient);
        if (abs >= 0.9) return 'very_strong';
        if (abs >= 0.7) return 'strong';
        if (abs >= 0.5) return 'moderate';
        if (abs >= 0.3) return 'weak';
        return 'negligible';
    }

    generateCorrelationDescription(systemA, systemB, correlation) {
        const strength = this.categorizeCorrelationStrength(correlation.coefficient);
        const direction = correlation.coefficient > 0 ? 'positiva' : 'negativa';

        return `Correlação ${strength} ${direction} entre ${systemA} e ${systemB}`;
    }

    async analyzeCorrelationImplications(systemA, systemB, correlation) {
        // Analisar implicações da correlação
        return [
            'Falhas em um sistema podem afetar o outro',
            'Monitoramento conjunto recomendado',
            'Considerar redundância independente'
        ];
    }

    generateCorrelationRecommendations(correlation) {
        return [
            'Implementar alertas correlacionados',
            'Desenvolver planos de contingência conjuntos',
            'Monitorar ambos os sistemas simultaneamente'
        ];
    }

    detectSignificantSeasonality(patterns) {
        return patterns.some(pattern => pattern.isSignificant);
    }

    updateState(analysisResults) {
        // Atualizar estado com novos resultados
        for (const newType of analysisResults.newTypes) {
            this.state.knownPatterns.set(newType.id, newType);
        }

        this.state.trendHistory.push({
            timestamp: new Date(),
            trends: analysisResults.trends
        });
    }

    updateMetrics(results) {
        this.metrics.patternsDiscovered += results.newTypes.length;
        this.metrics.behaviorChangesDetected += results.behaviorChanges.length;
        this.metrics.trendsIdentified += results.trends.length;
        this.metrics.correlationsFound += results.correlations.length;
        this.metrics.anomaliesDetected += results.anomalies?.length || 0;
    }

    generateEmbeddingCacheKey(incident) {
        return `${incident.id}_${incident.description.length}`;
    }

    updateBaseline(systemId, metrics) {
        this.state.behaviorBaselines.set(systemId, metrics);
    }

    updateCorrelationMatrix(systemA, systemB, correlation) {
        const key = `${systemA}-${systemB}`;
        this.state.correlationMatrix.set(key, correlation);
    }

    projectFutureValue(timeSeries, trend, daysAhead) {
        const lastIndex = timeSeries.length - 1;
        const futureIndex = lastIndex + daysAhead;
        return trend.intercept + trend.slope * futureIndex;
    }

    generateTrendDescription(metric, trend) {
        const direction = trend.slope > 0 ? 'aumentando' : 'diminuindo';
        return `${metric} está ${direction} com correlação de ${trend.correlation.toFixed(2)}`;
    }

    generateTrendRecommendations(metric, trend) {
        // Gerar recomendações baseadas na tendência
        return ['Monitorar de perto', 'Analisar causas', 'Implementar medidas preventivas'];
    }

    async detectSeasonalTrends(incidentData) {
        // Detectar tendências sazonais específicas
        return [];
    }

    async identifyPossibleCauses(change, incidents) {
        // Identificar possíveis causas das mudanças
        return ['Mudança de volume', 'Alteração de sistema', 'Fator externo'];
    }

    recommendActions(change) {
        // Recomendar ações baseadas na mudança
        return ['Investigar causa', 'Ajustar monitoramento', 'Notificar equipe'];
    }

    async loadKnownPatterns() {
        // Carregar padrões conhecidos do armazenamento
        logger.info('Carregando padrões conhecidos');
    }

    async establishBehaviorBaselines() {
        // Estabelecer baselines de comportamento
        logger.info('Estabelecendo baselines de comportamento');
    }

    async initializeAnalysisModels() {
        // Inicializar modelos de análise
        logger.info('Inicializando modelos de análise');
    }

    async collectIncidentData(startTime, endTime) {
        // Coletar dados de incidentes do período
        // Implementar coleta real de dados
        return [];
    }

    async shutdown() {
        logger.info('Finalizando analisador de padrões');
    }
}

module.exports = PatternAnalyzer;