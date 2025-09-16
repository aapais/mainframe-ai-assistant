import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
export interface AlertRule {
    id: string;
    name: string;
    description?: string;
    dataSource: string;
    isActive: boolean;
    condition: AlertCondition;
    thresholds: AlertThreshold[];
    notifications: AlertNotification[];
    schedule: AlertSchedule;
    suppressions?: AlertSuppression[];
    createdBy: string;
    createdAt: Date;
    lastTriggered?: Date;
    triggerCount: number;
    metadata: Record<string, any>;
}
export interface AlertCondition {
    type: 'threshold' | 'trend' | 'anomaly' | 'missing_data' | 'custom';
    metric: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
    timeWindow?: number;
    comparison?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'between';
    value?: number | string;
    customExpression?: string;
    filters?: Record<string, any>;
}
export interface AlertThreshold {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    condition: AlertCondition;
    message: string;
    escalationDelay?: number;
    autoResolve?: boolean;
    actions?: AlertAction[];
}
export interface AlertNotification {
    type: 'email' | 'webhook' | 'slack' | 'teams' | 'sms' | 'push';
    recipients: string[];
    template?: string;
    throttling?: NotificationThrottling;
    customFields?: Record<string, any>;
}
export interface NotificationThrottling {
    enabled: boolean;
    intervalMinutes: number;
    maxNotificationsPerInterval: number;
    escalationRules?: EscalationRule[];
}
export interface EscalationRule {
    afterMinutes: number;
    additionalRecipients: string[];
    changeNotificationType?: string;
}
export interface AlertSchedule {
    timezone: string;
    activeHours?: TimeRange;
    activeDays?: number[];
    excludedDates?: Date[];
    quietHours?: TimeRange;
}
export interface TimeRange {
    start: string;
    end: string;
}
export interface AlertSuppression {
    reason: string;
    startTime: Date;
    endTime?: Date;
    suppressionRules?: SuppressionRule[];
}
export interface SuppressionRule {
    field: string;
    operator: 'eq' | 'ne' | 'contains' | 'regex';
    value: string;
}
export interface AlertAction {
    type: 'script' | 'webhook' | 'api_call' | 'restart_service' | 'scale_resource';
    parameters: Record<string, any>;
    retryPolicy?: ActionRetryPolicy;
}
export interface ActionRetryPolicy {
    maxRetries: number;
    retryDelaySeconds: number;
    backoffMultiplier?: number;
}
export interface AlertEvent {
    id: string;
    ruleId: string;
    severity: string;
    status: 'triggered' | 'resolved' | 'acknowledged' | 'suppressed';
    message: string;
    triggeredAt: Date;
    resolvedAt?: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    actualValue: any;
    thresholdValue: any;
    context: Record<string, any>;
    notifications: NotificationHistory[];
    actions: ActionHistory[];
}
export interface NotificationHistory {
    id: string;
    type: string;
    recipients: string[];
    sentAt: Date;
    status: 'sent' | 'failed' | 'throttled';
    error?: string;
    deliveryTime?: number;
}
export interface ActionHistory {
    id: string;
    type: string;
    executedAt: Date;
    status: 'success' | 'failed' | 'retrying';
    result?: any;
    error?: string;
    retryCount: number;
}
export interface AlertMetrics {
    totalRules: number;
    activeRules: number;
    triggeredAlertsLast24h: number;
    resolvedAlertsLast24h: number;
    averageResolutionTime: number;
    topTriggeredRules: Array<{
        ruleId: string;
        name: string;
        count: number;
    }>;
    alertsByseverity: Record<string, number>;
    notificationSuccessRate: number;
}
export declare class AlertManager extends EventEmitter {
    private readonly logger;
    private readonly alertRules;
    private readonly activeAlerts;
    private readonly alertHistory;
    private readonly notificationThrottleState;
    private readonly evaluationTimer?;
    private readonly evaluationIntervalMs;
    private readonly maxHistoryPerRule;
    private isRunning;
    constructor(logger: Logger, evaluationIntervalMs?: number, maxHistoryPerRule?: number);
    start(): void;
    stop(): void;
    private scheduleEvaluation;
    createAlertRule(name: string, dataSource: string, condition: AlertCondition, thresholds: AlertThreshold[], notifications: AlertNotification[], schedule: AlertSchedule, createdBy: string, description?: string, suppressions?: AlertSuppression[]): AlertRule;
    getAlertRule(id: string): AlertRule | null;
    listAlertRules(activeOnly?: boolean): AlertRule[];
    updateAlertRule(id: string, updates: Partial<AlertRule>): AlertRule | null;
    deleteAlertRule(id: string): boolean;
    activateAlertRule(id: string): boolean;
    deactivateAlertRule(id: string): boolean;
    private evaluateAlertRules;
    private shouldEvaluateRule;
    private isActiveSuppressionTime;
    private evaluateRule;
    private fetchDataForRule;
    private evaluateCondition;
    private evaluateThresholdCondition;
    private evaluateTrendCondition;
    private evaluateAnomalyCondition;
    private evaluateMissingDataCondition;
    private evaluateCustomCondition;
    private extractMetricValue;
    private evaluateThreshold;
    private triggerAlert;
    private findActiveAlert;
    private formatAlertMessage;
    private checkAlertResolution;
    private resolveAlert;
    private sendAlertNotifications;
    private sendResolutionNotifications;
    private isNotificationThrottled;
    private updateNotificationThrottleState;
    private sendNotification;
    private sendEmailAlert;
    private sendWebhookAlert;
    private sendSlackAlert;
    private executeAlertActions;
    private executeAction;
    private executeScript;
    private callWebhook;
    private resolveActiveAlertsForRule;
    private addToHistory;
    private generateId;
    getActiveAlerts(ruleId?: string): AlertEvent[];
    getAlertHistory(ruleId: string, limit?: number): AlertEvent[];
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean;
    manualResolveAlert(alertId: string): boolean;
    getMetrics(): AlertMetrics;
    private getTopTriggeredRules;
}
//# sourceMappingURL=AlertManager.d.ts.map