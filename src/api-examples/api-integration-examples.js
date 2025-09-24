// API Integration Examples for localhost:3001
// These examples show how the AI features integrate with the REST API

const API_BASE = 'http://localhost:3001';

// 1. Auto-categorization API Integration
export const aiCategorization = {
    // Categorize incident using AI
    async categorizeIncident(title, description) {
        try {
            const response = await fetch(`${API_BASE}/api/ai/categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('api_token')
                },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    context: {
                        timestamp: new Date().toISOString(),
                        source: 'mainframe-assistant'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                category: result.category,
                confidence: result.confidence,
                subcategory: result.subcategory,
                suggestedPriority: result.suggestedPriority,
                reasoning: result.reasoning
            };
        } catch (error) {
            console.error('AI Categorization failed:', error);
            throw error;
        }
    },

    // Get categorization history
    async getCategorializationHistory(limit = 50) {
        const response = await fetch(`${API_BASE}/api/ai/categorize/history?limit=${limit}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    }
};

// 2. Semantic Search API Integration
export const semanticSearch = {
    // Perform semantic search on knowledge base
    async searchKnowledgeBase(query, options = {}) {
        const searchParams = {
            query: query,
            mode: options.mode || 'semantic', // semantic, exact, fuzzy
            limit: options.limit || 10,
            threshold: options.threshold || 0.7,
            filters: {
                category: options.category,
                dateRange: options.dateRange,
                author: options.author
            }
        };

        try {
            const response = await fetch(`${API_BASE}/api/knowledge/semantic-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('api_token')
                },
                body: JSON.stringify(searchParams)
            });

            const results = await response.json();
            return results.map(result => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity_score,
                category: result.category,
                lastUpdated: result.last_updated,
                author: result.author,
                tags: result.tags,
                metadata: result.metadata
            }));
        } catch (error) {
            console.error('Semantic search failed:', error);
            throw error;
        }
    },

    // Get search analytics
    async getSearchAnalytics(timeframe = '7d') {
        const response = await fetch(`${API_BASE}/api/knowledge/search-analytics?timeframe=${timeframe}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    },

    // Get popular search terms
    async getPopularSearchTerms(limit = 20) {
        const response = await fetch(`${API_BASE}/api/knowledge/popular-searches?limit=${limit}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    }
};

// 3. RAG Pipeline API Integration
export const ragPipeline = {
    // Generate resolution using RAG
    async generateResolution(incident) {
        const ragRequest = {
            incident: {
                title: incident.title,
                description: incident.description,
                category: incident.category,
                priority: incident.priority,
                history: incident.history || []
            },
            context: {
                includeHistory: true,
                includeSimilar: true,
                maxSources: 10,
                confidenceThreshold: 0.8
            },
            options: {
                language: 'pt-BR',
                format: 'structured',
                includeSteps: true,
                includeRationale: true
            }
        };

        try {
            const response = await fetch(`${API_BASE}/api/rag/generate-resolution`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('api_token')
                },
                body: JSON.stringify(ragRequest)
            });

            const result = await response.json();
            return {
                resolution: result.resolution,
                confidence: result.confidence,
                sources: result.sources,
                steps: result.steps,
                rationale: result.rationale,
                estimatedTime: result.estimated_time,
                riskLevel: result.risk_level,
                alternativeApproaches: result.alternatives
            };
        } catch (error) {
            console.error('RAG generation failed:', error);
            throw error;
        }
    },

    // Get RAG pipeline metrics
    async getRagMetrics() {
        const response = await fetch(`${API_BASE}/api/rag/metrics`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    },

    // Provide feedback on RAG response
    async provideFeedback(resolutionId, feedback) {
        const response = await fetch(`${API_BASE}/api/rag/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            },
            body: JSON.stringify({
                resolution_id: resolutionId,
                feedback: feedback,
                timestamp: new Date().toISOString()
            })
        });
        return await response.json();
    }
};

// 4. Similar Incidents API Integration
export const similarIncidents = {
    // Find similar incidents
    async findSimilarIncidents(incident, options = {}) {
        const searchRequest = {
            incident: {
                title: incident.title,
                description: incident.description,
                category: incident.category
            },
            options: {
                limit: options.limit || 10,
                threshold: options.threshold || 0.75,
                includeResolved: options.includeResolved !== false,
                timeframe: options.timeframe, // '30d', '90d', 'all'
                priorityFilter: options.priorityFilter
            }
        };

        try {
            const response = await fetch(`${API_BASE}/api/incidents/find-similar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('api_token')
                },
                body: JSON.stringify(searchRequest)
            });

            const results = await response.json();
            return results.map(incident => ({
                id: incident.id,
                title: incident.title,
                description: incident.description,
                similarity: incident.similarity_score,
                status: incident.status,
                resolution: incident.resolution,
                resolutionTime: incident.resolution_time,
                resolvedBy: incident.resolved_by,
                resolvedDate: incident.resolved_date,
                category: incident.category,
                priority: incident.priority,
                tags: incident.tags
            }));
        } catch (error) {
            console.error('Similar incidents search failed:', error);
            throw error;
        }
    },

    // Get incident resolution patterns
    async getResolutionPatterns(category, timeframe = '90d') {
        const response = await fetch(`${API_BASE}/api/incidents/resolution-patterns?category=${category}&timeframe=${timeframe}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    }
};

// 5. Real-time Dashboard API Integration
export const realtimeDashboard = {
    // Get real-time AI metrics
    async getAIMetrics() {
        try {
            const response = await fetch(`${API_BASE}/api/dashboard/ai-metrics`, {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('api_token')
                }
            });

            const metrics = await response.json();
            return {
                activeModels: metrics.active_models,
                processedToday: metrics.processed_today,
                avgAccuracy: metrics.avg_accuracy,
                responseTimes: metrics.response_times,
                modelStatus: metrics.model_status,
                realtimeEvents: metrics.realtime_events,
                systemHealth: metrics.system_health
            };
        } catch (error) {
            console.error('Failed to fetch AI metrics:', error);
            throw error;
        }
    },

    // Subscribe to real-time updates (WebSocket)
    subscribeToUpdates(callback) {
        const ws = new WebSocket(`ws://localhost:3001/api/dashboard/realtime`);

        ws.onopen = () => {
            console.log('Real-time dashboard connected');
            ws.send(JSON.stringify({
                type: 'subscribe',
                channels: ['ai-metrics', 'incidents', 'search-activity']
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            callback(data);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('Real-time dashboard disconnected');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.subscribeToUpdates(callback), 5000);
        };

        return ws;
    },

    // Get system performance metrics
    async getPerformanceMetrics() {
        const response = await fetch(`${API_BASE}/api/dashboard/performance`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    }
};

// 6. Incident Management API Integration
export const incidentManagement = {
    // Create new incident
    async createIncident(incidentData) {
        try {
            const response = await fetch(`${API_BASE}/api/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('api_token')
                },
                body: JSON.stringify({
                    ...incidentData,
                    created_at: new Date().toISOString(),
                    source: 'ai-assistant'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to create incident:', error);
            throw error;
        }
    },

    // Update incident
    async updateIncident(id, updates) {
        const response = await fetch(`${API_BASE}/api/incidents/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            },
            body: JSON.stringify({
                ...updates,
                updated_at: new Date().toISOString()
            })
        });
        return await response.json();
    },

    // Get all incidents
    async getIncidents(filters = {}) {
        const queryParams = new URLSearchParams();

        if (filters.status) queryParams.append('status', filters.status);
        if (filters.category) queryParams.append('category', filters.category);
        if (filters.priority) queryParams.append('priority', filters.priority);
        if (filters.assignee) queryParams.append('assignee', filters.assignee);
        if (filters.limit) queryParams.append('limit', filters.limit);
        if (filters.offset) queryParams.append('offset', filters.offset);

        const response = await fetch(`${API_BASE}/api/incidents?${queryParams}`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('api_token')
            }
        });
        return await response.json();
    }
};

// 7. Authentication and Error Handling
export const apiUtils = {
    // Initialize API token
    async initializeAuth(credentials) {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            if (response.ok) {
                const { token } = await response.json();
                localStorage.setItem('api_token', token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Authentication failed:', error);
            return false;
        }
    },

    // Check API health
    async checkApiHealth() {
        try {
            const response = await fetch(`${API_BASE}/api/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    // Generic error handler
    handleApiError(error, context) {
        console.error(`API Error in ${context}:`, error);

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return 'Erro de conexão com o servidor. Verifique sua conexão de rede.';
        }

        if (error.status === 401) {
            return 'Não autorizado. Faça login novamente.';
        }

        if (error.status === 403) {
            return 'Acesso negado. Você não tem permissão para esta operação.';
        }

        if (error.status === 429) {
            return 'Muitas solicitações. Tente novamente em alguns segundos.';
        }

        if (error.status >= 500) {
            return 'Erro interno do servidor. Tente novamente mais tarde.';
        }

        return error.message || 'Erro desconhecido';
    }
};

// 8. Usage Examples
export const usageExamples = {
    // Example 1: Create incident with AI categorization
    async createIncidentWithAI(title, description) {
        try {
            // First, get AI categorization
            const categorization = await aiCategorization.categorizeIncident(title, description);

            // Then create the incident with AI-suggested category
            const incident = await incidentManagement.createIncident({
                title,
                description,
                category: categorization.category,
                priority: categorization.suggestedPriority,
                ai_categorized: true,
                ai_confidence: categorization.confidence
            });

            return incident;
        } catch (error) {
            throw apiUtils.handleApiError(error, 'createIncidentWithAI');
        }
    },

    // Example 2: Search and generate resolution
    async searchAndResolve(query) {
        try {
            // Search knowledge base
            const searchResults = await semanticSearch.searchKnowledgeBase(query);

            if (searchResults.length > 0) {
                // Generate RAG-based resolution using search context
                const resolution = await ragPipeline.generateResolution({
                    title: query,
                    description: `Issue requiring resolution: ${query}`,
                    category: searchResults[0].category
                });

                return {
                    searchResults,
                    resolution
                };
            }

            return { searchResults: [], resolution: null };
        } catch (error) {
            throw apiUtils.handleApiError(error, 'searchAndResolve');
        }
    },

    // Example 3: Complete incident analysis workflow
    async completeIncidentAnalysis(incidentId) {
        try {
            // Get incident details
            const incidents = await incidentManagement.getIncidents({ id: incidentId });
            const incident = incidents[0];

            if (!incident) {
                throw new Error('Incident not found');
            }

            // Find similar incidents
            const similarIncidents = await similarIncidents.findSimilarIncidents(incident);

            // Generate RAG resolution
            const ragResolution = await ragPipeline.generateResolution(incident);

            // Search knowledge base for additional context
            const knowledgeResults = await semanticSearch.searchKnowledgeBase(
                `${incident.title} ${incident.description}`
            );

            return {
                incident,
                similarIncidents,
                ragResolution,
                knowledgeResults
            };
        } catch (error) {
            throw apiUtils.handleApiError(error, 'completeIncidentAnalysis');
        }
    }
};

// Export all modules
export {
    aiCategorization,
    semanticSearch,
    ragPipeline,
    similarIncidents,
    realtimeDashboard,
    incidentManagement,
    apiUtils
};