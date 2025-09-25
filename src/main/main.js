const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Error logging
const logFile = path.join(__dirname, '../../electron-error.log');
const logError = msg => {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}\n`;
  console.error(logMsg);
  try {
    fs.appendFileSync(logFile, logMsg);
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
};

// Log startup
logError('Starting Electron application...');

// Import API Settings Handler with error handling
let APISettingsHandler;
try {
  const handlerModule = require('./ipc/handlers/APISettingsHandler.js');
  APISettingsHandler = handlerModule.default || handlerModule.APISettingsHandler || handlerModule;
  logError('APISettingsHandler loaded successfully');
} catch (error) {
  logError(`Failed to load APISettingsHandler: ${error.message}\n${error.stack}`);
}

// Keep a global reference of the window object
let mainWindow;
let apiSettingsHandler;

// Security: Disable node integration in renderer
const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
  logError('Creating main window...');

  try {
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
        experimentalFeatures: false,
      },
      // Professional window styling
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#A100FF', // Accenture purple
      autoHideMenuBar: false, // Show menu bar
      frame: true,
      resizable: true,
      maximizable: true,
      minimizable: true,
      closable: true,
    });

    // Load the app - Enhanced loading logic with multiple fallbacks
    const loadApp = async () => {
      const possiblePaths = [
        // First priority: Built React app
        path.join(__dirname, '../../dist/renderer/index.html'),
        // Second priority: Development build
        path.join(__dirname, '../../dist/index.html'),
        // Third priority: Root index.html
        path.join(__dirname, '../../index.html'),
        // Fourth priority: Fallback HTML in main directory
        path.join(__dirname, 'fallback.html'),
      ];

      let indexPath = null;
      let appType = 'unknown';

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          indexPath = testPath;
          if (testPath.includes('dist/renderer')) {
            appType = 'React Production Build';
          } else if (testPath.includes('dist/index.html')) {
            appType = 'Development Build';
          } else if (testPath.includes('index.html')) {
            appType = 'Basic HTML';
          } else {
            appType = 'Fallback HTML';
          }
          break;
        }
      }

      if (!indexPath) {
        logError('CRITICAL: No index.html found anywhere! Creating emergency fallback...');
        await createEmergencyFallback();
        indexPath = path.join(__dirname, 'emergency.html');
        appType = 'Emergency Fallback';
      }

      logError(`Loading ${appType} from: ${indexPath}`);

      try {
        await mainWindow.loadFile(indexPath);
        logError(`Successfully loaded ${appType}`);

        // Send app type info to renderer if it's ready
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('app-loaded', { type: appType, path: indexPath });
          }
        }, 1000);
      } catch (error) {
        logError(`Failed to load ${appType}: ${error.message}`);
        if (appType !== 'Emergency Fallback') {
          logError('Attempting emergency fallback...');
          await createEmergencyFallback();
          await mainWindow.loadFile(path.join(__dirname, 'emergency.html'));
        } else {
          throw new Error('All loading attempts failed');
        }
      }
    };

    // Create emergency fallback HTML
    const createEmergencyFallback = async () => {
      const emergencyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accenture Mainframe AI Assistant - Loading Error</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #A100FF, #6D1B7B);
            color: white;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 40px;
            text-align: center;
            max-width: 600px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            margin-bottom: 20px;
            font-size: 2.5em;
        }
        .logo {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2em;
            color: #A100FF;
            font-weight: bold;
        }
        .error-message {
            background: rgba(255, 0, 0, 0.2);
            border: 1px solid rgba(255, 0, 0, 0.5);
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .instructions {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .button {
            background: #A100FF;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            margin: 5px;
            font-size: 16px;
        }
        .button:hover {
            background: #8A00D4;
        }
        ul {
            text-align: left;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">A</div>
        <h1>Accenture Mainframe AI Assistant</h1>

        <div class="error-message">
            <h3>⚠️ Application Loading Error</h3>
            <p>The React application failed to load. The system is running in emergency fallback mode.</p>
        </div>

        <div class="instructions">
            <h3>🔧 Troubleshooting Steps:</h3>
            <ul>
                <li><strong>Build the app:</strong> Run <code>npm run build</code> in the project directory</li>
                <li><strong>Check React app:</strong> Ensure <code>dist/renderer/index.html</code> exists</li>
                <li><strong>Install dependencies:</strong> Run <code>npm install</code> if needed</li>
                <li><strong>Restart application:</strong> Close and reopen the app after building</li>
            </ul>
        </div>

        <button class="button" onclick="location.reload()">🔄 Retry Loading</button>
        <button class="button" onclick="require('electron').ipcRenderer.invoke('app-quit')">❌ Exit App</button>

        <div style="margin-top: 30px; font-size: 0.9em; opacity: 0.8;">
            <p>Version: 1.0.0 | © 2024 Accenture. All rights reserved.</p>
        </div>
    </div>

    <script>
        // Show build instructions in console
        console.log('=== ACCENTURE MAINFRAME AI ASSISTANT ===');
        console.log('Build Instructions:');
        console.log('1. npm install');
        console.log('2. npm run build');
        console.log('3. Restart application');
        console.log('=====================================');
    </script>
</body>
</html>`;

      try {
        const emergencyPath = path.join(__dirname, 'emergency.html');
        fs.writeFileSync(emergencyPath, emergencyHtml);
        logError('Emergency fallback HTML created');
      } catch (error) {
        logError(`Failed to create emergency fallback: ${error.message}`);
      }
    };

    await loadApp();

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

    logError('Main window created successfully');
  } catch (error) {
    logError(`Failed to create window: ${error.message}\n${error.stack}`);
    throw error;
  }
}

// App event handlers
app.whenReady().then(() => {
  logError('App ready, creating window...');

  try {
    createWindow();
    createApplicationMenu();

    // Initialize API Settings Handler
    if (APISettingsHandler) {
      try {
        apiSettingsHandler = new APISettingsHandler();
        logError('API Settings Handler initialized');
      } catch (error) {
        logError(`Failed to initialize API Settings Handler: ${error.message}`);
      }
    }
  } catch (error) {
    logError(`Failed in app.whenReady: ${error.message}\n${error.stack}`);
  }

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
  if (apiSettingsHandler && typeof apiSettingsHandler.unregisterHandlers === 'function') {
    try {
      apiSettingsHandler.unregisterHandlers();
    } catch (error) {
      logError(`Failed to cleanup API Settings Handler: ${error.message}`);
    }
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
          },
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
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('menu-import-file', result.filePaths[0]);
            }
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
      label: 'Search',
      submenu: [
        {
          label: 'Find in Knowledge Base',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-search');
            }
          },
        },
        {
          label: 'Advanced Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-advanced-search');
            }
          },
        },
      ],
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
          },
        },
        {
          label: 'Database Backup',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              defaultPath: `mainframe-backup-${new Date().toISOString().split('T')[0]}.json`,
              filters: [{ name: 'JSON', extensions: ['json'] }],
            });

            if (!result.canceled) {
              mainWindow.webContents.send('menu-backup', result.filePath);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'API Settings',
          accelerator: 'CmdOrCtrl+Alt+A',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-api-settings');
            }
          },
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-settings');
            }
          },
        },
      ],
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
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'User Guide',
          click: () => {
            shell.openExternal('https://www.accenture.com/mainframe-ai-assistant/help');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://www.accenture.com/mainframe-ai-assistant/support');
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
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });

    // Edit menu
    template[2].submenu.push(
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }],
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
        { role: 'front' },
      ],
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
app.on('before-quit', event => {
  logError('App is quitting...');
  // Perform cleanup here if needed
});

// Global error handlers
process.on('uncaughtException', error => {
  logError(`Uncaught Exception: ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}\nReason: ${reason}`);
});

app.on('render-process-gone', (event, webContents, details) => {
  logError(`Render process gone: ${JSON.stringify(details)}`);
});

app.on('child-process-gone', (event, details) => {
  logError(`Child process gone: ${JSON.stringify(details)}`);
});

// Export for testing
module.exports = { createWindow, app };
