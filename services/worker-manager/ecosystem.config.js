const path = require('path');

// Define the base path relative to this config file
const basePath = path.resolve(__dirname, '../discord-worker');

module.exports = {
  apps : [{
    // This is a template declaration. We won't run this directly using 'pm2 start ecosystem.config.js'.
    // Instead, the manager will use pm2.start() programmatically referencing parts of this.
    // However, defining it helps structure the configuration.
    name           : 'discord-worker-template', // Placeholder name - manager will override this
    script         : path.resolve(basePath, 'src/worker.ts'), // Path to the worker script
    interpreter    : path.resolve(basePath, 'node_modules/.bin/ts-node'), // Explicit path to worker's ts-node
    // node_args      : '--require ts-node/register', // Alternative if interpreter path fails (keep commented for now)
    exec_mode      : 'fork',
    instances      : 1,
    autorestart    : false, // Do not restart automatically if it crashes or stops
    watch          : false, // Do not watch for file changes
    max_memory_restart: '1G', // Optional: Restart if it exceeds memory limit
    // Environment variables can be defined here as defaults,
    // but the manager will pass the specific ones needed per worker instance.
    env: {
      NODE_ENV: 'production', // Or 'development'
      // Other default env vars if needed
    },
    // Specify log file paths (optional, PM2 defaults usually fine)
    // output: path.resolve(__dirname, '../../logs/workers/worker-out.log'), // Example path
    // error: path.resolve(__dirname, '../../logs/workers/worker-error.log'), // Example path
    // merge_logs: true, // Example option
  }]
}; 