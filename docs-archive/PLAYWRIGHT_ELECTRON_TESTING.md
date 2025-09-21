# Playwright Electron Testing Guide

This guide covers the comprehensive Playwright testing setup for the Mainframe KB Assistant Electron application.

## Overview

Our Playwright setup provides:
- **Electron E2E Testing**: Full application testing with real Electron processes
- **Performance Testing**: Startup time, memory usage, and responsiveness metrics
- **Visual Regression Testing**: Screenshot comparisons across different themes and screen sizes
- **Accessibility Testing**: WCAG compliance and keyboard navigation
- **Cross-Platform Testing**: Windows, macOS, and Linux support
- **CI/CD Integration**: Automated testing in GitHub Actions

## Quick Start

### Prerequisites

```bash
# Install dependencies (if not already done)
npm install

# Install Playwright browsers
npx playwright install

# Build the Electron application
npm run build:main
```

### Running Tests

```bash
# Run all Playwright tests
npm run test:playwright

# Run only Electron app tests
npm run test:playwright:electron

# Run performance tests
npm run test:playwright:performance

# Run visual regression tests
npm run test:playwright:visual

# Run accessibility tests
npm run test:playwright:accessibility

# Run in headed mode (see the browser)
npm run test:playwright:headed

# Debug tests interactively
npm run test:playwright:debug

# Open Playwright UI
npm run test:playwright:ui
```

## Test Structure

```
tests/playwright/
├── fixtures/
│   └── electron-fixtures.ts          # Electron app fixtures and helpers
├── helpers/
│   └── electron-helpers.ts           # Utility functions for Electron testing
├── reporters/
│   └── electron-reporter.ts          # Custom reporter for Electron metrics
├── setup/
│   ├── global-setup.ts              # Global test setup
│   └── global-teardown.ts           # Global test cleanup
├── specs/
│   ├── electron/                    # Electron-specific tests
│   │   ├── app-launch.electron.spec.ts
│   │   └── knowledge-base.electron.spec.ts
│   ├── performance/                 # Performance tests
│   │   └── app-performance.performance.spec.ts
│   ├── visual/                      # Visual regression tests
│   ├── accessibility/               # Accessibility tests
│   └── cross-browser/              # Cross-browser tests
├── temp/                           # Temporary files during testing
├── screenshots/                    # Test screenshots
├── test-data/                     # Test data files
├── .env.test                      # Test environment variables
└── package.json.scripts          # Additional npm scripts
```

## Configuration Files

### Primary Configuration
- `playwright.config.electron.ts` - Main Playwright configuration optimized for Electron
- `playwright.config.ts` - Original configuration (still functional)

### Environment Configuration
- `.env.test` - Test-specific environment variables
- Environment variables are automatically loaded during test execution

## Test Types

### 1. Electron E2E Tests

Tests the complete Electron application functionality:

```typescript
import { test, expect } from '../../fixtures/electron-fixtures';

test('should launch application successfully', async ({
  electronApp,
  appPage,
  electronHelpers
}) => {
  await electronHelpers.waitForAppReady();

  const title = await appPage.title();
  expect(title).toContain('Mainframe KB Assistant');
});
```

### 2. Performance Tests

Monitors application performance metrics:

```typescript
test('should meet startup performance benchmarks', async ({
  electronApp,
  electronHelpers
}) => {
  const startupTime = await PerformanceTestHelpers.measureStartupTime(electronApp);
  expect(startupTime).toBeLessThan(5000);
});
```

### 3. Visual Regression Tests

Compares screenshots for visual consistency:

```typescript
test('should match visual baseline', async ({ page }) => {
  await expect(page).toHaveScreenshot('main-window.png');
});
```

### 4. Accessibility Tests

Validates WCAG compliance:

```typescript
test('should be accessible', async ({ appPage, electronHelpers }) => {
  await electronHelpers.injectAxeCore();
  const results = await electronHelpers.checkAccessibility();
  expect(results.violations).toHaveLength(0);
});
```

## Key Features

### Electron-Specific Fixtures

```typescript
export interface ElectronTestFixtures {
  electronApp: ElectronApplication;  // The Electron app instance
  appPage: Page;                    // Main window page
  appContext: BrowserContext;       // Browser context
  testDatabase: string;             // Test database path
  electronHelpers: ElectronHelpers; // Utility functions
}
```

### Helper Functions

The `ElectronTestHelpers` class provides:

- **Window Management**: Open/close windows, get main window
- **Menu Interactions**: Trigger menu actions programmatically
- **IPC Communication**: Send/receive IPC messages
- **File Operations**: Mock file dialogs, handle file operations
- **Database Operations**: Clear, seed, and query test data
- **Performance Monitoring**: Measure operations, collect metrics
- **Error Handling**: Capture console errors and unhandled exceptions

### Custom Reporter

The custom Electron reporter provides:
- Startup time tracking
- Memory usage monitoring
- Window count tracking
- Error collection
- Performance recommendations
- HTML and JSON report generation

## Configuration Options

### Environment Variables

Key environment variables in `.env.test`:

```env
# Application
NODE_ENV=test
ELECTRON_DISABLE_GPU=1

# Testing
PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_TIMEOUT=120000
PERFORMANCE_THRESHOLD_STARTUP=5000

# Reporting
SCREENSHOT_ON_FAILURE=true
VIDEO_ON_FAILURE=true
TRACE_ON_FAILURE=true
```

### Playwright Projects

The configuration includes multiple projects:

- **electron-app**: Main Electron application tests
- **performance**: Performance and benchmarking tests
- **visual-chrome-desktop**: Visual regression tests
- **accessibility**: Accessibility compliance tests
- **cross-browser**: Firefox and WebKit tests
- **mobile**: Responsive design tests

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/playwright-electron-tests.yml` provides:

- **Multi-OS Testing**: Ubuntu, Windows, macOS
- **Node.js Matrix**: Tests on Node 18 and 20
- **Parallel Execution**: Optimized for CI performance
- **Artifact Collection**: Screenshots, videos, reports
- **Performance Benchmarking**: Scheduled and on-demand
- **Security Scanning**: Dependency audit
- **PR Comments**: Automated test result reporting

### Running in CI

```bash
# CI command
npm run test:playwright:electron:ci

# With environment variables
CI=true PLAYWRIGHT_HEADLESS=true npm run test:playwright
```

## Best Practices

### 1. Test Data Management

```typescript
// Create isolated test data
const testDataPath = await TestDataManager.createTestKnowledgeBase([
  { id: 'test-1', title: 'Test Entry', category: 'COBOL' }
]);

await electronHelpers.importTestData(testDataPath);
```

### 2. Performance Testing

```typescript
// Measure operations
const { result, duration } = await electronHelpers.measureOperation(
  async () => {
    // Your operation here
  },
  'operation-name'
);

expect(duration).toBeLessThan(2000);
```

### 3. Error Handling

```typescript
// Capture and validate errors
const errors = await electronHelpers.captureConsoleErrors();
expect(errors.filter(e => !e.includes('DevTools'))).toHaveLength(0);
```

### 4. Accessibility Testing

```typescript
// Comprehensive accessibility check
await electronHelpers.injectAxeCore();
const results = await electronHelpers.checkAccessibility();
expect(results.violations).toHaveLength(0);
```

## Troubleshooting

### Common Issues

1. **App Won't Start**
   ```bash
   # Ensure app is built
   npm run build:main

   # Check if Electron is installed
   npm run rebuild
   ```

2. **Tests Timeout**
   ```bash
   # Increase timeout in config
   timeout: 120000

   # Or per test
   test.setTimeout(180000);
   ```

3. **Memory Issues**
   ```bash
   # Run with more memory
   node --max-old-space-size=4096 node_modules/.bin/playwright test
   ```

4. **Screenshots Don't Match**
   ```bash
   # Update baselines
   npm run test:playwright:update-snapshots
   ```

### Debug Mode

```bash
# Run in debug mode
npm run test:playwright:debug

# Run specific test in debug mode
npx playwright test tests/playwright/specs/electron/app-launch.electron.spec.ts --debug
```

### Headful Mode

```bash
# See the browser during tests
npm run test:playwright:headed

# Slow down execution
PLAYWRIGHT_SLOW_MO=1000 npm run test:playwright:headed
```

## Reporting

### HTML Report

```bash
# Generate and view HTML report
npm run test:playwright:report
```

### Custom Electron Report

The custom reporter generates:
- `test-reports/electron-report.json` - Detailed metrics
- `test-reports/electron-report.html` - Visual report
- `test-reports/test-summary.json` - Summary statistics

### Performance Report

Performance tests generate:
- Startup time metrics
- Memory usage tracking
- Operation duration measurements
- Performance recommendations

## Extending the Test Suite

### Adding New Tests

1. Create test file in appropriate directory
2. Use the electron fixtures
3. Follow naming conventions: `*.electron.spec.ts`, `*.performance.spec.ts`

```typescript
import { test, expect } from '../../fixtures/electron-fixtures';

test.describe('My New Feature', () => {
  test('should work correctly', async ({ electronApp, appPage, electronHelpers }) => {
    await electronHelpers.waitForAppReady();
    // Your test logic here
  });
});
```

### Adding New Projects

1. Add project configuration to `playwright.config.electron.ts`
2. Create appropriate test directory structure
3. Update CI workflow if needed

### Custom Assertions

```typescript
// In your test file
export class CustomAssertions {
  static async toBeElectronApp(electronApp: ElectronApplication) {
    const version = await electronApp.evaluate(({ app }) => app.getVersion());
    expect(version).toBeTruthy();
  }
}
```

## Integration with Claude Flow

The test suite integrates with Claude Flow coordination:

```bash
# Store test progress in memory
npx claude-flow@alpha hooks post-edit --memory-key "swarm/electron-testing/setup"

# Notify completion
npx claude-flow@alpha hooks post-task --task-id "playwright-setup"
```

## Support and Maintenance

- **Configuration**: Regularly update browser versions with `npx playwright install`
- **Dependencies**: Keep Playwright and Electron versions in sync
- **CI/CD**: Monitor CI performance and adjust timeouts as needed
- **Reports**: Review performance trends and set appropriate thresholds

This comprehensive testing setup ensures robust, reliable testing of the Electron application across different environments and use cases.