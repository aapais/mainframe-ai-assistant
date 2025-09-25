# Docker Infrastructure Setup Guide

## Current Status
✅ Docker Compose configuration (`docker-compose.yml`) - READY
✅ Database initialization script (`scripts/init-db.sql`) - READY
✅ Environment configuration (`.env`) - READY
✅ Startup script (`start-ai-system.sh`) - READY
❌ Docker daemon permissions - NEEDS RESOLUTION

## Issue Identified
Docker daemon permission error in WSL environment:
```
permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock
```

## Solutions

### Option 1: Docker Desktop (Recommended)
1. Ensure Docker Desktop is installed and running on Windows
2. Enable WSL 2 integration in Docker Desktop settings:
   - Open Docker Desktop
   - Go to Settings → Resources → WSL Integration
   - Enable integration with this WSL distribution
3. Restart WSL terminal and try again

### Option 2: Fix Docker Permissions
```bash
# Add user to docker group (already done)
sudo usermod -aG docker $USER

# Fix socket permissions
sudo chmod 666 /var/run/docker.sock

# Or restart with correct permissions
sudo systemctl restart docker
```

### Option 3: Manual Docker Commands
```bash
# Start services individually
sudo docker run -d --name postgres \
  -p 5432:5432 \
  -e POSTGRES_DB=ai_incident_system \
  -e POSTGRES_USER=ai_user \
  -e POSTGRES_PASSWORD=ai_secure_2025 \
  -v ./data/postgres:/var/lib/postgresql/data \
  -v ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql \
  postgres:15-alpine

sudo docker run -d --name redis \
  -p 6379:6379 \
  -v ./data/redis:/data \
  redis:7-alpine redis-server --appendonly yes --requirepass redis_secure_2025

sudo docker run -d --name chromadb \
  -p 8000:8000 \
  -v ./data/chroma:/chroma/chroma \
  -e CHROMA_SERVER_HOST=0.0.0.0 \
  -e CHROMA_SERVER_HTTP_PORT=8000 \
  chromadb/chroma:latest
```

## Infrastructure Services

### PostgreSQL Database
- **Image:** postgres:15-alpine
- **Port:** 5432
- **Database:** ai_incident_system
- **User:** ai_user
- **Password:** ai_secure_2025
- **Volume:** ./data/postgres
- **Init Script:** ./scripts/init-db.sql

### Redis Cache
- **Image:** redis:7-alpine
- **Port:** 6379
- **Password:** redis_secure_2025
- **Volume:** ./data/redis
- **Persistence:** AOF enabled

### ChromaDB Vector Database
- **Image:** chromadb/chroma:latest
- **Port:** 8000
- **Volume:** ./data/chroma
- **API Endpoint:** http://localhost:8000/api/v1/

## Database Schema
The PostgreSQL database includes:
- 🏢 **Business Areas:** Banking business units
- 🔧 **Technology Areas:** Technical domains
- 📱 **Application Modules:** System components
- 🎫 **Incidents:** Issue tracking
- 📚 **Knowledge Base:** Solutions and procedures
- 🤖 **AI Suggestions:** ML-powered recommendations
- 📊 **Vector Embeddings:** Semantic search metadata
- 🔍 **Audit System:** Compliance logging
- 🧠 **ML System:** Model training and feedback

## Network Configuration
- **Network:** ai-incident-network (bridge)
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379
- **ChromaDB:** localhost:8000

## Data Volumes
```
./data/
├── postgres/     # PostgreSQL data
├── redis/        # Redis persistence
└── chroma/       # ChromaDB collections
```

## Health Checks
Once running, verify services:
```bash
# PostgreSQL
docker exec postgres pg_isready -U ai_user -d ai_incident_system

# Redis
docker exec redis redis-cli -a redis_secure_2025 ping

# ChromaDB
curl http://localhost:8000/api/v1/heartbeat
```