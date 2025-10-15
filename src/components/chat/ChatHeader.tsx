import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, FolderPlus, Archive, Flag, Trash2, Share } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { Database } from '../../types/database.types';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

export type ChatMode = 'text' | 'voice' | 'realtime';

type Agent = Database['public']['Tables']['agents']['Row'];

interface ChatHeaderProps {
  agent: Agent | null;
  agentId: string;
  conversationId?: string;
  onShowAgentSettings: () => void;
}

export function ChatHeader({
  agent,
  agentId,
  conversationId,
  onShowAgentSettings
}: ChatHeaderProps) {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleShare = () => {
    // TODO: Implement share functionality
    toast.success('Share functionality coming soon!');
  };

  const handleAddToProject = () => {
    // TODO: Implement add to project functionality
    toast.success('Add to project functionality coming soon!');
  };

  const handleArchive = async () => {
    if (!conversationId) {
      toast.error('No conversation to archive');
      return;
    }
    setIsProcessing(true);
    try {
      // TODO: Implement archive functionality
      toast.success('Conversation archived');
    } catch (error) {
      toast.error('Failed to archive conversation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReport = () => {
    // TODO: Implement report functionality
    toast.success('Report functionality coming soon!');
  };

  const handleDelete = async () => {
    if (!agentId) {
      toast.error('No agent to delete');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${agent?.name || 'this agent'}? This action cannot be undone and will delete all conversations, messages, and data associated with this agent.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('delete_agent_cascade', {
        agent_uuid: agentId
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Agent and all related data deleted successfully');
      navigate('/agents');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 pt-2.5 pb-0.5 bg-card">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate('/agents')}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-3">
            {/* Avatar with hover edit functionality */}
            <div 
              className="relative group cursor-pointer"
              onClick={onShowAgentSettings}
            >
              {resolvedAvatarUrl ? (
                <img 
                  src={resolvedAvatarUrl} 
                  alt={agent?.name || 'Agent'}
                  className="w-6 h-6 rounded-full object-cover transition-all duration-200 group-hover:brightness-75"
                  onError={(e) => {
                    console.warn('Header avatar failed to load:', resolvedAvatarUrl);
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center transition-all duration-200 group-hover:brightness-75"
                style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
              >
                <span className="text-white text-xs font-medium">
                  {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <span className="text-white text-[10px] font-medium">Edit</span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-foreground">
                {agent?.name || 'Loading...'}
              </h1>
              <p className="text-xs text-muted-foreground">AI Assistant</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {/* Agent Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-accent rounded-lg transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleShare} disabled={isProcessing}>
              <Share className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddToProject} disabled={isProcessing}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Add to project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive} disabled={isProcessing || !conversationId}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReport} disabled={isProcessing}>
              <Flag className="mr-2 h-4 w-4" />
              Report
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDelete} 
              disabled={isProcessing || !agentId}
              className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
