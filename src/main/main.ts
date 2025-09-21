/**
 * Electron Main Process - Integrated with Next.js
 * Maintains all existing IPC functionality while adding Next.js support
 */

import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import { setupIpcHandlers, shutdownIPCHandlers } from './ipc-handlers';

// Store the main window reference
let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window
 */
function createMainWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true, // Security best practice
      enableRemoteModule: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    show: false, // Don't show until ready
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  // Load the appropriate content based on environment
  if (isDev) {
    // Development: Load Next.js dev server
    const nextPort = process.env.NEXT_PORT || '3001';
    const nextUrl = `http://localhost:${nextPort}`;

    console.log('🔧 Development mode: Loading Next.js from', nextUrl);

    // Load Next.js development server
    mainWindow.loadURL(nextUrl).catch(err => {
      console.error('Failed to load Next.js dev server:', err);
      // Fallback to static content if Next.js fails
      loadFallbackContent();
    });

    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load built Next.js files
    const nextBuildPath = path.join(__dirname, '../../app/out/index.html');

    console.log('🚀 Production mode: Loading built Next.js from', nextBuildPath);

    // Load the built Next.js application
    mainWindow.loadFile(nextBuildPath).catch(err => {
      console.error('Failed to load built Next.js files:', err);
      // Fallback to static content if built files fail
      loadFallbackContent();
    });
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();

      // Focus window if on macOS
      if (process.platform === 'darwin') {
        mainWindow.focus();
      }
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

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
    }
  });

  // Handle certificate errors in development
  if (isDev) {
    mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      if (url.startsWith('http://localhost')) {
        // Allow localhost certificates in development
        event.preventDefault();
        callback(true);
      } else {
        callback(false);
      }
    });
  }
}

/**
 * Fallback content loader for when Next.js fails
 */
function loadFallbackContent(): void {
  if (!mainWindow) return;

  const fallbackPath = path.join(__dirname, '../../index.html');
  console.log('⚠️ Loading fallback content from', fallbackPath);

  mainWindow.loadFile(fallbackPath).catch(err => {
    console.error('Failed to load fallback content:', err);
    // Last resort: create a basic HTML page
    mainWindow?.loadURL('data:text/html,<h1>Accenture Mainframe AI Assistant</h1><p>Loading...</p>');
  });
}

/**
 * Setup application menu
 */
function setupApplicationMenu(): void {
  if (process.platform === 'darwin') {
    // macOS menu
    const template = [
      {
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
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
          { role: 'selectall' }
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
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template as any));
  } else {
    // Windows/Linux menu
    Menu.setApplicationMenu(null);
  }
}

/**
 * App event handlers
 */

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('🚀 Electron app ready, starting initialization...');

  try {
    // Setup IPC handlers first (maintains all existing functionality)
    console.log('📡 Setting up IPC handlers...');
    setupIpcHandlers();

    // Setup application menu
    setupApplicationMenu();

    // Create the main window
    console.log('🪟 Creating main window...');
    createMainWindow();

    console.log('✅ Electron initialization complete');
  } catch (error) {
    console.error('❌ Failed to initialize Electron app:', error);
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it's common for applications to stay active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create a window when the dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle app termination
app.on('before-quit', () => {
  console.log('🔄 App shutting down, cleaning up...');

  try {
    // Cleanup IPC handlers
    shutdownIPCHandlers();
    console.log('✅ IPC handlers cleaned up');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});

// Handle protocol for deep linking (future feature)
app.setAsDefaultProtocolClient('accenture-mainframe-assistant');

// Additional IPC handlers for window management
ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Development helpers
if (isDev) {
  ipcMain.handle('dev:reload', () => {
    if (mainWindow) {
      mainWindow.reload();
    }
  });

  ipcMain.handle('dev:toggleDevTools', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
export { mainWindow, createMainWindow };