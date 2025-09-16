/**
 * Component Plugin System
 * Extensible architecture for component enhancement and customization
 */

import React, {
  ComponentType,
  ReactNode,
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef
} from 'react';

// =========================
// PLUGIN SYSTEM TYPES
// =========================

export interface Plugin<TProps = any, TContext = any> {
  /** Unique plugin identifier */
  id: string;

  /** Plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description?: string;

  /** Plugin dependencies */
  dependencies?: string[];

  /** Plugin initialization */
  init?: (context: PluginContext<TContext>) => Promise<void> | void;

  /** Plugin cleanup */
  destroy?: () => Promise<void> | void;

  /** Component enhancement function */
  enhance?: (Component: ComponentType<TProps>) => ComponentType<TProps>;

  /** Props transformer */
  transformProps?: (props: TProps) => TProps;

  /** Render interceptor */
  interceptRender?: (
    originalRender: () => ReactNode,
    props: TProps,
    context: TContext
  ) => ReactNode;

  /** Event listeners */
  listeners?: Record<string, (event: any) => void>;

  /** Plugin configuration */
  config?: Record<string, any>;

  /** Plugin metadata */
  meta?: {
    author?: string;
    homepage?: string;
    keywords?: string[];
    license?: string;
  };
}

export interface PluginContext<TContext = any> {
  /** Global plugin registry */
  registry: PluginRegistry;

  /** Component context */
  context: TContext;

  /** Plugin configuration */
  config: Record<string, any>;

  /** Event emitter */
  emit: (event: string, data: any) => void;

  /** Event listener */
  on: (event: string, listener: (data: any) => void) => () => void;

  /** Logger */
  logger: PluginLogger;
}

export interface PluginLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

// =========================
// PLUGIN REGISTRY
// =========================

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private initialized = new Set<string>();
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private logger: PluginLogger;

  constructor(logger?: PluginLogger) {
    this.logger = logger || {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };
  }

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    // Validate plugin
    this.validatePlugin(plugin);

    // Check dependencies
    const missingDeps = this.checkDependencies(plugin);
    if (missingDeps.length > 0) {
      throw new Error(`Plugin ${plugin.id} has missing dependencies: ${missingDeps.join(', ')}`);
    }

    this.plugins.set(plugin.id, plugin);
    this.logger.info(`Plugin registered: ${plugin.id} v${plugin.version}`);
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Check if other plugins depend on this one
    const dependents = this.findDependents(pluginId);
    if (dependents.length > 0) {
      throw new Error(`Cannot unregister ${pluginId}. Dependent plugins: ${dependents.join(', ')}`);
    }

    // Destroy plugin
    if (plugin.destroy) {
      await plugin.destroy();
    }

    // Remove event listeners
    if (plugin.listeners) {
      Object.keys(plugin.listeners).forEach(event => {
        this.off(event, plugin.listeners![event]);
      });
    }

    this.plugins.delete(pluginId);
    this.initialized.delete(pluginId);
    this.logger.info(`Plugin unregistered: ${pluginId}`);
  }

  /**
   * Initialize a plugin
   */
  async initialize(pluginId: string, context: any = {}): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this.initialized.has(pluginId)) {
      this.logger.warn(`Plugin already initialized: ${pluginId}`);
      return;
    }

    // Initialize dependencies first
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.initialized.has(depId)) {
          await this.initialize(depId, context);
        }
      }
    }

    // Create plugin context
    const pluginContext: PluginContext = {
      registry: this,
      context,
      config: plugin.config || {},
      emit: (event, data) => this.emit(event, data),
      on: (event, listener) => this.on(event, listener),
      logger: this.logger
    };

    // Initialize plugin
    if (plugin.init) {
      await plugin.init(pluginContext);
    }

    // Register event listeners
    if (plugin.listeners) {
      Object.entries(plugin.listeners).forEach(([event, listener]) => {
        this.on(event, listener);
      });
    }

    this.initialized.add(pluginId);
    this.logger.info(`Plugin initialized: ${pluginId}`);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by type/category
   */
  getPluginsByCategory(category: string): Plugin[] {
    return this.getAllPlugins().filter(plugin =>
      plugin.meta?.keywords?.includes(category)
    );
  }

  /**
   * Apply plugins to a component
   */
  applyPlugins<TProps>(
    Component: ComponentType<TProps>,
    pluginIds?: string[]
  ): ComponentType<TProps> {
    const pluginsToApply = pluginIds
      ? pluginIds.map(id => this.plugins.get(id)).filter(Boolean) as Plugin[]
      : this.getAllPlugins().filter(plugin => plugin.enhance);

    return pluginsToApply.reduce((EnhancedComponent, plugin) => {
      if (plugin.enhance) {
        const Enhanced = plugin.enhance(EnhancedComponent);
        Enhanced.displayName = `${plugin.name}(${EnhancedComponent.displayName || EnhancedComponent.name || 'Component'})`;
        return Enhanced;
      }
      return EnhancedComponent;
    }, Component);
  }

  /**
   * Transform props through plugins
   */
  transformProps<TProps>(props: TProps, pluginIds?: string[]): TProps {
    const pluginsToApply = pluginIds
      ? pluginIds.map(id => this.plugins.get(id)).filter(Boolean) as Plugin[]
      : this.getAllPlugins().filter(plugin => plugin.transformProps);

    return pluginsToApply.reduce((transformedProps, plugin) => {
      if (plugin.transformProps) {
        return plugin.transformProps(transformedProps);
      }
      return transformedProps;
    }, props);
  }

  /**
   * Event emitter
   */
  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Add event listener
   */
  on(event: string, listener: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  private validatePlugin(plugin: Plugin): void {
    if (!plugin.id) throw new Error('Plugin must have an id');
    if (!plugin.name) throw new Error('Plugin must have a name');
    if (!plugin.version) throw new Error('Plugin must have a version');
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
  }

  private checkDependencies(plugin: Plugin): string[] {
    if (!plugin.dependencies) return [];
    return plugin.dependencies.filter(dep => !this.plugins.has(dep));
  }

  private findDependents(pluginId: string): string[] {
    return this.getAllPlugins()
      .filter(plugin => plugin.dependencies?.includes(pluginId))
      .map(plugin => plugin.id);
  }
}

// =========================
// EXTENSION HOOKS
// =========================

export interface ExtensionHook<TData = any, TActions = {}> {
  /** Hook name */
  name: string;

  /** Hook version */
  version: string;

  /** Hook implementation */
  useHook: (options?: any) => { data: TData; actions: TActions };

  /** Hook dependencies */
  dependencies?: string[];

  /** Default options */
  defaultOptions?: any;
}

export class ExtensionHookRegistry {
  private hooks = new Map<string, ExtensionHook>();

  /**
   * Register an extension hook
   */
  register<TData, TActions>(hook: ExtensionHook<TData, TActions>): void {
    if (this.hooks.has(hook.name)) {
      throw new Error(`Hook already registered: ${hook.name}`);
    }
    this.hooks.set(hook.name, hook);
  }

  /**
   * Use an extension hook
   */
  useHook<TData = any, TActions = {}>(
    hookName: string,
    options?: any
  ): { data: TData; actions: TActions } {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      throw new Error(`Hook not found: ${hookName}`);
    }

    const mergedOptions = { ...hook.defaultOptions, ...options };
    return hook.useHook(mergedOptions);
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): ExtensionHook[] {
    return Array.from(this.hooks.values());
  }
}

// =========================
// PLUGIN CONTEXT PROVIDER
// =========================

const PluginRegistryContext = createContext<PluginRegistry | null>(null);

export interface PluginProviderProps {
  registry?: PluginRegistry;
  plugins?: Plugin[];
  children: ReactNode;
}

export const PluginProvider: React.FC<PluginProviderProps> = ({
  registry: providedRegistry,
  plugins = [],
  children
}) => {
  const [registry] = useState(() => providedRegistry || new PluginRegistry());
  const [isInitialized, setIsInitialized] = useState(false);

  // Register and initialize plugins
  useEffect(() => {
    const initializePlugins = async () => {
      try {
        // Register all plugins
        plugins.forEach(plugin => {
          registry.register(plugin);
        });

        // Initialize all plugins
        for (const plugin of plugins) {
          await registry.initialize(plugin.id);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize plugins:', error);
      }
    };

    initializePlugins();

    // Cleanup on unmount
    return () => {
      plugins.forEach(plugin => {
        if (plugin.destroy) {
          plugin.destroy().catch(console.error);
        }
      });
    };
  }, [registry, plugins]);

  if (!isInitialized) {
    return <div>Loading plugins...</div>;
  }

  return (
    <PluginRegistryContext.Provider value={registry}>
      {children}
    </PluginRegistryContext.Provider>
  );
};

export const usePluginRegistry = (): PluginRegistry => {
  const registry = useContext(PluginRegistryContext);
  if (!registry) {
    throw new Error('usePluginRegistry must be used within a PluginProvider');
  }
  return registry;
};

// =========================
// PLUGGABLE COMPONENT
// =========================

export interface PluggableComponentProps {
  /** Plugin IDs to apply */
  plugins?: string[];

  /** Component to enhance */
  component: ComponentType<any>;

  /** Props to pass to component */
  componentProps?: any;

  /** Render interceptors */
  interceptors?: Array<(render: () => ReactNode) => ReactNode>;
}

export const PluggableComponent: React.FC<PluggableComponentProps> = ({
  plugins = [],
  component: BaseComponent,
  componentProps = {},
  interceptors = []
}) => {
  const registry = usePluginRegistry();

  const EnhancedComponent = useMemo(() => {
    return registry.applyPlugins(BaseComponent, plugins);
  }, [registry, BaseComponent, plugins]);

  const transformedProps = useMemo(() => {
    return registry.transformProps(componentProps, plugins);
  }, [registry, componentProps, plugins]);

  const renderComponent = useCallback(() => {
    return <EnhancedComponent {...transformedProps} />;
  }, [EnhancedComponent, transformedProps]);

  // Apply interceptors
  const finalRender = interceptors.reduce(
    (currentRender, interceptor) => () => interceptor(currentRender),
    renderComponent
  );

  return <>{finalRender()}</>;
};

// =========================
// BUILT-IN PLUGINS
// =========================

/**
 * Debug plugin for development
 */
export const debugPlugin: Plugin = {
  id: 'debug',
  name: 'Debug Plugin',
  version: '1.0.0',
  description: 'Provides debugging capabilities for components',

  enhance: <TProps,>(Component: ComponentType<TProps>) => {
    return (props: TProps) => {
      const renderCount = useRef(0);
      renderCount.current++;

      useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 ${Component.displayName || Component.name} rendered ${renderCount.current} times`, props);
        }
      });

      return <Component {...props} />;
    };
  }
};

/**
 * Analytics plugin
 */
export const analyticsPlugin: Plugin = {
  id: 'analytics',
  name: 'Analytics Plugin',
  version: '1.0.0',
  description: 'Provides analytics tracking for components',

  enhance: <TProps extends { 'data-analytics'?: string }>(Component: ComponentType<TProps>) => {
    return (props: TProps) => {
      const analyticsId = props['data-analytics'];

      const handleClick = useCallback((event: React.MouseEvent) => {
        if (analyticsId) {
          // Send analytics event
          console.log(`📊 Analytics: ${analyticsId} clicked`);
        }

        // Call original onClick if exists
        if ('onClick' in props && typeof props.onClick === 'function') {
          (props.onClick as any)(event);
        }
      }, [analyticsId, props]);

      const enhancedProps = analyticsId
        ? { ...props, onClick: handleClick }
        : props;

      return <Component {...enhancedProps} />;
    };
  }
};

/**
 * Theme plugin
 */
export const themePlugin: Plugin = {
  id: 'theme',
  name: 'Theme Plugin',
  version: '1.0.0',
  description: 'Provides theme support for components',

  transformProps: <TProps extends { theme?: string; className?: string }>(props: TProps) => {
    const { theme, className = '', ...restProps } = props;

    if (theme) {
      const themeClass = `theme-${theme}`;
      return {
        ...restProps,
        className: `${className} ${themeClass}`.trim()
      } as TProps;
    }

    return props;
  }
};