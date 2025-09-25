/**
 * FTS5 Mainframe Custom Tokenizer
 *
 * Specialized tokenizer for mainframe terminology including:
 * - JCL job control language syntax (//STEP1, DD statements)
 * - VSAM status codes and file operations
 * - COBOL syntax and data definitions
 * - System error codes (S0C7, IEF212I, WER027A)
 * - DB2 SQL codes and operations
 * - CICS transaction identifiers
 *
 * Based on research of common mainframe search patterns and terminology.
 */

export interface MainframeTokenizerConfig {
  preserveErrorCodes: boolean;
  preserveJclSyntax: boolean;
  preserveCobolKeywords: boolean;
  preserveSystemMessages: boolean;
  caseSensitive: boolean;
  stemming: boolean;
}

export interface TokenInfo {
  token: string;
  type: 'error_code' | 'jcl_syntax' | 'cobol_keyword' | 'system_msg' | 'general';
  weight: number;
  position: number;
  stemmed?: string;
}

/**
 * Mainframe-aware FTS5 tokenizer implementation
 *
 * Key features:
 * 1. Preserves mainframe error codes (S0C7, IEF212I, etc.) as single tokens
 * 2. Handles JCL syntax (//STEP, DD NAME=, DISP=)
 * 3. Recognizes COBOL keywords and data definitions
 * 4. Maintains VSAM status codes and file operations
 * 5. Processes DB2 SQL codes appropriately
 * 6. Applies mainframe-specific stemming rules
 */
export class FTS5MainframeTokenizer {
  private config: MainframeTokenizerConfig;

  // Mainframe error code patterns
  private readonly ERROR_CODE_PATTERNS = [
    /^S\d{3}[A-Z]?$/i, // System completion codes: S0C7, S806
    /^[A-Z]{3}\d{3,4}[A-Z]?$/i, // System messages: IEF212I, WER027A
    /^SQLCODE\s*[-]?\d+$/i, // DB2 SQL codes: SQLCODE -904
    /^VSAM\s*STATUS\s*\d+$/i, // VSAM status: VSAM STATUS 35
    /^RC\s*=\s*\d+$/i, // Return codes: RC=8
    /^U\d{4}$/i, // User completion codes: U0778
    /^CEE\d{4}[A-Z]?$/i, // Language Environment: CEE3204S
    /^IGZ\d{4}[A-Z]?$/i, // COBOL runtime: IGZ0035S
    /^IKJ\d{4}[A-Z]?$/i, // TSO/ISPF: IKJ56650I
    /^ICH\d{4}[A-Z]?$/i, // RACF security: ICH408I
    /^ARC\d{4}[A-Z]?$/i, // Archive: ARC1130I
    /^IGD\d{4}[A-Z]?$/i, // SMS/DFSMS: IGD17501I
    /^IEA\d{4}[A-Z]?$/i, // System control: IEA989I
    /^IOS\d{4}[A-Z]?$/i, // I/O Supervisor: IOS020I
    /^IRA\d{4}[A-Z]?$/i, // RSM: IRA050I
    /^ISG\d{4}[A-Z]?$/i, // System Logger: ISG319I
  ];

  // JCL syntax patterns
  private readonly JCL_SYNTAX_PATTERNS = [
    /^\/\/[A-Z0-9@#$]{1,8}$/i, // Job/step names: //MYJOB
    /^\/\/\s*[A-Z0-9@#$]+\s+DD$/i, // DD statements: //SYSIN DD
    /^DISP\s*=\s*\([^)]+\)$/i, // DISP parameter: DISP=(NEW,CATLG)
    /^DSN\s*=\s*[A-Z0-9.@#$]+$/i, // Dataset names: DSN=MY.DATA.SET
    /^SPACE\s*=\s*\([^)]+\)$/i, // SPACE parameter: SPACE=(TRK,(10,5))
    /^UNIT\s*=\s*[A-Z0-9]+$/i, // UNIT parameter: UNIT=SYSDA
    /^VOL\s*=\s*SER\s*=\s*[A-Z0-9]+$/i, // Volume: VOL=SER=VOL001
    /^CLASS\s*=\s*[A-Z0-9]$/i, // Job class: CLASS=A
    /^MSGCLASS\s*=\s*[A-Z0-9]$/i, // Message class: MSGCLASS=H
    /^REGION\s*=\s*\d+[KMG]?$/i, // Region size: REGION=8M
  ];

  // COBOL keyword patterns
  private readonly COBOL_KEYWORDS = [
    'IDENTIFICATION',
    'DIVISION',
    'PROGRAM-ID',
    'ENVIRONMENT',
    'CONFIGURATION',
    'DATA',
    'WORKING-STORAGE',
    'SECTION',
    'PROCEDURE',
    'PERFORM',
    'UNTIL',
    'MOVE',
    'TO',
    'FROM',
    'COMPUTE',
    'ADD',
    'SUBTRACT',
    'MULTIPLY',
    'DIVIDE',
    'IF',
    'THEN',
    'ELSE',
    'END-IF',
    'EVALUATE',
    'WHEN',
    'END-EVALUATE',
    'CALL',
    'USING',
    'RETURNING',
    'GO',
    'STOP',
    'RUN',
    'EXIT',
    'OPEN',
    'CLOSE',
    'READ',
    'WRITE',
    'REWRITE',
    'DELETE',
    'PIC',
    'PICTURE',
    'OCCURS',
    'DEPENDING',
    'ON',
    'REDEFINES',
    'COMP',
    'COMP-3',
    'PACKED-DECIMAL',
    'BINARY',
    'DISPLAY',
    'FILLER',
    'VALUE',
    'SPACES',
    'ZEROS',
    'ZEROES',
    'HIGH-VALUES',
    'LOW-VALUES',
    'ACCEPT',
    'DISPLAY',
    'STRING',
    'UNSTRING',
    'INSPECT',
    'REPLACE',
    'FILE',
    'RECORD',
    'FD',
    'SELECT',
    'ASSIGN',
    'ACCESS',
    'ORGANIZATION',
    'SEQUENTIAL',
    'INDEXED',
    'RELATIVE',
    'DYNAMIC',
    'RANDOM',
    'VSAM',
    'QSAM',
    'BSAM',
    'ISAM',
    'KEY',
    'ALTERNATE',
    'COPY',
    'COPYBOOK',
    'REPLACING',
    'LEADING',
    'BY',
    'LINKAGE',
    'POINTER',
    'REFERENCE',
    'MODIFICATION',
    'LENGTH',
    'OF',
  ];

  // System message type keywords
  private readonly SYSTEM_MSG_KEYWORDS = [
    'ABEND',
    'COMPLETION',
    'CODE',
    'ERROR',
    'WARNING',
    'INFORMATION',
    'CANCELLED',
    'FAILED',
    'SUCCESSFUL',
    'TERMINATED',
    'INITIATED',
    'ALLOCATED',
    'UNALLOCATED',
    'OPENED',
    'CLOSED',
    'DATASET',
    'CATALOG',
    'UNCATALOG',
    'SCRATCH',
    'RENAME',
    'VOLUME',
    'MOUNT',
    'DEMOUNT',
    'OFFLINE',
    'ONLINE',
    'VARY',
    'DEVICE',
    'JOB',
    'STEP',
    'PROC',
    'PROGRAM',
    'MODULE',
    'LOAD',
    'LIBRARY',
    'SUBSYSTEM',
    'STARTED',
    'STOPPED',
    'ACTIVE',
    'INACTIVE',
    'CHECKPOINT',
    'RESTART',
    'RECOVERY',
    'BACKUP',
    'ARCHIVE',
    'SYSOUT',
    'HELD',
    'RELEASED',
    'PURGED',
    'WRITER',
    'OUTPUT',
  ];

  // VSAM operation keywords
  private readonly VSAM_KEYWORDS = [
    'KSDS',
    'ESDS',
    'RRDS',
    'LDS',
    'AIX',
    'PATH',
    'CLUSTER',
    'GET',
    'PUT',
    'ERASE',
    'POINT',
    'ENDREQ',
    'SHOWCB',
    'TESTCB',
    'GENERIC',
    'EQUAL',
    'GTEQ',
    'RBA',
    'RRN',
    'KEYLEN',
    'REC',
    'SKIP',
    'BWD',
    'FWD',
    'KEYFROM',
    'KEYTO',
    'FROMKEY',
    'TOKEY',
    'OPTCD',
    'MACRF',
    'ACB',
    'RPL',
    'EXLST',
    'SYNAD',
    'LERAD',
    'BUFND',
    'BUFNI',
    'STRNO',
    'IMBED',
    'REPLICATE',
    'SPEED',
    'RECOVERY',
    'BWO',
    'KEYUPD',
    'UPD',
    'OUT',
    'ADD',
    'CNV',
    'DIR',
    'SEQ',
    'SKP',
    'SYN',
    'ASY',
    'DFR',
    'NDF',
    'ARD',
    'NRM',
    'MSR',
    'UBF',
    'LOC',
    'MVE',
    'KEY',
    'ADR',
    'CNT',
  ];

  constructor(config: Partial<MainframeTokenizerConfig> = {}) {
    this.config = {
      preserveErrorCodes: true,
      preserveJclSyntax: true,
      preserveCobolKeywords: true,
      preserveSystemMessages: true,
      caseSensitive: false,
      stemming: true,
      ...config,
    };
  }

  /**
   * Tokenize text using mainframe-aware rules
   */
  tokenize(text: string): TokenInfo[] {
    if (!text) return [];

    const tokens: TokenInfo[] = [];
    let position = 0;

    // First pass: Extract special mainframe tokens
    const preservedTokens = this.extractPreservedTokens(text);
    let remainingText = text;

    // Replace preserved tokens with placeholders to avoid re-tokenizing
    const placeholders = new Map<string, string>();
    preservedTokens.forEach((tokenInfo, index) => {
      const placeholder = `__PRESERVED_${index}__`;
      placeholders.set(placeholder, tokenInfo.token);
      remainingText = remainingText.replace(
        new RegExp(this.escapeRegExp(tokenInfo.token), 'gi'),
        placeholder
      );
    });

    // Second pass: Standard tokenization of remaining text
    const standardTokens = this.standardTokenize(remainingText);

    // Third pass: Restore preserved tokens and merge
    standardTokens.forEach(token => {
      if (placeholders.has(token)) {
        // Restore preserved token
        const original = placeholders.get(token)!;
        const preserved = preservedTokens.find(t => t.token === original);
        if (preserved) {
          tokens.push({
            ...preserved,
            position: position++,
          });
        }
      } else {
        // Process standard token
        const tokenInfo = this.processStandardToken(token, position++);
        if (tokenInfo) {
          tokens.push(tokenInfo);
        }
      }
    });

    // Apply stemming if enabled
    if (this.config.stemming) {
      return tokens.map(token => ({
        ...token,
        stemmed: this.applyStemming(token.token),
      }));
    }

    return tokens;
  }

  /**
   * Extract tokens that should be preserved as-is (error codes, JCL syntax, etc.)
   */
  private extractPreservedTokens(text: string): TokenInfo[] {
    const preserved: TokenInfo[] = [];

    if (this.config.preserveErrorCodes) {
      this.ERROR_CODE_PATTERNS.forEach(pattern => {
        const matches = text.match(new RegExp(pattern.source, 'gi'));
        if (matches) {
          matches.forEach(match => {
            preserved.push({
              token: this.config.caseSensitive ? match : match.toUpperCase(),
              type: 'error_code',
              weight: 3.0, // High weight for error codes
              position: 0, // Will be set later
            });
          });
        }
      });
    }

    if (this.config.preserveJclSyntax) {
      this.JCL_SYNTAX_PATTERNS.forEach(pattern => {
        const matches = text.match(new RegExp(pattern.source, 'gi'));
        if (matches) {
          matches.forEach(match => {
            preserved.push({
              token: this.config.caseSensitive ? match : match.toUpperCase(),
              type: 'jcl_syntax',
              weight: 2.5, // High weight for JCL syntax
              position: 0,
            });
          });
        }
      });
    }

    return preserved;
  }

  /**
   * Standard tokenization for general text
   */
  private standardTokenize(text: string): string[] {
    // Split on common delimiters while preserving important punctuation
    return text
      .toLowerCase()
      .replace(/[^\w\s\-._@#$]/g, ' ') // Keep mainframe-friendly characters
      .split(/\s+/)
      .filter(token => token.length > 0 && token.length < 50) // Filter reasonable lengths
      .filter(token => !/^[0-9]+$/.test(token)) // Remove pure numbers
      .filter(token => token !== '__PRESERVED_' && !token.includes('__PRESERVED_'));
  }

  /**
   * Process a standard token and determine its type and weight
   */
  private processStandardToken(token: string, position: number): TokenInfo | null {
    if (!token || token.length < 2) return null;

    const upperToken = token.toUpperCase();

    // Check COBOL keywords
    if (this.config.preserveCobolKeywords && this.COBOL_KEYWORDS.includes(upperToken)) {
      return {
        token: upperToken,
        type: 'cobol_keyword',
        weight: 2.0,
        position,
      };
    }

    // Check VSAM keywords
    if (this.VSAM_KEYWORDS.includes(upperToken)) {
      return {
        token: upperToken,
        type: 'system_msg',
        weight: 2.0,
        position,
      };
    }

    // Check system message keywords
    if (this.config.preserveSystemMessages && this.SYSTEM_MSG_KEYWORDS.includes(upperToken)) {
      return {
        token: upperToken,
        type: 'system_msg',
        weight: 1.5,
        position,
      };
    }

    // General token
    return {
      token: this.config.caseSensitive ? token : token.toLowerCase(),
      type: 'general',
      weight: 1.0,
      position,
    };
  }

  /**
   * Apply mainframe-specific stemming rules
   */
  private applyStemming(token: string): string {
    // Don't stem error codes or special syntax
    if (this.ERROR_CODE_PATTERNS.some(pattern => pattern.test(token))) {
      return token;
    }

    if (this.JCL_SYNTAX_PATTERNS.some(pattern => pattern.test(token))) {
      return token;
    }

    // Apply basic English stemming rules with mainframe considerations
    let stemmed = token.toLowerCase();

    // Handle common mainframe suffixes
    const mainframeSuffixes = [
      { suffix: 'ing', replacement: '' }, // Processing -> Process
      { suffix: 'ed', replacement: '' }, // Allocated -> Allocat
      { suffix: 'ion', replacement: '' }, // Allocation -> Allocat
      { suffix: 'tion', replacement: '' }, // Compilation -> Compil
      { suffix: 'ness', replacement: '' }, // Readiness -> Readi
      { suffix: 'ment', replacement: '' }, // Statement -> State
      { suffix: 'able', replacement: '' }, // Available -> Avail
      { suffix: 'ible', replacement: '' }, // Possible -> Poss
      { suffix: 'ful', replacement: '' }, // Successful -> Success
      { suffix: 'less', replacement: '' }, // Endless -> End
      { suffix: 'ly', replacement: '' }, // Successfully -> Successfu
      { suffix: 'er', replacement: '' }, // Handler -> Handl
      { suffix: 'or', replacement: '' }, // Processor -> Process
      { suffix: 'ar', replacement: '' }, // Similar -> Simil
      { suffix: 'est', replacement: '' }, // Latest -> Lat
    ];

    for (const { suffix, replacement } of mainframeSuffixes) {
      if (stemmed.endsWith(suffix) && stemmed.length > suffix.length + 2) {
        stemmed = stemmed.slice(0, -suffix.length) + replacement;
        break;
      }
    }

    return stemmed;
  }

  /**
   * Generate FTS5 compatible query from tokenized input
   */
  generateFTS5Query(input: string): string {
    const tokens = this.tokenize(input);

    if (tokens.length === 0) return input;

    // Group tokens by type for optimized querying
    const errorCodes = tokens.filter(t => t.type === 'error_code');
    const jclSyntax = tokens.filter(t => t.type === 'jcl_syntax');
    const cobolKeywords = tokens.filter(t => t.type === 'cobol_keyword');
    const systemMsgs = tokens.filter(t => t.type === 'system_msg');
    const generalTokens = tokens.filter(t => t.type === 'general');

    const queryParts: string[] = [];

    // High priority exact matches for error codes
    if (errorCodes.length > 0) {
      const errorQueries = errorCodes.map(t => `"${t.token}"`);
      queryParts.push(`(${errorQueries.join(' OR ')})`);
    }

    // JCL syntax exact matches
    if (jclSyntax.length > 0) {
      const jclQueries = jclSyntax.map(t => `"${t.token}"`);
      queryParts.push(`(${jclQueries.join(' OR ')})`);
    }

    // COBOL keyword matches with stemming
    if (cobolKeywords.length > 0) {
      const cobolQueries = cobolKeywords.map(t => {
        const stemmed = t.stemmed || t.token;
        return `(${t.token} OR ${stemmed}*)`;
      });
      queryParts.push(`(${cobolQueries.join(' OR ')})`);
    }

    // System message keywords
    if (systemMsgs.length > 0) {
      const systemQueries = systemMsgs.map(t => {
        const stemmed = t.stemmed || t.token;
        return `(${t.token} OR ${stemmed}*)`;
      });
      queryParts.push(`(${systemQueries.join(' OR ')})`);
    }

    // General tokens with prefix matching and stemming
    if (generalTokens.length > 0) {
      const generalQueries = generalTokens.map(t => {
        if (t.token.length <= 3) {
          return `"${t.token}"`; // Short tokens need exact match
        }
        const stemmed = t.stemmed || t.token;
        return `(${t.token}* OR ${stemmed}*)`;
      });

      if (generalQueries.length === 1) {
        queryParts.push(generalQueries[0]);
      } else {
        // For multiple general tokens, require at least 60% to match
        const requiredMatches = Math.ceil(generalQueries.length * 0.6);
        if (requiredMatches === generalQueries.length) {
          queryParts.push(`(${generalQueries.join(' AND ')})`);
        } else {
          // Use OR for flexibility when many general terms
          queryParts.push(`(${generalQueries.join(' OR ')})`);
        }
      }
    }

    // Combine all parts with AND for precision
    if (queryParts.length === 0) {
      return `"${input}"`; // Fallback to exact phrase
    }

    return queryParts.join(' AND ');
  }

  /**
   * Get token weights for BM25 ranking customization
   */
  getTokenWeights(): Map<string, number> {
    const weights = new Map<string, number>();

    // Set high weights for error codes
    this.ERROR_CODE_PATTERNS.forEach(pattern => {
      weights.set(pattern.source, 3.0);
    });

    // Medium-high weights for JCL syntax
    this.JCL_SYNTAX_PATTERNS.forEach(pattern => {
      weights.set(pattern.source, 2.5);
    });

    // Medium weights for COBOL keywords
    this.COBOL_KEYWORDS.forEach(keyword => {
      weights.set(keyword, 2.0);
    });

    // Default weight for general terms
    weights.set('default', 1.0);

    return weights;
  }

  /**
   * Utility method to escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate if a token should be indexed
   */
  shouldIndex(token: string): boolean {
    // Skip empty or very short tokens
    if (!token || token.length < 2) return false;

    // Skip very long tokens (likely garbage)
    if (token.length > 50) return false;

    // Skip pure numbers unless they're error codes
    if (/^[0-9]+$/.test(token) && !this.ERROR_CODE_PATTERNS.some(p => p.test(token))) {
      return false;
    }

    // Skip common stop words that are not mainframe-specific
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'among',
      'throughout',
      'despite',
      'towards',
      'upon',
      'concerning',
      'under',
      'within',
      'without',
      'according',
      'because',
      'therefore',
      'however',
      'although',
      'unless',
      'until',
      'while',
      'whereas',
      'since',
      'though',
      'whenever',
      'wherever',
    ]);

    return !stopWords.has(token.toLowerCase());
  }
}

/**
 * Factory function to create FTS5 tokenizer instance
 */
export function createMainframeTokenizer(
  config?: Partial<MainframeTokenizerConfig>
): FTS5MainframeTokenizer {
  return new FTS5MainframeTokenizer(config);
}

/**
 * Helper function to register the tokenizer with SQLite FTS5
 * This would typically be called during database initialization
 */
export function registerMainframeTokenizer(): string {
  // Return the SQL needed to register this tokenizer
  // In a real implementation, this would involve C extension compilation
  return `
    -- Mainframe Custom Tokenizer Registration
    -- Note: This requires compilation of a SQLite extension
    -- For now, we'll use enhanced porter tokenizer with custom ranking

    -- Custom ranking function for mainframe terms
    CREATE TEMP TABLE IF NOT EXISTS mainframe_term_weights (
      term TEXT PRIMARY KEY,
      weight REAL DEFAULT 1.0
    );

    -- Insert high-weight mainframe terms
    INSERT OR REPLACE INTO mainframe_term_weights VALUES
    ('S0C7', 3.0), ('S806', 3.0), ('S878', 3.0), ('S0C4', 3.0),
    ('IEF212I', 3.0), ('IEF285I', 3.0), ('IEF287I', 3.0),
    ('WER027A', 3.0), ('WER031A', 3.0), ('WER108A', 3.0),
    ('IGZ0035S', 3.0), ('CEE3204S', 3.0), ('IKJ56650I', 3.0),
    ('VSAM', 2.5), ('STATUS', 2.5), ('KSDS', 2.5), ('ESDS', 2.5),
    ('JCL', 2.5), ('STEP', 2.5), ('PROC', 2.5), ('DD', 2.5),
    ('DISP', 2.5), ('DSN', 2.5), ('SPACE', 2.5), ('UNIT', 2.5),
    ('COBOL', 2.0), ('MOVE', 2.0), ('PERFORM', 2.0), ('CALL', 2.0),
    ('PIC', 2.0), ('COMP', 2.0), ('WORKING-STORAGE', 2.0),
    ('DB2', 2.0), ('SQLCODE', 2.0), ('BIND', 2.0), ('PLAN', 2.0),
    ('CICS', 2.0), ('TRANSACTION', 2.0), ('COMMAREA', 2.0),
    ('ABEND', 2.0), ('COMPLETION', 2.0), ('CODE', 2.0),
    ('DATASET', 1.5), ('CATALOG', 1.5), ('VOLUME', 1.5),
    ('ALLOCATION', 1.5), ('ALLOCATION', 1.5), ('MOUNT', 1.5);
  `;
}
