import { QuerySuggestion, MLModel, TrainingData, ModelEvaluation } from '../../types/ml';
export declare class QuerySuggestionEngine {
  private config;
  private model;
  private trie;
  private ngramModel;
  private queryEmbeddings;
  private popularQueries;
  private userContexts;
  constructor(config?: any);
  private createTrieNode;
  train(trainingData: TrainingData): Promise<ModelEvaluation>;
  private buildTrie;
  private insertIntoTrie;
  private trainNgramModel;
  private generateQueryEmbeddings;
  private generateSimpleEmbedding;
  private simpleHash;
  private extractQueryPatterns;
  private trainNeuralModel;
  private evaluateModel;
  getSuggestions(
    partialQuery: string,
    userId?: string,
    maxSuggestions?: number
  ): Promise<QuerySuggestion[]>;
  private getTrieSuggestions;
  private dfsCompletions;
  private getNgramSuggestions;
  private getSemanticSuggestions;
  private cosineSimilarity;
  private getPersonalizedSuggestions;
  private rankAndDeduplicate;
  updateUserContext(userId: string, query: string, clicked?: boolean): Promise<void>;
  getModelInfo(): MLModel | null;
  saveModel(path: string): Promise<void>;
  private serializeTrie;
  private countTrieNodes;
  loadModel(path: string): Promise<void>;
}
//# sourceMappingURL=QuerySuggestionEngine.d.ts.map
