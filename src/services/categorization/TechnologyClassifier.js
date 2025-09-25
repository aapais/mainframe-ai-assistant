/**
 * TechnologyClassifier - Classificador Inteligente de Tecnologias Bancárias
 *
 * Sistema de classificação automática de incidentes usando NLP, machine learning,
 * keywords matching e patterns recognition com confidence scoring.
 */

const TaxonomyManager = require('./TaxonomyManager');

class TechnologyClassifier {
  constructor(options = {}) {
    this.taxonomyManager = new TaxonomyManager();
    this.config = {
      minConfidence: options.minConfidence || 0.6,
      maxResults: options.maxResults || 5,
      enableMLFallback: options.enableMLFallback !== false,
      weightKeyword: options.weightKeyword || 0.3,
      weightPattern: options.weightPattern || 0.4,
      weightNLP: options.weightNLP || 0.3,
      ...options,
    };

    // Cache para otimização
    this.classificationCache = new Map();
    this.modelCache = new Map();

    // Métricas de performance
    this.metrics = {
      totalClassifications: 0,
      successfulClassifications: 0,
      averageConfidence: 0,
      processingTimes: [],
    };

    this.initializeNLPModels();
  }

  /**
   * Inicializa modelos de NLP e patterns de machine learning
   */
  initializeNLPModels() {
    // Dicionário de termos técnicos bancários com pesos
    this.technicalTerms = {
      // Mainframe
      mainframe: { weight: 0.9, categories: ['mainframe'] },
      cobol: { weight: 0.95, categories: ['mainframe', 'cobol'] },
      cics: { weight: 0.95, categories: ['mainframe', 'cics'] },
      db2: { weight: 0.9, categories: ['mainframe', 'db2'] },
      jcl: { weight: 0.85, categories: ['mainframe', 'jcl'] },
      abend: { weight: 0.9, categories: ['mainframe'] },
      batch: { weight: 0.7, categories: ['mainframe', 'core-banking'] },

      // Core Banking
      conta: { weight: 0.8, categories: ['core-banking'] },
      transacao: { weight: 0.8, categories: ['core-banking', 'payment-systems'] },
      saldo: { weight: 0.7, categories: ['core-banking'] },
      cliente: { weight: 0.6, categories: ['core-banking'] },

      // Mobile
      app: { weight: 0.8, categories: ['mobile-banking'] },
      mobile: { weight: 0.9, categories: ['mobile-banking'] },
      ios: { weight: 0.9, categories: ['mobile-banking'] },
      android: { weight: 0.9, categories: ['mobile-banking'] },
      'react-native': { weight: 0.95, categories: ['mobile-banking'] },

      // Payments
      pix: { weight: 0.95, categories: ['payment-systems'] },
      ted: { weight: 0.9, categories: ['payment-systems'] },
      doc: { weight: 0.9, categories: ['payment-systems'] },
      cartao: { weight: 0.8, categories: ['payment-systems'] },
      pagamento: { weight: 0.8, categories: ['payment-systems'] },

      // ATM
      atm: { weight: 0.95, categories: ['atm-network'] },
      'caixa eletronico': { weight: 0.95, categories: ['atm-network'] },
      iso8583: { weight: 0.9, categories: ['atm-network'] },

      // Infrastructure
      rede: { weight: 0.6, categories: ['infrastructure'] },
      servidor: { weight: 0.7, categories: ['infrastructure'] },
      cloud: { weight: 0.8, categories: ['infrastructure'] },
      aws: { weight: 0.8, categories: ['infrastructure'] },
      azure: { weight: 0.8, categories: ['infrastructure'] },
    };

    // Patterns contextuais
    this.contextualPatterns = [
      {
        pattern: /erro.*s0c[0-9]/i,
        categories: ['mainframe'],
        confidence: 0.9,
        description: 'Erro de sistema mainframe',
      },
      {
        pattern: /falha.*compilacao.*cobol/i,
        categories: ['mainframe', 'cobol'],
        confidence: 0.95,
        description: 'Erro de compilação COBOL',
      },
      {
        pattern: /(app|aplicativo).*nao.*(abre|funciona)/i,
        categories: ['mobile-banking'],
        confidence: 0.8,
        description: 'Problema em aplicativo móvel',
      },
      {
        pattern: /pix.*nao.*processou/i,
        categories: ['payment-systems'],
        confidence: 0.9,
        description: 'Falha no processamento PIX',
      },
      {
        pattern: /api.*timeout.*gateway/i,
        categories: ['internet-banking'],
        confidence: 0.85,
        description: 'Timeout em API Gateway',
      },
    ];

    // Modelos de classificação por área
    this.classificationModels = {
      mainframe: {
        indicators: ['mainframe', 'z/os', 'cobol', 'cics', 'db2', 'jcl', 'batch', 'abend'],
        exclusions: ['mobile', 'web', 'api'],
        contextWeight: 0.8,
      },
      'mobile-banking': {
        indicators: ['mobile', 'app', 'ios', 'android', 'smartphone'],
        exclusions: ['mainframe', 'batch', 'cobol'],
        contextWeight: 0.7,
      },
      'payment-systems': {
        indicators: ['pix', 'ted', 'pagamento', 'transferencia', 'cartao'],
        exclusions: [],
        contextWeight: 0.9,
      },
    };
  }

  /**
   * Classifica um incidente baseado na descrição
   */
  async classifyIncident(incidentData) {
    const startTime = Date.now();

    try {
      // Verificar cache
      const cacheKey = this.generateCacheKey(incidentData);
      if (this.classificationCache.has(cacheKey)) {
        return this.classificationCache.get(cacheKey);
      }

      // Preparar texto para análise
      const text = this.prepareText(incidentData);

      // Executar classificações em paralelo
      const [keywordResults, patternResults, nlpResults, contextualResults] = await Promise.all([
        this.classifyByKeywords(text),
        this.classifyByPatterns(text),
        this.classifyByNLP(text),
        this.classifyByContext(incidentData),
      ]);

      // Combinar resultados com pesos
      const combinedResults = this.combineClassificationResults({
        keywords: keywordResults,
        patterns: patternResults,
        nlp: nlpResults,
        contextual: contextualResults,
      });

      // Aplicar filtros e validações
      const finalResults = this.filterAndRankResults(combinedResults);

      // Gerar resultado final
      const classification = {
        incident: {
          id: incidentData.id,
          title: incidentData.title,
          description: incidentData.description,
        },
        classifications: finalResults,
        primaryCategory: finalResults[0] || null,
        confidence: finalResults[0]?.confidence || 0,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        metadata: {
          method: 'hybrid',
          version: '1.0.0',
          cacheHit: false,
        },
      };

      // Adicionar ao cache
      this.classificationCache.set(cacheKey, classification);

      // Atualizar métricas
      this.updateMetrics(classification);

      return classification;
    } catch (error) {
      console.error('Error in incident classification:', error);
      return this.generateErrorResponse(incidentData, error);
    }
  }

  /**
   * Prepara texto para análise (normalização, limpeza)
   */
  prepareText(incidentData) {
    const texts = [];

    if (incidentData.title) texts.push(incidentData.title);
    if (incidentData.description) texts.push(incidentData.description);
    if (incidentData.comments) {
      texts.push(...incidentData.comments.map(c => c.text || ''));
    }

    let text = texts.join(' ').toLowerCase();

    // Normalização de caracteres
    text = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ') // Remove pontuação
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();

    return text;
  }

  /**
   * Classificação por palavras-chave
   */
  async classifyByKeywords(text) {
    const results = [];
    const words = text.split(/\s+/);
    const wordCount = words.length;

    for (const [term, config] of Object.entries(this.technicalTerms)) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = text.match(regex);

      if (matches) {
        const frequency = matches.length / wordCount;
        const confidence = Math.min(config.weight * (1 + frequency), 1);

        config.categories.forEach(category => {
          const existingResult = results.find(r => r.category === category);
          if (existingResult) {
            existingResult.confidence = Math.max(existingResult.confidence, confidence);
            existingResult.matches.push(...matches);
          } else {
            results.push({
              category,
              confidence,
              matches: [...matches],
              method: 'keyword',
              details: {
                term,
                frequency,
                weight: config.weight,
              },
            });
          }
        });
      }
    }

    return results;
  }

  /**
   * Classificação por patterns regex
   */
  async classifyByPatterns(text) {
    const results = [];

    for (const patternConfig of this.contextualPatterns) {
      const matches = text.match(patternConfig.pattern);

      if (matches) {
        patternConfig.categories.forEach(category => {
          results.push({
            category,
            confidence: patternConfig.confidence,
            matches: matches,
            method: 'pattern',
            details: {
              pattern: patternConfig.pattern.toString(),
              description: patternConfig.description,
            },
          });
        });
      }
    }

    return results;
  }

  /**
   * Classificação por NLP (análise semântica)
   */
  async classifyByNLP(text) {
    const results = [];

    // Análise de co-ocorrência de termos
    const words = text.split(/\s+/);
    const cooccurrenceMatrix = this.buildCooccurrenceMatrix(words);

    // Análise de similaridade semântica
    for (const [categoryId, model] of Object.entries(this.classificationModels)) {
      const score = this.calculateSemanticSimilarity(text, model, cooccurrenceMatrix);

      if (score > 0.3) {
        results.push({
          category: categoryId,
          confidence: score,
          matches: model.indicators.filter(indicator => text.includes(indicator)),
          method: 'nlp',
          details: {
            semanticScore: score,
            indicators: model.indicators,
            contextWeight: model.contextWeight,
          },
        });
      }
    }

    return results;
  }

  /**
   * Classificação por contexto do incidente
   */
  async classifyByContext(incidentData) {
    const results = [];

    // Análise de campos estruturados
    if (incidentData.source) {
      const sourceMapping = {
        'mobile-app': ['mobile-banking'],
        'web-portal': ['internet-banking'],
        atm: ['atm-network'],
        mainframe: ['mainframe'],
        'payment-gateway': ['payment-systems'],
      };

      if (sourceMapping[incidentData.source]) {
        sourceMapping[incidentData.source].forEach(category => {
          results.push({
            category,
            confidence: 0.8,
            matches: [incidentData.source],
            method: 'context',
            details: {
              field: 'source',
              value: incidentData.source,
            },
          });
        });
      }
    }

    // Análise de horário (patterns de uso)
    if (incidentData.timestamp) {
      const hour = new Date(incidentData.timestamp).getHours();

      // ATMs têm mais problemas fora do horário bancário
      if (hour < 6 || hour > 22) {
        results.push({
          category: 'atm-network',
          confidence: 0.3,
          matches: ['off-hours'],
          method: 'context',
          details: {
            field: 'timestamp',
            hour,
            reasoning: 'ATM issues more common outside banking hours',
          },
        });
      }
    }

    return results;
  }

  /**
   * Constrói matriz de co-ocorrência de palavras
   */
  buildCooccurrenceMatrix(words) {
    const matrix = new Map();
    const windowSize = 3;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!matrix.has(word)) {
        matrix.set(word, new Map());
      }

      // Janela de contexto
      for (
        let j = Math.max(0, i - windowSize);
        j < Math.min(words.length, i + windowSize + 1);
        j++
      ) {
        if (i !== j) {
          const contextWord = words[j];
          const wordMap = matrix.get(word);
          wordMap.set(contextWord, (wordMap.get(contextWord) || 0) + 1);
        }
      }
    }

    return matrix;
  }

  /**
   * Calcula similaridade semântica
   */
  calculateSemanticSimilarity(text, model, cooccurrenceMatrix) {
    let score = 0;
    let indicatorCount = 0;

    // Pontuação por indicadores presentes
    for (const indicator of model.indicators) {
      if (text.includes(indicator)) {
        score += 0.3;
        indicatorCount++;

        // Bonus por co-ocorrência
        if (cooccurrenceMatrix.has(indicator)) {
          const cooccurrences = cooccurrenceMatrix.get(indicator);
          for (const otherIndicator of model.indicators) {
            if (cooccurrences.has(otherIndicator)) {
              score += 0.1;
            }
          }
        }
      }
    }

    // Penalização por exclusões
    for (const exclusion of model.exclusions) {
      if (text.includes(exclusion)) {
        score -= 0.2;
      }
    }

    // Aplicar peso contextual
    score *= model.contextWeight;

    // Normalizar por número de indicadores
    if (indicatorCount > 0) {
      score *= Math.min(indicatorCount / model.indicators.length + 0.5, 1);
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Combina resultados de diferentes métodos de classificação
   */
  combineClassificationResults(results) {
    const categoryScores = new Map();

    // Processar cada método
    ['keywords', 'patterns', 'nlp', 'contextual'].forEach(method => {
      const methodResults = results[method] || [];
      const weight =
        this.config[`weight${method.charAt(0).toUpperCase() + method.slice(1)}`] || 0.25;

      methodResults.forEach(result => {
        const category = result.category;
        if (!categoryScores.has(category)) {
          categoryScores.set(category, {
            category,
            totalScore: 0,
            methods: {},
            allMatches: [],
            details: [],
          });
        }

        const categoryData = categoryScores.get(category);
        categoryData.totalScore += result.confidence * weight;
        categoryData.methods[method] = result.confidence;
        categoryData.allMatches.push(...(result.matches || []));
        categoryData.details.push({
          method,
          confidence: result.confidence,
          details: result.details,
        });
      });
    });

    // Converter para array e calcular confidence final
    return Array.from(categoryScores.values()).map(data => ({
      category: data.category,
      confidence: Math.min(data.totalScore, 1),
      taxonomy: this.taxonomyManager.getTaxonomy(data.category),
      methods: data.methods,
      matches: [...new Set(data.allMatches)],
      details: data.details,
    }));
  }

  /**
   * Filtra e ordena resultados finais
   */
  filterAndRankResults(results) {
    return results
      .filter(result => result.confidence >= this.config.minConfidence)
      .sort((a, b) => {
        // Primeiro por confidence
        if (Math.abs(a.confidence - b.confidence) > 0.05) {
          return b.confidence - a.confidence;
        }

        // Depois por prioridade da taxonomia
        const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityMap[a.taxonomy?.priority] || 0;
        const bPriority = priorityMap[b.taxonomy?.priority] || 0;

        return bPriority - aPriority;
      })
      .slice(0, this.config.maxResults);
  }

  /**
   * Gera chave de cache para classificação
   */
  generateCacheKey(incidentData) {
    const keyData = {
      title: incidentData.title || '',
      description: incidentData.description || '',
      source: incidentData.source || '',
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Atualiza métricas de performance
   */
  updateMetrics(classification) {
    this.metrics.totalClassifications++;

    if (classification.confidence > this.config.minConfidence) {
      this.metrics.successfulClassifications++;
    }

    this.metrics.processingTimes.push(classification.processingTime);

    // Calcular média de confidence
    const totalConfidence =
      this.metrics.averageConfidence * (this.metrics.totalClassifications - 1) +
      classification.confidence;
    this.metrics.averageConfidence = totalConfidence / this.metrics.totalClassifications;
  }

  /**
   * Gera resposta de erro
   */
  generateErrorResponse(incidentData, error) {
    return {
      incident: {
        id: incidentData.id,
        title: incidentData.title,
        description: incidentData.description,
      },
      classifications: [],
      primaryCategory: null,
      confidence: 0,
      error: {
        message: error.message,
        type: 'classification_error',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Obtém métricas de performance
   */
  getMetrics() {
    const avgProcessingTime =
      this.metrics.processingTimes.length > 0
        ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) /
          this.metrics.processingTimes.length
        : 0;

    return {
      ...this.metrics,
      averageProcessingTime: avgProcessingTime,
      successRate:
        this.metrics.totalClassifications > 0
          ? this.metrics.successfulClassifications / this.metrics.totalClassifications
          : 0,
      cacheSize: this.classificationCache.size,
    };
  }

  /**
   * Limpa cache de classificações
   */
  clearCache() {
    this.classificationCache.clear();
    return true;
  }

  /**
   * Treina classificador com feedback
   */
  async trainWithFeedback(incidentId, correctCategory, confidence = 1.0) {
    // Implementar sistema de aprendizado baseado em feedback
    // Esta é uma versão simplificada - em produção, usaria ML mais sofisticado

    const cacheKeys = Array.from(this.classificationCache.keys());
    for (const key of cacheKeys) {
      const classification = this.classificationCache.get(key);
      if (classification.incident.id === incidentId) {
        // Atualizar modelo baseado no feedback
        this.updateModelWeights(classification, correctCategory, confidence);
        break;
      }
    }

    return true;
  }

  /**
   * Atualiza pesos do modelo baseado em feedback
   */
  updateModelWeights(classification, correctCategory, confidence) {
    const text = this.prepareText(classification.incident);

    // Aumentar peso dos termos que levaram à classificação correta
    for (const [term, config] of Object.entries(this.technicalTerms)) {
      if (text.includes(term) && config.categories.includes(correctCategory)) {
        config.weight = Math.min(config.weight * 1.1, 1.0);
      }
    }
  }
}

module.exports = TechnologyClassifier;
