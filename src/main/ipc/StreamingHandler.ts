import { IpcMainInvokeEvent, WebContents } from 'electron';
import { EventEmitter } from 'events';
import { AppError } from '../../core/errors/AppError';
import type { IPCHandler } from './IPCManager';

export interface StreamConfig {
  chunkSize: number;
  maxBufferSize: number;
  timeoutMs: number;
  enableBackpressure: boolean;
}

export interface StreamMetrics {
  totalStreams: number;
  totalChunks: number;
  totalBytes: number;
  averageChunkSize: number;
  averageStreamTime: number;
  failedStreams: number;
}

export interface StreamProgress {
  streamId: string;
  totalItems?: number;
  processedItems: number;
  percentage: number;
  currentChunk: number;
  totalChunks?: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface StreamChunk {
  streamId: string;
  chunkIndex: number;
  data: any;
  isLast: boolean;
  progress?: StreamProgress;
  metadata?: {
    size: number;
    timestamp: number;
  };
}

/**
 * Streaming Handler for large dataset responses
 * Supports async generators, backpressure, and progress reporting
 */
export class StreamingHandler extends EventEmitter {
  private activeStreams = new Map<string, {
    generator: AsyncGenerator<any, any, unknown>;
    config: StreamConfig;
    startTime: number;
    sentChunks: number;
    totalSize: number;
  }>();

  private config: StreamConfig;
  private metrics: StreamMetrics;

  constructor(config: Partial<StreamConfig> = {}) {
    super();

    this.config = {
      chunkSize: 1000,
      maxBufferSize: 10000,
      timeoutMs: 30000,
      enableBackpressure: true,
      ...config
    };

    this.metrics = {
      totalStreams: 0,
      totalChunks: 0,
      totalBytes: 0,
      averageChunkSize: 0,
      averageStreamTime: 0,
      failedStreams: 0
    };

    console.log('🌊 StreamingHandler initialized', this.config);
  }

  /**
   * Handle streaming response from a handler
   */
  async handleStream(
    handler: IPCHandler,
    event: IpcMainInvokeEvent,
    args: any[],
    chunkSize?: number
  ): Promise<string> {
    const streamId = this.generateStreamId();
    const streamConfig = { ...this.config, chunkSize: chunkSize || this.config.chunkSize };

    try {
      this.metrics.totalStreams++;

      // Execute handler and expect it to return an async generator or array
      const result = await handler(event, ...args);

      if (!result) {
        throw new AppError('STREAM_NO_DATA', 'Handler returned no data for streaming');
      }

      // Create async generator from result
      const generator = this.createAsyncGenerator(result);

      // Store stream info
      this.activeStreams.set(streamId, {
        generator,
        config: streamConfig,
        startTime: Date.now(),
        sentChunks: 0,
        totalSize: 0
      });

      // Start streaming in background
      this.startStreaming(streamId, event.sender);

      // Return stream ID for client to listen to
      return streamId;

    } catch (error) {
      this.metrics.failedStreams++;
      console.error('❌ Stream setup failed:', error);
      throw error;
    }
  }

  /**
   * Create async generator from various data types
   */
  private async* createAsyncGenerator(data: any): AsyncGenerator<any, void, unknown> {
    if (this.isAsyncIterable(data)) {
      // Already an async generator or async iterable
      yield* data;
    } else if (Array.isArray(data)) {
      // Convert array to async generator
      for (const item of data) {
        yield item;
      }
    } else if (typeof data === 'object' && data !== null) {
      // Convert object properties to items
      for (const [key, value] of Object.entries(data)) {
        yield { key, value };
      }
    } else {
      // Single item
      yield data;
    }
  }

  /**
   * Check if data is async iterable
   */
  private isAsyncIterable(data: any): data is AsyncIterable<any> {
    return data != null && typeof data[Symbol.asyncIterator] === 'function';
  }

  /**
   * Start streaming data to client
   */
  private async startStreaming(streamId: string, sender: WebContents): Promise<void> {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo) return;

    const { generator, config, startTime } = streamInfo;
    let chunkIndex = 0;
    let buffer: any[] = [];
    let totalProcessed = 0;

    try {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.cancelStream(streamId, 'timeout');
      }, config.timeoutMs);

      // Process generator
      for await (const item of generator) {
        buffer.push(item);
        totalProcessed++;

        // Send chunk when buffer is full or at end
        if (buffer.length >= config.chunkSize) {
          await this.sendChunk(streamId, sender, buffer, chunkIndex, false);
          
          streamInfo.sentChunks++;
          streamInfo.totalSize += this.calculateSize(buffer);
          chunkIndex++;
          buffer = [];

          // Check for backpressure
          if (config.enableBackpressure && chunkIndex > 0 && chunkIndex % 10 === 0) {
            await this.waitForBackpressure(sender);
          }
        }
      }

      // Send final chunk if buffer has items
      if (buffer.length > 0) {
        await this.sendChunk(streamId, sender, buffer, chunkIndex, true);
        streamInfo.sentChunks++;
        streamInfo.totalSize += this.calculateSize(buffer);
      } else if (chunkIndex > 0) {
        // Send empty final chunk to signal end
        await this.sendChunk(streamId, sender, [], chunkIndex, true);
      }

      clearTimeout(timeoutId);

      // Update metrics
      const streamTime = Date.now() - startTime;
      this.updateMetrics(streamInfo.sentChunks, streamInfo.totalSize, streamTime, false);

      console.log(`✅ Stream ${streamId} completed: ${totalProcessed} items in ${streamTime}ms`);

    } catch (error) {
      console.error(`❌ Stream ${streamId} failed:`, error);
      this.metrics.failedStreams++;
      
      // Send error to client
      sender.send(`stream:error:${streamId}`, {
        error: error instanceof Error ? error.message : 'Unknown streaming error'
      });
    } finally {
      // Cleanup
      this.activeStreams.delete(streamId);
      this.emit('streamComplete', { streamId, totalProcessed });
    }
  }

  /**
   * Send a chunk of data to the client
   */
  private async sendChunk(
    streamId: string,
    sender: WebContents,
    data: any[],
    chunkIndex: number,
    isLast: boolean
  ): Promise<void> {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo) return;

    const progress: StreamProgress = {
      streamId,
      processedItems: (chunkIndex * this.config.chunkSize) + data.length,
      percentage: 0, // Will be calculated on client side if total is known
      currentChunk: chunkIndex + 1,
      startTime: streamInfo.startTime,
      estimatedTimeRemaining: this.calculateETA(streamInfo, chunkIndex)
    };

    const chunk: StreamChunk = {
      streamId,
      chunkIndex,
      data,
      isLast,
      progress,
      metadata: {
        size: this.calculateSize(data),
        timestamp: Date.now()
      }
    };

    // Send chunk to renderer process
    sender.send(`stream:chunk:${streamId}`, chunk);

    this.metrics.totalChunks++;
    this.metrics.totalBytes += chunk.metadata!.size;

    console.log(`📦 Sent chunk ${chunkIndex} for stream ${streamId}: ${data.length} items (${chunk.metadata!.size} bytes)`);

    // Small delay to prevent overwhelming the renderer
    if (!isLast) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  /**
   * Wait for backpressure relief
   */
  private async waitForBackpressure(sender: WebContents): Promise<void> {
    // Simple backpressure mechanism - wait a bit to allow renderer to process
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(streamInfo: any, currentChunk: number): number | undefined {
    if (currentChunk === 0) return undefined;

    const elapsedTime = Date.now() - streamInfo.startTime;
    const averageTimePerChunk = elapsedTime / (currentChunk + 1);
    
    // This is a rough estimate - in practice, you'd want more sophisticated prediction
    return Math.round(averageTimePerChunk * 2); // Estimate 2 more chunks on average
  }

  /**
   * Calculate size of data for metrics
   */
  private calculateSize(data: any[]): number {
    // Rough estimate - in production you might want more accurate sizing
    return JSON.stringify(data).length;
  }

  /**
   * Cancel an active stream
   */
  cancelStream(streamId: string, reason: string = 'cancelled'): boolean {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo) return false;

    console.log(`🛑 Cancelling stream ${streamId}: ${reason}`);

    // Clean up
    this.activeStreams.delete(streamId);
    this.metrics.failedStreams++;

    this.emit('streamCancelled', { streamId, reason });
    return true;
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    const streamIds = Array.from(this.activeStreams.keys());
    streamIds.forEach(id => this.cancelStream(id, 'shutdown'));
  }

  /**
   * Get information about active streams
   */
  getActiveStreams(): Array<{
    streamId: string;
    startTime: number;
    sentChunks: number;
    totalSize: number;
    elapsedTime: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeStreams.entries()).map(([streamId, info]) => ({
      streamId,
      startTime: info.startTime,
      sentChunks: info.sentChunks,
      totalSize: info.totalSize,
      elapsedTime: now - info.startTime
    }));
  }

  /**
   * Get streaming metrics
   */
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Update streaming metrics
   */
  private updateMetrics(chunks: number, bytes: number, streamTime: number, failed: boolean): void {
    if (!failed) {
      // Update average chunk size
      if (this.metrics.totalChunks > 0) {
        this.metrics.averageChunkSize = this.metrics.totalBytes / this.metrics.totalChunks;
      }

      // Update average stream time
      const completedStreams = this.metrics.totalStreams - this.metrics.failedStreams;
      if (completedStreams > 0) {
        const totalTime = this.metrics.averageStreamTime * (completedStreams - 1);
        this.metrics.averageStreamTime = (totalTime + streamTime) / completedStreams;
      }
    }
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and destroy the handler
   */
  destroy(): void {
    this.cancelAllStreams();
    this.removeAllListeners();
    console.log('🧹 StreamingHandler destroyed');
  }
}