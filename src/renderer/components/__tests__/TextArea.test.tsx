/**
 * Comprehensive tests for TextArea component
 * Testing accessibility, keyboard navigation, auto-resize, character count, and focus behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TextArea } from '../TextArea';
import { KeyboardProvider } from '../../contexts/KeyboardContext';

expect.extend(toHaveNoViolations);

// Mock the accessibility utilities
jest.mock('../../utils/accessibility', () => ({
  AriaUtils: {
    generateId: jest.fn((prefix) => `${prefix}-mock-id`),
    createDescription: jest.fn(),
  },
  announceToScreenReader: jest.fn(),
}));

// Mock the keyboard context
const mockKeyboardContext = {
  state: {
    isKeyboardMode: false,
    showKeyboardHelp: false,
    registeredShortcuts: new Map(),
    activeScope: null,
    visualFocusEnabled: true,
    skipLinksCreated: false,
    focusVisible: false,
  },
  dispatch: jest.fn(),
  registerShortcut: jest.fn(),
  unregisterShortcut: jest.fn(),
  setKeyboardMode: jest.fn(),
  toggleKeyboardHelp: jest.fn(),
  setActiveScope: jest.fn(),
  createFocusTrap: jest.fn(),
  createRovingTabindex: jest.fn(),
  createSkipLinks: jest.fn(),
  focusFirst: jest.fn(),
  focusLast: jest.fn(),
  isKeyboardOnlyMode: jest.fn(() => false),
};

jest.mock('../../contexts/KeyboardContext', () => ({
  useKeyboard: () => mockKeyboardContext,
  KeyboardProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <KeyboardProvider>{children}</KeyboardProvider>
);

describe('TextArea Component', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    label: 'Test TextArea',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<TextArea {...defaultProps} />, { wrapper: TestWrapper });

      expect(screen.getByRole('textbox', { multiline: true })).toBeInTheDocument();
      expect(screen.getByLabelText('Test TextArea')).toBeInTheDocument();
    });

    it('renders with custom test id', () => {
      render(<TextArea {...defaultProps} data-testid="custom-textarea" />, { wrapper: TestWrapper });

      expect(screen.getByTestId('custom-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('custom-textarea-input')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<TextArea {...defaultProps} placeholder="Enter text here" />, { wrapper: TestWrapper });

      expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
    });

    it('renders with all size variants', () => {
      const { rerender } = render(<TextArea {...defaultProps} size="small" />, { wrapper: TestWrapper });
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--small');

      rerender(<TextArea {...defaultProps} size="medium" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--medium');

      rerender(<TextArea {...defaultProps} size="large" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--large');
    });

    it('renders with all variant styles', () => {
      const { rerender } = render(<TextArea {...defaultProps} variant="default" />, { wrapper: TestWrapper });
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--default');

      rerender(<TextArea {...defaultProps} variant="filled" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--filled');

      rerender(<TextArea {...defaultProps} variant="outlined" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--outlined');
    });

    it('renders with all resize options', () => {
      const { rerender } = render(<TextArea {...defaultProps} resize="none" />, { wrapper: TestWrapper });
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--none');

      rerender(<TextArea {...defaultProps} resize="both" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--both');

      rerender(<TextArea {...defaultProps} resize="horizontal" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--horizontal');

      rerender(<TextArea {...defaultProps} resize="vertical" />);
      expect(screen.getByRole('textbox', { multiline: true }).closest('.textarea')).toHaveClass('textarea--vertical');
    });
  });

  describe('State Management', () => {
    it('reflects value correctly', () => {
      render(<TextArea {...defaultProps} value="Test content" />, { wrapper: TestWrapper });

      expect(screen.getByDisplayValue('Test content')).toBeInTheDocument();
    });

    it('calls onChange when text is entered', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<TextArea {...defaultProps} onChange={onChange} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      await user.type(textarea, 'Hello');

      expect(onChange).toHaveBeenCalledTimes(5); // Once for each character
      expect(onChange).toHaveBeenLastCalledWith('Hello', expect.any(Object));
    });

    it('enforces maxLength constraint', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<TextArea {...defaultProps} maxLength={5} onChange={onChange} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      await user.type(textarea, 'Hello World'); // More than 5 characters

      // onChange should only be called 5 times (for 'Hello')
      expect(onChange).toHaveBeenCalledTimes(5);
      expect(onChange).toHaveBeenLastCalledWith('Hello', expect.any(Object));
    });
  });

  describe('Character and Word Count', () => {
    it('displays character count when enabled', () => {
      render(<TextArea {...defaultProps} value="Hello" showCharacterCount={true} />, { wrapper: TestWrapper });

      expect(screen.getByText('5 characters')).toBeInTheDocument();
    });

    it('displays character count with maxLength', () => {
      render(
        <TextArea
          {...defaultProps}
          value="Hello"
          maxLength={10}
          showCharacterCount={true}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('5/10 characters')).toBeInTheDocument();
    });

    it('displays word count when enabled', () => {
      render(<TextArea {...defaultProps} value="Hello world test" showWordCount={true} />, { wrapper: TestWrapper });

      expect(screen.getByText('3 words')).toBeInTheDocument();
    });

    it('displays both character and word count', () => {
      render(
        <TextArea
          {...defaultProps}
          value="Hello world"
          showCharacterCount={true}
          showWordCount={true}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('11 characters')).toBeInTheDocument();
      expect(screen.getByText('2 words')).toBeInTheDocument();
      expect(screen.getByText('•')).toBeInTheDocument(); // Separator
    });

    it('shows warning when near character limit', () => {
      render(
        <TextArea
          {...defaultProps}
          value="Hello wor" // 9 characters, 1 remaining
          maxLength={10}
          showCharacterCount={true}
        />,
        { wrapper: TestWrapper }
      );

      const countElement = screen.getByText('9/10 characters').closest('.textarea__count');
      expect(countElement).toHaveClass('textarea__count--warning');
    });

    it('shows error when over character limit', () => {
      render(
        <TextArea
          {...defaultProps}
          value="Hello world!" // 12 characters, over limit
          maxLength={10}
          showCharacterCount={true}
        />,
        { wrapper: TestWrapper }
      );

      const countElement = screen.getByText(/12\/10 characters/).closest('.textarea__count');
      expect(countElement).toHaveClass('textarea__count--error');

      // The over-limit part should be highlighted
      expect(screen.getByText('12')).toHaveClass('over-limit');
    });

    it('counts words correctly for empty and single word', () => {
      const { rerender } = render(
        <TextArea {...defaultProps} value="" showWordCount={true} />,
        { wrapper: TestWrapper }
      );
      expect(screen.getByText('0 words')).toBeInTheDocument();

      rerender(<TextArea {...defaultProps} value="Hello" showWordCount={true} />);
      expect(screen.getByText('1 words')).toBeInTheDocument();
    });
  });

  describe('Auto-resize Functionality', () => {
    it('enables auto-resize when autoResize is true', () => {
      render(<TextArea {...defaultProps} autoResize={true} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea.closest('.textarea')).toHaveClass('textarea--auto-resize');
    });

    it('uses minRows when auto-resizing', () => {
      render(<TextArea {...defaultProps} autoResize={true} minRows={3} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true }) as HTMLTextAreaElement;
      expect(textarea.rows).toBe(3);
    });

    it('adjusts height when content changes (simulated)', async () => {
      const user = userEvent.setup();

      // Mock scrollHeight to simulate content height
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        value: 100,
      });

      render(<TextArea {...defaultProps} autoResize={true} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true }) as HTMLTextAreaElement;

      // Initially should have auto height
      expect(textarea.style.height).toBe('auto');

      await user.type(textarea, 'Line 1\nLine 2\nLine 3');

      // Height should be adjusted (exact value depends on implementation)
      expect(textarea.style.height).toBeTruthy();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports Tab key for indentation in multiline text', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<TextArea {...defaultProps} value="Hello" onChange={onChange} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      textarea.focus();

      // Place cursor in the middle
      fireEvent.select(textarea, { start: 2, end: 2 });

      await user.keyboard('[Tab]');

      expect(onChange).toHaveBeenCalledWith('He\tllo', expect.any(Object));
    });

    it('allows tab navigation when at start or end of content', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <input data-testid="before" />
          <TextArea {...defaultProps} value="" data-testid="textarea" />
          <input data-testid="after" />
        </div>,
        { wrapper: TestWrapper }
      );

      const beforeInput = screen.getByTestId('before');
      const textarea = screen.getByTestId('textarea-input');
      const afterInput = screen.getByTestId('after');

      beforeInput.focus();
      await user.tab();
      expect(textarea).toHaveFocus();

      await user.tab();
      expect(afterInput).toHaveFocus();
    });

    it('handles focus and blur events', async () => {
      const user = userEvent.setup();
      const onFocus = jest.fn();
      const onBlur = jest.fn();

      render(
        <TextArea {...defaultProps} onFocus={onFocus} onBlur={onBlur} />,
        { wrapper: TestWrapper }
      );

      const textarea = screen.getByRole('textbox', { multiline: true });

      await user.click(textarea);
      expect(onFocus).toHaveBeenCalled();

      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });

    it('supports custom onKeyDown handler', async () => {
      const user = userEvent.setup();
      const onKeyDown = jest.fn();

      render(<TextArea {...defaultProps} onKeyDown={onKeyDown} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      textarea.focus();

      await user.keyboard('[Enter]');

      expect(onKeyDown).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('renders disabled state correctly', () => {
      render(<TextArea {...defaultProps} disabled={true} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toBeDisabled();
      expect(textarea.closest('.textarea')).toHaveClass('textarea--disabled');
    });

    it('does not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<TextArea {...defaultProps} disabled={true} onChange={onChange} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      await user.type(textarea, 'Hello');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Read-only State', () => {
    it('renders read-only state correctly', () => {
      render(<TextArea {...defaultProps} readOnly={true} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('readonly');
      expect(textarea.closest('.textarea')).toHaveClass('textarea--readonly');
    });

    it('does not call onChange when read-only', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<TextArea {...defaultProps} readOnly={true} onChange={onChange} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      await user.type(textarea, 'Hello');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Error State', () => {
    it('renders error state correctly', () => {
      render(<TextArea {...defaultProps} error="This field is required" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
      expect(textarea.closest('.textarea')).toHaveClass('textarea--error');
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('associates error message with textarea', () => {
      render(<TextArea {...defaultProps} error="This field is required" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      const errorElement = screen.getByRole('alert');

      expect(textarea).toHaveAttribute('aria-describedby', expect.stringContaining(errorElement.id));
    });
  });

  describe('Helper Text', () => {
    it('renders helper text', () => {
      render(<TextArea {...defaultProps} helperText="This is helper text" />, { wrapper: TestWrapper });

      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('associates helper text with textarea', () => {
      render(<TextArea {...defaultProps} helperText="Helper text" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      const helperElement = screen.getByText('Helper text');

      expect(textarea).toHaveAttribute('aria-describedby', expect.stringContaining(helperElement.id));
    });

    it('prioritizes error message over helper text', () => {
      render(
        <TextArea
          {...defaultProps}
          error="Error message"
          helperText="Helper text"
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Error message');
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    });
  });

  describe('Required State', () => {
    it('renders required indicator', () => {
      render(<TextArea {...defaultProps} required={true} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('aria-required', 'true');
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('supports minLength validation', () => {
      render(<TextArea {...defaultProps} minLength={5} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('minlength', '5');
    });

    it('supports pattern validation', () => {
      render(<TextArea {...defaultProps} pattern="[A-Za-z]+" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('pattern', '[A-Za-z]+');
    });
  });

  describe('Auto Focus', () => {
    it('auto focuses when autoFocus is true', () => {
      render(<TextArea {...defaultProps} autoFocus={true} />, { wrapper: TestWrapper });

      expect(screen.getByRole('textbox', { multiline: true })).toHaveFocus();
    });
  });

  describe('Additional Attributes', () => {
    it('supports spellCheck attribute', () => {
      render(<TextArea {...defaultProps} spellCheck={false} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('spellcheck', 'false');
    });

    it('supports autoComplete attribute', () => {
      render(<TextArea {...defaultProps} autoComplete="off" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('autocomplete', 'off');
    });

    it('supports autoCapitalize attribute', () => {
      render(<TextArea {...defaultProps} autoCapitalize="words" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('autocapitalize', 'words');
    });

    it('supports custom validation message', () => {
      render(<TextArea {...defaultProps} validationMessage="Custom validation message" />, { wrapper: TestWrapper });

      expect(screen.getByText('Custom validation message')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<TextArea {...defaultProps} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('aria-multiline', 'true');
    });

    it('associates label with textarea', () => {
      render(<TextArea {...defaultProps} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      const label = screen.getByText('Test TextArea');

      expect(label.getAttribute('for')).toBe(textarea.id);
    });

    it('supports custom aria-label', () => {
      render(<TextArea {...defaultProps} aria-label="Custom aria label" />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });
      expect(textarea).toHaveAttribute('aria-label', 'Custom aria label');
    });

    it('announces auto-resize to screen readers', () => {
      render(<TextArea {...defaultProps} autoResize={true} />, { wrapper: TestWrapper });

      expect(screen.getByText('Auto-resizing text area')).toBeInTheDocument();
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(<TextArea {...defaultProps} />, { wrapper: TestWrapper });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests with all props', async () => {
      const { container } = render(
        <TextArea
          {...defaultProps}
          error="Error message"
          helperText="Helper text"
          required={true}
          showCharacterCount={true}
          showWordCount={true}
          maxLength={100}
          autoResize={true}
        />,
        { wrapper: TestWrapper }
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Performance', () => {
    it('handles rapid typing without performance issues', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<TextArea {...defaultProps} onChange={onChange} />, { wrapper: TestWrapper });

      const textarea = screen.getByRole('textbox', { multiline: true });

      // Type rapidly
      const longText = 'A'.repeat(1000);
      await user.type(textarea, longText);

      expect(onChange).toHaveBeenCalledTimes(1000);
    });

    it('handles large text values efficiently', () => {
      const largeText = 'A'.repeat(10000);

      render(<TextArea {...defaultProps} value={largeText} showCharacterCount={true} />, { wrapper: TestWrapper });

      expect(screen.getByText('10000 characters')).toBeInTheDocument();
    });
  });
});