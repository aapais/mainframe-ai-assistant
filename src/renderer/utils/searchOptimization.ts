/**
 * Search Algorithm Optimizations
 *
 * Advanced search optimizations including:
 * - Inverted index for fast text search
 * - Boyer-Moore string matching
 * - Fuzzy search with Levenshtein distance
 * - Search result ranking algorithms
 * - Query preprocessing and normalization
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

// ===========================================
// Types and Interfaces
// ===========================================

export interface SearchIndex {
  term: string;
  documents: Set<string>;
  frequency: number;
}

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  created_at: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
}

export interface SearchMatch {
  documentId: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'semantic';
  matches: Array<{
    field: string;
    start: number;
    end: number;
    score: number;
  }>;
}

export interface RankingFactors {
  textRelevance: number;
  freshness: number;
  popularity: number;
  successRate: number;
  categoryMatch: number;
  tagMatch: number;
}

// ===========================================
// Inverted Index Implementation
// ===========================================

export class InvertedIndex {
  private index = new Map<string, SearchIndex>();
  private documents = new Map<string, SearchDocument>();
  private stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'has',
    'he',
    'in',
    'is',
    'it',
    'its',
    'of',
    'on',
    'that',
    'the',
    'to',
    'was',
    'will',
    'with',
    'this',
    'but',
    'they',
    'have',
    'had',
    'what',
    'said',
    'each',
    'which',
    'their',
    'time',
    'can',
    'may',
  ]);

  // Build index from documents
  buildIndex(documents: SearchDocument[]): void {
    this.index.clear();
    this.documents.clear();

    for (const doc of documents) {
      this.documents.set(doc.id, doc);
      this.indexDocument(doc);
    }
  }

  private indexDocument(doc: SearchDocument): void {
    // Index title with higher weight
    this.indexText(doc.id, doc.title, 3);

    // Index content
    this.indexText(doc.id, doc.content, 1);

    // Index category with medium weight
    this.indexText(doc.id, doc.category, 2);

    // Index tags with high weight
    for (const tag of doc.tags) {
      this.indexText(doc.id, tag, 2.5);
    }
  }

  private indexText(docId: string, text: string, weight: number = 1): void {
    const terms = this.tokenize(text);

    for (const term of terms) {
      if (this.stopWords.has(term) || term.length < 2) continue;

      if (!this.index.has(term)) {
        this.index.set(term, {
          term,
          documents: new Set(),
          frequency: 0,
        });
      }

      const indexEntry = this.index.get(term)!;
      indexEntry.documents.add(docId);
      indexEntry.frequency += weight;
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0);
  }

  // Search using inverted index
  search(query: string): SearchMatch[] {
    const terms = this.tokenize(query);
    const candidateDocuments = new Map<string, number>();

    // Find candidate documents using inverted index
    for (const term of terms) {
      const exactMatches = this.index.get(term);
      if (exactMatches) {
        for (const docId of exactMatches.documents) {
          candidateDocuments.set(
            docId,
            (candidateDocuments.get(docId) || 0) + exactMatches.frequency
          );
        }
      }

      // Find fuzzy matches for typos
      const fuzzyMatches = this.findFuzzyMatches(term, 2);
      for (const [fuzzyTerm, distance] of fuzzyMatches) {
        const indexEntry = this.index.get(fuzzyTerm);
        if (indexEntry) {
          const score = indexEntry.frequency * (1 - distance / term.length);
          for (const docId of indexEntry.documents) {
            candidateDocuments.set(docId, (candidateDocuments.get(docId) || 0) + score);
          }
        }
      }
    }

    // Convert to SearchMatch objects
    const matches: SearchMatch[] = [];
    for (const [docId, score] of candidateDocuments) {
      const doc = this.documents.get(docId);
      if (doc) {
        matches.push({
          documentId: docId,
          score,
          matchType: 'partial',
          matches: this.findMatchPositions(doc, query),
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  private findFuzzyMatches(term: string, maxDistance: number): Array<[string, number]> {
    const matches: Array<[string, number]> = [];

    for (const indexedTerm of this.index.keys()) {
      if (Math.abs(indexedTerm.length - term.length) > maxDistance) continue;

      const distance = this.levenshteinDistance(term, indexedTerm);
      if (distance <= maxDistance) {
        matches.push([indexedTerm, distance]);
      }
    }

    return matches;
  }

  private findMatchPositions(
    doc: SearchDocument,
    query: string
  ): Array<{
    field: string;
    start: number;
    end: number;
    score: number;
  }> {
    const positions: Array<{
      field: string;
      start: number;
      end: number;
      score: number;
    }> = [];

    const fields = [
      { name: 'title', text: doc.title, weight: 3 },
      { name: 'content', text: doc.content, weight: 1 },
      { name: 'category', text: doc.category, weight: 2 },
      { name: 'tags', text: doc.tags.join(' '), weight: 2.5 },
    ];

    const queryTerms = this.tokenize(query);

    for (const field of fields) {
      for (const term of queryTerms) {
        const matches = this.findStringMatches(field.text.toLowerCase(), term);
        for (const match of matches) {
          positions.push({
            field: field.name,
            start: match.start,
            end: match.end,
            score: field.weight,
          });
        }
      }
    }

    return positions;
  }

  private findStringMatches(text: string, pattern: string): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = [];
    let index = 0;

    while (index < text.length) {
      const found = text.indexOf(pattern, index);
      if (found === -1) break;

      matches.push({
        start: found,
        end: found + pattern.length,
      });

      index = found + 1;
    }

    return matches;
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // Get index statistics
  getStats(): {
    totalTerms: number;
    totalDocuments: number;
    averageTermsPerDocument: number;
    indexSizeBytes: number;
  } {
    let totalTermFrequency = 0;
    for (const entry of this.index.values()) {
      totalTermFrequency += entry.frequency;
    }

    const indexSizeBytes = JSON.stringify([...this.index.entries()]).length;

    return {
      totalTerms: this.index.size,
      totalDocuments: this.documents.size,
      averageTermsPerDocument:
        this.documents.size > 0 ? totalTermFrequency / this.documents.size : 0,
      indexSizeBytes,
    };
  }
}

// ===========================================
// Boyer-Moore String Matching
// ===========================================

export class BoyerMooreSearch {
  private pattern: string;
  private badCharTable: Map<string, number>;
  private goodSuffixTable: number[];

  constructor(pattern: string) {
    this.pattern = pattern.toLowerCase();
    this.badCharTable = this.buildBadCharTable();
    this.goodSuffixTable = this.buildGoodSuffixTable();
  }

  private buildBadCharTable(): Map<string, number> {
    const table = new Map<string, number>();

    for (let i = 0; i < this.pattern.length - 1; i++) {
      table.set(this.pattern[i], this.pattern.length - 1 - i);
    }

    return table;
  }

  private buildGoodSuffixTable(): number[] {
    const table = new Array(this.pattern.length).fill(this.pattern.length);
    const lastPrefixPosition = this.pattern.length;

    // Case 1: suffix occurs somewhere else in pattern
    for (let i = this.pattern.length - 1; i >= 0; i--) {
      if (this.isPrefix(i + 1)) {
        table[i] = lastPrefixPosition - i + this.pattern.length - 1;
      }
    }

    // Case 2: suffix is a prefix of pattern
    for (let i = 0; i < this.pattern.length - 1; i++) {
      const suffixLength = this.suffixLength(i);
      table[this.pattern.length - 1 - suffixLength] = this.pattern.length - 1 - i + suffixLength;
    }

    return table;
  }

  private isPrefix(p: number): boolean {
    for (let i = p, j = 0; i < this.pattern.length; i++, j++) {
      if (this.pattern[i] !== this.pattern[j]) {
        return false;
      }
    }
    return true;
  }

  private suffixLength(p: number): number {
    let len = 0;
    for (
      let i = p, j = this.pattern.length - 1;
      i >= 0 && this.pattern[i] === this.pattern[j];
      i--, j--
    ) {
      len++;
    }
    return len;
  }

  search(text: string): number[] {
    const textLower = text.toLowerCase();
    const matches: number[] = [];
    let skip = 0;

    while (skip <= textLower.length - this.pattern.length) {
      let j = this.pattern.length - 1;

      while (j >= 0 && this.pattern[j] === textLower[skip + j]) {
        j--;
      }

      if (j < 0) {
        matches.push(skip);
        skip += this.goodSuffixTable[0];
      } else {
        const badCharShift = this.badCharTable.get(textLower[skip + j]) || this.pattern.length;
        const goodSuffixShift = this.goodSuffixTable[j];
        skip += Math.max(badCharShift, goodSuffixShift);
      }
    }

    return matches;
  }
}

// ===========================================
// Search Result Ranking
// ===========================================

export class SearchRanker {
  private static readonly RANKING_WEIGHTS = {
    textRelevance: 0.4,
    freshness: 0.15,
    popularity: 0.2,
    successRate: 0.15,
    categoryMatch: 0.05,
    tagMatch: 0.05,
  };

  static rankResults(
    matches: SearchMatch[],
    documents: Map<string, SearchDocument>,
    query: string,
    categoryFilter?: string
  ): SearchMatch[] {
    const now = Date.now();
    const rankedMatches = matches.map(match => {
      const doc = documents.get(match.documentId);
      if (!doc) return { ...match, score: 0 };

      const factors = this.calculateRankingFactors(match, doc, query, categoryFilter, now);
      const finalScore = this.computeFinalScore(factors);

      return {
        ...match,
        score: finalScore,
      };
    });

    return rankedMatches.sort((a, b) => b.score - a.score);
  }

  private static calculateRankingFactors(
    match: SearchMatch,
    doc: SearchDocument,
    query: string,
    categoryFilter: string | undefined,
    now: number
  ): RankingFactors {
    // Text relevance (TF-IDF inspired)
    const textRelevance = this.calculateTextRelevance(match, doc, query);

    // Freshness (newer content scores higher)
    const daysSinceCreation = (now - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const freshness = Math.exp(-daysSinceCreation / 365); // Exponential decay over a year

    // Popularity (usage count)
    const maxUsage = 1000; // Normalize to reasonable range
    const popularity = Math.min(doc.usage_count / maxUsage, 1);

    // Success rate
    const totalRatings = doc.success_count + doc.failure_count;
    const successRate = totalRatings > 0 ? doc.success_count / totalRatings : 0.5;

    // Category match
    const categoryMatch =
      categoryFilter && doc.category.toLowerCase() === categoryFilter.toLowerCase() ? 1 : 0;

    // Tag match (if query matches any tags exactly)
    const queryLower = query.toLowerCase();
    const tagMatch = doc.tags.some(tag => tag.toLowerCase().includes(queryLower)) ? 1 : 0;

    return {
      textRelevance,
      freshness,
      popularity,
      successRate,
      categoryMatch,
      tagMatch,
    };
  }

  private static calculateTextRelevance(
    match: SearchMatch,
    doc: SearchDocument,
    query: string
  ): number {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 1);
    let relevanceScore = 0;

    // Base score from match
    relevanceScore += match.score * 0.5;

    // Boost for exact phrase matches
    const fullText = `${doc.title} ${doc.content}`.toLowerCase();
    if (fullText.includes(query.toLowerCase())) {
      relevanceScore += 0.3;
    }

    // Boost for title matches (higher weight)
    const titleMatches = queryTerms.filter(term => doc.title.toLowerCase().includes(term)).length;
    relevanceScore += (titleMatches / queryTerms.length) * 0.4;

    // Boost for multiple term matches
    const contentMatches = queryTerms.filter(term =>
      doc.content.toLowerCase().includes(term)
    ).length;
    relevanceScore += (contentMatches / queryTerms.length) * 0.2;

    return Math.min(relevanceScore, 1);
  }

  private static computeFinalScore(factors: RankingFactors): number {
    return (
      (factors.textRelevance * this.RANKING_WEIGHTS.textRelevance +
        factors.freshness * this.RANKING_WEIGHTS.freshness +
        factors.popularity * this.RANKING_WEIGHTS.popularity +
        factors.successRate * this.RANKING_WEIGHTS.successRate +
        factors.categoryMatch * this.RANKING_WEIGHTS.categoryMatch +
        factors.tagMatch * this.RANKING_WEIGHTS.tagMatch) *
      100
    ); // Scale to 0-100
  }
}

// ===========================================
// Optimized Search Engine
// ===========================================

export class OptimizedSearchEngine {
  private index: InvertedIndex;
  private documents = new Map<string, SearchDocument>();
  private isIndexed = false;

  constructor() {
    this.index = new InvertedIndex();
  }

  // Index documents for fast searching
  indexDocuments(documents: SearchDocument[]): void {
    console.time('Search index build');

    this.documents.clear();
    documents.forEach(doc => this.documents.set(doc.id, doc));

    this.index.buildIndex(documents);
    this.isIndexed = true;

    console.timeEnd('Search index build');
    console.log('Search index stats:', this.index.getStats());
  }

  // Perform optimized search
  search(
    query: string,
    options: {
      limit?: number;
      category?: string;
      sortBy?: 'relevance' | 'recent' | 'popular' | 'success_rate';
      useAdvancedRanking?: boolean;
    } = {}
  ): SearchMatch[] {
    if (!this.isIndexed) {
      throw new Error('Documents must be indexed before searching');
    }

    const { limit = 50, category, sortBy = 'relevance', useAdvancedRanking = true } = options;

    console.time('Search execution');

    // Get initial matches from inverted index
    let matches = this.index.search(query);

    // Filter by category if specified
    if (category) {
      matches = matches.filter(match => {
        const doc = this.documents.get(match.documentId);
        return doc?.category.toLowerCase() === category.toLowerCase();
      });
    }

    // Apply advanced ranking if enabled
    if (useAdvancedRanking) {
      matches = SearchRanker.rankResults(matches, this.documents, query, category);
    }

    // Sort results
    matches = this.sortResults(matches, sortBy);

    // Limit results
    const limitedMatches = matches.slice(0, limit);

    console.timeEnd('Search execution');
    console.log(`Found ${matches.length} matches, returning ${limitedMatches.length}`);

    return limitedMatches;
  }

  private sortResults(matches: SearchMatch[], sortBy: string): SearchMatch[] {
    switch (sortBy) {
      case 'recent':
        return matches.sort((a, b) => {
          const docA = this.documents.get(a.documentId);
          const docB = this.documents.get(b.documentId);
          if (!docA || !docB) return 0;
          return new Date(docB.created_at).getTime() - new Date(docA.created_at).getTime();
        });

      case 'popular':
        return matches.sort((a, b) => {
          const docA = this.documents.get(a.documentId);
          const docB = this.documents.get(b.documentId);
          if (!docA || !docB) return 0;
          return docB.usage_count - docA.usage_count;
        });

      case 'success_rate':
        return matches.sort((a, b) => {
          const docA = this.documents.get(a.documentId);
          const docB = this.documents.get(b.documentId);
          if (!docA || !docB) return 0;

          const successRateA =
            docA.success_count / Math.max(1, docA.success_count + docA.failure_count);
          const successRateB =
            docB.success_count / Math.max(1, docB.success_count + docB.failure_count);

          return successRateB - successRateA;
        });

      case 'relevance':
      default:
        return matches.sort((a, b) => b.score - a.score);
    }
  }

  // Get search suggestions (autocomplete)
  getSuggestions(query: string, limit: number = 10): string[] {
    const queryLower = query.toLowerCase();
    const suggestions = new Set<string>();

    // Get suggestions from indexed terms
    for (const term of this.index['index'].keys()) {
      if (term.startsWith(queryLower) && term !== queryLower) {
        suggestions.add(term);
      }
    }

    // Get suggestions from document titles and tags
    for (const doc of this.documents.values()) {
      const words = `${doc.title} ${doc.tags.join(' ')}`
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2);

      for (const word of words) {
        if (word.startsWith(queryLower) && word !== queryLower) {
          suggestions.add(word);
        }
      }
    }

    return Array.from(suggestions)
      .sort((a, b) => a.length - b.length) // Prefer shorter suggestions
      .slice(0, limit);
  }

  // Get index statistics
  getIndexStats() {
    return this.index.getStats();
  }

  // Update a single document in the index
  updateDocument(document: SearchDocument): void {
    this.documents.set(document.id, document);

    // For now, rebuild the entire index
    // In a production system, you'd want incremental updates
    this.indexDocuments(Array.from(this.documents.values()));
  }

  // Remove a document from the index
  removeDocument(documentId: string): void {
    this.documents.delete(documentId);
    this.indexDocuments(Array.from(this.documents.values()));
  }
}

// ===========================================
// Export utilities
// ===========================================

export { BoyerMooreSearch, SearchRanker };
export default OptimizedSearchEngine;
