#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Database setup
const dbPath = path.join(__dirname, '..', 'memory', 'knowledge-base.db');
const templatesDir = path.join(__dirname, '..', 'assets', 'kb-templates');

// Ensure memory directory exists
const memoryDir = path.dirname(dbPath);
if (!fs.existsSync(memoryDir)) {
  fs.mkdirSync(memoryDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    problem TEXT NOT NULL,
    solution TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL, -- JSON array as string
    severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create FTS5 virtual table for full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_search USING fts5(
    title,
    problem,
    solution,
    category,
    tags,
    content=knowledge_entries,
    content_rowid=id
  );

  -- Trigger to keep FTS5 table in sync
  CREATE TRIGGER IF NOT EXISTS knowledge_entries_ai AFTER INSERT ON knowledge_entries BEGIN
    INSERT INTO knowledge_search(rowid, title, problem, solution, category, tags)
    VALUES (new.id, new.title, new.problem, new.solution, new.category, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS knowledge_entries_ad AFTER DELETE ON knowledge_entries BEGIN
    INSERT INTO knowledge_search(knowledge_search, rowid, title, problem, solution, category, tags)
    VALUES('delete', old.id, old.title, old.problem, old.solution, old.category, old.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS knowledge_entries_au AFTER UPDATE ON knowledge_entries BEGIN
    INSERT INTO knowledge_search(knowledge_search, rowid, title, problem, solution, category, tags)
    VALUES('delete', old.id, old.title, old.problem, old.solution, old.category, old.tags);
    INSERT INTO knowledge_search(rowid, title, problem, solution, category, tags)
    VALUES (new.id, new.title, new.problem, new.solution, new.category, new.tags);
  END;

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_category ON knowledge_entries(category);
  CREATE INDEX IF NOT EXISTS idx_severity ON knowledge_entries(severity);
  CREATE INDEX IF NOT EXISTS idx_created_at ON knowledge_entries(created_at);
`);

// Function to load JSON templates
function loadTemplates() {
  const templates = [];

  if (!fs.existsSync(templatesDir)) {
    console.error(`Templates directory not found: ${templatesDir}`);
    return templates;
  }

  const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));

  for (const file of templateFiles) {
    const filePath = path.join(templatesDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const entries = JSON.parse(content);

      if (Array.isArray(entries)) {
        templates.push(...entries);
        console.log(`Loaded ${entries.length} entries from ${file}`);
      } else {
        console.warn(`Invalid format in ${file}: expected array`);
      }
    } catch (error) {
      console.error(`Error loading ${file}:`, error.message);
    }
  }

  return templates;
}

// Function to insert entries
function insertEntries(entries) {
  const insertStmt = db.prepare(`
    INSERT INTO knowledge_entries (title, problem, solution, category, tags, severity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((entries) => {
    for (const entry of entries) {
      try {
        insertStmt.run(
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          JSON.stringify(entry.tags || []),
          entry.severity || 'medium'
        );
      } catch (error) {
        console.error(`Error inserting entry "${entry.title}":`, error.message);
      }
    }
  });

  insertMany(entries);
}

// Function to verify search functionality
function testSearch() {
  console.log('\n--- Testing Search Functionality ---');

  const searchStmt = db.prepare(`
    SELECT
      e.id,
      e.title,
      e.problem,
      e.solution,
      e.category,
      e.tags,
      e.severity,
      e.created_at,
      e.updated_at,
      rank
    FROM knowledge_search
    JOIN knowledge_entries e ON knowledge_search.rowid = e.id
    WHERE knowledge_search MATCH ?
    ORDER BY rank
    LIMIT 5
  `);

  const testQueries = [
    'VSAM',
    'S0C7',
    'deadlock',
    'dataset not found',
    'JCL error'
  ];

  for (const query of testQueries) {
    console.log(`\nSearching for: "${query}"`);
    const startTime = Date.now();
    const results = searchStmt.all(query);
    const endTime = Date.now();

    console.log(`Found ${results.length} results in ${endTime - startTime}ms`);

    if (results.length > 0) {
      console.log(`Top result: ${results[0].title}`);
    }
  }
}

// Function to display statistics
function showStats() {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM knowledge_entries');
  const categoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM knowledge_entries
    GROUP BY category
    ORDER BY count DESC
  `);

  const totalCount = countStmt.get().count;
  const categories = categoryStmt.all();

  console.log('\n--- Database Statistics ---');
  console.log(`Total entries: ${totalCount}`);
  console.log('\nEntries by category:');
  categories.forEach(cat => {
    console.log(`  ${cat.category}: ${cat.count}`);
  });
}

// Main execution
function main() {
  console.log('Starting knowledge base seeding...');

  // Clear existing data
  db.exec('DELETE FROM knowledge_entries');
  console.log('Cleared existing data');

  // Load and insert templates
  const templates = loadTemplates();

  if (templates.length === 0) {
    console.error('No templates found to load');
    process.exit(1);
  }

  console.log(`\nInserting ${templates.length} entries...`);
  insertEntries(templates);

  // Show statistics
  showStats();

  // Test search functionality
  testSearch();

  // Rebuild FTS5 index for optimal performance
  console.log('\nRebuilding FTS5 index...');
  db.exec('INSERT INTO knowledge_search(knowledge_search) VALUES("rebuild")');

  console.log('\nDatabase seeding completed successfully!');
  db.close();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, loadTemplates, insertEntries, testSearch };