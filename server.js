const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SQLite database
const db = new Database('./kb-assistant.db');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.', {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));

// CORS for localhost development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Prepared statements for better performance (WITHOUT entry_type)
const queries = {
  getAllIncidents: db.prepare("SELECT * FROM entries ORDER BY created_at DESC"),
  getIncidentById: db.prepare("SELECT * FROM entries WHERE id = ?"),
  createIncident: db.prepare(`
    INSERT INTO entries (title, description, category, severity, status, priority, reporter, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `),
  updateIncident: db.prepare(`
    UPDATE entries
    SET title = ?, description = ?, category = ?, severity = ?, status = ?, priority = ?,
        assigned_to = ?, solution = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  deleteIncident: db.prepare("DELETE FROM entries WHERE id = ?"),
  searchIncidents: db.prepare(`
    SELECT * FROM entries
    WHERE (title LIKE ? OR description LIKE ? OR category LIKE ? OR assigned_to LIKE ?)
    ORDER BY created_at DESC
    LIMIT 100
  `)
};

// API Routes

// GET /api/incidents/search?q=term - Search incidents (must be before /:id route)
app.get('/api/incidents/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query parameter "q" is required' });
    }

    const searchTerm = `%${q}%`;
    const incidents = queries.searchIncidents.all(searchTerm, searchTerm, searchTerm, searchTerm);

    res.json({
      success: true,
      data: incidents,
      count: incidents.length,
      query: q
    });
  } catch (error) {
    console.error('Error searching incidents:', error);
    res.status(500).json({ success: false, error: 'Failed to search incidents' });
  }
});

// GET /api/incidents - Get all incidents
app.get('/api/incidents', (req, res) => {
  try {
    const incidents = queries.getAllIncidents.all();
    res.json(incidents); // Return just the array for simpler API
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/incidents/:id - Get single incident
app.get('/api/incidents/:id', (req, res) => {
  try {
    const incident = queries.getIncidentById.get(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch incident' });
  }
});

// POST /api/incidents - Create incident
app.post('/api/incidents', (req, res) => {
  try {
    const { title, description, category, severity, priority = 3, reporter } = req.body;

    // Validation
    if (!title || !description || !category || !severity || !reporter) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, category, severity, reporter'
      });
    }

    const validSeverities = ['critical', 'high', 'medium', 'low'];
    const validPriorities = ['P1', 'P2', 'P3', 'P4'];

    if (!validSeverities.includes(severity)) {
      return res.status(400).json({ success: false, error: 'Invalid severity' });
    }

    const priorityValue = validPriorities.includes(priority) ? priority : 'P3';

    const result = queries.createIncident.run(title, description, category, severity, 'aberto', priorityValue, reporter);

    const newIncident = queries.getIncidentById.get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newIncident });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ success: false, error: 'Failed to create incident' });
  }
});

// PUT /api/incidents/:id - Update incident
app.put('/api/incidents/:id', (req, res) => {
  try {
    const { title, description, category, severity, status, priority, assigned_to, solution } = req.body;

    // Check if incident exists
    const existingIncident = queries.getIncidentById.get(req.params.id);
    if (!existingIncident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }

    // Validation
    if (severity) {
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({ success: false, error: 'Invalid severity' });
      }
    }

    if (status) {
      const validStatuses = ['aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
    }

    if (priority) {
      const validPriorities = ['P1', 'P2', 'P3', 'P4'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ success: false, error: 'Invalid priority' });
      }
    }

    queries.updateIncident.run(
      title || existingIncident.title,
      description || existingIncident.description,
      category || existingIncident.category,
      severity || existingIncident.severity,
      status || existingIncident.status,
      priority || existingIncident.priority,
      assigned_to !== undefined ? assigned_to : existingIncident.assigned_to,
      solution !== undefined ? solution : existingIncident.solution,
      req.params.id
    );

    const updatedIncident = queries.getIncidentById.get(req.params.id);
    res.json({ success: true, data: updatedIncident });
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ success: false, error: 'Failed to update incident' });
  }
});

// DELETE /api/incidents/:id - Delete incident
app.delete('/api/incidents/:id', (req, res) => {
  try {
    const existingIncident = queries.getIncidentById.get(req.params.id);
    if (!existingIncident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }

    queries.deleteIncident.run(req.params.id);
    res.json({ success: true, message: 'Incident deleted successfully' });
  } catch (error) {
    console.error('Error deleting incident:', error);
    res.status(500).json({ success: false, error: 'Failed to delete incident' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Gracefully shutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Gracefully shutting down...');
  db.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
  console.log(`🏠 Static files served from current directory`);
  console.log(`💾 Database: kb-assistant.db`);
});