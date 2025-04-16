import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
// import { spawn } from 'child_process'; // REMOVE child_process
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
// *** ADDED: Import PM2 API ***
import pm2 from 'pm2';

// Add helper for timestamp
const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => console[level](new Date().toISOString(), '[WM]', ...args);

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); 

log('log', "--- Worker Manager Service Starting ---");

// --- Configuration --- 
const portString = process.env.PORT || '8000'; // Default to string '8000'
const PORT = parseInt(portString, 10); // Explicitly parse to number
const MANAGER_SECRET_KEY = process.env.MANAGER_SECRET_KEY;
const WORKER_SCRIPT_PATH = process.env.WORKER_SCRIPT_PATH || '../discord-worker/src/worker.ts';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Worker uses anon key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service key for admin check

if (!MANAGER_SECRET_KEY) {
    log('error', "FATAL: MANAGER_SECRET_KEY environment variable not set.");
    process.exit(1);
}

// --- State ---
// REMOVED: const activeWorkers = new Map<string, WorkerInfo>(); // No longer needed

// *** ADDED: Supabase Admin Client ***
let supabaseAdmin: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabaseAdmin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    });
    log('log', "Supabase Admin client initialized for checks.");
} else {
    log('error', "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Cannot perform pre-spawn checks.");
}

// --- PM2 Connection ---
let pm2Connected = false;
pm2.connect((err) => {
  if (err) {
    log('error', 'PM2 connection error:', err);
    process.exit(2);
  }
  log('log', 'Connected to PM2 daemon successfully.');
  pm2Connected = true;
  // Optional: Clean up any old worker processes on startup?
});

// --- Express App Setup --- 
const app = express();
app.use(cors()); // Allow all origins for now, restrict in production
app.use(express.json()); // Parse JSON bodies

// --- Authentication Middleware --- 
const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authorization header missing or malformed' });
        return;
    }
    const token = authHeader.split(' ')[1];
    if (token !== MANAGER_SECRET_KEY) {
        res.status(403).json({ error: 'Invalid secret key' });
        return;
    }
    next(); // Authentication successful
};

// --- Helper Function ---
const getWorkerPm2Name = (agentId: string): string => `worker-${agentId}`;

// --- Routes --- 

app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Worker Manager Service is running.');
});

// *** REFACTORED: Endpoint to start a new worker using PM2 ***
app.post('/start-worker', authenticate, async (req: Request, res: Response) => {
    const { agentId, botToken, timeoutMinutes, guildId, channelId, connectionId } = req.body;
    log('log', `[MANAGER RECV] Received /start-worker request for Agent ID: ${agentId}, Connection ID: ${connectionId}`);
    const workerName = getWorkerPm2Name(agentId);

    if (!agentId || !botToken || timeoutMinutes === undefined || !connectionId) { // Check timeoutMinutes defined
        res.status(400).json({ error: 'Missing required fields: agentId, botToken, timeoutMinutes, connectionId' });
        return;
    }

    // --- Check if worker already running via PM2 ---
    try {
        const description = await new Promise<pm2.ProcessDescription[]>((resolve, reject) => {
             pm2.describe(workerName, (err, desc) => {
                 if (err && !err.message.toLowerCase().includes('not found')) { // Ignore "process not found" errors here
                    return reject(err);
                 }
                 resolve(desc || []);
             });
        });
        
        if (description.length > 0 && description[0].pm2_env?.status === 'online') {
            log('warn', `Worker ${workerName} is already running according to PM2.`);
            res.status(200).json({ message: `Worker for ${agentId} is already active.` });
            return;
        }
        log('log', `Worker ${workerName} is not currently running or found in PM2. Proceeding with start.`);

    } catch (err) {
        log('error', `[MANAGER START] Error checking PM2 status for ${workerName}:`, err);
        res.status(500).json({ error: 'Failed to check worker status before starting.' });
        return;
    }
    
    // *** No need for pre-spawn DB checks here - PM2 is the source of truth for running process ***

    // --- PM2 Start Options ---
    const workerEnv: { [key: string]: string | undefined } = {
        // Don't spread process.env directly for security/isolation
        DISCORD_BOT_TOKEN: botToken,
        AGENT_ID: agentId,
        CONNECTION_ID: connectionId,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        // Include Node options if needed, e.g., for memory limits
        // NODE_OPTIONS: '--max-old-space-size=256' 
    };

    const parsedTimeout = parseInt(String(timeoutMinutes), 10);
    if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
        workerEnv.TIMEOUT_MINUTES = String(parsedTimeout);
        log('log', `Setting TIMEOUT_MINUTES=${workerEnv.TIMEOUT_MINUTES} for worker ${agentId}`);
    } else {
        log('log', `Timeout is 0 or invalid (${timeoutMinutes}), TIMEOUT_MINUTES will not be set for worker ${agentId}.`);
    }

    const startOptions: pm2.StartOptions = {
        script: WORKER_SCRIPT_PATH,
        name: workerName,
        exec_interpreter: 'ts-node', // Use ts-node
        exec_mode: 'fork', // Use fork mode
        env: workerEnv,
        // Configure logs (optional, PM2 handles defaults)
        // output: `/root/.pm2/logs/${workerName}-out.log`,
        // error: `/root/.pm2/logs/${workerName}-error.log`,
        autorestart: false, // Don't automatically restart if it fails/stops
        // watch: false, // Don't watch for file changes
    };

    log('log', `[MANAGER SPAWN CMD] Starting worker ${workerName} via PM2... Options:`, JSON.stringify(startOptions, null, 2));

    pm2.start(startOptions, (err, apps) => {
        if (err) {
            log('error', `[MANAGER SPAWN ERR] Error starting worker ${workerName} via PM2:`, err);
            res.status(500).json({ error: `Failed to start worker ${agentId}` });
        } else {
            log('log', `[MANAGER SPAWN OK] Worker ${workerName} started via PM2. App info:`, apps);
            // Respond immediately - PM2 handles the process now
            res.status(202).json({ message: `Worker process for ${agentId} is being started via PM2.` });
        }
    });
});

// *** REFACTORED: Endpoint to stop a worker via PM2 ***
app.post('/stop-worker', authenticate, (req: Request, res: Response) => {
    const { agentId } = req.body;
    log('log', `[MANAGER RECV] Received /stop-worker request for Agent ID: ${agentId}`);
    const workerName = getWorkerPm2Name(agentId);

    if (!agentId) {
        res.status(400).json({ error: 'Missing required field: agentId' });
        return;
    }

    log('log', `[MANAGER STOP] Attempting to stop worker ${workerName} via PM2...`);
    pm2.stop(workerName, (err, proc) => {
         if (err) {
             // Check if error is "process not found" - treat as success
             if (err.message && err.message.toLowerCase().includes('not found')) {
                 log('warn', `[MANAGER STOP] Worker ${workerName} not found by PM2 (already stopped?).`);
                 res.status(200).json({ message: `Worker for ${agentId} was not found (already stopped?).` });
             } else {
                 log('error', `[MANAGER STOP ERR] Error stopping worker ${workerName} via PM2:`, err);
                 res.status(500).json({ error: `Failed to stop worker ${agentId}.` });
             }
         } else {
             log('log', `[MANAGER STOP OK] Successfully stopped worker ${workerName} via PM2.`);
             res.status(200).json({ message: `Worker for ${agentId} stopped successfully.` });
         }
    });
});

// *** REFACTORED: Endpoint to get status of workers via PM2 ***
app.get('/status', authenticate, async (req: Request, res: Response) => {
    const specificAgentId = req.query.agent_id as string | undefined;

    if (specificAgentId) {
        const workerName = getWorkerPm2Name(specificAgentId);
        log('log', `[MANAGER RECV] Received /status request for Agent ID: ${specificAgentId} (PM2 name: ${workerName})`);
        
        pm2.describe(workerName, (err, description) => {
            if (err && !err.message.toLowerCase().includes('not found')) {
                 log('error', `[MANAGER STATUS ERR] Error describing PM2 process ${workerName}:`, err);
                 res.status(500).json({ error: 'Failed to query worker status.' });
            } else if (description && description.length > 0 && description[0].pm2_env?.status === 'online') {
                log('log', `[MANAGER STATUS] PM2 status for ${workerName}: online`);
                 res.status(200).json({ agentId: specificAgentId, status: 'active' }); // Report 'active' if PM2 says online
            } else {
                 log('log', `[MANAGER STATUS] PM2 status for ${workerName}: offline or not found`);
                 res.status(200).json({ agentId: specificAgentId, status: 'inactive' }); // Report 'inactive' otherwise
            }
        });

    } else {
        // Return status for all potential worker agents
        log('log', `[MANAGER RECV] Received /status request for all agents`);
        pm2.list((err, list) => {
             if (err) {
                 log('error', `[MANAGER STATUS ERR] Error listing PM2 processes:`, err);
                 res.status(500).json({ error: 'Failed to list workers.' });
                 return;
             }
             
             const workerProcesses = list.filter(proc => proc.name?.startsWith('worker-'));
             const activeAgentIds = workerProcesses
                 .filter(proc => proc.pm2_env?.status === 'online')
                 .map(proc => proc.name?.replace('worker-', '')); // Extract agent ID from name

             const response = {
                 activeWorkerCount: activeAgentIds.length,
                 activeAgentIds: activeAgentIds
             };
             log('log', `[MANAGER STATUS] Overall status: ${JSON.stringify(response)}`);
             res.status(200).json(response);
        });
    }
});

// --- Start Server --- 
app.listen(PORT, '0.0.0.0', () => {
    log('log', `Worker Manager Service listening on port ${PORT}`);
});

// --- Graceful Shutdown Handling --- 
const cleanup = () => {
    log('log', 'Disconnecting from PM2 daemon...');
    pm2.disconnect(); // Disconnect from PM2
    log('log', 'Shutting down manager service...');
    // No need to manually kill workers - PM2 handles them
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup); 