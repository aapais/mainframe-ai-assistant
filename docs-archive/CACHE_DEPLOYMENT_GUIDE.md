# Cache System Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Mainframe AI Assistant intelligent search caching system in production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Configuration](#configuration)
5. [Security](#security)
6. [Monitoring](#monitoring)
7. [Scaling](#scaling)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: Minimum 20GB free space, SSD recommended
- **CPU**: 2+ cores recommended
- **Network**: Stable internet connection for Docker image downloads

### Software Dependencies

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 18+ (for development/building)
- **Git**: For repository management

### Network Requirements

- **Ports**: Ensure the following ports are available:
  - 6379: Redis primary
  - 26379: Redis Sentinel
  - 8080: Cache Manager
  - 9090: Prometheus
  - 3000: Grafana
  - 9121: Redis Exporter
  - 80: Load Balancer (production)

## Quick Start

### Automated Deployment

The fastest way to get started is using our automated deployment script:

```bash
# Clone the repository
git clone <repository-url>
cd mainframe-ai-assistant

# Run the automated setup
./deployment/cache-setup.sh

# Check deployment status
./deployment/monitor.sh
```

This script will:
- Check system requirements
- Generate all necessary configuration files
- Create secure passwords
- Deploy all services via Docker Compose
- Perform health checks
- Provide access information

### Manual Quick Start

If you prefer manual control:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit configuration (set passwords, adjust settings)
nano .env

# 3. Start services
docker-compose -f docker-compose.cache.yml up -d

# 4. Verify deployment
curl http://localhost:8080/health
```

## Detailed Installation

### Step 1: Environment Setup

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure critical settings**:
   ```bash
   # Edit .env file
   REDIS_PASSWORD=your-secure-password-here
   GRAFANA_ADMIN_PASSWORD=your-grafana-password
   NODE_ENV=production
   LOG_LEVEL=warn
   ```

3. **Set appropriate permissions**:
   ```bash
   chmod 600 .env
   ```

### Step 2: Infrastructure Preparation

1. **Create data directories**:
   ```bash
   sudo mkdir -p /opt/mainframe/data/{redis,prometheus,grafana}
   sudo mkdir -p /opt/mainframe/backups
   sudo mkdir -p /var/log/mainframe
   ```

2. **Set ownership** (if not running as root):
   ```bash
   sudo chown -R $USER:$USER /opt/mainframe
   sudo chown -R $USER:$USER /var/log/mainframe
   ```

### Step 3: Service Deployment

1. **Build cache manager image**:
   ```bash
   docker build -f deployment/Dockerfile.cache -t mainframe-cache-manager .
   ```

2. **Start core services**:
   ```bash
   # Start Redis and monitoring first
   docker-compose -f docker-compose.cache.yml up -d redis-primary redis-sentinel prometheus

   # Wait for Redis to be ready
   sleep 30

   # Start remaining services
   docker-compose -f docker-compose.cache.yml up -d
   ```

3. **Verify all services**:
   ```bash
   docker-compose -f docker-compose.cache.yml ps
   ```

### Step 4: Service Validation

1. **Test Redis connectivity**:
   ```bash
   docker exec mainframe-redis-primary redis-cli ping
   # Expected: PONG
   ```

2. **Test cache manager**:
   ```bash
   curl -f http://localhost:8080/health
   # Expected: 200 OK with health status
   ```

3. **Test Prometheus**:
   ```bash
   curl -f http://localhost:9090/-/healthy
   # Expected: 200 OK
   ```

4. **Test Grafana**:
   ```bash
   curl -f http://localhost:3000/api/health
   # Expected: 200 OK with JSON response
   ```

## Configuration

### Environment Variables

#### Redis Configuration
```bash
REDIS_HOST=localhost                    # Redis server hostname
REDIS_PORT=6379                        # Redis server port
REDIS_PASSWORD=secure-password          # Redis authentication
REDIS_DB=0                             # Redis database number
REDIS_KEY_PREFIX=search:cache:         # Key prefix for cache entries
REDIS_MAX_MEMORY=256mb                 # Maximum memory for Redis
```

#### Cache Manager Configuration
```bash
MEMORY_CACHE_SIZE=100                  # In-memory cache size (entries)
MEMORY_CACHE_TTL=300000               # TTL for memory cache (ms)
CACHE_METRICS_ENABLED=true            # Enable metrics collection
ENABLE_MEMORY_FALLBACK=true           # Use memory cache as fallback
```

#### Performance Tuning
```bash
CACHE_COMPRESSION_ENABLED=true        # Enable value compression
CACHE_COMPRESSION_THRESHOLD=1024      # Compress values larger than this
CACHE_BATCH_SIZE=50                   # Batch operation size
REDIS_POOL_MIN=2                      # Minimum connection pool size
REDIS_POOL_MAX=10                     # Maximum connection pool size
```

### Advanced Configuration

#### Redis Optimization
```bash
# Add to redis.conf or environment
REDIS_MAXCLIENTS=1000
REDIS_TCP_KEEPALIVE=60
REDIS_TIMEOUT=300
REDIS_LRU_SAMPLES=5
```

#### High Availability
```bash
# Redis Sentinel configuration
REDIS_MASTER_NAME=mymaster
REDIS_SENTINEL_QUORUM=2               # For production, use odd number ≥3
REDIS_SENTINEL_DOWN_AFTER=5000
REDIS_SENTINEL_FAILOVER_TIMEOUT=10000
```

## Security

### Basic Security

1. **Change default passwords**:
   ```bash
   # Generate secure passwords
   REDIS_PASSWORD=$(openssl rand -base64 32)
   GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 16)
   ```

2. **Restrict network access**:
   ```bash
   # In production, bind Redis to internal networks only
   REDIS_BIND=127.0.0.1,10.0.0.0/8
   ```

3. **Enable authentication**:
   ```bash
   # Always set Redis password in production
   REDIS_PASSWORD=your-strong-password
   ```

### Advanced Security

1. **TLS/SSL Configuration**:
   ```bash
   REDIS_TLS_ENABLED=true
   REDIS_TLS_CERT_FILE=/path/to/cert.pem
   REDIS_TLS_KEY_FILE=/path/to/key.pem
   REDIS_TLS_CA_FILE=/path/to/ca.pem
   ```

2. **Encryption at rest**:
   ```bash
   CACHE_ENCRYPTION_KEY=your-32-character-encryption-key
   CACHE_SECURE_MODE=true
   ```

3. **Rate limiting**:
   ```bash
   CACHE_RATE_LIMIT_ENABLED=true
   CACHE_RATE_LIMIT_MAX_REQUESTS=1000
   CACHE_RATE_LIMIT_WINDOW=60000
   ```

### Firewall Configuration

```bash
# UFW example (Ubuntu)
sudo ufw allow from 10.0.0.0/8 to any port 6379  # Redis
sudo ufw allow from 10.0.0.0/8 to any port 8080  # Cache Manager
sudo ufw allow 3000                                # Grafana (if external access needed)
sudo ufw allow 9090                                # Prometheus (if external access needed)
```

## Monitoring

### Built-in Monitoring

The deployment includes comprehensive monitoring out of the box:

1. **Grafana Dashboard**: http://localhost:3000
   - Username: admin
   - Password: (from GRAFANA_ADMIN_PASSWORD)

2. **Prometheus Metrics**: http://localhost:9090

3. **Health Checks**:
   ```bash
   # Automated monitoring script
   ./deployment/monitor.sh

   # Individual service checks
   curl http://localhost:8080/health        # Cache Manager
   curl http://localhost:9090/-/healthy     # Prometheus
   curl http://localhost:3000/api/health    # Grafana
   ```

### Key Metrics to Monitor

#### Redis Metrics
- Memory usage and limits
- Connected clients
- Operations per second
- Hit/miss ratios
- Slow queries

#### Cache Manager Metrics
- Request rate and latency
- Cache hit/miss ratios
- Memory usage
- Connection pool stats
- Circuit breaker status

#### System Metrics
- CPU and memory usage
- Disk I/O and space
- Network utilization
- Docker container health

### Alerting Setup

1. **Prometheus Alerting Rules**:
   ```yaml
   # deployment/alert-rules.yml
   groups:
   - name: cache-alerts
     rules:
     - alert: RedisDown
       expr: up{job="redis"} == 0
       for: 1m
       labels:
         severity: critical
       annotations:
         summary: Redis is down
   ```

2. **Grafana Alerts**:
   - Set up notification channels (email, Slack, etc.)
   - Configure alert rules for critical metrics
   - Set appropriate thresholds

## Scaling

### Vertical Scaling

1. **Increase Redis memory**:
   ```bash
   # In .env file
   REDIS_MAX_MEMORY=1gb

   # Or in docker-compose.cache.yml
   deploy:
     resources:
       limits:
         memory: 2g
   ```

2. **Scale cache manager**:
   ```bash
   # Increase resources
   docker-compose -f docker-compose.cache.yml -f docker-compose.cache.prod.yml up -d
   ```

### Horizontal Scaling

1. **Multiple cache manager instances**:
   ```bash
   docker-compose -f docker-compose.cache.yml up -d --scale cache-manager=3
   ```

2. **Redis Cluster** (for large deployments):
   ```bash
   REDIS_CLUSTER_ENABLED=true
   REDIS_CLUSTER_NODES=redis1:6379,redis2:6379,redis3:6379
   ```

3. **Load balancing**:
   ```bash
   # Enable Nginx load balancer
   docker-compose -f docker-compose.cache.yml -f docker-compose.cache.prod.yml up -d nginx
   ```

### Multi-Region Deployment

For global deployments:

1. **Regional Redis clusters**
2. **Cross-region replication**
3. **DNS-based routing**
4. **Regional cache managers**

## Troubleshooting

### Common Issues

#### Redis Connection Issues
```bash
# Check Redis status
docker logs mainframe-redis-primary

# Test connectivity
docker exec mainframe-redis-primary redis-cli ping

# Check authentication
docker exec mainframe-redis-primary redis-cli -a $REDIS_PASSWORD ping
```

#### Cache Manager Issues
```bash
# Check logs
docker logs mainframe-cache-manager

# Check health endpoint
curl -v http://localhost:8080/health

# Check metrics
curl http://localhost:8080/metrics
```

#### Performance Issues
```bash
# Monitor Redis performance
docker exec mainframe-redis-primary redis-cli --latency

# Check memory usage
docker exec mainframe-redis-primary redis-cli info memory

# Monitor slow queries
docker exec mainframe-redis-primary redis-cli slowlog get 10
```

### Debugging Commands

```bash
# Container status
docker-compose -f docker-compose.cache.yml ps

# Service logs
docker-compose -f docker-compose.cache.yml logs -f [service-name]

# Resource usage
docker stats

# Network inspection
docker network inspect mainframe-cache_cache_network

# Volume inspection
docker volume inspect mainframe-cache_redis_data
```

### Recovery Procedures

#### Redis Recovery
```bash
# Restore from backup
docker run --rm -v mainframe-cache_redis_data:/data -v /opt/mainframe/backups:/backup alpine \
  tar xzf /backup/cache_backup_YYYYMMDD_HHMMSS.tar.gz -C /data

# Restart Redis
docker-compose -f docker-compose.cache.yml restart redis-primary
```

#### Complete System Recovery
```bash
# Stop all services
docker-compose -f docker-compose.cache.yml down

# Clean volumes (caution: data loss)
docker volume rm mainframe-cache_redis_data mainframe-cache_prometheus_data mainframe-cache_grafana_data

# Redeploy
./deployment/cache-setup.sh
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Monitor health dashboards
- Check error logs
- Verify backup completion

#### Weekly
```bash
# Backup Redis data
./deployment/backup.sh

# Update resource usage reports
./deployment/monitor.sh > weekly-report.txt

# Check for security updates
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}"
```

#### Monthly
- Review and tune configuration
- Update Docker images
- Analyze performance trends
- Clean up old backups

### Backup and Recovery

#### Automated Backups
```bash
# Add to crontab
0 2 * * * /path/to/deployment/backup.sh

# Backup script creates dated backups
./deployment/backup.sh
# Creates: /opt/mainframe/backups/cache_backup_YYYYMMDD_HHMMSS.tar.gz
```

#### Manual Backup
```bash
# Trigger Redis background save
docker exec mainframe-redis-primary redis-cli BGSAVE

# Wait for completion
while [ $(docker exec mainframe-redis-primary redis-cli LASTSAVE) -eq $LAST_SAVE ]; do
  sleep 1
done

# Copy data
docker run --rm -v mainframe-cache_redis_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/manual_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### Updates and Upgrades

#### Update Docker Images
```bash
# Pull latest images
docker-compose -f docker-compose.cache.yml pull

# Recreate containers with new images
docker-compose -f docker-compose.cache.yml up -d
```

#### Update Cache Manager
```bash
# Rebuild cache manager
docker build -f deployment/Dockerfile.cache -t mainframe-cache-manager .

# Deploy updated version
docker-compose -f docker-compose.cache.yml up -d cache-manager
```

### Performance Optimization

#### Redis Optimization
```bash
# Monitor memory fragmentation
docker exec mainframe-redis-primary redis-cli info memory | grep fragmentation

# Defragment if needed (Redis 4.0+)
docker exec mainframe-redis-primary redis-cli MEMORY DOCTOR
```

#### Connection Pool Tuning
```bash
# Adjust pool sizes based on load
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20

# Monitor pool stats
curl http://localhost:8080/stats | jq '.connectionPool'
```

---

## Support and Resources

### Documentation
- [API Reference](./CACHE_API_REFERENCE.md)
- [Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md)
- [Performance Tuning](../performance-optimization.md)

### Monitoring URLs
- **Cache Manager**: http://localhost:8080
- **Grafana Dashboard**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Redis Exporter**: http://localhost:9121/metrics

### Useful Commands
```bash
# Quick status check
./deployment/monitor.sh

# Create backup
./deployment/backup.sh

# View all logs
docker-compose -f docker-compose.cache.yml logs -f

# Restart all services
docker-compose -f docker-compose.cache.yml restart

# Update and restart
docker-compose -f docker-compose.cache.yml pull && \
docker-compose -f docker-compose.cache.yml up -d
```

For additional support, please refer to the project repository or contact the development team.