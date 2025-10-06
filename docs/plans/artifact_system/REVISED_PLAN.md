# Artifact System - Revised Implementation Plan
**Date**: October 6, 2025  
**Status**: ✅ Aligned with Brief v2.0 (Simplified)  
**Timeline**: 10-12 days

## 🎯 Scope: What We're Building

### ✅ INCLUDED Features

1. **Database Schema** (from Brief v2.0)
   - Single `artifacts` table with content stored directly
   - `artifact_versions` table for version history
   - No media_library dependency

2. **Canvas Mode** (from Brief v2.0)
   - Split-screen layout: 40% chat, 60% canvas
   - Monaco editor for code/HTML editing
   - Exit canvas returns to inline preview

3. **File Types** (from Brief v2.0)
   - **TXT** - Plain text files
   - **MD** (Markdown) - Formatted text
   - **JSON** - Data files
   - **HTML** - Web pages with Monaco editor
   - **Code files** (JS, TS, PY, etc.) - Syntax highlighted
   - CSV (simple table view)

4. **Core Features**
   - Inline preview in chat (artifact card)
   - Canvas mode for editing
   - Version control (automatic on save)
   - Download artifacts
   - Persistent storage across sessions/workspaces

5. **MCP Tools**
   - `create_artifact` - Create new artifacts
   - `update_artifact` - Edit existing (creates version)
   - `list_artifacts` - List conversation artifacts
   - `get_artifact` - Retrieve full content
   - `delete_artifact` - Remove artifacts

### ❌ EXCLUDED Features (Per Your Request)

1. ❌ Real-time collaboration (no cursor presence, no multi-user editing)
2. ❌ Semantic search (no Pinecone embeddings)
3. ❌ AI-generated change summaries (manual versioning only)
4. ❌ File format conversion (no DOCX↔HTML, HTML→PDF)
5. ❌ Collaborator permissions system (no `artifact_collaborators` table)
6. ❌ DOCX generation (Word documents)
7. ❌ PDF generation

## 📊 Simplified Database Schema

### Table: `artifacts`

```sql
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Context
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- Artifact Info
    title TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (
        file_type IN ('txt', 'md', 'json', 'html', 'javascript', 'typescript', 'python', 'java', 'css', 'csv')
    ),
    
    -- Content Storage
    content TEXT NOT NULL,  -- Store text content directly
    storage_path TEXT,      -- Optional: path in bucket for backup
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    is_latest_version BOOLEAN DEFAULT true,
    
    -- Metadata
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,  -- file_size, line_count, etc.
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
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

-- Indexes
CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX idx_artifacts_agent_id ON artifacts(agent_id);
CREATE INDEX idx_artifacts_conversation_id ON artifacts(conversation_id);
CREATE INDEX idx_artifacts_workspace_id ON artifacts(workspace_id);
CREATE INDEX idx_artifacts_file_type ON artifacts(file_type);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX idx_artifacts_latest ON artifacts(is_latest_version) WHERE is_latest_version = true;
```

### Table: `artifact_versions` (Simplified)

```sql
CREATE TABLE artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    
    -- Version Info
    version_number INTEGER NOT NULL,
    
    -- Content Snapshot
    content TEXT NOT NULL,
    storage_path TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES auth.users(id),
    changes_note TEXT,  -- Optional user note about changes
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_artifact_version UNIQUE (artifact_id, version_number)
);

-- Indexes
CREATE INDEX idx_artifact_versions_artifact_id ON artifact_versions(artifact_id);
CREATE INDEX idx_artifact_versions_created_at ON artifact_versions(created_at DESC);
```

### RLS Policies (Simplified)

```sql
-- artifacts table
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Users can view own artifacts or artifacts in their conversations/workspaces
CREATE POLICY "Users can view own artifacts" ON artifacts
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can create artifacts
CREATE POLICY "Users can create artifacts" ON artifacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own artifacts
CREATE POLICY "Users can update own artifacts" ON artifacts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete own artifacts
CREATE POLICY "Users can delete own artifacts" ON artifacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- artifact_versions table
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of artifacts they can view
CREATE POLICY "Users can view artifact versions" ON artifact_versions
  FOR SELECT
  USING (
    artifact_id IN (
      SELECT id FROM artifacts WHERE auth.uid() = user_id
    )
  );

-- Users can create versions
CREATE POLICY "Users can create versions" ON artifact_versions
  FOR INSERT
  WITH CHECK (
    artifact_id IN (
      SELECT id FROM artifacts WHERE auth.uid() = user_id
    )
  );
```

## 🗂️ Simplified Storage Structure

```
media-library/
  {user_id}/
    artifacts/
      {artifact_id}_v{version}.{ext}

Examples:
  media-library/550e8400-e29b-41d4-a716-446655440000/artifacts/artifact-123_v1.txt
  media-library/550e8400-e29b-41d4-a716-446655440000/artifacts/artifact-123_v2.txt
  media-library/550e8400-e29b-41d4-a716-446655440000/artifacts/artifact-456_v1.html
```

**Note**: Content is stored in `artifacts.content` column. Bucket storage is **optional backup** only.

## 📦 Simplified Dependencies

### Required (Keep):
```json
{
  "@monaco-editor/react": "^4.6.0",  // Code/HTML editor
  "react-split": "^2.0.14",          // Split panel layout
  "file-saver": "^2.0.5",            // File downloads
  "diff": "^5.2.0"                   // Version comparison (optional)
}
```

### NOT Required (Remove from brief):
```json
{
  "docx": "...",      // ❌ Not doing Word docs
  "jspdf": "...",     // ❌ Not doing PDF generation
  "pdf-lib": "...",   // ❌ Not doing PDF manipulation
  "mammoth": "...",   // ❌ Not doing DOCX conversion
  "turndown": "..."   // ❌ Not doing HTML→Markdown
}
```

## 🏗️ Component Architecture

### Core Components

```
src/components/artifacts/
├── ArtifactCard.tsx              (~200 lines) - Inline preview in chat
├── CanvasLayout.tsx              (~250 lines) - Split-screen container
├── CanvasPanel.tsx               (~300 lines) - Right panel with editor
├── MonacoEditor.tsx              (~200 lines) - Code/HTML editor wrapper
├── ArtifactViewer.tsx            (~150 lines) - Read-only viewer
├── VersionHistory.tsx            (~200 lines) - Version list & diff
└── types/
    └── artifact-types.ts         (~100 lines) - TypeScript interfaces
```

### Canvas Mode Integration

```
AgentChatPage (with canvas state)
│
├── When canvas closed: Normal chat (full width)
│   └── MessageList
│       └── ArtifactCard (inline preview)
│           └── "Open Canvas" button
│
└── When canvas open: Split-screen layout
    ├── ChatColumn (40% width, compressed)
    │   └── MessageList (scrollable)
    │
    └── CanvasPanel (60% width)
        ├── Header (title, close button, actions)
        ├── MonacoEditor (for editing)
        └── Footer (version info, save status)
```

## 📋 Revised Phase Breakdown

### Phase 1: Database & Backend (3 days)

**Day 1: Database**
- [ ] Create `artifacts` table (simplified schema)
- [ ] Create `artifact_versions` table
- [ ] Add RLS policies
- [ ] Create triggers (auto-version, updated_at)
- [ ] Test migration

**Day 2: Edge Functions**
- [ ] Create `artifact-mcp/index.ts`
- [ ] Implement `create_artifact` (store in artifacts.content)
- [ ] Implement `update_artifact` (create version snapshot)
- [ ] Implement `list_artifacts`
- [ ] Implement `get_artifact`
- [ ] Implement `delete_artifact`

**Day 3: Tool Integration**
- [ ] Add tools to `get-agent-tools/index.ts`
- [ ] Add routing to `universal-tool-executor.ts`
- [ ] Add parameter schemas to `tool-generator.ts`
- [ ] Deploy all functions
- [ ] Test tool execution

### Phase 2: Canvas Mode & UI (4 days)

**Day 4: Dependencies & Canvas Layout**
- [ ] Install: `@monaco-editor/react`, `react-split`, `file-saver`
- [ ] Create `CanvasLayout.tsx` with split panels
- [ ] Integrate into `AgentChatPage`
- [ ] Add canvas open/close state management
- [ ] Test split-screen resize

**Day 5: Monaco Editor Integration**
- [ ] Create `MonacoEditor.tsx` wrapper
- [ ] Add syntax highlighting for file types
- [ ] Add auto-save (debounced)
- [ ] Add language detection
- [ ] Test editing flow

**Day 6: Artifact Card & Inline Preview**
- [ ] Create `ArtifactCard.tsx`
- [ ] Add file type icons
- [ ] Add "Open Canvas" button
- [ ] Integrate with `MessageComponents.tsx`
- [ ] Test in chat interface

**Day 7: Canvas Panel & Actions**
- [ ] Create `CanvasPanel.tsx`
- [ ] Add header (title, close, download)
- [ ] Add footer (version info, save status)
- [ ] Wire up editor to save endpoint
- [ ] Test end-to-end creation & editing

### Phase 3: Versioning & Polish (3 days)

**Day 8: Version System**
- [ ] Create `VersionHistory.tsx`
- [ ] List all versions of artifact
- [ ] Add "Restore Version" action
- [ ] Optional: Add diff view using `diff` library
- [ ] Test version creation on edit

**Day 9: File Type Support**
- [ ] Test with TXT files
- [ ] Test with Markdown
- [ ] Test with JSON
- [ ] Test with HTML
- [ ] Test with JavaScript/TypeScript
- [ ] Add CSV basic viewer (table)

**Day 10: Polish & Testing**
- [ ] Mobile responsiveness
- [ ] Keyboard shortcuts (Cmd+S save, Esc close)
- [ ] Loading states
- [ ] Error handling
- [ ] Download functionality
- [ ] Cross-browser testing

## 🔄 Data Flow

### Creating an Artifact

```
1. User: "Create a REST API client in TypeScript"
   ↓
2. Agent (via LLM): Calls create_artifact MCP tool
   {
     title: "REST API Client",
     file_type: "typescript",
     content: "export class ApiClient { ... }"
   }
   ↓
3. artifact-mcp function:
   - Insert into artifacts table (content stored in TEXT column)
   - Optionally backup to storage bucket
   - Return artifact_id
   ↓
4. Chat function:
   - Save message with metadata.artifacts = [{ id, title, type, preview }]
   - Return to frontend
   ↓
5. Frontend:
   - Render message with ArtifactCard
   - Show "Open Canvas" button
```

### Editing an Artifact

```
1. User clicks "Open Canvas" on artifact card
   ↓
2. Frontend:
   - Set canvasArtifactId state
   - Fetch full artifact via get_artifact
   - Compress chat to 40%, show canvas at 60%
   - Load content into Monaco editor
   ↓
3. User edits content
   ↓
4. Auto-save (debounced 1 second):
   - Call update_artifact MCP tool
   - Backend creates new version in artifact_versions
   - Updates artifact.version += 1
   - Updates artifact.content with new content
   ↓
5. User clicks "Close Canvas"
   - Canvas closes, chat returns to full width
   - Artifact card shows updated preview
```

## ✅ Success Criteria

### Phase 1 Complete When:
- ✅ Artifacts table exists with proper schema
- ✅ MCP tools create/update/list/get artifacts
- ✅ Versions save on each edit

### Phase 2 Complete When:
- ✅ Canvas mode opens in split-screen
- ✅ Monaco editor edits code/HTML
- ✅ Artifact cards display in chat
- ✅ Can close canvas and return to chat

### Phase 3 Complete When:
- ✅ All file types supported
- ✅ Version history shows past versions
- ✅ Download works
- ✅ Mobile responsive

## 🎯 Key Differences from Original Plan

| Original Plan | Revised Plan |
|--------------|--------------|
| Two tables (artifacts + media_library) | Single artifacts table |
| Full-screen modal | Split-screen canvas (40/60) |
| Basic syntax highlighting | Monaco editor |
| Multiple artifact types | Focus on code/text files |
| Media library integration | Standalone artifacts system |

## 🚀 Timeline Summary

- **Phase 1**: 3 days (Database & Backend)
- **Phase 2**: 4 days (Canvas Mode & UI)
- **Phase 3**: 3 days (Versioning & Polish)

**Total**: **10 days** (vs original 8-10 days, still on track!)

---

**Status**: ✅ **Ready for Implementation**  
**Next Step**: Update WBS_CHECKLIST.md with these simplified tasks  
**Last Updated**: October 6, 2025

