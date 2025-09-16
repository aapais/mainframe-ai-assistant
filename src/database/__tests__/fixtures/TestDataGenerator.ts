/**
 * Test Data Generator for Knowledge Base Integration Tests
 * Provides realistic mock data for comprehensive testing scenarios
 */

import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateKBEntry,
  EntryFeedback,
  UsageMetric,
  SearchQuery,
  KBCategory,
  SeverityLevel
} from '../../schemas/KnowledgeBase.schema';

/**
 * Mainframe-specific error codes and problems for realistic test data
 */
const MAINFRAME_ERROR_CODES = [
  'S0C1', 'S0C4', 'S0C7', 'S013', 'S222', 'S806', 'S878',
  'IEF212I', 'IEF404I', 'IEF472I', 'IEF863I', 'IEF285I',
  'WER027A', 'WER108A', 'WER211B', 'WER268A',
  'DSN8023I', 'DSN8001I', 'DSN8004I', 'SQLCODE-803',
  'U0778', 'U1083', 'U3009', 'U4038'
];

const MAINFRAME_COMPONENTS = [
  'VSAM', 'QSAM', 'DB2', 'IMS', 'CICS', 'TSO', 'ISPF', 'SDSF',
  'JES2', 'SMS', 'RACF', 'VTAM', 'TCP/IP', 'FTP', 'MVS'
];

const MAINFRAME_PROBLEM_TEMPLATES = {
  VSAM: [
    'VSAM file status {errorCode} - {component} operation failed',
    'VSAM dataset {datasetName} cannot be accessed with status {errorCode}',
    'VSAM cluster allocation error during {operation}',
    'VSAM index corruption detected in {datasetName}'
  ],
  DB2: [
    'DB2 {errorCode} error during {operation}',
    'Database connection timeout in {component}',
    'SQL performance degradation in {tableName}',
    'DB2 deadlock detected during concurrent access'
  ],
  JCL: [
    'JCL syntax error {errorCode} in {stepName}',
    'Dataset allocation failure in JCL step {stepName}',
    'JCL parameter validation error for {parameter}',
    'Job submission failed with {errorCode}'
  ],
  Batch: [
    'Batch job abend {errorCode} in {programName}',
    'File processing error during {operation}',
    'Data validation failure in batch program {programName}',
    'Resource contention in batch processing'
  ],
  CICS: [
    'CICS transaction {transactionId} abend {errorCode}',
    'CICS resource unavailable during {operation}',
    'CICS storage violation in {programName}',
    'CICS communication failure with {component}'
  ],
  IMS: [
    'IMS database {errorCode} error',
    'IMS transaction timeout during {operation}',
    'IMS segment not found in {databaseName}',
    'IMS program {programName} abend {errorCode}'
  ],
  System: [
    'System resource exhaustion - {resourceType}',
    'Memory allocation failure during {operation}',
    'I/O error accessing {deviceType}',
    'System performance degradation in {component}'
  ],
  Functional: [
    'Business logic error in {functionName}',
    'Data validation failure for {fieldName}',
    'Workflow processing error in {processName}',
    'Integration failure with {externalSystem}'
  ]
};

const SOLUTION_TEMPLATES = {
  diagnostic: [
    'Check system logs for additional error details',
    'Use {tool} to diagnose the root cause',
    'Review {component} configuration settings',
    'Verify {resourceType} availability and status'
  ],
  resolution: [
    'Restart {component} service',
    'Increase {parameter} value in {configFile}',
    'Apply {patchNumber} to resolve known issue',
    'Contact {teamName} for specialized assistance'
  ],
  prevention: [
    'Implement monitoring for {metric}',
    'Schedule regular maintenance for {component}',
    'Add validation checks for {dataType}',
    'Create backup procedures for {resourceType}'
  ]
};

/**
 * Test Data Generator Class
 */
export class TestDataGenerator {
  private readonly faker: typeof faker;

  constructor() {
    this.faker = faker;
    // Set consistent seed for reproducible test data
    this.faker.seed(12345);
  }

  /**
   * Generate a single KB entry with realistic mainframe data
   */
  generateKBEntry(): CreateKBEntry {
    const category = this.faker.helpers.arrayElement(Object.keys(MAINFRAME_PROBLEM_TEMPLATES)) as KBCategory;
    const severity = this.faker.helpers.arrayElement(['critical', 'high', 'medium', 'low']) as SeverityLevel;
    
    const problemTemplate = this.faker.helpers.arrayElement(MAINFRAME_PROBLEM_TEMPLATES[category]);
    const errorCode = this.faker.helpers.arrayElement(MAINFRAME_ERROR_CODES);
    const component = this.faker.helpers.arrayElement(MAINFRAME_COMPONENTS);
    
    // Generate realistic problem description
    const problem = this.interpolateTemplate(problemTemplate, {
      errorCode,
      component,
      datasetName: this.generateDatasetName(),
      operation: this.generateOperation(),
      tableName: this.generateTableName(),
      stepName: this.generateStepName(),
      parameter: this.generateParameter(),
      programName: this.generateProgramName(),
      transactionId: this.generateTransactionId(),
      databaseName: this.generateDatabaseName(),
      resourceType: this.generateResourceType(),
      deviceType: this.generateDeviceType(),
      functionName: this.generateFunctionName(),
      fieldName: this.generateFieldName(),
      processName: this.generateProcessName(),
      externalSystem: this.generateExternalSystem()
    });

    // Generate comprehensive solution
    const diagnosticStep = this.faker.helpers.arrayElement(SOLUTION_TEMPLATES.diagnostic);
    const resolutionStep = this.faker.helpers.arrayElement(SOLUTION_TEMPLATES.resolution);
    const preventionStep = this.faker.helpers.arrayElement(SOLUTION_TEMPLATES.prevention);

    const solution = `Diagnostic Steps:
1. ${this.interpolateTemplate(diagnosticStep, { tool: 'SYSLOG', component, resourceType: 'dataset' })}
2. ${this.interpolateTemplate(diagnosticStep, { tool: 'ISPF', component, resourceType: 'memory' })}

Resolution:
1. ${this.interpolateTemplate(resolutionStep, { 
  component, 
  parameter: 'REGION', 
  configFile: 'JCL', 
  patchNumber: 'PTF' + this.faker.string.numeric(6),
  teamName: 'System Programming'
})}
2. Verify the solution by testing in development environment

Prevention:
1. ${this.interpolateTemplate(preventionStep, { 
  metric: 'resource usage', 
  component, 
  dataType: 'input parameters',
  resourceType: 'system resources'
})}`;

    return {
      title: `${category} ${errorCode} - ${this.generateShortDescription()}`,
      problem: `${problem}

Additional Context:
- Environment: ${this.faker.helpers.arrayElement(['Production', 'Test', 'Development'])}
- Frequency: ${this.faker.helpers.arrayElement(['Sporadic', 'Daily', 'Weekly', 'Monthly'])}
- Impact: ${this.faker.helpers.arrayElement(['High', 'Medium', 'Low'])}
- Users Affected: ${this.faker.number.int({ min: 1, max: 100 })}`,
      
      solution,
      category,
      severity,
      tags: this.generateTags(category, errorCode)
    };
  }

  /**
   * Generate multiple KB entries
   */
  generateKBEntries(count: number): CreateKBEntry[] {
    return Array.from({ length: count }, () => this.generateKBEntry());
  }

  /**
   * Generate realistic entry feedback
   */
  generateFeedback(entryId: string): EntryFeedback {
    const successful = this.faker.datatype.boolean({ probability: 0.75 }); // 75% success rate
    const rating = successful 
      ? this.faker.number.int({ min: 3, max: 5 })
      : this.faker.number.int({ min: 1, max: 3 });

    return {
      entry_id: entryId,
      user_id: this.generateUserId(),
      rating,
      successful,
      comment: this.generateFeedbackComment(successful),
      session_id: this.generateSessionId(),
      resolution_time: this.faker.number.int({ min: 30000, max: 3600000 }) // 30s to 1h
    };
  }

  /**
   * Generate usage metric
   */
  generateUsageMetric(entryId: string): UsageMetric {
    return {
      entry_id: entryId,
      action: this.faker.helpers.arrayElement(['view', 'copy', 'export', 'print', 'share']),
      user_id: this.generateUserId(),
      session_id: this.generateSessionId(),
      metadata: {
        userAgent: this.faker.internet.userAgent(),
        ipAddress: this.faker.internet.ip(),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate search query
   */
  generateSearchQuery(): SearchQuery {
    const queryTypes = ['error_code', 'component', 'problem', 'mixed'];
    const queryType = this.faker.helpers.arrayElement(queryTypes);

    let query: string;
    switch (queryType) {
      case 'error_code':
        query = this.faker.helpers.arrayElement(MAINFRAME_ERROR_CODES);
        break;
      case 'component':
        query = this.faker.helpers.arrayElement(MAINFRAME_COMPONENTS);
        break;
      case 'problem':
        query = this.faker.helpers.arrayElement([
          'connection timeout', 'file not found', 'memory allocation',
          'performance issue', 'syntax error', 'abend', 'deadlock'
        ]);
        break;
      case 'mixed':
      default:
        query = `${this.faker.helpers.arrayElement(MAINFRAME_COMPONENTS)} ${this.faker.helpers.arrayElement(['error', 'issue', 'problem'])}`;
    }

    return {
      query,
      category: this.faker.datatype.boolean({ probability: 0.3 }) 
        ? this.faker.helpers.arrayElement(['VSAM', 'DB2', 'JCL', 'Batch', 'CICS'] as KBCategory[])
        : undefined,
      severity: this.faker.datatype.boolean({ probability: 0.2 })
        ? this.faker.helpers.arrayElement(['critical', 'high'] as SeverityLevel[])
        : undefined,
      tags: this.faker.datatype.boolean({ probability: 0.4 })
        ? this.faker.helpers.arrayElements(['error', 'performance', 'timeout', 'memory', 'file'], 
            this.faker.number.int({ min: 1, max: 3 }))
        : undefined,
      limit: this.faker.number.int({ min: 5, max: 50 }),
      sortBy: this.faker.helpers.arrayElement(['relevance', 'usage', 'created_at']),
      useAI: this.faker.datatype.boolean({ probability: 0.7 })
    };
  }

  /**
   * Generate performance test scenarios
   */
  generatePerformanceTestScenarios(count: number = 10): Array<{
    name: string;
    query: SearchQuery;
    expectedMaxTime: number;
  }> {
    return Array.from({ length: count }, (_, i) => ({
      name: `Performance Test Scenario ${i + 1}`,
      query: this.generateSearchQuery(),
      expectedMaxTime: SEARCH_PERFORMANCE_THRESHOLD
    }));
  }

  /**
   * Generate stress test data
   */
  generateStressTestData(entryCount: number): {
    entries: CreateKBEntry[];
    searches: SearchQuery[];
    feedback: Array<{ entryIndex: number; feedback: Omit<EntryFeedback, 'entry_id'> }>;
  } {
    const entries = this.generateKBEntries(entryCount);
    const searches = Array.from({ length: Math.floor(entryCount / 5) }, () => this.generateSearchQuery());
    const feedback = Array.from({ length: Math.floor(entryCount / 3) }, (_, i) => ({
      entryIndex: this.faker.number.int({ min: 0, max: entryCount - 1 }),
      feedback: {
        user_id: this.generateUserId(),
        rating: this.faker.number.int({ min: 1, max: 5 }),
        successful: this.faker.datatype.boolean({ probability: 0.8 }),
        comment: this.generateFeedbackComment(),
        session_id: this.generateSessionId()
      } as Omit<EntryFeedback, 'entry_id'>
    }));

    return { entries, searches, feedback };
  }

  // Private helper methods

  private interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => variables[key] || match);
  }

  private generateDatasetName(): string {
    const hlq = this.faker.helpers.arrayElement(['SYS1', 'PROD', 'TEST', 'USER']);
    const mlq = this.faker.helpers.arrayElement(['PROCLIB', 'LINKLIB', 'LOAD', 'DATA']);
    const llq = this.faker.helpers.arrayElement(['MEMBER', 'MODULE', 'FILE', 'DATASET']);
    return `${hlq}.${mlq}.${llq}`;
  }

  private generateOperation(): string {
    return this.faker.helpers.arrayElement([
      'READ', 'write', 'update', 'delete', 'allocate', 'deallocate',
      'open', 'close', 'process', 'validate', 'submit', 'execute'
    ]);
  }

  private generateTableName(): string {
    const prefixes = ['EMP', 'CUST', 'ORD', 'PROD', 'INV', 'ACC'];
    const suffixes = ['TAB', 'TBL', 'MST', 'DTL', 'HDR', 'REF'];
    return `${this.faker.helpers.arrayElement(prefixes)}${this.faker.helpers.arrayElement(suffixes)}`;
  }

  private generateStepName(): string {
    return `STEP${this.faker.string.numeric(2)}`;
  }

  private generateParameter(): string {
    return this.faker.helpers.arrayElement([
      'REGION', 'TIME', 'SPACE', 'UNIT', 'DISP', 'DCB', 'LRECL', 'BLKSIZE'
    ]);
  }

  private generateProgramName(): string {
    return `PGM${this.faker.string.alpha({ length: 5, casing: 'upper' })}`;
  }

  private generateTransactionId(): string {
    return this.faker.string.alpha({ length: 4, casing: 'upper' });
  }

  private generateDatabaseName(): string {
    return `DB${this.faker.string.alpha({ length: 6, casing: 'upper' })}`;
  }

  private generateResourceType(): string {
    return this.faker.helpers.arrayElement([
      'memory', 'CPU', 'disk space', 'file handles', 'network connections', 'database connections'
    ]);
  }

  private generateDeviceType(): string {
    return this.faker.helpers.arrayElement(['DASD', 'TAPE', 'PRINTER', 'TERMINAL', 'NETWORK']);
  }

  private generateFunctionName(): string {
    const functions = ['validate', 'process', 'calculate', 'transform', 'format', 'export'];
    return `${this.faker.helpers.arrayElement(functions)}${this.faker.string.alpha({ length: 3, casing: 'upper' })}`;
  }

  private generateFieldName(): string {
    return this.faker.helpers.arrayElement([
      'customer_id', 'account_number', 'transaction_date', 'amount', 'status_code', 'user_id'
    ]);
  }

  private generateProcessName(): string {
    return this.faker.helpers.arrayElement([
      'Daily Batch Process', 'Monthly Reconciliation', 'Customer Onboarding',
      'Payment Processing', 'Report Generation', 'Data Migration'
    ]);
  }

  private generateExternalSystem(): string {
    return this.faker.helpers.arrayElement([
      'Payment Gateway', 'Credit Bureau', 'Core Banking', 'CRM System', 'Data Warehouse'
    ]);
  }

  private generateShortDescription(): string {
    return this.faker.helpers.arrayElement([
      'Resolution Required', 'Error Analysis', 'System Issue', 'Processing Failure',
      'Resource Problem', 'Configuration Error', 'Performance Issue'
    ]);
  }

  private generateTags(category: string, errorCode: string): string[] {
    const baseTags = [category.toLowerCase(), errorCode.toLowerCase()];
    const additionalTags = this.faker.helpers.arrayElements([
      'error', 'system', 'performance', 'memory', 'file', 'network',
      'timeout', 'connection', 'processing', 'batch', 'online',
      'critical', 'urgent', 'production', 'resolution'
    ], this.faker.number.int({ min: 2, max: 6 }));

    return [...baseTags, ...additionalTags];
  }

  private generateUserId(): string {
    return `${this.faker.person.firstName().toLowerCase()}.${this.faker.person.lastName().toLowerCase()}`;
  }

  private generateSessionId(): string {
    return `sess_${this.faker.string.alphanumeric(12)}`;
  }

  private generateFeedbackComment(successful: boolean = true): string {
    const positiveComments = [
      'This solution worked perfectly and resolved the issue quickly.',
      'Excellent documentation, followed the steps exactly as described.',
      'Very helpful solution, saved us a lot of troubleshooting time.',
      'Clear and concise instructions, issue resolved on first attempt.',
      'Great solution, will bookmark this for future reference.'
    ];

    const negativeComments = [
      'Solution did not work in our environment, still investigating.',
      'Steps were unclear, need more detailed explanation.',
      'Partial solution, resolved some symptoms but root cause remains.',
      'Could not reproduce the resolution steps as described.',
      'Solution worked temporarily but issue reoccurred.'
    ];

    return this.faker.helpers.arrayElement(successful ? positiveComments : negativeComments);
  }
}

// Constants for external use
export const SEARCH_PERFORMANCE_THRESHOLD = 1000; // 1 second
export const BULK_OPERATION_THRESHOLD = 5000; // 5 seconds
export const DEFAULT_TEST_DATA_SIZE = 50;