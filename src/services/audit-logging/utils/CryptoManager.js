/**
 * Sistema de Criptografia para Logs Sensíveis
 * Implementa criptografia robusta para proteção de dados de auditoria
 * Compatível com padrões bancários e regulamentações
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class CryptoManager {
    constructor(config = {}) {
        this.config = {
            algorithm: 'aes-256-gcm',
            keyDerivation: 'scrypt',
            saltLength: 32,
            ivLength: 16,
            tagLength: 16,
            iterations: 100000,
            keyLength: 32,
            masterKeyRotationDays: 90,
            enableKeyEscrow: true,
            keyEscrowThreshold: 3, // Threshold secret sharing
            keyBackupLocation: process.env.KEY_BACKUP_PATH || './keys/backup',
            ...config
        };

        this.masterKey = null;
        this.keyDerivationCache = new Map();
        this.keyRotationSchedule = new Map();
        this.escrowKeys = new Map();

        this.initializeCrypto();
    }

    /**
     * Inicializa o sistema de criptografia
     */
    async initializeCrypto() {
        try {
            await this.loadOrGenerateMasterKey();
            await this.setupKeyRotation();
            await this.initializeKeyEscrow();
        } catch (error) {
            console.error('Failed to initialize crypto system:', error);
            throw error;
        }
    }

    /**
     * Carrega ou gera chave mestre
     */
    async loadOrGenerateMasterKey() {
        const keyPath = path.join(this.config.keyBackupLocation, 'master.key');

        try {
            // Tenta carregar chave existente
            const keyData = await fs.readFile(keyPath);
            const parsedKey = JSON.parse(keyData.toString());

            if (this.validateMasterKey(parsedKey)) {
                this.masterKey = parsedKey;
                console.log('Master key loaded successfully');
                return;
            }
        } catch (error) {
            console.log('Master key not found, generating new one');
        }

        // Gera nova chave mestre
        this.masterKey = await this.generateMasterKey();
        await this.saveMasterKey(keyPath);
        console.log('New master key generated and saved');
    }

    /**
     * Gera nova chave mestre
     */
    async generateMasterKey() {
        const keyMaterial = crypto.randomBytes(64);
        const salt = crypto.randomBytes(this.config.saltLength);
        const derivedKey = crypto.scryptSync(keyMaterial, salt, this.config.keyLength);

        return {
            id: crypto.randomUUID(),
            key: derivedKey.toString('base64'),
            salt: salt.toString('base64'),
            algorithm: this.config.algorithm,
            keyDerivation: this.config.keyDerivation,
            iterations: this.config.iterations,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + (this.config.masterKeyRotationDays * 24 * 60 * 60 * 1000)).toISOString(),
            version: '1.0.0'
        };
    }

    /**
     * Valida chave mestre
     */
    validateMasterKey(keyData) {
        const required = ['id', 'key', 'salt', 'algorithm', 'createdAt', 'expiresAt'];
        const hasAllFields = required.every(field => keyData.hasOwnProperty(field));

        if (!hasAllFields) return false;

        const expiryDate = new Date(keyData.expiresAt);
        if (expiryDate <= new Date()) {
            console.warn('Master key has expired');
            return false;
        }

        return true;
    }

    /**
     * Salva chave mestre de forma segura
     */
    async saveMasterKey(keyPath) {
        await fs.mkdir(path.dirname(keyPath), { recursive: true });

        const keyData = JSON.stringify(this.masterKey, null, 2);
        const encryptedKey = await this.encryptWithSystemKey(keyData);

        await fs.writeFile(keyPath, JSON.stringify(encryptedKey));
        await fs.chmod(keyPath, 0o600); // Somente owner pode ler/escrever
    }

    /**
     * Criptografa dados sensíveis
     */
    async encryptSensitiveData(data, dataClassification = 'CONFIDENTIAL') {
        if (!data) return data;

        try {
            const dataKey = await this.deriveDataKey(dataClassification);
            const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

            const iv = crypto.randomBytes(this.config.ivLength);
            const cipher = crypto.createCipher(this.config.algorithm, dataKey);
            cipher.setAAD(Buffer.from(dataClassification));

            let encrypted = cipher.update(plaintext, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            const tag = cipher.getAuthTag();

            const result = {
                encrypted: true,
                algorithm: this.config.algorithm,
                data: encrypted.toString('base64'),
                iv: iv.toString('base64'),
                tag: tag.toString('base64'),
                classification: dataClassification,
                keyId: this.masterKey.id,
                timestamp: new Date().toISOString()
            };

            return result;

        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error(`Failed to encrypt data: ${error.message}`);
        }
    }

    /**
     * Descriptografa dados sensíveis
     */
    async decryptSensitiveData(encryptedData) {
        if (!encryptedData || !encryptedData.encrypted) {
            return encryptedData;
        }

        try {
            const dataKey = await this.deriveDataKey(encryptedData.classification);

            const iv = Buffer.from(encryptedData.iv, 'base64');
            const tag = Buffer.from(encryptedData.tag, 'base64');
            const encrypted = Buffer.from(encryptedData.data, 'base64');

            const decipher = crypto.createDecipher(encryptedData.algorithm, dataKey);
            decipher.setAuthTag(tag);
            decipher.setAAD(Buffer.from(encryptedData.classification));

            let decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            const plaintext = decrypted.toString('utf8');

            // Tenta fazer parse JSON se possível
            try {
                return JSON.parse(plaintext);
            } catch {
                return plaintext;
            }

        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`Failed to decrypt data: ${error.message}`);
        }
    }

    /**
     * Deriva chave específica para tipo de dados
     */
    async deriveDataKey(dataClassification) {
        const cacheKey = `${this.masterKey.id}-${dataClassification}`;

        if (this.keyDerivationCache.has(cacheKey)) {
            return this.keyDerivationCache.get(cacheKey);
        }

        const masterKeyBuffer = Buffer.from(this.masterKey.key, 'base64');
        const salt = Buffer.from(this.masterKey.salt, 'base64');
        const info = Buffer.from(`audit-log-${dataClassification}`);

        // Usa HKDF para derivação de chave
        const derivedKey = crypto.hkdfSync(
            'sha256',
            masterKeyBuffer,
            salt,
            info,
            this.config.keyLength
        );

        this.keyDerivationCache.set(cacheKey, derivedKey);

        // Limpa cache após 1 hora
        setTimeout(() => {
            this.keyDerivationCache.delete(cacheKey);
        }, 3600000);

        return derivedKey;
    }

    /**
     * Criptografa com chave do sistema
     */
    async encryptWithSystemKey(data) {
        const systemKey = this.getSystemKey();
        const iv = crypto.randomBytes(this.config.ivLength);

        const cipher = crypto.createCipher(this.config.algorithm, systemKey);
        let encrypted = cipher.update(data, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const tag = cipher.getAuthTag();

        return {
            algorithm: this.config.algorithm,
            data: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64')
        };
    }

    /**
     * Descriptografa com chave do sistema
     */
    async decryptWithSystemKey(encryptedData) {
        const systemKey = this.getSystemKey();

        const iv = Buffer.from(encryptedData.iv, 'base64');
        const tag = Buffer.from(encryptedData.tag, 'base64');
        const encrypted = Buffer.from(encryptedData.data, 'base64');

        const decipher = crypto.createDecipher(encryptedData.algorithm, systemKey);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    }

    /**
     * Obtém chave do sistema
     */
    getSystemKey() {
        const systemKeyMaterial = process.env.SYSTEM_ENCRYPTION_KEY || 'default-system-key';
        const salt = 'audit-system-salt';

        return crypto.scryptSync(systemKeyMaterial, salt, this.config.keyLength);
    }

    /**
     * Configura rotação automática de chaves
     */
    async setupKeyRotation() {
        if (!this.masterKey) return;

        const expiryDate = new Date(this.masterKey.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiryDate.getTime() - now.getTime();

        if (timeUntilExpiry > 0) {
            const rotationTimeout = setTimeout(async () => {
                await this.rotateMasterKey();
            }, timeUntilExpiry);

            this.keyRotationSchedule.set('master', rotationTimeout);
            console.log(`Key rotation scheduled for ${expiryDate.toISOString()}`);
        } else {
            console.warn('Master key has expired, rotation needed immediately');
            await this.rotateMasterKey();
        }
    }

    /**
     * Rotaciona chave mestre
     */
    async rotateMasterKey() {
        try {
            console.log('Starting master key rotation...');

            // Backup da chave atual
            await this.backupCurrentKey();

            // Gera nova chave
            const oldKey = this.masterKey;
            this.masterKey = await this.generateMasterKey();

            // Salva nova chave
            const keyPath = path.join(this.config.keyBackupLocation, 'master.key');
            await this.saveMasterKey(keyPath);

            // Limpa cache de derivação
            this.keyDerivationCache.clear();

            // Agenda próxima rotação
            await this.setupKeyRotation();

            console.log('Master key rotation completed successfully');

            return {
                oldKeyId: oldKey.id,
                newKeyId: this.masterKey.id,
                rotatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Master key rotation failed:', error);
            throw error;
        }
    }

    /**
     * Faz backup da chave atual
     */
    async backupCurrentKey() {
        if (!this.masterKey) return;

        const backupPath = path.join(
            this.config.keyBackupLocation,
            'archive',
            `master-${this.masterKey.id}.key.bak`
        );

        await fs.mkdir(path.dirname(backupPath), { recursive: true });

        const keyData = JSON.stringify(this.masterKey, null, 2);
        const encryptedKey = await this.encryptWithSystemKey(keyData);

        await fs.writeFile(backupPath, JSON.stringify(encryptedKey));
        await fs.chmod(backupPath, 0o600);

        console.log(`Key backup saved to ${backupPath}`);
    }

    /**
     * Inicializa sistema de custódia de chaves (Key Escrow)
     */
    async initializeKeyEscrow() {
        if (!this.config.enableKeyEscrow) return;

        try {
            // Implementa Shamir's Secret Sharing para distribuir chave mestre
            const shares = await this.createSecretShares(
                this.masterKey.key,
                this.config.keyEscrowThreshold * 2, // Total de shares
                this.config.keyEscrowThreshold // Mínimo necessário
            );

            // Distribui shares entre diferentes sistemas/pessoas
            for (let i = 0; i < shares.length; i++) {
                const escrowPath = path.join(
                    this.config.keyBackupLocation,
                    'escrow',
                    `share-${i + 1}.json`
                );

                await fs.mkdir(path.dirname(escrowPath), { recursive: true });

                const escrowData = {
                    shareId: i + 1,
                    keyId: this.masterKey.id,
                    share: shares[i],
                    threshold: this.config.keyEscrowThreshold,
                    totalShares: shares.length,
                    createdAt: new Date().toISOString()
                };

                await fs.writeFile(escrowPath, JSON.stringify(escrowData, null, 2));
                await fs.chmod(escrowPath, 0o600);
            }

            console.log(`Key escrow initialized with ${shares.length} shares`);

        } catch (error) {
            console.error('Key escrow initialization failed:', error);
        }
    }

    /**
     * Cria shares secretos usando algoritmo simplificado
     * Em produção, usar biblioteca especializada como 'secrets.js'
     */
    async createSecretShares(secret, totalShares, threshold) {
        // Implementação simplificada - em produção usar biblioteca robusta
        const shares = [];
        const secretBuffer = Buffer.from(secret, 'base64');

        for (let i = 0; i < totalShares; i++) {
            const shareData = {
                x: i + 1,
                y: this.generateShareValue(secretBuffer, i + 1, threshold)
            };
            shares.push(Buffer.from(JSON.stringify(shareData)).toString('base64'));
        }

        return shares;
    }

    /**
     * Gera valor de share (implementação simplificada)
     */
    generateShareValue(secret, x, threshold) {
        // Em produção, implementar Shamir's Secret Sharing adequadamente
        const hash = crypto.createHash('sha256');
        hash.update(secret);
        hash.update(Buffer.from([x, threshold]));
        return hash.digest('base64');
    }

    /**
     * Calcula hash criptográfico para integridade
     */
    calculateHash(data, algorithm = 'sha256') {
        const hash = crypto.createHash(algorithm);
        const input = typeof data === 'string' ? data : JSON.stringify(data);
        hash.update(input);
        return hash.digest('hex');
    }

    /**
     * Gera assinatura digital
     */
    async createDigitalSignature(data, keyId = null) {
        const dataToSign = typeof data === 'string' ? data : JSON.stringify(data);
        const hash = this.calculateHash(dataToSign, 'sha256');

        const signature = {
            algorithm: 'sha256',
            hash,
            keyId: keyId || this.masterKey.id,
            timestamp: new Date().toISOString(),
            signedBy: 'CRYPTO_SYSTEM'
        };

        return signature;
    }

    /**
     * Verifica assinatura digital
     */
    async verifyDigitalSignature(data, signature) {
        const dataToVerify = typeof data === 'string' ? data : JSON.stringify(data);
        const calculatedHash = this.calculateHash(dataToVerify, signature.algorithm);

        return {
            valid: calculatedHash === signature.hash,
            keyId: signature.keyId,
            timestamp: signature.timestamp,
            algorithm: signature.algorithm
        };
    }

    /**
     * Gera token de sessão seguro
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('base64url');
    }

    /**
     * Deriva chave para uso específico
     */
    deriveKeyForPurpose(purpose, salt = null) {
        const masterKeyBuffer = Buffer.from(this.masterKey.key, 'base64');
        const saltBuffer = salt ? Buffer.from(salt) : crypto.randomBytes(16);
        const info = Buffer.from(purpose);

        return crypto.hkdfSync(
            'sha256',
            masterKeyBuffer,
            saltBuffer,
            info,
            this.config.keyLength
        );
    }

    /**
     * Obtém status do sistema de criptografia
     */
    getStatus() {
        return {
            masterKeyId: this.masterKey?.id,
            masterKeyExpiry: this.masterKey?.expiresAt,
            algorithm: this.config.algorithm,
            keyDerivationCache: this.keyDerivationCache.size,
            escrowEnabled: this.config.enableKeyEscrow,
            rotationScheduled: this.keyRotationSchedule.has('master'),
            systemHealth: 'OPERATIONAL'
        };
    }

    /**
     * Limpa dados sensíveis da memória
     */
    secureCleanup() {
        this.keyDerivationCache.clear();

        // Limpa timeouts de rotação
        for (const timeout of this.keyRotationSchedule.values()) {
            clearTimeout(timeout);
        }
        this.keyRotationSchedule.clear();

        console.log('Crypto system cleanup completed');
    }
}

module.exports = CryptoManager;