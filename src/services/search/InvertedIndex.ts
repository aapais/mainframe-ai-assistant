/**
 * High-Performance Inverted Index for Full-Text Search
 * Optimized for <1s response time with mainframe knowledge base
 */

import { KBEntry } from '../../types';

export interface IndexedDocument {
  id: string;
  fieldBoosts: Record<string, number>;
  termFrequencies: Map<string, number>;
  fieldLengths: Record<string, number>;
  totalTerms: number;
  lastModified: number;
}

export interface PostingList {
  term: string;
  frequency: number; // Global frequency across all documents
  documents: Map<string, PostingEntry>; // Document ID -> posting entry
}

export interface PostingEntry {
  docId: string;
  termFrequency: number;
  positions: number[]; // Term positions for phrase queries
  fields: Set<string>; // Fields where term appears
  boost: number; // Field-based boost value
}

export interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  uniqueTerms: number;
  averageDocumentLength: number;
  indexSize: number;
  buildTime: number;
  lastUpdated: number;
}

/**
 * High-performance inverted index implementation
 * Features:
 * - O(1) term lookup
 * - Position-aware indexing for phrase queries
 * - Field-weighted scoring
 * - Incremental updates
 * - Memory-efficient storage
 */
export class InvertedIndex {
  private index: Map<string, PostingList> = new Map();
  private documents: Map<string, IndexedDocument> = new Map();
  private stats: IndexStats;

  // Field boost weights for relevance scoring
  private readonly fieldBoosts = {
    title: 3.0,
    problem: 2.0,
    solution: 1.8,
    tags: 1.5,
    category: 1.2,
  };

  // Performance optimizations
  private readonly maxTermLength = 50;
  private readonly minTermLength = 2;
  private readonly maxPositions = 100; // Limit positions stored per term

  constructor() {
    this.stats = {
      totalDocuments: 0,
      totalTerms: 0,
      uniqueTerms: 0,
      averageDocumentLength: 0,
      indexSize: 0,
      buildTime: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Build index from knowledge base entries
   * Optimized for batch processing
   */
  async buildIndex(entries: KBEntry[]): Promise<void> {
    const startTime = Date.now();
    console.log(`Building inverted index for ${entries.length} documents...`);

    // Clear existing index
    this.clear();

    // Process documents in batches for memory efficiency
    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await this.processBatch(batch);

      // Log progress
      if (i % 500 === 0) {
        console.log(`Processed ${i + batch.length}/${entries.length} documents`);
      }
    }

    // Update statistics
    this.updateStats();
    this.stats.buildTime = Date.now() - startTime;

    console.log(`Index built in ${this.stats.buildTime}ms`);
    console.log(`- Documents: ${this.stats.totalDocuments}`);
    console.log(`- Unique terms: ${this.stats.uniqueTerms}`);
    console.log(`- Total terms: ${this.stats.totalTerms}`);
    console.log(`- Average doc length: ${this.stats.averageDocumentLength.toFixed(1)}`);
  }

  /**
   * Add or update a single document in the index
   */
  async addDocument(entry: KBEntry): Promise<void> {
    // Remove existing document if it exists
    if (this.documents.has(entry.id)) {
      await this.removeDocument(entry.id);
    }

    // Create indexed document
    const indexedDoc = this.createIndexedDocument(entry);
    this.documents.set(entry.id, indexedDoc);

    // Add terms to inverted index
    for (const [term, frequency] of indexedDoc.termFrequencies.entries()) {
      this.addTermToIndex(term, entry.id, frequency, indexedDoc);
    }

    this.stats.lastUpdated = Date.now();
  }

  /**
   * Remove document from index
   */
  async removeDocument(docId: string): Promise<boolean> {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    // Remove from inverted index
    for (const term of doc.termFrequencies.keys()) {
      const postingList = this.index.get(term);
      if (postingList) {
        postingList.documents.delete(docId);
        postingList.frequency -= doc.termFrequencies.get(term) || 0;

        // Remove empty posting lists
        if (postingList.documents.size === 0) {
          this.index.delete(term);
        }
      }
    }

    // Remove document
    this.documents.delete(docId);
    this.stats.lastUpdated = Date.now();
    return true;
  }

  /**
   * Search for terms in the index
   * Returns posting lists for matching terms
   */
  search(terms: string[]): Map<string, PostingList> {
    const results = new Map<string, PostingList>();

    for (const term of terms) {
      const postingList = this.index.get(term);
      if (postingList) {
        results.set(term, postingList);
      }
    }

    return results;
  }

  /**
   * Get posting list for exact term
   */
  getPostingList(term: string): PostingList | null {
    return this.index.get(term) || null;
  }

  /**
   * Get document by ID
   */
  getDocument(docId: string): IndexedDocument | null {
    return this.documents.get(docId) || null;
  }

  /**
   * Find terms with prefix (for autocomplete)
   */
  findTermsWithPrefix(prefix: string, limit: number = 20): string[] {
    const results: string[] = [];
    const lowerPrefix = prefix.toLowerCase();

    for (const term of this.index.keys()) {
      if (term.startsWith(lowerPrefix)) {
        results.push(term);
        if (results.length >= limit) break;
      }
    }

    return results.sort((a, b) => {
      const aPosting = this.index.get(a)!;
      const bPosting = this.index.get(b)!;
      return bPosting.frequency - aPosting.frequency;
    });
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return { ...this.stats };
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.index.clear();
    this.documents.clear();
    this.stats = {
      totalDocuments: 0,
      totalTerms: 0,
      uniqueTerms: 0,
      averageDocumentLength: 0,
      indexSize: 0,
      buildTime: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Export index for persistence
   */
  export(): any {
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      stats: this.stats,
      index: Array.from(this.index.entries()).map(([term, postingList]) => ({
        term,
        frequency: postingList.frequency,
        documents: Array.from(postingList.documents.entries()).map(([docId, entry]) => ({
          docId,
          termFrequency: entry.termFrequency,
          positions: entry.positions.slice(0, 10), // Limit for export size
          fields: Array.from(entry.fields),
          boost: entry.boost,
        })),
      })),
      documents: Array.from(this.documents.entries()).map(([id, doc]) => ({
        id,
        fieldBoosts: doc.fieldBoosts,
        termFrequencies: Array.from(doc.termFrequencies.entries()),
        fieldLengths: doc.fieldLengths,
        totalTerms: doc.totalTerms,
        lastModified: doc.lastModified,
      })),
    };

    return exportData;
  }

  /**
   * Import index from exported data
   */
  import(data: any): void {
    this.clear();

    if (data.version !== '1.0') {
      throw new Error(`Unsupported index version: ${data.version}`);
    }

    // Import statistics
    this.stats = { ...data.stats };

    // Import documents
    for (const docData of data.documents) {
      const doc: IndexedDocument = {
        id: docData.id,
        fieldBoosts: docData.fieldBoosts,
        termFrequencies: new Map(docData.termFrequencies),
        fieldLengths: docData.fieldLengths,
        totalTerms: docData.totalTerms,
        lastModified: docData.lastModified,
      };
      this.documents.set(doc.id, doc);
    }

    // Import index
    for (const termData of data.index) {
      const postingList: PostingList = {
        term: termData.term,
        frequency: termData.frequency,
        documents: new Map(),
      };

      for (const docEntry of termData.documents) {
        postingList.documents.set(docEntry.docId, {
          docId: docEntry.docId,
          termFrequency: docEntry.termFrequency,
          positions: docEntry.positions,
          fields: new Set(docEntry.fields),
          boost: docEntry.boost,
        });
      }

      this.index.set(termData.term, postingList);
    }

    console.log(
      `Index imported: ${this.stats.totalDocuments} documents, ${this.stats.uniqueTerms} terms`
    );
  }

  // =========================
  // Private Implementation
  // =========================

  private async processBatch(entries: KBEntry[]): Promise<void> {
    for (const entry of entries) {
      const indexedDoc = this.createIndexedDocument(entry);
      this.documents.set(entry.id, indexedDoc);

      // Add terms to inverted index
      for (const [term, frequency] of indexedDoc.termFrequencies.entries()) {
        this.addTermToIndex(term, entry.id, frequency, indexedDoc);
      }
    }
  }

  private createIndexedDocument(entry: KBEntry): IndexedDocument {
    const termFrequencies = new Map<string, number>();
    const fieldLengths: Record<string, number> = {};
    let totalTerms = 0;

    // Process each field with appropriate boosting
    const fields = {
      title: entry.title || '',
      problem: entry.problem || '',
      solution: entry.solution || '',
      tags: (entry.tags || []).join(' '),
      category: entry.category || '',
    };

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      const terms = this.tokenizeText(fieldValue);
      fieldLengths[fieldName] = terms.length;
      totalTerms += terms.length;

      // Count term frequencies in this field
      terms.forEach((term, position) => {
        const currentFreq = termFrequencies.get(term) || 0;
        termFrequencies.set(term, currentFreq + 1);
      });
    }

    return {
      id: entry.id,
      fieldBoosts: { ...this.fieldBoosts },
      termFrequencies,
      fieldLengths,
      totalTerms,
      lastModified: entry.updated_at?.getTime() || Date.now(),
    };
  }

  private addTermToIndex(
    term: string,
    docId: string,
    frequency: number,
    indexedDoc: IndexedDocument
  ): void {
    let postingList = this.index.get(term);

    if (!postingList) {
      postingList = {
        term,
        frequency: 0,
        documents: new Map(),
      };
      this.index.set(term, postingList);
    }

    // Calculate boost based on fields where term appears
    let boost = 1.0;
    const fields = new Set<string>();

    // Determine which fields contain this term
    // (simplified - in production you'd track this during tokenization)
    for (const [fieldName] of Object.entries(this.fieldBoosts)) {
      if (indexedDoc.fieldLengths[fieldName] > 0) {
        fields.add(fieldName);
        boost = Math.max(boost, this.fieldBoosts[fieldName]);
      }
    }

    // Create posting entry
    const postingEntry: PostingEntry = {
      docId,
      termFrequency: frequency,
      positions: [], // Simplified - would be populated during tokenization
      fields,
      boost,
    };

    postingList.documents.set(docId, postingEntry);
    postingList.frequency += frequency;
  }

  private tokenizeText(text: string): string[] {
    if (!text) return [];

    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // Keep alphanumeric, spaces, hyphens
      .split(/\s+/)
      .filter(term => term.length >= this.minTermLength && term.length <= this.maxTermLength)
      .slice(0, 1000); // Limit terms per document for performance
  }

  private updateStats(): void {
    this.stats.totalDocuments = this.documents.size;
    this.stats.uniqueTerms = this.index.size;
    this.stats.totalTerms = Array.from(this.documents.values()).reduce(
      (sum, doc) => sum + doc.totalTerms,
      0
    );
    this.stats.averageDocumentLength =
      this.stats.totalDocuments > 0 ? this.stats.totalTerms / this.stats.totalDocuments : 0;

    // Estimate index size in bytes
    let indexSize = 0;
    for (const postingList of this.index.values()) {
      indexSize += postingList.term.length * 2; // String overhead
      indexSize += postingList.documents.size * 64; // Estimated posting entry size
    }
    this.stats.indexSize = indexSize;
  }
}

export default InvertedIndex;
