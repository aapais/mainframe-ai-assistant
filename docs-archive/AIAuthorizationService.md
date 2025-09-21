# AIAuthorizationService Documentation

## Overview

The AIAuthorizationService provides comprehensive authorization logic for AI operations in the mainframe assistant application. It manages user consent, cost estimation, auto-approval logic, and decision persistence.

## Key Features

- **Authorization Request Processing**: Validates and processes AI operation requests
- **Cost Estimation**: Calculates costs using current Gemini API pricing
- **Auto-Approval Logic**: Automatically approves low-risk, low-cost operations
- **User Preferences Management**: Stores and retrieves user authorization preferences
- **Session Management**: Remembers "approve always" decisions within sessions
- **Decision Logging**: Maintains audit trail of all authorization decisions
- **Integration Ready**: Works with existing service architecture and IPC system

## Architecture

### Core Components

1. **AIAuthorizationService** (`/src/main/services/AIAuthorizationService.ts`)
   - Main service implementation
   - Handles authorization logic and cost calculations
   - Manages user preferences and session approvals

2. **AuthorizationHandler** (`/src/main/ipc/handlers/AuthorizationHandler.ts`)
   - IPC handler for renderer communication
   - Provides secure API for authorization operations

3. **Authorization Types** (`/src/types/authorization.types.ts`)
   - Complete type definitions for authorization system
   - Comprehensive interfaces for requests, responses, and configuration

### Database Schema

The service automatically creates these tables:

```sql
-- User authorization preferences
CREATE TABLE ai_authorization_preferences (
  user_id TEXT PRIMARY KEY,
  default_permissions TEXT NOT NULL,
  cost_thresholds TEXT NOT NULL,
  session_settings TEXT NOT NULL,
  data_privacy_settings TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Authorization decisions audit log
CREATE TABLE ai_authorization_decisions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL,
  remember_decision INTEGER NOT NULL,
  scope TEXT,
  notes TEXT,
  user_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL
);

-- Authorization requests log
CREATE TABLE ai_authorization_requests (
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
  created_at TEXT NOT NULL
);
```

## API Reference

### Core Methods

#### `requestAuthorization(operation: AIOperation): Promise<AuthorizationResult>`

Main authorization method that:
- Estimates operation cost
- Checks auto-approval criteria
- Gets user preferences
- Logs authorization request
- Returns authorization decision

#### `checkAutoApproval(cost, operationType, dataContext?, sessionId?, userId?): Promise<boolean>`

Determines if operation should be auto-approved based on:
- Cost thresholds
- Data sensitivity (PII, confidential data)
- Session approvals ("approve always" decisions)
- User preferences

#### `estimateCost(query: string, operationType: AIOperationType): Promise<CostEstimate>`

Calculates operation cost using:
- Token estimation (input/output)
- Current Gemini API pricing
- Confidence scoring
- Detailed cost breakdown

#### `saveUserDecision(decision: UserDecision): Promise<void>`

Saves user authorization decision:
- Logs decision to database
- Updates session approvals if "approve always"
- Updates user preferences if requested

#### `getUserPreferences(userId?: string): Promise<AuthorizationPreferences>`

Retrieves user preferences with caching:
- Default permissions per operation type
- Cost thresholds for auto-approval
- Data privacy settings
- Session management preferences

#### `updatePreferences(prefs: Partial<AuthorizationPreferences>, userId?: string): Promise<void>`

Updates user preferences:
- Merges with existing preferences
- Updates database and cache
- Validates preference data

### IPC Channels

- `authorization:request` - Request authorization for AI operation
- `authorization:save_decision` - Save user authorization decision
- `authorization:get_preferences` - Get user authorization preferences
- `authorization:update_preferences` - Update user preferences
- `authorization:estimate_cost` - Estimate operation cost
- `authorization:check_auto_approval` - Check if operation would be auto-approved
- `authorization:get_stats` - Get authorization service statistics
- `authorization:clear_session` - Clear session approval cache

## Usage Examples

### Basic Authorization Request

```typescript
const operation: AIOperation = {
  type: 'semantic_search',
  query: 'Find VSAM errors',
  dataContext: {
    dataTypes: ['text'],
    dataSizeBytes: 1024,
    containsPII: false,
    isConfidential: false,
    retentionPolicy: 'no_retention',
    dataFields: [],
    dataSources: ['knowledge_base']
  },
  priority: 'medium',
  userId: 'user123',
  sessionId: 'session456'
};

const result = await authorizationService.requestAuthorization(operation);

if (result.authorized) {
  // Proceed with AI operation
} else {
  // Show authorization dialog
}
```

### Cost Estimation

```typescript
const estimate = await authorizationService.estimateCost(
  'Explain this mainframe error',
  'explain_error'
);

console.log(`Estimated cost: $${estimate.totalCostUSD.toFixed(4)}`);
console.log(`Input tokens: ${estimate.inputTokens}`);
console.log(`Output tokens: ${estimate.outputTokens}`);
```

### Update User Preferences

```typescript
await authorizationService.updatePreferences({
  costThresholds: {
    autoApprove: 0.02,      // Auto-approve up to $0.02
    requireConfirmation: 0.10, // Confirm up to $0.10
    block: 1.00             // Block over $1.00
  },
  defaultPermissions: {
    semantic_search: 'ask_always',
    explain_error: 'auto_approve',
    extract_keywords: 'auto_approve'
  }
}, 'user123');
```

## Configuration

### Cost Thresholds

- `autoApprove`: $0.01 (operations under this cost are auto-approved)
- `requireConfirmation`: $0.10 (operations require user confirmation)
- `block`: $1.00 (operations over this cost are blocked)

### Gemini Pricing (Current)

- **gemini-pro**: $0.000125/1K input tokens, $0.000375/1K output tokens
- **gemini-pro-vision**: $0.00025/1K input tokens, $0.00075/1K output tokens

### Operation Token Estimates

- `semantic_search`: ~150 output tokens
- `explain_error`: ~300 output tokens
- `analyze_entry`: ~250 output tokens
- `generate_summary`: ~200 output tokens
- `extract_keywords`: ~50 output tokens
- `classify_content`: ~100 output tokens
- `translate_text`: ~400 output tokens
- `improve_writing`: ~350 output tokens

## Integration

### Service Registration

```typescript
import { ServiceManager } from '../main/services/ServiceManager';
import { AIAuthorizationService } from '../main/services/AIAuthorizationService';

const serviceManager = new ServiceManager();
serviceManager.registerService('AIAuthorizationService', new AIAuthorizationService());
await serviceManager.startAll();
```

### IPC Handler Registration

```typescript
import { AuthorizationHandler } from '../main/ipc/handlers/AuthorizationHandler';

const authHandler = new AuthorizationHandler(authorizationService);
// Register handlers with your IPC system
```

## Security Considerations

- All user input is sanitized before processing
- Rate limiting applied to prevent abuse
- Sensitive data detection prevents accidental sharing
- Session approvals have expiration times
- Comprehensive audit logging
- Error handling prevents information leakage

## Performance Features

- Multi-level caching (preferences, estimates, session approvals)
- Efficient token estimation algorithms
- Background cleanup of expired data
- Optimized database queries with proper indexing
- Minimal memory footprint with TTL-based cache management

## Error Handling

The service includes comprehensive error handling:
- Graceful fallbacks when AI services unavailable
- Detailed error logging and reporting
- User-friendly error messages
- Automatic retry logic for transient failures
- Proper error propagation through IPC

## Monitoring and Metrics

- Service health monitoring
- Cache performance statistics
- Authorization request tracking
- Cost analysis and reporting
- Usage pattern analysis
- Performance metrics collection

## Future Enhancements

- Integration with external authorization systems
- Advanced cost prediction models
- Machine learning-based approval recommendations
- Enhanced security scanning
- Multi-tenant support
- Advanced analytics and reporting