/**
 * Simplified Main Electron Process - Week 2 Emergency Version
 * Focus on core functionality and stability
 */

import { app, BrowserWindow, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc-handlers';
import { KBContentLoader } from '../services/KBContentLoader';
import { ServiceManager } from './services/ServiceManager';
import { StartupManager } from './startup/StartupManager';
import { PerformanceMonitor } from './performance/PerformanceMonitor';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let serviceManager: ServiceManager;
let startupManager: StartupManager;
let performanceMonitor: PerformanceMonitor;
let knowledgeDB: any;
let geminiService: any;
const isDevelopment = process.env.NODE_ENV === 'development';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createMainWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    title: 'Mainframe KB Assistant - MVP1',
    show: false, // Don't show until ready
  });

  // Load the Next.js app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3001');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Load the built Next.js application
    mainWindow.loadFile(path.join(__dirname, '../../app/out/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Focus on macOS
    if (process.platform === 'darwin') {
      mainWindow?.focus();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
};

/**
 * Update global references for compatibility
 */
async function updateGlobalReferences(): Promise<void> {
  try {
    const dbService = serviceManager.getService('DatabaseService') as any;
    const aiService = serviceManager.getService('AIService') as any;
    const windowService = serviceManager.getService('WindowService') as any;
    
    if (dbService) {
      knowledgeDB = dbService.getDatabase();
    }
    
    if (aiService) {
      geminiService = aiService.getGeminiService();
    }
    
    if (windowService) {
      mainWindow = windowService.getMainWindow();
    }

    console.log('✅ Global references updated');
  } catch (error) {
    console.error('⚠️ Failed to update global references:', error);
  }
}

/**
 * Setup startup event handlers
 */
function setupStartupEventHandlers(): void {
  if (!startupManager) return;

  startupManager.on('startup:started', () => {
    console.log('🚀 Startup process initiated');
  });

  startupManager.on('progress', (progressData) => {
    console.log(`📋 ${progressData.description} (${progressData.progress}%)`);
  });

  startupManager.on('phase:completed', (phaseName, duration) => {
    console.log(`✅ Phase '${phaseName}' completed in ${duration}ms`);
  });

  startupManager.on('phase:failed', (phaseName, error, duration) => {
    console.error(`❌ Phase '${phaseName}' failed in ${duration}ms:`, error);
  });

  startupManager.on('startup:completed', (result) => {
    console.log(`🎉 Startup completed successfully!`);
    console.log(`📊 Performance: ${result.duration}ms total, ${result.completedPhases.length} phases completed`);
    
    if (result.performanceMetrics) {
      console.log('📈 Startup metrics:', result.performanceMetrics);
    }
  });

  startupManager.on('startup:degraded', (result) => {
    console.warn('⚠️ Application started in degraded mode');
    console.warn(`🔄 Degraded services: ${result.degradedServices.join(', ')}`);
  });

  startupManager.on('startup:failed', (error, result) => {
    console.error('❌ Startup failed:', error);
    console.error('💥 Failed phases:', result.failedPhases);
  });

  startupManager.on('startup:timeout', (error) => {
    console.error('⏰ Startup timeout:', error);
  });
}

/**
 * Setup Service Manager event handlers for monitoring
 */
function setupServiceManagerEvents(): void {
  serviceManager.on('service:failed', (serviceName, error) => {
    console.error(`❌ Service failed: ${serviceName}`, error);
  });

  serviceManager.on('service:restarted', (serviceName, attempt) => {
    console.log(`🔄 Service restarted: ${serviceName} (attempt ${attempt})`);
  });

  serviceManager.on('health:degraded', (unhealthyServices) => {
    console.warn(`⚠️ Services unhealthy: ${unhealthyServices.join(', ')}`);
  });

  serviceManager.on('health:recovered', (recoveredServices) => {
    console.log(`✅ Services recovered: ${recoveredServices.join(', ')}`);
  });

  serviceManager.on('error:critical', (serviceName, error) => {
    console.error(`🚨 Critical error in ${serviceName}:`, error);
  });

  serviceManager.on('initialization:failed', (error, failedServices) => {
    console.error(`❌ Initialization failed for services: ${failedServices.join(', ')}`, error);
  });
}

// Utility functions moved to respective services

/**
 * Create application menu
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Entry',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-entry');
          }
        },
        {
          label: 'Import Knowledge Base',
          click: async () => {
            if (!mainWindow) return;
            
            const result = await dialog.showOpenDialog(mainWindow, {
              title: 'Import Knowledge Base',
              filters: [
                { name: 'JSON Files', extensions: ['json'] }
              ],
              properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('menu-import-kb', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Export Knowledge Base',
          click: async () => {
            if (!mainWindow) return;
            
            const result = await dialog.showSaveDialog(mainWindow, {
              title: 'Export Knowledge Base',
              defaultPath: `knowledge-base-${new Date().toISOString().split('T')[0]}.json`,
              filters: [
                { name: 'JSON Files', extensions: ['json'] }
              ]
            });

            if (!result.canceled && result.filePath) {
              mainWindow.webContents.send('menu-export-kb', result.filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Create Backup',
          click: () => {
            mainWindow?.webContents.send('menu-backup');
          }
        },
        { type: 'separator' },
        {
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Database Statistics',
          click: () => {
            mainWindow?.webContents.send('menu-show-stats');
          }
        },
        {
          label: 'Performance Monitor',
          click: () => {
            mainWindow?.webContents.send('menu-show-performance');
          }
        },
        {
          label: 'Optimize Database',
          click: () => {
            mainWindow?.webContents.send('menu-optimize-db');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('menu-show-settings');
          }
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow?.webContents.send('menu-show-about');
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://docs.example.com/kb-assistant');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers are now managed by IPCService

// Initialize the application
async function startApplication(): Promise<void> {
  try {
    // Initialize services
    serviceManager = new ServiceManager();
    startupManager = new StartupManager();
    performanceMonitor = new PerformanceMonitor();

    // Initialize and start services
    await serviceManager.initialize();

    // Create main window
    createMainWindow();

    // Setup IPC handlers
    setupIpcHandlers();

    // Update global references
    await updateGlobalReferences();

    console.log('✅ Application started successfully');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    app.quit();
  }
}

// App event handlers with optimized startup
app.whenReady().then(async () => {
  // Start optimized application startup
  await startApplication();
  
  // Setup menu after startup
  createMenu();
  
  // Setup auto-updater in production
  // TODO: Implement auto-updater for production
  // if (!isDevelopment) {
  //   const updater = new AppUpdater();
  //   updater.checkForUpdates();
  // }
  
  // Start continuous performance monitoring
  if (startupManager && !performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
    performanceMonitor.startMonitoring(30000); // Monitor every 30 seconds
    
    // Set up performance monitoring events
    performanceMonitor.on('alert', (alert) => {
      console.warn(`⚠️ Performance Alert: ${alert.message}`);
      
      // Send performance alerts to renderer if window is available
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('performance:alert', alert);
      }
    });

    performanceMonitor.on('metrics:collected', (metrics) => {
      // Optionally send metrics to renderer for display
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('performance:metrics', metrics);
      }
    });
  }
  
  app.on('activate', async () => {
    // On macOS re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      const windowService = serviceManager.getService('WindowService') as any;
      if (windowService) {
        windowService.show();
      }
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  console.log('🔄 Application shutdown initiated...');
  
  try {
    // Stop performance monitoring
    if (performanceMonitor) {
      performanceMonitor.stop();
      console.log('✅ Performance monitoring stopped');
    }

    // Cleanup startup manager
    if (startupManager) {
      await startupManager.cleanup();
      console.log('✅ Startup manager cleaned up');
    }

    // ServiceManager handles graceful shutdown of all services
    await serviceManager.shutdown();
    console.log('✅ All services shut down gracefully');

  } catch (error) {
    console.error('❌ Error during application shutdown:', error);
  }
});

// Handle protocol for deep linking (future feature)
app.setAsDefaultProtocolClient('mainframe-kb');

// Security: Prevent new window creation
// TODO: Update to use 'did-create-window' or setWindowOpenHandler
// app.on('web-contents-created', (_, contents) => {
//   contents.on('new-window', (event, navigationUrl) => {
//     event.preventDefault();
//     shell.openExternal(navigationUrl);
//   });
// });

// Security: Prevent navigation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith('http://localhost') && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

// Export service manager and optimized components
export { serviceManager, startupManager, performanceMonitor };
export { mainWindow, knowledgeDB, geminiService }; // Compatibility exports