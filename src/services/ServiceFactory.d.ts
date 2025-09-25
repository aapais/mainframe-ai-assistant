import {
  IKnowledgeBaseService,
  IValidationService,
  ISearchService,
  ICacheService,
  IMetricsService,
  IImportExportService,
  ServiceConfig,
} from '../types/services';
interface ServiceInstances {
  knowledgeBaseService?: IKnowledgeBaseService;
  validationService?: IValidationService;
  searchService?: ISearchService;
  cacheService?: ICacheService;
  metricsService?: IMetricsService;
  importExportService?: IImportExportService;
}
export declare class ServiceFactory {
  private config;
  private instances;
  private initialized;
  private initializationPromise?;
  private dependencies;
  constructor(config?: ServiceConfig);
  initialize(): Promise<void>;
  getKnowledgeBaseService(): IKnowledgeBaseService;
  getValidationService(): IValidationService;
  getSearchService(): ISearchService;
  getCacheService(): ICacheService;
  getMetricsService(): IMetricsService;
  getImportExportService(): IImportExportService;
  getAllServices(): ServiceInstances;
  healthCheck(): Promise<{
    healthy: boolean;
    services: Record<
      string,
      {
        healthy: boolean;
        error?: string;
      }
    >;
  }>;
  close(): Promise<void>;
  restartService(serviceName: keyof ServiceInstances): Promise<void>;
  updateConfiguration(newConfig: Partial<ServiceConfig>): void;
  getConfiguration(): ServiceConfig;
  registerCustomService<T extends keyof ServiceInstances>(
    serviceName: T,
    serviceInstance: ServiceInstances[T]
  ): void;
  private doInitialize;
  private initializeService;
  static createProductionFactory(overrides?: Partial<ServiceConfig>): ServiceFactory;
  static createDevelopmentFactory(overrides?: Partial<ServiceConfig>): ServiceFactory;
  static createTestFactory(overrides?: Partial<ServiceConfig>): ServiceFactory;
}
export default ServiceFactory;
export declare function getGlobalServiceFactory(): ServiceFactory;
export declare function setGlobalServiceFactory(factory: ServiceFactory): void;
export declare function resetGlobalServiceFactory(): void;
//# sourceMappingURL=ServiceFactory.d.ts.map
