import { PatchOperation } from './PatchApplicator';
export interface Diff {
    added: DiffItem[];
    modified: DiffItem[];
    deleted: DiffItem[];
}
export interface DiffItem {
    path: string;
    oldValue?: any;
    newValue?: any;
    type: 'primitive' | 'object' | 'array';
    size: number;
}
export interface DiffOptions {
    maxDepth?: number;
    ignoreArrayOrder?: boolean;
    ignoreFields?: string[];
    customComparators?: Map<string, (a: any, b: any) => boolean>;
    enableCompression?: boolean;
}
export declare class DiffCalculator {
    private options;
    constructor(options?: DiffOptions);
    calculateDiff(oldData: any, newData: any, path?: string): Promise<Diff>;
    generatePatches(diff: Diff): Promise<PatchOperation[]>;
    generateBinaryDiff(oldData: any, newData: any): Promise<ArrayBuffer | null>;
    calculateDiffScore(diff: Diff): number;
    isMinimalDiff(diff: Diff, originalSize: number): boolean;
    private calculateDiffRecursive;
    private calculateArrayDiff;
    private calculateOrderedArrayDiff;
    private calculateUnorderedArrayDiff;
    private calculateObjectDiff;
    private optimizeDiff;
    private optimizePatches;
    private mergePatches;
    private normalizePath;
    private getParentPath;
    private deepEqual;
    private isPrimitive;
    private isObject;
    private getValueType;
    private estimateSize;
    private estimateDiffSize;
    private calculateSimilarity;
    private serializeForBinaryDiff;
    private stringToArrayBuffer;
    private calculateBinaryDifference;
}
//# sourceMappingURL=DiffCalculator.d.ts.map