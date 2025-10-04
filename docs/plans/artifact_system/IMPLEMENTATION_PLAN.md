# Artifact System Implementation Plan
**Date**: October 4, 2025  
**Project**: AI Agent Artifact Creation & Management System  
**Goal**: Implement Claude/ChatGPT/Cursor-style artifact system for agent-created content

## 🎯 Project Overview

**Current System**: 
- Existing media library for user-uploaded documents
- Chat interface with message rendering
- MCP tool infrastructure for agent capabilities

**Target System**: 
- Agents can create artifacts (code, documents, images, charts, etc.)
- Beautiful UI for artifact display within chat messages
- Export, edit, and version control for artifacts
- Seamless integration with existing media library

## 📋 System Architecture

### 1. Database Schema Design

#### Two-Table Architecture (RECOMMENDED)

Create a dedicated `artifacts` table for artifact-specific metadata and references, while leveraging the existing `media_library` table for actual content storage.

**See detailed architecture in**: `docs/plans/artifact_system/ARCHITECTURE_REVISION.md`

#### Table 1: `artifacts` (Reference & Metadata)

```sql
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- Artifact identification
    title TEXT NOT NULL,
    artifact_type TEXT NOT NULL CHECK (
        artifact_type IN ('code', 'document', 'image', 'chart', 'diagram', 'table', 'json', 'html', 'markdown')
    ),
    language TEXT, -- For code: javascript, python, etc.
    
    -- Storage Reference (KEY CHANGE: Link to media_library instead of storing content)
    media_library_id UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
    
    -- Metadata
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    artifact_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    version_parent_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT artifacts_title_length CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX idx_artifacts_agent_id ON artifacts(agent_id);
CREATE INDEX idx_artifacts_conversation_id ON artifacts(conversation_id);
CREATE INDEX idx_artifacts_message_id ON artifacts(message_id);
CREATE INDEX idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);
```

#### Table 2: `media_library` (Content Storage)

The existing `media_library` table stores actual content. We'll add optional fields:

```sql
-- Add to media_library for better tracking
ALTER TABLE media_library 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'user_upload' 
  CHECK (source_type IN ('user_upload', 'agent_created'));

ALTER TABLE media_library
ADD COLUMN IF NOT EXISTS created_by_agent_id UUID 
  REFERENCES agents(id) ON DELETE SET NULL;
```

**Benefits of Two-Table Approach**:
- ✅ Clear separation of concerns (artifacts = metadata, media_library = storage)
- ✅ Fast artifact-only queries without loading content
- ✅ Reuse existing storage infrastructure
- ✅ Clean versioning (each version points to different media_library entry)
- ✅ Unified content management (all content in one place)
- ✅ Better performance (join only when needed)

**Why This is Better**:
- Artifact metadata queries don't scan large content fields
- Media library already handles file storage, URLs, processing
- Clear semantic meaning: artifacts = agent creations, media_library = storage
- Easier to extend with artifact-specific features

### 2. MCP Tool Development

Create edge function: `supabase/functions/artifact-mcp/index.ts`

#### Tool Capabilities:

1. **create_artifact**
   - Creates new artifact from agent-generated content
   - Supports multiple artifact types
   - Auto-saves to media library
   - Returns artifact ID and display metadata

2. **update_artifact**
   - Updates existing artifact content
   - Creates new version (optional)
   - Maintains version history

3. **list_artifacts**
   - Lists artifacts for current conversation
   - Filters by type, agent, date
   - Returns metadata for display

4. **get_artifact**
   - Retrieves full artifact content
   - Includes version history
   - Returns formatted for display

5. **delete_artifact**
   - Soft delete (archives) artifact
   - Maintains reference in chat history

### 3. Frontend Architecture

#### Component Structure

```
src/components/artifacts/
├── ArtifactViewer.tsx              (~300 lines) - Main artifact display container
├── ArtifactTypes/
│   ├── CodeArtifact.tsx            (~250 lines) - Code preview with syntax highlighting
│   ├── DocumentArtifact.tsx        (~200 lines) - Document display with markdown
│   ├── ImageArtifact.tsx           (~150 lines) - Image viewer with zoom
│   ├── ChartArtifact.tsx           (~200 lines) - Chart display (Chart.js/Recharts)
│   ├── DiagramArtifact.tsx         (~180 lines) - Mermaid/diagram display
│   ├── TableArtifact.tsx           (~150 lines) - Data table display
│   └── JsonArtifact.tsx            (~120 lines) - JSON viewer
├── ArtifactCard.tsx                (~180 lines) - Compact artifact card in message
├── ArtifactModal.tsx               (~250 lines) - Full-screen artifact viewer
├── ArtifactActions.tsx             (~150 lines) - Export, edit, version controls
├── ArtifactVersionHistory.tsx      (~180 lines) - Version comparison view
└── types/
    └── artifact-types.ts           (~100 lines) - TypeScript interfaces
```

#### Message Integration

Update `src/components/chat/MessageComponents.tsx`:

```typescript
// Add artifact display in message rendering
{message.metadata?.artifacts && message.metadata.artifacts.length > 0 && (
  <div className="mt-3 space-y-2">
    {message.metadata.artifacts.map((artifact: any) => (
      <ArtifactCard
        key={artifact.id}
        artifact={artifact}
        onView={() => handleViewArtifact(artifact.id)}
        onExport={() => handleExportArtifact(artifact.id)}
      />
    ))}
  </div>
)}
```

### 4. Artifact Types & Rendering

#### Code Artifacts
- Syntax highlighting using `react-syntax-highlighter` or `prism-react-renderer`
- Line numbers and copy button
- Language-specific themes
- Download as file

#### Document Artifacts
- Markdown rendering using `react-markdown`
- Rich text display
- Export to PDF, DOCX, TXT
- Print functionality

#### Image Artifacts
- AI-generated images
- Screenshots
- Diagrams
- Zoom and pan controls

#### Chart Artifacts
- Data visualizations
- Interactive charts using Chart.js or Recharts
- Export as PNG/SVG
- Data table view

#### JSON Artifacts
- Pretty-printed JSON viewer
- Collapsible tree structure
- Copy to clipboard
- Syntax highlighting

### 5. Implementation Phases

#### Phase 1: Database & Backend (Days 1-2)
- [ ] **1.1**: Create migration to extend media_library table
- [ ] **1.2**: Add RLS policies for artifact access
- [ ] **1.3**: Create artifact-mcp edge function
- [ ] **1.4**: Implement create_artifact tool
- [ ] **1.5**: Implement list_artifacts tool
- [ ] **1.6**: Add tool routing in universal-tool-executor.ts
- [ ] **1.7**: Add parameter generation in tool-generator.ts
- [ ] **1.8**: Deploy and test edge functions

#### Phase 2: Core UI Components (Days 3-4)
- [ ] **2.1**: Create artifact TypeScript types
- [ ] **2.2**: Build ArtifactCard component (compact view)
- [ ] **2.3**: Build CodeArtifact component
- [ ] **2.4**: Build DocumentArtifact component
- [ ] **2.5**: Build ImageArtifact component
- [ ] **2.6**: Build ArtifactViewer component (container)
- [ ] **2.7**: Integrate with MessageComponents.tsx
- [ ] **2.8**: Test artifact display in chat

#### Phase 3: Advanced Features (Days 5-6)
- [ ] **3.1**: Build ArtifactModal (full-screen view)
- [ ] **3.2**: Add ChartArtifact component
- [ ] **3.3**: Add JsonArtifact component
- [ ] **3.4**: Build ArtifactActions (export, edit, version)
- [ ] **3.5**: Implement artifact versioning
- [ ] **3.6**: Add artifact search/filter
- [ ] **3.7**: Build ArtifactVersionHistory component

#### Phase 4: Integration & Polish (Days 7-8)
- [ ] **4.1**: Integrate with media library page
- [ ] **4.2**: Add artifact analytics
- [ ] **4.3**: Implement export functionality
- [ ] **4.4**: Add keyboard shortcuts
- [ ] **4.5**: Performance optimization
- [ ] **4.6**: Mobile responsiveness
- [ ] **4.7**: Accessibility improvements (WCAG AA)
- [ ] **4.8**: Documentation and user guide

## 📐 Technical Specifications

### Artifact Message Metadata Structure

```typescript
interface MessageWithArtifacts extends Message {
  metadata?: {
    artifacts?: Array<{
      id: string;
      title: string;
      artifact_type: 'code' | 'document' | 'image' | 'chart' | 'diagram' | 'table' | 'json' | 'html' | 'markdown';
      language?: string;
      preview_content?: string; // First 500 chars for preview
      full_content_url?: string; // For large artifacts
      thumbnail_url?: string; // For images
      metadata?: {
        theme?: string;
        fontSize?: number;
        lineNumbers?: boolean;
        [key: string]: any;
      };
      created_at: string;
      file_size?: number;
    }>;
    // ... other metadata
  };
}
```

### Agent Tool Response Format

```typescript
interface CreateArtifactResponse {
  success: boolean;
  data?: {
    artifact_id: string;
    title: string;
    artifact_type: string;
    storage_path: string;
    file_url?: string;
    metadata: {
      language?: string;
      line_count?: number;
      char_count?: number;
      [key: string]: any;
    };
  };
  error?: string;
}
```

### Artifact Storage Strategy

1. **Text-based artifacts** (code, markdown, JSON):
   - Store in `media_library.text_content` column
   - No separate file needed for < 1MB
   - Indexed for search

2. **Binary artifacts** (images, PDFs):
   - Store in Supabase Storage `artifacts` bucket
   - Reference URL in `media_library.file_url`
   - Generate thumbnails for preview

3. **Large artifacts** (> 1MB):
   - Store in Supabase Storage
   - Cache metadata in database
   - Lazy-load content on demand

## 🎨 UI/UX Design Principles

### Visual Design
- **Claude-inspired**: Clean, minimalist artifact cards
- **Expandable**: Click to view full artifact in modal
- **Responsive**: Mobile-optimized views
- **Themed**: Respect light/dark mode preferences

### Interaction Patterns
- **Quick Actions**: Copy, Download, Edit, Version History
- **Keyboard Shortcuts**: 
  - `Cmd+C`: Copy artifact content
  - `Cmd+S`: Save/Download artifact
  - `Cmd+E`: Edit artifact
  - `Esc`: Close modal
- **Drag & Drop**: Reorder artifacts, export to desktop
- **Search**: Find artifacts across conversations

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: ARIA labels and descriptions
- **High Contrast**: Meets WCAG AA standards
- **Focus Indicators**: Clear focus states

## 🔒 Security Considerations

### RLS Policies

```sql
-- Users can only view artifacts they own or from their conversations
CREATE POLICY "Users can view own artifacts" ON media_library
  FOR SELECT USING (
    auth.uid() = user_id 
    AND source_type IN ('agent_created', 'agent_generated')
  );

-- Users can only create artifacts in their conversations
CREATE POLICY "Users can create artifacts via agents" ON media_library
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND source_type IN ('agent_created', 'agent_generated')
  );

-- Users can update their own artifacts
CREATE POLICY "Users can update own artifacts" ON media_library
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own artifacts
CREATE POLICY "Users can delete own artifacts" ON media_library
  FOR DELETE USING (auth.uid() = user_id);
```

### Content Validation
- Sanitize all user/agent input
- Validate artifact types and sizes
- Scan for malicious code
- Rate limit artifact creation

### Storage Limits
- Max artifact size: 10MB per artifact
- Max artifacts per conversation: 50
- Total storage per user: 1GB
- Automatic cleanup of old/unused artifacts

## 📊 Success Metrics

### Phase 1 Completion
- [ ] Agents can create code artifacts
- [ ] Artifacts display correctly in chat
- [ ] Users can view and copy artifact content

### Phase 2 Completion
- [ ] All artifact types supported
- [ ] Full-screen modal viewer works
- [ ] Export functionality implemented

### Phase 3 Completion
- [ ] Versioning system operational
- [ ] Search and filter working
- [ ] Mobile responsive

### Phase 4 Completion
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] User testing completed

## 🚀 Deployment Strategy

### Pre-Deployment Checklist
1. All database migrations tested locally
2. Edge functions deployed and tested
3. UI components tested across browsers
4. Mobile responsiveness verified
5. Accessibility audit completed
6. Performance benchmarks met
7. Security review passed
8. Documentation updated

### Rollout Plan
1. **Alpha**: Internal testing (Day 9)
2. **Beta**: Limited user group (Day 10-12)
3. **Production**: Full rollout (Day 13+)

### Monitoring
- Track artifact creation rate
- Monitor storage usage
- Measure load times
- Track user engagement
- Monitor error rates

## 📝 Documentation Requirements

### User Documentation
- How to create artifacts with agents
- Viewing and managing artifacts
- Exporting and sharing artifacts
- Artifact versioning guide

### Developer Documentation
- MCP tool API reference
- Artifact types and schemas
- Component usage guide
- Extension guide for new artifact types

## 🔮 Future Enhancements

### Phase 2 Features (Post-MVP)
- Real-time collaborative editing
- Artifact sharing via public links
- Artifact templates library
- AI-powered artifact suggestions
- Artifact diff/comparison view
- Integration with GitHub Gists
- Artifact collections/albums

### Advanced Features
- Multi-modal artifacts (voice, video)
- Interactive artifacts (forms, calculators)
- Artifact marketplace
- Version control with git-like interface
- Artifact analytics dashboard

---

**Total Estimated Time**: 8-10 days for MVP
**Team Size**: 1-2 developers
**Complexity**: Medium-High
**Dependencies**: Existing media library, MCP infrastructure, chat system

