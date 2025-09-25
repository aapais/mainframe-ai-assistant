/**
 * Unified Entry Types for Knowledge Base and Incident Management
 * Provides a single interface for the unified database table structure
 * with strong typing and discriminated unions for type safety
 */

// Import types directly to avoid circular dependencies
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
// BASE UNIFIED ENTRY INTERFACE
// ===========================

/**
 * Base interface for all entries in the unified table
 * Contains common fields shared between knowledge base and incident entries
 */
export interface BaseUnifiedEntry {
  // Core identification
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: KBCategory;
  tags: string[];

  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: string;
  version: number;

  // Usage tracking (for both KB and incidents)
  usage_count: number;
  success_count: number;
  failure_count: number;

  // Entry type discriminator - THIS IS KEY FOR THE UNIFIED TABLE
  entry_type: 'knowledge' | 'incident';
}

// ===========================
// KNOWLEDGE BASE ENTRY
// ===========================

/**
 * Knowledge Base Entry - traditional KB entries
 * All incident-specific fields are undefined for knowledge entries
 */
export interface KnowledgeBaseEntry extends BaseUnifiedEntry {
  entry_type: 'knowledge';

  // Incident-specific fields are explicitly undefined for knowledge entries
  status?: undefined;
  priority?: undefined;
  assigned_to?: undefined;
  escalation_level?: undefined;
  resolution_time?: undefined;
  sla_deadline?: undefined;
  last_status_change?: undefined;
  affected_systems?: undefined;
  business_impact?: undefined;
  customer_impact?: undefined;
  reporter?: undefined;
  resolver?: undefined;
  incident_number?: undefined;
  external_ticket_id?: undefined;

  // KB-specific metadata
  kb_metadata?: {
    verified: boolean;
    verification_date?: Date;
    verified_by?: string;
    confidence_score?: number;
    effectiveness_rating?: number;
  };
}

// ===========================
// INCIDENT ENTRY
// ===========================

/**
 * Incident Entry - incident management entries
 * Extends base with all incident-specific fields
 */
export interface IncidentEntry extends BaseUnifiedEntry {
  entry_type: 'incident';

  // Incident management fields
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

  // Additional incident metadata
  incident_metadata?: {
    severity?: 'critical' | 'high' | 'medium' | 'low';
    root_cause?: string;
    resolution_type?:
      | 'fixed'
      | 'workaround'
      | 'duplicate'
      | 'cannot_reproduce'
      | 'invalid'
      | 'wont_fix';
    escalation_count?: number;
    reopen_count?: number;
    sla_breach?: boolean;
    related_kb_entries?: string[];
  };
}

// ===========================
// UNIFIED ENTRY TYPE
// ===========================

/**
 * Unified Entry - discriminated union of all entry types
 * This is the main type to use throughout the application
 */
export type UnifiedEntry = KnowledgeBaseEntry | IncidentEntry;

// ===========================
// TYPE GUARDS
// ===========================

/**
 * Type guard to check if an entry is an incident
 */
export function isIncident(entry: UnifiedEntry): entry is IncidentEntry {
  return entry.entry_type === 'incident';
}

/**
 * Type guard to check if an entry is a knowledge base entry
 */
export function isKnowledge(entry: UnifiedEntry): entry is KnowledgeBaseEntry {
  return entry.entry_type === 'knowledge';
}

/**
 * Type guard with additional runtime validation for incidents
 */
export function isValidIncident(entry: UnifiedEntry): entry is IncidentEntry {
  return (
    isIncident(entry) &&
    entry.status !== undefined &&
    entry.priority !== undefined &&
    entry.escalation_level !== undefined
  );
}

/**
 * Type guard with additional runtime validation for knowledge entries
 */
export function isValidKnowledge(entry: UnifiedEntry): entry is KnowledgeBaseEntry {
  return isKnowledge(entry) && entry.status === undefined && entry.priority === undefined;
}

// ===========================
// INPUT TYPES FOR CREATION
// ===========================

/**
 * Input type for creating a new knowledge base entry
 */
export interface KnowledgeEntryInput {
  title: string;
  problem: string;
  solution: string;
  category: KBCategory;
  tags?: string[];
  created_by?: string;
  kb_metadata?: KnowledgeBaseEntry['kb_metadata'];
}

/**
 * Input type for creating a new incident entry
 */
export interface IncidentEntryInput {
  title: string;
  problem: string;
  solution?: string; // Optional for new incidents
  category: KBCategory;
  tags?: string[];
  created_by?: string;

  // Required incident fields
  status: IncidentStatus;
  priority: IncidentPriority;
  escalation_level?: EscalationLevel;

  // Optional incident fields
  assigned_to?: string;
  affected_systems?: string[];
  business_impact?: 'low' | 'medium' | 'high' | 'critical';
  customer_impact?: boolean;
  reporter?: string;
  incident_number?: string;
  external_ticket_id?: string;
  sla_deadline?: Date;

  incident_metadata?: IncidentEntry['incident_metadata'];
}

/**
 * Unified input type using discriminated union
 */
export type UnifiedEntryInput =
  | ({ entry_type: 'knowledge' } & KnowledgeEntryInput)
  | ({ entry_type: 'incident' } & IncidentEntryInput);

// ===========================
// UPDATE TYPES
// ===========================

/**
 * Update type for knowledge base entries
 */
export interface KnowledgeEntryUpdate {
  title?: string;
  problem?: string;
  solution?: string;
  category?: KBCategory;
  tags?: string[];
  updated_by?: string;
  kb_metadata?: Partial<KnowledgeBaseEntry['kb_metadata']>;
}

/**
 * Update type for incident entries
 */
export interface IncidentEntryUpdate {
  title?: string;
  problem?: string;
  solution?: string;
  category?: KBCategory;
  tags?: string[];
  updated_by?: string;

  // Incident-specific updates
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assigned_to?: string;
  escalation_level?: EscalationLevel;
  affected_systems?: string[];
  business_impact?: 'low' | 'medium' | 'high' | 'critical';
  customer_impact?: boolean;
  resolver?: string;
  sla_deadline?: Date;

  incident_metadata?: Partial<IncidentEntry['incident_metadata']>;
}

/**
 * Unified update type using discriminated union
 */
export type UnifiedEntryUpdate =
  | ({ entry_type: 'knowledge' } & KnowledgeEntryUpdate)
  | ({ entry_type: 'incident' } & IncidentEntryUpdate);

// ===========================
// SEARCH AND FILTER TYPES
// ===========================

/**
 * Enhanced search query that works with unified entries
 */
export interface UnifiedSearchQuery {
  query: string;
  entry_type?: 'knowledge' | 'incident' | 'both';
  category?: KBCategory;
  tags?: string[];

  // Knowledge-specific filters
  verified?: boolean;

  // Incident-specific filters
  status?: IncidentStatus[];
  priority?: IncidentPriority[];
  assigned_to?: string[];
  business_impact?: ('low' | 'medium' | 'high' | 'critical')[];

  // Common filters
  useAI?: boolean;
  limit?: number;
  offset?: number;
  created_after?: Date;
  created_before?: Date;
}

/**
 * Enhanced search result with unified entry
 */
export interface UnifiedSearchResult {
  entry: UnifiedEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai' | 'semantic';
  highlights?: string[];
  explanation?: string;

  // Entry type specific context
  context?: {
    // For incidents
    sla_status?: 'on_time' | 'at_risk' | 'breached';
    urgency_score?: number;

    // For knowledge
    effectiveness_score?: number;
    usage_frequency?: 'high' | 'medium' | 'low';
  };
}

// ===========================
// DATABASE MAPPING HELPERS
// ===========================

/**
 * Database row interface - matches the unified table structure
 * This is what we get from SQLite queries
 */
export interface UnifiedEntryRow {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string; // JSON string
  created_at: string; // ISO string
  updated_at: string; // ISO string
  created_by: string;
  version: number;
  usage_count: number;
  success_count: number;
  failure_count: number;
  entry_type: 'knowledge' | 'incident';

  // Incident fields (nullable for knowledge entries)
  status?: string;
  priority?: string;
  assigned_to?: string;
  escalation_level?: string;
  resolution_time?: number;
  sla_deadline?: string; // ISO string
  last_status_change?: string; // ISO string
  affected_systems?: string; // JSON string
  business_impact?: string;
  customer_impact?: number; // SQLite boolean as 0/1
  reporter?: string;
  resolver?: string;
  incident_number?: string;
  external_ticket_id?: string;

  // Metadata fields (JSON strings)
  kb_metadata?: string;
  incident_metadata?: string;
}

/**
 * Utility function to convert database row to UnifiedEntry
 */
export function mapRowToUnifiedEntry(row: UnifiedEntryRow): UnifiedEntry {
  const baseEntry = {
    id: row.id,
    title: row.title,
    problem: row.problem,
    solution: row.solution,
    category: row.category as KBCategory,
    tags: row.tags ? JSON.parse(row.tags) : [],
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    created_by: row.created_by,
    version: row.version,
    usage_count: row.usage_count,
    success_count: row.success_count,
    failure_count: row.failure_count,
    entry_type: row.entry_type,
  };

  if (row.entry_type === 'knowledge') {
    return {
      ...baseEntry,
      entry_type: 'knowledge',
      kb_metadata: row.kb_metadata ? JSON.parse(row.kb_metadata) : undefined,
    } as KnowledgeBaseEntry;
  } else {
    return {
      ...baseEntry,
      entry_type: 'incident',
      status: row.status as IncidentStatus,
      priority: row.priority as IncidentPriority,
      assigned_to: row.assigned_to,
      escalation_level: (row.escalation_level as EscalationLevel) || 'none',
      resolution_time: row.resolution_time,
      sla_deadline: row.sla_deadline ? new Date(row.sla_deadline) : undefined,
      last_status_change: row.last_status_change ? new Date(row.last_status_change) : undefined,
      affected_systems: row.affected_systems ? JSON.parse(row.affected_systems) : undefined,
      business_impact: row.business_impact as 'low' | 'medium' | 'high' | 'critical' | undefined,
      customer_impact: row.customer_impact ? Boolean(row.customer_impact) : undefined,
      reporter: row.reporter,
      resolver: row.resolver,
      incident_number: row.incident_number,
      external_ticket_id: row.external_ticket_id,
      incident_metadata: row.incident_metadata ? JSON.parse(row.incident_metadata) : undefined,
    } as IncidentEntry;
  }
}

/**
 * Utility function to convert UnifiedEntry to database row
 */
export function mapUnifiedEntryToRow(
  entry: UnifiedEntry
): Omit<UnifiedEntryRow, 'id' | 'created_at' | 'updated_at' | 'version'> {
  const baseRow = {
    title: entry.title,
    problem: entry.problem,
    solution: entry.solution,
    category: entry.category,
    tags: JSON.stringify(entry.tags),
    created_by: entry.created_by,
    usage_count: entry.usage_count,
    success_count: entry.success_count,
    failure_count: entry.failure_count,
    entry_type: entry.entry_type,
  };

  if (isKnowledge(entry)) {
    return {
      ...baseRow,
      kb_metadata: entry.kb_metadata ? JSON.stringify(entry.kb_metadata) : undefined,
      // Incident fields are undefined/null for knowledge entries
      status: undefined,
      priority: undefined,
      assigned_to: undefined,
      escalation_level: undefined,
      resolution_time: undefined,
      sla_deadline: undefined,
      last_status_change: undefined,
      affected_systems: undefined,
      business_impact: undefined,
      customer_impact: undefined,
      reporter: undefined,
      resolver: undefined,
      incident_number: undefined,
      external_ticket_id: undefined,
      incident_metadata: undefined,
    };
  } else {
    return {
      ...baseRow,
      status: entry.status,
      priority: entry.priority,
      assigned_to: entry.assigned_to,
      escalation_level: entry.escalation_level,
      resolution_time: entry.resolution_time,
      sla_deadline: entry.sla_deadline?.toISOString(),
      last_status_change: entry.last_status_change?.toISOString(),
      affected_systems: entry.affected_systems ? JSON.stringify(entry.affected_systems) : undefined,
      business_impact: entry.business_impact,
      customer_impact:
        entry.customer_impact !== undefined ? (entry.customer_impact ? 1 : 0) : undefined,
      reporter: entry.reporter,
      resolver: entry.resolver,
      incident_number: entry.incident_number,
      external_ticket_id: entry.external_ticket_id,
      incident_metadata: entry.incident_metadata
        ? JSON.stringify(entry.incident_metadata)
        : undefined,
      kb_metadata: undefined,
    };
  }
}

// ===========================
// UTILITY TYPES
// ===========================

/**
 * Extract specific entry type from UnifiedEntry
 */
export type ExtractEntryType<T extends UnifiedEntry['entry_type']> = T extends 'knowledge'
  ? KnowledgeBaseEntry
  : T extends 'incident'
    ? IncidentEntry
    : never;

/**
 * Get input type for specific entry type
 */
export type ExtractInputType<T extends UnifiedEntry['entry_type']> = T extends 'knowledge'
  ? KnowledgeEntryInput
  : T extends 'incident'
    ? IncidentEntryInput
    : never;

/**
 * Get update type for specific entry type
 */
export type ExtractUpdateType<T extends UnifiedEntry['entry_type']> = T extends 'knowledge'
  ? KnowledgeEntryUpdate
  : T extends 'incident'
    ? IncidentEntryUpdate
    : never;
