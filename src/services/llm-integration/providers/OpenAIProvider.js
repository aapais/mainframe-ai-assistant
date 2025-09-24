/**
 * OpenAI Provider - Integração específica com OpenAI API
 * Implementa funcionalidades específicas do OpenAI GPT-4 e embeddings
 */

const { OpenAI } = require('openai');
const logger = require('../../../core/logging/Logger');
const {
    AuthenticationError,
    RateLimitError,
    QuotaExceededError,
    TimeoutError,
    ResponseFormatError,
    ErrorHandler
} = require('../utils/LLMErrors');

class OpenAIProvider {
    constructor(config = {}) {
        this.config = {
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            organization: config.organization || process.env.OPENAI_ORG_ID,
            baseURL: config.baseURL || 'https://api.openai.com/v1',
            timeout: config.timeout || 30000,
            maxRetries: config.maxRetries || 3,
            models: {
                chat: config.models?.chat || 'gpt-4-turbo-preview',
                embedding: config.models?.embedding || 'text-embedding-3-small',
                fallbackChat: config.models?.fallbackChat || 'gpt-3.5-turbo'
            },
            defaults: {
                maxTokens: config.defaults?.maxTokens || 4000,
                temperature: config.defaults?.temperature || 0.3,
                topP: config.defaults?.topP || 1.0,
                frequencyPenalty: config.defaults?.frequencyPenalty || 0,
                presencePenalty: config.defaults?.presencePenalty || 0
            }
        };

        this.initialize();
    }

    /**
     * Inicializa cliente OpenAI
     */
    initialize() {
        try {
            this.client = new OpenAI({
                apiKey: this.config.apiKey,
                organization: this.config.organization,
                baseURL: this.config.baseURL,
                timeout: this.config.timeout,
                maxRetries: 0 // Gerenciamos retry manualmente
            });

            logger.info('OpenAI Provider inicializado', {
                model: this.config.models.chat,
                embeddingModel: this.config.models.embedding,
                hasOrganization: !!this.config.organization
            });
        } catch (error) {
            logger.error('Erro ao inicializar OpenAI Provider', { error: error.message });
            throw new AuthenticationError(`Falha na inicialização OpenAI: ${error.message}`, 'openai');
        }
    }

    /**
     * Executa chat completion com retry e fallback
     */
    async chatCompletion(messages, options = {}) {
        const config = {
            model: options.model || this.config.models.chat,
            messages: this.formatMessages(messages),
            max_tokens: options.maxTokens || this.config.defaults.maxTokens,
            temperature: options.temperature ?? this.config.defaults.temperature,
            top_p: options.topP ?? this.config.defaults.topP,
            frequency_penalty: options.frequencyPenalty ?? this.config.defaults.frequencyPenalty,
            presence_penalty: options.presencePenalty ?? this.config.defaults.presencePenalty,
            response_format: options.responseFormat || { type: 'text' },
            stream: options.stream || false
        };

        return ErrorHandler.withRetry(async () => {
            try {
                const startTime = Date.now();

                const response = await this.client.chat.completions.create(config);

                const duration = Date.now() - startTime;

                logger.info('OpenAI chat completion realizada', {
                    model: config.model,
                    tokens: response.usage?.total_tokens,
                    duration
                });

                return this.formatChatResponse(response);

            } catch (error) {
                throw this.handleAPIError(error, 'chat_completion');
            }
        }, this.config.maxRetries);
    }

    /**
     * Executa chat completion com fallback automático
     */
    async chatCompletionWithFallback(messages, options = {}) {
        const operations = [
            // Tentativa principal
            () => this.chatCompletion(messages, {
                ...options,
                model: this.config.models.chat
            }),
            // Fallback para modelo menor
            () => this.chatCompletion(messages, {
                ...options,
                model: this.config.models.fallbackChat,
                maxTokens: Math.min(options.maxTokens || 4000, 2000)
            })
        ];

        return ErrorHandler.withFallback(operations, {
            provider: 'openai',
            operation: 'chat_completion_fallback'
        });
    }

    /**
     * Gera embeddings para texto
     */
    async createEmbedding(input, options = {}) {
        const config = {
            model: options.model || this.config.models.embedding,
            input: Array.isArray(input) ? input : [input],
            encoding_format: options.encodingFormat || 'float',
            dimensions: options.dimensions || undefined
        };

        return ErrorHandler.withRetry(async () => {
            try {
                const startTime = Date.now();

                const response = await this.client.embeddings.create(config);

                const duration = Date.now() - startTime;

                logger.info('OpenAI embedding criado', {
                    model: config.model,
                    inputCount: config.input.length,
                    dimensions: response.data[0]?.embedding?.length,
                    duration
                });

                return this.formatEmbeddingResponse(response);

            } catch (error) {
                throw this.handleAPIError(error, 'embedding');
            }
        }, this.config.maxRetries);
    }

    /**
     * Lista modelos disponíveis
     */
    async listModels() {
        try {
            const response = await this.client.models.list();

            return response.data.map(model => ({
                id: model.id,
                object: model.object,
                created: model.created,
                ownedBy: model.owned_by
            }));
        } catch (error) {
            throw this.handleAPIError(error, 'list_models');
        }
    }

    /**
     * Formata mensagens para formato OpenAI
     */
    formatMessages(messages) {
        if (typeof messages === 'string') {
            return [{ role: 'user', content: messages }];
        }

        if (Array.isArray(messages)) {
            return messages.map(msg => {
                if (typeof msg === 'string') {
                    return { role: 'user', content: msg };
                }
                return {
                    role: msg.role || 'user',
                    content: msg.content || msg.text || '',
                    name: msg.name
                };
            });
        }

        throw new Error('Messages deve ser string ou array');
    }

    /**
     * Formata resposta de chat
     */
    formatChatResponse(response) {
        if (!response.choices || response.choices.length === 0) {
            throw new ResponseFormatError('Resposta OpenAI sem choices');
        }

        const choice = response.choices[0];

        return {
            content: choice.message?.content || '',
            role: choice.message?.role || 'assistant',
            finishReason: choice.finish_reason,
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0
            },
            model: response.model,
            created: response.created,
            id: response.id
        };
    }

    /**
     * Formata resposta de embedding
     */
    formatEmbeddingResponse(response) {
        if (!response.data || response.data.length === 0) {
            throw new ResponseFormatError('Resposta OpenAI embedding sem data');
        }

        return {
            embeddings: response.data.map(item => ({
                embedding: item.embedding,
                index: item.index
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0
            },
            model: response.model
        };
    }

    /**
     * Manipula erros da API OpenAI
     */
    handleAPIError(error, operation) {
        logger.error('Erro na API OpenAI', {
            operation,
            error: error.message,
            status: error.status,
            type: error.type
        });

        // Rate limiting
        if (error.status === 429) {
            const retryAfter = error.headers?.['retry-after'] ?
                parseInt(error.headers['retry-after']) * 1000 : 60000;

            return new RateLimitError(
                `OpenAI rate limit atingido: ${error.message}`,
                retryAfter,
                { operation, status: error.status }
            );
        }

        // Quota exceeded
        if (error.status === 402 || error.type === 'insufficient_quota') {
            return new QuotaExceededError(
                `Quota OpenAI excedida: ${error.message}`,
                null,
                { operation, status: error.status }
            );
        }

        // Authentication
        if (error.status === 401 || error.status === 403) {
            return new AuthenticationError(
                `Falha na autenticação OpenAI: ${error.message}`,
                'openai',
                { operation, status: error.status }
            );
        }

        // Timeout
        if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            return new TimeoutError(
                `Timeout OpenAI: ${error.message}`,
                this.config.timeout,
                { operation }
            );
        }

        // Response format issues
        if (error.status === 400 && error.message.includes('format')) {
            return new ResponseFormatError(
                `Formato de resposta inválido: ${error.message}`,
                null,
                { operation, status: error.status }
            );
        }

        // Erro genérico
        return new Error(`OpenAI API Error (${operation}): ${error.message}`);
    }

    /**
     * Health check do provider
     */
    async healthCheck() {
        try {
            // Testa com um prompt simples
            const response = await this.chatCompletion([
                { role: 'user', content: 'Health check test. Respond with "OK".' }
            ], {
                maxTokens: 10,
                temperature: 0
            });

            return {
                status: 'healthy',
                provider: 'openai',
                model: this.config.models.chat,
                embeddingModel: this.config.models.embedding,
                responseTime: response.usage?.totalTokens ? 'normal' : 'fast',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                provider: 'openai',
                error: error.message,
                errorType: error.name,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Calcula custo estimado de tokens
     */
    calculateCost(usage, model = null) {
        const modelName = model || this.config.models.chat;

        // Preços aproximados por 1k tokens (sujeitos a mudança)
        const pricing = {
            'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
            'gpt-4': { input: 0.03, output: 0.06 },
            'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
            'text-embedding-3-small': { input: 0.00002, output: 0 }
        };

        const prices = pricing[modelName] || pricing['gpt-3.5-turbo'];

        const inputCost = (usage.promptTokens / 1000) * prices.input;
        const outputCost = (usage.completionTokens / 1000) * prices.output;

        return {
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
            currency: 'USD',
            model: modelName
        };
    }

    /**
     * Obtém estatísticas do provider
     */
    getStats() {
        return {
            provider: 'openai',
            config: {
                model: this.config.models.chat,
                embeddingModel: this.config.models.embedding,
                maxTokens: this.config.defaults.maxTokens,
                temperature: this.config.defaults.temperature
            },
            limits: {
                maxTokens: this.getModelLimits(this.config.models.chat),
                timeout: this.config.timeout,
                maxRetries: this.config.maxRetries
            }
        };
    }

    /**
     * Obtém limites do modelo
     */
    getModelLimits(model) {
        const limits = {
            'gpt-4-turbo-preview': 128000,
            'gpt-4': 8192,
            'gpt-3.5-turbo': 16385,
            'text-embedding-3-small': 8191
        };

        return limits[model] || 4096;
    }

    /**
     * Valida configuração
     */
    validateConfig() {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key é obrigatória');
        }

        if (this.config.timeout < 5000) {
            logger.warn('Timeout muito baixo para OpenAI', { timeout: this.config.timeout });
        }

        if (this.config.defaults.temperature < 0 || this.config.defaults.temperature > 2) {
            throw new Error('Temperature deve estar entre 0 e 2');
        }

        return true;
    }
}

module.exports = OpenAIProvider;