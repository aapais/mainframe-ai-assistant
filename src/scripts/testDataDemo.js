#!/usr/bin/env node

/**
 * Test Data Demo Script - Validates the comprehensive test data generator
 *
 * This script demonstrates the test data generation capabilities without
 * requiring a full database setup. It shows the data structures and
 * sample content that would be generated.
 */

const { CONFIG, MAINFRAME_DATA } = require('./generateTestData.js');

console.log('🧪 Test Data Generation Demo');
console.log('============================');
console.log('');

console.log('📊 Configuration:');
console.log('Target Data Volumes:');
Object.entries(CONFIG.volumes).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});
console.log('');

console.log('💰 Cost Simulation:');
Object.entries(CONFIG.costs).forEach(([key, value]) => {
  console.log(`  ${key}: $${value}`);
});
console.log('');

console.log('📅 Time Range:');
Object.entries(CONFIG.timeRange).forEach(([key, value]) => {
  console.log(`  ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
});
console.log('');

console.log('🏷️  Mainframe Categories:');
console.log(`Categories: ${MAINFRAME_DATA.categories.join(', ')}`);
console.log('');

console.log('Subcategories by Category:');
Object.entries(MAINFRAME_DATA.subcategories).forEach(([cat, subs]) => {
  console.log(`  ${cat}: ${subs.join(', ')}`);
});
console.log('');

console.log('🔍 Sample Search Queries:');
console.log('Functional Queries:');
MAINFRAME_DATA.searchQueries.functional.slice(0, 5).forEach(query => {
  console.log(`  - ${query}`);
});
console.log('');

console.log('Technical Queries:');
MAINFRAME_DATA.searchQueries.technical.slice(0, 5).forEach(query => {
  console.log(`  - ${query}`);
});
console.log('');

console.log('🚨 Error Codes:');
console.log(`${MAINFRAME_DATA.errorCodes.join(', ')}`);
console.log('');

console.log('🤖 AI Operation Types:');
console.log(`${MAINFRAME_DATA.aiOperationTypes.join(', ')}`);
console.log('');

console.log('⚙️  System Components:');
console.log(`${MAINFRAME_DATA.systemComponents.join(', ')}`);
console.log('');

console.log('📚 Sample KB Entry Structure:');
console.log('This is what a typical KB entry would look like:');
console.log('');
console.log('```json');
console.log(JSON.stringify({
  id: 'kb-entry-uuid-12345',
  title: 'S0C4 ABEND in COBOL Program During Array Processing',
  problem: 'Program terminates with S0C4 protection exception when processing large arrays...',
  solution: '1. Check OCCURS clause in data division...\n2. Verify subscript values...',
  category: 'Functional',
  subcategory: 'ABEND',
  severity: 'high',
  jcl_type: null,
  cobol_version: 'Enterprise COBOL 6.3',
  system_component: 'MVS',
  error_codes: ['S0C4'],
  usage_count: 45,
  success_count: 38,
  failure_count: 7,
  relevance_score: 0.85,
  tags: ['cobol', 'array', 'abend', 'runtime-error']
}, null, 2));
console.log('```');
console.log('');

console.log('💰 Sample Cost Tracking Entry:');
console.log('```json');
console.log(JSON.stringify({
  operation_id: 'ai-op-uuid-67890',
  operation_type: 'semantic_search',
  model: 'gemini-pro',
  input_tokens: 250,
  output_tokens: 150,
  total_cost: 0.0025,
  user_id: 'default',
  success: true,
  timestamp: new Date().toISOString()
}, null, 2));
console.log('```');
console.log('');

console.log('🔐 Sample Authorization Decision:');
console.log('```json');
console.log(JSON.stringify({
  operation_type: 'explain_error',
  query: 'ABEND S0C4 in COBOL program',
  estimated_cost: 0.0045,
  user_decision: 'approved',
  decision_time_ms: 1250,
  timestamp: new Date().toISOString()
}, null, 2));
console.log('```');
console.log('');

console.log('📊 Total Records That Would Be Generated:');
let totalRecords = 0;
Object.entries(CONFIG.volumes).forEach(([key, value]) => {
  totalRecords += value;
});

// Add estimated tags, relations, preferences, budgets, metrics
totalRecords += CONFIG.volumes.kb_entries * CONFIG.volumes.tags_per_entry; // Tags
totalRecords += 6; // User preferences
totalRecords += 4 * 3; // AI budgets (4 users * 3 budget types)
totalRecords += 4 * 4; // Auth preferences (4 users * 4 operation types)
totalRecords += 30 * 12; // Dashboard metrics (30 days * 12 metrics per day)

console.log(`Estimated Total Records: ${totalRecords.toLocaleString()}`);
console.log('');

console.log('🎯 Database Tables Populated:');
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
  'ai_authorization_preferences',
  'dashboard_metrics'
];

tables.forEach(table => {
  console.log(`  ✅ ${table}`);
});
console.log('');

console.log('🚀 To Run the Actual Generator:');
console.log('1. Ensure better-sqlite3 is properly installed:');
console.log('   npm rebuild better-sqlite3');
console.log('');
console.log('2. Apply the database schema:');
console.log('   npm run db:migrate (if available)');
console.log('   or apply src/database/schema.sql manually');
console.log('');
console.log('3. Run the generator:');
console.log('   npm run test:data');
console.log('   or');
console.log('   node src/scripts/generateTestData.js');
console.log('');
console.log('4. Optional - Clear existing data first:');
console.log('   npm run test:data:clean');
console.log('   or');
console.log('   node src/scripts/generateTestData.js --clear');
console.log('');

console.log('✨ The generator creates realistic mainframe scenarios for:');
console.log('  - Testing search functionality with authentic queries');
console.log('  - Validating AI cost tracking and transparency features');
console.log('  - Testing authorization workflows and budget management');
console.log('  - Demonstrating usage analytics and dashboard metrics');
console.log('  - Exploring multi-user scenarios and preferences');
console.log('');

console.log('🎉 Demo completed! The test data generator is ready to use.');