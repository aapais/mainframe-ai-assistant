/**
 * Input Validator - Validação e sanitização de entradas para serviços LLM
 * Garante segurança e qualidade dos dados de entrada
 */

const logger = require('../../../core/logging/Logger');

/**
 * Valida dados do incidente
 */
function validateIncident(incident) {
  if (!incident || typeof incident !== 'object') {
    throw new Error('Incident deve ser um objeto válido');
  }

  const required = ['id', 'title', 'description', 'type'];
  for (const field of required) {
    if (!incident[field]) {
      throw new Error(`Campo obrigatório ausente: ${field}`);
    }
  }

  if (incident.title.length > 200) {
    throw new Error('Título muito longo (máximo 200 caracteres)');
  }

  if (incident.description.length > 10000) {
    throw new Error('Descrição muito longa (máximo 10000 caracteres)');
  }

  return incident;
}

/**
 * Sanitiza entrada de texto
 */
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return sanitizeText(input);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => (typeof item === 'string' ? sanitizeText(item) : item));
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return input;
}

/**
 * Sanitiza texto individual
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Remove caracteres de controle perigosos
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove sequências de escape potencialmente perigosas
  sanitized = sanitized.replace(/\\[rn]/g, ' ');

  // Limita tamanho
  if (sanitized.length > 50000) {
    sanitized = sanitized.substring(0, 50000) + '...';
  }

  return sanitized.trim();
}

/**
 * Valida query RAG
 */
function validateQuery(query) {
  if (typeof query === 'string') {
    if (query.trim().length === 0) {
      throw new Error('Query não pode estar vazia');
    }
    if (query.length > 5000) {
      throw new Error('Query muito longa (máximo 5000 caracteres)');
    }
    return query.trim();
  }

  if (typeof query === 'object' && query !== null) {
    if (!query.text || typeof query.text !== 'string') {
      throw new Error('Query object deve conter campo text válido');
    }

    return {
      ...query,
      text: validateQuery(query.text),
    };
  }

  throw new Error('Query deve ser string ou objeto com campo text');
}

/**
 * Valida query de busca por similaridade
 */
function validateSearchQuery(searchQuery) {
  if (!searchQuery || typeof searchQuery !== 'object') {
    throw new Error('Search query deve ser um objeto válido');
  }

  if (!searchQuery.text || typeof searchQuery.text !== 'string') {
    throw new Error('Search query deve conter campo text válido');
  }

  if (searchQuery.text.trim().length === 0) {
    throw new Error('Texto da busca não pode estar vazio');
  }

  if (searchQuery.threshold !== undefined) {
    if (
      typeof searchQuery.threshold !== 'number' ||
      searchQuery.threshold < 0 ||
      searchQuery.threshold > 1
    ) {
      throw new Error('Threshold deve ser um número entre 0 e 1');
    }
  }

  if (searchQuery.limit !== undefined) {
    if (!Number.isInteger(searchQuery.limit) || searchQuery.limit < 1 || searchQuery.limit > 100) {
      throw new Error('Limit deve ser um inteiro entre 1 e 100');
    }
  }

  return searchQuery;
}

/**
 * Sanitiza entrada de busca
 */
function sanitizeSearchInput(searchQuery) {
  return {
    ...searchQuery,
    text: sanitizeText(searchQuery.text),
    filters: searchQuery.filters ? sanitizeFilters(searchQuery.filters) : {},
  };
}

/**
 * Sanitiza filtros de busca
 */
function sanitizeFilters(filters) {
  const sanitized = {};

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => (typeof item === 'string' ? sanitizeText(item) : item));
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitiza conteúdo de documento
 */
function sanitizeContent(content) {
  if (typeof content === 'string') {
    return sanitizeText(content);
  }

  if (typeof content === 'object' && content !== null) {
    if (content.text) {
      return {
        ...content,
        text: sanitizeText(content.text),
      };
    }
  }

  return content;
}

/**
 * Valida configuração de LLM
 */
function validateLLMConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuração LLM deve ser um objeto válido');
  }

  // Valida providers
  if (config.providers) {
    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      if (providerConfig.enabled && !providerConfig.apiKey) {
        logger.warn(`Provider ${providerName} habilitado mas sem API key`);
      }

      if (
        providerConfig.maxTokens &&
        (!Number.isInteger(providerConfig.maxTokens) ||
          providerConfig.maxTokens < 100 ||
          providerConfig.maxTokens > 100000)
      ) {
        throw new Error(`maxTokens inválido para provider ${providerName}`);
      }

      if (
        providerConfig.temperature &&
        (typeof providerConfig.temperature !== 'number' ||
          providerConfig.temperature < 0 ||
          providerConfig.temperature > 2)
      ) {
        throw new Error(`temperature inválida para provider ${providerName}`);
      }
    }
  }

  return config;
}

/**
 * Valida embedding
 */
function validateEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    throw new Error('Embedding deve ser um array');
  }

  if (embedding.length === 0) {
    throw new Error('Embedding não pode estar vazio');
  }

  if (embedding.some(val => typeof val !== 'number' || !isFinite(val))) {
    throw new Error('Embedding deve conter apenas números finitos');
  }

  return embedding;
}

/**
 * Valida metadados de documento
 */
function validateDocumentMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const sanitized = {};

  // Lista de campos permitidos
  const allowedFields = [
    'title',
    'category',
    'source',
    'source_type',
    'timestamp',
    'author',
    'version',
    'tags',
    'language',
    'verified',
  ];

  for (const [key, value] of Object.entries(metadata)) {
    if (allowedFields.includes(key)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => (typeof item === 'string' ? sanitizeText(item) : item));
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Detecta e remove conteúdo potencialmente malicioso
 */
function detectMaliciousContent(text) {
  if (typeof text !== 'string') {
    return false;
  }

  const maliciousPatterns = [
    // Injection patterns
    /;\s*DROP\s+TABLE/i,
    /'\s*OR\s+'1'\s*=\s*'1/i,
    /<script[^>]*>/i,
    /javascript:/i,

    // Command injection
    /;\s*rm\s+-rf/i,
    /&&\s*cat\s+/i,
    /\|\s*nc\s+/i,

    // Prompt injection
    /ignore\s+previous\s+instructions/i,
    /you\s+are\s+now\s+a\s+different/i,
    /forget\s+everything\s+above/i,
  ];

  return maliciousPatterns.some(pattern => pattern.test(text));
}

/**
 * Limpa texto de padrões maliciosos
 */
function cleanMaliciousContent(text) {
  if (typeof text !== 'string') {
    return text;
  }

  if (detectMaliciousContent(text)) {
    logger.warn('Conteúdo potencialmente malicioso detectado e removido');

    // Remove padrões suspeitos
    let cleaned = text;

    // Remove tentativas de injection SQL
    cleaned = cleaned.replace(/;\s*DROP\s+TABLE[^;]*/gi, '');
    cleaned = cleaned.replace(/'[^']*OR[^']*'[^']*=[^']*'/gi, '');

    // Remove scripts
    cleaned = cleaned.replace(/<script[^>]*>.*?<\/script>/gi, '');
    cleaned = cleaned.replace(/javascript:[^"']*/gi, '');

    // Remove tentativas de prompt injection
    cleaned = cleaned.replace(/ignore\s+previous\s+instructions[^.!?]*/gi, '');
    cleaned = cleaned.replace(/you\s+are\s+now\s+a\s+different[^.!?]*/gi, '');

    return cleaned.trim();
  }

  return text;
}

/**
 * Rate limiting validation
 */
function validateRateLimit(requestCount, timeWindow, maxRequests) {
  if (requestCount > maxRequests) {
    throw new Error(`Rate limit excedido: ${requestCount}/${maxRequests} em ${timeWindow}ms`);
  }
  return true;
}

module.exports = {
  validateIncident,
  sanitizeInput,
  sanitizeText,
  validateQuery,
  validateSearchQuery,
  sanitizeSearchInput,
  sanitizeFilters,
  sanitizeContent,
  validateLLMConfig,
  validateEmbedding,
  validateDocumentMetadata,
  detectMaliciousContent,
  cleanMaliciousContent,
  validateRateLimit,
};
