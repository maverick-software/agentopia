import type { ReplayMetadata, ToolResultLike } from './types.ts';

const MUTATING_PREFIXES = [
  'smtp_',
  'send_',
  'create_',
  'update_',
  'delete_',
  'remove_',
  'reprocess_',
  'reasoning_execute',
];

const READ_ONLY_NAMES = new Set([
  'web_search',
  'news_search',
  'scrape_url',
  'search_documents',
  'get_document_content',
  'list_assigned_documents',
  'search_document_content',
  'get_document_summary',
  'find_related_documents',
  'search_working_memory',
  'search_conversation_summaries',
  'get_conversation_summary_board',
  'search_contacts',
  'get_contact_details',
  'update_plan',
]);

export function isMutatingTool(name: string, params: Record<string, any> = {}): boolean {
  const normalized = name.toLowerCase();
  if (READ_ONLY_NAMES.has(normalized)) return false;
  if (MUTATING_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;

  const action = String(params.action || '').toLowerCase();
  if (!action) return true;
  if (['list', 'get', 'search', 'read', 'fetch', 'describe', 'summary'].includes(action)) {
    return false;
  }
  return true;
}

export function buildReplayMetadata(toolResults: ToolResultLike[] = []): ReplayMetadata {
  const mutatingTools = toolResults
    .filter((tool) => tool.success && isMutatingTool(tool.name, tool.input_params))
    .map((tool) => tool.name);

  const messageSent = toolResults.some((tool) =>
    tool.success && /(^smtp_|send|message|email)/i.test(tool.name)
  );
  const cronChanged = toolResults.some((tool) =>
    tool.success && /cron|schedule|task/i.test(tool.name) &&
    isMutatingTool(tool.name, tool.input_params)
  );
  const hadPotentialSideEffects = mutatingTools.length > 0 || messageSent || cronChanged;

  return {
    hadPotentialSideEffects,
    replaySafe: !hadPotentialSideEffects,
    mutatingTools,
    messageSent,
    cronChanged,
    details: {
      toolCount: toolResults.length,
    },
  };
}
