# Workflow & Project Management Migration Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Core Services Implementation](#core-services-implementation)
5. [State Management Setup](#state-management-setup)
6. [UI Components Integration](#ui-components-integration)
7. [Page Implementation](#page-implementation)
8. [Testing & Validation](#testing--validation)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Knowledge
- React 18+ with TypeScript
- Supabase (PostgreSQL with RLS)
- Zustand state management
- Tailwind CSS
- React Hook Form with Zod validation

### Development Environment
- Node.js 18+ 
- npm or yarn package manager
- Git for version control
- Code editor with TypeScript support

### Platform Requirements
- Supabase project (or PostgreSQL database)
- React application setup
- Tailwind CSS configured
- TypeScript configured

---

## Environment Setup

### 1. Create New React Project (if needed)
```bash
npm create vite@latest your-project-name -- --template react-ts
cd your-project-name
npm install
```

### 2. Install Required Dependencies

#### Core Dependencies
```bash
npm install @supabase/supabase-js zustand react-hook-form zod @hookform/resolvers
```

#### UI Dependencies
```bash
npm install @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group
```

#### Additional Dependencies
```bash
npm install lucide-react sonner framer-motion class-variance-authority clsx tailwind-merge
```

#### Development Dependencies
```bash
npm install -D tailwindcss postcss autoprefixer @types/node
```

### 3. Configure Tailwind CSS
```bash
npx tailwindcss init -p
```

Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 4. Environment Variables
Create `.env.local`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Database Setup

### 1. Supabase Project Setup
1. Create a new Supabase project
2. Note your project URL and anon key
3. Access the SQL editor in Supabase dashboard

### 2. Run Database Migrations

#### Option A: Manual Migration (Recommended)
Run the migration files in order from `database/migrations/`:

1. Start with the earliest migration files
2. Run each `.sql` file in the Supabase SQL editor
3. Verify each migration completes successfully

#### Option B: Supabase CLI (Advanced)
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase in your project
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 3. Verify Database Schema
After running migrations, verify these tables exist:
- `unified_workflow_templates`
- `unified_workflow_stages`
- `unified_workflow_tasks`
- `unified_workflow_steps`
- `unified_workflow_elements`
- `unified_workflow_instances`
- `projects`
- `project_stages`
- `project_tasks`
- `project_members`

### 4. Set Up Row Level Security (RLS)
The migrations include RLS policies, but verify they're active:
```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
```

---

## Core Services Implementation

### 1. Create Supabase Client
Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### 2. Copy Type Definitions
Copy all files from `types/` to your `src/types/` directory:
- `unified-workflow.ts`
- `project-flows.ts`
- `client.ts`
- `supabase.ts`

### 3. Implement Core Services

#### Step 3a: Copy Services
Copy all files from `services/` to your `src/services/` directory:
- `unifiedWorkflowService.ts`
- `projectService.ts`
- `projectFlowService.ts`
- `projectTemplateService.ts`
- `compatibility/` (entire directory)

#### Step 3b: Refactor Large Services (Required)
The `unifiedWorkflowService.ts` (1565 lines) must be split:

**Create `src/services/workflow/`:**
```
workflow/
├── index.ts                    # Main exports
├── templateService.ts          # Template CRUD operations
├── instanceService.ts          # Instance management
├── hierarchyService.ts         # Stage/task/step operations
├── elementService.ts           # Element management
└── validationService.ts        # Validation logic
```

**Split `projectService.ts` (531 lines):**
```
project/
├── index.ts                    # Main exports
├── projectCrud.ts              # Basic CRUD operations
├── stageTaskService.ts         # Stage and task management
├── memberService.ts            # Team member management
└── integrationService.ts       # Workflow integration
```

### 4. Update Import Paths
After refactoring, update all import statements throughout the codebase to use the new module structure.

---

## State Management Setup

### 1. Copy State Management System
Copy the entire `state-management/` directory to `src/lib/state-management/`:
- `stores/` - Zustand stores
- `hooks/` - React hooks
- `core/` - Types and utilities
- `persistence/` - State persistence

### 2. Configure Store Integration
Create `src/lib/state-management/index.ts`:
```typescript
// Export all stores
export * from './stores'
export * from './hooks'
export * from './core/types'

// Export main store instance
export { store } from './stores'
```

### 3. Set Up Store Provider (if needed)
If using context providers, create `src/providers/StoreProvider.tsx`:
```typescript
import React from 'react'
import { store } from '@/lib/state-management'

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  )
}
```

---

## UI Components Integration

### 1. Copy UI Components
Copy all component directories to `src/components/`:
- `ui/` - Base UI components (24 files)
- `workflow/` - Workflow-specific components
- `projects/` - Project-specific components
- `admin/` - Admin interface components

### 2. Set Up Component Utilities
Create `src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 3. Configure Component Aliases
Update `tsconfig.json` to include path aliases:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/services/*": ["./src/services/*"],
      "@/hooks/*": ["./src/hooks/*"]
    }
  }
}
```

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### 4. Test Component Integration
Create a test page to verify components work:
```typescript
// src/pages/TestPage.tsx
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const TestPage = () => {
  return (
    <div className="p-4">
      <Card className="p-4">
        <h1 className="text-2xl font-bold">Component Test</h1>
        <Button>Test Button</Button>
      </Card>
    </div>
  )
}
```

---

## Page Implementation

### 1. Copy Page Components
Copy all page files to `src/pages/`:
- `admin/` - Admin pages (18 files)
- `projects/` - Project pages (3 files)
- `workflows/` - Workflow pages (2 files)

### 2. Set Up Routing
Install React Router:
```bash
npm install react-router-dom
```

Create `src/App.tsx`:
```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectDetailsPage } from '@/pages/projects/ProjectDetailsPage'
import { CreateProjectPage } from '@/pages/projects/CreateProjectPage'
import { FlowExecutionPage } from '@/pages/workflows/FlowExecutionPage'
import { FlowSelectionPage } from '@/pages/workflows/FlowSelectionPage'
import { AdminProjectTemplatesListPage } from '@/pages/admin/AdminProjectTemplatesListPage'
import { AdminProjectTemplateFormPage } from '@/pages/admin/AdminProjectTemplateFormPage'

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Project Routes */}
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        <Route path="/projects/create" element={<CreateProjectPage />} />
        
        {/* Workflow Routes */}
        <Route path="/workflows" element={<FlowSelectionPage />} />
        <Route path="/workflows/:id/execute" element={<FlowExecutionPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin/templates" element={<AdminProjectTemplatesListPage />} />
        <Route path="/admin/templates/new" element={<AdminProjectTemplateFormPage />} />
        <Route path="/admin/templates/:id/edit" element={<AdminProjectTemplateFormPage />} />
      </Routes>
    </Router>
  )
}
```

### 3. Copy Hooks
Copy `hooks/useUnifiedWorkflow.ts` to `src/hooks/`:
```bash
cp hooks/useUnifiedWorkflow.ts src/hooks/
```

### 4. Update Import Paths
Go through all copied pages and update import paths to match your project structure.

---

## Testing & Validation

### 1. Basic Functionality Tests

#### Test Database Connection
```typescript
// src/tests/database.test.ts
import { supabase } from '@/lib/supabase'

export const testDatabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('unified_workflow_templates')
      .select('count')
      .limit(1)
    
    if (error) throw error
    console.log('Database connection successful')
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}
```

#### Test Service Functions
```typescript
// src/tests/services.test.ts
import { unifiedWorkflowService } from '@/services'

export const testWorkflowService = async () => {
  try {
    const templates = await unifiedWorkflowService.getTemplates()
    console.log('Workflow service working, templates:', templates.length)
    return true
  } catch (error) {
    console.error('Workflow service failed:', error)
    return false
  }
}
```

### 2. Component Tests
Test each major component:
- Template list loading
- Template creation form
- Project creation workflow
- Workflow execution flow

### 3. Integration Tests
- Create a workflow template
- Execute the workflow
- Convert workflow to project
- Manage project tasks

---

## Deployment

### 1. Build Configuration
Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

### 2. Environment Variables for Production
Set up production environment variables:
```env
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_supabase_anon_key
```

### 3. Build and Deploy
```bash
npm run build
```

Deploy the `dist/` folder to your hosting platform.

---

## Troubleshooting

### Common Issues

#### 1. Import Path Errors
**Problem**: Module not found errors
**Solution**: 
- Check `tsconfig.json` path aliases
- Verify `vite.config.ts` alias configuration
- Ensure all files are copied correctly

#### 2. Database Connection Issues
**Problem**: Supabase connection fails
**Solution**:
- Verify environment variables
- Check Supabase project URL and keys
- Ensure RLS policies allow access

#### 3. Component Styling Issues
**Problem**: Components not styled correctly
**Solution**:
- Verify Tailwind CSS is configured
- Check CSS imports in main.tsx
- Ensure all UI dependencies are installed

#### 4. State Management Issues
**Problem**: Zustand stores not working
**Solution**:
- Check store imports
- Verify hook usage
- Ensure store providers are set up

#### 5. Large File Refactoring
**Problem**: Files exceed 500 lines
**Solution**:
- Split services into modules
- Extract components into smaller files
- Move utility functions to separate files

### Performance Optimization

#### 1. Code Splitting
Implement lazy loading for pages:
```typescript
import { lazy, Suspense } from 'react'

const ProjectsPage = lazy(() => import('@/pages/projects/ProjectsPage'))

// In your routes
<Route 
  path="/projects" 
  element={
    <Suspense fallback={<div>Loading...</div>}>
      <ProjectsPage />
    </Suspense>
  } 
/>
```

#### 2. Bundle Analysis
```bash
npm install -D rollup-plugin-visualizer
```

Add to `vite.config.ts`:
```typescript
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: true,
    }),
  ],
})
```

### Security Considerations

#### 1. Environment Variables
- Never commit `.env` files
- Use different keys for development/production
- Rotate keys regularly

#### 2. Database Security
- Verify RLS policies are active
- Test access controls
- Monitor database logs

#### 3. Input Validation
- All forms use Zod validation
- Sanitize user inputs
- Validate file uploads

---

## Migration Checklist

### Pre-Migration
- [ ] Development environment set up
- [ ] Dependencies installed
- [ ] Database project created
- [ ] Environment variables configured

### Database Setup
- [ ] All migrations run successfully
- [ ] Tables created and accessible
- [ ] RLS policies active
- [ ] Test data inserted (optional)

### Core Implementation
- [ ] Services copied and refactored
- [ ] State management integrated
- [ ] Types and hooks implemented
- [ ] Import paths updated

### UI Implementation
- [ ] Components copied and working
- [ ] Pages implemented
- [ ] Routing configured
- [ ] Styling applied correctly

### Testing
- [ ] Database connection tested
- [ ] Service functions tested
- [ ] Component rendering tested
- [ ] User workflows tested

### Deployment
- [ ] Production build successful
- [ ] Environment variables set
- [ ] Application deployed
- [ ] Production testing complete

---

## Support Resources

### Documentation
- Component documentation in source files
- Service API documentation
- Database schema documentation
- Type definitions with JSDoc comments

### Example Usage
- Sample workflow templates
- Example project structures
- Common integration patterns
- Best practices guide

### Troubleshooting
- Common error solutions
- Performance optimization tips
- Security best practices
- Migration assistance

---

**Migration Guide Version**: 1.0.0  
**Last Updated**: 2025-01-25  
**Estimated Implementation Time**: 2-4 weeks  
**Difficulty Level**: Intermediate to Advanced 