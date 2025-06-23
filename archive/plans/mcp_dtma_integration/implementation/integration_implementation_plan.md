# MCP-DTMA Integration: Implementation Plan

## 🎯 **Implementation Overview**

**Current Issue**: MCPService creates database records but doesn't actually deploy to DTMA infrastructure.  
**Solution**: Route MCP server deployment through existing ToolInstanceService → DTMA → DigitalOcean Docker containers.

## 🔧 **Specific Code Changes Required**

### **1. MCPService Integration with ToolInstanceService**

#### **Current deployServer() method**
```typescript
// Current: Only creates database record
async deployServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
  // Creates account_tool_instances record
  // Does NOT deploy to actual infrastructure
}
```

#### **Required: Integrate with ToolInstanceService**
```typescript
// New: Route through DTMA infrastructure
async deployServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
  // 1. Get admin's toolbox environment
  const adminToolbox = await this.getAdminToolboxEnvironment();
  
  // 2. Deploy via ToolInstanceService (routes to DTMA)
  const deployment = await this.toolInstanceService.deployToolToToolbox({
    userId: 'admin-user-id', // Admin deploys MCP servers
    accountToolEnvironmentId: adminToolbox.id,
    toolCatalogId: '00000000-0000-0000-0000-000000000001', // Generic MCP Server
    instanceNameOnToolbox: config.name,
    baseConfigOverrideJson: {
      dockerImage: config.dockerImage || 'default-mcp-server:latest',
      mcpTransport: config.configuration?.transport || 'stdio',
      mcpCapabilities: config.configuration?.capabilities || [],
      mcpEndpoint: config.configuration?.endpoint || '/mcp'
    }
  });
  
  // 3. Return deployment status
  return {
    id: deployment.id.toString(),
    status: 'deploying',
    progress: 0,
    message: 'MCP server deployment initiated via DTMA',
    startedAt: new Date(),
    logs: [],
    endpoints: [`http://${adminToolbox.public_ip_address}:${config.port || 8080}${config.configuration?.endpoint || '/mcp'}`]
  };
}
```

### **2. Admin vs User Role Separation**

#### **Admin MCP Management (AdminMCPService)**
```typescript
export class AdminMCPService extends MCPService {
  constructor(private toolInstanceService: ToolInstanceService) {
    super();
  }

  // Admin deploys MCP servers to shared infrastructure
  async deployMCPServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
    // Route through DTMA to deploy actual Docker container
    return await this.deployServer(config);
  }

  // Admin manages MCP server lifecycle
  async startMCPServer(serverId: string): Promise<void> {
    const adminToolbox = await this.getAdminToolboxEnvironment();
    await this.toolInstanceService.startToolOnToolbox({
      userId: 'admin-user-id',
      accountToolInstanceId: serverId,
      accountToolEnvironmentId: adminToolbox.id
    });
  }

  async stopMCPServer(serverId: string): Promise<void> {
    const adminToolbox = await this.getAdminToolboxEnvironment();
    await this.toolInstanceService.stopToolOnToolbox({
      userId: 'admin-user-id',
      accountToolInstanceId: serverId,
      accountToolEnvironmentId: adminToolbox.id
    });
  }
}
```

#### **User Agent Connection (UserMCPService)**
```typescript
export class UserMCPService {
  // Users connect agents to existing MCP servers
  async connectAgentToMCPServer(agentId: string, mcpServerId: string): Promise<AgentMCPConnection> {
    // Get MCP server instance details
    const mcpServer = await this.toolInstanceService.getToolInstanceById(mcpServerId);
    if (!mcpServer || !mcpServer.mcp_server_type) {
      throw new Error('MCP server not found or not valid');
    }

    // Create agent-MCP connection
    const { data, error } = await supabase
      .from('agent_mcp_connections')
      .insert({
        agent_id: agentId,
        mcp_server_instance_id: mcpServerId,
        connection_config: {
          endpoint: mcpServer.endpoint_url,
          transport: mcpServer.mcp_transport_type,
          capabilities: mcpServer.mcp_server_capabilities
        },
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Users can see available MCP servers (deployed by admin)
  async getAvailableMCPServers(): Promise<MCPServer[]> {
    const { data, error } = await supabase
      .from('account_tool_instances')
      .select(`
        id,
        instance_name_on_toolbox,
        status_on_toolbox,
        mcp_server_type,
        mcp_endpoint_path,
        mcp_transport_type,
        mcp_server_capabilities,
        account_tool_environment:account_tool_environments(
          public_ip_address
        )
      `)
      .not('mcp_server_type', 'is', null)
      .eq('status_on_toolbox', 'running'); // Only show running MCP servers

    if (error) throw error;
    return data.map(this.transformToMCPServer);
  }
}
```

### **3. Database Schema Addition**

#### **Agent-MCP Connections Table**
```sql
-- New table for agent-MCP connections
CREATE TABLE agent_mcp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  mcp_server_instance_id UUID REFERENCES account_tool_instances(id) ON DELETE CASCADE,
  connection_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one connection per agent-server pair
  UNIQUE(agent_id, mcp_server_instance_id)
);

-- Enable RLS
ALTER TABLE agent_mcp_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own agent connections
CREATE POLICY "agent_mcp_connections_user_policy" ON agent_mcp_connections
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );
```

## 🔄 **Integration Flow**

### **Admin Deployment Flow**
```
1. Admin Dashboard → Deploy MCP Server Form
2. AdminMCPService.deployMCPServer(config)
3. ToolInstanceService.deployToolToToolbox(options)
4. DTMA API Call → http://{toolbox_ip}:30000/tools
5. Docker Container Deployed → MCP Server Running
6. Database Updated → status_on_toolbox = 'running'
7. MCP Server Available for User Connections
```

### **User Connection Flow**
```
1. Agent Builder → Available MCP Servers List
2. UserMCPService.getAvailableMCPServers()
3. User Selects MCP Server → Connect Agent
4. UserMCPService.connectAgentToMCPServer(agentId, mcpServerId)
5. agent_mcp_connections Record Created
6. Agent Can Use MCP Tools → Direct connection to Docker container
```

## 📋 **File Modifications Required**

### **1. MCPService Updates**
- **File**: `src/lib/services/mcpService.ts`
- **Changes**: 
  - Import ToolInstanceService
  - Modify deployServer() to use ToolInstanceService
  - Add admin toolbox environment lookup
  - Update status mapping from DTMA

### **2. Admin Interface**
- **File**: `src/pages/AdminMCPMarketplaceManagement.tsx`
- **Changes**:
  - Use AdminMCPService instead of MCPService
  - Add MCP server lifecycle management (start/stop/delete)
  - Show deployment status from DTMA

### **3. User Interface**
- **File**: `src/components/agent-edit/AgentToolboxSection.tsx`
- **Changes**:
  - Add MCP server connection section
  - Use UserMCPService to show available servers
  - Add agent-MCP connection management

### **4. Database Migration**
- **File**: `supabase/migrations/YYYYMMDD_add_agent_mcp_connections.sql`
- **Changes**: Create agent_mcp_connections table

## ✅ **Success Validation**

### **Admin Validation**
```bash
# 1. Deploy MCP server via admin dashboard
# 2. Verify Docker container running on DigitalOcean
curl http://{toolbox_ip}:30000/status
# Should show MCP server container

# 3. Verify database record
SELECT * FROM account_tool_instances WHERE mcp_server_type = 'mcp_server';
```

### **User Validation**
```bash
# 1. User sees available MCP servers
# 2. User connects agent to MCP server
# 3. Agent can execute MCP tools
# 4. Connection recorded in database
SELECT * FROM agent_mcp_connections WHERE agent_id = '{agent_id}';
```

### **End-to-End Validation**
```bash
# 1. MCP server responds to tool requests
curl http://{toolbox_ip}:{mcp_port}/mcp/tools
# Should return MCP server capabilities

# 2. Agent can execute MCP tool
# Via agent interface → should successfully call MCP server
```

## 🚀 **Implementation Priority**

### **Phase 1: Core Integration** (Immediate)
1. Modify MCPService to use ToolInstanceService
2. Create AdminMCPService and UserMCPService
3. Add agent_mcp_connections table

### **Phase 2: UI Integration** (Next)
1. Update admin dashboard for MCP deployment
2. Update agent builder for MCP connections
3. Add status synchronization

### **Phase 3: Validation** (Final)
1. End-to-end testing
2. Status monitoring
3. Error handling refinement

## 🎯 **Key Integration Points**

1. **No localhost:8000** - All connections go through DTMA infrastructure
2. **Admin deploys, users connect** - Clear role separation
3. **Real Docker containers** - MCP servers run as actual containers
4. **Status synchronization** - DTMA status maps to MCP server status
5. **Existing infrastructure** - Leverages all existing DTMA capabilities 