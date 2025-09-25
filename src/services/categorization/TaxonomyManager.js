/**
 * TaxonomyManager - Gestão de Taxonomias de Áreas Tecnológicas Bancárias
 *
 * Sistema responsável por definir e gerenciar a taxonomia completa de áreas
 * tecnológicas bancárias para categorização automática de incidentes.
 */

class TaxonomyManager {
  constructor() {
    this.taxonomies = this.initializeTaxonomies();
    this.hierarchyMap = this.buildHierarchyMap();
    this.keywordMap = this.buildKeywordMap();
  }

  /**
   * Inicializa as taxonomias completas de áreas tecnológicas bancárias
   */
  initializeTaxonomies() {
    return {
      mainframe: {
        id: 'mainframe',
        name: 'Mainframe',
        description: 'Sistemas mainframe IBM z/OS e tecnologias correlatas',
        level: 1,
        parent: null,
        children: ['cobol', 'cics', 'db2', 'zos', 'jcl', 'vsam', 'ims'],
        keywords: ['mainframe', 'z/os', 'mvs', 'tso', 'ispf', 'batch', 'job'],
        patterns: [
          /\b(mainframe|z\/os|mvs|tso|ispf)\b/i,
          /\b(batch|job|jcl)\b/i,
          /\b(abend|s0c[0-9]|sx[0-9]{2})\b/i,
        ],
        priority: 'high',
        routing: {
          team: 'mainframe-support',
          escalation: 'mainframe-architects',
          sla: 30, // minutes
        },
      },

      cobol: {
        id: 'cobol',
        name: 'COBOL',
        description: 'Aplicações e programas COBOL',
        level: 2,
        parent: 'mainframe',
        children: [],
        keywords: ['cobol', 'copybook', 'programa', 'compilacao', 'linkage'],
        patterns: [
          /\b(cobol|copybook|pic\s+[x9]+)\b/i,
          /\b(working-storage|linkage-section)\b/i,
          /\b(perform|call|goback)\b/i,
        ],
        priority: 'high',
        routing: {
          team: 'cobol-developers',
          escalation: 'mainframe-architects',
          sla: 45,
        },
      },

      cics: {
        id: 'cics',
        name: 'CICS',
        description: 'Customer Information Control System',
        level: 2,
        parent: 'mainframe',
        children: [],
        keywords: ['cics', 'transaction', 'terminal', 'bms', 'commarea'],
        patterns: [
          /\b(cics|transaction|terminal)\b/i,
          /\b(bms|commarea|eib)\b/i,
          /\b(dfh[a-z0-9]+|cemt|cedf)\b/i,
        ],
        priority: 'critical',
        routing: {
          team: 'cics-support',
          escalation: 'mainframe-architects',
          sla: 15,
        },
      },

      db2: {
        id: 'db2',
        name: 'DB2',
        description: 'Sistema de gerenciamento de banco de dados DB2',
        level: 2,
        parent: 'mainframe',
        children: [],
        keywords: ['db2', 'sql', 'tablespace', 'index', 'bind', 'plan'],
        patterns: [
          /\b(db2|sql|tablespace)\b/i,
          /\b(bind|plan|package)\b/i,
          /\b(dsn[a-z0-9]+|sqlcode)\b/i,
        ],
        priority: 'critical',
        routing: {
          team: 'dba-team',
          escalation: 'database-architects',
          sla: 20,
        },
      },

      coreBanking: {
        id: 'core-banking',
        name: 'Core Banking',
        description: 'Sistemas centrais bancários e processamento',
        level: 1,
        parent: null,
        children: ['accounts', 'transactions', 'batch-processing', 'soa', 'middleware'],
        keywords: ['core', 'conta', 'transacao', 'batch', 'processamento', 'soa'],
        patterns: [
          /\b(core.*banking|sistema.*central)\b/i,
          /\b(conta|transacao|processamento)\b/i,
          /\b(batch|soa|middleware)\b/i,
        ],
        priority: 'critical',
        routing: {
          team: 'core-banking-team',
          escalation: 'banking-architects',
          sla: 15,
        },
      },

      mobileBanking: {
        id: 'mobile-banking',
        name: 'Mobile Banking',
        description: 'Aplicações móveis bancárias',
        level: 1,
        parent: null,
        children: ['ios', 'android', 'react-native', 'mobile-api'],
        keywords: ['mobile', 'app', 'ios', 'android', 'react-native', 'smartphone'],
        patterns: [
          /\b(mobile|app|smartphone)\b/i,
          /\b(ios|android|react.native)\b/i,
          /\b(mobile.*api|app.*store)\b/i,
        ],
        priority: 'high',
        routing: {
          team: 'mobile-team',
          escalation: 'mobile-architects',
          sla: 30,
        },
      },

      internetBanking: {
        id: 'internet-banking',
        name: 'Internet Banking',
        description: 'Plataforma web de internet banking',
        level: 1,
        parent: null,
        children: ['web-portal', 'api-gateway', 'microservices', 'frontend'],
        keywords: ['internet', 'web', 'portal', 'api', 'microservico', 'frontend'],
        patterns: [
          /\b(internet.*banking|web.*banking)\b/i,
          /\b(portal|web|frontend)\b/i,
          /\b(api.*gateway|microservi[cç]o)\b/i,
        ],
        priority: 'high',
        routing: {
          team: 'web-team',
          escalation: 'web-architects',
          sla: 30,
        },
      },

      paymentSystems: {
        id: 'payment-systems',
        name: 'Payment Systems',
        description: 'Sistemas de pagamento e transferências',
        level: 1,
        parent: null,
        children: ['pix', 'ted', 'doc', 'cards', 'payment-gateway'],
        keywords: ['pagamento', 'pix', 'ted', 'doc', 'cartao', 'transferencia'],
        patterns: [
          /\b(pix|ted|doc|pagamento)\b/i,
          /\b(cart[aã]o|transfer[eê]ncia)\b/i,
          /\b(payment.*gateway|gateway.*pagamento)\b/i,
        ],
        priority: 'critical',
        routing: {
          team: 'payments-team',
          escalation: 'payments-architects',
          sla: 10,
        },
      },

      atmNetwork: {
        id: 'atm-network',
        name: 'ATM Network',
        description: 'Rede de caixas eletrônicos',
        level: 1,
        parent: null,
        children: ['atm-hardware', 'iso8583', 'atm-software', 'network'],
        keywords: ['atm', 'caixa', 'eletronico', 'iso8583', 'hardware', 'rede'],
        patterns: [
          /\b(atm|caixa.*eletr[oô]nico)\b/i,
          /\b(iso.*8583|hardware)\b/i,
          /\b(rede.*atm|network)\b/i,
        ],
        priority: 'high',
        routing: {
          team: 'atm-support',
          escalation: 'infrastructure-team',
          sla: 20,
        },
      },

      dataPlatforms: {
        id: 'data-platforms',
        name: 'Data Platforms',
        description: 'Plataformas de dados, BI e analytics',
        level: 1,
        parent: null,
        children: ['data-lake', 'bi', 'analytics', 'etl', 'big-data'],
        keywords: ['dados', 'data-lake', 'bi', 'analytics', 'etl', 'big-data'],
        patterns: [
          /\b(data.*lake|big.*data)\b/i,
          /\b(bi|analytics|etl)\b/i,
          /\b(dados|relat[oó]rio)\b/i,
        ],
        priority: 'medium',
        routing: {
          team: 'data-team',
          escalation: 'data-architects',
          sla: 60,
        },
      },

      infrastructure: {
        id: 'infrastructure',
        name: 'Infrastructure',
        description: 'Infraestrutura de TI, redes e cloud',
        level: 1,
        parent: null,
        children: ['network', 'servers', 'cloud', 'security', 'monitoring'],
        keywords: ['infraestrutura', 'rede', 'servidor', 'cloud', 'seguranca', 'monitoramento'],
        patterns: [
          /\b(infraestrutura|rede|servidor)\b/i,
          /\b(cloud|aws|azure|gcp)\b/i,
          /\b(seguran[cç]a|monitoramento)\b/i,
        ],
        priority: 'high',
        routing: {
          team: 'infrastructure-team',
          escalation: 'infrastructure-architects',
          sla: 30,
        },
      },
    };
  }

  /**
   * Constrói mapa hierárquico das taxonomias
   */
  buildHierarchyMap() {
    const hierarchyMap = new Map();

    for (const [id, taxonomy] of Object.entries(this.taxonomies)) {
      if (!hierarchyMap.has(taxonomy.level)) {
        hierarchyMap.set(taxonomy.level, []);
      }
      hierarchyMap.get(taxonomy.level).push(taxonomy);

      // Mapear relacionamentos pai-filho
      if (taxonomy.parent) {
        const parent = this.taxonomies[taxonomy.parent];
        if (parent && !parent.children.includes(id)) {
          parent.children.push(id);
        }
      }
    }

    return hierarchyMap;
  }

  /**
   * Constrói mapa de palavras-chave para busca rápida
   */
  buildKeywordMap() {
    const keywordMap = new Map();

    for (const [id, taxonomy] of Object.entries(this.taxonomies)) {
      // Mapear keywords
      taxonomy.keywords.forEach(keyword => {
        if (!keywordMap.has(keyword.toLowerCase())) {
          keywordMap.set(keyword.toLowerCase(), []);
        }
        keywordMap.get(keyword.toLowerCase()).push({
          taxonomyId: id,
          taxonomy: taxonomy,
          matchType: 'keyword',
        });
      });

      // Mapear patterns
      taxonomy.patterns.forEach((pattern, index) => {
        const patternKey = `pattern_${id}_${index}`;
        keywordMap.set(patternKey, [
          {
            taxonomyId: id,
            taxonomy: taxonomy,
            pattern: pattern,
            matchType: 'pattern',
          },
        ]);
      });
    }

    return keywordMap;
  }

  /**
   * Obtém taxonomia por ID
   */
  getTaxonomy(id) {
    return this.taxonomies[id] || null;
  }

  /**
   * Obtém todas as taxonomias de um nível específico
   */
  getTaxonomiesByLevel(level) {
    return this.hierarchyMap.get(level) || [];
  }

  /**
   * Obtém taxonomias filhas de uma taxonomia pai
   */
  getChildTaxonomies(parentId) {
    const parent = this.getTaxonomy(parentId);
    if (!parent) return [];

    return parent.children.map(childId => this.getTaxonomy(childId)).filter(Boolean);
  }

  /**
   * Obtém caminho hierárquico completo de uma taxonomia
   */
  getTaxonomyPath(taxonomyId) {
    const path = [];
    let current = this.getTaxonomy(taxonomyId);

    while (current) {
      path.unshift(current);
      current = current.parent ? this.getTaxonomy(current.parent) : null;
    }

    return path;
  }

  /**
   * Busca taxonomias por palavra-chave
   */
  searchByKeyword(keyword) {
    const matches = [];
    const lowerKeyword = keyword.toLowerCase();

    // Busca exata
    if (this.keywordMap.has(lowerKeyword)) {
      matches.push(...this.keywordMap.get(lowerKeyword));
    }

    // Busca parcial
    for (const [key, value] of this.keywordMap.entries()) {
      if (key.includes(lowerKeyword) && !matches.some(m => m.taxonomyId === value[0].taxonomyId)) {
        matches.push(...value);
      }
    }

    return matches;
  }

  /**
   * Busca taxonomias usando patterns regex
   */
  searchByPattern(text) {
    const matches = [];

    for (const [id, taxonomy] of Object.entries(this.taxonomies)) {
      for (const pattern of taxonomy.patterns) {
        if (pattern.test(text)) {
          matches.push({
            taxonomyId: id,
            taxonomy: taxonomy,
            matchType: 'pattern',
            pattern: pattern,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Obtém informações de roteamento para uma taxonomia
   */
  getRoutingInfo(taxonomyId) {
    const taxonomy = this.getTaxonomy(taxonomyId);
    return taxonomy ? taxonomy.routing : null;
  }

  /**
   * Adiciona nova taxonomia
   */
  addTaxonomy(taxonomy) {
    if (!taxonomy.id || this.taxonomies[taxonomy.id]) {
      throw new Error('Taxonomy ID already exists or is invalid');
    }

    this.taxonomies[taxonomy.id] = {
      ...taxonomy,
      keywords: taxonomy.keywords || [],
      patterns: taxonomy.patterns || [],
      children: taxonomy.children || [],
    };

    // Rebuild maps
    this.hierarchyMap = this.buildHierarchyMap();
    this.keywordMap = this.buildKeywordMap();

    return true;
  }

  /**
   * Atualiza taxonomia existente
   */
  updateTaxonomy(taxonomyId, updates) {
    if (!this.taxonomies[taxonomyId]) {
      throw new Error('Taxonomy not found');
    }

    this.taxonomies[taxonomyId] = {
      ...this.taxonomies[taxonomyId],
      ...updates,
    };

    // Rebuild maps
    this.hierarchyMap = this.buildHierarchyMap();
    this.keywordMap = this.buildKeywordMap();

    return true;
  }

  /**
   * Remove taxonomia
   */
  removeTaxonomy(taxonomyId) {
    if (!this.taxonomies[taxonomyId]) {
      throw new Error('Taxonomy not found');
    }

    const taxonomy = this.taxonomies[taxonomyId];

    // Remove referências dos filhos
    taxonomy.children.forEach(childId => {
      if (this.taxonomies[childId]) {
        this.taxonomies[childId].parent = taxonomy.parent;
      }
    });

    // Remove referência do pai
    if (taxonomy.parent && this.taxonomies[taxonomy.parent]) {
      const parentChildren = this.taxonomies[taxonomy.parent].children;
      const index = parentChildren.indexOf(taxonomyId);
      if (index > -1) {
        parentChildren.splice(index, 1);
        parentChildren.push(...taxonomy.children);
      }
    }

    delete this.taxonomies[taxonomyId];

    // Rebuild maps
    this.hierarchyMap = this.buildHierarchyMap();
    this.keywordMap = this.buildKeywordMap();

    return true;
  }

  /**
   * Exporta taxonomias em formato JSON
   */
  exportTaxonomies() {
    return {
      taxonomies: this.taxonomies,
      metadata: {
        totalTaxonomies: Object.keys(this.taxonomies).length,
        levels: Array.from(this.hierarchyMap.keys()).sort(),
        exportDate: new Date().toISOString(),
      },
    };
  }

  /**
   * Importa taxonomias de formato JSON
   */
  importTaxonomies(data) {
    if (!data.taxonomies || typeof data.taxonomies !== 'object') {
      throw new Error('Invalid taxonomy data format');
    }

    this.taxonomies = data.taxonomies;
    this.hierarchyMap = this.buildHierarchyMap();
    this.keywordMap = this.buildKeywordMap();

    return true;
  }

  /**
   * Valida estrutura de taxonomia
   */
  validateTaxonomy(taxonomy) {
    const required = ['id', 'name', 'description', 'level'];
    const missing = required.filter(field => !taxonomy[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (typeof taxonomy.level !== 'number' || taxonomy.level < 1) {
      throw new Error('Level must be a positive number');
    }

    if (taxonomy.parent && !this.taxonomies[taxonomy.parent]) {
      throw new Error('Parent taxonomy does not exist');
    }

    return true;
  }

  /**
   * Obtém estatísticas das taxonomias
   */
  getStatistics() {
    const stats = {
      total: Object.keys(this.taxonomies).length,
      byLevel: {},
      byPriority: {},
      totalKeywords: 0,
      totalPatterns: 0,
    };

    for (const taxonomy of Object.values(this.taxonomies)) {
      // Por nível
      if (!stats.byLevel[taxonomy.level]) {
        stats.byLevel[taxonomy.level] = 0;
      }
      stats.byLevel[taxonomy.level]++;

      // Por prioridade
      if (!stats.byPriority[taxonomy.priority]) {
        stats.byPriority[taxonomy.priority] = 0;
      }
      stats.byPriority[taxonomy.priority]++;

      // Contadores
      stats.totalKeywords += taxonomy.keywords ? taxonomy.keywords.length : 0;
      stats.totalPatterns += taxonomy.patterns ? taxonomy.patterns.length : 0;
    }

    return stats;
  }
}

module.exports = TaxonomyManager;
