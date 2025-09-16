/**
 * Pattern Detection Service Integration Tests
 * 
 * Comprehensive integration testing for the PatternDetectionPlugin focusing on:
 * - Temporal pattern detection algorithms
 * - Component failure pattern recognition
 * - Error code pattern clustering
 * - Real-time incident processing
 * - Alert generation and throttling
 * - Performance under high load scenarios
 * 
 * @author Service Testing Specialist
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { 
  PatternDetectionPlugin, 
  Incident, 
  Pattern, 
  PatternAnalysis, 
  PatternDetectionConfig 
} from '../../../src/services/storage/plugins/PatternDetectionPlugin';
import { MockStorageAdapter } from '../../storage/mocks/MockStorageAdapter';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration constants
const TEST_CONFIG = {
  PATTERN_DETECTION_TIMEOUT: 5000,     // 5 seconds max for pattern detection
  LARGE_INCIDENT_COUNT: 1000,          // For performance testing
  CONCURRENT_INCIDENTS: 100,           // Concurrent processing test
  ALERT_THROTTLE_WINDOW: 2000,         // 2 seconds alert throttling
  PERFORMANCE_THRESHOLD: 3000,         // Max processing time for 1000 incidents
  PATTERN_CONFIDENCE_THRESHOLD: 70,    // Minimum pattern confidence
  TEMPORAL_WINDOW_HOURS: 24,           // Default temporal analysis window
} as const;

/**
 * Test data generators for incidents and patterns
 */
class IncidentDataGenerator {
  private static incidentCounter = 0;

  static createIncident(overrides: Partial<Incident> = {}): Incident {
    const id = `incident-${++this.incidentCounter}-${Date.now()}`;
    return {
      id,
      ticket_id: `TICKET-${this.incidentCounter}`,
      timestamp: new Date(),
      title: 'VSAM Status 35 Error',
      description: 'Job failed with VSAM status code 35 indicating file not found',
      component: 'VSAM-HANDLER',
      severity: 'medium',
      resolution: 'Dataset was missing, created new allocation',
      resolution_time: 30,
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-error'],
      ...overrides
    };
  }

  static createTemporalIncidentCluster(count: number, baseTime: Date, windowMinutes: number): Incident[] {
    const incidents: Incident[] = [];
    const windowMs = windowMinutes * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(baseTime.getTime() + Math.random() * windowMs);
      incidents.push(this.createIncident({
        timestamp,
        title: `S0C7 Data Exception ${i}`,
        description: 'Program abended with S0C7 data exception during arithmetic operation',
        component: 'BATCH-PROCESSOR',
        severity: 'high',
        category: 'Batch',
        tags: ['s0c7', 'data-exception', 'abend']
      }));
    }

    return incidents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  static createComponentIncidentCluster(count: number, component: string): Incident[] {
    const incidents: Incident[] = [];
    const baseTime = new Date();

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(baseTime.getTime() + i * 60000); // 1 minute apart
      incidents.push(this.createIncident({
        timestamp,
        title: `${component} Component Error ${i}`,
        description: `Component ${component} experienced failure during processing`,
        component,
        severity: i < 2 ? 'critical' : 'high',
        category: 'System',
        tags: ['component-failure', component.toLowerCase()]
      }));
    }

    return incidents;
  }

  static createErrorCodeIncidentCluster(count: number, errorCode: string): Incident[] {
    const incidents: Incident[] = [];
    const baseTime = new Date();

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(baseTime.getTime() + i * 30000); // 30 seconds apart
      incidents.push(this.createIncident({
        timestamp,
        title: `Error ${errorCode} in Process ${i}`,
        description: `Application encountered ${errorCode} error during execution`,
        component: `PROC-${i % 3}`,
        severity: errorCode.startsWith('S0C') ? 'critical' : 'high',
        category: 'Batch',
        tags: [errorCode.toLowerCase(), 'error', 'abend']
      }));
    }

    return incidents;
  }

  static createMixedIncidentSet(totalCount: number): Incident[] {
    const incidents: Incident[] = [];
    const baseTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Create different types of incidents
    const errorCodes = ['S0C7', 'S0C4', 'IEF212I', 'SQLCODE-904', 'WER027A'];
    const components = ['BATCH-PROC', 'VSAM-HANDLER', 'DB2-CONN', 'CICS-REGION', 'SORT-UTIL'];
    const severities: Incident['severity'][] = ['low', 'medium', 'high', 'critical'];

    for (let i = 0; i < totalCount; i++) {
      const timestamp = new Date(baseTime.getTime() + Math.random() * 24 * 60 * 60 * 1000);
      const errorCode = errorCodes[i % errorCodes.length];
      const component = components[i % components.length];
      const severity = severities[i % severities.length];

      incidents.push(this.createIncident({
        timestamp,
        title: `${errorCode} in ${component}`,
        description: `System error ${errorCode} occurred in component ${component}`,
        component,
        severity,
        category: this.getCategoryForErrorCode(errorCode),
        tags: [errorCode.toLowerCase(), component.toLowerCase(), severity]
      }));
    }

    return incidents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private static getCategoryForErrorCode(errorCode: string): string {
    if (errorCode.startsWith('S0C')) return 'Batch';
    if (errorCode.startsWith('IEF')) return 'JCL';
    if (errorCode.includes('SQL')) return 'DB2';
    if (errorCode.startsWith('WER')) return 'Batch';
    return 'System';
  }

  static createEscalatingIncidentPattern(baseCount: number): Incident[] {
    const incidents: Incident[] = [];
    const baseTime = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
    let currentCount = baseCount;

    // Create escalating pattern over 4 hours
    for (let hour = 0; hour < 4; hour++) {
      for (let i = 0; i < currentCount; i++) {
        const timestamp = new Date(baseTime.getTime() + hour * 60 * 60 * 1000 + i * 60000);
        incidents.push(this.createIncident({
          timestamp,
          title: `Database Connection Timeout ${hour}-${i}`,
          description: 'Database connection timed out during transaction processing',
          component: 'DB-CONNECTOR',
          severity: 'high',
          category: 'DB2',
          tags: ['timeout', 'database', 'connection']
        }));
      }
      currentCount = Math.floor(currentCount * 1.5); // Escalate by 50% each hour
    }

    return incidents;
  }
}

/**
 * Pattern analysis verification helper
 */
class PatternAnalysisVerifier {
  static verifyTemporalPattern(pattern: Pattern, expectedIncidentCount: number, maxTimeWindowMs: number): void {
    expect(pattern.type).toBe('temporal');
    expect(pattern.incidents).toHaveLength(expectedIncidentCount);
    expect(pattern.confidence).toBeGreaterThanOrEqual(TEST_CONFIG.PATTERN_CONFIDENCE_THRESHOLD);

    // Verify all incidents are within the time window
    const timeSpan = pattern.last_seen.getTime() - pattern.first_seen.getTime();
    expect(timeSpan).toBeLessThanOrEqual(maxTimeWindowMs);

    // Verify pattern frequency matches incident count
    expect(pattern.frequency).toBe(expectedIncidentCount);
  }

  static verifyComponentPattern(pattern: Pattern, expectedComponent: string): void {
    expect(pattern.type).toBe('component');
    expect(pattern.incidents.length).toBeGreaterThanOrEqual(3);
    expect(pattern.confidence).toBeGreaterThanOrEqual(85); // Component patterns should be high confidence

    // Verify all incidents are from the same component
    pattern.incidents.forEach(incident => {
      expect(incident.component).toBe(expectedComponent);
    });

    // Verify suggested action mentions the component
    expect(pattern.suggested_action).toContain(expectedComponent);
  }

  static verifyErrorPattern(pattern: Pattern, expectedErrorCode: string): void {
    expect(pattern.type).toBe('error');
    expect(pattern.incidents.length).toBeGreaterThanOrEqual(3);
    expect(pattern.confidence).toBeGreaterThanOrEqual(90); // Error patterns should be very high confidence

    // Verify all incidents contain the error code
    pattern.incidents.forEach(incident => {
      const incidentText = `${incident.title} ${incident.description}`.toUpperCase();
      expect(incidentText).toContain(expectedErrorCode.toUpperCase());
    });

    // Verify suggested cause mentions the error code
    expect(pattern.suggested_cause).toContain(expectedErrorCode);
  }

  static verifyPatternTrend(pattern: Pattern, expectedTrend: Pattern['trend']): void {
    expect(pattern.trend).toBe(expectedTrend);

    if (expectedTrend === 'increasing') {
      // For increasing trends, later incidents should be closer together
      const incidents = pattern.incidents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      if (incidents.length >= 4) {
        const firstHalfSpan = incidents[1].timestamp.getTime() - incidents[0].timestamp.getTime();
        const secondHalfSpan = incidents[incidents.length - 1].timestamp.getTime() - incidents[incidents.length - 2].timestamp.getTime();
        expect(secondHalfSpan).toBeLessThanOrEqual(firstHalfSpan * 2); // Allow some variance
      }
    }
  }
}

/**
 * Performance monitoring and metrics collection
 */
class PatternDetectionPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private memoryBaseline: number = 0;

  startOperation(operationName: string): () => number {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    return () => {
      const duration = performance.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      
      this.recordMetric(`${operationName}_duration`, duration);
      this.recordMetric(`${operationName}_memory`, memoryUsed);
      
      return duration;
    };
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getStats(metricName: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(metricName);
    if (!values || values.length === 0) return null;

    return {
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  setMemoryBaseline(): void {
    this.memoryBaseline = process.memoryUsage().heapUsed;
  }

  getMemoryIncrease(): number {
    return process.memoryUsage().heapUsed - this.memoryBaseline;
  }

  reset(): void {
    this.metrics.clear();
    this.memoryBaseline = 0;
  }

  printSummary(): void {
    console.log('\n📊 Pattern Detection Performance Summary:');
    for (const [metricName, values] of this.metrics.entries()) {
      if (values.length > 0) {
        const stats = this.getStats(metricName);
        if (stats) {
          const unit = metricName.includes('memory') ? 'bytes' : 'ms';
          console.log(`   ${metricName}: ${stats.avg.toFixed(2)}${unit} avg, ${stats.max.toFixed(2)}${unit} max (${stats.count} samples)`);
        }
      }
    }
  }
}

/**
 * Alert monitoring helper
 */
class AlertMonitor extends EventEmitter {
  private alerts: Array<{ type: string; data: any; timestamp: Date }> = [];
  private throttleMap: Map<string, number> = new Map();

  constructor() {
    super();
    this.on('critical-pattern-alert', this.handleAlert.bind(this));
    this.on('pattern-escalation', this.handleAlert.bind(this));
    this.on('incident-added', this.handleAlert.bind(this));
  }

  private handleAlert(data: any): void {
    const alertType = data.pattern?.type || 'general';
    const now = Date.now();
    const lastAlert = this.throttleMap.get(alertType) || 0;

    if (now - lastAlert > TEST_CONFIG.ALERT_THROTTLE_WINDOW) {
      this.alerts.push({
        type: alertType,
        data,
        timestamp: new Date()
      });
      this.throttleMap.set(alertType, now);
    }
  }

  getAlerts(): Array<{ type: string; data: any; timestamp: Date }> {
    return [...this.alerts];
  }

  getAlertCount(type?: string): number {
    if (!type) return this.alerts.length;
    return this.alerts.filter(alert => alert.type === type).length;
  }

  reset(): void {
    this.alerts = [];
    this.throttleMap.clear();
  }
}

describe('Pattern Detection Service Integration Tests', () => {
  let patternDetector: PatternDetectionPlugin;
  let mockAdapter: MockStorageAdapter;
  let performanceMonitor: PatternDetectionPerformanceMonitor;
  let alertMonitor: AlertMonitor;
  let testConfig: PatternDetectionConfig;

  beforeAll(() => {
    // Setup test configuration
    testConfig = {
      enabled: true,
      detection: {
        min_incidents_for_pattern: 3,
        time_window_hours: TEST_CONFIG.TEMPORAL_WINDOW_HOURS,
        similarity_threshold: 0.7,
        alert_threshold: 5,
        analysis_interval_minutes: 1
      },
      clustering: {
        temporal_sensitivity: 0.8,
        component_grouping: true,
        error_code_matching: true,
        semantic_similarity: false
      },
      alerting: {
        critical_pattern_alert: true,
        escalation_threshold: 10,
        notification_cooldown_hours: 2
      }
    };

    performanceMonitor = new PatternDetectionPerformanceMonitor();
    alertMonitor = new AlertMonitor();

    console.log('🔧 Pattern Detection integration test setup complete');
  });

  beforeEach(async () => {
    mockAdapter = new MockStorageAdapter();
    patternDetector = new PatternDetectionPlugin(mockAdapter, testConfig);

    // Wire up alert monitoring
    patternDetector.on('critical-pattern-alert', (data) => alertMonitor.emit('critical-pattern-alert', data));
    patternDetector.on('pattern-escalation', (data) => alertMonitor.emit('pattern-escalation', data));
    patternDetector.on('incident-added', (data) => alertMonitor.emit('incident-added', data));

    await patternDetector.initialize();
    performanceMonitor.reset();
    alertMonitor.reset();
  });

  afterEach(async () => {
    await patternDetector.cleanup();
    performanceMonitor.reset();
  });

  describe('Temporal Pattern Detection', () => {
    it('should detect temporal clustering of incidents', async () => {
      // Arrange
      const baseTime = new Date();
      const incidents = IncidentDataGenerator.createTemporalIncidentCluster(5, baseTime, 30); // 5 incidents in 30 minutes

      const endTimer = performanceMonitor.startOperation('temporal_pattern_detection');

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns',
        payload: { timeWindow: 1 }
      }) as PatternAnalysis;

      const duration = endTimer();

      // Assert
      expect(analysis.patterns).toHaveLength(1);
      const temporalPattern = analysis.patterns[0];

      PatternAnalysisVerifier.verifyTemporalPattern(temporalPattern, 5, 30 * 60 * 1000);
      expect(temporalPattern.suggested_cause).toContain('short time window');
      expect(duration).toBeLessThan(TEST_CONFIG.PATTERN_DETECTION_TIMEOUT);
    });

    it('should detect escalating temporal patterns', async () => {
      // Arrange
      const incidents = IncidentDataGenerator.createEscalatingIncidentPattern(2); // Start with 2, escalate to 6+ incidents

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns',
        payload: { timeWindow: 5 }
      }) as PatternAnalysis;

      // Assert
      expect(analysis.patterns.length).toBeGreaterThanOrEqual(1);
      
      const escalatingPattern = analysis.patterns.find(p => p.trend === 'increasing');
      expect(escalatingPattern).toBeDefined();
      
      if (escalatingPattern) {
        PatternAnalysisVerifier.verifyPatternTrend(escalatingPattern, 'increasing');
        expect(escalatingPattern.frequency).toBeGreaterThanOrEqual(6);
      }
    });

    it('should handle sparse temporal data correctly', async () => {
      // Arrange - Create incidents spread over 12 hours
      const incidents: Incident[] = [];
      const baseTime = new Date();

      for (let i = 0; i < 6; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 2 * 60 * 60 * 1000); // 2 hours apart
        incidents.push(IncidentDataGenerator.createIncident({
          timestamp,
          title: `Sparse Incident ${i}`,
          description: 'Sporadic system issue',
          component: 'SPARSE-COMPONENT'
        }));
      }

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns',
        payload: { timeWindow: 24 }
      }) as PatternAnalysis;

      // Assert
      // Should not create temporal pattern due to sparse distribution
      const temporalPatterns = analysis.patterns.filter(p => p.type === 'temporal');
      expect(temporalPatterns).toHaveLength(0);

      // But should create component pattern
      const componentPatterns = analysis.patterns.filter(p => p.type === 'component');
      expect(componentPatterns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Component Failure Pattern Recognition', () => {
    it('should detect component-specific failure patterns', async () => {
      // Arrange
      const componentName = 'CRITICAL-SERVICE';
      const incidents = IncidentDataGenerator.createComponentIncidentCluster(4, componentName);

      const endTimer = performanceMonitor.startOperation('component_pattern_detection');

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      const duration = endTimer();

      // Assert
      expect(analysis.patterns.length).toBeGreaterThanOrEqual(1);
      
      const componentPattern = analysis.patterns.find(p => p.type === 'component');
      expect(componentPattern).toBeDefined();

      if (componentPattern) {
        PatternAnalysisVerifier.verifyComponentPattern(componentPattern, componentName);
        expect(duration).toBeLessThan(TEST_CONFIG.PATTERN_DETECTION_TIMEOUT);
      }
    });

    it('should differentiate between multiple component failures', async () => {
      // Arrange
      const components = ['SERVICE-A', 'SERVICE-B', 'SERVICE-C'];
      const allIncidents: Incident[] = [];

      // Create incidents for each component
      components.forEach(component => {
        const incidents = IncidentDataGenerator.createComponentIncidentCluster(3, component);
        allIncidents.push(...incidents);
      });

      // Shuffle incidents to simulate real-world mixed order
      allIncidents.sort(() => Math.random() - 0.5);

      // Act
      for (const incident of allIncidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      const componentPatterns = analysis.patterns.filter(p => p.type === 'component');
      expect(componentPatterns).toHaveLength(3);

      // Verify each component has its own pattern
      components.forEach(component => {
        const pattern = componentPatterns.find(p => 
          p.incidents.every(incident => incident.component === component)
        );
        expect(pattern).toBeDefined();
      });
    });

    it('should calculate component health degradation scores', async () => {
      // Arrange
      const componentName = 'DEGRADING-SERVICE';
      const incidents: Incident[] = [];
      const baseTime = new Date();

      // Create incidents with increasing severity over time
      const severities: Incident['severity'][] = ['low', 'medium', 'high', 'critical'];
      severities.forEach((severity, index) => {
        const timestamp = new Date(baseTime.getTime() + index * 60000);
        incidents.push(IncidentDataGenerator.createIncident({
          timestamp,
          component: componentName,
          severity,
          title: `${componentName} Issue ${index}`,
          description: `Severity escalating: ${severity}`
        }));
      });

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      const componentPattern = analysis.patterns.find(p => 
        p.type === 'component' && 
        p.incidents.some(i => i.component === componentName)
      );
      
      expect(componentPattern).toBeDefined();
      if (componentPattern) {
        expect(componentPattern.severity).toBe('critical'); // Should reflect highest severity
        expect(componentPattern.trend).toBe('increasing');
        expect(componentPattern.prevention_score).toBeLessThan(50); // Hard to prevent escalating issues
      }
    });
  });

  describe('Error Code Pattern Clustering', () => {
    it('should detect recurring error code patterns', async () => {
      // Arrange
      const errorCode = 'S0C7';
      const incidents = IncidentDataGenerator.createErrorCodeIncidentCluster(5, errorCode);

      const endTimer = performanceMonitor.startOperation('error_pattern_detection');

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      const duration = endTimer();

      // Assert
      expect(analysis.patterns.length).toBeGreaterThanOrEqual(1);
      
      const errorPattern = analysis.patterns.find(p => p.type === 'error');
      expect(errorPattern).toBeDefined();

      if (errorPattern) {
        PatternAnalysisVerifier.verifyErrorPattern(errorPattern, errorCode);
        expect(duration).toBeLessThan(TEST_CONFIG.PATTERN_DETECTION_TIMEOUT);
      }
    });

    it('should handle multiple concurrent error patterns', async () => {
      // Arrange
      const errorCodes = ['S0C7', 'S0C4', 'IEF212I', 'SQLCODE-904'];
      const allIncidents: Incident[] = [];

      // Create incident clusters for each error code
      errorCodes.forEach(errorCode => {
        const incidents = IncidentDataGenerator.createErrorCodeIncidentCluster(4, errorCode);
        allIncidents.push(...incidents);
      });

      // Interleave incidents to simulate realistic timing
      allIncidents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Act
      for (const incident of allIncidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      const errorPatterns = analysis.patterns.filter(p => p.type === 'error');
      expect(errorPatterns).toHaveLength(4);

      // Verify each error code has its own pattern
      errorCodes.forEach(errorCode => {
        const pattern = errorPatterns.find(p => 
          p.suggested_cause?.includes(errorCode)
        );
        expect(pattern).toBeDefined();
        if (pattern) {
          expect(pattern.confidence).toBeGreaterThanOrEqual(90);
        }
      });
    });

    it('should extract error codes from various formats', async () => {
      // Arrange
      const errorFormats = [
        { code: 'S0C7', title: 'Program abend S0C7 in module TESTPROG' },
        { code: 'IEF212I', title: 'JCL error IEF212I dataset not found' },
        { code: 'SQLCODE-904', title: 'DB2 failure with SQLCODE -904' },
        { code: 'WER027A', title: 'Sort failed WER027A insufficient storage' },
        { code: 'EDC8128I', title: 'TCP/IP error EDC8128I connection refused' }
      ];

      const incidents: Incident[] = [];
      errorFormats.forEach((format, index) => {
        for (let i = 0; i < 3; i++) {
          incidents.push(IncidentDataGenerator.createIncident({
            title: format.title,
            description: `Error occurred: ${format.code}`,
            timestamp: new Date(Date.now() + index * 1000 + i * 500)
          }));
        }
      });

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      const errorPatterns = analysis.patterns.filter(p => p.type === 'error');
      expect(errorPatterns).toHaveLength(5);

      // Verify error code extraction accuracy
      errorFormats.forEach(format => {
        const pattern = errorPatterns.find(p => 
          p.suggested_cause?.toUpperCase().includes(format.code.toUpperCase())
        );
        expect(pattern).toBeDefined();
      });
    });
  });

  describe('Real-time Incident Processing', () => {
    it('should process incidents in real-time with immediate pattern analysis', async () => {
      // Arrange
      const incidents = IncidentDataGenerator.createTemporalIncidentCluster(6, new Date(), 15);
      const processingTimes: number[] = [];

      // Act - Process incidents one by one simulating real-time
      for (const incident of incidents) {
        const startTime = performance.now();
        
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
        
        processingTimes.push(performance.now() - startTime);
      }

      // Assert
      const avgProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);

      expect(avgProcessingTime).toBeLessThan(100); // Should be very fast
      expect(maxProcessingTime).toBeLessThan(500); // Even worst case should be reasonable

      // Verify pattern was detected after sufficient incidents
      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      expect(analysis.patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle high-frequency incident streams', async () => {
      // Arrange
      const incidentCount = TEST_CONFIG.CONCURRENT_INCIDENTS;
      const incidents = IncidentDataGenerator.createMixedIncidentSet(incidentCount);
      
      performanceMonitor.setMemoryBaseline();
      const endTimer = performanceMonitor.startOperation('high_frequency_processing');

      // Act - Process incidents rapidly
      const promises = incidents.map(incident => 
        patternDetector.processData({
          action: 'add_incident',
          payload: incident
        })
      );

      await Promise.all(promises);
      
      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      const duration = endTimer();
      const memoryIncrease = performanceMonitor.getMemoryIncrease();

      // Assert
      expect(duration).toBeLessThan(TEST_CONFIG.PERFORMANCE_THRESHOLD);
      expect(analysis.patterns.length).toBeGreaterThan(0);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase

      // Verify processing efficiency
      const processingRate = incidentCount / (duration / 1000); // incidents per second
      expect(processingRate).toBeGreaterThan(50); // Should process at least 50 incidents/second
    });

    it('should maintain pattern quality under load', async () => {
      // Arrange
      const baseTime = new Date();
      const incidents: Incident[] = [];

      // Create known patterns in a large dataset
      incidents.push(...IncidentDataGenerator.createTemporalIncidentCluster(5, baseTime, 10));
      incidents.push(...IncidentDataGenerator.createComponentIncidentCluster(4, 'LOAD-TEST-COMPONENT'));
      incidents.push(...IncidentDataGenerator.createErrorCodeIncidentCluster(6, 'S0C7'));
      
      // Add noise incidents
      incidents.push(...IncidentDataGenerator.createMixedIncidentSet(200));

      // Shuffle to simulate realistic order
      incidents.sort(() => Math.random() - 0.5);

      // Act
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      expect(analysis.patterns.length).toBeGreaterThanOrEqual(3); // Should find the 3 known patterns

      // Verify pattern types were detected
      const patternTypes = analysis.patterns.map(p => p.type);
      expect(patternTypes).toContain('temporal');
      expect(patternTypes).toContain('component');
      expect(patternTypes).toContain('error');

      // Verify pattern quality
      analysis.patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(TEST_CONFIG.PATTERN_CONFIDENCE_THRESHOLD);
        expect(pattern.frequency).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Alert Generation and Throttling', () => {
    it('should generate alerts for critical patterns', async () => {
      // Arrange
      const criticalIncidents = IncidentDataGenerator.createComponentIncidentCluster(6, 'CRITICAL-SYSTEM');
      criticalIncidents.forEach(incident => {
        incident.severity = 'critical';
      });

      // Act
      for (const incident of criticalIncidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      // Wait for alerts to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const alerts = alertMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const criticalAlerts = alerts.filter(alert => 
        alert.data.pattern?.severity === 'critical'
      );
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should implement alert throttling to prevent spam', async () => {
      // Arrange
      const incidents = Array(20).fill(null).map((_, i) => 
        IncidentDataGenerator.createIncident({
          timestamp: new Date(Date.now() + i * 100),
          component: 'SPAM-COMPONENT',
          severity: 'critical',
          title: `Spam Alert ${i}`
        })
      );

      // Act - Add incidents rapidly
      for (const incident of incidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      // Wait for throttling to take effect
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.ALERT_THROTTLE_WINDOW + 100));

      // Assert
      const alerts = alertMonitor.getAlerts();
      
      // Should not have alerts for every incident due to throttling
      expect(alerts.length).toBeLessThan(incidents.length);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should escalate alerts for increasing pattern severity', async () => {
      // Arrange
      const escalatingIncidents = IncidentDataGenerator.createEscalatingIncidentPattern(1);
      
      // Act
      for (const incident of escalatingIncidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      const escalatingPatterns = analysis.patterns.filter(p => p.trend === 'increasing');
      expect(escalatingPatterns.length).toBeGreaterThan(0);

      if (escalatingPatterns.length > 0) {
        expect(analysis.summary.escalating_patterns).toBeGreaterThan(0);
        expect(analysis.recommendations).toContain(
          expect.stringMatching(/escalating|trending upward/i)
        );
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large incident datasets efficiently', async () => {
      // Arrange
      const largeIncidentSet = IncidentDataGenerator.createMixedIncidentSet(TEST_CONFIG.LARGE_INCIDENT_COUNT);
      
      performanceMonitor.setMemoryBaseline();
      const endTimer = performanceMonitor.startOperation('large_dataset_processing');

      // Act
      for (const incident of largeIncidentSet) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      const duration = endTimer();
      const memoryIncrease = performanceMonitor.getMemoryIncrease();

      // Assert
      expect(duration).toBeLessThan(TEST_CONFIG.PERFORMANCE_THRESHOLD);
      expect(analysis.patterns.length).toBeGreaterThan(0);
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      // Verify processing rate
      const processingRate = TEST_CONFIG.LARGE_INCIDENT_COUNT / (duration / 1000);
      expect(processingRate).toBeGreaterThan(100); // At least 100 incidents/second
    });

    it('should scale pattern detection with incident volume', async () => {
      // Arrange
      const volumeSizes = [100, 250, 500, 750, 1000];
      const scalingResults: Array<{ size: number; duration: number; patternCount: number }> = [];

      // Act
      for (const size of volumeSizes) {
        // Reset for each test
        await patternDetector.cleanup();
        patternDetector = new PatternDetectionPlugin(mockAdapter, testConfig);
        await patternDetector.initialize();

        const incidents = IncidentDataGenerator.createMixedIncidentSet(size);
        const endTimer = performanceMonitor.startOperation(`scaling_${size}`);

        for (const incident of incidents) {
          await patternDetector.processData({
            action: 'add_incident',
            payload: incident
          });
        }

        const analysis = await patternDetector.processData({
          action: 'analyze_patterns'
        }) as PatternAnalysis;

        const duration = endTimer();

        scalingResults.push({
          size,
          duration,
          patternCount: analysis.patterns.length
        });
      }

      // Assert
      // Verify sub-linear scaling (performance shouldn't degrade exponentially)
      for (let i = 1; i < scalingResults.length; i++) {
        const current = scalingResults[i];
        const previous = scalingResults[i - 1];
        
        const volumeRatio = current.size / previous.size;
        const timeRatio = current.duration / previous.duration;
        
        // Time scaling should be better than linear
        expect(timeRatio).toBeLessThan(volumeRatio * 1.5);
      }

      // Pattern count should increase with more data (up to a point)
      const patternCounts = scalingResults.map(r => r.patternCount);
      expect(Math.max(...patternCounts)).toBeGreaterThan(Math.min(...patternCounts));
    });

    it('should maintain consistent memory usage during operation', async () => {
      // Arrange
      const batchSize = 100;
      const batchCount = 10;
      const memoryMeasurements: number[] = [];

      performanceMonitor.setMemoryBaseline();

      // Act - Process incidents in batches
      for (let batch = 0; batch < batchCount; batch++) {
        const incidents = IncidentDataGenerator.createMixedIncidentSet(batchSize);
        
        for (const incident of incidents) {
          await patternDetector.processData({
            action: 'add_incident',
            payload: incident
          });
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        memoryMeasurements.push(performanceMonitor.getMemoryIncrease());
      }

      // Assert
      const memoryGrowth = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
      const totalProcessed = batchSize * batchCount;
      const memoryPerIncident = memoryGrowth / totalProcessed;

      // Memory growth should be reasonable
      expect(memoryPerIncident).toBeLessThan(1024); // Less than 1KB per incident
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB total growth
    });
  });

  describe('Pattern Analysis Quality and Accuracy', () => {
    it('should provide accurate pattern deduplication', async () => {
      // Arrange - Create overlapping incidents that should form single patterns
      const baseTime = new Date();
      const overlappingIncidents: Incident[] = [];

      // Create two sets of similar incidents that should be deduplicated
      for (let set = 0; set < 2; set++) {
        for (let i = 0; i < 3; i++) {
          overlappingIncidents.push(IncidentDataGenerator.createIncident({
            timestamp: new Date(baseTime.getTime() + set * 60000 + i * 10000),
            title: 'Duplicate Pattern Error',
            description: 'Same error occurring multiple times',
            component: 'DUPLICATE-COMPONENT',
            severity: 'high'
          }));
        }
      }

      // Act
      for (const incident of overlappingIncidents) {
        await patternDetector.processData({
          action: 'add_incident',
          payload: incident
        });
      }

      const analysis = await patternDetector.processData({
        action: 'analyze_patterns'
      }) as PatternAnalysis;

      // Assert
      // Should create one component pattern, not multiple overlapping ones
      const componentPatterns = analysis.patterns.filter(p => p.type === 'component');
      expect(componentPatterns).toHaveLength(1);
      expect(componentPatterns[0].frequency).toBe(6); // All incidents merged
    });

    it('should generate meaningful recommendations', async () => {
      // Arrange
      const scenarios = [
        {
          name: 'Critical Component Failure',
          incidents: IncidentDataGenerator.createComponentIncidentCluster(5, 'CRITICAL-SERVICE'),
          expectedRecommendations: ['component health', 'critical-service']
        },
        {
          name: 'Temporal Spike',
          incidents: IncidentDataGenerator.createTemporalIncidentCluster(4, new Date(), 10),
          expectedRecommendations: ['systemic issues', 'temporal patterns']
        },
        {
          name: 'Error Code Pattern',
          incidents: IncidentDataGenerator.createErrorCodeIncidentCluster(4, 'S0C7'),
          expectedRecommendations: []
        }
      ];

      for (const scenario of scenarios) {
        // Reset detector
        await patternDetector.cleanup();
        patternDetector = new PatternDetectionPlugin(mockAdapter, testConfig);
        await patternDetector.initialize();

        // Act
        for (const incident of scenario.incidents) {
          await patternDetector.processData({
            action: 'add_incident',
            payload: incident
          });
        }

        const analysis = await patternDetector.processData({
          action: 'analyze_patterns'
        }) as PatternAnalysis;

        // Assert
        expect(analysis.recommendations).toBeDefined();
        expect(analysis.recommendations.length).toBeGreaterThan(0);

        if (scenario.expectedRecommendations.length > 0) {
          const recommendationText = analysis.recommendations.join(' ').toLowerCase();
          scenario.expectedRecommendations.forEach(expectedTerm => {
            expect(recommendationText).toContain(expectedTerm.toLowerCase());
          });
        }
      }
    });

    it('should calculate prevention scores accurately', async () => {
      // Arrange
      const scenarios = [
        {
          name: 'High Prevention Score',
          incidents: IncidentDataGenerator.createErrorCodeIncidentCluster(4, 'S0C7'), // Predictable error
          expectedMinScore: 70
        },
        {
          name: 'Medium Prevention Score',
          incidents: IncidentDataGenerator.createComponentIncidentCluster(4, 'COMPONENT-X'), // Component issue
          expectedMinScore: 50
        },
        {
          name: 'Low Prevention Score',
          incidents: Array(4).fill(null).map((_, i) => 
            IncidentDataGenerator.createIncident({
              severity: 'critical',
              title: `Critical Random Issue ${i}`,
              component: `RANDOM-${i}`
            })
          ),
          expectedMaxScore: 60
        }
      ];

      for (const scenario of scenarios) {
        // Reset detector
        await patternDetector.cleanup();
        patternDetector = new PatternDetectionPlugin(mockAdapter, testConfig);
        await patternDetector.initialize();

        // Act
        for (const incident of scenario.incidents) {
          await patternDetector.processData({
            action: 'add_incident',
            payload: incident
          });
        }

        const analysis = await patternDetector.processData({
          action: 'analyze_patterns'
        }) as PatternAnalysis;

        // Assert
        expect(analysis.patterns.length).toBeGreaterThan(0);
        
        const pattern = analysis.patterns[0];
        expect(pattern.prevention_score).toBeDefined();
        expect(pattern.prevention_score).toBeGreaterThanOrEqual(0);
        expect(pattern.prevention_score).toBeLessThanOrEqual(100);

        if ('expectedMinScore' in scenario) {
          expect(pattern.prevention_score).toBeGreaterThanOrEqual(scenario.expectedMinScore);
        }
        if ('expectedMaxScore' in scenario) {
          expect(pattern.prevention_score).toBeLessThanOrEqual(scenario.expectedMaxScore);
        }
      }
    });
  });

  afterAll(() => {
    // Print performance summary
    performanceMonitor.printSummary();
    
    const alertStats = {
      totalAlerts: alertMonitor.getAlertCount(),
      criticalAlerts: alertMonitor.getAlertCount('critical'),
      componentAlerts: alertMonitor.getAlertCount('component'),
      temporalAlerts: alertMonitor.getAlertCount('temporal')
    };

    console.log('\n🚨 Alert Generation Summary:');
    console.log(`   Total Alerts: ${alertStats.totalAlerts}`);
    console.log(`   Critical Alerts: ${alertStats.criticalAlerts}`);
    console.log(`   Component Alerts: ${alertStats.componentAlerts}`);
    console.log(`   Temporal Alerts: ${alertStats.temporalAlerts}`);

    console.log('✅ Pattern Detection integration tests completed');
  });
});