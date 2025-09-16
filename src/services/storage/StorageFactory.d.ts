import { IStorageAdapter, AdapterType, AdapterConfig } from './adapters/IStorageAdapter';
import { IStoragePlugin } from './IStorageService';
export declare class StorageFactory {
    private static readonly SUPPORTED_ADAPTERS;
    private static readonly SUPPORTED_PLUGINS;
    static createAdapter(type: AdapterType, config: any): IStorageAdapter;
    static getSupportedAdapterTypes(): AdapterType[];
    static isAdapterSupported(type: AdapterType): boolean;
    static getDefaultAdapterConfig(type: AdapterType): Partial<AdapterConfig>;
    static createPlugin(name: string, config?: any): IStoragePlugin;
    static getSupportedPlugins(): string[];
    static isPluginSupported(name: string): boolean;
    static getPluginsForMVP(mvpVersion: number): string[];
    static createMVPPlugins(mvpVersion: number, config?: any): IStoragePlugin[];
    private static createAdapterConfig;
    private static buildConnectionString;
    private static mergeConfigs;
    static validateAdapterConfig(type: AdapterType, config: any): {
        valid: boolean;
        errors: string[];
    };
    static getRecommendedAdapter(environment: 'development' | 'testing' | 'production' | 'memory'): AdapterType;
    static detectBestAdapter(): AdapterType;
    static createAdapterFromEnvironment(): IStorageAdapter;
}
export declare const createStorageAdapter: typeof StorageFactory.createAdapter;
export declare const createStoragePlugin: typeof StorageFactory.createPlugin;
export declare const getSupportedAdapters: typeof StorageFactory.getSupportedAdapterTypes;
export declare const getSupportedPlugins: typeof StorageFactory.getSupportedPlugins;
//# sourceMappingURL=StorageFactory.d.ts.map