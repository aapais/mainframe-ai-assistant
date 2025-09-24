/**
 * Example usage of the Data Masking Service
 * Demonstrates different masking scenarios for banking data
 */

const MaskingService = require('./MaskingService');

// Initialize the service with encryption keys
const maskingService = new MaskingService({
  encryptionKey: 'secure-256-bit-encryption-key-for-banking-data',
  tokenSalt: 'unique-salt-for-banking-tokens',
  enableAuditLog: true,
  defaultPolicy: 'strict'
});

async function demonstrateMasking() {
  console.log('🏦 Data Masking Service Demonstration\\n');

  // Sample incident data with sensitive information
  const incidentData = `
    Relatório de Incidente Bancário #2024-001

    Cliente: Maria Silva Santos
    CPF: 123.456.789-10
    CNPJ: 12.345.678/0001-90
    Email: maria.santos@empresa.com.br
    Telefone: (11) 99887-6655
    Conta: 12345-6
    Agência: 0001
    PIX: maria.santos@pix.com.br

    Detalhes do incidente:
    Transação de R$ 1.500,00 foi recusada.
    Sistema retornou erro na validação do cartão 4532-1234-5678-9012.
    CVV informado: 123

    Logs do sistema:
    API Key: sk-1234567890abcdef1234567890abcdef
    Senha: minhasenha123
    Connection: mongodb://user:password@localhost:27017/bank
    URL: https://api.bank.com/auth?token=abc123&key=secret
    IP Cliente: 192.168.1.100
  `;

  console.log('📝 Original incident data:');
  console.log(incidentData);
  console.log('\\n' + '='.repeat(80) + '\\n');

  // 1. External LLM Processing (Maximum Security)
  console.log('🔒 Scenario 1: External LLM Processing (Maximum Security)');
  const externalResult = await maskingService.maskSensitiveData(incidentData, {
    area: 'external',
    severity: 'critical',
    userRole: 'external'
  });

  console.log('Policy applied:', externalResult.policy);
  console.log('Detected sensitive data:', externalResult.detectedData.length, 'items');
  console.log('Reversible:', externalResult.reversible);
  console.log('\\nMasked text for external processing:');
  console.log(externalResult.maskedText);
  console.log('\\n' + '-'.repeat(60) + '\\n');

  // 2. Support Operator View (Balanced Security)
  console.log('👥 Scenario 2: Support Operator View (Balanced Security)');
  const supportResult = await maskingService.maskSensitiveData(incidentData, {
    area: 'support',
    severity: 'medium',
    userRole: 'operator'
  });

  console.log('Policy applied:', supportResult.policy);
  console.log('Detected sensitive data:', supportResult.detectedData.length, 'items');
  console.log('\\nMasked text for support operator:');
  console.log(supportResult.maskedText);
  console.log('\\n' + '-'.repeat(60) + '\\n');

  // 3. Development Environment (Reversible Masking)
  console.log('💻 Scenario 3: Development Environment (Reversible Masking)');
  const devResult = await maskingService.maskSensitiveData(incidentData, {
    area: 'development'
  });

  console.log('Policy applied:', devResult.policy);
  console.log('Detected sensitive data:', devResult.detectedData.length, 'items');
  console.log('Reversible:', devResult.reversible);
  console.log('\\nMasked text for development:');
  console.log(devResult.maskedText);

  // Demonstrate reversible unmasking
  if (devResult.reversible) {
    console.log('\\n🔓 Unmasking data (development only):');
    const unmasked = await maskingService.unmaskData(devResult.maskedText);
    console.log('Successfully unmasked CPF presence:', unmasked.includes('123.456.789-10'));
  }
  console.log('\\n' + '-'.repeat(60) + '\\n');

  // 4. Audit Trail Analysis
  console.log('📊 Scenario 4: Audit Trail and Statistics');
  const stats = maskingService.getStats();
  console.log('Service Statistics:');
  console.log('- Total documents processed:', stats.totalProcessed);
  console.log('- Sensitive data items found:', stats.sensitiveDataFound);
  console.log('- Masking operations performed:', stats.maskingOperations);
  console.log('- Reversible masks created:', stats.reversibleMasks);
  console.log('- Irreversible masks created:', stats.irreversibleMasks);
  console.log('- Audit log entries:', stats.auditLogEntries);

  const auditLog = maskingService.getAuditLog();
  console.log('\\nRecent audit entries:');
  auditLog.slice(-3).forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.timestamp} - Policy: ${entry.policy} - Detected: ${entry.detectedCount} items`);
  });

  console.log('\\n' + '='.repeat(80) + '\\n');

  // 5. Pattern Validation Test
  console.log('✅ Scenario 5: Pattern Validation');

  const testCases = [
    { value: '123.456.789-10', type: 'cpf', description: 'Valid CPF' },
    { value: '111.111.111-11', type: 'cpf', description: 'Invalid CPF (all same digits)' },
    { value: '4532123456789012', type: 'creditCard', description: 'Valid credit card (Luhn)' },
    { value: '1234567890123456', type: 'creditCard', description: 'Invalid credit card' },
    { value: 'user@example.com', type: 'email', description: 'Valid email' }
  ];

  console.log('Pattern validation results:');
  testCases.forEach(testCase => {
    const isValid = require('./patterns').validateDetection(testCase.value, testCase.type);
    console.log(`- ${testCase.description}: ${testCase.value} → ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  console.log('\\n' + '='.repeat(80) + '\\n');

  // 6. LGPD Compliance Features
  console.log('⚖️ Scenario 6: LGPD Compliance Features');
  console.log('✅ Data Minimization: Only necessary data is processed');
  console.log('✅ Purpose Limitation: Data used only for incident resolution');
  console.log('✅ Consent Management: Explicit consent for external processing');
  console.log('✅ Right to Erasure: Complete data removal via clearSensitiveData()');
  console.log('✅ Data Portability: Reversible masking supports data export');
  console.log('✅ Audit Trail: Complete logging of all operations');
  console.log('✅ Anonymization: Statistical analysis without identifying individuals');

  // Demonstrate data clearing (LGPD Right to Erasure)
  console.log('\\n🗑️  Demonstrating Right to Erasure:');
  console.log('Tokens in memory before clearing:', maskingService.tokenMap.size);
  maskingService.clearSensitiveData();
  console.log('Tokens in memory after clearing:', maskingService.tokenMap.size);

  console.log('\\n🎉 Data Masking Service demonstration completed successfully!');
}

// Event listeners for monitoring
maskingService.on('maskingCompleted', (event) => {
  console.log(`🔍 Masking completed: ${event.detectedData.length} items processed`);
});

maskingService.on('maskingError', (event) => {
  console.error(`❌ Masking error: ${event.error.message}`);
});

maskingService.on('sensitiveDataCleared', () => {
  console.log('🧹 Sensitive data cleared from memory');
});

// Run the demonstration
if (require.main === module) {
  demonstrateMasking().catch(console.error);
}

module.exports = { demonstrateMasking, maskingService };