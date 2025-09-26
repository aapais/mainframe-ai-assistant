const crypto = require('crypto');

class CryptoService {
  constructor() {
    // Use a key from environment or generate a consistent one
    this.algorithm = 'aes-256-gcm';
    this.secretKey = process.env.CRYPTO_SECRET_KEY
      ? Buffer.from(process.env.CRYPTO_SECRET_KEY, 'hex')
      : this.deriveKey(process.env.JWT_SECRET || 'default-secret-key-change-in-production');
  }

  deriveKey(password) {
    // Derive a key from password using PBKDF2
    const salt = 'mainframe-ai-salt-v1';
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  encrypt(text) {
    if (!text) return null;

    try {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the auth tag
      const authTag = cipher.getAuthTag();

      // Combine IV, authTag, and encrypted text
      // Format: iv:authTag:encrypted
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedText) {
    if (!encryptedText) return null;

    try {
      // Split the encrypted text to get IV, authTag, and encrypted data
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Create a masked version of the API key for display
  maskApiKey(key) {
    if (!key || key.length < 8) return '***';

    const firstChars = key.substring(0, 4);
    const lastChars = key.substring(key.length - 4);
    return `${firstChars}...${lastChars}`;
  }

  // Generate a secure random token
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash a value (for comparison, not for API keys)
  hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

module.exports = new CryptoService();