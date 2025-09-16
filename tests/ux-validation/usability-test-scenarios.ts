/**
 * UX Validation Test Scenarios
 * Comprehensive usability testing scenarios for the mainframe AI assistant
 */

export interface UsabilityTestScenario {
  id: string;
  name: string;
  description: string;
  userGoal: string;
  context: string;
  steps: string[];
  successCriteria: string[];
  measurableMetrics: {
    taskCompletionRate: number; // Expected percentage
    averageTimeToComplete: number; // Seconds
    errorRate: number; // Expected percentage
    satisfactionScore: number; // 1-5 scale
  };
  accessibility: {
    keyboardNavigable: boolean;
    screenReaderFriendly: boolean;
    visuallyDistinguishable: boolean;
    cognitiveBurden: 'low' | 'medium' | 'high';
  };
  devices: ('desktop' | 'tablet' | 'mobile')[];
}

export const UX_TEST_SCENARIOS: UsabilityTestScenario[] = [
  {
    id: 'search-basic-query',
    name: 'Basic Search Query',
    description: 'User searches for a simple COBOL error using keywords',
    userGoal: 'Find solution for a S0C7 abend error',
    context: 'User is debugging a production issue and needs quick help',
    steps: [
      'Navigate to search interface',
      'Type "S0C7 abend" in search box',
      'Press Enter or click Search button',
      'Review search results',
      'Click on most relevant result',
      'Read solution details'
    ],
    successCriteria: [
      'Search completes within 2 seconds',
      'Relevant results appear first',
      'Solution is clearly displayed',
      'User can rate the solution',
      'Next similar problems are suggested'
    ],
    measurableMetrics: {
      taskCompletionRate: 95,
      averageTimeToComplete: 30,
      errorRate: 2,
      satisfactionScore: 4.5
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'low'
    },
    devices: ['desktop', 'tablet', 'mobile']
  },

  {
    id: 'search-advanced-filtering',
    name: 'Advanced Search with Filters',
    description: 'User searches with category and tag filters',
    userGoal: 'Find JCL-specific solutions for job failure',
    context: 'User has a specific JCL problem and wants filtered results',
    steps: [
      'Open search interface',
      'Type "job failure" in search box',
      'Click on Advanced/Filters section',
      'Select "JCL" category',
      'Add "scheduling" tag filter',
      'Apply filters and search',
      'Review filtered results',
      'Save filter set for future use'
    ],
    successCriteria: [
      'Filters are clearly labeled and accessible',
      'Search results update in real-time',
      'Filter combinations work correctly',
      'Filter sets can be saved and reused',
      'Filter counts are accurate'
    ],
    measurableMetrics: {
      taskCompletionRate: 85,
      averageTimeToComplete: 60,
      errorRate: 8,
      satisfactionScore: 4.2
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'medium'
    },
    devices: ['desktop', 'tablet']
  },

  {
    id: 'search-ai-semantic',
    name: 'AI-Enhanced Semantic Search',
    description: 'User searches using natural language description',
    userGoal: 'Find solution using conversational description',
    context: 'User describes problem in natural language',
    steps: [
      'Access search interface',
      'Enable AI search toggle',
      'Type "My batch job keeps failing with weird characters"',
      'Submit search query',
      'Review AI-enhanced results',
      'Check explanation of why results match',
      'Rate the relevance'
    ],
    successCriteria: [
      'AI toggle is clearly visible and functional',
      'Natural language queries return relevant results',
      'AI explanations are helpful and understandable',
      'Fallback to local search if AI fails',
      'Performance remains acceptable'
    ],
    measurableMetrics: {
      taskCompletionRate: 78,
      averageTimeToComplete: 45,
      errorRate: 12,
      satisfactionScore: 4.0
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'medium'
    },
    devices: ['desktop', 'tablet', 'mobile']
  },

  {
    id: 'search-autocomplete-navigation',
    name: 'Search Autocomplete and Suggestions',
    description: 'User navigates search suggestions with keyboard',
    userGoal: 'Quickly find recent searches or suggestions',
    context: 'User wants to repeat a previous search or use suggestions',
    steps: [
      'Click in search input field',
      'Type first few characters',
      'Review autocomplete suggestions',
      'Use arrow keys to navigate suggestions',
      'Press Enter to select suggestion',
      'Verify search results'
    ],
    successCriteria: [
      'Suggestions appear within 300ms',
      'Keyboard navigation works smoothly',
      'Screen reader announces suggestion changes',
      'Selected suggestion submits correctly',
      'History persists across sessions'
    ],
    measurableMetrics: {
      taskCompletionRate: 92,
      averageTimeToComplete: 15,
      errorRate: 5,
      satisfactionScore: 4.3
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'low'
    },
    devices: ['desktop', 'tablet']
  },

  {
    id: 'mobile-search-experience',
    name: 'Mobile Search Experience',
    description: 'User performs search on mobile device',
    userGoal: 'Find solution while away from desk',
    context: 'User needs to check solution on mobile device',
    steps: [
      'Open app on mobile device',
      'Tap search input',
      'Type query using mobile keyboard',
      'Use touch to scroll through results',
      'Tap to expand result details',
      'Use pinch-to-zoom if needed'
    ],
    successCriteria: [
      'Touch targets are at least 44px',
      'Text is readable without zooming',
      'Scrolling is smooth and responsive',
      'No horizontal scrolling required',
      'Virtual keyboard doesn\'t obscure content'
    ],
    measurableMetrics: {
      taskCompletionRate: 88,
      averageTimeToComplete: 40,
      errorRate: 7,
      satisfactionScore: 4.1
    },
    accessibility: {
      keyboardNavigable: false, // Touch-based
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'low'
    },
    devices: ['mobile']
  },

  {
    id: 'screen-reader-navigation',
    name: 'Screen Reader Navigation',
    description: 'Visually impaired user navigates using screen reader',
    userGoal: 'Find and access solution using assistive technology',
    context: 'User relies on screen reader for navigation',
    steps: [
      'Navigate to main content with screen reader',
      'Locate search landmark',
      'Enter search query',
      'Navigate through results using headings',
      'Access detailed solution content',
      'Use rating functionality'
    ],
    successCriteria: [
      'All elements have appropriate labels',
      'Landmarks are correctly defined',
      'Focus management is logical',
      'Status updates are announced',
      'Content is semantically structured'
    ],
    measurableMetrics: {
      taskCompletionRate: 75,
      averageTimeToComplete: 90,
      errorRate: 15,
      satisfactionScore: 3.8
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: false, // Not relevant
      cognitiveBurden: 'medium'
    },
    devices: ['desktop']
  },

  {
    id: 'high-contrast-mode',
    name: 'High Contrast Accessibility',
    description: 'User with low vision uses high contrast mode',
    userGoal: 'Use interface with high contrast settings',
    context: 'User has visual impairment requiring high contrast',
    steps: [
      'Enable high contrast mode in OS',
      'Access search interface',
      'Verify all elements are visible',
      'Perform search operation',
      'Check result readability',
      'Test interactive elements'
    ],
    successCriteria: [
      'All text has sufficient contrast',
      'Interactive elements are distinguishable',
      'Focus indicators are clearly visible',
      'No content disappears in high contrast',
      'Custom colors respect system settings'
    ],
    measurableMetrics: {
      taskCompletionRate: 82,
      averageTimeToComplete: 50,
      errorRate: 10,
      satisfactionScore: 4.0
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'low'
    },
    devices: ['desktop']
  },

  {
    id: 'performance-under-load',
    name: 'Performance Under Load',
    description: 'System performance with large result sets',
    userGoal: 'Maintain usability with many search results',
    context: 'Search returns hundreds of results',
    steps: [
      'Perform broad search query',
      'Wait for results to load',
      'Scroll through large result set',
      'Apply additional filters',
      'Load more results',
      'Maintain smooth interaction'
    ],
    successCriteria: [
      'Initial results load within 2 seconds',
      'Virtual scrolling prevents UI lag',
      'Filtering remains responsive',
      'Load more functionality works smoothly',
      'No memory leaks or crashes'
    ],
    measurableMetrics: {
      taskCompletionRate: 90,
      averageTimeToComplete: 35,
      errorRate: 5,
      satisfactionScore: 4.2
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'low'
    },
    devices: ['desktop', 'tablet']
  },

  {
    id: 'error-recovery',
    name: 'Error Handling and Recovery',
    description: 'User encounters and recovers from errors',
    userGoal: 'Successfully complete task despite errors',
    context: 'Network issues or service failures occur',
    steps: [
      'Perform search with network disconnected',
      'Observe error handling',
      'Reconnect network',
      'Retry search operation',
      'Verify normal functionality',
      'Test with invalid queries'
    ],
    successCriteria: [
      'Clear error messages are displayed',
      'Retry mechanisms are available',
      'No data loss occurs',
      'Graceful degradation to offline mode',
      'User can continue working'
    ],
    measurableMetrics: {
      taskCompletionRate: 85,
      averageTimeToComplete: 55,
      errorRate: 12,
      satisfactionScore: 3.9
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'medium'
    },
    devices: ['desktop', 'tablet', 'mobile']
  },

  {
    id: 'cognitive-load-assessment',
    name: 'Cognitive Load Assessment',
    description: 'Evaluate mental effort required for task completion',
    userGoal: 'Complete tasks without excessive mental strain',
    context: 'User is working under time pressure',
    steps: [
      'Present complex search scenario',
      'Monitor user decision-making process',
      'Measure hesitation points',
      'Evaluate information hierarchy',
      'Assess cognitive burden',
      'Gather user feedback'
    ],
    successCriteria: [
      'Clear information hierarchy',
      'Minimal decision points',
      'Progressive disclosure',
      'Consistent interaction patterns',
      'Reduced cognitive load over time'
    ],
    measurableMetrics: {
      taskCompletionRate: 80,
      averageTimeToComplete: 70,
      errorRate: 15,
      satisfactionScore: 3.7
    },
    accessibility: {
      keyboardNavigable: true,
      screenReaderFriendly: true,
      visuallyDistinguishable: true,
      cognitiveBurden: 'low'
    },
    devices: ['desktop']
  }
];

export interface TestMetrics {
  scenario: string;
  actualCompletionRate: number;
  actualTimeToComplete: number;
  actualErrorRate: number;
  actualSatisfactionScore: number;
  accessibilityScore: number;
  performanceScore: number;
  usabilityIssues: string[];
  recommendations: string[];
}

export interface UXValidationReport {
  testDate: Date;
  testEnvironment: {
    device: string;
    browser: string;
    screenSize: string;
    assistiveTechnology?: string;
  };
  scenarios: TestMetrics[];
  overallScores: {
    averageCompletionRate: number;
    averageTimeToComplete: number;
    averageErrorRate: number;
    averageSatisfactionScore: number;
    wcagComplianceLevel: 'A' | 'AA' | 'AAA' | 'Non-compliant';
  };
  criticalIssues: string[];
  recommendations: string[];
  nextSteps: string[];
}