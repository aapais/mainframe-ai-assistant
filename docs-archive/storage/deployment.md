# Storage Service Deployment and Configuration Guide

## Table of Contents
1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [Configuration Management](#configuration-management)
4. [Deployment Strategies](#deployment-strategies)
5. [Database Setup](#database-setup)
6. [Security Configuration](#security-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup and Recovery](#backup-and-recovery)
9. [High Availability](#high-availability)
10. [Performance Tuning](#performance-tuning)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance Procedures](#maintenance-procedures)

## Overview

This guide provides comprehensive instructions for deploying and configuring the Mainframe AI Assistant storage service across different environments and MVP phases. The deployment strategy evolves from simple desktop deployment (MVP1) to enterprise-grade distributed systems (MVP5).

### Deployment Progression by MVP

| MVP | Deployment Type | Target Users | Infrastructure |
|-----|----------------|--------------|----------------|
| MVP1 | Desktop Application | 5-10 users | Single machine, SQLite |
| MVP2 | Desktop + Optional Server | 20-30 users | Local + Optional shared DB |
| MVP3 | Team Deployment | 50-100 users | Shared database, centralized |
| MVP4 | Department Scale | 100+ users | PostgreSQL, load balancing |
| MVP5 | Enterprise Platform | 500+ users | Distributed, high availability |

## Environment Setup

### Development Environment

#### Prerequisites

```bash
# Required software versions
Node.js >= 18.0.0
npm >= 8.0.0
Git >= 2.30.0
SQLite >= 3.35.0
PostgreSQL >= 13.0 (MVP4+)
Docker >= 20.10.0 (optional)
```

#### Development Setup Script

```bash
#!/bin/bash
# setup-dev.sh - Development environment setup

set -e

echo "Setting up Mainframe AI Assistant development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Git is required but not installed. Aborting." >&2; exit 1; }

# Clone repository
if [ ! -d "mainframe-ai-assistant" ]; then
    git clone https://github.com/your-org/mainframe-ai-assistant.git
    cd mainframe-ai-assistant
else
    cd mainframe-ai-assistant
    git pull origin main
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup environment variables
cp .env.example .env.development
echo "Please edit .env.development with your configuration"

# Initialize database
echo "Initializing development database..."
npm run db:init:dev

# Run initial setup
npm run setup:dev

echo "Development environment setup complete!"
echo "Run 'npm run dev' to start the application"
```

#### Environment Variables

```bash
# .env.development
# Application Configuration
NODE_ENV=development
APP_VERSION=1.0.0
LOG_LEVEL=debug

# Database Configuration
DB_TYPE=sqlite
DB_PATH=./data/knowledge.db
DB_BACKUP_ENABLED=true
DB_BACKUP_INTERVAL=3600000

# Cache Configuration
CACHE_ENABLED=true
CACHE_TYPE=memory
CACHE_TTL=300
CACHE_MAX_SIZE=100

# AI Service Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-pro
GEMINI_TIMEOUT=5000
AI_FALLBACK_ENABLED=true

# Performance Configuration
SEARCH_MAX_RESULTS=50
SEARCH_TIMEOUT=10000
PERFORMANCE_MONITORING=true

# Security Configuration
AUTH_ENABLED=false
SESSION_SECRET=development_secret_key
CORS_ENABLED=true
CORS_ORIGINS=http://localhost:3000

# Feature Flags
FEATURE_PATTERN_DETECTION=false
FEATURE_CODE_ANALYSIS=false
FEATURE_AI_SUGGESTIONS=true
FEATURE_ANALYTICS=true
```

### Production Environment

#### Production Setup Script

```bash
#!/bin/bash
# deploy-production.sh - Production deployment script

set -e

ENV=${1:-production}
VERSION=${2:-latest}

echo "Deploying Mainframe AI Assistant to $ENV environment..."

# Validate environment
if [ "$ENV" != "production" ] && [ "$ENV" != "staging" ]; then
    echo "Invalid environment. Use 'production' or 'staging'"
    exit 1
fi

# Check production prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required for production deployment" >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required" >&2; exit 1; }

# Create deployment directory
DEPLOY_DIR="/opt/mainframe-ai-assistant"
sudo mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Download deployment files
wget -O docker-compose.yml "https://releases.example.com/$VERSION/docker-compose.yml"
wget -O .env "https://releases.example.com/$VERSION/.env.$ENV"

# Validate configuration
docker-compose config

# Create data directories
sudo mkdir -p ./data/db ./data/backups ./data/logs ./data/cache

# Set permissions
sudo chown -R 1000:1000 ./data

# Start services
docker-compose up -d

# Verify deployment
sleep 30
docker-compose ps
docker-compose logs --tail=50

echo "Production deployment complete!"
echo "Access the application at: https://your-domain.com"
```

## Configuration Management

### Configuration Structure

```typescript
// src/config/ConfigManager.ts
export interface AppConfig {
  app: AppSettings;
  database: DatabaseConfig;
  cache: CacheConfig;
  ai: AIConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  features: FeatureFlags;
}

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  
  constructor(environment: string = 'development') {
    this.configPath = this.resolveConfigPath(environment);
    this.loadConfiguration();
    this.validateConfiguration();
  }
  
  private loadConfiguration(): void {
    const envConfig = this.loadFromEnv();
    const fileConfig = this.loadFromFile();
    const defaultConfig = this.getDefaultConfig();
    
    // Merge configurations (env > file > defaults)
    this.config = this.mergeConfigs(defaultConfig, fileConfig, envConfig);
  }
  
  private validateConfiguration(): void {
    const validator = new ConfigValidator();
    const errors = validator.validate(this.config);
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
  
  get database(): DatabaseConfig {
    return this.config.database;
  }
  
  get cache(): CacheConfig {
    return this.config.cache;
  }
  
  get ai(): AIConfig {
    return this.config.ai;
  }
  
  // Hot reload for development
  watchForChanges(): void {
    if (process.env.NODE_ENV !== 'development') return;
    
    fs.watchFile(this.configPath, () => {
      console.log('Configuration file changed, reloading...');
      this.loadConfiguration();
      this.emit('config-changed', this.config);
    });
  }
}
```

### Configuration Templates

#### MVP1 Configuration

```yaml
# config/mvp1.yml
app:
  name: "Mainframe KB Assistant"
  version: "1.0.0"
  environment: "production"
  log_level: "info"

database:
  type: "sqlite"
  path: "./data/knowledge.db"
  backup:
    enabled: true
    interval: "1h"
    retention: "30d"

cache:
  enabled: true
  type: "memory"
  max_size: 50
  ttl: 300

ai:
  provider: "gemini"
  model: "gemini-pro"
  timeout: 5000
  fallback_enabled: true
  rate_limit:
    requests_per_minute: 60

security:
  auth_enabled: false
  encryption_at_rest: false
  cors:
    enabled: true
    origins: ["*"]

features:
  pattern_detection: false
  code_analysis: false
  ai_suggestions: true
  analytics: true
  auto_resolution: false

monitoring:
  metrics_enabled: true
  health_checks: true
  log_retention: "7d"
```

#### MVP5 Configuration

```yaml
# config/mvp5.yml
app:
  name: "Mainframe AI Platform"
  version: "5.0.0"
  environment: "production"
  log_level: "warn"
  cluster:
    enabled: true
    nodes: 3
    load_balancer: true

database:
  type: "postgresql"
  primary:
    host: "postgres-primary.example.com"
    port: 5432
    database: "mainframe_ai"
    ssl: true
    pool:
      min: 10
      max: 100
  replica:
    host: "postgres-replica.example.com"
    read_only: true
  backup:
    enabled: true
    interval: "15m"
    retention: "90d"
    compression: true

cache:
  enabled: true
  type: "redis"
  cluster:
    nodes:
      - "redis-1.example.com:6379"
      - "redis-2.example.com:6379" 
      - "redis-3.example.com:6379"
  ttl: 3600
  max_memory: "2GB"

ai:
  primary_provider: "gemini"
  fallback_provider: "azure"
  models:
    - name: "gemini-pro"
      tasks: ["search", "analysis"]
    - name: "gemini-ultra"
      tasks: ["complex_reasoning"]
  rate_limit:
    requests_per_minute: 1000
  circuit_breaker:
    enabled: true
    threshold: 10
    timeout: 30000

security:
  auth_enabled: true
  sso:
    provider: "azure_ad"
    tenant_id: "your-tenant-id"
  rbac:
    enabled: true
    roles: ["admin", "user", "readonly"]
  encryption:
    at_rest: true
    in_transit: true
    key_rotation: "30d"
  cors:
    enabled: true
    origins: ["https://mainframe.example.com"]

features:
  pattern_detection: true
  code_analysis: true
  ai_suggestions: true
  analytics: true
  auto_resolution: true
  predictive_analytics: true
  ml_training: true

monitoring:
  metrics_enabled: true
  alerting:
    enabled: true
    channels: ["email", "slack", "pagerduty"]
  tracing:
    enabled: true
    sampling_rate: 0.1
  health_checks:
    interval: "30s"
    timeout: "5s"
  log_retention: "90d"
```

## Deployment Strategies

### MVP1: Desktop Deployment

#### Electron App Packaging

```json
// package.json - Build configuration
{
  "build": {
    "appId": "com.company.mainframe-kb",
    "productName": "Mainframe KB Assistant",
    "directories": {
      "output": "dist"
    },
    "files": [
      "build/**/*",
      "node_modules/**/*",
      "assets/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

#### Build Script

```bash
#!/bin/bash
# build-mvp1.sh - Build desktop application

set -e

echo "Building Mainframe KB Assistant for MVP1..."

# Clean previous builds
rm -rf dist build

# Install dependencies
npm ci --production=false

# Run tests
npm test

# Build renderer process
npm run build:renderer

# Build main process
npm run build:main

# Package for all platforms
npm run build:win
npm run build:mac
npm run build:linux

echo "Build complete! Artifacts in dist/ directory"
```

### MVP2-3: Team Deployment

#### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

# Create data directory
RUN mkdir -p /app/data && chown appuser:nodejs /app/data

USER appuser

EXPOSE 3000

CMD ["node", "dist/main/index.js"]
```

```yaml
# docker-compose.yml - MVP2/3 deployment
version: '3.8'

services:
  mainframe-ai:
    image: mainframe-ai:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_TYPE=sqlite
      - DB_PATH=/app/data/knowledge.db
    volumes:
      - ./data:/app/data
      - ./config:/app/config:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "dist/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  backup:
    image: alpine:latest
    volumes:
      - ./data:/data:ro
      - ./backups:/backups
    command: |
      sh -c "
        while true; do
          tar -czf /backups/backup-$(date +%Y%m%d_%H%M%S).tar.gz /data
          find /backups -name '*.tar.gz' -mtime +7 -delete
          sleep 3600
        done
      "
    restart: unless-stopped
```

### MVP4-5: Enterprise Deployment

#### Kubernetes Deployment

```yaml
# k8s/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: mainframe-ai
  labels:
    name: mainframe-ai
    environment: production
```

```yaml
# k8s/configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mainframe-ai-config
  namespace: mainframe-ai
data:
  config.yml: |
    app:
      name: "Mainframe AI Platform"
      version: "5.0.0"
      environment: "production"
    database:
      type: "postgresql"
      host: "postgres-service"
      port: "5432"
    cache:
      type: "redis"
      host: "redis-service"
      port: "6379"
```

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mainframe-ai
  namespace: mainframe-ai
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
        image: mainframe-ai:5.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
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
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: mainframe-ai-config
```

```yaml
# k8s/service.yml
apiVersion: v1
kind: Service
metadata:
  name: mainframe-ai-service
  namespace: mainframe-ai
spec:
  selector:
    app: mainframe-ai
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

```yaml
# k8s/ingress.yml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mainframe-ai-ingress
  namespace: mainframe-ai
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - mainframe.example.com
    secretName: mainframe-ai-tls
  rules:
  - host: mainframe.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mainframe-ai-service
            port:
              number: 80
```

## Database Setup

### SQLite Setup (MVP1-3)

```typescript
// src/database/SQLiteSetup.ts
export class SQLiteSetup {
  static async initialize(dbPath: string): Promise<void> {
    const db = new Database(dbPath);
    
    try {
      // Configure SQLite for optimal performance
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -64000'); // 64MB cache
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 268435456'); // 256MB mmap
      
      // Create schema
      await this.createSchema(db);
      
      // Create indexes
      await this.createIndexes(db);
      
      // Load initial data
      await this.loadInitialData(db);
      
      console.log('SQLite database initialized successfully');
    } finally {
      db.close();
    }
  }
  
  private static async createSchema(db: Database): Promise<void> {
    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'), 
      'utf8'
    );
    db.exec(schema);
  }
  
  private static async createIndexes(db: Database): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_kb_category ON kb_entries(category)',
      'CREATE INDEX IF NOT EXISTS idx_kb_usage ON kb_entries(usage_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_tags ON kb_tags(tag)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_entry ON kb_tags(entry_id, tag)'
    ];
    
    indexes.forEach(sql => db.exec(sql));
  }
}
```

### PostgreSQL Setup (MVP4-5)

```sql
-- database/postgresql/init.sql
-- PostgreSQL initialization script

-- Create database
CREATE DATABASE mainframe_ai 
WITH 
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8'
  TEMPLATE template0;

-- Connect to the database
\c mainframe_ai;

-- Create application user
CREATE USER mainframe_ai_app WITH PASSWORD 'secure_password_here';

-- Create schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS ml;

-- Grant permissions
GRANT USAGE ON SCHEMA app TO mainframe_ai_app;
GRANT CREATE ON SCHEMA app TO mainframe_ai_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO mainframe_ai_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO mainframe_ai_app;

-- Configure database settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

```typescript
// src/database/PostgreSQLSetup.ts
export class PostgreSQLSetup {
  static async initialize(config: DatabaseConfig): Promise<void> {
    const client = new Client(config);
    
    try {
      await client.connect();
      
      // Check if database exists
      const dbExists = await this.checkDatabaseExists(client, config.database);
      
      if (!dbExists) {
        await this.createDatabase(client, config.database);
      }
      
      // Connect to application database
      await client.end();
      const appClient = new Client({
        ...config,
        database: config.database
      });
      
      await appClient.connect();
      
      // Run migrations
      await this.runMigrations(appClient);
      
      // Create indexes
      await this.createIndexes(appClient);
      
      // Setup monitoring
      await this.setupMonitoring(appClient);
      
      console.log('PostgreSQL database initialized successfully');
    } finally {
      await client.end();
    }
  }
  
  private static async runMigrations(client: Client): Promise<void> {
    const migrationFiles = fs.readdirSync('./database/migrations')
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      const migration = fs.readFileSync(
        path.join('./database/migrations', file),
        'utf8'
      );
      
      await client.query(migration);
      console.log(`Applied migration: ${file}`);
    }
  }
}
```

## Security Configuration

### Authentication and Authorization

```typescript
// src/security/AuthManager.ts
export class AuthManager {
  private jwtSecret: string;
  private ssoProvider?: SSOProvider;
  
  constructor(config: SecurityConfig) {
    this.jwtSecret = config.jwtSecret;
    
    if (config.sso?.enabled) {
      this.ssoProvider = this.createSSOProvider(config.sso);
    }
  }
  
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    if (this.ssoProvider) {
      return this.authenticateSSO(credentials);
    }
    
    return this.authenticateLocal(credentials);
  }
  
  private async authenticateSSO(credentials: Credentials): Promise<AuthResult> {
    try {
      const ssoResult = await this.ssoProvider!.authenticate(credentials);
      
      if (ssoResult.success) {
        const token = this.generateJWT(ssoResult.user);
        return {
          success: true,
          token,
          user: ssoResult.user,
          expiresIn: 3600
        };
      }
      
      return { success: false, error: 'SSO authentication failed' };
    } catch (error) {
      console.error('SSO authentication error:', error);
      return { success: false, error: 'Authentication service unavailable' };
    }
  }
  
  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      return null;
    }
  }
  
  authorize(user: User, resource: string, action: string): boolean {
    const userRoles = user.roles || [];
    const permissions = this.getPermissions(userRoles);
    
    return permissions.some(permission => 
      permission.resource === resource && 
      permission.actions.includes(action)
    );
  }
}
```

### Data Encryption

```typescript
// src/security/EncryptionManager.ts
export class EncryptionManager {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  
  async encryptData(data: string, key?: string): Promise<EncryptedData> {
    const encryptionKey = key ? Buffer.from(key, 'hex') : await this.generateKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(this.algorithm, encryptionKey);
    cipher.setAAD(Buffer.from('mainframe-ai', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm
    };
  }
  
  async decryptData(encryptedData: EncryptedData, key: string): Promise<string> {
    const decryptionKey = Buffer.from(key, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipher(this.algorithm, decryptionKey);
    decipher.setAAD(Buffer.from('mainframe-ai', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  async generateKey(): Promise<Buffer> {
    return crypto.randomBytes(this.keyLength);
  }
}
```

## Monitoring Setup

### Health Checks

```typescript
// src/monitoring/HealthChecker.ts
export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();
  
  registerCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }
  
  async runHealthChecks(): Promise<HealthReport> {
    const results = new Map<string, HealthCheckResult>();
    
    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          check.execute(),
          this.timeout(check.timeout || 5000)
        ]);
        
        results.set(name, {
          status: result ? 'healthy' : 'unhealthy',
          duration: Date.now() - startTime,
          details: result
        });
      } catch (error) {
        results.set(name, {
          status: 'error',
          duration: 0,
          error: error.message
        });
      }
    }
    
    const overallStatus = Array.from(results.values()).every(r => r.status === 'healthy') 
      ? 'healthy' 
      : 'unhealthy';
    
    return {
      status: overallStatus,
      timestamp: new Date(),
      checks: Object.fromEntries(results)
    };
  }
  
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }
}

// Register health checks
const healthChecker = new HealthChecker();

healthChecker.registerCheck('database', {
  timeout: 5000,
  execute: async () => {
    const result = await db.query('SELECT 1');
    return result.rows.length > 0;
  }
});

healthChecker.registerCheck('cache', {
  timeout: 3000,
  execute: async () => {
    await cache.set('health-check', 'ok', 10);
    const value = await cache.get('health-check');
    return value === 'ok';
  }
});

healthChecker.registerCheck('ai-service', {
  timeout: 10000,
  execute: async () => {
    const response = await aiService.healthCheck();
    return response.status === 'ok';
  }
});
```

### Metrics Collection

```typescript
// src/monitoring/MetricsCollector.ts
export class MetricsCollector {
  private metrics = new Map<string, Metric>();
  private prometheus: PromClient;
  
  constructor() {
    this.prometheus = PromClient;
    this.setupDefaultMetrics();
  }
  
  private setupDefaultMetrics(): void {
    // Application metrics
    this.createHistogram('search_duration_seconds', 'Search operation duration');
    this.createCounter('search_total', 'Total search operations');
    this.createGauge('kb_entries_total', 'Total knowledge base entries');
    this.createHistogram('db_query_duration_seconds', 'Database query duration');
    
    // System metrics
    this.createGauge('process_memory_bytes', 'Process memory usage');
    this.createGauge('process_cpu_percent', 'Process CPU usage');
    
    // Business metrics
    this.createCounter('incidents_resolved_total', 'Total incidents resolved');
    this.createHistogram('resolution_time_seconds', 'Time to resolve incidents');
    this.createGauge('user_satisfaction_score', 'User satisfaction score');
  }
  
  recordSearchOperation(duration: number, success: boolean): void {
    this.getHistogram('search_duration_seconds').observe(duration / 1000);
    this.getCounter('search_total').inc({ status: success ? 'success' : 'error' });
  }
  
  recordIncidentResolution(resolutionTime: number, automated: boolean): void {
    this.getCounter('incidents_resolved_total').inc({ 
      type: automated ? 'automated' : 'manual' 
    });
    this.getHistogram('resolution_time_seconds').observe(resolutionTime / 1000);
  }
  
  getMetrics(): string {
    return this.prometheus.register.metrics();
  }
}
```

## Backup and Recovery

### Automated Backup System

```typescript
// src/backup/BackupManager.ts
export class BackupManager {
  private config: BackupConfig;
  private storage: BackupStorage;
  
  constructor(config: BackupConfig) {
    this.config = config;
    this.storage = this.createStorage(config.storage);
  }
  
  async scheduleBackups(): Promise<void> {
    const schedule = cron.schedule(this.config.schedule, async () => {
      await this.performBackup();
    });
    
    console.log(`Backup scheduled: ${this.config.schedule}`);
  }
  
  private async performBackup(): Promise<void> {
    const backupId = `backup_${Date.now()}`;
    
    try {
      console.log(`Starting backup: ${backupId}`);
      
      // Create backup
      const backupData = await this.createBackup();
      
      // Compress if enabled
      const finalData = this.config.compression 
        ? await this.compress(backupData)
        : backupData;
      
      // Store backup
      await this.storage.store(backupId, finalData);
      
      // Update backup registry
      await this.updateBackupRegistry(backupId);
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      console.log(`Backup completed: ${backupId}`);
    } catch (error) {
      console.error(`Backup failed: ${backupId}`, error);
      throw error;
    }
  }
  
  private async createBackup(): Promise<BackupData> {
    const backup: BackupData = {
      timestamp: new Date(),
      version: process.env.APP_VERSION || '1.0.0',
      database: await this.backupDatabase(),
      config: await this.backupConfiguration(),
      logs: await this.backupLogs(),
      metadata: {
        size: 0,
        checksum: ''
      }
    };
    
    // Calculate metadata
    const serialized = JSON.stringify(backup);
    backup.metadata.size = Buffer.byteLength(serialized);
    backup.metadata.checksum = crypto
      .createHash('sha256')
      .update(serialized)
      .digest('hex');
    
    return backup;
  }
  
  async restoreFromBackup(backupId: string): Promise<void> {
    console.log(`Starting restore from backup: ${backupId}`);
    
    try {
      // Download backup
      const backupData = await this.storage.retrieve(backupId);
      
      // Decompress if needed
      const decompressed = this.config.compression
        ? await this.decompress(backupData)
        : backupData;
      
      // Verify integrity
      await this.verifyBackupIntegrity(decompressed);
      
      // Stop application services
      await this.stopServices();
      
      // Restore database
      await this.restoreDatabase(decompressed.database);
      
      // Restore configuration
      await this.restoreConfiguration(decompressed.config);
      
      // Start services
      await this.startServices();
      
      console.log(`Restore completed: ${backupId}`);
    } catch (error) {
      console.error(`Restore failed: ${backupId}`, error);
      throw error;
    }
  }
}
```

### Disaster Recovery Procedures

```bash
#!/bin/bash
# disaster-recovery.sh - Disaster recovery procedures

set -e

BACKUP_LOCATION=${1:-"s3://backups/mainframe-ai"}
RECOVERY_POINT=${2:-"latest"}

echo "Starting disaster recovery procedure..."
echo "Backup location: $BACKUP_LOCATION"
echo "Recovery point: $RECOVERY_POINT"

# Step 1: Verify backup integrity
echo "Verifying backup integrity..."
./scripts/verify-backup.sh "$BACKUP_LOCATION" "$RECOVERY_POINT"

# Step 2: Prepare recovery environment
echo "Preparing recovery environment..."
./scripts/prepare-recovery-env.sh

# Step 3: Restore database
echo "Restoring database..."
./scripts/restore-database.sh "$BACKUP_LOCATION" "$RECOVERY_POINT"

# Step 4: Restore application
echo "Restoring application..."
./scripts/restore-application.sh "$BACKUP_LOCATION" "$RECOVERY_POINT"

# Step 5: Verify recovery
echo "Verifying recovery..."
./scripts/verify-recovery.sh

# Step 6: Start services
echo "Starting services..."
./scripts/start-services.sh

echo "Disaster recovery completed successfully!"
echo "Please verify application functionality manually."
```

## High Availability

### Load Balancer Configuration

```nginx
# nginx.conf - Load balancer configuration
upstream mainframe_ai_backend {
    least_conn;
    
    server app1.example.com:3000 max_fails=3 fail_timeout=30s;
    server app2.example.com:3000 max_fails=3 fail_timeout=30s;
    server app3.example.com:3000 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name mainframe.example.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/mainframe.example.com.crt;
    ssl_certificate_key /etc/ssl/private/mainframe.example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Proxy configuration
    location / {
        proxy_pass http://mainframe_ai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://mainframe_ai_backend/health;
        proxy_set_header Host $host;
    }
    
    # Static assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        root /var/www/mainframe-ai;
    }
}
```

### Database High Availability

```yaml
# PostgreSQL HA with replication
version: '3.8'

services:
  postgres-primary:
    image: postgres:13
    environment:
      POSTGRES_DB: mainframe_ai
      POSTGRES_USER: mainframe_ai_app
      POSTGRES_PASSWORD: secure_password
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replication_password
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    command: |
      postgres 
      -c config_file=/etc/postgresql/postgresql.conf
      -c wal_level=replica
      -c max_wal_senders=3
      -c max_replication_slots=3
    networks:
      - db_network

  postgres-replica:
    image: postgres:13
    environment:
      POSTGRES_USER: mainframe_ai_app
      POSTGRES_PASSWORD: secure_password
      PGUSER: postgres
      POSTGRES_PRIMARY_HOST: postgres-primary
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replication_password
    volumes:
      - postgres_replica_data:/var/lib/postgresql/data
    depends_on:
      - postgres-primary
    command: |
      bash -c "
        until pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replicator -v -P -W
        do
          echo 'Waiting for primary to become available...'
          sleep 5
        done
        echo 'standby_mode = on' >> /var/lib/postgresql/data/recovery.conf
        echo 'primary_conninfo = \"host=postgres-primary port=5432 user=replicator\"' >> /var/lib/postgresql/data/recovery.conf
        postgres
      "
    networks:
      - db_network

  pgpool:
    image: pgpool/pgpool:latest
    ports:
      - "5432:5432"
    environment:
      PGPOOL_BACKEND_NODES: "0:postgres-primary:5432,1:postgres-replica:5432"
      PGPOOL_SR_CHECK_USER: replicator
      PGPOOL_SR_CHECK_PASSWORD: replication_password
      PGPOOL_ENABLE_LOAD_BALANCING: "yes"
      PGPOOL_ENABLE_MASTER_SLAVE_MODE: "yes"
    depends_on:
      - postgres-primary
      - postgres-replica
    networks:
      - db_network

volumes:
  postgres_primary_data:
  postgres_replica_data:

networks:
  db_network:
    driver: bridge
```

This comprehensive deployment and configuration guide provides everything needed to deploy the Mainframe AI Assistant storage service from simple desktop deployment (MVP1) to enterprise-scale distributed systems (MVP5). Each section includes practical examples, scripts, and configurations that can be adapted to specific environments and requirements.