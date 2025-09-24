const crypto = require('crypto');
const { patterns } = require('./patterns');
const policies = require('./policies.json');
const EventEmitter = require('events');

/**
 * Comprehensive Data Masking Service for Banking Information
 * Provides reversible and irreversible masking with LGPD compliance
 */
class MaskingService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      enableAuditLog: options.enableAuditLog || true,
      defaultPolicy: options.defaultPolicy || 'strict',
      encryptionKey: options.encryptionKey || process.env.MASKING_ENCRYPTION_KEY,
      tokenSalt: options.tokenSalt || process.env.MASKING_TOKEN_SALT,
      ...options
    };

    this.tokenMap = new Map(); // For reversible masking
    this.auditLog = [];
    this.maskingStats = {
      totalProcessed: 0,
      sensitiveDataFound: 0,
      maskingOperations: 0,
      reversibleMasks: 0,
      irreversibleMasks: 0
    };

    if (!this.config.encryptionKey) {
      throw new Error('Encryption key is required for data masking');
    }
  }

  /**
   * Main masking method - processes text and applies appropriate masking
   */
  async maskSensitiveData(text, context = {}) {
    try {
      const { area = 'general', severity = 'medium', userRole = 'operator' } = context;
      const policy = this.getPolicyForContext(area, severity, userRole);

      let maskedText = text;
      const detectedData = [];

      // Process each data type with appropriate masking strategy
      for (const [dataType, pattern] of Object.entries(patterns)) {
        const matches = this.findMatches(maskedText, pattern);

        for (const match of matches) {
          const maskingStrategy = policy.strategies[dataType] || policy.defaultStrategy;
          const maskedValue = await this.applyMaskingStrategy(match.value, maskingStrategy, dataType);

          maskedText = maskedText.replace(match.value, maskedValue);

          detectedData.push({
            type: dataType,
            original: match.value,
            masked: maskedValue,
            position: match.index,
            strategy: maskingStrategy,
            reversible: maskingStrategy.reversible || false
          });

          this.maskingStats.sensitiveDataFound++;
          this.maskingStats.maskingOperations++;

          if (maskingStrategy.reversible) {
            this.maskingStats.reversibleMasks++;
          } else {
            this.maskingStats.irreversibleMasks++;
          }
        }
      }

      // Audit logging
      if (this.config.enableAuditLog) {
        this.logMaskingOperation({
          originalLength: text.length,
          maskedLength: maskedText.length,
          detectedCount: detectedData.length,
          context,
          timestamp: new Date().toISOString(),
          policy: policy.name
        });
      }

      this.maskingStats.totalProcessed++;
      this.emit('maskingCompleted', { detectedData, context, stats: this.maskingStats });

      return {
        maskedText,
        detectedData,
        policy: policy.name,
        reversible: detectedData.some(d => d.reversible),
        stats: this.maskingStats
      };

    } catch (error) {
      this.emit('maskingError', { error, context, text: text.substring(0, 100) });
      throw new Error(`Masking failed: ${error.message}`);
    }
  }

  /**
   * Unmask previously masked data (only for reversible strategies)
   */
  async unmaskData(maskedText, tokenMap = null) {
    const mapToUse = tokenMap || this.tokenMap;
    let unmaskedText = maskedText;

    // Reverse tokenization
    for (const [token, original] of mapToUse.entries()) {
      unmaskedText = unmaskedText.replace(new RegExp(token, 'g'), original);
    }

    // Decrypt reversible hashes
    const encryptedMatches = unmaskedText.match(/\[ENCRYPTED:([A-Za-z0-9+/=]+)\]/g);
    if (encryptedMatches) {
      for (const match of encryptedMatches) {
        const encryptedData = match.match(/\[ENCRYPTED:([A-Za-z0-9+/=]+)\]/)[1];
        try {
          const decrypted = this.decrypt(encryptedData);
          unmaskedText = unmaskedText.replace(match, decrypted);
        } catch (error) {
          // Keep encrypted if decryption fails
          this.emit('decryptionError', { error, encryptedData: match });
        }
      }
    }

    return unmaskedText;
  }

  /**
   * Apply specific masking strategy to a value
   */
  async applyMaskingStrategy(value, strategy, dataType) {
    switch (strategy.type) {
      case 'tokenization':
        return this.tokenize(value, strategy);

      case 'encryption':
        return `[ENCRYPTED:${this.encrypt(value)}]`;

      case 'hashing':
        return this.hash(value, strategy);

      case 'partial':
        return this.partialMask(value, strategy);

      case 'format_preserving':
        return this.formatPreservingMask(value, strategy);

      case 'substitution':
        return this.substitute(value, strategy, dataType);

      case 'redaction':
        return strategy.replacement || '[REDACTED]';

      default:
        throw new Error(`Unknown masking strategy: ${strategy.type}`);
    }
  }

  /**
   * Tokenization - reversible masking with token mapping
   */
  tokenize(value, strategy) {
    const token = `TOKEN_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    this.tokenMap.set(token, value);
    return token;
  }

  /**
   * Encryption - reversible with key
   */
  encrypt(value) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decryption for reversible operations
   */
  decrypt(encryptedValue) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);

    const parts = encryptedValue.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hashing - irreversible but deterministic
   */
  hash(value, strategy) {
    const algorithm = strategy.algorithm || 'sha256';
    const salt = strategy.salt || this.config.tokenSalt;
    const hash = crypto.createHash(algorithm);
    hash.update(value + salt);
    const hashValue = hash.digest('hex');

    if (strategy.prefix) {
      return `${strategy.prefix}_${hashValue.substring(0, strategy.length || 8)}`;
    }

    return hashValue.substring(0, strategy.length || 16);
  }

  /**
   * Partial masking - show first/last characters
   */
  partialMask(value, strategy) {
    const { showFirst = 2, showLast = 2, maskChar = '*' } = strategy;

    if (value.length <= showFirst + showLast) {
      return maskChar.repeat(value.length);
    }

    const first = value.substring(0, showFirst);
    const last = value.substring(value.length - showLast);
    const middle = maskChar.repeat(value.length - showFirst - showLast);

    return first + middle + last;
  }

  /**
   * Format-preserving masking - maintain data format
   */
  formatPreservingMask(value, strategy) {
    let masked = '';

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      if (/\d/.test(char)) {
        masked += Math.floor(Math.random() * 10);
      } else if (/[A-Za-z]/.test(char)) {
        masked += char.toUpperCase() === char ?
          String.fromCharCode(65 + Math.floor(Math.random() * 26)) :
          String.fromCharCode(97 + Math.floor(Math.random() * 26));
      } else {
        masked += char; // Keep special characters
      }
    }

    return masked;
  }

  /**
   * Substitution with realistic fake data
   */
  substitute(value, strategy, dataType) {
    const substitutions = {
      cpf: () => this.generateFakeCPF(),
      cnpj: () => this.generateFakeCNPJ(),
      account: () => '00000-' + Math.floor(Math.random() * 10),
      card: () => '****-****-****-' + Math.floor(Math.random() * 9000 + 1000),
      name: () => 'João da Silva',
      email: () => 'usuario@exemplo.com.br',
      phone: () => '(11) 99999-9999',
      amount: () => 'R$ XXX,XX'
    };

    return substitutions[dataType] ? substitutions[dataType]() : '[SUBSTITUÍDO]';
  }

  /**
   * Generate fake but valid-format CPF
   */
  generateFakeCPF() {
    const digits = Array.from({length: 9}, () => Math.floor(Math.random() * 10));
    // Generate check digits (simplified)
    const d1 = (digits.reduce((sum, digit, i) => sum + digit * (10 - i), 0) * 10) % 11;
    const d2 = (digits.concat(d1).reduce((sum, digit, i) => sum + digit * (11 - i), 0) * 10) % 11;

    return digits.concat(d1, d2).join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Generate fake but valid-format CNPJ
   */
  generateFakeCNPJ() {
    const digits = Array.from({length: 12}, () => Math.floor(Math.random() * 10));
    // Simplified check digit generation
    return digits.concat(0, 1).join('').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  /**
   * Find pattern matches in text
   */
  findMatches(text, pattern) {
    const matches = [];
    let match;

    const regex = new RegExp(pattern.regex, pattern.flags || 'g');

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        value: match[0],
        index: match.index,
        groups: match.slice(1)
      });
    }

    return matches;
  }

  /**
   * Get masking policy based on context
   */
  getPolicyForContext(area, severity, userRole) {
    const policyKey = `${area}_${severity}_${userRole}`;

    // Try specific policy first
    if (policies[policyKey]) {
      return policies[policyKey];
    }

    // Fallback to area-based policy
    const areaPolicyKey = Object.keys(policies).find(key => key.startsWith(area));
    if (areaPolicyKey) {
      return policies[areaPolicyKey];
    }

    // Default policy
    return policies[this.config.defaultPolicy] || policies.strict;
  }

  /**
   * Log masking operation for audit
   */
  logMaskingOperation(operation) {
    this.auditLog.push({
      id: crypto.randomUUID(),
      ...operation,
      user: process.env.USER || 'system',
      session: this.config.sessionId || 'default'
    });

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Export audit log
   */
  getAuditLog(filters = {}) {
    let log = this.auditLog;

    if (filters.startDate) {
      log = log.filter(entry => new Date(entry.timestamp) >= filters.startDate);
    }

    if (filters.endDate) {
      log = log.filter(entry => new Date(entry.timestamp) <= filters.endDate);
    }

    if (filters.policy) {
      log = log.filter(entry => entry.policy === filters.policy);
    }

    return log;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.maskingStats,
      auditLogEntries: this.auditLog.length,
      tokenMapSize: this.tokenMap.size,
      uptime: process.uptime()
    };
  }

  /**
   * Clear sensitive data from memory
   */
  clearSensitiveData() {
    this.tokenMap.clear();
    this.auditLog.length = 0;
    this.emit('sensitiveDataCleared');
  }

  /**
   * Validate data type detection accuracy
   */
  validateDetection(text, expectedTypes = []) {
    const results = [];

    for (const [dataType, pattern] of Object.entries(patterns)) {
      const matches = this.findMatches(text, pattern);
      results.push({
        type: dataType,
        detected: matches.length > 0,
        expected: expectedTypes.includes(dataType),
        matches: matches.length
      });
    }

    return results;
  }
}

module.exports = MaskingService;