/**
 * Base class for native dialog testing with Electron
 * Provides mocking utilities and common test patterns
 */

import { dialog, BrowserWindow, ipcMain, shell } from 'electron';
import { EventEmitter } from 'events';

export interface DialogMockResponse {
  canceled: boolean;
  filePaths?: string[];
  filePath?: string;
  response?: number;
  checkboxChecked?: boolean;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  icon?: string;
  textWidth?: number;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

export class DialogTestBase extends EventEmitter {
  private originalDialogMethods: any = {};
  private mockResponses: Map<string, DialogMockResponse> = new Map();
  private callHistory: Array<{ method: string; args: any[] }> = [];

  constructor() {
    super();
    this.setupDialogMocks();
  }

  /**
   * Setup mock implementations for all dialog methods
   */
  private setupDialogMocks(): void {
    // Store original methods
    this.originalDialogMethods = {
      showOpenDialog: dialog.showOpenDialog,
      showSaveDialog: dialog.showSaveDialog,
      showMessageBox: dialog.showMessageBox,
      showErrorBox: dialog.showErrorBox,
      showCertificateTrustDialog: dialog.showCertificateTrustDialog
    };

    // Mock showOpenDialog
    dialog.showOpenDialog = jest.fn().mockImplementation(
      async (window?: BrowserWindow, options?: any) => {
        this.recordCall('showOpenDialog', [window, options]);
        const key = this.generateMockKey('open', options);
        const response = this.mockResponses.get(key) || { canceled: true };
        this.emit('dialogShown', { type: 'open', options, response });
        return response;
      }
    );

    // Mock showSaveDialog
    dialog.showSaveDialog = jest.fn().mockImplementation(
      async (window?: BrowserWindow, options?: any) => {
        this.recordCall('showSaveDialog', [window, options]);
        const key = this.generateMockKey('save', options);
        const response = this.mockResponses.get(key) || { canceled: true };
        this.emit('dialogShown', { type: 'save', options, response });
        return response;
      }
    );

    // Mock showMessageBox
    dialog.showMessageBox = jest.fn().mockImplementation(
      async (window?: BrowserWindow, options?: MessageBoxOptions) => {
        this.recordCall('showMessageBox', [window, options]);
        const key = this.generateMockKey('message', options);
        const response = this.mockResponses.get(key) || { response: 0 };
        this.emit('dialogShown', { type: 'message', options, response });
        return response;
      }
    );

    // Mock showErrorBox
    dialog.showErrorBox = jest.fn().mockImplementation(
      (title: string, content: string) => {
        this.recordCall('showErrorBox', [title, content]);
        this.emit('dialogShown', { type: 'error', title, content });
      }
    );
  }

  /**
   * Generate a unique key for mock responses
   */
  private generateMockKey(type: string, options?: any): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${type}:${optionsStr}`;
  }

  /**
   * Record method calls for verification
   */
  private recordCall(method: string, args: any[]): void {
    this.callHistory.push({ method, args });
  }

  /**
   * Set a mock response for a specific dialog type and options
   */
  setMockResponse(type: string, options: any, response: DialogMockResponse): void {
    const key = this.generateMockKey(type, options);
    this.mockResponses.set(key, response);
  }

  /**
   * Set a simple mock response for file open dialogs
   */
  mockFileOpenResponse(filePaths: string[], canceled = false): void {
    this.setMockResponse('open', undefined, { canceled, filePaths });
  }

  /**
   * Set a simple mock response for file save dialogs
   */
  mockFileSaveResponse(filePath: string, canceled = false): void {
    this.setMockResponse('save', undefined, { canceled, filePath });
  }

  /**
   * Set a simple mock response for message boxes
   */
  mockMessageBoxResponse(response: number, checkboxChecked = false): void {
    this.setMockResponse('message', undefined, { canceled: false, response, checkboxChecked });
  }

  /**
   * Get the history of dialog method calls
   */
  getCallHistory(): Array<{ method: string; args: any[] }> {
    return [...this.callHistory];
  }

  /**
   * Clear call history
   */
  clearCallHistory(): void {
    this.callHistory = [];
  }

  /**
   * Get the last call made to any dialog method
   */
  getLastCall(): { method: string; args: any[] } | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  /**
   * Count calls to a specific dialog method
   */
  countCalls(method: string): number {
    return this.callHistory.filter(call => call.method === method).length;
  }

  /**
   * Verify a dialog was shown with specific options
   */
  expectDialogShown(method: string, expectedOptions?: any): boolean {
    const calls = this.callHistory.filter(call => call.method === method);
    if (calls.length === 0) return false;

    if (expectedOptions) {
      return calls.some(call => {
        const [, options] = call.args;
        return this.deepEqual(options, expectedOptions);
      });
    }

    return true;
  }

  /**
   * Deep equality check for objects
   */
  private deepEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  /**
   * Restore original dialog methods
   */
  restore(): void {
    Object.keys(this.originalDialogMethods).forEach(key => {
      (dialog as any)[key] = this.originalDialogMethods[key];
    });
    this.mockResponses.clear();
    this.callHistory = [];
    this.removeAllListeners();
  }

  /**
   * Create a test window for dialog testing
   */
  createTestWindow(): BrowserWindow {
    return new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
  }

  /**
   * Simulate user canceling a dialog
   */
  simulateCancel(): void {
    // This would be used in integration with actual Electron testing
    this.emit('userCancel');
  }

  /**
   * Simulate user confirming a dialog
   */
  simulateConfirm(data?: any): void {
    this.emit('userConfirm', data);
  }
}

export default DialogTestBase;