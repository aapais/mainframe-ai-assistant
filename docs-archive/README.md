# Documentation - Mainframe KB Assistant MVP1

Welcome to the comprehensive documentation for the Mainframe KB Assistant MVP1! This documentation provides everything developers need to understand, integrate, and extend the knowledge base system.

## 📖 Documentation Index

### For Developers

| Document | Purpose | Audience |
|----------|---------|----------|
| [**API Documentation**](./API_DOCUMENTATION.md) | Complete TypeScript API reference | Developers integrating the system |
| [**Developer Quick Start**](./DEVELOPER_QUICK_START.md) | Get up and running in 15 minutes | New developers, rapid prototyping |
| [**Database Schema**](./DATABASE_SCHEMA.md) | Database structure and relationships | Database administrators, system architects |

### For Users

| Document | Purpose | Audience |
|----------|---------|----------|
| [**User Guide**](../README.md) | End-user functionality and features | Support staff, knowledge base users |
| [**Installation Guide**](./INSTALLATION.md) | Setup and deployment instructions | System administrators |

### For Contributors

| Document | Purpose | Audience |
|----------|---------|----------|
| [**Contributing Guidelines**](./CONTRIBUTING.md) | How to contribute to the project | Open source contributors |
| [**Testing Guide**](./TESTING.md) | Testing strategies and practices | Quality assurance, developers |

## 🚀 Getting Started

Choose your path based on your role:

### I'm a Developer Integrating the API
👉 Start with [**Developer Quick Start**](./DEVELOPER_QUICK_START.md)

```typescript
// Your first knowledge base integration
import { createKnowledgeDB } from './src/database/KnowledgeDB';

const db = await createKnowledgeDB('./knowledge.db');
const results = await db.search('VSAM status 35');
```

### I Need Complete API Reference
👉 Go to [**API Documentation**](./API_DOCUMENTATION.md)

- Complete interface definitions
- Method signatures and parameters
- Usage examples and best practices
- Integration patterns

### I'm Setting Up the Database
👉 Check [**Database Schema**](./DATABASE_SCHEMA.md)

- Complete schema documentation
- Relationship diagrams
- Performance indexes
- Migration procedures

### I'm an End User
👉 See the [**Main README**](../README.md)

- Feature overview
- User interface guide
- Common workflows

## 🏗️ Architecture Overview

The Mainframe KB Assistant is built with a modular, performant architecture:

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Frontend (React)  │    │  Database (SQLite)  │    │   AI Service       │
│                     │    │                     │    │   (Gemini)          │
│ • Search Interface  │───▶│ • KB Entries        │◀──▶│ • Semantic Search   │
│ • Entry Management  │    │ • Usage Metrics     │    │ • Error Explanation │
│ • Analytics         │    │ • Search History    │    │ • Tag Generation    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
          │                           │                           │
          │                           │                           │
          └───────────────┬───────────┴───────────────┬───────────┘
                          │                           │
                 ┌─────────────────────┐    ┌─────────────────────┐
                 │  Main Process       │    │  Performance        │
                 │  (Electron)         │    │  Monitoring         │
                 │                     │    │                     │
                 │ • Database Manager  │    │ • Query Optimization│
                 │ • Backup System     │    │ • Caching Layer     │
                 │ • Migration Manager │    │ • Health Checks     │
                 └─────────────────────┘    └─────────────────────┘
```

### Key Components

1. **KnowledgeDB Class** - Main database interface
   - CRUD operations for knowledge entries
   - Advanced search with multiple algorithms
   - Performance monitoring and optimization

2. **GeminiService Class** - AI integration
   - Semantic similarity search
   - Error code explanations
   - Quality assessment and suggestions

3. **Database Schema** - Optimized SQLite design
   - Full-text search with FTS5
   - Performance indexes
   - Usage analytics

## 🔧 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18, TypeScript | User interface |
| **Backend** | Node.js, Electron | Desktop application |
| **Database** | SQLite with FTS5 | Local storage and search |
| **AI** | Google Gemini API | Semantic understanding |
| **Build** | Vite, TypeScript | Development tools |
| **Testing** | Jest, Testing Library | Quality assurance |

## 📊 Performance Characteristics

| Operation | Target Time | Notes |
|-----------|-------------|-------|
| Simple search | < 50ms | With indexes |
| Full-text search | < 200ms | FTS5 optimized |
| Entry creation | < 10ms | Single transaction |
| AI search | < 2s | With fallback |
| Database startup | < 1s | Including migrations |

## 🎯 Use Cases

### Primary Use Cases

1. **Knowledge Search** - Find solutions to mainframe problems
2. **Entry Management** - Add, update, and organize knowledge
3. **Usage Tracking** - Monitor effectiveness and popular solutions
4. **AI Enhancement** - Semantic search and intelligent suggestions

### Integration Patterns

1. **Electron Desktop App** - Full-featured desktop application
2. **Express API Server** - Web service for multiple clients
3. **CLI Tool** - Command-line interface for automation
4. **React Components** - Embeddable search widgets

## 📝 Code Examples

### Basic Search Implementation

```typescript
import { createKnowledgeDB } from './src/database/KnowledgeDB';

class KnowledgeSearcher {
  private db: KnowledgeDB;

  async initialize() {
    this.db = await createKnowledgeDB('./knowledge.db', {
      autoBackup: true,
      backupInterval: 24
    });
  }

  async search(query: string, options: any = {}) {
    const results = await this.db.search(query, {
      limit: options.limit || 10,
      category: options.category,
      sortBy: 'relevance'
    });

    return results.map(result => ({
      id: result.entry.id,
      title: result.entry.title,
      score: result.score,
      category: result.entry.category,
      successRate: this.calculateSuccessRate(result.entry)
    }));
  }

  private calculateSuccessRate(entry: any) {
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? (entry.success_count / total) * 100 : 0;
  }
}
```

### AI-Enhanced Search

```typescript
import { GeminiService } from './src/services/GeminiService';

class IntelligentSearch extends KnowledgeSearcher {
  private gemini: GeminiService;

  async initialize() {
    await super.initialize();
    this.gemini = new GeminiService({
      apiKey: process.env.GOOGLE_AI_API_KEY
    });
  }

  async intelligentSearch(query: string) {
    // Get candidates for AI analysis
    const entries = await this.db.getRecent(500);
    
    // Use AI for semantic matching
    const aiResults = await this.gemini.findSimilar(query, entries, 5);
    
    // Combine with traditional search
    const traditionalResults = await this.db.search(query, { limit: 5 });
    
    // Merge and deduplicate
    const merged = this.mergeResults(aiResults, traditionalResults);
    
    return merged.sort((a, b) => b.score - a.score);
  }
}
```

## 🔒 Security Considerations

### Data Protection
- All user input validated with Zod schemas
- SQL injection prevention through prepared statements
- Database file permissions restricted to owner only

### API Security
- Rate limiting on AI service calls
- API key encryption at rest
- User session tracking for audit trails

### Privacy
- User data anonymization in logs
- Optional user identification
- Local-first data storage (no cloud dependencies)

## 🎨 Customization

### Adding Custom Categories

```typescript
// Extend the category enum in schemas
const CustomCategorySchema = z.enum([
  ...KBCategorySchema.options,
  'CustomCategory1',
  'CustomCategory2'
]);
```

### Custom Search Algorithms

```typescript
class CustomKnowledgeDB extends KnowledgeDB {
  async customSearch(query: string): Promise<SearchResult[]> {
    // Implement your custom search logic
    const results = await this.executeCustomQuery(query);
    return results.map(this.transformToSearchResult);
  }
}
```

## 🔍 Troubleshooting

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Slow search | Response > 1s | Check indexes, run ANALYZE |
| Database locked | SQLite busy error | Increase timeout, check concurrent access |
| AI service fails | Network/auth errors | Verify API key, check fallback |
| Memory usage high | Growing RAM usage | Check cache size limits |

### Debug Mode

```typescript
// Enable verbose logging
const db = new KnowledgeDB('./knowledge.db', { debug: true });

// Health check
const health = await db.healthCheck();
console.log('System health:', health);

// Performance monitoring
const stats = await db.getStats();
console.log('Performance metrics:', stats.performance);
```

## 📈 Monitoring and Analytics

### Built-in Metrics

- Search performance and response times
- Usage patterns and popular entries
- Success/failure rates for solutions
- Database health and optimization status

### Custom Analytics

```typescript
// Get detailed usage analytics
const analytics = await db.getStats();

console.log(`
Database Health Report:
- Total entries: ${analytics.totalEntries}
- Searches today: ${analytics.searchesToday}
- Average success rate: ${analytics.averageSuccessRate}%
- Cache hit rate: ${analytics.performance.cacheHitRate}%
- Average response time: ${analytics.performance.avgSearchTime}ms
`);
```

## 🚧 Roadmap

### MVP2 (Future)
- Pattern detection in incident data
- Automated root cause analysis
- Predictive alerting

### MVP3 (Future)
- COBOL code analysis integration
- Direct IDE integration
- Advanced debugging assistance

## 💡 Best Practices

### Performance
1. Use specific categories in searches when possible
2. Implement pagination for large result sets
3. Cache frequently accessed data
4. Regular database maintenance (VACUUM, ANALYZE)

### Data Quality
1. Encourage detailed problem descriptions
2. Use consistent tagging conventions
3. Regular review and updates of entries
4. Monitor success rates and update poor performers

### Integration
1. Handle AI service failures gracefully
2. Implement proper error boundaries
3. Use TypeScript for type safety
4. Follow the provided interface contracts

## 📞 Support

### Getting Help
1. Check the [API Documentation](./API_DOCUMENTATION.md) first
2. Review [common issues](#troubleshooting) section
3. Enable debug mode for detailed logging
4. Create GitHub issues for bugs or feature requests

### Contributing
See [Contributing Guidelines](./CONTRIBUTING.md) for information on:
- Code standards and style
- Testing requirements
- Pull request process
- Development setup

---

**Happy coding!** 🚀

The Mainframe KB Assistant team hopes this documentation helps you build amazing knowledge-driven applications. If you build something cool with this system, we'd love to hear about it!