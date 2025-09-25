'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FormatConverter = void 0;
const tslib_1 = require('tslib');
const sync_1 = require('csv-parse/sync');
const xml2js_1 = require('xml2js');
const util_1 = require('util');
const zlib_1 = tslib_1.__importDefault(require('zlib'));
class FormatConverter {
  capabilities = {
    json: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: false,
    },
    csv: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: false,
      binaryFormat: false,
    },
    xml: {
      supportsStreaming: false,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: false,
    },
    parquet: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      maxFileSize: 2 * 1024 * 1024 * 1024,
      binaryFormat: true,
    },
    avro: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: true,
    },
    orc: {
      supportsStreaming: true,
      supportsCompression: true,
      supportsSchema: true,
      binaryFormat: true,
    },
  };
  async convert(data, targetFormat, options = {}) {
    try {
      let result;
      const progressCallback = options.onProgress;
      progressCallback?.(10);
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
      progressCallback?.(80);
      if (options.compression && options.compression !== 'none') {
        result = await this.applyCompression(result, options.compression);
      }
      progressCallback?.(100);
      return result;
    } catch (error) {
      throw new Error(`Format conversion failed: ${error.message}`);
    }
  }
  async parse(data, sourceFormat, options = {}) {
    try {
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
          return await this.parseParquet(data, options);
        case 'avro':
          return await this.parseAvro(data, options);
        case 'orc':
          return await this.parseORC(data, options);
        default:
          throw new Error(`Unsupported source format: ${sourceFormat}`);
      }
    } catch (error) {
      throw new Error(`Format parsing failed: ${error.message}`);
    }
  }
  async parseChunk(chunk, format) {
    if (!this.capabilities[format].supportsStreaming) {
      throw new Error(`Format ${format} does not support streaming`);
    }
    switch (format) {
      case 'json':
        const lines = chunk
          .toString()
          .split('\n')
          .filter(line => line.trim());
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
  getSupportedFormats() {
    return Object.keys(this.capabilities);
  }
  supportsCompression(format) {
    return this.capabilities[format]?.supportsCompression || false;
  }
  supportsStreaming(format) {
    return this.capabilities[format]?.supportsStreaming || false;
  }
  supportsSchema(format) {
    return this.capabilities[format]?.supportsSchema || false;
  }
  validateConversion(sourceFormat, targetFormat, dataSize) {
    const warnings = [];
    const limitations = [];
    const targetCaps = this.capabilities[targetFormat];
    if (targetCaps.maxFileSize && dataSize > targetCaps.maxFileSize) {
      warnings.push(`Data size (${dataSize}) exceeds recommended limit for ${targetFormat}`);
    }
    if (this.capabilities[sourceFormat].supportsSchema && !targetCaps.supportsSchema) {
      limitations.push(`Schema information will be lost when converting to ${targetFormat}`);
    }
    if (this.capabilities[sourceFormat].binaryFormat && !targetCaps.binaryFormat) {
      warnings.push('Converting from binary to text format may increase file size');
    }
    return {
      compatible: true,
      warnings,
      limitations,
    };
  }
  async convertToJSON(data, options) {
    const jsonData = {
      metadata: {
        format: 'json',
        version: '2.0',
        exported_at: new Date().toISOString(),
        total_records: data.length,
        ...options.customHeaders,
      },
      data,
      schema: options.schema,
    };
    return JSON.stringify(jsonData, null, options.streaming ? 0 : 2);
  }
  async convertToCSV(data, options) {
    if (data.length === 0) {
      return '';
    }
    const headers = Object.keys(data[0]);
    const flattenedData = data.map(record => this.flattenObject(record));
    return (0, sync_1.stringify)(flattenedData, {
      header: true,
      columns: headers,
      quoted: true,
      delimiter: ',',
      record_delimiter: '\n',
    });
  }
  async convertToXML(data, options) {
    const xmlData = {
      knowledgebase: {
        $: {
          version: '2.0',
          xmlns: 'http://mainframe-kb.com/schema/v2',
          exported_at: new Date().toISOString(),
        },
        metadata: {
          total_records: data.length,
          format: 'xml',
          ...options.customHeaders,
        },
        schema: options.schema ? { schema: options.schema } : undefined,
        records: {
          record: data.map((item, index) => ({
            $: { id: index },
            ...this.sanitizeForXML(item),
          })),
        },
      },
    };
    const builder = new xml2js_1.Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: !options.streaming },
      attrkey: '$',
      charkey: '_',
    });
    return builder.buildObject(xmlData);
  }
  async convertToParquet(data, options) {
    try {
      console.warn('Parquet conversion requires parquetjs library installation');
      const jsonData = JSON.stringify({
        format: 'parquet_fallback',
        note: 'Parquet library not available, returning JSON format',
        data,
      });
      return Buffer.from(jsonData, 'utf8');
    } catch (error) {
      throw new Error(`Parquet conversion failed: ${error.message}`);
    }
  }
  async convertToAvro(data, options) {
    try {
      console.warn('Avro conversion requires avsc library installation');
      if (!options.schema) {
        throw new Error('Avro format requires schema definition');
      }
      const avroData = {
        schema: options.schema,
        records: data,
      };
      return Buffer.from(JSON.stringify(avroData), 'utf8');
    } catch (error) {
      throw new Error(`Avro conversion failed: ${error.message}`);
    }
  }
  async convertToORC(data, options) {
    try {
      console.warn('ORC conversion requires specialized library installation');
      const orcData = {
        format: 'orc_fallback',
        note: 'ORC library not available, returning structured format',
        schema: options.schema,
        data,
      };
      return Buffer.from(JSON.stringify(orcData), 'utf8');
    } catch (error) {
      throw new Error(`ORC conversion failed: ${error.message}`);
    }
  }
  parseJSON(data, options) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      }
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return parsed.entries;
      }
      return [parsed];
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }
  parseCSV(data, options) {
    try {
      return (0, sync_1.parse)(data, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: options.delimiter || ',',
        quote: options.quote || '"',
        escape: options.escape || '"',
        relax_column_count: !options.strictMode,
      });
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }
  async parseXML(data, options) {
    try {
      const parseXMLAsync = (0, util_1.promisify)(xml2js_1.parseString);
      const parsed = await parseXMLAsync(data, {
        explicitArray: false,
        explicitCharkey: false,
        trim: true,
        normalize: true,
      });
      if (parsed.knowledgebase?.records?.record) {
        const records = Array.isArray(parsed.knowledgebase.records.record)
          ? parsed.knowledgebase.records.record
          : [parsed.knowledgebase.records.record];
        return records;
      }
      if (parsed.root && Array.isArray(parsed.root)) {
        return parsed.root;
      }
      return [parsed];
    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }
  async parseParquet(data, options) {
    try {
      console.warn('Parquet parsing requires specialized library');
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      return parsed.data || parsed.records || [parsed];
    } catch (error) {
      throw new Error(`Parquet parsing failed: ${error.message}`);
    }
  }
  async parseAvro(data, options) {
    try {
      console.warn('Avro parsing requires avsc library');
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      return parsed.records || parsed.data || [parsed];
    } catch (error) {
      throw new Error(`Avro parsing failed: ${error.message}`);
    }
  }
  async parseORC(data, options) {
    try {
      console.warn('ORC parsing requires specialized library');
      const text = data.toString('utf8');
      const parsed = JSON.parse(text);
      return parsed.data || parsed.records || [parsed];
    } catch (error) {
      throw new Error(`ORC parsing failed: ${error.message}`);
    }
  }
  async parseParquetChunk(chunk) {
    return [];
  }
  async parseAvroChunk(chunk) {
    return [];
  }
  async parseORCChunk(chunk) {
    return [];
  }
  flattenObject(obj, prefix = '') {
    const flattened = {};
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
  sanitizeForXML(obj) {
    const sanitized = {};
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
  async applyCompression(data, compression) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    switch (compression) {
      case 'gzip':
        return await (0, util_1.promisify)(zlib_1.default.gzip)(buffer);
      case 'brotli':
        return await (0, util_1.promisify)(zlib_1.default.brotliCompress)(buffer);
      default:
        return buffer;
    }
  }
  async decompress(data) {
    try {
      return await (0, util_1.promisify)(zlib_1.default.gunzip)(data);
    } catch {
      try {
        return await (0, util_1.promisify)(zlib_1.default.brotliDecompress)(data);
      } catch {
        return data;
      }
    }
  }
  isCompressed(data) {
    if (data.length < 2) return false;
    if (data[0] === 0x1f && data[1] === 0x8b) return true;
    return false;
  }
}
exports.FormatConverter = FormatConverter;
exports.default = FormatConverter;
//# sourceMappingURL=FormatConverter.js.map
