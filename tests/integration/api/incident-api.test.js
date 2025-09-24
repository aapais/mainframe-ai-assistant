/**
 * Integration Tests for Incident API
 * Testing API endpoints with real database interactions
 */

const request = require('supertest');
const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

describe('Incident API Integration Tests', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    // Start test server
    baseUrl = 'http://localhost:8080';

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await request(baseUrl)
      .delete('/api/test/cleanup')
      .expect(200);
  });

  describe('Health Check', () => {
    test('should return API health status', async () => {
      const response = await request(baseUrl)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        database: 'connected'
      });
    });
  });

  describe('POST /api/incidents', () => {
    test('should create new incident successfully', async () => {
      const incidentData = {
        title: 'Database Connection Failure',
        description: 'Unable to connect to mainframe DB2 database',
        severity: 'HIGH',
        category: 'DATABASE',
        reportedBy: 'user123',
        system: 'MAINFRAME_DB2'
      };

      const response = await request(baseUrl)
        .post('/api/incidents')
        .send(incidentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        incident: {
          id: expect.stringMatching(/^INC-\d+$/),
          title: incidentData.title,
          severity: 'HIGH',
          status: 'OPEN',
          createdAt: expect.any(String)
        }
      });

      // Verify incident was saved to database
      const getResponse = await request(baseUrl)
        .get(`/api/incidents/${response.body.incident.id}`)
        .expect(200);

      expect(getResponse.body.incident.title).toBe(incidentData.title);
    });

    test('should validate required fields', async () => {
      const invalidData = {
        description: 'Missing required fields'
      };

      const response = await request(baseUrl)
        .post('/api/incidents')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required')
      });
    });

    test('should validate severity levels', async () => {
      const invalidData = {
        title: 'Test Incident',
        category: 'SYSTEM',
        severity: 'INVALID_LEVEL'
      };

      const response = await request(baseUrl)
        .post('/api/incidents')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('Invalid severity');
    });
  });

  describe('GET /api/incidents', () => {
    beforeEach(async () => {
      // Create test incidents
      const testIncidents = [
        {
          title: 'Test Incident 1',
          category: 'DATABASE',
          severity: 'HIGH'
        },
        {
          title: 'Test Incident 2',
          category: 'NETWORK',
          severity: 'MEDIUM'
        },
        {
          title: 'Test Incident 3',
          category: 'APPLICATION',
          severity: 'LOW'
        }
      ];

      for (const incident of testIncidents) {
        await request(baseUrl)
          .post('/api/incidents')
          .send(incident);
      }
    });

    test('should list all incidents', async () => {
      const response = await request(baseUrl)
        .get('/api/incidents')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        incidents: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            category: expect.any(String)
          })
        ])
      });

      expect(response.body.incidents.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter incidents by severity', async () => {
      const response = await request(baseUrl)
        .get('/api/incidents?severity=HIGH')
        .expect(200);

      expect(response.body.incidents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ severity: 'HIGH' })
        ])
      );

      // Ensure no non-HIGH severity incidents
      response.body.incidents.forEach(incident => {
        expect(incident.severity).toBe('HIGH');
      });
    });

    test('should filter incidents by category', async () => {
      const response = await request(baseUrl)
        .get('/api/incidents?category=DATABASE')
        .expect(200);

      response.body.incidents.forEach(incident => {
        expect(incident.category).toBe('DATABASE');
      });
    });

    test('should support pagination', async () => {
      const response = await request(baseUrl)
        .get('/api/incidents?page=1&limit=2')
        .expect(200);

      expect(response.body.incidents.length).toBeLessThanOrEqual(2);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('PUT /api/incidents/:id', () => {
    let testIncidentId;

    beforeEach(async () => {
      const createResponse = await request(baseUrl)
        .post('/api/incidents')
        .send({
          title: 'Test Update Incident',
          category: 'SYSTEM',
          severity: 'MEDIUM'
        });

      testIncidentId = createResponse.body.incident.id;
    });

    test('should update incident status', async () => {
      const updates = {
        status: 'IN_PROGRESS',
        assignedTo: 'tech123',
        notes: 'Investigation started'
      };

      const response = await request(baseUrl)
        .put(`/api/incidents/${testIncidentId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        incident: {
          id: testIncidentId,
          status: 'IN_PROGRESS',
          assignedTo: 'tech123'
        }
      });

      // Verify update persisted
      const getResponse = await request(baseUrl)
        .get(`/api/incidents/${testIncidentId}`)
        .expect(200);

      expect(getResponse.body.incident.status).toBe('IN_PROGRESS');
    });

    test('should not allow updating immutable fields', async () => {
      const invalidUpdates = {
        id: 'INC-HACKED',
        createdAt: '2020-01-01'
      };

      await request(baseUrl)
        .put(`/api/incidents/${testIncidentId}`)
        .send(invalidUpdates)
        .expect(400);
    });
  });

  describe('AI-powered endpoints', () => {
    test('should suggest resolution for incident', async () => {
      const createResponse = await request(baseUrl)
        .post('/api/incidents')
        .send({
          title: 'Database timeout error',
          description: 'DB2 connection timing out',
          category: 'DATABASE',
          severity: 'HIGH'
        });

      const incidentId = createResponse.body.incident.id;

      const response = await request(baseUrl)
        .get(`/api/incidents/${incidentId}/suggestions`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        suggestions: {
          actions: expect.arrayContaining([expect.any(String)]),
          confidence: expect.any(Number),
          estimatedTime: expect.any(Number)
        }
      });

      expect(response.body.suggestions.confidence).toBeGreaterThan(0);
    });

    test('should auto-categorize incident text', async () => {
      const response = await request(baseUrl)
        .post('/api/incidents/categorize')
        .send({
          text: 'CICS transaction ABEND0C4 in production region'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        categorization: {
          category: expect.any(String),
          confidence: expect.any(Number)
        }
      });
    });
  });

  describe('Security and Compliance', () => {
    test('should log all API access for audit', async () => {
      await request(baseUrl)
        .get('/api/incidents')
        .expect(200);

      const auditResponse = await request(baseUrl)
        .get('/api/audit/recent')
        .expect(200);

      expect(auditResponse.body.logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'GET_INCIDENTS',
            timestamp: expect.any(String)
          })
        ])
      );
    });

    test('should enforce rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(20).fill().map(() =>
        request(baseUrl).get('/api/incidents')
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should be rate limited
      const rateLimited = responses.filter(
        result => result.value?.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should validate LGPD compliance for data incidents', async () => {
      const dataIncident = {
        title: 'Customer data exposure',
        category: 'DATA_PRIVACY',
        severity: 'CRITICAL',
        affectedRecords: 150,
        containsPersonalData: true
      };

      const response = await request(baseUrl)
        .post('/api/incidents')
        .send(dataIncident)
        .expect(201);

      expect(response.body.incident).toHaveProperty('lgpdCompliance');
      expect(response.body.incident.lgpdCompliance.notificationRequired).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high load gracefully', async () => {
      const startTime = Date.now();

      const concurrentRequests = Array(50).fill().map(() =>
        request(baseUrl)
          .get('/api/incidents')
          .expect(200)
      );

      await Promise.all(concurrentRequests);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 second SLA
    });

    test('should respond within SLA for incident creation', async () => {
      const startTime = Date.now();

      await request(baseUrl)
        .post('/api/incidents')
        .send({
          title: 'Performance Test Incident',
          category: 'SYSTEM',
          severity: 'LOW'
        })
        .expect(201);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 1 second SLA
    });
  });
});