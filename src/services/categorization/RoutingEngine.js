/**
 * RoutingEngine - Sistema de Roteamento Automático de Incidentes
 *
 * Motor responsável pelo roteamento inteligente de incidentes para as equipes
 * corretas baseado na classificação, prioridade, SLA e disponibilidade.
 */

const TaxonomyManager = require('./TaxonomyManager');
const TechnologyClassifier = require('./TechnologyClassifier');
const TaggingService = require('./TaggingService');

class RoutingEngine {
  constructor(options = {}) {
    this.taxonomyManager = new TaxonomyManager();
    this.classifier = new TechnologyClassifier();
    this.taggingService = new TaggingService();

    this.config = {
      enableAutoRouting: options.enableAutoRouting !== false,
      enableLoadBalancing: options.enableLoadBalancing !== false,
      enableEscalation: options.enableEscalation !== false,
      maxRoutingAttempts: options.maxRoutingAttempts || 3,
      routingTimeout: options.routingTimeout || 30000, // 30 segundos
      escalationThreshold: options.escalationThreshold || 60, // 60 minutos
      ...options,
    };

    // Configurações de roteamento
    this.teams = new Map();
    this.routingRules = new Map();
    this.workloadMap = new Map();
    this.escalationRules = new Map();
    this.slaMatrix = new Map();

    // Histórico e métricas
    this.routingHistory = [];
    this.metrics = {
      totalRoutings: 0,
      successfulRoutings: 0,
      escalations: 0,
      averageRoutingTime: 0,
      slaCompliance: 0,
    };

    this.initializeTeams();
    this.initializeRoutingRules();
    this.initializeEscalationRules();
    this.initializeSLAMatrix();
  }

  /**
   * Inicializa equipes e suas capacidades
   */
  initializeTeams() {
    const teams = [
      {
        id: 'mainframe-support',
        name: 'Suporte Mainframe',
        description: 'Equipe especializada em sistemas mainframe',
        capabilities: ['mainframe', 'cobol', 'cics', 'db2', 'jcl', 'zos'],
        availability: {
          schedule: '24x7',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 20,
          current: 0,
          available: 20,
        },
        skills: {
          mainframe: 10,
          cobol: 9,
          cics: 8,
          db2: 7,
          jcl: 8,
        },
        sla: {
          response: 15, // minutos
          resolution: 120, // minutos
        },
        priority: ['critical', 'high'],
        escalationPath: ['mainframe-architects'],
        contacts: {
          email: 'mainframe-support@bank.com',
          slack: '#mainframe-support',
          phone: '+55-11-9999-0001',
        },
      },
      {
        id: 'mobile-team',
        name: 'Equipe Mobile',
        description: 'Desenvolvimento e suporte mobile banking',
        capabilities: ['mobile-banking', 'ios', 'android', 'react-native'],
        availability: {
          schedule: '8x5',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 15,
          current: 0,
          available: 15,
        },
        skills: {
          'mobile-banking': 9,
          ios: 8,
          android: 8,
          'react-native': 7,
        },
        sla: {
          response: 30,
          resolution: 240,
        },
        priority: ['high', 'medium'],
        escalationPath: ['mobile-architects'],
        contacts: {
          email: 'mobile-team@bank.com',
          slack: '#mobile-team',
          phone: '+55-11-9999-0002',
        },
      },
      {
        id: 'core-banking-team',
        name: 'Core Banking',
        description: 'Equipe de sistemas centrais bancários',
        capabilities: ['core-banking', 'accounts', 'transactions', 'batch-processing'],
        availability: {
          schedule: '24x7',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 25,
          current: 0,
          available: 25,
        },
        skills: {
          'core-banking': 10,
          accounts: 9,
          transactions: 9,
          'batch-processing': 8,
        },
        sla: {
          response: 10,
          resolution: 60,
        },
        priority: ['critical', 'high'],
        escalationPath: ['banking-architects'],
        contacts: {
          email: 'core-banking@bank.com',
          slack: '#core-banking',
          phone: '+55-11-9999-0003',
        },
      },
      {
        id: 'payments-team',
        name: 'Sistemas de Pagamento',
        description: 'Equipe especializada em pagamentos',
        capabilities: ['payment-systems', 'pix', 'ted', 'doc', 'cards'],
        availability: {
          schedule: '24x7',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 18,
          current: 0,
          available: 18,
        },
        skills: {
          'payment-systems': 10,
          pix: 10,
          ted: 9,
          doc: 8,
          cards: 8,
        },
        sla: {
          response: 5,
          resolution: 30,
        },
        priority: ['critical', 'high'],
        escalationPath: ['payments-architects'],
        contacts: {
          email: 'payments-team@bank.com',
          slack: '#payments-team',
          phone: '+55-11-9999-0004',
        },
      },
      {
        id: 'infrastructure-team',
        name: 'Infraestrutura',
        description: 'Equipe de infraestrutura e redes',
        capabilities: ['infrastructure', 'network', 'servers', 'cloud'],
        availability: {
          schedule: '24x7',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 12,
          current: 0,
          available: 12,
        },
        skills: {
          infrastructure: 9,
          network: 8,
          servers: 8,
          cloud: 7,
        },
        sla: {
          response: 20,
          resolution: 180,
        },
        priority: ['high', 'medium'],
        escalationPath: ['infrastructure-architects'],
        contacts: {
          email: 'infrastructure@bank.com',
          slack: '#infrastructure',
          phone: '+55-11-9999-0005',
        },
      },
      {
        id: 'atm-support',
        name: 'Suporte ATM',
        description: 'Suporte para rede de ATMs',
        capabilities: ['atm-network', 'atm-hardware', 'iso8583'],
        availability: {
          schedule: '24x7',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 10,
          current: 0,
          available: 10,
        },
        skills: {
          'atm-network': 9,
          'atm-hardware': 8,
          iso8583: 7,
        },
        sla: {
          response: 15,
          resolution: 120,
        },
        priority: ['high', 'medium'],
        escalationPath: ['infrastructure-team'],
        contacts: {
          email: 'atm-support@bank.com',
          slack: '#atm-support',
          phone: '+55-11-9999-0006',
        },
      },
      {
        id: 'web-team',
        name: 'Internet Banking',
        description: 'Equipe de internet banking',
        capabilities: ['internet-banking', 'web-portal', 'api-gateway', 'microservices'],
        availability: {
          schedule: '16x5',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 14,
          current: 0,
          available: 14,
        },
        skills: {
          'internet-banking': 9,
          'web-portal': 8,
          'api-gateway': 7,
          microservices: 8,
        },
        sla: {
          response: 25,
          resolution: 180,
        },
        priority: ['high', 'medium'],
        escalationPath: ['web-architects'],
        contacts: {
          email: 'web-team@bank.com',
          slack: '#web-team',
          phone: '+55-11-9999-0007',
        },
      },
      {
        id: 'data-team',
        name: 'Plataforma de Dados',
        description: 'Equipe de dados e analytics',
        capabilities: ['data-platforms', 'data-lake', 'bi', 'analytics'],
        availability: {
          schedule: '8x5',
          timezone: 'America/Sao_Paulo',
        },
        capacity: {
          max: 8,
          current: 0,
          available: 8,
        },
        skills: {
          'data-platforms': 8,
          'data-lake': 7,
          bi: 8,
          analytics: 7,
        },
        sla: {
          response: 60,
          resolution: 480,
        },
        priority: ['medium', 'low'],
        escalationPath: ['data-architects'],
        contacts: {
          email: 'data-team@bank.com',
          slack: '#data-team',
          phone: '+55-11-9999-0008',
        },
      },
    ];

    teams.forEach(team => this.teams.set(team.id, team));
  }

  /**
   * Inicializa regras de roteamento
   */
  initializeRoutingRules() {
    const rules = [
      {
        id: 'rule_mainframe_critical',
        name: 'Mainframe Crítico',
        conditions: {
          categories: ['mainframe', 'cobol', 'cics', 'db2'],
          priority: ['critical'],
          tags: ['impact_critical'],
        },
        actions: {
          route: 'mainframe-support',
          escalate: true,
          notify: ['mainframe-architects'],
          sla: 15,
        },
        active: true,
        weight: 100,
      },
      {
        id: 'rule_payments_urgent',
        name: 'Pagamentos Urgente',
        conditions: {
          categories: ['payment-systems', 'pix', 'ted'],
          priority: ['critical', 'high'],
          keywords: ['pagamento', 'pix', 'transferencia'],
        },
        actions: {
          route: 'payments-team',
          escalate: true,
          notify: ['payments-architects'],
          sla: 5,
        },
        active: true,
        weight: 95,
      },
      {
        id: 'rule_mobile_app',
        name: 'Aplicativo Mobile',
        conditions: {
          categories: ['mobile-banking'],
          source: ['mobile-app'],
          timeWindow: 'business-hours',
        },
        actions: {
          route: 'mobile-team',
          escalate: false,
          sla: 30,
        },
        active: true,
        weight: 80,
      },
      {
        id: 'rule_atm_hardware',
        name: 'Hardware ATM',
        conditions: {
          categories: ['atm-network'],
          keywords: ['hardware', 'caixa eletronico'],
          priority: ['high', 'medium'],
        },
        actions: {
          route: 'atm-support',
          escalate: false,
          sla: 15,
        },
        active: true,
        weight: 75,
      },
      {
        id: 'rule_core_banking',
        name: 'Core Banking',
        conditions: {
          categories: ['core-banking'],
          priority: ['critical', 'high'],
        },
        actions: {
          route: 'core-banking-team',
          escalate: true,
          notify: ['banking-architects'],
          sla: 10,
        },
        active: true,
        weight: 90,
      },
      {
        id: 'rule_infrastructure',
        name: 'Infraestrutura Geral',
        conditions: {
          categories: ['infrastructure'],
          fallback: true,
        },
        actions: {
          route: 'infrastructure-team',
          escalate: false,
          sla: 30,
        },
        active: true,
        weight: 50,
      },
    ];

    rules.forEach(rule => this.routingRules.set(rule.id, rule));
  }

  /**
   * Inicializa regras de escalação
   */
  initializeEscalationRules() {
    const escalationRules = [
      {
        id: 'time_based_escalation',
        name: 'Escalação por Tempo',
        trigger: 'time',
        conditions: {
          timeThreshold: 60, // minutos
          priorities: ['critical', 'high'],
        },
        actions: {
          escalateTo: 'next_level',
          notify: ['managers'],
          createTask: true,
        },
      },
      {
        id: 'priority_escalation',
        name: 'Escalação por Prioridade',
        trigger: 'priority',
        conditions: {
          priority: 'critical',
          immediate: true,
        },
        actions: {
          escalateTo: 'architects',
          notify: ['executives'],
          createIncident: true,
        },
      },
      {
        id: 'capacity_escalation',
        name: 'Escalação por Capacidade',
        trigger: 'capacity',
        conditions: {
          capacityThreshold: 0.9,
          queueSize: 10,
        },
        actions: {
          escalateTo: 'backup_team',
          loadBalance: true,
        },
      },
    ];

    escalationRules.forEach(rule => this.escalationRules.set(rule.id, rule));
  }

  /**
   * Inicializa matriz de SLA
   */
  initializeSLAMatrix() {
    const slaMatrix = [
      {
        category: 'payment-systems',
        priority: 'critical',
        response: 5,
        resolution: 30,
        escalation: 10,
      },
      {
        category: 'core-banking',
        priority: 'critical',
        response: 10,
        resolution: 60,
        escalation: 15,
      },
      {
        category: 'mainframe',
        priority: 'critical',
        response: 15,
        resolution: 120,
        escalation: 30,
      },
      {
        category: 'mobile-banking',
        priority: 'high',
        response: 30,
        resolution: 240,
        escalation: 60,
      },
      {
        category: 'atm-network',
        priority: 'high',
        response: 15,
        resolution: 120,
        escalation: 30,
      },
      {
        category: 'infrastructure',
        priority: 'medium',
        response: 30,
        resolution: 180,
        escalation: 60,
      },
    ];

    slaMatrix.forEach(sla => {
      const key = `${sla.category}_${sla.priority}`;
      this.slaMatrix.set(key, sla);
    });
  }

  /**
   * Roteia incidente automaticamente
   */
  async routeIncident(incidentData, classificationResult) {
    const startTime = Date.now();

    try {
      if (!this.config.enableAutoRouting) {
        return this.generateManualRoutingResponse(incidentData);
      }

      // Analisar classificação e tags
      const context = await this.buildRoutingContext(incidentData, classificationResult);

      // Aplicar regras de roteamento
      const routingOptions = await this.evaluateRoutingRules(context);

      // Selecionar melhor opção
      const selectedRoute = await this.selectOptimalRoute(routingOptions, context);

      // Verificar capacidade e disponibilidade
      const finalRoute = await this.validateAndAssignRoute(selectedRoute, context);

      // Executar roteamento
      const routingResult = await this.executeRouting(finalRoute, incidentData, context);

      // Registrar histórico
      this.recordRoutingHistory(incidentData.id, routingResult, Date.now() - startTime);

      // Atualizar métricas
      this.updateMetrics(routingResult);

      return routingResult;
    } catch (error) {
      console.error('Error in incident routing:', error);
      return this.generateErrorRoutingResponse(incidentData, error);
    }
  }

  /**
   * Constrói contexto para roteamento
   */
  async buildRoutingContext(incidentData, classificationResult) {
    const context = {
      incident: incidentData,
      classification: classificationResult,
      timestamp: new Date(),
      priority: this.determinePriority(incidentData, classificationResult),
      urgency: this.determineUrgency(incidentData),
      impact: this.determineImpact(incidentData),
      tags: await this.taggingService.getIncidentTags(incidentData.id),
      businessHours: this.isBusinessHours(),
      workload: this.getCurrentWorkload(),
      sla: this.calculateSLA(incidentData, classificationResult),
    };

    return context;
  }

  /**
   * Avalia regras de roteamento
   */
  async evaluateRoutingRules(context) {
    const matchingRules = [];

    for (const [ruleId, rule] of this.routingRules.entries()) {
      if (!rule.active) continue;

      const score = await this.evaluateRule(rule, context);
      if (score > 0) {
        matchingRules.push({
          rule,
          score,
          team: this.teams.get(rule.actions.route),
        });
      }
    }

    // Ordenar por score
    return matchingRules.sort((a, b) => b.score - a.score);
  }

  /**
   * Avalia uma regra específica
   */
  async evaluateRule(rule, context) {
    let score = 0;
    const conditions = rule.conditions;

    // Avaliar categorias
    if (conditions.categories && context.classification.primaryCategory) {
      if (conditions.categories.includes(context.classification.primaryCategory.category)) {
        score += 40;
      }
    }

    // Avaliar prioridade
    if (conditions.priority) {
      if (conditions.priority.includes(context.priority)) {
        score += 30;
      }
    }

    // Avaliar tags
    if (conditions.tags) {
      const tagIds = context.tags.map(tag => tag.id);
      const matchingTags = conditions.tags.filter(tag => tagIds.includes(tag));
      score += matchingTags.length * 10;
    }

    // Avaliar keywords
    if (conditions.keywords) {
      const text = `${context.incident.title} ${context.incident.description}`.toLowerCase();
      const matchingKeywords = conditions.keywords.filter(keyword =>
        text.includes(keyword.toLowerCase())
      );
      score += matchingKeywords.length * 5;
    }

    // Avaliar fonte
    if (conditions.source && context.incident.source) {
      if (conditions.source.includes(context.incident.source)) {
        score += 15;
      }
    }

    // Avaliar janela de tempo
    if (conditions.timeWindow) {
      if (this.matchesTimeWindow(conditions.timeWindow, context.timestamp)) {
        score += 10;
      }
    }

    // Aplicar peso da regra
    score *= rule.weight / 100;

    return Math.max(0, score);
  }

  /**
   * Seleciona rota ótima
   */
  async selectOptimalRoute(routingOptions, context) {
    if (routingOptions.length === 0) {
      return this.getFallbackRoute(context);
    }

    // Se load balancing está habilitado, considerar carga atual
    if (this.config.enableLoadBalancing) {
      routingOptions.forEach(option => {
        const team = option.team;
        const loadFactor = team.capacity.current / team.capacity.max;
        option.score *= 1 - loadFactor * 0.3; // Reduz score baseado na carga
      });

      // Reordenar após ajuste de carga
      routingOptions.sort((a, b) => b.score - a.score);
    }

    return routingOptions[0];
  }

  /**
   * Valida e atribui rota
   */
  async validateAndAssignRoute(selectedRoute, context) {
    if (!selectedRoute || !selectedRoute.team) {
      throw new Error('No valid route found');
    }

    const team = selectedRoute.team;

    // Verificar disponibilidade
    if (!this.isTeamAvailable(team, context.timestamp)) {
      return await this.findAlternativeRoute(selectedRoute, context);
    }

    // Verificar capacidade
    if (team.capacity.current >= team.capacity.max) {
      if (context.priority === 'critical') {
        // Para críticos, forçar atribuição
        console.warn(`Team ${team.id} over capacity, but assigning critical incident`);
      } else {
        return await this.findAlternativeRoute(selectedRoute, context);
      }
    }

    // Atualizar capacidade
    team.capacity.current++;
    team.capacity.available--;

    return selectedRoute;
  }

  /**
   * Executa o roteamento
   */
  async executeRouting(route, incidentData, context) {
    const team = route.team;
    const rule = route.rule;

    // Preparar resultado do roteamento
    const routingResult = {
      incident: {
        id: incidentData.id,
        title: incidentData.title,
      },
      routing: {
        team: {
          id: team.id,
          name: team.name,
          contacts: team.contacts,
        },
        rule: {
          id: rule.id,
          name: rule.name,
        },
        score: route.score,
        assignedAt: new Date().toISOString(),
        sla: context.sla,
        priority: context.priority,
        escalationRequired: rule.actions.escalate || false,
      },
      notifications: [],
      actions: [],
    };

    // Executar ações da regra
    if (rule.actions.notify) {
      for (const notifyTarget of rule.actions.notify) {
        await this.sendNotification(notifyTarget, incidentData, routingResult);
        routingResult.notifications.push({
          target: notifyTarget,
          sent: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Configurar escalação automática se necessário
    if (rule.actions.escalate) {
      await this.scheduleEscalation(incidentData.id, context.sla.escalation);
      routingResult.actions.push({
        type: 'escalation_scheduled',
        scheduledFor: new Date(Date.now() + context.sla.escalation * 60000).toISOString(),
      });
    }

    // Atualizar workload
    this.updateWorkload(team.id, incidentData);

    return routingResult;
  }

  /**
   * Determina prioridade do incidente
   */
  determinePriority(incidentData, classificationResult) {
    // Prioridade baseada na taxonomia
    if (classificationResult.primaryCategory?.taxonomy?.priority) {
      return classificationResult.primaryCategory.taxonomy.priority;
    }

    // Prioridade padrão baseada em keywords críticas
    const text = `${incidentData.title} ${incidentData.description}`.toLowerCase();

    if (/\b(down|parado|indisponivel|critico)\b/.test(text)) {
      return 'critical';
    }

    if (/\b(lento|erro|falha|problema)\b/.test(text)) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Determina urgência
   */
  determineUrgency(incidentData) {
    const timestamp = new Date(incidentData.timestamp || Date.now());
    const hour = timestamp.getHours();

    // Urgência baseada no horário
    if (hour >= 6 && hour <= 22) {
      return 'high'; // Horário de alta movimentação
    }

    return 'normal';
  }

  /**
   * Determina impacto
   */
  determineImpact(incidentData) {
    const affectedUsers = incidentData.affectedUsers || 0;

    if (affectedUsers > 10000) return 'critical';
    if (affectedUsers > 1000) return 'high';
    if (affectedUsers > 100) return 'medium';

    return 'low';
  }

  /**
   * Calcula SLA baseado na categoria e prioridade
   */
  calculateSLA(incidentData, classificationResult) {
    const category = classificationResult.primaryCategory?.category || 'infrastructure';
    const priority = this.determinePriority(incidentData, classificationResult);

    const slaKey = `${category}_${priority}`;
    const sla = this.slaMatrix.get(slaKey);

    if (sla) {
      return {
        response: sla.response,
        resolution: sla.resolution,
        escalation: sla.escalation,
      };
    }

    // SLA padrão
    return {
      response: 30,
      resolution: 240,
      escalation: 60,
    };
  }

  /**
   * Verifica se é horário comercial
   */
  isBusinessHours(timestamp = new Date()) {
    const hour = timestamp.getHours();
    const day = timestamp.getDay(); // 0 = Sunday, 6 = Saturday

    return day >= 1 && day <= 5 && hour >= 8 && hour <= 18;
  }

  /**
   * Verifica se equipe está disponível
   */
  isTeamAvailable(team, timestamp = new Date()) {
    const schedule = team.availability.schedule;
    const hour = timestamp.getHours();
    const day = timestamp.getDay();

    switch (schedule) {
      case '24x7':
        return true;
      case '16x5':
        return day >= 1 && day <= 5 && hour >= 6 && hour <= 22;
      case '8x5':
        return day >= 1 && day <= 5 && hour >= 8 && hour <= 18;
      default:
        return true;
    }
  }

  /**
   * Encontra rota alternativa
   */
  async findAlternativeRoute(originalRoute, context) {
    // Buscar equipe de escalação
    const escalationTeams = originalRoute.team.escalationPath || [];

    for (const teamId of escalationTeams) {
      const team = this.teams.get(teamId);
      if (team && this.isTeamAvailable(team) && team.capacity.available > 0) {
        return {
          ...originalRoute,
          team,
          isEscalated: true,
        };
      }
    }

    // Se não encontrou, usar infraestrutura como fallback
    const fallbackTeam = this.teams.get('infrastructure-team');
    return {
      ...originalRoute,
      team: fallbackTeam,
      isFallback: true,
    };
  }

  /**
   * Obtém rota de fallback
   */
  getFallbackRoute(context) {
    const fallbackTeam = this.teams.get('infrastructure-team');
    const fallbackRule = Array.from(this.routingRules.values()).find(
      rule => rule.conditions.fallback
    );

    return {
      rule: fallbackRule,
      team: fallbackTeam,
      score: 10,
      isFallback: true,
    };
  }

  /**
   * Agenda escalação automática
   */
  async scheduleEscalation(incidentId, escalationTime) {
    // Implementar sistema de agendamento
    setTimeout(
      () => {
        this.executeEscalation(incidentId);
      },
      escalationTime * 60 * 1000
    );
  }

  /**
   * Executa escalação
   */
  async executeEscalation(incidentId) {
    // Implementar lógica de escalação
    console.log(`Escalating incident ${incidentId}`);
    this.metrics.escalations++;
  }

  /**
   * Envia notificação
   */
  async sendNotification(target, incidentData, routingResult) {
    // Implementar sistema de notificações
    console.log(`Sending notification to ${target} for incident ${incidentData.id}`);
  }

  /**
   * Atualiza workload da equipe
   */
  updateWorkload(teamId, incidentData) {
    if (!this.workloadMap.has(teamId)) {
      this.workloadMap.set(teamId, {
        incidents: [],
        totalLoad: 0,
      });
    }

    const workload = this.workloadMap.get(teamId);
    workload.incidents.push({
      id: incidentData.id,
      assignedAt: new Date().toISOString(),
      priority: this.determinePriority(incidentData, {}),
    });
    workload.totalLoad++;
  }

  /**
   * Obtém workload atual
   */
  getCurrentWorkload() {
    const workload = {};

    for (const [teamId, team] of this.teams.entries()) {
      workload[teamId] = {
        capacity: team.capacity,
        utilization: team.capacity.current / team.capacity.max,
      };
    }

    return workload;
  }

  /**
   * Verifica correspondência com janela de tempo
   */
  matchesTimeWindow(timeWindow, timestamp) {
    switch (timeWindow) {
      case 'business-hours':
        return this.isBusinessHours(timestamp);
      case 'after-hours':
        return !this.isBusinessHours(timestamp);
      case 'weekend':
        const day = timestamp.getDay();
        return day === 0 || day === 6;
      default:
        return true;
    }
  }

  /**
   * Registra histórico de roteamento
   */
  recordRoutingHistory(incidentId, routingResult, processingTime) {
    this.routingHistory.push({
      incidentId,
      routingResult,
      processingTime,
      timestamp: new Date().toISOString(),
    });

    // Manter apenas últimos 1000 registros
    if (this.routingHistory.length > 1000) {
      this.routingHistory.shift();
    }
  }

  /**
   * Atualiza métricas
   */
  updateMetrics(routingResult) {
    this.metrics.totalRoutings++;

    if (routingResult.routing.team) {
      this.metrics.successfulRoutings++;
    }

    // Calcular média de tempo de roteamento
    // Implementar cálculo de SLA compliance
  }

  /**
   * Gera resposta de roteamento manual
   */
  generateManualRoutingResponse(incidentData) {
    return {
      incident: {
        id: incidentData.id,
        title: incidentData.title,
      },
      routing: {
        mode: 'manual',
        message: 'Automatic routing is disabled. Manual assignment required.',
        suggestedTeams: this.getSuggestedTeams(incidentData),
      },
    };
  }

  /**
   * Gera resposta de erro
   */
  generateErrorRoutingResponse(incidentData, error) {
    return {
      incident: {
        id: incidentData.id,
        title: incidentData.title,
      },
      routing: {
        error: true,
        message: error.message,
        fallbackTeam: this.teams.get('infrastructure-team'),
      },
    };
  }

  /**
   * Obtém equipes sugeridas
   */
  getSuggestedTeams(incidentData) {
    // Implementar lógica de sugestão baseada em keywords simples
    const teams = Array.from(this.teams.values());
    return teams.slice(0, 3).map(team => ({
      id: team.id,
      name: team.name,
      capabilities: team.capabilities,
    }));
  }

  /**
   * Obtém métricas de roteamento
   */
  getRoutingMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalRoutings > 0
          ? this.metrics.successfulRoutings / this.metrics.totalRoutings
          : 0,
      teamUtilization: this.getCurrentWorkload(),
      recentRoutings: this.routingHistory.slice(-10),
    };
  }

  /**
   * Obtém estatísticas de equipes
   */
  getTeamStatistics() {
    const stats = {};

    for (const [teamId, team] of this.teams.entries()) {
      const workload = this.workloadMap.get(teamId) || { incidents: [], totalLoad: 0 };

      stats[teamId] = {
        name: team.name,
        capacity: team.capacity,
        utilization: team.capacity.current / team.capacity.max,
        totalIncidents: workload.totalLoad,
        capabilities: team.capabilities,
        availability: team.availability,
        sla: team.sla,
      };
    }

    return stats;
  }
}

module.exports = RoutingEngine;
