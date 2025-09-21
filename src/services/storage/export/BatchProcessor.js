"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchProcessor = void 0;
const events_1 = require("events");
const worker_threads_1 = require("worker_threads");
const os_1 = require("os");
const perf_hooks_1 = require("perf_hooks");
class BatchProcessor extends events_1.EventEmitter {
    options;
    workers = [];
    checkpoints = new Map();
    isProcessing = false;
    memoryMonitor = null;
    constructor(options = {}) {
        super();
        this.options = {
            batchSize: options.batchSize || 100,
            maxConcurrency: options.maxConcurrency || Math.min((0, os_1.cpus)().length, 4),
            enableProgress: options.enableProgress ?? true,
            enableRetry: options.enableRetry ?? true,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            memoryLimit: options.memoryLimit || 512,
            enableWorkerThreads: options.enableWorkerThreads ?? false,
            checkpointInterval: options.checkpointInterval || 10
        };
    }
    async processBatch(data, processor, progressCallback, errorCallback) {
        if (this.isProcessing) {
            throw new Error('Batch processor is already running');
        }
        this.isProcessing = true;
        const startTime = perf_hooks_1.performance.now();
        try {
            this.startMemoryMonitoring();
            const batches = this.createBatches(data);
            const result = {
                data: [],
                processingTime: 0,
                totalProcessed: 0,
                errors: [],
                checkpoints: [],
                memoryUsage: this.getMemoryUsage()
            };
            this.emit('batch:started', {
                totalBatches: batches.length,
                totalItems: data.length,
                batchSize: this.options.batchSize
            });
            if (this.options.enableWorkerThreads && data.length > 1000) {
                result.data = await this.processWithWorkers(batches, processor, progressCallback, errorCallback);
            }
            else {
                result.data = await this.processSequentially(batches, processor, progressCallback, errorCallback);
            }
            result.processingTime = perf_hooks_1.performance.now() - startTime;
            result.totalProcessed = data.length;
            result.checkpoints = Array.from(this.checkpoints.values());
            result.memoryUsage = this.getMemoryUsage();
            this.emit('batch:completed', result);
            return result;
        }
        catch (error) {
            this.emit('batch:failed', error);
            throw error;
        }
        finally {
            this.isProcessing = false;
            this.stopMemoryMonitoring();
            await this.cleanupWorkers();
        }
    }
    async processStream(dataGenerator, processor, progressCallback, errorCallback) {
        const self = this;
        let batchIndex = 0;
        let totalProcessed = 0;
        return (async function* () {
            try {
                self.startMemoryMonitoring();
                for await (const batch of dataGenerator) {
                    try {
                        const memUsage = self.getMemoryUsage();
                        if (memUsage.heapUsed / 1024 / 1024 > self.options.memoryLimit) {
                            self.emit('memory:warning', {
                                current: memUsage.heapUsed / 1024 / 1024,
                                limit: self.options.memoryLimit
                            });
                            if (global.gc) {
                                global.gc();
                            }
                        }
                        const batchResult = await self.processSingleBatch(batch, batchIndex, processor, errorCallback);
                        totalProcessed += batch.length;
                        batchIndex++;
                        if (batchIndex % self.options.checkpointInterval === 0) {
                            await self.createCheckpoint(batchIndex, totalProcessed, {});
                        }
                        if (progressCallback) {
                            progressCallback({
                                totalBatches: -1,
                                processedBatches: batchIndex,
                                currentBatch: batchIndex,
                                percentComplete: -1,
                                estimatedTimeRemaining: -1,
                                averageBatchTime: 0,
                                memoryUsage: self.getMemoryUsage()
                            });
                        }
                        yield batchResult;
                    }
                    catch (error) {
                        const batchError = {
                            batchIndex,
                            recordIndex: -1,
                            error: error.message,
                            recoverable: true,
                            retryCount: 0
                        };
                        errorCallback?.(batchError);
                        self.emit('batch:error', batchError);
                    }
                }
            }
            finally {
                self.stopMemoryMonitoring();
            }
        })();
    }
    async resumeFromCheckpoint(checkpointId, data, processor, progressCallback, errorCallback) {
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint not found: ${checkpointId}`);
        }
        const remainingData = data.slice(checkpoint.processedCount);
        const result = await this.processBatch(remainingData, processor, progressCallback, errorCallback);
        result.totalProcessed += checkpoint.processedCount;
        return result;
    }
    async cancel() {
        if (!this.isProcessing) {
            return;
        }
        this.emit('batch:cancelling');
        await this.cleanupWorkers();
        this.isProcessing = false;
        this.emit('batch:cancelled');
    }
    getStatistics() {
        return {
            isProcessing: this.isProcessing,
            activeWorkers: this.workers.length,
            checkpointCount: this.checkpoints.size,
            memoryUsage: this.getMemoryUsage()
        };
    }
    createBatches(data) {
        const batches = [];
        for (let i = 0; i < data.length; i += this.options.batchSize) {
            const batch = data.slice(i, i + this.options.batchSize);
            batches.push(batch);
        }
        return batches;
    }
    async processSequentially(batches, processor, progressCallback, errorCallback) {
        const results = [];
        const startTime = perf_hooks_1.performance.now();
        const batchTimes = [];
        for (let i = 0; i < batches.length; i++) {
            const batchStartTime = perf_hooks_1.performance.now();
            try {
                const batchResult = await this.processSingleBatch(batches[i], i, processor, errorCallback);
                results.push(...batchResult);
                const batchTime = perf_hooks_1.performance.now() - batchStartTime;
                batchTimes.push(batchTime);
                if ((i + 1) % this.options.checkpointInterval === 0) {
                    await this.createCheckpoint(i + 1, results.length, { results });
                }
                if (progressCallback) {
                    const averageBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
                    const remainingBatches = batches.length - (i + 1);
                    const estimatedTimeRemaining = remainingBatches * averageBatchTime;
                    progressCallback({
                        totalBatches: batches.length,
                        processedBatches: i + 1,
                        currentBatch: i + 1,
                        percentComplete: ((i + 1) / batches.length) * 100,
                        estimatedTimeRemaining,
                        averageBatchTime,
                        memoryUsage: this.getMemoryUsage()
                    });
                }
            }
            catch (error) {
                const batchError = {
                    batchIndex: i,
                    recordIndex: -1,
                    error: error.message,
                    recoverable: true,
                    retryCount: 0
                };
                errorCallback?.(batchError);
                this.emit('batch:error', batchError);
            }
        }
        return results;
    }
    async processWithWorkers(batches, processor, progressCallback, errorCallback) {
        const results = [];
        const workerCount = Math.min(this.options.maxConcurrency, batches.length);
        await this.createWorkerPool(workerCount);
        try {
            const batchPromises = batches.map((batch, index) => this.processBatchWithWorker(batch, index, processor, errorCallback));
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(...result.value);
                }
                else {
                    const batchError = {
                        batchIndex: index,
                        recordIndex: -1,
                        error: result.reason.message,
                        recoverable: false,
                        retryCount: 0
                    };
                    errorCallback?.(batchError);
                    this.emit('batch:error', batchError);
                }
            });
            if (progressCallback) {
                progressCallback({
                    totalBatches: batches.length,
                    processedBatches: batches.length,
                    currentBatch: batches.length,
                    percentComplete: 100,
                    estimatedTimeRemaining: 0,
                    averageBatchTime: 0,
                    memoryUsage: this.getMemoryUsage()
                });
            }
        }
        finally {
            await this.cleanupWorkers();
        }
        return results;
    }
    async processSingleBatch(batch, batchIndex, processor, errorCallback) {
        let lastError = null;
        for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
            try {
                return await processor(batch);
            }
            catch (error) {
                lastError = error;
                if (attempt < this.options.retryAttempts && this.options.enableRetry) {
                    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
                    const batchError = {
                        batchIndex,
                        recordIndex: -1,
                        error: error.message,
                        recoverable: true,
                        retryCount: attempt + 1
                    };
                    errorCallback?.(batchError);
                    this.emit('batch:retry', batchError);
                }
            }
        }
        throw lastError;
    }
    async processBatchWithWorker(batch, batchIndex, processor, errorCallback) {
        return new Promise((resolve, reject) => {
            this.processSingleBatch(batch, batchIndex, processor, errorCallback)
                .then(resolve)
                .catch(reject);
        });
    }
    async createWorkerPool(count) {
        console.log(`Creating worker pool with ${count} workers`);
    }
    async cleanupWorkers() {
        for (const worker of this.workers) {
            await worker.terminate();
        }
        this.workers = [];
    }
    async createCheckpoint(batchIndex, processedCount, state) {
        const checkpoint = {
            id: `checkpoint-${Date.now()}-${batchIndex}`,
            batchIndex,
            processedCount,
            timestamp: new Date(),
            state
        };
        this.checkpoints.set(checkpoint.id, checkpoint);
        this.emit('checkpoint:created', checkpoint);
    }
    startMemoryMonitoring() {
        if (this.memoryMonitor) {
            return;
        }
        this.memoryMonitor = setInterval(() => {
            const memUsage = this.getMemoryUsage();
            const memUsageMB = memUsage.heapUsed / 1024 / 1024;
            this.emit('memory:update', memUsage);
            if (memUsageMB > this.options.memoryLimit * 0.9) {
                this.emit('memory:warning', {
                    current: memUsageMB,
                    limit: this.options.memoryLimit,
                    percentage: (memUsageMB / this.options.memoryLimit) * 100
                });
            }
            if (memUsageMB > this.options.memoryLimit) {
                this.emit('memory:limit', {
                    current: memUsageMB,
                    limit: this.options.memoryLimit
                });
                if (global.gc) {
                    global.gc();
                }
            }
        }, 5000);
    }
    stopMemoryMonitoring() {
        if (this.memoryMonitor) {
            clearInterval(this.memoryMonitor);
            this.memoryMonitor = null;
        }
    }
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss
        };
    }
}
exports.BatchProcessor = BatchProcessor;
if (!worker_threads_1.isMainThread && worker_threads_1.parentPort) {
    worker_threads_1.parentPort.on('message', async (data) => {
        try {
            const { batch, processor, batchIndex } = data;
            const result = await processor(batch);
            worker_threads_1.parentPort.postMessage({
                success: true,
                result,
                batchIndex
            });
        }
        catch (error) {
            worker_threads_1.parentPort.postMessage({
                success: false,
                error: error.message,
                batchIndex: data.batchIndex
            });
        }
    });
}
//# sourceMappingURL=BatchProcessor.js.map