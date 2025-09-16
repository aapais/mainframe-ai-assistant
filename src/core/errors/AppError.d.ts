export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
    static notFound(message?: string): AppError;
    static badRequest(message?: string): AppError;
    static internalServer(message?: string): AppError;
}
export default AppError;
//# sourceMappingURL=AppError.d.ts.map