const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🔧 Fixing NULL IDs in database\n');

// Get all entries with NULL ids
const entries = db.prepare("SELECT rowid, * FROM entries").all();

console.log(`Found ${entries.length} entries to fix\n`);

// Update each entry to use rowid as id
const updateStmt = db.prepare("UPDATE entries SET id = ? WHERE rowid = ?");

const updateAll = db.transaction(() => {
  entries.forEach(entry => {
    if (entry.id === null) {
      updateStmt.run(entry.rowid, entry.rowid);
      console.log(`✅ Fixed ID for: ${entry.title} (ID: ${entry.rowid})`);
    }
  });
});

updateAll();

// Verify the fix
const fixed = db.prepare("SELECT id, title, status FROM entries ORDER BY id").all();
console.log('\n📊 Fixed entries:');
fixed.forEach(entry => {
  console.log(`   [${entry.id}] ${entry.title} - ${entry.status}`);
});

console.log('\n✨ IDs fixed successfully!');
db.close();