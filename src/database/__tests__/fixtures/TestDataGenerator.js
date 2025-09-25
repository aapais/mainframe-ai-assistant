'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DEFAULT_TEST_DATA_SIZE =
  exports.BULK_OPERATION_THRESHOLD =
  exports.SEARCH_PERFORMANCE_THRESHOLD =
  exports.TestDataGenerator =
    void 0;
const faker_1 = require('@faker-js/faker');
const MAINFRAME_ERROR_CODES = [
  'S0C1',
  'S0C4',
  'S0C7',
  'S013',
  'S222',
  'S806',
  'S878',
  'IEF212I',
  'IEF404I',
  'IEF472I',
  'IEF863I',
  'IEF285I',
  'WER027A',
  'WER108A',
  'WER211B',
  'WER268A',
  'DSN8023I',
  'DSN8001I',
  'DSN8004I',
  'SQLCODE-803',
  'U0778',
  'U1083',
  'U3009',
  'U4038',
];
const MAINFRAME_COMPONENTS = [
  'VSAM',
  'QSAM',
  'DB2',
  'IMS',
  'CICS',
  'TSO',
  'ISPF',
  'SDSF',
  'JES2',
  'SMS',
  'RACF',
  'VTAM',
  'TCP/IP',
  'FTP',
  'MVS',
];
const MAINFRAME_PROBLEM_TEMPLATES = {
  VSAM: [
    'VSAM file status {errorCode} - {component} operation failed',
    'VSAM dataset {datasetName} cannot be accessed with status {errorCode}',
    'VSAM cluster allocation error during {operation}',
    'VSAM index corruption detected in {datasetName}',
  ],
  DB2: [
    'DB2 {errorCode} error during {operation}',
    'Database connection timeout in {component}',
    'SQL performance degradation in {tableName}',
    'DB2 deadlock detected during concurrent access',
  ],
  JCL: [
    'JCL syntax error {errorCode} in {stepName}',
    'Dataset allocation failure in JCL step {stepName}',
    'JCL parameter validation error for {parameter}',
    'Job submission failed with {errorCode}',
  ],
  Batch: [
    'Batch job abend {errorCode} in {programName}',
    'File processing error during {operation}',
    'Data validation failure in batch program {programName}',
    'Resource contention in batch processing',
  ],
  CICS: [
    'CICS transaction {transactionId} abend {errorCode}',
    'CICS resource unavailable during {operation}',
    'CICS storage violation in {programName}',
    'CICS communication failure with {component}',
  ],
  IMS: [
    'IMS database {errorCode} error',
    'IMS transaction timeout during {operation}',
    'IMS segment not found in {databaseName}',
    'IMS program {programName} abend {errorCode}',
  ],
  System: [
    'System resource exhaustion - {resourceType}',
    'Memory allocation failure during {operation}',
    'I/O error accessing {deviceType}',
    'System performance degradation in {component}',
  ],
  Functional: [
    'Business logic error in {functionName}',
    'Data validation failure for {fieldName}',
    'Workflow processing error in {processName}',
    'Integration failure with {externalSystem}',
  ],
};
const SOLUTION_TEMPLATES = {
  diagnostic: [
    'Check system logs for additional error details',
    'Use {tool} to diagnose the root cause',
    'Review {component} configuration settings',
    'Verify {resourceType} availability and status',
  ],
  resolution: [
    'Restart {component} service',
    'Increase {parameter} value in {configFile}',
    'Apply {patchNumber} to resolve known issue',
    'Contact {teamName} for specialized assistance',
  ],
  prevention: [
    'Implement monitoring for {metric}',
    'Schedule regular maintenance for {component}',
    'Add validation checks for {dataType}',
    'Create backup procedures for {resourceType}',
  ],
};
class TestDataGenerator {
  faker;
  constructor() {
    this.faker = faker_1.faker;
    this.faker.seed(12345);
  }
  generateKBEntry() {
    const category = this.faker.helpers.arrayElement(Object.keys(MAINFRAME_PROBLEM_TEMPLATES));
    const severity = this.faker.helpers.arrayElement(['critical', 'high', 'medium', 'low']);
    const problemTemplate = this.faker.helpers.arrayElement(MAINFRAME_PROBLEM_TEMPLATES[category]);
    const errorCode = this.faker.helpers.arrayElement(MAINFRAME_ERROR_CODES);
    const component = this.faker.helpers.arrayElement(MAINFRAME_COMPONENTS);
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
      externalSystem: this.generateExternalSystem(),
    });
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
      patchNumber: `PTF${this.faker.string.numeric(6)}`,
      teamName: 'System Programming',
    })}
2. Verify the solution by testing in development environment

Prevention:
1. ${this.interpolateTemplate(preventionStep, {
      metric: 'resource usage',
      component,
      dataType: 'input parameters',
      resourceType: 'system resources',
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
      tags: this.generateTags(category, errorCode),
    };
  }
  generateKBEntries(count) {
    return Array.from({ length: count }, () => this.generateKBEntry());
  }
  generateFeedback(entryId) {
    const successful = this.faker.datatype.boolean({ probability: 0.75 });
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
      resolution_time: this.faker.number.int({ min: 30000, max: 3600000 }),
    };
  }
  generateUsageMetric(entryId) {
    return {
      entry_id: entryId,
      action: this.faker.helpers.arrayElement(['view', 'copy', 'export', 'print', 'share']),
      user_id: this.generateUserId(),
      session_id: this.generateSessionId(),
      metadata: {
        userAgent: this.faker.internet.userAgent(),
        ipAddress: this.faker.internet.ip(),
        timestamp: new Date().toISOString(),
      },
    };
  }
  generateSearchQuery() {
    const queryTypes = ['error_code', 'component', 'problem', 'mixed'];
    const queryType = this.faker.helpers.arrayElement(queryTypes);
    let query;
    switch (queryType) {
      case 'error_code':
        query = this.faker.helpers.arrayElement(MAINFRAME_ERROR_CODES);
        break;
      case 'component':
        query = this.faker.helpers.arrayElement(MAINFRAME_COMPONENTS);
        break;
      case 'problem':
        query = this.faker.helpers.arrayElement([
          'connection timeout',
          'file not found',
          'memory allocation',
          'performance issue',
          'syntax error',
          'abend',
          'deadlock',
        ]);
        break;
      case 'mixed':
      default:
        query = `${this.faker.helpers.arrayElement(MAINFRAME_COMPONENTS)} ${this.faker.helpers.arrayElement(['error', 'issue', 'problem'])}`;
    }
    return {
      query,
      category: this.faker.datatype.boolean({ probability: 0.3 })
        ? this.faker.helpers.arrayElement(['VSAM', 'DB2', 'JCL', 'Batch', 'CICS'])
        : undefined,
      severity: this.faker.datatype.boolean({ probability: 0.2 })
        ? this.faker.helpers.arrayElement(['critical', 'high'])
        : undefined,
      tags: this.faker.datatype.boolean({ probability: 0.4 })
        ? this.faker.helpers.arrayElements(
            ['error', 'performance', 'timeout', 'memory', 'file'],
            this.faker.number.int({ min: 1, max: 3 })
          )
        : undefined,
      limit: this.faker.number.int({ min: 5, max: 50 }),
      sortBy: this.faker.helpers.arrayElement(['relevance', 'usage', 'created_at']),
      useAI: this.faker.datatype.boolean({ probability: 0.7 }),
    };
  }
  generatePerformanceTestScenarios(count = 10) {
    return Array.from({ length: count }, (_, i) => ({
      name: `Performance Test Scenario ${i + 1}`,
      query: this.generateSearchQuery(),
      expectedMaxTime: exports.SEARCH_PERFORMANCE_THRESHOLD,
    }));
  }
  generateStressTestData(entryCount) {
    const entries = this.generateKBEntries(entryCount);
    const searches = Array.from({ length: Math.floor(entryCount / 5) }, () =>
      this.generateSearchQuery()
    );
    const feedback = Array.from({ length: Math.floor(entryCount / 3) }, (_, i) => ({
      entryIndex: this.faker.number.int({ min: 0, max: entryCount - 1 }),
      feedback: {
        user_id: this.generateUserId(),
        rating: this.faker.number.int({ min: 1, max: 5 }),
        successful: this.faker.datatype.boolean({ probability: 0.8 }),
        comment: this.generateFeedbackComment(),
        session_id: this.generateSessionId(),
      },
    }));
    return { entries, searches, feedback };
  }
  interpolateTemplate(template, variables) {
    return template.replace(/\{(\w+)\}/g, (match, key) => variables[key] || match);
  }
  generateDatasetName() {
    const hlq = this.faker.helpers.arrayElement(['SYS1', 'PROD', 'TEST', 'USER']);
    const mlq = this.faker.helpers.arrayElement(['PROCLIB', 'LINKLIB', 'LOAD', 'DATA']);
    const llq = this.faker.helpers.arrayElement(['MEMBER', 'MODULE', 'FILE', 'DATASET']);
    return `${hlq}.${mlq}.${llq}`;
  }
  generateOperation() {
    return this.faker.helpers.arrayElement([
      'READ',
      'write',
      'update',
      'delete',
      'allocate',
      'deallocate',
      'open',
      'close',
      'process',
      'validate',
      'submit',
      'execute',
    ]);
  }
  generateTableName() {
    const prefixes = ['EMP', 'CUST', 'ORD', 'PROD', 'INV', 'ACC'];
    const suffixes = ['TAB', 'TBL', 'MST', 'DTL', 'HDR', 'REF'];
    return `${this.faker.helpers.arrayElement(prefixes)}${this.faker.helpers.arrayElement(suffixes)}`;
  }
  generateStepName() {
    return `STEP${this.faker.string.numeric(2)}`;
  }
  generateParameter() {
    return this.faker.helpers.arrayElement([
      'REGION',
      'TIME',
      'SPACE',
      'UNIT',
      'DISP',
      'DCB',
      'LRECL',
      'BLKSIZE',
    ]);
  }
  generateProgramName() {
    return `PGM${this.faker.string.alpha({ length: 5, casing: 'upper' })}`;
  }
  generateTransactionId() {
    return this.faker.string.alpha({ length: 4, casing: 'upper' });
  }
  generateDatabaseName() {
    return `DB${this.faker.string.alpha({ length: 6, casing: 'upper' })}`;
  }
  generateResourceType() {
    return this.faker.helpers.arrayElement([
      'memory',
      'CPU',
      'disk space',
      'file handles',
      'network connections',
      'database connections',
    ]);
  }
  generateDeviceType() {
    return this.faker.helpers.arrayElement(['DASD', 'TAPE', 'PRINTER', 'TERMINAL', 'NETWORK']);
  }
  generateFunctionName() {
    const functions = ['validate', 'process', 'calculate', 'transform', 'format', 'export'];
    return `${this.faker.helpers.arrayElement(functions)}${this.faker.string.alpha({ length: 3, casing: 'upper' })}`;
  }
  generateFieldName() {
    return this.faker.helpers.arrayElement([
      'customer_id',
      'account_number',
      'transaction_date',
      'amount',
      'status_code',
      'user_id',
    ]);
  }
  generateProcessName() {
    return this.faker.helpers.arrayElement([
      'Daily Batch Process',
      'Monthly Reconciliation',
      'Customer Onboarding',
      'Payment Processing',
      'Report Generation',
      'Data Migration',
    ]);
  }
  generateExternalSystem() {
    return this.faker.helpers.arrayElement([
      'Payment Gateway',
      'Credit Bureau',
      'Core Banking',
      'CRM System',
      'Data Warehouse',
    ]);
  }
  generateShortDescription() {
    return this.faker.helpers.arrayElement([
      'Resolution Required',
      'Error Analysis',
      'System Issue',
      'Processing Failure',
      'Resource Problem',
      'Configuration Error',
      'Performance Issue',
    ]);
  }
  generateTags(category, errorCode) {
    const baseTags = [category.toLowerCase(), errorCode.toLowerCase()];
    const additionalTags = this.faker.helpers.arrayElements(
      [
        'error',
        'system',
        'performance',
        'memory',
        'file',
        'network',
        'timeout',
        'connection',
        'processing',
        'batch',
        'online',
        'critical',
        'urgent',
        'production',
        'resolution',
      ],
      this.faker.number.int({ min: 2, max: 6 })
    );
    return [...baseTags, ...additionalTags];
  }
  generateUserId() {
    return `${this.faker.person.firstName().toLowerCase()}.${this.faker.person.lastName().toLowerCase()}`;
  }
  generateSessionId() {
    return `sess_${this.faker.string.alphanumeric(12)}`;
  }
  generateFeedbackComment(successful = true) {
    const positiveComments = [
      'This solution worked perfectly and resolved the issue quickly.',
      'Excellent documentation, followed the steps exactly as described.',
      'Very helpful solution, saved us a lot of troubleshooting time.',
      'Clear and concise instructions, issue resolved on first attempt.',
      'Great solution, will bookmark this for future reference.',
    ];
    const negativeComments = [
      'Solution did not work in our environment, still investigating.',
      'Steps were unclear, need more detailed explanation.',
      'Partial solution, resolved some symptoms but root cause remains.',
      'Could not reproduce the resolution steps as described.',
      'Solution worked temporarily but issue reoccurred.',
    ];
    return this.faker.helpers.arrayElement(successful ? positiveComments : negativeComments);
  }
}
exports.TestDataGenerator = TestDataGenerator;
exports.SEARCH_PERFORMANCE_THRESHOLD = 1000;
exports.BULK_OPERATION_THRESHOLD = 5000;
exports.DEFAULT_TEST_DATA_SIZE = 50;
//# sourceMappingURL=TestDataGenerator.js.map
