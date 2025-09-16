import { EventEmitter } from 'events';
import { KBEntry } from '../database/KnowledgeDB';
export interface VersionedEntry extends KBEntry {
    version: number;
    parent_id?: string;
    change_summary?: string;
    changed_fields?: string[];
    editor_id?: string;
    editor_name?: string;
}
export interface ChangeRecord {
    id: string;
    entry_id: string;
    version: number;
    timestamp: Date;
    editor_id: string;
    editor_name: string;
    change_type: 'create' | 'update' | 'delete' | 'restore';
    change_summary: string;
    changed_fields: string[];
    previous_data?: Partial<KBEntry>;
    new_data?: Partial<KBEntry>;
    diff?: FieldDiff[];
}
export interface FieldDiff {
    field: string;
    operation: 'added' | 'removed' | 'changed';
    old_value?: any;
    new_value?: any;
    position?: number;
}
export interface MergeResult {
    success: boolean;
    merged_entry?: KBEntry;
    conflicts?: MergeConflict[];
    warnings?: string[];
}
export interface MergeConflict {
    field: string;
    base_value: any;
    version_a: any;
    version_b: any;
    resolution_required: boolean;
    suggested_resolution?: any;
}
export interface VersionHistory {
    entry_id: string;
    current_version: number;
    versions: VersionedEntry[];
    changes: ChangeRecord[];
    branches?: VersionBranch[];
}
export interface VersionBranch {
    id: string;
    name: string;
    base_version: number;
    tip_version: number;
    created_by: string;
    created_at: Date;
    description?: string;
}
export interface RollbackOptions {
    target_version: number;
    create_backup?: boolean;
    merge_strategy?: 'overwrite' | 'selective' | 'merge';
    preserve_fields?: string[];
    change_summary?: string;
}
export interface ComparisonResult {
    differences: FieldDiff[];
    similarity_score: number;
    change_summary: string;
    impact_assessment: 'low' | 'medium' | 'high';
}
export declare class VersionControlService extends EventEmitter {
    private db;
    private cache;
    private config;
    constructor(database: any, options?: Partial<typeof VersionControlService.prototype.config>);
    private initializeDatabase;
    createVersion(entry: KBEntry, editorId: string, editorName: string, changeSummary?: string, changedFields?: string[]): Promise<VersionedEntry>;
    getVersion(entryId: string, version: number): Promise<VersionedEntry | null>;
    private getVersionSync;
    getCurrentVersion(entryId: string): Promise<number>;
    getVersionHistory(entryId: string): Promise<VersionHistory>;
    rollbackToVersion(entryId: string, targetVersion: number, editorId: string, editorName: string, options: RollbackOptions): Promise<VersionedEntry>;
    private recordRollback;
    compareVersions(entryId: string, versionA: number, versionB: number): Promise<ComparisonResult>;
    private generateDiff;
    private calculateSimilarity;
    private generateChangeSummary;
    private assessChangeImpact;
    mergeVersions(baseEntry: KBEntry, versionA: KBEntry, versionB: KBEntry): Promise<MergeResult>;
    private mergeTags;
    private suggestResolution;
    private detectChangedFields;
    private generateDataHash;
    private parseVersionedEntry;
    private parseChangeRecord;
    private parseVersionBranch;
    private cleanupOldVersions;
    getEntryWithHistory(entryId: string): Promise<{
        current: VersionedEntry | null;
        history: VersionHistory;
    }>;
    searchVersions(query: string, entryId?: string): Promise<VersionedEntry[]>;
    getRecentChanges(limit?: number): Promise<ChangeRecord[]>;
    cleanup(): Promise<void>;
    dispose(): void;
}
export default VersionControlService;
//# sourceMappingURL=VersionControlService.d.ts.map