#!/usr/bin/env node

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('🔍 Monitoring Build Status...\n');
console.log('=' .repeat(50));

async function checkGitHubActions() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/aapais/mainframe-ai-assistant/actions/runs?per_page=5',
      headers: {
        'User-Agent': 'Node.js'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const runs = JSON.parse(data);
          const latestRuns = runs.workflow_runs || [];

          console.log('\n📊 GitHub Actions Status:');
          console.log('-'.repeat(50));

          latestRuns.slice(0, 3).forEach(run => {
            const status = run.conclusion || run.status;
            const emoji = status === 'success' ? '✅' :
                         status === 'failure' ? '❌' :
                         status === 'in_progress' ? '🔄' : '⏸️';

            console.log(`${emoji} ${run.name || 'Workflow'}`);
            console.log(`   Status: ${status}`);
            console.log(`   Started: ${new Date(run.created_at).toLocaleString()}`);
            console.log('');
          });

          resolve(latestRuns);
        } catch (e) {
          console.log('⚠️  Could not fetch GitHub Actions status');
          resolve([]);
        }
      });
    }).on('error', () => {
      console.log('⚠️  Could not connect to GitHub API');
      resolve([]);
    });
  });
}

async function checkLocalBuild() {
  console.log('\n🏗️  Local Build Status:');
  console.log('-'.repeat(50));

  try {
    // Check if node_modules exists
    const { stdout: nmCheck } = await execAsync('ls node_modules 2>/dev/null | wc -l');
    const moduleCount = parseInt(nmCheck.trim());
    console.log(`📦 Node modules: ${moduleCount} packages installed`);

    // Try TypeScript compilation
    try {
      await execAsync('npx tsc --version');
      console.log('✅ TypeScript: Available');
    } catch {
      console.log('❌ TypeScript: Not available');
    }

    // Check for critical dependencies
    const criticalDeps = ['zod', 'uuid', 'axios', 'express', 'electron'];
    for (const dep of criticalDeps) {
      try {
        await execAsync(`ls node_modules/${dep} 2>/dev/null`);
        console.log(`✅ ${dep}: Installed`);
      } catch {
        console.log(`❌ ${dep}: Missing`);
      }
    }

    // Try build
    console.log('\n🔨 Build Test:');
    try {
      const { stdout, stderr } = await execAsync('npm run build:main 2>&1 | head -5', { timeout: 5000 });
      if (stderr || stdout.includes('error')) {
        console.log('❌ Build: Has errors');
      } else {
        console.log('✅ Build: Success');
      }
    } catch {
      console.log('❌ Build: Failed');
    }

  } catch (error) {
    console.log('❌ Local environment check failed');
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📋 SUMMARY REPORT');
  console.log('='.repeat(50));

  const timestamp = new Date().toLocaleString();
  console.log(`🕐 Generated at: ${timestamp}`);

  // Final recommendations
  console.log('\n💡 Recommendations:');
  console.log('1. Run: npm cache clean --force');
  console.log('2. Run: rm -rf node_modules package-lock.json');
  console.log('3. Run: npm install');
  console.log('4. Check GitHub Actions: https://github.com/aapais/mainframe-ai-assistant/actions');
  console.log('5. If errors persist, run Emergency Build Fix workflow on GitHub');
}

// Main execution
async function main() {
  await checkGitHubActions();
  await checkLocalBuild();
  await generateReport();
}

main().catch(console.error);