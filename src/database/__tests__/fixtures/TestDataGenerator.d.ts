import {
  CreateKBEntry,
  EntryFeedback,
  UsageMetric,
  SearchQuery,
} from '../../schemas/KnowledgeBase.schema';
export declare class TestDataGenerator {
  private readonly faker;
  constructor();
  generateKBEntry(): CreateKBEntry;
  generateKBEntries(count: number): CreateKBEntry[];
  generateFeedback(entryId: string): EntryFeedback;
  generateUsageMetric(entryId: string): UsageMetric;
  generateSearchQuery(): SearchQuery;
  generatePerformanceTestScenarios(count?: number): Array<{
    name: string;
    query: SearchQuery;
    expectedMaxTime: number;
  }>;
  generateStressTestData(entryCount: number): {
    entries: CreateKBEntry[];
    searches: SearchQuery[];
    feedback: Array<{
      entryIndex: number;
      feedback: Omit<EntryFeedback, 'entry_id'>;
    }>;
  };
  private interpolateTemplate;
  private generateDatasetName;
  private generateOperation;
  private generateTableName;
  private generateStepName;
  private generateParameter;
  private generateProgramName;
  private generateTransactionId;
  private generateDatabaseName;
  private generateResourceType;
  private generateDeviceType;
  private generateFunctionName;
  private generateFieldName;
  private generateProcessName;
  private generateExternalSystem;
  private generateShortDescription;
  private generateTags;
  private generateUserId;
  private generateSessionId;
  private generateFeedbackComment;
}
export declare const SEARCH_PERFORMANCE_THRESHOLD = 1000;
export declare const BULK_OPERATION_THRESHOLD = 5000;
export declare const DEFAULT_TEST_DATA_SIZE = 50;
//# sourceMappingURL=TestDataGenerator.d.ts.map
