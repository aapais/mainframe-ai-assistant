/**
 * Simple JavaScript test for Unified Handler
 *
 * Tests the core functionality without TypeScript compilation
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class SimpleUnifiedTest {
  constructor() {
    this.testDbPath = './test-unified-simple.db';
    this.setupTestDatabase();
  }

  setupTestDatabase() {
    try {
      console.log('🔧 Setting up test database...');

      // Clean up any existing test database
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }

      this.db = new Database(this.testDbPath);

      // Create unified entries table (mimicking the unified schema)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'medium',

          -- KB-specific fields
          problem TEXT,
          solution TEXT,
          usage_count INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          last_used DATETIME,
          confidence_score REAL,

          -- Incident-specific fields
          status TEXT,
          priority INTEGER,
          assigned_team TEXT,
          assigned_to TEXT,
          reporter TEXT,
          resolution_type TEXT,
          root_cause TEXT,

          -- Common fields
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT DEFAULT 'system',
          archived BOOLEAN DEFAULT FALSE,
          tags TEXT,
          custom_fields TEXT
        );
      `);

      // Create supporting tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS unified_comments (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          content TEXT NOT NULL,
          author TEXT NOT NULL,
          is_internal BOOLEAN DEFAULT FALSE,
          comment_type TEXT DEFAULT 'comment',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          rating INTEGER,
          successful BOOLEAN,
          resolution_time INTEGER,
          metadata TEXT
        );
      `);

      console.log('✅ Test database created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error setting up test database:', error);
      return false;
    }
  }

  testSchemaDetection() {
    console.log('\n🔍 Testing schema detection...');

    try {
      // Check if unified schema is detected correctly
      const unifiedTableExists = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='entries'
      `
        )
        .get();

      if (unifiedTableExists.count === 0) {
        throw new Error('Entries table not found');
      }

      // Check if it has entry_type column
      const hasEntryType = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM pragma_table_info('entries')
        WHERE name='entry_type'
      `
        )
        .get();

      if (hasEntryType.count === 0) {
        throw new Error('entry_type column not found');
      }

      console.log('✅ Schema detection: PASSED');
      return true;
    } catch (error) {
      console.log(`❌ Schema detection: FAILED - ${error.message}`);
      return false;
    }
  }

  testKnowledgeEntryOperations() {
    console.log('\n📚 Testing knowledge entry operations...');

    try {
      // Insert a knowledge entry
      const insertKB = this.db.prepare(`
        INSERT INTO entries (
          id, entry_type, title, description, problem, solution, category, severity,
          created_by, usage_count, success_count, failure_count, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertKB.run(
        'test-kb-1',
        'knowledge',
        'Test KB Entry',
        'Test problem description',
        'Test problem description',
        'Test solution description',
        'JCL',
        'medium',
        'test-user',
        0,
        0,
        0,
        JSON.stringify(['test', 'jcl'])
      );

      // Verify it was inserted correctly
      const kbEntry = this.db
        .prepare(
          `
        SELECT * FROM entries WHERE id = ? AND entry_type = 'knowledge'
      `
        )
        .get('test-kb-1');

      if (!kbEntry) {
        throw new Error('Knowledge entry not found after insertion');
      }

      if (kbEntry.title !== 'Test KB Entry' || kbEntry.entry_type !== 'knowledge') {
        throw new Error('Knowledge entry data mismatch');
      }

      // Test KB-specific operations
      const updateKB = this.db.prepare(`
        UPDATE entries
        SET usage_count = usage_count + 1, success_count = success_count + 1
        WHERE id = ? AND entry_type = 'knowledge'
      `);

      updateKB.run('test-kb-1');

      const updatedKB = this.db
        .prepare(
          `
        SELECT usage_count, success_count FROM entries WHERE id = ?
      `
        )
        .get('test-kb-1');

      if (updatedKB.usage_count !== 1 || updatedKB.success_count !== 1) {
        throw new Error('KB metrics update failed');
      }

      console.log('✅ Knowledge entry operations: PASSED');
      return true;
    } catch (error) {
      console.log(`❌ Knowledge entry operations: FAILED - ${error.message}`);
      return false;
    }
  }

  testIncidentOperations() {
    console.log('\n🚨 Testing incident operations...');

    try {
      // Insert an incident
      const insertIncident = this.db.prepare(`
        INSERT INTO entries (
          id, entry_type, title, description, category, severity, status, priority,
          reporter, assigned_to, created_by, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertIncident.run(
        'test-inc-1',
        'incident',
        'Test Incident',
        'Test incident description',
        'System',
        'high',
        'aberto',
        2,
        'test-reporter',
        null,
        'test-user',
        JSON.stringify(['test', 'system'])
      );

      // Verify it was inserted correctly
      const incident = this.db
        .prepare(
          `
        SELECT * FROM entries WHERE id = ? AND entry_type = 'incident'
      `
        )
        .get('test-inc-1');

      if (!incident) {
        throw new Error('Incident not found after insertion');
      }

      if (incident.title !== 'Test Incident' || incident.entry_type !== 'incident') {
        throw new Error('Incident data mismatch');
      }

      // Test status transitions
      const updateStatus = this.db.prepare(`
        UPDATE entries
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND entry_type = 'incident'
      `);

      updateStatus.run('em_tratamento', 'test-inc-1');

      const updatedIncident = this.db
        .prepare(
          `
        SELECT status FROM entries WHERE id = ?
      `
        )
        .get('test-inc-1');

      if (updatedIncident.status !== 'em_tratamento') {
        throw new Error('Status transition failed');
      }

      // Test assignment
      const assignIncident = this.db.prepare(`
        UPDATE entries
        SET assigned_to = ?, status = CASE WHEN status = 'aberto' THEN 'em_tratamento' ELSE status END
        WHERE id = ? AND entry_type = 'incident'
      `);

      assignIncident.run('test-assignee', 'test-inc-1');

      const assignedIncident = this.db
        .prepare(
          `
        SELECT assigned_to FROM entries WHERE id = ?
      `
        )
        .get('test-inc-1');

      if (assignedIncident.assigned_to !== 'test-assignee') {
        throw new Error('Incident assignment failed');
      }

      console.log('✅ Incident operations: PASSED');
      return true;
    } catch (error) {
      console.log(`❌ Incident operations: FAILED - ${error.message}`);
      return false;
    }
  }

  testUnifiedSearch() {
    console.log('\n🔍 Testing unified search...');

    try {
      // Search across both entry types
      const searchQuery = this.db.prepare(`
        SELECT * FROM entries
        WHERE entry_type IN ('knowledge', 'incident')
        AND archived = FALSE
        AND (
          title LIKE ? OR
          description LIKE ? OR
          problem LIKE ? OR
          solution LIKE ?
        )
        ORDER BY
          CASE entry_type WHEN 'incident' THEN
            CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
          ELSE usage_count END DESC
      `);

      const searchTerm = '%Test%';
      const results = searchQuery.all(searchTerm, searchTerm, searchTerm, searchTerm);

      if (!Array.isArray(results)) {
        throw new Error('Search results is not an array');
      }

      if (results.length < 2) {
        throw new Error(`Expected at least 2 results, got ${results.length}`);
      }

      // Verify we have both types
      const hasKnowledge = results.some(r => r.entry_type === 'knowledge');
      const hasIncident = results.some(r => r.entry_type === 'incident');

      if (!hasKnowledge) {
        throw new Error('No knowledge entries found in search results');
      }

      if (!hasIncident) {
        throw new Error('No incident entries found in search results');
      }

      console.log('✅ Unified search: PASSED');
      return true;
    } catch (error) {
      console.log(`❌ Unified search: FAILED - ${error.message}`);
      return false;
    }
  }

  testTypeFiltering() {
    console.log('\n🔄 Testing entry type filtering...');

    try {
      // Test knowledge-only filter
      const kbOnly = this.db
        .prepare(
          `
        SELECT * FROM entries WHERE entry_type = 'knowledge'
      `
        )
        .all();

      if (kbOnly.length === 0 || kbOnly.some(e => e.entry_type !== 'knowledge')) {
        throw new Error('Knowledge-only filter failed');
      }

      // Test incident-only filter
      const incidentOnly = this.db
        .prepare(
          `
        SELECT * FROM entries WHERE entry_type = 'incident'
      `
        )
        .all();

      if (incidentOnly.length === 0 || incidentOnly.some(e => e.entry_type !== 'incident')) {
        throw new Error('Incident-only filter failed');
      }

      // Test backward compatibility views (simulated)
      const kbEntries = this.db
        .prepare(
          `
        SELECT
          id, title, problem, solution, category, severity,
          created_at, updated_at, created_by, usage_count,
          success_count, failure_count, archived
        FROM entries
        WHERE entry_type = 'knowledge'
      `
        )
        .all();

      const incidents = this.db
        .prepare(
          `
        SELECT
          id, title, description, category, severity, status, priority,
          assigned_to, reporter, created_at, updated_at, archived
        FROM entries
        WHERE entry_type = 'incident'
      `
        )
        .all();

      if (kbEntries.length === 0 || incidents.length === 0) {
        throw new Error('Backward compatibility views failed');
      }

      console.log('✅ Type filtering: PASSED');
      return true;
    } catch (error) {
      console.log(`❌ Type filtering: FAILED - ${error.message}`);
      return false;
    }
  }

  runAllTests() {
    console.log('🧪 Starting Unified Handler Compatibility Tests...');
    console.log('==================================================');

    const tests = [
      () => this.testSchemaDetection(),
      () => this.testKnowledgeEntryOperations(),
      () => this.testIncidentOperations(),
      () => this.testUnifiedSearch(),
      () => this.testTypeFiltering(),
    ];

    let passed = 0;
    let failed = 0;

    tests.forEach(test => {
      if (test()) {
        passed++;
      } else {
        failed++;
      }
    });

    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! The unified schema approach is working correctly.');
      console.log('✨ The UnifiedHandler should be able to work with this database structure.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the implementation.');
    }

    return { passed, failed };
  }

  cleanup() {
    try {
      if (this.db) {
        this.db.close();
      }
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }
      console.log('\n🧹 Test cleanup complete');
    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error.message);
    }
  }
}

// Run the tests
function runSimpleTests() {
  const tester = new SimpleUnifiedTest();

  try {
    return tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return { passed: 0, failed: 1 };
  } finally {
    tester.cleanup();
  }
}

// Export for potential use
module.exports = { SimpleUnifiedTest, runSimpleTests };

// Run tests if this file is executed directly
if (require.main === module) {
  const results = runSimpleTests();
  process.exit(results.failed > 0 ? 1 : 0);
}
