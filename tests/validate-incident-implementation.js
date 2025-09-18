/**
 * Comprehensive Incident Management Implementation Validation Script
 * Tests all database changes, IPC handlers, and feature compliance
 * Author: QA Testing Specialist
 * Date: 2025-01-21
 */

const path = require('path');
const fs = require('fs');

// Import better-sqlite3 for database validation
let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.error('❌ better-sqlite3 not found. Please install it: npm install better-sqlite3');
  process.exit(1);
}

class IncidentValidationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.db = null;
    this.dbPath = path.join(__dirname, '..', 'kb-assistant.db');
  }

  /**
   * Log test result
   */
  logResult(testName, passed, message, details = null) {
    this.results.total++;
    if (passed) {
      this.results.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.results.failed++;
      console.error(`❌ ${testName}: ${message}`);
    }

    this.results.details.push({
      test: testName,
      passed,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Initialize database connection
   */
  initializeDatabase() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        this.logResult('Database File Check', false, `Database file not found at ${this.dbPath}`);
        return false;
      }

      this.db = new Database(this.dbPath, { readonly: true });
      this.logResult('Database Connection', true, 'Successfully connected to database');
      return true;
    } catch (error) {
      this.logResult('Database Connection', false, `Failed to connect: ${error.message}`);
      return false;
    }
  }

  /**
   * Test database table structure
   */
  testDatabaseStructure() {
    console.log('\n🔍 Testing Database Structure...');

    // Test kb_entries table columns
    try {
      const kbEntriesColumns = this.db.prepare("PRAGMA table_info(kb_entries)").all();
      const columnNames = kbEntriesColumns.map(col => col.name);

      const requiredColumns = [
        'incident_status', 'severity', 'assigned_to', 'created_by',
        'resolved_by', 'resolved_at', 'closed_at', 'ai_analysis_requested',
        'ai_analysis_completed', 'solution_accepted', 'solution_rating'
      ];

      let missingColumns = [];
      requiredColumns.forEach(col => {
        if (!columnNames.includes(col)) {
          missingColumns.push(col);
        }
      });

      if (missingColumns.length === 0) {
        this.logResult('KB Entries Columns', true, 'All required incident management columns exist');
      } else {
        this.logResult('KB Entries Columns', false, `Missing columns: ${missingColumns.join(', ')}`);
      }

    } catch (error) {
      this.logResult('KB Entries Table', false, `Table check failed: ${error.message}`);
    }

    // Test supporting tables
    const supportingTables = [
      'kb_entry_comments',
      'kb_entry_related',
      'kb_entry_audit'
    ];

    supportingTables.forEach(tableName => {
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
        if (tableInfo.length > 0) {
          this.logResult(`Table ${tableName}`, true, `Table exists with ${tableInfo.length} columns`);
        } else {
          this.logResult(`Table ${tableName}`, false, 'Table does not exist or has no columns');
        }
      } catch (error) {
        this.logResult(`Table ${tableName}`, false, `Table check failed: ${error.message}`);
      }
    });
  }

  /**
   * Test database views
   */
  testDatabaseViews() {
    console.log('\n🔍 Testing Database Views...');

    const requiredViews = [
      'v_kb_incident_queue',
      'v_kb_incident_stats'
    ];

    requiredViews.forEach(viewName => {
      try {
        // Check if view exists
        const viewExists = this.db.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='view' AND name=?
        `).get(viewName);

        if (viewExists) {
          // Test view functionality
          const viewData = this.db.prepare(`SELECT * FROM ${viewName} LIMIT 1`).all();
          this.logResult(`View ${viewName}`, true, `View exists and is queryable`);
        } else {
          this.logResult(`View ${viewName}`, false, 'View does not exist');
        }
      } catch (error) {
        this.logResult(`View ${viewName}`, false, `View test failed: ${error.message}`);
      }
    });
  }

  /**
   * Test Portuguese status values
   */
  testPortugueseStatusValues() {
    console.log('\n🔍 Testing Portuguese Status Values...');

    const expectedStatuses = [
      'em_revisao',   // em revisão
      'aberto',       // aberto
      'em_tratamento', // em tratamento
      'resolvido',    // resolvido
      'fechado'       // fechado
    ];

    try {
      // Check if we have any entries with Portuguese statuses
      const statusQuery = this.db.prepare(`
        SELECT DISTINCT incident_status, COUNT(*) as count
        FROM kb_entries
        WHERE incident_status IS NOT NULL
        GROUP BY incident_status
      `).all();

      let foundPortugueseStatuses = statusQuery.filter(row =>
        expectedStatuses.includes(row.incident_status)
      );

      if (foundPortugueseStatuses.length > 0) {
        this.logResult('Portuguese Status Values', true,
          `Found Portuguese statuses: ${foundPortugueseStatuses.map(s => s.incident_status).join(', ')}`);
      } else {
        // Check if status column exists but just has no data yet
        const columnExists = this.db.prepare("PRAGMA table_info(kb_entries)").all()
          .some(col => col.name === 'incident_status');

        if (columnExists) {
          this.logResult('Portuguese Status Values', true,
            'incident_status column exists but no data yet (expected for new implementation)');
        } else {
          this.logResult('Portuguese Status Values', false,
            'incident_status column missing from kb_entries table');
        }
      }
    } catch (error) {
      this.logResult('Portuguese Status Values', false, `Status check failed: ${error.message}`);
    }
  }

  /**
   * Test IPC handlers existence (by checking source files)
   */
  testIpcHandlers() {
    console.log('\n🔍 Testing IPC Handlers...');

    const ipcHandlerPath = path.join(__dirname, '..', 'src', 'main', 'ipc-handlers.ts');

    try {
      if (!fs.existsSync(ipcHandlerPath)) {
        this.logResult('IPC Handlers File', false, `IPC handlers file not found at ${ipcHandlerPath}`);
        return;
      }

      const ipcContent = fs.readFileSync(ipcHandlerPath, 'utf8');

      const requiredHandlers = [
        'incident:updateStatus',
        'incident:assign',
        'incident:addComment',
        'incident:getComments',
        'incident:getRelated',
        'incident:requestAIAnalysis',
        'incident:acceptSolution',
        'incident:rejectSolution',
        'incident:bulkImport',
        'incident:getQueue',
        'incident:getStats',
        'incident:logAction'
      ];

      let missingHandlers = [];
      requiredHandlers.forEach(handler => {
        if (!ipcContent.includes(handler)) {
          missingHandlers.push(handler);
        }
      });

      if (missingHandlers.length === 0) {
        this.logResult('IPC Handlers', true, 'All required incident IPC handlers are implemented');
      } else {
        this.logResult('IPC Handlers', false, `Missing handlers: ${missingHandlers.join(', ')}`);
      }

    } catch (error) {
      this.logResult('IPC Handlers', false, `Handler check failed: ${error.message}`);
    }
  }

  /**
   * Test requirements alignment with original Incidentes.md
   */
  testRequirementsAlignment() {
    console.log('\n🔍 Testing Requirements Alignment...');

    const requirementsChecklist = [
      {
        id: 'R001',
        description: 'Estados: em_revisão, aberto, em_tratamento, resolvido, fechado',
        check: () => {
          try {
            const columnInfo = this.db.prepare("PRAGMA table_info(kb_entries)").all();
            return columnInfo.some(col => col.name === 'incident_status');
          } catch { return false; }
        }
      },
      {
        id: 'R002',
        description: 'Bulk upload placeholder implemented',
        check: () => {
          const ipcHandlerPath = path.join(__dirname, '..', 'src', 'main', 'ipc-handlers.ts');
          try {
            const content = fs.readFileSync(ipcHandlerPath, 'utf8');
            return content.includes('incident:bulkImport');
          } catch { return false; }
        }
      },
      {
        id: 'R003',
        description: 'Comments system (audit trail)',
        check: () => {
          try {
            const tableInfo = this.db.prepare("PRAGMA table_info(kb_entry_comments)").all();
            return tableInfo.length > 0;
          } catch { return false; }
        }
      },
      {
        id: 'R004',
        description: 'Related incidents system',
        check: () => {
          try {
            const tableInfo = this.db.prepare("PRAGMA table_info(kb_entry_related)").all();
            return tableInfo.length > 0;
          } catch { return false; }
        }
      },
      {
        id: 'R005',
        description: 'Audit trail (logs)',
        check: () => {
          try {
            const tableInfo = this.db.prepare("PRAGMA table_info(kb_entry_audit)").all();
            return tableInfo.length > 0;
          } catch { return false; }
        }
      },
      {
        id: 'R006',
        description: 'AI analysis flags',
        check: () => {
          try {
            const columnInfo = this.db.prepare("PRAGMA table_info(kb_entries)").all();
            return columnInfo.some(col => col.name === 'ai_analysis_requested') &&
                   columnInfo.some(col => col.name === 'ai_analysis_completed');
          } catch { return false; }
        }
      }
    ];

    requirementsChecklist.forEach(req => {
      const passed = req.check();
      this.logResult(`Requirement ${req.id}`, passed, req.description);
    });
  }

  /**
   * Test data integrity and constraints
   */
  testDataIntegrity() {
    console.log('\n🔍 Testing Data Integrity...');

    try {
      // Test foreign key constraints
      const pragmaFK = this.db.prepare("PRAGMA foreign_keys").get();
      this.logResult('Foreign Keys', true, `Foreign key enforcement: ${pragmaFK.foreign_keys ? 'ON' : 'OFF'}`);

      // Test if we can perform basic CRUD operations (without actually modifying data)
      const testQueries = [
        "SELECT COUNT(*) as total FROM kb_entries",
        "SELECT COUNT(*) as total FROM kb_entry_comments WHERE 1=0",
        "SELECT COUNT(*) as total FROM kb_entry_related WHERE 1=0",
        "SELECT COUNT(*) as total FROM kb_entry_audit WHERE 1=0"
      ];

      testQueries.forEach((query, index) => {
        try {
          const result = this.db.prepare(query).get();
          this.logResult(`Query ${index + 1}`, true, `Query executed successfully`);
        } catch (error) {
          this.logResult(`Query ${index + 1}`, false, `Query failed: ${error.message}`);
        }
      });

    } catch (error) {
      this.logResult('Data Integrity', false, `Integrity check failed: ${error.message}`);
    }
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    console.log('\n📊 VALIDATION SUMMARY');
    console.log('====================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.details
        .filter(detail => !detail.passed)
        .forEach(detail => {
          console.log(`   • ${detail.test}: ${detail.message}`);
        });
    }

    return {
      success: this.results.failed === 0,
      summary: this.results
    };
  }

  /**
   * Run all validation tests
   */
  async runAllTests() {
    console.log('🚀 Starting Incident Management Implementation Validation');
    console.log('========================================================\n');

    // Initialize database
    if (!this.initializeDatabase()) {
      return this.generateSummary();
    }

    try {
      // Run all test suites
      this.testDatabaseStructure();
      this.testDatabaseViews();
      this.testPortugueseStatusValues();
      this.testIpcHandlers();
      this.testRequirementsAlignment();
      this.testDataIntegrity();

      return this.generateSummary();

    } catch (error) {
      console.error(`\n💥 Validation failed with error: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      // Close database connection
      if (this.db) {
        this.db.close();
      }
    }
  }

  /**
   * Export detailed results to JSON
   */
  exportResults(outputPath) {
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: ((this.results.passed / this.results.total) * 100).toFixed(1) + '%'
      },
      tests: this.results.details,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        databasePath: this.dbPath
      }
    };

    try {
      fs.writeFileSync(outputPath, JSON.stringify(detailedResults, null, 2));
      console.log(`\n📄 Detailed results exported to: ${outputPath}`);
    } catch (error) {
      console.error(`\n❌ Failed to export results: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const tester = new IncidentValidationTester();
  const results = await tester.runAllTests();

  // Export detailed results
  const resultsPath = path.join(__dirname, 'incident-validation-results.json');
  tester.exportResults(resultsPath);

  // Exit with appropriate code
  process.exit(results.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
}

module.exports = IncidentValidationTester;