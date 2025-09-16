/**
 * Jest Environment Setup for KnowledgeDB Integration Tests
 * 
 * Sets up environment variables and global configuration for database testing
 */

// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.TEST_INTEGRATION = 'true';

// Database configuration for testing
process.env.DB_TEST_MODE = 'true';
process.env.DB_LOG_LEVEL = 'error'; // Reduce noise during tests
process.env.DB_PRAGMA_SYNC = 'NORMAL'; // Faster for testing
process.env.DB_PRAGMA_JOURNAL_MODE = 'WAL';

// Performance testing configuration
process.env.PERFORMANCE_THRESHOLD_SEARCH = '1000'; // 1 second max
process.env.PERFORMANCE_THRESHOLD_CONCURRENT = '0.95'; // 95% success rate
process.env.LARGE_DATASET_SIZE = '1000';

// Memory configuration
process.env.NODE_OPTIONS = '--max-old-space-size=2048'; // 2GB memory limit

// Disable automatic backups during testing
process.env.DISABLE_AUTO_BACKUP = 'true';

// Set test-specific timeouts
process.env.DB_OPERATION_TIMEOUT = '30000'; // 30 seconds
process.env.MIGRATION_TIMEOUT = '60000'; // 60 seconds

// Logging configuration
process.env.LOG_LEVEL = 'warn'; // Reduce console noise

console.log('🔧 KnowledgeDB Integration Test environment configured');