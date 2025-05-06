import { SupabaseClient } from '@supabase/supabase-js';

// Define the expected response structure from the Supabase Function
interface GenerateAgentAvatarResponse {
  newAvatarUrl?: string;
  error?: string;
}

/**
 * Invokes the Supabase Edge Function to generate an agent avatar using DALL-E.
 *
 * @param supabase The Supabase client instance.
 * @param agentId The ID of the agent for whom to generate the avatar.
 * @param prompt The text prompt for DALL-E.
 * @returns An object containing the new avatar URL or an error message.
 */
export async function generateAgentAvatar(
  supabase: SupabaseClient,
  agentId: string,
  prompt: string
): Promise<GenerateAgentAvatarResponse> {
  const { data, error } = await supabase.functions.invoke<GenerateAgentAvatarResponse>(
    'generate-agent-image',
    {
      body: { agentId, prompt },
    }
  );

  if (error) {
    console.error('Supabase function invocation error:', error);
    // Try to parse a specific error message if the function returned one
    if (data?.error) {
        throw new Error(`Generation failed: ${data.error}`);
    }
    throw new Error(`Failed to invoke generation function: ${error.message}`);
  }

  if (data?.error) {
     console.error('Supabase function returned error:', data.error);
     throw new Error(`Generation failed: ${data.error}`);
  }

  if (!data?.newAvatarUrl) {
      console.error('Supabase function did not return avatar URL:', data);
      throw new Error('Generation function did not return a valid URL.');
  }


  return { newAvatarUrl: data.newAvatarUrl };
} 