import {
  IImportExportService,
  IKnowledgeBaseService,
  IValidationService,
  ExportOptions,
  ImportOptions,
  ImportResult,
  RestoreResult,
  ValidationResult,
} from '../types/services';
export declare class ImportExportService implements IImportExportService {
  private kbService;
  private validationService?;
  private supportedFormats;
  constructor(kbService: IKnowledgeBaseService, validationService?: IValidationService | undefined);
  exportToJSON(options?: ExportOptions): Promise<string>;
  importFromJSON(data: string, options?: ImportOptions): Promise<ImportResult>;
  exportToCSV(options?: ExportOptions): Promise<string>;
  importFromCSV(data: string, options?: ImportOptions): Promise<ImportResult>;
  exportToXML(options?: ExportOptions): Promise<string>;
  importFromXML(data: string, options?: ImportOptions): Promise<ImportResult>;
  backup(backupPath: string): Promise<void>;
  restore(backupPath: string): Promise<RestoreResult>;
  validateFormat(data: string, format: 'json' | 'csv' | 'xml'): ValidationResult;
  getFormats(): string[];
  private fetchEntriesForExport;
  private prepareEntriesForExport;
  private generateExportStatistics;
  private convertEntriesToCSV;
  private getCSVColumns;
  private convertCSVRecordToEntry;
  private convertXMLEntryToEntry;
  private processBatch;
  private findExistingEntry;
}
export default ImportExportService;
//# sourceMappingURL=ImportExportService.d.ts.map
