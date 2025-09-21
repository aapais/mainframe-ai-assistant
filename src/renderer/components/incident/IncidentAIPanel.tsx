/**
 * Incident AI Panel Component
 * Displays AI suggestions, analysis, and related incidents for incident management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AIAuthorizationDialog } from '../dialogs/AIAuthorizationDialog';
import { Button } from '../common/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { IncidentAnalysisResult } from '../../../services/IncidentAIService';
import './IncidentAIPanel.css';

interface IncidentAIPanelProps {
  /** Current incident ID */
  incidentId: string;
  /** Current user ID */
  userId: string;
  /** Incident details */
  incident?: any;
  /** Panel visibility */
  isVisible?: boolean;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Callback when solution is accepted */
  onSolutionAccepted?: (suggestion: any) => void;
  /** Callback when incident is updated */
  onIncidentUpdated?: () => void;
}

interface AISuggestion {
  description: string;
  confidence: number;
  steps: string[];
  estimatedTime: string;
  riskLevel: 'baixo' | 'medio' | 'alto';
}

interface RelatedIncident {
  entry: any;
  similarity: number;
  reasoning: string;
}

interface AIAnalysis {
  severity: 'critico' | 'alto' | 'medio' | 'baixo';
  category: string;
  confidence: number;
  keywords: string[];
  estimatedResolutionTime: string;
  businessImpact: string;
}

export const IncidentAIPanel: React.FC<IncidentAIPanelProps> = ({
  incidentId,
  userId,
  incident,
  isVisible = true,
  onClose,
  onSolutionAccepted,
  onIncidentUpdated
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [relatedIncidents, setRelatedIncidents] = useState<RelatedIncident[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RelatedIncident[]>([]);
  const [authRequest, setAuthRequest] = useState<any>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);

  // Get severity color for badges
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critico': return 'error';
      case 'alto': return 'warning';
      case 'medio': return 'info';
      case 'baixo': return 'success';
      default: return 'secondary';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'info';
    if (confidence >= 0.4) return 'warning';
    return 'error';
  };

  // Request AI analysis with authorization
  const requestAIAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCurrentOperation('analysis');

      const result = await window.electronAPI.invoke('incident:requestAIAnalysis', incidentId, userId);

      if (result.success && result.data?.authRequest) {
        setAuthRequest(result.data.authRequest);
        setShowAuthDialog(true);
      } else {
        setError(result.error || 'Erro ao solicitar análise de IA');
      }
    } catch (err) {
      setError('Erro ao solicitar análise de IA: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [incidentId, userId]);

  // Execute AI analysis after authorization
  const executeAIAnalysis = useCallback(async (operationId: string) => {
    try {
      setLoading(true);

      const result = await window.electronAPI.invoke('incident:executeAIAnalysis', operationId, userId);

      if (result.success && result.data) {
        const analysisResult: IncidentAnalysisResult = result.data;
        setAiAnalysis(analysisResult.analysis);
        setRelatedIncidents(analysisResult.relatedIncidents);
        setSuggestions(analysisResult.suggestedSolutions);

        if (onIncidentUpdated) {
          onIncidentUpdated();
        }
      } else {
        setError(result.error || 'Erro ao executar análise de IA');
      }
    } catch (err) {
      setError('Erro ao executar análise de IA: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, onIncidentUpdated]);

  // Perform semantic search
  const performSemanticSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const result = await window.electronAPI.invoke('incident:semanticSearch', searchQuery, {
        maxResults: 10,
        minSimilarity: 0.5,
        includeResolved: true
      }, userId);

      if (result.success) {
        setSearchResults(result.data);
      } else {
        setError(result.error || 'Erro na busca semântica');
      }
    } catch (err) {
      setError('Erro na busca semântica: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, userId]);

  // Get solution suggestions
  const getSuggestions = useCallback(async (context?: any) => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.electronAPI.invoke('incident:suggestSolution', incidentId, context, userId);

      if (result.success) {
        setSuggestions(result.data);
      } else {
        setError(result.error || 'Erro ao obter sugestões');
      }
    } catch (err) {
      setError('Erro ao obter sugestões: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [incidentId, userId]);

  // Handle authorization response
  const handleAuthorizationResponse = useCallback(async (response: any) => {
    try {
      setShowAuthDialog(false);

      if (response.action === 'approve_once' || response.action === 'approve_always') {
        // Authorize the operation
        await window.electronAPI.invoke('incident:authorizeAI', authRequest.id, 'approved', userId);

        // Execute the operation based on current operation type
        if (currentOperation === 'analysis') {
          await executeAIAnalysis(authRequest.id);
        }
      } else if (response.action === 'use_local_only') {
        // Use local fallback
        await window.electronAPI.invoke('incident:authorizeAI', authRequest.id, 'local_only', userId);
        setError('Usando análise local sem IA - funcionalidade limitada');
      } else {
        // Denied
        await window.electronAPI.invoke('incident:authorizeAI', authRequest.id, 'denied', userId);
      }
    } catch (err) {
      setError('Erro ao processar autorização: ' + (err as Error).message);
    } finally {
      setAuthRequest(null);
      setCurrentOperation(null);
    }
  }, [authRequest, currentOperation, userId, executeAIAnalysis]);

  // Accept suggestion
  const acceptSuggestion = useCallback(async (suggestion: AISuggestion, rating?: number) => {
    try {
      const result = await window.electronAPI.invoke('incident:acceptSolution', incidentId, userId, rating);

      if (result.success) {
        if (onSolutionAccepted) {
          onSolutionAccepted(suggestion);
        }
        if (onIncidentUpdated) {
          onIncidentUpdated();
        }
      } else {
        setError(result.error || 'Erro ao aceitar sugestão');
      }
    } catch (err) {
      setError('Erro ao aceitar sugestão: ' + (err as Error).message);
    }
  }, [incidentId, userId, onSolutionAccepted, onIncidentUpdated]);

  // Reject suggestion
  const rejectSuggestion = useCallback(async (reason?: string) => {
    try {
      const result = await window.electronAPI.invoke('incident:rejectSolution', incidentId, userId, reason);

      if (result.success) {
        setSuggestions([]);
        if (onIncidentUpdated) {
          onIncidentUpdated();
        }
      } else {
        setError(result.error || 'Erro ao rejeitar sugestão');
      }
    } catch (err) {
      setError('Erro ao rejeitar sugestão: ' + (err as Error).message);
    }
  }, [incidentId, userId, onIncidentUpdated]);

  if (!isVisible) return null;

  return (
    <div className="incident-ai-panel">
      <div className="incident-ai-panel__header">
        <h3 className="incident-ai-panel__title">
          🤖 Assistente de IA para Incidentes
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="small"
            onClick={onClose}
            aria-label="Fechar painel de IA"
          >
            ✕
          </Button>
        )}
      </div>

      {error && (
        <div className="incident-ai-panel__error" role="alert">
          <strong>Erro:</strong> {error}
          <Button
            variant="ghost"
            size="small"
            onClick={() => setError(null)}
            aria-label="Fechar erro"
          >
            ✕
          </Button>
        </div>
      )}

      <div className="incident-ai-panel__content">
        {/* AI Analysis Section */}
        <section className="ai-section">
          <div className="ai-section__header">
            <h4>Análise de IA</h4>
            <Button
              variant="primary"
              size="small"
              onClick={requestAIAnalysis}
              loading={loading}
              disabled={!incident}
            >
              {aiAnalysis ? 'Atualizar Análise' : 'Solicitar Análise'}
            </Button>
          </div>

          {aiAnalysis && (
            <div className="ai-analysis">
              <div className="ai-analysis__metrics">
                <div className="metric">
                  <label>Severidade:</label>
                  <Badge variant={getSeverityColor(aiAnalysis.severity)}>
                    {aiAnalysis.severity.charAt(0).toUpperCase() + aiAnalysis.severity.slice(1)}
                  </Badge>
                </div>
                <div className="metric">
                  <label>Confiança:</label>
                  <Badge variant={getConfidenceColor(aiAnalysis.confidence)}>
                    {Math.round(aiAnalysis.confidence * 100)}%
                  </Badge>
                </div>
                <div className="metric">
                  <label>Categoria:</label>
                  <span>{aiAnalysis.category}</span>
                </div>
              </div>

              <div className="ai-analysis__details">
                <div className="detail-item">
                  <strong>Tempo Estimado de Resolução:</strong>
                  <span>{aiAnalysis.estimatedResolutionTime}</span>
                </div>
                <div className="detail-item">
                  <strong>Impacto no Negócio:</strong>
                  <span>{aiAnalysis.businessImpact}</span>
                </div>
                {aiAnalysis.keywords.length > 0 && (
                  <div className="detail-item">
                    <strong>Palavras-chave:</strong>
                    <div className="keywords">
                      {aiAnalysis.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" size="small">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Solution Suggestions Section */}
        <section className="ai-section">
          <div className="ai-section__header">
            <h4>Sugestões de Solução</h4>
            <Button
              variant="secondary"
              size="small"
              onClick={() => getSuggestions()}
              loading={loading}
              disabled={!incident}
            >
              Obter Sugestões
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="ai-suggestions">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`suggestion-card ${expandedSuggestion === index ? 'expanded' : ''}`}
                >
                  <div className="suggestion-card__header">
                    <div className="suggestion-info">
                      <h5>{suggestion.description}</h5>
                      <div className="suggestion-meta">
                        <Badge variant={getConfidenceColor(suggestion.confidence)}>
                          {Math.round(suggestion.confidence * 100)}% confiança
                        </Badge>
                        <Badge variant={suggestion.riskLevel === 'baixo' ? 'success' :
                                     suggestion.riskLevel === 'medio' ? 'warning' : 'error'}>
                          Risco {suggestion.riskLevel}
                        </Badge>
                        <span className="estimated-time">
                          ⏱️ {suggestion.estimatedTime}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => setExpandedSuggestion(expandedSuggestion === index ? null : index)}
                    >
                      {expandedSuggestion === index ? '▼' : '▶'}
                    </Button>
                  </div>

                  {expandedSuggestion === index && (
                    <div className="suggestion-card__content">
                      <div className="suggestion-steps">
                        <h6>Passos para Implementação:</h6>
                        <ol>
                          {suggestion.steps.map((step, stepIndex) => (
                            <li key={stepIndex}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="suggestion-actions">
                        <Button
                          variant="success"
                          size="small"
                          onClick={() => acceptSuggestion(suggestion, 5)}
                        >
                          ✅ Aceitar Solução
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => acceptSuggestion(suggestion, 3)}
                        >
                          👍 Tentar Esta Solução
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => rejectSuggestion(`Solução rejeitada: ${suggestion.description}`)}
                        >
                          ❌ Rejeitar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Semantic Search Section */}
        <section className="ai-section">
          <div className="ai-section__header">
            <h4>Busca Semântica</h4>
          </div>

          <div className="semantic-search">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Descreva o problema para buscar incidentes similares..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSemanticSearch()}
                className="search-input"
              />
              <Button
                variant="primary"
                onClick={performSemanticSearch}
                loading={loading}
                disabled={!searchQuery.trim()}
              >
                🔍 Buscar
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <h6>Incidentes Relacionados Encontrados:</h6>
                {searchResults.map((result, index) => (
                  <div key={index} className="related-incident">
                    <div className="incident-info">
                      <h6>{result.entry.title}</h6>
                      <p className="incident-category">📁 {result.entry.category}</p>
                      <p className="incident-reasoning">💡 {result.reasoning}</p>
                    </div>
                    <div className="incident-meta">
                      <Badge variant={getConfidenceColor(result.similarity)}>
                        {Math.round(result.similarity * 100)}% similar
                      </Badge>
                      <Badge variant={result.entry.incident_status === 'fechado' ? 'success' : 'info'}>
                        {result.entry.incident_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Related Incidents from Analysis */}
        {relatedIncidents.length > 0 && (
          <section className="ai-section">
            <div className="ai-section__header">
              <h4>Incidentes Relacionados (IA)</h4>
            </div>

            <div className="related-incidents">
              {relatedIncidents.map((related, index) => (
                <div key={index} className="related-incident">
                  <div className="incident-info">
                    <h6>{related.entry.title}</h6>
                    <p className="incident-category">📁 {related.entry.category}</p>
                    <p className="incident-reasoning">🤖 {related.reasoning}</p>
                  </div>
                  <div className="incident-meta">
                    <Badge variant={getConfidenceColor(related.similarity)}>
                      {Math.round(related.similarity * 100)}% similar
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* AI Authorization Dialog */}
      {showAuthDialog && authRequest && (
        <AIAuthorizationDialog
          isOpen={showAuthDialog}
          request={authRequest}
          onResponse={handleAuthorizationResponse}
          onClose={() => {
            setShowAuthDialog(false);
            setAuthRequest(null);
            setCurrentOperation(null);
          }}
          features={{
            enableQueryEditing: true,
            enableCostBreakdown: true,
            enableDataInspection: true,
            enableDecisionHistory: false,
            enableExport: false,
            enableHelp: true
          }}
        />
      )}
    </div>
  );
};

export default IncidentAIPanel;