export { default as KnowledgeBaseService } from './KnowledgeBaseService';
export { default as ValidationService } from './ValidationService';
export { default as SearchService } from './SearchService';
export { default as CacheService } from './CacheService';
export { default as MetricsService } from './MetricsService';
export { default as ImportExportService } from './ImportExportService';
export { ExportService, ImportService, FormatConverter, DataTransformer, ValidationService as EnhancedValidationService, BatchProcessor, ExportImportServiceFactory } from './storage/export';
export { default as ServiceFactory, getGlobalServiceFactory, setGlobalServiceFactory, resetGlobalServiceFactory } from './ServiceFactory';
export * from '../types/services';
import ServiceFactory from './ServiceFactory';
import { ServiceConfig } from '../types/services';
export declare function initializeProductionServices(configOverrides?: Partial<ServiceConfig>): Promise<ServiceFactory>;
export declare function initializeDevelopmentServices(configOverrides?: Partial<ServiceConfig>): Promise<ServiceFactory>;
export declare function initializeTestServices(configOverrides?: Partial<ServiceConfig>): Promise<ServiceFactory>;
export declare function createMinimalKBService(dbPath?: string): Promise<{
    kbService: import("./KnowledgeBaseService").KnowledgeBaseService;
    validationService: import("./ValidationService").ValidationService;
    searchService: import("./SearchService").SearchService;
    close(): Promise<void>;
}>;
export declare function performHealthCheck(factory: ServiceFactory): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, {
        status: 'healthy' | 'unhealthy';
        responseTime?: number;
        error?: string;
        details?: any;
    }>;
    summary: {
        healthy: number;
        unhealthy: number;
        total: number;
        timestamp: Date;
    };
}>;
export declare function benchmarkServices(factory: ServiceFactory, options?: {
    iterations?: number;
    includeSearch?: boolean;
    includeCRUD?: boolean;
    sampleSize?: number;
}): Promise<{
    results: Record<string, {
        operation: string;
        averageTime: number;
        minTime: number;
        maxTime: number;
        iterations: number;
        throughput: number;
    }>;
    summary: {
        totalTime: number;
        totalOperations: number;
        overallThroughput: number;
    };
}>;
export declare const ServiceUtils: {
    createStandardEntry: (input: {
        title: string;
        problem: string;
        solution: string;
        category: string;
        tags?: string[];
    }) => {
        title: string;
        problem: string;
        solution: string;
        category: any;
        tags: string[];
        created_by: string;
    };
    parseSearchQuery: (query: string) => {
        query: string;
        operators: Record<string, string>;
    };
    formatEntryForDisplay: (entry: any) => {
        id: any;
        title: any;
        category: any;
        tags: any;
        summary: string;
        usage: any;
        successRate: number;
        lastUpdated: any;
    };
    calculateKBStats: (entries: any[]) => {
        totalEntries: number;
        categories: Record<string, number>;
        topTags: [string, number][];
        usage: {
            total: number;
            average: number;
            successRate: number;
        };
    };
};
//# sourceMappingURL=index.d.ts.map