/**
 * Internationalization support for validation messages
 * 
 * Provides localized validation messages with:
 * - Multiple language support
 * - Message templating with parameters
 * - Context-aware message selection
 * - Fallback to default language
 * - Dynamic message loading
 */

/**
 * Message template interface
 */
export interface MessageTemplate {
  key: string;
  message: string;
  description?: string;
  context?: string;
  placeholders?: string[];
}

/**
 * Language pack interface
 */
export interface LanguagePack {
  locale: string;
  name: string;
  messages: Record<string, MessageTemplate>;
  dateFormat?: string;
  numberFormat?: string;
}

/**
 * I18n configuration
 */
export interface I18nConfig {
  defaultLocale: string;
  fallbackLocale: string;
  supportedLocales: string[];
  loadFromFiles?: boolean;
  messagesDir?: string;
}

/**
 * Validation message internationalization manager
 */
export class ValidationI18n {
  private languagePacks: Map<string, LanguagePack> = new Map();
  private currentLocale: string;
  private fallbackLocale: string;
  private config: I18nConfig;

  constructor(config: I18nConfig) {
    this.config = config;
    this.currentLocale = config.defaultLocale;
    this.fallbackLocale = config.fallbackLocale;
    
    this.initializeDefaultMessages();
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (!this.config.supportedLocales.includes(locale)) {
      console.warn(`Locale '${locale}' not supported. Falling back to ${this.fallbackLocale}`);
      locale = this.fallbackLocale;
    }
    
    this.currentLocale = locale;
  }

  /**
   * Get localized message
   */
  getMessage(
    key: string, 
    params?: Record<string, any>, 
    locale?: string
  ): string {
    const targetLocale = locale || this.currentLocale;
    
    // Try to get message from target locale
    let message = this.getMessageFromPack(key, targetLocale);
    
    // Fallback to fallback locale if not found
    if (!message && targetLocale !== this.fallbackLocale) {
      message = this.getMessageFromPack(key, this.fallbackLocale);
    }
    
    // Fallback to key if still not found
    if (!message) {
      console.warn(`Message not found for key: ${key}`);
      return key;
    }

    // Apply parameters if provided
    return this.interpolateMessage(message.message, params);
  }

  /**
   * Get message with context
   */
  getMessageWithContext(
    key: string, 
    context: string, 
    params?: Record<string, any>, 
    locale?: string
  ): string {
    const contextKey = `${key}.${context}`;
    
    // Try context-specific message first
    const contextMessage = this.getMessageFromPack(contextKey, locale || this.currentLocale);
    if (contextMessage) {
      return this.interpolateMessage(contextMessage.message, params);
    }
    
    // Fallback to general message
    return this.getMessage(key, params, locale);
  }

  /**
   * Register a language pack
   */
  registerLanguagePack(pack: LanguagePack): void {
    this.languagePacks.set(pack.locale, pack);
  }

  /**
   * Load language pack from file/URL
   */
  async loadLanguagePack(locale: string, source?: string): Promise<void> {
    try {
      if (source) {
        // Load from external source
        const response = await fetch(source);
        const pack: LanguagePack = await response.json();
        this.registerLanguagePack(pack);
      } else if (this.config.loadFromFiles && this.config.messagesDir) {
        // Load from file system (Node.js environment)
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const filePath = path.join(this.config.messagesDir, `${locale}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        const pack: LanguagePack = JSON.parse(content);
        this.registerLanguagePack(pack);
      }
    } catch (error) {
      console.error(`Failed to load language pack for ${locale}:`, error);
    }
  }

  /**
   * Get all available locales
   */
  getAvailableLocales(): string[] {
    return Array.from(this.languagePacks.keys());
  }

  /**
   * Get current locale info
   */
  getCurrentLocale(): { locale: string; name: string } {
    const pack = this.languagePacks.get(this.currentLocale);
    return {
      locale: this.currentLocale,
      name: pack?.name || this.currentLocale
    };
  }

  /**
   * Check if message exists
   */
  hasMessage(key: string, locale?: string): boolean {
    const targetLocale = locale || this.currentLocale;
    const pack = this.languagePacks.get(targetLocale);
    return pack ? key in pack.messages : false;
  }

  /**
   * Get message template info (for tooling/debugging)
   */
  getMessageTemplate(key: string, locale?: string): MessageTemplate | null {
    const targetLocale = locale || this.currentLocale;
    return this.getMessageFromPack(key, targetLocale);
  }

  /**
   * Format number according to locale
   */
  formatNumber(value: number, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    try {
      return new Intl.NumberFormat(targetLocale).format(value);
    } catch {
      return value.toString();
    }
  }

  /**
   * Format date according to locale
   */
  formatDate(date: Date, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    try {
      return new Intl.DateTimeFormat(targetLocale).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }

  /**
   * Private methods
   */

  private getMessageFromPack(key: string, locale: string): MessageTemplate | null {
    const pack = this.languagePacks.get(locale);
    return pack?.messages[key] || null;
  }

  private interpolateMessage(template: string, params?: Record<string, any>): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      if (key in params) {
        const value = params[key];
        
        // Format numbers and dates based on locale
        if (typeof value === 'number') {
          return this.formatNumber(value);
        } else if (value instanceof Date) {
          return this.formatDate(value);
        } else {
          return String(value);
        }
      }
      return match; // Keep placeholder if no value provided
    });
  }

  /**
   * Initialize default English messages
   */
  private initializeDefaultMessages(): void {
    const englishPack: LanguagePack = {
      locale: 'en',
      name: 'English',
      messages: {
        // Generic validation messages
        'REQUIRED': {
          key: 'REQUIRED',
          message: 'This field is required',
          description: 'Field is mandatory'
        },
        'REQUIRED_FIELD': {
          key: 'REQUIRED_FIELD',
          message: '{field} is required',
          description: 'Specific field is mandatory',
          placeholders: ['field']
        },
        'LENGTH': {
          key: 'LENGTH',
          message: 'Must be between {min} and {max} characters (current: {current})',
          description: 'String length validation',
          placeholders: ['min', 'max', 'current']
        },
        'MIN_LENGTH': {
          key: 'MIN_LENGTH',
          message: 'Must be at least {min} characters (current: {current})',
          description: 'Minimum string length',
          placeholders: ['min', 'current']
        },
        'MAX_LENGTH': {
          key: 'MAX_LENGTH',
          message: 'Must not exceed {max} characters (current: {current})',
          description: 'Maximum string length',
          placeholders: ['max', 'current']
        },
        'PATTERN': {
          key: 'PATTERN',
          message: 'Invalid format',
          description: 'Pattern matching validation'
        },
        'INVALID_ENUM': {
          key: 'INVALID_ENUM',
          message: 'Must be one of: {validValues}',
          description: 'Enum validation',
          placeholders: ['validValues']
        },
        'INVALID_TYPE': {
          key: 'INVALID_TYPE',
          message: 'Expected {expectedType}, got {actualType}',
          description: 'Type validation',
          placeholders: ['expectedType', 'actualType']
        },

        // KB-specific validation messages
        'TITLE_DESCRIPTIVE': {
          key: 'TITLE_DESCRIPTIVE',
          message: 'Title should include descriptive keywords like "error", "status", or "issue"',
          description: 'Title quality suggestion'
        },
        'SOLUTION_RELEVANCE': {
          key: 'SOLUTION_RELEVANCE',
          message: 'Solution might not be relevant to the problem. Consider including keywords: {keywords}',
          description: 'Solution-problem relevance warning',
          placeholders: ['keywords']
        },
        'MISSING_CATEGORY_TAG': {
          key: 'MISSING_CATEGORY_TAG',
          message: 'Consider adding "{category}" as a tag to match the category',
          description: 'Category-tag consistency suggestion',
          placeholders: ['category']
        },
        'UNSTRUCTURED_SOLUTION': {
          key: 'UNSTRUCTURED_SOLUTION',
          message: 'Consider formatting solution as numbered steps for clarity',
          description: 'Solution formatting suggestion'
        },
        'NO_VERIFICATION': {
          key: 'NO_VERIFICATION',
          message: 'Consider including verification steps to confirm the solution worked',
          description: 'Solution completeness suggestion'
        },
        'NO_MAINFRAME_TERMS': {
          key: 'NO_MAINFRAME_TERMS',
          message: 'Consider including specific mainframe terms (JCL, VSAM, error codes) for better categorization',
          description: 'Mainframe terminology suggestion'
        },
        'LACKS_CONTEXT': {
          key: 'LACKS_CONTEXT',
          message: 'Consider adding context about when/where the problem occurs',
          description: 'Problem context suggestion'
        },
        'NO_ERROR_CODE': {
          key: 'NO_ERROR_CODE',
          message: 'Consider including error codes (S0C7, IEF212I, SQLCODE, etc.) for better searchability',
          description: 'Error code suggestion'
        },
        'DUPLICATE_TAGS': {
          key: 'DUPLICATE_TAGS',
          message: 'Tags must be unique (case insensitive)',
          description: 'Tag uniqueness validation'
        },
        'INVALID_TAG_FORMAT': {
          key: 'INVALID_TAG_FORMAT',
          message: 'Tag "{tag}" contains invalid characters. Use only letters, numbers, hyphens, and underscores',
          description: 'Tag format validation',
          placeholders: ['tag']
        },
        'TAG_TOO_SHORT': {
          key: 'TAG_TOO_SHORT',
          message: 'Tag "{tag}" is too short (minimum 2 characters)',
          description: 'Tag minimum length',
          placeholders: ['tag']
        },
        'TAG_TOO_LONG': {
          key: 'TAG_TOO_LONG',
          message: 'Tag "{tag}" is too long (maximum 30 characters)',
          description: 'Tag maximum length',
          placeholders: ['tag']
        },
        'TAG_CASE': {
          key: 'TAG_CASE',
          message: 'Tag "{tag}" should be lowercase for consistency',
          description: 'Tag case suggestion',
          placeholders: ['tag']
        },
        'INVALID_CATEGORY': {
          key: 'INVALID_CATEGORY',
          message: 'Invalid category "{category}". Valid categories: {validCategories}',
          description: 'Category validation',
          placeholders: ['category', 'validCategories']
        },
        'INVALID_SEVERITY': {
          key: 'INVALID_SEVERITY',
          message: 'Severity must be one of: critical, high, medium, low',
          description: 'Severity validation'
        },

        // Array validation messages
        'NOT_ARRAY': {
          key: 'NOT_ARRAY',
          message: 'Must be an array',
          description: 'Array type validation'
        },
        'ARRAY_LENGTH': {
          key: 'ARRAY_LENGTH',
          message: 'Array must have between {min} and {max} items (current: {current})',
          description: 'Array length validation',
          placeholders: ['min', 'max', 'current']
        },
        'DUPLICATE_VALUES': {
          key: 'DUPLICATE_VALUES',
          message: 'Duplicate values found: {duplicates}',
          description: 'Array uniqueness validation',
          placeholders: ['duplicates']
        },

        // Async validation messages
        'NOT_UNIQUE': {
          key: 'NOT_UNIQUE',
          message: '"{value}" already exists',
          description: 'Uniqueness validation',
          placeholders: ['value']
        },
        'VALIDATION_ERROR': {
          key: 'VALIDATION_ERROR',
          message: 'Validation failed: {error}',
          description: 'Generic validation error',
          placeholders: ['error']
        },

        // Real-time validation messages
        'AI_QUALITY_LOW': {
          key: 'AI_QUALITY_LOW',
          message: 'Content quality could be improved (score: {score}%)',
          description: 'AI quality assessment',
          placeholders: ['score']
        },
        'AI_CHECK_FAILED': {
          key: 'AI_CHECK_FAILED',
          message: 'AI quality check unavailable',
          description: 'AI service unavailable'
        },

        // Form validation messages
        'FORM_INVALID': {
          key: 'FORM_INVALID',
          message: 'Please fix the errors below before submitting',
          description: 'Form validation summary'
        },
        'FORM_VALIDATING': {
          key: 'FORM_VALIDATING',
          message: 'Validating form...',
          description: 'Form validation in progress'
        }
      }
    };

    this.registerLanguagePack(englishPack);

    // Initialize Portuguese language pack
    this.initializePortugueseMessages();
    
    // Initialize Spanish language pack
    this.initializeSpanishMessages();
  }

  /**
   * Initialize Portuguese messages
   */
  private initializePortugueseMessages(): void {
    const portuguesePack: LanguagePack = {
      locale: 'pt',
      name: 'Português',
      messages: {
        'REQUIRED': {
          key: 'REQUIRED',
          message: 'Este campo é obrigatório',
          description: 'Campo obrigatório'
        },
        'REQUIRED_FIELD': {
          key: 'REQUIRED_FIELD',
          message: '{field} é obrigatório',
          description: 'Campo específico obrigatório',
          placeholders: ['field']
        },
        'LENGTH': {
          key: 'LENGTH',
          message: 'Deve ter entre {min} e {max} caracteres (atual: {current})',
          description: 'Validação de comprimento',
          placeholders: ['min', 'max', 'current']
        },
        'MIN_LENGTH': {
          key: 'MIN_LENGTH',
          message: 'Deve ter pelo menos {min} caracteres (atual: {current})',
          description: 'Comprimento mínimo',
          placeholders: ['min', 'current']
        },
        'MAX_LENGTH': {
          key: 'MAX_LENGTH',
          message: 'Não deve exceder {max} caracteres (atual: {current})',
          description: 'Comprimento máximo',
          placeholders: ['max', 'current']
        },
        'INVALID_ENUM': {
          key: 'INVALID_ENUM',
          message: 'Deve ser um de: {validValues}',
          description: 'Validação de enum',
          placeholders: ['validValues']
        },
        'TITLE_DESCRIPTIVE': {
          key: 'TITLE_DESCRIPTIVE',
          message: 'O título deve incluir palavras descritivas como "erro", "status" ou "problema"',
          description: 'Sugestão de qualidade do título'
        },
        'SOLUTION_RELEVANCE': {
          key: 'SOLUTION_RELEVANCE',
          message: 'A solução pode não ser relevante para o problema. Considere incluir palavras-chave: {keywords}',
          description: 'Aviso de relevância da solução',
          placeholders: ['keywords']
        },
        'UNSTRUCTURED_SOLUTION': {
          key: 'UNSTRUCTURED_SOLUTION',
          message: 'Considere formatar a solução como etapas numeradas para clareza',
          description: 'Sugestão de formatação da solução'
        },
        'FORM_INVALID': {
          key: 'FORM_INVALID',
          message: 'Por favor, corrija os erros abaixo antes de submeter',
          description: 'Resumo de validação do formulário'
        }
      }
    };

    this.registerLanguagePack(portuguesePack);
  }

  /**
   * Initialize Spanish messages
   */
  private initializeSpanishMessages(): void {
    const spanishPack: LanguagePack = {
      locale: 'es',
      name: 'Español',
      messages: {
        'REQUIRED': {
          key: 'REQUIRED',
          message: 'Este campo es obligatorio',
          description: 'Campo obligatorio'
        },
        'REQUIRED_FIELD': {
          key: 'REQUIRED_FIELD',
          message: '{field} es obligatorio',
          description: 'Campo específico obligatorio',
          placeholders: ['field']
        },
        'LENGTH': {
          key: 'LENGTH',
          message: 'Debe tener entre {min} y {max} caracteres (actual: {current})',
          description: 'Validación de longitud',
          placeholders: ['min', 'max', 'current']
        },
        'MIN_LENGTH': {
          key: 'MIN_LENGTH',
          message: 'Debe tener al menos {min} caracteres (actual: {current})',
          description: 'Longitud mínima',
          placeholders: ['min', 'current']
        },
        'MAX_LENGTH': {
          key: 'MAX_LENGTH',
          message: 'No debe exceder {max} caracteres (actual: {current})',
          description: 'Longitud máxima',
          placeholders: ['max', 'current']
        },
        'INVALID_ENUM': {
          key: 'INVALID_ENUM',
          message: 'Debe ser uno de: {validValues}',
          description: 'Validación de enum',
          placeholders: ['validValues']
        },
        'TITLE_DESCRIPTIVE': {
          key: 'TITLE_DESCRIPTIVE',
          message: 'El título debería incluir palabras descriptivas como "error", "estado" o "problema"',
          description: 'Sugerencia de calidad del título'
        },
        'SOLUTION_RELEVANCE': {
          key: 'SOLUTION_RELEVANCE',
          message: 'La solución podría no ser relevante para el problema. Considere incluir palabras clave: {keywords}',
          description: 'Advertencia de relevancia de la solución',
          placeholders: ['keywords']
        },
        'UNSTRUCTURED_SOLUTION': {
          key: 'UNSTRUCTURED_SOLUTION',
          message: 'Considere formatear la solución como pasos numerados para mayor claridad',
          description: 'Sugerencia de formato de solución'
        },
        'FORM_INVALID': {
          key: 'FORM_INVALID',
          message: 'Por favor, corrija los errores a continuación antes de enviar',
          description: 'Resumen de validación del formulario'
        }
      }
    };

    this.registerLanguagePack(spanishPack);
  }
}

/**
 * Default validation i18n configuration
 */
export const defaultI18nConfig: I18nConfig = {
  defaultLocale: 'en',
  fallbackLocale: 'en',
  supportedLocales: ['en', 'pt', 'es'],
  loadFromFiles: false
};

/**
 * Global validation i18n instance
 */
export const validationI18n = new ValidationI18n(defaultI18nConfig);

/**
 * Helper function to get localized validation message
 */
export function getValidationMessage(
  key: string,
  params?: Record<string, any>,
  locale?: string
): string {
  return validationI18n.getMessage(key, params, locale);
}

/**
 * Helper function to get localized message with context
 */
export function getContextualValidationMessage(
  key: string,
  context: string,
  params?: Record<string, any>,
  locale?: string
): string {
  return validationI18n.getMessageWithContext(key, context, params, locale);
}

/**
 * Decorator for validation rules to add i18n support
 */
export function withI18n<T>(
  messageKey: string,
  defaultMessage: string
): (rule: any) => any {
  return function(rule: any) {
    return {
      ...rule,
      errorMessage: (value: T, context?: any) => {
        return getValidationMessage(messageKey, { value, ...context }, undefined) || defaultMessage;
      }
    };
  };
}

/**
 * React hook for validation i18n (if using React)
 */
export function useValidationI18n() {
  return {
    getMessage: getValidationMessage,
    getContextualMessage: getContextualValidationMessage,
    setLocale: (locale: string) => validationI18n.setLocale(locale),
    getCurrentLocale: () => validationI18n.getCurrentLocale(),
    getAvailableLocales: () => validationI18n.getAvailableLocales()
  };
}