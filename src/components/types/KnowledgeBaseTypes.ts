/**
 * Knowledge Base Domain-Specific Component Types
 * Provides typed interfaces for KB-specific components
 */

import {
  BaseComponentProps,
  StyledComponentProps,
  FormComponentProps,
  RenderPropComponent,
  VirtualizedComponentProps
} from './BaseComponent';
import { KBEntry, KBCategory, SearchResult } from '../../types';

// =========================
// KB SEARCH COMPONENTS
// =========================

/**
 * Search interface component props
 */
export interface SearchInterfaceProps extends StyledComponentProps {
  /** Search query */
  query?: string;

  /** Query change handler */
  onQueryChange?: (query: string) => void;

  /** Search execution handler */
  onSearch?: (query: string, options?: SearchOptions) => void;

  /** Search options */
  searchOptions?: SearchOptions;

  /** Loading state */
  isLoading?: boolean;

  /** Search suggestions */
  suggestions?: string[];

  /** Enable AI-powered search */
  enableAI?: boolean;

  /** Search history */
  history?: SearchHistoryItem[];

  /** Auto-complete configuration */
  autoComplete?: AutoCompleteConfig;
}

export interface SearchOptions {
  /** Search categories */
  categories?: KBCategory[];

  /** Search tags */
  tags?: string[];

  /** Sort by */
  sortBy?: 'relevance' | 'date' | 'usage' | 'rating';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';

  /** Result limit */
  limit?: number;

  /** Include AI matching */
  useAI?: boolean;

  /** Minimum confidence score */
  minConfidence?: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
  options?: SearchOptions;
}

export interface AutoCompleteConfig {
  /** Enable auto-complete */
  enabled?: boolean;

  /** Minimum characters to trigger */
  minChars?: number;

  /** Debounce delay */
  debounce?: number;

  /** Max suggestions to show */
  maxSuggestions?: number;

  /** Custom suggestion provider */
  provider?: (query: string) => Promise<string[]>;
}

// =========================
// KB ENTRY COMPONENTS
// =========================

/**
 * KB entry display component props
 */
export interface KBEntryDisplayProps extends StyledComponentProps {
  /** KB entry data */
  entry: KBEntry;

  /** Display mode */
  mode?: 'card' | 'list' | 'detail' | 'preview';

  /** Show metadata */
  showMetadata?: boolean;

  /** Show actions */
  showActions?: boolean;

  /** Custom actions */
  actions?: KBEntryAction[];

  /** Click handler */
  onClick?: (entry: KBEntry) => void;

  /** Rating handler */
  onRate?: (entryId: string, rating: number) => void;

  /** Usage tracking handler */
  onUse?: (entryId: string) => void;

  /** Highlight search terms */
  highlightTerms?: string[];

  /** Maximum content preview length */
  previewLength?: number;
}

export interface KBEntryAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  handler: (entry: KBEntry) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  visible?: (entry: KBEntry) => boolean;
}

/**
 * KB entry list component props
 */
export interface KBEntryListProps extends VirtualizedComponentProps {
  /** List of KB entries */
  entries: KBEntry[];

  /** Selected entry IDs */
  selectedIds?: string[];

  /** Selection change handler */
  onSelectionChange?: (selectedIds: string[]) => void;

  /** Entry click handler */
  onEntryClick?: (entry: KBEntry) => void;

  /** Multi-select mode */
  multiSelect?: boolean;

  /** Loading state */
  isLoading?: boolean;

  /** Error state */
  error?: string;

  /** Empty state component */
  emptyState?: React.ReactNode;

  /** Loading component */
  loadingComponent?: React.ReactNode;

  /** Entry renderer */
  renderEntry?: (entry: KBEntry, index: number) => React.ReactNode;

  /** Group by field */
  groupBy?: keyof KBEntry | ((entry: KBEntry) => string);

  /** Sort configuration */
  sortConfig?: SortConfig<KBEntry>;

  /** Filter configuration */
  filterConfig?: FilterConfig<KBEntry>;
}

// =========================
// KB FORM COMPONENTS
// =========================

/**
 * KB entry form component props
 */
export interface KBEntryFormProps extends StyledComponentProps {
  /** Initial entry data */
  initialData?: Partial<KBEntry>;

  /** Form mode */
  mode?: 'create' | 'edit' | 'clone';

  /** Form submission handler */
  onSubmit?: (data: KBEntryFormData) => Promise<void>;

  /** Form cancellation handler */
  onCancel?: () => void;

  /** Form deletion handler (edit mode) */
  onDelete?: (entryId: string) => Promise<void>;

  /** Validation configuration */
  validation?: KBEntryValidationConfig;

  /** Available categories */
  categories?: KBCategory[];

  /** Tag suggestions */
  tagSuggestions?: string[];

  /** Auto-save configuration */
  autoSave?: AutoSaveConfig;

  /** Rich text editor configuration */
  richTextConfig?: RichTextConfig;

  /** Template system */
  templates?: KBEntryTemplate[];
}

export interface KBEntryFormData {
  title: string;
  problem: string;
  solution: string;
  category: KBCategory;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface KBEntryValidationConfig {
  /** Real-time validation */
  realTime?: boolean;

  /** Custom validation rules */
  customRules?: ValidationRule[];

  /** AI-powered validation */
  aiValidation?: boolean;

  /** Duplicate detection */
  duplicateDetection?: boolean;
}

export interface AutoSaveConfig {
  /** Enable auto-save */
  enabled?: boolean;

  /** Save interval in milliseconds */
  interval?: number;

  /** Save on blur */
  saveOnBlur?: boolean;

  /** Save confirmation */
  showConfirmation?: boolean;
}

export interface RichTextConfig {
  /** Enable rich text editing */
  enabled?: boolean;

  /** Toolbar configuration */
  toolbar?: string[];

  /** Allowed formats */
  formats?: string[];

  /** Code highlighting */
  codeHighlighting?: boolean;

  /** Image upload */
  imageUpload?: boolean;
}

export interface KBEntryTemplate {
  id: string;
  name: string;
  description: string;
  category: KBCategory;
  template: Partial<KBEntryFormData>;
}

// =========================
// KB METRICS COMPONENTS
// =========================

/**
 * KB metrics dashboard component props
 */
export interface KBMetricsProps extends StyledComponentProps {
  /** Metrics data */
  metrics: KBMetricsData;

  /** Time range */
  timeRange?: MetricsTimeRange;

  /** Time range change handler */
  onTimeRangeChange?: (range: MetricsTimeRange) => void;

  /** Chart type preferences */
  chartTypes?: ChartTypeConfig;

  /** Export functionality */
  enableExport?: boolean;

  /** Real-time updates */
  realTimeUpdates?: boolean;

  /** Custom metric renderers */
  customRenderers?: Record<string, MetricRenderer>;

  /** Drill-down handlers */
  onDrillDown?: (metric: string, filters: any) => void;
}

export interface KBMetricsData {
  /** Total entries */
  totalEntries: number;

  /** Search metrics */
  searchMetrics: SearchMetrics;

  /** Usage metrics */
  usageMetrics: UsageMetrics;

  /** Category distribution */
  categoryDistribution: CategoryMetrics[];

  /** Top performing entries */
  topEntries: EntryPerformanceMetric[];

  /** Time-series data */
  timeSeries: TimeSeriesData[];
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueQueries: number;
  avgResponseTime: number;
  successRate: number;
  aiUsageRate: number;
}

export interface UsageMetrics {
  avgSessionTime: number;
  pageViews: number;
  uniqueUsers: number;
  returnRate: number;
  conversionRate: number;
}

export interface CategoryMetrics {
  category: KBCategory;
  entryCount: number;
  searchCount: number;
  successRate: number;
}

export interface EntryPerformanceMetric {
  entryId: string;
  title: string;
  viewCount: number;
  successRate: number;
  avgRating: number;
  lastUsed: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  searches: number;
  entries: number;
  users: number;
  success: number;
}

export type MetricsTimeRange = '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';

export interface ChartTypeConfig {
  default: 'bar' | 'line' | 'pie' | 'area';
  overrides?: Record<string, string>;
}

export type MetricRenderer = (
  data: any,
  config: any
) => React.ReactNode;

// =========================
// UTILITY TYPES
// =========================

export interface SortConfig<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
  compareFn?: (a: T, b: T) => number;
}

export interface FilterConfig<T> {
  filters: FilterRule<T>[];
  operator: 'and' | 'or';
}

export interface FilterRule<T> {
  field: keyof T;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

export interface ValidationRule {
  name: string;
  field: string;
  validator: (value: any, formData?: any) => boolean | string;
  message?: string;
  async?: boolean;
}

// =========================
// RENDER PROPS PATTERNS
// =========================

/**
 * Search render prop component
 */
export interface SearchRenderProps extends RenderPropComponent<SearchResult[]> {
  query: string;
  isLoading: boolean;
  error?: string;
  onSearch: (query: string) => void;
}

/**
 * Entry list render prop component
 */
export interface EntryListRenderProps extends RenderPropComponent<KBEntry[]> {
  entries: KBEntry[];
  isLoading: boolean;
  error?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

/**
 * Metrics render prop component
 */
export interface MetricsRenderProps extends RenderPropComponent<KBMetricsData> {
  metrics: KBMetricsData;
  isLoading: boolean;
  error?: string;
  refresh: () => void;
  timeRange: MetricsTimeRange;
  setTimeRange: (range: MetricsTimeRange) => void;
}