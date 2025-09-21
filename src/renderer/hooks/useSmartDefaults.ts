/**
 * Smart Defaults and Auto-Corrections Hook - Search Intelligence Agent
 *
 * Features:
 * - Contextual search pre-filling based on current page
 * - Auto-correction for common mainframe terms and typos
 * - Intelligent filter suggestions based on query content
 * - Search operator recommendations for power users
 * - Dynamic placeholder text with helpful examples
 * - Performance-optimized with memoization and caching
 *
 * @author Search Intelligence Agent
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface SmartDefault {
  type: 'prefill' | 'correction' | 'suggestion' | 'filter' | 'operator';
  value: string;
  confidence: number;
  reason: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface AutoCorrection {
  original: string;
  corrected: string;
  type: 'spelling' | 'synonym' | 'abbreviation' | 'case' | 'format';
  confidence: number;
  explanation: string;
}

export interface SmartDefaultsOptions {
  enableAutoCorrections?: boolean;
  enableContextualPrefill?: boolean;
  enableFilterSuggestions?: boolean;
  enableOperatorSuggestions?: boolean;
  correctionThreshold?: number;
  maxSuggestions?: number;
  learningEnabled?: boolean;
}

const DEFAULT_OPTIONS: Required<SmartDefaultsOptions> = {
  enableAutoCorrections: true,
  enableContextualPrefill: true,
  enableFilterSuggestions: true,
  enableOperatorSuggestions: true,
  correctionThreshold: 0.7,
  maxSuggestions: 5,
  learningEnabled: true
};

// Mainframe-specific corrections and synonyms
const MAINFRAME_CORRECTIONS: Record<string, {
  correct: string;
  type: AutoCorrection['type'];
  explanation: string;
  confidence: number;
}> = {
  // Common abbreviations
  'jcl': { correct: 'JCL', type: 'case', explanation: 'Job Control Language (uppercase)', confidence: 0.95 },
  'vsam': { correct: 'VSAM', type: 'case', explanation: 'Virtual Storage Access Method (uppercase)', confidence: 0.95 },
  'db2': { correct: 'DB2', type: 'case', explanation: 'IBM Database 2 (mixed case)', confidence: 0.95 },
  'cics': { correct: 'CICS', type: 'case', explanation: 'Customer Information Control System (uppercase)', confidence: 0.95 },
  'ims': { correct: 'IMS', type: 'case', explanation: 'Information Management System (uppercase)', confidence: 0.95 },
  'cobol': { correct: 'COBOL', type: 'case', explanation: 'Common Business Oriented Language (uppercase)', confidence: 0.95 },
  'ispf': { correct: 'ISPF', type: 'case', explanation: 'Interactive System Productivity Facility (uppercase)', confidence: 0.95 },
  'tso': { correct: 'TSO', type: 'case', explanation: 'Time Sharing Option (uppercase)', confidence: 0.95 },

  // Error code variations
  'abnd': { correct: 'ABEND', type: 'abbreviation', explanation: 'Abnormal End', confidence: 0.9 },
  'soc7': { correct: 'SOC7', type: 'format', explanation: 'System Operation Code 7 (data exception)', confidence: 0.9 },
  's0c7': { correct: 'SOC7', type: 'format', explanation: 'System Operation Code 7 (data exception)', confidence: 0.9 },
  'soc4': { correct: 'SOC4', type: 'format', explanation: 'System Operation Code 4 (protection exception)', confidence: 0.9 },
  's0c4': { correct: 'SOC4', type: 'format', explanation: 'System Operation Code 4 (protection exception)', confidence: 0.9 },
  'socb': { correct: 'SOCB', type: 'format', explanation: 'System Operation Code B (page fault)', confidence: 0.9 },
  's0cb': { correct: 'SOCB', type: 'format', explanation: 'System Operation Code B (page fault)', confidence: 0.9 },

  // Common misspellings
  'dataset': { correct: 'data set', type: 'spelling', explanation: 'Mainframe data sets are two words', confidence: 0.85 },
  'datasset': { correct: 'data set', type: 'spelling', explanation: 'Common typo correction', confidence: 0.9 },
  'catologue': { correct: 'catalog', type: 'spelling', explanation: 'American spelling standard', confidence: 0.8 },
  'catalogue': { correct: 'catalog', type: 'spelling', explanation: 'American spelling standard', confidence: 0.8 },

  // Synonyms and alternatives
  'crash': { correct: 'ABEND', type: 'synonym', explanation: 'Mainframe term for abnormal termination', confidence: 0.7 },
  'failure': { correct: 'ABEND', type: 'synonym', explanation: 'More specific mainframe terminology', confidence: 0.6 },
  'database': { correct: 'DB2', type: 'synonym', explanation: 'Common mainframe database system', confidence: 0.5 },
  'file': { correct: 'data set', type: 'synonym', explanation: 'Mainframe terminology for files', confidence: 0.6 },
  'program': { correct: 'module', type: 'synonym', explanation: 'Mainframe terminology for programs', confidence: 0.5 },

  // Format corrections
  'dd-statement': { correct: 'DD statement', type: 'format', explanation: 'Proper spacing for JCL statements', confidence: 0.8 },
  'ddstatement': { correct: 'DD statement', type: 'format', explanation: 'Proper spacing for JCL statements', confidence: 0.9 },
  'exec-statement': { correct: 'EXEC statement', type: 'format', explanation: 'Proper spacing for JCL statements', confidence: 0.8 }
};

// Context-based prefill suggestions
const CONTEXT_PREFILLS: Record<string, string[]> = {
  'incidents': [
    'SOC7 data exception',
    'JCL error',
    'ABEND analysis',
    'system failure',
    'batch job failure'
  ],
  'knowledge': [
    'how to',
    'tutorial',
    'best practices',
    'configuration guide',
    'troubleshooting steps'
  ],
  'dashboard': [
    'system status',
    'performance metrics',
    'monitoring alerts',
    'resource utilization',
    'capacity planning'
  ],
  'settings': [
    'configuration',
    'setup guide',
    'parameter settings',
    'environment variables',
    'system preferences'
  ]
};

// Query pattern analysis for filter suggestions
const FILTER_PATTERNS: Array<{
  pattern: RegExp;
  category: string;
  confidence: number;
  reason: string;
}> = [
  {
    pattern: /\b(jcl|job\s+control|exec|dd\s+statement|proc)\b/i,
    category: 'JCL',
    confidence: 0.9,
    reason: 'Query contains JCL-related terms'
  },
  {
    pattern: /\b(vsam|cluster|alternate\s+index|ksds|esds|rrds)\b/i,
    category: 'VSAM',
    confidence: 0.9,
    reason: 'Query mentions VSAM components'
  },
  {
    pattern: /\b(db2|database|sql|table|bind|package)\b/i,
    category: 'DB2',
    confidence: 0.8,
    reason: 'Database-related terms detected'
  },
  {
    pattern: /\b(cics|transaction|terminal|program|map)\b/i,
    category: 'CICS',
    confidence: 0.85,
    reason: 'CICS transaction processing terms'
  },
  {
    pattern: /\b(ims|hierarchical|segment|pcb|psb)\b/i,
    category: 'IMS',
    confidence: 0.9,
    reason: 'IMS database terms detected'
  },
  {
    pattern: /\b(batch|job|step|scheduler|submit)\b/i,
    category: 'Batch',
    confidence: 0.7,
    reason: 'Batch processing keywords'
  },
  {
    pattern: /\b(performance|tuning|optimization|monitor|cpu|memory)\b/i,
    category: 'System',
    confidence: 0.75,
    reason: 'System performance terms'
  },
  {
    pattern: /\b(soc[47b]|s0c[47b]|abend|error|exception|failure)\b/i,
    category: 'Functional',
    confidence: 0.8,
    reason: 'Error and troubleshooting terms'
  }
];

// Search operator suggestions
const OPERATOR_SUGGESTIONS: Array<{
  pattern: RegExp;
  suggestion: string;
  explanation: string;
  example: string;
  confidence: number;
}> = [
  {
    pattern: /\b\w+\s+\w+\s+\w+/,
    suggestion: 'Use quotes for exact phrases',
    explanation: 'Wrap phrases in quotes to search for exact matches',
    example: '"JCL step error" instead of JCL step error',
    confidence: 0.8
  },
  {
    pattern: /\b(or|alternative|either)\b/i,
    suggestion: 'Use OR operator',
    explanation: 'Use OR to find results with any of the specified terms',
    example: 'ABEND OR error OR failure',
    confidence: 0.7
  },
  {
    pattern: /\b(and|both|all)\b/i,
    suggestion: 'Use AND operator',
    explanation: 'Use AND to find results containing all specified terms',
    example: 'VSAM AND error AND recovery',
    confidence: 0.7
  },
  {
    pattern: /\*$/,
    suggestion: 'Wildcard search active',
    explanation: 'Using * to match partial words',
    example: 'SOC* finds SOC7, SOC4, SOCB, etc.',
    confidence: 0.9
  }
];

// Dynamic placeholder suggestions
const DYNAMIC_PLACEHOLDERS = [
  'Search for mainframe issues, solutions, or procedures...',
  'Try "SOC7 data exception" or "JCL allocation error"...',
  'Search knowledge base for troubleshooting guides...',
  'Find solutions for ABEND codes, VSAM errors, or DB2 issues...',
  'Enter error codes, system names, or problem descriptions...',
  'Search for "batch job performance" or "CICS timeout"...'
];

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - (matrix[str2.length][str1.length] / maxLength);
}

/**
 * Smart Defaults and Auto-Corrections Hook
 */
export function useSmartDefaults(
  query: string = '',
  context?: string,
  options: SmartDefaultsOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [userPreferences, setUserPreferences] = useState<Record<string, any>>({});
  const [learningData, setLearningData] = useState<Record<string, number>>({});

  // Load user preferences and learning data
  useEffect(() => {
    if (config.learningEnabled) {
      try {
        const stored = localStorage.getItem('smart-defaults-preferences');
        if (stored) {
          setUserPreferences(JSON.parse(stored));
        }

        const learning = localStorage.getItem('smart-defaults-learning');
        if (learning) {
          setLearningData(JSON.parse(learning));
        }
      } catch (error) {
        console.warn('Failed to load smart defaults data:', error);
      }
    }
  }, [config.learningEnabled]);

  // Save preferences when they change
  useEffect(() => {
    if (config.learningEnabled) {
      try {
        localStorage.setItem('smart-defaults-preferences', JSON.stringify(userPreferences));
        localStorage.setItem('smart-defaults-learning', JSON.stringify(learningData));
      } catch (error) {
        console.warn('Failed to save smart defaults data:', error);
      }
    }
  }, [userPreferences, learningData, config.learningEnabled]);

  // Get contextual prefill suggestions
  const getContextualPrefill = useCallback((): SmartDefault | null => {
    if (!config.enableContextualPrefill || !context || query.length > 0) return null;

    const suggestions = CONTEXT_PREFILLS[context];
    if (!suggestions || suggestions.length === 0) return null;

    // Use learning data to prefer suggestions user has used before
    const scoredSuggestions = suggestions.map(suggestion => ({
      suggestion,
      score: learningData[`prefill_${suggestion}`] || 0
    }));

    const bestSuggestion = scoredSuggestions.sort((a, b) => b.score - a.score)[0];

    return {
      type: 'prefill',
      value: bestSuggestion.suggestion,
      confidence: Math.min(0.9, 0.5 + (bestSuggestion.score / 10)),
      reason: `Common search for ${context} context`,
      context,
      metadata: { learningScore: bestSuggestion.score }
    };
  }, [config.enableContextualPrefill, context, query, learningData]);

  // Detect and suggest auto-corrections
  const getAutoCorrections = useCallback((): AutoCorrection[] => {
    if (!config.enableAutoCorrections || query.length < 2) return [];

    const corrections: AutoCorrection[] = [];
    const words = query.toLowerCase().split(/\s+/);

    words.forEach(word => {
      // Direct corrections
      const correction = MAINFRAME_CORRECTIONS[word];
      if (correction && correction.confidence >= config.correctionThreshold) {
        corrections.push({
          original: word,
          corrected: correction.correct,
          type: correction.type,
          confidence: correction.confidence,
          explanation: correction.explanation
        });
        return;
      }

      // Fuzzy matching for similar terms
      Object.entries(MAINFRAME_CORRECTIONS).forEach(([key, value]) => {
        const similarity = calculateSimilarity(word, key);
        if (similarity > config.correctionThreshold && similarity < 1) {
          corrections.push({
            original: word,
            corrected: value.correct,
            type: 'spelling',
            confidence: similarity * value.confidence,
            explanation: `Did you mean "${value.correct}"? ${value.explanation}`
          });
        }
      });
    });

    // Remove duplicates and sort by confidence
    const uniqueCorrections = corrections.filter((correction, index, self) =>
      index === self.findIndex(c => c.original === correction.original)
    );

    return uniqueCorrections.sort((a, b) => b.confidence - a.confidence);
  }, [config.enableAutoCorrections, config.correctionThreshold, query]);

  // Suggest relevant filters based on query content
  const getFilterSuggestions = useCallback((): SmartDefault[] => {
    if (!config.enableFilterSuggestions || query.length < 3) return [];

    const suggestions: SmartDefault[] = [];

    FILTER_PATTERNS.forEach(pattern => {
      if (pattern.pattern.test(query)) {
        suggestions.push({
          type: 'filter',
          value: pattern.category,
          confidence: pattern.confidence,
          reason: pattern.reason,
          context: 'category_filter',
          metadata: { pattern: pattern.pattern.source }
        });
      }
    });

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.maxSuggestions);
  }, [config.enableFilterSuggestions, config.maxSuggestions, query]);

  // Suggest search operators for better results
  const getOperatorSuggestions = useCallback((): SmartDefault[] => {
    if (!config.enableOperatorSuggestions || query.length < 3) return [];

    const suggestions: SmartDefault[] = [];

    OPERATOR_SUGGESTIONS.forEach(operator => {
      if (operator.pattern.test(query)) {
        suggestions.push({
          type: 'operator',
          value: operator.suggestion,
          confidence: operator.confidence,
          reason: operator.explanation,
          context: 'search_syntax',
          metadata: {
            example: operator.example,
            pattern: operator.pattern.source
          }
        });
      }
    });

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.maxSuggestions);
  }, [config.enableOperatorSuggestions, config.maxSuggestions, query]);

  // Generate dynamic placeholder text
  const getDynamicPlaceholder = useCallback((): string => {
    if (context) {
      const contextPlaceholders: Record<string, string> = {
        'incidents': 'Search for error codes, ABEND analysis, or system failures...',
        'knowledge': 'Find tutorials, guides, or troubleshooting procedures...',
        'dashboard': 'Search system metrics, alerts, or performance data...',
        'settings': 'Find configuration guides or parameter documentation...'
      };

      if (contextPlaceholders[context]) {
        return contextPlaceholders[context];
      }
    }

    // Rotate through different placeholder suggestions
    const index = Math.floor(Date.now() / 30000) % DYNAMIC_PLACEHOLDERS.length;
    return DYNAMIC_PLACEHOLDERS[index];
  }, [context]);

  // Apply auto-correction to query
  const applyAutoCorrections = useCallback((originalQuery: string): string => {
    const corrections = getAutoCorrections();
    let correctedQuery = originalQuery;

    corrections.forEach(correction => {
      if (correction.confidence > 0.8) {
        const regex = new RegExp(`\\b${correction.original}\\b`, 'gi');
        correctedQuery = correctedQuery.replace(regex, correction.corrected);
      }
    });

    return correctedQuery;
  }, [getAutoCorrections]);

  // Learn from user interactions
  const recordInteraction = useCallback((type: string, value: string, accepted: boolean) => {
    if (!config.learningEnabled) return;

    const key = `${type}_${value}`;
    const currentScore = learningData[key] || 0;
    const adjustment = accepted ? 1 : -0.5;

    setLearningData(prev => ({
      ...prev,
      [key]: Math.max(0, currentScore + adjustment)
    }));
  }, [config.learningEnabled, learningData]);

  // Memoized results for performance
  const smartDefaults = useMemo(() => {
    const prefill = getContextualPrefill();
    const corrections = getAutoCorrections();
    const filters = getFilterSuggestions();
    const operators = getOperatorSuggestions();

    return {
      prefill,
      corrections,
      filters,
      operators,
      placeholder: getDynamicPlaceholder()
    };
  }, [
    getContextualPrefill,
    getAutoCorrections,
    getFilterSuggestions,
    getOperatorSuggestions,
    getDynamicPlaceholder
  ]);

  return {
    // Core functionality
    smartDefaults,
    applyAutoCorrections,
    recordInteraction,

    // Individual getters
    getContextualPrefill,
    getAutoCorrections,
    getFilterSuggestions,
    getOperatorSuggestions,
    getDynamicPlaceholder,

    // State
    userPreferences,
    learningData,

    // Configuration
    config
  };
}