#!/usr/bin/env node

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let checkCount = 0;
const maxChecks = 30; // Check for 5 minutes (10s intervals)

console.log('🚀 Live Monitoring GitHub Actions...');
console.log('Repository: https://github.com/aapais/mainframe-ai-assistant');
console.log('=' .repeat(60));

async function getWorkflowRuns() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/aapais/mainframe-ai-assistant/actions/runs?per_page=10',
      headers: {
        'User-Agent': 'Node.js Monitor'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.workflow_runs || []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function checkStatus() {
  checkCount++;
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] Check #${checkCount}/${maxChecks}`);
  console.log('-'.repeat(60));

  const runs = await getWorkflowRuns();

  // Group by status
  const inProgress = runs.filter(r => r.status === 'in_progress' || r.status === 'queued');
  const completed = runs.filter(r => r.status === 'completed');
  const successful = completed.filter(r => r.conclusion === 'success');
  const failed = completed.filter(r => r.conclusion === 'failure');

  console.log(`\n📊 Current Status:`);
  console.log(`  🔄 In Progress: ${inProgress.length}`);
  console.log(`  ✅ Successful: ${successful.length}`);
  console.log(`  ❌ Failed: ${failed.length}`);
  console.log(`  📝 Total Recent: ${runs.length}`);

  // Show in-progress workflows
  if (inProgress.length > 0) {
    console.log('\n🔄 Running Workflows:');
    inProgress.forEach(run => {
      const runtime = Math.floor((Date.now() - new Date(run.created_at).getTime()) / 1000);
      console.log(`  - ${run.name} (${runtime}s elapsed)`);
    });
  }

  // Show latest completed
  if (completed.length > 0) {
    console.log('\n📝 Latest Completed:');
    completed.slice(0, 3).forEach(run => {
      const emoji = run.conclusion === 'success' ? '✅' : '❌';
      const duration = Math.floor((new Date(run.updated_at) - new Date(run.created_at)) / 1000);
      console.log(`  ${emoji} ${run.name} (${duration}s)`);
    });
  }

  // Check if all workflows are complete
  const allComplete = runs.length > 0 && inProgress.length === 0;

  if (allComplete) {
    console.log('\n✨ All workflows complete!');
    await generateFinalReport(runs);
    return true;
  }

  if (checkCount >= maxChecks) {
    console.log('\n⏰ Monitoring timeout reached');
    await generateFinalReport(runs);
    return true;
  }

  return false;
}

async function generateFinalReport(runs) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL STATUS REPORT');
  console.log('='.repeat(60));

  const successful = runs.filter(r => r.conclusion === 'success');
  const failed = runs.filter(r => r.conclusion === 'failure');

  console.log(`\nRepository: aapais/mainframe-ai-assistant`);
  console.log(`Total Runs: ${runs.length}`);
  console.log(`Success Rate: ${((successful.length / runs.length) * 100).toFixed(1)}%`);

  if (failed.length > 0) {
    console.log('\n❌ Failed Workflows:');
    failed.forEach(run => {
      console.log(`  - ${run.name}`);
      console.log(`    View: ${run.html_url}`);
    });
  }

  if (successful.length > 0) {
    console.log('\n✅ Successful Workflows:');
    successful.forEach(run => {
      console.log(`  - ${run.name}`);
    });
  }

  console.log('\n🔗 Quick Links:');
  console.log('  Actions: https://github.com/aapais/mainframe-ai-assistant/actions');
  console.log('  Repository: https://github.com/aapais/mainframe-ai-assistant');

  // Check local build one more time
  console.log('\n🏗️ Local Build Check:');
  try {
    const { stdout } = await execAsync('npm run build 2>&1 | grep -E "error|success" | head -5', { timeout: 5000 });
    if (stdout.includes('error')) {
      console.log('  ❌ Local build still has errors');
    } else {
      console.log('  ✅ Local build working');
    }
  } catch {
    console.log('  ⚠️ Could not verify local build');
  }

  console.log('\n💡 Next Steps:');
  if (failed.length > 0) {
    console.log('  1. Review failed workflow logs on GitHub');
    console.log('  2. Run: npm cache clean --force && npm install');
    console.log('  3. Manually trigger Emergency Build Fix workflow');
  } else {
    console.log('  ✅ All workflows successful! Ready for development.');
  }
}

// Start monitoring
async function monitor() {
  console.log('Starting live monitoring (checking every 10 seconds)...\n');

  const interval = setInterval(async () => {
    const complete = await checkStatus();
    if (complete) {
      clearInterval(interval);
      process.exit(0);
    }
  }, 10000);

  // Initial check
  await checkStatus();
}

monitor().catch(console.error);