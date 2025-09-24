/**
 * LLM Errors - Classes de erro específicas para serviços LLM
 * Definições de erros customizados para melhor handling e debugging
 */

/**
 * Erro base para serviços LLM
 */
class LLMError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'LLMError';
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.retryable = false;
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            retryable: this.retryable,
            stack: this.stack
        };
    }
}

/**
 * Erro de rate limiting
 */
class RateLimitError extends LLMError {
    constructor(message, retryAfter = null, details = {}) {
        super(message, details);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter; // milliseconds
        this.retryable = true;
    }
}

/**
 * Erro de timeout
 */
class TimeoutError extends LLMError {
    constructor(message, timeoutDuration = null, details = {}) {
        super(message, details);
        this.name = 'TimeoutError';
        this.timeoutDuration = timeoutDuration;
        this.retryable = true;
    }
}

/**
 * Erro de autenticação
 */
class AuthenticationError extends LLMError {
    constructor(message, provider = null, details = {}) {
        super(message, details);
        this.name = 'AuthenticationError';
        this.provider = provider;
        this.retryable = false;
    }
}

/**
 * Erro de quota/limite de uso
 */
class QuotaExceededError extends LLMError {
    constructor(message, resetTime = null, details = {}) {
        super(message, details);
        this.name = 'QuotaExceededError';
        this.resetTime = resetTime;
        this.retryable = true;
    }
}

/**
 * Erro de formato de resposta
 */
class ResponseFormatError extends LLMError {
    constructor(message, responseData = null, details = {}) {
        super(message, details);
        this.name = 'ResponseFormatError';
        this.responseData = responseData;
        this.retryable = true;
    }
}

/**
 * Erro de validação de entrada
 */
class ValidationError extends LLMError {
    constructor(message, field = null, value = null, details = {}) {
        super(message, details);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
        this.retryable = false;
    }
}

/**
 * Erro de embedding
 */
class EmbeddingError extends LLMError {
    constructor(message, model = null, inputLength = null, details = {}) {
        super(message, details);
        this.name = 'EmbeddingError';
        this.model = model;
        this.inputLength = inputLength;
        this.retryable = true;
    }
}

/**
 * Erro do RAG Service
 */
class RAGError extends LLMError {
    constructor(message, component = null, details = {}) {
        super(message, details);
        this.name = 'RAGError';
        this.component = component; // 'vectordb', 'embeddings', 'search', etc.
        this.retryable = true;
    }
}

/**
 * Erro de busca por similaridade
 */
class SimilaritySearchError extends LLMError {
    constructor(message, algorithm = null, details = {}) {
        super(message, details);
        this.name = 'SimilaritySearchError';
        this.algorithm = algorithm;
        this.retryable = true;
    }
}

/**
 * Erro de vector database
 */
class VectorDBError extends LLMError {
    constructor(message, operation = null, collection = null, details = {}) {
        super(message, details);
        this.name = 'VectorDBError';
        this.operation = operation; // 'query', 'insert', 'update', 'delete'
        this.collection = collection;
        this.retryable = true;
    }
}

/**
 * Erro de configuração
 */
class ConfigurationError extends LLMError {
    constructor(message, configSection = null, details = {}) {
        super(message, details);
        this.name = 'ConfigurationError';
        this.configSection = configSection;
        this.retryable = false;
    }
}

/**
 * Erro de prompt template
 */
class TemplateError extends LLMError {
    constructor(message, templateName = null, details = {}) {
        super(message, details);
        this.name = 'TemplateError';
        this.templateName = templateName;
        this.retryable = false;
    }
}

/**
 * Erro de análise de incidente
 */
class IncidentAnalysisError extends LLMError {
    constructor(message, incidentId = null, stage = null, details = {}) {
        super(message, details);
        this.name = 'IncidentAnalysisError';
        this.incidentId = incidentId;
        this.stage = stage; // 'extraction', 'enrichment', 'analysis', 'generation'
        this.retryable = true;
    }
}

/**
 * Erro de contexto muito longo
 */
class ContextTooLongError extends LLMError {
    constructor(message, actualLength = null, maxLength = null, details = {}) {
        super(message, details);
        this.name = 'ContextTooLongError';
        this.actualLength = actualLength;
        this.maxLength = maxLength;
        this.retryable = false;
    }
}

/**
 * Erro de conteúdo inadequado/inseguro
 */
class ContentSafetyError extends LLMError {
    constructor(message, flaggedContent = null, details = {}) {
        super(message, details);
        this.name = 'ContentSafetyError';
        this.flaggedContent = flaggedContent;
        this.retryable = false;
    }
}

/**
 * Erro de provider indisponível
 */
class ProviderUnavailableError extends LLMError {
    constructor(message, provider = null, details = {}) {
        super(message, details);
        this.name = 'ProviderUnavailableError';
        this.provider = provider;
        this.retryable = true;
    }
}

/**
 * Erro de cache
 */
class CacheError extends LLMError {
    constructor(message, operation = null, details = {}) {
        super(message, details);
        this.name = 'CacheError';
        this.operation = operation; // 'get', 'set', 'delete', 'clear'
        this.retryable = true;
    }
}

/**
 * Utilitários para tratamento de erros
 */
class ErrorHandler {
    /**
     * Determina se um erro é retryable
     */
    static isRetryable(error) {
        if (error instanceof LLMError) {
            return error.retryable;
        }

        // Erros de rede geralmente são retryable
        if (error.code === 'ECONNRESET' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT') {
            return true;
        }

        // Status HTTP retryable
        if (error.status) {
            const retryableStatuses = [408, 429, 500, 502, 503, 504];
            return retryableStatuses.includes(error.status);
        }

        return false;
    }

    /**
     * Calcula delay para retry com backoff exponencial
     */
    static calculateRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, maxDelay);
    }

    /**
     * Extrai informações úteis de erro para logging
     */
    static extractErrorInfo(error) {
        const info = {
            name: error.name || 'Error',
            message: error.message,
            retryable: this.isRetryable(error),
            timestamp: new Date().toISOString()
        };

        if (error instanceof LLMError) {
            info.details = error.details;
            info.llmError = true;
        }

        if (error.code) {
            info.code = error.code;
        }

        if (error.status) {
            info.status = error.status;
        }

        if (error.stack) {
            info.stack = error.stack;
        }

        return info;
    }

    /**
     * Converte erro para resposta API padronizada
     */
    static toAPIResponse(error) {
        const errorInfo = this.extractErrorInfo(error);

        return {
            success: false,
            error: {
                type: errorInfo.name,
                message: errorInfo.message,
                retryable: errorInfo.retryable,
                timestamp: errorInfo.timestamp,
                details: errorInfo.details || {}
            }
        };
    }

    /**
     * Wrapper para retry automático
     */
    static async withRetry(operation, maxAttempts = 3, baseDelay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (attempt === maxAttempts || !this.isRetryable(error)) {
                    throw error;
                }

                const delay = this.calculateRetryDelay(attempt, baseDelay);

                console.warn(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms`, {
                    error: this.extractErrorInfo(error)
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Chain de fallback para múltiplos providers
     */
    static async withFallback(operations, context = {}) {
        const errors = [];

        for (let i = 0; i < operations.length; i++) {
            try {
                const result = await operations[i]();

                if (i > 0) {
                    console.info(`Fallback bem-sucedido na tentativa ${i + 1}`, context);
                }

                return result;
            } catch (error) {
                errors.push({
                    attempt: i + 1,
                    error: this.extractErrorInfo(error)
                });

                if (i === operations.length - 1) {
                    // Última tentativa
                    const compositeError = new LLMError(
                        'Todas as tentativas de fallback falharam',
                        { errors, context }
                    );
                    throw compositeError;
                }

                console.warn(`Tentativa ${i + 1} falhou, tentando fallback`, {
                    error: this.extractErrorInfo(error),
                    context
                });
            }
        }
    }
}

module.exports = {
    // Classes de erro
    LLMError,
    RateLimitError,
    TimeoutError,
    AuthenticationError,
    QuotaExceededError,
    ResponseFormatError,
    ValidationError,
    EmbeddingError,
    RAGError,
    SimilaritySearchError,
    VectorDBError,
    ConfigurationError,
    TemplateError,
    IncidentAnalysisError,
    ContextTooLongError,
    ContentSafetyError,
    ProviderUnavailableError,
    CacheError,

    // Utilitários
    ErrorHandler
};