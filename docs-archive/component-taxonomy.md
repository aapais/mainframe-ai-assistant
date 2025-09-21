# Component Taxonomy and Organization Structure

## Overview

This document defines the organizational structure and taxonomy for the Mainframe AI Assistant component library, based on Atomic Design methodology combined with functional grouping and usage patterns.

## 1. Atomic Design Structure

### 1.1 Atoms (Basic Building Blocks)
Smallest functional units that cannot be broken down further while maintaining their purpose.

```typescript
interface AtomicComponents {
  // Typography
  Text: {
    variants: ['body', 'caption', 'label']
    sizes: ['xs', 'sm', 'md', 'lg', 'xl']
    weights: ['normal', 'medium', 'semibold', 'bold']
  }
  
  Heading: {
    levels: [1, 2, 3, 4, 5, 6]
    sizes: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']
  }
  
  // Visual Elements
  Icon: {
    sizes: ['xs', 'sm', 'md', 'lg', 'xl']
    colors: 'semantic-tokens'
  }
  
  Avatar: {
    sizes: ['xs', 'sm', 'md', 'lg', 'xl']
    variants: ['circle', 'square']
  }
  
  Badge: {
    variants: ['solid', 'outline', 'subtle']
    sizes: ['sm', 'md', 'lg']
    colors: 'semantic-tokens'
  }
  
  Divider: {
    orientation: ['horizontal', 'vertical']
    variants: ['solid', 'dashed', 'dotted']
  }
  
  // Form Atoms
  Input: {
    types: ['text', 'email', 'password', 'number', 'tel', 'url', 'search']
    sizes: ['sm', 'md', 'lg']
    states: ['default', 'disabled', 'error', 'success']
  }
  
  Button: {
    variants: ['solid', 'outline', 'ghost', 'link']
    sizes: ['xs', 'sm', 'md', 'lg', 'xl']
    colors: ['primary', 'secondary', 'success', 'warning', 'danger']
  }
  
  Checkbox: {
    sizes: ['sm', 'md', 'lg']
    states: ['unchecked', 'checked', 'indeterminate']
  }
  
  Radio: {
    sizes: ['sm', 'md', 'lg']
    states: ['unchecked', 'checked']
  }
  
  Switch: {
    sizes: ['sm', 'md', 'lg']
    states: ['off', 'on']
  }
  
  Slider: {
    orientations: ['horizontal', 'vertical']
    variants: ['continuous', 'discrete']
  }
}
```

### 1.2 Molecules (Simple Component Groups)
Combinations of atoms that work together as a unit.

```typescript
interface MolecularComponents {
  // Form Molecules
  FormField: {
    components: ['Label', 'Input', 'HelperText', 'ErrorMessage']
    variants: ['stacked', 'inline']
  }
  
  SearchBox: {
    components: ['Input', 'Button', 'Icon']
    features: ['autocomplete', 'recent-searches', 'filters']
  }
  
  ButtonGroup: {
    orientations: ['horizontal', 'vertical']
    variants: ['attached', 'separated']
    sizes: 'inherit-from-buttons'
  }
  
  Pagination: {
    components: ['Button', 'Text', 'Icon']
    variants: ['simple', 'numbered', 'compact']
  }
  
  // Content Molecules
  Card: {
    components: ['Container', 'Text', 'Button']
    variants: ['elevated', 'outlined', 'filled']
    sizes: ['sm', 'md', 'lg']
  }
  
  Alert: {
    components: ['Icon', 'Text', 'Button']
    variants: ['info', 'success', 'warning', 'error']
    dismissible: boolean
  }
  
  Toast: {
    components: ['Icon', 'Text', 'Button']
    variants: ['info', 'success', 'warning', 'error']
    positions: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']
  }
  
  Breadcrumb: {
    components: ['Link', 'Text', 'Icon']
    separators: ['slash', 'chevron', 'arrow']
  }
  
  Tab: {
    components: ['Button', 'Badge']
    variants: ['line', 'enclosed', 'enclosed-colored']
    sizes: ['sm', 'md', 'lg']
  }
  
  // Data Display Molecules
  Stat: {
    components: ['Text', 'Heading', 'Icon']
    variants: ['simple', 'with-icon', 'with-change']
  }
  
  Progress: {
    components: ['Container', 'Bar', 'Text']
    variants: ['linear', 'circular']
    sizes: ['sm', 'md', 'lg']
  }
  
  Skeleton: {
    variants: ['text', 'circle', 'rectangle']
    animation: ['pulse', 'wave', 'none']
  }
}
```

### 1.3 Organisms (Complex Component Groups)
Complex components that combine molecules and atoms into distinct sections.

```typescript
interface OrganismComponents {
  // Navigation Organisms
  NavBar: {
    components: ['Container', 'Brand', 'Menu', 'Actions']
    variants: ['horizontal', 'sidebar']
    behaviors: ['sticky', 'collapsible', 'overlay']
  }
  
  Sidebar: {
    components: ['NavBar', 'Menu', 'Footer']
    variants: ['permanent', 'temporary', 'mini']
    positions: ['left', 'right']
  }
  
  Menu: {
    components: ['MenuItem', 'MenuGroup', 'MenuDivider']
    variants: ['dropdown', 'context', 'mega']
    triggers: ['click', 'hover']
  }
  
  // Form Organisms
  Form: {
    components: ['FormField', 'ButtonGroup', 'Alert']
    layouts: ['vertical', 'horizontal', 'inline']
    features: ['validation', 'auto-save', 'multi-step']
  }
  
  DataTable: {
    components: ['Table', 'Pagination', 'SearchBox', 'Filters']
    features: ['sorting', 'filtering', 'selection', 'expansion', 'virtual-scrolling']
    variants: ['simple', 'interactive', 'editable']
  }
  
  // Overlay Organisms
  Modal: {
    components: ['Overlay', 'Card', 'ButtonGroup']
    sizes: ['xs', 'sm', 'md', 'lg', 'xl', 'full']
    behaviors: ['closable', 'persistent', 'stacked']
  }
  
  Drawer: {
    components: ['Overlay', 'Container', 'Header', 'Body', 'Footer']
    positions: ['top', 'right', 'bottom', 'left']
    sizes: ['sm', 'md', 'lg', 'xl', 'full']
  }
  
  Popover: {
    components: ['Trigger', 'Content', 'Arrow']
    placements: ['top', 'bottom', 'left', 'right']
    triggers: ['click', 'hover', 'focus']
  }
  
  // Feedback Organisms
  Notification: {
    components: ['Toast', 'Container']
    positions: 'toast-positions'
    behaviors: ['persistent', 'auto-dismiss', 'stacked']
  }
  
  // Layout Organisms
  Header: {
    components: ['NavBar', 'Breadcrumb', 'Actions']
    variants: ['simple', 'with-search', 'with-tabs']
  }
  
  Footer: {
    components: ['Container', 'Links', 'Text']
    variants: ['simple', 'with-columns', 'sticky']
  }
  
  // Data Visualization Organisms
  Dashboard: {
    components: ['Card', 'Stat', 'Chart', 'DataTable']
    layouts: ['grid', 'masonry', 'custom']
    features: ['resizable', 'draggable', 'configurable']
  }
}
```

## 2. Functional Component Categories

### 2.1 Core Components (Must Have - MVP)
Essential components required for basic application functionality.

```typescript
interface CoreComponents {
  layout: ['Container', 'Grid', 'Stack', 'Divider']
  typography: ['Text', 'Heading']
  forms: ['Button', 'Input', 'FormField', 'Checkbox', 'Radio', 'Select']
  feedback: ['Alert', 'Loading', 'Toast']
  navigation: ['Link', 'Breadcrumb']
  data: ['Card', 'Badge']
}
```

### 2.2 Extended Components (Nice to Have)
Components that enhance functionality and user experience.

```typescript
interface ExtendedComponents {
  forms: ['Switch', 'Slider', 'DatePicker', 'FileUpload', 'SearchBox']
  navigation: ['Menu', 'Tabs', 'Pagination', 'Stepper']
  overlay: ['Modal', 'Drawer', 'Popover', 'Tooltip']
  data: ['DataTable', 'Progress', 'Stat', 'Avatar']
  layout: ['Sidebar', 'Header', 'Footer']
}
```

### 2.3 Specialized Components (Domain Specific)
Components specific to mainframe/enterprise applications.

```typescript
interface SpecializedComponents {
  mainframe: [
    'CodeEditor',        // COBOL/JCL syntax highlighting
    'TerminalOutput',    // Mainframe job output display
    'JobStatus',         // Job execution status
    'DatasetBrowser',    // Browse mainframe datasets
    'LogViewer',         // Structured log display
    'MetricsChart',      // Performance metrics visualization
    'KnowledgeCard',     // Knowledge base entry display
    'PatternAlert',      // Pattern detection notifications
    'SearchResults',     // AI-powered search results
    'IncidentTimeline'   // Incident tracking timeline
  ]
  
  enterprise: [
    'UserProfile',       // User account management
    'PermissionMatrix',  // Role-based access control
    'AuditLog',          // System audit trail
    'SystemHealth',      // System status dashboard
    'NotificationCenter', // Centralized notifications
    'HelpDesk',          // Support ticket interface
    'DocumentViewer',    // PDF/document display
    'ExportDialog',      // Data export options
    'FilterBuilder',     // Advanced query builder
    'BulkActions'        // Batch operation interface
  ]
}
```

## 3. Usage-Based Priority Classification

### 3.1 Priority Levels
Components classified by expected usage frequency and importance.

```typescript
interface PriorityClassification {
  // P0 - Critical (Week 1-2 Implementation)
  critical: [
    'Button', 'Input', 'Text', 'Heading', 'Container',
    'Alert', 'Loading', 'Card', 'Link'
  ]
  
  // P1 - High Priority (Week 3-4 Implementation)  
  high: [
    'FormField', 'Checkbox', 'Radio', 'Select', 'Grid',
    'Stack', 'Modal', 'Toast', 'Breadcrumb', 'Badge'
  ]
  
  // P2 - Medium Priority (Week 5-8 Implementation)
  medium: [
    'DataTable', 'Menu', 'Tabs', 'Pagination', 'Progress',
    'Drawer', 'Popover', 'SearchBox', 'ButtonGroup'
  ]
  
  // P3 - Low Priority (Week 9+ Implementation)
  low: [
    'Slider', 'Switch', 'DatePicker', 'FileUpload', 'Avatar',
    'Stat', 'Skeleton', 'Stepper', 'Notification'
  ]
  
  // P4 - Specialized (As Needed Implementation)
  specialized: [
    'CodeEditor', 'TerminalOutput', 'JobStatus', 'DatasetBrowser',
    'LogViewer', 'MetricsChart', 'KnowledgeCard', 'PatternAlert'
  ]
}
```

## 4. Component File Organization

### 4.1 Directory Structure
```
src/
├── components/
│   ├── atoms/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   ├── Button.module.css
│   │   │   └── index.ts
│   │   ├── Input/
│   │   └── ...
│   ├── molecules/
│   │   ├── FormField/
│   │   ├── SearchBox/
│   │   └── ...
│   ├── organisms/
│   │   ├── Modal/
│   │   ├── DataTable/
│   │   └── ...
│   └── specialized/
│       ├── mainframe/
│       │   ├── CodeEditor/
│       │   └── ...
│       └── enterprise/
├── tokens/
│   ├── colors.ts
│   ├── spacing.ts
│   ├── typography.ts
│   └── index.ts
├── hooks/
├── utils/
└── types/
```

### 4.2 Export Strategy
```typescript
// Individual component exports
export { Button } from './components/atoms/Button'
export { FormField } from './components/molecules/FormField'
export { Modal } from './components/organisms/Modal'

// Category exports
export * from './components/atoms'
export * from './components/molecules'
export * from './components/organisms'

// Specialized exports
export * from './components/specialized/mainframe'
export * from './components/specialized/enterprise'

// Main library export
export * from './components'
export * from './tokens'
export * from './hooks'
export * from './utils'
```

## 5. Component Naming Conventions

### 5.1 Component Names
- **PascalCase**: All component names use PascalCase (Button, FormField, DataTable)
- **Descriptive**: Names clearly indicate purpose and functionality
- **Consistent**: Related components use consistent naming patterns
- **Avoid Abbreviations**: Use full words for clarity (Button vs Btn)

### 5.2 Prop Naming
- **camelCase**: All props use camelCase (isDisabled, backgroundColor)
- **Boolean Props**: Use "is", "has", "can", "should" prefixes (isLoading, hasError)
- **Event Handlers**: Use "on" prefix (onClick, onSubmit, onChange)
- **Semantic Names**: Props reflect purpose not implementation (variant vs className)

### 5.3 Variant Naming
```typescript
// Size variants
sizes: 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Color variants
colors: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'

// Visual variants
variants: 'solid' | 'outline' | 'ghost' | 'link'

// State variants
states: 'default' | 'hover' | 'active' | 'disabled' | 'loading'
```

## 6. Component Composition Patterns

### 6.1 Compound Components
Components that work together as a cohesive unit.

```typescript
// Example: Card compound component
<Card>
  <Card.Header>
    <Card.Title>Knowledge Entry</Card.Title>
    <Card.Actions>
      <Button variant="ghost">Edit</Button>
    </Card.Actions>
  </Card.Header>
  <Card.Body>
    <Text>Problem description...</Text>
  </Card.Body>
  <Card.Footer>
    <Badge>VSAM</Badge>
    <Badge>Status 35</Badge>
  </Card.Footer>
</Card>

// Example: Menu compound component
<Menu>
  <Menu.Button>Actions</Menu.Button>
  <Menu.List>
    <Menu.Item>Edit</Menu.Item>
    <Menu.Item>Delete</Menu.Item>
    <Menu.Divider />
    <Menu.Item>Archive</Menu.Item>
  </Menu.List>
</Menu>
```

### 6.2 Polymorphic Components
Components that can render as different HTML elements.

```typescript
// Button can render as button, a, or div
<Button as="a" href="/link">Link Button</Button>
<Button as="div" onClick={handler}>Div Button</Button>

// Text can render as different HTML elements
<Text as="p">Paragraph text</Text>
<Text as="span">Inline text</Text>
```

### 6.3 Render Props Pattern
Components that accept functions as children for flexible rendering.

```typescript
// Data fetching component
<DataFetcher url="/api/knowledge">
  {({ data, loading, error }) => (
    <>
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}
      {data && <DataTable data={data} />}
    </>
  )}
</DataFetcher>
```

## 7. Accessibility Patterns by Component Type

### 7.1 Form Components
- **Labels**: All form controls have associated labels
- **Error States**: Clear error messaging with ARIA attributes
- **Validation**: Real-time feedback with screen reader announcements
- **Keyboard Navigation**: Tab order and Enter/Space key handling

### 7.2 Interactive Components
- **Focus Management**: Visible focus indicators and logical tab order
- **ARIA Attributes**: Proper roles, states, and properties
- **Keyboard Support**: Complete keyboard accessibility
- **Screen Reader**: Descriptive text and state announcements

### 7.3 Navigation Components
- **Landmarks**: Proper ARIA landmarks and page structure
- **Skip Links**: Skip to main content functionality
- **Current Page**: Clear indication of current location
- **Breadcrumbs**: Accessible navigation hierarchy

## 8. Performance Considerations by Category

### 8.1 Bundle Size Optimization
- **Atoms**: < 5KB each (very lightweight)
- **Molecules**: < 15KB each (moderate complexity)
- **Organisms**: < 30KB each (complex but optimized)
- **Specialized**: Variable (loaded on demand)

### 8.2 Rendering Performance
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large data sets (DataTable, Menu)
- **Lazy Loading**: Non-critical components loaded on demand
- **Code Splitting**: Route-based and component-based splitting

This taxonomy provides a clear, scalable structure for organizing and implementing the component library while maintaining consistency, performance, and accessibility standards.