"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCSchemas = exports.IPCErrorCode = void 0;
const zod_1 = require("zod");
var IPCErrorCode;
(function (IPCErrorCode) {
    IPCErrorCode["INVALID_CHANNEL"] = "IPC_INVALID_CHANNEL";
    IPCErrorCode["VALIDATION_FAILED"] = "IPC_VALIDATION_FAILED";
    IPCErrorCode["RATE_LIMIT_EXCEEDED"] = "IPC_RATE_LIMIT_EXCEEDED";
    IPCErrorCode["MALICIOUS_INPUT"] = "IPC_MALICIOUS_INPUT";
    IPCErrorCode["INSUFFICIENT_PERMISSIONS"] = "IPC_INSUFFICIENT_PERMISSIONS";
    IPCErrorCode["INVALID_REQUEST_FORMAT"] = "IPC_INVALID_REQUEST_FORMAT";
    IPCErrorCode["HANDLER_NOT_FOUND"] = "IPC_HANDLER_NOT_FOUND";
    IPCErrorCode["HANDLER_ERROR"] = "IPC_HANDLER_ERROR";
    IPCErrorCode["DATABASE_ERROR"] = "IPC_DATABASE_ERROR";
    IPCErrorCode["CACHE_ERROR"] = "IPC_CACHE_ERROR";
    IPCErrorCode["EXTERNAL_SERVICE_ERROR"] = "IPC_EXTERNAL_SERVICE_ERROR";
    IPCErrorCode["UNHANDLED_REJECTION"] = "IPC_UNHANDLED_REJECTION";
    IPCErrorCode["TIMEOUT"] = "IPC_TIMEOUT";
    IPCErrorCode["MEMORY_ERROR"] = "IPC_MEMORY_ERROR";
    IPCErrorCode["NETWORK_ERROR"] = "IPC_NETWORK_ERROR";
    IPCErrorCode["ENTRY_NOT_FOUND"] = "KB_ENTRY_NOT_FOUND";
    IPCErrorCode["DUPLICATE_ENTRY"] = "KB_DUPLICATE_ENTRY";
    IPCErrorCode["INVALID_SEARCH_QUERY"] = "KB_INVALID_SEARCH_QUERY";
    IPCErrorCode["TEMPLATE_LOAD_FAILED"] = "KB_TEMPLATE_LOAD_FAILED";
    IPCErrorCode["PATTERN_DETECTION_FAILED"] = "PATTERNS_DETECTION_FAILED";
    IPCErrorCode["INCIDENT_IMPORT_FAILED"] = "PATTERNS_INCIDENT_IMPORT_FAILED";
    IPCErrorCode["EXPORT_FAILED"] = "IO_EXPORT_FAILED";
    IPCErrorCode["IMPORT_FAILED"] = "IO_IMPORT_FAILED";
    IPCErrorCode["FILE_NOT_FOUND"] = "IO_FILE_NOT_FOUND";
    IPCErrorCode["PERMISSION_DENIED"] = "IO_PERMISSION_DENIED";
    IPCErrorCode["AUTHORIZATION_FAILED"] = "AUTH_AUTHORIZATION_FAILED";
    IPCErrorCode["SAVE_FAILED"] = "AUTH_SAVE_FAILED";
    IPCErrorCode["UPDATE_FAILED"] = "AUTH_UPDATE_FAILED";
    IPCErrorCode["COST_ESTIMATION_FAILED"] = "AUTH_COST_ESTIMATION_FAILED";
    IPCErrorCode["AUTO_APPROVAL_CHECK_FAILED"] = "AUTH_AUTO_APPROVAL_CHECK_FAILED";
    IPCErrorCode["STATS_RETRIEVAL_FAILED"] = "AUTH_STATS_RETRIEVAL_FAILED";
    IPCErrorCode["SESSION_CLEAR_FAILED"] = "AUTH_SESSION_CLEAR_FAILED";
    IPCErrorCode["INVALID_REQUEST_DATA"] = "AUTH_INVALID_REQUEST_DATA";
})(IPCErrorCode || (exports.IPCErrorCode = IPCErrorCode = {}));
exports.IPCSchemas = {
    BaseRequest: zod_1.z.object({
        requestId: zod_1.z.string().uuid(),
        timestamp: zod_1.z.number().int().positive(),
        channel: zod_1.z.string().min(1),
        version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/),
        userId: zod_1.z.string().optional()
    }),
    KBSearch: zod_1.z.object({
        query: zod_1.z.string().min(1).max(1000),
        options: zod_1.z.object({
            limit: zod_1.z.number().int().min(1).max(100).optional(),
            offset: zod_1.z.number().int().min(0).optional(),
            categories: zod_1.z.array(zod_1.z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'])).optional(),
            tags: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
            includeArchived: zod_1.z.boolean().optional(),
            sortBy: zod_1.z.enum(['relevance', 'date', 'usage', 'rating']).optional(),
            sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
            minConfidence: zod_1.z.number().min(0).max(1).optional(),
            useSemanticSearch: zod_1.z.boolean().optional()
        }).optional()
    }),
    KBEntryCreate: zod_1.z.object({
        entry: zod_1.z.object({
            title: zod_1.z.string().min(1).max(255),
            problem: zod_1.z.string().min(1).max(10000),
            solution: zod_1.z.string().min(1).max(10000),
            category: zod_1.z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']),
            tags: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional()
        }),
        options: zod_1.z.object({
            validate: zod_1.z.boolean().optional(),
            duplicateCheck: zod_1.z.boolean().optional(),
            autoTags: zod_1.z.boolean().optional(),
            notifyUsers: zod_1.z.boolean().optional()
        }).optional()
    }),
    KBEntryUpdate: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        updates: zod_1.z.object({
            title: zod_1.z.string().min(1).max(255).optional(),
            problem: zod_1.z.string().min(1).max(10000).optional(),
            solution: zod_1.z.string().min(1).max(10000).optional(),
            category: zod_1.z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']).optional(),
            tags: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional()
        }),
        options: zod_1.z.object({
            validate: zod_1.z.boolean().optional(),
            createRevision: zod_1.z.boolean().optional(),
            notifyUsers: zod_1.z.boolean().optional(),
            reason: zod_1.z.string().max(500).optional()
        }).optional()
    }),
    SystemMetrics: zod_1.z.object({
        scope: zod_1.z.enum(['all', 'database', 'cache', 'performance', 'ipc']).optional(),
        timeRange: zod_1.z.object({
            start: zod_1.z.number().int().positive(),
            end: zod_1.z.number().int().positive()
        }).optional(),
        aggregation: zod_1.z.enum(['raw', 'hourly', 'daily']).optional()
    }),
    PatternDetection: zod_1.z.object({
        options: zod_1.z.object({
            timeWindow: zod_1.z.number().int().min(1).max(168).optional(),
            minIncidents: zod_1.z.number().int().min(2).max(100).optional(),
            categories: zod_1.z.array(zod_1.z.string()).optional(),
            confidenceThreshold: zod_1.z.number().min(0).max(1).optional()
        }).optional()
    }),
    EntityId: zod_1.z.object({
        id: zod_1.z.string().uuid()
    }),
    EntityIds: zod_1.z.object({
        ids: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100)
    })
};
//# sourceMappingURL=ipc.js.map