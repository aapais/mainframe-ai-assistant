# Enhanced Export/Import Services

Comprehensive export/import functionality with multi-format support, cross-system compatibility, and enterprise features.

## Features

### 🎯 **Multi-Format Support**
- **JSON**: Standard format with full metadata
- **CSV**: Tabular format for spreadsheet compatibility
- **XML**: Structured format with schema support
- **Parquet**: High-performance columnar format
- **Avro**: Schema-evolution friendly binary format
- **ORC**: Optimized row columnar format for analytics

### 🔄 **Cross-System Compatibility**
- ServiceNow integration with field mapping
- Jira issue format compatibility
- Confluence documentation format
- SharePoint list format
- Generic format with custom mappings

### 📊 **Enterprise Features**
- Version-aware export/import
- Data transformation pipelines
- Comprehensive validation with business rules
- Batch processing for large datasets
- Streaming support for memory efficiency
- Progress tracking and cancellation
- Error recovery and rollback
- Data quality metrics and reporting

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ExportService │    │   ImportService │    │ FormatConverter │
│                 │    │                 │    │                 │
│ • Multi-format  │    │ • Validation    │    │ • JSON/CSV/XML  │
│ • Streaming     │    │ • Recovery      │    │ • Parquet/Avro  │
│ • Progress      │    │ • Checkpoints   │    │ • Compression   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────┐
         │              DataTransformer                │
         │                                             │
         │ • Field mapping     • System compatibility  │
         │ • Custom transforms • Version compatibility │
         │ • Business rules    • Pipeline management   │
         └─────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────┐
         │             ValidationService               │
         │                                             │
         │ • Schema validation  • Data quality metrics │
         │ • Business rules     • Error reporting      │
         │ • Custom validators  • Suggestions          │
         └─────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────┐
         │              BatchProcessor                 │
         │                                             │
         │ • Parallel processing  • Memory management  │
         │ • Progress tracking    • Error recovery     │
         │ • Checkpoints         • Cancellation        │
         └─────────────────────────────────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import { ExportImportServiceFactory } from './services/storage/export';

// Create services
const kbService = new KnowledgeBaseService();
const services = ExportImportServiceFactory.createCompleteService(kbService);

// Export to JSON
const result = await services.export.export(
  'json',
  './exports/knowledge-base.json',
  { includeMetrics: true, format: 'full' }
);

// Import with validation
const importResult = await services.import.import(
  './data/import-file.csv',
  'csv',
  { 
    validateOnly: false,
    skipDuplicates: true,
    batchSize: 100
  }
);
```

### Advanced Examples

#### Multi-Format Export

```typescript
// Export to multiple formats simultaneously
const exportJobs = [
  { format: 'json', outputPath: './exports/kb.json' },
  { format: 'csv', outputPath: './exports/kb.csv' },
  { format: 'parquet', outputPath: './exports/kb.parquet' }
];

const results = await services.export.exportBatch(
  exportJobs,
  (completed, total) => console.log(`Progress: ${completed}/${total}`)
);
```

#### Cross-System Export

```typescript
// Export for ServiceNow
const serviceNowResult = await services.export.exportForSystem(
  'servicenow',
  './exports/servicenow-import.json',
  {
    transform: {
      customMapping: true,
      includeSystemFields: true
    }
  }
);

// Export for Jira
const jiraResult = await services.export.exportForSystem(
  'jira',
  './exports/jira-import.json'
);
```

#### Streaming for Large Datasets

```typescript
// Stream export for large datasets
const exportStream = await services.export.exportStream('json', {
  batchSize: 1000,
  compression: 'gzip',
  transform: (entry) => ({
    ...entry,
    exported_at: new Date().toISOString()
  })
});

// Process stream
exportStream.on('data', (chunk) => {
  console.log('Received chunk:', chunk.length);
});
```

#### Import with Validation

```typescript
// Comprehensive import with validation
const importResult = await services.import.import(
  './data/external-system.csv',
  'csv',
  {
    validation: {
      strictMode: true,
      validateSchema: true,
      customValidators: [
        (entry) => ({
          valid: entry.title.length > 5,
          errors: entry.title.length <= 5 ? ['Title too short'] : [],
          warnings: []
        })
      ]
    },
    transform: {
      fieldMappings: {
        'description': 'problem',
        'resolution': 'solution'
      },
      legacyCompatibility: true
    },
    recovery: {
      enableAutoRecovery: true,
      rollbackOnFailure: true,
      retryAttempts: 3
    }
  }
);
```

## Service Reference

### ExportService

#### Methods

- **`export(format, outputPath, options?, progressCallback?)`** - Export data to specified format
- **`exportStream(format, options?)`** - Create export stream for large datasets
- **`exportBatch(jobs, progressCallback?)`** - Export to multiple formats in parallel
- **`exportForSystem(targetSystem, outputPath, options?)`** - Export with system-specific formatting
- **`exportCompatible(targetVersion, outputPath, options?)`** - Export with version compatibility
- **`getJobStatus(jobId)`** - Get export job status
- **`cancelJob(jobId)`** - Cancel running export job
- **`getSupportedFormats()`** - Get list of supported formats
- **`validateOptions(format, options)`** - Validate export options

#### Options

```typescript
interface ExportOptions {
  includeMetrics?: boolean;
  includeHistory?: boolean;
  category?: string;
  since?: Date;
  until?: Date;
  format?: 'full' | 'minimal' | 'compact';
  compression?: 'gzip' | 'brotli' | 'none';
  encoding?: string;
  schema?: any;
  customHeaders?: Record<string, string>;
  transform?: Record<string, any>;
  targetSystem?: string;
  targetVersion?: string;
}
```

### ImportService

#### Methods

- **`import(filePath, format, options?, progressCallback?)`** - Import data from file
- **`importStream(stream, format, options?, progressCallback?)`** - Import from stream
- **`validateImport(filePath, format, options?)`** - Validate import file without importing
- **`importFromSystem(filePath, sourceSystem, options?)`** - Import with system-specific parsing
- **`importCompatible(filePath, sourceVersion, options?)`** - Import with version compatibility
- **`resumeImport(jobId)`** - Resume import from checkpoint
- **`getJobStatus(jobId)`** - Get import job status
- **`cancelJob(jobId)`** - Cancel running import job

#### Options

```typescript
interface ImportOptions {
  overwrite?: boolean;
  merge?: boolean;
  validateOnly?: boolean;
  batchSize?: number;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  onConflict?: 'skip' | 'overwrite' | 'merge' | 'error';
  sourceSystem?: string;
  sourceVersion?: string;
  validation?: {
    strictMode?: boolean;
    allowPartialImport?: boolean;
    customValidators?: Array<(entry: any) => ValidationResult>;
  };
  transform?: {
    fieldMappings?: Record<string, string>;
    customTransform?: (entry: any) => any;
    legacyCompatibility?: boolean;
  };
  recovery?: {
    enableAutoRecovery?: boolean;
    rollbackOnFailure?: boolean;
    retryAttempts?: number;
  };
}
```

### FormatConverter

#### Methods

- **`convert(data, targetFormat, options?)`** - Convert data to target format
- **`parse(data, sourceFormat, options?)`** - Parse data from source format
- **`parseChunk(chunk, format)`** - Parse chunk for streaming operations
- **`getSupportedFormats()`** - Get supported formats
- **`supportsCompression(format)`** - Check if format supports compression
- **`validateConversion(sourceFormat, targetFormat, dataSize)`** - Validate conversion compatibility

### DataTransformer

#### Methods

- **`transform(entries, options?)`** - Transform data for export
- **`transformForImport(data, options?)`** - Transform data for import
- **`transformWithPipeline(data, pipelineId, context?)`** - Transform using custom pipeline
- **`transformBatch(batch, options?, batchIndex?)`** - Transform batch for streaming
- **`createPipeline(pipeline)`** - Create custom transformation pipeline
- **`validateTransformation(sampleData, options)`** - Validate transformation compatibility

### ValidationService

#### Methods

- **`validateImportData(data, options?)`** - Comprehensive data validation
- **`validateRecord(record, index, options?)`** - Validate single record
- **`validateBatch(batch, batchIndex?, options?)`** - Validate batch of records
- **`getDataQualityMetrics(data)`** - Calculate data quality metrics
- **`getValidationSuggestions(field, value, error)`** - Get validation suggestions

### BatchProcessor

#### Methods

- **`processBatch(data, processor, progressCallback?, errorCallback?)`** - Process data in batches
- **`processStream(dataGenerator, processor, progressCallback?, errorCallback?)`** - Process stream with batches
- **`resumeFromCheckpoint(checkpointId, data, processor, ...)`** - Resume from checkpoint
- **`cancel()`** - Cancel current processing
- **`getStatistics()`** - Get processing statistics

## Format Specifications

### JSON Format

```json
{
  "metadata": {
    "version": "2.0",
    "exported_at": "2024-01-01T12:00:00Z",
    "total_records": 100,
    "format": "json"
  },
  "data": [
    {
      "id": "1",
      "title": "Problem Title",
      "problem": "Problem description",
      "solution": "Solution steps",
      "category": "VSAM",
      "tags": ["tag1", "tag2"],
      "created_at": "2024-01-01T10:00:00Z",
      "usage_count": 45
    }
  ]
}
```

### CSV Format

```csv
id,title,problem,solution,category,tags,created_at,usage_count
1,"Problem Title","Problem description","Solution steps","VSAM","tag1;tag2","2024-01-01T10:00:00Z",45
```

### XML Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<knowledgebase version="2.0" xmlns="http://mainframe-kb.com/schema/v2">
  <metadata>
    <total_records>100</total_records>
    <format>xml</format>
  </metadata>
  <records>
    <record id="1">
      <title>Problem Title</title>
      <problem>Problem description</problem>
      <solution>Solution steps</solution>
      <category>VSAM</category>
      <tags>
        <tag>tag1</tag>
        <tag>tag2</tag>
      </tags>
    </record>
  </records>
</knowledgebase>
```

## System Mappings

### ServiceNow

| KB Field | ServiceNow Field |
|----------|------------------|
| title | short_description |
| problem | description |
| solution | resolution_notes |
| category | category |
| created_at | sys_created_on |

### Jira

| KB Field | Jira Field |
|----------|------------|
| title | summary |
| problem | description |
| solution | resolution |
| category | issuetype |
| created_at | created |

## Error Handling

### Error Types

- **ValidationError**: Data validation failures
- **TransformationError**: Data transformation failures
- **FormatError**: Format conversion failures
- **SystemError**: System integration failures
- **RecoveryError**: Error recovery failures

### Error Recovery

1. **Automatic Retry**: Configurable retry attempts with exponential backoff
2. **Checkpoint Recovery**: Resume from last successful checkpoint
3. **Rollback**: Automatic rollback on critical failures
4. **Partial Success**: Continue processing valid records, report errors
5. **Manual Recovery**: Tools to inspect and fix failed operations

## Performance Considerations

### Memory Management

- **Streaming**: Use streaming for datasets > 50MB
- **Batch Processing**: Configurable batch sizes (default: 100-1000)
- **Memory Monitoring**: Automatic memory usage tracking
- **Garbage Collection**: Forced GC when approaching limits

### Optimization Tips

1. **Use appropriate batch sizes** (100 for fast processing, 1000 for throughput)
2. **Enable compression** for large exports
3. **Use streaming** for files > 100MB
4. **Choose optimal formats** (Parquet for analytics, JSON for interchange)
5. **Configure validation levels** (strict for critical data, relaxed for bulk import)

## Monitoring and Metrics

### Job Monitoring

```typescript
// Monitor export job
const job = exportService.getJobStatus(jobId);
console.log(`Status: ${job.status}, Progress: ${job.progress}%`);

// Cancel if needed
if (job.status === 'running') {
  await exportService.cancelJob(jobId);
}
```

### Performance Metrics

- Processing time per record
- Memory usage patterns
- Error rates by format/system
- Throughput measurements
- Data quality scores

## Best Practices

### Export Best Practices

1. **Choose the right format** for your use case
2. **Use compression** for large files
3. **Include metadata** for traceability
4. **Validate options** before starting export
5. **Monitor progress** for long-running jobs

### Import Best Practices

1. **Always validate** before importing
2. **Use batch processing** for large datasets
3. **Enable recovery options** for critical imports
4. **Map fields correctly** for cross-system imports
5. **Test with sample data** first

### Performance Best Practices

1. **Use streaming** for large datasets
2. **Configure appropriate batch sizes**
3. **Monitor memory usage**
4. **Enable checkpoints** for long operations
5. **Use worker threads** for CPU-intensive operations

## Troubleshooting

### Common Issues

1. **Memory errors**: Reduce batch size or use streaming
2. **Format errors**: Validate data format and encoding
3. **Transformation errors**: Check field mappings and custom transforms
4. **Validation errors**: Review validation rules and data quality
5. **Performance issues**: Optimize batch sizes and use appropriate formats

### Debug Mode

```typescript
// Enable detailed logging
const services = ExportImportServiceFactory.createCompleteService(kbService, {
  export: { debug: true },
  import: { debug: true, enableRecovery: true },
  batch: { enableProgress: true, memoryLimit: 256 }
});
```

## License

This enhanced export/import system is part of the Mainframe Knowledge Base Assistant project.