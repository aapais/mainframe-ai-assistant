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
  throughputRps?: number; // Records per second
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

export class ProgressTracker extends EventEmitter {
  private state: ProgressState;
  private steps: Map<number, StepProgress> = new Map();
  private throughputSamples: Array<{ timestamp: number; records: number }> = [];
  private updateInterval?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.state = {
      totalSteps: 0,
      currentStep: 0,
      status: 'idle',
      progressPercentage: 0,
      lastUpdateTime: new Date()
    };
  }

  /**
   * Initialize progress tracking
   */
  start(totalSteps: number, totalRecords?: number): void {
    this.state = {
      totalSteps,
      currentStep: 0,
      status: 'running',
      startTime: new Date(),
      progressPercentage: 0,
      processedRecords: 0,
      totalRecords,
      lastUpdateTime: new Date()
    };

    this.steps.clear();
    this.throughputSamples = [];

    // Start periodic updates
    this.updateInterval = setInterval(() => {
      this.updateEstimates();
      this.emit('progress', this.getState());
    }, 1000);

    this.emit('started', this.state);
  }

  /**
   * Update progress for current step
   */
  updateProgress(
    currentStep: number, 
    operation?: string, 
    recordsProcessed?: number
  ): void {
    
    this.state.currentStep = currentStep;
    this.state.currentOperation = operation;
    this.state.progressPercentage = (currentStep / this.state.totalSteps) * 100;
    this.state.lastUpdateTime = new Date();

    if (recordsProcessed !== undefined) {
      this.state.processedRecords = recordsProcessed;
      
      // Update throughput calculation
      this.throughputSamples.push({
        timestamp: Date.now(),
        records: recordsProcessed
      });

      // Keep only last 30 samples for throughput calculation
      if (this.throughputSamples.length > 30) {
        this.throughputSamples.shift();
      }

      this.updateThroughput();
    }

    this.updateEstimates();
    this.emit('progressUpdate', {
      currentStep,
      operation,
      progressPercentage: this.state.progressPercentage,
      recordsProcessed
    });
  }

  /**
   * Start tracking a specific step
   */
  startStep(stepNumber: number, stepName: string, totalRecords?: number): void {
    const step: StepProgress = {
      stepNumber,
      stepName,
      status: 'running',
      startTime: new Date(),
      recordsProcessed: 0
    };

    this.steps.set(stepNumber, step);
    this.updateProgress(stepNumber, stepName);

    this.emit('stepStarted', step);
  }

  /**
   * Complete a step
   */
  completeStep(
    stepNumber: number, 
    recordsProcessed?: number,
    errors?: string[],
    warnings?: string[]
  ): void {
    
    const step = this.steps.get(stepNumber);
    if (step) {
      step.status = 'completed';
      step.endTime = new Date();
      step.duration = step.endTime.getTime() - (step.startTime?.getTime() || 0);
      step.recordsProcessed = recordsProcessed;
      step.errors = errors;
      step.warnings = warnings;

      this.steps.set(stepNumber, step);
    }

    this.emit('stepCompleted', step);
  }

  /**
   * Mark a step as failed
   */
  failStep(stepNumber: number, errors: string[]): void {
    const step = this.steps.get(stepNumber);
    if (step) {
      step.status = 'failed';
      step.endTime = new Date();
      step.duration = step.endTime.getTime() - (step.startTime?.getTime() || 0);
      step.errors = errors;

      this.steps.set(stepNumber, step);
    }

    this.state.status = 'failed';
    this.emit('stepFailed', step);
  }

  /**
   * Skip a step
   */
  skipStep(stepNumber: number, reason?: string): void {
    const step = this.steps.get(stepNumber);
    if (step) {
      step.status = 'skipped';
      step.endTime = new Date();
      step.warnings = reason ? [reason] : [];

      this.steps.set(stepNumber, step);
    }

    this.emit('stepSkipped', { step, reason });
  }

  /**
   * Pause progress tracking
   */
  pause(): void {
    this.state.status = 'paused';
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.emit('paused', this.state);
  }

  /**
   * Resume progress tracking
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
      
      // Restart periodic updates
      this.updateInterval = setInterval(() => {
        this.updateEstimates();
        this.emit('progress', this.getState());
      }, 1000);

      this.emit('resumed', this.state);
    }
  }

  /**
   * Finish progress tracking
   */
  finish(success: boolean = true): void {
    this.state.status = success ? 'completed' : 'failed';
    this.state.endTime = new Date();
    this.state.progressPercentage = success ? 100 : this.state.progressPercentage;
    this.state.currentStep = success ? this.state.totalSteps : this.state.currentStep;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.emit('finished', {
      success,
      totalDuration: this.getTotalDuration(),
      finalState: this.state
    });
  }

  /**
   * Get current progress state
   */
  getState(): ProgressState {
    return { ...this.state };
  }

  /**
   * Get detailed step information
   */
  getStepDetails(): StepProgress[] {
    return Array.from(this.steps.values())
      .sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
   * Get progress summary
   */
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
  } {
    
    const steps = Array.from(this.steps.values());
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    const skippedSteps = steps.filter(s => s.status === 'skipped').length;

    // Calculate average step duration
    const completedStepsWithDuration = steps.filter(s => s.status === 'completed' && s.duration);
    const averageStepDuration = completedStepsWithDuration.length > 0
      ? completedStepsWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) / completedStepsWithDuration.length
      : undefined;

    return {
      totalSteps: this.state.totalSteps,
      completedSteps,
      failedSteps,
      skippedSteps,
      progressPercentage: this.state.progressPercentage,
      totalDuration: this.getTotalDuration(),
      estimatedTimeRemaining: this.state.estimatedTimeRemaining,
      averageStepDuration,
      throughputRps: this.state.throughputRps
    };
  }

  /**
   * Export progress data for analysis
   */
  exportProgressData(): {
    state: ProgressState;
    steps: StepProgress[];
    throughputHistory: Array<{ timestamp: number; records: number; rps: number }>;
    timeline: Array<{
      timestamp: number;
      event: string;
      details: any;
    }>;
  } {
    
    const throughputHistory = this.calculateThroughputHistory();
    
    return {
      state: this.getState(),
      steps: this.getStepDetails(),
      throughputHistory,
      timeline: [] // Could be populated with event history if needed
    };
  }

  /**
   * Reset progress tracker
   */
  reset(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.state = {
      totalSteps: 0,
      currentStep: 0,
      status: 'idle',
      progressPercentage: 0,
      lastUpdateTime: new Date()
    };

    this.steps.clear();
    this.throughputSamples = [];

    this.emit('reset');
  }

  // Private methods

  private updateEstimates(): void {
    if (this.state.status !== 'running' || !this.state.startTime) {
      return;
    }

    const elapsed = Date.now() - this.state.startTime.getTime();
    const progress = this.state.progressPercentage / 100;

    if (progress > 0 && progress < 1) {
      // Estimate based on current progress rate
      const totalEstimatedTime = elapsed / progress;
      this.state.estimatedTimeRemaining = Math.round(totalEstimatedTime - elapsed);
    }

    // Update based on step completion if available
    const completedSteps = Array.from(this.steps.values()).filter(s => s.status === 'completed');
    if (completedSteps.length > 0 && this.state.currentStep > 0) {
      const avgStepTime = completedSteps.reduce((sum, step) => sum + (step.duration || 0), 0) / completedSteps.length;
      const remainingSteps = this.state.totalSteps - this.state.currentStep;
      const stepBasedEstimate = remainingSteps * avgStepTime;
      
      // Use the more conservative estimate
      if (this.state.estimatedTimeRemaining) {
        this.state.estimatedTimeRemaining = Math.max(this.state.estimatedTimeRemaining, stepBasedEstimate);
      } else {
        this.state.estimatedTimeRemaining = stepBasedEstimate;
      }
    }
  }

  private updateThroughput(): void {
    if (this.throughputSamples.length < 2) {
      return;
    }

    const recent = this.throughputSamples.slice(-10); // Use last 10 samples
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const recordsSpan = recent[recent.length - 1].records - recent[0].records;

    if (timeSpan > 0) {
      this.state.throughputRps = (recordsSpan / timeSpan) * 1000; // Convert to per second
    }
  }

  private getTotalDuration(): number | undefined {
    if (!this.state.startTime) {
      return undefined;
    }

    const endTime = this.state.endTime || new Date();
    return endTime.getTime() - this.state.startTime.getTime();
  }

  private calculateThroughputHistory(): Array<{ timestamp: number; records: number; rps: number }> {
    const history: Array<{ timestamp: number; records: number; rps: number }> = [];

    for (let i = 1; i < this.throughputSamples.length; i++) {
      const current = this.throughputSamples[i];
      const previous = this.throughputSamples[i - 1];
      
      const timeSpan = current.timestamp - previous.timestamp;
      const recordsSpan = current.records - previous.records;
      const rps = timeSpan > 0 ? (recordsSpan / timeSpan) * 1000 : 0;

      history.push({
        timestamp: current.timestamp,
        records: current.records,
        rps
      });
    }

    return history;
  }

  /**
   * Create a formatted progress bar string
   */
  getProgressBar(width: number = 50): string {
    const filled = Math.round((this.state.progressPercentage / 100) * width);
    const empty = width - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
    
    return `[${bar}] ${this.state.progressPercentage.toFixed(1)}%`;
  }

  /**
   * Get human-readable time estimate
   */
  getTimeEstimate(): string {
    if (!this.state.estimatedTimeRemaining) {
      return 'Unknown';
    }

    const seconds = Math.round(this.state.estimatedTimeRemaining / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.round(seconds / 3600);
      const remainingMinutes = Math.round((seconds % 3600) / 60);
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Get formatted throughput string
   */
  getThroughputString(): string {
    if (!this.state.throughputRps) {
      return 'Unknown';
    }

    const rps = this.state.throughputRps;
    
    if (rps < 1) {
      return `${(rps * 60).toFixed(1)}/min`;
    } else if (rps < 1000) {
      return `${rps.toFixed(1)}/sec`;
    } else {
      return `${(rps / 1000).toFixed(1)}K/sec`;
    }
  }

  /**
   * Create a detailed progress report
   */
  createProgressReport(): string {
    const summary = this.getSummary();
    const state = this.getState();
    
    let report = '\n=== Migration Progress Report ===\n\n';
    report += `Status: ${state.status.toUpperCase()}\n`;
    report += `Progress: ${this.getProgressBar()} (${state.currentStep}/${state.totalSteps} steps)\n`;
    
    if (state.currentOperation) {
      report += `Current Operation: ${state.currentOperation}\n`;
    }
    
    if (state.estimatedTimeRemaining && state.status === 'running') {
      report += `Estimated Time Remaining: ${this.getTimeEstimate()}\n`;
    }
    
    if (state.throughputRps) {
      report += `Throughput: ${this.getThroughputString()}\n`;
    }
    
    if (state.processedRecords && state.totalRecords) {
      report += `Records: ${state.processedRecords.toLocaleString()} / ${state.totalRecords.toLocaleString()}\n`;
    }
    
    const duration = this.getTotalDuration();
    if (duration) {
      report += `Duration: ${Math.round(duration / 1000)}s\n`;
    }
    
    report += '\n=== Step Details ===\n';
    const steps = this.getStepDetails();
    
    for (const step of steps) {
      const status = step.status.padEnd(10);
      const name = step.stepName.padEnd(30);
      const duration = step.duration ? `${Math.round(step.duration / 1000)}s` : '-';
      
      report += `${step.stepNumber}. [${status}] ${name} ${duration}\n`;
      
      if (step.errors && step.errors.length > 0) {
        report += `    Errors: ${step.errors.join(', ')}\n`;
      }
      
      if (step.warnings && step.warnings.length > 0) {
        report += `    Warnings: ${step.warnings.join(', ')}\n`;
      }
    }
    
    report += '\n' + '='.repeat(50) + '\n';
    
    return report;
  }
}