/**
 * Workflow Orchestration Utilities for Integration Testing
 * Provides utilities for testing complex workflows and service interactions
 */

import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { MetricsService } from '../../../src/services/MetricsService';
import { CacheService } from '../../../src/services/CacheService';
import { KBEntry, KBEntryInput, SearchResult } from '../../../src/types/services';
import { EventEmitter } from 'events';

export interface WorkflowStep {
  id: string;
  name: string;
  operation: WorkflowOperation;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
  validation?: (result: any) => boolean | Promise<boolean>;
}

export interface WorkflowOperation {
  type: 'create' | 'read' | 'update' | 'delete' | 'search' | 'usage' | 'custom';
  service: 'kb' | 'metrics' | 'cache' | 'custom';
  params: any;
  customFunction?: (...args: any[]) => Promise<any>;
}

export interface WorkflowResult {
  stepId: string;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
  timestamp: Date;
}

export interface WorkflowExecution {
  workflowId: string;
  steps: WorkflowStep[];
  results: Map<string, WorkflowResult>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  totalDuration?: number;
}

/**
 * Orchestrates complex workflows for integration testing
 */
export class WorkflowOrchestrator extends EventEmitter {
  private executions = new Map<string, WorkflowExecution>();
  
  constructor(
    private services: {
      kb: KnowledgeBaseService;
      metrics: MetricsService;
      cache: CacheService;
    }
  ) {
    super();
  }

  /**
   * Execute a workflow with dependency management
   */
  async executeWorkflow(
    workflowId: string,
    steps: WorkflowStep[]
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      workflowId,
      steps,
      results: new Map(),
      status: 'pending',
      startTime: new Date()
    };

    this.executions.set(workflowId, execution);
    execution.status = 'running';

    try {
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(steps);
      
      // Execute steps in dependency order
      const executionOrder = this.topologicalSort(dependencyGraph);
      
      for (const stepId of executionOrder) {
        const step = steps.find(s => s.id === stepId);
        if (!step) continue;

        // Wait for dependencies to complete
        await this.waitForDependencies(step, execution);
        
        // Execute step
        const result = await this.executeStep(step);
        execution.results.set(stepId, result);

        this.emit('step:completed', { workflowId, stepId, result });

        // Check if step failed and handle retries
        if (!result.success && step.retries && step.retries > 0) {
          await this.retryStep(step, execution);
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.totalDuration = execution.endTime.getTime() - execution.startTime!.getTime();

      this.emit('workflow:completed', execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      this.emit('workflow:failed', { workflowId, error });
    }

    return execution;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep): Promise<WorkflowResult> {
    const startTime = Date.now();
    const result: WorkflowResult = {
      stepId: step.id,
      success: false,
      duration: 0,
      timestamp: new Date()
    };

    try {
      // Set timeout if specified
      const timeoutPromise = step.timeout 
        ? new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Step timeout')), step.timeout)
          )
        : null;

      // Execute operation
      const operationPromise = this.executeOperation(step.operation);
      
      const operationResult = timeoutPromise
        ? await Promise.race([operationPromise, timeoutPromise])
        : await operationPromise;

      result.result = operationResult;
      result.success = true;

      // Run validation if provided
      if (step.validation) {
        const validationResult = await step.validation(operationResult);
        result.success = validationResult;
      }

    } catch (error) {
      result.error = error as Error;
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Execute specific operation based on type and service
   */
  private async executeOperation(operation: WorkflowOperation): Promise<any> {
    const { type, service, params, customFunction } = operation;

    if (type === 'custom' && customFunction) {
      return await customFunction(params);
    }

    switch (service) {
      case 'kb':
        return await this.executeKBOperation(type, params);
      case 'metrics':
        return await this.executeMetricsOperation(type, params);
      case 'cache':
        return await this.executeCacheOperation(type, params);
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }

  private async executeKBOperation(type: string, params: any): Promise<any> {
    const kb = this.services.kb;

    switch (type) {
      case 'create':
        return await kb.create(params);
      case 'read':
        return await kb.read(params.id);
      case 'update':
        return await kb.update(params.id, params.updates);
      case 'delete':
        return await kb.delete(params.id);
      case 'search':
        return await kb.search(params.query, params.options);
      case 'usage':
        return await kb.recordUsage(params.entryId, params.successful, params.userId);
      default:
        throw new Error(`Unknown KB operation: ${type}`);
    }
  }

  private async executeMetricsOperation(type: string, params: any): Promise<any> {
    const metrics = this.services.metrics;

    switch (type) {
      case 'read':
        return await metrics.getMetrics(params.period);
      default:
        throw new Error(`Unknown metrics operation: ${type}`);
    }
  }

  private async executeCacheOperation(type: string, params: any): Promise<any> {
    const cache = this.services.cache;

    switch (type) {
      case 'read':
        return await cache.get(params.key);
      case 'create':
        return await cache.set(params.key, params.value, params.ttl);
      case 'delete':
        return await cache.delete(params.key);
      default:
        throw new Error(`Unknown cache operation: ${type}`);
    }
  }

  private buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    steps.forEach(step => {
      graph.set(step.id, step.dependencies || []);
    });

    return graph;
  }

  private topologicalSort(graph: Map<string, string[]>): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: string) => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected: ${node}`);
      }
      
      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      
      const dependencies = graph.get(node) || [];
      dependencies.forEach(dep => {
        if (graph.has(dep)) {
          visit(dep);
        }
      });

      visiting.delete(node);
      visited.add(node);
      result.push(node);
    };

    Array.from(graph.keys()).forEach(node => {
      if (!visited.has(node)) {
        visit(node);
      }
    });

    return result;
  }

  private async waitForDependencies(
    step: WorkflowStep, 
    execution: WorkflowExecution
  ): Promise<void> {
    if (!step.dependencies) return;

    for (const depId of step.dependencies) {
      const depResult = execution.results.get(depId);
      
      if (!depResult) {
        throw new Error(`Dependency ${depId} not found for step ${step.id}`);
      }
      
      if (!depResult.success) {
        throw new Error(`Dependency ${depId} failed for step ${step.id}`);
      }
    }
  }

  private async retryStep(
    step: WorkflowStep, 
    execution: WorkflowExecution
  ): Promise<void> {
    const maxRetries = step.retries || 0;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const result = await this.executeStep(step);
      execution.results.set(step.id, result);

      if (result.success) {
        this.emit('step:retried', { stepId: step.id, attempt, success: true });
        return;
      }

      this.emit('step:retried', { stepId: step.id, attempt, success: false });
    }
  }

  /**
   * Get workflow execution status
   */
  getExecution(workflowId: string): WorkflowExecution | undefined {
    return this.executions.get(workflowId);
  }

  /**
   * Wait for workflow completion
   */
  async waitForCompletion(workflowId: string, timeout?: number): Promise<WorkflowExecution> {
    return new Promise((resolve, reject) => {
      const execution = this.executions.get(workflowId);
      
      if (!execution) {
        reject(new Error(`Workflow ${workflowId} not found`));
        return;
      }

      if (execution.status === 'completed' || execution.status === 'failed') {
        resolve(execution);
        return;
      }

      const timeoutId = timeout ? setTimeout(() => {
        reject(new Error(`Workflow ${workflowId} timeout`));
      }, timeout) : null;

      const handleCompletion = (completedExecution: WorkflowExecution) => {
        if (completedExecution.workflowId === workflowId) {
          if (timeoutId) clearTimeout(timeoutId);
          this.removeListener('workflow:completed', handleCompletion);
          this.removeListener('workflow:failed', handleFailure);
          resolve(completedExecution);
        }
      };

      const handleFailure = (event: any) => {
        if (event.workflowId === workflowId) {
          if (timeoutId) clearTimeout(timeoutId);
          this.removeListener('workflow:completed', handleCompletion);
          this.removeListener('workflow:failed', handleFailure);
          reject(event.error);
        }
      };

      this.on('workflow:completed', handleCompletion);
      this.on('workflow:failed', handleFailure);
    });
  }
}

/**
 * Performance monitor for workflow testing
 */
export class WorkflowPerformanceMonitor {
  private metrics = new Map<string, {
    totalExecutions: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    errorCount: number;
  }>();

  recordExecution(workflowId: string, duration: number, success: boolean): void {
    const existing = this.metrics.get(workflowId) || {
      totalExecutions: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      successRate: 0,
      errorCount: 0
    };

    existing.totalExecutions++;
    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalExecutions;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    
    if (!success) {
      existing.errorCount++;
    }
    
    existing.successRate = (existing.totalExecutions - existing.errorCount) / existing.totalExecutions;

    this.metrics.set(workflowId, existing);
  }

  getMetrics(workflowId?: string) {
    if (workflowId) {
      return this.metrics.get(workflowId);
    }
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
  }
}

/**
 * User journey simulator for comprehensive testing
 */
export class UserJourneySimulator {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  /**
   * Simulate a typical support analyst workflow
   */
  async simulateSupportAnalystJourney(
    problemDescription: string,
    userId: string = 'test-analyst'
  ): Promise<{
    searchResults: SearchResult[];
    selectedEntry?: KBEntry;
    resolutionSuccess: boolean;
    totalTime: number;
  }> {
    const startTime = Date.now();

    const workflow: WorkflowStep[] = [
      {
        id: 'search-problem',
        name: 'Search for solution',
        operation: {
          type: 'search',
          service: 'kb',
          params: {
            query: problemDescription,
            options: { userId, limit: 10 }
          }
        }
      },
      {
        id: 'select-solution',
        name: 'Select best solution',
        operation: {
          type: 'custom',
          service: 'custom',
          params: { problemDescription },
          customFunction: async (params) => {
            // Simulate analyst selecting best result
            const execution = this.orchestrator.getExecution('support-journey');
            const searchResult = execution?.results.get('search-problem');
            
            if (searchResult?.success && searchResult.result?.length > 0) {
              return searchResult.result[0]; // Select top result
            }
            return null;
          }
        },
        dependencies: ['search-problem']
      },
      {
        id: 'apply-solution',
        name: 'Apply solution and record usage',
        operation: {
          type: 'usage',
          service: 'kb',
          params: {
            entryId: null, // Will be set dynamically
            successful: Math.random() > 0.2, // 80% success rate
            userId
          },
          customFunction: async (params) => {
            const execution = this.orchestrator.getExecution('support-journey');
            const selectionResult = execution?.results.get('select-solution');
            
            if (selectionResult?.success && selectionResult.result) {
              params.entryId = selectionResult.result.entry.id;
              return await this.orchestrator['services'].kb.recordUsage(
                params.entryId,
                params.successful,
                params.userId
              );
            }
            return null;
          }
        },
        dependencies: ['select-solution']
      }
    ];

    const execution = await this.orchestrator.executeWorkflow('support-journey', workflow);
    
    const searchResult = execution.results.get('search-problem');
    const selectionResult = execution.results.get('select-solution');
    const applicationResult = execution.results.get('apply-solution');

    return {
      searchResults: searchResult?.result || [],
      selectedEntry: selectionResult?.result?.entry,
      resolutionSuccess: applicationResult?.success || false,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Simulate knowledge base maintenance workflow
   */
  async simulateKBMaintenanceJourney(adminUserId: string = 'kb-admin'): Promise<{
    entriesReviewed: number;
    entriesUpdated: number;
    performanceImprovement: boolean;
    totalTime: number;
  }> {
    const startTime = Date.now();
    let entriesReviewed = 0;
    let entriesUpdated = 0;

    const workflow: WorkflowStep[] = [
      {
        id: 'get-metrics',
        name: 'Review system metrics',
        operation: {
          type: 'read',
          service: 'metrics',
          params: { period: '7d' }
        }
      },
      {
        id: 'identify-low-performers',
        name: 'Identify low-performing entries',
        operation: {
          type: 'custom',
          service: 'custom',
          params: { adminUserId },
          customFunction: async () => {
            // Get entries with low success rates
            const allEntries = await this.orchestrator['services'].kb.list({
              limit: 100,
              sortBy: 'usage_count',
              sortOrder: 'desc'
            });
            
            entriesReviewed = allEntries.data.length;
            
            return allEntries.data.filter(entry => {
              const total = (entry.success_count || 0) + (entry.failure_count || 0);
              return total > 5 && (entry.success_count || 0) / total < 0.6;
            });
          }
        },
        dependencies: ['get-metrics']
      },
      {
        id: 'update-entries',
        name: 'Update low-performing entries',
        operation: {
          type: 'custom',
          service: 'custom',
          params: { adminUserId },
          customFunction: async (params) => {
            const execution = this.orchestrator.getExecution('kb-maintenance');
            const lowPerformers = execution?.results.get('identify-low-performers');
            
            if (lowPerformers?.success && lowPerformers.result?.length > 0) {
              const updatePromises = lowPerformers.result.map(async (entry: KBEntry) => {
                const success = await this.orchestrator['services'].kb.update(entry.id, {
                  solution: entry.solution + '\n\n--- Enhanced Solution ---\nAdditional troubleshooting based on user feedback.',
                  updated_by: params.adminUserId
                });
                if (success) entriesUpdated++;
                return success;
              });
              
              return await Promise.all(updatePromises);
            }
            return [];
          }
        },
        dependencies: ['identify-low-performers']
      }
    ];

    await this.orchestrator.executeWorkflow('kb-maintenance', workflow);

    return {
      entriesReviewed,
      entriesUpdated,
      performanceImprovement: entriesUpdated > 0,
      totalTime: Date.now() - startTime
    };
  }
}

/**
 * Load testing utilities for workflows
 */
export class WorkflowLoadTester {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  /**
   * Execute load test with concurrent users
   */
  async executeLoadTest(
    workflowGenerator: (userId: string) => WorkflowStep[],
    concurrentUsers: number,
    duration: number
  ): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    averageResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
    errors: Error[];
  }> {
    const results: Array<{
      success: boolean;
      duration: number;
      error?: Error;
    }> = [];

    const startTime = Date.now();
    const endTime = startTime + duration;
    let executionCount = 0;

    const executeUser = async (userId: string) => {
      while (Date.now() < endTime) {
        try {
          const workflow = workflowGenerator(userId);
          const workflowId = `load-test-${userId}-${executionCount++}`;
          
          const executionStart = Date.now();
          const execution = await this.orchestrator.executeWorkflow(workflowId, workflow);
          const executionDuration = Date.now() - executionStart;

          results.push({
            success: execution.status === 'completed',
            duration: executionDuration
          });
          
        } catch (error) {
          results.push({
            success: false,
            duration: 0,
            error: error as Error
          });
        }
        
        // Brief pause between requests from same user
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    // Start concurrent users
    const userPromises = Array.from({ length: concurrentUsers }, (_, i) =>
      executeUser(`load-user-${i}`)
    );

    await Promise.all(userPromises);

    const successful = results.filter(r => r.success);
    const errors = results.filter(r => r.error).map(r => r.error!);
    const durations = results.map(r => r.duration);

    return {
      totalExecutions: results.length,
      successfulExecutions: successful.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxResponseTime: Math.max(...durations),
      errorRate: (results.length - successful.length) / results.length,
      errors
    };
  }
}