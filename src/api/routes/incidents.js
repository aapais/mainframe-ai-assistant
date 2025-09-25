const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { IncidentController } = require('../controllers/IncidentController');
const { authMiddleware } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const { validationMiddleware } = require('../middleware/validation');
const { Logger } = require('../../utils/Logger');
const { WebSocketNotifier } = require('../websocket/notifications');

const router = express.Router();
const logger = new Logger('IncidentAPI');

// Middleware global para rotas de incidentes
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Controller de incidentes
const incidentController = new IncidentController();
const wsNotifier = new WebSocketNotifier();

/**
 * @route POST /api/incidents
 * @desc Criar novo incidente
 * @access Private
 * @openapi
 * /api/incidents:
 *   post:
 *     summary: Criar novo incidente
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateIncidentRequest'
 *     responses:
 *       201:
 *         description: Incidente criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IncidentResponse'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post(
  '/',
  [
    body('title')
      .notEmpty()
      .withMessage('Título é obrigatório')
      .isLength({ min: 5, max: 200 })
      .withMessage('Título deve ter entre 5 e 200 caracteres'),
    body('description')
      .notEmpty()
      .withMessage('Descrição é obrigatória')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Descrição deve ter entre 10 e 5000 caracteres'),
    body('priority')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Prioridade deve ser: low, medium, high ou critical'),
    body('severity')
      .optional()
      .isIn(['minor', 'major', 'critical'])
      .withMessage('Severidade deve ser: minor, major ou critical'),
    body('category').notEmpty().withMessage('Categoria é obrigatória').isString(),
    body('subcategory').optional().isString(),
    body('reportedBy').notEmpty().withMessage('Reporter é obrigatório'),
    body('customerInfo').optional().isObject(),
    body('affectedSystems').optional().isArray(),
    body('businessImpact').optional().isString(),
    body('urgency')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Urgência deve ser: low, medium, high ou critical'),
    body('tags').optional().isArray(),
    body('attachments').optional().isArray(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      logger.info(`Criando novo incidente para usuário ${req.user.id}`);

      const result = await incidentController.createIncident(req.body, req.user);

      // Notificar via WebSocket sobre novo incidente
      wsNotifier.notifyNewIncident(result.data);

      res.status(201).json(result);
    } catch (error) {
      logger.error('Erro ao criar incidente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message,
      });
    }
  }
);

/**
 * @route GET /api/incidents
 * @desc Listar incidentes com filtros e busca
 * @access Private
 * @openapi
 * /api/incidents:
 *   get:
 *     summary: Listar incidentes com filtros
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, assigned, in_progress, resolved, closed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, priority, status]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de incidentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IncidentListResponse'
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limite deve ser entre 1 e 100'),
    query('status')
      .optional()
      .isIn(['created', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled'])
      .withMessage('Status inválido'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Prioridade inválida'),
    query('severity')
      .optional()
      .isIn(['minor', 'major', 'critical'])
      .withMessage('Severidade inválida'),
    query('search')
      .optional()
      .isString()
      .isLength({ min: 3, max: 100 })
      .withMessage('Busca deve ter entre 3 e 100 caracteres'),
    query('category').optional().isString(),
    query('assignedTo').optional().isString(),
    query('dateFrom').optional().isISO8601().withMessage('Data inicial inválida'),
    query('dateTo').optional().isISO8601().withMessage('Data final inválida'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'priority', 'status', 'severity'])
      .withMessage('Campo de ordenação inválido'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Ordem de classificação inválida'),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const result = await incidentController.listIncidents(req.query, req.user);
      res.json(result);
    } catch (error) {
      logger.error('Erro ao listar incidentes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route GET /api/incidents/:id
 * @desc Obter incidente específico
 * @access Private
 */
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('ID do incidente é obrigatório')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;

      // Buscar incidente (integrar com banco de dados)
      const incident = await getIncidentById(id, req.user.id);

      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incidente não encontrado',
        });
      }

      res.json({
        success: true,
        data: incident,
      });
    } catch (error) {
      logger.error('Erro ao buscar incidente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route PUT /api/incidents/:id/status
 * @desc Atualizar status do incidente
 * @access Private
 */
router.put(
  '/:id/status',
  [
    param('id').notEmpty().withMessage('ID do incidente é obrigatório'),
    body('status').isIn(['processed', 'resolved', 'closed']).withMessage('Status inválido'),
    body('resolution')
      .optional()
      .isString()
      .isLength({ max: 2000 })
      .withMessage('Resolução deve ter no máximo 2000 caracteres'),
    body('resolvedBy').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { status, resolution, resolvedBy } = req.body;

      // Atualizar incidente (integrar com banco de dados)
      const updatedIncident = await updateIncidentStatus(id, {
        status,
        resolution,
        resolvedBy: resolvedBy || req.user.id,
        resolvedAt: new Date().toISOString(),
        updatedBy: req.user.id,
      });

      if (!updatedIncident) {
        return res.status(404).json({
          success: false,
          message: 'Incidente não encontrado',
        });
      }

      res.json({
        success: true,
        data: updatedIncident,
        message: 'Status do incidente atualizado com sucesso',
      });
    } catch (error) {
      logger.error('Erro ao atualizar status:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route POST /api/incidents/:id/feedback
 * @desc Submeter feedback de resolução
 * @access Private
 */
router.post(
  '/:id/feedback',
  [
    param('id').notEmpty().withMessage('ID do incidente é obrigatório'),
    body('effectiveness')
      .isFloat({ min: 0, max: 1 })
      .withMessage('Efetividade deve ser entre 0 e 1'),
    body('resolution').notEmpty().withMessage('Resolução é obrigatória'),
    body('timeToResolve')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Tempo de resolução deve ser positivo'),
    body('userSatisfaction')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Satisfação deve ser entre 0 e 5'),
    body('comments')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Comentários devem ter no máximo 1000 caracteres'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const feedbackData = {
        ...req.body,
        submittedBy: req.user.id,
        submittedAt: new Date().toISOString(),
      };

      const engine = await initializeEngine();

      // Submeter feedback para aprendizado contínuo
      const result = await engine.submitResolutionFeedback(id, feedbackData);

      res.json({
        success: true,
        data: result,
        message: 'Feedback submetido com sucesso',
      });
    } catch (error) {
      logger.error('Erro ao submeter feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * @route GET /api/incidents/analytics/metrics
 * @desc Obter métricas de incidentes
 * @access Private (Admin)
 */
router.get('/analytics/metrics', async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    const engine = await initializeEngine();
    const metrics = engine.getMetrics();

    // Adicionar métricas adicionais do banco de dados
    const additionalMetrics = await getIncidentAnalytics();

    res.json({
      success: true,
      data: {
        ...metrics,
        ...additionalMetrics,
      },
    });
  } catch (error) {
    logger.error('Erro ao obter métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

/**
 * @route GET /api/incidents/health
 * @desc Health check do sistema
 * @access Private (Admin)
 */
router.get('/health', async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    const engine = await initializeEngine();
    const healthStatus = await engine.performHealthCheck();

    const statusCode =
      healthStatus.overall === 'healthy' ? 200 : healthStatus.overall === 'degraded' ? 206 : 500;

    res.status(statusCode).json({
      success: healthStatus.overall !== 'unhealthy',
      data: healthStatus,
    });
  } catch (error) {
    logger.error('Erro no health check:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// Funções auxiliares (integrar com banco de dados real)
async function searchIncidents(filters) {
  // Simulação - implementar com banco real
  return {
    data: [
      {
        id: 'INC-001',
        description: 'Problema de login',
        priority: 'alta',
        status: 'processed',
        createdAt: '2024-01-15T10:00:00Z',
      },
    ],
    pagination: {
      currentPage: filters.page,
      totalPages: 1,
      totalItems: 1,
      limit: filters.limit,
    },
  };
}

async function getIncidentById(id, userId) {
  // Simulação - implementar com banco real
  return {
    id,
    description: 'Problema de login',
    priority: 'alta',
    status: 'processed',
    createdAt: '2024-01-15T10:00:00Z',
    createdBy: userId,
  };
}

async function updateIncidentStatus(id, updateData) {
  // Simulação - implementar com banco real
  return {
    id,
    ...updateData,
    updatedAt: new Date().toISOString(),
  };
}

async function getIncidentAnalytics() {
  // Simulação - implementar com banco real
  return {
    incidentsByCategory: {},
    resolutionTrends: [],
    topIssues: [],
  };
}

module.exports = router;
