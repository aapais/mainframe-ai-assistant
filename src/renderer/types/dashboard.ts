// Dashboard Types for Transparency Dashboard MVP1 v8

export interface DashboardData {
  totalCost: number;
  monthlyLimit: number;
  dailyLimit: number;
  operations: number;
  successRate: number;
  avgResponseTime: number;
  tokensUsed: number;
  costPerOperation: number;
  lastUpdated: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Cost Chart Types
export interface CostData {
  date: string;
  cost: number;
  operations: number;
  tokens: number;
  prediction?: number;
  confidence?: number;
}

export type TimeView = 'day' | 'week' | 'month';

export interface CostStatistics {
  total: number;
  average: number;
  trend: number;
  maxDay: number;
  minDay: number;
  standardDeviation: number;
}

// Usage Metrics Types
export interface UsageMetricsData {
  operations: number;
  successRate: number;
  avgResponseTime: number;
  tokensUsed: number;
  costPerOperation: number;
  totalCost: number;
  failureRate: number;
  timeoutRate: number;
  peakHour: number;
  bottomHour: number;
}

export interface MetricChange {
  value: number;
  direction: 'up' | 'down';
  period: string;
}

export interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

// Decision History Types
export interface Decision {
  id: string;
  timestamp: string;
  operation: string;
  operationType: OperationType;
  decision: DecisionStatus;
  cost: number;
  duration: number;
  reason?: string;
  userPrompt?: string;
  tokens?: TokenUsage;
  metadata?: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high';
  approver?: string;
}

export type OperationType =
  | 'kb_query'
  | 'kb_create'
  | 'kb_update'
  | 'kb_delete'
  | 'analysis'
  | 'generation'
  | 'search'
  | 'validation'
  | 'transformation';

export type DecisionStatus =
  | 'approved'
  | 'denied'
  | 'pending'
  | 'timeout'
  | 'cancelled'
  | 'error';

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cached?: number;
}

export type SortField = 'timestamp' | 'operation' | 'decision' | 'cost' | 'duration';
export type SortDirection = 'asc' | 'desc';
export type FilterStatus = 'all' | DecisionStatus;
export type FilterOperation = 'all' | OperationType;

export interface DecisionFilters {
  searchTerm: string;
  status: FilterStatus;
  operation: FilterOperation;
  dateRange?: DateRange;
  costRange?: {
    min: number;
    max: number;
  };
  durationRange?: {
    min: number;
    max: number;
  };
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// Operation Timeline Types
export interface TimelineOperation {
  id: string;
  timestamp: string;
  operation: string;
  operationType: OperationType;
  status: OperationStatus;
  duration: number;
  cost: number;
  tokens?: number;
  details?: string;
  parentId?: string;
  childIds?: string[];
  position?: number; // Calculated position for timeline rendering
}

export type OperationStatus =
  | 'success'
  | 'failure'
  | 'timeout'
  | 'pending'
  | 'cancelled'
  | 'retrying';

export type ZoomLevel = 'hour' | 'day' | 'week' | 'month';

export interface TimelineMarker {
  timestamp: Date;
  label: string;
  position: number;
}

export interface TimelinePlaybackState {
  isPlaying: boolean;
  currentTime: Date;
  playbackSpeed: number;
  visibleOperations: TimelineOperation[];
}

// AI Usage Breakdown Types
export interface UsageData {
  operationType: OperationType;
  operationLabel: string;
  count: number;
  cost: number;
  tokens: number;
  avgDuration: number;
  successRate: number;
  failureRate: number;
  timeoutRate: number;
  peakUsageHour: number;
  color?: string;
}

export type ViewMode = 'pie' | 'bar' | 'treemap';
export type MetricType = 'count' | 'cost' | 'tokens' | 'duration' | 'success_rate';

export interface UsageBreakdownChartData extends UsageData {
  name: string;
  value: number;
  percentage: number;
}

export interface UsageTrend {
  operationType: OperationType;
  dailyData: Array<{
    date: string;
    count: number;
    cost: number;
    tokens: number;
  }>;
  weeklyGrowth: number;
  monthlyGrowth: number;
}

// Export and Reporting Types
export interface ExportOptions {
  format: 'csv' | 'pdf' | 'xlsx' | 'json';
  dateRange: DateRange;
  includeCharts: boolean;
  includeDetailedData: boolean;
  sections: ExportSection[];
}

export type ExportSection =
  | 'overview'
  | 'costs'
  | 'operations'
  | 'decisions'
  | 'timeline'
  | 'breakdown';

export interface ExportData {
  metadata: {
    generatedAt: string;
    dateRange: DateRange;
    totalOperations: number;
    totalCost: number;
  };
  summary: DashboardData;
  costData: CostData[];
  decisions: Decision[];
  operations: TimelineOperation[];
  usageBreakdown: UsageData[];
}

// Real-time Update Types
export interface RealtimeUpdate {
  type: 'dashboard_update' | 'new_operation' | 'new_decision' | 'cost_update';
  timestamp: string;
  data: any;
  source: string;
}

export interface WebSocketMessage {
  id: string;
  type: string;
  payload: RealtimeUpdate;
  timestamp: string;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Dashboard Configuration Types
export interface DashboardConfig {
  refreshInterval: number; // milliseconds
  defaultPageSize: number;
  defaultTimeRange: number; // days
  enableRealtimeUpdates: boolean;
  enableNotifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  currency: string;
  timezone: string;
  chartOptions: ChartOptions;
  limits: {
    dailyCost: number;
    monthlyCost: number;
    operationsPerHour: number;
  };
}

export interface ChartOptions {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
  };
  animations: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
  responsive: boolean;
  showLegend: boolean;
  showTooltips: boolean;
}

// Component State Types
export interface ComponentState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  retryCount: number;
}

export interface TableState<T> {
  data: T[];
  filteredData: T[];
  sortField: string;
  sortDirection: SortDirection;
  filters: Record<string, any>;
  pagination: PaginationState;
  selection: Set<string>;
}

// Performance Monitoring Types
export interface PerformanceMetrics {
  renderTime: number;
  dataLoadTime: number;
  chartRenderTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

export interface ComponentPerformance {
  componentName: string;
  metrics: PerformanceMetrics;
  timestamp: string;
}

// Error Handling Types
export interface DashboardError {
  id: string;
  type: 'network' | 'data' | 'rendering' | 'permission' | 'unknown';
  message: string;
  details?: any;
  timestamp: string;
  component?: string;
  recoverable: boolean;
  retryAction?: () => void;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  autoClose: boolean;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

// Accessibility Types
export interface AccessibilityFeatures {
  highContrast: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  fontSize: 'small' | 'medium' | 'large';
  colorBlindFriendly: boolean;
}

// Responsive Design Types
export interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
}

export interface ResponsiveState {
  viewport: 'mobile' | 'tablet' | 'desktop' | 'wide';
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

// Data Validation Types
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'email' | 'url';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event Types for IPC Communication
export interface IPCEvents {
  'dashboard:loadData': (params: { startDate: string; endDate: string }) => Promise<DashboardData>;
  'dashboard:getCostData': (params: { startDate: string; endDate: string; granularity: TimeView }) => Promise<CostData[]>;
  'dashboard:getDecisionHistory': (params: { startDate: string; endDate: string }) => Promise<Decision[]>;
  'dashboard:getOperationTimeline': (params: { startDate: string; endDate: string }) => Promise<TimelineOperation[]>;
  'dashboard:getUsageBreakdown': (params: { startDate: string; endDate: string }) => Promise<UsageData[]>;
  'dashboard:export': (params: { format: 'csv' | 'pdf'; data: any; dateRange: DateRange; tab: string }) => Promise<void>;
  'dashboard:dataUpdate': (data: Partial<DashboardData>) => void;
  'dashboard:newDecision': (decision: Decision) => void;
  'dashboard:newOperation': (operation: TimelineOperation) => void;
}

// Global Window Type Extension
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke<K extends keyof IPCEvents>(
          channel: K,
          ...args: Parameters<IPCEvents[K]>
        ): ReturnType<IPCEvents[K]>;

        on<K extends keyof IPCEvents>(
          channel: K,
          listener: IPCEvents[K]
        ): () => void;
      };
    };
  }
}