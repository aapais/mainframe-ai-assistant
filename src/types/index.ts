/**
 * Core TypeScript interfaces and types for Mainframe KB Assistant
 * MVP1 Knowledge Base Service Architecture
 */

import { EventEmitter } from 'events';

// ========================
// Core Data Models
// ========================

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

/** Knowledge Base Categories - Mainframe specific */
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

/** Search Result with AI confidence scoring */
export interface SearchResult {
  entry: KBEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai' | 'semantic';
  highlights?: string[];
  explanation?: string;
}

/** Search Query with filtering options */
export interface SearchQuery {
  query: string;
  category?: KBCategory;
  tags?: string[];
  useAI?: boolean;
  limit?: number;
  offset?: number;
}

/** User feedback for KB entries */
export interface EntryFeedback {
  entry_id: string;
  user_id?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  successful: boolean;
  comment?: string;
  timestamp: Date;
}

// ===========================
// AI SERVICE TYPES (MVP1)
// ===========================

/** Gemini API Configuration */
export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** AI Service Response */
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

/** AI Match Result */
export interface AIMatchResult {
  entries: SearchResult[];
  explanations: string[];
  confidence: number;
  processing_time: number;
}

// ===========================
// DATABASE TYPES (MVP1)
// ===========================

/** Database Configuration */
export interface DatabaseConfig {
  path: string;
  backup_interval?: number;
  max_size_mb?: number;
  performance_mode?: 'balanced' | 'speed' | 'memory';
}

/** Database Metrics */
export interface DatabaseMetrics {
  total_entries: number;
  searches_today: number;
  avg_response_time: number;
  cache_hit_rate: number;
  storage_used_mb: number;
}

/** Query Performance Stats */
export interface QueryStats {
  query: string;
  execution_time_ms: number;
  results_count: number;
  cache_hit: boolean;
  timestamp: Date;
}

// ===========================
// APPLICATION STATE (MVP1)
// ===========================

/** Main Application State */
export interface AppState {
  currentView: 'search' | 'browse' | 'add' | 'metrics' | 'settings';
  searchResults: SearchResult[];
  selectedEntry: KBEntry | null;
  isLoading: boolean;
  error: string | null;
  notifications: Notification[];
}

/** Notification System */
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

// ===========================
// UI COMPONENT TYPES (MVP1)
// ===========================

/** Common Button Props */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}

/** Search Input Props */
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string, useAI?: boolean) => void;
  placeholder?: string;
  loading?: boolean;
  autoFocus?: boolean;
}

/** Modal Props */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

// ===========================
// ELECTRON TYPES (MVP1)
// ===========================

/** Electron IPC API exposed to renderer */
export interface ElectronAPI {
  // Knowledge Base operations
  getKBEntries: (query?: SearchQuery) => Promise<SearchResult[]>;
  addKBEntry: (entry: Omit<KBEntry, 'id'>) => Promise<string>;
  updateKBEntry: (id: string, entry: Partial<KBEntry>) => Promise<void>;
  deleteKBEntry: (id: string) => Promise<void>;
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;
  
  // Search operations
  searchLocal: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  searchWithAI: (query: string, options?: SearchQuery) => Promise<SearchResult[]>;
  
  // System operations
  getMetrics: () => Promise<DatabaseMetrics>;
  exportKB: (path: string) => Promise<void>;
  importKB: (path: string) => Promise<number>;
  
  // Application lifecycle
  openDevTools: () => void;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<boolean>;
}

// Extend Window interface for Electron
declare global {
  interface Window {
    api: ElectronAPI;
  }
}

// ===========================
// PERFORMANCE MONITORING (MVP1)
// ===========================

/** Performance Metrics */
export interface PerformanceMetrics {
  search_avg_time: number;
  cache_hit_rate: number;
  memory_usage_mb: number;
  database_size_mb: number;
  startup_time_ms: number;
  last_updated: Date;
}

/** Performance Threshold */
export interface PerformanceThreshold {
  metric: keyof PerformanceMetrics;
  warning_value: number;
  critical_value: number;
  current_value: number;
  status: 'healthy' | 'warning' | 'critical';
}

// ===========================
// FUTURE MVP EXTENSIBILITY
// ===========================

/** Base Entity for Future MVPs */
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  metadata?: Record<string, any>;
}

/** Pattern Detection (MVP2 preparation) */
export interface PatternBase extends BaseEntity {
  type: string;
  confidence: number;
  frequency: number;
  status: 'active' | 'resolved' | 'monitoring';
}

/** Code Reference (MVP3 preparation) */
export interface CodeReference extends BaseEntity {
  file_path: string;
  line_start: number;
  line_end?: number;
  language: 'cobol' | 'jcl' | 'sql' | 'other';
  kb_entry_id: string;
}

/** Template Base (MVP4 preparation) */
export interface TemplateBase extends BaseEntity {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, any>;
  success_rate: number;
}

/** Analytics Base (MVP5 preparation) */
export interface AnalyticsBase {
  timeframe: '1h' | '24h' | '7d' | '30d' | '90d';
  metrics: Record<string, number>;
  trends: Record<string, number>;
  insights: string[];
}

// ===========================
// UTILITY TYPES
// ===========================

/** Generic API Response */
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

/** Pagination */
export interface Pagination {
  page: number;
  size: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

/** Sort Configuration */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/** Filter Configuration */
export interface FilterConfig {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
  value: any;
}

// ===========================
// ERROR HANDLING
// ===========================

/** Application Error Types */
export type AppErrorType = 
  | 'DATABASE_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN_ERROR';

/** Application Error */
export interface AppError {
  type: AppErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
  stack?: string;
}

// ===========================
// CONFIGURATION TYPES
// ===========================

/** Application Configuration */
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

// ===========================
// UNIFIED ENTRY TYPES
// ===========================

// Export unified types for the new unified table structure
export * from './unified';

// Backward compatibility aliases - maintain existing API
export type { UnifiedEntry as Entry } from './unified';
export type { KnowledgeBaseEntry as KBEntry } from './unified';
export type { IncidentEntry as IncidentKBEntry } from './unified';
export type { KnowledgeEntryInput as KBEntryInput } from './unified';
export type { KnowledgeEntryUpdate as KBEntryUpdate } from './unified';
export type { UnifiedSearchQuery as SearchQuery } from './unified';
export type { UnifiedSearchResult as SearchResult } from './unified';

// Type guards for runtime type checking
export {
  isIncident,
  isKnowledge,
  isValidIncident,
  isValidKnowledge,
  mapRowToUnifiedEntry,
  mapUnifiedEntryToRow
} from './unified';

// ===========================
// UPDATED SERVICE INTERFACES
// ===========================

/** Updated Electron API for unified entries */
export interface ElectronAPIUpdated {
  // Unified entry operations
  getEntries: (query?: UnifiedSearchQuery) => Promise<UnifiedSearchResult[]>;
  addEntry: (entry: UnifiedEntryInput) => Promise<string>;
  updateEntry: (id: string, entry: UnifiedEntryUpdate) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;

  // Legacy KB operations (for backward compatibility)
  getKBEntries: (query?: SearchQuery) => Promise<SearchResult[]>;
  addKBEntry: (entry: Omit<KBEntry, 'id'>) => Promise<string>;
  updateKBEntry: (id: string, entry: Partial<KBEntry>) => Promise<void>;
  deleteKBEntry: (id: string) => Promise<void>;

  // Search operations
  searchLocal: (query: string, options?: UnifiedSearchQuery) => Promise<UnifiedSearchResult[]>;
  searchWithAI: (query: string, options?: UnifiedSearchQuery) => Promise<UnifiedSearchResult[]>;

  // System operations
  getMetrics: () => Promise<DatabaseMetrics>;
  exportKB: (path: string) => Promise<void>;
  importKB: (path: string) => Promise<number>;

  // Application lifecycle
  openDevTools: () => void;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<boolean>;
}

/** Updated Application State for unified entries */
export interface AppStateUpdated {
  currentView: 'search' | 'browse' | 'add' | 'metrics' | 'settings' | 'incidents';
  searchResults: UnifiedSearchResult[];
  selectedEntry: UnifiedEntry | null;
  isLoading: boolean;
  error: string | null;
  notifications: Notification[];

  // Entry type filter
  entryTypeFilter: 'all' | 'knowledge' | 'incident';
}

// ===========================
// EXPORT ALL TYPES
// ===========================

// Re-export React types for convenience
export type { ReactNode, ReactElement, ComponentProps, FC } from 'react';

// Note: Main type interfaces are already exported above individually
// No need for re-export block to avoid conflicts