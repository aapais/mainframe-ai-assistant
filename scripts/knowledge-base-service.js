/**
 * Knowledge Base Service
 * Manages solution knowledge for incident resolution
 * Phase 5 - SPARC Completion Integration
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class KnowledgeBaseService {
    constructor(dataDir = './data/knowledge-base') {
        this.dataDir = dataDir;
        this.solutions = new Map();
        this.indexFile = path.join(dataDir, 'kb-index.json');
        this.initialized = false;
    }

    /**
     * Initialize the knowledge base
     */
    async initialize() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await this.loadIndex();
            this.initialized = true;
            console.log(`Knowledge Base initialized with ${this.solutions.size} solutions`);
        } catch (error) {
            console.error('Failed to initialize Knowledge Base:', error);
            throw error;
        }
    }

    /**
     * Load existing solutions from index
     */
    async loadIndex() {
        try {
            const indexData = await fs.readFile(this.indexFile, 'utf8');
            const solutions = JSON.parse(indexData);

            for (const solution of solutions) {
                this.solutions.set(solution.id, solution);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading KB index:', error);
            }
            // File doesn't exist yet, start with empty KB
        }
    }

    /**
     * Save current index to disk
     */
    async saveIndex() {
        const solutions = Array.from(this.solutions.values());
        await fs.writeFile(this.indexFile, JSON.stringify(solutions, null, 2));
    }

    /**
     * Generate UUID for new solutions
     */
    generateId() {
        return crypto.randomUUID();
    }

    /**
     * Validate solution structure
     */
    validateSolution(solution) {
        const required = ['type', 'technical_area', 'business_area', 'title', 'content'];
        const validTypes = ['solution', 'root_cause', 'best_practice'];

        for (const field of required) {
            if (!solution[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!validTypes.includes(solution.type)) {
            throw new Error(`Invalid type: ${solution.type}. Must be one of: ${validTypes.join(', ')}`);
        }

        return true;
    }

    /**
     * Add a new solution to the knowledge base
     */
    async addSolution(solutionData) {
        if (!this.initialized) {
            await this.initialize();
        }

        this.validateSolution(solutionData);

        const solution = {
            id: this.generateId(),
            type: solutionData.type,
            technical_area: solutionData.technical_area,
            business_area: solutionData.business_area,
            title: solutionData.title,
            content: solutionData.content,
            tags: solutionData.tags || [],
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: solutionData.created_by || 'system',
                success_rate: solutionData.success_rate || 0,
                usage_count: 0,
                ...solutionData.metadata
            }
        };

        this.solutions.set(solution.id, solution);
        await this.saveIndex();

        console.log(`Added solution: ${solution.title} (${solution.id})`);
        return solution;
    }

    /**
     * Get solution by ID
     */
    async getSolutionById(id) {
        if (!this.initialized) {
            await this.initialize();
        }

        const solution = this.solutions.get(id);
        if (solution) {
            // Increment usage count
            solution.metadata.usage_count++;
            solution.metadata.updated_at = new Date().toISOString();
            await this.saveIndex();
        }
        return solution;
    }

    /**
     * Update existing solution
     */
    async updateSolution(id, updates) {
        if (!this.initialized) {
            await this.initialize();
        }

        const existing = this.solutions.get(id);
        if (!existing) {
            throw new Error(`Solution not found: ${id}`);
        }

        // Merge updates with existing solution
        const updated = {
            ...existing,
            ...updates,
            id: existing.id, // Prevent ID changes
            metadata: {
                ...existing.metadata,
                ...updates.metadata,
                updated_at: new Date().toISOString()
            }
        };

        this.validateSolution(updated);
        this.solutions.set(id, updated);
        await this.saveIndex();

        console.log(`Updated solution: ${updated.title} (${id})`);
        return updated;
    }

    /**
     * Calculate similarity score between two strings
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();

        // Exact match
        if (s1 === s2) return 1;

        // Contains match
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;

        // Word overlap
        const words1 = s1.split(/\s+/);
        const words2 = s2.split(/\s+/);
        const overlap = words1.filter(word => words2.includes(word)).length;
        const maxWords = Math.max(words1.length, words2.length);

        return overlap / maxWords;
    }

    /**
     * Calculate tag similarity
     */
    calculateTagSimilarity(tags1, tags2) {
        if (!tags1 || !tags2 || tags1.length === 0 || tags2.length === 0) return 0;

        const set1 = new Set(tags1.map(t => t.toLowerCase()));
        const set2 = new Set(tags2.map(t => t.toLowerCase()));

        const intersection = new Set([...set1].filter(tag => set2.has(tag)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Ranking algorithm with weighted scoring
     * - Technical area match (40%)
     * - Business area match (20%)
     * - Tag similarity (20%)
     * - Success rate (20%)
     */
    calculateRelevanceScore(solution, query, filters = {}) {
        let score = 0;

        // Technical area match (40%)
        if (filters.technical_area) {
            const techScore = this.calculateSimilarity(solution.technical_area, filters.technical_area);
            score += techScore * 0.4;
        }

        // Business area match (20%)
        if (filters.business_area) {
            const bizScore = this.calculateSimilarity(solution.business_area, filters.business_area);
            score += bizScore * 0.2;
        }

        // Tag similarity (20%)
        if (filters.tags) {
            const tagScore = this.calculateTagSimilarity(solution.tags, filters.tags);
            score += tagScore * 0.2;
        }

        // Success rate (20%)
        const successScore = solution.metadata.success_rate / 100;
        score += successScore * 0.2;

        // Content relevance bonus
        if (query) {
            const contentMatch = this.calculateSimilarity(solution.content, query) * 0.1;
            const titleMatch = this.calculateSimilarity(solution.title, query) * 0.15;
            score += Math.max(contentMatch, titleMatch);
        }

        return Math.min(score, 1); // Cap at 1.0
    }

    /**
     * Search solutions with ranking
     */
    async searchSolutions(query, filters = {}, limit = 10) {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = [];

        for (const solution of this.solutions.values()) {
            // Apply basic filters
            if (filters.type && solution.type !== filters.type) continue;
            if (filters.min_success_rate && solution.metadata.success_rate < filters.min_success_rate) continue;

            // Calculate relevance score
            const score = this.calculateRelevanceScore(solution, query, filters);

            if (score > 0) {
                results.push({
                    solution,
                    score,
                    relevance: score > 0.8 ? 'high' : score > 0.5 ? 'medium' : 'low'
                });
            }
        }

        // Sort by score (descending) and limit results
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    /**
     * Get solutions by category
     */
    async getSolutionsByCategory(category, type = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = [];

        for (const solution of this.solutions.values()) {
            const matchesCategory =
                solution.technical_area.toLowerCase().includes(category.toLowerCase()) ||
                solution.business_area.toLowerCase().includes(category.toLowerCase()) ||
                solution.tags.some(tag => tag.toLowerCase().includes(category.toLowerCase()));

            if (matchesCategory && (!type || solution.type === type)) {
                results.push(solution);
            }
        }

        return results.sort((a, b) => b.metadata.success_rate - a.metadata.success_rate);
    }

    /**
     * Get top solutions by success rate
     */
    async getTopSolutions(limit = 5, type = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        const solutions = Array.from(this.solutions.values())
            .filter(s => !type || s.type === type)
            .sort((a, b) => b.metadata.success_rate - a.metadata.success_rate)
            .slice(0, limit);

        return solutions;
    }

    /**
     * Integration with incident resolution
     * Find relevant solutions for an incident
     */
    async findSolutionsForIncident(incident) {
        const filters = {
            technical_area: incident.technical_area,
            business_area: incident.business_area,
            tags: incident.tags
        };

        const query = `${incident.title} ${incident.description}`.trim();

        const results = await this.searchSolutions(query, filters, 5);

        // Log the search for analytics
        console.log(`KB Search for incident ${incident.id}: Found ${results.length} relevant solutions`);

        return results;
    }

    /**
     * Update solution success rate based on incident resolution
     */
    async updateSuccessRate(solutionId, wasSuccessful) {
        const solution = await this.getSolutionById(solutionId);
        if (!solution) return;

        const currentRate = solution.metadata.success_rate || 0;
        const usageCount = solution.metadata.usage_count || 1;

        // Calculate new success rate using weighted average
        const newRate = wasSuccessful
            ? ((currentRate * (usageCount - 1)) + 100) / usageCount
            : ((currentRate * (usageCount - 1)) + 0) / usageCount;

        await this.updateSolution(solutionId, {
            metadata: {
                success_rate: Math.round(newRate * 100) / 100
            }
        });

        console.log(`Updated success rate for solution ${solutionId}: ${newRate.toFixed(2)}%`);
    }

    /**
     * Get analytics and statistics
     */
    async getAnalytics() {
        if (!this.initialized) {
            await this.initialize();
        }

        const solutions = Array.from(this.solutions.values());
        const totalSolutions = solutions.length;

        const byType = {
            solution: solutions.filter(s => s.type === 'solution').length,
            root_cause: solutions.filter(s => s.type === 'root_cause').length,
            best_practice: solutions.filter(s => s.type === 'best_practice').length
        };

        const avgSuccessRate = solutions.reduce((sum, s) => sum + s.metadata.success_rate, 0) / totalSolutions;
        const totalUsage = solutions.reduce((sum, s) => sum + s.metadata.usage_count, 0);

        const topTechnicalAreas = this.getTopCategories(solutions, 'technical_area');
        const topBusinessAreas = this.getTopCategories(solutions, 'business_area');

        return {
            total_solutions: totalSolutions,
            by_type: byType,
            average_success_rate: Math.round(avgSuccessRate * 100) / 100,
            total_usage: totalUsage,
            top_technical_areas: topTechnicalAreas,
            top_business_areas: topBusinessAreas
        };
    }

    /**
     * Helper method to get top categories
     */
    getTopCategories(solutions, field, limit = 5) {
        const counts = {};

        for (const solution of solutions) {
            const value = solution[field];
            counts[value] = (counts[value] || 0) + 1;
        }

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([category, count]) => ({ category, count }));
    }

    /**
     * Export knowledge base data
     */
    async exportData(format = 'json') {
        if (!this.initialized) {
            await this.initialize();
        }

        const solutions = Array.from(this.solutions.values());

        if (format === 'json') {
            return JSON.stringify(solutions, null, 2);
        }

        if (format === 'csv') {
            const headers = ['id', 'type', 'technical_area', 'business_area', 'title', 'success_rate', 'usage_count'];
            const rows = solutions.map(s => [
                s.id,
                s.type,
                s.technical_area,
                s.business_area,
                s.title,
                s.metadata.success_rate,
                s.metadata.usage_count
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        throw new Error(`Unsupported export format: ${format}`);
    }

    /**
     * Delete solution
     */
    async deleteSolution(id) {
        if (!this.initialized) {
            await this.initialize();
        }

        const solution = this.solutions.get(id);
        if (!solution) {
            throw new Error(`Solution not found: ${id}`);
        }

        this.solutions.delete(id);
        await this.saveIndex();

        console.log(`Deleted solution: ${solution.title} (${id})`);
        return true;
    }
}

module.exports = KnowledgeBaseService;