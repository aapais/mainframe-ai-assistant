const { validationResult } = require('express-validator');
const { Logger } = require('../../utils/Logger');

const logger = new Logger('ValidationMiddleware');

/**
 * Middleware de validação centralizado
 * Processa resultados de validação e retorna erros formatados
 */
const validationMiddleware = (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = formatValidationErrors(errors.array());

      logger.warn(`Erro de validação para ${req.method} ${req.path}:`, formattedErrors);

      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: formattedErrors,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  } catch (error) {
    logger.error('Erro no middleware de validação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de validação',
      code: 'VALIDATION_MIDDLEWARE_ERROR',
    });
  }
};

/**
 * Formatar erros de validação em formato consistente
 * @param {Array} errors - Array de erros do express-validator
 * @returns {Array} Erros formatados
 */
function formatValidationErrors(errors) {
  return errors.map(error => ({
    field: error.param || error.path,
    message: error.msg,
    value: error.value,
    location: error.location || 'body',
  }));
}

/**
 * Middleware de sanitização de dados
 * Remove campos desnecessários e aplica sanitização básica
 */
const sanitizationMiddleware = (allowedFields = []) => {
  return (req, res, next) => {
    try {
      if (req.body && typeof req.body === 'object') {
        // Se allowedFields especificado, filtrar apenas campos permitidos
        if (allowedFields.length > 0) {
          const sanitizedBody = {};
          allowedFields.forEach(field => {
            if (req.body.hasOwnProperty(field)) {
              sanitizedBody[field] = req.body[field];
            }
          });
          req.body = sanitizedBody;
        }

        // Aplicar sanitização básica
        req.body = sanitizeObject(req.body);
      }

      next();
    } catch (error) {
      logger.error('Erro no middleware de sanitização:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno de sanitização',
        code: 'SANITIZATION_ERROR',
      });
    }
  };
};

/**
 * Sanitizar objeto recursivamente
 * @param {Object} obj - Objeto para sanitizar
 * @returns {Object} Objeto sanitizado
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];

    // Remover campos que começam com $ (proteção contra injection)
    if (key.startsWith('$')) {
      return;
    }

    // Sanitizar strings
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Sanitizar string
 * @param {string} str - String para sanitizar
 * @returns {string} String sanitizada
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Remover caracteres de controle
  str = str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  // Trim espaços em branco
  str = str.trim();

  return str;
}

/**
 * Middleware de validação de tipos de arquivo
 * @param {Array} allowedTypes - Tipos MIME permitidos
 * @param {number} maxSize - Tamanho máximo em bytes
 */
const fileValidationMiddleware = (allowedTypes = [], maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    try {
      if (!req.files && !req.file) {
        return next();
      }

      const files = req.files || [req.file];
      const filesToValidate = Array.isArray(files) ? files : Object.values(files).flat();

      for (const file of filesToValidate) {
        // Validar tipo de arquivo
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: `Tipo de arquivo não permitido: ${file.mimetype}`,
            code: 'INVALID_FILE_TYPE',
            allowedTypes,
          });
        }

        // Validar tamanho
        if (file.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: `Arquivo muito grande: ${file.size} bytes. Máximo: ${maxSize} bytes`,
            code: 'FILE_TOO_LARGE',
            maxSize,
          });
        }

        // Validar nome do arquivo
        if (file.originalname && !isValidFileName(file.originalname)) {
          return res.status(400).json({
            success: false,
            message: 'Nome de arquivo inválido',
            code: 'INVALID_FILE_NAME',
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Erro no middleware de validação de arquivo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno de validação de arquivo',
        code: 'FILE_VALIDATION_ERROR',
      });
    }
  };
};

/**
 * Validar nome de arquivo
 * @param {string} fileName - Nome do arquivo
 * @returns {boolean} Se é válido
 */
function isValidFileName(fileName) {
  // Caracteres não permitidos em nomes de arquivo
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

  return (
    !invalidChars.test(fileName) &&
    !reservedNames.test(fileName) &&
    fileName.length > 0 &&
    fileName.length <= 255
  );
}

/**
 * Middleware de validação de paginação
 */
const paginationValidationMiddleware = (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Validar limites
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: 'Página deve ser maior que 0',
        code: 'INVALID_PAGE',
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limite deve ser entre 1 e 100',
        code: 'INVALID_LIMIT',
      });
    }

    // Adicionar valores validados ao request
    req.pagination = {
      page,
      limit,
      offset: (page - 1) * limit,
    };

    next();
  } catch (error) {
    logger.error('Erro no middleware de validação de paginação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de validação de paginação',
      code: 'PAGINATION_VALIDATION_ERROR',
    });
  }
};

/**
 * Middleware de validação de datas
 */
const dateValidationMiddleware = (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Data inicial inválida',
          code: 'INVALID_DATE_FROM',
        });
      }
      req.query.dateFrom = fromDate.toISOString();
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Data final inválida',
          code: 'INVALID_DATE_TO',
        });
      }
      req.query.dateTo = toDate.toISOString();
    }

    // Validar ordem das datas
    if (dateFrom && dateTo) {
      const fromDate = new Date(req.query.dateFrom);
      const toDate = new Date(req.query.dateTo);

      if (fromDate > toDate) {
        return res.status(400).json({
          success: false,
          message: 'Data inicial deve ser anterior à data final',
          code: 'INVALID_DATE_RANGE',
        });
      }

      // Validar range máximo (ex: 1 ano)
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 ano em ms
      if (toDate - fromDate > maxRange) {
        return res.status(400).json({
          success: false,
          message: 'Intervalo de datas muito grande (máximo 1 ano)',
          code: 'DATE_RANGE_TOO_LARGE',
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Erro no middleware de validação de data:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de validação de data',
      code: 'DATE_VALIDATION_ERROR',
    });
  }
};

/**
 * Middleware de validação de IP/origem
 */
const originValidationMiddleware = (allowedOrigins = []) => {
  return (req, res, next) => {
    try {
      if (allowedOrigins.length === 0) {
        return next();
      }

      const origin = req.headers.origin || req.headers.referer;
      const clientIp = req.ip || req.connection.remoteAddress;

      // Validar origem se especificada
      if (origin) {
        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') {
            return origin === allowed;
          }
          if (allowed instanceof RegExp) {
            return allowed.test(origin);
          }
          return false;
        });

        if (!isAllowed) {
          logger.warn(`Origem não permitida: ${origin} de IP ${clientIp}`);
          return res.status(403).json({
            success: false,
            message: 'Origem não permitida',
            code: 'ORIGIN_NOT_ALLOWED',
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Erro no middleware de validação de origem:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno de validação de origem',
        code: 'ORIGIN_VALIDATION_ERROR',
      });
    }
  };
};

module.exports = {
  validationMiddleware,
  sanitizationMiddleware,
  fileValidationMiddleware,
  paginationValidationMiddleware,
  dateValidationMiddleware,
  originValidationMiddleware,
  formatValidationErrors,
  sanitizeObject,
  sanitizeString,
  isValidFileName,
};
