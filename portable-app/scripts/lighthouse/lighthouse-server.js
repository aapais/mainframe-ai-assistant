#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LighthouseServer {
  constructor() {
    this.serverPort = 9001;
    this.dbPath = path.join(__dirname, '../../reports/lighthouse/lhci.db');
    this.reportsDir = path.join(__dirname, '../../reports/lighthouse');
    this.serverProcess = null;
  }

  ensureDirectories() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async startServer() {
    this.ensureDirectories();

    console.log('🚀 Starting Lighthouse CI Server...');
    console.log(`📊 Port: ${this.serverPort}`);
    console.log(`💾 Database: ${this.dbPath}`);

    const args = [
      'server',
      '--port', this.serverPort.toString(),
      '--storage.storageMethod', 'sql',
      '--storage.sqlDialect', 'sqlite',
      '--storage.sqlDatabasePath', this.dbPath
    ];

    this.serverProcess = spawn('npx', ['lhci', ...args], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    this.serverProcess.on('error', (error) => {
      console.error('❌ Failed to start Lighthouse server:', error);
      process.exit(1);
    });

    this.serverProcess.on('exit', (code) => {
      console.log(`🔚 Lighthouse server exited with code ${code}`);
      process.exit(code);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Lighthouse server...');
      if (this.serverProcess) {
        this.serverProcess.kill('SIGINT');
      }
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down Lighthouse server...');
      if (this.serverProcess) {
        this.serverProcess.kill('SIGTERM');
      }
    });

    // Wait a moment for server to start
    setTimeout(() => {
      console.log(`✅ Lighthouse CI Server running at http://localhost:${this.serverPort}`);
      console.log('📊 View reports and trends in your browser');
    }, 2000);
  }

  getServerInfo() {
    return {
      url: `http://localhost:${this.serverPort}`,
      port: this.serverPort,
      dbPath: this.dbPath,
      reportsDir: this.reportsDir
    };
  }
}

// CLI handling
if (require.main === module) {
  const server = new LighthouseServer();
  server.startServer().catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = LighthouseServer;