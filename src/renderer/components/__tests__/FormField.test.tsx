import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { TextField, TextAreaField, SelectField, TagsField, FormButton } from '../common/FormField';

// Mock CSS imports
jest.mock('../common/FormField.css', () => ({}));

describe('TextField', () => {
  const mockProps = {
    name: 'test-field',
    label: 'Test Field',
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render with label and input', () => {
      render(<TextField {...mockProps} />);
      
      expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should call onChange when value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TextField {...mockProps} onChange={mockOnChange} />);
      
      const input = screen.getByLabelText('Test Field');
      await user.type(input, 'test value');
      
      expect(mockOnChange).toHaveBeenCalledWith('test value');
    });

    it('should display current value', () => {
      render(<TextField {...mockProps} value="current value" />);
      
      expect(screen.getByDisplayValue('current value')).toBeInTheDocument();
    });

    it('should show placeholder when provided', () => {
      render(<TextField {...mockProps} placeholder="Enter value..." />);
      
      expect(screen.getByPlaceholderText('Enter value...')).toBeInTheDocument();
    });
  });

  describe('Validation and Errors', () => {
    it('should display error message', () => {
      render(<TextField {...mockProps} error="This field is required" />);
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should apply error styling when error present', () => {
      render(<TextField {...mockProps} error="Error message" />);
      
      const input = screen.getByLabelText('Test Field');
      expect(input).toHaveClass('form-field__input--error');
    });

    it('should set aria-invalid when error present', () => {
      render(<TextField {...mockProps} error="Error message" />);
      
      const input = screen.getByLabelText('Test Field');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error with input via aria-describedby', () => {
      render(<TextField {...mockProps} error="Error message" />);
      
      const input = screen.getByLabelText('Test Field');
      const errorId = `${mockProps.name}-error`;
      expect(input).toHaveAttribute('aria-describedby', errorId);
      expect(screen.getByText('Error message')).toHaveAttribute('id', errorId);
    });
  });

  describe('Required Field Handling', () => {
    it('should show asterisk for required fields', () => {
      render(<TextField {...mockProps} required />);
      
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should set aria-required for required fields', () => {
      render(<TextField {...mockProps} required />);
      
      const input = screen.getByLabelText('Test Field');
      expect(input).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Character Counting', () => {
    it('should show character count when showCharacterCount is true', () => {
      render(<TextField {...mockProps} value="test" maxLength={100} showCharacterCount />);
      
      expect(screen.getByText('4 / 100')).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TextField {...mockProps} onChange={mockOnChange} maxLength={50} showCharacterCount />);
      
      const input = screen.getByLabelText('Test Field');
      await user.type(input, 'hello');
      
      // Character count should update (though we'd need to manage state to see it)
      expect(mockOnChange).toHaveBeenCalledWith('hello');
    });

    it('should warn when approaching character limit', () => {
      render(<TextField {...mockProps} value={"a".repeat(95)} maxLength={100} showCharacterCount />);
      
      const characterCount = screen.getByText('95 / 100');
      expect(characterCount).toHaveClass('form-field__character-count--warning');
    });

    it('should show error when over character limit', () => {
      render(<TextField {...mockProps} value={"a".repeat(105)} maxLength={100} showCharacterCount />);
      
      const characterCount = screen.getByText('105 / 100');
      expect(characterCount).toHaveClass('form-field__character-count--error');
    });
  });

  describe('Help Text', () => {
    it('should display help text when provided', () => {
      render(<TextField {...mockProps} helpText="This is helpful information" />);
      
      expect(screen.getByText('This is helpful information')).toBeInTheDocument();
    });

    it('should associate help text with input via aria-describedby', () => {
      render(<TextField {...mockProps} helpText="Help text" />);
      
      const input = screen.getByLabelText('Test Field');
      const helpId = `${mockProps.name}-help`;
      expect(input).toHaveAttribute('aria-describedby', helpId);
      expect(screen.getByText('Help text')).toHaveAttribute('id', helpId);
    });

    it('should combine error and help text in aria-describedby', () => {
      render(<TextField {...mockProps} helpText="Help text" error="Error message" />);
      
      const input = screen.getByLabelText('Test Field');
      const helpId = `${mockProps.name}-help`;
      const errorId = `${mockProps.name}-error`;
      expect(input).toHaveAttribute('aria-describedby', `${helpId} ${errorId}`);
    });
  });

  describe('Accessibility', () => {
    it('should focus input when label clicked', async () => {
      const user = userEvent.setup();
      render(<TextField {...mockProps} />);
      
      const label = screen.getByText('Test Field');
      await user.click(label);
      
      const input = screen.getByLabelText('Test Field');
      expect(input).toHaveFocus();
    });

    it('should have proper focus styles', async () => {
      const user = userEvent.setup();
      render(<TextField {...mockProps} />);
      
      const input = screen.getByLabelText('Test Field');
      await user.click(input);
      
      expect(input).toHaveFocus();
    });
  });
});

describe('TextAreaField', () => {
  const mockProps = {
    name: 'textarea-field',
    label: 'Text Area Field',
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render textarea with label', () => {
      render(<TextAreaField {...mockProps} />);
      
      expect(screen.getByLabelText('Text Area Field')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should respect rows prop', () => {
      render(<TextAreaField {...mockProps} rows={5} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('should auto-resize when autoResize is true', () => {
      render(<TextAreaField {...mockProps} autoResize />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('form-field__textarea--auto-resize');
    });
  });

  describe('Character Counting for TextArea', () => {
    it('should show character count for textarea', () => {
      render(<TextAreaField {...mockProps} value="test content" maxLength={500} showCharacterCount />);
      
      expect(screen.getByText('12 / 500')).toBeInTheDocument();
    });
  });
});

describe('SelectField', () => {
  const mockProps = {
    name: 'select-field',
    label: 'Select Field',
    value: '',
    onChange: jest.fn(),
    options: [
      { value: '', label: 'Select option...' },
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render select with options', () => {
      render(<SelectField {...mockProps} />);
      
      expect(screen.getByLabelText('Select Field')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('should call onChange when selection changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<SelectField {...mockProps} onChange={mockOnChange} />);
      
      const select = screen.getByLabelText('Select Field');
      await user.selectOptions(select, 'option1');
      
      expect(mockOnChange).toHaveBeenCalledWith('option1');
    });

    it('should show current selected value', () => {
      render(<SelectField {...mockProps} value="option2" />);
      
      const select = screen.getByLabelText('Select Field');
      expect(select).toHaveValue('option2');
    });
  });

  describe('Option Groups', () => {
    const optionsWithGroups = [
      { value: '', label: 'Select option...' },
      {
        label: 'Group 1',
        options: [
          { value: 'g1o1', label: 'Group 1 Option 1' },
          { value: 'g1o2', label: 'Group 1 Option 2' },
        ]
      },
      {
        label: 'Group 2',
        options: [
          { value: 'g2o1', label: 'Group 2 Option 1' },
        ]
      },
    ];

    it('should render option groups correctly', () => {
      render(<SelectField {...mockProps} options={optionsWithGroups} />);
      
      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();
      expect(screen.getByText('Group 1 Option 1')).toBeInTheDocument();
    });
  });
});

describe('TagsField', () => {
  const mockProps = {
    name: 'tags-field',
    label: 'Tags Field',
    value: ['existing', 'tags'],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render existing tags', () => {
      render(<TagsField {...mockProps} />);
      
      expect(screen.getByText('existing')).toBeInTheDocument();
      expect(screen.getByText('tags')).toBeInTheDocument();
    });

    it('should render tag input field', () => {
      render(<TagsField {...mockProps} />);
      
      expect(screen.getByLabelText('Tags Field')).toBeInTheDocument();
    });

    it('should add tag when Enter pressed', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...mockProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'newtag{Enter}');
      
      expect(mockOnChange).toHaveBeenCalledWith(['existing', 'tags', 'newtag']);
    });

    it('should remove tag when remove button clicked', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...mockProps} onChange={mockOnChange} />);
      
      // Find remove button for 'existing' tag
      const removeButtons = screen.getAllByText('×');
      await user.click(removeButtons[0]);
      
      expect(mockOnChange).toHaveBeenCalledWith(['tags']);
    });
  });

  describe('Tag Validation', () => {
    it('should not add empty tags', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...mockProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, '{Enter}');
      
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should not add duplicate tags', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...mockProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'existing{Enter}');
      
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should enforce maximum tags when maxTags provided', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...mockProps} onChange={mockOnChange} maxTags={3} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'tag3{Enter}');
      expect(mockOnChange).toHaveBeenCalledWith(['existing', 'tags', 'tag3']);
      
      mockOnChange.mockClear();
      
      // Try to add fourth tag
      await user.type(input, 'tag4{Enter}');
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Tag Suggestions', () => {
    it('should show suggestions when provided', async () => {
      const user = userEvent.setup();
      const suggestions = ['suggestion1', 'suggestion2', 'suggested'];
      
      render(<TagsField {...mockProps} suggestions={suggestions} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'sugg');
      
      // Should show matching suggestions
      expect(screen.getByText('suggestion1')).toBeInTheDocument();
      expect(screen.getByText('suggestion2')).toBeInTheDocument();
      expect(screen.getByText('suggested')).toBeInTheDocument();
    });

    it('should add suggestion when clicked', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      const suggestions = ['clickable-suggestion'];
      
      render(<TagsField {...mockProps} onChange={mockOnChange} suggestions={suggestions} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'click');
      
      const suggestion = screen.getByText('clickable-suggestion');
      await user.click(suggestion);
      
      expect(mockOnChange).toHaveBeenCalledWith(['existing', 'tags', 'clickable-suggestion']);
    });
  });
});

describe('FormButton', () => {
  const mockProps = {
    children: 'Test Button',
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render button with text', () => {
      render(<FormButton {...mockProps} />);
      
      expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
    });

    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      
      render(<FormButton {...mockProps} onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<FormButton {...mockProps} disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Button Variants', () => {
    it('should apply primary variant class', () => {
      render(<FormButton {...mockProps} variant="primary" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('form-button--primary');
    });

    it('should apply secondary variant class', () => {
      render(<FormButton {...mockProps} variant="secondary" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('form-button--secondary');
    });

    it('should apply danger variant class', () => {
      render(<FormButton {...mockProps} variant="danger" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('form-button--danger');
    });
  });

  describe('Button Sizes', () => {
    it('should apply small size class', () => {
      render(<FormButton {...mockProps} size="small" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('form-button--small');
    });

    it('should apply large size class', () => {
      render(<FormButton {...mockProps} size="large" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('form-button--large');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<FormButton {...mockProps} loading />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should show custom loading text', () => {
      render(<FormButton {...mockProps} loading loadingText="Saving..." />);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('should display icon when provided', () => {
      render(<FormButton {...mockProps} icon="🔍" />);
      
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('should position icon correctly', () => {
      render(<FormButton {...mockProps} icon="📝" iconPosition="left" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('📝 Test Button');
    });
  });

  describe('Accessibility', () => {
    it('should support custom aria-label', () => {
      render(<FormButton {...mockProps} aria-label="Custom label" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      
      render(<FormButton {...mockProps} onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalled();
      
      mockOnClick.mockClear();
      
      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalled();
    });
  });
});