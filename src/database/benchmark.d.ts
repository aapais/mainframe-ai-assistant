#!/usr/bin/env node
declare class DatabaseBenchmark {
  private dbPath;
  private db;
  private testDataSize;
  private results;
  constructor(dbPath?: string, testDataSize?: number);
  initialize(): Promise<void>;
  runAllBenchmarks(): Promise<void>;
  private runInsertBenchmarks;
  private runSearchBenchmarks;
  private runUpdateBenchmarks;
  private runConcurrencyBenchmarks;
  private runScalabilityBenchmarks;
  private benchmarkOperation;
  private seedSearchTestData;
  private generateReport;
  private saveDetailedReport;
}
export { DatabaseBenchmark };
//# sourceMappingURL=benchmark.d.ts.map
