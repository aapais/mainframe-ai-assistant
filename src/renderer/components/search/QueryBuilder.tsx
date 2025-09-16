import React, { useState, useCallback, useEffect } from 'react';
import { SearchOptions, KBCategory } from '../../../types/services';
import './QueryBuilder.css';

interface QueryBuilderProps {
  onSubmit: (query: string, options: SearchOptions) => void;
  initialQuery?: string;
  initialOptions?: SearchOptions;
  onCancel?: () => void;
  className?: string;
}

interface QueryRule {
  id: string;
  field: 'title' | 'problem' | 'solution' | 'category' | 'tags' | 'any';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'not_contains';
  value: string;
  connector: 'AND' | 'OR';
}

interface QueryBuilderState {
  rules: QueryRule[];
  options: SearchOptions;
  previewQuery: string;
}

/**
 * Advanced Query Builder Component
 * 
 * Features:
 * - Visual query construction
 * - Multiple search criteria
 * - Boolean operators (AND/OR)
 * - Field-specific searches
 * - Query preview and validation
 * - Preset query templates
 * - Query history and favorites
 */
export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  onSubmit,
  initialQuery = '',
  initialOptions = {},
  onCancel,
  className = ''
}) => {
  const [state, setState] = useState<QueryBuilderState>({
    rules: [
      {
        id: crypto.randomUUID(),
        field: 'any',
        operator: 'contains',
        value: initialQuery,
        connector: 'AND'
      }
    ],
    options: {
      limit: 50,
      includeHighlights: true,
      useAI: true,
      threshold: 0.1,
      sortBy: 'relevance',
      sortOrder: 'desc',
      ...initialOptions
    },
    previewQuery: initialQuery
  });

  // Field options
  const fieldOptions = [
    { value: 'any', label: 'Any Field', icon: '🔍' },
    { value: 'title', label: 'Title', icon: '📝' },
    { value: 'problem', label: 'Problem', icon: '❓' },
    { value: 'solution', label: 'Solution', icon: '💡' },
    { value: 'category', label: 'Category', icon: '📁' },
    { value: 'tags', label: 'Tags', icon: '🏷️' }
  ];

  // Operator options
  const operatorOptions = [
    { value: 'contains', label: 'Contains', description: 'Field contains the text' },
    { value: 'equals', label: 'Equals', description: 'Field exactly matches the text' },
    { value: 'starts_with', label: 'Starts With', description: 'Field starts with the text' },
    { value: 'ends_with', label: 'Ends With', description: 'Field ends with the text' },
    { value: 'not_contains', label: 'Does Not Contain', description: 'Field does not contain the text' }
  ];

  // Category options
  const categoryOptions: KBCategory[] = [
    'JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'
  ];

  // Query templates
  const queryTemplates = [
    {
      name: 'Error Code Search',
      description: 'Search for specific error codes',
      rules: [
        { field: 'problem', operator: 'contains', value: 'S0C7' },
        { field: 'solution', operator: 'contains', value: 'data exception' }
      ],
      connector: 'OR'
    },
    {
      name: 'Component Issues',
      description: 'Find issues with specific components',
      rules: [
        { field: 'category', operator: 'equals', value: 'VSAM' },
        { field: 'tags', operator: 'contains', value: 'file' }
      ],
      connector: 'AND'
    },
    {
      name: 'Recent Solutions',
      description: 'Find recently added solutions',
      rules: [
        { field: 'any', operator: 'contains', value: '' }
      ],
      options: { sortBy: 'recent' }
    },
    {
      name: 'High Success Rate',
      description: 'Find most successful solutions',
      rules: [
        { field: 'any', operator: 'contains', value: '' }
      ],
      options: { sortBy: 'success_rate', threshold: 0.8 }
    }
  ];

  // Build query preview string with memoization
  const buildQueryPreview = useCallback((rules: QueryRule[]): string => {
    return rules
      .filter(rule => rule.value.trim())
      .map((rule, index) => {
        let query = '';

        if (index > 0) {
          query += ` ${rule.connector} `;
        }

        if (rule.field !== 'any') {
          query += `${rule.field}:`;
        }

        switch (rule.operator) {
          case 'equals':
            query += `"${rule.value}"`;
            break;
          case 'starts_with':
            query += `${rule.value}*`;
            break;
          case 'ends_with':
            query += `*${rule.value}`;
            break;
          case 'not_contains':
            query += `-${rule.value}`;
            break;
          default:
            query += rule.value;
        }

        return query;
      })
      .join('');
  }, []);

  // Memoized preview query generation
  const previewQuery = useMemo(() => {
    return buildQueryPreview(state.rules);
  }, [state.rules, buildQueryPreview]);

  // Update preview query when rules change
  useEffect(() => {
    setState(prev => ({ ...prev, previewQuery }));
  }, [previewQuery]);

  // Add new rule
  const addRule = useCallback(() => {
    const newRule: QueryRule = {
      id: crypto.randomUUID(),
      field: 'any',
      operator: 'contains',
      value: '',
      connector: 'AND'
    };
    
    setState(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }));
  }, []);

  // Remove rule
  const removeRule = useCallback((ruleId: string) => {
    setState(prev => ({
      ...prev,
      rules: prev.rules.filter(rule => rule.id !== ruleId)
    }));
  }, []);

  // Update rule
  const updateRule = useCallback((ruleId: string, updates: Partial<QueryRule>) => {
    setState(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    }));
  }, []);

  // Update options
  const updateOptions = useCallback((updates: Partial<SearchOptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...updates }
    }));
  }, []);

  // Apply template
  const applyTemplate = useCallback((template: typeof queryTemplates[0]) => {
    const rules = template.rules.map((rule, index) => ({
      id: crypto.randomUUID(),
      field: rule.field as QueryRule['field'],
      operator: rule.operator as QueryRule['operator'],
      value: rule.value,
      connector: (index === 0 ? 'AND' : template.connector) as QueryRule['connector']
    }));
    
    setState(prev => ({
      ...prev,
      rules,
      options: { ...prev.options, ...(template.options || {}) }
    }));
  }, []);

  // Clear all rules
  const clearRules = useCallback(() => {
    setState(prev => ({
      ...prev,
      rules: [
        {
          id: crypto.randomUUID(),
          field: 'any',
          operator: 'contains',
          value: '',
          connector: 'AND'
        }
      ]
    }));
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (previewQuery.trim()) {
      onSubmit(previewQuery, state.options);
    }
  }, [previewQuery, state.options, onSubmit]);

  // Check if query is valid with memoization
  const isValidQuery = useMemo(() => {
    return state.rules.some(rule => rule.value.trim());
  }, [state.rules]);

  return (
    <div className={`query-builder ${className}`}>
      <div className="query-builder__header">
        <h3 className="query-builder__title">
          <span className="icon">⚙️</span>
          Advanced Search Builder
        </h3>
        
        <div className="query-builder__actions">
          <button
            className="btn btn--small btn--secondary"
            onClick={clearRules}
            title="Clear all rules"
          >
            <span className="icon">🗑️</span>
            Clear
          </button>
          
          {onCancel && (
            <button
              className="btn btn--small btn--secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="query-builder__content">
        <div className="query-builder__templates">
          <h4 className="templates__title">Quick Templates</h4>
          <div className="template-grid">
            {queryTemplates.map(template => (
              <button
                key={template.name}
                className="template-card"
                onClick={() => applyTemplate(template)}
                title={template.description}
              >
                <div className="template-card__name">{template.name}</div>
                <div className="template-card__description">{template.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="query-builder__rules">
          <h4 className="rules__title">Search Rules</h4>
          
          <div className="rules-list">
            {state.rules.map((rule, index) => (
              <div key={rule.id} className="query-rule">
                {index > 0 && (
                  <div className="rule-connector">
                    <select
                      value={rule.connector}
                      onChange={(e) => updateRule(rule.id, { connector: e.target.value as QueryRule['connector'] })}
                      className="connector-select"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </div>
                )}
                
                <div className="rule-content">
                  <div className="rule-field">
                    <label className="field-label">Field:</label>
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(rule.id, { field: e.target.value as QueryRule['field'] })}
                      className="field-select"
                    >
                      {fieldOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rule-operator">
                    <label className="operator-label">Condition:</label>
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(rule.id, { operator: e.target.value as QueryRule['operator'] })}
                      className="operator-select"
                      title={operatorOptions.find(op => op.value === rule.operator)?.description}
                    >
                      {operatorOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rule-value">
                    <label className="value-label">Value:</label>
                    {rule.field === 'category' ? (
                      <select
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        className="value-select"
                      >
                        <option value="">Select Category</option>
                        {categoryOptions.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        placeholder={`Enter ${rule.field === 'any' ? 'search term' : rule.field}`}
                        className="value-input"
                      />
                    )}
                  </div>

                  <div className="rule-actions">
                    {state.rules.length > 1 && (
                      <button
                        className="btn btn--icon btn--danger"
                        onClick={() => removeRule(rule.id)}
                        title="Remove rule"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn btn--secondary btn--add-rule"
            onClick={addRule}
          >
            <span className="icon">+</span>
            Add Rule
          </button>
        </div>

        <div className="query-builder__options">
          <h4 className="options__title">Search Options</h4>
          
          <div className="options-grid">
            <div className="option-group">
              <label className="option-label">Sort By:</label>
              <select
                value={state.options.sortBy}
                onChange={(e) => updateOptions({ sortBy: e.target.value as SearchOptions['sortBy'] })}
                className="option-select"
              >
                <option value="relevance">Relevance</option>
                <option value="usage">Most Used</option>
                <option value="recent">Most Recent</option>
                <option value="success_rate">Success Rate</option>
                <option value="score">Match Score</option>
              </select>
            </div>

            <div className="option-group">
              <label className="option-label">Order:</label>
              <select
                value={state.options.sortOrder}
                onChange={(e) => updateOptions({ sortOrder: e.target.value as SearchOptions['sortOrder'] })}
                className="option-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            <div className="option-group">
              <label className="option-label">Max Results:</label>
              <select
                value={state.options.limit}
                onChange={(e) => updateOptions({ limit: parseInt(e.target.value) })}
                className="option-select"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div className="option-group">
              <label className="option-label">Min Quality:</label>
              <select
                value={Math.round((state.options.threshold || 0.1) * 100)}
                onChange={(e) => updateOptions({ threshold: parseInt(e.target.value) / 100 })}
                className="option-select"
              >
                <option value="10">10% (Low)</option>
                <option value="30">30% (Medium)</option>
                <option value="50">50% (Good)</option>
                <option value="70">70% (High)</option>
                <option value="90">90% (Excellent)</option>
              </select>
            </div>
          </div>

          <div className="option-toggles">
            <label className="toggle-option">
              <input
                type="checkbox"
                checked={state.options.useAI}
                onChange={(e) => updateOptions({ useAI: e.target.checked })}
              />
              <span className="toggle-slider" />
              <span className="toggle-label">
                <span className="icon">🤖</span>
                AI-Enhanced Search
              </span>
            </label>

            <label className="toggle-option">
              <input
                type="checkbox"
                checked={state.options.includeHighlights}
                onChange={(e) => updateOptions({ includeHighlights: e.target.checked })}
              />
              <span className="toggle-slider" />
              <span className="toggle-label">
                <span className="icon">🔦</span>
                Highlight Matches
              </span>
            </label>
          </div>
        </div>

        <div className="query-builder__preview">
          <h4 className="preview__title">Query Preview</h4>
          <div className="query-preview">
            <code className="preview-code">
              {previewQuery || 'No query built yet...'}
            </code>
          </div>
        </div>
      </div>

      <div className="query-builder__footer">
        <div className="footer-info">
          <span className="info-text">
            {isValidQuery ? '✅ Ready to search' : '⚠️ Enter at least one search term'}
          </span>
        </div>
        
        <button
          className="btn btn--primary"
          onClick={handleSubmit}
          disabled={!isValidQuery}
        >
          <span className="icon">🔍</span>
          Run Advanced Search
        </button>
      </div>
    </div>
  );
};

export default QueryBuilder;