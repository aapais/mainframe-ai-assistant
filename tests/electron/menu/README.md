# Electron Menu Testing Suite

A comprehensive testing suite for Electron application menu functionality, covering all aspects of menu interactions, keyboard shortcuts, platform-specific behaviors, and accessibility compliance.

## 🎯 Overview

This testing suite provides thorough coverage of the Electron application's menu system including:

- **Application Menu Testing** - Complete validation of menu structure and functionality
- **Context Menu Testing** - KB entry-specific context menu interactions
- **Tray Menu Testing** - System tray integration and quick actions
- **Keyboard Shortcuts** - Accelerator validation and cross-platform compatibility
- **Dynamic Menu Updates** - State-based menu changes and real-time synchronization
- **Platform-Specific Behavior** - macOS, Windows, and Linux menu conventions

## 📁 Test Structure

```
tests/electron/menu/
├── menu-interactions.test.ts      # Application menu tests
├── context-menu.test.ts          # Context menu tests
├── tray-menu.test.ts             # System tray menu tests
├── keyboard-shortcuts.test.ts    # Accelerator and shortcut tests
├── dynamic-menu-updates.test.ts  # Dynamic menu behavior tests
├── platform-specific.test.ts     # Platform-specific menu tests
├── utils/
│   └── MenuTestUtils.ts          # Testing utilities and helpers
├── __mocks__/
│   └── electron-updater.js       # Mock for electron-updater
├── setup.ts                      # Global test setup and configuration
├── jest.config.menu.js          # Jest configuration for menu tests
├── menu-test-runner.ts          # Comprehensive test runner
└── README.md                    # This file
```

## 🚀 Running Tests

### Quick Start

```bash
# Run all menu tests
npm run test:menu

# Run specific test suite
npm run test:menu:interactions
npm run test:menu:context
npm run test:menu:tray
npm run test:menu:shortcuts
npm run test:menu:dynamic
npm run test:menu:platform

# Run with coverage
npm run test:menu:coverage

# Run in watch mode
npm run test:menu:watch
```

### Advanced Usage

```bash
# Run with custom test runner
npx tsx tests/electron/menu/menu-test-runner.ts

# Run specific suite
npx tsx tests/electron/menu/menu-test-runner.ts --suite=menu-interactions

# Run with detailed output
npx tsx tests/electron/menu/menu-test-runner.ts --verbose

# Run without coverage
npx tsx tests/electron/menu/menu-test-runner.ts --no-coverage

# Run sequentially (instead of parallel)
npx tsx tests/electron/menu/menu-test-runner.ts --sequential

# Stop on first failure
npx tsx tests/electron/menu/menu-test-runner.ts --bail
```

## 📋 Test Categories

### 1. Application Menu Tests (`menu-interactions.test.ts`)

Tests the main application menu functionality:

- ✅ Menu creation and structure validation
- ✅ File menu operations (New, Import, Export, Backup)
- ✅ Edit menu operations (Cut, Copy, Paste, Find)
- ✅ View menu operations (Navigation, Theme selection)
- ✅ Tools menu operations (Maintenance, AI settings)
- ✅ Help menu operations (Documentation, About)
- ✅ Platform-specific menu items (macOS app menu vs Windows/Linux)
- ✅ IPC message verification for menu actions

### 2. Context Menu Tests (`context-menu.test.ts`)

Tests context menu functionality for KB entries:

- ✅ Context menu creation and structure
- ✅ Entry-specific actions (Edit, Duplicate, Delete)
- ✅ Copy operations (Title, Solution)
- ✅ View statistics functionality
- ✅ Menu state management
- ✅ Error handling and graceful degradation
- ✅ Performance optimization

### 3. Tray Menu Tests (`tray-menu.test.ts`)

Tests system tray menu integration:

- ✅ Tray menu creation and essential items
- ✅ Quick actions (Show App, Quick Search, New Entry)
- ✅ Window management from tray
- ✅ System integration and platform compatibility
- ✅ Accessibility and keyboard shortcuts
- ✅ Performance monitoring

### 4. Keyboard Shortcuts Tests (`keyboard-shortcuts.test.ts`)

Tests keyboard shortcut and accelerator functionality:

- ✅ Accelerator registration and validation
- ✅ Cross-platform accelerator compatibility (CmdOrCtrl)
- ✅ Platform-specific shortcuts (Cmd+, on macOS)
- ✅ Conflict detection and resolution
- ✅ Global shortcut registration
- ✅ Accessibility compliance (WCAG guidelines)
- ✅ Dynamic shortcut management

### 5. Dynamic Menu Updates Tests (`dynamic-menu-updates.test.ts`)

Tests dynamic menu behavior and state synchronization:

- ✅ Theme-based menu updates
- ✅ Application state-based enabling/disabling
- ✅ Real-time menu synchronization
- ✅ Context-dependent menu behavior
- ✅ User permission-based menu adaptation
- ✅ Performance optimization with caching
- ✅ Error handling in dynamic updates

### 6. Platform-Specific Tests (`platform-specific.test.ts`)

Tests platform-specific menu behaviors:

- ✅ macOS-specific menu structure (app menu, speech, etc.)
- ✅ Windows/Linux menu structure (quit in file menu)
- ✅ Platform-specific accelerators and conventions
- ✅ Cross-platform consistency validation
- ✅ Dialog integration differences
- ✅ Accessibility guidelines per platform

## 🛠 Test Utilities

### MenuTestUtils Class

The `MenuTestUtils` class provides comprehensive utilities for menu testing:

```typescript
// Accelerator validation and extraction
menuTestUtils.extractAccelerators(template)
menuTestUtils.isValidAccelerator('CmdOrCtrl+S')
menuTestUtils.convertAcceleratorForPlatform('CmdOrCtrl+S', 'darwin')

// Menu structure validation
menuTestUtils.validateMenuStructure(template)
menuTestUtils.findMenuItemByLabel(template, 'New KB Entry')
menuTestUtils.isMenuItemEnabled(menu, 'Export KB...')

// State simulation
menuTestUtils.createMenuWithState(window, { hasKBEntries: true })
menuTestUtils.createMenuForRole(window, 'admin')
menuTestUtils.createMenuWithSelection(window, { hasSelection: true })

// Performance testing
menuTestUtils.measureMenuCreationTime(createMenuFn, 100)
menuTestUtils.measureMenuMemoryUsage(createMenuFn, 1000)
```

## 🎨 Custom Jest Matchers

The test suite includes custom Jest matchers for menu-specific validation:

```typescript
// Validate menu template structure
expect(menuTemplate).toBeValidMenuTemplate()

// Check for specific accelerator
expect(menuItem).toHaveAccelerator('CmdOrCtrl+S')

// Verify platform-specific enabling
expect(menuItem).toBeEnabledOnPlatform('darwin')
```

## 📊 Coverage Requirements

The test suite maintains high coverage standards:

- **Overall Coverage**: 80% minimum
- **Menu Module**: 90% minimum (statements, branches, functions, lines)
- **Critical Functions**: 95% minimum

Coverage reports are generated in:
- HTML: `coverage/menu-tests/html/`
- LCOV: `coverage/menu-tests/lcov.info`
- JSON: `coverage/menu-tests/coverage-final.json`

## ⚡ Performance Monitoring

The test suite includes performance monitoring for:

- Menu creation time (target: <10ms per menu)
- Memory usage (target: <5MB for 1000 menus)
- Dynamic update responsiveness (target: <100ms)
- Cross-platform consistency

## 🔧 Configuration

### Jest Configuration

The test suite uses a specialized Jest configuration (`jest.config.menu.js`) with:

- Node.js test environment for Electron compatibility
- TypeScript support with ts-jest
- Comprehensive mocking for Electron modules
- Coverage collection and thresholds
- Custom reporters for HTML output

### Environment Setup

Tests automatically set up the required environment:

```typescript
process.env.NODE_ENV = 'test'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
```

## 🌐 Cross-Platform Testing

The suite validates behavior across platforms:

- **macOS (darwin)**: App menu, Cmd shortcuts, speech menu
- **Windows (win32)**: File menu quit, Ctrl shortcuts, About in Help
- **Linux**: Similar to Windows with some variations

## 🔍 Error Handling

Comprehensive error handling testing includes:

- Invalid menu structures
- Missing accelerators
- IPC communication failures
- Platform detection errors
- Memory leaks and resource cleanup

## 📈 CI/CD Integration

The test suite is designed for CI/CD integration with:

- Parallel test execution
- Fail-fast options for quick feedback
- Coverage reporting
- Performance regression detection
- Platform-specific test runs

## 🏃‍♂️ Test Runner Features

The custom test runner (`menu-test-runner.ts`) provides:

- **Parallel Execution**: Run multiple suites simultaneously
- **Coverage Integration**: Comprehensive coverage reporting
- **Performance Monitoring**: Track test execution time and memory usage
- **Platform Detection**: Automatic platform-specific test adaptation
- **Detailed Reporting**: HTML reports with failure analysis
- **Debouncing**: Handle rapid state changes efficiently

## 📝 Adding New Tests

When adding new menu functionality, follow these patterns:

1. **Create Test File**: Add new test file in appropriate category
2. **Update Test Runner**: Add suite to the test runner configuration
3. **Add Utilities**: Extend MenuTestUtils for new functionality
4. **Update Coverage**: Ensure new code is covered by tests
5. **Document**: Update this README with new test scenarios

## 🎯 Best Practices

- **Isolation**: Each test is independent and can run in any order
- **Mocking**: Proper mocking of Electron APIs and external dependencies
- **Validation**: Comprehensive validation of menu structure and behavior
- **Performance**: Regular performance regression testing
- **Accessibility**: WCAG compliance validation for all menu interactions
- **Platform Consistency**: Ensure consistent behavior across platforms

## 🔧 Troubleshooting

### Common Issues

1. **Electron Mock Issues**: Ensure proper mock setup in `setup.ts`
2. **Platform Detection**: Use `testUtils.mockPlatform()` for platform-specific tests
3. **Timeout Issues**: Increase timeout for complex menu operations
4. **Memory Leaks**: Use cleanup utilities in `afterEach` hooks

### Debug Mode

```bash
# Run tests with debug output
DEBUG=menu-tests npx tsx tests/electron/menu/menu-test-runner.ts --verbose

# Run specific test with debugging
npx jest tests/electron/menu/menu-interactions.test.ts --verbose --no-cache
```

## 📄 Test Reports

Test reports are generated in multiple formats:

- **Console**: Real-time test results and summary
- **HTML**: Detailed interactive reports in `coverage/menu-tests/html-report/`
- **JSON**: Machine-readable results for CI/CD integration
- **LCOV**: Coverage data for external tools

---

This comprehensive menu testing suite ensures robust, accessible, and platform-consistent menu functionality across the entire Electron application. The test coverage includes both functional validation and performance monitoring, providing confidence in the menu system's reliability and user experience.