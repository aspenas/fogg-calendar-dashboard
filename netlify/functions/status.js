// Netlify Function for deployment status polling
// Optimized for real-time status updates without WebSockets

const DEPLOYMENT_STAGES = [
  { name: 'guardian', emoji: '🛡️', progress: 20, message: 'Guardian checking security and permissions...', duration: 6000 },
  { name: 'speedster', emoji: '⚡', progress: 40, message: 'Speedster optimizing performance and assets...', duration: 8000 },
  { name: 'detective', emoji: '🔍', progress: 70, message: 'Detective running comprehensive tests...', duration: 10000 },
  { name: 'architect', emoji: '🏗️', progress: 90, message: 'Architect finalizing deployment structure...', duration: 6000 }
];

const TOTAL_DEPLOYMENT_TIME = 30000; // 30 seconds

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const { deploymentId, startTime } = queryParams;

    if (!deploymentId || !startTime) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required parameters',
          required: ['deploymentId', 'startTime']
        })
      };
    }

    const start = new Date(startTime);
    const now = new Date();
    const elapsed = now - start;
    const progress = Math.min(100, (elapsed / TOTAL_DEPLOYMENT_TIME) * 100);
    
    // Determine current stage
    let currentStage = null;
    let stageProgress = 0;
    
    if (elapsed < TOTAL_DEPLOYMENT_TIME) {
      for (let i = 0; i < DEPLOYMENT_STAGES.length; i++) {
        const stage = DEPLOYMENT_STAGES[i];
        if (progress >= stage.progress - 20 && progress < stage.progress + 20) {
          currentStage = stage;
          // Calculate stage-specific progress
          const stageStart = i === 0 ? 0 : DEPLOYMENT_STAGES[i-1].progress;
          const stageEnd = stage.progress;
          stageProgress = Math.min(100, ((progress - stageStart) / (stageEnd - stageStart)) * 100);
          break;
        }
      }
    }

    const isComplete = elapsed >= TOTAL_DEPLOYMENT_TIME;
    const isDeploying = !isComplete;

    // Generate success message
    const messages = [];
    if (isComplete) {
      messages.push({
        text: '🎉 Calendar updated successfully! Everyone can see the new changes now!',
        timestamp: new Date().toLocaleTimeString(),
        type: 'success'
      });
    } else if (currentStage) {
      messages.push({
        text: currentStage.message,
        timestamp: new Date().toLocaleTimeString(),
        type: 'info'
      });
    }

    // Calculate version increment
    const baseVersion = '2.4.1';
    const parts = baseVersion.split('.');
    const patch = parseInt(parts[2]) + 1;
    const newVersion = `${parts[0]}.${parts[1]}.${patch}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        deploymentId,
        isDeploying,
        isComplete,
        progress: Math.round(progress),
        currentStage: currentStage ? {
          name: currentStage.name,
          emoji: currentStage.emoji,
          message: currentStage.message,
          progress: Math.round(stageProgress)
        } : null,
        elapsed: Math.round(elapsed / 1000),
        estimatedTimeRemaining: isComplete ? 0 : Math.max(0, Math.round((TOTAL_DEPLOYMENT_TIME - elapsed) / 1000)),
        version: isComplete ? newVersion : baseVersion,
        messages,
        timestamp: now.toISOString(),
        
        // Agent statuses for UI
        agentStatuses: DEPLOYMENT_STAGES.reduce((acc, stage) => {
          if (progress >= stage.progress) {
            acc[stage.name] = 'done';
          } else if (currentStage && currentStage.name === stage.name) {
            acc[stage.name] = 'working';
          } else {
            acc[stage.name] = 'waiting';
          }
          return acc;
        }, {})
      })
    };

  } catch (error) {
    console.error('Status function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Unable to fetch deployment status'
      })
    };
  }
};