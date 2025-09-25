# SSO Troubleshooting Guide

## 🔧 Common Issues and Solutions

This comprehensive troubleshooting guide covers the most frequent issues encountered with the SSO authentication system and their solutions.

## 🚨 Authentication Failures

### Issue: Invalid redirect_uri Error

**Symptoms:**
- `redirect_uri_mismatch` error from OAuth providers
- Users unable to complete authentication flow
- "Invalid redirect URI" in logs

**Common Causes:**
```bash
# ❌ Common mistakes
REDIRECT_URI=http://localhost:3000/auth/callback/  # Trailing slash
REDIRECT_URI=https://app.com/callback             # Wrong path
REDIRECT_URI=http://app.com/auth/callback         # HTTP vs HTTPS
```

**Solutions:**

1. **Exact URI Matching**
```javascript
// ✅ Correct configuration
const redirectUris = {
  development: 'http://localhost:3000/api/v2/auth/google/callback',
  staging: 'https://staging.yourapp.com/api/v2/auth/google/callback',
  production: 'https://yourapp.com/api/v2/auth/google/callback'
};

// Ensure exact match in provider console
```

2. **Dynamic Environment Configuration**
```javascript
// config/auth.js
const getRedirectUri = (provider) => {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? process.env.PRODUCTION_URL
    : process.env.DEV_URL || 'http://localhost:3000';

  return `${baseUrl}/api/v2/auth/${provider}/callback`;
};
```

3. **Debugging Tool**
```javascript
// Debug redirect URI configuration
function debugRedirectUri(provider) {
  const configuredUri = process.env[`${provider.toUpperCase()}_REDIRECT_URI`];
  const currentUri = getRedirectUri(provider);

  console.log(`${provider} Provider Configuration:`);
  console.log(`  Configured URI: ${configuredUri}`);
  console.log(`  Current URI: ${currentUri}`);
  console.log(`  Match: ${configuredUri === currentUri ? '✅' : '❌'}`);
}
```

### Issue: State Parameter Validation Failed

**Symptoms:**
- `invalid_state` error
- CSRF protection warnings
- Authentication flow interruption

**Diagnosis:**
```javascript
// Debugging state parameter issues
const stateDebugger = {
  generateState: (req) => {
    const state = crypto.randomBytes(16).toString('hex');
    console.log(`Generated state: ${state}`);

    // Store with timestamp
    req.session.oauthState = {
      value: state,
      timestamp: Date.now(),
      provider: req.params.provider
    };

    return state;
  },

  validateState: (req) => {
    const receivedState = req.query.state;
    const storedState = req.session.oauthState;

    console.log('State Validation Debug:');
    console.log(`  Received: ${receivedState}`);
    console.log(`  Stored: ${storedState?.value}`);
    console.log(`  Age: ${Date.now() - storedState?.timestamp}ms`);

    // Check expiration (5 minutes)
    if (Date.now() - storedState.timestamp > 5 * 60 * 1000) {
      console.log('❌ State expired');
      return false;
    }

    return receivedState === storedState.value;
  }
};
```

**Solutions:**

1. **Secure State Generation**
```javascript
// Enhanced state parameter handling
class StateManager {
  constructor() {
    this.stateStore = new Map();
  }

  generateState(userId, provider) {
    const state = crypto.randomBytes(32).toString('hex');

    this.stateStore.set(state, {
      userId: userId,
      provider: provider,
      timestamp: Date.now(),
      ip: req.ip
    });

    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      this.stateStore.delete(state);
    }, 5 * 60 * 1000);

    return state;
  }

  validateState(state, req) {
    const stateData = this.stateStore.get(state);

    if (!stateData) {
      throw new Error('Invalid or expired state');
    }

    // Validate IP address
    if (stateData.ip !== req.ip) {
      throw new Error('State validation failed: IP mismatch');
    }

    // Cleanup
    this.stateStore.delete(state);

    return stateData;
  }
}
```

## 🎫 Token Issues

### Issue: JWT Token Validation Failures

**Symptoms:**
- `invalid_signature` errors
- `token_expired` messages
- Intermittent authentication failures

**Common Causes:**
- Clock skew between services
- Key rotation issues
- Invalid token format

**Diagnosis Script:**
```javascript
// JWT debugging utility
const jwt = require('jsonwebtoken');

function debugJWT(token) {
  try {
    // Decode without verification first
    const decoded = jwt.decode(token, { complete: true });

    console.log('JWT Debug Information:');
    console.log('Header:', decoded.header);
    console.log('Payload:', decoded.payload);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const exp = decoded.payload.exp;
    const iat = decoded.payload.iat;

    console.log(`Current time: ${now}`);
    console.log(`Token issued: ${iat} (${new Date(iat * 1000)})`);
    console.log(`Token expires: ${exp} (${new Date(exp * 1000)})`);
    console.log(`Time to expiry: ${exp - now} seconds`);

    if (exp < now) {
      console.log('❌ Token expired');
    } else if (iat > now + 30) {
      console.log('⚠️ Clock skew detected');
    } else {
      console.log('✅ Token timing valid');
    }

    return decoded;
  } catch (error) {
    console.error('JWT decode error:', error.message);
    return null;
  }
}
```

**Solutions:**

1. **Clock Skew Tolerance**
```javascript
// JWT validation with clock tolerance
const jwtOptions = {
  algorithms: ['RS256'],
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
  clockTolerance: 60, // 60 seconds tolerance
  maxAge: '15m'
};

function validateToken(token) {
  try {
    return jwt.verify(token, getPublicKey(), jwtOptions);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Handle expired token
      throw new AuthError('token_expired', 'Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      // Handle invalid token
      throw new AuthError('invalid_token', 'Token is invalid');
    }
    throw error;
  }
}
```

2. **Key Rotation Handling**
```javascript
// Dynamic key resolution
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: process.env.JWKS_URI,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Failed to get signing key:', err);
      return callback(err);
    }

    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}
```

### Issue: Refresh Token Rotation Failures

**Symptoms:**
- Users randomly logged out
- "Invalid refresh token" errors
- Token theft detection false positives

**Debugging:**
```javascript
// Refresh token debugging
class RefreshTokenDebugger {
  async debugRefreshToken(tokenId) {
    const token = await this.getRefreshToken(tokenId);

    console.log('Refresh Token Debug:');
    console.log(`  Token ID: ${tokenId}`);
    console.log(`  Exists: ${!!token}`);

    if (token) {
      console.log(`  User ID: ${token.userId}`);
      console.log(`  Family: ${token.family}`);
      console.log(`  Created: ${token.createdAt}`);
      console.log(`  Expires: ${token.expiresAt}`);
      console.log(`  Revoked: ${token.revoked}`);
      console.log(`  IP: ${token.ipAddress}`);

      // Check family status
      const familyTokens = await this.getFamilyTokens(token.family);
      console.log(`  Family size: ${familyTokens.length}`);
      console.log(`  Active in family: ${familyTokens.filter(t => !t.revoked).length}`);
    }
  }

  async auditTokenFamily(family) {
    const tokens = await this.getFamilyTokens(family);

    console.log(`Token Family Audit: ${family}`);
    tokens.forEach((token, index) => {
      console.log(`  ${index + 1}. ${token.id}`);
      console.log(`     Created: ${token.createdAt}`);
      console.log(`     Status: ${token.revoked ? 'REVOKED' : 'ACTIVE'}`);
      console.log(`     Reason: ${token.revocationReason || 'N/A'}`);
    });
  }
}
```

**Solutions:**

1. **Robust Token Rotation**
```javascript
// Improved refresh token rotation
async function rotateRefreshToken(oldTokenId, req) {
  const transaction = await db.beginTransaction();

  try {
    // Get and lock the old token
    const oldToken = await db.query(
      'SELECT * FROM refresh_tokens WHERE id = ? FOR UPDATE',
      [oldTokenId]
    );

    if (!oldToken || oldToken.revoked) {
      throw new Error('Invalid or revoked refresh token');
    }

    // Security validation
    if (!this.validateTokenContext(oldToken, req)) {
      // Mark entire family as compromised
      await this.revokeTokenFamily(oldToken.family, 'security_violation');
      throw new Error('Token security validation failed');
    }

    // Generate new token
    const newToken = await this.generateRefreshToken(
      oldToken.userId,
      oldToken.sessionId,
      oldToken.family
    );

    // Revoke old token
    await db.query(
      'UPDATE refresh_tokens SET revoked = true, revocation_reason = ? WHERE id = ?',
      ['rotated', oldTokenId]
    );

    await transaction.commit();
    return newToken;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

## 🔐 Session Management Issues

### Issue: Session Fixation

**Symptoms:**
- Session IDs don't change after login
- Security warnings
- Audit log violations

**Detection:**
```javascript
// Session fixation detection
function detectSessionFixation(req) {
  const sessionId = req.sessionID;
  const beforeLogin = req.session.preLoginSessionId;

  if (beforeLogin && sessionId === beforeLogin) {
    console.warn('⚠️ Potential session fixation detected');
    console.log(`Session ID: ${sessionId}`);
    console.log(`IP: ${req.ip}`);
    console.log(`User Agent: ${req.headers['user-agent']}`);

    return true;
  }

  return false;
}
```

**Solution:**
```javascript
// Secure session regeneration
async function secureLogin(req, user) {
  // Store pre-login session ID for detection
  const preLoginSessionId = req.sessionID;

  // Regenerate session ID
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Initialize new secure session
  req.session.userId = user.id;
  req.session.loginTime = new Date();
  req.session.preLoginSessionId = preLoginSessionId;
  req.session.securityContext = {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    deviceFingerprint: generateDeviceFingerprint(req)
  };

  console.log(`✅ Session regenerated: ${preLoginSessionId} → ${req.sessionID}`);
}
```

### Issue: Concurrent Session Conflicts

**Symptoms:**
- Users logged out unexpectedly
- "Session conflict" errors
- Multiple active sessions interfering

**Management Strategy:**
```javascript
// Concurrent session management
class SessionConflictResolver {
  async handleNewLogin(userId, newSession) {
    const existingSessions = await this.getActiveSessions(userId);
    const maxSessions = this.getMaxSessionsForUser(userId);

    if (existingSessions.length >= maxSessions) {
      // Resolve conflict based on policy
      await this.resolveSessionConflict(userId, existingSessions, newSession);
    }

    return await this.createSession(newSession);
  }

  async resolveSessionConflict(userId, existingSessions, newSession) {
    const policy = await this.getSessionPolicy(userId);

    switch (policy.conflictResolution) {
      case 'oldest_out':
        // Remove oldest session
        const oldest = existingSessions.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        )[0];
        await this.terminateSession(oldest.id, 'session_limit_exceeded');
        break;

      case 'same_device_only':
        // Only allow one session per device
        const sameDevice = existingSessions.find(s =>
          s.device_fingerprint === newSession.device_fingerprint
        );
        if (sameDevice) {
          await this.terminateSession(sameDevice.id, 'new_device_login');
        }
        break;

      case 'explicit_choice':
        // Let user choose which sessions to keep
        await this.promptSessionChoice(userId, existingSessions);
        break;
    }
  }
}
```

## 🌐 Provider-Specific Issues

### Google OAuth Issues

**Issue: Consent Screen Bypassing**
```javascript
// Force consent for sensitive applications
const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
googleAuthUrl.searchParams.set('prompt', 'consent'); // Always show consent
googleAuthUrl.searchParams.set('access_type', 'offline'); // For refresh tokens
```

**Issue: People API Quota Exceeded**
```javascript
// Implement exponential backoff for Google APIs
class GoogleAPIClient {
  async fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || Math.pow(2, i);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return response;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }
}
```

### Microsoft Entra ID Issues

**Issue: Multi-tenant Token Validation**
```javascript
// Validate issuer for multi-tenant applications
function validateMicrosoftToken(idToken) {
  const decoded = jwt.decode(idToken);
  const tenantId = decoded.tid;

  // Validate against allowed tenants
  const allowedTenants = process.env.ALLOWED_TENANTS?.split(',') || [];

  if (!allowedTenants.includes(tenantId) && !allowedTenants.includes('common')) {
    throw new Error(`Tenant ${tenantId} not allowed`);
  }

  // Validate issuer format
  const validIssuers = [
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`
  ];

  if (!validIssuers.includes(decoded.iss)) {
    throw new Error('Invalid token issuer');
  }

  return decoded;
}
```

**Issue: Admin Consent Required**
```javascript
// Handle admin consent requirement
app.get('/auth/microsoft/admin-consent', async (req, res) => {
  const consentUrl = new URL('https://login.microsoftonline.com/common/adminconsent');
  consentUrl.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID);
  consentUrl.searchParams.set('state', generateState());
  consentUrl.searchParams.set('redirect_uri',
    `${process.env.BASE_URL}/auth/microsoft/admin-consent-callback`
  );

  res.redirect(consentUrl.toString());
});
```

## 🚨 Error Monitoring & Alerts

### Comprehensive Error Tracking

```javascript
// Error categorization and tracking
class AuthErrorTracker {
  constructor() {
    this.errorCategories = {
      'authentication': ['invalid_credentials', 'account_locked', 'mfa_failed'],
      'authorization': ['insufficient_permissions', 'resource_forbidden'],
      'token': ['token_expired', 'invalid_token', 'token_revoked'],
      'session': ['session_expired', 'session_conflict', 'session_invalid'],
      'provider': ['provider_error', 'consent_required', 'api_quota_exceeded'],
      'security': ['rate_limit_exceeded', 'suspicious_activity', 'csrf_violation']
    };
  }

  logError(error, context) {
    const category = this.categorizeError(error.code);
    const errorData = {
      timestamp: new Date(),
      category: category,
      code: error.code,
      message: error.message,
      severity: this.getSeverity(error.code),

      // Context
      userId: context.userId,
      sessionId: context.sessionId,
      ip: context.ip,
      userAgent: context.userAgent,

      // Stack trace (only in development)
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    // Send to monitoring system
    this.sendToMonitoring(errorData);

    // Trigger alerts for critical errors
    if (errorData.severity === 'critical') {
      this.triggerAlert(errorData);
    }
  }

  categorizeError(errorCode) {
    for (const [category, codes] of Object.entries(this.errorCategories)) {
      if (codes.includes(errorCode)) {
        return category;
      }
    }
    return 'unknown';
  }

  getSeverity(errorCode) {
    const severityMap = {
      'account_locked': 'high',
      'suspicious_activity': 'critical',
      'csrf_violation': 'critical',
      'token_expired': 'low',
      'provider_error': 'medium'
    };

    return severityMap[errorCode] || 'medium';
  }
}
```

### Health Check Endpoints

```javascript
// Comprehensive health checks
app.get('/health', async (req, res) => {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: process.env.APP_VERSION,
    checks: {}
  };

  try {
    // Database connectivity
    healthStatus.checks.database = await checkDatabase();

    // Cache connectivity
    healthStatus.checks.cache = await checkRedis();

    // External providers
    healthStatus.checks.providers = await checkProviders();

    // Certificate validity
    healthStatus.checks.certificates = await checkCertificates();

    // Overall status
    const allHealthy = Object.values(healthStatus.checks)
      .every(check => check.status === 'healthy');

    healthStatus.status = allHealthy ? 'healthy' : 'degraded';

    res.status(allHealthy ? 200 : 503).json(healthStatus);
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.error = error.message;
    res.status(503).json(healthStatus);
  }
});

async function checkDatabase() {
  try {
    await db.query('SELECT 1');
    return { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkProviders() {
  const providers = ['google', 'microsoft'];
  const results = {};

  for (const provider of providers) {
    try {
      const start = Date.now();
      await testProviderConnectivity(provider);
      results[provider] = {
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      results[provider] = {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  return results;
}
```

## 📊 Performance Debugging

### Slow Authentication Debugging

```javascript
// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds

    if (duration > 1000) { // Log slow requests (>1s)
      console.warn(`Slow request detected: ${req.method} ${req.path}`);
      console.warn(`Duration: ${duration}ms`);
      console.warn(`User: ${req.user?.id || 'anonymous'}`);

      // Additional debugging for auth endpoints
      if (req.path.includes('/auth/')) {
        console.warn('Auth-specific timing:');
        console.warn(`  Provider: ${req.params.provider}`);
        console.warn(`  Step: ${req.path.split('/').pop()}`);
      }
    }

    // Store metrics
    metrics.recordDuration(req.path, duration);
  });

  next();
};
```

### Database Query Optimization

```javascript
// Query performance analyzer
class QueryAnalyzer {
  async analyzeSlowQueries() {
    // PostgreSQL specific - adjust for your database
    const slowQueries = await db.query(`
      SELECT
        query,
        mean_exec_time,
        calls,
        total_exec_time,
        (total_exec_time / calls) as avg_time
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `);

    console.log('Slow Query Analysis:');
    slowQueries.forEach((query, index) => {
      console.log(`${index + 1}. Average: ${query.avg_time}ms`);
      console.log(`   Calls: ${query.calls}`);
      console.log(`   Query: ${query.query.substring(0, 100)}...`);
    });

    return slowQueries;
  }

  async optimizeAuthQueries() {
    // Suggest indexes for auth-related queries
    const suggestions = [
      'CREATE INDEX CONCURRENTLY idx_users_email_active ON users(email) WHERE active = true;',
      'CREATE INDEX CONCURRENTLY idx_refresh_tokens_user_active ON refresh_tokens(user_id) WHERE revoked = false;',
      'CREATE INDEX CONCURRENTLY idx_sessions_user_active ON user_sessions(user_id) WHERE active = true;',
      'CREATE INDEX CONCURRENTLY idx_audit_logs_user_time ON audit_logs(user_id, created_at);'
    ];

    console.log('Recommended indexes for auth performance:');
    suggestions.forEach(sql => console.log(sql));
  }
}
```

## 🛠️ Diagnostic Tools

### Authentication Flow Tracer

```javascript
// Complete flow tracing
class AuthFlowTracer {
  constructor() {
    this.traces = new Map();
  }

  startTrace(traceId, userId, provider) {
    this.traces.set(traceId, {
      traceId,
      userId,
      provider,
      startTime: Date.now(),
      steps: []
    });
  }

  addStep(traceId, step, data = {}) {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.steps.push({
        step,
        timestamp: Date.now(),
        duration: Date.now() - trace.startTime,
        data
      });
    }
  }

  completeTrace(traceId, success, result) {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.completed = Date.now();
      trace.totalDuration = trace.completed - trace.startTime;
      trace.success = success;
      trace.result = result;

      // Log trace summary
      this.logTraceResults(trace);

      // Cleanup
      setTimeout(() => this.traces.delete(traceId), 5 * 60 * 1000);
    }
  }

  logTraceResults(trace) {
    console.log(`\n🔍 Auth Flow Trace: ${trace.traceId}`);
    console.log(`Provider: ${trace.provider}`);
    console.log(`User: ${trace.userId}`);
    console.log(`Total Duration: ${trace.totalDuration}ms`);
    console.log(`Success: ${trace.success ? '✅' : '❌'}`);

    console.log('\nSteps:');
    trace.steps.forEach((step, index) => {
      const stepDuration = index > 0
        ? step.duration - trace.steps[index - 1].duration
        : step.duration;

      console.log(`  ${index + 1}. ${step.step} (${stepDuration}ms)`);

      if (step.data && Object.keys(step.data).length > 0) {
        console.log(`     Data: ${JSON.stringify(step.data)}`);
      }
    });
  }
}

// Usage in auth flow
const tracer = new AuthFlowTracer();

app.get('/auth/:provider/authorize', (req, res) => {
  const traceId = crypto.randomUUID();
  tracer.startTrace(traceId, req.user?.id, req.params.provider);

  req.traceId = traceId;
  tracer.addStep(traceId, 'authorize_start');

  // ... auth logic
});
```

---

**Next**: Check out specific [Integration Examples](../integration/) or [Performance Optimization](../performance/) guides for advanced configurations.