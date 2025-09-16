/**
 * Mock Electron for Integration Tests
 */

const { EventEmitter } = require('events');

// Mock IPC Renderer
const ipcRenderer = {
  invoke: jest.fn().mockResolvedValue({}),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),
  postMessage: jest.fn(),
  sendSync: jest.fn().mockReturnValue({})
};

// Mock IPC Main
const ipcMain = new EventEmitter();
Object.assign(ipcMain, {
  handle: jest.fn(),
  handleOnce: jest.fn(),
  removeHandler: jest.fn()
});

// Mock App
const app = {
  getPath: jest.fn((name) => {
    switch (name) {
      case 'userData': return '/tmp/test-user-data';
      case 'appData': return '/tmp/test-app-data';
      case 'temp': return '/tmp';
      default: return '/tmp/test';
    }
  }),
  getName: jest.fn(() => 'Test App'),
  getVersion: jest.fn(() => '1.0.0-test'),
  quit: jest.fn(),
  exit: jest.fn(),
  focus: jest.fn(),
  hide: jest.fn(),
  show: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  whenReady: jest.fn().mockResolvedValue(),
  isReady: jest.fn(() => true)
};

// Mock BrowserWindow
class BrowserWindow extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = Math.random();
    this.webContents = {
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      executeJavaScript: jest.fn().mockResolvedValue(),
      insertCSS: jest.fn().mockResolvedValue(),
      openDevTools: jest.fn(),
      closeDevTools: jest.fn(),
      isDevToolsOpened: jest.fn(() => false),
      session: {
        clearCache: jest.fn().mockResolvedValue(),
        clearStorageData: jest.fn().mockResolvedValue()
      }
    };
  }

  loadFile(filePath) {
    return Promise.resolve();
  }

  loadURL(url) {
    return Promise.resolve();
  }

  show() {}
  hide() {}
  close() {}
  focus() {}
  blur() {}
  isFocused() { return true; }
  isDestroyed() { return false; }
  isVisible() { return true; }
  isMinimized() { return false; }
  isMaximized() { return false; }
  isFullScreen() { return false; }
  setTitle(title) {}
  getTitle() { return 'Test Window'; }
}

// Mock Menu
const Menu = {
  buildFromTemplate: jest.fn(() => ({})),
  setApplicationMenu: jest.fn(),
  getApplicationMenu: jest.fn(() => ({})),
  popup: jest.fn()
};

// Mock dialog
const dialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  showErrorBox: jest.fn(),
  showCertificateTrustDialog: jest.fn().mockResolvedValue()
};

// Mock shell
const shell = {
  openExternal: jest.fn().mockResolvedValue(),
  openPath: jest.fn().mockResolvedValue(''),
  showItemInFolder: jest.fn(),
  moveItemToTrash: jest.fn().mockReturnValue(true),
  beep: jest.fn()
};

// Mock clipboard
const clipboard = {
  readText: jest.fn(() => ''),
  writeText: jest.fn(),
  readHTML: jest.fn(() => ''),
  writeHTML: jest.fn(),
  readImage: jest.fn(),
  writeImage: jest.fn(),
  clear: jest.fn()
};

// Mock nativeTheme
const nativeTheme = {
  shouldUseDarkColors: false,
  themeSource: 'system',
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn()
};

// Mock screen
const screen = {
  getPrimaryDisplay: jest.fn(() => ({
    workAreaSize: { width: 1920, height: 1080 },
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }
  })),
  getAllDisplays: jest.fn(() => []),
  getDisplayNearestPoint: jest.fn(),
  getDisplayMatching: jest.fn(),
  getCursorScreenPoint: jest.fn(() => ({ x: 0, y: 0 })),
  on: jest.fn(),
  removeListener: jest.fn()
};

// Export all mocked modules
module.exports = {
  ipcRenderer,
  ipcMain,
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  clipboard,
  nativeTheme,
  screen,
  // Additional electron modules
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  webSecurity: {
    disable: jest.fn()
  },
  protocol: {
    registerFileProtocol: jest.fn(),
    registerHttpProtocol: jest.fn(),
    registerStringProtocol: jest.fn(),
    registerBufferProtocol: jest.fn(),
    registerStreamProtocol: jest.fn(),
    isProtocolHandled: jest.fn().mockReturnValue(false)
  }
};