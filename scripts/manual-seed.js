#!/usr/bin/env node

// Manual database seeding without better-sqlite3 for now
// This creates the JSON data files that can be imported later

const fs = require('fs');
const path = require('path');

const memoryDir = path.join(__dirname, '..', 'memory');
const templatesDir = path.join(__dirname, '..', 'assets', 'kb-templates');

// Ensure memory directory exists
if (!fs.existsSync(memoryDir)) {
  fs.mkdirSync(memoryDir, { recursive: true });
}

// Load all template files
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
        console.log(`✅ Loaded ${entries.length} entries from ${file}`);
      } else {
        console.warn(`❌ Invalid format in ${file}: expected array`);
      }
    } catch (error) {
      console.error(`❌ Error loading ${file}:`, error.message);
    }
  }

  return templates;
}

// Create consolidated knowledge base file
function main() {
  console.log('🔄 Starting manual database seeding...');

  const templates = loadTemplates();

  if (templates.length === 0) {
    console.error('❌ No templates found to load');
    process.exit(1);
  }

  // Add IDs and timestamps to entries
  const processedEntries = templates.map((entry, index) => ({
    id: index + 1,
    ...entry,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Write consolidated file
  const outputPath = path.join(memoryDir, 'knowledge-entries.json');
  fs.writeFileSync(outputPath, JSON.stringify(processedEntries, null, 2));

  console.log(`✅ Exported ${processedEntries.length} entries to ${outputPath}`);

  // Show statistics
  const categoryStats = {};
  processedEntries.forEach(entry => {
    categoryStats[entry.category] = (categoryStats[entry.category] || 0) + 1;
  });

  console.log('\n📊 Statistics:');
  console.log(`Total entries: ${processedEntries.length}`);
  console.log('\nEntries by category:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

  console.log('\n🎉 Manual seeding completed successfully!');
  console.log('💡 The application can now load this data when the database is initialized.');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, loadTemplates };