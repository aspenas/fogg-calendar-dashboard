// Performance monitoring utilities for the deployment dashboard

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      deploymentTimes: [],
      apiResponseTimes: [],
      websocketLatency: [],
      renderTimes: [],
      errorCount: 0,
      successCount: 0
    };
    
    this.startTime = Date.now();
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // Monitor page load performance
    if (typeof window !== 'undefined' && window.performance) {
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        
        console.log(`Page load time: ${loadTime}ms`);
        this.recordMetric('pageLoad', loadTime);
      });

      // Monitor React render performance
      if (window.performance.mark) {
        this.measureRenderTime();
      }
    }

    // Monitor network requests
    this.interceptFetch();
    
    // Monitor WebSocket performance
    this.monitorWebSocket();
    
    // Send metrics periodically
    this.startMetricsReporting();
  }

  measureRenderTime() {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure' && entry.name.startsWith('react-')) {
          this.metrics.renderTimes.push({
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now()
          });
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
  }

  interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0];
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.metrics.apiResponseTimes.push({
          url: typeof url === 'string' ? url : url.url,
          duration,
          status: response.status,
          timestamp: Date.now()
        });

        // Log slow requests
        if (duration > 1000) {
          console.warn(`Slow API request: ${url} took ${duration.toFixed(2)}ms`);
        }

        return response;
      } catch (error) {
        this.metrics.errorCount++;
        throw error;
      }
    };
  }

  monitorWebSocket() {
    // This will be called from the main app when WebSocket is initialized
    this.websocketPingInterval = null;
  }

  startWebSocketPing(socket) {
    if (this.websocketPingInterval) {
      clearInterval(this.websocketPingInterval);
    }

    this.websocketPingInterval = setInterval(() => {
      if (socket && socket.connected) {
        const startTime = Date.now();
        
        socket.emit('ping', startTime);
        
        socket.once('pong', (serverTime) => {
          const latency = Date.now() - startTime;
          this.metrics.websocketLatency.push({
            latency,
            timestamp: Date.now()
          });

          // Warn if latency is high
          if (latency > 500) {
            console.warn(`High WebSocket latency: ${latency}ms`);
          }
        });
      }
    }, 30000); // Ping every 30 seconds
  }

  recordDeploymentTime(duration, success = true) {
    this.metrics.deploymentTimes.push({
      duration,
      success,
      timestamp: Date.now()
    });

    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
    }
  }

  recordMetric(name, value) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    
    this.metrics[name].push({
      value,
      timestamp: Date.now()
    });
  }

  getAverageMetric(metricName) {
    const metric = this.metrics[metricName];
    if (!metric || metric.length === 0) return 0;
    
    const sum = metric.reduce((acc, item) => {
      const value = item.value || item.duration || item.latency || 0;
      return acc + value;
    }, 0);
    
    return sum / metric.length;
  }

  getSuccessRate() {
    const total = this.metrics.successCount + this.metrics.errorCount;
    if (total === 0) return 100;
    
    return (this.metrics.successCount / total) * 100;
  }

  getPerformanceReport() {
    return {
      uptime: Date.now() - this.startTime,
      averageDeploymentTime: this.getAverageMetric('deploymentTimes'),
      averageApiResponseTime: this.getAverageMetric('apiResponseTimes'),
      averageWebSocketLatency: this.getAverageMetric('websocketLatency'),
      averageRenderTime: this.getAverageMetric('renderTimes'),
      successRate: this.getSuccessRate(),
      totalDeployments: this.metrics.deploymentTimes.length,
      errorCount: this.metrics.errorCount,
      metrics: this.metrics
    };
  }

  startMetricsReporting() {
    // Report metrics every 5 minutes
    setInterval(() => {
      const report = this.getPerformanceReport();
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Performance Report:', report);
      }

      // Send to analytics service in production
      if (process.env.NODE_ENV === 'production' && window.analytics) {
        window.analytics.track('Performance Metrics', report);
      }
    }, 300000);
  }

  // Check if performance is degraded
  isPerformanceDegraded() {
    const avgApiTime = this.getAverageMetric('apiResponseTimes');
    const avgWsLatency = this.getAverageMetric('websocketLatency');
    const successRate = this.getSuccessRate();

    return avgApiTime > 2000 || avgWsLatency > 1000 || successRate < 90;
  }

  // Get performance score (0-100)
  getPerformanceScore() {
    const avgApiTime = this.getAverageMetric('apiResponseTimes');
    const avgWsLatency = this.getAverageMetric('websocketLatency');
    const successRate = this.getSuccessRate();

    // Calculate scores for each metric
    const apiScore = Math.max(0, 100 - (avgApiTime / 20)); // 2000ms = 0 score
    const wsScore = Math.max(0, 100 - (avgWsLatency / 10)); // 1000ms = 0 score
    const successScore = successRate;

    // Weighted average
    return (apiScore * 0.3 + wsScore * 0.3 + successScore * 0.4);
  }

  // Clear old metrics to prevent memory leak
  cleanupOldMetrics() {
    const oneHourAgo = Date.now() - 3600000;
    
    Object.keys(this.metrics).forEach(key => {
      if (Array.isArray(this.metrics[key])) {
        this.metrics[key] = this.metrics[key].filter(
          item => item.timestamp > oneHourAgo
        );
      }
    });
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Cleanup old metrics every hour
setInterval(() => {
  performanceMonitor.cleanupOldMetrics();
}, 3600000);

export default performanceMonitor;