/**
 * Sistema de Analytics de Logs de Auditoria
 * Analisa padrões, métricas e tendências nos logs de resolução de incidentes
 * Fornece insights para melhoria contínua e compliance
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');

class LogAnalytics extends EventEmitter {
  constructor(auditService, config = {}) {
    super();
    this.auditService = auditService;
    this.config = {
      analysisInterval: 300000, // 5 minutos
      retentionDays: 90,
      alertThresholds: {
        slaBreachRate: 0.05, // 5%
        criticalIncidentRate: 0.02, // 2%
        llmFailureRate: 0.01, // 1%
        operatorErrorRate: 0.03, // 3%
      },
      performanceBaselines: {
        avgResolutionTime: 1800000, // 30 minutos
        avgResponseTime: 300000, // 5 minutos
        targetSLACompliance: 0.98, // 98%
      },
      ...config,
    };

    this.analytics = {
      realTimeMetrics: {},
      trendData: {},
      patterns: {},
      insights: [],
      alerts: [],
    };

    this.startAnalytics();
  }

  /**
   * Inicia análises contínuas
   */
  startAnalytics() {
    this.analysisInterval = setInterval(() => {
      this.performRealTimeAnalysis();
    }, this.config.analysisInterval);

    // Escuta novos eventos de auditoria
    this.auditService.on('auditEntry', entry => {
      this.processNewEntry(entry);
    });
  }

  /**
   * Processa nova entrada de log em tempo real
   */
  processNewEntry(entry) {
    this.updateRealTimeMetrics(entry);
    this.detectAnomalies(entry);
    this.checkAlertConditions(entry);
  }

  /**
   * Atualiza métricas em tempo real
   */
  updateRealTimeMetrics(entry) {
    const now = new Date();
    const hourKey = now.getHours();
    const dayKey = now.toISOString().split('T')[0];

    if (!this.analytics.realTimeMetrics[dayKey]) {
      this.analytics.realTimeMetrics[dayKey] = {
        totalEvents: 0,
        byType: {},
        byHour: {},
        performance: {},
        compliance: {},
      };
    }

    const dayMetrics = this.analytics.realTimeMetrics[dayKey];
    dayMetrics.totalEvents++;

    // Métricas por tipo
    if (!dayMetrics.byType[entry.eventType]) {
      dayMetrics.byType[entry.eventType] = 0;
    }
    dayMetrics.byType[entry.eventType]++;

    // Métricas por hora
    if (!dayMetrics.byHour[hourKey]) {
      dayMetrics.byHour[hourKey] = 0;
    }
    dayMetrics.byHour[hourKey]++;

    // Métricas de performance
    if (entry.executionTime) {
      if (!dayMetrics.performance[entry.eventType]) {
        dayMetrics.performance[entry.eventType] = {
          total: 0,
          count: 0,
          min: Infinity,
          max: 0,
          avg: 0,
        };
      }

      const perf = dayMetrics.performance[entry.eventType];
      perf.total += entry.executionTime;
      perf.count++;
      perf.min = Math.min(perf.min, entry.executionTime);
      perf.max = Math.max(perf.max, entry.executionTime);
      perf.avg = perf.total / perf.count;
    }

    // Métricas de compliance
    if (entry.compliance) {
      if (!dayMetrics.compliance.violations) {
        dayMetrics.compliance.violations = 0;
      }
      if (entry.compliance.requiresApproval && !entry.compliance.approvedBy) {
        dayMetrics.compliance.violations++;
      }
    }
  }

  /**
   * Detecta anomalias em tempo real
   */
  detectAnomalies(entry) {
    const anomalies = [];

    // Anomalia de performance
    if (entry.executionTime) {
      const baseline = this.config.performanceBaselines.avgResolutionTime;
      if (entry.executionTime > baseline * 2) {
        anomalies.push({
          type: 'PERFORMANCE_ANOMALY',
          severity: 'HIGH',
          description: `Tempo de execução ${entry.executionTime}ms excede baseline em 100%`,
          entry: entry.eventType,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Anomalia de compliance
    if (entry.compliance?.requiresApproval && !entry.compliance.approvedBy) {
      anomalies.push({
        type: 'COMPLIANCE_ANOMALY',
        severity: 'CRITICAL',
        description: 'Ação crítica executada sem aprovação necessária',
        entry: entry.eventType,
        timestamp: new Date().toISOString(),
      });
    }

    // Anomalia de LLM
    if (entry.eventType === 'LLM_INTERACTION' && entry.confidence < 0.5) {
      anomalies.push({
        type: 'LLM_ANOMALY',
        severity: 'MEDIUM',
        description: `Baixa confiança na resposta LLM: ${entry.confidence}`,
        entry: entry.eventType,
        timestamp: new Date().toISOString(),
      });
    }

    if (anomalies.length > 0) {
      this.analytics.alerts.push(...anomalies);
      this.emit('anomaliesDetected', anomalies);
    }
  }

  /**
   * Verifica condições de alerta
   */
  checkAlertConditions(entry) {
    const dayKey = new Date().toISOString().split('T')[0];
    const dayMetrics = this.analytics.realTimeMetrics[dayKey];

    if (!dayMetrics) return;

    const alerts = [];

    // Taxa de violação de SLA
    if (entry.eventType === 'SLA_METRICS' && entry.breach) {
      const slaEvents = dayMetrics.byType['SLA_METRICS'] || 0;
      const breaches = this.countBreachesToday();
      const breachRate = breaches / slaEvents;

      if (breachRate > this.config.alertThresholds.slaBreachRate) {
        alerts.push({
          type: 'SLA_BREACH_RATE_EXCEEDED',
          severity: 'HIGH',
          rate: breachRate,
          threshold: this.config.alertThresholds.slaBreachRate,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Taxa de falhas de LLM
    if (entry.eventType === 'LLM_INTERACTION' && entry.confidence < 0.3) {
      const llmEvents = dayMetrics.byType['LLM_INTERACTION'] || 0;
      const failures = this.countLLMFailuresToday();
      const failureRate = failures / llmEvents;

      if (failureRate > this.config.alertThresholds.llmFailureRate) {
        alerts.push({
          type: 'LLM_FAILURE_RATE_EXCEEDED',
          severity: 'MEDIUM',
          rate: failureRate,
          threshold: this.config.alertThresholds.llmFailureRate,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (alerts.length > 0) {
      this.analytics.alerts.push(...alerts);
      this.emit('alertsGenerated', alerts);
    }
  }

  /**
   * Realiza análise em tempo real
   */
  async performRealTimeAnalysis() {
    const startTime = performance.now();

    try {
      await Promise.all([
        this.analyzeResolutionMetrics(),
        this.analyzeIncidentPatterns(),
        this.analyzeOperatorPerformance(),
        this.analyzeLLMEffectiveness(),
        this.analyzeComplianceStatus(),
      ]);

      const analysisTime = performance.now() - startTime;
      this.emit('analysisCompleted', {
        duration: analysisTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.emit('analysisError', error);
    }
  }

  /**
   * Analisa métricas de resolução
   */
  async analyzeResolutionMetrics() {
    const logs = this.auditService.logBuffer;
    const resolutionData = logs.filter(log => log.eventType === 'SLA_METRICS');

    if (resolutionData.length === 0) return;

    const metrics = {
      totalIncidents: resolutionData.length,
      avgResolutionTime: 0,
      avgResponseTime: 0,
      slaCompliance: 0,
      byCategory: {},
      bySeverity: {},
    };

    let totalResolutionTime = 0;
    let totalResponseTime = 0;
    let compliantIncidents = 0;

    resolutionData.forEach(incident => {
      totalResolutionTime += incident.resolutionTime || 0;
      totalResponseTime += incident.responseTime || 0;

      if (!incident.breach) compliantIncidents++;

      // Por categoria
      const category = incident.category || 'UNKNOWN';
      if (!metrics.byCategory[category]) {
        metrics.byCategory[category] = {
          count: 0,
          avgTime: 0,
          compliance: 0,
        };
      }
      metrics.byCategory[category].count++;

      // Por severidade
      const severity = incident.severity || 'UNKNOWN';
      if (!metrics.bySeverity[severity]) {
        metrics.bySeverity[severity] = {
          count: 0,
          avgTime: 0,
          compliance: 0,
        };
      }
      metrics.bySeverity[severity].count++;
    });

    metrics.avgResolutionTime = totalResolutionTime / resolutionData.length;
    metrics.avgResponseTime = totalResponseTime / resolutionData.length;
    metrics.slaCompliance = compliantIncidents / resolutionData.length;

    this.analytics.trendData.resolutionMetrics = metrics;
    return metrics;
  }

  /**
   * Analisa padrões de incidentes
   */
  async analyzeIncidentPatterns() {
    const logs = this.auditService.logBuffer;
    const incidentLogs = logs.filter(log => log.incidentId);

    const patterns = {
      timePatterns: this.analyzeTimePatterns(incidentLogs),
      categoryPatterns: this.analyzeCategoryPatterns(incidentLogs),
      resolutionPatterns: this.analyzeResolutionPatterns(incidentLogs),
      escalationPatterns: this.analyzeEscalationPatterns(incidentLogs),
    };

    this.analytics.patterns.incidents = patterns;
    return patterns;
  }

  /**
   * Analisa performance dos operadores
   */
  async analyzeOperatorPerformance() {
    const logs = this.auditService.logBuffer;
    const operatorLogs = logs.filter(log => log.operatorId);

    const performance = {};

    operatorLogs.forEach(log => {
      const operatorId = log.operatorId;

      if (!performance[operatorId]) {
        performance[operatorId] = {
          totalActions: 0,
          avgExecutionTime: 0,
          errorRate: 0,
          complianceScore: 1.0,
          categories: {},
          timeDistribution: {},
        };
      }

      const operator = performance[operatorId];
      operator.totalActions++;

      if (log.executionTime) {
        operator.avgExecutionTime =
          (operator.avgExecutionTime * (operator.totalActions - 1) + log.executionTime) /
          operator.totalActions;
      }

      // Análise de compliance
      if (log.compliance?.requiresApproval && !log.compliance.approvedBy) {
        operator.complianceScore *= 0.95; // Penalidade por ação sem aprovação
      }
    });

    this.analytics.trendData.operatorPerformance = performance;
    return performance;
  }

  /**
   * Analisa efetividade do LLM
   */
  async analyzeLLMEffectiveness() {
    const logs = this.auditService.logBuffer;
    const llmLogs = logs.filter(log => log.eventType === 'LLM_INTERACTION');

    const effectiveness = {
      totalInteractions: llmLogs.length,
      avgConfidence: 0,
      avgExecutionTime: 0,
      successRate: 0,
      byProvider: {},
      byModel: {},
      tokenUsage: {
        totalInput: 0,
        totalOutput: 0,
        totalCost: 0,
      },
    };

    if (llmLogs.length === 0) return effectiveness;

    let totalConfidence = 0;
    let totalExecutionTime = 0;
    let successfulInteractions = 0;

    llmLogs.forEach(log => {
      totalConfidence += log.confidence || 0;
      totalExecutionTime += log.executionTime || 0;

      if (log.confidence > 0.7) successfulInteractions++;

      // Token usage
      effectiveness.tokenUsage.totalInput += log.tokens?.input || 0;
      effectiveness.tokenUsage.totalOutput += log.tokens?.output || 0;
      effectiveness.tokenUsage.totalCost += log.tokens?.cost || 0;

      // Por provider
      const provider = log.llmProvider || 'UNKNOWN';
      if (!effectiveness.byProvider[provider]) {
        effectiveness.byProvider[provider] = {
          count: 0,
          avgConfidence: 0,
          avgTime: 0,
        };
      }
      effectiveness.byProvider[provider].count++;

      // Por modelo
      const model = log.model || 'UNKNOWN';
      if (!effectiveness.byModel[model]) {
        effectiveness.byModel[model] = {
          count: 0,
          avgConfidence: 0,
          avgTime: 0,
        };
      }
      effectiveness.byModel[model].count++;
    });

    effectiveness.avgConfidence = totalConfidence / llmLogs.length;
    effectiveness.avgExecutionTime = totalExecutionTime / llmLogs.length;
    effectiveness.successRate = successfulInteractions / llmLogs.length;

    this.analytics.trendData.llmEffectiveness = effectiveness;
    return effectiveness;
  }

  /**
   * Analisa status de compliance
   */
  async analyzeComplianceStatus() {
    const logs = this.auditService.logBuffer;
    const complianceLogs = logs.filter(log => log.compliance);

    const compliance = {
      totalEvents: complianceLogs.length,
      violations: 0,
      byRegulation: {},
      byCategory: {},
      approvalRate: 0,
      riskScore: 0,
    };

    let approvalsRequired = 0;
    let approvalsGranted = 0;

    complianceLogs.forEach(log => {
      // Violações
      if (log.compliance.requiresApproval && !log.compliance.approvedBy) {
        compliance.violations++;
      }

      // Taxa de aprovação
      if (log.compliance.requiresApproval) {
        approvalsRequired++;
        if (log.compliance.approvedBy) {
          approvalsGranted++;
        }
      }

      // Por regulamentação
      if (log.compliance.regulatoryImpact) {
        log.compliance.regulatoryImpact.forEach(regulation => {
          if (!compliance.byRegulation[regulation]) {
            compliance.byRegulation[regulation] = {
              count: 0,
              violations: 0,
            };
          }
          compliance.byRegulation[regulation].count++;
        });
      }

      // Por categoria
      const category = log.compliance.category || 'UNKNOWN';
      if (!compliance.byCategory[category]) {
        compliance.byCategory[category] = {
          count: 0,
          violations: 0,
        };
      }
      compliance.byCategory[category].count++;
    });

    compliance.approvalRate = approvalsRequired > 0 ? approvalsGranted / approvalsRequired : 1;
    compliance.riskScore = compliance.violations / compliance.totalEvents;

    this.analytics.trendData.compliance = compliance;
    return compliance;
  }

  /**
   * Gera insights automáticos
   */
  generateInsights() {
    const insights = [];

    // Insight de performance
    const resolutionMetrics = this.analytics.trendData.resolutionMetrics;
    if (resolutionMetrics) {
      if (resolutionMetrics.slaCompliance < this.config.performanceBaselines.targetSLACompliance) {
        insights.push({
          type: 'PERFORMANCE',
          severity: 'HIGH',
          title: 'SLA Compliance Below Target',
          description: `Current SLA compliance rate is ${(resolutionMetrics.slaCompliance * 100).toFixed(2)}%, below target of ${(this.config.performanceBaselines.targetSLACompliance * 100).toFixed(2)}%`,
          recommendation: 'Review incident response procedures and consider additional automation',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Insight de LLM
    const llmEffectiveness = this.analytics.trendData.llmEffectiveness;
    if (llmEffectiveness && llmEffectiveness.avgConfidence < 0.7) {
      insights.push({
        type: 'LLM',
        severity: 'MEDIUM',
        title: 'Low LLM Confidence',
        description: `Average LLM confidence is ${(llmEffectiveness.avgConfidence * 100).toFixed(2)}%`,
        recommendation: 'Consider retraining models or adjusting prompts',
        timestamp: new Date().toISOString(),
      });
    }

    // Insight de compliance
    const compliance = this.analytics.trendData.compliance;
    if (compliance && compliance.riskScore > 0.05) {
      insights.push({
        type: 'COMPLIANCE',
        severity: 'CRITICAL',
        title: 'High Compliance Risk',
        description: `Compliance risk score is ${(compliance.riskScore * 100).toFixed(2)}%`,
        recommendation: 'Immediate review of approval processes required',
        timestamp: new Date().toISOString(),
      });
    }

    this.analytics.insights = insights;
    return insights;
  }

  /**
   * Exporta relatório de analytics
   */
  exportAnalyticsReport(format = 'json') {
    const report = {
      reportId: require('crypto').randomUUID(),
      timestamp: new Date().toISOString(),
      period: this.getAnalysisPeriod(),
      format,
      data: {
        realTimeMetrics: this.analytics.realTimeMetrics,
        trendData: this.analytics.trendData,
        patterns: this.analytics.patterns,
        insights: this.generateInsights(),
        alerts: this.analytics.alerts,
      },
      summary: this.generateSummary(),
    };

    return report;
  }

  /**
   * Gera resumo executivo
   */
  generateSummary() {
    const metrics = this.analytics.trendData.resolutionMetrics;
    const llm = this.analytics.trendData.llmEffectiveness;
    const compliance = this.analytics.trendData.compliance;

    return {
      totalIncidents: metrics?.totalIncidents || 0,
      avgResolutionTime: metrics?.avgResolutionTime || 0,
      slaCompliance: metrics?.slaCompliance || 0,
      llmSuccessRate: llm?.successRate || 0,
      complianceScore: compliance ? 1 - compliance.riskScore : 1,
      totalAlerts: this.analytics.alerts.length,
      criticalInsights: this.analytics.insights.filter(i => i.severity === 'CRITICAL').length,
    };
  }

  // Métodos auxiliares
  analyzeTimePatterns(logs) {
    const patterns = { hourly: {}, daily: {}, weekly: {} };

    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const hour = date.getHours();
      const day = date.getDay();

      patterns.hourly[hour] = (patterns.hourly[hour] || 0) + 1;
      patterns.daily[day] = (patterns.daily[day] || 0) + 1;
    });

    return patterns;
  }

  analyzeCategoryPatterns(logs) {
    const categories = {};
    logs.forEach(log => {
      const category = log.category || 'UNKNOWN';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }

  analyzeResolutionPatterns(logs) {
    return { automated: 0, manual: 0, hybrid: 0 };
  }

  analyzeEscalationPatterns(logs) {
    return { total: 0, byLevel: {} };
  }

  countBreachesToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.auditService.logBuffer.filter(
      log => log.timestamp.startsWith(today) && log.eventType === 'SLA_METRICS' && log.breach
    ).length;
  }

  countLLMFailuresToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.auditService.logBuffer.filter(
      log =>
        log.timestamp.startsWith(today) &&
        log.eventType === 'LLM_INTERACTION' &&
        log.confidence < 0.3
    ).length;
  }

  getAnalysisPeriod() {
    const end = new Date();
    const start = new Date(end.getTime() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  /**
   * Para o serviço de analytics
   */
  stop() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}

module.exports = LogAnalytics;
