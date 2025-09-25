/**
 * FTS5 Search Backend Usage Example
 *
 * This example demonstrates how to use the FTS5 search backend implementation
 * including API endpoints, query parsing, ranking, and pagination.
 */

import express from 'express';
import cors from 'cors';
import { FTS5SearchService } from '../../services/FTS5SearchService';
import { SearchIntegrationService } from '../api/search/SearchIntegrationService';
import { SearchAPIRoutes } from '../api/search/SearchRoutes';
import { SearchRankingEngine } from '../api/search/SearchRankingEngine';
import { SearchFilterEngine } from '../api/search/SearchFilterEngine';
import { KnowledgeBaseService } from '../../services/KnowledgeBaseService';
import { SearchServiceConfig } from '../../types/services';

/**
 * Example 1: Basic FTS5 Search Service Setup
 */
async function basicSearchExample() {
  console.log('=== Basic FTS5 Search Example ===');

  // Configure the search service
  const config: SearchServiceConfig = {
    database: {
      path: './examples/search.db',
      enableWAL: true,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -64000,
        foreign_keys: 'ON',
      },
    },
    fts: {
      tokenizer: 'porter',
      removeStopwords: true,
      enableSynonyms: true,
    },
    ranking: {
      algorithm: 'hybrid',
      boosts: {
        title: 2.0,
        content: 1.5,
        recency: 0.1,
        usage: 0.2,
      },
    },
    pagination: {
      maxPageSize: 100,
      defaultPageSize: 20,
    },
  };

  // Create search service
  const searchService = new FTS5SearchService(config);

  try {
    // Basic search
    console.log('Performing basic search...');
    const basicResult = await searchService.search('JCL error', {
      limit: 10,
      offset: 0,
    });

    console.log(`Found ${basicResult.results.length} results`);
    console.log(`Total results: ${basicResult.pagination.total_results}`);
    console.log(`Query time: ${basicResult.query_info.total_time}ms`);

    // Advanced search with boolean operators
    console.log('\nPerforming advanced boolean search...');
    const advancedResult = await searchService.search(
      'title:"JCL Error" AND category:batch OR tags:abend',
      {
        query_type: 'boolean',
        include_snippets: true,
        include_facets: true,
        limit: 20,
      }
    );

    console.log(`Advanced search found ${advancedResult.results.length} results`);
    console.log(`Facets available: ${advancedResult.facets.length}`);

    // Field-specific search with boosting
    console.log('\nPerforming field-specific search...');
    const fieldResult = await searchService.search('database connection', {
      fields: ['title', 'problem', 'solution'],
      boost_fields: {
        title: 3.0,
        problem: 2.0,
        solution: 1.5,
      },
      sort_by: 'relevance',
      min_score: 0.5,
    });

    console.log(`Field search found ${fieldResult.results.length} results`);

    // Date range filtering
    console.log('\nPerforming date range search...');
    const dateResult = await searchService.search('error', {
      date_range: {
        from: new Date('2023-01-01'),
        to: new Date('2023-12-31'),
      },
      sort_by: 'date',
      sort_order: 'desc',
    });

    console.log(`Date filtered search found ${dateResult.results.length} results`);

    // Get search suggestions
    console.log('\nGetting search suggestions...');
    const suggestions = await searchService.getSuggestions('jcl', 10);
    console.log(`Suggestions: ${suggestions.join(', ')}`);

    // Get search statistics
    console.log('\nSearch statistics:');
    const stats = searchService.getSearchStats();
    console.log(`Total searches: ${stats.total_searches}`);
    console.log(`Cache hit rate: ${stats.cache_hit_rate}%`);
    console.log(`Average response time: ${stats.avg_response_time}ms`);
  } catch (error) {
    console.error('Search error:', error);
  } finally {
    await searchService.close();
  }
}

/**
 * Example 2: Integration with Knowledge Base Service
 */
async function integrationExample() {
  console.log('\n=== Search Integration Example ===');

  const config: SearchServiceConfig = {
    database: {
      path: './examples/integrated-search.db',
      enableWAL: true,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
      },
    },
    fts: {
      tokenizer: 'porter',
      removeStopwords: true,
      enableSynonyms: true,
    },
    ranking: {
      algorithm: 'hybrid',
      boosts: {
        title: 2.0,
        content: 1.5,
        recency: 0.1,
        usage: 0.2,
      },
    },
    pagination: {
      maxPageSize: 50,
      defaultPageSize: 10,
    },
  };

  // Create knowledge base service (simplified)
  const kbService = new KnowledgeBaseService();
  await kbService.initialize();

  // Create integrated search service
  const integrationService = new SearchIntegrationService(config, kbService, {
    syncInterval: 30000, // 30 seconds
    enableRealTimeSync: true,
    enableSearchAnalytics: true,
    autoRebuildThreshold: 100,
  });

  try {
    // Initialize integration
    await integrationService.initialize();

    // Perform integrated search
    console.log('Performing integrated search...');
    const result = await integrationService.search('VSAM error handling', {
      limit: 15,
      include_facets: true,
      category: 'VSAM',
    });

    console.log(`Integrated search results: ${result.results.length}`);
    console.log(`FTS results: ${result.integration.fts_results}`);
    console.log(`KB enriched: ${result.integration.kb_enriched}`);
    console.log(`Processing time: ${result.integration.processing_time}ms`);

    // Get integrated suggestions
    console.log('\nGetting integrated suggestions...');
    const suggestions = await integrationService.getSuggestions('vsam', 8);
    suggestions.forEach(suggestion => {
      console.log(`- ${suggestion.text} (${suggestion.type}, from ${suggestion.source})`);
    });

    // Get analytics
    console.log('\nIntegration analytics:');
    const analytics = integrationService.getSearchAnalytics();
    console.log('FTS Stats:', analytics.fts_stats);
    console.log('Integration Stats:', analytics.integration_stats);

    // Manual sync with KB
    console.log('\nPerforming manual sync...');
    const syncStatus = await integrationService.syncWithKnowledgeBase();
    console.log(`Sync completed. Total entries: ${syncStatus.totalEntries}`);
    console.log(`Index health: ${syncStatus.indexHealth}`);
  } catch (error) {
    console.error('Integration error:', error);
  } finally {
    await integrationService.close();
    await kbService.close();
  }
}

/**
 * Example 3: Advanced Ranking and Filtering
 */
async function rankingAndFilteringExample() {
  console.log('\n=== Ranking and Filtering Example ===');

  // Create ranking engine
  const rankingEngine = new SearchRankingEngine({
    algorithm: 'hybrid',
    weights: {
      textRelevance: 0.4,
      popularity: 0.25,
      freshness: 0.15,
      userContext: 0.15,
      qualityScore: 0.05,
    },
    boosts: {
      exactMatch: 1.8,
      titleMatch: 1.5,
      categoryMatch: 1.3,
      tagMatch: 1.2,
      userPreference: 1.6,
    },
  });

  // Simulate user interactions for personalized ranking
  console.log('Recording user interactions...');
  rankingEngine.updateUserInteraction('user123', 'entry1', 'view', {
    category: 'JCL',
    tags: ['error', 'batch'],
  });
  rankingEngine.updateUserInteraction('user123', 'entry2', 'rate', {
    category: 'JCL',
    rating: 5,
  });
  rankingEngine.updateUserInteraction('user123', 'entry3', 'bookmark', {
    category: 'VSAM',
    tags: ['configuration'],
  });

  // Update content quality scores
  console.log('Updating content quality scores...');
  rankingEngine.updateContentQuality('entry1', 0.8, {
    helpful: true,
    accurate: true,
    upToDate: true,
    wellWritten: true,
  });

  // Get user preferences
  const preferences = rankingEngine.getUserPreferences('user123');
  console.log('User preferences:', preferences);

  // Get ranking statistics
  const rankingStats = rankingEngine.getRankingStats();
  console.log('Ranking statistics:', rankingStats);

  // Create search service with custom ranking
  const config: SearchServiceConfig = {
    database: { path: './examples/ranking-search.db', enableWAL: true, pragmas: {} },
    fts: { tokenizer: 'porter', removeStopwords: true, enableSynonyms: true },
    ranking: { algorithm: 'hybrid', boosts: { title: 2, content: 1.5, recency: 0.1, usage: 0.2 } },
    pagination: { maxPageSize: 100, defaultPageSize: 20 },
  };

  const searchService = new FTS5SearchService(config);

  // Create filter engine
  const filterEngine = new SearchFilterEngine(
    searchService['db'], // Access internal database
    {
      enableDynamicFilters: true,
      maxFilterValues: 15,
      hierarchicalFilters: ['category', 'tags'],
      customFilters: [
        {
          name: 'complexity',
          type: 'range',
          source: 'computed',
          options: { min: 0, max: 10 },
        },
        {
          name: 'quality_rating',
          type: 'range',
          source: 'computed',
          options: { min: 0, max: 5 },
        },
      ],
    }
  );

  try {
    // Generate facets for a search
    console.log('\nGenerating search facets...');
    const facets = await filterEngine.generateFacets('database error', {
      limit: 20,
      include_facets: true,
    });

    console.log(`Generated ${facets.length} facets:`);
    facets.forEach(facet => {
      console.log(`- ${facet.field}: ${facet.values.length} values`);
    });

    // Apply filters to search
    const filters = new Map([
      ['category', 'DB2'],
      ['usage_range', { min: 5, max: 50 }],
      ['date_range', { from: new Date('2023-01-01') }],
    ]);

    console.log('\nApplying filters...');
    const filterResult = filterEngine.applyFilters('database connection error', filters, {
      limit: 20,
    });

    console.log('Modified query:', filterResult.modifiedQuery);
    console.log('Additional WHERE clause:', filterResult.additionalWhereClause);

    // Get filter suggestions
    console.log('\nGetting filter suggestions...');
    const filterSuggestions = await filterEngine.getFilterSuggestions(
      'database error',
      filters,
      150 // Assuming 150 results
    );

    filterSuggestions.forEach(suggestion => {
      console.log(`- ${suggestion.filter}: ${suggestion.suggestedValue} (${suggestion.reason})`);
    });

    // Get filter analytics
    const filterAnalytics = filterEngine.getFilterAnalytics();
    console.log('\nFilter analytics:', filterAnalytics);
  } catch (error) {
    console.error('Ranking/filtering error:', error);
  } finally {
    await searchService.close();
  }
}

/**
 * Example 4: REST API Server Setup
 */
async function apiServerExample() {
  console.log('\n=== API Server Example ===');

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Search service configuration
  const config: SearchServiceConfig = {
    database: {
      path: './examples/api-search.db',
      enableWAL: true,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -64000,
      },
    },
    fts: {
      tokenizer: 'porter',
      removeStopwords: true,
      enableSynonyms: true,
    },
    ranking: {
      algorithm: 'hybrid',
      boosts: {
        title: 2.0,
        content: 1.5,
        recency: 0.1,
        usage: 0.2,
      },
    },
    pagination: {
      maxPageSize: 100,
      defaultPageSize: 20,
    },
  };

  // Create search service
  const searchService = new FTS5SearchService(config);

  // Setup API routes
  const searchRoutes = new SearchAPIRoutes(searchService);
  app.use('/api/search', searchRoutes.getRouter());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'FTS5 Search API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Error handling middleware
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
      },
    });
  });

  // Start server
  const PORT = process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    console.log(`FTS5 Search API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Search API: http://localhost:${PORT}/api/search`);
  });

  // Example API usage with curl commands
  console.log('\nExample API calls:');
  console.log('1. Basic search:');
  console.log(`curl -X POST http://localhost:${PORT}/api/search/v2/search \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"query": "JCL error", "options": {"limit": 10}}'`);

  console.log('\n2. Advanced search with filters:');
  console.log(`curl -X POST http://localhost:${PORT}/api/search/v2/search \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(
    `  -d '{"query": "database error", "options": {"category": "DB2", "include_facets": true, "boost_fields": {"title": 2.0}}}'`
  );

  console.log('\n3. Get suggestions:');
  console.log(`curl "http://localhost:${PORT}/api/search/v2/suggestions?q=jcl&limit=10"`);

  console.log('\n4. Get analytics:');
  console.log(`curl "http://localhost:${PORT}/api/search/v2/analytics?timeframe=24h"`);

  console.log('\n5. Health check:');
  console.log(`curl "http://localhost:${PORT}/api/search/v2/health"`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down API server...');
    server.close(async () => {
      await searchService.close();
      console.log('API server shutdown complete.');
      process.exit(0);
    });
  });

  return server;
}

/**
 * Example 5: Comprehensive Search Pipeline
 */
async function comprehensiveExample() {
  console.log('\n=== Comprehensive Search Pipeline Example ===');

  const config: SearchServiceConfig = {
    database: {
      path: './examples/comprehensive-search.db',
      enableWAL: true,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -128000,
        temp_store: 'MEMORY',
      },
    },
    fts: {
      tokenizer: 'porter',
      removeStopwords: true,
      enableSynonyms: true,
    },
    ranking: {
      algorithm: 'hybrid',
      boosts: {
        title: 2.5,
        content: 1.8,
        recency: 0.15,
        usage: 0.25,
      },
    },
    pagination: {
      maxPageSize: 200,
      defaultPageSize: 25,
    },
  };

  const searchService = new FTS5SearchService(config);

  try {
    console.log('1. Testing search performance with various query types...');

    const queries = [
      { query: 'JCL ABEND S0C7', type: 'simple', description: 'Simple keyword search' },
      {
        query: 'title:"JCL Error" AND category:batch',
        type: 'boolean',
        description: 'Boolean search with field restrictions',
      },
      {
        query: '"database connection timeout"',
        type: 'phrase',
        description: 'Exact phrase search',
      },
      {
        query: 'VSAM AND (error OR problem)',
        type: 'boolean',
        description: 'Complex boolean with parentheses',
      },
      {
        query: 'problem:performance AND solution:optimization',
        type: 'field',
        description: 'Multi-field search',
      },
    ];

    const results = [];
    for (const { query, type, description } of queries) {
      console.log(`\n  Testing: ${description}`);
      console.log(`  Query: ${query}`);

      const startTime = Date.now();
      const result = await searchService.search(query, {
        query_type: type as any,
        limit: 20,
        include_snippets: true,
        include_facets: true,
      });
      const endTime = Date.now();

      console.log(`  Results: ${result.results.length}`);
      console.log(`  Time: ${endTime - startTime}ms`);
      console.log(`  Facets: ${result.facets.length}`);

      results.push({
        query,
        type,
        resultCount: result.results.length,
        responseTime: endTime - startTime,
        facetCount: result.facets.length,
      });
    }

    console.log('\n2. Testing pagination performance...');
    const paginationTests = [
      { offset: 0, limit: 10 },
      { offset: 10, limit: 10 },
      { offset: 50, limit: 25 },
      { offset: 100, limit: 50 },
    ];

    for (const { offset, limit } of paginationTests) {
      const startTime = Date.now();
      const result = await searchService.search('error', { offset, limit });
      const endTime = Date.now();

      console.log(
        `  Page ${Math.floor(offset / limit) + 1} (${limit} items): ${endTime - startTime}ms`
      );
    }

    console.log('\n3. Testing search suggestions performance...');
    const suggestionQueries = ['j', 'jc', 'jcl', 'error', 'db2'];

    for (const partialQuery of suggestionQueries) {
      const startTime = Date.now();
      const suggestions = await searchService.getSuggestions(partialQuery, 10);
      const endTime = Date.now();

      console.log(
        `  "${partialQuery}": ${suggestions.length} suggestions in ${endTime - startTime}ms`
      );
    }

    console.log('\n4. Performance summary:');
    const stats = searchService.getSearchStats();
    console.log(`  Total searches performed: ${stats.total_searches}`);
    console.log(`  Cache hit rate: ${stats.cache_hit_rate}%`);
    console.log(`  Average response time: ${stats.avg_response_time}ms`);
    console.log(`  Error rate: ${stats.error_rate}%`);

    console.log('\n5. Index statistics:');
    console.log('  Index stats:', stats.index_stats);

    console.log('\n6. Testing index rebuild...');
    const rebuildStart = Date.now();
    await searchService.rebuildIndex();
    const rebuildEnd = Date.now();
    console.log(`  Index rebuild completed in ${rebuildEnd - rebuildStart}ms`);
  } catch (error) {
    console.error('Comprehensive example error:', error);
  } finally {
    await searchService.close();
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('FTS5 Search Backend Usage Examples\n');
  console.log(
    'This example demonstrates the full capabilities of the FTS5 search backend implementation.'
  );

  try {
    // Run examples sequentially
    await basicSearchExample();
    await integrationExample();
    await rankingAndFilteringExample();

    // Uncomment to run API server example
    // await apiServerExample();

    await comprehensiveExample();

    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example execution error:', error);
    process.exit(1);
  }
}

// Export functions for testing or individual use
export {
  basicSearchExample,
  integrationExample,
  rankingAndFilteringExample,
  apiServerExample,
  comprehensiveExample,
};

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
