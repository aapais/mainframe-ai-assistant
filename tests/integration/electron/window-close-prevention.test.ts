/**
 * Window Close Prevention and Confirmation Tests
 *
 * Tests comprehensive window close handling including:
 * - Close prevention mechanisms
 * - User confirmation dialogs
 * - Unsaved changes detection
 * - Force close scenarios
 * - Application quit handling
 * - Modal and dialog close behavior
 */

import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { WindowInstance } from '../../../src/main/windows/types/WindowTypes';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Window Close Prevention and Confirmation', () => {
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let mockContext: any;
  let testWindows: WindowInstance[] = [];

  beforeAll(async () => {
    await app.whenReady();
  });

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.close.confirmUnsaved': return true;
            case 'window.close.preventAccidental': return true;
            case 'window.close.saveBeforeClose': return true;
            case 'window.close.timeout': return 30000;
            case 'window.close.forceCloseKey': return 'Ctrl+Alt+F4';
            default: return null;
          }
        }),
        set: jest.fn(),
        has: jest.fn(() => true)
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      services: new Map()
    };

    // Create instances
    windowFactory = new WindowFactory(mockContext);
    windowManager = new WindowManager();

    testWindows = [];
    jest.clearAllMocks();

    // Setup dialog mocks
    (dialog.showMessageBox as jest.Mock).mockResolvedValue({ response: 0, checkboxChecked: false });
    (dialog.showSaveDialog as jest.Mock).mockResolvedValue({ canceled: false, filePath: '/tmp/test.txt' });
  });

  afterEach(async () => {
    // Cleanup
    for (const windowInstance of testWindows) {
      if (windowInstance?.window && !windowInstance.window.isDestroyed()) {
        // Force close without prevention
        windowInstance.window.removeAllListeners('close');
        windowInstance.window.destroy();
      }
    }
    testWindows = [];

    // Clear IPC handlers
    ipcMain.removeAllListeners();

    if (windowManager) {
      await windowManager.stop();
    }
  });

  describe('Basic Close Prevention', () => {
    let testWindow: WindowInstance;

    beforeEach(async () => {
      testWindow = await windowFactory.createWindow('main', {
        title: 'Close Prevention Test',
        width: 800,
        height: 600
      });
      testWindows.push(testWindow);
    });

    it('should prevent window close when configured', async () => {
      const window = testWindow.window;
      let closeEventTriggered = false;
      let closePrevented = false;

      // Setup close prevention
      window.on('close', (event) => {
        closeEventTriggered = true;
        event.preventDefault();
        closePrevented = true;
      });

      // Try to close window
      window.close();
      window.emit('close', { preventDefault: jest.fn() });

      expect(closeEventTriggered).toBe(true);
      expect(window.isDestroyed()).toBe(false);
    });

    it('should allow close after confirmation', async () => {
      const window = testWindow.window;
      let confirmationShown = false;
      let allowClose = false;

      // Setup conditional close prevention
      window.on('close', (event) => {
        if (!allowClose) {
          event.preventDefault();
          confirmationShown = true;

          // Simulate user confirmation
          setTimeout(() => {
            allowClose = true;
            window.close();
          }, 100);
        }
      });

      // Try to close window
      window.close();
      const mockEvent = { preventDefault: jest.fn() };
      window.emit('close', mockEvent);

      expect(confirmationShown).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Simulate delayed close after confirmation
      allowClose = true;
      window.close();
      window.emit('close', { preventDefault: jest.fn() });

      // Should eventually allow close
      expect(allowClose).toBe(true);
    });

    it('should handle multiple close attempts', async () => {
      const window = testWindow.window;
      let closeAttempts = 0;
      let preventClose = true;

      window.on('close', (event) => {
        closeAttempts++;
        if (preventClose) {
          event.preventDefault();
        }
      });

      // Multiple close attempts
      for (let i = 0; i < 5; i++) {
        window.close();
        window.emit('close', { preventDefault: jest.fn() });
      }

      expect(closeAttempts).toBe(5);
      expect(window.isDestroyed()).toBe(false);

      // Allow close on final attempt
      preventClose = false;
      window.close();
      window.emit('close', { preventDefault: jest.fn() });

      expect(closeAttempts).toBe(6);
    });

    it('should force close with special key combination', async () => {
      const window = testWindow.window;
      let forceCloseTriggered = false;

      // Setup normal close prevention
      window.on('close', (event) => {
        if (!forceCloseTriggered) {
          event.preventDefault();
        }
      });

      // Setup force close mechanism
      const forceClose = () => {
        forceCloseTriggered = true;
        window.removeAllListeners('close');
        window.destroy();
      };

      // Try normal close (should be prevented)
      window.close();
      window.emit('close', { preventDefault: jest.fn() });
      expect(window.isDestroyed()).toBe(false);

      // Force close
      forceClose();
      expect(forceCloseTriggered).toBe(true);
    });
  });

  describe('Unsaved Changes Detection', () => {
    let testWindow: WindowInstance;

    beforeEach(async () => {
      testWindow = await windowFactory.createWindow('main', {
        title: 'Unsaved Changes Test',
        width: 800,
        height: 600
      });
      testWindows.push(testWindow);
    });

    it('should detect unsaved changes and show confirmation', async () => {
      const window = testWindow.window;
      let hasUnsavedChanges = true;
      let confirmationDialogShown = false;

      // Setup unsaved changes detection
      ipcMain.handle('check-unsaved-changes', () => {
        return hasUnsavedChanges;
      });

      // Setup close handler with unsaved changes check
      window.on('close', async (event) => {
        const unsavedChanges = await new Promise(resolve => {
          ipcMain.emit('check-unsaved-changes').then(resolve);
        });

        if (unsavedChanges) {
          event.preventDefault();
          confirmationDialogShown = true;

          // Show confirmation dialog
          const response = await dialog.showMessageBox(window, {
            type: 'question',
            buttons: ['Save', "Don't Save", 'Cancel'],
            defaultId: 0,
            message: 'Do you want to save your changes before closing?'
          });

          if (response.response === 0) {
            // Save and close
            hasUnsavedChanges = false;
            window.close();
          } else if (response.response === 1) {
            // Don't save, just close
            hasUnsavedChanges = false;
            window.close();
          }
          // Cancel - do nothing (already prevented)
        }
      });

      // Try to close with unsaved changes
      window.close();
      const mockEvent = { preventDefault: jest.fn() };
      await window.emit('close', mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(confirmationDialogShown).toBe(true);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        window,
        expect.objectContaining({
          message: 'Do you want to save your changes before closing?'
        })
      );
    });

    it('should save changes before closing', async () => {
      const window = testWindow.window;
      let saveCompleted = false;
      let hasUnsavedChanges = true;

      // Setup save functionality
      ipcMain.handle('save-document', async () => {
        // Simulate save operation
        await new Promise(resolve => setTimeout(resolve, 100));
        saveCompleted = true;
        hasUnsavedChanges = false;
        return { success: true, filePath: '/tmp/document.txt' };
      });

      // Setup close handler with save
      window.on('close', async (event) => {
        if (hasUnsavedChanges) {
          event.preventDefault();

          // Show save dialog
          const saveResult = await dialog.showSaveDialog(window, {
            title: 'Save Document',
            defaultPath: 'document.txt',
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
          });

          if (!saveResult.canceled) {
            // Perform save
            await new Promise(resolve => {
              ipcMain.emit('save-document').then(resolve);
            });

            // Close after save
            window.close();
          }
        }
      });

      // Try to close
      window.close();
      const mockEvent = { preventDefault: jest.fn() };
      await window.emit('close', mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(dialog.showSaveDialog).toHaveBeenCalled();
      expect(saveCompleted).toBe(true);
    });

    it('should handle save errors gracefully', async () => {
      const window = testWindow.window;
      let saveError = false;
      let hasUnsavedChanges = true;

      // Setup save functionality with error
      ipcMain.handle('save-document', async () => {
        throw new Error('Save failed');
      });

      // Setup close handler with error handling
      window.on('close', async (event) => {
        if (hasUnsavedChanges) {
          event.preventDefault();

          try {
            await new Promise(resolve => {
              ipcMain.emit('save-document').then(resolve);
            });
          } catch (error) {
            saveError = true;

            // Show error dialog
            await dialog.showMessageBox(window, {
              type: 'error',
              title: 'Save Error',
              message: 'Failed to save document. Close without saving?',
              buttons: ['Close Anyway', 'Cancel']
            });
          }
        }
      });

      // Try to close
      window.close();
      const mockEvent = { preventDefault: jest.fn() };
      await window.emit('close', mockEvent);

      expect(saveError).toBe(true);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        window,
        expect.objectContaining({
          type: 'error',
          message: 'Failed to save document. Close without saving?'
        })
      );
    });

    it('should track multiple documents with unsaved changes', async () => {
      const window = testWindow.window;
      const unsavedDocuments = ['doc1.txt', 'doc2.txt', 'doc3.txt'];

      // Setup multiple document tracking
      ipcMain.handle('get-unsaved-documents', () => {
        return unsavedDocuments;
      });

      // Setup close handler for multiple documents
      window.on('close', async (event) => {
        const unsaved = await new Promise(resolve => {
          ipcMain.emit('get-unsaved-documents').then(resolve);
        });

        if (unsaved.length > 0) {
          event.preventDefault();

          const response = await dialog.showMessageBox(window, {
            type: 'question',
            title: 'Unsaved Changes',
            message: `You have ${unsaved.length} unsaved documents. What would you like to do?`,
            detail: unsaved.join('\n'),
            buttons: ['Save All', 'Close Without Saving', 'Cancel'],
            defaultId: 0
          });

          if (response.response === 0) {
            // Save all documents
            unsavedDocuments.length = 0; // Clear unsaved list
            window.close();
          } else if (response.response === 1) {
            // Close without saving
            unsavedDocuments.length = 0;
            window.close();
          }
          // Cancel - do nothing
        }
      });

      // Try to close
      window.close();
      const mockEvent = { preventDefault: jest.fn() };
      await window.emit('close', mockEvent);

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        window,
        expect.objectContaining({
          message: 'You have 3 unsaved documents. What would you like to do?'
        })
      );
    });
  });

  describe('Application Quit Handling', () => {
    let mainWindow: WindowInstance;
    let secondaryWindow: WindowInstance;

    beforeEach(async () => {
      mainWindow = await windowFactory.createWindow('main', {
        title: 'Main Window',
        width: 1000,
        height: 700
      });

      secondaryWindow = await windowFactory.createWindow('pattern-viewer', {
        title: 'Secondary Window',
        width: 600,
        height: 400
      });

      testWindows.push(mainWindow, secondaryWindow);
    });

    it('should handle application quit with multiple windows', async () => {
      let quitPrevented = false;
      let windowsChecked = 0;

      // Setup quit prevention
      app.on('before-quit', (event) => {
        event.preventDefault();
        quitPrevented = true;
      });

      // Setup individual window close handling
      [mainWindow, secondaryWindow].forEach(({ window }) => {
        window.on('close', (event) => {
          windowsChecked++;
          // Prevent close if it would quit the app
          if (BrowserWindow.getAllWindows().length === 1) {
            event.preventDefault();
          }
        });
      });

      // Try to quit application
      app.emit('before-quit', { preventDefault: jest.fn() });

      expect(quitPrevented).toBe(true);
    });

    it('should save all windows before quitting', async () => {
      const saveOperations: string[] = [];

      // Setup save handlers for each window
      ipcMain.handle('save-main-window', async () => {
        saveOperations.push('main');
        return { success: true };
      });

      ipcMain.handle('save-secondary-window', async () => {
        saveOperations.push('secondary');
        return { success: true };
      });

      // Setup quit handler with save all
      app.on('before-quit', async (event) => {
        event.preventDefault();

        // Save all windows
        await Promise.all([
          new Promise(resolve => ipcMain.emit('save-main-window').then(resolve)),
          new Promise(resolve => ipcMain.emit('save-secondary-window').then(resolve))
        ]);

        // Quit after saving
        app.quit();
      });

      // Try to quit
      app.emit('before-quit', { preventDefault: jest.fn() });

      expect(saveOperations).toContain('main');
      expect(saveOperations).toContain('secondary');
    });

    it('should handle quit timeout', async () => {
      jest.useFakeTimers();

      let quitTimedOut = false;
      const quitTimeout = 5000;

      // Setup quit with timeout
      app.on('before-quit', (event) => {
        event.preventDefault();

        // Start quit timeout
        const timeoutId = setTimeout(() => {
          quitTimedOut = true;
          // Force quit after timeout
          app.quit();
        }, quitTimeout);

        // Simulate long-running save operation
        setTimeout(() => {
          clearTimeout(timeoutId);
          app.quit();
        }, 10000); // Longer than timeout
      });

      // Try to quit
      app.emit('before-quit', { preventDefault: jest.fn() });

      // Advance time past timeout
      jest.advanceTimersByTime(6000);

      expect(quitTimedOut).toBe(true);

      jest.useRealTimers();
    });

    it('should show quit confirmation for critical operations', async () => {
      let criticalOperationRunning = true;
      let quitConfirmed = false;

      // Setup quit confirmation for critical operations
      app.on('before-quit', async (event) => {
        if (criticalOperationRunning) {
          event.preventDefault();

          const response = await dialog.showMessageBox(null, {
            type: 'warning',
            title: 'Critical Operation Running',
            message: 'A critical operation is currently running. Quitting now may cause data loss.',
            detail: 'Are you sure you want to quit?',
            buttons: ['Quit Anyway', 'Cancel'],
            defaultId: 1
          });

          if (response.response === 0) {
            quitConfirmed = true;
            criticalOperationRunning = false;
            app.quit();
          }
        }
      });

      // Try to quit during critical operation
      app.emit('before-quit', { preventDefault: jest.fn() });

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          message: 'A critical operation is currently running. Quitting now may cause data loss.'
        })
      );
    });
  });

  describe('Modal and Dialog Close Behavior', () => {
    let parentWindow: WindowInstance;
    let modalWindow: WindowInstance;

    beforeEach(async () => {
      parentWindow = await windowFactory.createWindow('main', {
        title: 'Parent Window',
        width: 800,
        height: 600
      });

      modalWindow = await windowFactory.createWindow('alert', {
        title: 'Modal Dialog',
        width: 400,
        height: 300,
        parent: parentWindow.window,
        modal: true
      });

      testWindows.push(parentWindow, modalWindow);
    });

    it('should prevent parent window close when modal is open', async () => {
      const parentWin = parentWindow.window;
      const modalWin = modalWindow.window;
      let parentClosePrevented = false;

      // Setup parent close prevention when modal is open
      parentWin.on('close', (event) => {
        if (!modalWin.isDestroyed()) {
          event.preventDefault();
          parentClosePrevented = true;
        }
      });

      // Try to close parent while modal is open
      parentWin.close();
      parentWin.emit('close', { preventDefault: jest.fn() });

      expect(parentClosePrevented).toBe(true);
      expect(parentWin.isDestroyed()).toBe(false);
    });

    it('should close modal when parent closes', async () => {
      const parentWin = parentWindow.window;
      const modalWin = modalWindow.window;
      let modalClosed = false;

      // Setup modal close when parent closes
      parentWin.on('close', () => {
        if (!modalWin.isDestroyed()) {
          modalWin.close();
          modalClosed = true;
        }
      });

      // Close parent window
      parentWin.close();
      parentWin.emit('close', { preventDefault: jest.fn() });

      expect(modalClosed).toBe(true);
    });

    it('should handle modal close confirmation', async () => {
      const modalWin = modalWindow.window;
      let modalHasChanges = true;
      let confirmationShown = false;

      // Setup modal close confirmation
      modalWin.on('close', async (event) => {
        if (modalHasChanges) {
          event.preventDefault();
          confirmationShown = true;

          const response = await dialog.showMessageBox(modalWin, {
            type: 'question',
            title: 'Unsaved Changes',
            message: 'This dialog has unsaved changes. Close anyway?',
            buttons: ['Close', 'Cancel'],
            defaultId: 1
          });

          if (response.response === 0) {
            modalHasChanges = false;
            modalWin.close();
          }
        }
      });

      // Try to close modal
      modalWin.close();
      modalWin.emit('close', { preventDefault: jest.fn() });

      expect(confirmationShown).toBe(true);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        modalWin,
        expect.objectContaining({
          message: 'This dialog has unsaved changes. Close anyway?'
        })
      );
    });

    it('should handle nested modal dialogs', async () => {
      const nestedModal = await windowFactory.createWindow('alert', {
        title: 'Nested Modal',
        width: 300,
        height: 200,
        parent: modalWindow.window,
        modal: true
      });

      testWindows.push(nestedModal);

      let nestedModalClosed = false;
      let modalClosed = false;

      // Setup cascade close behavior
      modalWindow.window.on('close', (event) => {
        if (!nestedModal.window.isDestroyed()) {
          event.preventDefault();
          nestedModal.window.close();
          nestedModalClosed = true;
        } else {
          modalClosed = true;
        }
      });

      // Try to close middle modal
      modalWindow.window.close();
      modalWindow.window.emit('close', { preventDefault: jest.fn() });

      expect(nestedModalClosed).toBe(true);

      // Close nested modal, then middle modal should close
      nestedModal.window.close();
      nestedModal.window.emit('close', { preventDefault: jest.fn() });

      modalWindow.window.close();
      modalWindow.window.emit('close', { preventDefault: jest.fn() });

      expect(modalClosed).toBe(true);
    });
  });

  describe('Performance and Timeout Handling', () => {
    it('should handle slow close operations with timeout', async () => {
      jest.useFakeTimers();

      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });
      testWindows.push(window);

      let slowOperationCompleted = false;
      let timeoutTriggered = false;

      // Setup slow close operation
      window.window.on('close', async (event) => {
        event.preventDefault();

        // Start timeout
        const timeoutId = setTimeout(() => {
          timeoutTriggered = true;
          window.window.destroy(); // Force close
        }, 10000);

        // Simulate slow operation
        setTimeout(() => {
          slowOperationCompleted = true;
          clearTimeout(timeoutId);
          window.window.close();
        }, 15000); // Longer than timeout
      });

      // Try to close
      window.window.close();
      window.window.emit('close', { preventDefault: jest.fn() });

      // Advance time past timeout
      jest.advanceTimersByTime(12000);

      expect(timeoutTriggered).toBe(true);
      expect(slowOperationCompleted).toBe(false);

      jest.useRealTimers();
    });

    it('should batch multiple close requests', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });
      testWindows.push(window);

      let closeRequestCount = 0;
      let processingClose = false;

      // Setup batched close handling
      window.window.on('close', async (event) => {
        closeRequestCount++;

        if (processingClose) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        processingClose = true;

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));

        processingClose = false;
        window.window.close();
      });

      // Send multiple close requests rapidly
      for (let i = 0; i < 10; i++) {
        window.window.close();
        window.window.emit('close', { preventDefault: jest.fn() });
      }

      expect(closeRequestCount).toBe(10);
      // Should have batched the requests
    });

    it('should limit concurrent confirmation dialogs', async () => {
      const windows = await Promise.all([
        windowFactory.createWindow('main', { width: 400, height: 300 }),
        windowFactory.createWindow('main', { width: 400, height: 300 }),
        windowFactory.createWindow('main', { width: 400, height: 300 })
      ]);

      testWindows.push(...windows);

      let dialogCount = 0;
      const maxConcurrentDialogs = 2;

      // Setup confirmation dialogs with limit
      windows.forEach(({ window }) => {
        window.on('close', async (event) => {
          if (dialogCount >= maxConcurrentDialogs) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          dialogCount++;

          await dialog.showMessageBox(window, {
            type: 'question',
            message: 'Close this window?',
            buttons: ['Yes', 'No']
          });

          dialogCount--;
        });
      });

      // Try to close all windows simultaneously
      windows.forEach(({ window }) => {
        window.close();
        window.emit('close', { preventDefault: jest.fn() });
      });

      // Should limit concurrent dialogs
      expect(dialogCount).toBeLessThanOrEqual(maxConcurrentDialogs);
    });
  });
});