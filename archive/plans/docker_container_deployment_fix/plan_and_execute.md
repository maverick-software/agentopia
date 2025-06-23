# Plan and Execute: Docker Container Deployment 404 Fix

**Date:** June 19, 2025  
**Plan ID:** docker_container_deployment_fix_20250619_updated  
**Priority:** CRITICAL  
**Issue:** Docker containers failing to start with 404 errors from DTMA API  
**Update:** New analysis reveals both DTMA versions have endpoints - issue is deployment/configuration related

## 🎯 Problem Statement

**Core Issue:** DTMA (Droplet Tool Management Agent) is returning 404 "Not Found" errors when attempting to start Docker containers, even after successful deployment.

**Updated Root Cause Analysis:** 
- **Previous assumption:** Missing endpoints in deployed DTMA version
- **New discovery:** Both `/dtma/` and `/dtma-agent/` contain start/stop endpoints
- **Revised hypothesis:** Deployment configuration or runtime issues preventing endpoint functionality

**Potential Causes:**
1. **Deployment Configuration Mismatch:** Wrong environment variables or routing
2. **Runtime State Issues:** In-memory state loss causing endpoint failures
3. **Authentication/Authorization:** Token or API key configuration problems
4. **Network/Proxy Issues:** Request routing problems to deployed DTMA
5. **Container Registry Synchronization:** Mismatch between deployed code and expected functionality

**Impact:** Complete failure of MCP server deployment functionality affecting all users.

## 📋 Revised Solution Strategy

**Approach:** Investigative debugging followed by targeted fixes rather than wholesale replacement.

**Phases:**
1. **Immediate Investigation** (1-2 hours): Debug current deployment to identify specific failure point
2. **Targeted Fix** (2-4 hours): Address specific configuration/deployment issue
3. **Long-term Enhancement** (2-3 weeks): Implement database-backed container persistence

## 🚀 Updated Implementation Plan

### **Phase 1: Diagnostic Investigation (IMMEDIATE)**

#### **Objective**
Identify the specific cause of 404 errors in the currently deployed DTMA since both versions should have functional endpoints.

#### **Pre-execution Checklist**
- [x] Confirmed both DTMA versions contain start/stop endpoints
- [x] Identified deployed DTMA location (167.99.1.222:30000)
- [x] Located potential working version (`/dtma/` folder)
- [x] Prepared diagnostic procedures

#### **Diagnostic Steps**

**Step 1: Live Deployment Analysis**
```bash
# Check current DTMA deployment status
ssh ubuntu@167.99.1.222 << 'EOF'
  echo "=== Current DTMA Container Info ==="
  docker ps | grep dtma
  docker inspect $(docker ps -q --filter "name=dtma") | jq '.[0].Config'
  
  echo "=== DTMA Logs (last 100 lines) ==="
  docker logs --tail 100 $(docker ps -q --filter "name=dtma") 2>&1
  
  echo "=== Environment Variables ==="
  docker exec $(docker ps -q --filter "name=dtma") env | grep -E "(DTMA|API|TOKEN|URL)"
  
  echo "=== Network Configuration ==="
  docker port $(docker ps -q --filter "name=dtma")
  netstat -tlnp | grep 30000
EOF
```

**Step 2: Endpoint Availability Testing**
```bash
# Test basic connectivity
curl -v http://167.99.1.222:30000/status

# Test with authentication
curl -v -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/status

# Test specific failing endpoint with verbose output
curl -v -X POST \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"instanceNameOnToolbox":"test-debug"}' \
     http://167.99.1.222:30000/tools/test-debug/start

# Check available routes
curl -v -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/
```

**Step 3: Code Comparison Analysis**
```bash
# Compare deployed version with working version
cd dtma-agent
echo "=== DTMA-Agent Routes ==="
grep -r "start\|stop" src/ --include="*.ts" --include="*.js"

cd ../dtma  
echo "=== DTMA Routes ==="
grep -r "start\|stop" src/ --include="*.ts" --include="*.js"

# Check for differences in package.json
echo "=== Package Differences ==="
diff dtma-agent/package.json dtma/package.json
```

#### **Decision Matrix Based on Findings**

| Finding | Likely Cause | Action |
|---------|--------------|--------|
| Endpoints return 404 but logs show requests received | Route configuration issue | Fix routing in current deployment |
| Endpoints not receiving requests | Network/proxy issue | Fix network configuration |
| Authentication errors in logs | Token/API key mismatch | Update environment variables |
| Container crashes on endpoint access | Runtime dependency issue | Redeploy with proper dependencies |
| No logs for failing requests | Request not reaching DTMA | Check load balancer/proxy config |

### **Phase 2: Targeted Fix (2-4 hours)**

#### **Scenario A: Route Configuration Fix**
```bash
# If routes are misconfigured, update without full redeployment
ssh ubuntu@167.99.1.222 << 'EOF'
  # Hot-fix route configuration if possible
  docker exec $(docker ps -q --filter "name=dtma") /bin/bash -c "
    # Check current route configuration
    cat /app/src/routes/* | grep -E 'start|stop'
  "
EOF
```

#### **Scenario B: Environment Configuration Fix**
```bash
# Update environment variables without redeployment
ssh ubuntu@167.99.1.222 << 'EOF'
  # Get current container ID
  CONTAINER_ID=$(docker ps -q --filter "name=dtma")
  
  # Update environment and restart
  docker stop $CONTAINER_ID
  docker run -d \
    --name dtma_manager_fixed \
    --restart always \
    -p 30000:30000 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e DTMA_BEARER_TOKEN='${DTMA_BEARER_TOKEN}' \
    -e AGENTOPIA_API_BASE_URL='${AGENTOPIA_API_BASE_URL}' \
    -e BACKEND_TO_DTMA_API_KEY='${BACKEND_TO_DTMA_API_KEY}' \
    $(docker inspect $CONTAINER_ID | jq -r '.[0].Config.Image')
EOF
```

#### **Scenario C: Selective Redeployment**
```bash
# Only if configuration fixes don't work
# Deploy the working version as fallback
cd dtma
docker build -t dtma:fixed-$(date +%Y%m%d_%H%M%S) .
# [Previous deployment steps from original plan]
```

**Step 4: Verification After Fix**
```bash
# Test the specific failing scenario
curl -X POST \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"dockerImageUrl":"nginx:latest","instanceNameOnToolbox":"test-verify-fix","accountToolInstanceId":"test-123"}' \
     http://167.99.1.222:30000/tools

# Test start endpoint that was failing
curl -X POST \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/tools/test-verify-fix/start

# Verify container is actually running
ssh ubuntu@167.99.1.222 'docker ps | grep test-verify-fix'

# Cleanup
curl -X DELETE \
     -H "Authorization: Bearer $DTMA_BEARER_TOKEN" \
     http://167.99.1.222:30000/tools/test-verify-fix
```

#### **Success Criteria for Phase 1-2**
- [ ] Identified specific cause of 404 errors
- [ ] Applied targeted fix without full redeployment (preferred)
- [ ] Container start endpoint returns success (not 404)
- [ ] Test container can be deployed, started, and deleted
- [ ] Existing MCP deployment workflow functions
- [ ] Root cause documented for future prevention

### **Phase 3: Database-Backed Persistence (WEEK 1-2)**

#### **Objective**
Implement persistent container state management to survive DTMA restarts.

#### **Key Components**
1. **Database Schema:** `dtma_container_registry` table
2. **Service Layer:** `ContainerRegistryService` class
3. **DTMA Integration:** Updated routes to use database
4. **Migration Script:** Convert existing containers

#### **Implementation Priority**
1. Create database migration
2. Implement ContainerRegistryService
3. Update DTMA routes to use database
4. Test with existing containers
5. Deploy to production

### **Phase 4: Optimization and Monitoring (WEEK 3)**

#### **Objective**
Remove temporary solutions and establish production monitoring.

#### **Key Tasks**
1. Remove in-memory tracking dependencies
2. Add performance monitoring
3. Implement health checks
4. Complete end-to-end testing

## 🔍 Updated Monitoring and Validation

### **Diagnostic Monitoring**
```bash
# Real-time endpoint monitoring
watch -n 10 'echo "=== Health Check ===" && curl -s -H "Authorization: Bearer $DTMA_BEARER_TOKEN" http://167.99.1.222:30000/status && echo -e "\n=== Start Endpoint Test ===" && curl -s -X POST -H "Authorization: Bearer $DTMA_BEARER_TOKEN" http://167.99.1.222:30000/tools/health-test/start'

# Monitor for specific error patterns
ssh ubuntu@167.99.1.222 'docker logs -f $(docker ps -q --filter "name=dtma") | grep -E "(404|start|stop|error)"'

# Database monitoring for container states
SELECT container_name, dtma_status, docker_status, updated_at 
FROM dtma_container_registry 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

### **Updated Success Metrics**
| Metric | Current | Target | Phase 1-2 | Phase 3-4 |
|--------|---------|--------|-----------|-----------|
| 404 Error Rate | 100% | 0% | ✅ 0% | ✅ 0% |
| Diagnostic Accuracy | 0% | 100% | ✅ 100% | ✅ 100% |
| Container Deploy Success | 0% | 95%+ | ✅ 95%+ | ✅ 99%+ |
| Fix Deployment Time | N/A | <2hrs | ✅ <2hrs | ✅ <1hr |
| State Persistence | ❌ None | ✅ Full | ⚠️ Memory | ✅ Database |

## ⚠️ Updated Risk Assessment

### **Reduced Risks**
1. **Full System Replacement** - No longer needed since endpoints exist
2. **Code Compatibility** - Both versions have similar functionality
3. **Deployment Complexity** - Targeted fixes are less risky

### **New Risk Areas**
1. **Misdiagnosis** - May miss subtle configuration issues
2. **Temporary Fixes** - Quick fixes might mask deeper problems
3. **State Inconsistency** - Partial fixes might create data inconsistencies

### **Mitigation Strategies**
1. **Comprehensive Logging** - Capture all diagnostic data before changes
2. **Incremental Testing** - Test each fix component individually
3. **Rollback Readiness** - Maintain ability to revert any changes quickly

## 📞 Updated Communication Plan

### **Stakeholder Updates**
- **Immediate:** "Investigating specific cause of 404 errors - endpoints exist but aren't functioning"
- **Phase 1 Complete:** "Root cause identified and targeted fix applied"
- **Phase 2-3:** "Implementing robust persistence to prevent future issues"

### **User Communication**
- **During Investigation:** "We've identified the issue is configuration-related and are applying a targeted fix"
- **Post-Fix:** "MCP deployment issues resolved through configuration correction"

## ✅ Updated Completion Checklist

### **Phase 1-2 (Immediate)**
- [ ] Complete diagnostic investigation
- [ ] Identify specific 404 error cause
- [ ] Apply targeted configuration fix
- [ ] Verify container lifecycle operations work
- [ ] Test MCP deployment workflow end-to-end
- [ ] Document root cause and solution

### **Phase 3-4 (Long-term)**
- [ ] Database schema implemented
- [ ] Container state persistence working
- [ ] Migration of existing containers
- [ ] Performance monitoring active
- [ ] Documentation updated

## 🎯 Updated Expected Outcomes

**Immediate Results (Phase 1-2):**
- Specific root cause identified and documented
- Minimal-impact fix applied (configuration vs. redeployment)
- Docker container 404 errors eliminated
- MCP server deployment functionality restored
- Faster resolution time due to targeted approach

**Long-term Results (Phase 3-4):**
- Robust container state management
- System resilience to DTMA restarts
- Scalable architecture for future growth
- Complete audit trail for container operations

## 📋 Post-Implementation Review

**Success Criteria Met:**
- [ ] Root cause specifically identified (not assumed)
- [ ] Minimal-impact fix successfully applied
- [ ] All 404 errors resolved
- [ ] Container deployment success rate >95%
- [ ] Database persistence implemented
- [ ] Prevention measures documented

**Lessons Learned:**
- ✅ Don't assume missing functionality - verify through investigation
- ✅ Both versions having endpoints suggests deployment/config issues
- ✅ Diagnostic investigation can save time vs. wholesale replacement
- ✅ Configuration issues are often faster to fix than code deployment
- ✅ Thorough analysis prevents unnecessary complex solutions

---

**Plan Status:** ✅ PHASE 1 COMPLETE - PHASE 2 READY FOR EXECUTION  
**Phase 1 Results:** Root cause identified - deployed DTMA missing critical endpoints despite source code containing them  
**Next Action:** Execute Phase 2 deployment using commands in `implementation/deployment_commands.md`  
**Estimated Resolution:** 15-30 minutes for deployment and verification  
**Key Discovery:** Built working DTMA image locally with all endpoints - ready for deployment 