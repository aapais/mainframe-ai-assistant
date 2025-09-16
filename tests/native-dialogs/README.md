# Native Dialog Tests

Comprehensive test suite for Electron native dialogs including file dialogs, message boxes, confirmations, custom dialogs, and cancellation handling.

## Overview

This test suite provides thorough coverage of all native dialog functionality in Electron applications:

- **File Dialogs**: Open/save dialogs with filters and path handling
- **Message Boxes**: Info, warning, error, and question dialogs
- **Confirmation Dialogs**: Complex decision flows and user confirmations
- **Custom HTML Dialogs**: Modal windows with custom content and interactions
- **Cancellation Handling**: ESC key, timeout, and programmatic cancellation

## Test Structure

```
tests/native-dialogs/
├── dialog-test-base.ts          # Base testing utility with mocking
├── file-dialogs.test.ts         # File open/save dialog tests
├── message-dialogs.test.ts      # Message box and alert tests
├── confirmation-dialogs.test.ts # Confirmation flow tests
├── custom-dialogs.test.ts       # Custom HTML dialog tests
├── dialog-cancellation.test.ts  # Cancellation scenario tests
├── index.test.ts               # Integration test suite
├── jest.config.js              # Jest configuration
├── jest.setup.js               # Test environment setup
├── global.setup.js             # Global test initialization
├── global.teardown.js          # Global test cleanup
└── README.md                   # This documentation
```

## Key Features

### Dialog Test Base (`dialog-test-base.ts`)

Provides a comprehensive mocking system for all Electron dialog types:

```typescript
const dialogTester = new DialogTestBase();

// Mock file dialog responses
dialogTester.mockFileOpenResponse(['/path/to/file.txt']);
dialogTester.mockFileSaveResponse('/path/to/save.txt');

// Mock message box responses
dialogTester.mockMessageBoxResponse(0); // OK button

// Verify dialog interactions
expect(dialogTester.expectDialogShown('showOpenDialog')).toBe(true);
```

### Test Categories

#### 1. File Dialogs (`file-dialogs.test.ts`)
- Open dialog with filters and multi-selection
- Save dialog with default paths and extensions
- Directory selection
- User cancellation handling
- Import/export workflows

#### 2. Message Dialogs (`message-dialogs.test.ts`)
- Info, warning, error, and question message boxes
- Custom button configurations
- Checkbox support
- Detailed text handling
- Error box dialogs

#### 3. Confirmation Dialogs (`confirmation-dialogs.test.ts`)
- Delete confirmations (single/multiple items)
- Save before close dialogs
- Permission request dialogs
- Multi-step confirmation flows
- Batch operation confirmations

#### 4. Custom Dialogs (`custom-dialogs.test.ts`)
- About dialog with HTML content
- Settings dialog with form controls
- Progress dialog with animations
- IPC communication between dialog and main process
- Accessibility features (ARIA, keyboard navigation)

#### 5. Cancellation Tests (`dialog-cancellation.test.ts`)
- ESC key cancellation
- Timeout-based cancellation
- Window close cancellation
- Multi-step workflow cancellation
- Resource cleanup after cancellation

## Running Tests

### Run All Dialog Tests
```bash
npm test -- tests/native-dialogs
```

### Run Specific Test Files
```bash
# File dialogs only
npm test -- tests/native-dialogs/file-dialogs.test.ts

# Message dialogs only
npm test -- tests/native-dialogs/message-dialogs.test.ts

# Custom dialogs only
npm test -- tests/native-dialogs/custom-dialogs.test.ts
```

### Run with Coverage
```bash
npm test -- tests/native-dialogs --coverage
```

### Run in Watch Mode
```bash
npm test -- tests/native-dialogs --watch
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript support with ts-jest
- Electron-specific test environment
- Coverage reporting with thresholds
- 30-second timeout for Electron operations
- HTML and JUnit report generation

### Environment Setup (`jest.setup.js`)
- Electron app initialization
- Global test utilities and fixtures
- Custom Jest matchers for dialog responses
- Mock implementations for non-Electron environments

## Custom Matchers

The test suite includes custom Jest matchers for dialog testing:

```typescript
// Check if response is a valid dialog response
expect(result).toBeValidDialogResponse();

// Check if response is a valid file dialog response
expect(result).toBeFileDialogResponse();

// Check if response is a valid message box response
expect(result).toBeMessageBoxResponse();
```

## Mock System

The `DialogTestBase` class provides comprehensive mocking:

### Basic Mocking
```typescript
// Mock simple responses
dialogTester.mockFileOpenResponse(['/file1.txt', '/file2.txt']);
dialogTester.mockMessageBoxResponse(1); // Second button
```

### Advanced Mocking
```typescript
// Mock with specific options
dialogTester.setMockResponse('open', {
  title: 'Select Images',
  filters: [{ name: 'Images', extensions: ['jpg', 'png'] }]
}, {
  canceled: false,
  filePaths: ['/image1.jpg', '/image2.png']
});
```

### Event Tracking
```typescript
// Listen for dialog events
dialogTester.on('dialogShown', (event) => {
  console.log('Dialog shown:', event.type, event.options);
});

// Get call history
const calls = dialogTester.getCallHistory();
expect(calls).toHaveLength(2);
```

## Integration Testing

The `index.test.ts` file provides integration scenarios:

- Complete application workflows with multiple dialogs
- Dialog interruption and error handling scenarios
- Performance testing with multiple concurrent dialogs
- Memory usage validation
- Platform-specific behavior testing

## Best Practices

### 1. Use Descriptive Test Names
```typescript
it('should confirm single item deletion with undo warning', async () => {
  // Test implementation
});
```

### 2. Test Both Success and Failure Paths
```typescript
// Test successful operation
expect(result.canceled).toBe(false);

// Test user cancellation
expect(result.canceled).toBe(true);
```

### 3. Verify Dialog Options
```typescript
const lastCall = dialogTester.getLastCall();
expect(lastCall?.args[1]).toMatchObject(expectedOptions);
```

### 4. Test Accessibility Features
```typescript
// Verify ARIA attributes
const hasDialogRole = await window.webContents.executeJavaScript(`
  document.querySelector('[role="dialog"]') !== null
`);
expect(hasDialogRole).toBe(true);
```

### 5. Clean Up Resources
```typescript
afterEach(() => {
  dialogTester.restore();
  if (testWindow && !testWindow.isDestroyed()) {
    testWindow.destroy();
  }
});
```

## Coverage Goals

- **Statements**: >80%
- **Branches**: >80%
- **Functions**: >80%
- **Lines**: >80%

## Common Test Patterns

### File Dialog Testing
```typescript
const options = {
  title: 'Select Files',
  filters: [{ name: 'Text Files', extensions: ['txt'] }],
  properties: ['openFile', 'multiSelections']
};

dialogTester.setMockResponse('open', options, {
  canceled: false,
  filePaths: ['/file1.txt', '/file2.txt']
});

const result = await dialog.showOpenDialog(window, options);
expect(result.filePaths).toHaveLength(2);
```

### Message Box Testing
```typescript
const options = {
  type: 'warning',
  message: 'Delete file?',
  buttons: ['Delete', 'Cancel'],
  defaultId: 1
};

dialogTester.setMockResponse('message', options, {
  canceled: false,
  response: 0 // Delete button
});

const result = await dialog.showMessageBox(window, options);
expect(result.response).toBe(0);
```

### Custom Dialog Testing
```typescript
const customWindow = new BrowserWindow({
  modal: true,
  parent: mainWindow
});

await customWindow.loadURL('data:text/html,...');
expect(customWindow.isModal()).toBe(true);
```

This comprehensive test suite ensures robust dialog functionality across all scenarios and platforms.