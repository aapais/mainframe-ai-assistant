# SYSTEM ARCHITECTURE
## Mainframe AI Assistant - Complete Technical Architecture

### Architecture Overview

The Mainframe AI Assistant is built on a modern, scalable architecture that prioritizes **transparency**, **performance**, and **cost control**. The system is designed to evolve from MVP1 through MVP5 while maintaining backward compatibility and supporting enterprise-scale deployment.

## Architectural Principles

### Core Design Principles

```yaml
Transparency_First:
  - Every AI operation is visible and auditable
  - User authorization required before external AI calls
  - Complete cost tracking and visibility
  - Decision processes are explainable

Performance_Optimized:
  - Local operations <500ms (95th percentile)
  - AI operations 3-5s acceptable with transparency
  - Caching strategies for frequently accessed data
  - Progressive enhancement for advanced features

Scalability_Built_In:
  - Horizontal scaling from day one
  - Microservices-ready architecture
  - Database partitioning strategies
  - CDN and edge optimization

Security_by_Design:
  - Zero-trust security model
  - End-to-end encryption
  - Comprehensive audit trails
  - GDPR and compliance-ready

Cost_Consciousness:
  - AI operations only when necessary
  - Intelligent caching to reduce external API calls
  - Resource optimization and monitoring
  - Usage-based cost allocation
```

## System Components Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend    │  Mobile App     │  API Clients             │
│  - Main Interface  │  (Future)       │  - Third-party           │
│  - Visualization   │                 │  - Integrations          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer / CDN                         │
│                   (Nginx / CloudFlare)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Authentication  │  Rate Limiting   │  Request Routing          │
│  Authorization   │  Monitoring      │  Response Caching         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Application Services                         │
├──────────────────┬──────────────────┬─────────────────────────┤
│   Search Service │  Knowledge Mgmt  │   AI Gateway Service    │
│   - Local FTS    │  - CRUD Ops      │   - Provider Abstraction│
│   - Indexing     │  - Categorization│   - Cost Calculation    │
│   - Results      │  - File Processing│   - Authorization       │
├──────────────────┼──────────────────┼─────────────────────────┤
│ Transparency Svc │  User Management │   Analytics Service     │
│ - Flow Logging   │  - Authentication│   - Usage Tracking      │
│ - Audit Trail    │  - Preferences   │   - Performance Metrics │
│ - Visualization  │  - Budget Control│   - Reporting           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Data Layer                                 │
├──────────────────┬──────────────────┬─────────────────────────┤
│   PostgreSQL     │     Redis        │    File Storage         │
│   - Knowledge DB │   - Session Cache│    - Documents          │
│   - User Data    │   - Query Cache  │    - Images             │
│   - Audit Logs   │   - Real-time    │    - Attachments        │
│   - Analytics    │   - Pub/Sub      │    - Backups            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  External Services                             │
├──────────────────┬──────────────────┬─────────────────────────┤
│   AI Providers   │   Identity Mgmt  │    Monitoring           │
│   - Google Gemini│   - Active Dir   │    - Prometheus         │
│   - OpenAI (MVP2)│   - Azure AD     │    - Grafana            │
│   - Anthropic    │   - Okta         │    - AlertManager       │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### React Application Structure

```typescript
// Frontend Application Architecture
src/
├── components/              // Reusable UI components
│   ├── common/             // Basic components (Button, Input, Modal)
│   ├── search/             // Search interface components
│   ├── knowledge/          // Knowledge management components
│   ├── analytics/          // Analytics and visualization
│   ├── transparency/       // AI transparency components
│   └── accessibility/      // Accessibility-specific components
│
├── hooks/                  // Custom React hooks
│   ├── useSearch.ts        // Search functionality
│   ├── useAIAuthorization.ts // AI authorization flow
│   ├── useBudgetControl.ts // Cost tracking
│   └── useVisualization.ts // Data visualization
│
├── services/               // API and external service layers
│   ├── api/               // API client implementations
│   ├── ai/                // AI provider abstractions
│   ├── cache/             // Client-side caching
│   └── monitoring/        // Performance monitoring
│
├── stores/                 // State management
│   ├── searchStore.ts     // Search state
│   ├── userStore.ts       // User preferences and settings
│   ├── budgetStore.ts     // Budget and cost tracking
│   └── analyticsStore.ts  // Analytics data
│
├── types/                  // TypeScript type definitions
│   ├── api.ts             // API response types
│   ├── search.ts          // Search-related types
│   ├── knowledge.ts       // Knowledge base types
│   └── transparency.ts    // Transparency and audit types
│
└── utils/                  // Utility functions
    ├── performance.ts      // Performance monitoring
    ├── accessibility.ts    // Accessibility helpers
    ├── validation.ts       // Input validation
    └── formatting.ts       // Data formatting
```

### State Management Architecture

```typescript
// Redux Toolkit Store Configuration
interface RootState {
  search: SearchState;
  knowledge: KnowledgeState;
  user: UserState;
  budget: BudgetState;
  transparency: TransparencyState;
  analytics: AnalyticsState;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  lastSearchTime: number;
  searchHistory: string[];
  filters: SearchFilters;
  aiEnhancementAvailable: boolean;
}

interface TransparencyState {
  authorizationQueue: AIAuthorizationRequest[];
  flowLogs: FlowLogEntry[];
  costTracking: CostTrackingData;
  userPreferences: AuthorizationPreferences;
}

interface BudgetState {
  dailyLimit: number;
  currentUsage: number;
  monthlyProjection: number;
  alerts: BudgetAlert[];
  usageHistory: UsageDataPoint[];
}
```

### Component Design System

```typescript
// Design System Component Architecture
interface BaseComponentProps {
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

// Transparency-First Components
interface AuthorizationDialogProps extends BaseComponentProps {
  query: string;
  operation: AIOperationType;
  estimatedCost: number;
  provider: AIProvider;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
  onAlwaysApprove: () => Promise<void>;
}

interface CostTrackerProps extends BaseComponentProps {
  currentUsage: number;
  dailyLimit: number;
  showDetailed?: boolean;
  onLimitChange?: (newLimit: number) => void;
}

interface FlowVisualizationProps extends BaseComponentProps {
  data: FlowLogEntry[];
  viewType: 'flowchart' | 'timeline' | 'tree' | 'network';
  realTimeUpdates?: boolean;
  onNodeClick?: (node: FlowNode) => void;
}
```

## Backend Architecture

### Service-Oriented Architecture

```typescript
// Backend Service Architecture
interface ServiceLayer {
  searchService: SearchService;
  knowledgeService: KnowledgeManagementService;
  aiGatewayService: AIGatewayService;
  transparencyService: TransparencyService;
  userService: UserManagementService;
  analyticsService: AnalyticsService;
}

// Search Service Implementation
class SearchService {
  private localSearchEngine: LocalSearchEngine;
  private aiProvider: AIProviderAbstraction;
  private cacheManager: CacheManager;

  async performLocalSearch(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    const startTime = performance.now();

    // Local full-text search with PostgreSQL FTS5
    const results = await this.localSearchEngine.search(query, filters);
    const duration = performance.now() - startTime;

    // Log performance metrics
    await this.transparencyService.logOperation({
      type: 'local_search',
      duration,
      query: query.substring(0, 100), // Truncate for privacy
      resultCount: results.length,
      status: 'success'
    });

    return results;
  }

  async performAIEnhancedSearch(
    query: string,
    authorization: AIAuthorization
  ): Promise<SearchResult[]> {
    if (!authorization.approved) {
      throw new Error('AI operation not authorized');
    }

    const startTime = performance.now();

    try {
      // Semantic search using AI provider
      const aiResults = await this.aiProvider.semanticSearch(query, {
        maxResults: 10,
        contextWindow: 4000
      });

      const duration = performance.now() - startTime;
      const actualCost = await this.aiProvider.getLastOperationCost();

      // Log AI operation with full transparency
      await this.transparencyService.logAIOperation({
        type: 'semantic_search',
        duration,
        query,
        provider: authorization.provider,
        estimatedCost: authorization.estimatedCost,
        actualCost,
        resultCount: aiResults.length,
        status: 'success'
      });

      // Update user's budget tracking
      await this.budgetService.recordUsage(authorization.userId, actualCost);

      return aiResults;
    } catch (error) {
      // Log failure and fallback to local search
      await this.transparencyService.logOperation({
        type: 'ai_search_failed',
        duration: performance.now() - startTime,
        error: error.message,
        status: 'error'
      });

      // Fallback to local search
      return this.performLocalSearch(query);
    }
  }
}
```

### AI Gateway Service

```typescript
// AI Provider Abstraction Layer
interface AIProvider {
  name: string;
  costPerToken: number;
  capabilities: AICapability[];
  rateLimit: RateLimit;
}

class AIGatewayService {
  private providers: Map<string, AIProviderClient>;
  private costCalculator: CostCalculationEngine;
  private authorizationService: AuthorizationService;

  async requestAIOperation(
    operation: AIOperationRequest
  ): Promise<AIOperationResult> {
    // Calculate estimated cost
    const costEstimate = await this.costCalculator.estimate(operation);

    // Request user authorization
    const authorization = await this.authorizationService.requestAuthorization({
      operation,
      costEstimate,
      user: operation.userId
    });

    if (!authorization.approved) {
      throw new AIOperationDeniedError('User denied AI operation');
    }

    // Select optimal provider
    const provider = this.selectOptimalProvider(operation, authorization.preferences);

    // Execute operation with full tracking
    return this.executeWithTracking(provider, operation, authorization);
  }

  private async executeWithTracking(
    provider: AIProviderClient,
    operation: AIOperationRequest,
    authorization: AIAuthorization
  ): Promise<AIOperationResult> {
    const startTime = Date.now();

    try {
      const result = await provider.execute(operation);
      const actualCost = result.cost || authorization.estimatedCost;

      // Update cost tracking
      await this.budgetService.recordActualUsage(
        operation.userId,
        actualCost,
        operation.operationType
      );

      // Log successful operation
      await this.transparencyService.logAIOperation({
        operationId: operation.id,
        provider: provider.name,
        duration: Date.now() - startTime,
        cost: actualCost,
        tokensUsed: result.tokensUsed,
        status: 'success'
      });

      return result;
    } catch (error) {
      // Log failed operation
      await this.transparencyService.logAIOperation({
        operationId: operation.id,
        provider: provider.name,
        duration: Date.now() - startTime,
        error: error.message,
        status: 'error'
      });

      throw error;
    }
  }
}
```

### Transparency Service

```typescript
// Complete Transparency and Audit Service
class TransparencyService {
  private flowLogger: FlowLogger;
  private visualizationEngine: VisualizationEngine;
  private auditTrail: AuditTrail;

  async logOperation(operation: OperationLog): Promise<void> {
    const logEntry: FlowLogEntry = {
      id: generateUUID(),
      timestamp: new Date(),
      ...operation
    };

    // Store in database
    await this.flowLogger.store(logEntry);

    // Emit real-time update
    this.emitRealtimeUpdate(logEntry);

    // Check for alerts or thresholds
    await this.checkAlertConditions(logEntry);
  }

  async generateVisualization(
    request: VisualizationRequest
  ): Promise<VisualizationData> {
    const logs = await this.flowLogger.query(request.filters);

    return this.visualizationEngine.generate(logs, {
      viewType: request.viewType,
      timeRange: request.timeRange,
      groupBy: request.groupBy,
      aggregations: request.aggregations
    });
  }

  async getTimeTravelData(timestamp: Date): Promise<SystemSnapshot> {
    // Reconstruct system state at specific time
    const snapshot = await this.auditTrail.reconstructState(timestamp);

    return {
      timestamp,
      knowledgeBaseState: snapshot.knowledgeBase,
      userSessions: snapshot.activeSessions,
      operationsInFlight: snapshot.operations,
      systemConfiguration: snapshot.config
    };
  }

  async replayDecision(operationId: string): Promise<DecisionReplay> {
    const operation = await this.flowLogger.getById(operationId);
    const context = await this.auditTrail.getOperationContext(operationId);

    return {
      operationId,
      timestamp: operation.timestamp,
      inputContext: context.input,
      decisionProcess: context.steps,
      alternativesConsidered: context.alternatives,
      finalDecision: operation.result,
      confidenceScore: context.confidence
    };
  }
}
```

## Database Architecture

### PostgreSQL Schema Design

```sql
-- Core Knowledge Base Schema
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT, -- Rendered HTML version
    category VARCHAR(100),
    functional_category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    file_attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    search_vector TSVECTOR,
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Full-text search index
CREATE INDEX idx_knowledge_entries_search
ON knowledge_entries USING GIN(search_vector);

-- Performance indexes
CREATE INDEX idx_knowledge_entries_category
ON knowledge_entries(category) WHERE NOT is_deleted;

CREATE INDEX idx_knowledge_entries_created
ON knowledge_entries(created_at DESC) WHERE NOT is_deleted;

CREATE INDEX idx_knowledge_entries_tags
ON knowledge_entries USING GIN(tags) WHERE NOT is_deleted;

-- User Management and Preferences
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE
);

-- Authorization and Budget Control
CREATE TABLE authorization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE,
    daily_budget_cents INTEGER DEFAULT 500, -- €5.00 default
    monthly_budget_cents INTEGER,
    auto_approve_under_cents INTEGER DEFAULT 10,
    prefer_local_search BOOLEAN DEFAULT TRUE,
    require_approval_for TEXT[] DEFAULT '{}',
    trusted_providers TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Flow Operations and Transparency
CREATE TABLE flow_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT NOW(),
    operation_type VARCHAR(50) NOT NULL,
    module_name VARCHAR(50) NOT NULL,
    duration_ms INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'warning')),
    user_id UUID REFERENCES users(id),
    details JSONB DEFAULT '{}',
    cost_cents INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    ai_provider VARCHAR(50),
    query_text TEXT,
    result_summary TEXT,
    correlation_id UUID, -- For grouping related operations
    parent_operation_id UUID REFERENCES flow_operations(id)
);

-- Partitioning for large-scale deployments
CREATE TABLE flow_operations_2025_01 PARTITION OF flow_operations
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Indexes for performance
CREATE INDEX idx_flow_operations_timestamp
ON flow_operations(timestamp DESC);

CREATE INDEX idx_flow_operations_user_type
ON flow_operations(user_id, operation_type, timestamp DESC);

CREATE INDEX idx_flow_operations_cost
ON flow_operations(cost_cents DESC) WHERE cost_cents > 0;

-- Cost Tracking and Analytics
CREATE TABLE daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    usage_date DATE NOT NULL,
    total_cost_cents INTEGER DEFAULT 0,
    operation_count INTEGER DEFAULT 0,
    budget_limit_cents INTEGER NOT NULL,
    operation_breakdown JSONB DEFAULT '{}',
    efficiency_score DECIMAL(5,2), -- Cost per successful operation
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, usage_date)
);

-- AI Operations Detailed Tracking
CREATE TABLE ai_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_operation_id UUID REFERENCES flow_operations(id),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost_cents INTEGER,
    actual_cost_cents INTEGER,
    operation_type VARCHAR(50),
    query_text TEXT NOT NULL,
    response_text TEXT,
    context_used TEXT[],
    confidence_score DECIMAL(3,2),
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Visualization and Analytics Support
CREATE TABLE visualization_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    snapshot_name VARCHAR(255),
    view_type VARCHAR(50),
    time_range TSTZRANGE,
    filters JSONB,
    data_summary JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- System Configuration and Checkpoints
CREATE TABLE system_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    condition_expression TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Redis Cache Strategy

```typescript
// Redis Cache Architecture
interface CacheStrategy {
  searchResults: {
    keyPattern: 'search:{hash}:{filters}';
    ttl: 300; // 5 minutes
    compression: true;
  };

  userSessions: {
    keyPattern: 'session:{userId}';
    ttl: 3600; // 1 hour
    encryption: true;
  };

  aiResponses: {
    keyPattern: 'ai:{provider}:{hash}';
    ttl: 1800; // 30 minutes
    compression: true;
  };

  costCalculations: {
    keyPattern: 'cost:{operation}:{params}';
    ttl: 600; // 10 minutes
    precision: 'high';
  };
}

class CacheManager {
  async getCachedSearchResults(
    query: string,
    filters: SearchFilters
  ): Promise<SearchResult[] | null> {
    const cacheKey = this.generateSearchKey(query, filters);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      // Log cache hit for analytics
      await this.logCacheEvent('search', 'hit');
      return JSON.parse(cached);
    }

    return null;
  }

  async setCachedSearchResults(
    query: string,
    filters: SearchFilters,
    results: SearchResult[]
  ): Promise<void> {
    const cacheKey = this.generateSearchKey(query, filters);
    const compressed = await this.compress(JSON.stringify(results));

    await this.redis.setex(cacheKey, 300, compressed);
    await this.logCacheEvent('search', 'set');
  }

  async invalidateRelatedCaches(operation: string): Promise<void> {
    switch (operation) {
      case 'knowledge_updated':
        await this.redis.eval(`
          for _,k in ipairs(redis.call('keys', 'search:*')) do
            redis.call('del', k)
          end
        `, 0);
        break;

      case 'user_budget_updated':
        await this.invalidatePattern('cost:*');
        break;
    }
  }
}
```

## API Architecture

### RESTful API Design

```typescript
// API Endpoint Structure
interface APIEndpoints {
  // Knowledge Management
  'GET /api/v1/knowledge': GetKnowledgeEntriesEndpoint;
  'POST /api/v1/knowledge': CreateKnowledgeEntryEndpoint;
  'GET /api/v1/knowledge/:id': GetKnowledgeEntryEndpoint;
  'PUT /api/v1/knowledge/:id': UpdateKnowledgeEntryEndpoint;
  'DELETE /api/v1/knowledge/:id': DeleteKnowledgeEntryEndpoint;

  // Search Operations
  'GET /api/v1/search': LocalSearchEndpoint;
  'POST /api/v1/search/ai-enhanced': AIEnhancedSearchEndpoint;
  'GET /api/v1/search/suggestions': SearchSuggestionsEndpoint;
  'GET /api/v1/search/history': SearchHistoryEndpoint;

  // AI Operations and Authorization
  'POST /api/v1/ai/authorize': RequestAIAuthorizationEndpoint;
  'POST /api/v1/ai/execute': ExecuteAIOperationEndpoint;
  'GET /api/v1/ai/providers': GetAIProvidersEndpoint;
  'GET /api/v1/ai/cost-estimate': GetCostEstimateEndpoint;

  // Transparency and Flow Logging
  'GET /api/v1/flow/logs': GetFlowLogsEndpoint;
  'GET /api/v1/flow/visualization': GetVisualizationDataEndpoint;
  'POST /api/v1/flow/export': ExportFlowDataEndpoint;
  'GET /api/v1/flow/time-travel/:timestamp': GetHistoricalStateEndpoint;

  // Budget and Cost Management
  'GET /api/v1/budget/status': GetBudgetStatusEndpoint;
  'PUT /api/v1/budget/settings': UpdateBudgetSettingsEndpoint;
  'GET /api/v1/budget/analytics': GetCostAnalyticsEndpoint;
  'GET /api/v1/budget/usage-history': GetUsageHistoryEndpoint;

  // User Management and Preferences
  'GET /api/v1/users/profile': GetUserProfileEndpoint;
  'PUT /api/v1/users/preferences': UpdateUserPreferencesEndpoint;
  'GET /api/v1/users/settings': GetUserSettingsEndpoint;

  // Analytics and Reporting
  'GET /api/v1/analytics/dashboard': GetAnalyticsDashboardEndpoint;
  'GET /api/v1/analytics/performance': GetPerformanceMetricsEndpoint;
  'POST /api/v1/analytics/reports': GenerateReportEndpoint;
}

// Example Implementation: AI Authorization Endpoint
@Controller('/api/v1/ai')
export class AIController {
  @Post('/authorize')
  @UseGuards(AuthGuard)
  async requestAuthorization(
    @Body() request: AIAuthorizationRequest,
    @User() user: AuthenticatedUser
  ): Promise<AIAuthorizationResponse> {
    // Validate request
    const validation = await this.validateAIRequest(request);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    // Calculate cost estimate
    const costEstimate = await this.aiGateway.calculateCost(request);

    // Check budget limits
    const budgetCheck = await this.budgetService.checkBudget(
      user.id,
      costEstimate.estimatedCostCents
    );

    // Create authorization request
    const authRequest: AIAuthorizationData = {
      id: generateUUID(),
      userId: user.id,
      operation: request.operation,
      query: request.query,
      estimatedCost: costEstimate.estimatedCostCents,
      provider: request.preferredProvider || 'gemini',
      timestamp: new Date(),
      budgetStatus: budgetCheck
    };

    // Store for user interface
    await this.authorizationService.createPendingAuthorization(authRequest);

    return {
      authorizationId: authRequest.id,
      costEstimate,
      budgetStatus: budgetCheck,
      requiresApproval: !budgetCheck.autoApprove,
      expires: new Date(Date.now() + 30000) // 30 seconds
    };
  }

  @Post('/execute')
  @UseGuards(AuthGuard)
  async executeOperation(
    @Body() request: AIExecutionRequest,
    @User() user: AuthenticatedUser
  ): Promise<AIOperationResult> {
    // Verify authorization
    const authorization = await this.authorizationService.getAuthorization(
      request.authorizationId
    );

    if (!authorization || authorization.userId !== user.id) {
      throw new UnauthorizedException('Invalid authorization');
    }

    if (authorization.status !== 'approved') {
      throw new ForbiddenException('Operation not authorized');
    }

    // Execute with full tracking
    return this.aiGateway.executeOperation(authorization);
  }
}
```

### GraphQL Schema (MVP2+)

```graphql
# GraphQL Schema for Advanced Queries
type Query {
  # Knowledge Management
  knowledgeEntries(
    filters: KnowledgeFilters
    pagination: PaginationInput
  ): KnowledgeEntryConnection!

  knowledgeEntry(id: ID!): KnowledgeEntry

  # Search Operations
  search(
    query: String!
    filters: SearchFilters
    enhanceWithAI: Boolean = false
  ): SearchResults!

  searchSuggestions(partial: String!): [SearchSuggestion!]!

  # Flow and Transparency
  flowLogs(
    timeRange: TimeRangeInput
    filters: FlowLogFilters
    pagination: PaginationInput
  ): FlowLogConnection!

  visualization(
    type: VisualizationType!
    timeRange: TimeRangeInput
    filters: VisualizationFilters
  ): VisualizationData!

  timeTravelState(timestamp: DateTime!): SystemSnapshot!

  # Analytics
  analytics(
    timeRange: TimeRangeInput
    groupBy: [AnalyticsGrouping!]
  ): AnalyticsData!

  costAnalytics(
    timeRange: TimeRangeInput
    breakdown: CostBreakdown
  ): CostAnalyticsData!
}

type Mutation {
  # Knowledge Management
  createKnowledgeEntry(input: CreateKnowledgeEntryInput!): KnowledgeEntry!
  updateKnowledgeEntry(id: ID!, input: UpdateKnowledgeEntryInput!): KnowledgeEntry!
  deleteKnowledgeEntry(id: ID!): Boolean!

  # AI Operations
  requestAIAuthorization(input: AIAuthorizationInput!): AIAuthorizationResponse!
  approveAIOperation(authorizationId: ID!): AIOperationResult!
  denyAIOperation(authorizationId: ID!): Boolean!

  # User Preferences
  updateBudgetSettings(input: BudgetSettingsInput!): BudgetSettings!
  updateUserPreferences(input: UserPreferencesInput!): UserPreferences!

  # Checkpoints and Monitoring
  createCheckpoint(input: CheckpointInput!): Checkpoint!
  updateCheckpoint(id: ID!, input: CheckpointInput!): Checkpoint!
  deleteCheckpoint(id: ID!): Boolean!
}

type Subscription {
  # Real-time Updates
  flowLogUpdates(filters: FlowLogFilters): FlowLogEntry!
  budgetAlerts(userId: ID!): BudgetAlert!
  aiOperationUpdates(userId: ID!): AIOperationUpdate!
  visualizationUpdates(sessionId: ID!): VisualizationUpdate!
}
```

## Security Architecture

### Zero-Trust Security Model

```typescript
// Security Layer Implementation
class SecurityService {
  private jwtService: JWTService;
  private encryptionService: EncryptionService;
  private auditLogger: AuditLogger;

  async authenticateRequest(request: IncomingRequest): Promise<AuthContext> {
    // Extract and validate JWT token
    const token = this.extractToken(request);
    const payload = await this.jwtService.verify(token);

    // Check token freshness and revocation
    await this.validateTokenFreshness(payload);

    // Load user context with permissions
    const user = await this.userService.getById(payload.userId);
    const permissions = await this.permissionService.getUserPermissions(user.id);

    return {
      user,
      permissions,
      sessionId: payload.sessionId,
      deviceFingerprint: request.headers['x-device-id']
    };
  }

  async authorizeOperation(
    context: AuthContext,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Check RBAC permissions
    const hasPermission = context.permissions.some(p =>
      p.resource === resource && p.actions.includes(action)
    );

    if (!hasPermission) {
      await this.auditLogger.logUnauthorizedAccess({
        userId: context.user.id,
        resource,
        action,
        timestamp: new Date()
      });
      return false;
    }

    return true;
  }

  async encryptSensitiveData(data: any): Promise<string> {
    // Use AES-256 encryption for sensitive data
    return this.encryptionService.encrypt(data, {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'pbkdf2',
      iterations: 100000
    });
  }

  async validateDataIntegrity(data: any, signature: string): Promise<boolean> {
    // Verify HMAC signature for data integrity
    const computedSignature = await this.computeHMAC(data);
    return this.constantTimeCompare(signature, computedSignature);
  }
}
```

### Data Protection and Privacy

```typescript
// GDPR and Privacy Compliance
class PrivacyService {
  async anonymizeUserData(userId: string): Promise<void> {
    // Replace PII with anonymized identifiers
    await this.database.transaction(async (tx) => {
      // Anonymize user profile
      await tx.query(`
        UPDATE users
        SET email = 'anonymous-' || id || '@deleted.local',
            full_name = 'Deleted User',
            preferences = '{}'
        WHERE id = $1
      `, [userId]);

      // Anonymize search queries
      await tx.query(`
        UPDATE flow_operations
        SET query_text = '[ANONYMIZED]',
            details = '{}'
        WHERE user_id = $1 AND query_text IS NOT NULL
      `, [userId]);

      // Keep aggregated analytics but remove personal identifiers
      await tx.query(`
        UPDATE daily_usage
        SET operation_breakdown = '{}'
        WHERE user_id = $1
      `, [userId]);
    });
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    // Generate complete data export for user
    const [profile, entries, searches, usage] = await Promise.all([
      this.getUserProfile(userId),
      this.getKnowledgeEntries(userId),
      this.getSearchHistory(userId),
      this.getUsageData(userId)
    ]);

    return {
      profile,
      knowledgeEntries: entries,
      searchHistory: searches,
      usageStatistics: usage,
      exportDate: new Date(),
      format: 'json'
    };
  }

  async detectPII(content: string): Promise<PIIDetectionResult> {
    // Use regex patterns and ML models to detect PII
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}-\d{3}-\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
    };

    const detectedPII: PIIMatch[] = [];

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = content.match(pattern);
      if (matches) {
        detectedPII.push(...matches.map(match => ({
          type,
          value: match,
          confidence: 0.95
        })));
      }
    }

    return {
      hasPII: detectedPII.length > 0,
      matches: detectedPII,
      recommendation: detectedPII.length > 0 ? 'redact' : 'allow'
    };
  }
}
```

## Performance and Scalability

### Horizontal Scaling Architecture

```yaml
# Kubernetes Deployment Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: knowledge-platform-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: knowledge-platform-api
  template:
    metadata:
      labels:
        app: knowledge-platform-api
    spec:
      containers:
      - name: api
        image: knowledge-platform:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: knowledge-platform-service
spec:
  selector:
    app: knowledge-platform-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: knowledge-platform-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: knowledge-platform-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Performance Monitoring and Optimization

```typescript
// Performance Monitoring Service
class PerformanceMonitor {
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;

  async trackOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: PerformanceContext
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      const endMemory = process.memoryUsage();

      await this.recordMetrics({
        operation: operationName,
        duration,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        status: 'success',
        context
      });

      // Check for performance degradation
      if (duration > this.getThreshold(operationName)) {
        await this.alertManager.sendAlert({
          type: 'performance_degradation',
          operation: operationName,
          actualDuration: duration,
          expectedDuration: this.getThreshold(operationName),
          context
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      await this.recordMetrics({
        operation: operationName,
        duration,
        status: 'error',
        error: error.message,
        context
      });

      throw error;
    }
  }

  private getThreshold(operation: string): number {
    const thresholds = {
      'local_search': 500,
      'ai_operation': 5000,
      'knowledge_create': 1000,
      'visualization_render': 2000
    };

    return thresholds[operation] || 1000;
  }
}
```

## Monitoring and Observability

### Application Metrics

```typescript
// Prometheus Metrics Configuration
class MetricsService {
  private prometheus = require('prom-client');

  // Counter metrics
  private searchCounter = new this.prometheus.Counter({
    name: 'search_operations_total',
    help: 'Total number of search operations',
    labelNames: ['type', 'status', 'user_department']
  });

  private aiOperationCounter = new this.prometheus.Counter({
    name: 'ai_operations_total',
    help: 'Total number of AI operations',
    labelNames: ['provider', 'operation_type', 'status']
  });

  // Histogram metrics
  private searchDuration = new this.prometheus.Histogram({
    name: 'search_duration_seconds',
    help: 'Search operation duration',
    labelNames: ['type'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });

  private aiCosts = new this.prometheus.Histogram({
    name: 'ai_operation_cost_cents',
    help: 'AI operation costs in cents',
    labelNames: ['provider', 'operation_type'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
  });

  // Gauge metrics
  private activeUsers = new this.prometheus.Gauge({
    name: 'active_users_current',
    help: 'Currently active users'
  });

  private budgetUtilization = new this.prometheus.Gauge({
    name: 'budget_utilization_percentage',
    help: 'Budget utilization percentage by department',
    labelNames: ['department']
  });

  recordSearchOperation(
    type: 'local' | 'ai_enhanced',
    duration: number,
    status: 'success' | 'error',
    userDepartment: string
  ): void {
    this.searchCounter.inc({ type, status, user_department: userDepartment });
    this.searchDuration.observe({ type }, duration / 1000);
  }

  recordAIOperation(
    provider: string,
    operationType: string,
    cost: number,
    status: string
  ): void {
    this.aiOperationCounter.inc({ provider, operation_type: operationType, status });
    this.aiCosts.observe({ provider, operation_type: operationType }, cost);
  }
}
```

### Health Checks and Readiness Probes

```typescript
// Health Check Service
class HealthCheckService {
  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkAIProviders(),
      this.checkFileStorage(),
      this.checkExternalDependencies()
    ]);

    const results = checks.map((check, index) => ({
      name: ['database', 'redis', 'ai_providers', 'file_storage', 'external'][index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      details: check.status === 'fulfilled' ? check.value : check.reason
    }));

    const overallStatus = results.every(r => r.status === 'healthy')
      ? 'healthy'
      : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date(),
      version: process.env.APP_VERSION,
      uptime: process.uptime(),
      checks: results
    };
  }

  private async checkDatabase(): Promise<DatabaseHealth> {
    const start = Date.now();

    try {
      await this.database.query('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime,
        connections: await this.getConnectionCount()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - start
      };
    }
  }

  private async checkAIProviders(): Promise<AIProvidersHealth> {
    const providers = ['gemini', 'openai', 'anthropic'];
    const providerResults = await Promise.allSettled(
      providers.map(provider => this.pingAIProvider(provider))
    );

    return {
      overall: providerResults.some(r => r.status === 'fulfilled') ? 'healthy' : 'unhealthy',
      providers: providers.map((name, index) => ({
        name,
        status: providerResults[index].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        details: providerResults[index].status === 'fulfilled'
          ? providerResults[index].value
          : providerResults[index].reason
      }))
    };
  }
}
```

---

This comprehensive technical architecture provides the foundation for building a scalable, secure, and transparent AI-powered knowledge management platform. The architecture emphasizes performance, cost control, and user transparency while maintaining flexibility for future enhancements.

**Document Version**: 1.0
**Date**: January 2025
**Status**: Ready for Implementation