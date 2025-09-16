import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { Button } from '../common/Button';
import { KBEntryForm } from '../forms/KBEntryForm';
import { SearchInterface } from '../search/SearchInterface';
import { VisualTester, MockDataGenerator } from './test-utils';

// Visual regression testing framework
describe('Visual Regression Tests', () => {
  // Common breakpoints for responsive testing
  const BREAKPOINTS = [320, 768, 1024, 1200, 1920];
  
  // Common viewport sizes
  const VIEWPORTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1200, height: 800 },
    ultrawide: { width: 1920, height: 1080 }
  };

  describe('Button Visual Tests', () => {
    it('captures button variants at different states', () => {
      const variants = ['primary', 'secondary', 'danger', 'success', 'ghost'] as const;
      const states = [
        { name: 'default', props: {} },
        { name: 'disabled', props: { disabled: true } },
        { name: 'loading', props: { loading: true } },
        { name: 'with-icon', props: { icon: <span>📝</span> } }
      ];

      variants.forEach(variant => {
        states.forEach(state => {
          const { container } = render(
            <Button variant={variant} {...state.props}>
              {variant} {state.name}
            </Button>
          );

          const button = container.querySelector('button');
          const metrics = VisualTester.captureElementMetrics(button!);
          
          expect(metrics).toMatchSnapshot(`button-${variant}-${state.name}`);
          expect(metrics.isVisible).toBe(true);
          
          // Button should have consistent dimensions for each variant
          expect(metrics.dimensions.height).toBeGreaterThan(30);
          expect(metrics.dimensions.width).toBeGreaterThan(50);
        });
      });
    });

    it('tests button sizing consistency', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      const measurements: Record<string, any> = {};

      sizes.forEach(size => {
        const { container } = render(<Button size={size}>Test Button</Button>);
        const button = container.querySelector('button');
        measurements[size] = VisualTester.captureElementMetrics(button!);
      });

      // Verify size progression
      expect(measurements.small.dimensions.height)
        .toBeLessThan(measurements.medium.dimensions.height);
      expect(measurements.medium.dimensions.height)
        .toBeLessThan(measurements.large.dimensions.height);

      // Snapshot for visual comparison
      expect(measurements).toMatchSnapshot('button-sizes');
    });

    it('tests button responsive behavior', async () => {
      const { container } = render(
        <div style={{ width: '100%' }}>
          <Button fullWidth>Full Width Button</Button>
          <Button>Regular Button</Button>
        </div>
      );

      const results = await VisualTester.testResponsiveBreakpoints(
        container,
        BREAKPOINTS
      );

      // Full width button should expand to container
      const fullWidthResults = results.map(result => {
        const fullWidthButton = result.elements.find(el => 
          el.selector.includes('button') && el.metrics.dimensions.width > 200
        );
        return {
          breakpoint: result.width,
          width: fullWidthButton?.metrics.dimensions.width || 0
        };
      });

      expect(fullWidthResults).toMatchSnapshot('button-responsive');
    });

    it('tests button focus states', async () => {
      const user = userEvent.setup();
      const { container } = render(<Button>Focus Test</Button>);

      const button = container.querySelector('button')!;
      
      // Capture default state
      const defaultMetrics = VisualTester.captureElementMetrics(button);
      
      // Focus the button
      await user.tab();
      expect(document.activeElement).toBe(button);
      
      // Capture focus state
      const focusMetrics = VisualTester.captureElementMetrics(button);
      
      expect({
        default: defaultMetrics,
        focus: focusMetrics
      }).toMatchSnapshot('button-focus-states');
    });

    it('tests button loading animation consistency', () => {
      const { container } = render(<Button loading>Loading Button</Button>);
      
      const button = container.querySelector('button')!;
      const spinner = container.querySelector('[aria-label="Loading..."]')!;
      
      const buttonMetrics = VisualTester.captureElementMetrics(button);
      const spinnerMetrics = VisualTester.captureElementMetrics(spinner as HTMLElement);
      
      expect({
        button: buttonMetrics,
        spinner: spinnerMetrics
      }).toMatchSnapshot('button-loading-state');
      
      // Spinner should be visible and properly positioned
      expect(spinnerMetrics.isVisible).toBe(true);
    });
  });

  describe('Form Visual Tests', () => {
    const formProps = {
      onSubmit: jest.fn(),
      onCancel: jest.fn()
    };

    it('captures form layout at different screen sizes', async () => {
      const { container } = render(<KBEntryForm {...formProps} />);

      const results = await VisualTester.testResponsiveBreakpoints(
        container,
        BREAKPOINTS
      );

      // Form should maintain usability at all breakpoints
      results.forEach(result => {
        const formElements = result.elements.filter(el => 
          ['input', 'textarea', 'select', 'button'].includes(el.selector)
        );
        
        // All form elements should be visible
        formElements.forEach(element => {
          expect(element.metrics.isVisible).toBe(true);
        });
      });

      expect(results).toMatchSnapshot('form-responsive-layout');
    });

    it('tests form field states and validation', async () => {
      const user = userEvent.setup();
      const { container } = render(<KBEntryForm {...formProps} />);

      // Initial state
      const initialMetrics = VisualTester.captureElementMetrics(container);

      // Fill form with data
      const titleInput = screen.getByLabelText(/title/i);
      const problemTextarea = screen.getByLabelText(/problem/i);
      const solutionTextarea = screen.getByLabelText(/solution/i);

      await user.type(titleInput, 'Test Title');
      await user.type(problemTextarea, 'Test problem description that is long enough to meet validation requirements.');
      await user.type(solutionTextarea, 'Test solution description with detailed steps.');

      // Filled state
      const filledMetrics = VisualTester.captureElementMetrics(container);

      // Trigger validation errors by clearing required fields
      await user.clear(titleInput);
      await user.tab(); // Trigger validation

      // Error state
      const errorMetrics = VisualTester.captureElementMetrics(container);

      expect({
        initial: initialMetrics,
        filled: filledMetrics,
        error: errorMetrics
      }).toMatchSnapshot('form-states');
    });

    it('tests form accessibility visual indicators', () => {
      const { container } = render(<KBEntryForm {...formProps} />);

      // Check for required field indicators
      const requiredIndicators = container.querySelectorAll('[aria-required="true"]');
      expect(requiredIndicators.length).toBeGreaterThan(0);

      // Check for proper labeling visual relationship
      const inputs = container.querySelectorAll('input, textarea, select');
      const labelRelationships = Array.from(inputs).map(input => {
        const id = input.getAttribute('id');
        const label = container.querySelector(`label[for="${id}"]`);
        return {
          inputId: id,
          hasLabel: !!label,
          labelText: label?.textContent
        };
      });

      expect(labelRelationships).toMatchSnapshot('form-accessibility-indicators');
    });

    it('tests form error message positioning', async () => {
      const user = userEvent.setup();
      const { container } = render(<KBEntryForm {...formProps} />);

      // Trigger validation errors
      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      // Capture error message positions
      const errorMessages = container.querySelectorAll('[role="alert"], .error-message');
      const errorPositions = Array.from(errorMessages).map(error => ({
        text: error.textContent,
        metrics: VisualTester.captureElementMetrics(error as HTMLElement)
      }));

      expect(errorPositions).toMatchSnapshot('form-error-positioning');
    });
  });

  describe('Search Interface Visual Tests', () => {
    const searchProps = {
      onSearch: jest.fn(),
      onResultSelect: jest.fn()
    };

    it('tests search layout and result display', () => {
      const mockResults = MockDataGenerator.searchResults(5);
      
      const { container } = render(
        <SearchInterface {...searchProps} results={mockResults} />
      );

      const searchMetrics = VisualTester.captureElementMetrics(container);
      
      // Verify search components are properly laid out
      const searchInput = container.querySelector('[role="textbox"]');
      const searchButton = container.querySelector('[role="button"]');
      const resultsContainer = container.querySelector('[data-testid="search-results"]');

      expect({
        overall: searchMetrics,
        searchInput: searchInput ? VisualTester.captureElementMetrics(searchInput as HTMLElement) : null,
        searchButton: searchButton ? VisualTester.captureElementMetrics(searchButton as HTMLElement) : null,
        results: resultsContainer ? VisualTester.captureElementMetrics(resultsContainer as HTMLElement) : null
      }).toMatchSnapshot('search-interface-layout');
    });

    it('tests search states (empty, loading, results, error)', () => {
      const states = [
        { name: 'empty', props: {} },
        { name: 'loading', props: { isLoading: true } },
        { name: 'with-results', props: { results: MockDataGenerator.searchResults(3) } },
        { name: 'error', props: { error: 'Search failed' } }
      ];

      const stateSnapshots = states.map(state => {
        const { container } = render(<SearchInterface {...searchProps} {...state.props} />);
        return {
          state: state.name,
          metrics: VisualTester.captureElementMetrics(container)
        };
      });

      expect(stateSnapshots).toMatchSnapshot('search-interface-states');
    });

    it('tests search responsiveness', async () => {
      const { container } = render(
        <SearchInterface 
          {...searchProps} 
          results={MockDataGenerator.searchResults(10)} 
        />
      );

      const results = await VisualTester.testResponsiveBreakpoints(
        container,
        BREAKPOINTS
      );

      // Search interface should adapt to different screen sizes
      expect(results).toMatchSnapshot('search-interface-responsive');
    });
  });

  describe('Theme and Color Scheme Tests', () => {
    it('tests light theme consistency', () => {
      const components = [
        <Button key="button">Button</Button>,
        <div key="form"><KBEntryForm onSubmit={() => {}} onCancel={() => {}} /></div>,
        <div key="search"><SearchInterface onSearch={() => {}} /></div>
      ];

      const lightThemeSnapshots = components.map((component, index) => {
        const { container } = render(
          <div className="theme-light" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            {component}
          </div>
        );
        
        return {
          component: `component-${index}`,
          metrics: VisualTester.captureElementMetrics(container)
        };
      });

      expect(lightThemeSnapshots).toMatchSnapshot('light-theme-components');
    });

    it('tests dark theme compatibility', () => {
      const components = [
        <Button key="button">Button</Button>,
        <div key="form"><KBEntryForm onSubmit={() => {}} onCancel={() => {}} /></div>
      ];

      const darkThemeSnapshots = components.map((component, index) => {
        const { container } = render(
          <div className="theme-dark" style={{ padding: '20px', backgroundColor: '#1a1a1a', color: '#ffffff' }}>
            {component}
          </div>
        );
        
        return {
          component: `component-${index}`,
          metrics: VisualTester.captureElementMetrics(container)
        };
      });

      expect(darkThemeSnapshots).toMatchSnapshot('dark-theme-components');
    });

    it('tests high contrast mode', () => {
      const { container } = render(
        <div style={{ filter: 'contrast(2)', padding: '20px' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
        </div>
      );

      const highContrastMetrics = VisualTester.captureElementMetrics(container);
      expect(highContrastMetrics).toMatchSnapshot('high-contrast-mode');
    });
  });

  describe('Animation and Transition Tests', () => {
    it('captures loading animation states', () => {
      // Test button loading animation
      const { container } = render(<Button loading>Loading</Button>);
      
      const spinner = container.querySelector('[aria-label="Loading..."]');
      const spinnerMetrics = VisualTester.captureElementMetrics(spinner as HTMLElement);
      
      expect(spinnerMetrics).toMatchSnapshot('loading-animation');
      expect(spinnerMetrics.isVisible).toBe(true);
    });

    it('tests transition states', async () => {
      const user = userEvent.setup();
      
      const TransitionTest = () => {
        const [visible, setVisible] = React.useState(false);
        return (
          <div>
            <Button onClick={() => setVisible(!visible)}>Toggle</Button>
            <div 
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'all 0.3s ease'
              }}
            >
              Transitioning Element
            </div>
          </div>
        );
      };

      const { container } = render(<TransitionTest />);
      const button = screen.getByText('Toggle');
      
      // Initial state
      const initialState = VisualTester.captureElementMetrics(container);
      
      // Toggle visibility
      await user.click(button);
      
      // After transition
      const afterTransition = VisualTester.captureElementMetrics(container);
      
      expect({
        initial: initialState,
        after: afterTransition
      }).toMatchSnapshot('transition-states');
    });

    it('tests focus ring consistency', async () => {
      const user = userEvent.setup();
      
      const { container } = render(
        <div>
          <Button>Button 1</Button>
          <Button variant="secondary">Button 2</Button>
          <Button variant="danger">Button 3</Button>
        </div>
      );

      const buttons = container.querySelectorAll('button');
      const focusStates = [];

      for (const button of Array.from(buttons)) {
        button.focus();
        focusStates.push({
          variant: button.textContent,
          metrics: VisualTester.captureElementMetrics(button)
        });
      }

      expect(focusStates).toMatchSnapshot('focus-ring-consistency');
    });
  });

  describe('Cross-Browser Visual Consistency', () => {
    it('tests font rendering consistency', () => {
      const { container } = render(
        <div>
          <h1>Heading Level 1</h1>
          <h2>Heading Level 2</h2>
          <p>Regular paragraph text with <strong>bold</strong> and <em>italic</em> text.</p>
          <Button>Button Text</Button>
          <input type="text" placeholder="Input text" />
        </div>
      );

      const textElements = container.querySelectorAll('h1, h2, p, button, input');
      const fontMetrics = Array.from(textElements).map(element => ({
        tag: element.tagName.toLowerCase(),
        content: element.textContent || '',
        metrics: VisualTester.captureElementMetrics(element as HTMLElement)
      }));

      expect(fontMetrics).toMatchSnapshot('font-rendering-consistency');
    });

    it('tests layout consistency across viewport sizes', async () => {
      const { container } = render(
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{ padding: '20px', borderBottom: '1px solid #ccc' }}>
            <h1>Header</h1>
          </header>
          <main style={{ display: 'flex', gap: '20px', padding: '20px' }}>
            <aside style={{ width: '200px' }}>
              <Button fullWidth>Sidebar Button</Button>
            </aside>
            <section style={{ flex: 1 }}>
              <SearchInterface onSearch={() => {}} />
            </section>
          </main>
        </div>
      );

      const results = await VisualTester.testResponsiveBreakpoints(
        container,
        BREAKPOINTS
      );

      // Layout should maintain integrity at all breakpoints
      expect(results).toMatchSnapshot('layout-consistency');
    });
  });

  describe('Component Integration Visual Tests', () => {
    it('tests complex component combinations', () => {
      const ComplexLayout = () => (
        <div style={{ padding: '20px', maxWidth: '800px' }}>
          <header>
            <h1>Knowledge Base Assistant</h1>
            <SearchInterface onSearch={() => {}} />
          </header>
          
          <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <section>
              <h2>Add Entry</h2>
              <KBEntryForm onSubmit={() => {}} onCancel={() => {}} />
            </section>
            
            <section>
              <h2>Quick Actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="danger">Delete Action</Button>
              </div>
            </section>
          </main>
        </div>
      );

      const { container } = render(<ComplexLayout />);
      const layoutMetrics = VisualTester.captureElementMetrics(container);
      
      expect(layoutMetrics).toMatchSnapshot('complex-component-integration');
    });

    it('tests modal and overlay positioning', () => {
      const ModalTest = () => (
        <div>
          {/* Simulate modal backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 1000
            }}
          >
            {/* Modal content */}
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                minWidth: '400px'
              }}
            >
              <h2>Modal Title</h2>
              <p>Modal content</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="ghost">Cancel</Button>
                <Button variant="primary">Confirm</Button>
              </div>
            </div>
          </div>
        </div>
      );

      const { container } = render(<ModalTest />);
      const modalMetrics = VisualTester.captureElementMetrics(container);
      
      expect(modalMetrics).toMatchSnapshot('modal-overlay-positioning');
    });
  });
});

// Visual testing utilities for external use
export const VisualTestingUtils = {
  captureComponentSnapshot: (component: React.ReactElement, testName: string) => {
    const { container } = render(component);
    const metrics = VisualTester.captureElementMetrics(container);
    expect(metrics).toMatchSnapshot(testName);
    return metrics;
  },
  
  testResponsiveComponent: async (component: React.ReactElement, testName: string) => {
    const { container } = render(component);
    const results = await VisualTester.testResponsiveBreakpoints(container, BREAKPOINTS);
    expect(results).toMatchSnapshot(`${testName}-responsive`);
    return results;
  }
};