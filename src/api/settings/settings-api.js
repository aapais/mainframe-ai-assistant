const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

// PostgreSQL connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
  ssl: process.env.DB_SSL === 'true',
});

// Encryption key for API keys (use environment variable in production)
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'default_key_change_in_production';

// Create a 32-byte key from the encryption key
const getKey = () => {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

// Utility functions for encryption/decryption
const encrypt = text => {
  const iv = crypto.randomBytes(16);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = encryptedText => {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      // Try legacy decryption for old format
      const key = getKey();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16));
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = getKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn('Failed to decrypt:', error.message);
    return null;
  }
};

// GET /api/settings/:userId - Get or create default settings
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get or create settings using the database function
    const result = await pool.query('SELECT * FROM get_or_create_user_settings($1)', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const settings = result.rows[0];

    // Get API keys from the dedicated api_keys table
    const keysQuery = `
      SELECT service, key_encrypted, masked
      FROM api_keys
      WHERE user_id = $1 AND is_active = true
      ORDER BY service
    `;
    const keysResult = await pool.query(keysQuery, [userId]);

    // Build API keys object with decrypted values
    const apiKeys = {};
    if (keysResult.rows && keysResult.rows.length > 0) {
      for (const row of keysResult.rows) {
        try {
          // Return masked version for display (shows only last 4 characters)
          apiKeys[row.service] = row.masked || '••••••••';
        } catch (error) {
          console.warn(`Failed to process API key for service ${row.service}:`, error.message);
          apiKeys[row.service] = '';
        }
      }
    }

    // Add API keys to settings response
    settings.api_keys = apiKeys;

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({
      error: 'Failed to retrieve settings',
      message: error.message,
    });
  }
});

// PUT /api/settings/:userId - Update settings (partial updates allowed)
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Validate userId
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Validate update fields
    const allowedFields = [
      'theme',
      'language',
      'locale',
      'display_density',
      'sidebar_collapsed',
      'show_line_numbers',
      'font_size',
      'notifications',
      'recent_searches_limit',
      'search_history_enabled',
      'auto_save',
      'auto_save_interval',
      'export_format',
      'api_keys',
      'enable_shortcuts',
      'keyboard_shortcuts',
      'enable_animations',
      'cache_enabled',
      // Advanced Settings - API Configuration
      'api_rate_limit',
      'api_timeout',
      // Advanced Settings - Security Configuration
      'force_https',
      'enable_audit_trail',
      'session_timeout',
      // Advanced Settings - Developer Options
      'debug_mode',
      'verbose_console',
      'enable_devtools',
    ];

    // Filter out invalid fields
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Handle API keys separately - store in dedicated api_keys table
    let apiKeysToUpdate = null;
    if (validUpdates.api_keys) {
      apiKeysToUpdate = validUpdates.api_keys;
      delete validUpdates.api_keys; // Remove from main settings update
    }

    // Convert JSON fields to strings
    ['notifications', 'keyboard_shortcuts'].forEach(field => {
      if (validUpdates[field] && typeof validUpdates[field] === 'object') {
        validUpdates[field] = JSON.stringify(validUpdates[field]);
      }
    });

    // Build dynamic UPDATE query
    const setClause = Object.keys(validUpdates)
      .map((key, index) => {
        return `${key} = $${index + 2}`;
      })
      .join(', ');

    const query = `
            UPDATE user_settings 
            SET ${setClause}
            WHERE user_id = $1
            RETURNING *
        `;

    // Update main settings if there are fields to update
    let result;
    if (Object.keys(validUpdates).length > 0) {
      const values = [userId, ...Object.values(validUpdates)];
      result = await pool.query(query, values);
    } else {
      // If only API keys are being updated, just fetch current settings
      result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found for user' });
    }

    const updatedSettings = result.rows[0];

    // Update API keys in the dedicated table if provided
    if (apiKeysToUpdate) {
      for (const [service, key] of Object.entries(apiKeysToUpdate)) {
        if (key && key !== '' && !key.includes('•')) { // Only update if not masked
          // Encrypt the key
          const encryptedKey = encrypt(key);
          // Create masked version (show last 4 characters)
          const masked = key.length > 4 ? '••••' + key.slice(-4) : '••••';

          // Upsert API key
          const upsertQuery = `
            INSERT INTO api_keys (user_id, service, key_encrypted, masked, name, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (user_id, service) DO UPDATE SET
              key_encrypted = EXCLUDED.key_encrypted,
              masked = EXCLUDED.masked,
              last_used = CURRENT_TIMESTAMP,
              is_active = true
          `;

          const keyName = service.charAt(0).toUpperCase() + service.slice(1) + ' API Key';
          await pool.query(upsertQuery, [userId, service, encryptedKey, masked, keyName]);
        } else if (key === null || key === '') {
          // Delete API key if set to null or empty
          await pool.query(
            'DELETE FROM api_keys WHERE user_id = $1 AND service = $2',
            [userId, service]
          );
        }
      }
    }

    // Fetch updated API keys for response
    const keysQuery = `
      SELECT service, masked
      FROM api_keys
      WHERE user_id = $1 AND is_active = true
      ORDER BY service
    `;
    const keysResult = await pool.query(keysQuery, [userId]);

    const apiKeys = {};
    if (keysResult.rows) {
      keysResult.rows.forEach(row => {
        apiKeys[row.service] = row.masked || '••••••••';
      });
    }
    updatedSettings.api_keys = apiKeys;

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message,
    });
  }
});

// POST /api/settings/:userId/reset - Reset to defaults
router.post('/:userId/reset', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Delete existing settings and recreate with defaults
    await pool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);

    // Also delete all API keys for this user
    await pool.query('DELETE FROM api_keys WHERE user_id = $1', [userId]);

    // Create new default settings
    const result = await pool.query('SELECT * FROM get_or_create_user_settings($1)', [userId]);

    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to create default settings' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Settings reset to defaults successfully',
    });
  } catch (error) {
    console.error('Error resetting user settings:', error);
    res.status(500).json({
      error: 'Failed to reset settings',
      message: error.message,
    });
  }
});

// GET /api/settings/:userId/export - Export as JSON
router.get('/:userId/export', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const settings = result.rows[0];

    // Remove sensitive data for export
    const exportData = {
      ...settings,
      api_keys: {}, // Don't export API keys for security
      id: undefined,
      user_id: undefined,
      created_at: undefined,
      updated_at: undefined,
    };

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="settings-${userId}-${Date.now()}.json"`
    );

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting user settings:', error);
    res.status(500).json({
      error: 'Failed to export settings',
      message: error.message,
    });
  }
});

// POST /api/settings/:userId/import - Import from JSON
router.post('/:userId/import', async (req, res) => {
  try {
    const { userId } = req.params;
    const importData = req.body;

    // Validate userId
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Validate import data structure
    if (!importData || typeof importData !== 'object') {
      return res.status(400).json({ error: 'Invalid import data' });
    }

    // Filter valid fields for import (exclude sensitive/system fields)
    const allowedFields = [
      'theme',
      'language',
      'locale',
      'display_density',
      'sidebar_collapsed',
      'show_line_numbers',
      'font_size',
      'notifications',
      'recent_searches_limit',
      'search_history_enabled',
      'auto_save',
      'auto_save_interval',
      'export_format',
      'enable_shortcuts',
      'keyboard_shortcuts',
      'enable_animations',
      'cache_enabled',
      // Advanced Settings - API Configuration
      'api_rate_limit',
      'api_timeout',
      // Advanced Settings - Security Configuration
      'force_https',
      'enable_audit_trail',
      'session_timeout',
      // Advanced Settings - Developer Options
      'debug_mode',
      'verbose_console',
      'enable_devtools',
    ];

    const validImportData = {};
    for (const [key, value] of Object.entries(importData)) {
      if (allowedFields.includes(key)) {
        validImportData[key] = value;
      }
    }

    if (Object.keys(validImportData).length === 0) {
      return res.status(400).json({ error: 'No valid settings found in import data' });
    }

    // Convert JSON fields to strings
    ['notifications', 'keyboard_shortcuts'].forEach(field => {
      if (validImportData[field] && typeof validImportData[field] === 'object') {
        validImportData[field] = JSON.stringify(validImportData[field]);
      }
    });

    // Build dynamic UPDATE query
    const setClause = Object.keys(validImportData)
      .map((key, index) => {
        return `${key} = $${index + 2}`;
      })
      .join(', ');

    const query = `
            UPDATE user_settings 
            SET ${setClause}
            WHERE user_id = $1
            RETURNING *
        `;

    const values = [userId, ...Object.values(validImportData)];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found for user' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Successfully imported ${Object.keys(validImportData).length} settings`,
      imported_fields: Object.keys(validImportData),
    });
  } catch (error) {
    console.error('Error importing user settings:', error);
    res.status(500).json({
      error: 'Failed to import settings',
      message: error.message,
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
