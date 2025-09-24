#!/usr/bin/env node

/**
 * Test Script - Embedding Status Analysis
 * Verifies why embeddings are NULL in the database
 */

console.log('🔍 Embedding Status Analysis');
console.log('==============================\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? `Set (${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : 'NOT SET'}`);

// Load from .env file
require('dotenv').config();
console.log(`After .env load: ${process.env.OPENAI_API_KEY ? `Set (${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : 'NOT SET'}`);

// Test embedding service initialization
console.log('\n🧠 Embedding Service Test:');
try {
  const EmbeddingService = require('../src/services/embedding-service.js');

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    const embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);
    console.log('✅ EmbeddingService initialized successfully');

    // Test basic functionality (without actual API call)
    if (embeddingService.openai) {
      console.log('✅ OpenAI client created');
    } else {
      console.log('❌ OpenAI client not created');
    }
  } else {
    console.log('❌ Invalid or missing OpenAI API key');
    console.log('   Current value:', process.env.OPENAI_API_KEY);
  }
} catch (error) {
  console.error('❌ Error initializing embedding service:', error.message);
}

// Test database schema
console.log('\n🗄️ Database Schema Check:');
console.log('Expected: knowledge_base table should have "embedding" column of type vector(1536)');

console.log('\n📝 Recommendations:');
console.log('1. Set a real OpenAI API key in .env file');
console.log('2. Restart the backend server');
console.log('3. Re-upload documents or run embedding generation script');
console.log('4. Verify pgvector extension is installed');

console.log('\n🔧 Next Steps:');
console.log('- Add real OpenAI API key to .env');
console.log('- Create script to generate embeddings for existing entries');
console.log('- Enable vector similarity search');