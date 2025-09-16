import { BaseStoragePlugin } from './BaseStoragePlugin';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { PluginConfig } from '../IStorageService';
export interface CodeFile {
    id: string;
    name: string;
    path: string;
    type: 'cobol' | 'jcl' | 'copybook' | 'proc' | 'other';
    content: string;
    parsed_at?: Date;
    structure?: ProgramStructure;
    metrics?: CodeMetrics;
    issues?: CodeIssue[];
    last_modified?: Date;
    size_bytes: number;
    line_count: number;
}
export interface ProgramStructure {
    program_name: string;
    divisions: Division[];
    paragraphs: Paragraph[];
    variables: Variable[];
    calls: Call[];
    files: FileDefinition[];
    copybooks: string[];
}
export interface Division {
    name: string;
    type: 'identification' | 'environment' | 'data' | 'procedure';
    start_line: number;
    end_line: number;
    sections: Section[];
}
export interface Section {
    name: string;
    start_line: number;
    end_line: number;
    content: string;
}
export interface Paragraph {
    name: string;
    start_line: number;
    end_line: number;
    complexity: number;
    calls_made: string[];
    variables_used: string[];
}
export interface Variable {
    name: string;
    level: string;
    type: string;
    picture?: string;
    usage?: string;
    occurs?: number;
    redefines?: string;
    line_defined: number;
    references: VariableReference[];
}
export interface VariableReference {
    line: number;
    type: 'read' | 'write' | 'modify';
    context: string;
}
export interface Call {
    program_name: string;
    line: number;
    type: 'static' | 'dynamic';
    parameters?: string[];
}
export interface FileDefinition {
    name: string;
    type: 'sequential' | 'indexed' | 'relative' | 'vsam';
    organization: string;
    access_mode: string;
    record_format: string;
    line_defined: number;
}
export interface CodeMetrics {
    complexity_score: number;
    maintainability_index: number;
    lines_of_code: number;
    comment_ratio: number;
    duplicate_code_ratio: number;
    test_coverage?: number;
    performance_score: number;
    security_score: number;
}
export interface CodeIssue {
    id: string;
    type: 'error' | 'warning' | 'info' | 'suggestion';
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'syntax' | 'logic' | 'performance' | 'security' | 'maintainability' | 'standards';
    line: number;
    column?: number;
    message: string;
    description: string;
    suggestion?: string;
    related_kb_entries?: string[];
    auto_fixable: boolean;
}
export interface KBCodeLink {
    id: string;
    kb_entry_id: string;
    code_file_id: string;
    start_line: number;
    end_line?: number;
    link_type: 'manual' | 'auto' | 'pattern';
    confidence: number;
    description?: string;
    created_at: Date;
    verified: boolean;
}
export interface CodeAnalysisResult {
    file: CodeFile;
    structure: ProgramStructure;
    metrics: CodeMetrics;
    issues: CodeIssue[];
    kb_links: KBCodeLink[];
    ai_insights?: AIInsight[];
}
export interface AIInsight {
    type: 'explanation' | 'suggestion' | 'optimization' | 'bug_detection';
    confidence: number;
    message: string;
    line_start: number;
    line_end: number;
    related_patterns?: string[];
}
export interface CodeAnalysisConfig extends PluginConfig {
    parsing: {
        auto_parse_on_import: boolean;
        parse_timeout_seconds: number;
        max_file_size_mb: number;
        skip_comments: boolean;
    };
    analysis: {
        complexity_analysis: boolean;
        performance_analysis: boolean;
        security_analysis: boolean;
        standards_checking: boolean;
        auto_link_kb_entries: boolean;
    };
    ai_integration: {
        enabled: boolean;
        explain_complex_logic: boolean;
        suggest_optimizations: boolean;
        detect_potential_bugs: boolean;
        confidence_threshold: number;
    };
    quality_gates: {
        max_complexity_score: number;
        min_maintainability_index: number;
        max_critical_issues: number;
        required_comment_ratio: number;
    };
}
export declare class CodeAnalysisPlugin extends BaseStoragePlugin {
    private codeFiles;
    private kbLinks;
    private aiService?;
    constructor(adapter: IStorageAdapter, config?: CodeAnalysisConfig);
    getName(): string;
    getVersion(): string;
    getDescription(): string;
    getMVPVersion(): number;
    getDependencies(): string[];
    protected getDefaultConfig(): CodeAnalysisConfig;
    protected initializePlugin(): Promise<void>;
    protected cleanupPlugin(): Promise<void>;
    processData(data: any, context?: any): Promise<any>;
    importCode(filePath: string, content: string, type?: CodeFile['type']): Promise<CodeFile>;
    analyzeCode(fileId: string): Promise<CodeAnalysisResult>;
    parseCode(fileId: string): Promise<ProgramStructure>;
    private parseCOBOL;
    private createDivision;
    private parseVariable;
    private parseCall;
    private parseCopy;
    private isParagraphStart;
    private parseParagraph;
    private determineVariableType;
    private calculateParagraphComplexity;
    private parseJCL;
    private parseCopybook;
    private parseGeneric;
    private calculateMetrics;
    private detectIssues;
    private checkStandards;
    private checkComplexity;
    private checkPerformance;
    private checkSecurity;
    linkKBEntry(kbEntryId: string, fileId: string, startLine: number, endLine?: number): Promise<KBCodeLink>;
    autoLinkKBEntries(fileId: string): Promise<KBCodeLink[]>;
    private calculateLinkConfidence;
    private findRelevantLines;
    private extractErrorCodes;
    private extractKeywords;
    explainCode(fileId: string, startLine: number, endLine: number): Promise<string>;
    private generateAIInsights;
    private createTables;
    private loadExistingCodeFiles;
    private loadExistingKBLinks;
    private persistCodeFile;
    private persistKBLink;
    private persistCodeFiles;
    private persistKBLinks;
    private generateFileId;
    private extractFileName;
    private hash;
    findCodeForKBEntry(kbEntryId: string): Promise<KBCodeLink[]>;
    getCodeMetrics(fileId: string): Promise<CodeMetrics | null>;
    getCodeIssues(fileId: string, severity?: string): Promise<CodeIssue[]>;
    suggestImprovements(fileId: string): Promise<string[]>;
}
//# sourceMappingURL=CodeAnalysisPlugin.d.ts.map