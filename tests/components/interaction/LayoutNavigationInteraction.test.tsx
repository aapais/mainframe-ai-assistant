/**
 * Layout and Navigation Component Interaction Tests
 *
 * Tests for layout components, navigation patterns, and responsive behavior
 * including AppLayout, sidebar interactions, and navigation components.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import { AppLayout } from '../../../src/components/Layout/AppLayout';
import { IntegratedNavigationSystem } from '../../../src/components/navigation/IntegratedNavigationSystem';
import { BreadcrumbNavigation } from '../../../src/components/navigation/BreadcrumbNavigation';
import { SearchResultNavigation } from '../../../src/components/navigation/SearchResultNavigation';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester
} from './ComponentInteractionTestSuite';

// Mock data
const mockNavigationItems = [
  { id: '1', title: 'Home', path: '/', icon: '🏠' },
  { id: '2', title: 'Search', path: '/search', icon: '🔍' },
  { id: '3', title: 'Settings', path: '/settings', icon: '⚙️' }
];

const mockBreadcrumbs = [
  { label: 'Home', href: '/' },
  { label: 'Knowledge Base', href: '/kb' },
  { label: 'Current Page', href: '/kb/current' }
];

describe('Layout and Navigation Component Interactions', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    user = userEvent.setup();

    // Mock window dimensions for responsive tests
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();
  });

  describe('AppLayout Component Interactions', () => {
    it('should handle sidebar toggle interaction', async () => {
      const onSidebarToggle = tester.createMock('onSidebarToggle');

      const TestSidebar = () => (
        <div data-testid="sidebar-content">
          <nav>Sidebar Navigation</nav>
        </div>
      );

      const TestHeader = () => (
        <div data-testid="header-content">
          <h1>Application Header</h1>
        </div>
      );

      render(
        <AppLayout
          header={<TestHeader />}
          sidebar={<TestSidebar />}
          onSidebarToggle={onSidebarToggle}
          sidebarToggleable={true}
          data-testid="app-layout"
        >
          <div data-testid="main-content">Main Content</div>
        </AppLayout>
      );

      // Assert initial render
      expect(screen.getByTestId('app-layout')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();

      // Find and click sidebar toggle
      const toggleButton = screen.getByTestId('sidebar-toggle');
      await user.click(toggleButton);

      // Assert toggle callback was called
      expect(onSidebarToggle).toHaveBeenCalledWith(true);
    });

    it('should handle responsive behavior on mobile', async () => {
      const onSidebarToggle = tester.createMock('onSidebarToggle');

      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 480 });

      // Trigger resize event
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      render(
        <AppLayout
          header={<div>Header</div>}
          sidebar={<div data-testid="sidebar">Sidebar</div>}
          onSidebarToggle={onSidebarToggle}
          responsive={true}
          data-testid="app-layout"
        >
          <div>Content</div>
        </AppLayout>
      );

      // On mobile, sidebar should be collapsed by default
      const layout = screen.getByTestId('app-layout');
      expect(layout).toHaveAttribute('data-sidebar-collapsed', 'true');

      // Click toggle to open sidebar
      const toggleButton = screen.getByTestId('sidebar-toggle');
      await user.click(toggleButton);

      // Mobile overlay should appear
      const overlay = screen.getByTestId('mobile-sidebar-overlay');
      expect(overlay).toBeInTheDocument();

      // Click overlay to close sidebar
      await user.click(overlay);

      // Sidebar should close
      await waitFor(() => {
        expect(layout).toHaveAttribute('data-sidebar-collapsed', 'true');
      });
    });

    it('should handle layout variant changes', async () => {
      const { rerender } = render(
        <AppLayout variant="default" data-testid="app-layout">
          <div>Content</div>
        </AppLayout>
      );

      let layout = screen.getByTestId('app-layout');
      expect(layout).toHaveAttribute('data-layout-variant', 'default');

      // Change to full-width variant
      rerender(
        <AppLayout variant="full-width" data-testid="app-layout">
          <div>Content</div>
        </AppLayout>
      );

      layout = screen.getByTestId('app-layout');
      expect(layout).toHaveAttribute('data-layout-variant', 'full-width');
    });
  });

  describe('Navigation System Interactions', () => {
    it('should handle navigation item selection', async () => {
      const onNavigate = tester.createMock('onNavigate');
      const onItemSelect = tester.createMock('onItemSelect');

      render(
        <IntegratedNavigationSystem
          navigationItems={mockNavigationItems}
          onNavigate={onNavigate}
          onItemSelect={onItemSelect}
          currentPath="/search"
          data-testid="navigation-system"
        />
      );

      // Find and click navigation item
      const searchItem = screen.getByRole('button', { name: /search/i });
      await user.click(searchItem);

      // Assert navigation callbacks
      expect(onNavigate).toHaveBeenCalledWith('/search');
      expect(onItemSelect).toHaveBeenCalledWith(mockNavigationItems[1]);
    });

    it('should handle keyboard navigation', async () => {
      const onNavigate = tester.createMock('onNavigate');

      render(
        <IntegratedNavigationSystem
          navigationItems={mockNavigationItems}
          onNavigate={onNavigate}
          enableKeyboardShortcuts={true}
          data-testid="navigation-system"
        />
      );

      const navigationContainer = screen.getByTestId('navigation-system');

      // Focus navigation
      await user.click(navigationContainer);

      // Use arrow keys to navigate
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Assert navigation occurred
      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalled();
      });
    });

    it('should handle breadcrumb navigation', async () => {
      const onBreadcrumbClick = tester.createMock('onBreadcrumbClick');

      render(
        <BreadcrumbNavigation
          breadcrumbs={mockBreadcrumbs}
          onBreadcrumbClick={onBreadcrumbClick}
          data-testid="breadcrumb-nav"
        />
      );

      // Click on a breadcrumb
      const homeLink = screen.getByRole('link', { name: /home/i });
      await user.click(homeLink);

      // Assert breadcrumb click
      expect(onBreadcrumbClick).toHaveBeenCalledWith(mockBreadcrumbs[0]);
    });
  });

  describe('Search Result Navigation', () => {
    it('should handle result navigation with pagination', async () => {
      const onNavigate = tester.createMock('onNavigate');
      const onPageChange = tester.createMock('onPageChange');

      const mockResults = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        title: `Result ${i}`,
        path: `/result/${i}`
      }));

      render(
        <SearchResultNavigation
          results={mockResults}
          currentIndex={0}
          resultsPerPage={10}
          onNavigate={onNavigate}
          onPageChange={onPageChange}
          enableKeyboardNavigation={true}
          data-testid="result-navigation"
        />
      );

      // Test next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(onNavigate).toHaveBeenCalledWith(1);

      // Test page change
      const page2Button = screen.getByRole('button', { name: /page 2/i });
      await user.click(page2Button);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should handle keyboard shortcuts for navigation', async () => {
      const onNavigate = tester.createMock('onNavigate');

      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        title: `Result ${i}`,
        path: `/result/${i}`
      }));

      render(
        <SearchResultNavigation
          results={mockResults}
          currentIndex={2}
          onNavigate={onNavigate}
          enableKeyboardNavigation={true}
          data-testid="result-navigation"
        />
      );

      const navigationContainer = screen.getByTestId('result-navigation');
      await user.click(navigationContainer);

      // Test keyboard shortcuts
      await user.keyboard('j'); // Next result (vim-style)
      expect(onNavigate).toHaveBeenCalledWith(3);

      await user.keyboard('k'); // Previous result
      expect(onNavigate).toHaveBeenCalledWith(2);

      await user.keyboard('gg'); // First result
      expect(onNavigate).toHaveBeenCalledWith(0);

      await user.keyboard('G'); // Last result
      expect(onNavigate).toHaveBeenCalledWith(9);
    });
  });

  describe('Cross-Component Layout Integration', () => {
    it('should handle complex layout with navigation integration', async () => {
      const onNavigate = tester.createMock('onNavigate');
      const onSidebarToggle = tester.createMock('onSidebarToggle');

      const TestApp = () => {
        const [currentPath, setCurrentPath] = React.useState('/');
        const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

        const handleNavigate = (path: string) => {
          setCurrentPath(path);
          onNavigate(path);
        };

        const handleSidebarToggle = (collapsed: boolean) => {
          setSidebarCollapsed(collapsed);
          onSidebarToggle(collapsed);
        };

        return (
          <AppLayout
            header={
              <BreadcrumbNavigation
                breadcrumbs={mockBreadcrumbs}
                onBreadcrumbClick={(breadcrumb) => handleNavigate(breadcrumb.href)}
                data-testid="header-breadcrumbs"
              />
            }
            sidebar={
              <IntegratedNavigationSystem
                navigationItems={mockNavigationItems}
                currentPath={currentPath}
                onNavigate={handleNavigate}
                collapsed={sidebarCollapsed}
                data-testid="sidebar-navigation"
              />
            }
            onSidebarToggle={handleSidebarToggle}
            sidebarCollapsed={sidebarCollapsed}
            data-testid="integrated-layout"
          >
            <div data-testid="main-content">
              Current Path: {currentPath}
            </div>
          </AppLayout>
        );
      };

      render(<TestApp />);

      // Test sidebar navigation
      const searchNavItem = screen.getByRole('button', { name: /search/i });
      await user.click(searchNavItem);

      expect(onNavigate).toHaveBeenCalledWith('/search');
      expect(screen.getByText('Current Path: /search')).toBeInTheDocument();

      // Test breadcrumb navigation
      const homeLink = screen.getByRole('link', { name: /home/i });
      await user.click(homeLink);

      expect(onNavigate).toHaveBeenCalledWith('/');
      expect(screen.getByText('Current Path: /')).toBeInTheDocument();

      // Test sidebar toggle
      const toggleButton = screen.getByTestId('sidebar-toggle');
      await user.click(toggleButton);

      expect(onSidebarToggle).toHaveBeenCalledWith(true);
    });

    it('should handle responsive navigation collapse', async () => {
      const TestResponsiveApp = () => {
        const [windowWidth, setWindowWidth] = React.useState(1024);

        React.useEffect(() => {
          const handleResize = () => setWindowWidth(window.innerWidth);
          window.addEventListener('resize', handleResize);
          return () => window.removeEventListener('resize', handleResize);
        }, []);

        return (
          <AppLayout
            sidebar={
              <IntegratedNavigationSystem
                navigationItems={mockNavigationItems}
                collapsed={windowWidth < 768}
                responsive={true}
                data-testid="responsive-navigation"
              />
            }
            responsive={true}
            data-testid="responsive-layout"
          >
            <div>Width: {windowWidth}</div>
          </AppLayout>
        );
      };

      render(<TestResponsiveApp />);

      // Simulate mobile resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 600 });
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        const layout = screen.getByTestId('responsive-layout');
        expect(layout).toHaveAttribute('data-responsive', 'true');
      });
    });
  });

  describe('Navigation State Management', () => {
    it('should maintain navigation state across interactions', async () => {
      const StateTestComponent = () => {
        const [navigationState, setNavigationState] = React.useState({
          currentPath: '/',
          history: ['/'],
          selectedItem: null as any
        });

        const handleNavigate = (path: string) => {
          setNavigationState(prev => ({
            currentPath: path,
            history: [...prev.history, path],
            selectedItem: mockNavigationItems.find(item => item.path === path)
          }));
        };

        return (
          <div data-testid="state-container">
            <IntegratedNavigationSystem
              navigationItems={mockNavigationItems}
              currentPath={navigationState.currentPath}
              onNavigate={handleNavigate}
              onItemSelect={(item) => setNavigationState(prev => ({ ...prev, selectedItem: item }))}
              data-testid="stateful-navigation"
            />
            <div data-testid="current-path">Path: {navigationState.currentPath}</div>
            <div data-testid="history-length">History: {navigationState.history.length}</div>
            <div data-testid="selected-item">
              Selected: {navigationState.selectedItem?.title || 'None'}
            </div>
          </div>
        );
      };

      render(<StateTestComponent />);

      // Navigate to search
      const searchItem = screen.getByRole('button', { name: /search/i });
      await user.click(searchItem);

      // Assert state updates
      expect(screen.getByTestId('current-path')).toHaveTextContent('Path: /search');
      expect(screen.getByTestId('history-length')).toHaveTextContent('History: 2');
      expect(screen.getByTestId('selected-item')).toHaveTextContent('Selected: Search');

      // Navigate to settings
      const settingsItem = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsItem);

      // Assert further state updates
      expect(screen.getByTestId('current-path')).toHaveTextContent('Path: /settings');
      expect(screen.getByTestId('history-length')).toHaveTextContent('History: 3');
      expect(screen.getByTestId('selected-item')).toHaveTextContent('Selected: Settings');
    });
  });

  describe('Accessibility in Navigation', () => {
    it('should handle focus management in navigation', async () => {
      render(
        <IntegratedNavigationSystem
          navigationItems={mockNavigationItems}
          enableKeyboardShortcuts={true}
          ariaLabel="Main navigation"
          data-testid="accessible-navigation"
        />
      );

      const navigation = screen.getByRole('navigation', { name: /main navigation/i });
      expect(navigation).toBeInTheDocument();

      // Test tab navigation
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /home/i }));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /search/i }));

      // Test arrow key navigation
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /settings/i }));
    });

    it('should provide proper ARIA attributes', async () => {
      render(
        <BreadcrumbNavigation
          breadcrumbs={mockBreadcrumbs}
          ariaLabel="Breadcrumb navigation"
          data-testid="breadcrumb-navigation"
        />
      );

      const nav = screen.getByRole('navigation', { name: /breadcrumb navigation/i });
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb navigation');

      const breadcrumbList = screen.getByRole('list');
      expect(breadcrumbList).toBeInTheDocument();

      // Check current page is marked as current
      const currentPage = screen.getByRole('link', { name: /current page/i });
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });
  });
});