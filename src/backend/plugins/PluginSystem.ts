/**
 * Plugin System Architecture for Backend Components
 * Extensible plugin system supporting MVP evolution from Knowledge Base to Enterprise AI
 */

import { EventEmitter } from 'events';
import { IBaseService, ServiceContext, ServiceHealth } from '../core/interfaces/ServiceInterfaces';

// ==============================
// Core Plugin Interfaces
// ==============================

export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly dependencies: string[];
  readonly hooks: string[];
  readonly mvpSupport: number[]; // Which MVPs this plugin supports

  initialize(context: PluginContext): Promise<void>;
  shutdown(): Promise<void>;
  getHooks(): string[];
  executeHook<T>(hookName: string, data: T): Promise<T>;
  getConfiguration(): PluginConfiguration;
  validateConfiguration(config: any): ValidationResult;
  healthCheck(): Promise<ServiceHealth>;
}

export interface PluginContext extends ServiceContext {
  pluginManager: IPluginManager;
  eventBus: IEventBus;
  hookRegistry: IHookRegistry;
  pluginConfig: PluginConfiguration;
  sharedStorage: IPluginStorage;
}

export interface IPluginManager extends IBaseService {
  // Plugin lifecycle
  loadPlugin(pluginName: string, config?: any): Promise<void>;
  unloadPlugin(pluginName: string): Promise<void>;
  reloadPlugin(pluginName: string): Promise<void>;
  enablePlugin(pluginName: string): Promise<void>;
  disablePlugin(pluginName: string): Promise<void>;

  // Plugin discovery
  discoverPlugins(searchPaths: string[]): Promise<PluginManifest[]>;
  getPluginManifest(pluginName: string): PluginManifest | null;
  getInstalledPlugins(): PluginInfo[];
  getEnabledPlugins(): PluginInfo[];

  // Hook execution
  executeHook<T>(hookName: string, data: T): Promise<T>;
  executeHookParallel<T>(hookName: string, data: T): Promise<T[]>;
  executeHookWaterfall<T>(hookName: string, data: T): Promise<T>;

  // Plugin communication
  sendMessage(targetPlugin: string, message: PluginMessage): Promise<PluginResponse>;
  broadcastMessage(message: PluginMessage, excludePlugins?: string[]): Promise<PluginResponse[]>;

  // Configuration management
  getPluginConfig(pluginName: string): PluginConfiguration;
  updatePluginConfig(pluginName: string, config: Partial<PluginConfiguration>): Promise<void>;

  // Security and validation
  validatePlugin(pluginPath: string): Promise<PluginValidationResult>;
  checkPermissions(pluginName: string, permission: string): boolean;
  sandboxPlugin(pluginName: string): Promise<PluginSandbox>;
}

export interface IEventBus extends EventEmitter {
  // Enhanced event system for plugins
  onHook(hookName: string, listener: HookListener): void;
  emitHook<T>(hookName: string, data: T): Promise<T>;
  offHook(hookName: string, listener: HookListener): void;

  // Plugin-specific events
  emitPluginEvent(pluginName: string, eventName: string, data: any): void;
  onPluginEvent(pluginName: string, eventName: string, listener: EventListener): void;

  // System events
  emitSystemEvent(eventName: string, data: any): void;
  onSystemEvent(eventName: string, listener: EventListener): void;
}

export interface IHookRegistry {
  registerHook(hookName: string, plugin: IPlugin, priority?: number): void;
  unregisterHook(hookName: string, plugin: IPlugin): void;
  getHookPlugins(hookName: string): HookRegistration[];
  getAllHooks(): string[];
  getHookDescription(hookName: string): HookDescription | null;
}

// ==============================
// Plugin Manager Implementation
// ==============================

export class PluginManager extends EventEmitter implements IPluginManager {
  public readonly name = 'plugin-manager';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];

  private readonly plugins: Map<string, LoadedPlugin> = new Map();
  private readonly hookRegistry: IHookRegistry;
  private readonly eventBus: IEventBus;
  private readonly config: PluginManagerConfig;
  private readonly pluginStorage: IPluginStorage;
  private readonly securityManager: PluginSecurityManager;
  private context!: PluginContext;

  constructor(config: PluginManagerConfig) {
    super();
    this.config = config;
    this.hookRegistry = new HookRegistry();
    this.eventBus = new EventBus();
    this.pluginStorage = new PluginStorage(config.storage);
    this.securityManager = new PluginSecurityManager(config.security);
  }

  async initialize(context: ServiceContext): Promise<void> {
    this.context = {
      ...context,
      pluginManager: this,
      eventBus: this.eventBus,
      hookRegistry: this.hookRegistry,
      pluginConfig: {},
      sharedStorage: this.pluginStorage
    };

    // Load enabled plugins from configuration
    for (const pluginConfig of this.config.enabledPlugins) {
      try {
        await this.loadPlugin(pluginConfig.name, pluginConfig.config);
      } catch (error) {
        this.context.logger.error(
          `Failed to load plugin: ${pluginConfig.name}`,
          error as Error
        );
      }
    }

    this.setupSystemHooks();
    this.emit('plugin-manager:initialized');
  }

  async shutdown(): Promise<void> {
    const pluginNames = Array.from(this.plugins.keys());

    // Shutdown plugins in reverse dependency order
    const shutdownOrder = this.calculateShutdownOrder(pluginNames);

    for (const pluginName of shutdownOrder) {
      try {
        await this.unloadPlugin(pluginName);
      } catch (error) {
        this.context.logger.error(
          `Failed to shutdown plugin: ${pluginName}`,
          error as Error
        );
      }
    }

    this.emit('plugin-manager:shutdown');
  }

  async healthCheck(): Promise<ServiceHealth> {
    const unhealthyPlugins: string[] = [];
    const pluginHealths: Record<string, ServiceHealth> = {};

    for (const [name, loadedPlugin] of this.plugins) {
      try {
        const health = await loadedPlugin.plugin.healthCheck();
        pluginHealths[name] = health;

        if (!health.healthy) {
          unhealthyPlugins.push(name);
        }
      } catch (error) {
        unhealthyPlugins.push(name);
        pluginHealths[name] = {
          healthy: false,
          error: (error as Error).message,
          lastCheck: new Date()
        };
      }
    }

    return {
      healthy: unhealthyPlugins.length === 0,
      details: {
        totalPlugins: this.plugins.size,
        healthyPlugins: this.plugins.size - unhealthyPlugins.length,
        unhealthyPlugins,
        pluginHealths
      },
      lastCheck: new Date()
    };
  }

  // Plugin Discovery and Loading

  async discoverPlugins(searchPaths: string[]): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];
    const fs = await import('fs');
    const path = await import('path');

    for (const searchPath of searchPaths) {
      try {
        if (!fs.existsSync(searchPath)) continue;

        const entries = fs.readdirSync(searchPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const manifestPath = path.join(searchPath, entry.name, 'plugin.json');

            if (fs.existsSync(manifestPath)) {
              const manifestContent = fs.readFileSync(manifestPath, 'utf8');
              const manifest = JSON.parse(manifestContent) as PluginManifest;
              manifest.path = path.join(searchPath, entry.name);
              manifests.push(manifest);
            }
          }
        }
      } catch (error) {
        this.context.logger.warn(
          `Failed to discover plugins in ${searchPath}`,
          error as Error
        );
      }
    }

    return manifests;
  }

  async loadPlugin(pluginName: string, config?: any): Promise<void> {
    if (this.plugins.has(pluginName)) {
      throw new PluginError(`Plugin ${pluginName} is already loaded`);
    }

    try {
      // Discover plugin
      const manifest = await this.findPluginManifest(pluginName);
      if (!manifest) {
        throw new PluginError(`Plugin ${pluginName} not found`);
      }

      // Validate plugin
      const validationResult = await this.validatePlugin(manifest.path!);
      if (!validationResult.valid) {
        throw new PluginError(
          `Plugin validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      // Load plugin module
      const pluginModule = await import(manifest.main || `${manifest.path}/index.js`);
      const PluginClass = pluginModule.default || pluginModule[manifest.className || 'Plugin'];

      if (!PluginClass) {
        throw new PluginError(`Plugin class not found in ${pluginName}`);
      }

      // Create plugin instance
      const plugin: IPlugin = new PluginClass(config || {});

      // Validate plugin interface
      this.validatePluginInterface(plugin);

      // Check dependencies
      await this.checkPluginDependencies(plugin);

      // Create plugin context
      const pluginContext: PluginContext = {
        ...this.context,
        pluginConfig: config || {}
      };

      // Initialize plugin
      await plugin.initialize(pluginContext);

      // Register hooks
      const hooks = plugin.getHooks();
      hooks.forEach(hook => {
        this.hookRegistry.registerHook(hook, plugin);
      });

      // Store loaded plugin
      const loadedPlugin: LoadedPlugin = {
        plugin,
        manifest,
        config: config || {},
        loadedAt: new Date(),
        enabled: true,
        hooks,
        sandbox: this.config.security.enableSandboxing
          ? await this.sandboxPlugin(pluginName)
          : null
      };

      this.plugins.set(pluginName, loadedPlugin);

      this.emit('plugin:loaded', { name: pluginName, plugin: loadedPlugin });
      this.context.logger.info(`Plugin loaded successfully: ${pluginName}`);

    } catch (error) {
      this.emit('plugin:load-failed', { name: pluginName, error });
      throw error;
    }
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginName);
    if (!loadedPlugin) {
      throw new PluginError(`Plugin ${pluginName} is not loaded`);
    }

    try {
      // Unregister hooks
      loadedPlugin.hooks.forEach(hook => {
        this.hookRegistry.unregisterHook(hook, loadedPlugin.plugin);
      });

      // Shutdown plugin
      await loadedPlugin.plugin.shutdown();

      // Clean up sandbox if exists
      if (loadedPlugin.sandbox) {
        await loadedPlugin.sandbox.cleanup();
      }

      // Remove from loaded plugins
      this.plugins.delete(pluginName);

      this.emit('plugin:unloaded', { name: pluginName });
      this.context.logger.info(`Plugin unloaded successfully: ${pluginName}`);

    } catch (error) {
      this.emit('plugin:unload-failed', { name: pluginName, error });
      throw error;
    }
  }

  // Hook Execution

  async executeHook<T>(hookName: string, data: T): Promise<T> {
    const registrations = this.hookRegistry.getHookPlugins(hookName);

    if (registrations.length === 0) {
      return data;
    }

    let result = data;

    // Execute hooks in priority order (waterfall pattern)
    for (const registration of registrations) {
      const loadedPlugin = this.plugins.get(registration.plugin.name);

      if (!loadedPlugin || !loadedPlugin.enabled) {
        continue;
      }

      try {
        const startTime = Date.now();
        result = await registration.plugin.executeHook(hookName, result);
        const duration = Date.now() - startTime;

        this.recordHookExecution(hookName, registration.plugin.name, duration, true);

      } catch (error) {
        this.recordHookExecution(hookName, registration.plugin.name, 0, false);

        if (this.config.hooks.failurePolicy === 'stop') {
          throw error;
        } else {
          this.context.logger.warn(
            `Hook execution failed: ${hookName} in ${registration.plugin.name}`,
            error as Error
          );
        }
      }
    }

    return result;
  }

  async executeHookParallel<T>(hookName: string, data: T): Promise<T[]> {
    const registrations = this.hookRegistry.getHookPlugins(hookName);

    if (registrations.length === 0) {
      return [];
    }

    const promises = registrations.map(async registration => {
      const loadedPlugin = this.plugins.get(registration.plugin.name);

      if (!loadedPlugin || !loadedPlugin.enabled) {
        return data;
      }

      try {
        const startTime = Date.now();
        const result = await registration.plugin.executeHook(hookName, data);
        const duration = Date.now() - startTime;

        this.recordHookExecution(hookName, registration.plugin.name, duration, true);
        return result;

      } catch (error) {
        this.recordHookExecution(hookName, registration.plugin.name, 0, false);

        if (this.config.hooks.failurePolicy === 'stop') {
          throw error;
        } else {
          this.context.logger.warn(
            `Hook execution failed: ${hookName} in ${registration.plugin.name}`,
            error as Error
          );
          return data;
        }
      }
    });

    return Promise.all(promises);
  }

  async executeHookWaterfall<T>(hookName: string, data: T): Promise<T> {
    return this.executeHook(hookName, data);
  }

  // Plugin Communication

  async sendMessage(targetPlugin: string, message: PluginMessage): Promise<PluginResponse> {
    const loadedPlugin = this.plugins.get(targetPlugin);

    if (!loadedPlugin || !loadedPlugin.enabled) {
      throw new PluginError(`Plugin ${targetPlugin} is not available`);
    }

    // Check if plugin supports messaging
    if (typeof (loadedPlugin.plugin as any).handleMessage !== 'function') {
      throw new PluginError(`Plugin ${targetPlugin} does not support messaging`);
    }

    try {
      const response = await (loadedPlugin.plugin as any).handleMessage(message);
      return response;
    } catch (error) {
      throw new PluginError(
        `Message delivery failed to ${targetPlugin}: ${(error as Error).message}`
      );
    }
  }

  async broadcastMessage(
    message: PluginMessage,
    excludePlugins: string[] = []
  ): Promise<PluginResponse[]> {
    const responses: PluginResponse[] = [];
    const excludeSet = new Set(excludePlugins);

    for (const [pluginName, loadedPlugin] of this.plugins) {
      if (excludeSet.has(pluginName) || !loadedPlugin.enabled) {
        continue;
      }

      if (typeof (loadedPlugin.plugin as any).handleMessage === 'function') {
        try {
          const response = await (loadedPlugin.plugin as any).handleMessage(message);
          responses.push({ from: pluginName, ...response });
        } catch (error) {
          this.context.logger.warn(
            `Broadcast message failed for ${pluginName}`,
            error as Error
          );
        }
      }
    }

    return responses;
  }

  // Utility Methods

  getMetrics(): any {
    const pluginMetrics = Array.from(this.plugins.entries()).map(([name, loaded]) => ({
      name,
      enabled: loaded.enabled,
      loadedAt: loaded.loadedAt,
      hooks: loaded.hooks,
      version: loaded.plugin.version
    }));

    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: Array.from(this.plugins.values()).filter(p => p.enabled).length,
      plugins: pluginMetrics,
      hookRegistrations: this.hookRegistry.getAllHooks().length
    };
  }

  resetMetrics(): void {
    // Reset plugin-specific metrics
  }

  private async findPluginManifest(pluginName: string): Promise<PluginManifest | null> {
    const manifests = await this.discoverPlugins(this.config.searchPaths);
    return manifests.find(m => m.name === pluginName) || null;
  }

  private validatePluginInterface(plugin: any): void {
    const requiredMethods = ['initialize', 'shutdown', 'getHooks', 'executeHook', 'healthCheck'];
    const requiredProperties = ['name', 'version', 'dependencies', 'hooks'];

    for (const method of requiredMethods) {
      if (typeof plugin[method] !== 'function') {
        throw new PluginError(`Plugin missing required method: ${method}`);
      }
    }

    for (const prop of requiredProperties) {
      if (plugin[prop] === undefined) {
        throw new PluginError(`Plugin missing required property: ${prop}`);
      }
    }
  }

  private async checkPluginDependencies(plugin: IPlugin): Promise<void> {
    for (const dependency of plugin.dependencies) {
      if (!this.plugins.has(dependency)) {
        throw new PluginError(`Plugin dependency not met: ${dependency}`);
      }
    }
  }

  private calculateShutdownOrder(pluginNames: string[]): string[] {
    // Simple dependency-based shutdown order
    // More complex topological sorting would be implemented here
    return pluginNames.reverse();
  }

  private recordHookExecution(
    hookName: string,
    pluginName: string,
    duration: number,
    success: boolean
  ): void {
    // Record metrics for hook execution
    this.emit('hook:executed', {
      hookName,
      pluginName,
      duration,
      success,
      timestamp: new Date()
    });
  }

  private setupSystemHooks(): void {
    // Setup standard system hooks that plugins can use
    this.hookRegistry.registerHook('system:startup', this as any);
    this.hookRegistry.registerHook('system:shutdown', this as any);
    this.hookRegistry.registerHook('kb:entry:created', this as any);
    this.hookRegistry.registerHook('kb:entry:updated', this as any);
    this.hookRegistry.registerHook('kb:search:completed', this as any);
    this.hookRegistry.registerHook('performance:slow-query', this as any);
  }

  // Stub implementations for IPluginManager interface
  async reloadPlugin(pluginName: string): Promise<void> {
    await this.unloadPlugin(pluginName);
    await this.loadPlugin(pluginName);
  }

  async enablePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.enabled = true;
    }
  }

  async disablePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.enabled = false;
    }
  }

  getPluginManifest(pluginName: string): PluginManifest | null {
    const plugin = this.plugins.get(pluginName);
    return plugin ? plugin.manifest : null;
  }

  getInstalledPlugins(): PluginInfo[] {
    return Array.from(this.plugins.entries()).map(([name, loaded]) => ({
      name,
      version: loaded.plugin.version,
      description: loaded.manifest.description,
      enabled: loaded.enabled,
      loadedAt: loaded.loadedAt
    }));
  }

  getEnabledPlugins(): PluginInfo[] {
    return this.getInstalledPlugins().filter(p => p.enabled);
  }

  getPluginConfig(pluginName: string): PluginConfiguration {
    const plugin = this.plugins.get(pluginName);
    return plugin ? plugin.config : {};
  }

  async updatePluginConfig(pluginName: string, config: Partial<PluginConfiguration>): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.config = { ...plugin.config, ...config };
    }
  }

  async validatePlugin(pluginPath: string): Promise<PluginValidationResult> {
    return this.securityManager.validatePlugin(pluginPath);
  }

  checkPermissions(pluginName: string, permission: string): boolean {
    return this.securityManager.checkPermissions(pluginName, permission);
  }

  async sandboxPlugin(pluginName: string): Promise<PluginSandbox> {
    return this.securityManager.createSandbox(pluginName);
  }
}

// ==============================
// Supporting Classes
// ==============================

class HookRegistry implements IHookRegistry {
  private readonly hooks: Map<string, HookRegistration[]> = new Map();

  registerHook(hookName: string, plugin: IPlugin, priority = 0): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const registrations = this.hooks.get(hookName)!;
    registrations.push({ plugin, priority });

    // Sort by priority (higher priority first)
    registrations.sort((a, b) => b.priority - a.priority);
  }

  unregisterHook(hookName: string, plugin: IPlugin): void {
    const registrations = this.hooks.get(hookName);
    if (registrations) {
      const filtered = registrations.filter(r => r.plugin.name !== plugin.name);
      this.hooks.set(hookName, filtered);
    }
  }

  getHookPlugins(hookName: string): HookRegistration[] {
    return this.hooks.get(hookName) || [];
  }

  getAllHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  getHookDescription(hookName: string): HookDescription | null {
    // Would return hook documentation
    return null;
  }
}

class EventBus extends EventEmitter implements IEventBus {
  onHook(hookName: string, listener: HookListener): void {
    this.on(`hook:${hookName}`, listener);
  }

  async emitHook<T>(hookName: string, data: T): Promise<T> {
    this.emit(`hook:${hookName}`, data);
    return data;
  }

  offHook(hookName: string, listener: HookListener): void {
    this.off(`hook:${hookName}`, listener);
  }

  emitPluginEvent(pluginName: string, eventName: string, data: any): void {
    this.emit(`plugin:${pluginName}:${eventName}`, data);
  }

  onPluginEvent(pluginName: string, eventName: string, listener: EventListener): void {
    this.on(`plugin:${pluginName}:${eventName}`, listener);
  }

  emitSystemEvent(eventName: string, data: any): void {
    this.emit(`system:${eventName}`, data);
  }

  onSystemEvent(eventName: string, listener: EventListener): void {
    this.on(`system:${eventName}`, listener);
  }
}

class PluginStorage implements IPluginStorage {
  private readonly storage: Map<string, any> = new Map();

  constructor(private readonly config: StorageConfig) {}

  async set(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key) || null;
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}

class PluginSecurityManager {
  constructor(private readonly config: SecurityConfig) {}

  async validatePlugin(pluginPath: string): Promise<PluginValidationResult> {
    const errors: string[] = [];

    // Basic validation checks
    try {
      const fs = await import('fs');
      const path = await import('path');

      // Check if plugin.json exists
      const manifestPath = path.join(pluginPath, 'plugin.json');
      if (!fs.existsSync(manifestPath)) {
        errors.push('plugin.json not found');
      }

      // Check if main file exists
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const mainPath = path.join(pluginPath, manifest.main || 'index.js');
      if (!fs.existsSync(mainPath)) {
        errors.push(`Main file not found: ${manifest.main || 'index.js'}`);
      }

    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  checkPermissions(pluginName: string, permission: string): boolean {
    // Implement permission checking logic
    return true;
  }

  async createSandbox(pluginName: string): Promise<PluginSandbox> {
    return new PluginSandbox(pluginName, this.config);
  }
}

class PluginSandbox {
  constructor(
    private readonly pluginName: string,
    private readonly config: SecurityConfig
  ) {}

  async cleanup(): Promise<void> {
    // Cleanup sandbox resources
  }
}

// ==============================
// Type Definitions
// ==============================

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main?: string;
  className?: string;
  dependencies: string[];
  mvpSupport: number[];
  hooks: string[];
  permissions: string[];
  path?: string;
}

interface LoadedPlugin {
  plugin: IPlugin;
  manifest: PluginManifest;
  config: PluginConfiguration;
  loadedAt: Date;
  enabled: boolean;
  hooks: string[];
  sandbox: PluginSandbox | null;
}

interface HookRegistration {
  plugin: IPlugin;
  priority: number;
}

interface PluginManagerConfig {
  searchPaths: string[];
  enabledPlugins: Array<{ name: string; config?: any }>;
  security: SecurityConfig;
  storage: StorageConfig;
  hooks: HookConfig;
}

interface SecurityConfig {
  enableSandboxing: boolean;
  allowNativeModules: boolean;
  trustedPlugins: string[];
}

interface StorageConfig {
  persistent: boolean;
  path?: string;
}

interface HookConfig {
  failurePolicy: 'continue' | 'stop';
  timeout: number;
}

interface PluginConfiguration {
  [key: string]: any;
}

interface PluginValidationResult {
  valid: boolean;
  errors: string[];
}

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  loadedAt: Date;
}

interface PluginMessage {
  type: string;
  data: any;
  from?: string;
  timestamp?: Date;
}

interface PluginResponse {
  success: boolean;
  data?: any;
  error?: string;
  from?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface HookDescription {
  name: string;
  description: string;
  parameters: any;
  returnType: any;
}

interface IPluginStorage {
  set(key: string, value: any): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

type HookListener = (data: any) => void;
type EventListener = (data: any) => void;

export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginError';
  }
}

export { PluginManager as default };