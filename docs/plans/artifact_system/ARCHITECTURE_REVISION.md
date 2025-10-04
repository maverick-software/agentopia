# Artifact System Architecture - Revised Design
**Date**: October 4, 2025  
**Revision**: 1.0 - Dedicated Artifacts Table with Media Library Storage

## 🎯 Architectural Decision

### **Two-Table Approach (RECOMMENDED)**

Create a dedicated `artifacts` table for artifact-specific metadata and references, while leveraging the existing `media_library` table for actual content storage.

## 📊 Database Schema Design

### Table 1: `artifacts` (Reference & Metadata)

This table stores artifact-specific information and links to conversations/messages.

```sql
-- =============================================
-- Artifacts Table - Reference and Metadata
-- =============================================

CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership and Context
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- Artifact Identification
    title TEXT NOT NULL,
    artifact_type TEXT NOT NULL CHECK (
        artifact_type IN (
            'code',
            'document', 
            'markdown',
            'html',
            'json',
            'csv',
            'image',
            'chart',
            'diagram',
            'table',
            'mermaid'
        )
    ),
    
    -- Language/Format (for code artifacts)
    language TEXT,
    -- Examples: 'javascript', 'python', 'typescript', 'java', 'go', 'rust', etc.
    
    -- Storage Reference
    media_library_id UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
    -- Links to the actual content in media_library
    
    -- Artifact Metadata
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    artifact_metadata JSONB DEFAULT '{}'::jsonb,
    -- Stores: { theme, fontSize, lineNumbers, chartType, etc. }
    
    -- Versioning
    version INTEGER DEFAULT 1,
    version_parent_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    is_latest_version BOOLEAN DEFAULT true,
    
    -- Display Settings
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (
        status IN ('active', 'archived', 'deleted')
    ),
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT artifacts_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
    CONSTRAINT artifacts_version_positive CHECK (version > 0)
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX idx_artifacts_agent_id ON artifacts(agent_id);
CREATE INDEX idx_artifacts_conversation_id ON artifacts(conversation_id);
CREATE INDEX idx_artifacts_message_id ON artifacts(message_id);
CREATE INDEX idx_artifacts_media_library_id ON artifacts(media_library_id);
CREATE INDEX idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX idx_artifacts_status ON artifacts(status) WHERE status = 'active';
CREATE INDEX idx_artifacts_latest_version ON artifacts(is_latest_version) WHERE is_latest_version = true;

-- Composite index for common queries
CREATE INDEX idx_artifacts_user_conversation ON artifacts(user_id, conversation_id, created_at DESC);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own artifacts
CREATE POLICY "Users can view own artifacts" ON artifacts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can view artifacts in their conversations
CREATE POLICY "Users can view conversation artifacts" ON artifacts
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create artifacts (via agents)
CREATE POLICY "Users can create artifacts" ON artifacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own artifacts
CREATE POLICY "Users can update own artifacts" ON artifacts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own artifacts
CREATE POLICY "Users can delete own artifacts" ON artifacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- Triggers for Automatic Updates
-- =============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_artifacts_updated_at();

-- Update version parent when creating new version
CREATE OR REPLACE FUNCTION update_artifact_version_parent()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new version, mark previous versions as not latest
    IF NEW.version_parent_id IS NOT NULL THEN
        UPDATE artifacts 
        SET is_latest_version = false 
        WHERE id = NEW.version_parent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_artifact_version_parent
    AFTER INSERT ON artifacts
    FOR EACH ROW
    WHEN (NEW.version_parent_id IS NOT NULL)
    EXECUTE FUNCTION update_artifact_version_parent();
```

### Table 2: `media_library` (Content Storage)

The existing table is used as-is, with artifacts storing their content here. No schema changes needed!

**How it works:**
1. When agent creates artifact → Insert into `media_library` first (stores actual content)
2. Then insert into `artifacts` table (stores metadata + reference to media_library)
3. Query artifacts by joining with media_library when full content needed

## 🏗️ Architecture Benefits

### ✅ Advantages of This Approach

1. **Clear Separation of Concerns**
   - `artifacts` = artifact-specific metadata and chat context
   - `media_library` = universal content storage
   - Clean semantic meaning

2. **Reuse Existing Infrastructure**
   - Media library already has file storage, URLs, processing status
   - No need to duplicate storage logic
   - Existing RLS policies on media_library still work

3. **Unified Content Management**
   - All user content (uploaded + agent-created) in one place
   - Media library page can show everything
   - Consistent storage patterns

4. **Better Query Performance**
   - Artifact-specific queries don't scan media_library
   - Can query artifacts without loading full content
   - Join only when needed

5. **Easier Versioning**
   - Each artifact version points to different media_library entry
   - No need to duplicate large content in artifacts table
   - Version history clear and manageable

6. **Flexible Metadata**
   - Artifact-specific metadata in artifacts table
   - Storage-specific metadata in media_library
   - No confusion between the two

## 📋 Data Flow Examples

### Example 1: Creating a Code Artifact

```typescript
// Step 1: Agent wants to create code artifact
const artifactRequest = {
  title: "User Authentication Module",
  artifact_type: "code",
  language: "typescript",
  content: "export class AuthService { ... }", // 5KB of code
  description: "Complete authentication service with JWT support"
};

// Step 2: Insert into media_library first
const mediaEntry = await supabase
  .from('media_library')
  .insert({
    user_id: userId,
    file_name: 'auth-service.ts',
    file_type: 'text/typescript',
    file_size: 5120,
    file_extension: 'ts',
    storage_bucket: 'media-library',
    storage_path: `${userId}/artifacts/${timestamp}_auth-service.ts`,
    text_content: artifactRequest.content, // Store in text_content
    category: 'artifacts',
    processing_status: 'completed',
    source_type: 'agent_created', // New field we'll add
    created_by_agent_id: agentId
  })
  .select()
  .single();

// Step 3: Create artifact reference
const artifact = await supabase
  .from('artifacts')
  .insert({
    user_id: userId,
    agent_id: agentId,
    conversation_id: conversationId,
    message_id: messageId,
    title: artifactRequest.title,
    artifact_type: 'code',
    language: 'typescript',
    media_library_id: mediaEntry.id, // Link to content
    description: artifactRequest.description,
    artifact_metadata: {
      theme: 'vs-dark',
      lineNumbers: true,
      fontSize: 14
    }
  })
  .select()
  .single();

// Step 4: Return artifact reference to chat
return {
  artifact_id: artifact.id,
  media_id: mediaEntry.id,
  title: artifact.title,
  type: artifact.artifact_type,
  preview: artifactRequest.content.substring(0, 500)
};
```

### Example 2: Retrieving Artifact with Content

```typescript
// Query artifact with full content (uses JOIN)
const { data: artifact } = await supabase
  .from('artifacts')
  .select(`
    *,
    media_library:media_library_id (
      id,
      file_name,
      text_content,
      file_url,
      file_size,
      storage_path
    )
  `)
  .eq('id', artifactId)
  .single();

// Now artifact has:
// - artifact.title, artifact.artifact_type, etc.
// - artifact.media_library.text_content (the actual code/content)
// - artifact.media_library.file_url (if binary file)
```

### Example 3: Listing Artifacts in Conversation

```typescript
// Get all artifacts in conversation (metadata only)
const { data: artifacts } = await supabase
  .from('artifacts')
  .select(`
    id,
    title,
    artifact_type,
    language,
    description,
    created_at,
    view_count
  `)
  .eq('conversation_id', conversationId)
  .eq('status', 'active')
  .eq('is_latest_version', true)
  .order('created_at', { ascending: false });

// Fast query - no content loaded
// Load content only when user clicks to view
```

## 🔄 Migration Strategy

### Phase 1: Add source_type to media_library (Optional but Recommended)

```sql
-- Add column to distinguish user uploads from agent creations
ALTER TABLE media_library 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'user_upload' 
  CHECK (source_type IN ('user_upload', 'agent_created'));

-- Add created_by_agent_id
ALTER TABLE media_library
ADD COLUMN IF NOT EXISTS created_by_agent_id UUID 
  REFERENCES agents(id) ON DELETE SET NULL;

-- Index for filtering
CREATE INDEX idx_media_library_source_type ON media_library(source_type);
CREATE INDEX idx_media_library_agent_id ON media_library(created_by_agent_id);
```

### Phase 2: Create artifacts table

```sql
-- Full artifacts table creation (as shown above)
```

### Phase 3: Update existing types

```typescript
// Update TypeScript types in src/types/database.types.ts
export interface Artifact {
  id: string;
  user_id: string;
  agent_id: string;
  conversation_id: string | null;
  message_id: string | null;
  title: string;
  artifact_type: ArtifactType;
  language: string | null;
  media_library_id: string;
  description: string | null;
  tags: string[];
  artifact_metadata: Record<string, any>;
  version: number;
  version_parent_id: string | null;
  is_latest_version: boolean;
  status: 'active' | 'archived' | 'deleted';
  view_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export type ArtifactType = 
  | 'code' 
  | 'document' 
  | 'markdown' 
  | 'html' 
  | 'json' 
  | 'csv'
  | 'image' 
  | 'chart' 
  | 'diagram' 
  | 'table'
  | 'mermaid';
```

## 🎨 Query Patterns

### Pattern 1: Get Artifact Preview (Fast)

```sql
-- Just metadata, no content
SELECT 
  id,
  title,
  artifact_type,
  language,
  description,
  created_at
FROM artifacts
WHERE conversation_id = $1
  AND status = 'active';
```

### Pattern 2: Get Artifact with Content (Slower)

```sql
-- Full artifact with content
SELECT 
  a.*,
  m.text_content,
  m.file_url,
  m.file_size
FROM artifacts a
JOIN media_library m ON a.media_library_id = m.id
WHERE a.id = $1;
```

### Pattern 3: Get All Artifacts for User

```sql
-- User's artifact gallery
SELECT 
  a.id,
  a.title,
  a.artifact_type,
  a.created_at,
  m.file_url,
  m.file_size,
  ag.name as agent_name
FROM artifacts a
JOIN media_library m ON a.media_library_id = m.id
JOIN agents ag ON a.agent_id = ag.id
WHERE a.user_id = $1
  AND a.status = 'active'
  AND a.is_latest_version = true
ORDER BY a.created_at DESC;
```

## 📊 Comparison: Old vs New Approach

| Aspect | Old (Extend media_library) | New (Separate artifacts table) |
|--------|---------------------------|-------------------------------|
| **Clarity** | Mixed concerns | Clear separation |
| **Queries** | Must scan media_library | Fast artifact-only queries |
| **Versioning** | Complex | Clean and simple |
| **Metadata** | Overloaded JSONB | Structured columns |
| **Migrations** | Modify existing table | New table, no conflicts |
| **Semantics** | Confusing | Clear intent |
| **Performance** | Slower for artifact lists | Fast metadata, lazy content |
| **Storage** | Duplicate logic | Reuse existing |

## ✅ Final Recommendation

**Use the two-table approach:**
1. Create dedicated `artifacts` table for metadata and references
2. Store actual content in existing `media_library` table
3. Join tables only when full content is needed

This gives us the best of both worlds:
- Clean, semantic artifact management
- Reuse of existing storage infrastructure
- Fast queries and clear data model
- Easy to extend and maintain

---

**Next Steps:**
1. Update WBS_CHECKLIST.md with revised database schema steps
2. Update IMPLEMENTATION_PLAN.md with two-table approach
3. Begin Phase 1 implementation with new schema

