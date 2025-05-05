import React, { useState, useEffect } from 'react';
import { NavLink, useParams, Link } from 'react-router-dom';
import { Hash, Plus, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useChatChannels } from '../hooks/useChatChannels';
import { Button } from "@/components/ui/button";
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';

interface ChannelListSidebarProps {
  roomId: string;
}

const ChannelListSidebar: React.FC<ChannelListSidebarProps> = ({ roomId }) => {
  const workspaceId = roomId;
  const { user, signOut } = useAuth();
  const { channels, loading: channelsLoading, error: channelsError, createChannel } = useChatChannels(workspaceId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState<boolean>(true);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkspaceName = async () => {
      if (!workspaceId) {
        setNameError('No Workspace ID provided.');
        setNameLoading(false);
        return;
      }
      setNameLoading(true);
      setNameError(null);
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', workspaceId)
          .single();

        if (error) throw error;
        if (data) {
          setWorkspaceName(data.name);
        } else {
          throw new Error('Workspace not found.');
        }
      } catch (err: any) {
        console.error("Error fetching workspace name:", err);
        setNameError(err.message || 'Failed to fetch workspace name.');
        setWorkspaceName(null);
      } finally {
        setNameLoading(false);
      }
    };

    fetchWorkspaceName();
  }, [workspaceId]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setIsCreating(true);
    const newChannel = await createChannel(newChannelName, newChannelTopic);
    setIsCreating(false);
    if (newChannel) {
      setNewChannelName('');
      setNewChannelTopic('');
      setIsCreateDialogOpen(false);
    }
  };

  return (
    <div className="w-64 bg-gray-800 h-full flex flex-col text-gray-300 rounded-lg shadow-md">
      <Link 
        to="/workspaces" 
        className="block px-3 h-14 flex items-center border-b border-gray-700 shadow-sm hover:bg-gray-700/50 transition-colors"
        title="Back to Workspaces List"
      >
        {nameLoading ? (
          <Loader2 className="animate-spin text-gray-400 mx-auto" size={18} />
        ) : nameError ? (
          <div className="flex items-center text-red-500 text-xs" title={nameError}>
            <AlertTriangle size={14} className="mr-1" /> Error Loading Name
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-white truncate" title={workspaceName || 'Workspace'}>
            {workspaceName || 'Workspace'}
          </h2>
        )}
      </Link>

      <div className="flex-1 flex flex-col pt-3 px-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start mb-1 text-gray-400 hover:bg-gray-700 hover:text-gray-100">
              <Plus size={16} className="mr-2" /> Create Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Create New Channel</DialogTitle>
              <DialogDescription className="text-gray-400">Enter details for the new channel in this workspace.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="channel-name" className="text-right text-gray-400">Name</Label>
                <Input
                  id="channel-name"
                  value={newChannelName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChannelName(e.target.value)}
                  className="col-span-3 bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., general"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="channel-topic" className="text-right text-gray-400">Topic</Label>
                <Input
                  id="channel-topic"
                  value={newChannelTopic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChannelTopic(e.target.value)}
                  className="col-span-3 bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="(Optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleCreateChannel} disabled={isCreating || !newChannelName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {channelsLoading && <Loader2 className="animate-spin text-gray-400 mx-auto my-4" />}
        {channelsError && <span className="text-red-500 text-xs px-2">Error: {channelsError}</span>}
        {!channelsLoading && !channelsError && channels.length === 0 && (
          <p className="text-gray-500 text-sm px-2">No channels yet.</p>
        )}
        {channels.map((channel) => (
          <NavLink
            key={channel.id}
            to={`/workspaces/${workspaceId}/channels/${channel.id}`}
            className={({ isActive }): string =>
              `flex items-center px-2 py-1.5 rounded text-sm font-medium transition-colors duration-150 ease-in-out group 
               ${
                 isActive
                   ? 'bg-gray-700 text-white'
                   : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100'
               }`
            }
          >
            <Hash size={16} className="mr-2 text-gray-500 group-hover:text-gray-400" />
            <span className="truncate">{channel.name}</span>
          </NavLink>
        ))}
      </div>

      <div className="mt-auto p-2 border-t border-gray-700">
        <Link to="/workspaces" className="block w-full">
           <Button variant="ghost" className="w-full justify-center text-gray-400 hover:bg-gray-700 hover:text-gray-100">
             <ArrowLeft size={16} className="mr-2" />
             Exit Workspace
           </Button>
        </Link>
      </div>
    </div>
  );
};

export default ChannelListSidebar; 