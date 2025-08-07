#!/usr/bin/env node

/**
 * Performance Optimization System for Deployment Dashboard
 * 
 * Optimizations:
 * - DNS prefetching and preconnect
 * - Edge caching with CDN
 * - Multi-CDN failover
 * - Resource optimization
 * - Real-time performance monitoring
 */

const dns = require('dns').promises;
const https = require('https');
const http2 = require('http2');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const crypto = require('crypto');

class PerformanceOptimizer {
  constructor(config = {}) {
    this.config = {
      domain: config.domain || 'candlefish.ai',
      subdomain: config.subdomain || 'fogg',
      primaryUrl: config.primaryUrl || 'https://fogg-calendar.netlify.app',
      ...config
    };

    this.metrics = {
      dns: [],
      ttfb: [],
      fcp: [],
      lcp: [],
      cls: [],
      fid: []
    };

    // DNS cache for faster resolution
    this.dnsCache = new Map();
    this.dnsCacheTTL = 300000; // 5 minutes

    // CDN endpoints for failover
    this.cdnEndpoints = [
      { name: 'Netlify', url: 'https://fogg-calendar.netlify.app', priority: 1 },
      { name: 'Cloudflare', url: 'https://fogg.candlefish.ai', priority: 2 },
      { name: 'Direct', url: 'https://candlefish.ai/fogg', priority: 3 }
    ];

    // Performance thresholds (Core Web Vitals)
    this.thresholds = {
      dns: 50,        // DNS resolution < 50ms
      ttfb: 800,      // Time to First Byte < 800ms
      fcp: 1800,      // First Contentful Paint < 1.8s
      lcp: 2500,      // Largest Contentful Paint < 2.5s
      cls: 0.1,       // Cumulative Layout Shift < 0.1
      fid: 100        // First Input Delay < 100ms
    };
  }

  /**
   * Initialize performance optimizations
   */
  async initialize() {
    console.log('🚀 Initializing performance optimizations...');

    // 1. Warm up DNS cache
    await this.warmupDNSCache();

    // 2. Prefetch critical resources
    await this.prefetchResources();

    // 3. Setup HTTP/2 connection pools
    await this.setupHTTP2Pools();

    // 4. Initialize monitoring
    await this.startMonitoring();

    console.log('✅ Performance optimizations initialized');
    return this;
  }

  /**
   * Warm up DNS cache for faster resolution
   */
  async warmupDNSCache() {
    console.log('🔥 Warming up DNS cache...');
    
    const domains = [
      'fogg-calendar.netlify.app',
      'candlefish.ai',
      'fogg.candlefish.ai',
      'api.netlify.com',
      'cdn.jsdelivr.net',
      'fonts.googleapis.com'
    ];

    const warmupPromises = domains.map(async (domain) => {
      const startTime = performance.now();
      
      try {
        const addresses = await dns.resolve4(domain);
        const resolutionTime = performance.now() - startTime;
        
        // Cache the result
        this.dnsCache.set(domain, {
          addresses,
          timestamp: Date.now(),
          resolutionTime
        });

        console.log(`  ✓ ${domain}: ${resolutionTime.toFixed(2)}ms`);
        return { domain, success: true, time: resolutionTime };
      } catch (error) {
        console.log(`  ✗ ${domain}: Failed - ${error.message}`);
        return { domain, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(warmupPromises);
    
    // Calculate average DNS resolution time
    const successfulResults = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => r.value.time);
    
    if (successfulResults.length > 0) {
      const avgTime = successfulResults.reduce((a, b) => a + b, 0) / successfulResults.length;
      console.log(`  📊 Average DNS resolution: ${avgTime.toFixed(2)}ms`);
    }

    return results;
  }

  /**
   * Prefetch critical resources
   */
  async prefetchResources() {
    console.log('📦 Prefetching critical resources...');

    const resources = [
      // Main application
      { url: this.config.primaryUrl, type: 'document' },
      
      // API endpoints
      { url: `${this.config.primaryUrl}/api/health`, type: 'fetch' },
      { url: `${this.config.primaryUrl}/api/status`, type: 'fetch' },
      
      // Static assets
      { url: 'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js', type: 'script' },
      { url: 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js', type: 'script' },
      { url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap', type: 'style' }
    ];

    const prefetchPromises = resources.map(async (resource) => {
      const startTime = performance.now();
      
      try {
        const response = await axios.head(resource.url, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        const fetchTime = performance.now() - startTime;
        
        return {
          url: resource.url,
          type: resource.type,
          status: response.status,
          headers: {
            'cache-control': response.headers['cache-control'],
            'etag': response.headers['etag'],
            'last-modified': response.headers['last-modified']
          },
          fetchTime,
          success: response.status < 400
        };
      } catch (error) {
        return {
          url: resource.url,
          type: resource.type,
          error: error.message,
          success: false
        };
      }
    });

    const results = await Promise.allSettled(prefetchPromises);
    
    // Group results by type
    const grouped = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        const type = r.value.type;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(r.value);
      }
    });

    console.log('  📊 Prefetch results:');
    Object.keys(grouped).forEach(type => {
      const successful = grouped[type].filter(r => r.success).length;
      console.log(`    ${type}: ${successful}/${grouped[type].length} successful`);
    });

    return results;
  }

  /**
   * Setup HTTP/2 connection pools for faster requests
   */
  async setupHTTP2Pools() {
    console.log('⚡ Setting up HTTP/2 connection pools...');

    this.http2Sessions = new Map();

    for (const endpoint of this.cdnEndpoints) {
      try {
        const url = new URL(endpoint.url);
        const session = http2.connect(url.origin);
        
        session.on('error', (err) => {
          console.error(`HTTP/2 session error for ${endpoint.name}:`, err.message);
        });

        session.on('goaway', () => {
          console.log(`HTTP/2 session closed for ${endpoint.name}`);
          this.http2Sessions.delete(endpoint.name);
        });

        this.http2Sessions.set(endpoint.name, session);
        console.log(`  ✓ ${endpoint.name}: HTTP/2 session established`);
      } catch (error) {
        console.log(`  ✗ ${endpoint.name}: Failed - ${error.message}`);
      }
    }

    return this.http2Sessions;
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring() {
    console.log('📊 Starting performance monitoring...');

    // Monitor main endpoints
    this.monitoringInterval = setInterval(async () => {
      await this.measurePerformance();
    }, 30000); // Every 30 seconds

    // Initial measurement
    await this.measurePerformance();

    return true;
  }

  /**
   * Measure current performance metrics
   */
  async measurePerformance() {
    const timestamp = new Date().toISOString();
    const measurements = {};

    // 1. DNS Resolution Performance
    const dnsStart = performance.now();
    try {
      await this.resolveDNSWithCache('fogg-calendar.netlify.app');
      measurements.dns = performance.now() - dnsStart;
    } catch (error) {
      measurements.dns = -1;
    }

    // 2. Time to First Byte (TTFB)
    const ttfbStart = performance.now();
    try {
      const response = await axios.get(this.config.primaryUrl, {
        timeout: 10000,
        validateStatus: () => true,
        onDownloadProgress: (progressEvent) => {
          if (!measurements.ttfb && progressEvent.loaded > 0) {
            measurements.ttfb = performance.now() - ttfbStart;
          }
        }
      });
      
      if (!measurements.ttfb) {
        measurements.ttfb = performance.now() - ttfbStart;
      }
      
      measurements.statusCode = response.status;
      measurements.contentLength = response.headers['content-length'];
    } catch (error) {
      measurements.ttfb = -1;
      measurements.error = error.message;
    }

    // 3. Check CDN performance
    measurements.cdnPerformance = await this.measureCDNPerformance();

    // 4. Store metrics
    this.storeMetrics(measurements);

    // 5. Check against thresholds
    this.checkThresholds(measurements);

    return measurements;
  }

  /**
   * Resolve DNS with caching
   */
  async resolveDNSWithCache(domain) {
    // Check cache first
    const cached = this.dnsCache.get(domain);
    if (cached && (Date.now() - cached.timestamp) < this.dnsCacheTTL) {
      return cached.addresses;
    }

    // Resolve and cache
    const addresses = await dns.resolve4(domain);
    this.dnsCache.set(domain, {
      addresses,
      timestamp: Date.now()
    });

    return addresses;
  }

  /**
   * Measure CDN endpoint performance
   */
  async measureCDNPerformance() {
    const measurements = [];

    for (const endpoint of this.cdnEndpoints) {
      const startTime = performance.now();
      
      try {
        const response = await axios.head(endpoint.url, {
          timeout: 3000,
          validateStatus: () => true
        });
        
        const responseTime = performance.now() - startTime;
        
        measurements.push({
          name: endpoint.name,
          url: endpoint.url,
          priority: endpoint.priority,
          responseTime,
          status: response.status,
          available: response.status < 500
        });
      } catch (error) {
        measurements.push({
          name: endpoint.name,
          url: endpoint.url,
          priority: endpoint.priority,
          responseTime: -1,
          error: error.message,
          available: false
        });
      }
    }

    // Sort by response time (fastest first)
    measurements.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      if (a.responseTime === -1) return 1;
      if (b.responseTime === -1) return -1;
      return a.responseTime - b.responseTime;
    });

    return measurements;
  }

  /**
   * Store performance metrics
   */
  storeMetrics(measurements) {
    const metric = {
      timestamp: new Date().toISOString(),
      ...measurements
    };

    // Add to metrics arrays (keep last 100 entries)
    if (measurements.dns > 0) {
      this.metrics.dns.push(measurements.dns);
      if (this.metrics.dns.length > 100) this.metrics.dns.shift();
    }

    if (measurements.ttfb > 0) {
      this.metrics.ttfb.push(measurements.ttfb);
      if (this.metrics.ttfb.length > 100) this.metrics.ttfb.shift();
    }

    return metric;
  }

  /**
   * Check performance against thresholds
   */
  checkThresholds(measurements) {
    const violations = [];

    if (measurements.dns > this.thresholds.dns) {
      violations.push({
        metric: 'DNS',
        value: measurements.dns,
        threshold: this.thresholds.dns,
        severity: measurements.dns > this.thresholds.dns * 2 ? 'critical' : 'warning'
      });
    }

    if (measurements.ttfb > this.thresholds.ttfb) {
      violations.push({
        metric: 'TTFB',
        value: measurements.ttfb,
        threshold: this.thresholds.ttfb,
        severity: measurements.ttfb > this.thresholds.ttfb * 2 ? 'critical' : 'warning'
      });
    }

    if (violations.length > 0) {
      console.log('⚠️  Performance threshold violations:');
      violations.forEach(v => {
        console.log(`  ${v.severity.toUpperCase()}: ${v.metric} = ${v.value.toFixed(2)}ms (threshold: ${v.threshold}ms)`);
      });
    }

    return violations;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const stats = {};

    // Calculate averages and percentiles for each metric
    Object.keys(this.metrics).forEach(metric => {
      const values = this.metrics[metric].filter(v => v > 0);
      
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        
        stats[metric] = {
          count: values.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: values[0],
          max: values[values.length - 1],
          p50: values[Math.floor(values.length * 0.5)],
          p75: values[Math.floor(values.length * 0.75)],
          p95: values[Math.floor(values.length * 0.95)],
          p99: values[Math.floor(values.length * 0.99)]
        };
      }
    });

    return stats;
  }

  /**
   * Get optimal endpoint based on current performance
   */
  async getOptimalEndpoint() {
    const measurements = await this.measureCDNPerformance();
    
    // Return the fastest available endpoint
    const available = measurements.filter(m => m.available);
    if (available.length > 0) {
      return available[0];
    }

    // If none available, return primary
    return {
      name: 'Primary',
      url: this.config.primaryUrl,
      fallback: true
    };
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    const stats = this.getStats();
    const optimal = await this.getOptimalEndpoint();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        dnsCache: {
          size: this.dnsCache.size,
          ttl: this.dnsCacheTTL
        },
        http2Sessions: {
          active: this.http2Sessions.size,
          endpoints: Array.from(this.http2Sessions.keys())
        },
        optimalEndpoint: optimal
      },
      metrics: stats,
      thresholds: this.thresholds,
      recommendations: this.generateRecommendations(stats)
    };

    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    // DNS recommendations
    if (stats.dns && stats.dns.avg > this.thresholds.dns) {
      recommendations.push({
        category: 'DNS',
        priority: 'high',
        issue: `Average DNS resolution time (${stats.dns.avg.toFixed(2)}ms) exceeds threshold`,
        solutions: [
          'Implement DNS prefetching in HTML head',
          'Use DNS-over-HTTPS for faster resolution',
          'Configure multiple DNS servers for redundancy',
          'Increase DNS cache TTL'
        ]
      });
    }

    // TTFB recommendations
    if (stats.ttfb && stats.ttfb.avg > this.thresholds.ttfb) {
      recommendations.push({
        category: 'TTFB',
        priority: 'high',
        issue: `Average TTFB (${stats.ttfb.avg.toFixed(2)}ms) exceeds threshold`,
        solutions: [
          'Enable edge caching on CDN',
          'Optimize server response time',
          'Use HTTP/2 Server Push for critical resources',
          'Implement service workers for offline caching'
        ]
      });
    }

    // General optimizations
    recommendations.push({
      category: 'General',
      priority: 'medium',
      issue: 'Continuous optimization opportunities',
      solutions: [
        'Implement resource hints (preconnect, prefetch, preload)',
        'Use WebP images with fallbacks',
        'Enable Brotli compression',
        'Implement lazy loading for non-critical resources',
        'Use CDN with multiple PoPs (Points of Presence)'
      ]
    });

    return recommendations;
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Close HTTP/2 sessions
    this.http2Sessions.forEach(session => {
      session.close();
    });

    console.log('🛑 Performance monitoring stopped');
  }
}

// Export for use in other modules
module.exports = PerformanceOptimizer;

// CLI interface
if (require.main === module) {
  const optimizer = new PerformanceOptimizer({
    domain: 'candlefish.ai',
    subdomain: 'fogg',
    primaryUrl: 'https://fogg-calendar.netlify.app'
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    optimizer.stop();
    
    // Generate final report
    const report = await optimizer.generateReport();
    console.log('\n📊 Final Performance Report:');
    console.log(JSON.stringify(report, null, 2));
    
    process.exit(0);
  });

  // Initialize and run
  optimizer.initialize()
    .then(async () => {
      console.log('\n✅ Performance optimizer running');
      
      // Display stats every minute
      setInterval(async () => {
        const stats = optimizer.getStats();
        const optimal = await optimizer.getOptimalEndpoint();
        
        console.log('\n📊 Performance Stats:');
        console.log(`  Optimal endpoint: ${optimal.name} (${optimal.url})`);
        
        if (stats.dns) {
          console.log(`  DNS: avg=${stats.dns.avg.toFixed(2)}ms, p95=${stats.dns.p95.toFixed(2)}ms`);
        }
        if (stats.ttfb) {
          console.log(`  TTFB: avg=${stats.ttfb.avg.toFixed(2)}ms, p95=${stats.ttfb.p95.toFixed(2)}ms`);
        }
      }, 60000);

      // Generate report every 5 minutes
      setInterval(async () => {
        const report = await optimizer.generateReport();
        
        // Save report to file
        const reportPath = path.join(__dirname, 'logs', `performance-${Date.now()}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Performance report saved: ${reportPath}`);
        
        // Display recommendations
        if (report.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          report.recommendations.forEach(rec => {
            console.log(`  ${rec.category} (${rec.priority}): ${rec.issue}`);
          });
        }
      }, 300000);
    })
    .catch(error => {
      console.error('💥 Failed to initialize optimizer:', error);
      process.exit(1);
    });
}