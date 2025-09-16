"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextProcessor = void 0;
class TextProcessor {
    stemCache = new Map();
    stopWords;
    mainframeTerms;
    errorCodePatterns;
    stats = {
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
    processText(text, field = 'content', options = {}) {
        const startTime = Date.now();
        const opts = {
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
        const preprocessed = this.preprocessText(text, opts);
        const rawTokens = this.tokenize(preprocessed, opts);
        const tokens = [];
        for (let i = 0; i < rawTokens.length; i++) {
            const rawToken = rawTokens[i];
            if (rawToken.length < opts.minLength || rawToken.length > opts.maxLength) {
                continue;
            }
            const normalized = this.normalizeToken(rawToken, opts);
            if (!normalized)
                continue;
            if (opts.stopWords && this.isStopWord(normalized)) {
                continue;
            }
            const tokenType = this.determineTokenType(normalized);
            const stemmed = opts.stemming ? this.stem(normalized) : normalized;
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
    tokenizeQuery(query) {
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
    extractSpecialTerms(text) {
        const errorCodes = [];
        const mainframeTerms = [];
        const systemNames = [];
        for (const pattern of this.errorCodePatterns) {
            const matches = text.match(new RegExp(pattern, 'gi'));
            if (matches) {
                errorCodes.push(...matches.map(m => m.toUpperCase()));
            }
        }
        const words = text.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (this.mainframeTerms.has(word)) {
                mainframeTerms.push(word);
            }
        }
        const systemPatterns = [
            /\b[A-Z]{3,8}\d{0,3}\b/g,
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
    stem(word) {
        if (word.length <= 2)
            return word;
        const cached = this.stemCache.get(word);
        if (cached !== undefined) {
            this.stats.cacheHits++;
            return cached;
        }
        this.stats.stemOperations++;
        let stemmed = word.toLowerCase();
        if (this.shouldSkipStemming(stemmed)) {
            this.stemCache.set(word, stemmed);
            return stemmed;
        }
        stemmed = this.applyPorterRules(stemmed);
        if (this.stemCache.size < 10000) {
            this.stemCache.set(word, stemmed);
        }
        return stemmed;
    }
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.stemCache.size,
            cacheHitRate: this.stats.tokensProcessed > 0
                ? this.stats.cacheHits / this.stats.tokensProcessed
                : 0
        };
    }
    reset() {
        this.stemCache.clear();
        this.stats = {
            tokensProcessed: 0,
            cacheHits: 0,
            stemOperations: 0,
            processingTime: 0
        };
    }
    preprocessText(text, options) {
        let processed = text;
        processed = processed
            .replace(/([A-Z]+\d+[A-Z]*)/g, ' $1 ')
            .replace(/STATUS\s*(\d+)/gi, ' STATUS$1 ')
            .replace(/SQLCODE\s*(-?\d+)/gi, ' SQLCODE$1 ')
            .replace(/\s+/g, ' ')
            .trim();
        return processed;
    }
    tokenize(text, options) {
        const tokens = text
            .split(/\s+/)
            .flatMap(token => {
            if (token.includes('-') && token.length > 3) {
                const parts = token.split('-');
                if (parts.length <= 3) {
                    return [token, ...parts];
                }
            }
            return [token];
        })
            .filter(token => token.length > 0);
        return tokens;
    }
    normalizeToken(token, options) {
        let normalized = token;
        normalized = normalized.replace(/^[^\w]+|[^\w]+$/g, '');
        if (!normalized)
            return '';
        if (!options.preserveCase) {
            if (!this.isErrorCode(normalized) && !this.isSystemName(normalized)) {
                normalized = normalized.toLowerCase();
            }
        }
        return normalized;
    }
    determineTokenType(token) {
        if (this.isErrorCode(token)) {
            return 'error';
        }
        if (/^\d+$/.test(token)) {
            return 'number';
        }
        if (/^[A-Z]+\.[A-Z0-9.]+$/.test(token)) {
            return 'code';
        }
        if (/^[A-Z]{2,8}$/.test(token) && token.length <= 8) {
            return 'acronym';
        }
        if (token.includes('-') || token.includes('.')) {
            return 'compound';
        }
        return 'word';
    }
    calculateTokenBoost(type, field, token) {
        let boost = 1.0;
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
        if (this.mainframeTerms.has(token.toLowerCase())) {
            boost *= 1.5;
        }
        return boost;
    }
    isStopWord(word) {
        return this.stopWords.has(word.toLowerCase());
    }
    isErrorCode(token) {
        return this.errorCodePatterns.some(pattern => new RegExp(pattern, 'i').test(token));
    }
    isSystemName(token) {
        const systemNames = /^(MVS|OS|VSE|VM|USS|UNIX|LINUX|WINDOWS|COBOL|JCL|VSAM|IDCAMS|ISPF|TSO|RACF|SDSF|IMS|DB2|CICS|MQ|DFSORT|SORT)$/i;
        return systemNames.test(token);
    }
    shouldSkipStemming(word) {
        return (word.length <= 3 ||
            this.isErrorCode(word) ||
            this.isSystemName(word) ||
            this.mainframeTerms.has(word));
    }
    applyPorterRules(word) {
        let stem = word;
        if (stem.endsWith('sses')) {
            stem = stem.slice(0, -2);
        }
        else if (stem.endsWith('ies')) {
            stem = stem.slice(0, -2);
        }
        else if (stem.endsWith('ss')) {
        }
        else if (stem.endsWith('s') && stem.length > 3) {
            stem = stem.slice(0, -1);
        }
        if (stem.endsWith('eed')) {
            if (this.measure(stem.slice(0, -3)) > 0) {
                stem = stem.slice(0, -1);
            }
        }
        else if (stem.endsWith('ed') && this.containsVowel(stem.slice(0, -2))) {
            stem = stem.slice(0, -2);
        }
        else if (stem.endsWith('ing') && this.containsVowel(stem.slice(0, -3))) {
            stem = stem.slice(0, -3);
        }
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
    measure(word) {
        const vowels = 'aeiou';
        let m = 0;
        let currentIsVowel = false;
        for (let i = 0; i < word.length; i++) {
            const isVowel = vowels.includes(word[i]) ||
                (word[i] === 'y' && i > 0 && !vowels.includes(word[i - 1]));
            if (!isVowel && currentIsVowel) {
                m++;
            }
            currentIsVowel = isVowel;
        }
        return m;
    }
    containsVowel(word) {
        const vowels = 'aeiou';
        for (let i = 0; i < word.length; i++) {
            if (vowels.includes(word[i]) ||
                (word[i] === 'y' && i > 0 && !vowels.includes(word[i - 1]))) {
                return true;
            }
        }
        return false;
    }
    initializeStopWords() {
        const commonStopWords = [
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
            'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
            'to', 'was', 'will', 'with', 'this', 'have', 'had', 'been', 'we',
            'you', 'they', 'them', 'their', 'would', 'could', 'should', 'may',
            'can', 'do', 'does', 'did', 'not', 'no', 'yes', 'but', 'or', 'so'
        ];
        this.stopWords = new Set(commonStopWords);
    }
    initializeMainframeTerms() {
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
    initializeErrorPatterns() {
        this.errorCodePatterns = [
            /\bS0C[0-9A-F]\b/i,
            /\bU\d{4}\b/i,
            /\bIEF\d{3}[A-Z]\b/i,
            /\bIEC\d{3}[A-Z]\b/i,
            /\bIDC\d{4}[A-Z]\b/i,
            /\bISR\d{4}[A-Z]\b/i,
            /\bDFS\d{4}[A-Z]\b/i,
            /\bWER\d{3}[A-Z]\b/i,
            /\bSQLCODE\s*-?\d+\b/i,
            /\bDSNT\d{3}[A-Z]\b/i,
            /\bCICS\d{4}[A-Z]\b/i,
            /\bDFS\d{4}[A-Z]\b/i,
            /\bCSQ\d{4}[A-Z]\b/i,
            /\bTSOD\d{4}[A-Z]\b/i,
            /\bISP\d{4}[A-Z]\b/i,
            /\bStatus\s*\d+\b/i,
            /\bRC\s*=\s*\d+\b/i,
            /\bCC\s*=\s*\d+\b/i
        ];
    }
}
exports.TextProcessor = TextProcessor;
exports.default = TextProcessor;
//# sourceMappingURL=TextProcessor.js.map