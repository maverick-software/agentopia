import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import si from 'systeminformation';
import { authenticateDtmaRequest } from './auth_middleware.js';
import toolRoutes from './routes/tool_routes.js';
import mcpRoutes from './routes/mcp_routes.js'; // Import our new MCP routes
import { sendHeartbeat } from './agentopia_api_client.js';
import { listContainers } from './docker_manager.js';
import Dockerode from 'dockerode';
import http from 'http';

// --- Constants & Config ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 30000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
let dtmaVersion = 'unknown';

// --- System Status Function ---
async function getSystemStatus() {
  try {
    const cpuLoad = await si.currentLoad();
    const mem = await si.mem();
    const fsSize = await si.fsSize();

    const mainFs = fsSize.find((fs: si.Systeminformation.FsSizeData) => fs.mount === '/');

    return {
      cpu_load_percent: cpuLoad.currentLoad,
      memory: {
        total_bytes: mem.total,
        active_bytes: mem.active,
        free_bytes: mem.free,
        used_bytes: mem.used,
      },
      disk: mainFs ? {
        mount: mainFs.mount,
        total_bytes: mainFs.size,
        used_bytes: mainFs.used,
        free_bytes: mainFs.size - mainFs.used,
      } : { error: 'Could not determine main filesystem usage.' },
    };
  } catch (error) {
    console.error('Error fetching system status:', error);
    return { error: 'Failed to fetch system status' };
  }
}

// --- Tool Status Function ---
async function getToolStatuses() {
  try {
    const containers = await listContainers(true);

    return containers.map(container => ({
      id: container.Id,
      names: container.Names.map((name: string) => name.startsWith('/') ? name.substring(1) : name),
      image: container.Image,
      image_id: container.ImageID,
      command: container.Command,
      created: container.Created,
      state: container.State,
      status: container.Status,
      ports: container.Ports.map((port: Dockerode.Port) => ({
        ip: port.IP,
        private_port: port.PrivatePort,
        public_port: port.PublicPort,
        type: port.Type,
      })),
    }));
  } catch (error) {
    console.error('Error fetching tool statuses:', error);
    return [{ error: 'Failed to fetch tool statuses' }];
  }
}

// --- Initialization ---
const app = express();
app.use(express.json());
let server: http.Server;

async function loadDtmaVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    dtmaVersion = JSON.parse(pkgContent).version || 'unknown';
    console.log(`DTMA Version: ${dtmaVersion}`);
  } catch (error) {
    console.error('Failed to load DTMA version from package.json:', error);
  }
}

async function startHeartbeat() {
  console.log(`Starting heartbeat interval (${HEARTBEAT_INTERVAL_MS}ms)`);
  
  const getHeartbeatPayload = async () => {
    const systemStatus = await getSystemStatus();
    const toolStatuses = await getToolStatuses();
    return {
      dtma_version: dtmaVersion,
      system_status: systemStatus,
      tool_statuses: toolStatuses,
    };
  };

  console.log('Sending initial heartbeat...');
  sendHeartbeat(await getHeartbeatPayload());

  setInterval(async () => {
    sendHeartbeat(await getHeartbeatPayload());
  }, HEARTBEAT_INTERVAL_MS);
}

// --- Express Routes ---
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Root endpoint with updated info
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Droplet Tool Management Agent (DTMA)',
    version: dtmaVersion,
    status: 'running',
    features: ['Standard Tool Management', 'Multi-MCP Server Orchestration'],
    endpoints: [
      'GET / - Service info',
      'GET /health - Health check',
      'GET /tools/* - Standard tool management (auth required)',
      'GET /mcp/* - Multi-MCP server management (auth required)'
    ]
  });
});

// Mount tool management routes (existing functionality)
app.use('/tools', authenticateDtmaRequest, toolRoutes);

// Mount MCP management routes (new multi-MCP functionality)
app.use('/mcp', authenticateDtmaRequest, mcpRoutes);

// Default route for handling 404s on API paths
app.use((req: Request, res: Response) => {
    res.status(404).json({ 
      error: 'Not Found',
      availableRoutes: [
        '/health - Health check',
        '/tools/* - Standard tool management',
        '/mcp/* - Multi-MCP server management'
      ]
    });
});

// Basic error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// --- Server Start & Shutdown ---
server = app.listen(PORT, async () => {
  console.log(`=== DTMA Service Starting ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Features: Standard Tools + Multi-MCP Orchestration`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`Tool Management: http://localhost:${PORT}/tools/*`);
  console.log(`MCP Management: http://localhost:${PORT}/mcp/*`);
  console.log(`=== DTMA Service Ready ===`);
  
  await loadDtmaVersion();
  startHeartbeat(); 
});

const gracefulShutdown = (signal: string) => {
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); 