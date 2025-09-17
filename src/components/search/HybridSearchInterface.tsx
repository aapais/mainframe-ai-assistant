/**
 * Hybrid Search Interface - UC001 Implementation
 *
 * Enhanced search interface with hybrid local/AI search capabilities:
 * 1. Progressive enhancement (local first, then AI)
 * 2. Authorization dialog integration
 * 3. Performance monitoring (<500ms local requirement)
 * 4. Result merging and deduplication
 * 5. Real-time search state management
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Brain,
  Zap,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Layers,
  BarChart3
} from 'lucide-react';
import { IntelligentSearchInput } from './IntelligentSearchInput';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import { AIAuthorizationDialog } from './AIAuthorizationDialog';
import { useSearchContext, SearchProvider } from '../../renderer/contexts/SearchContext';
import { useHybridSearch } from '../../renderer/hooks/useHybridSearch';
import { KBCategory } from '../../types/services';
import { HybridSearchOptions } from '../../renderer/services/hybridSearchService';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';

export interface HybridSearchInterfaceProps {
  initialQuery?: string;
  placeholder?: string;
  enableFilters?: boolean;
  enablePerformanceMonitor?: boolean;
  enableResultSeparation?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'advanced';
  onSearchComplete?: (results: any) => void;
  onPerformanceAlert?: (metrics: any) => void;
}

/**
 * Internal component that uses the search context
 */
function HybridSearchInterfaceInternal({
  initialQuery = '',
  placeholder = 'Search mainframe knowledge base...',
  enableFilters = true,
  enablePerformanceMonitor = true,
  enableResultSeparation = true,
  className = '',
  variant = 'default',
  onSearchComplete,
  onPerformanceAlert
}: HybridSearchInterfaceProps) {
  const { state, actions } = useSearchContext();
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<KBCategory>('Other');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'merged' | 'local' | 'ai'>('merged');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Performance monitoring
  const [performanceAlerts, setPerformanceAlerts] = useState<string[]>([]);

  // Search execution
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const searchOptions: HybridSearchOptions = {
      enableAI: state.preferences.enableAIByDefault,
      maxLocalResults: state.preferences.maxResults,
      enableMerging: true,
      prioritizeLocal: true
    };

    try {
      await actions.searchWithAnalytics(searchQuery, selectedCategory, searchOptions);

      // Performance monitoring
      if (enablePerformanceMonitor && state.performance.localSearchTime > 500) {
        const alertMessage = `Local search exceeded 500ms: ${state.performance.localSearchTime}ms`;
        setPerformanceAlerts(prev => [...prev, alertMessage]);
        onPerformanceAlert?.({
          localSearchTime: state.performance.localSearchTime,
          threshold: 500,
          exceeded: true
        });
      }

      onSearchComplete?.({
        results: state.results,
        performance: state.performance,
        metadata: state.metadata
      });
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [selectedCategory, state.preferences, actions, enablePerformanceMonitor, onPerformanceAlert, onSearchComplete]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      handleSearch(searchQuery);
    }, state.preferences.autoSearchDelay),
    [handleSearch, state.preferences.autoSearchDelay]
  );

  // Handle query changes
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.trim()) {
      debouncedSearch(newQuery);
    } else {
      actions.clearResults();
    }
  }, [debouncedSearch, actions]);

  // Performance metrics calculation
  const performanceMetrics = useMemo(() => {
    const metrics = actions.getPerformanceMetrics();
    return {
      ...metrics,
      complianceRate: metrics.complianceRate * 100, // Convert to percentage
      isCompliant: state.performance.localSearchTime <= 500
    };
  }, [state.performance, actions]);

  // Result tabs data
  const resultTabs = useMemo(() => [
    {
      id: 'merged',
      label: 'All Results',
      count: state.metadata.totalResultCount,
      results: state.results,
      icon: Layers
    },
    {
      id: 'local',
      label: 'Local Search',
      count: state.metadata.localResultCount,
      results: state.localResults,
      icon: Zap
    },
    {
      id: 'ai',
      label: 'AI Enhanced',
      count: state.metadata.aiResultCount,
      results: state.aiResults,
      icon: Brain
    }
  ], [state]);

  // Auto-focus search input
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Clear performance alerts after timeout
  useEffect(() => {
    if (performanceAlerts.length > 0) {
      const timer = setTimeout(() => {
        setPerformanceAlerts([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [performanceAlerts]);

  return (
    <div className={`hybrid-search-interface ${className}`}>
      {/* Search Header */}
      <div className="search-header mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <IntelligentSearchInput
              ref={searchInputRef}
              value={query}
              onChange={handleQueryChange}
              placeholder={placeholder}
              className="w-full"
              autoFocus
            />
          </div>
          
          {enableFilters && (
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          )}
        </div>

        {/* Performance Monitor */}
        {enablePerformanceMonitor && (
          <div className="performance-monitor">
            <Card className="bg-gray-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Search Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium">
                      {state.performance.localSearchTime}ms
                    </div>
                    <div className="text-gray-600">Local Search</div>
                    <Progress 
                      value={(state.performance.localSearchTime / 500) * 100} 
                      className="h-1 mt-1"
                      variant={state.performance.localSearchTime > 500 ? "destructive" : "default"}
                    />
                  </div>
                  
                  <div className="text-center">
                    <div className="font-medium">
                      {state.performance.aiSearchTime || 0}ms
                    </div>
                    <div className="text-gray-600">AI Enhancement</div>
                    <Progress 
                      value={state.performance.aiSearchTime ? (state.performance.aiSearchTime / 5000) * 100 : 0} 
                      className="h-1 mt-1"
                    />
                  </div>
                  
                  <div className="text-center">
                    <div className="font-medium">
                      {performanceMetrics.complianceRate.toFixed(1)}%
                    </div>
                    <div className="text-gray-600">Compliance</div>
                    <Progress 
                      value={performanceMetrics.complianceRate} 
                      className="h-1 mt-1"
                      variant={performanceMetrics.complianceRate >= 95 ? "default" : "destructive"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Alerts */}
        {performanceAlerts.length > 0 && (
          <div className="mt-2">
            {performanceAlerts.map((alert, index) => (
              <Alert key={index} variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Search Status */}
        <div className="search-status mt-4">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                state.isSearching ? 'bg-blue-500 animate-pulse' : 
                state.error ? 'bg-red-500' : 
                state.results.length > 0 ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              {state.isSearching ? 'Searching...' :
               state.error ? 'Search failed' :
               state.results.length > 0 ? `${state.metadata.totalResultCount} results` :
               'Ready to search'}
            </div>
            
            {state.authorizationRequired && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                AI Authorization {state.authorizationStatus === 'approved' ? 'Approved' : 'Required'}
              </Badge>
            )}
            
            {state.metadata.duplicatesRemoved > 0 && (
              <Badge variant="secondary">
                {state.metadata.duplicatesRemoved} duplicates removed
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && enableFilters && (
        <div className="filters-panel mb-6">
          <SearchFilters
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onFilterChange={() => {
              // Re-run search with new filters
              if (query.trim()) {
                handleSearch(query);
              }
            }}
          />
        </div>
      )}

      {/* Results Section */}
      <div className="results-section">
        {enableResultSeparation && state.results.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab as any} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {resultTabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4" />
                    {tab.label}
                    {tab.count > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {resultTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-4">
                <SearchResults
                  results={tab.results}
                  loading={state.isSearching}
                  error={state.error}
                  onResultSelect={(result, index) => {
                    // Handle result selection
                    console.log('Selected result:', result, 'at index:', index);
                  }}
                  highlightQuery={query}
                  variant={variant === 'compact' ? 'compact' : 'default'}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <SearchResults
            results={state.results}
            loading={state.isSearching}
            error={state.error}
            onResultSelect={(result, index) => {
              console.log('Selected result:', result, 'at index:', index);
            }}
            highlightQuery={query}
            variant={variant === 'compact' ? 'compact' : 'default'}
          />
        )}
      </div>

      {/* AI Authorization Dialog */}
      <AIAuthorizationDialog
        isOpen={state.authDialog.isOpen}
        onClose={actions.hideAuthDialog}
        query={state.authDialog.query}
        estimatedCost={state.authDialog.estimatedCost}
        onApprove={state.authDialog.onApprove || (() => {})}
        onDeny={state.authDialog.onDeny || (() => {})}
      />
    </div>
  );
}

/**
 * Main Hybrid Search Interface with Context Provider
 */
export function HybridSearchInterface(props: HybridSearchInterfaceProps) {
  return (
    <SearchProvider
      defaultOptions={{
        enableAI: true,
        enableRealTime: true,
        debounceMs: 300
      }}
    >
      <HybridSearchInterfaceInternal {...props} />
    </SearchProvider>
  );
}

/**
 * Utility function for debouncing
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Export types
export type { HybridSearchInterfaceProps };