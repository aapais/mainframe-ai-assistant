const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getVersion: () => ipcRenderer.invoke('app-version'),

  // Window controls
  quit: () => ipcRenderer.invoke('app-quit'),

  // Dialog methods
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Update checking
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Menu event listeners
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-new-entry', callback);
    ipcRenderer.on('menu-import-file', callback);
    ipcRenderer.on('menu-search', callback);
    ipcRenderer.on('menu-advanced-search', callback);
    ipcRenderer.on('menu-performance', callback);
    ipcRenderer.on('menu-backup', callback);
    ipcRenderer.on('menu-settings', callback);
    ipcRenderer.on('menu-api-settings', callback);
  },

  // Remove menu listeners
  removeMenuListeners: () => {
    ipcRenderer.removeAllListeners('menu-new-entry');
    ipcRenderer.removeAllListeners('menu-import-file');
    ipcRenderer.removeAllListeners('menu-search');
    ipcRenderer.removeAllListeners('menu-advanced-search');
    ipcRenderer.removeAllListeners('menu-performance');
    ipcRenderer.removeAllListeners('menu-backup');
    ipcRenderer.removeAllListeners('menu-settings');
    ipcRenderer.removeAllListeners('menu-api-settings');
  },

  // API Settings IPC methods
  invoke: (channel, ...args) => {
    // Whitelist of allowed channels for security
    const allowedChannels = [
      'api-settings:get-providers',
      'api-settings:get-provider',
      'api-settings:get-keys',
      'api-settings:store-key',
      'api-settings:delete-key',
      'api-settings:update-key-status',
      'api-settings:test-connection',
      'api-settings:test-stored-key',
      'api-settings:get-usage-stats',
      'api-settings:record-usage',
      'api-settings:import-from-env',
      'api-settings:export-configuration',
      'api-settings:clear-all-keys',
      'api-settings:validate-key-format',
      'api-settings:get-session-keys',
      'api-settings:clear-session-keys'
    ];

    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    } else {
      throw new Error(`Channel ${channel} is not allowed`);
    }
  }
});

// Security: Remove any node.js APIs that shouldn't be accessible
delete window.require;
delete window.exports;
delete window.module;

console.log('Preload script loaded successfully');