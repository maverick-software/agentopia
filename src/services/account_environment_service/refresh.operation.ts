import type { Json } from '../../types/database.types.ts';
import { getDigitalOceanDroplet } from '../digitalocean_service/index.ts';
import { ToolInstanceService } from '../tool_instance_service/manager.ts';
import {
  AccountToolEnvironmentRecord,
  AccountToolEnvironmentStatusEnum,
  AccountToolEnvironmentUpdate
} from './manager.types.ts';

interface RefreshOperationDeps {
  toolInstanceService: ToolInstanceService;
  getToolboxEnvironmentById: (toolboxId: string) => Promise<AccountToolEnvironmentRecord | null>;
  getToolboxEnvironmentByIdForUser: (
    userId: string,
    toolboxId: string
  ) => Promise<AccountToolEnvironmentRecord | null>;
  updateToolboxEnvironment: (
    toolboxId: string,
    updates: AccountToolEnvironmentUpdate
  ) => Promise<AccountToolEnvironmentRecord>;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export async function refreshToolboxStatusFromDtmaOperation(
  deps: RefreshOperationDeps,
  toolboxId: string,
  userId?: string
): Promise<AccountToolEnvironmentRecord> {
  console.log(`Refreshing Toolbox status from DTMA for ID: ${toolboxId}`);

  const toolboxRecord = userId
    ? await deps.getToolboxEnvironmentByIdForUser(userId, toolboxId)
    : await deps.getToolboxEnvironmentById(toolboxId);

  if (!toolboxRecord) {
    throw new Error('Toolbox environment not found or user not authorized.');
  }

  if (toolboxRecord.status === 'deprovisioned' || toolboxRecord.status === 'pending_deprovision') {
    console.warn(`Toolbox ${toolboxId} is in state ${toolboxRecord.status}, skipping DTMA status refresh.`);
    return toolboxRecord;
  }

  if (!toolboxRecord.do_droplet_id) {
    throw new Error('Toolbox droplet ID is not set. Cannot refresh status from DTMA.');
  }

  let currentDropletIP: string;
  try {
    console.log(`Fetching current droplet information for ID: ${toolboxRecord.do_droplet_id}`);
    const dropletInfo = await getDigitalOceanDroplet(toolboxRecord.do_droplet_id);
    const publicNetworks = dropletInfo.networks?.v4?.filter((network: any) => network.type === 'public');
    if (!publicNetworks || publicNetworks.length === 0) {
      throw new Error('No public IPv4 address found for droplet');
    }

    currentDropletIP = publicNetworks[0].ip_address;
    console.log(`Current droplet IP from DigitalOcean API: ${currentDropletIP}`);

    const updates: Record<string, unknown> = {};
    if (currentDropletIP !== toolboxRecord.public_ip_address) {
      console.log(`Updating stored IP from ${toolboxRecord.public_ip_address} to ${currentDropletIP}`);
      updates.public_ip_address = currentDropletIP;
      toolboxRecord.public_ip_address = currentDropletIP;
    }

    if (dropletInfo.name !== toolboxRecord.do_droplet_name) {
      console.log(`Syncing droplet name from ${toolboxRecord.do_droplet_name} to ${dropletInfo.name}`);
      updates.do_droplet_name = dropletInfo.name;
      toolboxRecord.do_droplet_name = dropletInfo.name;
    }

    if (Object.keys(updates).length > 0) {
      await deps.updateToolboxEnvironment(toolboxId, updates as AccountToolEnvironmentUpdate);
    }
  } catch (dropletError: any) {
    console.error(
      `Failed to get current droplet IP for ${toolboxRecord.do_droplet_id}:`,
      dropletError.message
    );
    if (!toolboxRecord.public_ip_address) {
      throw new Error('Cannot determine droplet IP address and no stored IP available.');
    }
    console.warn(`Falling back to stored IP address: ${toolboxRecord.public_ip_address}`);
    currentDropletIP = toolboxRecord.public_ip_address as string;
  }

  const dtmaPort = Deno.env.get('DTMA_PORT') || '30000';
  const backendToDtmaApiKeyFromEnv = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
  if (!backendToDtmaApiKeyFromEnv) {
    console.error('CRITICAL: BACKEND_TO_DTMA_API_KEY is not configured. Cannot refresh status from DTMA.');
    throw new Error('Internal configuration error: Missing DTMA API key.');
  }

  const dtmaStatusUrl = `http://${currentDropletIP}:${dtmaPort}/status`;
  let dtmaStatusResponse;
  try {
    dtmaStatusResponse = await fetch(dtmaStatusUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${backendToDtmaApiKeyFromEnv}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (networkError: any) {
    console.error(`Network error fetching DTMA status from ${dtmaStatusUrl}:`, networkError.message);
    await deps.updateToolboxEnvironment(toolboxId, {
      status: 'unresponsive',
      dtma_health_details_json: { error: `Network error: ${networkError.message}` }
    });
    throw new Error(`Failed to connect to DTMA: ${networkError.message}`);
  }

  if (!dtmaStatusResponse.ok) {
    const errorBody = await dtmaStatusResponse.text();
    console.error(
      `DTMA status endpoint ${dtmaStatusUrl} returned error ${dtmaStatusResponse.status}: ${errorBody}`
    );
    await deps.updateToolboxEnvironment(toolboxId, {
      status: 'unresponsive',
      dtma_health_details_json: { error: `DTMA API error ${dtmaStatusResponse.status}: ${errorBody}` }
    });
    throw new Error(`DTMA returned error: ${dtmaStatusResponse.status}`);
  }

  let dtmaStatusPayload;
  try {
    dtmaStatusPayload = await dtmaStatusResponse.json();
  } catch (parseError: any) {
    console.error(`Error parsing JSON response from DTMA ${dtmaStatusUrl}:`, parseError.message);
    await deps.updateToolboxEnvironment(toolboxId, {
      status: 'unresponsive',
      dtma_health_details_json: { error: `DTMA JSON parse error: ${parseError.message}` }
    });
    throw new Error('Failed to parse DTMA status response.');
  }

  console.log('Received DTMA status payload:', JSON.stringify(dtmaStatusPayload, null, 2));

  const shouldSetActive = ![
    'deprovisioned',
    'pending_deprovision',
    'deprovisioning',
    'error_deprovisioning'
  ].includes(toolboxRecord.status);

  const toolboxUpdates: AccountToolEnvironmentUpdate = {
    dtma_last_known_version: dtmaStatusPayload.version || dtmaStatusPayload.dtma_version,
    dtma_health_details_json:
      (dtmaStatusPayload.environment || dtmaStatusPayload.system_metrics || dtmaStatusPayload) as Json,
    last_heartbeat_at: new Date().toISOString(),
    status: shouldSetActive ? ('active' as AccountToolEnvironmentStatusEnum) : toolboxRecord.status
  };
  const updatedToolboxRecord = await deps.updateToolboxEnvironment(toolboxId, toolboxUpdates);

  if (dtmaStatusPayload.tool_instances && Array.isArray(dtmaStatusPayload.tool_instances)) {
    const instanceUpdatePromises = dtmaStatusPayload.tool_instances.map(async (dtmaInstance: any) => {
      if (!dtmaInstance.account_tool_instance_id) {
        console.warn(
          'DTMA status contained a tool instance without an account_tool_instance_id. Skipping:',
          dtmaInstance
        );
        return null;
      }

      try {
        const runtimeDetails: Json = {
          reported_by_dtma_at: new Date().toISOString(),
          status_on_toolbox: dtmaInstance.status,
          container_id: dtmaInstance.container_id,
          instance_name_on_toolbox: dtmaInstance.instance_name_on_toolbox
        };

        if (dtmaInstance.metrics) {
          (runtimeDetails as any).metrics = dtmaInstance.metrics;
        }

        return deps.toolInstanceService.updateToolInstanceDetailsFromDtmaReport(
          dtmaInstance.account_tool_instance_id,
          dtmaInstance.status,
          runtimeDetails,
          toolboxUpdates.last_heartbeat_at || undefined
        );
      } catch (instanceUpdateError: any) {
        console.error(
          `Error processing update for instance ${dtmaInstance.account_tool_instance_id}:`,
          instanceUpdateError.message
        );
        return null;
      }
    });

    const results = await Promise.allSettled(instanceUpdatePromises);
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error(
          'Failed to update a tool instance from DTMA report (within Promise.allSettled):',
          result.reason
        );
      }
    });
  } else {
    console.log(`No tool instances reported by DTMA for toolbox ${toolboxId}, or format is incorrect.`);
  }

  return updatedToolboxRecord;
}
