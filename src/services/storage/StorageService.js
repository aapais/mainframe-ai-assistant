'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StorageService = void 0;
exports.createStorageService = createStorageService;
const events_1 = require('events');
const StorageFactory_1 = require('./StorageFactory');
const PatternDetectionPlugin_1 = require('./plugins/PatternDetectionPlugin');
const CodeAnalysisPlugin_1 = require('./plugins/CodeAnalysisPlugin');
const TemplateEnginePlugin_1 = require('./plugins/TemplateEnginePlugin');
const AnalyticsPlugin_1 = require('./plugins/AnalyticsPlugin');
const BackupService_1 = require('./backup/BackupService');
const MigrationService_1 = require('./MigrationService');
const PerformanceMonitor_1 = require('./PerformanceMonitor');
const CacheManager_1 = require('./CacheManager');
class StorageService extends events_1.EventEmitter {
  adapter;
  config;
  plugins = new Map();
  backupService;
  migrationService;
  performanceMonitor;
  cacheManager;
  initialized = false;
  constructor() {
    super();
    this.setMaxListeners(50);
  }
  async initialize(config) {
    try {
      console.log('🚀 Initializing Storage Service...');
      this.config = config;
      this.adapter = StorageFactory_1.StorageFactory.createAdapter(
        config.database.type,
        config.database
      );
      await this.adapter.initialize();
      this.backupService = new BackupService_1.BackupService(this.adapter, config.backup);
      this.migrationService = new MigrationService_1.MigrationService(
        this.adapter,
        config.mvp.version
      );
      this.performanceMonitor = new PerformanceMonitor_1.PerformanceMonitor(
        this.adapter,
        config.performance.monitoring
      );
      this.cacheManager = new CacheManager_1.CacheManager(config.performance.caching);
      const migrationResults = await this.migrationService.migrateToVersion(config.mvp.version);
      if (migrationResults.some(r => !r.success)) {
        console.warn('⚠️ Some migrations failed, continuing with current schema');
      }
      await this.loadMVPPlugins();
      await this.performanceMonitor.start();
      await this.cacheManager.initialize();
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
  async close() {
    if (!this.initialized) return;
    console.log('🔄 Closing Storage Service...');
    if (this.performanceMonitor) {
      await this.performanceMonitor.stop();
    }
    if (this.cacheManager) {
      await this.cacheManager.close();
    }
    if (this.backupService) {
      await this.backupService.stop();
    }
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.stop();
        console.log(`📤 Unloaded plugin: ${name}`);
      } catch (error) {
        console.warn(`⚠️ Error unloading plugin ${name}:`, error);
      }
    }
    this.plugins.clear();
    if (this.adapter) {
      await this.adapter.close();
    }
    this.initialized = false;
    this.emit('storage:closed');
    console.log('✅ Storage Service closed');
  }
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Storage Service not initialized. Call initialize() first.');
    }
  }
  async createEntry(entry) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('createEntry', async () => {
      const id = await this.adapter.createEntry(entry);
      await this.cacheManager.invalidatePattern('search:*');
      await this.cacheManager.invalidatePattern('stats:*');
      this.emit('entry:created', { ...entry, id });
      return id;
    });
  }
  async readEntry(id) {
    this.ensureInitialized();
    const cacheKey = `entry:${id}`;
    return this.cacheManager.getOrSet(
      cacheKey,
      async () => {
        return this.adapter.readEntry(id);
      },
      300000
    );
  }
  async updateEntry(id, updates) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('updateEntry', async () => {
      const success = await this.adapter.updateEntry(id, updates);
      if (success) {
        await this.cacheManager.delete(`entry:${id}`);
        await this.cacheManager.invalidatePattern('search:*');
        this.emit('entry:updated', id, updates);
      }
      return success;
    });
  }
  async deleteEntry(id) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('deleteEntry', async () => {
      const success = await this.adapter.deleteEntry(id);
      if (success) {
        await this.cacheManager.delete(`entry:${id}`);
        await this.cacheManager.invalidatePattern('search:*');
        this.emit('entry:deleted', id);
      }
      return success;
    });
  }
  async searchEntries(query, options) {
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
  async createEntries(entries) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('createEntries', async () => {
      const ids = await this.adapter.createEntries(entries);
      await this.cacheManager.invalidatePattern('search:*');
      await this.cacheManager.invalidatePattern('stats:*');
      return ids;
    });
  }
  async readEntries(ids) {
    this.ensureInitialized();
    const cachedEntries = await Promise.all(ids.map(id => this.cacheManager.get(`entry:${id}`)));
    const missedIds = [];
    const results = [];
    cachedEntries.forEach((entry, index) => {
      if (entry) {
        results[index] = entry;
      } else {
        missedIds.push(ids[index]);
      }
    });
    if (missedIds.length > 0) {
      const fetchedEntries = await this.adapter.readEntries(missedIds);
      await Promise.all(
        fetchedEntries.map(entry =>
          entry ? this.cacheManager.set(`entry:${entry.id}`, entry, 300000) : Promise.resolve()
        )
      );
      let fetchIndex = 0;
      for (let i = 0; i < cachedEntries.length; i++) {
        if (!cachedEntries[i]) {
          results[i] = fetchedEntries[fetchIndex++];
        }
      }
    }
    return results.filter(Boolean);
  }
  async updateEntries(updates) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('updateEntries', async () => {
      const results = await this.adapter.updateEntries(updates);
      await Promise.all(updates.map(({ id }) => this.cacheManager.delete(`entry:${id}`)));
      await this.cacheManager.invalidatePattern('search:*');
      return results;
    });
  }
  async deleteEntries(ids) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('deleteEntries', async () => {
      const results = await this.adapter.deleteEntries(ids);
      await Promise.all(ids.map(id => this.cacheManager.delete(`entry:${id}`)));
      await this.cacheManager.invalidatePattern('search:*');
      return results;
    });
  }
  async createPattern(pattern) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    const id = await plugin.createPattern(pattern);
    this.emit('pattern:detected', { ...pattern, id });
    return id;
  }
  async getPatterns(criteria) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    return plugin.getPatterns(criteria);
  }
  async updatePattern(id, updates) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    return plugin.updatePattern(id, updates);
  }
  async deletePattern(id) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    return plugin.deletePattern(id);
  }
  async createIncident(incident) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    const id = await plugin.createIncident(incident);
    this.emit('incident:created', { ...incident, id });
    return id;
  }
  async getIncidents(criteria) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    return plugin.getIncidents(criteria);
  }
  async updateIncident(id, updates) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    return plugin.updateIncident(id, updates);
  }
  async linkIncidentToPattern(incidentId, patternId) {
    this.ensureInitialized();
    this.validateMVPFeature('patternDetection', 2);
    const plugin = this.getPlugin('pattern-detection');
    return plugin.linkIncidentToPattern(incidentId, patternId);
  }
  async storeCodeAnalysis(analysis) {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    const id = await plugin.storeCodeAnalysis(analysis);
    this.emit('code:analyzed', analysis);
    return id;
  }
  async getCodeAnalysis(criteria) {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    return plugin.getCodeAnalysis(criteria);
  }
  async linkCodeToKB(codeId, kbId, linkType) {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    return plugin.linkCodeToKB(codeId, kbId, linkType);
  }
  async updateCodeAnalysis(id, updates) {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    return plugin.updateCodeAnalysis(id, updates);
  }
  async createRepository(repo) {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    return plugin.createRepository(repo);
  }
  async getRepositories() {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    return plugin.getRepositories();
  }
  async scanRepository(repoId) {
    this.ensureInitialized();
    this.validateMVPFeature('codeAnalysis', 3);
    const plugin = this.getPlugin('code-analysis');
    return plugin.scanRepository(repoId);
  }
  async storeTemplate(template) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    const id = await plugin.storeTemplate(template);
    this.emit('template:generated', template);
    return id;
  }
  async getTemplates(criteria) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    return plugin.getTemplates(criteria);
  }
  async updateTemplate(id, updates) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    return plugin.updateTemplate(id, updates);
  }
  async generateTemplate(sourceCode, metadata) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    return plugin.generateTemplate(sourceCode, metadata);
  }
  async createProject(project) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    return plugin.createProject(project);
  }
  async getProjects(criteria) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    return plugin.getProjects(criteria);
  }
  async updateProject(id, updates) {
    this.ensureInitialized();
    this.validateMVPFeature('templateEngine', 4);
    const plugin = this.getPlugin('template-engine');
    return plugin.updateProject(id, updates);
  }
  async storePrediction(prediction) {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);
    const plugin = this.getPlugin('analytics');
    const id = await plugin.storePrediction(prediction);
    this.emit('prediction:made', { ...prediction, id });
    return id;
  }
  async getPredictions(criteria) {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);
    const plugin = this.getPlugin('analytics');
    return plugin.getPredictions(criteria);
  }
  async getAnalytics(timeRange, metrics) {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);
    const plugin = this.getPlugin('analytics');
    return plugin.getAnalytics(timeRange, metrics);
  }
  async storeModel(model) {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);
    const plugin = this.getPlugin('analytics');
    return plugin.storeModel(model);
  }
  async getModel(id) {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);
    const plugin = this.getPlugin('analytics');
    return plugin.getModel(id);
  }
  async updateModelMetrics(id, metrics) {
    this.ensureInitialized();
    this.validateMVPFeature('predictiveAnalytics', 5);
    const plugin = this.getPlugin('analytics');
    return plugin.updateModelMetrics(id, metrics);
  }
  async backup(options) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('backup', async () => {
      const result = await this.backupService.createBackup(options);
      this.emit('backup:completed', result);
      return result;
    });
  }
  async restore(backupPath, options) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('restore', async () => {
      const result = await this.backupService.restore(backupPath, options);
      await this.cacheManager.clear();
      return result;
    });
  }
  async export(format, options) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('export', async () => {
      return this.adapter.export(format, options);
    });
  }
  async import(data, format, options) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('import', async () => {
      const result = await this.adapter.import(data, format, options);
      await this.cacheManager.clear();
      return result;
    });
  }
  async migrate(targetVersion) {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('migrate', async () => {
      const results = await this.migrationService.migrateToVersion(targetVersion);
      this.config.mvp.version = targetVersion;
      await this.loadMVPPlugins();
      await this.cacheManager.clear();
      this.emit('migration:completed', results);
      return results;
    });
  }
  async getMetrics() {
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
    );
  }
  async optimize() {
    this.ensureInitialized();
    return this.performanceMonitor.measureOperation('optimize', async () => {
      const result = await this.adapter.optimize();
      await this.cacheManager.clear();
      this.emit('optimization:completed', result);
      return result;
    });
  }
  async healthCheck() {
    this.ensureInitialized();
    const checks = await Promise.allSettled([
      this.adapter.healthCheck(),
      this.performanceMonitor.healthCheck(),
      this.cacheManager.healthCheck(),
      this.backupService.healthCheck(),
    ]);
    const issues = [];
    const components = [];
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
    const status = {
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
  async loadPlugin(plugin) {
    this.ensureInitialized();
    try {
      console.log(`📦 Loading plugin: ${plugin.name} v${plugin.version}`);
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin dependency not met: ${dep}`);
        }
      }
      await plugin.initialize(
        this,
        this.config.mvp.extensions.find(e => e.name === plugin.name)?.config || {}
      );
      const schemaExtensions = plugin.getSchemaExtensions();
      for (const extension of schemaExtensions) {
        await this.adapter.executeSQL(extension.schema);
        if (extension.indexes) {
          for (const index of extension.indexes) {
            await this.adapter.executeSQL(index);
          }
        }
      }
      const dataOps = plugin.getDataOperations();
      for (const op of dataOps) {
        this.registerDataOperation(op.name, op.handler, op.validation);
      }
      const eventHandlers = plugin.getEventHandlers();
      for (const handler of eventHandlers) {
        this.on(handler.event, handler.handler);
      }
      await plugin.start();
      this.plugins.set(plugin.name, plugin);
      this.emit('plugin:loaded', plugin.name);
      console.log(`✅ Plugin loaded: ${plugin.name}`);
    } catch (error) {
      console.error(`❌ Failed to load plugin ${plugin.name}:`, error);
      this.emit('plugin:error', plugin.name, error);
      throw error;
    }
  }
  async unloadPlugin(pluginName) {
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
      this.emit('plugin:error', pluginName, error);
      throw error;
    }
  }
  getLoadedPlugins() {
    return Array.from(this.plugins.keys());
  }
  async loadMVPPlugins() {
    const mvpVersion = parseInt(this.config.mvp.version);
    const features = this.config.mvp.features;
    if (mvpVersion >= 2 && features.patternDetection) {
      await this.loadPlugin(new PatternDetectionPlugin_1.PatternDetectionPlugin());
    }
    if (mvpVersion >= 3 && features.codeAnalysis) {
      await this.loadPlugin(new CodeAnalysisPlugin_1.CodeAnalysisPlugin());
    }
    if (mvpVersion >= 4 && features.templateEngine) {
      await this.loadPlugin(new TemplateEnginePlugin_1.TemplateEnginePlugin());
    }
    if (mvpVersion >= 5 && features.predictiveAnalytics) {
      await this.loadPlugin(new AnalyticsPlugin_1.AnalyticsPlugin());
    }
  }
  validateMVPFeature(feature, minVersion) {
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
  getPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not loaded: ${name}`);
    }
    return plugin;
  }
  generateSearchCacheKey(query, options) {
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
  calculateSearchCacheTTL(options) {
    if (options?.category || (options?.tags && options.tags.length > 0)) {
      return 600000;
    }
    return 300000;
  }
  async calculateUsageMetrics() {
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
  generateHealthRecommendations(issues) {
    const recommendations = [];
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
  registerDataOperation(name, handler, validation) {}
  async logInitializationStats() {
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
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
exports.StorageService = StorageService;
async function createStorageService(config) {
  const service = new StorageService();
  await service.initialize(config);
  return service;
}
//# sourceMappingURL=StorageService.js.map
