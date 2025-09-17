/**
 * Incident Service
 * API service for incident management operations
 */

import {
  IncidentKBEntry,
  IncidentFilter,
  IncidentSort,
  BulkOperation,
  StatusTransition,
  IncidentComment,
  IncidentMetrics,
  IncidentListResponse
} from '../../types/incident';

export class IncidentService {
  private static instance: IncidentService;

  static getInstance(): IncidentService {
    if (!IncidentService.instance) {
      IncidentService.instance = new IncidentService();
    }
    return IncidentService.instance;
  }

  /**
   * Get incident list with filtering and pagination
   */
  async getIncidents(
    filters?: IncidentFilter,
    sort?: IncidentSort,
    page = 1,
    pageSize = 50
  ): Promise<IncidentListResponse> {
    try {
      // Call to main process via IPC
      const result = await window.api.invoke('incident:list', {
        filters,
        sort,
        page,
        pageSize
      });
      return result;
    } catch (error) {
      console.error('Error fetching incidents:', error);
      throw error;
    }
  }

  /**
   * Get incident by ID
   */
  async getIncident(id: string): Promise<IncidentKBEntry> {
    try {
      const result = await window.api.invoke('incident:get', { id });
      return result;
    } catch (error) {
      console.error('Error fetching incident:', error);
      throw error;
    }
  }

  /**
   * Update incident status
   */
  async updateStatus(
    incidentId: string, 
    newStatus: string, 
    reason?: string,
    changedBy?: string
  ): Promise<void> {
    try {
      await window.api.invoke('incident:updateStatus', {
        incidentId,
        newStatus,
        reason,
        changedBy
      });
    } catch (error) {
      console.error('Error updating incident status:', error);
      throw error;
    }
  }

  /**
   * Assign incident to user
   */
  async assignIncident(
    incidentId: string, 
    assignedTo: string,
    assignedBy?: string
  ): Promise<void> {
    try {
      await window.api.invoke('incident:assign', {
        incidentId,
        assignedTo,
        assignedBy
      });
    } catch (error) {
      console.error('Error assigning incident:', error);
      throw error;
    }
  }

  /**
   * Update incident priority
   */
  async updatePriority(
    incidentId: string, 
    priority: string,
    changedBy?: string,
    reason?: string
  ): Promise<void> {
    try {
      await window.api.invoke('incident:updatePriority', {
        incidentId,
        priority,
        changedBy,
        reason
      });
    } catch (error) {
      console.error('Error updating incident priority:', error);
      throw error;
    }
  }

  /**
   * Perform bulk operations on multiple incidents
   */
  async bulkOperation(operation: BulkOperation): Promise<void> {
    try {
      await window.api.invoke('incident:bulkOperation', operation);
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
      const result = await window.api.invoke('incident:addComment', {
        incidentId,
        content,
        author,
        isInternal,
        attachments
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
      const result = await window.api.invoke('incident:getComments', {
        incidentId
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
      const result = await window.api.invoke('incident:getStatusHistory', {
        incidentId
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
      const result = await window.api.invoke('incident:getMetrics', {
        timeframe
      });
      return result;
    } catch (error) {
      console.error('Error fetching incident metrics:', error);
      throw error;
    }
  }

  /**
   * Escalate incident
   */
  async escalateIncident(
    incidentId: string,
    escalationLevel: string,
    reason: string,
    escalatedBy: string
  ): Promise<void> {
    try {
      await window.api.invoke('incident:escalate', {
        incidentId,
        escalationLevel,
        reason,
        escalatedBy
      });
    } catch (error) {
      console.error('Error escalating incident:', error);
      throw error;
    }
  }

  /**
   * Mark incident as resolved
   */
  async resolveIncident(
    incidentId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<void> {
    try {
      await window.api.invoke('incident:resolve', {
        incidentId,
        resolvedBy,
        resolutionNotes
      });
    } catch (error) {
      console.error('Error resolving incident:', error);
      throw error;
    }
  }

  /**
   * Create new incident from KB entry
   */
  async createIncident(
    kbEntryData: any,
    priority: string,
    assignedTo?: string,
    reporter?: string
  ): Promise<string> {
    try {
      const result = await window.api.invoke('incident:create', {
        ...kbEntryData,
        priority,
        assignedTo,
        reporter,
        status: 'open'
      });
      return result.id;
    } catch (error) {
      console.error('Error creating incident:', error);
      throw error;
    }
  }

  /**
   * Search incidents with advanced filtering
   */
  async searchIncidents(
    query: string,
    filters?: IncidentFilter,
    sort?: IncidentSort
  ): Promise<IncidentKBEntry[]> {
    try {
      const result = await window.api.invoke('incident:search', {
        query,
        filters,
        sort
      });
      return result;
    } catch (error) {
      console.error('Error searching incidents:', error);
      throw error;
    }
  }

  /**
   * Get SLA breach alerts
   */
  async getSLABreaches(): Promise<IncidentKBEntry[]> {
    try {
      const result = await window.api.invoke('incident:getSLABreaches');
      return result;
    } catch (error) {
      console.error('Error fetching SLA breaches:', error);
      throw error;
    }
  }

  /**
   * Update incident SLA deadline
   */
  async updateSLADeadline(
    incidentId: string,
    newDeadline: Date,
    reason: string,
    updatedBy: string
  ): Promise<void> {
    try {
      await window.api.invoke('incident:updateSLA', {
        incidentId,
        newDeadline: newDeadline.toISOString(),
        reason,
        updatedBy
      });
    } catch (error) {
      console.error('Error updating SLA deadline:', error);
      throw error;
    }
  }

  /**
   * Get incident trends and analytics
   */
  async getTrends(timeframe = '30d'): Promise<any> {
    try {
      const result = await window.api.invoke('incident:getTrends', {
        timeframe
      });
      return result;
    } catch (error) {
      console.error('Error fetching incident trends:', error);
      throw error;
    }
  }

  /**
   * Validate status transition
   */
  isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'open': ['assigned', 'in_progress', 'resolved', 'closed'],
      'assigned': ['in_progress', 'open', 'resolved', 'closed'],
      'in_progress': ['pending_review', 'resolved', 'assigned', 'open'],
      'pending_review': ['resolved', 'in_progress', 'assigned'],
      'resolved': ['closed', 'reopened'],
      'closed': ['reopened'],
      'reopened': ['assigned', 'in_progress', 'resolved']
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  /**
   * Calculate SLA deadline based on priority
   */
  calculateSLADeadline(priority: string, createdAt: Date): Date {
    const slaMinutes = {
      'P1': 60,     // 1 hour
      'P2': 240,    // 4 hours
      'P3': 480,    // 8 hours
      'P4': 1440    // 24 hours
    };

    const minutes = slaMinutes[priority as keyof typeof slaMinutes] || 480;
    return new Date(createdAt.getTime() + (minutes * 60 * 1000));
  }

  /**
   * Get priority label and color
   */
  getPriorityInfo(priority: string) {
    const priorityMap = {
      'P1': { label: 'Critical', color: '#ef4444' },
      'P2': { label: 'High', color: '#f97316' },
      'P3': { label: 'Medium', color: '#eab308' },
      'P4': { label: 'Low', color: '#22c55e' }
    };

    return priorityMap[priority as keyof typeof priorityMap] || priorityMap['P3'];
  }

  /**
   * Get status label and color
   */
  getStatusInfo(status: string) {
    const statusMap = {
      'open': { label: 'Open', color: '#6b7280' },
      'assigned': { label: 'Assigned', color: '#3b82f6' },
      'in_progress': { label: 'In Progress', color: '#f59e0b' },
      'pending_review': { label: 'Pending Review', color: '#8b5cf6' },
      'resolved': { label: 'Resolved', color: '#10b981' },
      'closed': { label: 'Closed', color: '#6b7280' },
      'reopened': { label: 'Reopened', color: '#ef4444' }
    };

    return statusMap[status as keyof typeof statusMap] || statusMap['open'];
  }
}

export default IncidentService.getInstance();
