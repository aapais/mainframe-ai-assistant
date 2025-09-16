import { QuerySuggestion, MLModel, TrainingData, ModelEvaluation } from '../../types/ml';

interface QueryPattern {
  pattern: string;
  frequency: number;
  success_rate: number;
  context: string[];
}

interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  frequency: number;
  suggestions: QuerySuggestion[];
}

export class QuerySuggestionEngine {
  private model: MLModel | null = null;
  private trie: TrieNode;
  private ngramModel: Map<string, Map<string, number>>;
  private queryEmbeddings: Map<string, number[]>;
  private popularQueries: QueryPattern[];
  private userContexts: Map<string, string[]>;

  constructor(private config: any = {}) {
    this.trie = this.createTrieNode();
    this.ngramModel = new Map();
    this.queryEmbeddings = new Map();
    this.popularQueries = [];
    this.userContexts = new Map();
  }

  private createTrieNode(): TrieNode {
    return {
      children: new Map(),
      isEndOfWord: false,
      frequency: 0,
      suggestions: []
    };
  }

  async train(trainingData: TrainingData): Promise<ModelEvaluation> {
    console.log('Training query suggestion model...');

    // Build trie from query data
    this.buildTrie(trainingData);

    // Train n-gram model
    this.trainNgramModel(trainingData);

    // Generate embeddings for semantic similarity
    await this.generateQueryEmbeddings(trainingData);

    // Extract popular query patterns
    this.extractQueryPatterns(trainingData);

    // Create and train neural model for complex suggestions
    this.model = await this.trainNeuralModel(trainingData);

    return this.evaluateModel(trainingData);
  }

  private buildTrie(data: TrainingData): void {
    const queries = data.features as unknown as string[];

    queries.forEach(query => {
      this.insertIntoTrie(query.toLowerCase());
    });
  }

  private insertIntoTrie(query: string): void {
    let current = this.trie;

    for (const char of query) {
      if (!current.children.has(char)) {
        current.children.set(char, this.createTrieNode());
      }
      current = current.children.get(char)!;
      current.frequency++;
    }

    current.isEndOfWord = true;
  }

  private trainNgramModel(data: TrainingData): void {
    const queries = data.features as unknown as string[];

    queries.forEach(query => {
      const words = query.toLowerCase().split(' ');

      for (let i = 0; i < words.length - 1; i++) {
        const currentWord = words[i];
        const nextWord = words[i + 1];

        if (!this.ngramModel.has(currentWord)) {
          this.ngramModel.set(currentWord, new Map());
        }

        const nextWords = this.ngramModel.get(currentWord)!;
        nextWords.set(nextWord, (nextWords.get(nextWord) || 0) + 1);
      }
    });
  }

  private async generateQueryEmbeddings(data: TrainingData): Promise<void> {
    // Simplified embedding generation (in real implementation, use pre-trained models)
    const queries = data.features as unknown as string[];

    queries.forEach(query => {
      const embedding = this.generateSimpleEmbedding(query);
      this.queryEmbeddings.set(query, embedding);
    });
  }

  private generateSimpleEmbedding(text: string): number[] {
    // Simplified TF-IDF style embedding
    const words = text.toLowerCase().split(' ');
    const embedding = new Array(100).fill(0);

    words.forEach((word, idx) => {
      const hash = this.simpleHash(word) % 100;
      embedding[hash] += 1 / Math.sqrt(words.length);
    });

    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private extractQueryPatterns(data: TrainingData): void {
    const queries = data.features as unknown as string[];
    const patterns = new Map<string, QueryPattern>();

    queries.forEach(query => {
      // Extract patterns (simplified - in real implementation, use more sophisticated NLP)
      const words = query.toLowerCase().split(' ');
      const pattern = words.length > 2 ? `${words[0]} * ${words[words.length - 1]}` : query;

      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          pattern,
          frequency: 0,
          success_rate: 0.8, // Mock success rate
          context: words
        });
      }

      patterns.get(pattern)!.frequency++;
    });

    this.popularQueries = Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100);
  }

  private async trainNeuralModel(data: TrainingData): Promise<MLModel> {
    // Simplified neural model (in real implementation, use TensorFlow.js or similar)
    return {
      id: `query_suggestion_${Date.now()}`,
      type: 'neural',
      version: '1.0.0',
      accuracy: 0.85,
      trainedAt: new Date(),
      features: ['query_text', 'user_context', 'query_length', 'word_frequency'],
      hyperparameters: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        hiddenLayers: [128, 64, 32]
      }
    };
  }

  private evaluateModel(data: TrainingData): ModelEvaluation {
    // Mock evaluation metrics
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      f1Score: 0.85,
      featureImportance: {
        'query_prefix': 0.35,
        'user_context': 0.25,
        'popularity': 0.20,
        'semantic_similarity': 0.20
      }
    };
  }

  async getSuggestions(
    partialQuery: string,
    userId?: string,
    maxSuggestions: number = 5
  ): Promise<QuerySuggestion[]> {
    const suggestions: QuerySuggestion[] = [];

    // Get trie-based suggestions
    const trieSuggestions = this.getTrieSuggestions(partialQuery, maxSuggestions);
    suggestions.push(...trieSuggestions);

    // Get n-gram based suggestions
    const ngramSuggestions = this.getNgramSuggestions(partialQuery, maxSuggestions);
    suggestions.push(...ngramSuggestions);

    // Get semantic similarity suggestions
    const semanticSuggestions = await this.getSemanticSuggestions(partialQuery, maxSuggestions);
    suggestions.push(...semanticSuggestions);

    // Get personalized suggestions if user context available
    if (userId) {
      const personalizedSuggestions = this.getPersonalizedSuggestions(partialQuery, userId, maxSuggestions);
      suggestions.push(...personalizedSuggestions);
    }

    // Deduplicate and rank suggestions
    return this.rankAndDeduplicate(suggestions, maxSuggestions);
  }

  private getTrieSuggestions(partialQuery: string, maxSuggestions: number): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    let current = this.trie;

    // Navigate to the prefix
    for (const char of partialQuery.toLowerCase()) {
      if (!current.children.has(char)) {
        return suggestions;
      }
      current = current.children.get(char)!;
    }

    // DFS to find completions
    this.dfsCompletions(current, partialQuery, suggestions, maxSuggestions);

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private dfsCompletions(
    node: TrieNode,
    currentQuery: string,
    suggestions: QuerySuggestion[],
    maxSuggestions: number,
    depth: number = 0
  ): void {
    if (suggestions.length >= maxSuggestions || depth > 20) return;

    if (node.isEndOfWord && currentQuery.length > 0) {
      suggestions.push({
        query: currentQuery,
        confidence: Math.min(0.9, node.frequency / 100),
        source: 'historical',
        metadata: { frequency: node.frequency, type: 'completion' }
      });
    }

    for (const [char, childNode] of node.children) {
      this.dfsCompletions(childNode, currentQuery + char, suggestions, maxSuggestions, depth + 1);
    }
  }

  private getNgramSuggestions(partialQuery: string, maxSuggestions: number): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    const words = partialQuery.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];

    if (words.length > 1 && this.ngramModel.has(words[words.length - 2])) {
      const nextWords = this.ngramModel.get(words[words.length - 2])!;

      Array.from(nextWords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxSuggestions)
        .forEach(([word, frequency]) => {
          if (word.startsWith(lastWord)) {
            const suggestion = words.slice(0, -1).concat(word).join(' ');
            suggestions.push({
              query: suggestion,
              confidence: Math.min(0.8, frequency / 50),
              source: 'ml',
              metadata: { type: 'ngram', frequency }
            });
          }
        });
    }

    return suggestions;
  }

  private async getSemanticSuggestions(partialQuery: string, maxSuggestions: number): Promise<QuerySuggestion[]> {
    const suggestions: QuerySuggestion[] = [];
    const queryEmbedding = this.generateSimpleEmbedding(partialQuery);

    // Find similar queries using cosine similarity
    const similarities: Array<{ query: string; similarity: number }> = [];

    for (const [query, embedding] of this.queryEmbeddings) {
      if (query.startsWith(partialQuery.toLowerCase())) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      if (similarity > 0.7) {
        similarities.push({ query, similarity });
      }
    }

    similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSuggestions)
      .forEach(({ query, similarity }) => {
        suggestions.push({
          query,
          confidence: similarity * 0.9,
          source: 'ml',
          metadata: { type: 'semantic', similarity }
        });
      });

    return suggestions;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private getPersonalizedSuggestions(partialQuery: string, userId: string, maxSuggestions: number): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    const userContext = this.userContexts.get(userId) || [];

    // Find suggestions based on user's search history
    userContext
      .filter(query => query.includes(partialQuery.toLowerCase()))
      .slice(0, maxSuggestions)
      .forEach(query => {
        suggestions.push({
          query,
          confidence: 0.75,
          source: 'ml',
          metadata: { type: 'personalized', userId }
        });
      });

    return suggestions;
  }

  private rankAndDeduplicate(suggestions: QuerySuggestion[], maxSuggestions: number): QuerySuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = new Map<string, QuerySuggestion>();

    suggestions.forEach(suggestion => {
      const existing = uniqueSuggestions.get(suggestion.query);
      if (!existing || existing.confidence < suggestion.confidence) {
        uniqueSuggestions.set(suggestion.query, suggestion);
      }
    });

    // Sort by confidence and return top suggestions
    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }

  async updateUserContext(userId: string, query: string, clicked: boolean = false): Promise<void> {
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, []);
    }

    const context = this.userContexts.get(userId)!;

    // Add query to user context (with weight based on interaction)
    const weight = clicked ? 2 : 1;
    for (let i = 0; i < weight; i++) {
      context.push(query.toLowerCase());
    }

    // Keep only recent context (last 100 queries)
    if (context.length > 100) {
      context.splice(0, context.length - 100);
    }
  }

  getModelInfo(): MLModel | null {
    return this.model;
  }

  async saveModel(path: string): Promise<void> {
    const modelData = {
      model: this.model,
      trie: this.serializeTrie(),
      ngramModel: Array.from(this.ngramModel.entries()),
      queryEmbeddings: Array.from(this.queryEmbeddings.entries()),
      popularQueries: this.popularQueries,
      userContexts: Array.from(this.userContexts.entries())
    };

    // In real implementation, save to file system or database
    console.log(`Model saved to ${path}`, modelData);
  }

  private serializeTrie(): any {
    // Simplified serialization (in real implementation, use proper serialization)
    return { serialized: true, nodeCount: this.countTrieNodes(this.trie) };
  }

  private countTrieNodes(node: TrieNode): number {
    let count = 1;
    for (const child of node.children.values()) {
      count += this.countTrieNodes(child);
    }
    return count;
  }

  async loadModel(path: string): Promise<void> {
    // In real implementation, load from file system or database
    console.log(`Loading model from ${path}`);
    // Mock loading...
  }
}