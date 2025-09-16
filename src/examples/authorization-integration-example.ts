/**
 * AIAuthorizationService Integration Example
 *
 * This example demonstrates how to integrate and use the AIAuthorizationService
 * in the main process with proper service lifecycle management.
 */

import { AIAuthorizationService, AIOperation, UserDecision } from '../main/services/AIAuthorizationService';
import { AuthorizationHandler } from '../main/ipc/handlers/AuthorizationHandler';
import { ServiceManager } from '../main/services/ServiceManager';
import { DatabaseService } from '../main/services/DatabaseService';
import { AIOperationType } from '../types/authorization.types';

/**
 * Example integration showing how to set up the authorization service
 * in your main process initialization
 */
export class AuthorizationIntegrationExample {
  private serviceManager: ServiceManager;
  private authorizationService: AIAuthorizationService;
  private authorizationHandler: AuthorizationHandler;

  constructor() {
    this.serviceManager = new ServiceManager();
    this.authorizationService = new AIAuthorizationService();
    this.authorizationHandler = new AuthorizationHandler(this.authorizationService);
  }

  /**
   * Initialize the authorization service as part of app startup
   */
  async initializeServices(): Promise<void> {
    try {
      // Register services with dependency chain
      this.serviceManager.registerService('DatabaseService', new DatabaseService());
      this.serviceManager.registerService('AIAuthorizationService', this.authorizationService);

      // Start all services
      await this.serviceManager.startAll();

      console.log('Authorization service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize authorization service:', error);
      throw error;
    }
  }

  /**
   * Example: Request authorization for a semantic search operation
   */
  async requestSemanticSearchAuthorization(
    query: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    const operation: AIOperation = {
      type: 'semantic_search',
      query,
      dataContext: {
        dataTypes: ['text', 'metadata'],
        dataSizeBytes: Buffer.byteLength(query, 'utf8'),
        containsPII: false,
        isConfidential: false,
        retentionPolicy: 'no_retention',
        dataFields: [
          {
            name: 'search_query',
            type: 'text',
            sensitivity: 'public',
            preview: query.substring(0, 50),
            purpose: 'Find relevant knowledge base entries'
          }
        ],
        dataSources: ['knowledge_base']
      },
      priority: 'medium',
      userId,
      sessionId
    };

    try {
      const result = await this.authorizationService.requestAuthorization(operation);

      console.log('Authorization result:', {
        authorized: result.authorized,
        action: result.action,
        estimatedCost: result.estimates?.estimatedCostUSD,
        autoApproved: result.autoApproved,
        reason: result.reason
      });

      if (result.authorized) {
        console.log('✓ Operation authorized - proceeding with AI search');
        // Here you would proceed with the actual AI operation
      } else {
        console.log('⚠ User authorization required');
        // Show authorization dialog to user
        await this.showAuthorizationDialog(result);
      }
    } catch (error) {
      console.error('Authorization request failed:', error);
      throw error;
    }
  }

  /**
   * Example: Handle user decision from authorization dialog
   */
  async handleUserDecision(
    requestId: string,
    approved: boolean,
    rememberDecision: boolean = false,
    operationType?: AIOperationType,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    const decision: UserDecision = {
      requestId,
      action: approved ? 'approve_once' : 'deny',
      rememberDecision,
      decisionScope: rememberDecision ? {
        operationType,
        costRange: { maxCostUSD: 0.05 }, // Remember for operations under $0.05
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      } : undefined,
      notes: approved ? 'User approved operation' : 'User denied operation',
      userId,
      sessionId
    };

    try {
      await this.authorizationService.saveUserDecision(decision);
      console.log(`✓ User decision saved: ${decision.action}`);
    } catch (error) {
      console.error('Failed to save user decision:', error);
      throw error;
    }
  }

  /**
   * Example: Update user preferences
   */
  async updateUserPreferences(userId?: string): Promise<void> {
    try {
      // Get current preferences
      const currentPrefs = await this.authorizationService.getUserPreferences(userId);
      console.log('Current preferences:', currentPrefs);

      // Update preferences to auto-approve low-cost operations
      await this.authorizationService.updatePreferences({
        costThresholds: {
          autoApprove: 0.02, // Auto-approve up to $0.02
          requireConfirmation: 0.10, // Require confirmation up to $0.10
          block: 1.00 // Block operations over $1.00
        },
        defaultPermissions: {
          ...currentPrefs.defaultPermissions,
          extract_keywords: 'auto_approve',
          classify_content: 'auto_approve',
          explain_error: 'auto_approve'
        }
      }, userId);

      console.log('✓ User preferences updated successfully');
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * Example: Cost estimation before authorization
   */
  async estimateOperationCost(query: string, operationType: AIOperationType): Promise<void> {
    try {
      const estimate = await this.authorizationService.estimateCost(query, operationType);

      console.log('Cost estimate:', {
        inputTokens: estimate.inputTokens,
        outputTokens: estimate.outputTokens,
        totalCostUSD: estimate.totalCostUSD.toFixed(4),
        confidence: (estimate.confidence * 100).toFixed(1) + '%',
        breakdown: {
          inputCost: estimate.breakdown.inputTokens.costUSD.toFixed(4),
          outputCost: estimate.breakdown.outputTokens.costUSD.toFixed(4),
          overhead: estimate.breakdown.apiOverhead.toFixed(4)
        }
      });
    } catch (error) {
      console.error('Cost estimation failed:', error);
      throw error;
    }
  }

  /**
   * Example: Check auto-approval without full authorization request
   */
  async checkAutoApproval(
    cost: number,
    operationType: AIOperationType,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const autoApproved = await this.authorizationService.checkAutoApproval(
        cost,
        operationType,
        undefined, // No data context in this example
        sessionId,
        userId
      );

      console.log(`Auto-approval check: ${autoApproved ? '✓ Approved' : '✗ Not approved'}`);
      return autoApproved;
    } catch (error) {
      console.error('Auto-approval check failed:', error);
      throw error;
    }
  }

  /**
   * Placeholder for showing authorization dialog to user
   * In a real implementation, this would trigger the renderer process dialog
   */
  private async showAuthorizationDialog(authResult: any): Promise<void> {
    // In real implementation, send IPC message to renderer to show dialog
    console.log('📋 Authorization dialog would be shown here with:', {
      requestId: authResult.requestId,
      operationType: 'semantic_search',
      estimatedCost: authResult.estimates?.estimatedCostUSD,
      estimates: authResult.estimates
    });

    // Simulate user approval for example
    setTimeout(async () => {
      await this.handleUserDecision(authResult.requestId, true, true, 'semantic_search');
    }, 1000);
  }

  /**
   * Cleanup services on app shutdown
   */
  async cleanup(): Promise<void> {
    try {
      await this.serviceManager.stopAll();
      console.log('Authorization service cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup authorization service:', error);
    }
  }

  /**
   * Example: IPC handler integration
   */
  registerIPCHandlers(): void {
    // In a real implementation, you would register these with your IPC system
    const handlerConfig = {
      'authorization:request': this.authorizationHandler.handleAuthorizationRequest,
      'authorization:save_decision': this.authorizationHandler.handleSaveDecision,
      'authorization:get_preferences': this.authorizationHandler.handleGetPreferences,
      'authorization:update_preferences': this.authorizationHandler.handleUpdatePreferences,
      'authorization:estimate_cost': this.authorizationHandler.handleEstimateCost,
      'authorization:check_auto_approval': this.authorizationHandler.handleCheckAutoApproval,
      'authorization:get_stats': this.authorizationHandler.handleGetStats,
      'authorization:clear_session': this.authorizationHandler.handleClearSessionApprovals
    };

    console.log('IPC handlers registered for authorization operations');
  }
}

/**
 * Usage example function
 */
export async function demonstrateAuthorizationService(): Promise<void> {
  const example = new AuthorizationIntegrationExample();

  try {
    // Initialize services
    await example.initializeServices();
    example.registerIPCHandlers();

    // Demonstrate cost estimation
    await example.estimateOperationCost(
      'Find all VSAM status code 35 errors',
      'semantic_search'
    );

    // Check auto-approval
    await example.checkAutoApproval(0.01, 'semantic_search', 'user123', 'session456');

    // Request authorization
    await example.requestSemanticSearchAuthorization(
      'Find all VSAM status code 35 errors and their solutions',
      'user123',
      'session456'
    );

    // Update user preferences
    await example.updateUserPreferences('user123');

    console.log('✓ Authorization service demonstration completed successfully');

  } catch (error) {
    console.error('Authorization service demonstration failed:', error);
  } finally {
    await example.cleanup();
  }
}

// Export for use in tests or other examples
export { AuthorizationIntegrationExample };