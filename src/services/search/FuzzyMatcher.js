'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FuzzyMatcher = void 0;
class FuzzyMatcher {
  cache = new Map();
  soundexCache = new Map();
  metaphoneCache = new Map();
  similarTerms = new Map([
    ['dataset', ['data', 'file', 'dsn']],
    ['abend', ['error', 'fail', 'abort']],
    ['jcl', ['job', 'control', 'language']],
    ['vsam', ['file', 'dataset', 'virtual']],
    ['cics', ['transaction', 'system']],
    ['db2', ['database', 'sql']],
    ['ims', ['database', 'message']],
    ['cobol', ['program', 'language']],
    ['tso', ['terminal', 'system']],
    ['ispf', ['interface', 'facility']],
    ['sdsf', ['display', 'facility']],
    ['racf', ['security', 'facility']],
    ['sort', ['dfsort', 'order']],
    ['copy', ['include', 'copybook']],
    ['proc', ['procedure', 'process']],
    ['parm', ['parameter', 'param']],
    ['region', ['storage', 'memory']],
    ['space', ['allocation', 'disk']],
    ['unit', ['device', 'storage']],
    ['disp', ['disposition', 'status']],
    ['cond', ['condition', 'code']],
    ['step', ['jobstep', 'process']],
    ['exec', ['execute', 'run']],
    ['pgm', ['program', 'module']],
    ['dd', ['data', 'definition']],
    ['dsn', ['dataset', 'name']],
    ['vol', ['volume', 'disk']],
    ['cat', ['catalog', 'directory']],
    ['uncatlg', ['uncatalog', 'remove']],
    ['alloc', ['allocate', 'assign']],
    ['dealloc', ['deallocate', 'free']],
    ['mount', ['attach', 'connect']],
    ['dismount', ['detach', 'disconnect']],
  ]);
  defaultOptions = {
    maxDistance: 3,
    minSimilarity: 0.6,
    algorithm: ['levenshtein', 'jaro_winkler', 'soundex'],
    weights: {
      levenshtein: 0.4,
      damerau: 0.3,
      jaro: 0.2,
      jaro_winkler: 0.3,
      soundex: 0.2,
      metaphone: 0.2,
    },
    caseInsensitive: true,
    skipShortTerms: true,
    mainframeSpecific: true,
  };
  constructor() {}
  findMatches(term, vocabulary, options) {
    const opts = { ...this.defaultOptions, ...options };
    if (!term || term.length === 0) return [];
    if (opts.skipShortTerms && term.length < 3) return [];
    const matches = [];
    const normalizedTerm = opts.caseInsensitive ? term.toLowerCase() : term;
    const cacheKey = this.getCacheKey(normalizedTerm, opts);
    const cached = this.cache.get(cacheKey);
    for (const candidate of vocabulary) {
      const normalizedCandidate = opts.caseInsensitive ? candidate.toLowerCase() : candidate;
      if (normalizedTerm === normalizedCandidate) continue;
      if (cached && cached.has(normalizedCandidate)) {
        const cachedMatch = cached.get(normalizedCandidate);
        if (cachedMatch.similarity >= opts.minSimilarity) {
          matches.push(cachedMatch);
        }
        continue;
      }
      const match = this.calculateMatch(normalizedTerm, normalizedCandidate, opts);
      this.cacheResult(cacheKey, normalizedCandidate, match);
      if (match.similarity >= opts.minSimilarity) {
        matches.push(match);
      }
    }
    return matches
      .sort((a, b) => {
        const scoreDiff = b.similarity - a.similarity;
        if (Math.abs(scoreDiff) < 0.01) {
          return b.confidence - a.confidence;
        }
        return scoreDiff;
      })
      .slice(0, 20);
  }
  similarity(term1, term2, algorithm = 'levenshtein') {
    const normalizedTerm1 = term1.toLowerCase();
    const normalizedTerm2 = term2.toLowerCase();
    switch (algorithm) {
      case 'levenshtein':
        return this.levenshteinSimilarity(normalizedTerm1, normalizedTerm2);
      case 'damerau':
        return this.damerauSimilarity(normalizedTerm1, normalizedTerm2);
      case 'jaro':
        return this.jaroSimilarity(normalizedTerm1, normalizedTerm2);
      case 'jaro_winkler':
        return this.jaroWinklerSimilarity(normalizedTerm1, normalizedTerm2);
      case 'soundex':
        return this.soundexSimilarity(normalizedTerm1, normalizedTerm2);
      case 'metaphone':
        return this.metaphoneSimilarity(normalizedTerm1, normalizedTerm2);
      default:
        return this.levenshteinSimilarity(normalizedTerm1, normalizedTerm2);
    }
  }
  suggest(term, vocabulary, maxSuggestions = 5) {
    const matches = this.findMatches(term, vocabulary, {
      maxDistance: 2,
      minSimilarity: 0.5,
      algorithm: ['levenshtein', 'jaro_winkler'],
    });
    return matches.slice(0, maxSuggestions).map(match => match.term);
  }
  areVariants(term1, term2) {
    const synonyms1 = this.similarTerms.get(term1.toLowerCase()) || [];
    const synonyms2 = this.similarTerms.get(term2.toLowerCase()) || [];
    if (synonyms1.includes(term2.toLowerCase()) || synonyms2.includes(term1.toLowerCase())) {
      return true;
    }
    const similarity = this.similarity(term1, term2, 'jaro_winkler');
    return similarity > 0.8;
  }
  clearCache() {
    this.cache.clear();
    this.soundexCache.clear();
    this.metaphoneCache.clear();
  }
  getCacheStats() {
    return {
      fuzzyCache: this.cache.size,
      soundexCache: this.soundexCache.size,
      metaphoneCache: this.metaphoneCache.size,
    };
  }
  calculateMatch(term1, term2, options) {
    const results = [];
    for (const algorithm of options.algorithm) {
      const score = this.similarity(term1, term2, algorithm);
      const distance =
        algorithm === 'levenshtein' || algorithm === 'damerau'
          ? this.getEditDistance(term1, term2, algorithm)
          : undefined;
      results.push({ algorithm, score, distance });
    }
    let weightedSum = 0;
    let totalWeight = 0;
    let bestDistance = Number.MAX_SAFE_INTEGER;
    let bestAlgorithm = 'levenshtein';
    for (const result of results) {
      const weight = options.weights[result.algorithm];
      weightedSum += result.score * weight;
      totalWeight += weight;
      if (result.distance !== undefined && result.distance < bestDistance) {
        bestDistance = result.distance;
        bestAlgorithm = result.algorithm;
      }
    }
    const similarity = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const variance =
      results.reduce((sum, r) => {
        const diff = r.score - similarity;
        return sum + diff * diff;
      }, 0) / results.length;
    const confidence = Math.max(0, 1 - Math.sqrt(variance));
    const transformations = this.getTransformations(term1, term2);
    return {
      term: term2,
      distance: bestDistance === Number.MAX_SAFE_INTEGER ? 0 : bestDistance,
      similarity,
      confidence,
      algorithm: bestAlgorithm,
      transformations,
    };
  }
  getEditDistance(term1, term2, algorithm) {
    if (algorithm === 'damerau') {
      return this.damerauLevenshteinDistance(term1, term2);
    }
    return this.levenshteinDistance(term1, term2);
  }
  levenshteinDistance(str1, str2) {
    const matrix = [];
    const m = str1.length;
    const n = str2.length;
    for (let i = 0; i <= m; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[m][n];
  }
  damerauLevenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const H = [];
    const maxdist = m + n;
    H[0] = [];
    H[0][0] = maxdist;
    for (let i = 0; i <= m; i++) {
      H[i + 1] = [];
      H[i + 1][0] = maxdist;
      H[i + 1][1] = i;
    }
    for (let j = 0; j <= n; j++) {
      H[0][j + 1] = maxdist;
      H[1][j + 1] = j;
    }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        H[i + 1][j + 1] = Math.min(H[i][j + 1] + 1, H[i + 1][j] + 1, H[i][j] + cost);
        if (i > 1 && j > 1 && str1[i - 1] === str2[j - 2] && str1[i - 2] === str2[j - 1]) {
          H[i + 1][j + 1] = Math.min(H[i + 1][j + 1], H[i - 1][j - 1] + cost);
        }
      }
    }
    return H[m + 1][n + 1];
  }
  levenshteinSimilarity(str1, str2) {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }
  damerauSimilarity(str1, str2) {
    const distance = this.damerauLevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }
  jaroSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    if (matchDistance < 0) return 0;
    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);
    let matches = 0;
    let transpositions = 0;
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, str2.length);
      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
    if (matches === 0) return 0;
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
    return (
      (matches / str1.length + matches / str2.length + (matches - transpositions / 2) / matches) / 3
    );
  }
  jaroWinklerSimilarity(str1, str2) {
    const jaroSim = this.jaroSimilarity(str1, str2);
    if (jaroSim < 0.7) return jaroSim;
    let prefix = 0;
    const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));
    for (let i = 0; i < maxPrefix; i++) {
      if (str1[i] === str2[i]) {
        prefix++;
      } else {
        break;
      }
    }
    return jaroSim + 0.1 * prefix * (1 - jaroSim);
  }
  soundexSimilarity(str1, str2) {
    const soundex1 = this.getSoundex(str1);
    const soundex2 = this.getSoundex(str2);
    return soundex1 === soundex2 ? 1 : 0;
  }
  metaphoneSimilarity(str1, str2) {
    const metaphone1 = this.getMetaphone(str1);
    const metaphone2 = this.getMetaphone(str2);
    return metaphone1 === metaphone2 ? 1 : 0;
  }
  getSoundex(word) {
    const cached = this.soundexCache.get(word);
    if (cached) return cached;
    const soundex = this.calculateSoundex(word);
    this.soundexCache.set(word, soundex);
    return soundex;
  }
  calculateSoundex(word) {
    if (!word) return '';
    const normalized = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized.length === 0) return '';
    let soundex = normalized[0];
    const mapping = {
      BFPV: '1',
      CGJKQSXZ: '2',
      DT: '3',
      L: '4',
      MN: '5',
      R: '6',
    };
    for (let i = 1; i < normalized.length && soundex.length < 4; i++) {
      const char = normalized[i];
      for (const [chars, code] of Object.entries(mapping)) {
        if (chars.includes(char) && soundex[soundex.length - 1] !== code) {
          soundex += code;
          break;
        }
      }
    }
    return soundex.padEnd(4, '0').substring(0, 4);
  }
  getMetaphone(word) {
    const cached = this.metaphoneCache.get(word);
    if (cached) return cached;
    const metaphone = this.calculateMetaphone(word);
    this.metaphoneCache.set(word, metaphone);
    return metaphone;
  }
  calculateMetaphone(word) {
    if (!word) return '';
    let metaphone = '';
    const normalized = word.toUpperCase().replace(/[^A-Z]/g, '');
    for (let i = 0; i < normalized.length && metaphone.length < 4; i++) {
      const char = normalized[i];
      const prev = i > 0 ? normalized[i - 1] : '';
      const next = i < normalized.length - 1 ? normalized[i + 1] : '';
      switch (char) {
        case 'A':
        case 'E':
        case 'I':
        case 'O':
        case 'U':
          if (i === 0) metaphone += char;
          break;
        case 'B':
          if (prev !== 'M') metaphone += 'B';
          break;
        case 'C':
          if (next === 'H') metaphone += 'X';
          else if (next === 'I' || next === 'E' || next === 'Y') metaphone += 'S';
          else metaphone += 'K';
          break;
        case 'D':
          if (next === 'G') metaphone += 'J';
          else metaphone += 'T';
          break;
        case 'F':
          metaphone += 'F';
          break;
        case 'G':
          if (next === 'H' || next === 'N') break;
          metaphone += 'K';
          break;
        case 'H':
          if (prev !== 'C' && prev !== 'S' && prev !== 'P' && prev !== 'T') {
            metaphone += 'H';
          }
          break;
        case 'J':
          metaphone += 'J';
          break;
        case 'K':
          if (prev !== 'C') metaphone += 'K';
          break;
        case 'L':
          metaphone += 'L';
          break;
        case 'M':
          metaphone += 'M';
          break;
        case 'N':
          metaphone += 'N';
          break;
        case 'P':
          if (next === 'H') metaphone += 'F';
          else metaphone += 'P';
          break;
        case 'Q':
          metaphone += 'K';
          break;
        case 'R':
          metaphone += 'R';
          break;
        case 'S':
          if (next === 'H') metaphone += 'X';
          else metaphone += 'S';
          break;
        case 'T':
          if (next === 'H') metaphone += '0';
          else metaphone += 'T';
          break;
        case 'V':
          metaphone += 'F';
          break;
        case 'W':
        case 'Y':
          if (i === 0 || this.isVowel(next)) metaphone += char;
          break;
        case 'X':
          metaphone += 'KS';
          break;
        case 'Z':
          metaphone += 'S';
          break;
      }
    }
    return metaphone.substring(0, 4);
  }
  isVowel(char) {
    return 'AEIOU'.includes(char);
  }
  getTransformations(term1, term2) {
    const transformations = [];
    if (term1.length !== term2.length) {
      if (term1.length > term2.length) {
        transformations.push('deletion');
      } else {
        transformations.push('insertion');
      }
    }
    let substitutions = 0;
    const minLength = Math.min(term1.length, term2.length);
    for (let i = 0; i < minLength; i++) {
      if (term1[i] !== term2[i]) {
        substitutions++;
      }
    }
    if (substitutions > 0) {
      transformations.push('substitution');
    }
    for (let i = 0; i < minLength - 1; i++) {
      if (term1[i] === term2[i + 1] && term1[i + 1] === term2[i]) {
        transformations.push('transposition');
        break;
      }
    }
    return transformations;
  }
  getCacheKey(term, options) {
    return `${term}_${options.algorithm.join(',')}_${options.maxDistance}_${options.minSimilarity}`;
  }
  cacheResult(cacheKey, term, match) {
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, new Map());
    }
    const termCache = this.cache.get(cacheKey);
    if (termCache.size < 1000) {
      termCache.set(term, match);
    }
  }
}
exports.FuzzyMatcher = FuzzyMatcher;
exports.default = FuzzyMatcher;
//# sourceMappingURL=FuzzyMatcher.js.map
