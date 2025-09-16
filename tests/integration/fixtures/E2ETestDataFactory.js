/**
 * E2E Test Data Factory
 * Creates comprehensive test data for end-to-end workflow testing
 */
class E2ETestDataFactory {
  constructor(dbManager) {
    this.db = dbManager;
  }

  /**
   * Create test users with different roles and permissions
   */
  async createTestUsers() {
    const users = [
      {
        id: 'admin-001',
        email: 'admin@test.com',
        username: 'admin',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'admin'],
        preferences: {
          theme: 'dark',
          notifications: true,
          exportFormat: 'csv',
          dailyBudget: 100.00,
          weeklyBudget: 500.00,
          monthlyBudget: 2000.00
        },
        apiKeys: {
          openai: 'test-openai-key-admin',
          gemini: 'test-gemini-key-admin'
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-001',
        email: 'user@test.com',
        username: 'user1',
        role: 'user',
        permissions: ['read', 'write'],
        preferences: {
          theme: 'light',
          notifications: false,
          exportFormat: 'pdf',
          dailyBudget: 10.00,
          weeklyBudget: 50.00,
          monthlyBudget: 200.00
        },
        apiKeys: {
          openai: 'test-openai-key-user',
          gemini: null
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-002',
        email: 'user2@test.com',
        username: 'user2',
        role: 'user',
        permissions: ['read'],
        preferences: {
          theme: 'light',
          notifications: true,
          exportFormat: 'json',
          dailyBudget: 5.00,
          weeklyBudget: 25.00,
          monthlyBudget: 100.00
        },
        apiKeys: {
          openai: null,
          gemini: 'test-gemini-key-user2'
        },
        createdAt: new Date().toISOString()
      }
    ];

    for (const user of users) {
      await this.db.query(`
        INSERT OR REPLACE INTO users (id, email, username, role, permissions, preferences, api_keys, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id,
        user.email,
        user.username,
        user.role,
        JSON.stringify(user.permissions),
        JSON.stringify(user.preferences),
        JSON.stringify(user.apiKeys),
        user.createdAt
      ]);
    }

    console.log('✅ Test users created');
  }

  /**
   * Create comprehensive knowledge base entries for testing
   */
  async createTestKnowledgeBase() {
    const kbEntries = [
      {
        id: 'kb-001',
        title: 'S0C4 ABEND Troubleshooting Guide',
        content: `S0C4 ABEND (System Completion Code 4) indicates a protection exception.

        Common Causes:
        1. Attempting to access storage outside program boundaries
        2. Uninitialized pointers
        3. Array index out of bounds
        4. Corrupted control blocks

        Diagnostic Steps:
        1. Check the PSW and registers at time of failure
        2. Examine storage dumps for invalid addresses
        3. Review recent program changes
        4. Validate data integrity

        Resolution:
        - Fix addressing errors in the program
        - Initialize all pointers before use
        - Add bounds checking for array access
        - Restore corrupted control blocks`,
        category: 'ABEND Analysis',
        tags: ['S0C4', 'ABEND', 'protection exception', 'troubleshooting'],
        priority: 'high',
        authorId: 'admin-001',
        lastModified: new Date().toISOString(),
        accessCount: 0,
        aiProcessed: false
      },
      {
        id: 'kb-002',
        title: 'JCL Job Optimization Best Practices',
        content: `Job Control Language (JCL) optimization techniques for better performance.

        Memory Optimization:
        - Use appropriate region sizes
        - Implement efficient sort parameters
        - Optimize buffer allocations

        I/O Optimization:
        - Use proper blocking factors
        - Implement parallel processing where possible
        - Optimize dataset placement

        CPU Optimization:
        - Use compiled programs instead of interpreted
        - Implement efficient algorithms
        - Minimize system calls`,
        category: 'Performance',
        tags: ['JCL', 'optimization', 'performance', 'memory', 'CPU'],
        priority: 'medium',
        authorId: 'admin-001',
        lastModified: new Date().toISOString(),
        accessCount: 0,
        aiProcessed: false
      },
      {
        id: 'kb-003',
        title: 'CICS Transaction Performance Tuning',
        content: `Customer Information Control System (CICS) performance optimization strategies.

        Transaction Design:
        - Minimize transaction path length
        - Use pseudo-conversational programming
        - Implement efficient data access patterns

        Resource Management:
        - Optimize storage pools
        - Configure appropriate task priorities
        - Monitor resource utilization

        Database Access:
        - Use efficient SQL queries
        - Implement proper indexing
        - Minimize database calls`,
        category: 'Performance',
        tags: ['CICS', 'transactions', 'performance', 'tuning', 'database'],
        priority: 'high',
        authorId: 'user-001',
        lastModified: new Date().toISOString(),
        accessCount: 0,
        aiProcessed: false
      }
    ];

    for (const entry of kbEntries) {
      await this.db.query(`
        INSERT OR REPLACE INTO knowledge_base (
          id, title, content, category, tags, priority, author_id, last_modified, access_count, ai_processed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        entry.id,
        entry.title,
        entry.content,
        entry.category,
        JSON.stringify(entry.tags),
        entry.priority,
        entry.authorId,
        entry.lastModified,
        entry.accessCount,
        entry.aiProcessed
      ]);
    }

    console.log('✅ Test knowledge base entries created');
  }

  /**
   * Create test API keys and configuration
   */
  async createTestApiKeys() {
    const apiConfigs = [
      {
        id: 'api-config-001',
        userId: 'admin-001',
        provider: 'openai',
        apiKey: 'sk-test-admin-openai-key-encrypted',
        encrypted: true,
        isActive: true,
        rateLimit: 100,
        costPerRequest: 0.002,
        createdAt: new Date().toISOString()
      },
      {
        id: 'api-config-002',
        userId: 'admin-001',
        provider: 'gemini',
        apiKey: 'test-admin-gemini-key-encrypted',
        encrypted: true,
        isActive: true,
        rateLimit: 150,
        costPerRequest: 0.001,
        createdAt: new Date().toISOString()
      },
      {
        id: 'api-config-003',
        userId: 'user-001',
        provider: 'openai',
        apiKey: 'sk-test-user-openai-key-encrypted',
        encrypted: true,
        isActive: true,
        rateLimit: 50,
        costPerRequest: 0.002,
        createdAt: new Date().toISOString()
      }
    ];

    for (const config of apiConfigs) {
      await this.db.query(`
        INSERT OR REPLACE INTO api_configurations (
          id, user_id, provider, api_key, encrypted, is_active, rate_limit, cost_per_request, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        config.id,
        config.userId,
        config.provider,
        config.apiKey,
        config.encrypted,
        config.isActive,
        config.rateLimit,
        config.costPerRequest,
        config.createdAt
      ]);
    }

    console.log('✅ Test API configurations created');
  }

  /**
   * Create test budget configurations and usage tracking
   */
  async createTestBudgets() {
    const budgets = [
      {
        id: 'budget-001',
        userId: 'admin-001',
        period: 'daily',
        limit: 100.00,
        spent: 15.50,
        remaining: 84.50,
        resetDate: this.getNextResetDate('daily'),
        alertThreshold: 80,
        isActive: true
      },
      {
        id: 'budget-002',
        userId: 'admin-001',
        period: 'weekly',
        limit: 500.00,
        spent: 67.25,
        remaining: 432.75,
        resetDate: this.getNextResetDate('weekly'),
        alertThreshold: 75,
        isActive: true
      },
      {
        id: 'budget-003',
        userId: 'user-001',
        period: 'daily',
        limit: 10.00,
        spent: 8.50,
        remaining: 1.50,
        resetDate: this.getNextResetDate('daily'),
        alertThreshold: 80,
        isActive: true
      },
      {
        id: 'budget-004',
        userId: 'user-002',
        period: 'monthly',
        limit: 100.00,
        spent: 95.00,
        remaining: 5.00,
        resetDate: this.getNextResetDate('monthly'),
        alertThreshold: 90,
        isActive: true
      }
    ];

    for (const budget of budgets) {
      await this.db.query(`
        INSERT OR REPLACE INTO budgets (
          id, user_id, period, limit_amount, spent_amount, remaining_amount,
          reset_date, alert_threshold, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        budget.id,
        budget.userId,
        budget.period,
        budget.limit,
        budget.spent,
        budget.remaining,
        budget.resetDate,
        budget.alertThreshold,
        budget.isActive
      ]);
    }

    // Create usage history
    const usageHistory = [
      {
        id: 'usage-001',
        userId: 'admin-001',
        operation: 'ai_search',
        query: 'S0C4 ABEND troubleshooting',
        cost: 0.05,
        provider: 'openai',
        tokensUsed: 1250,
        timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: 'usage-002',
        userId: 'user-001',
        operation: 'ai_search',
        query: 'JCL optimization techniques',
        cost: 0.03,
        provider: 'openai',
        tokensUsed: 950,
        timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
      }
    ];

    for (const usage of usageHistory) {
      await this.db.query(`
        INSERT OR REPLACE INTO usage_history (
          id, user_id, operation, query, cost, provider, tokens_used, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        usage.id,
        usage.userId,
        usage.operation,
        usage.query,
        usage.cost,
        usage.provider,
        usage.tokensUsed,
        usage.timestamp
      ]);
    }

    console.log('✅ Test budgets and usage history created');
  }

  /**
   * Calculate next reset date based on period
   */
  getNextResetDate(period) {
    const now = new Date();
    let resetDate = new Date(now);

    switch (period) {
      case 'daily':
        resetDate.setDate(now.getDate() + 1);
        resetDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const daysUntilMonday = (7 - now.getDay() + 1) % 7 || 7;
        resetDate.setDate(now.getDate() + daysUntilMonday);
        resetDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        resetDate.setMonth(now.getMonth() + 1);
        resetDate.setDate(1);
        resetDate.setHours(0, 0, 0, 0);
        break;
    }

    return resetDate.toISOString();
  }

  /**
   * Create test audit trail entries
   */
  async createAuditTrail() {
    const auditEntries = [
      {
        id: 'audit-001',
        userId: 'admin-001',
        action: 'CREATE_KB_ENTRY',
        resourceId: 'kb-001',
        details: 'Created S0C4 ABEND troubleshooting guide',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      },
      {
        id: 'audit-002',
        userId: 'user-001',
        action: 'AI_SEARCH',
        resourceId: 'search-001',
        details: 'Performed AI search for "S0C4 ABEND"',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
    ];

    for (const entry of auditEntries) {
      await this.db.query(`
        INSERT OR REPLACE INTO audit_trail (
          id, user_id, action, resource_id, details, ip_address, user_agent, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        entry.id,
        entry.userId,
        entry.action,
        entry.resourceId,
        entry.details,
        entry.ipAddress,
        entry.userAgent,
        entry.timestamp
      ]);
    }

    console.log('✅ Test audit trail created');
  }

  /**
   * Clean up all test data
   */
  async cleanup() {
    const tables = [
      'users',
      'knowledge_base',
      'api_configurations',
      'budgets',
      'usage_history',
      'audit_trail'
    ];

    for (const table of tables) {
      await this.db.query(`DELETE FROM ${table} WHERE id LIKE '%test%' OR id LIKE '%001' OR id LIKE '%002'`);
    }

    console.log('✅ Test data cleaned up');
  }
}

module.exports = { E2ETestDataFactory };