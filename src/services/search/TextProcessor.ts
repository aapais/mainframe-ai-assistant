/**
 * High-Performance Text Processing Engine
 * Optimized tokenization, stemming, and normalization for mainframe terminology
 */

export interface TokenInfo {
  text: string;
  position: number;
  field: string;
  stemmed: string;
  normalized: string;
  type: TokenType;
  boost: number;
}

export type TokenType = 'word' | 'number' | 'code' | 'error' | 'compound' | 'acronym';

export interface ProcessingOptions {
  stemming: boolean;
  stopWords: boolean;
  minLength: number;
  maxLength: number;
  preserveCase: boolean;
  numbers: boolean;
  mainframeTerms: boolean;
}

/**
 * Mainframe-aware text processor with performance optimizations
 * Features:
 * - Mainframe-specific terminology handling
 * - Porter stemming algorithm
 * - Intelligent tokenization
 * - Error code recognition
 * - Stop word filtering
 * - Compound term detection
 */
export class TextProcessor {
  private stemCache = new Map<string, string>();
  private stopWords: Set<string>;
  private mainframeTerms: Set<string>;
  private errorCodePatterns: RegExp[];
  
  // Performance counters
  private stats = {
    tokensProcessed: 0,
    cacheHits: 0,
    stemOperations: 0,
    processingTime: 0
  };

  constructor() {
    this.initializeStopWords();
    this.initializeMainframeTerms();
    this.initializeErrorPatterns();
  }

  /**
   * Process text into tokens with full analysis
   */
  processText(
    text: string, 
    field: string = 'content',
    options: Partial<ProcessingOptions> = {}
  ): TokenInfo[] {
    const startTime = Date.now();
    
    const opts: ProcessingOptions = {
      stemming: true,
      stopWords: true,
      minLength: 2,
      maxLength: 50,
      preserveCase: false,
      numbers: true,
      mainframeTerms: true,
      ...options
    };

    if (!text || text.trim().length === 0) {
      return [];
    }

    // Pre-process text
    const preprocessed = this.preprocessText(text, opts);
    
    // Tokenize
    const rawTokens = this.tokenize(preprocessed, opts);
    
    // Process each token
    const tokens: TokenInfo[] = [];
    
    for (let i = 0; i < rawTokens.length; i++) {
      const rawToken = rawTokens[i];
      
      // Skip if too short/long
      if (rawToken.length < opts.minLength || rawToken.length > opts.maxLength) {
        continue;
      }

      // Normalize token
      const normalized = this.normalizeToken(rawToken, opts);
      if (!normalized) continue;

      // Check if it's a stop word
      if (opts.stopWords && this.isStopWord(normalized)) {
        continue;
      }

      // Determine token type
      const tokenType = this.determineTokenType(normalized);
      
      // Apply stemming if requested
      const stemmed = opts.stemming ? this.stem(normalized) : normalized;
      
      // Calculate boost based on token type and field
      const boost = this.calculateTokenBoost(tokenType, field, normalized);

      tokens.push({
        text: rawToken,
        position: i,
        field,
        stemmed,
        normalized,
        type: tokenType,
        boost
      });

      this.stats.tokensProcessed++;
    }

    this.stats.processingTime += Date.now() - startTime;
    return tokens;
  }

  /**
   * Quick tokenization for search queries
   */
  tokenizeQuery(query: string): string[] {
    return this.processText(query, 'query', {
      stemming: true,
      stopWords: true,
      minLength: 2,
      maxLength: 50,
      preserveCase: false,
      numbers: true,
      mainframeTerms: true
    }).map(token => token.stemmed);
  }

  /**
   * Extract mainframe-specific terms and error codes
   */
  extractSpecialTerms(text: string): {
    errorCodes: string[];
    mainframeTerms: string[];
    systemNames: string[];
  } {
    const errorCodes: string[] = [];
    const mainframeTerms: string[] = [];
    const systemNames: string[] = [];

    // Extract error codes
    for (const pattern of this.errorCodePatterns) {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        errorCodes.push(...matches.map(m => m.toUpperCase()));
      }
    }

    // Extract mainframe terms
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (this.mainframeTerms.has(word)) {
        mainframeTerms.push(word);
      }
    }

    // Extract system names (simplified pattern matching)
    const systemPatterns = [
      /\b[A-Z]{3,8}\d{0,3}\b/g, // MVS, CICS, DB2, etc.
      /\b(COBOL|JCL|VSAM|IDCAMS|ISPF|TSO|RACF|SDSF)\b/gi,
      /\b(IMS|DB2|CICS|MQ|DFSORT|SORT)\b/gi
    ];

    for (const pattern of systemPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        systemNames.push(...matches.map(m => m.toUpperCase()));
      }
    }

    return {
      errorCodes: [...new Set(errorCodes)],
      mainframeTerms: [...new Set(mainframeTerms)],
      systemNames: [...new Set(systemNames)]
    };
  }

  /**
   * Porter Stemming Algorithm implementation
   */
  stem(word: string): string {
    if (word.length <= 2) return word;
    
    // Check cache first
    const cached = this.stemCache.get(word);
    if (cached !== undefined) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.stemOperations++;
    
    let stemmed = word.toLowerCase();
    
    // Skip stemming for mainframe terms and error codes
    if (this.shouldSkipStemming(stemmed)) {
      this.stemCache.set(word, stemmed);
      return stemmed;
    }

    // Apply Porter stemming rules
    stemmed = this.applyPorterRules(stemmed);
    
    // Cache the result
    if (this.stemCache.size < 10000) { // Limit cache size
      this.stemCache.set(word, stemmed);
    }
    
    return stemmed;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.stemCache.size,
      cacheHitRate: this.stats.tokensProcessed > 0 
        ? this.stats.cacheHits / this.stats.tokensProcessed 
        : 0
    };
  }

  /**
   * Clear caches and reset stats
   */
  reset(): void {
    this.stemCache.clear();
    this.stats = {
      tokensProcessed: 0,
      cacheHits: 0,
      stemOperations: 0,
      processingTime: 0
    };
  }

  // =========================
  // Private Implementation
  // =========================

  private preprocessText(text: string, options: ProcessingOptions): string {
    let processed = text;

    // Handle mainframe-specific formatting
    processed = processed
      // Preserve error codes
      .replace(/([A-Z]+\d+[A-Z]*)/g, ' $1 ')
      // Preserve status codes
      .replace(/STATUS\s*(\d+)/gi, ' STATUS$1 ')
      // Preserve SQLCODE patterns
      .replace(/SQLCODE\s*(-?\d+)/gi, ' SQLCODE$1 ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();

    return processed;
  }

  private tokenize(text: string, options: ProcessingOptions): string[] {
    // Split on word boundaries while preserving important punctuation
    const tokens = text
      .split(/\s+/)
      .flatMap(token => {
        // Handle compound terms like "VSAM-STATUS-35"
        if (token.includes('-') && token.length > 3) {
          const parts = token.split('-');
          if (parts.length <= 3) {
            return [token, ...parts]; // Keep both compound and parts
          }
        }
        return [token];
      })
      .filter(token => token.length > 0);

    return tokens;
  }

  private normalizeToken(token: string, options: ProcessingOptions): string {
    let normalized = token;

    // Remove surrounding punctuation but preserve internal structure
    normalized = normalized.replace(/^[^\w]+|[^\w]+$/g, '');
    
    if (!normalized) return '';

    // Convert to lowercase unless preserving case
    if (!options.preserveCase) {
      // Preserve case for error codes and system names
      if (!this.isErrorCode(normalized) && !this.isSystemName(normalized)) {
        normalized = normalized.toLowerCase();
      }
    }

    return normalized;
  }

  private determineTokenType(token: string): TokenType {
    // Error codes (S0C7, IEF212I, etc.)
    if (this.isErrorCode(token)) {
      return 'error';
    }

    // Numbers
    if (/^\d+$/.test(token)) {
      return 'number';
    }

    // Code patterns (like dataset names)
    if (/^[A-Z]+\.[A-Z0-9.]+$/.test(token)) {
      return 'code';
    }

    // Acronyms (all caps, 2-8 chars)
    if (/^[A-Z]{2,8}$/.test(token) && token.length <= 8) {
      return 'acronym';
    }

    // Compound terms (with hyphens or dots)
    if (token.includes('-') || token.includes('.')) {
      return 'compound';
    }

    return 'word';
  }

  private calculateTokenBoost(
    type: TokenType, 
    field: string, 
    token: string
  ): number {
    let boost = 1.0;

    // Boost by token type
    switch (type) {
      case 'error':
        boost *= 2.0;
        break;
      case 'code':
        boost *= 1.8;
        break;
      case 'acronym':
        boost *= 1.5;
        break;
      case 'compound':
        boost *= 1.3;
        break;
      case 'number':
        boost *= 1.2;
        break;
    }

    // Boost mainframe-specific terms
    if (this.mainframeTerms.has(token.toLowerCase())) {
      boost *= 1.5;
    }

    // Field-specific boosting will be handled at index level
    return boost;
  }

  private isStopWord(word: string): boolean {
    return this.stopWords.has(word.toLowerCase());
  }

  private isErrorCode(token: string): boolean {
    return this.errorCodePatterns.some(pattern => 
      new RegExp(pattern, 'i').test(token)
    );
  }

  private isSystemName(token: string): boolean {
    const systemNames = /^(MVS|OS|VSE|VM|USS|UNIX|LINUX|WINDOWS|COBOL|JCL|VSAM|IDCAMS|ISPF|TSO|RACF|SDSF|IMS|DB2|CICS|MQ|DFSORT|SORT)$/i;
    return systemNames.test(token);
  }

  private shouldSkipStemming(word: string): boolean {
    // Skip stemming for:
    // - Error codes
    // - System names
    // - Mainframe terms
    // - Very short words
    return (
      word.length <= 3 ||
      this.isErrorCode(word) ||
      this.isSystemName(word) ||
      this.mainframeTerms.has(word)
    );
  }

  private applyPorterRules(word: string): string {
    // Simplified Porter stemming - key rules only for performance
    let stem = word;

    // Step 1a
    if (stem.endsWith('sses')) {
      stem = stem.slice(0, -2); // sses -> ss
    } else if (stem.endsWith('ies')) {
      stem = stem.slice(0, -2); // ies -> i
    } else if (stem.endsWith('ss')) {
      // ss -> ss (no change)
    } else if (stem.endsWith('s') && stem.length > 3) {
      stem = stem.slice(0, -1); // s -> (remove)
    }

    // Step 1b - simplified
    if (stem.endsWith('eed')) {
      if (this.measure(stem.slice(0, -3)) > 0) {
        stem = stem.slice(0, -1); // eed -> ee
      }
    } else if (stem.endsWith('ed') && this.containsVowel(stem.slice(0, -2))) {
      stem = stem.slice(0, -2);
    } else if (stem.endsWith('ing') && this.containsVowel(stem.slice(0, -3))) {
      stem = stem.slice(0, -3);
    }

    // Step 2 - key suffixes only
    const step2Rules = [
      ['ational', 'ate'],
      ['tional', 'tion'],
      ['alism', 'al'],
      ['ation', 'ate'],
      ['ator', 'ate']
    ];

    for (const [suffix, replacement] of step2Rules) {
      if (stem.endsWith(suffix) && this.measure(stem.slice(0, -suffix.length)) > 0) {
        stem = stem.slice(0, -suffix.length) + replacement;
        break;
      }
    }

    return stem;
  }

  private measure(word: string): number {
    // Simple measure function for Porter algorithm
    const vowels = 'aeiou';
    let m = 0;
    let currentIsVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]) || 
        (word[i] === 'y' && i > 0 && !vowels.includes(word[i-1]));
      
      if (!isVowel && currentIsVowel) {
        m++;
      }
      currentIsVowel = isVowel;
    }
    
    return m;
  }

  private containsVowel(word: string): boolean {
    const vowels = 'aeiou';
    for (let i = 0; i < word.length; i++) {
      if (vowels.includes(word[i]) || 
          (word[i] === 'y' && i > 0 && !vowels.includes(word[i-1]))) {
        return true;
      }
    }
    return false;
  }

  private initializeStopWords(): void {
    // Common English stop words + mainframe-specific exclusions
    const commonStopWords = [
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'this', 'have', 'had', 'been', 'we',
      'you', 'they', 'them', 'their', 'would', 'could', 'should', 'may',
      'can', 'do', 'does', 'did', 'not', 'no', 'yes', 'but', 'or', 'so'
    ];

    this.stopWords = new Set(commonStopWords);
  }

  private initializeMainframeTerms(): void {
    // Important mainframe terms that should not be stemmed
    const terms = [
      'abend', 'alloc', 'catalog', 'cobol', 'cond', 'dataset', 'disp',
      'exec', 'ispf', 'jcl', 'job', 'parm', 'proc', 'racf', 'region',
      'space', 'step', 'sysout', 'unit', 'vol', 'vsam', 'ims', 'db2',
      'cics', 'tso', 'sdsf', 'idcams', 'sort', 'dfsort', 'copy', 'move',
      'reorg', 'backup', 'restore', 'index', 'table', 'column', 'row',
      'commit', 'rollback', 'bind', 'plan', 'package', 'program',
      'copybook', 'macro', 'include', 'replace', 'delete', 'insert',
      'update', 'select', 'create', 'drop', 'alter', 'grant', 'revoke'
    ];

    this.mainframeTerms = new Set(terms);
  }

  private initializeErrorPatterns(): void {
    // Common mainframe error code patterns
    this.errorCodePatterns = [
      /\bS0C[0-9A-F]\b/i,           // System completion codes
      /\bU\d{4}\b/i,                // User completion codes
      /\bIEF\d{3}[A-Z]\b/i,         // JES error codes
      /\bIEC\d{3}[A-Z]\b/i,         // I/O error codes
      /\bIDC\d{4}[A-Z]\b/i,         // IDCAMS error codes
      /\bISR\d{4}[A-Z]\b/i,         // ISPF error codes
      /\bDFS\d{4}[A-Z]\b/i,         // DFSORT error codes
      /\bWER\d{3}[A-Z]\b/i,         // DFSORT warning codes
      /\bSQLCODE\s*-?\d+\b/i,       // DB2 SQL codes
      /\bDSNT\d{3}[A-Z]\b/i,        // DB2 error codes
      /\bCICS\d{4}[A-Z]\b/i,        // CICS error codes
      /\bDFS\d{4}[A-Z]\b/i,         // IMS error codes
      /\bCSQ\d{4}[A-Z]\b/i,         // MQ error codes
      /\bTSOD\d{4}[A-Z]\b/i,        // TSO error codes
      /\bISP\d{4}[A-Z]\b/i,         // ISPF error codes
      /\bStatus\s*\d+\b/i,          // VSAM status codes
      /\bRC\s*=\s*\d+\b/i,          // Return codes
      /\bCC\s*=\s*\d+\b/i           // Condition codes
    ];
  }
}

export default TextProcessor;