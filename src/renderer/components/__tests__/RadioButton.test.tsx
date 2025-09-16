/**
 * Comprehensive tests for RadioButton component
 * Testing accessibility, keyboard navigation, state management, and focus behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RadioButton, RadioGroup } from '../RadioButton';
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

describe('RadioButton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Handling', () => {
    it('throws error when used outside RadioGroup', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <RadioButton value="test" label="Test Radio" />,
          { wrapper: TestWrapper }
        );
      }).toThrow('RadioButton must be used within a RadioGroup');

      consoleSpy.mockRestore();
    });
  });
});

describe('RadioGroup Component', () => {
  const defaultProps = {
    label: 'Test Radio Group',
    value: '',
    onChange: jest.fn(),
    children: [
      <RadioButton key="1" value="option1" label="Option 1" />,
      <RadioButton key="2" value="option2" label="Option 2" />,
      <RadioButton key="3" value="option3" label="Option 3" />,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<RadioGroup {...defaultProps} />, { wrapper: TestWrapper });

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(screen.getByText('Test Radio Group')).toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('renders with custom test id', () => {
      render(<RadioGroup {...defaultProps} data-testid="custom-radio-group" />, { wrapper: TestWrapper });

      expect(screen.getByTestId('custom-radio-group')).toBeInTheDocument();
    });

    it('renders with different orientations', () => {
      const { rerender } = render(
        <RadioGroup {...defaultProps} orientation="vertical" />,
        { wrapper: TestWrapper }
      );
      expect(screen.getByRole('radiogroup')).toHaveClass('radio-group--vertical');

      rerender(<RadioGroup {...defaultProps} orientation="horizontal" />);
      expect(screen.getByRole('radiogroup')).toHaveClass('radio-group--horizontal');
    });

    it('renders with different spacing', () => {
      const { rerender } = render(
        <RadioGroup {...defaultProps} spacing="compact" />,
        { wrapper: TestWrapper }
      );
      expect(screen.getByRole('radiogroup')).toHaveClass('radio-group--compact');

      rerender(<RadioGroup {...defaultProps} spacing="relaxed" />);
      expect(screen.getByRole('radiogroup')).toHaveClass('radio-group--relaxed');
    });

    it('renders with different sizes', () => {
      const { rerender } = render(
        <RadioGroup {...defaultProps} size="small" />,
        { wrapper: TestWrapper }
      );
      expect(screen.getByRole('radiogroup')).toHaveClass('radio-group--small');

      rerender(<RadioGroup {...defaultProps} size="large" />);
      expect(screen.getByRole('radiogroup')).toHaveClass('radio-group--large');
    });
  });

  describe('State Management', () => {
    it('reflects selected value correctly', () => {
      render(<RadioGroup {...defaultProps} value="option2" />, { wrapper: TestWrapper });

      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeChecked();
      expect(radios[1]).toBeChecked();
      expect(radios[2]).not.toBeChecked();
    });

    it('calls onChange when radio is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByLabelText('Option 2'));
      expect(onChange).toHaveBeenCalledWith('option2', expect.any(Object));
    });

    it('only allows one radio to be selected at a time', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} value="option1" onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByLabelText('Option 2'));
      expect(onChange).toHaveBeenCalledWith('option2', expect.any(Object));

      // Only the clicked radio should be checked after change
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked(); // Still shows old value until parent updates
      expect(radios[1]).not.toBeChecked();
      expect(radios[2]).not.toBeChecked();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} value="option1" onChange={onChange} />, { wrapper: TestWrapper });

      const firstRadio = screen.getByLabelText('Option 1');
      firstRadio.focus();

      // ArrowDown should move to next option and select it
      await user.keyboard('[ArrowDown]');
      expect(onChange).toHaveBeenCalledWith('option2', expect.any(Object));

      // Clear mock and test ArrowUp
      onChange.mockClear();
      await user.keyboard('[ArrowUp]');
      expect(onChange).toHaveBeenCalledWith('option1', expect.any(Object));
    });

    it('supports ArrowRight and ArrowLeft navigation', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} value="option1" onChange={onChange} />, { wrapper: TestWrapper });

      const firstRadio = screen.getByLabelText('Option 1');
      firstRadio.focus();

      // ArrowRight should move to next option and select it
      await user.keyboard('[ArrowRight]');
      expect(onChange).toHaveBeenCalledWith('option2', expect.any(Object));

      // Clear mock and test ArrowLeft
      onChange.mockClear();
      await user.keyboard('[ArrowLeft]');
      expect(onChange).toHaveBeenCalledWith('option1', expect.any(Object));
    });

    it('wraps around when navigating past the last/first option', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} value="option3" onChange={onChange} />, { wrapper: TestWrapper });

      const lastRadio = screen.getByLabelText('Option 3');
      lastRadio.focus();

      // ArrowDown from last option should wrap to first
      await user.keyboard('[ArrowDown]');
      expect(onChange).toHaveBeenCalledWith('option1', expect.any(Object));

      // ArrowUp from first option should wrap to last
      onChange.mockClear();
      const firstRadio = screen.getByLabelText('Option 1');
      firstRadio.focus();

      await user.keyboard('[ArrowUp]');
      expect(onChange).toHaveBeenCalledWith('option3', expect.any(Object));
    });

    it('supports Home and End keys', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} value="option2" onChange={onChange} />, { wrapper: TestWrapper });

      const secondRadio = screen.getByLabelText('Option 2');
      secondRadio.focus();

      // Home should go to first option
      await user.keyboard('[Home]');
      expect(onChange).toHaveBeenCalledWith('option1', expect.any(Object));

      // End should go to last option
      onChange.mockClear();
      await user.keyboard('[End]');
      expect(onChange).toHaveBeenCalledWith('option3', expect.any(Object));
    });

    it('skips disabled radio buttons during navigation', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <RadioGroup {...defaultProps} value="option1" onChange={onChange}>
          <RadioButton value="option1" label="Option 1" />
          <RadioButton value="option2" label="Option 2" disabled />
          <RadioButton value="option3" label="Option 3" />
        </RadioGroup>,
        { wrapper: TestWrapper }
      );

      const firstRadio = screen.getByLabelText('Option 1');
      firstRadio.focus();

      // ArrowDown should skip disabled option and go to option3
      await user.keyboard('[ArrowDown]');
      expect(onChange).toHaveBeenCalledWith('option3', expect.any(Object));
    });
  });

  describe('Disabled State', () => {
    it('renders disabled state correctly', () => {
      render(<RadioGroup {...defaultProps} disabled={true} />, { wrapper: TestWrapper });

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeDisabled();
      expect(radiogroup).toHaveClass('radio-group--disabled');

      // All radio buttons should be disabled
      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });

    it('does not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<RadioGroup {...defaultProps} disabled={true} onChange={onChange} />, { wrapper: TestWrapper });

      await user.click(screen.getByLabelText('Option 1'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('allows individual radio buttons to be disabled', () => {
      render(
        <RadioGroup {...defaultProps}>
          <RadioButton value="option1" label="Option 1" />
          <RadioButton value="option2" label="Option 2" disabled />
          <RadioButton value="option3" label="Option 3" />
        </RadioGroup>,
        { wrapper: TestWrapper }
      );

      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).toBeDisabled();
      expect(radios[2]).not.toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('renders error state correctly', () => {
      render(<RadioGroup {...defaultProps} error="This field is required" />, { wrapper: TestWrapper });

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('aria-invalid', 'true');
      expect(radiogroup).toHaveClass('radio-group--error');
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('associates error message with radio group', () => {
      render(<RadioGroup {...defaultProps} error="This field is required" />, { wrapper: TestWrapper });

      const radiogroup = screen.getByRole('radiogroup');
      const errorElement = screen.getByRole('alert');

      expect(radiogroup).toHaveAttribute('aria-describedby', expect.stringContaining(errorElement.id));
    });
  });

  describe('Helper Text', () => {
    it('renders helper text', () => {
      render(<RadioGroup {...defaultProps} helperText="This is helper text" />, { wrapper: TestWrapper });

      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('associates helper text with radio group', () => {
      render(<RadioGroup {...defaultProps} helperText="Helper text" />, { wrapper: TestWrapper });

      const radiogroup = screen.getByRole('radiogroup');
      const helperElement = screen.getByText('Helper text');

      expect(radiogroup).toHaveAttribute('aria-describedby', expect.stringContaining(helperElement.id));
    });

    it('prioritizes error message over helper text', () => {
      render(
        <RadioGroup
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
      render(<RadioGroup {...defaultProps} required={true} />, { wrapper: TestWrapper });

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('aria-required', 'true');
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Auto Focus', () => {
    it('auto focuses selected option when autoFocus is true', () => {
      render(<RadioGroup {...defaultProps} value="option2" autoFocus={true} />, { wrapper: TestWrapper });

      expect(screen.getByLabelText('Option 2')).toHaveFocus();
    });

    it('auto focuses first option when autoFocus is true and no value selected', () => {
      render(<RadioGroup {...defaultProps} autoFocus={true} />, { wrapper: TestWrapper });

      expect(screen.getByLabelText('Option 1')).toHaveFocus();
    });
  });

  describe('Individual RadioButton Props', () => {
    it('renders individual helper text for radio buttons', () => {
      render(
        <RadioGroup {...defaultProps}>
          <RadioButton value="option1" label="Option 1" helperText="Helper for option 1" />
          <RadioButton value="option2" label="Option 2" />
          <RadioButton value="option3" label="Option 3" />
        </RadioGroup>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Helper for option 1')).toBeInTheDocument();
    });

    it('supports focus and blur handlers on individual radio buttons', async () => {
      const user = userEvent.setup();
      const onFocus = jest.fn();
      const onBlur = jest.fn();

      render(
        <RadioGroup {...defaultProps}>
          <RadioButton value="option1" label="Option 1" onFocus={onFocus} onBlur={onBlur} />
          <RadioButton value="option2" label="Option 2" />
          <RadioButton value="option3" label="Option 3" />
        </RadioGroup>,
        { wrapper: TestWrapper }
      );

      const firstRadio = screen.getByLabelText('Option 1');

      await user.click(firstRadio);
      expect(onFocus).toHaveBeenCalled();

      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('uses proper ARIA attributes', () => {
      render(<RadioGroup {...defaultProps} value="option2" />, { wrapper: TestWrapper });

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();

      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toHaveAttribute('aria-checked', 'false');
      expect(radios[1]).toHaveAttribute('aria-checked', 'true');
      expect(radios[2]).toHaveAttribute('aria-checked', 'false');

      // All radios should have the same name
      const name = radios[0].getAttribute('name');
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('name', name);
      });
    });

    it('uses fieldset and legend structure', () => {
      render(<RadioGroup {...defaultProps} />, { wrapper: TestWrapper });

      const fieldset = screen.getByRole('radiogroup');
      expect(fieldset.tagName).toBe('FIELDSET');

      const legend = screen.getByText('Test Radio Group');
      expect(legend.tagName).toBe('LEGEND');
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(<RadioGroup {...defaultProps} />, { wrapper: TestWrapper });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests with all props', async () => {
      const { container } = render(
        <RadioGroup
          {...defaultProps}
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

    it('passes axe accessibility tests with individual radio button props', async () => {
      const { container } = render(
        <RadioGroup {...defaultProps}>
          <RadioButton value="option1" label="Option 1" helperText="Helper for option 1" />
          <RadioButton value="option2" label="Option 2" disabled />
          <RadioButton value="option3" label="Option 3" />
        </RadioGroup>,
        { wrapper: TestWrapper }
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});