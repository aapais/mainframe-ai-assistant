const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { KnowledgeBaseService } = require('../../services/KnowledgeBaseService');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const { Logger } = require('../../utils/Logger');

const router = express.Router();
const logger = new Logger('KnowledgeAPI');

// Middleware global
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Instância do serviço
let knowledgeService = null;

const initializeService = async () => {
    if (!knowledgeService) {
        knowledgeService = new KnowledgeBaseService();
        await knowledgeService.initialize();
    }
    return knowledgeService;
};

/**
 * @route GET /api/knowledge/search
 * @desc Buscar na base de conhecimento
 * @access Private
 */
router.get('/search',
    [
        query('q')
            .notEmpty()
            .withMessage('Query de busca é obrigatória')
            .isLength({ min: 3, max: 500 })
            .withMessage('Query deve ter entre 3 e 500 caracteres'),
        query('category')
            .optional()
            .isString(),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage('Limite deve ser entre 1 e 50'),
        query('threshold')
            .optional()
            .isFloat({ min: 0, max: 1 })
            .withMessage('Threshold deve ser entre 0 e 1')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { q, category, limit = 10, threshold = 0.7 } = req.query;

            logger.info(`Busca na KB: "${q}" por usuário ${req.user.id}`);

            const results = await service.searchSimilar(q, category, {
                limit: parseInt(limit),
                threshold: parseFloat(threshold)
            });

            res.json({
                success: true,
                data: results,
                query: q,
                category,
                totalResults: results.length
            });

        } catch (error) {
            logger.error('Erro na busca da KB:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route POST /api/knowledge/articles
 * @desc Criar novo artigo na base
 * @access Private (Admin)
 */
router.post('/articles',
    adminMiddleware,
    [
        body('title')
            .notEmpty()
            .withMessage('Título é obrigatório')
            .isLength({ min: 5, max: 200 })
            .withMessage('Título deve ter entre 5 e 200 caracteres'),
        body('content')
            .notEmpty()
            .withMessage('Conteúdo é obrigatório')
            .isLength({ min: 50 })
            .withMessage('Conteúdo deve ter pelo menos 50 caracteres'),
        body('category')
            .notEmpty()
            .withMessage('Categoria é obrigatória'),
        body('tags')
            .optional()
            .isArray()
            .withMessage('Tags devem ser um array'),
        body('priority')
            .optional()
            .isInt({ min: 1, max: 5 })
            .withMessage('Prioridade deve ser entre 1 e 5'),
        body('isPublic')
            .optional()
            .isBoolean()
            .withMessage('isPublic deve ser booleano')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();

            const articleData = {
                ...req.body,
                createdBy: req.user.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isPublic: req.body.isPublic !== false
            };

            logger.info(`Criando artigo: "${articleData.title}" por ${req.user.id}`);

            const article = await service.addArticle(articleData);

            res.status(201).json({
                success: true,
                data: article,
                message: 'Artigo criado com sucesso'
            });

        } catch (error) {
            logger.error('Erro ao criar artigo:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/knowledge/articles
 * @desc Listar artigos
 * @access Private
 */
router.get('/articles',
    [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Página deve ser positiva'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limite deve ser entre 1 e 100'),
        query('category')
            .optional()
            .isString(),
        query('tags')
            .optional()
            .isString(),
        query('search')
            .optional()
            .isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const {
                page = 1,
                limit = 20,
                category,
                tags,
                search
            } = req.query;

            const filters = {
                page: parseInt(page),
                limit: parseInt(limit),
                category,
                tags: tags ? tags.split(',') : undefined,
                search,
                isPublic: !req.user.isAdmin ? true : undefined
            };

            const results = await service.listArticles(filters);

            res.json({
                success: true,
                data: results.articles,
                pagination: results.pagination,
                filters
            });

        } catch (error) {
            logger.error('Erro ao listar artigos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/knowledge/articles/:id
 * @desc Obter artigo específico
 * @access Private
 */
router.get('/articles/:id',
    [
        param('id')
            .notEmpty()
            .withMessage('ID do artigo é obrigatório')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { id } = req.params;

            const article = await service.getArticleById(id);

            if (!article) {
                return res.status(404).json({
                    success: false,
                    message: 'Artigo não encontrado'
                });
            }

            // Verificar permissões
            if (!article.isPublic && !req.user.isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            // Incrementar visualizações
            await service.incrementViews(id);

            res.json({
                success: true,
                data: article
            });

        } catch (error) {
            logger.error('Erro ao buscar artigo:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route PUT /api/knowledge/articles/:id
 * @desc Atualizar artigo
 * @access Private (Admin)
 */
router.put('/articles/:id',
    adminMiddleware,
    [
        param('id')
            .notEmpty()
            .withMessage('ID do artigo é obrigatório'),
        body('title')
            .optional()
            .isLength({ min: 5, max: 200 })
            .withMessage('Título deve ter entre 5 e 200 caracteres'),
        body('content')
            .optional()
            .isLength({ min: 50 })
            .withMessage('Conteúdo deve ter pelo menos 50 caracteres'),
        body('category')
            .optional()
            .isString(),
        body('tags')
            .optional()
            .isArray(),
        body('isPublic')
            .optional()
            .isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { id } = req.params;

            const updateData = {
                ...req.body,
                updatedBy: req.user.id,
                updatedAt: new Date().toISOString()
            };

            const updatedArticle = await service.updateArticle(id, updateData);

            if (!updatedArticle) {
                return res.status(404).json({
                    success: false,
                    message: 'Artigo não encontrado'
                });
            }

            res.json({
                success: true,
                data: updatedArticle,
                message: 'Artigo atualizado com sucesso'
            });

        } catch (error) {
            logger.error('Erro ao atualizar artigo:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route DELETE /api/knowledge/articles/:id
 * @desc Deletar artigo
 * @access Private (Admin)
 */
router.delete('/articles/:id',
    adminMiddleware,
    [
        param('id')
            .notEmpty()
            .withMessage('ID do artigo é obrigatório')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { id } = req.params;

            const deleted = await service.deleteArticle(id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Artigo não encontrado'
                });
            }

            logger.info(`Artigo ${id} deletado por ${req.user.id}`);

            res.json({
                success: true,
                message: 'Artigo deletado com sucesso'
            });

        } catch (error) {
            logger.error('Erro ao deletar artigo:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/knowledge/categories
 * @desc Listar categorias disponíveis
 * @access Private
 */
router.get('/categories',
    async (req, res) => {
        try {
            const service = await initializeService();
            const categories = await service.getCategories();

            res.json({
                success: true,
                data: categories
            });

        } catch (error) {
            logger.error('Erro ao listar categorias:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/knowledge/tags
 * @desc Listar tags populares
 * @access Private
 */
router.get('/tags',
    [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limite deve ser entre 1 e 100')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { limit = 50 } = req.query;

            const tags = await service.getPopularTags(parseInt(limit));

            res.json({
                success: true,
                data: tags
            });

        } catch (error) {
            logger.error('Erro ao listar tags:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route POST /api/knowledge/articles/:id/feedback
 * @desc Avaliar utilidade do artigo
 * @access Private
 */
router.post('/articles/:id/feedback',
    [
        param('id')
            .notEmpty()
            .withMessage('ID do artigo é obrigatório'),
        body('rating')
            .isInt({ min: 1, max: 5 })
            .withMessage('Rating deve ser entre 1 e 5'),
        body('comment')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Comentário deve ter no máximo 500 caracteres'),
        body('isHelpful')
            .isBoolean()
            .withMessage('isHelpful deve ser booleano')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { id } = req.params;

            const feedbackData = {
                ...req.body,
                userId: req.user.id,
                submittedAt: new Date().toISOString()
            };

            const feedback = await service.addFeedback(id, feedbackData);

            res.status(201).json({
                success: true,
                data: feedback,
                message: 'Feedback registrado com sucesso'
            });

        } catch (error) {
            logger.error('Erro ao registrar feedback:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

/**
 * @route GET /api/knowledge/analytics
 * @desc Obter analytics da base de conhecimento
 * @access Private (Admin)
 */
router.get('/analytics',
    adminMiddleware,
    [
        query('period')
            .optional()
            .isIn(['7d', '30d', '90d', '1y'])
            .withMessage('Período inválido')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const service = await initializeService();
            const { period = '30d' } = req.query;

            const analytics = await service.getAnalytics(period);

            res.json({
                success: true,
                data: analytics,
                period
            });

        } catch (error) {
            logger.error('Erro ao obter analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
);

module.exports = router;