'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RankingEngine = void 0;
class RankingEngine {
  defaultOptions;
  scoreCache = new Map();
  stats = {
    rankingsCalculated: 0,
    cacheHits: 0,
    averageRankingTime: 0,
    totalRankingTime: 0,
  };
  constructor() {
    this.defaultOptions = {
      algorithm: 'bm25',
      fieldBoosts: {
        title: 3.0,
        problem: 2.0,
        solution: 1.8,
        tags: 1.5,
        category: 1.2,
        content: 1.0,
      },
      documentBoosts: {},
      freshness: {
        enabled: true,
        halfLife: 30,
        maxBoost: 1.5,
      },
      popularity: {
        enabled: true,
        usageWeight: 0.3,
        successWeight: 0.7,
      },
      bm25: {
        k1: 1.5,
        b: 0.75,
        k2: 100,
        k3: 8,
      },
      tfidf: {
        useLogTF: true,
        useLogIDF: true,
        normalization: 'cosine',
        pivotSlope: 0.2,
      },
      combination: {
        tfidf: 0.3,
        bm25: 0.4,
        popularity: 0.15,
        freshness: 0.05,
        fieldMatch: 0.05,
        exactMatch: 0.05,
      },
    };
  }
  rankDocuments(query, postingLists, collection, options) {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    if (query.terms.length === 0 || postingLists.size === 0) {
      return [];
    }
    const candidates = this.getCandidateDocuments(postingLists);
    const scores = [];
    for (const docId of candidates) {
      const doc = collection.documents.get(docId);
      if (!doc) continue;
      const cacheKey = this.getCacheKey(query, docId, opts);
      const cached = this.scoreCache.get(cacheKey);
      if (cached) {
        scores.push(cached.get(docId));
        this.stats.cacheHits++;
        continue;
      }
      const score = this.calculateScore(query, docId, doc, postingLists, collection, opts);
      scores.push(score);
      this.cacheScore(cacheKey, docId, score);
    }
    scores.sort((a, b) => b.score - a.score);
    const rankingTime = Date.now() - startTime;
    this.stats.rankingsCalculated++;
    this.stats.totalRankingTime += rankingTime;
    this.stats.averageRankingTime = this.stats.totalRankingTime / this.stats.rankingsCalculated;
    return scores;
  }
  calculateBM25(
    queryTerms,
    docId,
    doc,
    postingLists,
    collection,
    params = this.defaultOptions.bm25
  ) {
    let score = 0;
    const { k1, b, k2, k3 } = params;
    const { totalDocuments, averageDocumentLength } = collection;
    for (const queryTerm of queryTerms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;
      const posting = postingList.documents.get(docId);
      if (!posting) continue;
      const tf = posting.termFrequency;
      const df = postingList.documents.size;
      const idf = Math.log((totalDocuments - df + 0.5) / (df + 0.5));
      const docLength = doc.totalTerms;
      const normalizedTF = tf / (tf + k1 * (1 - b + b * (docLength / averageDocumentLength)));
      const qtf = 1;
      const normalizedQTF = qtf / (qtf + k2);
      const termScore = idf * normalizedTF * normalizedQTF * (k3 + 1);
      const fieldBoost = posting.boost || 1.0;
      score += termScore * fieldBoost * queryTerm.boost;
    }
    return Math.max(0, score);
  }
  calculateTFIDF(
    queryTerms,
    docId,
    doc,
    postingLists,
    collection,
    params = this.defaultOptions.tfidf
  ) {
    let score = 0;
    const { totalDocuments } = collection;
    let docVector = 0;
    for (const queryTerm of queryTerms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;
      const posting = postingList.documents.get(docId);
      if (!posting) continue;
      const rawTF = posting.termFrequency;
      const tf = params.useLogTF ? Math.log(1 + rawTF) : rawTF;
      const df = postingList.documents.size;
      const rawIDF = totalDocuments / df;
      const idf = params.useLogIDF ? Math.log(rawIDF) : rawIDF;
      const weight = tf * idf;
      const fieldBoost = posting.boost || 1.0;
      const termScore = weight * fieldBoost * queryTerm.boost;
      score += termScore;
      if (params.normalization === 'cosine') {
        docVector += weight * weight;
      }
    }
    if (params.normalization === 'cosine' && docVector > 0) {
      score = score / Math.sqrt(docVector);
    } else if (params.normalization === 'pivoted') {
      const docLength = doc.totalTerms;
      const avgLength = collection.averageDocumentLength;
      const pivot = 1 - params.pivotSlope + params.pivotSlope * (docLength / avgLength);
      score = score / pivot;
    }
    return Math.max(0, score);
  }
  calculatePopularityScore(entry, options) {
    if (!options.enabled) return 0;
    const usageCount = entry.usage_count || 0;
    const successCount = entry.success_count || 0;
    const failureCount = entry.failure_count || 0;
    const usageScore = usageCount > 0 ? Math.log(1 + usageCount) / Math.log(1 + 100) : 0;
    const totalRatings = successCount + failureCount;
    const successRate = totalRatings > 0 ? successCount / totalRatings : 0.5;
    return usageScore * options.usageWeight + successRate * options.successWeight;
  }
  calculateFreshnessScore(entry, options) {
    if (!options.enabled) return 0;
    const now = Date.now();
    const created = entry.created_at?.getTime() || now;
    const updated = entry.updated_at?.getTime() || created;
    const mostRecent = Math.max(created, updated);
    const ageInDays = (now - mostRecent) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.pow(0.5, ageInDays / options.halfLife);
    return Math.min(options.maxBoost, 1 + decayFactor);
  }
  explainScore(score) {
    const explanations = [];
    explanations.push(`Overall Score: ${score.score.toFixed(3)} (${score.algorithm})`);
    for (const component of score.components) {
      const contribution = (component.contribution * 100).toFixed(1);
      explanations.push(
        `- ${component.factor}: ${component.value.toFixed(3)} × ${component.weight.toFixed(2)} = ${contribution}% (${component.explanation})`
      );
    }
    if (score.boosted) {
      explanations.push('- Applied field and popularity boosting');
    }
    return explanations.join('\n');
  }
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.scoreCache.size,
      cacheHitRate:
        this.stats.rankingsCalculated > 0
          ? this.stats.cacheHits / this.stats.rankingsCalculated
          : 0,
    };
  }
  clearCache() {
    this.scoreCache.clear();
  }
  calculateScore(query, docId, doc, postingLists, collection, options) {
    const components = [];
    let totalScore = 0;
    let relevanceScore = 0;
    switch (options.algorithm) {
      case 'tfidf':
        relevanceScore = this.calculateTFIDF(
          query.terms,
          docId,
          doc,
          postingLists,
          collection,
          options.tfidf
        );
        break;
      case 'bm25':
        relevanceScore = this.calculateBM25(
          query.terms,
          docId,
          doc,
          postingLists,
          collection,
          options.bm25
        );
        break;
      case 'combined':
        const tfidfScore = this.calculateTFIDF(
          query.terms,
          docId,
          doc,
          postingLists,
          collection,
          options.tfidf
        );
        const bm25Score = this.calculateBM25(
          query.terms,
          docId,
          doc,
          postingLists,
          collection,
          options.bm25
        );
        relevanceScore =
          tfidfScore * options.combination.tfidf + bm25Score * options.combination.bm25;
        break;
      case 'custom':
        relevanceScore = this.calculateCustomScore(query, docId, doc, postingLists, collection);
        break;
    }
    components.push({
      factor: 'relevance',
      value: relevanceScore,
      weight: 1.0,
      contribution: relevanceScore,
      explanation: `${options.algorithm.toUpperCase()} base relevance score`,
    });
    totalScore += relevanceScore;
    const fieldMatchScore = this.calculateFieldMatchBonus(query, doc, postingLists);
    if (fieldMatchScore > 0) {
      const contribution = fieldMatchScore * options.combination.fieldMatch;
      components.push({
        factor: 'field_match',
        value: fieldMatchScore,
        weight: options.combination.fieldMatch,
        contribution,
        explanation: 'Bonus for matching important fields',
      });
      totalScore += contribution;
    }
    const exactMatchScore = this.calculateExactMatchBonus(query, doc);
    if (exactMatchScore > 0) {
      const contribution = exactMatchScore * options.combination.exactMatch;
      components.push({
        factor: 'exact_match',
        value: exactMatchScore,
        weight: options.combination.exactMatch,
        contribution,
        explanation: 'Bonus for exact phrase matches',
      });
      totalScore += contribution;
    }
    return {
      docId,
      score: Math.max(0, totalScore),
      components,
      explanation: '',
      boosted: fieldMatchScore > 0 || exactMatchScore > 0,
      algorithm: options.algorithm,
    };
  }
  calculateCustomScore(query, docId, doc, postingLists, collection) {
    let score = 0;
    for (const queryTerm of query.terms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;
      const posting = postingList.documents.get(docId);
      if (!posting) continue;
      let termWeight = 1.0;
      if (this.isErrorCode(queryTerm.text)) {
        termWeight *= 3.0;
      }
      if (this.isSystemName(queryTerm.text)) {
        termWeight *= 2.0;
      }
      if (this.isMainframeTerm(queryTerm.text)) {
        termWeight *= 1.5;
      }
      score += posting.termFrequency * termWeight * posting.boost;
    }
    return score;
  }
  calculateFieldMatchBonus(query, doc, postingLists) {
    let bonus = 0;
    for (const queryTerm of query.terms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;
      const posting = postingList.documents.get(doc.id);
      if (!posting) continue;
      for (const field of posting.fields) {
        if (field === 'title') bonus += 2.0;
        else if (field === 'problem') bonus += 1.5;
        else if (field === 'tags') bonus += 1.2;
      }
    }
    return bonus;
  }
  calculateExactMatchBonus(query, doc) {
    const phraseTerms = query.terms.filter(t => t.operator === 'PHRASE');
    return phraseTerms.length * 2.0;
  }
  getCandidateDocuments(postingLists) {
    const candidates = new Set();
    for (const postingList of postingLists.values()) {
      for (const docId of postingList.documents.keys()) {
        candidates.add(docId);
      }
    }
    return candidates;
  }
  isErrorCode(term) {
    const errorPatterns = [
      /^S0C[0-9A-F]$/i,
      /^U\d{4}$/i,
      /^IEF\d{3}[A-Z]$/i,
      /^SQLCODE-?\d+$/i,
      /^STATUS\d+$/i,
    ];
    return errorPatterns.some(pattern => pattern.test(term));
  }
  isSystemName(term) {
    const systemNames = /^(MVS|CICS|DB2|IMS|VSAM|JCL|COBOL|TSO|ISPF|RACF|SDSF|DFSORT)$/i;
    return systemNames.test(term);
  }
  isMainframeTerm(term) {
    const mainframeTerms = [
      'abend',
      'dataset',
      'jcl',
      'vsam',
      'cics',
      'db2',
      'ims',
      'cobol',
      'tso',
      'ispf',
      'sdsf',
      'racf',
      'sort',
      'copy',
      'proc',
      'parm',
      'region',
      'space',
      'unit',
      'disp',
      'cond',
      'step',
      'exec',
    ];
    return mainframeTerms.includes(term.toLowerCase());
  }
  getCacheKey(query, docId, options) {
    const termText = query.terms
      .map(t => t.text)
      .sort()
      .join(',');
    return `${termText}_${options.algorithm}_${docId}`;
  }
  cacheScore(cacheKey, docId, score) {
    if (!this.scoreCache.has(cacheKey)) {
      this.scoreCache.set(cacheKey, new Map());
    }
    const docCache = this.scoreCache.get(cacheKey);
    if (docCache.size < 100) {
      docCache.set(docId, score);
    }
  }
}
exports.RankingEngine = RankingEngine;
exports.default = RankingEngine;
//# sourceMappingURL=RankingEngine.js.map
