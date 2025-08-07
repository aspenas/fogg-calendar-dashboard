#!/usr/bin/env node

/**
 * DNS Verification System
 * 
 * Comprehensive verification of DNS propagation with:
 * - Multi-location checks
 * - Real-time propagation tracking
 * - SSL certificate verification
 * - Performance benchmarking
 * - Detailed reporting
 */

const dns = require('dns').promises;
const axios = require('axios');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class DNSVerifier {
  constructor(config = {}) {
    this.config = {
      domain: config.domain || 'candlefish.ai',
      subdomain: config.subdomain || 'fogg',
      target: config.target || 'fogg-calendar.netlify.app',
      timeout: config.timeout || 300000, // 5 minutes
      checkInterval: config.checkInterval || 10000, // 10 seconds
      ...config
    };

    this.fqdn = `${this.config.subdomain}.${this.config.domain}`;
    this.results = [];

    // Global DNS servers for comprehensive checking
    this.dnsServers = [
      { name: 'Google Primary', address: '8.8.8.8' },
      { name: 'Google Secondary', address: '8.8.4.4' },
      { name: 'Cloudflare Primary', address: '1.1.1.1' },
      { name: 'Cloudflare Secondary', address: '1.0.0.1' },
      { name: 'OpenDNS Primary', address: '208.67.222.222' },
      { name: 'OpenDNS Secondary', address: '208.67.220.220' },
      { name: 'Quad9', address: '9.9.9.9' },
      { name: 'Comodo', address: '8.26.56.26' }
    ];

    // Online DNS checkers
    this.onlineCheckers = [
      {
        name: 'whatsmydns.net',
        url: `https://www.whatsmydns.net/api/details?server=world&type=CNAME&query=${this.fqdn}`,
        parser: (data) => data.map(item => ({
          location: `${item.country} - ${item.city}`,
          result: item.response,
          success: item.response === this.config.target
        }))
      },
      {
        name: 'Google DNS',
        url: `https://dns.google/resolve?name=${this.fqdn}&type=CNAME`,
        parser: (data) => data.Answer ? data.Answer.map(answer => ({
          location: 'Google DNS',
          result: answer.data,
          success: answer.data === this.config.target
        })) : []
      }
    ];
  }

  /**
   * Run comprehensive DNS verification
   */
  async verify() {
    console.log(`🔍 Starting DNS verification for ${this.fqdn}`);
    console.log(`📋 Target: ${this.config.target}`);
    console.log(`⏰ Timeout: ${this.config.timeout / 1000}s`);
    console.log('─'.repeat(60));

    const startTime = Date.now();
    let lastCheck = null;

    // Initial check to see if already working
    const initialCheck = await this.performComprehensiveCheck();
    if (initialCheck.overall.success) {
      console.log('✅ DNS is already working!');
      return this.generateFinalReport(initialCheck, startTime);
    }

    console.log('⏳ DNS not yet propagated, starting monitoring...\n');

    // Monitor until timeout or success
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= this.config.timeout) {
          clearInterval(checkInterval);
          console.log('\n⏰ Verification timeout reached');
          resolve(this.generateFinalReport(lastCheck, startTime, 'timeout'));
          return;
        }

        try {
          const check = await this.performComprehensiveCheck();
          lastCheck = check;

          // Show progress
          const progress = this.calculateProgress(check);
          console.log(`📊 Progress: ${progress.percentage}% (${progress.successful}/${progress.total} checks passed)`);

          if (check.overall.success) {
            clearInterval(checkInterval);
            console.log('\n🎉 DNS verification successful!');
            resolve(this.generateFinalReport(check, startTime, 'success'));
            return;
          }

        } catch (error) {
          console.error(`❌ Check failed: ${error.message}`);
        }

        // Wait before next check
        await this.sleep(this.config.checkInterval);
      }, this.config.checkInterval);
    });
  }

  /**
   * Perform comprehensive DNS check
   */
  async performComprehensiveCheck() {
    const check = {
      timestamp: new Date().toISOString(),
      local: await this.checkLocalDNS(),
      servers: await this.checkDNSServers(),
      online: await this.checkOnlineServices(),
      http: await this.checkHTTPAccess(),
      ssl: await this.checkSSLCertificate(),
      performance: await this.benchmarkPerformance(),
      overall: null
    };

    // Calculate overall success
    check.overall = this.calculateOverallSuccess(check);
    
    this.results.push(check);
    return check;
  }

  /**
   * Check local DNS resolution
   */
  async checkLocalDNS() {
    const result = {
      success: false,
      addresses: null,
      error: null,
      responseTime: null
    };

    try {
      const startTime = Date.now();
      const addresses = await dns.resolveCname(this.fqdn);
      result.responseTime = Date.now() - startTime;
      
      result.addresses = addresses;
      result.success = addresses && addresses.includes(this.config.target);

    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Check resolution from multiple DNS servers
   */
  async checkDNSServers() {
    const results = [];

    for (const server of this.dnsServers) {
      const result = {
        name: server.name,
        address: server.address,
        success: false,
        addresses: null,
        error: null,
        responseTime: null
      };

      try {
        const resolver = new dns.Resolver();
        resolver.setServers([server.address]);
        
        const startTime = Date.now();
        const addressPromise = resolver.resolveCname(this.fqdn);
        
        // Add timeout to prevent hanging
        const addresses = await Promise.race([
          addressPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);

        result.responseTime = Date.now() - startTime;
        result.addresses = addresses;
        result.success = addresses && addresses.includes(this.config.target);

      } catch (error) {
        result.error = error.message;
      }

      results.push(result);
    }

    return {
      checks: results,
      successCount: results.filter(r => r.success).length,
      totalCount: results.length
    };
  }

  /**
   * Check online DNS services
   */
  async checkOnlineServices() {
    const results = [];

    for (const checker of this.onlineCheckers) {
      const result = {
        name: checker.name,
        success: false,
        locations: [],
        error: null
      };

      try {
        const response = await axios.get(checker.url, {
          timeout: 10000,
          headers: { 'Accept': 'application/json' }
        });

        const locations = checker.parser(response.data);
        result.locations = locations;
        result.success = locations.some(loc => loc.success);

      } catch (error) {
        result.error = error.message;
      }

      results.push(result);
    }

    return {
      checks: results,
      successCount: results.filter(r => r.success).length,
      totalCount: results.length
    };
  }

  /**
   * Check HTTP access
   */
  async checkHTTPAccess() {
    const result = {
      success: false,
      statusCode: null,
      responseTime: null,
      headers: null,
      error: null
    };

    try {
      const startTime = Date.now();
      const response = await axios.get(`https://${this.fqdn}`, {
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 5
      });

      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;
      result.headers = {
        server: response.headers.server,
        contentType: response.headers['content-type'],
        xNetlifyId: response.headers['x-nf-request-id']
      };
      result.success = response.status >= 200 && response.status < 400;

    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Check SSL certificate
   */
  async checkSSLCertificate() {
    return new Promise((resolve) => {
      const result = {
        success: false,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysUntilExpiry: null,
        error: null
      };

      const options = {
        hostname: this.fqdn,
        port: 443,
        method: 'GET',
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        
        if (cert && cert.valid_from) {
          result.issuer = cert.issuer.CN;
          result.validFrom = cert.valid_from;
          result.validTo = cert.valid_to;
          
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          result.daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          result.success = expiryDate > now;
        }
        
        resolve(result);
      });

      req.on('error', (error) => {
        result.error = error.message;
        resolve(result);
      });

      req.on('timeout', () => {
        req.destroy();
        result.error = 'SSL check timeout';
        resolve(result);
      });

      req.end();
    });
  }

  /**
   * Benchmark performance
   */
  async benchmarkPerformance() {
    const results = {
      dnsLookup: null,
      httpResponse: null,
      totalLoadTime: null,
      error: null
    };

    try {
      // DNS lookup timing
      const dnsStart = Date.now();
      await dns.resolveCname(this.fqdn);
      results.dnsLookup = Date.now() - dnsStart;

      // HTTP response timing
      const httpStart = Date.now();
      await axios.get(`https://${this.fqdn}`, { timeout: 10000 });
      results.httpResponse = Date.now() - httpStart;

      results.totalLoadTime = results.dnsLookup + results.httpResponse;

    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Calculate overall success
   */
  calculateOverallSuccess(check) {
    const checks = {
      local: check.local.success,
      servers: (check.servers.successCount / check.servers.totalCount) >= 0.5, // 50% of DNS servers
      online: check.online.successCount > 0, // At least one online service
      http: check.http.success,
      ssl: check.ssl.success
    };

    const successCount = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    
    return {
      success: successCount >= 3, // At least 3 out of 5 checks must pass
      score: successCount,
      totalChecks: totalChecks,
      percentage: Math.round((successCount / totalChecks) * 100),
      details: checks
    };
  }

  /**
   * Calculate progress for display
   */
  calculateProgress(check) {
    const allChecks = [
      ...check.servers.checks.map(c => c.success),
      ...check.online.checks.flatMap(c => c.locations.map(l => l.success)),
      check.local.success,
      check.http.success,
      check.ssl.success
    ];

    const successful = allChecks.filter(Boolean).length;
    const total = allChecks.length;

    return {
      successful: successful,
      total: total,
      percentage: Math.round((successful / total) * 100)
    };
  }

  /**
   * Generate final report
   */
  async generateFinalReport(finalCheck, startTime, status = 'unknown') {
    const duration = Date.now() - startTime;
    const report = {
      summary: {
        domain: this.fqdn,
        target: this.config.target,
        status: status,
        duration: Math.round(duration / 1000),
        timestamp: new Date().toISOString(),
        totalChecks: this.results.length
      },
      finalState: finalCheck,
      recommendations: this.generateRecommendations(finalCheck, status),
      nextSteps: this.generateNextSteps(finalCheck, status)
    };

    // Save detailed report
    const reportPath = path.join(__dirname, 'reports', `dns-verification-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    this.displaySummary(report);

    return report;
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations(check, status) {
    const recommendations = [];

    if (!check.local.success) {
      recommendations.push({
        type: 'dns_resolution',
        priority: 'high',
        message: 'DNS resolution failing locally - check DNS record configuration',
        action: 'Verify CNAME record points to correct target'
      });
    }

    if (check.servers.successCount < check.servers.totalCount * 0.5) {
      recommendations.push({
        type: 'dns_propagation',
        priority: 'medium',
        message: 'Poor DNS propagation across servers',
        action: 'Wait for full DNS propagation (up to 48 hours)'
      });
    }

    if (!check.http.success && check.local.success) {
      recommendations.push({
        type: 'http_configuration',
        priority: 'high',
        message: 'DNS working but HTTP access failing',
        action: 'Check Netlify site configuration and SSL settings'
      });
    }

    if (!check.ssl.success) {
      recommendations.push({
        type: 'ssl_certificate',
        priority: 'medium',
        message: 'SSL certificate issues detected',
        action: 'Force SSL certificate provisioning in Netlify dashboard'
      });
    }

    if (status === 'timeout') {
      recommendations.push({
        type: 'timeout',
        priority: 'high',
        message: 'DNS verification timed out',
        action: 'Consider manual DNS configuration or alternative providers'
      });
    }

    return recommendations;
  }

  /**
   * Generate next steps based on status
   */
  generateNextSteps(check, status) {
    const steps = [];

    if (status === 'success') {
      steps.push('✅ DNS is fully operational');
      steps.push('🔍 Monitor with: node dns-monitor.js');
      steps.push('📊 Set up continuous monitoring');
    } else if (status === 'timeout') {
      steps.push('⚠️  Consider manual DNS configuration');
      steps.push('🔄 Try alternative DNS provider (Cloudflare)');
      steps.push('📞 Contact domain registrar support');
    } else {
      steps.push('⏳ Continue waiting for DNS propagation');
      steps.push('🔍 Run verification again in 30 minutes');
      steps.push('📋 Check DNS record configuration');
    }

    return steps;
  }

  /**
   * Display summary to console
   */
  displaySummary(report) {
    console.log('\n' + '═'.repeat(60));
    console.log('🎯 DNS VERIFICATION SUMMARY');
    console.log('═'.repeat(60));
    
    console.log(`Domain: ${report.summary.domain}`);
    console.log(`Target: ${report.summary.target}`);
    console.log(`Status: ${report.summary.status.toUpperCase()}`);
    console.log(`Duration: ${report.summary.duration}s`);
    console.log(`Checks: ${report.summary.totalChecks}`);

    if (report.finalState?.overall) {
      console.log(`Success Rate: ${report.finalState.overall.percentage}%`);
    }

    console.log('\n📋 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      const priority = rec.priority === 'high' ? '🔴' : '🟡';
      console.log(`${i + 1}. ${priority} ${rec.message}`);
      console.log(`   → ${rec.action}`);
    });

    console.log('\n🎯 NEXT STEPS:');
    report.nextSteps.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`);
    });

    console.log('\n📄 Detailed report saved to: reports/');
    console.log('═'.repeat(60));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const config = {
    domain: process.argv[2] || 'candlefish.ai',
    subdomain: process.argv[3] || 'fogg',
    target: process.argv[4] || 'fogg-calendar.netlify.app',
    timeout: parseInt(process.argv[5]) || 300000
  };

  console.log('🚀 DNS Verification System');
  console.log('─'.repeat(30));

  const verifier = new DNSVerifier(config);

  verifier.verify()
    .then(report => {
      const exitCode = report.summary.status === 'success' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 Verification failed:', error.message);
      process.exit(1);
    });
}

module.exports = DNSVerifier;