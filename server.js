import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Agentopia Backend',
    version: '1.0.0',
    environment: {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development',
      hasInternalSecret: !!process.env.INTERNAL_API_SECRET,
      hasDtmaApiKey: !!process.env.BACKEND_TO_DTMA_API_KEY,
      hasDoToken: !!process.env.DO_API_TOKEN
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Agentopia Backend Server',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET / - Service info',
      'GET /health - Health check',
      'POST /internal/agents/:agentId/ensure-tool-environment - Provision tool environment',
      'DELETE /internal/agents/:agentId/tool-environment - Deprovision tool environment'
    ]
  });
});

// Simple internal API endpoint for testing
app.post('/internal/agents/:agentId/ensure-tool-environment', (req, res) => {
  const { agentId } = req.params;
  const secret = req.headers['x-internal-api-secret'];
  
  if (!process.env.INTERNAL_API_SECRET) {
    return res.status(500).json({ error: 'Internal server configuration error.' });
  }
  
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid internal API secret.' });
  }
  
  console.log(`[Internal API] Received request to ensure tool environment for agent: ${agentId}`);
  
  // For now, return a success response to test the flow
  res.json({
    success: true,
    message: `Tool environment provisioning initiated for agent ${agentId}`,
    data: {
      agent_id: agentId,
      status: 'provisioning',
      note: 'This is a test response - full implementation pending'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`=== Agentopia Backend Server ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`Internal API: http://localhost:${PORT}/internal`);
  console.log(`=== Server Ready ===`);
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

export default app; 