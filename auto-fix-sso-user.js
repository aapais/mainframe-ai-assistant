/**
 * Auto Fix SSO User
 * Automatically transfers API keys from SSO temp users to andrepais
 * Run this after each SSO login
 */

const { Client } = require('pg');
require('dotenv').config();

async function autoFixSSOUser() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'assistente_db',
    user: process.env.DB_USER || 'assistente_user',
    password: process.env.DB_PASSWORD || 'assistente2024'
  });

  try {
    await client.connect();

    console.log('🔍 Auto-fix SSO user iniciado...\n');

    // Buscar usuário andrepais
    const andrepais = await client.query(
      "SELECT id FROM users WHERE email = 'andreapais@local.local'"
    );

    if (andrepais.rows.length === 0) {
      console.log('❌ Usuário andrepais não encontrado');
      return;
    }

    const andrepaisId = andrepais.rows[0].id;

    // Buscar usuários temporários SSO (começam com ea7318ba ou têm @temp.local)
    const tempUsers = await client.query(`
      SELECT id, email
      FROM users
      WHERE (email LIKE '%ea7318ba%' OR email LIKE '%@temp.local')
        AND id != $1
    `, [andrepaisId]);

    if (tempUsers.rows.length === 0) {
      console.log('✅ Nenhum usuário SSO temporário para limpar');
      return;
    }

    console.log(`🔧 Encontrados ${tempUsers.rows.length} usuário(s) SSO temporário(s)`);

    for (const tempUser of tempUsers.rows) {
      console.log(`\n📌 Processando: ${tempUser.email}`);

      // Transferir API keys
      const transferResult = await client.query(
        'UPDATE api_keys SET user_id = $1 WHERE user_id = $2',
        [andrepaisId, tempUser.id]
      );

      if (transferResult.rowCount > 0) {
        console.log(`   ✅ ${transferResult.rowCount} API key(s) transferida(s)`);
      }

      // Transferir outras possíveis relações (settings, preferences, etc.)
      await client.query(
        'UPDATE user_settings SET user_id = $1 WHERE user_id = $2',
        [andrepaisId, tempUser.id]
      ).catch(() => {}); // Ignora se a tabela não existir

      // Remover usuário temporário
      await client.query('DELETE FROM users WHERE id = $1', [tempUser.id]);
      console.log('   🗑️  Usuário temporário removido');
    }

    // Verificar estado final
    const finalCheck = await client.query(`
      SELECT COUNT(*) as api_keys_count
      FROM api_keys
      WHERE user_id = $1
    `, [andrepaisId]);

    console.log('\n✅ Limpeza concluída!');
    console.log(`   andrepais agora tem ${finalCheck.rows[0].api_keys_count} API key(s)`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

// Executar automaticamente
autoFixSSOUser()
  .then(() => {
    console.log('\n💡 Dica: Execute este script sempre após login SSO');
    console.log('   Ou configure para executar automaticamente no servidor');
  })
  .catch(console.error);

module.exports = autoFixSSOUser;