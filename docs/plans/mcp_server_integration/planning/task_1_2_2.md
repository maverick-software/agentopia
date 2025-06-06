# Task 1.2.2 - DTMA Integration Architecture Planning

**Date:** June 5, 2025 15:30:00.00  
**Project:** MCP Server Integration  
**Task:** DTMA Integration Architecture Planning  
**Protocol:** @plan_and_execute.mdc  

## Executive Summary

This planning document establishes the comprehensive DTMA (Droplet Tool Management Agent) integration architecture for multi-MCP server container orchestration and credential injection. Based on analysis of existing DTMA capabilities showing excellent Docker container management foundation, the enhancements enable DTMA to orchestrate multiple MCP servers per toolbox with secure OAuth credential injection.

**Key Strategy:** Extend existing DTMA Docker management capabilities to support MCP-specific container orchestration, discovery protocols, and secure credential injection while maintaining backward compatibility with standard tool containers.

## Current DTMA Architecture Analysis

### ✅ **Existing DTMA Capabilities (EXCELLENT FOUNDATION)**

**1. Docker Container Management**
```typescript
// Current DTMA Docker Manager Capabilities
export async function createAndStartContainer(
  imageName: string,
  containerName: string,
  options: Dockerode.ContainerCreateOptions
): Promise<Dockerode.Container>

export async function startContainer(containerIdOrName: string): Promise<void>
export async function stopContainer(containerIdOrName: string): Promise<void>
export async function removeContainer(containerIdOrName: string, force?: boolean): Promise<void>
export async function listContainers(all?: boolean, filters?: object): Promise<Dockerode.ContainerInfo[]>
export async function inspectContainer(containerIdOrName: string): Promise<Dockerode.ContainerInspectInfo>
```

**Integration Readiness:** 🟢 **EXCELLENT**
- ✅ Complete container lifecycle management
- ✅ Port mapping and network configuration
- ✅ Environment variable injection
- ✅ Container health monitoring and inspection
- ✅ Robust error handling and logging

**2. Tool Routes and API Management**
```typescript
// Current DTMA API Endpoints
POST /tools                                    // Deploy tool instance
DELETE /tools/{instanceNameOnToolbox}          // Remove tool instance
POST /tools/{instanceNameOnToolbox}/start      // Start tool instance
POST /tools/{instanceNameOnToolbox}/stop       // Stop tool instance
GET /status                                    // Get DTMA and container status
```

**Integration Readiness:** 🟢 **EXCELLENT**
- ✅ RESTful API design for container management
- ✅ Instance tracking with managed instances map
- ✅ Comprehensive status reporting
- ✅ Authentication middleware integration
- ✅ Error handling and response formatting

**3. Authentication and Security**
```typescript
// Current DTMA Authentication
- DTMA_BEARER_TOKEN for toolbox authentication
- BACKEND_TO_DTMA_API_KEY for backend communication
- Secure credential fetching from Agentopia backend
- Agent-specific container isolation
```

**Integration Readiness:** 🟢 **EXCELLENT**
- ✅ Multi-layered authentication system
- ✅ Secure communication with Agentopia backend
- ✅ Container-level security isolation
- ✅ Environment variable security practices

**4. Heartbeat and Health Monitoring**
```typescript
// Current DTMA Health System
async function sendHeartbeat() {
  // Regular health reporting to Agentopia backend
  // Container status and system metrics
  // Tool instance status aggregation
}
```

**Integration Readiness:** 🟢 **EXCELLENT**
- ✅ Regular health monitoring and reporting
- ✅ System resource tracking
- ✅ Container status aggregation
- ✅ Error state detection and reporting

## DTMA Enhancement Strategy for Multi-MCP Support

### 🎯 **Phase 1: MCP Container Type Support**

**1.1 Enhanced Container Detection and Classification**
```typescript
// NEW: MCP Container Type Detection
interface MCPContainerInfo extends Dockerode.ContainerInfo {
  mcpServerType?: 'standard_tool' | 'mcp_server';
  mcpTransportType?: 'stdio' | 'sse' | 'websocket';
  mcpEndpointPath?: string;
  mcpCapabilities?: MCPServerCapabilities;
}

async function classifyContainer(container: Dockerode.ContainerInfo): Promise<MCPContainerInfo> {
  // Enhanced container inspection
  // MCP server type detection via labels or environment variables
  // Transport type identification
  // Capability discovery
}
```

**1.2 MCP-Specific Container Orchestration**
```typescript
// NEW: MCP Server Deployment API
interface MCPServerDeploymentRequest {
  dockerImageUrl: string;
  instanceNameOnToolbox: string;
  accountToolInstanceId: string;
  mcpServerType: 'mcp_server';
  mcpTransportType: 'stdio' | 'sse' | 'websocket';
  mcpEndpointPath?: string;
  oauthConnectionIds?: string[]; // OAuth connections to inject
  baseConfigOverrideJson?: object;
}

router.post('/mcp-servers', async (req: Request, res: Response) => {
  // Enhanced deployment for MCP servers
  // OAuth credential injection
  // MCP-specific port configuration
  // Transport-specific container setup
});
```

### 🔐 **Phase 2: OAuth Credential Injection System**

**2.1 Secure Credential Fetching Enhancement**
```typescript
// ENHANCED: OAuth Credential Management
interface OAuthCredentialRequest {
  agentId: string;
  accountToolInstanceId: string;
  oauthConnectionIds: string[];
  requiredScopes: string[];
}

async function fetchOAuthCredentials(request: OAuthCredentialRequest): Promise<OAuthCredentials> {
  // Enhanced credential fetching from Agentopia backend
  // Multi-provider credential aggregation
  // Scope validation and filtering
  // Token refresh handling
}

async function injectOAuthCredentials(
  containerName: string, 
  credentials: OAuthCredentials
): Promise<void> {
  // Secure credential injection into MCP server containers
  // Environment variable based injection
  // Temporary credential mounting
  // Zero-persistence security model
}
```

**2.2 MCP Server OAuth Integration**
```typescript
// NEW: MCP Server OAuth Configuration
interface MCPServerOAuthConfig {
  instanceName: string;
  requiredProviders: OAuthProviderConfig[];
  credentialInjectionMethod: 'env_vars' | 'mounted_secrets' | 'runtime_api';
  refreshStrategy: 'on_expiry' | 'periodic' | 'on_demand';
}

async function configureMCPServerOAuth(
  config: MCPServerOAuthConfig
): Promise<void> {
  // OAuth provider configuration for MCP servers
  // Credential refresh automation
  // Access scope management
  // Security compliance validation
}
```

### 📡 **Phase 3: MCP Discovery and Communication**

**3.1 MCP Server Discovery Enhancement**
```typescript
// NEW: MCP Server Discovery System
interface MCPServerDiscoveryInfo {
  instanceId: string;
  endpointUrl: string;
  transportType: 'stdio' | 'sse' | 'websocket';
  capabilities: MCPServerCapabilities;
  healthStatus: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
  lastHealthCheck: Date;
}

async function discoverMCPServers(): Promise<MCPServerDiscoveryInfo[]> {
  // Automatic MCP server discovery on toolbox
  // Transport protocol detection
  // Capability enumeration
  // Health status aggregation
}

router.get('/mcp-servers/discovery', async (req: Request, res: Response) => {
  // MCP server discovery endpoint for Agentopia backend
  // Real-time server enumeration
  // Capability reporting
  // Health status aggregation
});
```

**3.2 MCP Server Health Monitoring Enhancement**
```typescript
// ENHANCED: MCP-Specific Health Monitoring
interface MCPHealthMetrics {
  serverReachable: boolean;
  responseTimeMs: number;
  capabilitiesCount: number;
  activeConnections: number;
  oauthConnectionsValid: boolean;
  lastCapabilityRefresh: Date;
}

async function monitorMCPServerHealth(instanceName: string): Promise<MCPHealthMetrics> {
  // MCP-specific health checking
  // Transport protocol health validation
  // OAuth credential validation
  // Capability endpoint testing
}
```

## Enhanced DTMA API Specification

### 🔄 **Enhanced Existing Endpoints**

**1. Enhanced POST /tools - Multi-MCP Deployment**
```typescript
interface EnhancedToolDeploymentRequest {
  // Existing fields
  dockerImageUrl: string;
  instanceNameOnToolbox: string;
  accountToolInstanceId: string;
  baseConfigOverrideJson?: object;
  
  // NEW: MCP-specific fields
  mcpServerType?: 'standard_tool' | 'mcp_server';
  mcpTransportType?: 'stdio' | 'sse' | 'websocket';
  mcpEndpointPath?: string;
  oauthConnectionIds?: string[];
  mcpCapabilityFilters?: string[];
}
```

**2. Enhanced GET /status - MCP Server Aggregation**
```typescript
interface EnhancedDTMAStatus {
  // Existing fields
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  service: 'DTMA';
  
  // ENHANCED: Multi-container categorization
  tool_instances: {
    standard_tools: StandardToolInstance[];
    mcp_servers: MCPServerInstance[];
  };
  
  // NEW: MCP-specific metrics
  mcp_discovery: {
    total_servers: number;
    healthy_servers: number;
    transport_distribution: Record<string, number>;
    oauth_connections_valid: number;
  };
}
```

### 🆕 **New MCP-Specific Endpoints**

**1. POST /mcp-servers - MCP Server Deployment**
```typescript
router.post('/mcp-servers', async (req: Request, res: Response) => {
  const {
    dockerImageUrl,
    instanceNameOnToolbox,
    accountToolInstanceId,
    mcpTransportType,
    mcpEndpointPath,
    oauthConnectionIds,
    baseConfigOverrideJson
  } = req.body;

  try {
    // 1. Fetch OAuth credentials for required connections
    const oauthCredentials = await fetchOAuthCredentials({
      agentId: req.headers['x-agent-id'],
      accountToolInstanceId,
      oauthConnectionIds: oauthConnectionIds || [],
      requiredScopes: [] // Will be determined by MCP server requirements
    });

    // 2. Configure MCP-specific container options
    const mcpContainerOptions = {
      name: instanceNameOnToolbox,
      Image: dockerImageUrl,
      Env: [
        ...buildOAuthEnvironmentVariables(oauthCredentials),
        `MCP_TRANSPORT_TYPE=${mcpTransportType}`,
        `MCP_ENDPOINT_PATH=${mcpEndpointPath || '/mcp'}`,
        ...Object.entries(baseConfigOverrideJson || {}).map(([k, v]) => `${k}=${v}`)
      ],
      HostConfig: {
        PortBindings: generateMCPPortBindings(mcpTransportType),
        RestartPolicy: { Name: 'unless-stopped' }
      },
      Labels: {
        'agentopia.tool.type': 'mcp_server',
        'agentopia.mcp.transport': mcpTransportType,
        'agentopia.mcp.endpoint': mcpEndpointPath || '/mcp',
        'agentopia.account_tool_instance_id': accountToolInstanceId
      }
    };

    // 3. Deploy MCP server container
    const container = await createAndStartContainer(
      dockerImageUrl,
      instanceNameOnToolbox,
      mcpContainerOptions
    );

    // 4. Wait for MCP server to initialize and discover capabilities
    await waitForMCPServerInitialization(instanceNameOnToolbox, mcpTransportType);
    const capabilities = await discoverMCPServerCapabilities(instanceNameOnToolbox);

    // 5. Register managed instance with MCP metadata
    managedInstances.set(instanceNameOnToolbox, {
      accountToolInstanceId,
      dockerImageUrl,
      containerType: 'mcp_server',
      mcpTransportType,
      mcpEndpointPath: mcpEndpointPath || '/mcp',
      mcpCapabilities: capabilities,
      oauthConnectionIds: oauthConnectionIds || [],
      creationPortBindings: mcpContainerOptions.HostConfig.PortBindings
    });

    res.status(200).json({
      success: true,
      message: `MCP server '${instanceNameOnToolbox}' deployed successfully.`,
      data: {
        instanceName: instanceNameOnToolbox,
        containerId: container.id,
        transportType: mcpTransportType,
        endpointPath: mcpEndpointPath || '/mcp',
        capabilities: capabilities,
        oauthConnections: oauthConnectionIds?.length || 0
      }
    });

  } catch (error: any) {
    console.error(`Failed to deploy MCP server '${instanceNameOnToolbox}':`, error.message);
    res.status(500).json({
      success: false,
      message: `Failed to deploy MCP server '${instanceNameOnToolbox}'.`,
      error: error.message
    });
  }
});
```

**2. GET /mcp-servers/discovery - MCP Server Discovery**
```typescript
router.get('/mcp-servers/discovery', async (req: Request, res: Response) => {
  try {
    // 1. List all MCP server containers
    const allContainers = await listContainers(true);
    const mcpContainers = allContainers.filter(container => 
      container.Labels?.['agentopia.tool.type'] === 'mcp_server'
    );

    // 2. Gather discovery information for each MCP server
    const discoveryInfo = await Promise.all(
      mcpContainers.map(async (container) => {
        const instanceName = container.Names[0]?.substring(1) || container.Id;
        const managedInstance = managedInstances.get(instanceName);
        
        // 3. Perform health check and capability discovery
        const healthMetrics = await monitorMCPServerHealth(instanceName);
        const currentCapabilities = await discoverMCPServerCapabilities(instanceName);

        return {
          instanceId: managedInstance?.accountToolInstanceId || null,
          instanceName,
          containerId: container.Id,
          endpointUrl: buildMCPEndpointUrl(container, managedInstance),
          transportType: managedInstance?.mcpTransportType || 'unknown',
          capabilities: currentCapabilities,
          healthStatus: determineHealthStatus(healthMetrics),
          healthMetrics,
          oauthConnections: managedInstance?.oauthConnectionIds?.length || 0,
          lastHealthCheck: new Date().toISOString()
        };
      })
    );

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      mcp_servers: discoveryInfo,
      summary: {
        total_servers: discoveryInfo.length,
        healthy_servers: discoveryInfo.filter(s => s.healthStatus === 'healthy').length,
        transport_distribution: discoveryInfo.reduce((acc, s) => {
          acc[s.transportType] = (acc[s.transportType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error: any) {
    console.error('Failed to discover MCP servers:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to discover MCP servers.',
      error: error.message
    });
  }
});
```

**3. POST /mcp-servers/{instanceName}/oauth/refresh - OAuth Token Refresh**
```typescript
router.post('/mcp-servers/:instanceName/oauth/refresh', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { oauthConnectionIds } = req.body;

  try {
    const managedInstance = managedInstances.get(instanceName);
    if (!managedInstance || managedInstance.containerType !== 'mcp_server') {
      return res.status(404).json({
        success: false,
        error: `MCP server '${instanceName}' not found.`
      });
    }

    // 1. Fetch refreshed OAuth credentials
    const refreshedCredentials = await fetchOAuthCredentials({
      agentId: req.headers['x-agent-id'] as string,
      accountToolInstanceId: managedInstance.accountToolInstanceId,
      oauthConnectionIds: oauthConnectionIds || managedInstance.oauthConnectionIds,
      requiredScopes: [] // Will be determined by MCP server requirements
    });

    // 2. Inject refreshed credentials into running container
    await injectOAuthCredentials(instanceName, refreshedCredentials);

    // 3. Verify MCP server can still function with refreshed credentials
    const healthCheck = await monitorMCPServerHealth(instanceName);

    res.status(200).json({
      success: true,
      message: `OAuth credentials refreshed for MCP server '${instanceName}'.`,
      data: {
        connectionsRefreshed: oauthConnectionIds?.length || managedInstance.oauthConnectionIds.length,
        healthStatus: determineHealthStatus(healthCheck),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error(`Failed to refresh OAuth credentials for '${instanceName}':`, error.message);
    res.status(500).json({
      success: false,
      message: `Failed to refresh OAuth credentials for '${instanceName}'.`,
      error: error.message
    });
  }
});
```

## Implementation Strategy

### 🎯 **Phase 1: Core MCP Support (Week 1)**

**1.1 Enhanced Docker Manager Module**
```typescript
// File: dtma/src/mcp_docker_manager.ts
export interface MCPContainerOptions extends Dockerode.ContainerCreateOptions {
  mcpServerType: 'mcp_server';
  mcpTransportType: 'stdio' | 'sse' | 'websocket';
  mcpEndpointPath: string;
  oauthCredentials?: OAuthCredentials;
}

export async function createMCPContainer(
  imageName: string,
  containerName: string,
  options: MCPContainerOptions
): Promise<Dockerode.Container> {
  // MCP-specific container creation logic
  // OAuth credential injection
  // Transport-specific configuration
  // MCP labeling and metadata
}

export async function discoverMCPCapabilities(
  containerName: string
): Promise<MCPServerCapabilities> {
  // Capability discovery via MCP protocol
  // Transport-agnostic capability enumeration
  // Error handling for unresponsive servers
}
```

**1.2 Enhanced Managed Instances Tracking**
```typescript
// File: dtma/src/managed_instances.ts
interface MCPManagedInstance extends ManagedToolInstance {
  containerType: 'standard_tool' | 'mcp_server';
  mcpTransportType?: 'stdio' | 'sse' | 'websocket';
  mcpEndpointPath?: string;
  mcpCapabilities?: MCPServerCapabilities;
  oauthConnectionIds: string[];
  lastCapabilityRefresh?: Date;
  lastOAuthRefresh?: Date;
}

export const managedInstances = new Map<string, MCPManagedInstance>();
```

### 🔐 **Phase 2: OAuth Integration (Week 2)**

**2.1 OAuth Credential Manager Module**
```typescript
// File: dtma/src/oauth_credential_manager.ts
export interface OAuthCredentials {
  [providerId: string]: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes: string[];
  };
}

export async function fetchOAuthCredentials(
  request: OAuthCredentialRequest
): Promise<OAuthCredentials> {
  // Enhanced backend API call for OAuth credentials
  // Multi-provider credential aggregation
  // Token validation and refresh logic
}

export async function injectOAuthCredentials(
  containerName: string,
  credentials: OAuthCredentials
): Promise<void> {
  // Secure credential injection methods
  // Environment variable updates
  // Container restart if required
  // Zero-persistence security validation
}
```

**2.2 Enhanced Agentopia API Client**
```typescript
// File: dtma/src/agentopia_api_client.ts
export async function getOAuthCredentials(
  agentId: string,
  accountToolInstanceId: string,
  oauthConnectionIds: string[]
): Promise<OAuthCredentials> {
  // Enhanced API call to Agentopia backend
  // OAuth credential fetching
  // Error handling and retry logic
}

export async function reportMCPServerHealth(
  mcpServers: MCPServerDiscoveryInfo[]
): Promise<void> {
  // Enhanced heartbeat with MCP server health
  // Capability reporting
  // OAuth connection status
}
```

### 📡 **Phase 3: Discovery and Monitoring (Week 3)**

**3.1 MCP Discovery Engine**
```typescript
// File: dtma/src/mcp_discovery_engine.ts
export class MCPDiscoveryEngine {
  private discoveryInterval: NodeJS.Timeout;
  private healthCheckInterval: NodeJS.Timeout;

  async startDiscovery(): Promise<void> {
    // Periodic MCP server discovery
    // Capability refresh automation
    // Health monitoring coordination
  }

  async discoverAllMCPServers(): Promise<MCPServerDiscoveryInfo[]> {
    // Container enumeration and classification
    // MCP protocol capability discovery
    // Health status aggregation
  }

  async monitorMCPServerHealth(instanceName: string): Promise<MCPHealthMetrics> {
    // Transport-specific health checking
    // OAuth credential validation
    // Capability endpoint testing
  }
}
```

## Backward Compatibility Strategy

### ✅ **Zero Breaking Changes**

**1. Existing Tool Deployment Unchanged**
```typescript
// EXISTING: Standard tool deployment continues working
POST /tools
{
  "dockerImageUrl": "nginx:latest",
  "instanceNameOnToolbox": "my-web-server",
  "accountToolInstanceId": "uuid-123"
}
// → Deployed as standard_tool (default behavior)
```

**2. Enhanced Tool Deployment Detects MCP Servers**
```typescript
// NEW: MCP server deployment via enhanced endpoint
POST /tools
{
  "dockerImageUrl": "ghcr.io/anthropic/mcp-server-github:latest",
  "instanceNameOnToolbox": "github-mcp-server",
  "accountToolInstanceId": "uuid-456",
  "mcpServerType": "mcp_server",
  "mcpTransportType": "sse",
  "oauthConnectionIds": ["github-connection-uuid"]
}
// → Deployed as mcp_server with OAuth injection
```

**3. Status Endpoint Backwards Compatible**
```typescript
// EXISTING: Status response maintains existing structure
// NEW: Additional MCP-specific fields added without breaking existing consumers
{
  "status": "healthy",                    // ← Existing field
  "timestamp": "2025-06-05T15:30:00Z",   // ← Existing field
  "tool_instances": [...],                // ← Existing field (enhanced)
  "mcp_discovery": {...}                  // ← NEW field (additive)
}
```

## Performance Considerations

### 📊 **MCP-Specific Optimizations**

**1. Discovery Caching Strategy**
```typescript
interface MCPDiscoveryCache {
  lastDiscovery: Date;
  cachedServers: MCPServerDiscoveryInfo[];
  capabilityCache: Map<string, { capabilities: MCPServerCapabilities; timestamp: Date }>;
}

// Cache MCP server capabilities to avoid repeated discovery calls
// Intelligent refresh based on server health and change detection
// Background capability refresh without blocking discovery requests
```

**2. OAuth Credential Caching**
```typescript
interface OAuthCredentialCache {
  [instanceName: string]: {
    credentials: OAuthCredentials;
    lastRefresh: Date;
    nextRefresh: Date;
  };
}

// Proactive OAuth credential refresh before expiration
// Shared credential caching for MCP servers using same OAuth connections
// Minimal credential injection frequency to reduce container restarts
```

**3. Health Monitoring Optimization**
```typescript
// Staggered health checks to avoid overwhelming MCP servers
// Transport-specific health check optimization (stdio vs SSE vs WebSocket)
// Intelligent health check frequency based on server stability
// Background health monitoring without blocking API responses
```

## Success Metrics

### ✅ **DTMA Enhancement Success Criteria**

**1. Multi-MCP Orchestration:**
- ✅ Deploy 5-10 MCP servers per toolbox concurrently
- ✅ Transport-agnostic MCP server support (stdio, SSE, WebSocket)
- ✅ Zero downtime MCP server deployment and removal
- ✅ Automatic MCP server capability discovery < 5 seconds

**2. OAuth Integration:**
- ✅ Secure OAuth credential injection for all supported providers
- ✅ Proactive credential refresh with < 1% failure rate
- ✅ Zero credential persistence on droplet filesystem
- ✅ OAuth connection validation and error reporting

**3. Performance Targets:**
- ✅ MCP server discovery response < 200ms
- ✅ OAuth credential injection < 3 seconds
- ✅ Health monitoring overhead < 5% CPU utilization
- ✅ Container startup time < 10 seconds for MCP servers

**4. Backward Compatibility:**
- ✅ 100% existing standard tool deployment compatibility
- ✅ No breaking changes to existing DTMA API endpoints
- ✅ Graceful degradation for non-MCP containers
- ✅ Zero impact on existing agent-droplet relationships

## Conclusion

This DTMA integration architecture provides:

🔧 **Seamless Extension:** Builds upon existing robust Docker management capabilities
🔐 **Enterprise Security:** Comprehensive OAuth credential injection with zero persistence
🚀 **Multi-MCP Orchestration:** Support for 5-10 MCP servers per toolbox with discovery
⚡ **Optimal Performance:** Intelligent caching and background processing
🛡️ **Zero Breaking Changes:** Complete backward compatibility with existing deployments

The architecture positions DTMA as the definitive container orchestration platform for autonomous agent toolbox environments with revolutionary multi-MCP capabilities.
