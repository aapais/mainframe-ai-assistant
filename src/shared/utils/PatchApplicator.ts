/**
 * Patch Applicator
 *
 * Applies JSON Patch operations (RFC 6902) and custom patch formats
 * to update data structures efficiently and safely.
 */

export interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string; // for move/copy operations
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
  strict?: boolean; // Fail on first error vs best effort
  enableRollback?: boolean; // Keep rollback data
  validatePaths?: boolean; // Validate paths before applying
  maxPatchSize?: number; // Limit individual patch size
  timeout?: number; // Operation timeout
}

export class PatchApplicator {
  private options: Required<PatchOptions>;

  constructor(options: PatchOptions = {}) {
    this.options = {
      strict: true,
      enableRollback: false,
      validatePaths: true,
      maxPatchSize: 1024 * 1024, // 1MB
      timeout: 5000, // 5 seconds
      ...options,
    };
  }

  /**
   * Apply JSON Patch operations to data
   */
  async applyPatches<T = any>(
    data: T,
    patches: PatchOperation[],
    options?: Partial<PatchOptions>
  ): Promise<T> {
    const mergedOptions = { ...this.options, ...options };
    const startTime = Date.now();

    // Validate input
    if (!patches || patches.length === 0) {
      return data;
    }

    // Deep clone data to avoid mutations
    let workingData = this.deepClone(data);
    const originalData = mergedOptions.enableRollback ? this.deepClone(data) : undefined;

    const result: PatchResult<T> = {
      success: true,
      data: workingData,
      appliedPatches: 0,
      failedPatches: [],
      metadata: {
        executionTime: 0,
        rollbackData: originalData,
      },
    };

    // Apply patches with timeout protection
    try {
      workingData = await this.applyPatchesWithTimeout(workingData, patches, mergedOptions, result);

      result.data = workingData;
      result.metadata.executionTime = Date.now() - startTime;

      if (result.failedPatches.length > 0 && mergedOptions.strict) {
        throw new Error(`Failed to apply ${result.failedPatches.length} patches in strict mode`);
      }

      return workingData;
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      if (mergedOptions.enableRollback && originalData) {
        return originalData;
      }

      throw error;
    }
  }

  /**
   * Apply a single patch operation
   */
  async applySinglePatch<T = any>(
    data: T,
    patch: PatchOperation,
    options?: Partial<PatchOptions>
  ): Promise<T> {
    return this.applyPatches(data, [patch], options);
  }

  /**
   * Validate patch operations without applying them
   */
  validatePatches(
    data: any,
    patches: PatchOperation[]
  ): {
    valid: boolean;
    errors: Array<{ patch: PatchOperation; error: string }>;
  } {
    const errors: Array<{ patch: PatchOperation; error: string }> = [];

    for (const patch of patches) {
      try {
        this.validatePatch(data, patch);
      } catch (error) {
        errors.push({
          patch,
          error: error instanceof Error ? error.message : 'Validation failed',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate reverse patches for rollback
   */
  generateReversePatches(
    originalData: any,
    modifiedData: any,
    appliedPatches: PatchOperation[]
  ): PatchOperation[] {
    const reversePatches: PatchOperation[] = [];

    // Generate reverse operations
    for (const patch of appliedPatches.reverse()) {
      try {
        const reversePatch = this.generateReversePatch(originalData, patch);
        if (reversePatch) {
          reversePatches.push(reversePatch);
        }
      } catch (error) {
        console.warn('Failed to generate reverse patch:', error);
      }
    }

    return reversePatches;
  }

  /**
   * Test if patches can be applied without modifying data
   */
  testPatches(data: any, patches: PatchOperation[]): boolean {
    try {
      const testData = this.deepClone(data);
      this.applyPatchesSync(testData, patches);
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods
  private async applyPatchesWithTimeout<T>(
    data: T,
    patches: PatchOperation[],
    options: Required<PatchOptions>,
    result: PatchResult<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Patch application timed out after ${options.timeout}ms`));
      }, options.timeout);

      try {
        const processedData = this.applyPatchesSync(data, patches, options, result);
        clearTimeout(timeout);
        resolve(processedData);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private applyPatchesSync<T>(
    data: T,
    patches: PatchOperation[],
    options?: Required<PatchOptions>,
    result?: PatchResult<T>
  ): T {
    let workingData = data;

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];

      try {
        // Validate patch size
        if (options?.maxPatchSize) {
          const patchSize = JSON.stringify(patch).length;
          if (patchSize > options.maxPatchSize) {
            throw new Error(`Patch size (${patchSize}) exceeds maximum (${options.maxPatchSize})`);
          }
        }

        // Validate patch before applying
        if (options?.validatePaths) {
          this.validatePatch(workingData, patch);
        }

        // Apply the patch
        workingData = this.applyPatchOperation(workingData, patch);

        if (result) {
          result.appliedPatches++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown patch error';

        if (result) {
          result.failedPatches.push(patch);
        }

        if (options?.strict) {
          throw new Error(`Failed to apply patch ${i}: ${errorMsg}`);
        } else {
          console.warn(`Skipping failed patch ${i}:`, errorMsg);
        }
      }
    }

    return workingData;
  }

  private applyPatchOperation<T>(data: T, patch: PatchOperation): T {
    const pathSegments = this.parsePath(patch.path);

    switch (patch.op) {
      case 'add':
        return this.addOperation(data, pathSegments, patch.value);

      case 'remove':
        return this.removeOperation(data, pathSegments);

      case 'replace':
        return this.replaceOperation(data, pathSegments, patch.value);

      case 'move':
        if (!patch.from) {
          throw new Error('Move operation requires "from" path');
        }
        return this.moveOperation(data, this.parsePath(patch.from), pathSegments);

      case 'copy':
        if (!patch.from) {
          throw new Error('Copy operation requires "from" path');
        }
        return this.copyOperation(data, this.parsePath(patch.from), pathSegments);

      case 'test':
        this.testOperation(data, pathSegments, patch.value);
        return data;

      default:
        throw new Error(`Unsupported patch operation: ${(patch as any).op}`);
    }
  }

  private addOperation<T>(data: T, pathSegments: string[], value: any): T {
    if (pathSegments.length === 0) {
      return value as T;
    }

    const result = this.deepClone(data);
    const parentPath = pathSegments.slice(0, -1);
    const key = pathSegments[pathSegments.length - 1];

    const parent = this.getValueAtPath(result, parentPath);

    if (Array.isArray(parent)) {
      const index = key === '-' ? parent.length : parseInt(key, 10);
      if (isNaN(index)) {
        throw new Error(`Invalid array index: ${key}`);
      }
      parent.splice(index, 0, value);
    } else if (this.isObject(parent)) {
      parent[key] = value;
    } else {
      throw new Error(`Cannot add property to non-object: ${typeof parent}`);
    }

    return result;
  }

  private removeOperation<T>(data: T, pathSegments: string[]): T {
    if (pathSegments.length === 0) {
      throw new Error('Cannot remove root');
    }

    const result = this.deepClone(data);
    const parentPath = pathSegments.slice(0, -1);
    const key = pathSegments[pathSegments.length - 1];

    const parent = this.getValueAtPath(result, parentPath);

    if (Array.isArray(parent)) {
      const index = parseInt(key, 10);
      if (isNaN(index) || index < 0 || index >= parent.length) {
        throw new Error(`Invalid array index for removal: ${key}`);
      }
      parent.splice(index, 1);
    } else if (this.isObject(parent)) {
      if (!(key in parent)) {
        throw new Error(`Property does not exist: ${key}`);
      }
      delete parent[key];
    } else {
      throw new Error(`Cannot remove property from non-object: ${typeof parent}`);
    }

    return result;
  }

  private replaceOperation<T>(data: T, pathSegments: string[], value: any): T {
    if (pathSegments.length === 0) {
      return value as T;
    }

    const result = this.deepClone(data);
    const parentPath = pathSegments.slice(0, -1);
    const key = pathSegments[pathSegments.length - 1];

    const parent = this.getValueAtPath(result, parentPath);

    if (Array.isArray(parent)) {
      const index = parseInt(key, 10);
      if (isNaN(index) || index < 0 || index >= parent.length) {
        throw new Error(`Invalid array index for replacement: ${key}`);
      }
      parent[index] = value;
    } else if (this.isObject(parent)) {
      parent[key] = value;
    } else {
      throw new Error(`Cannot replace property in non-object: ${typeof parent}`);
    }

    return result;
  }

  private moveOperation<T>(data: T, fromPath: string[], toPath: string[]): T {
    const valueToMove = this.getValueAtPath(data, fromPath);
    let result = this.removeOperation(data, fromPath);
    result = this.addOperation(result, toPath, valueToMove);
    return result;
  }

  private copyOperation<T>(data: T, fromPath: string[], toPath: string[]): T {
    const valueToCopy = this.getValueAtPath(data, fromPath);
    return this.addOperation(data, toPath, this.deepClone(valueToCopy));
  }

  private testOperation(data: any, pathSegments: string[], expectedValue: any): void {
    try {
      const actualValue = this.getValueAtPath(data, pathSegments);
      if (!this.deepEqual(actualValue, expectedValue)) {
        throw new Error(
          `Test operation failed: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        );
      }
    } catch (error) {
      throw new Error(
        `Test operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private validatePatch(data: any, patch: PatchOperation): void {
    const pathSegments = this.parsePath(patch.path);

    // Validate operation type
    const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
    if (!validOps.includes(patch.op)) {
      throw new Error(`Invalid operation: ${patch.op}`);
    }

    // Validate path format
    if (typeof patch.path !== 'string') {
      throw new Error('Patch path must be a string');
    }

    // Validate value for operations that require it
    if (['add', 'replace', 'test'].includes(patch.op) && patch.value === undefined) {
      throw new Error(`Operation ${patch.op} requires a value`);
    }

    // Validate "from" path for move/copy operations
    if (['move', 'copy'].includes(patch.op) && !patch.from) {
      throw new Error(`Operation ${patch.op} requires a "from" path`);
    }

    // Validate that path exists for operations that require it
    if (['remove', 'replace', 'test'].includes(patch.op)) {
      try {
        this.getValueAtPath(data, pathSegments);
      } catch (error) {
        throw new Error(`Path does not exist: ${patch.path}`);
      }
    }

    // Validate parent path exists for add operations
    if (patch.op === 'add' && pathSegments.length > 0) {
      const parentPath = pathSegments.slice(0, -1);
      try {
        const parent = this.getValueAtPath(data, parentPath);
        if (!this.isObject(parent) && !Array.isArray(parent)) {
          throw new Error(`Cannot add to non-object/non-array: ${patch.path}`);
        }
      } catch (error) {
        throw new Error(`Parent path does not exist: ${parentPath.join('/')}`);
      }
    }
  }

  private generateReversePatch(originalData: any, patch: PatchOperation): PatchOperation | null {
    const pathSegments = this.parsePath(patch.path);

    switch (patch.op) {
      case 'add':
        return { op: 'remove', path: patch.path };

      case 'remove':
        try {
          const originalValue = this.getValueAtPath(originalData, pathSegments);
          return { op: 'add', path: patch.path, value: originalValue };
        } catch {
          return null;
        }

      case 'replace':
        try {
          const originalValue = this.getValueAtPath(originalData, pathSegments);
          return { op: 'replace', path: patch.path, value: originalValue };
        } catch {
          return null;
        }

      case 'move':
        return patch.from ? { op: 'move', path: patch.from, from: patch.path } : null;

      case 'copy':
        return { op: 'remove', path: patch.path };

      default:
        return null;
    }
  }

  private parsePath(path: string): string[] {
    if (!path) return [];

    // Handle JSON Pointer format
    if (path.startsWith('/')) {
      return path
        .slice(1)
        .split('/')
        .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    }

    // Handle dot notation
    return path.split('.');
  }

  private getValueAtPath(data: any, pathSegments: string[]): any {
    let current = data;

    for (const segment of pathSegments) {
      if (current == null) {
        throw new Error(`Cannot access property of null/undefined`);
      }

      if (Array.isArray(current)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          throw new Error(`Array index out of bounds: ${segment}`);
        }
        current = current[index];
      } else if (this.isObject(current)) {
        if (!(segment in current)) {
          throw new Error(`Property does not exist: ${segment}`);
        }
        current = current[segment];
      } else {
        throw new Error(`Cannot access property of primitive value: ${segment}`);
      }
    }

    return current;
  }

  private isObject(value: any): value is Record<string, any> {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  private deepClone<T>(obj: T): T {
    if (obj == null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as Record<string, any>;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned as T;
    }

    return obj;
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
}
