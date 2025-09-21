/**
 * Unified Handler Test
 *
 * Simple test to verify the unified handler implementation
 */

import { UnifiedHandler } from '../main/ipc/handlers/UnifiedHandler';
import Database from 'better-sqlite3';
import { writeFileSync, unlinkSync } from 'fs';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class UnifiedHandlerTester {
  private db: Database.Database;
  private handler: UnifiedHandler | null = null;
  private testDbPath: string;

  constructor() {
    this.testDbPath = './test-unified.db';
    this.setupTestDatabase();
  }

  private setupTestDatabase() {
    try {
      // Create test database
      this.db = new Database(this.testDbPath);

      // Create unified entries table
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

      console.log('✅ Test database setup complete');
    } catch (error) {
      console.error('❌ Error setting up test database:', error);
      throw error;
    }
  }

  async runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Initialize the unified handler
      this.handler = new UnifiedHandler(this.db);
      console.log('📊 UnifiedHandler initialized for testing');

      // Run individual tests
      results.push(await this.testSchemaDetection());
      results.push(await this.testKnowledgeEntryCreation());
      results.push(await this.testIncidentCreation());
      results.push(await this.testUnifiedSearch());
      results.push(await this.testStatusTransitions());
      results.push(await this.testBackwardCompatibility());

    } catch (error) {
      results.push({
        name: 'Handler Initialization',
        passed: false,
        error: error.message,
        duration: 0
      });
    }

    return results;
  }

  private async testSchemaDetection(): Promise<TestResult> {
    const start = Date.now();

    try {
      // The handler should have been initialized successfully if schema detection worked
      if (!this.handler) {
        throw new Error('Handler not initialized');
      }

      // Check if the table name was detected correctly
      const tableExists = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='entries'
      `).get() as any;

      if (tableExists.count === 0) {
        throw new Error('Entries table not found');
      }

      return {
        name: 'Schema Detection',
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'Schema Detection',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  private async testKnowledgeEntryCreation(): Promise<TestResult> {
    const start = Date.now();

    try {
      if (!this.handler) {
        throw new Error('Handler not initialized');
      }

      // Test data for knowledge entry
      const testEntry = {
        entry_type: 'knowledge',
        title: 'Test KB Entry',
        problem: 'Test problem description',
        solution: 'Test solution description',
        category: 'JCL',
        severity: 'medium',
        tags: ['test', 'jcl'],
        created_by: 'test-user'
      };

      // Create the entry through the handler (would normally go through IPC)
      const result = await (this.handler as any).createKnowledgeEntryInternal('test-kb-1', testEntry);

      if (!result || !result.id) {
        throw new Error('Failed to create knowledge entry');
      }

      // Verify the entry was created correctly
      const createdEntry = this.db.prepare(`
        SELECT * FROM entries WHERE id = ? AND entry_type = 'knowledge'
      `).get('test-kb-1');

      if (!createdEntry) {
        throw new Error('Knowledge entry not found in database');
      }

      if (createdEntry.title !== testEntry.title ||
          createdEntry.problem !== testEntry.problem ||
          createdEntry.solution !== testEntry.solution) {
        throw new Error('Knowledge entry data mismatch');
      }

      return {
        name: 'Knowledge Entry Creation',
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'Knowledge Entry Creation',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  private async testIncidentCreation(): Promise<TestResult> {
    const start = Date.now();

    try {
      if (!this.handler) {
        throw new Error('Handler not initialized');
      }

      // Test data for incident
      const testIncident = {
        entry_type: 'incident',
        title: 'Test Incident',
        description: 'Test incident description',
        category: 'System',
        severity: 'high',
        status: 'aberto',
        priority: 2,
        reporter: 'test-user',
        tags: ['test', 'system'],
        created_by: 'test-user'
      };

      // Create the incident through the handler
      const result = await (this.handler as any).createIncidentInternal('test-inc-1', testIncident);

      if (!result || !result.id) {
        throw new Error('Failed to create incident');
      }

      // Verify the incident was created correctly
      const createdIncident = this.db.prepare(`
        SELECT * FROM entries WHERE id = ? AND entry_type = 'incident'
      `).get('test-inc-1');

      if (!createdIncident) {
        throw new Error('Incident not found in database');
      }

      if (createdIncident.title !== testIncident.title ||
          createdIncident.description !== testIncident.description ||
          createdIncident.status !== testIncident.status ||
          createdIncident.priority !== testIncident.priority) {
        throw new Error('Incident data mismatch');
      }

      return {
        name: 'Incident Creation',
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'Incident Creation',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  private async testUnifiedSearch(): Promise<TestResult> {
    const start = Date.now();

    try {
      if (!this.handler) {
        throw new Error('Handler not initialized');
      }

      // Test unified search across both entry types
      const searchResult = await (this.handler as any).unifiedSearch('Test', {
        entryTypes: ['knowledge', 'incident'],
        limit: 10
      });

      if (!Array.isArray(searchResult)) {
        throw new Error('Search result is not an array');
      }

      // Should find both the KB entry and incident we created
      if (searchResult.length < 2) {
        throw new Error(`Expected at least 2 results, got ${searchResult.length}`);
      }

      // Verify we have both types in results
      const hasKnowledge = searchResult.some(r => r.entry_type === 'knowledge');
      const hasIncident = searchResult.some(r => r.entry_type === 'incident');

      if (!hasKnowledge) {
        throw new Error('No knowledge entries found in search results');
      }

      if (!hasIncident) {
        throw new Error('No incident entries found in search results');
      }

      return {
        name: 'Unified Search',
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'Unified Search',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  private async testStatusTransitions(): Promise<TestResult> {
    const start = Date.now();

    try {
      if (!this.handler) {
        throw new Error('Handler not initialized');
      }

      // Test incident status update
      await (this.handler as any).updateIncidentStatus('test-inc-1', 'em_tratamento', 'Test status change', 'test-user');

      // Verify status was updated
      const updatedIncident = this.db.prepare(`
        SELECT status FROM entries WHERE id = ? AND entry_type = 'incident'
      `).get('test-inc-1') as any;

      if (!updatedIncident) {
        throw new Error('Incident not found after status update');
      }

      if (updatedIncident.status !== 'em_tratamento') {
        throw new Error(`Expected status 'em_tratamento', got '${updatedIncident.status}'`);
      }

      return {
        name: 'Status Transitions',
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'Status Transitions',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  private async testBackwardCompatibility(): Promise<TestResult> {
    const start = Date.now();

    try {
      if (!this.handler) {
        throw new Error('Handler not initialized');
      }

      // Test that we can get entries using the legacy-style methods
      const kbEntry = await (this.handler as any).getKnowledgeEntry('test-kb-1');
      const incident = await (this.handler as any).getIncident('test-inc-1');

      if (!kbEntry) {
        throw new Error('Failed to get KB entry via legacy method');
      }

      if (!incident) {
        throw new Error('Failed to get incident via legacy method');
      }

      // Verify the data transformation is correct
      if (kbEntry.entry_type !== 'knowledge') {
        throw new Error('KB entry type transformation failed');
      }

      if (incident.entry_type !== 'incident') {
        throw new Error('Incident type transformation failed');
      }

      return {
        name: 'Backward Compatibility',
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'Backward Compatibility',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  cleanup() {
    try {
      if (this.db) {
        this.db.close();
      }
      unlinkSync(this.testDbPath);
      console.log('🧹 Test cleanup complete');
    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error);
    }
  }
}

// Run the tests
async function runUnifiedHandlerTests() {
  console.log('🧪 Starting Unified Handler Tests...\n');

  const tester = new UnifiedHandlerTester();

  try {
    const results = await tester.runTests();

    // Report results
    console.log('\n📊 Test Results:');
    console.log('================');

    let passed = 0;
    let failed = 0;

    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = result.duration.toString().padStart(4);
      console.log(`${status} | ${result.name.padEnd(25)} | ${duration}ms`);

      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }

      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    });

    console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('🎉 All tests passed! Unified handler is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the implementation.');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    tester.cleanup();
  }
}

// Export for use in other test files
export { UnifiedHandlerTester, runUnifiedHandlerTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runUnifiedHandlerTests().catch(console.error);
}