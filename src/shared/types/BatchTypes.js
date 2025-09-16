"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchError = exports.SEARCH_BATCH_CONFIG = exports.DASHBOARD_BATCH_CONFIG = void 0;
exports.DASHBOARD_BATCH_CONFIG = {
    name: 'dashboard-load',
    description: 'Batch all dashboard loading requests into single IPC call',
    maxBatchSize: 10,
    maxWaitTime: 100,
    priority: 'high',
    requests: [
        {
            method: 'system:get-metrics',
            description: 'Database metrics',
            cacheable: true,
            timeout: 1000
        },
        {
            method: 'system:get-performance-metrics',
            description: 'Performance metrics',
            cacheable: true,
            timeout: 1000
        },
        {
            method: 'system:get-health-status',
            description: 'System health',
            cacheable: true,
            timeout: 500
        },
        {
            method: 'kb:get-stats',
            description: 'KB statistics',
            cacheable: true,
            timeout: 800
        },
        {
            method: 'search:get-recent-queries',
            description: 'Recent search queries',
            cacheable: true,
            timeout: 300
        },
        {
            method: 'system:get-storage-info',
            description: 'Storage information',
            cacheable: true,
            timeout: 200
        }
    ]
};
exports.SEARCH_BATCH_CONFIG = {
    name: 'search-operations',
    description: 'Batch search-related requests',
    maxBatchSize: 5,
    maxWaitTime: 50,
    priority: 'high',
    requests: [
        {
            method: 'search:execute',
            description: 'Execute search query',
            cacheable: true,
            timeout: 2000
        },
        {
            method: 'search:get-suggestions',
            description: 'Get search suggestions',
            cacheable: true,
            timeout: 500
        },
        {
            method: 'search:record-query',
            description: 'Record search query',
            cacheable: false,
            timeout: 100
        }
    ]
};
var BatchError;
(function (BatchError) {
    BatchError["BATCH_TIMEOUT"] = "BATCH_TIMEOUT";
    BatchError["BATCH_TOO_LARGE"] = "BATCH_TOO_LARGE";
    BatchError["INVALID_REQUEST"] = "INVALID_REQUEST";
    BatchError["PARTIAL_FAILURE"] = "PARTIAL_FAILURE";
    BatchError["SERIALIZATION_ERROR"] = "SERIALIZATION_ERROR";
    BatchError["HANDLER_NOT_FOUND"] = "HANDLER_NOT_FOUND";
})(BatchError || (exports.BatchError = BatchError = {}));
//# sourceMappingURL=BatchTypes.js.map