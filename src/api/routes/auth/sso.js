const express = require('express');
const { SSOService } = require('../../../auth/sso/SSOService');
const { authMiddleware } = require('../../middleware/auth');
const { Logger } = require('../../../utils/Logger');
const { ssoConfigSchema } = require('../../validators/userValidators');

const router = express.Router();
const logger = new Logger('SSOAPI');

// Apply auth middleware to protected routes
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado - privilégios de administrador requeridos',
    });
  }
  next();
};

// Validation middleware
const validateRequest = schema => async (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.validatedData = result.data;
    next();
  } catch (error) {
    logger.error('Erro na validação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de validação',
    });
  }
};

class SSOManagementService {
  constructor() {
    this.ssoService = SSOService.getInstance();
  }

  async createSSOConfiguration(configData) {
    try {
      const config = await this.ssoService.createConfiguration(configData);

      logger.info(`Configuração SSO criada: ${configData.provider} - ${configData.displayName}`);
      return config;
    } catch (error) {
      logger.error('Erro ao criar configuração SSO:', error);
      throw error;
    }
  }

  async getSSOConfigurations() {
    try {
      return await this.ssoService.getAllConfigurations();
    } catch (error) {
      logger.error('Erro ao buscar configurações SSO:', error);
      throw error;
    }
  }

  async getSSOConfiguration(configId) {
    try {
      const config = await this.ssoService.getConfiguration(configId);
      if (!config) {
        throw new Error('Configuração SSO não encontrada');
      }
      return config;
    } catch (error) {
      logger.error(`Erro ao buscar configuração SSO ${configId}:`, error);
      throw error;
    }
  }

  async updateSSOConfiguration(configId, updateData) {
    try {
      await this.ssoService.updateConfiguration(configId, updateData);

      logger.info(`Configuração SSO atualizada: ${configId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao atualizar configuração SSO ${configId}:`, error);
      throw error;
    }
  }

  async deleteSSOConfiguration(configId) {
    try {
      await this.ssoService.deleteConfiguration(configId);

      logger.info(`Configuração SSO deletada: ${configId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao deletar configuração SSO ${configId}:`, error);
      throw error;
    }
  }

  async testSSOConfiguration(configId) {
    try {
      const result = await this.ssoService.testConfiguration(configId);

      logger.info(`Teste de configuração SSO ${configId}: ${result.success ? 'sucesso' : 'falha'}`);
      return result;
    } catch (error) {
      logger.error(`Erro ao testar configuração SSO ${configId}:`, error);
      throw error;
    }
  }

  async getSSOLoginUrl(configId, returnUrl) {
    try {
      const loginUrl = await this.ssoService.generateLoginUrl(configId, returnUrl);

      logger.info(`URL de login SSO gerada para configuração ${configId}`);
      return loginUrl;
    } catch (error) {
      logger.error(`Erro ao gerar URL de login SSO para configuração ${configId}:`, error);
      throw error;
    }
  }

  async getSSOStatistics() {
    try {
      return await this.ssoService.getUsageStatistics();
    } catch (error) {
      logger.error('Erro ao buscar estatísticas SSO:', error);
      throw error;
    }
  }
}

const ssoManagementService = new SSOManagementService();

/**
 * @route GET /api/auth/sso/configurations
 * @desc Get all SSO configurations
 * @access Private (Admin)
 */
router.get('/configurations', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const configurations = await ssoManagementService.getSSOConfigurations();

    // Remove sensitive data before sending
    const sanitizedConfigs = configurations.map(config => ({
      id: config.id,
      provider: config.provider,
      displayName: config.displayName,
      domain: config.domain,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      isActive: config.isActive,
      autoCreateUsers: config.autoCreateUsers,
      defaultRole: config.defaultRole,
      attributeMapping: config.attributeMapping,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));

    res.json({
      success: true,
      configurations: sanitizedConfigs,
    });
  } catch (error) {
    logger.error('Erro ao buscar configurações SSO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route GET /api/auth/sso/configurations/:configId
 * @desc Get specific SSO configuration
 * @access Private (Admin)
 */
router.get('/configurations/:configId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const configuration = await ssoManagementService.getSSOConfiguration(configId);

    // Remove sensitive data
    const { clientSecret, ...sanitizedConfig } = configuration;

    res.json({
      success: true,
      configuration: sanitizedConfig,
    });
  } catch (error) {
    logger.error('Erro ao buscar configuração SSO:', error);

    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route POST /api/auth/sso/configurations
 * @desc Create new SSO configuration
 * @access Private (Admin)
 */
router.post(
  '/configurations',
  authMiddleware,
  requireAdmin,
  validateRequest(ssoConfigSchema),
  async (req, res) => {
    try {
      const configuration = await ssoManagementService.createSSOConfiguration(req.validatedData);

      // Remove sensitive data
      const { clientSecret, ...sanitizedConfig } = configuration;

      res.status(201).json({
        success: true,
        message: 'Configuração SSO criada com sucesso',
        configuration: sanitizedConfig,
      });
    } catch (error) {
      logger.error('Erro ao criar configuração SSO:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route PUT /api/auth/sso/configurations/:configId
 * @desc Update SSO configuration
 * @access Private (Admin)
 */
router.put(
  '/configurations/:configId',
  authMiddleware,
  requireAdmin,
  validateRequest(ssoConfigSchema.partial()),
  async (req, res) => {
    try {
      const { configId } = req.params;

      await ssoManagementService.updateSSOConfiguration(configId, req.validatedData);

      res.json({
        success: true,
        message: 'Configuração SSO atualizada com sucesso',
      });
    } catch (error) {
      logger.error('Erro ao atualizar configuração SSO:', error);

      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route DELETE /api/auth/sso/configurations/:configId
 * @desc Delete SSO configuration
 * @access Private (Admin)
 */
router.delete('/configurations/:configId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { configId } = req.params;

    await ssoManagementService.deleteSSOConfiguration(configId);

    res.json({
      success: true,
      message: 'Configuração SSO deletada com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao deletar configuração SSO:', error);

    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route POST /api/auth/sso/configurations/:configId/test
 * @desc Test SSO configuration
 * @access Private (Admin)
 */
router.post('/configurations/:configId/test', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { configId } = req.params;

    const testResult = await ssoManagementService.testSSOConfiguration(configId);

    res.json({
      success: true,
      testResult,
    });
  } catch (error) {
    logger.error('Erro ao testar configuração SSO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route GET /api/auth/sso/login/:configId
 * @desc Get SSO login URL
 * @access Public
 */
router.get('/login/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const { returnUrl } = req.query;

    const loginUrl = await ssoManagementService.getSSOLoginUrl(configId, returnUrl);

    res.json({
      success: true,
      loginUrl,
    });
  } catch (error) {
    logger.error('Erro ao gerar URL de login SSO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route POST /api/auth/sso/callback/:configId
 * @desc Handle SSO callback
 * @access Public
 */
router.post('/callback/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const callbackData = req.body;

    const result = await ssoManagementService.ssoService.handleCallback(configId, callbackData);

    if (result.success) {
      res.json({
        success: true,
        message: 'Autenticação SSO bem-sucedida',
        user: result.user,
        token: result.token,
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.error || 'Falha na autenticação SSO',
      });
    }
  } catch (error) {
    logger.error('Erro no callback SSO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route GET /api/auth/sso/statistics
 * @desc Get SSO usage statistics
 * @access Private (Admin)
 */
router.get('/statistics', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const statistics = await ssoManagementService.getSSOStatistics();

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas SSO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route GET /api/auth/sso/providers
 * @desc Get supported SSO providers
 * @access Public
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = [
      {
        id: 'google',
        name: 'Google',
        description: 'Autenticação via Google OAuth 2.0',
        setupInstructions: [
          'Acesse o Google Cloud Console',
          'Crie um novo projeto ou selecione um existente',
          'Ative a Google+ API',
          'Crie credenciais OAuth 2.0',
          'Configure URLs de redirecionamento',
        ],
      },
      {
        id: 'microsoft',
        name: 'Microsoft Azure AD',
        description: 'Autenticação via Microsoft Azure Active Directory',
        setupInstructions: [
          'Acesse o Azure Portal',
          'Vá para Azure Active Directory',
          'Registre uma nova aplicação',
          'Configure permissões de API',
          'Obtenha Client ID e Secret',
        ],
      },
      {
        id: 'okta',
        name: 'Okta',
        description: 'Autenticação via Okta Identity Cloud',
        setupInstructions: [
          'Acesse seu painel Okta Admin',
          'Crie uma nova aplicação',
          'Configure como Web Application',
          'Configure URLs de redirecionamento',
          'Obtenha Client ID e Secret',
        ],
      },
      {
        id: 'auth0',
        name: 'Auth0',
        description: 'Autenticação via Auth0',
        setupInstructions: [
          'Acesse o painel Auth0',
          'Crie uma nova aplicação',
          'Configure como Regular Web Application',
          'Configure URLs permitidas',
          'Obtenha Client ID e Secret',
        ],
      },
      {
        id: 'saml',
        name: 'SAML 2.0',
        description: 'Autenticação via SAML 2.0 genérico',
        setupInstructions: [
          'Obtenha metadados XML do provedor SAML',
          'Configure URLs de SSO e SLO',
          'Configure mapeamento de atributos',
          'Teste a configuração',
        ],
      },
    ];

    res.json({
      success: true,
      providers,
    });
  } catch (error) {
    logger.error('Erro ao buscar provedores SSO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

module.exports = router;
