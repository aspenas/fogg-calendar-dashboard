import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MessageLog = ({ messages }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const getMessageIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="message-container" ref={containerRef}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600', color: '#4a5568' }}>
        Activity Log
      </h3>
      <AnimatePresence>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            className={`message ${message.type}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <span style={{ marginRight: '8px' }}>{getMessageIcon(message.type)}</span>
            <span style={{ flex: 1 }}>{message.text}</span>
            <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '8px' }}>
              {message.timestamp}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default MessageLog;