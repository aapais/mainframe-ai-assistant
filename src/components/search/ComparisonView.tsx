import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RankingIndicator, { RankingData } from './RankingIndicator';
import RelevanceScore, { RelevanceScoreData } from './RelevanceScore';
import RankingExplanation, { ExplanationData } from './RankingExplanation';
import MatchHighlighter, { MatchData } from './MatchHighlighter';

export interface ComparisonItem {
  id: string;
  title: string;
  content: string;
  ranking: RankingData;
  relevanceScore: RelevanceScoreData;
  explanation: ExplanationData;
  matchData: MatchData;
  metadata?: Record<string, any>;
  thumbnailUrl?: string;
  url?: string;
}

export interface ComparisonViewProps {
  items: ComparisonItem[];
  selectedItems?: string[];
  maxItems?: number;
  comparisonMode?: 'side-by-side' | 'overlay' | 'tabbed' | 'cards';
  showRankings?: boolean;
  showScores?: boolean;
  showExplanations?: boolean;
  showMatches?: boolean;
  animated?: boolean;
  sortBy?: 'rank' | 'score' | 'title' | 'relevance' | 'custom';
  sortOrder?: 'asc' | 'desc';
  className?: string;
  onItemSelect?: (itemId: string, selected: boolean) => void;
  onItemClick?: (item: ComparisonItem) => void;
  onCompare?: (items: ComparisonItem[]) => void;
  'aria-label'?: string;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  items,
  selectedItems = [],
  maxItems = 4,
  comparisonMode = 'side-by-side',
  showRankings = true,
  showScores = true,
  showExplanations = true,
  showMatches = true,
  animated = true,
  sortBy = 'rank',
  sortOrder = 'asc',
  className = '',
  onItemSelect,
  onItemClick,
  onCompare,
  'aria-label': ariaLabel
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const sortedItems = useMemo(() => {
    const itemsToSort = [...items].slice(0, maxItems);

    return itemsToSort.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'rank':
          comparison = a.ranking.rank - b.ranking.rank;
          break;
        case 'score':
          comparison = b.relevanceScore.overall - a.relevanceScore.overall;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'relevance':
          comparison = b.ranking.score - a.ranking.score;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [items, maxItems, sortBy, sortOrder]);

  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleItemSelect = (itemId: string) => {
    const isSelected = selectedItems.includes(itemId);
    onItemSelect?.(itemId, !isSelected);
  };

  const renderItemCard = (item: ComparisonItem, index: number) => {
    const isSelected = selectedItems.includes(item.id);
    const isExpanded = expandedItems.has(item.id);

    return (
      <motion.div
        key={item.id}
        className={`
          comparison-item border rounded-lg p-4 bg-white shadow-sm
          ${isSelected ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-200'}
          hover:shadow-md transition-shadow duration-200
          cursor-pointer
        `}
        layout
        initial={animated ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        onClick={() => onItemClick?.(item)}
        role="article"
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onItemClick?.(item);
          }
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Thumbnail */}
            {item.thumbnailUrl && (
              <img
                src={item.thumbnailUrl}
                alt=""
                className="w-12 h-12 rounded object-cover flex-shrink-0"
              />
            )}

            {/* Title and metadata */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {showMatches ? (
                  <MatchHighlighter
                    matchData={item.matchData}
                    maxLength={60}
                    truncateStrategy="middle"
                  />
                ) : (
                  item.title
                )}
              </h3>
              {item.url && (
                <p className="text-xs text-gray-500 truncate mt-1">
                  {item.url}
                </p>
              )}
            </div>
          </div>

          {/* Selection checkbox */}
          {onItemSelect && (
            <label className="flex items-center ml-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleItemSelect(item.id)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                aria-label={`Select ${item.title} for comparison`}
              />
            </label>
          )}
        </div>

        {/* Rankings and Scores */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {showRankings && (
              <RankingIndicator
                ranking={item.ranking}
                displayMode="compact"
                showTrend
                animated={animated}
              />
            )}

            {showScores && (
              <RelevanceScore
                scoreData={item.relevanceScore}
                displayMode="simple"
                size="small"
                animated={animated}
              />
            )}
          </div>

          {showExplanations && (
            <RankingExplanation
              explanation={item.explanation}
              trigger={
                <button
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Show ranking explanation"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </button>
              }
              showOnHover
            />
          )}
        </div>

        {/* Content Preview */}
        <div className="text-sm text-gray-600">
          {showMatches ? (
            <MatchHighlighter
              matchData={{ ...item.matchData, text: item.content }}
              maxLength={isExpanded ? 500 : 150}
              truncateStrategy="around-matches"
              animated={animated}
            />
          ) : (
            <p className={isExpanded ? '' : 'line-clamp-3'}>
              {item.content}
            </p>
          )}
        </div>

        {/* Expand/Collapse */}
        {item.content.length > 150 && (
          <button
            className="text-blue-600 hover:text-blue-800 text-xs mt-2 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              toggleItemExpansion(item.id);
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Show less' : 'Show more'}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </motion.div>
    );
  };

  const renderSideBySide = () => (
    <div className={`grid gap-4 ${
      sortedItems.length === 1 ? 'grid-cols-1' :
      sortedItems.length === 2 ? 'grid-cols-2' :
      sortedItems.length === 3 ? 'grid-cols-3' :
      'grid-cols-2 lg:grid-cols-4'
    }`}>
      {sortedItems.map((item, index) => renderItemCard(item, index))}
    </div>
  );

  const renderOverlay = () => {
    const [primaryItem, ...secondaryItems] = sortedItems;

    return (
      <div className="relative">
        {/* Primary item */}
        {primaryItem && (
          <div className="mb-6">
            {renderItemCard(primaryItem, 0)}
          </div>
        )}

        {/* Secondary items overlay */}
        {secondaryItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {secondaryItems.map((item, index) => (
              <div key={item.id} className="opacity-75 hover:opacity-100 transition-opacity">
                {renderItemCard(item, index + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTabbed = () => (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-8">
          {sortedItems.map((item, index) => (
            <button
              key={item.id}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === index
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              onClick={() => setActiveTab(index)}
              aria-selected={activeTab === index}
              role="tab"
            >
              <div className="flex items-center space-x-2">
                {showRankings && (
                  <RankingIndicator
                    ranking={item.ranking}
                    displayMode="compact"
                    size="small"
                    animated={false}
                  />
                )}
                <span className="truncate max-w-24">
                  {item.title}
                </span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {sortedItems[activeTab] && (
          <motion.div
            key={activeTab}
            initial={animated ? { opacity: 0, x: 20 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={animated ? { opacity: 0, x: -20 } : false}
            transition={{ duration: 0.2 }}
          >
            {renderItemCard(sortedItems[activeTab], activeTab)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderCards = () => (
    <div className="space-y-4">
      {sortedItems.map((item, index) => (
        <motion.div
          key={item.id}
          layout
          initial={animated ? { opacity: 0, scale: 0.95 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          {renderItemCard(item, index)}
        </motion.div>
      ))}
    </div>
  );

  const renderComparisonMode = () => {
    switch (comparisonMode) {
      case 'overlay': return renderOverlay();
      case 'tabbed': return renderTabbed();
      case 'cards': return renderCards();
      default: return renderSideBySide();
    }
  };

  return (
    <div
      className={`comparison-view ${className}`}
      aria-label={ariaLabel || `Comparison view showing ${sortedItems.length} items`}
      role="region"
    >
      {/* Header with controls */}
      {(onCompare || selectedItems.length > 0) && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedItems.length} of {sortedItems.length} selected
            </span>
            {selectedItems.length > 1 && onCompare && (
              <button
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                onClick={() => {
                  const selectedItemsData = sortedItems.filter(item =>
                    selectedItems.includes(item.id)
                  );
                  onCompare(selectedItemsData);
                }}
              >
                Compare Selected
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={comparisonMode}
              onChange={(e) => {
                // This would need to be handled by parent component
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
              aria-label="Comparison view mode"
            >
              <option value="side-by-side">Side by Side</option>
              <option value="overlay">Overlay</option>
              <option value="tabbed">Tabbed</option>
              <option value="cards">Cards</option>
            </select>
          </div>
        </div>
      )}

      {/* Comparison Content */}
      {renderComparisonMode()}
    </div>
  );
};

export default ComparisonView;