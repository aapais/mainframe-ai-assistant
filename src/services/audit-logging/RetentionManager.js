/**
 * Sistema de Gestão de Retenção de Logs
 * Gerencia o ciclo de vida dos logs de auditoria conforme políticas de compliance
 * Implementa arquivamento, compressão e destruição segura de dados
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const { EventEmitter } = require('events');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class RetentionManager extends EventEmitter {
  constructor(auditService, config = {}) {
    super();
    this.auditService = auditService;
    this.config = {
      retentionPolicies: {
        FINANCIAL: 2555, // 7 anos (BACEN)
        PERSONAL_DATA: 1825, // 5 anos (LGPD)
        OPERATIONAL: 1095, // 3 anos
        SYSTEM: 365, // 1 ano
        DEBUG: 30, // 30 dias
      },
      archivePolicies: {
        IMMEDIATE: 0, // Arquiva imediatamente
        AFTER_30_DAYS: 30,
        AFTER_90_DAYS: 90,
        AFTER_1_YEAR: 365,
      },
      compressionEnabled: true,
      encryptionEnabled: true,
      secureDeleteEnabled: true,
      archiveLocation: 'archive/audit-logs',
      checksumValidation: true,
      integrityMonitoring: true,
      automaticCleanup: true,
      cleanupInterval: 86400000, // 24 horas
      ...config,
    };

    this.retentionStatus = {
      totalFiles: 0,
      archivedFiles: 0,
      compressedFiles: 0,
      deletedFiles: 0,
      totalSize: 0,
      archivedSize: 0,
      compressionRatio: 0,
      lastCleanup: null,
      activeRetentionJobs: 0,
    };

    this.retentionJobs = new Map();
    this.checksumDatabase = new Map();

    if (this.config.automaticCleanup) {
      this.startAutomaticCleanup();
    }

    this.loadChecksumDatabase();
  }

  /**
   * Aplica política de retenção em arquivo específico
   */
  async applyRetentionPolicy(filePath, dataClassification, fileDate) {
    const startTime = Date.now();
    const retentionDays =
      this.config.retentionPolicies[dataClassification] ||
      this.config.retentionPolicies.OPERATIONAL;
    const archiveThreshold = this.config.archivePolicies.AFTER_30_DAYS;

    try {
      const fileAge = this.calculateFileAge(fileDate);
      const action = this.determineRetentionAction(fileAge, retentionDays, archiveThreshold);

      await this.auditService.logSystemDecision({
        incidentId: 'RETENTION_POLICY',
        engine: 'RetentionManager',
        algorithm: 'PolicyBasedRetention',
        version: '1.0.0',
        inputs: {
          filePath,
          dataClassification,
          fileAge,
          retentionDays,
          archiveThreshold,
        },
        decision: action,
        confidence: 1.0,
        reasoning: `File age: ${fileAge} days, retention period: ${retentionDays} days, archive threshold: ${archiveThreshold} days`,
        executionTime: Date.now() - startTime,
      });

      switch (action) {
        case 'RETAIN':
          return await this.retainFile(filePath, dataClassification);
        case 'ARCHIVE':
          return await this.archiveFile(filePath, dataClassification);
        case 'DELETE':
          return await this.deleteFile(filePath, dataClassification);
        default:
          throw new Error(`Unknown retention action: ${action}`);
      }
    } catch (error) {
      await this.auditService.logSystemDecision({
        incidentId: 'RETENTION_ERROR',
        engine: 'RetentionManager',
        algorithm: 'PolicyBasedRetention',
        version: '1.0.0',
        inputs: { filePath, dataClassification, error: error.message },
        decision: 'ERROR',
        confidence: 0.0,
        reasoning: `Failed to apply retention policy: ${error.message}`,
        executionTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Arquiva arquivo com compressão e criptografia
   */
  async archiveFile(filePath, dataClassification) {
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    const archiveDir = path.join(this.config.archiveLocation, dataClassification);
    const archivePath = path.join(archiveDir, fileName);

    try {
      // Verifica se arquivo existe
      const fileStats = await fs.stat(filePath);
      if (!fileStats.isFile()) {
        throw new Error('File not found or is not a regular file');
      }

      // Cria diretório de arquivo se não existir
      await fs.mkdir(archiveDir, { recursive: true });

      // Lê o arquivo original
      const originalData = await fs.readFile(filePath);
      const originalSize = originalData.length;

      // Calcula checksum do arquivo original
      const originalChecksum = crypto.createHash('sha256').update(originalData).digest('hex');

      let processedData = originalData;
      let compressionRatio = 1;

      // Comprime se habilitado
      if (this.config.compressionEnabled) {
        processedData = await gzip(processedData);
        compressionRatio = originalSize / processedData.length;
      }

      // Criptografa se habilitado
      if (this.config.encryptionEnabled) {
        processedData = await this.encryptData(processedData, dataClassification);
      }

      // Escreve arquivo arquivado
      await fs.writeFile(archivePath, processedData);

      // Valida integridade
      if (this.config.checksumValidation) {
        await this.validateArchivedFile(archivePath, originalChecksum, dataClassification);
      }

      // Atualiza database de checksums
      this.checksumDatabase.set(archivePath, {
        originalChecksum,
        archivedAt: new Date().toISOString(),
        originalSize,
        compressedSize: processedData.length,
        compressionRatio,
        dataClassification,
        encrypted: this.config.encryptionEnabled,
        compressed: this.config.compressionEnabled,
      });

      await this.saveChecksumDatabase();

      // Remove arquivo original após arquivamento bem-sucedido
      await fs.unlink(filePath);

      // Atualiza estatísticas
      this.retentionStatus.archivedFiles++;
      this.retentionStatus.totalSize += originalSize;
      this.retentionStatus.archivedSize += processedData.length;
      this.retentionStatus.compressionRatio =
        (this.retentionStatus.compressionRatio + compressionRatio) / 2;

      const result = {
        action: 'ARCHIVED',
        originalPath: filePath,
        archivePath,
        originalSize,
        archivedSize: processedData.length,
        compressionRatio,
        checksum: originalChecksum,
        executionTime: Date.now() - startTime,
      };

      await this.auditService.createAuditTrail('FILE_ARCHIVED', 'ARCHIVE_FILE', {
        operatorId: 'RETENTION_SYSTEM',
        description: `File archived: ${fileName}`,
        method: 'AUTOMATED',
        location: archivePath,
        justification: 'Compliance with retention policy',
        previousValue: filePath,
        newValue: archivePath,
        changeReason: `Data classification: ${dataClassification}`,
      });

      this.emit('fileArchived', result);
      return result;
    } catch (error) {
      await this.auditService.logOperatorAction({
        incidentId: 'ARCHIVE_ERROR',
        operatorId: 'RETENTION_SYSTEM',
        action: 'ARCHIVE_FAILURE',
        description: `Failed to archive file ${filePath}: ${error.message}`,
        executionTime: Date.now() - startTime,
        impact: { severity: 'MEDIUM', businessImpact: 'MEDIUM' },
      });
      throw error;
    }
  }

  /**
   * Deleta arquivo de forma segura
   */
  async deleteFile(filePath, dataClassification) {
    const startTime = Date.now();

    try {
      // Verifica se arquivo existe
      const fileStats = await fs.stat(filePath);
      const fileSize = fileStats.size;

      // Calcula checksum antes da exclusão
      const fileData = await fs.readFile(filePath);
      const checksum = crypto.createHash('sha256').update(fileData).digest('hex');

      // Exclusão segura se habilitada
      if (this.config.secureDeleteEnabled) {
        await this.secureDelete(filePath);
      } else {
        await fs.unlink(filePath);
      }

      // Atualiza estatísticas
      this.retentionStatus.deletedFiles++;

      const result = {
        action: 'DELETED',
        filePath,
        fileSize,
        checksum,
        secureDelete: this.config.secureDeleteEnabled,
        executionTime: Date.now() - startTime,
      };

      await this.auditService.createAuditTrail('FILE_DELETED', 'DELETE_FILE', {
        operatorId: 'RETENTION_SYSTEM',
        description: `File deleted: ${path.basename(filePath)}`,
        method: 'AUTOMATED',
        location: filePath,
        justification: 'End of retention period',
        previousValue: `File size: ${fileSize} bytes`,
        newValue: 'DELETED',
        changeReason: `Data classification: ${dataClassification}, retention period expired`,
      });

      this.emit('fileDeleted', result);
      return result;
    } catch (error) {
      await this.auditService.logOperatorAction({
        incidentId: 'DELETE_ERROR',
        operatorId: 'RETENTION_SYSTEM',
        action: 'DELETE_FAILURE',
        description: `Failed to delete file ${filePath}: ${error.message}`,
        executionTime: Date.now() - startTime,
        impact: { severity: 'MEDIUM', businessImpact: 'MEDIUM' },
      });
      throw error;
    }
  }

  /**
   * Mantém arquivo sem alterações
   */
  async retainFile(filePath, dataClassification) {
    const result = {
      action: 'RETAINED',
      filePath,
      dataClassification,
      retainUntil: this.calculateRetentionExpiry(dataClassification),
      executionTime: 0,
    };

    await this.auditService.createAuditTrail('FILE_RETAINED', 'RETAIN_FILE', {
      operatorId: 'RETENTION_SYSTEM',
      description: `File retained: ${path.basename(filePath)}`,
      method: 'AUTOMATED',
      location: filePath,
      justification: 'Within retention period',
      changeReason: `Data classification: ${dataClassification}`,
    });

    this.emit('fileRetained', result);
    return result;
  }

  /**
   * Executa limpeza automática periódica
   */
  async performAutomaticCleanup() {
    const startTime = Date.now();
    const results = {
      totalProcessed: 0,
      retained: 0,
      archived: 0,
      deleted: 0,
      errors: 0,
      executionTime: 0,
    };

    try {
      // Processa logs ativos
      const activeLogs = await this.findActiveLogFiles();

      for (const logFile of activeLogs) {
        try {
          const classification = await this.classifyLogFile(logFile.path);
          const result = await this.applyRetentionPolicy(
            logFile.path,
            classification,
            logFile.date
          );

          results.totalProcessed++;
          results[result.action.toLowerCase()]++;
        } catch (error) {
          results.errors++;
          console.error(`Error processing ${logFile.path}:`, error);
        }
      }

      // Processa arquivos arquivados
      const archivedFiles = await this.findArchivedFiles();

      for (const archivedFile of archivedFiles) {
        try {
          if (await this.shouldDeleteArchivedFile(archivedFile)) {
            await this.deleteArchivedFile(archivedFile.path);
            results.deleted++;
            results.totalProcessed++;
          }
        } catch (error) {
          results.errors++;
          console.error(`Error processing archived file ${archivedFile.path}:`, error);
        }
      }

      results.executionTime = Date.now() - startTime;
      this.retentionStatus.lastCleanup = new Date().toISOString();

      await this.auditService.logSystemDecision({
        incidentId: 'RETENTION_CLEANUP',
        engine: 'RetentionManager',
        algorithm: 'AutomaticCleanup',
        version: '1.0.0',
        inputs: {
          activeLogsCount: activeLogs.length,
          archivedFilesCount: archivedFiles.length,
        },
        decision: 'CLEANUP_COMPLETED',
        confidence: 1.0,
        reasoning: `Processed ${results.totalProcessed} files with ${results.errors} errors`,
        executionTime: results.executionTime,
      });

      this.emit('cleanupCompleted', results);
      return results;
    } catch (error) {
      await this.auditService.logOperatorAction({
        incidentId: 'CLEANUP_ERROR',
        operatorId: 'RETENTION_SYSTEM',
        action: 'CLEANUP_FAILURE',
        description: `Automatic cleanup failed: ${error.message}`,
        executionTime: Date.now() - startTime,
        impact: { severity: 'HIGH', businessImpact: 'MEDIUM' },
      });
      throw error;
    }
  }

  /**
   * Restaura arquivo do arquivo
   */
  async restoreFromArchive(archivePath, targetPath) {
    const startTime = Date.now();

    try {
      // Verifica se arquivo arquivado existe
      const archivedData = await fs.readFile(archivePath);
      const archiveMetadata = this.checksumDatabase.get(archivePath);

      if (!archiveMetadata) {
        throw new Error('Archive metadata not found');
      }

      let restoredData = archivedData;

      // Descriptografa se necessário
      if (archiveMetadata.encrypted) {
        restoredData = await this.decryptData(restoredData, archiveMetadata.dataClassification);
      }

      // Descomprime se necessário
      if (archiveMetadata.compressed) {
        restoredData = await gunzip(restoredData);
      }

      // Valida checksum
      const restoredChecksum = crypto.createHash('sha256').update(restoredData).digest('hex');
      if (restoredChecksum !== archiveMetadata.originalChecksum) {
        throw new Error('Checksum validation failed during restoration');
      }

      // Escreve arquivo restaurado
      await fs.writeFile(targetPath, restoredData);

      const result = {
        action: 'RESTORED',
        archivePath,
        targetPath,
        originalSize: archiveMetadata.originalSize,
        checksumValid: true,
        executionTime: Date.now() - startTime,
      };

      await this.auditService.createAuditTrail('FILE_RESTORED', 'RESTORE_FILE', {
        operatorId: 'RETENTION_SYSTEM',
        description: `File restored from archive: ${path.basename(targetPath)}`,
        method: 'AUTOMATED',
        location: targetPath,
        justification: 'File restoration request',
        previousValue: archivePath,
        newValue: targetPath,
        changeReason: 'Archive restoration',
      });

      this.emit('fileRestored', result);
      return result;
    } catch (error) {
      await this.auditService.logOperatorAction({
        incidentId: 'RESTORE_ERROR',
        operatorId: 'RETENTION_SYSTEM',
        action: 'RESTORE_FAILURE',
        description: `Failed to restore file from ${archivePath}: ${error.message}`,
        executionTime: Date.now() - startTime,
        impact: { severity: 'MEDIUM', businessImpact: 'MEDIUM' },
      });
      throw error;
    }
  }

  /**
   * Gera relatório de retenção
   */
  generateRetentionReport() {
    const report = {
      reportId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: { ...this.retentionStatus },
      policies: { ...this.config.retentionPolicies },
      archives: {
        totalFiles: this.checksumDatabase.size,
        byClassification: {},
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
      },
      recommendations: [],
    };

    // Analisa arquivos por classificação
    for (const [filePath, metadata] of this.checksumDatabase.entries()) {
      const classification = metadata.dataClassification;

      if (!report.archives.byClassification[classification]) {
        report.archives.byClassification[classification] = {
          count: 0,
          totalSize: 0,
          averageAge: 0,
        };
      }

      report.archives.byClassification[classification].count++;
      report.archives.byClassification[classification].totalSize += metadata.originalSize;
      report.archives.totalSize += metadata.originalSize;

      const archivedDate = new Date(metadata.archivedAt);
      if (!report.archives.oldestFile || archivedDate < new Date(report.archives.oldestFile.date)) {
        report.archives.oldestFile = { path: filePath, date: metadata.archivedAt };
      }
      if (!report.archives.newestFile || archivedDate > new Date(report.archives.newestFile.date)) {
        report.archives.newestFile = { path: filePath, date: metadata.archivedAt };
      }
    }

    // Gera recomendações
    if (report.status.compressionRatio < 2) {
      report.recommendations.push({
        type: 'COMPRESSION',
        priority: 'MEDIUM',
        description: 'Consider reviewing compression settings for better storage efficiency',
      });
    }

    if (report.archives.totalSize > 10 * 1024 * 1024 * 1024) {
      // 10GB
      report.recommendations.push({
        type: 'STORAGE',
        priority: 'HIGH',
        description: 'Archive storage size is large, consider migrating to cold storage',
      });
    }

    return report;
  }

  // Métodos auxiliares

  calculateFileAge(fileDate) {
    const now = new Date();
    const file = new Date(fileDate);
    return Math.floor((now - file) / (24 * 60 * 60 * 1000));
  }

  determineRetentionAction(fileAge, retentionDays, archiveThreshold) {
    if (fileAge >= retentionDays) {
      return 'DELETE';
    } else if (fileAge >= archiveThreshold) {
      return 'ARCHIVE';
    } else {
      return 'RETAIN';
    }
  }

  calculateRetentionExpiry(dataClassification) {
    const retentionDays =
      this.config.retentionPolicies[dataClassification] ||
      this.config.retentionPolicies.OPERATIONAL;
    return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  }

  async encryptData(data, classification) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.RETENTION_ENCRYPTION_KEY || 'default-key',
      `retention-${classification}`,
      32
    );
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]);
  }

  async decryptData(encryptedData, classification) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.RETENTION_ENCRYPTION_KEY || 'default-key',
      `retention-${classification}`,
      32
    );

    const iv = encryptedData.slice(0, 16);
    const tag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  async secureDelete(filePath) {
    const fileStats = await fs.stat(filePath);
    const fileSize = fileStats.size;

    // Sobrescreve o arquivo com dados aleatórios (3 passadas)
    for (let pass = 0; pass < 3; pass++) {
      const randomData = crypto.randomBytes(fileSize);
      await fs.writeFile(filePath, randomData);
      await fs.fsync((await fs.open(filePath, 'r+')).fd);
    }

    // Remove o arquivo
    await fs.unlink(filePath);
  }

  async validateArchivedFile(archivePath, originalChecksum, dataClassification) {
    // Implementa validação de integridade
    return true;
  }

  startAutomaticCleanup() {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performAutomaticCleanup();
      } catch (error) {
        console.error('Automatic cleanup failed:', error);
      }
    }, this.config.cleanupInterval);
  }

  async findActiveLogFiles() {
    // Implementa busca por arquivos de log ativos
    return [];
  }

  async findArchivedFiles() {
    // Implementa busca por arquivos arquivados
    return [];
  }

  async classifyLogFile(filePath) {
    // Implementa classificação automática de arquivos
    return 'OPERATIONAL';
  }

  async shouldDeleteArchivedFile(archivedFile) {
    // Implementa lógica para determinar se arquivo arquivado deve ser excluído
    return false;
  }

  async deleteArchivedFile(filePath) {
    return await this.deleteFile(filePath, 'ARCHIVED');
  }

  async loadChecksumDatabase() {
    try {
      const dbPath = path.join(this.config.archiveLocation, 'checksums.json');
      const data = await fs.readFile(dbPath, 'utf8');
      const checksums = JSON.parse(data);

      for (const [key, value] of Object.entries(checksums)) {
        this.checksumDatabase.set(key, value);
      }
    } catch (error) {
      // Database não existe ainda, será criada
    }
  }

  async saveChecksumDatabase() {
    const dbPath = path.join(this.config.archiveLocation, 'checksums.json');
    const checksums = Object.fromEntries(this.checksumDatabase);

    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(checksums, null, 2));
  }

  /**
   * Para o serviço de retenção
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = RetentionManager;
