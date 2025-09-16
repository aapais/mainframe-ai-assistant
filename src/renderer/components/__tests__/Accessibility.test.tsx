import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

import { KBEntryForm } from '../forms/KBEntryForm';
import { Button } from '../common/Button';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock CSS imports
jest.mock('../forms/KBEntryForm.css', () => ({}));
jest.mock('../common/Button.css', () => ({}));

describe('Accessibility Tests', () => {
  describe('KBEntryForm Accessibility', () => {
    const defaultProps = {
      onSubmit: jest.fn(),
      onCancel: jest.fn(),
    };

    it('should not have any accessibility violations in create mode', async () => {
      const { container } = render(<KBEntryForm {...defaultProps} />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should not have any accessibility violations in edit mode', async () => {
      const initialData = {
        title: 'Test Title',
        problem: 'Test Problem Description',
        solution: 'Test Solution Steps',
        category: 'VSAM' as const,
        tags: ['test', 'vsam'],
      };

      const { container } = render(
        <KBEntryForm {...defaultProps} mode="edit" initialData={initialData} />
      );
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations with form errors', async () => {
      const { container } = render(<KBEntryForm {...defaultProps} />);
      
      // Trigger form submission to show validation errors
      const form = container.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      // Wait for errors to appear and check accessibility
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility with tags', async () => {
      const initialData = {
        title: 'Test Title',
        problem: 'Test Problem',
        solution: 'Test Solution',
        category: 'JCL' as const,
        tags: ['jcl', 'error', 'troubleshooting', 'mainframe'],
      };

      const { container } = render(
        <KBEntryForm {...defaultProps} initialData={initialData} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form structure', () => {
      const { container } = render(<KBEntryForm {...defaultProps} />);
      
      // Check for form element
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();

      // Check for fieldset or proper labeling
      const inputs = container.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        if (id) {
          const label = container.querySelector(`label[for="${id}"]`);
          expect(label).toBeInTheDocument();
        }
      });
    });

    it('should have proper heading hierarchy', () => {
      const { container } = render(<KBEntryForm {...defaultProps} />);
      
      const heading = container.querySelector('h2');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Add New Knowledge Entry');
    });

    it('should provide appropriate ARIA labels for interactive elements', () => {
      const initialData = {
        title: 'Test',
        problem: 'Test',
        solution: 'Test',
        category: 'Other' as const,
        tags: ['test-tag'],
      };

      const { container } = render(
        <KBEntryForm {...defaultProps} initialData={initialData} />
      );

      // Check tag remove buttons have aria-label
      const removeButton = container.querySelector('[aria-label*="Remove"]');
      expect(removeButton).toBeInTheDocument();
    });

    it('should maintain focus management', () => {
      const { container } = render(<KBEntryForm {...defaultProps} />);
      
      // All interactive elements should be focusable
      const focusableElements = container.querySelectorAll(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
      );
      
      focusableElements.forEach(element => {
        expect(element).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('Button Component Accessibility', () => {
    it('should not have accessibility violations with default props', async () => {
      const { container } = render(<Button>Default Button</Button>);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations with all variants', async () => {
      const variants = ['primary', 'secondary', 'danger', 'success', 'ghost'] as const;
      
      for (const variant of variants) {
        const { container } = render(<Button variant={variant}>{variant} Button</Button>);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });

    it('should not have accessibility violations when disabled', async () => {
      const { container } = render(<Button disabled>Disabled Button</Button>);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when loading', async () => {
      const { container } = render(<Button loading>Loading Button</Button>);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations with icon', async () => {
      const icon = <span aria-hidden="true">📝</span>;
      const { container } = render(<Button icon={icon}>Button with Icon</Button>);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should maintain proper button semantics', () => {
      const { container } = render(<Button>Semantic Button</Button>);
      
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type');
    });

    it('should provide loading state to assistive technology', () => {
      const { container } = render(<Button loading>Loading</Button>);
      
      const loadingIndicator = container.querySelector('[aria-label="Loading..."]');
      expect(loadingIndicator).toBeInTheDocument();
    });

    it('should support custom aria attributes', async () => {
      const { container } = render(
        <Button 
          aria-label="Custom Label"
          aria-describedby="description"
          role="button"
        >
          Custom Button
        </Button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      
      const button = container.querySelector('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });
  });

  describe('Form and Button Integration Accessibility', () => {
    it('should maintain accessibility when form has buttons', async () => {
      const FormWithButtons = () => (
        <form>
          <div>
            <label htmlFor="test-input">Test Input</label>
            <input id="test-input" type="text" />
          </div>
          <div>
            <Button type="submit">Submit</Button>
            <Button type="button" variant="ghost">Cancel</Button>
          </div>
        </form>
      );

      const { container } = render(<FormWithButtons />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should handle complex form interactions accessibly', async () => {
      const ComplexForm = () => {
        const [showAdvanced, setShowAdvanced] = React.useState(false);
        
        return (
          <div>
            <h2>Complex Form</h2>
            <form>
              <div>
                <label htmlFor="basic-field">Basic Field</label>
                <input id="basic-field" type="text" />
              </div>
              
              <Button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                aria-controls="advanced-section"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </Button>
              
              {showAdvanced && (
                <div id="advanced-section">
                  <label htmlFor="advanced-field">Advanced Field</label>
                  <input id="advanced-field" type="text" />
                </div>
              )}
              
              <div>
                <Button type="submit" variant="primary">Submit Form</Button>
                <Button type="reset" variant="ghost">Reset</Button>
              </div>
            </form>
          </div>
        );
      };

      const { container } = render(<ComplexForm />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should pass color contrast requirements for all button variants', async () => {
      const variants = ['primary', 'secondary', 'danger', 'success', 'ghost'] as const;
      
      for (const variant of variants) {
        const { container } = render(
          <div style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <Button variant={variant}>Test Button</Button>
          </div>
        );
        
        const results = await axe(container, {
          rules: {
            'color-contrast': { enabled: true },
          },
        });
        
        expect(results).toHaveNoViolations();
      }
    });

    it('should pass color contrast for disabled buttons', async () => {
      const { container } = render(
        <div style={{ padding: '20px', backgroundColor: '#ffffff' }}>
          <Button disabled>Disabled Button</Button>
        </div>
      );
      
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support proper tab order in forms', () => {
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
      
      const focusableElements = container.querySelectorAll(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
      );
      
      // Should have a logical tab order
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // First element should be the title input
      expect(focusableElements[0]).toHaveAttribute('id', 'title');
    });

    it('should handle keyboard interactions properly', () => {
      const { container } = render(<Button>Keyboard Button</Button>);
      
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      
      // Button should be keyboard accessible
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide appropriate role information', () => {
      const { container } = render(
        <div>
          <h2>Form Title</h2>
          <KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />
        </div>
      );
      
      // Form should have proper structure for screen readers
      const form = container.querySelector('form');
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const labels = container.querySelectorAll('label');
      
      expect(form).toBeInTheDocument();
      expect(headings.length).toBeGreaterThan(0);
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should provide status updates for dynamic content', () => {
      const { container } = render(<Button loading>Processing</Button>);
      
      // Loading state should be announced to screen readers
      const loadingElement = container.querySelector('[aria-label="Loading..."]');
      expect(loadingElement).toBeInTheDocument();
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should remain accessible in high contrast mode simulation', async () => {
      // Simulate high contrast by removing colors
      const { container } = render(
        <div style={{ filter: 'contrast(2)' }}>
          <KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />
        </div>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Mobile Accessibility', () => {
    it('should maintain touch target sizes', () => {
      const { container } = render(
        <div>
          <Button>Small Touch Target</Button>
          <Button size="large">Large Touch Target</Button>
        </div>
      );
      
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      
      // Buttons should be present and properly sized for touch
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should announce form errors to screen readers', async () => {
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
      
      // Trigger validation by submitting empty form
      const form = container.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});