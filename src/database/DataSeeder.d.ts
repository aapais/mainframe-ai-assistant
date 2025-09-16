import { KnowledgeDB } from './KnowledgeDB';
export interface MainframeKBEntry {
    title: string;
    problem: string;
    solution: string;
    category: string;
    tags: string[];
    severity?: 'critical' | 'high' | 'medium' | 'low';
    estimatedSuccessRate?: number;
}
export declare class DataSeeder {
    private db;
    constructor(db: KnowledgeDB);
    seedMainframeKB(): Promise<{
        seeded: number;
        skipped: number;
        errors: number;
    }>;
    private getMainframeEntries;
    private findSimilarEntry;
    private calculateSimilarity;
    seedSystemConfig(): Promise<void>;
    seedSearchHistory(): Promise<void>;
    seedAll(): Promise<void>;
    needsSeeding(): Promise<boolean>;
}
//# sourceMappingURL=DataSeeder.d.ts.map