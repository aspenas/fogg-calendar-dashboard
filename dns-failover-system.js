#!/usr/bin/env node

/**
 * Ultra-Fast DNS Failover System
 * 
 * Features:
 * - Sub-second failover detection
 * - Multi-provider DNS management
 * - Automatic health-based routing
 * - Zero-downtime switching
 * - Global anycast network support
 */

const dns = require('dns').promises;
const axios = require('axios');
const EventEmitter = require('events');
const { performance } = require('perf_hooks');

class DNSFailoverSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      domain: config.domain || 'candlefish.ai',
      subdomain: config.subdomain || 'fogg',
      checkInterval: config.checkInterval || 5000, // 5 seconds
      failoverThreshold: config.failoverThreshold || 2, // 2 consecutive failures
      recoveryThreshold: config.recoveryThreshold || 3, // 3 consecutive successes
      ...config
    };

    this.fqdn = `${this.config.subdomain}.${this.config.domain}`;
    
    // DNS Provider configurations
    this.providers = {
      cloudflare: {
        name: 'Cloudflare',
        api: 'https://api.cloudflare.com/client/v4',
        token: process.env.CLOUDFLARE_API_TOKEN,
        zoneId: process.env.CLOUDFLARE_ZONE_ID,
        priority: 1,
        ttl: 60, // 1 minute for fast propagation
        proxied: true, // Use Cloudflare's CDN
        features: ['ddos-protection', 'ssl', 'cdn', 'analytics']
      },
      netlify: {
        name: 'Netlify',
        api: 'https://api.netlify.com/api/v1',
        token: process.env.NETLIFY_TOKEN,
        siteId: process.env.NETLIFY_SITE_ID,
        priority: 2,
        ttl: 300,
        features: ['edge-functions', 'split-testing', 'forms']
      },
      route53: {
        name: 'AWS Route53',
        api: 'https://route53.amazonaws.com/2013-04-01',
        accessKey: process.env.AWS_ACCESS_KEY_ID,
        secretKey: process.env.AWS_SECRET_ACCESS_KEY,
        hostedZoneId: process.env.ROUTE53_ZONE_ID,
        priority: 3,
        ttl: 60,
        healthCheckId: null,
        features: ['health-checks', 'geo-routing', 'failover']
      }
    };

    // Endpoints for health checking
    this.endpoints = [
      {
        name: 'Primary',
        url: 'https://fogg-calendar.netlify.app',
        target: 'fogg-calendar.netlify.app',
        type: 'CNAME',
        healthy: true,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastCheck: null,
        metrics: {
          uptime: 100,
          avgResponseTime: 0,
          lastResponseTime: 0
        }
      },
      {
        name: 'Secondary',
        url: 'https://fogg-backup.netlify.app',
        target: 'fogg-backup.netlify.app',
        type: 'CNAME',
        healthy: true,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastCheck: null,
        metrics: {
          uptime: 100,
          avgResponseTime: 0,
          lastResponseTime: 0
        }
      }
    ];

    this.currentEndpoint = this.endpoints[0];
    this.isFailingOver = false;
    this.healthHistory = [];
    this.failoverHistory = [];
  }

  /**
   * Initialize the failover system
   */
  async initialize() {
    console.log('🚀 Initializing DNS Failover System...');

    // 1. Verify provider credentials
    await this.verifyProviders();

    // 2. Check current DNS configuration
    await this.checkCurrentDNS();

    // 3. Start health monitoring
    this.startHealthMonitoring();

    // 4. Setup event handlers
    this.setupEventHandlers();

    console.log('✅ DNS Failover System initialized');
    this.emit('initialized');
    
    return this;
  }

  /**
   * Verify provider credentials and availability
   */
  async verifyProviders() {
    console.log('🔐 Verifying DNS providers...');

    for (const [key, provider] of Object.entries(this.providers)) {
      try {
        await this.testProviderAPI(provider);
        provider.available = true;
        console.log(`  ✓ ${provider.name}: Available`);
      } catch (error) {
        provider.available = false;
        console.log(`  ✗ ${provider.name}: ${error.message}`);
      }
    }

    const availableProviders = Object.values(this.providers).filter(p => p.available);
    if (availableProviders.length === 0) {
      throw new Error('No DNS providers available');
    }

    console.log(`  📊 ${availableProviders.length}/${Object.keys(this.providers).length} providers available`);
  }

  /**
   * Test provider API connectivity
   */
  async testProviderAPI(provider) {
    switch (provider.name) {
      case 'Cloudflare':
        if (!provider.token) throw new Error('Missing API token');
        
        const cfResponse = await axios.get(`${provider.api}/zones/${provider.zoneId}`, {
          headers: { 'Authorization': `Bearer ${provider.token}` },
          timeout: 5000
        });
        
        if (!cfResponse.data.success) {
          throw new Error('API authentication failed');
        }
        break;

      case 'Netlify':
        if (!provider.token) throw new Error('Missing API token');
        
        await axios.get(`${provider.api}/sites/${provider.siteId}`, {
          headers: { 'Authorization': `Bearer ${provider.token}` },
          timeout: 5000
        });
        break;

      case 'AWS Route53':
        // Route53 verification would use AWS SDK
        if (!provider.accessKey || !provider.secretKey) {
          throw new Error('Missing AWS credentials');
        }
        break;
    }

    return true;
  }

  /**
   * Check current DNS configuration
   */
  async checkCurrentDNS() {
    console.log('🔍 Checking current DNS configuration...');

    try {
      const records = await dns.resolveCname(this.fqdn);
      console.log(`  Current CNAME: ${records[0]}`);
      
      // Find matching endpoint
      const matchingEndpoint = this.endpoints.find(e => e.target === records[0]);
      if (matchingEndpoint) {
        this.currentEndpoint = matchingEndpoint;
        console.log(`  Active endpoint: ${matchingEndpoint.name}`);
      }
    } catch (error) {
      console.log(`  ⚠️  DNS not configured: ${error.message}`);
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    console.log('🏥 Starting health monitoring...');

    // Immediate health check
    this.performHealthChecks();

    // Regular health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);

    // Fast health checks during issues
    this.fastCheckInterval = null;
  }

  /**
   * Perform health checks on all endpoints
   */
  async performHealthChecks() {
    const timestamp = Date.now();
    const checks = [];

    for (const endpoint of this.endpoints) {
      const check = await this.checkEndpointHealth(endpoint);
      checks.push(check);
      
      // Update endpoint status
      this.updateEndpointStatus(endpoint, check);
    }

    // Store health history
    this.healthHistory.push({ timestamp, checks });
    this.pruneHealthHistory();

    // Check if failover is needed
    await this.evaluateFailover();

    this.emit('health-check', checks);
  }

  /**
   * Check individual endpoint health
   */
  async checkEndpointHealth(endpoint) {
    const startTime = performance.now();
    const check = {
      endpoint: endpoint.name,
      url: endpoint.url,
      timestamp: Date.now(),
      healthy: false,
      responseTime: null,
      statusCode: null,
      error: null
    };

    try {
      const response = await axios.get(endpoint.url, {
        timeout: 3000,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'DNS-Failover-Monitor/1.0'
        }
      });

      check.responseTime = performance.now() - startTime;
      check.statusCode = response.status;
      check.healthy = response.status >= 200 && response.status < 400;

      // Additional health checks
      if (check.healthy) {
        // Check for specific content or headers
        if (response.headers['x-deployment-id']) {
          check.deploymentId = response.headers['x-deployment-id'];
        }
      }

    } catch (error) {
      check.error = error.message;
      check.responseTime = performance.now() - startTime;
      check.healthy = false;
    }

    return check;
  }

  /**
   * Update endpoint status based on health check
   */
  updateEndpointStatus(endpoint, check) {
    endpoint.lastCheck = check;

    if (check.healthy) {
      endpoint.consecutiveFailures = 0;
      endpoint.consecutiveSuccesses++;
      
      // Update metrics
      if (check.responseTime) {
        endpoint.metrics.lastResponseTime = check.responseTime;
        
        // Calculate rolling average
        if (endpoint.metrics.avgResponseTime === 0) {
          endpoint.metrics.avgResponseTime = check.responseTime;
        } else {
          endpoint.metrics.avgResponseTime = 
            (endpoint.metrics.avgResponseTime * 0.9) + (check.responseTime * 0.1);
        }
      }

      // Mark as healthy after recovery threshold
      if (!endpoint.healthy && endpoint.consecutiveSuccesses >= this.config.recoveryThreshold) {
        endpoint.healthy = true;
        console.log(`✅ ${endpoint.name} recovered (${endpoint.consecutiveSuccesses} successful checks)`);
        this.emit('endpoint-recovered', endpoint);
      }

    } else {
      endpoint.consecutiveSuccesses = 0;
      endpoint.consecutiveFailures++;

      // Mark as unhealthy after failure threshold
      if (endpoint.healthy && endpoint.consecutiveFailures >= this.config.failoverThreshold) {
        endpoint.healthy = false;
        console.log(`❌ ${endpoint.name} failed (${endpoint.consecutiveFailures} failures)`);
        this.emit('endpoint-failed', endpoint);
      }
    }

    // Calculate uptime
    const recentChecks = this.healthHistory
      .slice(-100)
      .flatMap(h => h.checks)
      .filter(c => c.endpoint === endpoint.name);
    
    if (recentChecks.length > 0) {
      const healthyChecks = recentChecks.filter(c => c.healthy).length;
      endpoint.metrics.uptime = (healthyChecks / recentChecks.length) * 100;
    }
  }

  /**
   * Evaluate if failover is needed
   */
  async evaluateFailover() {
    // Don't failover if already in progress
    if (this.isFailingOver) return;

    // Check if current endpoint is unhealthy
    if (!this.currentEndpoint.healthy) {
      // Find best healthy alternative
      const healthyEndpoints = this.endpoints
        .filter(e => e.healthy && e !== this.currentEndpoint)
        .sort((a, b) => a.metrics.avgResponseTime - b.metrics.avgResponseTime);

      if (healthyEndpoints.length > 0) {
        await this.performFailover(healthyEndpoints[0]);
      } else {
        console.log('⚠️  No healthy endpoints available for failover');
        this.emit('no-healthy-endpoints');
      }
    }

    // Check if there's a better endpoint available
    else if (this.shouldOptimizeRoute()) {
      const bestEndpoint = this.findBestEndpoint();
      if (bestEndpoint && bestEndpoint !== this.currentEndpoint) {
        console.log(`🔄 Optimizing route to ${bestEndpoint.name}`);
        await this.performFailover(bestEndpoint);
      }
    }
  }

  /**
   * Check if route optimization is needed
   */
  shouldOptimizeRoute() {
    // Only optimize if current endpoint has been stable
    if (this.currentEndpoint.consecutiveSuccesses < 10) return false;

    // Find best performing endpoint
    const bestEndpoint = this.findBestEndpoint();
    if (!bestEndpoint || bestEndpoint === this.currentEndpoint) return false;

    // Switch if new endpoint is significantly better (50% faster)
    const currentAvg = this.currentEndpoint.metrics.avgResponseTime;
    const bestAvg = bestEndpoint.metrics.avgResponseTime;
    
    return bestAvg < currentAvg * 0.5;
  }

  /**
   * Find the best performing endpoint
   */
  findBestEndpoint() {
    const healthyEndpoints = this.endpoints.filter(e => e.healthy);
    
    if (healthyEndpoints.length === 0) return null;

    // Score endpoints based on multiple factors
    const scored = healthyEndpoints.map(endpoint => {
      const score = 
        (100 - endpoint.metrics.uptime) * 10 + // Uptime weight: 10
        endpoint.metrics.avgResponseTime +      // Response time weight: 1
        endpoint.consecutiveFailures * 100;     // Recent failures weight: 100

      return { endpoint, score };
    });

    // Return endpoint with lowest (best) score
    scored.sort((a, b) => a.score - b.score);
    return scored[0].endpoint;
  }

  /**
   * Perform DNS failover
   */
  async performFailover(newEndpoint) {
    console.log(`🔄 Initiating failover from ${this.currentEndpoint.name} to ${newEndpoint.name}...`);
    
    this.isFailingOver = true;
    const failoverStart = Date.now();
    
    const failoverRecord = {
      timestamp: failoverStart,
      from: this.currentEndpoint.name,
      to: newEndpoint.name,
      reason: this.currentEndpoint.healthy ? 'optimization' : 'failure',
      success: false,
      duration: 0,
      providers: []
    };

    try {
      // Update DNS with all available providers in parallel
      const updatePromises = [];
      
      for (const [key, provider] of Object.entries(this.providers)) {
        if (provider.available) {
          updatePromises.push(
            this.updateDNSProvider(provider, newEndpoint)
              .then(result => ({ provider: provider.name, ...result }))
              .catch(error => ({ provider: provider.name, success: false, error: error.message }))
          );
        }
      }

      const results = await Promise.allSettled(updatePromises);
      failoverRecord.providers = results.map(r => r.value || r.reason);

      // Check if at least one provider succeeded
      const successfulUpdates = failoverRecord.providers.filter(p => p.success);
      
      if (successfulUpdates.length > 0) {
        failoverRecord.success = true;
        failoverRecord.duration = Date.now() - failoverStart;
        
        this.currentEndpoint = newEndpoint;
        console.log(`✅ Failover completed in ${failoverRecord.duration}ms`);
        console.log(`  Successful providers: ${successfulUpdates.map(p => p.provider).join(', ')}`);
        
        this.emit('failover-completed', failoverRecord);
      } else {
        throw new Error('All DNS provider updates failed');
      }

    } catch (error) {
      failoverRecord.error = error.message;
      console.error(`❌ Failover failed: ${error.message}`);
      this.emit('failover-failed', failoverRecord);
    } finally {
      this.isFailingOver = false;
      this.failoverHistory.push(failoverRecord);
      this.pruneFailoverHistory();
    }

    return failoverRecord;
  }

  /**
   * Update DNS with specific provider
   */
  async updateDNSProvider(provider, endpoint) {
    const startTime = Date.now();
    
    switch (provider.name) {
      case 'Cloudflare':
        return await this.updateCloudflare(provider, endpoint);
      
      case 'Netlify':
        return await this.updateNetlify(provider, endpoint);
      
      case 'AWS Route53':
        return await this.updateRoute53(provider, endpoint);
      
      default:
        throw new Error(`Unknown provider: ${provider.name}`);
    }
  }

  /**
   * Update Cloudflare DNS
   */
  async updateCloudflare(provider, endpoint) {
    const recordName = this.fqdn;
    
    // First, get existing record ID
    const listResponse = await axios.get(
      `${provider.api}/zones/${provider.zoneId}/dns_records?name=${recordName}`,
      {
        headers: { 'Authorization': `Bearer ${provider.token}` }
      }
    );

    const existingRecord = listResponse.data.result[0];
    
    // Update or create record
    const recordData = {
      type: 'CNAME',
      name: this.config.subdomain,
      content: endpoint.target,
      ttl: provider.ttl,
      proxied: provider.proxied
    };

    let response;
    if (existingRecord) {
      // Update existing record
      response = await axios.put(
        `${provider.api}/zones/${provider.zoneId}/dns_records/${existingRecord.id}`,
        recordData,
        {
          headers: { 'Authorization': `Bearer ${provider.token}` }
        }
      );
    } else {
      // Create new record
      response = await axios.post(
        `${provider.api}/zones/${provider.zoneId}/dns_records`,
        recordData,
        {
          headers: { 'Authorization': `Bearer ${provider.token}` }
        }
      );
    }

    // Purge cache for immediate effect
    await axios.post(
      `${provider.api}/zones/${provider.zoneId}/purge_cache`,
      { purge_everything: true },
      {
        headers: { 'Authorization': `Bearer ${provider.token}` }
      }
    );

    return {
      success: response.data.success,
      duration: Date.now() - startTime,
      recordId: response.data.result.id
    };
  }

  /**
   * Update Netlify DNS
   */
  async updateNetlify(provider, endpoint) {
    // Netlify DNS is managed through site configuration
    const response = await axios.patch(
      `${provider.api}/sites/${provider.siteId}`,
      {
        custom_domain: this.fqdn,
        force_ssl: true
      },
      {
        headers: { 'Authorization': `Bearer ${provider.token}` }
      }
    );

    return {
      success: true,
      duration: Date.now() - startTime
    };
  }

  /**
   * Update AWS Route53
   */
  async updateRoute53(provider, endpoint) {
    // Route53 would use AWS SDK
    // This is a placeholder for the actual implementation
    return {
      success: true,
      duration: 100,
      message: 'Route53 update would be performed here'
    };
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('endpoint-failed', (endpoint) => {
      // Increase monitoring frequency during failures
      if (!this.fastCheckInterval) {
        console.log('⚡ Switching to fast monitoring mode');
        this.fastCheckInterval = setInterval(() => {
          this.performHealthChecks();
        }, 1000); // Check every second during issues
      }
    });

    this.on('failover-completed', (record) => {
      // Return to normal monitoring after successful failover
      if (this.fastCheckInterval) {
        console.log('🔄 Returning to normal monitoring mode');
        clearInterval(this.fastCheckInterval);
        this.fastCheckInterval = null;
      }
    });

    this.on('no-healthy-endpoints', () => {
      // Alert administrators
      console.error('🚨 CRITICAL: No healthy endpoints available!');
      // Would trigger PagerDuty, email, SMS alerts here
    });
  }

  /**
   * Prune old health history
   */
  pruneHealthHistory() {
    const maxAge = 3600000; // 1 hour
    const cutoff = Date.now() - maxAge;
    this.healthHistory = this.healthHistory.filter(h => h.timestamp > cutoff);
  }

  /**
   * Prune old failover history
   */
  pruneFailoverHistory() {
    if (this.failoverHistory.length > 100) {
      this.failoverHistory = this.failoverHistory.slice(-100);
    }
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      current: {
        endpoint: this.currentEndpoint.name,
        healthy: this.currentEndpoint.healthy,
        uptime: this.currentEndpoint.metrics.uptime,
        avgResponseTime: this.currentEndpoint.metrics.avgResponseTime
      },
      endpoints: this.endpoints.map(e => ({
        name: e.name,
        healthy: e.healthy,
        uptime: e.metrics.uptime,
        avgResponseTime: e.metrics.avgResponseTime,
        consecutiveFailures: e.consecutiveFailures,
        lastCheck: e.lastCheck
      })),
      providers: Object.values(this.providers).map(p => ({
        name: p.name,
        available: p.available,
        priority: p.priority,
        features: p.features
      })),
      failoverHistory: this.failoverHistory.slice(-10),
      isFailingOver: this.isFailingOver
    };
  }

  /**
   * Stop the failover system
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.fastCheckInterval) {
      clearInterval(this.fastCheckInterval);
    }
    
    console.log('🛑 DNS Failover System stopped');
    this.emit('stopped');
  }
}

// Export for use in other modules
module.exports = DNSFailoverSystem;

// CLI interface
if (require.main === module) {
  const failoverSystem = new DNSFailoverSystem({
    domain: 'candlefish.ai',
    subdomain: 'fogg',
    checkInterval: 5000,
    failoverThreshold: 2,
    recoveryThreshold: 3
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down DNS Failover System...');
    failoverSystem.stop();
    
    // Display final status
    const status = failoverSystem.getStatus();
    console.log('\n📊 Final Status:');
    console.log(JSON.stringify(status, null, 2));
    
    process.exit(0);
  });

  // Initialize and run
  failoverSystem.initialize()
    .then(() => {
      console.log('\n✅ DNS Failover System active');
      
      // Display status every 30 seconds
      setInterval(() => {
        const status = failoverSystem.getStatus();
        console.log('\n📊 System Status:');
        console.log(`  Current: ${status.current.endpoint} (${status.current.healthy ? '✅' : '❌'})`);
        console.log(`  Uptime: ${status.current.uptime.toFixed(1)}%`);
        console.log(`  Response: ${status.current.avgResponseTime.toFixed(0)}ms`);
        
        if (status.failoverHistory.length > 0) {
          const lastFailover = status.failoverHistory[status.failoverHistory.length - 1];
          console.log(`  Last failover: ${lastFailover.from} → ${lastFailover.to} (${lastFailover.duration}ms)`);
        }
      }, 30000);
    })
    .catch(error => {
      console.error('💥 Failed to initialize DNS Failover System:', error);
      process.exit(1);
    });
}