/**
 * Add API Key for andrepais user
 */

const { Client } = require('pg');
const cryptoService = require('./src/services/crypto-service');
require('dotenv').config();

async function addApiKeyForAndrepais() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'assistente_db',
    user: process.env.DB_USER || 'assistente_user',
    password: process.env.DB_PASSWORD || 'assistente2024'
  });

  try {
    await client.connect();

    console.log('🔑 Adding API Keys for andrepais\n');

    // Get andrepais user
    const userResult = await client.query(
      "SELECT id, email FROM users WHERE email = 'andreapais@local.local'"
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User andrepais not found!');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ Found user andrepais with ID: ${userId}\n`);

    // Check existing API keys
    const existingKeys = await client.query(
      'SELECT service FROM api_keys WHERE user_id = $1',
      [userId]
    );

    const existingServices = existingKeys.rows.map(k => k.service);
    console.log(`📊 Existing services: ${existingServices.length > 0 ? existingServices.join(', ') : 'None'}\n`);

    // Get next ID for the table
    const idResult = await client.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM api_keys');
    let nextId = idResult.rows[0].next_id;

    // Add OpenAI API key if not exists
    if (!existingServices.includes('openai') && process.env.OPENAI_API_KEY) {
      await client.query(
        `INSERT INTO api_keys (id, user_id, name, service, key_encrypted, masked, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [nextId++, userId, 'OpenAI API Key', 'openai',
         cryptoService.encrypt(process.env.OPENAI_API_KEY),
         cryptoService.maskApiKey(process.env.OPENAI_API_KEY), true]
      );
      console.log('✅ Added OpenAI API key');
    }

    // Add/Update Gemini API key
    if (process.env.GEMINI_API_KEY) {
      // Check if it exists
      const existingGemini = await client.query(
        'SELECT id FROM api_keys WHERE user_id = $1 AND service = $2',
        [userId, 'google']
      );

      if (existingGemini.rows.length > 0) {
        // Update existing
        await client.query(
          `UPDATE api_keys
           SET key_encrypted = $1, masked = $2, is_active = $3
           WHERE user_id = $4 AND service = $5`,
          [cryptoService.encrypt(process.env.GEMINI_API_KEY),
           cryptoService.maskApiKey(process.env.GEMINI_API_KEY),
           true, userId, 'google']
        );
        console.log('✅ Updated Google Gemini API key');
      } else {
        // Insert new
        await client.query(
          `INSERT INTO api_keys (id, user_id, name, service, key_encrypted, masked, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [nextId++, userId, 'Google Gemini API Key', 'google',
           cryptoService.encrypt(process.env.GEMINI_API_KEY),
           cryptoService.maskApiKey(process.env.GEMINI_API_KEY), true]
        );
        console.log('✅ Added Google Gemini API key');
      }
    }

    // Add Anthropic API key if not exists
    if (!existingServices.includes('anthropic') && process.env.ANTHROPIC_API_KEY) {
      await client.query(
        `INSERT INTO api_keys (id, user_id, name, service, key_encrypted, masked, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [nextId++, userId, 'Anthropic API Key', 'anthropic',
         cryptoService.encrypt(process.env.ANTHROPIC_API_KEY),
         cryptoService.maskApiKey(process.env.ANTHROPIC_API_KEY), true]
      );
      console.log('✅ Added Anthropic API key');
    }

    // Show final state
    const finalKeys = await client.query(
      `SELECT service, name, masked, is_active
       FROM api_keys
       WHERE user_id = $1
       ORDER BY service`,
      [userId]
    );

    console.log('\n📊 Final API Keys for andrepais:');
    finalKeys.rows.forEach(key => {
      console.log(`  ${key.service}: ${key.masked || 'Not set'} [${key.is_active ? '✅ Active' : '❌ Inactive'}]`);
    });

    console.log('\n✅ API keys successfully configured for andrepais!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addApiKeyForAndrepais().catch(console.error);