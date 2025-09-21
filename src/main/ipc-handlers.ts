/**
 * IPC Handlers for Main Process
 *
 * Unified IPC communication layer supporting both legacy and unified schema.
 * Automatically detects available schema and routes to appropriate handlers.
 */

import { ipcMain } from 'electron';
import { UnifiedHandler } from './ipc/handlers/UnifiedHandler';
import { KnowledgeService } from '../services/KnowledgeService';
import { SearchService } from '../services/SearchService';
import { AIService } from './services/AIService';
import { IncidentAIService, IncidentAnalysisResult, SemanticSearchOptions } from '../services/IncidentAIService';
import { DatabaseManager } from '../database/DatabaseManager';
import path from 'path';

// Database setup
const dbPath = path.join(process.cwd(), 'kb-assistant.db');
const dbManager = new DatabaseManager(dbPath);

// Handlers
let unifiedHandler: UnifiedHandler;
let knowledgeService: KnowledgeService;
let searchService: SearchService;
let aiService: AIService;
let incidentAIService: IncidentAIService;

export function setupIpcHandlers() {
  console.log('🚀 Setting up IPC handlers...');

  try {
    // Check if unified schema is available
    const hasUnifiedSchema = checkUnifiedSchemaAvailable(dbManager.db);

    if (hasUnifiedSchema) {
      console.log('📊 Using unified schema - initializing UnifiedHandler');
      unifiedHandler = new UnifiedHandler(dbManager.db);
      console.log('✅ UnifiedHandler initialized successfully');

      // Setup compatibility handlers for mixed environments
      setupCompatibilityHandlers();
    } else {
      console.log('🔄 Using legacy schema - setting up legacy handlers');
      setupLegacyHandlers();
    }

    console.log('✅ IPC handlers setup complete');
  } catch (error) {
    console.error('❌ Error setting up IPC handlers:', error);
    // Fallback to legacy handlers in case of any errors
    console.log('🔄 Falling back to legacy handlers...');
    setupLegacyHandlers();
    console.log('✅ Legacy fallback initialized successfully');
  }
}

/**
 * Check if the unified schema is available in the database
 */
function checkUnifiedSchemaAvailable(db: any): boolean {
  try {
    // Check for unified_entries table
    const unifiedTableExists = db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name='unified_entries'
    `).get();

    if (unifiedTableExists.count > 0) {
      console.log('🔍 Unified schema detected: unified_entries table found');
      return true;
    }

    // Check for entries table (alternative naming in unified schema)
    const entriesTableExists = db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name='entries'
    `).get();

    if (entriesTableExists.count > 0) {
      // Verify it has the entry_type column
      const hasEntryType = db.prepare(`
        SELECT COUNT(*) as count
        FROM pragma_table_info('entries')
        WHERE name='entry_type'
      `).get();

      if (hasEntryType.count > 0) {
        console.log('🔍 Unified schema detected: entries table with entry_type column found');
        return true;
      }
    }

    console.log('🔍 Legacy schema detected: using separate kb_entries table');
    return false;
  } catch (error) {
    console.warn('⚠️ Error checking schema availability:', error);
    return false;
  }
}

/**
 * Setup compatibility handlers for environments that might be in transition
 */
function setupCompatibilityHandlers(): void {
  // Health check handler for UI to determine which features are available
  ipcMain.handle('system:getCapabilities', async () => {
    return {
      unified_schema: unifiedHandler !== undefined,
      legacy_schema: !unifiedHandler,
      features: {
        unified_search: unifiedHandler !== undefined,
        cross_type_relationships: unifiedHandler !== undefined,
        advanced_analytics: unifiedHandler !== undefined,
        legacy_incident_management: true, // Always supported
        legacy_kb_management: true // Always supported
      },
      schema_version: unifiedHandler ? 'unified_v1' : 'legacy_v1'
    };
  });

  // Migration status handler
  ipcMain.handle('system:getMigrationStatus', async () => {
    if (!unifiedHandler) {
      return {
        status: 'not_started',
        can_migrate: true,
        current_schema: 'legacy',
        target_schema: 'unified'
      };
    }

    return {
      status: 'completed',
      can_migrate: false,
      current_schema: 'unified',
      target_schema: 'unified'
    };
  });

  // Database schema info handler
  ipcMain.handle('system:getSchemaInfo', async () => {
    try {
      const db = dbManager.db;

      // Get all tables
      const tables = db.prepare(`
        SELECT name, sql FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();

      // Get some basic counts
      const counts: any = {};

      for (const table of tables) {
        try {
          const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any;
          counts[table.name] = countResult.count;
        } catch (error) {
          counts[table.name] = 'error';
        }
      }

      return {
        tables: tables.map(t => ({ name: t.name, sql: t.sql })),
        record_counts: counts,
        schema_type: unifiedHandler ? 'unified' : 'legacy',
        database_path: dbPath
      };
    } catch (error) {
      console.error('Error getting schema info:', error);
      return {
        error: error.message,
        schema_type: unifiedHandler ? 'unified' : 'legacy'
      };
    }
  });

  console.log('✅ Compatibility handlers setup complete');
}

/**
 * Setup legacy handlers when unified schema is not available
 */
function setupLegacyHandlers(): void {
  // Initialize services
  knowledgeService = new KnowledgeService();
  searchService = new SearchService();

  // Initialize AI services (they handle their own availability checking)
  try {
    aiService = new AIService();
    if (aiService.isAvailable()) {
      const geminiService = aiService.getGeminiService();
      if (geminiService) {
        incidentAIService = new IncidentAIService(geminiService);
      }
    }
  } catch (error) {
    console.warn('AI services not available:', error.message);
  }

  // KB Entry Operations
  ipcMain.handle('kb:search', async (_, query: string) => {
    try {
      return await searchService.search(query);
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:getEntry', async (_, id: string) => {
    try {
      return await knowledgeService.getEntry(id);
    } catch (error) {
      console.error('Get entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:addEntry', async (_, entry: any) => {
    try {
      const result = await knowledgeService.addEntry(entry);
      return { success: true, data: result };
    } catch (error) {
      console.error('Add entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:updateEntry', async (_, id: string, entry: any) => {
    try {
      const result = await knowledgeService.updateEntry(id, entry);
      return { success: true, data: result };
    } catch (error) {
      console.error('Update entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:rateEntry', async (_, id: string, successful: boolean) => {
    try {
      await knowledgeService.rateEntry(id, successful);
      return { success: true };
    } catch (error) {
      console.error('Rate entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:getMetrics', async () => {
    try {
      const metrics = await knowledgeService.getMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      console.error('Get metrics error:', error);
      return { success: false, error: error.message };
    }
  });

  // Incident Management Operations

  // Update incident status
  ipcMain.handle('incident:updateStatus', async (_, id: string, status: string, userId: string) => {
    try {
      if (!id || !status || !userId) {
        return { success: false, error: 'ID, status e usuário são obrigatórios' };
      }

      const validStatuses = ['em_revisao', 'aberto', 'em_tratamento', 'resolvido', 'fechado'];
      if (!validStatuses.includes(status)) {
        return { success: false, error: 'Status inválido. Use: em_revisao, aberto, em_tratamento, resolvido, fechado' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      // Update status and log the action
      await db.db.prepare(`
        UPDATE kb_entries
        SET incident_status = ?,
            updated_at = CURRENT_TIMESTAMP,
            resolved_at = CASE WHEN ? = 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            resolved_by = CASE WHEN ? = 'resolvido' THEN ? ELSE resolved_by END,
            closed_at = CASE WHEN ? = 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END
        WHERE id = ?
      `).run(status, status, status, userId, status, id);

      // Log audit action
      await db.db.prepare(`
        INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, previous_values, new_values, change_description)
        VALUES (?, 'status_alterado', ?, ?, ?, ?)
      `).run(id, userId, JSON.stringify({status: 'previous'}), JSON.stringify({status}), `Status alterado para: ${status}`);

      return { success: true, message: 'Status do incidente atualizado com sucesso' };
    } catch (error) {
      console.error('Incident status update error:', error);
      return { success: false, error: 'Erro ao atualizar status do incidente: ' + error.message };
    }
  });

  // Assign incident to user
  ipcMain.handle('incident:assign', async (_, id: string, assignedTo: string, assignedBy: string) => {
    try {
      if (!id || !assignedTo || !assignedBy) {
        return { success: false, error: 'ID, usuário atribuído e usuário responsável pela atribuição são obrigatórios' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      await db.db.prepare(`
        UPDATE kb_entries
        SET assigned_to = ?,
            updated_at = CURRENT_TIMESTAMP,
            incident_status = CASE WHEN incident_status = 'em_revisao' THEN 'em_tratamento' ELSE incident_status END
        WHERE id = ?
      `).run(assignedTo, id);

      // Log audit action
      await db.db.prepare(`
        INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, new_values, change_description)
        VALUES (?, 'atribuido', ?, ?, ?)
      `).run(id, assignedBy, JSON.stringify({assigned_to: assignedTo}), `Incidente atribuído para: ${assignedTo}`);

      return { success: true, message: 'Incidente atribuído com sucesso' };
    } catch (error) {
      console.error('Incident assignment error:', error);
      return { success: false, error: 'Erro ao atribuir incidente: ' + error.message };
    }
  });

  // Add comment to incident
  ipcMain.handle('incident:addComment', async (_, entryId: string, commentText: string, userId: string, commentType = 'user') => {
    try {
      if (!entryId || !commentText || !userId) {
        return { success: false, error: 'ID do incidente, texto do comentário e usuário são obrigatórios' };
      }

      if (commentText.length > 2000) {
        return { success: false, error: 'Comentário muito longo. Máximo de 2000 caracteres' };
      }

      const validTypes = ['user', 'system', 'ai'];
      if (!validTypes.includes(commentType)) {
        return { success: false, error: 'Tipo de comentário inválido' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      const commentResult = await db.db.prepare(`
        INSERT INTO kb_entry_comments (entry_id, comment_text, comment_type, created_by)
        VALUES (?, ?, ?, ?)
      `).run(entryId, commentText, commentType, userId);

      // Log audit action
      await db.db.prepare(`
        INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, new_values, change_description)
        VALUES (?, 'comentario_adicionado', ?, ?, ?)
      `).run(entryId, userId, JSON.stringify({comment_id: commentResult.lastInsertRowid, comment_type: commentType}), 'Comentário adicionado');

      return { success: true, data: { commentId: commentResult.lastInsertRowid }, message: 'Comentário adicionado com sucesso' };
    } catch (error) {
      console.error('Add comment error:', error);
      return { success: false, error: 'Erro ao adicionar comentário: ' + error.message };
    }
  });

  // Get comments for incident
  ipcMain.handle('incident:getComments', async (_, entryId: string) => {
    try {
      if (!entryId) {
        return { success: false, error: 'ID do incidente é obrigatório' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      const comments = await db.db.prepare(`
        SELECT id, comment_text, comment_type, created_by, created_at, updated_at
        FROM kb_entry_comments
        WHERE entry_id = ? AND is_active = TRUE
        ORDER BY created_at ASC
      `).all(entryId);

      return { success: true, data: comments };
    } catch (error) {
      console.error('Get comments error:', error);
      return { success: false, error: 'Erro ao buscar comentários: ' + error.message };
    }
  });

  // Get related incidents
  ipcMain.handle('incident:getRelated', async (_, entryId: string) => {
    try {
      if (!entryId) {
        return { success: false, error: 'ID do incidente é obrigatório' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      const related = await db.db.prepare(`
        SELECT
          r.related_id,
          r.similarity_score,
          r.relation_type,
          r.found_by,
          k.title,
          k.category,
          k.incident_status,
          k.created_at
        FROM kb_entry_related r
        JOIN kb_entries k ON r.related_id = k.id
        WHERE r.entry_id = ?
        ORDER BY r.similarity_score DESC
      `).all(entryId);

      return { success: true, data: related };
    } catch (error) {
      console.error('Get related incidents error:', error);
      return { success: false, error: 'Erro ao buscar incidentes relacionados: ' + error.message };
    }
  });

  // Request AI analysis for incident
  ipcMain.handle('incident:requestAIAnalysis', async (_, entryId: string, userId: string) => {
    try {
      if (!entryId || !userId) {
        return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      await db.db.prepare(`
        UPDATE kb_entries
        SET ai_analysis_requested = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(entryId);

      // Log audit action
      await db.db.prepare(`
        INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, change_description)
        VALUES (?, 'analise_ia_solicitada', ?, 'Análise de IA solicitada')
      `).run(entryId, userId);

      return { success: true, message: 'Análise de IA solicitada com sucesso' };
    } catch (error) {
      console.error('Request AI analysis error:', error);
      return { success: false, error: 'Erro ao solicitar análise de IA: ' + error.message };
    }
  });

  // Accept AI solution
  ipcMain.handle('incident:acceptSolution', async (_, entryId: string, userId: string, rating?: number) => {
    try {
      if (!entryId || !userId) {
        return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
      }

      if (rating && (rating < 1 || rating > 5)) {
        return { success: false, error: 'Avaliação deve ser entre 1 e 5' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      await db.db.prepare(`
        UPDATE kb_entries
        SET solution_accepted = TRUE,
            solution_rating = ?,
            incident_status = 'resolvido',
            resolved_by = ?,
            resolved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(rating || null, userId, entryId);

      // Log audit action
      await db.db.prepare(`
        INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, new_values, change_description)
        VALUES (?, 'solucao_aceita', ?, ?, 'Solução aceita e incidente resolvido')
      `).run(entryId, userId, JSON.stringify({solution_accepted: true, rating: rating || null}));

      return { success: true, message: 'Solução aceita e incidente resolvido com sucesso' };
    } catch (error) {
      console.error('Accept solution error:', error);
      return { success: false, error: 'Erro ao aceitar solução: ' + error.message };
    }
  });

  // Reject AI solution
  ipcMain.handle('incident:rejectSolution', async (_, entryId: string, userId: string, reason?: string) => {
    try {
      if (!entryId || !userId) {
        return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      await db.db.prepare(`
        UPDATE kb_entries
        SET solution_accepted = FALSE,
            ai_analysis_requested = FALSE,
            ai_analysis_completed = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(entryId);

      // Add comment with rejection reason if provided
      if (reason) {
        await db.db.prepare(`
          INSERT INTO kb_entry_comments (entry_id, comment_text, comment_type, created_by)
          VALUES (?, ?, 'system', ?)
        `).run(entryId, `Solução rejeitada: ${reason}`, userId);
      }

      // Log audit action
      await db.db.prepare(`
        INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, new_values, change_description)
        VALUES (?, 'solucao_rejeitada', ?, ?, ?)
      `).run(entryId, userId, JSON.stringify({solution_accepted: false, reason: reason || null}), 'Solução rejeitada');

      return { success: true, message: 'Solução rejeitada com sucesso' };
    } catch (error) {
      console.error('Reject solution error:', error);
      return { success: false, error: 'Erro ao rejeitar solução: ' + error.message };
    }
  });

  // Bulk import placeholder
  ipcMain.handle('incident:bulkImport', async (_, data: any[], userId: string) => {
    try {
      if (!data || !Array.isArray(data) || !userId) {
        return { success: false, error: 'Dados de importação e usuário são obrigatórios' };
      }

      // TODO: Implement bulk import logic
      // For now, return placeholder response
      return {
        success: true,
        message: 'Funcionalidade de importação em massa em desenvolvimento',
        data: {
          imported: 0,
          failed: 0,
          total: data.length
        }
      };
    } catch (error) {
      console.error('Bulk import error:', error);
      return { success: false, error: 'Erro na importação em massa: ' + error.message };
    }
  });

  // Get incident queue with filters
  ipcMain.handle('incident:getQueue', async (_, filters: {
    status?: string;
    assignedTo?: string;
    category?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    try {
      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.status) {
        whereClause += ' AND incident_status = ?';
        params.push(filters.status);
      }

      if (filters.assignedTo) {
        whereClause += ' AND assigned_to = ?';
        params.push(filters.assignedTo);
      }

      if (filters.category) {
        whereClause += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.severity) {
        whereClause += ' AND severity = ?';
        params.push(filters.severity);
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const incidents = await db.db.prepare(`
        SELECT
          id, title, problem, category, severity, incident_status,
          assigned_to, created_at, updated_at, created_by
        FROM kb_entries
        ${whereClause}
        ORDER BY
          CASE incident_status
            WHEN 'aberto' THEN 1
            WHEN 'em_tratamento' THEN 2
            WHEN 'em_revisao' THEN 3
            WHEN 'resolvido' THEN 4
            WHEN 'fechado' THEN 5
          END,
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      return { success: true, data: incidents };
    } catch (error) {
      console.error('Get incident queue error:', error);
      return { success: false, error: 'Erro ao buscar fila de incidentes: ' + error.message };
    }
  });

  // Get incident statistics
  ipcMain.handle('incident:getStats', async (_) => {
    try {
      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      const stats = await db.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN incident_status = 'aberto' THEN 1 ELSE 0 END) as aberto,
          SUM(CASE WHEN incident_status = 'em_tratamento' THEN 1 ELSE 0 END) as em_tratamento,
          SUM(CASE WHEN incident_status = 'em_revisao' THEN 1 ELSE 0 END) as em_revisao,
          SUM(CASE WHEN incident_status = 'resolvido' THEN 1 ELSE 0 END) as resolvido,
          SUM(CASE WHEN incident_status = 'fechado' THEN 1 ELSE 0 END) as fechado,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
          SUM(CASE WHEN ai_analysis_requested = TRUE THEN 1 ELSE 0 END) as ai_analysis_requested,
          SUM(CASE WHEN solution_accepted = TRUE THEN 1 ELSE 0 END) as solution_accepted
        FROM kb_entries
      `).get();

      return { success: true, data: stats };
    } catch (error) {
      console.error('Get incident stats error:', error);
      return { success: false, error: 'Erro ao buscar estatísticas de incidentes: ' + error.message };
    }
  });

  // Log action for audit trail
  ipcMain.handle('incident:logAction', async (_, entryId: string, actionType: string, userId: string, description?: string, metadata?: any) => {
    try {
      if (!entryId || !actionType || !userId) {
        return { success: false, error: 'ID do incidente, tipo de ação e usuário são obrigatórios' };
      }

      const validActions = [
        'criado', 'editado', 'status_alterado', 'atribuido',
        'comentario_adicionado', 'comentario_removido',
        'solucao_aceita', 'solucao_rejeitada', 'analise_ia_solicitada',
        'fechado', 'reaberto', 'duplicado', 'relacionado_adicionado'
      ];

      if (!validActions.includes(actionType)) {
        return { success: false, error: 'Tipo de ação inválido' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      await db.db.prepare(`
        INSERT INTO kb_entry_audit (
          entry_id, action_type, performed_by, change_description,
          new_values, session_id, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        entryId,
        actionType,
        userId,
        description || '',
        metadata ? JSON.stringify(metadata) : null,
        'ipc-session', // Default session ID
        '127.0.0.1' // Default local IP
      );

      return { success: true, message: 'Ação registrada no log de auditoria' };
    } catch (error) {
      console.error('Log action error:', error);
      return { success: false, error: 'Erro ao registrar ação: ' + error.message };
    }
  });

  // AI-powered incident operations

  // Complete AI analysis of an incident
  ipcMain.handle('incident:requestAIAnalysis', async (_, entryId: string, userId: string) => {
    try {
      if (!entryId || !userId) {
        return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
      }

      if (!incidentAIService) {
        return { success: false, error: 'Serviço de IA não está disponível' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      // Get the incident details
      const incident = await db.db.prepare(`
        SELECT * FROM kb_entries WHERE id = ?
      `).get(entryId);

      if (!incident) {
        return { success: false, error: 'Incidente não encontrado' };
      }

      // Request authorization before proceeding
      const authRequest = {
        id: `ai-analysis-${entryId}-${Date.now()}`,
        operationType: 'analyze_incident' as const,
        operationDescription: 'Análise completa de IA para incidente',
        query: `Analisar incidente: ${incident.title}`,
        estimates: {
          estimatedTokens: 2500,
          estimatedCostUSD: 0.015,
          estimatedTimeSeconds: { min: 10, max: 30, typical: 20 },
          confidence: 0.85,
          costBreakdown: {
            inputTokens: { count: 1500, rate: 0.00001, costUSD: 0.015 },
            outputTokens: { count: 1000, rate: 0.00003, costUSD: 0.03 },
            apiOverhead: 0.001,
            serviceFees: 0.001
          }
        },
        dataContext: {
          dataFields: [
            { name: 'título', type: 'string', sensitivity: 'internal', preview: incident.title?.substring(0, 50) },
            { name: 'problema', type: 'text', sensitivity: 'internal', preview: incident.problem?.substring(0, 100) },
            { name: 'categoria', type: 'string', sensitivity: 'public', preview: incident.category }
          ],
          dataSizeBytes: JSON.stringify(incident).length,
          containsPII: false,
          isConfidential: false
        },
        fallbackOptions: [
          {
            id: 'local-analysis',
            name: 'Análise Local',
            description: 'Usar análise baseada em regras locais sem IA',
            recommended: true,
            performance: { speed: 'high', accuracy: 'medium', coverage: 'medium' },
            limitations: ['Análise limitada a padrões conhecidos', 'Sem aprendizado contextual']
          }
        ]
      };

      // Store the request for authorization
      await db.db.prepare(`
        INSERT INTO ai_operations (
          operation_id, operation_type, entry_id, user_id,
          estimated_cost, estimated_tokens, status, request_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        authRequest.id,
        'analyze_incident',
        entryId,
        userId,
        authRequest.estimates.estimatedCostUSD,
        authRequest.estimates.estimatedTokens,
        'pending_authorization',
        JSON.stringify(authRequest)
      );

      return {
        success: true,
        data: { authRequest },
        message: 'Autorização necessária para análise de IA'
      };
    } catch (error) {
      console.error('Request AI analysis error:', error);
      return { success: false, error: 'Erro ao solicitar análise de IA: ' + error.message };
    }
  });

  // Execute AI analysis after authorization
  ipcMain.handle('incident:executeAIAnalysis', async (_, operationId: string, userId: string) => {
    try {
      if (!operationId || !userId) {
        return { success: false, error: 'ID da operação e usuário são obrigatórios' };
      }

      if (!incidentAIService) {
        return { success: false, error: 'Serviço de IA não está disponível' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      // Get the operation details
      const operation = await db.db.prepare(`
        SELECT * FROM ai_operations WHERE operation_id = ? AND user_id = ?
      `).get(operationId, userId);

      if (!operation || operation.status !== 'authorized') {
        return { success: false, error: 'Operação não autorizada ou não encontrada' };
      }

      // Get the incident
      const incident = await db.db.prepare(`
        SELECT * FROM kb_entries WHERE id = ?
      `).get(operation.entry_id);

      if (!incident) {
        return { success: false, error: 'Incidente não encontrado' };
      }

      // Update operation status
      await db.db.prepare(`
        UPDATE ai_operations
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
        WHERE operation_id = ?
      `).run(operationId);

      try {
        // Perform AI analysis
        const analysis: IncidentAnalysisResult = await incidentAIService.analyzeIncident(incident);

        // Store the analysis result
        await db.db.prepare(`
          UPDATE ai_operations
          SET status = 'completed',
              completed_at = CURRENT_TIMESTAMP,
              result_data = ?,
              actual_tokens = ?,
              actual_cost = ?
          WHERE operation_id = ?
        `).run(
          JSON.stringify(analysis),
          operation.estimated_tokens, // Would be actual tokens from API
          operation.estimated_cost,   // Would be actual cost from API
          operationId
        );

        // Update incident with AI analysis flag
        await db.db.prepare(`
          UPDATE kb_entries
          SET ai_analysis_completed = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(operation.entry_id);

        // Log audit action
        await db.db.prepare(`
          INSERT INTO kb_entry_audit (entry_id, action_type, performed_by, change_description, new_values)
          VALUES (?, 'analise_ia_completada', ?, 'Análise de IA completada com sucesso', ?)
        `).run(operation.entry_id, userId, JSON.stringify({ operation_id: operationId }));

        return { success: true, data: analysis, message: 'Análise de IA completada com sucesso' };
      } catch (analysisError) {
        // Update operation status on failure
        await db.db.prepare(`
          UPDATE ai_operations
          SET status = 'failed',
              completed_at = CURRENT_TIMESTAMP,
              error_message = ?
          WHERE operation_id = ?
        `).run(analysisError.message, operationId);

        throw analysisError;
      }
    } catch (error) {
      console.error('Execute AI analysis error:', error);
      return { success: false, error: 'Erro ao executar análise de IA: ' + error.message };
    }
  });

  // Semantic search for related incidents
  ipcMain.handle('incident:semanticSearch', async (_, query: string, options: SemanticSearchOptions, userId: string) => {
    try {
      if (!query || !userId) {
        return { success: false, error: 'Consulta de busca e usuário são obrigatórios' };
      }

      if (!incidentAIService) {
        return { success: false, error: 'Serviço de IA não está disponível' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      // Get all incidents for semantic analysis
      let whereClause = 'WHERE archived = FALSE';
      const params: any[] = [];

      if (options.categoryFilter && options.categoryFilter.length > 0) {
        whereClause += ` AND category IN (${options.categoryFilter.map(() => '?').join(',')})`;
        params.push(...options.categoryFilter);
      }

      if (!options.includeResolved) {
        whereClause += ' AND incident_status NOT IN (?, ?)';
        params.push('resolvido', 'fechado');
      }

      const incidents = await db.db.prepare(`
        SELECT * FROM kb_entries ${whereClause}
        ORDER BY created_at DESC
        LIMIT 100
      `).all(...params);

      // Create a dummy incident for search
      const searchIncident = {
        id: 'search-query',
        title: query,
        problem: query,
        category: '',
        solution: ''
      };

      const relatedIncidents = await incidentAIService.findRelatedIncidents(searchIncident, options);

      // Log the search operation
      await db.db.prepare(`
        INSERT INTO search_history (
          query, normalized_query, results_count, user_id,
          search_time_ms, ai_used, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        query,
        query.toLowerCase(),
        relatedIncidents.length,
        userId,
        0, // Would measure actual time
        true
      );

      return { success: true, data: relatedIncidents };
    } catch (error) {
      console.error('Semantic search error:', error);
      return { success: false, error: 'Erro na busca semântica: ' + error.message };
    }
  });

  // Get AI solution suggestions
  ipcMain.handle('incident:suggestSolution', async (_, entryId: string, context: any, userId: string) => {
    try {
      if (!entryId || !userId) {
        return { success: false, error: 'ID do incidente e usuário são obrigatórios' };
      }

      if (!incidentAIService) {
        return { success: false, error: 'Serviço de IA não está disponível' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      // Get the incident
      const incident = await db.db.prepare(`
        SELECT * FROM kb_entries WHERE id = ?
      `).get(entryId);

      if (!incident) {
        return { success: false, error: 'Incidente não encontrado' };
      }

      const suggestions = await incidentAIService.suggestSolution({
        incident,
        previousAttempts: context?.previousAttempts || [],
        context: context?.additionalContext || '',
        urgency: context?.urgency || 'media'
      });

      // Add comment with AI suggestions
      await db.db.prepare(`
        INSERT INTO kb_entry_comments (entry_id, comment_text, comment_type, created_by)
        VALUES (?, ?, 'ai', ?)
      `).run(
        entryId,
        `IA sugeriu ${suggestions.length} possíveis soluções`,
        userId
      );

      return { success: true, data: suggestions };
    } catch (error) {
      console.error('Suggest solution error:', error);
      return { success: false, error: 'Erro ao sugerir soluções: ' + error.message };
    }
  });

  // Authorize AI operation
  ipcMain.handle('incident:authorizeAI', async (_, operationId: string, decision: string, userId: string) => {
    try {
      if (!operationId || !decision || !userId) {
        return { success: false, error: 'ID da operação, decisão e usuário são obrigatórios' };
      }

      const validDecisions = ['approved', 'denied', 'local_only'];
      if (!validDecisions.includes(decision)) {
        return { success: false, error: 'Decisão inválida' };
      }

      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Serviço de banco de dados não disponível' };
      }

      const newStatus = decision === 'approved' ? 'authorized' :
                       decision === 'denied' ? 'denied' : 'local_fallback';

      await db.db.prepare(`
        UPDATE ai_operations
        SET status = ?, authorized_by = ?, authorized_at = CURRENT_TIMESTAMP
        WHERE operation_id = ?
      `).run(newStatus, userId, operationId);

      return { success: true, message: `Operação ${decision === 'approved' ? 'autorizada' : 'negada'} com sucesso` };
    } catch (error) {
      console.error('Authorize AI error:', error);
      return { success: false, error: 'Erro ao autorizar operação de IA: ' + error.message };
    }
  });

  // AI Settings handlers
  ipcMain.handle('settings:get-ai', async () => {
    try {
      const db = knowledgeService.getDatabase();
      if (!db) {
        return {
          apiKey: process.env.GEMINI_API_KEY || '',
          autoApproveLimit: '0.01',
          dailyBudget: '5.00',
          monthlyBudget: '100.00',
          requireAuth: true
        };
      }

      // Get AI preferences from database
      const preferences = await db.db.prepare(`
        SELECT * FROM ai_preferences WHERE user_id = 'system'
      `).get();

      return {
        apiKey: process.env.GEMINI_API_KEY || preferences?.api_key || '',
        autoApproveLimit: preferences?.auto_approve_limit || '0.01',
        dailyBudget: preferences?.daily_budget || '5.00',
        monthlyBudget: preferences?.monthly_budget || '100.00',
        requireAuth: preferences?.require_auth !== false
      };
    } catch (error) {
      console.error('Error getting AI settings:', error);
      return null;
    }
  });

  ipcMain.handle('settings:save-ai-key', async (_, apiKey: string) => {
    try {
      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Database não disponível' };
      }

      // Guardar API key na base de dados
      await db.db.prepare(`
        INSERT OR REPLACE INTO ai_preferences (user_id, api_key, updated_at)
        VALUES ('system', ?, CURRENT_TIMESTAMP)
      `).run(apiKey);

      // Também definir como variável de ambiente para o serviço
      process.env.GEMINI_API_KEY = apiKey;

      // Reinicializar o serviço AI se existir
      if (aiService) {
        // Reinitialize AI service with new API key
        process.env.GEMINI_API_KEY = apiKey;
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving API key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:save-ai-budgets', async (_, budgets) => {
    try {
      const db = knowledgeService.getDatabase();
      if (!db) {
        return { success: false, error: 'Database não disponível' };
      }

      await db.db.prepare(`
        INSERT OR REPLACE INTO ai_preferences
        (user_id, auto_approve_limit, daily_budget, monthly_budget, require_auth, updated_at)
        VALUES ('system', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        budgets.autoApproveLimit,
        budgets.dailyBudget,
        budgets.monthlyBudget,
        budgets.requireAuth ? 1 : 0
      );

      return { success: true };
    } catch (error) {
      console.error('Error saving AI budgets:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:check-status', async () => {
    try {
      if (!aiService) {
        return { available: false };
      }

      const geminiService = (aiService as any).getGeminiService();
      const isAvailable = geminiService && geminiService.isAvailable();

      return { available: isAvailable };
    } catch (error) {
      console.error('Error checking AI status:', error);
      return { available: false };
    }
  });

  ipcMain.handle('ai:test-connection', async () => {
    try {
      if (!aiService) {
        return { success: false, error: 'Serviço de IA não disponível' };
      }

      const geminiService = (aiService as any).getGeminiService();
      if (!geminiService || !geminiService.isAvailable()) {
        return { success: false, error: 'Gemini não está configurado. Adicione uma API key.' };
      }

      // Fazer um teste simples com o Gemini
      const testResult = await geminiService.generateSummary('Teste de conexão');

      if (testResult) {
        return { success: true };
      } else {
        return { success: false, error: 'Falha na comunicação com o Gemini' };
      }
    } catch (error) {
      console.error('Error testing AI connection:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Legacy IPC handlers registered successfully');
}

// Export handlers for potential external use
export { unifiedHandler, knowledgeService, searchService, aiService, incidentAIService, dbManager };

// Graceful shutdown handler
export function shutdownIPCHandlers(): void {
  console.log('🔄 Shutting down IPC handlers...');

  try {
    // Close database connections
    if (dbManager) {
      dbManager.close();
    }

    console.log('✅ IPC handlers shutdown complete');
  } catch (error) {
    console.error('❌ Error during IPC handlers shutdown:', error);
  }
}