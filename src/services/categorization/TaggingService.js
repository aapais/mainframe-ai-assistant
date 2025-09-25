/**
 * TaggingService - Sistema de Tags e Metadados para Categorização
 *
 * Gerencia tags automáticas e manuais, hierarquia de categorias,
 * relacionamentos entre áreas e metadados de classificação.
 */

const TaxonomyManager = require('./TaxonomyManager');

class TaggingService {
  constructor(options = {}) {
    this.taxonomyManager = new TaxonomyManager();
    this.config = {
      maxTagsPerIncident: options.maxTagsPerIncident || 10,
      autoTagThreshold: options.autoTagThreshold || 0.7,
      enableManualTags: options.enableManualTags !== false,
      enableAutoTags: options.enableAutoTags !== false,
      tagValidation: options.tagValidation !== false,
      ...options,
    };

    // Armazenamento de tags e metadados
    this.tags = new Map();
    this.incidentTags = new Map();
    this.tagHierarchy = new Map();
    this.tagRelationships = new Map();
    this.tagMetrics = new Map();

    this.initializeSystemTags();
  }

  /**
   * Inicializa tags do sistema baseadas na taxonomia
   */
  initializeSystemTags() {
    const taxonomies = this.taxonomyManager.exportTaxonomies().taxonomies;

    for (const [id, taxonomy] of Object.entries(taxonomies)) {
      this.createSystemTag({
        id: `system_${id}`,
        name: taxonomy.name,
        type: 'system',
        category: id,
        description: taxonomy.description,
        color: this.getTagColor(taxonomy.priority),
        priority: taxonomy.priority,
        autoApply: true,
        keywords: taxonomy.keywords,
        patterns: taxonomy.patterns,
      });

      // Criar tags para áreas específicas
      taxonomy.keywords.forEach((keyword, index) => {
        this.createSystemTag({
          id: `keyword_${id}_${index}`,
          name: keyword.toUpperCase(),
          type: 'keyword',
          category: id,
          parent: `system_${id}`,
          description: `Keyword tag for ${keyword}`,
          color: this.getTagColor('medium'),
          priority: 'medium',
          autoApply: true,
          keywords: [keyword],
        });
      });
    }

    // Tags de status e workflow
    this.createWorkflowTags();

    // Tags de impacto e urgência
    this.createImpactTags();

    // Tags temporais
    this.createTemporalTags();
  }

  /**
   * Cria tags de workflow do sistema
   */
  createWorkflowTags() {
    const workflowTags = [
      {
        id: 'status_new',
        name: 'NOVO',
        type: 'status',
        description: 'Incidente recém-criado',
        color: '#3498db',
        priority: 'high',
        autoApply: false,
      },
      {
        id: 'status_classified',
        name: 'CLASSIFICADO',
        type: 'status',
        description: 'Incidente já classificado automaticamente',
        color: '#2ecc71',
        priority: 'medium',
        autoApply: true,
      },
      {
        id: 'status_manual_review',
        name: 'REVISÃO MANUAL',
        type: 'status',
        description: 'Requer revisão manual de classificação',
        color: '#f39c12',
        priority: 'high',
        autoApply: true,
      },
      {
        id: 'status_routed',
        name: 'ROTEADO',
        type: 'status',
        description: 'Incidente roteado para equipe responsável',
        color: '#9b59b6',
        priority: 'medium',
        autoApply: true,
      },
    ];

    workflowTags.forEach(tag => this.createSystemTag(tag));
  }

  /**
   * Cria tags de impacto e urgência
   */
  createImpactTags() {
    const impactTags = [
      // Impacto
      {
        id: 'impact_critical',
        name: 'CRÍTICO',
        type: 'impact',
        description: 'Impacto crítico no negócio',
        color: '#e74c3c',
        priority: 'critical',
        autoApply: false,
      },
      {
        id: 'impact_high',
        name: 'ALTO',
        type: 'impact',
        description: 'Alto impacto no negócio',
        color: '#f39c12',
        priority: 'high',
        autoApply: false,
      },
      {
        id: 'impact_medium',
        name: 'MÉDIO',
        type: 'impact',
        description: 'Médio impacto no negócio',
        color: '#f1c40f',
        priority: 'medium',
        autoApply: false,
      },
      {
        id: 'impact_low',
        name: 'BAIXO',
        type: 'impact',
        description: 'Baixo impacto no negócio',
        color: '#95a5a6',
        priority: 'low',
        autoApply: false,
      },

      // Urgência
      {
        id: 'urgency_immediate',
        name: 'IMEDIATO',
        type: 'urgency',
        description: 'Requer ação imediata',
        color: '#e74c3c',
        priority: 'critical',
        autoApply: false,
      },
      {
        id: 'urgency_high',
        name: 'URGENTE',
        type: 'urgency',
        description: 'Requer ação em poucas horas',
        color: '#f39c12',
        priority: 'high',
        autoApply: false,
      },
      {
        id: 'urgency_normal',
        name: 'NORMAL',
        type: 'urgency',
        description: 'Prazo normal de atendimento',
        color: '#2ecc71',
        priority: 'medium',
        autoApply: false,
      },
    ];

    impactTags.forEach(tag => this.createSystemTag(tag));
  }

  /**
   * Cria tags temporais
   */
  createTemporalTags() {
    const temporalTags = [
      {
        id: 'time_business_hours',
        name: 'HORÁRIO COMERCIAL',
        type: 'temporal',
        description: 'Ocorreu durante horário comercial',
        color: '#2ecc71',
        priority: 'low',
        autoApply: true,
      },
      {
        id: 'time_after_hours',
        name: 'FORA DO HORÁRIO',
        type: 'temporal',
        description: 'Ocorreu fora do horário comercial',
        color: '#e67e22',
        priority: 'medium',
        autoApply: true,
      },
      {
        id: 'time_weekend',
        name: 'FIM DE SEMANA',
        type: 'temporal',
        description: 'Ocorreu durante fim de semana',
        color: '#9b59b6',
        priority: 'medium',
        autoApply: true,
      },
      {
        id: 'time_holiday',
        name: 'FERIADO',
        type: 'temporal',
        description: 'Ocorreu durante feriado',
        color: '#e74c3c',
        priority: 'high',
        autoApply: true,
      },
    ];

    temporalTags.forEach(tag => this.createSystemTag(tag));
  }

  /**
   * Cria tag do sistema
   */
  createSystemTag(tagConfig) {
    const tag = {
      id: tagConfig.id,
      name: tagConfig.name,
      type: tagConfig.type || 'system',
      category: tagConfig.category || null,
      parent: tagConfig.parent || null,
      children: [],
      description: tagConfig.description || '',
      color: tagConfig.color || '#95a5a6',
      priority: tagConfig.priority || 'medium',
      autoApply: tagConfig.autoApply || false,
      keywords: tagConfig.keywords || [],
      patterns: tagConfig.patterns || [],
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      isSystem: true,
      isActive: true,
      usageCount: 0,
      metadata: tagConfig.metadata || {},
    };

    this.tags.set(tag.id, tag);

    // Construir hierarquia
    if (tag.parent && this.tags.has(tag.parent)) {
      const parentTag = this.tags.get(tag.parent);
      if (!parentTag.children.includes(tag.id)) {
        parentTag.children.push(tag.id);
      }
    }

    return tag;
  }

  /**
   * Aplica tags automáticas a um incidente
   */
  async applyAutoTags(incidentData, classificationResult) {
    if (!this.config.enableAutoTags) {
      return { tags: [], applied: 0 };
    }

    const appliedTags = [];
    const text = this.prepareTextForTagging(incidentData);

    try {
      // Tags baseadas na classificação principal
      if (classificationResult.primaryCategory) {
        const categoryTags = this.getTagsByCategory(classificationResult.primaryCategory.category);
        appliedTags.push(...categoryTags);
      }

      // Tags baseadas em todas as classificações
      for (const classification of classificationResult.classifications) {
        if (classification.confidence >= this.config.autoTagThreshold) {
          const categoryTags = this.getTagsByCategory(classification.category);
          appliedTags.push(...categoryTags);
        }
      }

      // Tags baseadas em keywords
      const keywordTags = await this.detectKeywordTags(text);
      appliedTags.push(...keywordTags);

      // Tags baseadas em patterns
      const patternTags = await this.detectPatternTags(text);
      appliedTags.push(...patternTags);

      // Tags temporais
      const temporalTags = this.detectTemporalTags(incidentData);
      appliedTags.push(...temporalTags);

      // Tags de status
      const statusTags = this.getStatusTags(classificationResult);
      appliedTags.push(...statusTags);

      // Remover duplicatas e limitar quantidade
      const uniqueTags = this.deduplicateTags(appliedTags);
      const finalTags = uniqueTags.slice(0, this.config.maxTagsPerIncident);

      // Aplicar tags ao incidente
      this.setIncidentTags(incidentData.id, finalTags);

      // Atualizar métricas de uso
      finalTags.forEach(tag => this.incrementTagUsage(tag.id));

      return {
        tags: finalTags,
        applied: finalTags.length,
        skipped: appliedTags.length - finalTags.length,
      };
    } catch (error) {
      console.error('Error applying auto tags:', error);
      return { tags: [], applied: 0, error: error.message };
    }
  }

  /**
   * Detecta tags baseadas em keywords
   */
  async detectKeywordTags(text) {
    const detectedTags = [];

    for (const [tagId, tag] of this.tags.entries()) {
      if (!tag.autoApply || !tag.keywords.length) continue;

      for (const keyword of tag.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        if (regex.test(text)) {
          detectedTags.push(tag);
          break;
        }
      }
    }

    return detectedTags;
  }

  /**
   * Detecta tags baseadas em patterns
   */
  async detectPatternTags(text) {
    const detectedTags = [];

    for (const [tagId, tag] of this.tags.entries()) {
      if (!tag.autoApply || !tag.patterns.length) continue;

      for (const pattern of tag.patterns) {
        if (pattern.test && pattern.test(text)) {
          detectedTags.push(tag);
          break;
        }
      }
    }

    return detectedTags;
  }

  /**
   * Detecta tags temporais baseadas no timestamp
   */
  detectTemporalTags(incidentData) {
    const tags = [];

    if (!incidentData.timestamp) {
      return tags;
    }

    const date = new Date(incidentData.timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    // Horário comercial (8h às 18h, segunda a sexta)
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 18) {
      tags.push(this.tags.get('time_business_hours'));
    } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      tags.push(this.tags.get('time_after_hours'));
    }

    // Fim de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      tags.push(this.tags.get('time_weekend'));
    }

    // TODO: Implementar detecção de feriados
    // if (this.isHoliday(date)) {
    //     tags.push(this.tags.get('time_holiday'));
    // }

    return tags.filter(Boolean);
  }

  /**
   * Obtém tags de status baseadas na classificação
   */
  getStatusTags(classificationResult) {
    const tags = [];

    if (classificationResult.classifications.length > 0) {
      tags.push(this.tags.get('status_classified'));
    }

    if (classificationResult.confidence < 0.7) {
      tags.push(this.tags.get('status_manual_review'));
    }

    return tags.filter(Boolean);
  }

  /**
   * Obtém tags por categoria
   */
  getTagsByCategory(categoryId) {
    const tags = [];

    for (const [tagId, tag] of this.tags.entries()) {
      if (tag.category === categoryId && tag.autoApply) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Remove duplicatas de tags
   */
  deduplicateTags(tags) {
    const seen = new Set();
    return tags.filter(tag => {
      if (seen.has(tag.id)) {
        return false;
      }
      seen.add(tag.id);
      return true;
    });
  }

  /**
   * Adiciona tag manual a um incidente
   */
  async addManualTag(incidentId, tagId, userId, reason = '') {
    if (!this.config.enableManualTags) {
      throw new Error('Manual tagging is disabled');
    }

    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    const currentTags = this.getIncidentTags(incidentId);

    // Verificar se já existe
    if (currentTags.some(t => t.id === tagId)) {
      throw new Error('Tag already applied to incident');
    }

    // Verificar limite
    if (currentTags.length >= this.config.maxTagsPerIncident) {
      throw new Error('Maximum tags per incident reached');
    }

    // Adicionar tag
    currentTags.push({
      ...tag,
      appliedBy: userId,
      appliedAt: new Date().toISOString(),
      appliedReason: reason,
      isManual: true,
    });

    this.setIncidentTags(incidentId, currentTags);
    this.incrementTagUsage(tagId);

    return true;
  }

  /**
   * Remove tag de um incidente
   */
  async removeTag(incidentId, tagId, userId, reason = '') {
    const currentTags = this.getIncidentTags(incidentId);
    const tagIndex = currentTags.findIndex(t => t.id === tagId);

    if (tagIndex === -1) {
      throw new Error('Tag not found on incident');
    }

    const removedTag = currentTags[tagIndex];

    // Verificar se pode ser removida (tags de sistema podem ter restrições)
    if (removedTag.isSystem && !this.canRemoveSystemTag(removedTag, userId)) {
      throw new Error('Cannot remove system tag');
    }

    currentTags.splice(tagIndex, 1);
    this.setIncidentTags(incidentId, currentTags);

    // Log da remoção
    this.logTagAction(incidentId, tagId, 'removed', userId, reason);

    return true;
  }

  /**
   * Cria nova tag customizada
   */
  async createCustomTag(tagData, userId) {
    if (this.config.tagValidation) {
      this.validateTagData(tagData);
    }

    const tag = {
      id: tagData.id || `custom_${Date.now()}`,
      name: tagData.name,
      type: 'custom',
      category: tagData.category || null,
      parent: tagData.parent || null,
      children: [],
      description: tagData.description || '',
      color: tagData.color || '#95a5a6',
      priority: tagData.priority || 'medium',
      autoApply: false,
      keywords: tagData.keywords || [],
      patterns: tagData.patterns || [],
      createdAt: new Date().toISOString(),
      createdBy: userId,
      isSystem: false,
      isActive: true,
      usageCount: 0,
      metadata: tagData.metadata || {},
    };

    if (this.tags.has(tag.id)) {
      throw new Error('Tag ID already exists');
    }

    this.tags.set(tag.id, tag);

    return tag;
  }

  /**
   * Atualiza tag existente
   */
  async updateTag(tagId, updates, userId) {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    if (tag.isSystem && !this.canModifySystemTag(tag, userId)) {
      throw new Error('Cannot modify system tag');
    }

    const updatedTag = {
      ...tag,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    if (this.config.tagValidation) {
      this.validateTagData(updatedTag);
    }

    this.tags.set(tagId, updatedTag);

    return updatedTag;
  }

  /**
   * Obtém tags de um incidente
   */
  getIncidentTags(incidentId) {
    return this.incidentTags.get(incidentId) || [];
  }

  /**
   * Define tags de um incidente
   */
  setIncidentTags(incidentId, tags) {
    this.incidentTags.set(incidentId, tags);
  }

  /**
   * Obtém hierarquia de tags
   */
  getTagHierarchy(rootTagId = null) {
    const buildHierarchy = parentId => {
      const children = [];

      for (const [tagId, tag] of this.tags.entries()) {
        if (tag.parent === parentId) {
          children.push({
            ...tag,
            children: buildHierarchy(tagId),
          });
        }
      }

      return children;
    };

    return buildHierarchy(rootTagId);
  }

  /**
   * Busca tags por critérios
   */
  searchTags(criteria) {
    const results = [];

    for (const [tagId, tag] of this.tags.entries()) {
      let matches = true;

      if (criteria.name && !tag.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        matches = false;
      }

      if (criteria.type && tag.type !== criteria.type) {
        matches = false;
      }

      if (criteria.category && tag.category !== criteria.category) {
        matches = false;
      }

      if (criteria.isActive !== undefined && tag.isActive !== criteria.isActive) {
        matches = false;
      }

      if (matches) {
        results.push(tag);
      }
    }

    return results;
  }

  /**
   * Prepara texto para análise de tags
   */
  prepareTextForTagging(incidentData) {
    const texts = [];

    if (incidentData.title) texts.push(incidentData.title);
    if (incidentData.description) texts.push(incidentData.description);
    if (incidentData.comments) {
      texts.push(...incidentData.comments.map(c => c.text || ''));
    }

    return texts.join(' ').toLowerCase();
  }

  /**
   * Obtém cor da tag baseada na prioridade
   */
  getTagColor(priority) {
    const colors = {
      critical: '#e74c3c',
      high: '#f39c12',
      medium: '#f1c40f',
      low: '#95a5a6',
    };

    return colors[priority] || colors.medium;
  }

  /**
   * Incrementa contador de uso da tag
   */
  incrementTagUsage(tagId) {
    const tag = this.tags.get(tagId);
    if (tag) {
      tag.usageCount = (tag.usageCount || 0) + 1;
      tag.lastUsed = new Date().toISOString();
    }
  }

  /**
   * Valida dados da tag
   */
  validateTagData(tagData) {
    if (!tagData.name || typeof tagData.name !== 'string') {
      throw new Error('Tag name is required and must be a string');
    }

    if (tagData.name.length > 50) {
      throw new Error('Tag name must be 50 characters or less');
    }

    const validTypes = ['system', 'custom', 'keyword', 'status', 'impact', 'urgency', 'temporal'];
    if (tagData.type && !validTypes.includes(tagData.type)) {
      throw new Error('Invalid tag type');
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (tagData.priority && !validPriorities.includes(tagData.priority)) {
      throw new Error('Invalid tag priority');
    }
  }

  /**
   * Verifica se pode remover tag do sistema
   */
  canRemoveSystemTag(tag, userId) {
    // Implementar lógica de permissões
    return false; // Por padrão, tags de sistema não podem ser removidas
  }

  /**
   * Verifica se pode modificar tag do sistema
   */
  canModifySystemTag(tag, userId) {
    // Implementar lógica de permissões
    return false; // Por padrão, tags de sistema não podem ser modificadas
  }

  /**
   * Registra ação realizada em tag
   */
  logTagAction(incidentId, tagId, action, userId, reason) {
    // Implementar sistema de auditoria
    console.log(
      `Tag action: ${action} tag ${tagId} on incident ${incidentId} by ${userId}. Reason: ${reason}`
    );
  }

  /**
   * Obtém estatísticas de tags
   */
  getTagStatistics() {
    const stats = {
      totalTags: this.tags.size,
      byType: {},
      byCategory: {},
      mostUsed: [],
      leastUsed: [],
      totalUsage: 0,
    };

    const usageArray = [];

    for (const tag of this.tags.values()) {
      // Por tipo
      if (!stats.byType[tag.type]) {
        stats.byType[tag.type] = 0;
      }
      stats.byType[tag.type]++;

      // Por categoria
      if (tag.category) {
        if (!stats.byCategory[tag.category]) {
          stats.byCategory[tag.category] = 0;
        }
        stats.byCategory[tag.category]++;
      }

      // Para ranking de uso
      usageArray.push({
        id: tag.id,
        name: tag.name,
        usageCount: tag.usageCount || 0,
      });

      stats.totalUsage += tag.usageCount || 0;
    }

    // Ordenar por uso
    usageArray.sort((a, b) => b.usageCount - a.usageCount);
    stats.mostUsed = usageArray.slice(0, 10);
    stats.leastUsed = usageArray.slice(-10).reverse();

    return stats;
  }

  /**
   * Exporta configuração de tags
   */
  exportTags() {
    return {
      tags: Array.from(this.tags.values()),
      incidentTags: Object.fromEntries(this.incidentTags),
      metadata: {
        totalTags: this.tags.size,
        exportDate: new Date().toISOString(),
      },
    };
  }

  /**
   * Importa configuração de tags
   */
  importTags(data) {
    if (!data.tags || !Array.isArray(data.tags)) {
      throw new Error('Invalid tags data format');
    }

    this.tags.clear();
    this.incidentTags.clear();

    // Importar tags
    for (const tag of data.tags) {
      this.tags.set(tag.id, tag);
    }

    // Importar associações incidente-tag
    if (data.incidentTags) {
      for (const [incidentId, tags] of Object.entries(data.incidentTags)) {
        this.incidentTags.set(incidentId, tags);
      }
    }

    return true;
  }
}

module.exports = TaggingService;
