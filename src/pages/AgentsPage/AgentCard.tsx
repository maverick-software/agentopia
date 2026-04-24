import { ArrowUpRight } from 'lucide-react';
import type { Agent } from '../../types';
import { useMediaLibraryUrl } from '../../hooks/useMediaLibraryUrl';

function AgentAvatar({ agent }: { agent: Agent }) {
  const resolvedAvatarUrl = useMediaLibraryUrl(agent.avatar_url);

  if (resolvedAvatarUrl) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={`${agent.name} avatar`}
        className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300"
      />
    );
  }

  return (
    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300">
      <span className="text-primary text-lg font-semibold">{agent.name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export function AgentCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: (agentId: string) => void;
}) {
  return (
    <div
      onClick={() => onClick(agent.id)}
      className="group bg-card/50 rounded-xl border border-border/50 hover:bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 cursor-pointer relative p-4"
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex flex-col items-center text-center space-y-3">
        <AgentAvatar agent={agent} />
        <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
          {agent.name}
        </h3>
      </div>
    </div>
  );
}
