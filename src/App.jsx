import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import './App.css';

// Configuration for Netlify deployment
const API_BASE = process.env.NODE_ENV === 'production' 
  ? '/.netlify/functions' 
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888/.netlify/functions');

const POLLING_INTERVAL = import.meta.env.VITE_POLLING_INTERVAL || 2000;
const DEFAULT_USER = import.meta.env.VITE_DEFAULT_USER || 'Leslie';
const DEFAULT_ENVIRONMENT = import.meta.env.VITE_DEFAULT_ENVIRONMENT || 'production';
const ENABLE_CONFETTI = import.meta.env.VITE_ENABLE_CONFETTI !== 'false';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Our friendly deployment agents
const AGENTS = [
  { id: 'guardian', name: 'Guardian', emoji: '🛡️', color: '#3B82F6', message: 'Guardian checking security and permissions...' },
  { id: 'speedster', name: 'Speedster', emoji: '⚡', color: '#F59E0B', message: 'Speedster optimizing performance and assets...' },
  { id: 'detective', name: 'Detective', emoji: '🔍', color: '#10B981', message: 'Detective running comprehensive tests...' },
  { id: 'architect', name: 'Architect', emoji: '🏗️', color: '#8B5CF6', message: 'Architect finalizing deployment structure...' }
];

function App() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('ready');
  const [currentAgent, setCurrentAgent] = useState(null);
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState([]);
  const [lastDeployment, setLastDeployment] = useState(null);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [currentVersion, setCurrentVersion] = useState('2.4.1');
  const [deploymentId, setDeploymentId] = useState(null);
  const [deploymentStartTime, setDeploymentStartTime] = useState(null);
  const [error, setError] = useState(null);
  
  const pollingRef = useRef(null);
  const isPolling = useRef(false);

  // Polling function for deployment status
  const pollDeploymentStatus = useCallback(async () => {
    if (!deploymentId || !deploymentStartTime || isPolling.current) {
      return;
    }

    isPolling.current = true;
    
    try {
      const response = await fetch(
        `${API_BASE}/status?deploymentId=${deploymentId}&startTime=${encodeURIComponent(deploymentStartTime)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update UI state
      setProgress(data.progress);
      setAgentStatuses(data.agentStatuses);
      setCurrentAgent(data.currentStage);
      setCurrentVersion(data.version);
      setError(null);
      
      // Add new messages
      if (data.messages && data.messages.length > 0) {
        setMessages(prev => {
          const newMessages = data.messages.filter(msg => 
            !prev.some(existingMsg => existingMsg.text === msg.text)
          );
          return [...prev, ...newMessages];
        });
      }
      
      // Check if deployment is complete
      if (data.isComplete) {
        setIsDeploying(false);
        setDeploymentStatus('success');
        setLastDeployment({
          time: new Date().toLocaleString(),
          status: 'Success',
          version: data.version
        });
        
        // Clear polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        
        // Celebrate with confetti (if enabled)!
        if (ENABLE_CONFETTI) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }
      
    } catch (error) {
      console.error('Polling error:', error);
      setError('Unable to check deployment status. Please refresh the page.');
    } finally {
      isPolling.current = false;
    }
  }, [deploymentId, deploymentStartTime]);
  
  // Set up polling when deployment starts
  useEffect(() => {
    if (isDeploying && deploymentId && deploymentStartTime) {
      // Start polling immediately
      pollDeploymentStatus();
      
      // Set up interval polling
      pollingRef.current = setInterval(pollDeploymentStatus, POLLING_INTERVAL);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [isDeploying, deploymentId, deploymentStartTime, pollDeploymentStatus]);
  
  // Load initial status on component mount
  useEffect(() => {
    const loadInitialStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/deploy`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          setCurrentVersion(data.version);
          setDeploymentStatus(data.status);
        }
      } catch (error) {
        console.error('Failed to load initial status:', error);
      }
    };
    
    loadInitialStatus();
  }, []);

  const handleDeploy = async () => {
    if (isDeploying) return;
    
    try {
      setError(null);
      
      // Reset state
      setIsDeploying(true);
      setDeploymentStatus('deploying');
      setProgress(0);
      setMessages([{
        text: 'Starting calendar update... Our friendly helpers are on it!',
        timestamp: new Date().toLocaleTimeString(),
        type: 'info'
      }]);
      setAgentStatuses({});
      setCurrentAgent(null);
      
      // Send deployment request to Netlify function
      const response = await fetch(`${API_BASE}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          environment: DEFAULT_ENVIRONMENT,
          user: DEFAULT_USER
        })
      });
      
      if (!response.ok) {
        throw new Error(`Deployment failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Store deployment info for status polling
        setDeploymentId(data.deploymentId);
        setDeploymentStartTime(data.startTime);
        
        setMessages(prev => [...prev, {
          text: `Deployment ${data.deploymentId} started successfully!`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        }]);
      } else {
        throw new Error(data.message || 'Deployment failed');
      }
      
    } catch (error) {
      console.error('Deployment error:', error);
      setError(error.message);
      setIsDeploying(false);
      setDeploymentStatus('failed');
      setMessages(prev => [...prev, {
        text: `Deployment failed: ${error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'error'
      }]);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>📅 FOGG Calendar Update Center</h1>
        <p className="subtitle">Hi Leslie! Ready to update the calendar?</p>
      </header>

      <main className="main-content">
        {/* Status Dashboard */}
        <div className="status-card">
          <h2>System Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Calendar Version:</span>
              <span className="status-value">{currentVersion}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Last Update:</span>
              <span className="status-value">
                {lastDeployment ? `${lastDeployment.time} (v${lastDeployment.version || 'Unknown'})` : 'Never'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Status:</span>
              <span className={`status-badge ${deploymentStatus}`}>
                {deploymentStatus === 'ready' && '✅ Ready'}
                {deploymentStatus === 'deploying' && '⏳ Updating...'}
                {deploymentStatus === 'success' && '🎉 Updated!'}
                {deploymentStatus === 'failed' && '⚠️ Need Help'}
              </span>
            </div>
          </div>
        </div>

        {/* Big Deploy Button */}
        <div className="deploy-section">
          <motion.button
            className={`deploy-button ${isDeploying ? 'deploying' : ''}`}
            onClick={handleDeploy}
            disabled={isDeploying}
            whileHover={{ scale: isDeploying ? 1 : 1.05 }}
            whileTap={{ scale: isDeploying ? 1 : 0.95 }}
          >
            {isDeploying ? (
              <>
                <span className="spinner">⏳</span>
                Updating Calendar...
              </>
            ) : (
              <>
                <span className="button-icon">🚀</span>
                Update Calendar Now
              </>
            )}
          </motion.button>
          
          {isDeploying && (
            <p className="deploy-hint">
              This usually takes about 5 minutes. You can watch the progress below!
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-section">
            <div className="error-message">
              ⚠️ {error}
            </div>
            <button 
              className="retry-button" 
              onClick={() => {
                setError(null);
                setIsDeploying(false);
                setDeploymentStatus('ready');
              }}
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Progress Bar */}
        {isDeploying && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <motion.div 
                className="progress-bar"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="progress-text">
              {progress}% Complete
              {currentAgent && (
                <span className="current-agent">
                  {currentAgent.emoji} {currentAgent.message}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Agent Cards */}
        <div className="agents-section">
          <h2>Your Helpful Assistants</h2>
          <div className="agents-grid">
            {AGENTS.map(agent => (
              <motion.div
                key={agent.id}
                className={`agent-card ${agentStatuses[agent.id] || 'waiting'}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="agent-emoji">{agent.emoji}</div>
                <h3>{agent.name}</h3>
                <p className="agent-message">
                  {agentStatuses[agent.id] === 'working' && agent.message}
                  {agentStatuses[agent.id] === 'done' && '✅ All done!'}
                  {agentStatuses[agent.id] === 'waiting' && 'Ready to help!'}
                  {!agentStatuses[agent.id] && 'Waiting...'}
                </p>
                {agentStatuses[agent.id] === 'working' && (
                  <div className="agent-working">
                    <span className="pulse-dot"></span>
                    Working...
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Message Log */}
        {messages.length > 0 && (
          <div className="messages-section">
            <h2>What's Happening</h2>
            <div className="messages-container">
              <AnimatePresence>
                {messages.slice(-5).map((msg, index) => (
                  <motion.div
                    key={`${msg.timestamp}-${index}`}
                    className={`message message-${msg.type}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <span className="message-time">{msg.timestamp}</span>
                    <span className="message-text">{msg.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="help-section">
          <h3>Need Help?</h3>
          <p>
            If anything looks wrong or you're not sure, just text Patrick! 
            He'll help you right away. Remember: you can't break anything - 
            the system keeps everything safe automatically.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;