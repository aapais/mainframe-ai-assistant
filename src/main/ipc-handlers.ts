/**
 * IPC Handlers for Main Process
 * Simple electron IPC communication layer
 */

import { ipcMain } from 'electron';
import { KnowledgeService } from '../services/KnowledgeService';
import { SearchService } from '../services/SearchService';

let knowledgeService: KnowledgeService;
let searchService: SearchService;

export function setupIpcHandlers() {
  // Initialize services
  knowledgeService = new KnowledgeService();
  searchService = new SearchService();

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

  console.log('✅ IPC handlers registered successfully');
}