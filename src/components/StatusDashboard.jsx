import React from 'react';
import { motion } from 'framer-motion';

const StatusDashboard = ({ status, isDeploying }) => {
  const getStatusColor = (statusText) => {
    if (statusText === 'Ready' || statusText === 'Excellent') return 'success';
    if (statusText === 'Deploying') return 'warning';
    if (statusText === 'Error') return 'danger';
    return '';
  };

  const formatLastDeploy = (lastDeploy) => {
    if (lastDeploy === 'Never') return 'Never deployed';
    
    const deployTime = new Date(lastDeploy);
    const now = new Date();
    const diff = now - deployTime;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <motion.div 
      className={`status-card ${isDeploying ? 'active' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
        System Status
      </h2>
      
      <div className="status-grid">
        <div className="status-item">
          <label>Current Version</label>
          <div className="value">{status.version}</div>
        </div>
        
        <div className="status-item">
          <label>Last Update</label>
          <div className="value">{formatLastDeploy(status.lastDeploy)}</div>
        </div>
        
        <div className="status-item">
          <label>Status</label>
          <div className={`value ${getStatusColor(status.status)}`}>
            {isDeploying ? 'Deploying...' : status.status}
          </div>
        </div>
        
        <div className="status-item">
          <label>System Health</label>
          <div className={`value ${getStatusColor(status.health)}`}>
            {status.health}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StatusDashboard;