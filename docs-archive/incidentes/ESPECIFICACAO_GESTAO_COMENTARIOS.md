# Especificação: Sistema de Gestão de Comentários Ativos/Inativos

## Visão Geral
Sistema inteligente para gerenciar comentários em incidentes com estados ativos/inativos, otimizando o contexto para análise de LLM e melhorando a performance da aplicação.

## Objetivos
- Controlar quais comentários são enviados para análise de LLM
- Otimizar performance reduzindo dados desnecessários
- Manter histórico completo para auditoria
- Permitir reativação de comentários relevantes
- Integrar com sistema de logs categorizado

## Arquitetura do Sistema

### 1. Schema de Banco de Dados

#### Tabela: incident_comments (Extensão)
```sql
-- Adições à tabela existente incident_comments
ALTER TABLE incident_comments ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE incident_comments ADD COLUMN deactivated_at DATETIME NULL;
ALTER TABLE incident_comments ADD COLUMN deactivated_by INTEGER NULL;
ALTER TABLE incident_comments ADD COLUMN deactivation_reason TEXT NULL;
ALTER TABLE incident_comments ADD COLUMN llm_relevance_score REAL DEFAULT 1.0;
ALTER TABLE incident_comments ADD COLUMN auto_deactivation_rule VARCHAR(50) NULL;

-- Índices para performance
CREATE INDEX idx_incident_comments_active ON incident_comments(incident_id, is_active);
CREATE INDEX idx_incident_comments_relevance ON incident_comments(llm_relevance_score DESC);

-- Foreign key para rastreamento
ALTER TABLE incident_comments ADD CONSTRAINT fk_deactivated_by
    FOREIGN KEY (deactivated_by) REFERENCES users(id);
```

#### Tabela: comment_deactivation_rules
```sql
CREATE TABLE comment_deactivation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'age_based', 'relevance_based', 'keyword_based', 'manual'
    criteria JSON NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Dados iniciais
INSERT INTO comment_deactivation_rules (rule_name, rule_type, criteria, created_by) VALUES
('Comentários Antigos', 'age_based', '{"days": 30, "keep_if_referenced": true}', 1),
('Baixa Relevância LLM', 'relevance_based', '{"min_score": 0.3, "auto_deactivate": true}', 1),
('Comentários de Spam', 'keyword_based', '{"keywords": ["spam", "teste", "ignore"], "case_sensitive": false}', 1);
```

#### Tabela: comment_activation_history
```sql
CREATE TABLE comment_activation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'activated', 'deactivated'
    reason TEXT,
    rule_applied VARCHAR(100),
    performed_by INTEGER NOT NULL,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES incident_comments(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

CREATE INDEX idx_activation_history_comment ON comment_activation_history(comment_id);
CREATE INDEX idx_activation_history_date ON comment_activation_history(performed_at);
```

### 2. Serviços Backend

#### CommentManagementService.ts
```typescript
import { Database } from 'sqlite3';

export interface CommentActivationRule {
    id: number;
    rule_name: string;
    rule_type: 'age_based' | 'relevance_based' | 'keyword_based' | 'manual';
    criteria: any;
    is_enabled: boolean;
}

export interface CommentActivationHistory {
    id: number;
    comment_id: number;
    action: 'activated' | 'deactivated';
    reason?: string;
    rule_applied?: string;
    performed_by: number;
    performed_at: string;
}

export class CommentManagementService {
    constructor(private db: Database) {}

    // Desativar comentário
    async deactivateComment(
        commentId: number,
        reason: string,
        userId: number,
        ruleApplied?: string
    ): Promise<void> {
        const query = `
            UPDATE incident_comments
            SET is_active = false,
                deactivated_at = CURRENT_TIMESTAMP,
                deactivated_by = ?,
                deactivation_reason = ?,
                auto_deactivation_rule = ?
            WHERE id = ?
        `;

        await this.executeQuery(query, [userId, reason, ruleApplied, commentId]);

        // Registrar no histórico
        await this.logActivationChange(commentId, 'deactivated', reason, ruleApplied, userId);

        // Log de sistema
        await this.logSystemAction('COMMENT_DEACTIVATED', {
            comment_id: commentId,
            reason,
            rule_applied: ruleApplied
        });
    }

    // Reativar comentário
    async activateComment(commentId: number, reason: string, userId: number): Promise<void> {
        const query = `
            UPDATE incident_comments
            SET is_active = true,
                deactivated_at = NULL,
                deactivated_by = NULL,
                deactivation_reason = NULL,
                auto_deactivation_rule = NULL
            WHERE id = ?
        `;

        await this.executeQuery(query, [commentId]);

        // Registrar no histórico
        await this.logActivationChange(commentId, 'activated', reason, null, userId);

        // Log de sistema
        await this.logSystemAction('COMMENT_ACTIVATED', {
            comment_id: commentId,
            reason
        });
    }

    // Obter comentários ativos para LLM
    async getActiveCommentsForLLM(incidentId: number): Promise<any[]> {
        const query = `
            SELECT ic.*, u.username, u.full_name
            FROM incident_comments ic
            JOIN users u ON ic.user_id = u.id
            WHERE ic.incident_id = ?
                AND ic.is_active = true
            ORDER BY ic.llm_relevance_score DESC, ic.created_at ASC
        `;

        return this.executeQuery(query, [incidentId]);
    }

    // Aplicar regras de desativação automática
    async applyDeactivationRules(incidentId?: number): Promise<number> {
        const rules = await this.getActiveRules();
        let deactivatedCount = 0;

        for (const rule of rules) {
            switch (rule.rule_type) {
                case 'age_based':
                    deactivatedCount += await this.applyAgeBasedRule(rule, incidentId);
                    break;
                case 'relevance_based':
                    deactivatedCount += await this.applyRelevanceBasedRule(rule, incidentId);
                    break;
                case 'keyword_based':
                    deactivatedCount += await this.applyKeywordBasedRule(rule, incidentId);
                    break;
            }
        }

        return deactivatedCount;
    }

    // Regra baseada em idade
    private async applyAgeBasedRule(rule: CommentActivationRule, incidentId?: number): Promise<number> {
        const { days, keep_if_referenced } = rule.criteria;

        let whereClause = `
            WHERE ic.is_active = true
                AND ic.created_at <= datetime('now', '-${days} days')
        `;

        if (incidentId) {
            whereClause += ` AND ic.incident_id = ${incidentId}`;
        }

        if (keep_if_referenced) {
            whereClause += `
                AND ic.id NOT IN (
                    SELECT DISTINCT comment_id
                    FROM incident_relationships
                    WHERE comment_id IS NOT NULL
                )
            `;
        }

        const comments = await this.executeQuery(`
            SELECT ic.id FROM incident_comments ic ${whereClause}
        `);

        let count = 0;
        for (const comment of comments) {
            await this.deactivateComment(
                comment.id,
                `Regra automática: ${rule.rule_name}`,
                0, // Sistema
                rule.rule_name
            );
            count++;
        }

        return count;
    }

    // Regra baseada em relevância LLM
    private async applyRelevanceBasedRule(rule: CommentActivationRule, incidentId?: number): Promise<number> {
        const { min_score } = rule.criteria;

        let whereClause = `
            WHERE ic.is_active = true
                AND ic.llm_relevance_score < ${min_score}
        `;

        if (incidentId) {
            whereClause += ` AND ic.incident_id = ${incidentId}`;
        }

        const comments = await this.executeQuery(`
            SELECT ic.id FROM incident_comments ic ${whereClause}
        `);

        let count = 0;
        for (const comment of comments) {
            await this.deactivateComment(
                comment.id,
                `Baixa relevância LLM: ${comment.llm_relevance_score}`,
                0,
                rule.rule_name
            );
            count++;
        }

        return count;
    }

    // Atualizar score de relevância LLM
    async updateLLMRelevanceScore(commentId: number, score: number): Promise<void> {
        const query = `
            UPDATE incident_comments
            SET llm_relevance_score = ?
            WHERE id = ?
        `;

        await this.executeQuery(query, [score, commentId]);

        // Se score muito baixo, aplicar regras automaticamente
        if (score < 0.3) {
            await this.applyDeactivationRules();
        }
    }

    // Obter histórico de ativações
    async getActivationHistory(commentId?: number): Promise<CommentActivationHistory[]> {
        let query = `
            SELECT cah.*, u.username
            FROM comment_activation_history cah
            JOIN users u ON cah.performed_by = u.id
        `;

        const params: any[] = [];
        if (commentId) {
            query += ' WHERE cah.comment_id = ?';
            params.push(commentId);
        }

        query += ' ORDER BY cah.performed_at DESC';

        return this.executeQuery(query, params);
    }

    // Estatísticas de comentários
    async getCommentStatistics(incidentId?: number): Promise<any> {
        let whereClause = incidentId ? 'WHERE incident_id = ?' : '';
        const params = incidentId ? [incidentId] : [];

        const stats = await this.executeQuery(`
            SELECT
                COUNT(*) as total_comments,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_comments,
                COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_comments,
                AVG(llm_relevance_score) as avg_relevance_score,
                COUNT(CASE WHEN auto_deactivation_rule IS NOT NULL THEN 1 END) as auto_deactivated
            FROM incident_comments
            ${whereClause}
        `, params);

        return stats[0];
    }

    private async logActivationChange(
        commentId: number,
        action: 'activated' | 'deactivated',
        reason: string,
        ruleApplied: string | null,
        userId: number
    ): Promise<void> {
        const query = `
            INSERT INTO comment_activation_history
            (comment_id, action, reason, rule_applied, performed_by)
            VALUES (?, ?, ?, ?, ?)
        `;

        await this.executeQuery(query, [commentId, action, reason, ruleApplied, userId]);
    }

    private async logSystemAction(action: string, details: any): Promise<void> {
        // Integração com sistema de logs
        const LogService = await import('./LogService');
        await LogService.logAction(action, 'SYSTEM_ACTION', 0, details);
    }

    private async executeQuery(query: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    private async getActiveRules(): Promise<CommentActivationRule[]> {
        return this.executeQuery(`
            SELECT * FROM comment_deactivation_rules
            WHERE is_enabled = true
            ORDER BY rule_type, rule_name
        `);
    }
}
```

### 3. Componentes Frontend

#### CommentManagementPanel.tsx
```typescript
import React, { useState, useEffect } from 'react';
import { CommentActivationHistory } from '../services/CommentManagementService';
import './CommentManagementPanel.css';

interface CommentManagementPanelProps {
    incidentId: number;
    onCommentStatusChanged: () => void;
}

export const CommentManagementPanel: React.FC<CommentManagementPanelProps> = ({
    incidentId,
    onCommentStatusChanged
}) => {
    const [comments, setComments] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>({});
    const [history, setHistory] = useState<CommentActivationHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedComment, setSelectedComment] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, [incidentId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [commentsData, statsData, historyData] = await Promise.all([
                window.electron.ipcRenderer.invoke('comments:getAll', incidentId),
                window.electron.ipcRenderer.invoke('comments:getStatistics', incidentId),
                window.electron.ipcRenderer.invoke('comments:getActivationHistory', incidentId)
            ]);

            setComments(commentsData);
            setStatistics(statsData);
            setHistory(historyData);
        } catch (error) {
            console.error('Erro ao carregar dados de comentários:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCommentStatus = async (commentId: number, isActive: boolean) => {
        try {
            const reason = prompt(
                isActive
                    ? 'Motivo para desativar o comentário:'
                    : 'Motivo para reativar o comentário:'
            );

            if (!reason) return;

            if (isActive) {
                await window.electron.ipcRenderer.invoke('comments:deactivate', commentId, reason);
            } else {
                await window.electron.ipcRenderer.invoke('comments:activate', commentId, reason);
            }

            await loadData();
            onCommentStatusChanged();
        } catch (error) {
            console.error('Erro ao alterar status do comentário:', error);
        }
    };

    const applyDeactivationRules = async () => {
        try {
            const count = await window.electron.ipcRenderer.invoke(
                'comments:applyDeactivationRules',
                incidentId
            );

            alert(`${count} comentários foram desativados automaticamente.`);
            await loadData();
            onCommentStatusChanged();
        } catch (error) {
            console.error('Erro ao aplicar regras de desativação:', error);
        }
    };

    if (loading) {
        return <div className="loading-spinner">Carregando...</div>;
    }

    return (
        <div className="comment-management-panel">
            <div className="panel-header">
                <h3>Gestão de Comentários</h3>
                <div className="statistics">
                    <span className="stat">
                        Total: <strong>{statistics.total_comments || 0}</strong>
                    </span>
                    <span className="stat active">
                        Ativos: <strong>{statistics.active_comments || 0}</strong>
                    </span>
                    <span className="stat inactive">
                        Inativos: <strong>{statistics.inactive_comments || 0}</strong>
                    </span>
                    <span className="stat score">
                        Score Médio: <strong>{(statistics.avg_relevance_score || 0).toFixed(2)}</strong>
                    </span>
                </div>
            </div>

            <div className="panel-actions">
                <button
                    className="btn-primary"
                    onClick={applyDeactivationRules}
                    title="Aplicar regras automáticas de desativação"
                >
                    Aplicar Regras Automáticas
                </button>
            </div>

            <div className="comments-list">
                <h4>Comentários do Incidente</h4>
                {comments.map(comment => (
                    <div
                        key={comment.id}
                        className={`comment-item ${!comment.is_active ? 'inactive' : ''}`}
                    >
                        <div className="comment-header">
                            <span className="author">{comment.full_name}</span>
                            <span className="date">{new Date(comment.created_at).toLocaleString()}</span>
                            <span className="relevance-score">
                                Score: {comment.llm_relevance_score?.toFixed(2) || '1.00'}
                            </span>
                            <button
                                className={`status-toggle ${comment.is_active ? 'active' : 'inactive'}`}
                                onClick={() => toggleCommentStatus(comment.id, comment.is_active)}
                                title={comment.is_active ? 'Desativar comentário' : 'Reativar comentário'}
                            >
                                {comment.is_active ? 'Ativo' : 'Inativo'}
                            </button>
                        </div>

                        <div className="comment-content">
                            {comment.content}
                        </div>

                        {!comment.is_active && (
                            <div className="deactivation-info">
                                <span>Desativado por: {comment.deactivated_by_name}</span>
                                <span>Em: {new Date(comment.deactivated_at).toLocaleString()}</span>
                                <span>Motivo: {comment.deactivation_reason}</span>
                                {comment.auto_deactivation_rule && (
                                    <span>Regra: {comment.auto_deactivation_rule}</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {selectedComment && (
                <CommentHistoryModal
                    commentId={selectedComment}
                    onClose={() => setSelectedComment(null)}
                />
            )}
        </div>
    );
};

// Modal para histórico de ativações
const CommentHistoryModal: React.FC<{
    commentId: number;
    onClose: () => void;
}> = ({ commentId, onClose }) => {
    const [history, setHistory] = useState<CommentActivationHistory[]>([]);

    useEffect(() => {
        loadHistory();
    }, [commentId]);

    const loadHistory = async () => {
        try {
            const data = await window.electron.ipcRenderer.invoke(
                'comments:getActivationHistory',
                commentId
            );
            setHistory(data);
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Histórico de Ativações</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="history-list">
                    {history.map(item => (
                        <div key={item.id} className="history-item">
                            <div className="action">
                                <span className={`badge ${item.action}`}>
                                    {item.action === 'activated' ? 'Ativado' : 'Desativado'}
                                </span>
                            </div>
                            <div className="details">
                                <div>Por: {item.username}</div>
                                <div>Em: {new Date(item.performed_at).toLocaleString()}</div>
                                <div>Motivo: {item.reason}</div>
                                {item.rule_applied && (
                                    <div>Regra: {item.rule_applied}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
```

#### CommentManagementPanel.css
```css
.comment-management-panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 20px;
    margin: 20px 0;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 15px;
}

.statistics {
    display: flex;
    gap: 20px;
    align-items: center;
}

.stat {
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 0.9em;
    background: #f8f9fa;
}

.stat.active {
    background: #d4edda;
    color: #155724;
}

.stat.inactive {
    background: #f8d7da;
    color: #721c24;
}

.stat.score {
    background: #d1ecf1;
    color: #0c5460;
}

.panel-actions {
    margin-bottom: 20px;
}

.btn-primary {
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
}

.btn-primary:hover {
    background: #0056b3;
}

.comments-list {
    max-height: 500px;
    overflow-y: auto;
}

.comment-item {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 10px;
    transition: all 0.2s;
}

.comment-item.inactive {
    opacity: 0.6;
    background: #f8f8f8;
    border-color: #d0d0d0;
}

.comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 0.9em;
}

.author {
    font-weight: bold;
    color: #333;
}

.date {
    color: #666;
}

.relevance-score {
    background: #e9ecef;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8em;
}

.status-toggle {
    padding: 4px 12px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 0.8em;
    font-weight: bold;
}

.status-toggle.active {
    background: #28a745;
    color: white;
}

.status-toggle.inactive {
    background: #dc3545;
    color: white;
}

.comment-content {
    background: #f9f9f9;
    padding: 10px;
    border-radius: 4px;
    border-left: 4px solid #007bff;
    margin: 10px 0;
}

.deactivation-info {
    display: flex;
    gap: 15px;
    font-size: 0.8em;
    color: #666;
    background: #fff3cd;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #ffeaa7;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: #999;
}

.history-list {
    padding: 20px;
    overflow-y: auto;
}

.history-item {
    display: flex;
    gap: 15px;
    padding: 15px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    margin-bottom: 10px;
}

.badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: bold;
}

.badge.activated {
    background: #d4edda;
    color: #155724;
}

.badge.deactivated {
    background: #f8d7da;
    color: #721c24;
}

.details {
    flex: 1;
    font-size: 0.9em;
}

.details > div {
    margin-bottom: 4px;
    color: #666;
}

.loading-spinner {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    color: #666;
}
```

### 4. Handlers IPC

#### Extensão do IncidentHandler.ts
```typescript
// Adicionar ao IncidentHandler.ts existente

// Desativar comentário
ipcMain.handle('comments:deactivate', async (event, commentId: number, reason: string) => {
    try {
        const userId = await getCurrentUserId();
        await commentManagementService.deactivateComment(commentId, reason, userId);

        await logService.logAction('COMMENT_DEACTIVATED', 'USER_ACTION', userId, {
            comment_id: commentId,
            reason
        });

        return { success: true };
    } catch (error) {
        console.error('Erro ao desativar comentário:', error);
        throw error;
    }
});

// Reativar comentário
ipcMain.handle('comments:activate', async (event, commentId: number, reason: string) => {
    try {
        const userId = await getCurrentUserId();
        await commentManagementService.activateComment(commentId, reason, userId);

        await logService.logAction('COMMENT_ACTIVATED', 'USER_ACTION', userId, {
            comment_id: commentId,
            reason
        });

        return { success: true };
    } catch (error) {
        console.error('Erro ao reativar comentário:', error);
        throw error;
    }
});

// Obter comentários ativos para LLM
ipcMain.handle('comments:getActiveForLLM', async (event, incidentId: number) => {
    try {
        const comments = await commentManagementService.getActiveCommentsForLLM(incidentId);
        return comments;
    } catch (error) {
        console.error('Erro ao obter comentários ativos para LLM:', error);
        throw error;
    }
});

// Aplicar regras de desativação
ipcMain.handle('comments:applyDeactivationRules', async (event, incidentId?: number) => {
    try {
        const count = await commentManagementService.applyDeactivationRules(incidentId);

        await logService.logAction('DEACTIVATION_RULES_APPLIED', 'SYSTEM_ACTION', 0, {
            incident_id: incidentId,
            comments_deactivated: count
        });

        return count;
    } catch (error) {
        console.error('Erro ao aplicar regras de desativação:', error);
        throw error;
    }
});

// Obter estatísticas de comentários
ipcMain.handle('comments:getStatistics', async (event, incidentId?: number) => {
    try {
        const stats = await commentManagementService.getCommentStatistics(incidentId);
        return stats;
    } catch (error) {
        console.error('Erro ao obter estatísticas de comentários:', error);
        throw error;
    }
});

// Obter histórico de ativações
ipcMain.handle('comments:getActivationHistory', async (event, commentId?: number) => {
    try {
        const history = await commentManagementService.getActivationHistory(commentId);
        return history;
    } catch (error) {
        console.error('Erro ao obter histórico de ativações:', error);
        throw error;
    }
});

// Atualizar score de relevância LLM
ipcMain.handle('comments:updateRelevanceScore', async (event, commentId: number, score: number) => {
    try {
        await commentManagementService.updateLLMRelevanceScore(commentId, score);

        await logService.logAction('LLM_RELEVANCE_UPDATED', 'LLM_ACTION', 0, {
            comment_id: commentId,
            relevance_score: score
        });

        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar score de relevância:', error);
        throw error;
    }
});
```

### 5. Integração com LLM/Gemini

#### Extensão do LLMIntegrationService.ts
```typescript
// Adicionar ao serviço de integração LLM

import { CommentManagementService } from './CommentManagementService';

export class LLMIntegrationService {
    private commentManagementService: CommentManagementService;

    // Obter contexto otimizado para LLM
    async getOptimizedContextForLLM(incidentId: number): Promise<string> {
        // Obter apenas comentários ativos
        const activeComments = await this.commentManagementService.getActiveCommentsForLLM(incidentId);

        // Ordenar por relevância e data
        const sortedComments = activeComments.sort((a, b) => {
            if (a.llm_relevance_score !== b.llm_relevance_score) {
                return b.llm_relevance_score - a.llm_relevance_score;
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        // Construir contexto otimizado
        const context = sortedComments.map(comment => {
            return `[${comment.full_name}] (Score: ${comment.llm_relevance_score.toFixed(2)}): ${comment.content}`;
        }).join('\n\n');

        return context;
    }

    // Analisar e pontuar relevância dos comentários
    async analyzeCommentRelevance(incidentId: number): Promise<void> {
        const incident = await this.getIncident(incidentId);
        const allComments = await this.getAllComments(incidentId);

        for (const comment of allComments) {
            try {
                const relevanceScore = await this.calculateRelevanceScore(
                    incident,
                    comment,
                    allComments
                );

                await this.commentManagementService.updateLLMRelevanceScore(
                    comment.id,
                    relevanceScore
                );

                // Log da análise
                await this.logService.logAction('COMMENT_RELEVANCE_ANALYZED', 'LLM_ACTION', 0, {
                    comment_id: comment.id,
                    incident_id: incidentId,
                    old_score: comment.llm_relevance_score,
                    new_score: relevanceScore
                });

            } catch (error) {
                console.error(`Erro ao analisar relevância do comentário ${comment.id}:`, error);
            }
        }
    }

    private async calculateRelevanceScore(
        incident: any,
        comment: any,
        allComments: any[]
    ): Promise<number> {
        const prompt = `
        Analise a relevância do seguinte comentário para o incidente:

        INCIDENTE:
        Título: ${incident.title}
        Descrição: ${incident.description}
        Categoria: ${incident.category}
        Prioridade: ${incident.priority}

        COMENTÁRIO:
        Data: ${comment.created_at}
        Autor: ${comment.full_name}
        Conteúdo: ${comment.content}

        CONTEXTO (outros comentários):
        ${allComments.filter(c => c.id !== comment.id).map(c =>
            `- ${c.full_name}: ${c.content.substring(0, 100)}...`
        ).join('\n')}

        Retorne APENAS um número decimal entre 0.0 e 1.0 indicando a relevância:
        - 1.0: Extremamente relevante (solução, causa raiz, informação crítica)
        - 0.8: Muito relevante (informações importantes, análises úteis)
        - 0.6: Relevante (contexto útil, observações pertinentes)
        - 0.4: Pouco relevante (informações secundárias)
        - 0.2: Minimamente relevante (comentários administrativos)
        - 0.0: Irrelevante (spam, teste, off-topic)
        `;

        const response = await this.callLLMAPI(prompt);
        const score = parseFloat(response.trim());

        return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    }
}
```

### 6. Tarefas de Implementação

#### 6.1 Banco de Dados
- [ ] Executar scripts SQL para extensão das tabelas
- [ ] Criar índices para performance
- [ ] Implementar triggers para auditoria automática
- [ ] Migração dos dados existentes

#### 6.2 Backend
- [ ] Implementar CommentManagementService.ts
- [ ] Estender IncidentHandler.ts com novos handlers IPC
- [ ] Integrar com sistema de logs existente
- [ ] Implementar regras de desativação automática
- [ ] Criar testes unitários para o serviço

#### 6.3 Frontend
- [ ] Implementar CommentManagementPanel.tsx
- [ ] Criar estilos CSS responsivos
- [ ] Integrar com componentes existentes de incidentes
- [ ] Implementar modal de histórico
- [ ] Adicionar validações e feedback ao usuário

#### 6.4 Integração
- [ ] Integrar com sistema de LLM para análise de relevância
- [ ] Conectar com sistema de logs categorizado
- [ ] Implementar notificações de mudanças de status
- [ ] Criar relatórios de performance do sistema

### 7. Cronograma de Implementação

#### Semana 1: Infraestrutura
- Extensão do banco de dados
- Implementação do CommentManagementService
- Handlers IPC básicos

#### Semana 2: Frontend
- Componente CommentManagementPanel
- Interface de usuário
- Integração com componentes existentes

#### Semana 3: Automação e LLM
- Regras de desativação automática
- Integração com análise de LLM
- Sistema de pontuação de relevância

#### Semana 4: Testes e Refinamentos
- Testes unitários e de integração
- Performance e otimizações
- Documentação técnica

### 8. Métricas de Sucesso

1. **Performance**: Redução de 40-60% no volume de dados enviados para LLM
2. **Precisão**: 85%+ de comentários relevantes mantidos ativos
3. **Usabilidade**: Interface intuitiva com tempo de resposta < 2s
4. **Automação**: 70%+ de desativações realizadas por regras automáticas
5. **Auditoria**: 100% das alterações registradas no histórico

### 9. Considerações de Segurança

1. **Controle de Acesso**: Apenas usuários autorizados podem ativar/desativar
2. **Auditoria Completa**: Todos os eventos registrados com timestamp e usuário
3. **Reversibilidade**: Todas as desativações podem ser revertidas
4. **Backup**: Dados históricos preservados indefinidamente
5. **Validação**: Verificação de integridade dos dados em operações críticas

---

## Conclusão

Este sistema de gestão de comentários ativos/inativos oferece:

- **Otimização de Performance**: Redução significativa no volume de dados processados
- **Contexto Inteligente**: LLM recebe apenas informações relevantes
- **Automação Inteligente**: Regras configuráveis para desativação automática
- **Auditoria Completa**: Rastreabilidade total de todas as alterações
- **Interface Intuitiva**: Gestão visual simples e eficiente
- **Integração Perfeita**: Conecta-se com sistemas de logs e LLM existentes

A implementação seguirá as melhores práticas de desenvolvimento, garantindo escalabilidade, performance e facilidade de manutenção.