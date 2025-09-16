/**
 * Responsive Testing Configuration
 *
 * Centralized configuration for responsive UI testing including:
 * - Device viewport definitions
 * - Performance thresholds
 * - Breakpoint specifications
 * - Test utilities and helpers
 *
 * @author UI Responsiveness Testing Specialist
 * @version 1.0.0
 */

// ========================
// Device Viewport Definitions
// ========================

export const DEVICE_VIEWPORTS = {
  // Mobile Phones
  iphone_se: { width: 375, height: 667, devicePixelRatio: 2 },
  iphone_12: { width: 390, height: 844, devicePixelRatio: 3 },
  iphone_12_pro_max: { width: 428, height: 926, devicePixelRatio: 3 },
  pixel_5: { width: 393, height: 851, devicePixelRatio: 3 },
  galaxy_s21: { width: 384, height: 854, devicePixelRatio: 3 },

  // Tablets
  ipad_mini: { width: 768, height: 1024, devicePixelRatio: 2 },
  ipad_air: { width: 820, height: 1180, devicePixelRatio: 2 },
  ipad_pro_11: { width: 834, height: 1194, devicePixelRatio: 2 },
  ipad_pro_12_9: { width: 1024, height: 1366, devicePixelRatio: 2 },
  surface_pro: { width: 912, height: 1368, devicePixelRatio: 2 },

  // Desktop/Laptop
  laptop_small: { width: 1280, height: 720, devicePixelRatio: 1 },
  laptop_medium: { width: 1440, height: 900, devicePixelRatio: 1 },
  desktop_hd: { width: 1920, height: 1080, devicePixelRatio: 1 },
  desktop_4k: { width: 2560, height: 1440, devicePixelRatio: 2 },
  ultrawide: { width: 3440, height: 1440, devicePixelRatio: 1 },

  // Edge Cases
  very_narrow: { width: 280, height: 640, devicePixelRatio: 1 },
  very_wide: { width: 5120, height: 1440, devicePixelRatio: 1 },
  square: { width: 1000, height: 1000, devicePixelRatio: 1 },
  tiny: { width: 240, height: 320, devicePixelRatio: 1 },
} as const;

// ========================
// Breakpoint Categories
// ========================

export const BREAKPOINT_CATEGORIES = {
  mobile: {
    min: 0,
    max: 767,
    devices: ['iphone_se', 'iphone_12', 'pixel_5', 'galaxy_s21']
  },
  tablet: {
    min: 768,
    max: 1023,
    devices: ['ipad_mini', 'ipad_air', 'surface_pro']
  },
  desktop: {
    min: 1024,
    max: 1439,
    devices: ['laptop_small']
  },
  large_desktop: {
    min: 1440,
    max: 2559,
    devices: ['laptop_medium', 'desktop_hd']
  },
  ultrawide: {
    min: 2560,
    max: Infinity,
    devices: ['desktop_4k', 'ultrawide']
  }
} as const;

// ========================
// Performance Thresholds
// ========================

export const PERFORMANCE_THRESHOLDS = {
  // Touch interaction thresholds
  TOUCH_TARGET_MIN_SIZE: 44, // Minimum touch target size (px)
  TOUCH_TARGET_OPTIMAL_SIZE: 48, // Optimal touch target size (px)
  TOUCH_RESPONSE_TIME_MAX: 100, // Maximum touch response time (ms)

  // Layout and rendering thresholds
  LAYOUT_SHIFT_THRESHOLD: 0.1, // Maximum acceptable layout shift (CLS)
  REFLOW_TIME_MAX: 300, // Maximum time for layout reflow (ms)
  PAINT_TIME_MAX: 100, // Maximum time for first paint (ms)

  // Scroll performance thresholds
  SCROLL_FPS_MIN: 30, // Minimum scroll performance (fps)
  SCROLL_JANK_THRESHOLD: 16.67, // Frame time threshold for jank (ms)

  // Component load thresholds
  COMPONENT_LOAD_TIME_MAX: 1000, // Maximum component load time (ms)
  VIRTUAL_SCROLL_ITEM_RENDER_MAX: 16, // Maximum time to render virtual scroll item (ms)

  // Network and data thresholds
  SEARCH_RESPONSE_TIME_MAX: 1000, // Maximum search response time (ms)
  IMAGE_LOAD_TIME_MAX: 3000, // Maximum image load time (ms)

  // Memory thresholds
  MEMORY_LEAK_THRESHOLD: 50, // Maximum memory increase per interaction (MB)
  DOM_NODE_COUNT_MAX: 1500, // Maximum DOM nodes for performance
} as const;

// ========================
// CSS Media Query Definitions
// ========================

export const MEDIA_QUERIES = {
  // Width-based queries
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
  large_desktop: '(min-width: 1440px)',

  // Feature-based queries
  touch: '(pointer: coarse)',
  hover: '(hover: hover)',
  high_res: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',

  // Orientation queries
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',

  // Accessibility queries
  reduced_motion: '(prefers-reduced-motion: reduce)',
  high_contrast: '(prefers-contrast: high)',
  dark_mode: '(prefers-color-scheme: dark)',

  // Height-based queries
  short_screen: '(max-height: 600px)',
  tall_screen: '(min-height: 900px)',
} as const;

// ========================
// Test Scenarios
// ========================

export const TEST_SCENARIOS = {
  // Basic responsive scenarios
  mobile_portrait: {
    viewport: DEVICE_VIEWPORTS.iphone_12,
    orientation: 'portrait',
    touch: true,
    description: 'Standard mobile portrait usage'
  },

  mobile_landscape: {
    viewport: { width: 844, height: 390 },
    orientation: 'landscape',
    touch: true,
    description: 'Mobile landscape keyboard interaction'
  },

  tablet_portrait: {
    viewport: DEVICE_VIEWPORTS.ipad_air,
    orientation: 'portrait',
    touch: true,
    description: 'Tablet portrait with touch interaction'
  },

  tablet_landscape: {
    viewport: { width: 1180, height: 820 },
    orientation: 'landscape',
    touch: true,
    description: 'Tablet landscape productivity mode'
  },

  desktop_standard: {
    viewport: DEVICE_VIEWPORTS.desktop_hd,
    orientation: 'landscape',
    touch: false,
    description: 'Standard desktop experience'
  },

  // Edge case scenarios
  tiny_screen: {
    viewport: DEVICE_VIEWPORTS.tiny,
    orientation: 'portrait',
    touch: true,
    description: 'Very small screen edge case'
  },

  ultrawide_desktop: {
    viewport: DEVICE_VIEWPORTS.ultrawide,
    orientation: 'landscape',
    touch: false,
    description: 'Ultra-wide monitor usage'
  },

  // Accessibility scenarios
  reduced_motion: {
    viewport: DEVICE_VIEWPORTS.desktop_hd,
    orientation: 'landscape',
    touch: false,
    prefersReducedMotion: true,
    description: 'Reduced motion accessibility preference'
  },

  high_contrast: {
    viewport: DEVICE_VIEWPORTS.laptop_medium,
    orientation: 'landscape',
    touch: false,
    highContrast: true,
    description: 'High contrast mode for accessibility'
  },
} as const;

// ========================
// Component Test Configurations
// ========================

export const COMPONENT_CONFIGS = {
  search_interface: {
    testViewports: ['mobile_portrait', 'tablet_portrait', 'desktop_standard'],
    criticalFeatures: ['search_input', 'results_list', 'filters', 'autocomplete'],
    performanceMetrics: ['search_response_time', 'render_time', 'scroll_performance']
  },

  kb_entry_list: {
    testViewports: ['mobile_portrait', 'tablet_landscape', 'desktop_standard', 'ultrawide_desktop'],
    criticalFeatures: ['entry_cards', 'virtual_scrolling', 'selection_state', 'rating_buttons'],
    performanceMetrics: ['list_render_time', 'scroll_fps', 'memory_usage']
  },

  entry_form: {
    testViewports: ['mobile_portrait', 'mobile_landscape', 'tablet_portrait', 'desktop_standard'],
    criticalFeatures: ['form_fields', 'validation', 'submission', 'keyboard_navigation'],
    performanceMetrics: ['form_validation_time', 'input_response_time']
  },

  responsive_layout: {
    testViewports: Object.keys(TEST_SCENARIOS),
    criticalFeatures: ['sidebar_toggling', 'overlay_behavior', 'panel_resizing', 'swipe_gestures'],
    performanceMetrics: ['layout_transition_time', 'gesture_response_time']
  }
} as const;

// ========================
// Accessibility Requirements
// ========================

export const ACCESSIBILITY_REQUIREMENTS = {
  // WCAG 2.1 Level AA requirements
  color_contrast: {
    normal_text: 4.5,
    large_text: 3.0,
    non_text: 3.0
  },

  focus_management: {
    visible_focus_indicator: true,
    logical_tab_order: true,
    focus_trap_in_modals: true,
    skip_links: true
  },

  keyboard_navigation: {
    all_interactive_elements_accessible: true,
    escape_closes_overlays: true,
    arrow_key_navigation: true,
    enter_space_activation: true
  },

  screen_reader_support: {
    semantic_markup: true,
    aria_labels: true,
    live_regions: true,
    descriptive_text: true
  },

  responsive_accessibility: {
    touch_target_size_min: PERFORMANCE_THRESHOLDS.TOUCH_TARGET_MIN_SIZE,
    zoom_support_400_percent: true,
    orientation_support: true,
    no_horizontal_scroll: true
  }
} as const;

// ========================
// Visual Regression Configurations
// ========================

export const VISUAL_REGRESSION_CONFIG = {
  // Screenshot capture settings
  capture_settings: {
    full_page: false,
    wait_for_animations: true,
    disable_animations: false,
    threshold: 0.001, // 0.1% pixel difference tolerance
    include_timestamps: false
  },

  // Test coverage areas
  coverage_areas: {
    header: { selector: '.app-header', critical: true },
    search_bar: { selector: '.search-interface__main-search', critical: true },
    results_area: { selector: '.search-interface__results', critical: true },
    sidebar: { selector: '.filters-sidebar, .preview-sidebar', critical: false },
    footer: { selector: '.app-footer', critical: false },
    modal_overlays: { selector: '[role="dialog"]', critical: true }
  },

  // Test matrix
  test_matrix: {
    components: Object.keys(COMPONENT_CONFIGS),
    viewports: Object.keys(TEST_SCENARIOS),
    themes: ['light', 'dark', 'high_contrast'],
    states: ['default', 'loading', 'error', 'empty']
  }
} as const;

// ========================
// Performance Test Configurations
// ========================

export const PERFORMANCE_TEST_CONFIG = {
  // Load testing scenarios
  load_scenarios: {
    small_dataset: { entries: 50, search_queries: 10 },
    medium_dataset: { entries: 500, search_queries: 50 },
    large_dataset: { entries: 2000, search_queries: 100 },
    stress_test: { entries: 10000, search_queries: 500 }
  },

  // Memory monitoring
  memory_monitoring: {
    sample_interval: 1000, // ms
    max_samples: 100,
    gc_frequency_threshold: 5, // garbage collections per minute
    memory_leak_threshold: PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD
  },

  // Network simulation
  network_conditions: {
    wifi: { download: 30000, upload: 15000, latency: 2 },
    '4g': { download: 4000, upload: 3000, latency: 20 },
    '3g': { download: 1500, upload: 750, latency: 40 },
    '2g': { download: 280, upload: 256, latency: 800 },
    offline: { download: 0, upload: 0, latency: 0 }
  }
} as const;

// ========================
// Error Scenarios
// ========================

export const ERROR_SCENARIOS = {
  // Network errors
  network_errors: {
    search_timeout: { type: 'timeout', duration: 5000 },
    search_failure: { type: 'error', status: 500 },
    slow_response: { type: 'delay', duration: 3000 }
  },

  // Data errors
  data_errors: {
    empty_results: { type: 'empty_data' },
    malformed_data: { type: 'invalid_json' },
    large_response: { type: 'oversized_response', size: '10MB' }
  },

  // UI errors
  ui_errors: {
    component_crash: { type: 'render_error' },
    memory_exhaustion: { type: 'memory_limit' },
    infinite_loop: { type: 'performance_degradation' }
  }
} as const;

// ========================
// Utility Types
// ========================

export type DeviceViewport = typeof DEVICE_VIEWPORTS[keyof typeof DEVICE_VIEWPORTS];
export type TestScenario = typeof TEST_SCENARIOS[keyof typeof TEST_SCENARIOS];
export type ComponentConfig = typeof COMPONENT_CONFIGS[keyof typeof COMPONENT_CONFIGS];
export type BreakpointCategory = keyof typeof BREAKPOINT_CATEGORIES;

// ========================
// Helper Functions
// ========================

export const getViewportsByBreakpoint = (breakpoint: BreakpointCategory) => {
  return BREAKPOINT_CATEGORIES[breakpoint].devices.map(
    device => DEVICE_VIEWPORTS[device as keyof typeof DEVICE_VIEWPORTS]
  );
};

export const getMediaQueryForViewport = (viewport: DeviceViewport) => {
  if (viewport.width <= 767) return MEDIA_QUERIES.mobile;
  if (viewport.width <= 1023) return MEDIA_QUERIES.tablet;
  if (viewport.width <= 1439) return MEDIA_QUERIES.desktop;
  return MEDIA_QUERIES.large_desktop;
};

export const isTouchDevice = (scenario: TestScenario) => {
  return scenario.touch || scenario.viewport.width <= 1024;
};

export const calculateAspectRatio = (viewport: DeviceViewport) => {
  return viewport.width / viewport.height;
};

export const getOptimalTouchTargetSize = (viewport: DeviceViewport) => {
  // Smaller devices need larger touch targets relative to screen size
  const baseSize = PERFORMANCE_THRESHOLDS.TOUCH_TARGET_OPTIMAL_SIZE;
  const scaleFactor = viewport.width < 400 ? 1.2 : 1.0;
  return Math.round(baseSize * scaleFactor);
};

export const shouldUseReducedMotion = (scenario: TestScenario) => {
  return scenario.prefersReducedMotion || false;
};

export const getExpectedColumnCount = (viewport: DeviceViewport, component: string) => {
  if (component === 'kb_entry_list') {
    if (viewport.width < 768) return 1; // Mobile: single column
    if (viewport.width < 1200) return 2; // Tablet: two columns
    if (viewport.width < 1600) return 3; // Desktop: three columns
    return 4; // Large desktop: four columns
  }

  return 1; // Default to single column for other components
};

export default {
  DEVICE_VIEWPORTS,
  BREAKPOINT_CATEGORIES,
  PERFORMANCE_THRESHOLDS,
  MEDIA_QUERIES,
  TEST_SCENARIOS,
  COMPONENT_CONFIGS,
  ACCESSIBILITY_REQUIREMENTS,
  VISUAL_REGRESSION_CONFIG,
  PERFORMANCE_TEST_CONFIG,
  ERROR_SCENARIOS,
  getViewportsByBreakpoint,
  getMediaQueryForViewport,
  isTouchDevice,
  calculateAspectRatio,
  getOptimalTouchTargetSize,
  shouldUseReducedMotion,
  getExpectedColumnCount
};