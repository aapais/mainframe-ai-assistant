# Electron Window Management Tests

Comprehensive test suite for Electron window management functionality, covering all aspects of window lifecycle, behavior, and performance.

## Test Structure

### Core Test Files

1. **window-lifecycle.test.ts** - Window creation, initialization, and destruction
2. **window-state-management.test.ts** - Window state transitions and persistence
3. **multi-window-communication.test.ts** - Multi-window scenarios and IPC communication
4. **window-positioning-display.test.ts** - Display management and window positioning
5. **fullscreen-kiosk-modes.test.ts** - Full-screen and kiosk mode functionality
6. **window-close-prevention.test.ts** - Close prevention and confirmation handling
7. **cross-platform-behavior.test.ts** - Platform-specific window behaviors
8. **window-memory-performance.test.ts** - Memory management and performance testing

### Utilities and Configuration

- **window-test-utils.ts** - Testing utilities, helpers, and factories
- **setup-electron-tests.ts** - Test environment setup and global configuration
- **setup-electron-env.js** - Environment variables and system configuration
- **jest.config.electron.js** - Jest configuration for Electron tests

## Test Coverage Areas

### 🔄 Window Lifecycle
- ✅ Window creation and configuration
- ✅ Window initialization and preload scripts
- ✅ Window destruction and cleanup
- ✅ Memory management and leak prevention
- ✅ Error handling and recovery

### 🎛️ Window State Management
- ✅ Minimize, maximize, restore operations
- ✅ Window state persistence across sessions
- ✅ State transitions and validation
- ✅ Cross-platform state handling
- ✅ State recovery after crashes

### 🔗 Multi-Window Communication
- ✅ Inter-window IPC messaging
- ✅ Window coordination and synchronization
- ✅ Parent-child window relationships
- ✅ Modal and dialog management
- ✅ Focus management across windows

### 📐 Window Positioning & Display
- ✅ Multi-display window positioning
- ✅ Display detection and management
- ✅ DPI scaling and high-resolution support
- ✅ Display configuration changes
- ✅ Window bounds validation

### 🖥️ Full-Screen & Kiosk Modes
- ✅ Full-screen mode transitions
- ✅ Kiosk mode implementation
- ✅ Multi-display full-screen scenarios
- ✅ Escape mechanisms and exit handling
- ✅ Performance in full-screen modes

### ⚠️ Close Prevention & Confirmation
- ✅ Close prevention mechanisms
- ✅ User confirmation dialogs
- ✅ Unsaved changes detection
- ✅ Application quit handling
- ✅ Modal close behavior

### 🌐 Cross-Platform Behavior
- ✅ Windows, macOS, Linux specific behaviors
- ✅ Platform-specific window decorations
- ✅ OS-specific keyboard shortcuts
- ✅ Native menu integration
- ✅ Accessibility features

### ⚡ Memory & Performance
- ✅ Memory leak detection
- ✅ Performance optimization validation
- ✅ Resource cleanup verification
- ✅ Long-running session stability
- ✅ Performance benchmarking

## Running Tests

### All Electron Tests
```bash
npm run test:electron
```

### Specific Test Files
```bash
# Window lifecycle tests
npm test -- tests/integration/electron/window-lifecycle.test.ts

# State management tests
npm test -- tests/integration/electron/window-state-management.test.ts

# Multi-window communication tests
npm test -- tests/integration/electron/multi-window-communication.test.ts

# Performance tests
npm test -- tests/integration/electron/window-memory-performance.test.ts
```

### With Coverage
```bash
npm run test:electron -- --coverage
```

### Watch Mode
```bash
npm run test:electron -- --watch
```

### Debug Mode
```bash
DEBUG_ELECTRON_TESTS=true npm run test:electron
```

## Test Configuration

### Environment Variables

```bash
# Test environment
NODE_ENV=test
ELECTRON_DISABLE_SECURITY_WARNINGS=true
ELECTRON_ENABLE_LOGGING=false

# Performance settings
ELECTRON_MAX_MEMORY=512
ELECTRON_RENDERER_PROCESS_LIMIT=4

# Debug settings
DEBUG_ELECTRON_TESTS=false
VERBOSE_TESTS=false
ENABLE_PERFORMANCE_METRICS=true
ENABLE_MEMORY_MONITORING=true
```

### Jest Configuration

- **Test Environment**: Node.js with Electron mocks
- **Test Timeout**: 30 seconds
- **Coverage Threshold**: 75% (80% for window modules)
- **Parallel Execution**: 50% of available workers
- **Memory Monitoring**: Enabled with GC optimization

## Test Utilities

### WindowTestFactory
Factory for creating test windows with automatic cleanup:
```typescript
const factory = WindowTestFactory.getInstance();
const window = await factory.createTestWindow({
  type: 'main',
  config: { width: 800, height: 600 },
  autoCleanup: true
});
```

### PlatformTestHelper
Cross-platform testing utilities:
```typescript
await PlatformTestHelper.testAcrossPlatforms(async (platform) => {
  // Test implementation for each platform
});
```

### PerformanceTestHelper
Performance measurement and benchmarking:
```typescript
const { result, duration } = await PerformanceTestHelper.measureTime(
  'operation-name',
  async () => {
    // Operation to measure
  }
);
```

### WindowStateAssertions
Window state validation utilities:
```typescript
WindowStateAssertions.assertWindowState(window, {
  isVisible: true,
  isMinimized: false,
  bounds: expectedBounds
});
```

## Mock Configuration

The test suite uses comprehensive Electron mocks that simulate:

- **BrowserWindow**: Complete window lifecycle and state management
- **IPC**: Inter-process communication channels
- **Screen API**: Multi-display scenarios and configuration changes
- **App Events**: Application lifecycle and quit handling
- **Dialog API**: User confirmation and file dialogs
- **Menu System**: Native menu integration

## Performance Benchmarks

### Target Performance Metrics

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Window Creation | < 500ms | Single window |
| State Change | < 10ms | Minimize/maximize/restore |
| Window Destruction | < 100ms | Complete cleanup |
| Batch Operations | < 2000ms | 100 operations |
| Memory per Window | < 10MB | Heap usage |
| Memory Leak | < 10MB | 20 window cycle |

### Memory Management

- **Leak Detection**: Automated detection of memory leaks
- **Garbage Collection**: Forced GC for accurate measurements
- **Resource Tracking**: Comprehensive resource cleanup verification
- **Long-Running Tests**: Multi-minute session stability tests

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout in jest config or use `jest.setTimeout()`
2. **Memory Issues**: Enable GC with `--expose-gc` flag
3. **Platform Issues**: Use `PlatformTestHelper.mockPlatform()` for testing
4. **Mock Issues**: Verify Electron mock setup in `setup-electron-tests.ts`

### Debug Tips

1. Enable verbose logging: `VERBOSE_TESTS=true`
2. Enable debug mode: `DEBUG_ELECTRON_TESTS=true`
3. Monitor memory: `ENABLE_MEMORY_MONITORING=true`
4. Use `--detectOpenHandles` to find resource leaks

## Contributing

When adding new window management tests:

1. **Follow existing patterns** in test structure and naming
2. **Use test utilities** from `window-test-utils.ts`
3. **Add cleanup logic** to prevent resource leaks
4. **Include performance measurements** for critical operations
5. **Test across platforms** using `PlatformTestHelper`
6. **Update this README** with new test coverage areas

## Test Reports

Test results are generated in multiple formats:

- **HTML Report**: `coverage/electron/html-report/electron-test-report.html`
- **JUnit XML**: `coverage/electron/electron-test-results.xml`
- **Coverage Report**: `coverage/electron/lcov-report/index.html`
- **Performance Metrics**: Console output with timing statistics

---

This comprehensive test suite ensures robust, performant, and cross-platform compatible window management functionality for the Electron application.