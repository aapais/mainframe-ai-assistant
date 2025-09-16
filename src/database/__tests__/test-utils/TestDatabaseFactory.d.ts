import Database from 'better-sqlite3';
import { DatabaseManager, DatabaseConfig } from '../../DatabaseManager';
import { KnowledgeDB, KBEntry } from '../../KnowledgeDB';
export declare class TestDatabaseFactory {
    private static createdDatabases;
    private static createdManagers;
    static createMemoryDatabase(): Database.Database;
    static createTempDatabase(name?: string): Database.Database;
    static createTestDatabaseManager(config?: Partial<DatabaseConfig>): Promise<DatabaseManager>;
    static createTestKnowledgeDB(dbPath?: string): KnowledgeDB;
    static createTestKBEntries(): KBEntry[];
    static seedKnowledgeDB(kb: KnowledgeDB, entries?: KBEntry[]): Promise<void>;
    static createLargeTestDataset(size: number): KBEntry[];
    static createCorruptedData(): any[];
    static wait(ms: number): Promise<void>;
    static measureExecutionTime<T>(fn: () => Promise<T> | T): Promise<{
        result: T;
        time: number;
    }>;
    static randomString(length?: number): string;
    static corruptDatabase(dbPath: string): Promise<void>;
    static cleanup(): Promise<void>;
}
//# sourceMappingURL=TestDatabaseFactory.d.ts.map