/**
 * Comprehensive Test Data Generator for Search Functional Tests
 * Creates realistic mainframe knowledge base entries for testing
 */

import { KBEntry } from '../../../../src/types';
import { v4 as uuidv4 } from 'uuid';

export interface TestDataConfig {
  totalEntries: number;
  categoryDistribution: Record<string, number>;
  complexityLevels: Array<'simple' | 'moderate' | 'complex'>;
  includeEdgeCases: boolean;
  seedData: boolean;
}

export class SearchFunctionalTestData {
  private readonly defaultConfig: TestDataConfig = {
    totalEntries: 1000,
    categoryDistribution: {
      'VSAM': 0.25,
      'DB2': 0.20,
      'JCL': 0.20,
      'CICS': 0.15,
      'IMS': 0.10,
      'COBOL': 0.10
    },
    complexityLevels: ['simple', 'moderate', 'complex'],
    includeEdgeCases: true,
    seedData: true
  };

  private readonly mainframeTerms = {
    systems: ['MVS', 'z/OS', 'CICS', 'IMS', 'DB2', 'VSAM', 'TSO', 'ISPF', 'RACF', 'SDSF'],
    errorCodes: ['S0C1', 'S0C4', 'S0C7', 'S222', 'U4038', 'IEF450I', 'IEF404I', 'SQLCODE-803', 'SQLCODE-911'],
    components: ['JCL', 'COBOL', 'PL/I', 'Assembler', 'REXX', 'SORT', 'IEBGENER', 'IDCAMS'],
    operations: ['allocation', 'concatenation', 'disposition', 'step', 'job', 'procedure', 'catalog'],
    problems: ['ABEND', 'timeout', 'deadlock', 'space', 'authority', 'syntax', 'logic', 'performance'],
    solutions: ['restart', 'reallocate', 'grant', 'modify', 'tune', 'optimize', 'debug', 'trace']
  };

  private readonly problemTemplates = [
    'Encountering {errorCode} ABEND when {operation} {component} {resource}',
    '{system} {component} failing with {problem} during {operation}',
    'Performance issue with {system} {operation} causing {problem}',
    'Unable to {operation} {resource} due to {problem} in {system}',
    '{component} {operation} terminated with {errorCode} error',
    'Intermittent {problem} in {system} {component} during peak hours',
    '{system} connectivity {problem} affecting {component} operations',
    'Resource contention causing {problem} in {system} {operation}'
  ];

  private readonly solutionTemplates = [
    'Apply {solution} to {component} configuration in {system}',
    '{solution} the {resource} allocation for {component} in {system}',
    'Implement {solution} strategy for {system} {operation}',
    'Use {component} utility to {solution} the {problem}',
    '{solution} {system} parameters to resolve {problem}',
    'Execute {solution} procedure for {component} {operation}',
    'Configure {system} {component} to {solution} {problem}',
    'Monitor and {solution} {system} {component} performance'
  ];

  private readonly tagCategories = {
    problemType: ['error', 'performance', 'configuration', 'security', 'capacity'],
    severity: ['critical', 'high', 'medium', 'low'],
    frequency: ['common', 'occasional', 'rare'],
    complexity: ['simple', 'moderate', 'complex', 'expert'],
    domain: ['batch', 'online', 'database', 'network', 'storage']
  };

  /**
   * Generate test entries with specified configuration
   */
  async generateTestEntries(count?: number, config?: Partial<TestDataConfig>): Promise<KBEntry[]> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const totalCount = count || finalConfig.totalEntries;
    const entries: KBEntry[] = [];

    console.log(`Generating ${totalCount} test entries for functional testing...`);

    // Generate entries by category
    for (const [category, percentage] of Object.entries(finalConfig.categoryDistribution)) {
      const categoryCount = Math.floor(totalCount * percentage);
      const categoryEntries = this.generateCategoryEntries(category, categoryCount);
      entries.push(...categoryEntries);
    }

    // Fill remaining entries with mixed categories
    const remaining = totalCount - entries.length;
    if (remaining > 0) {
      const categories = Object.keys(finalConfig.categoryDistribution);
      for (let i = 0; i < remaining; i++) {
        const category = categories[i % categories.length];
        entries.push(this.generateSingleEntry(category));
      }
    }

    // Add edge cases if requested
    if (finalConfig.includeEdgeCases) {
      entries.push(...this.generateEdgeCaseEntries());
    }

    // Add seeded data for consistent testing
    if (finalConfig.seedData) {
      entries.push(...this.generateSeededEntries());
    }

    console.log(`Generated ${entries.length} total test entries`);
    return entries;
  }

  /**
   * Create a single test entry with specific properties
   */
  createTestEntry(properties: Partial<KBEntry>): KBEntry {
    const defaultEntry = this.generateSingleEntry('Testing');
    return {
      ...defaultEntry,
      ...properties,
      id: properties.id || defaultEntry.id,
      created_at: properties.created_at || defaultEntry.created_at,
      updated_at: properties.updated_at || defaultEntry.updated_at
    };
  }

  /**
   * Generate entries for specific functional test scenarios
   */
  generateScenarioEntries(): {
    exactMatch: KBEntry[];
    partialMatch: KBEntry[];
    fuzzyMatch: KBEntry[];
    noMatch: KBEntry[];
  } {
    return {
      exactMatch: this.generateExactMatchEntries(),
      partialMatch: this.generatePartialMatchEntries(),
      fuzzyMatch: this.generateFuzzyMatchEntries(),
      noMatch: this.generateNoMatchEntries()
    };
  }

  /**
   * Generate entries with specific query characteristics
   */
  generateQueryTestEntries(): {
    simpleQueries: KBEntry[];
    booleanQueries: KBEntry[];
    phraseQueries: KBEntry[];
    fieldQueries: KBEntry[];
  } {
    return {
      simpleQueries: this.generateSimpleQueryEntries(),
      booleanQueries: this.generateBooleanQueryEntries(),
      phraseQueries: this.generatePhraseQueryEntries(),
      fieldQueries: this.generateFieldQueryEntries()
    };
  }

  // Private Methods

  private generateCategoryEntries(category: string, count: number): KBEntry[] {
    const entries: KBEntry[] = [];

    for (let i = 0; i < count; i++) {
      entries.push(this.generateSingleEntry(category));
    }

    return entries;
  }

  private generateSingleEntry(category: string): KBEntry {
    const id = uuidv4();
    const now = new Date();
    const createdDate = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    const updatedDate = new Date(createdDate.getTime() + Math.random() * (now.getTime() - createdDate.getTime()));

    const problemText = this.generateProblemText(category);
    const solutionText = this.generateSolutionText(category);
    const title = this.generateTitle(category, problemText);
    const tags = this.generateTags(category);

    return {
      id,
      title,
      problem: problemText,
      solution: solutionText,
      category,
      tags,
      created_at: createdDate,
      updated_at: updatedDate,
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 50),
      failure_count: Math.floor(Math.random() * 10)
    };
  }

  private generateProblemText(category: string): string {
    const template = this.problemTemplates[Math.floor(Math.random() * this.problemTemplates.length)];
    const system = this.getRandomTerm('systems', category);
    const component = this.getRandomTerm('components', category);
    const errorCode = this.getRandomTerm('errorCodes');
    const operation = this.getRandomTerm('operations');
    const problem = this.getRandomTerm('problems');

    return template
      .replace('{system}', system)
      .replace('{component}', component)
      .replace('{errorCode}', errorCode)
      .replace('{operation}', operation)
      .replace('{problem}', problem)
      .replace('{resource}', `${category.toLowerCase()} dataset`);
  }

  private generateSolutionText(category: string): string {
    const template = this.solutionTemplates[Math.floor(Math.random() * this.solutionTemplates.length)];
    const system = this.getRandomTerm('systems', category);
    const component = this.getRandomTerm('components', category);
    const solution = this.getRandomTerm('solutions');
    const operation = this.getRandomTerm('operations');
    const problem = this.getRandomTerm('problems');

    return template
      .replace('{system}', system)
      .replace('{component}', component)
      .replace('{solution}', solution)
      .replace('{operation}', operation)
      .replace('{problem}', problem)
      .replace('{resource}', `${category.toLowerCase()} resource`);
  }

  private generateTitle(category: string, problemText: string): string {
    const words = problemText.split(' ').slice(0, 6);
    return `${category} ${words.join(' ').replace(/[{}]/g, '')}`.slice(0, 100);
  }

  private generateTags(category: string): string[] {
    const tags: string[] = [category.toLowerCase()];

    // Add random tags from each category
    for (const [tagType, tagValues] of Object.entries(this.tagCategories)) {
      if (Math.random() > 0.3) { // 70% chance to include each tag type
        const randomTag = tagValues[Math.floor(Math.random() * tagValues.length)];
        tags.push(randomTag);
      }
    }

    return tags;
  }

  private getRandomTerm(termType: keyof typeof this.mainframeTerms, prefer?: string): string {
    const terms = this.mainframeTerms[termType];

    // If we have a preference and it matches, use it more often
    if (prefer && terms.includes(prefer) && Math.random() > 0.3) {
      return prefer;
    }

    return terms[Math.floor(Math.random() * terms.length)];
  }

  private generateEdgeCaseEntries(): KBEntry[] {
    const edgeCases: KBEntry[] = [];

    // Very long content
    edgeCases.push(this.createTestEntry({
      title: 'Very long content entry for testing',
      problem: 'This is a very long problem description that contains many words and phrases to test how the search engine handles large amounts of text content. '.repeat(10),
      solution: 'This is a very long solution description that also contains many words and should test the indexing and search capabilities with large text blocks. '.repeat(10),
      category: 'Testing'
    }));

    // Special characters
    edgeCases.push(this.createTestEntry({
      title: 'Special characters: @#$%^&*()[]{}',
      problem: 'Problem with special characters: quotes "test", apostrophes \'test\', and symbols @#$%',
      solution: 'Solution for handling special characters in file-names_with-dashes.and.dots',
      category: 'Testing'
    }));

    // Unicode and international characters
    edgeCases.push(this.createTestEntry({
      title: 'Unicode test: café résumé naïve',
      problem: 'Handling unicode characters in mainframe: café, résumé, naïve, etc.',
      solution: 'Proper encoding and processing of unicode text',
      category: 'Testing'
    }));

    // Empty and minimal content
    edgeCases.push(this.createTestEntry({
      title: 'Minimal',
      problem: 'Min',
      solution: 'Fix',
      category: 'Testing',
      tags: ['min']
    }));

    // Numbers and codes
    edgeCases.push(this.createTestEntry({
      title: 'Error codes S0C1 S0C4 S0C7 and numbers 12345',
      problem: 'System error S0C1 occurred at address 12345678 in module TEST123',
      solution: 'Check return code 0008 and apply fix RC4567',
      category: 'Testing',
      tags: ['error-codes', 'numbers']
    }));

    return edgeCases;
  }

  private generateSeededEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        id: 'seed-001',
        title: 'VSAM file error handling',
        problem: 'VSAM file allocation error when opening dataset',
        solution: 'Check VSAM file allocation parameters and space',
        category: 'VSAM',
        tags: ['vsam', 'error', 'allocation']
      }),
      this.createTestEntry({
        id: 'seed-002',
        title: 'DB2 connection timeout issue',
        problem: 'DB2 connection timeout during batch processing',
        solution: 'Increase DB2 timeout parameters and optimize queries',
        category: 'DB2',
        tags: ['db2', 'timeout', 'connection']
      }),
      this.createTestEntry({
        id: 'seed-003',
        title: 'JCL step failure ABEND',
        problem: 'JCL step failure with ABEND S0C4',
        solution: 'Review memory allocation and fix program logic',
        category: 'JCL',
        tags: ['jcl', 'abend', 'failure']
      })
    ];
  }

  private generateExactMatchEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'Exact match test entry',
        problem: 'This entry should match exactly for phrase queries',
        solution: 'Exact phrase matching solution',
        category: 'Testing'
      })
    ];
  }

  private generatePartialMatchEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'Partial test entry',
        problem: 'This entry should match partially for some terms',
        solution: 'Partial matching solution with different terms',
        category: 'Testing'
      })
    ];
  }

  private generateFuzzyMatchEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'VSAM error entry', // Will match fuzzy query 'VSEM error'
        problem: 'VSAM file system error',
        solution: 'Fix VSAM configuration',
        category: 'VSAM'
      }),
      this.createTestEntry({
        title: 'DB2 connection entry', // Will match fuzzy query 'DB3 connection'
        problem: 'DB2 database connection issue',
        solution: 'Check DB2 connection parameters',
        category: 'DB2'
      })
    ];
  }

  private generateNoMatchEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'Completely different topic',
        problem: 'Unrelated problem about weather systems',
        solution: 'Meteorological solution',
        category: 'Weather'
      })
    ];
  }

  private generateSimpleQueryEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'Simple VSAM error',
        problem: 'Basic VSAM file error',
        solution: 'Simple VSAM fix',
        category: 'VSAM'
      })
    ];
  }

  private generateBooleanQueryEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'VSAM and DB2 integration',
        problem: 'VSAM with DB2 database issues',
        solution: 'Fix VSAM and DB2 integration',
        category: 'Integration'
      }),
      this.createTestEntry({
        title: 'CICS or IMS transaction',
        problem: 'Transaction processing in CICS or IMS',
        solution: 'Handle CICS or IMS transactions',
        category: 'Transaction'
      })
    ];
  }

  private generatePhraseQueryEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'VSAM file error exact phrase',
        problem: 'Experiencing VSAM file error in production',
        solution: 'Resolve VSAM file error quickly',
        category: 'VSAM'
      })
    ];
  }

  private generateFieldQueryEntries(): KBEntry[] {
    return [
      this.createTestEntry({
        title: 'Field-specific search test',
        problem: 'Problem content for field searching',
        solution: 'Solution content for field testing',
        category: 'FieldTest',
        tags: ['field-search', 'testing']
      })
    ];
  }
}