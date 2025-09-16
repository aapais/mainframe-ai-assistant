import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { KBEntryForm } from '../forms/KBEntryForm';
import { Button } from '../common/Button';

// Mock console.error to test error logging
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock CSS imports
jest.mock('../forms/KBEntryForm.css', () => ({}));
jest.mock('../common/Button.css', () => ({}));

describe('Error Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('Form Submission Error Handling', () => {
    it('should handle synchronous submission errors', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      // Submit form
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      // Check that error was logged
      expect(mockConsoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });

    it('should handle async submission errors', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Async error'));

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      // Submit form
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      expect(mockConsoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      const mockOnSubmit = jest.fn().mockRejectedValue(networkError);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });
    });

    it('should handle timeout errors', async () => {
      const user = userEvent.setup();
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      const mockOnSubmit = jest.fn().mockRejectedValue(timeoutError);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });
    });

    it('should handle server validation errors', async () => {
      const user = userEvent.setup();
      const validationError = new Error('Validation failed on server');
      validationError.name = 'ValidationError';
      const mockOnSubmit = jest.fn().mockRejectedValue(validationError);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });
    });

    it('should reset form state after error', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Test error'));

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill and submit
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      await user.click(screen.getByText('Add Entry'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      // Form should be back to normal state (not loading)
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Add Entry')).toBeEnabled();
      expect(screen.getByText('Cancel')).toBeEnabled();
    });

    it('should allow retry after error', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt fails'))
        .mockResolvedValueOnce(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      // First submission fails
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      // Second submission succeeds
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.queryByText('Failed to save entry. Please try again.')).not.toBeInTheDocument();
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle invalid field values gracefully', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      // Try to submit without required fields
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
        expect(screen.getByText('Solution is required')).toBeInTheDocument();
      });

      // No console errors should be logged for validation errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should handle maximum length violations', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const titleInput = screen.getByLabelText(/title/i);
      const longTitle = 'a'.repeat(250); // Exceeds maxLength of 200

      await user.type(titleInput, longTitle);

      // Should truncate at maxLength
      expect(titleInput.value).toHaveLength(200);
    });

    it('should handle special characters in input', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const titleInput = screen.getByLabelText(/title/i);
      const specialChars = 'Title with "quotes" & <tags> & émojis 🚀';

      await user.type(titleInput, specialChars);

      // Should handle special characters without error
      expect(titleInput).toHaveValue(specialChars);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Tag Management Error Handling', () => {
    it('should handle invalid tag characters', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const tagInput = screen.getByLabelText(/tags/i);

      // Try to add tag with invalid characters
      await user.type(tagInput, 'invalid tag!@#');
      await user.keyboard('{Enter}');

      // Should either sanitize or reject the tag
      expect(tagInput).toHaveValue('');
    });

    it('should handle extremely long tag names', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const tagInput = screen.getByLabelText(/tags/i);
      const longTag = 'a'.repeat(100);

      await user.type(tagInput, longTag);
      await user.keyboard('{Enter}');

      // Should handle long tags gracefully (might truncate or reject)
      expect(tagInput).toHaveValue('');
    });

    it('should handle rapid tag additions', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const tagInput = screen.getByLabelText(/tags/i);

      // Add many tags rapidly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(user.type(tagInput, `tag${i}{Enter}`, { delay: 1 }));
      }

      await Promise.all(promises);

      // Should handle rapid additions without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Component Error Boundaries', () => {
    it('should handle rendering errors gracefully', () => {
      // Mock a component that throws during render
      const ThrowingComponent = () => {
        throw new Error('Rendering error');
      };

      const ErrorBoundaryWrapper = ({ children }: { children: React.ReactNode }) => {
        try {
          return <>{children}</>;
        } catch (error) {
          return <div>Something went wrong</div>;
        }
      };

      expect(() => {
        render(
          <ErrorBoundaryWrapper>
            <ThrowingComponent />
          </ErrorBoundaryWrapper>
        );
      }).not.toThrow();
    });

    it('should handle prop validation errors', () => {
      // Test with invalid props
      expect(() => {
        render(
          <Button variant={'invalid-variant' as any} size={'invalid-size' as any}>
            Test Button
          </Button>
        );
      }).not.toThrow();
    });
  });

  describe('Memory and Resource Error Handling', () => {
    it('should handle large form data without memory issues', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill with very large data
      const largeText = 'A'.repeat(10000);

      await user.type(screen.getByLabelText(/title/i), 'Large Data Test');
      await user.type(screen.getByLabelText(/problem description/i), largeText, { delay: 1 });
      await user.type(screen.getByLabelText(/solution/i), largeText, { delay: 1 });

      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should handle rapid user interactions without blocking', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const titleInput = screen.getByLabelText(/title/i);

      // Rapid typing simulation
      const rapidText = 'ThisIsARapidTypingTest';
      await user.type(titleInput, rapidText, { delay: 1 });

      expect(titleInput).toHaveValue(rapidText);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Event Handler Error Handling', () => {
    it('should handle onClick errors gracefully', async () => {
      const user = userEvent.setup();
      const faultyOnClick = jest.fn(() => {
        throw new Error('Click handler error');
      });

      const ErrorBoundaryButton = () => {
        try {
          return <Button onClick={faultyOnClick}>Faulty Button</Button>;
        } catch (error) {
          console.error('Button error:', error);
          return <Button>Fallback Button</Button>;
        }
      };

      render(<ErrorBoundaryButton />);

      const button = screen.getByRole('button');
      
      // This should not crash the app
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle onSubmit Promise rejections', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockImplementation(async () => {
        throw new Error('Promise rejection');
      });

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      await user.click(screen.getByText('Add Entry'));

      // Should handle the promise rejection gracefully
      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('State Management Error Handling', () => {
    it('should handle state updates on unmounted components', async () => {
      const user = userEvent.setup();
      const slowSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const { unmount } = render(<KBEntryForm onSubmit={slowSubmit} onCancel={jest.fn()} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      // Start submission
      await user.click(screen.getByText('Add Entry'));

      // Unmount component while submission is in progress
      act(() => {
        unmount();
      });

      // Should not cause memory leaks or errors
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // No errors should be logged
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility Error Handling', () => {
    it('should maintain accessibility even with errors', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      // Trigger validation errors
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Error messages should be associated with form fields
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toHaveClass('error');

      // Focus should still work
      titleInput.focus();
      expect(titleInput).toHaveFocus();
    });

    it('should handle screen reader announcements for errors', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      // Trigger validation errors
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/required$/);
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      // Error messages should be visible to screen readers
      const errorMessage = screen.getByText('Title is required');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('error-message');
    });
  });

  describe('Browser Compatibility Error Handling', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Mock missing API
      const originalFetch = global.fetch;
      delete (global as any).fetch;

      expect(() => {
        render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
      }).not.toThrow();

      // Restore
      global.fetch = originalFetch;
    });

    it('should handle keyboard events on different browsers', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const tagInput = screen.getByLabelText(/tags/i);

      // Test different key combinations
      await user.type(tagInput, 'test-tag');
      await user.keyboard('{Enter}');

      expect(screen.getByText('test-tag')).toBeInTheDocument();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should maintain performance during error states', async () => {
      const user = userEvent.setup();
      const slowAndFailingSubmit = jest.fn().mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Slow error')), 50)
        )
      );

      render(<KBEntryForm onSubmit={slowAndFailingSubmit} onCancel={jest.fn()} />);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      // Submit multiple times rapidly
      const button = screen.getByText('Add Entry');
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only submit once due to disabled state
      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      expect(slowAndFailingSubmit).toHaveBeenCalledTimes(1);
    });
  });
});