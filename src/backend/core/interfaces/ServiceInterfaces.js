'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.OperationResult =
  exports.ConflictError =
  exports.NotFoundError =
  exports.ValidationError =
  exports.ServiceError =
  exports.BaseError =
    void 0;
class BaseError extends Error {
  timestamp;
  metadata;
  operationId;
  constructor(message, metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.metadata = metadata;
    this.operationId = metadata.operationId;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.BaseError = BaseError;
class ServiceError extends BaseError {
  code = 'SERVICE_ERROR';
  statusCode = 500;
}
exports.ServiceError = ServiceError;
class ValidationError extends BaseError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
}
exports.ValidationError = ValidationError;
class NotFoundError extends BaseError {
  code = 'NOT_FOUND';
  statusCode = 404;
}
exports.NotFoundError = NotFoundError;
class ConflictError extends BaseError {
  code = 'CONFLICT';
  statusCode = 409;
}
exports.ConflictError = ConflictError;
class OperationResult {
  static success(data, metadata) {
    return { success: true, data, metadata };
  }
  static failure(error) {
    return { success: false, error };
  }
}
exports.OperationResult = OperationResult;
//# sourceMappingURL=ServiceInterfaces.js.map
