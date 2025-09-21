# FTS5 Full-Text Search Implementation Guide

## Overview

This document provides a comprehensive guide to the SQLite FTS5 full-text search implementation for the Mainframe Knowledge Base Assistant. The implementation includes custom tokenization for mainframe terminology, BM25 ranking algorithm optimization, and intelligent search strategy selection.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Configuration](#configuration)
4. [Usage Examples](#usage-examples)
5. [Performance Optimization](#performance-optimization)
6. [Mainframe Tokenization](#mainframe-tokenization)
7. [BM25 Ranking](#bm25-ranking)
8. [Testing](#testing)
9. [Migration](#migration)
10. [Troubleshooting](#troubleshooting)

## Architecture Overview

The FTS5 implementation consists of three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Search Request                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              FTS5Integration                                │
│  • Strategy Selection                                       │
│  • Performance Monitoring                                   │
│  • Fallback Management                                      │
│  • Result Caching                                          │
└─────────────┬───────────────────────┬───────────────────────┘
              │                       │
┌─────────────▼───────────────┐      ┌▼──────────────────────┐
│        FTS5Engine           │      │   AdvancedSearchEngine │
│  • SQLite FTS5 Virtual Table│      │   (Legacy Search)     │
│  • BM25 Ranking            │      │  • Inverted Index     │
│  • Mainframe Tokenization  │      │  • Fuzzy Matching     │
│  • Snippet Generation      │      │  • Category Filtering │
└─────────────────────────────┘      └───────────────────────┘
```

## Core Components

### 1. FTS5Engine

The core FTS5 search engine that provides:

- **Custom Tokenization**: Mainframe-specific term recognition
- **BM25 Ranking**: Tuned relevance scoring
- **Snippet Generation**: Contextual result previews
- **Highlight Matching**: Search term emphasis
- **Performance Optimization**: Index tuning and caching

```typescript
import FTS5Engine from './src/services/search/FTS5Engine';

const engine = new FTS5Engine(database, {
  bm25: {
    k1: 1.2,
    b: 0.75,
    titleWeight: 3.0,
    problemWeight: 2.0,
    solutionWeight: 1.5,
    tagsWeight: 1.0
  }
});

await engine.initialize();
```

### 2. FTS5Integration

Intelligent search routing service that:

- **Strategy Selection**: Chooses optimal search algorithm
- **Hybrid Search**: Combines FTS5 and legacy results
- **Performance Monitoring**: Tracks search metrics
- **Fallback Management**: Ensures search availability
- **Result Caching**: Improves response times

```typescript
import FTS5Integration from './src/services/search/FTS5Integration';

const integration = new FTS5Integration(database, legacyEngine, {
  features: {
    hybridSearch: true,
    autoComplete: true,
    snippets: true
  }
});

await integration.initialize();
```

### 3. Database Migration

SQL migration that creates and configures the FTS5 virtual table:

```sql
-- Enhanced FTS5 virtual table
CREATE VIRTUAL TABLE kb_fts5 USING fts5(
    id UNINDEXED,
    title,
    problem,
    solution,
    category UNINDEXED,
    tags,
    tokenize = 'porter unicode61 remove_diacritics 1 tokenchars ".-_@#$"'
);

-- BM25 ranking configuration
INSERT INTO kb_fts5(kb_fts5, rank) VALUES('rank', 'bm25(3.0, 2.0, 1.5, 1.0)');
```

## Configuration

### FTS5Engine Configuration

```typescript
interface FTS5Config {
  bm25: {
    k1: number;              // Term frequency saturation (default: 1.2)
    b: number;               // Length normalization (default: 0.75)
    titleWeight: number;     // Title field weight (default: 3.0)
    problemWeight: number;   // Problem field weight (default: 2.0)
    solutionWeight: number;  // Solution field weight (default: 1.5)
    tagsWeight: number;      // Tags field weight (default: 1.0)
  };

  snippet: {
    maxLength: number;       // Max snippet length (default: 200)
    contextWindow: number;   // Context around matches (default: 30)
    maxSnippets: number;     // Max snippets per result (default: 3)
    ellipsis: string;        // Truncation indicator (default: '...')
  };

  highlight: {
    startTag: string;        // Opening highlight tag (default: '<mark>')
    endTag: string;          // Closing highlight tag (default: '</mark>')
    caseSensitive: boolean;  // Case-sensitive highlighting (default: false)
  };

  performance: {
    mergeFrequency: number;  // FTS5 automerge frequency (default: 4)
    crisisMerges: number;    // Crisis merge threshold (default: 16)
    deleteSize: number;      // Delete size threshold (default: 1000)
    optimizeOnInit: boolean; // Optimize on initialization (default: true)
  };
}
```

### FTS5Integration Configuration

```typescript
interface FTS5IntegrationConfig {
  enabled: boolean;              // Enable FTS5 integration (default: true)
  fallbackEnabled: boolean;      // Enable legacy fallback (default: true)
  minQueryLength: number;        // Min query length for FTS5 (default: 2)

  performance: {
    maxSearchTime: number;       // Max search time before fallback (default: 1000ms)
    maxInitTime: number;         // Max initialization time (default: 5000ms)
    enableMonitoring: boolean;   // Enable performance monitoring (default: true)
  };

  cache: {
    enabled: boolean;            // Enable result caching (default: true)
    ttl: number;                 // Cache TTL in ms (default: 300000)
    maxSize: number;             // Max cache entries (default: 1000)
  };

  features: {
    hybridSearch: boolean;       // Enable hybrid search (default: true)
    autoComplete: boolean;       // Enable auto-complete (default: true)
    snippets: boolean;           // Enable snippet generation (default: true)
    queryExpansion: boolean;     // Enable query expansion (default: false)
  };
}
```

## Usage Examples

### Basic Search

```typescript
// Initialize search system
const db = new Database('./knowledge.db');
const legacyEngine = new AdvancedSearchEngine();
const integration = new FTS5Integration(db, legacyEngine);

await integration.initialize();

// Simple search
const results = await integration.search('S0C7 data exception');
console.log(`Found ${results.length} results`);

results.forEach(result => {
  console.log(`${result.entry.title} (Score: ${result.score.toFixed(1)})`);
  if (result.highlights) {
    console.log(`Highlights: ${result.highlights.join(', ')}`);
  }
});
```

### Advanced Search with Options

```typescript
// Search with filtering and pagination
const results = await integration.search('VSAM file error', {
  category: 'VSAM',
  limit: 10,
  offset: 0,
  sortBy: 'relevance'
});

// Auto-complete suggestions
const suggestions = await integration.autoComplete('prog', 5);
console.log('Suggestions:', suggestions);
```

### Direct FTS5 Engine Usage

```typescript
// Use FTS5 engine directly for advanced features
const fts5Engine = new FTS5Engine(db, {
  bm25: {
    titleWeight: 4.0,  // Boost title matches
    k1: 1.5            // Higher term frequency sensitivity
  }
});

await fts5Engine.initialize();

const results = await fts5Engine.search('complex mainframe query');

// Access FTS5-specific features
results.forEach(result => {
  console.log(`BM25 Score: ${result.bm25Score.toFixed(3)}`);
  console.log(`Snippets: ${result.snippets.length}`);
  console.log(`Term Matches:`, result.termMatches);
});
```

### Performance Monitoring

```typescript
// Monitor search performance
setInterval(() => {
  const metrics = integration.getPerformanceMetrics();

  console.log('Performance Metrics:');
  console.log(`- FTS5: ${metrics.fts5.averageTime.toFixed(1)}ms (${metrics.fts5.callCount} calls)`);
  console.log(`- Legacy: ${metrics.legacy.averageTime.toFixed(1)}ms (${metrics.legacy.callCount} calls)`);
  console.log(`- Cache hit rate: ${(metrics.overall.cacheHitRate * 100).toFixed(1)}%`);

  const health = integration.getHealthStatus();
  console.log(`Health: ${health.performanceStatus}`);
  if (health.recommendations.length > 0) {
    console.log('Recommendations:', health.recommendations);
  }
}, 60000); // Every minute
```

## Performance Optimization

### Index Optimization

```typescript
// Optimize FTS5 index periodically
await fts5Engine.optimize();

// Get index statistics
const stats = fts5Engine.getStats();
console.log(`Index size: ${stats.indexSize} bytes`);
console.log(`Document count: ${stats.documentCount}`);
console.log(`Average document length: ${stats.averageDocumentLength}`);
```

### Search Strategy Tuning

The integration automatically selects search strategies based on:

1. **Query Characteristics**:
   - Error codes → Legacy search (exact matching)
   - Short queries → Legacy search (faster for simple terms)
   - Natural language → FTS5 search (better relevance)
   - Complex queries → Hybrid search (comprehensive coverage)

2. **Performance Metrics**:
   - FTS5 response time → Fallback to legacy if slow
   - Cache hit rate → Adjust cache settings
   - Search frequency → Optimize index merge settings

3. **Content Analysis**:
   - Mainframe terms → Specialized tokenization
   - Structured data → Category/tag filtering
   - Mixed content → Hybrid approach

### Caching Strategies

```typescript
// Configure intelligent caching
const integration = new FTS5Integration(db, legacyEngine, {}, {
  cache: {
    enabled: true,
    ttl: 300000,      // 5 minutes for general queries
    maxSize: 1000     // Keep 1000 recent searches
  }
});

// Cache TTL varies by query type:
// - Error codes: 10 minutes (stable results)
// - Natural language: 5 minutes (may change with new content)
// - Category searches: 15 minutes (more stable)
```

## Mainframe Tokenization

### Supported Mainframe Terms

The FTS5 implementation includes specialized tokenization for:

#### JCL (Job Control Language)
```
JOB, EXEC, DD, SYSIN, SYSOUT, DISP, DSN, DCB, SPACE, UNIT, VOL,
LABEL, RECFM, LRECL, BLKSIZE, COND, PARM, PROC, SET, IF, THEN,
ELSE, ENDIF, INCLUDE, JCLLIB, OUTPUT, JOBLIB, STEPLIB, SYSLIB
```

#### VSAM (Virtual Storage Access Method)
```
VSAM, KSDS, ESDS, RRDS, LDS, DEFINE, DELETE, LISTCAT, REPRO,
PRINT, VERIFY, EXAMINE, ALTER, CLUSTER, DATA, INDEX, AIX, PATH,
CATALOG, MASTERCATALOG, USERCATALOG, NONVSAM, RECATALOG
```

#### COBOL Programming
```
IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE, DIVISION, PROGRAM-ID,
WORKING-STORAGE, FILE-SECTION, LINKAGE, PERFORM, CALL, MOVE, ADD,
SUBTRACT, MULTIPLY, DIVIDE, COMPUTE, IF, ELSE, EVALUATE, WHEN,
PIC, PICTURE, COMP, COMP-3, DISPLAY, BINARY, PACKED-DECIMAL
```

#### DB2 Database
```
SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, TABLE,
VIEW, SYNONYM, TABLESPACE, DATABASE, COMMIT, ROLLBACK, BIND,
REBIND, RUNSTATS, REORG, EXPLAIN, PLAN_TABLE, SPUFI, QMF, DCLGEN
```

### Error Code Recognition

The tokenizer recognizes common mainframe error patterns:

```typescript
const errorPatterns = [
  /^[A-Z]{2,4}\d{3,4}[A-Z]?$/,    // IEF212I, IGZ0037S
  /^S\d{3}[A-Z]?$/,               // S0C7, S322
  /^U\d{4}$/,                     // U4038
  /^SQL[A-Z]?\d{3,5}[A-Z]?$/,     // SQL0803N, SQL0904C
  /^DFHAC\d{4}$/,                 // DFHAC2001
  /^DFS\d{4}[A-Z]?$/              // DFS0555I
];
```

### Dataset Name Handling

Dataset names are preserved as single tokens:

```
USER.TEST.DATA          → "USER.TEST.DATA"
SYS1.PROCLIB(MYJOB)    → "SYS1.PROCLIB" + "(MYJOB)"
PROD.VSAM.CLUSTER       → "PROD.VSAM.CLUSTER"
```

## BM25 Ranking

### Algorithm Parameters

The BM25 ranking algorithm uses these optimized parameters for mainframe content:

```typescript
const bm25Config = {
  k1: 1.2,     // Term frequency saturation point
  b: 0.75,     // Document length normalization

  // Field weights (higher = more important)
  titleWeight: 3.0,     // Problem titles are crucial
  problemWeight: 2.0,   // Problem descriptions are important
  solutionWeight: 1.5,  // Solutions are relevant but secondary
  tagsWeight: 1.0       // Tags provide context
};
```

### Score Calculation

The final relevance score combines multiple signals:

```typescript
function calculateRelevanceScore(document, query, strategy) {
  const bm25Score = calculateBM25(document, query);
  const usageBoost = Math.log(document.usage_count + 1) * 10;
  const successBoost = document.success_rate * 20;
  const strategyMultiplier = getStrategyMultiplier(strategy);

  return Math.min(100, (bm25Score + usageBoost + successBoost) * strategyMultiplier);
}
```

### Field Weight Optimization

Field weights are tuned based on mainframe knowledge base characteristics:

- **Title (3.0x)**: Problem titles contain key identifiers (error codes, component names)
- **Problem (2.0x)**: Problem descriptions provide context and symptoms
- **Solution (1.5x)**: Solutions are important but users often search by problem
- **Tags (1.0x)**: Tags provide categorical context

## Testing

### Unit Tests

Run FTS5-specific tests:

```bash
# Run all FTS5 tests
npm test -- --testPathPattern=FTS5

# Run specific test suites
npm test src/services/search/__tests__/FTS5Engine.test.ts
npm test src/services/search/__tests__/FTS5Integration.test.ts
```

### Performance Testing

```typescript
// Performance benchmark
import { createFTS5Engine } from './src/services/search';

const engine = createFTS5Engine(database);
await engine.initialize();

const startTime = Date.now();
const results = await engine.search('complex mainframe query');
const endTime = Date.now();

console.log(`Search completed in ${endTime - startTime}ms`);
console.log(`Found ${results.length} results`);

// Verify performance targets
expect(endTime - startTime).toBeLessThan(1000); // Sub-second response
```

### Search Quality Testing

```typescript
// Test search relevance
const testCases = [
  {
    query: 'S0C7 data exception',
    expectedCategory: 'Batch',
    expectedKeywords: ['s0c7', 'arithmetic', 'comp-3']
  },
  {
    query: 'VSAM file not found',
    expectedCategory: 'VSAM',
    expectedKeywords: ['status-35', 'catalog', 'ksds']
  }
];

for (const testCase of testCases) {
  const results = await engine.search(testCase.query);

  expect(results.length).toBeGreaterThan(0);
  expect(results[0].entry.category).toBe(testCase.expectedCategory);

  const hasExpectedKeywords = testCase.expectedKeywords.some(keyword =>
    results[0].entry.tags?.includes(keyword)
  );
  expect(hasExpectedKeywords).toBe(true);
}
```

## Migration

### Running the Migration

The FTS5 migration is automatically applied when initializing the database:

```typescript
import { MigrationManager } from './src/database/MigrationManager';

const migrationManager = new MigrationManager(database);
const results = await migrationManager.migrate();

// Check migration success
const fts5Migration = results.find(r => r.version === 7);
if (fts5Migration && fts5Migration.success) {
  console.log('FTS5 migration completed successfully');
} else {
  console.error('FTS5 migration failed:', fts5Migration?.error);
}
```

### Manual Migration

If needed, run the FTS5 migration manually:

```sql
-- Execute the migration SQL
.read src/database/migrations/007_fts5_enhanced_search.sql

-- Verify FTS5 table creation
SELECT COUNT(*) FROM kb_fts5;

-- Check index configuration
SELECT * FROM kb_fts5(kb_fts5) WHERE command = 'rank';
```

### Data Population

The migration automatically populates the FTS5 index:

```sql
-- Verify data population
SELECT
  (SELECT COUNT(*) FROM kb_entries WHERE archived = FALSE) as entries,
  (SELECT COUNT(*) FROM kb_fts5) as indexed,
  (SELECT COUNT(*) FROM kb_fts5) * 100.0 /
  (SELECT COUNT(*) FROM kb_entries WHERE archived = FALSE) as coverage_percent;
```

## Troubleshooting

### Common Issues

#### 1. FTS5 Extension Not Available

**Error**: `no such module: fts5`

**Solution**: Ensure SQLite is compiled with FTS5 support:

```typescript
// Check FTS5 availability
const ftsCheck = database.prepare("SELECT fts5_version()").get();
if (!ftsCheck) {
  throw new Error('FTS5 extension not available');
}
```

#### 2. Tokenization Issues

**Error**: Mainframe terms not recognized as single tokens

**Solution**: Verify tokenizer configuration:

```sql
-- Check tokenizer settings
SELECT sql FROM sqlite_master WHERE name = 'kb_fts5';

-- Should include: tokenize = 'porter unicode61 remove_diacritics 1 tokenchars ".-_@#$"'
```

#### 3. Poor Search Performance

**Error**: Search times exceed 1 second

**Solution**: Optimize FTS5 index:

```typescript
// Rebuild FTS5 index
await engine.optimize();

// Check index statistics
const stats = engine.getStats();
console.log('Index size:', stats.indexSize);

// Consider adjusting merge parameters
database.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('automerge=8')");
```

#### 4. Inconsistent Results

**Error**: Search results vary between FTS5 and legacy

**Solution**: Verify data synchronization:

```sql
-- Check data consistency
SELECT
  e.id,
  e.title,
  f.title as fts_title,
  CASE WHEN e.title = f.title THEN 'OK' ELSE 'MISMATCH' END as status
FROM kb_entries e
LEFT JOIN kb_fts5 f ON e.id = f.id
WHERE e.archived = FALSE
  AND status = 'MISMATCH';
```

### Performance Tuning

#### Memory Usage Optimization

```sql
-- Adjust FTS5 memory settings
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA mmap_size = 268435456; -- 256MB memory map
```

#### Index Merge Optimization

```sql
-- Tune automerge for your workload
INSERT INTO kb_fts5(kb_fts5) VALUES('automerge=2');    -- More frequent merging
INSERT INTO kb_fts5(kb_fts5) VALUES('crisismerge=8');  -- Earlier crisis merging
INSERT INTO kb_fts5(kb_fts5) VALUES('deletesize=500'); -- Smaller delete threshold
```

#### Search Strategy Adjustment

```typescript
// Adjust strategy selection thresholds
const config: Partial<FTS5IntegrationConfig> = {
  minQueryLength: 3,           // Require longer queries for FTS5
  performance: {
    maxSearchTime: 500,        // Stricter timeout
    enableMonitoring: true
  },
  features: {
    hybridSearch: false        // Disable hybrid for faster results
  }
};
```

### Debugging Tools

#### Enable FTS5 Debug Mode

```sql
-- Enable FTS5 debugging
INSERT INTO kb_fts5(kb_fts5) VALUES('debug=1');

-- View internal FTS5 structure
SELECT * FROM kb_fts5_segdir;
SELECT * FROM kb_fts5_segments;
```

#### Search Query Analysis

```typescript
// Analyze search strategies
integration.search('debug query').then(results => {
  const metrics = integration.getPerformanceMetrics();
  console.log('Strategy distribution:', {
    fts5: metrics.fts5.callCount,
    legacy: metrics.legacy.callCount,
    hybrid: metrics.hybrid.callCount
  });
});
```

#### Performance Profiling

```typescript
// Profile search performance
const profileSearch = async (query: string) => {
  const startTime = process.hrtime.bigint();
  const results = await integration.search(query);
  const endTime = process.hrtime.bigint();

  const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

  console.log(`Query: "${query}"`);
  console.log(`Duration: ${duration.toFixed(2)}ms`);
  console.log(`Results: ${results.length}`);
  console.log(`Strategy: ${results[0]?.metadata?.source || 'unknown'}`);
};
```

## Conclusion

The FTS5 implementation provides enterprise-grade full-text search capabilities specifically optimized for mainframe knowledge bases. Key benefits include:

- **Performance**: Sub-second search response times
- **Relevance**: BM25 ranking tuned for mainframe content
- **Reliability**: Intelligent fallback and error handling
- **Flexibility**: Configurable strategies and hybrid search
- **Scalability**: Optimized for knowledge bases up to 100K entries

For additional support or feature requests, please refer to the project documentation or create an issue in the repository.

---

**Document Version**: 1.0.0
**Last Updated**: September 2025
**Authors**: Database Architect Team