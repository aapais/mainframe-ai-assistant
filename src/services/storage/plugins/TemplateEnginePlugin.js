'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.TemplateEnginePlugin = void 0;
const BaseStoragePlugin_1 = require('./BaseStoragePlugin');
class TemplateEnginePlugin extends BaseStoragePlugin_1.BaseStoragePlugin {
  templates = new Map();
  generationCache = new Map();
  usageStats = new Map();
  constructor(adapter, config = {}) {
    super(adapter, config);
  }
  getName() {
    return 'template-engine';
  }
  getVersion() {
    return '4.0.0';
  }
  getDescription() {
    return 'Provides template generation, management, and code generation capabilities';
  }
  getMVPVersion() {
    return 4;
  }
  getDependencies() {
    return ['full-text-search', 'raw-sql'];
  }
  getDefaultConfig() {
    return {
      enabled: true,
      generation: {
        max_template_size_kb: 100,
        generation_timeout_seconds: 30,
        auto_validate_output: true,
        cache_generated_code: true,
        enable_ai_optimization: false,
      },
      validation: {
        strict_syntax_checking: true,
        performance_analysis: true,
        security_scanning: true,
        standards_compliance: true,
        custom_rules_enabled: true,
      },
      library: {
        auto_extract_patterns: true,
        min_usage_for_template: 5,
        auto_update_templates: true,
        version_control: true,
        backup_frequency_hours: 24,
      },
      ai_integration: {
        template_optimization: false,
        smart_parameter_inference: false,
        auto_documentation: false,
        pattern_recognition: false,
      },
    };
  }
  async initializePlugin() {
    await this.createTables();
    await this.loadExistingTemplates();
    await this.loadBuiltInTemplates();
    if (this.config.library.auto_extract_patterns) {
      await this.extractPatternsFromKB();
    }
    this.log('info', 'Template engine plugin initialized', {
      templates_loaded: this.templates.size,
      auto_extract: this.config.library.auto_extract_patterns,
    });
  }
  async cleanupPlugin() {
    await this.persistTemplates();
    this.generationCache.clear();
    this.log('info', 'Template engine plugin cleaned up');
  }
  async processData(data, context) {
    const { action, payload } = data;
    switch (action) {
      case 'create_template':
        return await this.createTemplate(payload);
      case 'generate_code':
        return await this.generateCode(payload);
      case 'get_template':
        return await this.getTemplate(payload.templateId);
      case 'list_templates':
        return await this.listTemplates(payload?.filters);
      case 'update_template':
        return await this.updateTemplate(payload.templateId, payload.updates);
      case 'delete_template':
        return await this.deleteTemplate(payload.templateId);
      case 'validate_template':
        return await this.validateTemplate(payload.templateId, payload.parameters);
      case 'extract_from_kb':
        return await this.extractTemplateFromKB(payload.kbEntryId, payload.options);
      case 'get_library':
        return await this.getTemplateLibrary();
      case 'optimize_template':
        return await this.optimizeTemplate(payload.templateId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
  async createTemplate(templateData) {
    if (!templateData.name || !templateData.template_content) {
      throw new Error('Template name and content are required');
    }
    const template = {
      id: this.generateTemplateId(templateData.name),
      name: templateData.name,
      description: templateData.description || '',
      category: templateData.category || 'custom',
      type: templateData.type || 'cobol',
      template_content: templateData.template_content,
      parameters: templateData.parameters || [],
      validation_rules: templateData.validation_rules || [],
      usage_count: 0,
      success_rate: 100,
      source_pattern: templateData.source_pattern,
      source_kb_entries: templateData.source_kb_entries || [],
      created_by: templateData.created_by || 'system',
      created_at: new Date(),
      updated_at: new Date(),
      tags: templateData.tags || [],
      complexity_score: this.calculateComplexity(templateData.template_content),
      maintainability_score: this.calculateMaintainability(templateData.template_content),
      examples: templateData.examples || [],
    };
    const validation = await this.validateTemplateContent(template);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }
    this.templates.set(template.id, template);
    await this.persistTemplate(template);
    this.emit('template-created', { template });
    this.log('info', 'Template created', {
      name: template.name,
      category: template.category,
      parameters: template.parameters.length,
    });
    return template;
  }
  async generateCode(request) {
    const startTime = Date.now();
    const config = this.config;
    const template = this.templates.get(request.template_id);
    if (!template) {
      throw new Error(`Template not found: ${request.template_id}`);
    }
    const cacheKey = this.generateCacheKey(request);
    if (config.generation.cache_generated_code && this.generationCache.has(cacheKey)) {
      const cached = this.generationCache.get(cacheKey);
      this.log('info', 'Using cached generation', { template: template.name });
      return cached;
    }
    const paramValidation = this.validateParameters(template, request.parameters);
    if (!paramValidation.valid) {
      throw new Error(`Parameter validation failed: ${paramValidation.errors.join(', ')}`);
    }
    let generatedCode = await this.processTemplate(template, request.parameters);
    if (request.customize) {
      generatedCode = this.applyCustomizations(generatedCode, request.customize);
    }
    generatedCode = this.formatOutput(generatedCode, request.output_format || 'formatted');
    let validationResults = [];
    if (request.validate !== false && config.generation.auto_validate_output) {
      validationResults = await this.validateGeneratedCode(template, generatedCode);
    }
    const result = {
      template_id: request.template_id,
      generated_code: generatedCode,
      validation_results: validationResults,
      metadata: {
        generated_at: new Date(),
        parameters_used: request.parameters,
        template_version: template.updated_at.toISOString(),
        generation_time_ms: Date.now() - startTime,
        lines_generated: generatedCode.split('\n').length,
        complexity_estimate: this.estimateComplexity(generatedCode),
      },
      suggestions: await this.generateSuggestions(template, generatedCode),
      warnings: this.generateWarnings(validationResults),
    };
    if (config.generation.cache_generated_code) {
      this.generationCache.set(cacheKey, result);
    }
    template.usage_count++;
    this.usageStats.set(template.id, (this.usageStats.get(template.id) || 0) + 1);
    await this.persistTemplate(template);
    this.emit('code-generated', { template: template.name, result });
    return result;
  }
  async processTemplate(template, parameters) {
    let content = template.template_content;
    for (const param of template.parameters) {
      const value = parameters[param.name];
      if (value !== undefined) {
        content = this.replaceParameter(content, param.name, value, param.type);
      } else if (param.required) {
        throw new Error(`Required parameter missing: ${param.name}`);
      } else if (param.default_value !== undefined) {
        content = this.replaceParameter(content, param.name, param.default_value, param.type);
      }
    }
    content = this.processConditionals(content, parameters);
    content = this.processLoops(content, parameters);
    content = this.processFunctions(content, parameters);
    return content;
  }
  replaceParameter(content, paramName, value, type) {
    const placeholder = `{{${paramName}}}`;
    const formattedValue = this.formatParameterValue(value, type);
    return content.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      formattedValue
    );
  }
  formatParameterValue(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value).toString();
      case 'boolean':
        return value ? 'TRUE' : 'FALSE';
      case 'date':
        return new Date(value).toISOString().split('T')[0];
      case 'list':
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value);
    }
  }
  processConditionals(content, parameters) {
    const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return content.replace(ifPattern, (match, condition, block) => {
      const value = parameters[condition];
      return value ? block : '';
    });
  }
  processLoops(content, parameters) {
    const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    return content.replace(eachPattern, (match, arrayName, block) => {
      const array = parameters[arrayName];
      if (!Array.isArray(array)) return '';
      return array
        .map((item, index) => {
          let itemBlock = block;
          itemBlock = itemBlock.replace(/\{\{this\}\}/g, String(item));
          itemBlock = itemBlock.replace(/\{\{@index\}\}/g, String(index));
          return itemBlock;
        })
        .join('');
    });
  }
  processFunctions(content, parameters) {
    const funcPattern = /\{\{(\w+)\s+([^}]+)\}\}/g;
    return content.replace(funcPattern, (match, funcName, args) => {
      const argValue = parameters[args.trim()] || args.trim();
      switch (funcName.toLowerCase()) {
        case 'uppercase':
          return String(argValue).toUpperCase();
        case 'lowercase':
          return String(argValue).toLowerCase();
        case 'pad':
          const [str, length] = args.split(',').map(s => s.trim());
          const strValue = parameters[str] || str;
          const lengthValue = parseInt(parameters[length] || length);
          return String(strValue).padEnd(lengthValue, ' ');
        case 'format_date':
          return new Date(argValue).toLocaleDateString();
        default:
          return match;
      }
    });
  }
  applyCustomizations(code, customization) {
    let customized = code;
    if (customization.naming_convention) {
      customized = this.applyNamingConvention(customized, customization.naming_convention);
    }
    if (customization.indentation && customization.indent_size) {
      customized = this.applyIndentation(
        customized,
        customization.indentation,
        customization.indent_size
      );
    }
    if (customization.line_numbers) {
      customized = this.addLineNumbers(customized);
    }
    if (customization.column_format === 'fixed') {
      customized = this.ensureFixedFormat(customized);
    }
    return customized;
  }
  applyNamingConvention(code, convention) {
    const identifierPattern = /\b[A-Z][A-Z0-9-]*\b/g;
    return code.replace(identifierPattern, match => {
      switch (convention) {
        case 'uppercase':
          return match.toUpperCase();
        case 'lowercase':
          return match.toLowerCase();
        case 'mixed':
          return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
        default:
          return match;
      }
    });
  }
  applyIndentation(code, type, size) {
    const lines = code.split('\n');
    const indent = type === 'tabs' ? '\t' : ' '.repeat(size);
    return lines
      .map(line => {
        if (line.trim() && line.length > 7) {
          const prefix = line.substring(0, 7);
          const content = line.substring(7);
          return prefix + indent + content.trim();
        }
        return line;
      })
      .join('\n');
  }
  addLineNumbers(code) {
    const lines = code.split('\n');
    return lines
      .map((line, index) => {
        const lineNum = (index + 1).toString().padStart(6, '0');
        return `${lineNum} ${line}`;
      })
      .join('\n');
  }
  ensureFixedFormat(code) {
    const lines = code.split('\n');
    return lines
      .map(line => {
        if (line.length > 72) {
          return line.substring(0, 72);
        }
        if (line.length < 72) {
          return line.padEnd(72, ' ');
        }
        return line;
      })
      .join('\n');
  }
  formatOutput(code, format) {
    switch (format) {
      case 'raw':
        return code;
      case 'with_comments':
        return this.addGenerationComments(code);
      case 'formatted':
      default:
        return this.formatCode(code);
    }
  }
  addGenerationComments(code) {
    const timestamp = new Date().toISOString();
    const header = `
      * Generated by Template Engine
      * Timestamp: ${timestamp}
      * Template: Auto-generated
      * Warning: Modify with caution
      *
    `.replace(/^ {6}/gm, '');
    return header + code;
  }
  formatCode(code) {
    const lines = code.split('\n');
    return lines
      .map(line => {
        if (line.trim() === '') return line;
        if (line.length < 7) {
          line = line.padEnd(7, ' ');
        }
        if (line.length > 72) {
          line = line.substring(0, 72);
        }
        return line;
      })
      .join('\n');
  }
  async validateTemplateContent(template) {
    const errors = [];
    const parameterPattern = /\{\{(\w+)\}\}/g;
    const matches = template.template_content.match(parameterPattern);
    if (matches) {
      const referencedParams = matches.map(match => match.slice(2, -2));
      const definedParams = template.parameters.map(p => p.name);
      for (const param of referencedParams) {
        if (!definedParams.includes(param)) {
          errors.push(`Referenced parameter '${param}' is not defined`);
        }
      }
    }
    if (template.type === 'cobol') {
      const syntaxErrors = this.validateCOBOLSyntax(template.template_content);
      errors.push(...syntaxErrors);
    }
    for (const param of template.parameters) {
      if (!param.name || !param.type) {
        errors.push(`Parameter must have name and type: ${JSON.stringify(param)}`);
      }
      if (param.validation_pattern) {
        try {
          new RegExp(param.validation_pattern);
        } catch {
          errors.push(`Invalid validation pattern for parameter '${param.name}'`);
        }
      }
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  validateCOBOLSyntax(content) {
    const errors = [];
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      if (line.length < 7 || line[6] === '*' || line.trim() === '') {
        return;
      }
      if (line.length > 72) {
        errors.push(`Line ${lineNum}: Exceeds 72 characters`);
      }
      const code = line.substring(7).trim();
      if (code.includes('{{') || code.includes('}}')) {
        return;
      }
      if (code.includes('.') && !this.isValidPeriodUsage(code)) {
        errors.push(`Line ${lineNum}: Invalid period usage`);
      }
    });
    return errors;
  }
  isValidPeriodUsage(code) {
    const periods = code.match(/\./g);
    if (!periods) return true;
    if (code.includes('"') || code.includes("'")) return true;
    return code.trim().endsWith('.');
  }
  validateParameters(template, parameters) {
    const errors = [];
    for (const param of template.parameters) {
      const value = parameters[param.name];
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required parameter missing: ${param.name}`);
        continue;
      }
      if (value === undefined) continue;
      if (!this.validateParameterType(value, param.type)) {
        errors.push(`Invalid type for parameter '${param.name}': expected ${param.type}`);
      }
      if (param.validation_pattern && typeof value === 'string') {
        const pattern = new RegExp(param.validation_pattern);
        if (!pattern.test(value)) {
          errors.push(`Parameter '${param.name}' does not match required pattern`);
        }
      }
      if (param.allowed_values && param.allowed_values.length > 0) {
        if (!param.allowed_values.includes(value)) {
          errors.push(
            `Parameter '${param.name}' must be one of: ${param.allowed_values.join(', ')}`
          );
        }
      }
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  validateParameterType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'list':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        return true;
    }
  }
  async validateGeneratedCode(template, generatedCode) {
    const results = [];
    for (const rule of template.validation_rules) {
      const result = await this.runValidationRule(rule, generatedCode, template);
      results.push(result);
    }
    if (this.config.validation.syntax_checking) {
      results.push(...(await this.validateSyntax(generatedCode, template.type)));
    }
    if (this.config.validation.standards_compliance) {
      results.push(...(await this.validateStandards(generatedCode)));
    }
    return results;
  }
  async runValidationRule(rule, code, template) {
    try {
      const context = {
        code,
        template,
        lines: code.split('\n'),
        includes: search => code.includes(search),
        matches: pattern => new RegExp(pattern).test(code),
        lineCount: () => code.split('\n').length,
      };
      const validator = new Function(
        'context',
        `
        with (context) {
          return ${rule.validator};
        }
      `
      );
      const passed = validator(context);
      return {
        rule_name: rule.name,
        passed: Boolean(passed),
        message: passed ? 'Validation passed' : rule.error_message,
        severity: passed ? 'info' : rule.type === 'syntax' ? 'error' : 'warning',
        auto_fixable: rule.auto_fix || false,
      };
    } catch (error) {
      return {
        rule_name: rule.name,
        passed: false,
        message: `Validation rule error: ${error.message}`,
        severity: 'error',
        auto_fixable: false,
      };
    }
  }
  async validateSyntax(code, type) {
    const results = [];
    if (type === 'cobol') {
      const errors = this.validateCOBOLSyntax(code);
      results.push(
        ...errors.map(error => ({
          rule_name: 'syntax_check',
          passed: false,
          message: error,
          severity: 'error',
          auto_fixable: false,
        }))
      );
    }
    return results;
  }
  async validateStandards(code) {
    const results = [];
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      if (line.length > 72) {
        results.push({
          rule_name: 'line_length',
          passed: false,
          message: `Line ${lineNum} exceeds 72 characters`,
          line: lineNum,
          severity: 'warning',
          auto_fixable: true,
          fix_suggestion: 'Truncate or wrap line',
        });
      }
    });
    return results;
  }
  async extractTemplateFromKB(kbEntryId, options = {}) {
    const kbEntry = await this.adapter.executeSQL('SELECT * FROM kb_entries WHERE id = ?', [
      kbEntryId,
    ]);
    if (!kbEntry || kbEntry.length === 0) {
      throw new Error(`KB entry not found: ${kbEntryId}`);
    }
    const entry = kbEntry[0];
    const templateContent = this.extractTemplateFromSolution(entry.solution);
    const parameters = this.inferParameters(templateContent);
    const template = {
      name: `Template: ${entry.title}`,
      description: `Auto-extracted from KB entry: ${entry.title}`,
      category: this.mapCategoryToTemplate(entry.category),
      type: this.inferTemplateType(templateContent),
      template_content: templateContent,
      parameters,
      validation_rules: this.generateValidationRules(templateContent),
      source_kb_entries: [kbEntryId],
      created_by: 'auto-extract',
      tags: entry.tags ? entry.tags.split(',') : [],
      examples: [
        {
          name: 'Basic Example',
          description: 'Example from KB entry',
          parameters: this.generateExampleParameters(parameters),
          expected_output: templateContent,
          explanation: entry.problem,
        },
      ],
    };
    return await this.createTemplate(template);
  }
  extractTemplateFromSolution(solution) {
    let template = solution;
    template = this.parameterizeValues(template);
    template = this.addTemplateStructure(template);
    return template;
  }
  parameterizeValues(content) {
    let parameterized = content;
    parameterized = parameterized.replace(/\b[A-Z0-9]+\.[A-Z0-9.]+\b/g, '{{DATASET_NAME}}');
    parameterized = parameterized.replace(
      /\bPROGRAM-ID\.\s+([A-Z0-9-]+)/g,
      'PROGRAM-ID. {{PROGRAM_NAME}}'
    );
    parameterized = parameterized.replace(/\b[A-Z0-9-]+\.DAT\b/g, '{{FILE_NAME}}');
    parameterized = parameterized.replace(/\b\d+\b/g, match => {
      const num = parseInt(match);
      if (num > 100) return '{{RECORD_SIZE}}';
      if (num > 10) return '{{BUFFER_SIZE}}';
      return match;
    });
    return parameterized;
  }
  addTemplateStructure(content) {
    if (!content.includes('IDENTIFICATION DIVISION')) {
      return `       IDENTIFICATION DIVISION.
       PROGRAM-ID. {{PROGRAM_NAME}}.
       
       ENVIRONMENT DIVISION.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       {{#if VARIABLES}}
       ${content}
       {{/if}}
       
       PROCEDURE DIVISION.
       MAIN-LOGIC.
           ${content}
           STOP RUN.`;
    }
    return content;
  }
  inferParameters(templateContent) {
    const parameters = [];
    const paramPattern = /\{\{(\w+)\}\}/g;
    const matches = templateContent.match(paramPattern);
    if (matches) {
      const uniqueParams = [...new Set(matches.map(m => m.slice(2, -2)))];
      for (const paramName of uniqueParams) {
        const parameter = {
          name: paramName,
          type: this.inferParameterType(paramName),
          description: this.generateParameterDescription(paramName),
          required: true,
        };
        if (paramName.includes('NAME')) {
          parameter.validation_pattern = '^[A-Z0-9-]+$';
        }
        parameters.push(parameter);
      }
    }
    return parameters;
  }
  inferParameterType(paramName) {
    const name = paramName.toLowerCase();
    if (name.includes('count') || name.includes('size') || name.includes('number')) {
      return 'number';
    }
    if (name.includes('enable') || name.includes('flag') || name.includes('option')) {
      return 'boolean';
    }
    if (name.includes('date') || name.includes('time')) {
      return 'date';
    }
    if (name.includes('list') || name.includes('array')) {
      return 'list';
    }
    return 'string';
  }
  generateParameterDescription(paramName) {
    const name = paramName.toLowerCase().replace(/_/g, ' ');
    return `Parameter for ${name}`;
  }
  mapCategoryToTemplate(kbCategory) {
    const mapping = {
      JCL: 'file-operations',
      VSAM: 'file-operations',
      DB2: 'data-validation',
      Batch: 'utility',
      Functional: 'calculations',
    };
    return mapping[kbCategory] || 'custom';
  }
  inferTemplateType(content) {
    if (content.includes('IDENTIFICATION DIVISION')) return 'cobol';
    if (content.includes('//JOB') || content.includes('//EXEC')) return 'jcl';
    if (content.includes('PROC ')) return 'proc';
    return 'cobol';
  }
  generateValidationRules(content) {
    const rules = [];
    if (content.includes('IDENTIFICATION DIVISION')) {
      rules.push({
        name: 'cobol_structure',
        type: 'syntax',
        description: 'Validate COBOL program structure',
        validator:
          'code.includes("IDENTIFICATION DIVISION") && code.includes("PROCEDURE DIVISION")',
        error_message: 'COBOL program must have required divisions',
      });
    }
    rules.push({
      name: 'required_parameters',
      type: 'semantic',
      description: 'Check all parameters are replaced',
      validator: '!code.includes("{{") && !code.includes("}}")',
      error_message: 'All template parameters must be replaced',
    });
    return rules;
  }
  generateExampleParameters(parameters) {
    const example = {};
    for (const param of parameters) {
      switch (param.type) {
        case 'string':
          example[param.name] = param.name.includes('NAME') ? 'EXAMPLE-NAME' : 'EXAMPLE-VALUE';
          break;
        case 'number':
          example[param.name] = 100;
          break;
        case 'boolean':
          example[param.name] = true;
          break;
        case 'date':
          example[param.name] = new Date().toISOString().split('T')[0];
          break;
        case 'list':
          example[param.name] = ['ITEM1', 'ITEM2'];
          break;
        default:
          example[param.name] = 'EXAMPLE';
      }
    }
    return example;
  }
  generateTemplateId(name) {
    return `template-${Date.now()}-${this.hash(name)}`;
  }
  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  generateCacheKey(request) {
    const params = JSON.stringify(request.parameters);
    const customize = JSON.stringify(request.customize || {});
    return `${request.template_id}-${this.hash(params + customize)}`;
  }
  calculateComplexity(content) {
    const lines = content.split('\n');
    let complexity = 1;
    for (const line of lines) {
      const code = line.toLowerCase();
      if (code.includes('if ') || code.includes('evaluate') || code.includes('perform until')) {
        complexity++;
      }
      if (code.includes('perform') && code.includes('times')) {
        complexity++;
      }
      if (code.includes('{{#if') || code.includes('{{#each')) {
        complexity++;
      }
    }
    return complexity;
  }
  calculateMaintainability(content) {
    const lines = content.split('\n').filter(l => l.trim());
    const commentLines = lines.filter(l => l.includes('*') || l.includes('{{!')).length;
    const codeLines = lines.length - commentLines;
    const commentRatio = codeLines > 0 ? commentLines / codeLines : 0;
    const complexity = this.calculateComplexity(content);
    return Math.max(0, Math.min(100, 100 - complexity * 5 + commentRatio * 20));
  }
  estimateComplexity(code) {
    return this.calculateComplexity(code);
  }
  async generateSuggestions(template, generatedCode) {
    const suggestions = [];
    if (generatedCode.split('\n').length > 100) {
      suggestions.push('Consider breaking this into smaller modules for better maintainability');
    }
    if (!generatedCode.includes('*')) {
      suggestions.push('Add comments to improve code documentation');
    }
    if (template.complexity_score > 10) {
      suggestions.push('Template complexity is high - consider simplification');
    }
    return suggestions;
  }
  generateWarnings(validationResults) {
    return validationResults
      .filter(result => !result.passed && result.severity === 'warning')
      .map(result => result.message);
  }
  async createTables() {
    const createTemplatesTable = `
      CREATE TABLE IF NOT EXISTS code_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        type TEXT,
        template_content TEXT NOT NULL,
        parameters TEXT, -- JSON
        validation_rules TEXT, -- JSON
        usage_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 100.0,
        source_pattern TEXT,
        source_kb_entries TEXT, -- JSON array
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT, -- JSON array
        complexity_score REAL,
        maintainability_score REAL,
        examples TEXT -- JSON
      )
    `;
    const createGenerationsTable = `
      CREATE TABLE IF NOT EXISTS template_generations (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        parameters_used TEXT, -- JSON
        generated_code TEXT,
        generation_time_ms INTEGER,
        success BOOLEAN,
        validation_passed BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES code_templates(id)
      )
    `;
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_templates_category ON code_templates(category);
      CREATE INDEX IF NOT EXISTS idx_templates_type ON code_templates(type);
      CREATE INDEX IF NOT EXISTS idx_templates_usage ON code_templates(usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_generations_template ON template_generations(template_id);
      CREATE INDEX IF NOT EXISTS idx_generations_created ON template_generations(created_at);
    `;
    await this.adapter.executeSQL(createTemplatesTable);
    await this.adapter.executeSQL(createGenerationsTable);
    await this.adapter.executeSQL(createIndexes);
  }
  async loadExistingTemplates() {
    const templates = await this.adapter.executeSQL(
      'SELECT * FROM code_templates ORDER BY created_at DESC'
    );
    templates.forEach(row => {
      const template = {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        type: row.type,
        template_content: row.template_content,
        parameters: row.parameters ? JSON.parse(row.parameters) : [],
        validation_rules: row.validation_rules ? JSON.parse(row.validation_rules) : [],
        usage_count: row.usage_count,
        success_rate: row.success_rate,
        source_pattern: row.source_pattern,
        source_kb_entries: row.source_kb_entries ? JSON.parse(row.source_kb_entries) : [],
        created_by: row.created_by,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        tags: row.tags ? JSON.parse(row.tags) : [],
        complexity_score: row.complexity_score,
        maintainability_score: row.maintainability_score,
        examples: row.examples ? JSON.parse(row.examples) : [],
      };
      this.templates.set(template.id, template);
    });
  }
  async persistTemplate(template) {
    const sql = `
      INSERT OR REPLACE INTO code_templates 
      (id, name, description, category, type, template_content, parameters, validation_rules, 
       usage_count, success_rate, source_pattern, source_kb_entries, created_by, created_at, 
       updated_at, tags, complexity_score, maintainability_score, examples)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.adapter.executeSQL(sql, [
      template.id,
      template.name,
      template.description,
      template.category,
      template.type,
      template.template_content,
      JSON.stringify(template.parameters),
      JSON.stringify(template.validation_rules),
      template.usage_count,
      template.success_rate,
      template.source_pattern,
      JSON.stringify(template.source_kb_entries),
      template.created_by,
      template.created_at.toISOString(),
      template.updated_at.toISOString(),
      JSON.stringify(template.tags),
      template.complexity_score,
      template.maintainability_score,
      JSON.stringify(template.examples),
    ]);
  }
  async persistTemplates() {
    for (const template of this.templates.values()) {
      await this.persistTemplate(template);
    }
  }
  async loadBuiltInTemplates() {
    const builtInTemplates = [
      {
        name: 'Basic COBOL Program',
        description: 'Basic COBOL program structure template',
        category: 'utility',
        type: 'cobol',
        template_content: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. {{PROGRAM_NAME}}.
       
       ENVIRONMENT DIVISION.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-{{VARIABLE_NAME}}     PIC X({{LENGTH}}).
       
       PROCEDURE DIVISION.
       MAIN-LOGIC.
           DISPLAY "{{MESSAGE}}"
           STOP RUN.`,
        parameters: [
          { name: 'PROGRAM_NAME', type: 'string', description: 'Program name', required: true },
          { name: 'VARIABLE_NAME', type: 'string', description: 'Variable name', required: true },
          {
            name: 'LENGTH',
            type: 'number',
            description: 'Variable length',
            required: true,
            default_value: 10,
          },
          {
            name: 'MESSAGE',
            type: 'string',
            description: 'Display message',
            required: false,
            default_value: 'Hello World',
          },
        ],
        created_by: 'system',
        tags: ['basic', 'cobol', 'structure'],
      },
    ];
    for (const templateData of builtInTemplates) {
      try {
        await this.createTemplate(templateData);
      } catch (error) {
        this.log('warn', 'Failed to create built-in template', {
          name: templateData.name,
          error: error.message,
        });
      }
    }
  }
  async extractPatternsFromKB() {
    const successfulEntries = await this.adapter.executeSQL(
      `
      SELECT * FROM kb_entries 
      WHERE success_count > ? AND (success_count * 1.0 / (success_count + failure_count)) > 0.8
      ORDER BY usage_count DESC
      LIMIT 10
    `,
      [this.config.library.min_usage_for_template]
    );
    for (const entry of successfulEntries) {
      try {
        await this.extractTemplateFromKB(entry.id);
        this.log('info', 'Extracted template from KB', { entry: entry.title });
      } catch (error) {
        this.log('warn', 'Failed to extract template', {
          entry: entry.title,
          error: error.message,
        });
      }
    }
  }
  async getTemplate(templateId) {
    return this.templates.get(templateId) || null;
  }
  async listTemplates(filters) {
    let templates = Array.from(this.templates.values());
    if (filters) {
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category);
      }
      if (filters.type) {
        templates = templates.filter(t => t.type === filters.type);
      }
      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter(t => filters.tags.some(tag => t.tags.includes(tag)));
      }
    }
    const categories = this.calculateCategories(templates);
    const mostUsed = templates.sort((a, b) => b.usage_count - a.usage_count).slice(0, 10);
    const recentAdditions = templates
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5);
    return {
      templates,
      categories,
      total_count: templates.length,
      most_used: mostUsed,
      recent_additions: recentAdditions,
      success_metrics: this.calculateLibraryMetrics(templates),
    };
  }
  calculateCategories(templates) {
    const categoryMap = new Map();
    for (const template of templates) {
      const existing = categoryMap.get(template.category) || { count: 0, totalSuccess: 0 };
      existing.count++;
      existing.totalSuccess += template.success_rate;
      categoryMap.set(template.category, existing);
    }
    const totalTemplates = templates.length;
    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      description: this.getCategoryDescription(name),
      template_count: data.count,
      usage_percentage: totalTemplates > 0 ? (data.count / totalTemplates) * 100 : 0,
      average_success_rate: data.count > 0 ? data.totalSuccess / data.count : 0,
    }));
  }
  getCategoryDescription(category) {
    const descriptions = {
      'error-handling': 'Templates for handling errors and exceptions',
      'data-validation': 'Templates for validating and processing data',
      'file-operations': 'Templates for file I/O operations',
      calculations: 'Templates for mathematical calculations',
      reports: 'Templates for generating reports',
      utility: 'General utility templates',
      custom: 'Custom user-defined templates',
    };
    return descriptions[category] || 'Templates in this category';
  }
  calculateLibraryMetrics(templates) {
    const totalGenerations = templates.reduce((sum, t) => sum + t.usage_count, 0);
    const avgSuccessRate =
      templates.length > 0
        ? templates.reduce((sum, t) => sum + t.success_rate, 0) / templates.length
        : 0;
    const categoryUsage = new Map();
    templates.forEach(t => {
      categoryUsage.set(t.category, (categoryUsage.get(t.category) || 0) + t.usage_count);
    });
    const mostPopularCategory =
      Array.from(categoryUsage.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
    return {
      total_generations: totalGenerations,
      average_success_rate: avgSuccessRate,
      most_popular_category: mostPopularCategory,
      total_time_saved_hours: totalGenerations * 0.5,
      error_reduction_percentage: Math.min(90, avgSuccessRate * 0.8),
    };
  }
  async updateTemplate(templateId, updates) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    Object.assign(template, updates, { updated_at: new Date() });
    const validation = await this.validateTemplateContent(template);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }
    await this.persistTemplate(template);
    this.emit('template-updated', { template });
    return template;
  }
  async deleteTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }
    this.templates.delete(templateId);
    await this.adapter.executeSQL('DELETE FROM code_templates WHERE id = ?', [templateId]);
    await this.adapter.executeSQL('DELETE FROM template_generations WHERE template_id = ?', [
      templateId,
    ]);
    this.emit('template-deleted', { templateId, name: template.name });
    return true;
  }
  async validateTemplate(templateId, parameters) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return this.validateParameters(template, parameters);
  }
  async getTemplateLibrary() {
    return await this.listTemplates();
  }
  async optimizeTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    const generations = await this.adapter.executeSQL(
      'SELECT * FROM template_generations WHERE template_id = ? ORDER BY created_at DESC LIMIT 100',
      [templateId]
    );
    if (generations.length > 10) {
      const successRate = generations.filter(g => g.success).length / generations.length;
      template.success_rate = successRate * 100;
      if (successRate > 0.9) {
        template.maintainability_score = Math.min(100, template.maintainability_score + 5);
      }
      await this.persistTemplate(template);
    }
    this.emit('template-optimized', { template });
    return template;
  }
}
exports.TemplateEnginePlugin = TemplateEnginePlugin;
//# sourceMappingURL=TemplateEnginePlugin.js.map
