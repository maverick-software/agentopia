// supabase/functions/mcp-template-manager/index.ts
// Streamlined MCP template registration with auto-validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface MCPTemplateRegistration {
  name: string;
  displayName: string;
  description: string;
  dockerImage: string;
  category: 'productivity' | 'development' | 'data' | 'communication';
  resourceHint: 'light' | 'medium' | 'heavy';
  environmentVariables?: Record<string, string>;
  isOfficial?: boolean;
  version?: string;
  author?: string;
  documentation?: string;
  tags?: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      // Register new MCP template
      const template: MCPTemplateRegistration = await req.json()
      
      // Validate template
      const validation = await validateTemplate(template)
      if (!validation.isValid) {
        return new Response(
          JSON.stringify({ 
            error: 'Template validation failed', 
            details: validation.errors,
            warnings: validation.warnings 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Register template
      const result = await registerTemplate(supabaseClient, template, user.id)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result,
          validation: {
            warnings: validation.warnings,
            recommendations: validation.recommendations
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'GET') {
      // Get templates or template categories
      const url = new URL(req.url)
      const category = url.searchParams.get('category')
      
      const templates = await getTemplates(supabaseClient, category)
      
      return new Response(
        JSON.stringify({ success: true, data: templates }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'PUT') {
      // Update existing template
      const url = new URL(req.url)
      const templateId = url.pathname.split('/').pop()
      
      if (!templateId) {
        return new Response(
          JSON.stringify({ error: 'Template ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updates: Partial<MCPTemplateRegistration> = await req.json()
      const result = await updateTemplate(supabaseClient, templateId, updates, user.id)
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'DELETE') {
      // Delete template
      const url = new URL(req.url)
      const templateId = url.pathname.split('/').pop()
      
      if (!templateId) {
        return new Response(
          JSON.stringify({ error: 'Template ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await deleteTemplate(supabaseClient, templateId, user.id)
      
      return new Response(
        JSON.stringify({ success: true, message: 'Template deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('MCP Template Manager Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Validate MCP template with comprehensive checks
 */
async function validateTemplate(template: MCPTemplateRegistration): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // Required field validation
  if (!template.name?.trim()) errors.push('Template name is required')
  if (!template.displayName?.trim()) errors.push('Display name is required')
  if (!template.description?.trim()) errors.push('Description is required')
  if (!template.dockerImage?.trim()) errors.push('Docker image is required')
  if (!template.category) errors.push('Category is required')
  if (!template.resourceHint) errors.push('Resource hint is required')

  // Format validation
  if (template.name && !/^[a-z0-9-]+$/.test(template.name)) {
    errors.push('Template name must contain only lowercase letters, numbers, and hyphens')
  }

  if (template.name && template.name.length > 50) {
    errors.push('Template name must be 50 characters or less')
  }

  if (template.displayName && template.displayName.length > 100) {
    errors.push('Display name must be 100 characters or less')
  }

  if (template.description && template.description.length > 500) {
    errors.push('Description must be 500 characters or less')
  }

  // Docker image validation
  if (template.dockerImage) {
    const dockerImageRegex = /^([a-z0-9]+(?:[._-][a-z0-9]+)*\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/i
    if (!dockerImageRegex.test(template.dockerImage)) {
      errors.push('Invalid Docker image format')
    }
  }

  // Category validation
  const validCategories = ['productivity', 'development', 'data', 'communication']
  if (template.category && !validCategories.includes(template.category)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}`)
  }

  // Resource hint validation
  const validResourceHints = ['light', 'medium', 'heavy']
  if (template.resourceHint && !validResourceHints.includes(template.resourceHint)) {
    errors.push(`Resource hint must be one of: ${validResourceHints.join(', ')}`)
  }

  // Environment variables validation
  if (template.environmentVariables) {
    for (const [key, value] of Object.entries(template.environmentVariables)) {
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        warnings.push(`Environment variable '${key}' should follow UPPER_CASE naming convention`)
      }
      if (typeof value !== 'string') {
        errors.push(`Environment variable '${key}' must be a string`)
      }
    }
  }

  // Auto-validation: Try to validate Docker image accessibility
  try {
    await validateDockerImage(template.dockerImage)
  } catch (error) {
    warnings.push(`Could not verify Docker image accessibility: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Generate recommendations
  if (!template.version) {
    recommendations.push('Consider adding a version number for better tracking')
  }
  if (!template.author) {
    recommendations.push('Consider adding author information')
  }
  if (!template.documentation) {
    recommendations.push('Consider adding documentation URL')
  }
  if (!template.tags || template.tags.length === 0) {
    recommendations.push('Consider adding tags for better discoverability')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations
  }
}

/**
 * Validate Docker image accessibility (basic check)
 */
async function validateDockerImage(dockerImage: string): Promise<void> {
  // For now, just check format and common registries
  // In a full implementation, we might ping Docker Hub API or registry
  
  if (!dockerImage.includes(':')) {
    throw new Error('Docker image should include a tag (e.g., :latest)')
  }

  // Check for common suspicious patterns
  if (dockerImage.includes('localhost') || dockerImage.includes('127.0.0.1')) {
    throw new Error('Docker image should not reference localhost')
  }
}

/**
 * Register template in tool_catalog
 */
async function registerTemplate(supabase: any, template: MCPTemplateRegistration, userId: string) {
  // Generate smart defaults
  const templateData = {
    id: crypto.randomUUID(),
    tool_name: template.name,
    display_name: template.displayName,
    description: template.description,
    category: template.category,
    docker_image: template.dockerImage,
    is_official: template.isOfficial || false,
    is_mcp_server: true,
    mcp_server_metadata: {
      resourceHint: template.resourceHint,
      environmentVariables: template.environmentVariables || {},
      version: template.version || '1.0.0',
      author: template.author || 'Community',
      documentation: template.documentation,
      tags: template.tags || [],
      registeredAt: new Date().toISOString(),
      registeredBy: userId
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('tool_catalog')
    .insert(templateData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to register template: ${error.message}`)
  }

  return data
}

/**
 * Get templates with optional category filter
 */
async function getTemplates(supabase: any, category?: string | null) {
  let query = supabase
    .from('tool_catalog')
    .select('*')
    .eq('is_mcp_server', true)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get templates: ${error.message}`)
  }

  return data || []
}

/**
 * Update existing template
 */
async function updateTemplate(supabase: any, templateId: string, updates: Partial<MCPTemplateRegistration>, userId: string) {
  // Validate updates if provided
  if (Object.keys(updates).length > 0) {
    const validation = await validateTemplate(updates as MCPTemplateRegistration)
    if (!validation.isValid) {
      throw new Error(`Update validation failed: ${validation.errors.join(', ')}`)
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  }

  // Map update fields to database columns
  if (updates.name) updateData.tool_name = updates.name
  if (updates.displayName) updateData.display_name = updates.displayName
  if (updates.description) updateData.description = updates.description
  if (updates.dockerImage) updateData.docker_image = updates.dockerImage
  if (updates.category) updateData.category = updates.category
  if (updates.isOfficial !== undefined) updateData.is_official = updates.isOfficial

  // Update MCP metadata
  const { data: existing } = await supabase
    .from('tool_catalog')
    .select('mcp_server_metadata')
    .eq('id', templateId)
    .single()

  if (existing) {
    updateData.mcp_server_metadata = {
      ...existing.mcp_server_metadata,
      ...(updates.resourceHint && { resourceHint: updates.resourceHint }),
      ...(updates.environmentVariables && { environmentVariables: updates.environmentVariables }),
      ...(updates.version && { version: updates.version }),
      ...(updates.author && { author: updates.author }),
      ...(updates.documentation && { documentation: updates.documentation }),
      ...(updates.tags && { tags: updates.tags }),
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    }
  }

  const { data, error } = await supabase
    .from('tool_catalog')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update template: ${error.message}`)
  }

  return data
}

/**
 * Delete template
 */
async function deleteTemplate(supabase: any, templateId: string, userId: string) {
  // Check if template has active deployments
  const { data: deployments, error: deploymentsError } = await supabase
    .from('account_tool_instances')
    .select('id')
    .eq('tool_catalog_id', templateId)
    .eq('status_on_toolbox', 'active')

  if (deploymentsError) {
    throw new Error(`Failed to check deployments: ${deploymentsError.message}`)
  }

  if (deployments && deployments.length > 0) {
    throw new Error(`Cannot delete template: ${deployments.length} active deployments exist`)
  }

  const { error } = await supabase
    .from('tool_catalog')
    .delete()
    .eq('id', templateId)

  if (error) {
    throw new Error(`Failed to delete template: ${error.message}`)
  }
} 