"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
    static notFound(message = 'Not Found') {
        return new AppError(message, 404, true);
    }
    static badRequest(message = 'Bad Request') {
        return new AppError(message, 400, true);
    }
    static internalServer(message = 'Internal Server Error') {
        return new AppError(message, 500, false);
    }
}
exports.AppError = AppError;
exports.default = AppError;
//# sourceMappingURL=AppError.js.map