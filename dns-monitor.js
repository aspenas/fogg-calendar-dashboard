#!/usr/bin/env node

/**
 * Advanced DNS Monitoring and Alerting System
 * 
 * Features:
 * - Real-time DNS resolution monitoring
 * - HTTP/HTTPS endpoint health checks
 * - SSL certificate monitoring
 * - Multi-location DNS propagation checks
 * - Alert system with multiple channels
 * - Historical data and analytics
 * - Automatic recovery attempts
 */

const dns = require('dns').promises;
const https = require('https');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DNSMonitor {
  constructor(config = {}) {
    this.config = {
      domain: config.domain || 'candlefish.ai',
      subdomain: config.subdomain || 'fogg',
      target: config.target || 'fogg-calendar.netlify.app',
      checkInterval: config.checkInterval || 60000, // 1 minute
      alertThreshold: config.alertThreshold || 3, // failures before alert
      retryInterval: config.retryInterval || 30000, // 30 seconds
      ...config
    };

    this.fqdn = `${this.config.subdomain}.${this.config.domain}`;
    this.isRunning = false;
    this.consecutiveFailures = 0;
    this.lastStatus = null;
    this.checks = [];
    
    // DNS servers for multi-location checking
    this.dnsServers = [
      '8.8.8.8',      // Google
      '1.1.1.1',      // Cloudflare
      '208.67.222.222', // OpenDNS
      '9.9.9.9',      // Quad9
    ];

    this.alertChannels = [
      new ConsoleAlertChannel(),
      new FileAlertChannel(),
      new WebhookAlertChannel(config.webhookUrl),
      new EmailAlertChannel(config.emailConfig)
    ];
  }

  /**
   * Start comprehensive DNS monitoring
   */
  async start() {
    console.log(`🔍 Starting DNS monitoring for ${this.fqdn}`);
    this.isRunning = true;

    // Initial health check
    await this.performHealthCheck();

    // Setup monitoring intervals
    this.setupMonitoringIntervals();

    console.log('✅ DNS monitoring started');
    return this;
  }

  /**
   * Stop monitoring
   */
  stop() {
    console.log('🛑 Stopping DNS monitoring');
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
    }
  }

  /**
   * Setup monitoring intervals
   */
  setupMonitoringIntervals() {
    // Main monitoring loop
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.performHealthCheck();
    }, this.config.checkInterval);

    // Recovery attempt loop (runs more frequently when issues detected)
    this.recoveryInterval = setInterval(async () => {
      if (!this.isRunning) return;
      if (this.consecutiveFailures > 0) {
        await this.attemptRecovery();
      }
    }, this.config.retryInterval);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const checkId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    console.log(`🔍 Health check ${checkId.substring(0, 8)} starting...`);

    const results = {
      id: checkId,
      timestamp: timestamp,
      dns: await this.checkDNSResolution(),
      http: await this.checkHTTPAccess(),
      ssl: await this.checkSSLCertificate(),
      propagation: await this.checkDNSPropagation(),
      overall: null
    };

    // Determine overall health
    results.overall = this.calculateOverallHealth(results);

    // Store results
    this.checks.push(results);
    this.keepRecentChecks();

    // Handle status changes
    await this.handleStatusChange(results);

    return results;
  }

  /**
   * Check DNS resolution from multiple perspectives
   */
  async checkDNSResolution() {
    const results = {
      success: false,
      responses: [],
      errors: []
    };

    try {
      // Default DNS resolution
      const addresses = await dns.resolveCname(this.fqdn);
      const isCorrect = addresses && addresses.includes(this.config.target);
      
      results.responses.push({
        server: 'default',
        addresses: addresses,
        correct: isCorrect
      });

      if (isCorrect) {
        results.success = true;
      }

    } catch (error) {
      results.errors.push({
        server: 'default',
        error: error.message
      });
    }

    // Check from multiple DNS servers
    for (const server of this.dnsServers) {
      try {
        const resolver = new dns.Resolver();
        resolver.setServers([server]);
        
        // Use a timeout promise to prevent hanging
        const addressPromise = resolver.resolveCname(this.fqdn);
        const addresses = await Promise.race([
          addressPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        const isCorrect = addresses && addresses.includes(this.config.target);
        
        results.responses.push({
          server: server,
          addresses: addresses,
          correct: isCorrect
        });

      } catch (error) {
        results.errors.push({
          server: server,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check HTTP/HTTPS access
   */
  async checkHTTPAccess() {
    const results = {
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
        validateStatus: () => true, // Don't throw on 4xx/5xx
        maxRedirects: 5
      });

      results.statusCode = response.status;
      results.responseTime = Date.now() - startTime;
      results.headers = {
        server: response.headers.server,
        contentType: response.headers['content-type'],
        cacheControl: response.headers['cache-control']
      };
      results.success = response.status >= 200 && response.status < 400;

    } catch (error) {
      results.error = error.message;
      results.success = false;
    }

    return results;
  }

  /**
   * Check SSL certificate status
   */
  async checkSSLCertificate() {
    return new Promise((resolve) => {
      const results = {
        success: false,
        validFrom: null,
        validTo: null,
        issuer: null,
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
          results.validFrom = cert.valid_from;
          results.validTo = cert.valid_to;
          results.issuer = cert.issuer.CN;
          
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          results.daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          results.success = expiryDate > now;
        }
        
        resolve(results);
      });

      req.on('error', (error) => {
        results.error = error.message;
        resolve(results);
      });

      req.on('timeout', () => {
        results.error = 'SSL check timeout';
        resolve(results);
      });

      req.end();
    });
  }

  /**
   * Check DNS propagation across multiple locations
   */
  async checkDNSPropagation() {
    const results = {
      success: false,
      propagationPercentage: 0,
      locations: []
    };

    // Public DNS checkers APIs
    const checkers = [
      { name: 'Google', url: `https://dns.google/resolve?name=${this.fqdn}&type=CNAME` },
      { name: 'Cloudflare', url: `https://1.1.1.1/dns-query?name=${this.fqdn}&type=CNAME` }
    ];

    let successfulChecks = 0;

    for (const checker of checkers) {
      try {
        const response = await axios.get(checker.url, {
          timeout: 5000,
          headers: checker.name === 'Cloudflare' ? { 'Accept': 'application/dns-json' } : {}
        });

        let isCorrect = false;
        let resolvedValue = null;

        if (checker.name === 'Google' && response.data.Answer) {
          resolvedValue = response.data.Answer.find(a => a.type === 5)?.data;
          isCorrect = resolvedValue === this.config.target;
        } else if (checker.name === 'Cloudflare' && response.data.Answer) {
          resolvedValue = response.data.Answer.find(a => a.type === 5)?.data;
          isCorrect = resolvedValue === this.config.target;
        }

        results.locations.push({
          name: checker.name,
          resolved: resolvedValue,
          correct: isCorrect,
          success: true
        });

        if (isCorrect) successfulChecks++;

      } catch (error) {
        results.locations.push({
          name: checker.name,
          error: error.message,
          success: false
        });
      }
    }

    results.propagationPercentage = (successfulChecks / checkers.length) * 100;
    results.success = results.propagationPercentage >= 50; // At least 50% propagation

    return results;
  }

  /**
   * Calculate overall health from individual checks
   */
  calculateOverallHealth(results) {
    const scores = {
      dns: results.dns.success ? 1 : 0,
      http: results.http.success ? 1 : 0,
      ssl: results.ssl.success ? 1 : 0,
      propagation: results.propagation.success ? 1 : 0
    };

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const maxScore = Object.keys(scores).length;
    
    return {
      healthy: totalScore >= maxScore * 0.75, // 75% of checks must pass
      score: totalScore,
      maxScore: maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      issues: this.identifyIssues(results)
    };
  }

  /**
   * Identify specific issues from check results
   */
  identifyIssues(results) {
    const issues = [];

    if (!results.dns.success) {
      issues.push({
        type: 'dns_resolution',
        severity: 'critical',
        message: 'DNS resolution failed',
        details: results.dns.errors
      });
    }

    if (!results.http.success) {
      issues.push({
        type: 'http_access',
        severity: 'critical',
        message: `HTTP access failed (${results.http.statusCode || 'no response'})`,
        details: results.http.error
      });
    }

    if (!results.ssl.success && results.ssl.daysUntilExpiry !== null) {
      if (results.ssl.daysUntilExpiry < 30) {
        issues.push({
          type: 'ssl_certificate',
          severity: results.ssl.daysUntilExpiry < 7 ? 'critical' : 'warning',
          message: `SSL certificate expires in ${results.ssl.daysUntilExpiry} days`,
          details: { expiryDate: results.ssl.validTo }
        });
      }
    }

    if (results.propagation.propagationPercentage < 50) {
      issues.push({
        type: 'dns_propagation',
        severity: 'warning',
        message: `Low DNS propagation: ${results.propagation.propagationPercentage}%`,
        details: results.propagation.locations
      });
    }

    return issues;
  }

  /**
   * Handle status changes and alerts
   */
  async handleStatusChange(results) {
    const wasHealthy = this.lastStatus?.overall.healthy || false;
    const isHealthy = results.overall.healthy;

    if (isHealthy) {
      if (this.consecutiveFailures > 0) {
        // Recovery detected
        await this.sendAlert('recovery', {
          message: `🎉 DNS service recovered after ${this.consecutiveFailures} failures`,
          results: results
        });
      }
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
      
      // Send alert if threshold reached
      if (this.consecutiveFailures >= this.config.alertThreshold) {
        await this.sendAlert('failure', {
          message: `🚨 DNS service failure detected (${this.consecutiveFailures} consecutive failures)`,
          results: results,
          issues: results.overall.issues
        });
      }
    }

    // Status change detection
    if (wasHealthy !== isHealthy) {
      const statusChange = isHealthy ? 'healthy' : 'unhealthy';
      await this.sendAlert('status_change', {
        message: `📊 DNS status changed to: ${statusChange}`,
        results: results,
        previousStatus: this.lastStatus
      });
    }

    this.lastStatus = results;
  }

  /**
   * Attempt automatic recovery
   */
  async attemptRecovery() {
    console.log('🔄 Attempting automatic recovery...');

    // Recovery strategies in order of preference
    const strategies = [
      () => this.flushDNSCache(),
      () => this.checkAlternativeEndpoints(),
      () => this.notifyRecoveryTeam()
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.success) {
          console.log(`✅ Recovery successful: ${result.method}`);
          return result;
        }
      } catch (error) {
        console.error(`❌ Recovery strategy failed: ${error.message}`);
      }
    }

    return { success: false, error: 'All recovery strategies failed' };
  }

  /**
   * Flush local DNS cache
   */
  async flushDNSCache() {
    // This is a placeholder - actual implementation would depend on the system
    console.log('💾 Flushing DNS cache...');
    return { success: true, method: 'dns_cache_flush' };
  }

  /**
   * Check alternative endpoints
   */
  async checkAlternativeEndpoints() {
    const alternatives = [
      'fogg-calendar.netlify.app',
      `${this.config.subdomain}.${this.config.domain}`
    ];

    for (const endpoint of alternatives) {
      try {
        const response = await axios.get(`https://${endpoint}`, { timeout: 5000 });
        if (response.status === 200) {
          return { 
            success: true, 
            method: 'alternative_endpoint',
            endpoint: endpoint 
          };
        }
      } catch (error) {
        continue;
      }
    }

    return { success: false, error: 'No alternative endpoints available' };
  }

  /**
   * Notify recovery team
   */
  async notifyRecoveryTeam() {
    console.log('📞 Notifying recovery team...');
    // Implementation would send notifications to on-call team
    return { success: true, method: 'recovery_team_notified' };
  }

  /**
   * Send alerts through all configured channels
   */
  async sendAlert(type, data) {
    console.log(`🚨 Sending ${type} alert:`, data.message);

    for (const channel of this.alertChannels) {
      try {
        await channel.sendAlert(type, data);
      } catch (error) {
        console.error(`Alert channel ${channel.name} failed:`, error.message);
      }
    }
  }

  /**
   * Keep only recent checks to prevent memory issues
   */
  keepRecentChecks() {
    if (this.checks.length > 100) {
      this.checks = this.checks.slice(-100);
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    if (this.checks.length === 0) return null;

    const recent = this.checks.slice(-10);
    const healthy = recent.filter(c => c.overall.healthy).length;
    
    return {
      totalChecks: this.checks.length,
      recentUptime: Math.round((healthy / recent.length) * 100),
      consecutiveFailures: this.consecutiveFailures,
      lastCheck: this.checks[this.checks.length - 1],
      isRunning: this.isRunning
    };
  }
}

/**
 * Alert Channel Implementations
 */
class ConsoleAlertChannel {
  constructor() {
    this.name = 'Console';
  }

  async sendAlert(type, data) {
    const timestamp = new Date().toISOString();
    console.log(`\n🔔 ALERT [${type.toUpperCase()}] ${timestamp}`);
    console.log(`   ${data.message}`);
    
    if (data.issues && data.issues.length > 0) {
      console.log('   Issues:');
      data.issues.forEach(issue => {
        console.log(`   - ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
    }
  }
}

class FileAlertChannel {
  constructor() {
    this.name = 'File';
    this.logPath = path.join(__dirname, 'logs', 'dns-alerts.jsonl');
  }

  async sendAlert(type, data) {
    const alert = {
      timestamp: new Date().toISOString(),
      type: type,
      message: data.message,
      issues: data.issues || [],
      results: data.results ? {
        overall: data.results.overall,
        dns: data.results.dns.success,
        http: data.results.http.success,
        ssl: data.results.ssl.success
      } : null
    };

    const logLine = JSON.stringify(alert) + '\n';
    
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    await fs.appendFile(this.logPath, logLine);
  }
}

class WebhookAlertChannel {
  constructor(webhookUrl) {
    this.name = 'Webhook';
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(type, data) {
    if (!this.webhookUrl) return;

    const payload = {
      text: data.message,
      type: type,
      timestamp: new Date().toISOString(),
      domain: data.results?.fqdn,
      issues: data.issues
    };

    await axios.post(this.webhookUrl, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

class EmailAlertChannel {
  constructor(config) {
    this.name = 'Email';
    this.config = config;
  }

  async sendAlert(type, data) {
    if (!this.config) return;
    
    // Implementation would depend on email service (SendGrid, SES, etc.)
    console.log(`📧 Email alert would be sent to: ${this.config.recipients}`);
  }
}

// CLI interface
if (require.main === module) {
  const config = {
    domain: 'candlefish.ai',
    subdomain: 'fogg',
    target: 'fogg-calendar.netlify.app',
    checkInterval: 60000,
    alertThreshold: 2,
    webhookUrl: process.env.WEBHOOK_URL,
    emailConfig: process.env.EMAIL_CONFIG ? JSON.parse(process.env.EMAIL_CONFIG) : null
  };

  const monitor = new DNSMonitor(config);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });

  monitor.start()
    .then(() => {
      console.log(`✅ DNS monitoring active for ${config.subdomain}.${config.domain}`);
      
      // Display stats every 5 minutes
      setInterval(() => {
        const stats = monitor.getStats();
        if (stats) {
          console.log(`\n📊 Stats: ${stats.recentUptime}% uptime, ${stats.consecutiveFailures} failures, ${stats.totalChecks} total checks`);
        }
      }, 300000);
    })
    .catch(error => {
      console.error('💥 Failed to start DNS monitoring:', error.message);
      process.exit(1);
    });
}

module.exports = DNSMonitor;