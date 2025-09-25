/**
 * Unified IPC Handler
 *
 * Combines knowledge base and incident management operations into a unified system
 * while maintaining backward compatibility with existing IPC channels.
 *
 * This handler works with the unified 'entries' table structure where both
 * KB entries and incidents are stored with an entry_type discriminator.
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

interface UnifiedEntry {
  id: string;
  entry_type: 'knowledge' | 'incident';
  title: string;
  description: string;
  category: string;
  severity: string;

  // KB-specific fields (NULL for incidents)
  problem?: string;
  solution?: string;
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  last_used?: Date;
  confidence_score?: number;

  // Incident-specific fields (NULL for KB entries)
  status?: string;
  priority?: number;
  assigned_team?: string;
  assigned_to?: string;
  reporter?: string;
  resolution_type?: string;
  root_cause?: string;

  // Time tracking
  created_at: Date;
  updated_at: Date;
  created_by: string;
  first_response_at?: Date;
  assigned_at?: Date;
  in_progress_at?: Date;
  resolved_at?: Date;
  closed_at?: Date;

  // SLA tracking (incidents only)
  sla_breach?: boolean;
  sla_target_response_hours?: number;
  sla_target_resolution_hours?: number;
  resolution_time_hours?: number;
  response_time_hours?: number;

  // Analytics
  escalation_count?: number;
  reopen_count?: number;
  related_entries?: string; // JSON array

  // AI and automation
  ai_suggested_category?: string;
  ai_confidence_score?: number;
  ai_processed?: boolean;

  // Metadata
  tags?: string; // JSON array
  custom_fields?: string; // JSON
  attachments?: string; // JSON array
  archived?: boolean;
}

export class UnifiedHandler {
  private db: Database;
  private tableName: string;

  constructor(database: Database) {
    this.db = database;
    // Determine the correct table name
    this.tableName = this.detectUnifiedTableName();
    this.registerHandlers();
  }

  private detectUnifiedTableName(): string {
    try {
      // Check for unified_entries table first
      const unifiedExists = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='unified_entries'
      `
        )
        .get() as any;

      if (unifiedExists.count > 0) {
        console.log('📊 Using table: unified_entries');
        return 'unified_entries';
      }

      // Check for entries table
      const entriesExists = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='entries'
      `
        )
        .get() as any;

      if (entriesExists.count > 0) {
        console.log('📊 Using table: entries');
        return 'entries';
      }

      throw new Error('No unified table found');
    } catch (error) {
      console.error('Error detecting unified table name:', error);
      // Default to unified_entries
      return 'unified_entries';
    }
  }

  private registerHandlers() {
    // ===== UNIFIED OPERATIONS =====

    // Unified search across both entry types
    ipcMain.handle('unified:search', async (event, params) => {
      try {
        const { query, options = {} } = params;
        return await this.unifiedSearch(query, options);
      } catch (error) {
        console.error('Error in unified:search:', error);
        throw error;
      }
    });

    // Get entry by ID (auto-detects type)
    ipcMain.handle('unified:getEntry', async (event, { id }) => {
      try {
        return await this.getUnifiedEntry(id);
      } catch (error) {
        console.error('Error in unified:getEntry:', error);
        throw error;
      }
    });

    // Create entry (type specified in data)
    ipcMain.handle('unified:createEntry', async (event, entryData) => {
      try {
        return await this.createUnifiedEntry(entryData);
      } catch (error) {
        console.error('Error in unified:createEntry:', error);
        throw error;
      }
    });

    // Update entry (maintains type)
    ipcMain.handle('unified:updateEntry', async (event, params) => {
      try {
        const { id, updates, auditInfo } = params;
        return await this.updateUnifiedEntry(id, updates, auditInfo);
      } catch (error) {
        console.error('Error in unified:updateEntry:', error);
        throw error;
      }
    });

    // ===== KNOWLEDGE BASE COMPATIBILITY CHANNELS =====

    // KB search (filters to knowledge entries only)
    ipcMain.handle('kb:search', async (event, query: string) => {
      try {
        return await this.searchKnowledgeEntries(query);
      } catch (error) {
        console.error('KB search error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('kb:getEntry', async (event, id: string) => {
      try {
        return await this.getKnowledgeEntry(id);
      } catch (error) {
        console.error('KB getEntry error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('kb:addEntry', async (event, entry: any) => {
      try {
        const result = await this.createKnowledgeEntry(entry);
        return { success: true, data: result };
      } catch (error) {
        console.error('KB addEntry error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('kb:updateEntry', async (event, id: string, entry: any) => {
      try {
        const result = await this.updateKnowledgeEntry(id, entry);
        return { success: true, data: result };
      } catch (error) {
        console.error('KB updateEntry error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('kb:rateEntry', async (event, id: string, successful: boolean) => {
      try {
        await this.rateKnowledgeEntry(id, successful);
        return { success: true };
      } catch (error) {
        console.error('KB rateEntry error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('kb:getMetrics', async () => {
      try {
        const metrics = await this.getKnowledgeMetrics();
        return { success: true, data: metrics };
      } catch (error) {
        console.error('KB getMetrics error:', error);
        return { success: false, error: error.message };
      }
    });

    // ===== INCIDENT MANAGEMENT COMPATIBILITY CHANNELS =====

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

    // Create incident
    ipcMain.handle('incident:create', async (event, incidentData) => {
      try {
        return await this.createIncident(incidentData);
      } catch (error) {
        console.error('Error in incident:create:', error);
        throw error;
      }
    });

    // Update incident status
    ipcMain.handle('incident:updateStatus', async (event, params) => {
      try {
        const { incidentId, newStatus, reason, changedBy } = params;
        return await this.updateIncidentStatus(incidentId, newStatus, reason, changedBy);
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
        return await this.updateIncidentPriority(incidentId, priority, changedBy, reason);
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

    // Comments
    ipcMain.handle('incident:addComment', async (event, params) => {
      try {
        const { incidentId, content, author, isInternal, attachments } = params;
        return await this.addComment(incidentId, content, author, isInternal, attachments);
      } catch (error) {
        console.error('Error in incident:addComment:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:getComments', async (event, { incidentId }) => {
      try {
        return await this.getComments(incidentId);
      } catch (error) {
        console.error('Error in incident:getComments:', error);
        throw error;
      }
    });

    // Status history
    ipcMain.handle('incident:getStatusHistory', async (event, { incidentId }) => {
      try {
        return await this.getStatusHistory(incidentId);
      } catch (error) {
        console.error('Error in incident:getStatusHistory:', error);
        throw error;
      }
    });

    // Metrics
    ipcMain.handle('incident:getMetrics', async (event, { timeframe }) => {
      try {
        return await this.getIncidentMetrics(timeframe);
      } catch (error) {
        console.error('Error in incident:getMetrics:', error);
        throw error;
      }
    });

    // Additional incident operations
    ipcMain.handle('incident:escalate', async (event, params) => {
      try {
        const { incidentId, escalationLevel, reason, escalatedBy } = params;
        return await this.escalateIncident(incidentId, escalationLevel, reason, escalatedBy);
      } catch (error) {
        console.error('Error in incident:escalate:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:resolve', async (event, params) => {
      try {
        const { incidentId, resolvedBy, resolutionNotes } = params;
        return await this.resolveIncident(incidentId, resolvedBy, resolutionNotes);
      } catch (error) {
        console.error('Error in incident:resolve:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:update', async (event, params) => {
      try {
        const { incidentId, changes, auditInfo } = params;
        return await this.updateIncident(incidentId, changes, auditInfo);
      } catch (error) {
        console.error('Error in incident:update:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:search', async (event, params) => {
      try {
        const { query, filters, sort } = params;
        return await this.searchIncidents(query, filters, sort);
      } catch (error) {
        console.error('Error in incident:search:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:getSLABreaches', async event => {
      try {
        return await this.getSLABreaches();
      } catch (error) {
        console.error('Error in incident:getSLABreaches:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:updateSLA', async (event, params) => {
      try {
        const { incidentId, newDeadline, reason, updatedBy } = params;
        return await this.updateSLADeadline(incidentId, newDeadline, reason, updatedBy);
      } catch (error) {
        console.error('Error in incident:updateSLA:', error);
        throw error;
      }
    });

    ipcMain.handle('incident:getTrends', async (event, { timeframe }) => {
      try {
        return await this.getIncidentTrends(timeframe);
      } catch (error) {
        console.error('Error in incident:getTrends:', error);
        throw error;
      }
    });

    // ===== LEGACY COMPATIBILITY CHANNELS =====

    // Support for the current non-unified channel structure
    // that existing code may still be using
    this.registerLegacyCompatibilityChannels();
  }

  // ===== UNIFIED OPERATIONS IMPLEMENTATION =====

  private async unifiedSearch(query: string, options: any = {}) {
    const { entryTypes = ['knowledge', 'incident'], categories, limit = 50, offset = 0 } = options;

    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE entry_type IN (${entryTypes.map(() => '?').join(',')})
      AND archived = FALSE
      AND (
        title LIKE ? OR
        description LIKE ? OR
        problem LIKE ? OR
        solution LIKE ?
      )
    `;

    const params = [...entryTypes, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

    if (categories && categories.length > 0) {
      sql += ` AND category IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }

    sql += ` ORDER BY
      CASE entry_type WHEN 'incident' THEN
        CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
      ELSE usage_count END DESC
      LIMIT ? OFFSET ?`;

    params.push(limit, offset);

    const results = this.db.prepare(sql).all(params);
    return results.map(this.transformUnifiedEntry);
  }

  private async getUnifiedEntry(id: string): Promise<UnifiedEntry | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const result = this.db.prepare(sql).get(id);

    if (!result) {
      return null;
    }

    return this.transformUnifiedEntry(result);
  }

  private async createUnifiedEntry(entryData: any): Promise<{ id: string }> {
    const id = this.generateId();
    const now = new Date().toISOString();

    // Validate entry type
    if (!['knowledge', 'incident'].includes(entryData.entry_type)) {
      throw new Error('Invalid entry_type. Must be "knowledge" or "incident"');
    }

    // Build insert statement based on entry type
    if (entryData.entry_type === 'knowledge') {
      return await this.createKnowledgeEntryInternal(id, entryData);
    } else {
      return await this.createIncidentInternal(id, entryData);
    }
  }

  private async updateUnifiedEntry(
    id: string,
    updates: any,
    auditInfo?: any
  ): Promise<{ success: boolean; auditId?: string }> {
    // Get existing entry to determine type
    const existingEntry = await this.getUnifiedEntry(id);
    if (!existingEntry) {
      throw new Error(`Entry with id ${id} not found`);
    }

    // Route to appropriate update method based on type
    if (existingEntry.entry_type === 'knowledge') {
      return await this.updateKnowledgeEntryInternal(id, updates, auditInfo);
    } else {
      return await this.updateIncidentInternal(id, updates, auditInfo);
    }
  }

  // ===== KNOWLEDGE BASE OPERATIONS =====

  private async searchKnowledgeEntries(query: string) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE entry_type = 'knowledge'
      AND archived = FALSE
      AND (title LIKE ? OR problem LIKE ? OR solution LIKE ?)
      ORDER BY usage_count DESC, success_count DESC
      LIMIT 50
    `;

    const results = this.db.prepare(sql).all(`%${query}%`, `%${query}%`, `%${query}%`);
    return results.map(this.transformUnifiedEntry);
  }

  private async getKnowledgeEntry(id: string) {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? AND entry_type = 'knowledge'`;
    const result = this.db.prepare(sql).get(id);

    if (!result) {
      return null;
    }

    return this.transformUnifiedEntry(result);
  }

  private async createKnowledgeEntry(entryData: any): Promise<{ id: string }> {
    const id = this.generateId();
    return await this.createKnowledgeEntryInternal(id, { ...entryData, entry_type: 'knowledge' });
  }

  private async createKnowledgeEntryInternal(id: string, entryData: any): Promise<{ id: string }> {
    const sql = `
      INSERT INTO ${this.tableName} (
        id, entry_type, title, description, problem, solution, category, severity,
        created_at, updated_at, created_by, usage_count, success_count, failure_count,
        tags, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const now = new Date().toISOString();

    this.db.prepare(sql).run(
      id,
      'knowledge',
      entryData.title,
      entryData.description || entryData.problem, // Use problem as description for KB entries
      entryData.problem,
      entryData.solution,
      entryData.category,
      entryData.severity || 'medium',
      now,
      now,
      entryData.created_by || 'system',
      0, // usage_count
      0, // success_count
      0, // failure_count
      JSON.stringify(entryData.tags || []),
      entryData.confidence_score || null
    );

    return { id };
  }

  private async updateKnowledgeEntry(id: string, updates: any): Promise<any> {
    return await this.updateKnowledgeEntryInternal(id, updates);
  }

  private async updateKnowledgeEntryInternal(
    id: string,
    updates: any,
    auditInfo?: any
  ): Promise<{ success: boolean; auditId?: string }> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Map knowledge-specific fields
    if (updates.title) {
      updateFields.push('title = ?');
      updateValues.push(updates.title);
    }
    if (updates.problem) {
      updateFields.push('problem = ?');
      updateValues.push(updates.problem);
      // Also update description for consistency
      updateFields.push('description = ?');
      updateValues.push(updates.problem);
    }
    if (updates.solution) {
      updateFields.push('solution = ?');
      updateValues.push(updates.solution);
    }
    if (updates.category) {
      updateFields.push('category = ?');
      updateValues.push(updates.category);
    }
    if (updates.severity) {
      updateFields.push('severity = ?');
      updateValues.push(updates.severity);
    }
    if (updates.tags) {
      updateFields.push('tags = ?');
      updateValues.push(JSON.stringify(updates.tags));
    }
    if (updates.confidence_score !== undefined) {
      updateFields.push('confidence_score = ?');
      updateValues.push(updates.confidence_score);
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id); // For WHERE clause

    const sql = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = ? AND entry_type = 'knowledge'
    `;

    const result = this.db.prepare(sql).run(...updateValues);

    if (result.changes === 0) {
      throw new Error(`Knowledge entry with id ${id} not found`);
    }

    return { success: true };
  }

  private async rateKnowledgeEntry(id: string, successful: boolean): Promise<void> {
    const field = successful ? 'success_count' : 'failure_count';
    const sql = `
      UPDATE ${this.tableName}
      SET ${field} = ${field} + 1, usage_count = usage_count + 1, last_used = ?
      WHERE id = ? AND entry_type = 'knowledge'
    `;

    this.db.prepare(sql).run(new Date().toISOString(), id);
  }

  private async getKnowledgeMetrics(): Promise<any> {
    const sql = `
      SELECT
        COUNT(*) as total_entries,
        SUM(usage_count) as total_usage,
        SUM(success_count) as total_success,
        SUM(failure_count) as total_failure,
        AVG(confidence_score) as avg_confidence
      FROM ${this.tableName}
      WHERE entry_type = 'knowledge' AND archived = FALSE
    `;

    return this.db.prepare(sql).get();
  }

  // ===== INCIDENT OPERATIONS =====

  private async getIncidents(
    filters?: IncidentFilter,
    sort?: IncidentSort,
    page = 1,
    pageSize = 50
  ) {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE entry_type = 'incident' AND archived = FALSE
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
        query += ` AND sla_breach = TRUE`;
      } else if (filters.sla_status === 'at_risk') {
        query += ` AND sla_breach = FALSE AND sla_target_resolution_hours IS NOT NULL`;
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
      query += ` ORDER BY
        CASE status WHEN 'aberto' THEN 1 WHEN 'em_tratamento' THEN 2 ELSE 3 END,
        CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        created_at DESC`;
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
    const query = `SELECT * FROM ${this.tableName} WHERE id = ? AND entry_type = 'incident'`;
    const incident = this.db.prepare(query).get(id);

    if (!incident) {
      throw new Error(`Incident with id ${id} not found`);
    }

    return this.transformIncident(incident);
  }

  private async createIncident(incidentData: any): Promise<{ id: string }> {
    const id = this.generateId();
    return await this.createIncidentInternal(id, { ...incidentData, entry_type: 'incident' });
  }

  private async createIncidentInternal(id: string, incidentData: any): Promise<{ id: string }> {
    const incidentNumber = this.generateIncidentNumber();
    const slaDeadline = this.calculateSLADeadline(incidentData.priority || 3);

    const sql = `
      INSERT INTO entries (
        id, entry_type, title, description, category, severity, status, priority,
        assigned_team, assigned_to, reporter, created_at, updated_at, created_by,
        sla_target_response_hours, sla_target_resolution_hours, escalation_count,
        reopen_count, tags, custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const now = new Date().toISOString();

    this.db.prepare(sql).run(
      id,
      'incident',
      incidentData.title,
      incidentData.description || incidentData.problem,
      incidentData.category,
      incidentData.severity || 'medium',
      incidentData.status || 'aberto',
      incidentData.priority || 3,
      incidentData.assigned_team,
      incidentData.assigned_to,
      incidentData.reporter,
      now,
      now,
      incidentData.created_by || 'system',
      this.getSLAResponseTime(incidentData.priority || 3),
      this.getSLAResolutionTime(incidentData.priority || 3),
      0, // escalation_count
      0, // reopen_count
      JSON.stringify(incidentData.tags || []),
      JSON.stringify(incidentData.custom_fields || {})
    );

    return { id };
  }

  private async updateIncidentStatus(
    incidentId: string,
    newStatus: string,
    reason?: string,
    changedBy?: string
  ): Promise<void> {
    const updateQuery = `
      UPDATE ${this.tableName}
      SET status = ?, updated_at = ?
      WHERE id = ? AND entry_type = 'incident'
    `;

    const result = this.db
      .prepare(updateQuery)
      .run(newStatus, new Date().toISOString(), incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Add status change comment
    if (reason) {
      await this.addComment(
        incidentId,
        `Status changed to ${newStatus}: ${reason}`,
        changedBy || 'system',
        true
      );
    }
  }

  private async assignIncident(
    incidentId: string,
    assignedTo: string,
    assignedBy?: string
  ): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET assigned_to = ?,
          status = CASE WHEN status = 'aberto' THEN 'em_tratamento' ELSE status END,
          updated_at = ?,
          assigned_at = CASE WHEN assigned_at IS NULL THEN ? ELSE assigned_at END
      WHERE id = ? AND entry_type = 'incident'
    `;

    const now = new Date().toISOString();
    const result = this.db.prepare(query).run(assignedTo, now, now, incidentId);

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

  private async updateIncidentPriority(
    incidentId: string,
    priority: number,
    changedBy?: string,
    reason?: string
  ): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET priority = ?, updated_at = ?
      WHERE id = ? AND entry_type = 'incident'
    `;

    const result = this.db.prepare(query).run(priority, new Date().toISOString(), incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Log priority change as comment
    await this.addComment(
      incidentId,
      `Priority changed to P${priority}${reason ? `: ${reason}` : ''}`,
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
          await this.updateIncidentStatus(id, target_value, reason, performed_by);
        }
        break;

      case 'change_priority':
        for (const id of incident_ids) {
          await this.updateIncidentPriority(id, parseInt(target_value), performed_by, reason);
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
    entryId: string,
    content: string,
    author: string,
    isInternal = false,
    attachments?: string[]
  ): Promise<{ id: string }> {
    const id = this.generateId();
    const sql = `
      INSERT INTO unified_comments (
        id, entry_id, content, author, is_internal, comment_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    this.db
      .prepare(sql)
      .run(id, entryId, content, author, isInternal ? 1 : 0, 'comment', new Date().toISOString());

    return { id };
  }

  private async getComments(entryId: string): Promise<IncidentComment[]> {
    const query = `
      SELECT * FROM unified_comments
      WHERE entry_id = ?
      ORDER BY created_at DESC
    `;

    const comments = this.db.prepare(query).all(entryId);
    return comments.map(comment => ({
      id: comment.id,
      entry_id: comment.entry_id,
      content: comment.content,
      author: comment.author,
      is_internal: Boolean(comment.is_internal),
      comment_type: comment.comment_type,
      created_at: new Date(comment.created_at),
      rating: comment.rating,
      successful: comment.successful !== null ? Boolean(comment.successful) : undefined,
      resolution_time: comment.resolution_time,
    }));
  }

  private async getStatusHistory(entryId: string): Promise<StatusTransition[]> {
    const query = `
      SELECT * FROM unified_comments
      WHERE entry_id = ? AND comment_type = 'status_change'
      ORDER BY created_at DESC
    `;

    const transitions = this.db.prepare(query).all(entryId);
    return transitions.map(transition => ({
      id: transition.id,
      incident_id: transition.entry_id,
      from_status: '', // Extract from content if needed
      to_status: '', // Extract from content if needed
      changed_by: transition.author,
      change_reason: transition.content,
      timestamp: new Date(transition.created_at),
      metadata: transition.metadata ? JSON.parse(transition.metadata) : undefined,
    }));
  }

  private async getIncidentMetrics(timeframe = '24h'): Promise<IncidentMetrics> {
    const metricsQuery = `
      SELECT
        COUNT(CASE WHEN status = 'aberto' THEN 1 END) as total_open,
        COUNT(CASE WHEN status = 'em_tratamento' THEN 1 END) as total_in_progress,
        COUNT(CASE WHEN status = 'resolvido' AND DATE(resolved_at) = DATE('now') THEN 1 END) as total_resolved_today,
        AVG(resolution_time_hours) as avg_resolution_time,
        COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_breaches,
        COUNT(CASE WHEN priority = 1 THEN 1 END) as p1_count,
        COUNT(CASE WHEN priority = 2 THEN 1 END) as p2_count,
        COUNT(CASE WHEN priority = 3 THEN 1 END) as p3_count,
        COUNT(CASE WHEN priority = 4 THEN 1 END) as p4_count
      FROM ${this.tableName}
      WHERE entry_type = 'incident' AND archived = FALSE
    `;

    const metrics = this.db.prepare(metricsQuery).get() as any;

    const recentQuery = `
      SELECT * FROM ${this.tableName}
      WHERE entry_type = 'incident'
      AND created_at >= datetime('now', '-${timeframe}')
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
        em_tratamento: metrics.total_in_progress || 0,
        em_revisao: 0,
        resolvido: metrics.total_resolved_today || 0,
        fechado: 0,
        reaberto: 0,
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
      UPDATE ${this.tableName}
      SET escalation_count = escalation_count + 1, updated_at = ?
      WHERE id = ? AND entry_type = 'incident'
    `;

    const result = this.db.prepare(query).run(new Date().toISOString(), incidentId);

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
    const incidentQuery = `SELECT created_at FROM ${this.tableName} WHERE id = ? AND entry_type = 'incident'`;
    const incident = this.db.prepare(incidentQuery).get(incidentId) as any;

    if (!incident) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    const resolutionTime = Math.floor(
      (Date.now() - new Date(incident.created_at).getTime()) / (1000 * 60)
    );

    const updateQuery = `
      UPDATE ${this.tableName}
      SET status = 'resolvido',
          resolved_at = ?,
          resolution_time_hours = ?,
          updated_at = ?
      WHERE id = ? AND entry_type = 'incident'
    `;

    const now = new Date().toISOString();
    this.db.prepare(updateQuery).run(now, resolutionTime / 60, now, incidentId);

    // Add resolution comment
    if (resolutionNotes) {
      await this.addComment(incidentId, `Resolution: ${resolutionNotes}`, resolvedBy, false);
    }
  }

  private async updateIncident(
    incidentId: string,
    changes: any,
    auditInfo?: any
  ): Promise<{ success: boolean; auditId?: string }> {
    return await this.updateIncidentInternal(incidentId, changes, auditInfo);
  }

  private async updateIncidentInternal(
    id: string,
    changes: any,
    auditInfo?: any
  ): Promise<{ success: boolean; auditId?: string }> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Map incident-specific fields
    if (changes.title) {
      updateFields.push('title = ?');
      updateValues.push(changes.title);
    }
    if (changes.description) {
      updateFields.push('description = ?');
      updateValues.push(changes.description);
    }
    if (changes.category) {
      updateFields.push('category = ?');
      updateValues.push(changes.category);
    }
    if (changes.severity) {
      updateFields.push('severity = ?');
      updateValues.push(changes.severity);
    }
    if (changes.status) {
      updateFields.push('status = ?');
      updateValues.push(changes.status);
    }
    if (changes.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(changes.priority);
    }
    if (changes.assigned_to) {
      updateFields.push('assigned_to = ?');
      updateValues.push(changes.assigned_to);
    }
    if (changes.assigned_team) {
      updateFields.push('assigned_team = ?');
      updateValues.push(changes.assigned_team);
    }
    if (changes.solution) {
      updateFields.push('solution = ?');
      updateValues.push(changes.solution);
    }
    if (changes.resolution_type) {
      updateFields.push('resolution_type = ?');
      updateValues.push(changes.resolution_type);
    }
    if (changes.root_cause) {
      updateFields.push('root_cause = ?');
      updateValues.push(changes.root_cause);
    }
    if (changes.tags) {
      updateFields.push('tags = ?');
      updateValues.push(JSON.stringify(changes.tags));
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id); // For WHERE clause

    const sql = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = ? AND entry_type = 'incident'
    `;

    const result = this.db.prepare(sql).run(...updateValues);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${id} not found`);
    }

    return { success: true };
  }

  private async searchIncidents(
    query: string,
    filters?: IncidentFilter,
    sort?: IncidentSort
  ): Promise<IncidentKBEntry[]> {
    let searchQuery = `
      SELECT * FROM ${this.tableName}
      WHERE entry_type = 'incident'
      AND archived = FALSE
      AND (title LIKE ? OR description LIKE ?)
    `;

    const params = [`%${query}%`, `%${query}%`];

    // Apply additional filters
    if (filters?.status && filters.status.length > 0) {
      searchQuery += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    }

    if (sort) {
      searchQuery += ` ORDER BY ${sort.field} ${sort.direction.toUpperCase()}`;
    } else {
      searchQuery += ` ORDER BY created_at DESC`;
    }

    searchQuery += ` LIMIT 100`; // Reasonable limit for search

    const results = this.db.prepare(searchQuery).all(params);
    return results.map(this.transformIncident);
  }

  private async getSLABreaches(): Promise<IncidentKBEntry[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE entry_type = 'incident'
        AND sla_breach = TRUE
        AND status NOT IN ('resolvido', 'fechado')
      ORDER BY created_at ASC
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
      UPDATE ${this.tableName}
      SET sla_target_resolution_hours = ?, updated_at = ?
      WHERE id = ? AND entry_type = 'incident'
    `;

    const result = this.db.prepare(query).run(newDeadline, new Date().toISOString(), incidentId);

    if (result.changes === 0) {
      throw new Error(`Incident with id ${incidentId} not found`);
    }

    // Log SLA change
    await this.addComment(incidentId, `SLA deadline updated: ${reason}`, updatedBy, true);
  }

  private async getIncidentTrends(timeframe: string): Promise<any> {
    // Implement trend analysis queries
    return {
      resolution_time_trend: [],
      volume_trend: [],
      sla_compliance_trend: [],
    };
  }

  // ===== LEGACY COMPATIBILITY CHANNELS =====

  private registerLegacyCompatibilityChannels() {
    // These channels provide compatibility with the existing incident handler structure
    // but route to the unified implementation

    // Status update with user ID (legacy format)
    ipcMain.handle(
      'incident:updateStatus',
      async (_, id: string, status: string, userId: string) => {
        try {
          if (!id || !status || !userId) {
            return { success: false, error: 'ID, status e usuário são obrigatórios' };
          }

          const validStatuses = ['em_revisao', 'aberto', 'em_tratamento', 'resolvido', 'fechado'];
          if (!validStatuses.includes(status)) {
            return { success: false, error: 'Status inválido' };
          }

          await this.updateIncidentStatus(id, status, undefined, userId);
          return { success: true, message: 'Status do incidente atualizado com sucesso' };
        } catch (error) {
          console.error('Incident status update error:', error);
          return {
            success: false,
            error: 'Erro ao atualizar status do incidente: ' + error.message,
          };
        }
      }
    );

    // Assignment with legacy format
    ipcMain.handle(
      'incident:assign',
      async (_, id: string, assignedTo: string, assignedBy: string) => {
        try {
          if (!id || !assignedTo || !assignedBy) {
            return {
              success: false,
              error: 'ID, usuário atribuído e usuário responsável pela atribuição são obrigatórios',
            };
          }

          await this.assignIncident(id, assignedTo, assignedBy);
          return { success: true, message: 'Incidente atribuído com sucesso' };
        } catch (error) {
          console.error('Incident assignment error:', error);
          return { success: false, error: 'Erro ao atribuir incidente: ' + error.message };
        }
      }
    );

    // Additional legacy channels that need special handling
    this.registerAICompatibilityChannels();
  }

  private registerAICompatibilityChannels() {
    // AI-related channels for backward compatibility with existing incident AI operations

    ipcMain.handle('incident:requestAIAnalysis', async (_, entryId: string, userId: string) => {
      try {
        if (!entryId || !userId) {
          return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
        }

        const updateQuery = `
          UPDATE ${this.tableName}
          SET ai_processed = FALSE, updated_at = ?
          WHERE id = ? AND entry_type = 'incident'
        `;

        this.db.prepare(updateQuery).run(new Date().toISOString(), entryId);

        return { success: true, message: 'Análise de IA solicitada com sucesso' };
      } catch (error) {
        console.error('Request AI analysis error:', error);
        return { success: false, error: 'Erro ao solicitar análise de IA: ' + error.message };
      }
    });

    ipcMain.handle(
      'incident:acceptSolution',
      async (_, entryId: string, userId: string, rating?: number) => {
        try {
          if (!entryId || !userId) {
            return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
          }

          const updateQuery = `
          UPDATE ${this.tableName}
          SET status = 'resolvido',
              resolved_at = ?,
              updated_at = ?
          WHERE id = ? AND entry_type = 'incident'
        `;

          const now = new Date().toISOString();
          this.db.prepare(updateQuery).run(now, now, entryId);

          // Add acceptance comment with rating if provided
          if (rating) {
            await this.addComment(
              entryId,
              `Solution accepted with rating: ${rating}`,
              userId,
              false
            );
          }

          return { success: true, message: 'Solução aceita e incidente resolvido com sucesso' };
        } catch (error) {
          console.error('Accept solution error:', error);
          return { success: false, error: 'Erro ao aceitar solução: ' + error.message };
        }
      }
    );

    ipcMain.handle(
      'incident:rejectSolution',
      async (_, entryId: string, userId: string, reason?: string) => {
        try {
          if (!entryId || !userId) {
            return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
          }

          // Reset AI processing flags
          const updateQuery = `
          UPDATE ${this.tableName}
          SET ai_processed = FALSE, updated_at = ?
          WHERE id = ? AND entry_type = 'incident'
        `;

          this.db.prepare(updateQuery).run(new Date().toISOString(), entryId);

          // Add rejection comment with reason if provided
          if (reason) {
            await this.addComment(entryId, `Solution rejected: ${reason}`, userId, false);
          }

          return { success: true, message: 'Solução rejeitada com sucesso' };
        } catch (error) {
          console.error('Reject solution error:', error);
          return { success: false, error: 'Erro ao rejeitar solução: ' + error.message };
        }
      }
    );
  }

  // ===== UTILITY METHODS =====

  private transformUnifiedEntry(row: any): UnifiedEntry {
    return {
      id: row.id,
      entry_type: row.entry_type,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,

      // KB-specific fields
      problem: row.problem,
      solution: row.solution,
      usage_count: row.usage_count,
      success_count: row.success_count,
      failure_count: row.failure_count,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      confidence_score: row.confidence_score,

      // Incident-specific fields
      status: row.status,
      priority: row.priority,
      assigned_team: row.assigned_team,
      assigned_to: row.assigned_to,
      reporter: row.reporter,
      resolution_type: row.resolution_type,
      root_cause: row.root_cause,

      // Time tracking
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      first_response_at: row.first_response_at ? new Date(row.first_response_at) : undefined,
      assigned_at: row.assigned_at ? new Date(row.assigned_at) : undefined,
      in_progress_at: row.in_progress_at ? new Date(row.in_progress_at) : undefined,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closed_at: row.closed_at ? new Date(row.closed_at) : undefined,

      // SLA tracking
      sla_breach: Boolean(row.sla_breach),
      sla_target_response_hours: row.sla_target_response_hours,
      sla_target_resolution_hours: row.sla_target_resolution_hours,
      resolution_time_hours: row.resolution_time_hours,
      response_time_hours: row.response_time_hours,

      // Analytics
      escalation_count: row.escalation_count || 0,
      reopen_count: row.reopen_count || 0,
      related_entries: row.related_entries,

      // AI and automation
      ai_suggested_category: row.ai_suggested_category,
      ai_confidence_score: row.ai_confidence_score,
      ai_processed: Boolean(row.ai_processed),

      // Metadata
      tags: row.tags,
      custom_fields: row.custom_fields,
      attachments: row.attachments,
      archived: Boolean(row.archived),
    };
  }

  private transformIncident(row: any): IncidentKBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.description, // Map description to problem for backward compatibility
      solution: row.solution || '',
      category: row.category,
      severity: row.severity,
      status: row.status,
      priority: row.priority,
      tags: row.tags ? JSON.parse(row.tags) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      assigned_to: row.assigned_to,
      assigned_team: row.assigned_team,
      reporter: row.reporter,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
      resolution_time_hours: row.resolution_time_hours,
      response_time_hours: row.response_time_hours,
      sla_breach: Boolean(row.sla_breach),
      escalation_count: row.escalation_count || 0,
      reopen_count: row.reopen_count || 0,
      incident_number: `INC-${new Date().getFullYear()}-${row.id.slice(-6)}`,
      business_impact: row.severity, // Map severity to business impact
      customer_impact: row.severity === 'critical',
      escalation_level: 'none',
      sla_deadline: row.sla_target_resolution_hours
        ? new Date(Date.now() + row.sla_target_resolution_hours * 60 * 60 * 1000)
        : undefined,
      last_status_change: row.updated_at ? new Date(row.updated_at) : undefined,
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

  private calculateSLADeadline(priority: number): Date {
    const slaHours = {
      1: 1, // P1: 1 hour
      2: 4, // P2: 4 hours
      3: 8, // P3: 8 hours
      4: 24, // P4: 24 hours
      5: 72, // P5: 72 hours
    };

    const hours = slaHours[priority as keyof typeof slaHours] || 8;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private getSLAResponseTime(priority: number): number {
    const responseTimes = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 24 };
    return responseTimes[priority as keyof typeof responseTimes] || 4;
  }

  private getSLAResolutionTime(priority: number): number {
    const resolutionTimes = { 1: 4, 2: 8, 3: 24, 4: 72, 5: 168 };
    return resolutionTimes[priority as keyof typeof resolutionTimes] || 24;
  }
}

export default UnifiedHandler;
