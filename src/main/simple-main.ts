import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { registerSimpleIPCHandlers } from './simple-ipc-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

class SimpleMainframeApp {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    // Initialize app when ready
    app.whenReady().then(() => {
      this.createWindow();
      this.setupIPC();
      this.createMenu();

      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  private createWindow(): void {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      height: 800,
      width: 1200,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
      },
      icon: path.join(__dirname, '../../assets/icon.png'), // Add app icon if available
      title: 'Mainframe AI Assistant',
      show: false, // Don't show until ready
    });

    // Load the app
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();

      // Focus on window
      if (this.mainWindow) {
        this.mainWindow.focus();
      }
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIPC(): void {
    // Register our simple IPC handlers
    registerSimpleIPCHandlers();
    console.log('✅ Simple IPC handlers registered');
  }

  private createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Entry',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-entry');
            },
          },
          { type: 'separator' },
          {
            label: 'Import Knowledge Base',
            click: () => {
              this.mainWindow?.webContents.send('menu-import-kb');
            },
          },
          {
            label: 'Export Knowledge Base',
            click: () => {
              this.mainWindow?.webContents.send('menu-export-kb');
            },
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
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
          { role: 'selectall' },
        ],
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
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Search Knowledge Base',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              this.mainWindow?.webContents.send('menu-focus-search');
            },
          },
          { type: 'separator' },
          {
            label: 'Database Statistics',
            click: () => {
              this.mainWindow?.webContents.send('menu-show-stats');
            },
          },
          {
            label: 'Performance Monitor',
            click: () => {
              this.mainWindow?.webContents.send('menu-show-performance');
            },
          },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => {
              this.mainWindow?.webContents.send('menu-show-about');
            },
          },
          {
            label: 'Keyboard Shortcuts',
            accelerator: 'CmdOrCtrl+?',
            click: () => {
              this.mainWindow?.webContents.send('menu-show-shortcuts');
            },
          },
        ],
      },
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services', submenu: [] },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      });

      // Window menu
      template.push({
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'close' }],
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

// Start the application
new SimpleMainframeApp();

// Make sure app quits when all windows are closed on Windows/Linux
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    navigationEvent.preventDefault();
    console.warn('Blocked new window creation to:', navigationURL);
  });
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (process.env.NODE_ENV === 'development') {
    // In development, ignore certificate errors
    event.preventDefault();
    callback(true);
  } else {
    // In production, use default behavior
    callback(false);
  }
});

console.log('🚀 Simple Mainframe Assistant starting...');
