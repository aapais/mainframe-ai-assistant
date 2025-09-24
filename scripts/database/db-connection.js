/**
 * PostgreSQL database connection module with pgvector support
 * Provides connection pooling, query helpers, and vector operations
 */

const { Pool, Client } = require('pg');
const redis = require('redis');

class DatabaseConnection {
  constructor(config = {}) {
    this.config = {
      // PostgreSQL configuration
      postgres: {
        host: process.env.DB_HOST || config.host || 'localhost',
        port: process.env.DB_PORT || config.port || 5432,
        database: process.env.DB_NAME || config.database || 'mainframe_ai',
        user: process.env.DB_USER || config.user || 'mainframe_user',
        password: process.env.DB_PASSWORD || config.password || 'mainframe_pass',
        max: config.maxConnections || 20,
        idleTimeoutMillis: config.idleTimeout || 30000,
        connectionTimeoutMillis: config.connectionTimeout || 2000,
        ssl: config.ssl || false
      },

      // Redis configuration for caching
      redis: {
        host: process.env.REDIS_HOST || config.redisHost || 'localhost',
        port: process.env.REDIS_PORT || config.redisPort || 6379,
        password: process.env.REDIS_PASSWORD || config.redisPassword,
        db: config.redisDb || 0
      },

      // Vector search configuration
      vector: {
        dimension: config.vectorDimension || 1536,
        similarityThreshold: config.similarityThreshold || 0.7,
        maxResults: config.maxResults || 10
      },

      // Caching configuration
      cache: {
        enabled: config.cacheEnabled !== false,
        defaultTtl: config.cacheTtl || 300, // 5 minutes
        keyPrefix: config.cacheKeyPrefix || 'mainframe_ai:'
      }
    };

    this.pool = null;
    this.redisClient = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connections
   */
  async connect() {
    try {
      // Initialize PostgreSQL connection pool
      this.pool = new Pool(this.config.postgres);

      // Test PostgreSQL connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('✅ PostgreSQL connected successfully');

      // Initialize Redis client (optional)
      if (this.config.cache.enabled) {
        try {
          this.redisClient = redis.createClient(this.config.redis);
          await this.redisClient.connect();
          console.log('✅ Redis connected successfully');
        } catch (redisError) {
          console.warn('⚠️  Redis connection failed, caching disabled:', redisError.message);
          this.config.cache.enabled = false;
        }
      }

      this.isConnected = true;

      // Set up connection pool event handlers
      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err);
      });

      if (this.redisClient) {
        this.redisClient.on('error', (err) => {
          console.error('Redis client error:', err);
        });
      }

    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Close database connections
   */
  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        console.log('✅ PostgreSQL disconnected');
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('✅ Redis disconnected');
      }

      this.isConnected = false;
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
    }
  }

  /**
   * Execute a query with optional caching
   */
  async query(text, params = [], options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const cacheKey = options.cacheKey || this._generateCacheKey(text, params);
    const ttl = options.cacheTtl || this.config.cache.defaultTtl;

    // Try cache first
    if (this.config.cache.enabled && this.redisClient && !options.skipCache) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        console.warn('Cache read error:', cacheError.message);
      }
    }

    // Execute query
    const start = Date.now();
    const result = await this.pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
    }

    // Cache result
    if (this.config.cache.enabled && this.redisClient && !options.skipCache && result.rows.length > 0) {
      try {
        await this.redisClient.setEx(cacheKey, ttl, JSON.stringify(result));
      } catch (cacheError) {
        console.warn('Cache write error:', cacheError.message);
      }
    }

    return result;
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search for similar incidents using vector embeddings
   */
  async searchSimilarIncidents(embedding, options = {}) {
    const {
      queryText = '',
      limit = this.config.vector.maxResults,
      threshold = this.config.vector.similarityThreshold,
      statusFilter = null,
      technicalAreaFilter = null,
      businessAreaFilter = null
    } = options;

    const embeddingVector = Array.isArray(embedding) ? JSON.stringify(embedding) : embedding;

    const result = await this.query(
      `SELECT * FROM search_similar_incidents($1, $2, $3, $4, $5, $6)`,
      [embeddingVector, queryText, limit, threshold, statusFilter, technicalAreaFilter],
      { cacheKey: `similar_incidents:${this._hashEmbedding(embedding)}:${JSON.stringify(options)}` }
    );

    return result.rows;
  }

  /**
   * Search knowledge base using vector embeddings
   */
  async searchKnowledgeBase(embedding, options = {}) {
    const {
      queryText = '',
      limit = this.config.vector.maxResults,
      threshold = this.config.vector.similarityThreshold,
      typeFilter = null,
      technicalAreaFilter = null
    } = options;

    const embeddingVector = Array.isArray(embedding) ? JSON.stringify(embedding) : embedding;

    const result = await this.query(
      `SELECT * FROM search_knowledge_base($1, $2, $3, $4, $5, $6)`,
      [embeddingVector, queryText, limit, threshold, typeFilter, technicalAreaFilter],
      { cacheKey: `knowledge_search:${this._hashEmbedding(embedding)}:${JSON.stringify(options)}` }
    );

    return result.rows;
  }

  /**
   * Get incident by ID with related knowledge
   */
  async getIncidentWithKnowledge(incidentId) {
    const incident = await this.query(
      'SELECT * FROM incidents_enhanced WHERE id = $1',
      [incidentId]
    );

    if (incident.rows.length === 0) {
      return null;
    }

    const incidentData = incident.rows[0];

    // Get related knowledge if embedding exists
    let relatedKnowledge = [];
    if (incidentData.embedding) {
      relatedKnowledge = await this.searchKnowledgeBase(incidentData.embedding, {
        limit: 5,
        technicalAreaFilter: incidentData.technical_area
      });
    }

    return {
      ...incidentData,
      related_knowledge: relatedKnowledge
    };
  }

  /**
   * Create new incident with embedding
   */
  async createIncident(incidentData, embedding = null) {
    const {
      title,
      description,
      technical_area,
      business_area,
      status = 'OPEN',
      priority = 'MEDIUM',
      severity = 'MEDIUM',
      assigned_to,
      reporter,
      metadata = {}
    } = incidentData;

    const embeddingVector = embedding ? JSON.stringify(embedding) : null;

    const result = await this.query(
      `INSERT INTO incidents_enhanced (
        title, description, technical_area, business_area, status, priority,
        severity, assigned_to, reporter, embedding, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        title, description, technical_area, business_area, status, priority,
        severity, assigned_to, reporter, embeddingVector, JSON.stringify(metadata)
      ],
      { skipCache: true }
    );

    // Clear related caches
    await this._clearIncidentCaches();

    return result.rows[0];
  }

  /**
   * Update incident
   */
  async updateIncident(id, updates, embedding = null) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (embedding) {
      fields.push(`embedding = $${paramIndex}`);
      values.push(JSON.stringify(embedding));
      paramIndex++;
    }

    values.push(id);

    const result = await this.query(
      `UPDATE incidents_enhanced SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} RETURNING *`,
      values,
      { skipCache: true }
    );

    // Clear related caches
    await this._clearIncidentCaches();

    return result.rows[0];
  }

  /**
   * Add knowledge base entry
   */
  async addKnowledgeEntry(knowledgeData, embedding = null) {
    const {
      type,
      technical_area,
      business_area,
      title,
      content,
      summary,
      tags = [],
      difficulty_level = 'INTERMEDIATE',
      confidence_score = 0.80,
      created_by
    } = knowledgeData;

    const embeddingVector = embedding ? JSON.stringify(embedding) : null;

    const result = await this.query(
      `INSERT INTO knowledge_base (
        type, technical_area, business_area, title, content, summary, tags,
        difficulty_level, confidence_score, embedding, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        type, technical_area, business_area, title, content, summary, tags,
        difficulty_level, confidence_score, embeddingVector, created_by
      ],
      { skipCache: true }
    );

    // Clear related caches
    await this._clearKnowledgeCaches();

    return result.rows[0];
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    try {
      const pgHealth = await this.query('SELECT NOW() as timestamp, version() as version');

      let redisHealth = null;
      if (this.redisClient) {
        try {
          await this.redisClient.ping();
          redisHealth = { status: 'connected' };
        } catch (error) {
          redisHealth = { status: 'error', error: error.message };
        }
      }

      return {
        postgres: {
          status: 'connected',
          timestamp: pgHealth.rows[0].timestamp,
          version: pgHealth.rows[0].version
        },
        redis: redisHealth,
        pool: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        postgres: { status: 'error', error: error.message },
        redis: redisHealth,
        pool: null
      };
    }
  }

  /**
   * Generate cache key
   */
  _generateCacheKey(query, params) {
    const hash = require('crypto')
      .createHash('sha256')
      .update(query + JSON.stringify(params))
      .digest('hex')
      .substring(0, 16);

    return `${this.config.cache.keyPrefix}query:${hash}`;
  }

  /**
   * Hash embedding for cache key
   */
  _hashEmbedding(embedding) {
    const embeddingStr = Array.isArray(embedding) ? embedding.join(',') : embedding;
    return require('crypto')
      .createHash('sha256')
      .update(embeddingStr)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Clear incident-related caches
   */
  async _clearIncidentCaches() {
    if (!this.redisClient) return;

    try {
      const keys = await this.redisClient.keys(`${this.config.cache.keyPrefix}*incident*`);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } catch (error) {
      console.warn('Error clearing incident caches:', error.message);
    }
  }

  /**
   * Clear knowledge-related caches
   */
  async _clearKnowledgeCaches() {
    if (!this.redisClient) return;

    try {
      const keys = await this.redisClient.keys(`${this.config.cache.keyPrefix}*knowledge*`);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } catch (error) {
      console.warn('Error clearing knowledge caches:', error.message);
    }
  }
}

// Create singleton instance
let dbInstance = null;

/**
 * Get database instance (singleton)
 */
function getDatabase(config = {}) {
  if (!dbInstance) {
    dbInstance = new DatabaseConnection(config);
  }
  return dbInstance;
}

/**
 * Initialize database connection
 */
async function initializeDatabase(config = {}) {
  const db = getDatabase(config);
  if (!db.isConnected) {
    await db.connect();
  }
  return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.disconnect();
    dbInstance = null;
  }
}

module.exports = {
  DatabaseConnection,
  getDatabase,
  initializeDatabase,
  closeDatabase
};