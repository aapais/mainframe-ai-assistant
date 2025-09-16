import React from 'react';
import { Clock, Tag, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { SearchResult } from '../hooks/useIPC';

interface SimpleEntryListProps {
  entries: SearchResult[];
  loading?: boolean;
  onEntrySelect?: (entry: SearchResult) => void;
  className?: string;
}

const severityConfig = {
  high: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  medium: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  low: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  }
};

export function SimpleEntryList({
  entries,
  loading = false,
  onEntrySelect,
  className = ""
}: SimpleEntryListProps) {
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                <div className="flex space-x-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-500">
          <p className="text-lg mb-2">No results found</p>
          <p className="text-sm">Try adjusting your search terms or browse categories</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-sm text-gray-600 mb-4">
        Found {entries.length} {entries.length === 1 ? 'result' : 'results'}
      </div>

      {entries.map((entry) => {
        const severity = severityConfig[entry.severity] || severityConfig.medium;
        const SeverityIcon = severity.icon;

        return (
          <article
            key={entry.id}
            className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow
                        cursor-pointer group ${severity.borderColor}`}
            onClick={() => onEntrySelect?.(entry)}
            tabIndex={0}
            role="button"
            aria-label={`View details for ${entry.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEntrySelect?.(entry);
              }
            }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600
                               transition-colors line-clamp-2">
                  {entry.title}
                </h3>
                <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium
                                ${severity.bgColor} ${severity.color}`}>
                  <SeverityIcon className="w-3 h-3 mr-1" />
                  {entry.severity.toUpperCase()}
                </div>
              </div>

              <div className="mb-3">
                <p className="text-gray-700 line-clamp-2 mb-2">
                  <span className="font-medium">Problem:</span> {entry.problem}
                </p>
                <p className="text-gray-600 line-clamp-3 text-sm">
                  <span className="font-medium">Solution:</span> {entry.solution}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
                                   font-medium bg-blue-100 text-blue-800`}>
                    {entry.category}
                  </span>

                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {(typeof entry.tags === 'string' ? JSON.parse(entry.tags) : entry.tags)
                          .slice(0, 3)
                          .map((tag: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs
                                         bg-gray-100 text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                        {(typeof entry.tags === 'string' ? JSON.parse(entry.tags) : entry.tags).length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{(typeof entry.tags === 'string' ? JSON.parse(entry.tags) : entry.tags).length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  <time dateTime={entry.created_at}>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </time>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}