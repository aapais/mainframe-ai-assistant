/**
 * Enhanced Backend Server with PostgreSQL and Vector Search Support
 * Supports both SQLite (legacy) and PostgreSQL (new) with vector embeddings
 */

const express = require('express');
const { Client } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const EmbeddingService = require('../services/embedding-service');
let documentProcessorApi;
try {
  console.log('📋 Loading document processor API...');
  documentProcessorApi = require('./document-processor-api');
  console.log('✅ Document processor API loaded successfully');
} catch (error) {
  console.error('❌ Failed to load document processor API:', error.message);
}
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database configuration
const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || process.env.DB_HOST;
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './kb-assistant.db';

const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
};

// Initialize services
let dbConnection = null;
let embeddingService = null;

// Function to initialize embedding service with settings-based fallback
async function initializeEmbeddingService() {
  try {
    // Try to load settings from localStorage if available (for web context)
    // For server context, we'll check environment variables and create fallback configs
    const settings = {
      useAI: true,
      llmProvider: process.env.LLM_PROVIDER || 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.DEFAULT_MODEL || 'text-embedding-ada-002',
      azureEndpoint: process.env.AZURE_ENDPOINT
    };

    if (settings.apiKey && settings.apiKey !== 'your_openai_api_key_here') {
      // Use new settings-based initialization with fallback
      embeddingService = new EmbeddingService(null, settings);
      const initialized = await embeddingService.initializeFromSettings(settings);

      if (initialized) {
        const activeModel = embeddingService.getActiveModel();
        console.log(`🧠 Vector embedding service initialized with model: ${activeModel?.model} (${activeModel?.provider})`);
      } else {
        console.warn('⚠️ Failed to initialize embedding service. Vector search will be disabled.');
        embeddingService = null;
      }
    } else {
      console.warn('⚠️ No valid API key found. Vector search will be disabled.');
      embeddingService = null;
    }
  } catch (error) {
    console.error('❌ Error initializing embedding service:', error.message);
    embeddingService = null;
  }
}

// Database connection management
class DatabaseManager {
  constructor() {
    this.isPostgres = USE_POSTGRES;
    this.client = null;
    this.sqliteDb = null;
  }

  async connect() {
    if (this.isPostgres) {
      console.log('🐘 Connecting to PostgreSQL...');
      this.client = new Client(pgConfig);
      await this.client.connect();
      console.log('✅ PostgreSQL connected');

      // Test pgvector extension
      try {
        await this.client.query('SELECT 1::vector');
        console.log('✅ pgvector extension available');
      } catch (error) {
        console.warn('⚠️ pgvector extension not available. Vector search disabled.');
      }
    } else {
      console.log('📖 Using SQLite database...');
      this.sqliteDb = new Database(SQLITE_DB_PATH);
      this.sqliteDb.pragma('journal_mode = WAL');
      console.log('✅ SQLite connected');
    }
  }

  async query(sql, params = []) {
    if (this.isPostgres) {
      const result = await this.client.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    } else {
      if (sql.toLowerCase().includes('select')) {
        const stmt = this.sqliteDb.prepare(sql);
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const stmt = this.sqliteDb.prepare(sql);
        const result = stmt.run(...params);
        return { rows: [], rowCount: result.changes, lastInsertId: result.lastInsertRowid };
      }
    }
  }

  async close() {
    if (this.client) {
      await this.client.end();
      console.log('🐘 PostgreSQL disconnected');
    }
    if (this.sqliteDb) {
      this.sqliteDb.close();
      console.log('📖 SQLite disconnected');
    }
  }
}

const db = new DatabaseManager();

// MIDDLEWARE SETUP - CRITICAL ORDER!
// 1. Body parsers
app.use(express.json({ limit: '10mb' }));

// 2. CORS middleware (BEFORE all routes)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// 3. Add document processor API routes BEFORE static file serving
if (documentProcessorApi) {
  console.log('📋 Registering document processor API routes...');
  console.log('📋 Document processor API type:', typeof documentProcessorApi);

  // Mount the router
  app.use('/api/documents', documentProcessorApi);
  console.log('✅ Document processor API routes registered');

  // List all routes on the router for debugging
  console.log('📋 Available routes on document processor:');
  documentProcessorApi.stack.forEach((layer) => {
    if (layer.route) {
      console.log(`  - ${Object.keys(layer.route.methods).join(', ').toUpperCase()} /api/documents${layer.route.path}`);
    }
  });

  // Test route with debugging
  app.get('/api/documents-test', (req, res) => {
    console.log('📋 Document test endpoint hit');
    res.json({
      success: true,
      message: 'Document processor API is working',
      timestamp: new Date().toISOString(),
      middlewareOrder: 'fixed'
    });
  });
} else {
  console.warn('⚠️ Document processor API not available, skipping route registration');
}

// Debug middleware to log all API requests
app.use('/api', (req, res, next) => {
  console.log(`🔍 API Request: ${req.method} ${req.originalUrl}`);
  next();
});

// Enhanced query builders
class QueryBuilder {
  static buildGetIncidentsQuery(usePostgres = false) {
    if (usePostgres) {
      return `
        SELECT id, uuid, title, description, technical_area, business_area,
               status, priority, severity, assigned_to, reporter, resolution,
               metadata, created_at, updated_at, resolved_at
        FROM incidents_enhanced
        ORDER BY created_at DESC
      `;
    } else {
      return `
        SELECT id, title, description, category as technical_area,
               status, priority, severity, assigned_to, reporter, solution as resolution,
               created_at, updated_at
        FROM entries
        ORDER BY created_at DESC
      `;
    }
  }

  static buildSearchQuery(usePostgres = false) {
    if (usePostgres) {
      return `
        SELECT id, uuid, title, description, technical_area, business_area,
               status, priority, severity, assigned_to, reporter, resolution,
               ts_rank_cd(search_vector, plainto_tsquery('english', $1)) as rank,
               metadata, created_at, updated_at
        FROM incidents_enhanced
        WHERE search_vector @@ plainto_tsquery('english', $1)
           OR title ILIKE $2 OR description ILIKE $2 OR resolution ILIKE $2
        ORDER BY rank DESC, created_at DESC
        LIMIT 100
      `;
    } else {
      return `
        SELECT id, title, description, category as technical_area,
               status, priority, severity, assigned_to, reporter, solution as resolution,
               created_at, updated_at
        FROM entries
        WHERE title LIKE ? OR description LIKE ? OR category LIKE ? OR assigned_to LIKE ?
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }
  }

  static buildCreateIncidentQuery(usePostgres = false) {
    if (usePostgres) {
      return `
        INSERT INTO incidents_enhanced (
          title, description, technical_area, business_area, status, priority,
          severity, reporter, embedding, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, uuid, title, created_at
      `;
    } else {
      return `
        INSERT INTO entries (
          title, description, category, severity, status, priority, reporter,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
  }
}

// API Routes

// Vector similarity search endpoint (PostgreSQL only)
app.post('/api/incidents/vector-search', async (req, res) => {
  if (!db.isPostgres) {
    return res.status(501).json({
      success: false,
      error: 'Vector search requires PostgreSQL with pgvector extension'
    });
  }

  if (!embeddingService || !embeddingService.isAvailable()) {
    return res.status(501).json({
      success: false,
      error: 'Vector search requires OpenAI API key for embeddings'
    });
  }

  try {
    const { query, limit = 10, threshold = 0.7, technical_area, status } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query text is required'
      });
    }

    // Generate embedding for query
    console.log('🔍 Generating embedding for search query...');
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    if (!queryEmbedding) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate embedding for query'
      });
    }

    // Perform vector similarity search
    const searchQuery = `
      SELECT
        id, uuid, title, description, technical_area, business_area,
        status, priority, severity, assigned_to, reporter, resolution,
        (1 - (embedding <=> $1::vector)) as similarity_score,
        ts_rank_cd(search_vector, plainto_tsquery('english', $2)) as text_relevance,
        (
          (0.7 * (1 - (embedding <=> $1::vector))) +
          (0.3 * ts_rank_cd(search_vector, plainto_tsquery('english', $2)))
        ) as combined_score,
        metadata, created_at, updated_at
      FROM incidents_enhanced
      WHERE embedding IS NOT NULL
        AND (1 - (embedding <=> $1::vector)) >= $3
        ${technical_area ? 'AND technical_area = $4' : ''}
        ${status ? `AND status = $${technical_area ? '5' : '4'}` : ''}
      ORDER BY combined_score DESC
      LIMIT $${technical_area && status ? '6' : technical_area || status ? '5' : '4'}
    `;

    const params = [
      `[${queryEmbedding.join(',')}]`,
      query,
      threshold,
      limit
    ];

    if (technical_area) params.splice(3, 0, technical_area);
    if (status) params.splice(technical_area ? 4 : 3, 0, status);

    const result = await db.query(searchQuery, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      query,
      threshold,
      filters: { technical_area, status }
    });

  } catch (error) {
    console.error('Error in vector search:', error);
    res.status(500).json({
      success: false,
      error: 'Vector search failed',
      details: error.message
    });
  }
});

// Enhanced text search
app.get('/api/incidents/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required'
      });
    }

    const searchQuery = QueryBuilder.buildSearchQuery(db.isPostgres);

    let result;
    if (db.isPostgres) {
      const searchTerm = `%${q}%`;
      result = await db.query(searchQuery, [q, searchTerm]);
    } else {
      const searchTerm = `%${q}%`;
      result = await db.query(searchQuery, [searchTerm, searchTerm, searchTerm, searchTerm]);
    }

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      query: q,
      database: db.isPostgres ? 'PostgreSQL' : 'SQLite'
    });

  } catch (error) {
    console.error('Error searching incidents:', error);
    res.status(500).json({ success: false, error: 'Failed to search incidents' });
  }
});

// Get all incidents
app.get('/api/incidents', async (req, res) => {
  try {
    const query = QueryBuilder.buildGetIncidentsQuery(db.isPostgres);
    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      database: db.isPostgres ? 'PostgreSQL' : 'SQLite'
    });

  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch incidents' });
  }
});

// Create incident with optional embedding
app.post('/api/incidents', async (req, res) => {
  try {
    const {
      title, description, technical_area, business_area = 'OTHER',
      severity, priority = 'MEDIUM', reporter
    } = req.body;

    // Validation
    if (!title || !description || !reporter) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, reporter'
      });
    }

    let embedding = null;
    if (db.isPostgres && embeddingService && embeddingService.isAvailable()) {
      const embeddingText = embeddingService.createIncidentEmbeddingText({
        title, description, technical_area, business_area
      });
      embedding = await embeddingService.generateEmbedding(embeddingText);
    }

    const metadata = {
      created_via: 'api',
      has_embedding: !!embedding,
      source: 'web_interface'
    };

    let result;
    if (db.isPostgres) {
      const query = QueryBuilder.buildCreateIncidentQuery(true);
      const params = [
        title, description, technical_area || 'OTHER', business_area,
        'OPEN', priority, severity || 'MEDIUM', reporter,
        embedding ? `[${embedding.join(',')}]` : null,
        JSON.stringify(metadata)
      ];
      result = await db.query(query, params);
    } else {
      const query = QueryBuilder.buildCreateIncidentQuery(false);
      const params = [title, description, technical_area, severity, 'aberto', priority, reporter];
      result = await db.query(query, params);
    }

    res.status(201).json({
      success: true,
      data: db.isPostgres ? result.rows[0] : {
        id: result.lastInsertId,
        title,
        created_at: new Date().toISOString()
      },
      embedding_generated: !!embedding
    });

  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ success: false, error: 'Failed to create incident' });
  }
});

// Health check with database status
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const testQuery = db.isPostgres ? 'SELECT 1 as test' : 'SELECT 1 as test';
    await db.query(testQuery);

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        type: db.isPostgres ? 'PostgreSQL' : 'SQLite',
        connected: true
      },
      services: {
        embedding: embeddingService ? embeddingService.isAvailable() : false,
        vector_search: db.isPostgres && embeddingService && embeddingService.isAvailable()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Model validation endpoint
app.post('/api/validate-model', async (req, res) => {
  try {
    const { provider, apiKey, model, azureEndpoint } = req.body;

    if (!provider || !apiKey || !model) {
      return res.status(400).json({
        success: false,
        error: 'Provider, API key e modelo são obrigatórios'
      });
    }

    // Carregar serviço de validação se não estiver disponível
    const ModelValidationService = require('../services/model-validation-service');
    const validator = new ModelValidationService();

    const modelConfig = { provider, apiKey, model, azureEndpoint };
    const result = await validator.validateModel(modelConfig);

    if (result.success) {
      res.json({
        success: true,
        message: `Modelo ${model} validado com sucesso`,
        model: result.model,
        provider: result.provider,
        embeddingDimensions: result.embeddingDimensions
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Erro na validação do modelo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno na validação do modelo'
    });
  }
});

// Test model fallback system
app.post('/api/test-model-fallback', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({
        success: false,
        error: 'Settings são obrigatórias'
      });
    }

    const ModelValidationService = require('../services/model-validation-service');
    const validator = new ModelValidationService();

    const modelConfigs = validator.generateModelConfigurations(settings);
    const result = await validator.findWorkingModel(modelConfigs);

    if (result.success) {
      res.json({
        success: true,
        activeModel: result.activeModel,
        fallbackUsed: result.fallbackUsed,
        message: result.fallbackUsed
          ? `Usando modelo fallback: ${result.activeModel.model}`
          : `Usando modelo principal: ${result.activeModel.model}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        testedModels: result.testedModels
      });
    }

  } catch (error) {
    console.error('Erro no teste de fallback:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno no teste de fallback'
    });
  }
});

// Database migration status endpoint
app.get('/api/migration/status', async (req, res) => {
  try {
    const status = {
      sqlite_available: false,
      postgres_available: db.isPostgres,
      current_database: db.isPostgres ? 'PostgreSQL' : 'SQLite',
      vector_search_enabled: false,
      embedding_service_available: embeddingService && embeddingService.isAvailable()
    };

    // Check SQLite
    try {
      const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
      const count = sqliteDb.prepare('SELECT COUNT(*) as count FROM entries').get();
      status.sqlite_available = true;
      status.sqlite_entries = count.count;
      sqliteDb.close();
    } catch (error) {
      status.sqlite_error = error.message;
    }

    // Check PostgreSQL
    if (db.isPostgres) {
      try {
        const result = await db.query('SELECT COUNT(*) as count FROM incidents_enhanced');
        status.postgres_entries = parseInt(result.rows[0].count);

        // Check for embeddings
        const embeddingResult = await db.query(
          'SELECT COUNT(*) as count FROM incidents_enhanced WHERE embedding IS NOT NULL'
        );
        status.postgres_entries_with_embeddings = parseInt(embeddingResult.rows[0].count);
        status.vector_search_enabled = status.postgres_entries_with_embeddings > 0;
      } catch (error) {
        status.postgres_error = error.message;
      }
    }

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize server
async function initializeServer() {
  try {
    await db.connect();

    // Initialize embedding service with settings and fallback
    await initializeEmbeddingService();

    // Initialize database services for API routes
    app.locals.db = db;
    app.locals.embeddingService = embeddingService;

    // STATIC FILES MIDDLEWARE - MUST BE LAST!
    // This serves index.html and other static files ONLY if no API route matched
    app.use(express.static('.', {
      index: 'index.html',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.set('Cache-Control', 'no-cache');
        }
      }
    }));

    console.log('✅ Static file middleware registered (LAST in chain)');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Enhanced server running on http://localhost:${PORT}`);
      console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
      console.log(`💾 Database: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'}`);
      console.log(`🧠 Vector search: ${db.isPostgres && embeddingService ? 'Enabled' : 'Disabled'}`);
      console.log(`🔍 Migration status: http://localhost:${PORT}/api/migration/status`);
    });

  } catch (error) {
    console.error('💥 Failed to initialize server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('\n📴 Shutting down server...');
  await db.close();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
initializeServer();

module.exports = { app, db, embeddingService };