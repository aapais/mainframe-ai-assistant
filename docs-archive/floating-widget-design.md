# Floating Cost Summary Widget - Technical Specification

## Overview

This specification defines a floating Cost Summary widget system that provides users with persistent access to cost information while maintaining an unobtrusive user experience.

## Architecture Decision Records (ADRs)

### ADR-001: Component Architecture Pattern
**Decision**: Use composition pattern with compound components
**Rationale**: Provides flexibility, reusability, and clear separation of concerns
**Trade-offs**: Slightly more complex than monolithic component but much more maintainable

### ADR-002: State Management Strategy
**Decision**: Combine React Context for global state with localStorage for persistence
**Rationale**: Lightweight solution that doesn't require external state management libraries
**Trade-offs**: Less scalable than Redux but sufficient for widget-specific state

### ADR-003: Positioning Strategy
**Decision**: Use CSS `position: fixed` with transform animations
**Rationale**: Consistent positioning across viewport changes, smooth animations
**Trade-offs**: Requires careful z-index management

## System Architecture

### High-Level Component Hierarchy

```
FloatingCostWidget (Provider)
├── WidgetContainer (Layout & Positioning)
│   ├── WidgetToggle (Show/Hide Trigger)
│   └── WidgetContent (Conditional Render)
│       ├── WidgetHeader (Title & Controls)
│       │   ├── Title
│       │   ├── MinimizeButton
│       │   └── CloseButton
│       ├── CostSummaryContent (Data Display)
│       │   ├── CostBreakdown
│       │   ├── TotalCost
│       │   └── LastUpdated
│       └── WidgetFooter (Actions)
│           ├── RefreshButton
│           └── SettingsLink
```

### Core Components Specification

#### 1. FloatingCostWidget (Root Provider)

```typescript
interface FloatingCostWidgetProps {
  children: React.ReactNode;
  initialPosition?: WidgetPosition;
  costData?: CostData;
  onCostUpdate?: (data: CostData) => void;
  settings?: WidgetSettings;
}

interface WidgetPosition {
  side: 'left' | 'right';
  top: number; // percentage from top
  offset: number; // pixels from edge
}

interface WidgetSettings {
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  showAnimations: boolean;
  showInMobileView: boolean;
  persistPosition: boolean;
}

interface CostData {
  totalCost: number;
  currency: string;
  breakdown: CostBreakdownItem[];
  lastUpdated: Date;
  isLoading: boolean;
  error?: string;
}

interface CostBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
}
```

#### 2. WidgetContainer (Layout & Positioning)

```typescript
interface WidgetContainerProps {
  position: WidgetPosition;
  isVisible: boolean;
  isMinimized: boolean;
  isAnimated: boolean;
  onPositionChange: (position: WidgetPosition) => void;
  className?: string;
}
```

**Key Responsibilities**:
- Fixed positioning management
- Drag-and-drop repositioning
- Animation state handling
- Viewport boundary detection
- Z-index management

#### 3. WidgetToggle (Show/Hide Control)

```typescript
interface WidgetToggleProps {
  isVisible: boolean;
  position: WidgetPosition;
  onToggle: () => void;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
}
```

**Key Responsibilities**:
- Toggle widget visibility
- Persistent toggle button when widget is hidden
- Accessibility support
- Visual feedback

#### 4. CostSummaryContent (Data Display)

```typescript
interface CostSummaryContentProps {
  data: CostData;
  isMinimized: boolean;
  settings: WidgetSettings;
  onRefresh: () => void;
  onError: (error: Error) => void;
  className?: string;
}
```

**Key Responsibilities**:
- Cost data visualization
- Loading and error states
- Real-time updates
- Responsive layout switching

## State Management Architecture

### Context Structure

```typescript
interface WidgetContextValue {
  // Display State
  isVisible: boolean;
  isMinimized: boolean;
  position: WidgetPosition;

  // Data State
  costData: CostData;

  // Settings State
  settings: WidgetSettings;

  // Actions
  toggleVisibility: () => void;
  toggleMinimized: () => void;
  updatePosition: (position: WidgetPosition) => void;
  updateCostData: (data: CostData) => void;
  updateSettings: (settings: Partial<WidgetSettings>) => void;
  refreshData: () => Promise<void>;
}
```

### LocalStorage Schema

```typescript
interface WidgetPersistedState {
  version: string; // for migration handling
  isVisible: boolean;
  position: WidgetPosition;
  settings: WidgetSettings;
  lastSessionData?: {
    costData: CostData;
    timestamp: number;
  };
}
```

## Styling Strategy

### CSS Architecture (Tailwind-based)

#### Base Styles
```css
/* Widget Container Base Classes */
.widget-container {
  @apply fixed z-50 pointer-events-auto;
  @apply bg-white/95 backdrop-blur-sm;
  @apply border border-gray-200 rounded-lg shadow-lg;
  @apply min-w-[280px] max-w-[400px];
}

.widget-container--minimized {
  @apply w-12 h-12 rounded-full;
  @apply flex items-center justify-center;
}

.widget-container--left {
  @apply left-4;
}

.widget-container--right {
  @apply right-4;
}
```

#### Animation Classes
```css
/* Slide animations */
.widget-enter {
  @apply transform transition-all duration-300 ease-out;
  @apply translate-x-full opacity-0;
}

.widget-enter-active {
  @apply translate-x-0 opacity-100;
}

.widget-exit {
  @apply transform transition-all duration-300 ease-in;
  @apply translate-x-0 opacity-100;
}

.widget-exit-active {
  @apply translate-x-full opacity-0;
}

/* Minimize/expand animations */
.widget-content-transition {
  @apply transition-all duration-200 ease-out;
  @apply overflow-hidden;
}
```

#### Responsive Design Classes
```css
/* Mobile-first responsive design */
.widget-container {
  @apply sm:min-w-[320px] lg:min-w-[280px];
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .widget-container {
    @apply left-2 right-2 w-auto max-w-none;
    @apply bottom-4 top-auto;
  }

  .widget-container--minimized {
    @apply fixed bottom-4 right-4 w-14 h-14;
  }
}
```

### Z-Index Management

```typescript
const Z_INDEX_LAYERS = {
  WIDGET_BACKDROP: 1000,
  WIDGET_CONTAINER: 1010,
  WIDGET_TOGGLE: 1020,
  WIDGET_TOOLTIP: 1030,
} as const;
```

## Animation Strategy

### Animation Framework Choice
**Decision**: Use Framer Motion for complex animations, CSS transitions for simple ones
**Rationale**: Framer Motion provides declarative animations with React integration

### Animation Specifications

#### 1. Widget Entry/Exit
```typescript
const widgetVariants = {
  hidden: {
    x: "100%",
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    x: "100%",
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};
```

#### 2. Minimize/Expand Animation
```typescript
const contentVariants = {
  minimized: {
    height: 0,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeInOut",
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};
```

#### 3. Data Update Animation
```typescript
const dataUpdateVariants = {
  stable: { scale: 1, transition: { duration: 0.1 } },
  updating: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 0.4,
      times: [0, 0.5, 1],
    }
  },
};
```

## Mobile Responsiveness Plan

### Breakpoint Strategy
- **Mobile** (< 640px): Bottom-anchored, full-width when expanded
- **Tablet** (640px - 1024px): Side-anchored, responsive width
- **Desktop** (> 1024px): Side-anchored, fixed width

### Mobile-Specific Behaviors

1. **Positioning**:
   - Always bottom-anchored on mobile
   - Full-width expansion when open
   - Floating action button style when minimized

2. **Interactions**:
   - Touch-friendly tap targets (minimum 44px)
   - Swipe gestures for minimize/expand
   - Pull-to-refresh for data updates

3. **Performance**:
   - Reduced animation complexity on low-end devices
   - Lazy loading of chart components
   - Optimized re-renders

### Responsive Component Implementation

```typescript
const useResponsiveWidget = () => {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) setScreenSize('mobile');
      else if (width < 1024) setScreenSize('tablet');
      else setScreenSize('desktop');
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return screenSize;
};
```

## Integration Points

### 1. App Layout Integration

```typescript
// App.tsx
function App() {
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Routes>
          {/* App routes */}
        </Routes>
      </main>
      <Footer />

      {/* Widget Portal */}
      <FloatingCostWidget
        initialPosition={{ side: 'right', top: 20, offset: 16 }}
        settings={{
          autoRefresh: true,
          refreshInterval: 30,
          showAnimations: true,
          showInMobileView: true,
          persistPosition: true,
        }}
      />
    </div>
  );
}
```

### 2. Settings Page Integration

```typescript
// Settings/WidgetSettings.tsx
interface WidgetSettingsProps {
  settings: WidgetSettings;
  onSettingsChange: (settings: WidgetSettings) => void;
}

const WidgetSettingsPanel: React.FC<WidgetSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <div className="settings-panel">
      <h3>Cost Widget Settings</h3>

      <ToggleSwitch
        label="Show Cost Widget"
        checked={settings.showWidget}
        onChange={(checked) =>
          onSettingsChange({ ...settings, showWidget: checked })
        }
      />

      <PositionSelector
        position={settings.position}
        onChange={(position) =>
          onSettingsChange({ ...settings, position })
        }
      />

      {/* Additional settings */}
    </div>
  );
};
```

### 3. Data Fetching Strategy

```typescript
// hooks/useCostData.ts
interface UseCostDataOptions {
  autoRefresh: boolean;
  refreshInterval: number;
  onError: (error: Error) => void;
}

const useCostData = (options: UseCostDataOptions) => {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCostData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getCostSummary();
      setData(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch cost data');
      setError(error);
      options.onError(error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  // Auto-refresh logic
  useEffect(() => {
    if (!options.autoRefresh) return;

    const interval = setInterval(fetchCostData, options.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, fetchCostData]);

  return { data, loading, error, refetch: fetchCostData };
};
```

### 4. Event Handling Architecture

```typescript
// Custom events for widget communication
interface WidgetEvents {
  'widget:show': CustomEvent<void>;
  'widget:hide': CustomEvent<void>;
  'widget:position-change': CustomEvent<WidgetPosition>;
  'widget:data-update': CustomEvent<CostData>;
  'widget:error': CustomEvent<Error>;
}

// Event dispatcher hook
const useWidgetEvents = () => {
  const dispatch = useCallback(<K extends keyof WidgetEvents>(
    type: K,
    detail: WidgetEvents[K]['detail']
  ) => {
    const event = new CustomEvent(type, { detail });
    window.dispatchEvent(event);
  }, []);

  const subscribe = useCallback(<K extends keyof WidgetEvents>(
    type: K,
    handler: (event: WidgetEvents[K]) => void
  ) => {
    window.addEventListener(type, handler as EventListener);
    return () => window.removeEventListener(type, handler as EventListener);
  }, []);

  return { dispatch, subscribe };
};
```

## Performance Considerations

### 1. Rendering Optimization
- Use `React.memo` for all widget components
- Implement virtual scrolling for large cost breakdowns
- Debounce position updates during drag operations

### 2. Memory Management
- Clean up event listeners and intervals
- Implement data caching with TTL
- Use weak references for cross-component communication

### 3. Bundle Size Impact
- Lazy load chart components
- Use dynamic imports for animation libraries
- Tree-shake unused utility functions

## Testing Strategy

### Unit Tests
- Component rendering with various props
- State management logic
- Utility functions for positioning and calculations

### Integration Tests
- Widget lifecycle (show/hide/minimize)
- Settings persistence
- Data fetching and error handling

### E2E Tests
- User interaction flows
- Cross-browser compatibility
- Mobile responsiveness

## Security Considerations

### Data Handling
- Sanitize all cost data before display
- Implement proper error boundaries
- Validate localStorage data before parsing

### Performance Security
- Rate limit API calls
- Implement proper CORS handling
- Sanitize user-provided position data

## Migration Strategy

### Version Compatibility
- Implement schema versioning for localStorage
- Provide migration functions for settings updates
- Graceful degradation for missing features

### Rollback Plan
- Feature flags for widget enablement
- Fallback to previous widget version
- Data export/import capabilities

## Future Enhancements

### Phase 2 Features
- Multiple widget support
- Custom widget themes
- Advanced charting capabilities
- Widget sharing between users

### Technical Debt
- Migration to more robust state management if needed
- Performance monitoring integration
- Accessibility compliance audit

---

This specification provides a comprehensive foundation for implementing a robust, scalable floating Cost Summary widget system that follows React best practices and modern web development standards.