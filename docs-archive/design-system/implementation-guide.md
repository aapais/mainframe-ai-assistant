# Implementation Guide

## Overview

This implementation guide provides step-by-step instructions for integrating and customizing the enhanced Mainframe AI Assistant Design System. Whether you're starting a new project or migrating from the previous version, this guide will help you implement the design system effectively.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation and Setup](#installation-and-setup)
- [Migration Guide](#migration-guide)
- [Theme Configuration](#theme-configuration)
- [Component Usage](#component-usage)
- [Customization](#customization)
- [Build Integration](#build-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install Dependencies

```bash
# Core design system
npm install @mainframe/design-system

# Peer dependencies
npm install react react-dom typescript
npm install class-variance-authority clsx tailwind-merge

# Development dependencies
npm install --save-dev @types/react @types/react-dom
```

### 2. Basic Setup

```tsx
// src/App.tsx
import React from 'react';
import { ThemeProvider } from '@mainframe/design-system';
import '@mainframe/design-system/dist/styles.css';

function App() {
  return (
    <ThemeProvider defaultTheme="light" enableSystemTheme>
      <YourApplication />
    </ThemeProvider>
  );
}

export default App;
```

### 3. Use Components

```tsx
// src/components/Example.tsx
import { Button, Card, Input } from '@mainframe/design-system';

export function Example() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Welcome</h2>
      <Input placeholder="Enter your name" className="mb-4" />
      <Button variant="primary" size="medium">
        Get Started
      </Button>
    </Card>
  );
}
```

---

## Installation and Setup

### Prerequisites

Ensure your development environment meets these requirements:

- **Node.js**: 18.0.0 or higher
- **React**: 18.0.0 or higher
- **TypeScript**: 5.0.0 or higher (recommended)

### Package Manager Options

#### NPM
```bash
npm install @mainframe/design-system
```

#### Yarn
```bash
yarn add @mainframe/design-system
```

#### PNPM
```bash
pnpm add @mainframe/design-system
```

### CSS Integration

Choose one of these methods to include the design system styles:

#### Method 1: Import All Styles (Recommended)
```tsx
// In your main App.tsx or index.tsx
import '@mainframe/design-system/dist/styles.css';
```

#### Method 2: Granular Imports
```tsx
// Import only what you need
import '@mainframe/design-system/dist/foundations.css';
import '@mainframe/design-system/dist/components.css';
import '@mainframe/design-system/dist/accessibility.css';
```

#### Method 3: PostCSS Integration
```css
/* In your main CSS file */
@import '@mainframe/design-system/dist/styles.css';
```

### Tailwind CSS Integration (Optional)

If you're using Tailwind CSS, integrate the design system tokens:

```javascript
// tailwind.config.js
const designSystem = require('@mainframe/design-system/dist/tailwind.config');

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@mainframe/design-system/dist/**/*.js'
  ],
  presets: [designSystem],
  theme: {
    extend: {
      // Your custom overrides
    }
  }
};
```

---

## Migration Guide

### From v1.x to v2.x

#### Breaking Changes Overview

1. **Component API Changes**: Some prop names have changed
2. **CSS Class Naming**: Updated to follow BEM methodology
3. **Theme Structure**: New theme provider with enhanced features
4. **Bundle Structure**: Modularized for better tree-shaking

#### Automated Migration

Use the migration CLI tool for automatic code updates:

```bash
# Install migration tool
npm install -g @mainframe/design-system-migrate

# Run migration on your codebase
npx @mainframe/design-system-migrate src/

# Dry run to preview changes
npx @mainframe/design-system-migrate --dry-run src/
```

#### Manual Migration Steps

##### 1. Update Theme Provider

```tsx
// Before (v1.x)
import { ThemeProvider } from '@mainframe/design-system-v1';

<ThemeProvider theme="dark">
  <App />
</ThemeProvider>

// After (v2.x)
import { ThemeProvider } from '@mainframe/design-system';

<ThemeProvider defaultTheme="dark" enableSystemTheme>
  <App />
</ThemeProvider>
```

##### 2. Update Component Imports

```tsx
// Before (v1.x)
import { Button, Card } from '@mainframe/design-system-v1/components';

// After (v2.x)
import { Button, Card } from '@mainframe/design-system';
```

##### 3. Update Component Props

```tsx
// Before (v1.x)
<Button type="primary" size="large" disabled={loading}>
  Save
</Button>

// After (v2.x)
<Button variant="primary" size="large" loading={loading}>
  Save
</Button>
```

##### 4. Update CSS Classes

```css
/* Before (v1.x) */
.button-primary { }
.card-elevated { }

/* After (v2.x) */
.btn--primary { }
.card--elevated { }
```

#### Migration Checklist

- [ ] Update package.json dependencies
- [ ] Run automated migration tool
- [ ] Update theme provider implementation
- [ ] Update component imports and props
- [ ] Update custom CSS classes
- [ ] Test all existing functionality
- [ ] Update unit tests
- [ ] Update documentation

### Gradual Migration Strategy

For large codebases, implement a gradual migration:

#### 1. Side-by-Side Installation

```bash
# Keep v1.x for existing components
npm install @mainframe/design-system-v1

# Install v2.x for new components
npm install @mainframe/design-system
```

#### 2. Namespace Components

```tsx
// Use aliases to avoid conflicts
import { Button as ButtonV1 } from '@mainframe/design-system-v1';
import { Button as ButtonV2 } from '@mainframe/design-system';

// Gradually replace components
export const Button = ButtonV2; // Switch when ready
```

#### 3. Progressive Enhancement

```tsx
// Create wrapper components for smooth transition
import { ButtonV1, ButtonV2 } from './button-versions';

export function Button(props) {
  // Use feature flag or environment variable
  return USE_V2_COMPONENTS ? <ButtonV2 {...props} /> : <ButtonV1 {...props} />;
}
```

---

## Theme Configuration

### Basic Theme Setup

```tsx
// src/App.tsx
import { ThemeProvider } from '@mainframe/design-system';

function App() {
  return (
    <ThemeProvider
      defaultTheme="light"           // Default theme
      storageKey="app-theme"         // localStorage key
      enableSystemTheme={true}       // Detect system preference
      customThemes={{               // Custom theme definitions
        brand: customBrandTheme
      }}
    >
      <YourApp />
    </ThemeProvider>
  );
}
```

### Custom Theme Creation

```tsx
// src/themes/custom-theme.ts
import type { Theme } from '@mainframe/design-system';

export const customBrandTheme: Theme = {
  name: 'brand',
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',  // Your brand color
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49'
    },
    // Override other colors as needed
    success: {
      // Custom success colors
    }
  },
  typography: {
    fontFamily: {
      sans: ['YourBrandFont', 'system-ui', 'sans-serif'],
      // Other font overrides
    }
  },
  spacing: {
    // Custom spacing if needed
  },
  customProperties: {
    // Custom CSS variables
    'brand-gradient': 'linear-gradient(45deg, #0ea5e9, #3b82f6)'
  }
};
```

### Theme Switching

```tsx
// src/components/ThemeSwitcher.tsx
import { useTheme } from '@mainframe/design-system';

export function ThemeSwitcher() {
  const { themeName, setTheme, toggleTheme } = useTheme();

  return (
    <div className="theme-switcher">
      <button
        onClick={() => setTheme('light')}
        className={themeName === 'light' ? 'active' : ''}
      >
        Light
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={themeName === 'dark' ? 'active' : ''}
      >
        Dark
      </button>
      <button
        onClick={() => setTheme('mainframe')}
        className={themeName === 'mainframe' ? 'active' : ''}
      >
        Mainframe
      </button>
      <button onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
}
```

### Advanced Theme Customization

```tsx
// Runtime theme customization
import { useTheme } from '@mainframe/design-system';

export function ThemeCustomizer() {
  const { customizeTheme, resetTheme } = useTheme();

  const applyCustomizations = () => {
    customizeTheme({
      colors: {
        primary: {
          500: '#9333ea', // Custom purple
        }
      },
      spacing: {
        custom: '2.5rem'
      },
      customProperties: {
        'custom-shadow': '0 0 20px rgba(147, 51, 234, 0.3)'
      }
    });
  };

  return (
    <div>
      <button onClick={applyCustomizations}>
        Apply Customizations
      </button>
      <button onClick={resetTheme}>
        Reset to Default
      </button>
    </div>
  );
}
```

---

## Component Usage

### Basic Components

#### Buttons

```tsx
import { Button, IconButton, ButtonGroup } from '@mainframe/design-system';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export function ButtonExamples() {
  return (
    <div className="space-y-4">
      {/* Basic buttons */}
      <div className="flex gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Delete</Button>
      </div>

      {/* Button with icon */}
      <Button variant="primary" icon={<PlusIcon />}>
        Add Item
      </Button>

      {/* Icon button */}
      <IconButton
        icon={<TrashIcon />}
        label="Delete item"
        variant="danger"
        size="small"
      />

      {/* Loading state */}
      <Button variant="primary" loading loadingText="Saving...">
        Save Changes
      </Button>

      {/* Button group */}
      <ButtonGroup>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Save</Button>
      </ButtonGroup>

      {/* With keyboard shortcut */}
      <Button
        variant="primary"
        shortcut={{
          key: 's',
          ctrlKey: true,
          description: 'Save entry'
        }}
      >
        Save (Ctrl+S)
      </Button>
    </div>
  );
}
```

#### Form Components

```tsx
import {
  Input,
  TextArea,
  Select,
  Checkbox,
  RadioButton,
  FormField,
  FormError,
  FormHelp
} from '@mainframe/design-system';

export function FormExamples() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    priority: 'medium',
    isPublic: false,
    tags: []
  });

  return (
    <form className="space-y-6">
      {/* Text input with validation */}
      <FormField>
        <label htmlFor="name" className="form-label required">
          Entry Title
        </label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter a descriptive title"
          error={!formData.name ? 'Title is required' : ''}
          ariaDescribedBy="name-help"
        />
        <FormHelp id="name-help">
          Use keywords that users might search for
        </FormHelp>
        {!formData.name && (
          <FormError>Title is required</FormError>
        )}
      </FormField>

      {/* Textarea */}
      <FormField>
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <TextArea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the knowledge base entry"
          rows={4}
          maxLength={500}
          showCharacterCount
        />
      </FormField>

      {/* Select dropdown */}
      <FormField>
        <label htmlFor="category" className="form-label">
          Category
        </label>
        <Select
          id="category"
          value={formData.category}
          onChange={(value) => setFormData({ ...formData, category: value })}
          placeholder="Select a category"
          options={[
            { value: 'technical', label: 'Technical' },
            { value: 'process', label: 'Process' },
            { value: 'policy', label: 'Policy' }
          ]}
        />
      </FormField>

      {/* Radio buttons */}
      <FormField>
        <fieldset>
          <legend className="form-label">Priority Level</legend>
          <div className="flex gap-4">
            {['low', 'medium', 'high', 'critical'].map((priority) => (
              <RadioButton
                key={priority}
                name="priority"
                value={priority}
                checked={formData.priority === priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                label={priority.charAt(0).toUpperCase() + priority.slice(1)}
              />
            ))}
          </div>
        </fieldset>
      </FormField>

      {/* Checkbox */}
      <FormField>
        <Checkbox
          id="isPublic"
          checked={formData.isPublic}
          onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
          label="Make this entry publicly visible"
          description="Public entries can be viewed by all users"
        />
      </FormField>
    </form>
  );
}
```

### Advanced Components

#### Data Table

```tsx
import { DataTable, Pagination } from '@mainframe/design-system';

export function DataTableExample() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [sorting, setSorting] = useState({ column: 'title', direction: 'asc' });

  const columns = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      sortable: true
    },
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      searchable: true,
      render: (row) => (
        <a href={`/kb/${row.id}`} className="text-blue-600 hover:text-blue-800">
          {row.title}
        </a>
      )
    },
    {
      key: 'category',
      title: 'Category',
      width: 150,
      filterable: true,
      render: (row) => (
        <span className="badge badge--secondary">{row.category}</span>
      )
    },
    {
      key: 'lastModified',
      title: 'Modified',
      width: 150,
      sortable: true,
      render: (row) => (
        <time dateTime={row.lastModified}>
          {formatRelativeTime(row.lastModified)}
        </time>
      )
    }
  ];

  return (
    <div>
      <DataTable
        data={data}
        columns={columns}
        sorting={sorting}
        onSortingChange={setSorting}
        loading={loading}
        emptyMessage="No entries found"
        ariaLabel="Knowledge base entries"
      />

      <Pagination
        currentPage={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={totalItems}
        onPageChange={(page) => setPagination({ ...pagination, page })}
        onPageSizeChange={(pageSize) => setPagination({ ...pagination, pageSize })}
        showSizeSelector
        showInfo
      />
    </div>
  );
}
```

#### Modal Dialogs

```tsx
import { Modal, ConfirmModal, AlertModal } from '@mainframe/design-system';

export function ModalExamples() {
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  return (
    <div>
      {/* Basic modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Knowledge Base Entry"
        size="lg"
      >
        <div className="p-6">
          <p>Modal content goes here...</p>
        </div>
      </Modal>

      {/* Confirmation modal */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Entry"
        description="Are you sure you want to delete this entry? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* Alert modal */}
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title="Entry Saved"
        description="Your knowledge base entry has been saved successfully."
        variant="success"
      />
    </div>
  );
}
```

---

## Customization

### CSS Custom Properties

Override design tokens using CSS custom properties:

```css
/* src/styles/custom-theme.css */
:root {
  /* Override color tokens */
  --color-primary-500: #9333ea;
  --color-primary-600: #7c3aed;
  --color-primary-700: #6d28d9;

  /* Override spacing */
  --space-custom: 2.5rem;

  /* Override typography */
  --font-family-sans: 'Your Custom Font', system-ui, sans-serif;

  /* Custom shadows */
  --shadow-custom: 0 0 20px rgba(147, 51, 234, 0.3);
}

/* Dark theme overrides */
[data-theme="dark"] {
  --color-primary-500: #a855f7;
  --color-primary-600: #9333ea;
}
```

### Styled Components Integration

```tsx
import styled from 'styled-components';
import { Button } from '@mainframe/design-system';

const CustomButton = styled(Button)`
  background: var(--color-primary-500);
  border-radius: var(--border-radius-2xl);

  &:hover {
    background: var(--color-primary-600);
    transform: translateY(-1px);
  }
`;

const GradientCard = styled.div`
  background: linear-gradient(
    135deg,
    var(--color-primary-50),
    var(--color-primary-100)
  );
  border-radius: var(--border-radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
`;
```

### Component Variant Creation

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@mainframe/design-system/utils';

const alertVariants = cva(
  'alert', // base styles
  {
    variants: {
      variant: {
        info: 'alert--info',
        success: 'alert--success',
        warning: 'alert--warning',
        danger: 'alert--danger'
      },
      size: {
        sm: 'alert--sm',
        md: 'alert--md',
        lg: 'alert--lg'
      }
    },
    defaultVariants: {
      variant: 'info',
      size: 'md'
    }
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, size, title, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(alertVariants({ variant, size, className }))}
        role="alert"
        {...props}
      >
        {title && <div className="alert__title">{title}</div>}
        <div className="alert__content">{children}</div>
      </div>
    );
  }
);
```

---

## Build Integration

### Webpack Configuration

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  // ... other config
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader'
        ]
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
};
```

### Vite Configuration

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer')
      ]
    }
  }
});
```

### Next.js Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true
  },
  compiler: {
    styledComponents: true // If using styled-components
  }
};

module.exports = nextConfig;
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

### Tree Shaking Optimization

```javascript
// babel.config.js
module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-react'],
  plugins: [
    ['import', {
      libraryName: '@mainframe/design-system',
      libraryDirectory: 'lib',
      camel2DashComponentName: false
    }, '@mainframe/design-system']
  ]
};
```

---

## Testing

### Unit Testing Components

```tsx
// src/components/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '@mainframe/design-system';

expect.extend(toHaveNoViolations);

describe('Button Component', () => {
  test('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('shows loading state', () => {
    render(<Button loading loadingText="Saving...">Save</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  test('is accessible', async () => {
    const { container } = render(
      <Button variant="primary" ariaDescription="Primary action button">
        Submit
      </Button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('supports keyboard navigation', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');

    // Test Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Test Space key
    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Testing

```tsx
// src/components/__tests__/KBEntryForm.integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mainframe/design-system';
import { KBEntryForm } from '../KBEntryForm';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="light">
      {component}
    </ThemeProvider>
  );
};

describe('KBEntryForm Integration', () => {
  test('complete form submission flow', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    renderWithTheme(
      <KBEntryForm onSubmit={handleSubmit} />
    );

    // Fill out form
    await user.type(screen.getByLabelText(/title/i), 'Test Entry');
    await user.type(screen.getByLabelText(/description/i), 'Test description');
    await user.selectOptions(screen.getByLabelText(/category/i), 'technical');

    // Submit form
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'Test Entry',
        description: 'Test description',
        category: 'technical'
      });
    });
  });
});
```

### Visual Regression Testing

```javascript
// .storybook/test-runner.js
const { injectAxe, checkA11y } = require('axe-playwright');

module.exports = {
  async preRender(page, context) {
    await injectAxe(page);
  },
  async postRender(page, context) {
    // Accessibility testing
    await checkA11y(page, '#root', {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    // Visual regression testing
    await page.screenshot({
      path: `./screenshots/${context.title}.png`,
      fullPage: true
    });
  }
};
```

### End-to-End Testing

```typescript
// tests/e2e/knowledge-base.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Knowledge Base Interface', () => {
  test('should create and edit KB entry with full keyboard navigation', async ({ page }) => {
    await page.goto('/kb');

    // Navigate using keyboard only
    await page.keyboard.press('Tab'); // Skip to main content
    await page.keyboard.press('Tab'); // Focus search
    await page.keyboard.press('Tab'); // Focus new entry button

    // Create new entry
    await page.keyboard.press('Enter');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill form using keyboard
    await page.keyboard.type('Test KB Entry');
    await page.keyboard.press('Tab');
    await page.keyboard.type('This is a test entry');

    // Save entry
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify entry was created
    await expect(page.locator('text=Test KB Entry')).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await page.goto('/kb');

    // Check for accessibility violations
    const accessibilityScanResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-ignore
        axe.run((err, results) => {
          if (err) throw err;
          resolve(results);
        });
      });
    });

    // @ts-ignore
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. Styles Not Loading

**Problem**: Components appear unstyled

**Solutions**:
```tsx
// Ensure CSS is imported correctly
import '@mainframe/design-system/dist/styles.css';

// Check import order (CSS should be before component imports)
import '@mainframe/design-system/dist/styles.css';
import { Button } from '@mainframe/design-system';

// Verify build configuration includes CSS processing
```

#### 2. Theme Not Applying

**Problem**: Theme changes don't take effect

**Solutions**:
```tsx
// Ensure ThemeProvider wraps your app
function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <YourComponents />
    </ThemeProvider>
  );
}

// Check for conflicting CSS that might override theme variables
// Verify data-theme attribute is applied to document body
```

#### 3. TypeScript Errors

**Problem**: Type errors when using components

**Solutions**:
```tsx
// Install type definitions
npm install --save-dev @types/react @types/react-dom

// Ensure tsconfig.json includes proper configuration
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

#### 4. Bundle Size Issues

**Problem**: Large bundle size impact

**Solutions**:
```javascript
// Use tree shaking
import { Button } from '@mainframe/design-system';
// Instead of: import * as DS from '@mainframe/design-system';

// Configure webpack for proper tree shaking
module.exports = {
  optimization: {
    usedExports: true,
    sideEffects: false
  }
};

// Use dynamic imports for heavy components
const DataTable = lazy(() => import('@mainframe/design-system/DataTable'));
```

### Debugging Tools

#### Design System DevTools

```tsx
// Add design system debugging in development
import { DesignSystemDevTools } from '@mainframe/design-system/devtools';

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <DesignSystemDevTools />}
    </>
  );
}
```

#### Theme Debugging

```css
/* Add to your development CSS */
.debug-theme {
  position: fixed;
  top: 10px;
  right: 10px;
  background: white;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  z-index: 9999;
}

.debug-theme::before {
  content: 'Theme: ' attr(data-theme);
  display: block;
  font-weight: bold;
}
```

#### Accessibility Debugging

```tsx
// Enable accessibility debugging
import { AccessibilityAuditor } from '@mainframe/design-system/a11y';

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && (
        <AccessibilityAuditor
          showFocusRings={true}
          highlightLandmarks={true}
          checkColorContrast={true}
        />
      )}
    </>
  );
}
```

### Performance Debugging

#### Bundle Analysis

```bash
# Analyze bundle composition
npm install --save-dev webpack-bundle-analyzer
npm run build
npx webpack-bundle-analyzer build/static/js/*.js

# Check for unused exports
npm install --save-dev unimported
npx unimported

# Analyze import costs
npm install --save-dev import-cost
```

#### Runtime Performance

```tsx
// Add performance monitoring
import { PerformanceMonitor } from '@mainframe/design-system/perf';

function App() {
  return (
    <PerformanceMonitor
      enableWebVitals={true}
      enableUserTiming={true}
      reportEndpoint="/api/performance"
    >
      <YourApp />
    </PerformanceMonitor>
  );
}
```

### Getting Help

#### Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/mainframe/design-system/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/mainframe/design-system/discussions)
- **Discord**: Join our community chat
- **Stack Overflow**: Tag questions with `mainframe-design-system`

#### Documentation Resources

- [API Reference](./api-reference.md)
- [Component Library](./component-library.md)
- [Accessibility Guide](./accessibility-guide.md)
- [Design Tokens](./design-tokens.md)
- [Migration Guides](./migrations/)

#### Support Channels

- **Email**: design-system@mainframe.com
- **Office Hours**: Wednesdays 2-3 PM PST
- **Training**: Schedule team training sessions

---

*This implementation guide is updated regularly. For the latest information, check the [GitHub repository](https://github.com/mainframe/design-system) or join our [community discussions](https://github.com/mainframe/design-system/discussions).*