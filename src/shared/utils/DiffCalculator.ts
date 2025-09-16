/**
 * Diff Calculator
 *
 * Calculates differences between data structures and generates minimal update patches.
 * Supports deep object comparison, array handling, and efficient diff algorithms.
 */

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
  size: number; // estimated size impact
}

export interface DiffOptions {
  maxDepth?: number;
  ignoreArrayOrder?: boolean;
  ignoreFields?: string[];
  customComparators?: Map<string, (a: any, b: any) => boolean>;
  enableCompression?: boolean;
}

export class DiffCalculator {
  private options: Required<DiffOptions>;

  constructor(options: DiffOptions = {}) {
    this.options = {
      maxDepth: 10,
      ignoreArrayOrder: false,
      ignoreFields: [],
      customComparators: new Map(),
      enableCompression: true,
      ...options
    };
  }

  /**
   * Calculate comprehensive diff between two data structures
   */
  async calculateDiff(oldData: any, newData: any, path: string = ''): Promise<Diff> {
    const diff: Diff = {
      added: [],
      modified: [],
      deleted: []
    };

    await this.calculateDiffRecursive(oldData, newData, path, diff, 0);

    // Optimize diff by removing redundant operations
    return this.optimizeDiff(diff);
  }

  /**
   * Generate JSON Patch (RFC 6902) operations from diff
   */
  async generatePatches(diff: Diff): Promise<PatchOperation[]> {
    const patches: PatchOperation[] = [];

    // Process deletions first (reverse order to avoid path shifts)
    const sortedDeleted = diff.deleted.sort((a, b) => b.path.localeCompare(a.path));
    for (const item of sortedDeleted) {
      patches.push({
        op: 'remove',
        path: this.normalizePath(item.path)
      });
    }

    // Process additions and modifications
    for (const item of diff.added) {
      patches.push({
        op: 'add',
        path: this.normalizePath(item.path),
        value: item.newValue
      });
    }

    for (const item of diff.modified) {
      patches.push({
        op: 'replace',
        path: this.normalizePath(item.path),
        value: item.newValue
      });
    }

    // Optimize patches by merging consecutive operations
    return this.optimizePatches(patches);
  }

  /**
   * Generate binary diff for large data structures
   */
  async generateBinaryDiff(oldData: any, newData: any): Promise<ArrayBuffer | null> {
    const oldSerialized = this.serializeForBinaryDiff(oldData);
    const newSerialized = this.serializeForBinaryDiff(newData);

    // Simple binary diff implementation
    // In production, consider using a more sophisticated binary diff algorithm
    if (oldSerialized.length === 0) {
      return this.stringToArrayBuffer(newSerialized);
    }

    const diff = this.calculateBinaryDifference(oldSerialized, newSerialized);
    return diff.length < newSerialized.length * 0.8 ? diff : null;
  }

  /**
   * Calculate diff score (0-1, where 0 = identical, 1 = completely different)
   */
  calculateDiffScore(diff: Diff): number {
    const totalOperations = diff.added.length + diff.modified.length + diff.deleted.length;
    if (totalOperations === 0) return 0;

    const sizeImpact = [...diff.added, ...diff.modified, ...diff.deleted]
      .reduce((sum, item) => sum + item.size, 0);

    // Normalize score based on number of operations and size impact
    const operationScore = Math.min(1, totalOperations / 100);
    const sizeScore = Math.min(1, sizeImpact / 10000); // Normalize to reasonable size

    return (operationScore + sizeScore) / 2;
  }

  /**
   * Check if diff represents a minimal change
   */
  isMinimalDiff(diff: Diff, originalSize: number): boolean {
    const diffSize = this.estimateDiffSize(diff);
    const ratio = diffSize / originalSize;

    return ratio < 0.3 && // Less than 30% of original size
           diff.added.length + diff.modified.length + diff.deleted.length < 50; // Less than 50 operations
  }

  // Private helper methods
  private async calculateDiffRecursive(
    oldValue: any,
    newValue: any,
    path: string,
    diff: Diff,
    depth: number
  ): Promise<void> {
    if (depth > this.options.maxDepth) {
      return;
    }

    // Check if values are equal
    if (this.deepEqual(oldValue, newValue)) {
      return;
    }

    const valueType = this.getValueType(newValue);

    // Handle null/undefined cases
    if (oldValue == null && newValue != null) {
      diff.added.push({
        path,
        newValue,
        type: valueType,
        size: this.estimateSize(newValue)
      });
      return;
    }

    if (oldValue != null && newValue == null) {
      diff.deleted.push({
        path,
        oldValue,
        type: this.getValueType(oldValue),
        size: this.estimateSize(oldValue)
      });
      return;
    }

    // Handle primitive values
    if (this.isPrimitive(oldValue) || this.isPrimitive(newValue)) {
      if (oldValue !== newValue) {
        diff.modified.push({
          path,
          oldValue,
          newValue,
          type: 'primitive',
          size: this.estimateSize(newValue) - this.estimateSize(oldValue)
        });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      await this.calculateArrayDiff(oldValue, newValue, path, diff, depth);
      return;
    }

    if (Array.isArray(oldValue) !== Array.isArray(newValue)) {
      diff.modified.push({
        path,
        oldValue,
        newValue,
        type: Array.isArray(newValue) ? 'array' : 'object',
        size: this.estimateSize(newValue) - this.estimateSize(oldValue)
      });
      return;
    }

    // Handle objects
    if (this.isObject(oldValue) && this.isObject(newValue)) {
      await this.calculateObjectDiff(oldValue, newValue, path, diff, depth);
    }
  }

  private async calculateArrayDiff(
    oldArray: any[],
    newArray: any[],
    path: string,
    diff: Diff,
    depth: number
  ): Promise<void> {
    if (this.options.ignoreArrayOrder) {
      // Compare arrays without considering order
      await this.calculateUnorderedArrayDiff(oldArray, newArray, path, diff, depth);
    } else {
      // Compare arrays preserving order
      await this.calculateOrderedArrayDiff(oldArray, newArray, path, diff, depth);
    }
  }

  private async calculateOrderedArrayDiff(
    oldArray: any[],
    newArray: any[],
    path: string,
    diff: Diff,
    depth: number
  ): Promise<void> {
    const maxLength = Math.max(oldArray.length, newArray.length);

    for (let i = 0; i < maxLength; i++) {
      const itemPath = `${path}[${i}]`;

      if (i >= oldArray.length) {
        // New item added
        diff.added.push({
          path: itemPath,
          newValue: newArray[i],
          type: this.getValueType(newArray[i]),
          size: this.estimateSize(newArray[i])
        });
      } else if (i >= newArray.length) {
        // Item deleted
        diff.deleted.push({
          path: itemPath,
          oldValue: oldArray[i],
          type: this.getValueType(oldArray[i]),
          size: this.estimateSize(oldArray[i])
        });
      } else {
        // Compare existing items
        await this.calculateDiffRecursive(
          oldArray[i],
          newArray[i],
          itemPath,
          diff,
          depth + 1
        );
      }
    }
  }

  private async calculateUnorderedArrayDiff(
    oldArray: any[],
    newArray: any[],
    path: string,
    diff: Diff,
    depth: number
  ): Promise<void> {
    // Simple implementation - find best matches
    // In production, consider using more sophisticated algorithms like Myers' diff
    const usedNewIndices = new Set<number>();
    const usedOldIndices = new Set<number>();

    // First pass: find exact matches
    for (let oldIndex = 0; oldIndex < oldArray.length; oldIndex++) {
      for (let newIndex = 0; newIndex < newArray.length; newIndex++) {
        if (!usedNewIndices.has(newIndex) &&
            this.deepEqual(oldArray[oldIndex], newArray[newIndex])) {
          usedOldIndices.add(oldIndex);
          usedNewIndices.add(newIndex);
          break;
        }
      }
    }

    // Second pass: handle additions, deletions, and modifications
    let newIndex = 0;
    for (let oldIndex = 0; oldIndex < oldArray.length; oldIndex++) {
      const itemPath = `${path}[${oldIndex}]`;

      if (!usedOldIndices.has(oldIndex)) {
        // Find best match in remaining new items
        let bestMatch = -1;
        let bestScore = Infinity;

        for (let i = 0; i < newArray.length; i++) {
          if (!usedNewIndices.has(i)) {
            const score = this.calculateSimilarity(oldArray[oldIndex], newArray[i]);
            if (score < bestScore) {
              bestScore = score;
              bestMatch = i;
            }
          }
        }

        if (bestMatch !== -1 && bestScore < 0.7) {
          // Modification
          usedNewIndices.add(bestMatch);
          await this.calculateDiffRecursive(
            oldArray[oldIndex],
            newArray[bestMatch],
            itemPath,
            diff,
            depth + 1
          );
        } else {
          // Deletion
          diff.deleted.push({
            path: itemPath,
            oldValue: oldArray[oldIndex],
            type: this.getValueType(oldArray[oldIndex]),
            size: this.estimateSize(oldArray[oldIndex])
          });
        }
      }
    }

    // Handle remaining new items as additions
    for (let i = 0; i < newArray.length; i++) {
      if (!usedNewIndices.has(i)) {
        diff.added.push({
          path: `${path}[${oldArray.length + newIndex}]`,
          newValue: newArray[i],
          type: this.getValueType(newArray[i]),
          size: this.estimateSize(newArray[i])
        });
        newIndex++;
      }
    }
  }

  private async calculateObjectDiff(
    oldObj: Record<string, any>,
    newObj: Record<string, any>,
    path: string,
    diff: Diff,
    depth: number
  ): Promise<void> {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      if (this.options.ignoreFields.includes(key)) {
        continue;
      }

      const keyPath = path ? `${path}.${key}` : key;
      const oldValue = oldObj[key];
      const newValue = newObj[key];

      await this.calculateDiffRecursive(oldValue, newValue, keyPath, diff, depth + 1);
    }
  }

  private optimizeDiff(diff: Diff): Diff {
    // Remove redundant operations
    const optimized: Diff = {
      added: [...diff.added],
      modified: [...diff.modified],
      deleted: [...diff.deleted]
    };

    // If a parent object was replaced, remove child modifications
    const parentPaths = new Set<string>();
    [...optimized.added, ...optimized.modified].forEach(item => {
      const parts = item.path.split('.');
      for (let i = 1; i < parts.length; i++) {
        parentPaths.add(parts.slice(0, i).join('.'));
      }
    });

    // Filter out child operations when parent is modified
    optimized.modified = optimized.modified.filter(item =>
      !parentPaths.has(item.path.split('.').slice(0, -1).join('.'))
    );

    return optimized;
  }

  private optimizePatches(patches: PatchOperation[]): PatchOperation[] {
    // Group consecutive array operations
    const optimized: PatchOperation[] = [];
    const grouped = new Map<string, PatchOperation[]>();

    // Group patches by parent path
    patches.forEach(patch => {
      const parentPath = this.getParentPath(patch.path);
      if (!grouped.has(parentPath)) {
        grouped.set(parentPath, []);
      }
      grouped.get(parentPath)!.push(patch);
    });

    // Process each group
    for (const [parentPath, groupPatches] of grouped.entries()) {
      if (groupPatches.length === 1) {
        optimized.push(groupPatches[0]);
      } else {
        // Try to merge multiple operations into fewer ones
        const merged = this.mergePatches(groupPatches);
        optimized.push(...merged);
      }
    }

    return optimized;
  }

  private mergePatches(patches: PatchOperation[]): PatchOperation[] {
    // Simple merge strategy - in production, implement more sophisticated merging
    return patches; // Placeholder implementation
  }

  private normalizePath(path: string): string {
    // Convert object path to JSON Pointer format
    if (!path) return '';
    return '/' + path.replace(/\./g, '/').replace(/\[(\d+)\]/g, '/$1');
  }

  private getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : '';
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }

    if (this.isObject(a) && this.isObject(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }

    return false;
  }

  private isPrimitive(value: any): boolean {
    return value == null || typeof value !== 'object';
  }

  private isObject(value: any): boolean {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  private getValueType(value: any): 'primitive' | 'object' | 'array' {
    if (this.isPrimitive(value)) return 'primitive';
    if (Array.isArray(value)) return 'array';
    return 'object';
  }

  private estimateSize(value: any): number {
    if (value == null) return 0;
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  private estimateDiffSize(diff: Diff): number {
    return [...diff.added, ...diff.modified, ...diff.deleted]
      .reduce((sum, item) => sum + Math.abs(item.size), 0);
  }

  private calculateSimilarity(a: any, b: any): number {
    // Simple similarity score (0 = identical, 1 = completely different)
    if (this.deepEqual(a, b)) return 0;

    const typeA = this.getValueType(a);
    const typeB = this.getValueType(b);

    if (typeA !== typeB) return 1;

    if (typeA === 'primitive') {
      return a === b ? 0 : 1;
    }

    // For objects and arrays, calculate structural similarity
    const sizeA = this.estimateSize(a);
    const sizeB = this.estimateSize(b);
    const sizeDiff = Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB, 1);

    return Math.min(1, sizeDiff);
  }

  // Binary diff helpers
  private serializeForBinaryDiff(data: any): string {
    return JSON.stringify(data);
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length * 2);
    const view = new Uint16Array(buffer);
    for (let i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i);
    }
    return buffer;
  }

  private calculateBinaryDifference(oldStr: string, newStr: string): ArrayBuffer {
    // Simplified binary diff - in production, use a proper binary diff algorithm
    const changes: Array<{index: number, delete: number, insert: string}> = [];

    // Find differences using simple comparison
    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldStr.length || newIndex < newStr.length) {
      if (oldIndex >= oldStr.length) {
        // Remaining new characters are insertions
        changes.push({
          index: oldIndex,
          delete: 0,
          insert: newStr.slice(newIndex)
        });
        break;
      }

      if (newIndex >= newStr.length) {
        // Remaining old characters are deletions
        changes.push({
          index: oldIndex,
          delete: oldStr.length - oldIndex,
          insert: ''
        });
        break;
      }

      if (oldStr[oldIndex] === newStr[newIndex]) {
        oldIndex++;
        newIndex++;
      } else {
        // Find the length of the difference
        let deleteCount = 0;
        let insertStr = '';

        // Simple approach: find next matching character or end of string
        let found = false;
        for (let i = 1; i <= Math.min(100, oldStr.length - oldIndex); i++) {
          const searchOld = oldStr.slice(oldIndex + i, oldIndex + i + 10);
          for (let j = 1; j <= Math.min(100, newStr.length - newIndex); j++) {
            const searchNew = newStr.slice(newIndex + j, newIndex + j + 10);
            if (searchOld === searchNew && searchOld.length > 0) {
              deleteCount = i;
              insertStr = newStr.slice(newIndex, newIndex + j);
              oldIndex += i;
              newIndex += j;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          // No common substring found, replace one character
          deleteCount = 1;
          insertStr = newStr[newIndex];
          oldIndex++;
          newIndex++;
        }

        changes.push({
          index: oldIndex - deleteCount,
          delete: deleteCount,
          insert: insertStr
        });
      }
    }

    // Serialize changes to binary format
    return this.stringToArrayBuffer(JSON.stringify(changes));
  }
}