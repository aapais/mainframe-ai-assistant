# Contributing to Mainframe AI Assistant

Thank you for your interest in contributing to the Accenture Mainframe AI Assistant! This guide will help you get started with our development workflow.

## 🚀 Quick Start for Contributors

### Prerequisites
- **Node.js 18+** (for backend and Electron)
- **Python 3.8+** (for legacy scripts)
- **Docker** (for PostgreSQL development)
- **Git** (version control)

### Development Setup
```bash
# 1. Fork and clone the repository
git clone https://github.com/your-username/mainframe-ai-assistant.git
cd mainframe-ai-assistant

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Start development database
npm run docker:postgres

# 5. Start backend in development mode
npm run start:backend:enhanced

# 6. Launch desktop app for testing
npm run electron:dev
```

## 🏗️ Project Structure

### Current Architecture (v2.0.0)
```
mainframe-ai-assistant/
├── src/
│   ├── backend/
│   │   ├── enhanced-server.js     # Main API server
│   │   └── document-processor-api.js
│   ├── services/
│   │   ├── embedding-service.js   # AI embeddings
│   │   └── model-validation-service.js
│   └── api/                       # Additional API modules
├── scripts/
│   ├── database/                  # PostgreSQL setup
│   └── migration/                 # SQLite→PostgreSQL
├── docs/                          # Documentation
├── main.js                        # Electron main process
├── package.json                   # Dependencies & scripts
└── docker-compose.yml             # Development containers
```

### Key Components
- **Backend**: Node.js Express server (`src/backend/enhanced-server.js`)
- **Frontend**: Electron desktop application (`main.js`)
- **Database**: PostgreSQL with pgvector extension
- **AI Integration**: OpenAI, Claude, Azure OpenAI APIs
- **Vector Search**: pgvector + OpenAI embeddings

## 🔧 Development Workflow

### 1. Feature Development Process

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes
# - Follow existing code patterns
# - Add tests for new functionality
# - Update documentation as needed

# 3. Test your changes
npm test
npm run docker:postgres  # Test with fresh database

# 4. Verify API endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/incidents

# 5. Commit with descriptive messages
git add .
git commit -m "feat: add incident auto-categorization feature"

# 6. Push and create pull request
git push origin feature/your-feature-name
```

### 2. Code Standards

#### Backend Development (Node.js)
```javascript
// ✅ Good: Follow existing patterns
const express = require('express');
const { Client } = require('pg');

// Use consistent error handling
app.get('/api/endpoint', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM table');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in endpoint:', error);
    res.status(500).json({ success: false, error: 'Operation failed' });
  }
});

// ✅ Good: Use parameterized queries
const result = await db.query(
  'SELECT * FROM incidents WHERE title = $1',
  [searchTerm]
);
```

#### API Response Format
```javascript
// ✅ Consistent success response
{
  "success": true,
  "data": [...],
  "count": 17,
  "message": "Optional success message"
}

// ✅ Consistent error response
{
  "success": false,
  "error": "Error description",
  "details": "Additional error context"
}
```

#### Database Interactions
```javascript
// ✅ Good: Use DatabaseManager class
const result = await db.query(sql, params);

// ✅ Good: Support both PostgreSQL and SQLite
const query = QueryBuilder.buildGetIncidentsQuery(db.isPostgres);

// ❌ Avoid: Direct SQL without parameterization
const query = `SELECT * FROM incidents WHERE id = ${unsafeId}`;
```

### 3. Testing Guidelines

#### API Testing
```bash
# Start backend server
npm run start:backend:enhanced

# Test health endpoint
curl http://localhost:3001/api/health

# Test incidents endpoint
curl http://localhost:3001/api/incidents

# Test search functionality
curl "http://localhost:3001/api/incidents/search?q=database"

# Test vector search (requires AI API key)
curl -X POST http://localhost:3001/api/incidents/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "database connection issues", "limit": 5}'
```

#### Database Testing
```bash
# Fresh database for testing
npm run docker:postgres
# Wait 30 seconds for initialization

# Check database connection
curl http://localhost:3001/api/migration/status
```

#### Frontend Testing
```bash
# Launch desktop app
npm run electron:dev

# Build for current platform
npm run build

# Test cross-platform builds
npm run build:win
npm run build:mac
npm run build:linux
```

### 4. AI/ML Integration

#### Adding New AI Providers
```javascript
// Example: Add new AI provider to EmbeddingService
const supportedProviders = {
  openai: OpenAIProvider,
  azure: AzureProvider,
  claude: ClaudeProvider,
  yourProvider: YourProviderClass  // Add here
};

// Implement provider interface
class YourProviderClass {
  async generateEmbedding(text) {
    // Return array of numbers (embedding vector)
    return [0.1, 0.2, ...]; // 1536 dimensions for compatibility
  }

  isAvailable() {
    return this.apiKey && this.endpoint;
  }
}
```

#### Vector Search Enhancement
```sql
-- Add new embedding columns to PostgreSQL
ALTER TABLE incidents_enhanced
ADD COLUMN custom_embedding VECTOR(512);  -- Different dimensions

-- Update search query to use multiple embeddings
SELECT *,
  (1 - (embedding <=> $1::vector)) as openai_similarity,
  (1 - (custom_embedding <=> $2::vector)) as custom_similarity
FROM incidents_enhanced;
```

## 🐛 Bug Reporting & Fixes

### Bug Report Template
```markdown
**Bug Description**: Brief description

**Steps to Reproduce**:
1. Start backend server
2. Execute API call: `curl ...`
3. See error response

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- OS: Windows 11 / macOS / Linux
- Node.js version: 18.x
- Database: PostgreSQL/SQLite
- Backend status: `curl localhost:3001/api/health`

**Additional Context**: Any relevant logs or screenshots
```

### Common Issues & Solutions

#### Backend Server Won't Start
```bash
# Check if port 3001 is available
lsof -i :3001

# Kill existing processes
pkill -f "enhanced-server.js"

# Start with verbose logging
NODE_ENV=development npm run start:backend:enhanced
```

#### Database Connection Issues
```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Restart database container
npm run docker:down
npm run docker:postgres

# Check database status
curl http://localhost:3001/api/migration/status
```

#### AI API Integration Issues
```bash
# Test API key validity
curl http://localhost:3001/api/validate-model \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-key",
    "model": "text-embedding-ada-002"
  }'
```

## 📖 Documentation Updates

### When to Update Documentation
- Adding new API endpoints
- Changing existing endpoint behavior
- Adding new environment variables
- Modifying database schema
- Adding new AI providers

### Documentation Files to Update
```bash
docs/
├── README.md                    # Main project overview
├── API_DOCUMENTATION.md         # Complete API reference
├── QUICK_START_GUIDE.md        # Setup instructions
├── architecture/
│   └── SYSTEM_OVERVIEW.md      # Architecture documentation
└── development/
    └── DEVELOPER_WORKFLOW.md   # This file
```

### API Documentation Updates
```javascript
// When adding new endpoints, document them:

/**
 * POST /api/incidents/bulk-import
 *
 * Import multiple incidents from CSV/JSON
 *
 * Request Body:
 * {
 *   "format": "csv|json",
 *   "data": "base64-encoded-file-content"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "imported": 15,
 *   "errors": []
 * }
 */
```

## 🚀 Deployment & Release

### Release Process
```bash
# 1. Update version in package.json
npm version patch|minor|major

# 2. Build all platforms
npm run build:win
npm run build:mac
npm run build:linux

# 3. Test builds on target platforms
# 4. Create GitHub release with binaries
# 5. Update documentation
```

### Docker Deployment
```bash
# Build production container
docker build -t mainframe-ai-assistant .

# Deploy with docker-compose
docker-compose --profile app up -d
```

## 🤝 Community Guidelines

### Code Review Process
1. **Automated checks** must pass (linting, basic tests)
2. **Manual review** by at least one maintainer
3. **API compatibility** must be maintained
4. **Documentation** must be updated for user-facing changes
5. **Security review** for authentication/database changes

### Pull Request Template
```markdown
## Changes Made
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Description
Brief description of changes made

## Testing Done
- [ ] API endpoints tested manually
- [ ] Desktop app tested
- [ ] Database migration verified
- [ ] Documentation updated

## Breaking Changes
List any breaking changes and migration steps
```

## 📞 Getting Help

- **Issues**: [GitHub Issues](https://github.com/aapais/mainframe-ai-assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aapais/mainframe-ai-assistant/discussions)
- **Documentation**: `/docs` folder in repository
- **API Status**: http://localhost:3001/api/health

---

**Happy Contributing! 🎉**

The Accenture Mainframe AI Assistant team appreciates your contributions to making enterprise AI more accessible and powerful.