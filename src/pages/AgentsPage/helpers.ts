import type { Agent } from '../../types';

export type TeamNode = {
  id: string;
  name: string;
  parent_team_id?: string | null;
  agent_count?: number;
  children?: TeamNode[];
  level?: number;
};

export function buildHierarchicalTeams(teams: TeamNode[]): TeamNode[] {
  const teamMap = new Map<string, TeamNode>();
  const rootTeams: TeamNode[] = [];

  teams.forEach((team) => {
    teamMap.set(team.id, { ...team, children: [] });
  });

  teams.forEach((team) => {
    const teamWithHierarchy = teamMap.get(team.id);
    if (!teamWithHierarchy) return;

    if (team.parent_team_id) {
      const parent = teamMap.get(team.parent_team_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(teamWithHierarchy);
      } else {
        rootTeams.push(teamWithHierarchy);
      }
    } else {
      rootTeams.push(teamWithHierarchy);
    }
  });

  const flattenTeams = (nodes: TeamNode[], level = 0): TeamNode[] => {
    return nodes.reduce<TeamNode[]>((acc, node) => {
      acc.push({ ...node, level });
      if (node.children?.length) {
        acc.push(...flattenTeams(node.children, level + 1));
      }
      return acc;
    }, []);
  };

  return flattenTeams(rootTeams);
}

export function filterAgents(
  agents: Agent[],
  searchQuery: string,
  selectedTeam: string,
): Agent[] {
  let filtered = agents.filter((agent) => !(agent as any).metadata?.is_system_agent);

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query),
    );
  }

  if (selectedTeam !== 'all') {
    filtered = filtered.filter((agent) => {
      const agentTeams = (agent as any).team_members || [];
      return agentTeams.some((membership: any) => membership.team_id === selectedTeam);
    });
  }

  return filtered;
}
