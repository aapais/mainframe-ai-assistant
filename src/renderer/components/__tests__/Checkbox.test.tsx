/**
 * Comprehensive tests for Checkbox component
 * Testing accessibility, keyboard navigation, state management, and focus behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Checkbox, CheckboxGroup } from '../Checkbox';
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

describe('Checkbox Component', () => {
  const defaultProps = {
    checked: false,
    onChange: jest.fn(),
    label: 'Test Checkbox',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<Checkbox {...defaultProps} />, { wrapper: TestWrapper });

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Checkbox')).toBeInTheDocument();
    });

    it('renders with custom test id', () => {
      render(<Checkbox {...defaultProps} data-testid="custom-checkbox" />, { wrapper: TestWrapper });

      expect(screen.getByTestId('custom-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('custom-checkbox-input')).toBeInTheDocument();
    });

    it('renders with all size variants', () => {
      const { rerender } = render(<Checkbox {...defaultProps} size="small" />, { wrapper: TestWrapper });
      expect(screen.getByRole('checkbox').closest('.checkbox')).toHaveClass('checkbox--small');

      rerender(<Checkbox {...defaultProps} size="medium" />);
      expect(screen.getByRole('checkbox').closest('.checkbox')).toHaveClass('checkbox--medium');

      rerender(<Checkbox {...defaultProps} size="large" />);
      expect(screen.getByRole('checkbox').closest('.checkbox')).toHaveClass('checkbox--large');
    });
  });

  describe('State Management', () => {
    it('reflects checked state correctly', () => {
      const { rerender } = render(<Checkbox {...defaultProps} checked={false} />, { wrapper: TestWrapper });
      expect(screen.getByRole('checkbox')).not.toBeChecked();

      rerender(<Checkbox {...defaultProps} checked={true} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('handles indeterminate state', () => {
      render(<Checkbox {...defaultProps} indeterminate={true} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.indeterminate).toBe(true);
      expect(checkbox.closest('.checkbox')).toHaveClass('checkbox--indeterminate');
    });

    it('calls onChange when clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Checkbox {...defaultProps} onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByRole('checkbox'));
      expect(onChange).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('calls onChange when label is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Checkbox {...defaultProps} onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByText('Test Checkbox'));
      expect(onChange).toHaveBeenCalledWith(true, expect.any(Object));
    });
  });

  describe('Keyboard Navigation', () => {
    it('toggles when Space key is pressed', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Checkbox {...defaultProps} onChange={onChange} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();

      await user.keyboard(' ');
      expect(onChange).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('supports Tab navigation', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <input data-testid="before" />
          <Checkbox {...defaultProps} data-testid="checkbox" />
          <input data-testid="after" />
        </div>,
        { wrapper: TestWrapper }
      );

      const beforeInput = screen.getByTestId('before');
      const checkbox = screen.getByTestId('checkbox-input');
      const afterInput = screen.getByTestId('after');

      beforeInput.focus();
      await user.tab();
      expect(checkbox).toHaveFocus();

      await user.tab();
      expect(afterInput).toHaveFocus();
    });

    it('handles focus and blur events', async () => {
      const user = userEvent.setup();
      const onFocus = jest.fn();
      const onBlur = jest.fn();

      render(
        <Checkbox {...defaultProps} onFocus={onFocus} onBlur={onBlur} />,
        { wrapper: TestWrapper }
      );

      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);
      expect(onFocus).toHaveBeenCalled();

      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('renders disabled state correctly', () => {
      render(<Checkbox {...defaultProps} disabled={true} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox.closest('.checkbox')).toHaveClass('checkbox--disabled');
    });

    it('does not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Checkbox {...defaultProps} disabled={true} onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByRole('checkbox'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not respond to keyboard when disabled', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Checkbox {...defaultProps} disabled={true} onChange={onChange} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();

      await user.keyboard(' ');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Read-only State', () => {
    it('renders read-only state correctly', () => {
      render(<Checkbox {...defaultProps} readOnly={true} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('readonly');
      expect(checkbox.closest('.checkbox')).toHaveClass('checkbox--readonly');
    });

    it('does not call onChange when read-only', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Checkbox {...defaultProps} readOnly={true} onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByRole('checkbox'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Error State', () => {
    it('renders error state correctly', () => {
      render(<Checkbox {...defaultProps} error="This field is required" />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
      expect(checkbox.closest('.checkbox')).toHaveClass('checkbox--error');
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('associates error message with checkbox', () => {
      render(<Checkbox {...defaultProps} error="This field is required" />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      const errorElement = screen.getByRole('alert');

      expect(checkbox).toHaveAttribute('aria-describedby', expect.stringContaining(errorElement.id));
    });
  });

  describe('Helper Text', () => {
    it('renders helper text', () => {
      render(<Checkbox {...defaultProps} helperText="This is helper text" />, { wrapper: TestWrapper });

      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('associates helper text with checkbox', () => {
      render(<Checkbox {...defaultProps} helperText="Helper text" />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      const helperElement = screen.getByText('Helper text');

      expect(checkbox).toHaveAttribute('aria-describedby', expect.stringContaining(helperElement.id));
    });

    it('prioritizes error message over helper text', () => {
      render(
        <Checkbox
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
      render(<Checkbox {...defaultProps} required={true} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-required', 'true');
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Auto Focus', () => {
    it('auto focuses when autoFocus is true', () => {
      render(<Checkbox {...defaultProps} autoFocus={true} />, { wrapper: TestWrapper });

      expect(screen.getByRole('checkbox')).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Checkbox {...defaultProps} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('has proper ARIA attributes when checked', () => {
      render(<Checkbox {...defaultProps} checked={true} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('has proper ARIA attributes when indeterminate', () => {
      render(<Checkbox {...defaultProps} indeterminate={true} />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(<Checkbox {...defaultProps} />, { wrapper: TestWrapper });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests with all props', async () => {
      const { container } = render(
        <Checkbox
          {...defaultProps}
          error="Error message"
          helperText="Helper text"
          required={true}
          disabled={false}
        />,
        { wrapper: TestWrapper }
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

describe('CheckboxGroup Component', () => {
  const defaultGroupProps = {
    label: 'Test Group',
    children: [
      <Checkbox key="1" checked={false} onChange={jest.fn()} label="Option 1" />,
      <Checkbox key="2" checked={false} onChange={jest.fn()} label="Option 2" />,
      <Checkbox key="3" checked={false} onChange={jest.fn()} label="Option 3" />,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<CheckboxGroup {...defaultGroupProps} />, { wrapper: TestWrapper });

      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByText('Test Group')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    });

    it('renders with different orientations', () => {
      const { rerender } = render(
        <CheckboxGroup {...defaultGroupProps} orientation="vertical" />,
        { wrapper: TestWrapper }
      );
      expect(screen.getByRole('group')).toHaveClass('checkbox-group--vertical');

      rerender(<CheckboxGroup {...defaultGroupProps} orientation="horizontal" />);
      expect(screen.getByRole('group')).toHaveClass('checkbox-group--horizontal');
    });

    it('renders with different spacing', () => {
      const { rerender } = render(
        <CheckboxGroup {...defaultGroupProps} spacing="compact" />,
        { wrapper: TestWrapper }
      );
      expect(screen.getByRole('group')).toHaveClass('checkbox-group--compact');

      rerender(<CheckboxGroup {...defaultGroupProps} spacing="relaxed" />);
      expect(screen.getByRole('group')).toHaveClass('checkbox-group--relaxed');
    });
  });

  describe('Group States', () => {
    it('disables all checkboxes when group is disabled', () => {
      render(<CheckboxGroup {...defaultGroupProps} disabled={true} />, { wrapper: TestWrapper });

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeDisabled();
      });
    });

    it('renders error state correctly', () => {
      render(<CheckboxGroup {...defaultGroupProps} error="Group error" />, { wrapper: TestWrapper });

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Group error');
    });

    it('renders required state correctly', () => {
      render(<CheckboxGroup {...defaultGroupProps} required={true} />, { wrapper: TestWrapper });

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-required', 'true');
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Helper Text and Errors', () => {
    it('renders helper text', () => {
      render(<CheckboxGroup {...defaultGroupProps} helperText="Group helper text" />, { wrapper: TestWrapper });

      expect(screen.getByText('Group helper text')).toBeInTheDocument();
    });

    it('associates error with group', () => {
      render(<CheckboxGroup {...defaultGroupProps} error="Group error" />, { wrapper: TestWrapper });

      const group = screen.getByRole('group');
      const errorElement = screen.getByRole('alert');

      expect(group).toHaveAttribute('aria-describedby', expect.stringContaining(errorElement.id));
    });
  });

  describe('Accessibility', () => {
    it('uses fieldset and legend structure', () => {
      render(<CheckboxGroup {...defaultGroupProps} />, { wrapper: TestWrapper });

      const fieldset = screen.getByRole('group');
      expect(fieldset.tagName).toBe('FIELDSET');

      const legend = screen.getByText('Test Group');
      expect(legend.tagName).toBe('LEGEND');
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(<CheckboxGroup {...defaultGroupProps} />, { wrapper: TestWrapper });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests with all props', async () => {
      const { container } = render(
        <CheckboxGroup
          {...defaultGroupProps}
          error="Group error"
          helperText="Group helper text"
          required={true}
          disabled={false}
        />,
        { wrapper: TestWrapper }
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});