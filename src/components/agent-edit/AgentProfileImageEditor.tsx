import React, { useState, useRef, useCallback, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, UploadCloud, Bot, Trash2, Terminal } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Assuming supabase client path
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { generateAgentAvatar } from '@/lib/openaiClient'; // Import the generation function
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
// import { useAgents } from '@/hooks/useAgents'; // If needed for update function

interface AgentProfileImageEditorProps {
  agentId: string | undefined;
  currentAvatarUrl: string | null | undefined;
  // Function to call after successful upload/generation to update the agent record
  // It might just trigger a refetch in the parent, or update local state
  onAvatarUpdate: (newAvatarUrl: string | null) => void; 
}

export const AgentProfileImageEditor: React.FC<AgentProfileImageEditorProps> = ({
  agentId,
  currentAvatarUrl,
  onAvatarUpdate
}) => {
  const { user } = useAuth(); // Get user for potential checks
  const supabaseClient = useSupabaseClient();
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload Handler
  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !agentId || !user) {
      return;
    }

    const file = event.target.files[0];
    const maxSize = 5 * 1024 * 1024; // 5MB Limit example
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

    setError(null);

    // --- Client-side Validation --- 
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPG, or WEBP.');
      return;
    }
    if (file.size > maxSize) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    // Check aspect ratio (square)
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            if (img.naturalWidth !== img.naturalHeight) {
                setError('Image must be square (1:1 aspect ratio).');
                setUploading(false); // Ensure loading stops
                return;
            }
            // If aspect ratio is okay, proceed with upload
            try {
                setUploading(true);
                const filePath = `public/${agentId}.png`; // Standardize to png

                // Convert to PNG Blob if needed (or handle on server)
                // For simplicity here, we assume direct upload works, but conversion might be better
                // Example: Use canvas to draw and export as PNG blob before upload
                
                console.log(`Uploading ${file.name} to ${filePath}...`);
                const { data, error: uploadError } = await supabase.storage
                    .from('agent-avatars')
                    .upload(filePath, file, { 
                        upsert: true, 
                        contentType: file.type // Use original type for upload header if not converting
                    });

                if (uploadError) throw uploadError;

                // Get public URL (since bucket is public)
                const { data: urlData } = supabase.storage
                    .from('agent-avatars')
                    .getPublicUrl(filePath);

                if (!urlData || !urlData.publicUrl) {
                    throw new Error('Failed to get public URL after upload.');
                }
                
                // Add timestamp to URL to help bypass cache on update
                const newAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
                console.log('Upload successful, new URL:', newAvatarUrl);
                
                // Update parent state / trigger DB update
                onAvatarUpdate(newAvatarUrl);

            } catch (err: any) {
                console.error('Upload failed:', err);
                setError(`Upload failed: ${err.message}`);
            } finally {
                setUploading(false);
                // Reset file input value so the same file can be selected again if needed
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
            }
        };
        img.onerror = () => {
            setError('Could not load image to check dimensions.');
            setUploading(false);
        };
        if (e.target?.result) {
            img.src = e.target.result as string;
        }
    };
    reader.onerror = () => {
        setError('Could not read file.');
        setUploading(false);
    };
    reader.readAsDataURL(file); // Start reading for dimension check
    // Set uploading true here, but validation happens async in onload
    setUploading(true); 

  }, [agentId, user, onAvatarUpdate]);

  // AI Generation Handler
  const handleGenerate = useCallback(async () => {
    if (!agentId) {
        setError('Agent ID is missing. Cannot generate image.');
        return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt for the AI.');
      return;
    }
    setError(null);
    setGenerating(true);
    const toastId = toast.loading('Generating image with AI...');

    try {
      const { newAvatarUrl } = await generateAgentAvatar(supabaseClient, agentId, prompt);
      if (newAvatarUrl) { // Check if generation was successful
          onAvatarUpdate(newAvatarUrl);
          toast.success('AI image generated and updated successfully!', { id: toastId });
          setPrompt(''); // Clear prompt on success
      } else {
        // This case should ideally be handled by the error throwing in generateAgentAvatar
        // but we keep it as a safeguard.
        throw new Error('Generation function did not return a valid URL.');
      }
    } catch (err: any) {
        console.error("Error generating AI image:", err);
        const errorMessage = err.message || 'An unknown error occurred during generation.';
        setError(`Generation failed: ${errorMessage}`);
        toast.error(`Generation failed: ${errorMessage}`, { id: toastId });
    } finally {
        setGenerating(false);
    }
  }, [agentId, prompt, supabaseClient, onAvatarUpdate]);

  // Delete Handler
  const handleDelete = useCallback(async () => {
    if (!agentId) {
      setError('Agent ID is missing. Cannot delete image.');
      return;
    }
    setError(null);
    const toastId = toast.loading('Deleting image...');

    try {
      // 1. Delete from Storage
      const imagePath = `public/${agentId}.png`;
      const { error: deleteError } = await supabaseClient.storage
        .from('agent-avatars')
        .remove([imagePath]);

      if (deleteError) {
        // Log error but proceed to DB update attempt, maybe file didn't exist
        console.warn(`Failed to delete from storage (may not exist): ${imagePath}`, deleteError);
      }

      // 2. Update Database
      const { error: updateError } = await supabaseClient
        .from('agents')
        .update({ avatar_url: null })
        .eq('id', agentId);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      // 3. Update Parent State
      onAvatarUpdate(null);
      toast.success('Avatar deleted successfully.', { id: toastId });

    } catch (err: any) {
      console.error("Error deleting avatar:", err);
      const errorMessage = err.message || 'An unknown error occurred during deletion.';
      setError(`Deletion failed: ${errorMessage}`);
      toast.error(`Deletion failed: ${errorMessage}`, { id: toastId });
    } 
    // No finally block needed for loading state here, handled by toast

  }, [agentId, supabaseClient, onAvatarUpdate]);

  return (
    <div className="space-y-4">
      <Label>Agent Avatar</Label>
      <div className="flex items-center space-x-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={currentAvatarUrl || undefined} alt={`${agentId}'s avatar`} />
          <AvatarFallback>{/* Consider adding initials or placeholder icon */}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col space-y-2">
            <Label htmlFor="avatar-upload" className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 cursor-pointer ${uploading || generating ? 'opacity-50 cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                {uploading ? 'Uploading...' : 'Upload Image'}
            </Label>
            <Input
                id="avatar-upload"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleUpload}
                disabled={uploading || generating}
                className="hidden" // Hide the default input, use the label
            />
           {currentAvatarUrl && (
            <Button variant="destructive" onClick={handleDelete} disabled={uploading || generating}>
              Delete Image
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-prompt">Generate with AI (DALL-E 3)</Label>
        <Input
          id="ai-prompt"
          type="text"
          placeholder="e.g., a cute robot assistant, pixel art style"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={generating || uploading}
        />
        <Button onClick={handleGenerate} disabled={generating || uploading || !prompt.trim()}>
          {generating ? 'Generating...' : 'Generate Image'}
        </Button>
      </div>
      {error && (
          <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}
       {/* Optional: Add info about image requirements */}
      <p className="text-sm text-muted-foreground">
        Upload a square image (PNG, JPG, WEBP), max 512x512. AI generation uses DALL-E 3.
      </p>
    </div>
  );
}; 