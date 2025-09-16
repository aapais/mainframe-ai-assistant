const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Initialize Hive Mind database
const dbPath = path.join(process.cwd(), '.claude-flow', 'hive-mind.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

try {
  const db = new Database(dbPath);

  // Create tables for hive mind
  db.exec(`
    CREATE TABLE IF NOT EXISTS swarms (
      id TEXT PRIMARY KEY,
      topology TEXT,
      max_agents INTEGER,
      strategy TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      swarm_id TEXT,
      type TEXT,
      task TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (swarm_id) REFERENCES swarms(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_agent TEXT,
      to_agent TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memory (
      key TEXT PRIMARY KEY,
      value TEXT,
      namespace TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize swarm
  const swarmId = 'swarm_' + Date.now();
  db.prepare(`
    INSERT INTO swarms (id, topology, max_agents, strategy, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(swarmId, 'hierarchical', 6, 'balanced', 'active');

  console.log('🐝 Hive Mind Initialized Successfully!');
  console.log('===================================');
  console.log('Swarm ID:', swarmId);
  console.log('Topology: hierarchical');
  console.log('Max Agents: 6');
  console.log('Strategy: balanced');
  console.log('Status: active');
  console.log('\n✅ Ready for agent spawning!');
  console.log('\n📋 Phase 1 Tasks (Core Transparency):');
  console.log('  1. Apply database migration');
  console.log('  2. Create AIAuthorizationDialog');
  console.log('  3. Implement AIAuthorizationService');
  console.log('  4. Create Cost Display components');

  db.close();
} catch (error) {
  console.error('❌ Error initializing Hive Mind:', error.message);
  process.exit(1);
}