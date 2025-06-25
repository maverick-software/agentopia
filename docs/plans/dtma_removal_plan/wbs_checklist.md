# DTMA Removal - Work Breakdown Structure (WBS) Checklist

**Project:** Complete DTMA Feature Removal  
**Date:** 06/25/2025 12:09:00  
**Protocol:** plan_and_execute.mdc  
**Estimated Duration:** 4-6 hours  

---

## **PHASE 1: RESEARCH**

### **1.1. Database Dependency Analysis**
* [ ] 1.1.1. Map all foreign key relationships involving DTMA tables
  * **REQUIRED READING BEFORE STARTING:** [research/1.1.1_database_dependencies.md]
  * **Plan Review & Alignment:** Examine migration files to understand table relationships
  * **Future Intent:** Ensure safe removal order without cascade failures
  * **Cautionary Notes:** Foreign key violations can prevent removal - map dependencies first
  * **Backups:** Database schema dump to `/docs/plans/dtma_removal_plan/backups/`

* [ ] 1.1.2. Identify all database functions referencing DTMA tables
  * **REQUIRED READING BEFORE STARTING:** [research/1.1.2_database_functions.md]
  * **Plan Review & Alignment:** Check MCP functions and triggers
  * **Future Intent:** Remove functions before removing tables they reference
  * **Cautionary Notes:** Some functions may be shared - verify before removal
  * **Backups:** Function definitions to backup folder

* [ ] 1.1.3. Research Row Level Security (RLS) policies on DTMA tables
  * **REQUIRED READING BEFORE STARTING:** [research/1.1.3_rls_policies.md]
  * **Plan Review & Alignment:** Document all RLS policies for clean removal
  * **Future Intent:** Drop policies before dropping tables
  * **Cautionary Notes:** RLS policies must be removed in correct order
  * **Backups:** Policy definitions to backup folder

### **1.2. Frontend Component Analysis**
* [ ] 1.2.1. Catalog all React components referencing DTMA/Toolbox
  * **REQUIRED READING BEFORE STARTING:** [research/1.2.1_frontend_components.md]
  * **Plan Review & Alignment:** Use grep search to find all component references
  * **Future Intent:** Remove components in dependency order (child components first)
  * **Cautionary Notes:** Broken imports will cause build failures
  * **Backups:** Component files to backup folder

* [ ] 1.2.2. Map routing dependencies and navigation references
  * **REQUIRED READING BEFORE STARTING:** [research/1.2.2_routing_analysis.md]
  * **Plan Review & Alignment:** Check routeConfig.tsx and navigation components
  * **Future Intent:** Remove routes cleanly without breaking navigation
  * **Cautionary Notes:** Dead routes can cause 404 errors
  * **Backups:** Routing configuration to backup folder

### **1.3. API and Service Layer Analysis**
* [ ] 1.3.1. Document all DTMA-related API endpoints and calls
  * **REQUIRED READING BEFORE STARTING:** [research/1.3.1_api_endpoints.md]
  * **Plan Review & Alignment:** Review toolboxes.ts API layer and Supabase functions
  * **Future Intent:** Remove API layer after frontend component removal
  * **Cautionary Notes:** Frontend calls to removed APIs will cause runtime errors
  * **Backups:** API service files to backup folder

* [ ] 1.3.2. Identify Supabase Edge Function dependencies
  * **REQUIRED READING BEFORE STARTING:** [research/1.3.2_supabase_functions.md]
  * **Plan Review & Alignment:** Analyze toolbox-dtma-console function
  * **Future Intent:** Delete entire function directory after API removal
  * **Cautionary Notes:** Function calls from frontend must be removed first
  * **Backups:** Complete function to backup folder

---

## **PHASE 2: PLANNING**

### **2.1. Removal Order Strategy**
* [ ] 2.1.1. Create detailed removal sequence plan
  * **REQUIRED READING BEFORE STARTING:** [research/2.1.1_removal_sequence.md]
  * **Plan Review & Alignment:** Define safe order based on dependencies
  * **Future Intent:** Execute removal in planned sequence to avoid breaks
  * **Cautionary Notes:** Wrong sequence can cause cascading failures
  * **Backups:** Sequence plan document to backup folder

### **2.2. Backup Strategy Planning**
* [ ] 2.2.1. Design comprehensive backup approach
  * **REQUIRED READING BEFORE STARTING:** [research/2.2.1_backup_strategy.md]
  * **Plan Review & Alignment:** Plan backups for all file types and database elements
  * **Future Intent:** Enable complete rollback if issues occur
  * **Cautionary Notes:** Incomplete backups make rollback impossible
  * **Backups:** Backup strategy document to backup folder

---

## **PHASE 3: DESIGN**

### **3.1. Database Migration Design**
* [ ] 3.1.1. Design safe database table removal migration
  * **REQUIRED READING BEFORE STARTING:** [research/3.1.1_migration_design.md]
  * **Plan Review & Alignment:** Create transaction-based removal with rollback
  * **Future Intent:** Safely remove tables without data loss
  * **Cautionary Notes:** Non-transactional operations cannot be rolled back
  * **Backups:** Migration files to backup folder

### **3.2. Documentation Update Design**
* [ ] 3.2.1. Plan README.md and documentation cleanup
  * **REQUIRED READING BEFORE STARTING:** [research/3.2.1_documentation_plan.md]
  * **Plan Review & Alignment:** Identify all DTMA references for removal
  * **Future Intent:** Update documentation to reflect removed functionality
  * **Cautionary Notes:** Outdated docs can confuse future developers
  * **Backups:** Original documentation to backup folder

---

## **PHASE 4: DEVELOPMENT**

### **4.1. Backend Removal**
* [ ] 4.1.1. Remove DTMA main directory
  * **REQUIRED READING BEFORE STARTING:** [research/4.1.1_dtma_directory.md]
  * **Plan Review & Alignment:** Safely delete entire /dtma directory
  * **Future Intent:** Remove all DTMA source code and configuration
  * **Cautionary Notes:** Ensure no other services depend on DTMA components
  * **Backups:** Complete /dtma directory to backup folder

* [ ] 4.1.2. Remove Supabase DTMA function
  * **REQUIRED READING BEFORE STARTING:** [research/4.1.2_supabase_function.md]
  * **Plan Review & Alignment:** Delete toolbox-dtma-console function
  * **Future Intent:** Remove backend API for DTMA operations
  * **Cautionary Notes:** Verify no frontend calls remain before removal
  * **Backups:** Function directory to backup folder

### **4.2. Frontend Removal**
* [ ] 4.2.1. Remove toolbox-related React components
  * **REQUIRED READING BEFORE STARTING:** [research/4.2.1_react_components.md]
  * **Plan Review & Alignment:** Delete ToolboxesPage and related components
  * **Future Intent:** Clean frontend of all DTMA/toolbox UI elements
  * **Cautionary Notes:** Remove in dependency order to avoid import errors
  * **Backups:** Component files to backup folder

* [ ] 4.2.2. Update routing configuration
  * **REQUIRED READING BEFORE STARTING:** [research/4.2.2_routing_update.md]
  * **Plan Review & Alignment:** Remove toolbox routes from routeConfig.tsx
  * **Future Intent:** Clean routing of dead endpoints
  * **Cautionary Notes:** Test routing after changes to avoid 404s
  * **Backups:** Original routing files to backup folder

* [ ] 4.2.3. Remove API service layer
  * **REQUIRED READING BEFORE STARTING:** [research/4.2.3_api_removal.md]
  * **Plan Review & Alignment:** Delete toolboxes.ts and related API files
  * **Future Intent:** Remove frontend API calls to DTMA services
  * **Cautionary Notes:** Remove after components to avoid build errors
  * **Backups:** API service files to backup folder

### **4.3. Database Cleanup**
* [ ] 4.3.1. Execute database table removal migration
  * **REQUIRED READING BEFORE STARTING:** [research/4.3.1_database_migration.md]
  * **Plan Review & Alignment:** Run comprehensive table removal migration
  * **Future Intent:** Clean database of all DTMA-related tables and functions
  * **Cautionary Notes:** Test migration rollback before production execution
  * **Backups:** Database dump before migration execution

### **4.4. Script and Documentation Cleanup**
* [ ] 4.4.1. Remove DTMA-related scripts
  * **REQUIRED READING BEFORE STARTING:** [research/4.4.1_script_removal.md]
  * **Plan Review & Alignment:** Delete all DTMA sync and management scripts
  * **Future Intent:** Clean codebase of unused maintenance scripts
  * **Cautionary Notes:** Verify scripts aren't used by CI/CD before removal
  * **Backups:** Script files to backup folder

* [ ] 4.4.2. Update README.md and documentation
  * **REQUIRED READING BEFORE STARTING:** [research/4.4.2_documentation_update.md]
  * **Plan Review & Alignment:** Remove all DTMA references from documentation
  * **Future Intent:** Ensure documentation reflects current functionality
  * **Cautionary Notes:** Keep documentation consistent with codebase
  * **Backups:** Original documentation to backup folder

---

## **PHASE 5: TESTING**

### **5.1. Build Verification**
* [ ] 5.1.1. Test application build process
  * **REQUIRED READING BEFORE STARTING:** [research/5.1.1_build_testing.md]
  * **Plan Review & Alignment:** Verify npm run dev and npm run build work
  * **Future Intent:** Ensure removal didn't break build process
  * **Cautionary Notes:** Build errors indicate missing dependencies or imports
  * **Backups:** Build output logs for debugging

### **5.2. Frontend Testing**
* [ ] 5.2.1. Test application navigation and routing
  * **REQUIRED READING BEFORE STARTING:** [research/5.2.1_navigation_testing.md]
  * **Plan Review & Alignment:** Verify all routes work and no 404 errors
  * **Future Intent:** Ensure UI is fully functional after removal
  * **Cautionary Notes:** Dead routes or broken navigation affects user experience
  * **Backups:** Testing results and screenshots

### **5.3. Database Verification**
* [ ] 5.3.1. Verify database integrity and remaining functionality
  * **REQUIRED READING BEFORE STARTING:** [research/5.3.1_database_testing.md]
  * **Plan Review & Alignment:** Test remaining database operations work correctly
  * **Future Intent:** Ensure removal didn't break existing functionality
  * **Cautionary Notes:** Hidden dependencies might only show up during testing
  * **Backups:** Database test results

---

## **PHASE 6: REFINEMENT**

### **6.1. Performance Optimization**
* [ ] 6.1.1. Verify removal improved system performance
  * **REQUIRED READING BEFORE STARTING:** [research/6.1.1_performance_analysis.md]
  * **Plan Review & Alignment:** Measure build times and application responsiveness
  * **Future Intent:** Confirm removal provided expected benefits
  * **Cautionary Notes:** Should see improvement in build times and reduced complexity
  * **Backups:** Performance metrics and measurements

### **6.2. Final Cleanup**
* [ ] 6.2.1. Clean up backup files after verification
  * **REQUIRED READING BEFORE STARTING:** [research/6.2.1_final_cleanup.md]
  * **Plan Review & Alignment:** Move backups to archive after successful testing
  * **Future Intent:** Maintain clean project structure
  * **Cautionary Notes:** Only cleanup after complete verification of success
  * **Backups:** Archive location documentation

* [ ] 6.2.2. Update project documentation with removal details
  * **REQUIRED READING BEFORE STARTING:** [research/6.2.2_documentation_finalization.md]
  * **Plan Review & Alignment:** Document what was removed and why
  * **Future Intent:** Provide context for future developers
  * **Cautionary Notes:** Historical context helps understand architectural decisions
  * **Backups:** Updated documentation files

---

## **CLEANUP PHASE**

### **Final Steps**
* [ ] 7.1. Prompt user to test application functionality
* [ ] 7.2. Move backup folder to archive after user confirmation
* [ ] 7.3. Ensure archive folder is in .gitignore
* [ ] 7.4. Update root README.md with removal information
* [ ] 7.5. Create cleanup log entry in `/docs/logs/cleanup/dtma_removal_plan/`
* [ ] 7.6. Update cleanup table in `/docs/logs/README.md`

---

**Note:** Each checklist item must be completed with comprehensive research documentation before proceeding to implementation. Research files provide critical context and safety measures for successful execution. 