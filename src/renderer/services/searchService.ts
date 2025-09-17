import { SearchResult } from '../views/Search';

class SearchService {
  private mockData: SearchResult[] = [
    // Mock Files
    {
      id: 'file-1',
      title: 'config.json',
      content: 'Application configuration file containing database settings, API endpoints, and feature flags.',
      type: 'file',
      path: '/src/config/config.json',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      highlights: ['database', 'api', 'configuration']
    },
    {
      id: 'file-2',
      title: 'UserController.ts',
      content: 'Main user controller handling authentication, user management, and profile operations.',
      type: 'file',
      path: '/src/controllers/UserController.ts',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      highlights: ['authentication', 'user management', 'profile']
    },
    {
      id: 'file-3',
      title: 'database.sql',
      content: 'Database schema and migration scripts for user tables and indexing.',
      type: 'file',
      path: '/migrations/database.sql',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      highlights: ['schema', 'migration', 'indexing']
    },
    // Mock Settings
    {
      id: 'setting-1',
      title: 'Authentication Settings',
      content: 'Configure JWT token expiration, password policies, and two-factor authentication.',
      type: 'setting',
      path: '/admin/settings/auth',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      highlights: ['JWT', 'password policy', '2FA']
    },
    {
      id: 'setting-2',
      title: 'Database Connection',
      content: 'Database connection strings, pool settings, and backup configurations.',
      type: 'setting',
      path: '/admin/settings/database',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      highlights: ['connection pool', 'backup', 'configurations']
    },
    // Mock Users
    {
      id: 'user-1',
      title: 'john.doe@example.com',
      content: 'System administrator with full access privileges. Last login: 2 hours ago.',
      type: 'user',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      highlights: ['administrator', 'full access', 'recent login']
    },
    {
      id: 'user-2',
      title: 'alice.smith@example.com',
      content: 'Power user with advanced permissions. Active in development team.',
      type: 'user',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      highlights: ['power user', 'development team', 'advanced permissions']
    },
    // Mock Logs
    {
      id: 'log-1',
      title: 'Authentication Error',
      content: 'Failed login attempt from IP 192.168.1.100. Multiple attempts detected.',
      type: 'log',
      lastModified: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      highlights: ['failed login', 'security alert', 'multiple attempts']
    },
    {
      id: 'log-2',
      title: 'Database Performance',
      content: 'Slow query detected: SELECT * FROM users WHERE created_at > NOW() - INTERVAL 1 DAY',
      type: 'log',
      lastModified: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      highlights: ['slow query', 'performance', 'optimization needed']
    },
    // Mock Data
    {
      id: 'data-1',
      title: 'User Analytics',
      content: 'Daily active users: 1,247. New registrations: 23. User retention: 87%.',
      type: 'data',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
      highlights: ['DAU', 'retention rate', 'growth metrics']
    },
    {
      id: 'data-2',
      title: 'System Performance',
      content: 'CPU usage: 45%, Memory: 67%, Disk I/O: 23%. All systems operating normally.',
      type: 'data',
      lastModified: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      highlights: ['CPU usage', 'memory utilization', 'system health']
    }
  ];

  private aiInsights: SearchResult[] = [
    {
      id: 'ai-1',
      title: 'Performance Bottleneck Detected',
      content: 'Analysis shows database queries are 40% slower during peak hours (2-4 PM). Recommend implementing query optimization and connection pooling.',
      type: 'analysis',
      relevanceScore: 0.92,
      highlights: [
        'Database queries 40% slower during peak hours',
        'Connection pooling could improve performance by 25%',
        'Query optimization recommended for user lookup operations'
      ]
    },
    {
      id: 'ai-2',
      title: 'Security Pattern Analysis',
      content: 'Identified unusual login patterns from 3 IP addresses. Recommend enabling additional monitoring and implementing rate limiting.',
      type: 'pattern',
      relevanceScore: 0.89,
      highlights: [
        'Unusual login patterns detected from 3 IPs',
        'Rate limiting could prevent brute force attacks',
        'Enhanced monitoring recommended for security'
      ]
    },
    {
      id: 'ai-3',
      title: 'User Engagement Optimization',
      content: 'User retention drops 15% after day 7. Suggest implementing onboarding improvements and engagement campaigns.',
      type: 'recommendation',
      relevanceScore: 0.84,
      highlights: [
        '15% retention drop after day 7',
        'Onboarding improvements could increase retention',
        'Engagement campaigns show 23% success rate'
      ]
    },
    {
      id: 'ai-4',
      title: 'System Health Trend',
      content: 'Memory usage has increased 12% over the past week. Current trajectory suggests potential issues by month-end.',
      type: 'insight',
      relevanceScore: 0.78,
      highlights: [
        'Memory usage increased 12% in past week',
        'Potential issues predicted by month-end',
        'Memory optimization or scaling recommended'
      ]
    }
  ];

  /**
   * Perform local search - fast, real-time results
   */
  async searchLocal(query: string): Promise<SearchResult[]> {
    // Simulate real-time search with minimal delay
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return [];
    }

    // Filter results based on query
    const results = this.mockData.filter(item => {
      const searchText = (
        item.title + ' ' + 
        item.content + ' ' + 
        (item.path || '') + ' ' +
        (item.highlights?.join(' ') || '')
      ).toLowerCase();
      
      return searchText.includes(normalizedQuery);
    });

    // Sort by relevance (simple scoring)
    return results.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, normalizedQuery);
      const bScore = this.calculateRelevanceScore(b, normalizedQuery);
      return bScore - aScore;
    });
  }

  /**
   * Perform AI-enhanced search - intelligent analysis
   */
  async searchAI(query: string): Promise<SearchResult[]> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return [];
    }

    // AI search looks for patterns, insights, and intelligent connections
    const results = this.aiInsights.filter(insight => {
      const searchText = (
        insight.title + ' ' + 
        insight.content + ' ' +
        (insight.highlights?.join(' ') || '')
      ).toLowerCase();
      
      // AI search is more flexible with matching
      return this.isAIRelevant(searchText, normalizedQuery);
    });

    // Also include relevant local results with AI-enhanced scoring
    const enhancedLocalResults = await this.enhanceLocalResultsWithAI(normalizedQuery);
    
    return [...results, ...enhancedLocalResults].sort((a, b) => {
      const aScore = a.relevanceScore || 0.5;
      const bScore = b.relevanceScore || 0.5;
      return bScore - aScore;
    });
  }

  /**
   * Calculate simple relevance score for local search
   */
  private calculateRelevanceScore(item: SearchResult, query: string): number {
    let score = 0;
    const queryWords = query.split(/\s+/);
    
    queryWords.forEach(word => {
      // Title matches get higher score
      if (item.title.toLowerCase().includes(word)) {
        score += 3;
      }
      
      // Content matches
      if (item.content.toLowerCase().includes(word)) {
        score += 2;
      }
      
      // Path matches
      if (item.path?.toLowerCase().includes(word)) {
        score += 1;
      }
      
      // Highlight matches
      if (item.highlights?.some(h => h.toLowerCase().includes(word))) {
        score += 2;
      }
    });
    
    // Boost score for recent items
    if (item.lastModified) {
      const hoursAgo = (Date.now() - item.lastModified.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) {
        score += 1;
      }
    }
    
    return score;
  }

  /**
   * AI relevance check - more intelligent matching
   */
  private isAIRelevant(text: string, query: string): boolean {
    // Simple keyword matching for demo
    // In real implementation, this would use semantic search, NLP, etc.
    const queryWords = query.split(/\s+/);
    const semanticMatches = {
      'performance': ['slow', 'speed', 'optimization', 'bottleneck', 'cpu', 'memory'],
      'security': ['auth', 'login', 'password', 'attack', 'vulnerability', 'breach'],
      'user': ['customer', 'account', 'profile', 'engagement', 'retention'],
      'error': ['bug', 'issue', 'problem', 'failure', 'exception'],
      'system': ['server', 'database', 'infrastructure', 'health', 'monitoring']
    };
    
    return queryWords.some(word => {
      // Direct match
      if (text.includes(word)) return true;
      
      // Semantic match
      for (const [category, synonyms] of Object.entries(semanticMatches)) {
        if (word === category && synonyms.some(syn => text.includes(syn))) {
          return true;
        }
        if (synonyms.includes(word) && text.includes(category)) {
          return true;
        }
      }
      
      return false;
    });
  }

  /**
   * Enhance local results with AI scoring
   */
  private async enhanceLocalResultsWithAI(query: string): Promise<SearchResult[]> {
    const localResults = await this.searchLocal(query);
    
    return localResults.slice(0, 3).map(result => ({
      ...result,
      id: `ai-enhanced-${result.id}`,
      title: `📊 ${result.title}`,
      content: `AI Analysis: ${result.content} This item shows high relevance to your query based on content analysis and usage patterns.`,
      relevanceScore: 0.6 + Math.random() * 0.3,
      highlights: [
        ...(result.highlights || []),
        'AI-enhanced result',
        'High relevance match'
      ]
    }));
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    const suggestions = [
      'Show me system performance metrics',
      'Find security vulnerabilities',
      'Analyze user behavior patterns',
      'Database optimization opportunities',
      'Recent error logs and issues',
      'User engagement analytics',
      'Configuration management',
      'Authentication failures'
    ];
    
    if (!query.trim()) {
      return suggestions.slice(0, 5);
    }
    
    // Filter suggestions based on query
    return suggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }

  /**
   * Get recent searches
   */
  getRecentSearches(): string[] {
    // In real implementation, this would be stored in localStorage or backend
    return [
      'performance bottlenecks last 24 hours',
      'security audit results',
      'user retention analysis',
      'database slow queries',
      'authentication errors'
    ];
  }
}

export const searchService = new SearchService();