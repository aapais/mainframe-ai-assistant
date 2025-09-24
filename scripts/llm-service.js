/**
 * LLM Service - Unified service for multiple LLM providers
 * Supports Gemini, OpenAI, and Azure OpenAI with data sanitization
 */

const DataSanitizer = require('./data-sanitizer');

class LLMService {
    constructor() {
        this.sanitizer = new DataSanitizer();
        this.cache = new Map();
        this.rateLimiter = new Map(); // Provider -> { count, resetTime }
        this.cacheMaxAge = 1000 * 60 * 15; // 15 minutes

        // Rate limits per provider (requests per minute)
        this.rateLimits = {
            gemini: 60,
            openai: 60,
            azure: 60
        };

        // Provider configurations
        this.providers = {
            gemini: null,
            openai: null,
            azure: null
        };

        this.initializeProviders();
    }

    /**
     * Initialize LLM provider SDKs
     */
    async initializeProviders() {
        try {
            // Initialize Google Gemini
            const { GoogleGenerativeAI } = await this.dynamicImport('@google/generative-ai');
            this.providers.gemini = { GoogleGenerativeAI };

            // Initialize OpenAI
            const { OpenAI } = await this.dynamicImport('openai');
            this.providers.openai = { OpenAI };

            // Initialize Azure OpenAI
            const { AzureOpenAI } = await this.dynamicImport('openai');
            this.providers.azure = { AzureOpenAI };

            console.log('LLM providers initialized successfully');
        } catch (error) {
            console.warn('Some LLM providers failed to initialize:', error.message);
        }
    }

    /**
     * Dynamic import helper for optional dependencies
     */
    async dynamicImport(moduleName) {
        try {
            return await import(moduleName);
        } catch (error) {
            console.warn(`Failed to import ${moduleName}:`, error.message);
            throw error;
        }
    }

    /**
     * Main method to analyze incident with specified LLM provider
     * @param {Object} incident - Incident data
     * @param {string} provider - LLM provider ('gemini', 'openai', 'azure')
     * @param {string|Object} apiConfig - API key string or configuration object
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Analysis results
     */
    async analyzeIncident(incident, provider = 'gemini', apiConfig, options = {}) {
        try {
            // Validate inputs
            if (!incident) {
                throw new Error('Incident data is required');
            }

            if (!this.isValidProvider(provider)) {
                throw new Error(`Unsupported provider: ${provider}. Supported: gemini, openai, azure`);
            }

            // Check rate limits
            if (!this.checkRateLimit(provider)) {
                throw new Error(`Rate limit exceeded for provider: ${provider}`);
            }

            // Generate cache key
            const cacheKey = this.generateCacheKey(incident, provider, options);

            // Check cache first
            if (options.useCache !== false) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    console.log(`Cache hit for provider: ${provider}`);
                    return cached;
                }
            }

            // Sanitize incident data
            const { sanitized, map } = this.sanitizer.sanitizeIncident(incident);

            console.log(`Analyzing incident with ${provider}...`);
            console.log(`Sanitization stats:`, this.sanitizer.getStats());

            // Call appropriate provider
            let result;
            switch (provider) {
                case 'gemini':
                    result = await this.analyzeWithGemini(sanitized, apiConfig, options);
                    break;
                case 'openai':
                    result = await this.analyzeWithOpenAI(sanitized, apiConfig, options);
                    break;
                case 'azure':
                    result = await this.analyzeWithAzure(sanitized, apiConfig, options);
                    break;
                default:
                    throw new Error(`Provider ${provider} is not implemented`);
            }

            // Restore sensitive data in result if needed
            if (options.restoreData !== false && result.analysis) {
                result.analysis = this.sanitizer.restoreData(result.analysis, map);
            }

            // Structure the response
            const structuredResult = this.structureResponse(result, incident, provider, map);

            // Cache the result
            if (options.useCache !== false) {
                this.setCache(cacheKey, structuredResult);
            }

            // Update rate limit counter
            this.updateRateLimit(provider);

            return structuredResult;

        } catch (error) {
            console.error(`LLM analysis failed with ${provider}:`, error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze incident with Google Gemini
     * @param {Object} sanitizedIncident - Sanitized incident data
     * @param {string} apiKey - Gemini API key
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} - Gemini analysis results
     */
    async analyzeWithGemini(sanitizedIncident, apiKey, options = {}) {
        if (!this.providers.gemini) {
            throw new Error('Gemini provider not initialized');
        }

        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }

        try {
            const { GoogleGenerativeAI } = this.providers.gemini;
            const genAI = new GoogleGenerativeAI(apiKey);

            // Use Gemini Pro model
            const model = genAI.getGenerativeModel({
                model: options.model || 'gemini-pro',
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 40,
                    topP: options.topP || 0.95,
                    maxOutputTokens: options.maxTokens || 2048,
                }
            });

            // Create analysis prompt
            const prompt = this.createAnalysisPrompt(sanitizedIncident, options);

            // Generate content
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return {
                analysis: text,
                provider: 'gemini',
                model: options.model || 'gemini-pro',
                tokenUsage: {
                    promptTokens: result.response?.promptFeedback?.tokenCount || 0,
                    completionTokens: text.length / 4, // Rough estimation
                    totalTokens: (result.response?.promptFeedback?.tokenCount || 0) + (text.length / 4)
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    safety: result.response?.promptFeedback?.safetyRatings || []
                }
            };

        } catch (error) {
            console.error('Gemini analysis error:', error);
            throw new Error(`Gemini analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze incident with OpenAI
     * @param {Object} sanitizedIncident - Sanitized incident data
     * @param {string|Object} apiConfig - API key or configuration
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} - OpenAI analysis results
     */
    async analyzeWithOpenAI(sanitizedIncident, apiConfig, options = {}) {
        if (!this.providers.openai) {
            throw new Error('OpenAI provider not initialized');
        }

        let apiKey, baseURL;
        if (typeof apiConfig === 'string') {
            apiKey = apiConfig;
        } else if (typeof apiConfig === 'object') {
            apiKey = apiConfig.apiKey;
            baseURL = apiConfig.baseURL;
        }

        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }

        try {
            const { OpenAI } = this.providers.openai;
            const openai = new OpenAI({
                apiKey,
                ...(baseURL && { baseURL })
            });

            // Create analysis prompt
            const prompt = this.createAnalysisPrompt(sanitizedIncident, options);

            // Call OpenAI API
            const response = await openai.chat.completions.create({
                model: options.model || 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert incident analyst. Analyze the provided incident data and provide detailed insights, root cause analysis, and recommendations.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 2048,
                top_p: options.topP || 0.95,
                frequency_penalty: options.frequencyPenalty || 0,
                presence_penalty: options.presencePenalty || 0
            });

            return {
                analysis: response.choices[0].message.content,
                provider: 'openai',
                model: response.model,
                tokenUsage: {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    finishReason: response.choices[0].finish_reason
                }
            };

        } catch (error) {
            console.error('OpenAI analysis error:', error);
            throw new Error(`OpenAI analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze incident with Azure OpenAI
     * @param {Object} sanitizedIncident - Sanitized incident data
     * @param {Object} azureConfig - Azure OpenAI configuration
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} - Azure OpenAI analysis results
     */
    async analyzeWithAzure(sanitizedIncident, azureConfig, options = {}) {
        if (!this.providers.azure) {
            throw new Error('Azure OpenAI provider not initialized');
        }

        if (!azureConfig || !azureConfig.apiKey || !azureConfig.endpoint) {
            throw new Error('Azure OpenAI configuration (apiKey, endpoint) is required');
        }

        try {
            const { AzureOpenAI } = this.providers.azure;
            const azure = new AzureOpenAI({
                apiKey: azureConfig.apiKey,
                endpoint: azureConfig.endpoint,
                apiVersion: azureConfig.apiVersion || '2024-02-15-preview'
            });

            // Create analysis prompt
            const prompt = this.createAnalysisPrompt(sanitizedIncident, options);

            // Call Azure OpenAI API
            const response = await azure.chat.completions.create({
                model: options.model || azureConfig.deploymentName || 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert incident analyst. Analyze the provided incident data and provide detailed insights, root cause analysis, and recommendations.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 2048,
                top_p: options.topP || 0.95
            });

            return {
                analysis: response.choices[0].message.content,
                provider: 'azure',
                model: response.model,
                tokenUsage: {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    finishReason: response.choices[0].finish_reason,
                    endpoint: azureConfig.endpoint
                }
            };

        } catch (error) {
            console.error('Azure OpenAI analysis error:', error);
            throw new Error(`Azure OpenAI analysis failed: ${error.message}`);
        }
    }

    /**
     * Create analysis prompt from incident data
     * @param {Object} incident - Incident data
     * @param {Object} options - Analysis options
     * @returns {string} - Formatted prompt
     */
    createAnalysisPrompt(incident, options = {}) {
        const analysisType = options.analysisType || 'comprehensive';

        let prompt = `Please analyze the following incident data and provide a ${analysisType} analysis:\n\n`;

        // Add incident details
        if (incident.title) prompt += `Title: ${incident.title}\n`;
        if (incident.description) prompt += `Description: ${incident.description}\n`;
        if (incident.severity) prompt += `Severity: ${incident.severity}\n`;
        if (incident.category) prompt += `Category: ${incident.category}\n`;
        if (incident.status) prompt += `Status: ${incident.status}\n`;
        if (incident.assignee) prompt += `Assignee: ${incident.assignee}\n`;
        if (incident.createdAt) prompt += `Created: ${incident.createdAt}\n`;
        if (incident.updatedAt) prompt += `Updated: ${incident.updatedAt}\n`;

        // Add technical details
        if (incident.environment) prompt += `Environment: ${incident.environment}\n`;
        if (incident.affectedSystems) prompt += `Affected Systems: ${JSON.stringify(incident.affectedSystems)}\n`;
        if (incident.errorMessages) prompt += `Error Messages: ${JSON.stringify(incident.errorMessages)}\n`;
        if (incident.logs) prompt += `Logs: ${JSON.stringify(incident.logs)}\n`;

        // Add resolution information if available
        if (incident.resolution) prompt += `Resolution: ${incident.resolution}\n`;
        if (incident.rootCause) prompt += `Root Cause: ${incident.rootCause}\n`;

        prompt += '\n';

        // Add specific analysis requests based on type
        switch (analysisType) {
            case 'root-cause':
                prompt += 'Focus on identifying the root cause of this incident. Provide a detailed analysis of contributing factors and primary causes.';
                break;
            case 'impact':
                prompt += 'Analyze the impact of this incident on business operations, users, and systems. Include severity assessment and affected areas.';
                break;
            case 'recommendations':
                prompt += 'Provide specific recommendations for resolving this incident and preventing similar issues in the future.';
                break;
            case 'timeline':
                prompt += 'Create a timeline analysis of this incident, identifying key events and decision points.';
                break;
            default:
                prompt += `Please provide:
1. Incident Summary
2. Root Cause Analysis
3. Impact Assessment
4. Resolution Recommendations
5. Prevention Strategies
6. Lessons Learned
7. Next Steps

Format your response in clear sections with actionable insights.`;
        }

        return prompt;
    }

    /**
     * Structure the LLM response with metadata
     */
    structureResponse(result, originalIncident, provider, sanitizationMap) {
        return {
            incidentId: originalIncident.id || 'unknown',
            analysis: {
                provider,
                model: result.model,
                content: result.analysis,
                confidence: this.calculateConfidence(result),
                timestamp: new Date().toISOString()
            },
            insights: this.extractInsights(result.analysis),
            recommendations: this.extractRecommendations(result.analysis),
            metadata: {
                tokenUsage: result.tokenUsage,
                processingTime: Date.now(),
                sanitizationStats: this.sanitizer.getStats(),
                provider: result.provider,
                ...result.metadata
            }
        };
    }

    /**
     * Extract insights from analysis text
     */
    extractInsights(analysisText) {
        const insights = [];

        // Simple pattern matching for common insight indicators
        const patterns = [
            /root cause[:\s]+([^.]+)/gi,
            /impact[:\s]+([^.]+)/gi,
            /affected[:\s]+([^.]+)/gi,
            /recommendation[:\s]+([^.]+)/gi
        ];

        patterns.forEach(pattern => {
            const matches = analysisText.match(pattern);
            if (matches) {
                insights.push(...matches.map(match => match.trim()));
            }
        });

        return insights.length > 0 ? insights : ['Analysis completed - see full content'];
    }

    /**
     * Extract recommendations from analysis text
     */
    extractRecommendations(analysisText) {
        const recommendations = [];

        // Look for numbered lists or bullet points
        const lines = analysisText.split('\n');
        let inRecommendationSection = false;

        lines.forEach(line => {
            const trimmed = line.trim();

            if (trimmed.toLowerCase().includes('recommendation') ||
                trimmed.toLowerCase().includes('next steps') ||
                trimmed.toLowerCase().includes('action')) {
                inRecommendationSection = true;
                return;
            }

            if (inRecommendationSection && (trimmed.match(/^\d+\./) || trimmed.match(/^[-*]/))) {
                recommendations.push(trimmed);
            }
        });

        return recommendations.length > 0 ? recommendations : ['See analysis for detailed recommendations'];
    }

    /**
     * Calculate confidence score based on response characteristics
     */
    calculateConfidence(result) {
        let confidence = 0.5; // Base confidence

        // Adjust based on response length
        if (result.analysis && result.analysis.length > 500) confidence += 0.2;
        if (result.analysis && result.analysis.length > 1000) confidence += 0.1;

        // Adjust based on token usage
        if (result.tokenUsage && result.tokenUsage.totalTokens > 1000) confidence += 0.1;

        // Adjust based on provider
        if (result.provider === 'gpt-4') confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    /**
     * Rate limiting functionality
     */
    checkRateLimit(provider) {
        const now = Date.now();
        const limit = this.rateLimits[provider] || 60;

        if (!this.rateLimiter.has(provider)) {
            this.rateLimiter.set(provider, { count: 0, resetTime: now + 60000 });
            return true;
        }

        const data = this.rateLimiter.get(provider);

        if (now > data.resetTime) {
            data.count = 0;
            data.resetTime = now + 60000;
        }

        return data.count < limit;
    }

    updateRateLimit(provider) {
        if (this.rateLimiter.has(provider)) {
            this.rateLimiter.get(provider).count++;
        }
    }

    /**
     * Caching functionality
     */
    generateCacheKey(incident, provider, options) {
        const keyData = {
            incidentHash: this.hashObject(incident),
            provider,
            model: options.model || 'default',
            analysisType: options.analysisType || 'comprehensive'
        };
        return JSON.stringify(keyData);
    }

    hashObject(obj) {
        return require('crypto')
            .createHash('md5')
            .update(JSON.stringify(obj))
            .digest('hex');
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Utility methods
     */
    isValidProvider(provider) {
        return ['gemini', 'openai', 'azure'].includes(provider);
    }

    getProviderStatus() {
        return {
            gemini: !!this.providers.gemini,
            openai: !!this.providers.openai,
            azure: !!this.providers.azure
        };
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxAge: this.cacheMaxAge / 1000 / 60, // minutes
            keys: Array.from(this.cache.keys())
        };
    }

    getRateLimitStats() {
        const stats = {};
        for (const [provider, data] of this.rateLimiter.entries()) {
            stats[provider] = {
                count: data.count,
                limit: this.rateLimits[provider],
                resetTime: new Date(data.resetTime).toISOString()
            };
        }
        return stats;
    }

    clearCache() {
        this.cache.clear();
        console.log('Cache cleared');
    }

    resetRateLimits() {
        this.rateLimiter.clear();
        console.log('Rate limits reset');
    }
}

// Export for CommonJS (Node.js)
module.exports = LLMService;

// Example usage:
if (require.main === module) {
    async function example() {
        const llmService = new LLMService();

        const incident = {
            id: 'INC-001',
            title: 'Database Connection Timeout',
            description: 'Users unable to access application due to database connectivity issues',
            severity: 'high',
            category: 'infrastructure',
            environment: 'production',
            affectedSystems: ['web-app', 'database'],
            errorMessages: ['Connection timeout after 30 seconds']
        };

        try {
            // Example with Gemini
            const result = await llmService.analyzeIncident(
                incident,
                'gemini',
                'your-gemini-api-key'
            );

            console.log('Analysis Result:', result);
        } catch (error) {
            console.error('Analysis failed:', error.message);
        }
    }

    // Uncomment to run example
    // example();
}