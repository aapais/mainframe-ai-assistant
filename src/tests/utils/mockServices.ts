/**
 * Mock Services for Integration Testing
 *
 * Provides realistic mock implementations of external services
 * including AI services, database operations, and network requests.
 */

import { Tag, TagSuggestion } from '../../services/EnhancedTagService';
import { CategoryNode } from '../../services/CategoryHierarchyService';
import { KBEntry } from '../../database/KnowledgeDB';

// ===========================
// MOCK GEMINI SERVICE
// ===========================

export interface MockGeminiConfig {
  responseDelay?: number;
  errorRate?: number; // 0-1, probability of error
  confidenceRange?: [number, number];
  enableReasoningGeneration?: boolean;
}

export class MockGeminiService {
  private config: Required<MockGeminiConfig>;

  constructor(config: MockGeminiConfig = {}) {
    this.config = {
      responseDelay: config.responseDelay ?? 100,
      errorRate: config.errorRate ?? 0.05,
      confidenceRange: config.confidenceRange ?? [0.6, 0.95],
      enableReasoningGeneration: config.enableReasoningGeneration ?? true,
    };
  }

  async suggestTags(
    query: string,
    context: {
      category?: string;
      existingTags?: string[];
      similarEntries?: KBEntry[];
    } = {}
  ): Promise<TagSuggestion[]> {
    await this.simulateDelay();

    if (Math.random() < this.config.errorRate) {
      throw new Error('Simulated Gemini API error');
    }

    const suggestions: TagSuggestion[] = [];

    // Generate contextual suggestions based on query
    const queryWords = query.toLowerCase().split(/\s+/);
    const relevantTags = this.generateRelevantTags(queryWords, context.category);

    relevantTags.forEach(tagName => {
      const confidence = this.randomInRange(...this.config.confidenceRange);

      suggestions.push({
        tag: {
          id: `mock-tag-${tagName}`,
          name: tagName,
          description: `AI-suggested tag for ${tagName}`,
          usage_count: Math.floor(Math.random() * 100),
          category: context.category || null,
          is_system: false,
          auto_suggest: true,
          created_at: new Date(),
          created_by: 'ai-assistant',
          color: this.generateTagColor(tagName),
          related_tags: [],
          synonyms: [],
        },
        score: confidence,
        source: 'ai',
        reasoning: this.config.enableReasoningGeneration
          ? this.generateReasoning(tagName, query, context)
          : undefined,
      });
    });

    return suggestions.sort((a, b) => b.score - a.score);
  }

  async categorizeEntry(entry: Partial<KBEntry>): Promise<{
    suggestedCategory: string;
    confidence: number;
    reasoning?: string;
  }> {
    await this.simulateDelay();

    if (Math.random() < this.config.errorRate) {
      throw new Error('Simulated categorization error');
    }

    const text =
      `${entry.title || ''} ${entry.problem || ''} ${entry.solution || ''}`.toLowerCase();
    const category = this.inferCategoryFromText(text);
    const confidence = this.randomInRange(...this.config.confidenceRange);

    return {
      suggestedCategory: category,
      confidence,
      reasoning: this.config.enableReasoningGeneration
        ? `Based on keywords and patterns in the text, this appears to be a ${category} issue.`
        : undefined,
    };
  }

  async explainCode(code: string): Promise<string> {
    await this.simulateDelay();

    if (Math.random() < this.config.errorRate) {
      throw new Error('Code explanation service unavailable');
    }

    // Simple mock explanation based on code patterns
    const explanations = [
      'This code performs data validation and error handling.',
      'This appears to be a database query operation with transaction management.',
      'This code implements file processing with error recovery mechanisms.',
      'This is a batch processing routine with checkpoint handling.',
      'This code manages VSAM file operations with proper error checking.',
    ];

    return explanations[Math.floor(Math.random() * explanations.length)];
  }

  async generateSolution(problem: string, category?: string): Promise<string> {
    await this.simulateDelay();

    if (Math.random() < this.config.errorRate) {
      throw new Error('Solution generation failed');
    }

    const solutions: Record<string, string[]> = {
      JCL: [
        '1. Check DD statement syntax and parameters\n2. Verify dataset allocation\n3. Review job step dependencies',
        '1. Validate REGION parameter\n2. Check SPACE allocation\n3. Verify catalog entries',
        '1. Review condition codes\n2. Check step execution order\n3. Verify input datasets',
      ],
      VSAM: [
        '1. Run VSAM VERIFY command\n2. Check file integrity\n3. Rebuild index if needed',
        '1. Review VSAM parameters\n2. Check space allocation\n3. Verify access method',
        '1. Analyze VSAM status codes\n2. Check catalog definition\n3. Review record structure',
      ],
      DB2: [
        '1. Check SQL syntax and logic\n2. Review table structure\n3. Verify access permissions',
        '1. Analyze query execution plan\n2. Add appropriate indexes\n3. Update table statistics',
        '1. Check connection parameters\n2. Review timeout settings\n3. Monitor database performance',
      ],
      default: [
        '1. Analyze error messages and codes\n2. Check system configuration\n3. Review recent changes',
        '1. Verify system resources\n2. Check dependencies\n3. Test in isolation',
        '1. Review documentation\n2. Check best practices\n3. Consult with team',
      ],
    };

    const categorysolutions = solutions[category || 'default'] || solutions.default;
    return categorySolutions[Math.floor(Math.random() * categorySolutions.length)];
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.responseDelay));
    }
  }

  private randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private generateRelevantTags(queryWords: string[], category?: string): string[] {
    const baseTags: Record<string, string[]> = {
      JCL: ['job-control', 'allocation', 'step-execution', 'dataset-management'],
      VSAM: ['file-access', 'catalog', 'record-processing', 'index-management'],
      DB2: ['sql', 'query', 'performance', 'connection', 'transaction'],
      Batch: ['processing', 'abend', 'memory', 'error-handling'],
      default: ['troubleshooting', 'configuration', 'monitoring', 'optimization'],
    };

    const categoryTags = baseTags[category || 'default'] || baseTags.default;
    const keywordTags: string[] = [];

    // Generate tags based on query keywords
    queryWords.forEach(word => {
      if (word === 'error' || word === 'fail') keywordTags.push('error-handling');
      if (word === 'slow' || word === 'performance') keywordTags.push('performance');
      if (word === 'memory') keywordTags.push('memory-management');
      if (word === 'data') keywordTags.push('data-processing');
      if (word === 'file') keywordTags.push('file-handling');
      if (word === 'connection') keywordTags.push('connectivity');
    });

    return [...new Set([...categoryTags.slice(0, 3), ...keywordTags])];
  }

  private inferCategoryFromText(text: string): string {
    const patterns: Record<string, RegExp[]> = {
      JCL: [/job\s+control/i, /dd\s+statement/i, /step\s+\w+/i, /region/i],
      VSAM: [/vsam/i, /ksds/i, /esds/i, /catalog/i, /idcams/i],
      DB2: [/sql/i, /database/i, /table/i, /query/i, /sqlcode/i],
      Batch: [/abend/i, /s0c\d/i, /program/i, /module/i, /cobol/i],
      CICS: [/cics/i, /transaction/i, /terminal/i, /asra/i],
      IMS: [/ims/i, /database/i, /segment/i, /psb/i, /dbd/i],
    };

    for (const [category, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(text))) {
        return category;
      }
    }

    return 'Other';
  }

  private generateReasoning(tagName: string, query: string, context: any): string {
    const reasons = [
      `The tag "${tagName}" is commonly used for similar ${context.category || 'issues'}`,
      `Based on the query "${query}", "${tagName}" appears highly relevant`,
      `This tag has high usage in similar contexts and matches the problem domain`,
      `Pattern matching suggests "${tagName}" is appropriate for this type of entry`,
      `Historical data shows "${tagName}" is effective for similar problems`,
    ];

    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  private generateTagColor(tagName: string): string {
    // Generate consistent colors based on tag name
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E9',
    ];

    const hash = tagName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  }
}

// ===========================
// MOCK DATABASE OPERATIONS
// ===========================

export interface MockDatabaseConfig {
  latency?: number;
  errorRate?: number;
  concurrencyLimit?: number;
}

export class MockDatabaseService {
  private config: Required<MockDatabaseConfig>;
  private activeOperations = 0;
  private data: {
    entries: Map<string, KBEntry>;
    tags: Map<string, Tag>;
    categories: Map<string, CategoryNode>;
  };

  constructor(config: MockDatabaseConfig = {}) {
    this.config = {
      latency: config.latency ?? 10,
      errorRate: config.errorRate ?? 0.01,
      concurrencyLimit: config.concurrencyLimit ?? 100,
    };

    this.data = {
      entries: new Map(),
      tags: new Map(),
      categories: new Map(),
    };
  }

  async bulkInsertEntries(entries: KBEntry[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    await this.checkConcurrencyLimit();
    this.activeOperations++;

    try {
      await this.simulateLatency();

      if (Math.random() < this.config.errorRate) {
        throw new Error('Database bulk insert failed');
      }

      const errors: Array<{ id: string; error: string }> = [];
      let successful = 0;
      let failed = 0;

      for (const entry of entries) {
        try {
          if (this.data.entries.has(entry.id)) {
            errors.push({ id: entry.id, error: 'Entry already exists' });
            failed++;
          } else {
            this.data.entries.set(entry.id, entry);
            successful++;
          }
        } catch (error) {
          errors.push({
            id: entry.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }

      return { successful, failed, errors };
    } finally {
      this.activeOperations--;
    }
  }

  async bulkUpdateTags(
    operations: Array<{
      entryId: string;
      operation: 'add' | 'remove';
      tags: string[];
    }>
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ entryId: string; error: string }>;
  }> {
    await this.checkConcurrencyLimit();
    this.activeOperations++;

    try {
      await this.simulateLatency();

      if (Math.random() < this.config.errorRate) {
        throw new Error('Database bulk tag update failed');
      }

      const errors: Array<{ entryId: string; error: string }> = [];
      let successful = 0;
      let failed = 0;

      for (const op of operations) {
        try {
          const entry = this.data.entries.get(op.entryId);
          if (!entry) {
            errors.push({ entryId: op.entryId, error: 'Entry not found' });
            failed++;
            continue;
          }

          if (op.operation === 'add') {
            const newTags = [...new Set([...entry.tags, ...op.tags])];
            entry.tags = newTags;
          } else {
            entry.tags = entry.tags.filter(tag => !op.tags.includes(tag));
          }

          this.data.entries.set(op.entryId, entry);
          successful++;
        } catch (error) {
          errors.push({
            entryId: op.entryId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }

      return { successful, failed, errors };
    } finally {
      this.activeOperations--;
    }
  }

  async searchEntries(
    query: string,
    options: {
      category?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    entries: KBEntry[];
    totalCount: number;
    hasMore: boolean;
  }> {
    await this.checkConcurrencyLimit();
    this.activeOperations++;

    try {
      await this.simulateLatency();

      if (Math.random() < this.config.errorRate) {
        throw new Error('Search operation failed');
      }

      const queryLower = query.toLowerCase();
      const entries = Array.from(this.data.entries.values());

      let filtered = entries.filter(entry => {
        const textMatch =
          !query ||
          entry.title.toLowerCase().includes(queryLower) ||
          entry.problem.toLowerCase().includes(queryLower) ||
          entry.solution.toLowerCase().includes(queryLower);

        const categoryMatch = !options.category || entry.category === options.category;

        const tagMatch =
          !options.tags?.length || options.tags.some(tag => entry.tags.includes(tag));

        return textMatch && categoryMatch && tagMatch;
      });

      // Sort by relevance (mock scoring)
      filtered.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, query, options);
        const bScore = this.calculateRelevanceScore(b, query, options);
        return bScore - aScore;
      });

      const limit = options.limit || 20;
      const offset = options.offset || 0;
      const paged = filtered.slice(offset, offset + limit);

      return {
        entries: paged,
        totalCount: filtered.length,
        hasMore: offset + limit < filtered.length,
      };
    } finally {
      this.activeOperations--;
    }
  }

  private async checkConcurrencyLimit(): Promise<void> {
    while (this.activeOperations >= this.config.concurrencyLimit) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async simulateLatency(): Promise<void> {
    if (this.config.latency > 0) {
      const delay = this.config.latency + Math.random() * this.config.latency * 0.5;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private calculateRelevanceScore(entry: KBEntry, query: string, options: any): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Title matches get highest score
    if (entry.title.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Problem matches get medium score
    if (entry.problem.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // Solution matches get lower score
    if (entry.solution.toLowerCase().includes(queryLower)) {
      score += 2;
    }

    // Category match bonus
    if (options.category && entry.category === options.category) {
      score += 3;
    }

    // Tag match bonus
    if (options.tags?.some((tag: string) => entry.tags.includes(tag))) {
      score += 5;
    }

    // Usage and success rate bonus
    score += (entry.usage_count || 0) * 0.1;
    score += (entry.success_rate || 0) * 2;

    return score;
  }

  // Utility methods for testing
  seedData(data: { entries?: KBEntry[]; tags?: Tag[]; categories?: CategoryNode[] }): void {
    if (data.entries) {
      data.entries.forEach(entry => this.data.entries.set(entry.id, entry));
    }
    if (data.tags) {
      data.tags.forEach(tag => this.data.tags.set(tag.id, tag));
    }
    if (data.categories) {
      data.categories.forEach(cat => this.data.categories.set(cat.id, cat));
    }
  }

  clearData(): void {
    this.data.entries.clear();
    this.data.tags.clear();
    this.data.categories.clear();
  }

  getStats(): {
    entries: number;
    tags: number;
    categories: number;
    activeOperations: number;
  } {
    return {
      entries: this.data.entries.size,
      tags: this.data.tags.size,
      categories: this.data.categories.size,
      activeOperations: this.activeOperations,
    };
  }
}

// ===========================
// MOCK NETWORK SERVICE
// ===========================

export interface MockNetworkConfig {
  baseDelay?: number;
  timeoutRate?: number;
  networkErrorRate?: number;
}

export class MockNetworkService {
  private config: Required<MockNetworkConfig>;

  constructor(config: MockNetworkConfig = {}) {
    this.config = {
      baseDelay: config.baseDelay ?? 50,
      timeoutRate: config.timeoutRate ?? 0.02,
      networkErrorRate: config.networkErrorRate ?? 0.03,
    };
  }

  async makeRequest<T>(
    endpoint: string,
    data?: any,
    options: { timeout?: number } = {}
  ): Promise<T> {
    const timeout = options.timeout || 5000;

    // Simulate network timeout
    if (Math.random() < this.config.timeoutRate) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );
    }

    // Simulate network error
    if (Math.random() < this.config.networkErrorRate) {
      throw new Error('Network error');
    }

    // Simulate network delay
    const delay = this.config.baseDelay + Math.random() * this.config.baseDelay;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Return mock response based on endpoint
    return this.generateMockResponse(endpoint, data) as T;
  }

  private generateMockResponse(endpoint: string, data?: any): any {
    if (endpoint.includes('/tags/suggest')) {
      return {
        suggestions: [
          { name: 'mock-suggestion-1', confidence: 0.9 },
          { name: 'mock-suggestion-2', confidence: 0.8 },
        ],
      };
    }

    if (endpoint.includes('/entries/search')) {
      return {
        results: [],
        totalCount: 0,
        hasMore: false,
      };
    }

    if (endpoint.includes('/categories/')) {
      return {
        categories: [],
      };
    }

    return { success: true, data: data || {} };
  }
}

// ===========================
// FACTORY FUNCTIONS
// ===========================

export const createMockServices = (
  config: {
    gemini?: MockGeminiConfig;
    database?: MockDatabaseConfig;
    network?: MockNetworkConfig;
  } = {}
) => ({
  gemini: new MockGeminiService(config.gemini),
  database: new MockDatabaseService(config.database),
  network: new MockNetworkService(config.network),
});

export const mockGeminiService = new MockGeminiService();
export const mockDatabaseService = new MockDatabaseService();
export const mockNetworkService = new MockNetworkService();
