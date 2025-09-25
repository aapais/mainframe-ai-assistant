/**
 * Version Control Hook
 *
 * Comprehensive version control hook with:
 * - Version history tracking
 * - Diff comparison utilities
 * - Rollback functionality
 * - Merge conflict resolution
 * - Branch management
 * - Tag and annotation support
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ========================
// Types & Interfaces
// ========================

export interface Version {
  id: string;
  entry_id: string;
  version_number: number;
  content: Record<string, any>;
  metadata: VersionMetadata;
  created_at: Date;
  created_by: string;
  parent_version_id?: string;
  branch?: string;
  tags: string[];
  is_current: boolean;
}

export interface VersionMetadata {
  change_type: 'create' | 'update' | 'delete' | 'merge' | 'restore';
  change_summary: string;
  fields_changed: string[];
  change_size: number;
  validation_status: 'pending' | 'valid' | 'invalid';
  conflict_resolved?: boolean;
}

export interface VersionDiff {
  field: string;
  old_value: any;
  new_value: any;
  change_type: 'added' | 'modified' | 'deleted';
  line_changes?: LineDiff[];
}

export interface LineDiff {
  line_number: number;
  type: 'added' | 'deleted' | 'modified' | 'unchanged';
  content: string;
  old_content?: string;
}

export interface MergeConflict {
  field: string;
  base_value: any;
  current_value: any;
  incoming_value: any;
  resolution?: 'current' | 'incoming' | 'manual';
  resolved_value?: any;
}

export interface MergeResult {
  success: boolean;
  conflicts: MergeConflict[];
  merged_content: Record<string, any>;
  requires_manual_resolution: boolean;
}

export interface VersionBranch {
  name: string;
  created_at: Date;
  created_by: string;
  base_version_id: string;
  current_version_id: string;
  description?: string;
  is_merged: boolean;
}

export interface UseVersionControlOptions {
  enableAutoVersioning?: boolean;
  enableBranching?: boolean;
  enableConflictResolution?: boolean;
  enableDiffOptimization?: boolean;
  maxVersionHistory?: number;
  autoCleanup?: boolean;
  cleanupThreshold?: number;
  diffContext?: number;
}

export interface UseVersionControlReturn {
  // Version state
  versions: Version[];
  currentVersion: Version | null;
  branches: VersionBranch[];
  isLoading: boolean;
  error: string | null;

  // Version operations
  createVersion: (
    entryId: string,
    content: Record<string, any>,
    metadata: Partial<VersionMetadata>
  ) => Promise<Version>;
  rollbackToVersion: (versionId: string, createBackup?: boolean) => Promise<Version>;
  deleteVersion: (versionId: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<Version>;

  // Diff operations
  compareDiffs: (fromVersionId: string, toVersionId: string) => VersionDiff[];
  getVersionDiff: (versionId: string, compareWith?: string) => VersionDiff[];
  generateTextDiff: (oldText: string, newText: string) => LineDiff[];

  // Branch operations
  createBranch: (
    name: string,
    fromVersionId?: string,
    description?: string
  ) => Promise<VersionBranch>;
  switchBranch: (branchName: string) => Promise<void>;
  mergeBranch: (sourceBranch: string, targetBranch: string) => Promise<MergeResult>;
  deleteBranch: (branchName: string, force?: boolean) => Promise<void>;

  // Tag operations
  tagVersion: (versionId: string, tag: string) => Promise<void>;
  removeTag: (versionId: string, tag: string) => Promise<void>;
  getVersionsByTag: (tag: string) => Version[];

  // Conflict resolution
  resolveConflict: (
    conflict: MergeConflict,
    resolution: 'current' | 'incoming' | 'manual',
    customValue?: any
  ) => MergeConflict;
  resolveAllConflicts: (
    conflicts: MergeConflict[],
    strategy: 'current' | 'incoming'
  ) => MergeConflict[];

  // History analysis
  getVersionHistory: (entryId: string, limit?: number) => Version[];
  getVersionStats: (entryId: string) => VersionStats;
  findVersionByContent: (searchContent: Partial<Record<string, any>>) => Version[];

  // Utilities
  exportHistory: (entryId: string) => string;
  importHistory: (historyData: string) => Promise<void>;
  cleanupOldVersions: (entryId: string, keepCount?: number) => Promise<number>;
  validateVersion: (version: Version) => ValidationResult;
}

export interface VersionStats {
  total_versions: number;
  creation_frequency: Record<string, number>;
  top_contributors: Array<{ user: string; count: number }>;
  change_types: Record<string, number>;
  avg_change_size: number;
  most_changed_fields: Array<{ field: string; changes: number }>;
  branch_count: number;
  conflict_rate: number;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ========================
// Default Configuration
// ========================

const DEFAULT_OPTIONS: Required<UseVersionControlOptions> = {
  enableAutoVersioning: true,
  enableBranching: true,
  enableConflictResolution: true,
  enableDiffOptimization: true,
  maxVersionHistory: 100,
  autoCleanup: true,
  cleanupThreshold: 150,
  diffContext: 3,
};

// ========================
// Hook Implementation
// ========================

export const useVersionControl = (
  options: UseVersionControlOptions = {}
): UseVersionControlReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // State management
  const [versions, setVersions] = useState<Version[]>([]);
  const [branches, setBranches] = useState<VersionBranch[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for internal tracking
  const versionIdCounter = useRef(0);
  const currentBranch = useRef<string>('main');

  // Initialize default branch
  useEffect(() => {
    if (branches.length === 0 && config.enableBranching) {
      const mainBranch: VersionBranch = {
        name: 'main',
        created_at: new Date(),
        created_by: 'system',
        base_version_id: '',
        current_version_id: '',
        description: 'Main branch',
        is_merged: false,
      };
      setBranches([mainBranch]);
    }
  }, [branches.length, config.enableBranching]);

  // Auto cleanup when over threshold
  useEffect(() => {
    if (config.autoCleanup && versions.length > config.cleanupThreshold) {
      // Group by entry_id and cleanup each
      const entriesByGroup = versions.reduce(
        (acc, version) => {
          if (!acc[version.entry_id]) acc[version.entry_id] = [];
          acc[version.entry_id].push(version);
          return acc;
        },
        {} as Record<string, Version[]>
      );

      Object.keys(entriesByGroup).forEach(entryId => {
        if (entriesByGroup[entryId].length > config.maxVersionHistory) {
          cleanupOldVersions(entryId, config.maxVersionHistory);
        }
      });
    }
  }, [versions.length, config.autoCleanup, config.cleanupThreshold, config.maxVersionHistory]);

  // Generate unique version ID
  const generateVersionId = useCallback((): string => {
    return `version_${Date.now()}_${++versionIdCounter.current}`;
  }, []);

  // Create new version
  const createVersion = useCallback(
    async (
      entryId: string,
      content: Record<string, any>,
      metadata: Partial<VersionMetadata>
    ): Promise<Version> => {
      setIsLoading(true);
      setError(null);

      try {
        // Get previous version for this entry
        const existingVersions = versions.filter(v => v.entry_id === entryId);
        const lastVersion = existingVersions.find(v => v.is_current);
        const nextVersionNumber = Math.max(...existingVersions.map(v => v.version_number), 0) + 1;

        // Calculate changes
        const fieldsChanged = lastVersion
          ? Object.keys(content).filter(
              key => JSON.stringify(content[key]) !== JSON.stringify(lastVersion.content[key])
            )
          : Object.keys(content);

        const changeSize = JSON.stringify(content).length;

        const newVersion: Version = {
          id: generateVersionId(),
          entry_id: entryId,
          version_number: nextVersionNumber,
          content: { ...content },
          metadata: {
            change_type: lastVersion ? 'update' : 'create',
            change_summary: metadata.change_summary || 'Auto-generated version',
            fields_changed: fieldsChanged,
            change_size: changeSize,
            validation_status: 'valid',
            ...metadata,
          },
          created_at: new Date(),
          created_by: metadata.change_summary?.includes('[System]') ? 'system' : 'user',
          parent_version_id: lastVersion?.id,
          branch: currentBranch.current,
          tags: [],
          is_current: true,
        };

        // Update versions
        setVersions(prev => {
          // Mark previous version as not current
          const updated = prev.map(v =>
            v.entry_id === entryId && v.is_current ? { ...v, is_current: false } : v
          );

          return [...updated, newVersion];
        });

        // Update current version
        setCurrentVersion(newVersion);

        // Update branch current version
        if (config.enableBranching) {
          setBranches(prev =>
            prev.map(branch =>
              branch.name === currentBranch.current
                ? { ...branch, current_version_id: newVersion.id }
                : branch
            )
          );
        }

        return newVersion;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create version';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [versions, config.enableBranching, generateVersionId]
  );

  // Rollback to specific version
  const rollbackToVersion = useCallback(
    async (versionId: string, createBackup: boolean = true): Promise<Version> => {
      setIsLoading(true);
      setError(null);

      try {
        const targetVersion = versions.find(v => v.id === versionId);
        if (!targetVersion) {
          throw new Error('Version not found');
        }

        // Create backup version if requested
        if (createBackup) {
          const currentVer = versions.find(
            v => v.entry_id === targetVersion.entry_id && v.is_current
          );

          if (currentVer) {
            await createVersion(targetVersion.entry_id, currentVer.content, {
              change_type: 'update',
              change_summary: `Backup before rollback to version ${targetVersion.version_number}`,
            });
          }
        }

        // Create restored version
        const restoredVersion = await createVersion(targetVersion.entry_id, targetVersion.content, {
          change_type: 'restore',
          change_summary: `Restored from version ${targetVersion.version_number}`,
        });

        return restoredVersion;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to rollback';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [versions, createVersion]
  );

  // Delete version
  const deleteVersion = useCallback(
    async (versionId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const versionToDelete = versions.find(v => v.id === versionId);
        if (!versionToDelete) {
          throw new Error('Version not found');
        }

        if (versionToDelete.is_current) {
          throw new Error('Cannot delete current version');
        }

        // Check if other versions depend on this one
        const dependentVersions = versions.filter(v => v.parent_version_id === versionId);
        if (dependentVersions.length > 0) {
          throw new Error('Cannot delete version with dependent versions');
        }

        setVersions(prev => prev.filter(v => v.id !== versionId));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete version';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [versions]
  );

  // Restore deleted version
  const restoreVersion = useCallback(
    async (versionId: string): Promise<Version> => {
      // In a real implementation, this would restore from a soft-delete or backup
      // For now, we'll treat it as creating a new version with the old content
      const targetVersion = versions.find(v => v.id === versionId);
      if (!targetVersion) {
        throw new Error('Version not found');
      }

      return await createVersion(targetVersion.entry_id, targetVersion.content, {
        change_type: 'restore',
        change_summary: `Restored version ${targetVersion.version_number}`,
      });
    },
    [versions, createVersion]
  );

  // Compare diffs between versions
  const compareDiffs = useCallback(
    (fromVersionId: string, toVersionId: string): VersionDiff[] => {
      const fromVersion = versions.find(v => v.id === fromVersionId);
      const toVersion = versions.find(v => v.id === toVersionId);

      if (!fromVersion || !toVersion) {
        return [];
      }

      const diffs: VersionDiff[] = [];
      const allKeys = new Set([
        ...Object.keys(fromVersion.content),
        ...Object.keys(toVersion.content),
      ]);

      allKeys.forEach(key => {
        const oldValue = fromVersion.content[key];
        const newValue = toVersion.content[key];

        if (oldValue === undefined && newValue !== undefined) {
          diffs.push({
            field: key,
            old_value: null,
            new_value: newValue,
            change_type: 'added',
          });
        } else if (oldValue !== undefined && newValue === undefined) {
          diffs.push({
            field: key,
            old_value: oldValue,
            new_value: null,
            change_type: 'deleted',
          });
        } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const diff: VersionDiff = {
            field: key,
            old_value: oldValue,
            new_value: newValue,
            change_type: 'modified',
          };

          // Generate line diffs for text fields
          if (typeof oldValue === 'string' && typeof newValue === 'string') {
            diff.line_changes = generateTextDiff(oldValue, newValue);
          }

          diffs.push(diff);
        }
      });

      return diffs;
    },
    [versions]
  );

  // Get diff for a single version
  const getVersionDiff = useCallback(
    (versionId: string, compareWith?: string): VersionDiff[] => {
      const version = versions.find(v => v.id === versionId);
      if (!version) return [];

      const compareVersionId = compareWith || version.parent_version_id;
      if (!compareVersionId) return [];

      return compareDiffs(compareVersionId, versionId);
    },
    [versions, compareDiffs]
  );

  // Generate text diff with line-by-line comparison
  const generateTextDiff = useCallback(
    (oldText: string, newText: string): LineDiff[] => {
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');
      const diffs: LineDiff[] = [];

      // Simple line-by-line diff algorithm
      // In a real implementation, you might use a more sophisticated algorithm like Myers
      const maxLines = Math.max(oldLines.length, newLines.length);

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];

        if (oldLine === undefined && newLine !== undefined) {
          diffs.push({
            line_number: i + 1,
            type: 'added',
            content: newLine,
          });
        } else if (oldLine !== undefined && newLine === undefined) {
          diffs.push({
            line_number: i + 1,
            type: 'deleted',
            content: oldLine,
          });
        } else if (oldLine !== newLine) {
          diffs.push({
            line_number: i + 1,
            type: 'modified',
            content: newLine,
            old_content: oldLine,
          });
        } else {
          // Include context lines
          diffs.push({
            line_number: i + 1,
            type: 'unchanged',
            content: oldLine,
          });
        }
      }

      // Add context around changes
      return addContextLines(diffs, config.diffContext);
    },
    [config.diffContext]
  );

  // Add context lines around changes
  const addContextLines = (diffs: LineDiff[], contextLines: number): LineDiff[] => {
    const result: LineDiff[] = [];
    const changedLines = new Set(diffs.filter(d => d.type !== 'unchanged').map(d => d.line_number));

    diffs.forEach((diff, index) => {
      const hasNearbyChanges = Array.from(changedLines).some(
        lineNum => Math.abs(lineNum - diff.line_number) <= contextLines
      );

      if (diff.type !== 'unchanged' || hasNearbyChanges) {
        result.push(diff);
      }
    });

    return result;
  };

  // Branch operations
  const createBranch = useCallback(
    async (name: string, fromVersionId?: string, description?: string): Promise<VersionBranch> => {
      if (!config.enableBranching) {
        throw new Error('Branching is disabled');
      }

      const existingBranch = branches.find(b => b.name === name);
      if (existingBranch) {
        throw new Error('Branch already exists');
      }

      const baseVersion = fromVersionId
        ? versions.find(v => v.id === fromVersionId)
        : currentVersion;

      if (!baseVersion) {
        throw new Error('Base version not found');
      }

      const newBranch: VersionBranch = {
        name,
        created_at: new Date(),
        created_by: 'user',
        base_version_id: baseVersion.id,
        current_version_id: baseVersion.id,
        description,
        is_merged: false,
      };

      setBranches(prev => [...prev, newBranch]);
      return newBranch;
    },
    [config.enableBranching, branches, versions, currentVersion]
  );

  const switchBranch = useCallback(
    async (branchName: string): Promise<void> => {
      const branch = branches.find(b => b.name === branchName);
      if (!branch) {
        throw new Error('Branch not found');
      }

      currentBranch.current = branchName;

      // Update current version to branch's current version
      const branchCurrentVersion = versions.find(v => v.id === branch.current_version_id);
      if (branchCurrentVersion) {
        setCurrentVersion(branchCurrentVersion);
      }
    },
    [branches, versions]
  );

  const mergeBranch = useCallback(
    async (sourceBranch: string, targetBranch: string): Promise<MergeResult> => {
      const source = branches.find(b => b.name === sourceBranch);
      const target = branches.find(b => b.name === targetBranch);

      if (!source || !target) {
        throw new Error('Branch not found');
      }

      const sourceVersion = versions.find(v => v.id === source.current_version_id);
      const targetVersion = versions.find(v => v.id === target.current_version_id);
      const baseVersion = versions.find(v => v.id === source.base_version_id);

      if (!sourceVersion || !targetVersion || !baseVersion) {
        throw new Error('Required versions not found');
      }

      // Detect conflicts
      const conflicts: MergeConflict[] = [];
      const mergedContent: Record<string, any> = { ...targetVersion.content };

      Object.keys(sourceVersion.content).forEach(key => {
        const baseValue = baseVersion.content[key];
        const sourceValue = sourceVersion.content[key];
        const targetValue = targetVersion.content[key];

        // Check for conflicts
        if (
          JSON.stringify(baseValue) !== JSON.stringify(sourceValue) &&
          JSON.stringify(baseValue) !== JSON.stringify(targetValue) &&
          JSON.stringify(sourceValue) !== JSON.stringify(targetValue)
        ) {
          conflicts.push({
            field: key,
            base_value: baseValue,
            current_value: targetValue,
            incoming_value: sourceValue,
          });
        } else if (JSON.stringify(baseValue) !== JSON.stringify(sourceValue)) {
          // No conflict, accept source change
          mergedContent[key] = sourceValue;
        }
      });

      const mergeResult: MergeResult = {
        success: conflicts.length === 0,
        conflicts,
        merged_content: mergedContent,
        requires_manual_resolution: conflicts.length > 0,
      };

      // If no conflicts, create merge version
      if (conflicts.length === 0) {
        const currentBranchRef = currentBranch.current;
        currentBranch.current = targetBranch;

        await createVersion(targetVersion.entry_id, mergedContent, {
          change_type: 'merge',
          change_summary: `Merged ${sourceBranch} into ${targetBranch}`,
        });

        // Mark source branch as merged
        setBranches(prev =>
          prev.map(b => (b.name === sourceBranch ? { ...b, is_merged: true } : b))
        );

        currentBranch.current = currentBranchRef;
      }

      return mergeResult;
    },
    [branches, versions, createVersion]
  );

  const deleteBranch = useCallback(
    async (branchName: string, force: boolean = false): Promise<void> => {
      if (branchName === 'main') {
        throw new Error('Cannot delete main branch');
      }

      const branch = branches.find(b => b.name === branchName);
      if (!branch) {
        throw new Error('Branch not found');
      }

      if (!branch.is_merged && !force) {
        throw new Error('Branch is not merged. Use force to delete anyway.');
      }

      setBranches(prev => prev.filter(b => b.name !== branchName));
    },
    [branches]
  );

  // Tag operations
  const tagVersion = useCallback(async (versionId: string, tag: string): Promise<void> => {
    setVersions(prev =>
      prev.map(v =>
        v.id === versionId ? { ...v, tags: [...v.tags.filter(t => t !== tag), tag] } : v
      )
    );
  }, []);

  const removeTag = useCallback(async (versionId: string, tag: string): Promise<void> => {
    setVersions(prev =>
      prev.map(v => (v.id === versionId ? { ...v, tags: v.tags.filter(t => t !== tag) } : v))
    );
  }, []);

  const getVersionsByTag = useCallback(
    (tag: string): Version[] => {
      return versions.filter(v => v.tags.includes(tag));
    },
    [versions]
  );

  // Conflict resolution
  const resolveConflict = useCallback(
    (
      conflict: MergeConflict,
      resolution: 'current' | 'incoming' | 'manual',
      customValue?: any
    ): MergeConflict => {
      let resolvedValue: any;

      switch (resolution) {
        case 'current':
          resolvedValue = conflict.current_value;
          break;
        case 'incoming':
          resolvedValue = conflict.incoming_value;
          break;
        case 'manual':
          resolvedValue = customValue;
          break;
      }

      return {
        ...conflict,
        resolution,
        resolved_value: resolvedValue,
      };
    },
    []
  );

  const resolveAllConflicts = useCallback(
    (conflicts: MergeConflict[], strategy: 'current' | 'incoming'): MergeConflict[] => {
      return conflicts.map(conflict => resolveConflict(conflict, strategy));
    },
    [resolveConflict]
  );

  // History analysis
  const getVersionHistory = useCallback(
    (entryId: string, limit?: number): Version[] => {
      const entryVersions = versions
        .filter(v => v.entry_id === entryId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      return limit ? entryVersions.slice(0, limit) : entryVersions;
    },
    [versions]
  );

  const getVersionStats = useCallback(
    (entryId: string): VersionStats => {
      const entryVersions = versions.filter(v => v.entry_id === entryId);

      const creationFrequency: Record<string, number> = {};
      const topContributors: Record<string, number> = {};
      const changeTypes: Record<string, number> = {};
      const fieldChanges: Record<string, number> = {};

      entryVersions.forEach(version => {
        // Creation frequency by day
        const day = version.created_at.toISOString().split('T')[0];
        creationFrequency[day] = (creationFrequency[day] || 0) + 1;

        // Contributors
        topContributors[version.created_by] = (topContributors[version.created_by] || 0) + 1;

        // Change types
        changeTypes[version.metadata.change_type] =
          (changeTypes[version.metadata.change_type] || 0) + 1;

        // Field changes
        version.metadata.fields_changed.forEach(field => {
          fieldChanges[field] = (fieldChanges[field] || 0) + 1;
        });
      });

      const avgChangeSize =
        entryVersions.reduce((sum, v) => sum + v.metadata.change_size, 0) / entryVersions.length;

      return {
        total_versions: entryVersions.length,
        creation_frequency: creationFrequency,
        top_contributors: Object.entries(topContributors)
          .map(([user, count]) => ({ user, count }))
          .sort((a, b) => b.count - a.count),
        change_types: changeTypes,
        avg_change_size: avgChangeSize,
        most_changed_fields: Object.entries(fieldChanges)
          .map(([field, changes]) => ({ field, changes }))
          .sort((a, b) => b.changes - a.changes),
        branch_count: branches.length,
        conflict_rate: 0, // Would be calculated based on merge history
      };
    },
    [versions, branches]
  );

  const findVersionByContent = useCallback(
    (searchContent: Partial<Record<string, any>>): Version[] => {
      return versions.filter(version => {
        return Object.entries(searchContent).every(
          ([key, value]) => JSON.stringify(version.content[key]) === JSON.stringify(value)
        );
      });
    },
    [versions]
  );

  // Utilities
  const exportHistory = useCallback(
    (entryId: string): string => {
      const entryVersions = getVersionHistory(entryId);
      const exportData = {
        entry_id: entryId,
        exported_at: new Date().toISOString(),
        versions: entryVersions,
        stats: getVersionStats(entryId),
      };

      return JSON.stringify(exportData, null, 2);
    },
    [getVersionHistory, getVersionStats]
  );

  const importHistory = useCallback(async (historyData: string): Promise<void> => {
    try {
      const importData = JSON.parse(historyData);
      if (!importData.versions || !Array.isArray(importData.versions)) {
        throw new Error('Invalid history data format');
      }

      // Import versions
      setVersions(prev => [...prev, ...importData.versions]);
    } catch (err) {
      throw new Error('Failed to import history: ' + (err as Error).message);
    }
  }, []);

  const cleanupOldVersions = useCallback(
    async (entryId: string, keepCount?: number): Promise<number> => {
      const keepVersions = keepCount || config.maxVersionHistory;
      const entryVersions = getVersionHistory(entryId);

      if (entryVersions.length <= keepVersions) {
        return 0;
      }

      const toDelete = entryVersions.slice(keepVersions);
      const deletedCount = toDelete.length;

      // Keep current version and tagged versions
      const toKeepIds = new Set([
        ...entryVersions.filter(v => v.is_current || v.tags.length > 0).map(v => v.id),
      ]);

      const actualToDelete = toDelete.filter(v => !toKeepIds.has(v.id));

      setVersions(prev =>
        prev.filter(v => v.entry_id !== entryId || !actualToDelete.find(d => d.id === v.id))
      );

      return actualToDelete.length;
    },
    [config.maxVersionHistory, getVersionHistory]
  );

  const validateVersion = useCallback((version: Version): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!version.content || Object.keys(version.content).length === 0) {
      errors.push('Version content is empty');
    }

    if (!version.metadata.change_summary || version.metadata.change_summary.length < 5) {
      warnings.push('Change summary is too brief');
    }

    if (version.metadata.change_size > 100000) {
      warnings.push('Large change detected - consider breaking into smaller changes');
    }

    if (version.metadata.fields_changed.length > 10) {
      suggestions.push('Consider making more focused changes');
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }, []);

  return {
    versions,
    currentVersion,
    branches,
    isLoading,
    error,
    createVersion,
    rollbackToVersion,
    deleteVersion,
    restoreVersion,
    compareDiffs,
    getVersionDiff,
    generateTextDiff,
    createBranch,
    switchBranch,
    mergeBranch,
    deleteBranch,
    tagVersion,
    removeTag,
    getVersionsByTag,
    resolveConflict,
    resolveAllConflicts,
    getVersionHistory,
    getVersionStats,
    findVersionByContent,
    exportHistory,
    importHistory,
    cleanupOldVersions,
    validateVersion,
  };
};

export default useVersionControl;
