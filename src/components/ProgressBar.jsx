import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ progress }) => {
  const getProgressText = () => {
    if (progress < 25) return 'Preparing deployment...';
    if (progress < 50) return 'Checking everything is safe...';
    if (progress < 75) return 'Updating your calendar...';
    if (progress < 100) return 'Almost done...';
    return 'Complete!';
  };

  return (
    <div className="progress-container">
      <div className="progress-bar-wrapper">
        <motion.div
          className="progress-bar"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>
      <div className="progress-text">
        {getProgressText()} ({Math.round(progress)}%)
      </div>
    </div>
  );
};

export default ProgressBar;