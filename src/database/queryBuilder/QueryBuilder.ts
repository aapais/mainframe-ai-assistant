import Database from 'better-sqlite3';
import { InputSanitizer } from '../validators/DataValidator';

/**
 * Query execution options
 */
export interface QueryOptions {
  /** Cache query results */
  cache?: boolean;
  /** Cache key override */
  cacheKey?: string;
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable query logging */
  logQuery?: boolean;
}

/**
 * Query result with metadata
 */
export interface QueryExecutionResult<T = any> {
  data: T;
  executionTime: number;
  fromCache: boolean;
  queryHash: string;
  affectedRows?: number;
}

/**
 * Join configuration
 */
export interface JoinConfig {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  on: string;
  alias?: string;
}

/**
 * Where condition
 */
export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
  values?: any[];
}

/**
 * Order by configuration
 */
export interface OrderByConfig {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Group by configuration
 */
export interface GroupByConfig {
  fields: string[];
  having?: string;
}

/**
 * Type-safe SQL Query Builder
 * 
 * Provides a fluent interface for building SQL queries with automatic
 * parameter binding, SQL injection protection, and performance optimization.
 * 
 * @example
 * ```typescript
 * const qb = new QueryBuilder(db);
 * 
 * // Simple select
 * const results = await qb
 *   .select(['id', 'title', 'category'])
 *   .from('kb_entries')
 *   .where('category', '=', 'VSAM')
 *   .orderBy('created_at', 'DESC')
 *   .limit(10)
 *   .execute();
 * 
 * // Complex query with joins
 * const joined = await qb
 *   .select(['e.title', 't.tag'])
 *   .from('kb_entries', 'e')
 *   .join('INNER', 'kb_tags', 't', 'e.id = t.entry_id')
 *   .where('e.usage_count', '>', 5)
 *   .execute();
 * 
 * // Insert with validation
 * const insertResult = await qb
 *   .insert('kb_entries')
 *   .values({
 *     id: 'uuid',
 *     title: 'Test Entry',
 *     problem: 'Test problem...',
 *     solution: 'Test solution...'
 *   })
 *   .execute();
 * ```
 */
export class QueryBuilder {
  private db: Database.Database;
  private queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  private selectFields: string[] = [];
  private fromTable: string = '';
  private tableAlias: string = '';
  private joins: JoinConfig[] = [];
  private whereConditions: WhereCondition[] = [];
  private groupByConfig?: GroupByConfig;
  private orderByConfigs: OrderByConfig[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private insertData: Record<string, any> = {};
  private updateData: Record<string, any> = {};
  private insertTable: string = '';
  private updateTable: string = '';
  private parameters: any[] = [];
  private queryCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 300000; // 5 minutes

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Start a SELECT query
   */
  select(fields: string[] | string = ['*']): this {
    this.reset();
    this.queryType = 'SELECT';
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Specify the table to select from
   */
  from(table: string, alias?: string): this {
    this.fromTable = InputSanitizer.sanitizeSqlIdentifier(table);
    if (alias) {
      this.tableAlias = InputSanitizer.sanitizeSqlIdentifier(alias);
    }
    return this;
  }

  /**
   * Add a JOIN clause
   */
  join(type: JoinConfig['type'], table: string, alias: string, condition: string): this {
    this.joins.push({
      type,
      table: InputSanitizer.sanitizeSqlIdentifier(table),
      alias: InputSanitizer.sanitizeSqlIdentifier(alias),
      on: condition // Note: condition should be pre-validated
    });
    return this;
  }

  /**
   * Add INNER JOIN
   */
  innerJoin(table: string, alias: string, condition: string): this {
    return this.join('INNER', table, alias, condition);
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin(table: string, alias: string, condition: string): this {
    return this.join('LEFT', table, alias, condition);
  }

  /**
   * Add WHERE condition
   */
  where(field: string, operator: WhereCondition['operator'], value?: any): this {
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      this.whereConditions.push({ field, operator });
    } else if (operator === 'IN' || operator === 'NOT IN') {
      if (!Array.isArray(value)) {
        throw new Error('IN/NOT IN operators require array values');
      }
      this.whereConditions.push({ field, operator, values: value });
    } else {
      this.whereConditions.push({ field, operator, value });
    }
    return this;
  }

  /**
   * Add WHERE condition with AND logic
   */
  andWhere(field: string, operator: WhereCondition['operator'], value?: any): this {
    return this.where(field, operator, value);
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(field: string, values: any[]): this {
    return this.where(field, 'IN', values);
  }

  /**
   * Add WHERE NOT IN condition
   */
  whereNotIn(field: string, values: any[]): this {
    return this.where(field, 'NOT IN', values);
  }

  /**
   * Add WHERE LIKE condition
   */
  whereLike(field: string, pattern: string): this {
    return this.where(field, 'LIKE', pattern);
  }

  /**
   * Add WHERE IS NULL condition
   */
  whereNull(field: string): this {
    return this.where(field, 'IS NULL');
  }

  /**
   * Add WHERE IS NOT NULL condition
   */
  whereNotNull(field: string): this {
    return this.where(field, 'IS NOT NULL');
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByConfigs.push({ field, direction });
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(fields: string[], having?: string): this {
    this.groupByConfig = { fields, having };
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    if (count < 0) throw new Error('LIMIT must be non-negative');
    this.limitValue = count;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): this {
    if (count < 0) throw new Error('OFFSET must be non-negative');
    this.offsetValue = count;
    return this;
  }

  /**
   * Start an INSERT query
   */
  insert(table: string): this {
    this.reset();
    this.queryType = 'INSERT';
    this.insertTable = InputSanitizer.sanitizeSqlIdentifier(table);
    return this;
  }

  /**
   * Specify values to insert
   */
  values(data: Record<string, any>): this {
    this.insertData = { ...data };
    return this;
  }

  /**
   * Start an UPDATE query
   */
  update(table: string): this {
    this.reset();
    this.queryType = 'UPDATE';
    this.updateTable = InputSanitizer.sanitizeSqlIdentifier(table);
    return this;
  }

  /**
   * Specify data to update
   */
  set(data: Record<string, any>): this {
    this.updateData = { ...data };
    return this;
  }

  /**
   * Start a DELETE query
   */
  delete(): this {
    this.reset();
    this.queryType = 'DELETE';
    return this;
  }

  /**
   * Execute the query
   */
  async execute<T = any>(options: QueryOptions = {}): Promise<QueryExecutionResult<T>> {
    const startTime = Date.now();
    const queryInfo = this.buildQuery();
    const queryHash = this.generateQueryHash(queryInfo.sql, queryInfo.params);

    // Check cache for SELECT queries
    if (this.queryType === 'SELECT' && (options.cache ?? true)) {
      const cached = this.getFromCache(queryHash);
      if (cached) {
        return {
          data: cached,
          executionTime: Date.now() - startTime,
          fromCache: true,
          queryHash
        };
      }
    }

    // Log query if requested
    if (options.logQuery) {
      console.log('Executing query:', queryInfo.sql);
      console.log('Parameters:', queryInfo.params);
    }

    try {
      // Prepare statement
      const stmt = this.db.prepare(queryInfo.sql);
      
      let result: any;
      let affectedRows: number | undefined;

      // Execute based on query type
      switch (this.queryType) {
        case 'SELECT':
          result = stmt.all(...queryInfo.params) as T;
          break;
          
        case 'INSERT':
        case 'UPDATE':
        case 'DELETE':
          const info = stmt.run(...queryInfo.params);
          result = {
            lastInsertRowid: info.lastInsertRowid,
            changes: info.changes
          };
          affectedRows = info.changes;
          break;
      }

      const executionTime = Date.now() - startTime;

      // Cache SELECT results
      if (this.queryType === 'SELECT' && (options.cache ?? true)) {
        this.setCache(queryHash, result);
      }

      return {
        data: result,
        executionTime,
        fromCache: false,
        queryHash,
        affectedRows
      };

    } catch (error) {
      console.error('Query execution failed:', error);
      console.error('SQL:', queryInfo.sql);
      console.error('Params:', queryInfo.params);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Get the first result
   */
  async first<T = any>(options?: QueryOptions): Promise<T | null> {
    if (this.queryType !== 'SELECT') {
      throw new Error('first() can only be used with SELECT queries');
    }
    
    this.limit(1);
    const result = await this.execute<T[]>(options);
    return result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Get count of matching records
   */
  async count(field: string = '*'): Promise<number> {
    if (this.queryType !== 'SELECT') {
      throw new Error('count() can only be used with SELECT queries');
    }
    
    // Modify query to use COUNT
    this.selectFields = [`COUNT(${field}) as count`];
    
    const result = await this.execute<Array<{ count: number }>>();
    return result.data[0].count;
  }

  /**
   * Check if any records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Build the SQL query and parameters
   */
  private buildQuery(): { sql: string; params: any[] } {
    this.parameters = [];
    
    switch (this.queryType) {
      case 'SELECT':
        return this.buildSelectQuery();
      case 'INSERT':
        return this.buildInsertQuery();
      case 'UPDATE':
        return this.buildUpdateQuery();
      case 'DELETE':
        return this.buildDeleteQuery();
      default:
        throw new Error(`Unsupported query type: ${this.queryType}`);
    }
  }

  /**
   * Build SELECT query
   */
  private buildSelectQuery(): { sql: string; params: any[] } {
    let sql = 'SELECT ';
    
    // SELECT fields
    sql += this.selectFields.join(', ');
    
    // FROM clause
    sql += ` FROM ${this.fromTable}`;
    if (this.tableAlias) {
      sql += ` AS ${this.tableAlias}`;
    }
    
    // JOIN clauses
    for (const join of this.joins) {
      sql += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) {
        sql += ` AS ${join.alias}`;
      }
      sql += ` ON ${join.on}`;
    }
    
    // WHERE clauses
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      const whereClauses = this.whereConditions.map(condition => {
        return this.buildWhereCondition(condition);
      });
      sql += whereClauses.join(' AND ');
    }
    
    // GROUP BY clause
    if (this.groupByConfig) {
      sql += ` GROUP BY ${this.groupByConfig.fields.join(', ')}`;
      if (this.groupByConfig.having) {
        sql += ` HAVING ${this.groupByConfig.having}`;
      }
    }
    
    // ORDER BY clause
    if (this.orderByConfigs.length > 0) {
      sql += ' ORDER BY ';
      const orderClauses = this.orderByConfigs.map(order => {
        return `${order.field} ${order.direction}`;
      });
      sql += orderClauses.join(', ');
    }
    
    // LIMIT clause
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    
    // OFFSET clause
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    
    return { sql, params: this.parameters };
  }

  /**
   * Build INSERT query
   */
  private buildInsertQuery(): { sql: string; params: any[] } {
    const fields = Object.keys(this.insertData);
    const placeholders = fields.map(() => '?');
    this.parameters = Object.values(this.insertData);
    
    const sql = `INSERT INTO ${this.insertTable} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    
    return { sql, params: this.parameters };
  }

  /**
   * Build UPDATE query
   */
  private buildUpdateQuery(): { sql: string; params: any[] } {
    const fields = Object.keys(this.updateData);
    const setClauses = fields.map(field => `${field} = ?`);
    
    this.parameters = Object.values(this.updateData);
    
    let sql = `UPDATE ${this.updateTable} SET ${setClauses.join(', ')}`;
    
    // WHERE clauses
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      const whereClauses = this.whereConditions.map(condition => {
        return this.buildWhereCondition(condition);
      });
      sql += whereClauses.join(' AND ');
    }
    
    return { sql, params: this.parameters };
  }

  /**
   * Build DELETE query
   */
  private buildDeleteQuery(): { sql: string; params: any[] } {
    let sql = `DELETE FROM ${this.fromTable}`;
    
    // WHERE clauses
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      const whereClauses = this.whereConditions.map(condition => {
        return this.buildWhereCondition(condition);
      });
      sql += whereClauses.join(' AND ');
    }
    
    return { sql, params: this.parameters };
  }

  /**
   * Build WHERE condition
   */
  private buildWhereCondition(condition: WhereCondition): string {
    if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
      return `${condition.field} ${condition.operator}`;
    }
    
    if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
      const placeholders = condition.values!.map(() => '?');
      this.parameters.push(...condition.values!);
      return `${condition.field} ${condition.operator} (${placeholders.join(', ')})`;
    }
    
    this.parameters.push(condition.value);
    return `${condition.field} ${condition.operator} ?`;
  }

  /**
   * Generate query hash for caching
   */
  private generateQueryHash(sql: string, params: any[]): string {
    const content = sql + JSON.stringify(params);
    return Buffer.from(content).toString('base64');
  }

  /**
   * Get from cache
   */
  private getFromCache(hash: string): any | null {
    const cached = this.queryCache.get(hash);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      this.queryCache.delete(hash);
    }
    
    return null;
  }

  /**
   * Set cache
   */
  private setCache(hash: string, data: any): void {
    // Limit cache size
    if (this.queryCache.size >= 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(hash, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get current SQL query (for debugging)
   */
  toSQL(): { sql: string; params: any[] } {
    return this.buildQuery();
  }

  /**
   * Reset query builder state
   */
  private reset(): void {
    this.selectFields = [];
    this.fromTable = '';
    this.tableAlias = '';
    this.joins = [];
    this.whereConditions = [];
    this.groupByConfig = undefined;
    this.orderByConfigs = [];
    this.limitValue = undefined;
    this.offsetValue = undefined;
    this.insertData = {};
    this.updateData = {};
    this.insertTable = '';
    this.updateTable = '';
    this.parameters = [];
  }

  /**
   * Create a new QueryBuilder instance (for chaining)
   */
  static create(database: Database.Database): QueryBuilder {
    return new QueryBuilder(database);
  }
}

/**
 * Prepared Statement Manager
 * 
 * Manages prepared statements for frequently executed queries
 * to improve performance.
 */
export class PreparedStatementManager {
  private db: Database.Database;
  private statements = new Map<string, Database.Statement>();
  private usage = new Map<string, number>();

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Get or create a prepared statement
   */
  getStatement(key: string, sql: string): Database.Statement {
    if (!this.statements.has(key)) {
      const stmt = this.db.prepare(sql);
      this.statements.set(key, stmt);
      this.usage.set(key, 0);
    }

    const count = this.usage.get(key)! + 1;
    this.usage.set(key, count);

    return this.statements.get(key)!;
  }

  /**
   * Execute prepared statement
   */
  execute(key: string, sql: string, params: any[] = []): any {
    const stmt = this.getStatement(key, sql);
    return stmt.all(...params);
  }

  /**
   * Run prepared statement (for INSERT/UPDATE/DELETE)
   */
  run(key: string, sql: string, params: any[] = []): Database.RunResult {
    const stmt = this.getStatement(key, sql);
    return stmt.run(...params);
  }

  /**
   * Get first result from prepared statement
   */
  get(key: string, sql: string, params: any[] = []): any {
    const stmt = this.getStatement(key, sql);
    return stmt.get(...params);
  }

  /**
   * Clear unused statements
   */
  cleanup(minUsage: number = 5): void {
    for (const [key, usage] of this.usage) {
      if (usage < minUsage) {
        this.statements.delete(key);
        this.usage.delete(key);
      }
    }
  }

  /**
   * Get statement usage statistics
   */
  getStats(): Array<{ key: string; usage: number }> {
    return Array.from(this.usage.entries()).map(([key, usage]) => ({
      key,
      usage
    }));
  }

  /**
   * Clear all statements
   */
  clear(): void {
    this.statements.clear();
    this.usage.clear();
  }
}