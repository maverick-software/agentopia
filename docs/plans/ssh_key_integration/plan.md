# SSH Key Integration for Automated Deployment Flow

**Date**: 2025-06-03  
**Plan Name**: ssh_key_integration  
**Duration**: 3-4 weeks  
**Scope**: Integrate SSH key management into automated toolbox deployment flow

## Overview

The goal is to integrate the existing SSH key management system into the automated deployment flow so that when users deploy toolboxes (MCP servers) via the UI, the backend automatically handles SSH key generation, storage, and configuration without any manual intervention.

## Current State Analysis

### ✅ **Already Implemented**
- SSH key storage service (`src/services/ssh_key_service.ts`)
- Database schema (`user_ssh_keys` table with RLS policies)
- Supabase Vault integration for secure key storage
- Manual scripts for SSH key management
- DigitalOcean droplet deployment infrastructure
- Automated deployment functions (`manage-agent-tool-environment`)

### 🔄 **Needs Integration**
- Automatic SSH key generation during user onboarding
- SSH key retrieval and injection into droplet deployment
- User authentication flow integration
- UI components for SSH key management (optional)
- Error handling and fallback mechanisms

## Research Findings

### **Codebase Architecture**
- **Frontend**: React/Vite with Supabase Auth
- **Backend**: Supabase Edge Functions + Node.js services
- **Database**: PostgreSQL with RLS security model
- **Infrastructure**: DigitalOcean droplets with DTMA agents

### **Key Integration Points**
1. **User Onboarding**: Automatically generate SSH keys for new users
2. **Deployment Flow**: `manage-agent-tool-environment` function needs SSH key injection
3. **Service Layer**: `agent_environment_service` needs SSH key retrieval capability
4. **Security**: Maintain RLS policies and vault encryption

### **Database Schema**
```sql
CREATE TABLE public.user_ssh_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    public_key_vault_id uuid NOT NULL,
    private_key_vault_id uuid NOT NULL,
    key_name text DEFAULT 'default'::text NOT NULL,
    fingerprint text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
```

## Technical Approach

### **Philosophy Compliance**
- **File Size**: All new/modified files kept under 450 lines (target 200-300)
- **Separation of Concerns**: SSH key logic separated from deployment logic
- **Big Picture Integration**: Enhance existing flows rather than rebuilding

### **Integration Strategy**
1. **Enhance User Onboarding**: Auto-generate SSH keys on first toolbox deployment
2. **Modify Deployment Functions**: Inject SSH keys into droplet provisioning
3. **Extend Service Layer**: Add SSH key retrieval to environment services
4. **Update Frontend**: Optional SSH key management UI components

## Proposed File Structure

```
src/
├── services/
│   ├── ssh_key_service.ts (✅ exists - enhance)
│   ├── user_onboarding_service.ts (🆕 create)
│   └── agent_environment_service/
│       ├── manager.ts (🔄 modify)
│       └── ssh_integration.ts (🆕 create)
├── hooks/
│   ├── useSSHKeys.ts (🆕 create)
│   └── useUserOnboarding.ts (🆕 create)
└── components/
    └── ssh-keys/
        ├── SSHKeyManager.tsx (🆕 create)
        └── SSHKeyStatus.tsx (🆕 create)

supabase/functions/
├── manage-agent-tool-environment/ (🔄 modify)
│   └── index.ts
├── user-onboarding/ (🆕 create)
│   └── index.ts
└── _shared_services/
    └── ssh_key_integration/ (🆕 create)
        ├── client.ts
        └── types.ts

scripts/
├── generate-user-ssh-keys.ts (🆕 create)
└── migrate-existing-users.ts (🆕 create)
```

## Success Criteria

### **Functional Requirements**
- [ ] Users deploying first toolbox automatically get SSH keys generated
- [ ] Droplet deployment includes SSH keys without manual intervention
- [ ] Existing users can retroactively generate SSH keys
- [ ] SSH keys are securely stored in Supabase Vault
- [ ] RLS policies protect user SSH key access

### **Non-Functional Requirements**  
- [ ] No breaking changes to existing deployment flow
- [ ] All files remain under 450 lines
- [ ] Comprehensive error handling and logging
- [ ] Performance impact < 500ms on deployment flow
- [ ] Complete test coverage for new components

### **Security Requirements**
- [ ] SSH keys encrypted in vault storage
- [ ] User isolation via RLS policies
- [ ] Service role access for backend operations
- [ ] Audit trail for SSH key operations

## Integration Points

### **1. User Authentication Flow**
- Hook into Supabase Auth user creation
- Generate SSH keys on first toolbox deployment request

### **2. Deployment Pipeline**
- `manage-agent-tool-environment` function enhancement
- `agent_environment_service` SSH key injection
- DigitalOcean droplet configuration with SSH keys

### **3. Frontend Integration**
- Optional SSH key management UI
- Deployment status with SSH key information
- Error handling for SSH key failures

### **4. Backend Services**
- User onboarding service for SSH key generation
- SSH key integration service for deployment flow
- Enhanced logging and monitoring

## Risk Assessment

### **Low Risk** 
- Database schema already exists
- SSH key service already implemented
- No breaking changes to core functionality

### **Medium Risk**
- Performance impact on deployment flow
- Error handling complexity
- User experience during failures

### **Mitigation Strategies**
- Asynchronous SSH key generation
- Fallback to manual SSH key provision
- Comprehensive error reporting
- Progressive enhancement approach

## Next Steps

Following the Plan & Execute protocol, the next step is creating the Work Breakdown Structure (WBS) with detailed tasks for each project phase: Research, Planning, Design, Development, Testing, and Refinement. 