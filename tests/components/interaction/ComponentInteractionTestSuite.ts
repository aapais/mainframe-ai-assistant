/**
 * Component Interaction Test Suite
 *
 * Comprehensive testing framework for validating component interactions,
 * communication patterns, event handling, and cross-component data flow.
 *
 * @author UI Testing Specialist
 * @version 1.0.0
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import React from 'react';

// Test utilities and types
export interface ComponentInteractionTestContext {
  /** Component under test */
  component: React.ComponentType<any>;
  /** Parent component if testing child interactions */
  parentComponent?: React.ComponentType<any>;
  /** Props to pass to the component */
  props: Record<string, any>;
  /** Mock functions for event handlers */
  mockHandlers: Record<string, jest.Mock>;
  /** Test data for the component */
  testData: Record<string, any>;
  /** Expected interaction outcomes */
  expectations: {
    events: string[];
    stateChanges: Record<string, any>;
    sideEffects: string[];
  };
}

export interface InteractionTestCase {
  name: string;
  description: string;
  setup: () => ComponentInteractionTestContext;
  test: (context: ComponentInteractionTestContext) => Promise<void>;
  teardown?: (context: ComponentInteractionTestContext) => void;
}

/**
 * Base class for component interaction testing
 */
export class ComponentInteractionTester {
  private mockRegistry: Map<string, jest.Mock> = new Map();
  private eventLog: Array<{ type: string; data: any; timestamp: number }> = [];

  constructor() {
    this.setupGlobalMocks();
  }

  /**
   * Setup global mocks for common APIs
   */
  private setupGlobalMocks(): void {
    // Mock intersectionObserver for virtual scrolling tests
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // Mock ResizeObserver for responsive tests
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // Mock WebSocket for real-time tests
    global.WebSocket = jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  }

  /**
   * Create a mock function and register it
   */
  createMock(name: string): jest.Mock {
    const mock = jest.fn();

    // Add event logging to the mock
    mock.mockImplementation((...args) => {
      this.logEvent(name, args);
    });

    this.mockRegistry.set(name, mock);
    return mock;
  }

  /**
   * Get a registered mock function
   */
  getMock(name: string): jest.Mock | undefined {
    return this.mockRegistry.get(name);
  }

  /**
   * Log an event for tracking interactions
   */
  private logEvent(type: string, data: any): void {
    this.eventLog.push({
      type,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get the event log
   */
  getEventLog(): Array<{ type: string; data: any; timestamp: number }> {
    return [...this.eventLog];
  }

  /**
   * Clear the event log
   */
  clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * Reset all mocks
   */
  resetMocks(): void {
    this.mockRegistry.forEach(mock => mock.mockReset());
    this.clearEventLog();
  }

  /**
   * Run a component interaction test
   */
  async runTest(testCase: InteractionTestCase): Promise<void> {
    const context = testCase.setup();

    try {
      await testCase.test(context);
    } finally {
      testCase.teardown?.(context);
      this.resetMocks();
    }
  }

  /**
   * Create a test wrapper with common providers
   */
  createTestWrapper(children: React.ReactNode): React.ReactElement {
    return React.createElement(
      'div',
      { 'data-testid': 'test-wrapper' },
      children
    );
  }

  /**
   * Wait for component to stabilize after interactions
   */
  async waitForStabilization(timeout: number = 100): Promise<void> {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, timeout));
    });
  }

  /**
   * Simulate user interactions with timing
   */
  async simulateUserInteraction(
    element: HTMLElement,
    interaction: 'click' | 'type' | 'hover' | 'focus' | 'blur',
    data?: string
  ): Promise<void> {
    const user = userEvent.setup();

    switch (interaction) {
      case 'click':
        await user.click(element);
        break;
      case 'type':
        if (data) await user.type(element, data);
        break;
      case 'hover':
        await user.hover(element);
        break;
      case 'focus':
        await user.click(element); // Focus by clicking
        break;
      case 'blur':
        await user.tab(); // Blur by tabbing away
        break;
    }

    await this.waitForStabilization();
  }

  /**
   * Assert event sequence occurred in correct order
   */
  assertEventSequence(expectedEvents: string[]): void {
    const actualEvents = this.eventLog.map(log => log.type);
    expect(actualEvents).toEqual(expectedEvents);
  }

  /**
   * Assert event was called with specific data
   */
  assertEventData(eventName: string, expectedData: any): void {
    const event = this.eventLog.find(log => log.type === eventName);
    expect(event).toBeDefined();
    expect(event?.data).toEqual(expect.arrayContaining([expectedData]));
  }

  /**
   * Assert component rendered with expected props
   */
  assertComponentRendered(testId: string, expectedProps?: Record<string, any>): void {
    const element = screen.getByTestId(testId);
    expect(element).toBeInTheDocument();

    if (expectedProps) {
      Object.entries(expectedProps).forEach(([prop, value]) => {
        expect(element).toHaveAttribute(`data-${prop}`, String(value));
      });
    }
  }

  /**
   * Assert state change occurred
   */
  assertStateChange(
    component: HTMLElement,
    stateAttribute: string,
    expectedValue: any
  ): void {
    expect(component).toHaveAttribute(`data-${stateAttribute}`, String(expectedValue));
  }
}

/**
 * Test helper for component communication patterns
 */
export class ComponentCommunicationTester extends ComponentInteractionTester {
  /**
   * Test parent-child communication pattern
   */
  async testParentChildCommunication(
    ParentComponent: React.ComponentType<any>,
    ChildComponent: React.ComponentType<any>,
    parentProps: any,
    childProps: any
  ): Promise<void> {
    const onChildEvent = this.createMock('onChildEvent');
    const onParentEvent = this.createMock('onParentEvent');

    const TestParent = (props: any) => {
      const [state, setState] = React.useState(props.initialState || {});

      const handleChildEvent = React.useCallback((data: any) => {
        onChildEvent(data);
        setState(prev => ({ ...prev, ...data }));
      }, []);

      return React.createElement(
        'div',
        { 'data-testid': 'parent-component', 'data-state': JSON.stringify(state) },
        React.createElement(ChildComponent, {
          ...childProps,
          onEvent: handleChildEvent,
          parentState: state
        })
      );
    };

    render(React.createElement(TestParent, parentProps));

    // Test initial render
    this.assertComponentRendered('parent-component');

    // Simulate child interaction
    const childElement = screen.getByTestId('child-component');
    await this.simulateUserInteraction(childElement, 'click');

    // Assert communication occurred
    await waitFor(() => {
      expect(onChildEvent).toHaveBeenCalled();
    });
  }

  /**
   * Test event bubbling and capturing
   */
  async testEventPropagation(
    ContainerComponent: React.ComponentType<any>,
    props: any
  ): Promise<void> {
    const onBubble = this.createMock('onBubble');
    const onCapture = this.createMock('onCapture');
    const onTarget = this.createMock('onTarget');

    const TestContainer = () => {
      return React.createElement(
        'div',
        {
          'data-testid': 'container',
          onClick: onBubble,
          onClickCapture: onCapture
        },
        React.createElement(ContainerComponent, {
          ...props,
          onClick: onTarget,
          'data-testid': 'target-component'
        })
      );
    };

    render(React.createElement(TestContainer));

    // Click target component
    const targetElement = screen.getByTestId('target-component');
    await this.simulateUserInteraction(targetElement, 'click');

    // Assert event propagation order (capture, target, bubble)
    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledBefore(onTarget as jest.Mock);
      expect(onTarget).toHaveBeenCalledBefore(onBubble as jest.Mock);
    });
  }

  /**
   * Test component composition patterns
   */
  async testComponentComposition(
    WrapperComponent: React.ComponentType<any>,
    ChildComponents: React.ComponentType<any>[],
    wrapperProps: any
  ): Promise<void> {
    const childMocks = ChildComponents.map((_, index) =>
      this.createMock(`child-${index}`)
    );

    const TestComposition = () => {
      return React.createElement(
        WrapperComponent,
        {
          ...wrapperProps,
          'data-testid': 'wrapper-component'
        },
        ...ChildComponents.map((ChildComponent, index) =>
          React.createElement(ChildComponent, {
            key: index,
            onEvent: childMocks[index],
            'data-testid': `child-${index}`
          })
        )
      );
    };

    render(React.createElement(TestComposition));

    // Test wrapper rendered
    this.assertComponentRendered('wrapper-component');

    // Test all children rendered
    ChildComponents.forEach((_, index) => {
      this.assertComponentRendered(`child-${index}`);
    });

    // Test child interactions
    for (let i = 0; i < ChildComponents.length; i++) {
      const childElement = screen.getByTestId(`child-${i}`);
      await this.simulateUserInteraction(childElement, 'click');

      await waitFor(() => {
        expect(childMocks[i]).toHaveBeenCalled();
      });
    }
  }
}

/**
 * Test helper for context and provider patterns
 */
export class ContextProviderTester extends ComponentInteractionTester {
  /**
   * Test context provider and consumer interaction
   */
  async testContextProviderConsumer<T>(
    Provider: React.ComponentType<any>,
    Consumer: React.ComponentType<any>,
    providerProps: any,
    contextValue: T
  ): Promise<void> {
    const onContextChange = this.createMock('onContextChange');

    const TestProvider = () => {
      const [value, setValue] = React.useState(contextValue);

      return React.createElement(
        Provider,
        {
          value,
          'data-testid': 'provider-component'
        },
        React.createElement(Consumer, {
          onContextChange: (newValue: T) => {
            onContextChange(newValue);
            setValue(newValue);
          },
          'data-testid': 'consumer-component'
        })
      );
    };

    render(React.createElement(TestProvider));

    // Assert both components rendered
    this.assertComponentRendered('provider-component');
    this.assertComponentRendered('consumer-component');

    // Simulate context change
    const consumerElement = screen.getByTestId('consumer-component');
    await this.simulateUserInteraction(consumerElement, 'click');

    // Assert context change was handled
    await waitFor(() => {
      expect(onContextChange).toHaveBeenCalled();
    });
  }
}

// Export test utilities
export const componentInteractionTester = new ComponentInteractionTester();
export const componentCommunicationTester = new ComponentCommunicationTester();
export const contextProviderTester = new ContextProviderTester();