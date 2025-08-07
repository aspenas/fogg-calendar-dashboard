import React from 'react';
import { motion } from 'framer-motion';

const DeployButton = ({ onClick, isDeploying, status }) => {
  const getButtonText = () => {
    if (isDeploying) return 'Deploying...';
    if (status === 'success') return '✨ Deployed!';
    if (status === 'error') return 'Try Again';
    return 'Deploy Now';
  };

  const getButtonClass = () => {
    let className = 'deploy-button';
    if (isDeploying) className += ' deploying';
    return className;
  };

  return (
    <motion.button
      className={getButtonClass()}
      onClick={onClick}
      disabled={isDeploying}
      whileHover={{ scale: isDeploying ? 1 : 1.05 }}
      whileTap={{ scale: isDeploying ? 1 : 0.95 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
    >
      {getButtonText()}
      {isDeploying && <span className="spinner"></span>}
    </motion.button>
  );
};

export default DeployButton;