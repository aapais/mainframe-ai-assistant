import {
  IValidationService,
  ValidationResult,
  CustomValidator,
  KBEntryInput,
  KBEntryUpdate,
  SearchOptions,
  ValidationConfig,
} from '../types/services';
export declare class ValidationService implements IValidationService {
  private config;
  private customValidators;
  constructor(config: ValidationConfig);
  validateEntry(entry: KBEntryInput): ValidationResult;
  validateUpdate(updates: KBEntryUpdate): ValidationResult;
  validateSearch(query: string, options?: SearchOptions): ValidationResult;
  validateBatch(entries: KBEntryInput[]): ValidationResult[];
  sanitizeEntry(entry: KBEntryInput): KBEntryInput;
  sanitizeUpdate(updates: KBEntryUpdate): KBEntryUpdate;
  sanitizeBatch(entries: KBEntryInput[]): KBEntryInput[];
  addCustomValidator(field: string, validator: CustomValidator): void;
  removeCustomValidator(field: string): void;
  private sanitizeString;
  private sanitizeTag;
  private performContentQualityChecks;
  private performSecurityChecks;
  private runCustomValidators;
  private calculateQualityScore;
}
export default ValidationService;
//# sourceMappingURL=ValidationService.d.ts.map
