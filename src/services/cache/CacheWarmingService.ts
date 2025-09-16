import { CacheOrchestrator } from './CacheOrchestrator';
import { QueryCache } from './QueryCache';

export interface WarmingEntry {
  key: string;
  fetcher: () => Promise<any>;
  priority: number;
  ttl?: number;
  tags?: string[];
  schedule?: {
    interval?: number;
    cron?: string;
    onStartup?: boolean;
  };
  dependencies?: string[];
}

export interface WarmingStrategy {
  name: string;
  enabled: boolean;
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
  entries: WarmingEntry[];
}

export interface WarmingMetrics {
  totalWarmed: number;
  successfulWarms: number;
  failedWarms: number;
  avgWarmingTime: number;
  lastWarmingTime: number;
  nextScheduledWarming: number;
  strategiesExecuted: string[];
}

export class CacheWarmingService {
  private cacheOrchestrator: CacheOrchestrator;
  private queryCache: QueryCache;
  private strategies: Map<string, WarmingStrategy> = new Map();
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();
  private metrics: WarmingMetrics;
  private isWarming = false;

  constructor(
    cacheOrchestrator: CacheOrchestrator,
    queryCache: QueryCache
  ) {
    this.cacheOrchestrator = cacheOrchestrator;
    this.queryCache = queryCache;
    this.metrics = {
      totalWarmed: 0,
      successfulWarms: 0,
      failedWarms: 0,
      avgWarmingTime: 0,
      lastWarmingTime: 0,
      nextScheduledWarming: 0,
      strategiesExecuted: []
    };
  }

  // Register a warming strategy
  registerStrategy(strategy: WarmingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    
    if (strategy.enabled) {
      this.scheduleStrategy(strategy);
    }
  }

  // Popular searches warming
  registerPopularSearches(): void {
    const strategy: WarmingStrategy = {
      name: 'popular_searches',
      enabled: true,
      batchSize: 10,
      concurrency: 3,
      retryAttempts: 2,
      retryDelay: 1000,
      entries: [
        {
          key: 'search:popular:mainframe',
          fetcher: () => this.fetchPopularSearch('mainframe'),
          priority: 10,
          ttl: 3600,
          tags: ['search', 'popular'],
          schedule: { onStartup: true, interval: 3600000 } // 1 hour
        },
        {
          key: 'search:popular:cobol',
          fetcher: () => this.fetchPopularSearch('cobol'),
          priority: 9,
          ttl: 3600,
          tags: ['search', 'popular']
        },
        {
          key: 'search:popular:jcl',
          fetcher: () => this.fetchPopularSearch('jcl'),
          priority: 8,
          ttl: 3600,
          tags: ['search', 'popular']
        },
        {
          key: 'search:popular:db2',
          fetcher: () => this.fetchPopularSearch('db2'),
          priority: 7,
          ttl: 3600,
          tags: ['search', 'popular']
        },
        {
          key: 'search:popular:vsam',
          fetcher: () => this.fetchPopularSearch('vsam'),
          priority: 6,
          ttl: 3600,
          tags: ['search', 'popular']
        }
      ]
    };
    
    this.registerStrategy(strategy);
  }

  // Knowledge base categories warming
  registerKnowledgeBaseWarming(): void {
    const strategy: WarmingStrategy = {
      name: 'knowledge_base',
      enabled: true,
      batchSize: 5,
      concurrency: 2,
      retryAttempts: 3,
      retryDelay: 2000,
      entries: [
        {
          key: 'kb:categories:all',
          fetcher: () => this.fetchKbCategories(),
          priority: 10,
          ttl: 7200, // 2 hours
          tags: ['kb', 'categories'],
          schedule: { onStartup: true, interval: 7200000 }
        },
        {
          key: 'kb:entries:recent',
          fetcher: () => this.fetchRecentEntries(),
          priority: 8,
          ttl: 1800, // 30 minutes
          tags: ['kb', 'entries']
        },
        {
          key: 'kb:tags:popular',
          fetcher: () => this.fetchPopularTags(),
          priority: 6,
          ttl: 3600,
          tags: ['kb', 'tags']
        }
      ]
    };
    
    this.registerStrategy(strategy);
  }

  // User preferences warming
  registerUserPreferencesWarming(): void {
    const strategy: WarmingStrategy = {
      name: 'user_preferences',
      enabled: true,
      batchSize: 20,
      concurrency: 5,
      retryAttempts: 1,
      retryDelay: 500,
      entries: [
        {
          key: 'user:settings:default',
          fetcher: () => this.fetchDefaultSettings(),
          priority: 5,
          ttl: 1800,
          tags: ['user', 'settings']
        },
        {
          key: 'user:themes:available',
          fetcher: () => this.fetchAvailableThemes(),
          priority: 3,
          ttl: 86400, // 24 hours
          tags: ['user', 'themes']
        }
      ]
    };
    
    this.registerStrategy(strategy);
  }

  // Execute all strategies
  async warmAll(): Promise<void> {
    if (this.isWarming) {
      console.log('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();
    
    try {
      console.log('Starting comprehensive cache warming...');
      
      const enabledStrategies = Array.from(this.strategies.values())
        .filter(strategy => strategy.enabled)
        .sort((a, b) => this.getMaxPriority(b) - this.getMaxPriority(a));

      for (const strategy of enabledStrategies) {
        await this.executeStrategy(strategy);
        this.metrics.strategiesExecuted.push(strategy.name);
      }
      
      const duration = Date.now() - startTime;
      this.metrics.lastWarmingTime = duration;
      
      console.log(`Cache warming completed in ${duration}ms`);
      console.log(`Warmed ${this.metrics.successfulWarms} entries, ${this.metrics.failedWarms} failures`);
      
    } catch (error) {
      console.error('Cache warming error:', error);
    } finally {
      this.isWarming = false;
    }
  }

  // Execute startup warming
  async warmOnStartup(): Promise<void> {
    const startupEntries: WarmingEntry[] = [];
    
    for (const strategy of this.strategies.values()) {
      if (strategy.enabled) {
        const entries = strategy.entries.filter(entry => 
          entry.schedule?.onStartup
        );
        startupEntries.push(...entries);
      }
    }
    
    if (startupEntries.length > 0) {
      console.log(`Warming ${startupEntries.length} startup cache entries`);
      await this.warmEntries(startupEntries, { batchSize: 5, concurrency: 3 });
    }
  }

  // Warm specific entries
  async warmEntries(
    entries: WarmingEntry[],
    options: { batchSize?: number; concurrency?: number } = {}
  ): Promise<void> {
    const { batchSize = 10, concurrency = 3 } = options;
    
    // Sort by priority
    const sortedEntries = entries.sort((a, b) => b.priority - a.priority);
    
    for (let i = 0; i < sortedEntries.length; i += batchSize) {
      const batch = sortedEntries.slice(i, i + batchSize);
      
      // Process batch with limited concurrency
      const chunks = this.chunkArray(batch, concurrency);
      
      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map(entry => this.warmEntry(entry))
        );
      }
    }
  }

  // Get warming metrics
  getMetrics(): WarmingMetrics {
    return { ...this.metrics };
  }

  // Stop all scheduled warming
  stopScheduledWarming(): void {
    for (const [name, task] of this.scheduledTasks) {
      clearInterval(task);
      console.log(`Stopped scheduled warming for: ${name}`);
    }
    this.scheduledTasks.clear();
  }

  private async executeStrategy(strategy: WarmingStrategy): Promise<void> {
    console.log(`Executing warming strategy: ${strategy.name}`);
    
    await this.warmEntries(strategy.entries, {
      batchSize: strategy.batchSize,
      concurrency: strategy.concurrency
    });
  }

  private async warmEntry(entry: WarmingEntry): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`Warming cache entry: ${entry.key}`);
      
      const data = await this.executeWithRetry(
        entry.fetcher,
        3, // retry attempts
        1000 // retry delay
      );
      
      await this.cacheOrchestrator.set(
        entry.key,
        data,
        entry.ttl,
        entry.tags
      );
      
      this.metrics.successfulWarms++;
      
      const duration = Date.now() - startTime;
      this.updateAverageWarmingTime(duration);
      
    } catch (error) {
      console.error(`Failed to warm cache entry ${entry.key}:`, error);
      this.metrics.failedWarms++;
    }
    
    this.metrics.totalWarmed++;
  }

  private async executeWithRetry<T>(
    fetcher: () => Promise<T>,
    retries: number,
    delay: number
  ): Promise<T> {
    try {
      return await fetcher();
    } catch (error) {
      if (retries > 0) {
        await this.sleep(delay);
        return this.executeWithRetry(fetcher, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  private scheduleStrategy(strategy: WarmingStrategy): void {
    for (const entry of strategy.entries) {
      if (entry.schedule?.interval) {
        const task = setInterval(() => {
          this.warmEntry(entry).catch(error => {
            console.error(`Scheduled warming failed for ${entry.key}:`, error);
          });
        }, entry.schedule.interval);
        
        this.scheduledTasks.set(`${strategy.name}:${entry.key}`, task);
      }
    }
  }

  private getMaxPriority(strategy: WarmingStrategy): number {
    return Math.max(...strategy.entries.map(entry => entry.priority));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private updateAverageWarmingTime(duration: number): void {
    const total = this.metrics.avgWarmingTime * (this.metrics.successfulWarms - 1) + duration;
    this.metrics.avgWarmingTime = total / this.metrics.successfulWarms;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock fetcher functions - replace with actual implementations
  private async fetchPopularSearch(term: string): Promise<any> {
    // Mock popular search results
    return {
      term,
      results: [
        { id: 1, title: `${term} Overview`, type: 'documentation' },
        { id: 2, title: `${term} Best Practices`, type: 'guide' },
        { id: 3, title: `${term} Examples`, type: 'example' }
      ],
      count: 3,
      timestamp: Date.now()
    };
  }

  private async fetchKbCategories(): Promise<any> {
    return {
      categories: [
        { id: 1, name: 'Mainframe Basics', count: 45 },
        { id: 2, name: 'COBOL Programming', count: 78 },
        { id: 3, name: 'JCL Scripts', count: 34 },
        { id: 4, name: 'DB2 Database', count: 56 },
        { id: 5, name: 'VSAM Files', count: 23 }
      ],
      timestamp: Date.now()
    };
  }

  private async fetchRecentEntries(): Promise<any> {
    return {
      entries: [
        { id: 101, title: 'New COBOL Features', updated: Date.now() - 86400000 },
        { id: 102, title: 'JCL Optimization Tips', updated: Date.now() - 172800000 },
        { id: 103, title: 'DB2 Performance Tuning', updated: Date.now() - 259200000 }
      ],
      timestamp: Date.now()
    };
  }

  private async fetchPopularTags(): Promise<any> {
    return {
      tags: [
        { name: 'cobol', count: 156 },
        { name: 'jcl', count: 89 },
        { name: 'db2', count: 67 },
        { name: 'vsam', count: 45 },
        { name: 'cics', count: 34 }
      ],
      timestamp: Date.now()
    };
  }

  private async fetchDefaultSettings(): Promise<any> {
    return {
      theme: 'light',
      language: 'en',
      notifications: true,
      autoSave: true,
      pageSize: 25
    };
  }

  private async fetchAvailableThemes(): Promise<any> {
    return {
      themes: [
        { id: 'light', name: 'Light Theme', default: true },
        { id: 'dark', name: 'Dark Theme', default: false },
        { id: 'high-contrast', name: 'High Contrast', default: false }
      ]
    };
  }
}