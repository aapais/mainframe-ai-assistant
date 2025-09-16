import { EventEmitter } from 'events';
import { OptimizationEngine, OptimizationRecommendation } from './OptimizationEngine';
export interface DashboardWidget {
    id: string;
    title: string;
    type: 'metric' | 'chart' | 'table' | 'alert' | 'progress' | 'heatmap';
    size: 'small' | 'medium' | 'large' | 'full';
    priority: number;
    data: any;
    refreshInterval: number;
    lastUpdated: number;
    configuration: Record<string, any>;
}
export interface DashboardAlert {
    id: string;
    timestamp: number;
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    category: string;
    acknowledged: boolean;
    autoResolve: boolean;
    metadata: Record<string, any>;
}
export interface OptimizationInsight {
    id: string;
    timestamp: number;
    type: 'trend' | 'pattern' | 'anomaly' | 'opportunity' | 'prediction';
    title: string;
    description: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    data: any;
    actionable: boolean;
    relatedRecommendations: string[];
}
export interface PerformanceReport {
    id: string;
    timestamp: number;
    period: string;
    summary: {
        totalOptimizations: number;
        successfulOptimizations: number;
        averageImprovement: number;
        totalROI: number;
        costSavings: number;
    };
    categoryBreakdown: Record<string, any>;
    trendAnalysis: any;
    topRecommendations: OptimizationRecommendation[];
    insights: OptimizationInsight[];
    futureProjections: any;
}
export declare class OptimizationDashboard extends EventEmitter {
    private optimizationEngine;
    private widgets;
    private alerts;
    private insights;
    private reports;
    private updateIntervals;
    private metricsHistory;
    constructor(optimizationEngine: OptimizationEngine);
    initialize(): Promise<void>;
    getDashboardConfig(): any;
    getDashboardSummary(): any;
    createWidget(widget: Partial<DashboardWidget>): DashboardWidget;
    updateWidget(widgetId: string, data: any): boolean;
    createAlert(alert: Partial<DashboardAlert>): DashboardAlert;
    acknowledgeAlert(alertId: string): boolean;
    resolveAlert(alertId: string): boolean;
    generateInsights(): Promise<OptimizationInsight[]>;
    generatePerformanceReport(period?: string): Promise<PerformanceReport>;
    getWidget(widgetId: string): DashboardWidget | undefined;
    getAlerts(includeAcknowledged?: boolean): DashboardAlert[];
    getInsights(type?: string): OptimizationInsight[];
    getReports(limit?: number): PerformanceReport[];
    private setupEngineEventHandlers;
    private createDefaultWidgets;
    private setupWidgetRefresh;
    private refreshWidget;
    private calculateSystemHealth;
    private calculateOptimizationVelocity;
    private calculateCostSavings;
    private calculateAverageImprovement;
    private calculateTotalROI;
    private generateCategoryBreakdown;
    private generateTrendAnalysis;
    private generateFutureProjections;
    private analyzeCategoryPatterns;
    private predictPerformanceTrend;
    private projectFutureImpact;
    private identifyRiskFactors;
    private updatePerformanceMetrics;
    private generateRealtimeInsights;
    private startDashboardMonitoring;
    private cleanupOldInsights;
    private cleanupOldAlerts;
    destroy(): Promise<void>;
}
export default OptimizationDashboard;
//# sourceMappingURL=OptimizationDashboard.d.ts.map