// Global test configuration
export default async () => {
  console.log('🧪 Setting up comprehensive test environment...');

  // Performance monitoring setup
  global.performance = global.performance || {
    now: () => Date.now(),
  };

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  console.log('✅ Test environment ready');
};
