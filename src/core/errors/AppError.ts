export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static notFound(message = 'Not Found'): AppError {
    return new AppError(message, 404, true);
  }

  static badRequest(message = 'Bad Request'): AppError {
    return new AppError(message, 400, true);
  }

  static internalServer(message = 'Internal Server Error'): AppError {
    return new AppError(message, 500, false);
  }
}

export default AppError;
