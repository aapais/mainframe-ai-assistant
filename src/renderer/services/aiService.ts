/**
 * AI Service - Handles AI operations with cost tracking and transparency
 * Provides cost estimation, operation logging, and budget management for AI-powered features
 */

import { EventEmitter } from 'events';
import { AIOperation, AIProvider, AIOperationType, AITokensEstimate, AICostEstimate, AIOperationLog } from '../types/ai';

export interface AICostConfig {
  provider: AIProvider;
  model: string;
  inputTokenPrice: number;  // Price per 1000 tokens
  outputTokenPrice: number; // Price per 1000 tokens
  minimumCost: number;      // Minimum charge per operation
}

export interface AIBudgetLimits {
  dailyLimit: number;
  monthlyLimit: number;
  perOperationLimit: number;
  warningThreshold: number; // Percentage at which to show warnings
}

export interface AISearchContext {
  query: string;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  expectedResultCount: number;
  useSemanticSearch: boolean;
  includeExplanations: boolean;
}

export class AIService extends EventEmitter {
  private operationHistory: AIOperationLog[] = [];
  private dailyUsage: Map<string, number> = new Map(); // date -> cost
  private monthlyUsage: Map<string, number> = new Map(); // month -> cost
  private budgetLimits: AIBudgetLimits;

  // Default cost configurations for different providers
  private readonly costConfigs: Record<string, AICostConfig> = {
    'openai-gpt-4': {
      provider: 'openai',
      model: 'gpt-4',
      inputTokenPrice: 0.03, // $0.03 per 1k tokens
      outputTokenPrice: 0.06, // $0.06 per 1k tokens
      minimumCost: 0.001
    },
    'openai-gpt-3.5': {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      inputTokenPrice: 0.0015, // $0.0015 per 1k tokens
      outputTokenPrice: 0.002, // $0.002 per 1k tokens
      minimumCost: 0.0005
    },
    'claude-sonnet': {
      provider: 'claude',
      model: 'claude-3-sonnet',
      inputTokenPrice: 0.003, // $0.003 per 1k tokens
      outputTokenPrice: 0.015, // $0.015 per 1k tokens
      minimumCost: 0.0008
    },
    'claude-haiku': {
      provider: 'claude',
      model: 'claude-3-haiku',
      inputTokenPrice: 0.00025, // $0.00025 per 1k tokens
      outputTokenPrice: 0.00125, // $0.00125 per 1k tokens
      minimumCost: 0.0003
    },
    'gemini-pro': {
      provider: 'gemini',
      model: 'gemini-pro',
      inputTokenPrice: 0.0005, // $0.0005 per 1k tokens
      outputTokenPrice: 0.0015, // $0.0015 per 1k tokens
      minimumCost: 0.0002
    }
  };

  constructor(budgetLimits?: Partial<AIBudgetLimits>) {
    super();

    this.budgetLimits = {
      dailyLimit: budgetLimits?.dailyLimit || 10.0,
      monthlyLimit: budgetLimits?.monthlyLimit || 100.0,
      perOperationLimit: budgetLimits?.perOperationLimit || 1.0,
      warningThreshold: budgetLimits?.warningThreshold || 80.0
    };

    this.loadUsageData();
  }

  /**
   * Estimate tokens required for a search operation
   */
  estimateSearchTokens(context: AISearchContext): AITokensEstimate {
    const { query, estimatedComplexity, expectedResultCount, useSemanticSearch, includeExplanations } = context;

    // Base tokens for query processing
    let inputTokens = Math.ceil(query.length / 4); // Rough approximation: 4 chars per token

    // Add system prompt tokens
    inputTokens += 200; // Base system prompt
    if (useSemanticSearch) inputTokens += 150;
    if (includeExplanations) inputTokens += 100;

    // Add context tokens based on expected results
    inputTokens += expectedResultCount * 50; // Estimated tokens per result context

    // Estimate output tokens based on complexity and requirements
    let outputTokens = 100; // Base response

    switch (estimatedComplexity) {
      case 'simple':
        outputTokens += expectedResultCount * 30;
        break;
      case 'medium':
        outputTokens += expectedResultCount * 60;
        break;
      case 'complex':
        outputTokens += expectedResultCount * 100;
        break;
    }

    if (includeExplanations) {
      outputTokens += Math.min(expectedResultCount * 80, 500); // Cap explanations
    }

    // Add buffer for safety (10%)
    inputTokens = Math.ceil(inputTokens * 1.1);
    outputTokens = Math.ceil(outputTokens * 1.1);

    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    };
  }

  /**
   * Calculate cost estimate for an AI operation
   */
  calculateCostEstimate(
    provider: AIProvider,
    model: string,
    tokensEstimate: AITokensEstimate
  ): AICostEstimate {
    const configKey = `${provider}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const config = this.costConfigs[configKey] || this.costConfigs['openai-gpt-3.5']; // Fallback

    const inputCost = (tokensEstimate.input / 1000) * config.inputTokenPrice;
    const outputCost = (tokensEstimate.output / 1000) * config.outputTokenPrice;
    const totalCost = Math.max(inputCost + outputCost, config.minimumCost);

    return {
      inputCost,
      outputCost,
      totalCost,
      confidence: this.getCostConfidence(provider, model),
      breakdown: {
        basePrice: config.minimumCost,
        inputTokens: tokensEstimate.input,
        outputTokens: tokensEstimate.output,
        inputRate: config.inputTokenPrice,
        outputRate: config.outputTokenPrice
      }
    };
  }

  /**
   * Get comprehensive cost and token estimates for a search operation
   */
  async getSearchEstimate(
    query: string,
    provider: AIProvider = 'openai',
    model: string = 'gpt-3.5-turbo',
    options: {
      useSemanticSearch?: boolean;
      includeExplanations?: boolean;
      expectedResultCount?: number;
    } = {}
  ): Promise<{
    tokens: AITokensEstimate;
    cost: AICostEstimate;
    canAfford: boolean;
    budgetWarnings: string[];
  }> {
    // Determine search complexity based on query
    const complexity = this.determineSearchComplexity(query);

    const context: AISearchContext = {
      query,
      estimatedComplexity: complexity,
      expectedResultCount: options.expectedResultCount || 10,
      useSemanticSearch: options.useSemanticSearch || true,
      includeExplanations: options.includeExplanations || false
    };

    const tokens = this.estimateSearchTokens(context);
    const cost = this.calculateCostEstimate(provider, model, tokens);

    // Check budget constraints
    const { canAfford, warnings } = this.checkBudgetConstraints(cost.totalCost);

    return {
      tokens,
      cost,
      canAfford,
      budgetWarnings: warnings
    };
  }

  /**
   * Check if operation is within budget limits
   */
  checkBudgetConstraints(estimatedCost: number): { canAfford: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let canAfford = true;

    // Check per-operation limit
    if (estimatedCost > this.budgetLimits.perOperationLimit) {
      canAfford = false;
      warnings.push(`Operation cost (${this.formatCurrency(estimatedCost)}) exceeds per-operation limit (${this.formatCurrency(this.budgetLimits.perOperationLimit)})`);
    }

    // Check daily usage
    const today = new Date().toDateString();
    const todayUsage = this.dailyUsage.get(today) || 0;
    const newDailyTotal = todayUsage + estimatedCost;

    if (newDailyTotal > this.budgetLimits.dailyLimit) {
      canAfford = false;
      warnings.push(`Would exceed daily limit. Current: ${this.formatCurrency(todayUsage)}, Limit: ${this.formatCurrency(this.budgetLimits.dailyLimit)}`);
    } else if ((newDailyTotal / this.budgetLimits.dailyLimit) * 100 >= this.budgetLimits.warningThreshold) {
      warnings.push(`Approaching daily limit (${((newDailyTotal / this.budgetLimits.dailyLimit) * 100).toFixed(1)}%)`);
    }

    // Check monthly usage
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyUsage = this.monthlyUsage.get(currentMonth) || 0;
    const newMonthlyTotal = monthlyUsage + estimatedCost;

    if (newMonthlyTotal > this.budgetLimits.monthlyLimit) {
      canAfford = false;
      warnings.push(`Would exceed monthly limit. Current: ${this.formatCurrency(monthlyUsage)}, Limit: ${this.formatCurrency(this.budgetLimits.monthlyLimit)}`);
    } else if ((newMonthlyTotal / this.budgetLimits.monthlyLimit) * 100 >= this.budgetLimits.warningThreshold) {
      warnings.push(`Approaching monthly limit (${((newMonthlyTotal / this.budgetLimits.monthlyLimit) * 100).toFixed(1)}%)`);
    }

    return { canAfford, warnings };
  }

  /**
   * Log an AI operation for transparency and tracking
   */
  async logOperation(
    operation: AIOperation,
    actualCost?: number,
    actualTokens?: AITokensEstimate,
    success: boolean = true,
    error?: string
  ): Promise<void> {
    const timestamp = new Date();
    const operationLog: AIOperationLog = {
      id: crypto.randomUUID(),
      operation,
      timestamp,
      actualCost: actualCost || 0,
      actualTokens: actualTokens || { input: 0, output: 0, total: 0 },
      success,
      error,
      metadata: {
        userAgent: navigator.userAgent,
        sessionId: this.getCurrentSessionId(),
        buildInfo: await this.getBuildInfo()
      }
    };

    this.operationHistory.unshift(operationLog);

    // Keep only last 1000 operations
    if (this.operationHistory.length > 1000) {
      this.operationHistory = this.operationHistory.slice(0, 1000);
    }

    // Update usage tracking
    if (success && actualCost) {
      this.updateUsageTracking(actualCost, timestamp);
    }

    // Save to storage
    this.saveOperationHistory();

    // Emit event for real-time tracking
    this.emit('operation-logged', operationLog);

    // Check for budget alerts
    this.checkBudgetAlerts();
  }

  /**
   * Get operation history with filtering options
   */
  getOperationHistory(options: {
    limit?: number;
    operationType?: AIOperationType;
    provider?: AIProvider;
    since?: Date;
    successOnly?: boolean;
  } = {}): AIOperationLog[] {
    let filtered = [...this.operationHistory];

    if (options.operationType) {
      filtered = filtered.filter(log => log.operation.operationType === options.operationType);
    }

    if (options.provider) {
      filtered = filtered.filter(log => log.operation.provider === options.provider);
    }

    if (options.since) {
      filtered = filtered.filter(log => log.timestamp >= options.since!);
    }

    if (options.successOnly) {
      filtered = filtered.filter(log => log.success);
    }

    return filtered.slice(0, options.limit || 100);
  }

  /**
   * Get current usage statistics
   */
  getCurrentUsage(): {
    daily: { date: string; usage: number; limit: number; percentage: number };
    monthly: { month: string; usage: number; limit: number; percentage: number };
    totalOperations: number;
    totalCost: number;
    averageCost: number;
  } {
    const today = new Date().toDateString();
    const currentMonth = new Date().toISOString().substring(0, 7);

    const dailyUsage = this.dailyUsage.get(today) || 0;
    const monthlyUsage = this.monthlyUsage.get(currentMonth) || 0;

    const totalCost = this.operationHistory
      .filter(log => log.success)
      .reduce((sum, log) => sum + (log.actualCost || 0), 0);

    const successfulOperations = this.operationHistory.filter(log => log.success).length;

    return {
      daily: {
        date: today,
        usage: dailyUsage,
        limit: this.budgetLimits.dailyLimit,
        percentage: (dailyUsage / this.budgetLimits.dailyLimit) * 100
      },
      monthly: {
        month: currentMonth,
        usage: monthlyUsage,
        limit: this.budgetLimits.monthlyLimit,
        percentage: (monthlyUsage / this.budgetLimits.monthlyLimit) * 100
      },
      totalOperations: this.operationHistory.length,
      totalCost,
      averageCost: successfulOperations > 0 ? totalCost / successfulOperations : 0
    };
  }

  /**
   * Update budget limits
   */
  updateBudgetLimits(newLimits: Partial<AIBudgetLimits>): void {
    this.budgetLimits = { ...this.budgetLimits, ...newLimits };
    this.saveBudgetLimits();
    this.emit('budget-updated', this.budgetLimits);
  }

  /**
   * Clear operation history
   */
  clearHistory(): void {
    this.operationHistory = [];
    this.saveOperationHistory();
    this.emit('history-cleared');
  }

  /**
   * Export operation history for analysis
   */
  exportHistory(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'operationType', 'provider', 'model', 'cost', 'inputTokens', 'outputTokens', 'success'];
      const rows = this.operationHistory.map(log => [
        log.timestamp.toISOString(),
        log.operation.operationType || '',
        log.operation.provider || '',
        log.operation.model || '',
        log.actualCost?.toString() || '0',
        log.actualTokens?.input.toString() || '0',
        log.actualTokens?.output.toString() || '0',
        log.success.toString()
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(this.operationHistory, null, 2);
  }

  // Private helper methods
  private determineSearchComplexity(query: string): 'simple' | 'medium' | 'complex' {
    if (query.length < 20) return 'simple';
    if (query.length < 100 && !query.includes('AND') && !query.includes('OR')) return 'medium';
    return 'complex';
  }

  private getCostConfidence(provider: AIProvider, model: string): number {
    const configKey = `${provider}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    return this.costConfigs[configKey] ? 0.95 : 0.7; // Higher confidence for known configs
  }

  private updateUsageTracking(cost: number, timestamp: Date): void {
    const dateStr = timestamp.toDateString();
    const monthStr = timestamp.toISOString().substring(0, 7);

    this.dailyUsage.set(dateStr, (this.dailyUsage.get(dateStr) || 0) + cost);
    this.monthlyUsage.set(monthStr, (this.monthlyUsage.get(monthStr) || 0) + cost);

    this.saveUsageData();
  }

  private checkBudgetAlerts(): void {
    const usage = this.getCurrentUsage();

    if (usage.daily.percentage >= this.budgetLimits.warningThreshold) {
      this.emit('budget-alert', {
        type: 'daily',
        usage: usage.daily.usage,
        limit: usage.daily.limit,
        percentage: usage.daily.percentage
      });
    }

    if (usage.monthly.percentage >= this.budgetLimits.warningThreshold) {
      this.emit('budget-alert', {
        type: 'monthly',
        usage: usage.monthly.usage,
        limit: usage.monthly.limit,
        percentage: usage.monthly.percentage
      });
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  }

  private getCurrentSessionId(): string {
    return sessionStorage.getItem('ai-session-id') || 'unknown';
  }

  private async getBuildInfo(): Promise<object> {
    try {
      return (window as any).electronAPI?.getBuildInfo?.() || { version: 'unknown' };
    } catch {
      return { version: 'unknown' };
    }
  }

  private loadUsageData(): void {
    try {
      const dailyData = localStorage.getItem('ai-daily-usage');
      if (dailyData) {
        this.dailyUsage = new Map(JSON.parse(dailyData));
      }

      const monthlyData = localStorage.getItem('ai-monthly-usage');
      if (monthlyData) {
        this.monthlyUsage = new Map(JSON.parse(monthlyData));
      }

      const historyData = localStorage.getItem('ai-operation-history');
      if (historyData) {
        const parsed = JSON.parse(historyData);
        this.operationHistory = parsed.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }

      const budgetData = localStorage.getItem('ai-budget-limits');
      if (budgetData) {
        this.budgetLimits = { ...this.budgetLimits, ...JSON.parse(budgetData) };
      }
    } catch (error) {
      console.warn('Failed to load AI service data:', error);
    }
  }

  private saveUsageData(): void {
    try {
      localStorage.setItem('ai-daily-usage', JSON.stringify(Array.from(this.dailyUsage.entries())));
      localStorage.setItem('ai-monthly-usage', JSON.stringify(Array.from(this.monthlyUsage.entries())));
    } catch (error) {
      console.warn('Failed to save usage data:', error);
    }
  }

  private saveOperationHistory(): void {
    try {
      localStorage.setItem('ai-operation-history', JSON.stringify(this.operationHistory));
    } catch (error) {
      console.warn('Failed to save operation history:', error);
    }
  }

  private saveBudgetLimits(): void {
    try {
      localStorage.setItem('ai-budget-limits', JSON.stringify(this.budgetLimits));
    } catch (error) {
      console.warn('Failed to save budget limits:', error);
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;