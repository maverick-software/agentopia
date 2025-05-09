import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';

const DTMA_CONFIG_PATH = '/etc/dtma.conf'; // Path where user_data writes the token

let expectedToken: string | null = null;

// Function to read the token from the config file
async function loadExpectedToken(): Promise<string | null> {
  if (expectedToken) return expectedToken;

  try {
    const configContent = await fs.readFile(DTMA_CONFIG_PATH, 'utf-8');
    const match = configContent.match(/^DTMA_AUTH_TOKEN=(\S+)$/m);
    if (match && match[1]) {
      expectedToken = match[1];
      console.log('DTMA authentication token loaded successfully.');
      return expectedToken;
    }
    console.error(`Could not parse DTMA_AUTH_TOKEN from ${DTMA_CONFIG_PATH}.`);
    return null;
  } catch (error: any) {
    // Handle file not found specifically during startup?
    if (error.code === 'ENOENT') {
        console.error(`${DTMA_CONFIG_PATH} not found. DTMA cannot authenticate requests.`);
    } else {
        console.error(`Error reading DTMA config file ${DTMA_CONFIG_PATH}:`, error);
    }
    return null;
  }
}

// Load the token asynchronously when the module is loaded
// In a real app, might want more robust error handling or retries
loadExpectedToken();

export async function authenticateDtmaRequest(req: Request, res: Response, next: NextFunction) {
  const currentExpectedToken = await loadExpectedToken(); // Ensure token is loaded

  if (!currentExpectedToken) {
    console.error('DTMA auth token not loaded. Denying request.');
    return res.status(500).json({ error: 'DTMA configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const receivedToken = authHeader.substring(7);

  if (receivedToken !== currentExpectedToken) {
    console.warn('Received invalid DTMA token.');
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }

  // Token is valid, proceed to the next handler
  next();
} 