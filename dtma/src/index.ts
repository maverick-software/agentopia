import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateDtmaRequest } from './auth_middleware.js'; // Use .js extension for ESM imports
import toolRoutes from './routes/tool_routes.js'; // Use .js extension
import { sendHeartbeat } from './agentopia_api_client.js';

// --- Constants & Config ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 30000; // Port for DTMA API
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
let dtmaVersion = 'unknown';

// --- Initialization ---
const app = express();
app.use(express.json());

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

function startHeartbeat() {
  console.log(`Starting heartbeat interval (${HEARTBEAT_INTERVAL_MS}ms)`);
  
  // Define the heartbeat payload
  const getHeartbeatPayload = () => ({
      dtma_version: dtmaVersion,
      // TODO: Add system_status (CPU, Mem, Disk)
      system_status: {},
      // TODO: Add tool_statuses by querying Docker manager
      tool_statuses: [],
  });

  // Send initial heartbeat immediately
  console.log('Sending initial heartbeat...');
  sendHeartbeat(getHeartbeatPayload());

  // Start periodic heartbeat
  setInterval(() => {
    sendHeartbeat(getHeartbeatPayload());
  }, HEARTBEAT_INTERVAL_MS);
}

// --- Express Routes ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Apply authentication middleware to all routes below this point
// Or apply specifically to tool routes
// app.use(authenticateDtmaRequest); 

// Mount tool management routes
app.use('/tools', authenticateDtmaRequest, toolRoutes);

// Default route for handling 404s on API paths
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Basic error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// --- Server Start & Shutdown ---
app.listen(PORT, async () => {
  console.log(`DTMA listening on port ${PORT}`);
  await loadDtmaVersion(); // Load version before starting heartbeat
  startHeartbeat(); 
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  // TODO: Add cleanup logic if needed (e.g., stop ongoing operations)
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  // TODO: Add cleanup logic if needed
  process.exit(0);
}); 