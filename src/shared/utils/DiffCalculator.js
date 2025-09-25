'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DiffCalculator = void 0;
class DiffCalculator {
  options;
  constructor(options = {}) {
    this.options = {
      maxDepth: 10,
      ignoreArrayOrder: false,
      ignoreFields: [],
      customComparators: new Map(),
      enableCompression: true,
      ...options,
    };
  }
  async calculateDiff(oldData, newData, path = '') {
    const diff = {
      added: [],
      modified: [],
      deleted: [],
    };
    await this.calculateDiffRecursive(oldData, newData, path, diff, 0);
    return this.optimizeDiff(diff);
  }
  async generatePatches(diff) {
    const patches = [];
    const sortedDeleted = diff.deleted.sort((a, b) => b.path.localeCompare(a.path));
    for (const item of sortedDeleted) {
      patches.push({
        op: 'remove',
        path: this.normalizePath(item.path),
      });
    }
    for (const item of diff.added) {
      patches.push({
        op: 'add',
        path: this.normalizePath(item.path),
        value: item.newValue,
      });
    }
    for (const item of diff.modified) {
      patches.push({
        op: 'replace',
        path: this.normalizePath(item.path),
        value: item.newValue,
      });
    }
    return this.optimizePatches(patches);
  }
  async generateBinaryDiff(oldData, newData) {
    const oldSerialized = this.serializeForBinaryDiff(oldData);
    const newSerialized = this.serializeForBinaryDiff(newData);
    if (oldSerialized.length === 0) {
      return this.stringToArrayBuffer(newSerialized);
    }
    const diff = this.calculateBinaryDifference(oldSerialized, newSerialized);
    return diff.length < newSerialized.length * 0.8 ? diff : null;
  }
  calculateDiffScore(diff) {
    const totalOperations = diff.added.length + diff.modified.length + diff.deleted.length;
    if (totalOperations === 0) return 0;
    const sizeImpact = [...diff.added, ...diff.modified, ...diff.deleted].reduce(
      (sum, item) => sum + item.size,
      0
    );
    const operationScore = Math.min(1, totalOperations / 100);
    const sizeScore = Math.min(1, sizeImpact / 10000);
    return (operationScore + sizeScore) / 2;
  }
  isMinimalDiff(diff, originalSize) {
    const diffSize = this.estimateDiffSize(diff);
    const ratio = diffSize / originalSize;
    return ratio < 0.3 && diff.added.length + diff.modified.length + diff.deleted.length < 50;
  }
  async calculateDiffRecursive(oldValue, newValue, path, diff, depth) {
    if (depth > this.options.maxDepth) {
      return;
    }
    if (this.deepEqual(oldValue, newValue)) {
      return;
    }
    const valueType = this.getValueType(newValue);
    if (oldValue == null && newValue != null) {
      diff.added.push({
        path,
        newValue,
        type: valueType,
        size: this.estimateSize(newValue),
      });
      return;
    }
    if (oldValue != null && newValue == null) {
      diff.deleted.push({
        path,
        oldValue,
        type: this.getValueType(oldValue),
        size: this.estimateSize(oldValue),
      });
      return;
    }
    if (this.isPrimitive(oldValue) || this.isPrimitive(newValue)) {
      if (oldValue !== newValue) {
        diff.modified.push({
          path,
          oldValue,
          newValue,
          type: 'primitive',
          size: this.estimateSize(newValue) - this.estimateSize(oldValue),
        });
      }
      return;
    }
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
        size: this.estimateSize(newValue) - this.estimateSize(oldValue),
      });
      return;
    }
    if (this.isObject(oldValue) && this.isObject(newValue)) {
      await this.calculateObjectDiff(oldValue, newValue, path, diff, depth);
    }
  }
  async calculateArrayDiff(oldArray, newArray, path, diff, depth) {
    if (this.options.ignoreArrayOrder) {
      await this.calculateUnorderedArrayDiff(oldArray, newArray, path, diff, depth);
    } else {
      await this.calculateOrderedArrayDiff(oldArray, newArray, path, diff, depth);
    }
  }
  async calculateOrderedArrayDiff(oldArray, newArray, path, diff, depth) {
    const maxLength = Math.max(oldArray.length, newArray.length);
    for (let i = 0; i < maxLength; i++) {
      const itemPath = `${path}[${i}]`;
      if (i >= oldArray.length) {
        diff.added.push({
          path: itemPath,
          newValue: newArray[i],
          type: this.getValueType(newArray[i]),
          size: this.estimateSize(newArray[i]),
        });
      } else if (i >= newArray.length) {
        diff.deleted.push({
          path: itemPath,
          oldValue: oldArray[i],
          type: this.getValueType(oldArray[i]),
          size: this.estimateSize(oldArray[i]),
        });
      } else {
        await this.calculateDiffRecursive(oldArray[i], newArray[i], itemPath, diff, depth + 1);
      }
    }
  }
  async calculateUnorderedArrayDiff(oldArray, newArray, path, diff, depth) {
    const usedNewIndices = new Set();
    const usedOldIndices = new Set();
    for (let oldIndex = 0; oldIndex < oldArray.length; oldIndex++) {
      for (let newIndex = 0; newIndex < newArray.length; newIndex++) {
        if (
          !usedNewIndices.has(newIndex) &&
          this.deepEqual(oldArray[oldIndex], newArray[newIndex])
        ) {
          usedOldIndices.add(oldIndex);
          usedNewIndices.add(newIndex);
          break;
        }
      }
    }
    let newIndex = 0;
    for (let oldIndex = 0; oldIndex < oldArray.length; oldIndex++) {
      const itemPath = `${path}[${oldIndex}]`;
      if (!usedOldIndices.has(oldIndex)) {
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
          usedNewIndices.add(bestMatch);
          await this.calculateDiffRecursive(
            oldArray[oldIndex],
            newArray[bestMatch],
            itemPath,
            diff,
            depth + 1
          );
        } else {
          diff.deleted.push({
            path: itemPath,
            oldValue: oldArray[oldIndex],
            type: this.getValueType(oldArray[oldIndex]),
            size: this.estimateSize(oldArray[oldIndex]),
          });
        }
      }
    }
    for (let i = 0; i < newArray.length; i++) {
      if (!usedNewIndices.has(i)) {
        diff.added.push({
          path: `${path}[${oldArray.length + newIndex}]`,
          newValue: newArray[i],
          type: this.getValueType(newArray[i]),
          size: this.estimateSize(newArray[i]),
        });
        newIndex++;
      }
    }
  }
  async calculateObjectDiff(oldObj, newObj, path, diff, depth) {
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
  optimizeDiff(diff) {
    const optimized = {
      added: [...diff.added],
      modified: [...diff.modified],
      deleted: [...diff.deleted],
    };
    const parentPaths = new Set();
    [...optimized.added, ...optimized.modified].forEach(item => {
      const parts = item.path.split('.');
      for (let i = 1; i < parts.length; i++) {
        parentPaths.add(parts.slice(0, i).join('.'));
      }
    });
    optimized.modified = optimized.modified.filter(
      item => !parentPaths.has(item.path.split('.').slice(0, -1).join('.'))
    );
    return optimized;
  }
  optimizePatches(patches) {
    const optimized = [];
    const grouped = new Map();
    patches.forEach(patch => {
      const parentPath = this.getParentPath(patch.path);
      if (!grouped.has(parentPath)) {
        grouped.set(parentPath, []);
      }
      grouped.get(parentPath).push(patch);
    });
    for (const [parentPath, groupPatches] of grouped.entries()) {
      if (groupPatches.length === 1) {
        optimized.push(groupPatches[0]);
      } else {
        const merged = this.mergePatches(groupPatches);
        optimized.push(...merged);
      }
    }
    return optimized;
  }
  mergePatches(patches) {
    return patches;
  }
  normalizePath(path) {
    if (!path) return '';
    return `/${path.replace(/\./g, '/').replace(/\[(\d+)\]/g, '/$1')}`;
  }
  getParentPath(path) {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : '';
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
  isPrimitive(value) {
    return value == null || typeof value !== 'object';
  }
  isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }
  getValueType(value) {
    if (this.isPrimitive(value)) return 'primitive';
    if (Array.isArray(value)) return 'array';
    return 'object';
  }
  estimateSize(value) {
    if (value == null) return 0;
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
  estimateDiffSize(diff) {
    return [...diff.added, ...diff.modified, ...diff.deleted].reduce(
      (sum, item) => sum + Math.abs(item.size),
      0
    );
  }
  calculateSimilarity(a, b) {
    if (this.deepEqual(a, b)) return 0;
    const typeA = this.getValueType(a);
    const typeB = this.getValueType(b);
    if (typeA !== typeB) return 1;
    if (typeA === 'primitive') {
      return a === b ? 0 : 1;
    }
    const sizeA = this.estimateSize(a);
    const sizeB = this.estimateSize(b);
    const sizeDiff = Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB, 1);
    return Math.min(1, sizeDiff);
  }
  serializeForBinaryDiff(data) {
    return JSON.stringify(data);
  }
  stringToArrayBuffer(str) {
    const buffer = new ArrayBuffer(str.length * 2);
    const view = new Uint16Array(buffer);
    for (let i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i);
    }
    return buffer;
  }
  calculateBinaryDifference(oldStr, newStr) {
    const changes = [];
    let oldIndex = 0;
    let newIndex = 0;
    while (oldIndex < oldStr.length || newIndex < newStr.length) {
      if (oldIndex >= oldStr.length) {
        changes.push({
          index: oldIndex,
          delete: 0,
          insert: newStr.slice(newIndex),
        });
        break;
      }
      if (newIndex >= newStr.length) {
        changes.push({
          index: oldIndex,
          delete: oldStr.length - oldIndex,
          insert: '',
        });
        break;
      }
      if (oldStr[oldIndex] === newStr[newIndex]) {
        oldIndex++;
        newIndex++;
      } else {
        let deleteCount = 0;
        let insertStr = '';
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
          deleteCount = 1;
          insertStr = newStr[newIndex];
          oldIndex++;
          newIndex++;
        }
        changes.push({
          index: oldIndex - deleteCount,
          delete: deleteCount,
          insert: insertStr,
        });
      }
    }
    return this.stringToArrayBuffer(JSON.stringify(changes));
  }
}
exports.DiffCalculator = DiffCalculator;
//# sourceMappingURL=DiffCalculator.js.map
