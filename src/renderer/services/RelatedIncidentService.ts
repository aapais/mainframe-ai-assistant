import { Incident } from '../../types/incident';

export interface RelatedIncident {
  incident: Incident;
  similarityScore: number;
  matchedTerms: string[];
}

export interface SimilarityWeights {
  title: number;
  description: number;
  category: number;
}

export class RelatedIncidentService {
  private readonly weights: SimilarityWeights = {
    title: 3.0, // Title matches are most important
    description: 1.0, // Description matches have normal weight
    category: 2.0, // Category matches are important
  };

  private readonly stopWords = new Set([
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
    'o',
    'os',
    'as',
    'um',
    'uma',
    'do',
    'da',
    'de',
    'para',
    'com',
    'em',
    'no',
    'na',
    'por',
    'se',
    'que',
  ]);

  /**
   * Search for incidents related to the current incident
   * @param currentIncident The incident to find related incidents for
   * @param allIncidents All available incidents to search through
   * @param limit Maximum number of results to return (default: 5)
   * @returns Array of related incidents with similarity scores
   */
  public searchRelatedIncidents(
    currentIncident: Incident,
    allIncidents: Incident[],
    limit: number = 5
  ): RelatedIncident[] {
    // Filter to only resolved incidents, excluding current incident
    const resolvedIncidents = allIncidents.filter(
      incident => incident.status === 'resolvido' && incident.id !== currentIncident.id
    );

    if (resolvedIncidents.length === 0) {
      return [];
    }

    // Calculate similarity for each resolved incident
    const similarities = resolvedIncidents.map(incident => {
      const similarity = this.calculateSimilarity(currentIncident, incident);
      return {
        incident,
        similarityScore: similarity.score,
        matchedTerms: similarity.matchedTerms,
      };
    });

    // Sort by similarity score (descending) and return top matches
    return similarities
      .filter(item => item.similarityScore > 0.1) // Minimum threshold
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  /**
   * Calculate similarity between two incidents
   */
  private calculateSimilarity(
    incident1: Incident,
    incident2: Incident
  ): {
    score: number;
    matchedTerms: string[];
  } {
    const tokens1 = this.tokenizeIncident(incident1);
    const tokens2 = this.tokenizeIncident(incident2);

    // Calculate weighted similarity scores
    const titleSimilarity = this.calculateJaccardSimilarity(tokens1.title, tokens2.title);

    const descriptionSimilarity = this.calculateJaccardSimilarity(
      tokens1.description,
      tokens2.description
    );

    const categorySimilarity = this.calculateJaccardSimilarity(tokens1.category, tokens2.category);

    // Calculate weighted total score
    const totalScore =
      (titleSimilarity.score * this.weights.title +
        descriptionSimilarity.score * this.weights.description +
        categorySimilarity.score * this.weights.category) /
      (this.weights.title + this.weights.description + this.weights.category);

    // Combine matched terms from all fields
    const allMatchedTerms = [
      ...titleSimilarity.matchedTerms,
      ...descriptionSimilarity.matchedTerms,
      ...categorySimilarity.matchedTerms,
    ];

    // Remove duplicates and sort by length (longer terms first)
    const uniqueMatchedTerms = Array.from(new Set(allMatchedTerms)).sort(
      (a, b) => b.length - a.length
    );

    return {
      score: totalScore,
      matchedTerms: uniqueMatchedTerms,
    };
  }

  /**
   * Tokenize incident text fields
   */
  private tokenizeIncident(incident: Incident): {
    title: Set<string>;
    description: Set<string>;
    category: Set<string>;
  } {
    return {
      title: this.tokenizeText(incident.title || ''),
      description: this.tokenizeText(incident.description || ''),
      category: this.tokenizeText(incident.category || ''),
    };
  }

  /**
   * Tokenize text into normalized words
   */
  private tokenizeText(text: string): Set<string> {
    if (!text || text.trim().length === 0) {
      return new Set();
    }

    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(
        token => token.length > 2 && !this.stopWords.has(token) && !/^\d+$/.test(token) // Exclude pure numbers
      );

    return new Set(tokens);
  }

  /**
   * Calculate Jaccard similarity between two sets of tokens
   */
  private calculateJaccardSimilarity(
    set1: Set<string>,
    set2: Set<string>
  ): {
    score: number;
    matchedTerms: string[];
  } {
    if (set1.size === 0 && set2.size === 0) {
      return { score: 0, matchedTerms: [] };
    }

    if (set1.size === 0 || set2.size === 0) {
      return { score: 0, matchedTerms: [] };
    }

    // Calculate intersection and union
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    const jaccardScore = intersection.size / union.size;
    const matchedTerms = Array.from(intersection);

    return {
      score: jaccardScore,
      matchedTerms,
    };
  }

  /**
   * Calculate time to resolution for display purposes
   */
  public calculateResolutionTime(incident: Incident): string {
    if (!incident.createdAt || !incident.resolvedAt) {
      return 'N/A';
    }

    const created = new Date(incident.createdAt);
    const resolved = new Date(incident.resolvedAt);
    const diffMs = resolved.getTime() - created.getTime();

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Get success indicator based on resolution time and priority
   */
  public getSuccessIndicator(incident: Incident): 'high' | 'medium' | 'low' {
    const resolutionTime = this.calculateResolutionTime(incident);

    if (resolutionTime === 'N/A') {
      return 'low';
    }

    // Simple heuristic based on resolution time
    if (resolutionTime.includes('d')) {
      const days = parseInt(resolutionTime);
      if (days <= 1) return 'high';
      if (days <= 3) return 'medium';
      return 'low';
    } else if (resolutionTime.includes('h')) {
      const hours = parseInt(resolutionTime);
      if (hours <= 4) return 'high';
      if (hours <= 12) return 'medium';
      return 'low';
    } else {
      return 'high'; // Resolved in minutes
    }
  }
}

// Export singleton instance
export const relatedIncidentService = new RelatedIncidentService();
