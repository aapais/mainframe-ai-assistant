/**
 * Startup Manager - Optimized Electron application startup with splash screen,
 * parallel initialization, and graceful degradation
 */

import { EventEmitter } from 'events';
import { BrowserWindow, app } from 'electron';
import { SplashScreen } from './SplashScreen';
import { ResourcePreloader } from './ResourcePreloader';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { ServiceManager } from '../services/ServiceManager';

export interface StartupPhase {
  name: string;
  description: string;
  weight: number; // Percentage of total startup time
  critical: boolean;
  parallel?: boolean;
  dependencies?: string[];
}

export interface StartupOptions {
  showSplashScreen: boolean;
  enablePreloading: boolean;
  enablePerformanceMonitoring: boolean;
  parallelInitialization: boolean;
  gracefulDegradation: boolean;
  maxStartupTime: number; // Maximum startup time in ms
}

export interface StartupResult {
  success: boolean;
  duration: number;
  completedPhases: string[];
  failedPhases: string[];
  degradedServices: string[];
  performanceMetrics?: any;
}

export class StartupManager extends EventEmitter {
  private splashScreen: SplashScreen;
  private resourcePreloader: ResourcePreloader;
  private performanceMonitor: PerformanceMonitor;
  private serviceManager: ServiceManager;
  
  private currentPhase = 0;
  private totalPhases = 0;
  private startupStartTime = 0;
  private isStartupComplete = false;

  // Startup phases with optimized ordering and parallelization
  private readonly phases: StartupPhase[] = [
    {
      name: 'splash',
      description: 'Show splash screen',
      weight: 1,
      critical: false,
      parallel: false
    },
    {
      name: 'performance',
      description: 'Initialize performance monitoring',
      weight: 2,
      critical: false,
      parallel: false
    },
    {
      name: 'services-critical',
      description: 'Initialize critical services',
      weight: 30,
      critical: true,
      parallel: true,
      dependencies: ['performance']
    },
    {
      name: 'preloading',
      description: 'Preload resources',
      weight: 20,
      critical: false,
      parallel: true,
      dependencies: ['services-critical']
    },
    {
      name: 'services-optional',
      description: 'Initialize optional services',
      weight: 25,
      critical: false,
      parallel: true,
      dependencies: ['services-critical']
    },
    {
      name: 'ui-ready',
      description: 'Prepare main window',
      weight: 15,
      critical: true,
      parallel: false,
      dependencies: ['services-critical', 'preloading']
    },
    {
      name: 'finalization',
      description: 'Complete startup',
      weight: 7,
      critical: true,
      parallel: false,
      dependencies: ['ui-ready']
    }
  ];

  constructor(
    serviceManager: ServiceManager,
    private options: StartupOptions = {
      showSplashScreen: true,
      enablePreloading: true,
      enablePerformanceMonitoring: true,
      parallelInitialization: true,
      gracefulDegradation: true,
      maxStartupTime: 10000 // 10 seconds max
    }
  ) {
    super();
    
    this.serviceManager = serviceManager;
    this.splashScreen = new SplashScreen();
    this.resourcePreloader = new ResourcePreloader();
    this.performanceMonitor = new PerformanceMonitor();
    this.totalPhases = this.phases.length;

    this.setupEventHandlers();
  }

  /**
   * Start the optimized application startup process
   */
  async startup(): Promise<StartupResult> {
    this.startupStartTime = Date.now();
    this.isStartupComplete = false;
    
    console.log('🚀 Starting optimized application startup...');
    this.emit('startup:started');

    const result: StartupResult = {
      success: false,
      duration: 0,
      completedPhases: [],
      failedPhases: [],
      degradedServices: []
    };

    try {
      // Set up startup timeout
      const startupTimeout = this.createStartupTimeout();

      if (this.options.parallelInitialization) {
        await this.executeParallelStartup(result);
      } else {
        await this.executeSequentialStartup(result);
      }

      clearTimeout(startupTimeout);
      
      result.success = true;
      result.duration = Date.now() - this.startupStartTime;

      if (this.options.enablePerformanceMonitoring) {
        result.performanceMetrics = this.performanceMonitor.getStartupMetrics();
      }

      this.isStartupComplete = true;
      console.log(`✅ Startup completed successfully in ${result.duration}ms`);
      this.emit('startup:completed', result);

      return result;

    } catch (error) {
      result.success = false;
      result.duration = Date.now() - this.startupStartTime;
      
      console.error('❌ Startup failed:', error);
      this.emit('startup:failed', error, result);

      if (this.options.gracefulDegradation) {
        return this.attemptGracefulDegradation(result, error);
      }

      throw error;
    }
  }

  /**
   * Execute startup phases in parallel where possible
   */
  private async executeParallelStartup(result: StartupResult): Promise<void> {
    const phaseGroups = this.groupPhasesByDependencies();
    
    for (let groupIndex = 0; groupIndex < phaseGroups.length; groupIndex++) {
      const group = phaseGroups[groupIndex];
      const groupPromises: Promise<void>[] = [];

      // Execute all phases in this group in parallel
      for (const phase of group) {
        groupPromises.push(this.executePhase(phase, result));
      }

      try {
        await Promise.all(groupPromises);
      } catch (error) {
        // Handle partial group failure
        if (this.options.gracefulDegradation) {
          const criticalFailed = group.some(p => 
            p.critical && result.failedPhases.includes(p.name)
          );
          
          if (criticalFailed) {
            throw error;
          }
          // Continue if only non-critical phases failed
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Execute startup phases sequentially
   */
  private async executeSequentialStartup(result: StartupResult): Promise<void> {
    for (const phase of this.phases) {
      await this.executePhase(phase, result);
    }
  }

  /**
   * Execute a single startup phase
   */
  private async executePhase(phase: StartupPhase, result: StartupResult): Promise<void> {
    const phaseStartTime = Date.now();
    this.currentPhase++;

    try {
      console.log(`📋 Starting phase: ${phase.description} (${this.currentPhase}/${this.totalPhases})`);
      this.updateProgress(phase);

      switch (phase.name) {
        case 'splash':
          await this.executeSplashPhase();
          break;
        case 'performance':
          await this.executePerformancePhase();
          break;
        case 'services-critical':
          await this.executeCriticalServicesPhase();
          break;
        case 'preloading':
          await this.executePreloadingPhase();
          break;
        case 'services-optional':
          await this.executeOptionalServicesPhase();
          break;
        case 'ui-ready':
          await this.executeUIReadyPhase();
          break;
        case 'finalization':
          await this.executeFinalizationPhase();
          break;
      }

      const phaseDuration = Date.now() - phaseStartTime;
      result.completedPhases.push(phase.name);
      
      if (this.options.enablePerformanceMonitoring) {
        this.performanceMonitor.recordPhaseTime(phase.name, phaseDuration);
      }

      console.log(`✅ Completed phase: ${phase.description} in ${phaseDuration}ms`);
      this.emit('phase:completed', phase.name, phaseDuration);

    } catch (error) {
      const phaseDuration = Date.now() - phaseStartTime;
      result.failedPhases.push(phase.name);

      console.error(`❌ Phase failed: ${phase.description}`, error);
      this.emit('phase:failed', phase.name, error, phaseDuration);

      if (phase.critical && !this.options.gracefulDegradation) {
        throw new Error(`Critical phase '${phase.name}' failed: ${error.message}`);
      }
    }
  }

  /**
   * Show splash screen immediately
   */
  private async executeSplashPhase(): Promise<void> {
    if (!this.options.showSplashScreen) return;

    await this.splashScreen.show();
    this.splashScreen.updateStatus('Initializing application...', 5);
  }

  /**
   * Initialize performance monitoring
   */
  private async executePerformancePhase(): Promise<void> {
    if (!this.options.enablePerformanceMonitoring) return;

    this.performanceMonitor.startStartupTracking();
    this.splashScreen?.updateStatus('Performance monitoring active', 10);
  }

  /**
   * Initialize critical services that the app cannot run without
   */
  private async executeCriticalServicesPhase(): Promise<void> {
    this.splashScreen?.updateStatus('Starting core services...', 25);

    // Import and register critical services
    const { DatabaseService } = await import('../services/DatabaseService');
    const { WindowService } = await import('../services/WindowService');

    this.serviceManager.registerService(new DatabaseService());
    this.serviceManager.registerService(new WindowService());

    // Initialize critical services only
    const result = await this.serviceManager.initialize({
      parallelInitialization: true,
      failFast: true,
      enableRetries: true,
      retryAttempts: 2,
      retryDelay: 1000,
      progressCallback: (serviceName, progress) => {
        this.splashScreen?.updateStatus(`Starting ${serviceName}...`, 25 + (progress * 0.3));
      }
    });

    if (!result.success) {
      throw new Error(`Critical services failed to initialize: ${result.failed.map(f => f.name).join(', ')}`);
    }

    this.splashScreen?.updateStatus('Core services ready', 55);
  }

  /**
   * Preload resources in parallel with optional services
   */
  private async executePreloadingPhase(): Promise<void> {
    if (!this.options.enablePreloading) return;

    this.splashScreen?.updateStatus('Preloading resources...', 60);
    
    await this.resourcePreloader.preloadCriticalData();
    
    this.splashScreen?.updateStatus('Resources preloaded', 75);
  }

  /**
   * Initialize optional services (AI, monitoring, etc.)
   */
  private async executeOptionalServicesPhase(): Promise<void> {
    this.splashScreen?.updateStatus('Starting optional services...', 65);

    try {
      // Import and register optional services
      const { AIService, FallbackAIService } = await import('../services/AIService');
      const { IPCService } = await import('../services/IPCService');
      const { MonitoringService } = await import('../services/MonitoringService');

      this.serviceManager.registerService(new AIService());
      this.serviceManager.registerFallbackService(new FallbackAIService());
      this.serviceManager.registerService(new IPCService());
      this.serviceManager.registerService(new MonitoringService());

      // Initialize optional services with more lenient settings
      const result = await this.serviceManager.initialize({
        parallelInitialization: true,
        failFast: false,
        enableRetries: true,
        retryAttempts: 1,
        retryDelay: 500,
        progressCallback: (serviceName, progress) => {
          this.splashScreen?.updateStatus(`Starting ${serviceName}...`, 65 + (progress * 0.15));
        }
      });

      // Record degraded services but don't fail
      if (result.failed.length > 0) {
        console.warn(`⚠️ Some optional services failed: ${result.failed.map(f => f.name).join(', ')}`);
      }

    } catch (error) {
      console.warn('⚠️ Optional services initialization failed:', error);
      // Don't fail startup for optional services
    }

    this.splashScreen?.updateStatus('Services initialized', 80);
  }

  /**
   * Prepare main window and UI
   */
  private async executeUIReadyPhase(): Promise<void> {
    this.splashScreen?.updateStatus('Preparing interface...', 85);

    const windowService = this.serviceManager.getService('WindowService') as any;
    if (!windowService) {
      throw new Error('WindowService not available - cannot create main window');
    }

    // Create main window
    await windowService.createMainWindow();
    
    this.splashScreen?.updateStatus('Interface ready', 92);
  }

  /**
   * Complete startup and show main window
   */
  private async executeFinalizationPhase(): Promise<void> {
    this.splashScreen?.updateStatus('Finishing startup...', 95);

    // Show main window
    const windowService = this.serviceManager.getService('WindowService') as any;
    if (windowService) {
      windowService.show();
    }

    // Hide splash screen
    if (this.splashScreen) {
      await this.splashScreen.hide();
    }

    this.splashScreen?.updateStatus('Ready!', 100);
  }

  /**
   * Group phases by their dependencies for parallel execution
   */
  private groupPhasesByDependencies(): StartupPhase[][] {
    const groups: StartupPhase[][] = [];
    const processed = new Set<string>();

    const canExecute = (phase: StartupPhase): boolean => {
      return !phase.dependencies || phase.dependencies.every(dep => processed.has(dep));
    };

    while (processed.size < this.phases.length) {
      const currentGroup: StartupPhase[] = [];

      for (const phase of this.phases) {
        if (!processed.has(phase.name) && canExecute(phase)) {
          currentGroup.push(phase);
        }
      }

      if (currentGroup.length === 0) {
        throw new Error('Circular dependency detected in startup phases');
      }

      groups.push(currentGroup);
      currentGroup.forEach(phase => processed.add(phase.name));
    }

    return groups;
  }

  /**
   * Update progress on splash screen and emit event
   */
  private updateProgress(phase: StartupPhase): void {
    const totalWeight = this.phases.reduce((sum, p) => sum + p.weight, 0);
    const completedWeight = this.phases
      .slice(0, this.currentPhase - 1)
      .reduce((sum, p) => sum + p.weight, 0);
    
    const progress = Math.floor((completedWeight / totalWeight) * 100);
    
    this.emit('progress', {
      phase: phase.name,
      description: phase.description,
      progress,
      currentPhase: this.currentPhase,
      totalPhases: this.totalPhases
    });
  }

  /**
   * Create startup timeout to prevent hanging
   */
  private createStartupTimeout(): NodeJS.Timeout {
    return setTimeout(() => {
      if (!this.isStartupComplete) {
        const error = new Error(`Startup timeout after ${this.options.maxStartupTime}ms`);
        this.emit('startup:timeout', error);
        throw error;
      }
    }, this.options.maxStartupTime);
  }

  /**
   * Attempt graceful degradation when startup fails
   */
  private async attemptGracefulDegradation(result: StartupResult, error: Error): Promise<StartupResult> {
    console.log('⚠️ Attempting graceful degradation...');
    this.splashScreen?.updateStatus('Starting in safe mode...', 50);

    try {
      // Try to start with minimal services
      const { DatabaseService } = await import('../services/DatabaseService');
      const { WindowService } = await import('../services/WindowService');
      const { FallbackAIService } = await import('../services/AIService');

      // Reset service manager and register minimal services
      this.serviceManager.unregisterService('DatabaseService');
      this.serviceManager.unregisterService('WindowService');
      this.serviceManager.unregisterService('AIService');

      this.serviceManager.registerService(new DatabaseService());
      this.serviceManager.registerService(new WindowService());
      this.serviceManager.registerService(new FallbackAIService());

      await this.serviceManager.initialize({
        parallelInitialization: false,
        failFast: true,
        enableRetries: false
      });

      // Create basic window
      const windowService = this.serviceManager.getService('WindowService') as any;
      if (windowService) {
        await windowService.createMainWindow();
        windowService.show();
      }

      await this.splashScreen.hide();

      result.success = true;
      result.degradedServices = ['AIService', 'IPCService', 'MonitoringService'];
      result.duration = Date.now() - this.startupStartTime;

      console.log('✅ Graceful degradation successful - running in safe mode');
      this.emit('startup:degraded', result);

      return result;

    } catch (degradationError) {
      console.error('❌ Graceful degradation also failed:', degradationError);
      result.success = false;
      throw degradationError;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward progress to splash screen
    this.on('progress', (progressData) => {
      this.splashScreen?.updateProgress(progressData.progress);
    });

    // Handle critical errors
    this.on('phase:failed', (phaseName, error) => {
      if (this.splashScreen) {
        this.splashScreen.showError(`Failed to ${phaseName}: ${error.message}`);
      }
    });
  }

  /**
   * Get current startup status
   */
  getStartupStatus(): {
    isComplete: boolean;
    currentPhase: number;
    totalPhases: number;
    duration: number;
  } {
    return {
      isComplete: this.isStartupComplete,
      currentPhase: this.currentPhase,
      totalPhases: this.totalPhases,
      duration: this.startupStartTime ? Date.now() - this.startupStartTime : 0
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.splashScreen?.cleanup();
    this.performanceMonitor?.stop();
    this.removeAllListeners();
  }
}