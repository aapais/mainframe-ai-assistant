# Cache System Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for the Mainframe AI Assistant intelligent search caching system. It covers common issues, diagnostic procedures, and resolution strategies.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Redis Issues](#redis-issues)
3. [Cache Manager Issues](#cache-manager-issues)
4. [Performance Problems](#performance-problems)
5. [Memory Issues](#memory-issues)
6. [Network Connectivity](#network-connectivity)
7. [Configuration Issues](#configuration-issues)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Recovery Procedures](#recovery-procedures)
10. [Performance Optimization](#performance-optimization)

## Quick Diagnostics

### Initial Health Check

Start troubleshooting with these quick diagnostic commands:

```bash
# Run the monitoring script
./deployment/monitor.sh

# Check container status
docker-compose -f docker-compose.cache.yml ps

# Test cache manager health
curl -f http://localhost:8080/health

# Test Redis connectivity
docker exec mainframe-redis-primary redis-cli ping
```

### Service Status Overview

```bash
#!/bin/bash
echo "=== Cache System Quick Diagnostics ==="
echo "Timestamp: $(date)"
echo ""

# Check Docker Compose services
echo "--- Service Status ---"
docker-compose -f docker-compose.cache.yml ps

echo ""
echo "--- Health Checks ---"

# Cache Manager
if curl -f http://localhost:8080/health &>/dev/null; then
    echo "✓ Cache Manager: Healthy"
else
    echo "✗ Cache Manager: Unhealthy"
fi

# Redis
if docker exec mainframe-redis-primary redis-cli ping &>/dev/null; then
    echo "✓ Redis: Responding"
else
    echo "✗ Redis: Not responding"
fi

# Prometheus
if curl -f http://localhost:9090/-/healthy &>/dev/null; then
    echo "✓ Prometheus: Healthy"
else
    echo "✗ Prometheus: Unhealthy"
fi

# Grafana
if curl -f http://localhost:3000/api/health &>/dev/null; then
    echo "✓ Grafana: Healthy"
else
    echo "✗ Grafana: Unhealthy"
fi

echo ""
echo "--- Resource Usage ---"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

## Redis Issues

### Redis Won't Start

**Symptoms:**
- Container exits immediately
- Connection refused errors
- Redis logs show startup failures

**Diagnostic Commands:**
```bash
# Check Redis logs
docker logs mainframe-redis-primary

# Check Redis configuration
docker exec mainframe-redis-primary cat /usr/local/etc/redis/redis.conf

# Check data directory permissions
docker exec mainframe-redis-primary ls -la /data
```

**Common Causes and Solutions:**

#### 1. Permission Issues
```bash
# Fix data directory permissions
sudo chown -R 999:999 ./data/redis

# Or recreate the volume
docker volume rm mainframe-cache_redis_data
docker-compose -f docker-compose.cache.yml up -d redis-primary
```

#### 2. Configuration Errors
```bash
# Validate Redis configuration
docker run --rm -v "$(pwd)/deployment/redis.conf:/redis.conf" redis:7.2-alpine redis-server /redis.conf --test-config

# Check for conflicting settings
grep -E "(save|appendonly|maxmemory)" deployment/redis.conf
```

#### 3. Memory Limits
```bash
# Check available system memory
free -h

# Check Docker memory limits
docker inspect mainframe-redis-primary | grep -i memory

# Adjust memory settings in .env
echo "REDIS_MAX_MEMORY=128mb" >> .env
```

#### 4. Port Conflicts
```bash
# Check if port 6379 is in use
netstat -tulpn | grep 6379

# Use different port
echo "REDIS_PORT=6380" >> .env
```

### Redis Connection Issues

**Symptoms:**
- "Connection refused" errors
- Timeout errors
- Intermittent connectivity

**Diagnostic Commands:**
```bash
# Test Redis connectivity
docker exec mainframe-redis-primary redis-cli ping

# Check Redis authentication
docker exec mainframe-redis-primary redis-cli -a "$REDIS_PASSWORD" ping

# Monitor Redis connections
docker exec mainframe-redis-primary redis-cli monitor

# Check connected clients
docker exec mainframe-redis-primary redis-cli client list
```

**Solutions:**

#### 1. Authentication Problems
```bash
# Verify password in environment
grep REDIS_PASSWORD .env

# Test with correct password
docker exec mainframe-redis-primary redis-cli -a "correct-password" ping

# Reset password if needed
docker exec mainframe-redis-primary redis-cli config set requirepass "new-password"
```

#### 2. Network Issues
```bash
# Check Docker network
docker network inspect mainframe-cache_cache_network

# Test network connectivity
docker exec mainframe-cache-manager ping redis-primary

# Restart networking
docker-compose -f docker-compose.cache.yml restart
```

#### 3. Connection Pool Issues
```bash
# Check connection pool stats
curl http://localhost:8080/stats | jq '.connectionPool'

# Adjust pool settings
echo "REDIS_POOL_MAX=20" >> .env
echo "REDIS_POOL_MIN=5" >> .env
```

### Redis Performance Issues

**Symptoms:**
- Slow response times
- High memory usage
- Frequent evictions

**Diagnostic Commands:**
```bash
# Monitor Redis performance
docker exec mainframe-redis-primary redis-cli --latency
docker exec mainframe-redis-primary redis-cli --latency-history

# Check memory usage
docker exec mainframe-redis-primary redis-cli info memory

# Monitor slow queries
docker exec mainframe-redis-primary redis-cli slowlog get 10

# Check keyspace statistics
docker exec mainframe-redis-primary redis-cli info keyspace
```

**Optimization Solutions:**

#### 1. Memory Optimization
```bash
# Check memory fragmentation
docker exec mainframe-redis-primary redis-cli info memory | grep fragmentation

# Defragment memory (Redis 4.0+)
docker exec mainframe-redis-primary redis-cli memory doctor

# Adjust memory policy
docker exec mainframe-redis-primary redis-cli config set maxmemory-policy allkeys-lru
```

#### 2. Performance Tuning
```bash
# Optimize configuration
cat >> deployment/redis.conf << EOF
tcp-keepalive 60
timeout 300
tcp-backlog 511
maxclients 1000
EOF

# Restart Redis to apply changes
docker-compose -f docker-compose.cache.yml restart redis-primary
```

## Cache Manager Issues

### Cache Manager Won't Start

**Symptoms:**
- Container exits with error
- Health check failures
- Application startup errors

**Diagnostic Commands:**
```bash
# Check Cache Manager logs
docker logs mainframe-cache-manager -f

# Check build logs
docker build -f deployment/Dockerfile.cache -t mainframe-cache-manager .

# Verify dependencies
docker exec mainframe-cache-manager npm list
```

**Common Solutions:**

#### 1. Build Issues
```bash
# Clean build
docker build --no-cache -f deployment/Dockerfile.cache -t mainframe-cache-manager .

# Check Node.js version
docker exec mainframe-cache-manager node --version

# Verify TypeScript compilation
docker exec mainframe-cache-manager npm run build
```

#### 2. Configuration Issues
```bash
# Validate environment variables
docker exec mainframe-cache-manager printenv | grep -E "(REDIS|CACHE)"

# Check configuration file
docker exec mainframe-cache-manager cat package.json

# Test configuration loading
docker exec mainframe-cache-manager node -e "console.log(process.env)"
```

#### 3. Dependency Issues
```bash
# Reinstall dependencies
docker exec mainframe-cache-manager npm ci

# Check for security vulnerabilities
docker exec mainframe-cache-manager npm audit

# Update dependencies
docker exec mainframe-cache-manager npm update
```

### Cache Manager API Issues

**Symptoms:**
- HTTP 500 errors
- API timeouts
- Inconsistent responses

**Diagnostic Commands:**
```bash
# Test API endpoints
curl -v http://localhost:8080/health
curl -v http://localhost:8080/stats
curl -v http://localhost:8080/metrics

# Check API logs
docker logs mainframe-cache-manager | grep -i error

# Monitor API performance
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:8080/health"
```

**Solutions:**

#### 1. API Error Handling
```bash
# Check error logs
docker logs mainframe-cache-manager | grep -E "(error|Error|ERROR)"

# Increase log verbosity
echo "LOG_LEVEL=debug" >> .env
docker-compose -f docker-compose.cache.yml restart cache-manager
```

#### 2. Performance Issues
```bash
# Monitor resource usage
docker stats mainframe-cache-manager

# Adjust memory limits
docker-compose -f docker-compose.cache.yml -f docker-compose.cache.prod.yml up -d
```

## Performance Problems

### Slow Cache Operations

**Symptoms:**
- High response times
- Timeouts
- Poor hit ratios

**Diagnostic Approach:**

```bash
# Monitor cache performance
curl http://localhost:8080/stats | jq '.'

# Check hit/miss ratios
curl http://localhost:8080/metrics | grep cache_hits

# Monitor Redis latency
docker exec mainframe-redis-primary redis-cli --latency-history -i 1
```

**Optimization Steps:**

#### 1. Cache Strategy Optimization
```javascript
// Implement better cache key strategies
const optimizedCachedSearch = cacheSystem.createCachedSearch(
  searchFunction,
  {
    ttl: 600000, // 10 minutes
    keyGenerator: (query, options) => {
      // Normalize query for better hit rates
      const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
      return `search:${Buffer.from(normalized).toString('base64')}`;
    },
    shouldCache: (query, options, result) => {
      // Only cache successful results
      return result && result.length > 0;
    }
  }
);
```

#### 2. Connection Pool Tuning
```bash
# Optimize connection pool settings
cat >> .env << EOF
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20
REDIS_POOL_ACQUIRE_TIMEOUT=10000
CACHE_BATCH_SIZE=100
CACHE_BATCHING_ENABLED=true
EOF
```

#### 3. Compression Configuration
```bash
# Enable compression for large values
cat >> .env << EOF
CACHE_COMPRESSION_ENABLED=true
CACHE_COMPRESSION_THRESHOLD=1024
CACHE_COMPRESSION_ALGORITHM=gzip
EOF
```

### High Memory Usage

**Symptoms:**
- Container memory limits exceeded
- OOM kills
- Slow performance

**Investigation:**

```bash
# Check memory usage
docker stats --no-stream

# Redis memory analysis
docker exec mainframe-redis-primary redis-cli info memory
docker exec mainframe-redis-primary redis-cli memory usage key-name

# System memory
free -h
```

**Solutions:**

#### 1. Redis Memory Optimization
```bash
# Adjust Redis memory settings
docker exec mainframe-redis-primary redis-cli config set maxmemory 512mb
docker exec mainframe-redis-primary redis-cli config set maxmemory-policy allkeys-lru

# Monitor memory usage
watch 'docker exec mainframe-redis-primary redis-cli info memory | grep used_memory'
```

#### 2. Cache Size Management
```bash
# Reduce cache sizes
cat >> .env << EOF
MEMORY_CACHE_SIZE=50
MEMORY_CACHE_TTL=180000
REDIS_MAX_MEMORY=256mb
EOF
```

#### 3. Container Resource Limits
```yaml
# In docker-compose.cache.yml
services:
  cache-manager:
    deploy:
      resources:
        limits:
          memory: 1g
        reservations:
          memory: 512m
```

## Memory Issues

### Out of Memory Errors

**Symptoms:**
- Containers being killed
- "Cannot allocate memory" errors
- System slowdown

**Immediate Actions:**

```bash
# Check system memory
free -h
df -h

# Identify memory-heavy containers
docker stats --no-stream | sort -k4 -hr

# Check for memory leaks
docker exec mainframe-cache-manager ps aux | sort -k4 -nr
```

**Resolution:**

#### 1. Emergency Memory Release
```bash
# Clear Redis memory
docker exec mainframe-redis-primary redis-cli flushdb

# Restart memory-heavy services
docker-compose -f docker-compose.cache.yml restart cache-manager

# Clear system cache
sudo sync && sudo echo 3 > /proc/sys/vm/drop_caches
```

#### 2. Memory Configuration
```bash
# Optimize Redis memory usage
cat >> deployment/redis.conf << EOF
maxmemory 256mb
maxmemory-policy allkeys-lru
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
EOF
```

### Memory Leaks

**Detection:**

```bash
# Monitor memory growth over time
watch 'docker stats --no-stream mainframe-cache-manager | tail -n +2'

# Check for increasing memory usage
docker exec mainframe-cache-manager cat /proc/meminfo | grep Available
```

**Investigation:**

```bash
# Enable memory debugging
echo "DEBUG_MEMORY_USAGE=true" >> .env

# Monitor garbage collection
docker exec mainframe-cache-manager node --expose-gc -e "
  setInterval(() => {
    global.gc();
    console.log(process.memoryUsage());
  }, 10000);
"
```

## Network Connectivity

### Service Communication Issues

**Symptoms:**
- Services can't reach each other
- DNS resolution failures
- Connection timeouts

**Diagnosis:**

```bash
# Check Docker network
docker network ls
docker network inspect mainframe-cache_cache_network

# Test service connectivity
docker exec mainframe-cache-manager ping redis-primary
docker exec mainframe-cache-manager nslookup redis-primary

# Check port accessibility
docker exec mainframe-cache-manager telnet redis-primary 6379
```

**Solutions:**

#### 1. Network Recreation
```bash
# Recreate Docker network
docker-compose -f docker-compose.cache.yml down
docker network prune -f
docker-compose -f docker-compose.cache.yml up -d
```

#### 2. DNS Resolution
```bash
# Add explicit network aliases
cat >> docker-compose.cache.yml << EOF
services:
  redis-primary:
    networks:
      cache_network:
        aliases:
          - redis
          - cache-redis
EOF
```

### External Access Issues

**Symptoms:**
- Can't access services from host
- Port binding failures
- Firewall blocks

**Diagnosis:**

```bash
# Check port bindings
docker port mainframe-cache-manager
netstat -tulpn | grep -E "(8080|6379|9090|3000)"

# Test external access
curl http://localhost:8080/health
telnet localhost 6379
```

**Solutions:**

#### 1. Port Configuration
```bash
# Verify port mappings in .env
grep -E "(PORT|port)" .env

# Test different ports
echo "CACHE_MANAGER_PORT=8081" >> .env
docker-compose -f docker-compose.cache.yml up -d
```

#### 2. Firewall Configuration
```bash
# Ubuntu/Debian
sudo ufw allow 8080/tcp
sudo ufw allow 6379/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

## Configuration Issues

### Environment Variable Problems

**Symptoms:**
- Services start with wrong configuration
- Default values being used
- Configuration not taking effect

**Diagnosis:**

```bash
# Check environment file
cat .env | grep -v "^#" | sort

# Verify environment variables in containers
docker exec mainframe-cache-manager printenv | grep -E "(REDIS|CACHE)" | sort
docker exec mainframe-redis-primary printenv | grep REDIS
```

**Solutions:**

#### 1. Environment File Issues
```bash
# Validate .env syntax
bash -n .env 2>/dev/null || echo "Syntax error in .env"

# Remove Windows line endings
sed -i 's/\r$//' .env

# Ensure no spaces around equals
sed -i 's/ *= */=/g' .env
```

#### 2. Docker Compose Variable Substitution
```bash
# Test variable substitution
docker-compose -f docker-compose.cache.yml config

# Check for undefined variables
docker-compose -f docker-compose.cache.yml config 2>&1 | grep -i warning
```

### Configuration File Issues

**Symptoms:**
- Services use default configuration
- Configuration files not found
- Invalid configuration format

**Solutions:**

```bash
# Regenerate configuration files
./deployment/cache-setup.sh --no-deploy

# Validate configuration files
redis-cli --test-config -c deployment/redis.conf

# Check file permissions
ls -la deployment/
```

## Monitoring and Logging

### Log Analysis

**Essential Log Commands:**

```bash
# View all service logs
docker-compose -f docker-compose.cache.yml logs -f

# Service-specific logs
docker logs mainframe-cache-manager -f --tail 100
docker logs mainframe-redis-primary -f --tail 100

# Filter logs by level
docker logs mainframe-cache-manager 2>&1 | grep -E "(ERROR|WARN)"

# Search for specific patterns
docker logs mainframe-cache-manager 2>&1 | grep -i "connection"
```

### Metrics Investigation

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# View cache metrics
curl http://localhost:8080/metrics | grep cache_

# Redis metrics
curl http://localhost:9121/metrics | grep redis_
```

### Performance Monitoring

```bash
# Real-time performance monitoring
watch 'curl -s http://localhost:8080/stats | jq "."'

# Historical performance
curl "http://localhost:9090/api/v1/query?query=cache_hit_ratio"

# Custom monitoring script
cat > monitor-performance.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:8080/stats | jq '{
    hitRatio: .hitRatio,
    memoryUsage: .memoryUsage.percentage,
    redisConnected: .redis.connected
  }'
  sleep 30
done
EOF
chmod +x monitor-performance.sh
```

## Recovery Procedures

### Complete System Recovery

**When everything is broken:**

```bash
# 1. Stop all services
docker-compose -f docker-compose.cache.yml down

# 2. Clean up (CAUTION: destroys data)
docker system prune -a --volumes

# 3. Recreate from scratch
./deployment/cache-setup.sh

# 4. Restore from backup (if available)
./deployment/restore-backup.sh /opt/mainframe/backups/latest.tar.gz
```

### Partial Recovery

**When specific services are failing:**

```bash
# Recreate specific service
docker-compose -f docker-compose.cache.yml rm -f cache-manager
docker-compose -f docker-compose.cache.yml up -d cache-manager

# Reset Redis data
docker exec mainframe-redis-primary redis-cli flushall
docker-compose -f docker-compose.cache.yml restart redis-primary

# Rebuild Cache Manager
docker build --no-cache -f deployment/Dockerfile.cache -t mainframe-cache-manager .
docker-compose -f docker-compose.cache.yml up -d cache-manager
```

### Data Recovery

**Backup and Restore:**

```bash
# Create emergency backup
./deployment/backup.sh

# List available backups
ls -la /opt/mainframe/backups/

# Restore specific backup
./deployment/restore-backup.sh /opt/mainframe/backups/cache_backup_20231201_120000.tar.gz
```

## Performance Optimization

### Cache Hit Ratio Optimization

```bash
# Analyze cache patterns
curl http://localhost:8080/stats | jq '.hitRatio'

# Monitor cache keys
docker exec mainframe-redis-primary redis-cli --scan --pattern "search:*" | head -20

# Optimize TTL values
cat >> .env << EOF
SEARCH_CACHE_DEFAULT_TTL=900000  # 15 minutes
MEMORY_CACHE_TTL=300000          # 5 minutes
EOF
```

### Connection Pool Optimization

```bash
# Monitor pool usage
curl http://localhost:8080/stats | jq '.connectionPool'

# Optimize based on load
cat >> .env << EOF
REDIS_POOL_MIN=10
REDIS_POOL_MAX=50
REDIS_POOL_ACQUIRE_TIMEOUT=5000
EOF
```

### Memory Usage Optimization

```bash
# Redis memory optimization
docker exec mainframe-redis-primary redis-cli config set save ""
docker exec mainframe-redis-primary redis-cli config set appendonly yes
docker exec mainframe-redis-primary redis-cli config set maxmemory-samples 10

# Enable compression
cat >> .env << EOF
CACHE_COMPRESSION_ENABLED=true
CACHE_COMPRESSION_THRESHOLD=512
EOF
```

## Emergency Procedures

### Service Down Response

```bash
#!/bin/bash
# emergency-response.sh

echo "=== EMERGENCY CACHE SYSTEM RESPONSE ==="
echo "Time: $(date)"

# Check what's running
docker-compose -f docker-compose.cache.yml ps

# Try to restart failed services
for service in redis-primary cache-manager prometheus grafana; do
  if ! docker-compose -f docker-compose.cache.yml ps $service | grep -q "Up"; then
    echo "Restarting $service..."
    docker-compose -f docker-compose.cache.yml up -d $service
    sleep 10
  fi
done

# Health check after restart
./deployment/monitor.sh
```

### Data Corruption Response

```bash
#!/bin/bash
# data-corruption-response.sh

echo "=== DATA CORRUPTION RESPONSE ==="

# Stop services
docker-compose -f docker-compose.cache.yml stop

# Backup corrupted data
mkdir -p /tmp/corrupted-backup
docker run --rm -v mainframe-cache_redis_data:/data -v /tmp/corrupted-backup:/backup \
  alpine tar czf /backup/corrupted-$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Restore from latest good backup
latest_backup=$(ls -t /opt/mainframe/backups/cache_backup_*.tar.gz | head -1)
if [[ -n "$latest_backup" ]]; then
  echo "Restoring from: $latest_backup"
  ./deployment/restore-backup.sh "$latest_backup"
else
  echo "No backup found, starting fresh"
  docker volume rm mainframe-cache_redis_data
fi

# Restart services
docker-compose -f docker-compose.cache.yml up -d
```

---

## Getting Help

### Log Collection for Support

```bash
#!/bin/bash
# collect-logs.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="/tmp/cache-logs-$TIMESTAMP"
mkdir -p "$LOG_DIR"

# System information
docker version > "$LOG_DIR/docker-version.txt"
docker-compose version > "$LOG_DIR/docker-compose-version.txt"
uname -a > "$LOG_DIR/system-info.txt"
free -h > "$LOG_DIR/memory-info.txt"
df -h > "$LOG_DIR/disk-info.txt"

# Service status
docker-compose -f docker-compose.cache.yml ps > "$LOG_DIR/service-status.txt"

# Configuration
cp .env "$LOG_DIR/" 2>/dev/null || echo "No .env file" > "$LOG_DIR/env-missing.txt"
cp docker-compose.cache.yml "$LOG_DIR/"
cp -r deployment/ "$LOG_DIR/" 2>/dev/null

# Service logs
for service in redis-primary cache-manager prometheus grafana redis-sentinel; do
  docker logs "$service" > "$LOG_DIR/$service.log" 2>&1
done

# Health checks
curl -s http://localhost:8080/health > "$LOG_DIR/health-check.json" 2>&1
curl -s http://localhost:8080/stats > "$LOG_DIR/stats.json" 2>&1

# Create archive
tar czf "cache-support-logs-$TIMESTAMP.tar.gz" -C /tmp "cache-logs-$TIMESTAMP"
echo "Support logs collected: cache-support-logs-$TIMESTAMP.tar.gz"
```

### Common Support Information

When reporting issues, include:

1. **System Information**: OS, Docker version, available resources
2. **Service Status**: Output of monitoring script
3. **Configuration**: Environment variables and config files
4. **Logs**: Recent logs from all services
5. **Error Messages**: Exact error messages and timestamps
6. **Steps to Reproduce**: What actions led to the issue

### Contact Information

- **Documentation**: Check other docs in the `/docs` folder
- **Repository Issues**: Submit issues with log collection
- **Emergency**: Use emergency procedures above for immediate response

---

This troubleshooting guide should help resolve most common issues with the cache system. For issues not covered here, collect support logs and provide detailed information about the problem.