# SSO Troubleshooting Guide

This comprehensive troubleshooting guide covers common issues encountered during SSO implementation and deployment, along with their solutions.

## Table of Contents

1. [Configuration Issues](#configuration-issues)
2. [Provider-Specific Problems](#provider-specific-problems)
3. [Authentication Failures](#authentication-failures)
4. [Session Management Issues](#session-management-issues)
5. [Network and Connectivity](#network-and-connectivity)
6. [Performance Issues](#performance-issues)
7. [Security Concerns](#security-concerns)
8. [Debugging Tools](#debugging-tools)

---

## Configuration Issues

### Problem: Environment Variables Not Loading

**Symptoms:**
- Application fails to start
- "Missing required environment variable" errors
- SSO providers not recognized

**Solutions:**

1. **Check .env file location:**
   ```bash
   ls -la .env*
   # Ensure .env file is in the project root
   ```

2. **Verify file permissions:**
   ```bash
   chmod 600 .env
   # Environment files should not be readable by others
   ```

3. **Check for syntax errors:**
   ```bash
   # Ensure no spaces around = sign
   JWT_SECRET=your_secret_here  # ✅ Correct
   JWT_SECRET = your_secret_here  # ❌ Incorrect
   ```

4. **Validate environment loading:**
   ```javascript
   console.log('NODE_ENV:', process.env.NODE_ENV);
   console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
   ```

### Problem: Configuration Validation Failures

**Symptoms:**
- "Configuration validation failed" errors
- SSO providers marked as misconfigured
- Security warnings about weak secrets

**Solutions:**

1. **Run configuration validator:**
   ```bash
   node config/sso-config-validator.js
   ```

2. **Generate secure secrets:**
   ```bash
   # Generate JWT secret (64 characters)
   openssl rand -hex 64

   # Generate master key (32 bytes)
   openssl rand -hex 32

   # Generate session secret
   openssl rand -hex 32
   ```

3. **Fix common validation errors:**
   ```env
   # Ensure JWT_SECRET is at least 32 characters
   JWT_SECRET=your_super_secure_jwt_secret_min_64_chars_required_for_production

   # Master key must be exactly 64 hex characters (32 bytes)
   MASTER_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

   # Session secret minimum 32 characters
   SESSION_SECRET=your_session_secret_min_32_chars_required_for_production
   ```

---

## Provider-Specific Problems

### Google OAuth Issues

#### Problem: `redirect_uri_mismatch`

**Symptoms:**
- Error: "The redirect URI in the request does not match the ones authorized for the OAuth client"
- Users cannot complete Google authentication

**Solutions:**

1. **Check Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services > Credentials
   - Edit your OAuth 2.0 Client ID
   - Verify authorized redirect URIs include:
     ```
     https://your-domain.com/auth/google/callback
     http://localhost:3000/auth/google/callback  # For development
     ```

2. **Verify environment configuration:**
   ```env
   GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
   # Must match exactly (protocol, domain, path)
   ```

3. **Common mistakes:**
   ```env
   # ❌ Wrong protocol
   GOOGLE_REDIRECT_URI=http://your-domain.com/auth/google/callback

   # ❌ Missing /auth/google/callback path
   GOOGLE_REDIRECT_URI=https://your-domain.com/

   # ✅ Correct format
   GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
   ```

#### Problem: `invalid_client`

**Symptoms:**
- Error: "The OAuth client was not found"
- Authentication fails immediately

**Solutions:**

1. **Verify client credentials:**
   ```env
   GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_from_google
   ```

2. **Check Google Cloud Console:**
   - Ensure the OAuth client is enabled
   - Verify the client hasn't been deleted
   - Check the project is active

3. **Regenerate client secret if needed:**
   - Go to Google Cloud Console > Credentials
   - Edit OAuth client > Add new client secret
   - Update environment variable

### Microsoft Azure AD Issues

#### Problem: `AADSTS50011 - Reply URL Mismatch`

**Symptoms:**
- Error: "The reply URL specified in the request does not match the reply URLs configured"
- Azure authentication fails

**Solutions:**

1. **Check Azure Portal:**
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to Azure Active Directory > App registrations
   - Select your app > Authentication
   - Add redirect URI: `https://your-domain.com/auth/microsoft/callback`

2. **Verify environment configuration:**
   ```env
   AZURE_REDIRECT_URI=https://your-domain.com/auth/microsoft/callback
   ```

#### Problem: `AADSTS7000215 - Invalid Client Secret`

**Symptoms:**
- Error: "Invalid client secret provided"
- Token exchange fails

**Solutions:**

1. **Generate new client secret:**
   - Azure Portal > App registrations > Your app
   - Certificates & secrets > New client secret
   - Copy the VALUE (not the Secret ID)

2. **Update configuration:**
   ```env
   AZURE_CLIENT_SECRET=new_secret_value_from_azure
   ```

3. **Check secret expiration:**
   - Azure Portal > Certificates & secrets
   - Verify secret hasn't expired

### Okta Issues

#### Problem: `invalid_client` or `unauthorized_client`

**Symptoms:**
- Okta authentication fails
- Error in browser console or server logs

**Solutions:**

1. **Verify Okta configuration:**
   ```env
   OKTA_DOMAIN=dev-12345.okta.com  # Without https://
   OKTA_CLIENT_ID=your_okta_client_id
   OKTA_CLIENT_SECRET=your_okta_client_secret
   ```

2. **Check Okta application settings:**
   - Okta Admin Console > Applications > Your app
   - Sign-in redirect URIs: `https://your-domain.com/auth/okta/callback`
   - Grant types: Authorization Code checked

#### Problem: Domain format issues

**Symptoms:**
- Cannot connect to Okta
- Domain resolution errors

**Solutions:**

1. **Correct domain format:**
   ```env
   # ❌ Wrong - includes protocol
   OKTA_DOMAIN=https://dev-12345.okta.com

   # ❌ Wrong - includes path
   OKTA_DOMAIN=dev-12345.okta.com/oauth2

   # ✅ Correct - domain only
   OKTA_DOMAIN=dev-12345.okta.com
   ```

### Auth0 Issues

#### Problem: Callback URL not allowed

**Symptoms:**
- Error: "Callback URL mismatch"
- Auth0 authentication fails

**Solutions:**

1. **Update Auth0 Dashboard:**
   - Go to [Auth0 Dashboard](https://manage.auth0.com/)
   - Applications > Your app > Settings
   - Allowed Callback URLs: `https://your-domain.com/auth/auth0/callback`

2. **Environment configuration:**
   ```env
   AUTH0_CALLBACK_URL=https://your-domain.com/auth/auth0/callback
   ```

---

## Authentication Failures

### Problem: JWT Token Issues

#### Symptoms:
- "Invalid JWT signature" errors
- Users getting logged out immediately
- Token verification failures

#### Solutions:

1. **Check JWT secret consistency:**
   ```bash
   # Ensure JWT_SECRET is the same across all instances
   echo $JWT_SECRET | wc -c  # Should be > 32 characters
   ```

2. **Verify token expiration:**
   ```env
   JWT_EXPIRES_IN=15m        # Not too short
   JWT_REFRESH_EXPIRES_IN=7d # Reasonable refresh window
   ```

3. **Debug JWT tokens:**
   ```javascript
   const jwt = require('jsonwebtoken');

   try {
     const decoded = jwt.verify(token, process.env.JWT_SECRET);
     console.log('Token valid:', decoded);
   } catch (error) {
     console.log('Token error:', error.message);
   }
   ```

### Problem: Session Management Issues

#### Symptoms:
- Users getting logged out randomly
- Session data not persisting
- "Session store disconnected" errors

#### Solutions:

1. **Check Redis connection:**
   ```bash
   redis-cli ping  # Should return PONG
   ```

2. **Verify Redis configuration:**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_redis_password
   REDIS_DB=0
   ```

3. **Session configuration:**
   ```env
   SESSION_MAX_AGE=86400000      # 24 hours
   SESSION_COOKIE_SECURE=true    # HTTPS only
   SESSION_COOKIE_HTTPONLY=true  # JavaScript access disabled
   ```

4. **Debug session store:**
   ```javascript
   // In your app
   app.use(session({
     store: redisStore,
     saveUninitialized: false,
     resave: false,
     rolling: true  // Reset expiry on activity
   }));
   ```

### Problem: Rate Limiting Blocking Users

#### Symptoms:
- "Too many requests" errors
- Legitimate users cannot authenticate
- 429 status codes

#### Solutions:

1. **Adjust rate limiting:**
   ```env
   # Increase limits for production
   RATE_LIMIT_MAX_REQUESTS=200
   AUTH_RATE_LIMIT_MAX_ATTEMPTS=10
   ```

2. **Whitelist known IPs:**
   ```javascript
   const rateLimiter = rateLimit({
     skip: (req) => {
       const whitelistedIPs = ['192.168.1.1', '10.0.0.1'];
       return whitelistedIPs.includes(req.ip);
     }
   });
   ```

3. **Monitor rate limiting:**
   ```bash
   # Check Redis for rate limit keys
   redis-cli --scan --pattern "rl:*" | head -10
   ```

---

## Network and Connectivity

### Problem: Cannot Connect to SSO Providers

#### Symptoms:
- Timeouts connecting to Google, Microsoft, etc.
- Network unreachable errors
- SSL/TLS handshake failures

#### Solutions:

1. **Test connectivity:**
   ```bash
   curl -I https://accounts.google.com
   curl -I https://login.microsoftonline.com
   curl -I https://dev-12345.okta.com
   ```

2. **Check DNS resolution:**
   ```bash
   nslookup accounts.google.com
   nslookup login.microsoftonline.com
   ```

3. **Corporate firewall/proxy:**
   ```bash
   # Set proxy if needed
   export https_proxy=http://proxy.company.com:8080
   export http_proxy=http://proxy.company.com:8080
   ```

4. **SSL certificate issues:**
   ```bash
   # Test SSL connection
   openssl s_client -connect accounts.google.com:443 -servername accounts.google.com
   ```

### Problem: CORS Errors

#### Symptoms:
- Browser console shows CORS errors
- "Access to fetch blocked by CORS policy"
- OPTIONS requests failing

#### Solutions:

1. **Configure CORS properly:**
   ```env
   CORS_ORIGIN=https://your-frontend.com,https://your-app.com
   CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS
   CORS_CREDENTIALS=true
   ```

2. **Handle preflight requests:**
   ```javascript
   app.use(cors({
     origin: process.env.CORS_ORIGIN.split(','),
     credentials: true,
     optionsSuccessStatus: 200
   }));
   ```

---

## Performance Issues

### Problem: Slow Authentication

#### Symptoms:
- Long delays during SSO flow
- Timeouts during token exchange
- High response times

#### Solutions:

1. **Database query optimization:**
   ```sql
   -- Add indexes for user lookups
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_sessions_user_id ON sessions(user_id);
   ```

2. **Cache frequently accessed data:**
   ```javascript
   // Cache user data in Redis
   const userCache = require('./cache/user-cache');
   const user = await userCache.get(`user:${userId}`);
   ```

3. **Optimize JWT tokens:**
   ```env
   # Reduce JWT payload size
   JWT_EXPIRES_IN=5m  # Shorter-lived tokens
   ```

4. **Connection pooling:**
   ```javascript
   const pool = new Pool({
     max: 20,        // Maximum connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

### Problem: High Memory Usage

#### Symptoms:
- Application consuming excessive memory
- Memory leaks in session storage
- Out of memory errors

#### Solutions:

1. **Monitor session cleanup:**
   ```javascript
   // Ensure expired sessions are cleaned up
   app.use(session({
     store: redisStore,
     rolling: true,
     cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
   }));
   ```

2. **Optimize Redis memory:**
   ```redis
   # Redis configuration
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

3. **Profile memory usage:**
   ```bash
   node --inspect your-app.js
   # Use Chrome DevTools for memory profiling
   ```

---

## Security Concerns

### Problem: Security Headers Missing

#### Symptoms:
- Security scan warnings
- Vulnerable to XSS/clickjacking
- Browser security warnings

#### Solutions:

1. **Enable security headers:**
   ```env
   SECURITY_HEADERS_ENABLED=true
   HSTS_MAX_AGE=31536000
   CSP_ENABLED=true
   ```

2. **Configure Content Security Policy:**
   ```env
   CSP_REPORT_URI=https://your-domain.com/csp-report
   ```

3. **Test security headers:**
   ```bash
   curl -I https://your-domain.com
   # Check for X-Frame-Options, X-XSS-Protection, etc.
   ```

### Problem: Insecure Session Configuration

#### Symptoms:
- Session cookies accessible via JavaScript
- Sessions transmitted over HTTP
- Session fixation vulnerabilities

#### Solutions:

1. **Secure session cookies:**
   ```env
   SESSION_COOKIE_SECURE=true      # HTTPS only
   SESSION_COOKIE_HTTPONLY=true    # No JavaScript access
   SESSION_COOKIE_SAMESITE=strict  # CSRF protection
   ```

2. **Session regeneration:**
   ```javascript
   // Regenerate session on login
   req.session.regenerate((err) => {
     if (err) throw err;
     req.session.user = user;
     req.session.save();
   });
   ```

---

## Debugging Tools

### Configuration Validation

```bash
# Run comprehensive configuration check
node config/sso-config-validator.js

# Check specific provider configuration
node -e "
const config = require('./config/sso-config-validator');
const validator = new config();
validator.validateSSOProviders();
"
```

### Log Analysis

```bash
# Monitor security logs
tail -f logs/security.log

# Search for authentication errors
grep "AUTH_FAILED" logs/security.log | tail -20

# Monitor rate limiting
grep "RATE_LIMIT_EXCEEDED" logs/security.log
```

### Network Debugging

```bash
# Test SSO provider endpoints
curl -v https://accounts.google.com/.well-known/openid_configuration
curl -v https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration

# Test your callback endpoints
curl -v https://your-domain.com/auth/google/callback
```

### Database Debugging

```sql
-- Check active sessions
SELECT COUNT(*) FROM sessions WHERE expires > NOW();

-- Check user authentication history
SELECT email, last_login, provider FROM users ORDER BY last_login DESC LIMIT 10;

-- Check rate limiting data (Redis)
-- redis-cli --scan --pattern "rl:*"
```

### Application Health Checks

```bash
# Check application health
curl https://your-domain.com/health | jq

# Check configuration info
curl https://your-domain.com/config/info | jq

# Monitor application metrics
curl https://your-domain.com/metrics
```

### JWT Token Debugging

```javascript
// Debug JWT tokens in Node.js
const jwt = require('jsonwebtoken');

// Decode without verification to inspect
const decoded = jwt.decode(token, { complete: true });
console.log('Header:', decoded.header);
console.log('Payload:', decoded.payload);

// Verify token
try {
  const verified = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token valid:', verified);
} catch (error) {
  console.log('Token invalid:', error.message);
}
```

### Redis Session Debugging

```bash
# Connect to Redis
redis-cli

# List all sessions
KEYS sess:*

# Inspect session data
GET sess:your-session-id

# Monitor Redis commands
MONITOR
```

---

## Emergency Procedures

### Complete SSO Reset

If SSO is completely broken, follow these steps:

1. **Backup current configuration:**
   ```bash
   cp .env .env.backup.$(date +%s)
   ```

2. **Reset to minimal configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with minimal working configuration
   ```

3. **Clear all sessions:**
   ```bash
   redis-cli FLUSHDB
   ```

4. **Restart application:**
   ```bash
   npm run start
   ```

5. **Test with one provider:**
   - Enable only Google OAuth first
   - Test authentication flow
   - Gradually enable other providers

### Security Incident Response

If security breach is suspected:

1. **Immediately revoke all sessions:**
   ```javascript
   // In Node.js console
   const redis = require('redis');
   const client = redis.createClient();
   client.flushdb();
   ```

2. **Rotate all secrets:**
   ```bash
   # Generate new secrets
   openssl rand -hex 64 > new_jwt_secret.txt
   openssl rand -hex 32 > new_master_key.txt
   ```

3. **Check audit logs:**
   ```bash
   grep "SECURITY_EVENT" logs/security.log
   grep "AUTH_FAILED" logs/security.log | wc -l
   ```

4. **Update SSO provider secrets:**
   - Regenerate client secrets in provider consoles
   - Update environment configuration
   - Restart application

---

This troubleshooting guide should help resolve most common SSO issues. For issues not covered here, check the application logs and consider reaching out to the specific SSO provider's support documentation.