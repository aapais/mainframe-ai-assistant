#!/usr/bin/env node

/**
 * Generate Test Data as SQL Script
 * Creates SQL INSERT statements that can be executed manually
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const config = {
  outputFile: path.join(process.cwd(), 'test-data.sql'),
  volumes: {
    kb_entries: 50,
    search_history: 100,
    usage_metrics: 200,
    ai_authorization_log: 50,
    ai_cost_tracking: 80,
    operation_logs: 150,
    kb_relations: 30,
    tags_per_entry: 3,
  },
};

// Utilities
const uuid = () => crypto.randomBytes(16).toString('hex');
const randomDate = (daysAgo = 90) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString().replace('T', ' ').replace('Z', '');
};
const randomElement = arr => arr[Math.floor(Math.random() * arr.length)];

// Data templates
const categories = [
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
];
const severities = ['critical', 'high', 'medium', 'low'];
const errorCodes = ['S0C4', 'S0C7', 'S806', 'S822', 'S013', 'S217', 'S37', 'SB37', 'SD37'];

const kbTitles = [
  'S0C4 ABEND in COBOL Program',
  'JCL Job Failed with RC=12',
  'DB2 Bind Error SQLCODE -818',
  'VSAM File Status 93',
  'CICS Transaction Timeout',
  'IMS Database Deadlock',
  'Dataset Not Found IGD17101I',
  'Authorization Failure ICH408I',
  'Batch Job Loop Detected',
  'REXX Exec Memory Error',
];

const problems = [
  'Production batch job abending with system completion code',
  'Unable to access VSAM dataset, getting return code error',
  'DB2 query returning unexpected SQLCODE error',
  'CICS transaction failing during peak hours',
  'JCL procedure not executing expected steps',
  'IMS message queue backing up',
  'Security violation when accessing system resources',
  'Network connection dropping during file transfer',
  'Memory allocation failure in COBOL program',
  'Dataset contention issues in production',
];

const solutions = [
  '1. Check the program logic for array bounds\n2. Verify OCCURS clause in COBOL\n3. Add boundary checking\n4. Recompile with DEBUG option',
  '1. Verify dataset exists using ISPF 3.4\n2. Check DISP parameter in JCL\n3. Ensure proper catalog entry\n4. Review job log for details',
  '1. Check bind timestamp mismatch\n2. Rebind the package\n3. Verify DBRM consistency\n4. Review DB2 authorization',
  '1. Verify file is not already open\n2. Check exclusive control\n3. Review SHAREOPTIONS\n4. Ensure proper CLOSE',
  '1. Increase transaction timeout value\n2. Optimize database queries\n3. Check for resource contention\n4. Review CICS statistics',
];

// Generate SQL statements
function generateSQL() {
  let sql = `-- MVP1 v8 Test Data SQL Script
-- Generated: ${new Date().toISOString()}
-- This script creates test data for the Knowledge Base application

-- Disable foreign key checks for bulk insert
PRAGMA foreign_keys = OFF;

-- Begin transaction
BEGIN TRANSACTION;

`;

  // 1. Generate KB Entries
  sql += '-- Knowledge Base Entries\n';
  const kbEntries = [];
  for (let i = 1; i <= config.volumes.kb_entries; i++) {
    const id = `kb-${uuid()}`;
    kbEntries.push(id);
    const title = `${randomElement(kbTitles)} - Case ${i}`;
    const problem = randomElement(problems);
    const solution = randomElement(solutions);
    const category = randomElement(categories);
    const severity = randomElement(severities);
    const usageCount = Math.floor(Math.random() * 100);
    const successCount = Math.floor(usageCount * 0.8);
    const failureCount = usageCount - successCount;
    const createdAt = randomDate(90);
    const lastUsed = randomDate(7);

    sql += `INSERT INTO kb_entries (id, title, problem, solution, category, severity, created_at, updated_at, usage_count, success_count, failure_count, last_used, archived) VALUES `;
    sql += `('${id}', '${title.replace(/'/g, "''")}', '${problem.replace(/'/g, "''")}', '${solution.replace(/'/g, "''")}', '${category}', '${severity}', '${createdAt}', '${createdAt}', ${usageCount}, ${successCount}, ${failureCount}, '${lastUsed}', 0);\n`;
  }

  // 2. Generate Tags
  sql += '\n-- Tags\n';
  const tags = [
    'mainframe',
    'cobol',
    'jcl',
    'batch',
    'db2',
    'vsam',
    'cics',
    'ims',
    'abend',
    'error',
    'production',
    'critical',
  ];
  kbEntries.forEach(entryId => {
    for (let j = 0; j < config.volumes.tags_per_entry; j++) {
      const tag = randomElement(tags);
      sql += `INSERT OR IGNORE INTO kb_tags (entry_id, tag) VALUES ('${entryId}', '${tag}');\n`;
    }
  });

  // 3. Generate Search History
  sql += '\n-- Search History\n';
  const searchQueries = [
    'ABEND S0C4',
    'JCL error',
    'DB2 SQLCODE',
    'VSAM status',
    'CICS timeout',
    'IMS deadlock',
    'batch job failed',
    'dataset not found',
    'authorization error',
    'COBOL compilation',
    'file status 93',
    'return code 12',
    'system completion code',
  ];

  for (let i = 0; i < config.volumes.search_history; i++) {
    const query = randomElement(searchQueries);
    const resultsCount = Math.floor(Math.random() * 20);
    const selectedEntry = Math.random() > 0.5 ? randomElement(kbEntries) : 'NULL';
    const timestamp = randomDate(30);
    const searchTime = Math.floor(Math.random() * 1000) + 100;

    sql += `INSERT INTO search_history (query, query_type, results_count, selected_entry_id, search_time_ms, timestamp) VALUES `;
    sql += `('${query}', 'text', ${resultsCount}, ${selectedEntry === 'NULL' ? 'NULL' : "'" + selectedEntry + "'"}, ${searchTime}, '${timestamp}');\n`;
  }

  // 4. Generate Usage Metrics
  sql += '\n-- Usage Metrics\n';
  const actions = ['view', 'copy', 'rate_success', 'rate_failure', 'export'];

  for (let i = 0; i < config.volumes.usage_metrics; i++) {
    const entryId = randomElement(kbEntries);
    const action = randomElement(actions);
    const timestamp = randomDate(30);

    sql += `INSERT INTO usage_metrics (entry_id, action, timestamp) VALUES `;
    sql += `('${entryId}', '${action}', '${timestamp}');\n`;
  }

  // 5. Generate AI Authorization Log (if table exists)
  sql += '\n-- AI Authorization Log\n';
  const operationTypes = ['semantic_search', 'explain_error', 'analyze_entry', 'suggest_similar'];
  const decisions = ['approved', 'denied', 'modified', 'use_local'];

  for (let i = 0; i < config.volumes.ai_authorization_log; i++) {
    const operationType = randomElement(operationTypes);
    const query = randomElement(searchQueries);
    const estimatedTokens = Math.floor(Math.random() * 500) + 100;
    const estimatedCost = (estimatedTokens * 0.00001).toFixed(5);
    const decision = randomElement(decisions);
    const decisionTime = Math.floor(Math.random() * 5000) + 500;
    const timestamp = randomDate(30);

    sql += `INSERT OR IGNORE INTO ai_authorization_log (timestamp, operation_type, query, estimated_tokens, estimated_cost, user_decision, decision_time_ms, user_id) VALUES `;
    sql += `('${timestamp}', '${operationType}', '${query}', ${estimatedTokens}, ${estimatedCost}, '${decision}', ${decisionTime}, 'default');\n`;
  }

  // 6. Generate Cost Tracking (if table exists)
  sql += '\n-- Cost Tracking\n';
  const models = ['gemini-pro', 'gemini-flash', 'claude-3-sonnet'];

  for (let i = 0; i < config.volumes.ai_cost_tracking; i++) {
    const operationId = `op-${uuid()}`;
    const operationType = randomElement(operationTypes);
    const model = randomElement(models);
    const inputTokens = Math.floor(Math.random() * 1000) + 100;
    const outputTokens = Math.floor(Math.random() * 500) + 50;
    const timestamp = randomDate(30);

    sql += `INSERT OR IGNORE INTO ai_cost_tracking (operation_id, operation_type, model, input_tokens, output_tokens, timestamp, user_id, success) VALUES `;
    sql += `('${operationId}', '${operationType}', '${model}', ${inputTokens}, ${outputTokens}, '${timestamp}', 'default', 1);\n`;
  }

  // 7. Generate Operation Logs (if table exists)
  sql += '\n-- Operation Logs\n';

  for (let i = 0; i < config.volumes.operation_logs; i++) {
    const operationType = randomElement(['search', 'view', 'edit', 'ai_request']);
    const timestamp = randomDate(30);
    const responseTime = Math.floor(Math.random() * 2000) + 100;
    const success = Math.random() > 0.1 ? 1 : 0;
    const aiUsed = operationType === 'ai_request' ? 1 : 0;

    sql += `INSERT OR IGNORE INTO operation_logs (timestamp, operation_type, response_time_ms, success, ai_used, user_id) VALUES `;
    sql += `('${timestamp}', '${operationType}', ${responseTime}, ${success}, ${aiUsed}, 'default');\n`;
  }

  // 8. Add some sample user preferences
  sql += '\n-- User Preferences\n';
  sql += `INSERT OR IGNORE INTO user_preferences (user_id, ai_enabled, ai_auto_approve_limit, ai_monthly_budget, show_cost_in_results) VALUES `;
  sql += `('default', 1, 0.01, 10.0, 1);\n`;

  // End transaction
  sql += `
-- Commit transaction
COMMIT;

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Update FTS index if exists
INSERT INTO kb_fts(kb_fts) VALUES('rebuild');

-- Analyze for query optimization
ANALYZE;

-- Vacuum to optimize database
VACUUM;

-- Summary
SELECT 'Test data generation complete!' as message;
SELECT 'KB Entries: ' || COUNT(*) as count FROM kb_entries;
SELECT 'Tags: ' || COUNT(*) as count FROM kb_tags;
SELECT 'Search History: ' || COUNT(*) as count FROM search_history;
SELECT 'Usage Metrics: ' || COUNT(*) as count FROM usage_metrics;
`;

  return sql;
}

// Main execution
console.log('🔧 Generating Test Data SQL Script');
console.log('==================================\n');

const sql = generateSQL();

// Write to file
fs.writeFileSync(config.outputFile, sql);

console.log(`✅ SQL script generated: ${config.outputFile}`);
console.log(`📊 Total size: ${(sql.length / 1024).toFixed(2)} KB`);
console.log('\n📋 To use this script:');
console.log('1. Open your SQLite database');
console.log('2. Run: .read test-data.sql');
console.log('   OR');
console.log('   sqlite3 database.db < test-data.sql');
console.log('\n🎉 Done!');
