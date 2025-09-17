/**
 * ContextualAddButton Component
 * Smart add button that pre-fills entry data based on search query and context
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Sparkles,
  Lightbulb,
  AlertCircle,
  ChevronDown,
  FileText,
  Tag,
  Target,
  Zap,
  Brain,
  Database
} from 'lucide-react';

interface ContextualAddButtonProps {
  query: string;
  searchResults?: any[];
  onAddEntry: (contextualData?: any) => void;
  position?: 'fixed' | 'inline';
  showSuggestions?: boolean;
  className?: string;
}

interface ContextualSuggestion {
  type: 'title' | 'category' | 'tags' | 'problem' | 'severity';
  value: string | string[];
  confidence: number;
  source: 'query' | 'patterns' | 'ai' | 'similar';
  description: string;
}

export const ContextualAddButton: React.FC<ContextualAddButtonProps> = ({
  query,
  searchResults = [],
  onAddEntry,
  position = 'inline',
  showSuggestions = true,
  className = ''
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Analyze query and generate contextual suggestions
  const contextualSuggestions = useMemo((): ContextualSuggestion[] => {
    if (!query.trim()) return [];

    const suggestions: ContextualSuggestion[] = [];
    const queryLower = query.toLowerCase();

    // Title suggestions
    if (/\b(s\d{3}|sql\d+|abend|error|\w+\d+)\b/i.test(query)) {
      const errorCodes = query.match(/\b(s\d{3}|sql\d+|abend|\w+\d+)\b/gi) || [];
      if (errorCodes.length > 0) {
        suggestions.push({
          type: 'title',
          value: `${errorCodes[0].toUpperCase()} - ${query.replace(errorCodes[0], '').trim() || 'Error Resolution'}`,
          confidence: 0.9,
          source: 'patterns',
          description: 'Detected error code pattern'
        });
      }
    } else if (query.length > 10) {
      suggestions.push({
        type: 'title',
        value: query.charAt(0).toUpperCase() + query.slice(1),
        confidence: 0.7,
        source: 'query',
        description: 'Based on search query'
      });
    }

    // Category suggestions
    const categoryMap: Record<string, string> = {
      'db2': 'DB2',
      'sql': 'DB2',
      'database': 'DB2',
      'jcl': 'JCL',
      'job': 'JCL',
      'batch': 'JCL',
      'cics': 'CICS',
      'transaction': 'CICS',
      'vsam': 'VSAM',
      'file': 'VSAM',
      'cobol': 'COBOL',
      'program': 'COBOL',
      'tso': 'TSO',
      'ispf': 'ISPF',
      'panel': 'ISPF',
      'security': 'Security',
      'racf': 'Security',
      'performance': 'Performance',
      'tuning': 'Performance'
    };

    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (queryLower.includes(keyword)) {
        suggestions.push({
          type: 'category',
          value: category,
          confidence: 0.8,
          source: 'patterns',
          description: `Detected ${category} keywords`
        });
        break; // Take first match
      }
    }

    // Severity suggestions
    if (/\b(critical|urgent|emergency|severe|fatal)\b/i.test(query)) {
      suggestions.push({
        type: 'severity',
        value: 'critical',
        confidence: 0.9,
        source: 'patterns',
        description: 'High priority keywords detected'
      });
    } else if (/\b(abend|error|fail|crash|down)\b/i.test(query)) {
      suggestions.push({
        type: 'severity',
        value: 'high',
        confidence: 0.8,
        source: 'patterns',
        description: 'Error-related keywords detected'
      });
    } else if (/\b(warning|caution|minor)\b/i.test(query)) {
      suggestions.push({
        type: 'severity',
        value: 'medium',
        confidence: 0.7,
        source: 'patterns',
        description: 'Warning-level keywords detected'
      });
    }

    // Tag suggestions from query words
    const words = query.split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !/\b(the|and|or|for|with|from|how|what|when|where|why)\b/i.test(word))
      .slice(0, 5);

    if (words.length > 0) {
      suggestions.push({
        type: 'tags',
        value: words.map(word => word.toLowerCase()),
        confidence: 0.6,
        source: 'query',
        description: 'Keywords from search query'
      });
    }

    // Problem description suggestions
    if (query.length > 15) {
      let problemDescription = '';

      if (/\b(how|what|when|where|why)\b/i.test(query)) {
        problemDescription = `Question: ${query}`;
      } else if (/\b(error|abend|fail)\b/i.test(query)) {
        problemDescription = `Error encountered: ${query}`;
      } else {
        problemDescription = `Issue related to: ${query}`;
      }

      suggestions.push({
        type: 'problem',
        value: problemDescription,
        confidence: 0.7,
        source: 'ai',
        description: 'Generated problem description'
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }, [query]);

  // Build contextual data object
  const contextualData = useMemo(() => {
    const data: any = { query };

    contextualSuggestions.forEach(suggestion => {
      switch (suggestion.type) {
        case 'title':
          data.suggestedTitle = suggestion.value;
          break;
        case 'category':
          data.category = suggestion.value;
          break;
        case 'tags':
          data.tags = Array.isArray(suggestion.value) ? suggestion.value : [suggestion.value];
          break;
        case 'problem':
          data.suggestedProblem = suggestion.value;
          break;
        case 'severity':
          data.severity = suggestion.value;
          break;
      }
    });

    return data;
  }, [query, contextualSuggestions]);

  // Check if we have contextual suggestions
  const hasContext = contextualSuggestions.length > 0;
  const hasHighConfidenceSuggestions = contextualSuggestions.some(s => s.confidence > 0.8);

  // Get button text based on context
  const getButtonText = () => {
    if (!query.trim()) return 'Add Entry';
    if (hasHighConfidenceSuggestions) return 'Add Smart Entry';
    if (hasContext) return 'Add with Context';
    return 'Add Entry';
  };

  // Get button icon based on context
  const getButtonIcon = () => {
    if (hasHighConfidenceSuggestions) return Sparkles;
    if (hasContext) return Lightbulb;
    return Plus;
  };

  const ButtonIcon = getButtonIcon();

  const handleAddClick = () => {
    onAddEntry(hasContext ? contextualData : undefined);
  };

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  if (position === 'fixed') {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <div className="flex flex-col items-end space-y-2">
          {/* Preview Panel */}
          {showPreview && hasContext && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Smart Entry Preview</h4>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {contextualSuggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <div className={`w-2 h-2 rounded-full mt-1 ${
                      suggestion.confidence > 0.8 ? 'bg-green-400' :
                      suggestion.confidence > 0.6 ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1">
                      <div className="font-medium text-gray-700 capitalize">
                        {suggestion.type}:
                        <span className="font-normal ml-1">
                          {Array.isArray(suggestion.value)
                            ? suggestion.value.join(', ')
                            : suggestion.value
                          }
                        </span>
                      </div>
                      <div className="text-gray-500">{suggestion.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Button */}
          <div className="flex items-center space-x-2">
            {hasContext && showSuggestions && (
              <button
                onClick={handlePreviewToggle}
                className="p-3 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                title="Preview smart suggestions"
              >
                <Brain className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={handleAddClick}
              className={`
                inline-flex items-center px-6 py-3 rounded-full text-white font-medium shadow-lg
                transition-all duration-200 transform hover:scale-105
                ${hasHighConfidenceSuggestions
                  ? 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700'
                  : hasContext
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              <ButtonIcon className="h-5 w-5 mr-2" />
              {getButtonText()}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline version
  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <button
        onClick={handleAddClick}
        className={`
          inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
          transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
          ${hasHighConfidenceSuggestions
            ? 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
            : hasContext
            ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
            : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
          }
        `}
      >
        <ButtonIcon className="h-4 w-4 mr-2" />
        {getButtonText()}
      </button>

      {hasContext && showSuggestions && (
        <div className="relative">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="View suggestions"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <h4 className="text-sm font-semibold text-gray-900">Smart Suggestions</h4>
                </div>

                <div className="space-y-3">
                  {contextualSuggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start space-x-3 p-2 bg-gray-50 rounded-md">
                      <div className="flex-shrink-0">
                        {suggestion.type === 'title' && <FileText className="h-4 w-4 text-blue-500" />}
                        {suggestion.type === 'category' && <Database className="h-4 w-4 text-green-500" />}
                        {suggestion.type === 'tags' && <Tag className="h-4 w-4 text-yellow-500" />}
                        {suggestion.type === 'problem' && <AlertCircle className="h-4 w-4 text-red-500" />}
                        {suggestion.type === 'severity' && <Target className="h-4 w-4 text-orange-500" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {suggestion.type}
                          </span>
                          <div className={`px-2 py-0.5 text-xs rounded-full ${
                            suggestion.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                            suggestion.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {Math.round(suggestion.confidence * 100)}%
                          </div>
                        </div>

                        <div className="text-sm text-gray-700 mt-1">
                          {Array.isArray(suggestion.value)
                            ? suggestion.value.join(', ')
                            : suggestion.value
                          }
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          {suggestion.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => {
                      onAddEntry(contextualData);
                      setShowAdvanced(false);
                    }}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Create with Suggestions
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextualAddButton;