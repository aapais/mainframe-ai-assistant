/**
 * Mock data generator for testing
 * Creates realistic KB entries and test datasets
 */

import { KBEntry } from '../../../src/types';
import { ListingOptions, FilterCriteria, QuickFilterInfo } from '../../../src/main/services/KBListingService';

// =========================
// MOCK DATA TEMPLATES
// =========================

const CATEGORIES = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional', 'Other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const PROBLEM_TEMPLATES = {
  VSAM: [
    'VSAM file cannot be opened with status code {code}',
    'VSAM dataset {dataset} is not accessible',
    'VSAM catalog error for file {file}',
    'VSAM index corruption detected in {dataset}',
    'VSAM alternate index needs rebuild for {file}'
  ],
  JCL: [
    'JCL error {error} in step {step}',
    'Dataset allocation failed with {error}',
    'JCL syntax error on line {line}',
    'Job {jobname} abended with code {code}',
    'Step {step} failed with condition code {cc}'
  ],
  DB2: [
    'DB2 SQLCODE {code} encountered in program {program}',
    'Database {db} is unavailable',
    'DB2 deadlock detected in transaction {txn}',
    'Table {table} access denied',
    'DB2 connection timeout in application {app}'
  ],
  Batch: [
    'Program {program} abended with S0C{code}',
    'Sort utility failed with error {error}',
    'File processing error in program {program}',
    'Memory allocation failed in {program}',
    'Data conversion error in field {field}'
  ],
  Functional: [
    'CICS transaction {txn} failed with abend {code}',
    'Screen navigation error in panel {panel}',
    'Business logic error in function {function}',
    'Validation failed for input {input}',
    'Report generation failed for {report}'
  ],
  Other: [
    'System error {error} occurred',
    'Unknown problem with component {component}',
    'Generic error in process {process}',
    'Timeout error in service {service}',
    'Configuration issue with {config}'
  ]
};

const SOLUTION_TEMPLATES = {
  VSAM: [
    '1. Check VSAM file status with LISTCAT\n2. Verify dataset exists and is cataloged\n3. Check RACF permissions\n4. Rebuild index if corrupted',
    '1. Use IDCAMS to verify dataset\n2. Check space allocation\n3. Review VSAM parameters\n4. Contact DBA if persistent',
    '1. Run VSAM VERIFY utility\n2. Check for proper file closure\n3. Review SHAREOPTIONS\n4. Restore from backup if needed'
  ],
  JCL: [
    '1. Review JCL syntax on reported line\n2. Check dataset names and allocations\n3. Verify step dependencies\n4. Check REGION and space parameters',
    '1. Examine job log for detailed error\n2. Check dataset availability\n3. Verify JCL parameters\n4. Review step return codes',
    '1. Check JCL manual for syntax rules\n2. Validate all DD statements\n3. Review PROC substitutions\n4. Test with simplified JCL'
  ],
  DB2: [
    '1. Check DB2 manual for SQLCODE meaning\n2. Review SQL statement syntax\n3. Check database connectivity\n4. Contact DBA for assistance',
    '1. Verify database status\n2. Check table locks and deadlocks\n3. Review connection parameters\n4. Retry with backoff strategy',
    '1. Check DB2 subsystem status\n2. Review application connection logic\n3. Verify user permissions\n4. Monitor database logs'
  ],
  Batch: [
    '1. Check program compile listing at offset\n2. Review data definitions\n3. Validate input data\n4. Check memory allocation',
    '1. Examine dump for exact error location\n2. Review variable initialization\n3. Check array bounds\n4. Test with sample data',
    '1. Review program logic flow\n2. Check error handling routines\n3. Validate computational fields\n4. Add debugging statements'
  ],
  Functional: [
    '1. Check CICS error codes\n2. Review transaction definition\n3. Verify program resources\n4. Check CICS region status',
    '1. Review screen flow logic\n2. Check panel definitions\n3. Verify user navigation path\n4. Test screen sequence',
    '1. Review business rules\n2. Check input validation\n3. Verify calculation logic\n4. Test with various inputs'
  ],
  Other: [
    '1. Check system logs for details\n2. Review error documentation\n3. Contact technical support\n4. Implement workaround if available',
    '1. Gather additional diagnostic information\n2. Check system configuration\n3. Review recent changes\n4. Escalate if unresolved',
    '1. Document error symptoms\n2. Check knowledge base for similar issues\n3. Try standard troubleshooting\n4. Request assistance if needed'
  ]
};

const TAG_POOLS = {
  VSAM: ['vsam', 'file', 'dataset', 'catalog', 'index', 'status-code', 'access', 'corruption'],
  JCL: ['jcl', 'job', 'step', 'dataset', 'allocation', 'syntax', 'abend', 'condition-code'],
  DB2: ['db2', 'sql', 'database', 'table', 'connection', 'deadlock', 'timeout', 'permission'],
  Batch: ['batch', 'program', 'abend', 'memory', 'data', 'sort', 'processing', 'error'],
  Functional: ['cics', 'transaction', 'screen', 'panel', 'business-logic', 'validation', 'report'],
  Other: ['system', 'error', 'configuration', 'timeout', 'unknown', 'generic', 'troubleshooting']
};

// =========================
// MOCK DATA GENERATORS
// =========================

/**
 * Generate a single mock KB entry
 */
export function generateMockKBEntry(id?: string, category?: string): KBEntry {
  const entryId = id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const entryCategory = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];

  // Generate realistic problem and solution
  const problemTemplate = PROBLEM_TEMPLATES[entryCategory][
    Math.floor(Math.random() * PROBLEM_TEMPLATES[entryCategory].length)
  ];

  const solutionTemplate = SOLUTION_TEMPLATES[entryCategory][
    Math.floor(Math.random() * SOLUTION_TEMPLATES[entryCategory].length)
  ];

  // Replace placeholders in templates
  const problem = problemTemplate
    .replace('{code}', Math.floor(Math.random() * 99).toString().padStart(2, '0'))
    .replace('{dataset}', `PROD.DATA.${Math.random().toString(36).substr(2, 6).toUpperCase()}`)
    .replace('{file}', `FILE${Math.floor(Math.random() * 999) + 1}`)
    .replace('{error}', `IEF${Math.floor(Math.random() * 999) + 100}I`)
    .replace('{step}', `STEP${Math.floor(Math.random() * 10) + 1}`)
    .replace('{line}', Math.floor(Math.random() * 1000) + 1)
    .replace('{jobname}', `JOB${Math.random().toString(36).substr(2, 5).toUpperCase()}`)
    .replace('{cc}', Math.floor(Math.random() * 16))
    .replace('{program}', `PGM${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
    .replace('{db}', `DB${Math.floor(Math.random() * 10) + 1}`)
    .replace('{txn}', `TXN${Math.random().toString(36).substr(2, 3).toUpperCase()}`)
    .replace('{table}', `TABLE_${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
    .replace('{app}', `APP${Math.floor(Math.random() * 100) + 1}`)
    .replace('{panel}', `PNL${Math.floor(Math.random() * 999) + 1}`)
    .replace('{function}', `FUNC_${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
    .replace('{input}', `FIELD_${Math.random().toString(36).substr(2, 3).toUpperCase()}`)
    .replace('{report}', `RPT${Math.floor(Math.random() * 999) + 1}`)
    .replace('{component}', `COMP_${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
    .replace('{process}', `PROC${Math.floor(Math.random() * 100) + 1}`)
    .replace('{service}', `SVC_${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
    .replace('{config}', `CFG_${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
    .replace('{field}', `FIELD${Math.floor(Math.random() * 100) + 1}`);

  // Generate title from problem
  const title = problem.split('\n')[0].substring(0, 80);

  // Generate tags
  const availableTags = TAG_POOLS[entryCategory];
  const numTags = Math.floor(Math.random() * 4) + 2; // 2-5 tags
  const tags = [];
  const usedTags = new Set();

  for (let i = 0; i < numTags; i++) {
    const tag = availableTags[Math.floor(Math.random() * availableTags.length)];
    if (!usedTags.has(tag)) {
      tags.push(tag);
      usedTags.add(tag);
    }
  }

  // Generate realistic usage statistics
  const usageCount = Math.floor(Math.random() * 100);
  const successRate = Math.random() * 0.3 + 0.7; // 70-100% success rate
  const successCount = Math.floor(usageCount * successRate);
  const failureCount = usageCount - successCount;

  // Generate timestamps
  const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
  const updatedAt = new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()));
  const lastUsed = usageCount > 0 ? new Date(updatedAt.getTime() + Math.random() * (Date.now() - updatedAt.getTime())) : null;

  return {
    id: entryId,
    title,
    problem,
    solution: solutionTemplate,
    category: entryCategory,
    severity,
    tags,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    created_by: `user-${Math.floor(Math.random() * 10) + 1}`,
    usage_count: usageCount,
    success_count: successCount,
    failure_count: failureCount,
    last_used: lastUsed?.toISOString() || null
  };
}

/**
 * Generate multiple mock KB entries
 */
export function generateMockKBEntries(count: number, options: {
  categories?: string[];
  severities?: string[];
  dateRange?: { start: Date; end: Date };
} = {}): KBEntry[] {
  const { categories = CATEGORIES, severities = SEVERITIES } = options;
  const entries: KBEntry[] = [];

  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const entry = generateMockKBEntry(`entry-${i + 1}`, category);

    // Apply severity filter if specified
    if (severities.length < SEVERITIES.length) {
      entry.severity = severities[Math.floor(Math.random() * severities.length)];
    }

    // Apply date range if specified
    if (options.dateRange) {
      const { start, end } = options.dateRange;
      const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
      entry.created_at = new Date(randomTime).toISOString();
      entry.updated_at = new Date(randomTime + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    entries.push(entry);
  }

  return entries;
}

/**
 * Generate mock entries with specific patterns for testing
 */
export function generatePatternedKBEntries(): KBEntry[] {
  return [
    // Recent entries (last 7 days)
    ...generateMockKBEntries(5, {
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      }
    }),

    // Popular entries (high usage)
    ...generateMockKBEntries(8).map(entry => ({
      ...entry,
      usage_count: Math.floor(Math.random() * 50) + 50,
      success_count: Math.floor((entry.usage_count || 0) * 0.9),
      failure_count: Math.floor((entry.usage_count || 0) * 0.1)
    })),

    // Highly rated entries (high success rate)
    ...generateMockKBEntries(6).map(entry => ({
      ...entry,
      usage_count: Math.floor(Math.random() * 30) + 10,
      success_count: Math.floor((entry.usage_count || 0) * 0.95),
      failure_count: Math.floor((entry.usage_count || 0) * 0.05)
    })),

    // Category-specific entries
    ...CATEGORIES.map(category => generateMockKBEntry(undefined, category)),

    // Entries needing review (low success rate)
    ...generateMockKBEntries(3).map(entry => ({
      ...entry,
      usage_count: Math.floor(Math.random() * 20) + 5,
      success_count: Math.floor((entry.usage_count || 0) * 0.4),
      failure_count: Math.floor((entry.usage_count || 0) * 0.6)
    }))
  ];
}

/**
 * Generate mock filter criteria for testing
 */
export function generateMockFilterCriteria(): FilterCriteria[] {
  return [
    {
      field: 'category',
      operator: 'eq',
      value: 'VSAM'
    },
    {
      field: 'category',
      operator: 'in',
      value: ['VSAM', 'JCL', 'DB2']
    },
    {
      field: 'severity',
      operator: 'ne',
      value: 'low'
    },
    {
      field: 'usage_count',
      operator: 'gte',
      value: 10
    },
    {
      field: 'usage_count',
      operator: 'between',
      value: [5, 50]
    },
    {
      field: 'created_at',
      operator: 'gte',
      value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      field: 'created_at',
      operator: 'between',
      value: [
        new Date('2024-01-01').toISOString(),
        new Date('2024-12-31').toISOString()
      ]
    },
    {
      field: 'title',
      operator: 'contains',
      value: 'error'
    },
    {
      field: 'tags',
      operator: 'contains',
      value: 'vsam'
    },
    {
      field: 'success_rate',
      operator: 'gte',
      value: 0.8
    }
  ];
}

/**
 * Generate mock listing options for testing
 */
export function generateMockListingOptions(): ListingOptions[] {
  const filterCriteria = generateMockFilterCriteria();

  return [
    // Basic pagination
    { page: 1, pageSize: 10 },
    { page: 2, pageSize: 20 },
    { page: 5, pageSize: 50 },

    // Different sorting
    { sortBy: 'title', sortDirection: 'asc' },
    { sortBy: 'category', sortDirection: 'asc' },
    { sortBy: 'usage_count', sortDirection: 'desc' },
    { sortBy: 'created_at', sortDirection: 'desc' },

    // With filters
    { filters: [filterCriteria[0]] },
    { filters: [filterCriteria[1], filterCriteria[3]] },
    { filters: filterCriteria.slice(0, 3) },

    // With search
    { searchQuery: 'VSAM error', searchFields: ['all'] },
    { searchQuery: 'database', searchFields: ['title', 'problem'] },
    { searchQuery: 'S0C7', searchFields: ['problem', 'solution'] },

    // Quick filters
    { quickFilters: ['recent'] },
    { quickFilters: ['popular', 'highly_rated'] },
    { quickFilters: ['needs_review'] },

    // Complex combinations
    {
      page: 2,
      pageSize: 25,
      sortBy: 'usage_count',
      sortDirection: 'desc',
      filters: [filterCriteria[0], filterCriteria[3]],
      searchQuery: 'error',
      quickFilters: ['popular']
    },

    // Edge cases
    { page: 999, pageSize: 1 },
    { page: 1, pageSize: 100 },
    { filters: [], quickFilters: [], searchQuery: '' }
  ];
}

/**
 * Generate mock quick filters
 */
export function generateMockQuickFilters(): QuickFilterInfo[] {
  return [
    { type: 'recent', label: 'Recently Added', count: 8, active: false },
    { type: 'popular', label: 'Most Popular', count: 15, active: false },
    { type: 'highly_rated', label: 'Highly Rated', count: 12, active: false },
    { type: 'frequently_used', label: 'Frequently Used', count: 20, active: false },
    { type: 'needs_review', label: 'Needs Review', count: 3, active: false },
    { type: 'my_entries', label: 'My Entries', count: 5, active: false }
  ];
}

/**
 * Generate performance test dataset
 */
export function generateLargeDataset(size: number): KBEntry[] {
  console.log(`Generating ${size} KB entries for performance testing...`);

  const entries: KBEntry[] = [];
  const batchSize = 1000;

  for (let batch = 0; batch < Math.ceil(size / batchSize); batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, size);
    const batchEntries = generateMockKBEntries(batchEnd - batchStart);

    entries.push(...batchEntries);

    if ((batch + 1) % 10 === 0) {
      console.log(`Generated ${(batch + 1) * batchSize} entries...`);
    }
  }

  console.log(`Generated ${entries.length} entries total`);
  return entries;
}

/**
 * Create realistic search scenarios for testing
 */
export function generateSearchScenarios() {
  return [
    // Common searches
    { query: 'VSAM error', expectedResults: 5, category: 'VSAM' },
    { query: 'S0C7 abend', expectedResults: 3, category: 'Batch' },
    { query: 'JCL syntax', expectedResults: 4, category: 'JCL' },
    { query: 'database connection', expectedResults: 6, category: 'DB2' },
    { query: 'CICS transaction', expectedResults: 2, category: 'Functional' },

    // Partial matches
    { query: 'file not found', expectedResults: 8, mixed: true },
    { query: 'timeout', expectedResults: 4, mixed: true },
    { query: 'permission', expectedResults: 3, mixed: true },

    // Technical terms
    { query: 'SQLCODE -904', expectedResults: 1, category: 'DB2' },
    { query: 'IEF212I', expectedResults: 2, category: 'JCL' },
    { query: 'WER027A', expectedResults: 1, category: 'Batch' },

    // Empty and edge cases
    { query: '', expectedResults: 0, description: 'Empty query' },
    { query: 'xyznevermatches', expectedResults: 0, description: 'No matches' },
    { query: 'a', expectedResults: 0, description: 'Too short' },
    { query: 'the and or', expectedResults: 0, description: 'Stop words only' },

    // Complex queries
    { query: 'VSAM file error status', expectedResults: 3, description: 'Multiple terms' },
    { query: '"exact phrase match"', expectedResults: 0, description: 'Quoted phrase' },
    { query: 'error -JCL', expectedResults: 5, description: 'Exclusion operator' }
  ];
}

/**
 * Generate realistic aggregation data
 */
export function generateMockAggregations(entries: KBEntry[]) {
  // Category statistics
  const categoryStats = CATEGORIES.map(category => {
    const categoryEntries = entries.filter(e => e.category === category);
    const totalUsage = categoryEntries.reduce((sum, e) => sum + (e.usage_count || 0), 0);
    const totalRating = categoryEntries.reduce((sum, e) => {
      const rate = (e.success_count || 0) / ((e.success_count || 0) + (e.failure_count || 0) + 1);
      return sum + rate;
    }, 0);

    return {
      category,
      count: categoryEntries.length,
      percentage: (categoryEntries.length / entries.length) * 100,
      avgRating: categoryEntries.length > 0 ? totalRating / categoryEntries.length : 0,
      avgUsage: categoryEntries.length > 0 ? totalUsage / categoryEntries.length : 0
    };
  });

  // Tag cloud
  const tagCounts = new Map<string, number>();
  entries.forEach(entry => {
    entry.tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const tagCloud = Array.from(tagCounts.entries()).map(([tag, count]) => ({
    tag,
    count,
    popularity: Math.log(count + 1) * 10,
    trendDirection: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable'
  })).slice(0, 20);

  // Usage statistics
  const totalViews = entries.reduce((sum, e) => sum + (e.usage_count || 0), 0);
  const totalUsers = new Set(entries.map(e => e.created_by)).size;

  const usageStats = {
    totalViews,
    uniqueUsers: totalUsers,
    avgSessionTime: Math.floor(Math.random() * 300) + 100,
    bounceRate: Math.random() * 0.3 + 0.1,
    conversionRate: Math.random() * 0.3 + 0.7
  };

  return {
    categoryStats,
    tagCloud,
    severityDistribution: SEVERITIES.map(severity => ({
      severity,
      count: entries.filter(e => e.severity === severity).length,
      percentage: (entries.filter(e => e.severity === severity).length / entries.length) * 100
    })),
    usageStats,
    timelineStats: [] // Can be expanded later
  };
}