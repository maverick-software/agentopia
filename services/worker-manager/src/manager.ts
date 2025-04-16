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
    log('log', `[MANAGER RECV ENTRY] /start-worker endpoint entered.`);
    // --- ADDED: Log raw body before parsing ---
    log('log', '[MANAGER RECV RAW BODY]', req.body);
    // --- END ADDED ---
    let agentId, connectionDbId, botToken, inactivityTimeout;
    try {
        // Destructure body inside try/catch
        ({ agentId, connectionDbId, botToken, inactivityTimeout } = req.body);
        log('log', `[MANAGER RECV OK] Received /start-worker request for Agent ID: ${agentId}. Body parsed.`);
    } catch (parseError) {
        log('error', `[MANAGER RECV ERR] Failed to parse request body:`, parseError);
        // Ensure response is sent if body parsing fails
        if (!res.headersSent) {
            res.status(400).json({ error: 'Malformed request body' });
        }
        return; // Exit
    }

    // --- Input Validation ---
    log('log', `[MANAGER VALIDATE] Checking required fields: agentId=${!!agentId}, connectionDbId=${!!connectionDbId}, botToken=${!!botToken}`);
    if (!agentId || !connectionDbId || !botToken) {
        log('warn', `[MANAGER VALIDATE FAIL] Missing required fields.`);
        if (!res.headersSent) {
            res.status(400).json({ error: 'Missing required fields: agentId, connectionDbId, or botToken' });
        }
        return;
    }
    log('log', `[MANAGER VALIDATE OK] Required fields present.`);

    // --- Check for Required Environment Variables ---
    log('log', `[MANAGER ENV CHECK] Checking environment variables: SUPABASE_URL=${!!SUPABASE_URL}, SUPABASE_ANON_KEY=${!!SUPABASE_ANON_KEY}`);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        log('error', '[MANAGER ENV CHECK FAIL] SUPABASE_URL or SUPABASE_ANON_KEY environment variables are not set.');
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials.' });
        }
        return;
    }
    log('log', `[MANAGER ENV CHECK OK] Environment variables present.`);

    log('log', `[MANAGER PRE-PM2] Preparing worker name for agent ${agentId}...`);
    const workerName = getWorkerPm2Name(agentId);
    log('log', `[MANAGER PRE-PM2] Worker name is ${workerName}.`);

    // --- Check if worker already running via PM2 ---
    log('log', `[MANAGER START] Calling pm2.describe for ${workerName}...`);
    pm2.describe(workerName, (err: any, description: any) => {
        // Wrap callback logic in try/catch
        try {
            log('log', `[MANAGER START] Entered pm2.describe callback for ${workerName}.`);
            if (err && !err.message.toLowerCase().includes('not found')) {
                // Log error specifically from describe
                log('error', `[MANAGER START ERR - DESCRIBE] Error checking existing PM2 process ${workerName}:`, err);
                // Ensure response is sent even on error within callback
                if (!res.headersSent) {
                   res.status(500).json({ error: 'Failed to query worker status before starting.' });
                }
                return; // Exit callback
            }

            if (description && description.length > 0 && description[0].pm2_env?.status === 'online') {
                log('warn', `[MANAGER START] Worker ${workerName} is already running according to PM2.`);
                if (!res.headersSent) {
                    res.status(409).json({ message: `Worker ${agentId} is already active.` });
                }
                return; // Exit callback
            }

            // --- Worker Not Running - Proceed to Start ---
            log('log', `[MANAGER START] Worker ${workerName} is not running or not found by PM2. Proceeding to prepare start options...`);

            // --- PM2 Start Options --- 
            // Robustly handle inactivityTimeout: undefined, null, 0, or "never" mean indefinite (0)
            let inactivityTimeoutValue = '10'; // Default to 10 minutes if not specified
            const lowerCaseTimeout = String(inactivityTimeout).toLowerCase();
            if (inactivityTimeout === undefined || inactivityTimeout === null || inactivityTimeout === 0 || lowerCaseTimeout === 'never') {
                inactivityTimeoutValue = '0';
                log('log', `[MANAGER START] Inactivity timeout is indefinite (received: ${inactivityTimeout}), setting INACTIVITY_TIMEOUT_MINUTES=0`);
            } else {
                const parsedTimeout = parseInt(String(inactivityTimeout), 10);
                if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
                    inactivityTimeoutValue = String(parsedTimeout);
                    log('log', `[MANAGER START] Setting INACTIVITY_TIMEOUT_MINUTES=${inactivityTimeoutValue}`);
                } else {
                    log('warn', `[MANAGER START] Invalid inactivity timeout value received: ${inactivityTimeout}. Defaulting to ${inactivityTimeoutValue} minutes.`);
                }
            }
            const workerEnv: { [key: string]: string } = { 
                AGENT_ID: agentId,
                CONNECTION_DB_ID: connectionDbId,
                INACTIVITY_TIMEOUT_MINUTES: inactivityTimeoutValue,
                DISCORD_BOT_TOKEN: botToken,
                SUPABASE_URL: SUPABASE_URL!,
                SUPABASE_ANON_KEY: SUPABASE_ANON_KEY!,
            };

            // --- Corrected PM2 Start Options --- 
            const workerTsNodePath = path.resolve(__dirname, '../../discord-worker/node_modules/.bin/ts-node');
            const workerScriptPath = path.resolve(__dirname, '../../discord-worker/src/worker.ts'); // Use resolved path for script too

            const startOptions: pm2.StartOptions = {
                script: workerTsNodePath, // Execute ts-node directly
                args: [workerScriptPath], // Pass worker script as argument to ts-node
                name: workerName,
                // interpreter: undefined, // Ensure interpreter is not set
                exec_mode: 'fork', 
                env: workerEnv,
                autorestart: false, 
            };
            // --- End Corrected PM2 Start Options ---

            log('log', `[MANAGER START] Start options prepared. Calling pm2.start for ${workerName}...`);
            log('log', `[MANAGER SPAWN CMD] Starting worker ${workerName} via PM2... Options:`, JSON.stringify(startOptions, null, 2));

            pm2.start(startOptions, async (startErr: any, apps: any) => { // Renamed err to startErr
                // Wrap start callback logic in try/catch
                try {
                    log('log', `[MANAGER START] Entered pm2.start callback for ${workerName}.`);
                    if (startErr) {
                        log('error', `[MANAGER SPAWN ERR] Error starting worker ${workerName} via PM2:`, startErr);
                        if (!res.headersSent) {
                           res.status(500).json({ error: `Failed to initiate worker start for ${agentId}` });
                        }
                        return; // Exit start callback
                    }

                    log('log', `[MANAGER SPAWN OK] Worker ${workerName} initiated via PM2. App info: ${JSON.stringify(apps)}. Starting DB polling...`);
                    
                    // --- Polling Logic --- 
                    const MAX_POLL_ATTEMPTS = 8;
                    const POLL_INTERVAL_MS = 2500;
                    let attempts = 0;
                    const pollForActiveStatus = async (): Promise<boolean> => {
                        attempts++;
                        log('log', `[MANAGER START POLL ${attempts}/${MAX_POLL_ATTEMPTS}] Checking DB status for connection ${connectionDbId}...`);
                        if (!supabaseAdmin) { log('error', 'Supabase admin client not available.'); return false; }
                        try {
                            const { data, error: dbError } = await supabaseAdmin.from('agent_discord_connections').select('worker_status').eq('id', connectionDbId).single();
                            if (dbError) { log('error', `DB error polling status (attempt ${attempts}):`, dbError.message); }
                            else if (data?.worker_status === 'active') { log('log', `Confirmed 'active' status.`); return true; }
                            else { log('log', `Status is still '${data?.worker_status || 'unknown'}'.`); }
                            if (attempts >= MAX_POLL_ATTEMPTS) { log('warn', `Polling timeout.`); return false; }
                            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
                            return pollForActiveStatus(); // Recursive call
                        } catch (pollErr) { log('error', `Polling exception:`, pollErr); return false; }
                    };
                    const confirmedActive = await pollForActiveStatus();
                    // --- End Polling Logic ---

                    if (confirmedActive) {
                        log('log', `[MANAGER START OK] Worker for agent ${agentId} confirmed active in DB.`);
                        if (!res.headersSent) {
                            res.status(200).json({ message: `Worker for ${agentId} started and confirmed active.` });
                        }
                    } else {
                        log('error', `[MANAGER START FAIL] Worker for agent ${agentId} failed to confirm active status after polling.`);
                        // Attempt to stop the potentially lingering/failed worker process
                        pm2.stop(workerName, (stopErr: any) => {
                            if (stopErr) log('error', `[MANAGER START FAIL CLEANUP ERR] Error stopping failed worker ${workerName}:`, stopErr);
                            else log('log', `[MANAGER START FAIL CLEANUP OK] Sent stop command to potentially failed worker ${workerName}.`);
                        });
                        if (!res.headersSent) {
                            res.status(500).json({ error: `Worker for ${agentId} started but failed to activate.` });
                        }
                    }
                } catch(startCallbackError) {
                     log('error', `[MANAGER START ERR - START CALLBACK] Uncaught exception inside pm2.start callback for ${workerName}:`, startCallbackError);
                     if (!res.headersSent) {
                         res.status(500).json({ error: 'Internal server error during worker startup sequence.' });
                     }
                }
            });
        } catch (describeCallbackError) {
            log('error', `[MANAGER START ERR - DESCRIBE CALLBACK] Uncaught exception inside pm2.describe callback for ${workerName}:`, describeCallbackError);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error during worker status check.' });
            }
        }
    });
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