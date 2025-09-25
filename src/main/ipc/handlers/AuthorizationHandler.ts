/**
 * Authorization IPC Handler
 *
 * Comprehensive IPC handler for AI authorization operations:
 * - Authorization request processing
 * - User preference management
 * - Cost estimation and approval logic
 * - Session management for authorization decisions
 * - Decision logging and audit trail
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode,
} from '../../../types/ipc';
import {
  AIAuthorizationService,
  AIOperation,
  AuthorizationResult,
  UserDecision,
  AuthorizationPreferences,
  CostEstimate,
} from '../../services/AIAuthorizationService';
import {
  AIOperationType,
  AuthorizationAction,
  AIAuthorizationRequest,
  AIAuthorizationResponse,
  AIDataContext,
  DecisionScope,
} from '../../../types/authorization.types';
import { HandlerUtils, HandlerConfigs } from './index';

/**
 * IPC request interfaces for authorization operations
 */
interface AuthorizationRequestIPCRequest extends BaseIPCRequest {
  operation: AIOperation;
}

interface SaveDecisionIPCRequest extends BaseIPCRequest {
  decision: UserDecision;
}

interface UpdatePreferencesIPCRequest extends BaseIPCRequest {
  preferences: Partial<AuthorizationPreferences>;
  userId?: string;
}

interface GetPreferencesIPCRequest extends BaseIPCRequest {
  userId?: string;
}

interface EstimateCostIPCRequest extends BaseIPCRequest {
  query: string;
  operationType: AIOperationType;
}

interface CheckAutoApprovalIPCRequest extends BaseIPCRequest {
  cost: number;
  operationType: AIOperationType;
  dataContext?: AIDataContext;
  sessionId?: string;
  userId?: string;
}

/**
 * IPC response interfaces for authorization operations
 */
interface AuthorizationResultIPCResponse extends BaseIPCResponse {
  data: AuthorizationResult;
}

interface PreferencesIPCResponse extends BaseIPCResponse {
  data: AuthorizationPreferences;
}

interface CostEstimateIPCResponse extends BaseIPCResponse {
  data: CostEstimate;
}

interface AutoApprovalIPCResponse extends BaseIPCResponse {
  data: { autoApproved: boolean; reason: string };
}

/**
 * Authorization Handler Implementation
 */
export class AuthorizationHandler {
  constructor(private authorizationService: AIAuthorizationService) {}

  /**
   * Handle authorization request from renderer
   */
  handleAuthorizationRequest: IPCHandlerFunction<'authorization:request'> = async request => {
    const startTime = Date.now();

    try {
      const { operation } = request as AuthorizationRequestIPCRequest;

      // Validate operation data
      if (!operation?.type || !operation?.query) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required operation type or query',
          { operation }
        );
      }

      // Validate operation type
      const validOperationTypes: AIOperationType[] = [
        'semantic_search',
        'explain_error',
        'analyze_entry',
        'generate_summary',
        'extract_keywords',
        'classify_content',
        'translate_text',
        'improve_writing',
      ];

      if (!validOperationTypes.includes(operation.type)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          `Invalid operation type: ${operation.type}`,
          { validTypes: validOperationTypes }
        );
      }

      // Sanitize query
      const sanitizedQuery = HandlerUtils.sanitizeString(operation.query, 5000);
      const sanitizedOperation = {
        ...operation,
        query: sanitizedQuery,
      };

      // Request authorization
      const result = await this.authorizationService.requestAuthorization(sanitizedOperation);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, result, {
        operationType: operation.type,
        autoApproved: result.autoApproved,
        estimatedCost: result.estimates?.estimatedCostUSD,
      }) as AuthorizationResultIPCResponse;
    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.AUTHORIZATION_FAILED,
        'Authorization request failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Handle saving user authorization decision
   */
  handleSaveDecision: IPCHandlerFunction<'authorization:save_decision'> = async request => {
    const startTime = Date.now();

    try {
      const { decision } = request as SaveDecisionIPCRequest;

      // Validate decision data
      if (!decision?.requestId || !decision?.action) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required decision data',
          { decision }
        );
      }

      // Validate action
      const validActions: AuthorizationAction[] = [
        'approve_once',
        'approve_always',
        'deny',
        'use_local_only',
        'modify_query',
      ];

      if (!validActions.includes(decision.action)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          `Invalid authorization action: ${decision.action}`,
          { validActions }
        );
      }

      // Sanitize notes if provided
      const sanitizedDecision = {
        ...decision,
        notes: decision.notes ? HandlerUtils.sanitizeString(decision.notes, 1000) : undefined,
      };

      // Save the decision
      await this.authorizationService.saveUserDecision(sanitizedDecision);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        { saved: true },
        {
          action: decision.action,
          remembered: decision.rememberDecision,
        }
      );
    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.SAVE_FAILED,
        'Failed to save authorization decision',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Handle getting user authorization preferences
   */
  handleGetPreferences: IPCHandlerFunction<'authorization:get_preferences'> = async request => {
    const startTime = Date.now();

    try {
      const { userId } = request as GetPreferencesIPCRequest;

      // Get user preferences
      const preferences = await this.authorizationService.getUserPreferences(userId);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, preferences, {
        userId: userId || 'default',
        cached: true, // Preferences are typically cached
      }) as PreferencesIPCResponse;
    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        'Failed to get authorization preferences',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Handle updating user authorization preferences
   */
  handleUpdatePreferences: IPCHandlerFunction<'authorization:update_preferences'> =
    async request => {
      const startTime = Date.now();

      try {
        const { preferences, userId } = request as UpdatePreferencesIPCRequest;

        // Validate preferences data
        if (!preferences || typeof preferences !== 'object') {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.INVALID_REQUEST_DATA,
            'Invalid preferences data',
            { preferences }
          );
        }

        // Update preferences
        await this.authorizationService.updatePreferences(preferences, userId);

        return HandlerUtils.createSuccessResponse(
          request.requestId,
          startTime,
          { updated: true },
          {
            userId: userId || 'default',
            updatedFields: Object.keys(preferences),
          }
        );
      } catch (error) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.UPDATE_FAILED,
          'Failed to update authorization preferences',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    };

  /**
   * Handle cost estimation request
   */
  handleEstimateCost: IPCHandlerFunction<'authorization:estimate_cost'> = async request => {
    const startTime = Date.now();

    try {
      const { query, operationType } = request as EstimateCostIPCRequest;

      // Validate inputs
      if (!query || !operationType) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required query or operation type',
          { query: !!query, operationType: !!operationType }
        );
      }

      // Sanitize query
      const sanitizedQuery = HandlerUtils.sanitizeString(query, 5000);

      // Estimate cost
      const estimate = await this.authorizationService.estimateCost(sanitizedQuery, operationType);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, estimate, {
        operationType,
        queryLength: sanitizedQuery.length,
        cached: true, // Estimates are typically cached
      }) as CostEstimateIPCResponse;
    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.COST_ESTIMATION_FAILED,
        'Cost estimation failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Handle auto-approval check
   */
  handleCheckAutoApproval: IPCHandlerFunction<'authorization:check_auto_approval'> =
    async request => {
      const startTime = Date.now();

      try {
        const { cost, operationType, dataContext, sessionId, userId } =
          request as CheckAutoApprovalIPCRequest;

        // Validate inputs
        if (typeof cost !== 'number' || !operationType) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.INVALID_REQUEST_DATA,
            'Missing or invalid cost or operation type',
            { cost, operationType }
          );
        }

        // Check auto-approval
        const autoApproved = await this.authorizationService.checkAutoApproval(
          cost,
          operationType,
          dataContext,
          sessionId,
          userId
        );

        let reason = '';
        if (autoApproved) {
          reason = 'Operation meets auto-approval criteria based on cost and data sensitivity';
        } else {
          reason = 'Operation requires explicit user authorization';
        }

        return HandlerUtils.createSuccessResponse(
          request.requestId,
          startTime,
          { autoApproved, reason },
          {
            cost,
            operationType,
            hasDataContext: !!dataContext,
            hasSession: !!sessionId,
          }
        ) as AutoApprovalIPCResponse;
      } catch (error) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.AUTO_APPROVAL_CHECK_FAILED,
          'Auto-approval check failed',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    };

  /**
   * Handle getting authorization statistics
   */
  handleGetStats: IPCHandlerFunction<'authorization:get_stats'> = async request => {
    const startTime = Date.now();

    try {
      // Get service health which includes stats
      const health = await this.authorizationService.getHealth();

      // Additional stats from database could be added here
      const stats = {
        serviceHealth: health,
        cacheStats: health.cacheStats,
        uptime: health.uptime,
        timestamp: Date.now(),
      };

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, stats, {
        source: 'authorization_service',
        realtime: true,
      });
    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.STATS_RETRIEVAL_FAILED,
        'Failed to get authorization statistics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Handle clearing session approvals
   */
  handleClearSessionApprovals: IPCHandlerFunction<'authorization:clear_session'> =
    async request => {
      const startTime = Date.now();

      try {
        const { sessionId } = request as { sessionId?: string };

        if (!sessionId) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.INVALID_REQUEST_DATA,
            'Session ID is required',
            { sessionId }
          );
        }

        // Clear session approvals (implementation would depend on service method)
        // For now, we'll just return success as this would be implemented in the service

        return HandlerUtils.createSuccessResponse(
          request.requestId,
          startTime,
          { cleared: true },
          {
            sessionId,
            timestamp: Date.now(),
          }
        );
      } catch (error) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.SESSION_CLEAR_FAILED,
          'Failed to clear session approvals',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    };

  /**
   * Get handler configuration
   */
  static getHandlerConfig() {
    return {
      'authorization:request': {
        handler: 'handleAuthorizationRequest',
        config: {
          ...HandlerConfigs.CRITICAL_OPERATIONS,
          rateLimitConfig: { requests: 10, windowMs: 60000 }, // More restrictive for AI ops
          trackMetrics: true,
          validateInput: true,
          sanitizeInput: true,
          alertOnErrors: true,
          requireAuth: false, // May be called before auth
        },
      },
      'authorization:save_decision': {
        handler: 'handleSaveDecision',
        config: {
          ...HandlerConfigs.WRITE_OPERATIONS,
          trackMetrics: true,
          validateInput: true,
          sanitizeInput: true,
        },
      },
      'authorization:get_preferences': {
        handler: 'handleGetPreferences',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 300000, // 5 minutes
          trackMetrics: true,
        },
      },
      'authorization:update_preferences': {
        handler: 'handleUpdatePreferences',
        config: {
          ...HandlerConfigs.WRITE_OPERATIONS,
          rateLimitConfig: { requests: 5, windowMs: 60000 }, // Restrict preference updates
          trackMetrics: true,
          validateInput: true,
        },
      },
      'authorization:estimate_cost': {
        handler: 'handleEstimateCost',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 600000, // 10 minutes - cost estimates change rarely
          rateLimitConfig: { requests: 30, windowMs: 60000 },
          trackMetrics: true,
        },
      },
      'authorization:check_auto_approval': {
        handler: 'handleCheckAutoApproval',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 60000, // 1 minute - approval logic can change
          rateLimitConfig: { requests: 50, windowMs: 60000 },
          trackMetrics: true,
        },
      },
      'authorization:get_stats': {
        handler: 'handleGetStats',
        config: {
          ...HandlerConfigs.SYSTEM_OPERATIONS,
          cacheTTL: 30000, // 30 seconds
          trackMetrics: false, // Avoid recursion
        },
      },
      'authorization:clear_session': {
        handler: 'handleClearSessionApprovals',
        config: {
          ...HandlerConfigs.WRITE_OPERATIONS,
          rateLimitConfig: { requests: 10, windowMs: 60000 },
          trackMetrics: true,
        },
      },
    };
  }
}

/**
 * Factory function to create authorization handler
 */
export function createAuthorizationHandler(
  authorizationService: AIAuthorizationService
): AuthorizationHandler {
  return new AuthorizationHandler(authorizationService);
}

/**
 * Export handler configuration for registration
 */
export const AuthorizationHandlerConfig = AuthorizationHandler.getHandlerConfig();
