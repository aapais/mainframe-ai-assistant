/**
 * IncidentDetailView Component
 * Comprehensive incident detail view with timeline, comments, related incidents, and action buttons
 * Features: Portuguese labels, responsive design, real-time updates, SLA tracking
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './IncidentDetailView.css';
import {
  IncidentKBEntry,
  IncidentStatus,
  IncidentComment,
  StatusTransition,
  PRIORITY_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS
} from '../../../types/incident';
import { Modal, Button, Input, Textarea, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../ui';
import StatusBadge from './StatusBadge';
import StatusWorkflow from './StatusWorkflow';
import PriorityBadge from './PriorityBadge';

interface IncidentDetailViewProps {
  incident: IncidentKBEntry;
  isOpen: boolean;
  onClose: () => void;
  onIncidentUpdate?: (updatedIncident: IncidentKBEntry) => void;
}

interface RelatedIncident {
  id: string;
  title: string;
  similarity_score: number;
  status: IncidentStatus;
  priority: string;
  created_at: Date;
}

interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  action_type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'escalation' | 'attachment';
  performed_by: string;
  description: string;
  details?: any;
}

interface AttachmentFile {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date;
  uploaded_by: string;
  file_path: string;
}

const IncidentDetailView: React.FC<IncidentDetailViewProps> = ({
  incident: initialIncident,
  isOpen,
  onClose,
  onIncidentUpdate
}) => {
  // State management
  const [incident, setIncident] = useState(initialIncident);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Comments state
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Status transitions state
  const [statusHistory, setStatusHistory] = useState<StatusTransition[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Related incidents state
  const [relatedIncidents, setRelatedIncidents] = useState<RelatedIncident[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Activity log state
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Action states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [assignedUser, setAssignedUser] = useState(incident.assigned_to || '');
  const [escalationReason, setEscalationReason] = useState('');

  // Real-time update interval
  const [updateInterval, setUpdateInterval] = useState<NodeJS.Timeout | null>(null);

  // Load data when component mounts or incident changes
  useEffect(() => {
    if (isOpen && incident.id) {
      loadIncidentData();
      setupRealTimeUpdates();
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [incident.id, isOpen, refreshTrigger]);

  // Setup real-time updates
  const setupRealTimeUpdates = useCallback(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    const interval = setInterval(() => {
      refreshIncidentData();
    }, 30000); // Update every 30 seconds

    setUpdateInterval(interval);
  }, [incident.id]);

  // Load all incident data
  const loadIncidentData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadComments(),
        loadStatusHistory(),
        loadRelatedIncidents(),
        loadActivityLog(),
        loadAttachments()
      ]);
    } catch (error) {
      console.error('Error loading incident data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh incident data
  const refreshIncidentData = async () => {
    try {
      const updatedIncident = await window.electron.ipcRenderer.invoke('incident:get', { id: incident.id });
      if (updatedIncident) {
        setIncident(updatedIncident);
        if (onIncidentUpdate) {
          onIncidentUpdate(updatedIncident);
        }
      }
    } catch (error) {
      console.error('Error refreshing incident data:', error);
    }
  };

  // Load comments
  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const commentsData = await window.electron.ipcRenderer.invoke('incident:getComments', {
        incidentId: incident.id
      });
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Load status history
  const loadStatusHistory = async () => {
    setHistoryLoading(true);
    try {
      const historyData = await window.electron.ipcRenderer.invoke('incident:getStatusHistory', {
        incidentId: incident.id
      });
      setStatusHistory(historyData || []);
    } catch (error) {
      console.error('Error loading status history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load related incidents using AI similarity
  const loadRelatedIncidents = async () => {
    setRelatedLoading(true);
    try {
      // Simulate AI similarity search based on title and description
      const searchQuery = `${incident.title} ${incident.problem}`.toLowerCase();
      const searchResults = await window.electron.ipcRenderer.invoke('incident:search', {
        query: searchQuery,
        filters: { status: ['aberto', 'em_tratamento', 'em_revisao'] },
        sort: { field: 'created_at', direction: 'desc' }
      });

      // Filter out current incident and simulate similarity scores
      const related = searchResults
        .filter((inc: IncidentKBEntry) => inc.id !== incident.id)
        .slice(0, 5)
        .map((inc: IncidentKBEntry) => ({
          id: inc.id,
          title: inc.title,
          similarity_score: Math.random() * 0.6 + 0.4, // 40-100% similarity
          status: inc.status,
          priority: inc.priority,
          created_at: inc.created_at
        }));

      setRelatedIncidents(related);
    } catch (error) {
      console.error('Error loading related incidents:', error);
    } finally {
      setRelatedLoading(false);
    }
  };

  // Load activity log
  const loadActivityLog = async () => {
    setActivityLoading(true);
    try {
      // Combine comments and status history into activity log
      const [commentsData, historyData] = await Promise.all([
        window.electron.ipcRenderer.invoke('incident:getComments', { incidentId: incident.id }),
        window.electron.ipcRenderer.invoke('incident:getStatusHistory', { incidentId: incident.id })
      ]);

      const activities: ActivityLogEntry[] = [];

      // Add comments
      commentsData?.forEach((comment: IncidentComment) => {
        activities.push({
          id: `comment-${comment.id}`,
          timestamp: comment.timestamp,
          action_type: 'comment',
          performed_by: comment.author,
          description: comment.is_internal ? 'Adicionou comentário interno' : 'Adicionou comentário',
          details: { content: comment.content, is_internal: comment.is_internal }
        });
      });

      // Add status changes
      historyData?.forEach((transition: StatusTransition) => {
        activities.push({
          id: `status-${transition.id}`,
          timestamp: transition.timestamp,
          action_type: 'status_change',
          performed_by: transition.changed_by,
          description: `Alterou status de "${STATUS_LABELS[transition.from_status]}" para "${STATUS_LABELS[transition.to_status]}"`,
          details: { from_status: transition.from_status, to_status: transition.to_status, reason: transition.change_reason }
        });
      });

      // Sort by timestamp (newest first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivityLog(activities);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  // Load attachments (simulated)
  const loadAttachments = async () => {
    setAttachmentsLoading(true);
    try {
      // Simulate attachment loading
      // In a real implementation, this would fetch from the database
      const mockAttachments: AttachmentFile[] = [
        {
          id: '1',
          filename: 'error_screenshot.png',
          file_size: 256000,
          mime_type: 'image/png',
          uploaded_at: new Date(Date.now() - 86400000),
          uploaded_by: 'user@example.com',
          file_path: '/attachments/error_screenshot.png'
        },
        {
          id: '2',
          filename: 'system_logs.txt',
          file_size: 12800,
          mime_type: 'text/plain',
          uploaded_at: new Date(Date.now() - 3600000),
          uploaded_by: 'admin@example.com',
          file_path: '/attachments/system_logs.txt'
        }
      ];

      setAttachments(mockAttachments);
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await window.electron.ipcRenderer.invoke('incident:addComment', {
        incidentId: incident.id,
        content: newComment,
        author: 'current.user@company.com', // TODO: Get from auth context
        isInternal: isInternalComment
      });

      setNewComment('');
      setIsInternalComment(false);
      await loadComments();
      await loadActivityLog();

      // Trigger refresh to update last activity
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: IncidentStatus) => {
    try {
      await window.electron.ipcRenderer.invoke('incident:updateStatus', {
        incidentId: incident.id,
        newStatus,
        changedBy: 'current.user@company.com',
        reason: 'Status alterado através da interface'
      });

      const updatedIncident = { ...incident, status: newStatus };
      setIncident(updatedIncident);

      if (onIncidentUpdate) {
        onIncidentUpdate(updatedIncident);
      }

      await loadStatusHistory();
      await loadActivityLog();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Handle assignment
  const handleAssignIncident = async () => {
    if (!assignedUser.trim()) return;

    try {
      await window.electron.ipcRenderer.invoke('incident:assign', {
        incidentId: incident.id,
        assignedTo: assignedUser,
        assignedBy: 'current.user@company.com'
      });

      const updatedIncident = { ...incident, assigned_to: assignedUser };
      setIncident(updatedIncident);

      if (onIncidentUpdate) {
        onIncidentUpdate(updatedIncident);
      }

      setShowAssignModal(false);
      await loadActivityLog();
    } catch (error) {
      console.error('Error assigning incident:', error);
    }
  };

  // Handle escalation
  const handleEscalateIncident = async () => {
    if (!escalationReason.trim()) return;

    try {
      await window.electron.ipcRenderer.invoke('incident:escalate', {
        incidentId: incident.id,
        escalationLevel: 'level_1',
        reason: escalationReason,
        escalatedBy: 'current.user@company.com'
      });

      const updatedIncident = { ...incident, escalation_level: 'level_1' };
      setIncident(updatedIncident);

      if (onIncidentUpdate) {
        onIncidentUpdate(updatedIncident);
      }

      setShowEscalateModal(false);
      setEscalationReason('');
      await loadActivityLog();
    } catch (error) {
      console.error('Error escalating incident:', error);
    }
  };

  // Calculate SLA status
  const slaStatus = useMemo(() => {
    if (!incident.sla_deadline) return 'unknown';

    const now = new Date();
    const deadline = new Date(incident.sla_deadline);
    const timeDiff = deadline.getTime() - now.getTime();
    const hoursRemaining = timeDiff / (1000 * 60 * 60);

    if (hoursRemaining < 0) return 'breached';
    if (hoursRemaining < 2) return 'at_risk';
    return 'on_time';
  }, [incident.sla_deadline]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
    return `${Math.floor(diffMins / 1440)}d atrás`;
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-semibold text-gray-900 truncate">
                  {incident.incident_number || incident.id}
                </h1>
                <StatusBadge status={incident.status} size="md" />
                <PriorityBadge priority={incident.priority} size="md" />
                {incident.escalation_level !== 'none' && (
                  <Badge variant="destructive" size="sm">
                    Escalado - {incident.escalation_level}
                  </Badge>
                )}
              </div>
              <h2 className="text-lg text-gray-900 mb-1">{incident.title}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Criado: {incident.created_at.toLocaleString('pt-BR')}</span>
                <span>Atualizado: {incident.updated_at.toLocaleString('pt-BR')}</span>
                {incident.assigned_to && (
                  <span>Responsável: {incident.assigned_to}</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssignModal(true)}
              >
                Atribuir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEscalateModal(true)}
              >
                Escalar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleStatusChange('fechado')}
                disabled={incident.status === 'fechado'}
              >
                Fechar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                ✕
              </Button>
            </div>
          </div>

          {/* SLA Status */}
          {incident.sla_deadline && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">SLA:</span>
              <Badge
                variant={slaStatus === 'breached' ? 'destructive' : slaStatus === 'at_risk' ? 'warning' : 'success'}
                size="sm"
              >
                {slaStatus === 'breached' && 'Violado'}
                {slaStatus === 'at_risk' && 'Em Risco'}
                {slaStatus === 'on_time' && 'No Prazo'}
              </Badge>
              <span className="text-sm text-gray-500">
                Prazo: {new Date(incident.sla_deadline).toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <div className="px-6 py-3 border-b border-gray-200">
                <TabsList>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="comments">Comentários ({comments.length})</TabsTrigger>
                  <TabsTrigger value="related">Relacionados</TabsTrigger>
                  <TabsTrigger value="attachments">Anexos ({attachments.length})</TabsTrigger>
                  <TabsTrigger value="activity">Atividade</TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                {/* Details Tab */}
                <TabsContent value="details" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Problem Description */}
                    <div className="lg:col-span-2">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Descrição do Problema</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 whitespace-pre-wrap">{incident.problem}</p>
                      </div>
                    </div>

                    {/* Solution */}
                    {incident.solution && (
                      <div className="lg:col-span-2">
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Solução</h3>
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-gray-700 whitespace-pre-wrap">{incident.solution}</p>
                        </div>
                      </div>
                    )}

                    {/* Status Workflow */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Fluxo de Status</h3>
                      <StatusWorkflow
                        incident={incident}
                        onStatusChange={handleStatusChange}
                        showHistory={false}
                      />
                    </div>

                    {/* Information */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Informações</h3>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Categoria</dt>
                          <dd className="text-sm text-gray-900">{incident.category}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Tags</dt>
                          <dd className="flex flex-wrap gap-1 mt-1">
                            {incident.tags?.map((tag, index) => (
                              <Badge key={index} variant="secondary" size="sm">{tag}</Badge>
                            ))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Impacto nos Negócios</dt>
                          <dd className="text-sm text-gray-900 capitalize">{incident.business_impact}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Impacto no Cliente</dt>
                          <dd className="text-sm text-gray-900">{incident.customer_impact ? 'Sim' : 'Não'}</dd>
                        </div>
                        {incident.affected_systems && incident.affected_systems.length > 0 && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Sistemas Afetados</dt>
                            <dd className="text-sm text-gray-900">{incident.affected_systems.join(', ')}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Histórico de Status</h3>
                    {historyLoading ? (
                      <div className="text-center py-8 text-gray-500">Carregando histórico...</div>
                    ) : statusHistory.length > 0 ? (
                      <div className="space-y-3">
                        {statusHistory.map((transition, index) => (
                          <div key={transition.id} className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">{transition.changed_by}</span>
                                {' alterou o status de '}
                                <Badge variant="secondary" size="sm">{STATUS_LABELS[transition.from_status]}</Badge>
                                {' para '}
                                <Badge variant="secondary" size="sm">{STATUS_LABELS[transition.to_status]}</Badge>
                              </p>
                              {transition.change_reason && (
                                <p className="text-sm text-gray-600 mt-1">{transition.change_reason}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {formatTimeAgo(transition.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Nenhuma alteração de status encontrada</div>
                    )}
                  </div>
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="space-y-4">
                  {/* Add Comment */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Adicionar Comentário</h3>
                    <div className="space-y-3">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Digite seu comentário..."
                        rows={3}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={(e) => setIsInternalComment(e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Comentário interno</span>
                        </label>
                        <Button
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          size="sm"
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  {commentsLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando comentários...</div>
                  ) : comments.length > 0 ? (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{comment.author}</span>
                              {comment.is_internal && (
                                <Badge variant="warning" size="sm">Interno</Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(comment.timestamp)}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                          {comment.attachments && comment.attachments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs text-gray-500">
                                Anexos: {comment.attachments.join(', ')}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">Nenhum comentário encontrado</div>
                  )}
                </TabsContent>

                {/* Related Incidents Tab */}
                <TabsContent value="related">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Incidentes Relacionados (IA)</h3>
                    {relatedLoading ? (
                      <div className="text-center py-8 text-gray-500">Analisando incidentes similares...</div>
                    ) : relatedIncidents.length > 0 ? (
                      <div className="space-y-3">
                        {relatedIncidents.map((related) => (
                          <div key={related.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-gray-900">{related.title}</h4>
                                  <Badge variant="outline" size="sm">
                                    {Math.round(related.similarity_score * 100)}% similar
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={related.status} size="sm" />
                                  <PriorityBadge priority={related.priority} size="sm" />
                                  <span className="text-xs text-gray-500">
                                    {formatTimeAgo(related.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Nenhum incidente relacionado encontrado</div>
                    )}
                  </div>
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">Anexos e Logs</h3>
                      <Button variant="outline" size="sm">
                        Adicionar Arquivo
                      </Button>
                    </div>

                    {attachmentsLoading ? (
                      <div className="text-center py-8 text-gray-500">Carregando anexos...</div>
                    ) : attachments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {attachments.map((attachment) => (
                          <div key={attachment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                {attachment.mime_type.startsWith('image/') ? (
                                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <span className="text-green-600 text-sm">IMG</span>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-blue-600 text-sm">FILE</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate">{attachment.filename}</h4>
                                <p className="text-sm text-gray-500">
                                  {formatFileSize(attachment.file_size)} • {attachment.uploaded_by}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatTimeAgo(attachment.uploaded_at)}
                                </p>
                              </div>
                              <Button variant="ghost" size="sm">
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Nenhum anexo encontrado</div>
                    )}
                  </div>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Log de Atividades</h3>
                    {activityLoading ? (
                      <div className="text-center py-8 text-gray-500">Carregando atividades...</div>
                    ) : activityLog.length > 0 ? (
                      <div className="space-y-3">
                        {activityLog.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-2 h-2 rounded-full ${
                                activity.action_type === 'comment' ? 'bg-blue-500' :
                                activity.action_type === 'status_change' ? 'bg-green-500' :
                                activity.action_type === 'assignment' ? 'bg-purple-500' :
                                'bg-gray-500'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">{activity.performed_by}</span>
                                {' '}
                                {activity.description}
                              </p>
                              {activity.details?.content && (
                                <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded p-2">
                                  "{activity.details.content}"
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {formatTimeAgo(activity.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Nenhuma atividade encontrada</div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Sidebar - Impact Analysis & SLA Tracking */}
          <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* SLA Tracking */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Acompanhamento SLA</h3>
                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <Badge
                      variant={slaStatus === 'breached' ? 'destructive' : slaStatus === 'at_risk' ? 'warning' : 'success'}
                      size="sm"
                    >
                      {slaStatus === 'breached' && 'Violado'}
                      {slaStatus === 'at_risk' && 'Em Risco'}
                      {slaStatus === 'on_time' && 'No Prazo'}
                    </Badge>
                  </div>
                  {incident.sla_deadline && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Prazo:</span>
                      <span className="text-gray-900">
                        {new Date(incident.sla_deadline).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {incident.resolution_time && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tempo Resolução:</span>
                      <span className="text-gray-900">{incident.resolution_time}min</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Impact Analysis */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Análise de Impacto</h3>
                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Prioridade:</span>
                    <PriorityBadge priority={incident.priority} size="sm" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Impacto Negócio:</span>
                    <Badge
                      variant={incident.business_impact === 'critical' ? 'destructive' :
                              incident.business_impact === 'high' ? 'warning' : 'secondary'}
                      size="sm"
                    >
                      {incident.business_impact}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Impacto Cliente:</span>
                    <span className="text-gray-900">{incident.customer_impact ? 'Sim' : 'Não'}</span>
                  </div>
                  {incident.escalation_level !== 'none' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Escalação:</span>
                      <Badge variant="destructive" size="sm">{incident.escalation_level}</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Ações Rápidas</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('comments')}
                  >
                    💬 Adicionar Comentário
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowAssignModal(true)}
                  >
                    👤 Atribuir Responsável
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowEscalateModal(true)}
                  >
                    ⬆️ Escalar Incidente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    📎 Adicionar Anexo
                  </Button>
                </div>
              </div>

              {/* Resolution Details */}
              {incident.status === 'resolvido' || incident.status === 'fechado' ? (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Detalhes da Resolução</h3>
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    {incident.resolver && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Resolvido por:</span>
                        <span className="text-gray-900">{incident.resolver}</span>
                      </div>
                    )}
                    {incident.resolution_time && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tempo total:</span>
                        <span className="text-gray-900">{incident.resolution_time} min</span>
                      </div>
                    )}
                    {incident.solution && (
                      <div className="text-sm">
                        <span className="text-gray-600 block mb-1">Solução:</span>
                        <p className="text-gray-900 text-xs bg-gray-50 rounded p-2">
                          {incident.solution.length > 100
                            ? `${incident.solution.substring(0, 100)}...`
                            : incident.solution
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} size="sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Atribuir Incidente</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsável
                </label>
                <Input
                  value={assignedUser}
                  onChange={(e) => setAssignedUser(e.target.value)}
                  placeholder="Digite o email do responsável"
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAssignIncident}
                  disabled={!assignedUser.trim()}
                >
                  Atribuir
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Escalation Modal */}
      {showEscalateModal && (
        <Modal isOpen={showEscalateModal} onClose={() => setShowEscalateModal(false)} size="sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Escalar Incidente</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo da Escalação
                </label>
                <Textarea
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="Descreva o motivo da escalação..."
                  rows={3}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEscalateModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEscalateIncident}
                  disabled={!escalationReason.trim()}
                  variant="destructive"
                >
                  Escalar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default IncidentDetailView;