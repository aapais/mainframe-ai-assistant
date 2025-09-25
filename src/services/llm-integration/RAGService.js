/**
 * RAG Service - Retrieval Augmented Generation
 * Sistema para busca e recuperação de informações da knowledge base
 * com suporte a embeddings vetoriais e ranking multi-critério
 */

const { ChromaClient } = require('chromadb');
const { OpenAI } = require('openai');
const logger = require('../../core/logging/Logger');
const { validateQuery, sanitizeContent } = require('./utils/InputValidator');
const { RAGError, EmbeddingError } = require('./utils/LLMErrors');

class RAGService {
  constructor(config = {}) {
    this.config = {
      vectorDB: {
        host: config.vectorDB?.host || 'localhost',
        port: config.vectorDB?.port || 8000,
        collectionName: config.vectorDB?.collectionName || 'banking_knowledge',
        persistentClient: config.vectorDB?.persistentClient || true,
      },
      embeddings: {
        provider: config.embeddings?.provider || 'openai',
        model: config.embeddings?.model || 'text-embedding-3-small',
        dimensions: config.embeddings?.dimensions || 1536,
        batchSize: config.embeddings?.batchSize || 100,
      },
      retrieval: {
        defaultLimit: config.retrieval?.defaultLimit || 10,
        similarityThreshold: config.retrieval?.similarityThreshold || 0.7,
        maxContextLength: config.retrieval?.maxContextLength || 4000,
        rerankingEnabled: config.retrieval?.rerankingEnabled || true,
      },
      cache: {
        enabled: config.cache?.enabled || true,
        ttl: config.cache?.ttl || 3600, // 1 hora
        maxSize: config.cache?.maxSize || 1000,
      },
    };

    this.initializeVectorDB();
    this.initializeEmbeddingProvider();
    this.initializeCache();
  }

  /**
   * Inicializa conexão com vector database (ChromaDB)
   */
  async initializeVectorDB() {
    try {
      this.chromaClient = new ChromaClient({
        path: `http://${this.config.vectorDB.host}:${this.config.vectorDB.port}`,
      });

      // Verifica se a collection existe, senão cria
      await this.ensureCollection();

      logger.info('Vector database inicializado', {
        host: this.config.vectorDB.host,
        port: this.config.vectorDB.port,
        collection: this.config.vectorDB.collectionName,
      });
    } catch (error) {
      logger.error('Erro ao inicializar vector database', { error: error.message });
      throw new RAGError(`Falha na inicialização do vector DB: ${error.message}`);
    }
  }

  /**
   * Garante que a collection existe no ChromaDB
   */
  async ensureCollection() {
    try {
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: this.config.vectorDB.collectionName,
        metadata: {
          description: 'Banking incidents knowledge base',
          version: '1.0.0',
          created_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Erro ao criar/acessar collection', { error: error.message });
      throw error;
    }
  }

  /**
   * Inicializa provedor de embeddings
   */
  initializeEmbeddingProvider() {
    try {
      switch (this.config.embeddings.provider) {
        case 'openai':
          this.embeddingClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });
          break;
        default:
          throw new Error(`Embedding provider não suportado: ${this.config.embeddings.provider}`);
      }

      logger.info('Embedding provider inicializado', {
        provider: this.config.embeddings.provider,
        model: this.config.embeddings.model,
      });
    } catch (error) {
      logger.error('Erro ao inicializar embedding provider', { error: error.message });
      throw new RAGError(`Falha na inicialização de embeddings: ${error.message}`);
    }
  }

  /**
   * Inicializa cache em memória
   */
  initializeCache() {
    if (this.config.cache.enabled) {
      this.cache = new Map();
      this.cacheStats = {
        hits: 0,
        misses: 0,
        size: 0,
      };
    }
  }

  /**
   * Query principal do RAG - busca documentos relevantes
   * @param {string|Object} query - Query de busca (string ou objeto com filtros)
   * @param {Object} options - Opções de busca
   * @returns {Promise<Array>} Documentos rankeados por relevância
   */
  async query(query, options = {}) {
    try {
      const startTime = Date.now();

      // Validação e sanitização da query
      const validatedQuery = validateQuery(query);
      const sanitizedQuery = sanitizeContent(validatedQuery);

      // Configurações de busca
      const searchConfig = {
        limit: options.limit || this.config.retrieval.defaultLimit,
        threshold: options.threshold || this.config.retrieval.similarityThreshold,
        filters: options.filters || {},
        includeMetadata: options.includeMetadata !== false,
        rerank: options.rerank !== false && this.config.retrieval.rerankingEnabled,
      };

      logger.info('Iniciando query RAG', {
        query:
          typeof sanitizedQuery === 'string' ? sanitizedQuery.substring(0, 100) : 'complex_query',
        config: searchConfig,
      });

      // Verifica cache se habilitado
      const cacheKey = this.generateCacheKey(sanitizedQuery, searchConfig);
      if (this.config.cache.enabled) {
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          this.cacheStats.hits++;
          logger.debug('Cache hit para query RAG', { cacheKey });
          return cachedResult;
        }
        this.cacheStats.misses++;
      }

      // 1. Geração de embeddings para a query
      const queryEmbedding = await this.generateEmbedding(sanitizedQuery);

      // 2. Busca vetorial no ChromaDB
      const vectorResults = await this.vectorSearch(queryEmbedding, searchConfig);

      // 3. Filtragem por threshold
      const filteredResults = this.filterByThreshold(vectorResults, searchConfig.threshold);

      // 4. Re-ranking multi-critério se habilitado
      const rankedResults = searchConfig.rerank
        ? await this.rerankResults(filteredResults, sanitizedQuery, searchConfig)
        : filteredResults;

      // 5. Otimização do context window
      const optimizedResults = this.optimizeContextWindow(rankedResults, searchConfig);

      // 6. Enriquecimento de metadados
      const enrichedResults = await this.enrichResults(optimizedResults);

      const processingTime = Date.now() - startTime;

      logger.info('Query RAG concluída', {
        resultsCount: enrichedResults.length,
        processingTime,
        cacheStats: this.cacheStats,
      });

      // Cache do resultado
      if (this.config.cache.enabled) {
        this.setCache(cacheKey, enrichedResults);
      }

      return enrichedResults;
    } catch (error) {
      logger.error('Erro na query RAG', {
        query: typeof query === 'string' ? query.substring(0, 100) : 'complex_query',
        error: error.message,
        stack: error.stack,
      });

      throw new RAGError(`Falha na query RAG: ${error.message}`);
    }
  }

  /**
   * Gera embedding para texto usando o provedor configurado
   */
  async generateEmbedding(text) {
    try {
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new EmbeddingError('Texto inválido para embedding');
      }

      // Trunca texto se muito longo para o modelo
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) + '...' : text;

      let embedding;

      switch (this.config.embeddings.provider) {
        case 'openai':
          const response = await this.embeddingClient.embeddings.create({
            model: this.config.embeddings.model,
            input: truncatedText,
            encoding_format: 'float',
          });
          embedding = response.data[0].embedding;
          break;

        default:
          throw new EmbeddingError(
            `Provider de embedding não suportado: ${this.config.embeddings.provider}`
          );
      }

      if (!embedding || !Array.isArray(embedding)) {
        throw new EmbeddingError('Embedding inválido retornado pelo provider');
      }

      return embedding;
    } catch (error) {
      logger.error('Erro ao gerar embedding', {
        provider: this.config.embeddings.provider,
        textLength: text.length,
        error: error.message,
      });

      throw new EmbeddingError(`Falha na geração de embedding: ${error.message}`);
    }
  }

  /**
   * Realiza busca vetorial no ChromaDB
   */
  async vectorSearch(queryEmbedding, config) {
    try {
      const searchParams = {
        queryEmbeddings: [queryEmbedding],
        nResults: Math.min(config.limit * 2, 50), // Busca mais para reranking
        include: ['documents', 'metadatas', 'distances'],
      };

      // Adiciona filtros se especificados
      if (config.filters && Object.keys(config.filters).length > 0) {
        searchParams.where = config.filters;
      }

      const results = await this.collection.query(searchParams);

      // Transforma resultados em formato padronizado
      return this.transformVectorResults(results);
    } catch (error) {
      logger.error('Erro na busca vetorial', {
        error: error.message,
        config: config,
      });
      throw new RAGError(`Falha na busca vetorial: ${error.message}`);
    }
  }

  /**
   * Transforma resultados do ChromaDB em formato padronizado
   */
  transformVectorResults(chromaResults) {
    const results = [];

    if (chromaResults.documents && chromaResults.documents[0]) {
      const documents = chromaResults.documents[0];
      const metadatas = chromaResults.metadatas[0] || [];
      const distances = chromaResults.distances[0] || [];

      for (let i = 0; i < documents.length; i++) {
        results.push({
          id: metadatas[i]?.id || `doc_${i}`,
          content: documents[i],
          metadata: metadatas[i] || {},
          score: this.distanceToSimilarity(distances[i] || 1.0),
          distance: distances[i] || 1.0,
          source: 'vector_search',
        });
      }
    }

    return results;
  }

  /**
   * Converte distância em score de similaridade (0-1)
   */
  distanceToSimilarity(distance) {
    // Para distância euclidiana/cosine, quanto menor melhor
    // Converte para similaridade onde 1 = mais similar
    return Math.max(0, 1 - distance);
  }

  /**
   * Filtra resultados por threshold de similaridade
   */
  filterByThreshold(results, threshold) {
    return results.filter(result => result.score >= threshold);
  }

  /**
   * Re-ranking multi-critério dos resultados
   */
  async rerankResults(results, originalQuery, config) {
    try {
      if (results.length <= 1) {
        return results;
      }

      // Critérios de ranking
      const rankedResults = results.map(result => {
        const scores = {
          vectorSimilarity: result.score,
          contentRelevance: this.calculateContentRelevance(result.content, originalQuery),
          recency: this.calculateRecencyScore(result.metadata.timestamp),
          authorityScore: this.calculateAuthorityScore(result.metadata),
          lengthScore: this.calculateLengthScore(result.content),
        };

        // Peso combinado (pode ser configurável)
        const weights = {
          vectorSimilarity: 0.4,
          contentRelevance: 0.3,
          recency: 0.15,
          authorityScore: 0.1,
          lengthScore: 0.05,
        };

        const finalScore = Object.keys(scores).reduce(
          (total, criterion) => total + scores[criterion] * weights[criterion],
          0
        );

        return {
          ...result,
          rerankingScores: scores,
          finalScore,
          originalScore: result.score,
        };
      });

      // Ordena por score final
      rankedResults.sort((a, b) => b.finalScore - a.finalScore);

      logger.debug('Re-ranking concluído', {
        originalCount: results.length,
        rankedCount: rankedResults.length,
        topScore: rankedResults[0]?.finalScore,
      });

      return rankedResults;
    } catch (error) {
      logger.warn('Erro no re-ranking, usando ordem original', { error: error.message });
      return results;
    }
  }

  /**
   * Calcula relevância de conteúdo baseada em overlap de termos
   */
  calculateContentRelevance(content, query) {
    try {
      const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 2);
      const contentTerms = content.toLowerCase().split(/\s+/);

      const matches = queryTerms.filter(term =>
        contentTerms.some(contentTerm => contentTerm.includes(term))
      );

      return queryTerms.length > 0 ? matches.length / queryTerms.length : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calcula score de recência (documentos mais recentes têm score maior)
   */
  calculateRecencyScore(timestamp) {
    if (!timestamp) return 0.5; // Score neutro para documentos sem timestamp

    try {
      const docDate = new Date(timestamp);
      const now = new Date();
      const daysDiff = (now - docDate) / (1000 * 60 * 60 * 24);

      // Score decresce exponencialmente com a idade
      return Math.exp(-daysDiff / 365); // 1 ano = score ~0.37
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calcula score de autoridade baseado na fonte
   */
  calculateAuthorityScore(metadata) {
    const authorityMap = {
      official_documentation: 1.0,
      incident_report: 0.9,
      kb_article: 0.8,
      forum_post: 0.6,
      user_guide: 0.7,
      technical_spec: 0.9,
    };

    const sourceType = metadata.source_type || metadata.category || 'unknown';
    return authorityMap[sourceType] || 0.5;
  }

  /**
   * Calcula score baseado no comprimento do conteúdo
   */
  calculateLengthScore(content) {
    const length = content.length;

    // Prefere conteúdo nem muito curto nem muito longo
    if (length < 100) return 0.3; // Muito curto
    if (length > 2000) return 0.7; // Muito longo
    return 1.0; // Tamanho ideal
  }

  /**
   * Otimiza resultados para caber no context window
   */
  optimizeContextWindow(results, config) {
    const maxLength = config.maxContextLength || this.config.retrieval.maxContextLength;
    let currentLength = 0;
    const optimizedResults = [];

    for (const result of results) {
      const contentLength = result.content.length;

      if (currentLength + contentLength <= maxLength) {
        optimizedResults.push(result);
        currentLength += contentLength;
      } else {
        // Se o documento é muito longo, trunca
        const remainingSpace = maxLength - currentLength;
        if (remainingSpace > 200) {
          // Mínimo útil
          optimizedResults.push({
            ...result,
            content: result.content.substring(0, remainingSpace - 3) + '...',
            truncated: true,
          });
        }
        break;
      }
    }

    logger.debug('Context window otimizado', {
      originalCount: results.length,
      optimizedCount: optimizedResults.length,
      totalLength: currentLength,
      maxLength,
    });

    return optimizedResults;
  }

  /**
   * Enriquece resultados com metadados adicionais
   */
  async enrichResults(results) {
    return results.map(result => ({
      ...result,
      title: this.extractTitle(result.content, result.metadata),
      category: this.categorizeContent(result.content, result.metadata),
      confidence: this.calculateConfidence(result),
      contextRelevance: result.finalScore || result.score,
      enrichedAt: new Date().toISOString(),
    }));
  }

  /**
   * Extrai título do conteúdo ou metadados
   */
  extractTitle(content, metadata) {
    if (metadata.title) return metadata.title;

    // Extrai primeira linha como título
    const firstLine = content.split('\n')[0].trim();
    return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
  }

  /**
   * Categoriza conteúdo automaticamente
   */
  categorizeContent(content, metadata) {
    if (metadata.category) return metadata.category;

    const contentLower = content.toLowerCase();

    // Categorias baseadas em palavras-chave
    const categories = {
      security: ['security', 'authentication', 'authorization', 'ssl', 'certificate'],
      database: ['database', 'sql', 'query', 'table', 'index'],
      network: ['network', 'connection', 'timeout', 'firewall', 'vpn'],
      performance: ['performance', 'slow', 'timeout', 'latency', 'optimization'],
      integration: ['api', 'service', 'integration', 'webhook', 'endpoint'],
      application: ['application', 'code', 'bug', 'feature', 'deployment'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Calcula confiança no resultado
   */
  calculateConfidence(result) {
    let confidence = result.score;

    // Ajusta baseado em fatores adicionais
    if (result.metadata.verified) confidence += 0.1;
    if (result.metadata.source_type === 'official_documentation') confidence += 0.1;
    if (result.truncated) confidence -= 0.05;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Adiciona documento à knowledge base
   */
  async addDocument(document) {
    try {
      validateDocument(document);

      const embedding = await this.generateEmbedding(document.content);

      await this.collection.add({
        ids: [document.id],
        embeddings: [embedding],
        documents: [document.content],
        metadatas: [document.metadata || {}],
      });

      logger.info('Documento adicionado à knowledge base', {
        id: document.id,
        contentLength: document.content.length,
      });

      // Limpa cache relacionado
      this.clearRelatedCache(document);
    } catch (error) {
      logger.error('Erro ao adicionar documento', {
        documentId: document.id,
        error: error.message,
      });
      throw new RAGError(`Falha ao adicionar documento: ${error.message}`);
    }
  }

  /**
   * Remove documento da knowledge base
   */
  async removeDocument(documentId) {
    try {
      await this.collection.delete({
        ids: [documentId],
      });

      logger.info('Documento removido da knowledge base', { id: documentId });
    } catch (error) {
      logger.error('Erro ao remover documento', {
        documentId,
        error: error.message,
      });
      throw new RAGError(`Falha ao remover documento: ${error.message}`);
    }
  }

  /**
   * Atualiza documento existente
   */
  async updateDocument(documentId, newContent, newMetadata = {}) {
    try {
      const embedding = await this.generateEmbedding(newContent);

      await this.collection.update({
        ids: [documentId],
        embeddings: [embedding],
        documents: [newContent],
        metadatas: [newMetadata],
      });

      logger.info('Documento atualizado na knowledge base', {
        id: documentId,
        contentLength: newContent.length,
      });
    } catch (error) {
      logger.error('Erro ao atualizar documento', {
        documentId,
        error: error.message,
      });
      throw new RAGError(`Falha ao atualizar documento: ${error.message}`);
    }
  }

  /**
   * Gerenciamento de cache
   */
  generateCacheKey(query, config) {
    const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
    const configStr = JSON.stringify(config);
    return `${Buffer.from(queryStr + configStr)
      .toString('base64')
      .substring(0, 32)}`;
  }

  getFromCache(key) {
    if (!this.config.cache.enabled) return null;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cache.ttl * 1000) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(key); // Remove cache expirado
    }

    return null;
  }

  setCache(key, data) {
    if (!this.config.cache.enabled) return;

    // Remove itens mais antigos se cache está cheio
    if (this.cache.size >= this.config.cache.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    this.cacheStats.size = this.cache.size;
  }

  clearRelatedCache(document) {
    // Implementação básica - limpa todo cache quando documento é modificado
    if (this.config.cache.enabled) {
      this.cache.clear();
      this.cacheStats.size = 0;
    }
  }

  /**
   * Estatísticas do serviço
   */
  getStats() {
    return {
      cache: this.cacheStats,
      config: {
        vectorDB: this.config.vectorDB.collectionName,
        embeddings: {
          provider: this.config.embeddings.provider,
          model: this.config.embeddings.model,
        },
        retrieval: this.config.retrieval,
      },
    };
  }

  /**
   * Health check do serviço
   */
  async healthCheck() {
    try {
      // Verifica conectividade com vector DB
      await this.collection.count();

      // Testa geração de embedding
      await this.generateEmbedding('test query');

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          vectorDB: 'connected',
          embeddingProvider: 'connected',
          cache: this.config.cache.enabled ? 'enabled' : 'disabled',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Valida documento antes de adicionar à knowledge base
 */
function validateDocument(document) {
  if (!document.id) {
    throw new RAGError('Document ID é obrigatório');
  }

  if (!document.content || typeof document.content !== 'string') {
    throw new RAGError('Document content deve ser uma string não vazia');
  }

  if (document.content.length < 10) {
    throw new RAGError('Document content muito curto (mínimo 10 caracteres)');
  }

  if (document.content.length > 50000) {
    throw new RAGError('Document content muito longo (máximo 50000 caracteres)');
  }
}

module.exports = RAGService;
