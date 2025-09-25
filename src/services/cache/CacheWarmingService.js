'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CacheWarmingService = void 0;
class CacheWarmingService {
  cacheOrchestrator;
  queryCache;
  strategies = new Map();
  scheduledTasks = new Map();
  metrics;
  isWarming = false;
  constructor(cacheOrchestrator, queryCache) {
    this.cacheOrchestrator = cacheOrchestrator;
    this.queryCache = queryCache;
    this.metrics = {
      totalWarmed: 0,
      successfulWarms: 0,
      failedWarms: 0,
      avgWarmingTime: 0,
      lastWarmingTime: 0,
      nextScheduledWarming: 0,
      strategiesExecuted: [],
    };
  }
  registerStrategy(strategy) {
    this.strategies.set(strategy.name, strategy);
    if (strategy.enabled) {
      this.scheduleStrategy(strategy);
    }
  }
  registerPopularSearches() {
    const strategy = {
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
          schedule: { onStartup: true, interval: 3600000 },
        },
        {
          key: 'search:popular:cobol',
          fetcher: () => this.fetchPopularSearch('cobol'),
          priority: 9,
          ttl: 3600,
          tags: ['search', 'popular'],
        },
        {
          key: 'search:popular:jcl',
          fetcher: () => this.fetchPopularSearch('jcl'),
          priority: 8,
          ttl: 3600,
          tags: ['search', 'popular'],
        },
        {
          key: 'search:popular:db2',
          fetcher: () => this.fetchPopularSearch('db2'),
          priority: 7,
          ttl: 3600,
          tags: ['search', 'popular'],
        },
        {
          key: 'search:popular:vsam',
          fetcher: () => this.fetchPopularSearch('vsam'),
          priority: 6,
          ttl: 3600,
          tags: ['search', 'popular'],
        },
      ],
    };
    this.registerStrategy(strategy);
  }
  registerKnowledgeBaseWarming() {
    const strategy = {
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
          ttl: 7200,
          tags: ['kb', 'categories'],
          schedule: { onStartup: true, interval: 7200000 },
        },
        {
          key: 'kb:entries:recent',
          fetcher: () => this.fetchRecentEntries(),
          priority: 8,
          ttl: 1800,
          tags: ['kb', 'entries'],
        },
        {
          key: 'kb:tags:popular',
          fetcher: () => this.fetchPopularTags(),
          priority: 6,
          ttl: 3600,
          tags: ['kb', 'tags'],
        },
      ],
    };
    this.registerStrategy(strategy);
  }
  registerUserPreferencesWarming() {
    const strategy = {
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
          tags: ['user', 'settings'],
        },
        {
          key: 'user:themes:available',
          fetcher: () => this.fetchAvailableThemes(),
          priority: 3,
          ttl: 86400,
          tags: ['user', 'themes'],
        },
      ],
    };
    this.registerStrategy(strategy);
  }
  async warmAll() {
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
      console.log(
        `Warmed ${this.metrics.successfulWarms} entries, ${this.metrics.failedWarms} failures`
      );
    } catch (error) {
      console.error('Cache warming error:', error);
    } finally {
      this.isWarming = false;
    }
  }
  async warmOnStartup() {
    const startupEntries = [];
    for (const strategy of this.strategies.values()) {
      if (strategy.enabled) {
        const entries = strategy.entries.filter(entry => entry.schedule?.onStartup);
        startupEntries.push(...entries);
      }
    }
    if (startupEntries.length > 0) {
      console.log(`Warming ${startupEntries.length} startup cache entries`);
      await this.warmEntries(startupEntries, { batchSize: 5, concurrency: 3 });
    }
  }
  async warmEntries(entries, options = {}) {
    const { batchSize = 10, concurrency = 3 } = options;
    const sortedEntries = entries.sort((a, b) => b.priority - a.priority);
    for (let i = 0; i < sortedEntries.length; i += batchSize) {
      const batch = sortedEntries.slice(i, i + batchSize);
      const chunks = this.chunkArray(batch, concurrency);
      for (const chunk of chunks) {
        await Promise.allSettled(chunk.map(entry => this.warmEntry(entry)));
      }
    }
  }
  getMetrics() {
    return { ...this.metrics };
  }
  stopScheduledWarming() {
    for (const [name, task] of this.scheduledTasks) {
      clearInterval(task);
      console.log(`Stopped scheduled warming for: ${name}`);
    }
    this.scheduledTasks.clear();
  }
  async executeStrategy(strategy) {
    console.log(`Executing warming strategy: ${strategy.name}`);
    await this.warmEntries(strategy.entries, {
      batchSize: strategy.batchSize,
      concurrency: strategy.concurrency,
    });
  }
  async warmEntry(entry) {
    const startTime = Date.now();
    try {
      console.log(`Warming cache entry: ${entry.key}`);
      const data = await this.executeWithRetry(entry.fetcher, 3, 1000);
      await this.cacheOrchestrator.set(entry.key, data, entry.ttl, entry.tags);
      this.metrics.successfulWarms++;
      const duration = Date.now() - startTime;
      this.updateAverageWarmingTime(duration);
    } catch (error) {
      console.error(`Failed to warm cache entry ${entry.key}:`, error);
      this.metrics.failedWarms++;
    }
    this.metrics.totalWarmed++;
  }
  async executeWithRetry(fetcher, retries, delay) {
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
  scheduleStrategy(strategy) {
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
  getMaxPriority(strategy) {
    return Math.max(...strategy.entries.map(entry => entry.priority));
  }
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  updateAverageWarmingTime(duration) {
    const total = this.metrics.avgWarmingTime * (this.metrics.successfulWarms - 1) + duration;
    this.metrics.avgWarmingTime = total / this.metrics.successfulWarms;
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async fetchPopularSearch(term) {
    return {
      term,
      results: [
        { id: 1, title: `${term} Overview`, type: 'documentation' },
        { id: 2, title: `${term} Best Practices`, type: 'guide' },
        { id: 3, title: `${term} Examples`, type: 'example' },
      ],
      count: 3,
      timestamp: Date.now(),
    };
  }
  async fetchKbCategories() {
    return {
      categories: [
        { id: 1, name: 'Mainframe Basics', count: 45 },
        { id: 2, name: 'COBOL Programming', count: 78 },
        { id: 3, name: 'JCL Scripts', count: 34 },
        { id: 4, name: 'DB2 Database', count: 56 },
        { id: 5, name: 'VSAM Files', count: 23 },
      ],
      timestamp: Date.now(),
    };
  }
  async fetchRecentEntries() {
    return {
      entries: [
        { id: 101, title: 'New COBOL Features', updated: Date.now() - 86400000 },
        { id: 102, title: 'JCL Optimization Tips', updated: Date.now() - 172800000 },
        { id: 103, title: 'DB2 Performance Tuning', updated: Date.now() - 259200000 },
      ],
      timestamp: Date.now(),
    };
  }
  async fetchPopularTags() {
    return {
      tags: [
        { name: 'cobol', count: 156 },
        { name: 'jcl', count: 89 },
        { name: 'db2', count: 67 },
        { name: 'vsam', count: 45 },
        { name: 'cics', count: 34 },
      ],
      timestamp: Date.now(),
    };
  }
  async fetchDefaultSettings() {
    return {
      theme: 'light',
      language: 'en',
      notifications: true,
      autoSave: true,
      pageSize: 25,
    };
  }
  async fetchAvailableThemes() {
    return {
      themes: [
        { id: 'light', name: 'Light Theme', default: true },
        { id: 'dark', name: 'Dark Theme', default: false },
        { id: 'high-contrast', name: 'High Contrast', default: false },
      ],
    };
  }
}
exports.CacheWarmingService = CacheWarmingService;
//# sourceMappingURL=CacheWarmingService.js.map
