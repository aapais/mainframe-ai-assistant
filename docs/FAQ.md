# Frequently Asked Questions (FAQ)

## 🚀 Installation & Setup

### Q: How do I get started quickly?
**A:** Run these 3 commands:
```bash
npm run docker:postgres
npm run start:backend:enhanced
npm start
```
See [QUICK_START.md](QUICK_START.md) for details.

### Q: The backend server won't start. What should I do?
**A:** Check if port 3001 is in use:
```bash
# Check port usage
lsof -i :3001

# Kill existing processes
pkill -f enhanced-server

# Restart with debug mode
NODE_ENV=development npm run start:backend:enhanced
```

### Q: Docker isn't installed. Can I still run the system?
**A:** Yes, but you'll need to set up PostgreSQL manually:
1. Install PostgreSQL 16 with pgvector extension
2. Create database: `mainframe_ai`
3. Update `.env` with connection details:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mainframe_ai
   DB_USER=your_user
   DB_PASSWORD=your_password
   ```

### Q: What versions are supported?
**A:**
- **Node.js**: 18.0+ (LTS recommended)
- **PostgreSQL**: 16+ with pgvector extension
- **Docker**: Any recent version (20.10+)
- **Python**: 3.8+ (for legacy scripts only)

## 🔧 Backend & API Issues

### Q: I get "Database connection failed" errors
**A:** Follow these troubleshooting steps:
```bash
# 1. Check if PostgreSQL is running
docker ps | grep postgres

# 2. Restart database container
npm run docker:down
npm run docker:postgres

# 3. Wait 30 seconds for initialization
sleep 30

# 4. Check database status
curl http://localhost:3001/api/migration/status

# 5. View database logs if needed
docker logs mainframe-ai-postgres
```

### Q: The API returns "CORS error" from my browser
**A:** This usually happens in development. The backend should have CORS enabled. Check:
```bash
# Verify backend is running
curl http://localhost:3001/api/health

# Check CORS headers in response
curl -I http://localhost:3001/api/incidents
```

### Q: No incidents are showing up (empty database)
**A:** The system should auto-load 17 sample incidents. If not:
```bash
# Check migration status
curl http://localhost:3001/api/migration/status

# Expected response should show:
# "postgres_entries": 17

# If 0 entries, restart the database:
npm run docker:down
npm run docker:postgres
```

### Q: How do I add my own incidents?
**A:** Use the API to create incidents:
```bash
curl -X POST http://localhost:3001/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Your Incident Title",
    "description": "Detailed description of the issue",
    "technical_area": "DATABASE",
    "severity": "HIGH",
    "reporter": "your-email@company.com"
  }'
```

## 🤖 AI Integration

### Q: Vector search isn't working
**A:** Vector search requires AI API keys. Check:
```bash
# 1. Verify AI service status
curl http://localhost:3001/api/health
# Look for "embedding": true

# 2. If false, add API keys to .env:
echo "OPENAI_API_KEY=sk-your-actual-key" >> .env

# 3. Restart backend server
# 4. Test model validation:
curl -X POST http://localhost:3001/api/validate-model \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-key",
    "model": "text-embedding-ada-002"
  }'
```

### Q: Which AI providers are supported?
**A:** Current support:
- **OpenAI**: text-embedding-ada-002 (primary)
- **Azure OpenAI**: Same models, different endpoint
- **Claude (Anthropic)**: Available as fallback
- **Model Fallback**: Automatically tries backup providers

### Q: How much do AI API calls cost?
**A:** Approximate costs (OpenAI pricing):
- **Creating incident**: ~$0.0001 (generates embedding)
- **Vector search**: ~$0.0001 per query
- **Batch operations**: Scales linearly
- **Daily usage**: ~$0.01-0.10 for typical use

### Q: Can I use the system without AI features?
**A:** Yes! Without API keys, you still get:
- Full incident management (CRUD operations)
- PostgreSQL full-text search
- Desktop application functionality
- All non-AI features work normally

## 🖥️ Desktop Application

### Q: The Electron app won't launch
**A:** Try these steps:
```bash
# 1. Clear Electron cache
rm -rf node_modules/.cache

# 2. Reinstall dependencies
npm install

# 3. Try development mode first
npm run electron:dev

# 4. If that works, try production mode
npm start
```

### Q: Desktop app shows "Cannot connect to backend"
**A:** The app needs the backend server running:
```bash
# 1. Start backend in another terminal
npm run start:backend:enhanced

# 2. Verify it's running
curl http://localhost:3001/api/health

# 3. Then launch desktop app
npm start
```

### Q: How do I build the desktop app for distribution?
**A:**
```bash
# Build for current platform
npm run build

# Cross-platform builds
npm run build:win    # Windows installer
npm run build:mac    # macOS .app bundle
npm run build:linux  # Linux AppImage

# Output in ./dist/ folder
```

### Q: The desktop app window is too small/large
**A:** Edit `main.js` to adjust window size:
```javascript
mainWindow = new BrowserWindow({
  width: 1600,  // Adjust width
  height: 1000, // Adjust height
  // ... other options
});
```

## 🔍 Search & Data

### Q: Search results seem irrelevant
**A:** Try different search approaches:
```bash
# 1. Text search (exact matching)
curl "http://localhost:3001/api/incidents/search?q=exact+terms"

# 2. Vector search (semantic, requires AI)
curl -X POST http://localhost:3001/api/incidents/vector-search \
  -d '{"query": "describe the problem in natural language"}'

# 3. Filtered search
curl -X POST http://localhost:3001/api/incidents/vector-search \
  -d '{
    "query": "your search",
    "technical_area": "DATABASE",
    "threshold": 0.8
  }'
```

### Q: How can I import existing incident data?
**A:** Currently via API. For bulk import:
```bash
# Create a script to POST each incident
for incident in your_data; do
  curl -X POST http://localhost:3001/api/incidents \
    -H "Content-Type: application/json" \
    -d "$incident_json"
done
```

### Q: Can I export my data?
**A:** Yes, via API:
```bash
# Export all incidents
curl http://localhost:3001/api/incidents > incidents_backup.json

# Export search results
curl "http://localhost:3001/api/incidents/search?q=filter" > filtered_data.json
```

## 🐳 Docker & Deployment

### Q: Docker containers keep crashing
**A:** Check logs and resources:
```bash
# View container logs
docker logs mainframe-ai-postgres

# Check resource usage
docker stats

# Restart with fresh state
docker-compose down
docker system prune -f
docker-compose up -d postgres
```

### Q: How do I deploy this in production?
**A:** Current setup is for development. For production:
1. Use external PostgreSQL (not Docker)
2. Set production environment variables
3. Configure proper authentication/security
4. Use process manager (PM2) for backend
5. Set up reverse proxy (nginx)

### Q: Can I use a different database?
**A:** Currently PostgreSQL is required for:
- Vector search (pgvector extension)
- Full-text search performance
- JSON metadata support
- Production scalability

SQLite is maintained for legacy/migration only.

## 🔒 Security & Configuration

### Q: How do I secure the API endpoints?
**A:** Current version is for development. For production:
```javascript
// Add authentication middleware
app.use('/api', authenticateToken);

// Add rate limiting
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Use HTTPS
// Configure proper CORS origins
```

### Q: Where should I store API keys securely?
**A:** Use environment variables and `.env` file:
```bash
# .env (never commit to git)
OPENAI_API_KEY=sk-your-key
CLAUDE_API_KEY=sk-ant-your-key
DB_PASSWORD=secure_password

# In production, use:
# - Docker secrets
# - AWS Parameter Store
# - Azure Key Vault
# - HashiCorp Vault
```

### Q: The system logs show API keys in plaintext
**A:** This shouldn't happen in production. Check:
```bash
# Logs should show masked keys
grep -r "sk-" logs/  # Should not show full keys

# If keys are exposed, restart with proper masking
NODE_ENV=production npm run start:backend:enhanced
```

## 🐛 Performance & Debugging

### Q: The system feels slow
**A:** Check performance metrics:
```bash
# Backend health check (should be <50ms)
time curl http://localhost:3001/api/health

# Database performance
curl http://localhost:3001/api/migration/status

# Check system resources
docker stats
htop  # or Activity Monitor on Mac
```

### Q: How do I enable debug logging?
**A:**
```bash
# Start backend with debug mode
NODE_ENV=development npm run start:backend:enhanced

# Check logs
tail -f logs/backend.log  # if logging to file

# API request debugging
curl -H "X-Debug: true" http://localhost:3001/api/incidents
```

### Q: Memory usage keeps growing
**A:** This could indicate memory leaks:
```bash
# Restart backend periodically
pkill -f enhanced-server
npm run start:backend:enhanced

# Monitor memory usage
ps aux | grep enhanced-server

# For production, use PM2 with memory limits
npm install -g pm2
pm2 start src/backend/enhanced-server.js --max-memory-restart 200M
```

## 🔄 Migration & Updates

### Q: How do I upgrade from v1.0.0 to v2.0.0?
**A:** See [CHANGELOG.md](CHANGELOG.md) for detailed upgrade instructions:
```bash
# 1. Backup existing SQLite data
cp kb-assistant.db kb-assistant.db.backup

# 2. Install new dependencies
npm install

# 3. Start PostgreSQL
npm run docker:postgres

# 4. Run migration
npm run migrate:run

# 5. Verify migration
curl http://localhost:3001/api/migration/status
```

### Q: Can I roll back to the previous version?
**A:** Yes, but with limitations:
```bash
# 1. Stop current services
npm run docker:down
pkill -f enhanced-server

# 2. Restore SQLite backup
cp kb-assistant.db.backup kb-assistant.db

# 3. Checkout previous version
git checkout v1.0.0

# 4. Install old dependencies
npm install

# Note: You'll lose PostgreSQL-specific data
```

### Q: How do I get the latest updates?
**A:**
```bash
# Pull latest code
git pull origin master

# Update dependencies
npm install

# Check for breaking changes
cat CHANGELOG.md

# Restart services
npm run docker:down
npm run docker:postgres
npm run start:backend:enhanced
```

## 💬 Community & Support

### Q: Where do I report bugs?
**A:**
- **GitHub Issues**: https://github.com/aapais/mainframe-ai-assistant/issues
- **Include**: Version, OS, error messages, steps to reproduce
- **Logs**: Check console output and include relevant errors

### Q: How can I contribute to the project?
**A:** See [CONTRIBUTING.md](CONTRIBUTING.md):
1. Fork the repository
2. Create feature branch
3. Follow coding standards
4. Add tests
5. Update documentation
6. Submit pull request

### Q: Where can I find more help?
**A:**
- **Documentation**: `/docs` folder
- **API Reference**: [api/API_DOCUMENTATION.md](api/API_DOCUMENTATION.md)
- **Architecture**: [architecture/SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md)
- **GitHub Discussions**: For questions and ideas

## 🔧 Development Questions

### Q: How do I add a new API endpoint?
**A:** Edit `src/backend/enhanced-server.js`:
```javascript
// Add new endpoint
app.get('/api/your-endpoint', async (req, res) => {
  try {
    // Your logic here
    const result = await db.query('SELECT ...');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Q: How do I modify the database schema?
**A:** Edit `scripts/database/schema.sql`:
```sql
-- Add new column
ALTER TABLE incidents_enhanced
ADD COLUMN your_new_field VARCHAR(100);

-- Update existing records
UPDATE incidents_enhanced
SET your_new_field = 'default_value';
```
Then restart the database container.

### Q: How do I add support for a new AI provider?
**A:** Edit `src/services/embedding-service.js`:
```javascript
// Add to supportedProviders
const supportedProviders = {
  openai: OpenAIProvider,
  azure: AzureProvider,
  claude: ClaudeProvider,
  yourProvider: YourProviderClass  // Add here
};

// Implement provider class
class YourProviderClass {
  async generateEmbedding(text) {
    // Your API integration
    return embedding_array;  // 1536 dimensions
  }
}
```

---

## 🚨 Emergency Troubleshooting

If everything breaks:
```bash
# 1. Nuclear option - reset everything
npm run docker:down
docker system prune -f
rm -rf node_modules
rm package-lock.json

# 2. Fresh install
npm install

# 3. Restart from scratch
npm run docker:postgres
npm run start:backend:enhanced
npm start

# 4. Check health
curl http://localhost:3001/api/health
```

Still having issues? [Create a GitHub Issue](https://github.com/aapais/mainframe-ai-assistant/issues) with:
- Error messages
- System information (`node --version`, `docker --version`)
- Steps you tried
- Expected vs actual behavior