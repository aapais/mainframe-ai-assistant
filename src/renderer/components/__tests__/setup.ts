import '@testing-library/jest-dom';

// Mock window.electronAPI
const mockElectronAPI = {
  // KB Entry operations
  addKBEntry: jest.fn().mockResolvedValue({ id: 'test-123', success: true }),
  updateKBEntry: jest.fn().mockResolvedValue({ success: true }),
  deleteKBEntry: jest.fn().mockResolvedValue({ success: true }),
  getKBEntry: jest.fn().mockResolvedValue(null),
  searchKBEntries: jest.fn().mockResolvedValue([]),
  
  // Validation operations
  validateKBEntry: jest.fn().mockResolvedValue({ valid: true }),
  searchSimilarEntries: jest.fn().mockResolvedValue([]),
  
  // User preferences
  getUserPreferences: jest.fn().mockResolvedValue({}),
  setUserPreferences: jest.fn().mockResolvedValue(undefined),
  
  // File operations
  saveFile: jest.fn().mockResolvedValue({ success: true }),
  loadFile: jest.fn().mockResolvedValue({ success: true, data: {} }),
  
  // System operations
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  showSaveDialog: jest.fn().mockResolvedValue({ filePath: '/test/path' }),
  showOpenDialog: jest.fn().mockResolvedValue({ filePaths: ['/test/path'] }),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    // Mock implementation
  }
  
  observe(target: Element, options?: ResizeObserverOptions) {
    // Mock implementation
  }
  
  unobserve(target: Element) {
    // Mock implementation
  }
  
  disconnect() {
    // Mock implementation
  }
}

global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    // Mock implementation
  }
  
  observe(target: Element) {
    // Mock implementation
  }
  
  unobserve(target: Element) {
    // Mock implementation
  }
  
  disconnect() {
    // Mock implementation
  }
}

global.IntersectionObserver = MockIntersectionObserver;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 16);
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Mock getComputedStyle
global.getComputedStyle = jest.fn().mockImplementation(() => ({
  getPropertyValue: jest.fn().mockReturnValue(''),
  setProperty: jest.fn(),
}));

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Suppress known React warnings that are not relevant to tests
  const message = args[0];
  if (typeof message === 'string') {
    if (
      message.includes('Warning: ReactDOM.render is no longer supported') ||
      message.includes('Warning: An invalid form control') ||
      message.includes('Warning: validateDOMNesting')
    ) {
      return;
    }
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  // Suppress known warnings
  const message = args[0];
  if (typeof message === 'string') {
    if (
      message.includes('componentWillReceiveProps has been renamed') ||
      message.includes('componentWillMount has been renamed')
    ) {
      return;
    }
  }
  originalConsoleWarn(...args);
};

// Mock window.confirm and window.alert for tests
window.confirm = jest.fn().mockReturnValue(true);
window.alert = jest.fn();

// Mock localStorage and sessionStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock(),
});

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageMock(),
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File API
global.File = class MockFile {
  constructor(
    public parts: (string | Blob | ArrayBuffer | ArrayBufferView)[],
    public name: string,
    public options: FilePropertyBag = {}
  ) {}

  get size() {
    return this.parts.reduce((acc, part) => {
      if (typeof part === 'string') {
        return acc + part.length;
      }
      return acc + (part as any).length || 0;
    }, 0);
  }

  get type() {
    return this.options.type || '';
  }

  get lastModified() {
    return this.options.lastModified || Date.now();
  }
} as any;

// Mock FileReader
global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  readyState: number = 0;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsText(file: Blob | File) {
    this.readyState = 2;
    this.result = 'mock file content';
    if (this.onload) {
      this.onload({} as any);
    }
  }

  readAsArrayBuffer(file: Blob | File) {
    this.readyState = 2;
    this.result = new ArrayBuffer(8);
    if (this.onload) {
      this.onload({} as any);
    }
  }

  readAsDataURL(file: Blob | File) {
    this.readyState = 2;
    this.result = 'data:text/plain;base64,bW9jayBmaWxlIGNvbnRlbnQ=';
    if (this.onload) {
      this.onload({} as any);
    }
  }

  abort() {
    this.readyState = 2;
    if (this.onabort) {
      this.onabort({} as any);
    }
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
} as any;

// Setup for testing async components
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset localStorage/sessionStorage
  (window.localStorage as any).clear();
  (window.sessionStorage as any).clear();
  
  // Reset electronAPI mocks
  Object.values(mockElectronAPI).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
});

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to simulate user typing with delay
  simulateTyping: async (element: HTMLElement, text: string) => {
    for (const char of text) {
      element.focus();
      (element as HTMLInputElement).value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await global.testUtils.waitFor(10);
    }
  },
  
  // Helper to create mock KB entry
  createMockKBEntry: (overrides = {}) => ({
    id: 'mock-entry-123',
    title: 'Mock KB Entry',
    problem: 'This is a mock problem description',
    solution: 'This is a mock solution description',
    category: 'VSAM',
    tags: ['mock', 'test'],
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    usage_count: 0,
    success_count: 0,
    failure_count: 0,
    ...overrides
  }),
  
  // Helper to create mock form data
  createMockFormData: (overrides = {}) => ({
    title: 'Test Entry Title',
    problem: 'Test problem description that meets minimum length requirements',
    solution: 'Test solution description that meets minimum length requirements',
    category: 'VSAM',
    tags: ['test', 'mock'],
    ...overrides
  })
};

// Export mock electronAPI for direct use in tests
export { mockElectronAPI };