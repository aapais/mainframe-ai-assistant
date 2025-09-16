import { EventEmitter } from 'events';
export interface ProgressState {
    totalSteps: number;
    currentStep: number;
    currentOperation?: string;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
    startTime?: Date;
    endTime?: Date;
    estimatedTimeRemaining?: number;
    progressPercentage: number;
    throughputRps?: number;
    processedRecords?: number;
    totalRecords?: number;
    lastUpdateTime: Date;
}
export interface StepProgress {
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    recordsProcessed?: number;
    errors?: string[];
    warnings?: string[];
}
export declare class ProgressTracker extends EventEmitter {
    private state;
    private steps;
    private throughputSamples;
    private updateInterval?;
    constructor();
    start(totalSteps: number, totalRecords?: number): void;
    updateProgress(currentStep: number, operation?: string, recordsProcessed?: number): void;
    startStep(stepNumber: number, stepName: string, totalRecords?: number): void;
    completeStep(stepNumber: number, recordsProcessed?: number, errors?: string[], warnings?: string[]): void;
    failStep(stepNumber: number, errors: string[]): void;
    skipStep(stepNumber: number, reason?: string): void;
    pause(): void;
    resume(): void;
    finish(success?: boolean): void;
    getState(): ProgressState;
    getStepDetails(): StepProgress[];
    getSummary(): {
        totalSteps: number;
        completedSteps: number;
        failedSteps: number;
        skippedSteps: number;
        progressPercentage: number;
        totalDuration?: number;
        estimatedTimeRemaining?: number;
        averageStepDuration?: number;
        throughputRps?: number;
    };
    exportProgressData(): {
        state: ProgressState;
        steps: StepProgress[];
        throughputHistory: Array<{
            timestamp: number;
            records: number;
            rps: number;
        }>;
        timeline: Array<{
            timestamp: number;
            event: string;
            details: any;
        }>;
    };
    reset(): void;
    private updateEstimates;
    private updateThroughput;
    private getTotalDuration;
    private calculateThroughputHistory;
    getProgressBar(width?: number): string;
    getTimeEstimate(): string;
    getThroughputString(): string;
    createProgressReport(): string;
}
//# sourceMappingURL=ProgressTracker.d.ts.map