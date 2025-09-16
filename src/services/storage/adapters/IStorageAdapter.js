"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaError = exports.TransactionError = exports.QueryError = exports.ConnectionError = exports.AdapterError = void 0;
class AdapterError extends Error {
    code;
    adapterType;
    details;
    constructor(message, code, adapterType, details) {
        super(message);
        this.code = code;
        this.adapterType = adapterType;
        this.details = details;
        this.name = 'AdapterError';
    }
}
exports.AdapterError = AdapterError;
class ConnectionError extends AdapterError {
    constructor(message, adapterType, details) {
        super(message, 'CONNECTION_ERROR', adapterType, details);
        this.name = 'ConnectionError';
    }
}
exports.ConnectionError = ConnectionError;
class QueryError extends AdapterError {
    constructor(message, adapterType, sql, details) {
        super(message, 'QUERY_ERROR', adapterType, { sql, ...details });
        this.name = 'QueryError';
    }
}
exports.QueryError = QueryError;
class TransactionError extends AdapterError {
    constructor(message, adapterType, details) {
        super(message, 'TRANSACTION_ERROR', adapterType, details);
        this.name = 'TransactionError';
    }
}
exports.TransactionError = TransactionError;
class SchemaError extends AdapterError {
    constructor(message, adapterType, details) {
        super(message, 'SCHEMA_ERROR', adapterType, details);
        this.name = 'SchemaError';
    }
}
exports.SchemaError = SchemaError;
//# sourceMappingURL=IStorageAdapter.js.map