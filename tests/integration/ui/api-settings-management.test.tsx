/**
 * API Settings Management UI Integration Tests
 * Tests encryption/decryption, secure storage, and UI interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { APISettingsManagement } from '../../../src/renderer/components/settings/APISettingsManagement';

// Mock crypto for encryption testing
const mockCrypto = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  generateKey: jest.fn(),
};

// Mock IPC for secure storage
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockIpcRenderer,
  writable: true,
});

Object.defineProperty(window, 'cryptoAPI', {
  value: mockCrypto,
  writable: true,
});

// Mock API settings data
const mockAPISettings = {
  openai: {
    apiKey: 'sk-encrypted-key-12345',
    model: 'gpt-4',
    maxTokens: 4000,
    temperature: 0.7,
    isEncrypted: true,
    lastUpdated: new Date().toISOString(),
  },
  anthropic: {
    apiKey: 'claude-encrypted-key-67890',
    model: 'claude-3-opus',
    maxTokens: 8000,
    temperature: 0.5,
    isEncrypted: true,
    lastUpdated: new Date().toISOString(),
  },
  azure: {
    apiKey: '',
    endpoint: '',
    model: '',
    isEncrypted: false,
    lastUpdated: null,
  },
};

describe('API Settings Management Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      switch (channel) {
        case 'api-settings:get-all':
          return Promise.resolve(mockAPISettings);
        case 'api-settings:save':
          return Promise.resolve({ success: true });
        case 'api-settings:test-connection':
          return Promise.resolve({ success: true, responseTime: 245 });
        case 'api-settings:encrypt-key':
          return Promise.resolve('encrypted-' + args[0]);
        case 'api-settings:decrypt-key':
          return Promise.resolve(args[0].replace('encrypted-', ''));
        default:
          return Promise.resolve();
      }
    });

    mockCrypto.encrypt.mockImplementation((data) => Promise.resolve('encrypted-' + data));
    mockCrypto.decrypt.mockImplementation((data) => Promise.resolve(data.replace('encrypted-', '')));
  });

  describe('Settings Loading and Display', () => {
    test('should load and display all API provider settings', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('api-settings:get-all');
      });

      // Check provider tabs
      expect(screen.getByRole('tab', { name: /openai/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /anthropic/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /azure/i })).toBeInTheDocument();

      // Check encrypted key indicators
      expect(screen.getByTestId('openai-encryption-status')).toHaveTextContent('Encrypted');
      expect(screen.getByTestId('anthropic-encryption-status')).toHaveTextContent('Encrypted');
    });

    test('should mask API keys by default', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByTestId('openai-api-key-input');
        expect(apiKeyInput).toHaveAttribute('type', 'password');
        expect(apiKeyInput).toHaveValue('sk-encrypted-key-12345');
      });
    });

    test('should show/hide API keys with toggle button', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const toggleBtn = screen.getByTestId('openai-key-visibility-toggle');
        const apiKeyInput = screen.getByTestId('openai-api-key-input');

        expect(apiKeyInput).toHaveAttribute('type', 'password');

        fireEvent.click(toggleBtn);
        expect(apiKeyInput).toHaveAttribute('type', 'text');

        fireEvent.click(toggleBtn);
        expect(apiKeyInput).toHaveAttribute('type', 'password');
      });
    });
  });

  describe('Encryption and Decryption', () => {
    test('should encrypt new API key on save', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByTestId('openai-api-key-input');
        fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key-12345' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:encrypt-key',
          'sk-new-key-12345'
        );
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:save',
          expect.objectContaining({
            openai: expect.objectContaining({
              apiKey: 'encrypted-sk-new-key-12345',
              isEncrypted: true,
            }),
          })
        );
      });
    });

    test('should decrypt key for testing connection', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const testBtn = screen.getByTestId('openai-test-connection');
        fireEvent.click(testBtn);
      });

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:decrypt-key',
          'sk-encrypted-key-12345'
        );
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:test-connection',
          'openai',
          'sk-encrypted-key-12345'
        );
      });
    });

    test('should handle encryption errors gracefully', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('Encryption failed'));

      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByTestId('openai-api-key-input');
        fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/encryption failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Connection Testing', () => {
    test('should test API connection successfully', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const testBtn = screen.getByTestId('openai-test-connection');
        fireEvent.click(testBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
        expect(screen.getByText('245ms')).toBeInTheDocument(); // Response time
      });
    });

    test('should handle connection test failures', async () => {
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        if (channel === 'api-settings:test-connection') {
          return Promise.resolve({ success: false, error: 'Invalid API key' });
        }
        return Promise.resolve();
      });

      render(<APISettingsManagement />);

      await waitFor(() => {
        const testBtn = screen.getByTestId('openai-test-connection');
        fireEvent.click(testBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
        expect(screen.getByText('Invalid API key')).toBeInTheDocument();
      });
    });

    test('should show loading state during connection test', async () => {
      // Mock delayed response
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        if (channel === 'api-settings:test-connection') {
          return new Promise(resolve =>
            setTimeout(() => resolve({ success: true, responseTime: 300 }), 1000)
          );
        }
        return Promise.resolve();
      });

      render(<APISettingsManagement />);

      await waitFor(() => {
        const testBtn = screen.getByTestId('openai-test-connection');
        fireEvent.click(testBtn);
      });

      // Should show loading spinner
      expect(screen.getByTestId('connection-test-loading')).toBeInTheDocument();
      expect(testBtn).toBeDisabled();
    });
  });

  describe('Settings Validation', () => {
    test('should validate required fields', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByTestId('openai-api-key-input');
        fireEvent.change(apiKeyInput, { target: { value: '' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/api key is required/i)).toBeInTheDocument();
      });
    });

    test('should validate API key format', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByTestId('openai-api-key-input');
        fireEvent.change(apiKeyInput, { target: { value: 'invalid-key' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument();
      });
    });

    test('should validate model parameters', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const maxTokensInput = screen.getByTestId('openai-max-tokens-input');
        fireEvent.change(maxTokensInput, { target: { value: '999999' } });
      });

      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/max tokens exceeds limit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Provider-Specific Settings', () => {
    test('should switch between provider tabs', async () => {
      render(<APISettingsManagement />);

      // Start with OpenAI tab active
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /openai/i })).toHaveAttribute('aria-selected', 'true');
      });

      // Switch to Anthropic
      fireEvent.click(screen.getByRole('tab', { name: /anthropic/i }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /anthropic/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('anthropic-api-key-input')).toBeInTheDocument();
      });
    });

    test('should show provider-specific model options', async () => {
      render(<APISettingsManagement />);

      // OpenAI models
      await waitFor(() => {
        const modelSelect = screen.getByTestId('openai-model-select');
        expect(within(modelSelect).getByText('gpt-4')).toBeInTheDocument();
        expect(within(modelSelect).getByText('gpt-3.5-turbo')).toBeInTheDocument();
      });

      // Switch to Anthropic
      fireEvent.click(screen.getByRole('tab', { name: /anthropic/i }));

      await waitFor(() => {
        const modelSelect = screen.getByTestId('anthropic-model-select');
        expect(within(modelSelect).getByText('claude-3-opus')).toBeInTheDocument();
        expect(within(modelSelect).getByText('claude-3-sonnet')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and UX', () => {
    test('should have proper form labels and descriptions', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByTestId('openai-api-key-input');
        expect(apiKeyInput).toHaveAttribute('aria-describedby');

        const description = screen.getByText(/your api key will be encrypted/i);
        expect(description).toBeInTheDocument();
      });
    });

    test('should support keyboard navigation', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const firstTab = screen.getByRole('tab', { name: /openai/i });
        firstTab.focus();

        fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
        expect(screen.getByRole('tab', { name: /anthropic/i })).toHaveFocus();
      });
    });

    test('should show clear success/error states', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const saveBtn = screen.getByRole('button', { name: /save settings/i });
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('save-success-indicator')).toBeInTheDocument();
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    test('should clear clipboard after copying API key', async () => {
      const mockClipboard = {
        writeText: jest.fn(),
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
      });

      render(<APISettingsManagement />);

      await waitFor(() => {
        const copyBtn = screen.getByTestId('openai-copy-key-button');
        fireEvent.click(copyBtn);
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith('sk-encrypted-key-12345');

      // Should clear clipboard after timeout
      await waitFor(() => {
        expect(screen.getByText(/clipboard cleared for security/i)).toBeInTheDocument();
      }, { timeout: 15000 });
    });

    test('should log security events', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const viewKeyBtn = screen.getByTestId('openai-key-visibility-toggle');
        fireEvent.click(viewKeyBtn);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'security:log-event',
        expect.objectContaining({
          action: 'api_key_viewed',
          provider: 'openai',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Accenture Branding', () => {
    test('should apply Accenture color scheme', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const saveBtn = screen.getByRole('button', { name: /save settings/i });
        const computedStyle = window.getComputedStyle(saveBtn);
        expect(computedStyle.backgroundColor).toBe('rgb(161, 0, 255)'); // #A100FF
      });
    });
  });
});