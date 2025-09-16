# UI Component Library

A comprehensive, accessible, and performance-optimized component library for the Mainframe AI Assistant project. Built with React, TypeScript, and Tailwind CSS.

## 🎯 Design Philosophy

This component library follows a **Knowledge-First** approach, designed specifically for the mainframe development environment while maintaining modern web standards:

- **Accessibility First**: WCAG 2.1 AA compliant with comprehensive screen reader support
- **Performance Optimized**: Lazy loading, memoization, and minimal bundle size
- **Consistent Design**: Unified design system with comprehensive theming
- **Developer Experience**: Full TypeScript support with excellent IntelliSense
- **Maintainable**: Clean composition patterns and well-documented APIs

## 🚀 Quick Start

```tsx
import { Button, Card, Input, Typography } from '@/components/ui';

function MyComponent() {
  return (
    <Card>
      <Typography variant="heading-lg">Welcome</Typography>
      <Input label="Search Knowledge Base" placeholder="Enter keywords..." />
      <Button variant="primary">Search</Button>
    </Card>
  );
}
```

## 📦 Component Categories

### Typography
- **Typography**: Main typography component with variants
- **H1-H6**: Semantic heading components
- **Text**: Paragraph text with variants
- **Label**: Form labels
- **Code**: Inline code snippets
- **Link**: Accessible links

### Form Controls
- **Input**: Text inputs with validation and accessibility
- **Textarea**: Multi-line text input
- **Button**: Comprehensive button component with variants
- **IconButton**: Icon-only buttons
- **ToggleButton**: Toggle state buttons

### Layout
- **Container**: Content containers with responsive sizing
- **Grid/GridItem**: CSS Grid layout system
- **Flex**: Flexbox container
- **Stack/HStack**: Vertical/horizontal stacks
- **Center**: Center content
- **Box**: Generic container
- **Divider**: Visual separators

### Data Display
- **Card**: Content cards with headers, body, footer
- **Table**: Data tables with sorting and filtering
- **DataTable**: Advanced data table with pagination
- **Badge**: Status indicators and tags
- **Avatar**: User avatars with fallbacks
- **List**: Ordered and unordered lists
- **Progress**: Progress bars and indicators

### Navigation
- **Tabs**: Tab navigation with accessibility
- **Breadcrumb**: Navigation breadcrumbs
- **Sidebar**: Collapsible navigation sidebar
- **Pagination**: Page navigation controls

### Overlays
- **Modal**: Accessible modal dialogs with focus management
- **ConfirmModal**: Pre-built confirmation dialogs
- **AlertModal**: Notification modals

### Specialized Components
- **KBEntryCard**: Knowledge base entry display
- **StatCard**: Statistics and metrics display
- **FeatureCard**: Feature showcases
- **CopyButton**: Copy-to-clipboard functionality

## 🎨 Design System

### Color Palette

```css
/* Primary Colors */
--color-primary: 14 165 233;    /* Blue */
--color-secondary: 100 116 139; /* Gray */

/* Status Colors */
--color-success: 34 197 94;     /* Green */
--color-warning: 245 158 11;    /* Amber */
--color-danger: 239 68 68;      /* Red */

/* Mainframe Theme */
--color-terminal-green: 0 255 0;
--color-terminal-amber: 255 176 0;
--color-ibm-blue: 0 119 255;
```

### Typography Scale

```css
/* Display (Headings) */
display-2xl: 5xl font-extrabold  /* 48px+ */
display-xl:  4xl font-extrabold  /* 36px+ */
display-lg:  3xl font-bold       /* 30px+ */

/* Headings */
heading-xl:  3xl font-semibold   /* 30px */
heading-lg:  2xl font-semibold   /* 24px */
heading-md:  xl font-semibold    /* 20px */

/* Body Text */
body-lg: lg leading-7            /* 18px */
body-md: base leading-7          /* 16px */
body-sm: sm leading-6            /* 14px */
```

### Spacing System

Based on a consistent 4px grid system:

```css
xs: 4px   sm: 8px   md: 12px  lg: 16px
xl: 24px  2xl: 32px 3xl: 48px 4xl: 64px
```

## ♿ Accessibility Features

### Built-in ARIA Support
- Automatic ARIA attributes
- Screen reader announcements
- Focus management
- Keyboard navigation

### Focus Management
```tsx
import { FocusManager } from '@/utils/accessibility';

// Save current focus and set new
FocusManager.save(newElement);

// Restore previous focus
FocusManager.restore();
```

### Live Region Announcements
```tsx
import { LiveRegionManager } from '@/utils/accessibility';

const liveRegion = LiveRegionManager.getInstance();
liveRegion.announce('Search completed', 'polite');
```

### Accessibility Testing
```tsx
import { AccessibilityTester } from '@/utils/accessibility';

const audit = AccessibilityTester.audit(element);
console.log(`Accessibility Score: ${audit.score}/100`);
```

## 🎯 Component Patterns

### Compound Components
```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Overview</TabsTrigger>
    <TabsTrigger value="tab2">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Overview content</TabsContent>
  <TabsContent value="tab2">Detailed information</TabsContent>
</Tabs>
```

### Composition Pattern
```tsx
<Card>
  <CardHeader>
    <CardTitle>Knowledge Base Entry</CardTitle>
    <CardDescription>VSAM Status Code Resolution</CardDescription>
  </CardHeader>
  <CardContent>
    <Typography>Problem description...</Typography>
  </CardContent>
  <CardFooter>
    <Button variant="primary">Apply Solution</Button>
  </CardFooter>
</Card>
```

### Form Pattern
```tsx
<Stack spacing={4}>
  <Input 
    label="Problem Title"
    placeholder="Brief description..."
    required
    errorMessage={errors.title}
  />
  <Textarea
    label="Solution Steps"
    placeholder="Detailed solution..."
    maxLength={1000}
    showCharacterCount
  />
  <Button type="submit" loading={isSubmitting}>
    Save Entry
  </Button>
</Stack>
```

## 🛠 Customization

### Theme Customization
```tsx
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#your-color',
        },
      },
    },
  },
};
```

### Component Variants
```tsx
// Custom button variant
<Button variant="terminal" size="lg">
  Execute JCL
</Button>

// Custom card for mainframe theme
<Card variant="terminal">
  <CardContent>Terminal-styled content</CardContent>
</Card>
```

### CSS Custom Properties
```css
:root {
  --color-primary: your-color;
  --border-radius: your-radius;
  --spacing-unit: your-spacing;
}
```

## 📱 Responsive Design

All components are mobile-first and responsive:

```tsx
<Grid cols={1} smCols={2} lgCols={3} xlCols={4}>
  <GridItem>Item 1</GridItem>
  <GridItem>Item 2</GridItem>
  <GridItem colSpan={2}>Spanning item</GridItem>
</Grid>
```

## 🧪 Testing

### Component Testing
```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui';

test('button renders correctly', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### Accessibility Testing
```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

test('button is accessible', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 📋 Component Checklist

When creating new components, ensure:

- [ ] TypeScript interfaces defined
- [ ] Accessibility attributes included
- [ ] Keyboard navigation supported
- [ ] Screen reader compatibility
- [ ] Responsive design implemented
- [ ] Dark mode support
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Unit tests written
- [ ] Documentation updated

## 🔧 Development Setup

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Run accessibility tests
npm run test:a11y

# Build components
npm run build
```

## 📚 Additional Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Accessibility Guide](https://reactjs.org/docs/accessibility.html)

## 🤝 Contributing

1. Follow the existing component patterns
2. Ensure accessibility compliance
3. Add comprehensive tests
4. Update documentation
5. Test with screen readers
6. Verify keyboard navigation

## 📄 License

MIT License - see LICENSE file for details.