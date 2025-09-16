/**
 * Tests for Custom Accessibility Matchers
 *
 * This test suite verifies that our custom accessibility Jest matchers
 * work correctly and provide meaningful error messages.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '../../../src/renderer/testing/accessibilityTests'; // Import to register matchers

describe('Custom Accessibility Matchers', () => {
  describe('toHaveAccessibleFormStructure', () => {
    it('should pass for properly structured accessible form', () => {
      const AccessibleForm = () => (
        <div>
          <h2>Contact Form</h2>
          <form>
            <div>
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" />
            </div>
            <div>
              <label htmlFor="email">Email Address</label>
              <input id="email" type="email" />
            </div>
            <button type="submit">Submit</button>
          </form>
        </div>
      );

      const { container } = render(<AccessibleForm />);
      expect(container).toHaveAccessibleFormStructure();
    });

    it('should fail for form without proper labeling', () => {
      const InaccessibleForm = () => (
        <form>
          <input type="text" placeholder="Name" />
          <input type="email" placeholder="Email" />
          <button type="submit">Submit</button>
        </form>
      );

      const { container } = render(<InaccessibleForm />);
      expect(() => {
        expect(container).toHaveAccessibleFormStructure();
      }).toThrow();
    });

    it('should fail for form without heading structure', () => {
      const FormWithoutHeading = () => (
        <form>
          <label htmlFor="test">Test</label>
          <input id="test" type="text" />
        </form>
      );

      const { container } = render(<FormWithoutHeading />);
      expect(() => {
        expect(container).toHaveAccessibleFormStructure();
      }).toThrow();
    });

    it('should pass for form with ARIA labeling', () => {
      const AriaForm = () => (
        <div>
          <h2>ARIA Labeled Form</h2>
          <form>
            <input aria-label="Search query" type="text" />
            <input aria-labelledby="email-label" type="email" />
            <span id="email-label">Email Address</span>
            <button type="submit">Search</button>
          </form>
        </div>
      );

      const { container } = render(<AriaForm />);
      expect(container).toHaveAccessibleFormStructure();
    });
  });

  describe('toHaveAccessibleNameCustom', () => {
    it('should pass when element has accessible name', () => {
      const LabeledButton = () => (
        <button aria-label="Close dialog">×</button>
      );

      const { container } = render(<LabeledButton />);
      const button = container.querySelector('button')!;
      expect(button).toHaveAccessibleNameCustom();
    });

    it('should pass when element has expected accessible name', () => {
      const LabeledButton = () => (
        <button aria-label="Save changes">Save</button>
      );

      const { container } = render(<LabeledButton />);
      const button = container.querySelector('button')!;
      expect(button).toHaveAccessibleNameCustom('Save changes');
    });

    it('should pass when element matches accessible name pattern', () => {
      const LabeledButton = () => (
        <button aria-label="Delete item #123">Delete</button>
      );

      const { container } = render(<LabeledButton />);
      const button = container.querySelector('button')!;
      expect(button).toHaveAccessibleNameCustom(/Delete item #\d+/);
    });

    it('should fail when element has no accessible name', () => {
      const UnlabeledButton = () => <button></button>;

      const { container } = render(<UnlabeledButton />);
      const button = container.querySelector('button')!;
      expect(() => {
        expect(button).toHaveAccessibleNameCustom();
      }).toThrow();
    });

    it('should work with form labels', () => {
      const LabeledInput = () => (
        <div>
          <label htmlFor="username">Username</label>
          <input id="username" type="text" />
        </div>
      );

      const { container } = render(<LabeledInput />);
      const input = container.querySelector('input')!;
      expect(input).toHaveAccessibleNameCustom('Username');
    });

    it('should use built-in toHaveAccessibleName for standard cases', () => {
      // This test shows that we can use the standard @testing-library/jest-dom matcher
      const LabeledButton = () => (
        <button aria-label="Standard test">Click me</button>
      );

      const { container } = render(<LabeledButton />);
      const button = container.querySelector('button')!;

      // This should work with the built-in matcher from @testing-library/jest-dom
      expect(button).toHaveAccessibleName('Standard test');
    });
  });

  describe('toBeInLoadingState', () => {
    it('should pass for element with loading spinner', () => {
      const LoadingComponent = () => (
        <div>
          <div aria-label="Loading..." className="spinner"></div>
          <p>Please wait...</p>
        </div>
      );

      const { container } = render(<LoadingComponent />);
      expect(container).toBeInLoadingState();
    });

    it('should pass for disabled submit button', () => {
      const LoadingForm = () => (
        <form>
          <input type="text" />
          <button type="submit" disabled>
            Submit
          </button>
        </form>
      );

      const { container } = render(<LoadingForm />);
      expect(container).toBeInLoadingState();
    });

    it('should pass for button with loading text', () => {
      const LoadingButton = () => (
        <button type="submit" disabled>
          Saving...
        </button>
      );

      const { container } = render(<LoadingButton />);
      expect(container).toBeInLoadingState();
    });

    it('should pass for aria-live region with loading state', () => {
      const LiveRegionLoading = () => (
        <div>
          <div aria-live="polite" aria-busy="true">
            Loading content...
          </div>
        </div>
      );

      const { container } = render(<LiveRegionLoading />);
      expect(container).toBeInLoadingState();
    });

    it('should fail for element not in loading state', () => {
      const NormalComponent = () => (
        <div>
          <p>Normal content</p>
          <button>Click me</button>
        </div>
      );

      const { container } = render(<NormalComponent />);
      expect(() => {
        expect(container).toBeInLoadingState();
      }).toThrow();
    });

    it('should pass for loading button with data attribute', () => {
      const DataLoadingButton = () => (
        <button data-loading="true" disabled>
          Processing...
        </button>
      );

      const { container } = render(<DataLoadingButton />);
      expect(container).toBeInLoadingState();
    });
  });

  describe('Matcher error messages', () => {
    it('should provide helpful error message for toHaveAccessibleFormStructure', () => {
      const BadForm = () => (
        <form>
          <input type="text" />
        </form>
      );

      const { container } = render(<BadForm />);

      try {
        expect(container).toHaveAccessibleFormStructure();
      } catch (error) {
        expect(error.message).toContain('Expected form to have accessible structure');
        expect(error.message).toContain('no heading structure');
        expect(error.message).toContain('inputs lack accessible names');
      }
    });

    it('should provide helpful error message for toHaveAccessibleNameCustom', () => {
      const UnlabeledElement = () => <button></button>;

      const { container } = render(<UnlabeledElement />);
      const button = container.querySelector('button')!;

      try {
        expect(button).toHaveAccessibleNameCustom('Expected Name');
      } catch (error) {
        expect(error.message).toContain('Expected element to have accessible name "Expected Name"');
        expect(error.message).toContain('but found:');
      }
    });

    it('should provide helpful error message for toBeInLoadingState', () => {
      const NormalElement = () => <div>Normal content</div>;

      const { container } = render(<NormalElement />);

      try {
        expect(container).toBeInLoadingState();
      } catch (error) {
        expect(error.message).toContain('Expected element to be in loading state');
        expect(error.message).toContain('loading spinner');
        expect(error.message).toContain('disabled submit button');
      }
    });
  });

  describe('Integration with existing framework', () => {
    it('should work alongside jest-axe matchers', async () => {
      const { axe, toHaveNoViolations } = require('jest-axe');
      expect.extend({ toHaveNoViolations });

      const AccessibleComponent = () => (
        <div>
          <h1>Test Page</h1>
          <form>
            <label htmlFor="test-input">Test Input</label>
            <input id="test-input" type="text" />
            <button type="submit">Submit</button>
          </form>
        </div>
      );

      const { container } = render(<AccessibleComponent />);

      // Test both our custom matcher and axe
      expect(container).toHaveAccessibleFormStructure();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should work with @testing-library/jest-dom matchers', () => {
      const TestComponent = () => (
        <div>
          <h2>Form Title</h2>
          <form>
            <label htmlFor="visible-input">Visible Input</label>
            <input id="visible-input" type="text" />
            <button type="submit">Submit</button>
          </form>
        </div>
      );

      const { container } = render(<TestComponent />);
      const input = container.querySelector('input')!;

      // Test both our custom matcher and jest-dom matchers
      expect(input).toBeInTheDocument();
      expect(input).toHaveAccessibleName('Visible Input'); // Built-in from jest-dom
      expect(input).toHaveAccessibleNameCustom('Visible Input'); // Our custom implementation
      expect(container).toHaveAccessibleFormStructure();
    });
  });
});