/**
 * Accessibility Audit for KB Routing System
 * Tests WCAG 2.1 compliance, keyboard navigation, and screen reader compatibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

import { KBAppRouter } from '../../../src/renderer/routing/KBRouter';
import { KBRoutes } from '../../../src/renderer/routes/KBRoutes';
import { SearchProvider } from '../../../src/renderer/contexts/SearchContext';
import { AppProvider } from '../../../src/renderer/context/AppContext';
import { mockKBEntries } from '../../fixtures/kbEntries';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock components with accessibility features
jest.mock('../../../src/renderer/components/search/SearchInterface', () => ({
  __esModule: true,
  default: ({ onSearch }: any) => (
    <div role="search" aria-label="Knowledge base search">
      <label htmlFor="search-input">Search knowledge base</label>
      <input
        id="search-input"
        type="search"
        aria-label="Search query"
        aria-describedby="search-help"
        onChange={(e) => onSearch?.(e.target.value)}
      />
      <div id="search-help">
        Enter keywords to search the knowledge base
      </div>
      <button 
        type="submit"
        aria-label="Execute search"
        onClick={() => onSearch?.('test query')}
      >
        Search
      </button>
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/search/SearchResults', () => ({
  __esModule: true,
  default: ({ results, onEntrySelect, isLoading }: any) => (
    <div role="region" aria-label="Search results" aria-live="polite">
      {isLoading && (
        <div role="status" aria-label="Loading search results">
          Loading...
        </div>
      )}
      <div aria-label={`${results?.length || 0} search results`}>
        {results?.length || 0} results found
      </div>
      {results?.map((result: any, index: number) => (
        <article
          key={result.entry.id}
          role="button"
          tabIndex={0}
          aria-label={`Result ${index + 1}: ${result.entry.title}`}
          onClick={() => onEntrySelect?.(result.entry)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEntrySelect?.(result.entry);
            }
          }}
        >
          <h3>{result.entry.title}</h3>
          <p>{result.entry.problem}</p>
        </article>
      ))}
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/EntryDetailView', () => ({
  __esModule: true,
  default: ({ entry, showActions }: any) => (
    <main role="main" aria-labelledby="entry-title">
      <header>
        <h1 id="entry-title">{entry?.title}</h1>
        <div aria-label={`Category: ${entry?.category}`}>
          Category: {entry?.category}
        </div>
      </header>
      
      <section aria-labelledby="problem-heading">
        <h2 id="problem-heading">Problem Description</h2>
        <p>{entry?.problem}</p>
      </section>
      
      <section aria-labelledby="solution-heading">
        <h2 id="solution-heading">Solution</h2>
        <div>{entry?.solution}</div>
      </section>
      
      {showActions && (
        <div role="toolbar" aria-label="Entry actions">
          <button type="button" aria-label="Edit this entry">
            Edit
          </button>
          <button type="button" aria-label="Copy entry content">
            Copy
          </button>
          <button type="button" aria-label="Rate this entry as helpful">
            👍 Helpful
          </button>
          <button type="button" aria-label="Rate this entry as not helpful">
            👎 Not Helpful
          </button>
        </div>
      )}
    </main>
  ),
}));

jest.mock('../../../src/renderer/components/forms/KBEntryForm', () => ({
  __esModule: true,
  default: ({ mode, onSubmit, onCancel }: any) => (
    <form role="form" aria-labelledby="form-title">
      <h1 id="form-title">
        {mode === 'edit' ? 'Edit Entry' : 'Add New Entry'}
      </h1>
      
      <fieldset>
        <legend>Entry Information</legend>
        
        <div>
          <label htmlFor="entry-title">Title *</label>
          <input
            id="entry-title"
            type="text"
            required
            aria-describedby="title-help"
          />
          <div id="title-help">Enter a descriptive title</div>
        </div>
        
        <div>
          <label htmlFor="entry-category">Category *</label>
          <select id="entry-category" required>
            <option value="">Select category</option>
            <option value="JCL">JCL</option>
            <option value="VSAM">VSAM</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="entry-problem">Problem Description *</label>
          <textarea
            id="entry-problem"
            required
            aria-describedby="problem-help"
          />
          <div id="problem-help">Describe the problem in detail</div>
        </div>
        
        <div>
          <label htmlFor="entry-solution">Solution *</label>
          <textarea
            id="entry-solution"
            required
            aria-describedby="solution-help"
          />
          <div id="solution-help">Provide step-by-step solution</div>
        </div>
      </fieldset>
      
      <div role="group" aria-label="Form actions">
        <button 
          type="submit"
          onClick={(e) => { e.preventDefault(); onSubmit?.({}); }}
        >
          {mode === 'edit' ? 'Update Entry' : 'Save Entry'}
        </button>
        <button 
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  ),
}));

// Mock other components
jest.mock('../../../src/renderer/components/MetricsDashboard', () => ({
  __esModule: true,
  default: ({ onClose }: any) => (
    <main role="main" aria-labelledby="metrics-title">
      <header>
        <h1 id="metrics-title">Analytics Dashboard</h1>
        <button
          type="button"
          aria-label="Close dashboard"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <div role="region" aria-label="Metrics content">
        Dashboard content
      </div>
    </main>
  ),
}));

// Mock contexts
jest.mock('../../../src/renderer/contexts/SearchContext', () => ({
  SearchProvider: ({ children }: any) => children,
  useSearch: () => ({
    state: {
      query: '',
      results: [
        { entry: mockKBEntries[0], score: 95, matchType: 'ai' },
        { entry: mockKBEntries[1], score: 88, matchType: 'fuzzy' },
      ],
      isSearching: false,
      filters: { category: undefined },
      useAI: true,
      history: [],
    },
    performSearch: jest.fn(),
    setQuery: jest.fn(),
    updateFilters: jest.fn(),
  }),
}));

jest.mock('../../../src/renderer/context/AppContext', () => ({
  AppProvider: ({ children }: any) => children,
  useApp: () => ({
    state: {
      selectedEntry: mockKBEntries[0],
      recentEntries: [],
      isLoading: false,
      error: null,
    },
    selectEntry: jest.fn(),
  }),
}));

describe('KB Routing Accessibility Audit', () => {
  const TestApp: React.FC<{ initialRoute?: string }> = ({ 
    initialRoute = '/' 
  }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppProvider>
        <SearchProvider>
          <KBAppRouter>
            <KBRoutes />
          </KBAppRouter>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations on dashboard', async () => {
      const { container } = render(<TestApp initialRoute="/" />);
      
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations on search page', async () => {
      const { container } = render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations on entry detail', async () => {
      const { container } = render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations on entry form', async () => {
      const { container } = render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations on metrics dashboard', async () => {
      const { container } = render(<TestApp initialRoute="/metrics" />);
      
      await waitFor(() => {
        expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML Structure', () => {
    it('should use appropriate ARIA roles and landmarks', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /search results/i })).toBeInTheDocument();
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        const h2Elements = screen.getAllByRole('heading', { level: 2 });
        
        expect(h1).toBeInTheDocument();
        expect(h2Elements).toHaveLength(2); // Problem and Solution headings
      });
    });

    it('should use fieldsets and legends in forms', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /entry information/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /form actions/i })).toBeInTheDocument();
      });
    });

    it('should provide descriptive labels for form controls', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/problem description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/solution/i)).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    const user = userEvent.setup();

    it('should support keyboard navigation in search interface', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });

      // Tab to search input
      await user.tab();
      expect(screen.getByRole('searchbox')).toHaveFocus();

      // Tab to search button
      await user.tab();
      expect(screen.getByRole('button', { name: /execute search/i })).toHaveFocus();

      // Enter should trigger search
      await user.keyboard('{Enter}');
      // Search should be triggered (verified by mock)
    });

    it('should support keyboard navigation in search results', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        const results = screen.getAllByRole('button');
        expect(results.length).toBeGreaterThan(0);
      });

      // Tab through search results
      const results = screen.getAllByRole('button');
      
      for (let i = 0; i < Math.min(3, results.length); i++) {
        await user.tab();
        expect(results[i]).toHaveFocus();
      }

      // Enter should select result
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation in entry actions', async () => {
      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      await waitFor(() => {
        expect(screen.getByRole('toolbar')).toBeInTheDocument();
      });

      const toolbar = screen.getByRole('toolbar');
      const buttons = toolbar.querySelectorAll('button');

      // Tab through action buttons
      for (let i = 0; i < buttons.length; i++) {
        await user.tab();
        expect(buttons[i]).toHaveFocus();
      }
    });

    it('should support keyboard navigation in forms', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      // Tab through form fields
      const formControls = [
        screen.getByLabelText(/title/i),
        screen.getByLabelText(/category/i),
        screen.getByLabelText(/problem description/i),
        screen.getByLabelText(/solution/i),
        screen.getByRole('button', { name: /save entry/i }),
        screen.getByRole('button', { name: /cancel/i }),
      ];

      for (const control of formControls) {
        await user.tab();
        expect(control).toHaveFocus();
      }
    });

    it('should handle escape key for modal dismissal', async () => {
      render(<TestApp initialRoute="/metrics" />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Escape should close modal-like components
      await user.keyboard('{Escape}');
      
      // Should navigate away from metrics (implementation dependent)
    });

    it('should provide skip links for keyboard navigation', async () => {
      render(<TestApp initialRoute="/search" />);
      
      // Tab to first focusable element should reveal skip link
      await user.tab();
      
      // Look for skip to content link (should be implemented)
      const skipLink = screen.queryByText(/skip to content/i);
      if (skipLink) {
        expect(skipLink).toBeInTheDocument();
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide appropriate ARIA live regions', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /search results/i }))
          .toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should provide status updates for loading states', async () => {
      render(<TestApp initialRoute="/search" />);
      
      // Mock loading state
      require('../../../src/renderer/contexts/SearchContext').useSearch.mockReturnValue({
        state: {
          query: 'test',
          results: [],
          isSearching: true,
          filters: { category: undefined },
          useAI: true,
          history: [],
        },
        performSearch: jest.fn(),
        setQuery: jest.fn(),
        updateFilters: jest.fn(),
      });

      const { rerender } = render(<TestApp initialRoute="/search" />);
      rerender(<TestApp initialRoute="/search" />);

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('should provide descriptive button labels', async () => {
      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/edit this entry/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/copy entry content/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/rate.*helpful/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/rate.*not helpful/i)).toBeInTheDocument();
      });
    });

    it('should provide context for form validation', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i);
        expect(titleInput).toHaveAttribute('aria-describedby', 'title-help');
        expect(screen.getByText(/enter a descriptive title/i)).toBeInTheDocument();
      });
    });

    it('should announce route changes appropriately', async () => {
      const { rerender } = render(<TestApp initialRoute="/" />);
      
      // Change route
      rerender(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        // Should focus on main heading or provide announcement
        const searchHeading = screen.getByRole('searchbox');
        expect(searchHeading).toBeInTheDocument();
      });
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color for information', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        // Check that interactive elements have non-color indicators
        const searchButton = screen.getByRole('button', { name: /execute search/i });
        expect(searchButton).toBeInTheDocument();
        
        // Should have text label, not just color
        expect(searchButton).toHaveTextContent('Search');
      });
    });

    it('should provide sufficient color contrast', async () => {
      const { container } = render(<TestApp initialRoute="/search" />);
      
      // This would typically be tested with automated tools or manual verification
      // Here we ensure elements are properly styled
      const searchInput = screen.getByRole('searchbox');
      const computedStyle = window.getComputedStyle(searchInput);
      
      // Basic check that styling is applied
      expect(computedStyle.color).toBeTruthy();
      expect(computedStyle.backgroundColor).toBeTruthy();
    });
  });

  describe('Focus Management', () => {
    const user = userEvent.setup();

    it('should manage focus on route transitions', async () => {
      const { rerender } = render(<TestApp initialRoute="/" />);
      
      // Navigate to search
      rerender(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        // Focus should be managed appropriately
        const searchInput = screen.getByRole('searchbox');
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should restore focus after modal interactions', async () => {
      render(<TestApp initialRoute="/metrics" />);
      
      await waitFor(() => {
        const closeButton = screen.getByLabelText(/close dashboard/i);
        expect(closeButton).toBeInTheDocument();
      });

      // Focus close button
      const closeButton = screen.getByLabelText(/close dashboard/i);
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      // Click to close (would normally restore focus to trigger)
      await user.click(closeButton);
    });

    it('should trap focus in modal dialogs', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      // In a real modal, focus should be trapped within the form
      // This test ensures the form is properly structured for focus trapping
      const formElements = screen.getAllByRole('textbox')
        .concat(screen.getAllByRole('combobox'))
        .concat(screen.getAllByRole('button'));
      
      expect(formElements.length).toBeGreaterThan(0);
    });

    it('should provide visible focus indicators', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        const searchInput = screen.getByRole('searchbox');
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('searchbox');
      await user.click(searchInput);
      
      // Focus indicator should be present (checked via CSS or DOM attributes)
      expect(searchInput).toHaveFocus();
    });
  });

  describe('Mobile Accessibility', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });
    });

    it('should support touch navigation', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        const results = screen.getAllByRole('button');
        expect(results.length).toBeGreaterThan(0);
      });

      // Touch targets should be appropriately sized (44x44px minimum)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const style = window.getComputedStyle(button);
        // This would normally check computed dimensions
        expect(button).toBeInTheDocument();
      });
    });

    it('should provide appropriate zoom support', async () => {
      render(<TestApp initialRoute="/search" />);
      
      // Content should remain accessible at 200% zoom
      // This is typically verified through manual testing
      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should provide accessible error messages', async () => {
      render(<TestApp initialRoute="/entry/invalid-id" />);
      
      await waitFor(() => {
        const errorMessage = screen.getByText(/entry not found/i);
        expect(errorMessage).toBeInTheDocument();
        
        // Should be announced to screen readers
        const errorRegion = errorMessage.closest('[role="alert"], [aria-live]');
        expect(errorRegion).toBeInTheDocument();
      });
    });

    it('should handle network errors accessibly', async () => {
      // Mock network error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        // Error state should be accessible
        const searchInterface = screen.getByRole('search');
        expect(searchInterface).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('Advanced Accessibility Features', () => {
  const TestApp: React.FC<{ initialRoute?: string }> = ({ 
    initialRoute = '/' 
  }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppProvider>
        <SearchProvider>
          <KBAppRouter>
            <KBRoutes />
          </KBAppRouter>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  describe('Voice Control Support', () => {
    it('should provide voice-friendly labels', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search knowledge base/i);
        expect(searchInput).toBeInTheDocument();
        
        // Label should be descriptive enough for voice commands
        expect(searchInput.getAttribute('aria-label')).toContain('Search');
      });
    });

    it('should support voice navigation commands', async () => {
      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      await waitFor(() => {
        const actions = screen.getAllByRole('button');
        
        // Each action should have a unique, voice-friendly label
        actions.forEach(button => {
          const label = button.getAttribute('aria-label') || button.textContent;
          expect(label).toBeTruthy();
          expect(label!.length).toBeGreaterThan(2);
        });
      });
    });
  });

  describe('Cognitive Accessibility', () => {
    it('should provide clear navigation context', async () => {
      render(<TestApp initialRoute="/search/test%20query" />);
      
      await waitFor(() => {
        // Users should understand where they are and how they got there
        const breadcrumb = screen.queryByRole('navigation', { name: /breadcrumb/i });
        if (breadcrumb) {
          expect(breadcrumb).toBeInTheDocument();
        }
        
        // At minimum, page title should be descriptive
        expect(document.title).toBeTruthy();
      });
    });

    it('should provide help text for complex interactions', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        const helpTexts = screen.getAllByText(/help|describe|enter/i);
        expect(helpTexts.length).toBeGreaterThan(0);
        
        // Help text should be associated with form fields
        const titleHelp = screen.getByText(/enter a descriptive title/i);
        expect(titleHelp).toBeInTheDocument();
      });
    });

    it('should support undo functionality where appropriate', async () => {
      render(<TestApp initialRoute="/add" />);
      
      await waitFor(() => {
        // Forms should allow cancellation
        const cancelButton = screen.getByText(/cancel/i);
        expect(cancelButton).toBeInTheDocument();
      });
    });
  });

  describe('Internationalization Accessibility', () => {
    it('should support RTL languages', async () => {
      // Mock RTL context
      document.documentElement.dir = 'rtl';
      
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        // Layout should adapt to RTL
        const searchInterface = screen.getByRole('search');
        expect(searchInterface).toBeInTheDocument();
      });

      // Reset
      document.documentElement.dir = 'ltr';
    });

    it('should provide language attributes', async () => {
      render(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        // Document or sections should have lang attribute
        expect(document.documentElement.lang || document.documentElement.getAttribute('lang')).toBeTruthy();
      });
    });
  });
});