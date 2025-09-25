import { EventEmitter } from 'events';
import { IStoragePlugin, PluginConfig, PluginMetadata, PluginStatus } from '../IStorageService';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
export declare abstract class BaseStoragePlugin extends EventEmitter implements IStoragePlugin {
  protected adapter: IStorageAdapter;
  protected config: PluginConfig;
  protected metadata: PluginMetadata;
  protected status: PluginStatus;
  protected errorCount: number;
  protected maxErrors: number;
  constructor(adapter: IStorageAdapter, config?: PluginConfig);
  abstract getName(): string;
  abstract getVersion(): string;
  abstract getDescription(): string;
  abstract getMVPVersion(): number;
  abstract getDependencies(): string[];
  protected abstract initializePlugin(): Promise<void>;
  protected abstract cleanupPlugin(): Promise<void>;
  abstract processData(data: any, context?: any): Promise<any>;
  protected abstract getDefaultConfig(): PluginConfig;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isActive(): boolean;
  getStatus(): PluginStatus;
  getConfig(): PluginConfig;
  updateConfig(newConfig: Partial<PluginConfig>): Promise<void>;
  getMetadata(): PluginMetadata;
  process(data: any, context?: any): Promise<any>;
  healthCheck(): Promise<{
    healthy: boolean;
    details: any;
  }>;
  getMetrics(): any;
  protected mergeWithDefaults(userConfig: PluginConfig): PluginConfig;
  protected initializeMetadata(): PluginMetadata;
  protected validateConfiguration(): void;
  protected isConfigurationValid(): boolean;
  protected validateDependencies(): Promise<void>;
  protected checkDependencies(): Promise<boolean>;
  protected checkDependency(dependency: string): Promise<boolean>;
  protected handleError(error: Error): void;
  protected getDataSize(data: any): number;
  protected executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T>;
  protected validateInput(data: any, schema?: any): boolean;
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void;
}
//# sourceMappingURL=BaseStoragePlugin.d.ts.map
