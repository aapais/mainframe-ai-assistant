export interface PatchOperation {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
}
export interface PatchResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    appliedPatches: number;
    failedPatches: PatchOperation[];
    metadata: {
        executionTime: number;
        memoryUsage?: number;
        rollbackData?: any;
    };
}
export interface PatchOptions {
    strict?: boolean;
    enableRollback?: boolean;
    validatePaths?: boolean;
    maxPatchSize?: number;
    timeout?: number;
}
export declare class PatchApplicator {
    private options;
    constructor(options?: PatchOptions);
    applyPatches<T = any>(data: T, patches: PatchOperation[], options?: Partial<PatchOptions>): Promise<T>;
    applySinglePatch<T = any>(data: T, patch: PatchOperation, options?: Partial<PatchOptions>): Promise<T>;
    validatePatches(data: any, patches: PatchOperation[]): {
        valid: boolean;
        errors: Array<{
            patch: PatchOperation;
            error: string;
        }>;
    };
    generateReversePatches(originalData: any, modifiedData: any, appliedPatches: PatchOperation[]): PatchOperation[];
    testPatches(data: any, patches: PatchOperation[]): boolean;
    private applyPatchesWithTimeout;
    private applyPatchesSync;
    private applyPatchOperation;
    private addOperation;
    private removeOperation;
    private replaceOperation;
    private moveOperation;
    private copyOperation;
    private testOperation;
    private validatePatch;
    private generateReversePatch;
    private parsePath;
    private getValueAtPath;
    private isObject;
    private deepClone;
    private deepEqual;
}
//# sourceMappingURL=PatchApplicator.d.ts.map