const express = require('express');
const { SecureKeyManager } = require('../../../auth/services/SecureKeyManager');
const { authMiddleware } = require('../../middleware/auth');
const { Logger } = require('../../../utils/Logger');
const { userPreferencesSchema } = require('../../validators/userValidators');

const router = express.Router();
const logger = new Logger('PreferencesAPI');

// Apply auth middleware
router.use(authMiddleware);

// Validation middleware
const validateRequest = (schema) => async (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }
    req.validatedData = result.data;
    next();
  } catch (error) {
    logger.error('Erro na validação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de validação'
    });
  }
};

class PreferencesService {
  constructor() {
    this.keyManager = SecureKeyManager.getInstance();
  }

  async getUserPreferences(userId) {
    try {
      // In a real implementation, this would query the database
      // For now, return default preferences
      const defaultPreferences = {
        userId,
        theme: 'auto',
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        notifications: {
          email: true,
          push: true,
          inApp: true,
          incidents: true,
          systemAlerts: true,
          weeklyReports: false
        },
        searchSettings: {
          resultsPerPage: 20,
          enableAI: true,
          enableAutoComplete: true,
          saveSearchHistory: true
        },
        securitySettings: {
          sessionTimeout: 3600,
          requireMFA: false,
          loginNotifications: true,
          suspiciousActivityAlerts: true
        },
        dashboardSettings: {
          layout: 'grid',
          widgetsEnabled: ['incidents', 'analytics', 'recent-activity'],
          refreshInterval: 300
        },
        updatedAt: new Date()
      };

      return defaultPreferences;
    } catch (error) {
      logger.error(`Erro ao buscar preferências do usuário ${userId}:`, error);
      throw error;
    }
  }

  async updateUserPreferences(userId, preferences) {
    try {
      // Encrypt sensitive preferences
      const sensitiveFields = ['securitySettings', 'notifications'];
      const encryptedPreferences = { ...preferences };

      for (const field of sensitiveFields) {
        if (encryptedPreferences[field]) {
          // In a real implementation, use SecureKeyManager to encrypt
          encryptedPreferences[field] = this.encryptData(encryptedPreferences[field]);
        }
      }

      // Store in database with encryption
      await this.storeEncryptedPreferences(userId, encryptedPreferences);

      logger.info(`Preferências atualizadas para usuário: ${userId}`);

      // Return unencrypted preferences
      return {
        userId,
        ...preferences,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Erro ao atualizar preferências do usuário ${userId}:`, error);
      throw error;
    }
  }

  async resetUserPreferences(userId) {
    try {
      const defaultPreferences = await this.getUserPreferences(userId);
      await this.updateUserPreferences(userId, defaultPreferences);

      logger.info(`Preferências resetadas para usuário: ${userId}`);
      return defaultPreferences;
    } catch (error) {
      logger.error(`Erro ao resetar preferências do usuário ${userId}:`, error);
      throw error;
    }
  }

  async exportUserPreferences(userId, format = 'json') {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (format === 'json') {
        return JSON.stringify(preferences, null, 2);
      }

      // CSV format for preferences would be complex due to nested objects
      // For now, just return JSON
      return JSON.stringify(preferences, null, 2);
    } catch (error) {
      logger.error(`Erro ao exportar preferências do usuário ${userId}:`, error);
      throw error;
    }
  }

  async importUserPreferences(userId, preferencesData) {
    try {
      let preferences;

      if (typeof preferencesData === 'string') {
        preferences = JSON.parse(preferencesData);
      } else {
        preferences = preferencesData;
      }

      // Validate imported preferences
      const result = userPreferencesSchema.safeParse(preferences);
      if (!result.success) {
        throw new Error('Dados de preferências inválidos');
      }

      await this.updateUserPreferences(userId, result.data);

      logger.info(`Preferências importadas para usuário: ${userId}`);
      return result.data;
    } catch (error) {
      logger.error(`Erro ao importar preferências do usuário ${userId}:`, error);
      throw error;
    }
  }

  // Helper methods
  encryptData(data) {
    // In a real implementation, use proper encryption
    return JSON.stringify(data); // Placeholder
  }

  async storeEncryptedPreferences(userId, preferences) {
    // In a real implementation, store in database
    logger.info(`Storing encrypted preferences for user ${userId} (implementation needed)`);
  }
}

const preferencesService = new PreferencesService();

/**
 * @route GET /api/auth/preferences
 * @desc Get current user preferences
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const preferences = await preferencesService.getUserPreferences(req.user.id);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error('Erro ao buscar preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/auth/preferences
 * @desc Update user preferences
 * @access Private
 */
router.put('/', validateRequest(userPreferencesSchema), async (req, res) => {
  try {
    const preferences = await preferencesService.updateUserPreferences(req.user.id, req.validatedData);

    res.json({
      success: true,
      message: 'Preferências atualizadas com sucesso',
      preferences
    });
  } catch (error) {
    logger.error('Erro ao atualizar preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PATCH /api/auth/preferences/:section
 * @desc Update specific preference section
 * @access Private
 */
router.patch('/:section', async (req, res) => {
  try {
    const { section } = req.params;
    const allowedSections = ['theme', 'notifications', 'searchSettings', 'securitySettings', 'dashboardSettings'];

    if (!allowedSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: 'Seção de preferências inválida'
      });
    }

    const currentPreferences = await preferencesService.getUserPreferences(req.user.id);

    // Update only the specified section
    const updatedPreferences = {
      ...currentPreferences,
      [section]: { ...currentPreferences[section], ...req.body }
    };

    // Validate the updated preferences
    const result = userPreferencesSchema.safeParse(updatedPreferences);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados de preferências inválidos',
        errors: result.error.issues
      });
    }

    const preferences = await preferencesService.updateUserPreferences(req.user.id, result.data);

    res.json({
      success: true,
      message: `Seção ${section} atualizada com sucesso`,
      preferences
    });
  } catch (error) {
    logger.error('Erro ao atualizar seção de preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/preferences/reset
 * @desc Reset preferences to defaults
 * @access Private
 */
router.post('/reset', async (req, res) => {
  try {
    const preferences = await preferencesService.resetUserPreferences(req.user.id);

    res.json({
      success: true,
      message: 'Preferências resetadas para os valores padrão',
      preferences
    });
  } catch (error) {
    logger.error('Erro ao resetar preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/auth/preferences/export
 * @desc Export user preferences
 * @access Private
 */
router.get('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const exportData = await preferencesService.exportUserPreferences(req.user.id, format);

    const filename = `preferences_${req.user.id}_${Date.now()}.${format}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(exportData);
  } catch (error) {
    logger.error('Erro ao exportar preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/preferences/import
 * @desc Import user preferences
 * @access Private
 */
router.post('/import', async (req, res) => {
  try {
    const { preferencesData } = req.body;

    if (!preferencesData) {
      return res.status(400).json({
        success: false,
        message: 'Dados de preferências são obrigatórios'
      });
    }

    const preferences = await preferencesService.importUserPreferences(req.user.id, preferencesData);

    res.json({
      success: true,
      message: 'Preferências importadas com sucesso',
      preferences
    });
  } catch (error) {
    logger.error('Erro ao importar preferências:', error);

    if (error.message.includes('inválidos')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;