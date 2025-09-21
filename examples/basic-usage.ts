/**
 * Basic Usage Examples for Database Utilities System
 * 
 * This file demonstrates fundamental operations including:
 * - Database initialization and configuration
 * - CRUD operations for knowledge base entries
 * - Basic search functionality
 * - Performance monitoring
 * - Backup and recovery operations
 */

import { KnowledgeDB, createKnowledgeDB } from '../src/database/KnowledgeDB';
import { KBEntry, SearchResult } from '../src/types/index';

// ==============================================
// 1. DATABASE INITIALIZATION
// ==============================================

/**
 * Example: Basic Database Setup
 * Shows how to initialize the database with default settings
 */
async function basicInitialization() {
  console.log('🚀 Basic Database Initialization');
  
  // Simple initialization with defaults
  const db = new KnowledgeDB('./examples/basic-knowledge.db');
  
  // Wait for initialization to complete (automatic)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Database initialized successfully');
  
  // Get initial statistics
  const stats = await db.getStats();
  console.log(`Database contains ${stats.totalEntries} entries`);
  
  await db.close();
}

/**
 * Example: Advanced Database Configuration
 * Shows how to customize database settings for different environments
 */
async function advancedConfiguration() {
  console.log('🔧 Advanced Database Configuration');
  
  const db = new KnowledgeDB('./examples/advanced-knowledge.db', {
    // Backup configuration
    backupDir: './examples/backups',
    maxBackups: 5,
    autoBackup: true,
    backupInterval: 12, // Every 12 hours
  });
  
  // Using the factory function for guaranteed initialization
  const db2 = await createKnowledgeDB('./examples/factory-knowledge.db', {
    autoBackup: false // Disable for development
  });
  
  console.log('✅ Advanced configuration completed');
  
  await db.close();
  await db2.close();
}

// ==============================================
// 2. CRUD OPERATIONS
// ==============================================

/**
 * Example: Creating Knowledge Base Entries
 * Demonstrates different types of mainframe knowledge entries
 */
async function createEntries() {
  console.log('📝 Creating Knowledge Base Entries');
  
  const db = await createKnowledgeDB('./examples/crud-knowledge.db');
  
  // VSAM Error Entry
  const vsamEntryId = await db.addEntry({
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    solution: `1. Verify the dataset exists using ISPF 3.4 or LISTCAT command
2. Check the DD statement in JCL has correct DSN
3. Ensure file is cataloged properly (use LISTCAT to verify)
4. Verify RACF permissions using LISTDSD command
5. Check if file was deleted or renamed recently
6. Verify the correct catalog is being used`,
    category: 'VSAM',
    severity: 'medium',
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog', 'open-error']
  }, 'example-user');
  
  // COBOL Abend Entry
  const cobolEntryId = await db.addEntry({
    title: 'S0C7 - Data Exception in COBOL Program',
    problem: 'Program abends with S0C7 data exception during arithmetic operations or MOVE statements.',
    solution: `1. Check for non-numeric data in numeric fields
2. Common causes:
   - Uninitialized working storage variables
   - Bad data from input file
   - Incorrect REDEFINES usage
3. Debugging steps:
   - Add DISPLAY statements before arithmetic operations
   - Use CEDF debugger in CICS environment
   - Check compile listing for data definitions
4. Prevention:
   - Use NUMPROC(NOPFD) compile option
   - Add ON SIZE ERROR clauses
   - Initialize all working storage variables
   - Validate input data before processing`,
    category: 'Batch',
    severity: 'high',
    tags: ['s0c7', 'data-exception', 'numeric', 'abend', 'cobol', 'arithmetic']
  }, 'example-user');
  
  // JCL Error Entry
  const jclEntryId = await db.addEntry({
    title: 'JCL Error - Dataset Not Found (IEF212I)',
    problem: 'JCL job fails with IEF212I dataset not found error during allocation.',
    solution: `1. Verify dataset name spelling exactly (case sensitive)
2. Check if dataset exists using TSO LISTD command
3. For GDG datasets:
   - Verify generation exists: (0), (-1), (+1)
   - Check GDG base is properly defined
4. Common issues:
   - Dataset expired and was deleted by cleanup jobs
   - Wrong UNIT or VOL parameters for uncataloged datasets
   - Missing quotes around dataset names with special characters
5. Solutions:
   - Use LISTCAT to verify catalog entries
   - Check previous step created the dataset if DISP=OLD
   - Verify RACF permissions for dataset access`,
    category: 'JCL',
    severity: 'medium',
    tags: ['jcl', 'dataset', 'not-found', 'ief212i', 'allocation', 'gdg']
  });
  
  console.log(`✅ Created ${3} knowledge base entries:`);
  console.log(`- VSAM Entry: ${vsamEntryId}`);
  console.log(`- COBOL Entry: ${cobolEntryId}`);
  console.log(`- JCL Entry: ${jclEntryId}`);
  
  return { db, entryIds: [vsamEntryId, cobolEntryId, jclEntryId] };
}

/**
 * Example: Reading and Updating Entries
 * Shows how to retrieve and modify existing entries
 */
async function readAndUpdateEntries() {
  console.log('📖 Reading and Updating Entries');
  
  const { db, entryIds } = await createEntries();
  
  // Read specific entry by ID
  const entry = await db.getEntry(entryIds[0]);
  if (entry) {
    console.log(`Retrieved entry: ${entry.title}`);
    console.log(`Category: ${entry.category}`);
    console.log(`Tags: ${entry.tags?.join(', ')}`);
    console.log(`Usage count: ${entry.usage_count}`);
  }
  
  // Update entry with additional information
  await db.updateEntry(entryIds[0], {
    solution: entry!.solution + '\n\n7. Contact system administrator if issue persists',
    tags: [...(entry!.tags || []), 'updated', 'additional-steps']
  }, 'example-user');
  
  console.log('✅ Entry updated successfully');
  
  // Verify update
  const updatedEntry = await db.getEntry(entryIds[0]);
  console.log(`Updated tags: ${updatedEntry?.tags?.join(', ')}`);
  
  await db.close();
}

// ==============================================
// 3. SEARCH OPERATIONS
// ==============================================

/**
 * Example: Basic Search Operations
 * Demonstrates different search methods and operators
 */
async function basicSearchOperations() {
  console.log('🔍 Basic Search Operations');
  
  const { db } = await createEntries();
  
  // Simple text search
  console.log('\n--- Simple Text Search ---');
  const results1 = await db.search('VSAM status 35');
  console.log(`Found ${results1.length} results for "VSAM status 35"`);
  results1.forEach(result => {
    console.log(`- ${result.entry.title} (${result.score.toFixed(1)}% match)`);
    console.log(`  Match type: ${result.matchType}`);
  });
  
  // Category-specific search
  console.log('\n--- Category Search ---');
  const results2 = await db.search('category:JCL');
  console.log(`Found ${results2.length} JCL entries`);
  results2.forEach(result => {
    console.log(`- ${result.entry.title}`);
  });
  
  // Tag-based search
  console.log('\n--- Tag Search ---');
  const results3 = await db.search('tag:abend');
  console.log(`Found ${results3.length} entries tagged with "abend"`);
  results3.forEach(result => {
    console.log(`- ${result.entry.title}`);
  });
  
  // Advanced search with options
  console.log('\n--- Advanced Search ---');
  const results4 = await db.search('error', {
    limit: 5,
    sortBy: 'usage',
    category: 'Batch'
  });
  console.log(`Found ${results4.length} Batch error entries`);
  
  await db.close();
}

/**
 * Example: Advanced Search Features
 * Shows auto-complete, faceted search, and search analytics
 */
async function advancedSearchFeatures() {
  console.log('🔍+ Advanced Search Features');
  
  const { db } = await createEntries();
  
  // Auto-complete suggestions
  console.log('\n--- Auto-complete ---');
  const suggestions = await db.autoComplete('vs', 5);
  console.log('Suggestions for "vs":');
  suggestions.forEach(suggestion => {
    console.log(`- ${suggestion.suggestion} (${suggestion.category})`);
  });
  
  // Faceted search
  console.log('\n--- Faceted Search ---');
  const facetedResults = await db.searchWithFacets('error');
  console.log(`Found ${facetedResults.totalCount} entries with facets:`);
  console.log('Categories:');
  facetedResults.facets.categories.forEach(cat => {
    console.log(`  - ${cat.name}: ${cat.count}`);
  });
  console.log('Top Tags:');
  facetedResults.facets.tags.slice(0, 5).forEach(tag => {
    console.log(`  - ${tag.name}: ${tag.count}`);
  });
  
  await db.close();
}

// ==============================================
// 4. USAGE TRACKING AND ANALYTICS
// ==============================================

/**
 * Example: Usage Tracking and Analytics
 * Shows how to track entry usage and analyze effectiveness
 */
async function usageTrackingAndAnalytics() {
  console.log('📊 Usage Tracking and Analytics');
  
  const { db, entryIds } = await createEntries();
  
  // Simulate usage tracking
  console.log('\n--- Simulating Usage ---');
  
  // Multiple successful uses of VSAM entry
  for (let i = 0; i < 5; i++) {
    await db.recordUsage(entryIds[0], true, `user-${i}`);
  }
  
  // Some failed uses
  await db.recordUsage(entryIds[0], false, 'user-6');
  
  // Usage of other entries
  await db.recordUsage(entryIds[1], true, 'user-1');
  await db.recordUsage(entryIds[1], true, 'user-2');
  await db.recordUsage(entryIds[2], false, 'user-3');
  
  // Get popular entries
  console.log('\n--- Popular Entries ---');
  const popular = await db.getPopular(5);
  popular.forEach(result => {
    console.log(`- ${result.entry.title}`);
    console.log(`  Usage: ${result.entry.usage_count} times`);
    console.log(`  Success rate: ${(result.entry.success_count! / Math.max(1, result.entry.usage_count!)) * 100}%`);
  });
  
  // Get recent entries
  console.log('\n--- Recent Entries ---');
  const recent = await db.getRecent(3);
  recent.forEach(result => {
    console.log(`- ${result.entry.title} (created: ${result.entry.created_at})`);
  });
  
  await db.close();
}

// ==============================================
// 5. PERFORMANCE MONITORING
// ==============================================

/**
 * Example: Performance Monitoring and Optimization
 * Shows how to monitor database performance and get optimization recommendations
 */
async function performanceMonitoring() {
  console.log('⚡ Performance Monitoring');
  
  const { db } = await createEntries();
  
  // Get current performance status
  console.log('\n--- Real-time Performance Status ---');
  const perfStatus = db.getPerformanceStatus();
  console.log(`System healthy: ${perfStatus.isHealthy ? '✅' : '❌'}`);
  if (perfStatus.issues && perfStatus.issues.length > 0) {
    console.log('Issues:', perfStatus.issues);
  }
  
  // Generate performance report
  console.log('\n--- Performance Report ---');
  const report = db.generatePerformanceReport();
  console.log('Performance Summary:');
  console.log(`- Average search time: ${report.summary?.avgSearchTime || 'N/A'}ms`);
  console.log(`- Cache hit rate: ${report.summary?.cacheHitRate || 'N/A'}%`);
  console.log(`- Total queries: ${report.summary?.totalQueries || 'N/A'}`);
  
  // Get optimization recommendations
  console.log('\n--- Optimization Recommendations ---');
  const recommendations = db.getRecommendations();
  if (recommendations.length > 0) {
    recommendations.forEach(rec => console.log(`💡 ${rec}`));
  } else {
    console.log('✅ No optimization recommendations at this time');
  }
  
  // Cache statistics
  console.log('\n--- Cache Statistics ---');
  const cacheStats = db.getCacheStats();
  console.log(`Cache entries: ${cacheStats.entryCount}`);
  console.log(`Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
  console.log(`Memory usage: ${(cacheStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
  
  await db.close();
}

/**
 * Example: Health Monitoring and Diagnostics
 * Shows comprehensive health checking and issue detection
 */
async function healthMonitoring() {
  console.log('🏥 Health Monitoring and Diagnostics');
  
  const { db } = await createEntries();
  
  // Comprehensive health check
  console.log('\n--- Comprehensive Health Check ---');
  const health = await db.healthCheck();
  
  console.log(`Overall health: ${health.overall ? '✅ Healthy' : '❌ Issues detected'}`);
  console.log(`Database: ${health.database ? '✅' : '❌'}`);
  console.log(`Cache: ${health.cache ? '✅' : '❌'}`);
  console.log(`Connections: ${health.connections ? '✅' : '❌'}`);
  console.log(`Performance: ${health.performance ? '✅' : '❌'}`);
  
  if (health.issues.length > 0) {
    console.log('\nIssues detected:');
    health.issues.forEach(issue => console.log(`⚠️  ${issue}`));
  }
  
  // Database statistics
  console.log('\n--- Database Statistics ---');
  const stats = await db.getStats();
  console.log(`Total entries: ${stats.totalEntries}`);
  console.log(`Searches today: ${stats.searchesToday}`);
  console.log(`Recent activity: ${stats.recentActivity} entries used in last 7 days`);
  console.log(`Average success rate: ${stats.averageSuccessRate}%`);
  console.log(`Disk usage: ${(stats.diskUsage / 1024 / 1024).toFixed(2)} MB`);
  
  await db.close();
}

// ==============================================
// 6. BACKUP AND RECOVERY
// ==============================================

/**
 * Example: Backup and Recovery Operations
 * Shows backup creation, restoration, and data export/import
 */
async function backupAndRecovery() {
  console.log('💾 Backup and Recovery Operations');
  
  const { db } = await createEntries();
  
  // Create manual backup
  console.log('\n--- Creating Manual Backup ---');
  await db.createBackup();
  console.log('✅ Manual backup created successfully');
  
  // Export to JSON
  console.log('\n--- Exporting to JSON ---');
  const exportPath = './examples/exported-knowledge.json';
  await db.exportToJSON(exportPath);
  console.log(`✅ Database exported to ${exportPath}`);
  
  // Create a new database and import data
  console.log('\n--- Importing from JSON ---');
  const db2 = await createKnowledgeDB('./examples/imported-knowledge.db');
  
  await db2.importFromJSON(exportPath, false); // Replace mode
  
  // Verify import
  const importedStats = await db2.getStats();
  console.log(`✅ Import completed: ${importedStats.totalEntries} entries imported`);
  
  await db.close();
  await db2.close();
}

// ==============================================
// 7. CONFIGURATION MANAGEMENT
// ==============================================

/**
 * Example: Configuration Management
 * Shows how to manage system configuration settings
 */
async function configurationManagement() {
  console.log('⚙️ Configuration Management');
  
  const db = await createKnowledgeDB('./examples/config-knowledge.db');
  
  // Set configuration values
  console.log('\n--- Setting Configuration ---');
  await db.setConfig('search.timeout', '5000', 'number', 'Search timeout in milliseconds');
  await db.setConfig('cache.size', '1000', 'number', 'Maximum cache entries');
  await db.setConfig('backup.enabled', 'true', 'boolean', 'Enable automatic backups');
  
  // Get configuration values
  console.log('\n--- Reading Configuration ---');
  const searchTimeout = db.getConfig('search.timeout');
  const cacheSize = db.getConfig('cache.size');
  const backupEnabled = db.getConfig('backup.enabled');
  
  console.log(`Search timeout: ${searchTimeout}ms`);
  console.log(`Cache size: ${cacheSize} entries`);
  console.log(`Backup enabled: ${backupEnabled}`);
  
  await db.close();
}

// ==============================================
// MAIN EXECUTION
// ==============================================

/**
 * Main function to run all examples
 */
async function runAllExamples() {
  console.log('🎯 Running Database Utilities System Examples\n');
  
  try {
    // Database initialization
    await basicInitialization();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await advancedConfiguration();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // CRUD operations
    await readAndUpdateEntries();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Search operations
    await basicSearchOperations();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await advancedSearchFeatures();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Analytics and monitoring
    await usageTrackingAndAnalytics();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await performanceMonitoring();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await healthMonitoring();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Backup and recovery
    await backupAndRecovery();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Configuration
    await configurationManagement();
    
    console.log('\n🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
  }
}

// Export functions for individual use
export {
  basicInitialization,
  advancedConfiguration,
  createEntries,
  readAndUpdateEntries,
  basicSearchOperations,
  advancedSearchFeatures,
  usageTrackingAndAnalytics,
  performanceMonitoring,
  healthMonitoring,
  backupAndRecovery,
  configurationManagement
};

// Run examples if called directly
if (require.main === module) {
  runAllExamples();
}