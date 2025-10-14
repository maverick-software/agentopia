# Toolbox System Archive

**Archive Date:** October 13, 2025 12:56 PM
**Reason:** Deprecated toolbox/droplet MCP deployment system cleanup

## System Overview

The toolbox system was a DigitalOcean-based infrastructure for deploying MCP servers on user-owned droplets. It has been replaced by the internal MCP system which handles MCP connections directly without needing separate droplet deployments.

## Edge Functions Archived

1. **toolbox-tools/** - Managing tool instances on toolboxes
2. **agent-toolbelt/** - Managing agent toolbelt configurations
3. **mcp-template-manager/** - MCP server template management
4. **mcp-server-manager/** - MCP server lifecycle management on droplets
5. **get-agent-tool-credentials/** - Retrieving agent-specific tool credentials

## Database Tables Removed

- `tool_catalog` - Catalog of deployable tools
- `account_tool_environments` - User-owned DigitalOcean droplets (toolboxes)
- `account_tool_instances` - Tool instances running on toolboxes
- `agent_toolbox_access` - Agent access to toolboxes
- `agent_toolbelt_items` - Agent-specific tool configurations
- `agent_tool_credentials` - Agent-specific credentials for tools
- `agent_tool_capability_permissions` - Granular tool permissions per agent
- `user_ssh_keys` - SSH keys for droplet access

## Migration Path

**Old System:**
- Users provision DigitalOcean droplets (toolboxes)
- Deploy MCP servers as Docker containers on droplets
- Agents connect to MCP servers via toolbelt configuration
- Complex credential and permission management

**New System:**
- Direct MCP connections via `agent_mcp_connections` table
- No droplet provisioning needed
- Simpler architecture using universal MCP protocol
- MCP servers can be hosted anywhere (not just on user droplets)

## Related Migration

- `20251013183600_drop_toolbox_system.sql` - Comprehensive toolbox system removal

## Restoration

If needed, these edge functions and tables can be restored from this archive, but the new MCP system would need to be disabled and the infrastructure refactored to support the droplet-based deployment model again.

