import { supabase } from '@/lib/supabase';
import { GMAIL_MCP_TOOLS } from './gmail-tools.registry';
import { MCPTool, MCPToolExecutionContext, MCPToolResult } from './gmail-tools.types';

export class GmailMCPToolsService {
  async listTools(agentId: string, userId: string): Promise<MCPTool[]> {
    try {
      const { data: permissions } = await supabase
        .from('agent_integration_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_integration_credentials(
            oauth_provider_id,
            service_providers(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('is_active', true);

      const gmailPermissions = (permissions || []).filter(
        (permission: any) =>
          permission.user_integration_credentials &&
          permission.user_integration_credentials.service_providers &&
          permission.user_integration_credentials.service_providers.name === 'gmail',
      );
      const gmailPermission = gmailPermissions.length > 0 ? gmailPermissions[0] : null;

      if (!gmailPermission) return [];

      const grantedScopes = gmailPermission.allowed_scopes || [];
      return Object.values(GMAIL_MCP_TOOLS).filter((tool) =>
        tool.required_scopes.every(
          (scope) =>
            grantedScopes.includes(scope) ||
            grantedScopes.some((grantedScope: string) => grantedScope.endsWith(scope.split('/').pop() as string)),
        ),
      );
    } catch (error) {
      console.error('Error listing Gmail tools:', error);
      return [];
    }
  }

  async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { agentId, userId, tool, parameters } = context;

    try {
      const hasPermission = await this.validatePermissions(agentId, userId, tool);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Agent does not have required permissions for this Gmail operation',
        };
      }

      switch (tool) {
        case 'send_email':
          return this.executeAndLog(agentId, userId, 'send_email', parameters, 100);
        case 'read_emails':
          return this.executeAndLog(agentId, userId, 'read_emails', parameters, 5);
        case 'search_emails':
          return this.executeAndLog(agentId, userId, 'search_emails', parameters, 5);
        case 'manage_labels':
          return this.executeAndLog(agentId, userId, 'manage_labels', parameters, 5);
        case 'email_actions':
          return this.executeAndLog(agentId, userId, 'email_actions', parameters, 5);
        default:
          return {
            success: false,
            error: `Unknown Gmail tool: ${tool}`,
          };
      }
    } catch (error) {
      console.error(`Error executing Gmail tool ${tool}:`, error);
      return {
        success: false,
        error: `Failed to execute ${tool}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async validatePermissions(agentId: string, userId: string, tool: string): Promise<boolean> {
    const toolDefinition = GMAIL_MCP_TOOLS[tool];
    if (!toolDefinition) return false;

    try {
      const { data: isValid } = await supabase.rpc('validate_agent_gmail_permissions', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_required_scopes: toolDefinition.required_scopes,
      });
      return isValid || false;
    } catch (error) {
      console.error('Error validating permissions:', error);
      return false;
    }
  }

  private async executeAndLog(
    agentId: string,
    userId: string,
    action: string,
    parameters: Record<string, any>,
    quotaConsumed: number,
  ): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action,
          agent_id: agentId,
          user_id: userId,
          parameters,
        },
      });

      if (error) throw new Error(error.message);

      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: action,
        p_operation_params: parameters,
        p_operation_result: data,
        p_status: 'success',
        p_quota_consumed: quotaConsumed,
        p_execution_time_ms: Date.now() - startTime,
      });

      return {
        success: true,
        data,
        metadata: {
          quota_consumed: quotaConsumed,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: action,
        p_operation_params: parameters,
        p_status: 'error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_execution_time_ms: Date.now() - startTime,
      });
      throw error;
    }
  }
}

export const gmailMCPTools = new GmailMCPToolsService();
