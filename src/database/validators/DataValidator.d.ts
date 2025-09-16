import { KBEntry } from '../KnowledgeDB';
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    sanitizedData?: any;
}
export interface ValidationError {
    field: string;
    code: string;
    message: string;
    value?: any;
}
export interface ValidationWarning {
    field: string;
    code: string;
    message: string;
    value?: any;
}
export interface SanitizationOptions {
    trimStrings?: boolean;
    normalizeWhitespace?: boolean;
    removeHtmlTags?: boolean;
    maxLength?: {
        [field: string]: number;
    };
    allowedTags?: string[];
}
export interface ValidationRule {
    field: string;
    validator: (value: any, data: any) => boolean | string;
    message: string;
    level: 'error' | 'warning';
}
export declare const KBEntrySchema: any;
export declare const SearchQuerySchema: any;
export declare const UserInputSchema: any;
export declare class DataValidator {
    private customRules;
    private sanitizationOptions;
    constructor(options?: {
        customRules?: ValidationRule[];
        sanitizationOptions?: Partial<SanitizationOptions>;
    });
    validateKBEntry(data: Partial<KBEntry>): Promise<ValidationResult>;
    validateSearchQuery(data: any): Promise<ValidationResult>;
    validateUserInput(data: any): Promise<ValidationResult>;
    private sanitizeData;
    private stripHtmlTags;
    private validateBusinessRules;
    private formatZodErrors;
    private initializeDefaultRules;
    addRule(rule: ValidationRule): void;
    removeRule(field: string, code?: string): void;
    setSanitizationOptions(options: Partial<SanitizationOptions>): void;
    getValidationStats(): {
        totalRules: number;
        errorRules: number;
        warningRules: number;
        customRules: number;
    };
}
export declare class InputSanitizer {
    static sanitizeSqlIdentifier(identifier: string): string;
    static sanitizeFilePath(filePath: string): string;
    static sanitizeEmail(email: string): string;
    static sanitizeTextContent(content: string, options?: {
        maxLength?: number;
        allowHtml?: boolean;
        preserveLineBreaks?: boolean;
    }): string;
}
//# sourceMappingURL=DataValidator.d.ts.map