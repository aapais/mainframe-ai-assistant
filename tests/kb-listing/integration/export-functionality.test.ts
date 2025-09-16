/**
 * Export Functionality End-to-End Integration Tests
 * Tests complete export workflows from UI to file generation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs/promises';
import path from 'path';
import { KBExplorer } from '../../../src/renderer/pages/KBExplorer';
import { ExportDialog } from '../../../src/renderer/components/ExportDialog';
import { createTestDatabase, seedRealisticData } from '../helpers/test-database';
import { generateMockKBEntries } from '../helpers/mock-data-generator';
import Database from 'better-sqlite3';

// Mock file system operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock Electron dialog
const mockDialog = {
  showSaveDialog: jest.fn()
};

// Mock IPC
const mockIpcHandlers = new Map();
const mockIpcRenderer = {
  invoke: jest.fn((channel, ...args) => {
    const handler = mockIpcHandlers.get(channel);
    if (handler) {
      return Promise.resolve(handler(...args));
    }
    return Promise.reject(new Error(`No handler for ${channel}`));
  })
};

Object.defineProperty(window, 'api', {
  value: {
    invoke: mockIpcRenderer.invoke,
    dialog: mockDialog
  }
});

describe('Export Functionality Integration Tests', () => {
  let db: Database.Database;
  let mockData: any[];
  let user: any;
  let tempDir: string;

  beforeAll(async () => {
    db = createTestDatabase({ memory: true });
    await seedRealisticData(db);

    // Generate test data
    mockData = generateMockKBEntries(50);
    tempDir = '/tmp/test-exports';
  });

  beforeEach(async () => {
    user = userEvent.setup();

    // Clear mocks
    jest.clearAllMocks();
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockDialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: path.join(tempDir, 'export.json')
    });

    // Setup IPC handlers
    setupExportMockHandlers();
  });

  afterAll(() => {
    db?.close();
  });

  const setupExportMockHandlers = () => {
    // Mock export handler
    mockIpcHandlers.set('kb-listing:export-entries', async (options) => {
      const {
        format = 'json',
        filters = {},
        includeMetadata = true,
        filePath
      } = options;

      // Filter data based on options
      let exportData = [...mockData];

      if (filters.categories?.length) {
        exportData = exportData.filter(entry =>
          filters.categories.includes(entry.category)
        );
      }

      if (filters.severities?.length) {
        exportData = exportData.filter(entry =>
          filters.severities.includes(entry.severity)
        );
      }

      if (filters.tags?.length) {
        exportData = exportData.filter(entry =>
          entry.tags?.some(tag => filters.tags.includes(tag))
        );
      }

      if (filters.dateRange) {
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        exportData = exportData.filter(entry => {
          const entryDate = new Date(entry.created_at);
          return entryDate >= startDate && entryDate <= endDate;
        });
      }

      // Generate export content based on format
      let content: string;
      let actualFilePath: string;

      switch (format) {
        case 'json':
          const jsonExport = {
            ...(includeMetadata && {
              metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                entryCount: exportData.length,
                filters: filters,
                source: 'Mainframe KB Assistant'
              }
            }),
            entries: exportData
          };
          content = JSON.stringify(jsonExport, null, 2);
          actualFilePath = filePath || path.join(tempDir, 'kb-export.json');
          break;

        case 'csv':
          const csvHeaders = [
            'ID', 'Title', 'Problem', 'Solution', 'Category', 'Severity',
            'Tags', 'Created At', 'Updated At', 'Usage Count', 'Success Count', 'Failure Count'
          ];
          const csvRows = exportData.map(entry => [
            entry.id,
            `"${entry.title.replace(/"/g, '""')}"`,
            `"${entry.problem.replace(/"/g, '""')}"`,
            `"${entry.solution.replace(/"/g, '""')}"`,
            entry.category,
            entry.severity,
            `"${(entry.tags || []).join(', ')}"`,
            entry.created_at,
            entry.updated_at,
            entry.usage_count || 0,
            entry.success_count || 0,
            entry.failure_count || 0
          ]);
          content = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
          actualFilePath = filePath || path.join(tempDir, 'kb-export.csv');
          break;

        case 'markdown':
          content = `# Knowledge Base Export\n\n`;
          content += `Generated on: ${new Date().toISOString()}\n`;
          content += `Entries: ${exportData.length}\n\n`;

          exportData.forEach((entry, index) => {
            content += `## ${index + 1}. ${entry.title}\n\n`;
            content += `**Category:** ${entry.category}\n`;
            content += `**Severity:** ${entry.severity}\n`;
            if (entry.tags?.length) {
              content += `**Tags:** ${entry.tags.join(', ')}\n`;
            }
            content += `**Created:** ${entry.created_at}\n\n`;
            content += `### Problem\n${entry.problem}\n\n`;
            content += `### Solution\n${entry.solution}\n\n`;
            content += `### Usage Stats\n`;
            content += `- Usage Count: ${entry.usage_count || 0}\n`;
            content += `- Success Rate: ${entry.success_count || 0}/${(entry.success_count || 0) + (entry.failure_count || 0)}\n\n`;
            content += '---\n\n';
          });
          actualFilePath = filePath || path.join(tempDir, 'kb-export.md');
          break;

        case 'xml':
          content = '<?xml version="1.0" encoding="UTF-8"?>\n';
          content += '<knowledgeBase>\n';
          if (includeMetadata) {
            content += '  <metadata>\n';
            content += `    <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
            content += `    <version>1.0</version>\n`;
            content += `    <entryCount>${exportData.length}</entryCount>\n`;
            content += '  </metadata>\n';
          }
          content += '  <entries>\n';

          exportData.forEach(entry => {
            content += '    <entry>\n';
            content += `      <id>${entry.id}</id>\n`;
            content += `      <title><![CDATA[${entry.title}]]></title>\n`;
            content += `      <problem><![CDATA[${entry.problem}]]></problem>\n`;
            content += `      <solution><![CDATA[${entry.solution}]]></solution>\n`;
            content += `      <category>${entry.category}</category>\n`;
            content += `      <severity>${entry.severity}</severity>\n`;
            content += `      <createdAt>${entry.created_at}</createdAt>\n`;
            content += `      <updatedAt>${entry.updated_at}</updatedAt>\n`;
            content += `      <usageCount>${entry.usage_count || 0}</usageCount>\n`;

            if (entry.tags?.length) {
              content += '      <tags>\n';
              entry.tags.forEach(tag => {
                content += `        <tag>${tag}</tag>\n`;
              });
              content += '      </tags>\n';
            }

            content += '    </entry>\n';
          });

          content += '  </entries>\n';
          content += '</knowledgeBase>\n';
          actualFilePath = filePath || path.join(tempDir, 'kb-export.xml');
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Simulate file write
      await mockFs.writeFile(actualFilePath, content, 'utf8');

      return {
        success: true,
        data: {
          filePath: actualFilePath,
          entryCount: exportData.length,
          format: format,
          size: content.length,
          checksum: 'mock-checksum-' + content.length
        }
      };
    });

    // Mock entries handler for filtering
    mockIpcHandlers.set('kb-listing:get-entries', async (options) => {
      let filteredData = [...mockData];

      if (options.filters?.categories?.length) {
        filteredData = filteredData.filter(entry =>
          options.filters.categories.includes(entry.category)
        );
      }

      if (options.filters?.severities?.length) {
        filteredData = filteredData.filter(entry =>
          options.filters.severities.includes(entry.severity)
        );
      }

      const startIndex = (options.page - 1) * options.pageSize;
      const endIndex = startIndex + options.pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedData,
        pagination: {
          currentPage: options.page,
          pageSize: options.pageSize,
          totalItems: filteredData.length,
          totalPages: Math.ceil(filteredData.length / options.pageSize)
        }
      };
    });

    // Mock aggregations for export preview
    mockIpcHandlers.set('kb-listing:get-aggregations', async (options) => {
      const categories = {};
      const severities = {};

      mockData.forEach(entry => {
        categories[entry.category] = (categories[entry.category] || 0) + 1;
        severities[entry.severity] = (severities[entry.severity] || 0) + 1;
      });

      return {
        success: true,
        data: { categories, severities }
      };
    });
  };

  describe('Export Dialog Integration', () => {
    test('should open export dialog and show current filters', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Apply some filters first
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      const severityFilter = screen.getByLabelText(/severity/i);
      await user.selectOptions(severityFilter, 'high');

      // Open export dialog
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show export dialog with current filters
      expect(screen.getByText(/Export Knowledge Base/i)).toBeInTheDocument();
      expect(screen.getByText(/Category: VSAM/i)).toBeInTheDocument();
      expect(screen.getByText(/Severity: high/i)).toBeInTheDocument();
    });

    test('should allow format selection and show preview', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{ categories: ['VSAM'] }}
      />);

      // Should default to JSON format
      expect(screen.getByDisplayValue('json')).toBeInTheDocument();

      // Change to CSV format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'csv');

      // Should show CSV format selected
      expect(screen.getByDisplayValue('csv')).toBeInTheDocument();

      // Should show preview information
      expect(screen.getByText(/CSV format will include/i)).toBeInTheDocument();
    });

    test('should show export preview with entry count', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{ categories: ['VSAM'] }}
      />);

      // Should show entry count preview
      await waitFor(() => {
        expect(screen.getByText(/entries will be exported/i)).toBeInTheDocument();
      });

      // Should show estimated file size
      expect(screen.getByText(/estimated size/i)).toBeInTheDocument();
    });
  });

  describe('Export Format Tests', () => {
    test('should export to JSON format correctly', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Open export dialog
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Select JSON format (default)
      const exportConfirmButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportConfirmButton);

      // Should call export with JSON format
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            format: 'json',
            includeMetadata: true
          })
        );
      });

      // Should write JSON file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringMatching(/"entries":\s*\[/),
        'utf8'
      );
    });

    test('should export to CSV format correctly', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Select CSV format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'csv');

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should call export with CSV format
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            format: 'csv'
          })
        );
      });

      // Should write CSV file with headers
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.csv'),
        expect.stringMatching(/ID,Title,Problem,Solution/),
        'utf8'
      );
    });

    test('should export to Markdown format correctly', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Select Markdown format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'markdown');

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should call export with Markdown format
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            format: 'markdown'
          })
        );
      });

      // Should write Markdown file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.md'),
        expect.stringMatching(/# Knowledge Base Export/),
        'utf8'
      );
    });

    test('should export to XML format correctly', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Select XML format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'xml');

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should call export with XML format
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            format: 'xml'
          })
        );
      });

      // Should write XML file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.xml'),
        expect.stringMatching(/<knowledgeBase>/),
        'utf8'
      );
    });
  });

  describe('Export Filtering Tests', () => {
    test('should export with applied filters', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Apply filters
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      const severityFilter = screen.getByLabelText(/severity/i);
      await user.selectOptions(severityFilter, 'critical');

      // Export with filters
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      const exportConfirmButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportConfirmButton);

      // Should export with current filters
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            filters: {
              categories: ['VSAM'],
              severities: ['critical']
            }
          })
        );
      });
    });

    test('should export with date range filter', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Set date range in export dialog
      const startDateInput = screen.getByLabelText(/start date/i);
      await user.type(startDateInput, '2024-01-01');

      const endDateInput = screen.getByLabelText(/end date/i);
      await user.type(endDateInput, '2024-12-31');

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should include date range in export
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            filters: expect.objectContaining({
              dateRange: {
                start: '2024-01-01',
                end: '2024-12-31'
              }
            })
          })
        );
      });
    });

    test('should export with tag filters', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Set tag filters
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'error, critical, database');

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should include tag filters
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            filters: expect.objectContaining({
              tags: ['error', 'critical', 'database']
            })
          })
        );
      });
    });
  });

  describe('Export Progress and Status', () => {
    test('should show export progress during operation', async () => {
      // Mock slow export operation
      mockIpcHandlers.set('kb-listing:export-entries', async (options) => {
        // Simulate progress updates
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          success: true,
          data: {
            filePath: '/tmp/export.json',
            entryCount: 25,
            format: 'json',
            size: 50000
          }
        };
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show progress indicator
      expect(screen.getByText(/exporting/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Should complete and show success
      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/25 entries exported/i)).toBeInTheDocument();
    });

    test('should handle export cancellation', async () => {
      // Mock cancelable export
      let cancelled = false;
      mockIpcHandlers.set('kb-listing:export-entries', async (options) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (cancelled) {
              reject(new Error('Export cancelled'));
            } else {
              resolve({
                success: true,
                data: { filePath: '/tmp/export.json', entryCount: 10 }
              });
            }
          }, 200);

          // Simulate cancellation mechanism
          if (options.signal?.aborted) {
            cancelled = true;
            clearTimeout(timeout);
            reject(new Error('Export cancelled'));
          }
        });
      });

      mockIpcHandlers.set('kb-listing:cancel-export', async () => {
        cancelled = true;
        return { success: true };
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show cancel option
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

      // Cancel export
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should handle cancellation
      await waitFor(() => {
        expect(screen.getByText(/export cancelled/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export Error Handling', () => {
    test('should handle export permission errors', async () => {
      mockIpcHandlers.set('kb-listing:export-entries', async () => {
        throw new Error('Permission denied: Cannot write to /protected/path');
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      });

      // Should provide retry option
      expect(screen.getByRole('button', { name: /choose different location/i })).toBeInTheDocument();
    });

    test('should handle disk space errors', async () => {
      mockIpcHandlers.set('kb-listing:export-entries', async () => {
        throw new Error('ENOSPC: no space left on device');
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show disk space error
      await waitFor(() => {
        expect(screen.getByText(/no space left/i)).toBeInTheDocument();
      });

      // Should suggest solutions
      expect(screen.getByText(/free up disk space/i)).toBeInTheDocument();
    });

    test('should handle network connectivity issues during export', async () => {
      mockIpcHandlers.set('kb-listing:export-entries', async () => {
        throw new Error('Network error: Unable to fetch export data');
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show network error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should provide retry option
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Large Export Tests', () => {
    test('should handle large dataset exports efficiently', async () => {
      // Generate large mock dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-entry-${i}`,
        title: `Large Export Test Entry ${i}`,
        problem: 'A' + 'A'.repeat(500), // Large text
        solution: 'S' + 'S'.repeat(1000), // Very large text
        category: ['VSAM', 'JCL', 'DB2', 'Batch'][i % 4],
        severity: ['low', 'medium', 'high', 'critical'][i % 4],
        tags: [`tag${i % 10}`, `category${i % 5}`],
        created_at: new Date(2024, 0, i % 365).toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 50),
        failure_count: Math.floor(Math.random() * 10)
      }));

      mockData = largeDataset;

      mockIpcHandlers.set('kb-listing:export-entries', async (options) => {
        const startTime = performance.now();

        // Simulate processing large dataset
        let content = JSON.stringify({ entries: largeDataset }, null, 2);

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        return {
          success: true,
          data: {
            filePath: '/tmp/large-export.json',
            entryCount: largeDataset.length,
            format: 'json',
            size: content.length,
            processingTime
          }
        };
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should complete successfully
      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText(/1000 entries exported/i)).toBeInTheDocument();
    });

    test('should provide chunked export for very large datasets', async () => {
      // Mock chunked export handler
      mockIpcHandlers.set('kb-listing:export-entries', async (options) => {
        if (options.chunked) {
          // Simulate chunked processing
          const chunks = Math.ceil(mockData.length / options.chunkSize);

          return {
            success: true,
            data: {
              filePath: options.filePath,
              entryCount: mockData.length,
              chunks: chunks,
              chunkSize: options.chunkSize,
              format: options.format
            }
          };
        }

        // Regular export
        return {
          success: true,
          data: {
            filePath: options.filePath,
            entryCount: mockData.length,
            format: options.format
          }
        };
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Enable chunked export option
      const chunkedCheckbox = screen.getByLabelText(/chunked export/i);
      await user.click(chunkedCheckbox);

      // Set chunk size
      const chunkSizeInput = screen.getByLabelText(/chunk size/i);
      await user.clear(chunkSizeInput);
      await user.type(chunkSizeInput, '100');

      // Start export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should export in chunks
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            chunked: true,
            chunkSize: 100
          })
        );
      });
    });
  });

  describe('File Location and Naming', () => {
    test('should allow custom file location selection', async () => {
      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/custom/path/my-export.json'
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Click browse for location
      const browseButton = screen.getByRole('button', { name: /choose location/i });
      await user.click(browseButton);

      // Should open save dialog
      expect(mockDialog.showSaveDialog).toHaveBeenCalled();

      // Should show selected path
      expect(screen.getByDisplayValue('/custom/path/my-export.json')).toBeInTheDocument();

      // Export should use selected path
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            filePath: '/custom/path/my-export.json'
          })
        );
      });
    });

    test('should generate appropriate filename based on filters', async () => {
      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{
          categories: ['VSAM'],
          severities: ['critical']
        }}
      />);

      // Should suggest filename based on filters
      const filenameInput = screen.getByLabelText(/filename/i);
      expect(filenameInput).toHaveValue(
        expect.stringMatching(/kb-export-VSAM-critical-\d{4}-\d{2}-\d{2}\.json/)
      );
    });

    test('should handle file location cancellation', async () => {
      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: true
      });

      render(<ExportDialog
        isOpen={true}
        onClose={() => {}}
        currentFilters={{}}
      />);

      // Click browse for location
      const browseButton = screen.getByRole('button', { name: /choose location/i });
      await user.click(browseButton);

      // Should handle cancellation gracefully
      expect(mockDialog.showSaveDialog).toHaveBeenCalled();

      // Original path should remain
      const filenameInput = screen.getByLabelText(/filename/i);
      expect(filenameInput.value).not.toBe('/custom/path/my-export.json');
    });
  });
});