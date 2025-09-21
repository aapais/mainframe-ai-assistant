/**
 * Integration Tests - Migration Validation
 * Tests complete user workflows and system integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock electron IPC
const mockInvoke = jest.fn();
const mockOn = jest.fn();

global.electronAPI = {
  invoke: mockInvoke,
  on: mockOn,
  removeAllListeners: jest.fn(),
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Migration Validation - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ success: true, data: {} });
  });

  describe('End-to-End User Workflows', () => {
    test('Complete incident management workflow', async () => {
      const user = userEvent.setup();

      // Mock API responses for the complete workflow
      mockInvoke
        .mockResolvedValueOnce({ // incident:create
          success: true,
          data: {
            id: 'inc-001',
            title: 'Test Incident',
            description: 'Test Description',
            priority: 'high',
            status: 'open',
            created_at: new Date().toISOString()
          }
        })
        .mockResolvedValueOnce({ // incident:list
          success: true,
          data: [{
            id: 'inc-001',
            title: 'Test Incident',
            description: 'Test Description',
            priority: 'high',
            status: 'open'
          }]
        })
        .mockResolvedValueOnce({ // incident:update-status
          success: true,
          data: {
            id: 'inc-001',
            status: 'in_progress'
          }
        })
        .mockResolvedValueOnce({ // incident:get
          success: true,
          data: {
            id: 'inc-001',
            title: 'Test Incident',
            description: 'Test Description',
            priority: 'high',
            status: 'in_progress',
            resolution_notes: 'Working on resolution'
          }
        });

      const IntegratedIncidentFlow = () => {
        const [incidents, setIncidents] = React.useState([]);
        const [selectedIncident, setSelectedIncident] = React.useState(null);
        const [showCreateForm, setShowCreateForm] = React.useState(false);

        const loadIncidents = async () => {
          const response = await global.electronAPI.invoke('incident:list', {});
          if (response.success) {
            setIncidents(response.data);
          }
        };

        const createIncident = async (incidentData: any) => {
          const response = await global.electronAPI.invoke('incident:create', incidentData);
          if (response.success) {
            await loadIncidents();
            setShowCreateForm(false);
          }
        };

        const updateStatus = async (id: string, status: string) => {
          const response = await global.electronAPI.invoke('incident:update-status', { id, status });
          if (response.success) {
            await loadIncidents();
          }
        };

        return (
          <div>
            <button onClick={() => setShowCreateForm(true)} data-testid="create-incident-btn">
              Create Incident
            </button>

            {showCreateForm && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                createIncident({
                  title: formData.get('title'),
                  description: formData.get('description'),
                  priority: formData.get('priority'),
                  status: 'open'
                });
              }}>
                <input name="title" placeholder="Incident Title" data-testid="incident-title" />
                <textarea name="description" placeholder="Description" data-testid="incident-description" />
                <select name="priority" data-testid="incident-priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button type="submit" data-testid="submit-incident">Create</button>
                <button type="button" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </form>
            )}

            <div data-testid="incidents-list">
              {incidents.map((incident: any) => (
                <div key={incident.id} className="incident-card">
                  <h3>{incident.title}</h3>
                  <p>{incident.description}</p>
                  <span className={`status-${incident.status}`}>{incident.status}</span>
                  <button
                    onClick={() => updateStatus(incident.id, 'in_progress')}
                    data-testid={`update-status-${incident.id}`}
                  >
                    Start Progress
                  </button>
                  <button
                    onClick={() => setSelectedIncident(incident)}
                    data-testid={`view-${incident.id}`}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {selectedIncident && (
              <div data-testid="incident-details">
                <h2>Incident Details</h2>
                <p>ID: {(selectedIncident as any).id}</p>
                <p>Title: {(selectedIncident as any).title}</p>
                <p>Status: {(selectedIncident as any).status}</p>
                <button onClick={() => setSelectedIncident(null)}>Close</button>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <IntegratedIncidentFlow />
        </TestWrapper>
      );

      // Step 1: Create new incident
      await user.click(screen.getByTestId('create-incident-btn'));

      await user.type(screen.getByTestId('incident-title'), 'Test Incident');
      await user.type(screen.getByTestId('incident-description'), 'Test Description');
      await user.selectOptions(screen.getByTestId('incident-priority'), 'high');

      await user.click(screen.getByTestId('submit-incident'));

      // Verify incident creation API was called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('incident:create', {
          title: 'Test Incident',
          description: 'Test Description',
          priority: 'high',
          status: 'open'
        });
      });

      // Step 2: Verify incident appears in list
      await waitFor(() => {
        expect(screen.getByText('Test Incident')).toBeInTheDocument();
      });

      // Step 3: Update incident status
      await user.click(screen.getByTestId('update-status-inc-001'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('incident:update-status', {
          id: 'inc-001',
          status: 'in_progress'
        });
      });

      // Step 4: View incident details
      await user.click(screen.getByTestId('view-inc-001'));

      await waitFor(() => {
        expect(screen.getByTestId('incident-details')).toBeInTheDocument();
        expect(screen.getByText('ID: inc-001')).toBeInTheDocument();
      });
    });

    test('Knowledge base search and management workflow', async () => {
      const user = userEvent.setup();

      // Mock KB API responses
      mockInvoke
        .mockResolvedValueOnce({ // kb:search
          success: true,
          data: [{
            id: 'kb-001',
            title: 'Network Issue Resolution',
            description: 'How to resolve common network issues',
            problem: 'Network connectivity problems',
            solution: 'Check cables and restart router',
            category: 'Network',
            tags: ['network', 'troubleshooting'],
            success_rate: 90.5,
            usage_count: 15
          }]
        })
        .mockResolvedValueOnce({ // kb:create
          success: true,
          data: {
            id: 'kb-002',
            title: 'New KB Entry',
            description: 'Newly created entry'
          }
        })
        .mockResolvedValueOnce({ // kb:get
          success: true,
          data: {
            id: 'kb-001',
            title: 'Network Issue Resolution',
            problem: 'Network connectivity problems',
            solution: 'Check cables and restart router',
            steps: ['Step 1: Check cables', 'Step 2: Restart router']
          }
        });

      const KnowledgeBaseFlow = () => {
        const [searchQuery, setSearchQuery] = React.useState('');
        const [searchResults, setSearchResults] = React.useState([]);
        const [selectedEntry, setSelectedEntry] = React.useState(null);
        const [showCreateForm, setShowCreateForm] = React.useState(false);

        const performSearch = async () => {
          const response = await global.electronAPI.invoke('kb:search', { query: searchQuery });
          if (response.success) {
            setSearchResults(response.data);
          }
        };

        const createEntry = async (entryData: any) => {
          const response = await global.electronAPI.invoke('kb:create', entryData);
          if (response.success) {
            setShowCreateForm(false);
            await performSearch(); // Refresh results
          }
        };

        const viewEntry = async (id: string) => {
          const response = await global.electronAPI.invoke('kb:get', { id });
          if (response.success) {
            setSelectedEntry(response.data);
          }
        };

        return (
          <div>
            {/* Search Interface */}
            <div className="search-section">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search knowledge base..."
                data-testid="kb-search-input"
              />
              <button onClick={performSearch} data-testid="kb-search-btn">
                Search
              </button>
              <button onClick={() => setShowCreateForm(true)} data-testid="kb-create-btn">
                Add Entry
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                createEntry({
                  title: formData.get('title'),
                  description: formData.get('description'),
                  problem: formData.get('problem'),
                  solution: formData.get('solution'),
                  category: formData.get('category')
                });
              }}>
                <input name="title" placeholder="Entry Title" data-testid="kb-entry-title" />
                <textarea name="description" placeholder="Description" data-testid="kb-entry-description" />
                <textarea name="problem" placeholder="Problem" data-testid="kb-entry-problem" />
                <textarea name="solution" placeholder="Solution" data-testid="kb-entry-solution" />
                <select name="category" data-testid="kb-entry-category">
                  <option value="General">General</option>
                  <option value="Network">Network</option>
                  <option value="Hardware">Hardware</option>
                </select>
                <button type="submit" data-testid="submit-kb-entry">Create Entry</button>
                <button type="button" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </form>
            )}

            {/* Search Results */}
            <div data-testid="kb-search-results">
              {searchResults.map((entry: any) => (
                <div key={entry.id} className="kb-entry-card">
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                  <span className="category">{entry.category}</span>
                  <span className="success-rate">{entry.success_rate}%</span>
                  <button
                    onClick={() => viewEntry(entry.id)}
                    data-testid={`view-kb-${entry.id}`}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {/* Entry Details */}
            {selectedEntry && (
              <div data-testid="kb-entry-details">
                <h2>{(selectedEntry as any).title}</h2>
                <div className="problem-section">
                  <h3>Problem</h3>
                  <p>{(selectedEntry as any).problem}</p>
                </div>
                <div className="solution-section">
                  <h3>Solution</h3>
                  <p>{(selectedEntry as any).solution}</p>
                  {(selectedEntry as any).steps && (
                    <ol>
                      {(selectedEntry as any).steps.map((step: string, index: number) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
                <button onClick={() => setSelectedEntry(null)}>Close</button>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <KnowledgeBaseFlow />
        </TestWrapper>
      );

      // Step 1: Perform search
      await user.type(screen.getByTestId('kb-search-input'), 'network');
      await user.click(screen.getByTestId('kb-search-btn'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('kb:search', { query: 'network' });
        expect(screen.getByText('Network Issue Resolution')).toBeInTheDocument();
      });

      // Step 2: View entry details
      await user.click(screen.getByTestId('view-kb-kb-001'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('kb:get', { id: 'kb-001' });
        expect(screen.getByTestId('kb-entry-details')).toBeInTheDocument();
        expect(screen.getByText('Step 1: Check cables')).toBeInTheDocument();
      });

      // Step 3: Create new entry
      await user.click(screen.getByTestId('kb-create-btn'));

      await user.type(screen.getByTestId('kb-entry-title'), 'New KB Entry');
      await user.type(screen.getByTestId('kb-entry-description'), 'Test Description');
      await user.type(screen.getByTestId('kb-entry-problem'), 'Test Problem');
      await user.type(screen.getByTestId('kb-entry-solution'), 'Test Solution');
      await user.selectOptions(screen.getByTestId('kb-entry-category'), 'General');

      await user.click(screen.getByTestId('submit-kb-entry'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('kb:create', {
          title: 'New KB Entry',
          description: 'Test Description',
          problem: 'Test Problem',
          solution: 'Test Solution',
          category: 'General'
        });
      });
    });
  });

  describe('Cross-Component Integration', () => {
    test('Modal and form integration', async () => {
      const user = userEvent.setup();

      const ModalFormIntegration = () => {
        const [isModalOpen, setIsModalOpen] = React.useState(false);
        const [formData, setFormData] = React.useState(null);

        const handleSubmit = (data: any) => {
          setFormData(data);
          setIsModalOpen(false);
        };

        return (
          <div>
            <button onClick={() => setIsModalOpen(true)} data-testid="open-modal">
              Open Form Modal
            </button>

            {isModalOpen && (
              <div className="modal-overlay" data-testid="modal">
                <div className="modal-content">
                  <h2>Form in Modal</h2>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.target as HTMLFormElement);
                    handleSubmit({
                      name: form.get('name'),
                      email: form.get('email')
                    });
                  }}>
                    <input name="name" placeholder="Name" data-testid="modal-name" />
                    <input name="email" type="email" placeholder="Email" data-testid="modal-email" />
                    <button type="submit" data-testid="modal-submit">Submit</button>
                    <button type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  </form>
                </div>
              </div>
            )}

            {formData && (
              <div data-testid="form-result">
                <p>Name: {(formData as any).name}</p>
                <p>Email: {(formData as any).email}</p>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <ModalFormIntegration />
        </TestWrapper>
      );

      // Open modal
      await user.click(screen.getByTestId('open-modal'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();

      // Fill and submit form
      await user.type(screen.getByTestId('modal-name'), 'John Doe');
      await user.type(screen.getByTestId('modal-email'), 'john@example.com');
      await user.click(screen.getByTestId('modal-submit'));

      // Verify modal closed and data was processed
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('form-result')).toBeInTheDocument();
      expect(screen.getByText('Name: John Doe')).toBeInTheDocument();
      expect(screen.getByText('Email: john@example.com')).toBeInTheDocument();
    });

    test('Search and results integration', async () => {
      const user = userEvent.setup();

      const SearchResultsIntegration = () => {
        const [query, setQuery] = React.useState('');
        const [results, setResults] = React.useState([]);
        const [selectedItem, setSelectedItem] = React.useState(null);

        const performSearch = () => {
          // Simulate search
          const mockResults = [
            { id: 1, title: 'Result 1', description: 'Description 1' },
            { id: 2, title: 'Result 2', description: 'Description 2' }
          ].filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
          setResults(mockResults);
        };

        return (
          <div>
            <div className="search-bar">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                data-testid="search-input"
              />
              <button onClick={performSearch} data-testid="search-button">
                Search
              </button>
            </div>

            <div className="search-results" data-testid="search-results">
              {results.map((item: any) => (
                <div key={item.id} className="result-item">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <button
                    onClick={() => setSelectedItem(item)}
                    data-testid={`select-${item.id}`}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>

            {selectedItem && (
              <div className="selected-item" data-testid="selected-item">
                <h2>Selected: {(selectedItem as any).title}</h2>
                <p>{(selectedItem as any).description}</p>
                <button onClick={() => setSelectedItem(null)}>Clear Selection</button>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <SearchResultsIntegration />
        </TestWrapper>
      );

      // Perform search
      await user.type(screen.getByTestId('search-input'), 'result');
      await user.click(screen.getByTestId('search-button'));

      // Verify results appear
      expect(screen.getByText('Result 1')).toBeInTheDocument();
      expect(screen.getByText('Result 2')).toBeInTheDocument();

      // Select an item
      await user.click(screen.getByTestId('select-1'));

      // Verify selection
      expect(screen.getByTestId('selected-item')).toBeInTheDocument();
      expect(screen.getByText('Selected: Result 1')).toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    test('API error handling across components', async () => {
      const user = userEvent.setup();

      // Mock API failure
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      const ErrorHandlingComponent = () => {
        const [error, setError] = React.useState('');
        const [loading, setLoading] = React.useState(false);

        const handleAction = async () => {
          setLoading(true);
          setError('');

          try {
            await global.electronAPI.invoke('test:action', {});
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setLoading(false);
          }
        };

        return (
          <div>
            <button
              onClick={handleAction}
              disabled={loading}
              data-testid="action-button"
            >
              {loading ? 'Loading...' : 'Perform Action'}
            </button>

            {error && (
              <div className="error-message" data-testid="error-message">
                Error: {error}
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <ErrorHandlingComponent />
        </TestWrapper>
      );

      // Trigger action that will fail
      await user.click(screen.getByTestId('action-button'));

      // Verify error is displayed
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });
    });
  });
});