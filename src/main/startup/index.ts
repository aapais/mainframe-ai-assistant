/**
 * Startup Module - Exports for optimized application startup
 */

export { StartupManager } from './StartupManager';
export { SplashScreen } from './SplashScreen';
export { ResourcePreloader } from './ResourcePreloader';

// Re-export types for convenience
export type { StartupPhase, StartupOptions, StartupResult } from './StartupManager';

export type { SplashScreenOptions } from './SplashScreen';

export type { PreloadOptions, PreloadResult } from './ResourcePreloader';
