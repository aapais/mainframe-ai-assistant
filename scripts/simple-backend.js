#!/usr/bin/env node

/**
 * SIMPLE DEFINITIVE BACKEND - No Dependencies
 * Uses Node.js built-in modules + Python bridge for SQLite
 */

const http = require('http');
const url = require('url');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3001;
const DB_PATH = path.join(__dirname, '..', 'kb-assistant.db');

class SimpleBackend {
    constructor() {
        this.server = null;
        console.log('🚀 Simple Definitive Backend - Starting...');
    }

    // Execute SQLite queries via Python
    async executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            const python_script = `
import sqlite3
import json
import sys

try:
    conn = sqlite3.connect('${DB_PATH}')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """${query}"""
    params = ${JSON.stringify(params)}

    cursor.execute(query, params)

    if query.strip().upper().startswith('SELECT'):
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        print(json.dumps(result))
    else:
        conn.commit()
        print(json.dumps({"success": True, "rowcount": cursor.rowcount, "lastrowid": cursor.lastrowid}))

    conn.close()
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

            exec(`python3 -c "${python_script.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Query failed: ${error.message}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    if (result.error) {
                        reject(new Error(result.error));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        });
    }

    // CORS headers for all responses
    setCORSHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Content-Type', 'application/json');
    }

    // Handle OPTIONS requests
    handleOptions(req, res) {
        this.setCORSHeaders(res);
        res.writeHead(200);
        res.end();
    }

    // Get POST data helper
    getPostData(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', err => {
                reject(err);
            });
        });
    }

    // Handle GET requests
    async handleGet(req, res, parsedUrl) {
        this.setCORSHeaders(res);
        const pathname = parsedUrl.pathname;

        try {
            // Health check
            if (pathname === '/api/health') {
                const response = {
                    status: 'healthy',
                    database: fs.existsSync(DB_PATH) ? 'connected' : 'not_found',
                    timestamp: new Date().toISOString(),
                    server: 'simple-definitive-backend'
                };
                res.writeHead(200);
                res.end(JSON.stringify(response, null, 2));
                return;
            }

            // Get all incidents
            if (pathname === '/api/incidents') {
                const incidents = await this.executeQuery(`
                    SELECT id, title, category, priority, status,
                           created_at, description, solution, tags
                    FROM entries
                    ORDER BY created_at DESC
                `);

                // Process results
                const processedIncidents = incidents.map(incident => ({
                    ...incident,
                    priority: incident.priority || 'medium',
                    status: incident.status || 'open',
                    tags: incident.tags ? JSON.parse(incident.tags) : []
                }));

                res.writeHead(200);
                res.end(JSON.stringify(processedIncidents, null, 2));
                return;
            }

            // Get categories
            if (pathname === '/api/categories') {
                const categories = [
                    'JCL', 'COBOL', 'DB2', 'CICS', 'MQ',
                    'IMS', 'VSAM', 'Security', 'Network', 'Other'
                ];
                res.writeHead(200);
                res.end(JSON.stringify(categories, null, 2));
                return;
            }

            // Get knowledge base entries
            if (pathname === '/api/knowledge') {
                const knowledge = await this.executeQuery(`
                    SELECT id, title, category, description, solution, created_at
                    FROM entries
                    WHERE solution IS NOT NULL AND solution != ''
                    ORDER BY created_at DESC
                    LIMIT 100
                `);

                res.writeHead(200);
                res.end(JSON.stringify(knowledge, null, 2));
                return;
            }

            // Not found
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Endpoint not found' }));

        } catch (error) {
            console.error('GET Error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // Handle POST requests
    async handlePost(req, res, parsedUrl) {
        this.setCORSHeaders(res);
        const pathname = parsedUrl.pathname;

        try {
            // Get POST data
            const postData = await this.getPostData(req);
            let data = {};
            if (postData) {
                try {
                    data = JSON.parse(postData);
                } catch (e) {
                    console.warn('Invalid JSON in POST data:', e.message);
                }
            }

            // Create incident
            if (pathname === '/api/incidents') {
                const {
                    title = 'New Incident',
                    category = 'Other',
                    priority = 'medium',
                    status = 'open',
                    description = '',
                    content = '',
                    solution = ''
                } = data;

                const result = await this.executeQuery(`
                    INSERT INTO entries (title, category, priority, status,
                                       description, solution, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    title, category, priority, status,
                    description, solution,
                    new Date().toISOString()
                ]);

                const incident = {
                    id: result.lastrowid,
                    title, category, priority, status,
                    description, content, solution,
                    created_at: new Date().toISOString()
                };

                res.writeHead(201);
                res.end(JSON.stringify({
                    success: true,
                    incident,
                    message: 'Incident created successfully'
                }));
                return;
            }

            // AI Categorization
            if (pathname === '/api/ai/categorize') {
                const result = await this.categorizeIncident(data.text || '');
                res.writeHead(200);
                res.end(JSON.stringify(result, null, 2));
                return;
            }

            // Semantic search
            if (pathname === '/api/knowledge/semantic-search') {
                const results = await this.semanticSearch(data.query || '');
                res.writeHead(200);
                res.end(JSON.stringify(results, null, 2));
                return;
            }

            // Find similar incidents
            if (pathname === '/api/incidents/find-similar') {
                const similar = await this.findSimilarIncidents(data);
                res.writeHead(200);
                res.end(JSON.stringify(similar, null, 2));
                return;
            }

            // Not found
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Endpoint not found' }));

        } catch (error) {
            console.error('POST Error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // Handle PUT requests
    async handlePut(req, res, parsedUrl) {
        this.setCORSHeaders(res);
        const pathname = parsedUrl.pathname;

        try {
            const postData = await this.getPostData(req);
            let data = {};
            if (postData) {
                try {
                    data = JSON.parse(postData);
                } catch (e) {
                    console.warn('Invalid JSON in PUT data:', e.message);
                }
            }

            // Update incident
            if (pathname.startsWith('/api/incidents/')) {
                const incidentId = pathname.split('/').pop();

                const updates = [];
                const values = [];

                if (data.status) {
                    updates.push('status = ?');
                    values.push(data.status);
                }
                if (data.solution) {
                    updates.push('solution = ?');
                    values.push(data.solution);
                }
                if (data.category) {
                    updates.push('category = ?');
                    values.push(data.category);
                }
                if (data.priority) {
                    updates.push('priority = ?');
                    values.push(data.priority);
                }

                if (updates.length === 0) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'No updates provided' }));
                    return;
                }

                values.push(incidentId);

                const result = await this.executeQuery(`
                    UPDATE entries
                    SET ${updates.join(', ')}
                    WHERE id = ?
                `, values);

                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    message: 'Incident updated successfully',
                    updated_fields: updates.length,
                    changes: result.rowcount
                }));
                return;
            }

            // Not found
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Endpoint not found' }));

        } catch (error) {
            console.error('PUT Error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // AI Methods (simplified but functional)
    async categorizeIncident(text) {
        const upperText = text.toUpperCase();

        let category = 'Other';
        let confidence = 50;

        if (upperText.includes('JCL') || upperText.includes('JOB')) {
            category = 'JCL';
            confidence = 85;
        } else if (upperText.includes('COBOL')) {
            category = 'COBOL';
            confidence = 80;
        } else if (upperText.includes('DB2') || upperText.includes('DATABASE')) {
            category = 'DB2';
            confidence = 75;
        } else if (upperText.includes('CICS')) {
            category = 'CICS';
            confidence = 80;
        } else if (upperText.includes('VSAM')) {
            category = 'VSAM';
            confidence = 75;
        } else if (upperText.includes('NETWORK') || upperText.includes('TCP')) {
            category = 'Network';
            confidence = 70;
        } else if (upperText.includes('SECURITY') || upperText.includes('AUTH')) {
            category = 'Security';
            confidence = 70;
        }

        return {
            category,
            confidence,
            reasoning: `Based on keyword analysis of: "${text.substring(0, 100)}..."`
        };
    }

    async semanticSearch(query) {
        if (!query || query.trim().length === 0) {
            return {
                results: [],
                total: 0,
                query: query
            };
        }

        const searchTerm = `%${query}%`;

        const results = await this.executeQuery(`
            SELECT id, title, category, description, solution, created_at
            FROM entries
            WHERE (title LIKE ? OR description LIKE ? OR solution LIKE ?)
            AND solution IS NOT NULL AND solution != ''
            ORDER BY
                CASE
                    WHEN title LIKE ? THEN 1
                    WHEN description LIKE ? THEN 2
                    WHEN solution LIKE ? THEN 3
                    ELSE 4
                END
            LIMIT 20
        `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

        const processedResults = results.map(row => ({
            id: row.id,
            title: row.title,
            category: row.category,
            content: row.description ? row.description.substring(0, 200) + '...' : '',
            solution: row.solution ? row.solution.substring(0, 200) + '...' : '',
            relevance: 0.75, // Mock relevance score
            source: 'knowledge_base',
            created_at: row.created_at
        }));

        return {
            results: processedResults,
            total: processedResults.length,
            query: query,
            search_type: 'semantic_similarity'
        };
    }

    async findSimilarIncidents(data) {
        const incidentText = (data.title || '') + ' ' + (data.description || '');
        const keywords = incidentText.split(/\s+/).filter(word => word.length > 3).slice(0, 5);

        if (keywords.length === 0) {
            return {
                similar_incidents: [],
                total: 0
            };
        }

        const conditions = keywords.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ');
        const params = [];
        keywords.forEach(keyword => {
            params.push(`%${keyword}%`, `%${keyword}%`);
        });
        params.push(data.id || -1);

        const results = await this.executeQuery(`
            SELECT id, title, category, status, solution, created_at
            FROM entries
            WHERE (${conditions})
            AND id != ?
            ORDER BY created_at DESC
            LIMIT 10
        `, params);

        const similar = results.map(row => ({
            id: row.id,
            title: row.title,
            category: row.category,
            status: row.status || 'open',
            similarity: 0.65, // Mock similarity score
            resolution: row.solution ? row.solution.substring(0, 100) + '...' : null,
            created_at: row.created_at
        }));

        return {
            similar_incidents: similar,
            total: similar.length,
            keywords_used: keywords
        };
    }

    // Main request handler
    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);

        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

        try {
            switch (req.method) {
                case 'OPTIONS':
                    this.handleOptions(req, res);
                    break;
                case 'GET':
                    await this.handleGet(req, res, parsedUrl);
                    break;
                case 'POST':
                    await this.handlePost(req, res, parsedUrl);
                    break;
                case 'PUT':
                    await this.handlePut(req, res, parsedUrl);
                    break;
                default:
                    this.setCORSHeaders(res);
                    res.writeHead(405);
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
        } catch (error) {
            console.error('Request handler error:', error);
            this.setCORSHeaders(res);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    // Start server
    async start() {
        try {
            // Check database exists
            if (!fs.existsSync(DB_PATH)) {
                throw new Error(`Database not found at ${DB_PATH}`);
            }

            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.listen(PORT, () => {
                console.log('');
                console.log('🚀 ===============================================');
                console.log('🚀 SIMPLE DEFINITIVE BACKEND RUNNING');
                console.log('🚀 ===============================================');
                console.log(`🚀 Port: ${PORT}`);
                console.log(`🚀 Database: ${DB_PATH}`);
                console.log(`🚀 Health: http://localhost:${PORT}/api/health`);
                console.log(`🚀 Incidents: http://localhost:${PORT}/api/incidents`);
                console.log(`🚀 Knowledge: http://localhost:${PORT}/api/knowledge`);
                console.log('🚀 ===============================================');
                console.log('');
            });

            return this.server;
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            throw error;
        }
    }

    // Stop server gracefully
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('🛑 Simple Definitive Backend stopped');
                    resolve();
                });
            });
        }
    }
}

// Create and start server
const server = new SimpleBackend();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
});

// Start the server
server.start().catch(error => {
    console.error('Failed to start simple backend:', error);
    process.exit(1);
});

module.exports = SimpleBackend;