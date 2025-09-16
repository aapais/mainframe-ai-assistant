const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// Import API Settings Handler
const APISettingsHandler = require('./ipc/handlers/APISettingsHandler.js');

// Keep a global reference of the window object
let mainWindow;
let apiSettingsHandler;

// Security: Disable node integration in renderer
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Create the browser window with Accenture branding
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../../build/icon.png'),
    title: 'Accenture Mainframe AI Assistant',
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true, // Security best practice
      enableRemoteModule: false, // Security best practice
      preload: path.join(__dirname, 'preload.js'), // Secure communication
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    // Professional window styling
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#A100FF', // Accenture purple
    autoHideMenuBar: false, // Show menu bar
    frame: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true
  });

  // Load the app - Production path
  const indexPath = path.join(__dirname, '../../index.html');
  mainWindow.loadFile(indexPath);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // Only open dev tools in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Only allow file:// protocol for security
    if (!navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Security: Prevent new window creation
  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createApplicationMenu();

  // Initialize API Settings Handler
  apiSettingsHandler = new APISettingsHandler();

  // macOS specific: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Cleanup API Settings Handler
  if (apiSettingsHandler) {
    apiSettingsHandler.unregisterHandlers();
  }

  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Additional web contents protection
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    // Disable node integration
    webPreferences.nodeIntegration = false;
  });
});

// Create application menu
function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Knowledge Entry',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-entry');
            }
          }
        },
        {
          label: 'Import Data',
          accelerator: 'CmdOrCtrl+I',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'CSV', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('menu-import-file', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
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
      label: 'Search',
      submenu: [
        {
          label: 'Find in Knowledge Base',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-search');
            }
          }
        },
        {
          label: 'Advanced Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-advanced-search');
            }
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Performance Monitor',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-performance');
            }
          }
        },
        {
          label: 'Database Backup',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              defaultPath: `mainframe-backup-${new Date().toISOString().split('T')[0]}.json`,
              filters: [
                { name: 'JSON', extensions: ['json'] }
              ]
            });

            if (!result.canceled) {
              mainWindow.webContents.send('menu-backup', result.filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'API Settings',
          accelerator: 'CmdOrCtrl+Alt+A',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-api-settings');
            }
          }
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-settings');
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Accenture Mainframe AI Assistant',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Accenture Mainframe AI Assistant',
              detail: `Version: ${app.getVersion()}\nEnterprise Knowledge Management & AI-Powered Search\n\n© 2024 Accenture. All rights reserved.`,
              buttons: ['OK']
            });
          }
        },
        {
          label: 'User Guide',
          click: () => {
            shell.openExternal('https://www.accenture.com/mainframe-ai-assistant/help');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://www.accenture.com/mainframe-ai-assistant/support');
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
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
    });

    // Edit menu
    template[2].submenu.push(
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [
          { role: 'startspeaking' },
          { role: 'stopspeaking' }
        ]
      }
    );

    // Window menu
    template.splice(5, 0, {
      label: 'Window',
      submenu: [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for secure communication
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('app-quit', () => {
  app.quit();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Handle app updates (for future implementation)
ipcMain.handle('check-for-updates', () => {
  return { updateAvailable: false };
});

// Graceful shutdown
app.on('before-quit', (event) => {
  // Perform cleanup here if needed
});

// Export for testing
module.exports = { createWindow, app };