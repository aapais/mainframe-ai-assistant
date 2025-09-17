/**
 * SearchCommand Component - Global Settings Search with Cmd+K Shortcut
 *
 * Features:
 * - Global keyboard shortcut (Cmd+K or Ctrl+K)
 * - Fuzzy search across all settings
 * - Results grouped by category
 * - Recent searches
 * - Direct navigation to settings
 * - Modal overlay design
 * - Icons for each result type
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Clock,
  ArrowRight,
  Settings,
  User,
  Cloud,
  DollarSign,
  BarChart3,
  Wrench,
  Key,
  Sliders,
  AlertTriangle,
  FileText,
  Layout,
  Zap,
  Shield,
  Code,
  Monitor,
  X,
  Command
} from 'lucide-react';
import { Modal, ModalContent } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

// Types
interface SearchResult {
  id: string;
  title: string;
  description: string;
  path: string;
  category: string;
  categoryIcon: React.ReactNode;
  categoryColor: string;
  icon: React.ReactNode;
  keywords: string[];
  section?: string;
  badge?: string;
  score: number;
}

interface SearchCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  results: SearchResult[];
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: number;
  resultPath?: string;
}

interface SearchCommandProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  className?: string;
}

// Settings data structure for search
const settingsSearchData: Omit<SearchResult, 'score'>[] = [
  // General Settings
  {
    id: 'profile-basic',
    title: 'Profile Settings',
    description: 'Manage your personal information, name, email, and avatar',
    path: '/settings/general/profile',
    category: 'General',
    categoryIcon: <Settings className="w-4 h-4" />,
    categoryColor: '#A100FF',
    icon: <User className="w-4 h-4" />,
    keywords: ['profile', 'user', 'personal', 'info', 'name', 'email', 'avatar', 'photo'],
    section: 'Basic Information'
  },
  {
    id: 'preferences-appearance',
    title: 'Appearance',
    description: 'Theme, colors, and visual preferences',
    path: '/settings/general/preferences/appearance',
    category: 'General',
    categoryIcon: <Settings className="w-4 h-4" />,
    categoryColor: '#A100FF',
    icon: <Sliders className="w-4 h-4" />,
    keywords: ['appearance', 'theme', 'dark', 'light', 'colors', 'visual', 'ui', 'interface'],
    section: 'Preferences'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Alert preferences and notification settings',
    path: '/settings/general/preferences/notifications',
    category: 'General',
    categoryIcon: <Settings className="w-4 h-4" />,
    categoryColor: '#A100FF',
    icon: <AlertTriangle className="w-4 h-4" />,
    keywords: ['notifications', 'alerts', 'sounds', 'email', 'push', 'preferences']
  },

  // API Configuration
  {
    id: 'api-keys',
    title: 'API Keys',
    description: 'Manage API keys for various AI providers',
    path: '/settings/api/keys',
    category: 'API',
    categoryIcon: <Cloud className="w-4 h-4" />,
    categoryColor: '#2563EB',
    icon: <Key className="w-4 h-4" />,
    keywords: ['api', 'keys', 'tokens', 'authentication', 'providers', 'openai', 'anthropic'],
    badge: 'Required'
  },
  {
    id: 'openai-settings',
    title: 'OpenAI Configuration',
    description: 'GPT models and OpenAI specific settings',
    path: '/settings/api/providers/openai',
    category: 'API',
    categoryIcon: <Cloud className="w-4 h-4" />,
    categoryColor: '#2563EB',
    icon: <Cloud className="w-4 h-4" />,
    keywords: ['openai', 'gpt', 'chatgpt', 'models', 'configuration', 'ai', 'provider']
  },
  {
    id: 'anthropic-settings',
    title: 'Anthropic Configuration',
    description: 'Claude models and Anthropic settings',
    path: '/settings/api/providers/anthropic',
    category: 'API',
    categoryIcon: <Cloud className="w-4 h-4" />,
    categoryColor: '#2563EB',
    icon: <Cloud className="w-4 h-4" />,
    keywords: ['anthropic', 'claude', 'models', 'configuration', 'ai', 'provider']
  },
  {
    id: 'gemini-settings',
    title: 'Google Gemini',
    description: 'Gemini models and Google AI configuration',
    path: '/settings/api/providers/gemini',
    category: 'API',
    categoryIcon: <Cloud className="w-4 h-4" />,
    categoryColor: '#2563EB',
    icon: <Cloud className="w-4 h-4" />,
    keywords: ['google', 'gemini', 'bard', 'models', 'configuration', 'ai', 'provider']
  },

  // Cost Management
  {
    id: 'budget-settings',
    title: 'Budget Settings',
    description: 'Set spending limits and cost controls',
    path: '/settings/cost/budget',
    category: 'Cost Management',
    categoryIcon: <DollarSign className="w-4 h-4" />,
    categoryColor: '#059669',
    icon: <DollarSign className="w-4 h-4" />,
    keywords: ['budget', 'limits', 'spending', 'cost', 'money', 'financial', 'expenses']
  },
  {
    id: 'cost-alerts',
    title: 'Cost Alerts',
    description: 'Configure cost alerts and spending notifications',
    path: '/settings/cost/alerts',
    category: 'Cost Management',
    categoryIcon: <DollarSign className="w-4 h-4" />,
    categoryColor: '#059669',
    icon: <AlertTriangle className="w-4 h-4" />,
    keywords: ['alerts', 'notifications', 'warnings', 'thresholds', 'email', 'cost', 'budget']
  },
  {
    id: 'cost-reports',
    title: 'Usage Reports',
    description: 'Usage reports and cost analysis',
    path: '/settings/cost/reports',
    category: 'Cost Management',
    categoryIcon: <DollarSign className="w-4 h-4" />,
    categoryColor: '#059669',
    icon: <FileText className="w-4 h-4" />,
    keywords: ['reports', 'analytics', 'usage', 'statistics', 'analysis', 'cost', 'billing']
  },

  // Dashboard
  {
    id: 'widget-config',
    title: 'Widget Configuration',
    description: 'Customize dashboard widgets and layout',
    path: '/settings/dashboard/widgets',
    category: 'Dashboard',
    categoryIcon: <BarChart3 className="w-4 h-4" />,
    categoryColor: '#DC2626',
    icon: <Layout className="w-4 h-4" />,
    keywords: ['widgets', 'dashboard', 'layout', 'customize', 'display', 'components']
  },
  {
    id: 'layout-settings',
    title: 'Layout Settings',
    description: 'Dashboard layout and organization options',
    path: '/settings/dashboard/layout',
    category: 'Dashboard',
    categoryIcon: <BarChart3 className="w-4 h-4" />,
    categoryColor: '#DC2626',
    icon: <Monitor className="w-4 h-4" />,
    keywords: ['layout', 'grid', 'columns', 'rows', 'arrangement', 'responsive', 'dashboard']
  },

  // Advanced
  {
    id: 'performance-settings',
    title: 'Performance',
    description: 'Application performance and optimization settings',
    path: '/settings/advanced/performance',
    category: 'Advanced',
    categoryIcon: <Wrench className="w-4 h-4" />,
    categoryColor: '#7C2D12',
    icon: <Zap className="w-4 h-4" />,
    keywords: ['performance', 'speed', 'optimization', 'cache', 'memory', 'fast']
  },
  {
    id: 'security-settings',
    title: 'Security',
    description: 'Security settings and access controls',
    path: '/settings/advanced/security',
    category: 'Advanced',
    categoryIcon: <Wrench className="w-4 h-4" />,
    categoryColor: '#7C2D12',
    icon: <Shield className="w-4 h-4" />,
    keywords: ['security', 'privacy', 'encryption', 'access', 'authentication', 'protection']
  },
  {
    id: 'developer-settings',
    title: 'Developer Tools',
    description: 'Developer tools and debugging options',
    path: '/settings/advanced/developer',
    category: 'Advanced',
    categoryIcon: <Wrench className="w-4 h-4" />,
    categoryColor: '#7C2D12',
    icon: <Code className="w-4 h-4" />,
    keywords: ['developer', 'debug', 'logging', 'api', 'tools', 'console', 'dev']
  }
];

// Platform detection
const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

// Recent searches storage key
const RECENT_SEARCHES_KEY = 'settings-search-recent';
const MAX_RECENT_SEARCHES = 5;

export const SearchCommand: React.FC<SearchCommandProps> = ({
  isOpen,
  onOpenChange,
  onNavigate,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showingRecent, setShowingRecent] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearches = useCallback((searches: RecentSearch[]) => {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch (error) {
      console.warn('Failed to save recent searches:', error);
    }
  }, []);

  // Add to recent searches
  const addToRecentSearches = useCallback((query: string, resultPath?: string) => {
    if (!query.trim()) return;

    const newSearch: RecentSearch = {
      id: `${Date.now()}-${Math.random()}`,
      query: query.trim(),
      timestamp: Date.now(),
      resultPath
    };

    setRecentSearches(prev => {
      // Remove any existing search with the same query
      const filtered = prev.filter(search => search.query !== newSearch.query);
      const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(updated);
      return updated;
    });
  }, [saveRecentSearches]);

  // Fuzzy search function
  const fuzzySearch = useCallback((searchQuery: string, text: string, keywords: string[] = []): number => {
    if (!searchQuery.trim()) return 0;

    const query = searchQuery.toLowerCase();
    const searchText = text.toLowerCase();
    const allKeywords = keywords.join(' ').toLowerCase();

    let score = 0;

    // Exact match (highest score)
    if (searchText.includes(query)) {
      score += 100;
      if (searchText.startsWith(query)) score += 50;
    }

    // Keyword matches
    if (allKeywords.includes(query)) {
      score += 80;
    }

    // Fuzzy matching - characters in order
    let queryIndex = 0;
    let textIndex = 0;
    let matches = 0;

    while (queryIndex < query.length && textIndex < searchText.length) {
      if (query[queryIndex] === searchText[textIndex]) {
        matches++;
        queryIndex++;
      }
      textIndex++;
    }

    if (matches === query.length) {
      score += 60 * (matches / searchText.length);
    }

    // Word boundary matches
    const words = searchText.split(' ');
    words.forEach(word => {
      if (word.startsWith(query)) {
        score += 40;
      }
    });

    return score;
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const results = settingsSearchData
      .map(item => {
        const titleScore = fuzzySearch(query, item.title, item.keywords);
        const descriptionScore = fuzzySearch(query, item.description, item.keywords) * 0.7;
        const keywordScore = fuzzySearch(query, item.keywords.join(' ')) * 0.9;

        const totalScore = titleScore + descriptionScore + keywordScore;

        return {
          ...item,
          score: totalScore
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return results;
  }, [query, fuzzySearch]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchCategory> = {};

    searchResults.forEach(result => {
      if (!groups[result.category]) {
        groups[result.category] = {
          id: result.category,
          title: result.category,
          icon: result.categoryIcon,
          color: result.categoryColor,
          results: []
        };
      }
      groups[result.category].results.push(result);
    });

    return Object.values(groups).sort((a, b) => {
      // Sort categories by total relevance score
      const aScore = a.results.reduce((sum, r) => sum + r.score, 0);
      const bScore = b.results.reduce((sum, r) => sum + r.score, 0);
      return bScore - aScore;
    });
  }, [searchResults]);

  // All selectable items (for keyboard navigation)
  const allItems = useMemo(() => {
    if (showingRecent && !query.trim()) {
      return recentSearches.map(search => ({
        type: 'recent' as const,
        id: search.id,
        query: search.query,
        path: search.resultPath
      }));
    }

    const items: Array<{ type: 'result'; result: SearchResult }> = [];
    groupedResults.forEach(group => {
      group.results.forEach(result => {
        items.push({ type: 'result', result });
      });
    });
    return items;
  }, [groupedResults, recentSearches, showingRecent, query]);

  // Handle search input change
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    setShowingRecent(!value.trim());
  }, []);

  // Handle item selection
  const handleSelectItem = useCallback((index: number) => {
    const item = allItems[index];
    if (!item) return;

    if (item.type === 'recent') {
      setQuery(item.query);
      setShowingRecent(false);
      if (item.path) {
        addToRecentSearches(item.query, item.path);
        onNavigate(item.path);
        onOpenChange(false);
      }
    } else {
      addToRecentSearches(query, item.result.path);
      onNavigate(item.result.path);
      onOpenChange(false);
    }
  }, [allItems, query, addToRecentSearches, onNavigate, onOpenChange]);

  // Handle recent search click
  const handleRecentSearchClick = useCallback((search: RecentSearch) => {
    setQuery(search.query);
    setShowingRecent(false);
    if (search.resultPath) {
      onNavigate(search.resultPath);
      onOpenChange(false);
    }
  }, [onNavigate, onOpenChange]);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    saveRecentSearches([]);
  }, [saveRecentSearches]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    [`${isMac ? 'cmd' : 'ctrl'}+k`]: {
      key: `${isMac ? 'cmd' : 'ctrl'}+k`,
      description: 'Open settings search',
      handler: (e) => {
        e.preventDefault();
        onOpenChange(true);
      }
    }
  }, {
    enabled: true,
    preventDefault: true
  });

  // Keyboard navigation
  useKeyboardShortcuts({
    'arrowdown': {
      key: 'arrowdown',
      description: 'Navigate down',
      handler: (e) => {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
      }
    },
    'arrowup': {
      key: 'arrowup',
      description: 'Navigate up',
      handler: (e) => {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
    },
    'enter': {
      key: 'enter',
      description: 'Select item',
      handler: (e) => {
        e.preventDefault();
        handleSelectItem(selectedIndex);
      }
    },
    'escape': {
      key: 'escape',
      description: 'Close search',
      handler: () => {
        onOpenChange(false);
      }
    }
  }, {
    enabled: isOpen,
    context: 'search-command'
  });

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setShowingRecent(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  return (
    <Modal
      open={isOpen}
      onOpenChange={onOpenChange}
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <ModalContent
        size="2xl"
        open={isOpen}
        className="top-[20%] translate-y-[-20%] max-h-[70vh] overflow-hidden p-0"
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search settings..."
            className="border-none bg-transparent text-lg placeholder-gray-400 focus:ring-0 flex-1"
          />
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">
              {isMac ? (
                <><Command className="w-3 h-3 inline mr-1" />K</>
              ) : (
                'Ctrl+K'
              )}
            </kbd>
            <span>to search</span>
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto" ref={resultsRef}>
          {showingRecent && !query.trim() && recentSearches.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Recent Searches
                </h3>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={search.id}
                    onClick={() => handleRecentSearchClick(search)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedIndex === index
                        ? 'bg-purple-50 border-purple-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{search.query}</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && groupedResults.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-3 text-gray-300" />
              <p>No settings found for "{query}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}

          {query.trim() && groupedResults.map((group, groupIndex) => (
            <div key={group.id} className="p-4 border-b border-gray-100 last:border-b-0">
              <h3
                className="text-sm font-medium mb-3 flex items-center"
                style={{ color: group.color }}
              >
                {group.icon}
                <span className="ml-2">{group.title}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {group.results.length}
                </Badge>
              </h3>

              <div className="space-y-1">
                {group.results.map((result, resultIndex) => {
                  // Calculate global index for keyboard navigation
                  let globalIndex = 0;
                  for (let i = 0; i < groupIndex; i++) {
                    globalIndex += groupedResults[i].results.length;
                  }
                  globalIndex += resultIndex;

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelectItem(globalIndex)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedIndex === globalIndex
                          ? 'bg-purple-50 border border-purple-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5 text-gray-500">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {result.title}
                            </h4>
                            {result.badge && (
                              <Badge variant="outline" className="text-xs">
                                {result.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {result.description}
                          </p>
                          {result.section && (
                            <p className="text-xs text-gray-500 mt-1">
                              {result.section}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">↑↓</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">↵</kbd>
                <span>to select</span>
              </div>
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">esc</kbd>
                <span>to close</span>
              </div>
            </div>
            <div className="text-gray-400">
              {query.trim() && `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
};

export default SearchCommand;