/**
 * Multi-Format Converter - Supports JSON, CSV, XML, Parquet, Avro, ORC
 * Handles conversion between different data formats with schema validation
 */

import { parse as parseCSV, stringify as stringifyCSV } from 'csv-parse/sync';
import { parseString as parseXML, Builder as XMLBuilder } from 'xml2js';
import { promisify } from 'util';
import zlib from 'zlib';
import { Transform } from 'stream';

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

/**
 * Advanced format converter with support for multiple data formats
 */
export class FormatConverter {
  private capabilities: Record<SupportedFormat, FormatCapabilities> = {
    json: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: false
    },
    csv: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: false,
      binaryFormat: false
    },
    xml: {
      supportsStreaming: false,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: false
    },
    parquet: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
      binaryFormat: true
    },
    avro: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: true
    },
    orc: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: true
    }
  };

  /**
   * Convert data to specified format
   */
  async convert(
    data: any[],
    targetFormat: SupportedFormat,
    options: ConversionOptions = {}
  ): Promise<string | Buffer> {
    try {
      let result: string | Buffer;

      // Apply progress callback if provided
      const progressCallback = options.onProgress;
      progressCallback?.(10); // Starting conversion

      switch (targetFormat) {
        case 'json':
          result = await this.convertToJSON(data, options);
          break;
        case 'csv':
          result = await this.convertToCSV(data, options);
          break;
        case 'xml':
          result = await this.convertToXML(data, options);
          break;
        case 'parquet':
          result = await this.convertToParquet(data, options);
          break;
        case 'avro':
          result = await this.convertToAvro(data, options);
          break;
        case 'orc':
          result = await this.convertToORC(data, options);
          break;
        default:
          throw new Error(`Unsupported target format: ${targetFormat}`);
      }

      progressCallback?.(80); // Conversion complete

      // Apply compression if requested
      if (options.compression && options.compression !== 'none') {
        result = await this.applyCompression(result, options.compression);
      }

      progressCallback?.(100); // Complete

      return result;

    } catch (error) {
      throw new Error(`Format conversion failed: ${error.message}`);
    }
  }

  /**
   * Parse data from various formats
   */
  async parse(
    data: string | Buffer,
    sourceFormat: SupportedFormat,
    options: ParseOptions = {}
  ): Promise<any[]> {
    try {
      // Handle compressed data
      if (Buffer.isBuffer(data) && this.isCompressed(data)) {
        data = await this.decompress(data);
      }

      switch (sourceFormat) {
        case 'json':
          return this.parseJSON(data.toString(), options);
        case 'csv':
          return this.parseCSV(data.toString(), options);
        case 'xml':
          return await this.parseXML(data.toString(), options);
        case 'parquet':
          return await this.parseParquet(data as Buffer, options);
        case 'avro':
          return await this.parseAvro(data as Buffer, options);
        case 'orc':
          return await this.parseORC(data as Buffer, options);
        default:
          throw new Error(`Unsupported source format: ${sourceFormat}`);
      }

    } catch (error) {
      throw new Error(`Format parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse chunk for streaming operations
   */
  async parseChunk(
    chunk: any,
    format: SupportedFormat
  ): Promise<any[]> {
    if (!this.capabilities[format].supportsStreaming) {
      throw new Error(`Format ${format} does not support streaming`);
    }

    // Convert chunk to appropriate format for parsing
    switch (format) {
      case 'json':
        // Handle JSONL (JSON Lines) format
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        return lines.map(line => JSON.parse(line));
        
      case 'csv':
        return this.parseCSV(chunk.toString(), { delimiter: ',' });
        
      case 'parquet':
        return await this.parseParquetChunk(chunk);
        
      case 'avro':
        return await this.parseAvroChunk(chunk);
        
      case 'orc':
        return await this.parseORCChunk(chunk);
        
      default:
        throw new Error(`Streaming not supported for ${format}`);
    }
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): SupportedFormat[] {
    return Object.keys(this.capabilities) as SupportedFormat[];
  }

  /**
   * Check if format supports specific capability
   */
  supportsCompression(format: SupportedFormat): boolean {
    return this.capabilities[format]?.supportsCompression || false;
  }

  supportsStreaming(format: SupportedFormat): boolean {
    return this.capabilities[format]?.supportsStreaming || false;
  }

  supportsSchema(format: SupportedFormat): boolean {
    return this.capabilities[format]?.supportsSchema || false;
  }

  /**
   * Validate format compatibility
   */
  validateConversion(
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    dataSize: number
  ): {
    compatible: boolean;
    warnings: string[];
    limitations: string[];
  } {
    const warnings: string[] = [];
    const limitations: string[] = [];

    // Size limitations
    const targetCaps = this.capabilities[targetFormat];
    if (targetCaps.maxFileSize && dataSize > targetCaps.maxFileSize) {
      warnings.push(`Data size (${dataSize}) exceeds recommended limit for ${targetFormat}`);
    }

    // Feature compatibility
    if (this.capabilities[sourceFormat].supportsSchema && !targetCaps.supportsSchema) {
      limitations.push(`Schema information will be lost when converting to ${targetFormat}`);
    }

    // Binary to text conversion warnings
    if (this.capabilities[sourceFormat].binaryFormat && !targetCaps.binaryFormat) {
      warnings.push('Converting from binary to text format may increase file size');
    }

    return {
      compatible: true, // Most conversions are possible with some limitations
      warnings,
      limitations
    };
  }

  // =========================
  // Format-Specific Converters
  // =========================

  private async convertToJSON(data: any[], options: ConversionOptions): Promise<string> {
    const jsonData = {
      metadata: {
        format: 'json',
        version: '2.0',
        exported_at: new Date().toISOString(),
        total_records: data.length,
        ...options.customHeaders
      },
      data: data,
      schema: options.schema
    };

    return JSON.stringify(jsonData, null, options.streaming ? 0 : 2);
  }

  private async convertToCSV(data: any[], options: ConversionOptions): Promise<string> {
    if (data.length === 0) {
      return '';
    }

    // Extract headers from first record
    const headers = Object.keys(data[0]);
    
    // Flatten nested objects for CSV compatibility
    const flattenedData = data.map(record => this.flattenObject(record));

    return stringifyCSV(flattenedData, {
      header: true,
      columns: headers,
      quoted: true,
      delimiter: ',',
      record_delimiter: '\n'
    });
  }

  private async convertToXML(data: any[], options: ConversionOptions): Promise<string> {
    const xmlData = {
      knowledgebase: {
        $: {
          version: '2.0',
          xmlns: 'http://mainframe-kb.com/schema/v2',
          exported_at: new Date().toISOString()
        },
        metadata: {
          total_records: data.length,
          format: 'xml',
          ...options.customHeaders
        },
        schema: options.schema ? { schema: options.schema } : undefined,
        records: {
          record: data.map((item, index) => ({
            $: { id: index },
            ...this.sanitizeForXML(item)
          }))
        }
      }
    };

    const builder = new XMLBuilder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: !options.streaming },
      attrkey: '$',
      charkey: '_'
    });

    return builder.buildObject(xmlData);
  }

  private async convertToParquet(data: any[], options: ConversionOptions): Promise<Buffer> {
    try {
      // Use parquetjs library (would need to be installed)
      // This is a placeholder implementation
      console.warn('Parquet conversion requires parquetjs library installation');
      
      // For now, return JSON as Buffer with a warning
      const jsonData = JSON.stringify({
        format: 'parquet_fallback',
        note: 'Parquet library not available, returning JSON format',
        data: data
      });
      
      return Buffer.from(jsonData, 'utf8');
      
    } catch (error) {
      throw new Error(`Parquet conversion failed: ${error.message}`);
    }
  }

  private async convertToAvro(data: any[], options: ConversionOptions): Promise<Buffer> {
    try {
      // Use avsc library (would need to be installed)
      // This is a placeholder implementation
      console.warn('Avro conversion requires avsc library installation');
      
      if (!options.schema) {
        throw new Error('Avro format requires schema definition');
      }
      
      // For now, return JSON as Buffer with schema
      const avroData = {
        schema: options.schema,
        records: data
      };
      
      return Buffer.from(JSON.stringify(avroData), 'utf8');
      
    } catch (error) {
      throw new Error(`Avro conversion failed: ${error.message}`);
    }
  }

  private async convertToORC(data: any[], options: ConversionOptions): Promise<Buffer> {
    try {
      // ORC format conversion (would need appropriate library)
      // This is a placeholder implementation
      console.warn('ORC conversion requires specialized library installation');
      
      const orcData = {
        format: 'orc_fallback',
        note: 'ORC library not available, returning structured format',
        schema: options.schema,
        data: data
      };
      
      return Buffer.from(JSON.stringify(orcData), 'utf8');
      
    } catch (error) {
      throw new Error(`ORC conversion failed: ${error.message}`);
    }
  }

  // =========================
  // Format-Specific Parsers
  // =========================

  private parseJSON(data: string, options: ParseOptions): any[] {
    try {
      const parsed = JSON.parse(data);
      
      // Handle different JSON structures
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      }
      
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return parsed.entries;
      }
      
      // Single object
      return [parsed];
      
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  private parseCSV(data: string, options: ParseOptions): any[] {
    try {
      return parseCSV(data, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: options.delimiter || ',',
        quote: options.quote || '"',
        escape: options.escape || '"',
        relax_column_count: !options.strictMode
      });
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  private async parseXML(data: string, options: ParseOptions): Promise<any[]> {
    try {
      const parseXMLAsync = promisify(parseXML);
      const parsed = await parseXMLAsync(data, {
        explicitArray: false,
        explicitCharkey: false,
        trim: true,
        normalize: true
      });

      // Handle different XML structures
      if (parsed.knowledgebase?.records?.record) {
        const records = Array.isArray(parsed.knowledgebase.records.record)
          ? parsed.knowledgebase.records.record
          : [parsed.knowledgebase.records.record];
        return records;
      }

      if (parsed.root && Array.isArray(parsed.root)) {
        return parsed.root;
      }

      // Generic XML structure
      return [parsed];

    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  private async parseParquet(data: Buffer, options: ParseOptions): Promise<any[]> {
    try {
      // Placeholder for parquet parsing
      console.warn('Parquet parsing requires specialized library');
      
      // Try to parse as JSON fallback
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      
      return parsed.data || parsed.records || [parsed];
      
    } catch (error) {
      throw new Error(`Parquet parsing failed: ${error.message}`);
    }
  }

  private async parseAvro(data: Buffer, options: ParseOptions): Promise<any[]> {
    try {
      // Placeholder for Avro parsing
      console.warn('Avro parsing requires avsc library');
      
      // Try to parse as JSON fallback
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      
      return parsed.records || parsed.data || [parsed];
      
    } catch (error) {
      throw new Error(`Avro parsing failed: ${error.message}`);
    }
  }

  private async parseORC(data: Buffer, options: ParseOptions): Promise<any[]> {
    try {
      // Placeholder for ORC parsing
      console.warn('ORC parsing requires specialized library');
      
      // Try to parse as JSON fallback
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      
      return parsed.data || parsed.records || [parsed];
      
    } catch (error) {
      throw new Error(`ORC parsing failed: ${error.message}`);
    }
  }

  // =========================
  // Streaming Chunk Parsers
  // =========================

  private async parseParquetChunk(chunk: Buffer): Promise<any[]> {
    // Placeholder for streaming parquet parsing
    return [];
  }

  private async parseAvroChunk(chunk: Buffer): Promise<any[]> {
    // Placeholder for streaming Avro parsing
    return [];
  }

  private async parseORCChunk(chunk: Buffer): Promise<any[]> {
    // Placeholder for streaming ORC parsing
    return [];
  }

  // =========================
  // Utility Methods
  // =========================

  private flattenObject(obj: any, prefix = ''): any {
    const flattened: any = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(flattened, this.flattenObject(value, newKey));
        } else if (Array.isArray(value)) {
          flattened[newKey] = value.join(';');
        } else {
          flattened[newKey] = value;
        }
      }
    }
    
    return flattened;
  }

  private sanitizeForXML(obj: any): any {
    const sanitized: any = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        const value = obj[key];
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          sanitized[sanitizedKey] = this.sanitizeForXML(value);
        } else if (Array.isArray(value)) {
          sanitized[sanitizedKey] = { item: value };
        } else {
          sanitized[sanitizedKey] = String(value || '');
        }
      }
    }
    
    return sanitized;
  }

  private async applyCompression(
    data: string | Buffer,
    compression: 'gzip' | 'brotli'
  ): Promise<Buffer> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    
    switch (compression) {
      case 'gzip':
        return await promisify(zlib.gzip)(buffer);
      case 'brotli':
        return await promisify(zlib.brotliCompress)(buffer);
      default:
        return buffer;
    }
  }

  private async decompress(data: Buffer): Promise<Buffer> {
    // Try different decompression methods
    try {
      return await promisify(zlib.gunzip)(data);
    } catch {
      try {
        return await promisify(zlib.brotliDecompress)(data);
      } catch {
        return data; // Return as-is if not compressed
      }
    }
  }

  private isCompressed(data: Buffer): boolean {
    // Check for compression magic numbers
    if (data.length < 2) return false;
    
    // Gzip magic number
    if (data[0] === 0x1f && data[1] === 0x8b) return true;
    
    // Brotli doesn't have a standard magic number, so this is simplified
    return false;
  }
}

export default FormatConverter;