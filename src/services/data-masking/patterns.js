/**
 * Comprehensive regex patterns for Brazilian banking sensitive data detection
 * Covers all major data types with validation and context awareness
 */

const patterns = {
  // Brazilian CPF - 000.000.000-00 or 00000000000
  cpf: {
    regex: '(?:\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}|\\d{11})(?=\\s|$|[^\\d])',
    flags: 'g',
    description: 'Brazilian CPF (Individual Taxpayer Registry)',
    sensitivity: 'high',
    validator: (value) => {
      const cpf = value.replace(/[^\d]/g, '');
      if (cpf.length !== 11) return false;

      // Check if all digits are the same
      if (/^(\d)\1{10}$/.test(cpf)) return false;

      // Validate check digits
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf[i]) * (10 - i);
      }
      let digit1 = 11 - (sum % 11);
      if (digit1 > 9) digit1 = 0;

      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf[i]) * (11 - i);
      }
      let digit2 = 11 - (sum % 11);
      if (digit2 > 9) digit2 = 0;

      return digit1 === parseInt(cpf[9]) && digit2 === parseInt(cpf[10]);
    }
  },

  // Brazilian CNPJ - 00.000.000/0000-00 or 00000000000000
  cnpj: {
    regex: '(?:\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}|\\d{14})(?=\\s|$|[^\\d])',
    flags: 'g',
    description: 'Brazilian CNPJ (Corporate Taxpayer Registry)',
    sensitivity: 'high',
    validator: (value) => {
      const cnpj = value.replace(/[^\d]/g, '');
      if (cnpj.length !== 14) return false;

      // Check if all digits are the same
      if (/^(\d)\1{13}$/.test(cnpj)) return false;

      // Validate check digits (simplified validation)
      return true; // Full CNPJ validation can be added here
    }
  },

  // Bank account numbers - various formats
  bankAccount: {
    regex: '(?:conta[:\\s]*|account[:\\s]*|c/c[:\\s]*)?(?:\\d{1,6}[-.]?\\d{1,2})(?=\\s|$|[^\\d])',
    flags: 'gi',
    description: 'Bank account numbers',
    sensitivity: 'high',
    contextWords: ['conta', 'account', 'c/c', 'agencia']
  },

  // Credit/Debit card numbers - 16 digits with optional formatting
  creditCard: {
    regex: '(?:\\d{4}[\\s-]?){3}\\d{4}|\\d{16}',
    flags: 'g',
    description: 'Credit/Debit card numbers',
    sensitivity: 'critical',
    validator: (value) => {
      const card = value.replace(/[^\d]/g, '');
      if (card.length !== 16) return false;

      // Luhn algorithm validation
      let sum = 0;
      let isEven = false;

      for (let i = card.length - 1; i >= 0; i--) {
        let digit = parseInt(card[i]);

        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
        isEven = !isEven;
      }

      return sum % 10 === 0;
    }
  },

  // CVV/CVC codes
  cvv: {
    regex: '(?:cvv[:\\s]*|cvc[:\\s]*|codigo[:\\s]*)?\\d{3,4}(?=\\s|$|[^\\d])',
    flags: 'gi',
    description: 'CVV/CVC security codes',
    sensitivity: 'critical',
    contextWords: ['cvv', 'cvc', 'codigo', 'seguranca']
  },

  // PIX keys - various formats
  pixKey: {
    regex: '(?:pix[:\\s]*)?(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}|\\+55\\d{10,11}|\\d{11}|\\d{14}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})',
    flags: 'gi',
    description: 'PIX payment keys (email, phone, CPF, CNPJ, random)',
    sensitivity: 'high',
    contextWords: ['pix', 'chave']
  },

  // Passwords and tokens
  password: {
    regex: '(?:senha[:\\s]*|password[:\\s]*|pass[:\\s]*|pwd[:\\s]*)[^\\s]{6,}',
    flags: 'gi',
    description: 'Passwords and authentication tokens',
    sensitivity: 'critical',
    contextWords: ['senha', 'password', 'pass', 'pwd', 'token']
  },

  // API Keys and tokens
  apiKey: {
    regex: '(?:api[_\\s]*key[:\\s]*|token[:\\s]*|bearer[:\\s]*)[a-zA-Z0-9._-]{20,}',
    flags: 'gi',
    description: 'API keys and bearer tokens',
    sensitivity: 'critical',
    contextWords: ['api', 'key', 'token', 'bearer', 'authorization']
  },

  // Brazilian mobile phone numbers
  mobilePhone: {
    regex: '(?:\\+55[\\s-]?)?(?:\\(?\\d{2}\\)?[\\s-]?)?9\\d{4}[\\s-]?\\d{4}',
    flags: 'g',
    description: 'Brazilian mobile phone numbers',
    sensitivity: 'medium',
    contextWords: ['telefone', 'celular', 'phone', 'mobile']
  },

  // Brazilian landline phone numbers
  landlinePhone: {
    regex: '(?:\\+55[\\s-]?)?(?:\\(?\\d{2}\\)?[\\s-]?)?[2-5]\\d{3}[\\s-]?\\d{4}',
    flags: 'g',
    description: 'Brazilian landline phone numbers',
    sensitivity: 'medium',
    contextWords: ['telefone', 'phone', 'fone']
  },

  // Email addresses
  email: {
    regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    flags: 'g',
    description: 'Email addresses',
    sensitivity: 'medium',
    contextWords: ['email', 'e-mail', 'correio']
  },

  // Full names (Brazilian patterns)
  fullName: {
    regex: '(?:nome[:\\s]*|name[:\\s]*)?[A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,4}',
    flags: 'g',
    description: 'Full names with Brazilian characters',
    sensitivity: 'high',
    contextWords: ['nome', 'name', 'cliente', 'titular'],
    validator: (value) => {
      const name = value.trim();
      return name.split(' ').length >= 2 && name.length >= 5;
    }
  },

  // Brazilian addresses
  address: {
    regex: '(?:endereco[:\\s]*|address[:\\s]*)?(?:rua|av|avenida|travessa|praca)\\s+[^,\\n]{10,}(?:,\\s*\\d+)?',
    flags: 'gi',
    description: 'Brazilian street addresses',
    sensitivity: 'medium',
    contextWords: ['endereco', 'address', 'rua', 'avenida', 'praca']
  },

  // Brazilian ZIP codes (CEP)
  zipCode: {
    regex: '\\d{5}-?\\d{3}',
    flags: 'g',
    description: 'Brazilian ZIP codes (CEP)',
    sensitivity: 'low',
    contextWords: ['cep', 'zip', 'codigo']
  },

  // Monetary values in Brazilian Real
  monetaryAmount: {
    regex: 'R\\$\\s*\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?|\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?\\s*reais?',
    flags: 'gi',
    description: 'Brazilian Real monetary amounts',
    sensitivity: 'medium',
    contextWords: ['valor', 'preco', 'real', 'reais', 'dinheiro']
  },

  // Social Security numbers (for international context)
  ssn: {
    regex: '\\d{3}-\\d{2}-\\d{4}',
    flags: 'g',
    description: 'US Social Security Numbers',
    sensitivity: 'critical',
    contextWords: ['ssn', 'social', 'security']
  },

  // IP Addresses
  ipAddress: {
    regex: '(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)',
    flags: 'g',
    description: 'IP addresses',
    sensitivity: 'low',
    contextWords: ['ip', 'address', 'servidor']
  },

  // URLs with sensitive parameters
  sensitiveUrl: {
    regex: 'https?://[^\\s]+(?:token|key|password|senha|auth)=[^\\s&]+',
    flags: 'gi',
    description: 'URLs containing sensitive parameters',
    sensitivity: 'high',
    contextWords: ['url', 'link', 'endpoint']
  },

  // Database connection strings
  connectionString: {
    regex: '(?:mongodb|mysql|postgres|oracle)://[^\\s]+:[^\\s]+@[^\\s]+',
    flags: 'gi',
    description: 'Database connection strings with credentials',
    sensitivity: 'critical',
    contextWords: ['connection', 'database', 'db', 'mongo', 'mysql']
  },

  // Brazilian RG (Identity Document)
  rg: {
    regex: '\\d{1,2}\\.\\d{3}\\.\\d{3}-[\\dX]|\\d{7,9}',
    flags: 'g',
    description: 'Brazilian RG (Identity Document)',
    sensitivity: 'high',
    contextWords: ['rg', 'identidade', 'identity']
  },

  // Brazilian passport
  passport: {
    regex: '[A-Z]{2}\\d{6}|\\d{8,9}',
    flags: 'g',
    description: 'Brazilian passport numbers',
    sensitivity: 'high',
    contextWords: ['passaporte', 'passport']
  },

  // Vehicle license plates (Brazilian format)
  licensePlate: {
    regex: '[A-Z]{3}-?\\d{4}|[A-Z]{3}\\d[A-Z]\\d{2}',
    flags: 'g',
    description: 'Brazilian vehicle license plates',
    sensitivity: 'medium',
    contextWords: ['placa', 'veiculo', 'carro']
  }
};

/**
 * Get patterns by sensitivity level
 */
const getPatternsBySensitivity = (level) => {
  return Object.entries(patterns)
    .filter(([_, pattern]) => pattern.sensitivity === level)
    .reduce((acc, [key, pattern]) => {
      acc[key] = pattern;
      return acc;
    }, {});
};

/**
 * Get patterns by context words
 */
const getPatternsWithContext = (text) => {
  const relevantPatterns = {};
  const lowerText = text.toLowerCase();

  for (const [key, pattern] of Object.entries(patterns)) {
    if (pattern.contextWords) {
      const hasContext = pattern.contextWords.some(word =>
        lowerText.includes(word.toLowerCase())
      );

      if (hasContext) {
        relevantPatterns[key] = pattern;
      }
    } else {
      // Include patterns without context requirements
      relevantPatterns[key] = pattern;
    }
  }

  return relevantPatterns;
};

/**
 * Validate detected data using pattern validators
 */
const validateDetection = (value, patternKey) => {
  const pattern = patterns[patternKey];
  if (!pattern || !pattern.validator) {
    return true; // No validator, assume valid
  }

  try {
    return pattern.validator(value);
  } catch (error) {
    console.warn(`Validation error for ${patternKey}:`, error.message);
    return false;
  }
};

/**
 * Get pattern statistics
 */
const getPatternStats = () => {
  const stats = {
    total: Object.keys(patterns).length,
    bySensitivity: {},
    withValidators: 0,
    withContext: 0
  };

  for (const pattern of Object.values(patterns)) {
    // Count by sensitivity
    stats.bySensitivity[pattern.sensitivity] =
      (stats.bySensitivity[pattern.sensitivity] || 0) + 1;

    // Count validators
    if (pattern.validator) {
      stats.withValidators++;
    }

    // Count context-aware patterns
    if (pattern.contextWords) {
      stats.withContext++;
    }
  }

  return stats;
};

module.exports = {
  patterns,
  getPatternsBySensitivity,
  getPatternsWithContext,
  validateDetection,
  getPatternStats
};