"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionControlService = void 0;
const events_1 = require("events");
class VersionControlService extends events_1.EventEmitter {
    db;
    cache = new Map();
    config = {
        max_versions_per_entry: 50,
        auto_cleanup_days: 90,
        enable_branching: true,
        require_change_summary: true,
        significant_change_threshold: 0.3
    };
    constructor(database, options = {}) {
        super();
        this.db = database;
        this.config = { ...this.config, ...options };
        this.initializeDatabase();
    }
    initializeDatabase() {
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS entry_versions (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          problem TEXT NOT NULL,
          solution TEXT NOT NULL,
          category TEXT,
          tags TEXT, -- JSON array
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          editor_id TEXT,
          editor_name TEXT,
          change_summary TEXT,
          changed_fields TEXT, -- JSON array
          parent_version INTEGER,
          is_current BOOLEAN DEFAULT 0,
          data_hash TEXT,
          UNIQUE(entry_id, version)
        );

        CREATE TABLE IF NOT EXISTS change_records (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          editor_id TEXT NOT NULL,
          editor_name TEXT NOT NULL,
          change_type TEXT CHECK(change_type IN ('create', 'update', 'delete', 'restore')),
          change_summary TEXT,
          changed_fields TEXT, -- JSON array
          previous_data TEXT, -- JSON
          new_data TEXT, -- JSON
          diff_data TEXT -- JSON array of FieldDiff
        );

        CREATE TABLE IF NOT EXISTS version_branches (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          name TEXT NOT NULL,
          base_version INTEGER NOT NULL,
          tip_version INTEGER NOT NULL,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          description TEXT,
          is_active BOOLEAN DEFAULT 1,
          UNIQUE(entry_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_entry_versions ON entry_versions(entry_id, version);
        CREATE INDEX IF NOT EXISTS idx_current_versions ON entry_versions(entry_id, is_current);
        CREATE INDEX IF NOT EXISTS idx_change_records_entry ON change_records(entry_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_version_branches ON version_branches(entry_id, name);
      `);
            console.log('✅ Version control database initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize version control database:', error);
            throw error;
        }
    }
    async createVersion(entry, editorId, editorName, changeSummary, changedFields) {
        try {
            const entryId = entry.id;
            const currentVersion = await this.getCurrentVersion(entryId);
            const newVersion = currentVersion + 1;
            const dataHash = this.generateDataHash(entry);
            if (!changedFields && currentVersion > 0) {
                const previousEntry = await this.getVersion(entryId, currentVersion);
                changedFields = previousEntry ? this.detectChangedFields(previousEntry, entry) : [];
            }
            const versionedEntry = {
                ...entry,
                version: newVersion,
                change_summary: changeSummary,
                changed_fields: changedFields || [],
                editor_id: editorId,
                editor_name: editorName
            };
            const transaction = this.db.transaction(() => {
                if (currentVersion > 0) {
                    this.db.prepare(`
            UPDATE entry_versions
            SET is_current = 0
            WHERE entry_id = ? AND version = ?
          `).run(entryId, currentVersion);
                }
                this.db.prepare(`
          INSERT INTO entry_versions (
            id, entry_id, version, title, problem, solution, category, tags,
            editor_id, editor_name, change_summary, changed_fields, parent_version,
            is_current, data_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`${entryId}-v${newVersion}`, entryId, newVersion, entry.title, entry.problem, entry.solution, entry.category, JSON.stringify(entry.tags || []), editorId, editorName, changeSummary || 'No summary provided', JSON.stringify(changedFields || []), currentVersion || null, 1, dataHash);
                const changeRecord = {
                    id: `change-${entryId}-${newVersion}-${Date.now()}`,
                    entry_id: entryId,
                    version: newVersion,
                    timestamp: new Date(),
                    editor_id: editorId,
                    editor_name: editorName,
                    change_type: currentVersion === 0 ? 'create' : 'update',
                    change_summary: changeSummary || 'No summary provided',
                    changed_fields: changedFields || [],
                    new_data: entry
                };
                if (currentVersion > 0) {
                    const previousEntry = this.getVersionSync(entryId, currentVersion);
                    if (previousEntry) {
                        changeRecord.previous_data = previousEntry;
                        changeRecord.diff = this.generateDiff(previousEntry, entry);
                    }
                }
                this.db.prepare(`
          INSERT INTO change_records (
            id, entry_id, version, editor_id, editor_name, change_type,
            change_summary, changed_fields, previous_data, new_data, diff_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(changeRecord.id, changeRecord.entry_id, changeRecord.version, changeRecord.editor_id, changeRecord.editor_name, changeRecord.change_type, changeRecord.change_summary, JSON.stringify(changeRecord.changed_fields), changeRecord.previous_data ? JSON.stringify(changeRecord.previous_data) : null, JSON.stringify(changeRecord.new_data), changeRecord.diff ? JSON.stringify(changeRecord.diff) : null);
            });
            transaction();
            this.cache.delete(entryId);
            this.emit('version-created', {
                entry_id: entryId,
                version: newVersion,
                change_type: currentVersion === 0 ? 'create' : 'update',
                editor: editorName
            });
            await this.cleanupOldVersions(entryId);
            console.log(`✅ Created version ${newVersion} for entry ${entryId}`);
            return versionedEntry;
        }
        catch (error) {
            console.error('❌ Failed to create version:', error);
            throw error;
        }
    }
    async getVersion(entryId, version) {
        try {
            const result = this.db.prepare(`
        SELECT * FROM entry_versions
        WHERE entry_id = ? AND version = ?
      `).get(entryId, version);
            if (!result)
                return null;
            return this.parseVersionedEntry(result);
        }
        catch (error) {
            console.error('❌ Failed to get version:', error);
            return null;
        }
    }
    getVersionSync(entryId, version) {
        try {
            const result = this.db.prepare(`
        SELECT * FROM entry_versions
        WHERE entry_id = ? AND version = ?
      `).get(entryId, version);
            if (!result)
                return null;
            return this.parseVersionedEntry(result);
        }
        catch (error) {
            console.error('❌ Failed to get version (sync):', error);
            return null;
        }
    }
    async getCurrentVersion(entryId) {
        try {
            const result = this.db.prepare(`
        SELECT MAX(version) as max_version
        FROM entry_versions
        WHERE entry_id = ?
      `).get(entryId);
            return result?.max_version || 0;
        }
        catch (error) {
            console.error('❌ Failed to get current version:', error);
            return 0;
        }
    }
    async getVersionHistory(entryId) {
        try {
            if (this.cache.has(entryId)) {
                return this.cache.get(entryId);
            }
            const versions = this.db.prepare(`
        SELECT * FROM entry_versions
        WHERE entry_id = ?
        ORDER BY version DESC
      `).all(entryId).map((row) => this.parseVersionedEntry(row));
            const changes = this.db.prepare(`
        SELECT * FROM change_records
        WHERE entry_id = ?
        ORDER BY timestamp DESC
      `).all(entryId).map((row) => this.parseChangeRecord(row));
            let branches = [];
            if (this.config.enable_branching) {
                branches = this.db.prepare(`
          SELECT * FROM version_branches
          WHERE entry_id = ? AND is_active = 1
          ORDER BY created_at DESC
        `).all(entryId).map((row) => this.parseVersionBranch(row));
            }
            const history = {
                entry_id: entryId,
                current_version: versions.length > 0 ? versions[0].version : 0,
                versions,
                changes,
                branches: branches.length > 0 ? branches : undefined
            };
            this.cache.set(entryId, history);
            return history;
        }
        catch (error) {
            console.error('❌ Failed to get version history:', error);
            throw error;
        }
    }
    async rollbackToVersion(entryId, targetVersion, editorId, editorName, options) {
        try {
            console.log(`🔄 Rolling back entry ${entryId} to version ${targetVersion}`);
            const targetEntry = await this.getVersion(entryId, targetVersion);
            if (!targetEntry) {
                throw new Error(`Version ${targetVersion} not found for entry ${entryId}`);
            }
            if (options.create_backup) {
                const currentVersion = await this.getCurrentVersion(entryId);
                if (currentVersion > targetVersion) {
                    console.log(`📦 Creating backup of version ${currentVersion}`);
                }
            }
            let rolledBackEntry;
            switch (options.merge_strategy) {
                case 'overwrite':
                    rolledBackEntry = { ...targetEntry };
                    delete rolledBackEntry.version;
                    delete rolledBackEntry.change_summary;
                    delete rolledBackEntry.changed_fields;
                    delete rolledBackEntry.editor_id;
                    delete rolledBackEntry.editor_name;
                    break;
                case 'selective':
                    const currentEntry = await this.getVersion(entryId, await this.getCurrentVersion(entryId));
                    rolledBackEntry = { ...currentEntry };
                    const fieldsToRollback = Object.keys(targetEntry).filter(field => !options.preserve_fields?.includes(field));
                    fieldsToRollback.forEach(field => {
                        if (field in targetEntry) {
                            rolledBackEntry[field] = targetEntry[field];
                        }
                    });
                    break;
                case 'merge':
                    const baseEntry = await this.getVersion(entryId, targetVersion);
                    const currentEntryForMerge = await this.getVersion(entryId, await this.getCurrentVersion(entryId));
                    const mergeResult = await this.mergeVersions(baseEntry, currentEntryForMerge, targetEntry);
                    if (!mergeResult.success) {
                        throw new Error(`Merge conflicts detected: ${mergeResult.conflicts?.length} conflicts`);
                    }
                    rolledBackEntry = mergeResult.merged_entry;
                    break;
                default:
                    rolledBackEntry = { ...targetEntry };
            }
            const changeFields = this.detectChangedFields(targetEntry, rolledBackEntry);
            const changeSummary = options.change_summary ||
                `Rolled back to version ${targetVersion} using ${options.merge_strategy} strategy`;
            const newVersion = await this.createVersion(rolledBackEntry, editorId, editorName, changeSummary, changeFields);
            await this.recordRollback(entryId, targetVersion, newVersion.version, editorId, editorName, options);
            console.log(`✅ Successfully rolled back to version ${targetVersion}`);
            this.emit('rollback-completed', {
                entry_id: entryId,
                from_version: await this.getCurrentVersion(entryId) - 1,
                to_version: targetVersion,
                new_version: newVersion.version,
                strategy: options.merge_strategy
            });
            return newVersion;
        }
        catch (error) {
            console.error('❌ Rollback failed:', error);
            throw error;
        }
    }
    async recordRollback(entryId, targetVersion, newVersion, editorId, editorName, options) {
        const changeRecord = {
            id: `rollback-${entryId}-${newVersion}-${Date.now()}`,
            entry_id: entryId,
            version: newVersion,
            timestamp: new Date(),
            editor_id: editorId,
            editor_name: editorName,
            change_type: 'restore',
            change_summary: `Rolled back to version ${targetVersion}`,
            changed_fields: ['rollback_operation']
        };
        this.db.prepare(`
      INSERT INTO change_records (
        id, entry_id, version, editor_id, editor_name, change_type,
        change_summary, changed_fields, new_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(changeRecord.id, changeRecord.entry_id, changeRecord.version, changeRecord.editor_id, changeRecord.editor_name, changeRecord.change_type, changeRecord.change_summary, JSON.stringify(changeRecord.changed_fields), JSON.stringify(options));
    }
    async compareVersions(entryId, versionA, versionB) {
        try {
            const entryA = await this.getVersion(entryId, versionA);
            const entryB = await this.getVersion(entryId, versionB);
            if (!entryA || !entryB) {
                throw new Error('One or both versions not found');
            }
            const differences = this.generateDiff(entryA, entryB);
            const similarityScore = this.calculateSimilarity(entryA, entryB);
            const changeSummary = this.generateChangeSummary(differences);
            const impactAssessment = this.assessChangeImpact(differences, similarityScore);
            return {
                differences,
                similarity_score: similarityScore,
                change_summary: changeSummary,
                impact_assessment: impactAssessment
            };
        }
        catch (error) {
            console.error('❌ Failed to compare versions:', error);
            throw error;
        }
    }
    generateDiff(entryA, entryB) {
        const diffs = [];
        const fieldsToCompare = ['title', 'problem', 'solution', 'category', 'tags'];
        fieldsToCompare.forEach(field => {
            const valueA = entryA[field];
            const valueB = entryB[field];
            if (Array.isArray(valueA) && Array.isArray(valueB)) {
                const addedTags = valueB.filter((tag) => !valueA.includes(tag));
                const removedTags = valueA.filter((tag) => !valueB.includes(tag));
                addedTags.forEach((tag) => {
                    diffs.push({
                        field: `${field}[]`,
                        operation: 'added',
                        new_value: tag
                    });
                });
                removedTags.forEach((tag) => {
                    diffs.push({
                        field: `${field}[]`,
                        operation: 'removed',
                        old_value: tag
                    });
                });
            }
            else if (valueA !== valueB) {
                if (!valueA && valueB) {
                    diffs.push({
                        field,
                        operation: 'added',
                        new_value: valueB
                    });
                }
                else if (valueA && !valueB) {
                    diffs.push({
                        field,
                        operation: 'removed',
                        old_value: valueA
                    });
                }
                else {
                    diffs.push({
                        field,
                        operation: 'changed',
                        old_value: valueA,
                        new_value: valueB
                    });
                }
            }
        });
        return diffs;
    }
    calculateSimilarity(entryA, entryB) {
        const totalFields = 4;
        const fieldsToCheck = ['title', 'problem', 'solution', 'category'];
        let changedFields = 0;
        fieldsToCheck.forEach(field => {
            if (entryA[field] !== entryB[field]) {
                changedFields++;
            }
        });
        const tagsA = entryA.tags || [];
        const tagsB = entryB.tags || [];
        if (JSON.stringify(tagsA.sort()) !== JSON.stringify(tagsB.sort())) {
            changedFields += 0.5;
        }
        return Math.max(0, (totalFields - changedFields) / totalFields);
    }
    generateChangeSummary(differences) {
        if (differences.length === 0) {
            return 'No changes detected';
        }
        const changes = [];
        const changesByField = differences.reduce((acc, diff) => {
            if (!acc[diff.field])
                acc[diff.field] = [];
            acc[diff.field].push(diff);
            return acc;
        }, {});
        Object.entries(changesByField).forEach(([field, fieldDiffs]) => {
            const operations = fieldDiffs.map(d => d.operation);
            if (operations.includes('changed')) {
                changes.push(`${field} modified`);
            }
            else {
                const added = operations.filter(op => op === 'added').length;
                const removed = operations.filter(op => op === 'removed').length;
                if (added > 0 && removed > 0) {
                    changes.push(`${field} updated (${added} added, ${removed} removed)`);
                }
                else if (added > 0) {
                    changes.push(`${field} added (${added})`);
                }
                else if (removed > 0) {
                    changes.push(`${field} removed (${removed})`);
                }
            }
        });
        return changes.join(', ');
    }
    assessChangeImpact(differences, similarityScore) {
        const criticalFields = ['title', 'problem', 'solution'];
        const criticalChanges = differences.filter(diff => criticalFields.some(field => diff.field.startsWith(field)));
        if (criticalChanges.length >= 2 || similarityScore < 0.5) {
            return 'high';
        }
        if (criticalChanges.length === 1 || similarityScore < 0.8) {
            return 'medium';
        }
        return 'low';
    }
    async mergeVersions(baseEntry, versionA, versionB) {
        try {
            const conflicts = [];
            const warnings = [];
            const mergedEntry = { ...baseEntry };
            const fieldsToMerge = ['title', 'problem', 'solution', 'category', 'tags'];
            fieldsToMerge.forEach(field => {
                const baseValue = baseEntry[field];
                const valueA = versionA[field];
                const valueB = versionB[field];
                if (JSON.stringify(valueA) === JSON.stringify(valueB)) {
                    mergedEntry[field] = valueA;
                    return;
                }
                if (Array.isArray(baseValue)) {
                    const mergedTags = this.mergeTags(baseValue, valueA, valueB);
                    mergedEntry[field] = mergedTags.tags;
                    if (mergedTags.conflicts.length > 0) {
                        conflicts.push({
                            field,
                            base_value: baseValue,
                            version_a: valueA,
                            version_b: valueB,
                            resolution_required: false,
                            suggested_resolution: mergedTags.tags
                        });
                    }
                    return;
                }
                if (baseValue === valueA && baseValue !== valueB) {
                    mergedEntry[field] = valueB;
                    return;
                }
                if (baseValue === valueB && baseValue !== valueA) {
                    mergedEntry[field] = valueA;
                    return;
                }
                conflicts.push({
                    field,
                    base_value: baseValue,
                    version_a: valueA,
                    version_b: valueB,
                    resolution_required: true,
                    suggested_resolution: this.suggestResolution(field, valueA, valueB)
                });
                mergedEntry[field] = this.suggestResolution(field, valueA, valueB);
            });
            const success = conflicts.filter(c => c.resolution_required).length === 0;
            return {
                success,
                merged_entry: success ? mergedEntry : undefined,
                conflicts: conflicts.length > 0 ? conflicts : undefined,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        }
        catch (error) {
            console.error('❌ Failed to merge versions:', error);
            return { success: false };
        }
    }
    mergeTags(baseTags, tagsA, tagsB) {
        const addedA = tagsA.filter(tag => !baseTags.includes(tag));
        const addedB = tagsB.filter(tag => !baseTags.includes(tag));
        const removedA = baseTags.filter(tag => !tagsA.includes(tag));
        const removedB = baseTags.filter(tag => !tagsB.includes(tag));
        let merged = [...baseTags];
        const conflicts = [];
        addedA.forEach(tag => {
            if (!merged.includes(tag))
                merged.push(tag);
        });
        addedB.forEach(tag => {
            if (!merged.includes(tag))
                merged.push(tag);
        });
        removedA.forEach(tag => {
            if (removedB.includes(tag)) {
                merged = merged.filter(t => t !== tag);
            }
            else {
                conflicts.push(tag);
            }
        });
        removedB.forEach(tag => {
            if (!removedA.includes(tag)) {
                if (!conflicts.includes(tag)) {
                    conflicts.push(tag);
                }
            }
        });
        return { tags: merged, conflicts };
    }
    suggestResolution(field, valueA, valueB) {
        switch (field) {
            case 'title':
                return valueA.length > valueB.length ? valueA : valueB;
            case 'problem':
            case 'solution':
                return valueA.length > valueB.length ? valueA : valueB;
            case 'category':
                return valueA < valueB ? valueA : valueB;
            default:
                return valueB;
        }
    }
    detectChangedFields(oldEntry, newEntry) {
        const changed = [];
        const fieldsToCheck = ['title', 'problem', 'solution', 'category', 'tags'];
        fieldsToCheck.forEach(field => {
            const oldValue = oldEntry[field];
            const newValue = newEntry[field];
            if (Array.isArray(oldValue) && Array.isArray(newValue)) {
                if (JSON.stringify(oldValue.sort()) !== JSON.stringify(newValue.sort())) {
                    changed.push(field);
                }
            }
            else if (oldValue !== newValue) {
                changed.push(field);
            }
        });
        return changed;
    }
    generateDataHash(entry) {
        const data = {
            title: entry.title,
            problem: entry.problem,
            solution: entry.solution,
            category: entry.category,
            tags: (entry.tags || []).sort()
        };
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    parseVersionedEntry(row) {
        return {
            id: row.entry_id,
            title: row.title,
            problem: row.problem,
            solution: row.solution,
            category: row.category,
            tags: row.tags ? JSON.parse(row.tags) : [],
            created_at: new Date(row.created_at),
            version: row.version,
            change_summary: row.change_summary,
            changed_fields: row.changed_fields ? JSON.parse(row.changed_fields) : [],
            editor_id: row.editor_id,
            editor_name: row.editor_name
        };
    }
    parseChangeRecord(row) {
        return {
            id: row.id,
            entry_id: row.entry_id,
            version: row.version,
            timestamp: new Date(row.timestamp),
            editor_id: row.editor_id,
            editor_name: row.editor_name,
            change_type: row.change_type,
            change_summary: row.change_summary,
            changed_fields: row.changed_fields ? JSON.parse(row.changed_fields) : [],
            previous_data: row.previous_data ? JSON.parse(row.previous_data) : undefined,
            new_data: row.new_data ? JSON.parse(row.new_data) : undefined,
            diff: row.diff_data ? JSON.parse(row.diff_data) : undefined
        };
    }
    parseVersionBranch(row) {
        return {
            id: row.id,
            name: row.name,
            base_version: row.base_version,
            tip_version: row.tip_version,
            created_by: row.created_by,
            created_at: new Date(row.created_at),
            description: row.description
        };
    }
    async cleanupOldVersions(entryId) {
        try {
            const versionCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM entry_versions WHERE entry_id = ?
      `).get(entryId).count;
            if (versionCount > this.config.max_versions_per_entry) {
                const versionsToDelete = versionCount - this.config.max_versions_per_entry;
                this.db.prepare(`
          DELETE FROM entry_versions
          WHERE entry_id = ? AND version IN (
            SELECT version FROM entry_versions
            WHERE entry_id = ? AND is_current = 0
            ORDER BY version ASC
            LIMIT ?
          )
        `).run(entryId, entryId, versionsToDelete);
                console.log(`🧹 Cleaned up ${versionsToDelete} old versions for entry ${entryId}`);
            }
        }
        catch (error) {
            console.error('❌ Failed to cleanup old versions:', error);
        }
    }
    async getEntryWithHistory(entryId) {
        try {
            const currentVersion = await this.getCurrentVersion(entryId);
            const current = currentVersion > 0 ? await this.getVersion(entryId, currentVersion) : null;
            const history = await this.getVersionHistory(entryId);
            return { current, history };
        }
        catch (error) {
            console.error('❌ Failed to get entry with history:', error);
            throw error;
        }
    }
    async searchVersions(query, entryId) {
        try {
            let sql = `
        SELECT * FROM entry_versions
        WHERE (title LIKE ? OR problem LIKE ? OR solution LIKE ?)
      `;
            const params = [`%${query}%`, `%${query}%`, `%${query}%`];
            if (entryId) {
                sql += ` AND entry_id = ?`;
                params.push(entryId);
            }
            sql += ` ORDER BY version DESC LIMIT 50`;
            const results = this.db.prepare(sql).all(...params);
            return results.map((row) => this.parseVersionedEntry(row));
        }
        catch (error) {
            console.error('❌ Failed to search versions:', error);
            return [];
        }
    }
    async getRecentChanges(limit = 20) {
        try {
            const results = this.db.prepare(`
        SELECT * FROM change_records
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit);
            return results.map((row) => this.parseChangeRecord(row));
        }
        catch (error) {
            console.error('❌ Failed to get recent changes:', error);
            return [];
        }
    }
    async cleanup() {
        try {
            this.cache.clear();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.auto_cleanup_days);
            const deletedCount = this.db.prepare(`
        DELETE FROM change_records
        WHERE timestamp < ? AND change_type != 'create'
      `).run(cutoffDate.toISOString()).changes;
            console.log(`🧹 Cleaned up ${deletedCount} old change records`);
            this.emit('cleanup-completed', { deleted_records: deletedCount });
        }
        catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
    dispose() {
        this.cache.clear();
        this.removeAllListeners();
    }
}
exports.VersionControlService = VersionControlService;
exports.default = VersionControlService;
//# sourceMappingURL=VersionControlService.js.map