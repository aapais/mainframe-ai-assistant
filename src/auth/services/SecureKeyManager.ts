import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DatabaseManager } from '../../database/DatabaseManager';

export interface EncryptedAPIKey {
  id: string;
  userId: string;
  keyName: string;
  encryptedKey: string;
  keyHash: string;
  iv: string;
  salt: string;
  provider: string;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  searchSettings: {
    defaultCategory?: string;
    resultsPerPage: number;
    enableAI: boolean;
  };
  securitySettings: {
    sessionTimeout: number;
    requireMFA: boolean;
    allowedIPs?: string[];
  };
  encryptedData: string;
  iv: string;
  updatedAt: Date;
}

export class SecureKeyManager {
  private static instance: SecureKeyManager;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 16;
  private readonly TAG_LENGTH = 16;

  private masterKey: Buffer;
  private db: DatabaseManager;

  private constructor() {
    this.masterKey = this.deriveMasterKey();
    this.db = DatabaseManager.getInstance();
  }

  public static getInstance(): SecureKeyManager {
    if (!SecureKeyManager.instance) {
      SecureKeyManager.instance = new SecureKeyManager();
    }
    return SecureKeyManager.instance;
  }

  private deriveMasterKey(): Buffer {
    const masterSecret = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');
    const salt = process.env.KEY_SALT || 'mainframe-ai-assistant-salt';

    return crypto.pbkdf2Sync(masterSecret, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  public async storeAPIKey(
    userId: string,
    keyName: string,
    apiKey: string,
    provider: string,
    permissions: string[] = []
  ): Promise<string> {
    try {
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const userKey = crypto.pbkdf2Sync(this.masterKey, salt, 10000, this.KEY_LENGTH, 'sha256');

      const cipher = crypto.createCipher(this.ALGORITHM, userKey);
      cipher.setAAD(Buffer.from(userId + keyName));

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      const encryptedKey = encrypted + authTag.toString('hex');

      const keyHash = await bcrypt.hash(apiKey, 12);

      const keyId = crypto.randomUUID();

      const encryptedAPIKey: EncryptedAPIKey = {
        id: keyId,
        userId,
        keyName,
        encryptedKey,
        keyHash,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        provider,
        permissions,
        createdAt: new Date(),
        isActive: true,
      };

      await this.db.run(
        `
        INSERT INTO encrypted_api_keys
        (id, user_id, key_name, encrypted_key, key_hash, iv, salt, provider, permissions, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          keyId,
          userId,
          keyName,
          encryptedKey,
          keyHash,
          encryptedAPIKey.iv,
          encryptedAPIKey.salt,
          provider,
          JSON.stringify(permissions),
          encryptedAPIKey.createdAt.toISOString(),
          1,
        ]
      );

      await this.logKeyOperation(userId, keyId, 'CREATED');

      return keyId;
    } catch (error) {
      throw new Error(`Falha ao armazenar chave API: ${error.message}`);
    }
  }

  public async retrieveAPIKey(userId: string, keyId: string): Promise<string> {
    try {
      const result = await this.db.get(
        `
        SELECT * FROM encrypted_api_keys
        WHERE id = ? AND user_id = ? AND is_active = 1
      `,
        [keyId, userId]
      );

      if (!result) {
        throw new Error('Chave API não encontrada');
      }

      const salt = Buffer.from(result.salt, 'hex');
      const iv = Buffer.from(result.iv, 'hex');

      const userKey = crypto.pbkdf2Sync(this.masterKey, salt, 10000, this.KEY_LENGTH, 'sha256');

      const encryptedData = result.encrypted_key;
      const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
      const encrypted = encryptedData.slice(0, -32);

      const decipher = crypto.createDecipher(this.ALGORITHM, userKey);
      decipher.setAAD(Buffer.from(userId + result.key_name));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      await this.updateLastUsed(keyId);
      await this.logKeyOperation(userId, keyId, 'ACCESSED');

      return decrypted;
    } catch (error) {
      await this.logKeyOperation(userId, keyId, 'ACCESS_FAILED');
      throw new Error(`Falha ao recuperar chave API: ${error.message}`);
    }
  }

  public async rotateAPIKey(userId: string, keyId: string, newApiKey: string): Promise<void> {
    try {
      const existingKey = await this.db.get(
        `
        SELECT * FROM encrypted_api_keys
        WHERE id = ? AND user_id = ? AND is_active = 1
      `,
        [keyId, userId]
      );

      if (!existingKey) {
        throw new Error('Chave API não encontrada');
      }

      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const userKey = crypto.pbkdf2Sync(this.masterKey, salt, 10000, this.KEY_LENGTH, 'sha256');

      const cipher = crypto.createCipher(this.ALGORITHM, userKey);
      cipher.setAAD(Buffer.from(userId + existingKey.key_name));

      let encrypted = cipher.update(newApiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      const encryptedKey = encrypted + authTag.toString('hex');

      const keyHash = await bcrypt.hash(newApiKey, 12);

      await this.db.run(
        `
        UPDATE encrypted_api_keys
        SET encrypted_key = ?, key_hash = ?, iv = ?, salt = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
        [
          encryptedKey,
          keyHash,
          iv.toString('hex'),
          salt.toString('hex'),
          new Date().toISOString(),
          keyId,
          userId,
        ]
      );

      await this.logKeyOperation(userId, keyId, 'ROTATED');
    } catch (error) {
      throw new Error(`Falha na rotação da chave: ${error.message}`);
    }
  }

  public async deleteAPIKey(userId: string, keyId: string): Promise<void> {
    try {
      await this.db.run(
        `
        UPDATE encrypted_api_keys
        SET is_active = 0, deleted_at = ?
        WHERE id = ? AND user_id = ?
      `,
        [new Date().toISOString(), keyId, userId]
      );

      await this.logKeyOperation(userId, keyId, 'DELETED');
    } catch (error) {
      throw new Error(`Falha ao deletar chave API: ${error.message}`);
    }
  }

  public async storeUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const userKey = crypto.pbkdf2Sync(this.masterKey, salt, 10000, this.KEY_LENGTH, 'sha256');

      const cipher = crypto.createCipher(this.ALGORITHM, userKey);
      cipher.setAAD(Buffer.from(userId));

      const preferencesJson = JSON.stringify(preferences);
      let encrypted = cipher.update(preferencesJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      const encryptedData = encrypted + authTag.toString('hex');

      await this.db.run(
        `
        INSERT OR REPLACE INTO user_preferences
        (user_id, encrypted_data, iv, salt, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        [userId, encryptedData, iv.toString('hex'), salt.toString('hex'), new Date().toISOString()]
      );
    } catch (error) {
      throw new Error(`Falha ao armazenar preferências: ${error.message}`);
    }
  }

  public async retrieveUserPreferences(userId: string): Promise<any> {
    try {
      const result = await this.db.get(
        `
        SELECT * FROM user_preferences WHERE user_id = ?
      `,
        [userId]
      );

      if (!result) {
        return this.getDefaultPreferences();
      }

      const salt = Buffer.from(result.salt, 'hex');
      const iv = Buffer.from(result.iv, 'hex');

      const userKey = crypto.pbkdf2Sync(this.masterKey, salt, 10000, this.KEY_LENGTH, 'sha256');

      const encryptedData = result.encrypted_data;
      const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
      const encrypted = encryptedData.slice(0, -32);

      const decipher = crypto.createDecipher(this.ALGORITHM, userKey);
      decipher.setAAD(Buffer.from(userId));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      return this.getDefaultPreferences();
    }
  }

  private getDefaultPreferences(): any {
    return {
      theme: 'light',
      language: 'pt',
      timezone: 'Europe/Lisbon',
      notifications: {
        email: true,
        push: false,
        inApp: true,
      },
      searchSettings: {
        resultsPerPage: 10,
        enableAI: true,
      },
      securitySettings: {
        sessionTimeout: 3600,
        requireMFA: false,
      },
    };
  }

  public async getUserAPIKeys(
    userId: string
  ): Promise<Omit<EncryptedAPIKey, 'encryptedKey' | 'keyHash'>[]> {
    const results = await this.db.all(
      `
      SELECT id, user_id, key_name, provider, permissions, created_at, last_used, expires_at, is_active
      FROM encrypted_api_keys
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `,
      [userId]
    );

    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      keyName: row.key_name,
      iv: '',
      salt: '',
      provider: row.provider,
      permissions: JSON.parse(row.permissions || '[]'),
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      isActive: Boolean(row.is_active),
    }));
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    await this.db.run(
      `
      UPDATE encrypted_api_keys
      SET last_used = ?
      WHERE id = ?
    `,
      [new Date().toISOString(), keyId]
    );
  }

  private async logKeyOperation(userId: string, keyId: string, operation: string): Promise<void> {
    await this.db.run(
      `
      INSERT INTO key_audit_log
      (id, user_id, key_id, operation, timestamp, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [crypto.randomUUID(), userId, keyId, operation, new Date().toISOString(), 'system']
    );
  }

  public async setupDatabase(): Promise<void> {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS encrypted_api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_name TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        iv TEXT NOT NULL,
        salt TEXT NOT NULL,
        provider TEXT NOT NULL,
        permissions TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT,
        last_used TEXT,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        deleted_at TEXT,
        UNIQUE(user_id, key_name)
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        salt TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS key_audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_id TEXT,
        operation TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        error_message TEXT
      )
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON encrypted_api_keys(user_id);
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON key_audit_log(user_id);
    `);
  }
}
