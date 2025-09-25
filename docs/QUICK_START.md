# Quick Start Guide - Mainframe AI Assistant

**Get up and running in 5 minutes with real, working commands.**

## 🎯 Prerequisites

- **Node.js 18+** (check: `node --version`)
- **Docker** (for PostgreSQL database)
- **Git** (for cloning/development)

## ⚡ Quick Setup (3 Commands)

```bash
# 1. Start PostgreSQL database
npm run docker:postgres

# 2. Start the backend API server
npm run start:backend:enhanced

# 3. Launch desktop application
npm start
```

**That's it!** The system will be running with:
- Desktop app in Electron window
- Backend API at http://localhost:3001
- PostgreSQL database with 17 sample incidents

## 🔍 Verify Installation

### Check Backend Health
```bash
curl http://localhost:3001/api/health
```

**Expected Response**:
```json
{
  "success": true,
  "status": "healthy",
  "database": {"type": "PostgreSQL", "connected": true},
  "services": {"embedding": true, "vector_search": true}
}
```

### Check Database Data
```bash
curl http://localhost:3001/api/incidents
```

**Expected**: JSON response with 17 incidents loaded

### Check Desktop App
The Electron application should open automatically showing:
- Main dashboard with incident list
- Search functionality
- Real-time data from PostgreSQL

## 🔧 Development Setup (Full)

If you need the complete development environment:

```bash
# 1. Clone repository (if needed)
git clone https://github.com/aapais/mainframe-ai-assistant.git
cd mainframe-ai-assistant

# 2. Install dependencies
npm install

# 3. Configure environment (optional but recommended)
cp .env.example .env
# Edit .env with your AI API keys:
# OPENAI_API_KEY=sk-your-openai-key
# CLAUDE_API_KEY=sk-ant-your-claude-key

# 4. Start PostgreSQL
npm run docker:postgres
# Wait 30 seconds for database initialization

# 5. Start backend server
npm run start:backend:enhanced

# 6. Verify backend is running
curl http://localhost:3001/api/health

# 7. Launch desktop app
npm run electron:dev

# 8. Run tests (optional)
npm test
```

## 🐳 Docker-First Setup

For a completely containerized environment:

```bash
# Start all services with Docker Compose
docker-compose up -d postgres redis

# Optional: Add admin tools
docker-compose --profile admin up -d

# Access services:
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - pgAdmin: localhost:5050 (admin@mainframe.local / admin123)
```

## 🎯 API Quick Test

Test the main API endpoints:

```bash
# Health check
curl http://localhost:3001/api/health

# List all incidents (should return 17)
curl http://localhost:3001/api/incidents

# Search incidents
curl "http://localhost:3001/api/incidents/search?q=database"

# Create new incident
curl -X POST http://localhost:3001/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Incident",
    "description": "Quick start test incident",
    "reporter": "quickstart@test.com"
  }'

# Vector search (requires AI API key in .env)
curl -X POST http://localhost:3001/api/incidents/vector-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database connection issues",
    "limit": 5
  }'
```

## 🤖 AI Integration (Optional)

To enable AI-powered vector search:

```bash
# 1. Get API keys from:
# - OpenAI: https://platform.openai.com/api-keys
# - Claude: https://console.anthropic.com/
# - Azure: https://portal.azure.com/

# 2. Add to .env file:
echo "OPENAI_API_KEY=sk-your-actual-key" >> .env
echo "CLAUDE_API_KEY=sk-ant-your-actual-key" >> .env

# 3. Restart backend server
# The backend will automatically detect and use AI services

# 4. Test AI model validation:
curl -X POST http://localhost:3001/api/validate-model \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-actual-key",
    "model": "text-embedding-ada-002"
  }'
```

## 🚀 Production Builds

Build desktop applications for distribution:

```bash
# Build for current platform
npm run build

# Cross-platform builds
npm run build:win    # Windows installer
npm run build:mac    # macOS app bundle
npm run build:linux  # Linux AppImage

# Built apps will be in ./dist/ folder
```

## 🔧 Common Issues & Solutions

### Backend Won't Start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill existing process
pkill -f enhanced-server

# Start with debug logging
NODE_ENV=development npm run start:backend:enhanced
```

### Database Issues
```bash
# Reset database completely
npm run docker:down
npm run docker:postgres

# Check database status
curl http://localhost:3001/api/migration/status

# View database logs
docker logs mainframe-ai-postgres
```

### Desktop App Issues
```bash
# Clear Electron cache
rm -rf node_modules/.cache

# Reinstall dependencies
npm install

# Try development mode
npm run electron:dev
```

### No AI Features
```bash
# Check if API keys are set
curl http://localhost:3001/api/migration/status
# Look for "embedding_service_available": true

# Test API key validity
curl -X POST http://localhost:3001/api/validate-model \
  -d '{"provider":"openai","apiKey":"your-key","model":"text-embedding-ada-002"}'
```

## 📊 What's Included

After quick setup, you'll have:

### Database
- **PostgreSQL 16** with pgvector extension
- **17 sample incidents** from real scenarios
- **Full-text search** with tsvector indexing
- **Vector embeddings** (if AI keys provided)

### API Server
- **Node.js Express** server on port 3001
- **RESTful endpoints** for CRUD operations
- **Search capabilities** (text + vector)
- **Health monitoring** and status endpoints

### Desktop Application
- **Electron-based** cross-platform app
- **Real-time interface** connected to PostgreSQL
- **Incident management** workflows
- **Search and filtering** capabilities

### Development Tools
- **Hot reload** for backend changes
- **Docker Compose** for database services
- **Health check** endpoints for monitoring
- **Migration tools** for data management

## 🎯 Next Steps

1. **Explore the API**: Try the endpoints in [API_DOCUMENTATION.md](api/API_DOCUMENTATION.md)
2. **Customize Data**: Add your own incidents via the API or desktop interface
3. **Enable AI**: Add API keys to unlock vector search capabilities
4. **Read Architecture**: Understanding in [SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md)
5. **Contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow

## 🆘 Need Help?

- **Health Check**: http://localhost:3001/api/health
- **Database Status**: http://localhost:3001/api/migration/status
- **Full Documentation**: `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/aapais/mainframe-ai-assistant/issues)

---

**🎉 You're ready to go! The Mainframe AI Assistant is now running locally.**