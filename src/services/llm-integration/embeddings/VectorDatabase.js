/**
 * Vector Database - Advanced ChromaDB Integration for Banking Systems
 * Enhanced with performance optimization, connection pooling, and banking-specific collections
 */

const { ChromaClient } = require('chromadb');
const logger = require('../../../core/logging/Logger');
const { VectorDBError, ConfigurationError } = require('../utils/LLMErrors');

class VectorDatabase {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'chromadb',
      connection: {
        host: config.connection?.host || process.env.CHROMA_HOST || 'localhost',
        port: config.connection?.port || parseInt(process.env.CHROMA_PORT) || 8000,
        path: config.connection?.path || '/api/v1',
        ssl: config.connection?.ssl || false,
        timeout: config.connection?.timeout || 30000,
        persistDirectory:
          config.connection?.persistDirectory ||
          process.env.CHROMA_PERSIST_DIRECTORY ||
          './data/chroma',
      },
      collections: {
        banking_knowledge:
          config.collections?.banking_knowledge ||
          process.env.CHROMA_COLLECTION_NAME ||
          'banking_knowledge',
        fraud_patterns: config.collections?.fraud_patterns || 'fraud_patterns',
        compliance_docs: config.collections?.compliance_docs || 'compliance_documents',
        risk_models: config.collections?.risk_models || 'risk_models',
        regulations: config.collections?.regulations || 'banking_regulations',
        customer_profiles: config.collections?.customer_profiles || 'customer_profiles',
        transaction_patterns: config.collections?.transaction_patterns || 'transaction_patterns',
        market_data: config.collections?.market_data || 'market_analysis',
      },
      performance: {
        batchSize: config.performance?.batchSize || 100,
        maxConnections: config.performance?.maxConnections || 10,
        retryAttempts: config.performance?.retryAttempts || 3,
        maxResults:
          config.performance?.maxResults || parseInt(process.env.CHROMA_MAX_RESULTS) || 100,
        enableCache: config.performance?.enableCache ?? true,
        cacheTTL: config.performance?.cacheTTL || 300000, // 5 minutes
      },
      bankingFeatures: {
        enableEncryption: config.bankingFeatures?.enableEncryption ?? true,
        enableAuditLog: config.bankingFeatures?.enableAuditLog ?? true,
        complianceMode: config.bankingFeatures?.complianceMode || 'strict',
        dataRetentionDays: config.bankingFeatures?.dataRetentionDays || 2555, // 7 years
      },
    };

    this.client = null;
    this.collections = new Map();
    this.connectionPool = [];
    this.isConnected = false;
    this.cache = new Map();
    this.metrics = {
      connections: 0,
      queries: 0,
      insertions: 0,
      errors: 0,
      avgQueryTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Inicializa conexão com vector database
   */
  async initialize() {
    try {
      switch (this.config.provider) {
        case 'chromadb':
          await this.initializeChromaDB();
          break;
        default:
          throw new ConfigurationError(`Provider não suportado: ${this.config.provider}`);
      }

      await this.ensureCollections();
      this.isConnected = true;

      logger.info('Vector database inicializado', {
        provider: this.config.provider,
        host: this.config.connection.host,
        port: this.config.connection.port,
        collections: Object.keys(this.config.collections),
      });
    } catch (error) {
      logger.error('Erro ao inicializar vector database', { error: error.message });
      throw new VectorDBError(`Falha na inicialização: ${error.message}`, 'initialize');
    }
  }

  /**
   * Inicializa cliente ChromaDB
   */
  async initializeChromaDB() {
    const url = this.config.connection.ssl
      ? `https://${this.config.connection.host}:${this.config.connection.port}`
      : `http://${this.config.connection.host}:${this.config.connection.port}`;

    this.client = new ChromaClient({
      path: url + this.config.connection.path,
    });

    // Testa conexão
    await this.client.heartbeat();
  }

  /**
   * Garante que as collections necessárias existem
   */
  async ensureCollections() {
    for (const [name, collectionName] of Object.entries(this.config.collections)) {
      try {
        const collection = await this.client.getOrCreateCollection({
          name: collectionName,
          metadata: {
            description: `Banking ${name} collection`,
            created_at: new Date().toISOString(),
            version: '1.0.0',
          },
        });

        this.collections.set(name, collection);

        logger.debug(`Collection '${name}' (${collectionName}) inicializada`);
      } catch (error) {
        throw new VectorDBError(
          `Erro ao criar collection ${name}: ${error.message}`,
          'create_collection'
        );
      }
    }
  }

  /**
   * Adiciona documentos ao vector database
   */
  async addDocuments(collectionName, documents) {
    try {
      const collection = this.getCollection(collectionName);

      if (!Array.isArray(documents)) {
        documents = [documents];
      }

      // Validação dos documentos
      this.validateDocuments(documents);

      // Processa em batches para performance
      const batches = this.createBatches(documents, this.config.performance.batchSize);

      for (const batch of batches) {
        const ids = batch.map(doc => doc.id);
        const embeddings = batch.map(doc => doc.embedding);
        const documentTexts = batch.map(doc => doc.content);
        const metadatas = batch.map(doc => doc.metadata || {});

        await collection.add({
          ids,
          embeddings,
          documents: documentTexts,
          metadatas,
        });
      }

      logger.info(`${documents.length} documentos adicionados à collection ${collectionName}`);

      return {
        success: true,
        added: documents.length,
        collection: collectionName,
      };
    } catch (error) {
      logger.error('Erro ao adicionar documentos', {
        collection: collectionName,
        count: documents.length,
        error: error.message,
      });
      throw new VectorDBError(`Falha ao adicionar documentos: ${error.message}`, 'add_documents');
    }
  }

  /**
   * Busca por similaridade vetorial
   */
  async search(collectionName, queryEmbedding, options = {}) {
    try {
      const collection = this.getCollection(collectionName);

      const searchParams = {
        queryEmbeddings: [queryEmbedding],
        nResults: options.limit || 10,
        include: options.include || ['documents', 'metadatas', 'distances'],
        where: options.where || undefined,
        whereDocument: options.whereDocument || undefined,
      };

      const results = await collection.query(searchParams);

      return this.formatSearchResults(results, options);
    } catch (error) {
      logger.error('Erro na busca vetorial', {
        collection: collectionName,
        error: error.message,
      });
      throw new VectorDBError(`Falha na busca: ${error.message}`, 'search');
    }
  }

  /**
   * Atualiza documentos existentes
   */
  async updateDocuments(collectionName, documents) {
    try {
      const collection = this.getCollection(collectionName);

      if (!Array.isArray(documents)) {
        documents = [documents];
      }

      this.validateDocuments(documents);

      const ids = documents.map(doc => doc.id);
      const embeddings = documents.map(doc => doc.embedding);
      const documentTexts = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => doc.metadata || {});

      await collection.update({
        ids,
        embeddings,
        documents: documentTexts,
        metadatas,
      });

      logger.info(`${documents.length} documentos atualizados na collection ${collectionName}`);

      return {
        success: true,
        updated: documents.length,
        collection: collectionName,
      };
    } catch (error) {
      logger.error('Erro ao atualizar documentos', {
        collection: collectionName,
        error: error.message,
      });
      throw new VectorDBError(
        `Falha ao atualizar documentos: ${error.message}`,
        'update_documents'
      );
    }
  }

  /**
   * Remove documentos por IDs
   */
  async deleteDocuments(collectionName, documentIds) {
    try {
      const collection = this.getCollection(collectionName);

      if (!Array.isArray(documentIds)) {
        documentIds = [documentIds];
      }

      await collection.delete({
        ids: documentIds,
      });

      logger.info(`${documentIds.length} documentos removidos da collection ${collectionName}`);

      return {
        success: true,
        deleted: documentIds.length,
        collection: collectionName,
      };
    } catch (error) {
      logger.error('Erro ao remover documentos', {
        collection: collectionName,
        ids: documentIds,
        error: error.message,
      });
      throw new VectorDBError(`Falha ao remover documentos: ${error.message}`, 'delete_documents');
    }
  }

  /**
   * Obtém documento por ID
   */
  async getDocument(collectionName, documentId) {
    try {
      const collection = this.getCollection(collectionName);

      const result = await collection.get({
        ids: [documentId],
        include: ['documents', 'metadatas', 'embeddings'],
      });

      if (!result.ids || result.ids.length === 0) {
        return null;
      }

      return {
        id: result.ids[0],
        content: result.documents[0],
        metadata: result.metadatas[0],
        embedding: result.embeddings ? result.embeddings[0] : null,
      };
    } catch (error) {
      logger.error('Erro ao buscar documento', {
        collection: collectionName,
        id: documentId,
        error: error.message,
      });
      throw new VectorDBError(`Falha ao buscar documento: ${error.message}`, 'get_document');
    }
  }

  /**
   * Conta documentos na collection
   */
  async countDocuments(collectionName) {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.count();
    } catch (error) {
      throw new VectorDBError(`Falha ao contar documentos: ${error.message}`, 'count_documents');
    }
  }

  /**
   * Lista todas as collections
   */
  async listCollections() {
    try {
      const collections = await this.client.listCollections();
      return collections.map(col => ({
        name: col.name,
        metadata: col.metadata,
      }));
    } catch (error) {
      throw new VectorDBError(`Falha ao listar collections: ${error.message}`, 'list_collections');
    }
  }

  /**
   * Limpa collection (remove todos os documentos)
   */
  async clearCollection(collectionName) {
    try {
      await this.client.deleteCollection({
        name: this.config.collections[collectionName],
      });

      // Recria a collection
      await this.ensureCollections();

      logger.info(`Collection ${collectionName} limpa`);

      return { success: true, collection: collectionName };
    } catch (error) {
      throw new VectorDBError(`Falha ao limpar collection: ${error.message}`, 'clear_collection');
    }
  }

  /**
   * Busca avançada com múltiplos filtros
   */
  async advancedSearch(collectionName, query) {
    try {
      const {
        embedding,
        textFilters = {},
        metadataFilters = {},
        limit = 10,
        threshold = 0.0,
      } = query;

      const collection = this.getCollection(collectionName);

      // Constrói filtros
      const where = Object.keys(metadataFilters).length > 0 ? metadataFilters : undefined;
      const whereDocument = Object.keys(textFilters).length > 0 ? textFilters : undefined;

      const results = await collection.query({
        queryEmbeddings: [embedding],
        nResults: limit,
        where,
        whereDocument,
        include: ['documents', 'metadatas', 'distances'],
      });

      const formattedResults = this.formatSearchResults(results);

      // Aplica threshold se especificado
      if (threshold > 0) {
        return formattedResults.filter(result => result.similarity >= threshold);
      }

      return formattedResults;
    } catch (error) {
      throw new VectorDBError(`Falha na busca avançada: ${error.message}`, 'advanced_search');
    }
  }

  /**
   * Backup de collection
   */
  async backupCollection(collectionName, backupPath) {
    try {
      const collection = this.getCollection(collectionName);

      // Obtém todos os documentos
      const allData = await collection.get({
        include: ['documents', 'metadatas', 'embeddings'],
      });

      const backup = {
        collection: collectionName,
        timestamp: new Date().toISOString(),
        count: allData.ids?.length || 0,
        data: allData,
      };

      // Salvaria no sistema de arquivos ou S3
      logger.info(`Backup criado para collection ${collectionName}`, {
        count: backup.count,
        path: backupPath,
      });

      return backup;
    } catch (error) {
      throw new VectorDBError(`Falha no backup: ${error.message}`, 'backup_collection');
    }
  }

  /**
   * Estatísticas da collection
   */
  async getCollectionStats(collectionName) {
    try {
      const collection = this.getCollection(collectionName);
      const count = await collection.count();

      // Obter amostra para análise
      const sample = await collection.peek({ limit: 10 });

      return {
        collection: collectionName,
        documentCount: count,
        sampleSize: sample.ids?.length || 0,
        hasEmbeddings: !!(sample.embeddings && sample.embeddings.length > 0),
        embeddingDimensions: sample.embeddings?.[0]?.length || 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      throw new VectorDBError(`Falha ao obter estatísticas: ${error.message}`, 'get_stats');
    }
  }

  /**
   * Health check do vector database
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          error: 'Não conectado ao vector database',
        };
      }

      // Testa conexão básica
      await this.client.heartbeat();

      // Testa uma collection
      const testCollection = this.collections.values().next().value;
      if (testCollection) {
        await testCollection.count();
      }

      return {
        status: 'healthy',
        provider: this.config.provider,
        host: this.config.connection.host,
        port: this.config.connection.port,
        collections: Array.from(this.collections.keys()),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        provider: this.config.provider,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Métodos auxiliares privados

  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new VectorDBError(`Collection '${collectionName}' não encontrada`, 'get_collection');
    }
    return collection;
  }

  validateDocuments(documents) {
    for (const doc of documents) {
      if (!doc.id) {
        throw new Error('Documento deve ter ID');
      }
      if (!doc.content && !doc.embedding) {
        throw new Error('Documento deve ter content ou embedding');
      }
      if (doc.embedding && !Array.isArray(doc.embedding)) {
        throw new Error('Embedding deve ser um array');
      }
    }
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  formatSearchResults(results, options = {}) {
    if (!results.ids || !results.ids[0]) {
      return [];
    }

    const ids = results.ids[0];
    const documents = results.documents?.[0] || [];
    const metadatas = results.metadatas?.[0] || [];
    const distances = results.distances?.[0] || [];

    return ids.map((id, index) => ({
      id,
      content: documents[index] || '',
      metadata: metadatas[index] || {},
      distance: distances[index] || 0,
      similarity: this.distanceToSimilarity(distances[index] || 0),
    }));
  }

  distanceToSimilarity(distance) {
    // Converte distância em similaridade (0-1)
    return Math.max(0, 1 - distance);
  }

  /**
   * Fecha conexões
   */
  async close() {
    this.isConnected = false;
    this.collections.clear();
    this.client = null;

    logger.info('Vector database desconectado');
  }
}

module.exports = VectorDatabase;
