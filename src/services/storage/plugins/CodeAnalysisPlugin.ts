/**
 * Code Analysis Plugin (MVP3)
 * Provides code analysis, linking, and AI-powered code assistance
 * 
 * This plugin enables integration between knowledge base entries and actual code,
 * providing context-aware debugging and code quality insights.
 */

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

export class CodeAnalysisPlugin extends BaseStoragePlugin {
  private codeFiles: Map<string, CodeFile> = new Map();
  private kbLinks: Map<string, KBCodeLink[]> = new Map();
  private aiService?: any; // AI service for code analysis

  constructor(adapter: IStorageAdapter, config: CodeAnalysisConfig = {} as CodeAnalysisConfig) {
    super(adapter, config);
  }

  // ========================
  // Abstract Method Implementations
  // ========================

  getName(): string {
    return 'code-analysis';
  }

  getVersion(): string {
    return '3.0.0';
  }

  getDescription(): string {
    return 'Provides code analysis, linking, and AI-powered code assistance';
  }

  getMVPVersion(): number {
    return 3;
  }

  getDependencies(): string[] {
    return ['full-text-search', 'raw-sql'];
  }

  protected getDefaultConfig(): CodeAnalysisConfig {
    return {
      enabled: true,
      parsing: {
        auto_parse_on_import: true,
        parse_timeout_seconds: 30,
        max_file_size_mb: 10,
        skip_comments: false
      },
      analysis: {
        complexity_analysis: true,
        performance_analysis: true,
        security_analysis: true,
        standards_checking: true,
        auto_link_kb_entries: true
      },
      ai_integration: {
        enabled: false, // Requires AI service
        explain_complex_logic: true,
        suggest_optimizations: true,
        detect_potential_bugs: true,
        confidence_threshold: 70
      },
      quality_gates: {
        max_complexity_score: 15,
        min_maintainability_index: 60,
        max_critical_issues: 0,
        required_comment_ratio: 0.1
      }
    } as CodeAnalysisConfig;
  }

  protected async initializePlugin(): Promise<void> {
    // Create tables for code analysis
    await this.createTables();
    
    // Load existing code files
    await this.loadExistingCodeFiles();
    
    // Load existing KB links
    await this.loadExistingKBLinks();
    
    this.log('info', 'Code analysis plugin initialized', {
      code_files_loaded: this.codeFiles.size,
      kb_links_loaded: Array.from(this.kbLinks.values()).flat().length
    });
  }

  protected async cleanupPlugin(): Promise<void> {
    // Save current state
    await this.persistCodeFiles();
    await this.persistKBLinks();
    
    this.log('info', 'Code analysis plugin cleaned up');
  }

  async processData(data: any, context?: any): Promise<any> {
    const { action, payload } = data;

    switch (action) {
      case 'import_code':
        return await this.importCode(payload.filePath, payload.content, payload.type);
      
      case 'analyze_code':
        return await this.analyzeCode(payload.fileId);
      
      case 'parse_code':
        return await this.parseCode(payload.fileId);
      
      case 'link_kb_entry':
        return await this.linkKBEntry(payload.kbEntryId, payload.fileId, payload.startLine, payload.endLine);
      
      case 'find_code_for_kb':
        return await this.findCodeForKBEntry(payload.kbEntryId);
      
      case 'get_code_metrics':
        return await this.getCodeMetrics(payload.fileId);
      
      case 'get_code_issues':
        return await this.getCodeIssues(payload.fileId, payload.severity);
      
      case 'explain_code':
        return await this.explainCode(payload.fileId, payload.startLine, payload.endLine);
      
      case 'suggest_improvements':
        return await this.suggestImprovements(payload.fileId);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ========================
  // Core Code Analysis Logic
  // ========================

  async importCode(filePath: string, content: string, type: CodeFile['type'] = 'cobol'): Promise<CodeFile> {
    const config = this.config as CodeAnalysisConfig;
    
    // Validate file size
    const sizeBytes = Buffer.from(content, 'utf8').length;
    const sizeMB = sizeBytes / (1024 * 1024);
    
    if (sizeMB > config.parsing.max_file_size_mb) {
      throw new Error(`File too large: ${sizeMB.toFixed(2)}MB (max: ${config.parsing.max_file_size_mb}MB)`);
    }
    
    const codeFile: CodeFile = {
      id: this.generateFileId(filePath),
      name: this.extractFileName(filePath),
      path: filePath,
      type,
      content,
      size_bytes: sizeBytes,
      line_count: content.split('\n').length,
      last_modified: new Date()
    };
    
    // Store file
    this.codeFiles.set(codeFile.id, codeFile);
    await this.persistCodeFile(codeFile);
    
    // Auto-parse if enabled
    if (config.parsing.auto_parse_on_import) {
      try {
        await this.parseCode(codeFile.id);
      } catch (error) {
        this.log('warn', 'Auto-parse failed', { file: codeFile.name, error: error.message });
      }
    }
    
    this.emit('code-imported', { file: codeFile });
    
    return codeFile;
  }

  async analyzeCode(fileId: string): Promise<CodeAnalysisResult> {
    const codeFile = this.codeFiles.get(fileId);
    if (!codeFile) {
      throw new Error(`Code file not found: ${fileId}`);
    }
    
    this.log('info', 'Analyzing code', { file: codeFile.name });
    
    // Parse if not already parsed
    if (!codeFile.structure) {
      await this.parseCode(fileId);
    }
    
    // Calculate metrics
    const metrics = await this.calculateMetrics(codeFile);
    
    // Detect issues
    const issues = await this.detectIssues(codeFile);
    
    // Find KB links
    const kbLinks = this.kbLinks.get(fileId) || [];
    
    // Generate AI insights if enabled
    let aiInsights: AIInsight[] = [];
    if ((this.config as CodeAnalysisConfig).ai_integration.enabled && this.aiService) {
      aiInsights = await this.generateAIInsights(codeFile);
    }
    
    // Update stored file
    codeFile.metrics = metrics;
    codeFile.issues = issues;
    await this.persistCodeFile(codeFile);
    
    const result: CodeAnalysisResult = {
      file: codeFile,
      structure: codeFile.structure!,
      metrics,
      issues,
      kb_links: kbLinks,
      ai_insights: aiInsights
    };
    
    this.emit('code-analyzed', result);
    
    return result;
  }

  async parseCode(fileId: string): Promise<ProgramStructure> {
    const codeFile = this.codeFiles.get(fileId);
    if (!codeFile) {
      throw new Error(`Code file not found: ${fileId}`);
    }
    
    this.log('info', 'Parsing code', { file: codeFile.name, type: codeFile.type });
    
    let structure: ProgramStructure;
    
    switch (codeFile.type) {
      case 'cobol':
        structure = await this.parseCOBOL(codeFile.content);
        break;
      case 'jcl':
        structure = await this.parseJCL(codeFile.content);
        break;
      case 'copybook':
        structure = await this.parseCopybook(codeFile.content);
        break;
      default:
        structure = await this.parseGeneric(codeFile.content);
    }
    
    // Update file with structure
    codeFile.structure = structure;
    codeFile.parsed_at = new Date();
    await this.persistCodeFile(codeFile);
    
    // Auto-link KB entries if enabled
    if ((this.config as CodeAnalysisConfig).analysis.auto_link_kb_entries) {
      await this.autoLinkKBEntries(fileId);
    }
    
    this.emit('code-parsed', { file: codeFile, structure });
    
    return structure;
  }

  private async parseCOBOL(content: string): Promise<ProgramStructure> {
    const lines = content.split('\n');
    const structure: ProgramStructure = {
      program_name: '',
      divisions: [],
      paragraphs: [],
      variables: [],
      calls: [],
      files: [],
      copybooks: []
    };

    let currentDivision: Division | null = null;
    let currentSection: Section | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      
      // Skip comments and blank lines
      if (line.length < 7 || line[6] === '*' || line.trim() === '') {
        continue;
      }
      
      // Get code portion (columns 8-72)
      const code = line.substring(7, 72).trim();
      if (!code) continue;
      
      // Parse program name
      if (code.startsWith('PROGRAM-ID.')) {
        structure.program_name = code.substring(11).trim().replace('.', '');
      }
      
      // Parse divisions
      if (code.includes('IDENTIFICATION DIVISION')) {
        currentDivision = this.createDivision('identification', lineNumber);
        structure.divisions.push(currentDivision);
      } else if (code.includes('ENVIRONMENT DIVISION')) {
        if (currentDivision) currentDivision.end_line = lineNumber - 1;
        currentDivision = this.createDivision('environment', lineNumber);
        structure.divisions.push(currentDivision);
      } else if (code.includes('DATA DIVISION')) {
        if (currentDivision) currentDivision.end_line = lineNumber - 1;
        currentDivision = this.createDivision('data', lineNumber);
        structure.divisions.push(currentDivision);
      } else if (code.includes('PROCEDURE DIVISION')) {
        if (currentDivision) currentDivision.end_line = lineNumber - 1;
        currentDivision = this.createDivision('procedure', lineNumber);
        structure.divisions.push(currentDivision);
      }
      
      // Parse variables in DATA DIVISION
      if (currentDivision?.type === 'data') {
        const variable = this.parseVariable(code, lineNumber);
        if (variable) {
          structure.variables.push(variable);
        }
      }
      
      // Parse CALL statements
      if (code.includes('CALL')) {
        const call = this.parseCall(code, lineNumber);
        if (call) {
          structure.calls.push(call);
        }
      }
      
      // Parse COPY statements
      if (code.includes('COPY')) {
        const copybook = this.parseCopy(code);
        if (copybook) {
          structure.copybooks.push(copybook);
        }
      }
      
      // Parse paragraphs in PROCEDURE DIVISION
      if (currentDivision?.type === 'procedure' && this.isParagraphStart(code)) {
        const paragraph = this.parseParagraph(code, lineNumber, lines, lineNumber);
        if (paragraph) {
          structure.paragraphs.push(paragraph);
        }
      }
    }
    
    // Close last division
    if (currentDivision) {
      currentDivision.end_line = lineNumber;
    }
    
    return structure;
  }

  private createDivision(type: Division['type'], startLine: number): Division {
    return {
      name: type.toUpperCase() + ' DIVISION',
      type,
      start_line: startLine,
      end_line: startLine,
      sections: []
    };
  }

  private parseVariable(code: string, lineNumber: number): Variable | null {
    const match = code.match(/^\s*(\d{2})\s+([A-Z0-9-]+)(?:\s+PIC\s+([X9SVP().]+))?/);
    if (match) {
      return {
        name: match[2],
        level: match[1],
        type: this.determineVariableType(match[3] || ''),
        picture: match[3],
        line_defined: lineNumber,
        references: []
      };
    }
    return null;
  }

  private parseCall(code: string, lineNumber: number): Call | null {
    const match = code.match(/CALL\s+['"]([^'"]+)['"]|CALL\s+([A-Z0-9-]+)/);
    if (match) {
      return {
        program_name: match[1] || match[2],
        line: lineNumber,
        type: match[1] ? 'static' : 'dynamic'
      };
    }
    return null;
  }

  private parseCopy(code: string): string | null {
    const match = code.match(/COPY\s+([A-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  private isParagraphStart(code: string): boolean {
    return /^[A-Z0-9-]+\.?\s*$/.test(code) && !code.includes('DIVISION') && !code.includes('SECTION');
  }

  private parseParagraph(code: string, startLine: number, lines: string[], currentIndex: number): Paragraph | null {
    const paragraphName = code.replace('.', '').trim();
    
    // Find end of paragraph (next paragraph or end of program)
    let endLine = startLine;
    for (let i = currentIndex; i < lines.length; i++) {
      const nextLine = lines[i];
      if (nextLine && this.isParagraphStart(nextLine.substring(7, 72).trim())) {
        endLine = i;
        break;
      }
    }
    
    return {
      name: paragraphName,
      start_line: startLine,
      end_line: endLine,
      complexity: this.calculateParagraphComplexity(lines.slice(currentIndex, endLine)),
      calls_made: [],
      variables_used: []
    };
  }

  private determineVariableType(picture: string): string {
    if (!picture) return 'unknown';
    if (picture.includes('X')) return 'alphanumeric';
    if (picture.includes('9')) return 'numeric';
    if (picture.includes('S')) return 'signed';
    if (picture.includes('V')) return 'decimal';
    return 'other';
  }

  private calculateParagraphComplexity(lines: string[]): number {
    let complexity = 1; // Base complexity
    
    for (const line of lines) {
      const code = line.substring(7, 72).trim().toUpperCase();
      
      // Decision points increase complexity
      if (code.includes('IF') || code.includes('EVALUATE') || code.includes('PERFORM UNTIL')) {
        complexity++;
      }
      
      // Loops increase complexity
      if (code.includes('PERFORM') && code.includes('TIMES')) {
        complexity++;
      }
    }
    
    return complexity;
  }

  private async parseJCL(content: string): Promise<ProgramStructure> {
    // Simplified JCL parsing
    return {
      program_name: 'JCL_JOB',
      divisions: [],
      paragraphs: [],
      variables: [],
      calls: [],
      files: [],
      copybooks: []
    };
  }

  private async parseCopybook(content: string): Promise<ProgramStructure> {
    // Simplified copybook parsing - similar to COBOL but data-focused
    return await this.parseCOBOL(content);
  }

  private async parseGeneric(content: string): Promise<ProgramStructure> {
    // Generic parsing for unknown file types
    return {
      program_name: 'UNKNOWN',
      divisions: [],
      paragraphs: [],
      variables: [],
      calls: [],
      files: [],
      copybooks: []
    };
  }

  private async calculateMetrics(codeFile: CodeFile): Promise<CodeMetrics> {
    const content = codeFile.content;
    const lines = content.split('\n');
    
    // Basic metrics calculation
    const linesOfCode = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('*') && 
      line.length > 6
    ).length;
    
    const commentLines = lines.filter(line => 
      line.length > 6 && line[6] === '*'
    ).length;
    
    const commentRatio = linesOfCode > 0 ? commentLines / linesOfCode : 0;
    
    // Complexity score based on structure
    let complexityScore = 1;
    if (codeFile.structure) {
      complexityScore = codeFile.structure.paragraphs.reduce(
        (sum, p) => sum + p.complexity, 0
      ) / Math.max(codeFile.structure.paragraphs.length, 1);
    }
    
    // Maintainability index (simplified)
    const maintainabilityIndex = Math.max(0, 
      100 - complexityScore * 5 - Math.max(0, linesOfCode - 100) * 0.1
    );
    
    return {
      complexity_score: complexityScore,
      maintainability_index: maintainabilityIndex,
      lines_of_code: linesOfCode,
      comment_ratio: commentRatio,
      duplicate_code_ratio: 0, // TODO: Implement duplicate detection
      performance_score: 75, // TODO: Implement performance analysis
      security_score: 80 // TODO: Implement security analysis
    };
  }

  private async detectIssues(codeFile: CodeFile): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const config = this.config as CodeAnalysisConfig;
    const lines = codeFile.content.split('\n');
    
    // Standards checking
    if (config.analysis.standards_checking) {
      issues.push(...this.checkStandards(lines));
    }
    
    // Complexity analysis
    if (config.analysis.complexity_analysis && codeFile.structure) {
      issues.push(...this.checkComplexity(codeFile.structure));
    }
    
    // Performance analysis
    if (config.analysis.performance_analysis) {
      issues.push(...this.checkPerformance(lines));
    }
    
    // Security analysis
    if (config.analysis.security_analysis) {
      issues.push(...this.checkSecurity(lines));
    }
    
    return issues;
  }

  private checkStandards(lines: string[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check line length (columns 1-72)
      if (line.length > 72) {
        issues.push({
          id: `std-${lineNum}-length`,
          type: 'warning',
          severity: 'medium',
          category: 'standards',
          line: lineNum,
          message: 'Line exceeds 72 characters',
          description: 'COBOL code should not extend beyond column 72',
          auto_fixable: false
        });
      }
      
      // Check for non-standard column usage
      if (line.length > 6 && line[6] !== ' ' && line[6] !== '*') {
        const char = line[6];
        if (char !== '/' && char !== '-') {
          issues.push({
            id: `std-${lineNum}-column7`,
            type: 'error',
            severity: 'high',
            category: 'standards',
            line: lineNum,
            column: 7,
            message: 'Invalid character in column 7',
            description: 'Column 7 should contain space, *, /, or -',
            auto_fixable: true,
            suggestion: 'Replace with space'
          });
        }
      }
    });
    
    return issues;
  }

  private checkComplexity(structure: ProgramStructure): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const config = this.config as CodeAnalysisConfig;
    
    structure.paragraphs.forEach(paragraph => {
      if (paragraph.complexity > config.quality_gates.max_complexity_score) {
        issues.push({
          id: `complex-${paragraph.name}`,
          type: 'warning',
          severity: 'high',
          category: 'maintainability',
          line: paragraph.start_line,
          message: `High complexity: ${paragraph.complexity}`,
          description: `Paragraph exceeds maximum complexity of ${config.quality_gates.max_complexity_score}`,
          suggestion: 'Consider breaking into smaller paragraphs',
          auto_fixable: false
        });
      }
    });
    
    return issues;
  }

  private checkPerformance(lines: string[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const code = line.substring(7, 72).trim().toUpperCase();
      
      // Check for inefficient PERFORM statements
      if (code.includes('PERFORM') && code.includes('UNTIL') && !code.includes('WITH TEST')) {
        issues.push({
          id: `perf-${lineNum}-perform`,
          type: 'suggestion',
          severity: 'low',
          category: 'performance',
          line: lineNum,
          message: 'Consider using WITH TEST BEFORE/AFTER',
          description: 'Explicit test timing can improve performance',
          suggestion: 'Add WITH TEST BEFORE or WITH TEST AFTER clause',
          auto_fixable: false
        });
      }
    });
    
    return issues;
  }

  private checkSecurity(lines: string[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const code = line.substring(7, 72).trim();
      
      // Check for hardcoded passwords or sensitive data
      if (/password|passwd|pwd/i.test(code) && /['"][^'"]*['"]/.test(code)) {
        issues.push({
          id: `sec-${lineNum}-hardcoded`,
          type: 'warning',
          severity: 'critical',
          category: 'security',
          line: lineNum,
          message: 'Potential hardcoded sensitive data',
          description: 'Hardcoded passwords or sensitive data should be avoided',
          suggestion: 'Use external configuration or secure storage',
          auto_fixable: false
        });
      }
    });
    
    return issues;
  }

  // ========================
  // KB Linking Methods
  // ========================

  async linkKBEntry(kbEntryId: string, fileId: string, startLine: number, endLine?: number): Promise<KBCodeLink> {
    const link: KBCodeLink = {
      id: `${kbEntryId}-${fileId}-${startLine}`,
      kb_entry_id: kbEntryId,
      code_file_id: fileId,
      start_line: startLine,
      end_line: endLine,
      link_type: 'manual',
      confidence: 100,
      created_at: new Date(),
      verified: true
    };
    
    // Store link
    if (!this.kbLinks.has(fileId)) {
      this.kbLinks.set(fileId, []);
    }
    this.kbLinks.get(fileId)!.push(link);
    
    await this.persistKBLink(link);
    
    this.emit('kb-linked', { link });
    
    return link;
  }

  async autoLinkKBEntries(fileId: string): Promise<KBCodeLink[]> {
    const codeFile = this.codeFiles.get(fileId);
    if (!codeFile) {
      throw new Error(`Code file not found: ${fileId}`);
    }
    
    // Get all KB entries
    const kbEntries = await this.adapter.executeSQL('SELECT * FROM kb_entries');
    const links: KBCodeLink[] = [];
    
    // Simple auto-linking based on error patterns
    for (const entry of kbEntries) {
      const confidence = this.calculateLinkConfidence(entry, codeFile);
      
      if (confidence > 70) {
        const lines = this.findRelevantLines(entry, codeFile);
        
        if (lines.length > 0) {
          const link: KBCodeLink = {
            id: `auto-${entry.id}-${fileId}-${lines[0]}`,
            kb_entry_id: entry.id,
            code_file_id: fileId,
            start_line: lines[0],
            end_line: lines[lines.length - 1],
            link_type: 'auto',
            confidence,
            description: `Auto-linked based on ${confidence}% confidence`,
            created_at: new Date(),
            verified: false
          };
          
          links.push(link);
          
          if (!this.kbLinks.has(fileId)) {
            this.kbLinks.set(fileId, []);
          }
          this.kbLinks.get(fileId)!.push(link);
          
          await this.persistKBLink(link);
        }
      }
    }
    
    this.log('info', 'Auto-linked KB entries', { file: codeFile.name, links: links.length });
    
    return links;
  }

  private calculateLinkConfidence(kbEntry: any, codeFile: CodeFile): number {
    let confidence = 0;
    const content = codeFile.content.toLowerCase();
    const problem = kbEntry.problem.toLowerCase();
    const solution = kbEntry.solution.toLowerCase();
    
    // Check for error codes in KB entry
    const errorCodes = this.extractErrorCodes(problem + ' ' + solution);
    for (const code of errorCodes) {
      if (content.includes(code.toLowerCase())) {
        confidence += 30;
      }
    }
    
    // Check for common keywords
    const keywords = this.extractKeywords(problem);
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        confidence += 10;
      }
    }
    
    // Check category match
    if (kbEntry.category && codeFile.type === 'cobol' && kbEntry.category !== 'JCL') {
      confidence += 20;
    }
    
    return Math.min(100, confidence);
  }

  private findRelevantLines(kbEntry: any, codeFile: CodeFile): number[] {
    const lines = codeFile.content.split('\n');
    const relevantLines: number[] = [];
    
    const errorCodes = this.extractErrorCodes(kbEntry.problem + ' ' + kbEntry.solution);
    
    lines.forEach((line, index) => {
      for (const code of errorCodes) {
        if (line.toLowerCase().includes(code.toLowerCase())) {
          relevantLines.push(index + 1);
        }
      }
    });
    
    return relevantLines;
  }

  private extractErrorCodes(text: string): string[] {
    const patterns = [
      /S0C\d/gi,
      /U\d{4}/gi,
      /IEF\d{3}[A-Z]/gi,
      /VSAM STATUS \d{2}/gi,
      /SQLCODE -?\d+/gi,
      /WER\d{3}[A-Z]/gi
    ];
    
    const codes: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        codes.push(...matches);
      }
    }
    
    return [...new Set(codes)];
  }

  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^(the|and|for|with|that|this|from|have|been|will|would|could|should)$/.test(word))
      .slice(0, 10);
  }

  // ========================
  // AI Integration Methods
  // ========================

  async explainCode(fileId: string, startLine: number, endLine: number): Promise<string> {
    const codeFile = this.codeFiles.get(fileId);
    if (!codeFile) {
      throw new Error(`Code file not found: ${fileId}`);
    }
    
    if (!this.aiService) {
      return 'AI service not available for code explanation';
    }
    
    const lines = codeFile.content.split('\n');
    const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');
    
    try {
      const explanation = await this.aiService.explainCode(codeSnippet, codeFile.type);
      
      this.emit('code-explained', {
        file: codeFile.name,
        lines: `${startLine}-${endLine}`,
        explanation
      });
      
      return explanation;
    } catch (error) {
      this.handleError(error as Error);
      return 'Unable to generate code explanation';
    }
  }

  private async generateAIInsights(codeFile: CodeFile): Promise<AIInsight[]> {
    if (!this.aiService) return [];
    
    const config = this.config as CodeAnalysisConfig;
    const insights: AIInsight[] = [];
    
    // Generate insights for complex paragraphs
    if (config.ai_integration.explain_complex_logic && codeFile.structure) {
      for (const paragraph of codeFile.structure.paragraphs) {
        if (paragraph.complexity > 5) {
          const explanation = await this.aiService.explainComplexLogic(
            codeFile.content,
            paragraph.start_line,
            paragraph.end_line
          );
          
          insights.push({
            type: 'explanation',
            confidence: 80,
            message: explanation,
            line_start: paragraph.start_line,
            line_end: paragraph.end_line
          });
        }
      }
    }
    
    return insights;
  }

  // ========================
  // Database Operations
  // ========================

  private async createTables(): Promise<void> {
    const createCodeFilesTable = `
      CREATE TABLE IF NOT EXISTS code_files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        size_bytes INTEGER,
        line_count INTEGER,
        parsed_at DATETIME,
        structure TEXT, -- JSON
        metrics TEXT, -- JSON
        issues TEXT, -- JSON
        last_modified DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createKBLinksTable = `
      CREATE TABLE IF NOT EXISTS kb_code_links (
        id TEXT PRIMARY KEY,
        kb_entry_id TEXT NOT NULL,
        code_file_id TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER,
        link_type TEXT NOT NULL,
        confidence INTEGER,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id),
        FOREIGN KEY (code_file_id) REFERENCES code_files(id)
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_code_files_type ON code_files(type);
      CREATE INDEX IF NOT EXISTS idx_code_files_name ON code_files(name);
      CREATE INDEX IF NOT EXISTS idx_kb_links_kb_entry ON kb_code_links(kb_entry_id);
      CREATE INDEX IF NOT EXISTS idx_kb_links_code_file ON kb_code_links(code_file_id);
      CREATE INDEX IF NOT EXISTS idx_kb_links_confidence ON kb_code_links(confidence);
    `;
    
    await this.adapter.executeSQL(createCodeFilesTable);
    await this.adapter.executeSQL(createKBLinksTable);
    await this.adapter.executeSQL(createIndexes);
  }

  private async loadExistingCodeFiles(): Promise<void> {
    const files = await this.adapter.executeSQL('SELECT * FROM code_files ORDER BY created_at DESC');
    
    files.forEach((row: any) => {
      const codeFile: CodeFile = {
        id: row.id,
        name: row.name,
        path: row.path,
        type: row.type,
        content: row.content,
        size_bytes: row.size_bytes,
        line_count: row.line_count,
        parsed_at: row.parsed_at ? new Date(row.parsed_at) : undefined,
        structure: row.structure ? JSON.parse(row.structure) : undefined,
        metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
        issues: row.issues ? JSON.parse(row.issues) : undefined,
        last_modified: row.last_modified ? new Date(row.last_modified) : undefined
      };
      
      this.codeFiles.set(codeFile.id, codeFile);
    });
  }

  private async loadExistingKBLinks(): Promise<void> {
    const links = await this.adapter.executeSQL('SELECT * FROM kb_code_links ORDER BY created_at DESC');
    
    links.forEach((row: any) => {
      const link: KBCodeLink = {
        id: row.id,
        kb_entry_id: row.kb_entry_id,
        code_file_id: row.code_file_id,
        start_line: row.start_line,
        end_line: row.end_line,
        link_type: row.link_type,
        confidence: row.confidence,
        description: row.description,
        created_at: new Date(row.created_at),
        verified: row.verified
      };
      
      if (!this.kbLinks.has(link.code_file_id)) {
        this.kbLinks.set(link.code_file_id, []);
      }
      this.kbLinks.get(link.code_file_id)!.push(link);
    });
  }

  private async persistCodeFile(codeFile: CodeFile): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO code_files 
      (id, name, path, type, content, size_bytes, line_count, parsed_at, structure, metrics, issues, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.adapter.executeSQL(sql, [
      codeFile.id,
      codeFile.name,
      codeFile.path,
      codeFile.type,
      codeFile.content,
      codeFile.size_bytes,
      codeFile.line_count,
      codeFile.parsed_at?.toISOString(),
      codeFile.structure ? JSON.stringify(codeFile.structure) : null,
      codeFile.metrics ? JSON.stringify(codeFile.metrics) : null,
      codeFile.issues ? JSON.stringify(codeFile.issues) : null,
      codeFile.last_modified?.toISOString()
    ]);
  }

  private async persistKBLink(link: KBCodeLink): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO kb_code_links 
      (id, kb_entry_id, code_file_id, start_line, end_line, link_type, confidence, description, created_at, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.adapter.executeSQL(sql, [
      link.id,
      link.kb_entry_id,
      link.code_file_id,
      link.start_line,
      link.end_line,
      link.link_type,
      link.confidence,
      link.description,
      link.created_at.toISOString(),
      link.verified
    ]);
  }

  private async persistCodeFiles(): Promise<void> {
    for (const codeFile of this.codeFiles.values()) {
      await this.persistCodeFile(codeFile);
    }
  }

  private async persistKBLinks(): Promise<void> {
    for (const links of this.kbLinks.values()) {
      for (const link of links) {
        await this.persistKBLink(link);
      }
    }
  }

  // ========================
  // Helper Methods
  // ========================

  private generateFileId(filePath: string): string {
    return `file-${Date.now()}-${this.hash(filePath)}`;
  }

  private extractFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ========================
  // Public API Methods
  // ========================

  async findCodeForKBEntry(kbEntryId: string): Promise<KBCodeLink[]> {
    const allLinks: KBCodeLink[] = [];
    
    for (const links of this.kbLinks.values()) {
      allLinks.push(...links.filter(link => link.kb_entry_id === kbEntryId));
    }
    
    return allLinks;
  }

  async getCodeMetrics(fileId: string): Promise<CodeMetrics | null> {
    const codeFile = this.codeFiles.get(fileId);
    return codeFile?.metrics || null;
  }

  async getCodeIssues(fileId: string, severity?: string): Promise<CodeIssue[]> {
    const codeFile = this.codeFiles.get(fileId);
    if (!codeFile?.issues) return [];
    
    if (severity) {
      return codeFile.issues.filter(issue => issue.severity === severity);
    }
    
    return codeFile.issues;
  }

  async suggestImprovements(fileId: string): Promise<string[]> {
    const codeFile = this.codeFiles.get(fileId);
    if (!codeFile) return [];
    
    const suggestions: string[] = [];
    
    // Suggest based on metrics
    if (codeFile.metrics) {
      if (codeFile.metrics.complexity_score > 10) {
        suggestions.push('Consider breaking down complex paragraphs into smaller, more manageable sections');
      }
      
      if (codeFile.metrics.comment_ratio < 0.1) {
        suggestions.push('Add more comments to improve code documentation');
      }
      
      if (codeFile.metrics.maintainability_index < 60) {
        suggestions.push('Refactor code to improve maintainability');
      }
    }
    
    // Suggest based on issues
    if (codeFile.issues) {
      const criticalIssues = codeFile.issues.filter(issue => issue.severity === 'critical');
      if (criticalIssues.length > 0) {
        suggestions.push(`Address ${criticalIssues.length} critical issues first`);
      }
    }
    
    return suggestions;
  }
}