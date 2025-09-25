'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ProgressTracker = void 0;
const events_1 = require('events');
class ProgressTracker extends events_1.EventEmitter {
  state;
  steps = new Map();
  throughputSamples = [];
  updateInterval;
  constructor() {
    super();
    this.state = {
      totalSteps: 0,
      currentStep: 0,
      status: 'idle',
      progressPercentage: 0,
      lastUpdateTime: new Date(),
    };
  }
  start(totalSteps, totalRecords) {
    this.state = {
      totalSteps,
      currentStep: 0,
      status: 'running',
      startTime: new Date(),
      progressPercentage: 0,
      processedRecords: 0,
      totalRecords,
      lastUpdateTime: new Date(),
    };
    this.steps.clear();
    this.throughputSamples = [];
    this.updateInterval = setInterval(() => {
      this.updateEstimates();
      this.emit('progress', this.getState());
    }, 1000);
    this.emit('started', this.state);
  }
  updateProgress(currentStep, operation, recordsProcessed) {
    this.state.currentStep = currentStep;
    this.state.currentOperation = operation;
    this.state.progressPercentage = (currentStep / this.state.totalSteps) * 100;
    this.state.lastUpdateTime = new Date();
    if (recordsProcessed !== undefined) {
      this.state.processedRecords = recordsProcessed;
      this.throughputSamples.push({
        timestamp: Date.now(),
        records: recordsProcessed,
      });
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
      recordsProcessed,
    });
  }
  startStep(stepNumber, stepName, totalRecords) {
    const step = {
      stepNumber,
      stepName,
      status: 'running',
      startTime: new Date(),
      recordsProcessed: 0,
    };
    this.steps.set(stepNumber, step);
    this.updateProgress(stepNumber, stepName);
    this.emit('stepStarted', step);
  }
  completeStep(stepNumber, recordsProcessed, errors, warnings) {
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
  failStep(stepNumber, errors) {
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
  skipStep(stepNumber, reason) {
    const step = this.steps.get(stepNumber);
    if (step) {
      step.status = 'skipped';
      step.endTime = new Date();
      step.warnings = reason ? [reason] : [];
      this.steps.set(stepNumber, step);
    }
    this.emit('stepSkipped', { step, reason });
  }
  pause() {
    this.state.status = 'paused';
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.emit('paused', this.state);
  }
  resume() {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
      this.updateInterval = setInterval(() => {
        this.updateEstimates();
        this.emit('progress', this.getState());
      }, 1000);
      this.emit('resumed', this.state);
    }
  }
  finish(success = true) {
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
      finalState: this.state,
    });
  }
  getState() {
    return { ...this.state };
  }
  getStepDetails() {
    return Array.from(this.steps.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }
  getSummary() {
    const steps = Array.from(this.steps.values());
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    const skippedSteps = steps.filter(s => s.status === 'skipped').length;
    const completedStepsWithDuration = steps.filter(s => s.status === 'completed' && s.duration);
    const averageStepDuration =
      completedStepsWithDuration.length > 0
        ? completedStepsWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) /
          completedStepsWithDuration.length
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
      throughputRps: this.state.throughputRps,
    };
  }
  exportProgressData() {
    const throughputHistory = this.calculateThroughputHistory();
    return {
      state: this.getState(),
      steps: this.getStepDetails(),
      throughputHistory,
      timeline: [],
    };
  }
  reset() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.state = {
      totalSteps: 0,
      currentStep: 0,
      status: 'idle',
      progressPercentage: 0,
      lastUpdateTime: new Date(),
    };
    this.steps.clear();
    this.throughputSamples = [];
    this.emit('reset');
  }
  updateEstimates() {
    if (this.state.status !== 'running' || !this.state.startTime) {
      return;
    }
    const elapsed = Date.now() - this.state.startTime.getTime();
    const progress = this.state.progressPercentage / 100;
    if (progress > 0 && progress < 1) {
      const totalEstimatedTime = elapsed / progress;
      this.state.estimatedTimeRemaining = Math.round(totalEstimatedTime - elapsed);
    }
    const completedSteps = Array.from(this.steps.values()).filter(s => s.status === 'completed');
    if (completedSteps.length > 0 && this.state.currentStep > 0) {
      const avgStepTime =
        completedSteps.reduce((sum, step) => sum + (step.duration || 0), 0) / completedSteps.length;
      const remainingSteps = this.state.totalSteps - this.state.currentStep;
      const stepBasedEstimate = remainingSteps * avgStepTime;
      if (this.state.estimatedTimeRemaining) {
        this.state.estimatedTimeRemaining = Math.max(
          this.state.estimatedTimeRemaining,
          stepBasedEstimate
        );
      } else {
        this.state.estimatedTimeRemaining = stepBasedEstimate;
      }
    }
  }
  updateThroughput() {
    if (this.throughputSamples.length < 2) {
      return;
    }
    const recent = this.throughputSamples.slice(-10);
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const recordsSpan = recent[recent.length - 1].records - recent[0].records;
    if (timeSpan > 0) {
      this.state.throughputRps = (recordsSpan / timeSpan) * 1000;
    }
  }
  getTotalDuration() {
    if (!this.state.startTime) {
      return undefined;
    }
    const endTime = this.state.endTime || new Date();
    return endTime.getTime() - this.state.startTime.getTime();
  }
  calculateThroughputHistory() {
    const history = [];
    for (let i = 1; i < this.throughputSamples.length; i++) {
      const current = this.throughputSamples[i];
      const previous = this.throughputSamples[i - 1];
      const timeSpan = current.timestamp - previous.timestamp;
      const recordsSpan = current.records - previous.records;
      const rps = timeSpan > 0 ? (recordsSpan / timeSpan) * 1000 : 0;
      history.push({
        timestamp: current.timestamp,
        records: current.records,
        rps,
      });
    }
    return history;
  }
  getProgressBar(width = 50) {
    const filled = Math.round((this.state.progressPercentage / 100) * width);
    const empty = width - filled;
    const filledChar = '█';
    const emptyChar = '░';
    const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
    return `[${bar}] ${this.state.progressPercentage.toFixed(1)}%`;
  }
  getTimeEstimate() {
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
  getThroughputString() {
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
  createProgressReport() {
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
    report += `\n${'='.repeat(50)}\n`;
    return report;
  }
}
exports.ProgressTracker = ProgressTracker;
//# sourceMappingURL=ProgressTracker.js.map
