#!/usr/bin/env node

/**
 * Health Check Script for FOGG Calendar Dashboard
 * Run this to verify the deployment is working correctly
 */

const https = require('https');
const chalk = require('chalk');

// Configuration
const SITE_URL = process.env.SITE_URL || 'https://fogg-calendar.netlify.app';
const API_BASE = `${SITE_URL}/.netlify/functions`;

const checks = [
  {
    name: 'Homepage loads',
    url: SITE_URL,
    expectedStatus: 200,
    critical: true
  },
  {
    name: 'Status API endpoint',
    url: `${API_BASE}/status`,
    expectedStatus: 200,
    critical: true
  },
  {
    name: 'Deploy API endpoint',
    url: `${API_BASE}/deploy`,
    method: 'OPTIONS',
    expectedStatus: 200,
    critical: false
  },
  {
    name: 'Static assets load',
    url: `${SITE_URL}/assets/index.js`,
    expectedStatus: 200,
    critical: false
  }
];

// Color helpers
const success = (msg) => console.log(chalk.green('✓'), msg);
const error = (msg) => console.log(chalk.red('✗'), msg);
const warning = (msg) => console.log(chalk.yellow('⚠'), msg);
const info = (msg) => console.log(chalk.blue('ℹ'), msg);

// HTTP request helper
function checkEndpoint(check) {
  return new Promise((resolve) => {
    const url = new URL(check.url);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: check.method || 'GET',
      headers: {
        'User-Agent': 'FOGG-Calendar-Health-Check/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const passed = res.statusCode === check.expectedStatus;
        resolve({
          ...check,
          passed,
          actualStatus: res.statusCode,
          responseTime: Date.now() - startTime
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        ...check,
        passed: false,
        error: err.message
      });
    });

    const startTime = Date.now();
    req.end();
  });
}

// Main execution
async function runHealthCheck() {
  console.log(chalk.bold.blue('\n🏥 FOGG Calendar Dashboard Health Check\n'));
  info(`Checking: ${SITE_URL}\n`);

  let allPassed = true;
  let criticalFailed = false;
  const results = [];

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}... `);
    const result = await checkEndpoint(check);
    results.push(result);

    if (result.passed) {
      success(`OK (${result.responseTime}ms)`);
    } else if (result.error) {
      error(`FAILED - ${result.error}`);
      allPassed = false;
      if (check.critical) criticalFailed = true;
    } else {
      error(`FAILED - Expected ${check.expectedStatus}, got ${result.actualStatus}`);
      allPassed = false;
      if (check.critical) criticalFailed = true;
    }
  }

  // Summary
  console.log(chalk.bold.blue('\n📊 Summary\n'));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${chalk.green(passed)}`);
  console.log(`Failed: ${chalk.red(failed)}`);
  
  const avgResponseTime = Math.round(
    results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + r.responseTime, 0) / 
    results.filter(r => r.responseTime).length
  );
  
  console.log(`Avg response time: ${avgResponseTime}ms\n`);

  // Final status
  if (allPassed) {
    console.log(chalk.bold.green('✅ All health checks passed! Dashboard is healthy.\n'));
    process.exit(0);
  } else if (criticalFailed) {
    console.log(chalk.bold.red('❌ Critical health checks failed! Dashboard needs attention.\n'));
    process.exit(1);
  } else {
    console.log(chalk.bold.yellow('⚠️ Some non-critical checks failed. Dashboard is partially healthy.\n'));
    process.exit(0);
  }
}

// Run the health check
runHealthCheck().catch((err) => {
  console.error(chalk.red('\n❌ Health check failed with error:'), err);
  process.exit(1);
});

// Export for use in other scripts
module.exports = { runHealthCheck, checkEndpoint };