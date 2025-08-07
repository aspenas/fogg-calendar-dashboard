module.exports = {
  apps: [
    {
      name: 'fogg-dashboard',
      script: './server.js',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      // Performance monitoring
      min_uptime: '10s',
      max_restarts: 10,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Resource monitoring
      monitoring: true,
      instance_var: 'INSTANCE_ID',
      
      // Auto-restart on file changes (disabled in production)
      ignore_watch: ['node_modules', 'logs', 'dist', '.git'],
      
      // Environment-specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        ENABLE_REAL_DEPLOYMENT: true
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        ENABLE_REAL_DEPLOYMENT: false
      }
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'deploy.foggcalendar.com',
      ref: 'origin/main',
      repo: 'git@github.com:fogg/calendar-dashboard.git',
      path: '/var/www/fogg-dashboard',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'npm test',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};