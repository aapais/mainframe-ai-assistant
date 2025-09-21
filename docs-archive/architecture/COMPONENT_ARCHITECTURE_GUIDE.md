# Enhanced Component Architecture Guide

## Overview

This guide documents the enhanced component architecture patterns implemented for the Mainframe KB Assistant, providing advanced React patterns, state management, performance optimization, accessibility features, and design system integration.

## Table of Contents

1. [Enhanced Component Base Classes](#enhanced-component-base-classes)
2. [Advanced State Management](#advanced-state-management)
3. [Component Composition & HOC Patterns](#component-composition--hoc-patterns)
4. [Virtual Scrolling & Performance](#virtual-scrolling--performance)
5. [Accessibility-First Architecture](#accessibility-first-architecture)
6. [Design System & Theming](#design-system--theming)
7. [Performance Monitoring](#performance-monitoring)
8. [Usage Examples](#usage-examples)
9. [Best Practices](#best-practices)

## Enhanced Component Base Classes

### BaseComponent Class

Provides foundational functionality for all components:

```typescript
import { BaseComponent } from '../base/ComponentBase';

class MyComponent extends BaseComponent<Props, State> {
  protected renderContent() {
    return (
      <div ref={this.elementRef}>
        {/* Component content */}
      </div>
    );
  }

  protected onResize(entry: ResizeObserverEntry) {
    // Handle resize events
  }

  protected onVisibilityChange(isVisible: boolean) {
    // Handle visibility changes
  }
}
```

### useBaseComponent Hook

Functional component equivalent:

```typescript
import { useBaseComponent } from '../base/ComponentBase';

const MyComponent = () => {
  const { elementRef, state, handlers, generateId } = useBaseComponent({
    performanceTracking: true,
    onMount: () => console.log('Component mounted'),
    onUnmount: () => console.log('Component unmounted')
  });

  return (
    <div ref={elementRef} {...handlers}>
      {/* Component content */}
    </div>
  );
};
```

### Enhanced Error Boundary

```typescript
import { EnhancedErrorBoundary } from '../base/ComponentBase';

<EnhancedErrorBoundary
  fallback={<div>Something went wrong</div>}
  onError={(error, errorInfo) => {
    // Log error to monitoring service
  }}
>
  <MyComponent />
</EnhancedErrorBoundary>
```

## Advanced State Management

### Enhanced State Manager

Powerful state management with middleware support:

```typescript
import { useEnhancedState, createLoggerMiddleware } from '../state/StateManager';

const [state, dispatch, manager] = useEnhancedState({
  initialState: { count: 0 },
  actions: {
    increment: (state) => ({ count: state.count + 1 }),
    decrement: (state) => ({ count: state.count - 1 })
  },
  middleware: [createLoggerMiddleware()],
  persistence: {
    key: 'my-component-state',
    storage: 'localStorage'
  },
  devTools: true
});

// Usage
dispatch({ type: 'increment' });
```

### Context-Based State Management

```typescript
import { createStateProvider } from '../state/StateManager';

const { StateProvider, useStateContext } = createStateProvider();

// Provider
<StateProvider config={stateConfig} debug={true}>
  <App />
</StateProvider>

// Consumer
const { state, dispatch } = useStateContext();
```

### Optimistic Updates

```typescript
import { useOptimisticUpdates } from '../state/StateManager';

const { value, isUpdating, error, performUpdate } = useOptimisticUpdates(
  currentValue,
  async (newValue) => {
    // API call
    return await updateAPI(newValue);
  }
);

// Usage
performUpdate(newValue);
```

## Component Composition & HOC Patterns

### Higher-Order Components

#### Loading HOC

```typescript
import { withLoading } from '../composition/CompositionPatterns';

const LoadingButton = withLoading(Button, <Spinner />);

<LoadingButton loading={isSubmitting} loadingMessage="Saving...">
  Save
</LoadingButton>
```

#### Conditional Rendering HOC

```typescript
import { withConditionalRender } from '../composition/CompositionPatterns';

const ConditionalPanel = withConditionalRender(Panel);

<ConditionalPanel 
  condition={user.isAdmin} 
  fallback={<div>Access denied</div>}
>
  Admin Panel
</ConditionalPanel>
```

#### Click Outside HOC

```typescript
import { withClickOutside } from '../composition/CompositionPatterns';

const ClickOutsideModal = withClickOutside(Modal);

<ClickOutsideModal onClickOutside={() => setIsOpen(false)}>
  Modal content
</ClickOutsideModal>
```

### Compound Components

```typescript
import { createCompoundComponent } from '../composition/CompositionPatterns';

const Card = createCompoundComponent('Card', {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter
});

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### Composition Helpers

```typescript
import { compose } from '../composition/CompositionPatterns';

const EnhancedComponent = compose(
  withLoading,
  withPerformance,
  withAccessibility
)(BaseComponent);
```

## Virtual Scrolling & Performance

### Virtual List

```typescript
import { VirtualList } from '../virtualization/VirtualScrolling';

<VirtualList
  items={largeDataset}
  itemHeight={60}
  height={400}
  renderItem={({ index, item, style }) => (
    <div style={style}>
      <ItemComponent item={item} />
    </div>
  )}
  overscan={5}
  onScroll={(offset) => console.log('Scrolled to:', offset)}
/>
```

### Virtual Grid

```typescript
import { VirtualGrid } from '../virtualization/VirtualScrolling';

<VirtualGrid
  items={gridData}
  columnCount={4}
  rowHeight={100}
  columnWidth={200}
  height={600}
  width={800}
  renderItem={({ rowIndex, columnIndex, item, style }) => (
    <div style={style}>
      <GridCell item={item} />
    </div>
  )}
/>
```

### Performance Hooks

```typescript
import { useVirtualScroll, PerformanceOptimizations } from '../virtualization/VirtualScrolling';

// Custom virtual scrolling
const { virtualItems, totalSize, scrollToIndex } = useVirtualScroll(
  itemCount,
  {
    itemHeight: 50,
    containerHeight: 400,
    overscan: 10
  }
);

// Lazy loading
const { isVisible, hasBeenVisible, elementRef } = PerformanceOptimizations.useLazyLoading();
```

## Accessibility-First Architecture

### Focus Management

```typescript
import { useFocusManagement, FocusTrap } from '../accessibility/AccessibilityUtils';

const { pushFocus, popFocus, trapFocus } = useFocusManagement();

// Focus trap for modals
<FocusTrap 
  active={isModalOpen}
  restoreFocus={true}
  onEscape={() => setIsModalOpen(false)}
>
  <Modal />
</FocusTrap>
```

### Announcements

```typescript
import { useAnnouncements, LiveRegion } from '../accessibility/AccessibilityUtils';

const { announce, announceImmediate } = useAnnouncements();

// Announce changes
announce('Data has been updated');
announceImmediate('Error occurred');

// Live region component
<LiveRegion 
  message={statusMessage}
  priority="polite"
  clearAfter={3000}
/>
```

### Keyboard Navigation

```typescript
import { useKeyboardNavigation } from '../accessibility/AccessibilityUtils';

const containerRef = useRef();

useKeyboardNavigation(containerRef, {
  trapFocus: true,
  restoreFocus: true,
  onEscape: () => closeModal(),
  initialFocus: firstButtonRef
});
```

### Accessibility HOC

```typescript
import { withAccessibility } from '../accessibility/AccessibilityUtils';

const AccessibleComponent = withAccessibility(MyComponent, {
  announceChanges: true,
  focusManagement: true
});
```

## Design System & Theming

### Theme Provider

```typescript
import { ThemeProvider, useTheme } from '../design-system/ThemeSystem';

<ThemeProvider 
  defaultTheme="light" 
  enableSystemTheme={true}
  customThemes={{ custom: customTheme }}
>
  <App />
</ThemeProvider>
```

### Theme Usage

```typescript
const { theme, themeName, setTheme, toggleTheme } = useTheme();

// Use theme values
const styles = {
  backgroundColor: theme.colors.background.default,
  color: theme.colors.text.primary,
  padding: theme.spacing[4],
  borderRadius: theme.borderRadius.md,
  fontSize: theme.typography.fontSize.base
};

// Theme utilities
const primaryColor = useThemeColor('primary.500');
const responsiveSpacing = useResponsiveValue({
  base: theme.spacing[2],
  md: theme.spacing[4],
  lg: theme.spacing[6]
});
```

### Styled System

```typescript
const styled = createStyledSystem(theme);

const styles = {
  color: styled.color('primary.500'),
  padding: styled.space(4),
  fontSize: styled.fontSize('lg'),
  boxShadow: styled.shadow('md'),
  borderRadius: styled.radius('lg')
};
```

## Performance Monitoring

### Performance HOC

```typescript
import { withPerformance } from '../performance/PerformanceMonitoring';

const MonitoredComponent = withPerformance(MyComponent, {
  trackMemory: true,
  warnThreshold: 16 // ms
});

<MonitoredComponent 
  enableProfiling={true}
  onSlowRender={(time) => console.warn('Slow render:', time)}
/>
```

### Performance Hooks

```typescript
import { 
  usePerformanceTracking,
  useMemoryMonitoring,
  useSlowRenderDetection 
} from '../performance/PerformanceMonitoring';

// Track component performance
const { startTracking, endTracking } = usePerformanceTracking('MyComponent');

// Monitor memory usage
const { memoryInfo, isSupported } = useMemoryMonitoring(5000);

// Detect slow renders
const { slowRenders, averageSlowRender } = useSlowRenderDetection(16);
```

### Performance Dashboard

```typescript
import { PerformanceDashboard } from '../performance/PerformanceMonitoring';

// Development only
{process.env.NODE_ENV === 'development' && (
  <PerformanceDashboard 
    refreshInterval={5000}
    showRecommendations={true}
    onExport={(data) => downloadReport(data)}
  />
)}
```

## Usage Examples

See the complete implementation example in `src/renderer/components/examples/EnhancedComponentExample.tsx` which demonstrates:

- Enhanced state management with persistence
- Virtual scrolling for large datasets
- Full accessibility support
- Comprehensive theming
- Performance monitoring
- Component composition patterns

## Best Practices

### 1. Component Design

- **Single Responsibility**: Each component should have one clear purpose
- **Composition over Inheritance**: Use HOCs and composition patterns
- **Progressive Enhancement**: Start simple, add complexity as needed
- **Error Boundaries**: Wrap components with error boundaries

### 2. State Management

- **Local State First**: Use local state for component-specific data
- **Context for Shared State**: Use context for data shared across components
- **Immutable Updates**: Always return new state objects
- **Middleware for Side Effects**: Use middleware for logging, analytics, etc.

### 3. Performance

- **Memoization**: Use React.memo for expensive components
- **Virtual Scrolling**: Implement for large lists (>100 items)
- **Code Splitting**: Lazy load non-critical components
- **Performance Monitoring**: Monitor in development

### 4. Accessibility

- **Semantic HTML**: Use proper HTML elements
- **ARIA Labels**: Provide meaningful labels
- **Keyboard Navigation**: Ensure all functionality is keyboard accessible
- **Focus Management**: Handle focus properly in dynamic UIs
- **Screen Reader Testing**: Test with actual screen readers

### 5. Theming

- **Design Tokens**: Use consistent design tokens
- **Dark Mode Support**: Implement proper dark mode
- **Responsive Design**: Use responsive utilities
- **CSS Custom Properties**: Leverage CSS variables for dynamic theming

### 6. Testing

- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **Accessibility Tests**: Automated accessibility testing
- **Performance Tests**: Monitor performance regressions

## Migration Guide

### From Simple Components

1. **Wrap with HOCs**: Add performance monitoring and accessibility
2. **Implement Error Boundaries**: Add error handling
3. **Use Theme System**: Replace hardcoded styles
4. **Add State Management**: For complex state logic

### From Legacy Code

1. **Gradual Migration**: Migrate one component at a time
2. **Compatibility Layer**: Create adapters for legacy APIs
3. **Testing Strategy**: Comprehensive testing during migration
4. **Performance Monitoring**: Monitor during migration

## Troubleshooting

### Common Issues

1. **Performance Issues**
   - Check render frequency
   - Implement memoization
   - Use virtual scrolling for large lists

2. **Accessibility Issues**
   - Run automated accessibility tests
   - Test with keyboard navigation
   - Validate ARIA attributes

3. **Theme Issues**
   - Check CSS custom properties
   - Validate theme object structure
   - Test theme switching

4. **State Management Issues**
   - Check for state mutations
   - Validate action types
   - Test middleware configuration

## Contributing

When contributing to the component architecture:

1. Follow established patterns
2. Add comprehensive tests
3. Update documentation
4. Consider accessibility impact
5. Monitor performance impact
6. Use TypeScript strictly
7. Follow naming conventions

## Conclusion

This enhanced component architecture provides a solid foundation for building maintainable, performant, and accessible React applications. The patterns implemented here focus on:

- **Developer Experience**: Easy to use and understand
- **Performance**: Optimized for large-scale applications
- **Accessibility**: WCAG 2.1 AA compliant by default
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Easy to extend and customize

For questions or issues, refer to the component documentation or create an issue in the project repository.
