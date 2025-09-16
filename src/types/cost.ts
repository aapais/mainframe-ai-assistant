export interface CostData {
  sessionCost: number;
  dailyCost: number;
  monthlyCost: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export interface CostLimit {
  daily: number;
  monthly: number;
  current: number;
  type: 'daily' | 'monthly';
}

export interface CostBreakdown {
  operationType: string;
  count: number;
  totalCost: number;
  averageCost: number;
}

export interface DailyCostSummary {
  today: CostBreakdown[];
  yesterday: CostBreakdown[];
  totalToday: number;
  totalYesterday: number;
  comparison: number; // percentage change
}

export interface CostAlert {
  id: string;
  severity: 'warning' | 'danger';
  message: string;
  percentage: number;
  dismissed: boolean;
  timestamp: Date;
}

export type CostDisplaySize = 'compact' | 'normal' | 'detailed';

export interface AICostsHookReturn {
  costData: CostData | null;
  dailySummary: DailyCostSummary | null;
  alerts: CostAlert[];
  limits: CostLimit[];
  loading: boolean;
  error: string | null;
  refreshCosts: () => Promise<void>;
  dismissAlert: (alertId: string) => void;
  updateLimit: (type: 'daily' | 'monthly', amount: number) => Promise<void>;
}