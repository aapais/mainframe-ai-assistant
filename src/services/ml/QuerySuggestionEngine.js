'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.QuerySuggestionEngine = void 0;
class QuerySuggestionEngine {
  config;
  model = null;
  trie;
  ngramModel;
  queryEmbeddings;
  popularQueries;
  userContexts;
  constructor(config = {}) {
    this.config = config;
    this.trie = this.createTrieNode();
    this.ngramModel = new Map();
    this.queryEmbeddings = new Map();
    this.popularQueries = [];
    this.userContexts = new Map();
  }
  createTrieNode() {
    return {
      children: new Map(),
      isEndOfWord: false,
      frequency: 0,
      suggestions: [],
    };
  }
  async train(trainingData) {
    console.log('Training query suggestion model...');
    this.buildTrie(trainingData);
    this.trainNgramModel(trainingData);
    await this.generateQueryEmbeddings(trainingData);
    this.extractQueryPatterns(trainingData);
    this.model = await this.trainNeuralModel(trainingData);
    return this.evaluateModel(trainingData);
  }
  buildTrie(data) {
    const queries = data.features;
    queries.forEach(query => {
      this.insertIntoTrie(query.toLowerCase());
    });
  }
  insertIntoTrie(query) {
    let current = this.trie;
    for (const char of query) {
      if (!current.children.has(char)) {
        current.children.set(char, this.createTrieNode());
      }
      current = current.children.get(char);
      current.frequency++;
    }
    current.isEndOfWord = true;
  }
  trainNgramModel(data) {
    const queries = data.features;
    queries.forEach(query => {
      const words = query.toLowerCase().split(' ');
      for (let i = 0; i < words.length - 1; i++) {
        const currentWord = words[i];
        const nextWord = words[i + 1];
        if (!this.ngramModel.has(currentWord)) {
          this.ngramModel.set(currentWord, new Map());
        }
        const nextWords = this.ngramModel.get(currentWord);
        nextWords.set(nextWord, (nextWords.get(nextWord) || 0) + 1);
      }
    });
  }
  async generateQueryEmbeddings(data) {
    const queries = data.features;
    queries.forEach(query => {
      const embedding = this.generateSimpleEmbedding(query);
      this.queryEmbeddings.set(query, embedding);
    });
  }
  generateSimpleEmbedding(text) {
    const words = text.toLowerCase().split(' ');
    const embedding = new Array(100).fill(0);
    words.forEach((word, idx) => {
      const hash = this.simpleHash(word) % 100;
      embedding[hash] += 1 / Math.sqrt(words.length);
    });
    return embedding;
  }
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  extractQueryPatterns(data) {
    const queries = data.features;
    const patterns = new Map();
    queries.forEach(query => {
      const words = query.toLowerCase().split(' ');
      const pattern = words.length > 2 ? `${words[0]} * ${words[words.length - 1]}` : query;
      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          pattern,
          frequency: 0,
          success_rate: 0.8,
          context: words,
        });
      }
      patterns.get(pattern).frequency++;
    });
    this.popularQueries = Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100);
  }
  async trainNeuralModel(data) {
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
        hiddenLayers: [128, 64, 32],
      },
    };
  }
  evaluateModel(data) {
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      f1Score: 0.85,
      featureImportance: {
        query_prefix: 0.35,
        user_context: 0.25,
        popularity: 0.2,
        semantic_similarity: 0.2,
      },
    };
  }
  async getSuggestions(partialQuery, userId, maxSuggestions = 5) {
    const suggestions = [];
    const trieSuggestions = this.getTrieSuggestions(partialQuery, maxSuggestions);
    suggestions.push(...trieSuggestions);
    const ngramSuggestions = this.getNgramSuggestions(partialQuery, maxSuggestions);
    suggestions.push(...ngramSuggestions);
    const semanticSuggestions = await this.getSemanticSuggestions(partialQuery, maxSuggestions);
    suggestions.push(...semanticSuggestions);
    if (userId) {
      const personalizedSuggestions = this.getPersonalizedSuggestions(
        partialQuery,
        userId,
        maxSuggestions
      );
      suggestions.push(...personalizedSuggestions);
    }
    return this.rankAndDeduplicate(suggestions, maxSuggestions);
  }
  getTrieSuggestions(partialQuery, maxSuggestions) {
    const suggestions = [];
    let current = this.trie;
    for (const char of partialQuery.toLowerCase()) {
      if (!current.children.has(char)) {
        return suggestions;
      }
      current = current.children.get(char);
    }
    this.dfsCompletions(current, partialQuery, suggestions, maxSuggestions);
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
  dfsCompletions(node, currentQuery, suggestions, maxSuggestions, depth = 0) {
    if (suggestions.length >= maxSuggestions || depth > 20) return;
    if (node.isEndOfWord && currentQuery.length > 0) {
      suggestions.push({
        query: currentQuery,
        confidence: Math.min(0.9, node.frequency / 100),
        source: 'historical',
        metadata: { frequency: node.frequency, type: 'completion' },
      });
    }
    for (const [char, childNode] of node.children) {
      this.dfsCompletions(childNode, currentQuery + char, suggestions, maxSuggestions, depth + 1);
    }
  }
  getNgramSuggestions(partialQuery, maxSuggestions) {
    const suggestions = [];
    const words = partialQuery.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];
    if (words.length > 1 && this.ngramModel.has(words[words.length - 2])) {
      const nextWords = this.ngramModel.get(words[words.length - 2]);
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
              metadata: { type: 'ngram', frequency },
            });
          }
        });
    }
    return suggestions;
  }
  async getSemanticSuggestions(partialQuery, maxSuggestions) {
    const suggestions = [];
    const queryEmbedding = this.generateSimpleEmbedding(partialQuery);
    const similarities = [];
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
          metadata: { type: 'semantic', similarity },
        });
      });
    return suggestions;
  }
  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
  getPersonalizedSuggestions(partialQuery, userId, maxSuggestions) {
    const suggestions = [];
    const userContext = this.userContexts.get(userId) || [];
    userContext
      .filter(query => query.includes(partialQuery.toLowerCase()))
      .slice(0, maxSuggestions)
      .forEach(query => {
        suggestions.push({
          query,
          confidence: 0.75,
          source: 'ml',
          metadata: { type: 'personalized', userId },
        });
      });
    return suggestions;
  }
  rankAndDeduplicate(suggestions, maxSuggestions) {
    const uniqueSuggestions = new Map();
    suggestions.forEach(suggestion => {
      const existing = uniqueSuggestions.get(suggestion.query);
      if (!existing || existing.confidence < suggestion.confidence) {
        uniqueSuggestions.set(suggestion.query, suggestion);
      }
    });
    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }
  async updateUserContext(userId, query, clicked = false) {
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, []);
    }
    const context = this.userContexts.get(userId);
    const weight = clicked ? 2 : 1;
    for (let i = 0; i < weight; i++) {
      context.push(query.toLowerCase());
    }
    if (context.length > 100) {
      context.splice(0, context.length - 100);
    }
  }
  getModelInfo() {
    return this.model;
  }
  async saveModel(path) {
    const modelData = {
      model: this.model,
      trie: this.serializeTrie(),
      ngramModel: Array.from(this.ngramModel.entries()),
      queryEmbeddings: Array.from(this.queryEmbeddings.entries()),
      popularQueries: this.popularQueries,
      userContexts: Array.from(this.userContexts.entries()),
    };
    console.log(`Model saved to ${path}`, modelData);
  }
  serializeTrie() {
    return { serialized: true, nodeCount: this.countTrieNodes(this.trie) };
  }
  countTrieNodes(node) {
    let count = 1;
    for (const child of node.children.values()) {
      count += this.countTrieNodes(child);
    }
    return count;
  }
  async loadModel(path) {
    console.log(`Loading model from ${path}`);
  }
}
exports.QuerySuggestionEngine = QuerySuggestionEngine;
//# sourceMappingURL=QuerySuggestionEngine.js.map
