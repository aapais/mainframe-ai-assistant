/**
 * AI Cost Calculator Utilities
 * Provides precise cost calculations for different AI providers and models
 */

import {
  AIProvider,
  AIOperationType,
  CostCalculationInput,
  CostCalculationResult,
  AICostRate
} from '../renderer/types/ai';

export interface TokenEstimate {
  input: number;
  output: number;
}

export interface ModelSpecs {
  maxTokens: number;
  contextWindow: number;
  avgInputOutputRatio: number;
}

/**
 * AI Cost Calculator class with provider-specific logic
 */
export class AICostCalculator {
  // Current pricing data (updated as of 2024)
  private static readonly COST_RATES: Record<string, AICostRate> = {
    'openai/gpt-4': {
      id: 1,
      provider: 'openai',
      model: 'gpt-4',
      costPer1kInputTokens: 0.03,
      costPer1kOutputTokens: 0.06,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'openai/gpt-4-turbo': {
      id: 2,
      provider: 'openai',
      model: 'gpt-4-turbo',
      costPer1kInputTokens: 0.01,
      costPer1kOutputTokens: 0.03,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'openai/gpt-3.5-turbo': {
      id: 3,
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      costPer1kInputTokens: 0.0015,
      costPer1kOutputTokens: 0.002,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'claude/claude-3-opus': {
      id: 4,
      provider: 'claude',
      model: 'claude-3-opus',
      costPer1kInputTokens: 0.015,
      costPer1kOutputTokens: 0.075,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'claude/claude-3-sonnet': {
      id: 5,
      provider: 'claude',
      model: 'claude-3-sonnet',
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'claude/claude-3-haiku': {
      id: 6,
      provider: 'claude',
      model: 'claude-3-haiku',
      costPer1kInputTokens: 0.00025,
      costPer1kOutputTokens: 0.00125,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'gemini/gemini-pro': {
      id: 7,
      provider: 'gemini',
      model: 'gemini-pro',
      costPer1kInputTokens: 0.0005,
      costPer1kOutputTokens: 0.0015,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'gemini/gemini-ultra': {
      id: 8,
      provider: 'gemini',
      model: 'gemini-ultra',
      costPer1kInputTokens: 0.002,
      costPer1kOutputTokens: 0.006,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
    'local/any': {
      id: 9,
      provider: 'local',
      model: 'any',
      costPer1kInputTokens: 0.0,
      costPer1kOutputTokens: 0.0,
      costPerRequest: 0.0,
      effectiveDate: '2024-01-01',
      deprecated: false,
      createdAt: new Date().toISOString(),
    },
  };

  // Model specifications for token estimation
  private static readonly MODEL_SPECS: Record<string, ModelSpecs> = {
    'gpt-4': { maxTokens: 8192, contextWindow: 8192, avgInputOutputRatio: 0.3 },
    'gpt-4-turbo': { maxTokens: 4096, contextWindow: 128000, avgInputOutputRatio: 0.25 },
    'gpt-3.5-turbo': { maxTokens: 4096, contextWindow: 16385, avgInputOutputRatio: 0.4 },
    'claude-3-opus': { maxTokens: 4096, contextWindow: 200000, avgInputOutputRatio: 0.2 },
    'claude-3-sonnet': { maxTokens: 4096, contextWindow: 200000, avgInputOutputRatio: 0.25 },
    'claude-3-haiku': { maxTokens: 4096, contextWindow: 200000, avgInputOutputRatio: 0.3 },
    'gemini-pro': { maxTokens: 2048, contextWindow: 32768, avgInputOutputRatio: 0.35 },
    'gemini-ultra': { maxTokens: 2048, contextWindow: 32768, avgInputOutputRatio: 0.3 },
  };

  /**
   * Calculate cost for an AI operation
   */
  static calculateCost(input: CostCalculationInput): CostCalculationResult {
    const rateKey = `${input.provider}/${input.model}`;
    let costRate = this.COST_RATES[rateKey];

    // Fallback to generic rate for provider if specific model not found
    if (!costRate && input.provider === 'local') {
      costRate = this.COST_RATES['local/any'];
    }

    if (!costRate) {
      throw new Error(`No cost rate found for ${input.provider}/${input.model}`);
    }

    const inputCost = (input.inputTokens / 1000) * costRate.costPer1kInputTokens;
    const outputCost = (input.outputTokens / 1000) * costRate.costPer1kOutputTokens;
    const requestCost = costRate.costPerRequest;

    // Apply operation type multipliers
    const operationMultiplier = this.getOperationMultiplier(input.operationType);
    const totalCost = (inputCost + outputCost + requestCost) * operationMultiplier;

    return {
      totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
      inputCost: Math.round(inputCost * 10000) / 10000,
      outputCost: Math.round(outputCost * 10000) / 10000,
      requestCost: Math.round(requestCost * 10000) / 10000,
      breakdown: {
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        rateUsed: costRate,
      },
    };
  }

  /**
   * Estimate tokens for a given text and operation type
   */
  static estimateTokens(
    text: string,
    provider: AIProvider,
    model: string,
    operationType: AIOperationType
  ): TokenEstimate {
    // Basic token estimation (4 characters ≈ 1 token for English)
    const baseTokenCount = Math.ceil(text.length / 4);

    // Get model specs
    const modelSpecs = this.MODEL_SPECS[model] || {
      maxTokens: 2048,
      contextWindow: 4096,
      avgInputOutputRatio: 0.3,
    };

    // Adjust for operation type
    const operationMultiplier = this.getTokenMultiplier(operationType);
    const inputTokens = Math.ceil(baseTokenCount * operationMultiplier);

    // Estimate output tokens based on operation type and model
    let outputTokens: number;
    switch (operationType) {
      case 'search':
        outputTokens = Math.min(inputTokens * 0.5, 500); // Search results are typically shorter
        break;
      case 'generation':
        outputTokens = Math.min(inputTokens * 2, modelSpecs.maxTokens); // Generation can be longer
        break;
      case 'analysis':
        outputTokens = Math.min(inputTokens * 0.8, 1000); // Analysis is usually structured
        break;
      case 'chat':
        outputTokens = Math.min(inputTokens * 0.6, 800); // Chat responses are conversational
        break;
      case 'completion':
        outputTokens = Math.min(inputTokens * 0.4, 600); // Completions are typically shorter
        break;
      default:
        outputTokens = Math.min(inputTokens * modelSpecs.avgInputOutputRatio, modelSpecs.maxTokens);
    }

    return {
      input: Math.max(inputTokens, 1), // Minimum 1 token
      output: Math.max(Math.ceil(outputTokens), 1), // Minimum 1 token
    };
  }

  /**
   * Get a more accurate token count using provider-specific methods
   */
  static async getAccurateTokenCount(
    text: string,
    provider: AIProvider,
    model: string
  ): Promise<number> {
    // In a real implementation, this would use provider-specific tokenizers
    // For now, return the basic estimation
    return this.estimateTokens(text, provider, model, 'analysis').input;
  }

  /**
   * Calculate cost for multiple operations (batch)
   */
  static calculateBatchCost(inputs: CostCalculationInput[]): {
    totalCost: number;
    breakdown: CostCalculationResult[];
  } {
    const breakdown = inputs.map(input => this.calculateCost(input));
    const totalCost = breakdown.reduce((sum, result) => sum + result.totalCost, 0);

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      breakdown,
    };
  }

  /**
   * Get cost estimate for a query before execution
   */
  static getEstimate(
    query: string,
    provider: AIProvider,
    model: string,
    operationType: AIOperationType,
    purpose: string
  ): {
    estimatedCost: number;
    tokenEstimate: TokenEstimate;
    breakdown: CostCalculationResult;
  } {
    // Combine query and purpose for token estimation
    const fullText = `${purpose}\n\n${query}`;
    const tokenEstimate = this.estimateTokens(fullText, provider, model, operationType);

    const costInput: CostCalculationInput = {
      provider,
      model,
      inputTokens: tokenEstimate.input,
      outputTokens: tokenEstimate.output,
      operationType,
    };

    const breakdown = this.calculateCost(costInput);

    return {
      estimatedCost: breakdown.totalCost,
      tokenEstimate,
      breakdown,
    };
  }

  /**
   * Compare costs across different providers/models
   */
  static compareCosts(
    query: string,
    operationType: AIOperationType,
    purpose: string,
    options: { provider: AIProvider; model: string }[]
  ): Array<{
    provider: AIProvider;
    model: string;
    estimatedCost: number;
    tokenEstimate: TokenEstimate;
    ranking: number;
  }> {
    const results = options.map(option => {
      const estimate = this.getEstimate(query, option.provider, option.model, operationType, purpose);
      return {
        ...option,
        estimatedCost: estimate.estimatedCost,
        tokenEstimate: estimate.tokenEstimate,
        ranking: 0, // Will be set below
      };
    });

    // Sort by cost (ascending) and assign rankings
    results.sort((a, b) => a.estimatedCost - b.estimatedCost);
    results.forEach((result, index) => {
      result.ranking = index + 1;
    });

    return results;
  }

  /**
   * Get operation type multiplier for cost calculations
   */
  private static getOperationMultiplier(operationType: AIOperationType): number {
    switch (operationType) {
      case 'search':
        return 1.0; // Base rate
      case 'generation':
        return 1.2; // Generation requires more processing
      case 'analysis':
        return 1.1; // Analysis requires structured thinking
      case 'chat':
        return 1.0; // Conversational, base rate
      case 'completion':
        return 0.9; // Completions are typically simpler
      default:
        return 1.0;
    }
  }

  /**
   * Get token multiplier for different operation types
   */
  private static getTokenMultiplier(operationType: AIOperationType): number {
    switch (operationType) {
      case 'search':
        return 1.1; // Search queries often include context
      case 'generation':
        return 1.3; // Generation requests include detailed prompts
      case 'analysis':
        return 1.2; // Analysis includes context and instructions
      case 'chat':
        return 1.0; // Chat is direct
      case 'completion':
        return 0.8; // Completions are often shorter
      default:
        return 1.0;
    }
  }

  /**
   * Update cost rates (for admin/system use)
   */
  static updateCostRate(provider: AIProvider, model: string, newRate: Partial<AICostRate>): void {
    const key = `${provider}/${model}`;
    if (this.COST_RATES[key]) {
      this.COST_RATES[key] = { ...this.COST_RATES[key], ...newRate };
    }
  }

  /**
   * Get all available provider/model combinations
   */
  static getAvailableModels(): Array<{ provider: AIProvider; model: string; costRate: AICostRate }> {
    return Object.entries(this.COST_RATES).map(([key, rate]) => {
      const [provider, model] = key.split('/');
      return {
        provider: provider as AIProvider,
        model,
        costRate: rate,
      };
    });
  }

  /**
   * Calculate monthly cost projection based on usage pattern
   */
  static projectMonthlyCost(
    dailyOperations: number,
    avgCostPerOperation: number,
    daysInMonth: number = 30
  ): {
    projectedCost: number;
    confidenceLevel: number;
    breakdown: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  } {
    const dailyCost = dailyOperations * avgCostPerOperation;
    const weeklyCost = dailyCost * 7;
    const monthlyCost = dailyCost * daysInMonth;

    // Confidence level based on data consistency (simplified)
    const confidenceLevel = Math.min(0.95, Math.max(0.5, dailyOperations / 100));

    return {
      projectedCost: Math.round(monthlyCost * 100) / 100,
      confidenceLevel,
      breakdown: {
        daily: Math.round(dailyCost * 100) / 100,
        weekly: Math.round(weeklyCost * 100) / 100,
        monthly: Math.round(monthlyCost * 100) / 100,
      },
    };
  }
}

/**
 * Budget enforcement utilities
 */
export class BudgetEnforcement {
  /**
   * Check if an operation would exceed budget limits
   */
  static checkBudgetLimits(
    currentUsage: number,
    budgetLimit: number,
    estimatedCost: number,
    bufferPercentage: number = 0.05 // 5% buffer
  ): {
    allowed: boolean;
    projectedUsage: number;
    remainingBudget: number;
    warningLevel: 'none' | 'caution' | 'warning' | 'critical';
    message?: string;
  } {
    const projectedUsage = currentUsage + estimatedCost;
    const remainingBudget = budgetLimit - currentUsage;
    const usagePercentage = (projectedUsage / budgetLimit) * 100;

    let warningLevel: 'none' | 'caution' | 'warning' | 'critical';
    let message: string | undefined;

    if (projectedUsage > budgetLimit) {
      warningLevel = 'critical';
      message = `Operation would exceed budget limit by ${AICostCalculator.calculateCost({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputTokens: 0,
        outputTokens: 0,
        operationType: 'search',
      }).totalCost}`;
      return {
        allowed: false,
        projectedUsage,
        remainingBudget,
        warningLevel,
        message,
      };
    }

    if (usagePercentage >= 95) {
      warningLevel = 'critical';
      message = 'Approaching budget limit (95%+)';
    } else if (usagePercentage >= 80) {
      warningLevel = 'warning';
      message = 'High budget usage (80%+)';
    } else if (usagePercentage >= 50) {
      warningLevel = 'caution';
      message = 'Moderate budget usage (50%+)';
    } else {
      warningLevel = 'none';
    }

    return {
      allowed: true,
      projectedUsage,
      remainingBudget,
      warningLevel,
      message,
    };
  }

  /**
   * Get recommended action based on budget status
   */
  static getRecommendedAction(
    usagePercentage: number,
    remainingDays: number
  ): {
    action: 'continue' | 'monitor' | 'reduce' | 'pause';
    reason: string;
    suggestions: string[];
  } {
    if (usagePercentage >= 95) {
      return {
        action: 'pause',
        reason: 'Budget nearly exhausted',
        suggestions: [
          'Consider increasing budget limit',
          'Review recent high-cost operations',
          'Switch to more cost-effective models',
          'Reduce operation frequency',
        ],
      };
    }

    if (usagePercentage >= 80) {
      const projectedOverrun = (usagePercentage / 100) * remainingDays > remainingDays * 0.8;

      return {
        action: projectedOverrun ? 'reduce' : 'monitor',
        reason: projectedOverrun ? 'On track to exceed budget' : 'High usage but manageable',
        suggestions: [
          'Monitor usage closely',
          'Consider switching to cheaper models',
          'Optimize query complexity',
          'Implement stricter auto-approval limits',
        ],
      };
    }

    if (usagePercentage >= 50) {
      return {
        action: 'monitor',
        reason: 'Moderate usage level',
        suggestions: [
          'Continue current usage patterns',
          'Review cost-effectiveness of operations',
          'Consider optimizing high-frequency queries',
        ],
      };
    }

    return {
      action: 'continue',
      reason: 'Usage well within budget',
      suggestions: [
        'Current usage is sustainable',
        'Consider enabling more auto-approvals',
        'Explore additional AI capabilities',
      ],
    };
  }
}

export default AICostCalculator;