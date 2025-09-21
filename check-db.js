const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('📊 Database Contents:\n');

// Check all entries
const all = db.prepare("SELECT id, title, entry_type, status, category FROM entries ORDER BY id DESC").all();
console.log(`Total entries: ${all.length}\n`);

// Group by entry_type
const byType = db.prepare("SELECT entry_type, COUNT(*) as count FROM entries GROUP BY entry_type").all();
console.log('By Type:');
byType.forEach(t => console.log(`  ${t.entry_type || 'null'}: ${t.count}`));

// Group by status
const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM entries GROUP BY status").all();
console.log('\nBy Status:');
byStatus.forEach(s => console.log(`  ${s.status || 'null'}: ${s.count}`));

// Show first 5 entries
console.log('\nFirst 5 entries:');
all.slice(0, 5).forEach(e => {
  console.log(`  [${e.id}] ${e.title} (${e.entry_type}, ${e.status})`);
});

// Specifically check for incidents
const incidents = db.prepare("SELECT * FROM entries WHERE entry_type IN ('incident', 'knowledge')").all();
console.log(`\nIncidents/Knowledge found: ${incidents.length}`);

db.close();