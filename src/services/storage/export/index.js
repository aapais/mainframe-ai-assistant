'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ExportImportServiceFactory =
  exports.ValidationService =
  exports.DataTransformer =
  exports.FormatConverter =
  exports.ImportService =
  exports.ExportService =
    void 0;
const ExportService_1 = require('./ExportService');
Object.defineProperty(exports, 'ExportService', {
  enumerable: true,
  get() {
    return ExportService_1.ExportService;
  },
});
const ImportService_1 = require('./ImportService');
Object.defineProperty(exports, 'ImportService', {
  enumerable: true,
  get() {
    return ImportService_1.ImportService;
  },
});
const FormatConverter_1 = require('./FormatConverter');
Object.defineProperty(exports, 'FormatConverter', {
  enumerable: true,
  get() {
    return FormatConverter_1.FormatConverter;
  },
});
const DataTransformer_1 = require('./DataTransformer');
Object.defineProperty(exports, 'DataTransformer', {
  enumerable: true,
  get() {
    return DataTransformer_1.DataTransformer;
  },
});
const ValidationService_1 = require('./ValidationService');
Object.defineProperty(exports, 'ValidationService', {
  enumerable: true,
  get() {
    return ValidationService_1.ValidationService;
  },
});
class ExportImportServiceFactory {
  static createExportService(kbService, options) {
    return new ExportService(kbService, options);
  }
  static createImportService(kbService, options) {
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
  static createBatchProcessor(options) {
    return new BatchProcessor(options);
  }
  static createCompleteService(kbService, options = {}) {
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
exports.ExportImportServiceFactory = ExportImportServiceFactory;
exports.default = ExportImportServiceFactory;
//# sourceMappingURL=index.js.map
