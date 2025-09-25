export interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: KBCategory;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
  version: number;
}
export interface KBEntryInput {
  title: string;
  problem: string;
  solution: string;
  category: KBCategory;
  tags?: string[];
  created_by?: string;
}
export interface KBEntryUpdate {
  title?: string;
  problem?: string;
  solution?: string;
  category?: KBCategory;
  tags?: string[];
  updated_by?: string;
}
export type KBCategory =
  | 'JCL'
  | 'VSAM'
  | 'DB2'
  | 'Batch'
  | 'Functional'
  | 'IMS'
  | 'CICS'
  | 'System'
  | 'Other';
export interface SearchResult {
  entry: KBEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai' | 'semantic';
  highlights?: string[];
  explanation?: string;
}
export interface SearchQuery {
  query: string;
  category?: KBCategory;
  tags?: string[];
  useAI?: boolean;
  limit?: number;
  offset?: number;
}
export interface EntryFeedback {
  entry_id: string;
  user_id?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  successful: boolean;
  comment?: string;
  timestamp: Date;
}
export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  confidence?: number;
  usage?: {
    tokens: number;
    cost?: number;
  };
}
export interface AIMatchResult {
  entries: SearchResult[];
  explanations: string[];
  confidence: number;
  processing_time: number;
}
export interface DatabaseConfig {
  path: string;
  backup_interval?: number;
  max_size_mb?: number;
  performance_mode?: 'balanced' | 'speed' | 'memory';
}
export interface DatabaseMetrics {
  total_entries: number;
  searches_today: number;
  avg_response_time: number;
  cache_hit_rate: number;
  storage_used_mb: number;
}
export interface QueryStats {
  query: string;
  execution_time_ms: number;
  results_count: number;
  cache_hit: boolean;
  timestamp: Date;
}
export interface AppState {
  currentView: 'search' | 'browse' | 'add' | 'metrics' | 'settings';
  searchResults: SearchResult[];
  selectedEntry: KBEntry | null;
  isLoading: boolean;
  error: string | null;
  notifications: Notification[];
}
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}
export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string, useAI?: boolean) => void;
  placeholder?: string;
  loading?: boolean;
  autoFocus?: boolean;
}
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}
export interface ElectronAPI {
  getKBEntries: (query?: SearchQuery) => Promise<SearchResult[]>;
  addKBEntry: (entry: Omit<KBEntry, 'id'>) => Promise<string>;
  updateKBEntry: (id: string, entry: Partial<KBEntry>) => Promise<void>;
  deleteKBEntry: (id: string) => Promise<void>;
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;
  searchLocal: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  searchWithAI: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  getMetrics: () => Promise<DatabaseMetrics>;
  exportKB: (path: string) => Promise<void>;
  importKB: (path: string) => Promise<number>;
  openDevTools: () => void;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<boolean>;
}
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
export interface PerformanceMetrics {
  search_avg_time: number;
  cache_hit_rate: number;
  memory_usage_mb: number;
  database_size_mb: number;
  startup_time_ms: number;
  last_updated: Date;
}
export interface PerformanceThreshold {
  metric: keyof PerformanceMetrics;
  warning_value: number;
  critical_value: number;
  current_value: number;
  status: 'healthy' | 'warning' | 'critical';
}
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  metadata?: Record<string, any>;
}
export interface PatternBase extends BaseEntity {
  type: string;
  confidence: number;
  frequency: number;
  status: 'active' | 'resolved' | 'monitoring';
}
export interface CodeReference extends BaseEntity {
  file_path: string;
  line_start: number;
  line_end?: number;
  language: 'cobol' | 'jcl' | 'sql' | 'other';
  kb_entry_id: string;
}
export interface TemplateBase extends BaseEntity {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, any>;
  success_rate: number;
}
export interface AnalyticsBase {
  timeframe: '1h' | '24h' | '7d' | '30d' | '90d';
  metrics: Record<string, number>;
  trends: Record<string, number>;
  insights: string[];
}
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}
export interface Pagination {
  page: number;
  size: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}
export interface FilterConfig {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
  value: any;
}
export type AppErrorType =
  | 'DATABASE_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN_ERROR';
export interface AppError {
  type: AppErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
  stack?: string;
}
export interface AppConfig {
  database: DatabaseConfig;
  ai: {
    gemini: GeminiConfig;
    fallback_enabled: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    notifications_enabled: boolean;
  };
  performance: {
    cache_size_mb: number;
    search_timeout_ms: number;
    ai_timeout_ms: number;
  };
  features: {
    ai_search_enabled: boolean;
    offline_mode: boolean;
    telemetry_enabled: boolean;
  };
}
export type { ReactNode, ReactElement, ComponentProps, FC } from 'react';
//# sourceMappingURL=index.d.ts.map
