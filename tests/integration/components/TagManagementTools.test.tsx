import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagManagementTools } from '../../../src/components/KB/TagManagementTools';
import { EnhancedTagService } from '../../../src/services/EnhancedTagService';

// Mock the services
jest.mock('../../../src/services/EnhancedTagService');
jest.mock('../../../src/services/KnowledgeBaseService');

const mockTagService = {
  getAllTags: jest.fn(),
  getTagFrequency: jest.fn(),
  getTagAnalytics: jest.fn(),
  searchTags: jest.fn(),
  mergeTags: jest.fn(),
  getCleanupSuggestions: jest.fn(),
  cleanupTags: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
};

const mockKnowledgeBaseService = {
  findEntriesByTag: jest.fn(),
  updateEntry: jest.fn(),
};

describe('TagManagementTools Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();

    // Setup default mock responses
    mockTagService.getAllTags.mockResolvedValue([
      'vsam', 'jcl', 'cobol', 'db2', 'mainframe',
      'batch', 'cics', 'ims', 'dataset', 'abend',
      'duplicate-tag', 'DUPLICATE-TAG', // Case variations
      'unused-tag', 'similar-tag-1', 'similar-tag-2'
    ]);

    mockTagService.getTagFrequency.mockImplementation((tag: string) => {
      const frequencies: Record<string, number> = {
        'vsam': 45,
        'jcl': 38,
        'cobol': 32,
        'db2': 28,
        'mainframe': 25,
        'batch': 22,
        'cics': 18,
        'ims': 15,
        'dataset': 12,
        'abend': 10,
        'duplicate-tag': 8,
        'DUPLICATE-TAG': 2,
        'unused-tag': 0,
        'similar-tag-1': 5,
        'similar-tag-2': 4,
      };
      return Promise.resolve(frequencies[tag] || 0);
    });

    mockTagService.getTagAnalytics.mockResolvedValue({
      total_tags: 13,
      total_usage: 239,
      average_usage: 18.38,
      top_tags: [
        { tag: 'vsam', frequency: 45, percentage: 18.8 },
        { tag: 'jcl', frequency: 38, percentage: 15.9 },
        { tag: 'cobol', frequency: 32, percentage: 13.4 },
        { tag: 'db2', frequency: 28, percentage: 11.7 },
        { tag: 'mainframe', frequency: 25, percentage: 10.5 },
      ],
      usage_distribution: {
        high: 5, // >20 uses
        medium: 6, // 5-20 uses
        low: 2, // <5 uses
      },
      recommendations: {
        underused_tags: ['unused-tag'],
        overused_tags: ['vsam'],
        similar_tags: [['similar-tag-1', 'similar-tag-2']],
        case_variations: [['duplicate-tag', 'DUPLICATE-TAG']],
      },
    });

    mockTagService.getCleanupSuggestions.mockResolvedValue({
      case_variations: [
        {
          canonical: 'duplicate-tag',
          variations: ['DUPLICATE-TAG'],
          total_usage: 10,
        }
      ],
      similar_tags: [
        {
          primary: 'similar-tag-1',
          similar: ['similar-tag-2'],
          confidence: 0.85,
        }
      ],
      unused_tags: ['unused-tag'],
      low_usage_tags: [
        {
          tag: 'DUPLICATE-TAG',
          frequency: 2,
        }
      ],
    });

    (EnhancedTagService as jest.Mock).mockImplementation(() => mockTagService);
  });

  const defaultProps = {
    tagService: mockTagService as any,
    knowledgeBaseService: mockKnowledgeBaseService as any,
  };

  describe('Tag Analytics Display', () => {
    it('should display comprehensive tag analytics', async () => {
      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Tag Analytics')).toBeInTheDocument();
      });

      // Check analytics metrics
      expect(screen.getByText('13')).toBeInTheDocument(); // total_tags
      expect(screen.getByText('239')).toBeInTheDocument(); // total_usage
      expect(screen.getByText('18.38')).toBeInTheDocument(); // average_usage

      // Check top tags
      expect(screen.getByText('vsam')).toBeInTheDocument();
      expect(screen.getByText('45 uses (18.8%)')).toBeInTheDocument();

      // Check usage distribution
      expect(screen.getByText('5')).toBeInTheDocument(); // high usage
      expect(screen.getByText('6')).toBeInTheDocument(); // medium usage
      expect(screen.getByText('2')).toBeInTheDocument(); // low usage
    });

    it('should handle analytics loading states', async () => {
      // Mock slow loading
      mockTagService.getTagAnalytics.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      );

      render(<TagManagementTools {...defaultProps} />);

      // Should show loading state
      expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/loading analytics/i)).not.toBeInTheDocument();
      }, { timeout: 200 });
    });
  });

  describe('Tag Search and Filtering', () => {
    it('should search tags in real-time', async () => {
      mockTagService.searchTags.mockImplementation(({ query }) => {
        const allTags = ['vsam', 'jcl', 'cobol', 'db2', 'mainframe', 'batch'];
        const filtered = allTags.filter(tag =>
          tag.toLowerCase().includes(query.toLowerCase())
        );
        return Promise.resolve(filtered.map(tag => ({ tag, score: 1 })));
      });

      render(<TagManagementTools {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search tags/i);
      await user.type(searchInput, 'vs');

      await waitFor(() => {
        expect(mockTagService.searchTags).toHaveBeenCalledWith({
          query: 'vs',
          limit: 50,
          matchType: 'contains',
        });
      });
    });

    it('should filter tags by usage frequency', async () => {
      render(<TagManagementTools {...defaultProps} />);

      // Open filter menu
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      // Select high usage filter
      const highUsageOption = screen.getByText('High usage (20+)');
      await user.click(highUsageOption);

      await waitFor(() => {
        // Should show only high-usage tags
        expect(screen.getByText('vsam')).toBeInTheDocument();
        expect(screen.queryByText('unused-tag')).not.toBeInTheDocument();
      });
    });

    it('should sort tags by different criteria', async () => {
      render(<TagManagementTools {...defaultProps} />);

      // Open sort menu
      const sortButton = screen.getByRole('button', { name: /sort/i });
      await user.click(sortButton);

      // Sort by alphabetical
      const alphabeticalOption = screen.getByText('Alphabetical (A-Z)');
      await user.click(alphabeticalOption);

      await waitFor(() => {
        // Tags should be displayed in alphabetical order
        const tagElements = screen.getAllByTestId(/tag-item-/);
        const tagNames = tagElements.map(el =>
          within(el).getByTestId('tag-name').textContent
        );
        const sortedNames = [...tagNames].sort();
        expect(tagNames).toEqual(sortedNames);
      });
    });
  });

  describe('Tag Merging Operations', () => {
    it('should merge selected tags successfully', async () => {
      mockTagService.mergeTags.mockResolvedValue({
        affected_entries: 10,
        source_tags: ['duplicate-tag', 'DUPLICATE-TAG'],
        target_tag: 'duplicate-tag',
        conflicts_resolved: 1,
      });

      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('duplicate-tag')).toBeInTheDocument();
      });

      // Select tags for merging
      const duplicateTag = screen.getByTestId('tag-item-duplicate-tag');
      const duplicateTagUpper = screen.getByTestId('tag-item-DUPLICATE-TAG');

      const checkbox1 = within(duplicateTag).getByRole('checkbox');
      const checkbox2 = within(duplicateTagUpper).getByRole('checkbox');

      await user.click(checkbox1);
      await user.click(checkbox2);

      // Open bulk actions menu
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);

      // Select merge option
      const mergeOption = screen.getByText('Merge selected tags');
      await user.click(mergeOption);

      // Fill merge dialog
      const targetInput = screen.getByLabelText(/target tag/i);
      await user.clear(targetInput);
      await user.type(targetInput, 'duplicate-tag');

      const mergeButton = screen.getByRole('button', { name: /merge tags/i });
      await user.click(mergeButton);

      await waitFor(() => {
        expect(mockTagService.mergeTags).toHaveBeenCalledWith({
          source_tags: ['duplicate-tag', 'DUPLICATE-TAG'],
          target_tag: 'duplicate-tag',
          update_entries: true,
          resolve_conflicts: 'merge',
        });
      });

      // Should show success message
      expect(screen.getByText(/successfully merged.*10 entries/i)).toBeInTheDocument();
    });

    it('should handle merge conflicts properly', async () => {
      mockTagService.mergeTags.mockResolvedValue({
        affected_entries: 5,
        source_tags: ['tag1'],
        target_tag: 'existing-tag',
        conflicts_resolved: 2,
        warnings: ['Some entries already had the target tag'],
      });

      render(<TagManagementTools {...defaultProps} />);

      // Select a tag and attempt merge with conflict
      const tagItem = await screen.findByTestId('tag-item-vsam');
      const checkbox = within(tagItem).getByRole('checkbox');
      await user.click(checkbox);

      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);

      const mergeOption = screen.getByText('Merge selected tags');
      await user.click(mergeOption);

      // Set target tag that might cause conflicts
      const targetInput = screen.getByLabelText(/target tag/i);
      await user.type(targetInput, 'existing-tag');

      // Select conflict resolution strategy
      const conflictSelect = screen.getByLabelText(/conflict resolution/i);
      await user.selectOptions(conflictSelect, 'merge');

      const mergeButton = screen.getByRole('button', { name: /merge tags/i });
      await user.click(mergeButton);

      await waitFor(() => {
        // Should show warning about conflicts
        expect(screen.getByText(/conflicts resolved: 2/i)).toBeInTheDocument();
        expect(screen.getByText(/some entries already had the target tag/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tag Cleanup Operations', () => {
    it('should show cleanup suggestions', async () => {
      render(<TagManagementTools {...defaultProps} />);

      // Navigate to cleanup tab
      const cleanupTab = screen.getByRole('tab', { name: /cleanup/i });
      await user.click(cleanupTab);

      await waitFor(() => {
        expect(screen.getByText(/cleanup suggestions/i)).toBeInTheDocument();
      });

      // Should show case variations
      expect(screen.getByText(/case variations/i)).toBeInTheDocument();
      expect(screen.getByText('duplicate-tag → DUPLICATE-TAG')).toBeInTheDocument();

      // Should show similar tags
      expect(screen.getByText(/similar tags/i)).toBeInTheDocument();
      expect(screen.getByText('similar-tag-1')).toBeInTheDocument();

      // Should show unused tags
      expect(screen.getByText(/unused tags/i)).toBeInTheDocument();
      expect(screen.getByText('unused-tag')).toBeInTheDocument();
    });

    it('should execute cleanup operations', async () => {
      mockTagService.cleanupTags.mockResolvedValue({
        merged_tags: 3,
        removed_tags: 1,
        affected_entries: 15,
        operations: [
          { type: 'merge', source: ['DUPLICATE-TAG'], target: 'duplicate-tag' },
          { type: 'remove', tags: ['unused-tag'] },
        ],
      });

      render(<TagManagementTools {...defaultProps} />);

      const cleanupTab = screen.getByRole('tab', { name: /cleanup/i });
      await user.click(cleanupTab);

      await waitFor(() => {
        expect(screen.getByText(/cleanup suggestions/i)).toBeInTheDocument();
      });

      // Configure cleanup options
      const mergeCaseCheckbox = screen.getByLabelText(/merge case variations/i);
      await user.click(mergeCaseCheckbox);

      const removeUnusedCheckbox = screen.getByLabelText(/remove unused tags/i);
      await user.click(removeUnusedCheckbox);

      // Execute cleanup
      const executeButton = screen.getByRole('button', { name: /execute cleanup/i });
      await user.click(executeButton);

      // Confirm in dialog
      const confirmButton = screen.getByRole('button', { name: /confirm cleanup/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockTagService.cleanupTags).toHaveBeenCalledWith({
          merge_case_variations: true,
          merge_similar_tags: false,
          remove_unused_tags: true,
          remove_low_usage_tags: false,
          minimum_usage_threshold: 1,
        });
      });

      // Should show success message
      expect(screen.getByText(/cleanup completed.*3 merged.*1 removed/i)).toBeInTheDocument();
    });

    it('should allow customizing cleanup threshold', async () => {
      render(<TagManagementTools {...defaultProps} />);

      const cleanupTab = screen.getByRole('tab', { name: /cleanup/i });
      await user.click(cleanupTab);

      await waitFor(() => {
        expect(screen.getByText(/cleanup suggestions/i)).toBeInTheDocument();
      });

      // Adjust minimum usage threshold
      const thresholdInput = screen.getByLabelText(/minimum usage threshold/i);
      await user.clear(thresholdInput);
      await user.type(thresholdInput, '5');

      const removeLowUsageCheckbox = screen.getByLabelText(/remove low usage tags/i);
      await user.click(removeLowUsageCheckbox);

      const executeButton = screen.getByRole('button', { name: /execute cleanup/i });
      await user.click(executeButton);

      const confirmButton = screen.getByRole('button', { name: /confirm cleanup/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockTagService.cleanupTags).toHaveBeenCalledWith(
          expect.objectContaining({
            minimum_usage_threshold: 5,
            remove_low_usage_tags: true,
          })
        );
      });
    });
  });

  describe('Real-time Updates and Events', () => {
    it('should handle tag service events and update display', async () => {
      const eventListeners: Record<string, Function> = {};
      mockTagService.on.mockImplementation((event: string, listener: Function) => {
        eventListeners[event] = listener;
      });

      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Tag Analytics')).toBeInTheDocument();
      });

      // Simulate tag merged event
      const mergeEvent = {
        type: 'tag_merged',
        operation: {
          source_tags: ['old-tag'],
          target_tag: 'new-tag',
        },
        result: {
          affected_entries: 5,
        },
        timestamp: new Date(),
      };

      eventListeners['tag_merged']?.(mergeEvent);

      await waitFor(() => {
        // Should refresh analytics after merge
        expect(mockTagService.getTagAnalytics).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle cleanup events', async () => {
      const eventListeners: Record<string, Function> = {};
      mockTagService.on.mockImplementation((event: string, listener: Function) => {
        eventListeners[event] = listener;
      });

      render(<TagManagementTools {...defaultProps} />);

      const cleanupEvent = {
        type: 'tags_cleaned',
        plan: {
          merge_case_variations: true,
          remove_unused_tags: true,
        },
        result: {
          merged_tags: 2,
          removed_tags: 1,
        },
        timestamp: new Date(),
      };

      eventListeners['tags_cleaned']?.(cleanupEvent);

      await waitFor(() => {
        // Should show notification about cleanup
        expect(screen.getByText(/tag cleanup completed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle tag service errors gracefully', async () => {
      mockTagService.getTagAnalytics.mockRejectedValue(new Error('Service unavailable'));

      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading analytics/i)).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle merge operation errors', async () => {
      mockTagService.mergeTags.mockRejectedValue(new Error('Merge failed'));

      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('vsam')).toBeInTheDocument();
      });

      // Attempt merge operation
      const tagItem = screen.getByTestId('tag-item-vsam');
      const checkbox = within(tagItem).getByRole('checkbox');
      await user.click(checkbox);

      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);

      const mergeOption = screen.getByText('Merge selected tags');
      await user.click(mergeOption);

      const targetInput = screen.getByLabelText(/target tag/i);
      await user.type(targetInput, 'merged-tag');

      const mergeButton = screen.getByRole('button', { name: /merge tags/i });
      await user.click(mergeButton);

      await waitFor(() => {
        expect(screen.getByText(/merge failed/i)).toBeInTheDocument();
      });
    });

    it('should handle cleanup operation errors', async () => {
      mockTagService.cleanupTags.mockRejectedValue(new Error('Cleanup failed'));

      render(<TagManagementTools {...defaultProps} />);

      const cleanupTab = screen.getByRole('tab', { name: /cleanup/i });
      await user.click(cleanupTab);

      await waitFor(() => {
        expect(screen.getByText(/cleanup suggestions/i)).toBeInTheDocument();
      });

      const executeButton = screen.getByRole('button', { name: /execute cleanup/i });
      await user.click(executeButton);

      const confirmButton = screen.getByRole('button', { name: /confirm cleanup/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/cleanup failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Tag Analytics')).toBeInTheDocument();
      });

      // Tab navigation should work
      const firstTab = screen.getByRole('tab', { name: /analytics/i });
      firstTab.focus();
      expect(firstTab).toHaveFocus();

      // Arrow keys should navigate between tabs
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      const managementTab = screen.getByRole('tab', { name: /management/i });
      expect(managementTab).toHaveFocus();
    });

    it('should have proper ARIA labels', async () => {
      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Tag Analytics')).toBeInTheDocument();
      });

      // Tab panel should have proper labeling
      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel).toHaveAttribute('aria-labelledby');

      // Search input should have label
      const searchInput = screen.getByRole('textbox', { name: /search tags/i });
      expect(searchInput).toHaveAttribute('aria-label');
    });

    it('should announce important state changes', async () => {
      render(<TagManagementTools {...defaultProps} />);

      // Look for live region for announcements
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Performance Considerations', () => {
    it('should debounce search input', async () => {
      jest.useFakeTimers();

      render(<TagManagementTools {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search tags/i);

      // Type quickly
      await user.type(searchInput, 'test');

      // Should not have called search yet
      expect(mockTagService.searchTags).not.toHaveBeenCalled();

      // Advance timers to trigger debounce
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockTagService.searchTags).toHaveBeenCalledWith({
          query: 'test',
          limit: 50,
          matchType: 'contains',
        });
      });

      jest.useRealTimers();
    });

    it('should virtualize large tag lists', async () => {
      // Mock large number of tags
      const largeTags = Array.from({length: 1000}, (_, i) => `tag-${i}`);
      mockTagService.getAllTags.mockResolvedValue(largeTags);

      render(<TagManagementTools {...defaultProps} />);

      await waitFor(() => {
        // Should not render all 1000 tags at once
        const renderedTags = screen.getAllByTestId(/tag-item-/);
        expect(renderedTags.length).toBeLessThan(100);
      });

      // Should have virtual scrolling container
      expect(screen.getByTestId('virtualized-tag-list')).toBeInTheDocument();
    });
  });
});