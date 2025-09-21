// Incident management types and interfaces

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  impactLevel: ImpactLevel;
  category: string;
  assignedTo?: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  tags: string[];
  slaStatus: SLAStatus;
  slaDeadline?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  affectedSystems: string[];
  worklog?: WorklogEntry[];
}

export type IncidentStatus = 'open' | 'in-progress' | 'resolved' | 'closed' | 'pending';

export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';

export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

export type SLAStatus = 'on-time' | 'at-risk' | 'breached';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  isInternal: boolean;
}

export interface WorklogEntry {
  id: string;
  description: string;
  timeSpent: number; // in minutes
  author: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
}

export type UserRole = 'admin' | 'manager' | 'technician' | 'viewer';

export interface IncidentCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  parentId?: string;
}

export interface SLATemplate {
  id: string;
  name: string;
  priority: IncidentPriority;
  responseTime: number; // in minutes
  resolutionTime: number; // in minutes
}

// Filter related types
export interface IncidentFilters {
  status: IncidentStatus[];
  priority: IncidentPriority[];
  dateRange: {
    type: 'created' | 'updated' | 'resolved';
    startDate: string;
    endDate: string;
  } | null;
  assignedTo: string[];
  category: string[];
  impactLevel: ImpactLevel[];
  tags: string[];
  slaStatus: SLAStatus[];
  searchText: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: IncidentFilters;
  isDefault?: boolean;
  createdBy: string;
  createdAt: string;
}

export interface QuickFilter {
  id: string;
  name: string;
  icon: string;
  filters: Partial<IncidentFilters>;
  isDefault: boolean;
}

// Analytics and reporting types
export interface IncidentMetrics {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  averageResolutionTime: number;
  slaBreaches: number;
  incidentsByPriority: Record<IncidentPriority, number>;
  incidentsByCategory: Record<string, number>;
  trendsOverTime: {
    date: string;
    opened: number;
    resolved: number;
  }[];
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeComments: boolean;
  includeWorklog: boolean;
  includeAttachments: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// API response types
export interface IncidentListResponse {
  incidents: Incident[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface IncidentDetailResponse {
  incident: Incident;
  relatedIncidents: Incident[];
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  id: string;
  type: 'created' | 'updated' | 'comment' | 'status_change' | 'assignment' | 'resolved' | 'reopened';
  description: string;
  author: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

// Form types
export interface CreateIncidentData {
  title: string;
  description: string;
  priority: IncidentPriority;
  impactLevel: ImpactLevel;
  category: string;
  assignedTo?: string;
  tags: string[];
  affectedSystems: string[];
}

export interface UpdateIncidentData extends Partial<CreateIncidentData> {
  status?: IncidentStatus;
}

// Validation schemas
export interface IncidentValidationErrors {
  title?: string;
  description?: string;
  priority?: string;
  impactLevel?: string;
  category?: string;
  assignedTo?: string;
  tags?: string;
  affectedSystems?: string;
}

// Component props interfaces
export interface IncidentListProps {
  filters: IncidentFilters;
  onFiltersChange: (filters: IncidentFilters) => void;
  onIncidentSelect: (incident: Incident) => void;
  onIncidentCreate: () => void;
  className?: string;
}

export interface IncidentCardProps {
  incident: Incident;
  onClick: () => void;
  onStatusChange?: (status: IncidentStatus) => void;
  onPriorityChange?: (priority: IncidentPriority) => void;
  compact?: boolean;
  className?: string;
}

export interface AdvancedFiltersPanelProps {
  filters: IncidentFilters;
  onFiltersChange: (filters: IncidentFilters) => void;
  onExport: (filters: IncidentFilters) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

// Hook return types
export interface UseIncidentListReturn {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  filters: IncidentFilters;
  setFilters: (filters: IncidentFilters) => void;
}

export interface UseIncidentDetailReturn {
  incident: Incident | null;
  loading: boolean;
  error: string | null;
  update: (data: UpdateIncidentData) => Promise<void>;
  addComment: (comment: string, isInternal: boolean) => Promise<void>;
  addWorklog: (description: string, timeSpent: number) => Promise<void>;
  refresh: () => void;
}

// Context types
export interface IncidentContextValue {
  incidents: Incident[];
  selectedIncident: Incident | null;
  filters: IncidentFilters;
  setFilters: (filters: IncidentFilters) => void;
  selectIncident: (incident: Incident | null) => void;
  createIncident: (data: CreateIncidentData) => Promise<Incident>;
  updateIncident: (id: string, data: UpdateIncidentData) => Promise<Incident>;
  deleteIncident: (id: string) => Promise<void>;
  refreshIncidents: () => void;
}

// Utility types
export type IncidentSortField = 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'slaDeadline';
export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  field: IncidentSortField;
  direction: SortDirection;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface IncidentListOptions {
  filters: IncidentFilters;
  sort: SortOptions;
  pagination: PaginationOptions;
}