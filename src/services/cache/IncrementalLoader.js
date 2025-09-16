"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalLoader = void 0;
const events_1 = require("events");
class IncrementalLoader extends events_1.EventEmitter {
    config;
    chunkCache;
    activeLoads = new Map();
    loadQueue = [];
    currentParallelLoads = 0;
    loadHistory = [];
    optimalChunkSizes = new Map();
    throughputHistory = [];
    constructor(chunkCache, config = {}) {
        super();
        this.config = {
            defaultChunkSize: 100,
            maxParallelLoads: 3,
            enableAdaptiveChunking: true,
            enablePrioritization: true,
            enableCaching: true,
            chunkCacheTTL: 300000,
            loadTimeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            throughputThreshold: 0.8,
            adaptiveThreshold: 0.1,
            ...config
        };
        this.chunkCache = chunkCache;
        this.startLoadProcessor();
    }
    async load(request, dataSource) {
        const startTime = performance.now();
        try {
            this.validateLoadRequest(request);
            if (this.activeLoads.has(request.id)) {
                throw new Error(`Load request ${request.id} is already active`);
            }
            this.activeLoads.set(request.id, request);
            console.log(`Starting incremental load: ${request.id} (${request.totalSize} items)`);
            const chunkingStrategy = this.determineChunkingStrategy(request);
            const loadPlan = this.createLoadPlan(request, chunkingStrategy);
            const result = await this.executeLoadPlan(request, loadPlan, dataSource);
            const totalTime = performance.now() - startTime;
            const stats = {
                totalLoadTime: totalTime,
                averageChunkTime: totalTime / loadPlan.length,
                throughput: request.totalSize / (totalTime / 1000),
                cacheHitRate: this.calculateCacheHitRate(request.id),
                chunksFromCache: this.getChunksFromCache(request.id),
                chunksFromSource: this.getChunksFromSource(request.id),
                errorCount: 0
            };
            console.log(`Incremental load completed: ${request.id} in ${Math.round(totalTime)}ms`);
            if (request.onComplete) {
                request.onComplete(result, stats);
            }
            this.emit('load-complete', { requestId: request.id, stats });
            return result;
        }
        catch (error) {
            console.error(`Incremental load failed: ${request.id}`, error);
            if (request.onError) {
                request.onError(error);
            }
            this.emit('load-error', { requestId: request.id, error });
            throw error;
        }
        finally {
            this.activeLoads.delete(request.id);
        }
    }
    async preload(requestId, query, chunkIds, dataSource) {
        let preloadedCount = 0;
        console.log(`Preloading ${chunkIds.length} chunks for ${requestId}`);
        const preloadPromises = chunkIds.map(async (chunkId) => {
            try {
                const cacheKey = this.generateCacheKey(requestId, chunkId);
                if (this.config.enableCaching && this.chunkCache.get(cacheKey)) {
                    return;
                }
                const data = await dataSource(chunkId);
                const chunk = {
                    id: chunkId,
                    data,
                    size: data.length,
                    priority: 1,
                    timestamp: Date.now(),
                    estimatedLoadTime: 100
                };
                if (this.config.enableCaching) {
                    this.chunkCache.set(cacheKey, chunk, this.config.chunkCacheTTL);
                }
                preloadedCount++;
                this.emit('chunk-preloaded', { requestId, chunkId, size: data.length });
            }
            catch (error) {
                console.error(`Preload failed for chunk ${chunkId}:`, error);
            }
        });
        await Promise.allSettled(preloadPromises);
        console.log(`Preloaded ${preloadedCount}/${chunkIds.length} chunks`);
        return preloadedCount;
    }
    cancelLoad(requestId) {
        if (this.activeLoads.has(requestId)) {
            this.activeLoads.delete(requestId);
            this.emit('load-cancelled', { requestId });
            return true;
        }
        return false;
    }
    getLoadProgress(requestId) {
        const request = this.activeLoads.get(requestId);
        if (!request)
            return null;
        const totalChunks = Math.ceil(request.totalSize / request.chunkSize);
        const loadedChunks = this.getLoadedChunkCount(requestId);
        const loadedSize = loadedChunks * request.chunkSize;
        const progress = {
            loadedChunks,
            totalChunks,
            loadedSize: Math.min(loadedSize, request.totalSize),
            totalSize: request.totalSize,
            percentage: Math.min(100, (loadedSize / request.totalSize) * 100),
            estimatedTimeRemaining: this.estimateTimeRemaining(request, loadedChunks),
            currentThroughput: this.getCurrentThroughput()
        };
        return progress;
    }
    optimizeChunkSizes() {
        if (!this.config.enableAdaptiveChunking)
            return;
        console.log('Optimizing chunk sizes based on performance data...');
        const recentLoads = this.loadHistory
            .filter(load => Date.now() - load.timestamp < 60 * 60 * 1000)
            .filter(load => !load.fromCache);
        if (recentLoads.length < 10)
            return;
        const patternGroups = this.groupLoadsByPattern(recentLoads);
        for (const [pattern, loads] of patternGroups) {
            const optimalSize = this.calculateOptimalChunkSize(loads);
            if (optimalSize !== this.optimalChunkSizes.get(pattern)) {
                this.optimalChunkSizes.set(pattern, optimalSize);
                console.log(`Updated optimal chunk size for pattern ${pattern}: ${optimalSize}`);
            }
        }
    }
    getStats() {
        const recentLoads = this.loadHistory
            .filter(load => Date.now() - load.timestamp < 60 * 60 * 1000);
        const averageLoadTime = recentLoads.length > 0
            ? recentLoads.reduce((sum, load) => sum + load.loadTime, 0) / recentLoads.length
            : 0;
        const cacheHits = recentLoads.filter(load => load.fromCache).length;
        const cacheHitRate = recentLoads.length > 0 ? cacheHits / recentLoads.length : 0;
        const averageThroughput = this.throughputHistory.length > 0
            ? this.throughputHistory.reduce((sum, t) => sum + t, 0) / this.throughputHistory.length
            : 0;
        return {
            activeLoads: this.activeLoads.size,
            queuedLoads: this.loadQueue.length,
            cacheSize: this.chunkCache.size,
            averageLoadTime,
            averageThroughput,
            cacheHitRate
        };
    }
    validateLoadRequest(request) {
        if (!request.id)
            throw new Error('Load request must have an ID');
        if (!request.query)
            throw new Error('Load request must have a query');
        if (request.totalSize <= 0)
            throw new Error('Total size must be positive');
        if (request.chunkSize <= 0)
            throw new Error('Chunk size must be positive');
    }
    determineChunkingStrategy(request) {
        let chunkSize = request.chunkSize;
        if (this.config.enableAdaptiveChunking) {
            const pattern = this.getLoadPattern(request);
            const optimalSize = this.optimalChunkSizes.get(pattern);
            if (optimalSize) {
                chunkSize = optimalSize;
            }
        }
        let strategy = request.loadStrategy;
        if (strategy === 'adaptive') {
            if (request.totalSize > 1000 && request.priority === 'high') {
                strategy = 'parallel';
            }
            else if (request.totalSize < 100) {
                strategy = 'sequential';
            }
            else {
                strategy = 'parallel';
            }
        }
        return { chunkSize, strategy };
    }
    createLoadPlan(request, chunkingStrategy) {
        const plan = [];
        const { chunkSize } = chunkingStrategy;
        for (let offset = 0; offset < request.totalSize; offset += chunkSize) {
            const limit = Math.min(chunkSize, request.totalSize - offset);
            let priority = 1;
            if (request.priority === 'critical')
                priority = 4;
            else if (request.priority === 'high')
                priority = 3;
            else if (request.priority === 'medium')
                priority = 2;
            if (offset < chunkSize * 3) {
                priority += 1;
            }
            plan.push({ offset, limit, priority });
        }
        if (this.config.enablePrioritization) {
            plan.sort((a, b) => b.priority - a.priority);
        }
        return plan;
    }
    async executeLoadPlan(request, plan, dataSource) {
        const results = [];
        const strategy = request.loadStrategy;
        if (strategy === 'sequential' || strategy === 'adaptive') {
            for (const chunk of plan) {
                const chunkData = await this.loadChunk(request, chunk.offset, chunk.limit, dataSource);
                results.splice(chunk.offset, chunk.limit, ...chunkData);
                const progress = this.calculateProgress(request, results.length);
                if (request.onChunkLoaded) {
                    request.onChunkLoaded({
                        id: `${chunk.offset}-${chunk.limit}`,
                        data: chunkData,
                        size: chunkData.length,
                        priority: chunk.priority,
                        timestamp: Date.now(),
                        estimatedLoadTime: 0
                    }, progress);
                }
            }
        }
        else {
            const parallelChunks = Math.min(request.maxParallelChunks, this.config.maxParallelLoads);
            const chunkPromises = [];
            for (let i = 0; i < plan.length; i += parallelChunks) {
                const batch = plan.slice(i, i + parallelChunks);
                const batchPromises = batch.map(async (chunk) => {
                    const data = await this.loadChunk(request, chunk.offset, chunk.limit, dataSource);
                    return { data, offset: chunk.offset, limit: chunk.limit };
                });
                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach(result => {
                    results.splice(result.offset, result.limit, ...result.data);
                    const progress = this.calculateProgress(request, results.length);
                    if (request.onChunkLoaded) {
                        request.onChunkLoaded({
                            id: `${result.offset}-${result.limit}`,
                            data: result.data,
                            size: result.data.length,
                            priority: 1,
                            timestamp: Date.now(),
                            estimatedLoadTime: 0
                        }, progress);
                    }
                });
            }
        }
        return results.filter(item => item !== undefined);
    }
    async loadChunk(request, offset, limit, dataSource) {
        const startTime = performance.now();
        const chunkId = `${offset}-${limit}`;
        const cacheKey = this.generateCacheKey(request.id, chunkId);
        try {
            if (this.config.enableCaching) {
                const cached = this.chunkCache.get(cacheKey);
                if (cached && !this.isChunkExpired(cached)) {
                    this.recordLoadHistory(request.id, chunkId, performance.now() - startTime, cached.size, true);
                    return cached.data;
                }
            }
            const data = await this.executeWithTimeout(() => dataSource(offset, limit), this.config.loadTimeout);
            const loadTime = performance.now() - startTime;
            if (this.config.enableCaching) {
                const chunk = {
                    id: chunkId,
                    data,
                    size: data.length,
                    priority: 1,
                    timestamp: Date.now(),
                    estimatedLoadTime: loadTime
                };
                this.chunkCache.set(cacheKey, chunk, this.config.chunkCacheTTL);
            }
            this.recordLoadHistory(request.id, chunkId, loadTime, data.length, false);
            this.updateThroughput(data.length, loadTime);
            return data;
        }
        catch (error) {
            console.error(`Chunk load failed: ${chunkId}`, error);
            if (this.config.retryAttempts > 0) {
                return this.retryChunkLoad(request, offset, limit, dataSource, 1);
            }
            throw error;
        }
    }
    async retryChunkLoad(request, offset, limit, dataSource, attempt) {
        if (attempt > this.config.retryAttempts) {
            throw new Error(`Chunk load failed after ${this.config.retryAttempts} attempts`);
        }
        console.log(`Retrying chunk load (attempt ${attempt}): ${offset}-${limit}`);
        await this.sleep(this.config.retryDelay * attempt);
        try {
            return await this.loadChunk(request, offset, limit, dataSource);
        }
        catch (error) {
            return this.retryChunkLoad(request, offset, limit, dataSource, attempt + 1);
        }
    }
    calculateProgress(request, loadedSize) {
        const totalChunks = Math.ceil(request.totalSize / request.chunkSize);
        const loadedChunks = Math.ceil(loadedSize / request.chunkSize);
        return {
            loadedChunks,
            totalChunks,
            loadedSize,
            totalSize: request.totalSize,
            percentage: (loadedSize / request.totalSize) * 100,
            estimatedTimeRemaining: this.estimateTimeRemaining(request, loadedChunks),
            currentThroughput: this.getCurrentThroughput()
        };
    }
    generateCacheKey(requestId, chunkId) {
        return `${requestId}:${chunkId}`;
    }
    isChunkExpired(chunk) {
        return Date.now() - chunk.timestamp > this.config.chunkCacheTTL;
    }
    recordLoadHistory(requestId, chunkId, loadTime, chunkSize, fromCache) {
        this.loadHistory.push({
            requestId,
            chunkId,
            loadTime,
            chunkSize,
            timestamp: Date.now(),
            fromCache
        });
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        this.loadHistory = this.loadHistory.filter(h => h.timestamp > cutoff);
    }
    updateThroughput(chunkSize, loadTime) {
        const throughput = chunkSize / (loadTime / 1000);
        this.throughputHistory.push(throughput);
        if (this.throughputHistory.length > 100) {
            this.throughputHistory = this.throughputHistory.slice(-100);
        }
    }
    getCurrentThroughput() {
        if (this.throughputHistory.length === 0)
            return 0;
        return this.throughputHistory.reduce((sum, t) => sum + t, 0) / this.throughputHistory.length;
    }
    estimateTimeRemaining(request, loadedChunks) {
        const totalChunks = Math.ceil(request.totalSize / request.chunkSize);
        const remainingChunks = totalChunks - loadedChunks;
        if (remainingChunks <= 0)
            return 0;
        const averageChunkTime = this.getAverageChunkTime(request.id);
        return remainingChunks * averageChunkTime;
    }
    getAverageChunkTime(requestId) {
        const requestLoads = this.loadHistory
            .filter(h => h.requestId === requestId && !h.fromCache);
        if (requestLoads.length === 0)
            return 1000;
        return requestLoads.reduce((sum, h) => sum + h.loadTime, 0) / requestLoads.length;
    }
    getLoadedChunkCount(requestId) {
        return this.loadHistory.filter(h => h.requestId === requestId).length;
    }
    calculateCacheHitRate(requestId) {
        const requestLoads = this.loadHistory.filter(h => h.requestId === requestId);
        if (requestLoads.length === 0)
            return 0;
        const cacheHits = requestLoads.filter(h => h.fromCache).length;
        return cacheHits / requestLoads.length;
    }
    getChunksFromCache(requestId) {
        return this.loadHistory.filter(h => h.requestId === requestId && h.fromCache).length;
    }
    getChunksFromSource(requestId) {
        return this.loadHistory.filter(h => h.requestId === requestId && !h.fromCache).length;
    }
    getLoadPattern(request) {
        const queryTerms = request.query.split(' ').length;
        const sizeCategory = request.totalSize < 100 ? 'small' : request.totalSize < 1000 ? 'medium' : 'large';
        const priorityLevel = request.priority;
        return `${sizeCategory}-${priorityLevel}-${queryTerms}terms`;
    }
    groupLoadsByPattern(loads) {
        const groups = new Map();
        loads.forEach(load => {
            const pattern = `${Math.floor(load.chunkSize / 50) * 50}`;
            if (!groups.has(pattern)) {
                groups.set(pattern, []);
            }
            groups.get(pattern).push(load);
        });
        return groups;
    }
    calculateOptimalChunkSize(loads) {
        const performanceBySize = new Map();
        loads.forEach(load => {
            const sizeKey = Math.floor(load.chunkSize / 10) * 10;
            const performance = load.chunkSize / load.loadTime;
            if (!performanceBySize.has(sizeKey)) {
                performanceBySize.set(sizeKey, []);
            }
            performanceBySize.get(sizeKey).push(performance);
        });
        let bestSize = this.config.defaultChunkSize;
        let bestPerformance = 0;
        for (const [size, performances] of performanceBySize) {
            const avgPerformance = performances.reduce((sum, p) => sum + p, 0) / performances.length;
            if (avgPerformance > bestPerformance) {
                bestPerformance = avgPerformance;
                bestSize = size;
            }
        }
        return bestSize;
    }
    async executeWithTimeout(operation, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }, timeout);
            operation()
                .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    startLoadProcessor() {
        setInterval(() => {
            this.processLoadQueue();
        }, 100);
        setInterval(() => {
            this.optimizeChunkSizes();
        }, 5 * 60 * 1000);
    }
    processLoadQueue() {
        if (this.loadQueue.length === 0 || this.currentParallelLoads >= this.config.maxParallelLoads) {
            return;
        }
        this.loadQueue.sort((a, b) => {
            const priorityScore = { low: 1, medium: 2, high: 3, critical: 4 };
            return priorityScore[b.priority] - priorityScore[a.priority];
        });
        const nextRequest = this.loadQueue.shift();
        if (nextRequest) {
            this.currentParallelLoads++;
            this.emit('load-started', { requestId: nextRequest.id });
        }
    }
}
exports.IncrementalLoader = IncrementalLoader;
exports.default = IncrementalLoader;
//# sourceMappingURL=IncrementalLoader.js.map