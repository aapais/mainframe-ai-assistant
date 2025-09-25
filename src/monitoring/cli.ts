#!/usr/bin/env node

/**
 * Monitoring CLI Tool
 * Command-line interface for search service monitoring
 */

import { Command } from 'commander';
import {
  MonitoredSearchService,
  demonstrateMonitoring,
  healthCheck,
  DEV_MONITORING_CONFIG,
  PROD_MONITORING_CONFIG,
} from './index';

const program = new Command();

program.name('search-monitor').description('Search Service Monitoring CLI').version('1.0.0');

// Health check command
program
  .command('health')
  .description('Check monitoring system health')
  .action(async () => {
    console.log('🔍 Checking monitoring system health...');

    try {
      const health = await healthCheck();

      console.log(
        `\nHealth Status: ${health.status === 'healthy' ? '✅' : '❌'} ${health.status.toUpperCase()}`
      );
      console.log('\nComponents:');

      for (const [component, status] of Object.entries(health.components)) {
        const icon =
          status === 'connected' ||
          status === 'active' ||
          status === 'enabled' ||
          status === 'configured' ||
          status === 'available' ||
          status === 'compliant'
            ? '✅'
            : '⚠️';
        console.log(`  ${icon} ${component}: ${status}`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  });

// Benchmark command
program
  .command('benchmark')
  .description('Run search performance benchmarks')
  .option('-e, --env <environment>', 'Environment (dev|prod)', 'dev')
  .action(async options => {
    console.log('🚀 Starting search performance benchmarks...');

    try {
      const config = options.env === 'prod' ? PROD_MONITORING_CONFIG : DEV_MONITORING_CONFIG;
      const searchService = new MonitoredSearchService('./knowledge.db', config);

      await searchService.initialize();

      const results = await searchService.runBenchmarks();

      console.log('\n📊 Benchmark Results:');
      console.log(`  Queries tested: ${results.queries.length}`);
      console.log(`  Total executions: ${results.results.length}`);
      console.log(`  Average response time: ${results.metrics.avgResponseTime.toFixed(2)}ms`);
      console.log(`  SLA compliance: ${results.metrics.slaCompliance.toFixed(1)}%`);
      console.log(`  Cache hit rate: ${results.metrics.cacheHitRate.toFixed(1)}%`);

      if (results.metrics.slaCompliance < 95) {
        console.warn('\n⚠️  Warning: SLA compliance below 95%');
      }

      if (results.metrics.avgResponseTime > 800) {
        console.warn('\n⚠️  Warning: Average response time approaching SLA threshold');
      }

      await searchService.shutdown();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    }
  });

// Load test command
program
  .command('load-test')
  .description('Run load testing')
  .option('-d, --duration <seconds>', 'Test duration in seconds', '60')
  .option('-c, --concurrency <users>', 'Concurrent users', '10')
  .option('-e, --env <environment>', 'Environment (dev|prod)', 'dev')
  .action(async options => {
    const duration = parseInt(options.duration);
    const concurrency = parseInt(options.concurrency);

    console.log(`🔥 Starting load test: ${concurrency} users for ${duration}s`);

    try {
      const config = options.env === 'prod' ? PROD_MONITORING_CONFIG : DEV_MONITORING_CONFIG;
      const searchService = new MonitoredSearchService('./knowledge.db', config);

      await searchService.initialize();

      const results = await searchService.runLoadTest(duration, concurrency);

      console.log('\n📊 Load Test Results:');
      console.log(`  Duration: ${results.duration}s`);
      console.log(`  Concurrent users: ${results.concurrency}`);
      console.log(`  Total queries: ${results.totalQueries}`);
      console.log(`  Queries per second: ${results.qps.toFixed(2)}`);
      console.log(`  SLA violations: ${results.slaViolations}`);
      console.log(
        `  Success rate: ${(((results.totalQueries - results.slaViolations) / results.totalQueries) * 100).toFixed(1)}%`
      );

      if (results.slaViolations > 0) {
        console.warn(`\n⚠️  Warning: ${results.slaViolations} SLA violations detected`);
      }

      await searchService.shutdown();
    } catch (error) {
      console.error('❌ Load test failed:', error);
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Start real-time monitoring')
  .option('-i, --interval <seconds>', 'Refresh interval', '30')
  .option('-e, --env <environment>', 'Environment (dev|prod)', 'dev')
  .action(async options => {
    const interval = parseInt(options.interval);

    console.log('📊 Starting real-time monitoring...');
    console.log(`   Refresh interval: ${interval}s`);
    console.log('   Press Ctrl+C to stop\n');

    try {
      const config = {
        ...(options.env === 'prod' ? PROD_MONITORING_CONFIG : DEV_MONITORING_CONFIG),
        dashboard: { refreshInterval: interval, autoStart: true },
      };

      const searchService = new MonitoredSearchService('./knowledge.db', config);
      await searchService.initialize();

      // Display initial metrics
      await displayMetrics(searchService);

      // Set up periodic updates
      const monitorInterval = setInterval(async () => {
        console.clear();
        console.log('📊 Real-time Search Service Monitoring\n');
        await displayMetrics(searchService);
      }, interval * 1000);

      // Handle shutdown
      process.on('SIGINT', async () => {
        clearInterval(monitorInterval);
        console.log('\n\n🔍 Stopping monitoring...');
        await searchService.shutdown();
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Monitoring failed:', error);
      process.exit(1);
    }
  });

// Profile command
program
  .command('profile')
  .description('Start profiling session')
  .option('-d, --duration <minutes>', 'Profiling duration in minutes', '5')
  .option('-n, --name <name>', 'Session name', 'cli_session')
  .action(async options => {
    const duration = parseInt(options.duration);

    console.log(`🔬 Starting profiling session: ${options.name}`);
    console.log(`   Duration: ${duration} minutes\n`);

    try {
      const searchService = new MonitoredSearchService();
      await searchService.initialize();

      const sessionId = await searchService.startProfiling(options.name);
      console.log(`📊 Profiling session started: ${sessionId}`);

      // Wait for duration
      await new Promise(resolve => setTimeout(resolve, duration * 60 * 1000));

      const session = await searchService.stopProfiling();

      console.log('\n📊 Profiling Session Results:');
      console.log(`  Session ID: ${session.id}`);
      console.log(`  Queries profiled: ${session.queries.length}`);
      console.log(`  Bottlenecks detected: ${session.bottlenecks.length}`);
      console.log(`  Performance grade: ${session.grade}`);

      if (session.bottlenecks.length > 0) {
        console.log('\n🐌 Detected Bottlenecks:');
        session.bottlenecks.forEach((bottleneck: any, index: number) => {
          console.log(`  ${index + 1}. ${bottleneck.operation}: ${bottleneck.impact}`);
        });
      }

      if (session.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        session.recommendations.forEach((rec: string, index: number) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }

      await searchService.shutdown();
    } catch (error) {
      console.error('❌ Profiling failed:', error);
      process.exit(1);
    }
  });

// Demo command
program
  .command('demo')
  .description('Run monitoring demonstration')
  .action(async () => {
    console.log('🎬 Starting monitoring demonstration...\n');

    try {
      await demonstrateMonitoring();
    } catch (error) {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate performance report')
  .option('-h, --hours <hours>', 'Report period in hours', '24')
  .option('-o, --output <file>', 'Output file (optional)')
  .action(async options => {
    const hours = parseInt(options.hours);

    console.log(`📄 Generating performance report for last ${hours} hours...`);

    try {
      const searchService = new MonitoredSearchService();
      await searchService.initialize();

      const report = await searchService.generateReport(hours);

      console.log('\n📊 Performance Report Summary:');
      console.log(`  Period: ${report.period}`);
      console.log(`  Total queries: ${report.performance.totalQueries}`);
      console.log(`  Average response time: ${report.performance.avgResponseTime.toFixed(2)}ms`);
      console.log(`  SLA compliance: ${report.performance.slaCompliance.toFixed(1)}%`);
      console.log(`  Cache hit rate: ${report.performance.cacheHitRate.toFixed(1)}%`);

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach((rec: string, index: number) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }

      if (options.output) {
        const fs = await import('fs');
        fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
        console.log(`\n📁 Full report saved to: ${options.output}`);
      }

      await searchService.shutdown();
    } catch (error) {
      console.error('❌ Report generation failed:', error);
      process.exit(1);
    }
  });

async function displayMetrics(searchService: MonitoredSearchService): Promise<void> {
  try {
    const metrics = await searchService.getMetrics();
    const dashboard = await searchService.getDashboard();

    console.log('🎯 SLA Status:');
    console.log(`  Response Time SLA: ${metrics.slaCompliance.toFixed(1)}% compliant`);
    console.log(`  Current Average: ${metrics.avgResponseTime.toFixed(2)}ms`);

    console.log('\n📊 Performance Metrics:');
    console.log(`  Total Queries: ${metrics.totalQueries}`);
    console.log(`  Queries/Hour: ${metrics.queriesPerHour || 0}`);
    console.log(`  P50 Response Time: ${metrics.p50ResponseTime.toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${metrics.p99ResponseTime.toFixed(2)}ms`);
    console.log(`  Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`  Error Rate: ${metrics.errorRate.toFixed(2)}%`);

    if (metrics.slaViolations > 0) {
      console.log(`\n⚠️  SLA Violations: ${metrics.slaViolations}`);
    }

    if (dashboard.alerts && dashboard.alerts.length > 0) {
      console.log('\n🚨 Active Alerts:');
      dashboard.alerts.forEach((alert: any) => {
        console.log(`  ${alert.severity.toUpperCase()}: ${alert.description}`);
      });
    }

    console.log(`\n🕐 Last updated: ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('Error displaying metrics:', error);
  }
}

// Parse command line arguments
program.parse();
