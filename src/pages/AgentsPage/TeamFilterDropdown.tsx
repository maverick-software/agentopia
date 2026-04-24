import { Building2, ChevronDown, Filter } from 'lucide-react';
import type { TeamNode } from './helpers';

type TeamSummary = { id: string; name: string };

export function TeamFilterDropdown({
  selectedTeam,
  teams,
  hierarchicalTeams,
  showTeamDropdown,
  setShowTeamDropdown,
  setSelectedTeam,
}: {
  selectedTeam: string;
  teams: TeamSummary[];
  hierarchicalTeams: TeamNode[];
  showTeamDropdown: boolean;
  setShowTeamDropdown: (value: boolean) => void;
  setSelectedTeam: (value: string) => void;
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowTeamDropdown(!showTeamDropdown);
        }}
        className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-primary/50 rounded-lg text-sm font-medium text-foreground transition-all duration-200 min-w-[180px]"
      >
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="flex-1 text-left truncate">
          {selectedTeam === 'all'
            ? 'All Teams'
            : teams.find((team) => team.id === selectedTeam)?.name || 'Select Team'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            showTeamDropdown ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showTeamDropdown && (
        <div
          className="absolute top-full mt-2 right-0 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[280px] max-h-[400px] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedTeam('all');
              setShowTeamDropdown(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
              selectedTeam === 'all'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-accent'
            }`}
          >
            <span>All Teams</span>
            {selectedTeam === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>

          <div className="border-t border-border my-1" />

          {hierarchicalTeams.map((team) => (
            <button
              key={team.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedTeam(team.id);
                setShowTeamDropdown(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                selectedTeam === team.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-accent'
              }`}
              style={{ paddingLeft: `${1 + (team.level || 0) * 1.5}rem` }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 relative">
                {(team.level || 0) > 0 && (
                  <div
                    className="absolute left-0 top-0 h-full flex items-center"
                    style={{ left: `${-0.75 * (team.level || 0)}rem` }}
                  >
                    <div className="w-3 h-px bg-border/50" />
                  </div>
                )}
                <Building2
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    (team.level || 0) === 0 ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="truncate">{team.name}</span>
                {(team.level || 0) > 0 && <span className="text-xs text-muted-foreground">└</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-muted-foreground">{team.agent_count || 0}</span>
                {selectedTeam === team.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
