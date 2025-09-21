"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeAnalysisPlugin = void 0;
const BaseStoragePlugin_1 = require("./BaseStoragePlugin");
class CodeAnalysisPlugin extends BaseStoragePlugin_1.BaseStoragePlugin {
    codeFiles = new Map();
    kbLinks = new Map();
    aiService;
    constructor(adapter, config = {}) {
        super(adapter, config);
    }
    getName() {
        return 'code-analysis';
    }
    getVersion() {
        return '3.0.0';
    }
    getDescription() {
        return 'Provides code analysis, linking, and AI-powered code assistance';
    }
    getMVPVersion() {
        return 3;
    }
    getDependencies() {
        return ['full-text-search', 'raw-sql'];
    }
    getDefaultConfig() {
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
                enabled: false,
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
        };
    }
    async initializePlugin() {
        await this.createTables();
        await this.loadExistingCodeFiles();
        await this.loadExistingKBLinks();
        this.log('info', 'Code analysis plugin initialized', {
            code_files_loaded: this.codeFiles.size,
            kb_links_loaded: Array.from(this.kbLinks.values()).flat().length
        });
    }
    async cleanupPlugin() {
        await this.persistCodeFiles();
        await this.persistKBLinks();
        this.log('info', 'Code analysis plugin cleaned up');
    }
    async processData(data, context) {
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
    async importCode(filePath, content, type = 'cobol') {
        const config = this.config;
        const sizeBytes = Buffer.from(content, 'utf8').length;
        const sizeMB = sizeBytes / (1024 * 1024);
        if (sizeMB > config.parsing.max_file_size_mb) {
            throw new Error(`File too large: ${sizeMB.toFixed(2)}MB (max: ${config.parsing.max_file_size_mb}MB)`);
        }
        const codeFile = {
            id: this.generateFileId(filePath),
            name: this.extractFileName(filePath),
            path: filePath,
            type,
            content,
            size_bytes: sizeBytes,
            line_count: content.split('\n').length,
            last_modified: new Date()
        };
        this.codeFiles.set(codeFile.id, codeFile);
        await this.persistCodeFile(codeFile);
        if (config.parsing.auto_parse_on_import) {
            try {
                await this.parseCode(codeFile.id);
            }
            catch (error) {
                this.log('warn', 'Auto-parse failed', { file: codeFile.name, error: error.message });
            }
        }
        this.emit('code-imported', { file: codeFile });
        return codeFile;
    }
    async analyzeCode(fileId) {
        const codeFile = this.codeFiles.get(fileId);
        if (!codeFile) {
            throw new Error(`Code file not found: ${fileId}`);
        }
        this.log('info', 'Analyzing code', { file: codeFile.name });
        if (!codeFile.structure) {
            await this.parseCode(fileId);
        }
        const metrics = await this.calculateMetrics(codeFile);
        const issues = await this.detectIssues(codeFile);
        const kbLinks = this.kbLinks.get(fileId) || [];
        let aiInsights = [];
        if (this.config.ai_integration.enabled && this.aiService) {
            aiInsights = await this.generateAIInsights(codeFile);
        }
        codeFile.metrics = metrics;
        codeFile.issues = issues;
        await this.persistCodeFile(codeFile);
        const result = {
            file: codeFile,
            structure: codeFile.structure,
            metrics,
            issues,
            kb_links: kbLinks,
            ai_insights: aiInsights
        };
        this.emit('code-analyzed', result);
        return result;
    }
    async parseCode(fileId) {
        const codeFile = this.codeFiles.get(fileId);
        if (!codeFile) {
            throw new Error(`Code file not found: ${fileId}`);
        }
        this.log('info', 'Parsing code', { file: codeFile.name, type: codeFile.type });
        let structure;
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
        codeFile.structure = structure;
        codeFile.parsed_at = new Date();
        await this.persistCodeFile(codeFile);
        if (this.config.analysis.auto_link_kb_entries) {
            await this.autoLinkKBEntries(fileId);
        }
        this.emit('code-parsed', { file: codeFile, structure });
        return structure;
    }
    async parseCOBOL(content) {
        const lines = content.split('\n');
        const structure = {
            program_name: '',
            divisions: [],
            paragraphs: [],
            variables: [],
            calls: [],
            files: [],
            copybooks: []
        };
        let currentDivision = null;
        const currentSection = null;
        let lineNumber = 0;
        for (const line of lines) {
            lineNumber++;
            if (line.length < 7 || line[6] === '*' || line.trim() === '') {
                continue;
            }
            const code = line.substring(7, 72).trim();
            if (!code)
                continue;
            if (code.startsWith('PROGRAM-ID.')) {
                structure.program_name = code.substring(11).trim().replace('.', '');
            }
            if (code.includes('IDENTIFICATION DIVISION')) {
                currentDivision = this.createDivision('identification', lineNumber);
                structure.divisions.push(currentDivision);
            }
            else if (code.includes('ENVIRONMENT DIVISION')) {
                if (currentDivision)
                    currentDivision.end_line = lineNumber - 1;
                currentDivision = this.createDivision('environment', lineNumber);
                structure.divisions.push(currentDivision);
            }
            else if (code.includes('DATA DIVISION')) {
                if (currentDivision)
                    currentDivision.end_line = lineNumber - 1;
                currentDivision = this.createDivision('data', lineNumber);
                structure.divisions.push(currentDivision);
            }
            else if (code.includes('PROCEDURE DIVISION')) {
                if (currentDivision)
                    currentDivision.end_line = lineNumber - 1;
                currentDivision = this.createDivision('procedure', lineNumber);
                structure.divisions.push(currentDivision);
            }
            if (currentDivision?.type === 'data') {
                const variable = this.parseVariable(code, lineNumber);
                if (variable) {
                    structure.variables.push(variable);
                }
            }
            if (code.includes('CALL')) {
                const call = this.parseCall(code, lineNumber);
                if (call) {
                    structure.calls.push(call);
                }
            }
            if (code.includes('COPY')) {
                const copybook = this.parseCopy(code);
                if (copybook) {
                    structure.copybooks.push(copybook);
                }
            }
            if (currentDivision?.type === 'procedure' && this.isParagraphStart(code)) {
                const paragraph = this.parseParagraph(code, lineNumber, lines, lineNumber);
                if (paragraph) {
                    structure.paragraphs.push(paragraph);
                }
            }
        }
        if (currentDivision) {
            currentDivision.end_line = lineNumber;
        }
        return structure;
    }
    createDivision(type, startLine) {
        return {
            name: `${type.toUpperCase()  } DIVISION`,
            type,
            start_line: startLine,
            end_line: startLine,
            sections: []
        };
    }
    parseVariable(code, lineNumber) {
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
    parseCall(code, lineNumber) {
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
    parseCopy(code) {
        const match = code.match(/COPY\s+([A-Z0-9-]+)/);
        return match ? match[1] : null;
    }
    isParagraphStart(code) {
        return /^[A-Z0-9-]+\.?\s*$/.test(code) && !code.includes('DIVISION') && !code.includes('SECTION');
    }
    parseParagraph(code, startLine, lines, currentIndex) {
        const paragraphName = code.replace('.', '').trim();
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
    determineVariableType(picture) {
        if (!picture)
            return 'unknown';
        if (picture.includes('X'))
            return 'alphanumeric';
        if (picture.includes('9'))
            return 'numeric';
        if (picture.includes('S'))
            return 'signed';
        if (picture.includes('V'))
            return 'decimal';
        return 'other';
    }
    calculateParagraphComplexity(lines) {
        let complexity = 1;
        for (const line of lines) {
            const code = line.substring(7, 72).trim().toUpperCase();
            if (code.includes('IF') || code.includes('EVALUATE') || code.includes('PERFORM UNTIL')) {
                complexity++;
            }
            if (code.includes('PERFORM') && code.includes('TIMES')) {
                complexity++;
            }
        }
        return complexity;
    }
    async parseJCL(content) {
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
    async parseCopybook(content) {
        return await this.parseCOBOL(content);
    }
    async parseGeneric(content) {
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
    async calculateMetrics(codeFile) {
        const content = codeFile.content;
        const lines = content.split('\n');
        const linesOfCode = lines.filter(line => line.trim() &&
            !line.trim().startsWith('*') &&
            line.length > 6).length;
        const commentLines = lines.filter(line => line.length > 6 && line[6] === '*').length;
        const commentRatio = linesOfCode > 0 ? commentLines / linesOfCode : 0;
        let complexityScore = 1;
        if (codeFile.structure) {
            complexityScore = codeFile.structure.paragraphs.reduce((sum, p) => sum + p.complexity, 0) / Math.max(codeFile.structure.paragraphs.length, 1);
        }
        const maintainabilityIndex = Math.max(0, 100 - complexityScore * 5 - Math.max(0, linesOfCode - 100) * 0.1);
        return {
            complexity_score: complexityScore,
            maintainability_index: maintainabilityIndex,
            lines_of_code: linesOfCode,
            comment_ratio: commentRatio,
            duplicate_code_ratio: 0,
            performance_score: 75,
            security_score: 80
        };
    }
    async detectIssues(codeFile) {
        const issues = [];
        const config = this.config;
        const lines = codeFile.content.split('\n');
        if (config.analysis.standards_checking) {
            issues.push(...this.checkStandards(lines));
        }
        if (config.analysis.complexity_analysis && codeFile.structure) {
            issues.push(...this.checkComplexity(codeFile.structure));
        }
        if (config.analysis.performance_analysis) {
            issues.push(...this.checkPerformance(lines));
        }
        if (config.analysis.security_analysis) {
            issues.push(...this.checkSecurity(lines));
        }
        return issues;
    }
    checkStandards(lines) {
        const issues = [];
        lines.forEach((line, index) => {
            const lineNum = index + 1;
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
    checkComplexity(structure) {
        const issues = [];
        const config = this.config;
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
    checkPerformance(lines) {
        const issues = [];
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const code = line.substring(7, 72).trim().toUpperCase();
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
    checkSecurity(lines) {
        const issues = [];
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const code = line.substring(7, 72).trim();
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
    async linkKBEntry(kbEntryId, fileId, startLine, endLine) {
        const link = {
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
        if (!this.kbLinks.has(fileId)) {
            this.kbLinks.set(fileId, []);
        }
        this.kbLinks.get(fileId).push(link);
        await this.persistKBLink(link);
        this.emit('kb-linked', { link });
        return link;
    }
    async autoLinkKBEntries(fileId) {
        const codeFile = this.codeFiles.get(fileId);
        if (!codeFile) {
            throw new Error(`Code file not found: ${fileId}`);
        }
        const kbEntries = await this.adapter.executeSQL('SELECT * FROM kb_entries');
        const links = [];
        for (const entry of kbEntries) {
            const confidence = this.calculateLinkConfidence(entry, codeFile);
            if (confidence > 70) {
                const lines = this.findRelevantLines(entry, codeFile);
                if (lines.length > 0) {
                    const link = {
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
                    this.kbLinks.get(fileId).push(link);
                    await this.persistKBLink(link);
                }
            }
        }
        this.log('info', 'Auto-linked KB entries', { file: codeFile.name, links: links.length });
        return links;
    }
    calculateLinkConfidence(kbEntry, codeFile) {
        let confidence = 0;
        const content = codeFile.content.toLowerCase();
        const problem = kbEntry.problem.toLowerCase();
        const solution = kbEntry.solution.toLowerCase();
        const errorCodes = this.extractErrorCodes(`${problem  } ${  solution}`);
        for (const code of errorCodes) {
            if (content.includes(code.toLowerCase())) {
                confidence += 30;
            }
        }
        const keywords = this.extractKeywords(problem);
        for (const keyword of keywords) {
            if (content.includes(keyword.toLowerCase())) {
                confidence += 10;
            }
        }
        if (kbEntry.category && codeFile.type === 'cobol' && kbEntry.category !== 'JCL') {
            confidence += 20;
        }
        return Math.min(100, confidence);
    }
    findRelevantLines(kbEntry, codeFile) {
        const lines = codeFile.content.split('\n');
        const relevantLines = [];
        const errorCodes = this.extractErrorCodes(`${kbEntry.problem  } ${  kbEntry.solution}`);
        lines.forEach((line, index) => {
            for (const code of errorCodes) {
                if (line.toLowerCase().includes(code.toLowerCase())) {
                    relevantLines.push(index + 1);
                }
            }
        });
        return relevantLines;
    }
    extractErrorCodes(text) {
        const patterns = [
            /S0C\d/gi,
            /U\d{4}/gi,
            /IEF\d{3}[A-Z]/gi,
            /VSAM STATUS \d{2}/gi,
            /SQLCODE -?\d+/gi,
            /WER\d{3}[A-Z]/gi
        ];
        const codes = [];
        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
                codes.push(...matches);
            }
        }
        return [...new Set(codes)];
    }
    extractKeywords(text) {
        return text.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !/^(the|and|for|with|that|this|from|have|been|will|would|could|should)$/.test(word))
            .slice(0, 10);
    }
    async explainCode(fileId, startLine, endLine) {
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
        }
        catch (error) {
            this.handleError(error);
            return 'Unable to generate code explanation';
        }
    }
    async generateAIInsights(codeFile) {
        if (!this.aiService)
            return [];
        const config = this.config;
        const insights = [];
        if (config.ai_integration.explain_complex_logic && codeFile.structure) {
            for (const paragraph of codeFile.structure.paragraphs) {
                if (paragraph.complexity > 5) {
                    const explanation = await this.aiService.explainComplexLogic(codeFile.content, paragraph.start_line, paragraph.end_line);
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
    async createTables() {
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
    async loadExistingCodeFiles() {
        const files = await this.adapter.executeSQL('SELECT * FROM code_files ORDER BY created_at DESC');
        files.forEach((row) => {
            const codeFile = {
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
    async loadExistingKBLinks() {
        const links = await this.adapter.executeSQL('SELECT * FROM kb_code_links ORDER BY created_at DESC');
        links.forEach((row) => {
            const link = {
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
            this.kbLinks.get(link.code_file_id).push(link);
        });
    }
    async persistCodeFile(codeFile) {
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
    async persistKBLink(link) {
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
    async persistCodeFiles() {
        for (const codeFile of this.codeFiles.values()) {
            await this.persistCodeFile(codeFile);
        }
    }
    async persistKBLinks() {
        for (const links of this.kbLinks.values()) {
            for (const link of links) {
                await this.persistKBLink(link);
            }
        }
    }
    generateFileId(filePath) {
        return `file-${Date.now()}-${this.hash(filePath)}`;
    }
    extractFileName(filePath) {
        return filePath.split(/[/\\]/).pop() || filePath;
    }
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    async findCodeForKBEntry(kbEntryId) {
        const allLinks = [];
        for (const links of this.kbLinks.values()) {
            allLinks.push(...links.filter(link => link.kb_entry_id === kbEntryId));
        }
        return allLinks;
    }
    async getCodeMetrics(fileId) {
        const codeFile = this.codeFiles.get(fileId);
        return codeFile?.metrics || null;
    }
    async getCodeIssues(fileId, severity) {
        const codeFile = this.codeFiles.get(fileId);
        if (!codeFile?.issues)
            return [];
        if (severity) {
            return codeFile.issues.filter(issue => issue.severity === severity);
        }
        return codeFile.issues;
    }
    async suggestImprovements(fileId) {
        const codeFile = this.codeFiles.get(fileId);
        if (!codeFile)
            return [];
        const suggestions = [];
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
        if (codeFile.issues) {
            const criticalIssues = codeFile.issues.filter(issue => issue.severity === 'critical');
            if (criticalIssues.length > 0) {
                suggestions.push(`Address ${criticalIssues.length} critical issues first`);
            }
        }
        return suggestions;
    }
}
exports.CodeAnalysisPlugin = CodeAnalysisPlugin;
//# sourceMappingURL=CodeAnalysisPlugin.js.map