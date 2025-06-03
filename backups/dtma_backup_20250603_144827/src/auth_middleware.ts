import { Request, Response, NextFunction } from 'express';

// The expected API key for authenticating requests from the Agentopia backend to this DTMA.
// This should be set as an environment variable when the DTMA container is run.
const BACKEND_API_KEY = process.env.BACKEND_TO_DTMA_API_KEY;

if (!BACKEND_API_KEY) {
  console.error('CRITICAL: BACKEND_TO_DTMA_API_KEY environment variable is not set. DTMA cannot authenticate backend requests.');
  // Optional: exit the process if this is considered a fatal startup error
  // process.exit(1);
}

export function authenticateBackendRequest(req: Request, res: Response, next: NextFunction) {
  if (!BACKEND_API_KEY) {
    // This check is a safeguard; the initial check should prevent the app from running misconfigured.
    console.error('DTMA is misconfigured: BACKEND_TO_DTMA_API_KEY is missing. Denying request.');
    return res.status(500).json({ error: 'DTMA internal configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format. Expected Bearer token.' });
  }

  const receivedToken = authHeader.substring(7); // Extract token after "Bearer "

  if (receivedToken !== BACKEND_API_KEY) {
    console.warn('Forbidden: Received invalid BACKEND_TO_DTMA_API_KEY.');
    // Avoid logging the received token itself for security, unless in verbose debug mode.
    return res.status(403).json({ error: 'Forbidden: Invalid authentication token' });
  }

  // Token is valid, proceed to the next handler
  next();
} 