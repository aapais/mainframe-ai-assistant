import React, { useState, useCallback } from 'react';
import { SimpleSearchBar } from './SimpleSearchBar';
import { SimpleEntryList } from './SimpleEntryList';
import { SearchResult } from '../hooks/useIPC';

interface SimpleKnowledgeBaseProps {
  className?: string;
}

export function SimpleKnowledgeBase({ className = "" }: SimpleKnowledgeBaseProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<SearchResult | null>(null);

  const handleSearchResults = useCallback((results: SearchResult[]) => {
    setSearchResults(results);
    setSelectedEntry(null); // Clear selection when new results come in
  }, []);

  const handleEntrySelect = useCallback((entry: SearchResult) => {
    setSelectedEntry(entry);
  }, []);

  const handleBackToResults = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  if (selectedEntry) {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <button
          onClick={handleBackToResults}
          className="mb-6 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600
                     hover:text-blue-700 transition-colors"
        >
          ← Back to results
        </button>

        <article className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <h1 className="text-2xl font-bold text-gray-900">{selectedEntry.title}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                               ${selectedEntry.severity === 'high' ? 'bg-red-100 text-red-800' :
                                 selectedEntry.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                 'bg-green-100 text-green-800'}`}>
                {selectedEntry.severity.toUpperCase()}
              </span>
            </div>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {selectedEntry.category}
              </span>
              <span>
                Created: {new Date(selectedEntry.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Problem Description</h2>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedEntry.problem}</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Solution</h2>
              <div className="prose prose-sm max-w-none">
                <div className="text-gray-700 whitespace-pre-wrap">{selectedEntry.solution}</div>
              </div>
            </section>

            {selectedEntry.tags && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {(typeof selectedEntry.tags === 'string' ? JSON.parse(selectedEntry.tags) : selectedEntry.tags)
                    .map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm
                                   bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </section>
            )}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Mainframe Knowledge Base
        </h1>
        <p className="text-gray-600 mb-6">
          Search for solutions to common mainframe errors and issues
        </p>
        <SimpleSearchBar onResults={handleSearchResults} />
      </div>

      <SimpleEntryList
        entries={searchResults}
        onEntrySelect={handleEntrySelect}
      />
    </div>
  );
}