/**
 * PostgreSQL-Only Backend Server
 * Simplified version without SQLite dependency
 */

const express = require('express');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs').promises;
const EmbeddingService = require('../services/embedding-service');
const MultiEmbeddingService = require('../services/multi-embedding-service');
const documentProcessorRouter = require('./document-processor-api');
// const settingsRouter = require('../api/settings/settings-api');  // Commented out - using local routes instead
const { WindowsAuthService } = require('../auth/WindowsAuthService');
const cryptoService = require('../services/crypto-service');
const { chatRouter, initializeChatRoutes } = require('./routes/chatRoutes');
const { authenticateUser } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5433,
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'mainframe_ai',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'mainframe_user',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'mainframe_pass',
};

// Initialize services
let embeddingService = null;
let windowsAuthService = null;

// Initialize Windows Auth Service
windowsAuthService = new WindowsAuthService();

// Initialize embedding service - will be created per-request with user's API keys
// No hardcoded keys or environment variables should be used here
embeddingService = null;
console.log('🔐 Embedding service will be initialized per-request with user credentials');

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

// Document processor routes (the /process route has its own authentication)
app.use('/api/documents', documentProcessorRouter);

// Settings API routes
// app.use('/api/settings', settingsRouter);  // Commented out - using local routes instead

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';

// Function to generate JWT token
function generateJWTToken(user) {
  return jwt.sign(
    {
      id: user.id || user.user_id,
      email: user.email,
      username: user.username,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Windows Authentication Routes
app.post('/api/auth/windows/login', async (req, res) => {
  try {
    const result = await windowsAuthService.loginWithWindows();

    // Ensure user exists in the database
    if (result.success && result.user) {
      // Check if user already exists by email ONLY (email is the unique identifier)
      let existingUser = null;

      // Check by email - this is the ONLY way to identify users
      if (result.user.email) {
        const emailCheck = await db.query(
          'SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1)',
          [result.user.email]
        );
        if (emailCheck.rows.length > 0) {
          existingUser = emailCheck.rows[0];
          console.log(`Found existing user by email: ${existingUser.email}`);
        }
      }

      // Use existing user ID if found, otherwise use the generated one
      const userId = existingUser ? existingUser.id : result.user.id;

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
          userId, // Use the existing user ID if found
          result.user.username,
          existingUser ? existingUser.email : result.user.email, // Keep existing email if found
          result.user.displayName || result.user.username,
          result.user.domain,
          result.user.computer,
          'user',
        ]);
        console.log(`User ${result.user.username} synced to database (ID: ${userId})`);

        // Update the result with the correct user ID for the token
        result.user.id = userId;
      } catch (dbError) {
        console.error('Error syncing user to database:', dbError);
        // Continue even if database sync fails
      }

      // Try to load user settings/preferences from database
      try {
        const settingsQuery = `
          SELECT * FROM user_preferences WHERE user_id = $1
        `;
        const settingsResult = await db.query(settingsQuery, [userId]);

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
            email: settings.email,
          };

          // Merge with settings_json if it exists
          if (settings.settings_json) {
            try {
              const savedSettings =
                typeof settings.settings_json === 'string'
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

      // Generate JWT token for the authenticated user
      const token = generateJWTToken({
        id: result.user.id || result.user.user_id,
        email: result.user.email,
        username: result.user.username,
        role: result.user.role
      });

      // Add token to result
      result.token = token;
    }

    res.json(result);
  } catch (error) {
    console.error('Windows auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
});

app.get('/api/auth/windows/current', (req, res) => {
  try {
    const userInfo = windowsAuthService.getCurrentWindowsUser();
    res.json({
      success: true,
      user: userInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
      email: `${userInfo.username}@local.local`, // Fixed email format to avoid hostname variations
      displayName: userInfo.username,
      preferences: {
        theme: 'light',
        language: 'pt',
        notifications: true,
      },
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
        ...updates,
      },
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
      await db.query(
        `
        INSERT INTO users (id, username, email, display_name, created_at)
        VALUES ($1, $2, $3, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `,
        [userId, 'user_' + userId.substring(0, 8), userId + '@local']
      );

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
        JSON.stringify(prefs),
      ]);
    }

    res.json({
      success: true,
      user: {
        id: userId,
        ...updates,
      },
    });
  } catch (error) {
    console.error('Error patching user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// API Keys Management Routes
app.get('/api/keys/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get all API keys for user (decrypted)
    const query = `
      SELECT id, name, service, masked, created_at, last_used, is_active
      FROM api_keys
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [userId]);

    res.json({
      success: true,
      keys: result.rows
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

app.post('/api/keys/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { openai, anthropic, google } = req.body.api_keys || {};

    // First, ensure user exists in users table
    const userExistsQuery = `
      INSERT INTO users (id, username, display_name, email, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(userExistsQuery, [
      userId,
      `user_${userId.substring(0, 8)}`,
      `User ${userId.substring(0, 8)}`,
      `${userId}@temp.local`
    ]);

    // Process each API key
    const services = [
      { service: 'openai', key: openai, name: 'OpenAI API Key' },
      { service: 'anthropic', key: anthropic, name: 'Anthropic API Key' },
      { service: 'google', key: google, name: 'Google AI API Key' }
    ];

    for (const { service, key, name } of services) {
      if (!key) continue;

      // Encrypt the API key
      const encrypted = cryptoService.encrypt(key);
      const masked = cryptoService.maskApiKey(key);

      // Check if key exists for this service
      const existsQuery = `
        SELECT id FROM api_keys
        WHERE user_id = $1 AND service = $2
      `;
      const existing = await db.query(existsQuery, [userId, service]);

      if (existing.rows.length > 0) {
        // Update existing key
        const updateQuery = `
          UPDATE api_keys
          SET key_encrypted = $1, masked = $2, last_used = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND service = $4
        `;
        await db.query(updateQuery, [encrypted, masked, userId, service]);
      } else {
        // Insert new key
        const insertQuery = `
          INSERT INTO api_keys (user_id, name, service, key_encrypted, masked)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await db.query(insertQuery, [userId, name, service, encrypted, masked]);
      }
    }

    // Also update settings_json to remove plain text keys
    const updateSettingsQuery = `
      UPDATE user_settings
      SET settings_json = jsonb_set(
        COALESCE(settings_json, '{}'::jsonb),
        '{api_keys}',
        '{"secured": true}'::jsonb
      )
      WHERE user_id = $1
    `;
    await db.query(updateSettingsQuery, [userId]);

    res.json({
      success: true,
      message: 'API keys armazenadas com segurança e criptografia'
    });
  } catch (error) {
    console.error('Error saving API keys:', error);

    // Provide detailed error messages
    let errorMessage = 'Erro ao gravar API keys';
    let errorDetails = '';

    if (error.code === '23503') {
      // Foreign key constraint violation
      if (error.constraint === 'api_keys_user_id_fkey') {
        errorMessage = 'Utilizador não encontrado';
        errorDetails = 'Por favor, faça login novamente antes de configurar as API keys.';
      }
    } else if (error.code === '23505') {
      // Unique constraint violation
      errorMessage = 'API key já existe';
      errorDetails = 'Esta API key já foi configurada para este utilizador.';
    } else if (error.message && error.message.includes('encrypt')) {
      errorMessage = 'Erro na criptografia';
      errorDetails = 'Não foi possível criptografar a API key. Verifique se a chave está no formato correto.';
    }

    res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Deactivate specific API key (soft delete)
app.delete('/api/keys/:userId/:service', async (req, res) => {
  try {
    const { userId, service } = req.params;

    const deactivateQuery = `
      UPDATE api_keys
      SET is_active = false, last_used = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND service = $2 AND is_active = true
      RETURNING id, service, masked
    `;

    const result = await db.query(deactivateQuery, [userId, service]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: `API key ${service} inativada com sucesso`,
        details: `Chave ${result.rows[0].masked} foi inativada (pode ser reativada posteriormente)`,
        deactivated: result.rows[0]
      });
    } else {
      res.status(404).json({
        error: 'API key não encontrada',
        details: `Nenhuma chave ${service} ativa encontrada para este utilizador`
      });
    }
  } catch (error) {
    console.error('Error deactivating API key:', error);
    res.status(500).json({
      error: 'Erro ao inativar API key',
      details: error.message
    });
  }
});

// Deactivate ALL API keys for user (soft delete all)
app.delete('/api/keys/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const deactivateAllQuery = `
      UPDATE api_keys
      SET is_active = false, last_used = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_active = true
      RETURNING service, masked
    `;

    const result = await db.query(deactivateAllQuery, [userId]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: 'Todas as API keys foram inativadas',
        details: `${result.rows.length} chave(s) inativada(s). Podem ser reativadas posteriormente.`,
        deactivated: result.rows.map(row => ({ service: row.service, masked: row.masked }))
      });
    } else {
      res.json({
        success: true,
        message: 'Nenhuma API key ativa para inativar',
        details: 'Não foram encontradas chaves ativas para este utilizador'
      });
    }
  } catch (error) {
    console.error('Error deactivating all API keys:', error);
    res.status(500).json({
      error: 'Erro ao inativar API keys',
      details: error.message
    });
  }
});

// Reactivate specific API key
app.patch('/api/keys/:userId/:service/reactivate', async (req, res) => {
  try {
    const { userId, service } = req.params;

    const reactivateQuery = `
      UPDATE api_keys
      SET is_active = true, last_used = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND service = $2 AND is_active = false
      RETURNING id, service, masked
    `;

    const result = await db.query(reactivateQuery, [userId, service]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: `API key ${service} reativada com sucesso`,
        details: `Chave ${result.rows[0].masked} está novamente ativa`,
        reactivated: result.rows[0]
      });
    } else {
      res.status(404).json({
        error: 'API key não encontrada',
        details: `Nenhuma chave ${service} inativa encontrada para reativar`
      });
    }
  } catch (error) {
    console.error('Error reactivating API key:', error);
    res.status(500).json({
      error: 'Erro ao reativar API key',
      details: error.message
    });
  }
});

app.get('/api/keys/:userId/decrypt', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get encrypted keys and decrypt them
    const query = `
      SELECT service, key_encrypted
      FROM api_keys
      WHERE user_id = $1 AND is_active = true
    `;

    const result = await db.query(query, [userId]);

    const decryptedKeys = {};
    for (const row of result.rows) {
      try {
        decryptedKeys[row.service] = cryptoService.decrypt(row.key_encrypted);
      } catch (err) {
        console.error(`Failed to decrypt key for ${row.service}:`, err);
        decryptedKeys[row.service] = '';
      }
    }

    res.json({
      success: true,
      api_keys: decryptedKeys
    });
  } catch (error) {
    console.error('Error decrypting API keys:', error);
    res.status(500).json({ error: 'Failed to decrypt API keys' });
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
          const jsonSettings =
            typeof settings.settings_json === 'string'
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
        settings: settings,
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
          session_timeout: 28800,
        },
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
      const notificationsValue =
        typeof settings.notifications === 'object'
          ? true // Default to true if we have a complex object
          : settings.notifications !== undefined
            ? settings.notifications
            : true;

      // Include the full notifications object in settings_json
      const fullSettings = {
        ...settings,
        notifications: settings.notifications || true,
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
        JSON.stringify(fullSettings),
      ]);

      res.json({
        success: true,
        settings: result.rows[0],
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
        JSON.stringify(settings),
      ]);

      res.json({
        success: true,
        settings: result.rows[0],
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
        is_active: true,
      },
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
        source: 'Backend',
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        level: 'WARNING',
        message: 'High memory usage detected',
        source: 'Monitor',
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        level: 'ERROR',
        message: 'Failed to connect to external service',
        source: 'API',
      },
    ];

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Simple chat endpoint with JWT authentication
app.post('/api/chat/simple', authenticateUser, async (req, res) => {
  try {
    const { message, content } = req.body;
    const messageText = message || content; // Support both field names
    const userId = req.user.id; // Get from authenticated user

    if (!messageText) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get API keys from database
    const keysQuery = `
      SELECT service, key_encrypted
      FROM api_keys
      WHERE user_id = $1 AND is_active = true
    `;

    const keysResult = await db.query(keysQuery, [userId]);
    const apiKeys = {};

    for (const row of keysResult.rows) {
      const decryptedKey = cryptoService.decrypt(row.key_encrypted);
      if (row.service === 'google') {
        apiKeys.gemini_api_key = decryptedKey;
      } else if (row.service === 'openai') {
        apiKeys.openai_api_key = decryptedKey;
      }
    }

    // Use Gemini API if available
    if (apiKeys.gemini_api_key) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKeys.gemini_api_key);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const result = await model.generateContent(messageText);
      const response = result.response.text();

      return res.json({
        success: true,
        response: response,
        provider: 'gemini'
      });
    } else if (apiKeys.openai_api_key) {
      // Fallback to OpenAI if Gemini not available
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: apiKeys.openai_api_key });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: messageText }],
      });

      return res.json({
        success: true,
        response: completion.choices[0].message.content,
        provider: 'openai'
      });
    } else {
      return res.status(400).json({
        error: 'No API keys configured. Please configure Gemini or OpenAI API keys in settings.'
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      details: error.message
    });
  }
});

// Initialize chat routes
initializeChatRoutes(db, embeddingService, null); // Will initialize RAGService later

// Mount chat routes
app.use('/api/chat', chatRouter);

// Fallback for unmatched API routes
// app.all('/api/(.*)', (req, res) => {
//   res.status(404).json({ error: 'Endpoint not found' });
// });

// Start server
async function startServer() {
  try {
    await db.connect();

    // Setup RAG chat endpoint
    const { setupRAGChatRoute } = require('./routes/chat-rag-route');
    await setupRAGChatRoute(app, db, authenticateUser);

    app.listen(PORT, () => {
      console.log(`🚀 PostgreSQL-only server running on http://localhost:${PORT}`);
      console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
      console.log(`💾 Database: PostgreSQL (${pgConfig.database})`);
      console.log(`🧠 Vector search: ${embeddingService ? 'Enabled' : 'Disabled'}`);
      console.log(`📚 RAG endpoint: http://localhost:${PORT}/api/chat/rag`);
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
