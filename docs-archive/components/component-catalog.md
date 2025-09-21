# Component Catalog

## Overview

This catalog provides a comprehensive visual showcase of all components in the Mainframe KB Assistant component library. Each component is documented with interactive examples, accessibility features, performance characteristics, and usage guidelines.

---

## Foundation Components

### Button

**Purpose**: Primary action component with multiple variants and states

#### Visual Showcase

```jsx
// Primary Button
<Button variant="primary" size="md">
  Primary Action
</Button>

// Secondary Button
<Button variant="secondary" size="md">
  Secondary Action
</Button>

// Outline Button
<Button variant="outline" size="md">
  Outline Action
</Button>

// Ghost Button
<Button variant="ghost" size="md">
  Ghost Action
</Button>

// Danger Button
<Button variant="danger" size="md">
  Delete Item
</Button>

// Success Button
<Button variant="success" size="md">
  Save Changes
</Button>
```

#### Size Variations

```jsx
<Button variant="primary" size="xs">Extra Small</Button>
<Button variant="primary" size="sm">Small</Button>
<Button variant="primary" size="md">Medium</Button>
<Button variant="primary" size="lg">Large</Button>
<Button variant="primary" size="xl">Extra Large</Button>
```

#### State Variations

```jsx
// Loading State
<Button loading={true} variant="primary">
  Saving...
</Button>

// Disabled State
<Button disabled={true} variant="primary">
  Disabled Button
</Button>

// With Icons
<Button variant="primary" startIcon={<PlusIcon />}>
  Add Item
</Button>

<Button variant="outline" endIcon={<ArrowIcon />}>
  Continue
</Button>
```

#### Accessibility Features
- ✅ **Keyboard Navigation**: Enter and Space key activation
- ✅ **Screen Reader**: Proper ARIA labels and state announcements
- ✅ **Focus Management**: High-contrast focus indicators
- ✅ **Loading States**: Accessible loading indication with spinner
- ✅ **Color Contrast**: All variants meet WCAG AA requirements

#### Performance Characteristics
- **Bundle Size**: 2.1KB gzipped
- **Render Time**: < 1ms average
- **Memory Usage**: Minimal heap allocation
- **Tree Shaking**: Fully supported

#### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

### Input

**Purpose**: Text input component with validation and accessibility features

#### Visual Showcase

```jsx
// Basic Input
<Input
  placeholder="Enter text..."
  value={value}
  onChange={setValue}
/>

// Input with Label
<FormField label="Username" required>
  <Input
    type="text"
    placeholder="john.doe"
    value={username}
    onChange={setUsername}
  />
</FormField>

// Input with Error
<FormField
  label="Email"
  error="Please enter a valid email address"
  required
>
  <Input
    type="email"
    value={email}
    onChange={setEmail}
    aria-invalid={!!error}
  />
</FormField>

// Input with Help Text
<FormField
  label="Password"
  helpText="Must be at least 8 characters"
  required
>
  <Input
    type="password"
    value={password}
    onChange={setPassword}
  />
</FormField>
```

#### Input Types

```jsx
// Text Input
<Input type="text" placeholder="Text input" />

// Email Input
<Input type="email" placeholder="email@example.com" />

// Password Input
<Input type="password" placeholder="Password" />

// Number Input
<Input type="number" placeholder="Enter number" />

// Search Input
<Input type="search" placeholder="Search..." />

// URL Input
<Input type="url" placeholder="https://example.com" />
```

#### Accessibility Features
- ✅ **Label Association**: Proper label-to-input linking
- ✅ **Error Handling**: ARIA error descriptions
- ✅ **Help Text**: Associated help text via aria-describedby
- ✅ **Validation States**: Clear invalid/valid indication
- ✅ **Required Fields**: Proper required field indication

---

### Select

**Purpose**: Dropdown selection component with keyboard navigation

#### Visual Showcase

```jsx
// Basic Select
<Select
  options={[
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' }
  ]}
  value={selectedOption}
  onChange={setSelectedOption}
  placeholder="Choose an option"
/>

// Select with Groups
<Select
  options={[
    {
      label: 'Fruits',
      options: [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' }
      ]
    },
    {
      label: 'Vegetables',
      options: [
        { value: 'carrot', label: 'Carrot' },
        { value: 'broccoli', label: 'Broccoli' }
      ]
    }
  ]}
  value={selectedItem}
  onChange={setSelectedItem}
/>

// Multi-Select
<Select
  multiple
  options={categoryOptions}
  value={selectedCategories}
  onChange={setSelectedCategories}
  placeholder="Select categories"
/>
```

#### Accessibility Features
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Escape support
- ✅ **Screen Reader**: Proper combobox/listbox semantics
- ✅ **Focus Management**: Focus handling in dropdown
- ✅ **Type-ahead**: Letter key navigation
- ✅ **State Announcements**: Selection and expansion announcements

---

### TextArea

**Purpose**: Multi-line text input with auto-resize functionality

#### Visual Showcase

```jsx
// Basic TextArea
<TextArea
  placeholder="Enter detailed description..."
  value={description}
  onChange={setDescription}
  rows={4}
/>

// Auto-resizing TextArea
<TextArea
  placeholder="This will grow with your content..."
  value={content}
  onChange={setContent}
  autoResize
  minRows={3}
  maxRows={10}
/>

// TextArea with Character Count
<FormField label="Description" helpText={`${description.length}/500 characters`}>
  <TextArea
    value={description}
    onChange={setDescription}
    maxLength={500}
    placeholder="Describe the issue..."
  />
</FormField>
```

#### Accessibility Features
- ✅ **Resizable**: Respects user resize preferences
- ✅ **Character Limits**: Announced to screen readers
- ✅ **Auto-resize**: Maintains focus during resize
- ✅ **Label Association**: Proper form field integration

---

## Layout Components

### WindowLayout

**Purpose**: Multi-window layout manager for desktop-style applications

#### Visual Showcase

```jsx
const windows = [
  {
    id: 'search',
    title: 'Knowledge Base Search',
    component: <SearchWindow />,
    defaultSize: { width: 400, height: 300 },
    defaultPosition: { x: 50, y: 50 }
  },
  {
    id: 'details',
    title: 'Entry Details',
    component: <DetailsWindow />,
    defaultSize: { width: 600, height: 400 },
    defaultPosition: { x: 500, y: 100 }
  },
  {
    id: 'metrics',
    title: 'Metrics Dashboard',
    component: <MetricsWindow />,
    defaultSize: { width: 500, height: 350 },
    defaultPosition: { x: 200, y: 200 }
  }
];

<WindowLayout
  windows={windows}
  activeWindow="search"
  onWindowChange={setActiveWindow}
  allowResize
  allowMove
  allowMinimize
/>
```

#### Window Features

```jsx
// Minimizable Windows
<WindowLayout
  windows={windows}
  features={{
    resize: true,
    move: true,
    minimize: true,
    maximize: true,
    close: true
  }}
/>

// Tabbed Interface
<WindowTabs
  tabs={[
    { id: 'search', label: 'Search', content: <SearchComponent /> },
    { id: 'results', label: 'Results', content: <ResultsComponent /> },
    { id: 'details', label: 'Details', content: <DetailsComponent /> }
  ]}
  activeTab="search"
  onTabChange={setActiveTab}
/>
```

#### Accessibility Features
- ✅ **Keyboard Navigation**: Full keyboard window management
- ✅ **Focus Management**: Proper focus containment within windows
- ✅ **ARIA Roles**: Dialog/window pattern implementation
- ✅ **Screen Reader**: Window state announcements
- ✅ **Tab Navigation**: Logical tab order between windows

---

### WindowTabs

**Purpose**: Tabbed interface component with keyboard navigation

#### Visual Showcase

```jsx
// Basic Tabs
<WindowTabs
  tabs={[
    { id: 'overview', label: 'Overview', content: <OverviewPanel /> },
    { id: 'details', label: 'Details', content: <DetailsPanel /> },
    { id: 'history', label: 'History', content: <HistoryPanel /> }
  ]}
  activeTab="overview"
  onTabChange={handleTabChange}
/>

// Tabs with Icons
<WindowTabs
  tabs={[
    {
      id: 'search',
      label: 'Search',
      icon: <SearchIcon />,
      content: <SearchPanel />
    },
    {
      id: 'favorites',
      label: 'Favorites',
      icon: <HeartIcon />,
      content: <FavoritesPanel />
    }
  ]}
  activeTab="search"
  onTabChange={handleTabChange}
/>

// Vertical Tabs
<WindowTabs
  orientation="vertical"
  tabs={navigationTabs}
  activeTab={currentTab}
  onTabChange={setCurrentTab}
/>
```

#### Accessibility Features
- ✅ **Keyboard Navigation**: Arrow keys for tab navigation
- ✅ **Tab Panel Association**: Proper ARIA relationships
- ✅ **Focus Management**: Home/End key support
- ✅ **Screen Reader**: Tab state announcements

---

## Feedback Components

### AlertMessage

**Purpose**: Alert notifications with ARIA live regions and multiple styles

#### Visual Showcase

```jsx
// Basic Alerts
<AlertMessage
  severity="info"
  message="Information message for user awareness"
/>

<AlertMessage
  severity="success"
  message="Operation completed successfully!"
/>

<AlertMessage
  severity="warning"
  title="Warning"
  message="Please review the following items before proceeding"
/>

<AlertMessage
  severity="error"
  title="Error"
  message="Unable to save changes. Please try again."
  dismissible
  onDismiss={handleDismiss}
/>
```

#### Alert Styles

```jsx
// Inline Alert (default)
<AlertMessage
  alertStyle="inline"
  severity="info"
  message="This is an inline alert message"
/>

// Banner Alert
<AlertMessage
  alertStyle="banner"
  severity="warning"
  message="System maintenance scheduled for tonight"
/>

// Toast Alert
<AlertMessage
  alertStyle="toast"
  severity="success"
  message="Settings saved successfully"
  autoDismiss={5000}
/>

// Modal Alert
<AlertMessage
  alertStyle="modal"
  severity="error"
  title="Confirm Deletion"
  message="Are you sure you want to delete this entry? This action cannot be undone."
  actions={[
    { id: 'confirm', label: 'Delete', onClick: handleDelete, variant: 'danger' },
    { id: 'cancel', label: 'Cancel', onClick: handleCancel, variant: 'ghost' }
  ]}
/>
```

#### Interactive Alerts

```jsx
// Alert with Actions
<AlertMessage
  severity="warning"
  title="Unsaved Changes"
  message="You have unsaved changes. Would you like to save before leaving?"
  actions={[
    {
      id: 'save',
      label: 'Save Changes',
      onClick: handleSave,
      variant: 'primary',
      autoFocus: true
    },
    {
      id: 'discard',
      label: 'Discard',
      onClick: handleDiscard,
      variant: 'danger'
    },
    {
      id: 'cancel',
      label: 'Cancel',
      onClick: handleCancel,
      variant: 'ghost'
    }
  ]}
/>

// Auto-dismissing Alert
<AlertMessage
  severity="success"
  message="File uploaded successfully"
  autoDismiss={3000}
  dismissible
  onDismiss={handleDismiss}
/>
```

#### Accessibility Features
- ✅ **ARIA Live Regions**: Automatic announcements based on severity
- ✅ **Role Management**: Appropriate roles (alert, status, alertdialog)
- ✅ **Keyboard Navigation**: Full keyboard support for actions
- ✅ **Focus Management**: Proper focus handling for modal alerts
- ✅ **Screen Reader**: Complete screen reader integration

#### Toast Notifications

```jsx
// Programmatic Toast Usage
import { showToast } from '@mainframe-kb/components';

// Success Toast
showToast({
  severity: 'success',
  message: 'Entry saved successfully!',
  position: 'top-right',
  autoDismiss: 5000
});

// Error Toast with Action
showToast({
  severity: 'error',
  title: 'Save Failed',
  message: 'Unable to save entry. Check your connection.',
  actions: [
    { id: 'retry', label: 'Retry', onClick: retrySave }
  ],
  position: 'top-center'
});
```

---

### LoadingIndicator

**Purpose**: Loading states with accessibility support

#### Visual Showcase

```jsx
// Basic Loading Spinner
<LoadingIndicator size="md" />

// Loading with Label
<LoadingIndicator
  size="lg"
  label="Loading knowledge base entries..."
/>

// Inline Loading
<Button loading={isLoading} variant="primary">
  {isLoading ? 'Saving...' : 'Save Entry'}
</Button>

// Skeleton Loading
<SkeletonLoader>
  <div className="space-y-4">
    <SkeletonLoader.Line width="75%" />
    <SkeletonLoader.Line width="50%" />
    <SkeletonLoader.Line width="90%" />
  </div>
</SkeletonLoader>
```

#### Loading States

```jsx
// Progress Indicator
<LoadingIndicator
  type="progress"
  progress={75}
  label="Processing entries: 75/100"
/>

// Determinate Progress
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Uploading file...</span>
    <span>{Math.round(progress)}%</span>
  </div>
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-blue-600 h-2 rounded-full transition-all"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  </div>
</div>
```

#### Accessibility Features
- ✅ **Status Announcements**: Loading state changes announced
- ✅ **Progress Updates**: Progress value announcements
- ✅ **ARIA Labels**: Descriptive loading labels
- ✅ **Reduced Motion**: Respects prefers-reduced-motion

---

## Form Components

### FormField

**Purpose**: Wrapper component providing consistent layout and accessibility

#### Visual Showcase

```jsx
// Basic Form Field
<FormField label="Title" required>
  <Input
    value={title}
    onChange={setTitle}
    placeholder="Enter title"
  />
</FormField>

// Field with Help Text
<FormField
  label="Category"
  helpText="Select the most appropriate category"
  required
>
  <Select
    options={categoryOptions}
    value={category}
    onChange={setCategory}
  />
</FormField>

// Field with Error
<FormField
  label="Description"
  error="Description is required and must be at least 10 characters"
  required
>
  <TextArea
    value={description}
    onChange={setDescription}
    aria-invalid={!!error}
  />
</FormField>

// Optional Field
<FormField label="Tags" optional>
  <TagsField
    value={tags}
    onChange={setTags}
    placeholder="Add tags..."
  />
</FormField>
```

#### Complex Form Layout

```jsx
<form onSubmit={handleSubmit}>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <FormField label="Problem Title" required>
      <Input
        value={problem.title}
        onChange={(value) => setProblem({...problem, title: value})}
        placeholder="Brief description of the problem"
      />
    </FormField>

    <FormField label="Category" required>
      <Select
        options={categories}
        value={problem.category}
        onChange={(value) => setProblem({...problem, category: value})}
      />
    </FormField>

    <FormField
      label="Problem Description"
      helpText="Detailed description of the issue"
      className="md:col-span-2"
      required
    >
      <TextArea
        value={problem.description}
        onChange={(value) => setProblem({...problem, description: value})}
        rows={4}
      />
    </FormField>

    <FormField
      label="Solution Steps"
      className="md:col-span-2"
      required
    >
      <TextArea
        value={problem.solution}
        onChange={(value) => setProblem({...problem, solution: value})}
        rows={6}
        placeholder="Step-by-step solution..."
      />
    </FormField>

    <FormField label="Tags" optional className="md:col-span-2">
      <TagsField
        value={problem.tags}
        onChange={(value) => setProblem({...problem, tags: value})}
        placeholder="Add relevant tags..."
      />
    </FormField>
  </div>

  <div className="flex justify-end gap-4 mt-8">
    <Button variant="outline" onClick={handleCancel}>
      Cancel
    </Button>
    <Button
      type="submit"
      variant="primary"
      loading={isSubmitting}
      disabled={!isFormValid}
    >
      Save Entry
    </Button>
  </div>
</form>
```

---

### TagsField

**Purpose**: Tag input with keyboard shortcuts and validation

#### Visual Showcase

```jsx
// Basic Tags Field
<TagsField
  value={tags}
  onChange={setTags}
  placeholder="Type and press Enter to add tags"
/>

// Tags with Suggestions
<TagsField
  value={tags}
  onChange={setTags}
  suggestions={['VSAM', 'JCL', 'DB2', 'COBOL', 'Batch']}
  placeholder="Start typing for suggestions..."
/>

// Tags with Validation
<TagsField
  value={tags}
  onChange={setTags}
  validate={(tag) => tag.length >= 2}
  maxTags={10}
  placeholder="Add up to 10 tags"
/>

// Readonly Tags Display
<TagsField
  value={tags}
  readonly
  variant="display"
/>
```

#### Accessibility Features
- ✅ **Keyboard Navigation**: Enter, Backspace, Arrow keys
- ✅ **Screen Reader**: Tag count and content announcements
- ✅ **Focus Management**: Focus handling during tag manipulation
- ✅ **Validation**: Clear error messaging for invalid tags

---

## Performance Metrics

### Bundle Size Analysis

| Component | Gzipped Size | Dependencies | Tree Shakeable |
|-----------|--------------|--------------|----------------|
| Button | 2.1KB | React | ✅ |
| Input | 1.8KB | React | ✅ |
| Select | 4.2KB | React, Downshift | ✅ |
| AlertMessage | 3.5KB | React | ✅ |
| FormField | 1.2KB | React | ✅ |
| WindowLayout | 8.1KB | React, React-DND | ✅ |
| TagsField | 2.9KB | React | ✅ |
| LoadingIndicator | 0.8KB | React | ✅ |

### Runtime Performance

| Component | Render Time (avg) | Memory Usage | Re-render Optimization |
|-----------|-------------------|--------------|----------------------|
| Button | < 1ms | Minimal | Smart Memo |
| Input | < 1ms | Minimal | Smart Memo |
| Select | 2-5ms | Low | Smart Memo + Virtual |
| AlertMessage | 1-2ms | Minimal | Smart Memo |
| WindowLayout | 10-15ms | Moderate | Smart Memo + RAF |
| TagsField | 2-3ms | Low | Smart Memo |

---

## Design Tokens

### Color System

```scss
// Primary Colors
$primary-50: #eff6ff;
$primary-100: #dbeafe;
$primary-500: #3b82f6;
$primary-600: #2563eb;
$primary-700: #1d4ed8;

// Semantic Colors
$success-50: #f0fdf4;
$success-500: #22c55e;
$success-600: #16a34a;

$warning-50: #fffbeb;
$warning-500: #f59e0b;
$warning-600: #d97706;

$error-50: #fef2f2;
$error-500: #ef4444;
$error-600: #dc2626;

// Neutral Colors
$gray-50: #f9fafb;
$gray-100: #f3f4f6;
$gray-500: #6b7280;
$gray-900: #111827;
```

### Typography Scale

```scss
// Font Sizes
$text-xs: 0.75rem;    // 12px
$text-sm: 0.875rem;   // 14px
$text-base: 1rem;     // 16px
$text-lg: 1.125rem;   // 18px
$text-xl: 1.25rem;    // 20px

// Line Heights
$leading-tight: 1.25;
$leading-normal: 1.5;
$leading-relaxed: 1.625;

// Font Weights
$font-normal: 400;
$font-medium: 500;
$font-semibold: 600;
$font-bold: 700;
```

### Spacing Scale

```scss
// Spacing Scale (based on 4px grid)
$space-0: 0;
$space-1: 0.25rem;  // 4px
$space-2: 0.5rem;   // 8px
$space-3: 0.75rem;  // 12px
$space-4: 1rem;     // 16px
$space-6: 1.5rem;   // 24px
$space-8: 2rem;     // 32px
$space-12: 3rem;    // 48px
$space-16: 4rem;    // 64px
```

---

## Component Composition Patterns

### Layout Composition

```jsx
// Card Layout Pattern
const KBEntryCard = ({ entry, onEdit, onDelete }) => (
  <Card>
    <Card.Header>
      <Card.Title>{entry.title}</Card.Title>
      <Card.Actions>
        <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(entry)}>
          Delete
        </Button>
      </Card.Actions>
    </Card.Header>
    <Card.Content>
      <p className="text-gray-600">{entry.problem}</p>
      <div className="mt-4">
        {entry.tags.map(tag => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
    </Card.Content>
    <Card.Footer>
      <span className="text-sm text-gray-500">
        Last updated: {formatDate(entry.updatedAt)}
      </span>
    </Card.Footer>
  </Card>
);
```

### Form Composition

```jsx
// Form Builder Pattern
const KBEntryForm = ({ entry, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(entry || {});
  const [errors, setErrors] = useState({});

  return (
    <Form onSubmit={handleSubmit} validation={validationSchema}>
      <Form.Section title="Problem Information">
        <Form.Field name="title" label="Problem Title" required>
          <Input placeholder="Brief description of the problem" />
        </Form.Field>

        <Form.Field name="category" label="Category" required>
          <Select options={categoryOptions} />
        </Form.Field>

        <Form.Field name="description" label="Problem Description" required>
          <TextArea
            rows={4}
            placeholder="Detailed description of the issue"
          />
        </Form.Field>
      </Form.Section>

      <Form.Section title="Solution Information">
        <Form.Field name="solution" label="Solution Steps" required>
          <TextArea
            rows={6}
            placeholder="Step-by-step solution instructions"
          />
        </Form.Field>

        <Form.Field name="tags" label="Tags" optional>
          <TagsField placeholder="Add relevant tags..." />
        </Form.Field>
      </Form.Section>

      <Form.Actions>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save Entry
        </Button>
      </Form.Actions>
    </Form>
  );
};
```

### Search Interface Pattern

```jsx
// Search Interface Composition
const KBSearchInterface = () => (
  <SearchProvider>
    <div className="search-interface">
      <SearchHeader>
        <SearchInput placeholder="Search knowledge base..." />
        <SearchFilters>
          <Filter.Category options={categories} />
          <Filter.Tags suggestions={popularTags} />
          <Filter.DateRange />
        </SearchFilters>
      </SearchHeader>

      <SearchContent>
        <SearchSidebar>
          <QuickFilters />
          <SavedSearches />
          <SearchHistory />
        </SearchSidebar>

        <SearchResults>
          <ResultsHeader />
          <ResultsList />
          <Pagination />
        </SearchResults>
      </SearchContent>
    </div>
  </SearchProvider>
);
```

---

## Customization Guide

### Theme Customization

```typescript
// Theme Configuration
const customTheme: Theme = {
  colors: {
    primary: {
      50: '#eff6ff',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8'
    },
    // ... other colors
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Fira Code', 'monospace']
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      // ... other sizes
    }
  },
  spacing: {
    // Custom spacing scale
  },
  borderRadius: {
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem'
  }
};

// Apply theme
<ThemeProvider theme={customTheme}>
  <App />
</ThemeProvider>
```

### Component Customization

```typescript
// Component Variant Extension
const CustomButton = styled(Button)`
  &.btn-custom {
    background: linear-gradient(45deg, #fe6b8b 30%, #ff8e53 90%);
    border: 0;
    color: white;

    &:hover {
      background: linear-gradient(45deg, #fe6b8b 60%, #ff8e53 100%);
    }
  }
`;

// Usage
<CustomButton variant="custom" className="btn-custom">
  Custom Styled Button
</CustomButton>
```

---

## Migration and Upgrade Guide

### From v1.x to v2.x

#### Breaking Changes

1. **Button Color to Variant**
```jsx
// v1.x
<Button color="primary" />

// v2.x
<Button variant="primary" />
```

2. **FormField Required Prop**
```jsx
// v1.x
<FormField label="Name" isRequired />

// v2.x
<FormField label="Name" required />
```

3. **Select Value Structure**
```jsx
// v1.x
<Select value="option1" />

// v2.x
<Select value={{ value: 'option1', label: 'Option 1' }} />
```

#### Migration Script

```bash
# Run automated migration
npx @mainframe-kb/codemod v1-to-v2

# Manual updates needed:
# 1. Update import paths
# 2. Replace deprecated props
# 3. Update theme configuration
```

---

## Contributing to the Catalog

### Adding New Components

1. **Component Implementation**
   - Follow accessibility guidelines
   - Include comprehensive TypeScript types
   - Implement performance optimizations
   - Add comprehensive tests

2. **Documentation Requirements**
   - Visual showcase with examples
   - Accessibility feature documentation
   - Performance characteristics
   - Browser compatibility matrix

3. **Testing Requirements**
   - Unit tests with React Testing Library
   - Accessibility tests with jest-axe
   - Visual regression tests with Chromatic
   - Performance benchmarks

### Component Review Checklist

- [ ] **Accessibility**: WCAG 2.1 AA compliant
- [ ] **Performance**: Optimized rendering and bundle size
- [ ] **TypeScript**: Complete type coverage
- [ ] **Testing**: Comprehensive test coverage
- [ ] **Documentation**: Complete API documentation
- [ ] **Examples**: Multiple usage examples
- [ ] **Browser Support**: Tested across target browsers

---

## Conclusion

This component catalog provides a comprehensive overview of all available components, their features, accessibility considerations, and usage patterns. Regular updates ensure that the catalog remains current with the latest component developments and best practices.

For questions, suggestions, or contributions, please refer to the project's contribution guidelines or reach out to the development team.

---

*Last updated: January 2025*