import express, { Request, Response } from 'express';
import {
  pullImage,
  createAndStartContainer,
  stopContainer,
  removeContainer,
  inspectContainer,
  executeInContainer,
} from '../docker_manager.js'; 
import { getAgentToolCredentials } from '../agentopia_api_client.js';
import { managedInstances } from '../index.js';
import Dockerode from 'dockerode';

const router = express.Router();

// Helper function to extract explicitly defined HostPorts from PortBindings
function getExplicitHostPorts(portBindings?: Dockerode.PortMap): string[] {
  if (!portBindings) {
    return [];
  }
  const hostPorts: Set<string> = new Set();
  for (const containerPortKey in portBindings) {
    const bindings = portBindings[containerPortKey];
    if (bindings && Array.isArray(bindings)) {
      for (const binding of bindings) {
        if (binding && binding.HostPort && binding.HostPort.trim() !== '') {
          hostPorts.add(binding.HostPort.trim());
        }
      }
    }
  }
  return Array.from(hostPorts);
}

/**
 * POST / (maps to /tools via index.ts)
 * Deploys a new tool instance onto the Toolbox.
 * Request Body: {
 *   dockerImageUrl: string,
 *   instanceNameOnToolbox: string, // This will be the container name
 *   accountToolInstanceId: string, // Agentopia DB ID for this instance
 *   baseConfigOverrideJson?: object, // Includes PortBindings, Env vars etc.
 *   // requiredEnvVars?: string[] // This might be part of baseConfigOverrideJson or handled by tool image
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
    const requestedPortBindings = (baseConfigOverrideJson as any).HostConfig?.PortBindings as Dockerode.PortMap | undefined;
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
    const createOptions: Dockerode.ContainerCreateOptions = {
      Image: dockerImageUrl,
      name: instanceNameOnToolbox,
      Env: (baseConfigOverrideJson as any).Env || [], // Extract Env from baseConfig or default to empty
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: requestedPortBindings || {}, // Use the validated/extracted PortBindings
        // TODO: Add Volume bindings if/when supported via baseConfigOverrideJson
      },
      // Attach TTY if needed by the tool, can be configurable
      // Tty: (baseConfigOverrideJson as any).Tty || false,
    };
    // TODO: More sophisticated merging of baseConfigOverrideJson into createOptions

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
    // Attempt to clean up if instance was partially added to map but container failed
    if (managedInstances.has(instanceNameOnToolbox) && !(error.statusCode === 409)) {
        // If it's not a conflict error (already exists), try to remove if container creation failed mid-way
        // This is a simple cleanup, more robust transactional logic might be needed
    }
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
    // removeContainer with force=true should handle stopping it first.
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
    // If removeContainer failed but it's still in map, it leaves an orphaned entry.
    // For now, we assume removeContainer failing means it might still exist on host.
    // Client/backend might need retry or manual cleanup.
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
    // Ensure the container exists and is not already running (or handle as needed)
    let inspectInfo = await inspectContainer(instanceNameOnToolbox);
    if (inspectInfo.State.Running) {
      return res.status(200).json({ 
        success: true, 
        message: `Tool instance '${instanceNameOnToolbox}' is already running.`,
        data: { state: inspectInfo.State }
      });
    }

    // Get the Dockerode container object and call start
    // Note: docker_manager.ts doesn't have a standalone start for an *existing* container.
    // We might need to add it or use dockerode directly here.
    const docker = new Dockerode(); // Assuming default socket path
    const container = docker.getContainer(instanceNameOnToolbox);
    await container.start();
    console.log(`Tool instance '${instanceNameOnToolbox}' started successfully.`);
    
    inspectInfo = await inspectContainer(instanceNameOnToolbox); // Re-inspect to get new state

    res.status(200).json({
      success: true,
      message: `Tool instance '${instanceNameOnToolbox}' started.`,      
      data: { state: inspectInfo.State }
    });

  } catch (error: any) {
    console.error(`Failed to start tool instance '${instanceNameOnToolbox}':`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
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
    
    // Ensure the container exists and is running before trying to stop
    // stopContainer from docker_manager already gets the container, so it will fail if not found.
    // It might also fail if already stopped, but that's okay.
    await stopContainer(instanceNameOnToolbox);
    console.log(`Tool instance '${instanceNameOnToolbox}' stopped successfully.`);
    
    const inspectInfo = await inspectContainer(instanceNameOnToolbox); // Get updated state

    res.status(200).json({
      success: true,
      message: `Tool instance '${instanceNameOnToolbox}' stopped.`,
      data: { state: inspectInfo.State }
    });

  } catch (error: any) {
    console.error(`Failed to stop tool instance '${instanceNameOnToolbox}':`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: `Failed to stop tool instance '${instanceNameOnToolbox}'.`,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /{instanceNameOnToolbox}/execute
 * Executes a specific capability of a tool instance with agent-specific context.
 */
router.post('/:instanceNameOnToolbox/execute', async (req: Request, res: Response) => {
  const { instanceNameOnToolbox } = req.params;
  const {
    agentId,
    accountToolInstanceId,
    capabilityName,
    payload = {},
  } = req.body;

  if (!instanceNameOnToolbox) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceNameOnToolbox parameter.',
    });
  }

  const managedInstance = managedInstances.get(instanceNameOnToolbox);

  if (!managedInstance) {
    return res.status(404).json({
      success: false,
      error: `Tool instance '${instanceNameOnToolbox}' not found or not managed.`,
    });
  }

  // Sanity check: accountToolInstanceId from payload should match stored one
  if (managedInstance.accountToolInstanceId !== accountToolInstanceId) {
    console.warn(
      `Mismatch: accountToolInstanceId from payload (${accountToolInstanceId}) ` +
      `does not match stored ID (${managedInstance.accountToolInstanceId}) for ${instanceNameOnToolbox}.`
    );
    return res.status(400).json({
      success: false,
      error: 'Tool instance ID mismatch between path and payload context.',
    });
  }

  if (!agentId || !capabilityName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields in payload: agentId, capabilityName',
    });
  }

  try {
    console.log(
      `Execute request for tool '${instanceNameOnToolbox}', capability '${capabilityName}', by agent '${agentId}'`
    );

    // 1. Fetch agent-specific credentials
    const credentials = await getAgentToolCredentials({
      agentId,
      accountToolInstanceId,
    });

    if (!credentials) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch agent-specific credentials for the tool execution.',
      });
    }
    console.log(`Credentials fetched for agent '${agentId}' for tool '${instanceNameOnToolbox}'.`);

    // 2. Prepare environment variables for execution
    const envVarsForExec: string[] = [];
    for (const [key, value] of Object.entries(credentials)) {
      if (value !== null) {
        envVarsForExec.push(`${key}=${value}`);
      }
    }

    // 3. Determine the command to run (Simplification for now)
    // This part is highly tool-dependent and would ideally come from tool metadata.
    // For now, assume capabilityName is executable and payload is a single JSON string arg.
    const commandToRun: string[] = [capabilityName];
    if (payload && Object.keys(payload).length > 0) {
        commandToRun.push(JSON.stringify(payload));
    }
    console.log(`Prepared command for execution: ${commandToRun.join(' ')}`);

    // 4. Execute command in container
    const executionResult = await executeInContainer(
      instanceNameOnToolbox,
      commandToRun
    );
    console.log(`Execution of '${capabilityName}' completed for '${instanceNameOnToolbox}'.`);

    // 5. Respond with the output
    // Output might be plain text or JSON, depending on the tool.
    // Try to parse as JSON, otherwise return as text.
    let responseData: any = executionResult.output;
    try {
        responseData = JSON.parse(executionResult.output);
    } catch (e) {
        // Not JSON, treat as plain text
        console.log('Execution output was not JSON, returning as text.');
    }

    res.status(200).json({
      success: true,
      message: `Capability '${capabilityName}' executed successfully.`,      
      data: {
        output: responseData,
        exitCode: executionResult.exitCode
      },
    });

  } catch (error: any) {
    console.error(
      `Failed to execute capability '${capabilityName}' on '${instanceNameOnToolbox}' for agent '${agentId}':`,
      error.message
    );
    // If error is from executeInContainer due to non-zero exit code, error.message will contain that info.
    res.status(500).json({
      success: false,
      message: `Failed to execute capability '${capabilityName}'.`,
      error: error.message || 'Unknown error during execution',
    });
  }
});

// TODO: Implement other routes:
// POST /{instanceNameOnToolbox}/execute

export default router; 