import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

// *** REFACTORED: Use pm2.start API - Attempt 3 (Run ts-node as script) ***
app.post('/start-worker', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    log('log', `[MANAGER START REQ] Received /start-worker request`);
    try {
        const { agentId, connectionDbId, botToken, agentName, systemPrompt, agentInstructions } = req.body;

        // --- Input Validation (as before) --- 
        if (!agentId || !connectionDbId || !botToken || !agentName) {
            log('warn', '[MANAGER START REQ] Missing required core fields');
            res.status(400).json({ error: 'Missing required core fields (agentId, connectionDbId, botToken, agentName).' }); 
            return; 
        }
        log('log', `[MANAGER START REQ] Validated required fields for agent ${agentId}, connection ${connectionDbId}`);

        // --- Env Var Check (as before) --- 
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
            log('error', '[MANAGER START REQ] Server configuration error: Missing environment variables.');
            res.status(500).json({ error: 'Server configuration error.' });
            return;
        }
        if (!supabaseAdmin) {
             log('error', '[MANAGER START REQ] Server configuration error: Supabase admin client not initialized.');
             res.status(500).json({ error: 'Server configuration error.' });
             return;
        }
        log('log', '[MANAGER START REQ] Environment variables and Supabase client OK.');

        const workerName = getWorkerPm2Name(agentId);
        // Define paths relative to manager's location
        const tsNodePath = path.resolve(__dirname, '../../discord-worker/node_modules/.bin/ts-node');
        const workerScriptPath = path.resolve(__dirname, '../../discord-worker/src/worker.ts');
        const workerCwd = path.dirname(workerScriptPath); // Get the directory of the worker script
        log('log', `[MANAGER PRE-PM2] ts-node path: ${tsNodePath}`);
        log('log', `[MANAGER PRE-PM2] Worker script path: ${workerScriptPath}`);
        log('log', `[MANAGER PRE-PM2] Worker CWD: ${workerCwd}`);

        // Wrap the core PM2 interaction and polling in a Promise
        await new Promise<void>((resolve, reject) => {
            log('log', `[MANAGER START] Checking if ${workerName} already exists via pm2.describe...`);
            pm2.describe(workerName, (descErr: any, description: any) => {
                try { 
                    log('log', `[MANAGER START] Entered pm2.describe callback for ${workerName}.`);
                    if (descErr && !descErr.message.toLowerCase().includes('not found')) {
                        log('error', `[MANAGER START ERR - DESCRIBE] pm2.describe failed for ${workerName}:`, descErr);
                        return reject(new Error(`PM2 describe error: ${descErr.message}`));
                    }
                    if (description && description.length > 0 && description[0].pm2_env.status === 'online') {
                        log('warn', `[MANAGER START] Worker ${workerName} is already running.`);
                        return resolve(); // Resolve if already running
                    }
                    log('log', `[MANAGER START] Worker ${workerName} not running or stopped. Proceeding to start via pm2.start API (ts-node as script)...`);

                    // --- Construct Environment Variables (as before) --- 
                    const inactivityTimeoutValue = req.body.inactivityTimeout === undefined || req.body.inactivityTimeout === null
                        ? '10' 
                        : String(req.body.inactivityTimeout);
                    log('log', `[MANAGER START] Inactivity timeout set to: ${inactivityTimeoutValue} minutes`);
                    
                    const workerEnv = {
                        AGENT_ID: agentId,
                        AGENT_NAME: agentName,
                        CONNECTION_DB_ID: connectionDbId,
                        DISCORD_BOT_TOKEN: botToken,                 
                        SYSTEM_PROMPT: systemPrompt ?? '',             
                        AGENT_INSTRUCTIONS: agentInstructions ?? '',   
                        INACTIVITY_TIMEOUT_MINUTES: inactivityTimeoutValue,
                        SUPABASE_URL: SUPABASE_URL,
                        SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY,
                        OPENAI_API_KEY: OPENAI_API_KEY,
                        NODE_ENV: process.env.NODE_ENV || 'production'
                    };
                    log('log', `[MANAGER START] Worker env prepared.`);

                    // --- PM2 Start Options: Run ts-node binary, pass worker.ts as arg --- 
                    const startOptions = {
                        // Run the ts-node binary itself as the script
                        script: tsNodePath, 
                        // Pass the actual worker.ts path as an argument to ts-node
                        args: [workerScriptPath], 
                        name: workerName,
                        env: workerEnv, // Pass constructed environment
                        autorestart: false,
                        cwd: workerCwd, // Set CWD to the worker's src directory
                        // No interpreter or node_args needed here, as we run ts-node directly
                    };

                    log('log', `[MANAGER PM2 START] Attempting pm2.start with options:`, JSON.stringify(startOptions, null, 2));

                    // --- Execute PM2 Start using Programmatic API --- 
                    pm2.start(startOptions, async (startErr: any, apps: any) => { // Callback for pm2.start
                        try { 
                            if (startErr) {
                                log('error', `[MANAGER PM2 START ERR] pm2.start failed for ${workerName}:`, startErr);
                                return reject(new Error(`Failed to start worker via PM2 API: ${startErr.message}`));
                            }
                            log('log', `[MANAGER PM2 START OK] pm2.start command successful for ${workerName}. Apps:`, apps?.[0]?.pm2_env?.name);

                            log('log', `[MANAGER START] PM2 start initiated. Starting DB polling for ${connectionDbId}...`);

                            // --- Polling Logic (Unchanged) --- 
                            const MAX_POLL_ATTEMPTS = 8;
                            const POLL_INTERVAL_MS = 2500;
                            let attempts = 0;

                            const pollForActiveStatusImpl = async (): Promise<boolean> => {
                                attempts++;
                                log('log', `[MANAGER START POLL ${attempts}/${MAX_POLL_ATTEMPTS}] Checking DB status for connection ${connectionDbId}...`);
                                if (!supabaseAdmin) { log('error', 'Supabase admin client not available.'); return false; }
                                try {
                                    const { data, error } = await supabaseAdmin
                                        .from('agent_discord_connections') 
                                        .select('worker_status')           
                                        .eq('id', connectionDbId)
                                        .single();
                                    if (error) { log('error', `Polling error: ${error.message}`); return false; }
                                    if (data?.worker_status === 'active') { log('log', 'Polling success: status is active.'); return true; }
                                    log('log', `Polling status: ${data?.worker_status}`); 
                                    if (attempts >= MAX_POLL_ATTEMPTS) { log('warn', `Polling timeout.`); return false; }
                                    await new Promise(resolvePoll => setTimeout(resolvePoll, POLL_INTERVAL_MS)); 
                                    return pollForActiveStatusImpl();
                                } catch (pollErr) { log('error', `Polling exception:`, pollErr); return false; }
                            };

                            const confirmedActive = await pollForActiveStatusImpl();
                            // --- End Polling --- 

                            if (confirmedActive) {
                                log('log', `[MANAGER START OK] Worker ${agentId} confirmed active.`);
                                resolve(); // Resolve the outer promise on success
                            } else {
                                log('error', `[MANAGER START FAIL] Worker ${agentId} failed polling. Attempting cleanup...`);
                                pm2.stop(workerName, (stopErr: any) => {
                                    if (stopErr) log('error', `[MANAGER START FAIL CLEANUP ERR] Failed to stop worker ${workerName} after polling failure:`, stopErr);
                                    else log('warn', `[MANAGER START FAIL CLEANUP OK] Stopped worker ${workerName} after polling failure.`);
                                });
                                reject(new Error(`Worker started but failed to activate.`)); 
                            }
                        } catch (startCallbackError) {
                            log('error', `[MANAGER START ERR - PM2 START CALLBACK] Uncaught exception:`, startCallbackError);
                            reject(startCallbackError instanceof Error ? startCallbackError : new Error('Error in pm2.start callback'));
                        }
                    }); // End of pm2.start callback
                } catch (describeCallbackError) {
                    log('error', `[MANAGER START ERR - DESCRIBE CALLBACK] Uncaught exception:`, describeCallbackError);
                    reject(describeCallbackError instanceof Error ? describeCallbackError : new Error('Error in describe callback'));
                }
            }); // End of pm2.describe callback
        }); // End of new Promise wrapper

        // --- Success Case --- 
        log('log', `[MANAGER START OK - HANDLER] Worker process management completed successfully for ${agentId}.`);
        res.status(200).json({ message: `Worker initiated or already running.` });

    } catch (error) {
        // --- Error Handling --- 
        log('error', '[MANAGER START ERR - HANDLER] Caught error in /start-worker:', error);
        next(error); 
    }
});

// *** REFACTORED: Endpoint to stop a worker via PM2 WITH DB STATUS CONFIRMATION ***
app.post('/stop-worker', authenticate, async (req: Request, res: Response) => { // Make handler async
    const { agentId } = req.body;
    log('log', `[MANAGER RECV] Received /stop-worker request for Agent ID: ${agentId}`);
    const workerName = getWorkerPm2Name(agentId);

    if (!agentId) {
        res.status(400).json({ error: 'Missing required field: agentId' });
        return;
    }
    if (!supabaseAdmin) {
        log('error', '[MANAGER STOP ERR] Supabase admin client not available for DB checks.');
        res.status(500).json({ error: 'Server configuration error: Cannot verify stop operation.' });
        return;
    }

    // --- Helper function for polling DB --- 
    const MAX_POLL_ATTEMPTS = 6; // 6 attempts * 2 seconds = 12 seconds total timeout
    const POLL_INTERVAL_MS = 2000; // 2 seconds

    const pollForInactiveStatus = async (connId: string | null): Promise<boolean> => {
        if (!connId) {
            log('warn', '[MANAGER STOP POLL] Cannot poll for inactive status, connection ID is unknown.');
            return false; // Cannot confirm if we don't know the ID
        }
        let attempts = 0;
        while (attempts < MAX_POLL_ATTEMPTS) {
            attempts++;
            log('log', `[MANAGER STOP POLL ${attempts}/${MAX_POLL_ATTEMPTS}] Checking DB status for connection ${connId}...`);
            try {
                const { data, error: dbError } = await supabaseAdmin
                    .from('agent_discord_connections')
                    .select('worker_status')
                    .eq('id', connId)
                    .single();

                if (dbError && dbError.code !== 'PGRST116') { // Ignore "Row not found" error if deleted
                    log('error', `[MANAGER STOP POLL ERR] DB error fetching status (attempt ${attempts}):`, dbError.message);
                    // Maybe retry on transient errors? For now, continue polling.
                } else if (!data || data?.worker_status === 'inactive') {
                    // Consider row not found as inactive
                    log('log', `[MANAGER STOP POLL OK] Confirmed 'inactive' status (or row deleted) in DB for ${connId}.`);
                    return true; // Success!
                } else {
                    log('log', `[MANAGER STOP POLL] Status is still '${data?.worker_status}'.`);
                }
            } catch (pollErr) {
                log('error', `[MANAGER STOP POLL EXCEPTION] Exception during polling for ${connId}:`, pollErr);
                // Stop polling on unhandled exception
                return false;
            }
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
        log('warn', `[MANAGER STOP POLL TIMEOUT] Max attempts reached for ${connId}. Worker failed to become inactive in DB.`);
        return false; // Timeout
    };
    // --- End helper function ---

    try {
        // --- Fetch Connection ID first --- 
        log('log', `[MANAGER STOP] Fetching connection ID for agent ${agentId}...`);
        const { data: connData, error: fetchErr } = await supabaseAdmin
            .from('agent_discord_connections')
            .select('id')
            .eq('agent_id', agentId)
            .maybeSingle(); // Use maybeSingle as it might not exist

        if (fetchErr) {
            log('error', `[MANAGER STOP ERR] DB error fetching connection ID for agent ${agentId}:`, fetchErr.message);
            // Proceed with PM2 stop attempt anyway, but polling won't work
        }
        const connectionDbId = connData?.id || null;
        log('log', `[MANAGER STOP] Found connection ID: ${connectionDbId || 'None'}`);
        // --- End Fetch --- 

        log('log', `[MANAGER STOP] Attempting to stop worker ${workerName} via PM2...`);
        // Use a promise to handle the PM2 callback asynchronously
        const pm2StopPromise = new Promise<boolean>((resolve, reject) => {
            pm2.stop(workerName, (err: any, proc: any) => {
                if (err) {
                    if (err.message && err.message.toLowerCase().includes('not found')) {
                        log('warn', `[MANAGER STOP] Worker ${workerName} not found by PM2 (already stopped?). Proceeding to DB check.`);
                        resolve(true); // Resolve true even if not found, we still need to poll DB
                    } else {
                        log('error', `[MANAGER STOP ERR] Error stopping worker ${workerName} via PM2:`, err);
                        reject(new Error(`PM2 failed to stop worker ${agentId}.`)); // Reject the promise on PM2 error
                    }
                } else {
                    log('log', `[MANAGER STOP OK] Successfully sent stop command to worker ${workerName} via PM2.`);
                    resolve(true); // Resolve true on success
                }
            });
        });

        // Await the PM2 stop command attempt
        await pm2StopPromise;

        // Now poll for DB status confirmation
        const confirmedInactive = await pollForInactiveStatus(connectionDbId);

        if (confirmedInactive) {
            log('log', `[MANAGER STOP OK] Worker for agent ${agentId} confirmed inactive in DB.`);
            res.status(200).json({ message: `Worker for ${agentId} stopped and confirmed inactive.` });
        } else {
            log('error', `[MANAGER STOP FAIL] Worker for agent ${agentId} failed to confirm inactive status after polling.`);
            res.status(500).json({ error: `Worker for ${agentId} stop initiated, but failed to confirm inactive status in DB.` });
        }

    } catch (error: any) {
        // Catch errors from pm2StopPromise rejection or other issues
        log('error', `[MANAGER STOP FAIL] Overall error during stop process for agent ${agentId}:`, error);
        res.status(500).json({ error: error.message || `Failed to stop worker ${agentId}.` });
    }
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