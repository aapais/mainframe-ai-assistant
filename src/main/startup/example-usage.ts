/**
 * Example Usage - Demonstrates how to use the optimized startup system
 */

import { app } from 'electron';
import { StartupManager } from './StartupManager';
import { getServiceManager } from '../services/ServiceManager';

// Example of using the startup system
async function startupExample() {
  // Get service manager instance
  const serviceManager = getServiceManager({
    enableHealthChecks: true,
    healthCheckInterval: 60000,
    gracefulShutdownTimeout: 5000,
  });

  // Create startup manager with options
  const startupManager = new StartupManager(serviceManager, {
    showSplashScreen: true,
    enablePreloading: true,
    enablePerformanceMonitoring: true,
    parallelInitialization: true,
    gracefulDegradation: true,
    maxStartupTime: 8000, // 8 seconds max
  });

  // Set up event listeners for monitoring
  startupManager.on('startup:started', () => {
    console.log('🚀 Application startup initiated');
  });

  startupManager.on('progress', progressData => {
    console.log(`📋 ${progressData.description} (${progressData.progress}%)`);
  });

  startupManager.on('phase:completed', (phaseName, duration) => {
    console.log(`✅ ${phaseName} completed in ${duration}ms`);
  });

  startupManager.on('startup:completed', result => {
    console.log('🎉 Startup completed successfully!');
    console.log(`📊 Total time: ${result.duration}ms`);
    console.log(`📈 Phases: ${result.completedPhases.join(', ')}`);
  });

  startupManager.on('startup:degraded', result => {
    console.warn('⚠️ Started in degraded mode');
    console.warn(`🔄 Degraded services: ${result.degradedServices.join(', ')}`);
  });

  // Start the optimized startup process
  try {
    const result = await startupManager.startup();

    if (result.success) {
      console.log('✅ Application ready!');

      // Application is now ready for user interaction
      // Main window is shown, services are running

      if (result.performanceMetrics) {
        console.log('📈 Performance metrics:', {
          totalTime: result.performanceMetrics.startup.totalTime,
          criticalPath: result.performanceMetrics.startup.criticalPathTime,
          serviceInit: result.performanceMetrics.startup.serviceInitTime,
          preloadTime: result.performanceMetrics.startup.preloadTime,
        });
      }
    } else {
      console.error('❌ Startup failed');
      app.quit();
    }
  } catch (error) {
    console.error('💥 Startup error:', error);
    app.quit();
  }
}

// Example with performance monitoring
async function startupWithMonitoring() {
  const serviceManager = getServiceManager();
  const startupManager = new StartupManager(serviceManager);

  // Start with performance monitoring
  const result = await startupManager.startup();

  if (result.success && result.performanceMetrics) {
    const metrics = result.performanceMetrics.startup;

    // Check if startup time meets targets
    if (metrics.totalTime > 5000) {
      console.warn(`⚠️ Startup time (${metrics.totalTime}ms) exceeded 5s target`);

      // Analyze bottlenecks
      const phases = Object.entries(metrics.phaseTimings);
      const slowPhases = phases.filter(([_, duration]) => duration > 1000);

      if (slowPhases.length > 0) {
        console.warn('🐌 Slow phases detected:');
        slowPhases.forEach(([phase, duration]) => {
          console.warn(`  - ${phase}: ${duration}ms`);
        });
      }
    } else {
      console.log(`✅ Startup time (${metrics.totalTime}ms) meets performance targets`);
    }
  }
}

export { startupExample, startupWithMonitoring };
