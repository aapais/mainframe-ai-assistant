/**
 * QueryBuilder - Complex Query Construction Component
 *
 * Features:
 * - Visual query building with drag & drop
 * - Multiple condition types (AND, OR, NOT)
 * - Field-specific operators and value inputs
 * - Query validation and syntax highlighting
 * - Export to various query formats
 * - Query history and templates
 * - Accessibility compliance
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo
} from 'react';
import {
  Plus,
  Minus,
  X,
  Code,
  Save,
  Download,
  Copy,
  Check,
  AlertCircle,
  Search,
  Filter,
  Zap,
  ChevronDown,
  ChevronUp,
  Move
} from 'lucide-react';

// ========================
// Types & Interfaces
// ========================

export interface QueryCondition {
  id: string;
  field: string;
  operator: string;
  value: any;
  type: 'condition';
  valid?: boolean;
  error?: string;
}

export interface QueryGroup {
  id: string;
  type: 'group';
  operator: 'AND' | 'OR';
  conditions: (QueryCondition | QueryGroup)[];
  valid?: boolean;
}

export interface QueryField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  options?: { label: string; value: any }[];
  operators?: string[];
  placeholder?: string;
  validation?: (value: any) => boolean | string;
}

export interface QueryBuilderProps {
  /** Filter configuration */
  filter: {
    id: string;
    label: string;
    value: QueryGroup | null;
    active: boolean;
    metadata?: Record<string, any>;
  };
  /** Available fields for querying */
  fields: QueryField[];
  /** Callback when query changes */
  onChange: (value: QueryGroup | null, active: boolean) => void;
  /** Available query templates */
  templates?: QueryTemplate[];
  /** Callback when saving query as template */
  onSaveTemplate?: (name: string, query: QueryGroup) => void;
  /** Export formats */
  exportFormats?: ExportFormat[];
  /** Callback when exporting query */
  onExport?: (format: string, query: string) => void;
  /** Compact mode */
  compact?: boolean;
  /** Maximum nesting depth */
  maxDepth?: number;
  /** Custom CSS className */
  className?: string;
  /** Loading state */
  loading?: boolean;
}

export interface QueryTemplate {
  id: string;
  name: string;
  description?: string;
  query: QueryGroup;
  category?: string;
  usage?: number;
}

export interface ExportFormat {
  id: string;
  label: string;
  format: (query: QueryGroup) => string;
  mimeType?: string;
}

// ========================
// Default Configurations
// ========================

const DEFAULT_OPERATORS: Record<string, string[]> = {
  text: ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains', 'not_equals', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between', 'not_between'],
  date: ['equals', 'not_equals', 'before', 'after', 'between', 'not_between', 'is_today', 'is_this_week', 'is_this_month'],
  select: ['equals', 'not_equals', 'in', 'not_in'],
  multiselect: ['contains_any', 'contains_all', 'not_contains_any', 'not_contains_all'],
  boolean: ['is_true', 'is_false']
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'contains',
  equals: 'equals',
  starts_with: 'starts with',
  ends_with: 'ends with',
  not_contains: 'does not contain',
  not_equals: 'does not equal',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  greater_than: 'greater than',
  less_than: 'less than',
  greater_equal: 'greater than or equal',
  less_equal: 'less than or equal',
  between: 'between',
  not_between: 'not between',
  before: 'before',
  after: 'after',
  is_today: 'is today',
  is_this_week: 'is this week',
  is_this_month: 'is this month',
  in: 'is one of',
  not_in: 'is not one of',
  contains_any: 'contains any of',
  contains_all: 'contains all of',
  not_contains_any: 'does not contain any of',
  not_contains_all: 'does not contain all of',
  is_true: 'is true',
  is_false: 'is false'
};

const DEFAULT_EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'json',
    label: 'JSON',
    format: (query: QueryGroup) => JSON.stringify(query, null, 2),
    mimeType: 'application/json'
  },
  {
    id: 'sql',
    label: 'SQL WHERE',
    format: (query: QueryGroup) => convertToSQL(query),
    mimeType: 'text/plain'
  },
  {
    id: 'elasticsearch',
    label: 'Elasticsearch',
    format: (query: QueryGroup) => convertToElasticsearch(query),
    mimeType: 'application/json'
  }
];

// ========================
// Utility Functions
// ========================

const generateId = (): string => {
  return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const createEmptyCondition = (): QueryCondition => ({
  id: generateId(),
  field: '',
  operator: '',
  value: '',
  type: 'condition'
});

const createEmptyGroup = (): QueryGroup => ({
  id: generateId(),
  type: 'group',
  operator: 'AND',
  conditions: [createEmptyCondition()]
});

const validateCondition = (condition: QueryCondition, fields: QueryField[]): { valid: boolean; error?: string } => {
  if (!condition.field) {
    return { valid: false, error: 'Field is required' };
  }
  
  if (!condition.operator) {
    return { valid: false, error: 'Operator is required' };
  }
  
  const field = fields.find(f => f.id === condition.field);
  if (!field) {
    return { valid: false, error: 'Invalid field' };
  }
  
  // Value validation based on operator
  const valueRequiredOperators = ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between', 'not_between', 'before', 'after', 'in', 'not_in', 'contains_any', 'contains_all', 'not_contains_any', 'not_contains_all'];
  
  if (valueRequiredOperators.includes(condition.operator)) {
    if (condition.value === null || condition.value === undefined || condition.value === '') {
      return { valid: false, error: 'Value is required' };
    }
    
    if (condition.operator === 'between' || condition.operator === 'not_between') {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        return { valid: false, error: 'Between requires two values' };
      }
    }
  }
  
  // Custom field validation
  if (field.validation && condition.value) {
    const validationResult = field.validation(condition.value);
    if (validationResult !== true) {
      return { valid: false, error: typeof validationResult === 'string' ? validationResult : 'Invalid value' };
    }
  }
  
  return { valid: true };
};

const validateQuery = (query: QueryGroup, fields: QueryField[]): boolean => {
  if (!query.conditions.length) return false;
  
  return query.conditions.every(condition => {
    if (condition.type === 'condition') {
      return validateCondition(condition, fields).valid;
    } else {
      return validateQuery(condition, fields);
    }
  });
};

// Simple SQL conversion (basic implementation)
const convertToSQL = (query: QueryGroup): string => {
  const convertCondition = (condition: QueryCondition): string => {
    const { field, operator, value } = condition;
    
    switch (operator) {
      case 'equals':
        return `${field} = '${value}'`;
      case 'not_equals':
        return `${field} != '${value}'`;
      case 'contains':
        return `${field} LIKE '%${value}%'`;
      case 'not_contains':
        return `${field} NOT LIKE '%${value}%'`;
      case 'starts_with':
        return `${field} LIKE '${value}%'`;
      case 'ends_with':
        return `${field} LIKE '%${value}'`;
      case 'greater_than':
        return `${field} > ${value}`;
      case 'less_than':
        return `${field} < ${value}`;
      case 'between':
        return `${field} BETWEEN ${value[0]} AND ${value[1]}`;
      case 'in':
        const values = Array.isArray(value) ? value : [value];
        return `${field} IN (${values.map(v => `'${v}'`).join(', ')})`;
      case 'is_empty':
        return `${field} IS NULL OR ${field} = ''`;
      case 'is_not_empty':
        return `${field} IS NOT NULL AND ${field} != ''`;
      default:
        return `${field} = '${value}'`;
    }
  };
  
  const convertGroup = (group: QueryGroup): string => {
    const parts = group.conditions.map(condition => {
      if (condition.type === 'condition') {
        return convertCondition(condition);
      } else {
        return `(${convertGroup(condition)})`;
      }
    });
    
    return parts.join(` ${group.operator} `);
  };
  
  return convertGroup(query);
};

// Simple Elasticsearch conversion (basic implementation)
const convertToElasticsearch = (query: QueryGroup): string => {
  const convertCondition = (condition: QueryCondition): any => {
    const { field, operator, value } = condition;
    
    switch (operator) {
      case 'equals':
        return { term: { [field]: value } };
      case 'contains':
        return { wildcard: { [field]: `*${value}*` } };
      case 'starts_with':
        return { prefix: { [field]: value } };
      case 'greater_than':
        return { range: { [field]: { gt: value } } };
      case 'less_than':
        return { range: { [field]: { lt: value } } };
      case 'between':
        return { range: { [field]: { gte: value[0], lte: value[1] } } };
      case 'in':
        return { terms: { [field]: Array.isArray(value) ? value : [value] } };
      default:
        return { term: { [field]: value } };
    }
  };
  
  const convertGroup = (group: QueryGroup): any => {
    const clauses = group.conditions.map(condition => {
      if (condition.type === 'condition') {
        return convertCondition(condition);
      } else {
        return convertGroup(condition);
      }
    });
    
    return {
      bool: {
        [group.operator.toLowerCase()]: clauses
      }
    };
  };
  
  return JSON.stringify({ query: convertGroup(query) }, null, 2);
};

// ========================
// Value Input Component
// ========================

const ValueInput = memo<{
  field: QueryField;
  operator: string;
  value: any;
  onChange: (value: any) => void;
  compact?: boolean;
  error?: string;
}>(({ field, operator, value, onChange, compact = false, error }) => {
  const requiresValue = useMemo(() => {
    const noValueOperators = ['is_empty', 'is_not_empty', 'is_true', 'is_false', 'is_today', 'is_this_week', 'is_this_month'];
    return !noValueOperators.includes(operator);
  }, [operator]);
  
  const isBetween = operator === 'between' || operator === 'not_between';
  const isMulti = operator.includes('any') || operator.includes('all') || operator === 'in' || operator === 'not_in';
  
  if (!requiresValue) {
    return (
      <div className="text-sm text-gray-500 italic">
        No value required
      </div>
    );
  }
  
  if (isBetween) {
    const [min, max] = Array.isArray(value) ? value : ['', ''];
    
    return (
      <div className="flex items-center gap-2">
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={min}
          onChange={(e) => onChange([e.target.value, max])}
          placeholder="Min value"
          className={`
            flex-1 px-3 py-2 border rounded-lg
            ${compact ? 'text-sm' : ''}
            ${error ? 'border-red-500' : 'border-gray-300'}
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
          `}
        />
        <span className="text-gray-500">and</span>
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={max}
          onChange={(e) => onChange([min, e.target.value])}
          placeholder="Max value"
          className={`
            flex-1 px-3 py-2 border rounded-lg
            ${compact ? 'text-sm' : ''}
            ${error ? 'border-red-500' : 'border-gray-300'}
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
          `}
        />
      </div>
    );
  }
  
  if (field.type === 'select' || (field.type === 'multiselect' && !isMulti)) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full px-3 py-2 border rounded-lg
          ${compact ? 'text-sm' : ''}
          ${error ? 'border-red-500' : 'border-gray-300'}
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
        `}
      >
        <option value="">Select value...</option>
        {field.options?.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  
  if (isMulti && field.options) {
    const selectedValues = Array.isArray(value) ? value : [];
    
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {selectedValues.map(val => {
            const option = field.options?.find(opt => opt.value === val);
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
              >
                {option?.label || val}
                <button
                  onClick={() => onChange(selectedValues.filter(v => v !== val))}
                  className="hover:bg-blue-200 rounded"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
        
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !selectedValues.includes(e.target.value)) {
              onChange([...selectedValues, e.target.value]);
            }
          }}
          className={`
            w-full px-3 py-2 border rounded-lg
            ${compact ? 'text-sm' : ''}
            ${error ? 'border-red-500' : 'border-gray-300'}
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
          `}
        >
          <option value="">Add value...</option>
          {field.options
            .filter(option => !selectedValues.includes(option.value))
            .map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          }
        </select>
      </div>
    );
  }
  
  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
      className={`
        w-full px-3 py-2 border rounded-lg
        ${compact ? 'text-sm' : ''}
        ${error ? 'border-red-500' : 'border-gray-300'}
        focus:ring-2 focus:ring-blue-500 focus:border-transparent
      `}
    />
  );
});

// ========================
// Condition Component
// ========================

const ConditionComponent = memo<{
  condition: QueryCondition;
  fields: QueryField[];
  onChange: (condition: QueryCondition) => void;
  onRemove: () => void;
  compact?: boolean;
  depth?: number;
}>(({ condition, fields, onChange, onRemove, compact = false, depth = 0 }) => {
  const selectedField = useMemo(() => 
    fields.find(f => f.id === condition.field),
    [fields, condition.field]
  );
  
  const availableOperators = useMemo(() => {
    if (!selectedField) return [];
    const operators = selectedField.operators || DEFAULT_OPERATORS[selectedField.type] || [];
    return operators.map(op => ({ value: op, label: OPERATOR_LABELS[op] || op }));
  }, [selectedField]);
  
  const validation = useMemo(() => 
    validateCondition(condition, fields),
    [condition, fields]
  );
  
  const handleFieldChange = useCallback((fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    const operators = field ? (field.operators || DEFAULT_OPERATORS[field.type] || []) : [];
    
    onChange({
      ...condition,
      field: fieldId,
      operator: operators.length > 0 ? operators[0] : '',
      value: ''
    });
  }, [condition, fields, onChange]);
  
  const handleOperatorChange = useCallback((operator: string) => {
    onChange({
      ...condition,
      operator,
      value: operator === 'between' || operator === 'not_between' ? ['', ''] : ''
    });
  }, [condition, onChange]);
  
  const handleValueChange = useCallback((value: any) => {
    onChange({ ...condition, value });
  }, [condition, onChange]);
  
  return (
    <div 
      className={`
        condition-item p-3 border rounded-lg bg-white
        ${validation.valid ? 'border-gray-200' : 'border-red-300 bg-red-50'}
        ${compact ? 'text-sm' : ''}
      `}
      style={{ marginLeft: `${depth * 20}px` }}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="flex-shrink-0 mt-2">
          <Move size={14} className="text-gray-400 cursor-move" />
        </div>
        
        {/* Field Selection */}
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Field
              </label>
              <select
                value={condition.field}
                onChange={(e) => handleFieldChange(e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  ${compact ? 'text-sm' : ''}
                  ${validation.valid ? 'border-gray-300' : 'border-red-500'}
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                `}
              >
                <option value="">Select field...</option>
                {fields.map(field => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Operator
              </label>
              <select
                value={condition.operator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                disabled={!selectedField}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  ${compact ? 'text-sm' : ''}
                  ${validation.valid ? 'border-gray-300' : 'border-red-500'}
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <option value="">Select operator...</option>
                {availableOperators.map(op => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Value
              </label>
              {selectedField && condition.operator ? (
                <ValueInput
                  field={selectedField}
                  operator={condition.operator}
                  value={condition.value}
                  onChange={handleValueChange}
                  compact={compact}
                  error={validation.error}
                />
              ) : (
                <div className="text-sm text-gray-400 italic py-2">
                  Select field and operator first
                </div>
              )}
            </div>
          </div>
          
          {/* Validation Error */}
          {!validation.valid && validation.error && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />
              {validation.error}
            </div>
          )}
        </div>
        
        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors mt-1"
          aria-label="Remove condition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
});

// ========================
// Group Component
// ========================

const GroupComponent = memo<{
  group: QueryGroup;
  fields: QueryField[];
  onChange: (group: QueryGroup) => void;
  onRemove?: () => void;
  compact?: boolean;
  depth?: number;
  maxDepth?: number;
}>(({ group, fields, onChange, onRemove, compact = false, depth = 0, maxDepth = 3 }) => {
  const addCondition = useCallback(() => {
    const newCondition = createEmptyCondition();
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition]
    });
  }, [group, onChange]);
  
  const addGroup = useCallback(() => {
    if (depth >= maxDepth) return;
    
    const newGroup = createEmptyGroup();
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup]
    });
  }, [group, onChange, depth, maxDepth]);
  
  const updateCondition = useCallback((index: number, condition: QueryCondition | QueryGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = condition;
    onChange({ ...group, conditions: newConditions });
  }, [group, onChange]);
  
  const removeCondition = useCallback((index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: newConditions });
  }, [group, onChange]);
  
  const toggleOperator = useCallback(() => {
    onChange({
      ...group,
      operator: group.operator === 'AND' ? 'OR' : 'AND'
    });
  }, [group, onChange]);
  
  return (
    <div 
      className={`
        query-group p-4 border rounded-lg bg-gray-50
        ${compact ? 'text-sm' : ''}
      `}
      style={{ marginLeft: `${depth * 20}px` }}
    >
      {/* Group Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-gray-600" />
          <span className="font-medium text-gray-900">
            {depth === 0 ? 'Query' : 'Group'}
          </span>
          
          {/* Operator Toggle */}
          <button
            onClick={toggleOperator}
            className={`
              px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${group.operator === 'AND' 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
              }
            `}
          >
            {group.operator}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Add Buttons */}
          <button
            onClick={addCondition}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          >
            <Plus size={12} />
            Condition
          </button>
          
          {depth < maxDepth && (
            <button
              onClick={addGroup}
              className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
            >
              <Plus size={12} />
              Group
            </button>
          )}
          
          {/* Remove Group */}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              aria-label="Remove group"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      
      {/* Conditions */}
      <div className="space-y-3">
        {group.conditions.map((condition, index) => (
          <div key={condition.id}>
            {index > 0 && (
              <div className="flex items-center justify-center py-2">
                <span className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${group.operator === 'AND' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                  }
                `}>
                  {group.operator}
                </span>
              </div>
            )}
            
            {condition.type === 'condition' ? (
              <ConditionComponent
                condition={condition}
                fields={fields}
                onChange={(newCondition) => updateCondition(index, newCondition)}
                onRemove={() => removeCondition(index)}
                compact={compact}
                depth={depth + 1}
              />
            ) : (
              <GroupComponent
                group={condition}
                fields={fields}
                onChange={(newGroup) => updateCondition(index, newGroup)}
                onRemove={() => removeCondition(index)}
                compact={compact}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            )}
          </div>
        ))}
        
        {group.conditions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Filter size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conditions added yet</p>
            <button
              onClick={addCondition}
              className="mt-2 flex items-center gap-1 mx-auto px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
            >
              <Plus size={14} />
              Add your first condition
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ========================
// Main QueryBuilder Component
// ========================

export const QueryBuilder = memo<QueryBuilderProps>(({
  filter,
  fields,
  onChange,
  templates = [],
  onSaveTemplate,
  exportFormats = DEFAULT_EXPORT_FORMATS,
  onExport,
  compact = false,
  maxDepth = 3,
  className = '',
  loading = false
}) => {
  const [showExport, setShowExport] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [copied, setCopied] = useState(false);
  
  const query = filter.value || createEmptyGroup();
  
  const isValid = useMemo(() => 
    validateQuery(query, fields),
    [query, fields]
  );
  
  const handleQueryChange = useCallback((newQuery: QueryGroup) => {
    const valid = validateQuery(newQuery, fields);
    onChange(newQuery, valid && newQuery.conditions.length > 0);
  }, [fields, onChange]);
  
  const handleClear = useCallback(() => {
    onChange(null, false);
  }, [onChange]);
  
  const handleExport = useCallback((formatId: string) => {
    const format = exportFormats.find(f => f.id === formatId);
    if (format && onExport) {
      const exported = format.format(query);
      onExport(formatId, exported);
    }
    setShowExport(false);
  }, [query, exportFormats, onExport]);
  
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);
  
  const handleSaveTemplate = useCallback(() => {
    if (templateName.trim() && onSaveTemplate && isValid) {
      onSaveTemplate(templateName.trim(), query);
      setTemplateName('');
      setShowSave(false);
    }
  }, [templateName, onSaveTemplate, isValid, query]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading query builder...</span>
      </div>
    );
  }
  
  return (
    <div className={`query-builder ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-600" />
          <h3 className="font-semibold text-gray-900">Query Builder</h3>
          {isValid && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Check size={10} className="mr-1" />
              Valid
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Templates */}
          {templates.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const template = templates.find(t => t.id === e.target.value);
                if (template) {
                  handleQueryChange(template.query);
                }
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Load template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          )}
          
          {/* Save Template */}
          {onSaveTemplate && isValid && (
            <button
              onClick={() => setShowSave(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Save as template"
            >
              <Save size={16} />
            </button>
          )}
          
          {/* Export */}
          {isValid && (
            <button
              onClick={() => setShowExport(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Export query"
            >
              <Download size={16} />
            </button>
          )}
          
          {/* Clear */}
          {query.conditions.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>
      </div>
      
      {/* Save Template Dialog */}
      {showSave && (
        <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Save size={16} className="text-blue-600" />
            <span className="font-medium text-blue-900">Save Query Template</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter template name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
                if (e.key === 'Escape') setShowSave(false);
              }}
              autoFocus
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowSave(false)}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Export Dialog */}
      {showExport && (
        <div className="mb-4 p-4 border border-green-200 rounded-lg bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <Download size={16} className="text-green-600" />
            <span className="font-medium text-green-900">Export Query</span>
          </div>
          
          <div className="space-y-3">
            {exportFormats.map(format => {
              const exported = format.format(query);
              
              return (
                <div key={format.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{format.label}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopy(exported)}
                        className="p-1 text-gray-600 hover:text-gray-800 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => handleExport(format.id)}
                        className="p-1 text-gray-600 hover:text-gray-800 rounded transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs bg-gray-100 p-2 rounded max-h-32 overflow-auto">
                    {exported}
                  </pre>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setShowExport(false)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Query Builder */}
      <div className="query-builder-content">
        <GroupComponent
          group={query}
          fields={fields}
          onChange={handleQueryChange}
          compact={compact}
          depth={0}
          maxDepth={maxDepth}
        />
      </div>
      
      {/* Footer */}
      {query.conditions.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Conditions: {query.conditions.length}
              </span>
              <span className={`flex items-center gap-1 ${
                isValid ? 'text-green-600' : 'text-red-600'
              }`}>
                {isValid ? <Check size={14} /> : <AlertCircle size={14} />}
                {isValid ? 'Valid query' : 'Invalid query'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-gray-400" />
              <span className="text-gray-500 text-xs">
                Query builder v2.0
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

QueryBuilder.displayName = 'QueryBuilder';

export default QueryBuilder;