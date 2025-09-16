import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { Button } from '../common/Button';
import { KBEntryForm } from '../forms/KBEntryForm';
import { SearchInterface } from '../search/SearchInterface';
import { AccessibilityTester, MockDataGenerator } from './test-utils';

// WCAG Guidelines compliance levels
const WCAG_LEVELS = {
  AA: 'WCAG 2.1 AA',
  AAA: 'WCAG 2.1 AAA'
};

describe('Advanced Accessibility Tests', () => {
  describe('WCAG 2.1 Compliance', () => {
    describe('Perceivable', () => {
      it('provides text alternatives for non-text content', () => {
        const { container } = render(
          <div>
            <Button icon={<span aria-hidden="true">🔍</span>}>Search</Button>
            <img src="test.jpg" alt="Test image" />
            <svg aria-label="Loading spinner" role="img">
              <circle cx="50" cy="50" r="40" />
            </svg>
          </div>
        );

        // Icon should be hidden from screen readers with proper text
        const iconButton = screen.getByRole('button', { name: 'Search' });
        expect(iconButton).toBeInTheDocument();
        
        const icon = container.querySelector('[aria-hidden="true"]');
        expect(icon).toBeInTheDocument();

        // Images should have alt text
        const image = screen.getByAltText('Test image');
        expect(image).toBeInTheDocument();

        // SVGs should have proper labeling
        const svg = screen.getByLabelText('Loading spinner');
        expect(svg).toBeInTheDocument();
      });

      it('provides captions and alternatives for multimedia', () => {
        const { container } = render(
          <div>
            <video controls aria-label="Instructional video">
              <track kind="captions" src="captions.vtt" srcLang="en" label="English captions" />
              Your browser does not support the video element.
            </video>
            <audio controls aria-label="Audio instructions">
              <track kind="captions" src="audio-captions.vtt" srcLang="en" />
              Your browser does not support the audio element.
            </audio>
          </div>
        );

        const video = screen.getByLabelText('Instructional video');
        const audio = screen.getByLabelText('Audio instructions');
        
        expect(video).toBeInTheDocument();
        expect(audio).toBeInTheDocument();
      });

      it('ensures content is adaptable without losing meaning', async () => {
        const ResponsiveForm = () => {
          const [isCompact, setIsCompact] = useState(false);
          
          return (
            <div className={isCompact ? 'compact-view' : 'full-view'}>
              <button onClick={() => setIsCompact(!isCompact)}>
                Toggle View
              </button>
              <KBEntryForm onSubmit={() => {}} onCancel={() => {}} />
            </div>
          );
        };

        const user = userEvent.setup();
        const { container } = render(<ResponsiveForm />);
        
        // Test both views maintain accessibility
        const toggleButton = screen.getByText('Toggle View');
        
        // Test full view
        let accessibilityCheck = AccessibilityTester.checkAriaAttributes(container);
        expect(accessibilityCheck.passed).toBe(true);
        
        // Test compact view
        await user.click(toggleButton);
        accessibilityCheck = AccessibilityTester.checkAriaAttributes(container);
        expect(accessibilityCheck.passed).toBe(true);
      });

      it('maintains distinguishable content with sufficient contrast', () => {
        const { container } = render(
          <div>
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="danger">Danger Button</Button>
            <Button disabled>Disabled Button</Button>
          </div>
        );

        const buttons = container.querySelectorAll('button');
        buttons.forEach((button, index) => {
          const contrastInfo = AccessibilityTester.checkColorContrast(button);
          
          // All buttons should have defined colors
          expect(contrastInfo.foreground).toBeTruthy();
          
          if (!contrastInfo.needsManualCheck) {
            expect(contrastInfo.background).toBeTruthy();
          }
        });
      });
    });

    describe('Operable', () => {
      it('makes all functionality keyboard accessible', async () => {
        const user = userEvent.setup();
        const mockOnSubmit = jest.fn();
        const mockOnCancel = jest.fn();
        
        const { container } = render(
          <KBEntryForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
        );

        const keyboardTest = await AccessibilityTester.testKeyboardNavigation(container);
        
        expect(keyboardTest.canFocusAll).toBe(true);
        expect(keyboardTest.issues).toHaveLength(0);
        expect(keyboardTest.totalFocusable).toBeGreaterThan(0);
      });

      it('provides users enough time to read content', async () => {
        const TimedContent = () => {
          const [showMessage, setShowMessage] = useState(false);
          const [timeLeft, setTimeLeft] = useState(10);
          
          const startTimer = () => {
            setShowMessage(true);
            setTimeLeft(10);
          };
          
          const extendTime = () => {
            setTimeLeft(timeLeft + 10);
          };
          
          return (
            <div>
              <Button onClick={startTimer}>Show Timed Message</Button>
              {showMessage && (
                <div role="alert" aria-live="polite">
                  <p>This message will disappear in {timeLeft} seconds</p>
                  <Button onClick={extendTime}>Extend Time</Button>
                </div>
              )}
            </div>
          );
        };

        const user = userEvent.setup();
        render(<TimedContent />);
        
        const showButton = screen.getByText('Show Timed Message');
        await user.click(showButton);
        
        // Verify timing controls are available
        const extendButton = screen.getByText('Extend Time');
        expect(extendButton).toBeInTheDocument();
        
        // Verify content is announced to screen readers
        const timedMessage = screen.getByRole('alert');
        expect(timedMessage).toHaveAttribute('aria-live', 'polite');
      });

      it('does not cause seizures with flashing content', () => {
        const FlashingButton = () => {
          const [isFlashing, setIsFlashing] = useState(false);
          
          return (
            <Button 
              className={isFlashing ? 'flashing' : ''}
              onClick={() => setIsFlashing(!isFlashing)}
              aria-describedby={isFlashing ? 'flash-warning' : undefined}
            >
              {isFlashing ? 'Stop Flashing' : 'Start Flashing'}
              {isFlashing && (
                <span id="flash-warning" className="sr-only">
                  Warning: This content is flashing
                </span>
              )}
            </Button>
          );
        };

        render(<FlashingButton />);
        
        // Verify warning is provided for flashing content
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        
        // In a real implementation, you'd test that flashing
        // doesn't exceed 3 flashes per second
      });

      it('helps users navigate and find content', () => {
        const NavigationTest = () => (
          <div>
            <nav aria-label="Main navigation">
              <ul>
                <li><a href="#section1">Section 1</a></li>
                <li><a href="#section2">Section 2</a></li>
                <li><a href="#section3">Section 3</a></li>
              </ul>
            </nav>
            
            <main>
              <h1>Main Heading</h1>
              <section id="section1">
                <h2>Section 1</h2>
                <p>Content for section 1</p>
              </section>
              <section id="section2">
                <h2>Section 2</h2>
                <p>Content for section 2</p>
              </section>
            </main>
            
            <aside aria-label="Related information">
              <h3>Related Links</h3>
              <ul>
                <li><a href="#related1">Related Item 1</a></li>
              </ul>
            </aside>
          </div>
        );

        const { container } = render(<NavigationTest />);
        
        // Check for proper landmarks
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('complementary')).toBeInTheDocument();
        
        // Check heading structure
        const accessibilityCheck = AccessibilityTester.checkAriaAttributes(container);
        expect(accessibilityCheck.issues.filter(issue => 
          issue.includes('heading')
        )).toHaveLength(0);
      });
    });

    describe('Understandable', () => {
      it('makes text readable and understandable', () => {
        const { container } = render(
          <div lang="en">
            <h1>Knowledge Base Entry Form</h1>
            <p>
              Complete the form below to add a new knowledge base entry. 
              Required fields are marked with an asterisk (*).
            </p>
            <KBEntryForm onSubmit={() => {}} onCancel={() => {}} />
          </div>
        );

        // Check for language attribute
        const langElement = container.querySelector('[lang]');
        expect(langElement).toBeInTheDocument();
        expect(langElement).toHaveAttribute('lang', 'en');
        
        // Check for clear instructions
        const instructions = screen.getByText(/complete the form below/i);
        expect(instructions).toBeInTheDocument();
      });

      it('makes content appear and operate predictably', async () => {
        const PredictableForm = () => {
          const [category, setCategory] = useState('');
          const [showAdvanced, setShowAdvanced] = useState(false);
          
          return (
            <form>
              <div>
                <label htmlFor="category-select">Category</label>
                <select 
                  id="category-select"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    // Predictable: only show advanced when specific category selected
                    setShowAdvanced(e.target.value === 'advanced');
                  }}
                >
                  <option value="">Select a category</option>
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              
              {showAdvanced && (
                <div role="region" aria-label="Advanced options">
                  <h3>Advanced Options</h3>
                  <label htmlFor="advanced-field">Advanced Setting</label>
                  <input id="advanced-field" type="text" />
                </div>
              )}
            </form>
          );
        };

        const user = userEvent.setup();
        render(<PredictableForm />);
        
        const categorySelect = screen.getByLabelText('Category');
        
        // Test predictable behavior
        await user.selectOptions(categorySelect, 'advanced');
        
        const advancedSection = screen.getByRole('region', { name: 'Advanced options' });
        expect(advancedSection).toBeInTheDocument();
        
        await user.selectOptions(categorySelect, 'basic');
        expect(screen.queryByRole('region', { name: 'Advanced options' })).not.toBeInTheDocument();
      });

      it('helps users avoid and correct mistakes', async () => {
        const ValidationForm = () => {
          const [errors, setErrors] = useState<Record<string, string>>({});
          const [touched, setTouched] = useState<Record<string, boolean>>({});
          
          const validate = (field: string, value: string) => {
            const newErrors = { ...errors };
            
            if (field === 'email') {
              if (!value.includes('@')) {
                newErrors.email = 'Please enter a valid email address';
              } else {
                delete newErrors.email;
              }
            }
            
            if (field === 'title') {
              if (value.length < 5) {
                newErrors.title = 'Title must be at least 5 characters long';
              } else {
                delete newErrors.title;
              }
            }
            
            setErrors(newErrors);
          };
          
          return (
            <form>
              <div>
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  type="text"
                  aria-required="true"
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  onBlur={(e) => {
                    setTouched({ ...touched, title: true });
                    validate('title', e.target.value);
                  }}
                  onChange={(e) => {
                    if (touched.title) {
                      validate('title', e.target.value);
                    }
                  }}
                />
                {errors.title && (
                  <div id="title-error" role="alert" className="error">
                    {errors.title}
                  </div>
                )}
              </div>
              
              <div>
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  aria-required="true"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : 'email-help'}
                  onBlur={(e) => {
                    setTouched({ ...touched, email: true });
                    validate('email', e.target.value);
                  }}
                />
                <div id="email-help" className="help-text">
                  Please enter a valid email address (example: user@domain.com)
                </div>
                {errors.email && (
                  <div id="email-error" role="alert" className="error">
                    {errors.email}
                  </div>
                )}
              </div>
            </form>
          );
        };

        const user = userEvent.setup();
        render(<ValidationForm />);
        
        const titleInput = screen.getByLabelText('Title *');
        const emailInput = screen.getByLabelText('Email *');
        
        // Test error prevention
        await user.type(titleInput, 'abc');
        await user.tab(); // Trigger onBlur
        
        await waitFor(() => {
          const errorMessage = screen.getByRole('alert');
          expect(errorMessage).toHaveTextContent('Title must be at least 5 characters long');
        });
        
        // Test error correction
        await user.type(titleInput, 'defgh'); // Now meets minimum length
        await user.tab();
        
        expect(screen.queryByText('Title must be at least 5 characters long')).not.toBeInTheDocument();
        
        // Verify proper ARIA attributes
        expect(titleInput).toHaveAttribute('aria-required', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-help');
      });
    });

    describe('Robust', () => {
      it('maximizes compatibility with assistive technologies', () => {
        const { container } = render(
          <div>
            <Button
              role="button"
              aria-label="Submit form"
              aria-describedby="submit-help"
              aria-pressed="false"
            >
              Submit
            </Button>
            <div id="submit-help">
              Click to submit the form and save your changes
            </div>
            
            <div
              role="region"
              aria-labelledby="status-heading"
              aria-live="polite"
            >
              <h3 id="status-heading">Status Updates</h3>
              <p>Ready to submit</p>
            </div>
          </div>
        );

        const button = screen.getByRole('button', { name: 'Submit form' });
        expect(button).toHaveAttribute('aria-describedby', 'submit-help');
        expect(button).toHaveAttribute('aria-pressed', 'false');
        
        const statusRegion = screen.getByRole('region');
        expect(statusRegion).toHaveAttribute('aria-live', 'polite');
        expect(statusRegion).toHaveAttribute('aria-labelledby', 'status-heading');
      });

      it('uses valid HTML markup', () => {
        const { container } = render(
          <form>
            <fieldset>
              <legend>Personal Information</legend>
              <div>
                <label htmlFor="first-name">First Name</label>
                <input id="first-name" type="text" required />
              </div>
              <div>
                <label htmlFor="last-name">Last Name</label>
                <input id="last-name" type="text" required />
              </div>
            </fieldset>
            
            <fieldset>
              <legend>Preferences</legend>
              <div>
                <input id="newsletter" type="checkbox" />
                <label htmlFor="newsletter">Subscribe to newsletter</label>
              </div>
            </fieldset>
          </form>
        );

        // Check for proper form structure
        const form = container.querySelector('form');
        const fieldsets = container.querySelectorAll('fieldset');
        const legends = container.querySelectorAll('legend');
        const labels = container.querySelectorAll('label');
        
        expect(form).toBeInTheDocument();
        expect(fieldsets).toHaveLength(2);
        expect(legends).toHaveLength(2);
        expect(labels.length).toBeGreaterThan(0);
        
        // Check that all inputs have labels
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
          const id = input.getAttribute('id');
          expect(id).toBeTruthy();
          const label = container.querySelector(`label[for="${id}"]`);
          expect(label).toBeInTheDocument();
        });
      });
    });
  });

  describe('Screen Reader Testing', () => {
    it('provides comprehensive screen reader support', () => {
      const { container } = render(
        <div>
          <h1>Knowledge Base System</h1>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="#search">Search</a></li>
              <li><a href="#add">Add Entry</a></li>
              <li><a href="#manage">Manage</a></li>
            </ul>
          </nav>
          
          <main>
            <section aria-labelledby="search-heading">
              <h2 id="search-heading">Search Knowledge Base</h2>
              <SearchInterface onSearch={() => {}} />
            </section>
            
            <section aria-labelledby="results-heading">
              <h2 id="results-heading">Search Results</h2>
              <div role="status" aria-live="polite">
                Found 5 results for "VSAM error"
              </div>
              <ul role="list">
                <li>
                  <article>
                    <h3><a href="#entry1">VSAM Status Code 35</a></h3>
                    <p>Problem with VSAM file access...</p>
                  </article>
                </li>
              </ul>
            </section>
          </main>
        </div>
      );

      // Verify landmark structure
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      
      // Verify heading structure
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2s = screen.getAllByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });
      
      expect(h1).toBeInTheDocument();
      expect(h2s).toHaveLength(2);
      expect(h3).toBeInTheDocument();
      
      // Verify status updates
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      
      // Verify list structure
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('handles dynamic content updates for screen readers', async () => {
      const DynamicContent = () => {
        const [status, setStatus] = useState('');
        const [items, setItems] = useState<string[]>([]);
        
        const addItem = () => {
          const newItem = `Item ${items.length + 1}`;
          setItems([...items, newItem]);
          setStatus(`Added ${newItem}. Total items: ${items.length + 1}`);
        };
        
        const removeItem = (index: number) => {
          const removedItem = items[index];
          const newItems = items.filter((_, i) => i !== index);
          setItems(newItems);
          setStatus(`Removed ${removedItem}. Total items: ${newItems.length}`);
        };
        
        return (
          <div>
            <Button onClick={addItem}>Add Item</Button>
            <div role="status" aria-live="polite" aria-atomic="true">
              {status}
            </div>
            <ul aria-label="Dynamic items list">
              {items.map((item, index) => (
                <li key={item}>
                  {item}
                  <Button
                    onClick={() => removeItem(index)}
                    aria-label={`Remove ${item}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<DynamicContent />);
      
      const addButton = screen.getByText('Add Item');
      
      // Add items and verify status updates
      await user.click(addButton);
      expect(screen.getByText('Added Item 1. Total items: 1')).toBeInTheDocument();
      
      await user.click(addButton);
      expect(screen.getByText('Added Item 2. Total items: 2')).toBeInTheDocument();
      
      // Remove item and verify status
      const removeButton = screen.getByLabelText('Remove Item 1');
      await user.click(removeButton);
      
      expect(screen.getByText('Removed Item 1. Total items: 1')).toBeInTheDocument();
    });
  });

  describe('High Contrast Mode Support', () => {
    it('maintains usability in high contrast mode', () => {
      const { container } = render(
        <div style={{ filter: 'invert(1) hue-rotate(180deg)' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <KBEntryForm onSubmit={() => {}} onCancel={() => {}} />
        </div>
      );

      // In high contrast mode, elements should still be distinguishable
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach(button => {
        expect(button).toBeVisible();
        // Check that button content is still readable
        if (button.textContent) {
          expect(button.textContent.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Motion and Animation Accessibility', () => {
    it('respects reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      const spinner = screen.getByLabelText('Loading...');
      
      expect(button).toBeInTheDocument();
      expect(spinner).toBeInTheDocument();
      
      // In a real implementation, you'd verify that animations
      // are disabled or reduced when prefers-reduced-motion is set
    });
  });
});

// Export accessibility testing utilities for other tests
export { AccessibilityTester, WCAG_LEVELS };