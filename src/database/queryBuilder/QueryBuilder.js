'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PreparedStatementManager = exports.QueryBuilder = void 0;
const DataValidator_1 = require('../validators/DataValidator');
class QueryBuilder {
  db;
  queryType;
  selectFields = [];
  fromTable = '';
  tableAlias = '';
  joins = [];
  whereConditions = [];
  groupByConfig;
  orderByConfigs = [];
  limitValue;
  offsetValue;
  insertData = {};
  updateData = {};
  insertTable = '';
  updateTable = '';
  parameters = [];
  queryCache = new Map();
  cacheTimeout = 300000;
  constructor(database) {
    this.db = database;
  }
  select(fields = ['*']) {
    this.reset();
    this.queryType = 'SELECT';
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }
  from(table, alias) {
    this.fromTable = DataValidator_1.InputSanitizer.sanitizeSqlIdentifier(table);
    if (alias) {
      this.tableAlias = DataValidator_1.InputSanitizer.sanitizeSqlIdentifier(alias);
    }
    return this;
  }
  join(type, table, alias, condition) {
    this.joins.push({
      type,
      table: DataValidator_1.InputSanitizer.sanitizeSqlIdentifier(table),
      alias: DataValidator_1.InputSanitizer.sanitizeSqlIdentifier(alias),
      on: condition,
    });
    return this;
  }
  innerJoin(table, alias, condition) {
    return this.join('INNER', table, alias, condition);
  }
  leftJoin(table, alias, condition) {
    return this.join('LEFT', table, alias, condition);
  }
  where(field, operator, value) {
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
  andWhere(field, operator, value) {
    return this.where(field, operator, value);
  }
  whereIn(field, values) {
    return this.where(field, 'IN', values);
  }
  whereNotIn(field, values) {
    return this.where(field, 'NOT IN', values);
  }
  whereLike(field, pattern) {
    return this.where(field, 'LIKE', pattern);
  }
  whereNull(field) {
    return this.where(field, 'IS NULL');
  }
  whereNotNull(field) {
    return this.where(field, 'IS NOT NULL');
  }
  orderBy(field, direction = 'ASC') {
    this.orderByConfigs.push({ field, direction });
    return this;
  }
  groupBy(fields, having) {
    this.groupByConfig = { fields, having };
    return this;
  }
  limit(count) {
    if (count < 0) throw new Error('LIMIT must be non-negative');
    this.limitValue = count;
    return this;
  }
  offset(count) {
    if (count < 0) throw new Error('OFFSET must be non-negative');
    this.offsetValue = count;
    return this;
  }
  insert(table) {
    this.reset();
    this.queryType = 'INSERT';
    this.insertTable = DataValidator_1.InputSanitizer.sanitizeSqlIdentifier(table);
    return this;
  }
  values(data) {
    this.insertData = { ...data };
    return this;
  }
  update(table) {
    this.reset();
    this.queryType = 'UPDATE';
    this.updateTable = DataValidator_1.InputSanitizer.sanitizeSqlIdentifier(table);
    return this;
  }
  set(data) {
    this.updateData = { ...data };
    return this;
  }
  delete() {
    this.reset();
    this.queryType = 'DELETE';
    return this;
  }
  async execute(options = {}) {
    const startTime = Date.now();
    const queryInfo = this.buildQuery();
    const queryHash = this.generateQueryHash(queryInfo.sql, queryInfo.params);
    if (this.queryType === 'SELECT' && (options.cache ?? true)) {
      const cached = this.getFromCache(queryHash);
      if (cached) {
        return {
          data: cached,
          executionTime: Date.now() - startTime,
          fromCache: true,
          queryHash,
        };
      }
    }
    if (options.logQuery) {
      console.log('Executing query:', queryInfo.sql);
      console.log('Parameters:', queryInfo.params);
    }
    try {
      const stmt = this.db.prepare(queryInfo.sql);
      let result;
      let affectedRows;
      switch (this.queryType) {
        case 'SELECT':
          result = stmt.all(...queryInfo.params);
          break;
        case 'INSERT':
        case 'UPDATE':
        case 'DELETE':
          const info = stmt.run(...queryInfo.params);
          result = {
            lastInsertRowid: info.lastInsertRowid,
            changes: info.changes,
          };
          affectedRows = info.changes;
          break;
      }
      const executionTime = Date.now() - startTime;
      if (this.queryType === 'SELECT' && (options.cache ?? true)) {
        this.setCache(queryHash, result);
      }
      return {
        data: result,
        executionTime,
        fromCache: false,
        queryHash,
        affectedRows,
      };
    } catch (error) {
      console.error('Query execution failed:', error);
      console.error('SQL:', queryInfo.sql);
      console.error('Params:', queryInfo.params);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }
  async first(options) {
    if (this.queryType !== 'SELECT') {
      throw new Error('first() can only be used with SELECT queries');
    }
    this.limit(1);
    const result = await this.execute(options);
    return result.data.length > 0 ? result.data[0] : null;
  }
  async count(field = '*') {
    if (this.queryType !== 'SELECT') {
      throw new Error('count() can only be used with SELECT queries');
    }
    this.selectFields = [`COUNT(${field}) as count`];
    const result = await this.execute();
    return result.data[0].count;
  }
  async exists() {
    const count = await this.count();
    return count > 0;
  }
  buildQuery() {
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
  buildSelectQuery() {
    let sql = 'SELECT ';
    sql += this.selectFields.join(', ');
    sql += ` FROM ${this.fromTable}`;
    if (this.tableAlias) {
      sql += ` AS ${this.tableAlias}`;
    }
    for (const join of this.joins) {
      sql += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) {
        sql += ` AS ${join.alias}`;
      }
      sql += ` ON ${join.on}`;
    }
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      const whereClauses = this.whereConditions.map(condition => {
        return this.buildWhereCondition(condition);
      });
      sql += whereClauses.join(' AND ');
    }
    if (this.groupByConfig) {
      sql += ` GROUP BY ${this.groupByConfig.fields.join(', ')}`;
      if (this.groupByConfig.having) {
        sql += ` HAVING ${this.groupByConfig.having}`;
      }
    }
    if (this.orderByConfigs.length > 0) {
      sql += ' ORDER BY ';
      const orderClauses = this.orderByConfigs.map(order => {
        return `${order.field} ${order.direction}`;
      });
      sql += orderClauses.join(', ');
    }
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    return { sql, params: this.parameters };
  }
  buildInsertQuery() {
    const fields = Object.keys(this.insertData);
    const placeholders = fields.map(() => '?');
    this.parameters = Object.values(this.insertData);
    const sql = `INSERT INTO ${this.insertTable} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    return { sql, params: this.parameters };
  }
  buildUpdateQuery() {
    const fields = Object.keys(this.updateData);
    const setClauses = fields.map(field => `${field} = ?`);
    this.parameters = Object.values(this.updateData);
    let sql = `UPDATE ${this.updateTable} SET ${setClauses.join(', ')}`;
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      const whereClauses = this.whereConditions.map(condition => {
        return this.buildWhereCondition(condition);
      });
      sql += whereClauses.join(' AND ');
    }
    return { sql, params: this.parameters };
  }
  buildDeleteQuery() {
    let sql = `DELETE FROM ${this.fromTable}`;
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      const whereClauses = this.whereConditions.map(condition => {
        return this.buildWhereCondition(condition);
      });
      sql += whereClauses.join(' AND ');
    }
    return { sql, params: this.parameters };
  }
  buildWhereCondition(condition) {
    if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
      return `${condition.field} ${condition.operator}`;
    }
    if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
      const placeholders = condition.values.map(() => '?');
      this.parameters.push(...condition.values);
      return `${condition.field} ${condition.operator} (${placeholders.join(', ')})`;
    }
    this.parameters.push(condition.value);
    return `${condition.field} ${condition.operator} ?`;
  }
  generateQueryHash(sql, params) {
    const content = sql + JSON.stringify(params);
    return Buffer.from(content).toString('base64');
  }
  getFromCache(hash) {
    const cached = this.queryCache.get(hash);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    if (cached) {
      this.queryCache.delete(hash);
    }
    return null;
  }
  setCache(hash, data) {
    if (this.queryCache.size >= 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    this.queryCache.set(hash, {
      data,
      timestamp: Date.now(),
    });
  }
  clearCache() {
    this.queryCache.clear();
  }
  toSQL() {
    return this.buildQuery();
  }
  reset() {
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
  static create(database) {
    return new QueryBuilder(database);
  }
}
exports.QueryBuilder = QueryBuilder;
class PreparedStatementManager {
  db;
  statements = new Map();
  usage = new Map();
  constructor(database) {
    this.db = database;
  }
  getStatement(key, sql) {
    if (!this.statements.has(key)) {
      const stmt = this.db.prepare(sql);
      this.statements.set(key, stmt);
      this.usage.set(key, 0);
    }
    const count = this.usage.get(key) + 1;
    this.usage.set(key, count);
    return this.statements.get(key);
  }
  execute(key, sql, params = []) {
    const stmt = this.getStatement(key, sql);
    return stmt.all(...params);
  }
  run(key, sql, params = []) {
    const stmt = this.getStatement(key, sql);
    return stmt.run(...params);
  }
  get(key, sql, params = []) {
    const stmt = this.getStatement(key, sql);
    return stmt.get(...params);
  }
  cleanup(minUsage = 5) {
    for (const [key, usage] of this.usage) {
      if (usage < minUsage) {
        this.statements.delete(key);
        this.usage.delete(key);
      }
    }
  }
  getStats() {
    return Array.from(this.usage.entries()).map(([key, usage]) => ({
      key,
      usage,
    }));
  }
  clear() {
    this.statements.clear();
    this.usage.clear();
  }
}
exports.PreparedStatementManager = PreparedStatementManager;
//# sourceMappingURL=QueryBuilder.js.map
