# DTMA Deployment - Codebase Analysis Research

**Date:** June 2, 2025  
**Issue:** 500 Internal Server Error when checking DTMA agent health status  
**Goal:** Deploy working DTMA service on DigitalOcean droplet  

## Current Problem Analysis

### **Error Context**
- User reported 500 errors: `txhscptzjrrudnqwavcb…2e/refresh-status:1 Failed to load resource: the server responded with a status of 500 ()`
- Progress from 404 → 500 confirms IP routing fix worked
- API calls now reach droplet at `159.223.170.218:30000` but DTMA service not running

### **Root Cause**
DTMA service deployment issue on DigitalOcean droplet. System expects Docker-based DTMA but no working image exists.

## Codebase Research Findings

### **1. DTMA Architecture Discovery**

#### **Two DTMA Projects Found:**
1. **`dtma/`** - Primary TypeScript source (local development)
2. **`dtma-agent/`** - Deployment clone from `github.com/maverick-software/dtma-agent.git`

#### **Current DTMA Structure:**
```
dtma/
├── src/
│   ├── index.ts (Express app entry)
│   ├── docker_manager.ts (Dockerode usage)
│   ├── auth_middleware.ts
│   ├── agentopia_api_client.ts
│   └── routes/
├── Dockerfile (multi-stage build)
├── package.json (fixed dependencies)
└── README.md
```

#### **Key Dependencies (Fixed):**
- express: ^4.19.2
- dockerode: ^4.0.2
- axios: ^1.7.0 (added)
- systeminformation: ^5.22.0 (added)

### **2. Deployment Strategy Analysis**

#### **Current System Expects Docker-Based DTMA:**
From `src/services/account_environment_service/manager.ts`:
```typescript
private _createToolboxUserDataScript(options: CreateToolboxUserDataScriptOptions): string {
    const { dtmaBearerToken, agentopiaApiBaseUrl, backendToDtmaApiKey, dtmaDockerImageUrl } = options;
    // ...deploys via Docker container
}
```

#### **Three Deployment Approaches Found:**

1. **Git-Based (Legacy):** `agent_environment_service/manager.ts`
   - Clones from GitHub repository
   - Builds on droplet using Node.js/npm
   - Uses systemd service

2. **Docker-Based (Current):** `account_environment_service/manager.ts`
   - Expects pre-built Docker image
   - Uses `dtmaDockerImageUrl` parameter
   - Runs as Docker container with restart=always

3. **Offline Testing:** `scripts/offline-deployment-test.ts`
   - Git clone + build approach with offline patches
   - For testing purposes only

### **3. Database Schema Analysis**

#### **Relevant Tables:**
- `account_tool_environments` - Stores toolbox droplet information
- Fields: `dtma_bearer_token`, `public_ip_address`, `do_droplet_id`, `status`

#### **Recent Migration (May 12, 2025):**
- `20250512010000_add_unique_constraint_to_dtma_token.sql`
- `20250512000000_refactor_tool_schema.sql` (27KB - major tool infrastructure refactor)

### **4. Service Integration Points**

#### **API Endpoints Expected by Frontend:**
- `GET /api/toolboxes-user/{id}/refresh-status` (currently failing)
- Uses `refreshToolboxStatusFromDtma()` in manager.ts
- Expects DTMA to respond on port 30000

#### **DTMA API Requirements:**
- Port 30000 (confirmed in multiple files)
- Authentication via Bearer token
- Health check endpoint
- Tool management endpoints

## Technical Requirements

### **Docker Image Requirements:**
1. Node.js 20 runtime
2. Express server on port 30000
3. Docker socket access for container management
4. Environment variables:
   - `DTMA_BEARER_TOKEN`
   - `AGENTOPIA_API_BASE_URL`
   - `BACKEND_TO_DTMA_API_KEY`

### **Network Configuration:**
- Droplet IP: 159.223.170.218
- Port: 30000
- Docker port mapping: `-p 30000:30000`

### **Security Requirements:**
- Bearer token authentication
- Docker socket mounting (`-v /var/run/docker.sock:/var/run/docker.sock`)
- Container restart policy: `--restart always`

## Implementation Path Forward

### **Chosen Strategy: Docker-Based Deployment**
**Rationale:** Current system (account_environment_service) expects `dtmaDockerImageUrl` parameter, indicating Docker is the intended approach.

### **Required Steps:**
1. Build DTMA Docker image locally
2. Deploy to droplet (directly or via registry)
3. Update deployment to use actual image URL
4. Test health check endpoint

### **Dependencies:**
- Working Dockerfile (exists in `dtma/`)
- Fixed package.json (completed)
- Docker build environment
- Container registry (optional) or direct deployment

### **Testing Plan:**
1. Build image: `docker build -t agentopia-dtma:latest dtma/`
2. Test locally: `docker run -p 30000:30000 agentopia-dtma:latest`
3. Deploy to droplet
4. Verify API endpoints respond correctly

## Files Referenced

### **Primary Files:**
- `dtma/Dockerfile` - Multi-stage Docker build
- `dtma/package.json` - Fixed dependencies  
- `dtma/src/index.ts` - Express server entry point
- `src/services/account_environment_service/manager.ts` - Docker deployment script

### **Supporting Files:**
- `dtma/README.md` - DTMA documentation
- `supabase/migrations/20250512000000_refactor_tool_schema.sql` - Schema changes
- `logs/droplet-test-agent-001.json` - Current droplet info

### **Context Files:**
- `src/services/agent_environment_service/manager.ts` - Legacy git-based approach
- `scripts/offline-deployment-test.ts` - Testing approach
- `scripts/deploy-agent-droplet.js` - Alternative deployment method

## Next Actions

1. **Build DTMA Docker Image**
2. **Deploy to Droplet** 
3. **Update Service Configuration**
4. **Test API Health Check**
5. **Verify Frontend Integration**

---

**Research Status:** ✅ COMPLETE  
**Confidence Level:** HIGH - Clear technical path identified  
**Blocking Issues:** None - all dependencies resolved 