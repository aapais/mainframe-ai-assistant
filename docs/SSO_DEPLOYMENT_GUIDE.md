# SSO Deployment Guide - Production Ready

## Overview

This comprehensive guide covers the complete deployment process for Single Sign-On (SSO) integration in the Mainframe AI Assistant, including security configurations, provider setup, and production deployment checklist.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [SSO Provider Setup](#sso-provider-setup)
4. [Security Configuration](#security-configuration)
5. [Production Deployment](#production-deployment)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

## Pre-Deployment Checklist

### Infrastructure Requirements

- [ ] **Web Server**: NGINX/Apache with HTTPS support
- [ ] **Database**: PostgreSQL 12+ or compatible
- [ ] **Cache**: Redis 6.0+ for session storage
- [ ] **SSL Certificate**: Valid TLS certificate for production domain
- [ ] **DNS**: Proper domain resolution and CDN configuration
- [ ] **Firewall**: Configured security groups and network access controls
- [ ] **Monitoring**: Application Performance Monitoring (APM) solution
- [ ] **Backup**: Database and configuration backup strategy

### Security Prerequisites

- [ ] **Secrets Management**: Secure storage for API keys and certificates
- [ ] **Vulnerability Scanning**: Regular security assessments
- [ ] **Access Controls**: Principle of least privilege implementation
- [ ] **Audit Logging**: Comprehensive logging and monitoring setup
- [ ] **Incident Response**: Security incident response plan
- [ ] **Compliance**: GDPR/SOX compliance requirements assessment

## Environment Configuration

### 1. Copy and Configure Environment File

```bash
# Copy the example environment file
cp .env.example .env.production

# Secure the file permissions
chmod 600 .env.production
chown app:app .env.production
```

### 2. Generate Secure Secrets

Use the following commands to generate cryptographically secure secrets:

```bash
# Generate JWT secrets (64 characters minimum)
openssl rand -hex 64

# Generate Master Encryption Key (32 bytes = 64 hex characters)
openssl rand -hex 32

# Generate Session Secret
openssl rand -hex 32

# Generate CSRF Secret
openssl rand -hex 32
```

### 3. Configure Basic Application Settings

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
APP_NAME="Mainframe AI Assistant"
APP_URL=https://your-production-domain.com
API_VERSION=v1
```

### 4. Database Configuration

```env
DATABASE_URL=postgresql://username:password@localhost:5432/mainframe_ai
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_TIMEOUT=30000
DB_IDLE_TIMEOUT=600000
```

### 5. Security Configuration

```env
# Use the generated secrets from step 2
JWT_SECRET=your_generated_jwt_secret_64_chars_minimum
JWT_REFRESH_SECRET=your_generated_refresh_secret_64_chars_minimum
MASTER_KEY=your_generated_master_key_32_bytes_hex
SESSION_SECRET=your_generated_session_secret_32_chars_minimum
CSRF_SECRET=your_generated_csrf_secret

# Session security
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
SESSION_MAX_AGE=86400000
```

## SSO Provider Setup

### Google OAuth 2.0

#### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure consent screen with your application details
6. Add authorized redirect URIs:
   - `https://your-domain.com/auth/google/callback`

#### 2. Environment Configuration

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
GOOGLE_SCOPE=email,profile,openid
GOOGLE_HD_RESTRICTION=your-company-domain.com  # Optional: restrict to domain
```

#### 3. Domain Verification

- Add your domain to authorized domains in Google Cloud Console
- Verify domain ownership through Google Search Console

### Microsoft Azure AD

#### 1. Azure Portal Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure application:
   - Name: "Mainframe AI Assistant"
   - Account types: Accounts in organizational directory
   - Redirect URI: `https://your-domain.com/auth/microsoft/callback`
5. Note down Application (client) ID and Directory (tenant) ID
6. Go to **Certificates & secrets** → Generate new client secret

#### 2. Environment Configuration

```env
AZURE_CLIENT_ID=your_application_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_REDIRECT_URI=https://your-domain.com/auth/microsoft/callback
AZURE_SCOPE=openid,profile,email,User.Read
MICROSOFT_GRAPH_ENDPOINT=https://graph.microsoft.com/v1.0
```

#### 3. API Permissions

Grant the following API permissions in Azure Portal:
- Microsoft Graph → User.Read (Delegated)
- Microsoft Graph → profile (Delegated)
- Microsoft Graph → email (Delegated)
- Microsoft Graph → openid (Delegated)

### Okta

#### 1. Okta Developer Console Setup

1. Go to [Okta Developer Console](https://developer.okta.com/)
2. Create new application → Web Application
3. Configure settings:
   - Application type: Web
   - Grant types: Authorization Code
   - Redirect URIs: `https://your-domain.com/auth/okta/callback`
   - Logout redirect URIs: `https://your-domain.com/logout`

#### 2. Environment Configuration

```env
OKTA_DOMAIN=your-okta-domain.okta.com
OKTA_CLIENT_ID=your_client_id
OKTA_CLIENT_SECRET=your_client_secret
OKTA_REDIRECT_URI=https://your-domain.com/auth/okta/callback
OKTA_SCOPE=openid,profile,email
```

### Auth0

#### 1. Auth0 Dashboard Setup

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create new application → Regular Web Applications
3. Configure settings:
   - Allowed Callback URLs: `https://your-domain.com/auth/auth0/callback`
   - Allowed Logout URLs: `https://your-domain.com/logout`
   - Allowed Web Origins: `https://your-domain.com`

#### 2. Environment Configuration

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_CALLBACK_URL=https://your-domain.com/auth/auth0/callback
AUTH0_SCOPE=openid,profile,email
```

### SAML Configuration

#### 1. Generate SAML Certificates

```bash
# Generate private key
openssl genrsa -out saml-private.key 2048

# Generate certificate signing request
openssl req -new -key saml-private.key -out saml.csr

# Generate self-signed certificate (or use CA-signed)
openssl x509 -req -days 365 -in saml.csr -signkey saml-private.key -out saml-cert.crt
```

#### 2. Environment Configuration

```env
SAML_ENTRY_POINT=https://your-idp.com/saml/sso
SAML_ISSUER=https://your-domain.com
SAML_CALLBACK_URL=https://your-domain.com/auth/saml/callback
SAML_CERT_PATH=/path/to/saml-cert.crt
SAML_PRIVATE_KEY_PATH=/path/to/saml-private.key
SAML_IDP_CERT_PATH=/path/to/idp-cert.crt
```

### LDAP/Active Directory

#### 1. LDAP Server Configuration

Ensure your LDAP server is configured with:
- Proper user search base DN
- Service account for binding
- TLS/SSL encryption enabled

#### 2. Environment Configuration

```env
LDAP_URL=ldaps://your-ldap-server.com:636
LDAP_BIND_DN=cn=service-account,cn=Users,dc=company,dc=com
LDAP_BIND_CREDENTIALS=service_account_password
LDAP_SEARCH_BASE=cn=Users,dc=company,dc=com
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_TLS_ENABLED=true
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

## Security Configuration

### Rate Limiting

```env
# API Rate Limiting (15 minutes window, 100 requests)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Authentication Rate Limiting (15 minutes window, 5 attempts)
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_ATTEMPTS=5
AUTH_LOCKOUT_DURATION=1800000

# Password Reset Rate Limiting (1 hour window, 3 attempts)
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=3600000
PASSWORD_RESET_MAX_ATTEMPTS=3
```

### CORS Configuration

```env
CORS_ORIGIN=https://your-frontend-domain.com,https://your-app-domain.com
CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With,X-CSRF-Token
CORS_CREDENTIALS=true
CORS_PREFLIGHT_MAX_AGE=86400
```

### Security Headers

```env
SECURITY_HEADERS_ENABLED=true
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true
CSP_ENABLED=true
CSP_REPORT_URI=https://your-domain.com/csp-report
```

### Feature Flags

```env
FEATURE_SSO_ENABLED=true
FEATURE_MFA_ENABLED=true
FEATURE_AUDIT_LOGGING=true
FEATURE_RATE_LIMITING=true
FEATURE_EMAIL_VERIFICATION=true
FEATURE_PASSWORD_COMPLEXITY=true
FEATURE_SESSION_MANAGEMENT=true
```

## Production Deployment

### 1. Pre-Deployment Validation

Run the configuration validator before deployment:

```bash
# Run configuration validation
node config/sso-config-validator.js

# Check for security issues
npm audit

# Run security tests
npm run test:security
```

### 2. Container Deployment (Docker)

#### Create Production Dockerfile

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 3000
CMD ["node", "server.js"]
```

#### Docker Compose Configuration

```yaml
version: '3.8'
services:
  mainframe-ai:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: mainframe_ai
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Kubernetes Deployment

#### Create Kubernetes Manifests

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mainframe-ai-sso
  labels:
    app: mainframe-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mainframe-ai
  template:
    metadata:
      labels:
        app: mainframe-ai
    spec:
      containers:
      - name: mainframe-ai
        image: mainframe-ai:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: mainframe-ai-secrets
        - configMapRef:
            name: mainframe-ai-config
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
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### 4. Database Migration

```bash
# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Create database indexes
npm run db:index
```

### 5. SSL/TLS Configuration

#### NGINX Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Logging

### 1. Application Monitoring

```env
MONITORING_ENABLED=true
HEALTH_CHECK_ENDPOINT=/health
METRICS_ENDPOINT=/metrics
METRICS_AUTH_REQUIRED=true

# External monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEW_RELIC_LICENSE_KEY=your_new_relic_license_key
DATADOG_API_KEY=your_datadog_api_key
```

### 2. Logging Configuration

```env
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/mainframe-ai/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD

# Security logging
SECURITY_LOG_ENABLED=true
SECURITY_LOG_PATH=/var/log/mainframe-ai/security.log
AUDIT_LOG_ENABLED=true
AUDIT_LOG_PATH=/var/log/mainframe-ai/audit.log
```

### 3. Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/mainframe-ai << EOF
/var/log/mainframe-ai/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 app app
    postrotate
        systemctl reload mainframe-ai
    endscript
}
EOF
```

## Troubleshooting

### Common SSO Issues

#### 1. Google OAuth Errors

**Error**: `redirect_uri_mismatch`
- **Solution**: Verify redirect URI in Google Cloud Console matches exactly
- **Check**: Protocol (https), domain, and path must match exactly

**Error**: `invalid_client`
- **Solution**: Verify CLIENT_ID and CLIENT_SECRET are correct
- **Check**: Ensure secrets are not truncated or contain extra characters

#### 2. Microsoft Azure AD Errors

**Error**: `AADSTS50011: The reply URL specified in the request does not match`
- **Solution**: Add redirect URI to Azure AD app registration
- **Check**: Ensure URI matches exactly including protocol and path

**Error**: `AADSTS7000215: Invalid client secret provided`
- **Solution**: Generate new client secret in Azure portal
- **Check**: Secret might have expired or is incorrect

#### 3. Session and Authentication Issues

**Error**: `Invalid JWT signature`
- **Solution**: Check JWT_SECRET configuration
- **Check**: Ensure secret hasn't changed and is consistent across instances

**Error**: `Session store disconnected`
- **Solution**: Check Redis connection and credentials
- **Check**: Network connectivity and Redis server status

### Debugging Steps

1. **Check Configuration**:
   ```bash
   node config/sso-config-validator.js
   ```

2. **Verify Network Connectivity**:
   ```bash
   curl -I https://accounts.google.com
   curl -I https://login.microsoftonline.com
   ```

3. **Check Logs**:
   ```bash
   tail -f /var/log/mainframe-ai/security.log
   tail -f /var/log/mainframe-ai/app.log
   ```

4. **Test Endpoints**:
   ```bash
   curl -k https://your-domain.com/health
   curl -k https://your-domain.com/auth/google
   ```

### Performance Issues

#### High Memory Usage
- Check for memory leaks in session storage
- Monitor Redis memory usage
- Review JWT token size and payload

#### Slow Authentication
- Check network latency to SSO providers
- Review rate limiting configuration
- Monitor database query performance

#### SSL/TLS Issues
- Verify certificate validity and chain
- Check TLS configuration and cipher suites
- Test with SSL Labs or similar tools

## Security Best Practices

### 1. Secrets Management

- Use environment-specific secret stores (AWS Secrets Manager, Azure Key Vault)
- Rotate secrets regularly (minimum every 90 days)
- Never commit secrets to version control
- Use different secrets for different environments

### 2. Network Security

- Implement proper firewall rules
- Use VPN for administrative access
- Enable DDoS protection
- Regular security scanning and penetration testing

### 3. Application Security

- Keep dependencies updated
- Regular security audits
- Implement proper input validation
- Use Content Security Policy (CSP)
- Enable security headers

### 4. Monitoring and Alerting

- Monitor authentication failures
- Alert on unusual login patterns
- Track API usage and errors
- Monitor system resources

### 5. Compliance

- Implement audit logging
- Regular compliance assessments
- Data retention policies
- Privacy by design principles

### 6. Incident Response

- Have incident response plan
- Regular backup testing
- Disaster recovery procedures
- Security incident communication plan

## Support and Maintenance

### Regular Maintenance Tasks

- [ ] **Weekly**: Review security logs and alerts
- [ ] **Monthly**: Update dependencies and security patches
- [ ] **Quarterly**: Rotate secrets and certificates
- [ ] **Annually**: Security audit and penetration testing

### Monitoring Dashboards

Create monitoring dashboards for:
- Authentication success/failure rates
- API response times
- Error rates by endpoint
- System resource utilization
- Security events and alerts

### Documentation Updates

Keep documentation current with:
- Configuration changes
- Provider updates
- Security patches
- Troubleshooting solutions

---

**Note**: This guide should be regularly updated as SSO providers change their APIs and new security requirements emerge. Always test configurations in a staging environment before deploying to production.