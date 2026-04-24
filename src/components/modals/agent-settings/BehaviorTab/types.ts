export interface CustomContext {
  id: string;
  name: string;
  content: string;
}

export interface Rule {
  id: string;
  content: string;
}

export interface BehaviorTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}
