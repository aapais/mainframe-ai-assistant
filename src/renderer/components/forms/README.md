# Enhanced Form Components Documentation

## Overview

This directory contains a comprehensive set of form components designed specifically for the Mainframe KB Assistant. These components provide robust validation, accessibility, UX optimizations, and advanced features like auto-save and draft management.

## Architecture

### Core Components

```
forms/
├── KBEntryForm.tsx          # Main form for creating/editing KB entries
├── EditEntryForm.tsx        # Specialized form for editing with comparison features
├── KBEntryForm.css          # Styles for the main form
└── EditEntryForm.css        # Styles for the edit form

common/
├── FormField.tsx            # Reusable form field components
├── FormField.css            # Form field styles
└── Button.tsx               # Button component (existing)

hooks/
└── useForm.ts               # Advanced form state management hook

utils/
└── validation.ts            # Validation rules and utilities

types/
└── form.ts                  # Type definitions
```

### Key Features

1. **Advanced Validation System**
   - Schema-based validation with TypeScript support
   - Real-time validation with debouncing
   - Built-in rules for KB-specific data
   - Custom validation rule support

2. **Accessibility (ARIA)**
   - Comprehensive screen reader support
   - Keyboard navigation
   - Focus management
   - High contrast mode support

3. **UX Optimizations**
   - Auto-save functionality
   - Draft management
   - Character counting
   - Error summaries with quick navigation
   - Loading states and progress indicators

4. **Form Features**
   - Auto-resizing text areas
   - Tag management with validation
   - Advanced options toggle
   - Keyboard shortcuts
   - Change comparison (edit mode)

## Usage Examples

### Basic KBEntryForm

```tsx
import { KBEntryForm } from './components/forms/KBEntryForm';

function AddEntryModal() {
  const handleSubmit = async (data) => {
    const response = await window.electronAPI.addKBEntry(data);
    console.log('Entry created:', response);
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <KBEntryForm
      mode="create"
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      autoSave={true}
      enableDrafts={true}
      showAdvancedOptions={true}
    />
  );
}
```

### EditEntryForm with Advanced Features

```tsx
import { EditEntryForm } from './components/forms/EditEntryForm';

function EditEntryModal({ entry }) {
  const handleSubmit = async (updates) => {
    await window.electronAPI.updateKBEntry(entry.id, updates);
  };

  const handleArchive = async (entryId) => {
    await window.electronAPI.archiveKBEntry(entryId);
  };

  const handleDuplicate = async (originalEntry) => {
    const newEntry = {
      ...originalEntry,
      title: `Copy of ${originalEntry.title}`,
      id: undefined
    };
    await window.electronAPI.addKBEntry(newEntry);
  };

  return (
    <EditEntryForm
      entry={entry}
      onSubmit={handleSubmit}
      onCancel={() => setShowModal(false)}
      onArchive={handleArchive}
      onDuplicate={handleDuplicate}
      autoSave={true}
      showComparison={true}
      showAdvancedActions={true}
    />
  );
}
```

### Custom Form with useForm Hook

```tsx
import { useForm } from '../../hooks/useForm';
import { TextField, TextAreaField, SelectField } from '../common/FormField';
import { createKBEntryValidationSchema } from '../../utils/validation';

function CustomForm() {
  const form = useForm({
    initialValues: {
      title: '',
      problem: '',
      solution: '',
      category: 'Other',
      tags: []
    },
    validationSchema: createKBEntryValidationSchema('create'),
    onSubmit: async (data) => {
      console.log('Submitting:', data);
    },
    autoSave: true,
    enableDrafts: true
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <TextField
        {...form.getFieldProps('title')}
        label="Title"
        required
        maxLength={200}
        showCharacterCount
        error={form.getFieldError('title')}
      />
      
      <TextAreaField
        {...form.getFieldProps('problem')}
        label="Problem"
        required
        autoResize
        error={form.getFieldError('problem')}
      />

      <button 
        type="submit" 
        disabled={!form.isValid || form.isSubmitting}
      >
        {form.isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

## Validation System

### Built-in Validation Rules

```tsx
import { ValidationRules } from '../../utils/validation';

// Basic validation rules
ValidationRules.required('This field is required')
ValidationRules.minLength(10, 'Must be at least 10 characters')
ValidationRules.maxLength(200, 'Must be less than 200 characters')
ValidationRules.pattern(/^[A-Z]\d{3}$/, 'Must match pattern: A123')
ValidationRules.email('Please enter a valid email')

// KB-specific rules
ValidationRules.kbTitle()      // Validates KB entry titles
ValidationRules.kbProblem()    // Validates problem descriptions
ValidationRules.kbSolution()   // Validates solution text
ValidationRules.kbTags()       // Validates tag arrays
```

### Custom Validation Schema

```tsx
import { createKBEntryValidationSchema } from '../../utils/validation';

// Create schema for create mode
const createSchema = createKBEntryValidationSchema('create');

// Create schema for edit mode
const editSchema = createKBEntryValidationSchema('edit');

// Custom schema
const customSchema = {
  title: [
    ValidationRules.required(),
    ValidationRules.minLength(10),
    ValidationRules.maxLength(200)
  ],
  category: ValidationRules.required('Please select a category'),
  tags: ValidationRules.arrayMinLength(1, 'At least one tag is required')
};
```

## Accessibility Features

### ARIA Support
- All form fields have proper `aria-label`, `aria-describedby`, and `aria-invalid` attributes
- Error messages are announced to screen readers via `role="alert"`
- Form sections have proper heading structure
- Loading states are announced

### Keyboard Navigation
- Tab order follows logical flow
- All interactive elements are keyboard accessible
- Keyboard shortcuts are implemented:
  - `Ctrl+S` or `Ctrl+Enter` - Submit form
  - `Ctrl+D` - Save draft
  - `Escape` - Cancel
  - `Enter` in tag field - Add tag

### Focus Management
- Auto-focus on first field for create forms
- Focus management on validation errors
- Focus trapping in modal forms
- Visible focus indicators

## Auto-save and Drafts

### Auto-save Configuration

```tsx
<KBEntryForm
  autoSave={true}           // Enable auto-save
  autoSaveDelay={2000}      // Save after 2 seconds of inactivity
  enableDrafts={true}       // Enable draft storage
  onAutoSave={handleAutoSave}  // Optional callback
/>
```

### Draft Management

```tsx
// The useForm hook automatically handles drafts
const form = useForm({
  enableDrafts: true,
  draftKey: 'kb-entry-create-unique-id', // Unique key for this form
  // ... other options
});

// Manual draft operations
form.saveDraft();         // Save current form state
form.loadDraft();         // Load saved draft
form.clearDraft();        // Clear saved draft
const hasDraft = form.hasDraft;  // Check if draft exists
```

## Styling and Theming

### CSS Custom Properties

The components use CSS custom properties for theming:

```css
:root {
  /* Colors */
  --primary-500: #3b82f6;
  --primary-100: #dbeafe;
  --error-500: #ef4444;
  --error-50: #fef2f2;
  --success-500: #10b981;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --border-300: #d1d5db;
  --bg-white: #ffffff;
  
  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
}
```

### Responsive Design

All components are fully responsive with mobile-first design:

- Desktop: Full features and side-by-side layouts
- Tablet: Simplified layouts with maintained functionality
- Mobile: Stacked layouts with touch-friendly controls

## Error Handling

### Client-side Validation

```tsx
// Real-time validation with debouncing
const form = useForm({
  validateOnChange: true,  // Validate on every change
  validateOnBlur: true,    // Validate when field loses focus
  validationSchema: schema
});

// Manual validation
const isValid = await form.validateForm();
const fieldError = await form.validateField('title');
```

### Server-side Error Handling

```tsx
const handleSubmit = async (data) => {
  try {
    await window.electronAPI.addKBEntry(data);
  } catch (error) {
    if (error.code === 'DUPLICATE_TITLE') {
      form.setFieldError('title', 'An entry with this title already exists');
    } else if (error.code === 'VALIDATION_ERROR') {
      // Set multiple field errors
      Object.entries(error.fieldErrors).forEach(([field, message]) => {
        form.setFieldError(field, message);
      });
    } else {
      // Generic error handling
      onError?.(error);
    }
  }
};
```

## Testing

### Unit Tests

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KBEntryForm } from './KBEntryForm';

describe('KBEntryForm', () => {
  const mockProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    mode: 'create'
  };

  test('validates required fields', async () => {
    render(<KBEntryForm {...mockProps} />);
    
    const submitButton = screen.getByRole('button', { name: /add entry/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(screen.getByText('Problem description is required')).toBeInTheDocument();
    });
  });

  test('handles auto-save functionality', async () => {
    const mockAutoSave = jest.fn();
    render(
      <KBEntryForm 
        {...mockProps} 
        autoSave={true}
        onAutoSave={mockAutoSave}
      />
    );
    
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Test title' } });
    
    await waitFor(() => {
      expect(mockAutoSave).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
```

### Integration Tests

```tsx
describe('Form Integration', () => {
  test('complete form submission flow', async () => {
    const mockSubmit = jest.fn();
    render(<KBEntryForm onSubmit={mockSubmit} mode="create" />);
    
    // Fill out form
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'VSAM Status 35 Error' }
    });
    fireEvent.change(screen.getByLabelText('Problem Description'), {
      target: { value: 'Job fails with VSAM status code 35 when accessing file' }
    });
    fireEvent.change(screen.getByLabelText('Solution'), {
      target: { value: '1. Check if file exists\n2. Verify cataloging' }
    });
    
    // Add tag
    const tagInput = screen.getByPlaceholderText('Add a tag...');
    fireEvent.change(tagInput, { target: { value: 'vsam' } });
    fireEvent.keyPress(tagInput, { key: 'Enter' });
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /add entry/i }));
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        title: 'VSAM Status 35 Error',
        problem: 'Job fails with VSAM status code 35 when accessing file',
        solution: '1. Check if file exists\n2. Verify cataloging',
        category: 'Other',
        severity: 'medium',
        tags: ['vsam']
      });
    });
  });
});
```

### Accessibility Tests

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('form has no accessibility violations', async () => {
  const { container } = render(<KBEntryForm {...mockProps} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Performance Considerations

### Optimization Strategies

1. **Debounced Validation**: Validation is debounced by 300ms to prevent excessive re-renders
2. **Memoized Components**: Form fields use React.memo to prevent unnecessary re-renders
3. **Lazy Loading**: Advanced options are only rendered when expanded
4. **Efficient Updates**: Only changed fields trigger updates

### Bundle Size

The form components are designed to be tree-shakeable:

```tsx
// Import only what you need
import { TextField } from './components/common/FormField';
import { ValidationRules } from './utils/validation';
```

## Browser Support

- **Modern browsers**: Full feature support (Chrome 88+, Firefox 78+, Safari 14+)
- **Older browsers**: Graceful degradation with polyfills
- **Mobile browsers**: Touch-optimized interactions

## Contributing

### Adding New Validation Rules

1. Add rule to `ValidationRules` object in `validation.ts`
2. Add TypeScript types to `form.ts`
3. Write unit tests for the new rule
4. Update documentation

### Adding New Field Types

1. Create component in `FormField.tsx`
2. Add props interface to `form.ts`
3. Export component from main file
4. Add CSS styles
5. Write tests and documentation

### Best Practices

- Always provide TypeScript types
- Include accessibility attributes
- Support keyboard navigation
- Test with screen readers
- Include error boundaries
- Document complex features
- Follow existing patterns

## Troubleshooting

### Common Issues

1. **Validation not triggering**: Check that validation schema is properly defined
2. **Auto-save not working**: Ensure `isDirty` state is properly managed
3. **Accessibility warnings**: Verify all form fields have proper labels and ARIA attributes
4. **Performance issues**: Check for unnecessary re-renders using React DevTools

### Debug Mode

Enable debug logging:

```tsx
localStorage.setItem('KB_FORM_DEBUG', 'true');
```

This will log form state changes and validation events to the console.