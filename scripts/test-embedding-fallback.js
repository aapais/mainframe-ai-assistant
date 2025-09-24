#!/usr/bin/env node

/**
 * Test script to demonstrate embedding fallback behavior
 * Shows what happens with different API key configurations
 */

const MultiEmbeddingService = require('../src/services/multi-embedding-service');
const EmbeddingConfig = require('../src/services/embedding-config');

async function testFallbackScenarios() {
  console.log('🧪 Testing Embedding Service Fallback Scenarios\n');

  // Test scenarios with different API key combinations
  const scenarios = [
    {
      name: 'OpenAI Only',
      config: {
        openai: { apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key' },
        gemini: { apiKey: null },
        azure: { apiKey: null, endpoint: null }
      }
    },
    {
      name: 'Gemini Only',
      config: {
        openai: { apiKey: null },
        gemini: { apiKey: process.env.GEMINI_API_KEY || 'fake-key' },
        azure: { apiKey: null, endpoint: null }
      }
    },
    {
      name: 'No API Keys',
      config: {
        openai: { apiKey: null },
        gemini: { apiKey: null },
        azure: { apiKey: null, endpoint: null }
      }
    },
    {
      name: 'All Configured',
      config: {
        openai: { apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key' },
        gemini: { apiKey: process.env.GEMINI_API_KEY || 'fake-key' },
        azure: {
          apiKey: process.env.AZURE_OPENAI_API_KEY || 'fake-key',
          endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://fake.openai.azure.com'
        }
      }
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n📋 Scenario: ${scenario.name}`);
    console.log('=' .repeat(50));

    const embeddingService = new MultiEmbeddingService(scenario.config);

    // Check which providers are available
    const available = embeddingService.getAvailableProviders();
    console.log(`🔌 Available providers: ${available.length > 0 ? available.join(', ') : 'NONE'}`);

    if (available.length === 0) {
      console.log('❌ No providers available - embeddings will be disabled');
      console.log('📄 System will use text search only');
      continue;
    }

    // Test embedding generation with fallback
    const testText = "CICS transaction timeout error";

    try {
      // Try default provider first
      console.log(`\n🎯 Testing default provider...`);
      let embedding = await embeddingService.generateEmbedding(testText);

      if (embedding) {
        console.log(`✅ Default embedding generated (${embedding.length}D)`);
      } else {
        console.log(`⚠️  Default provider failed, trying alternatives...`);

        // Try each available provider
        for (const provider of available) {
          console.log(`🔄 Trying ${provider}...`);
          embedding = await embeddingService.generateEmbedding(testText, { provider });

          if (embedding) {
            console.log(`✅ Fallback successful with ${provider} (${embedding.length}D)`);
            break;
          } else {
            console.log(`❌ ${provider} failed`);
          }
        }
      }

      if (!embedding) {
        console.log(`💥 All providers failed - falling back to text search only`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`📄 Falling back to text search`);
    }

    // Show cache stats
    const cacheStats = embeddingService.getCacheStats();
    console.log(`📊 Cache: ${cacheStats.size} entries, ${cacheStats.providers.join(', ')} providers used`);
  }

  console.log('\n🎯 Fallback Strategy Summary:');
  console.log('1. Try configured default provider');
  console.log('2. If fails, try other available providers in order');
  console.log('3. If all fail, disable vector search and use text search only');
  console.log('4. System continues to work normally with reduced functionality');
}

async function demonstrateRealWorldUsage() {
  console.log('\n\n🌍 Real-World Usage Examples\n');

  const configHelper = new EmbeddingConfig();

  console.log('📋 Configuration Status:');
  const validation = configHelper.validateConfig();

  console.log(`✅ Valid: ${validation.valid}`);
  console.log(`🔌 Configured providers: ${validation.configured.join(', ') || 'NONE'}`);
  console.log(`🎯 Compatible models: ${validation.compatible}`);

  if (validation.errors.length > 0) {
    console.log(`❌ Errors: ${validation.errors.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${validation.warnings.join(', ')}`);
  }

  console.log('\n📝 Recommended .env configuration:');
  console.log(configHelper.generateEnvTemplate());

  // Show what happens in practice
  console.log('\n🎮 Practical Examples:');

  console.log('\n📌 Example 1: Only OpenAI configured');
  console.log('   Result: Uses OpenAI ada-002 for all embeddings');
  console.log('   Performance: Full vector search capabilities');

  console.log('\n📌 Example 2: Only Gemini configured');
  console.log('   Result: Cannot generate embeddings (768D not compatible)');
  console.log('   Fallback: Uses text search only');
  console.log('   Note: Would need schema update to support 768 dimensions');

  console.log('\n📌 Example 3: No API keys');
  console.log('   Result: No vector search available');
  console.log('   Fallback: Traditional text search (still very functional)');
  console.log('   Performance: Good for basic searches, limited semantic understanding');

  console.log('\n📌 Example 4: Multiple providers configured');
  console.log('   Result: Uses primary, falls back to secondary if needed');
  console.log('   Performance: Maximum reliability and redundancy');
}

// Run the tests
if (require.main === module) {
  testFallbackScenarios()
    .then(() => demonstrateRealWorldUsage())
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testFallbackScenarios, demonstrateRealWorldUsage };