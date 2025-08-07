// Simple test script to verify Netlify Functions work locally
// Run with: node test-deployment.js

const API_BASE = 'http://localhost:8888/.netlify/functions';

async function testDeploymentEndpoint() {
  console.log('🧪 Testing FOGG Calendar Deployment Dashboard');
  console.log('==========================================\n');
  
  try {
    // Test 1: Check status endpoint
    console.log('📋 Test 1: Checking status endpoint...');
    const statusResponse = await fetch(`${API_BASE}/deploy`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Status endpoint works!');
      console.log(`   Current version: ${statusData.version}`);
      console.log(`   Status: ${statusData.status}\n`);
    } else {
      throw new Error(`Status endpoint failed: ${statusResponse.status}`);
    }

    // Test 2: Start a deployment
    console.log('🚀 Test 2: Starting test deployment...');
    const deployResponse = await fetch(`${API_BASE}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environment: 'test',
        user: 'TestUser'
      })
    });

    if (deployResponse.ok) {
      const deployData = await deployResponse.json();
      console.log('✅ Deployment started successfully!');
      console.log(`   Deployment ID: ${deployData.deploymentId}`);
      console.log(`   Start time: ${deployData.startTime}`);
      console.log(`   Estimated duration: ${deployData.estimatedDuration}ms\n`);

      // Test 3: Poll deployment status
      console.log('📊 Test 3: Polling deployment status...');
      const startTime = deployData.startTime;
      const deploymentId = deployData.deploymentId;
      
      // Poll a few times to test the status endpoint
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusUrl = `${API_BASE}/status?deploymentId=${deploymentId}&startTime=${encodeURIComponent(startTime)}`;
        const pollingResponse = await fetch(statusUrl);
        
        if (pollingResponse.ok) {
          const pollingData = await pollingResponse.json();
          console.log(`   Poll ${i + 1}: ${pollingData.progress}% complete`);
          if (pollingData.currentStage) {
            console.log(`   Current agent: ${pollingData.currentStage.emoji} ${pollingData.currentStage.name}`);
          }
          
          if (pollingData.isComplete) {
            console.log('🎉 Deployment completed successfully!');
            console.log(`   Final version: ${pollingData.version}\n`);
            break;
          }
        } else {
          throw new Error(`Status polling failed: ${pollingResponse.status}`);
        }
      }

      console.log('✅ All tests passed! Dashboard is ready for deployment.');
      
    } else {
      throw new Error(`Deployment start failed: ${deployResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Netlify CLI is installed: npm install -g netlify-cli');
    console.log('2. Start the dev server: netlify dev');
    console.log('3. Verify functions are in netlify/functions/ folder');
    console.log('4. Check for any syntax errors in the function files');
  }
}

// Test for Node.js fetch (18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Node.js 18+ required for fetch support');
  console.log('Install Node.js 18+ or use: npm install -g node-fetch');
  process.exit(1);
}

testDeploymentEndpoint();