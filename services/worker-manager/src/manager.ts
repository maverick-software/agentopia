import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
// import { spawn } from 'child_process'; // REMOVE child_process
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
// *** ADDED: Import PM2 API ***
// @ts-ignore 
import pm2 from 'pm2';

// Add helper for timestamp
const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => {
    // Ensure timestamp and prefix are applied consistently
    const timestamp = new Date().toISOString();
    const prefix = '[WM]';
    switch (level) {
        case 'warn':
            console.warn(timestamp, prefix, ...args);
            break;
        case 'error':
            console.error(timestamp, prefix, ...args);
            break;
        default:
            console.log(timestamp, prefix, ...args);
            break;
    }
};

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
pm2.connect((err: any) => {
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
    const { agentId, connectionDbId, botToken, inactivityTimeout } = req.body;
    log('log', `[MANAGER RECV] Received /start-worker request for Agent ID: ${agentId}`);

    // --- Input Validation ---
    if (!agentId || !connectionDbId || !botToken) {
        res.status(400).json({ error: 'Missing required fields: agentId, connectionDbId, or botToken' });
        return;
    }

    // --- Check for Required Environment Variables ---
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        log('error', '[MANAGER START ERR] SUPABASE_URL or SUPABASE_ANON_KEY environment variables are not set.');
        res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials.' });
        return;
    }

    const workerName = getWorkerPm2Name(agentId);

    // --- Check if worker already running via PM2 ---
    pm2.describe(workerName, (err: any, description: any) => {
        if (err && !err.message.toLowerCase().includes('not found')) {
            log('error', `[MANAGER START ERR] Error checking existing PM2 process ${workerName}:`, err);
            res.status(500).json({ error: 'Failed to query worker status before starting.' });
            return;
        }

        if (description && description.length > 0 && description[0].pm2_env?.status === 'online') {
            log('warn', `[MANAGER START] Worker ${workerName} is already running according to PM2.`);
            res.status(409).json({ message: `Worker ${agentId} is already active.` });
            return;
        }

        // --- Worker Not Running - Proceed to Start ---
        log('log', `[MANAGER START] Worker ${workerName} is not running or not found by PM2. Proceeding to start...`);

        // --- PM2 Start Options ---

        // Robustly handle inactivityTimeout: undefined, null, 0, or "never" mean indefinite (0)
        let inactivityTimeoutValue = '10'; // Default to 10 minutes if not specified
        // Use inactivityTimeout directly from req.body
        const lowerCaseTimeout = String(inactivityTimeout).toLowerCase();

        if (inactivityTimeout === undefined || inactivityTimeout === null || inactivityTimeout === 0 || lowerCaseTimeout === 'never') {
            inactivityTimeoutValue = '0'; // Indefinite timeout
            log('log', `[MANAGER START] Inactivity timeout is indefinite (received: ${inactivityTimeout}), setting INACTIVITY_TIMEOUT_MINUTES=0 for worker ${agentId}`);
        } else {
            // Use inactivityTimeout directly from req.body
            const parsedTimeout = parseInt(String(inactivityTimeout), 10);
            if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
                inactivityTimeoutValue = String(parsedTimeout);
                log('log', `[MANAGER START] Setting INACTIVITY_TIMEOUT_MINUTES=${inactivityTimeoutValue} for worker ${agentId}`);
            } else {
                log('warn', `[MANAGER START] Invalid inactivity timeout value received: ${inactivityTimeout}. Defaulting to ${inactivityTimeoutValue} minutes.`);
                // Keep the default value '10'
            }
        }

        // Construct environment variables for the worker process
        const workerEnv: { [key: string]: string } = { // Ensure type matches PM2 expectation
            AGENT_ID: agentId,
            CONNECTION_DB_ID: connectionDbId,
            INACTIVITY_TIMEOUT_MINUTES: inactivityTimeoutValue,
            // Add BOT_TOKEN here
            DISCORD_BOT_TOKEN: botToken,
            // Pass Supabase creds (guaranteed to be strings here)
            SUPABASE_URL: SUPABASE_URL,
            SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
            // Include Node options if needed, e.g., for memory limits
            // NODE_OPTIONS: '--max-old-space-size=256'
        };

        const startOptions: pm2.StartOptions = {
            script: WORKER_SCRIPT_PATH,
            name: workerName,
            interpreter: 'ts-node', // Corrected from exec_interpreter
            exec_mode: 'fork', // Use fork mode
            env: workerEnv,
            // Configure logs (optional, PM2 handles defaults)
            // output: `/root/.pm2/logs/${workerName}-out.log`,
            // error: `/root/.pm2/logs/${workerName}-error.log`,
            autorestart: false, // Don't automatically restart if it fails/stops
            // watch: false, // Don't watch for file changes
        };

        log('log', `[MANAGER SPAWN CMD] Starting worker ${workerName} via PM2... Options:`, JSON.stringify(startOptions, null, 2));

        pm2.start(startOptions, (err: any, apps: any) => { // Explicit 'any'
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
    pm2.stop(workerName, (err: any, proc: any) => { // Explicit 'any'
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
        
        pm2.describe(workerName, (err: any, description: any) => { // Explicit 'any'
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
        pm2.list((err: any, list: any) => { // Explicit 'any'
             if (err) {
                 log('error', `[MANAGER STATUS ERR] Error listing PM2 processes:`, err);
                 res.status(500).json({ error: 'Failed to list workers.' });
                 return;
             }
             
             const workerProcesses = list.filter((proc: any) => proc.name?.startsWith('worker-'));
             const activeAgentIds = workerProcesses
                 .filter((proc: any) => proc.pm2_env?.status === 'online')
                 .map((proc: any) => proc.name?.replace('worker-', '')); // Extract agent ID from name

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