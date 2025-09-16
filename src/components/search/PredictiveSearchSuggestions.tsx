/**
 * Predictive Search Suggestions Component
 * 
 * Provides intelligent search suggestions with:
 * - ML-powered prediction based on user patterns
 * - Cache-aware suggestion ranking
 * - Real-time query completion
 * - Contextual recommendations
 * - Performance-optimized rendering
 * 
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Clock,
  TrendingUp,
  Zap,
  Brain,
  Target,
  ArrowRight,
  Star,
  BarChart3,
  Filter,
  Tag,
  ChevronRight
} from 'lucide-react';
import { PredictiveCacheEntry } from '../../services/cache/CacheTypes';
import { useCacheManager } from '../../hooks/useCacheManager';
import { useDebounce } from '../../hooks/useDebounce';

// ========================
// Types & Interfaces
// ========================

export interface PredictiveSuggestion {
  id: string;
  text: string;
  type: 'query' | 'completion' | 'filter' | 'category' | 'template' | 'correction';
  confidence: number;
  source: 'history' | 'trending' | 'ml_prediction' | 'cache' | 'pattern' | 'context';
  metadata?: {
    frequency?: number;
    recency?: number;
    success_rate?: number;
    cache_hit_probability?: number;
    estimated_results?: number;
    tags?: string[];
    category?: string;
    context?: Record<string, any>;
  };
  preview?: {
    description?: string;
    result_count?: number;
    sample_results?: string[];
  };
}

export interface SuggestionGroup {
  type: string;
  label: string;
  icon: React.ElementType;
  suggestions: PredictiveSuggestion[];
  priority: number;
}

export interface PredictiveSearchSuggestionsProps {
  query: string;
  isOpen: boolean;
  suggestions: PredictiveSuggestion[];
  isLoading?: boolean;
  maxSuggestions?: number;
  enableGrouping?: boolean;
  enablePreviews?: boolean;
  enableCacheIndicators?: boolean;
  enableMLPredictions?: boolean;
  showPerformanceHints?: boolean;
  onSuggestionSelect?: (suggestion: PredictiveSuggestion) => void;
  onSuggestionHover?: (suggestion: PredictiveSuggestion | null) => void;
  onClose?: () => void;
  className?: string;
}

export interface SuggestionItemProps {
  suggestion: PredictiveSuggestion;
  index: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  query: string;
  enableCacheIndicators?: boolean;
  enablePreviews?: boolean;
  onClick?: (suggestion: PredictiveSuggestion) => void;
  onHover?: (suggestion: PredictiveSuggestion | null) => void;
}

export interface SuggestionPreviewProps {
  suggestion: PredictiveSuggestion;
  isVisible: boolean;
}

// ========================
// Utility Functions
// ========================

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query || !text) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const getSuggestionIcon = (type: PredictiveSuggestion['type'], source: PredictiveSuggestion['source']) => {
  if (source === 'ml_prediction') return Brain;
  if (source === 'trending') return TrendingUp;
  if (source === 'cache') return Zap;
  if (source === 'history') return Clock;
  
  switch (type) {
    case 'completion': return ArrowRight;
    case 'filter': return Filter;
    case 'category': return Tag;
    case 'template': return Target;
    case 'correction': return Search;
    default: return Search;
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-600 dark:text-gray-400';
};

const groupSuggestions = (suggestions: PredictiveSuggestion[]): SuggestionGroup[] => {
  const groups: Record<string, PredictiveSuggestion[]> = {};
  
  suggestions.forEach(suggestion => {
    const groupKey = suggestion.source === 'ml_prediction' ? 'AI Predictions' :
                    suggestion.source === 'history' ? 'Recent Searches' :
                    suggestion.source === 'trending' ? 'Trending' :
                    suggestion.source === 'cache' ? 'Quick Access' :
                    suggestion.type === 'completion' ? 'Completions' :
                    suggestion.type === 'filter' ? 'Filters' :
                    suggestion.type === 'category' ? 'Categories' :
                    'Suggestions';
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(suggestion);
  });
  
  // Convert to SuggestionGroup format with priorities
  const groupConfigs: Record<string, { label: string; icon: React.ElementType; priority: number }> = {
    'AI Predictions': { label: 'AI Predictions', icon: Brain, priority: 1 },
    'Quick Access': { label: 'Quick Access', icon: Zap, priority: 2 },
    'Completions': { label: 'Completions', icon: ArrowRight, priority: 3 },
    'Recent Searches': { label: 'Recent Searches', icon: Clock, priority: 4 },
    'Trending': { label: 'Trending', icon: TrendingUp, priority: 5 },
    'Categories': { label: 'Categories', icon: Tag, priority: 6 },
    'Filters': { label: 'Filters', icon: Filter, priority: 7 },
    'Suggestions': { label: 'Suggestions', icon: Search, priority: 8 }
  };
  
  return Object.entries(groups)
    .map(([type, suggestions]) => ({
      type,
      label: groupConfigs[type]?.label || type,
      icon: groupConfigs[type]?.icon || Search,
      suggestions: suggestions.slice(0, 5), // Limit per group
      priority: groupConfigs[type]?.priority || 9
    }))
    .sort((a, b) => a.priority - b.priority);
};

// ========================
// Sub-components
// ========================

const SuggestionPreview: React.FC<SuggestionPreviewProps> = ({ suggestion, isVisible }) => {
  if (!isVisible || !suggestion.preview) return null;
  
  return (
    <div className="absolute left-full top-0 ml-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
      <div className="space-y-3">
        {suggestion.preview.description && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              About this search
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {suggestion.preview.description}
            </p>
          </div>
        )}
        
        {suggestion.preview.result_count !== undefined && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <BarChart3 size={12} />
            <span>~{suggestion.preview.result_count} expected results</span>
          </div>
        )}
        
        {suggestion.preview.sample_results && suggestion.preview.sample_results.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sample results:
            </h5>
            <ul className="space-y-1">
              {suggestion.preview.sample_results.slice(0, 3).map((result, index) => (
                <li key={index} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  • {result}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {suggestion.metadata?.cache_hit_probability && (
          <div className="flex items-center gap-2 text-xs">
            <Zap size={12} className="text-green-600 dark:text-green-400" />
            <span className="text-green-600 dark:text-green-400">
              {Math.round(suggestion.metadata.cache_hit_probability * 100)}% cache hit probability
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const SuggestionItem: React.FC<SuggestionItemProps> = ({
  suggestion,
  index,
  isSelected = false,
  isHighlighted = false,
  query,
  enableCacheIndicators = true,
  enablePreviews = true,
  onClick,
  onHover
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const Icon = getSuggestionIcon(suggestion.type, suggestion.source);
  
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);
  
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
      onHover?.(suggestion);
    }, 500); // Show preview after 500ms hover
  }, [onHover, suggestion]);
  
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowPreview(false);
    onHover?.(null);
  }, [onHover]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);
  
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div className="relative">
      <div
        className={`
          flex items-center gap-3 px-3 py-2 cursor-pointer transition-all duration-150
          ${isSelected || isHighlighted 
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-100' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
          }
        `}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="option"
        aria-selected={isSelected}
      >
        {/* Icon */}
        <div className={`flex-shrink-0 ${getConfidenceColor(suggestion.confidence)}`}>
          <Icon size={14} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {highlightMatch(suggestion.text, query)}
          </div>
          
          {/* Metadata */}
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="capitalize">{suggestion.source.replace('_', ' ')}</span>
            
            {suggestion.metadata?.frequency && (
              <span className="flex items-center gap-1">
                <TrendingUp size={10} />
                {suggestion.metadata.frequency} uses
              </span>
            )}
            
            {suggestion.metadata?.success_rate && (
              <span className="flex items-center gap-1">
                <Star size={10} />
                {Math.round(suggestion.metadata.success_rate * 100)}% success
              </span>
            )}
            
            {enableCacheIndicators && suggestion.metadata?.cache_hit_probability && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Zap size={10} />
                {Math.round(suggestion.metadata.cache_hit_probability * 100)}% cached
              </span>
            )}
          </div>
        </div>
        
        {/* Confidence Indicator */}
        <div className="flex-shrink-0 flex items-center gap-1">
          <div className={`text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
            {Math.round(suggestion.confidence * 100)}%
          </div>
          {enablePreviews && suggestion.preview && (
            <ChevronRight size={12} className="text-gray-400 dark:text-gray-600" />
          )}
        </div>
      </div>
      
      {/* Preview */}
      {enablePreviews && (
        <SuggestionPreview suggestion={suggestion} isVisible={showPreview} />
      )}
    </div>
  );
};

// ========================
// Main Component
// ========================

export const PredictiveSearchSuggestions: React.FC<PredictiveSearchSuggestionsProps> = ({
  query,
  isOpen,
  suggestions,
  isLoading = false,
  maxSuggestions = 20,
  enableGrouping = true,
  enablePreviews = true,
  enableCacheIndicators = true,
  enableMLPredictions = true,
  showPerformanceHints = true,
  onSuggestionSelect,
  onSuggestionHover,
  onClose,
  className = ''
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<PredictiveSuggestion | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheManager = useCacheManager();
  
  // Debounced query for ML predictions
  const [debouncedQuery] = useDebounce(query, { delay: 200 });
  
  // Filter and limit suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions;
    
    // Filter out ML predictions if disabled
    if (!enableMLPredictions) {
      filtered = filtered.filter(s => s.source !== 'ml_prediction');
    }
    
    // Sort by confidence and relevance
    filtered = filtered.sort((a, b) => {
      // Prioritize ML predictions and cache hits
      if (a.source === 'ml_prediction' && b.source !== 'ml_prediction') return -1;
      if (b.source === 'ml_prediction' && a.source !== 'ml_prediction') return 1;
      if (a.source === 'cache' && b.source !== 'cache') return -1;
      if (b.source === 'cache' && a.source !== 'cache') return 1;
      
      // Then by confidence
      return b.confidence - a.confidence;
    });
    
    return filtered.slice(0, maxSuggestions);
  }, [suggestions, enableMLPredictions, maxSuggestions]);
  
  // Group suggestions if enabled
  const suggestionGroups = useMemo(() => {
    if (!enableGrouping) {
      return [{
        type: 'all',
        label: 'Suggestions',
        icon: Search,
        suggestions: filteredSuggestions,
        priority: 1
      }];
    }
    
    return groupSuggestions(filteredSuggestions);
  }, [filteredSuggestions, enableGrouping]);
  
  // Flatten suggestions for keyboard navigation
  const flatSuggestions = useMemo(() => {
    return suggestionGroups.flatMap(group => group.suggestions);
  }, [suggestionGroups]);
  
  // Cache suggestions for quick access
  useEffect(() => {
    if (filteredSuggestions.length > 0) {
      const cachePromises = filteredSuggestions.map(suggestion => 
        cacheManager.set(`suggestion_${suggestion.id}`, suggestion, {
          ttl: 30 * 60 * 1000, // 30 minutes
          tags: ['suggestions', query]
        })
      );
      
      Promise.all(cachePromises).catch(console.warn);
    }
  }, [filteredSuggestions, cacheManager, query]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < flatSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : flatSuggestions.length - 1
          );
          break;
          
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && flatSuggestions[selectedIndex]) {
            onSuggestionSelect?.(flatSuggestions[selectedIndex]);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, flatSuggestions, onSuggestionSelect, onClose]);
  
  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredSuggestions]);
  
  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);
  
  // Handlers
  const handleSuggestionClick = useCallback((suggestion: PredictiveSuggestion) => {
    onSuggestionSelect?.(suggestion);
  }, [onSuggestionSelect]);
  
  const handleSuggestionHover = useCallback((suggestion: PredictiveSuggestion | null) => {
    setHoveredSuggestion(suggestion);
    onSuggestionHover?.(suggestion);
  }, [onSuggestionHover]);
  
  if (!isOpen || (filteredSuggestions.length === 0 && !isLoading)) {
    return null;
  }
  
  return (
    <div
      ref={containerRef}
      className={`
        absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 
        border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg 
        max-h-96 overflow-hidden z-50 ${className}
      `}
      role="listbox"
      aria-label="Search suggestions"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
            <span className="text-sm">Loading suggestions...</span>
          </div>
        </div>
      ) : (
        <div className="py-2 max-h-96 overflow-y-auto">
          {suggestionGroups.map((group, groupIndex) => (
            <div key={group.type}>
              {/* Group Header */}
              {enableGrouping && suggestionGroups.length > 1 && (
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <group.icon size={12} />
                    {group.label}
                  </div>
                </div>
              )}
              
              {/* Group Suggestions */}
              {group.suggestions.map((suggestion, suggestionIndex) => {
                const flatIndex = suggestionGroups
                  .slice(0, groupIndex)
                  .reduce((acc, g) => acc + g.suggestions.length, 0) + suggestionIndex;
                
                return (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    index={flatIndex}
                    isSelected={flatIndex === selectedIndex}
                    isHighlighted={hoveredSuggestion?.id === suggestion.id}
                    query={query}
                    enableCacheIndicators={enableCacheIndicators}
                    enablePreviews={enablePreviews}
                    onClick={handleSuggestionClick}
                    onHover={handleSuggestionHover}
                  />
                );
              })}
            </div>
          ))}
          
          {/* Performance Hints */}
          {showPerformanceHints && flatSuggestions.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Zap size={10} className="text-green-600 dark:text-green-400" />
                  {filteredSuggestions.filter(s => s.metadata?.cache_hit_probability && s.metadata.cache_hit_probability > 0.7).length} fast results
                </span>
                <span className="flex items-center gap-1">
                  <Brain size={10} className="text-purple-600 dark:text-purple-400" />
                  {filteredSuggestions.filter(s => s.source === 'ml_prediction').length} AI predictions
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictiveSearchSuggestions;