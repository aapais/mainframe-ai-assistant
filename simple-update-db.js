const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🔧 Simplifying database - all entries are incidents\n');

try {
  // Just update all existing entries to be incidents
  const updateType = db.prepare("UPDATE entries SET entry_type = 'incident' WHERE 1=1");
  const result = updateType.run();
  console.log(`✅ Updated ${result.changes} entries to type 'incident'\n`);

  // Show current data
  const summary = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM entries
    WHERE entry_type = 'incident'
    GROUP BY status
    ORDER BY CASE
      WHEN status = 'aberto' THEN 1
      WHEN status = 'em_tratamento' THEN 2
      WHEN status = 'resolvido' THEN 3
      ELSE 4
    END
  `).all();

  console.log('📊 Current Database Contents:');
  summary.forEach(row => {
    const label = row.status === 'resolvido' ? 'resolvido (conhecimento)' : row.status;
    console.log(`   ${label}: ${row.count} incidents`);
  });

  const total = db.prepare("SELECT COUNT(*) as total FROM entries WHERE entry_type = 'incident'").get();
  console.log(`\n📋 Total incidents: ${total.total}`);

  console.log('\n✅ Database ready!');
  console.log('   - All entries are now incidents');
  console.log('   - Status "resolvido" = knowledge base');
  console.log('   - Status "aberto/em_tratamento" = active problems');

} catch (error) {
  console.error('Error:', error.message);
}

db.close();