/**
 * Incident Management Types and Interfaces
 * Phase 2: UX Enhancement for incident tracking and management
 */

import { KBEntry } from '../index';

// ===========================
// INCIDENT STATUS TYPES
// ===========================

export type IncidentStatus =
  | 'aberto' // open
  | 'em_tratamento' // in_progress (covers both assigned and in_progress)
  | 'em_revisao' // pending_review (bulk/API imports)
  | 'resolvido' // resolved
  | 'fechado' // closed
  | 'reaberto'; // reopened

export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';

export type EscalationLevel = 'none' | 'level_1' | 'level_2' | 'level_3';

// ===========================
// EXTENDED KB ENTRY FOR INCIDENTS
// ===========================

export interface IncidentKBEntry extends KBEntry {
  // Incident-specific fields
  status: IncidentStatus;
  priority: IncidentPriority;
  assigned_to?: string;
  escalation_level: EscalationLevel;
  resolution_time?: number; // in minutes
  sla_deadline?: Date;
  last_status_change?: Date;
  affected_systems?: string[];
  business_impact?: 'low' | 'medium' | 'high' | 'critical';
  customer_impact?: boolean;

  // Tracking fields
  reporter?: string;
  resolver?: string;
  incident_number?: string;
  external_ticket_id?: string;
}

// ===========================
// INCIDENT WORKFLOW TYPES
// ===========================

export interface StatusTransition {
  id: string;
  incident_id: string;
  from_status: IncidentStatus;
  to_status: IncidentStatus;
  changed_by: string;
  change_reason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  author: string;
  content: string;
  is_internal: boolean;
  timestamp: Date;
  attachments?: string[];
}

// ===========================
// DASHBOARD AND METRICS TYPES
// ===========================

export interface IncidentMetrics {
  total_open: number;
  total_assigned: number;
  total_in_progress: number;
  total_resolved_today: number;
  avg_resolution_time: number; // in minutes
  sla_breaches: number;
  priority_distribution: Record<IncidentPriority, number>;
  status_distribution: Record<IncidentStatus, number>;
  recent_incidents: IncidentKBEntry[];
}

export interface IncidentFilter {
  status?: IncidentStatus[];
  priority?: IncidentPriority[];
  assigned_to?: string[];
  category?: string[];
  date_range?: {
    from: Date;
    to: Date;
  };
  sla_status?: 'on_time' | 'at_risk' | 'breached';
}

// ===========================
// QUEUE AND LIST TYPES
// ===========================

export interface IncidentQueueConfig {
  columns: ColumnConfig[];
  default_sort: {
    field: keyof IncidentKBEntry;
    direction: 'asc' | 'desc';
  };
  auto_refresh: boolean;
  refresh_interval: number; // in seconds
  filters: IncidentFilter;
}

export interface ColumnConfig {
  key: keyof IncidentKBEntry | 'actions';
  label: string;
  width?: number;
  sortable: boolean;
  visible: boolean;
  formatter?: (value: any, entry: IncidentKBEntry) => React.ReactNode;
}

// ===========================
// QUICK ACTIONS TYPES
// ===========================

export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: (incidents: IncidentKBEntry[]) => void;
  requires_selection: boolean;
  bulk_action: boolean;
  permissions?: string[];
  confirmation_required?: boolean;
  confirmation_message?: string;
}

export interface BulkOperation {
  action: 'assign' | 'change_status' | 'change_priority' | 'add_comment' | 'escalate';
  target_value?: any;
  incident_ids: string[];
  performed_by: string;
  reason?: string;
}

// ===========================
// API RESPONSE TYPES
// ===========================

export interface IncidentListResponse {
  incidents: IncidentKBEntry[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
  filters_applied: IncidentFilter;
}

export interface IncidentStatsResponse {
  metrics: IncidentMetrics;
  trends: {
    resolution_time_trend: number[]; // last 7 days
    volume_trend: number[]; // last 7 days
    sla_compliance_trend: number[]; // last 7 days
  };
  alerts: {
    sla_breaches: number;
    high_priority_unassigned: number;
    overdue_incidents: number;
  };
}

// ===========================
// UI COMPONENT PROPS
// ===========================

export interface PriorityBadgeProps {
  priority: IncidentPriority;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export interface StatusBadgeProps {
  status: IncidentStatus;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onStatusChange?: (newStatus: IncidentStatus) => void;
}

export interface IncidentQueueProps {
  filters?: IncidentFilter;
  config?: Partial<IncidentQueueConfig>;
  onIncidentSelect?: (incident: IncidentKBEntry) => void;
  onBulkAction?: (action: BulkOperation) => void;
  height?: number;
}

export interface IncidentDashboardProps {
  timeframe?: '24h' | '7d' | '30d';
  auto_refresh?: boolean;
  refresh_interval?: number;
}

// ===========================
// CHART DATA TYPES
// ===========================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface PriorityDistributionData {
  P1: { count: number; percentage: number; color: string };
  P2: { count: number; percentage: number; color: string };
  P3: { count: number; percentage: number; color: string };
  P4: { count: number; percentage: number; color: string };
}

// ===========================
// UTILITY TYPES
// ===========================

export type IncidentSortField =
  | 'priority'
  | 'status'
  | 'created_at'
  | 'updated_at'
  | 'resolution_time'
  | 'sla_deadline'
  | 'title';

export interface IncidentSort {
  field: IncidentSortField;
  direction: 'asc' | 'desc';
}

export interface IncidentSearchParams {
  query?: string;
  filters?: IncidentFilter;
  sort?: IncidentSort;
  page?: number;
  page_size?: number;
}

// ===========================
// CONSTANTS
// ===========================

export const PRIORITY_COLORS: Record<IncidentPriority, string> = {
  P1: '#ef4444', // red-500
  P2: '#f97316', // orange-500
  P3: '#eab308', // yellow-500
  P4: '#22c55e', // green-500
};

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  aberto: '#6b7280', // gray-500 (open)
  em_tratamento: '#f59e0b', // amber-500 (in_progress)
  em_revisao: '#8b5cf6', // violet-500 (pending_review)
  resolvido: '#10b981', // emerald-500 (resolved)
  fechado: '#6b7280', // gray-500 (closed)
  reaberto: '#ef4444', // red-500 (reopened)
};

export const PRIORITY_LABELS: Record<IncidentPriority, string> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  aberto: 'Aberto', // Open
  em_tratamento: 'Em Tratamento', // In Progress/Assigned
  em_revisao: 'Em Revisão', // Pending Review
  resolvido: 'Resolvido', // Resolved
  fechado: 'Fechado', // Closed
  reaberto: 'Reaberto', // Reopened
};

export const DEFAULT_SLA_MINUTES: Record<IncidentPriority, number> = {
  P1: 60, // 1 hour
  P2: 240, // 4 hours
  P3: 480, // 8 hours
  P4: 1440, // 24 hours
};
