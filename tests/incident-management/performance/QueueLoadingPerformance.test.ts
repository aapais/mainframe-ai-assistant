import { performance } from 'perf_hooks';
import { jest } from '@jest/globals';

// Performance testing for incident queue loading with large datasets
interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  searchTime: number;
  filterTime: number;
  sortTime: number;
}

interface IncidentQueuePerformanceTest {
  incidentCount: number;
  expectedMaxLoadTime: number;
  expectedMaxRenderTime: number;
  expectedMaxMemoryUsage: number; // in MB
}

// Mock incident data generator
class IncidentDataGenerator {
  private categories = ['Database', 'Network', 'Application', 'Infrastructure', 'Security'];
  private teams = ['Database', 'Network', 'Application', 'Infrastructure', 'Security'];
  private priorities = ['critical', 'high', 'medium', 'low'];
  private statuses = ['new', 'assigned', 'in_progress', 'blocked', 'resolved', 'closed'];
  private users = ['john.doe', 'jane.smith', 'bob.johnson', 'alice.wilson', 'charlie.brown'];

  generateIncidents(count: number): any[] {
    const incidents = [];
    const baseDate = Date.now();

    for (let i = 0; i < count; i++) {
      const createdAt = baseDate - (Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days

      incidents.push({
        id: `INC-${(i + 1).toString().padStart(6, '0')}`,
        title: `Incident ${i + 1}: ${this.getRandomElement(this.categories)} Issue`,
        description: `Detailed description for incident ${i + 1}. This is a ${this.getRandomElement(this.priorities)} priority issue affecting the ${this.getRandomElement(this.categories)} system.`,
        priority: this.getRandomElement(this.priorities),
        status: this.getRandomElement(this.statuses),
        category: this.getRandomElement(this.categories),
        assignedTeam: this.getRandomElement(this.teams),
        assignee: Math.random() > 0.2 ? this.getRandomElement(this.users) : null,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt + Math.random() * 7 * 24 * 60 * 60 * 1000),
        tags: this.generateTags(),
        metadata: {
          severity: this.getRandomElement(['low', 'medium', 'high', 'critical']),
          customerImpact: this.getRandomElement(['none', 'low', 'medium', 'high']),
          estimatedResolutionTime: Math.floor(Math.random() * 24) + 1 // 1-24 hours
        },
        sla: {
          target: this.getSlaTarget(this.getRandomElement(this.priorities)),
          violated: Math.random() > 0.8, // 20% SLA violations
          remainingTime: Math.random() * 12 * 60 * 60 * 1000 // 0-12 hours remaining
        },
        timeline: this.generateTimeline(createdAt),
        relatedIncidents: this.generateRelatedIncidents(i, count),
        comments: this.generateComments(Math.floor(Math.random() * 5) + 1)
      });
    }

    return incidents;
  }

  private getRandomElement(array: any[]): any {
    return array[Math.floor(Math.random() * array.length)];
  }

  private generateTags(): string[] {
    const allTags = ['urgent', 'customer-facing', 'internal', 'maintenance', 'security', 'performance', 'bug', 'enhancement'];
    const tagCount = Math.floor(Math.random() * 4) + 1;
    const shuffled = allTags.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, tagCount);
  }

  private getSlaTarget(priority: string): number {
    switch (priority) {
      case 'critical': return 2 * 60; // 2 hours
      case 'high': return 4 * 60; // 4 hours
      case 'medium': return 8 * 60; // 8 hours
      case 'low': return 24 * 60; // 24 hours
      default: return 8 * 60;
    }
  }

  private generateTimeline(createdAt: number): any[] {
    const timeline = [{
      event: 'Incident Created',
      timestamp: new Date(createdAt),
      user: 'system'
    }];

    const eventCount = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < eventCount; i++) {
      timeline.push({
        event: this.getRandomElement(['Status Updated', 'Comment Added', 'Assigned', 'Escalated']),
        timestamp: new Date(createdAt + (i + 1) * 60 * 60 * 1000),
        user: this.getRandomElement(this.users)
      });
    }

    return timeline;
  }

  private generateRelatedIncidents(currentIndex: number, totalCount: number): string[] {
    const relatedCount = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0;
    const related = [];

    for (let i = 0; i < relatedCount; i++) {
      const relatedIndex = Math.floor(Math.random() * totalCount);
      if (relatedIndex !== currentIndex) {
        related.push(`INC-${(relatedIndex + 1).toString().padStart(6, '0')}`);
      }
    }

    return related;
  }

  private generateComments(count: number): any[] {
    const comments = [];
    const sampleComments = [
      'Investigating the issue',
      'Found potential root cause',
      'Applying fix',
      'Testing solution',
      'Monitoring for stability',
      'Issue resolved'
    ];

    for (let i = 0; i < count; i++) {
      comments.push({
        id: `comment-${i + 1}`,
        text: this.getRandomElement(sampleComments),
        author: this.getRandomElement(this.users),
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      });
    }

    return comments;
  }
}

// Mock incident queue component for performance testing
class IncidentQueueComponent {
  private incidents: any[] = [];
  private filteredIncidents: any[] = [];
  private sortedIncidents: any[] = [];
  private currentFilters: any = {};
  private currentSort: any = {};

  async loadIncidents(incidents: any[]): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();

    // Simulate data loading
    this.incidents = incidents;
    this.filteredIncidents = [...incidents];
    this.sortedIncidents = [...incidents];

    const loadTime = performance.now() - startTime;

    // Simulate rendering
    const renderStartTime = performance.now();
    await this.renderIncidents();
    const renderTime = performance.now() - renderStartTime;

    const finalMemory = this.getMemoryUsage();
    const memoryUsage = finalMemory - initialMemory;

    // Test search performance
    const searchTime = await this.performanceTestSearch('database');

    // Test filter performance
    const filterTime = await this.performanceTestFilter({ status: ['active'], priority: ['high'] });

    // Test sort performance
    const sortTime = await this.performanceTestSort('priority');

    return {
      loadTime,
      renderTime,
      memoryUsage,
      searchTime,
      filterTime,
      sortTime
    };
  }

  private async renderIncidents(): Promise<void> {
    // Simulate DOM rendering with virtual scrolling
    const visibleItems = 50; // Only render visible items
    const itemsToRender = this.sortedIncidents.slice(0, visibleItems);

    for (const incident of itemsToRender) {
      await this.renderIncidentItem(incident);
    }
  }

  private async renderIncidentItem(incident: any): Promise<void> {
    // Simulate rendering individual incident item
    const element = {
      id: incident.id,
      title: incident.title,
      status: incident.status,
      priority: incident.priority,
      assignee: incident.assignee,
      createdAt: incident.createdAt
    };

    // Simulate minimal DOM operations
    await new Promise(resolve => setTimeout(resolve, 0.1));
  }

  private async performanceTestSearch(query: string): Promise<number> {
    const startTime = performance.now();

    this.filteredIncidents = this.incidents.filter(incident =>
      incident.title.toLowerCase().includes(query.toLowerCase()) ||
      incident.description.toLowerCase().includes(query.toLowerCase()) ||
      incident.id.toLowerCase().includes(query.toLowerCase()) ||
      incident.tags.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))
    );

    return performance.now() - startTime;
  }

  private async performanceTestFilter(filters: any): Promise<number> {
    const startTime = performance.now();

    let filtered = [...this.incidents];

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(incident => filters.status.includes(incident.status));
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(incident => filters.priority.includes(incident.priority));
    }

    if (filters.team && filters.team.length > 0) {
      filtered = filtered.filter(incident => filters.team.includes(incident.assignedTeam));
    }

    if (filters.dateRange) {
      filtered = filtered.filter(incident => {
        const incidentDate = new Date(incident.createdAt);
        return incidentDate >= filters.dateRange.start && incidentDate <= filters.dateRange.end;
      });
    }

    this.filteredIncidents = filtered;
    return performance.now() - startTime;
  }

  private async performanceTestSort(sortBy: string): Promise<number> {
    const startTime = performance.now();

    this.sortedIncidents = [...this.filteredIncidents].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];

        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

        case 'sla':
          return a.sla.remainingTime - b.sla.remainingTime;

        default:
          return 0;
      }
    });

    return performance.now() - startTime;
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB
    }
    return 0; // Browser environment fallback
  }

  // Simulate virtual scrolling for large lists
  async testVirtualScrolling(totalItems: number, visibleItems: number = 50): Promise<number> {
    const startTime = performance.now();

    // Simulate scrolling through large list
    const itemHeight = 80; // pixels
    const containerHeight = visibleItems * itemHeight;
    let scrollPosition = 0;

    for (let i = 0; i < 100; i++) { // Simulate 100 scroll events
      scrollPosition += itemHeight;
      const startIndex = Math.floor(scrollPosition / itemHeight);
      const endIndex = Math.min(startIndex + visibleItems, totalItems);

      // Simulate rendering visible items
      for (let j = startIndex; j < endIndex; j++) {
        if (this.incidents[j]) {
          await this.renderIncidentItem(this.incidents[j]);
        }
      }
    }

    return performance.now() - startTime;
  }

  // Test batch operations performance
  async testBatchOperations(operations: Array<{ type: string; data: any }>): Promise<number> {
    const startTime = performance.now();

    const batchSize = 100;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      await Promise.all(batch.map(async (operation) => {
        switch (operation.type) {
          case 'update_status':
            await this.updateIncidentStatus(operation.data.id, operation.data.status);
            break;
          case 'assign':
            await this.assignIncident(operation.data.id, operation.data.assignee);
            break;
          case 'add_comment':
            await this.addComment(operation.data.id, operation.data.comment);
            break;
        }
      }));

      // Small delay between batches to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return performance.now() - startTime;
  }

  private async updateIncidentStatus(id: string, status: string): Promise<void> {
    const incident = this.incidents.find(i => i.id === id);
    if (incident) {
      incident.status = status;
      incident.updatedAt = new Date();
    }
  }

  private async assignIncident(id: string, assignee: string): Promise<void> {
    const incident = this.incidents.find(i => i.id === id);
    if (incident) {
      incident.assignee = assignee;
      incident.updatedAt = new Date();
    }
  }

  private async addComment(id: string, comment: string): Promise<void> {
    const incident = this.incidents.find(i => i.id === id);
    if (incident) {
      incident.comments.push({
        id: `comment-${incident.comments.length + 1}`,
        text: comment,
        author: 'test.user',
        timestamp: new Date()
      });
    }
  }
}

describe('Incident Queue Loading Performance Tests', () => {
  let incidentGenerator: IncidentDataGenerator;
  let queueComponent: IncidentQueueComponent;

  beforeEach(() => {
    incidentGenerator = new IncidentDataGenerator();
    queueComponent = new IncidentQueueComponent();
  });

  const performanceTests: IncidentQueuePerformanceTest[] = [
    {
      incidentCount: 100,
      expectedMaxLoadTime: 100, // ms
      expectedMaxRenderTime: 200, // ms
      expectedMaxMemoryUsage: 10 // MB
    },
    {
      incidentCount: 1000,
      expectedMaxLoadTime: 500, // ms
      expectedMaxRenderTime: 1000, // ms
      expectedMaxMemoryUsage: 50 // MB
    },
    {
      incidentCount: 5000,
      expectedMaxLoadTime: 2000, // ms
      expectedMaxRenderTime: 3000, // ms
      expectedMaxMemoryUsage: 200 // MB
    },
    {
      incidentCount: 10000,
      expectedMaxLoadTime: 5000, // ms
      expectedMaxRenderTime: 10000, // ms
      expectedMaxMemoryUsage: 400 // MB
    }
  ];

  describe('Load Performance Tests', () => {
    performanceTests.forEach(({ incidentCount, expectedMaxLoadTime, expectedMaxRenderTime, expectedMaxMemoryUsage }) => {
      test(`should load ${incidentCount} incidents within performance limits`, async () => {
        const incidents = incidentGenerator.generateIncidents(incidentCount);
        const metrics = await queueComponent.loadIncidents(incidents);

        console.log(`Performance metrics for ${incidentCount} incidents:`, metrics);

        expect(metrics.loadTime).toBeLessThan(expectedMaxLoadTime);
        expect(metrics.renderTime).toBeLessThan(expectedMaxRenderTime);
        expect(metrics.memoryUsage).toBeLessThan(expectedMaxMemoryUsage);
      });
    });
  });

  describe('Search Performance Tests', () => {
    const searchTestCases = [
      { query: 'database', description: 'single word search' },
      { query: 'critical network issue', description: 'multi-word search' },
      { query: 'INC-000001', description: 'exact ID search' },
      { query: 'urgent customer-facing', description: 'tag-based search' }
    ];

    searchTestCases.forEach(({ query, description }) => {
      test(`should perform ${description} quickly on large dataset`, async () => {
        const incidents = incidentGenerator.generateIncidents(5000);
        await queueComponent.loadIncidents(incidents);

        const searchTime = await queueComponent.performanceTestSearch(query);

        expect(searchTime).toBeLessThan(100); // Should complete within 100ms
        console.log(`Search time for "${query}": ${searchTime.toFixed(2)}ms`);
      });
    });
  });

  describe('Filter Performance Tests', () => {
    const filterTestCases = [
      {
        filters: { status: ['active'] },
        description: 'single status filter'
      },
      {
        filters: { priority: ['critical', 'high'] },
        description: 'multiple priority filter'
      },
      {
        filters: {
          status: ['active', 'in_progress'],
          priority: ['critical', 'high'],
          team: ['Database', 'Infrastructure']
        },
        description: 'complex multi-field filter'
      },
      {
        filters: {
          dateRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date()
          }
        },
        description: 'date range filter'
      }
    ];

    filterTestCases.forEach(({ filters, description }) => {
      test(`should apply ${description} quickly on large dataset`, async () => {
        const incidents = incidentGenerator.generateIncidents(5000);
        await queueComponent.loadIncidents(incidents);

        const filterTime = await queueComponent.performanceTestFilter(filters);

        expect(filterTime).toBeLessThan(50); // Should complete within 50ms
        console.log(`Filter time for ${description}: ${filterTime.toFixed(2)}ms`);
      });
    });
  });

  describe('Sort Performance Tests', () => {
    const sortTestCases = [
      { sortBy: 'priority', description: 'priority sort' },
      { sortBy: 'created', description: 'creation date sort' },
      { sortBy: 'updated', description: 'update date sort' },
      { sortBy: 'sla', description: 'SLA remaining time sort' }
    ];

    sortTestCases.forEach(({ sortBy, description }) => {
      test(`should perform ${description} quickly on large dataset`, async () => {
        const incidents = incidentGenerator.generateIncidents(5000);
        await queueComponent.loadIncidents(incidents);

        const sortTime = await queueComponent.performanceTestSort(sortBy);

        expect(sortTime).toBeLessThan(100); // Should complete within 100ms
        console.log(`Sort time for ${description}: ${sortTime.toFixed(2)}ms`);
      });
    });
  });

  describe('Virtual Scrolling Performance Tests', () => {
    test('should handle virtual scrolling efficiently for 10,000 items', async () => {
      const incidents = incidentGenerator.generateIncidents(10000);
      await queueComponent.loadIncidents(incidents);

      const scrollTime = await queueComponent.testVirtualScrolling(10000, 50);

      expect(scrollTime).toBeLessThan(1000); // Should complete within 1 second
      console.log(`Virtual scrolling time for 10,000 items: ${scrollTime.toFixed(2)}ms`);
    });

    test('should maintain performance during rapid scrolling', async () => {
      const incidents = incidentGenerator.generateIncidents(5000);
      await queueComponent.loadIncidents(incidents);

      // Test multiple rapid scroll sessions
      const scrollTimes = [];
      for (let i = 0; i < 5; i++) {
        const scrollTime = await queueComponent.testVirtualScrolling(5000, 25);
        scrollTimes.push(scrollTime);
      }

      const avgScrollTime = scrollTimes.reduce((sum, time) => sum + time, 0) / scrollTimes.length;
      const maxScrollTime = Math.max(...scrollTimes);

      expect(avgScrollTime).toBeLessThan(500);
      expect(maxScrollTime).toBeLessThan(1000);

      console.log(`Average scroll time: ${avgScrollTime.toFixed(2)}ms, Max: ${maxScrollTime.toFixed(2)}ms`);
    });
  });

  describe('Batch Operations Performance Tests', () => {
    test('should handle batch status updates efficiently', async () => {
      const incidents = incidentGenerator.generateIncidents(1000);
      await queueComponent.loadIncidents(incidents);

      // Create batch operations
      const operations = incidents.slice(0, 500).map(incident => ({
        type: 'update_status',
        data: { id: incident.id, status: 'in_progress' }
      }));

      const batchTime = await queueComponent.testBatchOperations(operations);

      expect(batchTime).toBeLessThan(2000); // Should complete within 2 seconds
      console.log(`Batch update time for 500 incidents: ${batchTime.toFixed(2)}ms`);
    });

    test('should handle mixed batch operations efficiently', async () => {
      const incidents = incidentGenerator.generateIncidents(1000);
      await queueComponent.loadIncidents(incidents);

      // Create mixed operations
      const operations = [];
      for (let i = 0; i < 300; i++) {
        const incident = incidents[i];
        if (i % 3 === 0) {
          operations.push({
            type: 'update_status',
            data: { id: incident.id, status: 'resolved' }
          });
        } else if (i % 3 === 1) {
          operations.push({
            type: 'assign',
            data: { id: incident.id, assignee: 'batch.user' }
          });
        } else {
          operations.push({
            type: 'add_comment',
            data: { id: incident.id, comment: 'Batch operation comment' }
          });
        }
      }

      const batchTime = await queueComponent.testBatchOperations(operations);

      expect(batchTime).toBeLessThan(3000); // Should complete within 3 seconds
      console.log(`Mixed batch operations time for 300 operations: ${batchTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Tests', () => {
    test('should maintain reasonable memory usage with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Load progressively larger datasets
      const sizes = [1000, 2000, 5000, 10000];
      const memoryUsages = [];

      for (const size of sizes) {
        const incidents = incidentGenerator.generateIncidents(size);
        const metrics = await queueComponent.loadIncidents(incidents);

        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const memoryIncrease = currentMemory - initialMemory;

        memoryUsages.push({ size, memory: memoryIncrease });

        console.log(`Memory usage for ${size} incidents: ${memoryIncrease.toFixed(2)}MB`);
      }

      // Memory usage should scale reasonably (not exponentially)
      const largestDataset = memoryUsages[memoryUsages.length - 1];
      expect(largestDataset.memory).toBeLessThan(500); // Should not exceed 500MB

      // Check for memory leaks - growth should be roughly linear
      const memoryGrowthRates = [];
      for (let i = 1; i < memoryUsages.length; i++) {
        const prevUsage = memoryUsages[i - 1];
        const currentUsage = memoryUsages[i];
        const sizeIncrease = currentUsage.size - prevUsage.size;
        const memoryIncrease = currentUsage.memory - prevUsage.memory;
        const growthRate = memoryIncrease / sizeIncrease;
        memoryGrowthRates.push(growthRate);
      }

      // Growth rate should be relatively consistent (no exponential growth)
      const avgGrowthRate = memoryGrowthRates.reduce((sum, rate) => sum + rate, 0) / memoryGrowthRates.length;
      const maxGrowthRate = Math.max(...memoryGrowthRates);

      expect(maxGrowthRate / avgGrowthRate).toBeLessThan(2); // No single spike > 2x average
    });
  });

  describe('Concurrent Operations Tests', () => {
    test('should handle concurrent filtering and sorting', async () => {
      const incidents = incidentGenerator.generateIncidents(2000);
      await queueComponent.loadIncidents(incidents);

      const startTime = performance.now();

      // Simulate concurrent operations
      const operations = await Promise.all([
        queueComponent.performanceTestFilter({ priority: ['critical', 'high'] }),
        queueComponent.performanceTestSort('priority'),
        queueComponent.performanceTestSearch('database'),
        queueComponent.performanceTestFilter({ status: ['active'] }),
        queueComponent.performanceTestSort('created')
      ]);

      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(500); // All concurrent operations within 500ms
      console.log(`Concurrent operations completed in: ${totalTime.toFixed(2)}ms`);
      console.log('Individual operation times:', operations.map(time => `${time.toFixed(2)}ms`));
    });
  });

  describe('Regression Tests', () => {
    test('should maintain consistent performance across multiple runs', async () => {
      const runTimes = [];
      const incidents = incidentGenerator.generateIncidents(1000);

      // Run the same test 5 times
      for (let i = 0; i < 5; i++) {
        const metrics = await queueComponent.loadIncidents(incidents);
        runTimes.push(metrics.loadTime + metrics.renderTime);
      }

      const avgTime = runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length;
      const variance = runTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / runTimes.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be small relative to average (consistent performance)
      const coefficientOfVariation = stdDev / avgTime;
      expect(coefficientOfVariation).toBeLessThan(0.3); // Less than 30% variation

      console.log(`Performance consistency: avg=${avgTime.toFixed(2)}ms, stdDev=${stdDev.toFixed(2)}ms, CV=${(coefficientOfVariation * 100).toFixed(1)}%`);
    });
  });
});