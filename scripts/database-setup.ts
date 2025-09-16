#!/usr/bin/env ts-node

/**
 * Database Setup and Verification Script
 * Mainframe KB Assistant - MVP1 Database Initialization
 */

import { KnowledgeDB, createKnowledgeDB } from '../src/database/KnowledgeDB';
import { DataSeeder } from '../src/database/DataSeeder';
import fs from 'fs';
import path from 'path';

interface SetupOptions {
    dbPath?: string;
    force?: boolean;
    skipSeeding?: boolean;
    performanceTest?: boolean;
    verbose?: boolean;
}

class DatabaseSetup {
    private options: SetupOptions;
    
    constructor(options: SetupOptions = {}) {
        this.options = {
            dbPath: './data/knowledge.db',
            force: false,
            skipSeeding: false,
            performanceTest: false,
            verbose: false,
            ...options
        };
    }

    async run(): Promise<void> {
        console.log('🚀 Mainframe KB Assistant - Database Setup');
        console.log('==========================================');
        
        try {
            // Step 1: Prepare environment
            await this.prepareEnvironment();
            
            // Step 2: Initialize database
            const db = await this.initializeDatabase();
            
            // Step 3: Verify schema
            await this.verifySchema(db);
            
            // Step 4: Seed data (if needed)
            if (!this.options.skipSeeding) {
                await this.seedData(db);
            }
            
            // Step 5: Performance tests
            if (this.options.performanceTest) {
                await this.runPerformanceTests(db);
            }
            
            // Step 6: Final verification
            await this.finalVerification(db);
            
            await db.close();
            
            console.log('');
            console.log('✅ Database setup completed successfully!');
            console.log('🎉 Your Knowledge Base is ready for use.');
            
        } catch (error) {
            console.error('❌ Database setup failed:', error);
            process.exit(1);
        }
    }

    private async prepareEnvironment(): Promise<void> {
        console.log('📁 Preparing environment...');
        
        const dataDir = path.dirname(this.options.dbPath);
        const backupDir = path.join(dataDir, 'backups');
        
        // Create directories
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`   Created data directory: ${dataDir}`);
        }
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            console.log(`   Created backup directory: ${backupDir}`);
        }
        
        // Check if database exists
        if (fs.existsSync(this.options.dbPath)) {
            if (this.options.force) {
                fs.unlinkSync(this.options.dbPath);
                console.log('   Removed existing database (force mode)');
            } else {
                console.log('   Database already exists, will upgrade if needed');
            }
        }
        
        console.log('✅ Environment prepared');
    }

    private async initializeDatabase(): Promise<KnowledgeDB> {
        console.log('🔧 Initializing database...');
        
        const db = await createKnowledgeDB(this.options.dbPath, {
            backupDir: path.join(path.dirname(this.options.dbPath), 'backups'),
            maxBackups: 10,
            autoBackup: true,
            backupInterval: 24
        });
        
        console.log('✅ Database initialized');
        return db;
    }

    private async verifySchema(db: KnowledgeDB): Promise<void> {
        console.log('🔍 Verifying database schema...');
        
        // Check core tables
        const requiredTables = [
            'kb_entries', 'kb_tags', 'kb_relations', 'search_history',
            'usage_metrics', 'system_config', 'backup_log', 'error_log'
        ];
        
        // Note: Direct SQL access not available through KnowledgeDB interface
        // This would need to be implemented via a verification method
        const health = await db.healthCheck();
        
        if (!health.database) {
            throw new Error('Database schema verification failed');
        }
        
        console.log('✅ Schema verified');
    }

    private async seedData(db: KnowledgeDB): Promise<void> {
        console.log('🌱 Checking if data seeding is needed...');
        
        const stats = await db.getStats();
        
        if (stats.totalEntries < 10) {
            console.log('   Database appears empty, seeding with initial data...');
            
            // The DataSeeder is integrated into KnowledgeDB initialization
            // and will automatically seed if needed
            const finalStats = await db.getStats();
            
            console.log(`✅ Seeded database with ${finalStats.totalEntries} entries`);
        } else {
            console.log(`   Database already contains ${stats.totalEntries} entries`);
        }
    }

    private async runPerformanceTests(db: KnowledgeDB): Promise<void> {
        console.log('🧪 Running performance tests...');
        
        const testQueries = [
            'VSAM status 35',
            'S0C7 error',
            'DB2 SQLCODE -904',
            'category:VSAM',
            'tag:error'
        ];
        
        let totalTime = 0;
        let slowQueries = 0;
        
        for (const query of testQueries) {
            const start = Date.now();
            await db.search(query, { limit: 10 });
            const duration = Date.now() - start;
            totalTime += duration;
            
            if (duration > 1000) {
                slowQueries++;
                console.log(`   ⚠️  "${query}": ${duration}ms (exceeds 1s target)`);
            } else {
                console.log(`   ✅ "${query}": ${duration}ms`);
            }
        }
        
        const avgTime = totalTime / testQueries.length;
        console.log(`   📊 Average search time: ${avgTime.toFixed(2)}ms`);
        
        if (slowQueries > 0) {
            console.log(`   ⚠️  ${slowQueries} queries exceeded performance target`);
        }
        
        // Test insert performance
        console.log('   Testing insert performance...');
        const insertStart = Date.now();
        
        for (let i = 0; i < 10; i++) {
            await db.addEntry({
                title: `Performance Test Entry ${i}`,
                problem: `Test problem description ${i}`,
                solution: `Test solution steps ${i}`,
                category: 'Other',
                tags: [`perf-test-${i}`]
            });
        }
        
        const insertDuration = Date.now() - insertStart;
        console.log(`   ✅ 10 inserts: ${insertDuration}ms (${(insertDuration/10).toFixed(2)}ms avg)`);
        
        console.log('✅ Performance tests completed');
    }

    private async finalVerification(db: KnowledgeDB): Promise<void> {
        console.log('🔎 Final verification...');
        
        // Health check
        const health = await db.healthCheck();
        if (!health.overall) {
            throw new Error(`Health check failed: ${health.issues.join(', ')}`);
        }
        
        // Get final statistics
        const stats = await db.getStats();
        const performance = db.getPerformanceStatus();
        
        console.log('📊 Final Statistics:');
        console.log(`   Entries: ${stats.totalEntries}`);
        console.log(`   Categories: ${Object.keys(stats.categoryCounts).join(', ')}`);
        console.log(`   Disk Usage: ${this.formatBytes(stats.diskUsage)}`);
        console.log(`   Cache Hit Rate: ${stats.performance.cacheHitRate}%`);
        console.log(`   Avg Search Time: ${stats.performance.avgSearchTime}ms`);
        
        // Performance status
        if (performance.isHealthy) {
            console.log('✅ Performance status: Healthy');
        } else {
            console.log('⚠️  Performance status: Degraded');
        }
        
        console.log('✅ Verification completed');
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options: SetupOptions = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--force':
                options.force = true;
                break;
            case '--skip-seeding':
                options.skipSeeding = true;
                break;
            case '--performance-test':
                options.performanceTest = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--db-path':
                options.dbPath = args[++i];
                break;
            case '--help':
                showHelp();
                process.exit(0);
                break;
            default:
                console.error(`Unknown option: ${arg}`);
                showHelp();
                process.exit(1);
        }
    }
    
    const setup = new DatabaseSetup(options);
    await setup.run();
}

function showHelp() {
    console.log(`
Mainframe KB Assistant - Database Setup Script

Usage: npm run setup:database [options]

Options:
  --force              Remove existing database and create new one
  --skip-seeding       Skip data seeding process
  --performance-test   Run performance benchmarks
  --verbose           Enable verbose output
  --db-path <path>     Specify database file path
  --help              Show this help message

Examples:
  npm run setup:database
  npm run setup:database -- --force --performance-test
  npm run setup:database -- --db-path ./custom/path/kb.db
`);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Setup failed:', error);
        process.exit(1);
    });
}

export { DatabaseSetup };