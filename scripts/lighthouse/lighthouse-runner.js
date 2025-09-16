#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class LighthouseRunner {
  constructor() {
    this.configFile = path.join(__dirname, '../../config/lighthouse/lighthouserc.js');
    this.reportsDir = path.join(__dirname, '../../reports/lighthouse');
    this.options = {
      stdio: 'inherit',
      env: { ...process.env }
    };
  }

  ensureDirectories() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  waitForServer(url = 'http://localhost:3000', timeout = 60000) {
    console.log(`⏳ Waiting for server at ${url}...`);
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        execSync(`curl -f ${url}`, { stdio: 'pipe' });
        console.log('✅ Server is ready');
        return true;
      } catch (error) {
        // Server not ready, wait
        require('child_process').execSync('sleep 2');
      }
    }

    throw new Error(`Server at ${url} not ready after ${timeout}ms`);
  }

  runCollection() {
    console.log('🏃 Running Lighthouse collection...');
    try {
      execSync(`npx lhci collect --config=${this.configFile}`, this.options);
      console.log('✅ Collection completed');
    } catch (error) {
      console.error('❌ Collection failed:', error.message);
      throw error;
    }
  }

  runAssertions() {
    console.log('🧪 Running Lighthouse assertions...');
    try {
      execSync(`npx lhci assert --config=${this.configFile}`, this.options);
      console.log('✅ Assertions passed');
    } catch (error) {
      console.error('❌ Assertions failed:', error.message);
      // Don't throw - we want to continue with reporting
    }
  }

  uploadReports() {
    console.log('📤 Uploading reports...');
    try {
      execSync(`npx lhci upload --config=${this.configFile}`, this.options);
      console.log('✅ Reports uploaded');
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      // Don't throw - reports are still saved locally
    }
  }

  generateHtmlReports() {
    console.log('📄 Generating HTML reports...');
    try {
      const lighthouseDir = './.lighthouseci';
      if (fs.existsSync(lighthouseDir)) {
        const reportFiles = fs.readdirSync(lighthouseDir)
          .filter(f => f.endsWith('.json'))
          .slice(0, 3); // Get latest 3 reports

        reportFiles.forEach((file, index) => {
          const jsonPath = path.join(lighthouseDir, file);
          const htmlPath = path.join(this.reportsDir, `report-${index + 1}.html`);

          execSync(`npx lighthouse-cli --chrome-flags="--headless" --output-path=${htmlPath} --output=html --quiet < ${jsonPath}`, {
            stdio: 'pipe'
          });
        });

        console.log('✅ HTML reports generated');
      }
    } catch (error) {
      console.error('⚠️ HTML report generation failed:', error.message);
    }
  }

  run(mode = 'full') {
    console.log('🚀 Starting Lighthouse CI runner...');
    console.log(`📋 Mode: ${mode}`);

    this.ensureDirectories();

    try {
      switch (mode) {
        case 'collect':
          this.runCollection();
          break;
        case 'assert':
          this.runAssertions();
          break;
        case 'upload':
          this.uploadReports();
          break;
        case 'full':
        default:
          this.runCollection();
          this.runAssertions();
          this.uploadReports();
          this.generateHtmlReports();
          break;
      }

      console.log('✅ Lighthouse CI completed successfully');
    } catch (error) {
      console.error('❌ Lighthouse CI failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';

  const runner = new LighthouseRunner();
  runner.run(mode);
}

module.exports = LighthouseRunner;