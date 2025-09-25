/**
 * Core Storage Service Implementation
 * Provides unified storage abstraction with progressive MVP enhancement support
 *
 * Features:
 * - Plugin-based architecture for MVP extensions
 * - Multiple storage adapter support (SQLite, PostgreSQL, etc.)
 * - Advanced caching and performance optimization
 * - Comprehensive backup and migration system
 * - Event-driven architecture for extensibility
 */

import { EventEmitter } from 'events';
import {
  IStorageService,
  StorageConfig,
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchOptions,
  PatternData,
  Pattern,
  PatternCriteria,
  PatternUpdate,
  IncidentData,
  Incident,
  IncidentCriteria,
  IncidentUpdate,
  CodeAnalysis,
  CodeCriteria,
  CodeAnalysisUpdate,
  RepositoryData,
  Repository,
  ScanResult,
  CodeTemplate,
  TemplateCriteria,
  TemplateUpdate,
  TemplateMetadata,
  ProjectData,
  Project,
  ProjectCriteria,
  ProjectUpdate,
  PredictionData,
  Prediction,
  PredictionCriteria,
  MLModelData,
  MLModel,
  ModelMetrics,
  TimeRange,
  AnalyticsData,
  BackupOptions,
  BackupResult,
  RestoreOptions,
  RestoreResult,
  ExportFormat,
  ImportFormat,
  ExportOptions,
  ImportOptions,
  ImportResult,
  MigrationResult,
  StorageMetrics,
  OptimizationResult,
  HealthStatus,
  IStoragePlugin,
  LinkType,
  StorageEvents,
} from './IStorageService';
import { IStorageAdapter } from './adapters/IStorageAdapter';
import { SQLiteAdapter } from './adapters/SQLiteAdapter';
import { PostgreSQLAdapter } from './adapters/PostgreSQLAdapter';
import { StorageFactory } from './StorageFactory';
import { BaseStoragePlugin } from './plugins/BaseStoragePlugin';
import { PatternDetectionPlugin } from './plugins/PatternDetectionPlugin';
import { CodeAnalysisPlugin } from './plugins/CodeAnalysisPlugin';
import { TemplateEnginePlugin } from './plugins/TemplateEnginePlugin';
import { AnalyticsPlugin } from './plugins/AnalyticsPlugin';
import { BackupService } from './backup/BackupService';
import { MigrationService } from './MigrationService';
import { PerformanceMonitor } from './PerformanceMonitor';
import { CacheManager } from './CacheManager';

export class StorageService extends EventEmitter implements IStorageService {
  private adapter: IStorageAdapter;
  private config: StorageConfig;
  private plugins: Map<string, IStoragePlugin> = new Map();
  private backupService: BackupService;
  private migrationService: MigrationService;
  private performanceMonitor: PerformanceMonitor;
  private cacheManager: CacheManager;
  private initialized: boolean = false;

  constructor() {
    super();
    this.setMaxListeners(50); // Support many plugins
  }

  // ========================
  // Lifecycle Management
  // ========================

  async initialize(config: StorageConfig): Promise<void> {
    try {
      console.log('🚀 Initializing Storage Service...');
      this.config = config;

      // Initialize storage adapter
      this.adapter = StorageFactory.createAdapter(config.database.type, config.database);
      await this.adapter.initialize();

      // Initialize core services
      this.backupService = new BackupService(this.adapter, config.backup);
      this.migrationService = new MigrationService(this.adapter, config.mvp.version);
      this.performanceMonitor = new PerformanceMonitor(this.adapter, config.performance.monitoring);
      this.cacheManager = new CacheManager(config.performance.caching);

      // Run migrations to current MVP version
      const migrationResults = await this.migrationService.migrateToVersion(config.mvp.version);
      if (migrationResults.some(r => !r.success)) {
        console.warn('⚠️ Some migrations failed, continuing with current schema');
      }

      // Load MVP-specific plugins
      await this.loadMVPPlugins();

      // Initialize services
      await this.performanceMonitor.start();
      await this.cacheManager.initialize();

      // Setup automatic backups if enabled
      if (config.backup.enabled) {
        await this.backupService.scheduleAutoBackups();
      }

      this.initialized = true;
      this.emit('storage:initialized', config);

      console.log(`✅ Storage Service initialized for MVP${config.mvp.version}`);
      await this.logInitializationStats();
    } catch (error) {
      console.error('❌ Storage Service initialization failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return;

    console.log('🔄 Closing Storage Service...');

    // Stop services
    if (this.performanceMonitor) {
      await this.performanceMonitor.stop();
    }

    if (this.cacheManager) {
      await this.cacheManager.close();
    }

    if (this.backupService) {
      await this.backupService.stop();
    }

    // Unload all plugins
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.stop();
        console.log(`📤 Unloaded plugin: ${name}`);
      } catch (error) {
        console.warn(`⚠️ Error unloading plugin ${name}:`, error);
      }
    }
    this.plugins.clear();

    // Close adapter
    if (this.adapter) {
      await this.adapter.close();
    }

    this.initialized = false;
    this.emit('storage:closed');
    console.log('✅ Storage Service closed');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage Service not initialized. Call initialize() first.');
    }
  }

  // ========================
  // Core Knowledge Base Operations (MVP1)
  // ========================

  async createEntry(entry: KBEntryInput): Promise<string> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('createEntry', async () => {
      const id = await this.adapter.createEntry(entry);

      // Invalidate related cache entries
      await this.cacheManager.invalidatePattern('search:*');
      await this.cacheManager.invalidatePattern('stats:*');

      this.emit('entry:created', { ...entry, id } as KBEntry);
      return id;
    });
  }

  async readEntry(id: string): Promise<KBEntry | null> {
    this.ensureInitialized();

    const cacheKey = `entry:${id}`;
    return this.cacheManager.getOrSet(
      cacheKey,
      async () => {
        return this.adapter.readEntry(id);
      },
      300000
    ); // 5 minute cache
  }

  async updateEntry(id: string, updates: KBEntryUpdate): Promise<boolean> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('updateEntry', async () => {
      const success = await this.adapter.updateEntry(id, updates);

      if (success) {
        // Invalidate cache
        await this.cacheManager.delete(`entry:${id}`);
        await this.cacheManager.invalidatePattern('search:*');

        this.emit('entry:updated', id, updates);
      }

      return success;
    });
  }

  async deleteEntry(id: string): Promise<boolean> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('deleteEntry', async () => {
      const success = await this.adapter.deleteEntry(id);

      if (success) {
        // Invalidate cache
        await this.cacheManager.delete(`entry:${id}`);
        await this.cacheManager.invalidatePattern('search:*');

        this.emit('entry:deleted', id);
      }

      return success;
    });
  }

  async searchEntries(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.ensureInitialized();

    const cacheKey = `search:${this.generateSearchCacheKey(query, options)}`;

    return this.performanceMonitor.measureOperation('searchEntries', async () => {
      const results = await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          return this.adapter.searchEntries(query, options);
        },
        this.calculateSearchCacheTTL(options)
      );

      this.emit('search:performed', query, results);
      return results;
    });
  }

  // ========================
  // Batch Operations
  // ========================

  async createEntries(entries: KBEntryInput[]): Promise<string[]> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('createEntries', async () => {
      const ids = await this.adapter.createEntries(entries);

      // Invalidate caches
      await this.cacheManager.invalidatePattern('search:*');
      await this.cacheManager.invalidatePattern('stats:*');

      return ids;
    });
  }

  async readEntries(ids: string[]): Promise<KBEntry[]> {
    this.ensureInitialized();

    // Try to get from cache first
    const cachedEntries: (KBEntry | null)[] = await Promise.all(
      ids.map(id => this.cacheManager.get(`entry:${id}`))
    );

    const missedIds: string[] = [];
    const results: KBEntry[] = [];

    cachedEntries.forEach((entry, index) => {
      if (entry) {
        results[index] = entry;
      } else {
        missedIds.push(ids[index]);
      }
    });

    if (missedIds.length > 0) {
      const fetchedEntries = await this.adapter.readEntries(missedIds);

      // Cache the fetched entries
      await Promise.all(
        fetchedEntries.map(entry =>
          entry ? this.cacheManager.set(`entry:${entry.id}`, entry, 300000) : Promise.resolve()
        )
      );

      // Merge results
      let fetchIndex = 0;
      for (let i = 0; i < cachedEntries.length; i++) {
        if (!cachedEntries[i]) {
          results[i] = fetchedEntries[fetchIndex++];
        }
      }
    }

    return results.filter(Boolean);
  }

  async updateEntries(updates: Array<{ id: string; updates: KBEntryUpdate }>): Promise<boolean[]> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('updateEntries', async () => {
      const results = await this.adapter.updateEntries(updates);

      // Invalidate cache for updated entries
      await Promise.all(updates.map(({ id }) => this.cacheManager.delete(`entry:${id}`)));
      await this.cacheManager.invalidatePattern('search:*');

      return results;
    });
  }

  async deleteEntries(ids: string[]): Promise<boolean[]> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('deleteEntries', async () => {
      const results = await this.adapter.deleteEntries(ids);

      // Invalidate cache for deleted entries
      await Promise.all(ids.map(id => this.cacheManager.delete(`entry:${id}`)));
      await this.cacheManager.invalidatePattern('search:*');

      return results;
    });
  }

  // ========================
  // Pattern Storage (MVP2)
  // ========================

  async createPattern(pattern: PatternData): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    const id = await plugin.createPattern(pattern);

    this.emit('pattern:detected', { ...pattern, id } as Pattern);
    return id;
  }

  async getPatterns(criteria: PatternCriteria): Promise<Pattern[]> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    return plugin.getPatterns(criteria);
  }

  async updatePattern(id: string, updates: PatternUpdate): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    return plugin.updatePattern(id, updates);
  }

  async deletePattern(id: string): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    return plugin.deletePattern(id);
  }

  // ========================
  // Incident Storage (MVP2)
  // ========================

  async createIncident(incident: IncidentData): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    const id = await plugin.createIncident(incident);

    this.emit('incident:created', { ...incident, id } as Incident);
    return id;
  }

  async getIncidents(criteria: IncidentCriteria): Promise<Incident[]> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    return plugin.getIncidents(criteria);
  }

  async updateIncident(id: string, updates: IncidentUpdate): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    return plugin.updateIncident(id, updates);
  }

  async linkIncidentToPattern(incidentId: string, patternId: string): Promise<void> {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);

    const plugin = this.getPlugin('pattern-detection') as PatternDetectionPlugin;
    return plugin.linkIncidentToPattern(incidentId, patternId);
  }

  // ========================
  // Code Storage (MVP3)
  // ========================

  async storeCodeAnalysis(analysis: CodeAnalysis): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    const id = await plugin.storeCodeAnalysis(analysis);

    this.emit('code:analyzed', analysis);
    return id;
  }

  async getCodeAnalysis(criteria: CodeCriteria): Promise<CodeAnalysis[]> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    return plugin.getCodeAnalysis(criteria);
  }

  async linkCodeToKB(codeId: string, kbId: string, linkType: LinkType): Promise<void> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    return plugin.linkCodeToKB(codeId, kbId, linkType);
  }

  async updateCodeAnalysis(id: string, updates: CodeAnalysisUpdate): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    return plugin.updateCodeAnalysis(id, updates);
  }

  async createRepository(repo: RepositoryData): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    return plugin.createRepository(repo);
  }

  async getRepositories(): Promise<Repository[]> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    return plugin.getRepositories();
  }

  async scanRepository(repoId: string): Promise<ScanResult> {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);

    const plugin = this.getPlugin('code-analysis') as CodeAnalysisPlugin;
    return plugin.scanRepository(repoId);
  }

  // ========================
  // Template Storage (MVP4)
  // ========================

  async storeTemplate(template: CodeTemplate): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    const id = await plugin.storeTemplate(template);

    this.emit('template:generated', template);
    return id;
  }

  async getTemplates(criteria: TemplateCriteria): Promise<CodeTemplate[]> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    return plugin.getTemplates(criteria);
  }

  async updateTemplate(id: string, updates: TemplateUpdate): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    return plugin.updateTemplate(id, updates);
  }

  async generateTemplate(sourceCode: string, metadata: TemplateMetadata): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    return plugin.generateTemplate(sourceCode, metadata);
  }

  // ========================
  // Project Management (MVP4)
  // ========================

  async createProject(project: ProjectData): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    return plugin.createProject(project);
  }

  async getProjects(criteria: ProjectCriteria): Promise<Project[]> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    return plugin.getProjects(criteria);
  }

  async updateProject(id: string, updates: ProjectUpdate): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);

    const plugin = this.getPlugin('template-engine') as TemplateEnginePlugin;
    return plugin.updateProject(id, updates);
  }

  // ========================
  // Analytics Storage (MVP5)
  // ========================

  async storePrediction(prediction: PredictionData): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);

    const plugin = this.getPlugin('analytics') as AnalyticsPlugin;
    const id = await plugin.storePrediction(prediction);

    this.emit('prediction:made', { ...prediction, id } as Prediction);
    return id;
  }

  async getPredictions(criteria: PredictionCriteria): Promise<Prediction[]> {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);

    const plugin = this.getPlugin('analytics') as AnalyticsPlugin;
    return plugin.getPredictions(criteria);
  }

  async getAnalytics(timeRange: TimeRange, metrics: string[]): Promise<AnalyticsData> {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);

    const plugin = this.getPlugin('analytics') as AnalyticsPlugin;
    return plugin.getAnalytics(timeRange, metrics);
  }

  async storeModel(model: MLModelData): Promise<string> {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);

    const plugin = this.getPlugin('analytics') as AnalyticsPlugin;
    return plugin.storeModel(model);
  }

  async getModel(id: string): Promise<MLModel | null> {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);

    const plugin = this.getPlugin('analytics') as AnalyticsPlugin;
    return plugin.getModel(id);
  }

  async updateModelMetrics(id: string, metrics: ModelMetrics): Promise<boolean> {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);

    const plugin = this.getPlugin('analytics') as AnalyticsPlugin;
    return plugin.updateModelMetrics(id, metrics);
  }

  // ========================
  // Cross-MVP Operations
  // ========================

  async backup(options?: BackupOptions): Promise<BackupResult> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('backup', async () => {
      const result = await this.backupService.createBackup(options);
      this.emit('backup:completed', result);
      return result;
    });
  }

  async restore(backupPath: string, options?: RestoreOptions): Promise<RestoreResult> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('restore', async () => {
      const result = await this.backupService.restore(backupPath, options);

      // Clear all caches after restore
      await this.cacheManager.clear();

      return result;
    });
  }

  async export(format: ExportFormat, options?: ExportOptions): Promise<string> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('export', async () => {
      return this.adapter.export(format, options);
    });
  }

  async import(data: string, format: ImportFormat, options?: ImportOptions): Promise<ImportResult> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('import', async () => {
      const result = await this.adapter.import(data, format, options);

      // Clear caches after import
      await this.cacheManager.clear();

      return result;
    });
  }

  async migrate(targetVersion: string): Promise<MigrationResult[]> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('migrate', async () => {
      const results = await this.migrationService.migrateToVersion(targetVersion);

      // Update config version
      this.config.mvp.version = targetVersion as any;

      // Reload plugins for new version
      await this.loadMVPPlugins();

      // Clear caches after migration
      await this.cacheManager.clear();

      this.emit('migration:completed', results);
      return results;
    });
  }

  // ========================
  // Performance & Monitoring
  // ========================

  async getMetrics(): Promise<StorageMetrics> {
    this.ensureInitialized();

    const cacheKey = 'metrics:storage';
    return this.cacheManager.getOrSet(
      cacheKey,
      async () => {
        const databaseMetrics = await this.adapter.getMetrics();
        const performanceMetrics = this.performanceMonitor.getMetrics();
        const cacheMetrics = this.cacheManager.getMetrics();
        const backupMetrics = this.backupService.getMetrics();

        return {
          database: databaseMetrics,
          performance: performanceMetrics,
          usage: await this.calculateUsageMetrics(),
          cache: cacheMetrics,
          backup: backupMetrics,
        };
      },
      60000
    ); // 1 minute cache
  }

  async optimize(): Promise<OptimizationResult> {
    this.ensureInitialized();

    return this.performanceMonitor.measureOperation('optimize', async () => {
      const result = await this.adapter.optimize();

      // Clear caches after optimization
      await this.cacheManager.clear();

      this.emit('optimization:completed', result);
      return result;
    });
  }

  async healthCheck(): Promise<HealthStatus> {
    this.ensureInitialized();

    const checks = await Promise.allSettled([
      this.adapter.healthCheck(),
      this.performanceMonitor.healthCheck(),
      this.cacheManager.healthCheck(),
      this.backupService.healthCheck(),
    ]);

    const issues: any[] = [];
    const components: any[] = [];

    checks.forEach((check, index) => {
      const componentName = ['adapter', 'performance', 'cache', 'backup'][index];

      if (check.status === 'fulfilled') {
        components.push({
          name: componentName,
          status: check.value.status,
          uptime: check.value.uptime || 0,
          lastCheck: new Date(),
          metrics: check.value.metrics || {},
        });

        if (check.value.issues) {
          issues.push(...check.value.issues);
        }
      } else {
        components.push({
          name: componentName,
          status: 'critical',
          uptime: 0,
          lastCheck: new Date(),
          metrics: {},
        });

        issues.push({
          severity: 'critical',
          component: componentName,
          message: check.reason?.message || 'Health check failed',
          recommendations: ['Check component logs', 'Restart component'],
        });
      }
    });

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warningIssues = issues.filter(i => i.severity === 'warning');

    const overall =
      criticalIssues.length > 0 ? 'critical' : warningIssues.length > 0 ? 'warning' : 'healthy';

    const status: HealthStatus = {
      overall,
      components,
      issues,
      recommendations: this.generateHealthRecommendations(issues),
    };

    if (overall !== 'healthy') {
      this.emit(overall === 'critical' ? 'health:critical' : 'health:warning', issues[0]);
    }

    return status;
  }

  // ========================
  // Plugin Management
  // ========================

  async loadPlugin(plugin: IStoragePlugin): Promise<void> {
    this.ensureInitialized();

    try {
      console.log(`📦 Loading plugin: ${plugin.name} v${plugin.version}`);

      // Check dependencies
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin dependency not met: ${dep}`);
        }
      }

      // Initialize plugin
      await plugin.initialize(
        this,
        this.config.mvp.extensions.find(e => e.name === plugin.name)?.config || {}
      );

      // Apply schema extensions
      const schemaExtensions = plugin.getSchemaExtensions();
      for (const extension of schemaExtensions) {
        await this.adapter.executeSQL(extension.schema);

        if (extension.indexes) {
          for (const index of extension.indexes) {
            await this.adapter.executeSQL(index);
          }
        }
      }

      // Register data operations
      const dataOps = plugin.getDataOperations();
      for (const op of dataOps) {
        this.registerDataOperation(op.name, op.handler, op.validation);
      }

      // Register event handlers
      const eventHandlers = plugin.getEventHandlers();
      for (const handler of eventHandlers) {
        this.on(handler.event, handler.handler);
      }

      // Start plugin
      await plugin.start();

      this.plugins.set(plugin.name, plugin);
      this.emit('plugin:loaded', plugin.name);

      console.log(`✅ Plugin loaded: ${plugin.name}`);
    } catch (error) {
      console.error(`❌ Failed to load plugin ${plugin.name}:`, error);
      this.emit('plugin:error', plugin.name, error as Error);
      throw error;
    }
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    try {
      await plugin.stop();
      this.plugins.delete(pluginName);
      this.emit('plugin:unloaded', pluginName);
      console.log(`📤 Plugin unloaded: ${pluginName}`);
    } catch (error) {
      console.error(`❌ Failed to unload plugin ${pluginName}:`, error);
      this.emit('plugin:error', pluginName, error as Error);
      throw error;
    }
  }

  getLoadedPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  // ========================
  // Private Helper Methods
  // ========================

  private async loadMVPPlugins(): Promise<void> {
    const mvpVersion = parseInt(this.config.mvp.version);
    const features = this.config.mvp.features;

    // Load plugins based on MVP version and enabled features
    if (mvpVersion >= 2 && features.patternDetection) {
      await this.loadPlugin(new PatternDetectionPlugin());
    }

    if (mvpVersion >= 3 && features.codeAnalysis) {
      await this.loadPlugin(new CodeAnalysisPlugin());
    }

    if (mvpVersion >= 4 && features.templateEngine) {
      await this.loadPlugin(new TemplateEnginePlugin());
    }

    if (mvpVersion >= 5 && features.predictiveAnalytics) {
      await this.loadPlugin(new AnalyticsPlugin());
    }
  }

  private validateMVPFeature(feature: keyof MVPFeatureConfig, minVersion: number): void {
    const currentVersion = parseInt(this.config.mvp.version);

    if (currentVersion < minVersion) {
      throw new Error(
        `Feature ${feature} requires MVP${minVersion} or higher. Current: MVP${currentVersion}`
      );
    }

    if (!this.config.mvp.features[feature]) {
      throw new Error(`Feature ${feature} is not enabled in configuration`);
    }
  }

  private getPlugin(name: string): IStoragePlugin {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not loaded: ${name}`);
    }
    return plugin;
  }

  private generateSearchCacheKey(query: string, options?: SearchOptions): string {
    const key = [
      query.toLowerCase().trim(),
      options?.limit || 10,
      options?.offset || 0,
      options?.category || 'all',
      JSON.stringify(options?.tags || []),
      options?.sortBy || 'relevance',
    ].join(':');

    return Buffer.from(key).toString('base64').substring(0, 50);
  }

  private calculateSearchCacheTTL(options?: SearchOptions): number {
    // Longer TTL for category/tag searches (more stable)
    if (options?.category || (options?.tags && options.tags.length > 0)) {
      return 600000; // 10 minutes
    }

    // Shorter TTL for text searches (content may change)
    return 300000; // 5 minutes
  }

  private async calculateUsageMetrics(): Promise<any> {
    // This would typically aggregate usage data from the adapter
    return {
      totalOperations: 0,
      operationsByType: {},
      activeUsers: 0,
      dataGrowth: {
        entries: 0,
        size: 0,
      },
    };
  }

  private generateHealthRecommendations(issues: any[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.component === 'cache')) {
      recommendations.push('Consider increasing cache size or TTL');
    }

    if (issues.some(i => i.component === 'performance')) {
      recommendations.push('Run optimization to improve performance');
    }

    if (issues.some(i => i.component === 'backup')) {
      recommendations.push('Check backup configuration and storage');
    }

    return recommendations;
  }

  private registerDataOperation(name: string, handler: Function, validation?: Function): void {
    // Register custom data operation
    // This would be used by plugins to extend functionality
  }

  private async logInitializationStats(): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      console.log(`📊 Storage Service ready:`);
      console.log(
        `   Database: ${metrics.database.tableCount} tables, ${this.formatBytes(metrics.database.size)}`
      );
      console.log(`   Plugins: ${this.getLoadedPlugins().join(', ')}`);
      console.log(`   Performance: ${metrics.performance.responseTime.p95}ms P95 response time`);
    } catch (error) {
      console.warn('Could not log initialization stats:', error);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export factory function for easy initialization
export async function createStorageService(config: StorageConfig): Promise<StorageService> {
  const service = new StorageService();
  await service.initialize(config);
  return service;
}
