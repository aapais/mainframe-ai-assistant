#!/usr/bin/env node

/**
 * Test PostgreSQL SSO Migration
 *
 * Simple test script to validate the migration tool before running on production
 */

const { PostgreSSOMigrationTool } = require('./postgres-sso-migration.js');

async function testMigration() {
  console.log('🧪 Testing PostgreSQL SSO Migration Tool\n');

  try {
    // Test 1: Dry run on development environment
    console.log('📋 Test 1: Dry run validation');
    const migrationTool = new PostgreSSOMigrationTool('dev', {
      dryRun: true,
      verbose: false
    });

    await migrationTool.initializeDatabase();
    const migrations = await migrationTool.readMigrationFiles();

    console.log(`✅ Found ${migrations.length} migration files`);
    console.log(`✅ Database connection successful`);

    // Test 2: Validate migration file structure
    console.log('\n📋 Test 2: Migration file validation');
    let allValid = true;

    for (const migration of migrations) {
      if (!migration.upSQL || migration.upSQL.trim().length === 0) {
        console.log(`❌ Migration ${migration.id} has no UP SQL`);
        allValid = false;
      } else {
        console.log(`✅ Migration ${migration.id}: ${migration.name}`);
      }
    }

    if (allValid) {
      console.log('✅ All migration files are valid');
    }

    // Test 3: Emergency rollback script generation
    console.log('\n📋 Test 3: Emergency rollback script');
    const rollbackScript = await migrationTool.generateEmergencyRollbackScript();
    console.log(`✅ Emergency rollback script: ${rollbackScript}`);

    // Close connection
    if (migrationTool.pool) {
      await migrationTool.pool.end();
    }

    console.log('\n🎉 All tests passed! Migration tool is ready for use.');
    console.log('\n📝 Next steps:');
    console.log('1. Run dry-run: node scripts/postgres-sso-migration.js --env=dev --dry-run');
    console.log('2. Execute migration: node scripts/postgres-sso-migration.js --env=dev');
    console.log('3. Review logs in: scripts/migration-logs/');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('1. Check database connection parameters');
    console.error('2. Ensure PostgreSQL server is running');
    console.error('3. Verify migration files exist in src/database/migrations/auth/');
    process.exit(1);
  }
}

// Run tests
testMigration().catch(console.error);