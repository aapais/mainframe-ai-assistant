/**
 * AutoRouter - Sistema de Roteamento Automático Baseado em SLA
 *
 * Responsável por rotear incidentes automaticamente para as equipes corretas
 * com base na categorização, SLA, capacidade das equipes e prioridades.
 */

const TaxonomyManager = require('./TaxonomyManager');

class AutoRouter {
    constructor(options = {}) {
        this.taxonomyManager = new TaxonomyManager();
        this.options = {
            enableLoadBalancing: options.enableLoadBalancing !== false,
            enableEscalation: options.enableEscalation !== false,
            enableCapacityCheck: options.enableCapacityCheck !== false,
            defaultSLA: options.defaultSLA || 60, // minutos
            escalationThreshold: options.escalationThreshold || 0.8, // 80% do SLA
            maxRetries: options.maxRetries || 3,
            enableBusinessHours: options.enableBusinessHours !== false,
            businessHours: options.businessHours || {
                start: '08:00',
                end: '18:00',
                timezone: 'America/Sao_Paulo',
                weekdays: [1, 2, 3, 4, 5] // Segunda a sexta
            },
            ...options
        };

        // Estado das equipes e filas
        this.teamCapacity = new Map();
        this.teamWorkload = new Map();
        this.activeIncidents = new Map();
        this.escalationHistory = new Map();
        this.routingHistory = [];

        // Métricas de roteamento
        this.metrics = {
            totalRoutings: 0,
            successfulRoutings: 0,
            escalations: 0,
            averageRoutingTime: 0,
            slaBreaches: 0,
            teamUtilization: new Map(),
            routingsByPriority: new Map(),
            routingsByCategory: new Map()
        };

        this.initialize();
    }

    /**
     * Inicializa o sistema de roteamento
     */
    async initialize() {
        try {
            // Carrega configuração das equipes
            await this.loadTeamConfiguration();

            // Inicializa monitoramento de capacidade
            this.initializeCapacityMonitoring();

            // Inicia verificação de escalação
            this.startEscalationMonitoring();

            console.log('AutoRouter initialized successfully');
        } catch (error) {
            console.error('Error initializing AutoRouter:', error);
            throw error;
        }
    }

    /**
     * Roteia incidente automaticamente
     */
    async routeIncident(incident, classification) {
        const startTime = Date.now();

        try {
            // Valida entrada
            this.validateInput(incident, classification);

            // Determina equipe de destino
            const routingDecision = await this.determineTargetTeam(incident, classification);

            // Verifica disponibilidade e capacidade
            const availabilityCheck = await this.checkTeamAvailability(routingDecision);

            // Aplica balanceamento de carga se necessário
            const finalRouting = await this.applyLoadBalancing(availabilityCheck, incident, classification);

            // Calcula SLA ajustado
            const adjustedSLA = this.calculateAdjustedSLA(finalRouting, incident);

            // Cria roteamento final
            const routing = {
                id: this.generateRoutingId(),
                incident: incident,
                classification: classification,
                targetTeam: finalRouting.team,
                assignedTo: finalRouting.assignedTo || null,
                priority: this.calculatePriority(incident, classification),
                sla: adjustedSLA,
                escalationPath: this.buildEscalationPath(finalRouting.team, classification),
                routingReason: finalRouting.reason,
                routingScore: finalRouting.score,
                timestamp: new Date().toISOString(),
                estimatedResolutionTime: this.estimateResolutionTime(finalRouting.team, classification),
                businessHoursAdjustment: this.isBusinessHours() ? 1.0 : 0.7,
                status: 'routed'
            };

            // Registra roteamento
            await this.registerRouting(routing);

            // Atualiza métricas
            this.updateRoutingMetrics(routing, Date.now() - startTime);

            // Agenda verificação de escalação
            this.scheduleEscalationCheck(routing);

            return routing;

        } catch (error) {
            console.error('Error routing incident:', error);
            this.metrics.totalRoutings++;

            // Retorna roteamento de fallback
            return this.createFallbackRouting(incident, classification, error);
        }
    }

    /**
     * Determina equipe de destino baseada na classificação
     */
    async determineTargetTeam(incident, classification) {
        const candidates = [];

        // Obtém informações de roteamento da taxonomia
        const primaryCategory = classification.classification?.primaryCategory;
        if (primaryCategory && primaryCategory.taxonomy) {
            const routingInfo = primaryCategory.taxonomy.routing;
            if (routingInfo) {
                candidates.push({
                    team: routingInfo.team,
                    score: primaryCategory.confidence,
                    reason: 'primary_classification',
                    escalationTo: routingInfo.escalation,
                    sla: routingInfo.sla
                });
            }
        }

        // Considera categorias alternativas
        const alternatives = classification.classification?.alternatives || [];
        for (const alt of alternatives.slice(0, 3)) { // Top 3 alternativas
            if (alt.taxonomy && alt.taxonomy.routing) {
                candidates.push({
                    team: alt.taxonomy.routing.team,
                    score: alt.confidence * 0.8, // Penaliza alternativas
                    reason: 'alternative_classification',
                    escalationTo: alt.taxonomy.routing.escalation,
                    sla: alt.taxonomy.routing.sla
                });
            }
        }

        // Considera histórico de incidentes similares
        const historicalMatch = await this.findHistoricalMatch(incident);
        if (historicalMatch) {
            candidates.push({
                team: historicalMatch.team,
                score: historicalMatch.similarity * 0.6,
                reason: 'historical_match',
                escalationTo: historicalMatch.escalationTo,
                sla: historicalMatch.avgResolutionTime
            });
        }

        // Adiciona roteamento baseado em keywords críticas
        const keywordMatch = this.getKeywordBasedRouting(incident);
        if (keywordMatch) {
            candidates.push(keywordMatch);
        }

        // Seleciona melhor candidato
        if (candidates.length === 0) {
            return this.getDefaultRouting(incident);
        }

        return candidates.sort((a, b) => b.score - a.score)[0];
    }

    /**
     * Verifica disponibilidade da equipe
     */
    async checkTeamAvailability(routingDecision) {
        const team = routingDecision.team;

        // Verifica se equipe existe
        if (!this.teamCapacity.has(team)) {
            console.warn(`Team ${team} not found in capacity map, using default`);
            return {
                ...routingDecision,
                available: true,
                capacity: 1.0,
                currentLoad: 0,
                availableMembers: ['default-agent']
            };
        }

        const capacity = this.teamCapacity.get(team);
        const currentLoad = this.teamWorkload.get(team) || 0;

        // Calcula disponibilidade
        const utilizationRate = currentLoad / capacity.maxCapacity;
        const isAvailable = utilizationRate < 0.9; // 90% de utilização máxima

        // Verifica horário de funcionamento
        const isBusinessTime = this.isBusinessHours();
        const hasOnCallSupport = capacity.onCallSupport || false;

        const finalAvailability = isAvailable && (isBusinessTime || hasOnCallSupport);

        return {
            ...routingDecision,
            available: finalAvailability,
            capacity: capacity.maxCapacity,
            currentLoad: currentLoad,
            utilizationRate: utilizationRate,
            availableMembers: this.getAvailableMembers(team),
            isBusinessHours: isBusinessTime,
            hasOnCallSupport: hasOnCallSupport
        };
    }

    /**
     * Aplica balanceamento de carga
     */
    async applyLoadBalancing(availabilityCheck, incident, classification) {
        if (!this.options.enableLoadBalancing || availabilityCheck.available) {
            return availabilityCheck;
        }

        // Se equipe não está disponível, busca alternativas
        const alternativeTeams = await this.findAlternativeTeams(availabilityCheck.team, classification);

        for (const altTeam of alternativeTeams) {
            const altCheck = await this.checkTeamAvailability({
                team: altTeam.team,
                score: altTeam.score,
                reason: 'load_balancing',
                escalationTo: altTeam.escalationTo
            });

            if (altCheck.available) {
                return {
                    ...altCheck,
                    reason: `load_balancing_from_${availabilityCheck.team}`,
                    originalTeam: availabilityCheck.team
                };
            }
        }

        // Se nenhuma alternativa disponível, força roteamento para equipe original
        return {
            ...availabilityCheck,
            available: true, // Força disponibilidade
            reason: 'forced_routing_no_alternatives',
            warning: 'Team over capacity but no alternatives available'
        };
    }

    /**
     * Encontra equipes alternativas
     */
    async findAlternativeTeams(primaryTeam, classification) {
        const alternatives = [];

        // Baseado na taxonomia de categorias relacionadas
        const primaryCategory = classification.classification?.primaryCategory;
        if (primaryCategory && primaryCategory.taxonomy) {
            const relatedTaxonomies = this.findRelatedTaxonomies(primaryCategory.taxonomy);

            for (const taxonomy of relatedTaxonomies) {
                if (taxonomy.routing && taxonomy.routing.team !== primaryTeam) {
                    alternatives.push({
                        team: taxonomy.routing.team,
                        score: 0.6, // Score reduzido para alternativas
                        escalationTo: taxonomy.routing.escalation,
                        reason: 'related_taxonomy'
                    });
                }
            }
        }

        // Adiciona equipes com competências overlapping
        const overlappingTeams = this.getOverlappingTeams(primaryTeam);
        alternatives.push(...overlappingTeams);

        // Remove duplicatas e ordena por score
        const uniqueAlternatives = this.removeDuplicateTeams(alternatives);
        return uniqueAlternatives.sort((a, b) => b.score - a.score);
    }

    /**
     * Calcula SLA ajustado
     */
    calculateAdjustedSLA(routing, incident) {
        let baseSLA = routing.sla || this.options.defaultSLA;

        // Ajusta baseado na prioridade
        const priority = incident.priority || 'medium';
        const priorityMultipliers = {
            critical: 0.3,
            high: 0.5,
            medium: 1.0,
            low: 1.5
        };

        baseSLA *= priorityMultipliers[priority] || 1.0;

        // Ajusta baseado no horário
        if (!this.isBusinessHours()) {
            baseSLA *= 1.5; // 50% mais tempo fora do horário comercial
        }

        // Ajusta baseado na carga da equipe
        if (routing.utilizationRate > 0.8) {
            baseSLA *= 1.2; // 20% mais tempo se equipe sobrecarregada
        }

        // Ajusta baseado no número de usuários afetados
        const affectedUsers = incident.affectedUsers || 0;
        if (affectedUsers > 1000) {
            baseSLA *= 0.7; // Reduz SLA para incidentes de alto impacto
        } else if (affectedUsers > 100) {
            baseSLA *= 0.8;
        }

        return Math.max(Math.round(baseSLA), 5); // Mínimo de 5 minutos
    }

    /**
     * Constrói caminho de escalação
     */
    buildEscalationPath(primaryTeam, classification) {
        const escalationPath = [];

        // Primeira escalação - supervisor da equipe
        const teamConfig = this.teamCapacity.get(primaryTeam);
        if (teamConfig && teamConfig.supervisor) {
            escalationPath.push({
                level: 1,
                target: teamConfig.supervisor,
                triggerAfter: Math.round(this.options.escalationThreshold * 60), // minutos
                reason: 'supervisor_escalation'
            });
        }

        // Segunda escalação - equipe especializada
        const primaryCategory = classification.classification?.primaryCategory;
        if (primaryCategory && primaryCategory.taxonomy && primaryCategory.taxonomy.routing.escalation) {
            escalationPath.push({
                level: 2,
                target: primaryCategory.taxonomy.routing.escalation,
                triggerAfter: Math.round(this.options.escalationThreshold * 90),
                reason: 'specialized_team_escalation'
            });
        }

        // Terceira escalação - gerência
        escalationPath.push({
            level: 3,
            target: 'incident-management',
            triggerAfter: Math.round(this.options.escalationThreshold * 120),
            reason: 'management_escalation'
        });

        return escalationPath;
    }

    /**
     * Estima tempo de resolução
     */
    estimateResolutionTime(team, classification) {
        // Baseado em dados históricos (simulado)
        const baseEstimates = {
            'mainframe-support': 45,
            'cobol-developers': 60,
            'cics-support': 30,
            'dba-team': 40,
            'mobile-team': 35,
            'web-team': 40,
            'payments-team': 25,
            'atm-support': 50,
            'data-team': 90,
            'infrastructure-team': 60
        };

        let baseTime = baseEstimates[team] || 60;

        // Ajusta baseado na confiança da classificação
        const confidence = classification.classification?.primaryCategory?.confidence || 0.5;
        if (confidence < 0.6) {
            baseTime *= 1.3; // Mais tempo se classificação incerta
        }

        // Ajusta baseado na complexidade do incidente
        const description = classification.incident.description || '';
        if (description.length > 500) {
            baseTime *= 1.2; // Incidentes com descrição longa tendem a ser mais complexos
        }

        return Math.round(baseTime);
    }

    /**
     * Registra roteamento
     */
    async registerRouting(routing) {
        // Adiciona à lista de incidentes ativos
        this.activeIncidents.set(routing.incident.id, routing);

        // Atualiza carga da equipe
        const currentLoad = this.teamWorkload.get(routing.targetTeam) || 0;
        this.teamWorkload.set(routing.targetTeam, currentLoad + 1);

        // Adiciona ao histórico
        this.routingHistory.push({
            id: routing.id,
            incidentId: routing.incident.id,
            team: routing.targetTeam,
            timestamp: routing.timestamp,
            priority: routing.priority,
            category: routing.classification.classification?.primaryCategory?.taxonomyId
        });

        // Mantém apenas últimos 1000 registros
        if (this.routingHistory.length > 1000) {
            this.routingHistory = this.routingHistory.slice(-1000);
        }

        console.log(`Incident ${routing.incident.id} routed to ${routing.targetTeam}`);
    }

    /**
     * Agenda verificação de escalação
     */
    scheduleEscalationCheck(routing) {
        if (!this.options.enableEscalation) {
            return;
        }

        const escalationPath = routing.escalationPath;
        if (!escalationPath || escalationPath.length === 0) {
            return;
        }

        // Agenda primeira verificação
        const firstEscalation = escalationPath[0];
        const checkTime = firstEscalation.triggerAfter * 60 * 1000; // Converte para ms

        setTimeout(async () => {
            await this.checkForEscalation(routing.incident.id);
        }, checkTime);
    }

    /**
     * Verifica necessidade de escalação
     */
    async checkForEscalation(incidentId) {
        try {
            const routing = this.activeIncidents.get(incidentId);
            if (!routing) {
                return; // Incidente já resolvido
            }

            const timeElapsed = Date.now() - new Date(routing.timestamp).getTime();
            const slaTime = routing.sla * 60 * 1000; // Converte para ms
            const escalationThreshold = slaTime * this.options.escalationThreshold;

            if (timeElapsed >= escalationThreshold) {
                await this.escalateIncident(routing);
            } else {
                // Reagenda próxima verificação
                const nextCheck = escalationThreshold - timeElapsed;
                setTimeout(() => this.checkForEscalation(incidentId), nextCheck);
            }

        } catch (error) {
            console.error('Error checking escalation:', error);
        }
    }

    /**
     * Escalada de incidente
     */
    async escalateIncident(routing) {
        try {
            const escalationHistory = this.escalationHistory.get(routing.incident.id) || [];
            const nextLevel = escalationHistory.length + 1;

            const escalationStep = routing.escalationPath.find(step => step.level === nextLevel);
            if (!escalationStep) {
                console.log(`No more escalation levels for incident ${routing.incident.id}`);
                return;
            }

            // Cria registro de escalação
            const escalation = {
                id: this.generateEscalationId(),
                incidentId: routing.incident.id,
                fromTeam: routing.targetTeam,
                toTeam: escalationStep.target,
                level: escalationStep.level,
                reason: escalationStep.reason,
                timestamp: new Date().toISOString(),
                originalRouting: routing.id
            };

            // Registra escalação
            escalationHistory.push(escalation);
            this.escalationHistory.set(routing.incident.id, escalationHistory);

            // Atualiza roteamento
            routing.targetTeam = escalationStep.target;
            routing.status = 'escalated';
            routing.escalationLevel = escalationStep.level;

            // Atualiza métricas
            this.metrics.escalations++;

            console.log(`Incident ${routing.incident.id} escalated to level ${escalationStep.level}: ${escalationStep.target}`);

            // Agenda próxima verificação se houver mais níveis
            const nextEscalation = routing.escalationPath.find(step => step.level === nextLevel + 1);
            if (nextEscalation) {
                setTimeout(() => this.checkForEscalation(routing.incident.id), nextEscalation.triggerAfter * 60 * 1000);
            }

        } catch (error) {
            console.error('Error escalating incident:', error);
        }
    }

    /**
     * Marca incidente como resolvido
     */
    async resolveIncident(incidentId, resolutionInfo) {
        try {
            const routing = this.activeIncidents.get(incidentId);
            if (!routing) {
                console.warn(`Incident ${incidentId} not found in active incidents`);
                return false;
            }

            // Calcula métricas de resolução
            const resolutionTime = Date.now() - new Date(routing.timestamp).getTime();
            const slaTime = routing.sla * 60 * 1000;
            const slaBreached = resolutionTime > slaTime;

            // Atualiza métricas
            if (slaBreached) {
                this.metrics.slaBreaches++;
            }

            // Remove da lista ativa
            this.activeIncidents.delete(incidentId);

            // Atualiza carga da equipe
            const currentLoad = this.teamWorkload.get(routing.targetTeam) || 0;
            this.teamWorkload.set(routing.targetTeam, Math.max(currentLoad - 1, 0));

            console.log(`Incident ${incidentId} resolved by ${routing.targetTeam} in ${Math.round(resolutionTime / 60000)} minutes`);

            return true;

        } catch (error) {
            console.error('Error resolving incident:', error);
            return false;
        }
    }

    /**
     * Obtém métricas de roteamento
     */
    getRoutingMetrics() {
        const activeIncidentsCount = this.activeIncidents.size;
        const avgResolutionTime = this.calculateAverageResolutionTime();

        return {
            ...this.metrics,
            activeIncidents: activeIncidentsCount,
            averageResolutionTime: avgResolutionTime,
            teamWorkloads: Object.fromEntries(this.teamWorkload),
            teamUtilizationRates: this.calculateTeamUtilization(),
            escalationRate: this.metrics.totalRoutings > 0 ? this.metrics.escalations / this.metrics.totalRoutings : 0,
            slaBreachRate: this.metrics.totalRoutings > 0 ? this.metrics.slaBreaches / this.metrics.totalRoutings : 0,
            lastUpdate: new Date().toISOString()
        };
    }

    // ============= MÉTODOS AUXILIARES =============

    async loadTeamConfiguration() {
        // Configuração de equipes (em produção, carregar de banco de dados)
        const teamConfig = new Map([
            ['mainframe-support', {
                maxCapacity: 8,
                onCallSupport: true,
                supervisor: 'mainframe-supervisor',
                skills: ['mainframe', 'cobol', 'jcl', 'mvs'],
                members: ['dev1', 'dev2', 'dev3', 'dev4', 'dev5', 'dev6', 'dev7', 'dev8']
            }],
            ['cobol-developers', {
                maxCapacity: 6,
                onCallSupport: false,
                supervisor: 'cobol-lead',
                skills: ['cobol', 'copybook', 'compilation'],
                members: ['cobol1', 'cobol2', 'cobol3', 'cobol4', 'cobol5', 'cobol6']
            }],
            ['cics-support', {
                maxCapacity: 4,
                onCallSupport: true,
                supervisor: 'cics-supervisor',
                skills: ['cics', 'transaction', 'bms'],
                members: ['cics1', 'cics2', 'cics3', 'cics4']
            }],
            ['dba-team', {
                maxCapacity: 5,
                onCallSupport: true,
                supervisor: 'dba-lead',
                skills: ['db2', 'sql', 'database', 'performance'],
                members: ['dba1', 'dba2', 'dba3', 'dba4', 'dba5']
            }],
            ['mobile-team', {
                maxCapacity: 10,
                onCallSupport: false,
                supervisor: 'mobile-lead',
                skills: ['ios', 'android', 'react-native', 'mobile-api'],
                members: ['mobile1', 'mobile2', 'mobile3', 'mobile4', 'mobile5', 'mobile6', 'mobile7', 'mobile8', 'mobile9', 'mobile10']
            }],
            ['web-team', {
                maxCapacity: 12,
                onCallSupport: false,
                supervisor: 'web-lead',
                skills: ['javascript', 'react', 'angular', 'nodejs', 'web-api'],
                members: ['web1', 'web2', 'web3', 'web4', 'web5', 'web6', 'web7', 'web8', 'web9', 'web10', 'web11', 'web12']
            }],
            ['payments-team', {
                maxCapacity: 6,
                onCallSupport: true,
                supervisor: 'payments-lead',
                skills: ['pix', 'payment-gateway', 'banking-protocols'],
                members: ['pay1', 'pay2', 'pay3', 'pay4', 'pay5', 'pay6']
            }],
            ['atm-support', {
                maxCapacity: 4,
                onCallSupport: true,
                supervisor: 'atm-supervisor',
                skills: ['atm-hardware', 'iso8583', 'network'],
                members: ['atm1', 'atm2', 'atm3', 'atm4']
            }],
            ['data-team', {
                maxCapacity: 8,
                onCallSupport: false,
                supervisor: 'data-lead',
                skills: ['data-lake', 'etl', 'analytics', 'big-data'],
                members: ['data1', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7', 'data8']
            }],
            ['infrastructure-team', {
                maxCapacity: 15,
                onCallSupport: true,
                supervisor: 'infra-manager',
                skills: ['network', 'servers', 'cloud', 'monitoring'],
                members: ['infra1', 'infra2', 'infra3', 'infra4', 'infra5', 'infra6', 'infra7', 'infra8', 'infra9', 'infra10', 'infra11', 'infra12', 'infra13', 'infra14', 'infra15']
            }]
        ]);

        this.teamCapacity = teamConfig;

        // Inicializa workload com 0
        for (const teamName of teamConfig.keys()) {
            this.teamWorkload.set(teamName, 0);
        }
    }

    initializeCapacityMonitoring() {
        // Monitora capacidade das equipes a cada 5 minutos
        setInterval(() => {
            this.updateTeamCapacityMetrics();
        }, 300000);
    }

    startEscalationMonitoring() {
        // Verifica escalações a cada minuto
        setInterval(() => {
            for (const incidentId of this.activeIncidents.keys()) {
                this.checkForEscalation(incidentId);
            }
        }, 60000);
    }

    validateInput(incident, classification) {
        if (!incident || !incident.id) {
            throw new Error('Invalid incident data');
        }

        if (!classification || !classification.classification) {
            throw new Error('Invalid classification data');
        }
    }

    calculatePriority(incident, classification) {
        const incidentPriority = incident.priority || 'medium';
        const taxonomyPriority = classification.classification?.primaryCategory?.taxonomy?.priority || 'medium';

        // A prioridade final é a maior entre incidente e taxonomia
        const priorities = ['low', 'medium', 'high', 'critical'];
        const incidentIndex = priorities.indexOf(incidentPriority);
        const taxonomyIndex = priorities.indexOf(taxonomyPriority);

        return priorities[Math.max(incidentIndex, taxonomyIndex)];
    }

    isBusinessHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        const startHour = parseInt(this.options.businessHours.start.split(':')[0]);
        const endHour = parseInt(this.options.businessHours.end.split(':')[0]);

        return this.options.businessHours.weekdays.includes(day) &&
               hour >= startHour && hour < endHour;
    }

    getAvailableMembers(team) {
        const teamConfig = this.teamCapacity.get(team);
        if (!teamConfig) return [];

        // Em uma implementação real, verificaria disponibilidade real dos membros
        return teamConfig.members.slice(0, Math.ceil(teamConfig.maxCapacity * 0.7));
    }

    findRelatedTaxonomies(taxonomy) {
        const related = [];

        // Busca taxonomias do mesmo pai
        if (taxonomy.parent) {
            const parentTaxonomy = this.taxonomyManager.getTaxonomy(taxonomy.parent);
            if (parentTaxonomy) {
                const siblings = this.taxonomyManager.getChildTaxonomies(taxonomy.parent);
                related.push(...siblings.filter(t => t.id !== taxonomy.id));
            }
        }

        // Busca taxonomias filhas
        if (taxonomy.children && taxonomy.children.length > 0) {
            const children = this.taxonomyManager.getChildTaxonomies(taxonomy.id);
            related.push(...children);
        }

        return related;
    }

    getOverlappingTeams(primaryTeam) {
        const overlaps = {
            'mainframe-support': [
                { team: 'cobol-developers', score: 0.7 },
                { team: 'cics-support', score: 0.6 },
                { team: 'dba-team', score: 0.4 }
            ],
            'mobile-team': [
                { team: 'web-team', score: 0.5 }
            ],
            'web-team': [
                { team: 'mobile-team', score: 0.5 }
            ],
            'payments-team': [
                { team: 'core-banking-team', score: 0.6 }
            ]
        };

        return overlaps[primaryTeam] || [];
    }

    removeDuplicateTeams(teams) {
        const seen = new Set();
        return teams.filter(team => {
            if (seen.has(team.team)) {
                return false;
            }
            seen.add(team.team);
            return true;
        });
    }

    async findHistoricalMatch(incident) {
        // Implementação simplificada de busca histórica
        const text = `${incident.title || ''} ${incident.description || ''}`.toLowerCase();

        // Busca no histórico por palavras-chave similares
        const recentRoutings = this.routingHistory.slice(-100); // Últimos 100

        for (const routing of recentRoutings) {
            // Em uma implementação real, usaria algoritmos de similaridade de texto
            // Por simplicidade, vamos verificar algumas palavras-chave
            const similarity = this.calculateTextSimilarity(text, routing.category || '');

            if (similarity > 0.7) {
                return {
                    team: routing.team,
                    similarity: similarity,
                    avgResolutionTime: 45 // Simulado
                };
            }
        }

        return null;
    }

    calculateTextSimilarity(text1, text2) {
        // Implementação muito simplificada de similaridade
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);

        const common = words1.filter(word => words2.includes(word));
        const total = new Set([...words1, ...words2]).size;

        return common.length / total;
    }

    getKeywordBasedRouting(incident) {
        const text = `${incident.title || ''} ${incident.description || ''}`.toLowerCase();

        const keywordMap = {
            'mainframe-support': ['mainframe', 'cobol', 'jcl', 'mvs', 'abend'],
            'cics-support': ['cics', 'transaction', 'terminal', 'dfh'],
            'dba-team': ['db2', 'sql', 'database', 'tablespace'],
            'mobile-team': ['mobile', 'app', 'ios', 'android'],
            'web-team': ['web', 'browser', 'portal', 'javascript'],
            'payments-team': ['pix', 'payment', 'transfer', 'ted'],
            'atm-support': ['atm', 'caixa', 'eletronico'],
            'infrastructure-team': ['network', 'server', 'connection', 'hardware']
        };

        let bestMatch = null;
        let bestScore = 0;

        for (const [team, keywords] of Object.entries(keywordMap)) {
            const matches = keywords.filter(keyword => text.includes(keyword));
            const score = matches.length / keywords.length;

            if (score > bestScore && score > 0.3) {
                bestScore = score;
                bestMatch = {
                    team: team,
                    score: score * 0.5, // Score reduzido para keywords
                    reason: 'keyword_match',
                    matchedKeywords: matches
                };
            }
        }

        return bestMatch;
    }

    getDefaultRouting(incident) {
        return {
            team: 'infrastructure-team',
            score: 0.3,
            reason: 'default_routing',
            escalationTo: 'incident-management',
            sla: this.options.defaultSLA
        };
    }

    createFallbackRouting(incident, classification, error) {
        return {
            id: this.generateRoutingId(),
            incident: incident,
            classification: classification,
            targetTeam: 'infrastructure-team',
            assignedTo: null,
            priority: incident.priority || 'medium',
            sla: this.options.defaultSLA,
            escalationPath: [],
            routingReason: 'fallback_due_to_error',
            routingScore: 0.1,
            timestamp: new Date().toISOString(),
            estimatedResolutionTime: 60,
            businessHoursAdjustment: 1.0,
            status: 'routed',
            error: error.message,
            fallback: true
        };
    }

    updateRoutingMetrics(routing, processingTime) {
        this.metrics.totalRoutings++;
        this.metrics.successfulRoutings++;

        const times = this.metrics.averageRoutingTime || [];
        times.push(processingTime);

        if (times.length > 100) {
            times.shift();
        }

        this.metrics.averageRoutingTime = times.reduce((sum, time) => sum + time, 0) / times.length;

        // Atualiza métricas por prioridade
        const priority = routing.priority;
        const priorityCount = this.metrics.routingsByPriority.get(priority) || 0;
        this.metrics.routingsByPriority.set(priority, priorityCount + 1);

        // Atualiza métricas por categoria
        const category = routing.classification.classification?.primaryCategory?.taxonomyId;
        if (category) {
            const categoryCount = this.metrics.routingsByCategory.get(category) || 0;
            this.metrics.routingsByCategory.set(category, categoryCount + 1);
        }
    }

    updateTeamCapacityMetrics() {
        for (const [team, capacity] of this.teamCapacity.entries()) {
            const currentLoad = this.teamWorkload.get(team) || 0;
            const utilization = currentLoad / capacity.maxCapacity;
            this.metrics.teamUtilization.set(team, utilization);
        }
    }

    calculateTeamUtilization() {
        const utilization = {};
        for (const [team, capacity] of this.teamCapacity.entries()) {
            const currentLoad = this.teamWorkload.get(team) || 0;
            utilization[team] = currentLoad / capacity.maxCapacity;
        }
        return utilization;
    }

    calculateAverageResolutionTime() {
        // Simulado - em produção, calcular baseado em dados reais
        return 42; // minutos
    }

    generateRoutingId() {
        return `RT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateEscalationId() {
        return `ESC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = AutoRouter;