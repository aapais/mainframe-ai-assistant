'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PatchApplicator = void 0;
class PatchApplicator {
  options;
  constructor(options = {}) {
    this.options = {
      strict: true,
      enableRollback: false,
      validatePaths: true,
      maxPatchSize: 1024 * 1024,
      timeout: 5000,
      ...options,
    };
  }
  async applyPatches(data, patches, options) {
    const mergedOptions = { ...this.options, ...options };
    const startTime = Date.now();
    if (!patches || patches.length === 0) {
      return data;
    }
    let workingData = this.deepClone(data);
    const originalData = mergedOptions.enableRollback ? this.deepClone(data) : undefined;
    const result = {
      success: true,
      data: workingData,
      appliedPatches: 0,
      failedPatches: [],
      metadata: {
        executionTime: 0,
        rollbackData: originalData,
      },
    };
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
  async applySinglePatch(data, patch, options) {
    return this.applyPatches(data, [patch], options);
  }
  validatePatches(data, patches) {
    const errors = [];
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
  generateReversePatches(originalData, modifiedData, appliedPatches) {
    const reversePatches = [];
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
  testPatches(data, patches) {
    try {
      const testData = this.deepClone(data);
      this.applyPatchesSync(testData, patches);
      return true;
    } catch {
      return false;
    }
  }
  async applyPatchesWithTimeout(data, patches, options, result) {
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
  applyPatchesSync(data, patches, options, result) {
    let workingData = data;
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      try {
        if (options?.maxPatchSize) {
          const patchSize = JSON.stringify(patch).length;
          if (patchSize > options.maxPatchSize) {
            throw new Error(`Patch size (${patchSize}) exceeds maximum (${options.maxPatchSize})`);
          }
        }
        if (options?.validatePaths) {
          this.validatePatch(workingData, patch);
        }
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
  applyPatchOperation(data, patch) {
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
        throw new Error(`Unsupported patch operation: ${patch.op}`);
    }
  }
  addOperation(data, pathSegments, value) {
    if (pathSegments.length === 0) {
      return value;
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
  removeOperation(data, pathSegments) {
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
  replaceOperation(data, pathSegments, value) {
    if (pathSegments.length === 0) {
      return value;
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
  moveOperation(data, fromPath, toPath) {
    const valueToMove = this.getValueAtPath(data, fromPath);
    let result = this.removeOperation(data, fromPath);
    result = this.addOperation(result, toPath, valueToMove);
    return result;
  }
  copyOperation(data, fromPath, toPath) {
    const valueToCopy = this.getValueAtPath(data, fromPath);
    return this.addOperation(data, toPath, this.deepClone(valueToCopy));
  }
  testOperation(data, pathSegments, expectedValue) {
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
  validatePatch(data, patch) {
    const pathSegments = this.parsePath(patch.path);
    const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
    if (!validOps.includes(patch.op)) {
      throw new Error(`Invalid operation: ${patch.op}`);
    }
    if (typeof patch.path !== 'string') {
      throw new Error('Patch path must be a string');
    }
    if (['add', 'replace', 'test'].includes(patch.op) && patch.value === undefined) {
      throw new Error(`Operation ${patch.op} requires a value`);
    }
    if (['move', 'copy'].includes(patch.op) && !patch.from) {
      throw new Error(`Operation ${patch.op} requires a "from" path`);
    }
    if (['remove', 'replace', 'test'].includes(patch.op)) {
      try {
        this.getValueAtPath(data, pathSegments);
      } catch (error) {
        throw new Error(`Path does not exist: ${patch.path}`);
      }
    }
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
  generateReversePatch(originalData, patch) {
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
  parsePath(path) {
    if (!path) return [];
    if (path.startsWith('/')) {
      return path
        .slice(1)
        .split('/')
        .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    }
    return path.split('.');
  }
  getValueAtPath(data, pathSegments) {
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
  isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }
  deepClone(obj) {
    if (obj == null || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    if (typeof obj === 'object') {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  }
  deepEqual(a, b) {
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
exports.PatchApplicator = PatchApplicator;
//# sourceMappingURL=PatchApplicator.js.map
