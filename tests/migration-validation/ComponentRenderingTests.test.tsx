/**
 * Component Rendering Tests - Migration Validation
 * Verifies all migrated components render correctly
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Component imports
import AccentureFooter from '@/renderer/components/AccentureFooter';
import Button from '@/renderer/components/ui/Button';
import Modal from '@/renderer/components/ui/Modal';
import Badge from '@/renderer/components/ui/Badge';
import StatusBadge from '@/renderer/components/incident/StatusBadge';
import KBEntryCard from '@/renderer/components/kb-entry/KBEntryCard';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Migration Validation - Component Rendering', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('Core UI Components', () => {
    test('Button component renders with various variants', () => {
      const { rerender } = render(
        <TestWrapper>
          <Button variant="primary">Primary Button</Button>
        </TestWrapper>
      );
      expect(screen.getByText('Primary Button')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <Button variant="secondary">Secondary Button</Button>
        </TestWrapper>
      );
      expect(screen.getByText('Secondary Button')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <Button variant="outline">Outline Button</Button>
        </TestWrapper>
      );
      expect(screen.getByText('Outline Button')).toBeInTheDocument();
    });

    test('Modal component renders correctly', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} onClose={() => {}}>
            <div>Modal Content</div>
          </Modal>
        </TestWrapper>
      );
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    test('Badge component renders with different variants', () => {
      const { rerender } = render(
        <TestWrapper>
          <Badge variant="success">Success</Badge>
        </TestWrapper>
      );
      expect(screen.getByText('Success')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <Badge variant="warning">Warning</Badge>
        </TestWrapper>
      );
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });
  });

  describe('Incident Management Components', () => {
    test('StatusBadge renders with different statuses', () => {
      const { rerender } = render(
        <TestWrapper>
          <StatusBadge status="open" />
        </TestWrapper>
      );
      expect(screen.getByText('Open')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <StatusBadge status="in_progress" />
        </TestWrapper>
      );
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <StatusBadge status="resolved" />
        </TestWrapper>
      );
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  describe('Knowledge Base Components', () => {
    const mockKBEntry = {
      id: 'test-1',
      title: 'Test KB Entry',
      description: 'Test description',
      problem: 'Test problem',
      solution: 'Test solution',
      category: 'General',
      tags: ['test', 'migration'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      success_rate: 85.5,
      usage_count: 42
    };

    test('KBEntryCard renders with proper data', () => {
      render(
        <TestWrapper>
          <KBEntryCard entry={mockKBEntry} />
        </TestWrapper>
      );

      expect(screen.getByText('Test KB Entry')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });
  });

  describe('Brand Components', () => {
    test('AccentureFooter renders correctly', () => {
      render(
        <TestWrapper>
          <AccentureFooter />
        </TestWrapper>
      );
      expect(screen.getByText(/© 2024 Accenture/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design Validation', () => {
    test('Components adapt to different screen sizes', () => {
      // Mock window.innerWidth for responsive testing
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <TestWrapper>
          <Button variant="primary">Responsive Button</Button>
        </TestWrapper>
      );

      const button = screen.getByText('Responsive Button');
      expect(button).toBeInTheDocument();

      // Test mobile breakpoint
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
      });
      window.dispatchEvent(new Event('resize'));

      expect(button).toBeInTheDocument();
    });
  });

  describe('Accessibility Validation', () => {
    test('Components have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <Button variant="primary" aria-label="Primary action button">
            Click me
          </Button>
        </TestWrapper>
      );

      const button = screen.getByLabelText('Primary action button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Primary action button');
    });

    test('Modal has proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} onClose={() => {}} aria-label="Test modal">
            <div>Accessible Modal Content</div>
          </Modal>
        </TestWrapper>
      );

      const modal = screen.getByLabelText('Test modal');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('Performance Validation', () => {
    test('Components render within performance budget', async () => {
      const startTime = performance.now();

      render(
        <TestWrapper>
          <div>
            {Array.from({ length: 50 }, (_, i) => (
              <Button key={i} variant="primary">
                Button {i}
              </Button>
            ))}
          </div>
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render 50 buttons in under 100ms
      expect(renderTime).toBeLessThan(100);
    });
  });
});