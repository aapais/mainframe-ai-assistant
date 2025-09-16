export type SupportedFormat = 'json' | 'csv' | 'xml' | 'parquet' | 'avro' | 'orc';
export interface ConversionOptions {
    schema?: any;
    compression?: 'gzip' | 'brotli' | 'none';
    encoding?: string;
    streaming?: boolean;
    customHeaders?: Record<string, string>;
    onProgress?: (progress: number) => void;
    batchSize?: number;
}
export interface ParseOptions {
    encoding?: string;
    schema?: any;
    strictMode?: boolean;
    delimiter?: string;
    quote?: string;
    escape?: string;
}
export interface FormatCapabilities {
    supportsStreaming: boolean;
    supportsCompression: boolean;
    supportsSchema: boolean;
    maxFileSize?: number;
    binaryFormat: boolean;
}
export declare class FormatConverter {
    private capabilities;
    convert(data: any[], targetFormat: SupportedFormat, options?: ConversionOptions): Promise<string | Buffer>;
    parse(data: string | Buffer, sourceFormat: SupportedFormat, options?: ParseOptions): Promise<any[]>;
    parseChunk(chunk: any, format: SupportedFormat): Promise<any[]>;
    getSupportedFormats(): SupportedFormat[];
    supportsCompression(format: SupportedFormat): boolean;
    supportsStreaming(format: SupportedFormat): boolean;
    supportsSchema(format: SupportedFormat): boolean;
    validateConversion(sourceFormat: SupportedFormat, targetFormat: SupportedFormat, dataSize: number): {
        compatible: boolean;
        warnings: string[];
        limitations: string[];
    };
    private convertToJSON;
    private convertToCSV;
    private convertToXML;
    private convertToParquet;
    private convertToAvro;
    private convertToORC;
    private parseJSON;
    private parseCSV;
    private parseXML;
    private parseParquet;
    private parseAvro;
    private parseORC;
    private parseParquetChunk;
    private parseAvroChunk;
    private parseORCChunk;
    private flattenObject;
    private sanitizeForXML;
    private applyCompression;
    private decompress;
    private isCompressed;
}
export default FormatConverter;
//# sourceMappingURL=FormatConverter.d.ts.map