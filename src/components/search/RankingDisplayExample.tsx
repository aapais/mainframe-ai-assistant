import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RankingIndicator, { RankingData } from './RankingIndicator';
import RelevanceScore, { RelevanceScoreData } from './RelevanceScore';
import RankingExplanation, { ExplanationData } from './RankingExplanation';
import MatchHighlighter, { MatchData } from './MatchHighlighter';
import ComparisonView, { ComparisonItem } from './ComparisonView';

// Example data generator
const generateSampleData = (): ComparisonItem[] => {
  const sampleItems: ComparisonItem[] = [
    {
      id: '1',
      title: 'React Performance Optimization Techniques',
      content: 'Learn how to optimize React applications for better performance using memo, useMemo, useCallback, and code splitting techniques. This comprehensive guide covers advanced patterns and real-world examples.',
      ranking: {
        rank: 1,
        previousRank: 3,
        score: 95,
        maxScore: 100,
        confidence: 0.92,
        matchQuality: 'exact',
        trendDirection: 'up'
      },
      relevanceScore: {
        overall: 95,
        factors: {
          keywordMatch: 0.98,
          semanticSimilarity: 0.91,
          contextRelevance: 0.89,
          freshness: 0.85,
          authority: 0.93,
          userBehavior: 0.87
        },
        maxScore: 100,
        explanation: 'High relevance due to exact keyword matches and strong semantic similarity',
        confidence: 0.92
      },
      explanation: {
        title: 'Why this ranks #1',
        summary: 'Perfect keyword match with high authority and recent updates',
        factors: [
          {
            name: 'Keyword Match',
            value: 0.98,
            weight: 0.25,
            description: 'Exact match for "React Performance Optimization"',
            impact: 'positive'
          },
          {
            name: 'Content Authority',
            value: 0.93,
            weight: 0.20,
            description: 'High-quality technical content from trusted source',
            impact: 'positive'
          },
          {
            name: 'Recency',
            value: 0.85,
            weight: 0.15,
            description: 'Updated within last 6 months',
            impact: 'positive'
          }
        ],
        reasoning: 'This article ranks highest due to exact keyword matching, authoritative content, and comprehensive coverage of the topic.',
        suggestions: [
          'Content is well-optimized for search queries',
          'Strong technical depth appeals to target audience'
        ],
        confidence: 0.92,
        algorithm: 'Hybrid ML',
        timestamp: new Date()
      },
      matchData: {
        text: 'React Performance Optimization Techniques - Learn how to optimize React applications',
        matches: [
          {
            start: 0,
            end: 5,
            type: 'exact',
            score: 1.0,
            query: 'React'
          },
          {
            start: 6,
            end: 17,
            type: 'exact',
            score: 1.0,
            query: 'Performance'
          },
          {
            start: 18,
            end: 30,
            type: 'exact',
            score: 1.0,
            query: 'Optimization'
          }
        ]
      },
      url: 'https://example.com/react-performance',
      thumbnailUrl: 'https://via.placeholder.com/150x100?text=React'
    },
    {
      id: '2',
      title: 'Vue.js Performance Best Practices',
      content: 'Discover performance optimization strategies for Vue.js applications. From component optimization to bundle splitting, learn techniques to make your Vue apps faster.',
      ranking: {
        rank: 2,
        previousRank: 1,
        score: 78,
        maxScore: 100,
        confidence: 0.84,
        matchQuality: 'partial',
        trendDirection: 'down'
      },
      relevanceScore: {
        overall: 78,
        factors: {
          keywordMatch: 0.65,
          semanticSimilarity: 0.88,
          contextRelevance: 0.82,
          freshness: 0.90,
          authority: 0.75
        },
        maxScore: 100,
        explanation: 'Good semantic match for performance topics despite different framework',
        confidence: 0.84
      },
      explanation: {
        title: 'Why this ranks #2',
        summary: 'Strong semantic similarity despite framework difference',
        factors: [
          {
            name: 'Semantic Similarity',
            value: 0.88,
            weight: 0.30,
            description: 'Similar performance optimization concepts',
            impact: 'positive'
          },
          {
            name: 'Framework Match',
            value: 0.0,
            weight: 0.20,
            description: 'Different framework (Vue vs React)',
            impact: 'negative'
          }
        ],
        reasoning: 'While this covers a different framework, the performance optimization concepts are highly relevant.',
        confidence: 0.84,
        algorithm: 'Semantic ML',
        timestamp: new Date()
      },
      matchData: {
        text: 'Vue.js Performance Best Practices - performance optimization strategies',
        matches: [
          {
            start: 7,
            end: 18,
            type: 'partial',
            score: 0.9,
            query: 'Performance'
          },
          {
            start: 38,
            end: 49,
            type: 'semantic',
            score: 0.8,
            query: 'optimization'
          }
        ]
      },
      url: 'https://example.com/vue-performance'
    },
    {
      id: '3',
      title: 'JavaScript Memory Management and Optimization',
      content: 'Understanding memory management in JavaScript and techniques to optimize memory usage. Learn about garbage collection, memory leaks, and performance monitoring.',
      ranking: {
        rank: 3,
        previousRank: 2,
        score: 72,
        maxScore: 100,
        confidence: 0.76,
        matchQuality: 'semantic',
        trendDirection: 'down'
      },
      relevanceScore: {
        overall: 72,
        factors: {
          keywordMatch: 0.45,
          semanticSimilarity: 0.85,
          contextRelevance: 0.70,
          freshness: 0.60,
          authority: 0.80
        },
        maxScore: 100,
        explanation: 'Related to performance but broader JavaScript focus',
        confidence: 0.76
      },
      explanation: {
        title: 'Why this ranks #3',
        summary: 'Broader JavaScript performance topic with good authority',
        factors: [
          {
            name: 'Topic Relevance',
            value: 0.85,
            weight: 0.25,
            description: 'Memory optimization relates to performance',
            impact: 'positive'
          },
          {
            name: 'Specificity',
            value: 0.45,
            weight: 0.15,
            description: 'Less specific to React optimization',
            impact: 'negative'
          }
        ],
        reasoning: 'Covers important performance concepts but at a more general JavaScript level.',
        confidence: 0.76,
        algorithm: 'Semantic ML',
        timestamp: new Date()
      },
      matchData: {
        text: 'JavaScript Memory Management and Optimization techniques',
        matches: [
          {
            start: 35,
            end: 47,
            type: 'semantic',
            score: 0.7,
            query: 'Optimization'
          }
        ]
      },
      url: 'https://example.com/js-memory'
    }
  ];

  return sampleItems;
};

const RankingDisplayExample: React.FC = () => {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'overlay' | 'tabbed' | 'cards'>('side-by-side');
  const [displayMode, setDisplayMode] = useState<'numeric' | 'visual' | 'compact' | 'detailed'>('numeric');
  const [sampleData, setSampleData] = useState<ComparisonItem[]>([]);

  useEffect(() => {
    setSampleData(generateSampleData());
  }, []);

  const handleItemSelect = (itemId: string, selected: boolean) => {
    setSelectedItems(prev =>
      selected
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    );
  };

  const handleCompare = (items: ComparisonItem[]) => {
    console.log('Comparing items:', items);
    // Here you would typically open a detailed comparison modal or navigate to a comparison page
  };

  const handleItemClick = (item: ComparisonItem) => {
    console.log('Item clicked:', item);
    // Here you would typically navigate to the item's detail page
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Ranking Display System Demo
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          This demonstrates the comprehensive ranking visualization system with multiple
          indicators, relevance scores, explanations, and comparison views.
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Display Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ranking Display Mode
            </label>
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="numeric">Numeric</option>
              <option value="visual">Visual (Stars)</option>
              <option value="compact">Compact</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comparison View Mode
            </label>
            <select
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="side-by-side">Side by Side</option>
              <option value="overlay">Overlay</option>
              <option value="tabbed">Tabbed</option>
              <option value="cards">Cards</option>
            </select>
          </div>
        </div>
      </div>

      {/* Individual Component Demos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ranking Indicators */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Ranking Indicators</h2>
          <div className="space-y-4">
            {sampleData.map((item) => (
              <div key={`indicator-${item.id}`} className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.title.substring(0, 30)}...</span>
                <RankingIndicator
                  ranking={item.ranking}
                  displayMode={displayMode}
                  showTrend
                  showScore
                  showConfidence
                  animated
                />
              </div>
            ))}
          </div>
        </div>

        {/* Relevance Scores */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Relevance Scores</h2>
          <div className="space-y-4">
            {sampleData.map((item) => (
              <div key={`score-${item.id}`} className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.title.substring(0, 30)}...</span>
                <RelevanceScore
                  scoreData={item.relevanceScore}
                  displayMode="simple"
                  animated
                />
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Relevance Breakdown */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
          <RelevanceScore
            scoreData={sampleData[0]?.relevanceScore}
            displayMode="breakdown"
            showFactors
            animated
          />
        </div>

        {/* Match Highlighting */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Match Highlighting</h2>
          <div className="space-y-3">
            {sampleData.map((item) => (
              <div key={`match-${item.id}`} className="p-3 bg-gray-50 rounded">
                <MatchHighlighter
                  matchData={item.matchData}
                  animated
                  showTooltips
                  maxLength={100}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ranking Explanations Demo */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Ranking Explanations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sampleData.map((item) => (
            <RankingExplanation
              key={`explanation-${item.id}`}
              explanation={item.explanation}
              trigger={
                <div className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <RankingIndicator
                      ranking={item.ranking}
                      displayMode="compact"
                      animated={false}
                    />
                    <span className="text-xs text-gray-500">
                      Hover for details
                    </span>
                  </div>
                  <h3 className="font-medium text-sm">{item.title}</h3>
                </div>
              }
              showOnHover
              placement="auto"
            />
          ))}
        </div>
      </div>

      {/* Comparison View */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Comparison View</h2>
        <ComparisonView
          items={sampleData}
          selectedItems={selectedItems}
          comparisonMode={comparisonMode}
          showRankings
          showScores
          showExplanations
          showMatches
          animated
          onItemSelect={handleItemSelect}
          onItemClick={handleItemClick}
          onCompare={handleCompare}
        />
      </div>

      {/* Visual Score Examples */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Visual Score Displays</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3">Circular Progress</h3>
            <RelevanceScore
              scoreData={sampleData[0]?.relevanceScore}
              displayMode="visual"
              size="large"
              colorScheme="gradient"
              animated
            />
          </div>

          <div className="text-center">
            <h3 className="text-sm font-medium mb-3">Gauge Display</h3>
            <RelevanceScore
              scoreData={sampleData[1]?.relevanceScore}
              displayMode="gauge"
              colorScheme="gradient"
              animated
            />
          </div>

          <div className="text-center">
            <h3 className="text-sm font-medium mb-3">Detailed View</h3>
            <RelevanceScore
              scoreData={sampleData[2]?.relevanceScore}
              displayMode="detailed"
              showExplanation
              animated
            />
          </div>
        </div>
      </div>

      {/* Animation Showcase */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Animation Showcase</h2>
        <p className="text-sm text-gray-600 mb-4">
          Click to trigger re-ranking animations
        </p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={() => {
            // Simulate ranking changes
            const shuffled = [...sampleData];
            shuffled.forEach((item, index) => {
              item.ranking = {
                ...item.ranking,
                previousRank: item.ranking.rank,
                rank: (index + 2) % sampleData.length + 1,
                trendDirection: Math.random() > 0.5 ? 'up' : 'down'
              };
            });
            setSampleData(shuffled);
          }}
        >
          Shuffle Rankings
        </button>
      </div>
    </div>
  );
};

export default RankingDisplayExample;