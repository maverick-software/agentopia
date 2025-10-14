# Archived Unused Features

**Archive Date:** October 13, 2025 1:31 PM  
**Reason:** Features exist in code but tables are empty - never used

## Features Archived

### 1. Advanced Reasoning System
**Directory:** `supabase/functions/advanced-reasoning/`

**Description:** Sophisticated iterative Markov chain reasoning system for complex multi-step reasoning tasks.

**Components:**
- `index.ts` - Main reasoning endpoint
- `reasoning/iterative-markov-controller.ts` - Markov chain controller (~750 lines)
- `reasoning/types.ts` - Type definitions
- Full implementation with state management, confidence scoring, memory integration

**Database Tables Dropped:**
- `reasoning_sessions` - Migration: 20251013184300
- `reasoning_steps` - Migration: 20251013184300

**Why Archived:**
- Tables were completely empty
- Feature never called/used by user
- Complex feature (~1000+ lines) that adds maintenance burden
- If needed in future, can be restored from archive

---

### 2. System Monitoring
**File:** `supabase/functions/chat/core/monitoring/monitoring_system.ts`

**Description:** System health monitoring and alerting infrastructure.

**Features:**
- Health check system
- Alert management
- Database health monitoring
- Performance tracking

**Database Tables Dropped:**
- `system_health` - Migration: 20251013184100
- `system_alerts` - Migration: 20251013184100

**Why Archived:**
- Tables were empty
- Monitoring system never activated
- Health checks only did SELECT queries, never stored data
- Alerts never triggered

---

## Restoration

If these features are needed in future:

1. **Restore code from archive**
2. **Recreate database tables** from original migrations
3. **Test thoroughly** before deploying

## Related Code Cleanup Needed

The following files may still have references to removed features:

- `supabase/functions/chat/processor/*` - May reference reasoning
- Check imports and type definitions for cleanup

