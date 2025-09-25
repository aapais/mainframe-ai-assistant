'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.QueryParser = void 0;
const tslib_1 = require('tslib');
const TextProcessor_1 = tslib_1.__importDefault(require('./TextProcessor'));
class QueryParser {
  textProcessor;
  defaultOptions;
  tokens = [];
  position = 0;
  current = '';
  constructor(textProcessor) {
    this.textProcessor = textProcessor || new TextProcessor_1.default();
    this.defaultOptions = {
      fuzzyDistance: 2,
      phraseSlop: 0,
      minimumShouldMatch: 1,
      boost: {
        title: 3.0,
        problem: 2.0,
        solution: 1.8,
        tags: 1.5,
        category: 1.2,
      },
      defaultField: 'content',
      defaultOperator: 'OR',
    };
  }
  parse(queryString, options) {
    const opts = { ...this.defaultOptions, ...options };
    if (!queryString || queryString.trim().length === 0) {
      return this.createEmptyQuery(queryString, opts);
    }
    const normalized = this.normalizeQuery(queryString);
    this.tokens = this.tokenizeQuery(normalized);
    this.position = 0;
    this.current = this.tokens[0] || '';
    const terms = this.parseExpression();
    const filters = this.extractFilters(queryString);
    const queryType = this.determineQueryType(terms, queryString);
    return {
      type: queryType,
      terms,
      filters,
      options: opts,
      original: queryString,
      normalized,
    };
  }
  extractSearchTerms(parsedQuery) {
    const required = [];
    const optional = [];
    const prohibited = [];
    const phrases = [];
    for (const term of parsedQuery.terms) {
      if (term.operator === 'PHRASE') {
        phrases.push(term.text);
      } else if (term.prohibited) {
        prohibited.push(term.text);
      } else if (term.required || term.operator === 'AND') {
        required.push(term.text);
      } else {
        optional.push(term.text);
      }
    }
    return { required, optional, prohibited, phrases };
  }
  parseFieldQuery(queryString) {
    const fieldQueries = {};
    const fieldPattern = /(\w+):([^\s"]+|"[^"]*")/g;
    let match;
    while ((match = fieldPattern.exec(queryString)) !== null) {
      const field = match[1].toLowerCase();
      const value = match[2].replace(/"/g, '');
      if (!fieldQueries[field]) {
        fieldQueries[field] = [];
      }
      fieldQueries[field].push(value);
    }
    return fieldQueries;
  }
  validate(queryString) {
    const errors = [];
    const warnings = [];
    try {
      const quotes = (queryString.match(/"/g) || []).length;
      if (quotes % 2 !== 0) {
        errors.push('Unmatched quotation marks');
      }
      let parenLevel = 0;
      for (const char of queryString) {
        if (char === '(') parenLevel++;
        if (char === ')') parenLevel--;
        if (parenLevel < 0) {
          errors.push('Unmatched closing parenthesis');
          break;
        }
      }
      if (parenLevel > 0) {
        errors.push('Unmatched opening parenthesis');
      }
      if (queryString.trim().length === 0) {
        warnings.push('Empty query');
      }
      if (queryString.length > 1000) {
        warnings.push('Query is very long and may impact performance');
      }
      const invalidOperators = queryString.match(/\b(AND|OR|NOT)\s*$/gi);
      if (invalidOperators) {
        errors.push('Query ends with operator');
      }
      this.parse(queryString);
    } catch (error) {
      errors.push(`Parse error: ${error.message}`);
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  suggest(partialQuery, availableFields = []) {
    const suggestions = [];
    const fieldMatch = partialQuery.match(/(\w+):$/);
    if (fieldMatch && availableFields.includes(fieldMatch[1])) {
      suggestions.push(
        `${partialQuery}"exact phrase"`,
        `${partialQuery}value`,
        `${partialQuery}(value1 OR value2)`
      );
      return suggestions;
    }
    if (!partialQuery.includes('AND') && !partialQuery.includes('OR')) {
      suggestions.push(`${partialQuery} AND`, `${partialQuery} OR`);
    }
    if (!partialQuery.includes('"')) {
      suggestions.push(`"${partialQuery}"`);
    }
    for (const field of availableFields) {
      if (!partialQuery.includes(`${field}:`)) {
        suggestions.push(`${field}:${partialQuery}`);
      }
    }
    return suggestions.slice(0, 10);
  }
  parseExpression() {
    const terms = [];
    while (this.current && this.position < this.tokens.length) {
      const term = this.parseTerm();
      if (term) {
        terms.push(term);
      }
      this.advance();
    }
    return terms;
  }
  parseTerm() {
    if (!this.current) return null;
    if (this.isOperator(this.current)) {
      return this.parseOperatorTerm();
    }
    if (this.current.includes(':')) {
      return this.parseFieldTerm();
    }
    if (this.current.startsWith('"') && this.current.endsWith('"')) {
      return this.parsePhraseTerm();
    }
    if (this.current.includes('~')) {
      return this.parseFuzzyTerm();
    }
    if (this.current.includes('^')) {
      return this.parseBoostedTerm();
    }
    if (this.current.includes('*') || this.current.includes('?')) {
      return this.parseWildcardTerm();
    }
    return this.parseRegularTerm();
  }
  parseOperatorTerm() {
    const operator = this.normalizeOperator(this.current);
    this.advance();
    if (!this.current) return null;
    const nextTerm = this.parseTerm();
    if (nextTerm) {
      nextTerm.operator = operator;
      if (operator === 'NOT') {
        nextTerm.prohibited = true;
      } else if (operator === 'AND') {
        nextTerm.required = true;
      }
    }
    return nextTerm;
  }
  parseFieldTerm() {
    const [field, value] = this.current.split(':', 2);
    return {
      text: this.textProcessor.stem(value),
      field: field.toLowerCase(),
      operator: 'AND',
      boost: this.defaultOptions.boost[field.toLowerCase()] || 1.0,
      fuzzy: false,
      required: true,
      prohibited: false,
    };
  }
  parsePhraseTerm() {
    const phrase = this.current.slice(1, -1);
    const processed = this.textProcessor.processText(phrase);
    return {
      text: processed.map(t => t.stemmed).join(' '),
      operator: 'PHRASE',
      boost: 1.5,
      fuzzy: false,
      required: false,
      prohibited: false,
    };
  }
  parseFuzzyTerm() {
    const [term, distance] = this.current.split('~');
    const fuzzyDistance = distance ? parseInt(distance) || 2 : 2;
    return {
      text: this.textProcessor.stem(term),
      operator: 'OR',
      boost: 0.8,
      fuzzy: true,
      proximity: fuzzyDistance,
      required: false,
      prohibited: false,
    };
  }
  parseBoostedTerm() {
    const [term, boostStr] = this.current.split('^');
    const boost = parseFloat(boostStr) || 1.0;
    return {
      text: this.textProcessor.stem(term),
      operator: 'OR',
      boost,
      fuzzy: false,
      required: false,
      prohibited: false,
    };
  }
  parseWildcardTerm() {
    return {
      text: this.current.toLowerCase(),
      operator: 'OR',
      boost: 0.9,
      fuzzy: false,
      required: false,
      prohibited: false,
    };
  }
  parseRegularTerm() {
    let text = this.current;
    let prohibited = false;
    let required = false;
    if (text.startsWith('+')) {
      required = true;
      text = text.slice(1);
    } else if (text.startsWith('-')) {
      prohibited = true;
      text = text.slice(1);
    }
    return {
      text: this.textProcessor.stem(text),
      operator: this.defaultOptions.defaultOperator,
      boost: 1.0,
      fuzzy: false,
      required,
      prohibited,
    };
  }
  normalizeQuery(query) {
    return query
      .trim()
      .replace(/\s+AND\s+/gi, ' AND ')
      .replace(/\s+OR\s+/gi, ' OR ')
      .replace(/\s+NOT\s+/gi, ' NOT ')
      .replace(/&&/g, ' AND ')
      .replace(/\|\|/g, ' OR ')
      .replace(/\s+/g, ' ');
  }
  tokenizeQuery(query) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let parenLevel = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      if (char === '"' && (i === 0 || query[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === '(' && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        parenLevel++;
        tokens.push('(');
      } else if (char === ')' && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        parenLevel--;
        tokens.push(')');
      } else if (char === ' ' && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      tokens.push(current.trim());
    }
    return tokens;
  }
  advance() {
    this.position++;
    this.current = this.tokens[this.position] || '';
  }
  isOperator(token) {
    const operators = ['AND', 'OR', 'NOT', '&&', '||', '+', '-'];
    return operators.includes(token.toUpperCase());
  }
  normalizeOperator(operator) {
    switch (operator.toUpperCase()) {
      case 'AND':
      case '&&':
      case '+':
        return 'AND';
      case 'OR':
      case '||':
        return 'OR';
      case 'NOT':
      case '-':
        return 'NOT';
      default:
        return 'OR';
    }
  }
  extractFilters(query) {
    const filters = [];
    const fieldMatches = query.match(/(\w+):([^\s"]+|"[^"]*")/g);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        const [field, value] = match.split(':', 2);
        filters.push({
          field: field.toLowerCase(),
          value: value.replace(/"/g, ''),
          operator: 'equals',
        });
      }
    }
    return filters;
  }
  determineQueryType(terms, original) {
    if (terms.length === 0) return 'simple';
    const hasOperators = terms.some(t => t.operator === 'AND' || t.operator === 'NOT');
    const hasPhrases = terms.some(t => t.operator === 'PHRASE');
    const hasFields = terms.some(t => t.field !== undefined);
    if (hasOperators && (hasPhrases || hasFields)) return 'mixed';
    if (hasOperators) return 'boolean';
    if (hasPhrases) return 'phrase';
    if (hasFields) return 'field';
    return 'simple';
  }
  createEmptyQuery(original, options) {
    return {
      type: 'simple',
      terms: [],
      filters: [],
      options,
      original,
      normalized: '',
    };
  }
}
exports.QueryParser = QueryParser;
exports.default = QueryParser;
//# sourceMappingURL=QueryParser.js.map
