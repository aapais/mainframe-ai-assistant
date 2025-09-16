/**
 * Jest setup for native dialog tests
 * Configures Electron testing environment and mocks
 */

const { app, BrowserWindow } = require('electron');

// Global test timeout
jest.setTimeout(30000);

// Mock Electron modules if not in actual Electron environment
if (!process.versions.electron) {
  // Mock Electron app
  jest.mock('electron', () => ({
    app: {
      isReady: jest.fn(() => true),
      whenReady: jest.fn(() => Promise.resolve()),
      quit: jest.fn(),
      getPath: jest.fn((name) => {
        const paths = {
          home: '/home/user',
          documents: '/home/user/Documents',
          downloads: '/home/user/Downloads',
          temp: '/tmp'
        };
        return paths[name] || '/tmp';
      })
    },

    BrowserWindow: jest.fn().mockImplementation((options = {}) => ({
      loadURL: jest.fn(),
      loadFile: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      close: jest.fn(),
      destroy: jest.fn(),
      isDestroyed: jest.fn(() => false),
      isVisible: jest.fn(() => true),
      isModal: jest.fn(() => options.modal || false),
      getParentWindow: jest.fn(() => options.parent || null),
      getSize: jest.fn(() => [options.width || 800, options.height || 600]),
      webContents: {
        executeJavaScript: jest.fn(() => Promise.resolve()),
        send: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      },
      on: jest.fn(),
      removeListener: jest.fn()
    })),

    dialog: {
      showOpenDialog: jest.fn(),
      showSaveDialog: jest.fn(),
      showMessageBox: jest.fn(),
      showErrorBox: jest.fn(),
      showCertificateTrustDialog: jest.fn()
    },

    ipcMain: {
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      handle: jest.fn(),
      handleOnce: jest.fn()
    },

    ipcRenderer: {
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      invoke: jest.fn()
    },

    shell: {
      openExternal: jest.fn(),
      openPath: jest.fn(),
      showItemInFolder: jest.fn()
    }
  }));
}

// Global setup for all tests
beforeAll(async () => {
  // Initialize Electron app if in Electron environment
  if (process.versions.electron && !app.isReady()) {
    await app.whenReady();
  }

  // Set up global test data
  global.testData = {
    sampleFilePaths: [
      '/home/user/document1.txt',
      '/home/user/document2.pdf',
      '/home/user/image.jpg'
    ],
    sampleDirectories: [
      '/home/user/Documents',
      '/home/user/Downloads',
      '/home/user/Pictures'
    ],
    commonDialogOptions: {
      info: {
        type: 'info',
        title: 'Information',
        message: 'This is an info message',
        buttons: ['OK']
      },
      warning: {
        type: 'warning',
        title: 'Warning',
        message: 'This is a warning message',
        buttons: ['OK', 'Cancel']
      },
      error: {
        type: 'error',
        title: 'Error',
        message: 'This is an error message',
        buttons: ['OK']
      },
      question: {
        type: 'question',
        title: 'Question',
        message: 'Do you want to continue?',
        buttons: ['Yes', 'No']
      }
    }
  };
});

// Clean up after all tests
afterAll(async () => {
  // Clean up Electron app
  if (process.versions.electron && app.isReady()) {
    // Close all open windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });

    // Quit app
    app.quit();
  }

  // Clean up global test data
  delete global.testData;
});

// Custom matchers for dialog testing
expect.extend({
  toBeValidDialogResponse(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.canceled === 'boolean';

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid dialog response`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid dialog response with 'canceled' property`,
        pass: false
      };
    }
  },

  toBeFileDialogResponse(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.canceled === 'boolean' &&
                 (received.canceled || Array.isArray(received.filePaths) || typeof received.filePath === 'string');

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid file dialog response`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid file dialog response with filePaths or filePath`,
        pass: false
      };
    }
  },

  toBeMessageBoxResponse(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.response === 'number';

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid message box response`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid message box response with 'response' number`,
        pass: false
      };
    }
  }
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Console override for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out expected Electron warnings during tests
  const message = args.join(' ');
  if (message.includes('Electron Security Warning') ||
      message.includes('allowRendererProcessReuse')) {
    return;
  }
  originalConsoleError(...args);
};

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';