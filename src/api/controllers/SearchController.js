const { Logger } = require('../../utils/Logger');
const { EnhancedSearchService } = require('../../services/EnhancedSearchService');
const { KnowledgeBaseRepository } = require('../../database/repositories/KnowledgeBaseRepository');
const { MetricsService } = require('../../services/MetricsService');
const { SemanticSearchEnhancer } = require('../../services/ml/SemanticSearchEnhancer');

const logger = new Logger('SearchController');

/**
 * Controller para operações de busca semântica e RAG
 * Implementa busca avançada com embedding vectors e retrieval-augmented generation
 */
class SearchController {
    constructor() {
        this.searchService = new EnhancedSearchService();
        this.knowledgeBase = new KnowledgeBaseRepository();
        this.metricsService = new MetricsService();
        this.semanticEnhancer = new SemanticSearchEnhancer();
        this.initialized = false;
    }

    /**
     * Inicializar dependências
     */
    async initialize() {
        try {
            if (!this.initialized) {
                await this.searchService.initialize();
                await this.knowledgeBase.initialize();
                await this.semanticEnhancer.initialize();
                this.initialized = true;
                logger.info('SearchController inicializado com sucesso');
            }
        } catch (error) {
            logger.error('Erro ao inicializar SearchController:', error);
            throw error;
        }
    }

    /**
     * Realizar busca semântica com RAG
     * @param {Object} searchParams - Parâmetros de busca
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Resultados da busca semântica
     */
    async performSemanticSearch(searchParams, user) {
        try {
            await this.ensureInitialized();

            const {
                query,
                type = 'all',
                limit = 10,
                threshold = 0.7,
                includeContext = true,
                category
            } = searchParams;

            logger.info(`Realizando busca semântica: "${query}" para tipo "${type}"`);

            // Gerar embedding da query
            const queryEmbedding = await this.semanticEnhancer.generateEmbedding(query);

            // Configurar parâmetros de busca
            const searchConfig = {
                query,
                queryEmbedding,
                type,
                limit,
                threshold,
                includeContext,
                category,
                userId: user.id,
                userPreferences: await this.getUserSearchPreferences(user.id)
            };

            // Realizar busca em paralelo em diferentes fontes
            const [
                knowledgeResults,
                incidentResults,
                solutionResults
            ] = await Promise.all([
                type === 'all' || type === 'knowledge' ? this.searchKnowledgeBase(searchConfig) : [],
                type === 'all' || type === 'incidents' ? this.searchIncidents(searchConfig) : [],
                type === 'all' || type === 'solutions' ? this.searchSolutions(searchConfig) : []
            ]);

            // Combinar e ranquear resultados
            const allResults = [
                ...knowledgeResults.map(r => ({ ...r, source: 'knowledge' })),
                ...incidentResults.map(r => ({ ...r, source: 'incidents' })),
                ...solutionResults.map(r => ({ ...r, source: 'solutions' }))
            ];

            // Aplicar re-ranking semântico
            const rankedResults = await this.semanticEnhancer.reRankResults(query, allResults);

            // Filtrar por threshold de similaridade
            const filteredResults = rankedResults.filter(result => result.similarity >= threshold);

            // Limitar resultados
            const finalResults = filteredResults.slice(0, limit);

            // Enriquecer com contexto adicional se solicitado
            if (includeContext) {
                await this.enrichResultsWithContext(finalResults);
            }

            // Gerar ID único para esta busca
            const searchId = this.generateSearchId();

            // Registrar busca para analytics
            await this.recordSearchQuery({
                searchId,
                query,
                type,
                userId: user.id,
                resultCount: finalResults.length,
                threshold,
                category
            });

            // Registrar métricas
            await this.metricsService.recordSemanticSearch({
                query,
                type,
                resultCount: finalResults.length,
                threshold,
                userId: user.id
            });

            return {
                success: true,
                data: {
                    searchId,
                    query,
                    results: finalResults,
                    metadata: {
                        totalFound: allResults.length,
                        afterFiltering: filteredResults.length,
                        returned: finalResults.length,
                        threshold,
                        searchType: type,
                        queryProcessingTime: await this.calculateProcessingTime()
                    }
                }
            };

        } catch (error) {
            logger.error('Erro na busca semântica:', error);
            throw error;
        }
    }

    /**
     * Encontrar conteúdo similar a um incidente específico
     * @param {Object} searchParams - Parâmetros de busca
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Conteúdo similar
     */
    async findSimilarContent(searchParams, user) {
        try {
            await this.ensureInitialized();

            const {
                incidentId,
                limit = 5,
                includeResolved = true
            } = searchParams;

            // Buscar o incidente de referência
            const referenceIncident = await this.findIncidentById(incidentId);

            if (!referenceIncident) {
                return {
                    success: false,
                    message: 'Incidente de referência não encontrado'
                };
            }

            // Gerar embedding do incidente de referência
            const referenceText = this.extractIncidentText(referenceIncident);
            const referenceEmbedding = await this.semanticEnhancer.generateEmbedding(referenceText);

            // Buscar conteúdo similar
            const similarContent = await this.searchSimilarByEmbedding({
                embedding: referenceEmbedding,
                limit,
                includeResolved,
                excludeId: incidentId,
                userId: user.id
            });

            // Organizar resultados por tipo
            const organizedResults = {
                similarIncidents: similarContent.filter(item => item.type === 'incident'),
                relatedSolutions: similarContent.filter(item => item.type === 'solution'),
                knowledgeArticles: similarContent.filter(item => item.type === 'knowledge')
            };

            return {
                success: true,
                data: {
                    referenceIncident: {
                        id: referenceIncident.id,
                        title: referenceIncident.title,
                        description: referenceIncident.description
                    },
                    similarContent: organizedResults,
                    metadata: {
                        totalFound: similarContent.length,
                        searchMethod: 'embedding_similarity'
                    }
                }
            };

        } catch (error) {
            logger.error('Erro ao buscar conteúdo similar:', error);
            throw error;
        }
    }

    /**
     * Obter sugestões de busca
     * @param {Object} suggestParams - Parâmetros para sugestões
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Sugestões de busca
     */
    async getSearchSuggestions(suggestParams, user) {
        try {
            await this.ensureInitialized();

            const {
                partial = '',
                limit = 10
            } = suggestParams;

            // Obter sugestões de diferentes fontes
            const [
                historySuggestions,
                trendingSuggestions,
                autocompleteSuggestions
            ] = await Promise.all([
                this.getUserSearchHistory(user.id, partial, Math.ceil(limit / 3)),
                this.getTrendingSearches(partial, Math.ceil(limit / 3)),
                this.getAutocompleteSuggestions(partial, Math.ceil(limit / 3))
            ]);

            // Combinar e deduplicar sugestões
            const allSuggestions = [
                ...historySuggestions.map(s => ({ ...s, source: 'history' })),
                ...trendingSuggestions.map(s => ({ ...s, source: 'trending' })),
                ...autocompleteSuggestions.map(s => ({ ...s, source: 'autocomplete' }))
            ];

            // Remover duplicatas
            const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);

            // Limitar e ordenar por relevância
            const finalSuggestions = uniqueSuggestions
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, limit);

            return {
                success: true,
                data: {
                    suggestions: finalSuggestions,
                    metadata: {
                        partial,
                        totalSources: 3,
                        returned: finalSuggestions.length
                    }
                }
            };

        } catch (error) {
            logger.error('Erro ao obter sugestões:', error);
            throw error;
        }
    }

    /**
     * Submeter feedback sobre relevância dos resultados
     * @param {Object} feedbackData - Dados do feedback
     * @param {Object} user - Usuário que submete
     * @returns {Object} Resultado do feedback
     */
    async submitSearchFeedback(feedbackData, user) {
        try {
            await this.ensureInitialized();

            const {
                searchId,
                resultId,
                relevance,
                helpful = null,
                comments = ''
            } = feedbackData;

            const enrichedFeedback = {
                searchId,
                resultId,
                relevance,
                helpful,
                comments,
                userId: user.id,
                timestamp: new Date().toISOString()
            };

            // Salvar feedback
            await this.saveFeedback(enrichedFeedback);

            // Usar feedback para treinamento do modelo
            await this.semanticEnhancer.processFeedback(enrichedFeedback);

            // Registrar métricas
            await this.metricsService.recordSearchFeedback({
                searchId,
                resultId,
                relevance,
                helpful,
                userId: user.id
            });

            logger.info(`Feedback de busca registrado: searchId=${searchId}, relevance=${relevance}`);

            return {
                success: true,
                message: 'Feedback registrado com sucesso',
                data: {
                    feedbackId: this.generateFeedbackId(),
                    recorded: true
                }
            };

        } catch (error) {
            logger.error('Erro ao submeter feedback:', error);
            throw error;
        }
    }

    /**
     * Obter analytics de busca
     * @param {Object} analyticsParams - Parâmetros para analytics
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Analytics de busca
     */
    async getSearchAnalytics(analyticsParams, user) {
        try {
            await this.ensureInitialized();

            const {
                timeframe = '7d',
                metric = 'all'
            } = analyticsParams;

            const analytics = await this.metricsService.getSearchAnalytics({
                timeframe,
                metric,
                userId: user.isAdmin ? null : user.id // Admin vê tudo, usuários só seus dados
            });

            return {
                success: true,
                data: {
                    ...analytics,
                    timeframe,
                    generatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Erro ao obter analytics:', error);
            throw error;
        }
    }

    /**
     * Health check do sistema de busca
     * @returns {Object} Status de saúde
     */
    async performHealthCheck() {
        try {
            const checks = await Promise.allSettled([
                this.checkSearchServiceHealth(),
                this.checkKnowledgeBaseHealth(),
                this.checkSemanticEnhancerHealth(),
                this.checkMetricsServiceHealth()
            ]);

            const results = checks.map((check, index) => {
                const componentNames = ['searchService', 'knowledgeBase', 'semanticEnhancer', 'metricsService'];
                return {
                    component: componentNames[index],
                    status: check.status === 'fulfilled' ? check.value.status : 'unhealthy',
                    details: check.status === 'fulfilled' ? check.value : { error: check.reason?.message }
                };
            });

            const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
            const degradedCount = results.filter(r => r.status === 'degraded').length;

            let overall = 'healthy';
            if (unhealthyCount > 0) {
                overall = 'unhealthy';
            } else if (degradedCount > 0) {
                overall = 'degraded';
            }

            return {
                overall,
                components: results,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Erro no health check:', error);
            return {
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ==================== MÉTODOS AUXILIARES ====================

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    generateSearchId() {
        return `search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    generateFeedbackId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    async getUserSearchPreferences(userId) {
        // TODO: Implementar busca de preferências do usuário
        return {
            preferredCategories: [],
            excludeCategories: [],
            preferredTypes: ['all']
        };
    }

    extractIncidentText(incident) {
        return `${incident.title || ''} ${incident.description || ''} ${incident.resolution || ''}`.trim();
    }

    async enrichResultsWithContext(results) {
        for (const result of results) {
            try {
                // Adicionar contexto baseado no tipo de resultado
                switch (result.source) {
                    case 'incidents':
                        result.context = await this.getIncidentContext(result.id);
                        break;
                    case 'knowledge':
                        result.context = await this.getKnowledgeContext(result.id);
                        break;
                    case 'solutions':
                        result.context = await this.getSolutionContext(result.id);
                        break;
                }
            } catch (error) {
                logger.warn(`Erro ao enriquecer contexto para resultado ${result.id}:`, error);
                result.context = null;
            }
        }
    }

    deduplicateSuggestions(suggestions) {
        const seen = new Set();
        return suggestions.filter(suggestion => {
            const key = suggestion.text.toLowerCase().trim();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async calculateProcessingTime() {
        // TODO: Implementar medição de tempo de processamento
        return 0;
    }

    // Métodos que devem ser implementados com integração real
    async searchKnowledgeBase(searchConfig) {
        // TODO: Implementar busca na base de conhecimento
        logger.info('Buscando na base de conhecimento:', searchConfig.query);
        return [];
    }

    async searchIncidents(searchConfig) {
        // TODO: Implementar busca em incidentes
        logger.info('Buscando em incidentes:', searchConfig.query);
        return [];
    }

    async searchSolutions(searchConfig) {
        // TODO: Implementar busca em soluções
        logger.info('Buscando em soluções:', searchConfig.query);
        return [];
    }

    async searchSimilarByEmbedding(searchConfig) {
        // TODO: Implementar busca por similaridade de embedding
        logger.info('Buscando por similaridade de embedding');
        return [];
    }

    async findIncidentById(incidentId) {
        // TODO: Implementar busca de incidente por ID
        logger.info('Buscando incidente por ID:', incidentId);
        return null;
    }

    async recordSearchQuery(searchData) {
        // TODO: Implementar registro de query de busca
        logger.info('Registrando query de busca:', searchData.searchId);
    }

    async getUserSearchHistory(userId, partial, limit) {
        // TODO: Implementar busca no histórico do usuário
        return [];
    }

    async getTrendingSearches(partial, limit) {
        // TODO: Implementar busca de tendências
        return [];
    }

    async getAutocompleteSuggestions(partial, limit) {
        // TODO: Implementar autocompletar
        return [];
    }

    async saveFeedback(feedbackData) {
        // TODO: Implementar salvamento de feedback
        logger.info('Salvando feedback:', feedbackData.searchId);
    }

    async getIncidentContext(incidentId) {
        // TODO: Implementar contexto de incidente
        return null;
    }

    async getKnowledgeContext(knowledgeId) {
        // TODO: Implementar contexto de conhecimento
        return null;
    }

    async getSolutionContext(solutionId) {
        // TODO: Implementar contexto de solução
        return null;
    }

    async checkSearchServiceHealth() {
        return { status: 'healthy', responseTime: 0 };
    }

    async checkKnowledgeBaseHealth() {
        return { status: 'healthy', connections: 1 };
    }

    async checkSemanticEnhancerHealth() {
        return { status: 'healthy', modelLoaded: true };
    }

    async checkMetricsServiceHealth() {
        return { status: 'healthy', collecting: true };
    }
}

module.exports = { SearchController };