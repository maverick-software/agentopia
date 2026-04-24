import express, { Request, Response, NextFunction } from 'express';
import { ensureToolEnvironmentReady, deprovisionAgentDroplet } from '../agent_environment_service/manager'; // Adjusted path

const router = express.Router();

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Middleware to check the shared secret
const checkInternalApiSecret = (req: Request, res: Response, next: NextFunction) => {
    if (!INTERNAL_API_SECRET) {
        console.error('INTERNAL_API_SECRET is not configured on the Node.js backend.');
        return res.status(500).json({ error: 'Internal server configuration error.' });
    }
    const secret = req.headers['x-internal-api-secret'];
    if (secret === INTERNAL_API_SECRET) {
        next();
    } else {
        console.warn('Invalid or missing X-Internal-Api-Secret header.');
        res.status(403).json({ error: 'Forbidden: Invalid internal API secret.' });
    }
};

router.post('/agents/:agentId/ensure-tool-environment', checkInternalApiSecret, async (req: Request, res: Response) => {
    const { agentId } = req.params;
    if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required.' });
    }
    try {
        console.log(`[Internal API] Received request to ensure tool environment for agent: ${agentId}`);
        
        const dropletRecord = await ensureToolEnvironmentReady(agentId);
        
        if (dropletRecord) {
            console.log(`[Internal API] Tool environment ensured for agent ${agentId}. Status: ${dropletRecord.status}, IP: ${dropletRecord.ip_address}`);
            res.status(200).json({ 
                success: true, 
                message: `Tool environment for agent ${agentId} is now ${dropletRecord.status}.`,
                data: {
                    agent_id: dropletRecord.agent_id,
                    droplet_id: dropletRecord.do_droplet_id,
                    status: dropletRecord.status,
                    ip_address: dropletRecord.ip_address
                }
            });
        } else {
             console.warn(`[Internal API] ensureToolEnvironmentReady returned null for agent ${agentId}.`);
            res.status(200).json({ success: true, message: 'Tool environment status checked, no action taken or already active.', data: null });
        }
    } catch (error: any) {
        console.error(`[Internal API] Error ensuring tool environment for agent ${agentId}:`, error);
        res.status(500).json({ success: false, error: error.message || 'Failed to ensure tool environment.' });
    }
});

router.delete('/agents/:agentId/tool-environment', checkInternalApiSecret, async (req: Request, res: Response) => {
    const { agentId } = req.params;
    if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required.' });
    }
    try {
        console.log(`[Internal API] Received request to deprovision tool environment for agent: ${agentId}`);
        const result = await deprovisionAgentDroplet(agentId);
        
        if (result.success) {
            console.log(`[Internal API] Tool environment deprovisioned for agent ${agentId}.`);
            res.status(200).json({ success: true, message: result.message || `Tool environment for agent ${agentId} deprovisioned.` });
        } else {
             console.error(`[Internal API] Failed to deprovision tool environment for agent ${agentId}: ${result.message}`);
            res.status(500).json({ success: false, error: result.message || 'Failed to deprovision tool environment.' });
        }
    } catch (error: any) {
        console.error(`[Internal API] Error deprovisioning tool environment for agent ${agentId}:`, error);
        res.status(500).json({ success: false, error: error.message || 'Failed to deprovision tool environment.' });
    }
});

export default router; 