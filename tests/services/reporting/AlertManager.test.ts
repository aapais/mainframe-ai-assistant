import {
  AlertManager,
  AlertRule,
  AlertCondition,
  AlertThreshold,
  AlertNotification,
  AlertSchedule,
  AlertEvent,
  RetryPolicy
} from '../../../src/services/reporting/AlertManager';
import { Logger } from '../../../src/services/logger/Logger';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('AlertManager', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    alertManager = new AlertManager(
      mockLogger,
      100, // 100ms evaluation interval for testing
      50   // Max 50 history items per rule
    );
  });

  afterEach(() => {
    alertManager.stop();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('lifecycle management', () => {
    it('should start and stop alert manager', () => {
      expect(alertManager['isRunning']).toBe(false);

      alertManager.start();
      expect(alertManager['isRunning']).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Alert manager started');

      alertManager.stop();
      expect(alertManager['isRunning']).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Alert manager stopped');
    });

    it('should not start if already running', () => {
      alertManager.start();
      alertManager.start(); // Second start should be ignored

      expect(mockLogger.warn).toHaveBeenCalledWith('Alert manager is already running');
    });

    it('should emit lifecycle events', () => {
      const startedListener = jest.fn();
      const stoppedListener = jest.fn();

      alertManager.on('alertManagerStarted', startedListener);
      alertManager.on('alertManagerStopped', stoppedListener);

      alertManager.start();
      expect(startedListener).toHaveBeenCalled();

      alertManager.stop();
      expect(stoppedListener).toHaveBeenCalled();
    });
  });

  describe('alert rule management', () => {
    const sampleCondition: AlertCondition = {
      type: 'threshold',
      metric: 'cpu_usage',
      comparison: 'gt',
      value: 80
    };

    const sampleThreshold: AlertThreshold = {
      severity: 'high',
      condition: sampleCondition,
      message: 'CPU usage is above {thresholdValue}%',
      autoResolve: true
    };

    const sampleNotifications: AlertNotification[] = [
      {
        type: 'email',
        recipients: ['admin@example.com']
      }
    ];

    const sampleSchedule: AlertSchedule = {
      timezone: 'UTC',
      activeHours: {
        start: '09:00',
        end: '17:00'
      }
    };

    describe('createAlertRule', () => {
      it('should create a new alert rule', () => {
        const rule = alertManager.createAlertRule(
          'High CPU Usage',
          'monitoring_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user',
          'Alert for high CPU usage'
        );

        expect(rule.id).toBeDefined();
        expect(rule.name).toBe('High CPU Usage');
        expect(rule.dataSource).toBe('monitoring_db');
        expect(rule.isActive).toBe(true);
        expect(rule.triggerCount).toBe(0);
        expect(rule.createdBy).toBe('test-user');
      });

      it('should emit alertRuleCreated event', () => {
        const eventListener = jest.fn();
        alertManager.on('alertRuleCreated', eventListener);

        const rule = alertManager.createAlertRule(
          'Test Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        expect(eventListener).toHaveBeenCalledWith(rule);
      });
    });

    describe('getAlertRule', () => {
      it('should retrieve alert rule by ID', () => {
        const created = alertManager.createAlertRule(
          'Test Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        const retrieved = alertManager.getAlertRule(created.id);

        expect(retrieved).toBeTruthy();
        expect(retrieved?.id).toBe(created.id);
      });

      it('should return null for non-existent rule', () => {
        const result = alertManager.getAlertRule('non-existent');
        expect(result).toBeNull();
      });
    });

    describe('listAlertRules', () => {
      beforeEach(() => {
        // Create test rules
        alertManager.createAlertRule(
          'Active Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'user1'
        );

        const inactiveRule = alertManager.createAlertRule(
          'Inactive Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'user2'
        );

        alertManager.updateAlertRule(inactiveRule.id, { isActive: false });
      });

      it('should list all alert rules', () => {
        const rules = alertManager.listAlertRules();
        expect(rules).toHaveLength(2);
      });

      it('should list only active rules when requested', () => {
        const activeRules = alertManager.listAlertRules(true);
        expect(activeRules).toHaveLength(1);
        expect(activeRules[0].isActive).toBe(true);
      });
    });

    describe('updateAlertRule', () => {
      it('should update alert rule', () => {
        const created = alertManager.createAlertRule(
          'Original Name',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        const updated = alertManager.updateAlertRule(created.id, {
          name: 'Updated Name',
          description: 'Updated description'
        });

        expect(updated).toBeTruthy();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.description).toBe('Updated description');
      });

      it('should emit alertRuleUpdated event', () => {
        const eventListener = jest.fn();
        alertManager.on('alertRuleUpdated', eventListener);

        const rule = alertManager.createAlertRule(
          'Test Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        alertManager.updateAlertRule(rule.id, { name: 'Updated' });

        expect(eventListener).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated' })
        );
      });
    });

    describe('deleteAlertRule', () => {
      it('should delete alert rule', () => {
        const created = alertManager.createAlertRule(
          'To Delete',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        const deleted = alertManager.deleteAlertRule(created.id);
        expect(deleted).toBe(true);

        const retrieved = alertManager.getAlertRule(created.id);
        expect(retrieved).toBeNull();
      });

      it('should return false for non-existent rule', () => {
        const deleted = alertManager.deleteAlertRule('non-existent');
        expect(deleted).toBe(false);
      });
    });

    describe('activate/deactivate', () => {
      it('should activate alert rule', () => {
        const rule = alertManager.createAlertRule(
          'Test Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        alertManager.updateAlertRule(rule.id, { isActive: false });

        const activated = alertManager.activateAlertRule(rule.id);
        expect(activated).toBe(true);

        const updated = alertManager.getAlertRule(rule.id);
        expect(updated?.isActive).toBe(true);
      });

      it('should deactivate alert rule', () => {
        const rule = alertManager.createAlertRule(
          'Test Rule',
          'test_db',
          sampleCondition,
          [sampleThreshold],
          sampleNotifications,
          sampleSchedule,
          'test-user'
        );

        const deactivated = alertManager.deactivateAlertRule(rule.id);
        expect(deactivated).toBe(true);

        const updated = alertManager.getAlertRule(rule.id);
        expect(updated?.isActive).toBe(false);
      });
    });
  });

  describe('condition evaluation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    describe('threshold conditions', () => {
      it('should evaluate greater than threshold', () => {
        const condition: AlertCondition = {
          type: 'threshold',
          metric: 'value',
          comparison: 'gt',
          value: 50
        };

        const data = { value: 75 };
        const result = alertManager['evaluateCondition'](condition, data);

        expect(result.type).toBe('threshold');
        expect(result.actualValue).toBe(75);
        expect(result.thresholdValue).toBe(50);
        expect(result.comparison).toBe('gt');
      });

      it('should evaluate less than threshold', () => {
        const condition: AlertCondition = {
          type: 'threshold',
          metric: 'value',
          comparison: 'lt',
          value: 50
        };

        const data = { value: 25 };
        const result = alertManager['evaluateCondition'](condition, data);

        expect(result.actualValue).toBe(25);
        expect(result.thresholdValue).toBe(50);
      });

      it('should evaluate equal threshold', () => {
        const condition: AlertCondition = {
          type: 'threshold',
          metric: 'value',
          comparison: 'eq',
          value: 50
        };

        const data = { value: 50 };
        const result = alertManager['evaluateCondition'](condition, data);

        expect(result.actualValue).toBe(50);
        expect(result.thresholdValue).toBe(50);
      });
    });

    describe('threshold evaluation', () => {
      it('should return true when threshold is met', () => {
        const threshold: AlertThreshold = {
          severity: 'high',
          condition: {
            type: 'threshold',
            metric: 'value',
            comparison: 'gt',
            value: 50
          },
          message: 'Value too high'
        };

        const evaluationResult = {
          type: 'threshold',
          actualValue: 75,
          thresholdValue: 50,
          comparison: 'gt'
        };

        const result = alertManager['evaluateThreshold'](threshold, evaluationResult, null);
        expect(result).toBe(true);
      });

      it('should return false when threshold is not met', () => {
        const threshold: AlertThreshold = {
          severity: 'high',
          condition: {
            type: 'threshold',
            metric: 'value',
            comparison: 'gt',
            value: 50
          },
          message: 'Value too high'
        };

        const evaluationResult = {
          type: 'threshold',
          actualValue: 25,
          thresholdValue: 50,
          comparison: 'gt'
        };

        const result = alertManager['evaluateThreshold'](threshold, evaluationResult, null);
        expect(result).toBe(false);
      });

      it('should handle between comparison', () => {
        const threshold: AlertThreshold = {
          severity: 'medium',
          condition: {
            type: 'threshold',
            metric: 'value',
            comparison: 'between',
            value: [10, 90]
          },
          message: 'Value in range'
        };

        const evaluationResult = {
          type: 'threshold',
          actualValue: 50,
          thresholdValue: [10, 90],
          comparison: 'between'
        };

        const result = alertManager['evaluateThreshold'](threshold, evaluationResult, null);
        expect(result).toBe(true);
      });
    });

    describe('metric value extraction', () => {
      it('should extract simple numeric value', () => {
        const data = { value: 42 };
        const result = alertManager['extractMetricValue'](data, 'value');
        expect(result).toBe(42);
      });

      it('should extract nested value', () => {
        const data = {
          value: {
            cpu: 75,
            memory: 60
          }
        };
        const result = alertManager['extractMetricValue'](data, 'cpu');
        expect(result).toBe(75);
      });

      it('should apply aggregation functions', () => {
        const data = { value: [10, 20, 30, 40, 50] };

        expect(alertManager['extractMetricValue'](data, 'value', 'sum')).toBe(150);
        expect(alertManager['extractMetricValue'](data, 'value', 'avg')).toBe(30);
        expect(alertManager['extractMetricValue'](data, 'value', 'count')).toBe(5);
        expect(alertManager['extractMetricValue'](data, 'value', 'min')).toBe(10);
        expect(alertManager['extractMetricValue'](data, 'value', 'max')).toBe(50);
        expect(alertManager['extractMetricValue'](data, 'value', 'median')).toBe(30);
      });
    });
  });

  describe('schedule evaluation', () => {
    it('should respect active hours', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        dataSource: 'test_db',
        isActive: true,
        condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        thresholds: [],
        notifications: [],
        schedule: {
          timezone: 'UTC',
          activeHours: {
            start: '09:00',
            end: '17:00'
          }
        },
        createdBy: 'test',
        createdAt: new Date(),
        triggerCount: 0,
        metadata: {}
      };

      // Mock current time to be within active hours (12:00)
      const mockDate = new Date();
      mockDate.setHours(12, 0, 0, 0);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('12:00:00 GMT+0000 (UTC)');

      const shouldEvaluate = alertManager['shouldEvaluateRule'](rule, mockDate);
      expect(shouldEvaluate).toBe(true);

      // Mock current time to be outside active hours (20:00)
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('20:00:00 GMT+0000 (UTC)');

      const shouldNotEvaluate = alertManager['shouldEvaluateRule'](rule, mockDate);
      expect(shouldNotEvaluate).toBe(false);
    });

    it('should respect active days', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        dataSource: 'test_db',
        isActive: true,
        condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        thresholds: [],
        notifications: [],
        schedule: {
          timezone: 'UTC',
          activeDays: [1, 2, 3, 4, 5] // Monday to Friday
        },
        createdBy: 'test',
        createdAt: new Date(),
        triggerCount: 0,
        metadata: {}
      };

      // Mock Monday (day 1)
      const monday = new Date();
      jest.spyOn(monday, 'getDay').mockReturnValue(1);

      const shouldEvaluateWeekday = alertManager['shouldEvaluateRule'](rule, monday);
      expect(shouldEvaluateWeekday).toBe(true);

      // Mock Saturday (day 6)
      const saturday = new Date();
      jest.spyOn(saturday, 'getDay').mockReturnValue(6);

      const shouldNotEvaluateWeekend = alertManager['shouldEvaluateRule'](rule, saturday);
      expect(shouldNotEvaluateWeekend).toBe(false);
    });

    it('should respect quiet hours', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        dataSource: 'test_db',
        isActive: true,
        condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        thresholds: [],
        notifications: [],
        schedule: {
          timezone: 'UTC',
          quietHours: {
            start: '22:00',
            end: '06:00'
          }
        },
        createdBy: 'test',
        createdAt: new Date(),
        triggerCount: 0,
        metadata: {}
      };

      // Mock time during quiet hours (23:00)
      const mockDate = new Date();
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('23:00:00 GMT+0000 (UTC)');

      const shouldNotEvaluate = alertManager['shouldEvaluateRule'](rule, mockDate);
      expect(shouldNotEvaluate).toBe(false);

      // Mock time outside quiet hours (10:00)
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('10:00:00 GMT+0000 (UTC)');

      const shouldEvaluate = alertManager['shouldEvaluateRule'](rule, mockDate);
      expect(shouldEvaluate).toBe(true);
    });
  });

  describe('alert triggering and resolution', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should format alert message correctly', () => {
      const template = 'Alert: {ruleName} - {metric} is {actualValue}, threshold is {thresholdValue}';
      const evaluationResult = {
        actualValue: 85,
        thresholdValue: 80,
        metric: 'cpu_usage'
      };
      const rule = {
        name: 'CPU Alert',
        condition: { metric: 'cpu_usage' },
        dataSource: 'monitoring'
      } as AlertRule;

      const formatted = alertManager['formatAlertMessage'](template, evaluationResult, rule);

      expect(formatted).toContain('CPU Alert');
      expect(formatted).toContain('85');
      expect(formatted).toContain('80');
      expect(formatted).toContain('cpu_usage');
    });

    it('should not trigger duplicate alerts', async () => {
      const rule = alertManager.createAlertRule(
        'Duplicate Test',
        'test_db',
        {
          type: 'threshold',
          metric: 'value',
          comparison: 'gt',
          value: 50
        },
        [
          {
            severity: 'high',
            condition: {
              type: 'threshold',
              metric: 'value',
              comparison: 'gt',
              value: 50
            },
            message: 'Value too high'
          }
        ],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      // Mock data fetch to return high value
      alertManager['fetchDataForRule'] = jest.fn().mockResolvedValue({ value: 75 });

      // First trigger
      await alertManager['triggerAlert'](
        rule,
        rule.thresholds[0],
        { actualValue: 75, thresholdValue: 50 },
        new Date()
      );

      const activeAlerts1 = alertManager.getActiveAlerts();
      expect(activeAlerts1).toHaveLength(1);

      // Second trigger (should not create duplicate)
      await alertManager['triggerAlert'](
        rule,
        rule.thresholds[0],
        { actualValue: 85, thresholdValue: 50 },
        new Date()
      );

      const activeAlerts2 = alertManager.getActiveAlerts();
      expect(activeAlerts2).toHaveLength(1); // Still only one alert
    });
  });

  describe('notification management', () => {
    it('should track notification throttling', () => {
      const ruleId = 'test-rule';
      const notification: AlertNotification = {
        type: 'email',
        recipients: ['test@example.com'],
        throttling: {
          enabled: true,
          intervalMinutes: 60,
          maxNotificationsPerInterval: 3
        }
      };

      // First notification should not be throttled
      expect(alertManager['isNotificationThrottled'](ruleId, notification)).toBe(false);

      // Update throttle state
      alertManager['updateNotificationThrottleState'](ruleId, notification);
      alertManager['updateNotificationThrottleState'](ruleId, notification);
      alertManager['updateNotificationThrottleState'](ruleId, notification);

      // Fourth notification should be throttled
      expect(alertManager['isNotificationThrottled'](ruleId, notification)).toBe(true);
    });

    it('should reset throttling after interval', () => {
      jest.useFakeTimers();

      const ruleId = 'test-rule';
      const notification: AlertNotification = {
        type: 'email',
        recipients: ['test@example.com'],
        throttling: {
          enabled: true,
          intervalMinutes: 1, // 1 minute interval
          maxNotificationsPerInterval: 1
        }
      };

      // Send first notification
      alertManager['updateNotificationThrottleState'](ruleId, notification);
      expect(alertManager['isNotificationThrottled'](ruleId, notification)).toBe(true);

      // Advance time by 2 minutes
      jest.advanceTimersByTime(2 * 60 * 1000);

      // Should not be throttled anymore
      expect(alertManager['isNotificationThrottled'](ruleId, notification)).toBe(false);
    });
  });

  describe('alert management', () => {
    it('should get active alerts', () => {
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts).toEqual([]);
    });

    it('should filter active alerts by rule ID', async () => {
      const rule1 = alertManager.createAlertRule(
        'Rule 1',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      const rule2 = alertManager.createAlertRule(
        'Rule 2',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 30 },
        [{ severity: 'medium', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 30 }, message: 'Medium value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      // Simulate alerts for both rules
      await alertManager['triggerAlert'](
        rule1,
        rule1.thresholds[0],
        { actualValue: 75, thresholdValue: 50 },
        new Date()
      );

      await alertManager['triggerAlert'](
        rule2,
        rule2.thresholds[0],
        { actualValue: 45, thresholdValue: 30 },
        new Date()
      );

      const allAlerts = alertManager.getActiveAlerts();
      expect(allAlerts).toHaveLength(2);

      const rule1Alerts = alertManager.getActiveAlerts(rule1.id);
      expect(rule1Alerts).toHaveLength(1);
      expect(rule1Alerts[0].ruleId).toBe(rule1.id);
    });

    it('should acknowledge alert', async () => {
      const rule = alertManager.createAlertRule(
        'Ack Test',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      await alertManager['triggerAlert'](
        rule,
        rule.thresholds[0],
        { actualValue: 75, thresholdValue: 50 },
        new Date()
      );

      const activeAlerts = alertManager.getActiveAlerts();
      const alertId = activeAlerts[0].id;

      const acknowledged = alertManager.acknowledgeAlert(alertId, 'test-user');
      expect(acknowledged).toBe(true);

      const alert = alertManager['activeAlerts'].get(alertId);
      expect(alert?.status).toBe('acknowledged');
      expect(alert?.acknowledgedBy).toBe('test-user');
    });

    it('should manually resolve alert', async () => {
      const rule = alertManager.createAlertRule(
        'Resolve Test',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      await alertManager['triggerAlert'](
        rule,
        rule.thresholds[0],
        { actualValue: 75, thresholdValue: 50 },
        new Date()
      );

      const activeAlerts = alertManager.getActiveAlerts();
      const alertId = activeAlerts[0].id;

      const resolved = alertManager.manualResolveAlert(alertId);
      expect(resolved).toBe(true);

      // Alert should be removed from active alerts
      const activeAlertsAfter = alertManager.getActiveAlerts();
      expect(activeAlertsAfter).toHaveLength(0);
    });
  });

  describe('metrics', () => {
    beforeEach(() => {
      // Create test rules with some history
      const rule1 = alertManager.createAlertRule(
        'Metrics Rule 1',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      const rule2 = alertManager.createAlertRule(
        'Metrics Rule 2',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 30 },
        [{ severity: 'medium', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 30 }, message: 'Medium value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      alertManager.deactivateAlertRule(rule2.id);

      // Update trigger counts
      alertManager.updateAlertRule(rule1.id, { triggerCount: 5 });
      alertManager.updateAlertRule(rule2.id, { triggerCount: 3 });
    });

    it('should calculate metrics correctly', () => {
      const metrics = alertManager.getMetrics();

      expect(metrics.totalRules).toBe(2);
      expect(metrics.activeRules).toBe(1);
      expect(metrics.triggeredAlertsLast24h).toBe(0); // No actual alerts in history
      expect(metrics.resolvedAlertsLast24h).toBe(0);
      expect(metrics.averageResolutionTime).toBe(0);
      expect(metrics.notificationSuccessRate).toBe(1); // No notifications = 100% success
    });

    it('should get top triggered rules', () => {
      const topRules = alertManager['getTopTriggeredRules'](5);

      expect(topRules).toHaveLength(2);
      expect(topRules[0].count).toBe(5); // Rule 1 has higher count
      expect(topRules[1].count).toBe(3); // Rule 2 has lower count
    });
  });

  describe('alert history', () => {
    it('should track alert history', async () => {
      const rule = alertManager.createAlertRule(
        'History Test',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      await alertManager['triggerAlert'](
        rule,
        rule.thresholds[0],
        { actualValue: 75, thresholdValue: 50 },
        new Date()
      );

      const history = alertManager.getAlertHistory(rule.id);
      expect(history).toHaveLength(1);
      expect(history[0].ruleId).toBe(rule.id);
    });

    it('should limit history size', async () => {
      const smallHistoryManager = new AlertManager(mockLogger, 100, 2); // Max 2 history items

      const rule = smallHistoryManager.createAlertRule(
        'Limited History',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      // Add 3 alerts to history
      for (let i = 0; i < 3; i++) {
        const alert: AlertEvent = {
          id: `alert-${i}`,
          ruleId: rule.id,
          severity: 'high',
          status: 'triggered',
          message: `Alert ${i}`,
          triggeredAt: new Date(),
          actualValue: 75,
          thresholdValue: 50,
          context: {},
          notifications: [],
          actions: []
        };

        smallHistoryManager['addToHistory'](rule.id, alert);
      }

      const history = smallHistoryManager.getAlertHistory(rule.id);
      expect(history).toHaveLength(2); // Should be limited to 2
    });

    it('should get limited history', async () => {
      const rule = alertManager.createAlertRule(
        'Limited Get Test',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      // Add multiple alerts
      for (let i = 0; i < 5; i++) {
        await alertManager['triggerAlert'](
          rule,
          rule.thresholds[0],
          { actualValue: 75 + i, thresholdValue: 50 },
          new Date()
        );
      }

      const limitedHistory = alertManager.getAlertHistory(rule.id, 3);
      expect(limitedHistory).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should handle unsupported condition types', () => {
      const condition: AlertCondition = {
        type: 'unsupported' as any,
        metric: 'value'
      };

      expect(() => {
        alertManager['evaluateCondition'](condition, {});
      }).toThrow('Unsupported condition type: unsupported');
    });

    it('should handle data fetch errors gracefully', async () => {
      jest.useFakeTimers();

      alertManager['fetchDataForRule'] = jest.fn().mockRejectedValue(new Error('Data fetch failed'));

      const rule = alertManager.createAlertRule(
        'Error Test',
        'test_db',
        { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 },
        [{ severity: 'high', condition: { type: 'threshold', metric: 'value', comparison: 'gt', value: 50 }, message: 'High value' }],
        [],
        { timezone: 'UTC' },
        'test-user'
      );

      alertManager.start();

      // Trigger evaluation
      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not crash, error should be logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});