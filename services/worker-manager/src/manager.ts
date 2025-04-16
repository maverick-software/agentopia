import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process'; // To launch worker processes

// Load environment variables from .env file in the service directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("--- Worker Manager Service Starting ---");

// --- Configuration --- 
const portString = process.env.PORT || '8000'; // Default to string '8000'
const PORT = parseInt(portString, 10); // Explicitly parse to number
const MANAGER_SECRET_KEY = process.env.MANAGER_SECRET_KEY;
const WORKER_SCRIPT_PATH = process.env.WORKER_SCRIPT_PATH || '../discord-worker/src/worker.ts';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Worker uses anon key

if (!MANAGER_SECRET_KEY) {
    console.error("FATAL: MANAGER_SECRET_KEY environment variable not set.");
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
app.post('/start-worker', authenticate, (req: Request, res: Response) => {
    const { agentId, botToken, timeoutMinutes, guildId, channelId, connectionId } = req.body;

    console.log(`Received request to start worker for Agent ID: ${agentId}`);

    // --- Input Validation --- 
    if (!agentId || !botToken || !timeoutMinutes || !connectionId) {
        res.status(400).json({ error: 'Missing required fields: agentId, botToken, timeoutMinutes, connectionId' });
        return;
    }

    // --- Check if worker already running (simple check) --- 
    if (activeWorkers.has(agentId)) {
        console.warn(`Worker for Agent ID ${agentId} is already running.`);
        res.status(200).json({ message: `Worker for ${agentId} is already active.` });
        return;
    }

    // --- Spawn Worker Process --- 
    console.log(`Spawning worker process using script: ${WORKER_SCRIPT_PATH}`);
    
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
        console.log(`Setting TIMEOUT_MINUTES=${workerEnv.TIMEOUT_MINUTES} for worker ${agentId}`);
    } else {
        console.log(`Timeout is 0 or invalid (${timeoutMinutes}), TIMEOUT_MINUTES will not be set for worker ${agentId}.`);
        // Worker should handle the absence of this variable as "Never" timeout
    }

    // Use ts-node to run the TypeScript worker directly (for development)
    // In production, you'd run the compiled JS (e.g., node dist/worker.js)
    const workerProcess = spawn('npx', ['ts-node', WORKER_SCRIPT_PATH], { 
        env: workerEnv, 
        stdio: 'inherit' // Pipe worker output to manager console
    });

    workerProcess.on('spawn', () => {
        console.log(`Worker process spawned for Agent ID: ${agentId} (PID: ${workerProcess.pid})`);
        activeWorkers.set(agentId, { agentId, process: workerProcess, connectionId });
        // Optionally update DB status here to confirm manager started it?
    });

    workerProcess.on('error', (error) => {
        console.error(`Error spawning worker for Agent ID ${agentId}:`, error);
        // Optionally try to update DB status to error?
    });

    workerProcess.on('close', (code) => {
        console.log(`Worker process for Agent ID ${agentId} exited with code ${code}`);
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
    console.log(`Worker Manager Service listening on port ${PORT}`);
});

// --- Graceful Shutdown Handling (for Manager) --- 
const cleanup = () => {
    console.log('Shutting down manager service...');
    activeWorkers.forEach((workerInfo, agentId) => {
        console.log(`Terminating worker for Agent ID: ${agentId}`);
        workerInfo.process.kill('SIGTERM'); // Send TERM signal to workers
    });
    // Add any other cleanup logic here
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup); 