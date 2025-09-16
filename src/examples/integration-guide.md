# Responsive Layout Integration Guide
## Mainframe KB Assistant - Complete Implementation Examples

This guide provides comprehensive examples and best practices for integrating the responsive layout system in the Mainframe KB Assistant. All examples are production-ready and demonstrate real-world usage patterns.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Components Overview](#core-components-overview)
3. [Example Components](#example-components)
4. [Best Practices](#best-practices)
5. [Performance Optimization](#performance-optimization)
6. [Accessibility Guidelines](#accessibility-guidelines)
7. [Mobile-First Considerations](#mobile-first-considerations)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Basic Setup

```tsx
import React from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { ResponsiveGrid } from '../components/Layout/ResponsiveGrid';
import { useResponsive } from '../hooks/useResponsive';

function MyComponent() {
  const { device, breakpoint, isMobile } = useResponsive();

  return (
    <AppLayout
      header={<Header />}
      sidebar={!isMobile ? <Sidebar /> : null}
      footer={<Footer />}
    >
      <ResponsiveGrid
        columns={{ xs: 1, md: 2, lg: 3 }}
        gap="1rem"
        autoFit={true}
      >
        {/* Your content here */}
      </ResponsiveGrid>
    </AppLayout>
  );
}
```

### 2. Import Required Styles

```tsx
// In your main App.tsx or index.tsx
import '../styles/responsive-grid.css';
```

## Core Components Overview

### AppLayout Component

The main layout wrapper that provides consistent page structure:

```tsx
interface AppLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  sidebarCollapsed?: boolean;
  className?: string;
}

// Usage
<AppLayout
  header={<AppHeader />}
  sidebar={<AppSidebar />}
  footer={<AppFooter />}
  sidebarCollapsed={isMobile}
>
  {/* Main content */}
</AppLayout>
```

### ResponsiveGrid Component

Flexible grid system with auto-fit capabilities:

```tsx
interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: BreakpointConfig<number>;
  gap?: string;
  autoFit?: boolean;
  autoFill?: boolean;
  minItemWidth?: string;
  masonry?: boolean;
  className?: string;
}

// Usage Examples
<ResponsiveGrid
  columns={{ xs: 1, sm: 2, lg: 3, xl: 4 }}
  gap="1.5rem"
  autoFit={true}
>
  {items.map(item => <GridItem key={item.id}>{item}</GridItem>)}
</ResponsiveGrid>
```

### useResponsive Hook

Core hook providing device and breakpoint information:

```tsx
const {
  device,           // 'mobile' | 'tablet' | 'desktop'
  breakpoint,       // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  isMobile,         // boolean
  isTablet,         // boolean
  isDesktop,        // boolean
  windowSize,       // { width: number, height: number }
  orientation       // 'portrait' | 'landscape'
} = useResponsive();
```

## Example Components

### 1. KnowledgeBaseLayout

**Purpose**: Main KB interface with three-panel adaptive layout

**Key Features**:
- Responsive three-panel layout (search, results, detail)
- Mobile stack navigation
- Search functionality with categories
- Entry rating and interaction

**Usage**:
```tsx
import { KnowledgeBaseLayout } from '../examples/KnowledgeBaseLayout';

function KBPage() {
  const [selectedEntry, setSelectedEntry] = useState(null);

  return (
    <KnowledgeBaseLayout
      entries={kbEntries}
      selectedEntry={selectedEntry}
      onSearch={handleSearch}
      onEntrySelect={setSelectedEntry}
      onRateEntry={handleRating}
      isLoading={false}
    />
  );
}
```

**Breakpoint Behavior**:
- `xs-sm`: Single column stack with navigation
- `md`: Two columns (search+results, detail)
- `lg+`: Three columns (search, results, detail)

### 2. SearchResultsLayout

**Purpose**: Advanced search results with multiple view modes

**Key Features**:
- Four layout modes: grid, list, masonry, compact
- Advanced filtering and sorting
- Infinite scroll with intersection observer
- Performance optimized with virtual scrolling

**Usage**:
```tsx
import { SearchResultsLayout } from '../examples/SearchResultsLayout';

function SearchPage() {
  return (
    <SearchResultsLayout
      results={searchResults}
      layoutMode="grid"
      showFilters={true}
      onResultClick={handleResultClick}
      onLoadMore={loadMoreResults}
      hasMore={hasMoreData}
      isLoading={isSearching}
    />
  );
}
```

**Layout Modes**:
- **Grid**: Card-based responsive grid
- **List**: Compact list with metadata
- **Masonry**: Pinterest-style layout
- **Compact**: Dense information view

### 3. EntryDetailLayout

**Purpose**: Comprehensive entry detail view with tabbed content

**Key Features**:
- Tabbed interface (Overview, Code, Related, Comments)
- Responsive sidebar for related entries
- Code syntax highlighting
- Interactive rating and commenting

**Usage**:
```tsx
import { EntryDetailLayout } from '../examples/EntryDetailLayout';

function EntryPage({ entryId }) {
  return (
    <EntryDetailLayout
      entry={currentEntry}
      relatedEntries={relatedEntries}
      comments={entryComments}
      isEditable={userCanEdit}
      onEdit={handleEdit}
      onRate={handleRate}
      onComment={handleComment}
      onRelatedClick={navigateToEntry}
    />
  );
}
```

**Responsive Behavior**:
- Desktop: Main content + sidebar
- Tablet: Main content with collapsible sidebar
- Mobile: Full-width with bottom sheet for related

### 4. ResponsiveDashboard

**Purpose**: Metrics dashboard with auto-fitting cards

**Key Features**:
- Auto-fitting metric cards
- Real-time data updates
- Chart components with responsive sizing
- Configurable refresh intervals

**Usage**:
```tsx
import { ResponsiveDashboard } from '../examples/ResponsiveDashboard';

function DashboardPage() {
  return (
    <ResponsiveDashboard
      dateRange="7d"
      autoRefresh={true}
      refreshInterval={30000}
    />
  );
}
```

**Card Layout**:
- Automatically adjusts card size based on viewport
- Minimum card width: 280px
- Maximum cards per row: 6
- Graceful degradation on mobile

### 5. MobileFirstLayout

**Purpose**: Mobile-optimized KB interface

**Key Features**:
- Touch-friendly interactions
- Pull-to-refresh functionality
- Bottom navigation
- Swipe gestures for navigation

**Usage**:
```tsx
import { MobileFirstLayout } from '../examples/MobileFirstLayout';

function MobileKB() {
  return (
    <MobileFirstLayout
      entries={mobileEntries}
      onSearch={handleMobileSearch}
      onEntrySelect={handleEntrySelect}
    />
  );
}
```

**Mobile Patterns**:
- Bottom sheet modals
- Thumb-friendly button sizes (44px minimum)
- Horizontal scrolling lists
- Progressive disclosure

## Best Practices

### 1. Breakpoint Strategy

```tsx
// Define consistent breakpoints
const BREAKPOINTS = {
  xs: 0,      // 0px and up
  sm: 640,    // 640px and up
  md: 768,    // 768px and up
  lg: 1024,   // 1024px and up
  xl: 1280,   // 1280px and up
  '2xl': 1536 // 1536px and up
};

// Use breakpoint objects for responsive props
const responsiveColumns = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6
};
```

### 2. Content Strategy

```tsx
// Progressive enhancement pattern
function ResponsiveContent() {
  const { device, isMobile } = useResponsive();

  return (
    <div>
      {/* Always show core content */}
      <CoreContent />

      {/* Enhanced content for larger screens */}
      {!isMobile && <EnhancedContent />}

      {/* Device-specific optimizations */}
      {device === 'mobile' && <TouchOptimizedControls />}
      {device === 'desktop' && <KeyboardShortcuts />}
    </div>
  );
}
```

### 3. Component Composition

```tsx
// Compose layouts using smaller, focused components
function ComplexLayout() {
  return (
    <AppLayout
      header={<SearchHeader />}
      sidebar={<FilterSidebar />}
    >
      <ResponsiveGrid columns={{ xs: 1, lg: 2 }}>
        <GridItem>
          <ResultsList />
        </GridItem>
        <GridItem hideOn={['xs', 'sm']}>
          <DetailPanel />
        </GridItem>
      </ResponsiveGrid>
    </AppLayout>
  );
}
```

## Performance Optimization

### 1. Lazy Loading

```tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const DashboardCharts = lazy(() => import('./DashboardCharts'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <DashboardCharts />
    </Suspense>
  );
}
```

### 2. Memoization Patterns

```tsx
// Use smartMemo for expensive calculations
const ExpensiveComponent = smartMemo(({ data, filters }) => {
  const processedData = useMemo(() =>
    processData(data, filters), [data, filters]
  );

  return <DataVisualization data={processedData} />;
}, (prevProps, nextProps) =>
  prevProps.data === nextProps.data &&
  prevProps.filters === nextProps.filters
);
```

### 3. Virtual Scrolling

```tsx
// For large lists, use virtual scrolling
function VirtualizedResults({ items }) {
  const containerRef = useRef(null);
  const { visibleItems } = useVirtualScrolling({
    items,
    containerRef,
    itemHeight: 120
  });

  return (
    <div ref={containerRef} className="scrollable-container">
      {visibleItems.map(item =>
        <ResultCard key={item.id} data={item} />
      )}
    </div>
  );
}
```

## Accessibility Guidelines

### 1. Semantic HTML

```tsx
// Use proper semantic elements
function KBEntry({ entry }) {
  return (
    <article role="article" aria-labelledby={`entry-${entry.id}`}>
      <header>
        <h2 id={`entry-${entry.id}`}>{entry.title}</h2>
      </header>
      <section aria-label="Problem description">
        <p>{entry.problem}</p>
      </section>
      <section aria-label="Solution steps">
        <ol>{entry.solution}</ol>
      </section>
    </article>
  );
}
```

### 2. ARIA Labels and States

```tsx
function SearchInterface() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <form role="search" aria-label="Knowledge base search">
      <input
        type="search"
        aria-label="Search knowledge base"
        aria-describedby="search-help"
      />
      <button
        type="submit"
        aria-pressed={isLoading}
        aria-describedby="search-status"
      >
        Search
      </button>
      <div id="search-help">
        Enter keywords to search the knowledge base
      </div>
      <div
        id="search-status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading ? 'Searching...' : ''}
      </div>
    </form>
  );
}
```

### 3. Keyboard Navigation

```tsx
function NavigableList({ items, onSelect }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        onSelect(items[selectedIndex]);
        break;
    }
  }, [items, selectedIndex, onSelect]);

  return (
    <ul role="listbox" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          role="option"
          aria-selected={index === selectedIndex}
          tabIndex={index === selectedIndex ? 0 : -1}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}
```

## Mobile-First Considerations

### 1. Touch Targets

```css
/* Minimum touch target size */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Touch-friendly spacing */
.mobile-list-item {
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 8px;
}
```

### 2. Gesture Support

```tsx
function SwipeableCard({ onSwipeLeft, onSwipeRight, children }) {
  const swipeHandlers = useSwipeable({
    onSwipedLeft: onSwipeLeft,
    onSwipedRight: onSwipeRight,
    threshold: 50,
    preventDefaultTouchmoveEvent: true
  });

  return (
    <div {...swipeHandlers} className="swipeable-card">
      {children}
    </div>
  );
}
```

### 3. Progressive Enhancement

```tsx
function AdaptiveInterface() {
  const { device, hasTouch } = useResponsive();

  return (
    <div>
      {/* Base functionality for all devices */}
      <BaseInterface />

      {/* Touch enhancements */}
      {hasTouch && <TouchEnhancements />}

      {/* Device-specific features */}
      {device === 'mobile' && <MobileFeatures />}
      {device === 'desktop' && <DesktopFeatures />}
    </div>
  );
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Layout Shift on Resize

**Problem**: Components jump or shift during window resize

**Solution**:
```tsx
// Use stable layouts with defined dimensions
function StableLayout() {
  const { windowSize } = useResponsive();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto'
      }}
    >
      <header>Fixed Header</header>
      <main>Flexible Content</main>
      <footer>Fixed Footer</footer>
    </div>
  );
}
```

#### 2. Performance Issues with Rapid Resizing

**Problem**: Components re-render too frequently during resize

**Solution**:
```tsx
// Debounce resize events
function OptimizedComponent() {
  const debouncedResize = useDebounce(useResponsive(), 150);

  return (
    <div>
      {/* Use debounced values for expensive operations */}
      <ExpensiveComponent breakpoint={debouncedResize.breakpoint} />
    </div>
  );
}
```

#### 3. Accessibility Issues with Dynamic Content

**Problem**: Screen readers don't announce dynamic changes

**Solution**:
```tsx
function AccessibleDynamicContent() {
  const [status, setStatus] = useState('');

  return (
    <div>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status}
      </div>
      {/* Your dynamic content */}
    </div>
  );
}
```

#### 4. CSS Grid Not Supported

**Problem**: Older browsers don't support CSS Grid

**Solution**:
```css
/* Provide flexbox fallback */
.grid-container {
  display: flex;
  flex-wrap: wrap;
}

@supports (display: grid) {
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}
```

### Debug Tools

Use the built-in debug information in components:

```tsx
function DebugInfo() {
  const responsive = useResponsive();

  return (
    <div className="debug-panel">
      <h3>Debug Info</h3>
      <p>Device: {responsive.device}</p>
      <p>Breakpoint: {responsive.breakpoint}</p>
      <p>Window: {responsive.windowSize.width}x{responsive.windowSize.height}</p>
      <p>Orientation: {responsive.orientation}</p>
    </div>
  );
}
```

## Migration Guide

### From Fixed Layouts

1. **Replace fixed widths with responsive grids**:
```tsx
// Before
<div style={{ width: '300px' }}>

// After
<ResponsiveGrid columns={{ xs: 1, md: 2 }}>
```

2. **Convert media queries to breakpoint objects**:
```tsx
// Before
const isMobile = window.innerWidth < 768;

// After
const { isMobile } = useResponsive();
```

3. **Update component props**:
```tsx
// Before
<Component width={300} />

// After
<Component
  columns={{ xs: 1, sm: 2, lg: 3 }}
  gap="1rem"
/>
```

### Best Migration Practices

1. **Start with the most used components**
2. **Test on multiple devices during migration**
3. **Maintain fallbacks for critical functionality**
4. **Update CSS classes to use the responsive system**
5. **Test accessibility after each change**

## Conclusion

This guide provides comprehensive examples and patterns for implementing responsive layouts in the Mainframe KB Assistant. All example components are production-ready and demonstrate real-world usage patterns that you can copy and adapt for your specific needs.

For additional support or questions:
- Review the example components in `/src/examples/`
- Check the responsive utilities in `/src/hooks/`
- Examine the CSS grid system in `/src/styles/responsive-grid.css`

Remember: Start simple, test early and often, and always prioritize accessibility and performance in your responsive implementations.