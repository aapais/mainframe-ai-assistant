/**
 * Mock Data Generators for Integration Tests
 *
 * Provides realistic test data for categories, tags, and KB entries
 * with configurable relationships and properties.
 */

import { KBEntry } from '../../database/KnowledgeDB';
import { Tag } from '../../services/EnhancedTagService';
import { CategoryNode } from '../../services/CategoryHierarchyService';

// ===========================
// MOCK DATA GENERATORS
// ===========================

export const createMockKBEntry = (id: string, overrides: Partial<KBEntry> = {}): KBEntry => ({
  id,
  title: `Test Entry ${id}`,
  problem: `This is a test problem description for entry ${id}`,
  solution: `This is a test solution for entry ${id}`,
  category: 'Other',
  tags: [],
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'test-user',
  usage_count: Math.floor(Math.random() * 50),
  success_count: Math.floor(Math.random() * 40),
  failure_count: Math.floor(Math.random() * 10),
  success_rate: Math.random(),
  trending_score: Math.random() * 100,
  last_used: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
  ...overrides,
});

export const createMockTag = (id: string, name: string, overrides: Partial<Tag> = {}): Tag => ({
  id,
  name,
  description: `Description for ${name}`,
  color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
  usage_count: Math.floor(Math.random() * 100),
  created_at: new Date(),
  created_by: 'test-user',
  category: null,
  is_system: false,
  auto_suggest: Math.random() > 0.5,
  related_tags: [],
  synonyms: [],
  ...overrides,
});

export const createMockCategory = (
  id: string,
  name: string,
  overrides: Partial<CategoryNode> = {}
): CategoryNode => ({
  id,
  name,
  description: `Description for ${name} category`,
  icon: '📁',
  color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
  is_system: false,
  entry_count: Math.floor(Math.random() * 20),
  created_at: new Date(),
  updated_at: new Date(),
  parent_id: null,
  sort_order: Math.floor(Math.random() * 100),
  tags: [],
  trending_score: Math.random() * 100,
  ...overrides,
});

// ===========================
// REALISTIC DATA SETS
// ===========================

export const createRealisticKBEntry = (category: string, tagNames: string[]): KBEntry => {
  const problemTemplates = {
    JCL: [
      'Job fails with JCL error {code}',
      'Dataset allocation fails with {error}',
      'Step abends with condition code {code}',
    ],
    VSAM: [
      'VSAM file returns status {code}',
      'VSAM catalog issues with {dataset}',
      'VSAM access method error {error}',
    ],
    DB2: [
      'SQL query returns SQLCODE {code}',
      'Database connection timeout',
      'Query performance issues with {table}',
    ],
    Batch: [
      'Program abends with S0C{code}',
      'Memory allocation failure',
      'Processing timeout in {module}',
    ],
  };

  const solutionTemplates = {
    JCL: [
      '1. Check DD statement syntax\n2. Verify dataset exists\n3. Review JCL parameters',
      '1. Increase region size\n2. Check space parameters\n3. Verify catalog entries',
      '1. Review step dependencies\n2. Check condition codes\n3. Verify input datasets',
    ],
    VSAM: [
      '1. Run VSAM verify\n2. Check file status\n3. Review access method',
      '1. Check catalog definition\n2. Verify IDCAMS commands\n3. Review space allocation',
      '1. Analyze VSAM parameters\n2. Check record structure\n3. Verify index integrity',
    ],
    DB2: [
      '1. Check SQL syntax\n2. Review table structure\n3. Verify permissions',
      '1. Analyze explain plan\n2. Add indexes if needed\n3. Update statistics',
      '1. Check connection parameters\n2. Review timeout settings\n3. Monitor database load',
    ],
    Batch: [
      '1. Check variable initialization\n2. Review arithmetic operations\n3. Add data validation',
      '1. Increase memory allocation\n2. Check working storage\n3. Review data structures',
      '1. Add timeout handling\n2. Implement checkpoints\n3. Optimize processing logic',
    ],
  };

  const templates =
    problemTemplates[category as keyof typeof problemTemplates] || problemTemplates.JCL;
  const solutions =
    solutionTemplates[category as keyof typeof solutionTemplates] || solutionTemplates.JCL;

  const problemTemplate = templates[Math.floor(Math.random() * templates.length)];
  const solutionTemplate = solutions[Math.floor(Math.random() * solutions.length)];

  // Replace placeholders with realistic values
  const problem = problemTemplate
    .replace(
      '{code}',
      Math.floor(Math.random() * 999)
        .toString()
        .padStart(3, '0')
    )
    .replace(
      '{error}',
      'IEF' +
        Math.floor(Math.random() * 999)
          .toString()
          .padStart(3, '0') +
        'I'
    )
    .replace('{dataset}', 'PROD.DATA.FILE')
    .replace('{table}', 'USER_TABLE')
    .replace('{module}', 'MODULE' + Math.floor(Math.random() * 100));

  return createMockKBEntry(
    `kb-${category.toLowerCase()}-${Math.random().toString(36).substring(7)}`,
    {
      title: problem.split(' ').slice(0, 5).join(' '),
      problem,
      solution: solutionTemplate,
      category,
      tags: tagNames,
      success_rate: 0.6 + Math.random() * 0.4, // 60-100% success rate
      usage_count: Math.floor(Math.random() * 100),
      trending_score: Math.random() * 50 + (category === 'DB2' ? 50 : 0), // DB2 trending higher
    }
  );
};

export const createRealisticTagSet = (): Tag[] => {
  const tagCategories = {
    JCL: ['job-control', 'allocation', 'step-processing', 'dataset-management'],
    VSAM: ['file-access', 'catalog', 'record-management', 'index-processing'],
    DB2: ['sql', 'performance', 'connection', 'transaction', 'query-optimization'],
    Batch: ['abend', 'memory', 'processing', 'error-handling', 'data-validation'],
    General: ['troubleshooting', 'monitoring', 'debugging', 'optimization'],
  };

  const tags: Tag[] = [];
  let tagCounter = 1;

  Object.entries(tagCategories).forEach(([category, tagNames]) => {
    tagNames.forEach(tagName => {
      tags.push(
        createMockTag(`tag-${tagCounter++}`, tagName, {
          category: category === 'General' ? null : category,
          is_system: category !== 'General',
          usage_count: Math.floor(Math.random() * 200),
          auto_suggest: true,
          related_tags: tagNames.filter(t => t !== tagName).slice(0, 2),
        })
      );
    });
  });

  return tags;
};

export const createRealisticCategorySet = (): CategoryNode[] => {
  const systemCategories = [
    { name: 'JCL', icon: '📋', description: 'Job Control Language issues and solutions' },
    { name: 'VSAM', icon: '🗄️', description: 'Virtual Storage Access Method problems' },
    { name: 'DB2', icon: '🗃️', description: 'Database management and SQL issues' },
    { name: 'Batch', icon: '⚙️', description: 'Batch processing and program errors' },
    { name: 'CICS', icon: '🖥️', description: 'Customer Information Control System' },
    { name: 'IMS', icon: '💾', description: 'Information Management System' },
  ];

  const userCategories = [
    { name: 'Performance', icon: '🚀', description: 'Performance tuning and optimization' },
    { name: 'Security', icon: '🔒', description: 'Security-related issues and configurations' },
    { name: 'Monitoring', icon: '📊', description: 'System monitoring and alerting' },
  ];

  return [
    ...systemCategories.map((cat, index) =>
      createMockCategory(`sys-cat-${index + 1}`, cat.name, {
        ...cat,
        is_system: true,
        entry_count: Math.floor(Math.random() * 50) + 10,
        trending_score: Math.random() * 100,
      })
    ),
    ...userCategories.map((cat, index) =>
      createMockCategory(`user-cat-${index + 1}`, cat.name, {
        ...cat,
        is_system: false,
        entry_count: Math.floor(Math.random() * 20) + 5,
        trending_score: Math.random() * 30,
      })
    ),
  ];
};

// ===========================
// RELATIONSHIP BUILDERS
// ===========================

export const buildEntryTagRelationships = (entries: KBEntry[], tags: Tag[]): KBEntry[] => {
  return entries.map(entry => {
    // Get category-specific tags
    const categoryTags = tags.filter(
      tag => tag.category === entry.category || tag.category === null
    );

    // Randomly assign 1-4 relevant tags
    const numTags = Math.floor(Math.random() * 4) + 1;
    const assignedTags = categoryTags
      .sort(() => Math.random() - 0.5)
      .slice(0, numTags)
      .map(tag => tag.name);

    return {
      ...entry,
      tags: assignedTags,
    };
  });
};

export const buildCategoryHierarchy = (categories: CategoryNode[]): CategoryNode[] => {
  const hierarchical = [...categories];

  // Create some parent-child relationships
  const systemCategories = hierarchical.filter(cat => cat.is_system);
  const userCategories = hierarchical.filter(cat => !cat.is_system);

  // Make some user categories children of system categories
  userCategories.forEach((userCat, index) => {
    if (index < systemCategories.length) {
      userCat.parent_id = systemCategories[index].id;
    }
  });

  return hierarchical;
};

// ===========================
// BULK DATA GENERATORS
// ===========================

export interface LargeDatasetConfig {
  entryCount: number;
  tagCount: number;
  categoryCount: number;
  maxTagsPerEntry: number;
}

export const createLargeDataset = (config: LargeDatasetConfig) => {
  const categories: CategoryNode[] = [];
  const tags: Tag[] = [];
  const entries: KBEntry[] = [];

  // Generate categories
  for (let i = 0; i < config.categoryCount; i++) {
    categories.push(
      createMockCategory(`bulk-cat-${i}`, `Category ${i}`, {
        is_system: i < config.categoryCount * 0.3, // 30% system categories
        entry_count: Math.floor(Math.random() * 50),
      })
    );
  }

  // Generate tags
  for (let i = 0; i < config.tagCount; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    tags.push(
      createMockTag(`bulk-tag-${i}`, `tag-${i}`, {
        category: Math.random() > 0.7 ? category.name : null, // 30% have categories
        usage_count: Math.floor(Math.random() * 1000),
      })
    );
  }

  // Generate entries
  for (let i = 0; i < config.entryCount; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const numTags = Math.floor(Math.random() * config.maxTagsPerEntry) + 1;
    const entryTags = tags
      .sort(() => Math.random() - 0.5)
      .slice(0, numTags)
      .map(tag => tag.name);

    entries.push(createRealisticKBEntry(category.name, entryTags));
  }

  return { categories, tags, entries };
};

// ===========================
// ERROR SIMULATION
// ===========================

export const createErrorScenarios = () => ({
  networkFailure: () => Promise.reject(new Error('Network request failed')),

  databaseError: () => Promise.reject(new Error('Database connection lost')),

  validationError: () => Promise.reject(new Error('Validation failed: Invalid data format')),

  permissionError: () => Promise.reject(new Error('Insufficient permissions')),

  timeoutError: () =>
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 100)),

  intermittentFailure: (() => {
    let callCount = 0;
    return () => {
      callCount++;
      if (callCount % 3 === 0) {
        return Promise.reject(new Error('Intermittent service failure'));
      }
      return Promise.resolve({ success: true });
    };
  })(),
});

// ===========================
// PERFORMANCE DATA
// ===========================

export const createPerformanceTestData = () => {
  const LARGE_DATASET = createLargeDataset({
    entryCount: 1000,
    tagCount: 200,
    categoryCount: 50,
    maxTagsPerEntry: 8,
  });

  // Add performance-specific properties
  LARGE_DATASET.tags.forEach(tag => {
    tag.usage_count = Math.floor(Math.random() * 10000);
  });

  LARGE_DATASET.entries.forEach(entry => {
    entry.usage_count = Math.floor(Math.random() * 500);
    entry.success_rate = Math.random();
  });

  return LARGE_DATASET;
};
