import React from 'react';
import { TeamAssignmentModal } from '../modals/TeamAssignmentModal';
import { AboutMeModal } from '../modals/AboutMeModal';
import { HowIThinkModal } from '../modals/HowIThinkModal';
import { WhatIKnowModal } from '../modals/WhatIKnowModal';
import { AgentSettingsModal } from '../modals/AgentSettingsModal';
import { EnhancedChannelsModalRefactored as EnhancedChannelsModal } from '../modals/channels/EnhancedChannelsModalRefactored';
import { EnhancedToolsModal } from '../modals/EnhancedToolsModal';
import { TaskManagerModal } from '../modals/TaskManagerModal';
import { HistoryModal } from '../modals/HistoryModal';
import { ProcessModal } from '../modals/ProcessModal';
import type { Database } from '../../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

interface ChatModalsProps {
  // Modal states
  showTeamAssignmentModal: boolean;
  showAboutMeModal: boolean;
  showHowIThinkModal: boolean;
  showWhatIKnowModal: boolean;
  showToolsModal: boolean;
  showChannelsModal: boolean;
  showTasksModal: boolean;
  showHistoryModal: boolean;
  showProcessModal: boolean;
  showAgentSettingsModal: boolean;
  
  // Modal close handlers
  setShowTeamAssignmentModal: (show: boolean) => void;
  setShowAboutMeModal: (show: boolean) => void;
  setShowHowIThinkModal: (show: boolean) => void;
  setShowWhatIKnowModal: (show: boolean) => void;
  setShowToolsModal: (show: boolean) => void;
  setShowChannelsModal: (show: boolean) => void;
  setShowTasksModal: (show: boolean) => void;
  setShowHistoryModal: (show: boolean) => void;
  setShowProcessModal: (show: boolean) => void;
  setShowAgentSettingsModal: (show: boolean) => void;
  
  // Data
  agentId: string;
  agent: Agent | null;
  currentProcessingDetails: any;
  agentSettingsInitialTab: 'general' | 'schedule' | 'identity' | 'behavior' | 'memory' | 'media' | 'tools' | 'channels' | 'integrations' | 'sources' | 'team';
  
  // Handlers
  onAgentUpdated: (updatedAgent: Agent) => void;
  updateAgent: (id: string, data: any) => Promise<void>;
}

export function ChatModals({
  // Modal states
  showTeamAssignmentModal,
  showAboutMeModal,
  showHowIThinkModal,
  showWhatIKnowModal,
  showToolsModal,
  showChannelsModal,
  showTasksModal,
  showHistoryModal,
  showProcessModal,
  showAgentSettingsModal,
  
  // Modal close handlers
  setShowTeamAssignmentModal,
  setShowAboutMeModal,
  setShowHowIThinkModal,
  setShowWhatIKnowModal,
  setShowToolsModal,
  setShowChannelsModal,
  setShowTasksModal,
  setShowHistoryModal,
  setShowProcessModal,
  setShowAgentSettingsModal,
  
  // Data
  agentId,
  agent,
  currentProcessingDetails,
  agentSettingsInitialTab,
  
  // Handlers
  onAgentUpdated,
  updateAgent
}: ChatModalsProps) {
  return (
    <>
      {/* Team Assignment Modal */}
      <TeamAssignmentModal
        isOpen={showTeamAssignmentModal}
        onClose={() => setShowTeamAssignmentModal(false)}
        agentId={agentId}
      />

      {/* About Me Modal */}
      <AboutMeModal
        isOpen={showAboutMeModal}
        onClose={() => setShowAboutMeModal(false)}
        agentId={agentId}
        agentData={{
          name: agent?.name,
          description: agent?.description,
          personality: agent?.personality,
          avatar_url: agent?.avatar_url
        }}
        onAgentUpdated={async (updatedAgent) => {
          onAgentUpdated(updatedAgent);
          // Also update the agents hook state so sidebar gets updated
          if (agentId) {
            await updateAgent(agentId, updatedAgent);
          }
          console.log('Agent updated:', updatedAgent);
        }}
      />

      {/* How I Think Modal */}
      <HowIThinkModal
        isOpen={showHowIThinkModal}
        onClose={() => setShowHowIThinkModal(false)}
        agentId={agentId}
        agentData={{
          system_instructions: agent?.system_instructions,
          assistant_instructions: agent?.assistant_instructions,
          name: agent?.name
        }}
        onAgentUpdated={(updatedAgent) => {
          onAgentUpdated(updatedAgent);
          console.log('Agent thinking updated:', updatedAgent);
        }}
      />

      {/* What I Know Modal */}
      <WhatIKnowModal
        isOpen={showWhatIKnowModal}
        onClose={() => setShowWhatIKnowModal(false)}
        agentId={agentId}
        agentData={{
          name: agent?.name,
          agent_datastores: agent?.agent_datastores || []
        }}
        onAgentUpdated={(updatedAgent) => {
          onAgentUpdated(updatedAgent);
          console.log('Agent knowledge updated:', updatedAgent);
        }}
      />

      {/* Enhanced Tools Modal */}
      <EnhancedToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        agentId={agentId}
      />

      {/* Enhanced Channels Modal */}
      <EnhancedChannelsModal
        isOpen={showChannelsModal}
        onClose={() => setShowChannelsModal(false)}
        agentId={agentId}
      />

      {/* Task Manager Modal */}
      <TaskManagerModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        agentId={agentId}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        agentId={agentId}
      />

      {/* Process Modal */}
      <ProcessModal
        isOpen={showProcessModal}
        onClose={() => setShowProcessModal(false)}
        processingDetails={currentProcessingDetails}
      />

      {/* Agent Settings Modal */}
      <AgentSettingsModal
        isOpen={showAgentSettingsModal}
        onClose={() => setShowAgentSettingsModal(false)}
        agentId={agentId}
        agentData={{
          name: agent?.name,
          description: agent?.description,
          personality: agent?.personality,
          avatar_url: agent?.avatar_url,
          agent_datastores: agent?.agent_datastores,
          metadata: agent?.metadata
        }}
        initialTab={agentSettingsInitialTab}
        onAgentUpdated={async (updatedAgent) => {
          onAgentUpdated(updatedAgent);
          // Also update the agents hook state so sidebar gets updated
          if (agentId) {
            await updateAgent(agentId, updatedAgent);
          }
        }}
      />
    </>
  );
}
