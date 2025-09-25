/**
 * Sistema de Categorização Automática de Incidentes - Entry Point
 *
 * Ponto de entrada principal para o sistema de categorização automática
 * que exporta todos os componentes necessários para integração.
 */

const TaxonomyManager = require('./TaxonomyManager');
const TechnologyClassifier = require('./TechnologyClassifier');
const TaggingService = require('./TaggingService');
const RoutingEngine = require('./RoutingEngine');
const CategorizationIntegration = require('./CategorizationIntegration');
const CategoryManager = require('./CategoryManager');
const MLClassifier = require('./MLClassifier');
const AutoRouter = require('./AutoRouter');
const ContinuousLearningPipeline = require('./ContinuousLearningPipeline');

/**
 * Factory function para criar instância completa do sistema
 */
function createCategorizationSystem(options = {}) {
  return new CategorizationIntegration(options);
}

/**
 * Factory function para criar instância apenas do classificador
 */
function createClassifier(options = {}) {
  return new TechnologyClassifier(options);
}

/**
 * Factory function para criar instância apenas do sistema de tags
 */
function createTaggingService(options = {}) {
  return new TaggingService(options);
}

/**
 * Factory function para criar instância apenas do motor de roteamento
 */
function createRoutingEngine(options = {}) {
  return new RoutingEngine(options);
}

/**
 * Factory function para criar instância apenas do gerenciador de taxonomias
 */
function createTaxonomyManager(options = {}) {
  return new TaxonomyManager(options);
}

/**
 * Factory function para criar instância do sistema híbrido de categorização
 */
function createCategoryManager(options = {}) {
  return new CategoryManager(options);
}

/**
 * Factory function para criar instância do classificador ML
 */
function createMLClassifier(options = {}) {
  return new MLClassifier(options);
}

/**
 * Factory function para criar instância do roteador automático
 */
function createAutoRouter(options = {}) {
  return new AutoRouter(options);
}

/**
 * Factory function para criar instância do pipeline de aprendizado contínuo
 */
function createContinuousLearningPipeline(options = {}) {
  return new ContinuousLearningPipeline(options);
}

/**
 * Configurações padrão do sistema
 */
const defaultConfig = {
  enableAutoClassification: true,
  enableAutoTagging: true,
  enableAutoRouting: true,
  enableWebhooks: true,
  enableAuditLog: true,
  minConfidence: 0.6,
  maxResults: 5,
  routingTimeout: 30000,
  escalationThreshold: 60,
};

/**
 * Utilitários para validação e conversão
 */
const utils = {
  /**
   * Valida dados de incidente
   */
  validateIncidentData(incidentData) {
    const required = ['id'];
    const missing = required.filter(field => !incidentData[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!incidentData.title && !incidentData.description) {
      throw new Error('Either title or description is required');
    }

    return true;
  },

  /**
   * Normaliza dados de incidente para formato padrão
   */
  normalizeIncidentData(incidentData) {
    return {
      id: incidentData.id,
      title: incidentData.title || '',
      description: incidentData.description || '',
      source: incidentData.source || 'unknown',
      timestamp: incidentData.timestamp || new Date().toISOString(),
      priority: incidentData.priority || 'medium',
      affectedUsers: incidentData.affectedUsers || 0,
      reporter: incidentData.reporter || 'system',
      metadata: incidentData.metadata || {},
    };
  },

  /**
   * Converte resultado para formato específico de sistema externo
   */
  convertToServiceNow(result) {
    return {
      number: result.incident.id,
      short_description: result.incident.title,
      description: result.incident.description,
      category: result.results.classification?.primaryCategory?.category || 'infrastructure',
      assignment_group: result.results.routing?.team?.id || 'infrastructure-team',
      priority: this.mapPriorityToServiceNow(result.results.routing?.sla?.response),
      u_technology_area: result.results.classification?.primaryCategory?.taxonomy?.name,
      u_confidence_score: result.results.classification?.confidence,
      u_tags: result.results.tagging?.tags?.map(tag => tag.name).join(','),
      u_auto_classified: result.results.classification ? 'true' : 'false',
    };
  },

  /**
   * Converte resultado para formato Jira
   */
  convertToJira(result) {
    return {
      fields: {
        summary: result.incident.title,
        description: result.incident.description,
        issuetype: { name: 'Incident' },
        components: result.results.classification?.primaryCategory?.category
          ? [{ name: result.results.classification.primaryCategory.category }]
          : [],
        assignee: { name: result.results.routing?.team?.id },
        labels: result.results.tagging?.tags?.map(tag => tag.name.replace(/\s+/g, '_')) || [],
        customfield_10001: result.results.classification?.confidence, // Confidence Score
        customfield_10002: result.results.classification?.primaryCategory?.taxonomy?.name, // Technology Area
      },
    };
  },

  /**
   * Mapeia prioridade para ServiceNow
   */
  mapPriorityToServiceNow(slaResponse) {
    if (slaResponse <= 5) return '1'; // Critical
    if (slaResponse <= 15) return '2'; // High
    if (slaResponse <= 30) return '3'; // Medium
    return '4'; // Low
  },

  /**
   * Gera relatório de métricas
   */
  generateMetricsReport(statistics) {
    return {
      summary: {
        totalIncidents: statistics.global.totalProcessed,
        successRate:
          (
            (statistics.global.successfulClassifications / statistics.global.totalProcessed) *
            100
          ).toFixed(2) + '%',
        averageProcessingTime: statistics.global.averageProcessingTime + 'ms',
        errors: statistics.global.errors,
      },
      classification: {
        totalClassifications: statistics.classification.totalClassifications,
        averageConfidence: (statistics.classification.averageConfidence * 100).toFixed(1) + '%',
        successRate: (statistics.classification.successRate * 100).toFixed(2) + '%',
      },
      routing: {
        totalRoutings: statistics.routing.totalRoutings,
        successRate: (statistics.routing.successRate * 100).toFixed(2) + '%',
        escalations: statistics.routing.escalations,
      },
      tagging: {
        totalTags: statistics.tagging.totalTags,
        totalUsage: statistics.tagging.totalUsage,
        mostUsedTags: statistics.tagging.mostUsed.slice(0, 5),
      },
    };
  },
};

/**
 * Constantes do sistema
 */
const constants = {
  // Níveis de prioridade
  PRIORITY_LEVELS: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  },

  // Tipos de tag
  TAG_TYPES: {
    SYSTEM: 'system',
    STATUS: 'status',
    IMPACT: 'impact',
    URGENCY: 'urgency',
    TEMPORAL: 'temporal',
    CUSTOM: 'custom',
  },

  // Métodos de classificação
  CLASSIFICATION_METHODS: {
    KEYWORD: 'keyword',
    PATTERN: 'pattern',
    NLP: 'nlp',
    CONTEXT: 'context',
  },

  // Status de processamento
  PROCESSING_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
  },

  // Eventos do sistema
  EVENTS: {
    INCIDENT_PROCESSED: 'incident_processed',
    CLASSIFICATION_COMPLETED: 'classification_completed',
    TAGGING_COMPLETED: 'tagging_completed',
    ROUTING_COMPLETED: 'routing_completed',
    MANUAL_TAG_ADDED: 'manual_tag_added',
    TAG_REMOVED: 'tag_removed',
    INCIDENT_REROUTED: 'incident_rerouted',
    FEEDBACK_PROVIDED: 'feedback_provided',
  },
};

module.exports = {
  // Classes principais
  TaxonomyManager,
  TechnologyClassifier,
  TaggingService,
  RoutingEngine,
  CategorizationIntegration,
  CategoryManager,
  MLClassifier,
  AutoRouter,
  ContinuousLearningPipeline,

  // Factory functions
  createCategorizationSystem,
  createClassifier,
  createTaggingService,
  createRoutingEngine,
  createTaxonomyManager,
  createCategoryManager,
  createMLClassifier,
  createAutoRouter,
  createContinuousLearningPipeline,

  // Configurações e utilitários
  defaultConfig,
  utils,
  constants,
};

// Para compatibilidade com CommonJS e ES6
module.exports.default = module.exports;
