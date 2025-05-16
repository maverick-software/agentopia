import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import si from 'systeminformation'; // Added import
import { authenticateDtmaRequest } from './auth_middleware.js'; // Use .js extension for ESM imports
import toolRoutes from './routes/tool_routes.js'; // Use .js extension
import { sendHeartbeat } from './agentopia_api_client.js';
import { listContainers } from './docker_manager.js'; // Added import for listContainers
import Dockerode from 'dockerode'; // Added Dockerode for Port type
import http from 'http'; // Added http import for Server type

// --- Constants & Config ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 30000; // Port for DTMA API
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
let dtmaVersion = 'unknown';

// --- System Status Function ---
async function getSystemStatus() {
  try {
    const cpuLoad = await si.currentLoad(); // Gets current CPU load %
    const mem = await si.mem(); // Gets memory usage (active, total, free, etc.)
    const fsSize = await si.fsSize(); // Gets filesystem usage

    // Find the main filesystem (often root '/')
    // Type for fs entry comes from systeminformation library
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
        free_bytes: mainFs.size - mainFs.used, // Calculate free based on total and used for consistency
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
    // List all containers managed by this DTMA (or all running, depending on desired scope)
    // For now, let's get all containers, could be filtered by labels later if DTMA adds labels
    const containers = await listContainers(true); // Get all containers (running or not)

    return containers.map(container => ({
      id: container.Id,
      names: container.Names.map((name: string) => name.startsWith('/') ? name.substring(1) : name),
      image: container.Image,
      image_id: container.ImageID,
      command: container.Command,
      created: container.Created, // Timestamp
      state: container.State, // e.g., 'running', 'exited'
      status: container.Status, // e.g., 'Up 2 hours', 'Exited (0) 5 minutes ago'
      ports: container.Ports.map((port: Dockerode.Port) => ({
        ip: port.IP,
        private_port: port.PrivatePort,
        public_port: port.PublicPort,
        type: port.Type,
      })),
      // Potentially add labels or mounts if relevant for Agentopia backend
      // labels: container.Labels,
      // mounts: container.Mounts,
    }));
  } catch (error) {
    console.error('Error fetching tool statuses:', error);
    return [{ error: 'Failed to fetch tool statuses' }]; // Return array with error object
  }
}

// --- Initialization ---
const app = express();
app.use(express.json());
let server: http.Server; // Declare server variable

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

async function startHeartbeat() { // Made async to await getSystemStatus
  console.log(`Starting heartbeat interval (${HEARTBEAT_INTERVAL_MS}ms)`);
  
  const getHeartbeatPayload = async () => {
    const systemStatus = await getSystemStatus();
    const toolStatuses = await getToolStatuses(); // Call the new function
    return {
      dtma_version: dtmaVersion,
      system_status: systemStatus,
      tool_statuses: toolStatuses, // Include tool statuses
    };
  };

  // Send initial heartbeat immediately
  console.log('Sending initial heartbeat...');
  sendHeartbeat(await getHeartbeatPayload()); // Await payload

  // Start periodic heartbeat
  setInterval(async () => { // Made async
    sendHeartbeat(await getHeartbeatPayload()); // Await payload
  }, HEARTBEAT_INTERVAL_MS);
}

// --- Express Routes ---
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Apply authentication middleware to all routes below this point
// Or apply specifically to tool routes
// app.use(authenticateDtmaRequest); 

// Mount tool management routes
app.use('/tools', authenticateDtmaRequest, toolRoutes);

// Default route for handling 404s on API paths
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

// Basic error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// --- Server Start & Shutdown ---
server = app.listen(PORT, async () => { // Assign to server variable
  console.log(`DTMA listening on port ${PORT}`);
  await loadDtmaVersion(); // Load version before starting heartbeat
  startHeartbeat(); 
});

const gracefulShutdown = (signal: string) => {
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    console.log('HTTP server closed.');
    // Add other cleanup logic here if necessary in the future
    // For example, stopping managed Docker containers if DTMA has a list of them
    // For now, just exiting.
    process.exit(0);
  });

  // Force close server after 5 seconds if it hasn't closed yet
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); 