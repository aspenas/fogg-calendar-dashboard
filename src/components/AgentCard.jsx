import React from 'react';
import { motion } from 'framer-motion';

const AgentCard = ({ agent, isActive, isComplete }) => {
  const getStatus = () => {
    if (isComplete) return 'Complete!';
    if (isActive) return 'Working...';
    return 'Waiting';
  };

  const getClassName = () => {
    let className = 'agent-card';
    if (isActive) className += ' active';
    if (isComplete) className += ' complete';
    return className;
  };

  return (
    <motion.div
      className={getClassName()}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: isActive ? 1.05 : isComplete ? 1 : 0.95,
        opacity: isActive || isComplete ? 1 : 0.5
      }}
      transition={{ duration: 0.3 }}
    >
      <span className="agent-emoji">{agent.emoji}</span>
      <div className="agent-name">{agent.name}</div>
      <div className="agent-status">{getStatus()}</div>
      <div className="agent-role" style={{ fontSize: '12px', color: '#a0aec0', marginTop: '4px' }}>
        {agent.role}
      </div>
    </motion.div>
  );
};

export default AgentCard;