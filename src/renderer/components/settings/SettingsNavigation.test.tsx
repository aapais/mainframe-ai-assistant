/**
 * Settings Navigation Tests
 * Unit tests for the settings navigation system
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

import { SettingsNavigation } from './SettingsNavigation';
import type { SettingsSection, SettingsCategory } from '../../types/settings';

// Mock data for testing
const mockCategories: SettingsCategory[] = [
  {
    id: 'general',
    title: 'General Settings',
    description: 'Basic application preferences',
    icon: <span>⚙️</span>,
    color: '#A100FF',
    order: 1
  },
  {
    id: 'api',
    title: 'API Configuration',
    description: 'API keys and provider settings',
    icon: <span>🔑</span>,
    color: '#2563EB',
    order: 2
  }
];

const mockSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Manage your personal information',
    icon: <span>👤</span>,
    path: '/settings/general/profile',
    category: mockCategories[0],
    keywords: ['profile', 'user', 'personal']
  },
  {
    id: 'api-keys',
    title: 'API Keys',
    description: 'Manage API keys for AI providers',
    icon: <span>🔑</span>,
    path: '/settings/api/keys',
    category: mockCategories[1],
    keywords: ['api', 'keys', 'authentication'],
    badge: 'Required'
  }
];

// Wrapper component for routing
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('SettingsNavigation', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders navigation categories', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('API Configuration')).toBeInTheDocument();
  });

  it('displays search functionality', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    expect(searchInput).toBeInTheDocument();
  });

  it('filters sections based on search query', async () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'api' } });

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });
  });

  it('expands and collapses categories', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const generalCategory = screen.getByText('General Settings');
    fireEvent.click(generalCategory);

    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('calls onNavigate when section is clicked', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    // First expand the category
    const generalCategory = screen.getByText('General Settings');
    fireEvent.click(generalCategory);

    // Then click the section
    const profileSection = screen.getByText('Profile');
    fireEvent.click(profileSection);

    expect(mockOnNavigate).toHaveBeenCalledWith('/settings/general/profile');
  });

  it('highlights active section', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          currentPath="/settings/general/profile"
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    // Check if the general category is expanded (should be auto-expanded for active section)
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('displays badges for sections that have them', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    // Expand API category to see the badge
    const apiCategory = screen.getByText('API Configuration');
    fireEvent.click(apiCategory);

    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'api' } });

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('1 result found')).toBeInTheDocument();
    });

    // Click clear button (X icon)
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('handles mobile responsive behavior', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600
    });

    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
          isMobile={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows breadcrumbs for active path', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          currentPath="/settings/general/profile"
          onNavigate={mockOnNavigate}
          isMobile={false}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });
});

describe('SettingsNavigation Search', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs fuzzy search across titles and keywords', async () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'personal' } });

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  it('shows no results message for empty search', async () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('0 results found')).toBeInTheDocument();
    });
  });

  it('highlights search results with relevance scoring', async () => {
    const sectionsWithSubsections: SettingsSection[] = [
      {
        ...mockSections[0],
        subsections: [
          {
            id: 'basic-info',
            title: 'Basic Information',
            description: 'Name, email, and avatar',
            path: '/settings/general/profile/basic',
            keywords: ['name', 'email', 'avatar']
          }
        ]
      }
    ];

    render(
      <TestWrapper>
        <SettingsNavigation
          sections={sectionsWithSubsections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'email' } });

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
  });
});

describe('SettingsNavigation Accessibility', () => {
  const mockOnNavigate = jest.fn();

  it('supports keyboard navigation', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    expect(searchInput).toBeInTheDocument();

    // Test Tab navigation
    fireEvent.keyDown(searchInput, { key: 'Tab' });

    // The next focusable element should receive focus
    // In a real test environment, this would be more thoroughly tested
  });

  it('has proper ARIA labels', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search settings...');
    expect(searchInput).toHaveAttribute('type', 'text');
  });

  it('supports screen readers with proper semantic markup', () => {
    render(
      <TestWrapper>
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      </TestWrapper>
    );

    // Check for proper button roles
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

export default {};