/**
 * Similarity Search - Busca vetorial e análise de similaridade
 * Sistema de busca por similaridade usando embeddings e algoritmos de matching
 * com threshold configurável e ranking multi-critério
 */

const { OpenAI } = require('openai');
const logger = require('../../core/logging/Logger');
const { validateSearchQuery, sanitizeSearchInput } = require('./utils/InputValidator');
const { SimilaritySearchError } = require('./utils/LLMErrors');

class SimilaritySearch {
    constructor(config = {}) {
        this.config = {
            embeddings: {
                provider: config.embeddings?.provider || 'openai',
                model: config.embeddings?.model || 'text-embedding-3-small',
                dimensions: config.embeddings?.dimensions || 1536
            },
            search: {
                defaultThreshold: config.search?.defaultThreshold || 0.75,
                maxResults: config.search?.maxResults || 50,
                algorithms: config.search?.algorithms || ['cosine', 'euclidean'],
                weightingStrategy: config.search?.weightingStrategy || 'adaptive'
            },
            patterns: {
                enabled: config.patterns?.enabled || true,
                frequencyAnalysis: config.patterns?.frequencyAnalysis || true,
                temporalAnalysis: config.patterns?.temporalAnalysis || true,
                clusteringThreshold: config.patterns?.clusteringThreshold || 0.8
            },
            cache: {
                enabled: config.cache?.enabled || true,
                ttl: config.cache?.ttl || 1800, // 30 minutos
                maxSize: config.cache?.maxSize || 500
            }
        };

        this.initializeEmbeddingProvider();
        this.initializeCache();
        this.initializeSearchIndex();
    }

    /**
     * Inicializa provedor de embeddings
     */
    initializeEmbeddingProvider() {
        try {
            switch (this.config.embeddings.provider) {
                case 'openai':
                    this.embeddingClient = new OpenAI({
                        apiKey: process.env.OPENAI_API_KEY
                    });
                    break;
                default:
                    throw new Error(`Provider de embedding não suportado: ${this.config.embeddings.provider}`);
            }

            logger.info('Similarity search inicializado', {
                provider: this.config.embeddings.provider,
                model: this.config.embeddings.model
            });
        } catch (error) {
            logger.error('Erro ao inicializar similarity search', { error: error.message });
            throw new SimilaritySearchError(`Falha na inicialização: ${error.message}`);
        }
    }

    /**
     * Inicializa cache em memória
     */
    initializeCache() {
        if (this.config.cache.enabled) {
            this.cache = new Map();
            this.embeddingCache = new Map();
            this.cacheStats = {
                hits: 0,
                misses: 0,
                embeddingHits: 0,
                embeddingMisses: 0
            };
        }
    }

    /**
     * Inicializa índice de busca em memória
     */
    initializeSearchIndex() {
        this.searchIndex = {
            incidents: new Map(),
            patterns: new Map(),
            embeddings: new Map(),
            metadata: new Map()
        };
    }

    /**
     * Busca por incidentes similares
     * @param {Object} searchQuery - Objeto de busca com texto, filtros e configurações
     * @returns {Promise<Array>} Array de incidentes similares rankeados
     */
    async search(searchQuery) {
        try {
            const startTime = Date.now();

            // Validação e sanitização
            const validatedQuery = validateSearchQuery(searchQuery);
            const sanitizedQuery = sanitizeSearchInput(validatedQuery);

            logger.info('Iniciando busca por similaridade', {
                queryType: typeof sanitizedQuery.text,
                hasFilters: !!sanitizedQuery.filters,
                threshold: sanitizedQuery.threshold
            });

            // Configurações de busca
            const searchConfig = {
                text: sanitizedQuery.text,
                filters: sanitizedQuery.filters || {},
                threshold: sanitizedQuery.threshold || this.config.search.defaultThreshold,
                limit: sanitizedQuery.limit || 10,
                includeMetadata: sanitizedQuery.includeMetadata !== false,
                algorithms: sanitizedQuery.algorithms || this.config.search.algorithms,
                weightingStrategy: sanitizedQuery.weightingStrategy || this.config.search.weightingStrategy
            };

            // Verifica cache
            const cacheKey = this.generateSearchCacheKey(searchConfig);
            if (this.config.cache.enabled) {
                const cachedResult = this.getSearchFromCache(cacheKey);
                if (cachedResult) {
                    this.cacheStats.hits++;
                    logger.debug('Cache hit para busca por similaridade');
                    return cachedResult;
                }
                this.cacheStats.misses++;
            }

            // 1. Gera embedding da query
            const queryEmbedding = await this.generateQueryEmbedding(searchConfig.text);

            // 2. Busca similaridade usando algoritmos configurados
            const similarityResults = await this.performSimilaritySearch(queryEmbedding, searchConfig);

            // 3. Aplica filtros específicos
            const filteredResults = this.applyFilters(similarityResults, searchConfig.filters);

            // 4. Filtra por threshold
            const thresholdResults = this.applyThreshold(filteredResults, searchConfig.threshold);

            // 5. Ranking multi-critério
            const rankedResults = this.rankResults(thresholdResults, searchConfig);

            // 6. Aplica limite de resultados
            const limitedResults = rankedResults.slice(0, searchConfig.limit);

            // 7. Enriquece com metadados se solicitado
            const enrichedResults = searchConfig.includeMetadata ?
                await this.enrichWithMetadata(limitedResults) : limitedResults;

            const processingTime = Date.now() - startTime;

            logger.info('Busca por similaridade concluída', {
                resultsFound: enrichedResults.length,
                processingTime,
                threshold: searchConfig.threshold
            });

            // Cache do resultado
            if (this.config.cache.enabled) {
                this.setSearchCache(cacheKey, enrichedResults);
            }

            return enrichedResults;

        } catch (error) {
            logger.error('Erro na busca por similaridade', {
                error: error.message,
                stack: error.stack
            });
            throw new SimilaritySearchError(`Falha na busca: ${error.message}`);
        }
    }

    /**
     * Gera embedding para query de busca
     */
    async generateQueryEmbedding(text) {
        const cacheKey = `emb_${Buffer.from(text).toString('base64').substring(0, 20)}`;

        // Verifica cache de embeddings
        if (this.config.cache.enabled) {
            const cached = this.embeddingCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < (this.config.cache.ttl * 1000)) {
                this.cacheStats.embeddingHits++;
                return cached.embedding;
            }
        }

        try {
            let embedding;

            switch (this.config.embeddings.provider) {
                case 'openai':
                    const response = await this.embeddingClient.embeddings.create({
                        model: this.config.embeddings.model,
                        input: text.substring(0, 8000), // Trunca se muito longo
                        encoding_format: 'float'
                    });
                    embedding = response.data[0].embedding;
                    break;

                default:
                    throw new Error(`Provider não suportado: ${this.config.embeddings.provider}`);
            }

            // Cache do embedding
            if (this.config.cache.enabled) {
                this.embeddingCache.set(cacheKey, {
                    embedding,
                    timestamp: Date.now()
                });
                this.cacheStats.embeddingMisses++;
            }

            return embedding;

        } catch (error) {
            logger.error('Erro ao gerar embedding para busca', {
                provider: this.config.embeddings.provider,
                error: error.message
            });
            throw new SimilaritySearchError(`Falha na geração de embedding: ${error.message}`);
        }
    }

    /**
     * Executa busca por similaridade usando algoritmos configurados
     */
    async performSimilaritySearch(queryEmbedding, searchConfig) {
        const results = [];

        // Simula busca em base de incidentes (deve ser substituído por integração real)
        const incidents = await this.getIncidentsFromDatabase(searchConfig.filters);

        for (const incident of incidents) {
            try {
                // Gera ou recupera embedding do incidente
                const incidentEmbedding = await this.getIncidentEmbedding(incident);

                // Calcula similaridade usando algoritmos configurados
                const similarities = {};

                for (const algorithm of searchConfig.algorithms) {
                    similarities[algorithm] = this.calculateSimilarity(
                        queryEmbedding,
                        incidentEmbedding,
                        algorithm
                    );
                }

                // Score composto baseado na estratégia de ponderação
                const compositeScore = this.calculateCompositeScore(similarities, searchConfig.weightingStrategy);

                results.push({
                    ...incident,
                    similarities,
                    score: compositeScore,
                    searchMetadata: {
                        algorithms: searchConfig.algorithms,
                        weightingStrategy: searchConfig.weightingStrategy
                    }
                });

            } catch (error) {
                logger.warn('Erro ao processar incidente na busca', {
                    incidentId: incident.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Calcula similaridade entre dois vetores usando algoritmo especificado
     */
    calculateSimilarity(vector1, vector2, algorithm) {
        switch (algorithm) {
            case 'cosine':
                return this.cosineSimilarity(vector1, vector2);
            case 'euclidean':
                return this.euclideanSimilarity(vector1, vector2);
            case 'manhattan':
                return this.manhattanSimilarity(vector1, vector2);
            case 'dot_product':
                return this.dotProductSimilarity(vector1, vector2);
            default:
                throw new Error(`Algoritmo de similaridade não suportado: ${algorithm}`);
        }
    }

    /**
     * Similaridade coseno (padrão para embeddings)
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vetores devem ter o mesmo tamanho');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const norm = Math.sqrt(normA) * Math.sqrt(normB);
        return norm === 0 ? 0 : dotProduct / norm;
    }

    /**
     * Similaridade euclidiana (convertida para score 0-1)
     */
    euclideanSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vetores devem ter o mesmo tamanho');
        }

        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += Math.pow(a[i] - b[i], 2);
        }

        const distance = Math.sqrt(sum);
        // Converte distância em similaridade (0-1)
        return 1 / (1 + distance);
    }

    /**
     * Similaridade Manhattan
     */
    manhattanSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vetores devem ter o mesmo tamanho');
        }

        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += Math.abs(a[i] - b[i]);
        }

        const distance = sum;
        return 1 / (1 + distance);
    }

    /**
     * Produto escalar normalizado
     */
    dotProductSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vetores devem ter o mesmo tamanho');
        }

        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
        }

        // Normaliza para 0-1
        return Math.max(0, Math.min(1, (dotProduct + 1) / 2));
    }

    /**
     * Calcula score composto baseado em múltiplos algoritmos
     */
    calculateCompositeScore(similarities, weightingStrategy) {
        const algorithms = Object.keys(similarities);

        switch (weightingStrategy) {
            case 'uniform':
                // Peso igual para todos os algoritmos
                return algorithms.reduce((sum, alg) => sum + similarities[alg], 0) / algorithms.length;

            case 'cosine_heavy':
                // Prioriza similaridade coseno
                const weights = {
                    cosine: 0.6,
                    euclidean: 0.25,
                    manhattan: 0.1,
                    dot_product: 0.05
                };
                return algorithms.reduce((sum, alg) => {
                    const weight = weights[alg] || (1 / algorithms.length);
                    return sum + (similarities[alg] * weight);
                }, 0);

            case 'adaptive':
                // Peso baseado na performance de cada algoritmo
                return this.calculateAdaptiveScore(similarities);

            case 'best':
                // Usa apenas o melhor score
                return Math.max(...Object.values(similarities));

            default:
                return similarities.cosine || Object.values(similarities)[0] || 0;
        }
    }

    /**
     * Calcula score adaptivo baseado na variância dos algoritmos
     */
    calculateAdaptiveScore(similarities) {
        const scores = Object.values(similarities);
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;

        // Calcula variância
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

        // Se variância é baixa (algoritmos concordam), usa média
        // Se variância é alta (algoritmos divergem), usa máximo
        const varianceThreshold = 0.05;

        return variance < varianceThreshold ? mean : Math.max(...scores);
    }

    /**
     * Aplica filtros específicos aos resultados
     */
    applyFilters(results, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return results;
        }

        return results.filter(result => {
            for (const [key, value] of Object.entries(filters)) {
                switch (key) {
                    case 'type':
                        if (result.type !== value) return false;
                        break;
                    case 'category':
                        if (result.category !== value) return false;
                        break;
                    case 'priority':
                        if (Array.isArray(value)) {
                            if (!value.includes(result.priority)) return false;
                        } else {
                            if (result.priority !== value) return false;
                        }
                        break;
                    case 'resolved':
                        if (result.resolved !== value) return false;
                        break;
                    case 'timeRange':
                        if (!this.isWithinTimeRange(result.createdAt, value)) return false;
                        break;
                    case 'systems':
                        if (!this.hasSystemOverlap(result.affectedSystems, value)) return false;
                        break;
                    default:
                        // Filtro customizado
                        if (result[key] !== value) return false;
                }
            }
            return true;
        });
    }

    /**
     * Verifica se data está dentro do range temporal
     */
    isWithinTimeRange(date, timeRange) {
        const now = new Date();
        const incidentDate = new Date(date);

        switch (timeRange) {
            case '24h':
                return (now - incidentDate) <= (24 * 60 * 60 * 1000);
            case '7d':
                return (now - incidentDate) <= (7 * 24 * 60 * 60 * 1000);
            case '30d':
                return (now - incidentDate) <= (30 * 24 * 60 * 60 * 1000);
            case '90d':
                return (now - incidentDate) <= (90 * 24 * 60 * 60 * 1000);
            default:
                return true;
        }
    }

    /**
     * Verifica overlap entre sistemas afetados
     */
    hasSystemOverlap(incidentSystems, filterSystems) {
        if (!incidentSystems || !filterSystems) return true;

        const incidentSet = new Set(incidentSystems.map(s => s.toLowerCase()));
        const filterSet = new Set(filterSystems.map(s => s.toLowerCase()));

        // Verifica se há interseção
        for (const system of filterSet) {
            if (incidentSet.has(system)) return true;
        }

        return false;
    }

    /**
     * Aplica threshold de similaridade
     */
    applyThreshold(results, threshold) {
        return results.filter(result => result.score >= threshold);
    }

    /**
     * Rankeia resultados por múltiplos critérios
     */
    rankResults(results, searchConfig) {
        return results.map(result => {
            // Critérios de ranking
            const rankingFactors = {
                similarity: result.score,
                recency: this.calculateRecencyFactor(result.createdAt),
                resolution: this.calculateResolutionFactor(result),
                complexity: this.calculateComplexityFactor(result),
                authority: this.calculateAuthorityFactor(result)
            };

            // Pesos dos critérios (configurável)
            const weights = {
                similarity: 0.5,
                recency: 0.2,
                resolution: 0.15,
                complexity: 0.1,
                authority: 0.05
            };

            // Score final ponderado
            const finalScore = Object.keys(rankingFactors).reduce(
                (total, factor) => total + (rankingFactors[factor] * weights[factor]),
                0
            );

            return {
                ...result,
                rankingFactors,
                finalScore
            };
        }).sort((a, b) => b.finalScore - a.finalScore);
    }

    /**
     * Fatores de ranking
     */
    calculateRecencyFactor(createdAt) {
        const daysSince = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
        return Math.exp(-daysSince / 90); // Decay exponencial over 90 dias
    }

    calculateResolutionFactor(incident) {
        if (!incident.resolved) return 0.3;
        if (incident.resolutionTime) {
            // Prioriza resoluções rápidas
            const hours = incident.resolutionTime / (1000 * 60 * 60);
            return Math.max(0.5, 1 - (hours / 48)); // Normaliza por 48h
        }
        return 0.7;
    }

    calculateComplexityFactor(incident) {
        // Complexidade baseada em número de sistemas e tempo de resolução
        const systemCount = incident.affectedSystems?.length || 1;
        const complexity = Math.min(1, systemCount / 5); // Normaliza por 5 sistemas
        return 1 - complexity; // Inverte - menor complexidade = maior score
    }

    calculateAuthorityFactor(incident) {
        const authorityScores = {
            'expert': 1.0,
            'senior': 0.8,
            'regular': 0.6,
            'junior': 0.4
        };

        return authorityScores[incident.resolverLevel] || 0.5;
    }

    /**
     * Enriquece resultados com metadados adicionais
     */
    async enrichWithMetadata(results) {
        return results.map(result => ({
            ...result,
            enrichment: {
                searchAlgorithms: result.searchMetadata?.algorithms,
                confidenceLevel: this.calculateConfidenceLevel(result),
                relatedIncidents: this.findRelatedIncidents(result),
                recommendationStrength: this.calculateRecommendationStrength(result)
            }
        }));
    }

    calculateConfidenceLevel(result) {
        const score = result.finalScore || result.score;
        if (score >= 0.9) return 'very_high';
        if (score >= 0.8) return 'high';
        if (score >= 0.7) return 'medium';
        if (score >= 0.6) return 'low';
        return 'very_low';
    }

    findRelatedIncidents(result) {
        // Placeholder - implementar busca de incidentes relacionados
        return [];
    }

    calculateRecommendationStrength(result) {
        const factors = result.rankingFactors || {};
        const avgFactor = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
        return avgFactor > 0.8 ? 'strong' : avgFactor > 0.6 ? 'moderate' : 'weak';
    }

    /**
     * Análise de padrões em incidentes
     */
    async findPatterns(searchCriteria) {
        try {
            logger.info('Iniciando análise de padrões', { criteria: searchCriteria });

            const incidents = await this.getIncidentsForPatternAnalysis(searchCriteria);

            const patterns = {
                frequency: this.analyzeFrequencyPatterns(incidents),
                temporal: this.analyzeTemporalPatterns(incidents),
                system: this.analyzeSystemPatterns(incidents),
                resolution: this.analyzeResolutionPatterns(incidents)
            };

            return patterns;

        } catch (error) {
            logger.error('Erro na análise de padrões', { error: error.message });
            throw new SimilaritySearchError(`Falha na análise de padrões: ${error.message}`);
        }
    }

    /**
     * Análise de padrões de frequência
     */
    analyzeFrequencyPatterns(incidents) {
        const frequencies = new Map();

        incidents.forEach(incident => {
            const key = `${incident.type}_${incident.category}`;
            frequencies.set(key, (frequencies.get(key) || 0) + 1);
        });

        const sortedFrequencies = Array.from(frequencies.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            topPatterns: sortedFrequencies.map(([pattern, count]) => ({
                pattern,
                count,
                percentage: (count / incidents.length) * 100
            })),
            totalIncidents: incidents.length,
            uniquePatterns: frequencies.size
        };
    }

    /**
     * Análise de padrões temporais
     */
    analyzeTemporalPatterns(incidents) {
        const hourly = new Array(24).fill(0);
        const daily = new Array(7).fill(0);
        const monthly = new Array(12).fill(0);

        incidents.forEach(incident => {
            const date = new Date(incident.createdAt);
            hourly[date.getHours()]++;
            daily[date.getDay()]++;
            monthly[date.getMonth()]++;
        });

        return {
            peakHours: this.findPeaks(hourly),
            peakDays: this.findPeaks(daily),
            peakMonths: this.findPeaks(monthly),
            patterns: {
                hourly,
                daily,
                monthly
            }
        };
    }

    findPeaks(data) {
        const max = Math.max(...data);
        return data.map((value, index) => ({ index, value }))
                  .filter(item => item.value === max)
                  .map(item => item.index);
    }

    /**
     * Cache management
     */
    generateSearchCacheKey(searchConfig) {
        const keyData = {
            text: searchConfig.text,
            filters: searchConfig.filters,
            threshold: searchConfig.threshold,
            limit: searchConfig.limit
        };
        return `search_${Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 20)}`;
    }

    getSearchFromCache(key) {
        if (!this.config.cache.enabled) return null;

        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < (this.config.cache.ttl * 1000)) {
            return cached.data;
        }

        if (cached) {
            this.cache.delete(key);
        }

        return null;
    }

    setSearchCache(key, data) {
        if (!this.config.cache.enabled) return;

        // Remove cache antigo se necessário
        if (this.cache.size >= this.config.cache.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Métodos de integração (placeholders - implementar conforme banco de dados)
     */
    async getIncidentsFromDatabase(filters) {
        // Placeholder - integrar com banco de dados real
        return [];
    }

    async getIncidentEmbedding(incident) {
        // Gera ou recupera embedding do incidente
        const text = `${incident.title} ${incident.description}`;
        return this.generateQueryEmbedding(text);
    }

    async getIncidentsForPatternAnalysis(criteria) {
        // Placeholder - buscar incidentes para análise de padrões
        return [];
    }

    /**
     * Estatísticas e health check
     */
    getStats() {
        return {
            cache: this.cacheStats,
            config: this.config,
            index: {
                incidents: this.searchIndex.incidents.size,
                patterns: this.searchIndex.patterns.size,
                embeddings: this.searchIndex.embeddings.size
            }
        };
    }

    async healthCheck() {
        try {
            // Testa geração de embedding
            await this.generateQueryEmbedding('health check test');

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    embeddingProvider: 'connected',
                    cache: this.config.cache.enabled ? 'enabled' : 'disabled',
                    searchIndex: 'loaded'
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = SimilaritySearch;