# DTMA Service Deployment Plan

**Date:** June 2, 2025  
**Project:** Fix DTMA Service 500 Errors  
**Priority:** HIGH - Critical production issue  

## Problem Statement

Users experiencing 500 internal server errors when checking DTMA agent health status:
- Error: `txhscptzjrrudnqwavcb…2e/refresh-status:1 Failed to load resource: the server responded with a status of 500 ()`
- Progress from 404 → 500 indicates IP routing fix worked but DTMA service not running
- API calls reach droplet at `159.223.170.218:30000` but no service responds

## Solution Overview

Deploy working DTMA (Droplet Tool Management Agent) service using Docker-based approach expected by current codebase architecture.

## Technical Approach

### **Deployment Strategy: Docker-Based**
Current system architecture (account_environment_service) expects `dtmaDockerImageUrl` parameter, confirming Docker is the intended deployment method.

### **Implementation Path:**
1. Build DTMA Docker image from existing source
2. Deploy directly to droplet via SSH
3. Update service configuration if needed
4. Verify health endpoints

## Proposed File Structure

No new files required. Working with existing structure:

```
dtma/                          # Existing DTMA source (200-300 lines per file ✓)
├── src/
│   ├── index.ts              # Express entry (18 lines)
│   ├── docker_manager.ts     # Container management
│   ├── auth_middleware.ts    # Authentication
│   ├── agentopia_api_client.ts # Backend communication
│   └── routes/
│       └── tool_routes.ts    # API endpoints
├── Dockerfile                # Multi-stage build (42 lines)
├── package.json              # Dependencies (32 lines)
└── README.md                 # Documentation (57 lines)
```

**File Size Compliance:** ✅ All files under 300 lines maximum

## Dependencies & Requirements

### **Technical Dependencies:**
- ✅ Docker installed on droplet (confirmed)
- ✅ Working Dockerfile (exists in `dtma/`)
- ✅ Fixed package.json dependencies
- ✅ Network access to droplet (159.223.170.218)

### **Environment Variables Required:**
- `DTMA_BEARER_TOKEN` (unique token per droplet)
- `AGENTOPIA_API_BASE_URL` (Supabase functions URL)
- `BACKEND_TO_DTMA_API_KEY` (authentication key)

### **Network Configuration:**
- Port: 30000 (confirmed in multiple files)
- Docker port mapping: `-p 30000:30000`
- Docker socket mount: `-v /var/run/docker.sock:/var/run/docker.sock`

## Success Criteria

1. **✅ DTMA Health Check Responds:** `GET http://159.223.170.218:30000/status` returns 200
2. **✅ Frontend Integration Works:** Toolbox status refresh no longer shows 500 errors
3. **✅ Service Persistence:** Container restart policy ensures service survives reboots
4. **✅ Authentication Working:** Bearer token validation functions correctly

## Risk Assessment

### **Low Risk Factors:**
- ✅ Existing working Dockerfile
- ✅ Fixed dependencies in package.json
- ✅ Confirmed network connectivity to droplet
- ✅ Small, focused change scope

### **Mitigation Strategies:**
- **Backup Plan:** Can revert to simple nginx container if Docker build fails
- **Quick Rollback:** SSH access confirmed for immediate troubleshooting
- **Testing:** Local Docker build before remote deployment

## Implementation Timeline

**Total Estimated Time:** 30-45 minutes

1. **Build Phase** (10 min): Build Docker image locally
2. **Deploy Phase** (15 min): Transfer and run on droplet  
3. **Verify Phase** (10 min): Test endpoints and integration
4. **Documentation** (10 min): Update logs and verify success

## Alignment Verification

### **Codebase Alignment:** ✅
- Current `account_environment_service/manager.ts` expects Docker deployment
- Dockerfile exists and uses correct port (30000)
- Dependencies fixed in package.json

### **Database Schema Alignment:** ✅
- `account_tool_environments` table structure supports current approach
- No schema changes required
- Bearer token and IP address fields exist

### **Architecture Alignment:** ✅
- Docker-based deployment matches current service expectation
- Port 30000 consistent across all configuration files
- Authentication pattern matches existing implementation

---

**Plan Status:** ✅ READY FOR EXECUTION  
**Confidence Level:** HIGH  
**Prerequisites:** All satisfied  
**Go/No-Go Decision:** ✅ GO 