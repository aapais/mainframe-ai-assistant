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
// const settingsRouter = require('../api/settings/settings-api');  // Commented out - using local routes instead
const { WindowsAuthService } = require('../auth/WindowsAuthService');
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
let windowsAuthService = null;

// Initialize Windows Auth Service
windowsAuthService = new WindowsAuthService();

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
// app.use('/api/settings', settingsRouter);  // Commented out - using local routes instead

// Windows Authentication Routes
app.post('/api/auth/windows/login', async (req, res) => {
  try {
    const result = await windowsAuthService.loginWithWindows();

    // Ensure user exists in the database
    if (result.success && result.user) {
      const userQuery = `
        INSERT INTO users (id, username, email, display_name, domain, computer, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET username = $2,
            email = $3,
            display_name = $4,
            domain = $5,
            computer = $6,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      try {
        await db.query(userQuery, [
          result.user.id,
          result.user.username,
          result.user.email,
          result.user.displayName || result.user.username,
          result.user.domain,
          result.user.computer,
          'user'
        ]);
        console.log(`User ${result.user.username} synced to database`);
      } catch (dbError) {
        console.error('Error syncing user to database:', dbError);
        // Continue even if database sync fails
      }

      // Try to load user settings/preferences from database
      try {
        const settingsQuery = `
          SELECT * FROM user_preferences WHERE user_id = $1
        `;
        const settingsResult = await db.query(settingsQuery, [result.user.id]);

        if (settingsResult.rows.length > 0) {
          const settings = settingsResult.rows[0];

          // Create a complete settings object from database columns
          const completeSettings = {
            theme: settings.theme || 'light',
            language: settings.language || 'pt-BR',
            notifications: settings.notifications !== undefined ? settings.notifications : true,
            auto_login: settings.auto_login !== undefined ? settings.auto_login : true,
            session_timeout: settings.session_timeout || 28800,
            display_name: settings.display_name,
            email: settings.email
          };

          // Merge with settings_json if it exists
          if (settings.settings_json) {
            try {
              const savedSettings = typeof settings.settings_json === 'string'
                ? JSON.parse(settings.settings_json)
                : settings.settings_json;

              console.log('Loaded settings_json:', savedSettings);

              // Merge savedSettings into completeSettings
              // This overwrites default values with saved advanced settings
              Object.assign(completeSettings, savedSettings);
            } catch (parseError) {
              console.error('Error parsing settings_json:', parseError);
            }
          }

          // Add all settings to the user object
          result.user.settings = completeSettings;

          // Also set display_name and email on user object directly
          if (completeSettings.display_name) {
            result.user.displayName = completeSettings.display_name;
            result.user.display_name = completeSettings.display_name;
          }
          if (completeSettings.email) {
            result.user.email = completeSettings.email;
          }

          // Set theme and language on user for immediate use
          if (completeSettings.theme) {
            result.user.theme = completeSettings.theme;
          }
          if (completeSettings.language) {
            result.user.language = completeSettings.language;
          }
        }
      } catch (settingsError) {
        console.error('Error loading user settings:', settingsError);
        // Continue even if settings load fails
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Windows auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
});

app.get('/api/auth/windows/current', (req, res) => {
  try {
    const userInfo = windowsAuthService.getCurrentWindowsUser();
    res.json({
      success: true,
      user: userInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// User Routes
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // For now, return mock user data based on Windows auth
    const userInfo = windowsAuthService.getCurrentWindowsUser();

    res.json({
      id: userId,
      username: userInfo.username,
      email: `${userInfo.username}@${userInfo.domain}.local`,
      displayName: userInfo.username,
      preferences: {
        theme: 'light',
        language: 'pt',
        notifications: true
      },
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    console.log('Updating user:', userId, updates);

    // For now, just return success
    // In production, save to database
    res.json({
      success: true,
      user: {
        id: userId,
        ...updates
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    console.log('Patching user:', userId, updates);

    // Save preferences to database if provided
    if (updates.preferences) {
      // First ensure user exists in users table
      await db.query(`
        INSERT INTO users (id, username, email, display_name, created_at)
        VALUES ($1, $2, $3, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `, [userId, 'user_' + userId.substring(0, 8), userId + '@local']);

      const query = `
        INSERT INTO user_settings (user_id, theme, language, notifications, settings_json)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE
        SET theme = COALESCE($2, user_settings.theme),
            language = COALESCE($3, user_settings.language),
            notifications = COALESCE($4, user_settings.notifications),
            settings_json = COALESCE($5, user_settings.settings_json),
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const prefs = updates.preferences;
      await db.query(query, [
        userId,
        prefs.theme || 'light',
        prefs.language || 'pt-BR',
        prefs.notifications !== undefined ? prefs.notifications : true,
        JSON.stringify(prefs)
      ]);
    }

    res.json({
      success: true,
      user: {
        id: userId,
        ...updates
      }
    });
  } catch (error) {
    console.error('Error patching user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Settings specific routes
app.get('/api/settings/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check which table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_preferences'
      );
    `;

    const tableCheck = await db.query(checkTableQuery);
    const hasPreferencesTable = tableCheck.rows[0].exists;

    const tableName = hasPreferencesTable ? 'user_preferences' : 'user_settings';
    const query = `SELECT * FROM ${tableName} WHERE user_id = $1`;

    const result = await db.query(query, [userId]);

    if (result.rows.length > 0) {
      let settings = result.rows[0];

      // Parse settings_json if it exists to get complex notification settings
      if (settings.settings_json) {
        try {
          const jsonSettings = typeof settings.settings_json === 'string'
            ? JSON.parse(settings.settings_json)
            : settings.settings_json;

          // If notifications is a complex object in settings_json, use it
          if (jsonSettings.notifications && typeof jsonSettings.notifications === 'object') {
            settings.notifications = jsonSettings.notifications;
          }
        } catch (e) {
          console.error('Error parsing settings_json:', e);
        }
      }

      res.json({
        success: true,
        settings: settings
      });
    } else {
      // Return default settings if none exist
      res.json({
        success: true,
        settings: {
          user_id: userId,
          theme: 'light',
          language: 'pt-BR',
          notifications: true,
          auto_login: true,
          session_timeout: 28800
        }
      });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const settings = req.body;

    // Check if user_preferences table exists (newer schema)
    let tableName = 'user_preferences';
    let checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_preferences'
      );
    `;

    const tableCheck = await db.query(checkTableQuery);
    const hasPreferencesTable = tableCheck.rows[0].exists;

    if (hasPreferencesTable) {
      // Use user_preferences table
      const query = `
        INSERT INTO user_preferences (user_id, theme, language, notifications, auto_login, session_timeout, display_name, email, settings_json, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE
        SET theme = EXCLUDED.theme,
            language = EXCLUDED.language,
            notifications = EXCLUDED.notifications,
            auto_login = EXCLUDED.auto_login,
            session_timeout = EXCLUDED.session_timeout,
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            settings_json = EXCLUDED.settings_json,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      // Handle notifications properly - if it's an object, store it in settings_json
      // If it's a simple boolean, use that for the notifications column
      const notificationsValue = typeof settings.notifications === 'object'
        ? true  // Default to true if we have a complex object
        : (settings.notifications !== undefined ? settings.notifications : true);

      // Include the full notifications object in settings_json
      const fullSettings = {
        ...settings,
        notifications: settings.notifications || true
      };

      const result = await db.query(query, [
        userId,
        settings.theme || 'light',
        settings.language || 'pt-BR',
        notificationsValue,
        settings.auto_login !== undefined ? settings.auto_login : true,
        settings.session_timeout || 28800,
        settings.display_name || settings.userData?.display_name || null,
        settings.email || settings.userData?.email || null,
        JSON.stringify(fullSettings)
      ]);

      res.json({
        success: true,
        settings: result.rows[0]
      });
    } else {
      // Fallback to user_settings table with different approach
      // First, delete existing settings if any
      await db.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);

      // Then insert new settings
      const insertQuery = `
        INSERT INTO user_settings (user_id, theme, language, notifications, auto_login, session_timeout, settings_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        userId,
        settings.theme || 'light',
        settings.language || 'pt-BR',
        settings.notifications !== undefined ? settings.notifications : true,
        settings.auto_login !== undefined ? settings.auto_login : true,
        settings.session_timeout || 28800,
        JSON.stringify(settings)
      ]);

      res.json({
        success: true,
        settings: result.rows[0]
      });
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings', details: error.message });
  }
});

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

// Sessions endpoint
app.get('/api/sessions/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // For now, return mock sessions data
    // In production, this would query from a sessions table
    const sessions = [
      {
        session_id: 'session-' + Date.now(),
        user_id: userId,
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'Unknown',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 28800000).toISOString(), // 8 hours
        is_active: true
      }
    ];

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Logs endpoint
app.get('/api/logs', async (req, res) => {
  try {
    // For now, return mock logs data
    // In production, this would query from a logs table
    const logs = [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'System started successfully',
        source: 'Backend'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        level: 'WARNING',
        message: 'High memory usage detected',
        source: 'Monitor'
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        level: 'ERROR',
        message: 'Failed to connect to external service',
        source: 'API'
      }
    ];

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
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
