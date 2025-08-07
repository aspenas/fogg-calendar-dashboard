#!/usr/bin/env node

/**
 * FOGG DNS Fix - Main Orchestrator
 * 
 * This is the main script that Leslie or administrators can run to fix the DNS issue.
 * It orchestrates all the DNS management, verification, monitoring, and backup strategies.
 */

const DNSManager = require('./dns-management-system');
const DNSVerifier = require('./dns-verifier');
const DNSMonitor = require('./dns-monitor');
const BackupDeploymentStrategy = require('./backup-deployment-strategy');
const fs = require('fs').promises;
const path = require('path');

class FOGGDNSFixer {
  constructor() {
    this.config = {
      domain: 'candlefish.ai',
      subdomain: 'fogg',
      target: 'fogg-calendar.netlify.app',
      timeout: 300000, // 5 minutes
    };

    this.results = {
      timestamp: new Date().toISOString(),
      steps: [],
      finalStatus: null,
      accessUrls: [],
      nextSteps: []
    };
  }

  /**
   * Main execution flow
   */
  async execute() {
    console.log('🚀 FOGG DNS Fix - Starting...');
    console.log('━'.repeat(60));
    console.log(`🎯 Target: ${this.config.subdomain}.${this.config.domain} → ${this.config.target}`);
    console.log(`⏱️  Timeout: ${this.config.timeout / 1000} seconds`);
    console.log('━'.repeat(60));

    try {
      // Step 1: Initial diagnosis
      await this.step('diagnosis', 'Running initial DNS diagnosis', async () => {
        return await this.diagnoseDNSIssue();
      });

      // Step 2: Attempt DNS fix
      await this.step('dns_fix', 'Attempting DNS configuration', async () => {
        const dnsManager = new DNSManager();
        return await dnsManager.configureDNS();
      });

      // Step 3: Verify DNS propagation
      if (this.getLastResult().success) {
        await this.step('verification', 'Verifying DNS propagation', async () => {
          const verifier = new DNSVerifier(this.config);
          return await verifier.verify();
        });
      }

      // Step 4: Deploy backup strategies if needed
      if (!this.isDNSWorking()) {
        await this.step('backup', 'Deploying backup strategies', async () => {
          const backup = new BackupDeploymentStrategy(this.config);
          return await backup.executeBackupPlan();
        });
      }

      // Step 5: Start monitoring
      await this.step('monitoring', 'Setting up monitoring', async () => {
        return await this.setupMonitoring();
      });

      // Step 6: Generate final report
      await this.generateFinalReport();

    } catch (error) {
      console.error('💥 Critical error:', error.message);
      await this.handleCriticalFailure(error);
    }

    return this.results;
  }

  /**
   * Run a step with error handling and logging
   */
  async step(id, description, operation) {
    console.log(`\n🔄 STEP: ${description}...`);
    console.log('─'.repeat(50));

    const startTime = Date.now();
    let result;

    try {
      result = await operation();
      const duration = Date.now() - startTime;

      this.results.steps.push({
        id: id,
        description: description,
        success: true,
        result: result,
        duration: Math.round(duration / 1000),
        timestamp: new Date().toISOString()
      });

      console.log(`✅ ${description} completed (${Math.round(duration / 1000)}s)`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.steps.push({
        id: id,
        description: description,
        success: false,
        error: error.message,
        duration: Math.round(duration / 1000),
        timestamp: new Date().toISOString()
      });

      console.error(`❌ ${description} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Diagnose current DNS issue
   */
  async diagnoseDNSIssue() {
    const dns = require('dns').promises;
    const axios = require('axios');

    const diagnosis = {
      dnsResolution: null,
      targetAccess: null,
      sslStatus: null,
      issues: []
    };

    // Check DNS resolution
    try {
      const addresses = await dns.resolveCname(this.config.subdomain + '.' + this.config.domain);
      diagnosis.dnsResolution = {
        success: addresses && addresses.includes(this.config.target),
        addresses: addresses
      };
    } catch (error) {
      diagnosis.dnsResolution = { success: false, error: error.message };
      diagnosis.issues.push('DNS_RESOLUTION_FAILED');
    }

    // Check target access
    try {
      const response = await axios.get(`https://${this.config.target}`, { timeout: 10000 });
      diagnosis.targetAccess = { success: response.status === 200, status: response.status };
    } catch (error) {
      diagnosis.targetAccess = { success: false, error: error.message };
      diagnosis.issues.push('TARGET_UNREACHABLE');
    }

    // Check intended URL
    try {
      const response = await axios.get(`https://${this.config.subdomain}.${this.config.domain}`, { 
        timeout: 10000,
        validateStatus: () => true 
      });
      diagnosis.sslStatus = { success: response.status < 400, status: response.status };
    } catch (error) {
      diagnosis.sslStatus = { success: false, error: error.message };
      diagnosis.issues.push('SSL_ACCESS_FAILED');
    }

    console.log('📊 Diagnosis Results:');
    console.log(`   DNS Resolution: ${diagnosis.dnsResolution.success ? '✅' : '❌'}`);
    console.log(`   Target Access: ${diagnosis.targetAccess.success ? '✅' : '❌'}`);
    console.log(`   SSL Status: ${diagnosis.sslStatus.success ? '✅' : '❌'}`);
    
    if (diagnosis.issues.length > 0) {
      console.log(`   Issues: ${diagnosis.issues.join(', ')}`);
    }

    return diagnosis;
  }

  /**
   * Setup monitoring
   */
  async setupMonitoring() {
    console.log('🔍 Setting up DNS monitoring...');
    
    // Create monitoring configuration
    const monitorConfig = {
      domain: this.config.domain,
      subdomain: this.config.subdomain,
      target: this.config.target,
      checkInterval: 60000, // 1 minute
      alertThreshold: 3
    };

    // Save monitoring config
    const configPath = path.join(__dirname, 'config', 'monitor-config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(monitorConfig, null, 2));

    console.log('   📝 Monitoring configuration saved');
    console.log('   🚀 To start monitoring: node dns-monitor.js');

    return {
      success: true,
      configPath: configPath,
      command: 'node dns-monitor.js'
    };
  }

  /**
   * Check if DNS is working from results
   */
  isDNSWorking() {
    const dnsStep = this.results.steps.find(step => step.id === 'dns_fix');
    const verificationStep = this.results.steps.find(step => step.id === 'verification');
    
    return dnsStep?.success && (!verificationStep || verificationStep.success);
  }

  /**
   * Get last step result
   */
  getLastResult() {
    return this.results.steps[this.results.steps.length - 1] || { success: false };
  }

  /**
   * Generate final report
   */
  async generateFinalReport() {
    console.log('\n📊 Generating final report...');

    // Determine final status
    const isDNSWorking = this.isDNSWorking();
    const hasBackups = this.results.steps.some(step => step.id === 'backup' && step.success);

    if (isDNSWorking) {
      this.results.finalStatus = 'DNS_FIXED';
      this.results.accessUrls = [`https://${this.config.subdomain}.${this.config.domain}`];
      this.results.nextSteps = [
        '✅ DNS is working correctly',
        '🔍 Monitor with: node dns-monitor.js',
        '📊 Check status at regular intervals'
      ];
    } else if (hasBackups) {
      this.results.finalStatus = 'BACKUP_ACTIVE';
      
      // Extract backup URLs from backup step
      const backupStep = this.results.steps.find(step => step.id === 'backup');
      if (backupStep?.result?.successful) {
        this.results.accessUrls = backupStep.result.successful.map(s => s.url);
      }
      
      this.results.nextSteps = [
        '⚠️  DNS still needs fixing',
        '🆘 Backup access available',
        '📞 Contact DNS provider support',
        '🔄 Re-run this script later'
      ];
    } else {
      this.results.finalStatus = 'FAILED';
      this.results.accessUrls = [`https://${this.config.target}`]; // Direct Netlify access
      this.results.nextSteps = [
        '❌ All automatic fixes failed',
        '📞 Manual intervention required',
        '🌐 Use direct URL for now',
        '📧 Contact technical support'
      ];
    }

    // Create detailed report file
    const reportPath = path.join(__dirname, 'reports', `fogg-dns-fix-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

    // Create user-friendly instructions
    await this.createUserInstructions();

    console.log(`   📄 Report saved: ${reportPath}`);
  }

  /**
   * Create user-friendly instructions for Leslie
   */
  async createUserInstructions() {
    const instructions = this.generateLeslieInstructions();
    
    const instructionsPath = path.join(__dirname, 'LESLIE_ACCESS_INSTRUCTIONS.md');
    await fs.writeFile(instructionsPath, instructions);

    console.log(`   📝 Instructions saved: LESLIE_ACCESS_INSTRUCTIONS.md`);
  }

  /**
   * Generate instructions specifically for Leslie
   */
  generateLeslieInstructions() {
    const status = this.results.finalStatus;
    const urls = this.results.accessUrls;
    const timestamp = new Date().toLocaleString();

    let instructions = `# FOGG Calendar Dashboard - Access Instructions for Leslie

**Generated:** ${timestamp}
**Status:** ${status}

---

`;

    if (status === 'DNS_FIXED') {
      instructions += `## ✅ Great News! DNS is Fixed

Your FOGG Calendar Dashboard is now accessible at:

**🎯 Main URL:** https://${this.config.subdomain}.${this.config.domain}

### What to do:
1. Click the link above or bookmark it
2. The site should load normally with HTTPS security
3. All features should work as expected

### If you see any issues:
- Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)
- Clear your browser cache
- Wait a few more minutes for full DNS propagation

`;

    } else if (status === 'BACKUP_ACTIVE') {
      instructions += `## ⚠️  Temporary Access Available

The main DNS is still being fixed, but we've set up backup access:

**🆘 Backup URLs (use any of these):**
${urls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

### What to do:
1. **Use the first URL above** for now
2. Bookmark it as a temporary solution
3. This will give you full access to the dashboard
4. We're still working on fixing the main domain

### When will the main URL work?
- DNS changes can take 24-48 hours to fully propagate
- We're monitoring the situation continuously
- You'll be notified when the main URL is working

`;

    } else {
      instructions += `## 🚨 Temporary Direct Access

We're still working on the DNS issue. For now, use the direct Netlify URL:

**🌐 Direct Access:** https://${this.config.target}

### What to do:
1. Use the direct link above
2. This bypasses the DNS issue completely
3. All dashboard features will work normally
4. Bookmark this URL for reliable access

### Next steps:
- Our team is working on a permanent fix
- You'll receive an update within 24 hours
- The main domain will be restored as soon as possible

`;
    }

    instructions += `---

## Technical Details (for reference)

**Target Domain:** ${this.config.subdomain}.${this.config.domain}
**Target Service:** ${this.config.target}
**Fix Attempts:** ${this.results.steps.length}

### Steps Performed:
${this.results.steps.map((step, i) => 
  `${i + 1}. ${step.description}: ${step.success ? '✅ Success' : '❌ Failed'}`
).join('\n')}

---

## Need Help?

If you have any issues accessing the dashboard:

1. **First:** Try all the URLs listed above
2. **Then:** Clear your browser cache and try again
3. **If still stuck:** Contact the technical team

The dashboard contains all your calendar and deployment data, so it's worth trying the different access methods if one doesn't work immediately.

---

*This document was automatically generated by the DNS fix system.*
`;

    return instructions;
  }

  /**
   * Handle critical failure
   */
  async handleCriticalFailure(error) {
    console.log('\n💥 CRITICAL FAILURE HANDLING');
    console.log('─'.repeat(50));

    this.results.finalStatus = 'CRITICAL_FAILURE';
    this.results.error = error.message;
    this.results.accessUrls = [`https://${this.config.target}`];
    this.results.nextSteps = [
      '🚨 Critical system failure occurred',
      '🌐 Use direct Netlify URL for access',
      '📞 Contact system administrator immediately',
      '📄 Provide error details from report'
    ];

    // Create emergency instructions
    const emergencyInstructions = `# 🚨 EMERGENCY ACCESS - FOGG Dashboard

**Critical Error Occurred:** ${error.message}
**Time:** ${new Date().toLocaleString()}

## Immediate Access:
**Use this URL:** https://${this.config.target}

## Next Steps:
1. Use the direct URL above to access your dashboard
2. Contact technical support immediately
3. Provide this error message: "${error.message}"
4. This is a temporary solution while we fix the issue

## For Leslie:
The dashboard is still available, just use the direct link above until we resolve the technical issue.
`;

    await fs.writeFile(
      path.join(__dirname, 'EMERGENCY_ACCESS_INSTRUCTIONS.md'),
      emergencyInstructions
    );

    console.log('📄 Emergency instructions created');
  }

  /**
   * Display final summary
   */
  displaySummary() {
    const status = this.results.finalStatus;
    const urls = this.results.accessUrls;

    console.log('\n' + '═'.repeat(60));
    console.log('🎯 FOGG DNS FIX - FINAL SUMMARY');
    console.log('═'.repeat(60));
    
    console.log(`Status: ${status}`);
    console.log(`Steps Completed: ${this.results.steps.length}`);
    console.log(`Success Rate: ${this.results.steps.filter(s => s.success).length}/${this.results.steps.length}`);

    console.log('\n📍 ACCESS URLS:');
    urls.forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });

    console.log('\n📋 FOR LESLIE:');
    if (status === 'DNS_FIXED') {
      console.log('✅ Everything is working! Use the main URL above.');
    } else {
      console.log('⚠️  Use the backup/direct URLs above while DNS is being fixed.');
    }

    console.log('\n🎯 NEXT STEPS:');
    this.results.nextSteps.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`);
    });

    console.log('\n📄 Files Created:');
    console.log('   - LESLIE_ACCESS_INSTRUCTIONS.md');
    console.log('   - reports/fogg-dns-fix-*.json');

    console.log('═'.repeat(60));
  }
}

// CLI interface
if (require.main === module) {
  console.log('🚀 FOGG DNS Fix System');
  console.log('━'.repeat(30));

  const fixer = new FOGGDNSFixer();

  fixer.execute()
    .then(results => {
      fixer.displaySummary();
      
      const exitCode = results.finalStatus === 'DNS_FIXED' ? 0 : 
                      results.finalStatus === 'BACKUP_ACTIVE' ? 0 : 1;
      
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 System failure:', error.message);
      process.exit(1);
    });
}

module.exports = FOGGDNSFixer;