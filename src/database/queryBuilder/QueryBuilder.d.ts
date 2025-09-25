import Database from 'better-sqlite3';
export interface QueryOptions {
  cache?: boolean;
  cacheKey?: string;
  timeout?: number;
  maxRetries?: number;
  logQuery?: boolean;
}
export interface QueryExecutionResult<T = any> {
  data: T;
  executionTime: number;
  fromCache: boolean;
  queryHash: string;
  affectedRows?: number;
}
export interface JoinConfig {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  on: string;
  alias?: string;
}
export interface WhereCondition {
  field: string;
  operator:
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'LIKE'
    | 'IN'
    | 'NOT IN'
    | 'IS NULL'
    | 'IS NOT NULL';
  value?: any;
  values?: any[];
}
export interface OrderByConfig {
  field: string;
  direction: 'ASC' | 'DESC';
}
export interface GroupByConfig {
  fields: string[];
  having?: string;
}
export declare class QueryBuilder {
  private db;
  private queryType;
  private selectFields;
  private fromTable;
  private tableAlias;
  private joins;
  private whereConditions;
  private groupByConfig?;
  private orderByConfigs;
  private limitValue?;
  private offsetValue?;
  private insertData;
  private updateData;
  private insertTable;
  private updateTable;
  private parameters;
  private queryCache;
  private cacheTimeout;
  constructor(database: Database.Database);
  select(fields?: string[] | string): this;
  from(table: string, alias?: string): this;
  join(type: JoinConfig['type'], table: string, alias: string, condition: string): this;
  innerJoin(table: string, alias: string, condition: string): this;
  leftJoin(table: string, alias: string, condition: string): this;
  where(field: string, operator: WhereCondition['operator'], value?: any): this;
  andWhere(field: string, operator: WhereCondition['operator'], value?: any): this;
  whereIn(field: string, values: any[]): this;
  whereNotIn(field: string, values: any[]): this;
  whereLike(field: string, pattern: string): this;
  whereNull(field: string): this;
  whereNotNull(field: string): this;
  orderBy(field: string, direction?: 'ASC' | 'DESC'): this;
  groupBy(fields: string[], having?: string): this;
  limit(count: number): this;
  offset(count: number): this;
  insert(table: string): this;
  values(data: Record<string, any>): this;
  update(table: string): this;
  set(data: Record<string, any>): this;
  delete(): this;
  execute<T = any>(options?: QueryOptions): Promise<QueryExecutionResult<T>>;
  first<T = any>(options?: QueryOptions): Promise<T | null>;
  count(field?: string): Promise<number>;
  exists(): Promise<boolean>;
  private buildQuery;
  private buildSelectQuery;
  private buildInsertQuery;
  private buildUpdateQuery;
  private buildDeleteQuery;
  private buildWhereCondition;
  private generateQueryHash;
  private getFromCache;
  private setCache;
  clearCache(): void;
  toSQL(): {
    sql: string;
    params: any[];
  };
  private reset;
  static create(database: Database.Database): QueryBuilder;
}
export declare class PreparedStatementManager {
  private db;
  private statements;
  private usage;
  constructor(database: Database.Database);
  getStatement(key: string, sql: string): Database.Statement;
  execute(key: string, sql: string, params?: any[]): any;
  run(key: string, sql: string, params?: any[]): Database.RunResult;
  get(key: string, sql: string, params?: any[]): any;
  cleanup(minUsage?: number): void;
  getStats(): Array<{
    key: string;
    usage: number;
  }>;
  clear(): void;
}
//# sourceMappingURL=QueryBuilder.d.ts.map
