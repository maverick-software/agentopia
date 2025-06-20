# API Design Planning - Phase 2.2

**Task**: API Design Planning  
**Date**: 2025-06-03  
**Dependencies**: Phase 2.1 ✅  
**Associated Files**: Technical architecture, existing API patterns analysis

## Mini-Plan for Phase 2.2

### Planning Objectives
1. Design comprehensive API contracts for SSH key integration
2. Define data structures and request/response schemas
3. Plan error handling patterns and status codes
4. Design security and authentication flows
5. Create API documentation specifications

### Comprehensive API Design

#### Research Summary: Existing API Patterns

**From Codebase Analysis**:
- ✅ Edge functions use standard CORS headers and proper error responses
- ✅ Internal API pattern: Edge Function → Node Backend with secret validation
- ✅ User authentication via Supabase JWT tokens in Authorization header
- ✅ Agent ownership validation using service role client
- ✅ Consistent JSON request/response patterns with proper status codes
- ✅ Internal API secret validation via `X-Internal-Api-Secret` header

**Current API Architecture Pattern**:
```
Frontend → Supabase Edge Function → Node.js Backend → DigitalOcean API
          (JWT Auth)              (Internal Secret)    (API Token)
```

#### Enhanced API Design for SSH Key Integration

**Design Principles**:
1. **RESTful Design**: Use nouns for resources, HTTP methods for actions
2. **Backward Compatibility**: Enhance existing endpoints without breaking changes
3. **Security First**: Validate authentication and authorization at every layer
4. **Error Transparency**: Provide clear, actionable error messages
5. **Performance Optimized**: Design for caching and minimal latency impact

#### 1. Enhanced Edge Function API

**Enhanced Endpoint**: `supabase/functions/manage-agent-tool-environment/index.ts`

**Current Signature**:
```typescript
POST /functions/v1/manage-agent-tool-environment/{agentId}
DELETE /functions/v1/manage-agent-tool-environment/{agentId}
```

**Enhanced API Contract**:

```typescript
// === REQUEST CONTRACTS ===

interface ManageToolEnvironmentRequest {
  // No body parameters required - agentId in path, userId from JWT
}

// === RESPONSE CONTRACTS ===

interface ToolEnvironmentResponse {
  success: boolean;
  message: string;
  data?: {
    agent_id: string;
    droplet_id: string | null;
    status: 'active' | 'provisioning' | 'error' | 'inactive';
    ip_address: string | null;
    ssh_keys_configured?: boolean;  // NEW: SSH key status
    ssh_key_count?: number;         // NEW: Number of SSH keys
  };
  error?: string;
}

// === ENHANCED IMPLEMENTATION ===

async function callInternalNodeService(
  agentId: string, 
  userId: string,  // NEW: User context
  method: 'POST' | 'DELETE'
): Promise<ServiceResponse>

// Enhanced API calls with user context
const internalEndpoint = method === 'POST' 
  ? `${NODE_BACKEND_URL}/internal/agents/${agentId}/ensure-tool-environment` 
  : `${NODE_BACKEND_URL}/internal/agents/${agentId}/tool-environment`;

// Enhanced request body with user context
const requestBody = { userId: userId };

const response = await fetch(internalEndpoint, {
  method: method,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Api-Secret': INTERNAL_API_SECRET,
  },
  body: JSON.stringify(requestBody)  // NEW: User context in body
});
```

**Enhanced CORS and Error Handling**:

```typescript
// Enhanced CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Enhanced error responses with SSH key context
interface APIError {
  error: string;
  details?: {
    ssh_key_status?: 'missing' | 'invalid' | 'failed';
    user_context?: 'missing' | 'invalid';
    suggested_action?: string;
  };
  timestamp: string;
  request_id?: string;
}
```

#### 2. Enhanced Backend Internal API

**Enhanced Endpoints**: `src/services/internal_api/agentEnvironmentEndpoints.ts`

**Current Signatures**:
```typescript
POST /internal/agents/{agentId}/ensure-tool-environment
DELETE /internal/agents/{agentId}/tool-environment
```

**Enhanced API Contracts**:

```typescript
// === REQUEST CONTRACTS ===

interface EnsureToolEnvironmentRequest {
  userId: string;  // NEW: User context for SSH key integration
}

interface DeprovisionEnvironmentRequest {
  userId: string;  // NEW: User context for cleanup
}

// === RESPONSE CONTRACTS ===

interface ToolEnvironmentInternalResponse {
  success: boolean;
  message: string;
  data?: {
    agent_id: string;
    droplet_id: string;
    status: string;
    ip_address: string | null;
    ssh_integration?: {              // NEW: SSH integration status
      user_ssh_keys_configured: boolean;
      ssh_key_ids: string[];
      digitalocean_ssh_keys: string[];
      integration_time_ms: number;
    };
  };
  error?: string;
}

// === ENHANCED ENDPOINT IMPLEMENTATIONS ===

router.post('/agents/:agentId/ensure-tool-environment', 
  checkInternalApiSecret, 
  async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const { userId } = req.body;  // NEW: Extract user context
    
    if (!agentId || !userId) {
      return res.status(400).json({ 
        error: 'Agent ID and User ID are required.',
        details: { missing_fields: !agentId ? ['agentId'] : ['userId'] }
      });
    }
    
    try {
      console.log(`[Internal API] Ensuring tool environment for agent: ${agentId}, user: ${userId}`);
      
      const dropletRecord = await ensureToolEnvironmentReady(agentId, userId);  // NEW: Pass userId
      
      if (dropletRecord) {
        res.status(200).json({ 
          success: true, 
          message: `Tool environment for agent ${agentId} is now ${dropletRecord.status}.`,
          data: {
            agent_id: dropletRecord.agent_id,
            droplet_id: dropletRecord.do_droplet_id,
            status: dropletRecord.status,
            ip_address: dropletRecord.ip_address,
            ssh_integration: dropletRecord.ssh_integration  // NEW: SSH integration details
          }
        });
      } else {
        res.status(200).json({ 
          success: true, 
          message: 'Tool environment checked, no action needed.',
          data: null 
        });
      }
    } catch (error: any) {
      console.error(`[Internal API] Error ensuring tool environment:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to ensure tool environment.',
        details: { component: 'agent_environment_service' }
      });
    }
  }
);
```

#### 3. SSH Key Service API Design

**New Service**: `src/services/ssh_key_service.ts` (Enhanced)

```typescript
// === SSH KEY SERVICE API CONTRACTS ===

// Input interfaces
interface GenerateSSHKeyRequest {
  userId: string;
  keyName?: string;
  keyType?: 'rsa' | 'ed25519';
  keySize?: 2048 | 4096;
}

interface CreateDigitalOceanSSHKeyRequest {
  userId: string;
  publicKey: string;
  keyName: string;
}

interface GetUserSSHKeysRequest {
  userId: string;
  includePrivateKeys?: boolean;
}

// Response interfaces
interface SSHKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  keyType: string;
}

interface UserSSHKey {
  id: string;
  user_id: string;
  public_key_vault_id: string;
  private_key_vault_id?: string;
  key_name: string;
  fingerprint: string;
  digitalocean_key_id?: string;
  created_at: string;
  updated_at: string;
}

interface SSHKeyStorageResult {
  keyId: string;
  fingerprint: string;
  vaultIds: {
    publicKey: string;
    privateKey: string;
  };
}

interface DeploymentSSHKeysResult {
  ssh_key_ids: string[];
  integration_time_ms: number;
  cache_hit: boolean;
}

// === SERVICE API METHODS ===

class SSHKeyService {
  // === Existing Methods (Enhanced) ===
  static async generateSSHKeyPair(request: GenerateSSHKeyRequest): Promise<SSHKeyPair>
  static async storeUserSSHKey(userId: string, keyPair: SSHKeyPair, keyName: string): Promise<SSHKeyStorageResult>
  static async getUserSSHKeys(request: GetUserSSHKeysRequest): Promise<UserSSHKey[]>
  static async deleteUserSSHKey(userId: string, keyId: string): Promise<boolean>
  static async getSSHKeyByFingerprint(userId: string, fingerprint: string): Promise<UserSSHKey | null>

  // === New Methods for Deployment Integration ===
  static async ensureUserHasSSHKeys(userId: string): Promise<UserSSHKey[]>
  static async getDeploymentSSHKeys(userId: string): Promise<DeploymentSSHKeysResult>
  static async createDigitalOceanSSHKey(request: CreateDigitalOceanSSHKeyRequest): Promise<string>
  
  // === Performance & Caching Methods ===
  static async getDeploymentSSHKeysWithCache(userId: string): Promise<DeploymentSSHKeysResult>
  static invalidateSSHKeyCache(userId: string): void
}
```

#### 4. User Onboarding Service API Design

**New Service**: `src/services/user_onboarding_service.ts`

```typescript
// === USER ONBOARDING SERVICE API CONTRACTS ===

// Input interfaces
interface InitializeUserRequest {
  userId: string;
  userEmail: string;
  generateSSHKeys?: boolean;
}

interface BackgroundKeyGenerationRequest {
  userId: string;
  priority?: 'high' | 'normal' | 'low';
}

// Response interfaces
interface KeyGenerationStatus {
  userId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress_percentage: number;
  estimated_completion_time?: string;
  error_message?: string;
}

interface UserOnboardingResult {
  userId: string;
  onboarding_completed: boolean;
  ssh_keys_ready: boolean;
  services_initialized: string[];
  next_steps?: string[];
}

// === SERVICE API METHODS ===

class UserOnboardingService {
  // === Async SSH Key Generation ===
  static async initializeUserSSHKeys(request: InitializeUserRequest): Promise<UserOnboardingResult>
  static async scheduleBackgroundKeyGeneration(request: BackgroundKeyGenerationRequest): Promise<void>
  static async checkKeyGenerationStatus(userId: string): Promise<KeyGenerationStatus>
  
  // === Integration with User Registration ===
  static async enhancedUserRegistration(userData: UserRegistrationData): Promise<UserOnboardingResult>
  static async handleFirstTimeDeployment(userId: string): Promise<boolean>
}
```

#### 5. SSH Integration Service API Design

**New Service**: `src/services/agent_environment_service/ssh_integration.ts`

```typescript
// === SSH INTEGRATION SERVICE API CONTRACTS ===

// Input interfaces
interface PrepareSSHKeysRequest {
  userId: string;
  agentId: string;
  includeCache?: boolean;
}

interface InjectSSHKeysRequest {
  userId: string;
  config: InternalDropletProvisionConfig;
}

interface DigitalOceanSSHKeyRequest {
  userId: string;
  validateExisting?: boolean;
}

// Response interfaces
interface SSHKeyPreparationResult {
  ssh_key_ids: string[];
  preparation_time_ms: number;
  cache_used: boolean;
  new_keys_created: number;
}

interface DropletConfigWithSSH extends InternalDropletProvisionConfig {
  ssh_key_ids: string[];
  ssh_integration_metadata: {
    user_id: string;
    integration_time: string;
    key_count: number;
  };
}

interface DigitalOceanRegistrationResult {
  registered_key_ids: string[];
  skipped_existing: string[];
  registration_time_ms: number;
  errors?: string[];
}

// === SERVICE API METHODS ===

class SSHKeyIntegrationService {
  // === Deployment Integration ===
  static async prepareSSHKeysForDeployment(request: PrepareSSHKeysRequest): Promise<SSHKeyPreparationResult>
  static async injectSSHKeysIntoConfig(request: InjectSSHKeysRequest): Promise<DropletConfigWithSSH>
  
  // === DigitalOcean Integration ===
  static async ensureDigitalOceanSSHKeys(request: DigitalOceanSSHKeyRequest): Promise<DigitalOceanRegistrationResult>
  static async registerSSHKeyWithDigitalOcean(publicKey: string, keyName: string): Promise<string>
  
  // === Performance Optimization ===
  static async performanceOptimizedKeyRetrieval(userId: string): Promise<SSHKeyPreparationResult>
}
```

#### 6. Frontend API Integration Design

**Enhanced React Hooks**: `src/hooks/useSSHKeys.ts`

```typescript
// === FRONTEND API INTEGRATION CONTRACTS ===

// Hook interfaces
interface UseSSHKeysOptions {
  userId: string;
  autoFetch?: boolean;
  cacheTime?: number;
}

interface UseUserOnboardingOptions {
  userId: string;
  pollInterval?: number;
}

// Hook response interfaces
interface SSHKeysHookResult {
  sshKeys: UserSSHKey[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  generateNewKey: (keyName?: string) => Promise<void>;
  deleteKey: (keyId: string) => Promise<void>;
}

interface UserOnboardingHookResult {
  onboardingStatus: KeyGenerationStatus | null;
  isOnboardingComplete: boolean;
  loading: boolean;
  error: string | null;
  startOnboarding: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

// === REACT HOOKS API ===

export function useSSHKeys(options: UseSSHKeysOptions): SSHKeysHookResult
export function useUserOnboarding(options: UseUserOnboardingOptions): UserOnboardingHookResult
```

### Error Handling Strategy

#### Standardized Error Response Format

```typescript
interface APIErrorResponse {
  error: string;
  error_code: string;
  details?: {
    field_errors?: Record<string, string[]>;
    validation_errors?: string[];
    component: string;
    operation: string;
  };
  timestamp: string;
  request_id: string;
  suggested_actions?: string[];
}
```

#### HTTP Status Code Strategy

```typescript
// === SUCCESS RESPONSES ===
200: 'OK'              // Successful GET, PUT, PATCH
201: 'Created'         // Successful POST (resource created)
202: 'Accepted'        // Async operation started
204: 'No Content'      // Successful DELETE

// === CLIENT ERROR RESPONSES ===
400: 'Bad Request'     // Invalid request format or missing required fields
401: 'Unauthorized'    // Missing or invalid authentication
403: 'Forbidden'       // User lacks permission for this resource
404: 'Not Found'       // Resource doesn't exist
409: 'Conflict'        // Resource already exists or state conflict
422: 'Unprocessable Entity'  // Valid format but business logic errors

// === SERVER ERROR RESPONSES ===
500: 'Internal Server Error'  // Unexpected server error
502: 'Bad Gateway'            // External service (DigitalOcean API) error
503: 'Service Unavailable'    // Temporary service overload
504: 'Gateway Timeout'        // External service timeout
```

#### Error Handling Patterns

```typescript
// === EDGE FUNCTION ERROR HANDLING ===

try {
  const result = await callInternalNodeService(agentId, userId, method);
  
  if (!result.success) {
    return new Response(JSON.stringify({
      error: result.error,
      error_code: 'INTERNAL_SERVICE_ERROR',
      details: {
        component: 'manage_agent_tool_environment',
        operation: method === 'POST' ? 'ensure_environment' : 'deprovision_environment'
      },
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID(),
      suggested_actions: ['Check agent exists', 'Verify user permissions', 'Retry after 30 seconds']
    } as APIErrorResponse), {
      status: result.status || 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
  
} catch (error: any) {
  console.error('Unexpected error in manage-agent-tool-environment:', error);
  
  return new Response(JSON.stringify({
    error: 'Internal server error',
    error_code: 'UNEXPECTED_ERROR',
    details: {
      component: 'manage_agent_tool_environment',
      operation: 'edge_function_execution'
    },
    timestamp: new Date().toISOString(),
    request_id: crypto.randomUUID(),
    suggested_actions: ['Contact support if this persists']
  } as APIErrorResponse), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

```typescript
// === BACKEND SERVICE ERROR HANDLING ===

class SSHKeyServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public component: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SSHKeyServiceError';
  }
}

// Usage in service methods
static async ensureUserHasSSHKeys(userId: string): Promise<UserSSHKey[]> {
  try {
    const existingKeys = await this.getUserSSHKeys({ userId });
    
    if (existingKeys.length === 0) {
      console.log(`No SSH keys found for user ${userId}, generating new key pair`);
      
      const keyPair = await this.generateSSHKeyPair({ userId });
      const storageResult = await this.storeUserSSHKey(userId, keyPair, 'default');
      
      return await this.getUserSSHKeys({ userId });
    }
    
    return existingKeys;
    
  } catch (error: any) {
    if (error instanceof SSHKeyServiceError) {
      throw error;
    }
    
    throw new SSHKeyServiceError(
      `Failed to ensure SSH keys for user ${userId}: ${error.message}`,
      'SSH_KEY_ENSURE_FAILED',
      'ssh_key_service',
      { userId, originalError: error.message }
    );
  }
}
```

### Security Design

#### Authentication Flow

```typescript
// === JWT TOKEN VALIDATION ===

interface AuthValidationResult {
  isValid: boolean;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  error?: string;
}

async function validateJWTToken(authHeader: string): Promise<AuthValidationResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      return { isValid: false, error: 'Invalid or expired token' };
    }
    
    return { 
      isValid: true, 
      user: { 
        id: user.id, 
        email: user.email || '', 
        role: user.user_metadata?.role 
      } 
    };
    
  } catch (error: any) {
    return { isValid: false, error: 'Token validation failed' };
  }
}
```

#### Resource Authorization

```typescript
// === AGENT OWNERSHIP VALIDATION ===

async function validateAgentOwnership(agentId: string, userId: string): Promise<boolean> {
  const supabaseAdmin = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: agentData, error } = await supabaseAdmin
    .from('agents')
    .select('user_id')
    .eq('id', agentId)
    .single();

  if (error || !agentData) {
    throw new Error('Agent not found or access denied');
  }

  return agentData.user_id === userId;
}
```

#### Vault Security Integration

```typescript
// === SECURE VAULT OPERATIONS ===

interface VaultSecurityConfig {
  encryption: 'aes-256-gcm';
  key_rotation: boolean;
  audit_logging: boolean;
}

class SecureVaultService {
  private static readonly VAULT_CONFIG: VaultSecurityConfig = {
    encryption: 'aes-256-gcm',
    key_rotation: true,
    audit_logging: true
  };
  
  static async securelyStoreSSHKey(
    key: string, 
    metadata: { userId: string; keyType: string; keyName: string }
  ): Promise<string> {
    const supabaseAdmin = getSupabaseAdmin();
    
    const { data, error } = await supabaseAdmin
      .from('vault')
      .insert({
        secret: key,
        key_id: `ssh_key_${metadata.userId}_${Date.now()}`,
        description: `SSH ${metadata.keyType} key: ${metadata.keyName}`,
        metadata: {
          user_id: metadata.userId,
          key_type: metadata.keyType,
          key_name: metadata.keyName,
          created_at: new Date().toISOString()
        }
      })
      .select('key_id')
      .single();
    
    if (error) {
      throw new Error(`Failed to store SSH key in vault: ${error.message}`);
    }
    
    // Audit log
    console.log(`SSH key stored in vault: ${data.key_id} for user: ${metadata.userId}`);
    
    return data.key_id;
  }
}
```

### Performance Considerations

#### Caching Strategy

```typescript
// === MULTI-LAYER CACHING DESIGN ===

interface CacheConfig {
  ttl: number;          // Time to live in seconds
  maxSize: number;      // Maximum cache entries
  strategy: 'lru' | 'ttl';
}

class SSHKeyCache {
  private static readonly CACHE_CONFIG: CacheConfig = {
    ttl: 300,        // 5 minutes
    maxSize: 1000,   // 1000 users
    strategy: 'lru'
  };
  
  private static memoryCache = new Map<string, {
    data: string[];
    timestamp: number;
    hits: number;
  }>();
  
  static async getDeploymentKeys(userId: string): Promise<string[] | null> {
    const cacheKey = `deployment_keys_${userId}`;
    const cached = this.memoryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < (this.CACHE_CONFIG.ttl * 1000)) {
      cached.hits++;
      console.log(`Cache hit for user ${userId} (${cached.hits} hits)`);
      return cached.data;
    }
    
    return null;
  }
  
  static setDeploymentKeys(userId: string, keys: string[]): void {
    const cacheKey = `deployment_keys_${userId}`;
    
    this.memoryCache.set(cacheKey, {
      data: keys,
      timestamp: Date.now(),
      hits: 0
    });
    
    // Cleanup old entries if cache is full
    if (this.memoryCache.size > this.CACHE_CONFIG.maxSize) {
      this.cleanupCache();
    }
  }
  
  private static cleanupCache(): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, Math.floor(this.CACHE_CONFIG.maxSize * 0.2));
    toDelete.forEach(([key]) => this.memoryCache.delete(key));
  }
}
```

#### Async Processing Design

```typescript
// === BACKGROUND PROCESSING ===

interface BackgroundJob {
  id: string;
  userId: string;
  operation: 'ssh_key_generation' | 'digitalocean_registration';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

class BackgroundProcessor {
  private static jobQueue: BackgroundJob[] = [];
  private static processing = false;
  
  static async queueSSHKeyGeneration(userId: string): Promise<string> {
    const jobId = crypto.randomUUID();
    
    const job: BackgroundJob = {
      id: jobId,
      userId,
      operation: 'ssh_key_generation',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    this.jobQueue.push(job);
    
    if (!this.processing) {
      this.processQueue();
    }
    
    return jobId;
  }
  
  private static async processQueue(): Promise<void> {
    this.processing = true;
    
    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift()!;
      
      try {
        job.status = 'in_progress';
        
        if (job.operation === 'ssh_key_generation') {
          await this.processSSHKeyGeneration(job);
        }
        
        job.status = 'completed';
        job.completed_at = new Date().toISOString();
        
      } catch (error: any) {
        job.status = 'failed';
        job.error_message = error.message;
        job.completed_at = new Date().toISOString();
      }
    }
    
    this.processing = false;
  }
}
```

### API Documentation Specifications

#### OpenAPI/Swagger Schema Design

```yaml
# === OPENAPI SPECIFICATION ===

openapi: 3.0.3
info:
  title: Agentopia SSH Key Integration API
  description: API for managing SSH keys in automated agent deployment
  version: 1.0.0
  contact:
    name: Agentopia Engineering
    email: engineering@agentopia.com

servers:
  - url: https://your-project.supabase.co/functions/v1
    description: Production Supabase Edge Functions
  - url: http://localhost:54321/functions/v1
    description: Local Development

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Supabase JWT token

  schemas:
    ToolEnvironmentResponse:
      type: object
      required:
        - success
        - message
      properties:
        success:
          type: boolean
        message:
          type: string
        data:
          type: object
          properties:
            agent_id:
              type: string
              format: uuid
            droplet_id:
              type: string
            status:
              type: string
              enum: [active, provisioning, error, inactive]
            ip_address:
              type: string
              nullable: true
            ssh_keys_configured:
              type: boolean
            ssh_key_count:
              type: integer
        error:
          type: string
          nullable: true

paths:
  /manage-agent-tool-environment/{agentId}:
    post:
      summary: Ensure agent tool environment with SSH keys
      description: Provisions or ensures agent tool environment with user SSH keys
      parameters:
        - name: agentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Tool environment ready
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ToolEnvironmentResponse'
        '401':
          description: Unauthorized
        '403':
          description: Forbidden - user doesn't own agent
        '500':
          description: Internal server error
```

### API Testing Strategy

#### Integration Test Specifications

```typescript
// === API INTEGRATION TESTS ===

describe('SSH Key Integration API', () => {
  describe('Edge Function API', () => {
    test('should provision environment with SSH keys for authenticated user', async () => {
      const response = await fetch('/functions/v1/manage-agent-tool-environment/test-agent-1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validJWTToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.ssh_keys_configured).toBe(true);
      expect(result.data.ssh_key_count).toBeGreaterThan(0);
    });
    
    test('should reject request without valid JWT token', async () => {
      const response = await fetch('/functions/v1/manage-agent-tool-environment/test-agent-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(response.status).toBe(401);
      
      const result = await response.json();
      expect(result.error).toContain('Authentication required');
    });
  });
  
  describe('SSH Key Service API', () => {
    test('should generate and store SSH keys for user', async () => {
      const result = await SSHKeyService.ensureUserHasSSHKeys('test-user-1');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].fingerprint).toBeDefined();
      expect(result[0].user_id).toBe('test-user-1');
    });
    
    test('should cache SSH keys for performance', async () => {
      const start1 = Date.now();
      const keys1 = await SSHKeyService.getDeploymentSSHKeysWithCache('test-user-1');
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      const keys2 = await SSHKeyService.getDeploymentSSHKeysWithCache('test-user-1');
      const time2 = Date.now() - start2;
      
      expect(keys2.cache_hit).toBe(true);
      expect(time2).toBeLessThan(time1 / 2); // Cache should be significantly faster
    });
  });
});
```

### Success Criteria

- [x] Comprehensive API contracts designed ✅
- [x] Data structures and request/response schemas defined ✅  
- [x] Error handling patterns and status codes planned ✅
- [x] Security and authentication flows designed ✅
- [x] API documentation specifications created ✅

### Dependencies and Integration Points

#### Critical Dependencies
1. **Phase 2.1 Technical Architecture** ✅ Complete
2. **Existing API Patterns** ✅ Analyzed and documented
3. **Supabase JWT Authentication** ✅ Available
4. **Internal API Secret Validation** ✅ Available
5. **RLS Policies and Vault Integration** ✅ Available

#### Integration Points Validation
1. **Edge Function Enhancement** ✅ User context propagation designed
2. **Backend Service Enhancement** ✅ SSH key integration contracts defined
3. **Frontend Hook Integration** ✅ React hook API contracts designed
4. **Error Handling Consistency** ✅ Standardized error response format
5. **Performance Optimization** ✅ Caching and async processing designed

### Next Planning Task

**Phase 2.3**: Error Handling Strategy
- Plan comprehensive error scenarios and recovery strategies
- Define error handling implementation approach
- Document error handling patterns for all integration points