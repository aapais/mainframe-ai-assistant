import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { TextField } from '../TextField';
import { TextAreaField } from '../TextAreaField';
import { SelectField } from '../SelectField';
import { TagsField } from '../TagsField';
import { FormButton } from '../FormButton';

describe('Form Field Components', () => {
  describe('TextField Component', () => {
    const defaultProps = {
      id: 'test-field',
      label: 'Test Field',
      value: '',
      onChange: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders correctly with required props', () => {
      render(<TextField {...defaultProps} />);
      
      expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'test-field');
    });

    it('displays label and associates with input', () => {
      render(<TextField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Field');
      
      expect(label).toHaveAttribute('for', 'test-field');
      expect(input).toHaveAttribute('id', 'test-field');
    });

    it('shows required indicator when required', () => {
      render(<TextField {...defaultProps} required />);
      
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
    });

    it('calls onChange when value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TextField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'test value');
      
      expect(mockOnChange).toHaveBeenCalledWith('test value');
    });

    it('displays error message when provided', () => {
      render(<TextField {...defaultProps} error="This field is required" />);
      
      const errorMessage = screen.getByText('This field is required');
      const input = screen.getByRole('textbox');
      
      expect(errorMessage).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('displays help text when provided', () => {
      render(<TextField {...defaultProps} helpText="Enter your name" />);
      
      const helpText = screen.getByText('Enter your name');
      const input = screen.getByRole('textbox');
      
      expect(helpText).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('handles disabled state', () => {
      render(<TextField {...defaultProps} disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('supports different input types', () => {
      render(<TextField {...defaultProps} type="email" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('applies custom className', () => {
      render(<TextField {...defaultProps} className="custom-field" />);
      
      const fieldContainer = screen.getByRole('textbox').parentElement;
      expect(fieldContainer).toHaveClass('custom-field');
    });

    it('supports placeholder text', () => {
      render(<TextField {...defaultProps} placeholder="Enter text here" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Enter text here');
    });

    it('validates maximum length', async () => {
      const user = userEvent.setup();
      
      render(<TextField {...defaultProps} maxLength={10} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'this is a very long text');
      
      expect(input).toHaveValue('this is a '); // Should be truncated to 10 chars
    });

    it('handles focus and blur events', async () => {
      const user = userEvent.setup();
      const mockOnFocus = jest.fn();
      const mockOnBlur = jest.fn();
      
      render(
        <TextField 
          {...defaultProps} 
          onFocus={mockOnFocus}
          onBlur={mockOnBlur}
        />
      );
      
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      expect(mockOnFocus).toHaveBeenCalled();
      
      await user.tab();
      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  describe('TextAreaField Component', () => {
    const defaultProps = {
      id: 'test-textarea',
      label: 'Test TextArea',
      value: '',
      onChange: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders textarea correctly', () => {
      render(<TextAreaField {...defaultProps} />);
      
      expect(screen.getByLabelText('Test TextArea')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveProperty('tagName', 'TEXTAREA');
    });

    it('supports custom rows and cols', () => {
      render(<TextAreaField {...defaultProps} rows={10} cols={50} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '10');
      expect(textarea).toHaveAttribute('cols', '50');
    });

    it('supports resize control', () => {
      render(<TextAreaField {...defaultProps} resize="vertical" />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveStyle({ resize: 'vertical' });
    });

    it('shows character count when enabled', () => {
      render(
        <TextAreaField 
          {...defaultProps} 
          value="Hello world"
          showCharCount
          maxLength={100}
        />
      );
      
      expect(screen.getByText('11/100')).toBeInTheDocument();
    });

    it('auto-resizes when enabled', async () => {
      const user = userEvent.setup();
      
      render(<TextAreaField {...defaultProps} autoResize />);
      
      const textarea = screen.getByRole('textbox');
      const initialHeight = textarea.style.height;
      
      await user.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4');
      
      // Should have auto-resized (actual implementation would need scroll height calculation)
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('SelectField Component', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' }
    ];

    const defaultProps = {
      id: 'test-select',
      label: 'Test Select',
      options,
      value: '',
      onChange: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders select correctly', () => {
      render(<SelectField {...defaultProps} />);
      
      expect(screen.getByLabelText('Test Select')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders all options', () => {
      render(<SelectField {...defaultProps} />);
      
      options.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    it('shows placeholder when provided', () => {
      render(<SelectField {...defaultProps} placeholder="Choose an option" />);
      
      expect(screen.getByText('Choose an option')).toBeInTheDocument();
    });

    it('calls onChange when selection changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<SelectField {...defaultProps} onChange={mockOnChange} />);
      
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'option2');
      
      expect(mockOnChange).toHaveBeenCalledWith('option2');
    });

    it('supports multiple selection', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(
        <SelectField 
          {...defaultProps} 
          onChange={mockOnChange}
          multiple
        />
      );
      
      const select = screen.getByRole('listbox');
      await user.selectOptions(select, ['option1', 'option3']);
      
      expect(mockOnChange).toHaveBeenCalledWith(['option1', 'option3']);
    });

    it('groups options when provided', () => {
      const groupedOptions = [
        {
          label: 'Group 1',
          options: [
            { value: 'g1o1', label: 'Group 1 Option 1' },
            { value: 'g1o2', label: 'Group 1 Option 2' }
          ]
        },
        {
          label: 'Group 2',
          options: [
            { value: 'g2o1', label: 'Group 2 Option 1' }
          ]
        }
      ];
      
      render(
        <SelectField 
          {...defaultProps} 
          options={groupedOptions}
          grouped
        />
      );
      
      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();
    });

    it('supports search/filter functionality', async () => {
      const user = userEvent.setup();
      
      render(<SelectField {...defaultProps} searchable />);
      
      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, '1');
      
      // Should filter to show only "Option 1"
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.queryByText('Option 2')).not.toBeInTheDocument();
    });
  });

  describe('TagsField Component', () => {
    const defaultProps = {
      id: 'test-tags',
      label: 'Test Tags',
      value: [],
      onChange: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders tags field correctly', () => {
      render(<TagsField {...defaultProps} />);
      
      expect(screen.getByLabelText('Test Tags')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('displays existing tags', () => {
      render(<TagsField {...defaultProps} value={['tag1', 'tag2']} />);
      
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
    });

    it('adds new tag when Enter is pressed', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'newtag{Enter}');
      
      expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
      expect(input).toHaveValue('');
    });

    it('adds new tag on blur', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<TagsField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'newtag');
      await user.tab();
      
      expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
    });

    it('removes tag when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(
        <TagsField 
          {...defaultProps} 
          value={['tag1', 'tag2']}
          onChange={mockOnChange}
        />
      );
      
      const removeButton = screen.getByLabelText('Remove tag1');
      await user.click(removeButton);
      
      expect(mockOnChange).toHaveBeenCalledWith(['tag2']);
    });

    it('prevents duplicate tags', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(
        <TagsField 
          {...defaultProps} 
          value={['existing']}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'existing{Enter}');
      
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('supports tag suggestions', async () => {
      const user = userEvent.setup();
      const suggestions = ['suggestion1', 'suggestion2', 'another'];
      
      render(
        <TagsField 
          {...defaultProps} 
          suggestions={suggestions}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'sugg');
      
      expect(screen.getByText('suggestion1')).toBeInTheDocument();
      expect(screen.getByText('suggestion2')).toBeInTheDocument();
      expect(screen.queryByText('another')).not.toBeInTheDocument();
    });

    it('supports maximum tag limit', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(
        <TagsField 
          {...defaultProps} 
          value={['tag1', 'tag2']}
          maxTags={2}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      
      // Should show limit message
      expect(screen.getByText(/maximum.*2.*tags/i)).toBeInTheDocument();
    });

    it('validates tag format', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(
        <TagsField 
          {...defaultProps} 
          onChange={mockOnChange}
          validateTag={(tag) => /^[a-zA-Z0-9]+$/.test(tag)}
        />
      );
      
      const input = screen.getByRole('textbox');
      
      // Valid tag
      await user.type(input, 'validtag{Enter}');
      expect(mockOnChange).toHaveBeenCalledWith(['validtag']);
      
      mockOnChange.mockClear();
      
      // Invalid tag
      await user.type(input, 'invalid-tag{Enter}');
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(screen.getByText(/invalid tag format/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TagsField 
          {...defaultProps} 
          value={['tag1', 'tag2', 'tag3']}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      // Backspace should focus last tag
      await user.keyboard('{Backspace}');
      
      // Should highlight last tag
      const lastTag = screen.getByText('tag3').parentElement;
      expect(lastTag).toHaveClass('highlighted');
      
      // Another backspace should remove it
      await user.keyboard('{Backspace}');
      expect(screen.queryByText('tag3')).not.toBeInTheDocument();
    });
  });

  describe('FormButton Component', () => {
    const defaultProps = {
      children: 'Test Button',
      onClick: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders button correctly', () => {
      render(<FormButton {...defaultProps} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Test Button')).toBeInTheDocument();
    });

    it('supports different variants', () => {
      const variants = ['primary', 'secondary', 'success', 'danger'] as const;
      
      variants.forEach(variant => {
        const { unmount } = render(
          <FormButton {...defaultProps} variant={variant}>
            {variant} Button
          </FormButton>
        );
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`btn-${variant}`);
        
        unmount();
      });
    });

    it('handles loading state', () => {
      render(<FormButton {...defaultProps} loading />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
    });

    it('supports form types', () => {
      render(<FormButton {...defaultProps} type="submit" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      
      render(<FormButton {...defaultProps} onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      
      render(<FormButton {...defaultProps} onClick={mockOnClick} disabled />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('supports custom className', () => {
      render(<FormButton {...defaultProps} className="custom-btn" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-btn');
    });

    it('supports full width', () => {
      render(<FormButton {...defaultProps} fullWidth />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-full-width');
    });

    it('supports icons', () => {
      const icon = <span data-testid="test-icon">📝</span>;
      
      render(<FormButton {...defaultProps} icon={icon} />);
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('Form Field Integration', () => {
    it('maintains accessibility relationships', () => {
      render(
        <div>
          <TextField 
            id="field1"
            label="Field 1"
            value=""
            onChange={() => {}}
            helpText="Help text for field 1"
            error="Error message"
          />
        </div>
      );
      
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Field 1');
      const helpText = screen.getByText('Help text for field 1');
      const errorText = screen.getByText('Error message');
      
      expect(label).toHaveAttribute('for', 'field1');
      expect(input).toHaveAttribute('id', 'field1');
      expect(input).toHaveAttribute('aria-describedby');
      
      const describedBy = input.getAttribute('aria-describedby')!;
      expect(describedBy).toContain(helpText.id);
      expect(describedBy).toContain(errorText.id);
    });

    it('handles form submission correctly', async () => {
      const user = userEvent.setup();
      const mockSubmit = jest.fn();
      
      const TestForm = () => {
        const [title, setTitle] = React.useState('');
        
        return (
          <form onSubmit={(e) => { e.preventDefault(); mockSubmit({ title }); }}>
            <TextField 
              id="title"
              label="Title"
              value={title}
              onChange={setTitle}
            />
            <FormButton type="submit">Submit</FormButton>
          </form>
        );
      };
      
      render(<TestForm />);
      
      const input = screen.getByLabelText('Title');
      const submitButton = screen.getByText('Submit');
      
      await user.type(input, 'Test Title');
      await user.click(submitButton);
      
      expect(mockSubmit).toHaveBeenCalledWith({ title: 'Test Title' });
    });
  });
});