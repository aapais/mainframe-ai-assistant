const express = require('express');
const { query, validationResult } = require('express-validator');
const { SearchController } = require('../controllers/SearchController');
const { authMiddleware } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const { validationMiddleware } = require('../middleware/validation');
const { Logger } = require('../../utils/Logger');

const router = express.Router();
const logger = new Logger('SearchAPI');

// Middleware global para rotas de busca
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Controller de busca
const searchController = new SearchController();

/**
 * @route GET /api/search/semantic
 * @desc Busca semântica com RAG (Retrieval-Augmented Generation)
 * @access Private
 * @openapi
 * /api/search/semantic:
 *   get:
 *     summary: Busca semântica com RAG
 *     description: Realiza busca semântica na base de conhecimento usando embedding vectors e RAG
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 500
 *         description: Consulta de busca
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [incidents, knowledge, solutions, all]
 *           default: all
 *         description: Tipo de conteúdo para buscar
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Número máximo de resultados
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.7
 *         description: Limiar de similaridade (0-1)
 *       - in: query
 *         name: includeContext
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir contexto adicional nos resultados
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *     responses:
 *       200:
 *         description: Resultados da busca semântica
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SemanticSearchResponse'
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autorizado
 *       429:
 *         description: Muitas requisições
 */
router.get('/semantic',
    [
        query('query')
            .notEmpty()
            .withMessage('Query é obrigatória')
            .isLength({ min: 3, max: 500 })
            .withMessage('Query deve ter entre 3 e 500 caracteres'),
        query('type')
            .optional()
            .isIn(['incidents', 'knowledge', 'solutions', 'all'])
            .withMessage('Tipo deve ser: incidents, knowledge, solutions ou all'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage('Limite deve ser entre 1 e 50'),
        query('threshold')
            .optional()
            .isFloat({ min: 0, max: 1 })
            .withMessage('Threshold deve ser entre 0 e 1'),
        query('includeContext')
            .optional()
            .isBoolean()
            .withMessage('includeContext deve ser boolean'),
        query('category')
            .optional()
            .isString()
            .isLength({ max: 100 })
            .withMessage('Categoria deve ter no máximo 100 caracteres')
    ],
    validationMiddleware,
    async (req, res) => {
        try {
            logger.info(`Busca semântica solicitada por usuário ${req.user.id}: "${req.query.query}"`);

            const result = await searchController.performSemanticSearch(req.query, req.user);
            res.json(result);

        } catch (error) {
            logger.error('Erro na busca semântica:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }
);

/**
 * @route GET /api/search/similar
 * @desc Buscar conteúdo similar a um incidente específico
 * @access Private
 * @openapi
 * /api/search/similar:
 *   get:
 *     summary: Buscar conteúdo similar
 *     description: Encontra incidentes e soluções similares baseado em um incidente de referência
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do incidente de referência
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *       - in: query
 *         name: includeResolved
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir incidentes já resolvidos
 *     responses:
 *       200:
 *         description: Conteúdo similar encontrado
 */
router.get('/similar',
    [
        query('incidentId')
            .notEmpty()
            .withMessage('ID do incidente é obrigatório'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 20 })
            .withMessage('Limite deve ser entre 1 e 20'),
        query('includeResolved')
            .optional()
            .isBoolean()
            .withMessage('includeResolved deve ser boolean')
    ],
    validationMiddleware,
    async (req, res) => {
        try {
            const result = await searchController.findSimilarContent(req.query, req.user);
            res.json(result);

        } catch (error) {
            logger.error('Erro na busca de conteúdo similar:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/search/suggestions
 * @desc Obter sugestões de busca baseadas no histórico
 * @access Private
 * @openapi
 * /api/search/suggestions:
 *   get:
 *     summary: Sugestões de busca
 *     description: Retorna sugestões de busca baseadas no histórico do usuário e tendências
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partial
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Texto parcial para autocompletar
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *     responses:
 *       200:
 *         description: Sugestões de busca
 */
router.get('/suggestions',
    [
        query('partial')
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage('Texto parcial deve ter entre 1 e 100 caracteres'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 20 })
            .withMessage('Limite deve ser entre 1 e 20')
    ],
    validationMiddleware,
    async (req, res) => {
        try {
            const result = await searchController.getSearchSuggestions(req.query, req.user);
            res.json(result);

        } catch (error) {
            logger.error('Erro ao obter sugestões:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route POST /api/search/feedback
 * @desc Submeter feedback sobre relevância dos resultados
 * @access Private
 * @openapi
 * /api/search/feedback:
 *   post:
 *     summary: Feedback de relevância
 *     description: Submete feedback sobre a relevância dos resultados de busca para melhorar o algoritmo
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchFeedbackRequest'
 *     responses:
 *       200:
 *         description: Feedback registrado com sucesso
 */
router.post('/feedback',
    [
        query('searchId')
            .notEmpty()
            .withMessage('ID da busca é obrigatório'),
        query('resultId')
            .notEmpty()
            .withMessage('ID do resultado é obrigatório'),
        query('relevance')
            .isFloat({ min: 0, max: 1 })
            .withMessage('Relevância deve ser entre 0 e 1'),
        query('helpful')
            .optional()
            .isBoolean()
            .withMessage('helpful deve ser boolean'),
        query('comments')
            .optional()
            .isString()
            .isLength({ max: 500 })
            .withMessage('Comentários devem ter no máximo 500 caracteres')
    ],
    validationMiddleware,
    async (req, res) => {
        try {
            const result = await searchController.submitSearchFeedback(req.body, req.user);
            res.json(result);

        } catch (error) {
            logger.error('Erro ao submeter feedback:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/search/analytics
 * @desc Obter analytics de busca (Admin apenas)
 * @access Private (Admin)
 * @openapi
 * /api/search/analytics:
 *   get:
 *     summary: Analytics de busca
 *     description: Retorna métricas e analytics das buscas realizadas
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d]
 *           default: 7d
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [queries, results, clicks, feedback]
 *           default: all
 *     responses:
 *       200:
 *         description: Analytics de busca
 *       403:
 *         description: Acesso negado
 */
router.get('/analytics',
    [
        query('timeframe')
            .optional()
            .isIn(['24h', '7d', '30d', '90d'])
            .withMessage('Timeframe deve ser: 24h, 7d, 30d ou 90d'),
        query('metric')
            .optional()
            .isIn(['queries', 'results', 'clicks', 'feedback', 'all'])
            .withMessage('Métrica inválida')
    ],
    validationMiddleware,
    async (req, res) => {
        try {
            if (!req.user.isAdmin && req.user.role !== 'manager') {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado às analytics'
                });
            }

            const result = await searchController.getSearchAnalytics(req.query, req.user);
            res.json(result);

        } catch (error) {
            logger.error('Erro ao obter analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/search/health
 * @desc Health check do sistema de busca
 * @access Private (Admin)
 */
router.get('/health',
    async (req, res) => {
        try {
            if (!req.user.isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            const healthStatus = await searchController.performHealthCheck();

            const statusCode = healthStatus.overall === 'healthy' ? 200 :
                              healthStatus.overall === 'degraded' ? 206 : 500;

            res.status(statusCode).json({
                success: healthStatus.overall !== 'unhealthy',
                data: healthStatus
            });

        } catch (error) {
            logger.error('Erro no health check de busca:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

module.exports = router;