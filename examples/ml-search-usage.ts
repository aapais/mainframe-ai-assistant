/**
 * ML Search Enhancement System - Usage Examples
 *
 * This file demonstrates how to use the ML-powered search enhancement system
 * for various search scenarios and use cases.
 */

import { MLSearchService } from '../src/services/ml/MLSearchService';
import { TrainingData, MLConfig } from '../src/types/ml';

// Configuration for the ML Search System
const mlConfig: MLConfig = {
  models: {
    querySuggestion: {
      algorithm: 'trie',
      maxSuggestions: 5,
      minConfidence: 0.6
    },
    personalization: {
      algorithm: 'collaborative_filtering',
      features: ['user_history', 'click_patterns', 'time_preferences', 'category_affinity'],
      retrainInterval: 24
    },
    semanticSearch: {
      embeddingModel: 'word2vec',
      dimensions: 100,
      similarity: 'cosine'
    },
    anomalyDetection: {
      algorithm: 'isolation_forest',
      threshold: 0.15,
      windowSize: 100
    }
  },
  training: {
    batchSize: 64,
    epochs: 50,
    validationSplit: 0.2,
    earlyStoppingPatience: 10
  }
};

// Sample training data for initialization
const sampleTrainingData: TrainingData = {
  features: [
    'search for documents',
    'find research papers',
    'machine learning algorithms',
    'how to implement neural networks',
    'compare cloud services',
    'navigate to user settings',
    'download latest reports',
    'filter by date range',
    'sort results by relevance',
    'export data to CSV'
  ],
  labels: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  metadata: {
    searchLogs: [
      { query: 'search for documents', successful: true, clickCount: 25, hasCompletion: true },
      { query: 'find research papers', successful: true, clickCount: 18, hasCompletion: true },
      { query: 'machine learning', successful: true, clickCount: 42, hasCompletion: true }
    ],
    userInteractions: [
      {
        userId: 'user_001',
        query: 'search for documents',
        resultId: 'doc_123',
        clicked: true,
        category: 'documents',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        queryLength: 20,
        userEngagement: 0.85,
        timeOfDay: 10,
        categoryPreference: 'documents',
        clickRank: 1
      },
      {
        userId: 'user_002',
        query: 'machine learning algorithms',
        resultId: 'paper_456',
        clicked: true,
        category: 'research',
        timestamp: new Date('2024-01-15T14:15:00Z'),
        queryLength: 28,
        userEngagement: 0.92,
        timeOfDay: 14,
        categoryPreference: 'research',
        clickRank: 2
      }
    ],
    semanticAnnotations: [
      {
        query: 'search for documents',
        intent: 'search',
        entities: [{ type: 'object', value: 'documents' }],
        context: 'file management'
      },
      {
        query: 'how to implement neural networks',
        intent: 'help',
        entities: [{ type: 'concept', value: 'neural networks' }],
        context: 'technical guidance'
      }
    ],
    timeSeriesMetrics: [
      {
        timestamp: new Date('2024-01-15T09:00:00Z'),
        queryCount: 150,
        responseTime: 120,
        errorRate: 0.008,
        clickThroughRate: 0.78,
        isAnomaly: false
      },
      {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        queryCount: 180,
        responseTime: 135,
        errorRate: 0.012,
        clickThroughRate: 0.82,
        isAnomaly: false
      }
    ],
    optimizationHistory: [
      {
        beforeMetrics: { responseTime: 250, accuracy: 0.75, userSatisfaction: 0.68 },
        optimizationType: 'indexing_optimization',
        improvement: 0.18
      },
      {
        beforeMetrics: { responseTime: 180, accuracy: 0.82, userSatisfaction: 0.75 },
        optimizationType: 'caching_strategy',
        improvement: 0.12
      }
    ]
  }
};

/**
 * Example 1: Basic Setup and Initialization
 */
async function initializeMLSearchSystem(): Promise<MLSearchService> {
  console.log('🚀 Initializing ML Search Enhancement System...');

  const mlSearchService = new MLSearchService(mlConfig);

  try {
    await mlSearchService.initialize(sampleTrainingData);
    console.log('✅ ML Search System initialized successfully!');

    const health = await mlSearchService.getModelHealth();
    console.log('📊 Model Health Status:', health);

    return mlSearchService;
  } catch (error) {
    console.error('❌ Failed to initialize ML Search System:', error);
    throw error;
  }
}

/**
 * Example 2: Basic Search with Suggestions
 */
async function performBasicSearch(mlSearchService: MLSearchService) {
  console.log('\n🔍 Example 2: Basic Search with Suggestions');

  const searchRequest = {
    query: 'machine learning',
    userId: 'demo_user_001'
  };

  try {
    const response = await mlSearchService.search(searchRequest);

    console.log(`📝 Query: "${searchRequest.query}"`);
    console.log(`⏱️  Processing Time: ${response.processingTime}ms`);
    console.log(`📊 Total Results: ${response.totalCount}`);
    console.log('\n💡 Query Suggestions:');
    response.suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. "${suggestion.query}" (confidence: ${suggestion.confidence.toFixed(2)})`);
    });

    if (response.semanticAnalysis) {
      console.log('\n🧠 Semantic Analysis:');
      console.log(`  Intent: ${response.semanticAnalysis.intent}`);
      console.log(`  Expanded Query: "${response.semanticAnalysis.expandedQuery}"`);
      console.log(`  Complexity Score: ${response.semanticAnalysis.complexity.toFixed(2)}`);
      console.log(`  Sentiment Score: ${response.semanticAnalysis.sentiment.toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

/**
 * Example 3: Personalized Search
 */
async function performPersonalizedSearch(mlSearchService: MLSearchService) {
  console.log('\n👤 Example 3: Personalized Search');

  const personalizedRequest = {
    query: 'research papers',
    userId: 'academic_user_001',
    sessionId: 'session_12345',
    personalization: {
      userId: 'academic_user_001',
      searchHistory: [
        'machine learning research',
        'deep learning papers',
        'neural network architectures',
        'computer vision algorithms'
      ],
      clickHistory: [
        'paper_ml_2024_001',
        'paper_dl_2024_045',
        'paper_cv_2024_023'
      ],
      preferences: {
        category: 'academic',
        difficulty: 'advanced',
        recency: 'last_2_years'
      },
      demographics: {
        field: 'computer_science',
        experience_level: 'phd_student'
      },
      sessionContext: {
        current_task: 'literature_review',
        time_budget: 'extended'
      }
    }
  };

  try {
    const response = await mlSearchService.search(personalizedRequest);

    console.log(`📝 Personalized Query: "${personalizedRequest.query}"`);
    console.log(`👤 User Profile: Academic, PhD Student in Computer Science`);
    console.log(`🎯 Personalization Applied: ${response.personalizationApplied}`);
    console.log(`📊 Personalized Results: ${response.results.length}`);

    if (response.results.length > 0) {
      console.log('\n🏆 Top Personalized Results:');
      response.results.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title}`);
        console.log(`     Relevance: ${result.baseRelevanceScore?.toFixed(2) || 'N/A'}`);
        console.log(`     Category: ${result.category}`);
      });
    }

  } catch (error) {
    console.error('❌ Personalized search failed:', error);
  }
}

/**
 * Example 4: Anomaly Detection and Monitoring
 */
async function demonstrateAnomalyDetection(mlSearchService: MLSearchService) {
  console.log('\n🚨 Example 4: Anomaly Detection and Monitoring');

  // Simulate a series of searches to generate metrics
  const queries = [
    'normal search query',
    'another typical search',
    'regular file search',
    'unusual extremely long and complex search query with many technical terms and specifics',
    'typical document search'
  ];

  for (const query of queries) {
    await mlSearchService.search({ query });
  }

  try {
    const insights = await mlSearchService.getSystemInsights();

    console.log('\n📈 System Insights:');
    console.log(`🔍 Recent Anomalies Detected: ${insights.anomalies.length}`);

    if (insights.anomalies.length > 0) {
      console.log('\n⚠️  Anomaly Details:');
      insights.anomalies.forEach((anomaly, index) => {
        console.log(`  ${index + 1}. Type: ${anomaly.type}`);
        console.log(`     Severity: ${anomaly.severity}`);
        console.log(`     Description: ${anomaly.description}`);
        console.log(`     Recommendations: ${anomaly.suggestions.join(', ')}`);
      });
    }

    console.log(`\n🔮 Optimization Opportunities: ${insights.optimizationOpportunities.length}`);
    if (insights.optimizationOpportunities.length > 0) {
      insights.optimizationOpportunities.slice(0, 2).forEach((opportunity, index) => {
        console.log(`  ${index + 1}. ${opportunity.prediction}`);
        console.log(`     Impact: ${opportunity.impact}`);
        console.log(`     Confidence: ${opportunity.confidence.toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to get system insights:', error);
  }
}

/**
 * Example 5: User Interaction Tracking
 */
async function demonstrateUserInteractionTracking(mlSearchService: MLSearchService) {
  console.log('\n📊 Example 5: User Interaction Tracking');

  const userId = 'tracking_demo_user';
  const query = 'machine learning tutorials';

  try {
    // Perform a search
    const response = await mlSearchService.search({ query, userId });

    // Simulate user interactions
    console.log('👆 Simulating user interactions...');

    if (response.results.length > 0) {
      // User clicks on first result
      await mlSearchService.updateUserInteraction(
        userId,
        response.results[0].id,
        query,
        'click',
        { category: 'tutorial', position: 1 }
      );
      console.log('  ✅ Recorded: User clicked on first result');

      // User views second result
      await mlSearchService.updateUserInteraction(
        userId,
        response.results[1]?.id || 'result_2',
        query,
        'view',
        { category: 'tutorial', position: 2 }
      );
      console.log('  👀 Recorded: User viewed second result');

      // User skips third result
      await mlSearchService.updateUserInteraction(
        userId,
        'result_3',
        query,
        'skip',
        { category: 'tutorial', position: 3 }
      );
      console.log('  ⏭️  Recorded: User skipped third result');
    }

    // Get updated suggestions based on interactions
    const updatedResponse = await mlSearchService.search({
      query: 'machine',
      userId
    });

    console.log('\n🎯 Updated Suggestions (based on interactions):');
    updatedResponse.suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. "${suggestion.query}" (${suggestion.source})`);
    });

  } catch (error) {
    console.error('❌ User interaction tracking failed:', error);
  }
}

/**
 * Example 6: Model Retraining and Health Monitoring
 */
async function demonstrateModelManagement(mlSearchService: MLSearchService) {
  console.log('\n🔧 Example 6: Model Management and Health Monitoring');

  try {
    // Check current model health
    const healthBefore = await mlSearchService.getModelHealth();
    console.log('\n📊 Current Model Health:');
    Object.entries(healthBefore).forEach(([modelName, health]: [string, any]) => {
      console.log(`  ${modelName}: ${health.status} (accuracy: ${health.metrics?.accuracy?.toFixed(2) || 'N/A'})`);
    });

    // Simulate new training data
    const newTrainingData: TrainingData = {
      features: [
        ...sampleTrainingData.features,
        'advanced search techniques',
        'semantic query processing',
        'intelligent result ranking'
      ],
      labels: [...sampleTrainingData.labels, 1, 1, 1],
      metadata: {
        ...sampleTrainingData.metadata,
        searchLogs: [
          ...(sampleTrainingData.metadata?.searchLogs || []),
          { query: 'advanced search techniques', successful: true, clickCount: 15, hasCompletion: true }
        ]
      }
    };

    console.log('\n🔄 Retraining models with new data...');
    await mlSearchService.retrainModels(newTrainingData);
    console.log('✅ Model retraining completed!');

    // Check health after retraining
    const healthAfter = await mlSearchService.getModelHealth();
    console.log('\n📈 Updated Model Health:');
    Object.entries(healthAfter).forEach(([modelName, health]: [string, any]) => {
      console.log(`  ${modelName}: ${health.status} (accuracy: ${health.metrics?.accuracy?.toFixed(2) || 'N/A'})`);
    });

    // Get training pipeline metrics
    const pipelineMetrics = mlSearchService.getTrainingPipelineMetrics();
    if (pipelineMetrics) {
      console.log('\n⚙️  Training Pipeline Metrics:');
      console.log(`  Models Trained: ${pipelineMetrics.modelsTrained}`);
      console.log(`  Success Rate: ${(pipelineMetrics.successRate * 100).toFixed(1)}%`);
      console.log(`  Average Accuracy: ${(pipelineMetrics.averageAccuracy * 100).toFixed(1)}%`);
      console.log(`  Best Model: ${pipelineMetrics.bestModel}`);
      console.log(`  Training Time: ${pipelineMetrics.totalTrainingTime}ms`);
    }

  } catch (error) {
    console.error('❌ Model management failed:', error);
  }
}

/**
 * Example 7: Advanced Search Scenarios
 */
async function demonstrateAdvancedSearchScenarios(mlSearchService: MLSearchService) {
  console.log('\n🎯 Example 7: Advanced Search Scenarios');

  const scenarios = [
    {
      name: 'Complex Technical Query',
      request: {
        query: 'how to implement transformer architecture for natural language processing with attention mechanisms',
        userId: 'expert_user'
      }
    },
    {
      name: 'Ambiguous Query',
      request: {
        query: 'bank',
        userId: 'general_user',
        filters: { context: 'financial' }
      }
    },
    {
      name: 'Multi-intent Query',
      request: {
        query: 'compare machine learning frameworks and download installation guides',
        userId: 'developer_user'
      }
    },
    {
      name: 'Typo-laden Query',
      request: {
        query: 'machin learnnig algorihtms tutorail',
        userId: 'novice_user'
      }
    }
  ];

  for (const scenario of scenarios) {
    try {
      console.log(`\n🔍 ${scenario.name}:`);
      console.log(`   Query: "${scenario.request.query}"`);

      const response = await mlSearchService.search(scenario.request);

      if (response.semanticAnalysis) {
        console.log(`   Intent: ${response.semanticAnalysis.intent}`);
        console.log(`   Complexity: ${response.semanticAnalysis.complexity.toFixed(2)}`);
        console.log(`   Expanded: "${response.semanticAnalysis.expandedQuery}"`);

        if (response.semanticAnalysis.entities.length > 0) {
          console.log(`   Entities: ${response.semanticAnalysis.entities.map(e => e.value).join(', ')}`);
        }
      }

      console.log(`   Results: ${response.totalCount}`);
      console.log(`   Processing: ${response.processingTime}ms`);

    } catch (error) {
      console.error(`❌ ${scenario.name} failed:`, error);
    }
  }
}

/**
 * Example 8: Performance Benchmarking
 */
async function runPerformanceBenchmark(mlSearchService: MLSearchService) {
  console.log('\n⚡ Example 8: Performance Benchmarking');

  const benchmarkQueries = [
    'search documents',
    'machine learning',
    'find research papers',
    'data analysis tools',
    'neural networks tutorial'
  ];

  const iterations = 50;
  const responseTimes: number[] = [];

  console.log(`🏃 Running ${iterations} searches across ${benchmarkQueries.length} query types...`);

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const query = benchmarkQueries[i % benchmarkQueries.length];
    const searchStart = Date.now();

    try {
      await mlSearchService.search({
        query: `${query} ${i}`,
        userId: `benchmark_user_${i % 10}`
      });

      const responseTime = Date.now() - searchStart;
      responseTimes.push(responseTime);

    } catch (error) {
      console.error(`Search ${i + 1} failed:`, error);
    }
  }

  const totalTime = Date.now() - startTime;

  // Calculate statistics
  responseTimes.sort((a, b) => a - b);
  const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
  const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
  const minTime = responseTimes[0];
  const maxTime = responseTimes[responseTimes.length - 1];

  console.log('\n📊 Performance Results:');
  console.log(`  Total Searches: ${iterations}`);
  console.log(`  Total Time: ${totalTime}ms`);
  console.log(`  Throughput: ${(iterations / (totalTime / 1000)).toFixed(1)} searches/second`);
  console.log(`  Average Response Time: ${avgResponseTime.toFixed(1)}ms`);
  console.log(`  Min Response Time: ${minTime}ms`);
  console.log(`  Max Response Time: ${maxTime}ms`);
  console.log(`  P50 (Median): ${p50}ms`);
  console.log(`  P95: ${p95}ms`);
  console.log(`  P99: ${p99}ms`);

  // Get current search metrics
  const searchMetrics = mlSearchService.getSearchMetrics();
  console.log(`\n📈 Accumulated Search Metrics: ${searchMetrics.length} data points`);
}

/**
 * Main demonstration function
 */
async function runAllExamples() {
  console.log('🎯 ML Search Enhancement System - Comprehensive Demo');
  console.log('================================================\n');

  try {
    // Initialize the system
    const mlSearchService = await initializeMLSearchSystem();

    // Run all examples
    await performBasicSearch(mlSearchService);
    await performPersonalizedSearch(mlSearchService);
    await demonstrateAnomalyDetection(mlSearchService);
    await demonstrateUserInteractionTracking(mlSearchService);
    await demonstrateModelManagement(mlSearchService);
    await demonstrateAdvancedSearchScenarios(mlSearchService);
    await runPerformanceBenchmark(mlSearchService);

    console.log('\n🎉 All examples completed successfully!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('   ✅ Intelligent query suggestions');
    console.log('   ✅ Personalized result ranking');
    console.log('   ✅ Semantic query understanding');
    console.log('   ✅ Anomaly detection and monitoring');
    console.log('   ✅ User interaction tracking');
    console.log('   ✅ Model retraining and health monitoring');
    console.log('   ✅ Advanced search scenarios');
    console.log('   ✅ Performance benchmarking');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Export for use in other modules
export {
  initializeMLSearchSystem,
  performBasicSearch,
  performPersonalizedSearch,
  demonstrateAnomalyDetection,
  demonstrateUserInteractionTracking,
  demonstrateModelManagement,
  demonstrateAdvancedSearchScenarios,
  runPerformanceBenchmark,
  runAllExamples
};

// Run demo if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}