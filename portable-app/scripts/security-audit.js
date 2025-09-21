#!/usr/bin/env node
/**
 * Security Audit Automation Script
 * Runs npm audit and blocks if critical vulnerabilities are found
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

function runSecurityAudit() {
  console.log(chalk.blue('🔒 Running Security Audit...'));

  try {
    const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
    const audit = JSON.parse(auditResult);

    const { vulnerabilities } = audit.metadata;

    console.log(chalk.yellow(`\n📊 Vulnerabilities Found:`));
    console.log(`   Critical: ${vulnerabilities.critical}`);
    console.log(`   High: ${vulnerabilities.high}`);
    console.log(`   Moderate: ${vulnerabilities.moderate}`);
    console.log(`   Low: ${vulnerabilities.low}`);

    if (vulnerabilities.critical > 0 || vulnerabilities.high > 0) {
      console.log(chalk.red('\n❌ Critical or High vulnerabilities found!'));
      console.log(chalk.yellow('Run "npm audit fix" to attempt automatic fixes'));
      process.exit(1);
    }

    console.log(chalk.green('\n✅ No critical vulnerabilities found'));

  } catch (error) {
    if (error.status === 1) {
      console.log(chalk.red('Security audit failed'));
      process.exit(1);
    }
  }
}

// Auto-fix non-breaking vulnerabilities
function autoFix() {
  console.log(chalk.blue('\n🔧 Attempting to auto-fix vulnerabilities...'));
  try {
    execSync('npm audit fix', { stdio: 'inherit' });
    console.log(chalk.green('✅ Auto-fix completed'));
  } catch (error) {
    console.log(chalk.yellow('⚠️ Some vulnerabilities require manual review'));
  }
}

// Run audit
runSecurityAudit();

// Attempt auto-fix if requested
if (process.argv.includes('--fix')) {
  autoFix();
}