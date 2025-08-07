// Health monitoring endpoint for FOGG Calendar Dashboard
const dns = require('dns').promises;
const https = require('https');

// Check SSL certificate status
async function checkSSL() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'fogg.candlefish.ai',
      port: 443,
      method: 'HEAD',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      resolve({
        valid: res.socket.authorized !== false,
        status: res.statusCode === 200 || res.statusCode === 301 ? 'active' : 'inactive'
      });
    });

    req.on('error', () => {
      resolve({ valid: false, status: 'error' });
    });

    req.on('timeout', () => {
      resolve({ valid: false, status: 'timeout' });
    });

    req.end();
  });
}

// Check DNS resolution
async function checkDNS() {
  try {
    const addresses = await dns.resolve4('fogg.candlefish.ai');
    return {
      resolved: true,
      addresses,
      status: 'active'
    };
  } catch (error) {
    return {
      resolved: false,
      error: error.message,
      status: 'error'
    };
  }
}

// Get last deployment info (simplified for now)
function getLastDeployment() {
  // In production, this would query a database or state store
  return {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'success',
    duration: 28000  // milliseconds
  };
}

// Calculate overall health score
function calculateHealthScore(ssl, dns, deployment) {
  let score = 0;
  let maxScore = 0;
  
  // SSL health (40 points)
  maxScore += 40;
  if (ssl.valid && ssl.status === 'active') score += 40;
  else if (ssl.valid) score += 20;
  
  // DNS health (30 points)
  maxScore += 30;
  if (dns.resolved && dns.status === 'active') score += 30;
  else if (dns.resolved) score += 15;
  
  // Deployment health (30 points)
  maxScore += 30;
  if (deployment.status === 'success') score += 30;
  else if (deployment.status === 'partial') score += 15;
  
  return {
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  };
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Run all health checks in parallel
    const [ssl, dns, deployment] = await Promise.all([
      checkSSL(),
      checkDNS(),
      getLastDeployment()
    ]);

    // Calculate overall health
    const healthScore = calculateHealthScore(ssl, dns, deployment);
    
    // Determine overall status
    const overallStatus = healthScore.percentage >= 90 ? 'healthy' : 
                          healthScore.percentage >= 70 ? 'degraded' : 
                          'unhealthy';

    // Build response
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      health_score: healthScore,
      checks: {
        ssl,
        dns,
        deployment
      },
      message: overallStatus === 'healthy' ? 
               'All systems operational' : 
               overallStatus === 'degraded' ?
               'Some systems experiencing issues' :
               'System health critical - immediate attention required'
    };

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 :  // Still return 200 for degraded
                       503;  // Service unavailable for unhealthy

    return {
      statusCode,
      headers,
      body: JSON.stringify(response, null, 2)
    };

  } catch (error) {
    console.error('Health check failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};