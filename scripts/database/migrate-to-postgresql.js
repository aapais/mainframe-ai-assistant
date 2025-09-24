#!/usr/bin/env node

/**
 * Migration script from SQLite to PostgreSQL with pgvector
 * Migrates existing incident data and adds vector embeddings
 */

const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const OpenAI = require('openai');

// Configuration
const config = {
  // Source SQLite database
  sqlite: {
    path: path.join(__dirname, '../../database/incidents.db')
  },

  // Target PostgreSQL database
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'mainframe_ai',
    user: process.env.DB_USER || 'mainframe_user',
    password: process.env.DB_PASSWORD || 'mainframe_pass'
  },

  // OpenAI for generating embeddings
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002'
  },

  // Migration settings
  batchSize: 50,
  retryAttempts: 3,
  retryDelay: 1000
};

class DatabaseMigrator {
  constructor() {
    this.pgClient = null;
    this.sqliteDb = null;
    this.openai = null;
    this.stats = {
      incidents: { total: 0, migrated: 0, errors: 0 },
      knowledge: { total: 0, migrated: 0, errors: 0 }
    };
  }

  async initialize() {
    console.log('🔧 Initializing migration tools...');

    // Initialize PostgreSQL client
    this.pgClient = new Client(config.postgres);
    await this.pgClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Initialize OpenAI client (if API key provided)
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
      console.log('✅ OpenAI client initialized');
    } else {
      console.log('⚠️  OpenAI API key not provided - embeddings will be skipped');
    }

    // Check if SQLite database exists
    try {
      await fs.access(config.sqlite.path);
      console.log('✅ SQLite database found');
    } catch (error) {
      console.log('⚠️  SQLite database not found - will create sample data');
    }
  }

  async generateEmbedding(text) {
    if (!this.openai || !text) return null;

    try {
      const response = await this.openai.embeddings.create({
        model: config.openai.model,
        input: text.substring(0, 8000) // Limit text length
      });

      return JSON.stringify(response.data[0].embedding);
    } catch (error) {
      console.error('Error generating embedding:', error.message);
      return null;
    }
  }

  async migrateIncidents() {
    console.log('\n📊 Migrating incidents...');

    if (!this.sqliteDb) {
      console.log('⚠️  No SQLite database - creating sample incidents');
      await this.createSampleIncidents();
      return;
    }

    return new Promise((resolve, reject) => {
      this.sqliteDb.all(
        "SELECT * FROM incidents ORDER BY created_at",
        async (err, rows) => {
          if (err) {
            console.error('Error reading SQLite incidents:', err);
            reject(err);
            return;
          }

          this.stats.incidents.total = rows.length;
          console.log(`Found ${rows.length} incidents to migrate`);

          for (let i = 0; i < rows.length; i += config.batchSize) {
            const batch = rows.slice(i, i + config.batchSize);
            await this.migrateBatchIncidents(batch);
          }

          resolve();
        }
      );
    });
  }

  async migrateBatchIncidents(incidents) {
    const client = this.pgClient;

    for (const incident of incidents) {
      try {
        // Generate embedding from title and description
        const embeddingText = `${incident.title || ''} ${incident.description || ''}`.trim();
        const embedding = await this.generateEmbedding(embeddingText);

        // Map SQLite fields to PostgreSQL schema
        const mappedIncident = {
          title: incident.title || 'Untitled Incident',
          description: incident.description,
          technical_area: this.mapTechnicalArea(incident.category || incident.technical_area),
          business_area: this.mapBusinessArea(incident.business_area),
          status: this.mapStatus(incident.status),
          priority: this.mapPriority(incident.priority),
          severity: this.mapSeverity(incident.severity),
          assigned_to: incident.assigned_to,
          reporter: incident.reporter || incident.created_by,
          resolution: incident.resolution,
          embedding: embedding,
          metadata: JSON.stringify({
            legacy_id: incident.id,
            migrated_at: new Date().toISOString(),
            original_category: incident.category,
            ...this.parseMetadata(incident.metadata)
          }),
          created_at: this.parseDateTime(incident.created_at),
          updated_at: this.parseDateTime(incident.updated_at),
          resolved_at: this.parseDateTime(incident.resolved_at)
        };

        await client.query(
          `INSERT INTO incidents_enhanced (
            title, description, technical_area, business_area, status, priority,
            severity, assigned_to, reporter, resolution, embedding, metadata,
            created_at, updated_at, resolved_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          )`,
          [
            mappedIncident.title,
            mappedIncident.description,
            mappedIncident.technical_area,
            mappedIncident.business_area,
            mappedIncident.status,
            mappedIncident.priority,
            mappedIncident.severity,
            mappedIncident.assigned_to,
            mappedIncident.reporter,
            mappedIncident.resolution,
            mappedIncident.embedding,
            mappedIncident.metadata,
            mappedIncident.created_at,
            mappedIncident.updated_at,
            mappedIncident.resolved_at
          ]
        );

        this.stats.incidents.migrated++;
        process.stdout.write(`\r✅ Migrated ${this.stats.incidents.migrated}/${this.stats.incidents.total} incidents`);

      } catch (error) {
        this.stats.incidents.errors++;
        console.error(`\nError migrating incident ${incident.id}:`, error.message);
      }
    }
  }

  async createSampleIncidents() {
    console.log('Creating sample incident data...');

    const sampleIncidents = [
      {
        title: 'CICS Transaction ABEND ASRA',
        description: 'CICS transaction ORDP experiencing ASRA abends during peak processing hours. Error occurs in COBOL program ORDPROC at offset +2F4.',
        technical_area: 'CICS',
        business_area: 'BANKING',
        status: 'OPEN',
        priority: 'HIGH',
        severity: 'HIGH',
        reporter: 'OPS_TEAM',
        metadata: { environment: 'PROD', region: 'CICSPROD1' }
      },
      {
        title: 'DB2 Package Not Found',
        description: 'DB2 application failing with SQLCODE -805 (DBRM or package not found). Program CUSTUPDT unable to execute.',
        technical_area: 'DB2',
        business_area: 'BANKING',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        severity: 'CRITICAL',
        assigned_to: 'DBA_TEAM',
        reporter: 'APP_TEAM',
        metadata: { subsystem: 'DB2A', package: 'CUSTUPDT' }
      },
      {
        title: 'JCL S0C7 Data Exception',
        description: 'Nightly batch job CUSTBAT1 failing with S0C7 data exception in step VALIDATE. Invalid numeric data detected.',
        technical_area: 'JCL',
        business_area: 'FINANCE',
        status: 'OPEN',
        priority: 'MEDIUM',
        severity: 'MEDIUM',
        reporter: 'BATCH_OPS',
        metadata: { jobname: 'CUSTBAT1', stepname: 'VALIDATE' }
      },
      {
        title: 'IMS Database Lock Timeout',
        description: 'IMS transactions experiencing database lock timeouts on customer database CUSTDB. Response times degraded.',
        technical_area: 'IMS',
        business_area: 'BANKING',
        status: 'RESOLVED',
        priority: 'HIGH',
        severity: 'HIGH',
        assigned_to: 'IMS_TEAM',
        reporter: 'PERFORMANCE_TEAM',
        resolution: 'Increased lock timeout values and optimized transaction flow',
        metadata: { database: 'CUSTDB', timeout_value: '30' }
      },
      {
        title: 'VSAM Dataset Out of Space',
        description: 'VSAM KSDS dataset PROD.CUSTOMER.MASTER is out of space. New records cannot be added.',
        technical_area: 'VSAM',
        business_area: 'RETAIL',
        status: 'CLOSED',
        priority: 'URGENT',
        severity: 'CRITICAL',
        assigned_to: 'STORAGE_TEAM',
        reporter: 'APP_SUPPORT',
        resolution: 'Extended dataset with secondary allocation and reorganized',
        metadata: { dataset: 'PROD.CUSTOMER.MASTER', allocation: 'extended' }
      }
    ];

    for (const incident of sampleIncidents) {
      try {
        const embeddingText = `${incident.title} ${incident.description}`;
        const embedding = await this.generateEmbedding(embeddingText);

        await this.pgClient.query(
          `INSERT INTO incidents_enhanced (
            title, description, technical_area, business_area, status, priority,
            severity, assigned_to, reporter, resolution, embedding, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            incident.title,
            incident.description,
            incident.technical_area,
            incident.business_area,
            incident.status,
            incident.priority,
            incident.severity,
            incident.assigned_to,
            incident.reporter,
            incident.resolution,
            embedding,
            JSON.stringify(incident.metadata)
          ]
        );

        this.stats.incidents.migrated++;
      } catch (error) {
        this.stats.incidents.errors++;
        console.error('Error creating sample incident:', error.message);
      }
    }

    console.log(`✅ Created ${this.stats.incidents.migrated} sample incidents`);
  }

  async createSampleKnowledgeBase() {
    console.log('\n📚 Creating sample knowledge base...');

    const sampleKnowledge = [
      {
        type: 'TROUBLESHOOTING',
        technical_area: 'CICS',
        business_area: 'BANKING',
        title: 'Resolving CICS ASRA Abends',
        content: `CICS ASRA (Program Check) abends indicate a program exception occurred. Follow these steps:

1. Check the CICS dump for the failing instruction
2. Review program listings at the offset indicated
3. Common causes:
   - Invalid memory addressing
   - Division by zero
   - Invalid packed decimal data
   - Array bounds exceeded

4. Solutions:
   - Validate input data before processing
   - Add defensive programming checks
   - Review COBOL OCCURS clauses
   - Check Working-Storage initialization`,
        tags: ['CICS', 'ASRA', 'abend', 'troubleshooting', 'program-check'],
        confidence_score: 0.95
      },
      {
        type: 'PROCEDURE',
        technical_area: 'DB2',
        business_area: 'BANKING',
        title: 'DB2 Package Binding Procedure',
        content: `To bind a DB2 package and resolve SQLCODE -805:

1. Verify DBRM exists in the DBRM library
2. Check bind authority for the collection
3. Bind the package:
   BIND PACKAGE(collection.package) MEMBER(dbrm) -
   ACTION(REPLACE) ISOLATION(CS) RELEASE(COMMIT)

4. Grant execute authority:
   GRANT EXECUTE ON PACKAGE collection.package TO authid

5. Verify successful bind in SYSIBM.SYSPACKAGE`,
        tags: ['DB2', 'package', 'bind', 'SQLCODE-805', 'procedure'],
        confidence_score: 0.90
      },
      {
        type: 'CODE_SAMPLE',
        technical_area: 'JCL',
        business_area: 'FINANCE',
        title: 'JCL Error Handling with COND Parameter',
        content: `Example JCL with proper error handling:

//STEP010  EXEC PGM=CUSTPROG
//STEPLIB  DD DSN=PROD.LOAD.LIB,DISP=SHR
//SYSPRINT DD SYSOUT=*
//INPUT    DD DSN=PROD.INPUT.DATA,DISP=SHR
//OUTPUT   DD DSN=PROD.OUTPUT.DATA,DISP=(NEW,CATLG,DELETE),
//            SPACE=(TRK,(100,50),RLSE)
//SYSIN    DD *
VALIDATE=YES
ERROR_TOLERANCE=0
/*
//STEP020  EXEC PGM=ERRORCHK,COND=(4,LT,STEP010)
//STEPLIB  DD DSN=PROD.LOAD.LIB,DISP=SHR
//SYSPRINT DD SYSOUT=*

The COND parameter prevents STEP020 from executing if STEP010 return code < 4`,
        tags: ['JCL', 'error-handling', 'COND', 'return-code', 'code-sample'],
        confidence_score: 0.85
      },
      {
        type: 'BEST_PRACTICE',
        technical_area: 'IMS',
        business_area: 'BANKING',
        title: 'IMS Performance Optimization',
        content: `Best practices for IMS performance:

1. Database Design:
   - Use appropriate access methods (HIDAM vs HDAM)
   - Optimize segment layout
   - Consider secondary indexing for frequent searches

2. Transaction Processing:
   - Minimize database calls
   - Use efficient DL/I call sequences
   - Implement proper restart logic

3. Buffer Pool Management:
   - Size buffer pools appropriately
   - Monitor buffer pool hit ratios
   - Use multiple buffer pools for different access patterns

4. Lock Management:
   - Use appropriate isolation levels
   - Minimize lock duration
   - Consider lock escalation parameters`,
        tags: ['IMS', 'performance', 'optimization', 'best-practice', 'DL/I'],
        confidence_score: 0.88
      },
      {
        type: 'REFERENCE',
        technical_area: 'VSAM',
        business_area: 'RETAIL',
        title: 'VSAM Return Codes Reference',
        content: `Common VSAM return codes and meanings:

Return Code 0: Successful completion
Return Code 4: Warning - record not found
Return Code 8: Logical error - duplicate key
Return Code 12: Physical error - I/O error
Return Code 16: Open error - dataset not available
Return Code 20: Catalog error - dataset not cataloged

Register 0 contains additional information:
- Reason codes provide specific error details
- Function codes indicate the operation attempted
- Component codes identify the VSAM component

Use IDCAMS EXAMINE for detailed error analysis`,
        tags: ['VSAM', 'return-codes', 'error-codes', 'reference', 'IDCAMS'],
        confidence_score: 0.92
      }
    ];

    for (const knowledge of sampleKnowledge) {
      try {
        const embeddingText = `${knowledge.title} ${knowledge.content}`;
        const embedding = await this.generateEmbedding(embeddingText);

        await this.pgClient.query(
          `INSERT INTO knowledge_base (
            type, technical_area, business_area, title, content, tags,
            confidence_score, embedding, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            knowledge.type,
            knowledge.technical_area,
            knowledge.business_area,
            knowledge.title,
            knowledge.content,
            knowledge.tags,
            knowledge.confidence_score,
            embedding,
            'MIGRATION_SCRIPT'
          ]
        );

        this.stats.knowledge.migrated++;
      } catch (error) {
        this.stats.knowledge.errors++;
        console.error('Error creating knowledge base entry:', error.message);
      }
    }

    console.log(`✅ Created ${this.stats.knowledge.migrated} knowledge base entries`);
  }

  // Helper methods for data mapping
  mapTechnicalArea(area) {
    const mapping = {
      'cics': 'CICS',
      'db2': 'DB2',
      'ims': 'IMS',
      'jcl': 'JCL',
      'cobol': 'COBOL',
      'vsam': 'VSAM',
      'mainframe': 'z/OS',
      'system': 'z/OS'
    };

    return mapping[area?.toLowerCase()] || area?.toUpperCase() || 'OTHER';
  }

  mapBusinessArea(area) {
    const mapping = {
      'banking': 'BANKING',
      'finance': 'FINANCE',
      'insurance': 'INSURANCE',
      'retail': 'RETAIL',
      'manufacturing': 'MANUFACTURING',
      'healthcare': 'HEALTHCARE',
      'government': 'GOVERNMENT'
    };

    return mapping[area?.toLowerCase()] || area?.toUpperCase() || null;
  }

  mapStatus(status) {
    const mapping = {
      'new': 'OPEN',
      'open': 'OPEN',
      'assigned': 'IN_PROGRESS',
      'in_progress': 'IN_PROGRESS',
      'working': 'IN_PROGRESS',
      'resolved': 'RESOLVED',
      'closed': 'CLOSED',
      'cancelled': 'CANCELLED'
    };

    return mapping[status?.toLowerCase()] || 'OPEN';
  }

  mapPriority(priority) {
    const mapping = {
      '1': 'CRITICAL',
      '2': 'HIGH',
      '3': 'MEDIUM',
      '4': 'LOW',
      'critical': 'CRITICAL',
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW',
      'urgent': 'URGENT'
    };

    return mapping[priority?.toLowerCase()] || 'MEDIUM';
  }

  mapSeverity(severity) {
    return this.mapPriority(severity); // Same mapping as priority
  }

  parseDateTime(dateTime) {
    if (!dateTime) return null;

    try {
      return new Date(dateTime).toISOString();
    } catch (error) {
      return null;
    }
  }

  parseMetadata(metadata) {
    try {
      return typeof metadata === 'string' ? JSON.parse(metadata) : metadata || {};
    } catch (error) {
      return {};
    }
  }

  async openSqliteDatabase() {
    try {
      await fs.access(config.sqlite.path);
      this.sqliteDb = new sqlite3.Database(config.sqlite.path);
      console.log('✅ SQLite database opened');
    } catch (error) {
      console.log('⚠️  SQLite database not found - will create sample data');
    }
  }

  async closeDatabases() {
    if (this.sqliteDb) {
      this.sqliteDb.close();
    }

    if (this.pgClient) {
      await this.pgClient.end();
    }
  }

  async printSummary() {
    console.log('\n\n📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Incidents: ${this.stats.incidents.migrated}/${this.stats.incidents.total} migrated, ${this.stats.incidents.errors} errors`);
    console.log(`Knowledge: ${this.stats.knowledge.migrated}/${this.stats.knowledge.total} migrated, ${this.stats.knowledge.errors} errors`);
    console.log('\n✅ Migration completed successfully!');

    if (this.stats.incidents.migrated > 0 || this.stats.knowledge.migrated > 0) {
      console.log('\n🔍 Next steps:');
      console.log('1. Verify data in PostgreSQL: SELECT COUNT(*) FROM incidents_enhanced;');
      console.log('2. Test vector similarity search: SELECT * FROM search_similar_incidents(...);');
      console.log('3. Update application connection strings to use PostgreSQL');
      console.log('4. Run application tests to verify functionality');
    }
  }

  async run() {
    try {
      console.log('🚀 Starting database migration to PostgreSQL with pgvector...\n');

      await this.initialize();
      await this.openSqliteDatabase();
      await this.migrateIncidents();
      await this.createSampleKnowledgeBase();
      await this.printSummary();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      await this.closeDatabases();
    }
  }
}

// Main execution
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  migrator.run().catch(console.error);
}

module.exports = DatabaseMigrator;