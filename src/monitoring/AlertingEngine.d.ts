import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { SearchPerformanceMonitor } from './SearchPerformanceMonitor';
import { PerformanceMonitor } from '../database/PerformanceMonitor';
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
  escalation?: EscalationPolicy;
  cooldown: number;
  schedule?: AlertSchedule;
  tags: string[];
  runbook?: string;
  created_at: Date;
  updated_at: Date;
}
export interface EscalationPolicy {
  stages: Array<{
    delay: number;
    channels: string[];
    repeat?: number;
  }>;
}
export interface AlertSchedule {
  timezone: string;
  active_periods: Array<{
    days: string[];
    start_time: string;
    end_time: string;
  }>;
}
export interface Alert {
  id: string;
  rule_id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  current_value: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  triggered_at: Date;
  last_notification: Date;
  notification_count: number;
  query?: string;
  tags: string[];
  context: Record<string, any>;
}
export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'console' | 'file';
  config: Record<string, any>;
  enabled: boolean;
  rate_limit?: {
    max_per_minute: number;
    max_per_hour: number;
  };
}
export declare class AlertingEngine extends EventEmitter {
  private db;
  private searchMonitor;
  private performanceMonitor;
  private rules;
  private channels;
  private activeAlerts;
  private lastNotifications;
  private evaluationInterval;
  private evaluationTimer?;
  constructor(
    database: Database.Database,
    searchMonitor: SearchPerformanceMonitor,
    performanceMonitor: PerformanceMonitor
  );
  addRule(rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>): string;
  updateRule(id: string, updates: Partial<AlertRule>): void;
  deleteRule(id: string): void;
  addChannel(channel: Omit<NotificationChannel, 'id'>): string;
  getRules(): AlertRule[];
  getChannels(): NotificationChannel[];
  getActiveAlerts(): Alert[];
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void;
  resolveAlert(alertId: string): void;
  testChannel(channelId: string): Promise<void>;
  getStatistics(): {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    alertsLast24h: number;
    topAlertMetrics: Array<{
      metric: string;
      count: number;
    }>;
    channelHealth: Array<{
      name: string;
      status: string;
      lastUsed?: Date;
    }>;
  };
  private evaluateRules;
  private evaluateRule;
  private triggerAlert;
  private notifyChannels;
  private sendNotification;
  private sendConsoleNotification;
  private sendFileNotification;
  private sendWebhookNotification;
  private sendEmailNotification;
  private checkRateLimit;
  private recordNotification;
  private buildAlertMessage;
  private getMetricValue;
  private evaluateCondition;
  private findActiveAlert;
  private isRuleScheduleActive;
  private checkEscalation;
  private loadDefaultRules;
  private loadDefaultChannels;
  private generateId;
  private getChannelLastUsed;
  private storeRule;
  private storeChannel;
  private storeAlert;
  private updateAlert;
  private initializeAlertingTables;
  private startEvaluation;
  private stopEvaluation;
}
//# sourceMappingURL=AlertingEngine.d.ts.map
