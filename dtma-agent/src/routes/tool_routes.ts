import express, { Request, Response } from 'express';
import {
  pullImage,
  createAndStartContainer,
  stopContainer,
  removeContainer,
  listContainers,
  inspectContainer,
} from '../docker_manager.js'; 
import { fetchToolSecrets } from '../agentopia_api_client.js'; 
import Dockerode from 'dockerode';

const router = express.Router();

/**
 * POST /tools/install
 * Body: { 
 *   image_name: string // e.g., 'ubuntu:latest' or 'org/repo:tag'
 *   // Potentially other options like credentials for private repos in future
 * }
 * Action: Pulls the specified Docker image.
 */
router.post('/install', async (req: Request, res: Response) => {
  const { image_name } = req.body;

  if (!image_name || typeof image_name !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image_name in request body' });
  }

  try {
    console.log(`Received install request for image: ${image_name}`);
    // Perform the Docker pull operation
    await pullImage(image_name);
    console.log(`Successfully pulled image: ${image_name}`);
    res.status(200).json({ success: true, message: `Image '${image_name}' pulled successfully.` });
  } catch (error: any) {
    console.error(`Failed to install/pull image ${image_name}:`, error.message);
    // Provide a more specific error message if possible
    res.status(500).json({ 
        success: false, 
        message: `Failed to pull image '${image_name}'.`, 
        error: error.message || 'Unknown error' 
    });
  }
});

/**
 * POST /tools/start
 * Body: { 
 *   agent_droplet_tool_id: string, // DB ID of the tool instance 
 *   image_name: string,           // e.g., org/repo:tag
 *   container_name: string,       // Unique name for the container
 *   create_options?: Dockerode.ContainerCreateOptions // Base options from Agentopia backend (ports, volumes etc.)
 * }
 * Action: Fetches secrets, injects them, creates and starts the container.
 */
router.post('/start', async (req: Request, res: Response) => {
  const { agent_droplet_tool_id, image_name, container_name, create_options = {} } = req.body;

  if (!agent_droplet_tool_id || !image_name || !container_name) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: agent_droplet_tool_id, image_name, container_name' 
    });
  }

  try {
    // 1. Fetch secrets from Agentopia backend
    console.log(`Fetching secrets for tool instance ID: ${agent_droplet_tool_id}`);
    const secrets = await fetchToolSecrets(agent_droplet_tool_id);

    if (!secrets) {
      // fetchToolSecrets logs the error, return a generic failure
      return res.status(500).json({ success: false, message: 'Failed to fetch secrets for the tool.' });
    }
    console.log('Successfully fetched secrets.');

    // 2. Prepare Docker environment variables from secrets
    const envVars: string[] = create_options.Env || [];
    for (const [key, value] of Object.entries(secrets)) {
      if (value !== null) { // Only add non-null secrets as env vars
        envVars.push(`${key}=${value}`);
      } else {
        console.warn(`Secret key "${key}" was null, not adding to environment.`);
      }
    }

    // 3. Merge fetched secrets env vars with any provided create_options
    const finalCreateOptions: Dockerode.ContainerCreateOptions = {
      ...create_options,
      Env: envVars,
    };

    // 4. Call docker_manager.createAndStartContainer
    console.log(`Attempting to start container "${container_name}" with image "${image_name}"`);
    const container = await createAndStartContainer(image_name, container_name, finalCreateOptions);

    // 5. Respond with success and potentially useful info
    // Inspect the container to get runtime details like port mappings
    const inspectInfo = await inspectContainer(container.id);
    const portMappings = inspectInfo.NetworkSettings.Ports;

    res.status(200).json({
      success: true,
      message: `Container '${container_name}' started successfully.`,
      container_id: container.id,
      ports: portMappings, // Include discovered port mappings
    });

  } catch (error: any) {
    console.error(`Failed to start tool ${agent_droplet_tool_id} (container: ${container_name}):`, error.message);
    res.status(500).json({ 
        success: false, 
        message: `Failed to start container '${container_name}'.`, 
        error: error.message || 'Unknown error' 
    });
  }
});

/**
 * POST /tools/stop
 * Body: { container_id_or_name: string }
 * Action: Stops the specified container.
 */
router.post('/stop', async (req: Request, res: Response) => {
  const { container_id_or_name } = req.body;

  if (!container_id_or_name) {
    return res.status(400).json({ success: false, error: 'Missing container_id_or_name' });
  }

  try {
    console.log(`Received stop request for container: ${container_id_or_name}`);
    await stopContainer(container_id_or_name);
    console.log(`Successfully stopped container: ${container_id_or_name}`);
    res.status(200).json({ success: true, message: `Container '${container_id_or_name}' stopped.` });
  } catch (error: any) {
    console.error(`Failed to stop container ${container_id_or_name}:`, error.message);
    // Check for 404 error from dockerode? 
    const statusCode = error.statusCode === 404 ? 404 : 500;
    res.status(statusCode).json({ 
        success: false, 
        message: `Failed to stop container '${container_id_or_name}'.`, 
        error: error.message || 'Unknown error' 
    });
  }
});

/**
 * DELETE /tools/uninstall
 * Body: { container_id_or_name: string, force?: boolean }
 * Action: Stops (if needed via force) and removes the specified container.
 */
router.delete('/uninstall', async (req: Request, res: Response) => {
  const { container_id_or_name, force = false } = req.body;

  if (!container_id_or_name) {
    return res.status(400).json({ success: false, error: 'Missing container_id_or_name' });
  }

  try {
    console.log(`Received uninstall request for container: ${container_id_or_name} (force=${force})`);
    // docker_manager.removeContainer handles the removal.
    // It includes a `force` option which implicitly handles stopping if needed.
    await removeContainer(container_id_or_name, force);
    console.log(`Successfully removed container: ${container_id_or_name}`);
    res.status(200).json({ success: true, message: `Container '${container_id_or_name}' removed.` });
  } catch (error: any) {
    console.error(`Failed to remove container ${container_id_or_name}:`, error.message);
    const statusCode = error.statusCode === 404 ? 404 : 500;
    res.status(statusCode).json({ 
        success: false, 
        message: `Failed to remove container '${container_id_or_name}'.`, 
        error: error.message || 'Unknown error' 
    });
  }
});

/**
 * GET /status
 * Action: Returns DTMA status and status of managed containers.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    console.log('Received status request.');
    // List only running containers by default
    // TODO: Add filtering if needed (e.g., by label `agentopia_tool=true`)
    const runningContainers = await listContainers(false); 

    // Format the response
    const toolStatuses = runningContainers.map(container => ({
      id: container.Id,
      name: container.Names[0]?.substring(1), // Remove leading '/'
      image: container.Image,
      state: container.State,
      status: container.Status,
      ports: container.Ports,
    }));

    res.status(200).json({
      success: true,
      dtma_status: 'running', // Basic status for DTMA itself
      managed_tools: toolStatuses,
    });

  } catch (error: any) {
    console.error('Failed to get DTMA status:', error.message);
    res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve container status.', 
        error: error.message || 'Unknown error' 
    });
  }
});

export default router; 