# Archived Datastore Documents System

**Archive Date:** October 13, 2025 1:26 PM  
**Reason:** Replaced by Media Library system

## System Overview

The datastore documents system was the original agent-centric document upload and processing system. Documents were uploaded per-agent through the "What I Know" modal and stored in the `datastore_documents` table.

## What Was Replaced

### Old System (datastore_documents)
- **Architecture:** Agent-centric (one document per agent)
- **Upload:** Via "What I Know" modal only
- **Storage:** `datastore-documents` bucket with path `{userName}/{agentName}/{fileName}`
- **Processing:** Direct to Pinecone/GetZep per agent
- **Table:** `datastore_documents` with agent_id foreign key

### New System (media_library)
- **Architecture:** User-centric centralized library
- **Upload:** WordPress-style media library interface
- **Storage:** `media-library` bucket with better organization
- **Processing:** Upload once, assign to multiple agents
- **Tables:** `media_library`, `agent_media_assignments`, `media_processing_logs`, `media_categories`
- **Features:** Categories, tags, versioning, analytics, better search

## Edge Function Archived

**process-datastore-document/** - Document processing edge function
- Handled text extraction from uploads
- Chunked content for vector storage
- Inserted metadata into `datastore_documents` table
- Processed to Pinecone/GetZep datastores

## Migration Path

**Replaced by:**
- Edge functions: `media-library-api`, `media-library-mcp`
- Frontend: `MediaLibraryPage.tsx`, `MediaLibrarySelector.tsx`
- Database migrations: 
  - `20250830_140000_create_media_library_schema.sql`
  - `20250831_140001_create_media_mcp_tools.sql`

## Database Table Removed

Migration: `20251013184200_drop_old_datastore_documents.sql`

## Restoration

Not recommended - the new media library system is significantly more feature-rich and flexible. If needed, old documents would need manual migration to the new schema.

