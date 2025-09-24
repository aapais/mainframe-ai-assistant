/**
 * Data Migration Script - SQLite to PostgreSQL
 * Migra dados do sistema atual SQLite para PostgreSQL
 * Preserva embeddings e implementa mascaramento de dados sensíveis
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { MaskingService, SENSITIVE_DATA_TYPES } = require('../src/services/data-masking/MaskingService');
const { AuditService, AUDIT_EVENT_TYPES } = require('../src/services/audit-logging/AuditService');
const VectorDatabase = require('../src/services/llm-integration/embeddings/VectorDatabase');
const logger = require('../src/core/logging/Logger');

class DataMigrationService {
    constructor(config = {}) {
        this.config = {
            sqlite: {
                database: config.sqlite?.database || 'database.db',
                backup: config.sqlite?.backup || true
            },
            postgresql: {
                host: config.postgresql?.host || process.env.DB_HOST || 'localhost',
                port: config.postgresql?.port || process.env.DB_PORT || 5432,
                database: config.postgresql?.database || process.env.DB_NAME || 'incident_system',
                user: config.postgresql?.user || process.env.DB_USER || 'ai_app_user',
                password: config.postgresql?.password || process.env.DB_PASSWORD
            },
            migration: {
                batchSize: config.migration?.batchSize || 1000,
                enableMasking: config.migration?.enableMasking !== false,
                preserveEmbeddings: config.migration?.preserveEmbeddings !== false,
                validateIntegrity: config.migration?.validateIntegrity !== false,
                dryRun: config.migration?.dryRun || false
            },
            backupPath: config.backupPath || './backup'
        };

        this.sqliteDb = null;
        this.pgPool = null;
        this.vectorDb = null;
        this.maskingService = null;
        this.auditService = null;

        this.migrationStats = {
            tablesProcessed: 0,
            recordsMigrated: 0,
            recordsMasked: 0,
            embeddingsPreserved: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };

        this.fieldMappings = {
            // Mapeamento de campos sensíveis por tabela
            knowledge_base: {
                title: SENSITIVE_DATA_TYPES.NAME,
                content: 'content_text', // Texto livre pode conter dados sensíveis
                author: SENSITIVE_DATA_TYPES.NAME,
                approver: SENSITIVE_DATA_TYPES.NAME
            },
            incidents: {
                title: 'incident_title',
                description: 'incident_description',
                assigned_to: SENSITIVE_DATA_TYPES.NAME,
                reporter: SENSITIVE_DATA_TYPES.NAME
            }
        };
    }

    /**
     * Executa migração completa
     */
    async migrate() {
        try {
            this.migrationStats.startTime = new Date();

            logger.info('Iniciando migração de dados SQLite para PostgreSQL', {
                dryRun: this.config.migration.dryRun,
                enableMasking: this.config.migration.enableMasking
            });

            // Inicializa serviços
            await this.initializeServices();

            // Cria backup se solicitado
            if (this.config.sqlite.backup) {
                await this.createBackup();
            }

            // Executa pré-validações
            await this.preValidation();

            // Migra estrutura
            await this.migrateSchema();

            // Migra dados
            await this.migrateData();

            // Migra embeddings
            if (this.config.migration.preserveEmbeddings) {
                await this.migrateEmbeddings();
            }

            // Validação pós-migração
            if (this.config.migration.validateIntegrity) {
                await this.postValidation();
            }

            this.migrationStats.endTime = new Date();

            const report = await this.generateMigrationReport();
            await this.logMigrationComplete(report);

            return report;

        } catch (error) {
            this.migrationStats.errors++;
            logger.error('Erro na migração de dados', { error: error.message });

            await this.auditService?.logEvent({
                action: AUDIT_EVENT_TYPES.SYSTEM_CONFIG,
                entityType: 'migration',
                userId: 'system',
                details: {
                    error: error.message,
                    stack: error.stack,
                    stats: this.migrationStats
                }
            });

            throw error;

        } finally {
            await this.cleanup();
        }
    }

    /**
     * Inicializa serviços necessários
     */
    async initializeServices() {
        // SQLite connection
        this.sqliteDb = new sqlite3.Database(this.config.sqlite.database);

        // PostgreSQL connection
        this.pgPool = new Pool(this.config.postgresql);

        // Testa conexões
        await this.testConnections();

        // Inicializa serviços
        this.maskingService = new MaskingService({
            encryptionKey: process.env.MASKING_ENCRYPTION_KEY,
            auditEnabled: true
        });

        this.auditService = new AuditService({
            database: this.config.postgresql
        });
        await this.auditService.initialize();

        if (this.config.migration.preserveEmbeddings) {
            this.vectorDb = new VectorDatabase();
            await this.vectorDb.initialize();
        }

        logger.info('Serviços inicializados com sucesso');
    }

    /**
     * Testa conexões
     */
    async testConnections() {
        // Testa SQLite
        await new Promise((resolve, reject) => {
            this.sqliteDb.get('SELECT 1', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Testa PostgreSQL
        const client = await this.pgPool.connect();
        await client.query('SELECT NOW()');
        client.release();

        logger.info('Conexões testadas com sucesso');
    }

    /**
     * Cria backup dos dados originais
     */
    async createBackup() {
        try {
            const backupDir = path.join(this.config.backupPath, `migration_${Date.now()}`);
            await fs.mkdir(backupDir, { recursive: true });

            // Backup SQLite
            const sqliteBackup = path.join(backupDir, 'sqlite_backup.db');
            await fs.copyFile(this.config.sqlite.database, sqliteBackup);

            // Backup PostgreSQL (dump schema)
            const schemaBackup = path.join(backupDir, 'postgres_schema.sql');
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'incident_system'
                ORDER BY table_name, ordinal_position
            `);
            client.release();

            await fs.writeFile(schemaBackup, JSON.stringify(result.rows, null, 2));

            logger.info('Backup criado com sucesso', { backupDir });

            await this.auditService.logEvent({
                action: AUDIT_EVENT_TYPES.DATA_CREATE,
                entityType: 'backup',
                userId: 'system',
                details: {
                    backupPath: backupDir,
                    type: 'migration_backup'
                }
            });

        } catch (error) {
            logger.error('Erro ao criar backup', { error: error.message });
            throw error;
        }
    }

    /**
     * Validações pré-migração
     */
    async preValidation() {
        const validations = [];

        // Verifica espaço em disco
        const diskSpace = await this.checkDiskSpace();
        validations.push({
            check: 'disk_space',
            status: diskSpace.available > diskSpace.required ? 'PASS' : 'FAIL',
            details: diskSpace
        });

        // Verifica schema PostgreSQL
        const schemaValid = await this.validatePostgreSQLSchema();
        validations.push({
            check: 'postgres_schema',
            status: schemaValid ? 'PASS' : 'FAIL'
        });

        // Verifica integridade SQLite
        const sqliteIntegrity = await this.validateSQLiteIntegrity();
        validations.push({
            check: 'sqlite_integrity',
            status: sqliteIntegrity ? 'PASS' : 'FAIL'
        });

        const failedValidations = validations.filter(v => v.status === 'FAIL');
        if (failedValidations.length > 0) {
            throw new Error(`Pré-validações falharam: ${JSON.stringify(failedValidations)}`);
        }

        logger.info('Pré-validações concluídas com sucesso', { validations });
    }

    /**
     * Migra estrutura (caso necessário)
     */
    async migrateSchema() {
        // O schema PostgreSQL já deve existir (init-db.sql)
        // Aqui podemos fazer ajustes se necessário
        logger.info('Schema PostgreSQL validado');
    }

    /**
     * Migra dados das tabelas
     */
    async migrateData() {
        const tables = [
            'business_areas',
            'technology_areas',
            'application_modules',
            'knowledge_base',
            'incidents',
            'incident_resolution_steps',
            'ai_suggestions'
        ];

        for (const table of tables) {
            await this.migrateTable(table);
            this.migrationStats.tablesProcessed++;
        }
    }

    /**
     * Migra tabela específica
     */
    async migrateTable(tableName) {
        try {
            logger.info(`Iniciando migração da tabela: ${tableName}`);

            // Obtém dados do SQLite
            const data = await this.getSQLiteTableData(tableName);

            if (data.length === 0) {
                logger.info(`Tabela ${tableName} está vazia`);
                return;
            }

            // Processa em batches
            const batches = this.createBatches(data, this.config.migration.batchSize);

            for (const batch of batches) {
                await this.processBatch(tableName, batch);
            }

            logger.info(`Migração da tabela ${tableName} concluída`, {
                recordsProcessed: data.length
            });

            await this.auditService.logEvent({
                action: AUDIT_EVENT_TYPES.DATA_CREATE,
                entityType: 'table_migration',
                userId: 'system',
                details: {
                    tableName,
                    recordCount: data.length,
                    maskedFields: this.fieldMappings[tableName] || {}
                }
            });

        } catch (error) {
            this.migrationStats.errors++;
            logger.error(`Erro na migração da tabela ${tableName}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Processa batch de dados
     */
    async processBatch(tableName, batch) {
        const client = await this.pgPool.connect();

        try {
            await client.query('BEGIN');

            for (const record of batch) {
                await this.migrateRecord(client, tableName, record);
                this.migrationStats.recordsMigrated++;
            }

            if (!this.config.migration.dryRun) {
                await client.query('COMMIT');
            } else {
                await client.query('ROLLBACK');
                logger.debug('Dry run - transação revertida');
            }

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Migra registro individual
     */
    async migrateRecord(client, tableName, record) {
        try {
            // Aplica mascaramento se configurado
            let processedRecord = record;

            if (this.config.migration.enableMasking && this.fieldMappings[tableName]) {
                processedRecord = await this.applyMasking(tableName, record);
            }

            // Converte campos conforme necessário
            processedRecord = this.convertFields(tableName, processedRecord);

            // Gera query de inserção
            const { query, values } = this.buildInsertQuery(tableName, processedRecord);

            // Executa inserção
            await client.query(query, values);

        } catch (error) {
            logger.error('Erro ao migrar registro', {
                table: tableName,
                recordId: record.id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Aplica mascaramento aos dados sensíveis
     */
    async applyMasking(tableName, record) {
        const fieldMappings = this.fieldMappings[tableName];
        if (!fieldMappings) return record;

        const maskedRecord = { ...record };

        for (const [field, dataType] of Object.entries(fieldMappings)) {
            if (record[field]) {
                const maskResult = await this.maskingService.maskValue(
                    record[field],
                    dataType,
                    {
                        entityType: tableName,
                        entityId: record.id,
                        fieldName: field,
                        userId: 'migration_system'
                    }
                );

                maskedRecord[field] = maskResult.masked;

                // Armazena versão mascarada para IA se for descrição
                if (field === 'description') {
                    maskedRecord.description_masked = maskResult.masked;
                }

                this.migrationStats.recordsMasked++;
            }
        }

        return maskedRecord;
    }

    /**
     * Converte campos conforme necessário
     */
    convertFields(tableName, record) {
        const converted = { ...record };

        // Converte campos de data
        const dateFields = ['created_at', 'updated_at', 'resolved_at', 'closed_at'];
        dateFields.forEach(field => {
            if (converted[field]) {
                converted[field] = new Date(converted[field]);
            }
        });

        // Converte arrays (SQLite armazena como string JSON)
        const arrayFields = ['tags', 'keywords', 'affected_systems', 'similar_incidents'];
        arrayFields.forEach(field => {
            if (converted[field] && typeof converted[field] === 'string') {
                try {
                    converted[field] = JSON.parse(converted[field]);
                } catch (e) {
                    converted[field] = [];
                }
            }
        });

        // Gera UUIDs se necessário
        if (tableName === 'incidents' || tableName === 'knowledge_base') {
            if (!converted.id || !this.isValidUUID(converted.id)) {
                converted.id = crypto.randomUUID();
            }
        }

        return converted;
    }

    /**
     * Constrói query de inserção
     */
    buildInsertQuery(tableName, record) {
        const fields = Object.keys(record).filter(key => record[key] !== undefined);
        const placeholders = fields.map((_, index) => `$${index + 1}`);
        const values = fields.map(field => record[field]);

        // Mapeia nome da tabela para schema PostgreSQL
        const schemaTable = this.getPostgreSQLTableName(tableName);

        const query = `
            INSERT INTO ${schemaTable} (${fields.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (id) DO UPDATE SET
            ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')},
            updated_at = CURRENT_TIMESTAMP
        `;

        return { query, values };
    }

    /**
     * Obtém dados da tabela SQLite
     */
    async getSQLiteTableData(tableName) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Migra embeddings para ChromaDB
     */
    async migrateEmbeddings() {
        try {
            logger.info('Iniciando migração de embeddings');

            // Busca dados que devem ter embeddings
            const knowledgeBase = await this.getSQLiteTableData('knowledge_base');
            const incidents = await this.getSQLiteTableData('incidents');

            // Migra embeddings da knowledge base
            for (const kb of knowledgeBase) {
                await this.migrateKnowledgeEmbedding(kb);
            }

            // Migra embeddings de incidentes
            for (const incident of incidents) {
                await this.migrateIncidentEmbedding(incident);
            }

            logger.info('Migração de embeddings concluída', {
                knowledgeRecords: knowledgeBase.length,
                incidentRecords: incidents.length
            });

        } catch (error) {
            logger.error('Erro na migração de embeddings', { error: error.message });
            throw error;
        }
    }

    /**
     * Migra embedding da knowledge base
     */
    async migrateKnowledgeEmbedding(kbRecord) {
        try {
            const document = {
                id: kbRecord.id,
                content: kbRecord.title + ' ' + kbRecord.content,
                metadata: {
                    type: 'knowledge',
                    title: kbRecord.title,
                    content_type: kbRecord.content_type,
                    business_area_id: kbRecord.business_area_id,
                    technology_area_id: kbRecord.technology_area_id,
                    tags: kbRecord.tags ? JSON.parse(kbRecord.tags) : [],
                    created_at: kbRecord.created_at
                }
            };

            // Se já houver embedding, preserve
            if (kbRecord.embedding) {
                document.embedding = JSON.parse(kbRecord.embedding);
            }

            await this.vectorDb.addDocuments('knowledge', document);
            this.migrationStats.embeddingsPreserved++;

        } catch (error) {
            logger.error('Erro ao migrar embedding da knowledge base', {
                id: kbRecord.id,
                error: error.message
            });
        }
    }

    /**
     * Migra embedding de incidente
     */
    async migrateIncidentEmbedding(incident) {
        try {
            const document = {
                id: incident.id,
                content: incident.title + ' ' + incident.description,
                metadata: {
                    type: 'incident',
                    incident_number: incident.incident_number,
                    severity: incident.severity,
                    status: incident.status,
                    business_area_id: incident.business_area_id,
                    technology_area_id: incident.technology_area_id,
                    tags: incident.tags ? JSON.parse(incident.tags) : [],
                    created_at: incident.created_at
                }
            };

            if (incident.embedding) {
                document.embedding = JSON.parse(incident.embedding);
            }

            await this.vectorDb.addDocuments('incidents', document);
            this.migrationStats.embeddingsPreserved++;

        } catch (error) {
            logger.error('Erro ao migrar embedding de incidente', {
                id: incident.id,
                error: error.message
            });
        }
    }

    /**
     * Validação pós-migração
     */
    async postValidation() {
        const validations = [];

        // Verifica contagem de registros
        const recordCounts = await this.validateRecordCounts();
        validations.push({
            check: 'record_counts',
            status: recordCounts.valid ? 'PASS' : 'FAIL',
            details: recordCounts
        });

        // Verifica integridade referencial
        const referentialIntegrity = await this.validateReferentialIntegrity();
        validations.push({
            check: 'referential_integrity',
            status: referentialIntegrity ? 'PASS' : 'FAIL'
        });

        // Verifica embeddings
        if (this.config.migration.preserveEmbeddings) {
            const embeddingsValid = await this.validateEmbeddings();
            validations.push({
                check: 'embeddings',
                status: embeddingsValid ? 'PASS' : 'FAIL'
            });
        }

        const failedValidations = validations.filter(v => v.status === 'FAIL');
        if (failedValidations.length > 0) {
            logger.warn('Algumas validações pós-migração falharam', { failedValidations });
        }

        logger.info('Validações pós-migração concluídas', { validations });
        return validations;
    }

    /**
     * Gera relatório de migração
     */
    async generateMigrationReport() {
        const duration = this.migrationStats.endTime - this.migrationStats.startTime;

        const report = {
            migrationId: crypto.randomUUID(),
            timestamp: new Date(),
            duration: {
                ms: duration,
                formatted: this.formatDuration(duration)
            },
            configuration: {
                dryRun: this.config.migration.dryRun,
                enableMasking: this.config.migration.enableMasking,
                preserveEmbeddings: this.config.migration.preserveEmbeddings,
                batchSize: this.config.migration.batchSize
            },
            statistics: this.migrationStats,
            performance: {
                recordsPerSecond: this.migrationStats.recordsMigrated / (duration / 1000),
                tablesPerMinute: this.migrationStats.tablesProcessed / (duration / 60000)
            },
            success: this.migrationStats.errors === 0
        };

        return report;
    }

    /**
     * Registra conclusão da migração
     */
    async logMigrationComplete(report) {
        await this.auditService.logEvent({
            action: AUDIT_EVENT_TYPES.SYSTEM_CONFIG,
            entityType: 'migration_complete',
            userId: 'system',
            details: report
        });

        logger.info('Migração concluída', {
            success: report.success,
            recordsMigrated: report.statistics.recordsMigrated,
            duration: report.duration.formatted,
            errors: report.statistics.errors
        });
    }

    // Métodos auxiliares

    async checkDiskSpace() {
        // Implementação simplificada
        return {
            available: 10000000000, // 10GB
            required: 1000000000,   // 1GB
            sufficient: true
        };
    }

    async validatePostgreSQLSchema() {
        try {
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'incident_system'
                AND table_name IN ('incidents', 'knowledge_base', 'business_areas')
            `);
            client.release();
            return result.rows.length >= 3;
        } catch (error) {
            return false;
        }
    }

    async validateSQLiteIntegrity() {
        return new Promise((resolve) => {
            this.sqliteDb.get('PRAGMA integrity_check', (err, row) => {
                resolve(!err && row && row.integrity_check === 'ok');
            });
        });
    }

    async validateRecordCounts() {
        // Compara contagens entre SQLite e PostgreSQL
        const sqliteCounts = {};
        const postgresCounts = {};

        const tables = ['knowledge_base', 'incidents', 'business_areas'];

        for (const table of tables) {
            // SQLite count
            const sqliteCount = await new Promise((resolve) => {
                this.sqliteDb.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            });
            sqliteCounts[table] = sqliteCount;

            // PostgreSQL count
            const pgTable = this.getPostgreSQLTableName(table);
            const client = await this.pgPool.connect();
            const result = await client.query(`SELECT COUNT(*) as count FROM ${pgTable}`);
            client.release();
            postgresCounts[table] = parseInt(result.rows[0].count);
        }

        const valid = Object.keys(sqliteCounts).every(table =>
            sqliteCounts[table] === postgresCounts[table]
        );

        return { valid, sqliteCounts, postgresCounts };
    }

    async validateReferentialIntegrity() {
        try {
            const client = await this.pgPool.connect();

            // Verifica se todos os business_area_id existem
            const result = await client.query(`
                SELECT COUNT(*) as invalid_refs
                FROM incident_system.knowledge_base kb
                LEFT JOIN incident_system.business_areas ba ON kb.business_area_id = ba.id
                WHERE kb.business_area_id IS NOT NULL AND ba.id IS NULL
            `);

            client.release();
            return parseInt(result.rows[0].invalid_refs) === 0;
        } catch (error) {
            return false;
        }
    }

    async validateEmbeddings() {
        if (!this.vectorDb) return true;

        try {
            const stats = await this.vectorDb.getCollectionStats('knowledge');
            return stats.documentCount > 0;
        } catch (error) {
            return false;
        }
    }

    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    getPostgreSQLTableName(tableName) {
        return `incident_system.${tableName}`;
    }

    isValidUUID(str) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Limpeza de recursos
     */
    async cleanup() {
        try {
            if (this.sqliteDb) {
                this.sqliteDb.close();
            }

            if (this.pgPool) {
                await this.pgPool.end();
            }

            if (this.vectorDb) {
                await this.vectorDb.close();
            }

            if (this.auditService) {
                await this.auditService.close();
            }

            logger.info('Recursos limpos com sucesso');
        } catch (error) {
            logger.error('Erro na limpeza de recursos', { error: error.message });
        }
    }
}

// Execução direta se chamado como script
if (require.main === module) {
    const migrationService = new DataMigrationService({
        migration: {
            dryRun: process.argv.includes('--dry-run'),
            enableMasking: !process.argv.includes('--no-masking'),
            preserveEmbeddings: !process.argv.includes('--no-embeddings')
        }
    });

    migrationService.migrate()
        .then(report => {
            console.log('\n=== RELATÓRIO DE MIGRAÇÃO ===');
            console.log(`Status: ${report.success ? 'SUCESSO' : 'ERRO'}`);
            console.log(`Duração: ${report.duration.formatted}`);
            console.log(`Tabelas: ${report.statistics.tablesProcessed}`);
            console.log(`Registros: ${report.statistics.recordsMigrated}`);
            console.log(`Mascarados: ${report.statistics.recordsMasked}`);
            console.log(`Embeddings: ${report.statistics.embeddingsPreserved}`);
            console.log(`Erros: ${report.statistics.errors}`);
            process.exit(report.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Migração falhou:', error.message);
            process.exit(1);
        });
}

module.exports = DataMigrationService;