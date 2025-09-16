/**
 * Mobile Device Testing Configuration
 * 
 * Comprehensive mobile viewport and device testing configuration for:
 * - All specified mobile viewports (320px-768px)
 * - Touch target validation (44px minimum)
 * - Orientation change handling
 * - Mobile-specific interaction patterns
 * - Device compatibility matrix
 * 
 * @author Mobile Device Testing Specialist
 * @version 1.0.0
 */

export const MOBILE_DEVICE_CONFIGS = {
  // iPhone Models
  iphone_se: {
    name: 'iPhone SE',
    viewport: { width: 375, height: 667 },
    devicePixelRatio: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    touch: true,
    platform: 'ios',
    category: 'mobile'
  },
  
  iphone_12: {
    name: 'iPhone 12/13',
    viewport: { width: 390, height: 844 },
    devicePixelRatio: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    touch: true,
    platform: 'ios',
    category: 'mobile'
  },
  
  iphone_14_pro_max: {
    name: 'iPhone 14 Pro Max',
    viewport: { width: 430, height: 932 },
    devicePixelRatio: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    touch: true,
    platform: 'ios',
    category: 'mobile'
  },
  
  // Samsung Galaxy Models
  samsung_galaxy_s20: {
    name: 'Samsung Galaxy S20',
    viewport: { width: 360, height: 800 },
    devicePixelRatio: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
    touch: true,
    platform: 'android',
    category: 'mobile'
  },
  
  // iPad Mini (tablet but in mobile range)
  ipad_mini: {
    name: 'iPad Mini',
    viewport: { width: 768, height: 1024 },
    devicePixelRatio: 2,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    touch: true,
    platform: 'ios',
    category: 'tablet'
  },
  
  // Edge Cases
  narrow_mobile: {
    name: 'Narrow Mobile (320px)',
    viewport: { width: 320, height: 568 },
    devicePixelRatio: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
    touch: true,
    platform: 'ios',
    category: 'mobile'
  }
} as const;

export const TOUCH_TARGET_REQUIREMENTS = {
  MINIMUM_SIZE: 44, // pixels - WCAG AA requirement
  OPTIMAL_SIZE: 48, // pixels - better for accessibility
  MINIMUM_SPACING: 8, // pixels between targets
  THUMB_REACH_ZONES: {
    primary: { bottom: 100, sides: 50 }, // Easy reach area
    secondary: { bottom: 200, sides: 100 }, // Comfortable reach
    tertiary: { bottom: 300, sides: 150 } // Requires thumb stretch
  }
} as const;

export const MOBILE_INTERACTION_PATTERNS = {
  SWIPE_GESTURES: {
    MINIMUM_DISTANCE: 50, // pixels
    MINIMUM_VELOCITY: 0.3, // pixels per ms
    DIRECTIONS: ['left', 'right', 'up', 'down'] as const
  },
  
  TAP_INTERACTIONS: {
    SINGLE_TAP_DELAY: 300, // ms
    DOUBLE_TAP_WINDOW: 300, // ms
    LONG_PRESS_DURATION: 500 // ms
  },
  
  SCROLL_PERFORMANCE: {
    MINIMUM_FPS: 30,
    JANK_THRESHOLD: 16.67, // ms per frame
    MOMENTUM_DECAY: 0.95
  }
} as const;

export const ORIENTATION_CONFIGS = {
  portrait: {
    name: 'Portrait',
    transform: (device: any) => ({
      width: Math.min(device.viewport.width, device.viewport.height),
      height: Math.max(device.viewport.width, device.viewport.height)
    })
  },
  
  landscape: {
    name: 'Landscape',
    transform: (device: any) => ({
      width: Math.max(device.viewport.width, device.viewport.height),
      height: Math.min(device.viewport.width, device.viewport.height)
    })
  }
} as const;

export const MOBILE_PERFORMANCE_THRESHOLDS = {
  // Rendering Performance
  FIRST_CONTENTFUL_PAINT: 1500, // ms
  LARGEST_CONTENTFUL_PAINT: 2500, // ms
  CUMULATIVE_LAYOUT_SHIFT: 0.1,
  
  // Interaction Performance
  TOUCH_RESPONSE_TIME: 100, // ms
  SCROLL_RESPONSE_TIME: 16, // ms (60fps)
  NAVIGATION_TRANSITION: 300, // ms
  
  // Memory Constraints
  MEMORY_USAGE_LIMIT: 50, // MB
  DOM_NODE_LIMIT: 1000,
  
  // Network Performance
  SLOW_3G_TIMEOUT: 5000, // ms
  FAST_3G_TIMEOUT: 3000, // ms
  WIFI_TIMEOUT: 1000 // ms
} as const;

export const MOBILE_ACCESSIBILITY_REQUIREMENTS = {
  CONTRAST_RATIOS: {
    NORMAL_TEXT: 4.5,
    LARGE_TEXT: 3.0,
    NON_TEXT: 3.0
  },
  
  FOCUS_MANAGEMENT: {
    VISIBLE_FOCUS_RING: true,
    LOGICAL_TAB_ORDER: true,
    FOCUS_TRAP_MODALS: true,
    SKIP_LINKS: true
  },
  
  SCREEN_READER_SUPPORT: {
    ARIA_LABELS: true,
    LIVE_REGIONS: true,
    SEMANTIC_MARKUP: true,
    DESCRIPTIVE_TEXT: true
  },
  
  MOBILE_SPECIFIC: {
    ZOOM_SUPPORT: 400, // percent
    NO_HORIZONTAL_SCROLL: true,
    ORIENTATION_SUPPORT: true,
    REDUCED_MOTION_SUPPORT: true
  }
} as const;

export const CRITICAL_USER_FLOWS = {
  search_flow: {
    name: 'Search and Browse',
    steps: [
      'Open search interface',
      'Enter search query',
      'View results',
      'Select result',
      'Navigate back'
    ],
    criticalPath: true
  },
  
  entry_creation: {
    name: 'Create Knowledge Entry',
    steps: [
      'Open entry form',
      'Fill required fields',
      'Add optional content',
      'Submit entry',
      'View confirmation'
    ],
    criticalPath: true
  },
  
  navigation_flow: {
    name: 'Mobile Navigation',
    steps: [
      'Open mobile menu',
      'Navigate to section',
      'Access filters',
      'Return to main view'
    ],
    criticalPath: false
  },
  
  responsive_adaptation: {
    name: 'Orientation Changes',
    steps: [
      'Start in portrait',
      'Rotate to landscape',
      'Verify layout adaptation',
      'Test functionality',
      'Rotate back to portrait'
    ],
    criticalPath: false
  }
} as const;

export const COMPONENT_MOBILE_TESTS = {
  SearchResults: {
    touchTargets: ['result-items', 'load-more-button', 'filter-toggles'],
    swipeGestures: ['horizontal-scroll', 'pull-to-refresh'],
    orientations: ['portrait', 'landscape'],
    performance: ['scroll-fps', 'render-time', 'memory-usage']
  },
  
  Navigation: {
    touchTargets: ['menu-button', 'nav-items', 'back-button'],
    swipeGestures: ['drawer-swipe', 'tab-swipe'],
    orientations: ['portrait', 'landscape'],
    performance: ['transition-time', 'gesture-response']
  },
  
  Forms: {
    touchTargets: ['input-fields', 'submit-button', 'validation-messages'],
    swipeGestures: [],
    orientations: ['portrait', 'landscape'],
    performance: ['keyboard-response', 'validation-time']
  },
  
  Modals: {
    touchTargets: ['close-button', 'action-buttons', 'overlay'],
    swipeGestures: ['swipe-to-dismiss'],
    orientations: ['portrait', 'landscape'],
    performance: ['show-hide-animation', 'backdrop-interaction']
  },
  
  DataTables: {
    touchTargets: ['sort-headers', 'row-actions', 'pagination'],
    swipeGestures: ['horizontal-scroll', 'row-swipe-actions'],
    orientations: ['portrait', 'landscape'],
    performance: ['scroll-performance', 'cell-rendering']
  },
  
  Cards: {
    touchTargets: ['card-content', 'action-buttons', 'expansion-toggles'],
    swipeGestures: ['card-swipe-actions'],
    orientations: ['portrait', 'landscape'],
    performance: ['list-scroll', 'image-loading']
  }
} as const;

// Test Scenario Generator
export const generateMobileTestScenarios = () => {
  const scenarios = [];
  
  // Generate device + orientation combinations
  Object.entries(MOBILE_DEVICE_CONFIGS).forEach(([deviceKey, device]) => {
    Object.entries(ORIENTATION_CONFIGS).forEach(([orientationKey, orientation]) => {
      const viewport = orientation.transform(device);
      
      scenarios.push({
        id: `${deviceKey}-${orientationKey}`,
        name: `${device.name} - ${orientation.name}`,
        device,
        orientation: orientationKey,
        viewport,
        testCategories: [
          'touch-targets',
          'navigation',
          'performance',
          'accessibility'
        ]
      });
    });
  });
  
  return scenarios;
};

// Device Compatibility Matrix
export const DEVICE_COMPATIBILITY_MATRIX = {
  browsers: {
    safari_mobile: {
      name: 'Mobile Safari',
      version: '15.0+',
      support: {
        touch_events: 'full',
        css_grid: 'full',
        flexbox: 'full',
        viewport_units: 'full',
        css_variables: 'full'
      }
    },
    
    chrome_mobile: {
      name: 'Chrome Mobile',
      version: '90.0+',
      support: {
        touch_events: 'full',
        css_grid: 'full',
        flexbox: 'full',
        viewport_units: 'full',
        css_variables: 'full'
      }
    },
    
    firefox_mobile: {
      name: 'Firefox Mobile',
      version: '88.0+',
      support: {
        touch_events: 'full',
        css_grid: 'full',
        flexbox: 'full',
        viewport_units: 'partial',
        css_variables: 'full'
      }
    }
  },
  
  features: {
    responsive_design: {
      name: 'Responsive Design',
      required: true,
      testMethods: ['viewport-resize', 'orientation-change']
    },
    
    touch_interaction: {
      name: 'Touch Interactions',
      required: true,
      testMethods: ['tap', 'swipe', 'pinch', 'long-press']
    },
    
    performance: {
      name: 'Mobile Performance',
      required: true,
      testMethods: ['fps-monitoring', 'memory-usage', 'network-throttling']
    },
    
    accessibility: {
      name: 'Mobile Accessibility',
      required: true,
      testMethods: ['screen-reader', 'high-contrast', 'zoom-support']
    }
  }
} as const;

export type MobileDeviceConfig = typeof MOBILE_DEVICE_CONFIGS[keyof typeof MOBILE_DEVICE_CONFIGS];
export type OrientationConfig = typeof ORIENTATION_CONFIGS[keyof typeof ORIENTATION_CONFIGS];
export type MobileTestScenario = ReturnType<typeof generateMobileTestScenarios>[0];
export type ComponentMobileTest = typeof COMPONENT_MOBILE_TESTS[keyof typeof COMPONENT_MOBILE_TESTS];

export default {
  MOBILE_DEVICE_CONFIGS,
  TOUCH_TARGET_REQUIREMENTS,
  MOBILE_INTERACTION_PATTERNS,
  ORIENTATION_CONFIGS,
  MOBILE_PERFORMANCE_THRESHOLDS,
  MOBILE_ACCESSIBILITY_REQUIREMENTS,
  CRITICAL_USER_FLOWS,
  COMPONENT_MOBILE_TESTS,
  DEVICE_COMPATIBILITY_MATRIX,
  generateMobileTestScenarios
};
