/**
 * Unified Service - Merged Knowledge Base and Incident Service
 * Provides a clean API that hides the unified implementation from components
 * Maintains backward compatibility with existing KnowledgeBaseService and IncidentService
 */

import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
  SearchQuery,
  SearchResult,
  EntryFeedback,
  KBCategory,
} from '../../types';

import {
  IncidentKBEntry,
  IncidentFilter,
  IncidentSort,
  BulkOperation,
  StatusTransition,
  IncidentComment,
  IncidentMetrics,
  IncidentListResponse,
  IncidentStatus,
  IncidentPriority,
} from '../../types/incident';

// ===========================
// UNIFIED DATA MODEL TYPES
// ===========================

export type EntryType = 'knowledge_base' | 'incident';

export interface UnifiedEntry {
  // Base KB Entry fields
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
  archived?: boolean;

  // Entry type discriminator
  entry_type: EntryType;

  // Incident-specific fields (only populated for incident entries)
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assigned_to?: string;
  escalation_level?: string;
  resolution_time?: number;
  sla_deadline?: Date;
  last_status_change?: Date;
  affected_systems?: string[];
  business_impact?: 'low' | 'medium' | 'high' | 'critical';
  customer_impact?: boolean;
  reporter?: string;
  resolver?: string;
  incident_number?: string;
  external_ticket_id?: string;
}

export interface CreateUnifiedEntry extends Omit<CreateKBEntry, 'id'> {
  entry_type: EntryType;

  // Optional incident fields for creating incidents
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assigned_to?: string;
  reporter?: string;
  business_impact?: 'low' | 'medium' | 'high' | 'critical';
  customer_impact?: boolean;
  affected_systems?: string[];
}

export interface UpdateUnifiedEntry extends UpdateKBEntry {
  entry_type?: EntryType;

  // Optional incident fields for updating incidents
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assigned_to?: string;
  resolution_time?: number;
  business_impact?: 'low' | 'medium' | 'high' | 'critical';
  customer_impact?: boolean;
  affected_systems?: string[];
}

// Type-safe accessors for entry-specific fields
export interface KBEntryAccessor {
  asKBEntry(): KBEntry;
  isKBEntry(): boolean;
}

export interface IncidentEntryAccessor {
  asIncidentEntry(): IncidentKBEntry;
  isIncidentEntry(): boolean;
}

export interface UnifiedEntryWithAccessors
  extends UnifiedEntry,
    KBEntryAccessor,
    IncidentEntryAccessor {}

// ===========================
// IPC RESPONSE TYPES
// ===========================

interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: {
    executionTime: number;
    operationId: string;
  };
}

interface SearchOptions {
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'usage' | 'title';
  entry_type?: EntryType;
}

interface UnifiedStatistics {
  totalEntries: number;
  kbEntries: number;
  incidentEntries: number;
  categoryCounts: Record<string, number>;
  recentActivity: number;
  searchesToday: number;
  averageSuccessRate: number;
  topEntries: Array<{ id: string; title: string; usage: number; entry_type: EntryType }>;
}

// ===========================
// UNIFIED SERVICE CLASS
// ===========================

class UnifiedService {
  private static instance: UnifiedService;
  private ipcRenderer: any;

  constructor() {
    // Access the Electron IPC renderer
    this.ipcRenderer =
      (window as any).electronAPI ||
      (window as any).api ||
      (window as any).require?.('electron')?.ipcRenderer;

    if (!this.ipcRenderer) {
      console.warn('IPC Renderer not available - running in web mode');
    }
  }

  static getInstance(): UnifiedService {
    if (!UnifiedService.instance) {
      UnifiedService.instance = new UnifiedService();
    }
    return UnifiedService.instance;
  }

  /**
   * Add type-safe accessors to unified entries
   */
  private addAccessors(entry: UnifiedEntry): UnifiedEntryWithAccessors {
    const entryWithAccessors = entry as UnifiedEntryWithAccessors;

    entryWithAccessors.asKBEntry = function (): KBEntry {
      if (this.entry_type !== 'knowledge_base') {
        throw new Error('Entry is not a knowledge base entry');
      }
      const {
        entry_type,
        status,
        priority,
        assigned_to,
        escalation_level,
        resolution_time,
        sla_deadline,
        last_status_change,
        affected_systems,
        business_impact,
        customer_impact,
        reporter,
        resolver,
        incident_number,
        external_ticket_id,
        ...kbEntry
      } = this;
      return kbEntry as KBEntry;
    };

    entryWithAccessors.isKBEntry = function (): boolean {
      return this.entry_type === 'knowledge_base';
    };

    entryWithAccessors.asIncidentEntry = function (): IncidentKBEntry {
      if (this.entry_type !== 'incident') {
        throw new Error('Entry is not an incident entry');
      }
      return this as IncidentKBEntry;
    };

    entryWithAccessors.isIncidentEntry = function (): boolean {
      return this.entry_type === 'incident';
    };

    return entryWithAccessors;
  }

  // ===========================
  // UNIFIED ENTRY OPERATIONS
  // ===========================

  /**
   * Create a new entry (KB or Incident)
   */
  async createEntry(entryData: CreateUnifiedEntry): Promise<UnifiedEntryWithAccessors> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<UnifiedEntry> = await this.ipcRenderer.invoke(
        'unified:create-entry',
        entryData
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create entry');
      }

      if (!response.data) {
        throw new Error('No data returned from create operation');
      }

      this.trackOperation('create', response.metadata?.executionTime || 0);
      return this.addAccessors(response.data);
    } catch (error) {
      console.error('Error creating unified entry:', error);
      this.trackError('create', error as Error);
      throw error;
    }
  }

  /**
   * Update an existing entry
   */
  async updateEntry(
    id: string,
    updateData: UpdateUnifiedEntry
  ): Promise<UnifiedEntryWithAccessors> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<UnifiedEntry> = await this.ipcRenderer.invoke(
        'unified:update-entry',
        { id, data: updateData }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update entry');
      }

      if (!response.data) {
        throw new Error('No data returned from update operation');
      }

      this.trackOperation('update', response.metadata?.executionTime || 0);
      return this.addAccessors(response.data);
    } catch (error) {
      console.error('Error updating unified entry:', error);
      this.trackError('update', error as Error);
      throw error;
    }
  }

  /**
   * Get an entry by ID
   */
  async getEntry(id: string): Promise<UnifiedEntryWithAccessors> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<UnifiedEntry> = await this.ipcRenderer.invoke(
        'unified:get-entry',
        { id }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get entry');
      }

      if (!response.data) {
        throw new Error('Entry not found');
      }

      return this.addAccessors(response.data);
    } catch (error) {
      console.error('Error getting unified entry:', error);
      throw error;
    }
  }

  /**
   * Get all entries with optional filtering by type
   */
  async getEntries(
    options: SearchOptions = {}
  ): Promise<{ entries: UnifiedEntryWithAccessors[]; total: number }> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<{ entries: UnifiedEntry[]; total: number }> =
        await this.ipcRenderer.invoke('unified:get-entries', options);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get entries');
      }

      const result = response.data || { entries: [], total: 0 };
      return {
        entries: result.entries.map(entry => this.addAccessors(entry)),
        total: result.total,
      };
    } catch (error) {
      console.error('Error getting unified entries:', error);
      throw error;
    }
  }

  /**
   * Search entries across both KB and incidents
   */
  async searchEntries(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ entries: UnifiedEntryWithAccessors[]; total: number }> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<{ entries: UnifiedEntry[]; total: number }> =
        await this.ipcRenderer.invoke('unified:search-entries', { query, options });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to search entries');
      }

      const result = response.data || { entries: [], total: 0 };
      return {
        entries: result.entries.map(entry => this.addAccessors(entry)),
        total: result.total,
      };
    } catch (error) {
      console.error('Error searching unified entries:', error);
      throw error;
    }
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse = await this.ipcRenderer.invoke('unified:delete-entry', { id });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete entry');
      }

      this.trackOperation('delete', response.metadata?.executionTime || 0);
    } catch (error) {
      console.error('Error deleting unified entry:', error);
      this.trackError('delete', error as Error);
      throw error;
    }
  }

  /**
   * Archive an entry
   */
  async archiveEntry(id: string): Promise<UnifiedEntryWithAccessors> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<UnifiedEntry> = await this.ipcRenderer.invoke(
        'unified:archive-entry',
        { id }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to archive entry');
      }

      if (!response.data) {
        throw new Error('No data returned from archive operation');
      }

      this.trackOperation('archive', response.metadata?.executionTime || 0);
      return this.addAccessors(response.data);
    } catch (error) {
      console.error('Error archiving unified entry:', error);
      this.trackError('archive', error as Error);
      throw error;
    }
  }

  // ===========================
  // BACKWARD COMPATIBLE KB METHODS
  // ===========================

  /**
   * Create KB entry (backward compatible)
   */
  async createKBEntry(entryData: CreateKBEntry): Promise<KBEntry> {
    const unifiedData: CreateUnifiedEntry = {
      ...entryData,
      entry_type: 'knowledge_base',
    };
    const result = await this.createEntry(unifiedData);
    return result.asKBEntry();
  }

  /**
   * Get KB entries only (backward compatible)
   */
  async getKBEntries(options: SearchOptions = {}): Promise<{ entries: KBEntry[]; total: number }> {
    const optionsWithFilter = { ...options, entry_type: 'knowledge_base' as EntryType };
    const result = await this.getEntries(optionsWithFilter);
    return {
      entries: result.entries.filter(entry => entry.isKBEntry()).map(entry => entry.asKBEntry()),
      total: result.total,
    };
  }

  /**
   * Search KB entries only (backward compatible)
   */
  async searchKBEntries(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ entries: KBEntry[]; total: number }> {
    const optionsWithFilter = { ...options, entry_type: 'knowledge_base' as EntryType };
    const result = await this.searchEntries(query, optionsWithFilter);
    return {
      entries: result.entries.filter(entry => entry.isKBEntry()).map(entry => entry.asKBEntry()),
      total: result.total,
    };
  }

  /**
   * Duplicate KB entry (backward compatible)
   */
  async duplicateKBEntry(entry: KBEntry): Promise<KBEntry> {
    const duplicateData: CreateUnifiedEntry = {
      title: `Copy of ${entry.title}`,
      problem: entry.problem,
      solution: entry.solution,
      category: entry.category,
      tags: [...(entry.tags || [])],
      created_by: 'current-user',
      entry_type: 'knowledge_base',
    };

    const result = await this.createEntry(duplicateData);
    return result.asKBEntry();
  }

  // ===========================
  // BACKWARD COMPATIBLE INCIDENT METHODS
  // ===========================

  /**
   * Create incident (backward compatible)
   */
  async createIncident(
    kbEntryData: any,
    priority: string,
    assignedTo?: string,
    reporter?: string
  ): Promise<string> {
    const incidentData: CreateUnifiedEntry = {
      ...kbEntryData,
      entry_type: 'incident',
      status: 'aberto' as IncidentStatus,
      priority: priority as IncidentPriority,
      assigned_to: assignedTo,
      reporter,
    };

    const result = await this.createEntry(incidentData);
    return result.id;
  }

  /**
   * Get incidents with filtering and pagination (backward compatible)
   */
  async getIncidents(
    filters?: IncidentFilter,
    sort?: IncidentSort,
    page = 1,
    pageSize = 50
  ): Promise<IncidentListResponse> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const result = await this.ipcRenderer.invoke('incident:list', {
        filters,
        sort,
        page,
        pageSize,
      });
      return result;
    } catch (error) {
      console.error('Error fetching incidents:', error);
      throw error;
    }
  }

  /**
   * Get incident by ID (backward compatible)
   */
  async getIncident(id: string): Promise<IncidentKBEntry> {
    const entry = await this.getEntry(id);
    if (!entry.isIncidentEntry()) {
      throw new Error('Entry is not an incident');
    }
    return entry.asIncidentEntry();
  }

  /**
   * Update incident status (backward compatible)
   */
  async updateIncidentStatus(
    incidentId: string,
    newStatus: string,
    reason?: string,
    changedBy?: string
  ): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      await this.ipcRenderer.invoke('incident:updateStatus', {
        incidentId,
        newStatus,
        reason,
        changedBy,
      });
    } catch (error) {
      console.error('Error updating incident status:', error);
      throw error;
    }
  }

  /**
   * Assign incident to user (backward compatible)
   */
  async assignIncident(incidentId: string, assignedTo: string, assignedBy?: string): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      await this.ipcRenderer.invoke('incident:assign', {
        incidentId,
        assignedTo,
        assignedBy,
      });
    } catch (error) {
      console.error('Error assigning incident:', error);
      throw error;
    }
  }

  /**
   * Search incidents only (backward compatible)
   */
  async searchIncidents(
    query: string,
    filters?: IncidentFilter,
    sort?: IncidentSort
  ): Promise<IncidentKBEntry[]> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const result = await this.ipcRenderer.invoke('incident:search', {
        query,
        filters,
        sort,
      });
      return result;
    } catch (error) {
      console.error('Error searching incidents:', error);
      throw error;
    }
  }

  // ===========================
  // SHARED OPERATIONS
  // ===========================

  /**
   * Get unified statistics
   */
  async getStatistics(): Promise<UnifiedStatistics> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<UnifiedStatistics> =
        await this.ipcRenderer.invoke('unified:get-statistics');

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get statistics');
      }

      return (
        response.data || {
          totalEntries: 0,
          kbEntries: 0,
          incidentEntries: 0,
          categoryCounts: {},
          recentActivity: 0,
          searchesToday: 0,
          averageSuccessRate: 0,
          topEntries: [],
        }
      );
    } catch (error) {
      console.error('Error getting unified statistics:', error);
      throw error;
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    try {
      if (!this.ipcRenderer) {
        // Return mock categories for web mode
        return [
          { name: 'JCL', count: 45 },
          { name: 'COBOL', count: 38 },
          { name: 'DB2', count: 52 },
          { name: 'VSAM', count: 23 },
          { name: 'CICS', count: 31 },
          { name: 'IMS', count: 19 },
          { name: 'Other', count: 27 },
        ];
      }

      const response: IPCResponse<Array<{ name: string; count: number }>> =
        await this.ipcRenderer.invoke('unified:get-categories');

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get categories');
      }

      return response.data || [];
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Get popular tags
   */
  async getTags(limit?: number): Promise<Array<{ name: string; count: number }>> {
    try {
      if (!this.ipcRenderer) {
        // Return mock tags for web mode
        return [
          { name: 'abend', count: 15 },
          { name: 'error-code', count: 12 },
          { name: 'batch-job', count: 8 },
          { name: 'sql-error', count: 10 },
          { name: 'performance', count: 6 },
        ];
      }

      const response: IPCResponse<Array<{ name: string; count: number }>> =
        await this.ipcRenderer.invoke('unified:get-tags', { limit });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get tags');
      }

      return response.data || [];
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  }

  /**
   * Record feedback for an entry
   */
  async recordFeedback(
    entryId: string,
    feedback: { rating: number; successful: boolean; comment?: string }
  ): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        return; // Silently fail in web mode
      }

      const response: IPCResponse = await this.ipcRenderer.invoke('unified:record-feedback', {
        entryId,
        feedback,
      });

      if (!response.success) {
        console.warn('Failed to record feedback:', response.error?.message);
      }
    } catch (error) {
      console.error('Error recording feedback:', error);
    }
  }

  /**
   * Record usage metric for an entry
   */
  async recordUsage(entryId: string, action: string, metadata?: any): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        return; // Silently fail in web mode
      }

      const response: IPCResponse = await this.ipcRenderer.invoke('unified:record-usage', {
        entryId,
        action,
        metadata,
      });

      if (!response.success) {
        console.warn('Failed to record usage:', response.error?.message);
      }
    } catch (error) {
      console.error('Error recording usage:', error);
    }
  }

  // ===========================
  // INCIDENT SPECIFIC OPERATIONS (passthrough)
  // ===========================

  /**
   * Perform bulk operations on multiple incidents
   */
  async bulkOperation(operation: BulkOperation): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      await this.ipcRenderer.invoke('incident:bulkOperation', operation);
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      throw error;
    }
  }

  /**
   * Add comment to incident
   */
  async addComment(
    incidentId: string,
    content: string,
    author: string,
    isInternal = false,
    attachments?: string[]
  ): Promise<string> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const result = await this.ipcRenderer.invoke('incident:addComment', {
        incidentId,
        content,
        author,
        isInternal,
        attachments,
      });
      return result.id;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Get incident comments
   */
  async getComments(incidentId: string): Promise<IncidentComment[]> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const result = await this.ipcRenderer.invoke('incident:getComments', {
        incidentId,
      });
      return result;
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }

  /**
   * Get incident status history
   */
  async getStatusHistory(incidentId: string): Promise<StatusTransition[]> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const result = await this.ipcRenderer.invoke('incident:getStatusHistory', {
        incidentId,
      });
      return result;
    } catch (error) {
      console.error('Error fetching status history:', error);
      throw error;
    }
  }

  /**
   * Get incident metrics and dashboard data
   */
  async getMetrics(timeframe = '24h'): Promise<IncidentMetrics> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const result = await this.ipcRenderer.invoke('incident:getMetrics', {
        timeframe,
      });
      return result;
    } catch (error) {
      console.error('Error fetching incident metrics:', error);
      throw error;
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  /**
   * Validate status transition for incidents
   */
  isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      aberto: ['em_tratamento', 'resolvido', 'fechado'],
      em_tratamento: ['em_revisao', 'resolvido', 'aberto'],
      em_revisao: ['resolvido', 'em_tratamento'],
      resolvido: ['fechado', 'reaberto'],
      fechado: ['reaberto'],
      reaberto: ['em_tratamento', 'resolvido'],
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  /**
   * Calculate SLA deadline based on priority
   */
  calculateSLADeadline(priority: string, createdAt: Date): Date {
    const slaMinutes = {
      P1: 60, // 1 hour
      P2: 240, // 4 hours
      P3: 480, // 8 hours
      P4: 1440, // 24 hours
    };

    const minutes = slaMinutes[priority as keyof typeof slaMinutes] || 480;
    return new Date(createdAt.getTime() + minutes * 60 * 1000);
  }

  /**
   * Get priority info with label and color
   */
  getPriorityInfo(priority: string) {
    const priorityMap = {
      P1: { label: 'Critical', color: '#ef4444' },
      P2: { label: 'High', color: '#f97316' },
      P3: { label: 'Medium', color: '#eab308' },
      P4: { label: 'Low', color: '#22c55e' },
    };

    return priorityMap[priority as keyof typeof priorityMap] || priorityMap['P3'];
  }

  /**
   * Get status info with label and color
   */
  getStatusInfo(status: string) {
    const statusMap = {
      aberto: { label: 'Aberto', color: '#6b7280' },
      em_tratamento: { label: 'Em Tratamento', color: '#f59e0b' },
      em_revisao: { label: 'Em Revisão', color: '#8b5cf6' },
      resolvido: { label: 'Resolvido', color: '#10b981' },
      fechado: { label: 'Fechado', color: '#6b7280' },
      reaberto: { label: 'Reaberto', color: '#ef4444' },
    };

    return statusMap[status as keyof typeof statusMap] || statusMap['aberto'];
  }

  // ===========================
  // ANALYTICS METHODS
  // ===========================

  /**
   * Track operation for analytics
   */
  private trackOperation(operation: string, executionTime: number): void {
    try {
      if (this.ipcRenderer) {
        this.ipcRenderer.invoke('analytics:track-operation', {
          operation: `unified:${operation}`,
          executionTime,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('Failed to track operation:', error);
    }
  }

  /**
   * Track error for analytics
   */
  private trackError(operation: string, error: Error): void {
    try {
      if (this.ipcRenderer) {
        this.ipcRenderer.invoke('analytics:track-error', {
          operation: `unified:${operation}`,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Failed to track error:', err);
    }
  }
}

// Export singleton instance and backward compatible instances
export const unifiedService = UnifiedService.getInstance();

// Create backward compatible service instances that delegate to the unified service
export const knowledgeBaseService = {
  getInstance: () => unifiedService,
  createEntry: (entryData: CreateKBEntry) => unifiedService.createKBEntry(entryData),
  updateEntry: (id: string, updateData: UpdateKBEntry) =>
    unifiedService.updateEntry(id, updateData),
  deleteEntry: (id: string) => unifiedService.deleteEntry(id),
  archiveEntry: (id: string) => unifiedService.archiveEntry(id),
  duplicateEntry: (entry: KBEntry) => unifiedService.duplicateKBEntry(entry),
  getEntry: (id: string) => unifiedService.getEntry(id).then(e => e.asKBEntry()),
  getEntries: (options?: SearchOptions) => unifiedService.getKBEntries(options),
  searchEntries: (query: string, options?: SearchOptions) =>
    unifiedService.searchKBEntries(query, options),
  getStatistics: () => unifiedService.getStatistics(),
  getCategories: () => unifiedService.getCategories(),
  getTags: (limit?: number) => unifiedService.getTags(limit),
  recordFeedback: (entryId: string, feedback: any) =>
    unifiedService.recordFeedback(entryId, feedback),
  recordUsage: (entryId: string, action: string, metadata?: any) =>
    unifiedService.recordUsage(entryId, action, metadata),
};

export const incidentService = {
  getInstance: () => unifiedService,
  getIncidents: (filters?: IncidentFilter, sort?: IncidentSort, page?: number, pageSize?: number) =>
    unifiedService.getIncidents(filters, sort, page, pageSize),
  getIncident: (id: string) => unifiedService.getIncident(id),
  updateStatus: (incidentId: string, newStatus: string, reason?: string, changedBy?: string) =>
    unifiedService.updateIncidentStatus(incidentId, newStatus, reason, changedBy),
  assignIncident: (incidentId: string, assignedTo: string, assignedBy?: string) =>
    unifiedService.assignIncident(incidentId, assignedTo, assignedBy),
  searchIncidents: (query: string, filters?: IncidentFilter, sort?: IncidentSort) =>
    unifiedService.searchIncidents(query, filters, sort),
  createIncident: (kbEntryData: any, priority: string, assignedTo?: string, reporter?: string) =>
    unifiedService.createIncident(kbEntryData, priority, assignedTo, reporter),
  bulkOperation: (operation: BulkOperation) => unifiedService.bulkOperation(operation),
  addComment: (
    incidentId: string,
    content: string,
    author: string,
    isInternal?: boolean,
    attachments?: string[]
  ) => unifiedService.addComment(incidentId, content, author, isInternal, attachments),
  getComments: (incidentId: string) => unifiedService.getComments(incidentId),
  getStatusHistory: (incidentId: string) => unifiedService.getStatusHistory(incidentId),
  getMetrics: (timeframe?: string) => unifiedService.getMetrics(timeframe),
  isValidStatusTransition: (fromStatus: string, toStatus: string) =>
    unifiedService.isValidStatusTransition(fromStatus, toStatus),
  calculateSLADeadline: (priority: string, createdAt: Date) =>
    unifiedService.calculateSLADeadline(priority, createdAt),
  getPriorityInfo: (priority: string) => unifiedService.getPriorityInfo(priority),
  getStatusInfo: (status: string) => unifiedService.getStatusInfo(status),
};

// Export types
export type {
  UnifiedEntry,
  CreateUnifiedEntry,
  UpdateUnifiedEntry,
  UnifiedEntryWithAccessors,
  EntryType,
  UnifiedStatistics,
};

export default unifiedService;
