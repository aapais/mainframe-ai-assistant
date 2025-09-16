/**
 * Comprehensive tests for message boxes and alert dialogs
 * Tests various message types, button configurations, and user responses
 */

import { BrowserWindow } from 'electron';
import DialogTestBase, { MessageBoxOptions } from './dialog-test-base';

describe('Message Dialogs', () => {
  let dialogTester: DialogTestBase;
  let testWindow: BrowserWindow;

  beforeEach(() => {
    dialogTester = new DialogTestBase();
    testWindow = dialogTester.createTestWindow();
  });

  afterEach(() => {
    dialogTester.restore();
    if (testWindow && !testWindow.isDestroyed()) {
      testWindow.destroy();
    }
  });

  describe('Basic Message Boxes', () => {
    it('should show info message box', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'info',
        title: 'Information',
        message: 'This is an information message',
        buttons: ['OK']
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(0);
      expect(dialogTester.expectDialogShown('showMessageBox', options)).toBe(true);
    });

    it('should show warning message box', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Warning',
        message: 'This action may have consequences',
        detail: 'Please review before proceeding',
        buttons: ['Proceed', 'Cancel'],
        defaultId: 1
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 1
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(1); // Cancel button
      expect(dialogTester.getLastCall()?.args[1]).toMatchObject(options);
    });

    it('should show error message box', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'error',
        title: 'Error',
        message: 'An error occurred',
        detail: 'Unable to complete the operation',
        buttons: ['Retry', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(0); // Retry button
    });

    it('should show question message box', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Confirmation',
        message: 'Are you sure you want to delete this item?',
        buttons: ['Delete', 'Cancel'],
        defaultId: 1,
        cancelId: 1
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(0); // Delete button
    });
  });

  describe('Advanced Message Box Features', () => {
    it('should handle checkbox in message box', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Save Changes',
        message: 'Do you want to save changes before closing?',
        checkboxLabel: "Don't ask me again",
        checkboxChecked: false,
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0,
        checkboxChecked: true
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(0);
      expect(result.checkboxChecked).toBe(true);
    });

    it('should handle custom button configuration', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'none',
        title: 'Custom Actions',
        message: 'Choose an action',
        buttons: ['Action 1', 'Action 2', 'Action 3', 'Cancel'],
        defaultId: 0,
        cancelId: 3
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 1
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(1); // Action 2
    });

    it('should handle message box with detailed text', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'error',
        title: 'Application Error',
        message: 'The application encountered an unexpected error',
        detail: 'Error Code: 500\nLocation: DataService.fetchData()\nTimestamp: 2023-12-15 14:30:22\n\nStack trace:\n  at DataService.fetchData (data.js:45)\n  at MainController.loadData (main.js:123)',
        buttons: ['Send Report', 'Close'],
        defaultId: 1
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(0); // Send Report
      const lastCall = dialogTester.getLastCall();
      expect(lastCall?.args[1].detail).toContain('Error Code: 500');
    });

    it('should handle message box without parent window', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'info',
        title: 'Global Message',
        message: 'This is a global message',
        buttons: ['OK']
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(options);

      // Assert
      expect(result.response).toBe(0);
      const lastCall = dialogTester.getLastCall();
      expect(lastCall?.args[0]).toBeUndefined(); // No parent window
    });
  });

  describe('Error Box Dialog', () => {
    it('should show error box with title and content', () => {
      // Arrange
      const title = 'Critical Error';
      const content = 'The application has encountered a critical error and must close.';

      // Act
      const { dialog } = require('electron');
      dialog.showErrorBox(title, content);

      // Assert
      expect(dialogTester.expectDialogShown('showErrorBox')).toBe(true);
      const lastCall = dialogTester.getLastCall();
      expect(lastCall?.args[0]).toBe(title);
      expect(lastCall?.args[1]).toBe(content);
    });

    it('should handle error box with long content', () => {
      // Arrange
      const title = 'System Error';
      const content = `A system error has occurred with the following details:

Error Type: Memory Access Violation
Error Code: 0xC0000005
Module: application.exe
Address: 0x00401234

The application will now terminate. Please restart the application and try again.
If the problem persists, please contact technical support.

Technical Information:
- OS Version: Windows 11
- Application Version: 2.1.0
- Available Memory: 4.2 GB
- CPU Usage: 85%`;

      // Act
      const { dialog } = require('electron');
      dialog.showErrorBox(title, content);

      // Assert
      expect(dialogTester.expectDialogShown('showErrorBox')).toBe(true);
      const lastCall = dialogTester.getLastCall();
      expect(lastCall?.args[1]).toContain('Memory Access Violation');
    });
  });

  describe('Dialog Response Patterns', () => {
    it('should handle Yes/No/Cancel pattern', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Save Document',
        message: 'Do you want to save changes to the document?',
        detail: 'Your changes will be lost if you do not save them.',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2
      };

      // Test different responses
      const responses = [
        { response: 0, meaning: 'Save' },
        { response: 1, meaning: "Don't Save" },
        { response: 2, meaning: 'Cancel' }
      ];

      for (const { response, meaning } of responses) {
        dialogTester.setMockResponse('message', options, {
          canceled: false,
          response
        });

        // Act
        const { dialog } = require('electron');
        const result = await dialog.showMessageBox(testWindow, options);

        // Assert
        expect(result.response).toBe(response);
      }
    });

    it('should handle OK/Cancel pattern', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Confirm Action',
        message: 'This action cannot be undone',
        buttons: ['OK', 'Cancel'],
        defaultId: 1,
        cancelId: 1
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 1
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(1); // Cancel
    });

    it('should handle Retry/Ignore/Cancel pattern', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'error',
        title: 'Operation Failed',
        message: 'The operation could not be completed',
        detail: 'A network error occurred while trying to save the file.',
        buttons: ['Retry', 'Ignore', 'Cancel'],
        defaultId: 0,
        cancelId: 2
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(0); // Retry
    });
  });

  describe('Dialog State and Events', () => {
    it('should track dialog interaction events', async () => {
      // Arrange
      const events: any[] = [];
      dialogTester.on('dialogShown', (event) => {
        events.push(event);
      });

      const options: MessageBoxOptions = {
        type: 'info',
        message: 'Test message',
        buttons: ['OK']
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message');
      expect(events[0].options).toMatchObject(options);
    });

    it('should handle multiple dialogs in sequence', async () => {
      // Arrange
      const dialogs = [
        { type: 'info', message: 'Step 1', response: 0 },
        { type: 'warning', message: 'Step 2', response: 0 },
        { type: 'question', message: 'Step 3', response: 1 }
      ];

      dialogs.forEach((dialogConfig, index) => {
        const options = {
          type: dialogConfig.type as any,
          message: dialogConfig.message,
          buttons: ['OK', 'Cancel']
        };
        dialogTester.setMockResponse('message', options, {
          canceled: false,
          response: dialogConfig.response
        });
      });

      // Act
      const { dialog } = require('electron');
      const results = [];

      for (const dialogConfig of dialogs) {
        const options = {
          type: dialogConfig.type as any,
          message: dialogConfig.message,
          buttons: ['OK', 'Cancel']
        };
        const result = await dialog.showMessageBox(testWindow, options);
        results.push(result);
      }

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].response).toBe(0);
      expect(results[1].response).toBe(0);
      expect(results[2].response).toBe(1);
      expect(dialogTester.countCalls('showMessageBox')).toBe(3);
    });
  });
});