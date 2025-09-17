import React from 'react';
import { FileText, Settings, Users, Clock, Database, Tag, ExternalLink, Calendar } from 'lucide-react';
import { SearchResult } from '../../views/Search';

interface LocalSearchTabProps {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  onResultClick: (result: SearchResult) => void;
}

const LocalSearchTab: React.FC<LocalSearchTabProps> = ({
  query,
  results,
  isSearching,
  onResultClick
}) => {
  const getResultTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'file': return FileText;
      case 'setting': return Settings;
      case 'user': return Users;
      case 'log': return Clock;
      case 'data': return Database;
      case 'analysis': return Database;
      case 'pattern': return Database;
      case 'recommendation': return Database;
      case 'insight': return Database;
      default: return Tag;
    }
  };

  const getResultTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'file': return 'text-blue-600 dark:text-blue-400';
      case 'setting': return 'text-gray-600 dark:text-gray-400';
      case 'user': return 'text-green-600 dark:text-green-400';
      case 'log': return 'text-orange-600 dark:text-orange-400';
      case 'data': return 'text-purple-600 dark:text-purple-400';
      case 'analysis': return 'text-purple-600 dark:text-purple-400';
      case 'pattern': return 'text-purple-600 dark:text-purple-400';
      case 'recommendation': return 'text-purple-600 dark:text-purple-400';
      case 'insight': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatLastModified = (date?: Date) => {
    if (!date) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <span>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Group results by type
  const groupedResults = results.reduce((groups, result) => {
    const type = result.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(result);
    return groups;
  }, {} as Record<SearchResult['type'], SearchResult[]>);

  const typeLabels = {
    file: 'Files',
    setting: 'Settings',
    user: 'Users',
    log: 'Logs',
    data: 'Data',
    analysis: 'Analysis',
    pattern: 'Patterns',
    recommendation: 'Recommendations',
    insight: 'Insights'
  };

  if (!query.trim()) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Local Search
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Search through files, settings, users, and system data instantly. Results appear as you type.
        </p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-lg mx-auto">
          {Object.entries(typeLabels).map(([type, label]) => {
            const Icon = getResultTypeIcon(type as SearchResult['type']);
            const colorClass = getResultTypeColor(type as SearchResult['type']);
            
            return (
              <div key={type} className="text-center">
                <Icon className={`w-8 h-8 mx-auto mb-2 ${colorClass}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Searching...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No results found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Try different keywords or check your spelling.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
        </p>
        <span className="text-xs text-gray-500 dark:text-gray-500">
          Response time: &lt;500ms
        </span>
      </div>

      {/* Grouped Results */}
      {Object.entries(groupedResults).map(([type, typeResults]) => {
        const Icon = getResultTypeIcon(type as SearchResult['type']);
        const colorClass = getResultTypeColor(type as SearchResult['type']);
        const label = typeLabels[type as SearchResult['type']];

        return (
          <div key={type} className="space-y-3">
            <div className="flex items-center space-x-2">
              <Icon className={`w-5 h-5 ${colorClass}`} />
              <h3 className="font-medium text-gray-900 dark:text-white">
                {label} ({typeResults.length})
              </h3>
            </div>
            
            <div className="space-y-2">
              {typeResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => onResultClick(result)}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {highlightText(result.title, query)}
                      </h4>
                      {result.path && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {result.path}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                        {highlightText(result.content, query)}
                      </p>
                      
                      {/* Highlights */}
                      {result.highlights && result.highlights.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.highlights.slice(0, 3).map((highlight, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                            >
                              {highlight}
                            </span>
                          ))}
                          {result.highlights.length > 3 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              +{result.highlights.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {result.lastModified && (
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatLastModified(result.lastModified)}
                        </div>
                      )}
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LocalSearchTab;