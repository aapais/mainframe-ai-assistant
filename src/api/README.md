# Incident AI Server

Express.js server that provides AI-powered incident management with LLM
integration, vector search, and LGPD compliance.

## Features

### Core Functionality

- **Incident Creation** with AI-powered categorization
- **Semantic Search** with RAG (Retrieval Augmented Generation)
- **Similar Incident Detection** using advanced algorithms
- **Vector Search** with ChromaDB integration
- **LGPD Compliance** with automatic data masking

### LLM Integration

- **Google Gemini** - Primary AI service
- **OpenAI GPT** - Alternative AI service
- **Anthropic Claude** - Advanced reasoning
- **Azure OpenAI** - Enterprise AI service

### Advanced Features

- Rate limiting and security headers
- Comprehensive validation
- Bulk operations support
- Analytics and trends
- Real-time monitoring
- Graceful error handling

## Quick Start

### 1. Install Dependencies

```bash
cd src/api
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### 3. Start ChromaDB (Optional)

```bash
# Using Docker
docker run -p 8000:8000 chromadb/chroma

# Or install locally
pip install chromadb
chroma run --host localhost --port 8000
```

### 4. Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

### Incident Management

#### Create Incident with AI Categorization

```
POST /api/incidents/create
Content-Type: application/json

{
  "title": "S0C7 Data Exception in PAYROLL batch",
  "problem": "Getting S0C7 abend when processing payroll data",
  "solution": "Check for uninitialized COMP-3 fields",
  "priority": "high",
  "created_by": "user123"
}
```

#### Find Similar Incidents

```
POST /api/incidents/similar
Content-Type: application/json

{
  "incident_id": 123,
  "threshold": 0.7,
  "limit": 20,
  "use_ai": true
}
```

### Search Operations

#### Semantic Search with RAG

```
GET /api/search/semantic?q=S0C7%20data%20exception&limit=20&use_vector=true&use_llm=true
```

#### Vector Search

```
POST /api/search/vector
Content-Type: application/json

{
  "query": "database connection timeout",
  "limit": 15,
  "threshold": 0.3
}
```

### AI Services

#### Categorize Incident

```
POST /api/incidents/categorize
Content-Type: application/json

{
  "text": "JCL job failing with allocation error",
  "llm_provider": "gemini"
}
```

### Data Compliance

#### Mask Sensitive Data (LGPD)

```
POST /api/incidents/mask
Content-Type: application/json

{
  "data": {
    "title": "User john.doe@company.com having issues",
    "problem": "User with CPF 123.456.789-00 cannot access"
  },
  "fields": ["email", "cpf"]
}
```

### Bulk Operations

```
POST /api/incidents/bulk
Content-Type: application/json

{
  "operation": "create",
  "incidents": [
    {
      "title": "Issue 1",
      "problem": "Problem description",
      "category": "JCL"
    }
  ]
}
```

### Analytics

#### Summary Analytics

```
GET /api/analytics/summary
```

#### Trends Analysis

```
GET /api/analytics/trends?period=30d&category=JCL
```

## Configuration

### Environment Variables

| Variable               | Description              | Default               |
| ---------------------- | ------------------------ | --------------------- |
| `PORT`                 | Server port              | 3001                  |
| `NODE_ENV`             | Environment              | development           |
| `GEMINI_API_KEY`       | Google Gemini API key    | -                     |
| `OPENAI_API_KEY`       | OpenAI API key           | -                     |
| `CLAUDE_API_KEY`       | Anthropic Claude API key | -                     |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key     | -                     |
| `CHROMA_URL`           | ChromaDB URL             | http://localhost:8000 |
| `LGPD_ENABLED`         | Enable LGPD compliance   | true                  |

### LLM Provider Configuration

#### Gemini (Google AI)

```javascript
{
  llm: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-pro',
      temperature: 0.3
    }
  }
}
```

#### OpenAI

```javascript
{
  llm: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: 'your-org-id'
    }
  }
}
```

#### Anthropic Claude

```javascript
{
  llm: {
    claude: {
      apiKey: process.env.CLAUDE_API_KEY;
    }
  }
}
```

#### Azure OpenAI

```javascript
{
  llm: {
    azure: {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: '2024-02-01'
    }
  }
}
```

## Integration Examples

### Using with Existing Services

The server integrates with existing service files:

```javascript
const {
  KnowledgeBaseService,
  ValidationService,
  EnhancedSearchService,
  CategoryService,
  DuplicateDetectionService,
} = require('../services');
```

### Swarm Coordination

When used with Claude Flow, the server coordinates with the swarm:

```bash
# Initialize swarm coordination
npx claude-flow@alpha hooks pre-task --description "API server operations"

# Notify during operations
npx claude-flow@alpha hooks notify --message "Incident created successfully"

# Complete task coordination
npx claude-flow@alpha hooks post-task --task-id "api-task-123"
```

## LGPD Compliance

### Automatic Data Masking

The server automatically masks sensitive data when `LGPD_ENABLED=true`:

- **Email addresses**: `user@domain.com` → `***@***.***`
- **CPF numbers**: `123.456.789-00` → `***.***.***-**`
- **Phone numbers**: `(11) 99999-9999` → `(##) ####-####`

### Custom Masking

```javascript
// Mask specific fields
const masked = server.applySensitiveDataMasking(data, ['email', 'phone']);

// Configure in environment
((LGPD_MASK_FIELDS = email), cpf, phone, address);
```

## Performance Features

### Rate Limiting

- 100 requests per 15 minutes by default
- Configurable per endpoint
- IP-based tracking

### Caching

- Built-in memory caching
- Redis support (optional)
- TTL-based expiration

### Vector Search

- ChromaDB integration
- Embeddings-based similarity
- Fallback to text search

### Response Compression

- Gzip compression enabled
- Automatic content-type detection
- Bandwidth optimization

## Monitoring

### Health Endpoint

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "database": true,
    "llm": ["gemini", "openai"],
    "chroma": true
  }
}
```

### Error Handling

- Structured error responses
- Request correlation IDs
- Comprehensive logging
- Graceful degradation

## Security

### Built-in Security

- Helmet.js security headers
- CORS configuration
- Input validation
- SQL injection prevention
- XSS protection

### Authentication (Optional)

The server is designed to work with external authentication:

```javascript
// Add authentication middleware
app.use('/api', authenticateToken);

function authenticateToken(req, res, next) {
  // Your authentication logic
}
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### API Documentation

```bash
npm run docs
```

### Hot Reload Development

```bash
npm run dev
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment-specific Configs

- Development: Auto-reload, verbose logging
- Production: Optimized, security headers
- Testing: Mock services, in-memory database

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Failed**
   - Ensure ChromaDB is running on specified port
   - Check firewall settings
   - Verify CHROMA_URL environment variable

2. **LLM API Errors**
   - Validate API keys are set correctly
   - Check API quotas and limits
   - Verify internet connectivity

3. **Database Issues**
   - Ensure write permissions to database path
   - Check disk space availability
   - Verify SQLite installation

### Debug Mode

```bash
DEBUG=incident-ai:* npm run dev
```

### Logs Location

- Development: Console output
- Production: `./logs/incident-ai-server.log`
- Error logs: `./logs/error.log`

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Ensure LGPD compliance
5. Test with all LLM providers

## License

MIT License - see LICENSE file for details.
