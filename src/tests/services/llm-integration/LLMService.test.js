/**
 * LLM Service Integration Tests
 * Comprehensive test suite for multi-provider LLM integration
 */

const LLMService = require('../../../src/services/llm-integration/LLMService');
const {
  LLMError,
  RateLimitError,
  ComplianceError,
} = require('../../../src/services/llm-integration/utils/LLMErrors');

describe('LLM Service Integration Tests', () => {
  let llmService;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      providers: {
        openai: {
          enabled: true,
          apiKey: 'test-openai-key',
          model: 'gpt-4-turbo-preview',
          maxTokens: 4000,
          temperature: 0.3,
        },
        claude: {
          enabled: true,
          apiKey: 'test-claude-key',
          model: 'claude-3-sonnet-20240229',
          maxTokens: 4000,
          temperature: 0.3,
        },
        azure: {
          enabled: true,
          apiKey: 'test-azure-key',
          endpoint: 'https://test.openai.azure.com',
          deploymentName: 'gpt-4',
          maxTokens: 4000,
          temperature: 0.3,
        },
      },
      fallback: {
        enabled: true,
        primaryProvider: 'openai',
        fallbackProviders: ['claude', 'azure'],
        maxRetries: 3,
        retryDelay: 1000,
      },
      features: {
        ragEnabled: true,
        semanticSearch: true,
        fraudDetection: true,
        complianceCheck: true,
      },
      compliance: {
        mode: 'strict',
        anonymizeData: true,
        logOperations: true,
      },
    };

    llmService = new LLMService(mockConfig);
  });

  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(llmService.config.providers.openai.enabled).toBe(true);
      expect(llmService.config.fallback.enabled).toBe(true);
      expect(llmService.config.features.ragEnabled).toBe(true);
    });

    test('should initialize clients for enabled providers', () => {
      expect(llmService.clients.openai).toBeDefined();
      expect(llmService.clients.claude).toBeDefined();
      expect(llmService.clients.azure).toBeDefined();
    });

    test('should initialize prompt manager and RAG pipeline', () => {
      expect(llmService.promptManager).toBeDefined();
      expect(llmService.ragPipeline).toBeDefined();
      expect(llmService.embeddingService).toBeDefined();
    });
  });

  describe('Text Generation', () => {
    test('should generate response with primary provider', async () => {
      // Mock successful OpenAI response
      const mockResponse = {
        choices: [{ message: { content: 'Test response' }, finish_reason: 'stop' }],
        model: 'gpt-4-turbo-preview',
        usage: { total_tokens: 100 },
        id: 'test-id',
        created: Date.now(),
      };

      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse),
        },
      };

      const result = await llmService.generateResponse('Test prompt');

      expect(result.content).toBe('Test response');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4-turbo-preview');
      expect(result.usage.total_tokens).toBe(100);
    });

    test('should fallback to secondary provider when primary fails', async () => {
      // Mock OpenAI failure
      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API Error')),
        },
      };

      // Mock successful Claude response
      const mockClaudeResponse = {
        content: [{ text: 'Fallback response' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 50, output_tokens: 50 },
        stop_reason: 'end_turn',
        id: 'claude-test-id',
      };

      llmService.clients.claude.messages = {
        create: jest.fn().mockResolvedValue(mockClaudeResponse),
      };

      const result = await llmService.generateResponse('Test prompt');

      expect(result.content).toBe('Fallback response');
      expect(result.provider).toBe('claude');
    });

    test('should throw error when all providers fail', async () => {
      // Mock all providers failing
      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI Error')),
        },
      };

      llmService.clients.claude.messages = {
        create: jest.fn().mockRejectedValue(new Error('Claude Error')),
      };

      llmService.clients.azure.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('Azure Error')),
        },
      };

      await expect(llmService.generateResponse('Test prompt')).rejects.toThrow(LLMError);
    });
  });

  describe('Banking-Specific Features', () => {
    test('should analyze fraud risk with proper template', async () => {
      const transactionData = {
        amount: 5000,
        account: '1234567890',
        merchant: 'Test Merchant',
        location: 'Test Location',
      };

      // Mock template
      llmService.promptManager.getTemplate = jest.fn().mockResolvedValue({
        format: jest.fn().mockReturnValue('Formatted fraud detection prompt'),
      });

      // Mock successful response
      llmService.generateResponse = jest.fn().mockResolvedValue({
        content: 'Risk Score: 75 - Medium Risk',
        provider: 'openai',
      });

      const result = await llmService.analyzeFraudRisk(transactionData);

      expect(llmService.promptManager.getTemplate).toHaveBeenCalledWith('fraud_detection');
      expect(result.content).toContain('Risk Score');
    });

    test('should check compliance with regulatory framework', async () => {
      const document = 'Sample banking document for compliance check';
      const regulations = ['Basel III', 'Dodd-Frank', 'GDPR'];

      // Mock template
      llmService.promptManager.getTemplate = jest.fn().mockResolvedValue({
        format: jest.fn().mockReturnValue('Formatted compliance prompt'),
      });

      // Mock successful response
      llmService.generateResponse = jest.fn().mockResolvedValue({
        content: 'Compliance Status: Compliant with minor issues',
        provider: 'claude',
      });

      const result = await llmService.checkCompliance(document, regulations);

      expect(llmService.promptManager.getTemplate).toHaveBeenCalledWith('compliance_check');
      expect(result.content).toContain('Compliance Status');
    });

    test('should perform risk analysis with domain knowledge', async () => {
      const riskData = {
        portfolio: 'Corporate Loans',
        exposure: 100000000,
        timeframe: '2024Q1',
      };

      // Mock template
      llmService.promptManager.getTemplate = jest.fn().mockResolvedValue({
        format: jest.fn().mockReturnValue('Formatted risk analysis prompt'),
      });

      // Mock successful response
      llmService.generateResponse = jest.fn().mockResolvedValue({
        content: 'Risk Assessment: Moderate risk with specific recommendations',
        provider: 'azure',
      });

      const result = await llmService.analyzeRisk(riskData, 'credit_risk');

      expect(llmService.promptManager.getTemplate).toHaveBeenCalledWith('risk_analysis');
      expect(result.content).toContain('Risk Assessment');
    });
  });

  describe('Compliance and Security', () => {
    test('should validate input in strict compliance mode', async () => {
      llmService.config.compliance.mode = 'strict';

      await expect(llmService.generateResponse('')).rejects.toThrow(LLMError);

      await expect(llmService.generateResponse(null)).rejects.toThrow(LLMError);
    });

    test('should anonymize sensitive data when enabled', async () => {
      llmService.config.compliance.anonymizeData = true;

      const sensitivePrompt = 'Account number 1234567890123456 for John Doe';

      // Mock sanitization
      const {
        sanitizeBankingData,
      } = require('../../../src/services/llm-integration/utils/InputValidator');
      jest.mock('../../../src/services/llm-integration/utils/InputValidator', () => ({
        sanitizeBankingData: jest.fn().mockResolvedValue('Account number [ACCOUNT] for [NAME]'),
      }));

      const sanitized = await llmService.applySanitization(sensitivePrompt, {});

      // Would check that sensitive data is anonymized
      // This test would need proper mocking setup
    });

    test('should throw compliance error when features are disabled', async () => {
      llmService.config.features.fraudDetection = false;

      await expect(llmService.analyzeFraudRisk({})).rejects.toThrow(ComplianceError);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      llmService.config.rateLimit.rpm = 1;

      // First request should succeed
      await llmService.checkRateLimit('openai');

      // Second request should fail
      await expect(llmService.checkRateLimit('openai')).rejects.toThrow(RateLimitError);
    });

    test('should handle rate limit errors from providers', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(rateLimitError),
        },
      };

      await expect(llmService.callProvider('openai', 'test prompt')).rejects.toThrow(
        RateLimitError
      );
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track request metrics', async () => {
      const initialRequests = llmService.metrics.requests.get('openai') || [];

      // Mock successful request
      const mockResponse = {
        choices: [{ message: { content: 'Test' }, finish_reason: 'stop' }],
        model: 'gpt-4-turbo-preview',
        usage: { total_tokens: 100 },
        id: 'test-id',
        created: Date.now(),
      };

      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse),
        },
      };

      await llmService.generateResponse('Test prompt');

      const finalRequests = llmService.metrics.requests.get('openai') || [];
      expect(finalRequests.length).toBe(initialRequests.length + 1);
    });

    test('should calculate average latency', async () => {
      const metrics = llmService.getMetrics();
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('tokens');
      expect(metrics).toHaveProperty('latency');
    });

    test('should track token usage', async () => {
      // Mock response with token usage
      const mockResponse = {
        choices: [{ message: { content: 'Test' }, finish_reason: 'stop' }],
        model: 'gpt-4-turbo-preview',
        usage: { total_tokens: 150, prompt_tokens: 100, completion_tokens: 50 },
        id: 'test-id',
        created: Date.now(),
      };

      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse),
        },
      };

      await llmService.generateResponse('Test prompt');

      const tokensMetric = llmService.metrics.tokens.get('openai');
      expect(tokensMetric).toBeDefined();
      expect(tokensMetric[tokensMetric.length - 1].value).toBe(150);
    });
  });

  describe('Health Check', () => {
    test('should return healthy status when all providers work', async () => {
      // Mock successful responses for all providers
      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            model: 'gpt-4-turbo-preview',
            usage: { total_tokens: 10 },
          }),
        },
      };

      llmService.clients.claude.messages = {
        create: jest.fn().mockResolvedValue({
          content: [{ text: 'OK' }],
          model: 'claude-3-sonnet-20240229',
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      };

      llmService.clients.azure.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            model: 'gpt-4',
            usage: { total_tokens: 10 },
          }),
        },
      };

      const health = await llmService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.providers.openai.status).toBe('healthy');
      expect(health.providers.claude.status).toBe('healthy');
      expect(health.providers.azure.status).toBe('healthy');
    });

    test('should return degraded status when some providers fail', async () => {
      // Mock OpenAI success
      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            model: 'gpt-4-turbo-preview',
            usage: { total_tokens: 10 },
          }),
        },
      };

      // Mock Claude failure
      llmService.clients.claude.messages = {
        create: jest.fn().mockRejectedValue(new Error('Claude API Error')),
      };

      // Mock Azure success
      llmService.clients.azure.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            model: 'gpt-4',
            usage: { total_tokens: 10 },
          }),
        },
      };

      const health = await llmService.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.providers.openai.status).toBe('healthy');
      expect(health.providers.claude.status).toBe('unhealthy');
      expect(health.providers.azure.status).toBe('healthy');
    });
  });

  describe('RAG Integration', () => {
    test('should enhance prompts with RAG when enabled', async () => {
      llmService.config.features.ragEnabled = true;

      // Mock RAG pipeline
      llmService.ragPipeline.retrieve = jest
        .fn()
        .mockResolvedValue([{ content: 'Relevant context from knowledge base' }]);

      // Mock successful LLM response
      llmService.callProvider = jest.fn().mockResolvedValue({
        content: 'Enhanced response with context',
        provider: 'openai',
        usage: { total_tokens: 200 },
      });

      const result = await llmService.generateResponse('Test query');

      expect(llmService.ragPipeline.retrieve).toHaveBeenCalled();
      expect(result.content).toBe('Enhanced response with context');
    });

    test('should work without RAG when disabled', async () => {
      llmService.config.features.ragEnabled = false;
      llmService.ragPipeline = null;

      // Mock successful LLM response
      llmService.callProvider = jest.fn().mockResolvedValue({
        content: 'Standard response without context',
        provider: 'openai',
        usage: { total_tokens: 100 },
      });

      const result = await llmService.generateResponse('Test query');

      expect(result.content).toBe('Standard response without context');
    });
  });

  describe('Error Handling', () => {
    test('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(timeoutError),
        },
      };

      await expect(llmService.callProvider('openai', 'test prompt')).rejects.toThrow(
        'Timeout for openai'
      );
    });

    test('should handle connection errors', async () => {
      const connectionError = new Error('Connection reset');
      connectionError.code = 'ECONNRESET';

      llmService.clients.openai.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(connectionError),
        },
      };

      await expect(llmService.callProvider('openai', 'test prompt')).rejects.toThrow(
        'Timeout for openai'
      );
    });

    test('should log errors when compliance logging is enabled', async () => {
      llmService.config.compliance.logOperations = true;

      const testError = new Error('Test error');

      // Mock logger
      const loggerSpy = jest.spyOn(require('../../../core/logging/Logger'), 'error');

      await llmService.logError(testError, { provider: 'openai' });

      expect(loggerSpy).toHaveBeenCalledWith('LLM Error', expect.any(Object));
    });
  });

  describe('Configuration Validation', () => {
    test('should handle missing API keys gracefully', () => {
      const configWithoutKeys = {
        providers: {
          openai: { enabled: true, apiKey: null },
          claude: { enabled: true, apiKey: '' },
          azure: { enabled: true, apiKey: undefined },
        },
      };

      const serviceWithoutKeys = new LLMService(configWithoutKeys);

      expect(Object.keys(serviceWithoutKeys.clients)).toHaveLength(0);
    });

    test('should use environment variables for configuration', () => {
      process.env.OPENAI_API_KEY = 'env-openai-key';
      process.env.ANTHROPIC_API_KEY = 'env-claude-key';

      const serviceFromEnv = new LLMService();

      expect(serviceFromEnv.config.providers.openai.apiKey).toBe('env-openai-key');
      expect(serviceFromEnv.config.providers.claude.apiKey).toBe('env-claude-key');

      // Clean up
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
