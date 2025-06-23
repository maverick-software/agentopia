# DTMA Deployment Fix Commands

**Date:** June 19, 2025  
**Purpose:** Commands to deploy the fixed DTMA with all endpoints on 167.99.1.222  
**Status:** Ready for execution by someone with SSH access  

## 🎯 Problem Summary

The deployed DTMA at 167.99.1.222:30000 is missing critical endpoints:
- ❌ `POST /tools/:instanceName/start` (causing 404 errors)
- ❌ `POST /tools/:instanceName/stop`  
- ❌ `GET /health` (breaking scripts)

## ✅ Solution Ready

I have successfully built a fixed DTMA image locally that includes all required endpoints. The image is tagged as `dtma-agent:fixed-20250619` and has been verified to build without errors.

## 📋 Deployment Commands

**Prerequisites:** SSH access to ubuntu@167.99.1.222

### **Step 1: Backup Current Deployment**
```bash
ssh ubuntu@167.99.1.222 << 'EOF'
  # Create backup directory
  mkdir -p /home/ubuntu/backups/$(date +%Y%m%d_%H%M%S)
  
  # Backup current container (if running)
  CONTAINER_ID=$(docker ps -q --filter "name=dtma")
  if [ ! -z "$CONTAINER_ID" ]; then
    docker commit $CONTAINER_ID dtma-backup-$(date +%Y%m%d_%H%M%S)
    echo "Backup created: dtma-backup-$(date +%Y%m%d_%H%M%S)"
  fi
  
  # Save container configuration
  docker inspect $CONTAINER_ID > /home/ubuntu/backups/$(date +%Y%m%d_%H%M%S)/container-config.json
  
  # Save environment variables
  docker exec $CONTAINER_ID env > /home/ubuntu/backups/$(date +%Y%m%d_%H%M%S)/environment.txt
EOF
```

### **Step 2: Transfer Fixed Image**

**Option A: Build on Server (Recommended)**
```bash
# Copy the fixed source code to the server
scp -r dtma-agent/ ubuntu@167.99.1.222:/tmp/dtma-agent-fixed/

ssh ubuntu@167.99.1.222 << 'EOF'
  cd /tmp/dtma-agent-fixed
  
  # Install missing dependency
  npm install axios
  
  # Build the Docker image
  docker build -t dtma-agent:fixed-20250619 .
  
  echo "Fixed DTMA image built successfully"
EOF
```

**Option B: Use Docker Registry (Alternative)**
```bash
# First push to a registry (requires Docker Hub login locally)
docker tag dtma-agent:fixed-20250619 yourusername/dtma-agent:fixed-20250619
docker push yourusername/dtma-agent:fixed-20250619

# Then pull on server
ssh ubuntu@167.99.1.222 << 'EOF'
  docker pull yourusername/dtma-agent:fixed-20250619
  docker tag yourusername/dtma-agent:fixed-20250619 dtma-agent:fixed-20250619
EOF
```

### **Step 3: Deploy Fixed DTMA**
```bash
ssh ubuntu@167.99.1.222 << 'EOF'
  # Stop current DTMA
  CONTAINER_ID=$(docker ps -q --filter "name=dtma")
  if [ ! -z "$CONTAINER_ID" ]; then
    echo "Stopping current DTMA container: $CONTAINER_ID"
    docker stop $CONTAINER_ID
    docker rm $CONTAINER_ID
  fi
  
  # Get environment variables from backup or set them
  # Note: These should be set according to the original deployment
  DTMA_BEARER_TOKEN="${DTMA_BEARER_TOKEN:-your_dtma_bearer_token}"
  AGENTOPIA_API_BASE_URL="${AGENTOPIA_API_BASE_URL:-https://your-project.supabase.co/functions/v1}"
  BACKEND_TO_DTMA_API_KEY="${BACKEND_TO_DTMA_API_KEY:-your_backend_api_key}"
  
  # Run the fixed DTMA
  docker run -d \
    --name dtma_manager \
    --restart always \
    -p 30000:30000 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e DTMA_BEARER_TOKEN="$DTMA_BEARER_TOKEN" \
    -e AGENTOPIA_API_BASE_URL="$AGENTOPIA_API_BASE_URL" \
    -e BACKEND_TO_DTMA_API_KEY="$BACKEND_TO_DTMA_API_KEY" \
    dtma-agent:fixed-20250619
  
  echo "Fixed DTMA deployed successfully"
EOF
```

### **Step 4: Verify Deployment**
```bash
# Test all endpoints are now available
curl http://167.99.1.222:30000/ | jq .

# Should now show all endpoints including:
# - GET /health
# - POST /tools/:instanceName/start  
# - POST /tools/:instanceName/stop

# Test health endpoint specifically
curl http://167.99.1.222:30000/health

# Test with authentication (requires valid token)
curl -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/status
```

### **Step 5: Test Container Operations**
```bash
# Test the full workflow that was failing
curl -X POST \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"dockerImageUrl":"nginx:latest","instanceNameOnToolbox":"test-fix-verification","accountToolInstanceId":"test-123"}' \
     http://167.99.1.222:30000/tools

# Test start endpoint (this should now work instead of 404)
curl -X POST \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/tools/test-fix-verification/start

# Verify container is running
ssh ubuntu@167.99.1.222 'docker ps | grep test-fix-verification'

# Test stop endpoint
curl -X POST \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/tools/test-fix-verification/stop

# Cleanup test container
curl -X DELETE \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/tools/test-fix-verification
```

## 🔍 Verification Checklist

After deployment, verify these items:

- [ ] DTMA responds to `GET /` with all endpoints listed
- [ ] `GET /health` returns 200 OK (not 404)
- [ ] `GET /status` returns system information  
- [ ] `POST /tools/:instanceName/start` works (not 404)
- [ ] `POST /tools/:instanceName/stop` works (not 404)
- [ ] Container lifecycle operations complete successfully
- [ ] MCP deployment workflow functions end-to-end

## 🚨 Rollback Procedure

If the deployment fails:

```bash
ssh ubuntu@167.99.1.222 << 'EOF'
  # Stop failed deployment
  docker stop dtma_manager && docker rm dtma_manager
  
  # Restore from backup
  BACKUP_IMAGE=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep dtma-backup | head -1)
  if [ ! -z "$BACKUP_IMAGE" ]; then
    docker run -d \
      --name dtma_manager \
      --restart always \
      -p 30000:30000 \
      -v /var/run/docker.sock:/var/run/docker.sock \
      $BACKUP_IMAGE
    echo "Rollback completed using: $BACKUP_IMAGE"
  fi
EOF
```

## 📝 Environment Variables Required

These environment variables must be available during deployment:

- `DTMA_BEARER_TOKEN`: Authentication token for DTMA API
- `AGENTOPIA_API_BASE_URL`: Supabase functions URL  
- `BACKEND_TO_DTMA_API_KEY`: API key for backend communication

Check the database `account_tool_environments` table for the correct values.

## ✅ Expected Results

After successful deployment:

1. **All 404 errors eliminated** for container start/stop operations
2. **Scripts work correctly** with `/health` endpoint available
3. **MCP server deployment** functions end-to-end
4. **Container lifecycle management** fully operational

---

**Status:** Commands ready for execution  
**Risk Level:** Low - includes backup and rollback procedures  
**Estimated Time:** 15-30 minutes for complete deployment and verification 