/**
 * PostgreSQL-Only Backend Server
 * Simplified version without SQLite dependency
 */

const express = require('express');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs').promises;
const EmbeddingService = require('../services/embedding-service');
// const documentProcessorRouter = require('./document-processor-api');
const settingsRouter = require('../api/settings/settings-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'mainframe_ai',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'mainframe_user',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'your_secure_password_123',
};

// Initialize services
let embeddingService = null;

// Initialize embedding service
if (process.env.OPENAI_API_KEY) {
  embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);
  // Vector embedding service initialized
} else {
  // OPENAI_API_KEY not found. Vector search will be disabled.
}

// Database connection management
class PostgreSQLManager {
  constructor() {
    this.client = null;
  }

  async connect() {
    // Connecting to PostgreSQL...
    this.client = new Client(pgConfig);
    await this.client.connect();
    // PostgreSQL connected

    // Initialize knowledge base schema
    await this.initializeKnowledgeBase();

    // Test pgvector extension
    try {
      await this.client.query('SELECT 1::vector');
      console.log('✅ pgvector extension available');
    } catch (error) {
      console.warn('⚠️ pgvector extension not available. Vector search disabled.');
    }
  }

  async initializeKnowledgeBase() {
    try {
      const schemaPath = path.join(__dirname, '../database/init-knowledge-base.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');
      await this.client.query(schema);
      console.log('✅ Knowledge base schema initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize knowledge base schema:', error.message);
    }
  }

  async query(sql, params = []) {
    const result = await this.client.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount };
  }

  async close() {
    if (this.client) {
      await this.client.end();
      console.log('🐘 PostgreSQL disconnected');
    }
  }
}

const db = new PostgreSQLManager();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(
  express.static('.', {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      }
    },
  })
);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Make database connection and services available to routes
app.use((req, res, next) => {
  req.app.locals.db = db;
  req.app.locals.embeddingService = embeddingService;
  next();
});

// Document processor routes
// app.use('/api/documents', documentProcessorRouter);

// Settings API routes
app.use('/api/settings', settingsRouter);

// API Routes

// Get all incidents
app.get('/api/incidents', async (req, res) => {
  try {
    const query = `
      SELECT id, uuid, title, description, technical_area as category,
             business_area, status, priority, severity, assigned_to,
             reporter, resolution as solution, metadata,
             created_at, updated_at, resolved_at
      FROM incidents_enhanced
      ORDER BY created_at DESC
    `;
    const result = await db.query(query);

    // Format for frontend compatibility
    const incidents = result.rows.map(row => ({
      id: row.id,
      uuid: row.uuid,
      title: row.title,
      description: row.description,
      category: row.category || 'Other',
      priority: row.priority || 'Média',
      status: row.status || 'Aberto',
      solution: row.solution || '',
      tags: [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json(incidents);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Search incidents
app.get('/api/incidents/search', async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const query = `
      SELECT id, uuid, title, description, technical_area as category,
             business_area, status, priority, severity, assigned_to,
             reporter, resolution as solution, metadata,
             created_at, updated_at, resolved_at
      FROM incidents_enhanced
      WHERE search_vector @@ websearch_to_tsquery('portuguese', $1)
         OR title ILIKE $2
         OR description ILIKE $2
         OR resolution ILIKE $2
      ORDER BY ts_rank(search_vector, websearch_to_tsquery('portuguese', $1)) DESC,
               created_at DESC
      LIMIT 50
    `;

    const result = await db.query(query, [searchQuery, `%${searchQuery}%`]);

    // Format for frontend compatibility
    const incidents = result.rows.map(row => ({
      id: row.id,
      uuid: row.uuid,
      title: row.title,
      description: row.description,
      category: row.category || 'Other',
      priority: row.priority || 'Média',
      status: row.status || 'Aberto',
      solution: row.solution || '',
      tags: [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json(incidents);
  } catch (error) {
    console.error('Error searching incidents:', error);
    res.status(500).json({ error: 'Failed to search incidents' });
  }
});

// Create incident
app.post('/api/incidents', async (req, res) => {
  try {
    const { title, description, category, priority, status, solution } = req.body;

    const query = `
      INSERT INTO incidents_enhanced (
        title, description, technical_area, priority, status, resolution,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await db.query(query, [
      title,
      description,
      category || 'Other',
      priority || 'Média',
      status || 'Aberto',
      solution || '',
    ]);

    const incident = result.rows[0];

    // Generate embedding if service available
    if (embeddingService && description) {
      try {
        const embedding = await embeddingService.generateEmbedding(
          `${title} ${description} ${solution || ''}`
        );
        if (embedding) {
          await db.query('UPDATE incidents_enhanced SET embedding = $1 WHERE id = $2', [
            `[${embedding.join(',')}]`,
            incident.id,
          ]);
        }
      } catch (error) {
        console.warn('Failed to generate embedding:', error.message);
      }
    }

    res.status(201).json({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.technical_area,
      priority: incident.priority,
      status: incident.status,
      solution: incident.resolution,
      created_at: incident.created_at,
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// Update incident
app.put('/api/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, priority, status, solution } = req.body;

    const query = `
      UPDATE incidents_enhanced
      SET title = $1, description = $2, technical_area = $3,
          priority = $4, status = $5, resolution = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const result = await db.query(query, [
      title,
      description,
      category || 'Other',
      priority || 'Média',
      status || 'Aberto',
      solution || '',
      id,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const incident = result.rows[0];

    // Update embedding if service available
    if (embeddingService && description) {
      try {
        const embedding = await embeddingService.generateEmbedding(
          `${title} ${description} ${solution || ''}`
        );
        if (embedding) {
          await db.query('UPDATE incidents_enhanced SET embedding = $1 WHERE id = $2', [
            `[${embedding.join(',')}]`,
            incident.id,
          ]);
        }
      } catch (error) {
        console.warn('Failed to update embedding:', error.message);
      }
    }

    res.json({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.technical_area,
      priority: incident.priority,
      status: incident.status,
      solution: incident.resolution,
      updated_at: incident.updated_at,
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Delete incident
app.delete('/api/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM incidents_enhanced WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({ message: 'Incident deleted successfully' });
  } catch (error) {
    console.error('Error deleting incident:', error);
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'PostgreSQL',
      vectorSearch: embeddingService ? 'enabled' : 'disabled',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'resolvido' THEN 1 END) as resolved,
        COUNT(CASE WHEN status IN ('aberto', 'Aberto') THEN 1 END) as open,
        COUNT(CASE WHEN status = 'em_tratamento' THEN 1 END) as in_progress
      FROM incidents_enhanced
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Knowledge Base Routes

// Get all knowledge base entries
app.get('/api/knowledge', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT uuid, title, content, summary, category,
             confidence_score, source, metadata,
             created_by, created_at, updated_at
      FROM knowledge_base
    `;

    const params = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
      query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      params.push(limit, offset);
    } else {
      query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
      params.push(limit, offset);
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
});

// Search knowledge base
app.get('/api/knowledge/search', async (req, res) => {
  try {
    const { query: searchQuery, category, useVector = false } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query required' });
    }

    let query = '';
    let params = [];

    if (useVector === 'true' && embeddingService) {
      // Vector similarity search
      try {
        const queryEmbedding = await embeddingService.generateEmbedding(searchQuery);
        if (queryEmbedding) {
          query = `
            SELECT uuid, title, content, summary, category,
                   confidence_score, source, metadata,
                   created_by, created_at, updated_at,
                   (embedding <=> $1::vector) as similarity
            FROM knowledge_base
            WHERE embedding IS NOT NULL
          `;
          params = [`[${queryEmbedding.join(',')}]`];

          if (category) {
            query += ' AND category = $2';
            params.push(category);
          }

          query += ' ORDER BY similarity ASC LIMIT 20';
        }
      } catch (error) {
        console.warn('Vector search failed, falling back to text search:', error.message);
      }
    }

    if (!query) {
      // Text search fallback
      query = `
        SELECT uuid, title, content, summary, category,
               confidence_score, source, metadata,
               created_by, created_at, updated_at
        FROM knowledge_base
        WHERE search_vector @@ websearch_to_tsquery('portuguese', $1)
           OR title ILIKE $2
           OR content ILIKE $2
           OR summary ILIKE $2
      `;
      params = [searchQuery, `%${searchQuery}%`];

      if (category) {
        query += ' AND category = $3';
        params.push(category);
      }

      query +=
        " ORDER BY ts_rank(search_vector, websearch_to_tsquery('portuguese', $1)) DESC LIMIT 20";
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

// Create knowledge base entry
app.post('/api/knowledge', async (req, res) => {
  try {
    const { title, content, summary, category, source, confidence_score } = req.body;

    const query = `
      INSERT INTO knowledge_base (
        title, content, summary, category,
        confidence_score, source, metadata, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await db.query(query, [
      title,
      content,
      summary || '',
      category || 'General',
      confidence_score || 0.9,
      source || 'manual',
      JSON.stringify({}),
      'user',
    ]);

    const entry = result.rows[0];

    // Generate embedding if service available
    if (embeddingService && content) {
      try {
        const embedding = await embeddingService.generateEmbedding(
          `${title} ${content} ${summary || ''}`
        );
        if (embedding) {
          await db.query('UPDATE knowledge_base SET embedding = $1 WHERE uuid = $2', [
            `[${embedding.join(',')}]`,
            entry.uuid,
          ]);
        }
      } catch (error) {
        console.warn('Failed to generate embedding:', error.message);
      }
    }

    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating knowledge base entry:', error);
    res.status(500).json({ error: 'Failed to create knowledge base entry' });
  }
});

// Update knowledge base entry
app.put('/api/knowledge/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { title, content, summary, category, confidence_score } = req.body;

    const query = `
      UPDATE knowledge_base
      SET title = $1, content = $2, summary = $3, category = $4,
          confidence_score = $5, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $6
      RETURNING *
    `;

    const result = await db.query(query, [
      title,
      content,
      summary || '',
      category || 'General',
      confidence_score || 0.9,
      uuid,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Knowledge base entry not found' });
    }

    const entry = result.rows[0];

    // Update embedding if service available
    if (embeddingService && content) {
      try {
        const embedding = await embeddingService.generateEmbedding(
          `${title} ${content} ${summary || ''}`
        );
        if (embedding) {
          await db.query('UPDATE knowledge_base SET embedding = $1 WHERE uuid = $2', [
            `[${embedding.join(',')}]`,
            entry.uuid,
          ]);
        }
      } catch (error) {
        console.warn('Failed to update embedding:', error.message);
      }
    }

    res.json(entry);
  } catch (error) {
    console.error('Error updating knowledge base entry:', error);
    res.status(500).json({ error: 'Failed to update knowledge base entry' });
  }
});

// Delete knowledge base entry
app.delete('/api/knowledge/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await db.query('DELETE FROM knowledge_base WHERE uuid = $1', [uuid]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Knowledge base entry not found' });
    }

    res.json({ message: 'Knowledge base entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge base entry:', error);
    res.status(500).json({ error: 'Failed to delete knowledge base entry' });
  }
});

// Get knowledge base categories
app.get('/api/knowledge/categories', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT category, COUNT(*) as count
      FROM knowledge_base
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Fallback for unmatched API routes
// app.all('/api/(.*)', (req, res) => {
//   res.status(404).json({ error: 'Endpoint not found' });
// });

// Start server
async function startServer() {
  try {
    await db.connect();

    app.listen(PORT, () => {
      console.log(`🚀 PostgreSQL-only server running on http://localhost:${PORT}`);
      console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
      console.log(`💾 Database: PostgreSQL (${pgConfig.database})`);
      console.log(`🧠 Vector search: ${embeddingService ? 'Enabled' : 'Disabled'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

startServer();
