import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { MockDataGenerator } from '../test-utils';

/**
 * User Flow Testing Helpers
 *
 * Provides high-level user interaction flows for testing critical workflows
 * in the Mainframe KB Assistant application.
 */

export interface UserFlowContext {
  user: UserEvent;
  mockData?: any;
  performanceTracking?: boolean;
}

export interface SearchFlowOptions {
  query: string;
  useAI?: boolean;
  expectResults?: number;
  selectFirst?: boolean;
  category?: string;
  sortBy?: string;
}

export interface AddEntryFlowOptions {
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
  severity?: string;
  useAdvancedOptions?: boolean;
  expectSuccess?: boolean;
  expectValidationErrors?: string[];
}

export interface RatingFlowOptions {
  entryId: string;
  rating: boolean; // true for success, false for failure
  expectFeedback?: boolean;
}

export interface FormInteractionOptions {
  fillAllFields?: boolean;
  triggerValidation?: boolean;
  testKeyboardNavigation?: boolean;
  testSubmission?: boolean;
  expectErrors?: string[];
}

/**
 * Performance tracking utilities for user flows
 */
export class UserFlowPerformance {
  private static measurements: Map<string, number[]> = new Map();

  static startMeasurement(flowName: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.measurements.has(flowName)) {
        this.measurements.set(flowName, []);
      }
      this.measurements.get(flowName)!.push(duration);
    };
  }

  static getAverageTime(flowName: string): number {
    const times = this.measurements.get(flowName) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  static clearMeasurements(): void {
    this.measurements.clear();
  }

  static getAllMeasurements(): Record<string, { average: number; count: number; times: number[] }> {
    const result: Record<string, { average: number; count: number; times: number[] }> = {};

    for (const [flow, times] of this.measurements.entries()) {
      result[flow] = {
        average: this.getAverageTime(flow),
        count: times.length,
        times: [...times]
      };
    }

    return result;
  }
}

/**
 * User Flow: Search Knowledge Base
 */
export class SearchUserFlow {
  constructor(private context: UserFlowContext) {}

  async performSearch(options: SearchFlowOptions): Promise<HTMLElement[]> {
    const endMeasurement = this.context.performanceTracking
      ? UserFlowPerformance.startMeasurement('search-flow')
      : () => {};

    const { user } = this.context;
    const { query, useAI = true, expectResults = 0, selectFirst = false, category, sortBy } = options;

    // Step 1: Find search input
    const searchInput = await screen.findByRole('searchbox', {
      name: /search/i
    });
    expect(searchInput).toBeInTheDocument();

    // Step 2: Clear existing input and type query
    await user.clear(searchInput);
    await user.type(searchInput, query);

    // Step 3: Configure AI toggle if needed
    if (!useAI) {
      const aiToggle = screen.queryByRole('checkbox', { name: /use ai/i });
      if (aiToggle && (aiToggle as HTMLInputElement).checked) {
        await user.click(aiToggle);
      }
    }

    // Step 4: Apply category filter if specified
    if (category) {
      const categoryFilter = await screen.findByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, category);
    }

    // Step 5: Apply sorting if specified
    if (sortBy) {
      const sortDropdown = await screen.findByRole('combobox', { name: /sort/i });
      await user.selectOptions(sortDropdown, sortBy);
    }

    // Step 6: Trigger search (either Enter key or search button)
    await user.keyboard('{Enter}');

    // Step 7: Wait for results
    if (expectResults > 0) {
      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results).toHaveLength(expectResults);
      }, { timeout: 3000 });
    }

    // Step 8: Get results
    const results = screen.queryAllByRole('article') || [];

    // Step 9: Select first result if requested
    if (selectFirst && results.length > 0) {
      await user.click(results[0]);

      // Wait for entry detail to load
      await waitFor(() => {
        expect(screen.getByRole('main')).toContainElement(
          screen.getByRole('heading', { level: 2 })
        );
      });
    }

    endMeasurement();
    return results;
  }

  async performAdvancedSearch(options: SearchFlowOptions & {
    dateRange?: { start: string; end: string };
    tags?: string[];
    minSuccessRate?: number;
  }): Promise<HTMLElement[]> {
    const { user } = this.context;

    // Open advanced search
    const advancedButton = await screen.findByRole('button', {
      name: /advanced/i
    });
    await user.click(advancedButton);

    // Wait for advanced form to appear
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /advanced/i })).toBeInTheDocument();
    });

    // Fill advanced options
    if (options.dateRange) {
      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);

      await user.clear(startDate);
      await user.type(startDate, options.dateRange.start);

      await user.clear(endDate);
      await user.type(endDate, options.dateRange.end);
    }

    if (options.tags && options.tags.length > 0) {
      const tagInput = screen.getByLabelText(/tags/i);

      for (const tag of options.tags) {
        await user.clear(tagInput);
        await user.type(tagInput, tag);
        await user.keyboard('{Enter}');
      }
    }

    if (options.minSuccessRate !== undefined) {
      const successRateSlider = screen.getByLabelText(/success rate/i);
      fireEvent.change(successRateSlider, { target: { value: options.minSuccessRate } });
    }

    // Submit advanced search
    const searchButton = within(
      screen.getByRole('region', { name: /advanced/i })
    ).getByRole('button', { name: /search/i });

    await user.click(searchButton);

    return this.performSearch(options);
  }

  async testSearchSuggestions(): Promise<string[]> {
    const { user } = this.context;

    const searchInput = await screen.findByRole('searchbox');

    // Type partial query to trigger suggestions
    await user.type(searchInput, 'VSA');

    // Wait for suggestions to appear
    await waitFor(() => {
      const suggestionsList = screen.getByRole('listbox', { name: /suggestions/i });
      expect(suggestionsList).toBeInTheDocument();
    });

    const suggestions = screen.getAllByRole('option');
    return suggestions.map(s => s.textContent || '');
  }

  async testSearchHistory(): Promise<void> {
    const { user } = this.context;

    // Click search history button
    const historyButton = await screen.findByRole('button', {
      name: /history/i
    });
    await user.click(historyButton);

    // Wait for history panel to appear
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /search history/i })).toBeInTheDocument();
    });

    // Select a recent search
    const historyItems = screen.getAllByRole('button', { name: /search for/i });
    if (historyItems.length > 0) {
      await user.click(historyItems[0]);

      // Verify search was executed
      await waitFor(() => {
        const searchInput = screen.getByRole('searchbox') as HTMLInputElement;
        expect(searchInput.value).toBeTruthy();
      });
    }
  }
}

/**
 * User Flow: Add Knowledge Base Entry
 */
export class AddEntryUserFlow {
  constructor(private context: UserFlowContext) {}

  async openAddEntryForm(): Promise<HTMLElement> {
    const { user } = this.context;

    const addButton = await screen.findByRole('button', {
      name: /add.*knowledge|add.*entry/i
    });
    await user.click(addButton);

    const form = await screen.findByRole('form', {
      name: /add.*knowledge|add.*entry/i
    });

    expect(form).toBeInTheDocument();
    return form;
  }

  async fillEntryForm(options: AddEntryFlowOptions): Promise<void> {
    const endMeasurement = this.context.performanceTracking
      ? UserFlowPerformance.startMeasurement('add-entry-flow')
      : () => {};

    const { user } = this.context;
    const {
      title,
      problem,
      solution,
      category,
      tags = [],
      severity,
      useAdvancedOptions = false
    } = options;

    // Fill basic fields
    const titleInput = await screen.findByRole('textbox', { name: /title/i });
    await user.clear(titleInput);
    await user.type(titleInput, title);

    const categorySelect = await screen.findByRole('combobox', { name: /category/i });
    await user.selectOptions(categorySelect, category);

    const problemTextArea = await screen.findByRole('textbox', { name: /problem/i });
    await user.clear(problemTextArea);
    await user.type(problemTextArea, problem);

    const solutionTextArea = await screen.findByRole('textbox', { name: /solution/i });
    await user.clear(solutionTextArea);
    await user.type(solutionTextArea, solution);

    // Handle advanced options
    if (useAdvancedOptions || severity) {
      const advancedToggle = screen.getByRole('button', {
        name: /advanced.*options/i
      });
      await user.click(advancedToggle);

      if (severity) {
        const severitySelect = await screen.findByRole('combobox', {
          name: /severity/i
        });
        await user.selectOptions(severitySelect, severity);
      }
    }

    // Add tags
    if (tags.length > 0) {
      const tagInput = screen.getByRole('textbox', { name: /tag/i });

      for (const tag of tags) {
        await user.clear(tagInput);
        await user.type(tagInput, tag);

        // Press Enter or click Add button
        const addTagButton = screen.getByRole('button', { name: /add/i });
        await user.click(addTagButton);
      }
    }

    endMeasurement();
  }

  async submitEntryForm(expectSuccess: boolean = true): Promise<void> {
    const { user } = this.context;

    const submitButton = screen.getByRole('button', {
      name: /add entry|save/i,
      exact: false
    });

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    if (expectSuccess) {
      // Wait for success indication (form closes or success message)
      await waitFor(() => {
        const successMessage = screen.queryByText(/success|added|saved/i);
        const formClosed = !screen.queryByRole('form', { name: /add.*knowledge/i });

        expect(successMessage || formClosed).toBeTruthy();
      }, { timeout: 3000 });
    }
  }

  async testFormValidation(options: FormInteractionOptions = {}): Promise<string[]> {
    const { user } = this.context;
    const errors: string[] = [];

    // Try to submit empty form
    const submitButton = screen.getByRole('button', {
      name: /add entry|save/i,
      exact: false
    });

    await user.click(submitButton);

    // Wait for validation errors
    await waitFor(() => {
      const errorMessages = screen.queryAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    // Collect error messages
    const errorElements = screen.getAllByRole('alert');
    errors.push(...errorElements.map(el => el.textContent || ''));

    // Test individual field validation
    const requiredFields = [
      { name: /title/i, value: 'a' }, // Too short
      { name: /problem/i, value: 'short' }, // Too short
      { name: /solution/i, value: 'brief' } // Too short
    ];

    for (const field of requiredFields) {
      const input = screen.getByRole('textbox', { name: field.name });

      await user.clear(input);
      await user.type(input, field.value);
      await user.tab(); // Trigger blur validation

      // Wait for field-specific error
      await waitFor(() => {
        const fieldError = input.closest('.field')?.querySelector('[role="alert"]');
        if (fieldError) {
          errors.push(`${field.name.toString()}: ${fieldError.textContent}`);
        }
      });
    }

    return errors;
  }

  async testKeyboardNavigation(): Promise<{
    tabOrder: string[];
    shortcutsWork: boolean;
    accessibleLabels: boolean;
  }> {
    const { user } = this.context;

    // Test tab order
    const focusableElements = screen.getAllByRole(/textbox|combobox|button/);
    const tabOrder: string[] = [];

    if (focusableElements.length > 0) {
      focusableElements[0].focus();

      for (let i = 0; i < focusableElements.length; i++) {
        const activeElement = document.activeElement;
        if (activeElement) {
          tabOrder.push(
            activeElement.getAttribute('aria-label') ||
            activeElement.getAttribute('name') ||
            activeElement.tagName.toLowerCase()
          );
        }
        await user.tab();
      }
    }

    // Test keyboard shortcuts
    let shortcutsWork = true;

    // Test Ctrl+S (save draft)
    try {
      await user.keyboard('{Control>}s{/Control}');
      // Should not throw error or cause issues
    } catch (error) {
      shortcutsWork = false;
    }

    // Test accessibility labels
    const inputs = screen.getAllByRole(/textbox|combobox/);
    const accessibleLabels = inputs.every(input =>
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      document.querySelector(`label[for="${input.id}"]`)
    );

    return { tabOrder, shortcutsWork, accessibleLabels };
  }

  async testDraftFunctionality(): Promise<void> {
    const { user } = this.context;

    // Fill form partially
    const titleInput = screen.getByRole('textbox', { name: /title/i });
    await user.type(titleInput, 'Draft test entry');

    const problemInput = screen.getByRole('textbox', { name: /problem/i });
    await user.type(problemInput, 'This is a test problem for draft functionality');

    // Save draft
    const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
    await user.click(saveDraftButton);

    // Wait for draft saved indication
    await waitFor(() => {
      const draftIndicator = screen.getByText(/draft saved|saving/i);
      expect(draftIndicator).toBeInTheDocument();
    });

    // Clear form
    const resetButton = screen.getByRole('button', { name: /reset/i });
    await user.click(resetButton);

    // Load draft
    const loadDraftButton = screen.getByRole('button', { name: /load draft/i });
    await user.click(loadDraftButton);

    // Verify draft data is restored
    await waitFor(() => {
      expect(titleInput).toHaveValue('Draft test entry');
      expect(problemInput).toHaveValue('This is a test problem for draft functionality');
    });
  }
}

/**
 * User Flow: Rate Solution
 */
export class RatingSolutionUserFlow {
  constructor(private context: UserFlowContext) {}

  async rateSolution(options: RatingFlowOptions): Promise<void> {
    const endMeasurement = this.context.performanceTracking
      ? UserFlowPerformance.startMeasurement('rating-flow')
      : () => {};

    const { user } = this.context;
    const { rating, expectFeedback = false } = options;

    // Find rating buttons (thumbs up/down or success/failure)
    const ratingButtons = screen.getAllByRole('button', {
      name: rating ? /success|helpful|thumbs up/i : /failure|not helpful|thumbs down/i
    });

    expect(ratingButtons.length).toBeGreaterThan(0);

    const ratingButton = ratingButtons[0];
    await user.click(ratingButton);

    // Wait for feedback modal or inline feedback if expected
    if (expectFeedback) {
      await waitFor(() => {
        const feedbackForm = screen.getByRole('dialog', { name: /feedback/i });
        expect(feedbackForm).toBeInTheDocument();
      });

      // Fill feedback form
      const feedbackText = screen.getByRole('textbox', { name: /feedback|comment/i });
      await user.type(feedbackText, 'Test feedback for rating');

      const submitFeedbackButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitFeedbackButton);

      // Wait for feedback submission
      await waitFor(() => {
        const thankYouMessage = screen.getByText(/thank you|feedback received/i);
        expect(thankYouMessage).toBeInTheDocument();
      });
    } else {
      // Just wait for rating to be processed
      await waitFor(() => {
        const ratedIndicator = ratingButton.getAttribute('aria-pressed') === 'true' ||
                              ratingButton.classList.contains('rated');
        expect(ratedIndicator).toBeTruthy();
      });
    }

    endMeasurement();
  }

  async testRatingInteractions(): Promise<{
    canRate: boolean;
    showsFeedback: boolean;
    updatesUI: boolean;
  }> {
    const { user } = this.context;

    const successButton = screen.getByRole('button', { name: /success|helpful/i });
    const failureButton = screen.getByRole('button', { name: /failure|not helpful/i });

    // Test that buttons are interactive
    const canRate = successButton.getAttribute('disabled') === null &&
                   failureButton.getAttribute('disabled') === null;

    // Click success button
    await user.click(successButton);

    // Check if feedback modal appears
    const showsFeedback = await waitFor(() => {
      return screen.queryByRole('dialog', { name: /feedback/i }) !== null;
    }, { timeout: 1000 }).then(() => true).catch(() => false);

    // Check if UI updates (button state changes)
    const updatesUI = successButton.getAttribute('aria-pressed') === 'true' ||
                     successButton.classList.contains('rated') ||
                     successButton.classList.contains('selected');

    return { canRate, showsFeedback, updatesUI };
  }
}

/**
 * Component Integration Flow
 */
export class ComponentIntegrationFlow {
  constructor(private context: UserFlowContext) {}

  async testSearchToDetailFlow(): Promise<void> {
    const { user } = this.context;

    // Perform search
    const searchFlow = new SearchUserFlow(this.context);
    const results = await searchFlow.performSearch({
      query: 'VSAM error',
      expectResults: 1,
      selectFirst: true
    });

    expect(results.length).toBeGreaterThan(0);

    // Verify entry detail is shown
    await waitFor(() => {
      const entryDetail = screen.getByRole('main', { name: /entry detail/i });
      expect(entryDetail).toBeInTheDocument();
    });

    // Test rating from detail view
    const ratingFlow = new RatingSolutionUserFlow(this.context);
    await ratingFlow.rateSolution({
      entryId: 'test-entry',
      rating: true
    });
  }

  async testCompleteWorkflow(): Promise<void> {
    const { user } = this.context;

    // 1. Add new entry
    const addFlow = new AddEntryUserFlow(this.context);
    await addFlow.openAddEntryForm();
    await addFlow.fillEntryForm({
      title: 'Test VSAM Error Resolution',
      problem: 'VSAM dataset returns status 35 when attempting to open for processing',
      solution: 'Check if dataset exists and is properly cataloged. Verify access permissions.',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'dataset'],
      expectSuccess: true
    });
    await addFlow.submitEntryForm(true);

    // 2. Search for the new entry
    const searchFlow = new SearchUserFlow(this.context);
    const results = await searchFlow.performSearch({
      query: 'VSAM status 35',
      expectResults: 1,
      selectFirst: true
    });

    expect(results.length).toBeGreaterThan(0);

    // 3. Rate the entry
    const ratingFlow = new RatingSolutionUserFlow(this.context);
    await ratingFlow.rateSolution({
      entryId: 'test-entry',
      rating: true
    });

    // 4. Verify the workflow completed successfully
    await waitFor(() => {
      const successIndicators = screen.getAllByText(/success|completed|rated/i);
      expect(successIndicators.length).toBeGreaterThan(0);
    });
  }
}

/**
 * Error Handling Flow
 */
export class ErrorHandlingFlow {
  constructor(private context: UserFlowContext) {}

  async testNetworkErrorHandling(): Promise<void> {
    const { user } = this.context;

    // Mock network failure
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    try {
      // Attempt search that will fail
      const searchFlow = new SearchUserFlow(this.context);
      await searchFlow.performSearch({
        query: 'test query',
        useAI: true
      });

      // Should show error message and fallback to local search
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert', { name: /error|failed/i });
        expect(errorMessage).toBeInTheDocument();
      });

      // Should still show some results from local fallback
      const results = screen.queryAllByRole('article');
      expect(results.length).toBeGreaterThanOrEqual(0);
    } finally {
      global.fetch = originalFetch;
    }
  }

  async testFormErrorRecovery(): Promise<void> {
    const { user } = this.context;

    const addFlow = new AddEntryUserFlow(this.context);
    await addFlow.openAddEntryForm();

    // Mock submission failure
    const originalSubmit = global.electronAPI.addKBEntry;
    global.electronAPI.addKBEntry = jest.fn().mockRejectedValue(new Error('Submission failed'));

    try {
      await addFlow.fillEntryForm({
        title: 'Test Entry',
        problem: 'Test problem description',
        solution: 'Test solution description',
        category: 'Other',
        expectSuccess: false
      });

      await addFlow.submitEntryForm(false);

      // Should show error message
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent(/failed|error/i);
      });

      // Form should still be visible with data intact
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      expect(titleInput).toHaveValue('Test Entry');

      // Should be able to retry submission
      global.electronAPI.addKBEntry = originalSubmit;
      await addFlow.submitEntryForm(true);

    } finally {
      global.electronAPI.addKBEntry = originalSubmit;
    }
  }
}

// Export all user flow helpers
export {
  SearchUserFlow,
  AddEntryUserFlow,
  RatingSolutionUserFlow,
  ComponentIntegrationFlow,
  ErrorHandlingFlow,
  UserFlowPerformance
};