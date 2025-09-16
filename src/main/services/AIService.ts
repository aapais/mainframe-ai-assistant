/**
 * AI Service Implementation
 * Wraps Gemini AI functionality as a managed service with fallback capabilities
 */

import { GeminiService } from '../../services/GeminiService';
import { Service, ServiceContext, ServiceHealth, ServiceStatus, FallbackService } from './ServiceManager';

export class AIService implements Service {
  public readonly name = 'AIService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = ['DatabaseService'];
  public readonly priority = 3; // Lower priority - optional enhancement
  public readonly critical = false;

  private geminiService: GeminiService | null = null;
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };
  private startTime?: Date;

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Initializing AI Service...');
    this.startTime = new Date();
    
    try {
      // Try to get API key from environment or config
      const geminiApiKey = process.env.GEMINI_API_KEY || await this.getGeminiApiKeyFromConfig(context);
      
      if (!geminiApiKey) {
        context.logger.warn('Gemini API key not found - AI features will be disabled');
        this.status = {
          status: 'degraded',
          startTime: this.startTime,
          restartCount: 0,
          uptime: 0,
          metadata: { reason: 'api_key_missing' }
        };
        return;
      }

      this.geminiService = new GeminiService({
        apiKey: geminiApiKey,
        model: 'gemini-pro',
        temperature: 0.3
      });

      // Test the service with a simple request
      await this.testConnection();

      this.status = {
        status: 'running',
        startTime: this.startTime,
        restartCount: 0,
        uptime: 0
      };

      context.logger.info('AI Service initialized successfully');
      context.metrics.increment('service.ai.initialized');
    } catch (error) {
      this.status = {
        status: 'error',
        lastError: error,
        restartCount: 0,
        uptime: 0
      };
      
      context.logger.error('AI Service initialization failed', error);
      context.metrics.increment('service.ai.initialization_failed');
      
      // Since this is not a critical service, we don't throw
      context.logger.info('AI Service will run in degraded mode without AI features');
      this.status.status = 'degraded';
    }
  }

  async shutdown(): Promise<void> {
    this.geminiService = null;
    this.status = {
      ...this.status,
      status: 'stopped'
    };
  }

  getStatus(): ServiceStatus {
    if (this.startTime && this.status.status === 'running') {
      this.status.uptime = Date.now() - this.startTime.getTime();
    }
    return { ...this.status };
  }

  async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.geminiService) {
        return {
          healthy: false,
          error: 'Gemini service not available',
          details: { mode: 'degraded' },
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }

      // Test with a simple request
      await this.testConnection();
      
      return {
        healthy: true,
        details: {
          mode: 'full_ai',
          model: 'gemini-pro',
          features: ['semantic_search', 'error_explanation', 'code_analysis']
        },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        details: { mode: 'degraded' },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  // Public interface for AI operations
  getGeminiService(): GeminiService | null {
    return this.geminiService;
  }

  async findSimilar(query: string, entries: any[]): Promise<any[]> {
    if (!this.geminiService) {
      throw new Error('AI service not available - running in degraded mode');
    }
    return this.geminiService.findSimilar(query, entries);
  }

  async explainError(errorCode: string): Promise<string> {
    if (!this.geminiService) {
      return 'AI service not available. Please check the error code in documentation.';
    }
    return this.geminiService.explainError(errorCode);
  }

  isAvailable(): boolean {
    return this.geminiService !== null && this.status.status === 'running';
  }

  private async getGeminiApiKeyFromConfig(context: ServiceContext): Promise<string | null> {
    try {
      // Try to get from database service configuration
      const dbService = context.getService('DatabaseService') as any;
      if (dbService && dbService.getDatabase) {
        const db = dbService.getDatabase();
        if (db && db.getConfig) {
          return db.getConfig('gemini_api_key');
        }
      }
    } catch (error) {
      context.logger.debug('Could not retrieve Gemini API key from config', error);
    }
    return null;
  }

  private async testConnection(): Promise<void> {
    if (!this.geminiService) {
      throw new Error('Gemini service not initialized');
    }

    // Simple test request
    await this.geminiService.explainError('test');
  }
}

// Fallback AI Service - provides basic functionality when AI is not available
export class FallbackAIService implements FallbackService {
  public readonly name = 'FallbackAIService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];
  public readonly priority = 10; // Low priority fallback
  public readonly critical = false;
  public readonly fallbackFor = 'AIService';

  private isActivated = false;
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Fallback AI Service initialized (inactive)');
    this.status = {
      status: 'running',
      startTime: new Date(),
      restartCount: 0,
      uptime: 0,
      metadata: { mode: 'fallback', active: false }
    };
  }

  async shutdown(): Promise<void> {
    this.isActivated = false;
    this.status = {
      ...this.status,
      status: 'stopped'
    };
  }

  getStatus(): ServiceStatus {
    return { ...this.status };
  }

  async healthCheck(): Promise<ServiceHealth> {
    return {
      healthy: true,
      details: {
        mode: 'fallback',
        active: this.isActivated,
        features: ['basic_search', 'static_explanations']
      },
      lastCheck: new Date()
    };
  }

  isActive(): boolean {
    return this.isActivated;
  }

  async activate(): Promise<void> {
    this.isActivated = true;
    this.status.metadata = { ...this.status.metadata, active: true };
  }

  async deactivate(): Promise<void> {
    this.isActivated = false;
    this.status.metadata = { ...this.status.metadata, active: false };
  }

  // Fallback implementations
  async findSimilar(query: string, entries: any[]): Promise<any[]> {
    // Basic fuzzy matching fallback
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
    
    const scored = entries.map(entry => {
      const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
      let score = 0;
      
      // Exact phrase match
      if (text.includes(queryLower)) {
        score += 50;
      }
      
      // Keyword matches
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          score += 10;
        }
      });
      
      return { entry, score, matchType: 'fuzzy' as const };
    });
    
    return scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  async explainError(errorCode: string): Promise<string> {
    // Static error explanations
    const explanations: Record<string, string> = {
      'S0C7': 'Data exception - Invalid numeric data detected. Check for uninitialized fields or non-numeric data in numeric variables.',
      'S0C4': 'Protection exception - Invalid memory access. Check array bounds and pointer usage.',
      'U0778': 'IMS database not available. Check database status and ensure it is started.',
      'IEF212I': 'Dataset not found. Verify dataset name and ensure it exists and is cataloged.',
      'VSAM STATUS 35': 'VSAM file not found. Check dataset name, catalog entry, and permissions.'
    };

    return explanations[errorCode.toUpperCase()] || 
           `Error code ${errorCode}: Please check system documentation for details. AI service is not available for detailed analysis.`;
  }
}