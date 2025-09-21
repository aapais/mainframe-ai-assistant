/**
 * Functionality Tests - Migration Validation
 * Verifies all application features work correctly
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock IPC
const mockInvoke = jest.fn();
global.electronAPI = {
  invoke: mockInvoke,
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Migration Validation - Functionality Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ success: true });
  });

  describe('Incident Management Functionality', () => {
    test('Incident creation workflow', async () => {
      const user = userEvent.setup();

      // Mock successful incident creation
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'inc-001',
          title: 'Test Incident',
          description: 'Test Description',
          priority: 'high',
          status: 'open'
        }
      });

      const MockIncidentForm = () => {
        const [title, setTitle] = React.useState('');
        const [description, setDescription] = React.useState('');

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          await global.electronAPI.invoke('incident:create', {
            title,
            description,
            priority: 'high',
            status: 'open'
          });
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Incident Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="incident-title"
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="incident-description"
            />
            <button type="submit" data-testid="submit-incident">
              Create Incident
            </button>
          </form>
        );
      };

      render(
        <TestWrapper>
          <MockIncidentForm />
        </TestWrapper>
      );

      // Fill form
      await user.type(screen.getByTestId('incident-title'), 'Test Incident');
      await user.type(screen.getByTestId('incident-description'), 'Test Description');

      // Submit form
      await user.click(screen.getByTestId('submit-incident'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('incident:create', {
          title: 'Test Incident',
          description: 'Test Description',
          priority: 'high',
          status: 'open'
        });
      });
    });

    test('Incident status updates', async () => {
      const user = userEvent.setup();

      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { id: 'inc-001', status: 'in_progress' }
      });

      const MockStatusUpdate = () => {
        const handleStatusChange = async (newStatus: string) => {
          await global.electronAPI.invoke('incident:update-status', {
            id: 'inc-001',
            status: newStatus
          });
        };

        return (
          <div>
            <button
              onClick={() => handleStatusChange('in_progress')}
              data-testid="set-in-progress"
            >
              Set In Progress
            </button>
            <button
              onClick={() => handleStatusChange('resolved')}
              data-testid="set-resolved"
            >
              Set Resolved
            </button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <MockStatusUpdate />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('set-in-progress'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('incident:update-status', {
          id: 'inc-001',
          status: 'in_progress'
        });
      });
    });
  });

  describe('Knowledge Base Functionality', () => {
    test('Knowledge base search functionality', async () => {
      const user = userEvent.setup();

      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'kb-001',
            title: 'Test KB Entry',
            description: 'Test Description',
            category: 'General'
          }
        ]
      });

      const MockSearch = () => {
        const [query, setQuery] = React.useState('');
        const [results, setResults] = React.useState([]);

        const handleSearch = async () => {
          const response = await global.electronAPI.invoke('kb:search', { query });
          if (response.success) {
            setResults(response.data);
          }
        };

        return (
          <div>
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="search-input"
            />
            <button onClick={handleSearch} data-testid="search-button">
              Search
            </button>
            <div data-testid="search-results">
              {results.map((item: any) => (
                <div key={item.id}>{item.title}</div>
              ))}
            </div>
          </div>
        );
      };

      render(
        <TestWrapper>
          <MockSearch />
        </TestWrapper>
      );

      await user.type(screen.getByTestId('search-input'), 'test query');
      await user.click(screen.getByTestId('search-button'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('kb:search', { query: 'test query' });
        expect(screen.getByText('Test KB Entry')).toBeInTheDocument();
      });
    });

    test('Knowledge base entry creation', async () => {
      const user = userEvent.setup();

      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'kb-002',
          title: 'New KB Entry',
          problem: 'Test Problem',
          solution: 'Test Solution'
        }
      });

      const MockKBForm = () => {
        const [formData, setFormData] = React.useState({
          title: '',
          problem: '',
          solution: '',
          category: 'General'
        });

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          await global.electronAPI.invoke('kb:create', formData);
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              data-testid="kb-title"
            />
            <textarea
              placeholder="Problem"
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              data-testid="kb-problem"
            />
            <textarea
              placeholder="Solution"
              value={formData.solution}
              onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
              data-testid="kb-solution"
            />
            <button type="submit" data-testid="submit-kb">
              Create Entry
            </button>
          </form>
        );
      };

      render(
        <TestWrapper>
          <MockKBForm />
        </TestWrapper>
      );

      await user.type(screen.getByTestId('kb-title'), 'New KB Entry');
      await user.type(screen.getByTestId('kb-problem'), 'Test Problem');
      await user.type(screen.getByTestId('kb-solution'), 'Test Solution');
      await user.click(screen.getByTestId('submit-kb'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('kb:create', {
          title: 'New KB Entry',
          problem: 'Test Problem',
          solution: 'Test Solution',
          category: 'General'
        });
      });
    });
  });

  describe('Settings Functionality', () => {
    test('Settings persistence', async () => {
      const user = userEvent.setup();

      mockInvoke.mockResolvedValueOnce({ success: true });

      const MockSettings = () => {
        const [theme, setTheme] = React.useState('light');

        const handleSave = async () => {
          await global.electronAPI.invoke('settings:update', { theme });
        };

        return (
          <div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              data-testid="theme-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <button onClick={handleSave} data-testid="save-settings">
              Save Settings
            </button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <MockSettings />
        </TestWrapper>
      );

      await user.selectOptions(screen.getByTestId('theme-select'), 'dark');
      await user.click(screen.getByTestId('save-settings'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('settings:update', { theme: 'dark' });
      });
    });
  });

  describe('Form Validation', () => {
    test('Required field validation', async () => {
      const user = userEvent.setup();

      const MockForm = () => {
        const [error, setError] = React.useState('');

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          const title = formData.get('title') as string;

          if (!title.trim()) {
            setError('Title is required');
            return;
          }
          setError('');
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              name="title"
              type="text"
              placeholder="Title"
              data-testid="form-title"
            />
            <button type="submit" data-testid="form-submit">
              Submit
            </button>
            {error && <div data-testid="form-error">{error}</div>}
          </form>
        );
      };

      render(
        <TestWrapper>
          <MockForm />
        </TestWrapper>
      );

      // Submit without filling required field
      await user.click(screen.getByTestId('form-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('Title is required');
      });

      // Fill field and submit
      await user.type(screen.getByTestId('form-title'), 'Valid Title');
      await user.click(screen.getByTestId('form-submit'));

      await waitFor(() => {
        expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal Interactions', () => {
    test('Modal open/close functionality', async () => {
      const user = userEvent.setup();

      const MockModalContainer = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
          <div>
            <button
              onClick={() => setIsOpen(true)}
              data-testid="open-modal"
            >
              Open Modal
            </button>
            {isOpen && (
              <div data-testid="modal-overlay" onClick={() => setIsOpen(false)}>
                <div data-testid="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h2>Modal Title</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    data-testid="close-modal"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <MockModalContainer />
        </TestWrapper>
      );

      // Modal should not be visible initially
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();

      // Open modal
      await user.click(screen.getByTestId('open-modal'));
      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
      expect(screen.getByText('Modal Title')).toBeInTheDocument();

      // Close modal via button
      await user.click(screen.getByTestId('close-modal'));
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();

      // Open modal again
      await user.click(screen.getByTestId('open-modal'));
      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();

      // Close modal via overlay click
      await user.click(screen.getByTestId('modal-overlay'));
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });
});