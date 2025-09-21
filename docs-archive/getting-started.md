# Getting Started with the Database Utilities System

## Overview

The Database Utilities System is a comprehensive, production-ready database management solution for the Mainframe Knowledge Base Assistant. It provides enterprise-grade features including connection pooling, query optimization, caching, backup/restore, and performance monitoring built on top of SQLite.

## Quick Start

### Prerequisites

- Node.js 16+ with TypeScript support
- SQLite3 development libraries
- 100MB+ available disk space for database and backups

### Basic Installation

```bash
# Clone the repository
git clone <repository-url>
cd mainframe-ai-assistant

# Install dependencies
npm install

# Build the project
npm run build

# Run initial database setup
npm run db:setup
```

### Your First Knowledge Base Entry

```typescript
import { KnowledgeDB } from './src/database/KnowledgeDB';

// Initialize the database
const db = new KnowledgeDB('./my-knowledge.db', {
  autoBackup: true,
  backupInterval: 24
});

// Wait for initialization
await new Promise(resolve => setTimeout(resolve, 1000));

// Add your first entry
const entryId = await db.addEntry({
  title: 'VSAM Status 35 - File Not Found',
  problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
  solution: '1. Verify the dataset exists using ISPF 3.4\n2. Check DD statement has correct DSN\n3. Ensure file is cataloged properly\n4. Verify RACF permissions',
  category: 'VSAM',
  severity: 'medium',
  tags: ['vsam', 'status-35', 'file-not-found', 'catalog']
});

console.log(`Created entry with ID: ${entryId}`);

// Search the knowledge base
const results = await db.search('VSAM status 35');
console.log(`Found ${results.length} matching entries:`);
results.forEach(result => {
  console.log(`- ${result.entry.title} (${result.score.toFixed(1)}% match)`);
});

// Get database statistics
const stats = await db.getStats();
console.log(`Knowledge base contains ${stats.totalEntries} entries`);

// Cleanup
await db.close();
```

### Configuration Options

The database system is highly configurable to suit different environments:

```typescript
import { KnowledgeDB } from './src/database/KnowledgeDB';

const db = new KnowledgeDB('./production.db', {
  // Backup configuration
  backupDir: '/var/backups/kb',
  maxBackups: 10,
  autoBackup: true,
  backupInterval: 6, // Hours between backups
  
  // Performance configuration (handled internally)
  // The system automatically optimizes based on usage patterns
});
```

## Core Concepts

### Knowledge Base Entries

Every entry in the knowledge base represents a problem-solution pair:

```typescript
interface KBEntry {
  id?: string;                    // Auto-generated UUID
  title: string;                  // Brief description
  problem: string;                // Detailed problem description
  solution: string;               // Step-by-step solution
  category: string;               // Mainframe component category
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];               // Searchable keywords
  usage_count?: number;          // How often accessed
  success_count?: number;        // Success rate tracking
  failure_count?: number;        // Failure rate tracking
}
```

### Search Capabilities

The system provides intelligent search with multiple strategies:

```typescript
// Simple text search
const results = await db.search('file not found error');

// Advanced search with filters
const results = await db.search('status code', {
  category: 'VSAM',
  limit: 10,
  sortBy: 'usage',
  includeArchived: false
});

// Special search operators
const results = await db.search('category:JCL');    // Category filter
const results = await db.search('tag:abend');       // Tag filter
```

### Performance Monitoring

Get insights into database performance:

```typescript
// Health check
const health = await db.healthCheck();
console.log('Database health:', health.overall ? '✅' : '❌');
console.log('Issues:', health.issues);

// Performance statistics
const stats = await db.getStats();
console.log(`Average search time: ${stats.performance.avgSearchTime}ms`);
console.log(`Cache hit rate: ${stats.performance.cacheHitRate}%`);

// Real-time performance status
const perfStatus = db.getPerformanceStatus();
console.log('Current performance:', perfStatus);
```

## Common Usage Patterns

### 1. Building a Knowledge Base

```typescript
const entries = [
  {
    title: 'S0C7 Data Exception',
    problem: 'Program abends with S0C7 during arithmetic operation',
    solution: '1. Check for uninitialized COMP-3 fields\n2. Validate input data\n3. Use NUMERIC test before arithmetic',
    category: 'Batch',
    tags: ['s0c7', 'abend', 'numeric']
  },
  {
    title: 'JES2 Job Not Found',
    problem: 'Cannot locate job output in SDSF',
    solution: '1. Check job number\n2. Verify output class routing\n3. Check retention settings',
    category: 'JCL',
    tags: ['jes2', 'sdsf', 'output']
  }
];

for (const entry of entries) {
  await db.addEntry(entry, 'system');
}
```

### 2. Advanced Search with Auto-complete

```typescript
// Auto-complete for search suggestions
const suggestions = await db.autoComplete('vsam', 5);
console.log('Suggestions:', suggestions.map(s => s.suggestion));

// Search with faceted results
const searchResult = await db.searchWithFacets('error code');
console.log('Results:', searchResult.results.length);
console.log('Categories:', searchResult.facets.categories);
console.log('Tags:', searchResult.facets.tags);
```

### 3. Usage Tracking and Analytics

```typescript
// Track entry usage
await db.recordUsage(entryId, true, 'john.smith'); // Success
await db.recordUsage(entryId, false, 'jane.doe');  // Failure

// Get popular entries
const popular = await db.getPopular(5);
console.log('Most popular entries:');
popular.forEach(result => {
  console.log(`- ${result.entry.title} (${result.entry.usage_count} uses)`);
});

// Get recent entries
const recent = await db.getRecent(5);
console.log('Recent entries:');
recent.forEach(result => {
  console.log(`- ${result.entry.title}`);
});
```

### 4. Backup and Recovery

```typescript
// Manual backup
await db.createBackup();
console.log('Backup created successfully');

// Export to JSON for external processing
await db.exportToJSON('./knowledge-export.json');

// Import from JSON (merge mode)
await db.importFromJSON('./external-knowledge.json', true);

// Restore from backup
await db.restoreFromBackup('./backups/backup-20241201.db');
```

### 5. Performance Optimization

```typescript
// Manual optimization
await db.optimize();
console.log('Database optimized');

// Get performance recommendations
const recommendations = db.getRecommendations();
recommendations.forEach(rec => console.log('💡', rec));

// Pre-warm cache for better performance
await db.preWarmCache();

// Cache management
const invalidated = await db.invalidateCache('search:*');
console.log(`Invalidated ${invalidated} cache entries`);
```

## Integration Examples

### With Express.js API

```typescript
import express from 'express';
import { KnowledgeDB } from './src/database/KnowledgeDB';

const app = express();
const db = new KnowledgeDB('./api-knowledge.db');

app.use(express.json());

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, limit } = req.query;
    const results = await db.search(q as string, {
      category: category as string,
      limit: parseInt(limit as string) || 10
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add entry endpoint
app.post('/api/entries', async (req, res) => {
  try {
    const entryId = await db.addEntry(req.body, req.user?.id);
    res.json({ success: true, entryId });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => console.log('API server running on port 3000'));
```

### With Electron Application

```typescript
import { app, ipcMain, BrowserWindow } from 'electron';
import { KnowledgeDB } from './src/database/KnowledgeDB';

let db: KnowledgeDB;
let mainWindow: BrowserWindow;

app.whenReady().then(async () => {
  // Initialize database
  db = new KnowledgeDB('./electron-knowledge.db');
  
  // Create window
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // IPC handlers
  ipcMain.handle('search-kb', async (event, query, options) => {
    return await db.search(query, options);
  });

  ipcMain.handle('add-kb-entry', async (event, entry) => {
    return await db.addEntry(entry, 'electron-user');
  });

  ipcMain.handle('get-kb-stats', async () => {
    return await db.getStats();
  });

  mainWindow.loadFile('index.html');
});

app.on('before-quit', async () => {
  if (db) {
    await db.close();
  }
});
```

## Environment Configuration

### Development

```typescript
const db = new KnowledgeDB('./dev-knowledge.db', {
  autoBackup: false,        // Disable for development
  backupInterval: 24,       // Daily backups if enabled
});

// Enable debug logging
process.env.DEBUG_DATABASE = 'true';
```

### Production

```typescript
const db = new KnowledgeDB('/data/knowledge.db', {
  backupDir: '/var/backups/knowledge',
  maxBackups: 30,           // Keep 30 days of backups
  autoBackup: true,
  backupInterval: 6,        // Backup every 6 hours
});

// Production monitoring
setInterval(async () => {
  const health = await db.healthCheck();
  if (!health.overall) {
    console.error('Database health issues:', health.issues);
    // Alert monitoring system
  }
}, 60000); // Check every minute
```

## Troubleshooting

### Common Issues

1. **Database Locked Error**
   - The system uses WAL mode to minimize locking
   - Check if another process has the database open
   - Increase timeout in configuration if needed

2. **Performance Issues**
   - Check cache hit rate: should be >70%
   - Monitor average search time: should be <1000ms
   - Run `db.optimize()` periodically
   - Consider pre-warming cache: `db.preWarmCache()`

3. **Memory Usage**
   - Database uses intelligent caching
   - Monitor with `db.getStats().performance`
   - Cache automatically evicts old entries

4. **Search Not Finding Results**
   - Check for typos in search terms
   - Try broader search terms
   - Verify category and tag filters
   - Check if entries are archived

### Debug Mode

```typescript
// Enable detailed logging
process.env.DEBUG_DATABASE = 'true';

// Monitor all database operations
const db = new KnowledgeDB('./debug.db');

// Listen for events (if supported)
db.on?.('query-slow', (event) => {
  console.warn('Slow query detected:', event.query, event.time);
});

db.on?.('cache-miss', (event) => {
  console.log('Cache miss for:', event.key);
});
```

## Next Steps

1. **Read the [Architecture Documentation](./architecture.md)** to understand the system design
2. **Explore [API Reference](./api/README.md)** for detailed method documentation  
3. **Check [Migration Guide](./migration-guide.md)** for upgrade procedures
4. **Browse [Usage Examples](../examples/)** for advanced patterns
5. **Review [Performance Guide](./performance-guide.md)** for optimization tips

## Support

For questions and support:
- Check the troubleshooting section above
- Review the comprehensive API documentation
- Look at the test files for usage examples
- Check the GitHub issues for known problems

The system is designed to be self-healing and performant out of the box, with intelligent defaults for most use cases.