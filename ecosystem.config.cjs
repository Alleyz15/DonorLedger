// ecosystem.config.cjs
//
// PM2 config for the IPserverone NovaCloud VPS (Section 5 — process
// manager: "Keeps Node.js running after terminal closes on VPS").
//
// Usage on the VPS:
//   pm2 start ecosystem.config.cjs
//   pm2 save              # persist across reboots
//   pm2 startup           # generate the systemd unit
//   pm2 logs donorledger
//   pm2 restart donorledger
//
// PM2 reads process.env at start, so the `.env` file is loaded by
// dotenv inside config/env.js as usual.

module.exports = {
  apps: [
    {
      name: 'donorledger',
      script: 'backend/src/server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      kill_timeout: 8000,
      restart_delay: 3000,
      max_memory_restart: '512M',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      out_file: './logs/donorledger.out.log',
      error_file: './logs/donorledger.err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
