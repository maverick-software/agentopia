import express from 'express';

const app = express();
const PORT = process.env.PORT || 30000;

// Environment variables for configuration
const DTMA_BEARER_TOKEN = process.env.DTMA_BEARER_TOKEN || '';
const AGENTOPIA_API_BASE_URL = process.env.AGENTOPIA_API_BASE_URL || '';
const BACKEND_TO_DTMA_API_KEY = process.env.BACKEND_TO_DTMA_API_KEY || '';

// Middleware
app.use(express.json());

// Simple authentication middleware
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!DTMA_BEARER_TOKEN && !BACKEND_TO_DTMA_API_KEY) {
    console.log('No auth tokens configured, allowing request');
    return next();
  }

  const isValidToken = token === DTMA_BEARER_TOKEN || token === BACKEND_TO_DTMA_API_KEY;
  
  if (!token || !isValidToken) {
    console.log('Invalid or missing authentication token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Health check endpoint (public - no auth required)
app.get('/status', (_req: any, res: any) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'DTMA',
    environment: {
      hasAuthToken: !!DTMA_BEARER_TOKEN,
      hasApiKey: !!BACKEND_TO_DTMA_API_KEY,
      hasApiBaseUrl: !!AGENTOPIA_API_BASE_URL,
      port: PORT
    }
  });
});

// Root endpoint
app.get('/', (_req: any, res: any) => {
  res.json({
    service: 'Droplet Tool Management Agent (DTMA)',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET / - Service info',
      'GET /status - Health check',
      'GET /tools - List tools (auth required)',
      'POST /tools - Deploy tool (auth required)'
    ]
  });
});

// Tools listing endpoint
app.get('/tools', authenticate, (_req: any, res: any) => {
  res.json({
    status: 'success',
    tools: [],
    message: 'Tool management service available - Docker integration pending'
  });
});

// Tool deployment endpoint
app.post('/tools', authenticate, (req: any, res: any) => {
  const { dockerImageUrl, instanceNameOnToolbox, accountToolInstanceId } = req.body;
  
  if (!dockerImageUrl || !instanceNameOnToolbox) {
    return res.status(400).json({
      error: 'Missing required fields: dockerImageUrl, instanceNameOnToolbox'
    });
  }

  console.log(`Tool deployment request received:`, {
    dockerImageUrl,
    instanceNameOnToolbox,
    accountToolInstanceId
  });

  // For now, acknowledge the request
  res.json({
    status: 'accepted',
    message: 'Tool deployment request received and logged',
    instanceNameOnToolbox,
    dockerImageUrl,
    accountToolInstanceId,
    note: 'Full Docker container management will be implemented in next phase'
  });
});

// Error handling
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((_req: any, res: any) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`=== DTMA Service Starting ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Auth Token Configured: ${!!DTMA_BEARER_TOKEN}`);
  console.log(`API Key Configured: ${!!BACKEND_TO_DTMA_API_KEY}`);
  console.log(`API Base URL: ${AGENTOPIA_API_BASE_URL || 'Not configured'}`);
  console.log(`Health Check: http://localhost:${PORT}/status`);
  console.log(`=== DTMA Service Ready ===`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 