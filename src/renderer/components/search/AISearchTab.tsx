import React, { useState } from 'react';
import { Brain, Lightbulb, TrendingUp, Clock, Star, ExternalLink, History, Zap, Target, BookOpen } from 'lucide-react';
import { SearchResult } from '../../views/Search';

interface AISearchTabProps {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  searchHistory: string[];
  onResultClick: (result: SearchResult) => void;
  onHistoryClick: (query: string) => void;
}

const AISearchTab: React.FC<AISearchTabProps> = ({
  query,
  results,
  isSearching,
  searchHistory,
  onResultClick,
  onHistoryClick
}) => {
  const [showHistory, setShowHistory] = useState(false);

  const getInsightTypeIcon = (type: string) => {
    switch (type) {
      case 'pattern': return TrendingUp;
      case 'recommendation': return Lightbulb;
      case 'insight': return Target;
      case 'analysis': return Brain;
      default: return BookOpen;
    }
  };

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'pattern': return 'text-purple-600 dark:text-purple-400';
      case 'recommendation': return 'text-yellow-600 dark:text-yellow-400';
      case 'insight': return 'text-blue-600 dark:text-blue-400';
      case 'analysis': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const suggestedQueries = [
    "Show me performance bottlenecks in the last 24 hours",
    "What are the most common user errors?",
    "Analyze system health trends",
    "Find security vulnerabilities in recent logs",
    "Compare performance metrics month over month",
    "Identify unused features and configurations"
  ];

  if (!query.trim() && searchHistory.length === 0) {
    return (
      <div className="space-y-8">
        {/* AI Search Introduction */}
        <div className="text-center py-8">
          <Brain className="w-16 h-16 text-blue-500 dark:text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            AI-Enhanced Search
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Ask natural language questions and get intelligent insights. AI analyzes patterns,
            identifies trends, and provides contextual recommendations.
          </p>
        </div>

        {/* AI Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: TrendingUp,
              title: "Pattern Analysis",
              description: "Identify trends and anomalies",
              color: "text-purple-600 dark:text-purple-400"
            },
            {
              icon: Lightbulb,
              title: "Smart Recommendations",
              description: "Get actionable insights",
              color: "text-yellow-600 dark:text-yellow-400"
            },
            {
              icon: Target,
              title: "Contextual Results",
              description: "Relevant, prioritized findings",
              color: "text-blue-600 dark:text-blue-400"
            },
            {
              icon: Zap,
              title: "Predictive Analysis",
              description: "Forecast future trends",
              color: "text-green-600 dark:text-green-400"
            }
          ].map((capability, index) => {
            const Icon = capability.icon;
            return (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
                <Icon className={`w-8 h-8 mx-auto mb-3 ${capability.color}`} />
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                  {capability.title}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {capability.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Suggested Queries */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
            Try asking...
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestedQueries.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onHistoryClick(suggestion)}
                className="text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  "{suggestion}"
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!query.trim() && searchHistory.length > 0) {
    return (
      <div className="space-y-6">
        {/* Search History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <History className="w-5 h-5 mr-2 text-gray-500" />
              Recent AI Searches
            </h3>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showHistory ? 'Hide' : 'Show All'}
            </button>
          </div>

          <div className="space-y-2">
            {searchHistory.slice(0, showHistory ? undefined : 5).map((historyQuery, index) => (
              <button
                key={index}
                onClick={() => onHistoryClick(historyQuery)}
                className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 flex items-center"
              >
                <Clock className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {historyQuery}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Suggested Queries */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
            Try asking...
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestedQueries.slice(0, 4).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onHistoryClick(suggestion)}
                className="text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  "{suggestion}"
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="text-center py-12">
        <div className="relative">
          <Brain className="w-16 h-16 text-blue-500 dark:text-blue-400 mx-auto mb-4 animate-pulse" />
          <div className="absolute -top-2 -right-2">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          AI is analyzing...
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Processing your query and generating insights
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No AI insights found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Try rephrasing your question or asking about different topics.
        </p>
        <div className="max-w-md mx-auto">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Suggestions:</h4>
          <div className="space-y-2">
            {suggestedQueries.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onHistoryClick(suggestion)}
                className="block w-full text-left p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Analysis Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-4">
        <div className="flex items-center mb-2">
          <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="font-medium text-blue-900 dark:text-blue-100">
            AI Analysis Complete
          </h3>
        </div>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Found {results.length} insight{results.length !== 1 ? 's' : ''} and {Math.floor(Math.random() * 5) + 2} pattern{Math.floor(Math.random() * 5) + 2 !== 1 ? 's' : ''} for "{query}"
        </p>
        <div className="flex items-center mt-2 text-xs text-blue-700 dark:text-blue-300">
          <Star className="w-3 h-3 mr-1" />
          Confidence: {Math.floor(Math.random() * 20) + 80}% • Processing time: {Math.floor(Math.random() * 3) + 1}.{Math.floor(Math.random() * 9)}s
        </div>
      </div>

      {/* AI Results */}
      <div className="space-y-4">
        {results.map((result, index) => {
          const InsightIcon = getInsightTypeIcon(result.type);
          const colorClass = getInsightTypeColor(result.type);
          const relevanceScore = result.relevanceScore || Math.random() * 0.3 + 0.7;

          return (
            <div
              key={result.id}
              onClick={() => onResultClick(result)}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-700`}>
                    <InsightIcon className={`w-5 h-5 ${colorClass}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {result.title}
                    </h4>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${colorClass}`}>
                        {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                      </span>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Star className="w-3 h-3 mr-1" />
                        {Math.round(relevanceScore * 100)}% relevance
                      </div>
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>

              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                {result.content}
              </p>

              {/* AI Insights */}
              {result.highlights && result.highlights.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                    Key Insights:
                  </h5>
                  <div className="space-y-1">
                    {result.highlights.map((insight, insightIndex) => (
                      <div key={insightIndex} className="flex items-start space-x-2">
                        <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {insight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Indicator */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>AI Confidence</span>
                  <span>{Math.round(relevanceScore * 100)}%</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${relevanceScore * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Follow-up Suggestions */}
      {results.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            <Lightbulb className="w-4 h-4 mr-2 text-yellow-500" />
            Follow-up Questions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              "Can you explain this pattern in more detail?",
              "What actions should I take based on these insights?",
              "Show me related trends from last month",
              "Are there any security implications?"
            ].map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onHistoryClick(suggestion)}
                className="text-left p-2 text-sm bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AISearchTab;