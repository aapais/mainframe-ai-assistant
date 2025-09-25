import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  CostTrackingService,
  AIOperation,
  DateRange,
  CostLimit,
} from '../services/CostTrackingService';
import { Logger } from '../utils/Logger';

export class CostTrackingHandler {
  private costService: CostTrackingService;
  private logger: Logger;

  constructor(costService: CostTrackingService) {
    this.costService = costService;
    this.logger = new Logger('CostTrackingHandler');
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Operation tracking
    ipcMain.handle('cost-tracking:track-operation', this.handleTrackOperation.bind(this));

    // Cost queries
    ipcMain.handle('cost-tracking:get-daily-cost', this.handleGetDailyCost.bind(this));
    ipcMain.handle('cost-tracking:get-weekly-cost', this.handleGetWeeklyCost.bind(this));
    ipcMain.handle('cost-tracking:get-monthly-cost', this.handleGetMonthlyCost.bind(this));
    ipcMain.handle('cost-tracking:get-cost-by-operation', this.handleGetCostByOperation.bind(this));

    // Budget management
    ipcMain.handle('cost-tracking:set-cost-limit', this.handleSetCostLimit.bind(this));
    ipcMain.handle('cost-tracking:check-budget-status', this.handleCheckBudgetStatus.bind(this));

    // Reporting and analytics
    ipcMain.handle('cost-tracking:generate-cost-report', this.handleGenerateCostReport.bind(this));
    ipcMain.handle('cost-tracking:get-cost-trends', this.handleGetCostTrends.bind(this));
    ipcMain.handle('cost-tracking:predict-monthly-cost', this.handlePredictMonthlyCost.bind(this));

    // Service management
    ipcMain.handle('cost-tracking:get-stats', this.handleGetStats.bind(this));

    // Listen for budget alerts
    this.costService.on('budgetAlert', this.handleBudgetAlert.bind(this));

    this.logger.info('Cost tracking IPC handlers registered');
  }

  private async handleTrackOperation(
    event: IpcMainInvokeEvent,
    operation: AIOperation,
    cost?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.costService.trackOperation(operation, cost);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to track operation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetDailyCost(
    event: IpcMainInvokeEvent,
    userId?: string,
    date?: string
  ): Promise<{ success: boolean; cost?: number; error?: string }> {
    try {
      const targetDate = date ? new Date(date) : undefined;
      const cost = await this.costService.getDailyCost(userId, targetDate);
      return { success: true, cost };
    } catch (error) {
      this.logger.error('Failed to get daily cost:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetWeeklyCost(
    event: IpcMainInvokeEvent,
    userId?: string
  ): Promise<{ success: boolean; cost?: number; error?: string }> {
    try {
      const cost = await this.costService.getWeeklyCost(userId);
      return { success: true, cost };
    } catch (error) {
      this.logger.error('Failed to get weekly cost:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetMonthlyCost(
    event: IpcMainInvokeEvent,
    userId?: string
  ): Promise<{ success: boolean; cost?: number; error?: string }> {
    try {
      const cost = await this.costService.getMonthlyCost(userId);
      return { success: true, cost };
    } catch (error) {
      this.logger.error('Failed to get monthly cost:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetCostByOperation(
    event: IpcMainInvokeEvent,
    operationType: string,
    period?: { start: string; end: string }
  ): Promise<{ success: boolean; cost?: number; error?: string }> {
    try {
      const dateRange: DateRange | undefined = period
        ? {
            start: new Date(period.start),
            end: new Date(period.end),
          }
        : undefined;

      const cost = await this.costService.getCostByOperation(operationType, dateRange);
      return { success: true, cost };
    } catch (error) {
      this.logger.error('Failed to get cost by operation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleSetCostLimit(
    event: IpcMainInvokeEvent,
    limit: CostLimit
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.costService.setCostLimit(limit);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to set cost limit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleCheckBudgetStatus(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; status?: any; error?: string }> {
    try {
      const status = await this.costService.checkBudgetStatus();
      return { success: true, status };
    } catch (error) {
      this.logger.error('Failed to check budget status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGenerateCostReport(
    event: IpcMainInvokeEvent,
    period: { start: string; end: string }
  ): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const dateRange: DateRange = {
        start: new Date(period.start),
        end: new Date(period.end),
      };

      const report = await this.costService.generateCostReport(dateRange);
      return { success: true, report };
    } catch (error) {
      this.logger.error('Failed to generate cost report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetCostTrends(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; trends?: any; error?: string }> {
    try {
      const trends = await this.costService.getCostTrends();
      return { success: true, trends };
    } catch (error) {
      this.logger.error('Failed to get cost trends:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handlePredictMonthlyCost(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; prediction?: number; error?: string }> {
    try {
      const prediction = await this.costService.predictMonthlyCost();
      return { success: true, prediction };
    } catch (error) {
      this.logger.error('Failed to predict monthly cost:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetStats(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const stats = await this.costService.getStats();
      return { success: true, stats };
    } catch (error) {
      this.logger.error('Failed to get stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private handleBudgetAlert(alertData: any): void {
    try {
      // Send budget alert to all renderer processes
      const { webContents } = require('electron');

      webContents.getAllWebContents().forEach(contents => {
        if (!contents.isDestroyed()) {
          contents.send('cost-tracking:budget-alert', alertData);
        }
      });

      this.logger.warn('Budget alert triggered:', alertData);
    } catch (error) {
      this.logger.error('Failed to handle budget alert:', error);
    }
  }

  // Helper methods for frontend integration
  public async estimateOperationCost(operation: Partial<AIOperation>): Promise<number> {
    try {
      // Simple cost estimation based on token counts and model
      const model = operation.model || 'default';
      const inputTokens = operation.inputTokens || 0;
      const outputTokens = operation.outputTokens || 0;

      // Use the same pricing logic as the service
      const TOKEN_PRICING = {
        'claude-3-opus': { input: 0.015, output: 0.075 },
        'claude-3-sonnet': { input: 0.003, output: 0.015 },
        'claude-3-haiku': { input: 0.00025, output: 0.00125 },
        'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
        default: { input: 0.001, output: 0.002 },
      };

      const pricing = TOKEN_PRICING[model] || TOKEN_PRICING.default;
      const inputCost = (inputTokens / 1000) * pricing.input;
      const outputCost = (outputTokens / 1000) * pricing.output;

      return inputCost + outputCost;
    } catch (error) {
      this.logger.error('Failed to estimate operation cost:', error);
      return 0;
    }
  }

  // Real-time cost monitoring
  public startRealTimeMonitoring(interval: number = 60000): void {
    setInterval(async () => {
      try {
        const budgetStatus = await this.costService.checkBudgetStatus();

        // Send periodic updates to frontend
        const { webContents } = require('electron');

        webContents.getAllWebContents().forEach(contents => {
          if (!contents.isDestroyed()) {
            contents.send('cost-tracking:status-update', budgetStatus);
          }
        });
      } catch (error) {
        this.logger.error('Failed to send real-time cost update:', error);
      }
    }, interval);
  }

  public destroy(): void {
    try {
      // Remove all IPC handlers
      ipcMain.removeHandler('cost-tracking:track-operation');
      ipcMain.removeHandler('cost-tracking:get-daily-cost');
      ipcMain.removeHandler('cost-tracking:get-weekly-cost');
      ipcMain.removeHandler('cost-tracking:get-monthly-cost');
      ipcMain.removeHandler('cost-tracking:get-cost-by-operation');
      ipcMain.removeHandler('cost-tracking:set-cost-limit');
      ipcMain.removeHandler('cost-tracking:check-budget-status');
      ipcMain.removeHandler('cost-tracking:generate-cost-report');
      ipcMain.removeHandler('cost-tracking:get-cost-trends');
      ipcMain.removeHandler('cost-tracking:predict-monthly-cost');
      ipcMain.removeHandler('cost-tracking:get-stats');

      this.logger.info('Cost tracking IPC handlers removed');
    } catch (error) {
      this.logger.error('Error destroying cost tracking handler:', error);
    }
  }
}

// Export types for frontend use
export type {
  AIOperation,
  CostEntry,
  DateRange,
  CostLimit,
  BudgetStatus,
  CostReport,
  CostTrends,
} from '../services/CostTrackingService';
