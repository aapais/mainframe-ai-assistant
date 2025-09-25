/**
 * Knowledge Base Service - IPC Communication Layer
 * Handles all communication between renderer and main process for KB operations
 */

import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
} from '../../backend/core/interfaces/ServiceInterfaces';

// Types for IPC responses
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
}

interface KBStatistics {
  totalEntries: number;
  categoryCounts: Record<string, number>;
  recentActivity: number;
  searchesToday: number;
  averageSuccessRate: number;
  topEntries: Array<{ id: string; title: string; usage: number }>;
}

interface RelatedEntryData {
  searchReferences: number;
  userBookmarks: number;
  linkedEntries: number;
  recentUsage: number;
}

class KnowledgeBaseService {
  private static instance: KnowledgeBaseService;
  private ipcRenderer: any;

  constructor() {
    // Access the Electron IPC renderer
    this.ipcRenderer =
      (window as any).electronAPI || (window as any).require?.('electron')?.ipcRenderer;

    if (!this.ipcRenderer) {
      console.warn('IPC Renderer not available - running in web mode');
    }
  }

  static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  /**
   * Create a new knowledge base entry
   */
  async createEntry(entryData: CreateKBEntry): Promise<KBEntry> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<KBEntry> = await this.ipcRenderer.invoke(
        'kb:create-entry',
        entryData
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create entry');
      }

      if (!response.data) {
        throw new Error('No data returned from create operation');
      }

      // Track the operation for analytics
      this.trackOperation('create', response.metadata?.executionTime || 0);

      return response.data;
    } catch (error) {
      console.error('Error creating KB entry:', error);
      this.trackError('create', error as Error);
      throw error;
    }
  }

  /**
   * Update an existing knowledge base entry
   */
  async updateEntry(id: string, updateData: UpdateKBEntry): Promise<KBEntry> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<KBEntry> = await this.ipcRenderer.invoke('kb:update-entry', {
        id,
        data: updateData,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update entry');
      }

      if (!response.data) {
        throw new Error('No data returned from update operation');
      }

      this.trackOperation('update', response.metadata?.executionTime || 0);

      return response.data;
    } catch (error) {
      console.error('Error updating KB entry:', error);
      this.trackError('update', error as Error);
      throw error;
    }
  }

  /**
   * Delete a knowledge base entry
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse = await this.ipcRenderer.invoke('kb:delete-entry', { id });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete entry');
      }

      this.trackOperation('delete', response.metadata?.executionTime || 0);
    } catch (error) {
      console.error('Error deleting KB entry:', error);
      this.trackError('delete', error as Error);
      throw error;
    }
  }

  /**
   * Archive a knowledge base entry
   */
  async archiveEntry(id: string): Promise<KBEntry> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<KBEntry> = await this.ipcRenderer.invoke('kb:archive-entry', {
        id,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to archive entry');
      }

      if (!response.data) {
        throw new Error('No data returned from archive operation');
      }

      this.trackOperation('archive', response.metadata?.executionTime || 0);

      return response.data;
    } catch (error) {
      console.error('Error archiving KB entry:', error);
      this.trackError('archive', error as Error);
      throw error;
    }
  }

  /**
   * Duplicate a knowledge base entry
   */
  async duplicateEntry(entry: KBEntry): Promise<KBEntry> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      // Create a new entry based on the existing one
      const duplicateData: CreateKBEntry = {
        title: `Copy of ${entry.title}`,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category,
        severity: entry.severity,
        tags: [...(entry.tags || [])],
        created_by: 'current-user', // This should come from auth context
      };

      const response: IPCResponse<KBEntry> = await this.ipcRenderer.invoke(
        'kb:create-entry',
        duplicateData
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to duplicate entry');
      }

      if (!response.data) {
        throw new Error('No data returned from duplicate operation');
      }

      this.trackOperation('duplicate', response.metadata?.executionTime || 0);

      return response.data;
    } catch (error) {
      console.error('Error duplicating KB entry:', error);
      this.trackError('duplicate', error as Error);
      throw error;
    }
  }

  /**
   * Get a knowledge base entry by ID
   */
  async getEntry(id: string): Promise<KBEntry> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<KBEntry> = await this.ipcRenderer.invoke('kb:get-entry', { id });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get entry');
      }

      if (!response.data) {
        throw new Error('Entry not found');
      }

      return response.data;
    } catch (error) {
      console.error('Error getting KB entry:', error);
      throw error;
    }
  }

  /**
   * Get all knowledge base entries with optional filtering
   */
  async getEntries(options: SearchOptions = {}): Promise<{ entries: KBEntry[]; total: number }> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<{ entries: KBEntry[]; total: number }> =
        await this.ipcRenderer.invoke('kb:get-entries', options);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get entries');
      }

      return response.data || { entries: [], total: 0 };
    } catch (error) {
      console.error('Error getting KB entries:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base entries
   */
  async searchEntries(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ entries: KBEntry[]; total: number }> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<{ entries: KBEntry[]; total: number }> =
        await this.ipcRenderer.invoke('kb:search-entries', { query, options });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to search entries');
      }

      return response.data || { entries: [], total: 0 };
    } catch (error) {
      console.error('Error searching KB entries:', error);
      throw error;
    }
  }

  /**
   * Get related data for an entry (for impact assessment)
   */
  async getEntryRelatedData(id: string): Promise<RelatedEntryData> {
    try {
      if (!this.ipcRenderer) {
        // Return mock data for web mode
        return {
          searchReferences: Math.floor(Math.random() * 20) + 1,
          userBookmarks: Math.floor(Math.random() * 15),
          linkedEntries: Math.floor(Math.random() * 8),
          recentUsage: Math.floor(Math.random() * 10),
        };
      }

      const response: IPCResponse<RelatedEntryData> = await this.ipcRenderer.invoke(
        'kb:get-entry-related-data',
        { id }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get related data');
      }

      return (
        response.data || {
          searchReferences: 0,
          userBookmarks: 0,
          linkedEntries: 0,
          recentUsage: 0,
        }
      );
    } catch (error) {
      console.error('Error getting entry related data:', error);
      throw error;
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStatistics(): Promise<KBStatistics> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<KBStatistics> =
        await this.ipcRenderer.invoke('kb:get-statistics');

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get statistics');
      }

      return (
        response.data || {
          totalEntries: 0,
          categoryCounts: {},
          recentActivity: 0,
          searchesToday: 0,
          averageSuccessRate: 0,
          topEntries: [],
        }
      );
    } catch (error) {
      console.error('Error getting KB statistics:', error);
      throw error;
    }
  }

  /**
   * Get entry version history
   */
  async getEntryHistory(id: string): Promise<any[]> {
    try {
      if (!this.ipcRenderer) {
        throw new Error('IPC not available');
      }

      const response: IPCResponse<any[]> = await this.ipcRenderer.invoke('kb:get-entry-history', {
        id,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get entry history');
      }

      return response.data || [];
    } catch (error) {
      console.error('Error getting entry history:', error);
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

      const response: IPCResponse = await this.ipcRenderer.invoke('kb:record-feedback', {
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

      const response: IPCResponse = await this.ipcRenderer.invoke('kb:record-usage', {
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
        await this.ipcRenderer.invoke('kb:get-categories');

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
        await this.ipcRenderer.invoke('kb:get-tags', { limit });

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
   * Track operation for analytics
   */
  private trackOperation(operation: string, executionTime: number): void {
    try {
      if (this.ipcRenderer) {
        this.ipcRenderer.invoke('analytics:track-operation', {
          operation: `kb:${operation}`,
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
          operation: `kb:${operation}`,
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

// Export singleton instance
export const knowledgeBaseService = KnowledgeBaseService.getInstance();
export default knowledgeBaseService;
