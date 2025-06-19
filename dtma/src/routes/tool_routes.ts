import express, { Request, Response } from 'express';
import {
  pullImage,
  createAndStartContainer,
  startContainer,
  stopContainer,
  removeContainer,
  listContainers,
  inspectContainer,
} from '../docker_manager.js'; 
// import { fetchToolSecrets } from '../agentopia_api_client.js'; // Unused for now

const router = express.Router();

// In-memory tracking of managed tool instances
interface ManagedToolInstance {
  accountToolInstanceId: string;
  dockerImageUrl: string;
  creationPortBindings?: PortMap;
}

const managedInstances = new Map<string, ManagedToolInstance>();

// Helper function to extract explicitly defined host ports from PortBindings
function getExplicitHostPorts(portBindings?: PortMap): string[] {
  const hostPorts = new Set<string>();
  if (portBindings) {
    for (const [, bindings] of Object.entries(portBindings)) {
      if (Array.isArray(bindings)) {
        for (const binding of bindings) {
          if (binding.HostPort) {
            hostPorts.add(binding.HostPort);
          }
        }
      }
    }
  }
  return Array.from(hostPorts);
}

// Import interface from local file since we can't import from dockerode
interface PortMap {
  [containerPort: string]: {
    HostIp?: string;
    HostPort?: string;
  }[];
}

interface ContainerCreateOptions {
  Image?: string;
  name?: string;
  Env?: string[];
  HostConfig?: {
    RestartPolicy?: { Name: string };
    PortBindings?: PortMap;
  };
}

/**
 * POST / (maps to /tools via index.ts)
 * Deploys a new tool instance onto the Toolbox.
 * Request Body: {
 *   dockerImageUrl: string,
 *   instanceNameOnToolbox: string, // This will be the container name
 *   accountToolInstanceId: string, // Agentopia DB ID for this instance
 *   baseConfigOverrideJson?: object, // Includes PortBindings, Env vars etc.
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  const {
    dockerImageUrl,
    instanceNameOnToolbox,
    accountToolInstanceId,
    baseConfigOverrideJson = {},
  } = req.body;

  if (!dockerImageUrl || !instanceNameOnToolbox || !accountToolInstanceId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: dockerImageUrl, instanceNameOnToolbox, accountToolInstanceId',
    });
  }

  if (managedInstances.has(instanceNameOnToolbox)) {
    return res.status(409).json({
        success: false,
        error: `Instance with name '${instanceNameOnToolbox}' already exists.`,
    });
  }

  try {
    console.log(`Deploy request for ${instanceNameOnToolbox} (AID: ${accountToolInstanceId}) with image ${dockerImageUrl}`);

    // Port conflict pre-check for explicitly defined HostPorts
    const requestedPortBindings = (baseConfigOverrideJson as any).HostConfig?.PortBindings as PortMap | undefined;
    if (requestedPortBindings) {
      const explicitlyRequestedHostPorts = getExplicitHostPorts(requestedPortBindings);

      if (explicitlyRequestedHostPorts.length > 0) {
        for (const instance of managedInstances.values()) {
          if (instance.creationPortBindings) {
            const existingInstanceHostPorts = getExplicitHostPorts(instance.creationPortBindings);
            const conflict = explicitlyRequestedHostPorts.find(port => existingInstanceHostPorts.includes(port));
            if (conflict) {
              console.warn(`Port conflict detected for instance ${instanceNameOnToolbox}: Port ${conflict} is already in use by another managed instance.`);
              return res.status(409).json({
                success: false,
                error: `Port conflict: Requested HostPort ${conflict} is already in use by a managed instance.`,
              });
            }
          }
        }
      }
    }

    // 1. Pull the image
    await pullImage(dockerImageUrl);
    console.log(`Image ${dockerImageUrl} pulled successfully for ${instanceNameOnToolbox}.`);

    // 2. Prepare Docker Create Options
    const createOptions: ContainerCreateOptions = {
      Image: dockerImageUrl,
      name: instanceNameOnToolbox,
      Env: (baseConfigOverrideJson as any).Env || [], // Extract Env from baseConfig or default to empty
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: requestedPortBindings || {}, // Use the validated/extracted PortBindings
      },
    };

    // 3. Create and start the container
    const container = await createAndStartContainer(dockerImageUrl, instanceNameOnToolbox, createOptions);
    console.log(`Container ${instanceNameOnToolbox} (ID: ${container.id}) started successfully.`);

    // 4. Store in managed instances map
    managedInstances.set(instanceNameOnToolbox, {
      accountToolInstanceId,
      dockerImageUrl,
      creationPortBindings: createOptions.HostConfig?.PortBindings, // Store the port bindings used
    });

    // 5. Respond with success
    const inspectInfo = await inspectContainer(container.id);
    res.status(201).json({
      success: true,
      message: `Tool '${instanceNameOnToolbox}' deployed successfully.`,
      data: {
        container_id: container.id,
        instance_name_on_toolbox: instanceNameOnToolbox,
        account_tool_instance_id: accountToolInstanceId,
        image: inspectInfo.Config.Image,
        ports: inspectInfo.NetworkSettings.Ports,
        state: inspectInfo.State,
      },
    });

  } catch (error: any) {
    console.error(`Failed to deploy tool '${instanceNameOnToolbox}':`, error.message);
    res.status(500).json({
      success: false,
      message: `Failed to deploy tool '${instanceNameOnToolbox}'.`,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * DELETE /{instanceNameOnToolbox}
 * Removes/deletes a tool instance from the Toolbox.
 */
router.delete('/:instanceNameOnToolbox', async (req: Request, res: Response) => {
  const { instanceNameOnToolbox } = req.params;

  if (!instanceNameOnToolbox) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceNameOnToolbox parameter.',
    });
  }

  if (!managedInstances.has(instanceNameOnToolbox)) {
    return res.status(404).json({
        success: false,
        error: `Tool instance '${instanceNameOnToolbox}' not found or not managed by this DTMA.`
    });
  }

  try {
    console.log(`Uninstall request for tool instance: ${instanceNameOnToolbox}`);
    
    // Attempt to stop and remove the container
    await removeContainer(instanceNameOnToolbox, true);
    console.log(`Container for '${instanceNameOnToolbox}' removed successfully.`);

    // Remove from managed instances map
    managedInstances.delete(instanceNameOnToolbox);
    console.log(`'${instanceNameOnToolbox}' removed from managed instances.`);

    res.status(200).json({
      success: true,
      message: `Tool instance '${instanceNameOnToolbox}' removed successfully.`,
    });

  } catch (error: any) {
    console.error(`Failed to remove tool instance '${instanceNameOnToolbox}':`, error.message);
    res.status(500).json({
      success: false,
      message: `Failed to remove tool instance '${instanceNameOnToolbox}'.`,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /{instanceNameOnToolbox}/start
 * Starts a previously stopped tool instance.
 */
router.post('/:instanceNameOnToolbox/start', async (req: Request, res: Response) => {
  const { instanceNameOnToolbox } = req.params;

  if (!instanceNameOnToolbox) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceNameOnToolbox parameter.',
    });
  }

  if (!managedInstances.has(instanceNameOnToolbox)) {
    return res.status(404).json({
      success: false,
      error: `Tool instance '${instanceNameOnToolbox}' not found or not managed by this DTMA.`,
    });
  }

  try {
    console.log(`Start request for tool instance: ${instanceNameOnToolbox}`);
    
    // Check if container exists and start it
    let inspectInfo = await inspectContainer(instanceNameOnToolbox);
    if (inspectInfo.State.Running) {
      return res.status(200).json({
        success: true,
        message: `Tool instance '${instanceNameOnToolbox}' is already running.`,
      });
    }

    // Start the container
    await startContainer(instanceNameOnToolbox);
    console.log(`Tool instance '${instanceNameOnToolbox}' started successfully.`);

    res.status(200).json({
      success: true,
      message: `Tool instance '${instanceNameOnToolbox}' started successfully.`,
    });

  } catch (error: any) {
    console.error(`Failed to start tool instance '${instanceNameOnToolbox}':`, error.message);
    res.status(500).json({
      success: false,
      message: `Failed to start tool instance '${instanceNameOnToolbox}'.`,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /{instanceNameOnToolbox}/stop
 * Stops a running tool instance.
 */
router.post('/:instanceNameOnToolbox/stop', async (req: Request, res: Response) => {
  const { instanceNameOnToolbox } = req.params;

  if (!instanceNameOnToolbox) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceNameOnToolbox parameter.',
    });
  }

  if (!managedInstances.has(instanceNameOnToolbox)) {
    return res.status(404).json({
      success: false,
      error: `Tool instance '${instanceNameOnToolbox}' not found or not managed by this DTMA.`,
    });
  }

  try {
    console.log(`Stop request for tool instance: ${instanceNameOnToolbox}`);
    
    await stopContainer(instanceNameOnToolbox);
    console.log(`Tool instance '${instanceNameOnToolbox}' stopped successfully.`);

    res.status(200).json({
      success: true,
      message: `Tool instance '${instanceNameOnToolbox}' stopped successfully.`,
    });

  } catch (error: any) {
    console.error(`Failed to stop tool instance '${instanceNameOnToolbox}':`, error.message);
    res.status(500).json({
      success: false,
      message: `Failed to stop tool instance '${instanceNameOnToolbox}'.`,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * GET /status
 * Action: Returns DTMA status and status of managed containers in the format expected by the backend.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    console.log('Received status request.');
    // List all containers (running and stopped)
    const allContainers = await listContainers(true); 

    // Format the response to match what the backend expects
    const toolInstances = allContainers.map(container => {
      const containerName = container.Names[0]?.substring(1) || container.Id; // Remove leading '/' or use ID as fallback
      const managedInstance = managedInstances.get(containerName);
      
      return {
        account_tool_instance_id: managedInstance?.accountToolInstanceId || null,
        instance_name_on_toolbox: containerName,
        container_id: container.Id,
        status: container.State, // 'running', 'exited', etc.
        image: container.Image,
        ports: container.Ports,
        created: container.Created,
        // Add any other fields the backend might expect
      };
    });

    // Also include system information that backend expects
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'DTMA',
      environment: {
        hasAuthToken: true,
        hasApiKey: true,
        hasApiBaseUrl: true,
        port: '30000'
      },
      tool_instances: toolInstances, // This is the key field the backend looks for
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