import { Database } from 'sqlite3';
import { promisify } from 'util';

// Types for incident management
interface Incident {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'aberto' | 'em_tratamento' | 'resolvido' | 'fechado' | 'reaberto' | 'em_revisao';
  priority: number;
  assigned_team?: string;
  assigned_to?: string;
  reporter: string;
  resolution?: string;
  resolution_type?: string;
  root_cause?: string;
  created_at: Date;
  updated_at: Date;
  first_response_at?: Date;
  assigned_at?: Date;
  in_progress_at?: Date;
  resolved_at?: Date;
  closed_at?: Date;
  sla_breach: boolean;
  sla_target_response_hours?: number;
  sla_target_resolution_hours?: number;
  resolution_time_hours?: number;
  response_time_hours?: number;
  escalation_count: number;
  reopen_count: number;
  related_kb_entries?: string;
  ai_suggested_category?: string;
  ai_confidence_score?: number;
  ai_processed: boolean;
  tags?: string;
  custom_fields?: string;
  attachments?: string;
  archived: boolean;
}

interface IncidentRelationship {
  id: number;
  source_incident_id: string;
  target_incident_id: string;
  relationship_type:
    | 'related'
    | 'duplicate'
    | 'blocks'
    | 'blocked_by'
    | 'parent'
    | 'child'
    | 'caused_by'
    | 'causes';
  similarity_score: number;
  created_at: Date;
  created_by: string;
  notes?: string;
}

interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  rule_type: 'auto_assign' | 'auto_categorize' | 'auto_escalate' | 'auto_close' | 'notification';
  conditions: string; // JSON
  actions: string; // JSON
  enabled: boolean;
  priority: number;
  success_count: number;
  failure_count: number;
  last_executed?: Date;
  created_at: Date;
  created_by: string;
}

interface AnalyticsData {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  avgMTTR: number;
  avgResponseTime: number;
  slaCompliance: number;
  categoryBreakdown: { category: string; count: number; percentage: number }[];
  severityBreakdown: { severity: string; count: number; percentage: number }[];
  teamPerformance: { team: string; avgResolutionTime: number; slaCompliance: number }[];
  dailyTrends: { date: string; newIncidents: number; resolvedIncidents: number; mttr: number }[];
}

export class IncidentService {
  private db: Database;
  private dbRun: (sql: string, params?: any[]) => Promise<any>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(database: Database) {
    this.db = database;
    this.dbRun = promisify(database.run.bind(database));
    this.dbGet = promisify(database.get.bind(database));
    this.dbAll = promisify(database.all.bind(database));
  }

  // ===== INCIDENT CRUD OPERATIONS =====

  async createIncident(
    incident: Omit<
      Incident,
      | 'id'
      | 'created_at'
      | 'updated_at'
      | 'escalation_count'
      | 'reopen_count'
      | 'ai_processed'
      | 'sla_breach'
      | 'archived'
    >
  ): Promise<string> {
    const id = `INC-${Date.now()}`;

    await this.dbRun(
      `
      INSERT INTO incidents (
        id, title, description, category, severity, status, priority,
        assigned_team, assigned_to, reporter, resolution, resolution_type,
        root_cause, sla_target_response_hours, sla_target_resolution_hours,
        related_kb_entries, ai_suggested_category, ai_confidence_score,
        tags, custom_fields, attachments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        incident.title,
        incident.description,
        incident.category,
        incident.severity,
        incident.status,
        incident.priority,
        incident.assigned_team,
        incident.assigned_to,
        incident.reporter,
        incident.resolution,
        incident.resolution_type,
        incident.root_cause,
        incident.sla_target_response_hours,
        incident.sla_target_resolution_hours,
        incident.related_kb_entries,
        incident.ai_suggested_category,
        incident.ai_confidence_score,
        incident.tags,
        incident.custom_fields,
        incident.attachments,
      ]
    );

    // Trigger automation rules
    await this.executeAutomationRules(id);

    return id;
  }

  async getIncident(id: string): Promise<Incident | null> {
    const result = await this.dbGet('SELECT * FROM incidents WHERE id = ?', [id]);
    return result ? this.mapDatabaseToIncident(result) : null;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<void> {
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);
    values.push(id);

    await this.dbRun(
      `
      UPDATE incidents
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      values
    );

    // Trigger automation rules if status changed
    if (updates.status) {
      await this.executeAutomationRules(id);
    }
  }

  async deleteIncident(id: string): Promise<void> {
    await this.dbRun('UPDATE incidents SET archived = TRUE WHERE id = ?', [id]);
  }

  async searchIncidents(criteria: {
    query?: string;
    category?: string;
    severity?: string[];
    status?: string[];
    assigned_team?: string;
    assigned_to?: string;
    date_range?: { start: Date; end: Date };
    include_resolved?: boolean;
    include_archived?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Incident[]> {
    let sql = `
      SELECT i.* FROM incidents i
      LEFT JOIN kb_fts ON kb_fts.id = i.related_kb_entries
      WHERE 1=1
    `;
    const params: any[] = [];

    // Text search
    if (criteria.query) {
      sql += ` AND (i.title LIKE ? OR i.description LIKE ? OR i.id LIKE ?)`;
      const searchTerm = `%${criteria.query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Category filter
    if (criteria.category && criteria.category !== 'all') {
      sql += ` AND i.category = ?`;
      params.push(criteria.category);
    }

    // Severity filter
    if (criteria.severity && criteria.severity.length > 0) {
      sql += ` AND i.severity IN (${criteria.severity.map(() => '?').join(',')})`;
      params.push(...criteria.severity);
    }

    // Status filter
    if (criteria.status && criteria.status.length > 0) {
      sql += ` AND i.status IN (${criteria.status.map(() => '?').join(',')})`;
      params.push(...criteria.status);
    }

    // Team filter
    if (criteria.assigned_team) {
      sql += ` AND i.assigned_team = ?`;
      params.push(criteria.assigned_team);
    }

    // Assignee filter
    if (criteria.assigned_to) {
      sql += ` AND i.assigned_to = ?`;
      params.push(criteria.assigned_to);
    }

    // Date range filter
    if (criteria.date_range) {
      sql += ` AND i.created_at BETWEEN ? AND ?`;
      params.push(criteria.date_range.start.toISOString(), criteria.date_range.end.toISOString());
    }

    // Include resolved
    if (!criteria.include_resolved) {
      sql += ` AND i.status NOT IN ('resolvido', 'fechado')`;
    }

    // Include archived
    if (!criteria.include_archived) {
      sql += ` AND i.archived = FALSE`;
    }

    sql += ` ORDER BY i.created_at DESC`;

    // Pagination
    if (criteria.limit) {
      sql += ` LIMIT ?`;
      params.push(criteria.limit);

      if (criteria.offset) {
        sql += ` OFFSET ?`;
        params.push(criteria.offset);
      }
    }

    const results = await this.dbAll(sql, params);
    return results.map(this.mapDatabaseToIncident);
  }

  // ===== RELATIONSHIP MANAGEMENT =====

  async createRelationship(
    relationship: Omit<IncidentRelationship, 'id' | 'created_at'>
  ): Promise<number> {
    const result = await this.dbRun(
      `
      INSERT INTO incident_relationships (
        source_incident_id, target_incident_id, relationship_type,
        similarity_score, created_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        relationship.source_incident_id,
        relationship.target_incident_id,
        relationship.relationship_type,
        relationship.similarity_score,
        relationship.created_by,
        relationship.notes,
      ]
    );

    return result.lastID;
  }

  async getIncidentRelationships(
    incidentId: string,
    maxDepth: number = 3
  ): Promise<{
    nodes: Array<{ id: string; incident: Incident; level: number }>;
    links: Array<{ source: string; target: string; relationship: IncidentRelationship }>;
  }> {
    const visited = new Set<string>();
    const nodes: Array<{ id: string; incident: Incident; level: number }> = [];
    const links: Array<{ source: string; target: string; relationship: IncidentRelationship }> = [];

    await this.collectRelationships(incidentId, 0, maxDepth, visited, nodes, links);

    return { nodes, links };
  }

  private async collectRelationships(
    incidentId: string,
    currentLevel: number,
    maxDepth: number,
    visited: Set<string>,
    nodes: Array<{ id: string; incident: Incident; level: number }>,
    links: Array<{ source: string; target: string; relationship: IncidentRelationship }>
  ): Promise<void> {
    if (currentLevel > maxDepth || visited.has(incidentId)) return;

    visited.add(incidentId);

    // Get incident details
    const incident = await this.getIncident(incidentId);
    if (!incident) return;

    nodes.push({ id: incidentId, incident, level: currentLevel });

    // Get related incidents
    const relationships = await this.dbAll(
      `
      SELECT r.*,
             CASE WHEN r.source_incident_id = ? THEN r.target_incident_id
                  ELSE r.source_incident_id END as related_incident_id
      FROM incident_relationships r
      WHERE r.source_incident_id = ? OR r.target_incident_id = ?
    `,
      [incidentId, incidentId, incidentId]
    );

    for (const rel of relationships) {
      const relationship: IncidentRelationship = {
        id: rel.id,
        source_incident_id: rel.source_incident_id,
        target_incident_id: rel.target_incident_id,
        relationship_type: rel.relationship_type,
        similarity_score: rel.similarity_score,
        created_at: new Date(rel.created_at),
        created_by: rel.created_by,
        notes: rel.notes,
      };

      links.push({
        source: rel.source_incident_id,
        target: rel.target_incident_id,
        relationship,
      });

      // Recursively collect relationships
      await this.collectRelationships(
        rel.related_incident_id,
        currentLevel + 1,
        maxDepth,
        visited,
        nodes,
        links
      );
    }
  }

  async deleteRelationship(relationshipId: number): Promise<void> {
    await this.dbRun('DELETE FROM incident_relationships WHERE id = ?', [relationshipId]);
  }

  // ===== AUTOMATION =====

  async createAutomationRule(
    rule: Omit<AutomationRule, 'id' | 'created_at' | 'success_count' | 'failure_count'>
  ): Promise<number> {
    const result = await this.dbRun(
      `
      INSERT INTO automation_rules (
        name, description, rule_type, conditions, actions,
        enabled, priority, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        rule.name,
        rule.description,
        rule.rule_type,
        rule.conditions,
        rule.actions,
        rule.enabled,
        rule.priority,
        rule.created_by,
      ]
    );

    return result.lastID;
  }

  async executeAutomationRules(incidentId: string): Promise<void> {
    const incident = await this.getIncident(incidentId);
    if (!incident) return;

    const rules = await this.dbAll(`
      SELECT * FROM automation_rules
      WHERE enabled = TRUE
      ORDER BY priority ASC
    `);

    for (const rule of rules) {
      try {
        const conditions = JSON.parse(rule.conditions);
        const actions = JSON.parse(rule.actions);

        if (await this.evaluateConditions(incident, conditions)) {
          await this.executeActions(incident, actions);
          await this.dbRun(
            `
            UPDATE automation_rules
            SET success_count = success_count + 1, last_executed = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
            [rule.id]
          );
        }
      } catch (error) {
        console.error(`Error executing automation rule ${rule.id}:`, error);
        await this.dbRun(
          `
          UPDATE automation_rules
          SET failure_count = failure_count + 1
          WHERE id = ?
        `,
          [rule.id]
        );
      }
    }
  }

  private async evaluateConditions(incident: Incident, conditions: any[]): Promise<boolean> {
    for (const condition of conditions) {
      const { field, operator, value, logicalOperator = 'AND' } = condition;

      let fieldValue = (incident as any)[field];
      let matches = false;

      switch (operator) {
        case 'equals':
          matches = fieldValue === value;
          break;
        case 'contains':
          matches = fieldValue && fieldValue.toString().toLowerCase().includes(value.toLowerCase());
          break;
        case 'greater_than':
          matches = fieldValue > value;
          break;
        case 'less_than':
          matches = fieldValue < value;
          break;
        case 'in':
          matches = Array.isArray(value)
            ? value.includes(fieldValue)
            : value.split(',').includes(fieldValue);
          break;
        case 'not_in':
          matches = Array.isArray(value)
            ? !value.includes(fieldValue)
            : !value.split(',').includes(fieldValue);
          break;
      }

      // For simplicity, treating all conditions as AND
      if (!matches) return false;
    }

    return true;
  }

  private async executeActions(incident: Incident, actions: any[]): Promise<void> {
    for (const action of actions) {
      const { type, parameters } = action;

      switch (type) {
        case 'assign_to':
          await this.updateIncident(incident.id, { assigned_to: parameters.assignee });
          break;
        case 'assign_to_team':
          await this.updateIncident(incident.id, { assigned_team: parameters.team });
          break;
        case 'set_category':
          if (parameters.use_ai) {
            // AI categorization logic would go here
            const aiCategory = await this.categorizeWithAI(incident);
            if (aiCategory.confidence >= (parameters.confidence_threshold || 0.8)) {
              await this.updateIncident(incident.id, {
                category: aiCategory.category,
                ai_suggested_category: aiCategory.category,
                ai_confidence_score: aiCategory.confidence,
                ai_processed: true,
              });
            }
          } else {
            await this.updateIncident(incident.id, { category: parameters.category });
          }
          break;
        case 'set_severity':
          await this.updateIncident(incident.id, { severity: parameters.severity });
          break;
        case 'escalate':
          await this.updateIncident(incident.id, {
            escalation_count: incident.escalation_count + 1,
            assigned_to: parameters.escalate_to,
          });
          break;
        case 'send_notification':
          // Notification logic would go here
          console.log(
            `Sending notification to ${parameters.recipients} for incident ${incident.id}`
          );
          break;
        case 'close_incident':
          await this.updateIncident(incident.id, {
            status: 'fechado',
            resolution_type: parameters.resolution_type,
            resolution: parameters.resolution,
          });
          break;
        case 'link_kb':
          const currentEntries = incident.related_kb_entries
            ? JSON.parse(incident.related_kb_entries)
            : [];
          currentEntries.push(parameters.kb_entry_id);
          await this.updateIncident(incident.id, {
            related_kb_entries: JSON.stringify(currentEntries),
          });
          break;
      }
    }
  }

  // ===== AI CATEGORIZATION =====

  private async categorizeWithAI(
    incident: Incident
  ): Promise<{ category: string; confidence: number; reasoning: string }> {
    // Mock AI categorization - in production, this would call an AI service
    const text = `${incident.title} ${incident.description}`.toLowerCase();

    let category = 'Other';
    let confidence = 0.5;
    let reasoning = 'Could not determine category with high confidence';

    if (text.includes('db2') || text.includes('database') || text.includes('sql')) {
      category = 'DB2';
      confidence = 0.92;
      reasoning = 'Contains database-related keywords';
    } else if (text.includes('jcl') || text.includes('job') || text.includes('step')) {
      category = 'JCL';
      confidence = 0.87;
      reasoning = 'Contains JCL-related keywords';
    } else if (text.includes('cics') || text.includes('transaction')) {
      category = 'CICS';
      confidence = 0.85;
      reasoning = 'Contains CICS-related keywords';
    } else if (
      text.includes('network') ||
      text.includes('connection') ||
      text.includes('timeout')
    ) {
      category = 'Network';
      confidence = 0.79;
      reasoning = 'Contains network-related keywords';
    }

    return { category, confidence, reasoning };
  }

  // ===== ANALYTICS =====

  async getAnalyticsData(timeRange: { start: Date; end: Date }): Promise<AnalyticsData> {
    const incidents = await this.dbAll(
      `
      SELECT * FROM incidents
      WHERE created_at BETWEEN ? AND ?
      AND archived = FALSE
    `,
      [timeRange.start.toISOString(), timeRange.end.toISOString()]
    );

    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter(i =>
      ['aberto', 'em_tratamento'].includes(i.status)
    ).length;
    const resolvedIncidents = incidents.filter(i =>
      ['resolvido', 'fechado'].includes(i.status)
    ).length;

    // Calculate MTTR
    const resolvedWithTime = incidents.filter(i => i.resolution_time_hours != null);
    const avgMTTR =
      resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, i) => sum + i.resolution_time_hours, 0) /
          resolvedWithTime.length
        : 0;

    // Calculate average response time
    const respondedIncidents = incidents.filter(i => i.response_time_hours != null);
    const avgResponseTime =
      respondedIncidents.length > 0
        ? respondedIncidents.reduce((sum, i) => sum + i.response_time_hours, 0) /
          respondedIncidents.length
        : 0;

    // Calculate SLA compliance
    const slaEligible = incidents.filter(i => ['resolvido', 'fechado'].includes(i.status));
    const slaCompliant = slaEligible.filter(i => !i.sla_breach);
    const slaCompliance =
      slaEligible.length > 0 ? (slaCompliant.length / slaEligible.length) * 100 : 0;

    // Category breakdown
    const categoryMap = new Map<string, number>();
    incidents.forEach(i => {
      categoryMap.set(i.category, (categoryMap.get(i.category) || 0) + 1);
    });
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: (count / totalIncidents) * 100,
    }));

    // Severity breakdown
    const severityMap = new Map<string, number>();
    incidents.forEach(i => {
      severityMap.set(i.severity, (severityMap.get(i.severity) || 0) + 1);
    });
    const severityBreakdown = Array.from(severityMap.entries()).map(([severity, count]) => ({
      severity,
      count,
      percentage: (count / totalIncidents) * 100,
    }));

    // Team performance
    const teamPerformanceData = await this.dbAll(
      `
      SELECT
        assigned_team,
        AVG(resolution_time_hours) as avg_resolution_time,
        COUNT(CASE WHEN sla_breach = 0 THEN 1 END) * 100.0 / COUNT(*) as sla_compliance
      FROM incidents
      WHERE created_at BETWEEN ? AND ?
        AND assigned_team IS NOT NULL
        AND status IN ('resolvido', 'fechado')
        AND archived = FALSE
      GROUP BY assigned_team
    `,
      [timeRange.start.toISOString(), timeRange.end.toISOString()]
    );

    const teamPerformance = teamPerformanceData.map(t => ({
      team: t.assigned_team,
      avgResolutionTime: t.avg_resolution_time || 0,
      slaCompliance: t.sla_compliance || 0,
    }));

    // Daily trends
    const dailyTrendsData = await this.dbAll(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as new_incidents,
        COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_incidents,
        AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END) as mttr
      FROM incidents
      WHERE created_at BETWEEN ? AND ?
        AND archived = FALSE
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
      [timeRange.start.toISOString(), timeRange.end.toISOString()]
    );

    const dailyTrends = dailyTrendsData.map(d => ({
      date: d.date,
      newIncidents: d.new_incidents,
      resolvedIncidents: d.resolved_incidents,
      mttr: d.mttr || 0,
    }));

    return {
      totalIncidents,
      openIncidents,
      resolvedIncidents,
      avgMTTR,
      avgResponseTime,
      slaCompliance,
      categoryBreakdown,
      severityBreakdown,
      teamPerformance,
      dailyTrends,
    };
  }

  // ===== UTILITY METHODS =====

  private mapDatabaseToIncident(row: any): Incident {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      status: row.status,
      priority: row.priority,
      assigned_team: row.assigned_team,
      assigned_to: row.assigned_to,
      reporter: row.reporter,
      resolution: row.resolution,
      resolution_type: row.resolution_type,
      root_cause: row.root_cause,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      first_response_at: row.first_response_at ? new Date(row.first_response_at) : undefined,
      assigned_at: row.assigned_at ? new Date(row.assigned_at) : undefined,
      in_progress_at: row.in_progress_at ? new Date(row.in_progress_at) : undefined,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
      sla_breach: Boolean(row.sla_breach),
      sla_target_response_hours: row.sla_target_response_hours,
      sla_target_resolution_hours: row.sla_target_resolution_hours,
      resolution_time_hours: row.resolution_time_hours,
      response_time_hours: row.response_time_hours,
      escalation_count: row.escalation_count || 0,
      reopen_count: row.reopen_count || 0,
      related_kb_entries: row.related_kb_entries,
      ai_suggested_category: row.ai_suggested_category,
      ai_confidence_score: row.ai_confidence_score,
      ai_processed: Boolean(row.ai_processed),
      tags: row.tags,
      custom_fields: row.custom_fields,
      attachments: row.attachments,
      archived: Boolean(row.archived),
    };
  }

  async initializeDatabase(): Promise<void> {
    // This would execute the incident-schema.sql file
    // For now, just a placeholder
    console.log('Incident management database schema initialized');
  }
}

export default IncidentService;
