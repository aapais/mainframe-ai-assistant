'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ValidationService = void 0;
const zod_1 = require('zod');
class ValidationService {
  kbEntrySchema;
  validationRules = new Map();
  businessRules = new Map();
  constructor() {
    this.initializeSchemas();
    this.initializeValidationRules();
    this.initializeBusinessRules();
  }
  async validateImportData(data, options = {}) {
    const stats = {
      totalRecords: data.length,
      validRecords: 0,
      invalidRecords: 0,
      duplicateRecords: 0,
      missingFields: {},
      invalidFieldValues: {},
    };
    const errors = [];
    const warnings = [];
    const issues = [];
    try {
      if (options.validateSchema !== false) {
        const schemaResults = await this.validateSchema(data, options.strictMode);
        errors.push(...schemaResults.errors);
        warnings.push(...schemaResults.warnings);
      }
      if (options.businessRules) {
        const businessResults = await this.validateBusinessRules(data, options.businessRules);
        issues.push(...businessResults);
      }
      if (options.dataQualityChecks) {
        const qualityResults = await this.performDataQualityChecks(data);
        warnings.push(...qualityResults.warnings);
      }
      if (options.customValidators) {
        for (const validator of options.customValidators) {
          const result = validator(data);
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        }
      }
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        const recordValidation = await this.validateRecord(record, i, options);
        if (recordValidation.valid) {
          stats.validRecords++;
        } else {
          stats.invalidRecords++;
          recordValidation.issues.forEach(issue => {
            if (issue.level === 'error') {
              errors.push(`Record ${i + 1}: ${issue.message}`);
            } else {
              warnings.push(`Record ${i + 1}: ${issue.message}`);
            }
            if (issue.field) {
              if (issue.level === 'error' && issue.message.includes('missing')) {
                stats.missingFields[issue.field] = (stats.missingFields[issue.field] || 0) + 1;
              } else if (issue.level === 'error') {
                stats.invalidFieldValues[issue.field] =
                  (stats.invalidFieldValues[issue.field] || 0) + 1;
              }
            }
          });
        }
      }
      stats.duplicateRecords = await this.detectDuplicates(data);
      return {
        valid: errors.length === 0 || (options.allowPartialImport && stats.validRecords > 0),
        errors,
        warnings,
        stats,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation process failed: ${error.message}`],
        warnings: [],
        stats,
      };
    }
  }
  async validateRecord(record, index, options = {}) {
    const issues = [];
    try {
      const requiredFields = ['title', 'problem', 'solution', 'category'];
      requiredFields.forEach(field => {
        if (!record[field] || (typeof record[field] === 'string' && record[field].trim() === '')) {
          issues.push({
            level: 'error',
            field,
            message: `Required field '${field}' is missing or empty`,
            recordIndex: index,
            suggestion: `Provide a value for ${field}`,
          });
        }
      });
      if (record.title) {
        const titleValidation = this.validateTitle(record.title);
        if (!titleValidation.valid) {
          issues.push({
            level: titleValidation.severity || 'warning',
            field: 'title',
            message: titleValidation.message || 'Invalid title format',
            recordIndex: index,
            value: record.title,
            suggestion: titleValidation.suggestion,
          });
        }
      }
      if (record.category) {
        const categoryValidation = this.validateCategory(record.category);
        if (!categoryValidation.valid) {
          issues.push({
            level: 'error',
            field: 'category',
            message: categoryValidation.message || 'Invalid category',
            recordIndex: index,
            value: record.category,
            suggestion: categoryValidation.suggestion,
          });
        }
      }
      if (record.tags) {
        const tagsValidation = this.validateTags(record.tags);
        if (!tagsValidation.valid) {
          issues.push({
            level: 'warning',
            field: 'tags',
            message: tagsValidation.message || 'Invalid tags format',
            recordIndex: index,
            value: record.tags,
            suggestion: tagsValidation.suggestion,
          });
        }
      }
      if (record.created_at && !this.isValidDate(record.created_at)) {
        issues.push({
          level: 'warning',
          field: 'created_at',
          message: 'Invalid date format',
          recordIndex: index,
          value: record.created_at,
          suggestion: 'Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        });
      }
      if (options.dataQualityChecks) {
        const qualityIssues = this.performRecordQualityChecks(record, index);
        issues.push(...qualityIssues);
      }
      return {
        valid: issues.filter(i => i.level === 'error').length === 0,
        issues,
      };
    } catch (error) {
      issues.push({
        level: 'error',
        field: 'general',
        message: `Record validation failed: ${error.message}`,
        recordIndex: index,
      });
      return {
        valid: false,
        issues,
      };
    }
  }
  async validateBatch(batch, batchIndex = 0, options = {}) {
    try {
      const batchValidation = await this.validateImportData(batch, options);
      const adjustedErrors = batchValidation.errors.map(error => `Batch ${batchIndex}: ${error}`);
      const adjustedWarnings = batchValidation.warnings.map(
        warning => `Batch ${batchIndex}: ${warning}`
      );
      return {
        ...batchValidation,
        errors: adjustedErrors,
        warnings: adjustedWarnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Batch ${batchIndex} validation failed: ${error.message}`],
        warnings: [],
        stats: {
          totalRecords: batch.length,
          validRecords: 0,
          invalidRecords: batch.length,
          duplicateRecords: 0,
          missingFields: {},
          invalidFieldValues: {},
        },
      };
    }
  }
  async getDataQualityMetrics(data) {
    const metrics = {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      uniqueness: 0,
      timeliness: 0,
      validity: 0,
    };
    if (data.length === 0) {
      return metrics;
    }
    try {
      const requiredFields = ['title', 'problem', 'solution', 'category'];
      const totalFields = data.length * requiredFields.length;
      let completedFields = 0;
      data.forEach(record => {
        requiredFields.forEach(field => {
          if (record[field] && record[field].toString().trim() !== '') {
            completedFields++;
          }
        });
      });
      metrics.completeness = (completedFields / totalFields) * 100;
      let validFormats = 0;
      let totalFormatChecks = 0;
      data.forEach(record => {
        if (record.category) {
          totalFormatChecks++;
          if (this.validateCategory(record.category).valid) {
            validFormats++;
          }
        }
        if (record.created_at) {
          totalFormatChecks++;
          if (this.isValidDate(record.created_at)) {
            validFormats++;
          }
        }
      });
      metrics.accuracy = totalFormatChecks > 0 ? (validFormats / totalFormatChecks) * 100 : 100;
      const titles = data.map(r => r.title).filter(Boolean);
      const uniqueTitles = new Set(titles);
      metrics.uniqueness = titles.length > 0 ? (uniqueTitles.size / titles.length) * 100 : 100;
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
      let recentRecords = 0;
      let recordsWithDates = 0;
      data.forEach(record => {
        if (record.created_at || record.updated_at) {
          recordsWithDates++;
          const recordDate = new Date(record.created_at || record.updated_at);
          if (recordDate >= sixMonthsAgo) {
            recentRecords++;
          }
        }
      });
      metrics.timeliness = recordsWithDates > 0 ? (recentRecords / recordsWithDates) * 100 : 0;
      let validRecords = 0;
      for (const record of data) {
        const validation = await this.validateRecord(record, 0, { strictMode: true });
        if (validation.valid) {
          validRecords++;
        }
      }
      metrics.validity = (validRecords / data.length) * 100;
      metrics.consistency = (metrics.completeness + metrics.accuracy + metrics.uniqueness) / 3;
      return metrics;
    } catch (error) {
      console.error('Error calculating data quality metrics:', error);
      return metrics;
    }
  }
  getValidationSuggestions(field, value, validationError) {
    const suggestions = [];
    switch (field) {
      case 'title':
        suggestions.push('Ensure title is between 5-200 characters');
        suggestions.push('Use descriptive, specific titles');
        suggestions.push('Avoid special characters at the beginning');
        break;
      case 'category':
        suggestions.push('Use one of: JCL, VSAM, DB2, Batch, Functional, Other');
        suggestions.push('Check spelling and capitalization');
        break;
      case 'tags':
        suggestions.push('Use comma-separated values');
        suggestions.push('Keep tags concise (1-20 characters each)');
        suggestions.push('Use lowercase for consistency');
        break;
      case 'problem':
      case 'solution':
        suggestions.push('Provide detailed description (minimum 20 characters)');
        suggestions.push('Include specific error codes or symptoms');
        suggestions.push('Use clear, professional language');
        break;
      default:
        suggestions.push('Check data format and requirements');
        suggestions.push('Refer to documentation for valid values');
    }
    return suggestions;
  }
  initializeSchemas() {
    this.kbEntrySchema = zod_1.z.object({
      title: zod_1.z.string().min(5).max(200),
      problem: zod_1.z.string().min(10).max(5000),
      solution: zod_1.z.string().min(10).max(5000),
      category: zod_1.z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']),
      tags: zod_1.z.array(zod_1.z.string()).optional(),
      created_by: zod_1.z.string().optional(),
      created_at: zod_1.z.date().optional(),
      updated_at: zod_1.z.date().optional(),
    });
  }
  initializeValidationRules() {
    this.validationRules.set('title-format', {
      id: 'title-format',
      name: 'Title Format',
      description: 'Validates title format and length',
      field: 'title',
      type: 'format',
      validator: value => this.validateTitle(value),
      severity: 'error',
      category: 'format',
    });
    this.validationRules.set('category-valid', {
      id: 'category-valid',
      name: 'Valid Category',
      description: 'Ensures category is from allowed list',
      field: 'category',
      type: 'format',
      validator: value => this.validateCategory(value),
      severity: 'error',
      category: 'business',
    });
  }
  initializeBusinessRules() {
    this.businessRules.set('content-consistency', [
      {
        id: 'problem-solution-consistency',
        name: 'Problem-Solution Consistency',
        description: 'Ensures problem and solution are related',
        field: 'solution',
        type: 'business',
        validator: (value, record) => {
          if (!record.problem || !value) {
            return { valid: false, message: 'Both problem and solution must be provided' };
          }
          const problemWords = record.problem.toLowerCase().split(/\s+/);
          const solutionWords = value.toLowerCase().split(/\s+/);
          const commonWords = problemWords.filter(
            word => word.length > 3 && solutionWords.includes(word)
          );
          const overlap = commonWords.length / Math.min(problemWords.length, solutionWords.length);
          if (overlap < 0.1) {
            return {
              valid: false,
              message: 'Problem and solution appear unrelated',
              suggestion: 'Ensure solution addresses the specific problem described',
            };
          }
          return { valid: true };
        },
        severity: 'warning',
        category: 'business',
      },
    ]);
  }
  async validateSchema(data, strictMode = false) {
    const errors = [];
    const warnings = [];
    for (let i = 0; i < data.length; i++) {
      try {
        this.kbEntrySchema.parse(data[i]);
      } catch (error) {
        if (error instanceof zod_1.z.ZodError) {
          error.errors.forEach(err => {
            const message = `Record ${i + 1}, field '${err.path.join('.')}': ${err.message}`;
            if (strictMode) {
              errors.push(message);
            } else {
              warnings.push(message);
            }
          });
        }
      }
    }
    return { errors, warnings };
  }
  async validateBusinessRules(data, rules) {
    const issues = [];
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      for (const rule of rules) {
        try {
          const result = rule.validator(record[rule.field], record);
          if (!result.valid) {
            issues.push({
              level: rule.severity,
              field: rule.field,
              message: result.message || `Business rule '${rule.name}' failed`,
              recordIndex: i,
              suggestion: result.suggestion,
            });
          }
        } catch (error) {
          issues.push({
            level: 'error',
            field: rule.field,
            message: `Business rule validation error: ${error.message}`,
            recordIndex: i,
          });
        }
      }
    }
    return issues;
  }
  async performDataQualityChecks(data) {
    const warnings = [];
    try {
      const metrics = await this.getDataQualityMetrics(data);
      if (metrics.completeness < 80) {
        warnings.push(`Low data completeness: ${metrics.completeness.toFixed(1)}%`);
      }
      if (metrics.accuracy < 90) {
        warnings.push(`Low data accuracy: ${metrics.accuracy.toFixed(1)}%`);
      }
      if (metrics.uniqueness < 95) {
        warnings.push(
          `Potential duplicate records detected: ${(100 - metrics.uniqueness).toFixed(1)}% duplication rate`
        );
      }
      if (metrics.validity < 70) {
        warnings.push(
          `Many records fail validation: ${(100 - metrics.validity).toFixed(1)}% invalid`
        );
      }
    } catch (error) {
      warnings.push(`Data quality check failed: ${error.message}`);
    }
    return { warnings };
  }
  performRecordQualityChecks(record, index) {
    const issues = [];
    if (record.title && record.title.length > 200) {
      issues.push({
        level: 'warning',
        field: 'title',
        message: 'Title is very long',
        recordIndex: index,
        suggestion: 'Consider shortening to under 200 characters',
      });
    }
    if (record.problem && record.problem.length < 20) {
      issues.push({
        level: 'warning',
        field: 'problem',
        message: 'Problem description is very short',
        recordIndex: index,
        suggestion: 'Provide more detailed problem description',
      });
    }
    if (record.solution && record.solution.length < 20) {
      issues.push({
        level: 'warning',
        field: 'solution',
        message: 'Solution description is very short',
        recordIndex: index,
        suggestion: 'Provide more detailed solution steps',
      });
    }
    if (record.title && /^[^a-zA-Z]/.test(record.title)) {
      issues.push({
        level: 'info',
        field: 'title',
        message: 'Title starts with non-alphabetic character',
        recordIndex: index,
        suggestion: 'Consider starting with a descriptive word',
      });
    }
    return issues;
  }
  validateTitle(value) {
    if (!value || typeof value !== 'string') {
      return {
        valid: false,
        message: 'Title must be a non-empty string',
        suggestion: 'Provide a descriptive title',
      };
    }
    const title = value.trim();
    if (title.length < 5) {
      return {
        valid: false,
        message: 'Title too short (minimum 5 characters)',
        suggestion: 'Provide a more descriptive title',
      };
    }
    if (title.length > 200) {
      return {
        valid: false,
        message: 'Title too long (maximum 200 characters)',
        suggestion: 'Shorten the title',
        correctedValue: `${title.substring(0, 197)}...`,
      };
    }
    return { valid: true };
  }
  validateCategory(value) {
    const validCategories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
    if (!value || typeof value !== 'string') {
      return {
        valid: false,
        message: 'Category must be a string',
        suggestion: `Use one of: ${validCategories.join(', ')}`,
      };
    }
    if (!validCategories.includes(value)) {
      const suggestion = this.findClosestCategory(value, validCategories);
      return {
        valid: false,
        message: `Invalid category: ${value}`,
        suggestion: suggestion
          ? `Did you mean '${suggestion}'?`
          : `Use one of: ${validCategories.join(', ')}`,
        correctedValue: suggestion,
      };
    }
    return { valid: true };
  }
  validateTags(value) {
    if (!value) {
      return { valid: true };
    }
    if (Array.isArray(value)) {
      const invalidTags = value.filter(
        tag => typeof tag !== 'string' || tag.length === 0 || tag.length > 20
      );
      if (invalidTags.length > 0) {
        return {
          valid: false,
          message: 'Invalid tags found',
          suggestion: 'Tags must be strings between 1-20 characters',
        };
      }
    } else if (typeof value === 'string') {
      const tags = value.split(/[,;|]/).map(tag => tag.trim());
      const invalidTags = tags.filter(tag => tag.length === 0 || tag.length > 20);
      if (invalidTags.length > 0) {
        return {
          valid: false,
          message: 'Invalid tag format',
          suggestion: 'Use comma-separated tags, each 1-20 characters',
        };
      }
    } else {
      return {
        valid: false,
        message: 'Tags must be array or comma-separated string',
        suggestion: 'Provide tags as array or comma-separated string',
      };
    }
    return { valid: true };
  }
  isValidDate(value) {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  async detectDuplicates(data) {
    const seen = new Set();
    let duplicates = 0;
    data.forEach(record => {
      if (record.title) {
        const key = record.title.toLowerCase().trim();
        if (seen.has(key)) {
          duplicates++;
        } else {
          seen.add(key);
        }
      }
    });
    return duplicates;
  }
  findClosestCategory(input, validCategories) {
    const inputLower = input.toLowerCase();
    const directMatches = validCategories.filter(
      cat => cat.toLowerCase().includes(inputLower) || inputLower.includes(cat.toLowerCase())
    );
    if (directMatches.length > 0) {
      return directMatches[0];
    }
    const fuzzyMatches = validCategories
      .map(cat => ({
        category: cat,
        score: this.calculateSimilarity(inputLower, cat.toLowerCase()),
      }))
      .filter(match => match.score > 0.5);
    if (fuzzyMatches.length > 0) {
      fuzzyMatches.sort((a, b) => b.score - a.score);
      return fuzzyMatches[0].category;
    }
    return null;
  }
  calculateSimilarity(str1, str2) {
    const chars1 = new Set(str1.split(''));
    const chars2 = new Set(str2.split(''));
    const intersection = new Set([...chars1].filter(c => chars2.has(c)));
    const union = new Set([...chars1, ...chars2]);
    return intersection.size / union.size;
  }
}
exports.ValidationService = ValidationService;
exports.default = ValidationService;
//# sourceMappingURL=ValidationService.js.map
