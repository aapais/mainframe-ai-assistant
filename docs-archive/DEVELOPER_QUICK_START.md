# Developer Quick Start Guide
## Mainframe KB Assistant MVP1

Welcome to the Mainframe KB Assistant! This guide will get you up and running with the knowledge base system in under 15 minutes.

## Prerequisites

- Node.js 18+ and npm 9+
- TypeScript knowledge (basic)
- Understanding of mainframe concepts (helpful but not required)

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
# Clone and install
git clone <repo-url>
cd mainframe-kb-assistant
npm install

# Build the project
npm run build
```

### 2. Initialize Database

```bash
# Initialize with sample data
npm run kb:init

# Or start fresh
npm run dev
```

### 3. First Run

```typescript
import { createKnowledgeDB } from './src/database/KnowledgeDB';

// Initialize database
const db = await createKnowledgeDB('./knowledge.db');

// Your first knowledge entry
const entryId = await db.addEntry({
  title: 'S0C7 Data Exception',
  problem: 'COBOL program fails with S0C7 abend during arithmetic operation',
  solution: '1. Check COMP-3 field initialization\n2. Validate input data format\n3. Add NUMERIC test before calculation',
  category: 'Batch',
  severity: 'high',
  tags: ['s0c7', 'abend', 'cobol', 'arithmetic']
});

console.log(`✅ Created entry: ${entryId}`);
```

## 💡 Common Use Cases (10 minutes)

### Use Case 1: Search Implementation

```typescript
// Simple search
async function searchKnowledge(query: string) {
  const results = await db.search(query, {
    limit: 10,
    sortBy: 'relevance'
  });
  
  return results.map(r => ({
    title: r.entry.title,
    score: r.score,
    category: r.entry.category,
    successRate: r.entry.success_count / (r.entry.success_count + r.entry.failure_count + 1)
  }));
}

// Usage
const results = await searchKnowledge('VSAM status 35');
console.log(`Found ${results.length} matches`);
```

### Use Case 2: AI-Enhanced Search

```typescript
import { GeminiService } from './src/services/GeminiService';

const gemini = new GeminiService({
  apiKey: process.env.GOOGLE_AI_API_KEY // Get free key from Google AI Studio
});

async function intelligentSearch(query: string) {
  // Get all entries (you'd normally cache this)
  const allEntries = await db.getRecent(1000);
  
  // Use AI to find semantically similar entries
  const aiResults = await gemini.findSimilar(query, allEntries, 5);
  
  // Combine with regular search
  const regularResults = await db.search(query, { limit: 5 });
  
  // Merge and deduplicate results
  const combined = [...aiResults, ...regularResults];
  const unique = combined.filter((result, index, arr) => 
    arr.findIndex(r => r.entry.id === result.entry.id) === index
  );
  
  return unique.sort((a, b) => b.score - a.score).slice(0, 10);
}
```

### Use Case 3: Auto-Complete Feature

```typescript
async function getSearchSuggestions(partial: string) {
  if (partial.length < 2) return [];
  
  const suggestions = await db.autoComplete(partial, 8);
  
  return suggestions.map(s => ({
    text: s.suggestion,
    category: s.category,
    score: s.score
  }));
}

// Usage
const suggestions = await getSearchSuggestions('s0c');
// Returns: ['S0C7 data exception', 'S0C4 protection exception', ...]
```

### Use Case 4: Entry Management

```typescript
class KnowledgeManager {
  constructor(private db: KnowledgeDB) {}
  
  async createEntry(data: {
    title: string;
    problem: string;
    solution: string;
    category: string;
    severity?: string;
    tags?: string[];
  }, userId: string) {
    
    // Validate required fields
    if (!data.title || !data.problem || !data.solution) {
      throw new Error('Title, problem, and solution are required');
    }
    
    // Add the entry
    const id = await this.db.addEntry({
      ...data,
      severity: data.severity as any || 'medium',
      tags: data.tags || []
    }, userId);
    
    return id;
  }
  
  async updateEntry(id: string, updates: any, userId: string) {
    const existing = await this.db.getEntry(id);
    if (!existing) {
      throw new Error('Entry not found');
    }
    
    await this.db.updateEntry(id, updates, userId);
    return await this.db.getEntry(id);
  }
  
  async deleteEntry(id: string, userId: string) {
    // Soft delete by archiving
    await this.db.updateEntry(id, { archived: true }, userId);
  }
  
  async getEntryStats(id: string) {
    const entry = await this.db.getEntry(id);
    if (!entry) return null;
    
    const total = entry.success_count + entry.failure_count;
    
    return {
      id: entry.id,
      title: entry.title,
      usageCount: entry.usage_count,
      successRate: total > 0 ? (entry.success_count / total) * 100 : 0,
      lastUsed: entry.last_used,
      category: entry.category
    };
  }
}
```

### Use Case 5: Feedback System

```typescript
async function recordFeedback(entryId: string, wasHelpful: boolean, userId?: string) {
  // Record the usage
  await db.recordUsage(entryId, wasHelpful, userId);
  
  // Get updated stats
  const entry = await db.getEntry(entryId);
  const totalUses = entry.success_count + entry.failure_count;
  const successRate = totalUses > 0 ? (entry.success_count / totalUses) * 100 : 0;
  
  console.log(`Entry "${entry.title}" now has ${successRate.toFixed(1)}% success rate`);
  
  return successRate;
}

// Usage tracking
await recordFeedback(entryId, true, 'user.smith');  // Helpful
await recordFeedback(entryId, false, 'user.jones'); // Not helpful
```

## 🏗️ Integration Patterns

### Pattern 1: Express.js API

```typescript
import express from 'express';
import { createKnowledgeDB } from './src/database/KnowledgeDB';
import { GeminiService } from './src/services/GeminiService';

const app = express();
const db = await createKnowledgeDB('./knowledge.db');
const gemini = new GeminiService({ apiKey: process.env.GOOGLE_AI_API_KEY });

app.use(express.json());

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, limit = 10, useAI = false } = req.query;
    
    let results;
    if (useAI && gemini) {
      const entries = await db.getRecent(500); // Get recent entries for AI
      results = await gemini.findSimilar(q, entries, parseInt(limit));
    } else {
      results = await db.search(q, { category, limit: parseInt(limit) });
    }
    
    res.json({
      success: true,
      results: results.map(r => ({
        id: r.entry.id,
        title: r.entry.title,
        category: r.entry.category,
        score: r.score,
        matchType: r.matchType
      })),
      total: results.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create entry endpoint
app.post('/api/entries', async (req, res) => {
  try {
    const { title, problem, solution, category, tags, severity } = req.body;
    const userId = req.headers['user-id'] || 'anonymous';
    
    const id = await db.addEntry({
      title,
      problem,
      solution,
      category,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      severity
    }, userId);
    
    res.json({ success: true, id });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Feedback endpoint
app.post('/api/entries/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body;
    const userId = req.headers['user-id'] || 'anonymous';
    
    await db.recordUsage(id, helpful, userId);
    
    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => console.log('API server running on port 3000'));
```

### Pattern 2: Electron Main Process

```typescript
import { ipcMain } from 'electron';
import { createKnowledgeDB } from './src/database/KnowledgeDB';

let db: KnowledgeDB;

// Initialize database when app starts
export async function initializeDatabase() {
  try {
    db = await createKnowledgeDB('./knowledge.db', {
      autoBackup: true,
      backupInterval: 24
    });
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// IPC handlers for renderer process
ipcMain.handle('db-search', async (event, query, options = {}) => {
  try {
    return await db.search(query, options);
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
});

ipcMain.handle('db-add-entry', async (event, entry, userId) => {
  try {
    return await db.addEntry(entry, userId);
  } catch (error) {
    console.error('Add entry failed:', error);
    throw error;
  }
});

ipcMain.handle('db-get-stats', async () => {
  try {
    return await db.getStats();
  } catch (error) {
    console.error('Get stats failed:', error);
    throw error;
  }
});

ipcMain.handle('db-record-usage', async (event, entryId, successful, userId) => {
  try {
    await db.recordUsage(entryId, successful, userId);
    return { success: true };
  } catch (error) {
    console.error('Record usage failed:', error);
    throw error;
  }
});
```

### Pattern 3: React Components

```typescript
import React, { useState, useCallback } from 'react';

// Custom hook for knowledge search
function useKnowledgeSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (query: string, options = {}) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // In Electron renderer process
      const searchResults = await window.api.search(query, options);
      setResults(searchResults);
    } catch (err) {
      setError(err.message);
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}

// Search component
function KnowledgeSearch() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const { results, loading, error, search } = useKnowledgeSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query, { 
      category: selectedCategory || undefined,
      limit: 10 
    });
  };

  return (
    <div className="knowledge-search">
      <form onSubmit={handleSubmit}>
        <div className="search-controls">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for solutions..."
            disabled={loading}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="JCL">JCL</option>
            <option value="VSAM">VSAM</option>
            <option value="DB2">DB2</option>
            <option value="Batch">Batch</option>
          </select>
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && <div className="error">Error: {error}</div>}

      <div className="results">
        {results.map((result) => (
          <SearchResultCard key={result.entry.id} result={result} />
        ))}
      </div>
    </div>
  );
}

// Result card component
function SearchResultCard({ result }) {
  const [showDetails, setShowDetails] = useState(false);

  const handleFeedback = async (helpful: boolean) => {
    try {
      await window.api.recordUsage(result.entry.id, helpful);
      console.log('Feedback recorded');
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  };

  return (
    <div className="result-card">
      <div className="result-header">
        <h3>{result.entry.title}</h3>
        <div className="result-meta">
          <span className="score">Score: {result.score.toFixed(1)}%</span>
          <span className="category">{result.entry.category}</span>
          <span className="match-type">{result.matchType}</span>
        </div>
      </div>
      
      {showDetails && (
        <div className="result-details">
          <div className="problem">
            <h4>Problem:</h4>
            <p>{result.entry.problem}</p>
          </div>
          <div className="solution">
            <h4>Solution:</h4>
            <pre>{result.entry.solution}</pre>
          </div>
          <div className="tags">
            {result.entry.tags?.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      )}
      
      <div className="result-actions">
        <button onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
        <button onClick={() => handleFeedback(true)} className="helpful">
          👍 Helpful
        </button>
        <button onClick={() => handleFeedback(false)} className="not-helpful">
          👎 Not Helpful
        </button>
      </div>
    </div>
  );
}
```

## 🔧 Development Tips

### 1. Environment Setup

```bash
# .env file
GOOGLE_AI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```

### 2. Common Debugging

```typescript
// Enable debug logging
const db = new KnowledgeDB('./knowledge.db', { debug: true });

// Check database health
const health = await db.healthCheck();
console.log('Health check:', health);

// Performance monitoring
const stats = await db.getStats();
console.log('Performance:', stats.performance);
```

### 3. Testing Patterns

```typescript
import { KnowledgeDB } from './src/database/KnowledgeDB';

// Test with in-memory database
const testDB = new KnowledgeDB(':memory:');

describe('Knowledge Base Tests', () => {
  beforeEach(async () => {
    // Add test data
    await testDB.addEntry({
      title: 'Test Entry',
      problem: 'Test problem',
      solution: 'Test solution',
      category: 'Batch'
    });
  });

  test('should search entries', async () => {
    const results = await testDB.search('test');
    expect(results).toHaveLength(1);
    expect(results[0].entry.title).toBe('Test Entry');
  });
});
```

### 4. Performance Optimization

```typescript
// Cache frequently used data
const popularEntries = await db.getPopular(50);
const categoryStats = await db.getStats();

// Use specific searches instead of broad ones
const results = await db.search('error', { 
  category: 'VSAM',  // Faster than searching all categories
  limit: 10         // Don't over-fetch
});

// Batch operations when possible
const entries = [entry1, entry2, entry3];
for (const entry of entries) {
  await db.addEntry(entry, 'batch-user');
}
```

## 🚨 Common Pitfalls

### 1. Not Waiting for Initialization
```typescript
// ❌ Wrong
const db = new KnowledgeDB('./knowledge.db');
await db.search('query'); // May fail if not initialized

// ✅ Correct
const db = await createKnowledgeDB('./knowledge.db');
await db.search('query');
```

### 2. Not Handling AI Service Failures
```typescript
// ❌ Wrong
const results = await gemini.findSimilar(query, entries);

// ✅ Correct (AI methods auto-fallback, but handle errors)
try {
  const results = await gemini.findSimilar(query, entries);
} catch (error) {
  console.log('AI search failed, falling back to local search');
  const results = await db.search(query);
}
```

### 3. Not Closing Database Connections
```typescript
// ✅ Always clean up
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await db.close();
  process.exit();
});
```

## 🎯 Next Steps

1. **Explore AI Features**: Set up Google AI API key for enhanced search
2. **Build UI Components**: Use the React patterns above
3. **Add Monitoring**: Implement health checks and performance monitoring
4. **Scale Database**: Consider backup strategies and maintenance schedules
5. **Extend Categories**: Add custom categories for your organization

## 📚 Additional Resources

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Database Schema](./DATABASE_SCHEMA.md) - Database structure and relationships
- [Performance Guide](./PERFORMANCE_GUIDE.md) - Optimization tips and benchmarks
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions

Happy coding! 🚀