/**
 * Resource Preloader - Preloads critical data, warms up search indexes,
 * and caches frequently used content for faster app responsiveness
 */

import { EventEmitter } from 'events';
import { KnowledgeDB, createKnowledgeDB } from '../../database/KnowledgeDB';
import { app } from 'electron';
import { join } from 'path';
import * as fs from 'fs';

export interface PreloadOptions {
  preloadPopularEntries: boolean;
  preloadSearchIndex: boolean;
  preloadTemplates: boolean;
  cacheUserPreferences: boolean;
  maxEntriesCount: number;
  maxCacheSize: number; // in MB
}

export interface PreloadResult {
  success: boolean;
  duration: number;
  preloadedEntries: number;
  indexesWarmed: number;
  templatesLoaded: number;
  cacheSize: number;
  errors: string[];
}

export class ResourcePreloader extends EventEmitter {
  private knowledgeDB: KnowledgeDB | null = null;
  private preloadCache = new Map<string, any>();
  
  private readonly options: PreloadOptions = {
    preloadPopularEntries: true,
    preloadSearchIndex: true,
    preloadTemplates: true,
    cacheUserPreferences: true,
    maxEntriesCount: 50,
    maxCacheSize: 50 // 50MB cache limit
  };

  constructor(options?: Partial<PreloadOptions>) {
    super();
    this.options = { ...this.options, ...options };
  }

  /**
   * Preload critical data for faster app startup
   */
  async preloadCriticalData(): Promise<PreloadResult> {
    const startTime = Date.now();
    console.log('🔄 Starting resource preloading...');

    const result: PreloadResult = {
      success: false,
      duration: 0,
      preloadedEntries: 0,
      indexesWarmed: 0,
      templatesLoaded: 0,
      cacheSize: 0,
      errors: []
    };

    try {
      // Initialize database connection
      await this.initializeDatabase();

      // Parallel preloading tasks
      const preloadTasks = [];

      if (this.options.preloadPopularEntries) {
        preloadTasks.push(this.preloadPopularKBEntries(result));
      }

      if (this.options.preloadSearchIndex) {
        preloadTasks.push(this.warmUpSearchIndexes(result));
      }

      if (this.options.preloadTemplates) {
        preloadTasks.push(this.preloadTemplates(result));
      }

      if (this.options.cacheUserPreferences) {
        preloadTasks.push(this.loadUserPreferences(result));
      }

      // Execute all preload tasks in parallel
      await Promise.allSettled(preloadTasks);

      // Calculate cache size
      result.cacheSize = this.calculateCacheSize();
      result.duration = Date.now() - startTime;
      result.success = result.errors.length === 0;

      console.log(`✅ Resource preloading completed in ${result.duration}ms`);
      console.log(`📊 Preloaded: ${result.preloadedEntries} entries, ${result.indexesWarmed} indexes, ${result.templatesLoaded} templates`);
      
      this.emit('preload:completed', result);
      return result;

    } catch (error) {
      result.errors.push(`Preloading failed: ${error.message}`);
      result.duration = Date.now() - startTime;
      result.success = false;

      console.error('❌ Resource preloading failed:', error);
      this.emit('preload:failed', error);
      
      return result;
    }
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const dbPath = join(app.getPath('userData'), 'knowledge.db');
      this.knowledgeDB = createKnowledgeDB(dbPath);
      
      // Test database connection
      await this.knowledgeDB.getMetrics();
      console.log('✅ Database connection established for preloading');
    } catch (error) {
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Preload most popular and recently used KB entries
   */
  private async preloadPopularKBEntries(result: PreloadResult): Promise<void> {
    try {
      if (!this.knowledgeDB) throw new Error('Database not initialized');

      console.log('🔄 Preloading popular KB entries...');
      this.emit('preload:progress', 'Loading popular entries', 10);

      // Get most popular entries (by usage_count)
      const popularEntries = await this.knowledgeDB.search('', {
        limit: Math.floor(this.options.maxEntriesCount * 0.6),
        sortBy: 'usage'
      });

      // Get recent entries
      const recentEntries = await this.knowledgeDB.search('', {
        limit: Math.floor(this.options.maxEntriesCount * 0.4),
        sortBy: 'date'
      });

      // Cache popular entries
      const allEntries = [...popularEntries, ...recentEntries];
      const uniqueEntries = this.deduplicateEntries(allEntries);

      for (const entry of uniqueEntries) {
        this.preloadCache.set(`kb:${entry.id}`, entry);
        
        // Also preload related searches
        if (entry.tags && entry.tags.length > 0) {
          for (const tag of entry.tags.slice(0, 3)) { // Top 3 tags
            const tagResults = await this.knowledgeDB.search(tag, { limit: 5 });
            this.preloadCache.set(`search:tag:${tag}`, tagResults);
          }
        }
      }

      result.preloadedEntries = uniqueEntries.length;
      console.log(`✅ Preloaded ${uniqueEntries.length} popular KB entries`);

    } catch (error) {
      result.errors.push(`Popular entries preload failed: ${error.message}`);
      console.error('❌ Failed to preload popular entries:', error);
    }
  }

  /**
   * Warm up search indexes by running common queries
   */
  private async warmUpSearchIndexes(result: PreloadResult): Promise<void> {
    try {
      if (!this.knowledgeDB) throw new Error('Database not initialized');

      console.log('🔄 Warming up search indexes...');
      this.emit('preload:progress', 'Warming search indexes', 30);

      // Common search terms to warm up indexes
      const commonSearchTerms = [
        's0c7', 'vsam', 'jcl', 'db2', 'abend', 'error', 'file', 'dataset',
        'status', 'code', 'batch', 'cobol', 'system', 'problem', 'solution'
      ];

      let warmedIndexes = 0;

      for (const term of commonSearchTerms) {
        try {
          // Warm up FTS search
          const searchResults = await this.knowledgeDB.search(term, { limit: 10 });
          this.preloadCache.set(`search:fts:${term}`, searchResults);

          // Warm up category searches
          const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'];
          for (const category of categories) {
            const categoryResults = await this.knowledgeDB.search('', { 
              category: category,
              limit: 10 
            });
            this.preloadCache.set(`search:category:${category}`, categoryResults);
          }

          warmedIndexes++;
        } catch (error) {
          console.warn(`Failed to warm index for term '${term}':`, error.message);
        }
      }

      // Warm up metrics query
      const metrics = await this.knowledgeDB.getMetrics();
      this.preloadCache.set('metrics:current', metrics);

      result.indexesWarmed = warmedIndexes;
      console.log(`✅ Warmed up ${warmedIndexes} search indexes`);

    } catch (error) {
      result.errors.push(`Index warming failed: ${error.message}`);
      console.error('❌ Failed to warm up search indexes:', error);
    }
  }

  /**
   * Preload templates and examples
   */
  private async preloadTemplates(result: PreloadResult): Promise<void> {
    try {
      console.log('🔄 Preloading templates...');
      this.emit('preload:progress', 'Loading templates', 50);

      const templatesPath = join(__dirname, '../../../assets/kb-templates');
      
      if (!fs.existsSync(templatesPath)) {
        console.log('📁 Templates directory not found, creating sample templates in cache...');
        await this.createSampleTemplates();
        result.templatesLoaded = 5; // Sample templates count
        return;
      }

      const templateFiles = fs.readdirSync(templatesPath).filter(f => f.endsWith('.json'));
      let templatesLoaded = 0;

      for (const file of templateFiles) {
        try {
          const filePath = join(templatesPath, file);
          const templateContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          this.preloadCache.set(`template:${file.replace('.json', '')}`, templateContent);
          templatesLoaded++;
        } catch (error) {
          console.warn(`Failed to load template ${file}:`, error.message);
        }
      }

      result.templatesLoaded = templatesLoaded;
      console.log(`✅ Preloaded ${templatesLoaded} templates`);

    } catch (error) {
      result.errors.push(`Template preloading failed: ${error.message}`);
      console.error('❌ Failed to preload templates:', error);
    }
  }

  /**
   * Load user preferences and settings
   */
  private async loadUserPreferences(result: PreloadResult): Promise<void> {
    try {
      console.log('🔄 Loading user preferences...');
      this.emit('preload:progress', 'Loading preferences', 70);

      const userDataPath = app.getPath('userData');
      const preferencesPath = join(userDataPath, 'preferences.json');
      
      let preferences = {};
      
      if (fs.existsSync(preferencesPath)) {
        preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
      } else {
        // Create default preferences
        preferences = {
          theme: 'dark',
          autoSave: true,
          searchLimit: 20,
          showCategories: true,
          enableAI: true,
          aiProvider: 'gemini',
          recentSearches: [],
          favoriteCategories: ['VSAM', 'JCL', 'Batch'],
          shortcuts: {
            newEntry: 'CmdOrCtrl+N',
            search: 'CmdOrCtrl+F',
            settings: 'CmdOrCtrl+,'
          }
        };
        
        // Save default preferences
        fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
      }

      this.preloadCache.set('user:preferences', preferences);
      
      // Preload recent searches if available
      if (preferences.recentSearches && Array.isArray(preferences.recentSearches)) {
        for (const recentSearch of preferences.recentSearches.slice(0, 10)) {
          try {
            const searchResults = await this.knowledgeDB?.search(recentSearch, { limit: 10 });
            if (searchResults) {
              this.preloadCache.set(`search:recent:${recentSearch}`, searchResults);
            }
          } catch (error) {
            // Ignore errors for recent searches
          }
        }
      }

      console.log('✅ User preferences loaded and cached');

    } catch (error) {
      result.errors.push(`User preferences loading failed: ${error.message}`);
      console.error('❌ Failed to load user preferences:', error);
    }
  }

  /**
   * Create sample templates in cache
   */
  private async createSampleTemplates(): Promise<void> {
    const sampleTemplates = {
      'error-resolution': {
        name: 'Error Resolution Template',
        fields: ['error_code', 'component', 'description', 'solution_steps', 'prevention'],
        example: {
          error_code: 'S0C7',
          component: 'COBOL Program',
          description: 'Data exception during arithmetic operation',
          solution_steps: [
            'Check for non-numeric data in numeric fields',
            'Verify field initialization',
            'Add numeric validation before operations'
          ],
          prevention: 'Initialize all numeric fields and add proper validation'
        }
      },
      'system-issue': {
        name: 'System Issue Template',
        fields: ['system', 'symptom', 'impact', 'root_cause', 'resolution'],
        example: {
          system: 'VSAM',
          symptom: 'File access denied',
          impact: 'Jobs failing with status 35',
          root_cause: 'File not cataloged properly',
          resolution: 'Re-catalog the file using IDCAMS'
        }
      },
      'batch-job': {
        name: 'Batch Job Issue Template',
        fields: ['job_name', 'step_name', 'return_code', 'error_message', 'fix'],
        example: {
          job_name: 'DAILY001',
          step_name: 'STEP010',
          return_code: '12',
          error_message: 'Dataset not found',
          fix: 'Check dataset name and allocation'
        }
      }
    };

    for (const [key, template] of Object.entries(sampleTemplates)) {
      this.preloadCache.set(`template:${key}`, template);
    }
  }

  /**
   * Remove duplicate entries based on ID
   */
  private deduplicateEntries(entries: any[]): any[] {
    const seen = new Set<string>();
    return entries.filter(entry => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }

  /**
   * Calculate total cache size in MB
   */
  private calculateCacheSize(): number {
    let totalSize = 0;
    
    for (const [key, value] of this.preloadCache.entries()) {
      const serialized = JSON.stringify(value);
      totalSize += Buffer.byteLength(serialized, 'utf8');
    }
    
    return Math.round(totalSize / (1024 * 1024) * 100) / 100; // MB with 2 decimal places
  }

  /**
   * Get cached data
   */
  getCached<T>(key: string): T | null {
    return this.preloadCache.get(key) || null;
  }

  /**
   * Set cached data
   */
  setCached<T>(key: string, data: T): void {
    // Check cache size limit
    if (this.calculateCacheSize() > this.options.maxCacheSize) {
      this.evictOldestEntries();
    }
    
    this.preloadCache.set(key, data);
  }

  /**
   * Check if data is cached
   */
  isCached(key: string): boolean {
    return this.preloadCache.has(key);
  }

  /**
   * Evict oldest cache entries to make room
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.preloadCache.entries());
    const toDelete = Math.floor(entries.length * 0.2); // Remove 20% oldest
    
    for (let i = 0; i < toDelete; i++) {
      this.preloadCache.delete(entries[i][0]);
    }
    
    console.log(`🗑️ Evicted ${toDelete} cache entries to free memory`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalSize: number;
    categories: Record<string, number>;
  } {
    const stats = {
      totalEntries: this.preloadCache.size,
      totalSize: this.calculateCacheSize(),
      categories: {} as Record<string, number>
    };

    for (const key of this.preloadCache.keys()) {
      const category = key.split(':')[0];
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.preloadCache.clear();
    console.log('🗑️ Cache cleared');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    
    if (this.knowledgeDB) {
      await this.knowledgeDB.close();
      this.knowledgeDB = null;
    }
    
    this.removeAllListeners();
  }
}