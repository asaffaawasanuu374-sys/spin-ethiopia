// PM2 Configuration for 24/7 Production Operation
// Run with: pm2 start ecosystem.config.cjs
// Save startup on reboot: pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: 'spin-ethiopia-server',
      script: './dist/server.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        START_WORKER: 'true',
      },
      exp_backoff_restart_delay: 1000,
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
