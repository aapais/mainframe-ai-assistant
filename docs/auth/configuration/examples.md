# SSO Configuration Examples

## 🔧 Overview

This document provides comprehensive configuration examples for the Mainframe AI Assistant SSO system across different environments and deployment scenarios.

## 📁 Environment Configuration

### Development Environment

```bash
# .env.development
NODE_ENV=development
DEBUG=auth:*

# Server Configuration
PORT=3000
HOST=localhost
API_BASE_URL=http://localhost:3000

# Database Configuration
DATABASE_URL=sqlite:///tmp/auth_dev.db
# or PostgreSQL: postgresql://user:pass@localhost:5432/auth_dev

# Redis Configuration (optional for development)
REDIS_URL=redis://localhost:6379/0

# Security Configuration
JWT_SECRET=dev-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# Session Configuration
SESSION_SECRET=dev-session-secret
SESSION_DOMAIN=localhost
SESSION_SECURE=false
SESSION_MAX_AGE=900000

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-dev-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-dev-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v2/auth/google/callback

# Microsoft Configuration
MICROSOFT_CLIENT_ID=your-dev-client-id
MICROSOFT_CLIENT_SECRET=your-dev-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v2/auth/microsoft/callback

# SAML Configuration (optional)
SAML_ENABLED=false
SAML_ENTRY_POINT=https://dev-idp.example.com/sso
SAML_ISSUER=mainframe-ai-dev
SAML_CALLBACK_URL=http://localhost:3000/api/v2/auth/saml/callback

# Security Settings (relaxed for development)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
ENABLE_RATE_LIMITING=false

# Logging Configuration
LOG_LEVEL=debug
LOG_FORMAT=dev
ENABLE_REQUEST_LOGGING=true

# Feature Flags
ENABLE_MFA=false
ENABLE_AUDIT_LOGGING=true
ENABLE_TOKEN_ROTATION=true
```

### Staging Environment

```bash
# .env.staging
NODE_ENV=staging

# Server Configuration
PORT=3000
HOST=0.0.0.0
API_BASE_URL=https://staging-api.yourapp.com

# Database Configuration
DATABASE_URL=postgresql://auth_user:secure_password@staging-db.internal:5432/auth_staging
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

# Redis Configuration
REDIS_URL=redis://staging-cache.internal:6379/0
REDIS_PASSWORD=staging-redis-password

# Security Configuration (Production-like)
JWT_SECRET=staging-jwt-secret-32-chars-minimum
JWT_ALGORITHM=RS256
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=staging-session-secret-32-chars-min
SESSION_DOMAIN=.yourapp.com
SESSION_SECURE=true
SESSION_MAX_AGE=900000

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-staging-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-staging-client-secret
GOOGLE_REDIRECT_URI=https://staging.yourapp.com/api/v2/auth/google/callback

# Microsoft Configuration
MICROSOFT_CLIENT_ID=your-staging-client-id
MICROSOFT_CLIENT_SECRET=your-staging-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_REDIRECT_URI=https://staging.yourapp.com/api/v2/auth/microsoft/callback

# SAML Configuration
SAML_ENABLED=true
SAML_ENTRY_POINT=https://staging-idp.example.com/sso
SAML_ISSUER=mainframe-ai-staging
SAML_CALLBACK_URL=https://staging.yourapp.com/api/v2/auth/saml/callback
SAML_CERT_PATH=/app/certs/saml-staging.crt
SAML_PRIVATE_KEY_PATH=/app/certs/saml-staging.key

# Security Settings
CORS_ORIGIN=https://staging.yourapp.com,https://staging-admin.yourapp.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=20
ENABLE_RATE_LIMITING=true

# Monitoring
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=false
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true

# Feature Flags
ENABLE_MFA=true
ENABLE_AUDIT_LOGGING=true
ENABLE_TOKEN_ROTATION=true
ENABLE_SECURITY_HEADERS=true
```

### Production Environment

```bash
# .env.production
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=0.0.0.0
API_BASE_URL=https://api.yourapp.com
CLUSTER_MODE=true
CLUSTER_WORKERS=0  # Use all available CPUs

# Database Configuration
DATABASE_URL=postgresql://auth_user:ultra_secure_password@prod-db-cluster.internal:5432/auth_production
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=50
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# Redis Cluster Configuration
REDIS_CLUSTER_NODES=prod-cache-1.internal:7000,prod-cache-2.internal:7000,prod-cache-3.internal:7000
REDIS_PASSWORD=production-redis-password
REDIS_TLS=true

# Security Configuration
JWT_SECRET=production-jwt-secret-64-chars-ultra-secure-key-here
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/app/certs/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/app/certs/jwt-public.pem
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=production-session-secret-64-chars-ultra-secure
SESSION_DOMAIN=.yourapp.com
SESSION_SECURE=true
SESSION_SAME_SITE=strict
SESSION_MAX_AGE=900000
SESSION_STORE=redis

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_REDIRECT_URI=https://yourapp.com/api/v2/auth/google/callback

# Microsoft Configuration
MICROSOFT_CLIENT_ID=your-production-client-id
MICROSOFT_CLIENT_SECRET=your-production-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_REDIRECT_URI=https://yourapp.com/api/v2/auth/microsoft/callback

# SAML Configuration
SAML_ENABLED=true
SAML_ENTRY_POINT=https://idp.yourcompany.com/sso
SAML_ISSUER=mainframe-ai-production
SAML_CALLBACK_URL=https://yourapp.com/api/v2/auth/saml/callback
SAML_CERT_PATH=/app/certs/saml-production.crt
SAML_PRIVATE_KEY_PATH=/app/certs/saml-production.key

# Security Settings (Strict)
CORS_ORIGIN=https://yourapp.com,https://admin.yourapp.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=10
ENABLE_RATE_LIMITING=true
ENABLE_BRUTEFORCE_PROTECTION=true

# Monitoring and Logging
LOG_LEVEL=warn
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=false
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
APM_SERVICE_NAME=mainframe-ai-auth
APM_SECRET_TOKEN=your-apm-secret

# Feature Flags (Production)
ENABLE_MFA=true
ENABLE_AUDIT_LOGGING=true
ENABLE_TOKEN_ROTATION=true
ENABLE_SECURITY_HEADERS=true
ENABLE_CONTENT_SECURITY_POLICY=true

# Backup and Recovery
DATABASE_BACKUP_ENABLED=true
DATABASE_BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30

# Performance Optimization
ENABLE_COMPRESSION=true
ENABLE_HTTP2=true
CACHE_STATIC_ASSETS=true
ENABLE_PREFLIGHT_CACHE=true
```

## 🏗️ Application Configuration Files

### Main Configuration Module

```javascript
// config/index.js
const path = require('path');

// Load environment variables
require('dotenv').config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
    baseUrl: process.env.API_BASE_URL,
    clusterMode: process.env.CLUSTER_MODE === 'true',
    workers: parseInt(process.env.CLUSTER_WORKERS, 10) || 0
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN, 10) || 0,
      max: parseInt(process.env.DATABASE_POOL_MAX, 10) || 10
    },
    ssl: process.env.DATABASE_SSL === 'true',
    logging: process.env.DATABASE_LOGGING === 'true'
  },

  // Cache (Redis)
  cache: {
    url: process.env.REDIS_URL,
    cluster: process.env.REDIS_CLUSTER_NODES?.split(','),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
    keyPrefix: 'auth:',
    ttl: {
      session: 15 * 60, // 15 minutes
      token: 15 * 60,   // 15 minutes
      user: 60 * 60     // 1 hour
    }
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH,

    // Additional options
    issuer: process.env.JWT_ISSUER || 'mainframe-ai',
    audience: process.env.JWT_AUDIENCE || 'mainframe-ai-users'
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET,
    domain: process.env.SESSION_DOMAIN,
    secure: process.env.SESSION_SECURE === 'true',
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 900000,
    store: process.env.SESSION_STORE || 'memory'
  },

  // OAuth Providers
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      scopes: ['openid', 'profile', 'email']
    },

    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      scopes: ['openid', 'profile', 'email', 'User.Read']
    },

    saml: {
      enabled: process.env.SAML_ENABLED === 'true',
      entryPoint: process.env.SAML_ENTRY_POINT,
      issuer: process.env.SAML_ISSUER,
      callbackUrl: process.env.SAML_CALLBACK_URL,
      cert: process.env.SAML_CERT_PATH,
      privateKey: process.env.SAML_PRIVATE_KEY_PATH
    }
  },

  // Security Configuration
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },

    rateLimit: {
      enabled: process.env.ENABLE_RATE_LIMITING === 'true',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 900000,
      max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
      skipSuccessfulRequests: true
    },

    headers: {
      enabled: process.env.ENABLE_SECURITY_HEADERS === 'true',
      contentSecurityPolicy: process.env.ENABLE_CONTENT_SECURITY_POLICY === 'true'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    requestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true'
  },

  // Feature Flags
  features: {
    mfa: process.env.ENABLE_MFA === 'true',
    auditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
    tokenRotation: process.env.ENABLE_TOKEN_ROTATION === 'true',
    bruteforceProtection: process.env.ENABLE_BRUTEFORCE_PROTECTION === 'true'
  },

  // Monitoring
  monitoring: {
    metrics: process.env.METRICS_ENABLED === 'true',
    healthCheck: process.env.HEALTH_CHECK_ENABLED === 'true',
    apm: {
      serviceName: process.env.APM_SERVICE_NAME,
      secretToken: process.env.APM_SECRET_TOKEN
    }
  }
};

// Validation
function validateConfig() {
  const required = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'DATABASE_URL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT configuration
  if (config.jwt.algorithm.startsWith('RS') && !config.jwt.privateKeyPath) {
    throw new Error('Private key path required for RS256 algorithm');
  }

  // Validate OAuth configuration
  if (!config.providers.google.clientId && !config.providers.microsoft.clientId) {
    console.warn('Warning: No OAuth providers configured');
  }
}

// Run validation in production
if (config.isProduction) {
  validateConfig();
}

module.exports = config;
```

### Database Configuration

```javascript
// config/database.js
const { Pool } = require('pg');
const config = require('./index');

// Database connection configuration
const dbConfig = {
  connectionString: config.database.url,
  ssl: config.database.ssl ? {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,

  // Connection pool settings
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // Query timeout
  query_timeout: 30000,

  // Keep alive settings for long-running connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool events
pool.on('connect', (client) => {
  console.log('Database client connected');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
  process.exit(-1);
});

// Export pool and helper functions
module.exports = {
  pool,

  // Query helper with error handling
  query: async (text, params) => {
    const start = Date.now();

    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;

      if (config.logging.level === 'debug') {
        console.log('Executed query', { text, duration, rows: result.rowCount });
      }

      return result;
    } catch (error) {
      console.error('Database query error:', { text, error: error.message });
      throw error;
    }
  },

  // Transaction helper
  transaction: async (callback) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Close pool gracefully
  close: () => {
    return pool.end();
  }
};
```

### Redis Configuration

```javascript
// config/redis.js
const Redis = require('ioredis');
const config = require('./index');

let redisClient;

// Create Redis client based on configuration
function createRedisClient() {
  const options = {
    keyPrefix: config.cache.keyPrefix,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  };

  if (config.cache.password) {
    options.password = config.cache.password;
  }

  if (config.cache.tls) {
    options.tls = {};
  }

  // Cluster mode
  if (config.cache.cluster && config.cache.cluster.length > 0) {
    const clusterNodes = config.cache.cluster.map(node => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port, 10) };
    });

    redisClient = new Redis.Cluster(clusterNodes, {
      redisOptions: options,
      scaleReads: 'slave'
    });
  } else {
    // Single instance
    redisClient = new Redis(config.cache.url, options);
  }

  // Event handlers
  redisClient.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redisClient.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  redisClient.on('ready', () => {
    console.log('Redis client ready');
  });

  redisClient.on('close', () => {
    console.log('Redis connection closed');
  });

  return redisClient;
}

// Initialize client
redisClient = createRedisClient();

// Cache helper functions
const cache = {
  // Get value with JSON parsing
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  // Set value with JSON stringification and TTL
  async set(key, value, ttl = config.cache.ttl.default) {
    try {
      const serialized = JSON.stringify(value);

      if (ttl) {
        return await redisClient.setex(key, ttl, serialized);
      } else {
        return await redisClient.set(key, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  // Delete key
  async del(key) {
    try {
      return await redisClient.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  // Set expiration
  async expire(key, seconds) {
    try {
      return await redisClient.expire(key, seconds);
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  },

  // Increment counter with TTL
  async incr(key, ttl) {
    try {
      const count = await redisClient.incr(key);

      if (count === 1 && ttl) {
        await redisClient.expire(key, ttl);
      }

      return count;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }
};

module.exports = {
  client: redisClient,
  cache
};
```

## 🐳 Docker Configuration

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://auth_user:auth_pass@postgres:5432/auth_dev
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis
    networks:
      - auth-network

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: auth_dev
      POSTGRES_USER: auth_user
      POSTGRES_PASSWORD: auth_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - auth-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - auth-network

  # Optional: Database management
  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - auth-network

volumes:
  postgres_data:
  redis_data:

networks:
  auth-network:
    driver: bridge
```

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: mainframe-ai/sso-service:latest
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
    environment:
      - NODE_ENV=production
      - DATABASE_URL_FILE=/run/secrets/database_url
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - SESSION_SECRET_FILE=/run/secrets/session_secret
    secrets:
      - database_url
      - jwt_secret
      - session_secret
      - ssl_cert
      - ssl_key
    networks:
      - auth-network
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Host(`auth.yourapp.com`)"
      - "traefik.http.routers.auth.tls=true"
      - "traefik.http.routers.auth.tls.certresolver=le"

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
    command: redis-server --appendonly yes --cluster-enabled yes
    volumes:
      - redis_data:/data
    networks:
      - auth-network

secrets:
  database_url:
    external: true
  jwt_secret:
    external: true
  session_secret:
    external: true
  ssl_cert:
    external: true
  ssl_key:
    external: true

volumes:
  redis_data:
    driver: local

networks:
  auth-network:
    driver: overlay
    attachable: true
  traefik-network:
    external: true
```

## 🔧 Kubernetes Configuration

### Deployment Configuration

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sso-service
  namespace: auth
  labels:
    app: sso-service
    version: v2.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: sso-service
  template:
    metadata:
      labels:
        app: sso-service
        version: v2.0.0
    spec:
      serviceAccountName: sso-service
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000

      containers:
      - name: sso-service
        image: mainframe-ai/sso-service:v2.0.0
        imagePullPolicy: IfNotPresent

        ports:
        - containerPort: 3000
          name: http
          protocol: TCP

        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-credentials
              key: secret
        - name: REDIS_URL
          value: "redis://redis-cluster:6379/0"

        envFrom:
        - configMapRef:
            name: sso-config
        - secretRef:
            name: oauth-credentials

        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3

        volumeMounts:
        - name: jwt-keys
          mountPath: /app/certs
          readOnly: true

      volumes:
      - name: jwt-keys
        secret:
          secretName: jwt-keys
          defaultMode: 0400

      imagePullSecrets:
      - name: docker-registry-secret
```

### ConfigMap

```yaml
# k8s/configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sso-config
  namespace: auth
data:
  # Server Configuration
  HOST: "0.0.0.0"
  API_BASE_URL: "https://api.yourapp.com"

  # JWT Configuration
  JWT_ALGORITHM: "RS256"
  JWT_EXPIRES_IN: "15m"
  JWT_ISSUER: "mainframe-ai"
  JWT_AUDIENCE: "mainframe-ai-users"
  JWT_PRIVATE_KEY_PATH: "/app/certs/jwt-private.pem"
  JWT_PUBLIC_KEY_PATH: "/app/certs/jwt-public.pem"

  # Session Configuration
  SESSION_DOMAIN: ".yourapp.com"
  SESSION_SECURE: "true"
  SESSION_SAME_SITE: "strict"
  SESSION_MAX_AGE: "900000"
  SESSION_STORE: "redis"

  # Security Configuration
  CORS_ORIGIN: "https://yourapp.com,https://admin.yourapp.com"
  ENABLE_RATE_LIMITING: "true"
  RATE_LIMIT_WINDOW: "900000"
  RATE_LIMIT_MAX: "10"
  ENABLE_SECURITY_HEADERS: "true"

  # Feature Flags
  ENABLE_MFA: "true"
  ENABLE_AUDIT_LOGGING: "true"
  ENABLE_TOKEN_ROTATION: "true"

  # Logging
  LOG_LEVEL: "warn"
  LOG_FORMAT: "json"
  ENABLE_REQUEST_LOGGING: "false"

  # Monitoring
  METRICS_ENABLED: "true"
  HEALTH_CHECK_ENABLED: "true"
```

### Secrets

```yaml
# k8s/secrets.yml
apiVersion: v1
kind: Secret
metadata:
  name: oauth-credentials
  namespace: auth
type: Opaque
data:
  GOOGLE_CLIENT_ID: <base64-encoded-value>
  GOOGLE_CLIENT_SECRET: <base64-encoded-value>
  MICROSOFT_CLIENT_ID: <base64-encoded-value>
  MICROSOFT_CLIENT_SECRET: <base64-encoded-value>

---
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
  namespace: auth
type: Opaque
data:
  url: <base64-encoded-database-url>

---
apiVersion: v1
kind: Secret
metadata:
  name: jwt-credentials
  namespace: auth
type: Opaque
data:
  secret: <base64-encoded-jwt-secret>

---
apiVersion: v1
kind: Secret
metadata:
  name: jwt-keys
  namespace: auth
type: Opaque
data:
  jwt-private.pem: <base64-encoded-private-key>
  jwt-public.pem: <base64-encoded-public-key>
```

## 🏭 Helm Chart Configuration

### Values File

```yaml
# helm/values.yml
replicaCount: 3

image:
  repository: mainframe-ai/sso-service
  tag: "v2.0.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "10"
  hosts:
    - host: auth.yourapp.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: auth-tls
      hosts:
        - auth.yourapp.com

config:
  nodeEnv: production
  logLevel: warn
  enableMFA: true
  enableAuditLogging: true

database:
  host: postgres-cluster
  port: 5432
  name: auth_production
  sslMode: require

redis:
  enabled: true
  cluster:
    enabled: true
    nodes: 3

oauth:
  google:
    enabled: true
  microsoft:
    enabled: true
  saml:
    enabled: true

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

nodeSelector:
  kubernetes.io/arch: amd64

tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - sso-service
        topologyKey: kubernetes.io/hostname
```

---

**Next Steps**: Review [Migration Guides](../migration/) for transitioning from legacy authentication systems or [Performance Tuning](../performance/) for optimization strategies.