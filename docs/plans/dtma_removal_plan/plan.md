# DTMA Removal Plan - Complete Feature Extraction

## **Project Overview**

**Objective:** Safely remove the Droplet Tool Management Agent (DTMA) feature from Agentopia while maintaining system integrity and avoiding breaking changes to core functionality.

**Date:** 06/25/2025 12:09:00  
**Protocol:** plan_and_execute.mdc  
**Scope:** Complete removal of DTMA infrastructure, UI components, database tables, and related services  

## **DTMA Components Identified (Research Phase)**

### **1. Core Infrastructure**
- **Main Directory:** `/dtma/` - Complete Node.js/TypeScript application (~4,872 lines across multiple files)
- **Docker Configuration:** `Dockerfile`, `package.json`, `tsconfig.json`
- **Source Code:** `src/` directory with API routes, modules, authentication middleware

### **2. Database Schema**
- **Primary Tables:**
  - `account_tool_environments` (Main toolbox/droplet management)
  - `account_tool_instances` (Tool instances on droplets)
  - `tool_catalog` (Available tools/MCP servers)
  - `agent_toolbox_access` (Agent permissions to toolboxes)
- **Migration Files:** 8+ migration files with DTMA-specific changes
- **Database Functions:** MCP-related functions that reference DTMA tables

### **3. Frontend Components**
- **Pages:** `ToolboxesPage.tsx` (~280 lines), `ToolboxDetailPage.tsx`
- **Routing:** Routes for `/admin/tools` and `/admin/toolboxes/:toolboxId`
- **API Layer:** `lib/api/toolboxes.ts` with DTMA service calls
- **Components:** Various toolbox-related UI components

### **4. Backend Integration**
- **Supabase Function:** `toolbox-dtma-console` (~494 lines)
- **API Endpoints:** DTMA status, restart, redeploy operations
- **Authentication:** DTMA bearer token management

### **5. Documentation & Scripts**
- **README.md:** Extensive DTMA architecture documentation (~200 lines)
- **Scripts:** Multiple SQL sync and management scripts
- **Planning Documents:** Various DTMA-related planning files

## **Proposed File Structure Changes**

### **Files/Directories to be REMOVED:**
```
/dtma/ (entire directory - ~4,872 lines)
/supabase/functions/toolbox-dtma-console/ (entire function)
/src/pages/ToolboxesPage.tsx
/src/pages/ToolboxDetailPage.tsx  
/src/lib/api/toolboxes.ts
/scripts/*dtma*.sql
/scripts/*toolbox*.sql
/scripts/sync-droplet-names.sql
```

### **Files to be MODIFIED:**
```
/README.md (Remove DTMA sections, ~200 lines to clean)
/src/routing/routeConfig.tsx (Remove toolbox routes)
/supabase/migrations/ (Create new migration for safe table removal)
```

### **Database Changes Required:**
```sql
-- Safe removal order (foreign key dependencies):
1. DROP TABLE agent_toolbox_access;
2. DROP TABLE account_tool_instances;  
3. DROP TABLE account_tool_environments;
4. DROP TABLE tool_catalog;
5. DROP related functions and triggers
6. DROP related RLS policies
7. DROP related indexes
```

## **Risk Assessment & Mitigation Strategy**

### **HIGH RISK - Database Dependencies**
- **Risk:** Foreign key constraints could prevent clean removal
- **Mitigation:** Create comprehensive backup and dependency mapping
- **Safety:** Use transaction-based removal with rollback capability

### **MEDIUM RISK - Frontend References**
- **Risk:** Broken imports or routing errors  
- **Mitigation:** Comprehensive grep search for all references
- **Safety:** Remove components before removing API layer

### **LOW RISK - Documentation Cleanup**
- **Risk:** Outdated references in documentation
- **Mitigation:** Systematic search and replace operations

## **Success Criteria**

1. ✅ **Complete DTMA Directory Removal** - `/dtma` completely deleted
2. ✅ **Database Schema Clean** - All DTMA tables and functions removed
3. ✅ **Frontend Component Removal** - No toolbox-related UI components
4. ✅ **API Layer Cleanup** - No DTMA service calls or endpoints
5. ✅ **Documentation Updated** - README.md and docs cleaned of DTMA references
6. ✅ **Application Stability** - No broken imports, routing, or database errors
7. ✅ **Build Success** - `npm run dev` and `npm run build` work without errors

## **Rollback Strategy**

In case of issues during removal:
1. **Database Rollback:** Restore from backup SQL dump
2. **File Rollback:** Restore from `docs/plans/dtma_removal_plan/backups/`
3. **Git Rollback:** Use git reset to previous working commit
4. **Service Restart:** Restart all services to clear cached references

## **Resource Requirements**

- **Estimated Time:** 4-6 hours for complete removal and testing
- **Dependencies:** Access to Supabase dashboard, Docker Desktop (for testing)
- **Testing:** Full application testing after each phase completion

## **Next Steps**

This plan will be executed via the Work Breakdown Structure (WBS) checklist which breaks down each component removal into detailed, actionable tasks with proper research, backup procedures, and verification steps. 