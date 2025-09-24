/**
 * Data Validation Service Tests
 * Testes de validação de integridade de dados para compliance bancário
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { Pool } = require('pg');
const crypto = require('crypto');
const { MaskingService, SENSITIVE_DATA_TYPES } = require('../../src/services/data-masking/MaskingService');
const { AuditService } = require('../../src/services/audit-logging/AuditService');
const VectorDatabase = require('../../src/services/llm-integration/embeddings/VectorDatabase');

describe('Data Validation Service - Compliance Banking Tests', () => {
    let pgPool;
    let maskingService;
    let auditService;
    let vectorDb;

    const testConfig = {
        database: {
            host: process.env.TEST_DB_HOST || 'localhost',
            port: process.env.TEST_DB_PORT || 5432,
            database: process.env.TEST_DB_NAME || 'test_incident_system',
            user: process.env.TEST_DB_USER || 'test_user',
            password: process.env.TEST_DB_PASSWORD || 'test_password'
        }
    };

    beforeAll(async () => {
        // Inicializa conexões de teste
        pgPool = new Pool(testConfig.database);

        // Cria schema de teste
        await setupTestDatabase();

        // Inicializa serviços
        maskingService = new MaskingService({
            encryptionKey: 'test-encryption-key-32-characters-long',
            auditEnabled: true
        });

        auditService = new AuditService({
            database: testConfig.database,
            encryption: {
                key: 'test-audit-encryption-key-32-char'
            }
        });
        await auditService.initialize();

        vectorDb = new VectorDatabase({
            connection: {
                host: 'localhost',
                port: 8000
            }
        });
        try {
            await vectorDb.initialize();
        } catch (error) {
            console.warn('ChromaDB não disponível para testes, pulando testes de vector');
        }
    });

    afterAll(async () => {
        await cleanupTestDatabase();
        if (pgPool) await pgPool.end();
        if (auditService) await auditService.close();
        if (vectorDb) await vectorDb.close();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('Data Masking Validation', () => {
        test('should mask CPF correctly', async () => {
            const testCPF = '12345678901';

            const result = await maskingService.maskValue(testCPF, SENSITIVE_DATA_TYPES.CPF);

            expect(result.masked).toBe('123.***.**1-**');
            expect(result.strategy).toBe('partial');
            expect(result.reversible).toBe(false);
            expect(result.compliance).toContain('LGPD');
            expect(result.compliance).toContain('BACEN');
        });

        test('should mask CNPJ correctly', async () => {
            const testCNPJ = '12345678000195';

            const result = await maskingService.maskValue(testCNPJ, SENSITIVE_DATA_TYPES.CNPJ);

            expect(result.masked).toBe('12.***.***/**95-**');
            expect(result.strategy).toBe('partial');
            expect(result.compliance).toContain('LGPD');
        });

        test('should mask credit card correctly', async () => {
            const testCard = '1234567890123456';

            const result = await maskingService.maskValue(testCard, SENSITIVE_DATA_TYPES.CREDIT_CARD);

            expect(result.masked).toBe('1234-****-****-3456');
            expect(result.compliance).toContain('PCI-DSS');
        });

        test('should mask email correctly', async () => {
            const testEmail = 'test@example.com';

            const result = await maskingService.maskValue(testEmail, SENSITIVE_DATA_TYPES.EMAIL);

            expect(result.masked).toBe('te***om@example.com');
            expect(result.compliance).toContain('LGPD');
        });

        test('should validate reversible masking for account numbers', async () => {
            const testAccount = '12345-6';

            const maskResult = await maskingService.maskValue(testAccount, SENSITIVE_DATA_TYPES.ACCOUNT_NUMBER);

            expect(maskResult.reversible).toBe(true);
            expect(maskResult.strategy).toBe('tokenize');
            expect(maskResult.compliance).toContain('BACEN');

            // Testa reversibilidade
            const unmaskedValue = await maskingService.unmaskValue(maskResult.masked, SENSITIVE_DATA_TYPES.ACCOUNT_NUMBER);
            expect(unmaskedValue).toBe(testAccount);
        });

        test('should hash PIX keys irreversibly', async () => {
            const testPixKey = 'user@email.com';

            const result = await maskingService.maskValue(testPixKey, SENSITIVE_DATA_TYPES.PIX_KEY);

            expect(result.masked).toMatch(/^HASH_[a-f0-9]{16}$/);
            expect(result.reversible).toBe(false);
            expect(result.strategy).toBe('hash');
        });

        test('should generate synthetic balance data', async () => {
            const testBalance = 'R$ 10.000,50';

            const result = await maskingService.maskValue(testBalance, SENSITIVE_DATA_TYPES.BALANCE);

            expect(result.masked).toMatch(/^R\$ \d+,\d{2}$/);
            expect(result.strategy).toBe('synthetic');
            expect(result.compliance).toContain('SOX');
        });

        test('should redact password completely', async () => {
            const testPassword = 'secretPassword123';

            const result = await maskingService.maskValue(testPassword, SENSITIVE_DATA_TYPES.PASSWORD);

            expect(result.masked).toBe('[REDACTED]');
            expect(result.strategy).toBe('redact');
            expect(result.compliance).toContain('ALL');
        });
    });

    describe('Object Masking Validation', () => {
        test('should mask multiple fields in incident object', async () => {
            const incident = {
                id: crypto.randomUUID(),
                title: 'Problema com conta corrente',
                description: 'Cliente João Silva (CPF: 12345678901) reportou erro na conta 12345-6',
                reporter: 'Maria Santos',
                assigned_to: 'Carlos Oliveira'
            };

            const fieldTypes = {
                title: 'incident_title',
                description: 'incident_description',
                reporter: SENSITIVE_DATA_TYPES.NAME,
                assigned_to: SENSITIVE_DATA_TYPES.NAME
            };

            const result = await maskingService.maskObject(incident, fieldTypes, {
                entityType: 'incident',
                entityId: incident.id,
                userId: 'test_user'
            });

            expect(result.maskedObject.reporter).not.toBe(incident.reporter);
            expect(result.maskedObject.assigned_to).not.toBe(incident.assigned_to);
            expect(result.maskingResults.reporter.compliance).toContain('LGPD');
        });

        test('should validate compliance requirements', async () => {
            const complianceCheck = maskingService.validateCompliance(
                SENSITIVE_DATA_TYPES.CPF,
                ['LGPD', 'BACEN']
            );

            expect(complianceCheck.valid).toBe(true);
            expect(complianceCheck.configured).toContain('LGPD');
            expect(complianceCheck.configured).toContain('BACEN');
        });
    });

    describe('Audit Trail Validation', () => {
        test('should log masking operations', async () => {
            const testData = {
                entityType: 'test_entity',
                entityId: crypto.randomUUID(),
                fieldName: 'test_field',
                strategy: 'partial',
                originalHash: 'test_hash',
                maskedPreview: 'test***',
                userId: 'test_user',
                reversible: false
            };

            await auditService.logMaskingOperation(testData);

            // Verifica se foi registrado no banco
            const client = await pgPool.connect();
            const result = await client.query(
                'SELECT * FROM audit_system.data_masking_log WHERE entity_id = $1',
                [testData.entityId]
            );
            client.release();

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].masking_strategy).toBe(testData.strategy);
            expect(result.rows[0].is_reversible).toBe(testData.reversible);
        });

        test('should generate audit report', async () => {
            // Cria alguns eventos de teste
            for (let i = 0; i < 5; i++) {
                await auditService.logEvent({
                    action: 'DATA_MASK',
                    entityType: 'test_entity',
                    entityId: crypto.randomUUID(),
                    userId: 'test_user',
                    details: { test: true }
                });
            }

            const report = await auditService.generateAuditReport({
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                endDate: new Date()
            });

            expect(report.totalEvents).toBeGreaterThan(0);
            expect(report.events).toBeDefined();
            expect(report.statistics).toBeDefined();
        });
    });

    describe('Database Integrity Validation', () => {
        test('should validate foreign key constraints', async () => {
            const client = await pgPool.connect();

            try {
                // Tenta inserir incidente com business_area_id inválido
                await expect(
                    client.query(`
                        INSERT INTO incident_system.incidents (id, incident_number, title, description, business_area_id, reporter)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        crypto.randomUUID(),
                        'INC-TEST-001',
                        'Teste',
                        'Descrição teste',
                        99999, // ID inválido
                        'test_user'
                    ])
                ).rejects.toThrow();

            } finally {
                client.release();
            }
        });

        test('should validate unique constraints', async () => {
            const client = await pgPool.connect();

            try {
                const incidentNumber = 'INC-UNIQUE-TEST';

                // Primeira inserção deve funcionar
                await client.query(`
                    INSERT INTO incident_system.incidents (id, incident_number, title, description, reporter)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    crypto.randomUUID(),
                    incidentNumber,
                    'Teste 1',
                    'Descrição teste 1',
                    'test_user'
                ]);

                // Segunda inserção com mesmo número deve falhar
                await expect(
                    client.query(`
                        INSERT INTO incident_system.incidents (id, incident_number, title, description, reporter)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        crypto.randomUUID(),
                        incidentNumber,
                        'Teste 2',
                        'Descrição teste 2',
                        'test_user'
                    ])
                ).rejects.toThrow();

            } finally {
                client.release();
            }
        });
    });

    describe('Vector Database Validation', () => {
        test('should validate embedding storage', async () => {
            if (!vectorDb || !vectorDb.isConnected) {
                console.warn('Pulando teste de vector database - não conectado');
                return;
            }

            const testDocument = {
                id: 'test-doc-1',
                content: 'Este é um documento de teste para validação',
                embedding: Array.from({ length: 384 }, () => Math.random()),
                metadata: {
                    type: 'test',
                    created_at: new Date().toISOString()
                }
            };

            await vectorDb.addDocuments('knowledge', testDocument);

            const retrieved = await vectorDb.getDocument('knowledge', 'test-doc-1');

            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(testDocument.id);
            expect(retrieved.content).toBe(testDocument.content);
            expect(retrieved.metadata.type).toBe('test');
        });

        test('should validate similarity search', async () => {
            if (!vectorDb || !vectorDb.isConnected) {
                console.warn('Pulando teste de vector database - não conectado');
                return;
            }

            const queryEmbedding = Array.from({ length: 384 }, () => Math.random());

            const results = await vectorDb.search('knowledge', queryEmbedding, {
                limit: 5
            });

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Performance Validation', () => {
        test('should mask data within performance thresholds', async () => {
            const testData = Array.from({ length: 100 }, (_, i) => ({
                cpf: `1234567890${i}`,
                email: `test${i}@example.com`,
                account: `12345-${i}`
            }));

            const startTime = Date.now();

            for (const item of testData) {
                await maskingService.maskValue(item.cpf, SENSITIVE_DATA_TYPES.CPF);
                await maskingService.maskValue(item.email, SENSITIVE_DATA_TYPES.EMAIL);
                await maskingService.maskValue(item.account, SENSITIVE_DATA_TYPES.ACCOUNT_NUMBER);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Deve processar 100 registros em menos de 5 segundos
            expect(duration).toBeLessThan(5000);

            // Deve processar mais de 20 registros por segundo
            const recordsPerSecond = (testData.length * 3) / (duration / 1000);
            expect(recordsPerSecond).toBeGreaterThan(20);
        });
    });

    describe('Compliance Validation', () => {
        test('should validate LGPD requirements', async () => {
            const personalData = {
                name: 'João Silva',
                cpf: '12345678901',
                email: 'joao@example.com',
                phone: '11999887766'
            };

            const fieldTypes = {
                name: SENSITIVE_DATA_TYPES.NAME,
                cpf: SENSITIVE_DATA_TYPES.CPF,
                email: SENSITIVE_DATA_TYPES.EMAIL,
                phone: SENSITIVE_DATA_TYPES.PHONE
            };

            const result = await maskingService.maskObject(personalData, fieldTypes);

            // Verifica se todos os campos foram mascarados
            expect(result.maskedObject.name).not.toBe(personalData.name);
            expect(result.maskedObject.cpf).not.toBe(personalData.cpf);
            expect(result.maskedObject.email).not.toBe(personalData.email);
            expect(result.maskedObject.phone).not.toBe(personalData.phone);

            // Verifica compliance LGPD
            Object.values(result.maskingResults).forEach(maskResult => {
                expect(maskResult.compliance).toContain('LGPD');
            });
        });

        test('should validate SOX requirements for financial data', async () => {
            const financialData = {
                balance: 'R$ 50.000,00',
                transaction_value: 'R$ 1.500,50',
                account_number: '12345-6'
            };

            const fieldTypes = {
                balance: SENSITIVE_DATA_TYPES.BALANCE,
                transaction_value: SENSITIVE_DATA_TYPES.TRANSACTION_VALUE,
                account_number: SENSITIVE_DATA_TYPES.ACCOUNT_NUMBER
            };

            const result = await maskingService.maskObject(financialData, fieldTypes);

            // Verifica compliance SOX
            expect(result.maskingResults.balance.compliance).toContain('SOX');
            expect(result.maskingResults.account_number.compliance).toContain('SOX');
        });

        test('should validate BACEN requirements', async () => {
            const bankingData = {
                account_number: '12345-6',
                pix_key: 'user@bank.com',
                balance: 'R$ 10.000,00'
            };

            const fieldTypes = {
                account_number: SENSITIVE_DATA_TYPES.ACCOUNT_NUMBER,
                pix_key: SENSITIVE_DATA_TYPES.PIX_KEY,
                balance: SENSITIVE_DATA_TYPES.BALANCE
            };

            const result = await maskingService.maskObject(bankingData, fieldTypes);

            // Verifica compliance BACEN
            Object.values(result.maskingResults).forEach(maskResult => {
                expect(maskResult.compliance).toContain('BACEN');
            });
        });
    });

    // Funções auxiliares de setup/cleanup

    async function setupTestDatabase() {
        const client = await pgPool.connect();

        try {
            // Cria schemas de teste
            await client.query('CREATE SCHEMA IF NOT EXISTS incident_system');
            await client.query('CREATE SCHEMA IF NOT EXISTS audit_system');

            // Cria tabelas básicas para teste
            await client.query(`
                CREATE TABLE IF NOT EXISTS incident_system.business_areas (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(200) NOT NULL
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS incident_system.incidents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    incident_number VARCHAR(50) UNIQUE NOT NULL,
                    title VARCHAR(500) NOT NULL,
                    description TEXT NOT NULL,
                    description_masked TEXT,
                    business_area_id INTEGER REFERENCES incident_system.business_areas(id),
                    reporter VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS audit_system.data_masking_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id UUID NOT NULL,
                    field_name VARCHAR(100) NOT NULL,
                    masking_strategy VARCHAR(50) NOT NULL,
                    original_hash VARCHAR(64),
                    masked_preview VARCHAR(50),
                    user_id VARCHAR(100) NOT NULL,
                    is_reversible BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS audit_system.audit_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id UUID,
                    action VARCHAR(50) NOT NULL,
                    user_id VARCHAR(100) NOT NULL,
                    user_role VARCHAR(50),
                    details JSONB,
                    ip_address INET,
                    user_agent TEXT,
                    session_id VARCHAR(100),
                    compliance_flags TEXT[],
                    data_sensitivity VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Insere dados básicos para teste
            await client.query(`
                INSERT INTO incident_system.business_areas (code, name)
                VALUES ('test', 'Área de Teste')
                ON CONFLICT (code) DO NOTHING
            `);

        } finally {
            client.release();
        }
    }

    async function cleanupTestDatabase() {
        const client = await pgPool.connect();

        try {
            await client.query('DROP SCHEMA IF EXISTS incident_system CASCADE');
            await client.query('DROP SCHEMA IF EXISTS audit_system CASCADE');
        } finally {
            client.release();
        }
    }

    async function clearTestData() {
        const client = await pgPool.connect();

        try {
            await client.query('TRUNCATE TABLE incident_system.incidents CASCADE');
            await client.query('TRUNCATE TABLE audit_system.data_masking_log CASCADE');
            await client.query('TRUNCATE TABLE audit_system.audit_log CASCADE');
        } finally {
            client.release();
        }
    }
});