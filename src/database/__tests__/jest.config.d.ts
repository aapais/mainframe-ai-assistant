export let preset: string;
export let testEnvironment: string;
export let displayName: string;
export let testMatch: string[];
export let setupFilesAfterEnv: string[];
export let testTimeout: number;
export let collectCoverageFrom: string[];
export let coverageDirectory: string;
export let coverageReporters: string[];
export namespace coverageThreshold {
  namespace global {
    let branches: number;
    let functions: number;
    let lines: number;
    let statements: number;
  }
}
export let maxWorkers: number;
export let forceExit: boolean;
export let detectOpenHandles: boolean;
export let verbose: boolean;
//# sourceMappingURL=jest.config.d.ts.map
