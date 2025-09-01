import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Parse request body
    const { 
      theme, 
      gender, 
      hairColor, 
      eyeColor, 
      customInstructions,
      agentName 
    } = await req.json()

    if (!theme) {
      throw new Error('Theme is required')
    }

    // Build image prompt based on theme and attributes
    let prompt = ''
    
    switch (theme) {
      case 'professional':
        prompt = 'Professional headshot portrait, business attire, confident expression, clean background, high quality, photorealistic'
        break
      case 'business-casual':
        prompt = 'Business casual portrait, smart casual clothing, friendly approachable expression, modern office background, professional lighting'
        break
      case 'futuristic':
        prompt = 'Futuristic sci-fi character portrait, high-tech aesthetic, sleek modern design, digital elements, cyberpunk style, professional quality'
        break
      case 'alien':
        prompt = 'Friendly alien character portrait, otherworldly features, unique alien characteristics, colorful and imaginative, professional digital art'
        break
      case 'animal':
        prompt = 'Anthropomorphic animal character portrait, professional anthropomorphic design, friendly expression, high quality digital art'
        break
      case 'custom':
        prompt = customInstructions || 'Professional character portrait, unique design, high quality digital art'
        break
      default:
        prompt = 'Professional character portrait, friendly expression, clean background, high quality'
    }

    // Add physical attributes if specified
    if (gender && gender !== 'neutral') {
      prompt += `, ${gender} character`
    }
    
    if (hairColor) {
      prompt += `, ${hairColor.toLowerCase()} hair`
    }
    
    if (eyeColor) {
      prompt += `, ${eyeColor.toLowerCase()} eyes`
    }

    // Add quality and style modifiers
    prompt += ', portrait orientation, centered composition, professional lighting, high resolution, detailed, clean, modern style'

    console.log('Generated image prompt:', prompt)

    // Generate image using OpenAI DALL-E API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      throw new Error(`OpenAI API error: ${errorData.error?.message || openaiResponse.statusText}`)
    }

    const openaiData = await openaiResponse.json()
    const imageUrl = openaiData.data[0]?.url

    if (!imageUrl) {
      throw new Error('Failed to generate image')
    }

    console.log('Generated image URL:', imageUrl)

    // Optionally, you could download and store the image in Supabase Storage here
    // For now, we'll return the OpenAI URL directly

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: imageUrl,
        prompt: prompt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in generate-agent-image function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})