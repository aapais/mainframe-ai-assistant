/**
 * AI Authorization Service
 *
 * Complete service for managing AI authorization logic including:
 * - Authorization request validation
 * - Cost estimation calculations using Gemini pricing
 * - Token counting for queries
 * - User preference storage and retrieval
 * - Auto-approval logic based on cost limits
 * - Decision logging to database
 * - Session management for "approve always" decisions
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AIOperationType,
  AuthorizationAction,
  PermissionLevel,
  AIAuthorizationRequest,
  AIAuthorizationResponse,
  AIDataContext,
  AIOperationEstimates,
  CostBreakdown,
  PerformanceMetrics,
  AuthorizationConfig,
  DecisionScope
} from '../../types/authorization.types';
import { Service, ServiceContext, ServiceStatus } from './ServiceManager';
import { DatabaseService } from './DatabaseService';
import { GeminiService } from '../../services/GeminiService';

/**
 * AI Operation interface for authorization requests
 */
export interface AIOperation {
  type: AIOperationType;
  query: string;
  dataContext: AIDataContext;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  sessionId?: string;
  userId?: string;
}

/**
 * Authorization result from the service
 */
export interface AuthorizationResult {
  authorized: boolean;
  action: AuthorizationAction;
  requestId: string;
  estimates?: AIOperationEstimates;
  fallbackOptions?: string[];
  autoApproved: boolean;
  reason?: string;
  modifiedQuery?: string;
}

/**
 * User decision for saving preferences
 */
export interface UserDecision {
  requestId: string;
  action: AuthorizationAction;
  rememberDecision: boolean;
  decisionScope?: DecisionScope;
  notes?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Cost estimate for operations
 */
export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalCostUSD: number;
  breakdown: CostBreakdown;
  confidence: number;
}

/**
 * Authorization preferences for users
 */
export interface AuthorizationPreferences {
  userId?: string;
  defaultPermissions: Record<AIOperationType, PermissionLevel>;
  costThresholds: {
    autoApprove: number;
    requireConfirmation: number;
    block: number;
  };
  sessionSettings: {
    rememberApproveAlways: boolean;
    sessionDuration: number; // minutes
  };
  dataPrivacySettings: {
    allowPII: boolean;
    allowConfidential: boolean;
    requireExplicitConsent: boolean;
  };
  created_at: Date;
  updated_at: Date;
}

/**
 * Session approval cache entry
 */
interface SessionApproval {
  operationType: AIOperationType;
  costThreshold: number;
  dataTypes: string[];
  expiresAt: Date;
  userId?: string;
}

/**
 * Gemini pricing model (as of 2024)
 */
const GEMINI_PRICING = {
  'gemini-pro': {
    input: 0.000125, // per 1K tokens
    output: 0.000375, // per 1K tokens
  },
  'gemini-pro-vision': {
    input: 0.00025, // per 1K tokens
    output: 0.00075, // per 1K tokens
  }
} as const;

/**
 * AI Authorization Service Implementation
 */
export class AIAuthorizationService implements Service {
  public readonly name = 'AIAuthorizationService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = ['DatabaseService'];
  public readonly priority = 2;
  public readonly critical = false;

  private databaseService: DatabaseService | null = null;
  private geminiService: GeminiService | null = null;
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };

  // In-memory caches for performance
  private preferencesCache = new Map<string, AuthorizationPreferences>();
  private sessionApprovals = new Map<string, SessionApproval[]>();
  private estimateCache = new Map<string, { estimate: CostEstimate; timestamp: number }>();

  // Default configuration
  private config: AuthorizationConfig = {
    defaultPermissions: {
      semantic_search: 'ask_always',
      explain_error: 'auto_approve',
      analyze_entry: 'auto_approve',
      generate_summary: 'ask_always',
      extract_keywords: 'auto_approve',
      classify_content: 'auto_approve',
      translate_text: 'ask_always',
      improve_writing: 'ask_always'
    },
    costThresholds: {
      autoApprove: 0.01, // $0.01 USD
      requireConfirmation: 0.10, // $0.10 USD
      block: 1.00 // $1.00 USD
    },
    sensitivityPolicies: {
      'public': 'auto_approve',
      'internal': 'ask_always',
      'confidential': 'ask_always',
      'restricted': 'disabled'
    },
    cacheSettings: {
      enableEstimateCache: true,
      estimateCacheTTL: 300000, // 5 minutes
      enableDecisionCache: true,
      decisionCacheTTL: 3600000 // 1 hour
    }
  };

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Initializing AI Authorization Service...');

    try {
      // Get database service dependency
      this.databaseService = context.serviceManager.getService('DatabaseService') as DatabaseService;
      if (!this.databaseService) {
        throw new Error('DatabaseService dependency not available');
      }

      // Initialize Gemini service if API key is available
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        this.geminiService = new GeminiService({
          apiKey: geminiApiKey,
          model: 'gemini-pro',
          temperature: 0.1,
          timeout: 10000
        });
        context.logger.info('Gemini service initialized for cost estimation');
      } else {
        context.logger.warn('Gemini API key not found - using fallback cost estimation');
      }

      // Initialize database tables for authorization data
      await this.initializeDatabase();

      // Start cleanup intervals
      this.startCleanupIntervals();

      this.status = {
        status: 'running',
        startTime: new Date(),
        restartCount: 0,
        uptime: 0
      };

      context.logger.info('AI Authorization Service initialized successfully');
    } catch (error) {
      context.logger.error('Failed to initialize AI Authorization Service:', error);
      this.status = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        restartCount: 0,
        uptime: 0
      };
      throw error;
    }
  }

  async shutdown(context: ServiceContext): Promise<void> {
    context.logger.info('Shutting down AI Authorization Service...');

    // Clear caches
    this.preferencesCache.clear();
    this.sessionApprovals.clear();
    this.estimateCache.clear();

    this.status = {
      status: 'stopped',
      restartCount: 0,
      uptime: 0
    };

    context.logger.info('AI Authorization Service shut down successfully');
  }

  async getHealth(): Promise<any> {
    const isHealthy = this.status.status === 'running' && this.databaseService;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: this.name,
      version: this.version,
      dependencies: {
        database: this.databaseService ? 'available' : 'unavailable',
        gemini: this.geminiService ? 'available' : 'unavailable'
      },
      cacheStats: {
        preferencesCache: this.preferencesCache.size,
        sessionApprovals: this.sessionApprovals.size,
        estimateCache: this.estimateCache.size
      },
      uptime: this.status.startTime ?
        Date.now() - this.status.startTime.getTime() : 0
    };
  }

  /**
   * Main authorization request method
   */
  async requestAuthorization(operation: AIOperation): Promise<AuthorizationResult> {
    const requestId = uuidv4();

    try {
      // Step 1: Estimate cost
      const estimates = await this.estimateCost(operation.query, operation.type);

      // Step 2: Get user preferences
      const preferences = await this.getUserPreferences(operation.userId);

      // Step 3: Check auto-approval
      const autoApproved = await this.checkAutoApproval(
        estimates.totalCostUSD,
        operation.type,
        operation.dataContext,
        operation.sessionId,
        operation.userId
      );

      // Step 4: Determine action based on preferences and auto-approval
      let action: AuthorizationAction;
      let authorized = false;

      if (autoApproved) {
        action = 'approve_once';
        authorized = true;
      } else {
        const permissionLevel = preferences.defaultPermissions[operation.type];
        switch (permissionLevel) {
          case 'auto_approve':
            action = 'approve_once';
            authorized = true;
            break;
          case 'disabled':
            action = 'deny';
            authorized = false;
            break;
          case 'none':
          case 'ask_always':
          default:
            // Return for user decision
            action = 'approve_once'; // Default, user will decide
            authorized = false;
        }
      }

      // Step 5: Log the authorization request
      await this.logAuthorizationRequest({
        requestId,
        operation,
        estimates: {
          estimatedTokens: estimates.inputTokens + estimates.outputTokens,
          estimatedCostUSD: estimates.totalCostUSD,
          estimatedTimeSeconds: { min: 2, max: 10, typical: 5 },
          confidence: estimates.confidence,
          costBreakdown: estimates.breakdown,
          performance: this.getDefaultPerformanceMetrics(),
          updatedAt: new Date()
        },
        autoApproved,
        action
      });

      return {
        authorized,
        action,
        requestId,
        estimates: {
          estimatedTokens: estimates.inputTokens + estimates.outputTokens,
          estimatedCostUSD: estimates.totalCostUSD,
          estimatedTimeSeconds: { min: 2, max: 10, typical: 5 },
          confidence: estimates.confidence,
          costBreakdown: estimates.breakdown,
          performance: this.getDefaultPerformanceMetrics(),
          updatedAt: new Date()
        },
        autoApproved,
        reason: autoApproved ? 'Auto-approved based on cost and preferences' : 'Requires user confirmation'
      };

    } catch (error) {
      await this.logError(requestId, operation, error);
      throw new Error(`Authorization request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if operation should be auto-approved
   */
  async checkAutoApproval(
    cost: number,
    operationType: AIOperationType,
    dataContext?: AIDataContext,
    sessionId?: string,
    userId?: string
  ): Promise<boolean> {
    // Check cost thresholds
    if (cost > this.config.costThresholds.block) {
      return false;
    }

    if (cost <= this.config.costThresholds.autoApprove) {
      // Check data sensitivity
      if (dataContext) {
        if (dataContext.containsPII || dataContext.isConfidential) {
          return false;
        }

        // Check field sensitivity
        const hasRestrictedData = dataContext.dataFields.some(
          field => field.sensitivity === 'restricted'
        );
        if (hasRestrictedData) {
          return false;
        }
      }

      return true;
    }

    // Check session approvals for "approve always" decisions
    if (sessionId) {
      return this.checkSessionApproval(sessionId, operationType, cost, dataContext);
    }

    return false;
  }

  /**
   * Save user decision and update preferences if needed
   */
  async saveUserDecision(decision: UserDecision): Promise<void> {
    try {
      // Save the decision to database
      const db = this.databaseService?.getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const stmt = db.prepare(`
        INSERT INTO ai_authorization_decisions
        (id, request_id, action, remember_decision, scope, notes, user_id, session_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        uuidv4(),
        decision.requestId,
        decision.action,
        decision.rememberDecision ? 1 : 0,
        decision.decisionScope ? JSON.stringify(decision.decisionScope) : null,
        decision.notes || null,
        decision.userId || null,
        decision.sessionId || null,
        new Date().toISOString()
      );

      // Handle "approve always" for session
      if (decision.action === 'approve_always' && decision.sessionId) {
        await this.addSessionApproval(decision);
      }

      // Update user preferences if remember decision is true
      if (decision.rememberDecision && decision.decisionScope) {
        await this.updateUserPreferencesFromDecision(decision);
      }

    } catch (error) {
      throw new Error(`Failed to save user decision: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user preferences with caching
   */
  async getUserPreferences(userId?: string): Promise<AuthorizationPreferences> {
    const cacheKey = userId || 'default';

    // Check cache first
    if (this.preferencesCache.has(cacheKey)) {
      return this.preferencesCache.get(cacheKey)!;
    }

    try {
      const db = this.databaseService?.getDatabase();
      if (!db) {
        return this.getDefaultPreferences();
      }

      const stmt = db.prepare(`
        SELECT * FROM ai_authorization_preferences
        WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)
        ORDER BY user_id DESC
        LIMIT 1
      `);

      const row = stmt.get(userId || null, userId || null);

      let preferences: AuthorizationPreferences;

      if (row) {
        preferences = {
          userId: row.user_id,
          defaultPermissions: JSON.parse(row.default_permissions),
          costThresholds: JSON.parse(row.cost_thresholds),
          sessionSettings: JSON.parse(row.session_settings),
          dataPrivacySettings: JSON.parse(row.data_privacy_settings),
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        };
      } else {
        preferences = this.getDefaultPreferences();
        // Save default preferences to database
        await this.savePreferencesToDatabase(preferences);
      }

      // Cache the preferences
      this.preferencesCache.set(cacheKey, preferences);

      return preferences;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(prefs: Partial<AuthorizationPreferences>, userId?: string): Promise<void> {
    try {
      const currentPrefs = await this.getUserPreferences(userId);
      const updatedPrefs: AuthorizationPreferences = {
        ...currentPrefs,
        ...prefs,
        updated_at: new Date()
      };

      const db = this.databaseService?.getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ai_authorization_preferences
        (user_id, default_permissions, cost_thresholds, session_settings, data_privacy_settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        userId || null,
        JSON.stringify(updatedPrefs.defaultPermissions),
        JSON.stringify(updatedPrefs.costThresholds),
        JSON.stringify(updatedPrefs.sessionSettings),
        JSON.stringify(updatedPrefs.dataPrivacySettings),
        currentPrefs.created_at.toISOString(),
        updatedPrefs.updated_at.toISOString()
      );

      // Update cache
      const cacheKey = userId || 'default';
      this.preferencesCache.set(cacheKey, updatedPrefs);

    } catch (error) {
      throw new Error(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate cost for AI operation
   */
  async estimateCost(query: string, operationType: AIOperationType): Promise<CostEstimate> {
    const cacheKey = `${operationType}:${Buffer.from(query).toString('base64').substring(0, 32)}`;

    // Check cache first
    if (this.config.cacheSettings.enableEstimateCache && this.estimateCache.has(cacheKey)) {
      const cached = this.estimateCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.config.cacheSettings.estimateCacheTTL) {
        return cached.estimate;
      }
    }

    try {
      // Estimate tokens - rough calculation based on characters
      // More accurate estimation would use tokenizer
      const inputTokens = Math.ceil(query.length / 4); // Approximate tokens
      const outputTokens = this.estimateOutputTokens(operationType);

      const model = 'gemini-pro';
      const pricing = GEMINI_PRICING[model];

      const inputCost = (inputTokens / 1000) * pricing.input;
      const outputCost = (outputTokens / 1000) * pricing.output;
      const totalCost = inputCost + outputCost;

      const breakdown: CostBreakdown = {
        inputTokens: {
          count: inputTokens,
          costUSD: inputCost,
          rate: pricing.input
        },
        outputTokens: {
          count: outputTokens,
          costUSD: outputCost,
          rate: pricing.output
        },
        apiOverhead: 0.001, // Small overhead
        serviceFees: 0
      };

      const estimate: CostEstimate = {
        inputTokens,
        outputTokens,
        totalCostUSD: totalCost + breakdown.apiOverhead,
        breakdown,
        confidence: this.geminiService ? 0.9 : 0.7 // Higher confidence with real service
      };

      // Cache the estimate
      if (this.config.cacheSettings.enableEstimateCache) {
        this.estimateCache.set(cacheKey, {
          estimate,
          timestamp: Date.now()
        });
      }

      return estimate;

    } catch (error) {
      throw new Error(`Cost estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize database tables for authorization
   */
  private async initializeDatabase(): Promise<void> {
    const db = this.databaseService?.getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    // Authorization preferences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_authorization_preferences (
        user_id TEXT PRIMARY KEY,
        default_permissions TEXT NOT NULL,
        cost_thresholds TEXT NOT NULL,
        session_settings TEXT NOT NULL,
        data_privacy_settings TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Authorization decisions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_authorization_decisions (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        action TEXT NOT NULL,
        remember_decision INTEGER NOT NULL,
        scope TEXT,
        notes TEXT,
        user_id TEXT,
        session_id TEXT,
        created_at TEXT NOT NULL,
        INDEX idx_decisions_user_id (user_id),
        INDEX idx_decisions_session_id (session_id),
        INDEX idx_decisions_created_at (created_at)
      );
    `);

    // Authorization requests log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_authorization_requests (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        query TEXT NOT NULL,
        data_context TEXT,
        estimated_cost REAL NOT NULL,
        auto_approved INTEGER NOT NULL,
        action TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        created_at TEXT NOT NULL,
        INDEX idx_requests_user_id (user_id),
        INDEX idx_requests_operation_type (operation_type),
        INDEX idx_requests_created_at (created_at)
      );
    `);
  }

  private checkSessionApproval(
    sessionId: string,
    operationType: AIOperationType,
    cost: number,
    dataContext?: AIDataContext
  ): boolean {
    const approvals = this.sessionApprovals.get(sessionId);
    if (!approvals) return false;

    const now = new Date();

    return approvals.some(approval => {
      // Check if approval is still valid
      if (approval.expiresAt < now) return false;

      // Check operation type match
      if (approval.operationType !== operationType) return false;

      // Check cost threshold
      if (cost > approval.costThreshold) return false;

      // Check data types if specified
      if (dataContext && approval.dataTypes.length > 0) {
        const hasMatchingDataType = approval.dataTypes.some(type =>
          dataContext.dataTypes.includes(type)
        );
        if (!hasMatchingDataType) return false;
      }

      return true;
    });
  }

  private async addSessionApproval(decision: UserDecision): Promise<void> {
    if (!decision.sessionId || !decision.decisionScope) return;

    const approval: SessionApproval = {
      operationType: decision.decisionScope.operationType || 'semantic_search',
      costThreshold: decision.decisionScope.costRange?.maxCostUSD || this.config.costThresholds.autoApprove,
      dataTypes: [], // Could be extracted from decision scope
      expiresAt: decision.decisionScope.expiresAt || new Date(Date.now() + 3600000), // 1 hour default
      userId: decision.userId
    };

    const existing = this.sessionApprovals.get(decision.sessionId) || [];
    existing.push(approval);
    this.sessionApprovals.set(decision.sessionId, existing);
  }

  private estimateOutputTokens(operationType: AIOperationType): number {
    const estimates = {
      semantic_search: 150,
      explain_error: 300,
      analyze_entry: 250,
      generate_summary: 200,
      extract_keywords: 50,
      classify_content: 100,
      translate_text: 400,
      improve_writing: 350
    };
    return estimates[operationType] || 200;
  }

  private getDefaultPreferences(): AuthorizationPreferences {
    return {
      defaultPermissions: { ...this.config.defaultPermissions },
      costThresholds: { ...this.config.costThresholds },
      sessionSettings: {
        rememberApproveAlways: true,
        sessionDuration: 60 // minutes
      },
      dataPrivacySettings: {
        allowPII: false,
        allowConfidential: false,
        requireExplicitConsent: true
      },
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  private async savePreferencesToDatabase(preferences: AuthorizationPreferences): Promise<void> {
    const db = this.databaseService?.getDatabase();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO ai_authorization_preferences
      (user_id, default_permissions, cost_thresholds, session_settings, data_privacy_settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      preferences.userId || null,
      JSON.stringify(preferences.defaultPermissions),
      JSON.stringify(preferences.costThresholds),
      JSON.stringify(preferences.sessionSettings),
      JSON.stringify(preferences.dataPrivacySettings),
      preferences.created_at.toISOString(),
      preferences.updated_at.toISOString()
    );
  }

  private async updateUserPreferencesFromDecision(decision: UserDecision): Promise<void> {
    if (!decision.decisionScope) return;

    const preferences = await this.getUserPreferences(decision.userId);
    let updated = false;

    // Update operation permission if specified
    if (decision.decisionScope.operationType) {
      const newPermission: PermissionLevel = decision.action === 'approve_always' ? 'auto_approve' :
                                           decision.action === 'deny' ? 'disabled' : 'ask_always';

      if (preferences.defaultPermissions[decision.decisionScope.operationType] !== newPermission) {
        preferences.defaultPermissions[decision.decisionScope.operationType] = newPermission;
        updated = true;
      }
    }

    // Update cost thresholds if specified
    if (decision.decisionScope.costRange && decision.action === 'approve_always') {
      if (preferences.costThresholds.autoApprove < decision.decisionScope.costRange.maxCostUSD) {
        preferences.costThresholds.autoApprove = decision.decisionScope.costRange.maxCostUSD;
        updated = true;
      }
    }

    if (updated) {
      await this.updatePreferences(preferences, decision.userId);
    }
  }

  private async logAuthorizationRequest(data: {
    requestId: string;
    operation: AIOperation;
    estimates: AIOperationEstimates;
    autoApproved: boolean;
    action: AuthorizationAction;
  }): Promise<void> {
    try {
      const db = this.databaseService?.getDatabase();
      if (!db) return;

      const stmt = db.prepare(`
        INSERT INTO ai_authorization_requests
        (id, request_id, operation_type, query, data_context, estimated_cost, auto_approved, action, user_id, session_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        uuidv4(),
        data.requestId,
        data.operation.type,
        data.operation.query,
        JSON.stringify(data.operation.dataContext),
        data.estimates.estimatedCostUSD,
        data.autoApproved ? 1 : 0,
        data.action,
        data.operation.userId || null,
        data.operation.sessionId || null,
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Failed to log authorization request:', error);
    }
  }

  private async logError(requestId: string, operation: AIOperation, error: any): Promise<void> {
    try {
      const db = this.databaseService?.getDatabase();
      if (!db) return;

      // Could implement error logging table here
      console.error(`Authorization error for request ${requestId}:`, error);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      responseTimePercentiles: {
        p50: 2000,
        p95: 5000,
        p99: 8000
      },
      expectedQuality: 0.85,
      cacheHitProbability: 0.3,
      rateLimitStatus: {
        remaining: 1000,
        resetTime: new Date(Date.now() + 3600000)
      }
    };
  }

  private startCleanupIntervals(): void {
    // Clean expired session approvals every 5 minutes
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, approvals] of this.sessionApprovals.entries()) {
        const validApprovals = approvals.filter(approval => approval.expiresAt > now);
        if (validApprovals.length === 0) {
          this.sessionApprovals.delete(sessionId);
        } else if (validApprovals.length < approvals.length) {
          this.sessionApprovals.set(sessionId, validApprovals);
        }
      }
    }, 5 * 60 * 1000);

    // Clean estimate cache every 10 minutes
    setInterval(() => {
      const cutoff = Date.now() - this.config.cacheSettings.estimateCacheTTL;
      for (const [key, cached] of this.estimateCache.entries()) {
        if (cached.timestamp < cutoff) {
          this.estimateCache.delete(key);
        }
      }
    }, 10 * 60 * 1000);

    // Clear preferences cache every hour to ensure fresh data
    setInterval(() => {
      this.preferencesCache.clear();
    }, 60 * 60 * 1000);
  }
}