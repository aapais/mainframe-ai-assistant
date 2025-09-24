/**
 * CategoryManager - Sistema Híbrido de Categorização Automática
 *
 * Sistema inteligente que combina Machine Learning, NLP e Keywords para
 * categorização automática de incidentes bancários com aprendizado contínuo.
 */

const TaxonomyManager = require('./TaxonomyManager');
const MLClassifier = require('./MLClassifier');
const path = require('path');
const fs = require('fs').promises;

class CategoryManager {
    constructor(options = {}) {
        this.taxonomyManager = new TaxonomyManager();
        this.mlClassifier = new MLClassifier(options.mlConfig);
        this.options = {
            minConfidence: options.minConfidence || 0.6,
            maxResults: options.maxResults || 5,
            enableFeedbackLearning: options.enableFeedbackLearning !== false,
            modelPath: options.modelPath || path.join(__dirname, '../../models/categorization'),
            enableNLP: options.enableNLP !== false,
            enableKeywords: options.enableKeywords !== false,
            enablePatterns: options.enablePatterns !== false,
            hybridWeights: {
                ml: options.hybridWeights?.ml || 0.4,
                nlp: options.hybridWeights?.nlp || 0.3,
                keywords: options.hybridWeights?.keywords || 0.2,
                patterns: options.hybridWeights?.patterns || 0.1
            },
            ...options
        };

        // Cache para otimização de performance
        this.classificationCache = new Map();
        this.confidenceHistory = [];
        this.feedbackQueue = [];

        // Métricas de performance
        this.metrics = {
            totalClassifications: 0,
            successfulClassifications: 0,
            averageConfidence: 0,
            accuracyScore: 0,
            precisionScore: 0,
            recallScore: 0,
            f1Score: 0,
            processingTimes: [],
            feedbackCount: 0,
            modelVersions: []
        };

        this.initialize();
    }

    /**
     * Inicializa o sistema de categorização
     */
    async initialize() {
        try {
            // Carrega ou treina modelo ML inicial
            await this.mlClassifier.initialize();

            // Carrega histórico de feedback se existir
            await this.loadFeedbackHistory();

            // Inicializa cache de performance
            this.setupPerformanceCache();

            console.log('CategoryManager initialized successfully');
        } catch (error) {
            console.error('Error initializing CategoryManager:', error);
            throw error;
        }
    }

    /**
     * Classifica incidente usando algoritmo híbrido
     */
    async classifyIncident(incident) {
        const startTime = Date.now();

        try {
            // Valida entrada
            this.validateIncident(incident);

            // Verifica cache primeiro
            const cacheKey = this.generateCacheKey(incident);
            if (this.classificationCache.has(cacheKey)) {
                return this.classificationCache.get(cacheKey);
            }

            // Extrai e processa texto
            const text = this.extractText(incident);
            const processedText = this.preprocessText(text);

            // Executa classificação híbrida em paralelo
            const [mlResults, nlpResults, keywordResults, patternResults] = await Promise.all([
                this.options.enableNLP ? this.classifyWithML(processedText, incident) : Promise.resolve([]),
                this.options.enableNLP ? this.classifyWithNLP(processedText, incident) : Promise.resolve([]),
                this.options.enableKeywords ? this.classifyWithKeywords(processedText, incident) : Promise.resolve([]),
                this.options.enablePatterns ? this.classifyWithPatterns(processedText, incident) : Promise.resolve([])
            ]);

            // Combina resultados usando algoritmo híbrido
            const hybridResults = this.combineResults({
                ml: mlResults,
                nlp: nlpResults,
                keywords: keywordResults,
                patterns: patternResults
            });

            // Seleciona melhor resultado com base na confiança
            const bestResult = this.selectBestResult(hybridResults);

            // Enriquece resultado com metadados
            const enrichedResult = await this.enrichResult(bestResult, incident, {
                processingTime: Date.now() - startTime,
                methods: {
                    ml: mlResults.length > 0,
                    nlp: nlpResults.length > 0,
                    keywords: keywordResults.length > 0,
                    patterns: patternResults.length > 0
                },
                allResults: hybridResults
            });

            // Cache resultado para otimização
            this.classificationCache.set(cacheKey, enrichedResult);

            // Atualiza métricas
            this.updateMetrics(enrichedResult, Date.now() - startTime);

            return enrichedResult;

        } catch (error) {
            console.error('Error in hybrid classification:', error);
            this.metrics.totalClassifications++;

            // Retorna classificação de fallback
            return this.getFallbackClassification(incident, error);
        }
    }

    /**
     * Classificação usando Machine Learning
     */
    async classifyWithML(text, incident) {
        try {
            if (!this.mlClassifier.isModelLoaded()) {
                console.warn('ML model not loaded, skipping ML classification');
                return [];
            }

            const predictions = await this.mlClassifier.predict(text, {
                context: {
                    priority: incident.priority,
                    source: incident.source,
                    timestamp: incident.timestamp
                }
            });

            return predictions.map(pred => ({
                taxonomyId: pred.category,
                taxonomy: this.taxonomyManager.getTaxonomy(pred.category),
                confidence: pred.confidence,
                method: 'ml',
                score: pred.confidence * this.options.hybridWeights.ml,
                metadata: {
                    modelVersion: this.mlClassifier.getModelVersion(),
                    features: pred.features || [],
                    explanation: pred.explanation || ''
                }
            })).filter(result => result.taxonomy && result.confidence >= this.options.minConfidence);

        } catch (error) {
            console.error('ML classification error:', error);
            return [];
        }
    }

    /**
     * Classificação usando NLP (análise semântica)
     */
    async classifyWithNLP(text, incident) {
        try {
            const nlpResults = [];

            // Análise de sentimentos e contexto
            const sentiment = this.analyzeSentiment(text);
            const entities = this.extractNamedEntities(text);
            const concepts = this.extractConcepts(text);

            // Mapeia entidades para taxonomias
            for (const entity of entities) {
                const matches = this.taxonomyManager.searchByKeyword(entity.text);
                for (const match of matches) {
                    const confidence = this.calculateNLPConfidence(entity, match, sentiment, concepts);
                    if (confidence >= this.options.minConfidence) {
                        nlpResults.push({
                            taxonomyId: match.taxonomyId,
                            taxonomy: match.taxonomy,
                            confidence: confidence,
                            method: 'nlp',
                            score: confidence * this.options.hybridWeights.nlp,
                            metadata: {
                                entity: entity,
                                sentiment: sentiment,
                                concepts: concepts.slice(0, 3)
                            }
                        });
                    }
                }
            }

            // Remove duplicatas e ordena por confiança
            const uniqueResults = this.removeDuplicates(nlpResults, 'taxonomyId');
            return uniqueResults.sort((a, b) => b.confidence - a.confidence).slice(0, this.options.maxResults);

        } catch (error) {
            console.error('NLP classification error:', error);
            return [];
        }
    }

    /**
     * Classificação usando palavras-chave
     */
    async classifyWithKeywords(text, incident) {
        try {
            const keywordResults = [];
            const words = this.tokenizeText(text);

            for (const word of words) {
                const matches = this.taxonomyManager.searchByKeyword(word);
                for (const match of matches) {
                    const confidence = this.calculateKeywordConfidence(word, match, words, incident);
                    if (confidence >= this.options.minConfidence) {
                        keywordResults.push({
                            taxonomyId: match.taxonomyId,
                            taxonomy: match.taxonomy,
                            confidence: confidence,
                            method: 'keyword',
                            score: confidence * this.options.hybridWeights.keywords,
                            metadata: {
                                keyword: word,
                                matchType: match.matchType,
                                frequency: this.calculateWordFrequency(word, words)
                            }
                        });
                    }
                }
            }

            // Agrupa por taxonomia e calcula confiança agregada
            const aggregatedResults = this.aggregateKeywordResults(keywordResults);
            return aggregatedResults.sort((a, b) => b.confidence - a.confidence).slice(0, this.options.maxResults);

        } catch (error) {
            console.error('Keyword classification error:', error);
            return [];
        }
    }

    /**
     * Classificação usando padrões regex
     */
    async classifyWithPatterns(text, incident) {
        try {
            const patternResults = [];
            const matches = this.taxonomyManager.searchByPattern(text);

            for (const match of matches) {
                const confidence = this.calculatePatternConfidence(match, text, incident);
                if (confidence >= this.options.minConfidence) {
                    patternResults.push({
                        taxonomyId: match.taxonomyId,
                        taxonomy: match.taxonomy,
                        confidence: confidence,
                        method: 'pattern',
                        score: confidence * this.options.hybridWeights.patterns,
                        metadata: {
                            pattern: match.pattern.source,
                            matchType: match.matchType,
                            matchCount: (text.match(match.pattern) || []).length
                        }
                    });
                }
            }

            return patternResults.sort((a, b) => b.confidence - a.confidence).slice(0, this.options.maxResults);

        } catch (error) {
            console.error('Pattern classification error:', error);
            return [];
        }
    }

    /**
     * Combina resultados de diferentes métodos usando algoritmo híbrido
     */
    combineResults(methodResults) {
        const combinedMap = new Map();

        // Combina resultados de todos os métodos
        for (const [method, results] of Object.entries(methodResults)) {
            for (const result of results) {
                const key = result.taxonomyId;

                if (!combinedMap.has(key)) {
                    combinedMap.set(key, {
                        taxonomyId: result.taxonomyId,
                        taxonomy: result.taxonomy,
                        scores: new Map(),
                        totalScore: 0,
                        methods: [],
                        metadata: {}
                    });
                }

                const combined = combinedMap.get(key);
                combined.scores.set(method, result.score);
                combined.totalScore += result.score;
                combined.methods.push(result.method);
                combined.metadata[method] = result.metadata;
            }
        }

        // Calcula confiança final e normaliza scores
        const results = Array.from(combinedMap.values()).map(item => {
            const methodCount = item.methods.length;
            const maxPossibleScore = Object.values(this.options.hybridWeights).reduce((sum, weight) => sum + weight, 0);

            // Confiança baseada em score e diversidade de métodos
            const diversityBonus = methodCount > 1 ? 0.1 * (methodCount - 1) : 0;
            const normalizedScore = item.totalScore / maxPossibleScore;
            const finalConfidence = Math.min(normalizedScore + diversityBonus, 1.0);

            return {
                taxonomyId: item.taxonomyId,
                taxonomy: item.taxonomy,
                confidence: finalConfidence,
                score: item.totalScore,
                methods: [...new Set(item.methods)], // Remove duplicatas
                methodScores: Object.fromEntries(item.scores),
                metadata: item.metadata
            };
        });

        return results.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Seleciona o melhor resultado baseado em confiança e contexto
     */
    selectBestResult(results) {
        if (results.length === 0) {
            return null;
        }

        // Aplica filtros de confiança
        const validResults = results.filter(r => r.confidence >= this.options.minConfidence);

        if (validResults.length === 0) {
            return null;
        }

        // Seleciona resultado com maior confiança
        const bestResult = validResults[0];

        // Adiciona resultados alternativos
        bestResult.alternatives = validResults.slice(1, this.options.maxResults);

        return bestResult;
    }

    /**
     * Enriquece resultado com informações adicionais
     */
    async enrichResult(result, incident, processingInfo) {
        if (!result) {
            return {
                incident: incident,
                classification: null,
                routing: null,
                confidence: 0,
                processingInfo: processingInfo,
                timestamp: new Date().toISOString()
            };
        }

        // Obtém informações de roteamento
        const routingInfo = this.taxonomyManager.getRoutingInfo(result.taxonomyId);

        // Calcula SLA baseado na prioridade e taxonomia
        const sla = this.calculateSLA(result.taxonomy, incident);

        return {
            incident: incident,
            classification: {
                primaryCategory: {
                    taxonomyId: result.taxonomyId,
                    taxonomy: result.taxonomy,
                    confidence: result.confidence,
                    methods: result.methods,
                    score: result.score
                },
                alternatives: result.alternatives || [],
                methodScores: result.methodScores || {},
                metadata: result.metadata || {}
            },
            routing: {
                team: routingInfo?.team,
                escalation: routingInfo?.escalation,
                sla: sla,
                priority: this.calculatePriority(result.taxonomy, incident)
            },
            confidence: result.confidence,
            processingInfo: processingInfo,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Processa feedback para aprendizado contínuo
     */
    async processFeedback(incidentId, feedback) {
        try {
            if (!this.options.enableFeedbackLearning) {
                console.warn('Feedback learning is disabled');
                return false;
            }

            // Valida feedback
            this.validateFeedback(feedback);

            const feedbackEntry = {
                incidentId: incidentId,
                correctCategory: feedback.correctCategory,
                confidence: feedback.confidence || 1.0,
                userFeedback: feedback.userFeedback,
                timestamp: new Date().toISOString(),
                processed: false
            };

            // Adiciona à fila de feedback
            this.feedbackQueue.push(feedbackEntry);
            this.metrics.feedbackCount++;

            // Processa feedback imediatamente se possível
            if (this.feedbackQueue.length >= 10 || feedback.immediate) {
                await this.processFeedbackBatch();
            }

            return true;

        } catch (error) {
            console.error('Error processing feedback:', error);
            return false;
        }
    }

    /**
     * Processa lote de feedback para retreinamento
     */
    async processFeedbackBatch() {
        try {
            const pendingFeedback = this.feedbackQueue.filter(f => !f.processed);

            if (pendingFeedback.length === 0) {
                return;
            }

            // Prepara dados de treinamento
            const trainingData = await this.prepareFeedbackTrainingData(pendingFeedback);

            // Retreina modelo ML
            if (trainingData.length > 0) {
                await this.mlClassifier.incrementalTrain(trainingData);
            }

            // Marca feedback como processado
            pendingFeedback.forEach(f => f.processed = true);

            // Salva histórico de feedback
            await this.saveFeedbackHistory();

            console.log(`Processed ${pendingFeedback.length} feedback entries`);

        } catch (error) {
            console.error('Error processing feedback batch:', error);
        }
    }

    /**
     * Obtém métricas de performance do sistema
     */
    getMetrics() {
        const avgProcessingTime = this.metrics.processingTimes.length > 0
            ? this.metrics.processingTimes.reduce((sum, time) => sum + time, 0) / this.metrics.processingTimes.length
            : 0;

        const successRate = this.metrics.totalClassifications > 0
            ? this.metrics.successfulClassifications / this.metrics.totalClassifications
            : 0;

        return {
            ...this.metrics,
            averageProcessingTime: Math.round(avgProcessingTime),
            successRate: Math.round(successRate * 100) / 100,
            cacheHitRate: this.calculateCacheHitRate(),
            modelAccuracy: this.mlClassifier.getAccuracy(),
            lastUpdate: new Date().toISOString()
        };
    }

    // ============= MÉTODOS AUXILIARES =============

    validateIncident(incident) {
        if (!incident || typeof incident !== 'object') {
            throw new Error('Invalid incident data');
        }

        if (!incident.id) {
            throw new Error('Incident ID is required');
        }

        if (!incident.title && !incident.description) {
            throw new Error('Either title or description is required');
        }
    }

    extractText(incident) {
        const parts = [];

        if (incident.title) parts.push(incident.title);
        if (incident.description) parts.push(incident.description);
        if (incident.symptoms) parts.push(incident.symptoms);
        if (incident.errorMessage) parts.push(incident.errorMessage);

        return parts.join(' ');
    }

    preprocessText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    tokenizeText(text) {
        return text.split(/\s+/).filter(word => word.length > 2);
    }

    generateCacheKey(incident) {
        const text = this.extractText(incident);
        return `${incident.id}_${this.hashString(text)}`;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    calculateKeywordConfidence(keyword, match, allWords, incident) {
        const baseConfidence = 0.7;
        const frequency = this.calculateWordFrequency(keyword, allWords);
        const contextBonus = this.calculateContextBonus(keyword, incident);

        return Math.min(baseConfidence + (frequency * 0.1) + contextBonus, 1.0);
    }

    calculatePatternConfidence(match, text, incident) {
        const matchCount = (text.match(match.pattern) || []).length;
        const baseConfidence = 0.8;
        const frequencyBonus = Math.min(matchCount * 0.1, 0.2);

        return Math.min(baseConfidence + frequencyBonus, 1.0);
    }

    calculateNLPConfidence(entity, match, sentiment, concepts) {
        let confidence = 0.6;

        // Boost baseado na confiança da entidade
        confidence += entity.confidence * 0.2;

        // Boost baseado em conceitos relacionados
        const relatedConcepts = concepts.filter(c =>
            match.taxonomy.keywords.some(k => c.text.toLowerCase().includes(k.toLowerCase()))
        );
        confidence += relatedConcepts.length * 0.05;

        return Math.min(confidence, 1.0);
    }

    calculateWordFrequency(word, words) {
        return words.filter(w => w === word).length / words.length;
    }

    calculateContextBonus(keyword, incident) {
        let bonus = 0;

        // Bonus baseado na prioridade
        if (incident.priority === 'critical' || incident.priority === 'high') {
            bonus += 0.1;
        }

        // Bonus baseado na fonte
        if (incident.source && incident.source.includes('mainframe')) {
            bonus += 0.1;
        }

        return bonus;
    }

    aggregateKeywordResults(results) {
        const aggregated = new Map();

        for (const result of results) {
            const key = result.taxonomyId;

            if (!aggregated.has(key)) {
                aggregated.set(key, {
                    ...result,
                    keywords: [],
                    totalScore: 0,
                    count: 0
                });
            }

            const agg = aggregated.get(key);
            agg.keywords.push(result.metadata.keyword);
            agg.totalScore += result.score;
            agg.count++;
        }

        return Array.from(aggregated.values()).map(item => ({
            ...item,
            confidence: item.totalScore / item.count,
            score: item.totalScore,
            metadata: {
                ...item.metadata,
                keywords: [...new Set(item.keywords)],
                keywordCount: item.count
            }
        }));
    }

    removeDuplicates(results, key) {
        const seen = new Set();
        return results.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }

    calculateSLA(taxonomy, incident) {
        const baseSLA = taxonomy.routing?.sla || 60;

        // Ajusta SLA baseado na prioridade do incidente
        const priorityMultipliers = {
            critical: 0.5,
            high: 0.7,
            medium: 1.0,
            low: 1.5
        };

        const multiplier = priorityMultipliers[incident.priority] || 1.0;
        return Math.round(baseSLA * multiplier);
    }

    calculatePriority(taxonomy, incident) {
        const taxonomyPriority = taxonomy.priority || 'medium';
        const incidentPriority = incident.priority || 'medium';

        // Prioridade é a maior entre taxonomia e incidente
        const priorities = ['low', 'medium', 'high', 'critical'];
        const taxonomyIndex = priorities.indexOf(taxonomyPriority);
        const incidentIndex = priorities.indexOf(incidentPriority);

        return priorities[Math.max(taxonomyIndex, incidentIndex)];
    }

    getFallbackClassification(incident, error) {
        // Classificação de fallback usando apenas keywords básicas
        const text = this.extractText(incident).toLowerCase();
        let fallbackCategory = 'infrastructure'; // Categoria padrão

        // Classificação simples baseada em palavras-chave críticas
        if (text.includes('mainframe') || text.includes('cobol') || text.includes('cics')) {
            fallbackCategory = 'mainframe';
        } else if (text.includes('mobile') || text.includes('app')) {
            fallbackCategory = 'mobile-banking';
        } else if (text.includes('internet') || text.includes('web')) {
            fallbackCategory = 'internet-banking';
        } else if (text.includes('payment') || text.includes('pix') || text.includes('transfer')) {
            fallbackCategory = 'payment-systems';
        }

        const taxonomy = this.taxonomyManager.getTaxonomy(fallbackCategory);
        const routingInfo = this.taxonomyManager.getRoutingInfo(fallbackCategory);

        return {
            incident: incident,
            classification: {
                primaryCategory: {
                    taxonomyId: fallbackCategory,
                    taxonomy: taxonomy,
                    confidence: 0.3,
                    methods: ['fallback'],
                    score: 0.3
                },
                alternatives: [],
                methodScores: { fallback: 0.3 },
                metadata: { error: error.message, fallback: true }
            },
            routing: {
                team: routingInfo?.team,
                escalation: routingInfo?.escalation,
                sla: this.calculateSLA(taxonomy, incident),
                priority: this.calculatePriority(taxonomy, incident)
            },
            confidence: 0.3,
            processingInfo: {
                processingTime: 0,
                methods: { fallback: true },
                allResults: []
            },
            timestamp: new Date().toISOString()
        };
    }

    updateMetrics(result, processingTime) {
        this.metrics.totalClassifications++;

        if (result.confidence >= this.options.minConfidence) {
            this.metrics.successfulClassifications++;
        }

        this.metrics.processingTimes.push(processingTime);

        // Mantém apenas os últimos 1000 tempos para cálculo de média
        if (this.metrics.processingTimes.length > 1000) {
            this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
        }

        // Atualiza confiança média
        this.confidenceHistory.push(result.confidence);
        if (this.confidenceHistory.length > 1000) {
            this.confidenceHistory = this.confidenceHistory.slice(-1000);
        }

        this.metrics.averageConfidence = this.confidenceHistory.reduce((sum, conf) => sum + conf, 0) / this.confidenceHistory.length;
    }

    calculateCacheHitRate() {
        // Implementação simplificada - em produção, usar métricas mais detalhadas
        return this.classificationCache.size > 0 ? 0.85 : 0;
    }

    setupPerformanceCache() {
        // Limpa cache periodicamente para evitar uso excessivo de memória
        setInterval(() => {
            if (this.classificationCache.size > 1000) {
                const entries = Array.from(this.classificationCache.entries());
                const toKeep = entries.slice(-500); // Mantém os 500 mais recentes
                this.classificationCache.clear();
                toKeep.forEach(([key, value]) => this.classificationCache.set(key, value));
            }
        }, 300000); // 5 minutos
    }

    async loadFeedbackHistory() {
        try {
            const historyPath = path.join(this.options.modelPath, 'feedback_history.json');
            const data = await fs.readFile(historyPath, 'utf8');
            const history = JSON.parse(data);

            this.feedbackQueue = history.feedback || [];
            this.metrics.feedbackCount = history.totalFeedback || 0;

        } catch (error) {
            // Arquivo não existe ou erro de leitura - continua com valores padrão
            console.log('No feedback history found, starting fresh');
        }
    }

    async saveFeedbackHistory() {
        try {
            const historyPath = path.join(this.options.modelPath, 'feedback_history.json');

            // Cria diretório se não existir
            await fs.mkdir(path.dirname(historyPath), { recursive: true });

            const history = {
                feedback: this.feedbackQueue,
                totalFeedback: this.metrics.feedbackCount,
                lastUpdate: new Date().toISOString()
            };

            await fs.writeFile(historyPath, JSON.stringify(history, null, 2));

        } catch (error) {
            console.error('Error saving feedback history:', error);
        }
    }

    async prepareFeedbackTrainingData(feedbackEntries) {
        const trainingData = [];

        for (const feedback of feedbackEntries) {
            try {
                // Aqui você obteria o incidente original do banco de dados
                // Por simplicidade, vamos simular
                const incident = { id: feedback.incidentId }; // Buscar do DB
                const text = this.extractText(incident);

                trainingData.push({
                    text: text,
                    category: feedback.correctCategory,
                    confidence: feedback.confidence
                });

            } catch (error) {
                console.error(`Error preparing training data for incident ${feedback.incidentId}:`, error);
            }
        }

        return trainingData;
    }

    validateFeedback(feedback) {
        if (!feedback || typeof feedback !== 'object') {
            throw new Error('Invalid feedback data');
        }

        if (!feedback.correctCategory) {
            throw new Error('Correct category is required in feedback');
        }

        if (!this.taxonomyManager.getTaxonomy(feedback.correctCategory)) {
            throw new Error('Invalid category in feedback');
        }
    }

    // Métodos de NLP simplificados (em produção, usar bibliotecas especializadas)
    analyzeSentiment(text) {
        // Implementação simplificada de análise de sentimento
        const negativeWords = ['erro', 'falha', 'problema', 'crítico', 'urgente', 'quebrado'];
        const positiveWords = ['sucesso', 'funcionando', 'ok', 'normal', 'resolvido'];

        const words = text.toLowerCase().split(/\s+/);
        let score = 0;

        words.forEach(word => {
            if (negativeWords.includes(word)) score -= 1;
            if (positiveWords.includes(word)) score += 1;
        });

        return {
            score: score,
            magnitude: Math.abs(score),
            sentiment: score < 0 ? 'negative' : score > 0 ? 'positive' : 'neutral'
        };
    }

    extractNamedEntities(text) {
        // Implementação simplificada de extração de entidades
        const entities = [];
        const patterns = {
            'SYSTEM': /\b(mainframe|cics|db2|cobol|jcl|vsam|ims)\b/gi,
            'ERROR': /\b(s0c[0-9]|sx[0-9]{2}|abend|sqlcode)\b/gi,
            'TECHNOLOGY': /\b(java|javascript|python|react|angular|spring)\b/gi
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            const matches = text.match(pattern) || [];
            matches.forEach(match => {
                entities.push({
                    text: match,
                    type: type,
                    confidence: 0.8
                });
            });
        }

        return entities;
    }

    extractConcepts(text) {
        // Implementação simplificada de extração de conceitos
        const concepts = [];
        const conceptKeywords = {
            'banking': ['conta', 'saldo', 'transferencia', 'pagamento', 'cliente'],
            'technology': ['sistema', 'aplicacao', 'servidor', 'rede', 'banco'],
            'error': ['erro', 'falha', 'exception', 'timeout', 'conexao']
        };

        const words = text.toLowerCase().split(/\s+/);

        for (const [concept, keywords] of Object.entries(conceptKeywords)) {
            const matches = words.filter(word => keywords.includes(word));
            if (matches.length > 0) {
                concepts.push({
                    text: concept,
                    relevance: matches.length / words.length,
                    keywords: matches
                });
            }
        }

        return concepts.sort((a, b) => b.relevance - a.relevance);
    }
}

module.exports = CategoryManager;