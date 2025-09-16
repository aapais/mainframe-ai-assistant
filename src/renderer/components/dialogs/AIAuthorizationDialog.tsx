import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button, ButtonGroup } from '../common/Button';
import { focusManager, AriaUtils, announceToScreenReader } from '../../utils/accessibility';
import { useAccessibleShortcuts } from '../../hooks/useUXEnhancements';
import {
  AIAuthorizationDialogProps,
  AuthorizationAction,
  DialogState,
  DialogTab,
  AIAuthorizationResponse,
  ValidationError,
  AIOperationEstimates
} from '../../../types/authorization.types';
import './AIAuthorizationDialog.css';

/**
 * AI Authorization Dialog Component
 *
 * Features:
 * - MVP1 v8 transparency for AI operations
 * - Token/cost estimation with USD pricing
 * - Data sharing transparency
 * - Query modification capability
 * - Fallback options (Local Only)
 * - WCAG 2.1 AA compliance
 * - Accenture purple branding
 * - Comprehensive accessibility
 *
 * Usage:
 * - Semantic search authorization
 * - Error explanation requests
 * - KB entry analysis
 * - AI-powered operations
 */
export const AIAuthorizationDialog: React.FC<AIAuthorizationDialogProps> = ({
  isOpen,
  request,
  onResponse,
  onClose,
  estimatesLoading = false,
  estimatesError,
  brandConfig = {
    primaryColor: '#A100FF', // Accenture purple
    secondaryColor: '#E6F3FF',
    companyName: 'Mainframe AI Assistant'
  },
  accessibilityConfig = {
    wcagLevel: 'AA' as const,
    highContrast: false,
    screenReader: true,
    keyboardEnhanced: true,
    focusManagement: {
      trapFocus: true,
      restoreFocus: true,
      skipLinks: true
    },
    reducedMotion: false
  },
  features = {
    enableQueryEditing: true,
    enableCostBreakdown: true,
    enableDataInspection: true,
    enableDecisionHistory: false,
    enableExport: false,
    enableHelp: true
  },
  demoMode = false
}) => {
  // Refs for focus management
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<any>(null);

  // Internal state management
  const [dialogState, setDialogState] = useState<DialogState>({
    activeTab: 'overview',
    editingQuery: null,
    costBreakdownExpanded: false,
    dataInspectionExpanded: false,
    pendingDecision: {},
    validationErrors: [],
    loadingStates: {
      estimates: estimatesLoading,
      fallbacks: false,
      validation: false,
      submission: false
    }
  });

  const [rememberDecision, setRememberDecision] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [decisionStartTime] = useState(() => Date.now());

  // Update loading state when prop changes
  useEffect(() => {
    setDialogState(prev => ({
      ...prev,
      loadingStates: {
        ...prev.loadingStates,
        estimates: estimatesLoading
      }
    }));
  }, [estimatesLoading]);

  // Keyboard shortcuts for the dialog
  useAccessibleShortcuts([
    {
      key: 'Escape',
      handler: onClose,
      description: 'Close authorization dialog'
    },
    {
      key: 'Tab',
      handler: (e) => {
        // Tab cycling handled by focus trap
      },
      description: 'Navigate between elements'
    },
    {
      key: '1',
      handler: () => handleTabChange('overview'),
      description: 'Switch to overview tab',
      altKey: true
    },
    {
      key: '2',
      handler: () => handleTabChange('data'),
      description: 'Switch to data tab',
      altKey: true
    },
    {
      key: '3',
      handler: () => handleTabChange('cost'),
      description: 'Switch to cost breakdown tab',
      altKey: true
    }
  ]);

  // Focus management setup
  useEffect(() => {
    if (isOpen && dialogRef.current && request) {
      // Store currently focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;

      // Create focus trap
      focusTrapRef.current = focusManager.createFocusTrap('ai-auth-dialog', dialogRef.current);
      focusTrapRef.current.activate();

      // Announce to screen readers
      const announcement = `AI Authorization Required. ${request.operationDescription}.
        Estimated cost: ${formatCurrency(request.estimates?.estimatedCostUSD || 0)}.
        Estimated time: ${formatTimeRange(request.estimates?.estimatedTimeSeconds)}.
        Use Tab to navigate, Alt+1-3 to switch tabs, Escape to cancel.`;
      announceToScreenReader(announcement, 'assertive');

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      return () => {
        // Cleanup
        if (focusTrapRef.current) {
          focusTrapRef.current.deactivate();
          focusManager.removeFocusTrap('ai-auth-dialog');
        }

        // Restore focus
        if (previouslyFocusedElement.current) {
          focusManager.restoreFocus(previouslyFocusedElement.current);
        }

        // Restore body scroll
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, request]);

  // Memoized calculations
  const formattedEstimates = useMemo(() => {
    if (!request?.estimates) return null;

    return {
      tokens: request.estimates.estimatedTokens.toLocaleString(),
      cost: formatCurrency(request.estimates.estimatedCostUSD),
      time: formatTimeRange(request.estimates.estimatedTimeSeconds),
      confidence: Math.round(request.estimates.confidence * 100)
    };
  }, [request?.estimates]);

  const dataContextSummary = useMemo(() => {
    if (!request?.dataContext) return null;

    const sensitiveFields = request.dataContext.dataFields?.filter(
      field => field.sensitivity === 'confidential' || field.sensitivity === 'restricted'
    ) || [];

    return {
      totalFields: request.dataContext.dataFields?.length || 0,
      sensitiveFields: sensitiveFields.length,
      dataSize: formatFileSize(request.dataContext.dataSizeBytes),
      containsPII: request.dataContext.containsPII,
      isConfidential: request.dataContext.isConfidential
    };
  }, [request?.dataContext]);

  // Event handlers
  const handleTabChange = useCallback((tab: DialogTab) => {
    setDialogState(prev => ({ ...prev, activeTab: tab }));
    announceToScreenReader(`Switched to ${tab} tab`, 'polite');
  }, []);

  const handleQueryEdit = useCallback(() => {
    if (!request) return;

    setDialogState(prev => ({
      ...prev,
      editingQuery: request.query,
      activeTab: 'edit'
    }));
  }, [request]);

  const handleQuerySave = useCallback(() => {
    if (!dialogState.editingQuery) return;

    setDialogState(prev => ({
      ...prev,
      editingQuery: null,
      activeTab: 'overview'
    }));

    announceToScreenReader('Query modifications saved', 'polite');
  }, [dialogState.editingQuery]);

  const handleQueryCancel = useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      editingQuery: null,
      activeTab: 'overview'
    }));
  }, []);

  const handleAction = useCallback(async (action: AuthorizationAction) => {
    if (!request) return;

    setDialogState(prev => ({
      ...prev,
      loadingStates: { ...prev.loadingStates, submission: true }
    }));

    const response: AIAuthorizationResponse = {
      requestId: request.id,
      action,
      modifiedQuery: dialogState.editingQuery || undefined,
      rememberDecision,
      notes: userNotes || undefined,
      timestamp: new Date(),
      decisionTimeMs: Date.now() - decisionStartTime,
      decisionScope: rememberDecision ? {
        operationType: request.operationType,
        dataContext: true,
        costRange: { maxCostUSD: request.estimates.estimatedCostUSD * 1.1 }
      } : undefined
    };

    try {
      await onResponse(response);
      announceToScreenReader(`${action.replace('_', ' ')} action confirmed`, 'polite');
    } catch (error) {
      announceToScreenReader('Error processing authorization decision', 'assertive');
      console.error('Authorization response error:', error);
    } finally {
      setDialogState(prev => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, submission: false }
      }));
    }
  }, [request, dialogState.editingQuery, rememberDecision, userNotes, decisionStartTime, onResponse]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Render helpers
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount < 0.01 ? 4 : 2
    }).format(amount);
  };

  const formatTimeRange = (timeRange?: { min: number; max: number; typical: number }): string => {
    if (!timeRange) return 'Unknown';

    if (timeRange.min === timeRange.max) {
      return `${timeRange.typical}s`;
    }

    return `${timeRange.min}-${timeRange.max}s (typically ${timeRange.typical}s)`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderOperationIcon = (operationType: string) => {
    const icons = {
      semantic_search: '🔍',
      explain_error: '❗',
      analyze_entry: '📊',
      generate_summary: '📝',
      extract_keywords: '🏷️',
      classify_content: '📂',
      translate_text: '🌐',
      improve_writing: '✨'
    };

    return icons[operationType as keyof typeof icons] || '🤖';
  };

  const renderTabContent = () => {
    if (!request) return null;

    switch (dialogState.activeTab) {
      case 'overview':
        return (
          <div className="auth-dialog__overview" role="tabpanel" aria-labelledby="tab-overview">
            <div className="auth-dialog__operation">
              <div className="auth-dialog__operation-header">
                <span className="auth-dialog__operation-icon" aria-hidden="true">
                  {renderOperationIcon(request.operationType)}
                </span>
                <h3 className="auth-dialog__operation-title">
                  {request.operationDescription}
                </h3>
              </div>

              <div className="auth-dialog__query-preview">
                <h4>Query to be sent:</h4>
                <div className="auth-dialog__query-content" role="region" aria-label="AI Query">
                  <code>{request.query}</code>
                </div>
                {features.enableQueryEditing && (
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={handleQueryEdit}
                    icon="✏️"
                    className="auth-dialog__edit-query-btn"
                  >
                    Modify Query
                  </Button>
                )}
              </div>
            </div>

            {formattedEstimates && (
              <div className="auth-dialog__estimates" role="region" aria-label="Cost and Performance Estimates">
                <h4>Estimates:</h4>
                {dialogState.loadingStates.estimates ? (
                  <div className="auth-dialog__loading" role="status" aria-live="polite">
                    <span className="loading-spinner" aria-hidden="true"></span>
                    Calculating estimates...
                  </div>
                ) : (
                  <dl className="auth-dialog__estimates-list">
                    <div className="auth-dialog__estimate-item">
                      <dt>Cost:</dt>
                      <dd className="auth-dialog__cost">{formattedEstimates.cost}</dd>
                    </div>
                    <div className="auth-dialog__estimate-item">
                      <dt>Time:</dt>
                      <dd>{formattedEstimates.time}</dd>
                    </div>
                    <div className="auth-dialog__estimate-item">
                      <dt>Tokens:</dt>
                      <dd>{formattedEstimates.tokens}</dd>
                    </div>
                    <div className="auth-dialog__estimate-item">
                      <dt>Confidence:</dt>
                      <dd>{formattedEstimates.confidence}%</dd>
                    </div>
                  </dl>
                )}

                {estimatesError && (
                  <div className="auth-dialog__error" role="alert">
                    <strong>Error:</strong> {estimatesError}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'data':
        return (
          <div className="auth-dialog__data" role="tabpanel" aria-labelledby="tab-data">
            <h4>Data Being Shared:</h4>

            {dataContextSummary && (
              <div className="auth-dialog__data-summary">
                <div className="auth-dialog__data-stats">
                  <div className="stat-item">
                    <span className="stat-label">Data Fields:</span>
                    <span className="stat-value">{dataContextSummary.totalFields}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Data Size:</span>
                    <span className="stat-value">{dataContextSummary.dataSize}</span>
                  </div>
                  {dataContextSummary.sensitiveFields > 0 && (
                    <div className="stat-item stat-item--warning">
                      <span className="stat-label">Sensitive Fields:</span>
                      <span className="stat-value">{dataContextSummary.sensitiveFields}</span>
                    </div>
                  )}
                </div>

                {(dataContextSummary.containsPII || dataContextSummary.isConfidential) && (
                  <div className="auth-dialog__privacy-warning" role="alert">
                    <strong>⚠️ Privacy Notice:</strong>
                    {dataContextSummary.containsPII && ' This request contains personally identifiable information.'}
                    {dataContextSummary.isConfidential && ' This request contains confidential data.'}
                  </div>
                )}
              </div>
            )}

            {features.enableDataInspection && request.dataContext.dataFields && (
              <details className="auth-dialog__data-details">
                <summary>View detailed data breakdown</summary>
                <div className="auth-dialog__data-fields">
                  {request.dataContext.dataFields.map((field, index) => (
                    <div key={index} className={`data-field data-field--${field.sensitivity}`}>
                      <div className="data-field__header">
                        <span className="data-field__name">{field.name}</span>
                        <span className="data-field__type">{field.type}</span>
                        <span className={`data-field__sensitivity data-field__sensitivity--${field.sensitivity}`}>
                          {field.sensitivity}
                        </span>
                      </div>
                      {field.preview && (
                        <div className="data-field__preview">
                          <code>{field.preview}</code>
                        </div>
                      )}
                      {field.purpose && (
                        <div className="data-field__purpose">
                          <strong>Purpose:</strong> {field.purpose}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        );

      case 'cost':
        return (
          <div className="auth-dialog__cost-breakdown" role="tabpanel" aria-labelledby="tab-cost">
            <h4>Cost Breakdown:</h4>

            {request.estimates.costBreakdown && (
              <div className="cost-breakdown">
                <div className="cost-item">
                  <span className="cost-label">Input Tokens:</span>
                  <span className="cost-details">
                    {request.estimates.costBreakdown.inputTokens.count.toLocaleString()} ×
                    ${request.estimates.costBreakdown.inputTokens.rate.toFixed(6)} =
                    {formatCurrency(request.estimates.costBreakdown.inputTokens.costUSD)}
                  </span>
                </div>
                <div className="cost-item">
                  <span className="cost-label">Output Tokens:</span>
                  <span className="cost-details">
                    {request.estimates.costBreakdown.outputTokens.count.toLocaleString()} ×
                    ${request.estimates.costBreakdown.outputTokens.rate.toFixed(6)} =
                    {formatCurrency(request.estimates.costBreakdown.outputTokens.costUSD)}
                  </span>
                </div>
                {request.estimates.costBreakdown.apiOverhead > 0 && (
                  <div className="cost-item">
                    <span className="cost-label">API Overhead:</span>
                    <span className="cost-details">
                      {formatCurrency(request.estimates.costBreakdown.apiOverhead)}
                    </span>
                  </div>
                )}
                {request.estimates.costBreakdown.serviceFees > 0 && (
                  <div className="cost-item">
                    <span className="cost-label">Service Fees:</span>
                    <span className="cost-details">
                      {formatCurrency(request.estimates.costBreakdown.serviceFees)}
                    </span>
                  </div>
                )}
                <div className="cost-item cost-item--total">
                  <span className="cost-label">Total:</span>
                  <span className="cost-details">
                    {formatCurrency(request.estimates.estimatedCostUSD)}
                  </span>
                </div>
              </div>
            )}

            {request.estimates.performance && (
              <div className="performance-metrics">
                <h5>Performance Characteristics:</h5>
                <div className="metric-item">
                  <span className="metric-label">Response Time (P95):</span>
                  <span className="metric-value">
                    {request.estimates.performance.responseTimePercentiles.p95}ms
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Expected Quality:</span>
                  <span className="metric-value">
                    {Math.round(request.estimates.performance.expectedQuality * 100)}%
                  </span>
                </div>
                {request.estimates.performance.cacheHitProbability > 0 && (
                  <div className="metric-item">
                    <span className="metric-label">Cache Hit Probability:</span>
                    <span className="metric-value">
                      {Math.round(request.estimates.performance.cacheHitProbability * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'fallbacks':
        return (
          <div className="auth-dialog__fallbacks" role="tabpanel" aria-labelledby="tab-fallbacks">
            <h4>Alternative Options:</h4>

            {request.fallbackOptions.map((option, index) => (
              <div key={option.id} className={`fallback-option ${option.recommended ? 'fallback-option--recommended' : ''}`}>
                <div className="fallback-option__header">
                  <h5>{option.name}</h5>
                  {option.recommended && (
                    <span className="fallback-option__badge">Recommended</span>
                  )}
                </div>
                <p className="fallback-option__description">{option.description}</p>

                <div className="fallback-option__performance">
                  <div className="performance-indicator">
                    <span className="performance-label">Speed:</span>
                    <span className={`performance-value performance-value--${option.performance.speed}`}>
                      {option.performance.speed}
                    </span>
                  </div>
                  <div className="performance-indicator">
                    <span className="performance-label">Accuracy:</span>
                    <span className={`performance-value performance-value--${option.performance.accuracy}`}>
                      {option.performance.accuracy}
                    </span>
                  </div>
                  <div className="performance-indicator">
                    <span className="performance-label">Coverage:</span>
                    <span className={`performance-value performance-value--${option.performance.coverage}`}>
                      {option.performance.coverage}
                    </span>
                  </div>
                </div>

                {option.limitations && option.limitations.length > 0 && (
                  <div className="fallback-option__limitations">
                    <strong>Limitations:</strong>
                    <ul>
                      {option.limitations.map((limitation, i) => (
                        <li key={i}>{limitation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'edit':
        return (
          <div className="auth-dialog__edit" role="tabpanel" aria-labelledby="tab-edit">
            <h4>Modify Query:</h4>

            <div className="query-editor">
              <label htmlFor="query-textarea" className="query-editor__label">
                Edit the query that will be sent to the AI service:
              </label>
              <textarea
                id="query-textarea"
                className="query-editor__textarea"
                value={dialogState.editingQuery || ''}
                onChange={(e) => setDialogState(prev => ({
                  ...prev,
                  editingQuery: e.target.value
                }))}
                rows={6}
                aria-describedby="query-help"
              />
              <div id="query-help" className="query-editor__help">
                Modify the query to better match your needs while maintaining context relevance.
              </div>

              <ButtonGroup className="query-editor__actions">
                <Button
                  variant="primary"
                  onClick={handleQuerySave}
                  disabled={!dialogState.editingQuery?.trim()}
                >
                  Save Changes
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleQueryCancel}
                >
                  Cancel
                </Button>
              </ButtonGroup>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen || !request) return null;

  const dialogId = 'ai-auth-dialog';
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  return (
    <div
      className="modal-backdrop modal-backdrop--ai-auth"
      onClick={handleBackdropClick}
      data-testid="ai-auth-backdrop"
      style={{ '--brand-primary': brandConfig.primaryColor } as React.CSSProperties}
    >
      <div
        ref={dialogRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="ai-authorization-dialog"
      >
        {/* Header */}
        <div className="auth-dialog__header">
          <h2 id={titleId} className="auth-dialog__title">
            🤖 AI Authorization Required
          </h2>
          <p id={descriptionId} className="auth-dialog__description">
            Review the details below and choose how to proceed with this AI operation.
          </p>
          <button
            className="auth-dialog__close"
            onClick={onClose}
            aria-label="Close AI authorization dialog"
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="auth-dialog__tabs" role="tablist">
          {[
            { id: 'overview', label: 'Overview', shortcut: 'Alt+1' },
            { id: 'data', label: 'Data Sharing', shortcut: 'Alt+2' },
            { id: 'cost', label: 'Cost Details', shortcut: 'Alt+3' },
            { id: 'fallbacks', label: 'Alternatives', shortcut: 'Alt+4' },
            ...(dialogState.editingQuery !== null ? [{ id: 'edit', label: 'Edit Query', shortcut: 'Alt+5' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              className={`auth-dialog__tab ${dialogState.activeTab === tab.id ? 'auth-dialog__tab--active' : ''}`}
              role="tab"
              aria-selected={dialogState.activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id as DialogTab)}
              title={`${tab.label} (${tab.shortcut})`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="auth-dialog__content">
          {renderTabContent()}
        </div>

        {/* Decision Controls */}
        <div className="auth-dialog__controls">
          <div className="auth-dialog__options">
            <label className="auth-dialog__checkbox">
              <input
                type="checkbox"
                checked={rememberDecision}
                onChange={(e) => setRememberDecision(e.target.checked)}
                aria-describedby="remember-help"
              />
              <span>Remember this decision for similar operations</span>
            </label>
            <div id="remember-help" className="auth-dialog__help-text">
              Apply this choice to future requests with similar cost and data characteristics
            </div>

            <div className="auth-dialog__notes">
              <label htmlFor="user-notes">Notes (optional):</label>
              <textarea
                id="user-notes"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Add any notes about your decision..."
                rows={2}
              />
            </div>
          </div>

          <ButtonGroup className="auth-dialog__actions">
            <Button
              variant="success"
              onClick={() => handleAction('approve_once')}
              loading={dialogState.loadingStates.submission}
              shortcut={{ key: 'Enter', description: 'Approve this request' }}
              icon="✅"
            >
              Approve Once
            </Button>

            <Button
              variant="primary"
              onClick={() => handleAction('approve_always')}
              loading={dialogState.loadingStates.submission}
              disabled={!rememberDecision}
              icon="🔄"
            >
              Approve Always
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleAction('use_local_only')}
              loading={dialogState.loadingStates.submission}
              icon="🏠"
            >
              Use Local Only
            </Button>

            {features.enableQueryEditing && dialogState.editingQuery !== null && (
              <Button
                variant="secondary"
                onClick={() => handleAction('modify_query')}
                loading={dialogState.loadingStates.submission}
                icon="✏️"
              >
                Use Modified Query
              </Button>
            )}

            <Button
              variant="danger"
              onClick={() => handleAction('deny')}
              loading={dialogState.loadingStates.submission}
              shortcut={{ key: 'Escape', description: 'Deny request' }}
              icon="❌"
            >
              Deny
            </Button>
          </ButtonGroup>
        </div>

        {/* Screen reader live region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {dialogState.loadingStates.submission && 'Processing your authorization decision...'}
        </div>

        {/* Keyboard navigation hints */}
        <div className="sr-only">
          Use Tab to navigate, Alt+1-4 to switch tabs, Enter to approve, Escape to deny or close
        </div>
      </div>
    </div>
  );
};