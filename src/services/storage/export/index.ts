/**
 * Export Services Index
 * Comprehensive export/import functionality with multi-format support
 */

export { ExportService } from './ExportService';
export { ImportService } from './ImportService';
export { FormatConverter } from './FormatConverter';
export { DataTransformer } from './DataTransformer';
export { ValidationService } from './ValidationService';
export { BatchProcessor } from './BatchProcessor';

// Re-export types for convenience
export type {
  ExportOptions,
  ImportOptions,
  ExportResult,
  ImportResult,
  ExportFormat,
  ImportFormat,
  ExportJob,
  ImportJob,
  ValidationResult,
  ValidationOptions,
  TransformOptions,
  ImportTransformOptions,
  BatchOptions,
  BatchResult,
  ConversionOptions,
  ParseOptions,
} from '../../../types/services';

// Export service factory for easy instantiation
export class ExportImportServiceFactory {
  static createExportService(kbService: any, options?: any) {
    return new ExportService(kbService, options);
  }

  static createImportService(kbService: any, options?: any) {
    return new ImportService(kbService, options);
  }

  static createFormatConverter() {
    return new FormatConverter();
  }

  static createDataTransformer() {
    return new DataTransformer();
  }

  static createValidationService() {
    return new ValidationService();
  }

  static createBatchProcessor(options?: any) {
    return new BatchProcessor(options);
  }

  /**
   * Create a complete export/import solution
   */
  static createCompleteService(
    kbService: any,
    options: {
      export?: any;
      import?: any;
      batch?: any;
    } = {}
  ) {
    const exportService = new ExportService(kbService, options.export);
    const importService = new ImportService(kbService, options.import);
    const formatConverter = new FormatConverter();
    const dataTransformer = new DataTransformer();
    const validationService = new ValidationService();
    const batchProcessor = new BatchProcessor(options.batch);

    return {
      export: exportService,
      import: importService,
      converter: formatConverter,
      transformer: dataTransformer,
      validator: validationService,
      batchProcessor,
    };
  }
}

export default ExportImportServiceFactory;
