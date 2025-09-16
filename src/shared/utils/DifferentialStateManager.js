"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.differentialStateManager = exports.DifferentialStateManager = void 0;
const DiffCalculator_1 = require("./DiffCalculator");
const PatchApplicator_1 = require("./PatchApplicator");
const events_1 = require("events");
class DifferentialStateManager extends events_1.EventEmitter {
    stateTrackers = new Map();
    diffCalculator = new DiffCalculator_1.DiffCalculator();
    patchApplicator = new PatchApplicator_1.PatchApplicator();
    subscriptions = new Map();
    globalVersion = 0;
    config;
    constructor(config = {}) {
        super();
        this.config = {
            maxHistoryVersions: 10,
            compressionThreshold: 1024,
            maxDiffSizeRatio: 0.7,
            enableCompression: true,
            enableVersionCleanup: true,
            cleanupIntervalMs: 5 * 60 * 1000,
            enableMetrics: true,
            ...config
        };
        if (this.config.enableVersionCleanup) {
            this.startVersionCleanup();
        }
    }
    async setState(stateKey, data, options = {}) {
        const tracker = this.getOrCreateTracker(stateKey, options);
        const newVersion = ++this.globalVersion;
        const timestamp = Date.now();
        const serializedData = JSON.stringify(data);
        const checksum = this.calculateChecksum(serializedData);
        const size = serializedData.length;
        const newStateVersion = {
            version: newVersion,
            timestamp,
            data,
            checksum,
            size
        };
        if (tracker.currentVersion && tracker.currentVersion.checksum === checksum) {
            return null;
        }
        let stateChange = null;
        if (tracker.currentVersion) {
            const diff = await this.diffCalculator.calculateDiff(tracker.currentVersion.data, data);
            const patches = await this.diffCalculator.generatePatches(diff);
            const compressionRatio = patches.length > 0 ?
                (size - this.estimatePatchSize(patches)) / size : 0;
            if (compressionRatio > 0.1 && patches.length / size < this.config.maxDiffSizeRatio) {
                stateChange = {
                    id: this.generateChangeId(),
                    previousVersion: tracker.currentVersion.version,
                    currentVersion: newVersion,
                    diff,
                    patches,
                    compressionRatio,
                    metadata: {
                        source: stateKey,
                        timestamp,
                        dataType: typeof data,
                        estimatedSavings: Math.round((size * compressionRatio) / 1024)
                    }
                };
            }
        }
        if (tracker.currentVersion) {
            tracker.previousVersions.set(tracker.currentVersion.version, tracker.currentVersion);
            if (tracker.previousVersions.size > this.config.maxHistoryVersions) {
                const oldestVersion = Math.min(...tracker.previousVersions.keys());
                tracker.previousVersions.delete(oldestVersion);
            }
        }
        tracker.currentVersion = newStateVersion;
        tracker.lastUpdateTime = timestamp;
        if (stateChange) {
            this.notifySubscriptions(stateKey, stateChange);
        }
        this.emit('stateChanged', {
            stateKey,
            change: stateChange,
            fullUpdate: !stateChange
        });
        return stateChange;
    }
    getState(stateKey) {
        const tracker = this.stateTrackers.get(stateKey);
        return tracker?.currentVersion || null;
    }
    getStateVersion(stateKey, version) {
        const tracker = this.stateTrackers.get(stateKey);
        if (!tracker)
            return null;
        if (tracker.currentVersion.version === version) {
            return tracker.currentVersion;
        }
        return tracker.previousVersions.get(version) || null;
    }
    async applyDifferentialUpdate(stateKey, baseVersion, stateChange) {
        const tracker = this.stateTrackers.get(stateKey);
        if (!tracker)
            return null;
        const baseState = this.getStateVersion(stateKey, baseVersion);
        if (!baseState) {
            return null;
        }
        try {
            const updatedData = await this.patchApplicator.applyPatches(baseState.data, stateChange.patches);
            const resultChecksum = this.calculateChecksum(JSON.stringify(updatedData));
            const expectedVersion = this.getStateVersion(stateKey, stateChange.currentVersion);
            if (expectedVersion && expectedVersion.checksum === resultChecksum) {
                return updatedData;
            }
            else {
                console.warn(`Checksum mismatch for ${stateKey} after applying patches`);
                return null;
            }
        }
        catch (error) {
            console.error(`Failed to apply patches for ${stateKey}:`, error);
            return null;
        }
    }
    subscribe(stateKey, callback, options = {}) {
        const subscriptionId = this.generateSubscriptionId();
        const tracker = this.getOrCreateTracker(stateKey);
        const subscription = {
            id: subscriptionId,
            stateKey,
            callback: callback,
            lastVersion: tracker.currentVersion?.version || 0,
            options: {
                immediate: false,
                throttleMs: 0,
                maxDiffSize: 10 * 1024,
                fallbackToFull: true,
                ...options
            }
        };
        this.subscriptions.set(subscriptionId, subscription);
        tracker.subscriptions.add(subscription);
        if (subscription.options.immediate && tracker.currentVersion) {
            const immediateChange = {
                id: this.generateChangeId(),
                previousVersion: 0,
                currentVersion: tracker.currentVersion.version,
                diff: { added: [], modified: [], deleted: [] },
                patches: [{
                        op: 'replace',
                        path: '',
                        value: tracker.currentVersion.data
                    }],
                compressionRatio: 0,
                metadata: {
                    source: stateKey,
                    timestamp: tracker.currentVersion.timestamp,
                    dataType: typeof tracker.currentVersion.data,
                    estimatedSavings: 0
                }
            };
            setTimeout(() => callback(immediateChange), 0);
        }
        return subscriptionId;
    }
    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            const tracker = this.stateTrackers.get(subscription.stateKey);
            if (tracker) {
                tracker.subscriptions.delete(subscription);
            }
            this.subscriptions.delete(subscriptionId);
        }
    }
    async getDifferentialUpdate(stateKey, sinceVersion) {
        const tracker = this.stateTrackers.get(stateKey);
        if (!tracker || !tracker.currentVersion)
            return null;
        if (tracker.currentVersion.version === sinceVersion) {
            return null;
        }
        const previousVersion = this.getStateVersion(stateKey, sinceVersion);
        if (!previousVersion) {
            return null;
        }
        const diff = await this.diffCalculator.calculateDiff(previousVersion.data, tracker.currentVersion.data);
        const patches = await this.diffCalculator.generatePatches(diff);
        const estimatedPatchSize = this.estimatePatchSize(patches);
        const compressionRatio = (tracker.currentVersion.size - estimatedPatchSize) / tracker.currentVersion.size;
        return {
            id: this.generateChangeId(),
            previousVersion: sinceVersion,
            currentVersion: tracker.currentVersion.version,
            diff,
            patches,
            compressionRatio,
            metadata: {
                source: stateKey,
                timestamp: tracker.currentVersion.timestamp,
                dataType: typeof tracker.currentVersion.data,
                estimatedSavings: Math.round(((tracker.currentVersion.size - estimatedPatchSize) / 1024))
            }
        };
    }
    clearState(stateKey) {
        const tracker = this.stateTrackers.get(stateKey);
        if (tracker) {
            tracker.subscriptions.forEach(subscription => {
                this.subscriptions.delete(subscription.id);
            });
            this.stateTrackers.delete(stateKey);
            this.emit('stateCleared', { stateKey });
        }
    }
    getMetrics() {
        let totalStates = this.stateTrackers.size;
        let totalVersions = 0;
        let totalSubscriptions = this.subscriptions.size;
        let totalDataSize = 0;
        let averageCompressionRatio = 0;
        let compressionSamples = 0;
        for (const tracker of this.stateTrackers.values()) {
            totalVersions += tracker.previousVersions.size + (tracker.currentVersion ? 1 : 0);
            if (tracker.currentVersion) {
                totalDataSize += tracker.currentVersion.size;
            }
        }
        return {
            totalStates,
            totalVersions,
            totalSubscriptions,
            totalDataSizeBytes: totalDataSize,
            averageCompressionRatio,
            memoryUsageBytes: this.estimateMemoryUsage(),
            activeTrackers: Array.from(this.stateTrackers.keys())
        };
    }
    getOrCreateTracker(stateKey, options = {}) {
        let tracker = this.stateTrackers.get(stateKey);
        if (!tracker) {
            tracker = {
                key: stateKey,
                currentVersion: null,
                previousVersions: new Map(),
                subscriptions: new Set(),
                lastUpdateTime: 0,
                compressionEnabled: options.enableCompression ?? this.config.enableCompression,
                maxHistorySize: options.maxHistoryVersions ?? this.config.maxHistoryVersions
            };
            this.stateTrackers.set(stateKey, tracker);
        }
        return tracker;
    }
    notifySubscriptions(stateKey, stateChange) {
        const tracker = this.stateTrackers.get(stateKey);
        if (!tracker)
            return;
        tracker.subscriptions.forEach(subscription => {
            if (subscription.options.maxDiffSize &&
                this.estimatePatchSize(stateChange.patches) > subscription.options.maxDiffSize) {
                if (subscription.options.fallbackToFull) {
                    const fullStateChange = {
                        ...stateChange,
                        patches: [{
                                op: 'replace',
                                path: '',
                                value: tracker.currentVersion.data
                            }],
                        compressionRatio: 0
                    };
                    subscription.callback(fullStateChange);
                }
                return;
            }
            if (subscription.options.throttleMs) {
                setTimeout(() => subscription.callback(stateChange), subscription.options.throttleMs);
            }
            else {
                subscription.callback(stateChange);
            }
            subscription.lastVersion = stateChange.currentVersion;
        });
    }
    estimatePatchSize(patches) {
        return JSON.stringify(patches).length;
    }
    estimateMemoryUsage() {
        let total = 0;
        for (const tracker of this.stateTrackers.values()) {
            if (tracker.currentVersion) {
                total += tracker.currentVersion.size;
            }
            for (const version of tracker.previousVersions.values()) {
                total += version.size;
            }
        }
        return total;
    }
    calculateChecksum(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    generateChangeId() {
        return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    startVersionCleanup() {
        setInterval(() => {
            this.cleanupOldVersions();
        }, this.config.cleanupIntervalMs);
    }
    cleanupOldVersions() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;
        for (const tracker of this.stateTrackers.values()) {
            const versionsToDelete = [];
            for (const [version, versionData] of tracker.previousVersions.entries()) {
                if (now - versionData.timestamp > maxAge) {
                    versionsToDelete.push(version);
                }
            }
            versionsToDelete.forEach(version => {
                tracker.previousVersions.delete(version);
            });
        }
        if (versionsToDelete.length > 0) {
            this.emit('versionsCleanedUp', { deletedVersions: versionsToDelete.length });
        }
    }
}
exports.DifferentialStateManager = DifferentialStateManager;
exports.differentialStateManager = new DifferentialStateManager();
//# sourceMappingURL=DifferentialStateManager.js.map