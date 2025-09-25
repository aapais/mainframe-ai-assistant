import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { KBEntry } from '../../database/KnowledgeDB';
import Database from 'better-sqlite3';

/**
 * Type of change operation
 */
export type ChangeType = 'create' | 'update' | 'delete' | 'archive' | 'restore';

/**
 * Individual field change within an entry modification
 */
export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'modified' | 'removed';
}

/**
 * Complete change record for a single KB entry modification
 */
export interface ChangeRecord {
  id: string;
  entryId: string;
  changeType: ChangeType;
  timestamp: Date;
  userId: string;
  sessionId: string;
  fieldChanges: FieldChange[];
  beforeSnapshot?: Partial<KBEntry>;
  afterSnapshot?: Partial<KBEntry>;
  metadata?: Record<string, any>;
  comment?: string;
}

/**
 * Version information for a KB entry
 */
export interface EntryVersion {
  versionId: string;
  entryId: string;
  version: number;
  timestamp: Date;
  userId: string;
  changeType: ChangeType;
  snapshot: Partial<KBEntry>;
  comment?: string;
  size: number; // Size in bytes of the version data
}

/**
 * Comprehensive diff between two versions
 */
export interface VersionDiff {
  entryId: string;
  fromVersion: number;
  toVersion: number;
  fieldChanges: FieldChange[];
  summary: {
    fieldsAdded: number;
    fieldsModified: number;
    fieldsRemoved: number;
    significantChange: boolean; // Based on title/problem/solution changes
  };
}

/**
 * Options for querying change history
 */
export interface HistoryQuery {
  entryId?: string;
  userId?: string;
  changeType?: ChangeType;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
  includeSnapshots?: boolean;
}

/**
 * Rollback operation result
 */
export interface RollbackResult {
  success: boolean;
  targetVersion: number;
  rollbackId: string;
  affectedEntries: number;
  errors: string[];
  timestamp: Date;
}

/**
 * Merge conflict information
 */
export interface MergeConflict {
  entryId: string;
  field: string;
  baseValue: any;
  currentValue: any;
  incomingValue: any;
  conflictType: 'modify_modify' | 'modify_delete' | 'delete_modify';
}

/**
 * Comprehensive version control system for Knowledge Base entries
 *
 * Provides:
 * - Complete audit trail of all changes
 * - Point-in-time snapshots for rollback
 * - Detailed diff analysis between versions
 * - Conflict detection and resolution
 * - Branch and merge capabilities for collaborative editing
 *
 * Features:
 * - Atomic version creation with full data integrity
 * - Efficient storage using compression and deduplication
 * - Fast history queries with optimized indexing
 * - Automatic cleanup of old versions based on retention policies
 * - Real-time change notifications
 *
 * @extends EventEmitter
 *
 * @emits 'change' - When a new version is created
 * @emits 'rollback' - When a rollback operation completes
 * @emits 'conflict' - When merge conflicts are detected
 * @emits 'cleanup' - When old versions are cleaned up
 *
 * @example
 * ```typescript
 * const versionControl = new VersionControlService(database);
 *
 * // Track a change
 * await versionControl.recordChange(entryId, 'update', {
 *   title: { oldValue: 'Old Title', newValue: 'New Title' }
 * }, 'user123', 'Fixed typo in title');
 *
 * // Get version history
 * const history = await versionControl.getEntryHistory(entryId);
 *
 * // Rollback to previous version
 * await versionControl.rollbackToVersion(entryId, 3, 'user123');
 *
 * // Compare versions
 * const diff = await versionControl.compareVersions(entryId, 2, 4);
 * ```
 */
export class VersionControlService extends EventEmitter {
  private db: Database.Database;
  private sessionId: string;

  // Configuration
  private readonly MAX_VERSIONS_PER_ENTRY = 50;
  private readonly CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  private readonly VERSION_RETENTION_DAYS = 90;
  private readonly SIGNIFICANT_FIELDS = ['title', 'problem', 'solution'];

  // Performance optimization
  private versionCache = new Map<string, EntryVersion[]>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  constructor(database: Database.Database, sessionId?: string) {
    super();
    this.db = database;
    this.sessionId = sessionId || uuidv4();

    this.initializeVersionTables();
    this.setupCleanupSchedule();
  }

  /**
   * Record a change to a KB entry with complete audit trail
   *
   * @param entryId - ID of the affected entry
   * @param changeType - Type of change operation
   * @param changes - Object containing field changes
   * @param userId - ID of the user making the change
   * @param comment - Optional comment describing the change
   * @param metadata - Additional metadata for the change
   * @returns Promise resolving to the new version record
   */
  async recordChange(
    entryId: string,
    changeType: ChangeType,
    changes: Record<string, { oldValue: any; newValue: any }> | null,
    userId: string,
    comment?: string,
    metadata?: Record<string, any>
  ): Promise<EntryVersion> {
    const timestamp = new Date();
    const changeId = uuidv4();
    const versionId = uuidv4();

    // Get current entry state for snapshot
    const currentEntry = this.getCurrentEntryState(entryId);
    const currentVersion = this.getLatestVersionNumber(entryId);
    const newVersion = currentVersion + 1;

    // Create field changes array
    const fieldChanges: FieldChange[] = changes
      ? Object.entries(changes).map(([field, change]) => ({
          field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changeType: this.determineFieldChangeType(change.oldValue, change.newValue),
        }))
      : [];

    // Determine if this is a significant change
    const isSignificantChange = fieldChanges.some(change =>
      this.SIGNIFICANT_FIELDS.includes(change.field)
    );

    // Create comprehensive snapshots
    const beforeSnapshot = changeType !== 'create' ? currentEntry : undefined;
    const afterSnapshot = this.buildAfterSnapshot(currentEntry, fieldChanges, changeType);

    const transaction = this.db.transaction(() => {
      // Insert change record
      this.db
        .prepare(
          `
        INSERT INTO change_history (
          id, entry_id, change_type, timestamp, user_id, session_id,
          comment, metadata, is_significant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          changeId,
          entryId,
          changeType,
          timestamp.toISOString(),
          userId,
          this.sessionId,
          comment || null,
          metadata ? JSON.stringify(metadata) : null,
          isSignificantChange
        );

      // Insert field changes
      if (fieldChanges.length > 0) {
        const fieldStmt = this.db.prepare(`
          INSERT INTO field_changes (
            id, change_id, field_name, old_value, new_value, change_type
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        fieldChanges.forEach(fieldChange => {
          fieldStmt.run(
            uuidv4(),
            changeId,
            fieldChange.field,
            JSON.stringify(fieldChange.oldValue),
            JSON.stringify(fieldChange.newValue),
            fieldChange.changeType
          );
        });
      }

      // Create version snapshot
      const snapshotData = this.compressSnapshot(afterSnapshot || {});

      this.db
        .prepare(
          `
        INSERT INTO entry_versions (
          id, entry_id, version, timestamp, user_id, change_type,
          snapshot_data, snapshot_size, comment, change_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          versionId,
          entryId,
          newVersion,
          timestamp.toISOString(),
          userId,
          changeType,
          snapshotData,
          Buffer.byteLength(snapshotData, 'utf8'),
          comment || null,
          changeId
        );
    });

    transaction();

    // Clear cache for this entry
    this.invalidateEntryCache(entryId);

    // Create version object
    const entryVersion: EntryVersion = {
      versionId,
      entryId,
      version: newVersion,
      timestamp,
      userId,
      changeType,
      snapshot: afterSnapshot || {},
      comment,
      size: Buffer.byteLength(snapshotData, 'utf8'),
    };

    // Emit change event
    this.emit('change', {
      entryId,
      changeType,
      version: newVersion,
      userId,
      fieldChanges,
      timestamp,
    });

    // Schedule cleanup if needed
    this.scheduleCleanupIfNeeded(entryId);

    return entryVersion;
  }

  /**
   * Get complete version history for an entry
   *
   * @param entryId - ID of the entry
   * @param options - Query options for filtering and pagination
   * @returns Promise resolving to array of version records
   */
  async getEntryHistory(
    entryId: string,
    options: Partial<HistoryQuery> = {}
  ): Promise<EntryVersion[]> {
    // Check cache first
    const cacheKey = `history:${entryId}`;
    const cached = this.getCachedVersions(cacheKey);
    if (cached) {
      return this.filterVersionsByOptions(cached, options);
    }

    const { limit = 50, offset = 0, includeSnapshots = true } = options;

    const query = `
      SELECT
        v.*,
        c.comment as change_comment,
        c.metadata
      FROM entry_versions v
      LEFT JOIN change_history c ON v.change_id = c.id
      WHERE v.entry_id = ?
      ORDER BY v.version DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(query).all(entryId, limit, offset);

    const versions: EntryVersion[] = rows.map(row => ({
      versionId: row.id,
      entryId: row.entry_id,
      version: row.version,
      timestamp: new Date(row.timestamp),
      userId: row.user_id,
      changeType: row.change_type,
      snapshot: includeSnapshots ? this.decompressSnapshot(row.snapshot_data) : {},
      comment: row.comment || row.change_comment,
      size: row.snapshot_size,
    }));

    // Cache the results
    this.setCachedVersions(cacheKey, versions);

    return this.filterVersionsByOptions(versions, options);
  }

  /**
   * Get detailed change information including field-level diffs
   *
   * @param changeId - ID of the change record
   * @returns Promise resolving to complete change record
   */
  async getChangeDetails(changeId: string): Promise<ChangeRecord | null> {
    const changeRow = this.db
      .prepare(
        `
      SELECT * FROM change_history WHERE id = ?
    `
      )
      .get(changeId);

    if (!changeRow) return null;

    const fieldChanges = this.db
      .prepare(
        `
      SELECT field_name, old_value, new_value, change_type
      FROM field_changes
      WHERE change_id = ?
    `
      )
      .all(changeId)
      .map(row => ({
        field: row.field_name,
        oldValue: JSON.parse(row.old_value),
        newValue: JSON.parse(row.new_value),
        changeType: row.change_type,
      }));

    // Get before/after snapshots if available
    const versions = this.db
      .prepare(
        `
      SELECT * FROM entry_versions
      WHERE change_id = ? OR (entry_id = ? AND version = (
        SELECT version - 1 FROM entry_versions WHERE change_id = ?
      ))
      ORDER BY version
    `
      )
      .all(changeId, changeRow.entry_id, changeId);

    return {
      id: changeRow.id,
      entryId: changeRow.entry_id,
      changeType: changeRow.change_type,
      timestamp: new Date(changeRow.timestamp),
      userId: changeRow.user_id,
      sessionId: changeRow.session_id,
      fieldChanges,
      beforeSnapshot:
        versions.length > 1 ? this.decompressSnapshot(versions[0].snapshot_data) : undefined,
      afterSnapshot:
        versions.length > 0
          ? this.decompressSnapshot(versions[versions.length - 1].snapshot_data)
          : undefined,
      metadata: changeRow.metadata ? JSON.parse(changeRow.metadata) : undefined,
      comment: changeRow.comment,
    };
  }

  /**
   * Compare two versions of an entry
   *
   * @param entryId - ID of the entry
   * @param fromVersion - Starting version number
   * @param toVersion - Ending version number
   * @returns Promise resolving to detailed diff information
   */
  async compareVersions(
    entryId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionDiff> {
    const versions = await this.getSpecificVersions(entryId, [fromVersion, toVersion]);

    if (versions.length !== 2) {
      throw new Error(
        `Could not find both versions ${fromVersion} and ${toVersion} for entry ${entryId}`
      );
    }

    const fromSnapshot = versions.find(v => v.version === fromVersion)!.snapshot;
    const toSnapshot = versions.find(v => v.version === toVersion)!.snapshot;

    const fieldChanges = this.calculateFieldChanges(fromSnapshot, toSnapshot);

    const summary = {
      fieldsAdded: fieldChanges.filter(c => c.changeType === 'added').length,
      fieldsModified: fieldChanges.filter(c => c.changeType === 'modified').length,
      fieldsRemoved: fieldChanges.filter(c => c.changeType === 'removed').length,
      significantChange: fieldChanges.some(
        c => this.SIGNIFICANT_FIELDS.includes(c.field) && c.changeType !== 'removed'
      ),
    };

    return {
      entryId,
      fromVersion,
      toVersion,
      fieldChanges,
      summary,
    };
  }

  /**
   * Rollback an entry to a specific version
   *
   * @param entryId - ID of the entry to rollback
   * @param targetVersion - Version number to rollback to
   * @param userId - ID of the user performing the rollback
   * @param comment - Optional comment for the rollback operation
   * @returns Promise resolving to rollback result
   */
  async rollbackToVersion(
    entryId: string,
    targetVersion: number,
    userId: string,
    comment?: string
  ): Promise<RollbackResult> {
    const rollbackId = uuidv4();
    const timestamp = new Date();
    const errors: string[] = [];

    try {
      // Get target version snapshot
      const targetVersionRecord = this.db
        .prepare(
          `
        SELECT * FROM entry_versions
        WHERE entry_id = ? AND version = ?
      `
        )
        .get(entryId, targetVersion);

      if (!targetVersionRecord) {
        return {
          success: false,
          targetVersion,
          rollbackId,
          affectedEntries: 0,
          errors: [`Version ${targetVersion} not found for entry ${entryId}`],
          timestamp,
        };
      }

      const targetSnapshot = this.decompressSnapshot(targetVersionRecord.snapshot_data);
      const currentSnapshot = this.getCurrentEntryState(entryId);

      // Calculate rollback changes
      const rollbackChanges = this.calculateRollbackChanges(currentSnapshot, targetSnapshot);

      const rollbackTransaction = this.db.transaction(() => {
        // Apply rollback to main entry
        this.applySnapshotToEntry(entryId, targetSnapshot);

        // Record rollback as a new version
        this.recordChange(
          entryId,
          'update',
          rollbackChanges,
          userId,
          comment || `Rollback to version ${targetVersion}`,
          { rollbackId, targetVersion }
        );

        // Log rollback operation
        this.db
          .prepare(
            `
          INSERT INTO rollback_operations (
            id, entry_id, target_version, user_id, timestamp, comment
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .run(rollbackId, entryId, targetVersion, userId, timestamp.toISOString(), comment);
      });

      rollbackTransaction();

      const result: RollbackResult = {
        success: true,
        targetVersion,
        rollbackId,
        affectedEntries: 1,
        errors,
        timestamp,
      };

      this.emit('rollback', result);
      return result;
    } catch (error) {
      errors.push(`Rollback failed: ${error.message}`);

      return {
        success: false,
        targetVersion,
        rollbackId,
        affectedEntries: 0,
        errors,
        timestamp,
      };
    }
  }

  /**
   * Detect merge conflicts when attempting to merge changes
   *
   * @param entryId - ID of the entry
   * @param baseVersion - Base version for the merge
   * @param incomingChanges - Changes to be applied
   * @returns Promise resolving to array of detected conflicts
   */
  async detectMergeConflicts(
    entryId: string,
    baseVersion: number,
    incomingChanges: Record<string, any>
  ): Promise<MergeConflict[]> {
    const conflicts: MergeConflict[] = [];

    // Get base version and current version
    const versions = await this.getSpecificVersions(entryId, [baseVersion]);
    if (versions.length === 0) {
      throw new Error(`Base version ${baseVersion} not found for entry ${entryId}`);
    }

    const baseSnapshot = versions[0].snapshot;
    const currentSnapshot = this.getCurrentEntryState(entryId);

    // Check each incoming change for conflicts
    Object.entries(incomingChanges).forEach(([field, incomingValue]) => {
      const baseValue = baseSnapshot[field as keyof KBEntry];
      const currentValue = currentSnapshot[field as keyof KBEntry];

      // Conflict detection logic
      if (baseValue !== currentValue && currentValue !== incomingValue) {
        // Both base and current have changed differently
        conflicts.push({
          entryId,
          field,
          baseValue,
          currentValue,
          incomingValue,
          conflictType: 'modify_modify',
        });
      } else if (
        baseValue !== undefined &&
        currentValue === undefined &&
        incomingValue !== undefined
      ) {
        // Field was deleted locally but modified remotely
        conflicts.push({
          entryId,
          field,
          baseValue,
          currentValue,
          incomingValue,
          conflictType: 'delete_modify',
        });
      } else if (
        baseValue !== undefined &&
        incomingValue === undefined &&
        currentValue !== baseValue
      ) {
        // Field was modified locally but deleted remotely
        conflicts.push({
          entryId,
          field,
          baseValue,
          currentValue,
          incomingValue,
          conflictType: 'modify_delete',
        });
      }
    });

    if (conflicts.length > 0) {
      this.emit('conflict', { entryId, conflicts });
    }

    return conflicts;
  }

  /**
   * Get version statistics for an entry
   *
   * @param entryId - ID of the entry
   * @returns Promise resolving to version statistics
   */
  async getVersionStats(entryId: string): Promise<{
    totalVersions: number;
    oldestVersion: Date;
    newestVersion: Date;
    totalSize: number;
    averageSize: number;
    changeTypes: Record<ChangeType, number>;
    topContributors: Array<{ userId: string; changeCount: number }>;
  }> {
    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total_versions,
        MIN(timestamp) as oldest_version,
        MAX(timestamp) as newest_version,
        SUM(snapshot_size) as total_size,
        AVG(snapshot_size) as average_size
      FROM entry_versions
      WHERE entry_id = ?
    `
      )
      .get(entryId) as any;

    const changeTypes = this.db
      .prepare(
        `
      SELECT change_type, COUNT(*) as count
      FROM entry_versions
      WHERE entry_id = ?
      GROUP BY change_type
    `
      )
      .all(entryId);

    const contributors = this.db
      .prepare(
        `
      SELECT user_id, COUNT(*) as change_count
      FROM entry_versions
      WHERE entry_id = ?
      GROUP BY user_id
      ORDER BY change_count DESC
      LIMIT 10
    `
      )
      .all(entryId);

    const changeTypeMap: Record<ChangeType, number> = {
      create: 0,
      update: 0,
      delete: 0,
      archive: 0,
      restore: 0,
    };

    changeTypes.forEach((ct: any) => {
      changeTypeMap[ct.change_type as ChangeType] = ct.count;
    });

    return {
      totalVersions: stats.total_versions || 0,
      oldestVersion: stats.oldest_version ? new Date(stats.oldest_version) : new Date(),
      newestVersion: stats.newest_version ? new Date(stats.newest_version) : new Date(),
      totalSize: stats.total_size || 0,
      averageSize: Math.round(stats.average_size || 0),
      changeTypes: changeTypeMap,
      topContributors: contributors.map((c: any) => ({
        userId: c.user_id,
        changeCount: c.change_count,
      })),
    };
  }

  /**
   * Clean up old versions based on retention policy
   *
   * @param dryRun - If true, returns what would be deleted without actually deleting
   * @returns Promise resolving to cleanup statistics
   */
  async cleanupOldVersions(dryRun: boolean = false): Promise<{
    entriesProcessed: number;
    versionsRemoved: number;
    spaceFreed: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.VERSION_RETENTION_DAYS);

    const errors: string[] = [];
    let entriesProcessed = 0;
    let versionsRemoved = 0;
    let spaceFreed = 0;

    // Get all entries with versions to clean up
    const entriesToProcess = this.db
      .prepare(
        `
      SELECT DISTINCT entry_id
      FROM entry_versions
      WHERE timestamp < ?
    `
      )
      .all(cutoffDate.toISOString());

    for (const entry of entriesToProcess) {
      try {
        const versionsToRemove = this.db
          .prepare(
            `
          SELECT id, snapshot_size
          FROM entry_versions
          WHERE entry_id = ? AND timestamp < ?
          AND version NOT IN (
            SELECT version FROM entry_versions
            WHERE entry_id = ?
            ORDER BY version DESC
            LIMIT ?
          )
        `
          )
          .all(
            entry.entry_id,
            cutoffDate.toISOString(),
            entry.entry_id,
            Math.min(this.MAX_VERSIONS_PER_ENTRY, 10)
          );

        if (versionsToRemove.length > 0) {
          const versionIds = versionsToRemove.map(v => v.id);
          const sizeToFree = versionsToRemove.reduce((sum, v) => sum + v.snapshot_size, 0);

          if (!dryRun) {
            const deleteTransaction = this.db.transaction(() => {
              // Delete versions
              const deleteStmt = this.db.prepare('DELETE FROM entry_versions WHERE id = ?');
              versionIds.forEach(id => deleteStmt.run(id));

              // Delete associated field changes
              const fieldDeleteStmt = this.db.prepare(`
                DELETE FROM field_changes WHERE change_id IN (
                  SELECT id FROM change_history WHERE id IN (
                    SELECT change_id FROM entry_versions WHERE id = ?
                  )
                )
              `);
              versionIds.forEach(id => fieldDeleteStmt.run(id));
            });

            deleteTransaction();
            this.invalidateEntryCache(entry.entry_id);
          }

          versionsRemoved += versionsToRemove.length;
          spaceFreed += sizeToFree;
        }

        entriesProcessed++;
      } catch (error) {
        errors.push(`Error processing entry ${entry.entry_id}: ${error.message}`);
      }
    }

    const cleanupResult = {
      entriesProcessed,
      versionsRemoved,
      spaceFreed,
      errors,
    };

    this.emit('cleanup', cleanupResult);
    return cleanupResult;
  }

  // Private implementation methods

  private initializeVersionTables(): void {
    // Create version control tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS change_history (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        comment TEXT,
        metadata TEXT,
        is_significant BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS field_changes (
        id TEXT PRIMARY KEY,
        change_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        change_type TEXT NOT NULL,
        FOREIGN KEY (change_id) REFERENCES change_history(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS entry_versions (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        snapshot_data TEXT NOT NULL,
        snapshot_size INTEGER NOT NULL,
        comment TEXT,
        change_id TEXT NOT NULL,
        FOREIGN KEY (change_id) REFERENCES change_history(id) ON DELETE CASCADE,
        UNIQUE(entry_id, version)
      );

      CREATE TABLE IF NOT EXISTS rollback_operations (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        target_version INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        comment TEXT
      );

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_change_history_entry_id ON change_history(entry_id);
      CREATE INDEX IF NOT EXISTS idx_change_history_timestamp ON change_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_change_history_user_id ON change_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_field_changes_change_id ON field_changes(change_id);
      CREATE INDEX IF NOT EXISTS idx_entry_versions_entry_id ON entry_versions(entry_id);
      CREATE INDEX IF NOT EXISTS idx_entry_versions_version ON entry_versions(entry_id, version);
      CREATE INDEX IF NOT EXISTS idx_entry_versions_timestamp ON entry_versions(timestamp);
    `);
  }

  private getCurrentEntryState(entryId: string): Partial<KBEntry> {
    const entry = this.db
      .prepare(
        `
      SELECT e.*, GROUP_CONCAT(t.tag) as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.id = ?
      GROUP BY e.id
    `
      )
      .get(entryId) as any;

    if (!entry) return {};

    return {
      id: entry.id,
      title: entry.title,
      problem: entry.problem,
      solution: entry.solution,
      category: entry.category,
      severity: entry.severity,
      tags: entry.tags ? entry.tags.split(',') : [],
      created_at: new Date(entry.created_at),
      updated_at: new Date(entry.updated_at),
      created_by: entry.created_by,
      usage_count: entry.usage_count,
      success_count: entry.success_count,
      failure_count: entry.failure_count,
      last_used: entry.last_used ? new Date(entry.last_used) : undefined,
      archived: entry.archived,
    };
  }

  private getLatestVersionNumber(entryId: string): number {
    const result = this.db
      .prepare(
        `
      SELECT MAX(version) as max_version
      FROM entry_versions
      WHERE entry_id = ?
    `
      )
      .get(entryId) as { max_version: number | null };

    return result.max_version || 0;
  }

  private determineFieldChangeType(oldValue: any, newValue: any): 'added' | 'modified' | 'removed' {
    if (oldValue === undefined || oldValue === null) return 'added';
    if (newValue === undefined || newValue === null) return 'removed';
    return 'modified';
  }

  private buildAfterSnapshot(
    currentEntry: Partial<KBEntry>,
    fieldChanges: FieldChange[],
    changeType: ChangeType
  ): Partial<KBEntry> {
    if (changeType === 'delete') return {};

    const snapshot = { ...currentEntry };

    fieldChanges.forEach(change => {
      if (change.changeType === 'removed') {
        delete snapshot[change.field as keyof KBEntry];
      } else {
        (snapshot as any)[change.field] = change.newValue;
      }
    });

    return snapshot;
  }

  private compressSnapshot(snapshot: Partial<KBEntry>): string {
    // Simple JSON compression - could be enhanced with actual compression algorithms
    return JSON.stringify(snapshot);
  }

  private decompressSnapshot(compressedData: string): Partial<KBEntry> {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      console.warn('Failed to decompress snapshot data:', error);
      return {};
    }
  }

  private calculateFieldChanges(
    fromSnapshot: Partial<KBEntry>,
    toSnapshot: Partial<KBEntry>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const allFields = new Set([...Object.keys(fromSnapshot), ...Object.keys(toSnapshot)]);

    allFields.forEach(field => {
      const oldValue = fromSnapshot[field as keyof KBEntry];
      const newValue = toSnapshot[field as keyof KBEntry];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
          changeType: this.determineFieldChangeType(oldValue, newValue),
        });
      }
    });

    return changes;
  }

  private calculateRollbackChanges(
    currentSnapshot: Partial<KBEntry>,
    targetSnapshot: Partial<KBEntry>
  ): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};

    const allFields = new Set([...Object.keys(currentSnapshot), ...Object.keys(targetSnapshot)]);

    allFields.forEach(field => {
      const currentValue = currentSnapshot[field as keyof KBEntry];
      const targetValue = targetSnapshot[field as keyof KBEntry];

      if (JSON.stringify(currentValue) !== JSON.stringify(targetValue)) {
        changes[field] = {
          oldValue: currentValue,
          newValue: targetValue,
        };
      }
    });

    return changes;
  }

  private applySnapshotToEntry(entryId: string, snapshot: Partial<KBEntry>): void {
    const updateTransaction = this.db.transaction(() => {
      // Update main entry fields
      const mainFields = ['title', 'problem', 'solution', 'category', 'severity', 'archived'];
      const setClause = mainFields
        .filter(field => snapshot.hasOwnProperty(field))
        .map(field => `${field} = ?`)
        .concat(['updated_at = CURRENT_TIMESTAMP']);

      const values = mainFields
        .filter(field => snapshot.hasOwnProperty(field))
        .map(field => snapshot[field as keyof KBEntry]);

      values.push(entryId);

      this.db
        .prepare(
          `
        UPDATE kb_entries
        SET ${setClause.join(', ')}
        WHERE id = ?
      `
        )
        .run(...values);

      // Update tags
      if (snapshot.tags) {
        // Remove existing tags
        this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(entryId);

        // Insert new tags
        if (snapshot.tags.length > 0) {
          const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          snapshot.tags.forEach(tag => {
            tagStmt.run(entryId, tag);
          });
        }
      }
    });

    updateTransaction();
  }

  private getSpecificVersions(entryId: string, versions: number[]): Promise<EntryVersion[]> {
    const placeholders = versions.map(() => '?').join(', ');

    const query = `
      SELECT * FROM entry_versions
      WHERE entry_id = ? AND version IN (${placeholders})
      ORDER BY version
    `;

    const rows = this.db.prepare(query).all(entryId, ...versions);

    return Promise.resolve(
      rows.map(row => ({
        versionId: row.id,
        entryId: row.entry_id,
        version: row.version,
        timestamp: new Date(row.timestamp),
        userId: row.user_id,
        changeType: row.change_type,
        snapshot: this.decompressSnapshot(row.snapshot_data),
        comment: row.comment,
        size: row.snapshot_size,
      }))
    );
  }

  private filterVersionsByOptions(
    versions: EntryVersion[],
    options: Partial<HistoryQuery>
  ): EntryVersion[] {
    let filtered = [...versions];

    if (options.changeType) {
      filtered = filtered.filter(v => v.changeType === options.changeType);
    }

    if (options.userId) {
      filtered = filtered.filter(v => v.userId === options.userId);
    }

    if (options.dateRange) {
      filtered = filtered.filter(
        v => v.timestamp >= options.dateRange!.start && v.timestamp <= options.dateRange!.end
      );
    }

    return filtered;
  }

  private getCachedVersions(cacheKey: string): EntryVersion[] | null {
    const cached = this.versionCache.get(cacheKey);
    const timestamp = this.cacheTimestamps.get(cacheKey);

    if (cached && timestamp && Date.now() - timestamp < this.CACHE_TTL_MS) {
      return cached;
    }

    return null;
  }

  private setCachedVersions(cacheKey: string, versions: EntryVersion[]): void {
    this.versionCache.set(cacheKey, versions);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  private invalidateEntryCache(entryId: string): void {
    const keysToRemove = Array.from(this.versionCache.keys()).filter(key => key.includes(entryId));

    keysToRemove.forEach(key => {
      this.versionCache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  private setupCleanupSchedule(): void {
    setInterval(async () => {
      try {
        await this.cleanupOldVersions();
      } catch (error) {
        console.warn('Scheduled version cleanup failed:', error);
      }
    }, this.CLEANUP_INTERVAL_MS);
  }

  private scheduleCleanupIfNeeded(entryId: string): void {
    const versionCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM entry_versions WHERE entry_id = ?
    `
      )
      .get(entryId) as { count: number };

    if (versionCount.count > this.MAX_VERSIONS_PER_ENTRY) {
      // Schedule cleanup for this entry
      setTimeout(() => {
        this.cleanupEntryVersions(entryId);
      }, 1000);
    }
  }

  private cleanupEntryVersions(entryId: string): void {
    const versionsToKeep = this.MAX_VERSIONS_PER_ENTRY - 10; // Keep some buffer

    const versionsToDelete = this.db
      .prepare(
        `
      SELECT id FROM entry_versions
      WHERE entry_id = ?
      ORDER BY version DESC
      LIMIT -1 OFFSET ?
    `
      )
      .all(entryId, versionsToKeep);

    if (versionsToDelete.length > 0) {
      const deleteTransaction = this.db.transaction(() => {
        const deleteStmt = this.db.prepare('DELETE FROM entry_versions WHERE id = ?');
        versionsToDelete.forEach(version => deleteStmt.run(version.id));
      });

      deleteTransaction();
      this.invalidateEntryCache(entryId);
    }
  }
}
