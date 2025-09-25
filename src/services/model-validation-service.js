/**
 * Model Validation Service
 * Serviço reutilizável para validação de modelos AI com sistema de fallback
 */

const OpenAI = require('openai');

class ModelValidationService {
  constructor() {
    this.validationCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Valida disponibilidade de um modelo específico
   * @param {Object} modelConfig - Configuração do modelo
   * @returns {Promise<{success: boolean, error?: string, model?: string}>}
   */
  async validateModel(modelConfig) {
    const { provider, apiKey, model, azureEndpoint } = modelConfig;

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return { success: false, error: 'API key inválida ou não configurada' };
    }

    if (!model) {
      return { success: false, error: 'Modelo não especificado' };
    }

    // Verificar cache
    const cacheKey = `${provider}-${model}-${apiKey.substring(0, 10)}`;
    const cached = this.validationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📄 Using cached validation for ${model}`);
      return cached.result;
    }

    try {
      let client;
      const testModel = model;

      switch (provider) {
        case 'openai':
          client = new OpenAI({ apiKey });
          break;

        case 'azure':
          if (!azureEndpoint) {
            return { success: false, error: 'Azure endpoint não configurado' };
          }
          client = new OpenAI({
            apiKey,
            baseURL: `${azureEndpoint}/openai/deployments`,
            defaultQuery: { 'api-version': '2023-12-01-preview' },
          });
          break;

        default:
          return { success: false, error: `Provider ${provider} não suportado` };
      }

      // Testar embedding (mais leve que chat)
      console.log(`🔄 Testing model ${testModel}...`);

      const response = await client.embeddings.create({
        model: testModel,
        input: 'test validation',
        encoding_format: 'float',
      });

      if (response && response.data && response.data[0] && response.data[0].embedding) {
        const result = {
          success: true,
          model: testModel,
          provider: provider,
          embeddingDimensions: response.data[0].embedding.length,
        };

        // Cache resultado
        this.validationCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });

        console.log(
          `✅ Model ${testModel} validated successfully (${result.embeddingDimensions} dimensions)`
        );
        return result;
      }

      return { success: false, error: 'Resposta inválida do modelo' };
    } catch (error) {
      console.error(`❌ Model validation failed for ${model}:`, error.message);

      let errorMessage = 'Erro na validação do modelo';
      if (error.message.includes('401')) {
        errorMessage = 'API key inválida ou sem permissões';
      } else if (error.message.includes('404')) {
        errorMessage = `Modelo ${model} não encontrado`;
      } else if (error.message.includes('429')) {
        errorMessage = 'Limite de rate excedido';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout na conexão com o modelo';
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Encontra modelo funcional com fallback automático
   * @param {Array} modelConfigs - Lista de configurações de modelos (ordenada por prioridade)
   * @returns {Promise<{success: boolean, activeModel?: Object, error?: string, fallbackUsed?: boolean}>}
   */
  async findWorkingModel(modelConfigs) {
    if (!modelConfigs || modelConfigs.length === 0) {
      return {
        success: false,
        error: 'Nenhuma configuração de modelo fornecida',
      };
    }

    console.log(`🔍 Testing ${modelConfigs.length} model configurations...`);

    for (let i = 0; i < modelConfigs.length; i++) {
      const config = modelConfigs[i];
      console.log(
        `Testing model ${i + 1}/${modelConfigs.length}: ${config.model} (${config.provider})`
      );

      const validation = await this.validateModel(config);

      if (validation.success) {
        const result = {
          success: true,
          activeModel: {
            ...config,
            embeddingDimensions: validation.embeddingDimensions,
          },
          fallbackUsed: i > 0, // Se não é o primeiro, foi usado fallback
        };

        if (i > 0) {
          console.log(`⚠️ Using fallback model ${config.model} (primary model failed)`);
        }

        return result;
      }
    }

    return {
      success: false,
      error: 'Nenhum modelo configurado está disponível',
      testedModels: modelConfigs.length,
    };
  }

  /**
   * Gera configurações de modelo a partir das settings
   * @param {Object} settings - Settings da aplicação
   * @returns {Array} Array de configurações ordenadas por prioridade
   */
  generateModelConfigurations(settings) {
    const configs = [];

    if (!settings || !settings.useAI) {
      return configs;
    }

    // Modelo principal (default)
    if (settings.defaultModel && settings.apiKey) {
      configs.push({
        provider: settings.llmProvider || 'openai',
        apiKey: settings.apiKey,
        model: settings.defaultModel,
        azureEndpoint: settings.azureEndpoint,
        priority: 1,
        name: 'Default Model',
      });
    }

    // Modelos de fallback baseados no provider
    const fallbackModels = this.getFallbackModels(settings.llmProvider || 'openai');

    for (const fallbackModel of fallbackModels) {
      if (fallbackModel !== settings.defaultModel) {
        configs.push({
          provider: settings.llmProvider || 'openai',
          apiKey: settings.apiKey,
          model: fallbackModel,
          azureEndpoint: settings.azureEndpoint,
          priority: 2,
          name: `Fallback: ${fallbackModel}`,
        });
      }
    }

    return configs;
  }

  /**
   * Retorna modelos de fallback para um provider
   * @param {string} provider - Provider (openai, azure, etc)
   * @returns {Array} Lista de modelos de fallback
   */
  getFallbackModels(provider) {
    const fallbackMap = {
      openai: ['text-embedding-3-small', 'text-embedding-ada-002', 'text-embedding-3-large'],
      azure: ['text-embedding-ada-002', 'text-embedding-3-small'],
    };

    return fallbackMap[provider] || [];
  }

  /**
   * Limpa cache de validação
   */
  clearCache() {
    this.validationCache.clear();
    console.log('🗑️ Validation cache cleared');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats() {
    return {
      entries: this.validationCache.size,
      timeout: this.cacheTimeout,
    };
  }
}

module.exports = ModelValidationService;
