/**
 * Script to install pgvector extension in PostgreSQL
 */

const { Client } = require('pg');
require('dotenv').config();

async function installPgVector() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'assistente_db',
    user: process.env.DB_USER || 'assistente_user',
    password: process.env.DB_PASSWORD || 'assistente2024'
  });

  try {
    console.log('🔌 Conectando ao PostgreSQL...');
    await client.connect();

    // Try to create the vector extension
    console.log('📦 Instalando extensão pgvector...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✅ Extensão pgvector instalada com sucesso!');
    } catch (err) {
      if (err.message.includes('could not open extension control file')) {
        console.error('❌ pgvector não está instalado no sistema PostgreSQL');
        console.log('\n📝 Para instalar pgvector no PostgreSQL:');
        console.log('   Ubuntu/Debian: sudo apt-get install postgresql-16-pgvector');
        console.log('   macOS: brew install pgvector');
        console.log('   Windows WSL: sudo apt-get install postgresql-16-pgvector');
        return;
      }
      throw err;
    }

    // Verify installation
    const result = await client.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `);

    if (result.rows.length > 0) {
      console.log(`✅ pgvector versão ${result.rows[0].extversion} está ativo!`);
    }

    // Test vector operations
    const testResult = await client.query(`
      SELECT '[1,2,3]'::vector <=> '[3,2,1]'::vector as distance
    `);
    console.log(`✅ Teste de operação vetorial: distância = ${testResult.rows[0].distance}`);

    // Check if columns exist
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'knowledge_base'
      AND column_name LIKE 'embedding_%'
    `);

    if (columnsResult.rows.length === 0) {
      console.log('\n📝 Aplicando schema de embeddings multi-provider...');

      // Apply the setup script
      const fs = require('fs');
      const setupSql = fs.readFileSync('./scripts/database/setup-pgvector.sql', 'utf8');

      // Split by semicolons and execute each statement
      const statements = setupSql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await client.query(statement);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.warn(`⚠️ Aviso ao executar: ${err.message}`);
            }
          }
        }
      }

      console.log('✅ Schema de embeddings aplicado!');
    } else {
      console.log(`✅ ${columnsResult.rows.length} colunas de embedding já existem`);
    }

    // Show statistics
    const statsResult = await client.query(`
      SELECT
        COUNT(*) as total_docs,
        COUNT(embedding_openai) as openai_embeddings,
        COUNT(embedding_gemini) as gemini_embeddings,
        COUNT(embedding_anthropic) as anthropic_embeddings
      FROM knowledge_base
    `);

    const stats = statsResult.rows[0];
    console.log('\n📊 Estatísticas da base de conhecimento:');
    console.log(`   Total de documentos: ${stats.total_docs}`);
    console.log(`   Embeddings OpenAI: ${stats.openai_embeddings}`);
    console.log(`   Embeddings Gemini: ${stats.gemini_embeddings}`);
    console.log(`   Embeddings Anthropic: ${stats.anthropic_embeddings}`);

    console.log('\n🎉 pgvector está pronto para uso!');
    console.log('   O sistema agora usará busca vetorial otimizada automaticamente.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

installPgVector().catch(console.error);