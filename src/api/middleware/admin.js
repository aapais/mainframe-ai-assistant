const { Logger } = require('../../utils/Logger');

const logger = new Logger('AdminMiddleware');

/**
 * Middleware para verificar permissões de administrador
 */
const adminMiddleware = (req, res, next) => {
    try {
        // Verificar se o usuário está autenticado
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        // Verificar se é administrador
        if (!req.user.isAdmin) {
            logger.warn(`Tentativa de acesso admin negada para usuário ${req.user.id} (${req.user.email})`);

            return res.status(403).json({
                success: false,
                message: 'Acesso negado - privilégios de administrador requeridos'
            });
        }

        logger.info(`Acesso admin autorizado para ${req.user.email}`);
        next();

    } catch (error) {
        logger.error('Erro no middleware admin:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

/**
 * Middleware para verificar permissões específicas
 */
const permissionMiddleware = (requiredPermission) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            // Administradores têm todas as permissões
            if (req.user.isAdmin) {
                return next();
            }

            // Verificar permissão específica
            if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
                logger.warn(`Permissão '${requiredPermission}' negada para usuário ${req.user.id}`);

                return res.status(403).json({
                    success: false,
                    message: `Permissão '${requiredPermission}' requerida`
                });
            }

            next();

        } catch (error) {
            logger.error('Erro no middleware de permissão:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

/**
 * Middleware para verificar múltiplas permissões (AND)
 */
const multiPermissionMiddleware = (requiredPermissions) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            // Administradores têm todas as permissões
            if (req.user.isAdmin) {
                return next();
            }

            // Verificar se possui todas as permissões
            const hasAllPermissions = requiredPermissions.every(permission =>
                req.user.permissions && req.user.permissions.includes(permission)
            );

            if (!hasAllPermissions) {
                logger.warn(`Permissões múltiplas negadas para usuário ${req.user.id}: ${requiredPermissions.join(', ')}`);

                return res.status(403).json({
                    success: false,
                    message: `Permissões requeridas: ${requiredPermissions.join(', ')}`
                });
            }

            next();

        } catch (error) {
            logger.error('Erro no middleware de múltiplas permissões:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

/**
 * Middleware para verificar permissões alternativas (OR)
 */
const anyPermissionMiddleware = (alternativePermissions) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            // Administradores têm todas as permissões
            if (req.user.isAdmin) {
                return next();
            }

            // Verificar se possui pelo menos uma das permissões
            const hasAnyPermission = alternativePermissions.some(permission =>
                req.user.permissions && req.user.permissions.includes(permission)
            );

            if (!hasAnyPermission) {
                logger.warn(`Nenhuma permissão alternativa encontrada para usuário ${req.user.id}: ${alternativePermissions.join(', ')}`);

                return res.status(403).json({
                    success: false,
                    message: `Uma das seguintes permissões é requerida: ${alternativePermissions.join(', ')}`
                });
            }

            next();

        } catch (error) {
            logger.error('Erro no middleware de permissões alternativas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

/**
 * Middleware para verificar propriedade de recurso
 */
const resourceOwnerMiddleware = (resourceIdParam = 'id', userIdField = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            // Administradores podem acessar qualquer recurso
            if (req.user.isAdmin) {
                return next();
            }

            const resourceId = req.params[resourceIdParam];

            // Esta verificação seria feita consultando o banco de dados
            // Por ora, assumimos que o middleware será usado após buscar o recurso
            if (req.resource && req.resource[userIdField] !== req.user.id) {
                logger.warn(`Acesso negado ao recurso ${resourceId} para usuário ${req.user.id}`);

                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado - você não possui este recurso'
                });
            }

            next();

        } catch (error) {
            logger.error('Erro no middleware de proprietário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

module.exports = {
    adminMiddleware,
    permissionMiddleware,
    multiPermissionMiddleware,
    anyPermissionMiddleware,
    resourceOwnerMiddleware
};