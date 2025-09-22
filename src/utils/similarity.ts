/**
 * Utility functions for calculating similarity between incidents
 * Used for finding and suggesting similar incidents
 */

import { Incident } from '../../app/components/incident/types';

export interface SimilarityScore {
  incident: Incident;
  score: number;
  reasons: string[];
}

export interface SimilarityWeights {
  title: number;
  description: number;
  category: number;
  priority: number;
  status: number;
  tags: number;
}

// Default weights for similarity calculation
const DEFAULT_WEIGHTS: SimilarityWeights = {
  title: 0.35,        // Title has highest weight
  description: 0.25,  // Description is important
  category: 0.15,     // Category is significant
  priority: 0.10,     // Priority matters
  status: 0.05,       // Status less important for similarity
  tags: 0.10         // Tags help with categorization
};

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required to change one word into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a matrix to store distances
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate text similarity using normalized Levenshtein distance
 * Returns a score between 0 and 1 (1 being identical)
 */
export function textSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Normalize texts: lowercase and trim
  const normalized1 = text1.toLowerCase().trim();
  const normalized2 = text2.toLowerCase().trim();

  if (normalized1 === normalized2) return 1;

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - (distance / maxLength);
}

/**
 * Calculate cosine similarity between two text strings using word vectors
 * More sophisticated than Levenshtein for longer texts
 */
export function cosineSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Tokenize and normalize
  const words1 = text1.toLowerCase().match(/\w+/g) || [];
  const words2 = text2.toLowerCase().match(/\w+/g) || [];

  if (words1.length === 0 || words2.length === 0) return 0;

  // Create word frequency vectors
  const wordSet = new Set([...words1, ...words2]);
  const vector1: number[] = [];
  const vector2: number[] = [];

  wordSet.forEach(word => {
    vector1.push(words1.filter(w => w === word).length);
    vector2.push(words2.filter(w => w === word).length);
  });

  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate similarity between two priority levels
 */
export function prioritySimilarity(priority1: string, priority2: string): number {
  if (priority1 === priority2) return 1;

  const priorityOrder = ['P4', 'P3', 'P2', 'P1'];
  const index1 = priorityOrder.indexOf(priority1);
  const index2 = priorityOrder.indexOf(priority2);

  if (index1 === -1 || index2 === -1) return 0;

  const distance = Math.abs(index1 - index2);
  return 1 - (distance / 3); // Max distance is 3 (P1 to P4)
}

/**
 * Calculate similarity between tag arrays using Jaccard index
 */
export function tagSimilarity(tags1: string[], tags2: string[]): number {
  if (!tags1.length && !tags2.length) return 1;
  if (!tags1.length || !tags2.length) return 0;

  const set1 = new Set(tags1.map(tag => tag.toLowerCase()));
  const set2 = new Set(tags2.map(tag => tag.toLowerCase()));

  const intersection = new Set([...set1].filter(tag => set2.has(tag)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size; // Jaccard index
}

/**
 * Calculate overall similarity between two incidents
 */
export function calculateIncidentSimilarity(
  incident1: Incident,
  incident2: Incident,
  weights: SimilarityWeights = DEFAULT_WEIGHTS
): SimilarityScore {
  const reasons: string[] = [];
  let totalScore = 0;

  // Title similarity (using both Levenshtein and cosine)
  const titleLevenshtein = textSimilarity(incident1.title, incident2.title);
  const titleCosine = cosineSimilarity(incident1.title, incident2.title);
  const titleScore = Math.max(titleLevenshtein, titleCosine);
  totalScore += titleScore * weights.title;

  if (titleScore > 0.7) {
    reasons.push(`Títulos muito similares (${Math.round(titleScore * 100)}%)`);
  } else if (titleScore > 0.4) {
    reasons.push(`Títulos parcialmente similares (${Math.round(titleScore * 100)}%)`);
  }

  // Description similarity
  const descLevenshtein = textSimilarity(incident1.description, incident2.description);
  const descCosine = cosineSimilarity(incident1.description, incident2.description);
  const descScore = Math.max(descLevenshtein, descCosine);
  totalScore += descScore * weights.description;

  if (descScore > 0.6) {
    reasons.push(`Descrições similares (${Math.round(descScore * 100)}%)`);
  }

  // Category similarity (exact match)
  const categoryScore = incident1.category === incident2.category ? 1 : 0;
  totalScore += categoryScore * weights.category;

  if (categoryScore === 1) {
    reasons.push(`Mesma categoria: ${incident1.category}`);
  }

  // Priority similarity
  const priorityScore = prioritySimilarity(incident1.priority, incident2.priority);
  totalScore += priorityScore * weights.priority;

  if (priorityScore === 1) {
    reasons.push(`Mesma prioridade: ${incident1.priority}`);
  } else if (priorityScore > 0.5) {
    reasons.push(`Prioridades próximas: ${incident1.priority} ↔ ${incident2.priority}`);
  }

  // Status similarity (exact match, but lower weight)
  const statusScore = incident1.status === incident2.status ? 1 : 0;
  totalScore += statusScore * weights.status;

  if (statusScore === 1) {
    reasons.push(`Mesmo status: ${incident1.status}`);
  }

  // Tags similarity
  const tagsScore = tagSimilarity(incident1.tags, incident2.tags);
  totalScore += tagsScore * weights.tags;

  if (tagsScore > 0.5) {
    const commonTags = incident1.tags.filter(tag =>
      incident2.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
    if (commonTags.length > 0) {
      reasons.push(`Tags em comum: ${commonTags.slice(0, 3).join(', ')}${commonTags.length > 3 ? '...' : ''}`);
    }
  }

  return {
    incident: incident2,
    score: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
    reasons
  };
}

/**
 * Find the most similar incidents to a given incident
 */
export function getSimilarIncidents(
  targetIncident: Incident,
  allIncidents: Incident[],
  maxResults: number = 5,
  minSimilarity: number = 0.1,
  weights?: SimilarityWeights
): SimilarityScore[] {
  const similarities: SimilarityScore[] = [];

  // Calculate similarity with all other incidents
  for (const incident of allIncidents) {
    // Skip the same incident
    if (incident.id === targetIncident.id) continue;

    const similarity = calculateIncidentSimilarity(targetIncident, incident, weights);

    // Only include incidents above minimum similarity threshold
    if (similarity.score >= minSimilarity) {
      similarities.push(similarity);
    }
  }

  // Sort by similarity score (descending) and return top results
  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Get similarity insights for display purposes
 */
export function getSimilarityInsights(similarities: SimilarityScore[]): {
  totalFound: number;
  highSimilarity: number;
  mediumSimilarity: number;
  lowSimilarity: number;
  topCategories: string[];
  commonTags: string[];
} {
  const totalFound = similarities.length;
  const highSimilarity = similarities.filter(s => s.score >= 0.7).length;
  const mediumSimilarity = similarities.filter(s => s.score >= 0.4 && s.score < 0.7).length;
  const lowSimilarity = similarities.filter(s => s.score < 0.4).length;

  // Get most common categories
  const categoryCount = new Map<string, number>();
  similarities.forEach(s => {
    const category = s.incident.category;
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
  });

  const topCategories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  // Get most common tags
  const tagCount = new Map<string, number>();
  similarities.forEach(s => {
    s.incident.tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      tagCount.set(normalizedTag, (tagCount.get(normalizedTag) || 0) + 1);
    });
  });

  const commonTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  return {
    totalFound,
    highSimilarity,
    mediumSimilarity,
    lowSimilarity,
    topCategories,
    commonTags
  };
}

/**
 * Create a similarity summary for a specific incident comparison
 */
export function createSimilaritySummary(
  incident1: Incident,
  incident2: Incident
): {
  score: number;
  level: 'high' | 'medium' | 'low';
  keyFactors: string[];
  recommendations: string[];
} {
  const similarity = calculateIncidentSimilarity(incident1, incident2);

  let level: 'high' | 'medium' | 'low';
  if (similarity.score >= 0.7) level = 'high';
  else if (similarity.score >= 0.4) level = 'medium';
  else level = 'low';

  const recommendations: string[] = [];

  if (level === 'high') {
    recommendations.push('Considere usar a resolução do incidente similar');
    recommendations.push('Verifique se há padrões que podem ser prevenidos');
    if (incident2.status === 'resolved' || incident2.status === 'closed') {
      recommendations.push('Revisar a solução aplicada no incidente similar');
    }
  } else if (level === 'medium') {
    recommendations.push('Analise as diferenças para identificar variações do problema');
    recommendations.push('Verifique se parte da solução pode ser reutilizada');
  } else {
    recommendations.push('Incidentes com baixa similaridade, mas ainda relevantes');
  }

  return {
    score: similarity.score,
    level,
    keyFactors: similarity.reasons,
    recommendations
  };
}

export default {
  levenshteinDistance,
  textSimilarity,
  cosineSimilarity,
  prioritySimilarity,
  tagSimilarity,
  calculateIncidentSimilarity,
  getSimilarIncidents,
  getSimilarityInsights,
  createSimilaritySummary
};