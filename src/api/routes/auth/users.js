const express = require('express');
const { UserService } = require('../../services/auth/UserService');
const { authMiddleware, refreshTokenMiddleware } = require('../../middleware/auth');
const { validationMiddleware } = require('../../middleware/validation');
const { authRateLimit } = require('../../middleware/rateLimit');
const { Logger } = require('../../../utils/Logger');
const {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  bulkUserOperationSchema,
  userQuerySchema,
} = require('../../validators/userValidators');

const router = express.Router();
const logger = new Logger('UsersAPI');
const userService = new UserService();

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(refreshTokenMiddleware);

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
          code: issue.code,
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

const validateQuery = schema => async (req, res, next) => {
  try {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros de consulta inválidos',
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.validatedQuery = result.data;
    next();
  } catch (error) {
    logger.error('Erro na validação de query:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de validação',
    });
  }
};

// Check admin permission
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado - privilégios de administrador requeridos',
    });
  }
  next();
};

/**
 * @route GET /api/auth/users
 * @desc Get users with filtering and pagination
 * @access Private (Admin)
 */
router.get('/', requireAdmin, validateQuery(userQuerySchema), async (req, res) => {
  try {
    const result = await userService.getUsers(req.validatedQuery);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route GET /api/auth/users/:id
 * @desc Get user by ID
 * @access Private (Admin or own user)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only access their own data, admins can access any
    if (!req.user.isAdmin && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @route POST /api/auth/users
 * @desc Create new user
 * @access Private (Admin)
 */
router.post('/', requireAdmin, validateRequest(createUserSchema), async (req, res) => {
  try {
    const user = await userService.createUser(req.validatedData);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      user,
    });
  } catch (error) {
    logger.error('Erro ao criar usuário:', error);

    if (error.message.includes('já existe')) {
      return res.status(409).json({
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
 * @route PUT /api/auth/users/:id
 * @desc Update user
 * @access Private (Admin or own user)
 */
router.put('/:id', validateRequest(updateUserSchema), async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only update their own data (excluding role), admins can update any
    if (!req.user.isAdmin && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    // Non-admins cannot change role
    if (!req.user.isAdmin && req.validatedData.role) {
      delete req.validatedData.role;
    }

    const user = await userService.updateUser(id, req.validatedData);

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user,
    });
  } catch (error) {
    logger.error('Erro ao atualizar usuário:', error);

    if (error.message.includes('não encontrado')) {
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
 * @route DELETE /api/auth/users/:id
 * @desc Delete user (soft delete)
 * @access Private (Admin)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Você não pode deletar sua própria conta',
      });
    }

    await userService.deleteUser(id);

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao deletar usuário:', error);

    if (error.message.includes('não encontrado')) {
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
 * @route POST /api/auth/users/change-password
 * @desc Change user password
 * @access Private
 */
router.post(
  '/change-password',
  authRateLimit,
  validateRequest(changePasswordSchema),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.validatedData;

      await userService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      logger.error('Erro ao alterar senha:', error);

      if (error.message.includes('incorreta')) {
        return res.status(400).json({
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
 * @route POST /api/auth/users/bulk-operation
 * @desc Perform bulk operations on users
 * @access Private (Admin)
 */
router.post(
  '/bulk-operation',
  requireAdmin,
  validateRequest(bulkUserOperationSchema),
  async (req, res) => {
    try {
      const { operation, userIds, parameters } = req.validatedData;

      // Prevent bulk operation on current user for certain operations
      if (['deactivate', 'delete'].includes(operation) && userIds.includes(req.user.id)) {
        return res.status(400).json({
          success: false,
          message: 'Você não pode executar esta operação em sua própria conta',
        });
      }

      const results = await userService.bulkUserOperation(operation, userIds, parameters);

      res.json({
        success: true,
        message: `Operação ${operation} executada`,
        results,
      });
    } catch (error) {
      logger.error('Erro na operação bulk:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route GET /api/auth/users/statistics
 * @desc Get user statistics
 * @access Private (Admin)
 */
router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    // This would be implemented with actual database queries
    const statistics = {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      usersByRole: {
        admin: 0,
        analyst: 0,
        user: 0,
      },
      recentLogins: 0,
      usersCreatedThisMonth: 0,
    };

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

module.exports = router;
