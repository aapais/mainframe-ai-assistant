/**
 * LLM Service - Advanced Multi-Provider LLM Integration for Banking Systems
 * Supports OpenAI, Claude, Azure OpenAI with intelligent fallback and RAG capabilities
 */

const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { AzureOpenAI } = require('openai');
const logger = require('../../core/logging/Logger');
const PromptTemplateManager = require('./PromptTemplateManager');
const RAGPipeline = require('./RAGPipeline');
const EmbeddingService = require('./EmbeddingService');
const { validateInput, sanitizeBankingData } = require('./utils/InputValidator');
const { LLMError, RateLimitError, TimeoutError, ComplianceError } = require('./utils/LLMErrors');

class LLMService {
  constructor(config = {}) {
    this.config = {
      providers: {
        openai: {
          enabled: config.openai?.enabled ?? true,
          apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY,
          model: config.openai?.model || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          maxTokens: config.openai?.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
          temperature:
            config.openai?.temperature || parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3,
          timeout: config.openai?.timeout || parseInt(process.env.OPENAI_TIMEOUT) || 30000,
        },
        claude: {
          enabled: config.claude?.enabled ?? true,
          apiKey: config.claude?.apiKey || process.env.ANTHROPIC_API_KEY,
          model: config.claude?.model || process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
          maxTokens: config.claude?.maxTokens || parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 4000,
          temperature:
            config.claude?.temperature || parseFloat(process.env.ANTHROPIC_TEMPERATURE) || 0.3,
          timeout: config.claude?.timeout || parseInt(process.env.ANTHROPIC_TIMEOUT) || 30000,
        },
        azure: {
          enabled: config.azure?.enabled ?? true,
          apiKey: config.azure?.apiKey || process.env.AZURE_OPENAI_API_KEY,
          endpoint: config.azure?.endpoint || process.env.AZURE_OPENAI_ENDPOINT,
          deploymentName:
            config.azure?.deploymentName || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
          apiVersion:
            config.azure?.apiVersion || process.env.AZURE_OPENAI_VERSION || '2023-12-01-preview',
          maxTokens: config.azure?.maxTokens || parseInt(process.env.AZURE_MAX_TOKENS) || 4000,
          temperature:
            config.azure?.temperature || parseFloat(process.env.AZURE_TEMPERATURE) || 0.3,
        },
      },
      fallback: {
        enabled: config.fallback?.enabled ?? process.env.LLM_ENABLE_FALLBACK === 'true',
        primaryProvider:
          config.fallback?.primaryProvider || process.env.LLM_PRIMARY_PROVIDER || 'openai',
        fallbackProviders:
          config.fallback?.fallbackProviders ||
          (process.env.LLM_FALLBACK_PROVIDERS
            ? process.env.LLM_FALLBACK_PROVIDERS.split(',')
            : ['claude', 'azure']),
        maxRetries: config.fallback?.maxRetries || parseInt(process.env.LLM_RETRY_ATTEMPTS) || 3,
        retryDelay: config.fallback?.retryDelay || parseInt(process.env.LLM_RETRY_DELAY_MS) || 1000,
      },
      rateLimit: {
        rpm: config.rateLimit?.rpm || parseInt(process.env.LLM_RATE_LIMIT_RPM) || 60,
        tpm: config.rateLimit?.tpm || parseInt(process.env.LLM_RATE_LIMIT_TPM) || 100000,
        window: config.rateLimit?.window || parseInt(process.env.LLM_RATE_LIMIT_WINDOW) || 60000,
      },
      compliance: {
        mode: config.compliance?.mode || process.env.LLM_COMPLIANCE_MODE || 'strict',
        anonymizeData:
          config.compliance?.anonymizeData ?? process.env.LLM_ANONYMIZE_DATA === 'true',
        logOperations:
          config.compliance?.logOperations ?? process.env.LLM_LOG_OPERATIONS === 'true',
        encryptLogs: config.compliance?.encryptLogs ?? process.env.LLM_ENCRYPT_LOGS === 'true',
      },
      features: {
        ragEnabled: config.features?.ragEnabled ?? process.env.RAG_ENABLED === 'true',
        semanticSearch:
          config.features?.semanticSearch ?? process.env.LLM_ENABLE_SEMANTIC_SEARCH === 'true',
        fraudDetection:
          config.features?.fraudDetection ?? process.env.LLM_ENABLE_FRAUD_DETECTION === 'true',
        complianceCheck:
          config.features?.complianceCheck ?? process.env.LLM_ENABLE_COMPLIANCE_CHECK === 'true',
      },
    };

    this.clients = {};
    this.promptManager = new PromptTemplateManager();
    this.ragPipeline = this.config.features.ragEnabled ? new RAGPipeline() : null;
    this.embeddingService = new EmbeddingService();

    this.metrics = {
      requests: new Map(),
      tokens: new Map(),
      costs: new Map(),
      errors: new Map(),
      latency: new Map(),
    };

    this.rateLimiter = new Map();
    this.initializeClients();
  }

  /**
   * Initialize LLM provider clients
   */
  initializeClients() {
    try {
      // OpenAI Client
      if (this.config.providers.openai.enabled && this.config.providers.openai.apiKey) {
        this.clients.openai = new OpenAI({
          apiKey: this.config.providers.openai.apiKey,
          timeout: this.config.providers.openai.timeout,
        });
        logger.info('OpenAI client initialized');
      }

      // Claude Client
      if (this.config.providers.claude.enabled && this.config.providers.claude.apiKey) {
        this.clients.claude = new Anthropic({
          apiKey: this.config.providers.claude.apiKey,
          timeout: this.config.providers.claude.timeout,
        });
        logger.info('Claude client initialized');
      }

      // Azure OpenAI Client
      if (this.config.providers.azure.enabled && this.config.providers.azure.apiKey) {
        this.clients.azure = new AzureOpenAI({
          apiKey: this.config.providers.azure.apiKey,
          endpoint: this.config.providers.azure.endpoint,
          apiVersion: this.config.providers.azure.apiVersion,
          timeout: this.config.providers.azure.timeout,
        });
        logger.info('Azure OpenAI client initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize LLM clients:', error);
      throw new LLMError('Client initialization failed', error);
    }
  }

  /**
   * Generate response using primary provider with fallback
   */
  async generateResponse(prompt, options = {}) {
    const startTime = Date.now();
    let lastError;

    try {
      // Validate and sanitize input
      await this.validateInput(prompt, options);

      // Apply compliance filters
      const sanitizedPrompt = await this.applySanitization(prompt, options);

      // Check rate limits
      await this.checkRateLimit(options.provider || this.config.fallback.primaryProvider);

      // Enhanced RAG if enabled
      let enhancedPrompt = sanitizedPrompt;
      if (this.config.features.ragEnabled && options.useRAG !== false) {
        enhancedPrompt = await this.enhanceWithRAG(sanitizedPrompt, options);
      }

      // Try primary provider first
      const primaryProvider = options.provider || this.config.fallback.primaryProvider;
      try {
        const response = await this.callProvider(primaryProvider, enhancedPrompt, options);
        await this.logMetrics(primaryProvider, startTime, response);
        return response;
      } catch (error) {
        lastError = error;
        logger.warn(`Primary provider ${primaryProvider} failed:`, error.message);
      }

      // Try fallback providers if enabled
      if (this.config.fallback.enabled && !options.noFallback) {
        for (const provider of this.config.fallback.fallbackProviders) {
          if (provider === primaryProvider || !this.clients[provider]) continue;

          try {
            logger.info(`Attempting fallback to ${provider}`);
            const response = await this.callProvider(provider, enhancedPrompt, options);
            await this.logMetrics(provider, startTime, response, true);
            return response;
          } catch (error) {
            lastError = error;
            logger.warn(`Fallback provider ${provider} failed:`, error.message);
          }
        }
      }

      throw new LLMError('All providers failed', lastError);
    } catch (error) {
      await this.logError(error, options);
      throw error;
    }
  }

  /**
   * Call specific LLM provider
   */
  async callProvider(provider, prompt, options = {}) {
    const client = this.clients[provider];
    if (!client) {
      throw new LLMError(`Provider ${provider} not available`);
    }

    const providerConfig = this.config.providers[provider];

    try {
      switch (provider) {
        case 'openai':
          return await this.callOpenAI(client, prompt, options, providerConfig);
        case 'claude':
          return await this.callClaude(client, prompt, options, providerConfig);
        case 'azure':
          return await this.callAzure(client, prompt, options, providerConfig);
        default:
          throw new LLMError(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      if (error.status === 429) {
        throw new RateLimitError(`Rate limit exceeded for ${provider}`, error);
      }
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        throw new TimeoutError(`Timeout for ${provider}`, error);
      }
      throw new LLMError(`Provider ${provider} error`, error);
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(client, prompt, options, config) {
    const messages = this.formatMessages(prompt, options);

    const response = await client.chat.completions.create({
      model: options.model || config.model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens || config.maxTokens,
      top_p: options.topP || 1,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0,
      stream: options.stream || false,
    });

    return {
      content: response.choices[0].message.content,
      provider: 'openai',
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
      metadata: {
        id: response.id,
        created: response.created,
        systemFingerprint: response.system_fingerprint,
      },
    };
  }

  /**
   * Call Claude API
   */
  async callClaude(client, prompt, options, config) {
    const messages = this.formatMessages(prompt, options, 'claude');

    const response = await client.messages.create({
      model: options.model || config.model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens || config.maxTokens,
      top_p: options.topP || 1,
      stream: options.stream || false,
    });

    return {
      content: response.content[0].text,
      provider: 'claude',
      model: response.model,
      usage: response.usage,
      finishReason: response.stop_reason,
      metadata: {
        id: response.id,
        type: response.type,
        role: response.role,
      },
    };
  }

  /**
   * Call Azure OpenAI API
   */
  async callAzure(client, prompt, options, config) {
    const messages = this.formatMessages(prompt, options);

    const response = await client.chat.completions.create({
      model: config.deploymentName,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens || config.maxTokens,
      top_p: options.topP || 1,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0,
      stream: options.stream || false,
    });

    return {
      content: response.choices[0].message.content,
      provider: 'azure',
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
      metadata: {
        id: response.id,
        created: response.created,
      },
    };
  }

  /**
   * Enhanced RAG integration
   */
  async enhanceWithRAG(prompt, options) {
    if (!this.ragPipeline) return prompt;

    try {
      const context = await this.ragPipeline.retrieve(prompt, {
        topK: options.ragTopK || parseInt(process.env.RAG_TOP_K_RESULTS) || 5,
        threshold: options.ragThreshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
        filters: options.ragFilters,
        rerank: options.ragRerank ?? process.env.RAG_RERANK_RESULTS === 'true',
      });

      if (context.length > 0) {
        const contextText = context.map(item => item.content).join('\n\n');
        return `Context:\n${contextText}\n\nQuery: ${prompt}`;
      }
    } catch (error) {
      logger.warn('RAG enhancement failed, using original prompt:', error.message);
    }

    return prompt;
  }

  /**
   * Banking-specific analysis methods
   */
  async analyzeFraudRisk(transactionData, options = {}) {
    if (!this.config.features.fraudDetection) {
      throw new ComplianceError('Fraud detection feature not enabled');
    }

    const template = await this.promptManager.getTemplate('fraud_detection');
    const prompt = template.format({
      transaction: await this.sanitizeTransactionData(transactionData),
      context: options.context || '',
    });

    return await this.generateResponse(prompt, {
      ...options,
      useRAG: true,
      ragFilters: { type: 'fraud_patterns' },
    });
  }

  async checkCompliance(document, regulations, options = {}) {
    if (!this.config.features.complianceCheck) {
      throw new ComplianceError('Compliance check feature not enabled');
    }

    const template = await this.promptManager.getTemplate('compliance_check');
    const prompt = template.format({
      document: await this.sanitizeDocument(document),
      regulations: regulations,
      severity: options.severity || 'high',
    });

    return await this.generateResponse(prompt, {
      ...options,
      useRAG: true,
      ragFilters: { type: 'regulations' },
    });
  }

  async analyzeRisk(data, riskType, options = {}) {
    const template = await this.promptManager.getTemplate('risk_analysis');
    const prompt = template.format({
      data: await this.sanitizeBankingData(data),
      riskType,
      criteria: options.criteria || 'standard',
    });

    return await this.generateResponse(prompt, {
      ...options,
      useRAG: true,
      ragFilters: { type: 'risk_models' },
    });
  }

  /**
   * Utility methods
   */
  formatMessages(prompt, options, provider = 'openai') {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }

    if (Array.isArray(prompt)) {
      return prompt;
    }

    throw new LLMError('Invalid prompt format');
  }

  async validateInput(prompt, options) {
    if (!prompt || (typeof prompt === 'string' && prompt.trim() === '')) {
      throw new LLMError('Prompt cannot be empty');
    }

    if (this.config.compliance.mode === 'strict') {
      const validation = await validateInput(prompt, options);
      if (!validation.isValid) {
        throw new ComplianceError(`Input validation failed: ${validation.errors.join(', ')}`);
      }
    }
  }

  async applySanitization(prompt, options) {
    if (!this.config.compliance.anonymizeData) return prompt;

    if (typeof prompt === 'string') {
      return await sanitizeBankingData(prompt);
    }

    if (Array.isArray(prompt)) {
      return await Promise.all(
        prompt.map(async msg => ({
          ...msg,
          content: await sanitizeBankingData(msg.content),
        }))
      );
    }

    return prompt;
  }

  async sanitizeTransactionData(data) {
    return await sanitizeBankingData(JSON.stringify(data));
  }

  async sanitizeDocument(document) {
    return await sanitizeBankingData(document);
  }

  async checkRateLimit(provider) {
    const now = Date.now();
    const window = this.config.rateLimit.window;
    const limit = this.config.rateLimit.rpm;

    if (!this.rateLimiter.has(provider)) {
      this.rateLimiter.set(provider, []);
    }

    const requests = this.rateLimiter.get(provider);
    const validRequests = requests.filter(time => now - time < window);

    if (validRequests.length >= limit) {
      throw new RateLimitError(`Rate limit exceeded for ${provider}`);
    }

    validRequests.push(now);
    this.rateLimiter.set(provider, validRequests);
  }

  async logMetrics(provider, startTime, response, isFallback = false) {
    const latency = Date.now() - startTime;
    const tokens = response.usage?.total_tokens || 0;

    // Update metrics
    this.updateMetric('requests', provider, 1);
    this.updateMetric('tokens', provider, tokens);
    this.updateMetric('latency', provider, latency);

    if (isFallback) {
      this.updateMetric('fallbacks', provider, 1);
    }

    if (this.config.compliance.logOperations) {
      logger.info('LLM Request', {
        provider,
        model: response.model,
        tokens,
        latency,
        isFallback,
        finishReason: response.finishReason,
      });
    }
  }

  async logError(error, options) {
    this.updateMetric('errors', options.provider || 'unknown', 1);

    if (this.config.compliance.logOperations) {
      logger.error('LLM Error', {
        error: error.message,
        provider: options.provider,
        type: error.constructor.name,
        stack: error.stack,
      });
    }
  }

  updateMetric(type, provider, value) {
    if (!this.metrics[type].has(provider)) {
      this.metrics[type].set(provider, []);
    }
    this.metrics[type].get(provider).push({
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    const summary = {};

    for (const [type, providerMap] of this.metrics.entries()) {
      summary[type] = {};
      for (const [provider, values] of providerMap.entries()) {
        const recentValues = values.filter(v => Date.now() - v.timestamp < 3600000); // Last hour
        summary[type][provider] = {
          count: recentValues.length,
          total: recentValues.reduce((sum, v) => sum + v.value, 0),
          average:
            recentValues.length > 0
              ? recentValues.reduce((sum, v) => sum + v.value, 0) / recentValues.length
              : 0,
        };
      }
    }

    return summary;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      providers: {},
      features: {
        rag: this.config.features.ragEnabled,
        embeddings: !!this.embeddingService,
        compliance: this.config.compliance.mode,
      },
      metrics: this.getMetrics(),
    };

    for (const [name, client] of Object.entries(this.clients)) {
      try {
        // Simple health check - attempt a minimal request
        const testResponse = await this.callProvider(name, 'Health check', {
          maxTokens: 10,
          noFallback: true,
        });
        health.providers[name] = {
          status: 'healthy',
          model: testResponse.model,
        };
      } catch (error) {
        health.providers[name] = {
          status: 'unhealthy',
          error: error.message,
        };
        health.status = 'degraded';
      }
    }

    return health;
  }
}

module.exports = LLMService;
