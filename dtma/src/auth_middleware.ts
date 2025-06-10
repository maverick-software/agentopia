import { Request, Response, NextFunction } from 'express';

// --- Configuration ---
// Environment variable fallbacks for development/testing
const DTMA_BEARER_TOKEN = process.env.DTMA_BEARER_TOKEN || '';
const BACKEND_TO_DTMA_API_KEY = process.env.BACKEND_TO_DTMA_API_KEY || '';

export async function authenticateDtmaRequest(req: Request, res: Response, next: NextFunction) {
  if (!DTMA_BEARER_TOKEN && !BACKEND_TO_DTMA_API_KEY) {
    console.log('No auth tokens configured, allowing request for development');
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const receivedToken = authHeader.substring(7);
  const isValidToken = receivedToken === DTMA_BEARER_TOKEN || receivedToken === BACKEND_TO_DTMA_API_KEY;
  
  if (!isValidToken) {
    console.warn('Received invalid DTMA token.');
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }

  // Token is valid, proceed to the next handler
  next();
}

// Legacy function for backward compatibility
export function authenticateBackendRequest(req: Request, res: Response, next: NextFunction) {
  return authenticateDtmaRequest(req, res, next);
} 