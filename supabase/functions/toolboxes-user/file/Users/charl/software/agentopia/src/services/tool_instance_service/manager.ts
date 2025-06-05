export class ToolInstanceService {
  supabase;
  constructor(supabaseClient){
    this.supabase = supabaseClient;
  }
  /**
     * Creates a new tool instance record in the database.
     * WBS 2A.1.1
     */ async createToolInstance(options) {
    const insertData = {
      account_tool_environment_id: options.account_tool_environment_id,
      tool_catalog_id: options.tool_catalog_id,
      instance_name_on_toolbox: options.instance_name_on_toolbox,
      base_config_override_json: options.base_config_override_json,
      status_on_toolbox: options.status_on_toolbox
    };
    const { data, error } = await this.supabase.from('account_tool_instances').insert(insertData).select().single();
    if (error) {
      console.error('Error creating tool instance:', error);
      throw error;
    }
    return data; // Cast because select() can return array
  }
  /**
     * Retrieves a tool instance by its ID.
     * WBS 2A.1.1
     */ async getToolInstanceById(toolInstanceId) {
    const { data, error } = await this.supabase.from('account_tool_instances').select('*').eq('id', toolInstanceId).maybeSingle();
    if (error) {
      console.error('Error fetching tool instance by ID:', error);
      throw error;
    }
    return data;
  }
  /**
     * Retrieves all tool instances for a given toolbox (account_tool_environment_id).
     * WBS 2A.1.1
     */ async getToolInstancesForToolbox(accountToolEnvironmentId) {
    const { data, error } = await this.supabase.from('account_tool_instances').select('*').eq('account_tool_environment_id', accountToolEnvironmentId);
    if (error) {
      console.error('Error fetching tool instances for toolbox:', error);
      throw error;
    }
    return data || [];
  }
  /**
     * Updates a tool instance record.
     * WBS 2A.1.1
     */ async updateToolInstance(toolInstanceId, updates) {
    // Ensure 'updated_at' is managed by the trigger or manually set if needed.
    // Supabase typically handles this with a trigger: trigger_set_timestamp(updated_at)
    const updateData = updates;
    const { data, error } = await this.supabase.from('account_tool_instances').update(updateData).eq('id', toolInstanceId).select().single();
    if (error) {
      console.error('Error updating tool instance:', error);
      throw error;
    }
    return data; // Cast because select() can return array
  }
  /**
     * Marks a tool instance for deletion by updating its status to 'pending_delete'.
     * Actual deletion from DTMA and potentially DB record removal would be separate steps.
     * WBS 2A.1.1
     */ async markToolInstanceForDeletion(toolInstanceId) {
    const updateData = {
      status_on_toolbox: 'pending_delete'
    };
    const { data, error } = await this.supabase.from('account_tool_instances').update(updateData).eq('id', toolInstanceId).select().single();
    if (error) {
      console.error('Error marking tool instance for deletion:', error);
      throw error;
    }
    return data; // Cast because select() can return array
  }
  /**
     * Deploys a tool from the tool_catalog onto a specified Toolbox by commanding the DTMA.
     * WBS 2A.1.2
     */ async deployToolToToolbox(options) {
    // 1. Authorize User (Placeholder - implement actual authorization logic)
    console.log(`Authorizing userId: ${options.userId} for toolbox: ${options.accountToolEnvironmentId}`);
    // const toolbox = await this.getToolboxEnvironmentDetails(options.accountToolEnvironmentId);
    // if (!toolbox || toolbox.user_id !== options.userId) {
    //     throw new Error('Unauthorized or Toolbox not found');
    // }
    // if (toolbox.status !== 'active') { // Or relevant status to allow deployment
    //     throw new Error('Toolbox is not in a state ready for deployment.');
    // }
    // 2. Fetch Tool Catalog Entry
    const { data: toolCatalogEntry, error: catalogError } = await this.supabase.from('tool_catalog').select('*').eq('id', options.toolCatalogId).single();
    if (catalogError || !toolCatalogEntry) {
      console.error('Error fetching tool catalog entry:', catalogError);
      throw new Error(catalogError?.message || 'Tool catalog entry not found.');
    }
    // 3. Fetch Toolbox Details (simplified for now, assuming AccountEnvironmentService might provide this)
    // For this example, directly fetch what's needed if AccountEnvironmentService is not integrated yet.
    const { data: toolbox, error: toolboxError } = await this.supabase.from('account_tool_environments').select('public_ip_address, status, user_id') // Add user_id for auth check
    .eq('id', options.accountToolEnvironmentId).single();
    if (toolboxError || !toolbox) {
      console.error('Error fetching toolbox details:', toolboxError);
      throw new Error(toolboxError?.message || 'Toolbox not found.');
    }
    // Actual Authorization check (refining placeholder from step 1)
    if (toolbox.user_id !== options.userId) {
      throw new Error('User is not authorized to deploy to this toolbox.');
    }
    // Add check for toolbox status, e.g., must be 'active'
    if (toolbox.status !== 'active') {
      throw new Error(`Toolbox is not active. Current status: ${toolbox.status}`);
    }
    const newToolInstanceRecord = await this.createToolInstance({
      account_tool_environment_id: options.accountToolEnvironmentId,
      tool_catalog_id: options.toolCatalogId,
      instance_name_on_toolbox: options.instanceNameOnToolbox,
      base_config_override_json: options.baseConfigOverrideJson,
      status_on_toolbox: 'pending_deploy'
    });
    try {
      // Prepare DTMA API Call
      const dtmaPayload = {
        dockerImageUrl: toolCatalogEntry.package_identifier,
        instanceNameOnToolbox: newToolInstanceRecord.instance_name_on_toolbox,
        accountToolInstanceId: newToolInstanceRecord.id,
        baseConfigOverrideJson: newToolInstanceRecord.base_config_override_json
      };
      const dtmaPort = Deno.env.get('DTMA_PORT') || '30000'; // Fixed to match actual DTMA port
      const backendToDtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
      if (!backendToDtmaApiKey) {
        throw new Error('BACKEND_TO_DTMA_API_KEY is not configured.');
      }
      const dtmaApiUrl = `http://${toolbox.public_ip_address}:${dtmaPort}/tools`;
      console.log('Calling DTMA API:', dtmaApiUrl, 'with payload:', dtmaPayload);
      // Make API Call to DTMA (using fetch API)
      const response = await fetch(dtmaApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${backendToDtmaApiKey}`
        },
        body: JSON.stringify(dtmaPayload)
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`DTMA API request failed with status ${response.status}: ${errorBody}`);
      }
      // DTMA call succeeded, update status to 'deploying'
      return await this.updateToolInstance(newToolInstanceRecord.id, {
        status_on_toolbox: 'deploying'
      });
    } catch (error) {
      console.error('Error during DTMA call or subsequent update:', error);
      // Rollback or set status to 'error_deploying'
      await this.updateToolInstance(newToolInstanceRecord.id, {
        status_on_toolbox: 'error_deploying'
      });
      throw error; // Re-throw the error to the caller
    }
  }
  async _getToolboxAndInstanceForManagement(accountToolInstanceId, userId) {
    const { data: instance, error: instanceError } = await this.supabase.from('account_tool_instances').select('*, account_tool_environments(*)').eq('id', accountToolInstanceId).single();
    if (instanceError || !instance) {
      console.error('Error fetching tool instance for management:', instanceError);
      throw new Error(instanceError?.message || 'Tool instance not found.');
    }
    if (!instance.account_tool_environments) {
      throw new Error('Tool instance is not associated with a toolbox environment.');
    }
    const toolbox = instance.account_tool_environments;
    if (toolbox.user_id !== userId) {
      throw new Error('User is not authorized to manage this tool instance.');
    }
    if (toolbox.status !== 'active') {
      throw new Error(`Toolbox is not active. Current status: ${toolbox.status}`);
    }
    if (typeof toolbox.public_ip_address !== 'string' || !toolbox.public_ip_address) {
      console.error('Toolbox public_ip_address is missing or not a string:', toolbox.public_ip_address);
      throw new Error('Toolbox public IP address is invalid or not available.');
    }
    return {
      instance,
      toolbox: toolbox
    };
  }
  async _callDtmaApi(toolboxIp, method, path, payload) {
    const dtmaPort = Deno.env.get('DTMA_PORT') || '30000';
    const backendToDtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
    if (!backendToDtmaApiKey) {
      throw new Error('BACKEND_TO_DTMA_API_KEY is not configured for DTMA API calls.');
    }
    const dtmaApiUrl = `http://${toolboxIp}:${dtmaPort}${path}`;
    console.log(`Calling DTMA API: ${method} ${dtmaApiUrl}`, payload || '');
    const response = await fetch(dtmaApiUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${backendToDtmaApiKey}`
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`DTMA API request failed to ${dtmaApiUrl} with status ${response.status}: ${errorBody}`);
      throw new Error(`DTMA API request failed: ${response.status} ${errorBody}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      try {
        return await response.json();
      } catch (e) {
        console.error('Failed to parse JSON response from DTMA:', e);
        return {
          success: true,
          message: 'DTMA request successful, but response was not valid JSON.',
          error: e.message
        };
      }
    }
    return {
      success: true,
      message: await response.text() || 'DTMA request successful'
    };
  }
  /**
     * Removes a tool instance from a Toolbox by commanding the DTMA.
     * WBS 2A.1.3
     */ async removeToolFromToolbox(options) {
    const { instance, toolbox } = await this._getToolboxAndInstanceForManagement(options.accountToolInstanceId, options.userId);
    let updatedInstance = await this.updateToolInstance(instance.id, {
      status_on_toolbox: 'pending_delete'
    });
    try {
      await this._callDtmaApi(toolbox.public_ip_address, 'DELETE', `/tools/${instance.instance_name_on_toolbox}`);
      updatedInstance = await this.updateToolInstance(instance.id, {
        status_on_toolbox: 'deleting'
      });
    } catch (error) {
      console.error('Error removing tool from DTMA or updating status:', error);
      updatedInstance = await this.updateToolInstance(instance.id, {
        status_on_toolbox: 'error_deleting'
      });
      throw error;
    }
    return updatedInstance;
  }
  /**
     * Starts a stopped tool instance on a Toolbox by commanding the DTMA.
     * WBS 2A.1.3
     */ async startToolOnToolbox(options) {
    const { instance, toolbox } = await this._getToolboxAndInstanceForManagement(options.accountToolInstanceId, options.userId);
    if (instance.status_on_toolbox !== 'stopped') {
      throw new Error(`Tool instance must be in 'stopped' state to be started. Current state: ${instance.status_on_toolbox}`);
    }
    let updatedInstance = await this.updateToolInstance(instance.id, {
      status_on_toolbox: 'starting_on_toolbox'
    });
    try {
      await this._callDtmaApi(toolbox.public_ip_address, 'POST', `/tools/${instance.instance_name_on_toolbox}/start`);
      updatedInstance = await this.updateToolInstance(instance.id, {
        status_on_toolbox: 'running'
      });
    } catch (error) {
      console.error('Error starting tool on DTMA or updating status:', error);
      updatedInstance = await this.updateToolInstance(instance.id, {
        status_on_toolbox: 'error_starting'
      });
      throw error;
    }
    return updatedInstance;
  }
  /**
     * Stops a running tool instance on a Toolbox by commanding the DTMA.
     * WBS 2A.1.3
     */ async stopToolOnToolbox(options) {
    const { instance, toolbox } = await this._getToolboxAndInstanceForManagement(options.accountToolInstanceId, options.userId);
    if (instance.status_on_toolbox !== 'running') {
      throw new Error(`Tool instance must be in 'running' state to be stopped. Current state: ${instance.status_on_toolbox}`);
    }
    let updatedInstance = await this.updateToolInstance(instance.id, {
      status_on_toolbox: 'stopping_on_toolbox'
    });
    try {
      await this._callDtmaApi(toolbox.public_ip_address, 'POST', `/tools/${instance.instance_name_on_toolbox}/stop`);
      updatedInstance = await this.updateToolInstance(instance.id, {
        status_on_toolbox: 'stopped'
      });
    } catch (error) {
      console.error('Error stopping tool on DTMA or updating status:', error);
      updatedInstance = await this.updateToolInstance(instance.id, {
        status_on_toolbox: 'error_stopping'
      });
      throw error;
    }
    return updatedInstance;
  }
  /**
     * WBS 2A.1.4: Placeholder for status reconciliation logic.
     * Fetches the current status of a specific tool instance directly from the DTMA
     * and updates the database record if necessary.
     * This can be used for on-demand status checks or to reconcile discrepancies.
     */ async refreshInstanceStatusFromDtma(options) {
    // This would involve:
    // 1. Getting toolbox IP from options.accountToolEnvironmentId (or instance.account_tool_environment_id)
    // 2. Calling DTMA's GET /status or a specific GET /tools/{instanceNameOnToolbox}/status endpoint
    // 3. Parsing the response for the specific instance
    // 4. Updating the DB record.
    // This is slightly different from being called *after* AccountEnvironmentService already called /status
    console.warn("ToolInstanceService.refreshInstanceStatusFromDtma is a placeholder and not fully implemented for direct DTMA query.");
    const instance = await this.getToolInstanceById(options.accountToolInstanceId);
    if (!instance) {
      throw new Error('Tool instance not found');
    }
    // For now, just return the instance without actual refresh via DTMA.
    // TODO: Implement direct DTMA query if needed for single instance refresh.
    return instance;
  }
  /**
     * Updates a tool instance's status and runtime details based on a report
     * received from the DTMA (typically from the DTMA's /status endpoint payload).
     * This method is called by AccountEnvironmentService.
     * WBS 2A.1.4
     */ async updateToolInstanceDetailsFromDtmaReport(accountToolInstanceId, statusFromDtma, runtimeDetailsFromDtma, lastHeartbeatTime// Optional: timestamp of the DTMA report
  ) {
    const existingInstance = await this.getToolInstanceById(accountToolInstanceId);
    if (!existingInstance) {
      console.warn(`Tool instance ${accountToolInstanceId} not found. Cannot update from DTMA report.`);
      return null;
    }
    const newStatus = mapDtmaStatusToInstallationStatus(statusFromDtma);
    const updates = {
      status_on_toolbox: newStatus,
      last_heartbeat_from_dtma: lastHeartbeatTime || new Date().toISOString()
    };
    if (runtimeDetailsFromDtma) {
      const details = runtimeDetailsFromDtma;
      if (typeof details.instance_name_on_toolbox === 'string') {
        updates.instance_name_on_toolbox = details.instance_name_on_toolbox;
      }
      // version from DTMA could also be updated here if applicable
      // e.g., if (typeof details.version === 'string') { updates.version = details.version; }
      if (details.container_id) {
        console.log(`[ToolInstanceService] DTMA reported container_id: ${details.container_id} for instance ${accountToolInstanceId}. Not stored in a dedicated column.`);
      }
      if (details.metrics) {
        console.log(`[ToolInstanceService] DTMA reported metrics for instance ${accountToolInstanceId}. Not stored in a dedicated column. Metrics:`, details.metrics);
      }
    }
    if (Object.keys(updates).length === 0) {
      console.log(`[ToolInstanceService] No effective changes to update for instance ${accountToolInstanceId} from DTMA report.`);
      return existingInstance; // Return the existing record if no actual updates are made
    }
    try {
      const { data, error } = await this.supabase.from('account_tool_instances').update(updates).eq('id', accountToolInstanceId).select().single();
      if (error) {
        console.error(`Error updating tool instance ${accountToolInstanceId} from DTMA report:`, error);
        throw error;
      }
      console.log(`Tool instance ${accountToolInstanceId} updated successfully from DTMA report.`);
      return data;
    } catch (error) {
      // Catch block added to prevent unhandled promise rejection if DB update fails
      console.error(`Failed to apply updates to tool instance ${accountToolInstanceId} from DTMA report in DB:`, error);
      return null; // Or rethrow, depending on desired error handling
    }
  }
}
function mapDtmaStatusToInstallationStatus(dtmaStatus) {
  // Based on DTMA status strings (e.g., from dtma/src/index.ts ManagedToolInstanceStatus)
  // and target ENUM account_tool_installation_status_enum
  // (pending_deploy, deploying, running, stopped, error, pending_delete, deleting)
  // DTMA states: PENDING, STARTING, RUNNING, STOPPING, STOPPED, ERROR, UNKNOWN
  switch(dtmaStatus?.toUpperCase()){
    case 'PENDING':
    case 'STARTING':
      return 'deploying';
    case 'RUNNING':
      return 'running';
    case 'STOPPING':
      return 'deploying'; // Using 'deploying' as a generic transition state, consider 'pending_delete' if it implies removal
    case 'STOPPED':
      return 'stopped';
    case 'ERROR':
      return 'error';
    case 'UNKNOWN':
    default:
      console.warn(`Unknown DTMA status: ${dtmaStatus}. Mapping to 'error'.`);
      return 'error'; // Default to error or a specific 'unknown' state if added to ENUM
  }
} // Example of how this service might be instantiated and used:
 // import { createClient } from '@supabase/supabase-js';
 // const supabaseUrl = process.env.SUPABASE_URL;
 // const supabaseKey = process.env.SUPABASE_KEY;
 // if (!supabaseUrl || !supabaseKey) {
 //     throw new Error("Supabase URL or Key is not defined in environment variables.");
 // }
 // const supabase = createClient<Database>(supabaseUrl, supabaseKey); // Generic for Database
 // const toolInstanceService = new ToolInstanceService(supabase); 
