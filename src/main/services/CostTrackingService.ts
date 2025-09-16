import { Database } from 'better-sqlite3';
import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';

export interface AIOperation {
  id: string;
  userId?: string;
  type: 'claude-request' | 'search' | 'document-analysis' | 'memory-operation' | 'workflow' | 'other';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface CostEntry {
  id: string;
  operationId: string;
  userId?: string;
  operationType: string;
  model?: string;
  cost: number;
  currency: string;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: string;
  timestamp: Date;
  createdAt: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CostLimit {
  id?: string;
  userId?: string;
  limitType: 'daily' | 'weekly' | 'monthly';
  amount: number;
  currency: string;
  alertThreshold: number; // Percentage (0-100)
  isActive: boolean;
}

export interface BudgetStatus {
  userId?: string;
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  dailyPercentage: number;
  weeklyPercentage: number;
  monthlyPercentage: number;
  isOverBudget: boolean;
  alerts: string[];
}

export interface CostReport {
  period: DateRange;
  totalCost: number;
  currency: string;
  operationBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
  dailyBreakdown: Record<string, number>;
  userBreakdown?: Record<string, number>;
  averageCostPerOperation: number;
  totalOperations: number;
  trends: {
    growthRate: number;
    mostExpensiveDay: string;
    costEfficiency: number;
  };
}

export interface CostTrends {
  last7Days: number[];
  last30Days: number[];
  weekOverWeekChange: number;
  monthOverMonthChange: number;
  predictedNextWeek: number;
  predictedNextMonth: number;
  peakUsageDays: string[];
  costEfficiencyTrend: number;
}

export class CostTrackingService extends EventEmitter {
  private db: Database;
  private logger: Logger;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_RETENTION_DAYS = 90;

  // Pricing constants (per 1K tokens)
  private readonly TOKEN_PRICING = {
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'default': { input: 0.001, output: 0.002 }
  };

  constructor(database: Database) {
    super();
    this.db = database;
    this.logger = new Logger('CostTrackingService');
    this.cache = new Map();

    this.initializeDatabase();
    this.startCleanupScheduler();
  }

  private initializeDatabase(): void {
    try {
      // Cost tracking table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cost_tracking (
          id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL,
          user_id TEXT,
          operation_type TEXT NOT NULL,
          model TEXT,
          cost REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          input_tokens INTEGER,
          output_tokens INTEGER,
          metadata TEXT,
          timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Cost limits table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cost_limits (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          limit_type TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          alert_threshold REAL DEFAULT 80.0,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better query performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_timestamp ON cost_tracking(timestamp);
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON cost_tracking(user_id);
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_operation_type ON cost_tracking(operation_type);
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_model ON cost_tracking(model);
        CREATE INDEX IF NOT EXISTS idx_cost_limits_user_id ON cost_limits(user_id);
        CREATE INDEX IF NOT EXISTS idx_cost_limits_active ON cost_limits(is_active);
      `);

      this.logger.info('Cost tracking database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize cost tracking database:', error);
      throw error;
    }
  }

  async trackOperation(operation: AIOperation, cost?: number): Promise<void> {
    try {
      const calculatedCost = cost ?? this.calculateOperationCost(operation);
      const costEntry: Partial<CostEntry> = {
        id: `cost_${operation.id}_${Date.now()}`,
        operationId: operation.id,
        userId: operation.userId,
        operationType: operation.type,
        model: operation.model,
        cost: calculatedCost,
        currency: 'USD',
        inputTokens: operation.inputTokens,
        outputTokens: operation.outputTokens,
        metadata: JSON.stringify(operation.metadata || {}),
        timestamp: operation.timestamp,
        createdAt: new Date()
      };

      const stmt = this.db.prepare(`
        INSERT INTO cost_tracking (
          id, operation_id, user_id, operation_type, model, cost, currency,
          input_tokens, output_tokens, metadata, timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        costEntry.id,
        costEntry.operationId,
        costEntry.userId,
        costEntry.operationType,
        costEntry.model,
        costEntry.cost,
        costEntry.currency,
        costEntry.inputTokens,
        costEntry.outputTokens,
        costEntry.metadata,
        costEntry.timestamp?.toISOString(),
        costEntry.createdAt?.toISOString()
      );

      // Clear relevant cache entries
      this.clearCacheForUser(operation.userId);

      // Check budget limits
      this.checkAndEmitBudgetAlerts(operation.userId);

      this.logger.debug(`Tracked operation ${operation.id} with cost $${calculatedCost}`);
    } catch (error) {
      this.logger.error('Failed to track operation cost:', error);
      throw error;
    }
  }

  private calculateOperationCost(operation: AIOperation): number {
    const model = operation.model || 'default';
    const pricing = this.TOKEN_PRICING[model] || this.TOKEN_PRICING.default;

    const inputCost = (operation.inputTokens || 0) / 1000 * pricing.input;
    const outputCost = (operation.outputTokens || 0) / 1000 * pricing.output;

    return inputCost + outputCost;
  }

  async getDailyCost(userId?: string, date?: Date): Promise<number> {
    const cacheKey = `daily_cost_${userId || 'all'}_${date?.toDateString() || 'today'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) return cached;

    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      let query = `
        SELECT SUM(cost) as total_cost
        FROM cost_tracking
        WHERE timestamp >= ? AND timestamp <= ?
      `;
      const params = [startOfDay.toISOString(), endOfDay.toISOString()];

      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const result = this.db.prepare(query).get(...params) as { total_cost: number };
      const cost = result.total_cost || 0;

      this.setCache(cacheKey, cost);
      return cost;
    } catch (error) {
      this.logger.error('Failed to get daily cost:', error);
      throw error;
    }
  }

  async getWeeklyCost(userId?: string): Promise<number> {
    const cacheKey = `weekly_cost_${userId || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    try {
      let query = `
        SELECT SUM(cost) as total_cost
        FROM cost_tracking
        WHERE timestamp >= ?
      `;
      const params = [startOfWeek.toISOString()];

      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const result = this.db.prepare(query).get(...params) as { total_cost: number };
      const cost = result.total_cost || 0;

      this.setCache(cacheKey, cost);
      return cost;
    } catch (error) {
      this.logger.error('Failed to get weekly cost:', error);
      throw error;
    }
  }

  async getMonthlyCost(userId?: string): Promise<number> {
    const cacheKey = `monthly_cost_${userId || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      let query = `
        SELECT SUM(cost) as total_cost
        FROM cost_tracking
        WHERE timestamp >= ?
      `;
      const params = [startOfMonth.toISOString()];

      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const result = this.db.prepare(query).get(...params) as { total_cost: number };
      const cost = result.total_cost || 0;

      this.setCache(cacheKey, cost);
      return cost;
    } catch (error) {
      this.logger.error('Failed to get monthly cost:', error);
      throw error;
    }
  }

  async getCostByOperation(type: string, period?: DateRange): Promise<number> {
    try {
      let query = `
        SELECT SUM(cost) as total_cost
        FROM cost_tracking
        WHERE operation_type = ?
      `;
      const params = [type];

      if (period) {
        query += ' AND timestamp >= ? AND timestamp <= ?';
        params.push(period.start.toISOString(), period.end.toISOString());
      }

      const result = this.db.prepare(query).get(...params) as { total_cost: number };
      return result.total_cost || 0;
    } catch (error) {
      this.logger.error('Failed to get cost by operation:', error);
      throw error;
    }
  }

  async setCostLimit(limit: CostLimit): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cost_limits (
          id, user_id, limit_type, amount, currency, alert_threshold, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const id = limit.id || `limit_${limit.userId || 'global'}_${limit.limitType}_${Date.now()}`;

      stmt.run(
        id,
        limit.userId,
        limit.limitType,
        limit.amount,
        limit.currency,
        limit.alertThreshold,
        limit.isActive ? 1 : 0,
        new Date().toISOString()
      );

      this.logger.info(`Set ${limit.limitType} cost limit of ${limit.currency} ${limit.amount} for ${limit.userId || 'global'}`);
    } catch (error) {
      this.logger.error('Failed to set cost limit:', error);
      throw error;
    }
  }

  async checkBudgetStatus(): Promise<BudgetStatus> {
    try {
      const dailySpent = await this.getDailyCost();
      const weeklySpent = await this.getWeeklyCost();
      const monthlySpent = await this.getMonthlyCost();

      // Get active limits
      const limits = this.db.prepare(`
        SELECT * FROM cost_limits
        WHERE is_active = 1 AND (user_id IS NULL OR user_id = ?)
      `).all(null) as any[];

      const dailyLimit = limits.find(l => l.limit_type === 'daily')?.amount;
      const weeklyLimit = limits.find(l => l.limit_type === 'weekly')?.amount;
      const monthlyLimit = limits.find(l => l.limit_type === 'monthly')?.amount;

      const dailyPercentage = dailyLimit ? (dailySpent / dailyLimit) * 100 : 0;
      const weeklyPercentage = weeklyLimit ? (weeklySpent / weeklyLimit) * 100 : 0;
      const monthlyPercentage = monthlyLimit ? (monthlySpent / monthlyLimit) * 100 : 0;

      const alerts: string[] = [];
      const isOverBudget = dailyPercentage > 100 || weeklyPercentage > 100 || monthlyPercentage > 100;

      if (dailyPercentage > 80) alerts.push(`Daily budget at ${dailyPercentage.toFixed(1)}%`);
      if (weeklyPercentage > 80) alerts.push(`Weekly budget at ${weeklyPercentage.toFixed(1)}%`);
      if (monthlyPercentage > 80) alerts.push(`Monthly budget at ${monthlyPercentage.toFixed(1)}%`);

      return {
        dailySpent,
        weeklySpent,
        monthlySpent,
        dailyLimit,
        weeklyLimit,
        monthlyLimit,
        dailyPercentage,
        weeklyPercentage,
        monthlyPercentage,
        isOverBudget,
        alerts
      };
    } catch (error) {
      this.logger.error('Failed to check budget status:', error);
      throw error;
    }
  }

  async generateCostReport(period: DateRange): Promise<CostReport> {
    try {
      const query = `
        SELECT
          operation_type,
          model,
          DATE(timestamp) as date,
          user_id,
          SUM(cost) as total_cost,
          COUNT(*) as operation_count
        FROM cost_tracking
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY operation_type, model, DATE(timestamp), user_id
        ORDER BY date
      `;

      const results = this.db.prepare(query).all(
        period.start.toISOString(),
        period.end.toISOString()
      ) as any[];

      const totalCost = results.reduce((sum, row) => sum + row.total_cost, 0);
      const totalOperations = results.reduce((sum, row) => sum + row.operation_count, 0);

      const operationBreakdown: Record<string, number> = {};
      const modelBreakdown: Record<string, number> = {};
      const dailyBreakdown: Record<string, number> = {};
      const userBreakdown: Record<string, number> = {};

      results.forEach(row => {
        operationBreakdown[row.operation_type] = (operationBreakdown[row.operation_type] || 0) + row.total_cost;
        if (row.model) {
          modelBreakdown[row.model] = (modelBreakdown[row.model] || 0) + row.total_cost;
        }
        dailyBreakdown[row.date] = (dailyBreakdown[row.date] || 0) + row.total_cost;
        if (row.user_id) {
          userBreakdown[row.user_id] = (userBreakdown[row.user_id] || 0) + row.total_cost;
        }
      });

      // Calculate trends
      const dailyValues = Object.values(dailyBreakdown);
      const mostExpensiveDay = Object.keys(dailyBreakdown).reduce((a, b) =>
        dailyBreakdown[a] > dailyBreakdown[b] ? a : b
      );

      const growthRate = this.calculateGrowthRate(dailyValues);
      const costEfficiency = totalOperations > 0 ? totalCost / totalOperations : 0;

      return {
        period,
        totalCost,
        currency: 'USD',
        operationBreakdown,
        modelBreakdown,
        dailyBreakdown,
        userBreakdown: Object.keys(userBreakdown).length > 0 ? userBreakdown : undefined,
        averageCostPerOperation: totalOperations > 0 ? totalCost / totalOperations : 0,
        totalOperations,
        trends: {
          growthRate,
          mostExpensiveDay,
          costEfficiency
        }
      };
    } catch (error) {
      this.logger.error('Failed to generate cost report:', error);
      throw error;
    }
  }

  async getCostTrends(): Promise<CostTrends> {
    const cacheKey = 'cost_trends';
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) return cached;

    try {
      const now = new Date();
      const last7Days: number[] = [];
      const last30Days: number[] = [];

      // Get last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const cost = await this.getDailyCost(undefined, date);
        last7Days.push(cost);
      }

      // Get last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const cost = await this.getDailyCost(undefined, date);
        last30Days.push(cost);
      }

      // Calculate week over week change
      const thisWeekTotal = last7Days.reduce((sum, cost) => sum + cost, 0);
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(lastWeekStart.getDate() - 13);
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      const lastWeekTotal = await this.getCostByOperation('', { start: lastWeekStart, end: lastWeekEnd });

      const weekOverWeekChange = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0;

      // Calculate month over month change
      const thisMonthTotal = await this.getMonthlyCost();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthTotal = await this.getCostByOperation('', { start: lastMonth, end: lastMonthEnd });

      const monthOverMonthChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

      // Predict costs using linear regression
      const predictedNextWeek = this.predictCost(last7Days, 7);
      const predictedNextMonth = this.predictCost(last30Days, 30);

      // Find peak usage days
      const peakUsageDays = this.findPeakUsageDays(last30Days);

      // Calculate cost efficiency trend
      const costEfficiencyTrend = this.calculateEfficiencyTrend(last7Days);

      const trends: CostTrends = {
        last7Days,
        last30Days,
        weekOverWeekChange,
        monthOverMonthChange,
        predictedNextWeek,
        predictedNextMonth,
        peakUsageDays,
        costEfficiencyTrend
      };

      this.setCache(cacheKey, trends, 10 * 60 * 1000); // 10 minute cache
      return trends;
    } catch (error) {
      this.logger.error('Failed to get cost trends:', error);
      throw error;
    }
  }

  async predictMonthlyCost(): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();

      const currentMonthCost = await this.getMonthlyCost();
      const averageDailyCost = currentMonthCost / daysPassed;

      return averageDailyCost * daysInMonth;
    } catch (error) {
      this.logger.error('Failed to predict monthly cost:', error);
      throw error;
    }
  }

  private predictCost(values: number[], periods: number): number {
    if (values.length < 2) return 0;

    // Simple linear regression for prediction
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + (idx * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return Math.max(0, slope * (n + periods - 1) + intercept);
  }

  private findPeakUsageDays(values: number[]): string[] {
    const threshold = values.reduce((sum, val) => sum + val, 0) / values.length * 1.5;
    const peakDays: string[] = [];

    const now = new Date();
    values.forEach((value, index) => {
      if (value > threshold) {
        const date = new Date(now);
        date.setDate(date.getDate() - (values.length - 1 - index));
        peakDays.push(date.toDateString());
      }
    });

    return peakDays;
  }

  private calculateEfficiencyTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const firstValue = values[0];
    const lastValue = values[values.length - 1];

    return firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  }

  private async checkAndEmitBudgetAlerts(userId?: string): Promise<void> {
    try {
      const budgetStatus = await this.checkBudgetStatus();

      if (budgetStatus.alerts.length > 0) {
        this.emit('budgetAlert', {
          userId,
          alerts: budgetStatus.alerts,
          isOverBudget: budgetStatus.isOverBudget,
          status: budgetStatus
        });
      }
    } catch (error) {
      this.logger.error('Failed to check budget alerts:', error);
    }
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private clearCacheForUser(userId?: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (key.includes(userId || 'all') || key.includes('daily_cost') || key.includes('weekly_cost') || key.includes('monthly_cost')) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private startCleanupScheduler(): void {
    setInterval(async () => {
      try {
        await this.cleanupOldRecords();
      } catch (error) {
        this.logger.error('Failed to cleanup old records:', error);
      }
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanupOldRecords(retentionDays: number = this.DEFAULT_RETENTION_DAYS): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = this.db.prepare(`
        DELETE FROM cost_tracking
        WHERE created_at < ?
      `).run(cutoffDate.toISOString());

      if (result.changes > 0) {
        this.logger.info(`Cleaned up ${result.changes} old cost tracking records`);
      }

      // Clean cache
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old records:', error);
    }
  }

  async getStats(): Promise<any> {
    try {
      const totalRecords = this.db.prepare('SELECT COUNT(*) as count FROM cost_tracking').get() as { count: number };
      const totalCost = this.db.prepare('SELECT SUM(cost) as total FROM cost_tracking').get() as { total: number };

      return {
        totalRecords: totalRecords.count,
        totalCost: totalCost.total || 0,
        cacheSize: this.cache.size,
        retentionDays: this.DEFAULT_RETENTION_DAYS
      };
    } catch (error) {
      this.logger.error('Failed to get stats:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      this.removeAllListeners();
      this.cache.clear();
      this.logger.info('Cost tracking service destroyed');
    } catch (error) {
      this.logger.error('Error destroying cost tracking service:', error);
    }
  }
}