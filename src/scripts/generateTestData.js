#!/usr/bin/env node

/**
 * Comprehensive Test Data Generator for MVP1 v8 Application
 *
 * Generates realistic test data for:
 * - KB entries (50+ mainframe-specific entries)
 * - Search history (100+ searches)
 * - Usage metrics (statistics for entries)
 * - AI authorization decisions (50+ decisions)
 * - Cost tracking data (last 30 days)
 * - Operation logs (200+ operations)
 * - User preferences
 * - Tags and relations between entries
 *
 * Features:
 * - Realistic mainframe terminology and scenarios
 * - Professional error messages and solutions
 * - Cost transparency and authorization workflows
 * - Idempotent execution (safe to run multiple times)
 * - Progress indicators and summary reports
 * - Configurable data volumes
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Configuration
const CONFIG = {
  volumes: {
    kb_entries: 75,
    search_history: 150,
    usage_metrics: 500,
    ai_authorization_log: 80,
    ai_cost_tracking: 120,
    operation_logs: 250,
    kb_relations: 40,
    tags_per_entry: 4,
  },

  // Cost simulation parameters
  costs: {
    min_operation: 0.001,
    max_operation: 0.5,
    avg_daily_budget: 2.5,
    high_cost_threshold: 0.1,
  },

  // Time simulation (last 90 days)
  timeRange: {
    days: 90,
    peakHours: [9, 10, 11, 14, 15, 16], // Business hours
    peakDays: [1, 2, 3, 4, 5], // Weekdays
  },
};

// Mainframe-specific data pools
const MAINFRAME_DATA = {
  categories: [
    'JCL',
    'VSAM',
    'DB2',
    'Batch',
    'Functional',
    'CICS',
    'IMS',
    'Security',
    'Network',
    'Other',
  ],

  subcategories: {
    JCL: ['Job Control', 'Data Definition', 'Procedure', 'Condition Code', 'Step Processing'],
    VSAM: ['KSDS', 'ESDS', 'RRDS', 'Linear', 'Catalog Management'],
    DB2: ['SQL Errors', 'Binding', 'Locking', 'Performance', 'Utilities'],
    Batch: ['ABEND', 'Resource Issues', 'Scheduling', 'Data Processing', 'File Handling'],
    CICS: ['Transaction', 'Program', 'File Control', 'Terminal', 'System'],
    IMS: ['Database', 'Message Processing', 'Control Block', 'Recovery', 'Performance'],
  },

  jclTypes: ['Job', 'Procedure', 'Include', 'Catalog Procedure', 'In-Stream Procedure'],
  cobolVersions: ['Enterprise COBOL 6.3', 'Enterprise COBOL 6.4', 'COBOL/370', 'VS COBOL II'],
  systemComponents: ['MVS', 'z/OS', 'ISPF', 'TSO', 'SDSF', 'RACF', 'CA-7', 'Control-M'],

  errorCodes: [
    'S0C4',
    'S0C7',
    'S806',
    'S822',
    'S013',
    'S217',
    'S37',
    'SB37',
    'SD37',
    'IEF450I',
    'IEF472I',
    'IEF285I',
    'IGD17101I',
    'IKJ56650I',
    'ICH408I',
  ],

  searchQueries: {
    functional: [
      'ABEND S0C4 in COBOL program',
      'JCL job failing with condition code 12',
      'DB2 bind error SQLCODE -818',
      'VSAM file status 93',
      'CICS transaction timeout',
      'Batch job running out of space',
      'File allocation error in JCL',
      'COBOL compilation error',
      'Dataset not found error',
      'Security violation RACF',
      'IMS database deadlock',
      'ISPF edit macro error',
      'TSO allocation error',
      'SDSF display issue',
      'Control-M job scheduling',
      'CA-7 workload automation',
      'z/OS system error',
      'MVS storage management',
      'Dataset concatenation issue',
      'Sort utility SYNCSORT error',
    ],
    technical: [
      'S0C4 protection exception',
      'SQLCODE -811 multiple rows',
      'IEF450I step not executed',
      'IGD17101I dataset not found',
      'VSAM KSDS split failure',
      'CICS DFHAC2206 program not found',
      'JCL DD statement error',
      'COBOL move statement issue',
      'DB2 package not found',
      'RACF authority check failed',
      'IMS PSB schedule failure',
      'ISPF library allocation',
      'TSO READY prompt issue',
      'SDSF command error',
      'Allocation recovery routine',
      'SMF record processing',
      'VTOC space allocation',
      'Catalog search order',
      'GDG generation limit',
      'Volume mount timeout',
    ],
  },

  aiOperationTypes: ['semantic_search', 'explain_error', 'analyze_entry', 'suggest_similar'],

  operationTypes: [
    'search',
    'view_entry',
    'edit_entry',
    'create_entry',
    'delete_entry',
    'export_data',
    'import_data',
    'backup_database',
    'ai_query',
    'bulk_update',
  ],
};

// Sample KB entries with realistic mainframe problems and solutions
const SAMPLE_KB_ENTRIES = [
  {
    title: 'S0C4 ABEND in COBOL Program During Array Processing',
    problem:
      'Program terminates with S0C4 protection exception when processing large arrays. Error occurs in PERFORM loop accessing table elements beyond declared size.',
    solution: `1. Check OCCURS clause in data division for correct array size
2. Verify subscript values in PERFORM loop don't exceed array bounds
3. Add boundary checking: IF WS-INDEX <= WS-TABLE-SIZE THEN...
4. Use SEARCH ALL for table lookups instead of subscripting
5. Compile with SSRANGE option to detect runtime subscript errors

Example fix:
PERFORM VARYING WS-INDEX FROM 1 BY 1
  UNTIL WS-INDEX > WS-TABLE-SIZE
    IF WS-INDEX <= WS-MAX-ENTRIES
      MOVE WS-DATA(WS-INDEX) TO WS-OUTPUT-REC
    END-IF
END-PERFORM`,
    category: 'Functional',
    subcategory: 'ABEND',
    severity: 'high',
    jcl_type: null,
    cobol_version: 'Enterprise COBOL 6.3',
    system_component: 'MVS',
    error_codes: ['S0C4'],
  },
  {
    title: 'JCL Job Fails with IEF450I Step Not Executed CC=FLUSH',
    problem:
      'Batch job terminates early with IEF450I message. Subsequent job steps are flushed and not executed.',
    solution: `1. Check previous step return codes - step failure causes flush
2. Review COND parameter on JOB or EXEC statements
3. Verify IF-THEN-ELSE logic in JCL is correct
4. Check for missing DD statements causing JCL error
5. Examine step dependencies and execution order

JCL fix example:
//STEP1 EXEC PGM=MYPROG
//STEP2 EXEC PGM=NEXTPROG,COND=(4,LT)
// Change to: COND=(8,LT) to allow execution with RC=4`,
    category: 'JCL',
    subcategory: 'Step Processing',
    severity: 'medium',
    jcl_type: 'Job',
    system_component: 'MVS',
    error_codes: ['IEF450I'],
  },
  {
    title: 'DB2 SQLCODE -818 Plan/Package Timestamp Mismatch',
    problem:
      'DB2 application fails with SQLCODE -818. Program was recompiled but DB2 package not rebound, causing timestamp mismatch.',
    solution: `1. Rebind the DB2 package after program recompilation
2. Use REBIND PACKAGE command with current DBRM
3. Verify DBRM library contains latest compiled version
4. Check bind options match original package
5. Refresh plan if using packages within plans

Commands:
REBIND PACKAGE(collection.package)
REBIND PLAN(planname) VALIDATE(BIND)
DSN SYSTEM(DB2T) REBIND PACKAGE(MYPACK) ISOLATION(CS)`,
    category: 'DB2',
    subcategory: 'Binding',
    severity: 'high',
    system_component: 'DB2',
    error_codes: ['-818'],
  },
  {
    title: 'VSAM File Status 93 - Record Not Available',
    problem:
      'COBOL program receives file status 93 when attempting to read VSAM KSDS file. Record exists but appears unavailable for processing.',
    solution: `1. Check if record is locked by another process
2. Verify VSAM cluster is properly opened for INPUT/OUTPUT
3. Review READ statement - use READ...INTO vs READ...KEY
4. Check for duplicate key issues in KSDS
5. Verify record key matches exact VSAM key structure
6. Use IDCAMS LISTCAT to check cluster status

COBOL code check:
READ VSAM-FILE INTO WS-RECORD
  KEY IS WS-SEARCH-KEY
  INVALID KEY
    DISPLAY 'RECORD NOT FOUND: ' WS-SEARCH-KEY
    SET FILE-STATUS-93 TO TRUE`,
    category: 'VSAM',
    subcategory: 'KSDS',
    severity: 'medium',
    system_component: 'MVS',
    error_codes: ['93'],
  },
];

class TestDataGenerator {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.stats = {
      created: 0,
      errors: 0,
      startTime: Date.now(),
    };
  }

  // Initialize database connection
  initDatabase() {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      console.log(`✅ Connected to database: ${this.dbPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to database:`, error.message);
      return false;
    }
  }

  // Check if database schema exists, create if needed
  async ensureSchema() {
    try {
      // Check if main tables exist
      const tablesExist = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='table' AND name IN ('kb_entries', 'ai_cost_tracking')
      `
        )
        .get();

      if (tablesExist.count < 2) {
        console.log('📋 Database schema incomplete. Please run schema migration first.');
        console.log('Run: npm run db:migrate or apply schema.sql');
        return false;
      }

      console.log('✅ Database schema verified');
      return true;
    } catch (error) {
      console.error(`❌ Schema verification failed:`, error.message);
      return false;
    }
  }

  // Clear existing test data (optional)
  clearTestData(confirm = false) {
    if (!confirm) {
      console.log('🔄 Skipping data cleanup (use --clear flag to remove existing data)');
      return;
    }

    console.log('🧹 Clearing existing test data...');

    const tables = [
      'ai_cost_tracking',
      'ai_authorization_log',
      'operation_logs',
      'usage_metrics',
      'search_history',
      'kb_relations',
      'kb_tags',
      'dashboard_metrics',
      'kb_entries',
    ];

    const transaction = this.db.transaction(() => {
      for (const table of tables) {
        try {
          this.db.prepare(`DELETE FROM ${table}`).run();
          console.log(`  ✅ Cleared ${table}`);
        } catch (error) {
          console.log(`  ⚠️  Table ${table} might not exist: ${error.message}`);
        }
      }
    });

    transaction();
    console.log('✅ Test data cleared');
  }

  // Generate random timestamp within range
  randomTimestamp(daysAgo = 90) {
    const now = Date.now();
    const msAgo = daysAgo * 24 * 60 * 60 * 1000;
    const randomTime = now - Math.random() * msAgo;
    return new Date(randomTime).toISOString();
  }

  // Generate weighted random timestamp (more recent = higher probability)
  weightedTimestamp(daysAgo = 90, recentWeight = 0.7) {
    const random = Math.random();
    let daysBack;

    if (random < recentWeight) {
      // Recent data (last 30 days)
      daysBack = Math.random() * 30;
    } else {
      // Older data (30-90 days)
      daysBack = 30 + Math.random() * (daysAgo - 30);
    }

    const now = Date.now();
    const msAgo = daysBack * 24 * 60 * 60 * 1000;
    return new Date(now - msAgo).toISOString();
  }

  // Generate realistic cost based on operation type
  generateOperationCost(operationType) {
    const baseCosts = {
      semantic_search: { min: 0.002, max: 0.015 },
      explain_error: { min: 0.008, max: 0.045 },
      analyze_entry: { min: 0.005, max: 0.025 },
      suggest_similar: { min: 0.003, max: 0.018 },
    };

    const range = baseCosts[operationType] || { min: 0.001, max: 0.01 };
    return Math.random() * (range.max - range.min) + range.min;
  }

  // Generate UUID
  generateUUID() {
    return crypto.randomUUID();
  }

  // Generate realistic KB entries
  generateKBEntries() {
    console.log(`📚 Generating ${CONFIG.volumes.kb_entries} KB entries...`);

    const insert = this.db.prepare(`
      INSERT INTO kb_entries (
        id, title, problem, solution, category, subcategory, severity,
        jcl_type, cobol_version, system_component, error_codes,
        created_at, updated_at, usage_count, success_count, failure_count,
        last_used, relevance_score, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      // Insert predefined sample entries
      for (const entry of SAMPLE_KB_ENTRIES) {
        const id = this.generateUUID();
        const createdAt = this.randomTimestamp(60);
        const usageCount = Math.floor(Math.random() * 100);
        const successCount = Math.floor(usageCount * (0.6 + Math.random() * 0.3));
        const failureCount = usageCount - successCount;

        insert.run(
          id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          entry.subcategory,
          entry.severity,
          entry.jcl_type,
          entry.cobol_version,
          entry.system_component,
          JSON.stringify(entry.error_codes),
          createdAt,
          createdAt,
          usageCount,
          successCount,
          failureCount,
          usageCount > 0 ? this.weightedTimestamp(30) : null,
          0.7 + Math.random() * 0.3,
          JSON.stringify({ generated: false, quality_verified: true })
        );

        this.stats.created++;
      }

      // Generate additional entries
      const remaining = CONFIG.volumes.kb_entries - SAMPLE_KB_ENTRIES.length;
      for (let i = 0; i < remaining; i++) {
        const category =
          MAINFRAME_DATA.categories[Math.floor(Math.random() * MAINFRAME_DATA.categories.length)];
        const subcategories = MAINFRAME_DATA.subcategories[category] || ['General'];
        const subcategory = subcategories[Math.floor(Math.random() * subcategories.length)];

        const id = this.generateUUID();
        const createdAt = this.randomTimestamp(80);
        const usageCount = Math.floor(Math.random() * 50);
        const successCount = Math.floor(usageCount * (0.5 + Math.random() * 0.4));
        const failureCount = usageCount - successCount;

        const errorCode =
          MAINFRAME_DATA.errorCodes[Math.floor(Math.random() * MAINFRAME_DATA.errorCodes.length)];

        insert.run(
          id,
          `${category} ${subcategory} Issue #${i + 1}`,
          `Sample ${category.toLowerCase()} problem related to ${subcategory.toLowerCase()} with error ${errorCode}`,
          `Standard resolution procedure for ${category} ${subcategory} issues. Check logs, verify configuration, restart components as needed.`,
          category,
          subcategory,
          ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
          category === 'JCL'
            ? MAINFRAME_DATA.jclTypes[Math.floor(Math.random() * MAINFRAME_DATA.jclTypes.length)]
            : null,
          ['Functional', 'COBOL'].includes(category)
            ? MAINFRAME_DATA.cobolVersions[
                Math.floor(Math.random() * MAINFRAME_DATA.cobolVersions.length)
              ]
            : null,
          MAINFRAME_DATA.systemComponents[
            Math.floor(Math.random() * MAINFRAME_DATA.systemComponents.length)
          ],
          JSON.stringify([errorCode]),
          createdAt,
          createdAt,
          usageCount,
          successCount,
          failureCount,
          usageCount > 0 ? this.weightedTimestamp(30) : null,
          0.4 + Math.random() * 0.6,
          JSON.stringify({ generated: true, sample_data: true })
        );

        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Created ${CONFIG.volumes.kb_entries} KB entries`);
  }

  // Generate tags for KB entries
  generateKBTags() {
    console.log('🏷️  Generating KB tags...');

    const entries = this.db.prepare('SELECT id, category, subcategory FROM kb_entries').all();
    const insert = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');

    const commonTags = {
      JCL: ['batch', 'job-control', 'mvs', 'scheduling', 'abend'],
      VSAM: ['file-system', 'ksds', 'data-management', 'catalog', 'cluster'],
      DB2: ['database', 'sql', 'binding', 'performance', 'locking'],
      CICS: ['transaction', 'online', 'terminal', 'program', 'middleware'],
      Batch: ['background', 'processing', 'scheduling', 'automation', 'data'],
      Functional: ['business-logic', 'cobol', 'application', 'processing', 'error-handling'],
    };

    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        const categoryTags = commonTags[entry.category] || ['mainframe', 'system'];
        const numTags = Math.min(CONFIG.volumes.tags_per_entry, categoryTags.length);
        const selectedTags = categoryTags.sort(() => 0.5 - Math.random()).slice(0, numTags);

        for (const tag of selectedTags) {
          try {
            insert.run(entry.id, tag);
            this.stats.created++;
          } catch (error) {
            // Ignore duplicate tag errors
          }
        }

        // Add subcategory as tag if different
        if (entry.subcategory && entry.subcategory !== 'General') {
          try {
            insert.run(entry.id, entry.subcategory.toLowerCase().replace(/\s+/g, '-'));
            this.stats.created++;
          } catch (error) {
            // Ignore duplicate tag errors
          }
        }
      }
    });

    transaction();
    console.log(`  ✅ Generated tags for all entries`);
  }

  // Generate KB relations
  generateKBRelations() {
    console.log('🔗 Generating KB entry relations...');

    const entries = this.db.prepare('SELECT id, category FROM kb_entries ORDER BY RANDOM()').all();
    const insert = this.db.prepare(`
      INSERT INTO kb_relations (source_id, target_id, relation_type, strength)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < Math.min(CONFIG.volumes.kb_relations, entries.length - 1); i++) {
        const sourceEntry = entries[i];

        // Find related entry (prefer same category)
        const relatedEntries = entries.filter(
          e =>
            e.id !== sourceEntry.id && (e.category === sourceEntry.category || Math.random() < 0.3)
        );

        if (relatedEntries.length > 0) {
          const targetEntry = relatedEntries[Math.floor(Math.random() * relatedEntries.length)];
          const relationType = ['related', 'duplicate', 'prerequisite'][
            Math.floor(Math.random() * 3)
          ];
          const strength = relationType === 'duplicate' ? 0.9 : 0.4 + Math.random() * 0.5;

          try {
            insert.run(sourceEntry.id, targetEntry.id, relationType, strength);
            this.stats.created++;
          } catch (error) {
            // Ignore duplicate relation errors
          }
        }
      }
    });

    transaction();
    console.log(`  ✅ Generated ${CONFIG.volumes.kb_relations} KB relations`);
  }

  // Generate search history
  generateSearchHistory() {
    console.log(`🔍 Generating ${CONFIG.volumes.search_history} search history entries...`);

    const entries = this.db.prepare('SELECT id, category FROM kb_entries').all();
    const insert = this.db.prepare(`
      INSERT INTO search_history (
        query, query_type, results_count, selected_entry_id,
        search_time_ms, timestamp, user_id, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const allQueries = [
      ...MAINFRAME_DATA.searchQueries.functional,
      ...MAINFRAME_DATA.searchQueries.technical,
    ];

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < CONFIG.volumes.search_history; i++) {
        const query = allQueries[Math.floor(Math.random() * allQueries.length)];
        const queryType = Math.random() < 0.7 ? 'text' : Math.random() < 0.8 ? 'category' : 'ai';
        const resultsCount = Math.floor(Math.random() * 20) + 1;
        const selectedEntry =
          Math.random() < 0.6 ? entries[Math.floor(Math.random() * entries.length)] : null;
        const searchTime = Math.floor(Math.random() * 2000) + 100;
        const timestamp = this.weightedTimestamp(60);
        const userId =
          Math.random() < 0.8 ? 'default' : `user_${Math.floor(Math.random() * 5) + 1}`;
        const sessionId = this.generateUUID();

        insert.run(
          query,
          queryType,
          resultsCount,
          selectedEntry?.id || null,
          searchTime,
          timestamp,
          userId,
          sessionId
        );

        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Generated ${CONFIG.volumes.search_history} search history entries`);
  }

  // Generate usage metrics
  generateUsageMetrics() {
    console.log(`📊 Generating ${CONFIG.volumes.usage_metrics} usage metrics...`);

    const entries = this.db.prepare('SELECT id FROM kb_entries').all();
    const insert = this.db.prepare(`
      INSERT INTO usage_metrics (
        entry_id, action, timestamp, user_id, session_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const actions = ['view', 'copy', 'rate_success', 'rate_failure', 'export', 'edit'];

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < CONFIG.volumes.usage_metrics; i++) {
        const entry = entries[Math.floor(Math.random() * entries.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const timestamp = this.weightedTimestamp(45);
        const userId =
          Math.random() < 0.8 ? 'default' : `user_${Math.floor(Math.random() * 5) + 1}`;
        const sessionId = this.generateUUID();
        const metadata = JSON.stringify({
          source: Math.random() < 0.7 ? 'ui' : 'api',
          duration_ms: Math.floor(Math.random() * 30000) + 1000,
        });

        insert.run(entry.id, action, timestamp, userId, sessionId, metadata);
        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Generated ${CONFIG.volumes.usage_metrics} usage metrics`);
  }

  // Generate AI authorization log
  generateAIAuthorizationLog() {
    console.log(
      `🔐 Generating ${CONFIG.volumes.ai_authorization_log} AI authorization decisions...`
    );

    const entries = this.db.prepare('SELECT id FROM kb_entries').all();
    const insert = this.db.prepare(`
      INSERT INTO ai_authorization_log (
        timestamp, user_id, operation_type, query, estimated_tokens,
        estimated_cost, estimated_time_ms, user_decision, decision_time_ms,
        modified_query, session_id, context_entry_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const decisions = ['approved', 'denied', 'modified', 'use_local'];
    const queries = [
      ...MAINFRAME_DATA.searchQueries.functional,
      ...MAINFRAME_DATA.searchQueries.technical,
    ];

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < CONFIG.volumes.ai_authorization_log; i++) {
        const operationType =
          MAINFRAME_DATA.aiOperationTypes[
            Math.floor(Math.random() * MAINFRAME_DATA.aiOperationTypes.length)
          ];
        const query = queries[Math.floor(Math.random() * queries.length)];
        const estimatedTokens = Math.floor(Math.random() * 2000) + 100;
        const estimatedCost = this.generateOperationCost(operationType);
        const estimatedTime = Math.floor(Math.random() * 5000) + 500;

        // Decision logic based on cost
        let decision;
        if (estimatedCost < 0.005) {
          decision = Math.random() < 0.9 ? 'approved' : 'denied';
        } else if (estimatedCost < 0.05) {
          decision = decisions[Math.floor(Math.random() * decisions.length)];
        } else {
          decision = Math.random() < 0.3 ? 'approved' : 'denied';
        }

        const decisionTime =
          decision === 'approved'
            ? Math.floor(Math.random() * 2000) + 500
            : Math.floor(Math.random() * 10000) + 2000;

        const modifiedQuery =
          decision === 'modified'
            ? query.substring(0, Math.floor(query.length * 0.8)) + ' simplified'
            : null;

        const contextEntry =
          Math.random() < 0.4 ? entries[Math.floor(Math.random() * entries.length)] : null;

        insert.run(
          this.weightedTimestamp(30),
          Math.random() < 0.8 ? 'default' : `user_${Math.floor(Math.random() * 5) + 1}`,
          operationType,
          query,
          estimatedTokens,
          estimatedCost,
          estimatedTime,
          decision,
          decisionTime,
          modifiedQuery,
          this.generateUUID(),
          contextEntry?.id || null
        );

        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Generated ${CONFIG.volumes.ai_authorization_log} authorization decisions`);
  }

  // Generate AI cost tracking
  generateAICostTracking() {
    console.log(`💰 Generating ${CONFIG.volumes.ai_cost_tracking} AI cost tracking entries...`);

    const entries = this.db.prepare('SELECT id FROM kb_entries').all();
    const insert = this.db.prepare(`
      INSERT INTO ai_cost_tracking (
        timestamp, operation_id, operation_type, model, input_tokens,
        output_tokens, cost_per_1k_input, cost_per_1k_output,
        user_id, session_id, kb_entry_id, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const models = ['gemini-pro', 'gemini-pro-vision', 'text-embedding-004'];

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < CONFIG.volumes.ai_cost_tracking; i++) {
        const operationType =
          MAINFRAME_DATA.aiOperationTypes[
            Math.floor(Math.random() * MAINFRAME_DATA.aiOperationTypes.length)
          ];
        const model = models[Math.floor(Math.random() * models.length)];
        const inputTokens = Math.floor(Math.random() * 1500) + 100;
        const outputTokens = Math.floor(Math.random() * 800) + 50;
        const success = Math.random() < 0.95;

        const costInput = model.includes('embedding') ? 0.00001 : 0.00025;
        const costOutput = model.includes('embedding') ? 0.00001 : 0.00125;

        const kbEntry =
          Math.random() < 0.6 ? entries[Math.floor(Math.random() * entries.length)] : null;

        insert.run(
          this.weightedTimestamp(30),
          this.generateUUID(),
          operationType,
          model,
          inputTokens,
          outputTokens,
          costInput,
          costOutput,
          Math.random() < 0.8 ? 'default' : `user_${Math.floor(Math.random() * 5) + 1}`,
          this.generateUUID(),
          kbEntry?.id || null,
          success,
          success ? null : 'Rate limit exceeded'
        );

        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Generated ${CONFIG.volumes.ai_cost_tracking} cost tracking entries`);
  }

  // Generate operation logs
  generateOperationLogs() {
    console.log(`📝 Generating ${CONFIG.volumes.operation_logs} operation logs...`);

    const entries = this.db.prepare('SELECT id, category FROM kb_entries').all();
    const insert = this.db.prepare(`
      INSERT INTO operation_logs (
        timestamp, operation_type, operation_subtype, user_id, session_id,
        request_query, request_params, request_source, authorization_required,
        authorization_result, response_time_ms, cache_hit, ai_used,
        ai_model, ai_tokens_used, ai_cost, success, error_code,
        error_message, result_count, result_quality_score, kb_entry_id,
        category, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sources = ['ui', 'api', 'cli', 'automation'];
    const authResults = ['approved', 'denied', 'not_required'];

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < CONFIG.volumes.operation_logs; i++) {
        const operationType =
          MAINFRAME_DATA.operationTypes[
            Math.floor(Math.random() * MAINFRAME_DATA.operationTypes.length)
          ];

        const isSearchOp = operationType === 'search';
        const aiUsed = isSearchOp && Math.random() < 0.3;
        const authRequired = aiUsed && Math.random() < 0.8;
        const success = Math.random() < 0.92;
        const cacheHit = isSearchOp && Math.random() < 0.15;

        const responseTime = cacheHit
          ? Math.floor(Math.random() * 100) + 10
          : Math.floor(Math.random() * 2000) + 100;

        const entry =
          Math.random() < 0.5 ? entries[Math.floor(Math.random() * entries.length)] : null;

        const resultCount = isSearchOp ? Math.floor(Math.random() * 50) + 1 : null;
        const qualityScore = success ? 0.6 + Math.random() * 0.4 : 0.1 + Math.random() * 0.3;

        insert.run(
          this.weightedTimestamp(40),
          operationType,
          isSearchOp ? 'text_search' : null,
          Math.random() < 0.8 ? 'default' : `user_${Math.floor(Math.random() * 5) + 1}`,
          this.generateUUID(),
          isSearchOp
            ? MAINFRAME_DATA.searchQueries.functional[
                Math.floor(Math.random() * MAINFRAME_DATA.searchQueries.functional.length)
              ]
            : null,
          JSON.stringify({ limit: 50, includeArchived: false }),
          sources[Math.floor(Math.random() * sources.length)],
          authRequired,
          authRequired ? authResults[Math.floor(Math.random() * authResults.length)] : null,
          responseTime,
          cacheHit,
          aiUsed,
          aiUsed ? 'gemini-pro' : null,
          aiUsed ? Math.floor(Math.random() * 1000) + 100 : null,
          aiUsed ? this.generateOperationCost('semantic_search') : null,
          success,
          success ? null : 'TIMEOUT',
          success ? null : 'Operation timed out after 30 seconds',
          resultCount,
          qualityScore,
          entry?.id || null,
          entry?.category || null,
          entry ? JSON.stringify(['mainframe', entry.category.toLowerCase()]) : null
        );

        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Generated ${CONFIG.volumes.operation_logs} operation logs`);
  }

  // Generate user preferences
  generateUserPreferences() {
    console.log('⚙️  Generating user preferences...');

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (
        user_id, preferred_categories, preferred_result_count,
        include_archived, ai_enabled, ai_auto_approve_limit,
        ai_monthly_budget, ai_require_authorization, theme,
        language, show_cost_in_results, show_confidence_scores,
        enable_caching, cache_duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const users = ['default', 'user_1', 'user_2', 'user_3', 'user_4', 'user_5'];

    const transaction = this.db.transaction(() => {
      for (const userId of users) {
        const preferredCategories = MAINFRAME_DATA.categories
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.floor(Math.random() * 4) + 2);

        insert.run(
          userId,
          JSON.stringify(preferredCategories),
          [10, 20, 50][Math.floor(Math.random() * 3)],
          Math.random() < 0.2,
          Math.random() < 0.9,
          0.001 + Math.random() * 0.009, // $0.001 - $0.01
          5 + Math.random() * 15, // $5 - $20
          Math.random() < 0.8,
          Math.random() < 0.7 ? 'light' : 'dark',
          Math.random() < 0.9 ? 'en' : 'pt',
          Math.random() < 0.8,
          Math.random() < 0.3,
          Math.random() < 0.9,
          [30, 60, 120][Math.floor(Math.random() * 3)]
        );

        this.stats.created++;
      }
    });

    transaction();
    console.log(`  ✅ Generated preferences for ${users.length} users`);
  }

  // Generate dashboard metrics
  generateDashboardMetrics() {
    console.log('📊 Generating dashboard metrics...');

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO dashboard_metrics (
        metric_date, metric_type, metric_name, metric_value, user_id
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const metricTypes = ['cost', 'usage', 'performance', 'quality'];
    const costMetrics = ['daily_total', 'operation_count', 'avg_cost_per_op'];
    const usageMetrics = ['searches_count', 'entries_viewed', 'ai_operations'];
    const performanceMetrics = ['avg_response_time', 'cache_hit_rate', 'success_rate'];
    const qualityMetrics = ['result_relevance', 'user_satisfaction', 'ai_accuracy'];

    const transaction = this.db.transaction(() => {
      // Generate last 30 days of metrics
      for (let day = 0; day < 30; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        const dateStr = date.toISOString().split('T')[0];

        // Cost metrics
        for (const metric of costMetrics) {
          let value;
          switch (metric) {
            case 'daily_total':
              value = Math.random() * 2.5 + 0.5; // $0.50 - $3.00
              break;
            case 'operation_count':
              value = Math.floor(Math.random() * 50) + 10;
              break;
            case 'avg_cost_per_op':
              value = Math.random() * 0.08 + 0.002; // $0.002 - $0.08
              break;
          }

          insert.run(dateStr, 'cost', metric, value, 'default');
          this.stats.created++;
        }

        // Usage metrics
        for (const metric of usageMetrics) {
          let value;
          switch (metric) {
            case 'searches_count':
              value = Math.floor(Math.random() * 100) + 20;
              break;
            case 'entries_viewed':
              value = Math.floor(Math.random() * 80) + 15;
              break;
            case 'ai_operations':
              value = Math.floor(Math.random() * 30) + 5;
              break;
          }

          insert.run(dateStr, 'usage', metric, value, 'default');
          this.stats.created++;
        }

        // Performance metrics
        for (const metric of performanceMetrics) {
          let value;
          switch (metric) {
            case 'avg_response_time':
              value = Math.random() * 1000 + 200; // 200-1200ms
              break;
            case 'cache_hit_rate':
              value = Math.random() * 0.3 + 0.1; // 10-40%
              break;
            case 'success_rate':
              value = Math.random() * 0.15 + 0.85; // 85-100%
              break;
          }

          insert.run(dateStr, 'performance', metric, value, 'default');
          this.stats.created++;
        }

        // Quality metrics
        for (const metric of qualityMetrics) {
          const value = Math.random() * 0.3 + 0.7; // 70-100%
          insert.run(dateStr, 'quality', metric, value, 'default');
          this.stats.created++;
        }
      }
    });

    transaction();
    console.log(`  ✅ Generated dashboard metrics for 30 days`);
  }

  // Generate AI budget data
  generateAIBudgets() {
    console.log('💰 Generating AI budget data...');

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO ai_cost_budgets (
        user_id, budget_type, budget_amount, current_usage,
        period_start, period_end, alert_threshold
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const users = ['default', 'user_1', 'user_2', 'user_3'];
    const budgetTypes = ['daily', 'weekly', 'monthly'];

    const transaction = this.db.transaction(() => {
      for (const userId of users) {
        for (const budgetType of budgetTypes) {
          let budgetAmount, currentUsage, periodStart, periodEnd;
          const now = new Date();

          switch (budgetType) {
            case 'daily':
              budgetAmount = 1.0 + Math.random() * 2.0; // $1-3
              currentUsage = Math.random() * budgetAmount * 0.8;
              periodStart = new Date(now);
              periodStart.setHours(0, 0, 0, 0);
              periodEnd = new Date(periodStart);
              periodEnd.setDate(periodEnd.getDate() + 1);
              break;

            case 'weekly':
              budgetAmount = 5.0 + Math.random() * 10.0; // $5-15
              currentUsage = Math.random() * budgetAmount * 0.6;
              periodStart = new Date(now);
              periodStart.setDate(now.getDate() - now.getDay());
              periodStart.setHours(0, 0, 0, 0);
              periodEnd = new Date(periodStart);
              periodEnd.setDate(periodEnd.getDate() + 7);
              break;

            case 'monthly':
              budgetAmount = 20.0 + Math.random() * 30.0; // $20-50
              currentUsage = Math.random() * budgetAmount * 0.4;
              periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
              periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              break;
          }

          insert.run(
            userId,
            budgetType,
            budgetAmount,
            currentUsage,
            periodStart.toISOString(),
            periodEnd.toISOString(),
            0.7 + Math.random() * 0.2 // 70-90%
          );

          this.stats.created++;
        }
      }
    });

    transaction();
    console.log(`  ✅ Generated AI budgets for ${users.length} users`);
  }

  // Generate AI authorization preferences
  generateAIAuthorizationPreferences() {
    console.log('🔐 Generating AI authorization preferences...');

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO ai_authorization_preferences (
        user_id, operation_type, authorization_mode, cost_limit
      ) VALUES (?, ?, ?, ?)
    `);

    const users = ['default', 'user_1', 'user_2', 'user_3'];
    const authModes = ['always_ask', 'always_allow', 'always_deny', 'auto_below_limit'];

    const transaction = this.db.transaction(() => {
      for (const userId of users) {
        for (const operationType of MAINFRAME_DATA.aiOperationTypes) {
          const authMode = authModes[Math.floor(Math.random() * authModes.length)];
          const costLimit =
            authMode === 'auto_below_limit'
              ? 0.001 + Math.random() * 0.019 // $0.001 - $0.02
              : 0.01;

          insert.run(userId, operationType, authMode, costLimit);
          this.stats.created++;
        }
      }
    });

    transaction();
    console.log(`  ✅ Generated authorization preferences for ${users.length} users`);
  }

  // Generate all test data
  async generateAll(clearData = false) {
    console.log('🚀 Starting comprehensive test data generation...');
    console.log(`📊 Target volumes:`, CONFIG.volumes);
    console.log('');

    if (!this.initDatabase()) {
      return false;
    }

    if (!(await this.ensureSchema())) {
      return false;
    }

    this.clearTestData(clearData);

    try {
      // Core data generation
      this.generateKBEntries();
      this.generateKBTags();
      this.generateKBRelations();
      this.generateSearchHistory();
      this.generateUsageMetrics();

      // AI transparency features
      this.generateAIAuthorizationLog();
      this.generateAICostTracking();
      this.generateOperationLogs();

      // User preferences and configuration
      this.generateUserPreferences();
      this.generateAIBudgets();
      this.generateAIAuthorizationPreferences();

      // Dashboard and analytics
      this.generateDashboardMetrics();

      return true;
    } catch (error) {
      console.error('❌ Error during data generation:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  // Print summary report
  printSummary() {
    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);

    console.log('');
    console.log('📊 Test Data Generation Summary');
    console.log('================================');
    console.log(`✅ Records created: ${this.stats.created.toLocaleString()}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📁 Database: ${this.dbPath}`);

    if (this.db) {
      try {
        // Get table counts
        const tables = [
          'kb_entries',
          'kb_tags',
          'kb_relations',
          'search_history',
          'usage_metrics',
          'ai_authorization_log',
          'ai_cost_tracking',
          'operation_logs',
          'user_preferences',
          'ai_cost_budgets',
          'dashboard_metrics',
        ];

        console.log('');
        console.log('📈 Final Record Counts:');
        for (const table of tables) {
          try {
            const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            console.log(`  ${table}: ${count.count.toLocaleString()}`);
          } catch (error) {
            console.log(`  ${table}: N/A (table might not exist)`);
          }
        }

        // Cost summary
        try {
          const costSummary = this.db
            .prepare(
              `
            SELECT
              COUNT(*) as operations,
              ROUND(SUM(total_cost), 4) as total_cost,
              ROUND(AVG(total_cost), 6) as avg_cost,
              ROUND(MAX(total_cost), 4) as max_cost
            FROM ai_cost_tracking
          `
            )
            .get();

          console.log('');
          console.log('💰 Cost Summary:');
          console.log(`  Operations: ${costSummary.operations}`);
          console.log(`  Total cost: $${costSummary.total_cost}`);
          console.log(`  Average cost: $${costSummary.avg_cost}`);
          console.log(`  Max cost: $${costSummary.max_cost}`);
        } catch (error) {
          console.log('💰 Cost summary not available');
        }
      } catch (error) {
        console.log(`⚠️  Could not retrieve table statistics: ${error.message}`);
      }
    }

    console.log('');
    console.log('🎉 Test data generation completed successfully!');
    console.log('');
    console.log('🔍 You can now:');
    console.log('  - Search the knowledge base with realistic queries');
    console.log('  - View AI cost tracking and transparency features');
    console.log('  - Test authorization workflows and budget management');
    console.log('  - Analyze usage patterns and performance metrics');
    console.log('  - Explore the dashboard with pre-populated analytics');
  }

  // Cleanup
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const clearData = args.includes('--clear') || args.includes('-c');
  const customPath = args.find(arg => arg.startsWith('--db='))?.split('=')[1];

  // Determine database path
  let dbPath;
  if (customPath) {
    dbPath = path.resolve(customPath);
  } else {
    // Use project default
    const projectRoot = path.resolve(__dirname, '../..');
    dbPath = path.join(projectRoot, 'database', 'knowledge-base.db');
  }

  console.log('🔧 MVP1 v8 Test Data Generator');
  console.log('===============================');
  console.log(`📂 Database path: ${dbPath}`);
  console.log(`🧹 Clear existing data: ${clearData ? 'Yes' : 'No'}`);
  console.log('');

  const generator = new TestDataGenerator(dbPath);

  try {
    const success = await generator.generateAll(clearData);
    generator.printSummary();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    generator.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminated');
  process.exit(1);
});

// Export for use as module
module.exports = { TestDataGenerator, CONFIG, MAINFRAME_DATA };

// Run if called directly
if (require.main === module) {
  main();
}
