/**
 * End-to-End Support Team Workflow Tests
 * Comprehensive testing of real-world support team scenarios
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/renderer/App';
import { EnhancedKnowledgeDBService } from '../../src/services/EnhancedKnowledgeDBService';
import { SmartSearchService } from '../../src/services/SmartSearchService';
import { BatchOperationsService } from '../../src/services/BatchOperationsService';
import type { KBEntry } from '../../src/types';

// Mock services
jest.mock('../../src/services/EnhancedKnowledgeDBService');
jest.mock('../../src/services/SmartSearchService');
jest.mock('../../src/services/BatchOperationsService');

// Test data representing real support scenarios
const realWorldKBEntries: KBEntry[] = [
  {
    id: 'vsam-35-001',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file and displays message IGZ0035S. The file appears to exist in the catalog but the program cannot access it.',
    solution: '1. Verify the dataset exists using LISTCAT:\n   LISTCAT ENT(\'dataset.name\') ALL\n2. Check DD statement in JCL has correct DSN\n3. Ensure file is properly cataloged:\n   DELETE \'dataset.name\' NOPURGE CLUSTER\n   DEFINE CLUSTER(...)\n4. Verify RACF permissions using LISTDSD\n5. Check if file was migrated to tape',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog', 'igz0035s'],
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
    usage_count: 45,
    success_rate: 0.89,
    version: 1,
    status: 'active',
    created_by: 'analyst1'
  },
  {
    id: 's0c7-batch-001',
    title: 'S0C7 Data Exception in COBOL Batch Program',
    problem: 'Batch job abends with S0C7 completion code during arithmetic operations. The abend occurs at different points in the program execution, making it difficult to debug.',
    solution: '1. Check for uninitialized working storage:\n   - Review WORKING-STORAGE SECTION\n   - Look for VALUE clauses on numeric fields\n2. Validate input data:\n   - Use NUMERIC test before arithmetic\n   - Check for spaces in numeric fields\n3. Add debugging:\n   DISPLAY statements before arithmetic operations\n4. Common causes:\n   - Non-numeric data in COMP-3 fields\n   - Incorrect PICTURE clauses\n   - Bad data from previous step',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'cobol', 'arithmetic', 'batch'],
    created_at: new Date('2024-01-10'),
    updated_at: new Date('2024-01-20'),
    usage_count: 32,
    success_rate: 0.78,
    version: 2,
    status: 'active',
    created_by: 'analyst2'
  },
  {
    id: 'db2-deadlock-001',
    title: 'DB2 Deadlock Resolution - SQLCODE -911',
    problem: 'Application receives SQLCODE -911 indicating resource unavailable due to deadlock. Multiple concurrent transactions are accessing the same tables in different orders.',
    solution: '1. Identify deadlock pattern:\n   -DISPLAY THREAD(*) TYPE(ACTIVE)\n2. Review application logic:\n   - Ensure consistent table access order\n   - Minimize transaction hold time\n3. Add retry logic in application:\n   IF SQLCODE = -911 THEN\n      PERFORM RETRY-LOGIC\n4. Consider table partitioning\n5. Review lock escalation thresholds',
    category: 'DB2',
    tags: ['db2', 'deadlock', 'sqlcode', '-911', 'locking'],
    created_at: new Date('2024-01-08'),
    updated_at: new Date('2024-01-25'),
    usage_count: 28,
    success_rate: 0.82,
    version: 1,
    status: 'active',
    created_by: 'dba1'
  },
  {
    id: 'jcl-step-failed-001',
    title: 'JCL Step Fails with IEF472I Command Invalid',
    problem: 'JCL step fails with IEF472I message indicating invalid command. The error occurs in a step that worked previously but now fails consistently.',
    solution: '1. Check JCL syntax:\n   - Verify column positions (JCL starts in column 3)\n   - Check for invalid characters\n2. Review EXEC statement:\n   - PGM= parameter spelling\n   - PARM= parameter format\n3. Validate DD statements:\n   - DSN= parameter\n   - DISP= parameter values\n4. Check for recent system changes\n5. Verify program exists in load library',
    category: 'JCL',
    tags: ['jcl', 'ief472i', 'command-invalid', 'syntax'],
    created_at: new Date('2024-01-12'),
    updated_at: new Date('2024-01-12'),
    usage_count: 18,
    success_rate: 0.94,
    version: 1,
    status: 'active',
    created_by: 'analyst3'
  }
];

describe('Support Team E2E Workflows', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockKBService: jest.Mocked<EnhancedKnowledgeDBService>;
  let mockSearchService: jest.Mocked<SmartSearchService>;

  beforeEach(() => {
    user = userEvent.setup();

    // Setup comprehensive service mocks
    mockKBService = {
      getEntries: jest.fn().mockResolvedValue({
        data: realWorldKBEntries,
        total: realWorldKBEntries.length,
        hasMore: false
      }),
      searchEntries: jest.fn(),
      getEntry: jest.fn(),
      saveEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      getCategories: jest.fn().mockResolvedValue(['VSAM', 'Batch', 'DB2', 'JCL', 'Functional']),
      getTags: jest.fn().mockResolvedValue([]),
      trackUsage: jest.fn().mockResolvedValue({ success: true }),
      getMetrics: jest.fn().mockResolvedValue({
        totalEntries: realWorldKBEntries.length,
        totalSearches: 150,
        averageSuccessRate: 0.86
      })
    } as any;

    mockSearchService = {
      search: jest.fn(),
      getSuggestions: jest.fn().mockResolvedValue([])
    } as any;
  });

  describe('Incident Resolution Workflow', () => {
    it('should support complete incident resolution workflow for VSAM error', async () => {
      // Mock search returning relevant VSAM entry
      mockKBService.searchEntries.mockResolvedValue([realWorldKBEntries[0]]);
      mockSearchService.search.mockResolvedValue({
        results: [realWorldKBEntries[0]],
        aiEnhanced: true,
        suggestions: ['vsam status 35', 'file not found', 'catalog issue']
      });

      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Analyst encounters VSAM error and searches for solution
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'vsam status 35 file not found');

      // Should show AI suggestions
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Select AI suggestion
      const suggestion = screen.getByRole('option', { name: /vsam status 35/i });
      await user.click(suggestion);

      // Step 2: Review search results
      await waitFor(() => {
        expect(screen.getByText('VSAM Status 35 - File Not Found')).toBeInTheDocument();
        expect(screen.getByText(/IGZ0035S/i)).toBeInTheDocument();
      });

      // Step 3: Select the relevant entry
      const entryCard = screen.getByTestId('kb-entry-vsam-35-001');
      await user.click(entryCard);

      // Should show detailed solution
      await waitFor(() => {
        expect(screen.getByText(/LISTCAT ENT/i)).toBeInTheDocument();
        expect(screen.getByText(/Check DD statement/i)).toBeInTheDocument();
      });

      // Step 4: Copy solution for application
      const copyButton = screen.getByRole('button', { name: /copy solution/i });
      await user.click(copyButton);

      // Should confirm copy
      await waitFor(() => {
        expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument();
      });

      // Step 5: Rate the solution as successful
      const successButton = screen.getByRole('button', { name: /this helped/i });
      await user.click(successButton);

      // Should track usage
      expect(mockKBService.trackUsage).toHaveBeenCalledWith(
        'vsam-35-001',
        'success',
        expect.any(String)
      );

      // Should show confirmation
      await waitFor(() => {
        expect(screen.getByText(/thank you for your feedback/i)).toBeInTheDocument();
      });
    });

    it('should handle scenario where no exact match exists - create new entry', async () => {
      // Mock search returning no results
      mockKBService.searchEntries.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        results: [],
        aiEnhanced: false,
        suggestions: []
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Search for uncommon error
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'IMS U3303 unusual error');
      await user.keyboard('{Enter}');

      // Step 2: No results found
      await waitFor(() => {
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
      });

      // Should suggest creating new entry
      expect(screen.getByText(/create new knowledge entry/i)).toBeInTheDocument();

      // Step 3: Create new entry
      const createButton = screen.getByRole('button', { name: /create new entry/i });
      await user.click(createButton);

      // Should open entry form with pre-filled search term
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /new knowledge entry/i })).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toHaveValue('IMS U3303 unusual error');

      // Step 4: Fill out the form
      await user.clear(titleInput);
      await user.type(titleInput, 'IMS U3303 - Invalid Transaction Code');

      const problemTextarea = screen.getByLabelText(/problem/i);
      await user.type(problemTextarea, 'IMS transaction fails with U3303 abend code indicating invalid transaction code. Transaction was working previously but now consistently fails.');

      const solutionTextarea = screen.getByLabelText(/solution/i);
      await user.type(solutionTextarea, '1. Check transaction definition in PSB\n2. Verify APPLCTN table entries\n3. Check IMS control region messages\n4. Validate transaction routing');

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'Functional');

      const tagsInput = screen.getByLabelText(/tags/i);
      await user.type(tagsInput, 'ims{enter}u3303{enter}transaction{enter}');

      // Step 5: Save the entry
      mockKBService.saveEntry.mockResolvedValue({ id: 'new-ims-001', success: true });

      const saveButton = screen.getByRole('button', { name: /save entry/i });
      await user.click(saveButton);

      // Should confirm creation
      await waitFor(() => {
        expect(screen.getByText(/entry created successfully/i)).toBeInTheDocument();
      });

      expect(mockKBService.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IMS U3303 - Invalid Transaction Code',
          category: 'Functional',
          tags: expect.arrayContaining(['ims', 'u3303', 'transaction'])
        })
      );
    });

    it('should handle complex search with filters for batch processing errors', async () => {
      // Mock filtered search results
      const batchEntries = realWorldKBEntries.filter(entry => entry.category === 'Batch');
      mockKBService.searchEntries.mockResolvedValue(batchEntries);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Open advanced search
      const advancedButton = screen.getByRole('button', { name: /advanced search/i });
      await user.click(advancedButton);

      // Step 2: Set search filters
      const queryInput = screen.getByRole('textbox', { name: /search query/i });
      await user.type(queryInput, 'abend');

      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, 'Batch');

      const successRateSlider = screen.getByRole('slider', { name: /minimum success rate/i });
      await user.click(successRateSlider);
      // Set to 75%
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');

      // Step 3: Execute search
      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Should call search with filters
      await waitFor(() => {
        expect(mockKBService.searchEntries).toHaveBeenCalledWith(
          expect.objectContaining({
            query: 'abend',
            category: 'Batch',
            successRateMin: expect.any(Number)
          })
        );
      });

      // Should show filtered results
      expect(screen.getByText('S0C7 Data Exception in COBOL Batch Program')).toBeInTheDocument();
      expect(screen.queryByText('VSAM Status 35')).not.toBeInTheDocument(); // Filtered out
    });
  });

  describe('Bulk Management Workflows', () => {
    it('should support bulk category update workflow', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Enter bulk selection mode
      const bulkModeButton = screen.getByRole('button', { name: /bulk select/i });
      await user.click(bulkModeButton);

      // Should show checkboxes
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });

      // Step 2: Select multiple entries
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First entry
      await user.click(checkboxes[2]); // Second entry
      await user.click(checkboxes[3]); // Third entry

      // Should show batch operations bar
      await waitFor(() => {
        expect(screen.getByTestId('batch-operations-bar')).toBeInTheDocument();
        expect(screen.getByText('3 items selected')).toBeInTheDocument();
      });

      // Step 3: Update category
      const categoryUpdateButton = screen.getByRole('button', { name: /update category/i });
      await user.click(categoryUpdateButton);

      // Should show category selection dialog
      const dialog = screen.getByRole('dialog', { name: /update category/i });
      expect(dialog).toBeInTheDocument();

      const newCategorySelect = within(dialog).getByRole('combobox', { name: /new category/i });
      await user.selectOptions(newCategorySelect, 'Functional');

      // Step 4: Confirm update
      const confirmButton = within(dialog).getByRole('button', { name: /update/i });
      await user.click(confirmButton);

      // Should show progress
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      // Should complete successfully
      await waitFor(() => {
        expect(screen.getByText(/3 entries updated successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle bulk deletion with confirmation workflow', async () => {
      const mockBatchService = {
        executeOperation: jest.fn().mockResolvedValue({
          success: true,
          results: [
            { id: 'test-1', success: true },
            { id: 'test-2', success: true }
          ],
          summary: { total: 2, successful: 2, failed: 0 }
        })
      } as any;

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Enter bulk mode and select entries
      const bulkModeButton = screen.getByRole('button', { name: /bulk select/i });
      await user.click(bulkModeButton);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Initiate bulk delete
      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(deleteButton);

      // Should show confirmation dialog
      const confirmDialog = screen.getByRole('dialog', { name: /confirm deletion/i });
      expect(confirmDialog).toBeInTheDocument();
      expect(within(confirmDialog).getByText(/delete 2 entries/i)).toBeInTheDocument();

      // Confirm deletion
      const confirmDeleteButton = within(confirmDialog).getByRole('button', { name: /delete/i });
      await user.click(confirmDeleteButton);

      // Should show progress and completion
      await waitFor(() => {
        expect(screen.getByText(/deletion completed successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Knowledge Quality Workflows', () => {
    it('should support knowledge entry improvement workflow', async () => {
      // Mock entry with low success rate
      const lowQualityEntry = {
        ...realWorldKBEntries[1],
        success_rate: 0.45,
        usage_count: 50
      };

      mockKBService.getEntry.mockResolvedValue(lowQualityEntry);
      mockKBService.updateEntry.mockResolvedValue({ success: true });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Navigate to quality dashboard
      const qualityButton = screen.getByRole('button', { name: /quality dashboard/i });
      await user.click(qualityButton);

      // Should show low-quality entries
      await waitFor(() => {
        expect(screen.getByText(/entries needing improvement/i)).toBeInTheDocument();
        expect(screen.getByText(/45% success rate/i)).toBeInTheDocument();
      });

      // Step 2: Select entry for improvement
      const improveButton = screen.getByRole('button', { name: /improve this entry/i });
      await user.click(improveButton);

      // Should open edit form
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /edit entry/i })).toBeInTheDocument();
      });

      // Step 3: Enhance the solution
      const solutionTextarea = screen.getByLabelText(/solution/i);
      await user.clear(solutionTextarea);
      await user.type(solutionTextarea, 'Enhanced solution with more detailed steps:\n1. Check for uninitialized working storage with specific examples\n2. Use NUMPROC(NOPFD) compile option\n3. Add comprehensive data validation\n4. Include sample code for error handling\n5. Reference related KB entries for complex scenarios');

      // Add helpful tags
      const tagsInput = screen.getByLabelText(/tags/i);
      await user.type(tagsInput, 'debugging{enter}best-practices{enter}');

      // Step 4: Save improvements
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should confirm update
      await waitFor(() => {
        expect(screen.getByText(/entry updated successfully/i)).toBeInTheDocument();
      });

      expect(mockKBService.updateEntry).toHaveBeenCalledWith(
        lowQualityEntry.id,
        expect.objectContaining({
          solution: expect.stringContaining('Enhanced solution'),
          tags: expect.arrayContaining(['debugging', 'best-practices'])
        })
      );
    });

    it('should identify and merge duplicate entries workflow', async () => {
      // Mock duplicate detection
      const duplicateEntries = [
        realWorldKBEntries[0],
        {
          ...realWorldKBEntries[0],
          id: 'vsam-35-002',
          title: 'VSAM File Not Found - Status 35',
          similarity: 0.89
        }
      ];

      mockKBService.searchEntries.mockResolvedValue(duplicateEntries);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Access duplicate detection
      const duplicateButton = screen.getByRole('button', { name: /find duplicates/i });
      await user.click(duplicateButton);

      // Should show potential duplicates
      await waitFor(() => {
        expect(screen.getByText(/potential duplicates found/i)).toBeInTheDocument();
        expect(screen.getByText(/89% similar/i)).toBeInTheDocument();
      });

      // Step 2: Review duplicates side by side
      const reviewButton = screen.getByRole('button', { name: /review duplicates/i });
      await user.click(reviewButton);

      // Should show comparison view
      await waitFor(() => {
        expect(screen.getByTestId('duplicate-comparison')).toBeInTheDocument();
      });

      // Step 3: Choose merge action
      const mergeButton = screen.getByRole('button', { name: /merge entries/i });
      await user.click(mergeButton);

      // Should show merge options
      const mergeDialog = screen.getByRole('dialog', { name: /merge entries/i });
      expect(mergeDialog).toBeInTheDocument();

      // Select primary entry and merge strategy
      const primarySelect = within(mergeDialog).getByRole('combobox', { name: /primary entry/i });
      await user.selectOptions(primarySelect, realWorldKBEntries[0].id);

      const mergeStrategy = within(mergeDialog).getByRole('radio', { name: /combine solutions/i });
      await user.click(mergeStrategy);

      // Step 4: Execute merge
      const executeMergeButton = within(mergeDialog).getByRole('button', { name: /merge/i });
      await user.click(executeMergeButton);

      // Should confirm merge
      await waitFor(() => {
        expect(screen.getByText(/entries merged successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analytics and Reporting Workflows', () => {
    it('should provide comprehensive usage analytics for team leads', async () => {
      const mockAnalytics = {
        totalEntries: 150,
        totalSearches: 2500,
        averageSuccessRate: 0.82,
        topCategories: [
          { category: 'VSAM', count: 45, successRate: 0.89 },
          { category: 'Batch', count: 38, successRate: 0.76 },
          { category: 'DB2', count: 32, successRate: 0.85 }
        ],
        userActivity: [
          { user: 'analyst1', searches: 150, contributions: 12 },
          { user: 'analyst2', searches: 120, contributions: 8 },
          { user: 'analyst3', searches: 95, contributions: 15 }
        ],
        trendingIssues: [
          { keyword: 's0c7', trend: '+25%', category: 'Batch' },
          { keyword: 'deadlock', trend: '+18%', category: 'DB2' }
        ]
      };

      mockKBService.getMetrics.mockResolvedValue(mockAnalytics);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Step 1: Access analytics dashboard
      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      await user.click(analyticsButton);

      // Should show comprehensive analytics
      await waitFor(() => {
        expect(screen.getByText(/2,500 total searches/i)).toBeInTheDocument();
        expect(screen.getByText(/82% average success rate/i)).toBeInTheDocument();
      });

      // Step 2: View category breakdown
      expect(screen.getByText(/VSAM.*45 entries.*89%/i)).toBeInTheDocument();
      expect(screen.getByText(/Batch.*38 entries.*76%/i)).toBeInTheDocument();

      // Step 3: Check trending issues
      expect(screen.getByText(/trending issues/i)).toBeInTheDocument();
      expect(screen.getByText(/s0c7.*\+25%/i)).toBeInTheDocument();
      expect(screen.getByText(/deadlock.*\+18%/i)).toBeInTheDocument();

      // Step 4: Generate report
      const generateReportButton = screen.getByRole('button', { name: /generate report/i });
      await user.click(generateReportButton);

      // Should allow report customization
      const reportDialog = screen.getByRole('dialog', { name: /generate report/i });
      expect(reportDialog).toBeInTheDocument();

      const dateFromInput = within(reportDialog).getByLabelText(/from date/i);
      await user.type(dateFromInput, '2024-01-01');

      const includeUserActivity = within(reportDialog).getByRole('checkbox', { name: /include user activity/i });
      await user.click(includeUserActivity);

      const downloadButton = within(reportDialog).getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      // Should confirm report generation
      await waitFor(() => {
        expect(screen.getByText(/report generated successfully/i)).toBeInTheDocument();
      });
    });

    it('should track knowledge gap analysis for continuous improvement', async () => {
      const mockGapAnalysis = {
        frequentSearchesWithoutResults: [
          { query: 'cics abend asra', frequency: 15, lastSearched: new Date() },
          { query: 'ims bridge timeout', frequency: 12, lastSearched: new Date() },
          { query: 'mq channel stopped', frequency: 8, lastSearched: new Date() }
        ],
        lowSuccessRateEntries: [
          { id: 'batch-001', title: 'JCL Memory Issues', successRate: 0.42 },
          { id: 'vsam-002', title: 'VSAM Reorganization', successRate: 0.38 }
        ],
        emergingIssues: [
          { pattern: 'java heap space', frequency: 25, trend: 'increasing' },
          { pattern: 'ssl handshake', frequency: 18, trend: 'new' }
        ]
      };

      mockKBService.getGapAnalysis = jest.fn().mockResolvedValue(mockGapAnalysis);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Access knowledge gaps section
      const gapsButton = screen.getByRole('button', { name: /knowledge gaps/i });
      await user.click(gapsButton);

      // Should show gap analysis
      await waitFor(() => {
        expect(screen.getByText(/frequent searches without results/i)).toBeInTheDocument();
        expect(screen.getByText(/cics abend asra.*15 searches/i)).toBeInTheDocument();
      });

      // Should show low success entries
      expect(screen.getByText(/low success rate entries/i)).toBeInTheDocument();
      expect(screen.getByText(/JCL Memory Issues.*42%/i)).toBeInTheDocument();

      // Should identify emerging issues
      expect(screen.getByText(/emerging issues/i)).toBeInTheDocument();
      expect(screen.getByText(/java heap space.*increasing/i)).toBeInTheDocument();

      // Create entry from knowledge gap
      const createFromGapButton = screen.getByRole('button', { name: /create entry for "cics abend asra"/i });
      await user.click(createFromGapButton);

      // Should pre-populate form
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i);
        expect(titleInput).toHaveValue('CICS ABEND ASRA');
      });
    });
  });

  describe('Accessibility and Keyboard Navigation', () => {
    it('should support full keyboard navigation through support workflows', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Tab navigation through main interface
      await user.tab(); // Search input
      expect(screen.getByRole('textbox', { name: /search/i })).toHaveFocus();

      await user.tab(); // Advanced search button
      expect(screen.getByRole('button', { name: /advanced/i })).toHaveFocus();

      await user.tab(); // Category filter
      await user.tab(); // First entry

      const firstEntry = screen.getAllByTestId(/kb-entry-/)[0];
      expect(firstEntry).toHaveFocus();

      // Arrow key navigation between entries
      await user.keyboard('{ArrowDown}');
      const secondEntry = screen.getAllByTestId(/kb-entry-/)[1];
      expect(secondEntry).toHaveFocus();

      // Enter to select entry
      await user.keyboard('{Enter}');

      // Should open entry details
      await waitFor(() => {
        expect(screen.getByRole('article')).toBeInTheDocument();
      });

      // Tab through entry actions
      await user.tab(); // Copy button
      await user.tab(); // Rate helpful button
      await user.tab(); // Rate not helpful button

      // Should have proper focus management
      expect(document.activeElement).toHaveAttribute('role');
    });

    it('should provide screen reader friendly content and announcements', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Search should have proper labels and announcements
      const searchInput = screen.getByRole('textbox', { name: /search knowledge base/i });
      expect(searchInput).toHaveAttribute('aria-describedby');

      // Search and select entry
      await user.type(searchInput, 'vsam');

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/search results/i);
      });

      const firstEntry = screen.getAllByTestId(/kb-entry-/)[0];
      await user.click(firstEntry);

      // Should announce entry selection
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/selected.*vsam/i);
      });

      // Rate entry - should announce result
      const helpfulButton = screen.getByRole('button', { name: /this helped/i });
      await user.click(helpfulButton);

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/feedback recorded/i);
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance during intensive search operations', async () => {
      // Simulate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...realWorldKBEntries[0],
        id: `entry-${i}`,
        title: `KB Entry ${i}`,
        usage_count: Math.floor(Math.random() * 100)
      }));

      mockKBService.getEntries.mockResolvedValue({
        data: largeDataset,
        total: 1000,
        hasMore: true
      });

      const startTime = performance.now();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const initialRenderTime = performance.now() - startTime;
      expect(initialRenderTime).toBeLessThan(2000); // 2 second limit

      // Rapid search operations
      const searchInput = screen.getByRole('textbox', { name: /search/i });

      for (let i = 0; i < 10; i++) {
        await user.clear(searchInput);
        await user.type(searchInput, `query ${i}`);

        // Each search should complete quickly
        const searchStart = performance.now();
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(mockKBService.searchEntries).toHaveBeenCalled();
        });

        const searchTime = performance.now() - searchStart;
        expect(searchTime).toBeLessThan(500); // 500ms per search
      }

      // Memory usage should remain reasonable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(1024 * 1024 * 1024); // 1GB limit
    });
  });
});