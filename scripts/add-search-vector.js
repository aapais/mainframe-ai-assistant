/**
 * Script to add search_vector column for text search
 */

const { Client } = require('pg');
require('dotenv').config();

async function addSearchVector() {
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

    // Add search_vector column if it doesn't exist
    console.log('📝 Adicionando coluna search_vector...');

    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'knowledge_base'
      AND column_name = 'search_vector'
    `);

    if (checkColumn.rows.length === 0) {
      // Add the column
      await client.query(`
        ALTER TABLE knowledge_base
        ADD COLUMN IF NOT EXISTS search_vector tsvector
      `);
      console.log('✅ Coluna search_vector adicionada');

      // Create index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_kb_search_vector
        ON knowledge_base USING gin(search_vector)
      `);
      console.log('✅ Índice GIN criado para search_vector');

      // Update existing records
      await client.query(`
        UPDATE knowledge_base
        SET search_vector = to_tsvector('portuguese',
          COALESCE(title, '') || ' ' ||
          COALESCE(content, '') || ' ' ||
          COALESCE(summary, '') || ' ' ||
          COALESCE(category, '')
        )
      `);
      console.log('✅ Search vectors atualizados para todos os documentos');

      // Create trigger function
      await client.query(`
        CREATE OR REPLACE FUNCTION update_kb_search_vector()
        RETURNS trigger AS $$
        BEGIN
          NEW.search_vector := to_tsvector('portuguese',
            COALESCE(NEW.title, '') || ' ' ||
            COALESCE(NEW.content, '') || ' ' ||
            COALESCE(NEW.summary, '') || ' ' ||
            COALESCE(NEW.category, '')
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      console.log('✅ Função de trigger criada');

      // Create trigger
      await client.query(`
        DROP TRIGGER IF EXISTS trigger_update_kb_search_vector ON knowledge_base;
        CREATE TRIGGER trigger_update_kb_search_vector
        BEFORE INSERT OR UPDATE ON knowledge_base
        FOR EACH ROW
        EXECUTE FUNCTION update_kb_search_vector()
      `);
      console.log('✅ Trigger criado para atualização automática');

    } else {
      console.log('✅ Coluna search_vector já existe');
    }

    console.log('\n🎉 Sistema pronto para busca vetorial com pgvector!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addSearchVector().catch(console.error);