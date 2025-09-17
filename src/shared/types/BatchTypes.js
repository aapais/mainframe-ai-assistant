// Batch Types for IPC communication

export const DASHBOARD_BATCH_CONFIG = {
  maxBatchSize: 10,
  flushInterval: 100,
  maxRetries: 3
};

export const SEARCH_BATCH_CONFIG = {
  maxBatchSize: 5,
  flushInterval: 50,
  maxRetries: 2
};

export class BatchError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'BatchError';
    this.code = code;
    this.details = details;
  }
}

export const BatchConfig = {
  DASHBOARD: DASHBOARD_BATCH_CONFIG,
  SEARCH: SEARCH_BATCH_CONFIG
};

export const BatchResponsePayload = {
  success: (data) => ({ success: true, data }),
  error: (error) => ({ success: false, error })
};