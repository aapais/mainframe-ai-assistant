/**
 * Search Assertions Helper for Functional Testing
 * Provides specialized assertion methods for search functionality validation
 */

import { expect } from '@jest/globals';
import { SearchResult } from '../../../../src/types';
import { ParsedQuery } from '../../../../src/services/search/QueryParser';

export interface QueryParsingExpectation {
  type: string;
  termCount: number;
  containsTerms?: string[];
  hasOperators?: boolean;
  hasFilters?: boolean;
  hasPhrases?: boolean;
}

export interface RankingExpectation {
  scoreOrder: 'descending' | 'ascending';
  minScore?: number;
  maxScore?: number;
  scoreDistribution?: 'even' | 'diverse' | 'concentrated';
}

export interface RelevanceExpectation {
  minRelevance: number;
  mustContainTerms?: string[];
  preferredFields?: string[];
  boostingEffective?: boolean;
}

export class SearchAssertions {
  /**
   * Assert query parsing results meet expectations
   */
  assertQueryParsing(parsed: ParsedQuery, expectations: QueryParsingExpectation): void {
    expect(parsed.type).toBe(expectations.type);
    expect(parsed.terms.length).toBe(expectations.termCount);

    if (expectations.containsTerms) {
      for (const term of expectations.containsTerms) {
        const hasTermVariation = parsed.terms.some(t =>
          t.text.includes(term.toLowerCase()) ||
          term.toLowerCase().includes(t.text)
        );
        expect(hasTermVariation).toBe(true);
      }
    }

    if (expectations.hasOperators !== undefined) {
      const hasOperators = parsed.terms.some(t =>
        t.operator === 'AND' || t.operator === 'NOT' || t.operator === 'PHRASE'
      );
      expect(hasOperators).toBe(expectations.hasOperators);
    }

    if (expectations.hasFilters !== undefined) {
      expect(parsed.filters.length > 0).toBe(expectations.hasFilters);
    }

    if (expectations.hasPhrases !== undefined) {
      const hasPhrases = parsed.terms.some(t => t.operator === 'PHRASE');
      expect(hasPhrases).toBe(expectations.hasPhrases);
    }
  }

  /**
   * Assert search results are properly ranked by relevance
   */
  assertResultsRankedByRelevance(results: SearchResult[], expectations?: RankingExpectation): void {
    if (results.length <= 1) return;

    const scoreOrder = expectations?.scoreOrder || 'descending';

    for (let i = 1; i < results.length; i++) {
      if (scoreOrder === 'descending') {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      } else {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i - 1].score);
      }
    }

    if (expectations?.minScore !== undefined) {
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(expectations.minScore);
      }
    }

    if (expectations?.maxScore !== undefined) {
      for (const result of results) {
        expect(result.score).toBeLessThanOrEqual(expectations.maxScore);
      }
    }

    if (expectations?.scoreDistribution) {
      this.assertScoreDistribution(results, expectations.scoreDistribution);
    }
  }

  /**
   * Assert individual result relevance to query
   */
  assertResultRelevance(result: SearchResult, query: string, expectations?: RelevanceExpectation): void {
    expect(result.score).toBeGreaterThan(expectations?.minRelevance || 0);

    const queryTerms = query.toLowerCase().split(/\s+/);
    const resultText = this.extractResultText(result).toLowerCase();

    // At least some query terms should appear in the result
    const matchingTerms = queryTerms.filter(term => resultText.includes(term));
    expect(matchingTerms.length).toBeGreaterThan(0);

    if (expectations?.mustContainTerms) {
      for (const term of expectations.mustContainTerms) {
        expect(resultText).toContain(term.toLowerCase());
      }
    }

    if (expectations?.preferredFields) {
      const hasPreferredFieldMatch = this.checkPreferredFieldMatches(
        result,
        queryTerms,
        expectations.preferredFields
      );
      expect(hasPreferredFieldMatch).toBe(true);
    }
  }

  /**
   * Assert results are equal (for cache testing)
   */
  assertResultsEqual(results1: SearchResult[], results2: SearchResult[]): void {
    expect(results1.length).toBe(results2.length);

    for (let i = 0; i < results1.length; i++) {
      expect(results1[i].entry.id).toBe(results2[i].entry.id);
      expect(results1[i].score).toBeCloseTo(results2[i].score, 3);
    }
  }

  /**
   * Assert filter functionality works correctly
   */
  assertFilterResults(results: SearchResult[], filterType: string, filterValue: any): void {
    expect(results.length).toBeGreaterThanOrEqual(0);

    for (const result of results) {
      switch (filterType) {
        case 'category':
          expect(result.entry.category).toBe(filterValue);
          break;

        case 'tags':
          const hasTag = Array.isArray(filterValue)
            ? filterValue.some(tag =>
                result.entry.tags.some(entryTag =>
                  entryTag.toLowerCase().includes(tag.toLowerCase())
                )
              )
            : result.entry.tags.some(entryTag =>
                entryTag.toLowerCase().includes(filterValue.toLowerCase())
              );
          expect(hasTag).toBe(true);
          break;

        case 'dateRange':
          if (filterValue.start) {
            expect(result.entry.created_at.getTime()).toBeGreaterThanOrEqual(
              filterValue.start.getTime()
            );
          }
          if (filterValue.end) {
            expect(result.entry.created_at.getTime()).toBeLessThanOrEqual(
              filterValue.end.getTime()
            );
          }
          break;

        default:
          throw new Error(`Unknown filter type: ${filterType}`);
      }
    }
  }

  /**
   * Assert facet data is accurate
   */
  assertFacetAccuracy(facets: any[], results: SearchResult[]): void {
    for (const facet of facets) {
      let totalFacetCount = 0;

      for (const facetValue of facet.values) {
        expect(facetValue.count).toBeGreaterThan(0);
        totalFacetCount += facetValue.count;

        // Verify facet count accuracy
        const actualCount = this.countResultsWithFacetValue(
          results,
          facet.field,
          facetValue.value
        );
        expect(facetValue.count).toBe(actualCount);
      }

      // Total facet counts should not exceed result count
      expect(totalFacetCount).toBeLessThanOrEqual(results.length);
    }
  }

  /**
   * Assert search performance meets requirements
   */
  assertPerformanceRequirements(
    responseTime: number,
    resultCount: number,
    maxResponseTime: number = 1000,
    minResults: number = 0
  ): void {
    expect(responseTime).toBeLessThan(maxResponseTime);
    expect(resultCount).toBeGreaterThanOrEqual(minResults);
  }

  /**
   * Assert cache functionality works correctly
   */
  assertCacheFunction(
    firstSearchTime: number,
    secondSearchTime: number,
    cacheHit: boolean,
    expectedImprovement: number = 0.5
  ): void {
    expect(cacheHit).toBe(true);

    // Cache hit should be significantly faster
    const improvement = (firstSearchTime - secondSearchTime) / firstSearchTime;
    expect(improvement).toBeGreaterThan(expectedImprovement);

    // Second search should be faster
    expect(secondSearchTime).toBeLessThan(firstSearchTime);
  }

  /**
   * Assert fuzzy matching works for misspelled queries
   */
  assertFuzzyMatching(
    originalQuery: string,
    misspelledQuery: string,
    originalResults: SearchResult[],
    fuzzyResults: SearchResult[],
    minSimilarity: number = 0.3
  ): void {
    expect(fuzzyResults.length).toBeGreaterThan(0);

    if (originalResults.length > 0) {
      // Calculate similarity between result sets
      const similarity = this.calculateResultSetSimilarity(originalResults, fuzzyResults);
      expect(similarity).toBeGreaterThan(minSimilarity);
    }

    // Fuzzy results should contain some relevant items
    const queryTerms = originalQuery.toLowerCase().split(/\s+/);
    for (const result of fuzzyResults.slice(0, 5)) { // Check top 5 results
      const resultText = this.extractResultText(result).toLowerCase();
      const hasRelevantTerm = queryTerms.some(term =>
        resultText.includes(term) ||
        this.calculateLevenshteinDistance(term, resultText.split(/\s+/).find(t => t.length > 2) || '') <= 2
      );
      expect(hasRelevantTerm).toBe(true);
    }
  }

  /**
   * Assert phrase matching prioritizes exact phrases
   */
  assertPhraseMatching(
    phraseQuery: string,
    results: SearchResult[],
    expectExactMatches: boolean = true
  ): void {
    const phrase = phraseQuery.replace(/"/g, '').toLowerCase();

    if (expectExactMatches && results.length > 0) {
      // At least some results should contain the exact phrase
      const exactMatches = results.filter(result => {
        const resultText = this.extractResultText(result).toLowerCase();
        return resultText.includes(phrase);
      });

      expect(exactMatches.length).toBeGreaterThan(0);

      // Exact matches should be ranked higher
      if (exactMatches.length > 0 && results.length > exactMatches.length) {
        const topResults = results.slice(0, exactMatches.length);
        const hasExactMatchInTop = topResults.some(result =>
          exactMatches.some(exact => exact.entry.id === result.entry.id)
        );
        expect(hasExactMatchInTop).toBe(true);
      }
    }
  }

  /**
   * Assert boolean query operators work correctly
   */
  assertBooleanOperators(
    query: string,
    results: SearchResult[],
    operator: 'AND' | 'OR' | 'NOT'
  ): void {
    const terms = query.toLowerCase()
      .replace(/ and | or | not /gi, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0);

    switch (operator) {
      case 'AND':
        // All terms should appear in results
        for (const result of results) {
          const resultText = this.extractResultText(result).toLowerCase();
          const hasAllTerms = terms.every(term => resultText.includes(term));
          expect(hasAllTerms).toBe(true);
        }
        break;

      case 'OR':
        // At least one term should appear in each result
        for (const result of results) {
          const resultText = this.extractResultText(result).toLowerCase();
          const hasSomeTerm = terms.some(term => resultText.includes(term));
          expect(hasSomeTerm).toBe(true);
        }
        break;

      case 'NOT':
        // Excluded terms should not appear in results
        const excludedTerms = this.extractNotTerms(query);
        for (const result of results) {
          const resultText = this.extractResultText(result).toLowerCase();
          for (const excludedTerm of excludedTerms) {
            expect(resultText).not.toContain(excludedTerm.toLowerCase());
          }
        }
        break;
    }
  }

  /**
   * Assert suggestions are relevant and useful
   */
  assertSuggestionQuality(
    input: string,
    suggestions: string[],
    minRelevance: number = 0.7
  ): void {
    expect(suggestions.length).toBeGreaterThan(0);

    let relevantSuggestions = 0;
    for (const suggestion of suggestions) {
      if (suggestion.toLowerCase().startsWith(input.toLowerCase()) ||
          this.calculateStringSimilarity(input, suggestion) > 0.5) {
        relevantSuggestions++;
      }
    }

    const relevanceRatio = relevantSuggestions / suggestions.length;
    expect(relevanceRatio).toBeGreaterThan(minRelevance);
  }

  /**
   * Assert spell corrections are reasonable
   */
  assertSpellCorrectionQuality(
    misspelledQuery: string,
    corrections: string[],
    knownCorrectSpelling?: string
  ): void {
    expect(corrections.length).toBeGreaterThan(0);

    if (knownCorrectSpelling) {
      const hasCorrectSpelling = corrections.some(correction =>
        correction.toLowerCase().includes(knownCorrectSpelling.toLowerCase())
      );
      expect(hasCorrectSpelling).toBe(true);
    }

    // Corrections should be similar to original
    for (const correction of corrections) {
      const similarity = this.calculateStringSimilarity(misspelledQuery, correction);
      expect(similarity).toBeGreaterThan(0.3);
    }
  }

  // Private helper methods

  private extractResultText(result: SearchResult): string {
    return `${result.entry.title} ${result.entry.problem} ${result.entry.solution} ${result.entry.tags.join(' ')}`;
  }

  private checkPreferredFieldMatches(
    result: SearchResult,
    queryTerms: string[],
    preferredFields: string[]
  ): boolean {
    for (const field of preferredFields) {
      const fieldText = this.getFieldText(result, field).toLowerCase();
      if (queryTerms.some(term => fieldText.includes(term))) {
        return true;
      }
    }
    return false;
  }

  private getFieldText(result: SearchResult, field: string): string {
    switch (field) {
      case 'title':
        return result.entry.title;
      case 'problem':
        return result.entry.problem;
      case 'solution':
        return result.entry.solution;
      case 'tags':
        return result.entry.tags.join(' ');
      case 'category':
        return result.entry.category;
      default:
        return '';
    }
  }

  private assertScoreDistribution(results: SearchResult[], distribution: string): void {
    if (results.length < 3) return;

    const scores = results.map(r => r.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;

    switch (distribution) {
      case 'diverse':
        expect(range).toBeGreaterThan(maxScore * 0.3); // At least 30% range
        break;
      case 'concentrated':
        expect(range).toBeLessThan(maxScore * 0.2); // Less than 20% range
        break;
      case 'even':
        // Check if scores are somewhat evenly distributed
        const averageGap = range / (results.length - 1);
        let actualAverageGap = 0;
        for (let i = 1; i < results.length; i++) {
          actualAverageGap += scores[i - 1] - scores[i];
        }
        actualAverageGap /= (results.length - 1);
        expect(Math.abs(actualAverageGap - averageGap)).toBeLessThan(averageGap * 0.5);
        break;
    }
  }

  private countResultsWithFacetValue(
    results: SearchResult[],
    facetField: string,
    facetValue: string
  ): number {
    return results.filter(result => {
      switch (facetField) {
        case 'category':
          return result.entry.category === facetValue;
        case 'tags':
          return result.entry.tags.includes(facetValue);
        default:
          return false;
      }
    }).length;
  }

  private calculateResultSetSimilarity(
    results1: SearchResult[],
    results2: SearchResult[]
  ): number {
    if (results1.length === 0 && results2.length === 0) return 1.0;
    if (results1.length === 0 || results2.length === 0) return 0.0;

    const ids1 = new Set(results1.map(r => r.entry.id));
    const ids2 = new Set(results2.map(r => r.entry.id));

    const intersection = new Set([...ids1].filter(id => ids2.has(id)));
    const union = new Set([...ids1, ...ids2]);

    return intersection.size / union.size;
  }

  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.calculateLevenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private extractNotTerms(query: string): string[] {
    const notMatches = query.match(/NOT\s+(\w+)/gi);
    return notMatches ? notMatches.map(match => match.replace(/NOT\s+/i, '')) : [];
  }
}