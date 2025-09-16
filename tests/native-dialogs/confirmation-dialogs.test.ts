/**
 * Comprehensive tests for confirmation dialogs with various button configurations
 * Tests user decision flows and response handling
 */

import { BrowserWindow } from 'electron';
import DialogTestBase, { MessageBoxOptions } from './dialog-test-base';

describe('Confirmation Dialogs', () => {
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

  describe('Delete Confirmation Dialogs', () => {
    it('should confirm single item deletion', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Delete Item',
        message: 'Are you sure you want to delete "document.txt"?',
        detail: 'This action cannot be undone.',
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
      expect(result.response).toBe(0); // Delete confirmed
      expect(dialogTester.expectDialogShown('showMessageBox', options)).toBe(true);
    });

    it('should confirm multiple items deletion', async () => {
      // Arrange
      const itemCount = 5;
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Delete Multiple Items',
        message: `Are you sure you want to delete ${itemCount} items?`,
        detail: 'This action cannot be undone. All selected items will be permanently deleted.',
        buttons: ['Delete All', 'Cancel'],
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
      expect(result.response).toBe(1); // Cancel selected
    });

    it('should handle permanent deletion warning', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Permanent Deletion',
        message: 'Delete items permanently?',
        detail: 'Items will be deleted immediately and cannot be restored from Trash.',
        checkboxLabel: 'Always delete permanently',
        checkboxChecked: false,
        buttons: ['Delete Permanently', 'Move to Trash', 'Cancel'],
        defaultId: 2,
        cancelId: 2
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 1,
        checkboxChecked: false
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(1); // Move to Trash
      expect(result.checkboxChecked).toBe(false);
    });
  });

  describe('Save Confirmation Dialogs', () => {
    it('should confirm save before closing', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Unsaved Changes',
        message: 'Do you want to save changes before closing?',
        detail: 'Your changes will be lost if you close without saving.',
        buttons: ['Save', "Don't Save", 'Cancel'],
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
      expect(result.response).toBe(0); // Save
    });

    it('should confirm overwrite existing file', async () => {
      // Arrange
      const filename = 'important-document.pdf';
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'File Already Exists',
        message: `A file named "${filename}" already exists.`,
        detail: 'Do you want to replace it with the one you are saving?',
        buttons: ['Replace', 'Keep Both', 'Cancel'],
        defaultId: 2,
        cancelId: 2
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 1
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(1); // Keep Both
    });

    it('should confirm save with format change', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Format Change',
        message: 'Saving in this format may cause data loss.',
        detail: 'Some formatting and features may not be preserved. Continue?',
        buttons: ['Save Anyway', 'Change Format', 'Cancel'],
        defaultId: 1,
        cancelId: 2
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 2
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(2); // Cancel
    });
  });

  describe('Application Exit Confirmation', () => {
    it('should confirm application exit with unsaved work', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Quit Application',
        message: 'Are you sure you want to quit?',
        detail: 'You have unsaved changes in 3 documents. All unsaved changes will be lost.',
        buttons: ['Save All and Quit', 'Quit Without Saving', 'Cancel'],
        defaultId: 2,
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
      expect(result.response).toBe(0); // Save All and Quit
    });

    it('should confirm force quit during operation', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Force Quit',
        message: 'Force quit the application?',
        detail: 'A file operation is in progress. Force quitting may corrupt data.',
        buttons: ['Force Quit', 'Wait for Completion'],
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
      expect(result.response).toBe(1); // Wait for Completion
    });
  });

  describe('Permission and Security Confirmations', () => {
    it('should confirm permission request', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Permission Required',
        message: 'Allow access to camera and microphone?',
        detail: 'This application would like to access your camera and microphone for video calls.',
        buttons: ['Allow', 'Deny'],
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
      expect(result.response).toBe(0); // Allow
    });

    it('should confirm security warning', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Security Warning',
        message: 'This file may be unsafe to open.',
        detail: 'The file was downloaded from the internet and may contain malware. Do you trust this file?',
        buttons: ['Open Anyway', 'Cancel'],
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
      expect(result.response).toBe(1); // Cancel (safer option)
    });

    it('should confirm administrative action', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Administrator Access Required',
        message: 'This action requires administrator privileges.',
        detail: 'Modifying system files requires elevated permissions. Continue?',
        buttons: ['Continue', 'Cancel'],
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
      expect(result.response).toBe(0); // Continue
    });
  });

  describe('Batch Operations Confirmation', () => {
    it('should confirm batch file processing', async () => {
      // Arrange
      const fileCount = 150;
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Batch Processing',
        message: `Process ${fileCount} files?`,
        detail: 'This operation may take several minutes to complete.',
        checkboxLabel: 'Run in background',
        checkboxChecked: true,
        buttons: ['Start Processing', 'Cancel'],
        defaultId: 0,
        cancelId: 1
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
      expect(result.response).toBe(0); // Start Processing
      expect(result.checkboxChecked).toBe(true); // Run in background
    });

    it('should confirm destructive batch operation', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Destructive Operation',
        message: 'This will permanently modify all selected files.',
        detail: 'Original files will be overwritten and cannot be recovered. Are you sure?',
        buttons: ['Proceed', 'Create Backup First', 'Cancel'],
        defaultId: 2,
        cancelId: 2
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 1
      });

      // Act
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox(testWindow, options);

      // Assert
      expect(result.response).toBe(1); // Create Backup First
    });
  });

  describe('Complex Decision Flows', () => {
    it('should handle multi-step confirmation flow', async () => {
      // Arrange - Step 1: Initial confirmation
      const step1Options: MessageBoxOptions = {
        type: 'question',
        title: 'Reset Settings',
        message: 'Reset all settings to default?',
        detail: 'This will restore all application settings to their default values.',
        buttons: ['Reset', 'Cancel'],
        defaultId: 1,
        cancelId: 1
      };

      // Step 2: Final confirmation
      const step2Options: MessageBoxOptions = {
        type: 'warning',
        title: 'Final Confirmation',
        message: 'Are you absolutely sure?',
        detail: 'This action cannot be undone. All your custom settings will be lost.',
        buttons: ['Yes, Reset Everything', 'No, Keep Settings'],
        defaultId: 1,
        cancelId: 1
      };

      dialogTester.setMockResponse('message', step1Options, {
        canceled: false,
        response: 0
      });

      dialogTester.setMockResponse('message', step2Options, {
        canceled: false,
        response: 1
      });

      // Act
      const { dialog } = require('electron');

      const step1Result = await dialog.showMessageBox(testWindow, step1Options);
      let step2Result = null;

      if (step1Result.response === 0) {
        step2Result = await dialog.showMessageBox(testWindow, step2Options);
      }

      // Assert
      expect(step1Result.response).toBe(0); // Reset chosen
      expect(step2Result?.response).toBe(1); // But final confirmation declined
      expect(dialogTester.countCalls('showMessageBox')).toBe(2);
    });

    it('should handle conditional confirmation based on user data', async () => {
      // Arrange
      const hasUnsavedChanges = true;
      const hasActiveConnections = true;

      let message = 'Close application?';
      let detail = '';
      let buttons = ['Close', 'Cancel'];

      if (hasUnsavedChanges) {
        detail += 'You have unsaved changes. ';
      }
      if (hasActiveConnections) {
        detail += 'Active network connections will be terminated. ';
      }

      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Close Application',
        message,
        detail: detail.trim(),
        buttons,
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
      const lastCall = dialogTester.getLastCall();
      expect(lastCall?.args[1].detail).toContain('unsaved changes');
      expect(lastCall?.args[1].detail).toContain('network connections');
    });
  });

  describe('Accessibility and Usability', () => {
    it('should handle keyboard navigation hints', async () => {
      // Arrange
      const options: MessageBoxOptions = {
        type: 'question',
        title: 'Keyboard Navigation',
        message: 'Delete selected items?',
        detail: 'Press Enter to confirm or Escape to cancel.',
        buttons: ['Delete', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        normalizeAccessKeys: true
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
      const lastCall = dialogTester.getLastCall();
      expect(lastCall?.args[1].normalizeAccessKeys).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      // Arrange - Simulate a timeout scenario
      const options: MessageBoxOptions = {
        type: 'warning',
        title: 'Session Timeout',
        message: 'Your session will expire in 30 seconds.',
        detail: 'Do you want to extend your session?',
        buttons: ['Extend Session', 'Logout'],
        defaultId: 0,
        cancelId: 1
      };

      dialogTester.setMockResponse('message', options, {
        canceled: false,
        response: 0
      });

      // Act
      const { dialog } = require('electron');
      const startTime = Date.now();
      const result = await dialog.showMessageBox(testWindow, options);
      const duration = Date.now() - startTime;

      // Assert
      expect(result.response).toBe(0); // Extend Session
      expect(duration).toBeLessThan(1000); // Should be fast in test
    });
  });
});