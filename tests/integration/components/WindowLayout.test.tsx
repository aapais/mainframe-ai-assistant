/**
 * Window Layout Integration Tests
 * Testing window management and layout functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainWindowLayout } from '../../../implementation/frontend/layouts/MainWindowLayout';
import { mockElectronAPI } from '../../../src/renderer/components/__tests__/setup';

describe('Window Layout Integration Tests', () => {
  const defaultProps = {
    windowId: 'test-main-window',
    initialTitle: 'Test Mainframe KB Assistant',
    children: <div data-testid="window-content">Test Content</div>,
  };

  const mockOnClose = jest.fn();
  const mockOnMinimize = jest.fn();
  const mockOnMaximize = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window state hooks
    jest.mock('../../../implementation/frontend/hooks/useWindowState', () => ({
      useWindowState: jest.fn(() => ({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [
          {
            id: 'dashboard-tab',
            title: 'Dashboard',
            icon: '🏠',
            closable: false,
            active: true,
            isDirty: false,
            data: { type: 'dashboard', route: '/dashboard' },
          },
          {
            id: 'knowledge-base-tab',
            title: 'Knowledge Base',
            icon: '📚',
            closable: false,
            active: false,
            isDirty: false,
            data: { type: 'knowledge-base', route: '/knowledge-base' },
          },
        ],
        actions: {
          addTab: jest.fn(),
          removeTab: jest.fn(),
          activateTab: jest.fn(),
          updateTab: jest.fn(),
          close: jest.fn(),
          minimize: jest.fn(),
          maximize: jest.fn(),
          restore: jest.fn(),
          updateBounds: jest.fn(),
        },
        activeTab: {
          id: 'dashboard-tab',
          title: 'Dashboard',
          icon: '🏠',
          closable: false,
          active: true,
          isDirty: false,
          data: { type: 'dashboard', route: '/dashboard' },
        },
      })),
    }));

    jest.mock('../../../implementation/frontend/hooks/useWindowFocus', () => ({
      useWindowFocus: jest.fn(() => ({
        isFocused: true,
        actions: {
          focus: jest.fn(),
          blur: jest.fn(),
        },
      })),
    }));

    jest.mock('../../../implementation/frontend/hooks/useWindowCommunication', () => ({
      useWindowCommunication: jest.fn(() => ({
        connectionStatus: 'connected',
        actions: {
          sendMessage: jest.fn(),
          subscribe: jest.fn(),
          unsubscribe: jest.fn(),
        },
      })),
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Window Rendering', () => {
    it('renders main window layout with correct structure', () => {
      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.getByTestId('window-content')).toBeInTheDocument();
      expect(screen.getByText('Test Mainframe KB Assistant')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
    });

    it('displays window title bar with controls', () => {
      render(
        <MainWindowLayout
          {...defaultProps}
          onClose={mockOnClose}
          onMinimize={mockOnMinimize}
          onMaximize={mockOnMaximize}
        />
      );

      expect(screen.getByRole('button', { name: /minimize/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /maximize/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('shows connection status indicator', () => {
      render(<MainWindowLayout {...defaultProps} />);

      const statusIndicator = screen.getByTitle(/connection: connected/i);
      expect(statusIndicator).toBeInTheDocument();
      expect(statusIndicator).toHaveTextContent('🟢');
    });

    it('displays window status bar with information', () => {
      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.getByText(/main • 800×600/)).toBeInTheDocument();
      expect(screen.getByText(/2 tabs/)).toBeInTheDocument();
    });
  });

  describe('Tab Management', () => {
    it('handles tab switching correctly', async () => {
      const user = userEvent.setup();
      render(<MainWindowLayout {...defaultProps} />);

      const kbTab = screen.getByText('Knowledge Base');
      await user.click(kbTab);

      // Should trigger tab activation
      expect(window.location.hash).toBe('#/knowledge-base');
    });

    it('prevents closing non-closable tabs', async () => {
      const user = userEvent.setup();
      render(<MainWindowLayout {...defaultProps} />);

      const dashboardTab = screen.getByText('Dashboard');
      
      // Try to find close button - should not exist for non-closable tabs
      const closeButton = screen.queryByRole('button', { name: /close dashboard tab/i });
      expect(closeButton).not.toBeInTheDocument();
    });

    it('shows dirty indicator for modified tabs', () => {
      // Mock a dirty tab
      const mockUseWindowState = require('../../../implementation/frontend/hooks/useWindowState').useWindowState;
      mockUseWindowState.mockReturnValue({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [
          {
            id: 'dashboard-tab',
            title: 'Dashboard',
            icon: '🏠',
            closable: false,
            active: true,
            isDirty: true, // Dirty tab
            data: { type: 'dashboard', route: '/dashboard' },
          },
        ],
        actions: {
          addTab: jest.fn(),
          removeTab: jest.fn(),
          activateTab: jest.fn(),
          updateTab: jest.fn(),
          close: jest.fn(),
          minimize: jest.fn(),
          maximize: jest.fn(),
          restore: jest.fn(),
          updateBounds: jest.fn(),
        },
        activeTab: {
          id: 'dashboard-tab',
          title: 'Dashboard',
          icon: '🏠',
          closable: false,
          active: true,
          isDirty: true,
          data: { type: 'dashboard', route: '/dashboard' },
        },
      });

      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.getByText('•')).toBeInTheDocument(); // Dirty indicator
    });
  });

  describe('Window Controls', () => {
    it('handles window close with confirmation for dirty tabs', async () => {
      const user = userEvent.setup();
      
      // Mock dirty tabs
      const mockUseWindowState = require('../../../implementation/frontend/hooks/useWindowState').useWindowState;
      const mockActions = {
        addTab: jest.fn(),
        removeTab: jest.fn(),
        activateTab: jest.fn(),
        updateTab: jest.fn(),
        close: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        restore: jest.fn(),
        updateBounds: jest.fn(),
      };
      
      mockUseWindowState.mockReturnValue({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [
          {
            id: 'dashboard-tab',
            title: 'Dashboard',
            icon: '🏠',
            closable: false,
            active: true,
            isDirty: true, // Dirty tab
            data: { type: 'dashboard', route: '/dashboard' },
          },
        ],
        actions: mockActions,
        activeTab: {
          id: 'dashboard-tab',
          title: 'Dashboard',
          icon: '🏠',
          closable: false,
          active: true,
          isDirty: true,
          data: { type: 'dashboard', route: '/dashboard' },
        },
      });

      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = jest.fn().mockReturnValue(true);

      render(
        <MainWindowLayout
          {...defaultProps}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('You have unsaved changes')
      );
      expect(mockActions.close).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();

      window.confirm = originalConfirm;
    });

    it('handles minimize action', async () => {
      const user = userEvent.setup();
      render(
        <MainWindowLayout
          {...defaultProps}
          onMinimize={mockOnMinimize}
        />
      );

      const minimizeButton = screen.getByRole('button', { name: /minimize/i });
      await user.click(minimizeButton);

      expect(mockOnMinimize).toHaveBeenCalled();
    });

    it('toggles maximize/restore correctly', async () => {
      const user = userEvent.setup();
      const mockUseWindowState = require('../../../implementation/frontend/hooks/useWindowState').useWindowState;
      const mockActions = {
        addTab: jest.fn(),
        removeTab: jest.fn(),
        activateTab: jest.fn(),
        updateTab: jest.fn(),
        close: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        restore: jest.fn(),
        updateBounds: jest.fn(),
      };

      // Start with non-maximized window
      mockUseWindowState.mockReturnValue({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [],
        actions: mockActions,
        activeTab: null,
      });

      const { rerender } = render(
        <MainWindowLayout
          {...defaultProps}
          onMaximize={mockOnMaximize}
        />
      );

      const maximizeButton = screen.getByRole('button', { name: /maximize/i });
      await user.click(maximizeButton);

      expect(mockActions.maximize).toHaveBeenCalled();
      expect(mockOnMaximize).toHaveBeenCalled();

      // Now test with maximized window
      mockUseWindowState.mockReturnValue({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          isMaximized: true,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [],
        actions: mockActions,
        activeTab: null,
      });

      rerender(
        <MainWindowLayout
          {...defaultProps}
          onMaximize={mockOnMaximize}
        />
      );

      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      expect(mockActions.restore).toHaveBeenCalled();
    });
  });

  describe('Theme Management', () => {
    it('applies light theme by default', () => {
      render(<MainWindowLayout {...defaultProps} />);

      const windowElement = screen.getByTestId('window-content').closest('.main-window-layout');
      expect(windowElement).toHaveClass('light');
      expect(windowElement).toHaveAttribute('data-theme', 'light');
    });

    it('responds to theme change events', async () => {
      render(<MainWindowLayout {...defaultProps} />);

      // Simulate theme change event
      const themeChangeEvent = new CustomEvent('theme-changed', {
        detail: { theme: 'dark' },
      });

      fireEvent(window, themeChangeEvent);

      await waitFor(() => {
        const windowElement = screen.getByTestId('window-content').closest('.main-window-layout');
        expect(windowElement).toHaveClass('dark');
        expect(windowElement).toHaveAttribute('data-theme', 'dark');
      });
    });

    it('gets initial theme from electronAPI', async () => {
      mockElectronAPI.getTheme.mockResolvedValue('dark');

      render(<MainWindowLayout {...defaultProps} />);

      await waitFor(() => {
        const windowElement = screen.getByTestId('window-content').closest('.main-window-layout');
        expect(windowElement).toHaveClass('dark');
      });
    });
  });

  describe('IPC Message Handling', () => {
    it('handles KB update messages', async () => {
      render(<MainWindowLayout {...defaultProps} />);

      // Simulate KB update message
      const kbUpdateEvent = new CustomEvent('kb-refresh', {
        detail: { entryId: 'test-123', action: 'update' },
      });

      const eventSpy = jest.spyOn(window, 'dispatchEvent');

      // Trigger IPC message handling
      fireEvent(window, kbUpdateEvent);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('handles search result messages', async () => {
      const mockUseWindowState = require('../../../implementation/frontend/hooks/useWindowState').useWindowState;
      const mockActions = {
        addTab: jest.fn(),
        removeTab: jest.fn(),
        activateTab: jest.fn(),
        updateTab: jest.fn(),
        close: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        restore: jest.fn(),
        updateBounds: jest.fn(),
      };

      mockUseWindowState.mockReturnValue({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [
          {
            id: 'search-tab',
            title: 'Search',
            icon: '🔍',
            closable: false,
            active: false,
            isDirty: false,
            data: { type: 'search', route: '/search' },
          },
        ],
        actions: mockActions,
        activeTab: null,
      });

      render(<MainWindowLayout {...defaultProps} />);

      // Simulate search result message
      const searchResultEvent = new CustomEvent('search-results', {
        detail: [{ id: '1', title: 'Test Result' }],
      });

      fireEvent(window, searchResultEvent);

      expect(mockActions.activateTab).toHaveBeenCalledWith('search-tab');
    });
  });

  describe('Connection Status', () => {
    it('shows disconnected status', () => {
      const mockUseWindowCommunication = require('../../../implementation/frontend/hooks/useWindowCommunication').useWindowCommunication;
      
      mockUseWindowCommunication.mockReturnValue({
        connectionStatus: 'disconnected',
        actions: {
          sendMessage: jest.fn(),
          subscribe: jest.fn(),
          unsubscribe: jest.fn(),
        },
      });

      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.getByText('⚠️ Disconnected')).toBeInTheDocument();
      
      const statusIndicator = screen.getByTitle(/connection: disconnected/i);
      expect(statusIndicator).toHaveTextContent('🔴');
    });

    it('shows reconnecting status', () => {
      const mockUseWindowCommunication = require('../../../implementation/frontend/hooks/useWindowCommunication').useWindowCommunication;
      
      mockUseWindowCommunication.mockReturnValue({
        connectionStatus: 'reconnecting',
        actions: {
          sendMessage: jest.fn(),
          subscribe: jest.fn(),
          unsubscribe: jest.fn(),
        },
      });

      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.getByText('🔄 Reconnecting...')).toBeInTheDocument();
      
      const statusIndicator = screen.getByTitle(/connection: reconnecting/i);
      expect(statusIndicator).toHaveTextContent('🟡');
    });
  });

  describe('Window Resizing', () => {
    it('handles resize events correctly', async () => {
      const mockUseWindowState = require('../../../implementation/frontend/hooks/useWindowState').useWindowState;
      const mockActions = {
        addTab: jest.fn(),
        removeTab: jest.fn(),
        activateTab: jest.fn(),
        updateTab: jest.fn(),
        close: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        restore: jest.fn(),
        updateBounds: jest.fn(),
      };

      mockUseWindowState.mockReturnValue({
        windowState: {
          type: 'main',
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isMinimized: false,
          zIndex: 1,
        },
        tabs: [],
        actions: mockActions,
        activeTab: null,
      });

      render(<MainWindowLayout {...defaultProps} />);

      // Simulate resize event
      const resizeEvent = new Event('resize');
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      
      fireEvent(window, resizeEvent);

      await waitFor(() => {
        expect(mockActions.updateBounds).toHaveBeenCalledWith({
          width: 1024,
          height: 768,
        });
      });
    });
  });

  describe('Development Mode', () => {
    it('shows development shortcuts in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.getByTitle(/development shortcuts/i)).toBeInTheDocument();
      expect(screen.getByText(/ctrl\+r/i)).toBeInTheDocument();
      expect(screen.getByText(/f12/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('hides development shortcuts in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(<MainWindowLayout {...defaultProps} />);

      expect(screen.queryByTitle(/development shortcuts/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});