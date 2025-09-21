# Tagging and Categorization Best Practices

## Table of Contents
- [Tag Management Strategy](#tag-management-strategy)
- [Naming Conventions](#naming-conventions)
- [Category Organization](#category-organization)
- [Content Tagging Guidelines](#content-tagging-guidelines)
- [Data Quality Management](#data-quality-management)
- [Performance Optimization](#performance-optimization)
- [Maintenance and Cleanup](#maintenance-and-cleanup)
- [Team Collaboration](#team-collaboration)
- [Analytics and Monitoring](#analytics-and-monitoring)

## Tag Management Strategy

### Establishing a Tagging Philosophy

A successful tagging system requires a clear philosophy that balances flexibility with consistency. Here's our recommended approach:

#### Core Principles

1. **Descriptive Over Generic**: Use specific, descriptive tags rather than broad, generic ones
   ```
   ✅ Good: "vsam-status-35", "jcl-syntax-error", "db2-deadlock"
   ❌ Avoid: "error", "problem", "issue"
   ```

2. **User Intent Focus**: Tags should reflect how users think about and search for content
   ```
   ✅ Good: "batch-job-failure", "memory-shortage"
   ❌ Avoid: "sys-abend-0c4", "storage-violation"
   ```

3. **Consistent Granularity**: Maintain similar levels of detail across related tags
   ```
   ✅ Consistent: "cobol-compile-error", "cobol-runtime-error", "cobol-syntax-error"
   ❌ Mixed: "cobol", "specific-jcl-dd-statement-error"
   ```

4. **Future-Proof Structure**: Create tags that will remain relevant as the system grows
   ```
   ✅ Scalable: "error-handling", "performance-tuning"
   ❌ Rigid: "2024-issues", "temp-fix"
   ```

#### Tag Lifecycle Management

```typescript
interface TagLifecycle {
  creation: {
    validation: string[];
    approval?: boolean;
    documentation?: string;
  };
  usage: {
    monitoring: boolean;
    analytics: boolean;
    feedback: boolean;
  };
  maintenance: {
    review_frequency: string;
    cleanup_criteria: string[];
    merge_strategy: string;
  };
  retirement: {
    deprecation_process: string;
    migration_path: string;
    archive_strategy: string;
  };
}

// Example implementation
const tagLifecycleConfig: TagLifecycle = {
  creation: {
    validation: ['naming-convention', 'uniqueness-check', 'business-relevance'],
    approval: true, // Require approval for new tags
    documentation: 'All new tags must include description and usage examples'
  },
  usage: {
    monitoring: true,
    analytics: true,
    feedback: true
  },
  maintenance: {
    review_frequency: 'monthly',
    cleanup_criteria: ['unused-90-days', 'duplicate-detection', 'relevance-score'],
    merge_strategy: 'user-guided'
  },
  retirement: {
    deprecation_process: 'gradual-with-notification',
    migration_path: 'suggest-alternatives',
    archive_strategy: 'retain-for-historical-analysis'
  }
};
```

### Tag Governance Framework

#### Approval Workflow

```typescript
interface TagApprovalWorkflow {
  trigger: 'new-tag-request' | 'tag-modification';
  approvers: {
    primary: string[];
    escalation: string[];
  };
  criteria: {
    naming_compliance: boolean;
    business_value: boolean;
    uniqueness: boolean;
    documentation: boolean;
  };
  timeline: {
    initial_review: string;
    decision_deadline: string;
    appeal_window: string;
  };
}

export class TagGovernanceManager {
  async requestTagApproval(tagRequest: TagRequest): Promise<ApprovalResult> {
    // Automated checks first
    const autoChecks = await this.runAutomatedChecks(tagRequest);
    if (!autoChecks.passed) {
      return {
        status: 'rejected',
        reason: 'automated-checks-failed',
        details: autoChecks.failures
      };
    }

    // Route to appropriate approvers
    const approvers = await this.getApprovers(tagRequest);
    const approvalRequest = {
      id: uuidv4(),
      tag: tagRequest.tag,
      requestedBy: tagRequest.userId,
      approvers: approvers,
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      status: 'pending'
    };

    // Send notifications
    await this.notifyApprovers(approvalRequest);

    return {
      status: 'pending-approval',
      approvalId: approvalRequest.id,
      estimatedDecision: approvalRequest.deadline
    };
  }

  private async runAutomatedChecks(request: TagRequest): Promise<ValidationResult> {
    const checks = [
      () => this.validateNamingConvention(request.tag.name),
      () => this.checkUniqueness(request.tag.name),
      () => this.validateBusinessRelevance(request.tag),
      () => this.checkDocumentation(request.tag.description)
    ];

    const results = await Promise.all(checks.map(check => check()));
    const failures = results.filter(r => !r.passed);

    return {
      passed: failures.length === 0,
      failures: failures.map(f => f.message)
    };
  }
}
```

## Naming Conventions

### Standard Naming Pattern

#### Format: `{domain}-{type}-{specific}`

Examples:
- `vsam-error-status35`
- `jcl-syntax-missing-dd`
- `db2-performance-index`
- `cobol-compile-warning`

#### Detailed Rules

1. **Use lowercase with hyphens**: `memory-error` not `Memory_Error` or `memoryError`

2. **Domain prefixes for mainframe components**:
   - `vsam-` for VSAM-related issues
   - `jcl-` for Job Control Language
   - `db2-` for DB2 database issues
   - `ims-` for IMS database
   - `cics-` for CICS transaction processing
   - `cobol-` for COBOL programming
   - `batch-` for batch processing
   - `tso-` for Time Sharing Option

3. **Type indicators**:
   - `error-` for error conditions
   - `warning-` for warnings
   - `config-` for configuration
   - `performance-` for performance issues
   - `security-` for security concerns
   - `procedure-` for procedures
   - `utility-` for utility programs

4. **Specific descriptors**: Use clear, unambiguous terms
   ```
   ✅ Good specificity:
   - "s0c4-protection-exception"
   - "vsam-ksds-split-error"
   - "db2-deadlock-timeout"

   ❌ Too vague:
   - "system-problem"
   - "data-issue"
   - "job-failed"
   ```

#### Reserved Patterns

Certain patterns are reserved for system use:

```typescript
const RESERVED_PREFIXES = [
  'sys-',     // System-generated tags
  'auto-',    // Automatically assigned tags
  'ai-',      // AI-generated tags
  'temp-',    // Temporary tags
  'admin-',   // Administrative tags
  'test-'     // Testing tags
];

const RESERVED_SUFFIXES = [
  '-internal', // Internal use only
  '-deprecated', // Deprecated tags
  '-archive',  // Archived content
  '-draft'     // Draft content
];
```

### Domain-Specific Conventions

#### Error Codes and Status

```typescript
const ERROR_TAG_PATTERNS = {
  // System abend codes
  abend: /^(s0c[0-9a-f]|u[0-9]{4})-/i,

  // VSAM return codes
  vsam: /^vsam-(status-[0-9]+|return-[0-9]+)/i,

  // DB2 SQL codes
  db2: /^db2-(sqlcode-[-]?[0-9]+|sqlstate-[0-9a-z]{5})/i,

  // JCL message codes
  jcl: /^jcl-(ief[0-9]{3}[a-z]|iea[0-9]{3}[a-z])/i
};

// Validation function
function validateErrorTag(tagName: string): boolean {
  return Object.values(ERROR_TAG_PATTERNS).some(pattern =>
    pattern.test(tagName)
  );
}
```

#### Component-Specific Tags

```typescript
const COMPONENT_HIERARCHIES = {
  vsam: {
    types: ['ksds', 'esds', 'rrds', 'linear'],
    operations: ['read', 'write', 'update', 'delete', 'browse'],
    issues: ['status-code', 'performance', 'space', 'integrity']
  },

  db2: {
    objects: ['table', 'index', 'view', 'procedure', 'function'],
    operations: ['select', 'insert', 'update', 'delete', 'grant'],
    issues: ['deadlock', 'timeout', 'space', 'performance', 'authority']
  },

  jcl: {
    statements: ['job', 'exec', 'dd', 'output', 'jcllib'],
    procedures: ['proc', 'include', 'set'],
    issues: ['syntax', 'allocation', 'condition-code', 'abend']
  }
};
```

## Category Organization

### Hierarchical Structure Design

#### Recommended Depth: Maximum 4 levels

```
Level 1: Major Component Areas
└── Level 2: Functional Categories
    └── Level 3: Specific Areas
        └── Level 4: Detailed Subcategories
```

#### Example Hierarchy

```
Mainframe Systems
├── Data Management
│   ├── VSAM
│   │   ├── Key Sequenced (KSDS)
│   │   ├── Entry Sequenced (ESDS)
│   │   ├── Relative Record (RRDS)
│   │   └── Linear (LDS)
│   ├── DB2
│   │   ├── SQL Operations
│   │   ├── Database Administration
│   │   ├── Performance Tuning
│   │   └── Utilities
│   └── IMS
│       ├── Database
│       ├── Transaction Manager
│       └── Utilities
├── Job Processing
│   ├── JCL (Job Control Language)
│   │   ├── Job Statements
│   │   ├── DD Statements
│   │   ├── Procedures
│   │   └── Utilities
│   ├── Batch Processing
│   │   ├── Job Scheduling
│   │   ├── Resource Management
│   │   └── Error Handling
│   └── TSO/ISPF
│       ├── Commands
│       ├── Panels
│       └── Edit Macros
└── Programming
    ├── COBOL
    │   ├── Language Features
    │   ├── Compile Options
    │   ├── Runtime Issues
    │   └── Performance
    ├── Assembler
    │   ├── Instructions
    │   ├── Macros
    │   └── System Services
    └── PL/I
        ├── Language Features
        ├── Built-in Functions
        └── Error Handling
```

### Category Balance Guidelines

#### Avoid Over-categorization

```typescript
interface CategoryBalanceMetrics {
  entries_per_category: {
    ideal_range: [number, number];  // [5, 50]
    warning_threshold: number;      // 75
    critical_threshold: number;     // 100
  };

  children_per_parent: {
    ideal_range: [number, number];  // [3, 12]
    warning_threshold: number;      // 15
    critical_threshold: number;     // 20
  };

  hierarchy_depth: {
    maximum_depth: number;          // 4
    recommended_depth: number;      // 3
  };
}

export class CategoryBalanceMonitor {
  async analyzeBalance(): Promise<BalanceReport> {
    const categories = await CategoryRepository.getHierarchy();
    const issues: BalanceIssue[] = [];

    for (const category of categories) {
      // Check entry distribution
      if (category.entry_count > 100) {
        issues.push({
          type: 'overcrowded_category',
          categoryId: category.id,
          categoryName: category.name,
          currentValue: category.entry_count,
          recommendation: 'Consider creating subcategories or splitting content'
        });
      }

      // Check child distribution
      if (category.child_count > 15) {
        issues.push({
          type: 'too_many_children',
          categoryId: category.id,
          categoryName: category.name,
          currentValue: category.child_count,
          recommendation: 'Group related subcategories or create intermediate levels'
        });
      }

      // Check depth
      if (category.level > 4) {
        issues.push({
          type: 'excessive_depth',
          categoryId: category.id,
          categoryName: category.name,
          currentValue: category.level,
          recommendation: 'Flatten hierarchy by consolidating intermediate levels'
        });
      }
    }

    return {
      totalCategories: categories.length,
      averageDepth: categories.reduce((sum, cat) => sum + cat.level, 0) / categories.length,
      issues,
      healthScore: this.calculateHealthScore(categories, issues)
    };
  }
}
```

## Content Tagging Guidelines

### How Many Tags Per Entry?

#### Recommended Range: 3-8 tags per entry

```typescript
const TAGGING_GUIDELINES = {
  recommended: {
    minimum: 3,     // Minimum for good findability
    optimal: 5,     // Sweet spot for most content
    maximum: 8      // Upper limit to avoid tag spam
  },

  quality_over_quantity: true,

  tag_types: {
    required: {
      domain: 1,      // e.g., "vsam", "jcl", "db2"
      type: 1,        // e.g., "error", "procedure", "configuration"
      specific: 1     // e.g., "status-35", "syntax-check", "deadlock"
    },

    optional: {
      severity: 1,    // e.g., "critical", "minor"
      component: 2,   // e.g., "batch", "online"
      context: 2      // e.g., "troubleshooting", "best-practice"
    }
  }
};
```

### Tag Assignment Strategy

#### Primary Tags (Required)

Every knowledge base entry should have these tag types:

1. **Domain Tag**: Identifies the mainframe component
   - Examples: `vsam`, `jcl`, `db2`, `cobol`, `cics`

2. **Type Tag**: Identifies the nature of the content
   - Examples: `error-resolution`, `procedure`, `configuration`, `troubleshooting`

3. **Specific Tag**: The most specific identifier
   - Examples: `status-35`, `s0c4-abend`, `compile-error`

#### Secondary Tags (Contextual)

Add these for enhanced discoverability:

1. **Severity Tags**:
   - `critical`, `high`, `medium`, `low`

2. **Audience Tags**:
   - `developer`, `operator`, `administrator`, `end-user`

3. **Solution Type Tags**:
   - `quick-fix`, `workaround`, `permanent-solution`, `investigation-steps`

4. **Related System Tags**:
   - `z-os`, `mvs`, `vse`, `vm`, `linux-on-z`

#### Example Tag Assignment

```typescript
interface TaggedKBEntry {
  title: string;
  tags: {
    primary: string[];     // Required tags
    secondary: string[];   // Contextual tags
    generated: string[];   // AI-generated tags
  };
}

// Example 1: VSAM Error Entry
const vsamErrorEntry: TaggedKBEntry = {
  title: "VSAM Status Code 35 - File Not Found Resolution",
  tags: {
    primary: [
      "vsam",              // Domain
      "error-resolution",  // Type
      "status-35"          // Specific
    ],
    secondary: [
      "file-not-found",    // Additional context
      "catalog-issue",     // Related problem
      "critical"           // Severity
    ],
    generated: [
      "data-access",       // AI-generated
      "system-catalog"     // AI-generated
    ]
  }
};

// Example 2: JCL Procedure Entry
const jclProcedureEntry: TaggedKBEntry = {
  title: "Creating Reusable JCL Procedures",
  tags: {
    primary: [
      "jcl",               // Domain
      "procedure",         // Type
      "proc-creation"      // Specific
    ],
    secondary: [
      "best-practice",     // Context
      "reusability",       // Concept
      "developer"          // Audience
    ],
    generated: [
      "code-organization", // AI-generated
      "maintenance"        // AI-generated
    ]
  }
};
```

### AI-Assisted Tagging

#### Leveraging AI for Tag Suggestions

```typescript
export class AITaggingAssistant {
  async suggestTags(content: KBEntryContent): Promise<TagSuggestion[]> {
    const suggestions: TagSuggestion[] = [];

    // Extract domain from content
    const domainSuggestions = await this.identifyDomain(content);
    suggestions.push(...domainSuggestions);

    // Classify content type
    const typeSuggestions = await this.classifyContentType(content);
    suggestions.push(...typeSuggestions);

    // Extract specific technical terms
    const technicalSuggestions = await this.extractTechnicalTerms(content);
    suggestions.push(...technicalSuggestions);

    // Analyze sentiment/severity
    const severitySuggestions = await this.analyzeSeverity(content);
    suggestions.push(...severitySuggestions);

    // Find similar content for contextual tags
    const contextualSuggestions = await this.findContextualTags(content);
    suggestions.push(...contextualSuggestions);

    return this.rankAndFilterSuggestions(suggestions);
  }

  private async identifyDomain(content: KBEntryContent): Promise<TagSuggestion[]> {
    const domainPatterns = {
      vsam: /\b(vsam|ksds|esds|rrds|cluster|aic|define)\b/i,
      jcl: /\b(jcl|job|exec|dd|proc|include|set)\b/i,
      db2: /\b(db2|sql|table|index|bind|runstats)\b/i,
      cobol: /\b(cobol|cbl|identification|procedure|division)\b/i,
      cics: /\b(cics|transaction|abend|commarea|eib)\b/i
    };

    const suggestions: TagSuggestion[] = [];
    const text = `${content.title} ${content.description} ${content.solution}`;

    for (const [domain, pattern] of Object.entries(domainPatterns)) {
      if (pattern.test(text)) {
        const matches = text.match(pattern) || [];
        suggestions.push({
          tag: {
            name: domain,
            display_name: domain.toUpperCase(),
            category_id: 'domain'
          },
          score: Math.min(95, matches.length * 20 + 60),
          source: 'pattern-matching',
          reasoning: `Detected ${domain.toUpperCase()} keywords: ${matches.join(', ')}`
        });
      }
    }

    return suggestions;
  }

  private async extractTechnicalTerms(content: KBEntryContent): Promise<TagSuggestion[]> {
    // Use NLP to extract technical terms
    const text = `${content.title} ${content.description} ${content.solution}`;

    // Common mainframe technical patterns
    const technicalPatterns = [
      { pattern: /\b[SU][0-9][A-F0-9]{2}\b/g, type: 'abend-code' },
      { pattern: /\bSTATUS\s+\d{1,3}\b/gi, type: 'status-code' },
      { pattern: /\bSQLCODE\s*[-]?\d+\b/gi, type: 'sql-error' },
      { pattern: /\bIE[A-Z]\d{3}[A-Z]\b/g, type: 'message-code' },
      { pattern: /\bDSN8[A-Z]\d{3}[A-Z]\b/g, type: 'db2-message' }
    ];

    const suggestions: TagSuggestion[] = [];

    for (const { pattern, type } of technicalPatterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        const normalizedTag = this.normalizeTagName(match);
        suggestions.push({
          tag: {
            name: normalizedTag,
            display_name: match,
            category_id: type
          },
          score: 85,
          source: 'technical-extraction',
          reasoning: `Extracted technical term: ${match}`
        });
      }
    }

    return suggestions;
  }

  private rankAndFilterSuggestions(suggestions: TagSuggestion[]): TagSuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = suggestions.reduce((acc, current) => {
      const existing = acc.find(s => s.tag.name === current.tag.name);
      if (!existing || current.score > existing.score) {
        acc = acc.filter(s => s.tag.name !== current.tag.name);
        acc.push(current);
      }
      return acc;
    }, [] as TagSuggestion[]);

    // Sort by score
    return uniqueSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 15); // Limit to top 15 suggestions
  }
}
```

## Data Quality Management

### Quality Metrics

#### Tag Quality Indicators

```typescript
interface TagQualityMetrics {
  completeness: {
    entries_with_min_tags: number;
    entries_with_primary_tags: number;
    untagged_entries: number;
  };

  consistency: {
    naming_compliance_rate: number;
    duplicate_tags_count: number;
    similar_tags_needing_merge: number;
  };

  relevance: {
    average_tag_relevance_score: number;
    unused_tags_count: number;
    overly_generic_tags: number;
  };

  effectiveness: {
    search_success_rate: number;
    user_satisfaction_score: number;
    tag_click_through_rate: number;
  };
}

export class TagQualityAnalyzer {
  async generateQualityReport(): Promise<TagQualityReport> {
    const metrics = await this.collectQualityMetrics();

    return {
      overall_score: this.calculateOverallScore(metrics),
      metrics,
      recommendations: await this.generateRecommendations(metrics),
      action_items: await this.generateActionItems(metrics)
    };
  }

  private async collectQualityMetrics(): Promise<TagQualityMetrics> {
    const [
      completenessData,
      consistencyData,
      relevanceData,
      effectivenessData
    ] = await Promise.all([
      this.analyzeCompleteness(),
      this.analyzeConsistency(),
      this.analyzeRelevance(),
      this.analyzeEffectiveness()
    ]);

    return {
      completeness: completenessData,
      consistency: consistencyData,
      relevance: relevanceData,
      effectiveness: effectivenessData
    };
  }

  private async analyzeCompleteness(): Promise<any> {
    const totalEntries = await KBEntryRepository.count();

    const entriesWithMinTags = await this.db.prepare(`
      SELECT COUNT(DISTINCT entry_id) as count
      FROM tag_associations ta
      GROUP BY entry_id
      HAVING COUNT(ta.tag_id) >= 3
    `).get();

    const entriesWithPrimaryTags = await this.db.prepare(`
      SELECT COUNT(DISTINCT ta.entry_id) as count
      FROM tag_associations ta
      JOIN tags t ON ta.tag_id = t.id
      WHERE t.category_id IN ('domain', 'type', 'specific')
      GROUP BY ta.entry_id
      HAVING COUNT(DISTINCT t.category_id) = 3
    `).get();

    return {
      entries_with_min_tags: entriesWithMinTags.count,
      entries_with_primary_tags: entriesWithPrimaryTags.count,
      untagged_entries: totalEntries - entriesWithMinTags.count
    };
  }

  private async generateRecommendations(metrics: TagQualityMetrics): Promise<string[]> {
    const recommendations: string[] = [];

    if (metrics.completeness.untagged_entries > totalEntries * 0.1) {
      recommendations.push(
        `${metrics.completeness.untagged_entries} entries lack sufficient tags. ` +
        'Consider running an AI tagging batch process.'
      );
    }

    if (metrics.consistency.duplicate_tags_count > 10) {
      recommendations.push(
        `${metrics.consistency.duplicate_tags_count} duplicate tags detected. ` +
        'Schedule a tag cleanup and merging session.'
      );
    }

    if (metrics.relevance.unused_tags_count > 50) {
      recommendations.push(
        `${metrics.relevance.unused_tags_count} tags haven't been used recently. ` +
        'Consider archiving or removing unused tags.'
      );
    }

    return recommendations;
  }
}
```

### Data Cleanup Procedures

#### Duplicate Detection and Merging

```typescript
export class TagCleanupManager {
  async detectDuplicates(): Promise<DuplicateGroup[]> {
    const allTags = await TagRepository.findAll();
    const duplicateGroups: DuplicateGroup[] = [];

    // Group similar tags
    const processed = new Set<string>();

    for (const tag of allTags) {
      if (processed.has(tag.id)) continue;

      const similarTags = allTags.filter(otherTag =>
        otherTag.id !== tag.id &&
        !processed.has(otherTag.id) &&
        this.calculateSimilarity(tag.name, otherTag.name) > 0.8
      );

      if (similarTags.length > 0) {
        const group: DuplicateGroup = {
          id: uuidv4(),
          tags: [tag, ...similarTags],
          suggestedMerge: this.suggestPrimaryTag([tag, ...similarTags]),
          similarityScore: Math.min(...similarTags.map(t =>
            this.calculateSimilarity(tag.name, t.name)
          ))
        };

        duplicateGroups.push(group);

        // Mark all tags in group as processed
        [tag, ...similarTags].forEach(t => processed.add(t.id));
      }
    }

    return duplicateGroups;
  }

  private suggestPrimaryTag(tags: Tag[]): Tag {
    // Prefer tag with:
    // 1. Most usage
    // 2. Better naming convention compliance
    // 3. More recent activity

    return tags.reduce((primary, current) => {
      const primaryScore = this.calculateTagScore(primary);
      const currentScore = this.calculateTagScore(current);

      return currentScore > primaryScore ? current : primary;
    });
  }

  async mergeTags(primaryTagId: string, tagsToMerge: string[]): Promise<MergeResult> {
    const transaction = this.db.transaction(() => {
      // Move all associations to primary tag
      const moveAssociations = this.db.prepare(`
        UPDATE tag_associations
        SET tag_id = ?
        WHERE tag_id IN (${tagsToMerge.map(() => '?').join(',')})
      `);

      moveAssociations.run(primaryTagId, ...tagsToMerge);

      // Update usage count
      const updateUsage = this.db.prepare(`
        UPDATE tags
        SET usage_count = (
          SELECT COUNT(*)
          FROM tag_associations
          WHERE tag_id = ?
        )
        WHERE id = ?
      `);

      updateUsage.run(primaryTagId, primaryTagId);

      // Archive merged tags
      const archiveTags = this.db.prepare(`
        UPDATE tags
        SET is_active = FALSE,
            archived_at = CURRENT_TIMESTAMP,
            merged_into = ?
        WHERE id IN (${tagsToMerge.map(() => '?').join(',')})
      `);

      archiveTags.run(primaryTagId, ...tagsToMerge);
    });

    transaction();

    return {
      primaryTagId,
      mergedTagIds: tagsToMerge,
      associationsTransferred: await this.getAssociationCount(primaryTagId),
      completedAt: new Date()
    };
  }
}
```

## Performance Optimization

### Indexing Strategy

#### Database Indexes for Tag Performance

```sql
-- Core tag search indexes
CREATE INDEX IF NOT EXISTS idx_tags_name_active
ON tags(name) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tags_category_usage
ON tags(category_id, usage_count DESC) WHERE is_active = TRUE;

-- Tag association indexes
CREATE INDEX IF NOT EXISTS idx_tag_associations_entry
ON tag_associations(entry_id);

CREATE INDEX IF NOT EXISTS idx_tag_associations_tag
ON tag_associations(tag_id);

CREATE INDEX IF NOT EXISTS idx_tag_associations_relevance
ON tag_associations(relevance_score DESC, created_at DESC);

-- Full-text search optimization
CREATE INDEX IF NOT EXISTS idx_tags_fts_rank
ON tags_fts(rank) WHERE tags_fts MATCH '*';

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_tags_trending
ON tags(created_at DESC, usage_count DESC)
WHERE created_at > datetime('now', '-30 days');

-- Category hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent_sort
ON categories(parent_id, sort_order) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_categories_level_name
ON categories(level, name) WHERE is_active = TRUE;
```

#### Query Optimization

```typescript
export class OptimizedTagQuery {
  // Use prepared statements for frequent queries
  private preparedQueries = new Map<string, any>();

  constructor(private db: Database) {
    this.initializePreparedQueries();
  }

  private initializePreparedQueries() {
    // Most common search query
    this.preparedQueries.set('tagSearch', this.db.prepare(`
      SELECT
        t.id,
        t.name,
        t.display_name,
        t.usage_count,
        bm25(tags_fts) as relevance
      FROM tags_fts fts
      JOIN tags t ON t.id = fts.id
      WHERE tags_fts MATCH ?
        AND t.is_active = TRUE
      ORDER BY relevance DESC, t.usage_count DESC
      LIMIT ?
    `));

    // Tag suggestions with context
    this.preparedQueries.set('contextualSuggestions', this.db.prepare(`
      SELECT DISTINCT
        t.id,
        t.name,
        t.display_name,
        t.usage_count,
        COUNT(*) as co_occurrence
      FROM tags t
      JOIN tag_associations ta1 ON t.id = ta1.tag_id
      JOIN tag_associations ta2 ON ta1.entry_id = ta2.entry_id
      WHERE ta2.tag_id IN (${Array(5).fill('?').join(',')})
        AND t.id NOT IN (${Array(5).fill('?').join(',')})
        AND t.is_active = TRUE
        AND t.name LIKE ?
      GROUP BY t.id
      ORDER BY co_occurrence DESC, t.usage_count DESC
      LIMIT ?
    `));
  }

  async searchTags(query: string, limit: number = 20): Promise<Tag[]> {
    // Use prepared statement for better performance
    return this.preparedQueries.get('tagSearch').all(
      this.formatFTSQuery(query),
      limit
    );
  }

  private formatFTSQuery(query: string): string {
    // Optimize FTS query format for better performance
    const terms = query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 1)
      .map(term => `"${term}"*`)  // Prefix search
      .join(' OR ');

    return terms || query;
  }
}
```

### Caching Strategy

#### Multi-Level Caching

```typescript
export class TagCacheManager {
  private memoryCache = new Map<string, any>();
  private redisCache?: RedisClient;
  private cacheConfig = {
    memory: {
      maxSize: 1000,
      ttl: 5 * 60 * 1000  // 5 minutes
    },
    redis: {
      ttl: 30 * 60,  // 30 minutes
      keyPrefix: 'kb-tags:'
    }
  };

  async get<T>(key: string): Promise<T | null> {
    // Level 1: Memory cache (fastest)
    const memoryResult = this.getFromMemory<T>(key);
    if (memoryResult) return memoryResult;

    // Level 2: Redis cache (fast)
    if (this.redisCache) {
      const redisResult = await this.getFromRedis<T>(key);
      if (redisResult) {
        this.setInMemory(key, redisResult);
        return redisResult;
      }
    }

    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Set in all cache levels
    this.setInMemory(key, value);

    if (this.redisCache) {
      await this.setInRedis(key, value);
    }
  }

  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value;
  }

  private setInMemory<T>(key: string, value: T): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.cacheConfig.memory.maxSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + this.cacheConfig.memory.ttl
    });
  }

  // Cache warming for common queries
  async warmCache(): Promise<void> {
    const commonQueries = [
      'error',
      'vsam',
      'jcl',
      'db2',
      'abend',
      'batch',
      'cobol'
    ];

    await Promise.all(
      commonQueries.map(async query => {
        const results = await TagService.search(query);
        await this.set(`search:${query}`, results);
      })
    );
  }
}
```

## Maintenance and Cleanup

### Regular Maintenance Tasks

#### Automated Maintenance Schedule

```typescript
interface MaintenanceTask {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  description: string;
  execute: () => Promise<MaintenanceResult>;
}

export class TagMaintenanceScheduler {
  private tasks: MaintenanceTask[] = [
    {
      name: 'update-usage-statistics',
      frequency: 'daily',
      description: 'Update tag usage counts and trending scores',
      execute: () => this.updateUsageStatistics()
    },
    {
      name: 'detect-duplicates',
      frequency: 'weekly',
      description: 'Identify potential duplicate tags for review',
      execute: () => this.detectDuplicates()
    },
    {
      name: 'cleanup-unused-tags',
      frequency: 'monthly',
      description: 'Archive tags not used for 90+ days',
      execute: () => this.cleanupUnusedTags()
    },
    {
      name: 'quality-analysis',
      frequency: 'monthly',
      description: 'Generate tag quality report and recommendations',
      execute: () => this.generateQualityReport()
    },
    {
      name: 'index-optimization',
      frequency: 'quarterly',
      description: 'Rebuild search indexes and optimize performance',
      execute: () => this.optimizeIndexes()
    }
  ];

  async runMaintenanceCycle(): Promise<MaintenanceReport> {
    const report: MaintenanceReport = {
      timestamp: new Date(),
      tasksExecuted: [],
      errors: [],
      overallStatus: 'success'
    };

    for (const task of this.getTasksToRun()) {
      try {
        console.log(`Running maintenance task: ${task.name}`);
        const result = await task.execute();

        report.tasksExecuted.push({
          name: task.name,
          result,
          duration: result.executionTime,
          status: 'success'
        });
      } catch (error) {
        report.errors.push({
          taskName: task.name,
          error: error.message,
          timestamp: new Date()
        });

        report.overallStatus = 'partial_failure';
      }
    }

    if (report.errors.length === report.tasksExecuted.length) {
      report.overallStatus = 'failure';
    }

    return report;
  }

  private async updateUsageStatistics(): Promise<MaintenanceResult> {
    const startTime = Date.now();

    // Update tag usage counts
    await this.db.exec(`
      UPDATE tags
      SET usage_count = (
        SELECT COUNT(*)
        FROM tag_associations
        WHERE tag_id = tags.id
      )
    `);

    // Calculate trending scores
    await this.db.exec(`
      UPDATE tags
      SET trending_score = (
        SELECT COALESCE(
          (COUNT(*) * 100.0 / MAX(1, (
            SELECT COUNT(*) FROM tag_associations ta2
            WHERE ta2.tag_id = tags.id
          ))), 0
        )
        FROM tag_associations ta
        WHERE ta.tag_id = tags.id
        AND ta.created_at > datetime('now', '-7 days')
      )
    `);

    return {
      taskName: 'update-usage-statistics',
      itemsProcessed: await this.db.prepare('SELECT COUNT(*) as count FROM tags').get().count,
      executionTime: Date.now() - startTime,
      status: 'completed'
    };
  }

  private async cleanupUnusedTags(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Find unused tags
    const unusedTags = await this.db.prepare(`
      SELECT t.id, t.name
      FROM tags t
      LEFT JOIN tag_associations ta ON t.id = ta.tag_id
      WHERE t.is_system = FALSE
        AND t.created_at < ?
        AND (
          ta.id IS NULL OR
          MAX(ta.created_at) < ?
        )
      GROUP BY t.id
    `).all(cutoffDate.toISOString(), cutoffDate.toISOString());

    // Archive unused tags (don't delete permanently)
    const archiveCount = await this.db.prepare(`
      UPDATE tags
      SET is_active = FALSE,
          archived_at = CURRENT_TIMESTAMP,
          archive_reason = 'unused_90_days'
      WHERE id IN (${unusedTags.map(() => '?').join(',')})
    `).run(...unusedTags.map(t => t.id)).changes;

    return {
      taskName: 'cleanup-unused-tags',
      itemsProcessed: archiveCount,
      executionTime: Date.now() - startTime,
      status: 'completed',
      details: `Archived ${archiveCount} unused tags`
    };
  }
}
```

## Team Collaboration

### Governance and Approval Workflows

#### Tag Review Process

```typescript
interface TagReviewWorkflow {
  reviewers: {
    domain_experts: Record<string, string[]>;  // domain -> user IDs
    general_reviewers: string[];
  };

  approval_rules: {
    new_tags: {
      required_approvals: number;
      auto_approve_patterns?: string[];
      require_expert_review: string[];  // domains requiring expert review
    };

    modifications: {
      required_approvals: number;
      notify_stakeholders: boolean;
    };

    deletions: {
      required_approvals: number;
      cooling_off_period: number;  // days
    };
  };
}

export class TagGovernanceWorkflow {
  async submitTagForReview(
    tagData: CreateTag,
    requester: User,
    reviewType: 'create' | 'modify' | 'delete'
  ): Promise<ReviewRequest> {
    const reviewRequest: ReviewRequest = {
      id: uuidv4(),
      type: reviewType,
      tagData,
      requester,
      status: 'pending',
      created_at: new Date(),
      reviewers: await this.assignReviewers(tagData, reviewType),
      deadline: this.calculateDeadline(reviewType)
    };

    // Store review request
    await ReviewRepository.create(reviewRequest);

    // Notify reviewers
    await this.notifyReviewers(reviewRequest);

    // Auto-approve if eligible
    if (await this.isAutoApprovable(tagData, reviewType)) {
      return await this.autoApprove(reviewRequest);
    }

    return reviewRequest;
  }

  private async assignReviewers(
    tagData: CreateTag,
    reviewType: string
  ): Promise<string[]> {
    const reviewers: string[] = [];

    // Assign domain experts
    if (tagData.category_id) {
      const category = await CategoryRepository.findById(tagData.category_id);
      const domainExperts = this.getDomainExperts(category?.name);
      reviewers.push(...domainExperts);
    }

    // Assign general reviewers for comprehensive coverage
    const generalReviewers = await this.getAvailableGeneralReviewers();
    reviewers.push(...generalReviewers.slice(0, 2));

    return [...new Set(reviewers)]; // Remove duplicates
  }

  async processReviewDecision(
    reviewId: string,
    reviewerId: string,
    decision: 'approve' | 'reject' | 'request_changes',
    comments?: string
  ): Promise<ReviewDecision> {
    const review = await ReviewRepository.findById(reviewId);
    if (!review) throw new Error('Review not found');

    const reviewDecision: ReviewDecision = {
      id: uuidv4(),
      review_id: reviewId,
      reviewer_id: reviewerId,
      decision,
      comments,
      timestamp: new Date()
    };

    await ReviewDecisionRepository.create(reviewDecision);

    // Check if review is complete
    const allDecisions = await ReviewDecisionRepository.findByReviewId(reviewId);
    const approvals = allDecisions.filter(d => d.decision === 'approve').length;
    const rejections = allDecisions.filter(d => d.decision === 'reject').length;

    if (rejections > 0) {
      // Any rejection fails the review
      await this.finalizeReview(reviewId, 'rejected');
    } else if (approvals >= this.getRequiredApprovals(review.type)) {
      // Sufficient approvals
      await this.finalizeReview(reviewId, 'approved');
      await this.executeApprovedAction(review);
    }

    return reviewDecision;
  }
}
```

### Documentation Standards

#### Tag Documentation Requirements

```typescript
interface TagDocumentation {
  definition: string;           // What the tag means
  usage_guidelines: string;     // When to use it
  examples: TagUsageExample[];  // Example usage
  related_tags: string[];       // Related or alternative tags
  domain_context?: string;      // Domain-specific context
  deprecation_notes?: string;   // If deprecated, migration path
}

interface TagUsageExample {
  title: string;
  description: string;
  appropriate: boolean;         // Whether this is appropriate usage
  explanation: string;          // Why it's appropriate/inappropriate
}

// Example documentation for a tag
const tagDocExample: TagDocumentation = {
  definition: "Indicates issues related to VSAM status code 35 (file not found)",

  usage_guidelines: `
    Use this tag for knowledge base entries that deal specifically with:
    - VSAM file not found errors (status 35)
    - Resolution procedures for missing VSAM files
    - Prevention strategies for catalog-related issues

    Do NOT use for:
    - General VSAM errors (use broader VSAM tags)
    - Non-VSAM file not found errors
    - Database-related file issues
  `,

  examples: [
    {
      title: "VSAM KSDS File Access Error",
      description: "Entry about resolving VSAM status 35 when accessing KSDS",
      appropriate: true,
      explanation: "Perfect fit - specifically addresses VSAM status 35"
    },
    {
      title: "General File Access Troubleshooting",
      description: "Broad entry covering various file access issues",
      appropriate: false,
      explanation: "Too general - use more specific tags for different error types"
    },
    {
      title: "VSAM Status 35 Prevention Checklist",
      description: "Preventive measures to avoid VSAM status 35 errors",
      appropriate: true,
      explanation: "Relevant to the specific error code and prevention"
    }
  ],

  related_tags: [
    "vsam-error",
    "file-not-found",
    "catalog-issue",
    "vsam-ksds",
    "data-access"
  ],

  domain_context: "Mainframe VSAM (Virtual Storage Access Method) data management"
};
```

This comprehensive best practices guide provides teams with the structure and guidelines needed to maintain a high-quality, effective categorization and tagging system that scales with their knowledge base.