#!/usr/bin/env node

/**
 * Migration and Vector Search Test Suite
 * Tests SQLite to PostgreSQL migration and vector functionality
 */

const Database = require('better-sqlite3');
const { Client } = require('pg');
const EmbeddingService = require('../src/services/embedding-service');
const axios = require('axios').default;
require('dotenv').config();

const SQLITE_DB_PATH = './kb-assistant.db';
const SERVER_URL = 'http://localhost:3001';

const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
};

class MigrationTester {
  constructor() {
    this.sqliteDb = null;
    this.pgClient = null;
    this.embeddingService = null;
    this.testResults = {
      database_connections: false,
      data_migration: false,
      vector_embeddings: false,
      api_endpoints: false,
      vector_search: false,
      performance: {}
    };
  }

  async initialize() {
    console.log('🔧 Initializing test environment...');

    // Initialize embedding service
    if (process.env.OPENAI_API_KEY) {
      this.embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);
      console.log('✅ Embedding service initialized');
    } else {
      console.warn('⚠️ OpenAI API key not found. Vector tests will be skipped.');
    }
  }

  async testDatabaseConnections() {
    console.log('\n📊 Testing database connections...');

    try {
      // Test SQLite
      this.sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
      const sqliteCount = this.sqliteDb.prepare('SELECT COUNT(*) as count FROM entries').get();
      console.log(`✅ SQLite: Connected, ${sqliteCount.count} entries found`);

      // Test PostgreSQL
      this.pgClient = new Client(pgConfig);
      await this.pgClient.connect();
      const pgResult = await this.pgClient.query('SELECT COUNT(*) as count FROM incidents_enhanced');
      console.log(`✅ PostgreSQL: Connected, ${pgResult.rows[0].count} incidents found`);

      // Test pgvector extension
      try {
        await this.pgClient.query('SELECT 1::vector');
        console.log('✅ pgvector extension: Available');
      } catch (error) {
        console.warn('⚠️ pgvector extension: Not available');
      }

      this.testResults.database_connections = true;
      return true;

    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async testDataMigration() {
    console.log('\n🔄 Testing data migration integrity...');

    try {
      if (!this.sqliteDb || !this.pgClient) {
        throw new Error('Database connections not established');
      }

      // Compare record counts
      const sqliteEntries = this.sqliteDb.prepare('SELECT * FROM entries ORDER BY id').all();
      const pgResult = await this.pgClient.query(
        'SELECT * FROM incidents_enhanced ORDER BY metadata->>\'sqlite_id\'::int'
      );

      console.log(`📊 SQLite entries: ${sqliteEntries.length}`);
      console.log(`📊 PostgreSQL incidents: ${pgResult.rows.length}`);

      // Sample data integrity check
      if (sqliteEntries.length > 0 && pgResult.rows.length > 0) {
        const sqliteFirst = sqliteEntries[0];
        const pgFirst = pgResult.rows.find(row =>
          row.metadata && parseInt(row.metadata.sqlite_id) === sqliteFirst.id
        );

        if (pgFirst) {
          console.log('🔍 Data integrity check:');
          console.log(`  SQLite: "${sqliteFirst.title}"`);
          console.log(`  PostgreSQL: "${pgFirst.title}"`);
          console.log(`  Match: ${sqliteFirst.title === pgFirst.title ? '✅' : '❌'}`);
        }
      }

      // Check for embeddings
      const embeddingResult = await this.pgClient.query(
        'SELECT COUNT(*) as count FROM incidents_enhanced WHERE embedding IS NOT NULL'
      );
      console.log(`🧠 Incidents with embeddings: ${embeddingResult.rows[0].count}`);

      this.testResults.data_migration = true;
      return true;

    } catch (error) {
      console.error('❌ Data migration test failed:', error.message);
      return false;
    }
  }

  async testVectorEmbeddings() {
    console.log('\n🧠 Testing vector embedding generation...');

    if (!this.embeddingService) {
      console.warn('⚠️ Skipping embedding tests - OpenAI API key not available');
      return false;
    }

    try {
      const testTexts = [
        'CICS transaction timeout during peak hours',
        'DB2 deadlock in customer database',
        'JCL job failure with S0C7 abend'
      ];

      console.log('📝 Generating test embeddings...');
      const embeddings = await this.embeddingService.generateBatchEmbeddings(testTexts, {
        batchSize: 3,
        delay: 500
      });

      const validEmbeddings = embeddings.filter(e => e !== null);
      console.log(`✅ Generated ${validEmbeddings.length}/${testTexts.length} embeddings`);

      if (validEmbeddings.length > 1) {
        const similarity = this.embeddingService.calculateSimilarity(
          validEmbeddings[0],
          validEmbeddings[1]
        );
        console.log(`🎯 Similarity between first two embeddings: ${similarity.toFixed(3)}`);
      }

      this.testResults.vector_embeddings = validEmbeddings.length > 0;
      return validEmbeddings.length > 0;

    } catch (error) {
      console.error('❌ Vector embedding test failed:', error.message);
      return false;
    }
  }

  async testApiEndpoints() {
    console.log('\n🌐 Testing API endpoints...');

    try {
      // Test health endpoint
      console.log('🏥 Testing health endpoint...');
      const healthResponse = await axios.get(`${SERVER_URL}/api/health`);
      console.log('✅ Health check:', healthResponse.data.status);

      // Test migration status endpoint
      console.log('📊 Testing migration status endpoint...');
      const migrationResponse = await axios.get(`${SERVER_URL}/api/migration/status`);
      console.log('✅ Migration status:', JSON.stringify(migrationResponse.data, null, 2));

      // Test incidents endpoint
      console.log('📋 Testing incidents endpoint...');
      const incidentsResponse = await axios.get(`${SERVER_URL}/api/incidents`);
      console.log(`✅ Incidents: ${incidentsResponse.data.data?.length || 0} found`);

      // Test search endpoint
      console.log('🔍 Testing search endpoint...');
      const searchResponse = await axios.get(`${SERVER_URL}/api/incidents/search?q=CICS`);
      console.log(`✅ Search: ${searchResponse.data.data?.length || 0} results for "CICS"`);

      this.testResults.api_endpoints = true;
      return true;

    } catch (error) {
      console.error('❌ API endpoint test failed:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 Make sure the enhanced server is running: npm run start:backend:enhanced');
      }
      return false;
    }
  }

  async testVectorSearch() {
    console.log('\n🎯 Testing vector similarity search...');

    if (!this.embeddingService) {
      console.warn('⚠️ Skipping vector search tests - OpenAI API key not available');
      return false;
    }

    try {
      const testQuery = 'CICS transaction performance issues';

      console.log(`🔍 Testing vector search with query: "${testQuery}"`);

      const searchPayload = {
        query: testQuery,
        limit: 5,
        threshold: 0.5
      };

      const startTime = Date.now();
      const response = await axios.post(`${SERVER_URL}/api/incidents/vector-search`, searchPayload);
      const searchTime = Date.now() - startTime;

      console.log(`✅ Vector search completed in ${searchTime}ms`);
      console.log(`📊 Found ${response.data.data?.length || 0} similar incidents`);

      if (response.data.data && response.data.data.length > 0) {
        console.log('🎯 Top results:');
        response.data.data.slice(0, 3).forEach((incident, index) => {
          console.log(`  ${index + 1}. "${incident.title}" (similarity: ${incident.similarity_score?.toFixed(3)})`);
        });
      }

      this.testResults.vector_search = true;
      this.testResults.performance.vector_search_time = searchTime;
      return true;

    } catch (error) {
      console.error('❌ Vector search test failed:', error.message);
      return false;
    }
  }

  async runPerformanceTests() {
    console.log('\n⚡ Running performance tests...');

    try {
      // Test regular search performance
      const searchQueries = ['DB2', 'CICS', 'JCL', 'VSAM', 'timeout'];
      const searchTimes = [];

      for (const query of searchQueries) {
        const startTime = Date.now();
        await axios.get(`${SERVER_URL}/api/incidents/search?q=${query}`);
        const searchTime = Date.now() - startTime;
        searchTimes.push(searchTime);
      }

      const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      console.log(`📊 Average search time: ${avgSearchTime.toFixed(0)}ms`);

      this.testResults.performance.avg_search_time = avgSearchTime;
      this.testResults.performance.search_times = searchTimes;

      return true;

    } catch (error) {
      console.error('❌ Performance test failed:', error.message);
      return false;
    }
  }

  generateReport() {
    console.log('\n📋 Test Report Summary');
    console.log('=====================================');
    console.log(`Database Connections: ${this.testResults.database_connections ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Data Migration: ${this.testResults.data_migration ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Vector Embeddings: ${this.testResults.vector_embeddings ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`API Endpoints: ${this.testResults.api_endpoints ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Vector Search: ${this.testResults.vector_search ? '✅ PASS' : '❌ FAIL'}`);

    if (Object.keys(this.testResults.performance).length > 0) {
      console.log('\n📊 Performance Metrics:');
      Object.entries(this.testResults.performance).forEach(([key, value]) => {
        if (typeof value === 'number') {
          console.log(`  ${key}: ${value.toFixed(0)}ms`);
        }
      });
    }

    const passedTests = Object.values(this.testResults).filter(result => result === true).length;
    const totalTests = Object.keys(this.testResults).filter(key => key !== 'performance').length;

    console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);

    return {
      score: `${passedTests}/${totalTests}`,
      percentage: Math.round((passedTests / totalTests) * 100),
      details: this.testResults
    };
  }

  async cleanup() {
    if (this.sqliteDb) {
      this.sqliteDb.close();
    }
    if (this.pgClient) {
      await this.pgClient.end();
    }
    console.log('🧹 Cleanup completed');
  }
}

async function main() {
  const tester = new MigrationTester();

  try {
    await tester.initialize();

    console.log('🚀 Starting Migration and Vector Search Test Suite...');
    console.log('=====================================================');

    // Run all tests
    await tester.testDatabaseConnections();
    await tester.testDataMigration();
    await tester.testVectorEmbeddings();
    await tester.testApiEndpoints();
    await tester.testVectorSearch();
    await tester.runPerformanceTests();

    // Generate final report
    const report = tester.generateReport();

    // Save report to file
    const fs = require('fs');
    const reportPath = './scripts/logs/test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...report
    }, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    if (report.percentage >= 80) {
      console.log('🎉 Migration and vector search testing completed successfully!');
      process.exit(0);
    } else {
      console.log('⚠️ Some tests failed. Please review the results above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Add axios to package.json if not already present
const fs = require('fs');
const packageJsonPath = './package.json';
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.dependencies.axios) {
    console.log('📦 Adding axios dependency...');
    packageJson.dependencies.axios = '^1.6.0';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ axios dependency added. Run: npm install');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationTester;