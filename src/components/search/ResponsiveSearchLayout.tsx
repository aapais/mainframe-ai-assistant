/**
 * ResponsiveSearchLayout - Mobile-First Responsive Search Container
 *
 * Provides adaptive layout for search interface:
 * - Mobile-first responsive design
 * - Collapsible sidebars for mobile
 * - Touch-friendly interactions
 * - Swipe gestures support
 * - Keyboard navigation optimization
 * - Accessibility focus management
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  ReactNode
} from 'react';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

// ========================
// Types & Interfaces
// ========================

export interface ResponsiveSearchLayoutProps {
  /** Search input component */
  searchInput: ReactNode;
  /** Filters sidebar content */
  filtersContent?: ReactNode;
  /** Main results content */
  resultsContent: ReactNode;
  /** Preview sidebar content */
  previewContent?: ReactNode;
  /** Custom CSS className */
  className?: string;
  /** Initial filters visibility */
  initialFiltersVisible?: boolean;
  /** Initial preview visibility */
  initialPreviewVisible?: boolean;
  /** Enable swipe gestures */
  enableSwipeGestures?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Mobile breakpoint */
  mobileBreakpoint?: number;
  /** Tablet breakpoint */
  tabletBreakpoint?: number;
  /** Header content */
  headerContent?: ReactNode;
  /** Toolbar content */
  toolbarContent?: ReactNode;

  // Event handlers
  onFiltersToggle?: (visible: boolean) => void;
  onPreviewToggle?: (visible: boolean) => void;
  onLayoutChange?: (layout: LayoutType) => void;
}

export type LayoutType = 'mobile' | 'tablet' | 'desktop' | 'wide';

interface PanelState {
  filters: boolean;
  preview: boolean;
  fullscreen: boolean;
}

interface SwipeGesture {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  isActive: boolean;
}

// ========================
// Constants
// ========================

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const ANIMATION_DURATION = 300;

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
  wide: 1536
} as const;

const LAYOUT_CONFIGURATIONS = {
  mobile: {
    filtersOverlay: true,
    previewOverlay: true,
    singleColumn: true,
    stackOrder: ['search', 'results', 'filters', 'preview']
  },
  tablet: {
    filtersOverlay: false,
    previewOverlay: true,
    singleColumn: false,
    stackOrder: ['search', 'filters', 'results', 'preview']
  },
  desktop: {
    filtersOverlay: false,
    previewOverlay: false,
    singleColumn: false,
    stackOrder: ['filters', 'search', 'results', 'preview']
  },
  wide: {
    filtersOverlay: false,
    previewOverlay: false,
    singleColumn: false,
    stackOrder: ['filters', 'search', 'results', 'preview']
  }
} as const;

// ========================
// Custom Hooks
// ========================

const useSwipeGestures = (
  enabled: boolean,
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void
) => {
  const [gesture, setGesture] = useState<SwipeGesture>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null,
    isActive: false
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    setGesture(prev => ({
      ...prev,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isActive: true
    }));
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !gesture.isActive || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    setGesture(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX,
      deltaY,
      direction: Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX > 0 ? 'right' : 'left'
        : deltaY > 0 ? 'down' : 'up'
    }));
  }, [enabled, gesture.isActive, gesture.startX, gesture.startY]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !gesture.isActive) return;

    const { deltaX, direction } = gesture;
    const velocity = Math.abs(deltaX) / ANIMATION_DURATION;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD && velocity > SWIPE_VELOCITY_THRESHOLD) {
      if (direction === 'left') {
        onSwipeLeft?.();
      } else if (direction === 'right') {
        onSwipeRight?.();
      }
    }

    setGesture(prev => ({
      ...prev,
      isActive: false,
      deltaX: 0,
      deltaY: 0,
      direction: null
    }));
  }, [enabled, gesture, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return gesture;
};

const useResponsiveLayout = (
  mobileBreakpoint = BREAKPOINTS.mobile,
  tabletBreakpoint = BREAKPOINTS.tablet
): LayoutType => {
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint}px)`);
  const isTablet = useMediaQuery(`(max-width: ${tabletBreakpoint}px)`);
  const isWide = useMediaQuery(`(min-width: ${BREAKPOINTS.wide}px)`);

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  if (isWide) return 'wide';
  return 'desktop';
};

// ========================
// Sub-components
// ========================

const MobileHeader = memo<{
  onFiltersToggle: () => void;
  onPreviewToggle: () => void;
  onFullscreenToggle: () => void;
  filtersVisible: boolean;
  previewVisible: boolean;
  fullscreen: boolean;
  headerContent?: ReactNode;
}>(({
  onFiltersToggle,
  onPreviewToggle,
  onFullscreenToggle,
  filtersVisible,
  previewVisible,
  fullscreen,
  headerContent
}) => (
  <div className="mobile-header flex items-center justify-between p-4 bg-white border-b border-gray-200">
    <button
      onClick={onFiltersToggle}
      className={`p-2 rounded-lg transition-colors ${
        filtersVisible ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
      }`}
      aria-label="Toggle filters"
    >
      <Filter size={20} />
    </button>

    <div className="flex-1 mx-4">
      {headerContent}
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={onPreviewToggle}
        className={`p-2 rounded-lg transition-colors ${
          previewVisible ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
        aria-label="Toggle preview"
      >
        <Eye size={20} />
      </button>

      <button
        onClick={onFullscreenToggle}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
    </div>
  </div>
));

const SidebarOverlay = memo<{
  visible: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  children: ReactNode;
  title: string;
}>(({ visible, onClose, side, children, title }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        ref={overlayRef}
        className={`
          relative bg-white h-full w-80 max-w-[85vw] shadow-xl
          ${side === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right ml-auto'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${side}-sidebar-title`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id={`${side}-sidebar-title`} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
});

const SwipeIndicator = memo<{
  direction: 'left' | 'right';
  visible: boolean;
}>(({ direction, visible }) => {
  if (!visible) return null;

  return (
    <div
      className={`
        fixed top-1/2 transform -translate-y-1/2 z-40
        ${direction === 'left' ? 'left-4' : 'right-4'}
        bg-blue-500 text-white p-3 rounded-full shadow-lg
        animate-pulse
      `}
    >
      {direction === 'left' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </div>
  );
});

// ========================
// Main Component
// ========================

export const ResponsiveSearchLayout = memo<ResponsiveSearchLayoutProps>(({
  searchInput,
  filtersContent,
  resultsContent,
  previewContent,
  className = '',
  initialFiltersVisible = false,
  initialPreviewVisible = false,
  enableSwipeGestures = true,
  enableKeyboardShortcuts = true,
  mobileBreakpoint = BREAKPOINTS.mobile,
  tabletBreakpoint = BREAKPOINTS.tablet,
  headerContent,
  toolbarContent,
  onFiltersToggle,
  onPreviewToggle,
  onLayoutChange
}) => {
  // ========================
  // State Management
  // ========================

  const [panelState, setPanelState] = useState<PanelState>({
    filters: initialFiltersVisible,
    preview: initialPreviewVisible,
    fullscreen: false
  });

  // ========================
  // Layout Detection
  // ========================

  const layout = useResponsiveLayout(mobileBreakpoint, tabletBreakpoint);
  const config = LAYOUT_CONFIGURATIONS[layout];

  // ========================
  // Event Handlers
  // ========================

  const toggleFilters = useCallback(() => {
    setPanelState(prev => {
      const newState = { ...prev, filters: !prev.filters };
      onFiltersToggle?.(newState.filters);
      return newState;
    });
  }, [onFiltersToggle]);

  const togglePreview = useCallback(() => {
    setPanelState(prev => {
      const newState = { ...prev, preview: !prev.preview };
      onPreviewToggle?.(newState.preview);
      return newState;
    });
  }, [onPreviewToggle]);

  const toggleFullscreen = useCallback(() => {
    setPanelState(prev => ({ ...prev, fullscreen: !prev.fullscreen }));
  }, []);

  const closeFilters = useCallback(() => {
    setPanelState(prev => ({ ...prev, filters: false }));
    onFiltersToggle?.(false);
  }, [onFiltersToggle]);

  const closePreview = useCallback(() => {
    setPanelState(prev => ({ ...prev, preview: false }));
    onPreviewToggle?.(false);
  }, [onPreviewToggle]);

  // ========================
  // Swipe Gestures
  // ========================

  const swipeGesture = useSwipeGestures(
    enableSwipeGestures && layout === 'mobile',
    () => {
      // Swipe left - show preview
      if (previewContent && !panelState.preview) {
        togglePreview();
      }
    },
    () => {
      // Swipe right - show filters
      if (filtersContent && !panelState.filters) {
        toggleFilters();
      }
    }
  );

  // ========================
  // Keyboard Shortcuts
  // ========================

  const { shortcuts } = useKeyboardShortcuts({
    'ctrl+shift+f': toggleFilters,
    'ctrl+shift+p': togglePreview,
    'f11': toggleFullscreen,
    'escape': () => {
      if (panelState.filters) closeFilters();
      if (panelState.preview) closePreview();
      if (panelState.fullscreen) toggleFullscreen();
    }
  }, { enabled: enableKeyboardShortcuts });

  // ========================
  // Effects
  // ========================

  useEffect(() => {
    onLayoutChange?.(layout);
  }, [layout, onLayoutChange]);

  // Close overlays when layout changes
  useEffect(() => {
    if (layout !== 'mobile') {
      if (config.filtersOverlay && panelState.filters) {
        closeFilters();
      }
      if (config.previewOverlay && panelState.preview) {
        closePreview();
      }
    }
  }, [layout, config, panelState.filters, panelState.preview, closeFilters, closePreview]);

  // ========================
  // Render Logic
  // ========================

  const renderMobileLayout = () => (
    <div className={`mobile-search-layout flex flex-col h-full ${className}`}>
      {/* Mobile Header */}
      <MobileHeader
        onFiltersToggle={toggleFilters}
        onPreviewToggle={togglePreview}
        onFullscreenToggle={toggleFullscreen}
        filtersVisible={panelState.filters}
        previewVisible={panelState.preview}
        fullscreen={panelState.fullscreen}
        headerContent={headerContent}
      />

      {/* Search Input */}
      <div className="search-input-container p-4 bg-white border-b border-gray-200">
        {searchInput}
      </div>

      {/* Toolbar */}
      {toolbarContent && (
        <div className="toolbar-container border-b border-gray-200">
          {toolbarContent}
        </div>
      )}

      {/* Results */}
      <div className="results-container flex-1 overflow-hidden">
        {resultsContent}
      </div>

      {/* Filters Overlay */}
      {filtersContent && (
        <SidebarOverlay
          visible={panelState.filters}
          onClose={closeFilters}
          side="left"
          title="Filters"
        >
          {filtersContent}
        </SidebarOverlay>
      )}

      {/* Preview Overlay */}
      {previewContent && (
        <SidebarOverlay
          visible={panelState.preview}
          onClose={closePreview}
          side="right"
          title="Preview"
        >
          {previewContent}
        </SidebarOverlay>
      )}

      {/* Swipe Indicators */}
      <SwipeIndicator
        direction="right"
        visible={swipeGesture.direction === 'right' && swipeGesture.isActive}
      />
      <SwipeIndicator
        direction="left"
        visible={swipeGesture.direction === 'left' && swipeGesture.isActive}
      />
    </div>
  );

  const renderDesktopLayout = () => (
    <div className={`desktop-search-layout flex flex-col h-full ${className}`}>
      {/* Header */}
      {headerContent && (
        <div className="header-container border-b border-gray-200">
          {headerContent}
        </div>
      )}

      {/* Search Input */}
      <div className="search-input-container p-4 bg-white border-b border-gray-200">
        {searchInput}
      </div>

      {/* Toolbar */}
      {toolbarContent && (
        <div className="toolbar-container border-b border-gray-200">
          {toolbarContent}
        </div>
      )}

      {/* Main Content */}
      <div className="main-content flex flex-1 min-h-0">
        {/* Filters Sidebar */}
        {filtersContent && panelState.filters && (
          <div className="filters-sidebar w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
            {filtersContent}
          </div>
        )}

        {/* Results Area */}
        <div className="results-area flex-1 min-w-0 overflow-hidden">
          {resultsContent}
        </div>

        {/* Preview Sidebar */}
        {previewContent && panelState.preview && (
          <div className="preview-sidebar w-96 bg-white border-l border-gray-200 overflow-y-auto">
            {previewContent}
          </div>
        )}
      </div>
    </div>
  );

  const renderTabletLayout = () => (
    <div className={`tablet-search-layout flex flex-col h-full ${className}`}>
      {/* Header */}
      {headerContent && (
        <div className="header-container border-b border-gray-200">
          {headerContent}
        </div>
      )}

      {/* Search Input */}
      <div className="search-input-container p-4 bg-white border-b border-gray-200">
        {searchInput}
      </div>

      {/* Toolbar */}
      {toolbarContent && (
        <div className="toolbar-container border-b border-gray-200">
          {toolbarContent}
        </div>
      )}

      {/* Main Content */}
      <div className="main-content flex flex-1 min-h-0">
        {/* Filters Sidebar */}
        {filtersContent && panelState.filters && (
          <div className="filters-sidebar w-72 bg-gray-50 border-r border-gray-200 overflow-y-auto">
            {filtersContent}
          </div>
        )}

        {/* Results Area */}
        <div className="results-area flex-1 min-w-0 overflow-hidden">
          {resultsContent}
        </div>
      </div>

      {/* Preview Overlay */}
      {previewContent && (
        <SidebarOverlay
          visible={panelState.preview}
          onClose={closePreview}
          side="right"
          title="Preview"
        >
          {previewContent}
        </SidebarOverlay>
      )}
    </div>
  );

  // ========================
  // Main Render
  // ========================

  const layoutRenderers = {
    mobile: renderMobileLayout,
    tablet: renderTabletLayout,
    desktop: renderDesktopLayout,
    wide: renderDesktopLayout
  };

  return (
    <div
      className={`responsive-search-layout ${layout}-layout ${
        panelState.fullscreen ? 'fullscreen' : ''
      }`}
      data-layout={layout}
      data-filters-visible={panelState.filters}
      data-preview-visible={panelState.preview}
      data-fullscreen={panelState.fullscreen}
    >
      {layoutRenderers[layout]()}

      {/* Keyboard shortcuts help (screen reader only) */}
      {enableKeyboardShortcuts && (
        <div className="sr-only" aria-live="polite">
          Available shortcuts: {shortcuts.map(s => s.displayText).join(', ')}
        </div>
      )}
    </div>
  );
});

ResponsiveSearchLayout.displayName = 'ResponsiveSearchLayout';

export default ResponsiveSearchLayout;