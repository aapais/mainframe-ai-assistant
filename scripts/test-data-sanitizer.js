/**
 * Test script for DataSanitizer service
 * Demonstrates functionality and validates implementation
 */

const DataSanitizer = require('./data-sanitizer');

// Test data with sensitive information
const testData = {
    user: {
        name: "João Silva",
        cpf: "123.456.789-01",
        email: "joao.silva@example.com",
        phone: "+5511999998888",
        bankAccount: "12345-6",
        creditCard: "1234 5678 9012 3456"
    },
    company: {
        name: "Empresa ABC",
        cnpj: "12.345.678/0001-90",
        contact: "contato@empresa.com"
    },
    description: "Cliente João Silva (CPF: 123.456.789-01) possui conta bancária 12345-6 e cartão 1234-5678-9012-3456"
};

async function runTests() {
    console.log('🧪 Testing DataSanitizer Service\n');

    const sanitizer = new DataSanitizer();

    try {
        // Test sanitization
        console.log('📝 Original Data:');
        console.log(JSON.stringify(testData, null, 2));

        console.log('\n🔒 Sanitizing data...');
        const sanitizeResult = sanitizer.sanitize(testData);

        console.log('\n✅ Sanitized Data:');
        console.log(JSON.stringify(sanitizeResult.data, null, 2));

        console.log('\n📊 Sanitization Metadata:');
        console.log(JSON.stringify(sanitizeResult.metadata, null, 2));

        // Test restoration
        console.log('\n🔓 Restoring data...');
        const restoreResult = sanitizer.restore(sanitizeResult.data, sanitizeResult.mappingKey);

        console.log('\n✅ Restored Data:');
        console.log(JSON.stringify(restoreResult.data, null, 2));

        console.log('\n🔍 Restoration Metadata:');
        console.log(JSON.stringify(restoreResult.metadata, null, 2));

        // Verify data integrity
        const originalStr = JSON.stringify(testData);
        const restoredStr = JSON.stringify(restoreResult.data);
        const isIntact = originalStr === restoredStr;

        console.log('\n🎯 Data Integrity Check:', isIntact ? '✅ PASSED' : '❌ FAILED');

        // Show statistics
        console.log('\n📈 Sanitizer Statistics:');
        console.log(JSON.stringify(sanitizer.getStatistics(), null, 2));

        // Test string sanitization
        console.log('\n🔤 Testing String Sanitization:');
        const testString = "Contato: joao@test.com, CPF: 987.654.321-00, Fone: +5511888887777";
        const stringResult = sanitizer.sanitize(testString);
        console.log('Original:', testString);
        console.log('Sanitized:', stringResult.data);

        const stringRestore = sanitizer.restore(stringResult.data, stringResult.mappingKey);
        console.log('Restored:', stringRestore.data);
        console.log('String Integrity:', testString === stringRestore.data ? '✅ PASSED' : '❌ FAILED');

        console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };