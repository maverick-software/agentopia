import React, { useState, useEffect, useMemo } from 'react';
import { useAgents } from '../../hooks/useAgents'; // Adjust path if needed
import type { Agent } from '../../types';
import { Loader2 } from 'lucide-react';

interface AgentSelectorProps {
  onSelectAgent: (agentId: string) => void;
  excludeAgentIds?: string[];
  initialSelectedAgentId?: string | null;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  onSelectAgent,
  excludeAgentIds = [],
  initialSelectedAgentId = null,
  label = 'Select Agent',
  required = false,
  disabled = false
}) => {
  const { agents: allAgents, loading, error, fetchAllAgents } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<string>(initialSelectedAgentId || '');

  useEffect(() => {
    fetchAllAgents();
    // Only depends on fetchAllAgents which depends on user, so runs once on mount/user change
  }, [fetchAllAgents]);

  const availableAgents = useMemo(() => {
    return allAgents.filter(agent => !excludeAgentIds.includes(agent.id));
  }, [allAgents, excludeAgentIds]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = event.target.value;
    setSelectedAgent(agentId);
    if (agentId) {
      onSelectAgent(agentId);
    } else {
      // Handle deselection if needed, maybe call onSelectAgent with empty string or null
      onSelectAgent('');
    }
  };

  const selectClasses = "block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClasses = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div>
      <label htmlFor="agent-selector" className={labelClasses}>{label}</label>
      <div className="relative">
        <select
          id="agent-selector"
          value={selectedAgent}
          onChange={handleChange}
          required={required}
          disabled={loading || disabled || availableAgents.length === 0}
          className={selectClasses}
        >
          <option value="">{loading ? 'Loading agents...' : '-- Select an Agent --'}</option>
          {availableAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        {loading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">Error loading agents: {error.message}</p>}
      {!loading && availableAgents.length === 0 && !error && (
        <p className="mt-1 text-xs text-gray-400">No available agents found.</p>
      )}
    </div>
  );
}; 