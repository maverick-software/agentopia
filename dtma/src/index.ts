import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import si from 'systeminformation'; // Added import
import { authenticateBackendRequest } from './auth_middleware.js'; // Renamed import
import toolRoutes from './routes/tool_routes.js'; // Use .js extension
import { sendHeartbeat, DtmaHeartbeatPayload } from './agentopia_api_client.js'; // Import DtmaHeartbeatPayload
import { listContainers, inspectContainer } from './docker_manager.js'; // Added import for listContainers and inspectContainer
import Dockerode from 'dockerode'; // Added Dockerode for Port type
import http from 'http'; // Added http import for Server type

// --- DTMA Internal State ---
// This map will store details about managed tool instances, keyed by instanceNameOnToolbox
export interface ManagedToolInstance {
    accountToolInstanceId: string;
    // Add other relevant details received during deployment if needed
    dockerImageUrl: string; 
    creationPortBindings?: Dockerode.PortMap; // Store the port bindings used at creation
}
export const managedInstances = new Map<string, ManagedToolInstance>();

// TODO: Persist and load this map if DTMA needs to recover state across restarts.
// For now, it's in-memory and repopulated via backend commands / DTMA restarts clean.

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
      // Add uptime, network stats, etc. if useful for backend
      uptime_seconds: si.time().uptime,
    };
  } catch (error) {
    console.error('Error fetching system status:', error);
    return { error: 'Failed to fetch system status' };
  }
}

// --- Tool Status Function (for heartbeat and /status endpoint) ---
async function getManagedToolInstanceStatuses(): Promise<DtmaHeartbeatPayload['tool_statuses']> {
  const statuses: DtmaHeartbeatPayload['tool_statuses'] = [];
  for (const [instanceName, managedDetail] of managedInstances.entries()) {
    try {
      // instanceName here is the container name DTMA uses (instanceNameOnToolbox)
      const inspectInfo = await inspectContainer(instanceName);
      statuses.push({
        account_tool_instance_id: managedDetail.accountToolInstanceId,
        status_on_toolbox: inspectInfo.State.Status || 'unknown', // e.g., running, exited
        runtime_details: {
          container_id: inspectInfo.Id,
          image: inspectInfo.Config.Image,
          started_at: inspectInfo.State.StartedAt,
          state_details: inspectInfo.State, // Includes Running, Paused, Restarting, OOMKilled, Dead, Pid, ExitCode, Error, FinishedAt
        },
      });
    } catch (error: any) {
      // If inspect fails (e.g., container not found unexpectedly), report error for this instance
      console.warn(`Error inspecting container ${instanceName} for status:`, error.message);
      statuses.push({
        account_tool_instance_id: managedDetail.accountToolInstanceId,
        status_on_toolbox: 'error_inspecting',
        runtime_details: { error: error.message },
      });
    }
  }
  return statuses;
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
  
  const getHeartbeatPayload = async (): Promise<DtmaHeartbeatPayload> => {
    const systemStatus = await getSystemStatus();
    const toolStatuses = await getManagedToolInstanceStatuses(); // Use new function
    return {
      dtma_version: dtmaVersion,
      system_status: systemStatus,
      tool_statuses: toolStatuses,
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

// --- New /status endpoint ---
app.get('/status', authenticateBackendRequest, async (req: Request, res: Response) => {
  try {
    const systemMetrics = await getSystemStatus();
    const toolInstanceDetails: Array<any> = []; // Type this more strictly later
    
    for (const [instanceName, managedDetail] of managedInstances.entries()) {
        let status = 'unknown';
        let metrics = {};
        let containerId: string | undefined = undefined;
        try {
            const inspectData = await inspectContainer(instanceName);
            status = inspectData.State?.Status || 'unknown';
            containerId = inspectData.Id;
            // TODO: Add per-instance metrics if possible (e.g., from docker stats)
            // For now, just basic status from inspect.
            // metrics = await getContainerStats(instanceName); // Placeholder for future enhancement
        } catch (e: any) {
            console.warn(`Could not inspect container ${instanceName} for /status endpoint: ${e.message}`);
            status = 'error_inspecting';
            if (e.code === 404 || (e.message && e.message.includes('No such container'))) {
                status = 'not_found'; // More specific status if container is gone
            }
        }
        toolInstanceDetails.push({
            account_tool_instance_id: managedDetail.accountToolInstanceId,
            instance_name_on_toolbox: instanceName,
            status: status,
            container_id: containerId,
            // metrics: metrics, // Uncomment when metrics are implemented
        });
    }

    res.status(200).json({
      dtma_version: dtmaVersion,
      system_metrics: systemMetrics,
      tool_instances: toolInstanceDetails,
    });
  } catch (error: any) {
    console.error('Error handling /status request:', error);
    res.status(500).json({ error: 'Failed to retrieve DTMA status' });
  }
});

// Apply authentication middleware to all routes below this point
// Or apply specifically to tool routes
// app.use(authenticateBackendRequest); // Changed from authenticateDtmaRequest

// Mount tool management routes
app.use('/tools', authenticateBackendRequest, toolRoutes); // Changed from authenticateDtmaRequest

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