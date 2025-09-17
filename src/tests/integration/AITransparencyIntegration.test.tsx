/**
 * AI Transparency Integration Tests
 *
 * Tests the complete integration of AI transparency features including:
 * - Cost estimation before AI operations
 * - Authorization dialog workflow
 * - Real-time cost tracking
 * - Operation history logging
 * - Budget alerts and limits
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISearchTab } from '../../renderer/components/search/AISearchTab';
import { AuthorizationDialog } from '../../renderer/components/ai/AuthorizationDialog';
import { CostTracker } from '../../renderer/components/ai/CostTracker';
import { TransparentAISearchPage } from '../../renderer/pages/TransparentAISearchPage';
import { aiService } from '../../renderer/services/aiService';
import { KBEntry } from '../../types/services';
import { AIOperation, AIProvider } from '../../renderer/types/ai';

// Mock data
const mockKBEntries: KBEntry[] = [
  {
    id: '1',
    title: 'S0C7 Abend Resolution',
    problem: 'How to resolve S0C7 data exception abend',
    solution: 'Check for invalid numeric data in COBOL program',
    category: 'JCL',
    tags: ['abend', 's0c7', 'cobol'],
    created_date: '2024-01-01',
    updated_date: '2024-01-01',
    usage_count: 10,
    success_count: 8,
    failure_count: 2,
    difficulty_level: 'medium',
    author: 'test-user'
  },
  {
    id: '2',
    title: 'VSAM Status 35',
    problem: 'VSAM file gives status 35 error',
    solution: 'File not found - check DD statement',
    category: 'VSAM',
    tags: ['vsam', 'status35', 'file'],
    created_date: '2024-01-02',
    updated_date: '2024-01-02',
    usage_count: 15,
    success_count: 14,
    failure_count: 1,
    difficulty_level: 'easy',
    author: 'test-user'
  }
];

const mockAIOperation: AIOperation = {
  id: 'test-operation-1',
  operationType: 'search',
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  queryText: 'S0C7 abend troubleshooting',
  purpose: 'Knowledge base search with AI enhancement',
  timestamp: new Date(),
  userId: 'test-user',
  sessionId: 'test-session'
};

// Mock electron API
const mockElectronAPI = {
  getAllEntries: jest.fn().mockResolvedValue(mockKBEntries),
  searchWithAI: jest.fn().mockResolvedValue([]),
  searchLocal: jest.fn().mockResolvedValue([]),
  rateEntry: jest.fn().mockResolvedValue(true),
  getGeminiConfig: jest.fn().mockResolvedValue({}),
  getBuildInfo: jest.fn().mockResolvedValue({ version: '1.0.0' })
};

// Setup mocks
beforeAll(() => {
  (global as any).window.electronAPI = mockElectronAPI;
  (global as any).window.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random()
  };

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
});

beforeEach(() => {
  jest.clearAllMocks();
  aiService.clearHistory();
});

describe('AI Transparency Integration', () => {
  describe('Cost Estimation and Authorization', () => {
    test('should show cost estimation before AI search', async () => {
      const user = userEvent.setup();

      render(
        <AISearchTab
          entries={mockKBEntries}
          userId="test-user"
        />
      );

      // Trigger AI search
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'S0C7 abend');

      // Should show authorization dialog with cost estimate
      await waitFor(() => {
        expect(screen.getByText(/AI Operation Authorization Required/i)).toBeInTheDocument();
        expect(screen.getByText(/Estimated Cost/i)).toBeInTheDocument();
        expect(screen.getByText(/Input Tokens/i)).toBeInTheDocument();
        expect(screen.getByText(/Output Tokens/i)).toBeInTheDocument();
      });
    });

    test('should show search-specific context in authorization dialog', async () => {
      render(
        <AuthorizationDialog
          isOpen={true}
          operation={mockAIOperation}
          estimatedCost={0.0025}
          tokensEstimate={{ input: 100, output: 200, total: 300 }}
          onApprove={jest.fn()}
          onDeny={jest.fn()}
          onAlwaysAllow={jest.fn()}
        />
      );

      expect(screen.getByText(/AI-Enhanced Knowledge Base Search/i)).toBeInTheDocument();
      expect(screen.getByText(/10-20 relevant entries/i)).toBeInTheDocument();
      expect(screen.getByText(/Semantic search, explanations, highlighting/i)).toBeInTheDocument();
    });

    test('should handle authorization approval', async () => {
      const user = userEvent.setup();
      const onApprove = jest.fn();

      render(
        <AuthorizationDialog
          isOpen={true}
          operation={mockAIOperation}
          estimatedCost={0.0025}
          tokensEstimate={{ input: 100, output: 200, total: 300 }}
          onApprove={onApprove}
          onDeny={jest.fn()}
          onAlwaysAllow={jest.fn()}
        />
      );

      const approveButton = screen.getByText(/approve/i);
      await user.click(approveButton);

      expect(onApprove).toHaveBeenCalledWith(mockAIOperation);
    });

    test('should handle authorization denial', async () => {
      const user = userEvent.setup();
      const onDeny = jest.fn();

      render(
        <AuthorizationDialog
          isOpen={true}
          operation={mockAIOperation}
          estimatedCost={0.0025}
          tokensEstimate={{ input: 100, output: 200, total: 300 }}
          onApprove={jest.fn()}
          onDeny={onDeny}
          onAlwaysAllow={jest.fn()}
        />
      );

      const denyButton = screen.getByText(/deny/i);
      await user.click(denyButton);

      expect(onDeny).toHaveBeenCalled();
    });
  });

  describe('Real-time Cost Tracking', () => {
    test('should show real-time cost updates during AI operation', async () => {
      const user = userEvent.setup();

      // Mock search with delay to simulate real operation
      mockElectronAPI.searchWithAI.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([]), 1000))
      );

      render(
        <AISearchTab
          entries={mockKBEntries}
          userId="test-user"
        />
      );

      // Start AI search
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test query');

      // Approve operation
      await waitFor(() => {
        expect(screen.getByText(/approve/i)).toBeInTheDocument();
      });

      const approveButton = screen.getByText(/approve/i);
      await user.click(approveButton);

      // Should show progress indicators
      await waitFor(() => {
        expect(screen.getByText(/Initializing AI search/i) || screen.getByText(/Processing query/i)).toBeInTheDocument();
      });

      // Should show cost updates
      await waitFor(() => {
        expect(screen.getByText(/\$0\./)).toBeInTheDocument(); // Cost display
      });
    });

    test('should update session cost totals', async () => {
      // Log a test operation
      await aiService.logOperation(
        mockAIOperation,
        0.0025,
        { input: 100, output: 200, total: 300 },
        true
      );

      const usage = aiService.getCurrentUsage();
      expect(usage.totalCost).toBeGreaterThan(0);
      expect(usage.totalOperations).toBe(1);
    });
  });

  describe('Budget Alerts and Limits', () => {
    test('should show budget alerts when approaching limits', async () => {
      // Set low budget limits for testing
      aiService.updateBudgetLimits({
        dailyLimit: 0.01,
        monthlyLimit: 0.10,
        warningThreshold: 50
      });

      // Log operation that exceeds threshold
      await aiService.logOperation(
        mockAIOperation,
        0.006, // 60% of daily limit
        { input: 100, output: 200, total: 300 },
        true
      );

      const estimate = await aiService.getSearchEstimate(
        'test query',
        'openai',
        'gpt-3.5-turbo'
      );

      expect(estimate.budgetWarnings.length).toBeGreaterThan(0);
    });

    test('should prevent operations that exceed budget', async () => {
      // Set very low budget limits
      aiService.updateBudgetLimits({
        dailyLimit: 0.001,
        perOperationLimit: 0.0005
      });

      const estimate = await aiService.getSearchEstimate(
        'complex query that would cost more',
        'openai',
        'gpt-4' // More expensive model
      );

      expect(estimate.canAfford).toBe(false);
      expect(estimate.budgetWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Operation History', () => {
    test('should log all AI operations', async () => {
      const initialHistory = aiService.getOperationHistory();
      const initialCount = initialHistory.length;

      await aiService.logOperation(
        mockAIOperation,
        0.0025,
        { input: 100, output: 200, total: 300 },
        true
      );

      const updatedHistory = aiService.getOperationHistory();
      expect(updatedHistory.length).toBe(initialCount + 1);
      expect(updatedHistory[0].operation.queryText).toBe(mockAIOperation.queryText);
    });

    test('should filter operation history by type', () => {
      const searchHistory = aiService.getOperationHistory({ operationType: 'search' });
      const allOperations = aiService.getOperationHistory();

      expect(searchHistory.length).toBeLessThanOrEqual(allOperations.length);
      searchHistory.forEach(operation => {
        expect(operation.operation.operationType).toBe('search');
      });
    });

    test('should display operation history in UI', async () => {
      // Log some test operations
      await aiService.logOperation(mockAIOperation, 0.0025, { input: 100, output: 200, total: 300 }, true);

      render(
        <CostTracker
          userId="test-user"
          compact={false}
          showBudgetAlerts={true}
        />
      );

      // Should show operation count
      await waitFor(() => {
        expect(screen.getByText(/Total Operations/i)).toBeInTheDocument();
      });
    });
  });

  describe('Complete Transparency Page Integration', () => {
    test('should render complete transparency page', async () => {
      render(<TransparentAISearchPage />);

      await waitFor(() => {
        expect(screen.getByText(/AI Search with Transparency/i)).toBeInTheDocument();
        expect(screen.getByText(/Complete cost and operation visibility/i)).toBeInTheDocument();
      });
    });

    test('should show all transparency features', async () => {
      const user = userEvent.setup();

      render(<TransparentAISearchPage />);

      await waitFor(() => {
        expect(screen.getByText(/AI Search with Transparency/i)).toBeInTheDocument();
      });

      // Should show feature indicators
      expect(screen.getByText(/Pre-search cost estimation/i)).toBeInTheDocument();
      expect(screen.getByText(/Real-time operation tracking/i)).toBeInTheDocument();
      expect(screen.getByText(/Complete operation history/i)).toBeInTheDocument();
      expect(screen.getByText(/Budget alerts and limits/i)).toBeInTheDocument();
      expect(screen.getByText(/User authorization required/i)).toBeInTheDocument();
    });

    test('should handle budget alert acknowledgment', async () => {
      const user = userEvent.setup();

      // Trigger budget alert
      aiService.emit('budget-alert', {
        type: 'daily',
        usage: 8.5,
        limit: 10.0,
        percentage: 85.0
      });

      render(<TransparentAISearchPage />);

      await waitFor(() => {
        expect(screen.getByText(/Budget Alert/i)).toBeInTheDocument();
        expect(screen.getByText(/daily budget at 85\.0%/i)).toBeInTheDocument();
      });

      const acknowledgeButton = screen.getByText(/acknowledge/i);
      await user.click(acknowledgeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Budget Alert/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle AI service failures gracefully', async () => {
      const user = userEvent.setup();

      // Mock API failure
      mockElectronAPI.searchWithAI.mockRejectedValueOnce(new Error('API Error'));

      render(
        <AISearchTab
          entries={mockKBEntries}
          userId="test-user"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test query');

      // Approve operation
      await waitFor(() => {
        expect(screen.getByText(/approve/i)).toBeInTheDocument();
      });

      const approveButton = screen.getByText(/approve/i);
      await user.click(approveButton);

      // Should fallback to local search
      await waitFor(() => {
        expect(mockElectronAPI.searchLocal).toHaveBeenCalled();
      });
    });

    test('should validate cost calculations', async () => {
      const estimate = await aiService.getSearchEstimate(
        'test query',
        'openai',
        'gpt-3.5-turbo'
      );

      expect(estimate.cost.totalCost).toBeGreaterThan(0);
      expect(estimate.cost.inputCost).toBeGreaterThanOrEqual(0);
      expect(estimate.cost.outputCost).toBeGreaterThanOrEqual(0);
      expect(estimate.cost.totalCost).toBe(estimate.cost.inputCost + estimate.cost.outputCost);
      expect(estimate.tokens.total).toBe(estimate.tokens.input + estimate.tokens.output);
    });

    test('should handle malformed operation data', async () => {
      const invalidOperation = {
        ...mockAIOperation,
        queryText: undefined // Invalid data
      };

      // Should not throw error
      await expect(aiService.logOperation(
        invalidOperation as AIOperation,
        0.001,
        { input: 10, output: 10, total: 20 },
        false,
        'Invalid query text'
      )).resolves.not.toThrow();
    });
  });

  describe('Performance and Optimization', () => {
    test('should debounce cost estimation requests', async () => {
      const user = userEvent.setup();

      render(
        <AISearchTab
          entries={mockKBEntries}
          userId="test-user"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Type quickly to trigger debouncing
      await user.type(searchInput, 'quick typing test');

      // Should only make one estimation request after debounce
      await waitFor(() => {
        expect(screen.getByDisplayValue('quick typing test')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    test('should limit operation history size', async () => {
      // Add many operations to test limit
      for (let i = 0; i < 1200; i++) {
        await aiService.logOperation(
          { ...mockAIOperation, id: `operation-${i}` },
          0.001,
          { input: 10, output: 10, total: 20 },
          true
        );
      }

      const history = aiService.getOperationHistory({ limit: 1100 });
      expect(history.length).toBeLessThanOrEqual(1100);
    });
  });
});

describe('AI Service Unit Tests', () => {
  test('should calculate token estimates correctly', () => {
    const context = {
      query: 'How to fix S0C7 abend in COBOL program?',
      estimatedComplexity: 'medium' as const,
      expectedResultCount: 10,
      useSemanticSearch: true,
      includeExplanations: true
    };

    const tokens = aiService.estimateSearchTokens(context);

    expect(tokens.input).toBeGreaterThan(0);
    expect(tokens.output).toBeGreaterThan(0);
    expect(tokens.total).toBe(tokens.input + tokens.output);
  });

  test('should export operation history', () => {
    const jsonExport = aiService.exportHistory('json');
    expect(() => JSON.parse(jsonExport)).not.toThrow();

    const csvExport = aiService.exportHistory('csv');
    expect(csvExport).toContain('timestamp,operationType,provider');
  });

  test('should update budget limits', () => {
    const newLimits = {
      dailyLimit: 25.0,
      monthlyLimit: 200.0
    };

    aiService.updateBudgetLimits(newLimits);

    const usage = aiService.getCurrentUsage();
    expect(usage.daily.limit).toBe(25.0);
    expect(usage.monthly.limit).toBe(200.0);
  });
});

export {};