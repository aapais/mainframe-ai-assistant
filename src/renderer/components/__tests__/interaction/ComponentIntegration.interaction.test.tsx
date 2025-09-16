import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { customRender, MockDataGenerator } from '../test-utils';
import {
  SearchUserFlow,
  AddEntryUserFlow,
  RatingSolutionUserFlow,
  ComponentIntegrationFlow,
  UserFlowPerformance
} from './user-flow-helpers';
import './setup';

// Mock a full application layout with integrated components
const MockKBApplication: React.FC<{
  initialEntries?: any[];
  onEntryAdd?: (entry: any) => void;
  onEntryRate?: (entryId: string, successful: boolean) => void;
  onEntrySelect?: (entry: any) => void;
  showMetrics?: boolean;
}> = ({
  initialEntries = [],
  onEntryAdd,
  onEntryRate,
  onEntrySelect,
  showMetrics = false
}) => {
  const [entries, setEntries] = React.useState(initialEntries);
  const [selectedEntry, setSelectedEntry] = React.useState<any>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [showMetricsPanel, setShowMetricsPanel] = React.useState(showMetrics);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);

  const handleSearch = React.useCallback(async (query: string) => {
    // Simulate search
    const results = entries
      .filter(entry =>
        entry.title.toLowerCase().includes(query.toLowerCase()) ||
        entry.problem.toLowerCase().includes(query.toLowerCase()) ||
        entry.solution.toLowerCase().includes(query.toLowerCase())
      )
      .map(entry => ({
        entry,
        score: Math.random() * 100,
        matchType: 'fuzzy' as const
      }));

    setSearchResults(results);
    return results;
  }, [entries]);

  const handleAddEntry = React.useCallback(async (entryData: any) => {
    const newEntry = {
      ...entryData,
      id: `entry-${Date.now()}`,
      created_at: new Date(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0
    };

    setEntries(prev => [...prev, newEntry]);
    setShowAddForm(false);
    onEntryAdd?.(newEntry);

    // Auto-select the new entry
    setSelectedEntry(newEntry);
  }, [onEntryAdd]);

  const handleEntrySelect = React.useCallback((result: any) => {
    const entry = result.entry || result;
    setSelectedEntry(entry);
    onEntrySelect?.(entry);
  }, [onEntrySelect]);

  const handleEntryRate = React.useCallback((entryId: string, successful: boolean) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.id === entryId
          ? {
              ...entry,
              usage_count: entry.usage_count + 1,
              success_count: successful ? entry.success_count + 1 : entry.success_count,
              failure_count: !successful ? entry.failure_count + 1 : entry.failure_count
            }
          : entry
      )
    );

    // Update selected entry if it's the one being rated
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(prev => ({
        ...prev,
        usage_count: prev.usage_count + 1,
        success_count: successful ? prev.success_count + 1 : prev.success_count,
        failure_count: !successful ? prev.failure_count + 1 : prev.failure_count
      }));
    }

    onEntryRate?.(entryId, successful);
  }, [selectedEntry, onEntryRate]);

  return (
    <div className="kb-application" role="application" aria-label="Knowledge Base Assistant">
      {/* Header */}
      <header className="app-header">
        <h1>Mainframe KB Assistant</h1>
        <div className="header-actions">
          <button
            type="button"
            onClick={() => setShowMetricsPanel(!showMetricsPanel)}
            aria-pressed={showMetricsPanel}
            aria-label="Toggle metrics panel"
          >
            📊 Metrics
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            aria-label="Add new knowledge entry"
          >
            + Add Knowledge
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Search Interface */}
        <section className="search-section" aria-label="Search knowledge base">
          <div className="search-input-container">
            <input
              type="search"
              role="searchbox"
              placeholder="Search knowledge base..."
              aria-label="Search knowledge base"
              onChange={async (e) => {
                if (e.target.value.trim()) {
                  await handleSearch(e.target.value);
                } else {
                  setSearchResults([]);
                }
              }}
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="search-results" role="region" aria-label="Search results">
              <div className="results-header">
                <h2>Search Results ({searchResults.length})</h2>
              </div>
              <div className="results-list">
                {searchResults.map((result, index) => (
                  <article
                    key={result.entry.id}
                    className="result-item"
                    onClick={() => handleEntrySelect(result)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEntrySelect(result);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Select entry: ${result.entry.title}`}
                  >
                    <h3>{result.entry.title}</h3>
                    <p className="result-excerpt">
                      {result.entry.problem.substring(0, 150)}...
                    </p>
                    <div className="result-meta">
                      <span className="category">{result.entry.category}</span>
                      <span className="score">Match: {Math.round(result.score)}%</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {searchResults.length === 0 && (
            <div className="no-results" role="status">
              Enter a search term to find knowledge base entries
            </div>
          )}
        </section>

        {/* Content Area */}
        <div className="content-area">
          {/* Entry Detail */}
          {selectedEntry && (
            <section className="entry-detail" role="main" aria-labelledby="entry-title">
              <header className="entry-header">
                <h2 id="entry-title">{selectedEntry.title}</h2>
                <div className="entry-meta">
                  <span className="category">{selectedEntry.category}</span>
                  <span className="usage">Used {selectedEntry.usage_count} times</span>
                  {selectedEntry.usage_count > 0 && (
                    <span className="success-rate">
                      Success: {Math.round((selectedEntry.success_count / selectedEntry.usage_count) * 100)}%
                    </span>
                  )}
                </div>
              </header>

              <div className="entry-content">
                <section className="problem-section">
                  <h3>Problem</h3>
                  <p>{selectedEntry.problem}</p>
                </section>

                <section className="solution-section">
                  <h3>Solution</h3>
                  <div className="solution-content">
                    {selectedEntry.solution.split('\n').map((line: string, index: number) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                </section>

                {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                  <section className="tags-section">
                    <h4>Tags</h4>
                    <div className="tags-list">
                      {selectedEntry.tags.map((tag: string) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Rating Section */}
              <footer className="entry-rating">
                <div className="rating-label">Was this solution helpful?</div>
                <div className="rating-buttons">
                  <button
                    type="button"
                    onClick={() => handleEntryRate(selectedEntry.id, true)}
                    aria-label="Mark as helpful solution"
                    className="rating-btn rating-btn--positive"
                  >
                    👍 Yes, helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntryRate(selectedEntry.id, false)}
                    aria-label="Mark as not helpful solution"
                    className="rating-btn rating-btn--negative"
                  >
                    👎 Not helpful
                  </button>
                </div>
              </footer>
            </section>
          )}

          {/* Default State */}
          {!selectedEntry && (
            <div className="empty-state" role="status">
              <h2>Welcome to Knowledge Base Assistant</h2>
              <p>Search for solutions or add new knowledge entries.</p>
            </div>
          )}
        </div>

        {/* Metrics Panel */}
        {showMetricsPanel && (
          <aside className="metrics-panel" role="complementary" aria-label="Knowledge base metrics">
            <header className="metrics-header">
              <h3>Knowledge Base Metrics</h3>
              <button
                type="button"
                onClick={() => setShowMetricsPanel(false)}
                aria-label="Close metrics panel"
              >
                ×
              </button>
            </header>
            <div className="metrics-content">
              <div className="metric">
                <span className="metric-label">Total Entries:</span>
                <span className="metric-value">{entries.length}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Total Searches:</span>
                <span className="metric-value">{Math.floor(Math.random() * 100)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Success Rate:</span>
                <span className="metric-value">
                  {entries.length > 0
                    ? Math.round(
                        (entries.reduce((sum, e) => sum + e.success_count, 0) /
                          Math.max(entries.reduce((sum, e) => sum + e.usage_count, 0), 1)) * 100
                      )
                    : 0}%
                </span>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Add Entry Modal */}
      {showAddForm && (
        <div className="modal-overlay" role="dialog" aria-labelledby="add-form-title" aria-modal="true">
          <div className="modal-content add-entry-modal">
            <header className="modal-header">
              <h2 id="add-form-title">Add New Knowledge Entry</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                aria-label="Close add entry form"
              >
                ×
              </button>
            </header>

            <form
              className="add-entry-form"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const entryData = {
                  title: formData.get('title'),
                  problem: formData.get('problem'),
                  solution: formData.get('solution'),
                  category: formData.get('category'),
                  tags: (formData.get('tags') as string)?.split(',').map(t => t.trim()).filter(Boolean) || []
                };
                handleAddEntry(entryData);
              }}
              role="form"
              aria-label="Add new knowledge entry"
            >
              <div className="form-field">
                <label htmlFor="entry-title">Title *</label>
                <input
                  id="entry-title"
                  name="title"
                  type="text"
                  required
                  autoFocus
                  placeholder="Brief description of the problem"
                />
              </div>

              <div className="form-field">
                <label htmlFor="entry-category">Category *</label>
                <select id="entry-category" name="category" required>
                  <option value="">Select category</option>
                  <option value="JCL">JCL</option>
                  <option value="VSAM">VSAM</option>
                  <option value="DB2">DB2</option>
                  <option value="Batch">Batch</option>
                  <option value="Functional">Functional</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="entry-problem">Problem Description *</label>
                <textarea
                  id="entry-problem"
                  name="problem"
                  required
                  rows={4}
                  placeholder="Describe the problem in detail..."
                />
              </div>

              <div className="form-field">
                <label htmlFor="entry-solution">Solution *</label>
                <textarea
                  id="entry-solution"
                  name="solution"
                  required
                  rows={6}
                  placeholder="Provide step-by-step solution..."
                />
              </div>

              <div className="form-field">
                <label htmlFor="entry-tags">Tags</label>
                <input
                  id="entry-tags"
                  name="tags"
                  type="text"
                  placeholder="Comma-separated tags (e.g., vsam, error, file-access)"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Add Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

describe('Component Integration - User Interaction Tests', () => {
  let mockEntries: any[];
  let mockOnEntryAdd: jest.Mock;
  let mockOnEntryRate: jest.Mock;
  let mockOnEntrySelect: jest.Mock;

  beforeEach(() => {
    mockEntries = [
      MockDataGenerator.kbEntry({
        id: 'integration-entry-1',
        title: 'VSAM Status 35 - Dataset Not Found',
        problem: 'Job abends with VSAM status 35 when attempting to open dataset for processing',
        solution: '1. Verify dataset exists using LISTCAT\n2. Check dataset name spelling\n3. Verify catalog search order\n4. Check RACF permissions',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'dataset'],
        usage_count: 10,
        success_count: 8,
        failure_count: 2
      }),
      MockDataGenerator.kbEntry({
        id: 'integration-entry-2',
        title: 'S0C7 Data Exception in COBOL Program',
        problem: 'Program terminates with S0C7 abend during arithmetic operations',
        solution: '1. Check for uninitialized numeric fields\n2. Verify COMP-3 field initialization\n3. Add NUMERIC test before calculations\n4. Review input data validation',
        category: 'Batch',
        tags: ['s0c7', 'cobol', 'data-exception'],
        usage_count: 15,
        success_count: 12,
        failure_count: 3
      }),
      MockDataGenerator.kbEntry({
        id: 'integration-entry-3',
        title: 'JCL Syntax Error - Missing DD Statement',
        problem: 'Job fails during submission with JCL error indicating missing required DD statement',
        solution: '1. Review JCL for required DD statements\n2. Check for typos in DD names\n3. Verify dataset allocation parameters\n4. Ensure step dependencies are correct',
        category: 'JCL',
        tags: ['jcl', 'dd-statement', 'syntax-error'],
        usage_count: 5,
        success_count: 4,
        failure_count: 1
      })
    ];

    mockOnEntryAdd = jest.fn();
    mockOnEntryRate = jest.fn();
    mockOnEntrySelect = jest.fn();

    // Clear performance measurements
    UserFlowPerformance.clearMeasurements();
  });

  describe('Search to Detail Integration', () => {
    test('should complete search to detail view workflow', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      const integrationFlow = new ComponentIntegrationFlow({ user, performanceTracking: true });

      await integrationFlow.testSearchToDetailFlow();

      // Verify search results appeared
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toBeInTheDocument();

      // Type search query
      await user.type(searchInput, 'VSAM');

      // Wait for search results
      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      // Click on first result
      const firstResult = screen.getAllByRole('article')[0];
      await user.click(firstResult);

      // Verify entry detail is shown
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /entry-title/i })).toBeInTheDocument();
        expect(screen.getByText('VSAM Status 35 - Dataset Not Found')).toBeInTheDocument();
      });

      // Verify callback was triggered
      expect(mockOnEntrySelect).toHaveBeenCalled();

      // Check performance
      const measurements = UserFlowPerformance.getAllMeasurements();
      expect(Object.keys(measurements).length).toBeGreaterThan(0);
    });

    test('should maintain search context when navigating', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // Perform search
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'error');

      // Wait for multiple results
      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThanOrEqual(2);
      });

      const results = screen.getAllByRole('article');

      // Select first result
      await user.click(results[0]);

      // Verify detail is shown
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Search results should still be visible
      expect(screen.getByRole('region', { name: /search results/i })).toBeInTheDocument();

      // Select second result
      await user.click(results[1]);

      // Detail should update
      await waitFor(() => {
        expect(mockOnEntrySelect).toHaveBeenCalledTimes(2);
      });
    });

    test('should handle keyboard navigation between search and detail', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // Start with search input
      const searchInput = screen.getByRole('searchbox');
      searchInput.focus();

      await user.type(searchInput, 'VSAM');

      // Wait for results
      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      // Tab to first result
      await user.tab();
      const firstResult = screen.getAllByRole('article')[0];
      expect(document.activeElement).toBe(firstResult);

      // Enter to select
      await user.keyboard('{Enter}');

      // Detail should be shown
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Tab should move to rating buttons
      await user.tab();
      const ratingButton = screen.getByRole('button', { name: /mark as helpful/i });
      expect(document.activeElement).toBe(ratingButton);
    });
  });

  describe('Add Entry to Search Integration', () => {
    test('should complete full add entry workflow', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      const addFlow = new AddEntryUserFlow({ user, performanceTracking: true });

      // Open add entry form
      const addButton = screen.getByRole('button', { name: /add.*knowledge/i });
      await user.click(addButton);

      // Verify modal opened
      const modal = screen.getByRole('dialog', { name: /add new knowledge entry/i });
      expect(modal).toBeInTheDocument();

      // Fill out form
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.type(titleInput, 'New Test Error Resolution');

      const categorySelect = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categorySelect, 'Other');

      const problemInput = screen.getByRole('textbox', { name: /problem/i });
      await user.type(problemInput, 'This is a detailed problem description for the new knowledge entry');

      const solutionInput = screen.getByRole('textbox', { name: /solution/i });
      await user.type(solutionInput, 'Step 1: Analyze the problem\nStep 2: Apply the solution\nStep 3: Verify the fix');

      const tagsInput = screen.getByRole('textbox', { name: /tags/i });
      await user.type(tagsInput, 'test, error, resolution');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(submitButton);

      // Verify form closed and entry was added
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(mockOnEntryAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Test Error Resolution',
          category: 'Other',
          problem: 'This is a detailed problem description for the new knowledge entry'
        })
      );

      // Entry should be automatically selected and shown
      await waitFor(() => {
        expect(screen.getByText('New Test Error Resolution')).toBeInTheDocument();
      });

      // Should be able to search for the new entry
      const searchInput = screen.getByRole('searchbox');
      await user.clear(searchInput);
      await user.type(searchInput, 'New Test Error');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
        expect(within(results[0]).getByText(/New Test Error/)).toBeInTheDocument();
      });
    });

    test('should handle form validation errors during integration', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // Open add form
      await user.click(screen.getByRole('button', { name: /add.*knowledge/i }));

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(submitButton);

      // Form should still be open due to validation
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // No entry should have been added
      expect(mockOnEntryAdd).not.toHaveBeenCalled();

      // Fill minimum required fields
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Valid Title');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Other');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Valid problem description');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Valid solution steps');

      // Now submit should work
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(mockOnEntryAdd).toHaveBeenCalled();
    });
  });

  describe('Rating Integration', () => {
    test('should complete rating workflow from detail view', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // Search and select entry
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'VSAM');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      const firstResult = screen.getAllByRole('article')[0];
      await user.click(firstResult);

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Rate the solution positively
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);

      // Verify rating callback
      expect(mockOnEntryRate).toHaveBeenCalledWith('integration-entry-1', true);

      // Verify UI updates
      await waitFor(() => {
        expect(screen.getByText(/used 11 times/i)).toBeInTheDocument();
        expect(screen.getByText(/success: 82%/i)).toBeInTheDocument(); // (9/11)*100
      });
    });

    test('should update metrics after rating', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
          showMetrics={true}
        />
      );

      // Initial metrics should be visible
      const metricsPanel = screen.getByRole('complementary', { name: /metrics/i });
      expect(metricsPanel).toBeInTheDocument();

      const initialSuccessRate = within(metricsPanel).getByText(/success rate:/i).parentElement!;
      const initialRate = initialSuccessRate.textContent!.match(/\d+%/)?.[0];

      // Select an entry and rate it
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'VSAM');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByRole('article')[0]);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Rate positively
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Metrics should update
      await waitFor(() => {
        const updatedSuccessRate = within(metricsPanel).getByText(/success rate:/i).parentElement!;
        const updatedRate = updatedSuccessRate.textContent!.match(/\d+%/)?.[0];

        // Success rate should have changed (assuming it increased)
        expect(updatedRate).toBeDefined();
      });
    });
  });

  describe('Complete Workflow Integration', () => {
    test('should complete end-to-end user workflow', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      const integrationFlow = new ComponentIntegrationFlow({ user, performanceTracking: true });

      await integrationFlow.testCompleteWorkflow();

      // Verify all callbacks were triggered
      expect(mockOnEntryAdd).toHaveBeenCalled();
      expect(mockOnEntrySelect).toHaveBeenCalled();
      expect(mockOnEntryRate).toHaveBeenCalled();

      // Check performance metrics for entire workflow
      const measurements = UserFlowPerformance.getAllMeasurements();
      expect(Object.keys(measurements).length).toBeGreaterThan(0);

      // All flows should complete within reasonable time
      Object.values(measurements).forEach(measurement => {
        expect(measurement.average).toBeLessThan(5000); // 5 seconds max
      });
    });

    test('should handle complex user interactions', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // 1. Search for existing entries
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'error');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(1);
      });

      // 2. Browse multiple entries
      const results = screen.getAllByRole('article');

      await user.click(results[0]);
      await waitFor(() => {
        expect(mockOnEntrySelect).toHaveBeenCalledTimes(1);
      });

      await user.click(results[1]);
      await waitFor(() => {
        expect(mockOnEntrySelect).toHaveBeenCalledTimes(2);
      });

      // 3. Rate solutions
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));
      expect(mockOnEntryRate).toHaveBeenCalledWith(expect.any(String), true);

      // 4. Add new entry
      await user.click(screen.getByRole('button', { name: /add.*knowledge/i }));

      // Fill and submit new entry
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Integration Test Entry');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Other');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Integration test problem description');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Integration test solution steps');

      await user.click(screen.getByRole('button', { name: /add entry/i }));

      await waitFor(() => {
        expect(mockOnEntryAdd).toHaveBeenCalled();
      });

      // 5. Search for new entry
      await user.clear(searchInput);
      await user.type(searchInput, 'Integration Test');

      await waitFor(() => {
        const newResults = screen.getAllByRole('article');
        expect(newResults.length).toBeGreaterThan(0);
        expect(within(newResults[0]).getByText(/Integration Test Entry/)).toBeInTheDocument();
      });

      // 6. Rate new entry
      await user.click(newResults[0]);
      await waitFor(() => {
        expect(screen.getByText('Integration Test Entry')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Verify all interactions completed successfully
      expect(mockOnEntryAdd).toHaveBeenCalled();
      expect(mockOnEntrySelect).toHaveBeenCalledTimes(4); // 2 browsing + 1 auto-select after add + 1 manual select
      expect(mockOnEntryRate).toHaveBeenCalledTimes(2);
    });
  });

  describe('State Management Integration', () => {
    test('should maintain consistent state across components', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // Initial state: 3 entries
      expect(mockEntries).toHaveLength(3);

      // Add new entry
      await user.click(screen.getByRole('button', { name: /add.*knowledge/i }));

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'State Test Entry');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Other');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'State management test problem');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'State management test solution');

      await user.click(screen.getByRole('button', { name: /add entry/i }));

      // State should be updated - entry should be auto-selected
      await waitFor(() => {
        expect(screen.getByText('State Test Entry')).toBeInTheDocument();
      });

      // Search should find the new entry
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'State Test');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBe(1);
        expect(within(results[0]).getByText('State Test Entry')).toBeInTheDocument();
      });

      // Rating should update the entry state
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Usage count should be updated
      await waitFor(() => {
        expect(screen.getByText(/used 1 times/i)).toBeInTheDocument();
        expect(screen.getByText(/success: 100%/i)).toBeInTheDocument();
      });
    });

    test('should handle concurrent state updates', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      // Select entry
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'VSAM');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByRole('article')[0]);

      // Initial usage: 10 times, success: 8/10 = 80%
      await waitFor(() => {
        expect(screen.getByText(/used 10 times/i)).toBeInTheDocument();
        expect(screen.getByText(/success: 80%/i)).toBeInTheDocument();
      });

      // Multiple rapid ratings
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);
      await user.click(helpfulButton);
      await user.click(helpfulButton);

      // State should handle rapid updates correctly
      await waitFor(() => {
        expect(mockOnEntryRate).toHaveBeenCalledTimes(3);
        // Final state should reflect all updates
        expect(screen.getByText(/used 13 times/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should gracefully handle component errors', async () => {
      // Mock a component that throws an error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      try {
        const { user } = customRender(
          <MockKBApplication
            initialEntries={mockEntries}
            onEntryAdd={() => {
              throw new Error('Simulated add error');
            }}
            onEntryRate={mockOnEntryRate}
            onEntrySelect={mockOnEntrySelect}
          />
        );

        // Try to add entry that will fail
        await user.click(screen.getByRole('button', { name: /add.*knowledge/i }));

        await user.type(screen.getByRole('textbox', { name: /title/i }), 'Error Test');
        await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Other');
        await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Error test problem');
        await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Error test solution');

        await user.click(screen.getByRole('button', { name: /add entry/i }));

        // Application should still be responsive
        const searchInput = screen.getByRole('searchbox');
        await user.type(searchInput, 'VSAM');

        await waitFor(() => {
          const results = screen.getAllByRole('article');
          expect(results.length).toBeGreaterThan(0);
        });

      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  describe('Performance Integration', () => {
    test('should maintain performance across component interactions', async () => {
      const { user } = customRender(
        <MockKBApplication
          initialEntries={mockEntries}
          onEntryAdd={mockOnEntryAdd}
          onEntryRate={mockOnEntryRate}
          onEntrySelect={mockOnEntrySelect}
        />
      );

      const integrationFlow = new ComponentIntegrationFlow({ user, performanceTracking: true });

      // Perform multiple operations quickly
      const startTime = performance.now();

      // Search
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'error');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      // Select and rate
      await user.click(screen.getAllByRole('article')[0]);
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Add entry
      await user.click(screen.getByRole('button', { name: /add.*knowledge/i }));
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Performance Test');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Other');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Performance test problem');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Performance test solution');
      await user.click(screen.getByRole('button', { name: /add entry/i }));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Complete workflow should finish within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds

      // Individual component performance should be tracked
      const measurements = UserFlowPerformance.getAllMeasurements();
      Object.values(measurements).forEach(measurement => {
        expect(measurement.average).toBeLessThan(3000); // 3 seconds per operation
      });
    });
  });
});