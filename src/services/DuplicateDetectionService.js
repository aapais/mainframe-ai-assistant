'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DuplicateDetectionService = void 0;
class SimilarityAlgorithms {
  static jaccard(text1, text2) {
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
  static cosine(text1, text2) {
    const words1 = text1
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);
    const words2 = text2
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);
    const vocab = new Set([...words1, ...words2]);
    const vocabArray = Array.from(vocab);
    const vector1 = vocabArray.map(word => words1.filter(w => w === word).length);
    const vector2 = vocabArray.map(word => words2.filter(w => w === word).length);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }
    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
  static levenshtein(text1, text2) {
    const len1 = text1.length;
    const len2 = text2.length;
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = text1[i - 1] === text2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }
  static ngram(text1, text2, n = 2) {
    const ngrams1 = this.generateNgrams(text1.toLowerCase(), n);
    const ngrams2 = this.generateNgrams(text2.toLowerCase(), n);
    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);
    return intersection.size / union.size;
  }
  static generateNgrams(text, n) {
    const ngrams = new Set();
    const cleaned = text
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    for (let i = 0; i <= cleaned.length - n; i++) {
      ngrams.add(cleaned.substring(i, i + n));
    }
    return ngrams;
  }
  static weighted(similarities, weights) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [field, similarity] of Object.entries(similarities)) {
      const weight = weights[field] || 1;
      weightedSum += similarity * weight;
      totalWeight += weight;
    }
    return totalWeight === 0 ? 0 : weightedSum / totalWeight;
  }
}
class DuplicateDetectionService {
  cache = new Map();
  performanceMetrics = {
    totalComparisons: 0,
    executionTime: 0,
    cacheHits: 0,
    aiCalls: 0,
    memoryUsed: 0,
  };
  defaultWeights = {
    title: 3.0,
    problem: 2.0,
    solution: 1.5,
    tags: 1.0,
    category: 0.5,
    semantic: 4.0,
  };
  async findSimilar(targetEntry, allEntries, options = {}) {
    const startTime = Date.now();
    const {
      threshold = 0.7,
      useAI = false,
      maxComparisons = 1000,
      includeFields = ['title', 'problem', 'solution', 'tags', 'category'],
      optimizationLevel = 'balanced',
    } = options;
    const cacheKey = this.generateCacheKey(targetEntry, options);
    if (this.cache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.cache.get(cacheKey);
    }
    const results = [];
    const comparisons = Math.min(maxComparisons, allEntries.length);
    const filteredEntries = this.optimizeEntryList(
      allEntries.filter(entry => entry.id !== targetEntry.id),
      targetEntry,
      optimizationLevel
    ).slice(0, comparisons);
    for (const entry of filteredEntries) {
      const similarity = await this.calculateSimilarity(targetEntry, entry, includeFields, useAI);
      if (similarity.similarity >= threshold) {
        results.push(similarity);
      }
      this.performanceMetrics.totalComparisons++;
    }
    results.sort((a, b) => b.similarity - a.similarity);
    this.cache.set(cacheKey, results);
    this.performanceMetrics.executionTime += Date.now() - startTime;
    return results;
  }
  async detectDuplicateGroups(entries, options = {}) {
    const { threshold = 0.8, groupSimilar = true, optimizationLevel = 'balanced' } = options;
    const processedEntries = new Set();
    const duplicateGroups = [];
    const sortedEntries = [...entries].sort((a, b) => {
      const usageA = (a.usage_count || 0) + (a.success_count || 0);
      const usageB = (b.usage_count || 0) + (b.success_count || 0);
      if (usageA !== usageB) {
        return usageB - usageA;
      }
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });
    for (const entry of sortedEntries) {
      if (processedEntries.has(entry.id)) continue;
      const similarEntries = await this.findSimilar(entry, entries, {
        ...options,
        threshold,
        groupSimilar: false,
      });
      if (similarEntries.length > 0) {
        const duplicates = similarEntries
          .map(s => s.entry)
          .filter(e => !processedEntries.has(e.id));
        if (duplicates.length > 0) {
          const group = {
            primary: entry,
            duplicates,
            averageSimilarity:
              similarEntries.reduce((sum, s) => sum + s.similarity, 0) / similarEntries.length,
            mergeStrategy: this.suggestMergeStrategy(entry, duplicates),
            conflicts: this.identifyConflicts(entry, duplicates),
          };
          duplicateGroups.push(group);
          processedEntries.add(entry.id);
          duplicates.forEach(d => processedEntries.add(d.id));
        }
      }
    }
    return duplicateGroups.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
  }
  async calculateSimilarity(entry1, entry2, includeFields, useAI) {
    const scores = {
      title: 0,
      problem: 0,
      solution: 0,
      tags: 0,
      category: 0,
    };
    const matchedFields = [];
    if (includeFields.includes('title') && entry1.title && entry2.title) {
      scores.title = Math.max(
        SimilarityAlgorithms.jaccard(entry1.title, entry2.title),
        SimilarityAlgorithms.levenshtein(entry1.title, entry2.title),
        SimilarityAlgorithms.ngram(entry1.title, entry2.title)
      );
      if (scores.title > 0.7) matchedFields.push('title');
    }
    if (includeFields.includes('problem') && entry1.problem && entry2.problem) {
      scores.problem = Math.max(
        SimilarityAlgorithms.jaccard(entry1.problem, entry2.problem),
        SimilarityAlgorithms.cosine(entry1.problem, entry2.problem)
      );
      if (scores.problem > 0.6) matchedFields.push('problem');
    }
    if (includeFields.includes('solution') && entry1.solution && entry2.solution) {
      scores.solution = Math.max(
        SimilarityAlgorithms.jaccard(entry1.solution, entry2.solution),
        SimilarityAlgorithms.cosine(entry1.solution, entry2.solution)
      );
      if (scores.solution > 0.6) matchedFields.push('solution');
    }
    if (includeFields.includes('tags') && entry1.tags && entry2.tags) {
      const tags1 = new Set(entry1.tags.map(t => t.toLowerCase()));
      const tags2 = new Set(entry2.tags.map(t => t.toLowerCase()));
      if (tags1.size > 0 || tags2.size > 0) {
        const intersection = new Set([...tags1].filter(x => tags2.has(x)));
        const union = new Set([...tags1, ...tags2]);
        scores.tags = intersection.size / union.size;
        if (scores.tags > 0.5) matchedFields.push('tags');
      }
    }
    if (includeFields.includes('category') && entry1.category && entry2.category) {
      scores.category = entry1.category === entry2.category ? 1 : 0;
      if (scores.category === 1) matchedFields.push('category');
    }
    if (useAI) {
      try {
        scores.semantic = await this.calculateSemanticSimilarity(entry1, entry2);
        this.performanceMetrics.aiCalls++;
      } catch (error) {
        console.warn('AI similarity calculation failed:', error);
        scores.semantic = 0;
      }
    }
    const similarity = SimilarityAlgorithms.weighted(scores, this.defaultWeights);
    const { matchType, confidence } = this.classifyMatch(similarity, scores, matchedFields);
    return {
      entry: entry2,
      similarity,
      scores,
      matchType,
      matchedFields,
      confidence,
    };
  }
  async calculateSemanticSimilarity(entry1, entry2) {
    const text1 = `${entry1.title} ${entry1.problem}`;
    const text2 = `${entry2.title} ${entry2.problem}`;
    const technicalTerms = this.extractTechnicalTerms(text1, text2);
    const commonTerms = technicalTerms.common;
    const totalTerms = technicalTerms.total;
    return totalTerms > 0 ? commonTerms / totalTerms : 0;
  }
  extractTechnicalTerms(text1, text2) {
    const technicalPatterns = [
      /S0C\d/g,
      /U\d{4}/g,
      /IEF\d{3}[A-Z]/g,
      /DB2|SQL/g,
      /VSAM|QSAM|BSAM/g,
      /JCL|MVS|TSO/g,
      /COBOL|PL1|ASSEMBLER/g,
      /CICS|IMS/g,
    ];
    const terms1 = new Set();
    const terms2 = new Set();
    technicalPatterns.forEach(pattern => {
      const matches1 = (text1.match(pattern) || []).map(m => m.toLowerCase());
      const matches2 = (text2.match(pattern) || []).map(m => m.toLowerCase());
      matches1.forEach(term => terms1.add(term));
      matches2.forEach(term => terms2.add(term));
    });
    const commonTerms = new Set([...terms1].filter(x => terms2.has(x)));
    const totalTerms = new Set([...terms1, ...terms2]);
    return {
      common: commonTerms.size,
      total: totalTerms.size,
    };
  }
  classifyMatch(similarity, scores, matchedFields) {
    let matchType;
    let confidence = similarity;
    if (similarity >= 0.95) {
      matchType = 'exact';
      confidence = Math.min(1, confidence * 1.1);
    } else if (similarity >= 0.8) {
      matchType = 'high';
      confidence = Math.min(1, confidence * 1.05);
    } else if (similarity >= 0.6) {
      matchType = 'medium';
    } else {
      matchType = 'low';
      confidence = confidence * 0.9;
    }
    if (matchedFields.includes('title') && scores.title > 0.8) {
      confidence = Math.min(1, confidence * 1.1);
    }
    if (scores.category === 0 && matchedFields.length > 0) {
      confidence = confidence * 0.9;
    }
    return { matchType, confidence: Math.max(0, Math.min(1, confidence)) };
  }
  optimizeEntryList(entries, targetEntry, optimizationLevel) {
    switch (optimizationLevel) {
      case 'fast':
        return entries.filter(entry => entry.category === targetEntry.category);
      case 'thorough':
        return entries;
      case 'balanced':
      default:
        const sameCategory = entries.filter(entry => entry.category === targetEntry.category);
        const similarTags = entries.filter(entry => {
          if (!entry.tags || !targetEntry.tags) return false;
          const commonTags = entry.tags.filter(tag =>
            targetEntry.tags.some(tTag => tTag.toLowerCase().includes(tag.toLowerCase()))
          );
          return commonTags.length > 0;
        });
        const combined = [...new Set([...sameCategory, ...similarTags])];
        return combined.length > 0 ? combined : entries.slice(0, 200);
    }
  }
  suggestMergeStrategy(primary, duplicates) {
    const primaryUsage = (primary.usage_count || 0) + (primary.success_count || 0);
    const maxDuplicateUsage = Math.max(
      ...duplicates.map(d => (d.usage_count || 0) + (d.success_count || 0))
    );
    if (primaryUsage > maxDuplicateUsage * 2) {
      return 'keep_primary';
    }
    const primaryDate = new Date(primary.updated_at || primary.created_at || 0).getTime();
    const maxDuplicateDate = Math.max(
      ...duplicates.map(d => new Date(d.updated_at || d.created_at || 0).getTime())
    );
    if (maxDuplicateDate > primaryDate + 30 * 24 * 60 * 60 * 1000) {
      return 'manual_review';
    }
    return 'merge_all';
  }
  identifyConflicts(primary, duplicates) {
    const conflicts = [];
    duplicates.forEach(duplicate => {
      if (primary.category !== duplicate.category) {
        conflicts.push(`Category mismatch: ${primary.category} vs ${duplicate.category}`);
      }
      const primarySolLength = primary.solution?.length || 0;
      const duplicateSolLength = duplicate.solution?.length || 0;
      if (Math.abs(primarySolLength - duplicateSolLength) > primarySolLength * 0.5) {
        conflicts.push('Significant solution length difference');
      }
      const primaryUpdate = new Date(primary.updated_at || 0).getTime();
      const duplicateUpdate = new Date(duplicate.updated_at || 0).getTime();
      if (duplicateUpdate > primaryUpdate + 7 * 24 * 60 * 60 * 1000) {
        conflicts.push('Duplicate has more recent updates');
      }
    });
    return [...new Set(conflicts)];
  }
  generateCacheKey(entry, options) {
    return `${entry.id}_${JSON.stringify(options)}`;
  }
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
  clearCache() {
    this.cache.clear();
    this.performanceMetrics = {
      totalComparisons: 0,
      executionTime: 0,
      cacheHits: 0,
      aiCalls: 0,
      memoryUsed: 0,
    };
  }
  getCacheStats() {
    const totalRequests =
      this.performanceMetrics.totalComparisons + this.performanceMetrics.cacheHits;
    const hitRate = totalRequests > 0 ? this.performanceMetrics.cacheHits / totalRequests : 0;
    return {
      size: this.cache.size,
      hitRate,
    };
  }
}
exports.DuplicateDetectionService = DuplicateDetectionService;
exports.default = DuplicateDetectionService;
//# sourceMappingURL=DuplicateDetectionService.js.map
