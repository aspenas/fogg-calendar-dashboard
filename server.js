const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Store deployment state
let deploymentState = {
  isDeploying: false,
  progress: 0,
  activeAgent: null,
  completedAgents: [],
  lastDeployment: null,
  currentVersion: '2.4.1'
};

// System status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    version: deploymentState.currentVersion,
    lastDeploy: deploymentState.lastDeployment || 'Never',
    status: deploymentState.isDeploying ? 'Deploying' : 'Ready',
    health: 'Excellent',
    uptime: process.uptime(),
    deploymentInProgress: deploymentState.isDeploying
  });
});

// Start deployment endpoint
app.post('/api/deploy', async (req, res) => {
  if (deploymentState.isDeploying) {
    return res.status(400).json({ 
      success: false, 
      error: 'Deployment already in progress' 
    });
  }

  deploymentState.isDeploying = true;
  deploymentState.progress = 0;
  deploymentState.completedAgents = [];

  res.json({ success: true, message: 'Deployment started' });

  // Start the deployment process
  startDeploymentProcess();
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current status on connection
  socket.emit('status-update', {
    version: deploymentState.currentVersion,
    lastDeploy: deploymentState.lastDeployment,
    status: deploymentState.isDeploying ? 'Deploying' : 'Ready',
    health: 'Excellent'
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Deployment process orchestration
async function startDeploymentProcess() {
  const agents = [
    { id: 'guardian', name: 'Guardian', duration: 3000 },
    { id: 'speedster', name: 'Speedster', duration: 2000 },
    { id: 'detective', name: 'Detective', duration: 3500 },
    { id: 'architect', name: 'Architect', duration: 2500 }
  ];

  try {
    // Initial message
    io.emit('deployment-progress', {
      progress: 5,
      message: 'Initializing deployment system...'
    });

    await sleep(1000);

    // Process each agent
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const baseProgress = (i * 25);
      
      // Activate agent
      deploymentState.activeAgent = agent.id;
      io.emit('agent-update', {
        agentId: agent.id,
        status: 'active',
        message: `${agent.name} is starting their work`
      });

      io.emit('deployment-progress', {
        progress: baseProgress + 5,
        activeAgent: agent.id,
        message: getAgentMessage(agent.id, 'start')
      });

      // Simulate agent work with progress updates
      const steps = 5;
      for (let step = 1; step <= steps; step++) {
        await sleep(agent.duration / steps);
        
        const stepProgress = baseProgress + (step * 5);
        io.emit('deployment-progress', {
          progress: stepProgress,
          activeAgent: agent.id,
          message: getAgentMessage(agent.id, 'progress', step)
        });
      }

      // Complete agent
      deploymentState.completedAgents.push(agent.id);
      io.emit('agent-update', {
        agentId: agent.id,
        status: 'complete',
        message: `${agent.name} completed successfully`
      });

      io.emit('deployment-progress', {
        progress: baseProgress + 25,
        activeAgent: null,
        message: getAgentMessage(agent.id, 'complete')
      });

      await sleep(500);
    }

    // Final deployment step
    io.emit('deployment-progress', {
      progress: 95,
      message: 'Finalizing deployment...'
    });

    await sleep(1500);

    // Deployment complete
    const newVersion = incrementVersion(deploymentState.currentVersion);
    deploymentState.currentVersion = newVersion;
    deploymentState.lastDeployment = new Date().toISOString();
    deploymentState.isDeploying = false;
    deploymentState.activeAgent = null;

    io.emit('deployment-complete', {
      success: true,
      newVersion,
      timestamp: deploymentState.lastDeployment,
      message: 'Deployment completed successfully!'
    });

  } catch (error) {
    console.error('Deployment failed:', error);
    deploymentState.isDeploying = false;
    deploymentState.activeAgent = null;
    
    io.emit('deployment-error', {
      error: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to get agent-specific messages
function getAgentMessage(agentId, phase, step = 0) {
  const messages = {
    guardian: {
      start: '🛡️ Guardian is checking safety protocols...',
      progress: [
        'Verifying backup systems...',
        'Checking system health...',
        'Validating configurations...',
        'Testing rollback procedures...',
        'Safety checks complete!'
      ],
      complete: '✅ Guardian: All safety checks passed!'
    },
    speedster: {
      start: '⚡ Speedster is optimizing deployment speed...',
      progress: [
        'Preparing fast deployment path...',
        'Compressing files for quick transfer...',
        'Setting up parallel processes...',
        'Accelerating deployment pipeline...',
        'Speed optimization complete!'
      ],
      complete: '✅ Speedster: Deployment optimized for maximum speed!'
    },
    detective: {
      start: '🔍 Detective is reviewing the code...',
      progress: [
        'Scanning for potential issues...',
        'Checking code quality...',
        'Verifying dependencies...',
        'Analyzing security patterns...',
        'Code review complete!'
      ],
      complete: '✅ Detective: Code review passed with flying colors!'
    },
    architect: {
      start: '🏗️ Architect is building the final deployment...',
      progress: [
        'Constructing deployment package...',
        'Building production assets...',
        'Optimizing for performance...',
        'Finalizing deployment structure...',
        'Build process complete!'
      ],
      complete: '✅ Architect: Deployment package ready for launch!'
    }
  };

  if (phase === 'progress' && step > 0) {
    return messages[agentId]?.progress[step - 1] || 'Working...';
  }

  return messages[agentId]?.[phase] || '';
}

// Helper function to increment version
function incrementVersion(version) {
  const parts = version.split('.');
  const patch = parseInt(parts[2]) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

// Helper function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Optional: Execute actual deployment script
async function executeDeploymentScript() {
  return new Promise((resolve, reject) => {
    const deployScript = path.join(__dirname, '..', 'deploy.sh');
    
    const deploy = spawn('bash', [deployScript], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });

    let output = '';
    let errorOutput = '';

    deploy.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Deploy output:', data.toString());
      
      // Parse and emit progress updates
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.includes('Progress:')) {
          const progress = parseInt(line.match(/\d+/)?.[0] || 0);
          io.emit('deployment-progress', { progress });
        }
      });
    });

    deploy.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Deploy error:', data.toString());
    });

    deploy.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(`Deployment failed with code ${code}: ${errorOutput}`));
      }
    });
  });
}

// Serve static files
app.use(express.static('dist'));

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`✨ Deployment Dashboard Server running on port ${PORT}`);
  console.log(`🌐 WebSocket server ready for connections`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});