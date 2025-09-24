/**
 * Backup and Restore Service - Sistema de Backup e Restore para Dados Sensíveis
 * Compliance: LGPD, SOX, BACEN
 *
 * Implementa backup seguro com:
 * - Criptografia de dados sensíveis
 * - Validação de integridade
 * - Compliance com retenção regulatória
 * - Restore com verificação de auditoria
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const { MaskingService } = require('../src/services/data-masking/MaskingService');
const { AuditService, AUDIT_EVENT_TYPES } = require('../src/services/audit-logging/AuditService');
const VectorDatabase = require('../src/services/llm-integration/embeddings/VectorDatabase');
const logger = require('../src/core/logging/Logger');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class BackupRestoreService {
    constructor(config = {}) {
        this.config = {
            database: {
                host: config.database?.host || process.env.DB_HOST || 'localhost',
                port: config.database?.port || process.env.DB_PORT || 5432,
                database: config.database?.database || process.env.DB_NAME || 'incident_system',
                user: config.database?.user || process.env.DB_USER || 'ai_app_user',
                password: config.database?.password || process.env.DB_PASSWORD
            },
            backup: {
                basePath: config.backup?.basePath || './backups',
                encryption: {
                    enabled: config.backup?.encryption?.enabled !== false,
                    algorithm: config.backup?.encryption?.algorithm || 'aes-256-gcm',
                    key: config.backup?.encryption?.key || process.env.BACKUP_ENCRYPTION_KEY
                },
                compression: {
                    enabled: config.backup?.compression?.enabled !== false,
                    level: config.backup?.compression?.level || 9
                },
                retention: {
                    daily: config.backup?.retention?.daily || 30,
                    weekly: config.backup?.retention?.weekly || 12,
                    monthly: config.backup?.retention?.monthly || 24,
                    yearly: config.backup?.retention?.yearly || 7
                },
                verification: {
                    enabled: config.backup?.verification?.enabled !== false,
                    checksumAlgorithm: config.backup?.verification?.checksumAlgorithm || 'sha256'
                }
            },
            vectorDb: {
                enabled: config.vectorDb?.enabled !== false,
                backupEmbeddings: config.vectorDb?.backupEmbeddings !== false
            },
            compliance: {
                lgpd: config.compliance?.lgpd !== false,
                sox: config.compliance?.sox !== false,
                bacen: config.compliance?.bacen !== false,
                auditTrail: config.compliance?.auditTrail !== false
            }
        };

        this.pgPool = null;
        this.vectorDb = null;
        this.maskingService = null;
        this.auditService = null;

        this.backupStats = {
            startTime: null,
            endTime: null,
            tablesBackedUp: 0,
            recordsBackedUp: 0,
            fileSizeBytes: 0,
            compressedSizeBytes: 0,
            checksums: {},
            errors: []
        };

        if (!this.config.backup.encryption.key) {
            throw new Error('Chave de criptografia de backup não configurada');
        }
    }

    /**
     * Inicializa serviços necessários
     */
    async initialize() {
        try {
            // PostgreSQL connection
            this.pgPool = new Pool(this.config.database);

            // Testa conexão
            const client = await this.pgPool.connect();
            await client.query('SELECT NOW()');
            client.release();

            // Inicializa serviços
            this.maskingService = new MaskingService({
                encryptionKey: this.config.backup.encryption.key,
                auditEnabled: true
            });

            this.auditService = new AuditService({
                database: this.config.database
            });
            await this.auditService.initialize();

            if (this.config.vectorDb.enabled) {
                this.vectorDb = new VectorDatabase();
                await this.vectorDb.initialize();
            }

            // Cria diretórios de backup
            await this.ensureBackupDirectories();

            logger.info('Backup/Restore Service inicializado', {
                encryption: this.config.backup.encryption.enabled,
                compression: this.config.backup.compression.enabled,
                vectorDb: this.config.vectorDb.enabled
            });

        } catch (error) {
            logger.error('Erro na inicialização do Backup/Restore Service', { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup completo do sistema
     */
    async createFullBackup(options = {}) {
        try {
            this.backupStats.startTime = new Date();
            const backupId = this.generateBackupId();
            const backupPath = this.getBackupPath(backupId);

            logger.info('Iniciando backup completo', {
                backupId,
                backupPath,
                encryption: this.config.backup.encryption.enabled
            });

            // Cria estrutura de backup
            await this.createBackupStructure(backupPath);

            // Backup do banco de dados
            await this.backupDatabase(backupPath, backupId);

            // Backup de embeddings (se habilitado)
            if (this.config.vectorDb.enabled && this.config.vectorDb.backupEmbeddings) {
                await this.backupEmbeddings(backupPath, backupId);
            }

            // Backup de logs de auditoria
            if (this.config.compliance.auditTrail) {
                await this.backupAuditLogs(backupPath, backupId);
            }

            // Backup de configurações e metadados
            await this.backupMetadata(backupPath, backupId);

            // Verifica integridade
            if (this.config.backup.verification.enabled) {
                await this.verifyBackupIntegrity(backupPath);
            }

            // Compacta backup final
            const finalBackupPath = await this.compressBackup(backupPath, backupId);

            this.backupStats.endTime = new Date();

            // Gera relatório
            const report = await this.generateBackupReport(backupId, finalBackupPath);

            // Registra auditoria
            await this.auditBackupOperation(backupId, report);

            // Limpa backups antigos
            await this.cleanupOldBackups();

            logger.info('Backup completo concluído', {
                backupId,
                duration: this.backupStats.endTime - this.backupStats.startTime,
                finalPath: finalBackupPath
            });

            return report;

        } catch (error) {
            this.backupStats.errors.push(error.message);
            logger.error('Erro no backup completo', { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup do banco de dados
     */
    async backupDatabase(backupPath, backupId) {
        try {
            logger.info('Iniciando backup do banco de dados');

            const databaseBackupPath = path.join(backupPath, 'database');
            await fs.mkdir(databaseBackupPath, { recursive: true });

            // Backup por schema
            await this.backupSchema('incident_system', databaseBackupPath);
            await this.backupSchema('audit_system', databaseBackupPath);
            await this.backupSchema('ml_system', databaseBackupPath);

            // Backup de dados específicos
            await this.backupSensitiveData(databaseBackupPath);

            logger.info('Backup do banco de dados concluído');

        } catch (error) {
            logger.error('Erro no backup do banco de dados', { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup de schema específico
     */
    async backupSchema(schemaName, backupPath) {
        try {
            const schemaPath = path.join(backupPath, `${schemaName}.sql`);

            // Usando pg_dump para backup estrutural
            const dumpCommand = this.buildPgDumpCommand(schemaName, schemaPath);
            await this.executeCommand(dumpCommand);

            // Backup de dados com mascaramento se necessário
            if (schemaName === 'incident_system') {
                await this.backupSchemaDataWithMasking(schemaName, backupPath);
            } else {
                await this.backupSchemaData(schemaName, backupPath);
            }

            this.backupStats.tablesBackedUp++;

        } catch (error) {
            logger.error(`Erro no backup do schema ${schemaName}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup de dados com mascaramento
     */
    async backupSchemaDataWithMasking(schemaName, backupPath) {
        const sensitiveTables = ['incidents', 'knowledge_base'];

        for (const table of sensitiveTables) {
            await this.backupTableWithMasking(schemaName, table, backupPath);
        }
    }

    /**
     * Executa backup de tabela com mascaramento
     */
    async backupTableWithMasking(schemaName, tableName, backupPath) {
        try {
            const client = await this.pgPool.connect();

            // Obtém dados da tabela
            const query = `SELECT * FROM ${schemaName}.${tableName}`;
            const result = await client.query(query);
            client.release();

            if (result.rows.length === 0) {
                logger.info(`Tabela ${tableName} está vazia`);
                return;
            }

            // Aplica mascaramento nos dados sensíveis
            const maskedData = [];
            for (const row of result.rows) {
                const maskedRow = await this.maskingService.maskObject(
                    row,
                    this.getSensitiveFields(tableName),
                    {
                        entityType: tableName,
                        entityId: row.id,
                        userId: 'backup_system'
                    }
                );
                maskedData.push(maskedRow.maskedObject);
            }

            // Salva dados mascarados
            const tableBackupPath = path.join(backupPath, `${tableName}_masked.json`);
            const encryptedData = await this.encryptData(JSON.stringify(maskedData));
            await fs.writeFile(tableBackupPath, encryptedData);

            // Salva dados originais criptografados (para restore completo)
            const originalBackupPath = path.join(backupPath, `${tableName}_original.enc`);
            const originalEncrypted = await this.encryptData(JSON.stringify(result.rows));
            await fs.writeFile(originalBackupPath, originalEncrypted);

            this.backupStats.recordsBackedUp += result.rows.length;

            logger.info(`Backup da tabela ${tableName} concluído`, {
                records: result.rows.length,
                masked: true
            });

        } catch (error) {
            logger.error(`Erro no backup da tabela ${tableName}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup de dados regulares
     */
    async backupSchemaData(schemaName, backupPath) {
        const client = await this.pgPool.connect();

        try {
            // Obtém lista de tabelas
            const tablesQuery = `
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = $1
                AND table_type = 'BASE TABLE'
            `;

            const tablesResult = await client.query(tablesQuery, [schemaName]);

            for (const table of tablesResult.rows) {
                const tableName = table.table_name;
                const dataQuery = `SELECT * FROM ${schemaName}.${tableName}`;
                const dataResult = await client.query(dataQuery);

                if (dataResult.rows.length > 0) {
                    const tableBackupPath = path.join(backupPath, `${tableName}.json`);
                    const encryptedData = await this.encryptData(JSON.stringify(dataResult.rows));
                    await fs.writeFile(tableBackupPath, encryptedData);

                    this.backupStats.recordsBackedUp += dataResult.rows.length;
                }
            }

        } finally {
            client.release();
        }
    }

    /**
     * Executa backup de dados sensíveis especiais
     */
    async backupSensitiveData(backupPath) {
        try {
            const sensitiveDataPath = path.join(backupPath, 'sensitive');
            await fs.mkdir(sensitiveDataPath, { recursive: true });

            // Backup de logs de mascaramento
            await this.backupMaskingLogs(sensitiveDataPath);

            // Backup de tokens de mascaramento (se reversível)
            await this.backupMaskingTokens(sensitiveDataPath);

        } catch (error) {
            logger.error('Erro no backup de dados sensíveis', { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup de embeddings
     */
    async backupEmbeddings(backupPath, backupId) {
        try {
            if (!this.vectorDb) {
                logger.warn('VectorDB não inicializado, pulando backup de embeddings');
                return;
            }

            logger.info('Iniciando backup de embeddings');

            const embeddingsPath = path.join(backupPath, 'embeddings');
            await fs.mkdir(embeddingsPath, { recursive: true });

            // Lista collections
            const collections = await this.vectorDb.listCollections();

            for (const collection of collections) {
                await this.backupCollection(collection.name, embeddingsPath);
            }

            logger.info('Backup de embeddings concluído', {
                collections: collections.length
            });

        } catch (error) {
            logger.error('Erro no backup de embeddings', { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup de collection específica
     */
    async backupCollection(collectionName, embeddingsPath) {
        try {
            const collectionBackup = await this.vectorDb.backupCollection(collectionName);
            const collectionPath = path.join(embeddingsPath, `${collectionName}.json`);

            const encryptedData = await this.encryptData(JSON.stringify(collectionBackup));
            await fs.writeFile(collectionPath, encryptedData);

            logger.info(`Collection ${collectionName} backup concluído`, {
                documents: collectionBackup.count
            });

        } catch (error) {
            logger.error(`Erro no backup da collection ${collectionName}`, { error: error.message });
        }
    }

    /**
     * Executa backup de logs de auditoria
     */
    async backupAuditLogs(backupPath, backupId) {
        try {
            logger.info('Iniciando backup de logs de auditoria');

            const auditPath = path.join(backupPath, 'audit');
            await fs.mkdir(auditPath, { recursive: true });

            // Backup de relatório de auditoria
            const auditReport = await this.auditService.generateAuditReport({
                startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Último ano
                endDate: new Date(),
                includeSensitiveData: false
            });

            const auditReportPath = path.join(auditPath, 'audit_report.json');
            const encryptedReport = await this.encryptData(JSON.stringify(auditReport));
            await fs.writeFile(auditReportPath, encryptedReport);

            logger.info('Backup de logs de auditoria concluído');

        } catch (error) {
            logger.error('Erro no backup de logs de auditoria', { error: error.message });
            throw error;
        }
    }

    /**
     * Executa backup de metadados
     */
    async backupMetadata(backupPath, backupId) {
        try {
            const metadata = {
                backupId,
                timestamp: new Date(),
                version: '1.0.0',
                config: {
                    encryption: this.config.backup.encryption.enabled,
                    compression: this.config.backup.compression.enabled,
                    compliance: this.config.compliance
                },
                database: {
                    host: this.config.database.host,
                    database: this.config.database.database
                },
                statistics: this.backupStats,
                checksums: {}
            };

            const metadataPath = path.join(backupPath, 'metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        } catch (error) {
            logger.error('Erro no backup de metadados', { error: error.message });
            throw error;
        }
    }

    /**
     * Restore completo do sistema
     */
    async restoreFullBackup(backupPath, options = {}) {
        try {
            logger.info('Iniciando restore completo', { backupPath });

            // Valida backup
            await this.validateBackup(backupPath);

            // Descompacta se necessário
            const extractedPath = await this.extractBackup(backupPath);

            // Carrega metadados
            const metadata = await this.loadBackupMetadata(extractedPath);

            // Verifica compatibilidade
            await this.validateCompatibility(metadata);

            // Restore do banco de dados
            await this.restoreDatabase(extractedPath, options);

            // Restore de embeddings
            if (metadata.config.vectorDb) {
                await this.restoreEmbeddings(extractedPath);
            }

            // Registra auditoria
            await this.auditRestoreOperation(metadata.backupId, extractedPath);

            logger.info('Restore completo concluído', {
                backupId: metadata.backupId,
                originalTimestamp: metadata.timestamp
            });

            return {
                success: true,
                backupId: metadata.backupId,
                restoredAt: new Date()
            };

        } catch (error) {
            logger.error('Erro no restore completo', { error: error.message });
            throw error;
        }
    }

    // Métodos de criptografia e compressão

    /**
     * Criptografa dados
     */
    async encryptData(data) {
        if (!this.config.backup.encryption.enabled) {
            return Buffer.from(data);
        }

        const algorithm = this.config.backup.encryption.algorithm;
        const key = crypto.scryptSync(this.config.backup.encryption.key, 'salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        const result = {
            encrypted: true,
            algorithm,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            data: encrypted
        };

        return Buffer.from(JSON.stringify(result));
    }

    /**
     * Descriptografa dados
     */
    async decryptData(encryptedBuffer) {
        const encryptedData = JSON.parse(encryptedBuffer.toString());

        if (!encryptedData.encrypted) {
            return encryptedData.toString();
        }

        const algorithm = encryptedData.algorithm;
        const key = crypto.scryptSync(this.config.backup.encryption.key, 'salt', 32);
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const authTag = Buffer.from(encryptedData.authTag, 'hex');

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Compacta backup
     */
    async compressBackup(backupPath, backupId) {
        if (!this.config.backup.compression.enabled) {
            return backupPath;
        }

        try {
            const compressedPath = `${backupPath}.tar.gz`;

            // Cria arquivo tar.gz
            const tarCommand = `tar -czf "${compressedPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`;
            await this.executeCommand(tarCommand);

            // Remove diretório original
            await fs.rmdir(backupPath, { recursive: true });

            // Atualiza estatísticas
            const stats = await fs.stat(compressedPath);
            this.backupStats.compressedSizeBytes = stats.size;

            return compressedPath;

        } catch (error) {
            logger.error('Erro na compressão do backup', { error: error.message });
            throw error;
        }
    }

    // Métodos auxiliares

    generateBackupId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = crypto.randomBytes(4).toString('hex');
        return `backup-${timestamp}-${random}`;
    }

    getBackupPath(backupId) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        return path.join(this.config.backup.basePath, year.toString(), month, day, backupId);
    }

    async ensureBackupDirectories() {
        await fs.mkdir(this.config.backup.basePath, { recursive: true });
    }

    async createBackupStructure(backupPath) {
        await fs.mkdir(backupPath, { recursive: true });
        await fs.mkdir(path.join(backupPath, 'database'), { recursive: true });
        await fs.mkdir(path.join(backupPath, 'embeddings'), { recursive: true });
        await fs.mkdir(path.join(backupPath, 'audit'), { recursive: true });
    }

    buildPgDumpCommand(schemaName, outputPath) {
        const { host, port, database, user } = this.config.database;
        return `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -n ${schemaName} --schema-only -f "${outputPath}"`;
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('sh', ['-c', command], {
                env: { ...process.env, PGPASSWORD: this.config.database.password }
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
        });
    }

    getSensitiveFields(tableName) {
        const mappings = {
            incidents: {
                title: 'incident_title',
                description: 'incident_description',
                assigned_to: 'name',
                reporter: 'name'
            },
            knowledge_base: {
                title: 'name',
                content: 'content_text',
                author: 'name',
                approver: 'name'
            }
        };

        return mappings[tableName] || {};
    }

    async generateBackupReport(backupId, backupPath) {
        const stats = await fs.stat(backupPath);

        return {
            backupId,
            timestamp: new Date(),
            path: backupPath,
            size: {
                bytes: stats.size,
                formatted: this.formatBytes(stats.size)
            },
            duration: this.backupStats.endTime - this.backupStats.startTime,
            statistics: this.backupStats,
            compliance: {
                encrypted: this.config.backup.encryption.enabled,
                compressed: this.config.backup.compression.enabled,
                auditTrail: this.config.compliance.auditTrail
            }
        };
    }

    async auditBackupOperation(backupId, report) {
        await this.auditService.logEvent({
            action: AUDIT_EVENT_TYPES.DATA_CREATE,
            entityType: 'backup',
            entityId: backupId,
            userId: 'backup_system',
            details: {
                type: 'full_backup',
                report,
                compliance: this.config.compliance
            }
        });
    }

    async auditRestoreOperation(backupId, restorePath) {
        await this.auditService.logEvent({
            action: AUDIT_EVENT_TYPES.DATA_UPDATE,
            entityType: 'restore',
            entityId: backupId,
            userId: 'restore_system',
            details: {
                type: 'full_restore',
                restorePath,
                timestamp: new Date()
            }
        });
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async cleanupOldBackups() {
        // Implementa limpeza baseada na política de retenção
        logger.info('Limpeza de backups antigos iniciada');
        // TODO: Implementar lógica de limpeza
    }

    /**
     * Fecha conexões e limpa recursos
     */
    async close() {
        try {
            if (this.pgPool) {
                await this.pgPool.end();
            }

            if (this.vectorDb) {
                await this.vectorDb.close();
            }

            if (this.auditService) {
                await this.auditService.close();
            }

            logger.info('Backup/Restore Service fechado');
        } catch (error) {
            logger.error('Erro ao fechar Backup/Restore Service', { error: error.message });
        }
    }
}

// Execução direta se chamado como script
if (require.main === module) {
    const service = new BackupRestoreService();

    const command = process.argv[2];
    const backupPath = process.argv[3];

    if (command === 'backup') {
        service.initialize()
            .then(() => service.createFullBackup())
            .then(report => {
                console.log('\n=== RELATÓRIO DE BACKUP ===');
                console.log(`Backup ID: ${report.backupId}`);
                console.log(`Caminho: ${report.path}`);
                console.log(`Tamanho: ${report.size.formatted}`);
                console.log(`Duração: ${report.duration}ms`);
                console.log(`Tabelas: ${report.statistics.tablesBackedUp}`);
                console.log(`Registros: ${report.statistics.recordsBackedUp}`);
                process.exit(0);
            })
            .catch(error => {
                console.error('Backup falhou:', error.message);
                process.exit(1);
            });

    } else if (command === 'restore' && backupPath) {
        service.initialize()
            .then(() => service.restoreFullBackup(backupPath))
            .then(result => {
                console.log('\n=== RESTORE CONCLUÍDO ===');
                console.log(`Backup ID: ${result.backupId}`);
                console.log(`Restaurado em: ${result.restoredAt}`);
                process.exit(0);
            })
            .catch(error => {
                console.error('Restore falhou:', error.message);
                process.exit(1);
            });

    } else {
        console.log(`
Uso:
  node backup-restore.js backup              - Cria backup completo
  node backup-restore.js restore <caminho>   - Restaura backup
        `);
        process.exit(1);
    }
}

module.exports = BackupRestoreService;