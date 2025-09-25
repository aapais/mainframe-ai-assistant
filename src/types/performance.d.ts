export interface PerformanceMetric {
  id: string;
  timestamp: number;
  metric: string;
  value: number;
  unit: string;
  source: string;
  environment: 'development' | 'staging' | 'production';
  tags?: Record<string, string>;
}
export interface PerformanceAlert {
  id: string;
  metricId: string;
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'muted';
  createdAt: number;
  resolvedAt?: number;
  description: string;
  assignee?: string;
  tags?: string[];
}
export interface PerformanceBudget {
  id: string;
  name: string;
  metrics: {
    metricName: string;
    threshold: number;
    unit: string;
  }[];
  environment: string;
  team: string;
  status: 'passing' | 'failing' | 'warning';
  lastCheck: number;
}
export interface TrendData {
  timestamp: number;
  value: number;
  baseline?: number;
  percentile95?: number;
  percentile99?: number;
}
export interface RegressionData {
  id: string;
  timestamp: number;
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  significance: 'low' | 'medium' | 'high';
  confidence: number;
  cause?: string;
  status: 'investigating' | 'resolved' | 'false-positive';
}
export interface TeamNotification {
  id: string;
  type: 'alert' | 'regression' | 'budget' | 'deployment';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  actionRequired: boolean;
  recipients: string[];
  metadata?: Record<string, any>;
}
export interface DashboardConfig {
  refreshInterval: number;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  metrics: string[];
  layout: 'grid' | 'list' | 'compact';
  theme: 'light' | 'dark' | 'auto';
  enableRealtime: boolean;
  alertsEnabled: boolean;
}
export interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'scatter' | 'heatmap';
  timeRange: string;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'p95' | 'p99';
  showBaseline: boolean;
  showPercentiles: boolean;
  smoothing: boolean;
}
export interface PerformanceData {
  metrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  budgets: PerformanceBudget[];
  regressions: RegressionData[];
  notifications: TeamNotification[];
}
//# sourceMappingURL=performance.d.ts.map
