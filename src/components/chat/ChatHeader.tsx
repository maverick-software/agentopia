import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, UserPlus, User, Brain, BookOpen, Wrench, MessageSquare, ChevronRight, BarChart3, Settings, Plug, Sliders, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import type { Database } from '../../types/database.types';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';

type Agent = Database['public']['Tables']['agents']['Row'];

interface ChatHeaderProps {
  agent: Agent | null;
  agentId: string;
  onShowTeamAssignment: () => void;
  onShowAboutMe: () => void;
  onShowHowIThink: () => void;
  onShowWhatIKnow: () => void;
  onShowTools: () => void;
  onShowChannels: () => void;
  onShowTasks: () => void;
  onShowHistory: () => void;
  onShowAgentSettings: () => void;
}

export function ChatHeader({
  agent,
  agentId,
  onShowTeamAssignment,
  onShowAboutMe,
  onShowHowIThink,
  onShowWhatIKnow,
  onShowTools,
  onShowChannels,
  onShowTasks,
  onShowHistory,
  onShowAgentSettings
}: ChatHeaderProps) {
  const navigate = useNavigate();
  const [clearingCache, setClearingCache] = useState(false);
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);

  const handleClearCache = async () => {
    if (!agent?.user_id) {
      toast.error('Unable to clear cache: missing user information');
      return;
    }

    setClearingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('invalidate-agent-tool-cache', {
        body: {
          agent_id: agentId,
          user_id: agent.user_id
        }
      });

      if (error) {
        console.error('Cache clear error:', error);
        toast.error('Failed to clear tool cache');
        return;
      }

      if (data?.success) {
        toast.success(`Tool cache cleared! (${data.tools_count} tools refreshed)`);
      } else {
        toast.error(data?.error || 'Failed to clear cache');
      }
    } catch (error: any) {
      console.error('Cache clear error:', error);
      toast.error('Failed to clear tool cache');
    } finally {
      setClearingCache(false);
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
              onClick={onShowAboutMe}
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
        {/* Cache Clear Button */}
        <button
          onClick={handleClearCache}
          disabled={clearingCache}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
          title="Clear tool cache (refreshes agent tools and schemas)"
        >
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${clearingCache ? 'animate-spin' : ''}`} />
        </button>
        
        {/* Agent Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-accent rounded-lg transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onShowTeamAssignment}>
              <UserPlus className="mr-2 h-4 w-4" />
              Team Assignment
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShowAboutMe}>
              <User className="mr-2 h-4 w-4" />
              About Me
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowHowIThink}>
              <Brain className="mr-2 h-4 w-4" />
              How I Think
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowWhatIKnow}>
              <BookOpen className="mr-2 h-4 w-4" />
              What I Know
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShowTools}>
              <Wrench className="mr-2 h-4 w-4" />
              Tools
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowChannels}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Channels
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowTasks}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Tasks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowHistory}>
              <ChevronRight className="mr-2 h-4 w-4" />
              History
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShowAgentSettings}>
              <Settings className="mr-2 h-4 w-4" />
              Agent Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
