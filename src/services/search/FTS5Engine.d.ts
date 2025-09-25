import Database from 'better-sqlite3';
import { KBEntry, SearchResult, SearchOptions } from '../../types';
export interface FTS5Config {
  bm25: {
    k1: number;
    b: number;
    titleWeight: number;
    problemWeight: number;
    solutionWeight: number;
    tagsWeight: number;
  };
  snippet: {
    maxLength: number;
    contextWindow: number;
    maxSnippets: number;
    ellipsis: string;
  };
  highlight: {
    startTag: string;
    endTag: string;
    caseSensitive: boolean;
  };
  performance: {
    mergeFrequency: number;
    crisisMerges: number;
    deleteSize: number;
    optimizeOnInit: boolean;
  };
}
export interface FTS5SearchResult extends SearchResult {
  bm25Score: number;
  snippets: Array<{
    field: string;
    text: string;
    score: number;
  }>;
  termMatches: Record<
    string,
    {
      frequency: number;
      positions: number[];
      field: string;
    }
  >;
}
export interface MainframeTokenizerConfig {
  jclTokens: string[];
  vsamTokens: string[];
  cobolTokens: string[];
  db2Tokens: string[];
  errorCodePatterns: RegExp[];
  datasetPatterns: RegExp[];
  systemCommandPatterns: RegExp[];
}
export declare class FTS5Engine {
  private db;
  private config;
  private tokenizerConfig;
  private initialized;
  private static readonly DEFAULT_CONFIG;
  private static readonly DEFAULT_TOKENIZER_CONFIG;
  constructor(
    db: Database.Database,
    config?: Partial<FTS5Config>,
    tokenizerConfig?: Partial<MainframeTokenizerConfig>
  );
  initialize(): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<FTS5SearchResult[]>;
  addDocument(entry: KBEntry): Promise<void>;
  updateDocument(entry: KBEntry): Promise<void>;
  removeDocument(id: string): Promise<void>;
  optimize(): Promise<void>;
  getStats(): {
    indexSize: number;
    documentCount: number;
    totalTokens: number;
    uniqueTokens: number;
    averageDocumentLength: number;
  };
  private createFTS5Table;
  private registerCustomFunctions;
  private configureFTS5Performance;
  private populateFTS5Index;
  private optimizeFTS5Index;
  private prepareFTS5Query;
  private executeFTS5Search;
  private enhanceResults;
  private generateSnippets;
  private generateSnippet;
  private highlightText;
  private extractTermMatches;
  private calculateCombinedScore;
  private logInitializationStats;
  private mergeConfig;
  private mergeTokenizerConfig;
  private ensureInitialized;
}
export default FTS5Engine;
//# sourceMappingURL=FTS5Engine.d.ts.map
