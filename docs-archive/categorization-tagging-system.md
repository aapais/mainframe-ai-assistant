# Categorization and Tagging System Documentation

## Table of Contents
- [Overview](#overview)
- [User Guide](#user-guide)
- [API Documentation](#api-documentation)
- [Developer Documentation](#developer-documentation)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)

## Overview

The Mainframe Knowledge Base Assistant features a sophisticated categorization and tagging system designed to organize and enhance knowledge base entries efficiently. The system provides hierarchical categories, intelligent tagging with AI suggestions, and advanced search capabilities.

### Key Features

- **Hierarchical Categories**: Up to 5 levels of nested categories
- **Intelligent Tagging**: AI-powered tag suggestions with semantic matching
- **Advanced Search**: Full-text search with filtering by categories and tags
- **Drag-and-Drop**: Intuitive reordering of categories and tags
- **Accessibility**: WCAG 2.1 AA compliant interface
- **Performance**: Optimized with virtual scrolling and caching
- **Analytics**: Usage tracking and trend analysis

### System Architecture

```
┌─────────────────────────────────────────────────┐
│                 UI Components                   │
├─────────────────────────────────────────────────┤
│ EnhancedTagInput │ EnhancedCategoryTree        │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│                  Services                       │
├─────────────────────────────────────────────────┤
│ TagService       │ CategoryService              │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│                 Repositories                    │
├─────────────────────────────────────────────────┤
│ TagRepository    │ CategoryRepository           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│               Database Layer                    │
├─────────────────────────────────────────────────┤
│ SQLite with FTS5 │ Optimized Views & Indexes   │
└─────────────────────────────────────────────────┘
```

## User Guide

### Working with Categories

#### Creating Categories

1. **From Category Tree:**
   - Click the "➕" button in the category tree header
   - Right-click on a parent category and select "Add Child"

2. **Category Properties:**
   - **Name**: Display name for the category
   - **Slug**: URL-friendly identifier (auto-generated)
   - **Description**: Optional detailed description
   - **Icon**: Visual indicator (emoji or icon class)
   - **Color**: Category color for visual grouping
   - **Parent**: Select parent for hierarchical organization

3. **Example Categories:**
   ```
   📋 JCL
   ├── 📄 Job Control
   ├── 🔧 Procedures
   └── ⚠️ Error Handling

   🗄️ VSAM
   ├── 📊 KSDS
   ├── 🔢 ESDS
   └── 🔧 Utilities

   🗃️ DB2
   ├── 📝 SQL
   ├── 🛠️ Utilities
   └── 🔧 Administration
   ```

#### Managing Categories

**Reordering:**
- Drag categories to reorder within the same parent
- Use context menu "Move" option for cross-parent moves

**Editing:**
- Double-click category name for inline editing
- Press F2 key when category is selected
- Use context menu "Rename" option

**Deleting:**
- Press Delete key when category is selected
- Use context menu "Delete" option
- Note: Categories with children or entries cannot be deleted

### Working with Tags

#### Adding Tags

1. **Manual Entry:**
   - Type tag name in the tag input field
   - Press Enter or Tab to add
   - Tags are case-insensitive and auto-normalized

2. **From Suggestions:**
   - Start typing to see intelligent suggestions
   - Use arrow keys to navigate suggestions
   - Press Enter or click to select

3. **Batch Operations:**
   - Copy and paste comma-separated tags
   - Use bulk operations for multiple entries

#### Tag Input Features

**Intelligent Suggestions:**
- Existing tags with fuzzy matching
- Category-based suggestions
- AI-powered semantic suggestions
- Usage frequency ranking

**Visual Feedback:**
- Color-coded tags by category
- Usage count indicators
- Validation warnings and errors

**Keyboard Navigation:**
- Tab/Shift+Tab: Navigate between tags
- Delete/Backspace: Remove last tag
- Escape: Clear input or close suggestions
- Arrow keys: Navigate suggestions

#### Tag Management

**Tag Properties:**
- **Name**: Primary identifier
- **Display Name**: User-friendly label
- **Description**: Optional detailed description
- **Category**: Associated category for organization
- **Color**: Visual indicator
- **System Flag**: Protected system tags

**Bulk Operations:**
```typescript
// Example bulk tag operations
const operations = [
  { operation: 'create', data: { name: 'batch-error', category_id: 'batch' } },
  { operation: 'assign', id: 'tag-123', entry_ids: ['entry-1', 'entry-2'] },
  { operation: 'merge', id: 'old-tag', merge_into_id: 'new-tag' }
];
```

### Search and Filtering

#### Advanced Search

1. **Category Filtering:**
   ```
   category:VSAM         // Entries in VSAM category
   category:JCL/Batch    // Entries in JCL>Batch subcategory
   ```

2. **Tag Filtering:**
   ```
   tag:error-handling    // Entries with specific tag
   tag:s0c7 tag:abend   // Entries with both tags
   ```

3. **Combined Filters:**
   ```
   VSAM status 35 category:VSAM tag:file-error
   ```

#### Search Features

- **Full-Text Search**: Content, titles, and descriptions
- **Fuzzy Matching**: Handles typos and variations
- **Semantic Search**: AI-powered content understanding
- **Real-time Results**: Instant search as you type
- **Search History**: Previous searches saved
- **Export Results**: Save search results to JSON/CSV

## API Documentation

### Category API

#### Create Category
```typescript
POST /api/categories

{
  "name": "Error Handling",
  "slug": "error-handling",
  "description": "Error handling procedures and solutions",
  "parent_id": "jcl-category-id",
  "icon": "⚠️",
  "color": "#ff6b35",
  "sort_order": 10
}

Response:
{
  "id": "category-uuid",
  "name": "Error Handling",
  "slug": "error-handling",
  "level": 1,
  "path": ["JCL", "Error Handling"],
  "entry_count": 0,
  "is_active": true,
  "created_at": "2025-01-14T10:00:00Z"
}
```

#### Update Category
```typescript
PATCH /api/categories/{id}

{
  "name": "Updated Name",
  "parent_id": "new-parent-id",
  "sort_order": 5
}
```

#### Get Category Tree
```typescript
GET /api/categories/tree?include_stats=true&max_depth=3

Response:
{
  "categories": [
    {
      "id": "root-1",
      "name": "JCL",
      "children": [
        {
          "id": "child-1",
          "name": "Job Control",
          "entry_count": 25,
          "children": []
        }
      ],
      "path": ["JCL"],
      "breadcrumbs": []
    }
  ]
}
```

#### Category Analytics
```typescript
GET /api/categories/{id}/analytics

Response:
{
  "category_id": "category-uuid",
  "entry_count": 150,
  "view_count": 2500,
  "search_count": 800,
  "success_rate": 0.85,
  "avg_resolution_time": 300,
  "top_tags": [
    { "tag_id": "tag-1", "tag_name": "error", "count": 45 }
  ],
  "last_updated": "2025-01-14T10:00:00Z"
}
```

### Tag API

#### Create Tag
```typescript
POST /api/tags

{
  "name": "memory-error",
  "display_name": "Memory Error",
  "description": "Issues related to memory allocation",
  "category_id": "system-category-id",
  "color": "#e74c3c",
  "is_suggested": true
}

Response:
{
  "id": "tag-uuid",
  "name": "memory-error",
  "display_name": "Memory Error",
  "usage_count": 0,
  "is_system": false,
  "created_at": "2025-01-14T10:00:00Z"
}
```

#### Search Tags
```typescript
GET /api/tags/search?q=memory&category_id=system&limit=10&fuzzy=true

Response:
{
  "tags": [
    {
      "id": "tag-1",
      "name": "memory-error",
      "display_name": "Memory Error",
      "usage_count": 25,
      "relevance_score": 0.95
    }
  ],
  "total": 1,
  "query_time": 15
}
```

#### Tag Suggestions
```typescript
GET /api/tags/suggestions?q=mem&context_entry_id=entry-123

Response:
{
  "suggestions": [
    {
      "tag": {
        "id": "tag-1",
        "name": "memory-error",
        "display_name": "Memory Error"
      },
      "score": 95,
      "source": "existing",
      "reasoning": "Exact match for frequently used tag"
    }
  ]
}
```

#### Bulk Tag Operations
```typescript
POST /api/tags/bulk

{
  "operation": "assign",
  "tags": [
    {
      "id": "tag-1",
      "entry_ids": ["entry-1", "entry-2", "entry-3"]
    }
  ],
  "options": {
    "relevance_score": 0.8,
    "assigned_by": "user"
  }
}

Response:
{
  "operation": "assign",
  "total_items": 1,
  "successful": 1,
  "failed": 0,
  "errors": [],
  "execution_time": 150,
  "transaction_id": "bulk-uuid"
}
```

### Search API

#### Advanced Search
```typescript
POST /api/search/advanced

{
  "query": "VSAM status 35",
  "filters": {
    "category_ids": ["vsam-category"],
    "tag_ids": ["error-tag", "vsam-tag"],
    "date_range": {
      "from": "2024-01-01",
      "to": "2025-01-14"
    }
  },
  "options": {
    "fuzzy": true,
    "semantic": true,
    "highlight": true
  },
  "pagination": {
    "page": 1,
    "size": 20
  }
}

Response:
{
  "results": [
    {
      "id": "entry-1",
      "title": "VSAM Status Code 35 Resolution",
      "snippet": "Job abends with <mark>VSAM status 35</mark>...",
      "category": { "id": "vsam-cat", "name": "VSAM" },
      "tags": [
        { "id": "tag-1", "name": "vsam", "relevance": 0.9 }
      ],
      "relevance_score": 0.95,
      "match_type": "semantic"
    }
  ],
  "total": 15,
  "page": 1,
  "pages": 1,
  "query_time": 25,
  "filters_applied": {
    "category": 1,
    "tags": 2
  }
}
```

## Developer Documentation

### Extending the Tag System

#### Custom Tag Sources

Create custom tag suggestion sources:

```typescript
import { TagSuggestion, TagSuggestionSource } from '../types/tags';

export class CustomTagSource implements TagSuggestionSource {
  async getSuggestions(
    query: string,
    context: TagSuggestionContext
  ): Promise<TagSuggestion[]> {
    // Implement custom logic
    const suggestions = await this.customLogic(query, context);

    return suggestions.map(suggestion => ({
      tag: suggestion.tag,
      score: suggestion.confidence * 100,
      source: 'custom',
      reasoning: `Custom source: ${suggestion.reason}`
    }));
  }
}

// Register the custom source
TagService.registerSuggestionSource(new CustomTagSource());
```

#### Custom Validators

Add custom validation for tags and categories:

```typescript
import { TagValidator, ValidationResult } from '../types/validation';

export class BusinessRuleValidator implements TagValidator {
  validate(tag: Tag, context: ValidationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Business rule: Tags in 'critical' category must have description
    if (tag.category_id === 'critical' && !tag.description) {
      errors.push('Critical tags must have descriptions');
    }

    // Warning for long tag names
    if (tag.name.length > 30) {
      warnings.push('Tag name is quite long - consider shortening');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    };
  }
}

// Register validator
TagService.addValidator(new BusinessRuleValidator());
```

### Database Schema Extensions

#### Adding Custom Tag Properties

```sql
-- Add custom columns to tags table
ALTER TABLE tags ADD COLUMN custom_field TEXT;
ALTER TABLE tags ADD COLUMN numeric_value REAL;

-- Create custom index
CREATE INDEX idx_tags_custom ON tags(custom_field)
WHERE custom_field IS NOT NULL;

-- Update TypeScript interface
interface Tag {
  // ... existing properties
  custom_field?: string;
  numeric_value?: number;
}
```

#### Custom Analytics Tables

```sql
-- Custom tag analytics
CREATE TABLE custom_tag_analytics (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(tag_id, metric_name, recorded_at)
);

CREATE INDEX idx_custom_analytics_tag ON custom_tag_analytics(tag_id);
CREATE INDEX idx_custom_analytics_metric ON custom_tag_analytics(metric_name);
```

### Component Customization

#### Custom Tag Input Component

```typescript
import { EnhancedTagInput } from '../components/tags/EnhancedTagInput';

export const CustomTagInput: React.FC<CustomTagInputProps> = (props) => {
  const customValidator = useCallback((tags: Tag[]) => {
    // Custom validation logic
    return {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
  }, []);

  const customSuggestions = useCallback(async (query: string) => {
    // Custom suggestion logic
    const suggestions = await fetchCustomSuggestions(query);
    return suggestions;
  }, []);

  return (
    <EnhancedTagInput
      {...props}
      validator={customValidator}
      onSuggestionsRequest={customSuggestions}
      className="custom-tag-input"
    />
  );
};
```

#### Custom Category Tree

```typescript
import { EnhancedCategoryTree } from '../components/categorization/EnhancedCategoryTree';

export const CustomCategoryTree: React.FC<Props> = (props) => {
  const customOperations = useMemo(() => ({
    ...defaultOperations,
    customAction: async (nodeId: string) => {
      // Custom action implementation
      await performCustomAction(nodeId);
    }
  }), []);

  return (
    <EnhancedCategoryTree
      {...props}
      enableContextMenu={true}
      onNodeRightClick={(node, event) => {
        // Show custom context menu
        showCustomContextMenu(node, event);
      }}
    />
  );
};
```

### Performance Optimization

#### Query Optimization

```typescript
// Optimize tag search with prepared statements
export class OptimizedTagRepository extends TagRepository {
  private cachedStatements: Map<string, Database.Statement> = new Map();

  async searchOptimized(query: string, options: SearchOptions): Promise<Tag[]> {
    const cacheKey = `search:${JSON.stringify(options)}`;

    if (!this.cachedStatements.has(cacheKey)) {
      const statement = this.db.prepare(this.buildQuery(options));
      this.cachedStatements.set(cacheKey, statement);
    }

    const statement = this.cachedStatements.get(cacheKey)!;
    return statement.all(query) as Tag[];
  }

  private buildQuery(options: SearchOptions): string {
    // Dynamic query building based on options
    let query = 'SELECT * FROM v_tag_stats WHERE 1=1';

    if (options.categoryId) {
      query += ' AND category_id = ?';
    }

    if (options.excludeIds?.length) {
      query += ` AND id NOT IN (${options.excludeIds.map(() => '?').join(',')})`;
    }

    return query + ' ORDER BY usage_count DESC LIMIT ?';
  }
}
```

#### Caching Strategy

```typescript
// Redis-based caching for tag suggestions
export class CachedTagService extends TagService {
  private redis: Redis;

  async getSuggestions(query: string, options: SuggestionOptions): Promise<TagSuggestion[]> {
    const cacheKey = `suggestions:${query}:${JSON.stringify(options)}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const suggestions = await super.getSuggestions(query, options);

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(suggestions));

    return suggestions;
  }
}
```

## Best Practices

### Category Organization

#### Hierarchical Structure
- **Maximum 5 levels**: Keep hierarchy shallow for usability
- **Balanced distribution**: Avoid categories with too many direct children
- **Logical grouping**: Group related concepts together
- **Clear naming**: Use descriptive, unambiguous names

#### Naming Conventions
```
✅ Good Examples:
- JCL/Job Submission/Error Handling
- VSAM/Key Sequenced/Performance
- DB2/SQL/Query Optimization

❌ Avoid:
- Misc/Other/Stuff (too vague)
- Very Long Category Names That Are Hard To Read
- cat1/subcat/subsubcat (cryptic names)
```

### Tag Management

#### Tag Naming
- **Lowercase**: Use lowercase with hyphens: `error-handling`
- **Descriptive**: Choose specific over generic: `vsam-status-35` vs `error`
- **Consistent**: Follow established patterns in your domain
- **No spaces**: Use hyphens or underscores instead of spaces

#### Tag Categories
```typescript
// Organize tags by functional areas
const tagCategories = {
  'error-types': ['s0c4', 's0c7', 'u0456', 'ief212i'],
  'components': ['vsam', 'db2', 'ims', 'cics', 'jcl'],
  'severity': ['critical', 'high', 'medium', 'low'],
  'resolution': ['restart', 'code-fix', 'config-change', 'data-fix']
};
```

#### Tag Lifecycle
1. **Creation**: Start with specific, descriptive tags
2. **Usage**: Monitor usage patterns and popularity
3. **Maintenance**: Regular cleanup of unused tags
4. **Evolution**: Merge similar tags, split overly broad ones
5. **Retirement**: Archive or merge obsolete tags

### Search Optimization

#### Query Design
```typescript
// Effective search patterns
const searchExamples = {
  specific: 'VSAM status 35 file not found',
  categorized: 'category:VSAM tag:status-code',
  combined: 'DB2 deadlock category:DB2 tag:locking',
  fuzzy: 'batck job abned',  // Will find "batch job abend"
};
```

#### Performance Tips
- **Index usage**: Ensure proper database indexes
- **Query limits**: Use pagination for large result sets
- **Cache results**: Cache frequent searches
- **Async loading**: Load search results progressively

### Data Quality

#### Validation Rules
```typescript
const validationRules = {
  categories: {
    maxDepth: 5,
    maxChildren: 20,
    minNameLength: 2,
    maxNameLength: 50,
    slugPattern: /^[a-z0-9-]+$/
  },
  tags: {
    minNameLength: 2,
    maxNameLength: 30,
    maxTagsPerEntry: 10,
    forbiddenChars: /[<>&"']/,
    normalizeSpaces: true
  }
};
```

#### Cleanup Procedures
```typescript
// Regular maintenance tasks
const maintenanceTasks = {
  daily: [
    'updateTagUsageCounts',
    'refreshSearchIndexes'
  ],
  weekly: [
    'identifyUnusedTags',
    'validateCategoryHierarchy',
    'updateAnalytics'
  ],
  monthly: [
    'archiveOldTags',
    'optimizeDatabaseIndexes',
    'generateUsageReports'
  ]
};
```

## Troubleshooting

### Common Issues

#### Tag Input Not Working

**Problem**: Tag input doesn't show suggestions or accept input

**Symptoms**:
- No dropdown appears when typing
- Tags don't get added when pressing Enter
- Input field is disabled

**Solutions**:
1. **Check Props**: Ensure required props are provided
   ```typescript
   <EnhancedTagInput
     value={tags}              // ✅ Required
     onChange={handleChange}   // ✅ Required
     // ... other props
   />
   ```

2. **Verify Data Format**: Tags must match expected interface
   ```typescript
   interface Tag {
     id: string;
     name: string;
     // ... other required fields
   }
   ```

3. **Check Network**: If using API suggestions, verify network connectivity
   ```typescript
   // Enable debug logging
   <EnhancedTagInput
     onSuggestionsRequest={async (query) => {
       console.log('Fetching suggestions for:', query);
       const result = await api.getSuggestions(query);
       console.log('Suggestions received:', result);
       return result;
     }}
   />
   ```

#### Category Tree Display Issues

**Problem**: Categories not displaying correctly or missing

**Symptoms**:
- Empty category tree
- Categories appear in wrong hierarchy
- Drag-and-drop not working

**Solutions**:
1. **Data Structure**: Verify category data structure
   ```typescript
   // Categories must have proper parent-child relationships
   const categories = [
     { id: '1', name: 'Root', parent_id: null },
     { id: '2', name: 'Child', parent_id: '1' }
   ];
   ```

2. **Permissions**: Check user permissions for category operations
   ```typescript
   // Verify CRUD permissions
   const permissions = await checkUserPermissions(userId);
   console.log('User can:', permissions);
   ```

3. **Virtual Scrolling**: Disable if causing issues with small datasets
   ```typescript
   <EnhancedCategoryTree
     enableVirtualScrolling={categories.length > 100}
   />
   ```

#### Search Performance Problems

**Problem**: Search is slow or times out

**Symptoms**:
- Long delay before results appear
- Browser freezes during search
- Memory usage increases significantly

**Solutions**:
1. **Database Optimization**: Check indexes
   ```sql
   -- Verify search indexes exist
   .schema tags_fts
   PRAGMA index_info(idx_tags_name);
   PRAGMA index_info(idx_tags_category);
   ```

2. **Query Optimization**: Limit result size
   ```typescript
   const searchOptions = {
     limit: 20,           // Limit results
     timeout: 5000,       // Set timeout
     fuzzy: false         // Disable if not needed
   };
   ```

3. **Debounce Input**: Reduce search frequency
   ```typescript
   const debouncedSearch = useDebouncedCallback(
     (query: string) => performSearch(query),
     300  // Wait 300ms after user stops typing
   );
   ```

### Database Issues

#### Corruption Recovery

**Problem**: Database corruption or inconsistencies

**Symptoms**:
- Foreign key constraint failures
- Orphaned tags or categories
- Invalid hierarchy structures

**Recovery Steps**:
1. **Backup First**: Always backup before repairs
   ```bash
   cp knowledge.db knowledge.db.backup
   ```

2. **Check Integrity**: Use SQLite integrity check
   ```sql
   PRAGMA integrity_check;
   PRAGMA foreign_key_check;
   ```

3. **Clean Orphaned Records**:
   ```sql
   -- Remove orphaned tag associations
   DELETE FROM tag_associations
   WHERE tag_id NOT IN (SELECT id FROM tags);

   -- Remove orphaned categories
   UPDATE categories SET parent_id = NULL
   WHERE parent_id NOT IN (SELECT id FROM categories);
   ```

4. **Rebuild Indexes**:
   ```sql
   REINDEX;
   INSERT INTO tags_fts(tags_fts) VALUES('rebuild');
   ```

#### Migration Issues

**Problem**: Schema changes cause application errors

**Solutions**:
1. **Version Check**: Verify schema version
   ```sql
   PRAGMA user_version;
   ```

2. **Step-by-step Migration**: Run migrations incrementally
   ```typescript
   const migrations = [
     'ALTER TABLE tags ADD COLUMN new_field TEXT;',
     'UPDATE tags SET new_field = "default" WHERE new_field IS NULL;',
     'CREATE INDEX idx_tags_new_field ON tags(new_field);'
   ];

   for (const migration of migrations) {
     try {
       db.exec(migration);
       console.log('✅ Migration executed:', migration);
     } catch (error) {
       console.error('❌ Migration failed:', migration, error);
       // Handle rollback
     }
   }
   ```

### Performance Monitoring

#### Metrics Collection

```typescript
// Monitor tag operations
export class TagMetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  recordOperation(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  getStats(operation: string): OperationStats {
    const times = this.metrics.get(operation) || [];
    return {
      count: times.length,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      p95: this.percentile(times, 0.95)
    };
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}

// Usage
const metrics = new TagMetricsCollector();

// Wrap operations with timing
async function timedTagSearch(query: string): Promise<Tag[]> {
  const start = Date.now();
  const result = await tagService.search(query);
  const duration = Date.now() - start;

  metrics.recordOperation('search', duration);

  if (duration > 1000) {
    console.warn(`Slow search detected: ${duration}ms for query: ${query}`);
  }

  return result;
}
```

## Migration Guide

### Upgrading from v1.0 to v2.0

#### Schema Changes

The v2.0 release introduces several schema improvements:

1. **Enhanced Tag Properties**:
   ```sql
   -- v1.0 schema
   CREATE TABLE tags (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );

   -- v2.0 schema (additions)
   ALTER TABLE tags ADD COLUMN display_name TEXT;
   ALTER TABLE tags ADD COLUMN description TEXT;
   ALTER TABLE tags ADD COLUMN category_id TEXT;
   ALTER TABLE tags ADD COLUMN color TEXT;
   ALTER TABLE tags ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
   ALTER TABLE tags ADD COLUMN is_suggested BOOLEAN DEFAULT FALSE;
   ```

2. **Category Hierarchy**:
   ```sql
   -- New hierarchical category support
   CREATE TABLE categories (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     slug TEXT UNIQUE NOT NULL,
     description TEXT,
     parent_id TEXT REFERENCES categories(id),
     level INTEGER DEFAULT 0,
     sort_order INTEGER DEFAULT 0,
     -- ... additional fields
   );
   ```

#### Data Migration Script

```typescript
export class MigrationV1ToV2 {
  async migrate(db: Database): Promise<void> {
    console.log('Starting v1.0 to v2.0 migration...');

    const transaction = db.transaction(() => {
      // 1. Migrate existing tags
      this.migrateTags(db);

      // 2. Create default categories
      this.createDefaultCategories(db);

      // 3. Associate tags with categories
      this.associateTagsWithCategories(db);

      // 4. Update schema version
      db.pragma('user_version = 2');
    });

    transaction();
    console.log('Migration completed successfully');
  }

  private migrateTags(db: Database): void {
    // Add display_name based on name
    db.exec(`
      UPDATE tags
      SET display_name = CASE
        WHEN name LIKE '%-%' THEN
          REPLACE(REPLACE(UPPER(SUBSTR(name, 1, 1)) || SUBSTR(name, 2), '-', ' '), '_', ' ')
        ELSE
          UPPER(SUBSTR(name, 1, 1)) || SUBSTR(name, 2)
      END
      WHERE display_name IS NULL;
    `);

    // Set system flag for predefined tags
    const systemTags = ['error', 'critical', 'high', 'medium', 'low'];
    const placeholders = systemTags.map(() => '?').join(',');
    db.prepare(`
      UPDATE tags SET is_system = TRUE
      WHERE name IN (${placeholders})
    `).run(...systemTags);
  }

  private createDefaultCategories(db: Database): void {
    const defaultCategories = [
      { id: uuidv4(), name: 'JCL', slug: 'jcl', description: 'Job Control Language' },
      { id: uuidv4(), name: 'VSAM', slug: 'vsam', description: 'Virtual Storage Access Method' },
      { id: uuidv4(), name: 'DB2', slug: 'db2', description: 'Database Management' },
      { id: uuidv4(), name: 'Batch', slug: 'batch', description: 'Batch Processing' },
      { id: uuidv4(), name: 'System', slug: 'system', description: 'System-related' }
    ];

    const insertCategory = db.prepare(`
      INSERT INTO categories (id, name, slug, description, level, is_system)
      VALUES (?, ?, ?, ?, 0, TRUE)
    `);

    defaultCategories.forEach(cat => {
      insertCategory.run(cat.id, cat.name, cat.slug, cat.description);
    });
  }

  private associateTagsWithCategories(db: Database): void {
    // Auto-assign tags to categories based on patterns
    const categoryMappings = [
      { pattern: /jcl|job|step|dd|dsn/i, category: 'jcl' },
      { pattern: /vsam|ksds|esds|cluster/i, category: 'vsam' },
      { pattern: /db2|sql|table|index/i, category: 'db2' },
      { pattern: /batch|abend|s0c|u\d+/i, category: 'batch' }
    ];

    categoryMappings.forEach(({ pattern, category }) => {
      db.exec(`
        UPDATE tags
        SET category_id = (SELECT id FROM categories WHERE slug = '${category}')
        WHERE (name REGEXP '${pattern.source}' OR description REGEXP '${pattern.source}')
        AND category_id IS NULL
      `);
    });

    // Remaining tags go to 'system' category
    db.exec(`
      UPDATE tags
      SET category_id = (SELECT id FROM categories WHERE slug = 'system')
      WHERE category_id IS NULL
    `);
  }
}
```

#### Code Changes

Update your application code:

1. **Tag Interface Updates**:
   ```typescript
   // Old v1.0 interface
   interface TagV1 {
     id: string;
     name: string;
     created_at: Date;
   }

   // New v2.0 interface
   interface Tag {
     id: string;
     name: string;
     display_name?: string;  // New
     description?: string;   // New
     category_id?: string;   // New
     color?: string;         // New
     is_system: boolean;     // New
     is_suggested: boolean;  // New
     usage_count: number;    // New
     created_at: Date;
     updated_at: Date;       // New
   }
   ```

2. **Component Updates**:
   ```typescript
   // Old usage
   <TagInput
     tags={tags}
     onChange={setTags}
   />

   // New usage with enhanced features
   <EnhancedTagInput
     value={tags}
     onChange={setTags}
     categories={categories}           // New
     enableAIsuggestions={true}       // New
     showSuggestionDetails={true}     // New
     validator={customValidator}      // New
   />
   ```

3. **API Changes**:
   ```typescript
   // Old API calls
   const tags = await api.searchTags(query);

   // New API with enhanced options
   const tags = await api.searchTags(query, {
     categoryId: selectedCategory,
     fuzzy: true,
     limit: 20,
     excludeIds: currentTags.map(t => t.id)
   });
   ```

### Rolling Back Changes

If you need to rollback to v1.0:

1. **Database Rollback**:
   ```sql
   -- Remove v2.0 columns (data will be lost)
   CREATE TABLE tags_v1 AS
   SELECT id, name, created_at FROM tags;

   DROP TABLE tags;
   ALTER TABLE tags_v1 RENAME TO tags;

   -- Drop v2.0 tables
   DROP TABLE categories;
   DROP TABLE category_analytics;
   DROP TABLE tag_analytics;
   ```

2. **Code Rollback**: Revert to v1.0 component versions and API calls.

---

This documentation provides comprehensive coverage of the categorization and tagging system. For additional support, please refer to the API documentation or contact the development team.