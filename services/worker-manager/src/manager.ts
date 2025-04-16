import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process'; // To launch worker processes
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'; // Import Supabase client

// Add helper for timestamp
const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => console[level](new Date().toISOString(), '[WM]', ...args);

// Load environment variables from .env file in the service directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

// --- State (Simple in-memory tracking for demo) --- 
// !! IMPORTANT: In production, use a proper process manager or database !!
interface WorkerInfo {
    agentId: string;
    process: ReturnType<typeof spawn>;
    connectionId: string;
}
const activeWorkers = new Map<string, WorkerInfo>(); // Map agentId to WorkerInfo

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

// --- Routes --- 

app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Worker Manager Service is running.');
});

// Endpoint to start a new worker
app.post('/start-worker', authenticate, async (req: Request, res: Response) => {
    const { agentId, botToken, timeoutMinutes, guildId, channelId, connectionId } = req.body;
    log('log', `[MANAGER RECV] Received /start-worker request for Agent ID: ${agentId}, Connection ID: ${connectionId}`);

    // --- Input Validation --- 
    if (!agentId || !botToken || !timeoutMinutes || !connectionId) {
        res.status(400).json({ error: 'Missing required fields: agentId, botToken, timeoutMinutes, connectionId' });
        return;
    }

    // --- Check if worker already running (simple check) --- 
    if (activeWorkers.has(agentId)) {
        log('warn', `Worker for Agent ID ${agentId} is already running.`);
        res.status(200).json({ message: `Worker for ${agentId} is already active.` });
        return;
    }

    // --- Spawn Worker Process --- 
    
    // *** ADDED: Pre-spawn logging and check ***
    log('log', `[MANAGER PRE-SPAWN CHECK] Preparing to spawn worker for Agent ID: ${agentId}, Connection ID: ${connectionId}`);
    if (supabaseAdmin && agentId && connectionId) {
        try {
            // Check Agent
            const { data: agentCheck, error: agentCheckError } = await supabaseAdmin
                .from('agents')
                .select('id', { count: 'exact', head: true })
                .eq('id', agentId);
            // Check Connection
            const { data: connCheck, error: connCheckError } = await supabaseAdmin
                .from('agent_discord_connections')
                .select('id', { count: 'exact', head: true })
                .eq('id', connectionId);

            // Log Agent Check Result
            if (agentCheckError) {
                log('error', `[MANAGER PRE-SPAWN CHECK] Error checking agent ${agentId} existence:`, agentCheckError.message);
            } else if (agentCheck && agentCheck.length > 0) {
                 log('log', `[MANAGER PRE-SPAWN CHECK] Agent ${agentId} CONFIRMED TO EXIST.`);
            } else {
                log('error', `[MANAGER PRE-SPAWN CHECK] CRITICAL: Agent ${agentId} NOT FOUND right before spawn attempt!`);
            }
            // Log Connection Check Result
            if (connCheckError) {
                log('error', `[MANAGER PRE-SPAWN CHECK] Error checking connection ${connectionId} existence:`, connCheckError.message);
            } else if (connCheck && connCheck.length > 0) {
                 log('log', `[MANAGER PRE-SPAWN CHECK] Connection ${connectionId} CONFIRMED TO EXIST.`);
            } else {
                log('error', `[MANAGER PRE-SPAWN CHECK] CRITICAL: Connection ${connectionId} NOT FOUND right before spawn attempt!`);
                 // If connection is gone, maybe don't spawn?
                 // For now, log and proceed.
            }
        } catch(checkErr: any) {
             log('error', `[MANAGER PRE-SPAWN CHECK] Exception during DB checks for Agent ${agentId} / Conn ${connectionId}:`, checkErr.message);
        }
    } else {
         log('warn', "[MANAGER PRE-SPAWN CHECK] Skipping DB checks (Supabase Admin client, agentId, or connectionId missing).");
    }
    // *** END MODIFIED CHECK ***

    log('log', `[MANAGER SPAWN CMD] Spawning worker process using script: ${WORKER_SCRIPT_PATH}`);
    
    const workerEnv: { [key: string]: string | undefined } = { 
        ...process.env, // Inherit manager env vars
        DISCORD_BOT_TOKEN: botToken,
        AGENT_ID: agentId,
        CONNECTION_ID: connectionId,
        // Pass Supabase details needed by worker
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    };

    // Only set TIMEOUT_MINUTES if it's a positive number
    const parsedTimeout = parseInt(String(timeoutMinutes), 10);
    if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
        workerEnv.TIMEOUT_MINUTES = String(parsedTimeout);
        log('log', `Setting TIMEOUT_MINUTES=${workerEnv.TIMEOUT_MINUTES} for worker ${agentId}`);
    } else {
        log('log', `Timeout is 0 or invalid (${timeoutMinutes}), TIMEOUT_MINUTES will not be set for worker ${agentId}.`);
        // Worker should handle the absence of this variable as "Never" timeout
    }

    // Use ts-node to run the TypeScript worker directly (for development)
    // In production, you'd run the compiled JS (e.g., node dist/worker.js)
    const workerProcess = spawn('npx', ['ts-node', WORKER_SCRIPT_PATH], { 
        env: workerEnv, 
        stdio: 'inherit' // Pipe worker output to manager console
    });

    // *** ADDED: Post-spawn logging ***
    log('log', `[MANAGER POST-SPAWN CMD] Spawn command executed for Agent ID: ${agentId}. Waiting for 'spawn' event...`);
    // *** END ADDED ***

    workerProcess.on('spawn', () => {
        log('log', `[MANAGER SPAWN EVENT] Worker process spawned event received for Agent ID: ${agentId} (PID: ${workerProcess.pid})`);
        activeWorkers.set(agentId, { agentId, process: workerProcess, connectionId });
        // Optionally update DB status here to confirm manager started it?
    });

    workerProcess.on('error', (error) => {
        log('error', `Error spawning worker for Agent ID ${agentId}:`, error);
        // Optionally try to update DB status to error?
    });

    workerProcess.on('close', (code) => {
        log('log', `Worker process for Agent ID ${agentId} exited with code ${code}`);
        activeWorkers.delete(agentId);
        // Optionally update DB status to inactive/error based on code?
        // Requires passing connectionId here or looking it up.
    });

    // Respond immediately, don't wait for worker to fully connect to Discord
    res.status(202).json({ message: `Worker process for ${agentId} is being started.` });
});

// TODO: Add endpoint to stop a worker (/stop-worker?agentId=...)
// TODO: Add endpoint to get status of workers (/status)

// --- Start Server --- 
app.listen(PORT, '0.0.0.0', () => {
    log('log', `Worker Manager Service listening on port ${PORT}`);
});

// --- Graceful Shutdown Handling (for Manager) --- 
const cleanup = () => {
    log('log', 'Shutting down manager service...');
    activeWorkers.forEach((workerInfo, agentId) => {
        log('log', `Terminating worker for Agent ID: ${agentId}`);
        workerInfo.process.kill('SIGTERM'); // Send TERM signal to workers
    });
    // Add any other cleanup logic here
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup); 