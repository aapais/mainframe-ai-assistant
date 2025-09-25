'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FTS5MainframeTokenizer = void 0;
exports.createMainframeTokenizer = createMainframeTokenizer;
exports.registerMainframeTokenizer = registerMainframeTokenizer;
class FTS5MainframeTokenizer {
  config;
  ERROR_CODE_PATTERNS = [
    /^S\d{3}[A-Z]?$/i,
    /^[A-Z]{3}\d{3,4}[A-Z]?$/i,
    /^SQLCODE\s*[-]?\d+$/i,
    /^VSAM\s*STATUS\s*\d+$/i,
    /^RC\s*=\s*\d+$/i,
    /^U\d{4}$/i,
    /^CEE\d{4}[A-Z]?$/i,
    /^IGZ\d{4}[A-Z]?$/i,
    /^IKJ\d{4}[A-Z]?$/i,
    /^ICH\d{4}[A-Z]?$/i,
    /^ARC\d{4}[A-Z]?$/i,
    /^IGD\d{4}[A-Z]?$/i,
    /^IEA\d{4}[A-Z]?$/i,
    /^IOS\d{4}[A-Z]?$/i,
    /^IRA\d{4}[A-Z]?$/i,
    /^ISG\d{4}[A-Z]?$/i,
  ];
  JCL_SYNTAX_PATTERNS = [
    /^\/\/[A-Z0-9@#$]{1,8}$/i,
    /^\/\/\s*[A-Z0-9@#$]+\s+DD$/i,
    /^DISP\s*=\s*\([^)]+\)$/i,
    /^DSN\s*=\s*[A-Z0-9.@#$]+$/i,
    /^SPACE\s*=\s*\([^)]+\)$/i,
    /^UNIT\s*=\s*[A-Z0-9]+$/i,
    /^VOL\s*=\s*SER\s*=\s*[A-Z0-9]+$/i,
    /^CLASS\s*=\s*[A-Z0-9]$/i,
    /^MSGCLASS\s*=\s*[A-Z0-9]$/i,
    /^REGION\s*=\s*\d+[KMG]?$/i,
  ];
  COBOL_KEYWORDS = [
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
  SYSTEM_MSG_KEYWORDS = [
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
  VSAM_KEYWORDS = [
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
  constructor(config = {}) {
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
  tokenize(text) {
    if (!text) return [];
    const tokens = [];
    let position = 0;
    const preservedTokens = this.extractPreservedTokens(text);
    let remainingText = text;
    const placeholders = new Map();
    preservedTokens.forEach((tokenInfo, index) => {
      const placeholder = `__PRESERVED_${index}__`;
      placeholders.set(placeholder, tokenInfo.token);
      remainingText = remainingText.replace(
        new RegExp(this.escapeRegExp(tokenInfo.token), 'gi'),
        placeholder
      );
    });
    const standardTokens = this.standardTokenize(remainingText);
    standardTokens.forEach(token => {
      if (placeholders.has(token)) {
        const original = placeholders.get(token);
        const preserved = preservedTokens.find(t => t.token === original);
        if (preserved) {
          tokens.push({
            ...preserved,
            position: position++,
          });
        }
      } else {
        const tokenInfo = this.processStandardToken(token, position++);
        if (tokenInfo) {
          tokens.push(tokenInfo);
        }
      }
    });
    if (this.config.stemming) {
      return tokens.map(token => ({
        ...token,
        stemmed: this.applyStemming(token.token),
      }));
    }
    return tokens;
  }
  extractPreservedTokens(text) {
    const preserved = [];
    if (this.config.preserveErrorCodes) {
      this.ERROR_CODE_PATTERNS.forEach(pattern => {
        const matches = text.match(new RegExp(pattern.source, 'gi'));
        if (matches) {
          matches.forEach(match => {
            preserved.push({
              token: this.config.caseSensitive ? match : match.toUpperCase(),
              type: 'error_code',
              weight: 3.0,
              position: 0,
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
              weight: 2.5,
              position: 0,
            });
          });
        }
      });
    }
    return preserved;
  }
  standardTokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\-._@#$]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0 && token.length < 50)
      .filter(token => !/^[0-9]+$/.test(token))
      .filter(token => token !== '__PRESERVED_' && !token.includes('__PRESERVED_'));
  }
  processStandardToken(token, position) {
    if (!token || token.length < 2) return null;
    const upperToken = token.toUpperCase();
    if (this.config.preserveCobolKeywords && this.COBOL_KEYWORDS.includes(upperToken)) {
      return {
        token: upperToken,
        type: 'cobol_keyword',
        weight: 2.0,
        position,
      };
    }
    if (this.VSAM_KEYWORDS.includes(upperToken)) {
      return {
        token: upperToken,
        type: 'system_msg',
        weight: 2.0,
        position,
      };
    }
    if (this.config.preserveSystemMessages && this.SYSTEM_MSG_KEYWORDS.includes(upperToken)) {
      return {
        token: upperToken,
        type: 'system_msg',
        weight: 1.5,
        position,
      };
    }
    return {
      token: this.config.caseSensitive ? token : token.toLowerCase(),
      type: 'general',
      weight: 1.0,
      position,
    };
  }
  applyStemming(token) {
    if (this.ERROR_CODE_PATTERNS.some(pattern => pattern.test(token))) {
      return token;
    }
    if (this.JCL_SYNTAX_PATTERNS.some(pattern => pattern.test(token))) {
      return token;
    }
    let stemmed = token.toLowerCase();
    const mainframeSuffixes = [
      { suffix: 'ing', replacement: '' },
      { suffix: 'ed', replacement: '' },
      { suffix: 'ion', replacement: '' },
      { suffix: 'tion', replacement: '' },
      { suffix: 'ness', replacement: '' },
      { suffix: 'ment', replacement: '' },
      { suffix: 'able', replacement: '' },
      { suffix: 'ible', replacement: '' },
      { suffix: 'ful', replacement: '' },
      { suffix: 'less', replacement: '' },
      { suffix: 'ly', replacement: '' },
      { suffix: 'er', replacement: '' },
      { suffix: 'or', replacement: '' },
      { suffix: 'ar', replacement: '' },
      { suffix: 'est', replacement: '' },
    ];
    for (const { suffix, replacement } of mainframeSuffixes) {
      if (stemmed.endsWith(suffix) && stemmed.length > suffix.length + 2) {
        stemmed = stemmed.slice(0, -suffix.length) + replacement;
        break;
      }
    }
    return stemmed;
  }
  generateFTS5Query(input) {
    const tokens = this.tokenize(input);
    if (tokens.length === 0) return input;
    const errorCodes = tokens.filter(t => t.type === 'error_code');
    const jclSyntax = tokens.filter(t => t.type === 'jcl_syntax');
    const cobolKeywords = tokens.filter(t => t.type === 'cobol_keyword');
    const systemMsgs = tokens.filter(t => t.type === 'system_msg');
    const generalTokens = tokens.filter(t => t.type === 'general');
    const queryParts = [];
    if (errorCodes.length > 0) {
      const errorQueries = errorCodes.map(t => `"${t.token}"`);
      queryParts.push(`(${errorQueries.join(' OR ')})`);
    }
    if (jclSyntax.length > 0) {
      const jclQueries = jclSyntax.map(t => `"${t.token}"`);
      queryParts.push(`(${jclQueries.join(' OR ')})`);
    }
    if (cobolKeywords.length > 0) {
      const cobolQueries = cobolKeywords.map(t => {
        const stemmed = t.stemmed || t.token;
        return `(${t.token} OR ${stemmed}*)`;
      });
      queryParts.push(`(${cobolQueries.join(' OR ')})`);
    }
    if (systemMsgs.length > 0) {
      const systemQueries = systemMsgs.map(t => {
        const stemmed = t.stemmed || t.token;
        return `(${t.token} OR ${stemmed}*)`;
      });
      queryParts.push(`(${systemQueries.join(' OR ')})`);
    }
    if (generalTokens.length > 0) {
      const generalQueries = generalTokens.map(t => {
        if (t.token.length <= 3) {
          return `"${t.token}"`;
        }
        const stemmed = t.stemmed || t.token;
        return `(${t.token}* OR ${stemmed}*)`;
      });
      if (generalQueries.length === 1) {
        queryParts.push(generalQueries[0]);
      } else {
        const requiredMatches = Math.ceil(generalQueries.length * 0.6);
        if (requiredMatches === generalQueries.length) {
          queryParts.push(`(${generalQueries.join(' AND ')})`);
        } else {
          queryParts.push(`(${generalQueries.join(' OR ')})`);
        }
      }
    }
    if (queryParts.length === 0) {
      return `"${input}"`;
    }
    return queryParts.join(' AND ');
  }
  getTokenWeights() {
    const weights = new Map();
    this.ERROR_CODE_PATTERNS.forEach(pattern => {
      weights.set(pattern.source, 3.0);
    });
    this.JCL_SYNTAX_PATTERNS.forEach(pattern => {
      weights.set(pattern.source, 2.5);
    });
    this.COBOL_KEYWORDS.forEach(keyword => {
      weights.set(keyword, 2.0);
    });
    weights.set('default', 1.0);
    return weights;
  }
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  shouldIndex(token) {
    if (!token || token.length < 2) return false;
    if (token.length > 50) return false;
    if (/^[0-9]+$/.test(token) && !this.ERROR_CODE_PATTERNS.some(p => p.test(token))) {
      return false;
    }
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
exports.FTS5MainframeTokenizer = FTS5MainframeTokenizer;
function createMainframeTokenizer(config) {
  return new FTS5MainframeTokenizer(config);
}
function registerMainframeTokenizer() {
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
//# sourceMappingURL=FTS5MainframeTokenizer.js.map
