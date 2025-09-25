const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

// PostgreSQL connection configuration
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'mainframe_ai',
    user: 'mainframe_user',
    password: 'mainframe_pass',
    ssl: false
});

// Encryption key for API keys (use environment variable in production)
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'default_key_change_in_production';

// Utility functions for encryption/decryption
const encrypt = (text) => {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

const decrypt = (encryptedText) => {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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
        
        // Decrypt API keys if they exist
        if (settings.api_keys && Object.keys(settings.api_keys).length > 0) {
            const decryptedKeys = {};
            for (const [key, value] of Object.entries(settings.api_keys)) {
                try {
                    decryptedKeys[key] = value ? decrypt(value) : '';
                } catch (error) {
                    console.warn(`Failed to decrypt API key ${key}:`, error.message);
                    decryptedKeys[key] = '';
                }
            }
            settings.api_keys = decryptedKeys;
        }

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error getting user settings:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve settings',
            message: error.message 
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
            'theme', 'language', 'locale', 'display_density', 'sidebar_collapsed',
            'show_line_numbers', 'font_size', 'notifications', 'recent_searches_limit',
            'search_history_enabled', 'auto_save', 'auto_save_interval', 'export_format',
            'api_keys', 'enable_shortcuts', 'keyboard_shortcuts', 'enable_animations',
            'cache_enabled',
            // Advanced Settings - API Configuration
            'api_rate_limit', 'api_timeout',
            // Advanced Settings - Security Configuration
            'force_https', 'enable_audit_trail', 'session_timeout',
            // Advanced Settings - Developer Options
            'debug_mode', 'verbose_console', 'enable_devtools'
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

        // Encrypt API keys if provided
        if (validUpdates.api_keys) {
            const encryptedKeys = {};
            for (const [key, value] of Object.entries(validUpdates.api_keys)) {
                encryptedKeys[key] = value ? encrypt(value) : null;
            }
            validUpdates.api_keys = JSON.stringify(encryptedKeys);
        }

        // Convert JSON fields to strings
        ['notifications', 'keyboard_shortcuts'].forEach(field => {
            if (validUpdates[field] && typeof validUpdates[field] === 'object') {
                validUpdates[field] = JSON.stringify(validUpdates[field]);
            }
        });

        // Build dynamic UPDATE query
        const setClause = Object.keys(validUpdates).map((key, index) => {
            return `${key} = $${index + 2}`;
        }).join(', ');

        const query = `
            UPDATE user_settings 
            SET ${setClause}
            WHERE user_id = $1
            RETURNING *
        `;

        const values = [userId, ...Object.values(validUpdates)];
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Settings not found for user' });
        }

        const updatedSettings = result.rows[0];
        
        // Decrypt API keys for response
        if (updatedSettings.api_keys && Object.keys(updatedSettings.api_keys).length > 0) {
            const decryptedKeys = {};
            for (const [key, value] of Object.entries(updatedSettings.api_keys)) {
                try {
                    decryptedKeys[key] = value ? decrypt(value) : '';
                } catch (error) {
                    console.warn(`Failed to decrypt API key ${key}:`, error.message);
                    decryptedKeys[key] = '';
                }
            }
            updatedSettings.api_keys = decryptedKeys;
        }

        res.json({
            success: true,
            data: updatedSettings,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ 
            error: 'Failed to update settings',
            message: error.message 
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
        
        // Create new default settings
        const result = await pool.query('SELECT * FROM get_or_create_user_settings($1)', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(500).json({ error: 'Failed to create default settings' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Settings reset to defaults successfully'
        });
    } catch (error) {
        console.error('Error resetting user settings:', error);
        res.status(500).json({ 
            error: 'Failed to reset settings',
            message: error.message 
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
            updated_at: undefined
        };

        // Set appropriate headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="settings-${userId}-${Date.now()}.json"`);
        
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting user settings:', error);
        res.status(500).json({ 
            error: 'Failed to export settings',
            message: error.message 
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
            'theme', 'language', 'locale', 'display_density', 'sidebar_collapsed',
            'show_line_numbers', 'font_size', 'notifications', 'recent_searches_limit',
            'search_history_enabled', 'auto_save', 'auto_save_interval', 'export_format',
            'enable_shortcuts', 'keyboard_shortcuts', 'enable_animations', 'cache_enabled',
            // Advanced Settings - API Configuration
            'api_rate_limit', 'api_timeout',
            // Advanced Settings - Security Configuration
            'force_https', 'enable_audit_trail', 'session_timeout',
            // Advanced Settings - Developer Options
            'debug_mode', 'verbose_console', 'enable_devtools'
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
        const setClause = Object.keys(validImportData).map((key, index) => {
            return `${key} = $${index + 2}`;
        }).join(', ');

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
            imported_fields: Object.keys(validImportData)
        });
    } catch (error) {
        console.error('Error importing user settings:', error);
        res.status(500).json({ 
            error: 'Failed to import settings',
            message: error.message 
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
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
