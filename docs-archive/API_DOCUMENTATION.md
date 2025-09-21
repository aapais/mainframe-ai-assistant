# API Documentation - Mainframe KB Assistant MVP1

## Overview

The Mainframe KB Assistant provides a comprehensive TypeScript API for managing a knowledge base of mainframe solutions and incidents. This documentation covers all public interfaces, classes, and methods for developers integrating with the system.

## Quick Start

### Installation and Setup

```typescript
import { KnowledgeDB, createKnowledgeDB } from './src/database/KnowledgeDB';
import { GeminiService } from './src/services/GeminiService';

// Method 1: Direct instantiation
const db = new KnowledgeDB('./knowledge.db', {
  autoBackup: true,
  backupInterval: 24
});

// Method 2: Factory function (recommended)
const db = await createKnowledgeDB('./knowledge.db', {
  autoBackup: true,
  backupInterval: 24
});

// Optional: AI service integration
const gemini = new GeminiService({
  apiKey: process.env.GOOGLE_AI_API_KEY,
  temperature: 0.3
});
```

### Basic Operations

```typescript
// Add a new knowledge entry
const entryId = await db.addEntry({
  title: 'S0C7 Data Exception in COBOL',
  problem: 'Program abends with S0C7 during arithmetic operations',
  solution: '1. Check for uninitialized COMP-3 fields\n2. Validate numeric data',
  category: 'Batch',
  severity: 'high',
  tags: ['s0c7', 'abend', 'cobol', 'arithmetic']
}, 'user.smith');

// Search the knowledge base
const results = await db.search('S0C7 data exception', {
  limit: 10,
  sortBy: 'relevance'
});

// Get entry by ID
const entry = await db.getEntry(entryId);

// Update entry
await db.updateEntry(entryId, {
  solution: 'Updated solution with additional steps...',
  tags: ['s0c7', 'abend', 'cobol', 'arithmetic', 'updated']
}, 'user.smith');

// Record usage feedback
await db.recordUsage(entryId, true, 'user.jones'); // true = successful resolution
```

## Core Interfaces

### KBEntry

Main knowledge base entry interface representing a problem-solution pair.

```typescript
interface KBEntry {
  id?: string;                    // UUID v4 identifier
  title: string;                  // Brief descriptive title
  problem: string;                // Detailed problem description
  solution: string;               // Step-by-step solution
  category: string;               // Component category
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];               // Searchable tags
  created_at?: Date;             // Creation timestamp
  updated_at?: Date;             // Last modification timestamp
  created_by?: string;           // Creator user ID
  usage_count?: number;          // Access count
  success_count?: number;        // Successful resolutions
  failure_count?: number;        // Failed resolutions
  last_used?: Date;             // Last access timestamp
  archived?: boolean;           // Hidden from searches
}
```

**Categories:**
- `JCL` - Job Control Language issues
- `VSAM` - Virtual Storage Access Method
- `DB2` - Database-related problems
- `Batch` - Batch program errors
- `Functional` - Business logic issues
- `IMS` - Information Management System
- `CICS` - Customer Information Control System
- `System` - Operating system issues
- `Other` - Miscellaneous problems

### SearchResult

Container for search results with relevance scoring.

```typescript
interface SearchResult {
  entry: KBEntry;                // The matched entry
  score: number;                 // Relevance score 0-100
  matchType: 'exact' | 'fuzzy' | 'ai' | 'category' | 'tag';
  highlights?: string[];         // Matching text snippets
}
```

### DatabaseStats

Comprehensive database metrics and health information.

```typescript
interface DatabaseStats {
  totalEntries: number;          // Active entry count
  categoryCounts: Record<string, number>; // Entries by category
  recentActivity: number;        // Entries used in last 7 days
  searchesToday: number;         // Today's search count
  averageSuccessRate: number;    // Success rate percentage
  topEntries: Array<{           // Most used entries
    title: string;
    usage_count: number;
  }>;
  diskUsage: number;            // Database size in bytes
  performance: {
    avgSearchTime: number;       // Average response time (ms)
    cacheHitRate: number;       // Cache hit percentage
  };
}
```

## Database Class: KnowledgeDB

### Constructor

```typescript
constructor(dbPath?: string, options?: {
  backupDir?: string;      // Backup directory path
  maxBackups?: number;     // Max backup files to keep
  autoBackup?: boolean;    // Enable automatic backups
  backupInterval?: number; // Hours between backups
})
```

### Entry Management Methods

#### addEntry(entry, userId?)
Add a new knowledge base entry.

```typescript
await db.addEntry({
  title: 'IEF212I Dataset Not Found',
  problem: 'JCL step fails with IEF212I message',
  solution: '1. Check dataset name\n2. Verify catalog entry\n3. Check permissions',
  category: 'JCL',
  tags: ['ief212i', 'dataset', 'jcl-error']
}, 'admin');
```

#### updateEntry(id, updates, userId?)
Update an existing entry.

```typescript
await db.updateEntry(entryId, {
  solution: 'Enhanced solution with additional troubleshooting steps...',
  severity: 'medium'
}, 'expert.user');
```

#### getEntry(id)
Retrieve entry by ID.

```typescript
const entry = await db.getEntry('uuid-here');
if (entry) {
  console.log(`Title: ${entry.title}`);
  console.log(`Success rate: ${entry.success_count / (entry.success_count + entry.failure_count)}`);
}
```

### Search Methods

#### search(query, options?)
Advanced search with multiple strategies.

```typescript
// Basic search
const results = await db.search('VSAM status code 35');

// Advanced search with options
const results = await db.search('file access error', {
  category: 'VSAM',
  limit: 5,
  sortBy: 'usage',
  includeArchived: false
});

// Special search operators
const results = await db.search('category:JCL');    // Category filter
const results = await db.search('tag:abend');       // Tag filter
```

**Search Options:**
```typescript
interface SearchOptions {
  limit?: number;                    // Max results (default: 10)
  offset?: number;                   // Pagination offset
  sortBy?: 'relevance' | 'usage' | 'success_rate' | 'created_at';
  includeArchived?: boolean;         // Include archived entries
  category?: string;                 // Filter by category
  tags?: string[];                   // Filter by tags
  fuzzyThreshold?: number;          // Fuzzy match threshold 0-1
}
```

#### autoComplete(query, limit?)
Get search suggestions for auto-complete functionality.

```typescript
const suggestions = await db.autoComplete('s0c', 5);
// Returns: [
//   { suggestion: 'S0C7 data exception', category: 'search', score: 95 },
//   { suggestion: 'S0C4 protection exception', category: 'search', score: 85 }
// ]
```

#### searchWithFacets(query, options?)
Search with faceted results for filtering UI.

```typescript
const result = await db.searchWithFacets('error');
console.log(`Found ${result.totalCount} results`);
console.log('Categories:', result.facets.categories);
console.log('Tags:', result.facets.tags);
console.log('Severities:', result.facets.severities);
```

### Utility Methods

#### getStats()
Get comprehensive database statistics.

```typescript
const stats = await db.getStats();
console.log(`Database has ${stats.totalEntries} entries`);
console.log(`Average search time: ${stats.performance.avgSearchTime}ms`);
console.log(`Cache hit rate: ${stats.performance.cacheHitRate}%`);
```

#### getPopular(limit?)
Get most frequently used entries.

```typescript
const popular = await db.getPopular(10);
popular.forEach(result => {
  console.log(`${result.entry.title}: ${result.entry.usage_count} uses`);
});
```

#### getRecent(limit?)
Get recently created entries.

```typescript
const recent = await db.getRecent(5);
```

#### recordUsage(entryId, successful, userId?)
Track entry effectiveness.

```typescript
await db.recordUsage(entryId, true, 'user.id');  // Successful resolution
await db.recordUsage(entryId, false, 'user.id'); // Failed resolution
```

### Backup and Maintenance

#### createBackup()
Create manual backup.

```typescript
await db.createBackup();
console.log('Backup created successfully');
```

#### exportToJSON(outputPath)
Export database to JSON format.

```typescript
await db.exportToJSON('./backup/kb-export.json');
```

#### importFromJSON(jsonPath, mergeMode?)
Import from JSON file.

```typescript
await db.importFromJSON('./import/kb-data.json', true); // true = merge mode
```

#### optimize()
Optimize database performance.

```typescript
await db.optimize();
const recommendations = db.getRecommendations();
console.log('Optimization recommendations:', recommendations);
```

#### healthCheck()
Comprehensive system health check.

```typescript
const health = await db.healthCheck();
if (health.overall) {
  console.log('System healthy');
} else {
  console.log('Issues found:', health.issues);
}
```

## AI Service: GeminiService

### Constructor

```typescript
const gemini = new GeminiService({
  apiKey: 'your-google-ai-api-key',
  model: 'gemini-pro',        // Optional
  temperature: 0.3,           // Optional
  maxTokens: 1024,           // Optional
  timeout: 30000             // Optional
});
```

### Methods

#### findSimilar(query, entries, limit?)
AI-powered semantic search.

```typescript
const matches = await gemini.findSimilar(
  'program stops with math error',
  allEntries,
  5
);
```

#### explainError(errorCode)
Get AI explanation of error codes.

```typescript
const explanation = await gemini.explainError('S0C7');
console.log(explanation);
// Output: "S0C7 is a data exception error that occurs when..."
```

#### analyzeEntry(entry)
Analyze entry quality and suggest improvements.

```typescript
const analysis = await gemini.analyzeEntry(entry);
console.log(`Clarity: ${analysis.clarity}%`);
console.log(`Completeness: ${analysis.completeness}%`);
console.log('Suggestions:', analysis.suggestions);
```

#### generateTags(entry)
Generate relevant tags for an entry.

```typescript
const tags = await gemini.generateTags(entry);
console.log('Suggested tags:', tags);
```

#### categorizeproblem(problemDescription)
Automatically categorize a problem.

```typescript
const result = await gemini.categorizeproblem('Job fails with dataset error');
console.log(`Category: ${result.category} (${result.confidence}% confidence)`);
```

## Error Handling

All methods include comprehensive error handling with fallback mechanisms:

```typescript
try {
  const results = await db.search('query');
  // Process results
} catch (error) {
  console.error('Search failed:', error.message);
  // Handle error appropriately
}

// AI methods have automatic fallbacks
const results = await gemini.findSimilar(query, entries);
// If AI fails, returns local fuzzy search results
```

## Performance Considerations

### Search Performance
- Search responses typically < 1 second
- Full-text search uses BM25 ranking for relevance
- Query cache improves repeated search performance
- Indexes optimized for common query patterns

### Memory Usage
- Database kept in memory for fast access
- Connection pooling for concurrent operations
- Automatic cleanup of resources
- Cache size limits prevent memory bloat

### Best Practices

1. **Database Initialization**
   ```typescript
   // Use factory function for proper initialization
   const db = await createKnowledgeDB('./knowledge.db');
   ```

2. **Search Optimization**
   ```typescript
   // Use specific categories for faster searches
   const results = await db.search('error', { category: 'VSAM' });
   
   // Use pagination for large result sets
   const results = await db.search('query', { limit: 20, offset: 40 });
   ```

3. **Resource Cleanup**
   ```typescript
   // Always close database when done
   await db.close();
   ```

4. **Error Handling**
   ```typescript
   // Handle initialization properly
   try {
     const db = await createKnowledgeDB('./knowledge.db');
     // Use database...
   } catch (error) {
     console.error('Database initialization failed:', error);
   }
   ```

## Integration Examples

### Express.js API Server

```typescript
import express from 'express';
import { createKnowledgeDB } from './src/database/KnowledgeDB';

const app = express();
const db = await createKnowledgeDB('./knowledge.db');

app.get('/api/search', async (req, res) => {
  try {
    const { q, category, limit = 10 } = req.query;
    const results = await db.search(q, { category, limit: parseInt(limit) });
    res.json({ results, total: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const id = await db.addEntry(req.body, req.user?.id);
    res.json({ id, message: 'Entry created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### React Component Integration

```typescript
import React, { useState, useEffect } from 'react';

function KnowledgeSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      // Call your API or use database directly in Electron
      const response = await window.api.search(query);
      setResults(response);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Search knowledge base..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      
      <div>
        {results.map(result => (
          <div key={result.entry.id}>
            <h3>{result.entry.title}</h3>
            <p>Score: {result.score.toFixed(1)}%</p>
            <p>Category: {result.entry.category}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## TypeScript Definitions

All interfaces and types are fully typed for excellent IDE support:

```typescript
import type {
  KBEntry,
  SearchResult,
  DatabaseStats,
  GeminiConfig,
  MatchResult
} from './src/database/KnowledgeDB';

// Full type safety
const entry: KBEntry = {
  title: 'Sample Entry',
  problem: 'Problem description',
  solution: 'Solution steps',
  category: 'JCL',
  tags: ['tag1', 'tag2']
};
```

This completes the comprehensive API documentation for the Mainframe KB Assistant MVP1. For additional examples and integration patterns, see the `/docs/examples/` directory.