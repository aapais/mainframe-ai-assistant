const { Logger } = require('../../utils/Logger');
const { IncidentResolutionEngine } = require('../../controllers/IncidentResolutionEngine');
const { KnowledgeBaseRepository } = require('../../database/repositories/KnowledgeBaseRepository');
const { ValidationService } = require('../../services/ValidationService');
const { MetricsService } = require('../../services/MetricsService');

const logger = new Logger('IncidentController');

/**
 * Controller para operações de incidentes
 * Implementa a lógica de negócio para CRUD e processamento de incidentes
 */
class IncidentController {
    constructor() {
        this.resolutionEngine = null;
        this.knowledgeBase = new KnowledgeBaseRepository();
        this.validationService = new ValidationService();
        this.metricsService = new MetricsService();
    }

    /**
     * Inicializar dependências
     */
    async initialize() {
        try {
            if (!this.resolutionEngine) {
                this.resolutionEngine = new IncidentResolutionEngine();
                await this.resolutionEngine.initialize();
            }

            await this.knowledgeBase.initialize();
            logger.info('IncidentController inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar IncidentController:', error);
            throw error;
        }
    }

    /**
     * Criar novo incidente
     * @param {Object} incidentData - Dados do incidente
     * @param {Object} user - Usuário que criou
     * @returns {Object} Resultado da criação
     */
    async createIncident(incidentData, user) {
        try {
            await this.ensureInitialized();

            // Validar dados específicos do domínio
            const validationResult = await this.validationService.validateIncidentData(incidentData);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    errors: validationResult.errors,
                    message: 'Dados de incidente inválidos'
                };
            }

            // Enriquecer dados do incidente
            const enrichedData = {
                ...incidentData,
                id: this.generateIncidentId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: user.id,
                status: 'created',
                resolution: null,
                resolvedAt: null,
                resolvedBy: null,
                timeToResolve: null,
                escalationLevel: 0,
                watchers: [user.id],
                history: [{
                    action: 'created',
                    timestamp: new Date().toISOString(),
                    userId: user.id,
                    details: 'Incidente criado'
                }]
            };

            // Classificar automaticamente
            const classification = await this.classifyIncident(enrichedData);
            enrichedData.category = classification.category || enrichedData.category;
            enrichedData.subcategory = classification.subcategory;
            enrichedData.suggestedAssignee = classification.suggestedAssignee;
            enrichedData.estimatedResolutionTime = classification.estimatedTime;

            // Processar com engine de resolução
            const processResult = await this.resolutionEngine.processIncident(enrichedData);

            // Salvar no banco de dados
            const savedIncident = await this.saveIncident({
                ...enrichedData,
                ...processResult.additionalData
            });

            // Registrar métricas
            await this.metricsService.recordIncidentCreated({
                category: savedIncident.category,
                priority: savedIncident.priority,
                severity: savedIncident.severity,
                userId: user.id
            });

            return {
                success: true,
                data: savedIncident,
                suggestions: processResult.suggestions || [],
                similarIncidents: processResult.similarIncidents || [],
                message: 'Incidente criado e processado com sucesso'
            };

        } catch (error) {
            logger.error('Erro ao criar incidente:', error);
            throw error;
        }
    }

    /**
     * Listar incidentes com filtros e busca
     * @param {Object} filters - Filtros de busca
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Lista de incidentes
     */
    async listIncidents(filters, user) {
        try {
            await this.ensureInitialized();

            const {
                page = 1,
                limit = 20,
                search,
                status,
                priority,
                severity,
                category,
                assignedTo,
                dateFrom,
                dateTo,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            // Construir query de busca
            const searchParams = {
                page: parseInt(page),
                limit: parseInt(limit),
                sortBy,
                sortOrder,
                userId: user.id,
                userRole: user.role
            };

            // Aplicar filtros
            if (search) {
                searchParams.search = search;
            }
            if (status) {
                searchParams.status = Array.isArray(status) ? status : [status];
            }
            if (priority) {
                searchParams.priority = Array.isArray(priority) ? priority : [priority];
            }
            if (severity) {
                searchParams.severity = Array.isArray(severity) ? severity : [severity];
            }
            if (category) {
                searchParams.category = category;
            }
            if (assignedTo) {
                searchParams.assignedTo = assignedTo;
            }
            if (dateFrom) {
                searchParams.dateFrom = dateFrom;
            }
            if (dateTo) {
                searchParams.dateTo = dateTo;
            }

            // Buscar incidentes
            const incidents = await this.searchIncidents(searchParams);

            // Registrar métricas de busca
            await this.metricsService.recordSearch({
                type: 'incidents',
                filters: searchParams,
                resultCount: incidents.data.length,
                userId: user.id
            });

            return {
                success: true,
                data: incidents.data,
                pagination: incidents.pagination,
                filters: searchParams,
                totalItems: incidents.totalItems
            };

        } catch (error) {
            logger.error('Erro ao listar incidentes:', error);
            throw error;
        }
    }

    /**
     * Obter incidente por ID
     * @param {string} incidentId - ID do incidente
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Dados do incidente
     */
    async getIncidentById(incidentId, user) {
        try {
            await this.ensureInitialized();

            const incident = await this.findIncidentById(incidentId, user);

            if (!incident) {
                return {
                    success: false,
                    message: 'Incidente não encontrado',
                    code: 'INCIDENT_NOT_FOUND'
                };
            }

            // Verificar permissões de acesso
            if (!this.canUserAccessIncident(user, incident)) {
                return {
                    success: false,
                    message: 'Acesso negado ao incidente',
                    code: 'ACCESS_DENIED'
                };
            }

            // Buscar incidentes relacionados
            const relatedIncidents = await this.findRelatedIncidents(incident);

            // Buscar sugestões de resolução atualizadas
            const suggestions = await this.resolutionEngine.getSuggestions(incident);

            return {
                success: true,
                data: {
                    ...incident,
                    relatedIncidents,
                    suggestions,
                    canEdit: this.canUserEditIncident(user, incident),
                    canResolve: this.canUserResolveIncident(user, incident)
                }
            };

        } catch (error) {
            logger.error('Erro ao buscar incidente:', error);
            throw error;
        }
    }

    /**
     * Atualizar status do incidente
     * @param {string} incidentId - ID do incidente
     * @param {Object} updateData - Dados de atualização
     * @param {Object} user - Usuário que atualiza
     * @returns {Object} Resultado da atualização
     */
    async updateIncidentStatus(incidentId, updateData, user) {
        try {
            await this.ensureInitialized();

            const incident = await this.findIncidentById(incidentId, user);

            if (!incident) {
                return {
                    success: false,
                    message: 'Incidente não encontrado'
                };
            }

            if (!this.canUserEditIncident(user, incident)) {
                return {
                    success: false,
                    message: 'Sem permissão para editar este incidente'
                };
            }

            // Validar transição de status
            const statusTransition = this.validateStatusTransition(incident.status, updateData.status);
            if (!statusTransition.isValid) {
                return {
                    success: false,
                    message: statusTransition.message,
                    errors: statusTransition.errors
                };
            }

            // Preparar dados de atualização
            const updateFields = {
                status: updateData.status,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id
            };

            // Adicionar campos específicos por status
            if (updateData.status === 'resolved' || updateData.status === 'closed') {
                updateFields.resolvedAt = new Date().toISOString();
                updateFields.resolvedBy = updateData.resolvedBy || user.id;
                updateFields.resolution = updateData.resolution;
                updateFields.timeToResolve = this.calculateTimeToResolve(incident.createdAt);
            }

            if (updateData.status === 'assigned' && updateData.assignedTo) {
                updateFields.assignedTo = updateData.assignedTo;
                updateFields.assignedAt = new Date().toISOString();
            }

            // Adicionar ao histórico
            const historyEntry = {
                action: 'status_updated',
                timestamp: new Date().toISOString(),
                userId: user.id,
                details: `Status alterado de '${incident.status}' para '${updateData.status}'`,
                previousStatus: incident.status,
                newStatus: updateData.status
            };

            updateFields.history = [...(incident.history || []), historyEntry];

            // Atualizar no banco
            const updatedIncident = await this.updateIncident(incidentId, updateFields);

            // Registrar métricas
            await this.metricsService.recordStatusChange({
                incidentId,
                fromStatus: incident.status,
                toStatus: updateData.status,
                userId: user.id,
                timeToResolve: updateFields.timeToResolve
            });

            // Treinar modelo com feedback se resolvido
            if (updateData.status === 'resolved' && updateData.resolution) {
                await this.resolutionEngine.submitResolutionFeedback(incidentId, {
                    effectiveness: 1.0, // Assumir efetivo se marcado como resolvido
                    resolution: updateData.resolution,
                    timeToResolve: updateFields.timeToResolve
                });
            }

            return {
                success: true,
                data: updatedIncident,
                message: 'Status do incidente atualizado com sucesso'
            };

        } catch (error) {
            logger.error('Erro ao atualizar status:', error);
            throw error;
        }
    }

    /**
     * Submeter feedback de resolução
     * @param {string} incidentId - ID do incidente
     * @param {Object} feedbackData - Dados do feedback
     * @param {Object} user - Usuário que submete
     * @returns {Object} Resultado do feedback
     */
    async submitResolutionFeedback(incidentId, feedbackData, user) {
        try {
            await this.ensureInitialized();

            const incident = await this.findIncidentById(incidentId, user);

            if (!incident) {
                return {
                    success: false,
                    message: 'Incidente não encontrado'
                };
            }

            if (incident.status !== 'resolved' && incident.status !== 'closed') {
                return {
                    success: false,
                    message: 'Feedback só pode ser submetido para incidentes resolvidos'
                };
            }

            const enrichedFeedback = {
                ...feedbackData,
                incidentId,
                submittedBy: user.id,
                submittedAt: new Date().toISOString()
            };

            // Submeter para o engine de resolução para aprendizado
            const result = await this.resolutionEngine.submitResolutionFeedback(incidentId, enrichedFeedback);

            // Salvar feedback no banco
            await this.saveFeedback(enrichedFeedback);

            // Registrar métricas
            await this.metricsService.recordFeedback({
                incidentId,
                effectiveness: feedbackData.effectiveness,
                satisfaction: feedbackData.userSatisfaction,
                userId: user.id
            });

            return {
                success: true,
                data: result,
                message: 'Feedback submetido com sucesso'
            };

        } catch (error) {
            logger.error('Erro ao submeter feedback:', error);
            throw error;
        }
    }

    /**
     * Obter métricas de incidentes
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Métricas
     */
    async getIncidentMetrics(user) {
        try {
            if (!user.isAdmin && !user.role === 'manager') {
                return {
                    success: false,
                    message: 'Acesso negado às métricas'
                };
            }

            await this.ensureInitialized();

            const engineMetrics = this.resolutionEngine.getMetrics();
            const dbMetrics = await this.getMetricsFromDatabase();
            const serviceMetrics = await this.metricsService.getIncidentMetrics();

            return {
                success: true,
                data: {
                    ...engineMetrics,
                    ...dbMetrics,
                    ...serviceMetrics,
                    generatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Erro ao obter métricas:', error);
            throw error;
        }
    }

    /**
     * Health check do sistema
     * @param {Object} user - Usuário solicitante
     * @returns {Object} Status de saúde
     */
    async performHealthCheck(user) {
        try {
            if (!user.isAdmin) {
                return {
                    success: false,
                    message: 'Acesso negado ao health check'
                };
            }

            await this.ensureInitialized();

            const healthStatus = await this.resolutionEngine.performHealthCheck();
            const dbHealth = await this.checkDatabaseHealth();
            const serviceHealth = await this.checkServicesHealth();

            const overall = this.calculateOverallHealth([
                healthStatus.overall,
                dbHealth.status,
                serviceHealth.status
            ]);

            return {
                success: overall !== 'unhealthy',
                data: {
                    overall,
                    components: {
                        resolutionEngine: healthStatus,
                        database: dbHealth,
                        services: serviceHealth
                    },
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Erro no health check:', error);
            return {
                success: false,
                data: {
                    overall: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    // ==================== MÉTODOS AUXILIARES ====================

    async ensureInitialized() {
        if (!this.resolutionEngine) {
            await this.initialize();
        }
    }

    generateIncidentId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `INC-${timestamp}-${random}`.toUpperCase();
    }

    async classifyIncident(incidentData) {
        try {
            // Usar engine de resolução para classificação automática
            return await this.resolutionEngine.classifyIncident(incidentData);
        } catch (error) {
            logger.warn('Erro na classificação automática:', error);
            return {
                category: incidentData.category,
                subcategory: null,
                suggestedAssignee: null,
                estimatedTime: null
            };
        }
    }

    calculateTimeToResolve(createdAt) {
        const created = new Date(createdAt);
        const resolved = new Date();
        return Math.floor((resolved - created) / 1000); // Segundos
    }

    validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'created': ['assigned', 'in_progress', 'cancelled'],
            'assigned': ['in_progress', 'created', 'cancelled'],
            'in_progress': ['resolved', 'assigned', 'cancelled'],
            'resolved': ['closed', 'in_progress'],
            'closed': [], // Status final
            'cancelled': ['created'] // Pode reabrir
        };

        const allowed = validTransitions[currentStatus] || [];

        if (!allowed.includes(newStatus)) {
            return {
                isValid: false,
                message: `Transição de '${currentStatus}' para '${newStatus}' não é permitida`,
                errors: [`Invalid status transition: ${currentStatus} -> ${newStatus}`]
            };
        }

        return { isValid: true };
    }

    canUserAccessIncident(user, incident) {
        // Admin pode acessar tudo
        if (user.isAdmin || user.role === 'admin') {
            return true;
        }

        // Usuário pode acessar seus próprios incidentes
        if (incident.createdBy === user.id) {
            return true;
        }

        // Usuário pode acessar incidentes atribuídos a ele
        if (incident.assignedTo === user.id) {
            return true;
        }

        // Usuário pode acessar incidentes que está observando
        if (incident.watchers && incident.watchers.includes(user.id)) {
            return true;
        }

        // Managers podem acessar incidentes de sua equipe
        if (user.role === 'manager' && incident.teamId === user.teamId) {
            return true;
        }

        return false;
    }

    canUserEditIncident(user, incident) {
        // Admin pode editar tudo
        if (user.isAdmin || user.role === 'admin') {
            return true;
        }

        // Não pode editar incidentes fechados
        if (incident.status === 'closed') {
            return false;
        }

        // Criador pode editar
        if (incident.createdBy === user.id) {
            return true;
        }

        // Responsável pode editar
        if (incident.assignedTo === user.id) {
            return true;
        }

        // Manager pode editar incidentes da equipe
        if (user.role === 'manager' && incident.teamId === user.teamId) {
            return true;
        }

        return false;
    }

    canUserResolveIncident(user, incident) {
        // Admin pode resolver tudo
        if (user.isAdmin || user.role === 'admin') {
            return true;
        }

        // Só pode resolver se estiver em progresso
        if (incident.status !== 'in_progress') {
            return false;
        }

        // Responsável pode resolver
        if (incident.assignedTo === user.id) {
            return true;
        }

        // Manager pode resolver incidentes da equipe
        if (user.role === 'manager' && incident.teamId === user.teamId) {
            return true;
        }

        return false;
    }

    calculateOverallHealth(componentStatuses) {
        const unhealthyCount = componentStatuses.filter(status => status === 'unhealthy').length;
        const degradedCount = componentStatuses.filter(status => status === 'degraded').length;

        if (unhealthyCount > 0) {
            return 'unhealthy';
        } else if (degradedCount > 0) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    // Métodos que devem ser implementados com integração real do banco de dados
    async saveIncident(incidentData) {
        // TODO: Implementar com repositório real
        logger.info('Salvando incidente:', incidentData.id);
        return incidentData;
    }

    async searchIncidents(searchParams) {
        // TODO: Implementar busca real no banco
        logger.info('Buscando incidentes com parâmetros:', searchParams);
        return {
            data: [],
            pagination: {
                currentPage: searchParams.page,
                totalPages: 0,
                totalItems: 0,
                limit: searchParams.limit
            },
            totalItems: 0
        };
    }

    async findIncidentById(incidentId, user) {
        // TODO: Implementar busca real no banco
        logger.info('Buscando incidente por ID:', incidentId);
        return null;
    }

    async findRelatedIncidents(incident) {
        // TODO: Implementar busca de incidentes relacionados
        return [];
    }

    async updateIncident(incidentId, updateFields) {
        // TODO: Implementar atualização real no banco
        logger.info('Atualizando incidente:', incidentId, updateFields);
        return { id: incidentId, ...updateFields };
    }

    async saveFeedback(feedbackData) {
        // TODO: Implementar salvamento de feedback
        logger.info('Salvando feedback:', feedbackData);
        return feedbackData;
    }

    async getMetricsFromDatabase() {
        // TODO: Implementar métricas do banco
        return {
            totalIncidents: 0,
            openIncidents: 0,
            resolvedIncidents: 0,
            averageResolutionTime: 0
        };
    }

    async checkDatabaseHealth() {
        // TODO: Implementar check de saúde do banco
        return {
            status: 'healthy',
            responseTime: 0,
            connections: 0
        };
    }

    async checkServicesHealth() {
        // TODO: Implementar check de saúde dos serviços
        return {
            status: 'healthy',
            services: []
        };
    }
}

module.exports = { IncidentController };