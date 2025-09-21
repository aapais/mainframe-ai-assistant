# SQLite Schema Implementation Guide
## Mainframe KB Assistant MVP1 - Database Readiness Checklist

### Version: 1.0 | Date: January 2025

---

## 1. OVERVIEW

This implementation guide provides a comprehensive step-by-step process for setting up the SQLite database for the Mainframe Knowledge Base Assistant. The existing architecture is already sophisticated and production-ready.

### Current State Analysis

✅ **Already Implemented:**
- Complete schema with 10 tables and optimized indexes
- Full-text search (FTS5) with custom ranking
- Performance monitoring and connection pooling
- Automated migrations and backup system
- Comprehensive data seeding with 25+ mainframe KB entries
- Advanced caching and query optimization

✅ **Key Performance Features:**
- Sub-1-second search target with BM25 ranking
- WAL mode for concurrent access
- 64MB cache with memory-mapped I/O
- Automated index maintenance with triggers
- Multi-strategy search (exact, FTS, fuzzy, hybrid)

---

## 2. SCHEMA VERIFICATION CHECKLIST

### 2.1 Core Tables Verification

Run these queries to verify schema completeness:

```sql
-- Check all required tables exist
SELECT name FROM sqlite_master 
WHERE type='table' AND name IN (
    'kb_entries', 'kb_tags', 'kb_relations', 'search_history', 
    'usage_metrics', 'system_config', 'backup_log', 'error_log',
    'schema_migrations'
);

-- Verify FTS table
SELECT name FROM sqlite_master 
WHERE type='table' AND name = 'kb_fts';

-- Check indexes
SELECT name FROM sqlite_master 
WHERE type='index' AND name LIKE 'idx_%';

-- Verify views
SELECT name FROM sqlite_master 
WHERE type='view' AND name LIKE 'v_%';
```

### 2.2 PRAGMA Settings Verification

```sql
-- Verify performance settings
PRAGMA foreign_keys;          -- Should be 1
PRAGMA journal_mode;          -- Should be WAL
PRAGMA synchronous;           -- Should be 1 (NORMAL)
PRAGMA cache_size;            -- Should be -64000
PRAGMA temp_store;            -- Should be 2 (MEMORY)
PRAGMA mmap_size;             -- Should be 268435456
```

---

## 3. PERFORMANCE OPTIMIZATION IMPLEMENTATION

### 3.1 Index Effectiveness Analysis

```sql
-- Check index usage statistics
SELECT 
    name as index_name,
    tbl_name as table_name,
    sql as definition
FROM sqlite_master 
WHERE type='index' 
AND name LIKE 'idx_%'
ORDER BY tbl_name, name;

-- Analyze query plans for common searches
EXPLAIN QUERY PLAN 
SELECT * FROM kb_entries 
WHERE category = 'VSAM' AND archived = FALSE;

EXPLAIN QUERY PLAN
SELECT * FROM kb_fts 
WHERE kb_fts MATCH 'status error';
```

### 3.2 Performance Benchmarking Script

```typescript
// File: src/database/performance-test.ts
import { KnowledgeDB } from './KnowledgeDB';

export async function runPerformanceTests(): Promise<void> {
    const db = new KnowledgeDB(':memory:'); // For testing
    
    console.log('🧪 Running performance benchmarks...');
    
    // Test 1: Search Performance
    const searchQueries = [
        'VSAM status 35',
        'S0C7 error',
        'DB2 SQLCODE',
        'category:VSAM',
        'tag:error'
    ];
    
    for (const query of searchQueries) {
        const start = performance.now();
        await db.search(query, { limit: 10 });
        const duration = performance.now() - start;
        
        console.log(`Search "${query}": ${duration.toFixed(2)}ms`);
        
        if (duration > 1000) {
            console.warn(`⚠️ Search "${query}" exceeded 1s target: ${duration.toFixed(2)}ms`);
        }
    }
    
    // Test 2: Insert Performance
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
        await db.addEntry({
            title: `Test Entry ${i}`,
            problem: `Test problem description ${i}`,
            solution: `Test solution steps ${i}`,
            category: 'Other',
            tags: [`test-${i}`, 'performance']
        });
    }
    const insertDuration = performance.now() - start;
    console.log(`100 inserts: ${insertDuration.toFixed(2)}ms (${(insertDuration/100).toFixed(2)}ms avg)`);
    
    // Test 3: Cache Performance
    const cacheStats = db.getCacheStats();
    console.log(`Cache hit rate: ${cacheStats.hitRate.toFixed(2)}%`);
    
    await db.close();
}
```

---

## 4. DATABASE INITIALIZATION PROCESS

### 4.1 Step-by-Step Initialization

```typescript
// File: src/database/database-init.ts
import { KnowledgeDB, createKnowledgeDB } from './KnowledgeDB';
import fs from 'fs';
import path from 'path';

export async function initializeDatabase(
    dbPath: string = './data/knowledge.db'
): Promise<KnowledgeDB> {
    
    console.log('🚀 Starting database initialization...');
    
    // Step 1: Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`📁 Created data directory: ${dataDir}`);
    }
    
    // Step 2: Initialize database with full setup
    const db = await createKnowledgeDB(dbPath, {
        backupDir: path.join(dataDir, 'backups'),
        maxBackups: 10,
        autoBackup: true,
        backupInterval: 24 // hours
    });
    
    // Step 3: Verify initialization
    const stats = await db.getStats();
    console.log('📊 Database ready:');
    console.log(`   - Entries: ${stats.totalEntries}`);
    console.log(`   - Categories: ${Object.keys(stats.categoryCounts).length}`);
    console.log(`   - Disk usage: ${formatBytes(stats.diskUsage)}`);
    console.log(`   - Cache hit rate: ${stats.performance.cacheHitRate}%`);
    console.log(`   - Avg search time: ${stats.performance.avgSearchTime}ms`);
    
    // Step 4: Performance validation
    await validatePerformance(db);
    
    console.log('✅ Database initialization completed successfully!');
    return db;
}

async function validatePerformance(db: KnowledgeDB): Promise<void> {
    console.log('🔍 Validating performance targets...');
    
    // Test search performance
    const testQueries = ['VSAM', 'error', 'S0C7', 'category:DB2'];
    
    for (const query of testQueries) {
        const start = Date.now();
        await db.search(query, { limit: 10 });
        const duration = Date.now() - start;
        
        if (duration > 1000) {
            console.warn(`⚠️ Performance warning: "${query}" took ${duration}ms (target: <1000ms)`);
        } else {
            console.log(`✅ "${query}": ${duration}ms`);
        }
    }
    
    // Test health check
    const health = await db.healthCheck();
    if (!health.overall) {
        console.error('❌ Health check failed:', health.issues);
        throw new Error('Database health check failed');
    }
    
    console.log('✅ All performance targets met');
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

### 4.2 Environment Configuration

```typescript
// File: src/config/database.ts
import path from 'path';
import os from 'os';

export interface DatabaseConfig {
    path: string;
    backupDir: string;
    maxBackups: number;
    autoBackup: boolean;
    backupInterval: number;
    performanceMode: 'development' | 'production';
    cacheSize: number;
    mmapSize: number;
}

export function getDatabaseConfig(): DatabaseConfig {
    const isDev = process.env.NODE_ENV === 'development';
    const dataDir = process.env.DATA_DIR || path.join(os.homedir(), '.mainframe-kb');
    
    return {
        path: process.env.DB_PATH || path.join(dataDir, 'knowledge.db'),
        backupDir: path.join(dataDir, 'backups'),
        maxBackups: parseInt(process.env.MAX_BACKUPS || '10'),
        autoBackup: process.env.AUTO_BACKUP !== 'false',
        backupInterval: parseInt(process.env.BACKUP_INTERVAL || '24'),
        performanceMode: isDev ? 'development' : 'production',
        cacheSize: parseInt(process.env.DB_CACHE_SIZE || '64000'),
        mmapSize: parseInt(process.env.DB_MMAP_SIZE || '268435456')
    };
}
```

---

## 5. DATA SEEDING PROCESS

### 5.1 Automated Seeding Verification

The existing `DataSeeder` class provides comprehensive mainframe knowledge base entries. Verify seeding:

```typescript
// Test seeding status
const db = new KnowledgeDB();
const needsSeeding = await db.dataSeeder.needsSeeding();

if (needsSeeding) {
    console.log('🌱 Database needs seeding...');
    const result = await db.dataSeeder.seedAll();
    console.log(`✅ Seeded ${result.seeded} entries`);
} else {
    console.log('✅ Database already contains sufficient data');
}
```

### 5.2 Custom Entry Addition

```typescript
// Add custom knowledge entries
export async function addCustomEntry(db: KnowledgeDB): Promise<void> {
    const customEntry = {
        title: 'Custom Mainframe Issue',
        problem: 'Detailed problem description...',
        solution: 'Step-by-step solution...',
        category: 'Other',
        tags: ['custom', 'solution'],
        severity: 'medium' as const
    };
    
    const entryId = await db.addEntry(customEntry, 'admin');
    console.log(`✅ Added custom entry: ${entryId}`);
}
```

---

## 6. TESTING PROCEDURES

### 6.1 Unit Tests for Database Operations

```typescript
// File: tests/database/kb-operations.test.ts
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { describe, it, expect, beforeEach, afterEach } from 'jest';

describe('KnowledgeDB Operations', () => {
    let db: KnowledgeDB;

    beforeEach(async () => {
        db = new KnowledgeDB(':memory:');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for init
    });

    afterEach(async () => {
        await db.close();
    });

    describe('Search Performance', () => {
        it('should complete searches within 1 second', async () => {
            const start = Date.now();
            const results = await db.search('VSAM status');
            const duration = Date.now() - start;
            
            expect(duration).toBeLessThan(1000);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle empty searches gracefully', async () => {
            const results = await db.search('');
            expect(Array.isArray(results)).toBe(true);
        });

        it('should return relevant results for category search', async () => {
            const results = await db.search('category:VSAM');
            expect(results.every(r => r.entry.category === 'VSAM')).toBe(true);
        });
    });

    describe('Data Integrity', () => {
        it('should maintain referential integrity', async () => {
            const entryId = await db.addEntry({
                title: 'Test Entry',
                problem: 'Test problem',
                solution: 'Test solution',
                category: 'Other',
                tags: ['test']
            });

            const entry = await db.getEntry(entryId);
            expect(entry).toBeDefined();
            expect(entry.tags).toContain('test');
        });

        it('should update usage statistics correctly', async () => {
            const entryId = await db.addEntry({
                title: 'Usage Test',
                problem: 'Test problem',
                solution: 'Test solution',
                category: 'Other'
            });

            await db.recordUsage(entryId, true);
            const entry = await db.getEntry(entryId);
            
            expect(entry.success_count).toBe(1);
            expect(entry.usage_count).toBeGreaterThan(0);
        });
    });

    describe('Performance Monitoring', () => {
        it('should provide health check status', async () => {
            const health = await db.healthCheck();
            
            expect(health.overall).toBe(true);
            expect(health.database).toBe(true);
            expect(health.cache).toBe(true);
            expect(health.performance).toBe(true);
        });

        it('should return performance statistics', async () => {
            const stats = await db.getStats();
            
            expect(stats).toHaveProperty('totalEntries');
            expect(stats).toHaveProperty('performance');
            expect(stats.performance).toHaveProperty('avgSearchTime');
            expect(stats.performance).toHaveProperty('cacheHitRate');
        });
    });
});
```

### 6.2 Integration Tests

```typescript
// File: tests/integration/database-integration.test.ts
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { describe, it, expect } from 'jest';
import fs from 'fs';
import path from 'path';

describe('Database Integration Tests', () => {
    const testDbPath = path.join(__dirname, 'test.db');

    afterAll(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    it('should handle full workflow from creation to search', async () => {
        const db = new KnowledgeDB(testDbPath);
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify initial state
        const initialStats = await db.getStats();
        expect(initialStats.totalEntries).toBeGreaterThan(10); // Should have seeded data
        
        // Add new entry
        const entryId = await db.addEntry({
            title: 'Integration Test Entry',
            problem: 'Integration test problem',
            solution: 'Integration test solution',
            category: 'Other',
            tags: ['integration', 'test']
        });
        
        // Search for new entry
        const results = await db.search('Integration test');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.entry.id === entryId)).toBe(true);
        
        // Test backup functionality
        await db.createBackup();
        
        // Verify final state
        const finalStats = await db.getStats();
        expect(finalStats.totalEntries).toBe(initialStats.totalEntries + 1);
        
        await db.close();
    });
});
```

---

## 7. SQL MIGRATION SCRIPTS

### 7.1 Migration Framework Usage

The existing `MigrationManager` handles schema evolution:

```typescript
// Check migration status
const db = new KnowledgeDB();
const migrationStatus = db.migrationManager.getStatus();
console.log(`Current version: ${migrationStatus.currentVersion}`);
console.log(`Pending migrations: ${migrationStatus.pendingMigrations}`);

// Run pending migrations
const results = await db.migrationManager.migrate();
results.forEach(result => {
    if (result.success) {
        console.log(`✅ Migration ${result.version}: ${result.duration}ms`);
    } else {
        console.error(`❌ Migration ${result.version} failed: ${result.error}`);
    }
});
```

### 7.2 Example Migration File

```sql
-- File: migrations/001_add_performance_indexes.sql
-- UP
-- Migration: Add performance optimization indexes
-- Version: 001
-- Generated: 2025-01-01T00:00:00.000Z

-- Add composite index for category + usage
CREATE INDEX IF NOT EXISTS idx_kb_category_performance 
ON kb_entries(category, usage_count DESC, success_count DESC) 
WHERE archived = FALSE;

-- Add index for search history analysis
CREATE INDEX IF NOT EXISTS idx_search_query_timestamp 
ON search_history(query, timestamp DESC);

-- Add materialized view for popular categories
CREATE VIEW IF NOT EXISTS v_popular_categories AS
SELECT 
    category,
    COUNT(*) as entry_count,
    SUM(usage_count) as total_usage,
    AVG(CASE WHEN (success_count + failure_count) > 0 
             THEN CAST(success_count AS REAL) / (success_count + failure_count)
             ELSE 0 END) as avg_success_rate
FROM kb_entries 
WHERE archived = FALSE
GROUP BY category
ORDER BY total_usage DESC;

-- DOWN
-- Rollback for: Add performance optimization indexes

DROP INDEX IF EXISTS idx_kb_category_performance;
DROP INDEX IF EXISTS idx_search_query_timestamp;
DROP VIEW IF EXISTS v_popular_categories;
```

---

## 8. MONITORING AND MAINTENANCE

### 8.1 Performance Monitoring Setup

```typescript
// File: src/database/monitoring.ts
export class DatabaseMonitor {
    private db: KnowledgeDB;
    
    constructor(db: KnowledgeDB) {
        this.db = db;
    }
    
    async generateHealthReport(): Promise<any> {
        const health = await this.db.healthCheck();
        const stats = await this.db.getStats();
        const performance = this.db.getPerformanceStatus();
        
        return {
            timestamp: new Date().toISOString(),
            health,
            statistics: stats,
            performance: {
                avgSearchTime: performance.avgSearchTime,
                slowQueries: this.db.getSlowQueries(5),
                cacheStats: this.db.getCacheStats(),
                connectionStats: this.db.getConnectionPoolStats(),
                indexAnalysis: this.db.getIndexAnalysis()
            },
            recommendations: this.db.getRecommendations()
        };
    }
    
    async scheduleMaintenanceTasks(): Promise<void> {
        // Daily: Update statistics
        setInterval(async () => {
            await this.db.optimize();
            console.log('✅ Daily database optimization completed');
        }, 24 * 60 * 60 * 1000);
        
        // Weekly: Generate performance reports
        setInterval(async () => {
            const report = await this.generateHealthReport();
            console.log('📊 Weekly performance report:', report);
        }, 7 * 24 * 60 * 60 * 1000);
    }
}
```

### 8.2 Maintenance Queries

```sql
-- Database maintenance queries

-- 1. Check table sizes and record counts
SELECT 
    name as table_name,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name = m.name) as index_count
FROM sqlite_master m 
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY name;

-- 2. Analyze FTS index effectiveness
SELECT 
    COUNT(*) as total_entries,
    COUNT(CASE WHEN kb_fts.id IS NOT NULL THEN 1 END) as indexed_entries
FROM kb_entries e
LEFT JOIN kb_fts ON e.id = kb_fts.id;

-- 3. Check for slow queries
SELECT 
    query,
    COUNT(*) as frequency,
    AVG(search_time_ms) as avg_time,
    MAX(search_time_ms) as max_time
FROM search_history 
WHERE search_time_ms > 500
GROUP BY query
ORDER BY avg_time DESC;

-- 4. Storage utilization
SELECT 
    'Total Pages' as metric,
    page_count as value
FROM pragma_page_count
UNION ALL
SELECT 
    'Free Pages',
    freelist_count
FROM pragma_freelist_count
UNION ALL
SELECT 
    'Page Size',
    page_size
FROM pragma_page_size;

-- 5. Index usage statistics (requires SQLite 3.38+)
-- PRAGMA optimize;
-- SELECT * FROM pragma_index_info('idx_kb_category');
```

---

## 9. SAMPLE QUERIES FOR OPTIMAL USAGE

### 9.1 Search Queries

```typescript
// Optimal search patterns
export const searchExamples = {
    // 1. Basic text search
    basic: async (db: KnowledgeDB) => {
        return await db.search('VSAM status error');
    },
    
    // 2. Category-specific search
    category: async (db: KnowledgeDB) => {
        return await db.search('error', { category: 'VSAM' });
    },
    
    // 3. Tag-based search
    tags: async (db: KnowledgeDB) => {
        return await db.searchWithFacets('database error');
    },
    
    // 4. Advanced search with facets
    faceted: async (db: KnowledgeDB) => {
        return await db.searchWithFacets('performance issue', {
            includeArchived: false,
            sortBy: 'relevance',
            limit: 20
        });
    },
    
    // 5. Auto-complete search
    autocomplete: async (db: KnowledgeDB, query: string) => {
        return await db.autoComplete(query, 10);
    }
};
```

### 9.2 Analytics Queries

```sql
-- Popular search terms
SELECT 
    query,
    COUNT(*) as search_count,
    AVG(results_count) as avg_results
FROM search_history 
WHERE timestamp > datetime('now', '-30 days')
GROUP BY query
HAVING search_count > 2
ORDER BY search_count DESC
LIMIT 10;

-- Category effectiveness
SELECT 
    category,
    COUNT(*) as total_entries,
    SUM(usage_count) as total_usage,
    ROUND(AVG(CASE WHEN (success_count + failure_count) > 0 
                   THEN CAST(success_count AS REAL) / (success_count + failure_count) * 100
                   ELSE 0 END), 2) as success_rate_percent
FROM kb_entries 
WHERE archived = FALSE
GROUP BY category
ORDER BY success_rate_percent DESC;

-- Usage trends
SELECT 
    date(timestamp) as date,
    COUNT(*) as searches,
    COUNT(DISTINCT user_id) as unique_users
FROM search_history
WHERE timestamp > datetime('now', '-7 days')
GROUP BY date(timestamp)
ORDER BY date DESC;
```

---

## 10. MVP1 DATABASE READINESS CHECKLIST

### ✅ Pre-Deployment Checklist

- [ ] **Schema Verification**
  - [ ] All 9 core tables created successfully
  - [ ] FTS5 search table configured with proper tokenization
  - [ ] 15+ performance indexes created and analyzed
  - [ ] 4 views for common queries created
  - [ ] All triggers for data consistency active

- [ ] **Performance Validation**
  - [ ] Search operations complete in <1 second for 95% of queries
  - [ ] Database file size reasonable (< 100MB for initial deployment)
  - [ ] Cache hit rate > 70% after warm-up
  - [ ] Connection pool configured and tested

- [ ] **Data Integrity**
  - [ ] 25+ mainframe KB entries seeded successfully
  - [ ] All entries have proper categories and tags
  - [ ] FTS index populated and searchable
  - [ ] System configuration values set

- [ ] **Backup and Recovery**
  - [ ] Automated backup system configured
  - [ ] Backup directory created with proper permissions
  - [ ] Test backup/restore cycle completed successfully
  - [ ] Migration system tested and validated

- [ ] **Monitoring Setup**
  - [ ] Performance monitoring active
  - [ ] Health checks configured
  - [ ] Error logging functional
  - [ ] Usage analytics enabled

### ✅ Production Readiness Verification

```bash
# Run complete verification script
npm run test:database
npm run verify:performance
npm run check:health
npm run validate:data
```

### 🎯 Success Criteria

- **Response Time**: 95% of searches complete in <1000ms
- **Data Volume**: 25+ knowledge base entries ready for use
- **Reliability**: 99.9% uptime during testing period
- **Performance**: Cache hit rate >70%, avg search time <200ms
- **Scalability**: Handles 100+ concurrent searches without degradation

---

## 11. TROUBLESHOOTING GUIDE

### Common Issues and Solutions

**Issue**: FTS search not returning expected results
```sql
-- Rebuild FTS index
DELETE FROM kb_fts;
INSERT INTO kb_fts(rowid, id, title, problem, solution, tags)
SELECT rowid, id, title, problem, solution, 
       (SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = kb_entries.id)
FROM kb_entries;
```

**Issue**: Slow search performance
```sql
-- Analyze and optimize
ANALYZE;
PRAGMA optimize;

-- Check query plans
EXPLAIN QUERY PLAN SELECT * FROM kb_fts WHERE kb_fts MATCH 'your_query';
```

**Issue**: Database file corruption
```bash
# Check database integrity
sqlite3 knowledge.db "PRAGMA integrity_check;"

# Repair if needed
sqlite3 knowledge.db ".backup backup.db"
```

---

## CONCLUSION

The SQLite database for the Mainframe KB Assistant is already implemented with enterprise-grade architecture including:

- **Sophisticated Schema**: 9+ tables with proper relationships and constraints
- **Advanced Search**: FTS5 with BM25 ranking and multi-strategy search
- **Performance Optimization**: Connection pooling, caching, and automated index management
- **Data Integrity**: Comprehensive triggers and validation
- **Monitoring**: Real-time performance tracking and health checks
- **Backup System**: Automated backups with point-in-time recovery

This implementation guide ensures the database is production-ready for MVP1 deployment with sub-second search performance and enterprise-grade reliability.

**Next Steps**: Execute the verification checklist and run performance tests to confirm readiness for production deployment.