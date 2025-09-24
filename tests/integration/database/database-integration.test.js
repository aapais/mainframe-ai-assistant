/**
 * Database Integration Tests
 * Testing database operations, transactions, and data integrity
 */

const sqlite3 = require('sqlite3').verbose();
const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

describe('Database Integration Tests', () => {
  let db;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeAll(async () => {
    // Initialize test database
    db = new sqlite3.Database(testDbPath);

    // Create tables
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT DEFAULT 'OPEN',
            reported_by TEXT,
            assigned_to TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            estimated_resolution_time INTEGER,
            actual_resolution_time INTEGER,
            tags TEXT,
            metadata TEXT
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS incident_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_values TEXT,
            new_values TEXT,
            changed_by TEXT,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS compliance_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            regulation_type TEXT NOT NULL,
            compliance_status TEXT DEFAULT 'PENDING',
            notification_required BOOLEAN DEFAULT FALSE,
            notification_sent BOOLEAN DEFAULT FALSE,
            deadline DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS ai_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            prediction_type TEXT NOT NULL,
            predicted_values TEXT,
            confidence_score REAL,
            actual_values TEXT,
            accuracy_score REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });

  afterAll(async () => {
    if (db) {
      await new Promise(resolve => db.close(resolve));
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await new Promise(resolve => {
      db.serialize(() => {
        db.run('DELETE FROM ai_predictions');
        db.run('DELETE FROM compliance_tracking');
        db.run('DELETE FROM incident_history');
        db.run('DELETE FROM incidents', resolve);
      });
    });
  });

  describe('Incident CRUD Operations', () => {
    test('should create incident with all required fields', async () => {
      const incident = {
        id: 'INC-001',
        title: 'Database Connection Error',
        description: 'Cannot connect to DB2 mainframe',
        category: 'DATABASE',
        severity: 'HIGH',
        reported_by: 'user123'
      };

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO incidents (id, title, description, category, severity, reported_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [incident.id, incident.title, incident.description, incident.category, incident.severity, incident.reported_by],
        function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verify insertion
      const result = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM incidents WHERE id = ?', [incident.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(result).toMatchObject({
        id: incident.id,
        title: incident.title,
        category: incident.category,
        status: 'OPEN'
      });
    });

    test('should update incident and maintain history', async () => {
      // Create incident first
      const incidentId = 'INC-002';
      await new Promise(resolve => {
        db.run(`
          INSERT INTO incidents (id, title, category, severity)
          VALUES (?, ?, ?, ?)
        `, [incidentId, 'Test Incident', 'SYSTEM', 'MEDIUM'], resolve);
      });

      // Update incident
      const updates = {
        status: 'IN_PROGRESS',
        assigned_to: 'tech123'
      };

      await new Promise(resolve => {
        db.serialize(() => {
          // Update incident
          db.run(`
            UPDATE incidents
            SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [updates.status, updates.assigned_to, incidentId]);

          // Record history
          db.run(`
            INSERT INTO incident_history (incident_id, action, new_values, changed_by)
            VALUES (?, ?, ?, ?)
          `, [incidentId, 'UPDATE', JSON.stringify(updates), 'system'], resolve);
        });
      });

      // Verify update
      const incident = await new Promise(resolve => {
        db.get('SELECT * FROM incidents WHERE id = ?', [incidentId], (err, row) => {
          resolve(row);
        });
      });

      expect(incident.status).toBe('IN_PROGRESS');
      expect(incident.assigned_to).toBe('tech123');

      // Verify history
      const history = await new Promise(resolve => {
        db.get('SELECT * FROM incident_history WHERE incident_id = ?', [incidentId], (err, row) => {
          resolve(row);
        });
      });

      expect(history.action).toBe('UPDATE');
      expect(JSON.parse(history.new_values)).toMatchObject(updates);
    });
  });

  describe('Compliance Tracking', () => {
    test('should create LGPD compliance record for data incidents', async () => {
      const incidentId = 'INC-LGPD-001';

      // Create data privacy incident
      await new Promise(resolve => {
        db.run(`
          INSERT INTO incidents (id, title, category, severity)
          VALUES (?, ?, ?, ?)
        `, [incidentId, 'Customer data exposure', 'DATA_PRIVACY', 'CRITICAL'], resolve);
      });

      // Create compliance tracking
      const compliance = {
        incident_id: incidentId,
        regulation_type: 'LGPD',
        notification_required: true,
        deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 hours
      };

      await new Promise(resolve => {
        db.run(`
          INSERT INTO compliance_tracking (incident_id, regulation_type, notification_required, deadline)
          VALUES (?, ?, ?, ?)
        `, [compliance.incident_id, compliance.regulation_type, compliance.notification_required, compliance.deadline], resolve);
      });

      // Verify compliance record
      const result = await new Promise(resolve => {
        db.get(`
          SELECT * FROM compliance_tracking
          WHERE incident_id = ? AND regulation_type = ?
        `, [incidentId, 'LGPD'], (err, row) => {
          resolve(row);
        });
      });

      expect(result.regulation_type).toBe('LGPD');
      expect(result.notification_required).toBe(1); // SQLite stores boolean as integer
      expect(new Date(result.deadline)).toBeInstanceOf(Date);
    });

    test('should track SOX compliance for financial incidents', async () => {
      const incidentId = 'INC-SOX-001';

      await new Promise(resolve => {
        db.serialize(() => {
          db.run(`
            INSERT INTO incidents (id, title, category, severity)
            VALUES (?, ?, ?, ?)
          `, [incidentId, 'Financial reporting error', 'FINANCIAL_SYSTEM', 'HIGH']);

          db.run(`
            INSERT INTO compliance_tracking (incident_id, regulation_type, compliance_status)
            VALUES (?, ?, ?)
          `, [incidentId, 'SOX', 'UNDER_REVIEW'], resolve);
        });
      });

      const compliance = await new Promise(resolve => {
        db.get(`
          SELECT c.*, i.title
          FROM compliance_tracking c
          JOIN incidents i ON c.incident_id = i.id
          WHERE c.incident_id = ?
        `, [incidentId], (err, row) => {
          resolve(row);
        });
      });

      expect(compliance.regulation_type).toBe('SOX');
      expect(compliance.compliance_status).toBe('UNDER_REVIEW');
      expect(compliance.title).toContain('Financial');
    });
  });

  describe('AI Predictions Storage', () => {
    test('should store and retrieve AI predictions', async () => {
      const incidentId = 'INC-AI-001';

      // Create incident
      await new Promise(resolve => {
        db.run(`
          INSERT INTO incidents (id, title, category, severity)
          VALUES (?, ?, ?, ?)
        `, [incidentId, 'System performance issue', 'PERFORMANCE', 'MEDIUM'], resolve);
      });

      // Store AI prediction
      const prediction = {
        incident_id: incidentId,
        prediction_type: 'RESOLUTION_TIME',
        predicted_values: JSON.stringify({
          estimatedMinutes: 45,
          suggestedActions: ['Restart service', 'Check logs'],
          confidence: 0.87
        }),
        confidence_score: 0.87
      };

      await new Promise(resolve => {
        db.run(`
          INSERT INTO ai_predictions (incident_id, prediction_type, predicted_values, confidence_score)
          VALUES (?, ?, ?, ?)
        `, [prediction.incident_id, prediction.prediction_type, prediction.predicted_values, prediction.confidence_score], resolve);
      });

      // Retrieve prediction
      const result = await new Promise(resolve => {
        db.get(`
          SELECT * FROM ai_predictions
          WHERE incident_id = ? AND prediction_type = ?
        `, [incidentId, 'RESOLUTION_TIME'], (err, row) => {
          resolve(row);
        });
      });

      expect(result.confidence_score).toBe(0.87);
      const predictedValues = JSON.parse(result.predicted_values);
      expect(predictedValues.estimatedMinutes).toBe(45);
      expect(predictedValues.suggestedActions).toContain('Restart service');
    });

    test('should update prediction accuracy after resolution', async () => {
      const incidentId = 'INC-AI-002';
      const predictionId = 1;

      // Setup incident and prediction
      await new Promise(resolve => {
        db.serialize(() => {
          db.run(`
            INSERT INTO incidents (id, title, category, severity)
            VALUES (?, ?, ?, ?)
          `, [incidentId, 'Network latency', 'NETWORK', 'LOW']);

          db.run(`
            INSERT INTO ai_predictions (incident_id, prediction_type, predicted_values, confidence_score)
            VALUES (?, ?, ?, ?)
          `, [incidentId, 'RESOLUTION_TIME', JSON.stringify({estimatedMinutes: 30}), 0.8], resolve);
        });
      });

      // Update with actual results
      const actualValues = JSON.stringify({actualMinutes: 35});
      const accuracyScore = 0.85; // Close prediction

      await new Promise(resolve => {
        db.run(`
          UPDATE ai_predictions
          SET actual_values = ?, accuracy_score = ?
          WHERE incident_id = ? AND prediction_type = ?
        `, [actualValues, accuracyScore, incidentId, 'RESOLUTION_TIME'], resolve);
      });

      // Verify accuracy tracking
      const result = await new Promise(resolve => {
        db.get(`
          SELECT * FROM ai_predictions
          WHERE incident_id = ?
        `, [incidentId], (err, row) => {
          resolve(row);
        });
      });

      expect(result.accuracy_score).toBe(0.85);
      expect(JSON.parse(result.actual_values).actualMinutes).toBe(35);
    });
  });

  describe('Performance and Scaling', () => {
    test('should handle bulk incident insertion efficiently', async () => {
      const incidents = Array.from({length: 100}, (_, i) => ({
        id: `INC-BULK-${i.toString().padStart(3, '0')}`,
        title: `Bulk Test Incident ${i}`,
        category: 'SYSTEM',
        severity: i % 3 === 0 ? 'HIGH' : i % 3 === 1 ? 'MEDIUM' : 'LOW'
      }));

      const startTime = Date.now();

      // Use transaction for bulk insert
      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          const stmt = db.prepare(`
            INSERT INTO incidents (id, title, category, severity)
            VALUES (?, ?, ?, ?)
          `);

          incidents.forEach(incident => {
            stmt.run([incident.id, incident.title, incident.category, incident.severity]);
          });

          stmt.finalize();
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      const duration = Date.now() - startTime;

      // Verify all incidents were inserted
      const count = await new Promise(resolve => {
        db.get('SELECT COUNT(*) as count FROM incidents', (err, row) => {
          resolve(row.count);
        });
      });

      expect(count).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should maintain referential integrity', async () => {
      const incidentId = 'INC-REF-001';

      // Create incident with related records
      await new Promise(resolve => {
        db.serialize(() => {
          db.run(`
            INSERT INTO incidents (id, title, category, severity)
            VALUES (?, ?, ?, ?)
          `, [incidentId, 'Referential Test', 'SYSTEM', 'LOW']);

          db.run(`
            INSERT INTO incident_history (incident_id, action, changed_by)
            VALUES (?, ?, ?)
          `, [incidentId, 'CREATE', 'system']);

          db.run(`
            INSERT INTO compliance_tracking (incident_id, regulation_type)
            VALUES (?, ?)
          `, [incidentId, 'INTERNAL'], resolve);
        });
      });

      // Verify all related records exist
      const results = await new Promise(resolve => {
        db.all(`
          SELECT
            i.id as incident_id,
            h.action as history_action,
            c.regulation_type
          FROM incidents i
          LEFT JOIN incident_history h ON i.id = h.incident_id
          LEFT JOIN compliance_tracking c ON i.id = c.incident_id
          WHERE i.id = ?
        `, [incidentId], (err, rows) => {
          resolve(rows);
        });
      });

      expect(results).toHaveLength(1);
      expect(results[0].incident_id).toBe(incidentId);
      expect(results[0].history_action).toBe('CREATE');
      expect(results[0].regulation_type).toBe('INTERNAL');
    });
  });

  describe('Database Constraints and Validation', () => {
    test('should enforce unique incident IDs', async () => {
      const duplicateId = 'INC-DUPLICATE';

      // Insert first incident
      await new Promise(resolve => {
        db.run(`
          INSERT INTO incidents (id, title, category, severity)
          VALUES (?, ?, ?, ?)
        `, [duplicateId, 'First incident', 'SYSTEM', 'LOW'], resolve);
      });

      // Try to insert duplicate ID
      const duplicateInsert = new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO incidents (id, title, category, severity)
          VALUES (?, ?, ?, ?)
        `, [duplicateId, 'Duplicate incident', 'SYSTEM', 'LOW'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await expect(duplicateInsert).rejects.toThrow();
    });

    test('should require non-null fields', async () => {
      const invalidInsert = new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO incidents (id, description, severity)
          VALUES (?, ?, ?)
        `, ['INC-INVALID', 'Missing title and category', 'LOW'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await expect(invalidInsert).rejects.toThrow();
    });
  });
});