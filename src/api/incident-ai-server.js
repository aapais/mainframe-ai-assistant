"use strict";

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { body, validationResult, query } = require('express-validator');

// Import existing services
const {
  KnowledgeBaseService,
  ValidationService,
  EnhancedSearchService,
  CategoryService,
  DuplicateDetectionService,
  getGlobalServiceFactory,
  initializeProductionServices
} = require('../services');

const GeminiService = require('../services/GeminiService').GeminiService;

/**
 * Incident AI Express Server
 *
 * Provides RESTful API endpoints for:
 * - Incident creation with AI categorization
 * - Semantic search with RAG capabilities
 * - Similar incident detection
 * - LLM integration (OpenAI, Claude, Azure OpenAI, Gemini)
 * - ChromaDB vector search
 * - LGPD compliance with data masking
 */
class IncidentAIServer {
  constructor(config = {}) {
    this.app = express();
    this.config = {
      port: config.port || process.env.PORT || 3001,
      cors: config.cors || { origin: true, credentials: true },
      rateLimit: config.rateLimit || { windowMs: 15 * 60 * 1000, max: 100 },
      database: config.database || { path: './kb-assistant.db' },
      llm: config.llm || {},
      chroma: config.chroma || { url: 'http://localhost:8000' },
      lgpd: config.lgpd || { enabled: true, maskFields: ['email', 'cpf', 'phone'] },
      ...config
    };

    this.services = {};
    this.llmClients = {};
    this.chromaClient = null;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize all services and LLM integrations
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Incident AI Server...');

      // Initialize service factory
      const serviceFactory = await initializeProductionServices(this.config);
      this.services = {
        kb: serviceFactory.getKnowledgeBaseService(),
        validation: serviceFactory.getValidationService(),
        search: serviceFactory.getSearchService(),
        cache: serviceFactory.getCacheService(),
        category: serviceFactory.getCategoryService?.() || null,
        duplicate: new DuplicateDetectionService()
      };

      // Initialize LLM services
      await this.initializeLLMServices();

      // Initialize ChromaDB
      await this.initializeChromaDB();

      console.log('✅ All services initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Initialize LLM service clients
   */
  async initializeLLMServices() {
    // Gemini/Google AI
    if (this.config.llm.gemini?.apiKey) {
      this.llmClients.gemini = new GeminiService({
        apiKey: this.config.llm.gemini.apiKey,
        model: this.config.llm.gemini.model || 'gemini-pro',
        temperature: this.config.llm.gemini.temperature || 0.3
      });
      console.log('✅ Gemini service initialized');
    }

    // OpenAI
    if (this.config.llm.openai?.apiKey) {
      const { OpenAI } = require('openai');
      this.llmClients.openai = new OpenAI({
        apiKey: this.config.llm.openai.apiKey,
        organization: this.config.llm.openai.organization
      });
      console.log('✅ OpenAI service initialized');
    }

    // Anthropic Claude
    if (this.config.llm.claude?.apiKey) {
      const Anthropic = require('@anthropic-ai/sdk');
      this.llmClients.claude = new Anthropic({
        apiKey: this.config.llm.claude.apiKey
      });
      console.log('✅ Claude service initialized');
    }

    // Azure OpenAI
    if (this.config.llm.azure?.apiKey) {
      const { AzureOpenAI } = require('openai');
      this.llmClients.azure = new AzureOpenAI({
        apiKey: this.config.llm.azure.apiKey,
        apiVersion: this.config.llm.azure.apiVersion || '2024-02-01',
        endpoint: this.config.llm.azure.endpoint
      });
      console.log('✅ Azure OpenAI service initialized');
    }
  }

  /**
   * Initialize ChromaDB vector database
   */
  async initializeChromaDB() {
    try {
      const { ChromaClient } = require('chromadb');
      this.chromaClient = new ChromaClient({ path: this.config.chroma.url });

      // Create or get collections
      try {
        this.incidentCollection = await this.chromaClient.getOrCreateCollection({
          name: 'mainframe_incidents',
          metadata: { description: 'Mainframe incident knowledge base' }
        });
        console.log('✅ ChromaDB incident collection ready');
      } catch (error) {
        console.warn('⚠️ ChromaDB not available, using fallback search');
        this.chromaClient = null;
      }
    } catch (error) {
      console.warn('⚠️ ChromaDB initialization failed, vector search disabled:', error.message);
      this.chromaClient = null;
    }
  }

  /**
   * Configure Express middleware
   */
  setupMiddleware() {
    // Security and performance
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    this.app.use(compression());
    this.app.use(cors(this.config.cors));

    // Rate limiting
    const limiter = rateLimit(this.config.rateLimit);
    this.app.use('/api/', limiter);

    // Logging
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  /**
   * Configure API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: !!this.services.kb,
          llm: Object.keys(this.llmClients),
          chroma: !!this.chromaClient
        }
      });
    });

    // Incident creation with AI categorization
    this.app.post('/api/incidents/create', [
      body('title').notEmpty().isLength({ min: 5, max: 200 }).trim(),
      body('problem').notEmpty().isLength({ min: 10, max: 5000 }).trim(),
      body('solution').optional().isLength({ max: 10000 }).trim(),
      body('category').optional().isIn(['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'System', 'Network', 'Security', 'Other']),
      body('tags').optional().isArray(),
      body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
      body('created_by').optional().trim()
    ], this.createIncident.bind(this));

    // Semantic search with RAG
    this.app.get('/api/search/semantic', [
      query('q').notEmpty().isLength({ min: 2, max: 500 }).trim(),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('threshold').optional().isFloat({ min: 0, max: 1 }),
      query('category').optional().isIn(['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'System', 'Network', 'Security', 'Other']),
      query('use_vector').optional().isBoolean(),
      query('use_llm').optional().isBoolean()
    ], this.semanticSearch.bind(this));

    // Find similar incidents
    this.app.post('/api/incidents/similar', [
      body('incident_id').optional().isInt(),
      body('title').optional().trim(),
      body('problem').optional().trim(),
      body('solution').optional().trim(),
      body('threshold').optional().isFloat({ min: 0, max: 1 }),
      body('limit').optional().isInt({ min: 1, max: 50 }),
      body('use_ai').optional().isBoolean()
    ], this.findSimilarIncidents.bind(this));

    // AI categorization endpoint
    this.app.post('/api/incidents/categorize', [
      body('text').notEmpty().trim(),
      body('llm_provider').optional().isIn(['gemini', 'openai', 'claude', 'azure'])
    ], this.categorizeIncident.bind(this));

    // Vector search endpoint
    this.app.post('/api/search/vector', [
      body('query').notEmpty().trim(),
      body('limit').optional().isInt({ min: 1, max: 100 }),
      body('threshold').optional().isFloat({ min: 0, max: 1 })
    ], this.vectorSearch.bind(this));

    // Data masking for LGPD compliance
    this.app.post('/api/incidents/mask', [
      body('data').notEmpty(),
      body('fields').optional().isArray()
    ], this.maskSensitiveData.bind(this));

    // Bulk operations
    this.app.post('/api/incidents/bulk', [
      body('incidents').isArray(),
      body('operation').isIn(['create', 'update', 'delete'])
    ], this.bulkOperations.bind(this));

    // Analytics and metrics
    this.app.get('/api/analytics/summary', this.getAnalyticsSummary.bind(this));
    this.app.get('/api/analytics/trends', this.getTrends.bind(this));
  }

  /**
   * Create new incident with AI categorization
   */
  async createIncident(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      let { title, problem, solution, category, tags, priority, created_by } = req.body;

      // Mask sensitive data for LGPD compliance
      if (this.config.lgpd.enabled) {
        const masked = this.applySensitiveDataMasking({ title, problem, solution });
        title = masked.title;
        problem = masked.problem;
        solution = masked.solution;
      }

      // Auto-categorize if not provided
      if (!category) {
        const categorization = await this.performAICategorization(problem);
        category = categorization.category;
      }

      // Auto-generate tags if not provided
      if (!tags || tags.length === 0) {
        tags = await this.generateTags({ title, problem, solution, category });
      }

      // Validate the entry
      const entry = {
        title,
        problem,
        solution: solution || '',
        category,
        tags: tags || [],
        created_by: created_by || 'api'
      };

      const validation = this.services.validation.validateEntry(entry);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Entry validation failed',
          details: validation.errors,
          warnings: validation.warnings
        });
      }

      // Create the incident
      const sanitizedEntry = this.services.validation.sanitizeEntry(entry);
      const incident = await this.services.kb.create(sanitizedEntry);

      // Add to vector database
      if (this.chromaClient) {
        try {
          await this.addToVectorDatabase(incident);
        } catch (error) {
          console.warn('Failed to add to vector database:', error);
        }
      }

      res.status(201).json({
        success: true,
        incident,
        metadata: {
          auto_categorized: !req.body.category,
          auto_tagged: !req.body.tags || req.body.tags.length === 0,
          quality_score: validation.score,
          masked_fields: this.config.lgpd.enabled ? this.config.lgpd.maskFields : []
        }
      });

    } catch (error) {
      console.error('Create incident error:', error);
      res.status(500).json({
        error: 'Failed to create incident',
        message: error.message
      });
    }
  }

  /**
   * Semantic search with RAG capabilities
   */
  async semanticSearch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        q: query,
        limit = 20,
        threshold = 0.1,
        category,
        use_vector = true,
        use_llm = true
      } = req.query;

      const searchOptions = {
        limit: parseInt(limit),
        threshold: parseFloat(threshold),
        category,
        useAI: use_llm === 'true' || use_llm === true,
        includeHighlights: true,
        includeFields: ['title', 'problem', 'solution', 'tags', 'category']
      };

      let results = [];

      // Vector search if ChromaDB is available
      if (use_vector && this.chromaClient) {
        try {
          const vectorResults = await this.performVectorSearch(query, searchOptions);
          results = vectorResults;
        } catch (error) {
          console.warn('Vector search failed, falling back to standard search:', error);
        }
      }

      // Fallback to enhanced search service
      if (results.length === 0) {
        const allEntries = await this.services.kb.getAll();
        if (this.services.search instanceof EnhancedSearchService) {
          results = await this.services.search.search(query, allEntries, searchOptions);
        } else {
          results = await this.services.search.search(query, allEntries, searchOptions);
        }
      }

      // Apply LGPD masking if enabled
      if (this.config.lgpd.enabled) {
        results = results.map(result => ({
          ...result,
          entry: this.applySensitiveDataMasking(result.entry)
        }));
      }

      // Generate RAG context
      const ragContext = await this.generateRAGContext(query, results.slice(0, 5));

      res.json({
        success: true,
        query,
        results,
        metadata: {
          total: results.length,
          search_type: this.chromaClient && use_vector ? 'vector+semantic' : 'semantic',
          threshold,
          processing_time: Date.now() - req.start_time || 0,
          rag_context: ragContext
        }
      });

    } catch (error) {
      console.error('Semantic search error:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  }

  /**
   * Find similar incidents using duplicate detection
   */
  async findSimilarIncidents(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        incident_id,
        title,
        problem,
        solution,
        threshold = 0.7,
        limit = 20,
        use_ai = false
      } = req.body;

      let targetIncident;

      // Get target incident
      if (incident_id) {
        targetIncident = await this.services.kb.getById(incident_id);
        if (!targetIncident) {
          return res.status(404).json({ error: 'Incident not found' });
        }
      } else if (title || problem) {
        targetIncident = {
          id: 'temp',
          title: title || '',
          problem: problem || '',
          solution: solution || '',
          category: 'Other',
          tags: []
        };
      } else {
        return res.status(400).json({
          error: 'Either incident_id or title/problem must be provided'
        });
      }

      // Get all incidents for comparison
      const allIncidents = await this.services.kb.getAll();

      // Find similar incidents
      const similarResults = await this.services.duplicate.findSimilar(
        targetIncident,
        allIncidents,
        {
          threshold: parseFloat(threshold),
          useAI: use_ai,
          maxComparisons: 1000,
          includeFields: ['title', 'problem', 'solution', 'tags', 'category']
        }
      );

      // Apply LGPD masking
      const maskedResults = this.config.lgpd.enabled
        ? similarResults.map(result => ({
            ...result,
            entry: this.applySensitiveDataMasking(result.entry)
          }))
        : similarResults;

      res.json({
        success: true,
        target_incident: this.config.lgpd.enabled
          ? this.applySensitiveDataMasking(targetIncident)
          : targetIncident,
        similar_incidents: maskedResults.slice(0, parseInt(limit)),
        metadata: {
          total_comparisons: allIncidents.length,
          threshold,
          use_ai,
          processing_time: Date.now() - req.start_time || 0
        }
      });

    } catch (error) {
      console.error('Find similar incidents error:', error);
      res.status(500).json({
        error: 'Failed to find similar incidents',
        message: error.message
      });
    }
  }

  /**
   * Categorize incident using AI
   */
  async categorizeIncident(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { text, llm_provider = 'gemini' } = req.body;

      const result = await this.performAICategorization(text, llm_provider);

      res.json({
        success: true,
        ...result,
        metadata: {
          llm_provider,
          processing_time: Date.now() - req.start_time || 0
        }
      });

    } catch (error) {
      console.error('Categorization error:', error);
      res.status(500).json({
        error: 'Categorization failed',
        message: error.message
      });
    }
  }

  /**
   * Vector search using ChromaDB
   */
  async vectorSearch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!this.chromaClient) {
        return res.status(503).json({
          error: 'Vector search not available',
          message: 'ChromaDB not initialized'
        });
      }

      const { query, limit = 20, threshold = 0.1 } = req.body;

      const results = await this.performVectorSearch(query, {
        limit: parseInt(limit),
        threshold: parseFloat(threshold)
      });

      res.json({
        success: true,
        query,
        results,
        metadata: {
          total: results.length,
          search_type: 'vector',
          threshold,
          processing_time: Date.now() - req.start_time || 0
        }
      });

    } catch (error) {
      console.error('Vector search error:', error);
      res.status(500).json({
        error: 'Vector search failed',
        message: error.message
      });
    }
  }

  /**
   * Mask sensitive data for LGPD compliance
   */
  async maskSensitiveData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { data, fields } = req.body;
      const maskFields = fields || this.config.lgpd.maskFields;

      const masked = this.applySensitiveDataMasking(data, maskFields);

      res.json({
        success: true,
        original: data,
        masked,
        masked_fields: maskFields
      });

    } catch (error) {
      console.error('Data masking error:', error);
      res.status(500).json({
        error: 'Data masking failed',
        message: error.message
      });
    }
  }

  /**
   * Bulk operations on incidents
   */
  async bulkOperations(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { incidents, operation } = req.body;

      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < incidents.length; i++) {
        try {
          let incident = incidents[i];

          // Apply LGPD masking
          if (this.config.lgpd.enabled) {
            incident = this.applySensitiveDataMasking(incident);
          }

          switch (operation) {
            case 'create':
              await this.services.kb.create(incident);
              break;
            case 'update':
              await this.services.kb.update(incident.id, incident);
              break;
            case 'delete':
              await this.services.kb.delete(incident.id);
              break;
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i,
            incident_id: incidents[i].id,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        operation,
        results,
        metadata: {
          total_processed: incidents.length,
          success_rate: (results.successful / incidents.length) * 100
        }
      });

    } catch (error) {
      console.error('Bulk operations error:', error);
      res.status(500).json({
        error: 'Bulk operation failed',
        message: error.message
      });
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(req, res) {
    try {
      const allIncidents = await this.services.kb.getAll();

      const summary = {
        total_incidents: allIncidents.length,
        categories: {},
        tags: {},
        recent_activity: {
          last_24h: 0,
          last_7d: 0,
          last_30d: 0
        },
        quality_metrics: {
          avg_title_length: 0,
          avg_problem_length: 0,
          avg_solution_length: 0,
          incidents_with_solutions: 0
        }
      };

      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      allIncidents.forEach(incident => {
        // Categories
        summary.categories[incident.category] = (summary.categories[incident.category] || 0) + 1;

        // Tags
        if (incident.tags) {
          incident.tags.forEach(tag => {
            summary.tags[tag] = (summary.tags[tag] || 0) + 1;
          });
        }

        // Recent activity
        const created = new Date(incident.created_at).getTime();
        if (now - created < day) summary.recent_activity.last_24h++;
        if (now - created < 7 * day) summary.recent_activity.last_7d++;
        if (now - created < 30 * day) summary.recent_activity.last_30d++;

        // Quality metrics
        summary.quality_metrics.avg_title_length += incident.title?.length || 0;
        summary.quality_metrics.avg_problem_length += incident.problem?.length || 0;
        summary.quality_metrics.avg_solution_length += incident.solution?.length || 0;
        if (incident.solution && incident.solution.trim().length > 0) {
          summary.quality_metrics.incidents_with_solutions++;
        }
      });

      // Calculate averages
      if (allIncidents.length > 0) {
        summary.quality_metrics.avg_title_length /= allIncidents.length;
        summary.quality_metrics.avg_problem_length /= allIncidents.length;
        summary.quality_metrics.avg_solution_length /= allIncidents.length;
      }

      res.json({
        success: true,
        summary,
        metadata: {
          generated_at: new Date().toISOString(),
          data_points: allIncidents.length
        }
      });

    } catch (error) {
      console.error('Analytics summary error:', error);
      res.status(500).json({
        error: 'Failed to generate analytics summary',
        message: error.message
      });
    }
  }

  /**
   * Get trends data
   */
  async getTrends(req, res) {
    try {
      const { period = '30d', category } = req.query;

      const allIncidents = await this.services.kb.getAll();

      const trends = {
        incident_creation: {},
        category_distribution: {},
        resolution_patterns: {},
        tag_popularity: {}
      };

      // Filter by category if specified
      const filteredIncidents = category
        ? allIncidents.filter(i => i.category === category)
        : allIncidents;

      // Group by time periods (simplified)
      filteredIncidents.forEach(incident => {
        const date = new Date(incident.created_at).toISOString().split('T')[0];
        trends.incident_creation[date] = (trends.incident_creation[date] || 0) + 1;
        trends.category_distribution[incident.category] = (trends.category_distribution[incident.category] || 0) + 1;
      });

      res.json({
        success: true,
        period,
        category: category || 'all',
        trends,
        metadata: {
          total_incidents: filteredIncidents.length,
          date_range: {
            start: Math.min(...filteredIncidents.map(i => new Date(i.created_at).getTime())),
            end: Math.max(...filteredIncidents.map(i => new Date(i.created_at).getTime()))
          }
        }
      });

    } catch (error) {
      console.error('Trends error:', error);
      res.status(500).json({
        error: 'Failed to generate trends',
        message: error.message
      });
    }
  }

  // === Helper Methods ===

  /**
   * Perform AI categorization using available LLM
   */
  async performAICategorization(text, provider = 'gemini') {
    try {
      if (provider === 'gemini' && this.llmClients.gemini) {
        return await this.llmClients.gemini.categorizeproblem(text);
      }

      if (provider === 'openai' && this.llmClients.openai) {
        const completion = await this.llmClients.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Categorize this mainframe problem into one of: JCL, VSAM, DB2, Batch, CICS, IMS, System, Network, Security, Other. Return format: category:confidence_score'
            },
            { role: 'user', content: text }
          ],
          temperature: 0.3,
          max_tokens: 50
        });

        const response = completion.choices[0].message.content;
        const match = response.match(/^(\w+):(\d+)$/);
        if (match) {
          return { category: match[1], confidence: parseInt(match[2]) };
        }
      }

      // Fallback to rule-based categorization
      return this.fallbackCategorization(text);
    } catch (error) {
      console.warn('AI categorization failed, using fallback:', error);
      return this.fallbackCategorization(text);
    }
  }

  /**
   * Fallback categorization logic
   */
  fallbackCategorization(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('jcl') || lowerText.includes('job')) return { category: 'JCL', confidence: 70 };
    if (lowerText.includes('vsam') || lowerText.includes('file')) return { category: 'VSAM', confidence: 70 };
    if (lowerText.includes('db2') || lowerText.includes('sql')) return { category: 'DB2', confidence: 70 };
    if (lowerText.includes('cics')) return { category: 'CICS', confidence: 70 };
    if (lowerText.includes('batch') || lowerText.includes('program')) return { category: 'Batch', confidence: 70 };

    return { category: 'Other', confidence: 50 };
  }

  /**
   * Generate tags for incident
   */
  async generateTags(entry) {
    try {
      if (this.llmClients.gemini) {
        return await this.llmClients.gemini.generateTags(entry);
      }

      // Fallback tag generation
      const tags = [];
      const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();

      // Extract technical terms
      const patterns = [
        /s0c[4-7]/g,
        /[a-z]\d{3,4}/g,
        /jcl|vsam|db2|cics|cobol|abend/g
      ];

      patterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        tags.push(...matches);
      });

      if (entry.category) tags.push(entry.category.toLowerCase());

      return [...new Set(tags)].slice(0, 8);
    } catch (error) {
      console.warn('Tag generation failed:', error);
      return [entry.category?.toLowerCase()].filter(Boolean);
    }
  }

  /**
   * Perform vector search using ChromaDB
   */
  async performVectorSearch(query, options = {}) {
    if (!this.chromaClient || !this.incidentCollection) {
      throw new Error('ChromaDB not available');
    }

    const results = await this.incidentCollection.query({
      queryTexts: [query],
      nResults: options.limit || 20,
      where: options.category ? { category: options.category } : undefined
    });

    return results.ids[0].map((id, index) => ({
      entry: {
        id: results.metadatas[0][index].id,
        title: results.metadatas[0][index].title,
        problem: results.metadatas[0][index].problem,
        solution: results.metadatas[0][index].solution,
        category: results.metadatas[0][index].category,
        tags: JSON.parse(results.metadatas[0][index].tags || '[]')
      },
      score: 1 - results.distances[0][index], // Convert distance to similarity
      matchType: 'vector',
      highlights: [results.documents[0][index].substring(0, 200)]
    })).filter(result => result.score >= (options.threshold || 0.1));
  }

  /**
   * Add incident to vector database
   */
  async addToVectorDatabase(incident) {
    if (!this.chromaClient || !this.incidentCollection) return;

    const document = `${incident.title} ${incident.problem} ${incident.solution}`;

    await this.incidentCollection.add({
      ids: [incident.id.toString()],
      documents: [document],
      metadatas: [{
        id: incident.id,
        title: incident.title,
        problem: incident.problem,
        solution: incident.solution || '',
        category: incident.category,
        tags: JSON.stringify(incident.tags || [])
      }]
    });
  }

  /**
   * Generate RAG context for better responses
   */
  async generateRAGContext(query, results) {
    if (results.length === 0) return null;

    return {
      relevant_incidents: results.slice(0, 3).map(r => ({
        title: r.entry.title,
        category: r.entry.category,
        summary: r.entry.problem.substring(0, 200),
        solution_preview: r.entry.solution?.substring(0, 150),
        relevance_score: r.score
      })),
      suggested_actions: this.generateSuggestedActions(query, results),
      related_categories: [...new Set(results.map(r => r.entry.category))],
      common_tags: this.extractCommonTags(results)
    };
  }

  /**
   * Generate suggested actions based on search results
   */
  generateSuggestedActions(query, results) {
    const actions = [];

    if (results.length > 0) {
      actions.push('Review similar incidents for proven solutions');

      const hasHighConfidence = results.some(r => r.score > 0.8);
      if (hasHighConfidence) {
        actions.push('Apply solutions from high-confidence matches');
      }

      const categories = [...new Set(results.map(r => r.entry.category))];
      if (categories.length === 1) {
        actions.push(`Focus troubleshooting on ${categories[0]} components`);
      }
    }

    return actions;
  }

  /**
   * Extract common tags from results
   */
  extractCommonTags(results) {
    const tagCounts = {};
    results.forEach(r => {
      (r.entry.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, frequency: count }));
  }

  /**
   * Apply LGPD data masking
   */
  applySensitiveDataMasking(data, maskFields = null) {
    if (!this.config.lgpd.enabled) return data;

    const fields = maskFields || this.config.lgpd.maskFields;
    const masked = { ...data };

    // Email pattern
    if (fields.includes('email')) {
      ['title', 'problem', 'solution'].forEach(field => {
        if (masked[field]) {
          masked[field] = masked[field].replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            '***@***.***'
          );
        }
      });
    }

    // CPF pattern (Brazilian)
    if (fields.includes('cpf')) {
      ['title', 'problem', 'solution'].forEach(field => {
        if (masked[field]) {
          masked[field] = masked[field].replace(
            /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
            '***.***.***-**'
          );
        }
      });
    }

    // Phone pattern
    if (fields.includes('phone')) {
      ['title', 'problem', 'solution'].forEach(field => {
        if (masked[field]) {
          masked[field] = masked[field].replace(
            /\(\d{2}\)\s?\d{4,5}-?\d{4}/g,
            '(##) ####-####'
          );
        }
      });
    }

    return masked;
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Global error handler:', error);

      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(this.config.port, () => {
        console.log(`🚀 Incident AI Server running on port ${this.config.port}`);
        console.log(`📚 API Documentation: http://localhost:${this.config.port}/health`);
        console.log(`🔍 Search endpoint: http://localhost:${this.config.port}/api/search/semantic`);
        console.log(`📝 Create endpoint: http://localhost:${this.config.port}/api/incidents/create`);
      });

      return this.server;
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 Server stopped gracefully');
          resolve();
        });
      });
    }
  }
}

module.exports = IncidentAIServer;

// Export for direct usage
if (require.main === module) {
  const config = {
    port: process.env.PORT || 3001,
    llm: {
      gemini: {
        apiKey: process.env.GEMINI_API_KEY
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY
      },
      claude: {
        apiKey: process.env.CLAUDE_API_KEY
      },
      azure: {
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT
      }
    },
    chroma: {
      url: process.env.CHROMA_URL || 'http://localhost:8000'
    },
    lgpd: {
      enabled: process.env.LGPD_ENABLED !== 'false',
      maskFields: ['email', 'cpf', 'phone']
    }
  };

  const server = new IncidentAIServer(config);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start server
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}