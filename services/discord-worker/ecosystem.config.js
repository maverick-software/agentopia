module.exports = {
  apps: [
    {
      name: 'discord-worker-template', // Use a template name
      script: 'src/test.js',       // Point to simple JS file
      // interpreter: './node_modules/.bin/ts-node', // Comment out interpreter
      exec_mode: 'fork',
      autorestart: false,
      // Environment variables will be injected by the manager when starting
      // env: {
      //   NODE_ENV: 'production',
      //   // AGENT_ID, CONNECTION_DB_ID, etc. will be set dynamically
      // }
      // Define a placeholder app. The manager will start specific instances.
      // The name will be overridden by the manager using --only flag.
      // Ensure this app isn't auto-started by a global pm2 start ecosystem.config.js call
      // by potentially setting instances to 0 or managing startup externally.
      // For our use case, the manager calling `pm2 start ecosystem.config.js --only worker-<id>` is key.
    }
  ]
}; 