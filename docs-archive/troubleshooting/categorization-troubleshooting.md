# Categorization and Tagging System Troubleshooting

## Table of Contents
- [Common Issues](#common-issues)
- [Performance Problems](#performance-problems)
- [Database Issues](#database-issues)
- [UI Component Issues](#ui-component-issues)
- [API Integration Issues](#api-integration-issues)
- [Search and Indexing Issues](#search-and-indexing-issues)
- [Data Quality Issues](#data-quality-issues)
- [Diagnostic Tools](#diagnostic-tools)
- [Recovery Procedures](#recovery-procedures)

## Common Issues

### Issue 1: Tags Not Appearing in Suggestions

**Symptoms:**
- Tag input shows no suggestions when typing
- Previously working suggestions stopped appearing
- Specific tags missing from suggestion list

**Possible Causes:**
1. Database connectivity issues
2. Full-text search index corruption
3. Caching issues
4. API service unavailable
5. User permission restrictions

**Troubleshooting Steps:**

1. **Check Database Connection:**
   ```bash
   # Verify database is accessible
   sqlite3 knowledge.db ".tables"

   # Check if tags table has data
   sqlite3 knowledge.db "SELECT COUNT(*) FROM tags;"
   ```

2. **Verify FTS Index:**
   ```sql
   -- Check FTS index exists and is populated
   SELECT COUNT(*) FROM tags_fts;

   -- Rebuild FTS index if needed
   INSERT INTO tags_fts(tags_fts) VALUES('rebuild');
   ```

3. **Clear Application Cache:**
   ```typescript
   // In your application
   TagService.clearCache();
   await TagService.refreshSuggestions();
   ```

4. **Check API Connectivity:**
   ```typescript
   // Test Gemini API connectivity
   try {
     const response = await GeminiService.testConnection();
     console.log('API Status:', response.status);
   } catch (error) {
     console.error('API Error:', error);
   }
   ```

5. **Verify User Permissions:**
   ```typescript
   // Check user has tag suggestion permissions
   const permissions = await PermissionService.getUserPermissions(userId);
   console.log('Tag Permissions:', permissions.tags);
   ```

**Solution Examples:**

```typescript
// Force refresh tag suggestions
export async function forceSuggestionRefresh() {
  try {
    // Clear all caches
    await TagService.clearCache();
    await CategoryService.clearCache();

    // Rebuild FTS indexes
    await DatabaseService.rebuildSearchIndexes();

    // Refresh suggestion sources
    await TagService.refreshAllSuggestionSources();

    console.log('Tag suggestions refreshed successfully');
  } catch (error) {
    console.error('Failed to refresh suggestions:', error);
    throw error;
  }
}
```

### Issue 2: Category Tree Not Loading

**Symptoms:**
- Empty category tree display
- Loading spinner never stops
- Error messages in console
- Categories appear in wrong hierarchy

**Possible Causes:**
1. Malformed hierarchy data
2. Circular references in parent-child relationships
3. Missing parent categories
4. Database corruption
5. Component rendering issues

**Troubleshooting Steps:**

1. **Validate Hierarchy Data:**
   ```sql
   -- Check for orphaned categories (parent doesn't exist)
   SELECT c1.id, c1.name, c1.parent_id
   FROM categories c1
   LEFT JOIN categories c2 ON c1.parent_id = c2.id
   WHERE c1.parent_id IS NOT NULL AND c2.id IS NULL;

   -- Check for circular references
   WITH RECURSIVE category_path AS (
     SELECT id, name, parent_id, CAST(id AS TEXT) as path, 0 as level
     FROM categories
     WHERE parent_id IS NULL

     UNION ALL

     SELECT c.id, c.name, c.parent_id,
            cp.path || '->' || c.id, cp.level + 1
     FROM categories c
     JOIN category_path cp ON c.parent_id = cp.id
     WHERE cp.level < 10  -- Prevent infinite loops
   )
   SELECT * FROM category_path WHERE level > 5;
   ```

2. **Check Component Props:**
   ```typescript
   // Debug category tree props
   console.log('Categories prop:', categories);
   console.log('Loading state:', loading);
   console.log('Error state:', error);

   // Verify data structure
   categories.forEach(cat => {
     if (!cat.id || !cat.name) {
       console.error('Invalid category:', cat);
     }
   });
   ```

3. **Test with Minimal Data:**
   ```typescript
   // Test with simple hierarchy
   const testCategories = [
     { id: '1', name: 'Root 1', parent_id: null, level: 0 },
     { id: '2', name: 'Child 1', parent_id: '1', level: 1 }
   ];

   return <EnhancedCategoryTree categories={testCategories} />;
   ```

**Solution Examples:**

```typescript
// Fix orphaned categories
export async function fixOrphanedCategories() {
  const db = await DatabaseService.getConnection();

  const transaction = db.transaction(() => {
    // Find orphaned categories
    const orphaned = db.prepare(`
      SELECT c1.id, c1.name, c1.parent_id
      FROM categories c1
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE c1.parent_id IS NOT NULL AND c2.id IS NULL
    `).all();

    console.log(`Found ${orphaned.length} orphaned categories`);

    // Move orphaned categories to root
    const fixStmt = db.prepare(`
      UPDATE categories
      SET parent_id = NULL, level = 0
      WHERE id = ?
    `);

    orphaned.forEach(cat => {
      fixStmt.run(cat.id);
      console.log(`Fixed orphaned category: ${cat.name}`);
    });
  });

  transaction();
}

// Detect and break circular references
export async function fixCircularReferences() {
  const categories = await CategoryRepository.findAll();
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCircularReference(categoryId: string): boolean {
    if (recursionStack.has(categoryId)) {
      return true; // Circular reference found
    }

    if (visited.has(categoryId)) {
      return false; // Already processed
    }

    visited.add(categoryId);
    recursionStack.add(categoryId);

    const category = categories.find(c => c.id === categoryId);
    if (category?.parent_id) {
      if (hasCircularReference(category.parent_id)) {
        return true;
      }
    }

    recursionStack.delete(categoryId);
    return false;
  }

  // Check all categories for circular references
  const circularCategories = categories.filter(cat =>
    hasCircularReference(cat.id)
  );

  // Break circular references by moving to root
  for (const cat of circularCategories) {
    await CategoryRepository.update(cat.id, { parent_id: null });
    console.log(`Fixed circular reference for category: ${cat.name}`);
  }
}
```

### Issue 3: Search Not Returning Results

**Symptoms:**
- Search returns empty results for known content
- Some terms work, others don't
- Search is case-sensitive when it shouldn't be
- Slow search performance

**Possible Causes:**
1. Search index not built or corrupted
2. Query syntax issues
3. Database permissions
4. Tokenization problems
5. Language configuration issues

**Troubleshooting Steps:**

1. **Test Basic Search:**
   ```sql
   -- Test direct database search
   SELECT * FROM tags WHERE name LIKE '%error%';

   -- Test FTS search
   SELECT * FROM tags_fts WHERE tags_fts MATCH 'error';
   ```

2. **Check Index Status:**
   ```sql
   -- Verify FTS table exists and has data
   PRAGMA table_info(tags_fts);
   SELECT COUNT(*) FROM tags_fts;

   -- Check index integrity
   INSERT INTO tags_fts(tags_fts) VALUES('integrity-check');
   ```

3. **Debug Search Query:**
   ```typescript
   // Log search queries for debugging
   const originalSearch = TagRepository.search;
   TagRepository.search = async function(query: string, options: any) {
     console.log('Search Query:', query);
     console.log('Search Options:', options);

     const start = Date.now();
     const results = await originalSearch.call(this, query, options);
     console.log(`Search took ${Date.now() - start}ms, returned ${results.length} results`);

     return results;
   };
   ```

**Solution Examples:**

```typescript
// Rebuild search indexes
export async function rebuildSearchIndexes() {
  const db = await DatabaseService.getConnection();

  try {
    console.log('Rebuilding search indexes...');

    // Rebuild tags FTS index
    db.exec('DROP TABLE IF EXISTS tags_fts');
    db.exec(`
      CREATE VIRTUAL TABLE tags_fts USING fts5(
        id UNINDEXED,
        name,
        display_name,
        description,
        content=tags,
        content_rowid=rowid
      )
    `);

    // Populate FTS index
    db.exec(`
      INSERT INTO tags_fts(id, name, display_name, description)
      SELECT id, name, display_name, description FROM tags
    `);

    // Rebuild categories FTS index
    db.exec('DROP TABLE IF EXISTS categories_fts');
    db.exec(`
      CREATE VIRTUAL TABLE categories_fts USING fts5(
        id UNINDEXED,
        name,
        description,
        content=categories,
        content_rowid=rowid
      )
    `);

    db.exec(`
      INSERT INTO categories_fts(id, name, description)
      SELECT id, name, description FROM categories
    `);

    console.log('Search indexes rebuilt successfully');
  } catch (error) {
    console.error('Failed to rebuild indexes:', error);
    throw error;
  }
}

// Optimize FTS queries
export class OptimizedSearchService {
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Normalize query for better matching
    const normalizedQuery = this.normalizeSearchQuery(query);

    // Try different search strategies
    const strategies = [
      () => this.exactSearch(normalizedQuery),
      () => this.prefixSearch(normalizedQuery),
      () => this.fuzzySearch(normalizedQuery),
      () => this.semanticSearch(normalizedQuery)
    ];

    for (const strategy of strategies) {
      const results = await strategy();
      if (results.length > 0) {
        return results;
      }
    }

    return [];
  }

  private normalizeSearchQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // Remove special chars
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
  }
}
```

## Performance Problems

### Issue 1: Slow Tag Input Response

**Symptoms:**
- Delay between typing and suggestions appearing
- UI freezing during tag operations
- High CPU usage
- Memory leaks over time

**Diagnosis:**

```typescript
// Performance monitoring for tag input
export class TagInputPerformanceMonitor {
  private metrics = new Map<string, number[]>();

  measureOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();

    return fn().finally(() => {
      const duration = performance.now() - start;

      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }

      this.metrics.get(operation)!.push(duration);

      // Log slow operations
      if (duration > 1000) {
        console.warn(`Slow ${operation}: ${duration.toFixed(2)}ms`);
      }
    });
  }

  getStats(operation: string) {
    const times = this.metrics.get(operation) || [];
    return {
      count: times.length,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      max: Math.max(...times),
      min: Math.min(...times)
    };
  }
}
```

**Solutions:**

1. **Implement Debouncing:**
   ```typescript
   const debouncedSearch = useDebouncedCallback(
     async (query: string) => {
       const suggestions = await TagService.getSuggestions(query);
       setSuggestions(suggestions);
     },
     300  // Wait 300ms after user stops typing
   );
   ```

2. **Add Result Caching:**
   ```typescript
   class CachedTagService {
     private cache = new Map<string, { data: any; timestamp: number }>();
     private cacheTimeout = 5 * 60 * 1000; // 5 minutes

     async getSuggestions(query: string): Promise<TagSuggestion[]> {
       const cacheKey = query.toLowerCase();
       const cached = this.cache.get(cacheKey);

       if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
         return cached.data;
       }

       const suggestions = await this.fetchSuggestions(query);
       this.cache.set(cacheKey, { data: suggestions, timestamp: Date.now() });

       return suggestions;
     }
   }
   ```

3. **Optimize Database Queries:**
   ```typescript
   // Use prepared statements for better performance
   class OptimizedTagRepository {
     private preparedQueries = new Map<string, any>();

     constructor(private db: Database) {
       this.preparedQueries.set('searchTags', db.prepare(`
         SELECT * FROM tags_fts
         WHERE tags_fts MATCH ?
         ORDER BY rank
         LIMIT ?
       `));
     }

     async search(query: string, limit: number = 20): Promise<Tag[]> {
       return this.preparedQueries.get('searchTags').all(query, limit);
     }
   }
   ```

### Issue 2: Category Tree Rendering Performance

**Symptoms:**
- Slow expansion/collapse of large category trees
- UI lag when scrolling through categories
- High memory usage with many categories

**Solutions:**

1. **Implement Virtual Scrolling:**
   ```typescript
   const CategoryTreeWithVirtualization: React.FC<Props> = ({ categories }) => {
     const virtualizer = useVirtualizer({
       count: categories.length,
       getScrollElement: () => containerRef.current,
       estimateSize: () => 35,
       overscan: 5
     });

     return (
       <div ref={containerRef} style={{ height: '400px', overflow: 'auto' }}>
         <div style={{ height: virtualizer.getTotalSize() }}>
           {virtualizer.getVirtualItems().map(virtualRow => (
             <CategoryNode
               key={virtualRow.key}
               category={categories[virtualRow.index]}
               style={{
                 position: 'absolute',
                 top: 0,
                 left: 0,
                 width: '100%',
                 height: `${virtualRow.size}px`,
                 transform: `translateY(${virtualRow.start}px)`
               }}
             />
           ))}
         </div>
       </div>
     );
   };
   ```

2. **Optimize Re-renders:**
   ```typescript
   // Memoize expensive calculations
   const CategoryNode = React.memo<CategoryNodeProps>(({ category, ...props }) => {
     const memoizedChildren = useMemo(() =>
       category.children.sort((a, b) => a.sort_order - b.sort_order),
       [category.children]
     );

     return (
       <div className="category-node">
         {/* Category content */}
         {category.isExpanded && memoizedChildren.map(child => (
           <CategoryNode key={child.id} category={child} {...props} />
         ))}
       </div>
     );
   });
   ```

## Database Issues

### Issue 1: Database Corruption

**Symptoms:**
- SQLite errors: "database disk image is malformed"
- Missing data after application restart
- Inconsistent query results
- Application crashes on database operations

**Diagnosis:**

```bash
# Check database integrity
sqlite3 knowledge.db "PRAGMA integrity_check;"

# Check for corruption
sqlite3 knowledge.db "PRAGMA quick_check;"

# Check database file size and page count
sqlite3 knowledge.db "PRAGMA page_count; PRAGMA page_size;"
```

**Recovery Steps:**

1. **Backup First:**
   ```bash
   cp knowledge.db knowledge.db.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Attempt Repair:**
   ```bash
   # Try to recover using SQLite dump/restore
   sqlite3 knowledge.db ".dump" | sqlite3 knowledge_recovered.db

   # Verify recovered database
   sqlite3 knowledge_recovered.db "PRAGMA integrity_check;"
   ```

3. **Manual Recovery:**
   ```typescript
   export async function recoverDatabase() {
     const backupPath = 'knowledge.db.backup';
     const mainPath = 'knowledge.db';
     const recoveredPath = 'knowledge_recovered.db';

     try {
       // Try to export data from corrupted database
       const corruptedDb = new Database(mainPath);
       const recoveredDb = new Database(recoveredPath);

       // Recreate schema
       await this.recreateSchema(recoveredDb);

       // Recover data table by table
       const tables = ['categories', 'tags', 'tag_associations'];

       for (const table of tables) {
         console.log(`Recovering table: ${table}`);
         await this.recoverTable(corruptedDb, recoveredDb, table);
       }

       console.log('Database recovery completed');

       // Verify recovered data
       const verification = await this.verifyRecoveredData(recoveredDb);
       console.log('Recovery verification:', verification);

     } catch (error) {
       console.error('Database recovery failed:', error);
       throw error;
     }
   }

   private async recoverTable(
     sourceDb: Database,
     targetDb: Database,
     tableName: string
   ) {
     try {
       const rows = sourceDb.prepare(`SELECT * FROM ${tableName}`).all();

       if (rows.length > 0) {
         const columns = Object.keys(rows[0]);
         const placeholders = columns.map(() => '?').join(',');
         const insertStmt = targetDb.prepare(
           `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`
         );

         const transaction = targetDb.transaction((data) => {
           data.forEach(row => {
             insertStmt.run(...columns.map(col => row[col]));
           });
         });

         transaction(rows);
         console.log(`Recovered ${rows.length} rows from ${tableName}`);
       }
     } catch (error) {
       console.warn(`Failed to recover table ${tableName}:`, error);
     }
   }
   ```

### Issue 2: Lock Timeouts

**Symptoms:**
- "Database is locked" errors
- Hanging database operations
- Concurrent access failures

**Solutions:**

```typescript
// Implement connection pooling and retry logic
export class DatabaseConnectionManager {
  private connectionPool: Database[] = [];
  private maxConnections = 5;
  private retryAttempts = 3;
  private retryDelay = 1000;

  async executeWithRetry<T>(operation: (db: Database) => T): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const db = await this.getConnection();
        const result = operation(db);
        this.releaseConnection(db);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (error.message.includes('database is locked') && attempt < this.retryAttempts) {
          console.log(`Database locked, retrying attempt ${attempt + 1} in ${this.retryDelay}ms`);
          await this.sleep(this.retryDelay * attempt);
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  private async getConnection(): Promise<Database> {
    if (this.connectionPool.length > 0) {
      return this.connectionPool.pop()!;
    }

    return new Database('knowledge.db', {
      timeout: 10000,
      prepare: true
    });
  }

  private releaseConnection(db: Database): void {
    if (this.connectionPool.length < this.maxConnections) {
      this.connectionPool.push(db);
    } else {
      db.close();
    }
  }
}
```

## UI Component Issues

### Issue 1: Tag Input Not Accepting Input

**Symptoms:**
- Input field appears disabled
- Cannot type in tag input
- Suggestions not appearing
- Tags cannot be added or removed

**Troubleshooting:**

```typescript
// Debug tag input component state
export const DebugTagInput: React.FC<TagInputProps> = (props) => {
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    setDebugInfo({
      propsValue: props.value,
      propsOnChange: typeof props.onChange,
      propsDisabled: props.disabled,
      propsReadOnly: props.readOnly,
      componentMounted: true,
      timestamp: Date.now()
    });
  }, [props]);

  if (process.env.NODE_ENV === 'development') {
    console.log('TagInput Debug Info:', debugInfo);
  }

  return (
    <div>
      <EnhancedTagInput {...props} />
      {process.env.NODE_ENV === 'development' && (
        <pre style={{ fontSize: '10px', background: '#f0f0f0', padding: '5px' }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      )}
    </div>
  );
};
```

**Common Fixes:**

1. **Check Props:**
   ```typescript
   // Ensure required props are provided
   <EnhancedTagInput
     value={tags}              // Must be array
     onChange={setTags}        // Must be function
     disabled={false}          // Check not disabled
     readOnly={false}          // Check not readonly
   />
   ```

2. **Verify Event Handlers:**
   ```typescript
   const handleTagChange = useCallback((newTags: Tag[]) => {
     console.log('Tag change:', newTags);
     setTags(newTags);
   }, []);
   ```

### Issue 2: Category Tree Drag and Drop Not Working

**Symptoms:**
- Cannot drag categories
- Drop zones not highlighting
- Categories not reordering

**Solutions:**

```typescript
// Debug drag and drop
export const DragDropDebugger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      console.log('Drag started:', e.target);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      console.log('Drag over:', e.target);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      console.log('Drop:', e.target);
    };

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return <>{children}</>;
};
```

## API Integration Issues

### Issue 1: Gemini API Failures

**Symptoms:**
- "API key not valid" errors
- Request timeout errors
- Rate limit exceeded errors
- Unexpected API responses

**Troubleshooting:**

```typescript
// API health checker
export class GeminiAPIHealthChecker {
  async checkAPIHealth(): Promise<APIHealthStatus> {
    const checks = {
      connectivity: false,
      authentication: false,
      rateLimit: false,
      responseTime: 0
    };

    try {
      const start = Date.now();

      // Test basic connectivity
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY!
        }
      });

      checks.responseTime = Date.now() - start;
      checks.connectivity = response.ok;

      if (response.status === 401) {
        checks.authentication = false;
      } else if (response.status === 429) {
        checks.rateLimit = false;
      } else if (response.ok) {
        checks.authentication = true;
        checks.rateLimit = true;
      }

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        checks,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        checks,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}
```

**Solutions:**

1. **Implement Retry Logic:**
   ```typescript
   export class ResilientGeminiService {
     private maxRetries = 3;
     private baseDelay = 1000;

     async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
       let lastError: Error;

       for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
         try {
           return await requestFn();
         } catch (error) {
           lastError = error as Error;

           if (this.isRetryableError(error) && attempt < this.maxRetries) {
             const delay = this.baseDelay * Math.pow(2, attempt - 1);
             console.log(`API request failed, retrying in ${delay}ms (attempt ${attempt})`);
             await this.sleep(delay);
             continue;
           }

           throw error;
         }
       }

       throw lastError!;
     }

     private isRetryableError(error: any): boolean {
       return (
         error.status === 429 ||  // Rate limit
         error.status >= 500 ||   // Server errors
         error.code === 'ECONNRESET' ||
         error.code === 'ETIMEDOUT'
       );
     }
   }
   ```

2. **Add Fallback Mechanisms:**
   ```typescript
   export class FallbackTagService {
     async getSuggestions(query: string): Promise<TagSuggestion[]> {
       try {
         // Try AI-powered suggestions first
         return await this.getAISuggestions(query);
       } catch (error) {
         console.warn('AI suggestions failed, falling back to local:', error);
         return await this.getLocalSuggestions(query);
       }
     }

     private async getLocalSuggestions(query: string): Promise<TagSuggestion[]> {
       // Implement local suggestion logic as fallback
       const tags = await TagRepository.search(query, { fuzzy: true, limit: 10 });
       return tags.map(tag => ({
         tag,
         score: this.calculateLocalScore(query, tag),
         source: 'local',
         reasoning: 'Local text matching'
       }));
     }
   }
   ```

## Recovery Procedures

### Complete System Recovery

```typescript
export class SystemRecoveryManager {
  async performFullRecovery(): Promise<RecoveryReport> {
    const report: RecoveryReport = {
      startTime: new Date(),
      steps: [],
      success: false,
      errors: []
    };

    try {
      // Step 1: Database recovery
      report.steps.push(await this.recoverDatabase());

      // Step 2: Rebuild indexes
      report.steps.push(await this.rebuildIndexes());

      // Step 3: Validate data integrity
      report.steps.push(await this.validateDataIntegrity());

      // Step 4: Clear caches
      report.steps.push(await this.clearAllCaches());

      // Step 5: Restart services
      report.steps.push(await this.restartServices());

      report.success = true;
      report.endTime = new Date();

    } catch (error) {
      report.errors.push(error.message);
      report.success = false;
      report.endTime = new Date();
    }

    return report;
  }

  private async recoverDatabase(): Promise<RecoveryStep> {
    const step: RecoveryStep = {
      name: 'Database Recovery',
      startTime: new Date(),
      success: false
    };

    try {
      // Check database integrity
      const integrityCheck = await DatabaseService.checkIntegrity();

      if (!integrityCheck.passed) {
        // Attempt automatic repair
        await DatabaseService.repair();

        // Verify repair was successful
        const recheck = await DatabaseService.checkIntegrity();
        if (!recheck.passed) {
          throw new Error('Database repair failed');
        }
      }

      step.success = true;
      step.endTime = new Date();
      step.message = 'Database recovery completed successfully';

    } catch (error) {
      step.success = false;
      step.endTime = new Date();
      step.error = error.message;
    }

    return step;
  }
}
```

### Backup and Restore

```typescript
export class BackupManager {
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `backups/backup-${timestamp}`;

    await fs.mkdir(backupDir, { recursive: true });

    // Backup database
    await fs.copyFile('knowledge.db', `${backupDir}/knowledge.db`);

    // Backup configuration
    await fs.copyFile('config.json', `${backupDir}/config.json`);

    // Export data to JSON for portability
    const data = await this.exportAllData();
    await fs.writeFile(
      `${backupDir}/data-export.json`,
      JSON.stringify(data, null, 2)
    );

    // Create manifest
    const manifest = {
      created: new Date(),
      version: process.env.npm_package_version,
      files: ['knowledge.db', 'config.json', 'data-export.json'],
      checksum: await this.calculateChecksum(backupDir)
    };

    await fs.writeFile(
      `${backupDir}/manifest.json`,
      JSON.stringify(manifest, null, 2)
    );

    return backupDir;
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    // Verify backup integrity
    const manifest = JSON.parse(
      await fs.readFile(`${backupPath}/manifest.json`, 'utf8')
    );

    const currentChecksum = await this.calculateChecksum(backupPath);
    if (currentChecksum !== manifest.checksum) {
      throw new Error('Backup integrity check failed');
    }

    // Create current state backup before restore
    const rollbackPath = await this.createBackup();
    console.log(`Created rollback backup at: ${rollbackPath}`);

    try {
      // Restore database
      await fs.copyFile(`${backupPath}/knowledge.db`, 'knowledge.db');

      // Restore configuration
      await fs.copyFile(`${backupPath}/config.json`, 'config.json');

      // Verify restored system
      await this.verifySystemIntegrity();

      console.log('Backup restored successfully');

    } catch (error) {
      // Rollback on failure
      console.error('Restore failed, rolling back:', error);
      await this.restoreFromBackup(rollbackPath);
      throw error;
    }
  }
}
```

This troubleshooting guide provides comprehensive solutions for common issues in the categorization and tagging system. Regular monitoring and proactive maintenance can prevent many of these issues from occurring.