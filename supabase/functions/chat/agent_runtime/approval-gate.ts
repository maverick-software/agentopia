import type { ApprovalStatus, RiskLevel, RuntimeContext, ToolCallLike } from './types.ts';

export interface ApprovalDecision {
  proceed: boolean;
  status: ApprovalStatus;
  reason: string;
  approvalId?: string;
}

const HIGH_RISK_PATTERNS = [/send/i, /email/i, /message/i, /browser/i, /external/i];
const CRITICAL_PATTERNS = [/delete/i, /remove/i, /drop/i, /truncate/i, /admin/i, /publish/i];

export function getToolName(tool: ToolCallLike): string {
  return tool.function?.name || tool.name || 'unknown_tool';
}

export function getToolArguments(tool: ToolCallLike): Record<string, any> {
  const raw = tool.function?.arguments ?? tool.arguments ?? {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw || {};
}

export function classifyRisk(tool: ToolCallLike): { level: RiskLevel; reason: string } {
  const name = getToolName(tool);
  const args = getToolArguments(tool);
  const haystack = `${name} ${JSON.stringify(args)}`;

  if (CRITICAL_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { level: 'critical', reason: `Critical operation: ${name}` };
  }
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { level: 'high', reason: `External or high-impact operation: ${name}` };
  }
  if (/create|update|write|memory|document|contact/i.test(haystack)) {
    return { level: 'medium', reason: `Mutating operation: ${name}` };
  }
  return { level: 'low', reason: `Read-only or low-risk operation: ${name}` };
}

export async function requestApprovalIfNeeded(
  supabase: any,
  context: RuntimeContext,
  runStateId: string | undefined,
  tool: ToolCallLike
): Promise<ApprovalDecision> {
  const risk = classifyRisk(tool);
  if (risk.level === 'low' || risk.level === 'medium') {
    return { proceed: true, status: 'approved', reason: risk.reason };
  }

  if (!context.userId || !context.agentId || !context.conversationId || !context.sessionId) {
    return { proceed: false, status: 'denied', reason: 'Approval context is incomplete.' };
  }

  const expiresAt = new Date(Date.now() + 120000).toISOString();
  const { data, error } = await supabase
    .from('agent_tool_approvals')
    .insert({
      run_state_id: runStateId,
      user_id: context.userId,
      agent_id: context.agentId,
      conversation_id: context.conversationId,
      session_id: context.sessionId,
      tool_call_id: tool.id,
      tool_name: getToolName(tool),
      tool_arguments: getToolArguments(tool),
      risk_level: risk.level,
      risk_reason: risk.reason,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[ApprovalGate] Failed to create approval request:', error);
    return { proceed: false, status: 'denied', reason: 'Could not create approval request.' };
  }

  return {
    proceed: false,
    status: 'pending',
    reason: risk.reason,
    approvalId: data?.id,
  };
}
