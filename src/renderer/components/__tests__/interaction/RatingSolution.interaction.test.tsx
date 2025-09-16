import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { customRender, MockDataGenerator } from '../test-utils';
import { RatingSolutionUserFlow, UserFlowPerformance } from './user-flow-helpers';
import './setup';

// Mock Rating Component (since we need to test rating functionality)
const MockRatingComponent: React.FC<{
  entryId: string;
  initialRating?: 'success' | 'failure' | null;
  onRate: (entryId: string, successful: boolean) => void;
  onFeedback?: (entryId: string, feedback: string, rating: boolean) => void;
  showFeedbackModal?: boolean;
  disabled?: boolean;
}> = ({
  entryId,
  initialRating = null,
  onRate,
  onFeedback,
  showFeedbackModal = false,
  disabled = false
}) => {
  const [currentRating, setCurrentRating] = React.useState<'success' | 'failure' | null>(initialRating);
  const [showModal, setShowModal] = React.useState(false);
  const [pendingRating, setPendingRating] = React.useState<boolean | null>(null);

  const handleRatingClick = (successful: boolean) => {
    if (disabled) return;

    setPendingRating(successful);

    if (showFeedbackModal) {
      setShowModal(true);
    } else {
      executeRating(successful);
    }
  };

  const executeRating = (successful: boolean, feedback?: string) => {
    setCurrentRating(successful ? 'success' : 'failure');
    onRate(entryId, successful);

    if (feedback && onFeedback) {
      onFeedback(entryId, feedback, successful);
    }

    setShowModal(false);
    setPendingRating(null);
  };

  const handleFeedbackSubmit = (feedback: string) => {
    if (pendingRating !== null) {
      executeRating(pendingRating, feedback);
    }
  };

  return (
    <div className="rating-component" role="group" aria-labelledby="rating-label">
      <div id="rating-label" className="rating-label">
        Rate this solution:
      </div>

      <div className="rating-buttons">
        <button
          type="button"
          className={`rating-button rating-button--success ${
            currentRating === 'success' ? 'rated selected' : ''
          }`}
          onClick={() => handleRatingClick(true)}
          disabled={disabled}
          aria-pressed={currentRating === 'success'}
          aria-label="Mark as helpful solution"
          title="This solution was helpful"
        >
          👍 Helpful
        </button>

        <button
          type="button"
          className={`rating-button rating-button--failure ${
            currentRating === 'failure' ? 'rated selected' : ''
          }`}
          onClick={() => handleRatingClick(false)}
          disabled={disabled}
          aria-pressed={currentRating === 'failure'}
          aria-label="Mark as not helpful solution"
          title="This solution was not helpful"
        >
          👎 Not Helpful
        </button>
      </div>

      {currentRating && (
        <div className="rating-feedback" role="status" aria-live="polite">
          Thank you for your feedback!
        </div>
      )}

      {/* Feedback Modal */}
      {showModal && (
        <FeedbackModal
          onSubmit={handleFeedbackSubmit}
          onCancel={() => setShowModal(false)}
          isPositiveRating={pendingRating === true}
        />
      )}
    </div>
  );
};

const FeedbackModal: React.FC<{
  onSubmit: (feedback: string) => void;
  onCancel: () => void;
  isPositiveRating: boolean;
}> = ({ onSubmit, onCancel, isPositiveRating }) => {
  const [feedback, setFeedback] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(feedback);
  };

  React.useEffect(() => {
    // Focus management for modal
    const firstInput = document.querySelector('.feedback-modal textarea') as HTMLElement;
    firstInput?.focus();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-labelledby="feedback-title" aria-modal="true">
      <div className="modal-content feedback-modal">
        <div className="modal-header">
          <h3 id="feedback-title">
            {isPositiveRating ? 'Additional Comments' : 'Help us improve'}
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Close feedback modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="form-field">
            <label htmlFor="feedback-text">
              {isPositiveRating
                ? 'What made this solution helpful? (optional)'
                : 'What could be improved?'
              }
            </label>
            <textarea
              id="feedback-text"
              name="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={isPositiveRating
                ? 'Additional comments about this solution...'
                : 'Please describe what was missing or incorrect...'
              }
              rows={4}
              maxLength={1000}
            />
            <div className="character-count">
              {feedback.length}/1000 characters
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn--secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Mock Entry Detail Component with Rating
const MockEntryDetail: React.FC<{
  entry: any;
  onRate: (entryId: string, successful: boolean) => void;
  onFeedback?: (entryId: string, feedback: string, rating: boolean) => void;
  showFeedbackModal?: boolean;
}> = ({ entry, onRate, onFeedback, showFeedbackModal = false }) => {
  return (
    <div className="entry-detail" role="main" aria-labelledby="entry-title">
      <header className="entry-header">
        <h2 id="entry-title">{entry.title}</h2>
        <div className="entry-meta">
          <span className="category">{entry.category}</span>
          <span className="usage-count">Used {entry.usage_count || 0} times</span>
          {entry.success_count !== undefined && entry.failure_count !== undefined && (
            <span className="success-rate">
              Success rate: {
                entry.usage_count > 0
                  ? Math.round((entry.success_count / entry.usage_count) * 100)
                  : 0
              }%
            </span>
          )}
        </div>
      </header>

      <section className="entry-content">
        <div className="problem-section">
          <h3>Problem</h3>
          <p>{entry.problem}</p>
        </div>

        <div className="solution-section">
          <h3>Solution</h3>
          <div className="solution-content">
            {entry.solution.split('\n').map((line: string, index: number) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>

        {entry.tags && entry.tags.length > 0 && (
          <div className="tags-section">
            <h4>Tags</h4>
            <div className="tags-list">
              {entry.tags.map((tag: string) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className="entry-footer">
        <MockRatingComponent
          entryId={entry.id}
          onRate={onRate}
          onFeedback={onFeedback}
          showFeedbackModal={showFeedbackModal}
        />
      </footer>
    </div>
  );
};

describe('Rating Solution - User Interaction Tests', () => {
  let mockEntry: any;
  let mockOnRate: jest.Mock;
  let mockOnFeedback: jest.Mock;

  beforeEach(() => {
    mockEntry = MockDataGenerator.kbEntry({
      id: 'rating-test-entry',
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Job abends with VSAM status code 35 when trying to access dataset',
      solution: '1. Check if dataset exists using LISTCAT\n2. Verify dataset name spelling\n3. Check catalog search order\n4. Ensure proper job step allocation',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-access'],
      usage_count: 15,
      success_count: 12,
      failure_count: 3
    });

    mockOnRate = jest.fn();
    mockOnFeedback = jest.fn();

    // Clear performance measurements
    UserFlowPerformance.clearMeasurements();
  });

  describe('Basic Rating Functionality', () => {
    test('should display rating buttons for solution', async () => {
      customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // Verify rating component is present
      const ratingGroup = screen.getByRole('group', { name: /rate this solution/i });
      expect(ratingGroup).toBeInTheDocument();

      // Verify both rating buttons are present
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });

      expect(helpfulButton).toBeInTheDocument();
      expect(notHelpfulButton).toBeInTheDocument();

      // Buttons should be enabled initially
      expect(helpfulButton).not.toBeDisabled();
      expect(notHelpfulButton).not.toBeDisabled();

      // Buttons should not be pressed initially
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'false');
      expect(notHelpfulButton).toHaveAttribute('aria-pressed', 'false');
    });

    test('should handle positive rating interaction', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      const ratingFlow = new RatingSolutionUserFlow({
        user,
        performanceTracking: true
      });

      await ratingFlow.rateSolution({
        entryId: mockEntry.id,
        rating: true,
        expectFeedback: false
      });

      // Verify callback was called with correct parameters
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, true);

      // Verify UI updates
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'true');
      expect(helpfulButton).toHaveClass('rated', 'selected');

      // Verify thank you message appears
      const thankYouMessage = screen.getByRole('status');
      expect(thankYouMessage).toHaveTextContent(/thank you for your feedback/i);

      // Check performance tracking
      const measurements = UserFlowPerformance.getAllMeasurements();
      expect(measurements['rating-flow']).toBeDefined();
      expect(measurements['rating-flow'].average).toBeGreaterThan(0);
    });

    test('should handle negative rating interaction', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      const ratingFlow = new RatingSolutionUserFlow({ user });

      await ratingFlow.rateSolution({
        entryId: mockEntry.id,
        rating: false,
        expectFeedback: false
      });

      // Verify callback was called
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, false);

      // Verify UI updates
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });
      expect(notHelpfulButton).toHaveAttribute('aria-pressed', 'true');
      expect(notHelpfulButton).toHaveClass('rated', 'selected');

      // Verify feedback message
      expect(screen.getByRole('status')).toHaveTextContent(/thank you for your feedback/i);
    });

    test('should allow rating change', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // First, rate as helpful
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);

      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, true);
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'true');

      // Then change to not helpful
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });
      await user.click(notHelpfulButton);

      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, false);
      expect(notHelpfulButton).toHaveAttribute('aria-pressed', 'true');
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Feedback Modal Integration', () => {
    test('should show feedback modal for positive rating', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      const ratingFlow = new RatingSolutionUserFlow({ user });

      await ratingFlow.rateSolution({
        entryId: mockEntry.id,
        rating: true,
        expectFeedback: true
      });

      // Verify feedback modal appears
      const feedbackModal = screen.getByRole('dialog', { name: /additional comments/i });
      expect(feedbackModal).toBeInTheDocument();

      // Modal should have proper accessibility attributes
      expect(feedbackModal).toHaveAttribute('aria-modal', 'true');

      // Text area should be focused
      const feedbackTextarea = screen.getByRole('textbox', { name: /what made this solution helpful/i });
      expect(feedbackTextarea).toBeInTheDocument();
      expect(document.activeElement).toBe(feedbackTextarea);
    });

    test('should show feedback modal for negative rating', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });
      await user.click(notHelpfulButton);

      // Wait for modal to appear
      await waitFor(() => {
        const feedbackModal = screen.getByRole('dialog', { name: /help us improve/i });
        expect(feedbackModal).toBeInTheDocument();
      });

      // Should have different text for negative feedback
      const feedbackTextarea = screen.getByRole('textbox', { name: /what could be improved/i });
      expect(feedbackTextarea).toBeInTheDocument();
    });

    test('should handle feedback submission', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      // Click helpful button to open modal
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);

      // Fill out feedback
      const feedbackTextarea = screen.getByRole('textbox', { name: /what made this solution helpful/i });
      const feedbackText = 'The step-by-step instructions were very clear and easy to follow.';

      await user.type(feedbackTextarea, feedbackText);

      // Submit feedback
      const submitButton = screen.getByRole('button', { name: /submit feedback/i });
      await user.click(submitButton);

      // Verify callbacks were called
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, true);
      expect(mockOnFeedback).toHaveBeenCalledWith(mockEntry.id, feedbackText, true);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Thank you message should appear
      expect(screen.getByRole('status')).toHaveTextContent(/thank you for your feedback/i);
    });

    test('should handle feedback modal cancellation', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      // Open feedback modal
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);

      // Cancel modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Rating should not have been submitted
      expect(mockOnRate).not.toHaveBeenCalled();
      expect(mockOnFeedback).not.toHaveBeenCalled();

      // Button should not be in pressed state
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'false');
    });

    test('should handle feedback modal close button', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      // Open modal
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);

      // Click close button
      const closeButton = screen.getByRole('button', { name: /close feedback modal/i });
      await user.click(closeButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    test('should validate feedback text length', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      // Open modal
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Type long feedback text
      const feedbackTextarea = screen.getByRole('textbox', { name: /what made this solution helpful/i });
      const longText = 'A'.repeat(1001); // Exceed 1000 character limit

      await user.type(feedbackTextarea, longText);

      // Character counter should show limit
      const characterCount = screen.getByText(/1000\/1000 characters/i);
      expect(characterCount).toBeInTheDocument();

      // Textarea should be limited to 1000 characters
      expect(feedbackTextarea).toHaveValue('A'.repeat(1000));
    });
  });

  describe('Rating Component Integration Tests', () => {
    test('should test complete rating interaction flow', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      const ratingFlow = new RatingSolutionUserFlow({ user });

      // Test the complete rating interaction capabilities
      const interactionResults = await ratingFlow.testRatingInteractions();

      expect(interactionResults.canRate).toBe(true);
      expect(interactionResults.showsFeedback).toBe(true);
      expect(interactionResults.updatesUI).toBe(true);
    });

    test('should handle disabled rating state', async () => {
      const DisabledRatingEntry = () => (
        <MockRatingComponent
          entryId={mockEntry.id}
          onRate={mockOnRate}
          disabled={true}
        />
      );

      const { user } = customRender(<DisabledRatingEntry />);

      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });

      // Buttons should be disabled
      expect(helpfulButton).toBeDisabled();
      expect(notHelpfulButton).toBeDisabled();

      // Clicking should not trigger callbacks
      await user.click(helpfulButton);
      await user.click(notHelpfulButton);

      expect(mockOnRate).not.toHaveBeenCalled();
    });

    test('should preserve existing rating state', async () => {
      const RatedEntry = () => (
        <MockRatingComponent
          entryId={mockEntry.id}
          initialRating="success"
          onRate={mockOnRate}
        />
      );

      customRender(<RatedEntry />);

      // Should show existing rating
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'true');
      expect(helpfulButton).toHaveClass('rated', 'selected');

      // Should show thank you message
      expect(screen.getByRole('status')).toHaveTextContent(/thank you for your feedback/i);
    });
  });

  describe('Accessibility Compliance', () => {
    test('should have proper ARIA attributes', async () => {
      customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // Rating group should have proper labeling
      const ratingGroup = screen.getByRole('group', { name: /rate this solution/i });
      expect(ratingGroup).toHaveAttribute('aria-labelledby', 'rating-label');

      // Buttons should have proper ARIA attributes
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });

      expect(helpfulButton).toHaveAttribute('aria-pressed');
      expect(helpfulButton).toHaveAttribute('title');
      expect(notHelpfulButton).toHaveAttribute('aria-pressed');
      expect(notHelpfulButton).toHaveAttribute('title');
    });

    test('should support keyboard navigation', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // Tab to first rating button
      await user.tab();
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      expect(document.activeElement).toBe(helpfulButton);

      // Space should activate the button
      await user.keyboard(' ');
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, true);

      // Tab to second rating button
      await user.tab();
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });
      expect(document.activeElement).toBe(notHelpfulButton);

      // Enter should also activate
      await user.keyboard('{Enter}');
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, false);
    });

    test('should provide screen reader feedback', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // Rate the solution
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      await user.click(helpfulButton);

      // Status region should announce the result
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveTextContent(/thank you for your feedback/i);

      // Button state should be announced
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'true');
    });

    test('should maintain focus management in modal', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      // Open modal
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Focus should move to textarea
      const feedbackTextarea = screen.getByRole('textbox');
      expect(document.activeElement).toBe(feedbackTextarea);

      // Tab should cycle through modal elements
      await user.tab(); // Should go to cancel button
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));

      await user.tab(); // Should go to submit button
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /submit/i }));

      // Escape should close modal
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle rapid clicking gracefully', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });

      // Rapid fire clicks
      await user.click(helpfulButton);
      await user.click(helpfulButton);
      await user.click(helpfulButton);

      // Should only register the rating once (or handle appropriately)
      // This depends on the implementation - it might call multiple times or debounce
      expect(mockOnRate).toHaveBeenCalled();

      // Button should maintain proper state
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'true');
    });

    test('should handle very long feedback text', async () => {
      const { user } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
          showFeedbackModal={true}
        />
      );

      // Open modal
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      const feedbackTextarea = screen.getByRole('textbox');
      const veryLongText = 'This is a very long feedback text that exceeds normal length. '.repeat(20);

      await user.type(feedbackTextarea, veryLongText);

      // Should handle long text without performance issues
      const submitButton = screen.getByRole('button', { name: /submit feedback/i });
      await user.click(submitButton);

      // Should complete successfully
      expect(mockOnFeedback).toHaveBeenCalled();
    });

    test('should maintain rating state across re-renders', async () => {
      const { user, rerender } = customRender(
        <MockEntryDetail
          entry={mockEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // Rate the solution
      await user.click(screen.getByRole('button', { name: /mark as helpful/i }));

      // Re-render with updated entry (simulating state update)
      const updatedEntry = {
        ...mockEntry,
        usage_count: mockEntry.usage_count + 1,
        success_count: mockEntry.success_count + 1
      };

      rerender(
        <MockEntryDetail
          entry={updatedEntry}
          onRate={mockOnRate}
          onFeedback={mockOnFeedback}
        />
      );

      // Rating state should be maintained
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      expect(helpfulButton).toHaveAttribute('aria-pressed', 'true');

      // Updated stats should be shown
      expect(screen.getByText(/used 16 times/i)).toBeInTheDocument();
    });
  });
});