import React, { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Hash, Plus, Loader2 } from 'lucide-react';
import { useChatChannels } from '../hooks/useChatChannels';
import { Button } from "@/components/ui/button"; // Assuming Shadcn alias
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

interface ChannelListSidebarProps {
  roomId: string; // Passed from RoomViewLayout
}

const ChannelListSidebar: React.FC<ChannelListSidebarProps> = ({ roomId }) => {
  const { channels, loading, error, createChannel } = useChatChannels(roomId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setIsCreating(true);
    const newChannel = await createChannel(newChannelName, newChannelTopic);
    setIsCreating(false);
    if (newChannel) {
      setNewChannelName('');
      setNewChannelTopic('');
      setIsCreateDialogOpen(false);
      // Optionally navigate?
    }
  };

  return (
    <div className="w-60 bg-gray-100 dark:bg-gray-700 h-full flex flex-col py-4 px-2 border-r border-gray-300 dark:border-gray-600">
      {/* Room Title/Info? - Could fetch room details here or pass down */}
      <div className="px-2 mb-4">
        <h2 className="text-lg font-semibold truncate">Room Placeholder</h2>
      </div>

      {/* Create Channel Button/Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start mb-2 text-left">
            <Plus size={16} className="mr-2" /> Create Channel
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Channel</DialogTitle>
            <DialogDescription>Enter details for the new channel in this room.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="channel-name" className="text-right">Name</Label>
              <Input
                id="channel-name"
                value={newChannelName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChannelName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., general"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="channel-topic" className="text-right">Topic</Label>
              <Input
                id="channel-topic"
                value={newChannelTopic}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChannelTopic(e.target.value)}
                className="col-span-3"
                placeholder="(Optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleCreateChannel} disabled={isCreating || !newChannelName.trim()}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel List */}
      <div className="flex-1 flex flex-col space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-500 pr-1">
        {loading && <Loader2 className="animate-spin text-gray-500 mx-auto my-4" />}
        {error && <span className="text-red-500 text-xs px-2">Error loading channels</span>}
        {channels.map((channel) => (
          <NavLink
            key={channel.id}
            to={`/rooms/${roomId}/channels/${channel.id}`}
            className={({ isActive }): string =>
              `flex items-center px-2 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out 
               ${
                 isActive
                   ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-100'
                   : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
               }`
            }
          >
            <Hash size={16} className="mr-2 opacity-75" />
            <span className="truncate">{channel.name}</span>
          </NavLink>
        ))}
      </div>

      {/* User/Settings Panel at Bottom? */}
    </div>
  );
};

export default ChannelListSidebar; 