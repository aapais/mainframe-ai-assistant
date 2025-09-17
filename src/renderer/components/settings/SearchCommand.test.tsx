/**
 * SearchCommand Component Tests
 * Tests for the SearchCommand component functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SearchCommand } from './SearchCommand';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock navigation
const mockNavigate = jest.fn();
const mockOnOpenChange = jest.fn();

describe('SearchCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  const defaultProps = {
    isOpen: true,
    onOpenChange: mockOnOpenChange,
    onNavigate: mockNavigate,
  };

  it('renders the search modal when open', () => {
    render(<SearchCommand {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search settings...')).toBeInTheDocument();
    expect(screen.getByText('to search')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SearchCommand {...defaultProps} isOpen={false} />);

    expect(screen.queryByPlaceholderText('Search settings...')).not.toBeInTheDocument();
  });

  it('shows recent searches when no query is entered', async () => {
    const recentSearches = JSON.stringify([
      { id: '1', query: 'api keys', timestamp: Date.now(), resultPath: '/settings/api/keys' },
      { id: '2', query: 'appearance', timestamp: Date.now() - 1000 }
    ]);
    mockLocalStorage.getItem.mockReturnValue(recentSearches);

    render(<SearchCommand {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
      expect(screen.getByText('api keys')).toBeInTheDocument();
      expect(screen.getByText('appearance')).toBeInTheDocument();
    });
  });

  it('performs search and shows results', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'api');

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument();
      expect(screen.getByText('Anthropic Configuration')).toBeInTheDocument();
    });
  });

  it('groups results by category', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'settings');

    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('API')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });
  });

  it('navigates to selected result', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'api keys');

    await waitFor(() => {
      const apiKeysResult = screen.getByText('API Keys');
      expect(apiKeysResult).toBeInTheDocument();
    });

    const apiKeysButton = screen.getByRole('button', { name: /API Keys/ });
    await user.click(apiKeysButton);

    expect(mockNavigate).toHaveBeenCalledWith('/settings/api/keys');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows no results message for invalid search', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'nonexistent setting');

    await waitFor(() => {
      expect(screen.getByText('No settings found for "nonexistent setting"')).toBeInTheDocument();
      expect(screen.getByText('Try a different search term')).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'api');

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Test arrow down navigation
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('closes modal on escape key', () => {
    render(<SearchCommand {...defaultProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('clears recent searches', async () => {
    const user = userEvent.setup();
    const recentSearches = JSON.stringify([
      { id: '1', query: 'api keys', timestamp: Date.now() }
    ]);
    mockLocalStorage.getItem.mockReturnValue(recentSearches);

    render(<SearchCommand {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'settings-search-recent',
      JSON.stringify([])
    );
  });

  it('handles recent search click', async () => {
    const user = userEvent.setup();
    const recentSearches = JSON.stringify([
      { id: '1', query: 'api keys', timestamp: Date.now(), resultPath: '/settings/api/keys' }
    ]);
    mockLocalStorage.getItem.mockReturnValue(recentSearches);

    render(<SearchCommand {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('api keys')).toBeInTheDocument();
    });

    const recentSearchButton = screen.getByRole('button', { name: /api keys/ });
    await user.click(recentSearchButton);

    expect(mockNavigate).toHaveBeenCalledWith('/settings/api/keys');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('displays result badges correctly', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'api keys');

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument();
    });
  });

  it('shows correct platform-specific shortcuts', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

    // Test Mac
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    render(<SearchCommand {...defaultProps} />);
    expect(screen.getByText('K')).toBeInTheDocument();

    // Test Windows
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });

    // Clean up
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform);
    }
  });

  it('saves search to recent searches on navigation', async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search settings...');
    await user.type(searchInput, 'profile');

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    });

    const profileButton = screen.getByRole('button', { name: /Profile Settings/ });
    await user.click(profileButton);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'settings-search-recent',
      expect.stringContaining('profile')
    );
  });

  it('focuses search input when modal opens', async () => {
    const { rerender } = render(<SearchCommand {...defaultProps} isOpen={false} />);

    rerender(<SearchCommand {...defaultProps} isOpen={true} />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search settings...');
      expect(searchInput).toHaveFocus();
    });
  });
});

// Integration test for global keyboard shortcut
describe('SearchCommand Global Shortcut', () => {
  it('responds to global keyboard shortcut', () => {
    const mockOnOpenChange = jest.fn();

    render(
      <SearchCommand
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        onNavigate={jest.fn()}
      />
    );

    // Test Cmd+K (Mac)
    fireEvent.keyDown(document, {
      key: 'k',
      metaKey: true,
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(true);
  });

  it('responds to Ctrl+K on Windows', () => {
    const mockOnOpenChange = jest.fn();

    render(
      <SearchCommand
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        onNavigate={jest.fn()}
      />
    );

    // Test Ctrl+K (Windows/Linux)
    fireEvent.keyDown(document, {
      key: 'k',
      ctrlKey: true,
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(true);
  });
});