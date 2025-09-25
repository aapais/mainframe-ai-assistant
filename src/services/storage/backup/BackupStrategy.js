'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BackupStrategy =
  exports.DifferentialBackupStrategy =
  exports.IncrementalBackupStrategy =
  exports.FullBackupStrategy =
  exports.AbstractBackupStrategy =
    void 0;
exports.createBackupStrategy = createBackupStrategy;
exports.isValidBackupStrategyType = isValidBackupStrategyType;
exports.getBackupStrategyDescription = getBackupStrategyDescription;
exports.getRecommendedStrategy = getRecommendedStrategy;
const tslib_1 = require('tslib');
const fs_1 = tslib_1.__importDefault(require('fs'));
const crypto_1 = require('crypto');
class AbstractBackupStrategy {
  type;
  metadata = null;
  constructor(type) {
    this.type = type;
  }
  getType() {
    return this.type;
  }
  getMetadata() {
    return this.metadata;
  }
  generateBackupId() {
    return (0, crypto_1.createHash)('sha256')
      .update(`${this.type}-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }
  updateProgress(progress, phase, percentage, bytesProcessed) {
    progress.phase = phase;
    progress.percentage = Math.min(100, Math.max(0, percentage));
    if (bytesProcessed !== undefined) {
      progress.bytesProcessed = bytesProcessed;
    }
  }
  async calculateTableChecksum(adapter, tableName) {
    try {
      const rows = await adapter.executeSQL(`SELECT * FROM ${tableName} ORDER BY rowid`);
      const data = JSON.stringify(rows);
      return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    } catch (error) {
      console.warn(`Could not calculate checksum for table ${tableName}:`, error);
      return '';
    }
  }
  async getAllTableNames(adapter) {
    const result = await adapter.executeSQL(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    return result.map(row => row.name);
  }
}
exports.AbstractBackupStrategy = AbstractBackupStrategy;
class FullBackupStrategy extends AbstractBackupStrategy {
  constructor() {
    super('full');
  }
  async execute(adapter, progress, context) {
    this.updateProgress(progress, 'initializing', 0);
    try {
      const validation = await this.validatePreconditions(adapter, context);
      if (!validation.valid) {
        throw new Error(`Precondition validation failed: ${validation.issues.join(', ')}`);
      }
      this.updateProgress(progress, 'reading_database', 10);
      const dbPath = await this.getDatabasePath(adapter);
      const dbData = fs_1.default.readFileSync(dbPath);
      this.updateProgress(progress, 'calculating_checksums', 50, dbData.length);
      const tableNames = await this.getAllTableNames(adapter);
      const tableChecksums = {};
      for (let i = 0; i < tableNames.length; i++) {
        const tableName = tableNames[i];
        tableChecksums[tableName] = await this.calculateTableChecksum(adapter, tableName);
        this.updateProgress(progress, 'calculating_checksums', 50 + (i / tableNames.length) * 30);
      }
      this.updateProgress(progress, 'generating_metadata', 80);
      const entryCount = await this.getTotalEntryCount(adapter);
      this.metadata = {
        id: this.generateBackupId(),
        strategy: this.type,
        timestamp: new Date(),
        checksum: (0, crypto_1.createHash)('sha256').update(dbData).digest('hex'),
        size: dbData.length,
        entryCount,
        tableChecksums,
        version: await this.getDatabaseVersion(adapter),
      };
      this.updateProgress(progress, 'finalizing', 95);
      const backupPackage = await this.createBackupPackage(dbData, this.metadata);
      this.updateProgress(progress, 'completed', 100, backupPackage.length);
      console.log(
        `✅ Full backup completed: ${this.metadata.id} (${this.formatBytes(dbData.length)})`
      );
      return backupPackage;
    } catch (error) {
      console.error('❌ Full backup failed:', error);
      throw error;
    }
  }
  getRequiredDependencies() {
    return [];
  }
  async validatePreconditions(adapter, context) {
    const issues = [];
    try {
      const metrics = await adapter.getMetrics();
      if (!metrics) {
        issues.push('Cannot access database metrics');
      }
      if (context?.workingDirectory) {
        const stats = fs_1.default.statSync(context.workingDirectory);
        if (!stats.isDirectory()) {
          issues.push('Working directory is not accessible');
        }
      }
      const integrityCheck = await adapter.executeSQL('PRAGMA integrity_check');
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        issues.push('Database integrity check failed');
      }
    } catch (error) {
      issues.push(`Precondition check failed: ${error.message}`);
    }
    return {
      valid: issues.length === 0,
      issues,
    };
  }
  async getDatabasePath(adapter) {
    if ('getDatabasePath' in adapter) {
      return adapter.getDatabasePath();
    }
    throw new Error('Cannot determine database path for full backup');
  }
  async getTotalEntryCount(adapter) {
    try {
      const result = await adapter.executeSQL('SELECT COUNT(*) as count FROM kb_entries');
      return result[0]?.count || 0;
    } catch {
      return 0;
    }
  }
  async getDatabaseVersion(adapter) {
    try {
      const result = await adapter.executeSQL('PRAGMA user_version');
      return result[0]?.user_version?.toString() || '0';
    } catch {
      return '0';
    }
  }
  async createBackupPackage(data, metadata) {
    const metadataJson = JSON.stringify(metadata);
    const separator = Buffer.from('\n---BACKUP-DATA-SEPARATOR---\n');
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    return Buffer.concat([metadataBuffer, separator, data]);
  }
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
exports.FullBackupStrategy = FullBackupStrategy;
class IncrementalBackupStrategy extends AbstractBackupStrategy {
  constructor() {
    super('incremental');
  }
  async execute(adapter, progress, context) {
    this.updateProgress(progress, 'initializing', 0);
    try {
      if (!context?.previousBackupMetadata) {
        throw new Error('Incremental backup requires previous backup metadata');
      }
      const validation = await this.validatePreconditions(adapter, context);
      if (!validation.valid) {
        throw new Error(`Precondition validation failed: ${validation.issues.join(', ')}`);
      }
      this.updateProgress(progress, 'analyzing_changes', 10);
      const delta = await this.calculateDelta(adapter, context.previousBackupMetadata);
      this.updateProgress(progress, 'preparing_delta', 40);
      const deltaPackage = await this.createDeltaPackage(delta);
      this.updateProgress(progress, 'generating_metadata', 80);
      this.metadata = {
        id: this.generateBackupId(),
        strategy: this.type,
        timestamp: new Date(),
        checksum: (0, crypto_1.createHash)('sha256').update(deltaPackage).digest('hex'),
        size: deltaPackage.length,
        entryCount: delta.metadata.totalChanges,
        tableChecksums: await this.calculateAffectedTableChecksums(adapter, delta),
        version: await this.getDatabaseVersion(adapter),
        dependencies: [context.previousBackupMetadata.id],
      };
      this.updateProgress(progress, 'finalizing', 95);
      const backupPackage = await this.createBackupPackage(deltaPackage, this.metadata);
      this.updateProgress(progress, 'completed', 100, backupPackage.length);
      console.log(
        `✅ Incremental backup completed: ${this.metadata.id} (${delta.metadata.totalChanges} changes)`
      );
      return backupPackage;
    } catch (error) {
      console.error('❌ Incremental backup failed:', error);
      throw error;
    }
  }
  getRequiredDependencies() {
    return ['previous_backup'];
  }
  async validatePreconditions(adapter, context) {
    const issues = [];
    if (!context?.previousBackupMetadata) {
      issues.push('Previous backup metadata is required for incremental backup');
    }
    try {
      const tables = await this.getAllTableNames(adapter);
      const timestampColumns = await this.checkTimestampColumns(adapter, tables);
      if (timestampColumns.length === 0) {
        issues.push('No timestamp columns found for change tracking');
      }
    } catch (error) {
      issues.push(`Cannot verify change tracking capabilities: ${error.message}`);
    }
    return {
      valid: issues.length === 0,
      issues,
    };
  }
  async calculateDelta(adapter, previousMetadata) {
    const delta = {
      added: [],
      modified: [],
      deleted: [],
      metadata: {
        totalChanges: 0,
        tablesAffected: [],
        changeTypes: { added: 0, modified: 0, deleted: 0 },
      },
    };
    const tables = await this.getAllTableNames(adapter);
    const previousTimestamp = previousMetadata.timestamp;
    for (const tableName of tables) {
      try {
        const hasTimestamp = await this.tableHasTimestamp(adapter, tableName);
        if (hasTimestamp) {
          const changes = await adapter.executeSQL(
            `
            SELECT * FROM ${tableName}
            WHERE updated_at > ? OR created_at > ?
          `,
            [previousTimestamp.toISOString(), previousTimestamp.toISOString()]
          );
          if (changes.length > 0) {
            delta.modified.push({ table: tableName, entries: changes });
            delta.metadata.changeTypes.modified += changes.length;
            delta.metadata.tablesAffected.push(tableName);
          }
        } else {
          const currentChecksum = await this.calculateTableChecksum(adapter, tableName);
          const previousChecksum = previousMetadata.tableChecksums[tableName];
          if (currentChecksum !== previousChecksum) {
            const allData = await adapter.executeSQL(`SELECT * FROM ${tableName}`);
            delta.modified.push({ table: tableName, entries: allData });
            delta.metadata.changeTypes.modified += allData.length;
            delta.metadata.tablesAffected.push(tableName);
          }
        }
      } catch (error) {
        console.warn(`Could not process changes for table ${tableName}:`, error);
      }
    }
    delta.metadata.totalChanges =
      delta.metadata.changeTypes.added +
      delta.metadata.changeTypes.modified +
      delta.metadata.changeTypes.deleted;
    return delta;
  }
  async createDeltaPackage(delta) {
    const deltaJson = JSON.stringify(delta);
    return Buffer.from(deltaJson, 'utf-8');
  }
  async createBackupPackage(data, metadata) {
    const metadataJson = JSON.stringify(metadata);
    const separator = Buffer.from('\n---INCREMENTAL-DATA-SEPARATOR---\n');
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    return Buffer.concat([metadataBuffer, separator, data]);
  }
  async checkTimestampColumns(adapter, tables) {
    const timestampTables = [];
    for (const table of tables) {
      const hasTimestamp = await this.tableHasTimestamp(adapter, table);
      if (hasTimestamp) {
        timestampTables.push(table);
      }
    }
    return timestampTables;
  }
  async tableHasTimestamp(adapter, tableName) {
    try {
      const schema = await adapter.executeSQL(`PRAGMA table_info(${tableName})`);
      return schema.some(
        col => col.name === 'updated_at' || col.name === 'created_at' || col.name === 'timestamp'
      );
    } catch {
      return false;
    }
  }
  async calculateAffectedTableChecksums(adapter, delta) {
    const checksums = {};
    for (const tableName of delta.metadata.tablesAffected) {
      checksums[tableName] = await this.calculateTableChecksum(adapter, tableName);
    }
    return checksums;
  }
  async getDatabaseVersion(adapter) {
    try {
      const result = await adapter.executeSQL('PRAGMA user_version');
      return result[0]?.user_version?.toString() || '0';
    } catch {
      return '0';
    }
  }
}
exports.IncrementalBackupStrategy = IncrementalBackupStrategy;
class DifferentialBackupStrategy extends AbstractBackupStrategy {
  constructor() {
    super('differential');
  }
  async execute(adapter, progress, context) {
    this.updateProgress(progress, 'initializing', 0);
    try {
      if (!context?.lastFullBackupMetadata) {
        throw new Error('Differential backup requires last full backup metadata');
      }
      const validation = await this.validatePreconditions(adapter, context);
      if (!validation.valid) {
        throw new Error(`Precondition validation failed: ${validation.issues.join(', ')}`);
      }
      this.updateProgress(progress, 'analyzing_changes', 10);
      const delta = await this.calculateDifferentialDelta(adapter, context.lastFullBackupMetadata);
      this.updateProgress(progress, 'preparing_delta', 50);
      const deltaPackage = await this.createDeltaPackage(delta);
      this.updateProgress(progress, 'generating_metadata', 80);
      this.metadata = {
        id: this.generateBackupId(),
        strategy: this.type,
        timestamp: new Date(),
        checksum: (0, crypto_1.createHash)('sha256').update(deltaPackage).digest('hex'),
        size: deltaPackage.length,
        entryCount: delta.metadata.totalChanges,
        tableChecksums: await this.calculateAffectedTableChecksums(adapter, delta),
        version: await this.getDatabaseVersion(adapter),
        dependencies: [context.lastFullBackupMetadata.id],
      };
      this.updateProgress(progress, 'finalizing', 95);
      const backupPackage = await this.createBackupPackage(deltaPackage, this.metadata);
      this.updateProgress(progress, 'completed', 100, backupPackage.length);
      console.log(
        `✅ Differential backup completed: ${this.metadata.id} (${delta.metadata.totalChanges} changes since full backup)`
      );
      return backupPackage;
    } catch (error) {
      console.error('❌ Differential backup failed:', error);
      throw error;
    }
  }
  getRequiredDependencies() {
    return ['full_backup'];
  }
  async validatePreconditions(adapter, context) {
    const issues = [];
    if (!context?.lastFullBackupMetadata) {
      issues.push('Last full backup metadata is required for differential backup');
    }
    if (context?.lastFullBackupMetadata?.strategy !== 'full') {
      issues.push('Reference backup must be a full backup');
    }
    return {
      valid: issues.length === 0,
      issues,
    };
  }
  async calculateDifferentialDelta(adapter, fullBackupMetadata) {
    const delta = {
      added: [],
      modified: [],
      deleted: [],
      metadata: {
        totalChanges: 0,
        tablesAffected: [],
        changeTypes: { added: 0, modified: 0, deleted: 0 },
      },
    };
    const tables = await this.getAllTableNames(adapter);
    const fullBackupTimestamp = fullBackupMetadata.timestamp;
    for (const tableName of tables) {
      try {
        const currentChecksum = await this.calculateTableChecksum(adapter, tableName);
        const fullBackupChecksum = fullBackupMetadata.tableChecksums[tableName];
        if (currentChecksum !== fullBackupChecksum) {
          const hasTimestamp = await this.tableHasTimestamp(adapter, tableName);
          if (hasTimestamp) {
            const changes = await adapter.executeSQL(
              `
              SELECT * FROM ${tableName}
              WHERE updated_at > ? OR created_at > ?
            `,
              [fullBackupTimestamp.toISOString(), fullBackupTimestamp.toISOString()]
            );
            if (changes.length > 0) {
              delta.modified.push({ table: tableName, entries: changes });
              delta.metadata.changeTypes.modified += changes.length;
            }
          } else {
            const allData = await adapter.executeSQL(`SELECT * FROM ${tableName}`);
            delta.modified.push({ table: tableName, entries: allData });
            delta.metadata.changeTypes.modified += allData.length;
          }
          delta.metadata.tablesAffected.push(tableName);
        }
      } catch (error) {
        console.warn(`Could not process differential changes for table ${tableName}:`, error);
      }
    }
    delta.metadata.totalChanges =
      delta.metadata.changeTypes.added +
      delta.metadata.changeTypes.modified +
      delta.metadata.changeTypes.deleted;
    return delta;
  }
  async createDeltaPackage(delta) {
    const deltaJson = JSON.stringify(delta);
    return Buffer.from(deltaJson, 'utf-8');
  }
  async createBackupPackage(data, metadata) {
    const metadataJson = JSON.stringify(metadata);
    const separator = Buffer.from('\n---DIFFERENTIAL-DATA-SEPARATOR---\n');
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    return Buffer.concat([metadataBuffer, separator, data]);
  }
  async tableHasTimestamp(adapter, tableName) {
    try {
      const schema = await adapter.executeSQL(`PRAGMA table_info(${tableName})`);
      return schema.some(
        col => col.name === 'updated_at' || col.name === 'created_at' || col.name === 'timestamp'
      );
    } catch {
      return false;
    }
  }
  async calculateAffectedTableChecksums(adapter, delta) {
    const checksums = {};
    for (const tableName of delta.metadata.tablesAffected) {
      checksums[tableName] = await this.calculateTableChecksum(adapter, tableName);
    }
    return checksums;
  }
  async getDatabaseVersion(adapter) {
    try {
      const result = await adapter.executeSQL('PRAGMA user_version');
      return result[0]?.user_version?.toString() || '0';
    } catch {
      return '0';
    }
  }
}
exports.DifferentialBackupStrategy = DifferentialBackupStrategy;
class BackupStrategy {
  strategy;
  constructor(type) {
    switch (type) {
      case 'full':
        this.strategy = new FullBackupStrategy();
        break;
      case 'incremental':
        this.strategy = new IncrementalBackupStrategy();
        break;
      case 'differential':
        this.strategy = new DifferentialBackupStrategy();
        break;
      default:
        throw new Error(`Unknown backup strategy: ${type}`);
    }
  }
  async execute(adapter, progress, context) {
    return this.strategy.execute(adapter, progress, context);
  }
  getRequiredDependencies() {
    return this.strategy.getRequiredDependencies();
  }
  async validatePreconditions(adapter, context) {
    return this.strategy.validatePreconditions(adapter, context);
  }
  getType() {
    return this.strategy.getType();
  }
  getMetadata() {
    return this.strategy.getMetadata();
  }
}
exports.BackupStrategy = BackupStrategy;
function createBackupStrategy(type) {
  return new BackupStrategy(type);
}
function isValidBackupStrategyType(type) {
  return ['full', 'incremental', 'differential'].includes(type);
}
function getBackupStrategyDescription(type) {
  switch (type) {
    case 'full':
      return 'Complete database backup - includes all data and serves as baseline';
    case 'incremental':
      return 'Changes since last backup - minimal storage but requires chain for restore';
    case 'differential':
      return 'Changes since last full backup - balance of storage and restore speed';
    default:
      return 'Unknown backup strategy';
  }
}
function getRecommendedStrategy(dataSize, changeFrequency, storageConstraints) {
  if (dataSize < 100 * 1024 * 1024 || changeFrequency === 'low') {
    return 'full';
  }
  if (dataSize > 1024 * 1024 * 1024 && storageConstraints === 'critical') {
    return 'incremental';
  }
  return 'differential';
}
//# sourceMappingURL=BackupStrategy.js.map
