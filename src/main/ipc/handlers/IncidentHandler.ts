/**
 * Incident Handler
 * Main process IPC handlers for incident management operations
 */

import { ipcMain } from 'electron';
import { Database } from 'better-sqlite3';
import {
  IncidentKBEntry,
  IncidentFilter,
  IncidentSort,
  BulkOperation,
  StatusTransition,
  IncidentComment,
  IncidentMetrics,
} from '../../../types/incident';

export class IncidentHandler {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
    this.registerHandlers();
  }

  private registerHandlers() {
    // List incidents with filtering and pagination
    ipcMain.handle('incident:list', async (event, params) => {
      try {
        const { filters, sort, page = 1, pageSize = 50 } = params;
        return await this.getIncidents(filters, sort, page, pageSize);
      } catch (error) {
        console.error('Error in incident:list:', error);
        throw error;
      }
    });

    // Get single incident
    ipcMain.handle('incident:get', async (event, { id }) => {
      try {
        return await this.getIncident(id);
      } catch (error) {
        console.error('Error in incident:get:', error);
        throw error;
      }
    });

    // Update incident status
    ipcMain.handle('incident:updateStatus', async (event, params) => {
      try {
        const { incidentId, newStatus, reason, changedBy } = params;
        return await this.updateStatus(incidentId, newStatus, reason, changedBy);
      } catch (error) {
        console.error('Error in incident:updateStatus:', error);
        throw error;
      }
    });

    // Assign incident
    ipcMain.handle('incident:assign', async (event, params) => {
      try {
        const { incidentId, assignedTo, assignedBy } = params;
        return await this.assignIncident(incidentId, assignedTo, assignedBy);
      } catch (error) {
        console.error('Error in incident:assign:', error);
        throw error;
      }
    });

    // Update priority
    ipcMain.handle('incident:updatePriority', async (event, params) => {
      try {
        const { incidentId, priority, changedBy, reason } = params;
        return await this.updatePriority(incidentId, priority, changedBy, reason);
      } catch (error) {
        console.error('Error in incident:updatePriority:', error);
        throw error;
      }
    });

    // Bulk operations
    ipcMain.handle('incident:bulkOperation', async (event, operation) => {
      try {
        return await this.performBulkOperation(operation);
      } catch (error) {
        console.error('Error in incident:bulkOperation:', error);
        throw error;
      }
    });

    // Add comment
    ipcMain.handle('incident:addComment', async (event, params) => {
      try {
        const { incidentId, content, author, isInternal, attachments } = params;
        return await this.addComment(incidentId, content, author, isInternal, attachments);
      } catch (error) {
        console.error('Error in incident:addComment:', error);
        throw error;
      }
    });

    // Get comments
    ipcMain.handle('incident:getComments', async (event, { incidentId }) => {
      try {
        return await this.getComments(incidentId);
      } catch (error) {
        console.error('Error in incident:getComments:', error);
        throw error;
      }
    });

    // Get status history
    ipcMain.handle('incident:getStatusHistory', async (event, { incidentId }) => {
      try {
        return await this.getStatusHistory(incidentId);
      } catch (error) {
        console.error('Error in incident:getStatusHistory:', error);
        throw error;
      }
    });

    // Get metrics
    ipcMain.handle('incident:getMetrics', async (event, { timeframe }) => {
      try {
        return await this.getMetrics(timeframe);
      } catch (error) {
        console.error('Error in incident:getMetrics:', error);
        throw error;
      }
    });

    // Escalate incident
    ipcMain.handle('incident:escalate', async (event, params) => {
      try {
        const { incidentId, escalationLevel, reason, escalatedBy } = params;
        return await this.escalateIncident(incidentId, escalationLevel, reason, escalatedBy);
      } catch (error) {
        console.error('Error in incident:escalate:', error);
        throw error;
      }
    });

    // Resolve incident
    ipcMain.handle('incident:resolve', async (event, params) => {
      try {
        const { incidentId, resolvedBy, resolutionNotes } = params;
        return await this.resolveIncident(incidentId, resolvedBy, resolutionNotes);
      } catch (error) {
        console.error('Error in incident:resolve:', error);
        throw error;
      }
    });

    // Create incident
    ipcMain.handle('incident:create', async (event, incidentData) => {
      try {
        return await this.createIncident(incidentData);
      } catch (error) {
        console.error('Error in incident:create:', error);
        throw error;
      }
    });

    // Update incident with audit trail
    ipcMain.handle('incident:update', async (event, params) => {
      try {
        const { incidentId, changes, auditInfo } = params;
        return await this.updateIncident(incidentId, changes, auditInfo);
      } catch (error) {
        console.error('Error in incident:update:', error);
        throw error;
      }
    });

    // Search incidents
    ipcMain.handle('incident:search', async (event, params) => {
      try {
        const { query, filters, sort } = params;
        return await this.searchIncidents(query, filters, sort);
      } catch (error) {
        console.error('Error in incident:search:', error);
        throw error;
      }
    });

    // Get SLA breaches
    ipcMain.handle('incident:getSLABreaches', async event => {
      try {
        return await this.getSLABreaches();
      } catch (error) {
        console.error('Error in incident:getSLABreaches:', error);
        throw error;
      }
    });

    // Update SLA
    ipcMain.handle('incident:updateSLA', async (event, params) => {
      try {
        const { incidentId, newDeadline, reason, updatedBy } = params;
        return await this.updateSLADeadline(incidentId, newDeadline, reason, updatedBy);
      } catch (error) {
        console.error('Error in incident:updateSLA:', error);
        throw error;
      }
    });

    // Get trends
    ipcMain.handle('incident:getTrends', async (event, { timeframe }) => {
      try {
        return await this.getTrends(timeframe);
      } catch (error) {
        console.error('Error in incident:getTrends:', error);
        throw error;
      }
    });
  }

  private async getIncidents(
    filters?: IncidentFilter,
    sort?: IncidentSort,
    page = 1,
    pageSize = 50
  ) {
    let query = `
      SELECT * FROM incident_queue
      WHERE 1=1
    `;
    const params: any[] = [];

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      query += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    }

    if (filters?.priority && filters.priority.length > 0) {
      query += ` AND priority IN (${filters.priority.map(() => '?').join(',')})`;
      params.push(...filters.priority);
    }

    if (filters?.assigned_to && filters.assigned_to.length > 0) {
      query += ` AND assigned_to IN (${filters.assigned_to.map(() => '?').join(',')})`;
      params.push(...filters.assigned_to);
    }

    if (filters?.category && filters.category.length > 0) {
      query += ` AND category IN (${filters.category.map(() => '?').join(',')})`;
      params.push(...filters.category);
    }

    if (filters?.sla_status) {
      if (filters.sla_status === 'breached') {
        query += ` AND sla_deadline < datetime('now') AND status NOT IN ('resolvido', 'fechado')`;
      } else if (filters.sla_status === 'at_risk') {
        query += ` AND sla_deadline BETWEEN datetime('now') AND datetime('now', '+20% of sla_deadline')`;
      } else if (filters.sla_status === 'on_time') {
        query += ` AND sla_deadline > datetime('now', '+20% of sla_deadline')`;
      }
    }

    if (filters?.date_range) {
      if (filters.date_range.from) {
        query += ` AND created_at >= ?`;
        params.push(filters.date_range.from.toISOString());
      }
      if (filters.date_range.to) {
        query += ` AND created_at <= ?`;
        params.push(filters.date_range.to.toISOString());
      }
    }

    // Apply sorting
    if (sort) {
      query += ` ORDER BY ${sort.field} ${sort.direction.toUpperCase()}`;
    } else {
      query += ` ORDER BY priority_order, created_at DESC`;
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const incidents = this.db.prepare(query).all(params);

    // Get total count for pagination
    const countQuery = query
      .replace(/SELECT \* FROM/, 'SELECT COUNT(*) as total FROM')
      .replace(/ORDER BY.*$/, '')
      .replace(/LIMIT.*$/, '');
    const countParams = params.slice(0, -2); // Remove limit and offset
    const totalResult = this.db.prepare(countQuery).get(countParams) as any;
    const totalCount = totalResult.total;

    return {
      incidents: incidents.map(this.transformIncident),
      total_count: totalCount,
      page,
      page_size: pageSize,
      has_more: offset + pageSize < totalCount,
      filters_applied: filters || {},
    };
  }

  private async getIncident(id: string): Promise<IncidentKBEntry> {
    const query = `SELECT * FROM incident_queue WHERE id = ?`;
    const incident = this.db.prepare(query).get(id);

    if (!incident) {
      throw new Error(`Incident with id ${id} not found`);
    }

    return this.transformIncident(incident);
  }

  private async updateStatus(
    incidentId: string,
    newStatus: string,
    reason?: string,
    changedBy?: string
  ): Promise<void> {
    const updateQuery = `
      UPDATE kb_entries 
      SET status = ?, updated_at = CURRENT_TIMESTAMP,
          resolver = CASE WHEN ? = 'resolvido' THEN ? ELSE resolver END
      WHERE id = ?
    `;

    const result = this.db
      .prepare(updateQuery)
      .run(newStatus, newStatus, changedBy || 'system', incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Add manual transition record if reason provided
    if (reason) {
      const transitionQuery = `
        INSERT INTO incident_status_transitions (
          incident_id, from_status, to_status, changed_by, change_reason
        ) VALUES (
          ?, 
          (SELECT status FROM kb_entries WHERE id = ? LIMIT 1),
          ?, ?, ?
        )
      `;

      this.db
        .prepare(transitionQuery)
        .run(incidentId, incidentId, newStatus, changedBy || 'system', reason);
    }
  }

  private async assignIncident(
    incidentId: string,
    assignedTo: string,
    assignedBy?: string
  ): Promise<void> {
    const query = `
      UPDATE kb_entries 
      SET assigned_to = ?, 
          status = CASE WHEN status = 'aberto' THEN 'em_tratamento' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = this.db.prepare(query).run(assignedTo, incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Log assignment as comment
    await this.addComment(
      incidentId,
      `Incident assigned to ${assignedTo}`,
      assignedBy || 'system',
      true
    );
  }

  private async updatePriority(
    incidentId: string,
    priority: string,
    changedBy?: string,
    reason?: string
  ): Promise<void> {
    const query = `
      UPDATE kb_entries 
      SET priority = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = this.db.prepare(query).run(priority, incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Log priority change as comment
    await this.addComment(
      incidentId,
      `Priority changed to ${priority}${reason ? `: ${reason}` : ''}`,
      changedBy || 'system',
      true
    );
  }

  private async performBulkOperation(operation: BulkOperation): Promise<void> {
    const { action, target_value, incident_ids, performed_by, reason } = operation;

    switch (action) {
      case 'assign':
        for (const id of incident_ids) {
          await this.assignIncident(id, target_value, performed_by);
        }
        break;

      case 'change_status':
        for (const id of incident_ids) {
          await this.updateStatus(id, target_value, reason, performed_by);
        }
        break;

      case 'change_priority':
        for (const id of incident_ids) {
          await this.updatePriority(id, target_value, performed_by, reason);
        }
        break;

      case 'add_comment':
        for (const id of incident_ids) {
          await this.addComment(id, target_value, performed_by, false);
        }
        break;

      case 'escalate':
        for (const id of incident_ids) {
          await this.escalateIncident(id, target_value, reason || 'Bulk escalation', performed_by);
        }
        break;

      default:
        throw new Error(`Unsupported bulk action: ${action}`);
    }
  }

  private async addComment(
    incidentId: string,
    content: string,
    author: string,
    isInternal = false,
    attachments?: string[]
  ): Promise<{ id: string }> {
    const id = this.generateId();
    const query = `
      INSERT INTO incident_comments (
        id, incident_id, author, content, is_internal, attachments
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    this.db
      .prepare(query)
      .run(
        id,
        incidentId,
        author,
        content,
        isInternal ? 1 : 0,
        attachments ? JSON.stringify(attachments) : null
      );

    return { id };
  }

  private async getComments(incidentId: string): Promise<IncidentComment[]> {
    const query = `
      SELECT * FROM incident_comments 
      WHERE incident_id = ? 
      ORDER BY timestamp DESC
    `;

    const comments = this.db.prepare(query).all(incidentId);
    return comments.map(comment => ({
      ...comment,
      is_internal: Boolean(comment.is_internal),
      attachments: comment.attachments ? JSON.parse(comment.attachments) : undefined,
      timestamp: new Date(comment.timestamp),
    }));
  }

  private async getStatusHistory(incidentId: string): Promise<StatusTransition[]> {
    const query = `
      SELECT * FROM incident_status_transitions 
      WHERE incident_id = ? 
      ORDER BY timestamp DESC
    `;

    const transitions = this.db.prepare(query).all(incidentId);
    return transitions.map(transition => ({
      ...transition,
      timestamp: new Date(transition.timestamp),
      metadata: transition.metadata ? JSON.parse(transition.metadata) : undefined,
    }));
  }

  private async getMetrics(timeframe = '24h'): Promise<IncidentMetrics> {
    const metricsQuery = `SELECT * FROM incident_metrics`;
    const metrics = this.db.prepare(metricsQuery).get() as any;

    const recentQuery = `
      SELECT * FROM incident_queue 
      WHERE created_at >= datetime('now', '-${timeframe}')
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const recentIncidents = this.db.prepare(recentQuery).all();

    return {
      total_open: metrics.total_open || 0,
      total_assigned: 0, // Merged into em_tratamento
      total_in_progress: metrics.total_in_progress || 0,
      total_resolved_today: metrics.total_resolved_today || 0,
      avg_resolution_time: metrics.avg_resolution_time || 0,
      sla_breaches: metrics.sla_breaches || 0,
      priority_distribution: {
        P1: metrics.p1_count || 0,
        P2: metrics.p2_count || 0,
        P3: metrics.p3_count || 0,
        P4: metrics.p4_count || 0,
      },
      status_distribution: {
        aberto: metrics.total_open || 0,
        em_tratamento: (metrics.total_assigned || 0) + (metrics.total_in_progress || 0),
        em_revisao: 0, // TODO: Add to view
        resolvido: metrics.total_resolved_today || 0,
        fechado: 0, // TODO: Add to view
        reaberto: 0, // TODO: Add to view
      },
      recent_incidents: recentIncidents.map(this.transformIncident),
    };
  }

  private async escalateIncident(
    incidentId: string,
    escalationLevel: string,
    reason: string,
    escalatedBy: string
  ): Promise<void> {
    const query = `
      UPDATE kb_entries 
      SET escalation_level = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = this.db.prepare(query).run(escalationLevel, incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Log escalation
    await this.addComment(
      incidentId,
      `Incident escalated to ${escalationLevel}: ${reason}`,
      escalatedBy,
      true
    );
  }

  private async resolveIncident(
    incidentId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<void> {
    // Calculate resolution time
    const incidentQuery = `SELECT created_at FROM kb_entries WHERE id = ?`;
    const incident = this.db.prepare(incidentQuery).get(incidentId) as any;

    if (!incident) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    const resolutionTime = Math.floor(
      (Date.now() - new Date(incident.created_at).getTime()) / (1000 * 60)
    );

    const updateQuery = `
      UPDATE kb_entries 
      SET status = 'resolvido', 
          resolver = ?, 
          resolution_time = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    this.db.prepare(updateQuery).run(resolvedBy, resolutionTime, incidentId);

    // Add resolution comment
    if (resolutionNotes) {
      await this.addComment(incidentId, `Resolution: ${resolutionNotes}`, resolvedBy, false);
    }
  }

  private async createIncident(incidentData: any): Promise<{ id: string }> {
    const id = this.generateId();
    const incidentNumber = this.generateIncidentNumber();

    const query = `
      INSERT INTO kb_entries (
        id, title, problem, solution, category, tags, 
        priority, status, assigned_to, reporter, incident_number,
        business_impact, customer_impact, escalation_level,
        sla_deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const slaDeadline = this.calculateSLADeadline(incidentData.priority);

    this.db
      .prepare(query)
      .run(
        id,
        incidentData.title,
        incidentData.problem,
        incidentData.solution || '',
        incidentData.category,
        JSON.stringify(incidentData.tags || []),
        incidentData.priority,
        incidentData.status || 'aberto',
        incidentData.assignedTo,
        incidentData.reporter,
        incidentNumber,
        incidentData.business_impact || 'medium',
        incidentData.customer_impact ? 1 : 0,
        'none',
        slaDeadline.toISOString(),
        incidentData.created_by || 'system'
      );

    return { id };
  }

  private async updateIncident(
    incidentId: string,
    changes: any,
    auditInfo: any
  ): Promise<{ success: boolean; auditId: string }> {
    // Start transaction for atomic updates
    const transaction = this.db.transaction(() => {
      // Build dynamic update query based on changed fields
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      // Map changes to database fields
      const fieldMapping: Record<string, string> = {
        title: 'title',
        description: 'problem',
        impact: 'business_impact',
        category: 'category',
        priority: 'priority',
        status: 'status',
        affected_system: 'affected_systems',
        assigned_to: 'assigned_to',
        reported_by: 'reporter',
        incident_date: 'created_at',
        tags: 'tags',
        resolution_notes: 'solution',
      };

      // Process each change
      Object.keys(changes).forEach(field => {
        const dbField = fieldMapping[field];
        if (dbField) {
          updateFields.push(`${dbField} = ?`);

          // Handle special fields
          if (field === 'tags') {
            updateValues.push(JSON.stringify(changes[field]));
          } else if (field === 'affected_system' && Array.isArray(changes[field])) {
            updateValues.push(JSON.stringify(changes[field]));
          } else {
            updateValues.push(changes[field]);
          }
        }
      });

      // Always update the updated_at timestamp
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Update the main incident record
      const updateQuery = `
        UPDATE kb_entries
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      updateValues.push(incidentId);
      const result = this.db.prepare(updateQuery).run(...updateValues);

      if (result.changes === 0) {
        throw new Error(`Incident with id ${incidentId} not found`);
      }

      // Create audit trail record
      const auditId = this.generateId();
      const auditQuery = `
        INSERT INTO incident_audit_trail (
          id, incident_id, changed_fields, change_reason, changed_by,
          previous_values, new_values, timestamp, requires_approval, critical_change
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db
        .prepare(auditQuery)
        .run(
          auditId,
          incidentId,
          JSON.stringify(auditInfo.changedFields),
          auditInfo.changeReason,
          auditInfo.changedBy,
          JSON.stringify(auditInfo.previousValues),
          JSON.stringify(auditInfo.newValues),
          auditInfo.timestamp.toISOString(),
          auditInfo.requiresApproval ? 1 : 0,
          auditInfo.criticalChange ? 1 : 0
        );

      // Add status transition record if status changed
      if (changes.status && auditInfo.previousValues.status !== changes.status) {
        const transitionQuery = `
          INSERT INTO incident_status_transitions (
            incident_id, from_status, to_status, changed_by, change_reason, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        this.db
          .prepare(transitionQuery)
          .run(
            incidentId,
            auditInfo.previousValues.status,
            changes.status,
            auditInfo.changedBy,
            auditInfo.changeReason,
            auditInfo.timestamp.toISOString()
          );
      }

      // Add system comment documenting the change
      const changeDescription = auditInfo.changedFields
        .map((field: string) => {
          const oldVal = auditInfo.previousValues[field];
          const newVal = auditInfo.newValues[field];
          const fieldName =
            field === 'title'
              ? 'Título'
              : field === 'description'
                ? 'Descrição'
                : field === 'priority'
                  ? 'Prioridade'
                  : field === 'status'
                    ? 'Status'
                    : field === 'category'
                      ? 'Categoria'
                      : field === 'assigned_to'
                        ? 'Responsável'
                        : field;

          return `${fieldName}: "${oldVal}" → "${newVal}"`;
        })
        .join('; ');

      const commentContent = `Incidente atualizado: ${changeDescription}. Motivo: ${auditInfo.changeReason}`;

      const commentId = this.generateId();
      const commentQuery = `
        INSERT INTO incident_comments (
          id, incident_id, author, content, is_internal, comment_type
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.prepare(commentQuery).run(
        commentId,
        incidentId,
        auditInfo.changedBy,
        commentContent,
        1, // Internal comment
        'system_update'
      );

      // Update SLA deadline if priority changed
      if (changes.priority && auditInfo.previousValues.priority !== changes.priority) {
        const newSlaDeadline = this.calculateSLADeadline(changes.priority);
        const slaUpdateQuery = `
          UPDATE kb_entries
          SET sla_deadline = ?
          WHERE id = ?
        `;

        this.db.prepare(slaUpdateQuery).run(newSlaDeadline.toISOString(), incidentId);
      }

      return { success: true, auditId };
    });

    // Execute transaction
    return transaction();
  }

  private async searchIncidents(
    query: string,
    filters?: IncidentFilter,
    sort?: IncidentSort
  ): Promise<IncidentKBEntry[]> {
    let searchQuery = `
      SELECT * FROM incident_queue 
      WHERE (title LIKE ? OR problem LIKE ? OR incident_number LIKE ?)
    `;

    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    // Apply additional filters (reuse logic from getIncidents)
    // ... (similar filter logic)

    if (sort) {
      searchQuery += ` ORDER BY ${sort.field} ${sort.direction.toUpperCase()}`;
    }

    searchQuery += ` LIMIT 100`; // Reasonable limit for search

    const results = this.db.prepare(searchQuery).all(params);
    return results.map(this.transformIncident);
  }

  private async getSLABreaches(): Promise<IncidentKBEntry[]> {
    const query = `
      SELECT * FROM incident_queue
      WHERE sla_deadline < datetime('now')
        AND status NOT IN ('resolvido', 'fechado')
      ORDER BY sla_deadline ASC
    `;

    const results = this.db.prepare(query).all();
    return results.map(this.transformIncident);
  }

  private async updateSLADeadline(
    incidentId: string,
    newDeadline: string,
    reason: string,
    updatedBy: string
  ): Promise<void> {
    const query = `
      UPDATE kb_entries 
      SET sla_deadline = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = this.db.prepare(query).run(newDeadline, incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Log SLA change
    await this.addComment(incidentId, `SLA deadline updated: ${reason}`, updatedBy, true);
  }

  private async getTrends(timeframe: string): Promise<any> {
    // Implement trend analysis queries
    // This would include time-series data for charts
    return {
      resolution_time_trend: [],
      volume_trend: [],
      sla_compliance_trend: [],
    };
  }

  private transformIncident(row: any): IncidentKBEntry {
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_status_change: row.last_status_change ? new Date(row.last_status_change) : undefined,
      sla_deadline: row.sla_deadline ? new Date(row.sla_deadline) : undefined,
      customer_impact: Boolean(row.customer_impact),
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateIncidentNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `INC-${year}-${timestamp}`;
  }

  private calculateSLADeadline(priority: string): Date {
    const slaMinutes = {
      P1: 60, // 1 hour
      P2: 240, // 4 hours
      P3: 480, // 8 hours
      P4: 1440, // 24 hours
    };

    const minutes = slaMinutes[priority as keyof typeof slaMinutes] || 480;
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}

export default IncidentHandler;
