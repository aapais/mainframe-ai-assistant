/**
 * Performance Tests for React Components
 * Testing performance with large datasets and complex interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KBEntryForm } from '../../../implementation/frontend/components/forms/KBEntryForm';
import { MainWindowLayout } from '../../../implementation/frontend/layouts/MainWindowLayout';
import { mockElectronAPI } from '../../../src/renderer/components/__tests__/setup';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME_MS: 100,
  INTERACTION_TIME_MS: 50,
  MEMORY_LEAK_THRESHOLD_MB: 10,
  LARGE_DATASET_SIZE: 1000,
  UPDATE_TIME_MS: 200,
  SCROLL_PERFORMANCE_MS: 16, // 60 FPS target
};

describe('Performance Tests', () => {
  let memoryBefore: number;
  let renderStartTime: number;

  beforeEach(() => {
    jest.clearAllMocks();
    memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
    renderStartTime = performance.now();
    
    // Mock performance-critical APIs
    mockElectronAPI.searchKBEntries.mockResolvedValue([]);
    mockElectronAPI.validateKBEntry.mockResolvedValue({ valid: true });
  });

  const generateLargeKBDataset = (size: number) => {
    return Array.from({ length: size }, (_, index) => ({
      id: `entry-${index}`,
      title: `KB Entry ${index} - ${Math.random().toString(36).substring(7)}`,
      problem: `This is a detailed problem description for entry ${index}. `.repeat(5),
      solution: `This is a comprehensive solution for problem ${index}. `.repeat(8),
      category: ['VSAM', 'JCL', 'DB2', 'Batch', 'System'][index % 5] as const,
      tags: [`tag${index % 10}`, `category${index % 3}`, `type${index % 7}`],
      created_at: new Date(Date.now() - index * 1000),
      updated_at: new Date(Date.now() - index * 500),
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20),
    }));
  };

  describe('Form Rendering Performance', () => {
    it('renders KBEntryForm within performance threshold', async () => {
      const startTime = performance.now();
      
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(`📊 Form render time: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
    });

    it('maintains performance with pre-filled data', async () => {
      const largeFormData = {
        title: 'Complex KB Entry with Extensive Title'.repeat(3),
        problem: 'Very detailed problem description. '.repeat(50),
        solution: 'Comprehensive solution with many steps. '.repeat(100),
        category: 'VSAM' as const,
        tags: Array.from({ length: 8 }, (_, i) => `tag-${i}`),
      };

      const startTime = performance.now();
      
      render(<KBEntryForm onSubmit={jest.fn()} initialData={largeFormData} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(`📊 Form render with data: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
    });

    it('handles rapid form updates efficiently', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      const startTime = performance.now();
      
      // Simulate rapid typing
      for (let i = 0; i < 50; i++) {
        await user.type(titleField, `${i}`);
      }
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      console.log(`📊 Rapid updates time: ${updateTime.toFixed(2)}ms`);
      expect(updateTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.UPDATE_TIME_MS * 50);
    });
  });

  describe('Large Dataset Performance', () => {
    it('handles large tag suggestions efficiently', async () => {
      const user = userEvent.setup();
      const largeSuggestions = Array.from({ length: PERFORMANCE_THRESHOLDS.LARGE_DATASET_SIZE }, 
        (_, i) => `suggestion-${i}`
      );
      
      const startTime = performance.now();
      
      render(
        <KBEntryForm 
          onSubmit={jest.fn()}
          initialData={{ 
            title: 'Test', 
            problem: 'Test problem description', 
            solution: 'Test solution description',
            category: 'VSAM' as const,
            tags: largeSuggestions.slice(0, 5) 
          }}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(`📊 Large dataset render: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS * 2);
    });

    it('maintains search performance with large results', async () => {
      const largeResults = generateLargeKBDataset(PERFORMANCE_THRESHOLDS.LARGE_DATASET_SIZE);
      mockElectronAPI.searchKBEntries.mockImplementation(async (query) => {
        // Simulate database search time
        await new Promise(resolve => setTimeout(resolve, 10));
        return largeResults.filter(entry => 
          entry.title.toLowerCase().includes(query.toLowerCase())
        );
      });

      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const startTime = performance.now();
      
      // Trigger search that will return large dataset
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      await user.type(titleField, 'KB');
      
      await waitFor(() => {
        expect(mockElectronAPI.searchKBEntries).toHaveBeenCalled();
      });
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      console.log(`📊 Large search time: ${searchTime.toFixed(2)}ms`);
      expect(searchTime).toHavePerformanceBetterThan(500); // Allow more time for large datasets
    });
  });

  describe('Window Layout Performance', () => {
    it('renders window layout efficiently', async () => {
      const startTime = performance.now();
      
      render(
        <MainWindowLayout windowId="test-window">
          <div>Test Content</div>
        </MainWindowLayout>
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(`📊 Window layout render: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
    });

    it('handles multiple tabs efficiently', async () => {
      const manyTabs = Array.from({ length: 20 }, (_, i) => ({
        id: `tab-${i}`,
        title: `Tab ${i}`,
        icon: '📄',
        closable: true,
        active: i === 0,
        isDirty: i % 3 === 0,
        data: { type: 'document', route: `/doc/${i}` },
      }));

      // Mock hooks with many tabs
      jest.doMock('../../../implementation/frontend/hooks/useWindowState', () => ({
        useWindowState: () => ({
          windowState: {
            type: 'main',
            title: 'Test Window',
            bounds: { x: 100, y: 100, width: 800, height: 600 },
            isMaximized: false,
            isMinimized: false,
            zIndex: 1,
          },
          tabs: manyTabs,
          actions: {
            addTab: jest.fn(),
            removeTab: jest.fn(),
            activateTab: jest.fn(),
            updateTab: jest.fn(),
            close: jest.fn(),
            minimize: jest.fn(),
            maximize: jest.fn(),
            restore: jest.fn(),
            updateBounds: jest.fn(),
          },
          activeTab: manyTabs[0],
        }),
      }));

      const startTime = performance.now();
      
      render(
        <MainWindowLayout windowId="test-window">
          <div>Test Content with Many Tabs</div>
        </MainWindowLayout>
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(`📊 Many tabs render: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS * 2);
    });
  });

  describe('Memory Performance', () => {
    it('does not leak memory during form operations', async () => {
      const user = userEvent.setup();
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many operations
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<KBEntryForm onSubmit={jest.fn()} />);
        
        const titleField = screen.getByRole('textbox', { name: /entry title/i });
        await user.type(titleField, `Test entry ${i}`);
        
        unmount();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Wait for potential cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      console.log(`💾 Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB);
    });

    it('efficiently handles component state updates', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many state updates
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await user.clear(titleField);
        await user.type(titleField, `Title ${i}`);
      }
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);
      
      console.log(`⏱️ State updates time: ${updateTime.toFixed(2)}ms`);
      console.log(`💾 Memory during updates: ${memoryIncrease.toFixed(2)}MB`);
      
      expect(updateTime).toHavePerformanceBetterThan(2000); // 2 seconds for 100 updates
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB);
    });
  });

  describe('Interaction Performance', () => {
    it('responds to user interactions quickly', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const interactions = [
        () => user.click(screen.getByRole('textbox', { name: /entry title/i })),
        () => user.tab(),
        () => user.click(screen.getByRole('combobox', { name: /category/i })),
        () => user.keyboard('{Escape}'),
      ];
      
      const interactionTimes: number[] = [];
      
      for (const interaction of interactions) {
        const startTime = performance.now();
        await interaction();
        const endTime = performance.now();
        
        interactionTimes.push(endTime - startTime);
      }
      
      const avgInteractionTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
      
      console.log(`🔍 Avg interaction time: ${avgInteractionTime.toFixed(2)}ms`);
      expect(avgInteractionTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.INTERACTION_TIME_MS);
    });

    it('maintains smooth scrolling performance', async () => {
      // Create a component with scrollable content
      const LongForm = () => (
        <div style={{ height: '2000px', overflow: 'auto' }}>
          <KBEntryForm onSubmit={jest.fn()} />
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i} style={{ height: '50px', padding: '10px' }}>
              Content item {i}
            </div>
          ))}
        </div>
      );
      
      render(<LongForm />);
      
      const scrollableElement = screen.getByRole('textbox', { name: /entry title/i }).closest('div');
      
      const scrollTimes: number[] = [];
      
      // Simulate multiple scroll events
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        fireEvent.scroll(scrollableElement!, { target: { scrollTop: i * 100 } });
        
        const endTime = performance.now();
        scrollTimes.push(endTime - startTime);
      }
      
      const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      
      console.log(`📈 Avg scroll time: ${avgScrollTime.toFixed(2)}ms`);
      expect(avgScrollTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.SCROLL_PERFORMANCE_MS);
    });
  });

  describe('Validation Performance', () => {
    it('performs validation efficiently with complex rules', async () => {
      const user = userEvent.setup();
      
      const complexValidation = jest.fn((data) => {
        // Simulate complex validation logic
        let result = true;
        for (let i = 0; i < 1000; i++) {
          result = result && data.title?.length > 0;
        }
        return { valid: result };
      });
      
      mockElectronAPI.validateKBEntry.mockImplementation(complexValidation);
      
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      const startTime = performance.now();
      
      await user.type(titleField, 'Test validation performance');
      fireEvent.blur(titleField);
      
      await waitFor(() => {
        expect(complexValidation).toHaveBeenCalled();
      });
      
      const endTime = performance.now();
      const validationTime = endTime - startTime;
      
      console.log(`🔥 Validation time: ${validationTime.toFixed(2)}ms`);
      expect(validationTime).toHavePerformanceBetterThan(300); // Allow for complex validation
    });

    it('debounces validation calls during rapid input', async () => {
      const user = userEvent.setup();
      const validationSpy = jest.fn().mockResolvedValue({ valid: true });
      mockElectronAPI.validateKBEntry.mockImplementation(validationSpy);
      
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Type rapidly
      await user.type(titleField, 'Rapid typing for debounce test');
      
      // Wait for debounce
      await waitFor(() => {
        expect(validationSpy).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      // Should not call validation for every character
      expect(validationSpy).toHaveBeenCalledTimes(1);
      
      console.log(`🏁 Debounced validation calls: ${validationSpy.mock.calls.length}`);
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('loads components within acceptable time', async () => {
      // Simulate dynamic import timing
      const startTime = performance.now();
      
      const LazyComponent = React.lazy(() => 
        Promise.resolve({
          default: () => <KBEntryForm onSubmit={jest.fn()} />
        })
      );
      
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /entry title/i })).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      console.log(`🚀 Component load time: ${loadTime.toFixed(2)}ms`);
      expect(loadTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
    });
  });

  afterEach(() => {
    const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDiff = (memoryAfter - memoryBefore) / (1024 * 1024);
    
    if (memoryDiff > PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB) {
      console.warn(`⚠️ Potential memory increase detected: ${memoryDiff.toFixed(2)}MB`);
    }
  });
});