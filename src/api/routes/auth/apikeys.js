const express = require('express');
const { APIKeyManager } = require('../../../main/services/APIKeyManager');
const { SecureKeyManager } = require('../../../auth/services/SecureKeyManager');
const { authMiddleware } = require('../../middleware/auth');
const { Logger } = require('../../../utils/Logger');
const { createApiKeySchema } = require('../../validators/userValidators');
const crypto = require('crypto');

const router = express.Router();
const logger = new Logger('APIKeysAPI');

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

class UserAPIKeyService {
  constructor() {
    this.apiKeyManager = APIKeyManager.getInstance();
    this.secureKeyManager = SecureKeyManager.getInstance();
  }

  async createUserAPIKey(userId, keyData) {
    try {
      const { name, description, provider, permissions, expiresAt, ipRestrictions, monthlyLimit } = keyData;

      // Generate the actual API key that will be used with external services
      const apiKey = crypto.randomBytes(32).toString('hex');

      // Store the key securely associated with the user
      const keyId = await this.secureKeyManager.storeEncryptedAPIKey(userId, {
        name,
        description,
        apiKey,
        provider,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        ipRestrictions,
        monthlyLimit,
        usageCount: 0,
        lastUsed: null,
        isActive: true
      });

      logger.info(`API key criada para usuário ${userId}: ${name}`);

      return {
        id: keyId,
        name,
        description,
        provider,
        permissions,
        expiresAt,
        ipRestrictions,
        monthlyLimit,
        maskedKey: this.maskApiKey(apiKey),
        createdAt: new Date(),
        isActive: true
      };
    } catch (error) {
      logger.error(`Erro ao criar API key para usuário ${userId}:`, error);
      throw error;
    }
  }

  async getUserAPIKeys(userId) {
    try {
      const apiKeys = await this.secureKeyManager.getUserAPIKeys(userId);

      // Return keys without sensitive data
      return apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        description: key.description,
        provider: key.provider,
        permissions: key.permissions,
        maskedKey: this.maskApiKey(key.encryptedKey),
        expiresAt: key.expiresAt,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount || 0,
        isActive: key.isActive,
        createdAt: key.createdAt
      }));
    } catch (error) {
      logger.error(`Erro ao buscar API keys do usuário ${userId}:`, error);
      throw error;
    }
  }

  async updateAPIKey(userId, keyId, updateData) {
    try {
      await this.secureKeyManager.updateAPIKey(userId, keyId, updateData);

      logger.info(`API key ${keyId} atualizada para usuário ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao atualizar API key ${keyId} do usuário ${userId}:`, error);
      throw error;
    }
  }

  async deleteAPIKey(userId, keyId) {
    try {
      await this.secureKeyManager.deleteAPIKey(userId, keyId);

      logger.info(`API key ${keyId} deletada para usuário ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao deletar API key ${keyId} do usuário ${userId}:`, error);
      throw error;
    }
  }

  async rotateAPIKey(userId, keyId) {
    try {
      // Generate new API key
      const newApiKey = crypto.randomBytes(32).toString('hex');

      await this.secureKeyManager.rotateAPIKey(userId, keyId, newApiKey);

      logger.info(`API key ${keyId} rotacionada para usuário ${userId}`);

      return {
        maskedKey: this.maskApiKey(newApiKey),
        rotatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Erro ao rotacionar API key ${keyId} do usuário ${userId}:`, error);
      throw error;
    }
  }

  async getAPIKeyUsage(userId, keyId) {
    try {
      const usage = await this.secureKeyManager.getAPIKeyUsage(userId, keyId);

      return {
        keyId,
        usageCount: usage.usageCount || 0,
        lastUsed: usage.lastUsed,
        monthlyUsage: usage.monthlyUsage || 0,
        costThisMonth: usage.costThisMonth || 0,
        usageHistory: usage.history || []
      };
    } catch (error) {
      logger.error(`Erro ao buscar uso da API key ${keyId} do usuário ${userId}:`, error);
      throw error;
    }
  }

  async testAPIKey(userId, keyId) {
    try {
      const key = await this.secureKeyManager.getAPIKeyById(userId, keyId);
      if (!key) {
        throw new Error('API key não encontrada');
      }

      // Test the key with the external provider
      const testResult = await this.apiKeyManager.testConnection(key.provider, key.decryptedKey);

      // Record the test usage
      if (testResult.success) {
        await this.secureKeyManager.recordAPIKeyUsage(userId, keyId, {
          operation: 'test',
          timestamp: new Date(),
          success: true,
          responseTime: testResult.responseTime
        });
      }

      logger.info(`Teste de API key ${keyId} para usuário ${userId}: ${testResult.success ? 'sucesso' : 'falha'}`);

      return testResult;
    } catch (error) {
      logger.error(`Erro ao testar API key ${keyId} do usuário ${userId}:`, error);
      throw error;
    }
  }

  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return '***';

    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.max(8, apiKey.length - 8));

    return start + middle + end;
  }
}

const apiKeyService = new UserAPIKeyService();

/**
 * @route GET /api/auth/apikeys
 * @desc Get user's API keys
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const apiKeys = await apiKeyService.getUserAPIKeys(req.user.id);

    res.json({
      success: true,
      apiKeys
    });
  } catch (error) {
    logger.error('Erro ao buscar API keys:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/apikeys
 * @desc Create new API key
 * @access Private
 */
router.post('/', validateRequest(createApiKeySchema), async (req, res) => {
  try {
    const apiKey = await apiKeyService.createUserAPIKey(req.user.id, req.validatedData);

    res.status(201).json({
      success: true,
      message: 'API key criada com sucesso',
      apiKey
    });
  } catch (error) {
    logger.error('Erro ao criar API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/auth/apikeys/:keyId
 * @desc Get specific API key details
 * @access Private
 */
router.get('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const apiKeys = await apiKeyService.getUserAPIKeys(req.user.id);
    const apiKey = apiKeys.find(key => key.id === keyId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key não encontrada'
      });
    }

    res.json({
      success: true,
      apiKey
    });
  } catch (error) {
    logger.error('Erro ao buscar API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/auth/apikeys/:keyId
 * @desc Update API key
 * @access Private
 */
router.put('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const { name, description, permissions, ipRestrictions, monthlyLimit, isActive } = req.body;

    await apiKeyService.updateAPIKey(req.user.id, keyId, {
      name,
      description,
      permissions,
      ipRestrictions,
      monthlyLimit,
      isActive
    });

    res.json({
      success: true,
      message: 'API key atualizada com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao atualizar API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route DELETE /api/auth/apikeys/:keyId
 * @desc Delete API key
 * @access Private
 */
router.delete('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;

    await apiKeyService.deleteAPIKey(req.user.id, keyId);

    res.json({
      success: true,
      message: 'API key deletada com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao deletar API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/apikeys/:keyId/rotate
 * @desc Rotate API key
 * @access Private
 */
router.post('/:keyId/rotate', async (req, res) => {
  try {
    const { keyId } = req.params;

    const result = await apiKeyService.rotateAPIKey(req.user.id, keyId);

    res.json({
      success: true,
      message: 'API key rotacionada com sucesso',
      ...result
    });
  } catch (error) {
    logger.error('Erro ao rotacionar API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/auth/apikeys/:keyId/test
 * @desc Test API key connectivity
 * @access Private
 */
router.post('/:keyId/test', async (req, res) => {
  try {
    const { keyId } = req.params;

    const testResult = await apiKeyService.testAPIKey(req.user.id, keyId);

    res.json({
      success: true,
      testResult
    });
  } catch (error) {
    logger.error('Erro ao testar API key:', error);

    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
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

/**
 * @route GET /api/auth/apikeys/:keyId/usage
 * @desc Get API key usage statistics
 * @access Private
 */
router.get('/:keyId/usage', async (req, res) => {
  try {
    const { keyId } = req.params;

    const usage = await apiKeyService.getAPIKeyUsage(req.user.id, keyId);

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    logger.error('Erro ao buscar uso da API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/auth/apikeys/providers
 * @desc Get available API providers
 * @access Private
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = apiKeyService.apiKeyManager.getProviders();

    res.json({
      success: true,
      providers: providers.map(provider => ({
        id: provider.id,
        name: provider.name,
        description: provider.description,
        documentationUrl: provider.documentationUrl,
        setupInstructions: provider.setupInstructions
      }))
    });
  } catch (error) {
    logger.error('Erro ao buscar provedores de API:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;