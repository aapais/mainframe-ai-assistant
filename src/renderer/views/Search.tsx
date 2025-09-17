import React, { useState, useCallback, useEffect } from 'react';
import { Search as SearchIcon, Database, Brain, Clock, FileText, Settings, Users, Tag } from 'lucide-react';
import LocalSearchTab from '../components/search/LocalSearchTab';
import AISearchTab from '../components/search/AISearchTab';
import { searchService } from '../services/searchService';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'file' | 'setting' | 'user' | 'log' | 'data' | 'analysis' | 'pattern' | 'recommendation' | 'insight';
  path?: string;
  lastModified?: Date;
  relevanceScore?: number;
  highlights?: string[];
}

const Search: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'local' | 'ai'>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [localResults, setLocalResults] = useState<SearchResult[]>([]);
  const [aiResults, setAIResults] = useState<SearchResult[]>([]);
  const [isLocalSearching, setIsLocalSearching] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Debounced local search for real-time results
  const performLocalSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setLocalResults([]);
      return;
    }

    setIsLocalSearching(true);
    try {
      const results = await searchService.searchLocal(query);
      setLocalResults(results);
    } catch (error) {
      console.error('Local search error:', error);
      setLocalResults([]);
    } finally {
      setIsLocalSearching(false);
    }
  }, []);

  // AI-enhanced search
  const performAISearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAIResults([]);
      return;
    }

    setIsAISearching(true);
    try {
      const results = await searchService.searchAI(query);
      setAIResults(results);
      
      // Add to search history
      setSearchHistory(prev => {
        const newHistory = [query, ...prev.filter(q => q !== query)].slice(0, 10);
        return newHistory;
      });
    } catch (error) {
      console.error('AI search error:', error);
      setAIResults([]);
    } finally {
      setIsAISearching(false);
    }
  }, []);

  // Handle search input changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'local') {
        performLocalSearch(searchQuery);
      }
    }, 200); // 200ms debounce for real-time local search

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, activeTab, performLocalSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      performAISearch(searchQuery);
    }
  };

  const getTabIcon = (tab: 'local' | 'ai') => {
    return tab === 'local' ? Database : Brain;
  };

  const getResultTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'file': return FileText;
      case 'setting': return Settings;
      case 'user': return Users;
      case 'log': return Clock;
      case 'data': return Database;
      default: return Tag;
    }
  };

  const currentResults = activeTab === 'local' ? localResults : aiResults;
  const isSearching = activeTab === 'local' ? isLocalSearching : isAISearching;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <SearchIcon className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Search
          </h1>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="mb-6">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'local' ? "Search files, settings, users..." : "Ask AI to search and analyze..."}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          </form>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {(['local', 'ai'] as const).map((tab) => {
              const Icon = getTabIcon(tab);
              const isActive = activeTab === tab;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab === 'local' ? 'Local Search' : 'AI-Enhanced Search'}
                  {currentResults.length > 0 && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }`}>
                      {currentResults.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto p-6 h-full">
          {activeTab === 'local' ? (
            <LocalSearchTab
              query={searchQuery}
              results={localResults}
              isSearching={isLocalSearching}
              onResultClick={(result) => {
                console.log('Local result clicked:', result);
                // Handle result click (open file, navigate, etc.)
              }}
            />
          ) : (
            <AISearchTab
              query={searchQuery}
              results={aiResults}
              isSearching={isAISearching}
              searchHistory={searchHistory}
              onResultClick={(result) => {
                console.log('AI result clicked:', result);
                // Handle result click
              }}
              onHistoryClick={(query) => {
                setSearchQuery(query);
                performAISearch(query);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;