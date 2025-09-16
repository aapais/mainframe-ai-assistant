/**
 * Responsive Layout Example
 *
 * Demonstrates usage of custom responsive hooks in the Mainframe KB Assistant
 */

import React, { useState, useCallback } from 'react';
import {
  useResponsive,
  useGridLayout,
  useDensity,
  useLayoutState,
  useResizeObserver,
  useMediaQuery,
} from '../index';

// =========================
// EXAMPLE COMPONENT: RESPONSIVE DASHBOARD
// =========================

export const ResponsiveDashboard: React.FC = () => {
  // Responsive utilities
  const { device, breakpoint, is, above, below } = useResponsive({
    debounceMs: 100,
  });

  // Media query for dark mode
  const { matches: isDarkMode } = useMediaQuery('(prefers-color-scheme: dark)');

  // Density management
  const { density, setMode, scale, cssVars, isTouchFriendly } = useDensity({
    autoSwitch: true,
    persist: true,
  });

  // Grid layout for dashboard items
  const {
    state: gridState,
    containerRef: gridRef,
    addItem,
    removeItem,
    updateItem,
  } = useGridLayout({
    config: {
      columns: {
        xs: 1,
        sm: 2,
        md: 3,
        lg: 4,
        xl: 6,
        '2xl': 8,
      },
      gap: scale(16, 'spacing'),
      minItemWidth: scale(250, 'component'),
      autoFit: true,
      dense: density.mode === 'dense',
    },
    autoLayout: true,
  });

  // Layout persistence
  const {
    layout,
    saveLayout,
    loadLayout,
    savedLayouts,
  } = useLayoutState({
    autoSave: true,
    defaultLayout: {
      name: 'KB Assistant Dashboard',
      panels: [
        {
          id: 'search-panel',
          type: 'search',
          title: 'Knowledge Base Search',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          state: { visible: true, collapsed: false, pinned: false, zIndex: 1 },
        },
        {
          id: 'results-panel',
          type: 'results',
          title: 'Search Results',
          bounds: { x: 420, y: 0, width: 600, height: 400 },
          state: { visible: true, collapsed: false, pinned: false, zIndex: 1 },
        },
        {
          id: 'metrics-panel',
          type: 'metrics',
          title: 'Usage Metrics',
          bounds: { x: 0, y: 320, width: 400, height: 200 },
          state: { visible: true, collapsed: false, pinned: false, zIndex: 1 },
          responsive: {
            xs: false, // Hide on mobile
            sm: false,
            md: true,
          },
        },
      ],
    },
  });

  // Resize observer for main container
  const { size: containerSize } = useResizeObserver({
    debounceMs: 150,
  });

  // State for demo
  const [activePanel, setActivePanel] = useState<string>('search-panel');

  // Event handlers
  const handleDensityToggle = useCallback(() => {
    const modes = ['comfortable', 'compact', 'dense'] as const;
    const currentIndex = modes.indexOf(density.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
  }, [density.mode, setMode]);

  const handlePanelToggle = useCallback((panelId: string) => {
    const panel = layout?.panels.find(p => p.id === panelId);
    if (panel) {
      // Update panel visibility in layout
      // This would connect to your actual panel management system
      setActivePanel(activePanel === panelId ? '' : panelId);
    }
  }, [layout, activePanel]);

  // Render responsive panel based on breakpoint
  const renderPanel = useCallback((panelId: string) => {
    const panel = layout?.panels.find(p => p.id === panelId);
    if (!panel) return null;

    // Check responsive visibility
    if (panel.responsive && panel.responsive[breakpoint] === false) {
      return null;
    }

    const isActive = activePanel === panelId;
    const panelStyle = {
      ...cssVars,
      width: above.md ? scale(panel.bounds.width, 'component') : '100%',
      height: scale(panel.bounds.height, 'component'),
      padding: scale(16, 'spacing'),
      border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
      borderRadius: scale(8, 'component'),
      backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
      opacity: isActive ? 1 : 0.7,
      transition: 'all 0.2s ease',
    };

    return (
      <div
        key={panelId}
        style={panelStyle}
        className={`panel ${panel.type} ${isActive ? 'active' : ''}`}
        onClick={() => handlePanelToggle(panelId)}
      >
        <h3 style={{ fontSize: scale(18, 'font'), margin: `0 0 ${scale(12, 'spacing')}px 0` }}>
          {panel.title}
        </h3>
        <div className="panel-content">
          {getPanelContent(panel.type)}
        </div>
      </div>
    );
  }, [layout, breakpoint, activePanel, above.md, scale, cssVars, isDarkMode, handlePanelToggle]);

  // Panel content based on type
  const getPanelContent = (type: string) => {
    switch (type) {
      case 'search':
        return (
          <div>
            <input
              type="text"
              placeholder="Search knowledge base..."
              style={{
                width: '100%',
                padding: scale(8, 'spacing'),
                fontSize: scale(14, 'font'),
                borderRadius: scale(4, 'component'),
                border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#000000',
              }}
            />
            <div style={{ marginTop: scale(12, 'spacing'), fontSize: scale(12, 'font') }}>
              Quick searches: VSAM, S0C7, JCL errors
            </div>
          </div>
        );

      case 'results':
        return (
          <div>
            <div style={{ fontSize: scale(14, 'font'), marginBottom: scale(8, 'spacing') }}>
              Recent searches and knowledge base entries would appear here.
            </div>
            <div style={{ fontSize: scale(12, 'font'), color: isDarkMode ? '#aaa' : '#666' }}>
              Results adapt to {breakpoint} breakpoint ({device.width}×{device.height})
            </div>
          </div>
        );

      case 'metrics':
        return (
          <div>
            <div style={{ fontSize: scale(12, 'font'), color: isDarkMode ? '#aaa' : '#666' }}>
              Usage metrics and analytics would be displayed here.
              Only visible on {breakpoint}+ screens.
            </div>
          </div>
        );

      default:
        return <div>Panel content for {type}</div>;
    }
  };

  return (
    <div
      style={{
        ...cssVars,
        minHeight: '100vh',
        backgroundColor: isDarkMode ? '#0a0a0a' : '#f5f5f5',
        padding: scale(16, 'spacing'),
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header with responsive controls */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: scale(24, 'spacing'),
          flexWrap: 'wrap',
          gap: scale(12, 'spacing'),
        }}
      >
        <h1 style={{ fontSize: scale(24, 'font'), margin: 0 }}>
          Mainframe KB Assistant
        </h1>

        <div style={{ display: 'flex', gap: scale(12, 'spacing'), alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Responsive info */}
          <div style={{ fontSize: scale(12, 'font'), color: isDarkMode ? '#aaa' : '#666' }}>
            {breakpoint} ({device.width}×{device.height})
            {device.isTouchDevice ? ' • Touch' : ' • Mouse'}
          </div>

          {/* Density toggle */}
          <button
            onClick={handleDensityToggle}
            style={{
              padding: `${scale(6, 'spacing')}px ${scale(12, 'spacing')}px`,
              fontSize: scale(12, 'font'),
              border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
              borderRadius: scale(4, 'component'),
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#000000',
              cursor: 'pointer',
              minHeight: isTouchFriendly ? scale(44, 'component') : 'auto',
            }}
          >
            Density: {density.mode}
          </button>

          {/* Layout controls */}
          {savedLayouts.length > 0 && (
            <select
              onChange={(e) => loadLayout(e.target.value)}
              style={{
                padding: scale(6, 'spacing'),
                fontSize: scale(12, 'font'),
                border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                borderRadius: scale(4, 'component'),
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#000000',
              }}
            >
              <option value="">Select Layout</option>
              {savedLayouts.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Main content area with responsive layout */}
      <main
        ref={gridRef}
        style={{
          display: is.xs ? 'flex' : 'grid',
          flexDirection: is.xs ? 'column' : undefined,
          gap: scale(16, 'spacing'),
          gridTemplateColumns: above.lg
            ? 'repeat(auto-fit, minmax(300px, 1fr))'
            : above.md
            ? 'repeat(2, 1fr)'
            : '1fr',
        }}
      >
        {layout?.panels.map(panel => renderPanel(panel.id))}
      </main>

      {/* Debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <details
          style={{
            marginTop: scale(24, 'spacing'),
            padding: scale(12, 'spacing'),
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            borderRadius: scale(4, 'component'),
            fontSize: scale(11, 'font'),
            backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
          }}
        >
          <summary>Debug Information</summary>
          <pre style={{ margin: scale(8, 'spacing'), fontSize: scale(10, 'font') }}>
            {JSON.stringify({
              breakpoint,
              device: {
                width: device.width,
                height: device.height,
                isMobile: device.isMobile,
                isTablet: device.isTablet,
                isDesktop: device.isDesktop,
                isTouchDevice: device.isTouchDevice,
              },
              density: {
                mode: density.mode,
                spacingScale: density.spacingScale,
                fontScale: density.fontScale,
                isTouchFriendly,
              },
              grid: {
                columns: gridState.columns,
                containerWidth: gridState.containerWidth,
              },
              container: containerSize,
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

// =========================
// USAGE EXAMPLES
// =========================

export const HookUsageExamples: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Hook Usage Examples</h2>

      {/* Basic responsive hook */}
      <section>
        <h3>1. Basic Responsive Detection</h3>
        <ResponsiveExample />
      </section>

      {/* Grid layout hook */}
      <section>
        <h3>2. Dynamic Grid Layout</h3>
        <GridLayoutExample />
      </section>

      {/* Density management */}
      <section>
        <h3>3. Density Management</h3>
        <DensityExample />
      </section>
    </div>
  );
};

const ResponsiveExample: React.FC = () => {
  const { breakpoint, device, above, below } = useResponsive();

  return (
    <div style={{ border: '1px solid #ccc', padding: '12px', margin: '8px 0' }}>
      <p>Current breakpoint: <strong>{breakpoint}</strong></p>
      <p>Screen size: {device.width} × {device.height}</p>
      <p>Device type: {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}</p>

      {above.md && <p>✅ Showing desktop features</p>}
      {below.lg && <p>📱 Showing mobile-optimized interface</p>}
      {device.isTouchDevice && <p>👆 Touch-friendly interface enabled</p>}
    </div>
  );
};

const GridLayoutExample: React.FC = () => {
  const { state, containerRef, addItem, removeItem } = useGridLayout({
    config: {
      columns: { xs: 1, sm: 2, md: 3, lg: 4 },
      gap: 12,
      minItemWidth: 200,
    },
    items: [
      { id: '1', colSpan: 1, rowSpan: 1 },
      { id: '2', colSpan: 2, rowSpan: 1 },
      { id: '3', colSpan: 1, rowSpan: 2 },
    ],
  });

  return (
    <div style={{ border: '1px solid #ccc', padding: '12px', margin: '8px 0' }}>
      <p>Grid: {state.columns} columns, {state.rows} rows</p>
      <p>Container: {state.containerWidth}px wide</p>

      <div
        ref={containerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${state.columns}, 1fr)`,
          gap: '12px',
          border: '1px dashed #666',
          padding: '12px',
          minHeight: '200px',
        }}
      >
        {Object.entries(state.positions).map(([id, position]) => (
          <div
            key={id}
            style={{
              gridColumn: `span 1`,
              backgroundColor: '#f0f0f0',
              padding: '8px',
              borderRadius: '4px',
            }}
          >
            Item {id}
          </div>
        ))}
      </div>

      <button onClick={() => addItem({ id: `${Date.now()}`, colSpan: 1, rowSpan: 1 })}>
        Add Item
      </button>
    </div>
  );
};

const DensityExample: React.FC = () => {
  const { density, setMode, scale, isTouchFriendly } = useDensity();

  return (
    <div style={{ border: '1px solid #ccc', padding: scale(12, 'spacing'), margin: '8px 0' }}>
      <p>Current density: <strong>{density.mode}</strong></p>
      <p>Spacing scale: {density.spacingScale}</p>
      <p>Touch-friendly: {isTouchFriendly ? 'Yes' : 'No'}</p>

      <div style={{ marginTop: scale(12, 'spacing'), display: 'flex', gap: scale(8, 'spacing') }}>
        {(['comfortable', 'compact', 'dense'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            style={{
              padding: `${scale(8, 'spacing')}px ${scale(16, 'spacing')}px`,
              fontSize: scale(14, 'font'),
              backgroundColor: density.mode === mode ? '#007acc' : '#f0f0f0',
              color: density.mode === mode ? 'white' : 'black',
              border: 'none',
              borderRadius: scale(4, 'component'),
              cursor: 'pointer',
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: scale(16, 'spacing'),
          padding: scale(12, 'spacing'),
          backgroundColor: '#f9f9f9',
          borderRadius: scale(4, 'component'),
          fontSize: scale(12, 'font'),
        }}
      >
        This content scales with density mode
      </div>
    </div>
  );
};

export default ResponsiveDashboard;