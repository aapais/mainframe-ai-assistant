import { Menu, MenuItemConstructorOptions, app, shell, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Application Menu Template for MVP1
 * 
 * Features:
 * - File operations (Import/Export KB)
 * - Edit operations (Add entry, Search)
 * - View options (Theme, Layout)
 * - Tools (Clear cache, Backup)
 * - Help (Documentation, About)
 */

const isMac = process.platform === 'darwin';
const isDev = process.env.NODE_ENV === 'development';

export function createApplicationMenu(mainWindow: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => {
            mainWindow.webContents.send('navigate', '/settings');
          }
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ] as MenuItemConstructorOptions[]
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New KB Entry',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('action', 'new-kb-entry');
          }
        },
        { type: 'separator' },
        {
          label: 'Import KB...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths[0]) {
              mainWindow.webContents.send('import-kb', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Export KB...',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              defaultPath: `kb-export-${new Date().toISOString().split('T')[0]}.json`,
              filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'CSV Files', extensions: ['csv'] }
              ]
            });
            
            if (!result.canceled && result.filePath) {
              mainWindow.webContents.send('export-kb', result.filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Backup Database',
          click: () => {
            mainWindow.webContents.send('action', 'backup-database');
          }
        },
        {
          label: 'Restore Database...',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Database Files', extensions: ['db', 'sqlite'] }
              ]
            });
            
            if (!result.canceled && result.filePaths[0]) {
              mainWindow.webContents.send('restore-database', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        ...(!isMac ? [
          { role: 'quit' as const }
        ] : [])
      ] as MenuItemConstructorOptions[]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ]),
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow.webContents.send('action', 'focus-search');
          }
        }
      ] as MenuItemConstructorOptions[]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('navigate', '/dashboard');
          }
        },
        {
          label: 'Knowledge Base',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('navigate', '/knowledge-base');
          }
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('navigate', '/search');
          }
        },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Light',
              type: 'radio',
              click: () => {
                mainWindow.webContents.send('set-theme', 'light');
              }
            },
            {
              label: 'Dark',
              type: 'radio',
              click: () => {
                mainWindow.webContents.send('set-theme', 'dark');
              }
            },
            {
              label: 'System',
              type: 'radio',
              checked: true,
              click: () => {
                mainWindow.webContents.send('set-theme', 'system');
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ] as MenuItemConstructorOptions[]
    },

    // Tools menu
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Clear Search History',
          click: () => {
            mainWindow.webContents.send('action', 'clear-search-history');
          }
        },
        {
          label: 'Reset Usage Metrics',
          click: () => {
            mainWindow.webContents.send('action', 'reset-metrics');
          }
        },
        { type: 'separator' },
        {
          label: 'AI Settings',
          click: () => {
            mainWindow.webContents.send('navigate', '/settings#ai');
          }
        },
        {
          label: 'Test AI Connection',
          click: () => {
            mainWindow.webContents.send('action', 'test-ai-connection');
          }
        },
        { type: 'separator' },
        {
          label: 'Database Maintenance',
          submenu: [
            {
              label: 'Optimize Database',
              click: () => {
                mainWindow.webContents.send('action', 'optimize-database');
              }
            },
            {
              label: 'Rebuild Search Index',
              click: () => {
                mainWindow.webContents.send('action', 'rebuild-search-index');
              }
            },
            {
              label: 'Database Statistics',
              click: () => {
                mainWindow.webContents.send('action', 'show-db-stats');
              }
            }
          ]
        },
        ...(isDev ? [
          { type: 'separator' as const },
          {
            label: 'Developer Tools',
            submenu: [
              {
                label: 'Load Sample Data',
                click: () => {
                  mainWindow.webContents.send('action', 'load-sample-data');
                }
              },
              {
                label: 'Clear All Data',
                click: () => {
                  mainWindow.webContents.send('action', 'clear-all-data');
                }
              },
              {
                label: 'Generate Test Entries',
                click: () => {
                  mainWindow.webContents.send('action', 'generate-test-entries');
                }
              }
            ]
          }
        ] : [])
      ] as MenuItemConstructorOptions[]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [])
      ] as MenuItemConstructorOptions[]
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/your-org/mainframe-kb-assistant/wiki');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            mainWindow.webContents.send('action', 'show-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/your-org/mainframe-kb-assistant/issues');
          }
        },
        {
          label: 'Feature Request',
          click: () => {
            shell.openExternal('https://github.com/your-org/mainframe-kb-assistant/discussions');
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: () => {
            mainWindow.webContents.send('action', 'show-logs');
          }
        },
        ...(!isMac ? [
          { type: 'separator' as const },
          {
            label: 'About',
            click: () => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About Mainframe KB Assistant',
                message: 'Mainframe KB Assistant',
                detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\n\nA Knowledge-First assistant for mainframe support teams.`,
                buttons: ['OK']
              });
            }
          }
        ] : [])
      ] as MenuItemConstructorOptions[]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  return menu;
}

/**
 * Context menu for KB entries
 */
export function createKBEntryContextMenu(entryId: string): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Edit Entry',
      click: (menuItem, browserWindow) => {
        browserWindow?.webContents.send('edit-kb-entry', entryId);
      }
    },
    {
      label: 'Duplicate Entry',
      click: (menuItem, browserWindow) => {
        browserWindow?.webContents.send('duplicate-kb-entry', entryId);
      }
    },
    { type: 'separator' },
    {
      label: 'Copy Title',
      click: (menuItem, browserWindow) => {
        browserWindow?.webContents.send('copy-kb-field', { entryId, field: 'title' });
      }
    },
    {
      label: 'Copy Solution',
      click: (menuItem, browserWindow) => {
        browserWindow?.webContents.send('copy-kb-field', { entryId, field: 'solution' });
      }
    },
    { type: 'separator' },
    {
      label: 'View Statistics',
      click: (menuItem, browserWindow) => {
        browserWindow?.webContents.send('view-kb-stats', entryId);
      }
    },
    { type: 'separator' },
    {
      label: 'Delete Entry',
      click: (menuItem, browserWindow) => {
        browserWindow?.webContents.send('delete-kb-entry', entryId);
      }
    }
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Tray menu for system tray icon
 */
export function createTrayMenu(mainWindow: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quick Search',
      accelerator: 'CmdOrCtrl+Space',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('action', 'quick-search');
      }
    },
    { type: 'separator' },
    {
      label: 'New KB Entry',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('action', 'new-kb-entry');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ];

  return Menu.buildFromTemplate(template);
}