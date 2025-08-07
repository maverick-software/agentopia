// Adapters Index - Central export point for integration adapters
// Provides backward compatibility and migration support

export { MessageFormatAdapter, MessageAdapter } from './message_adapter.ts';
export { APIVersionRouter } from './api_version_router.ts';
export type { FeatureFlags } from './feature_flags.ts';
export { 
  getFeatureFlags, 
  isFeatureEnabled, 
  logFeatureFlags,
  KillSwitch,
  withFeatureFlag
} from './feature_flags.ts';
export {
  DualWriteService,
  ToolCompatibilityWrapper,
  ContextCompatibility,
  MigrationHelper,
  RollbackManager
} from './compatibility_layer.ts';
export {
  RollbackLevel,
  RollbackOrchestrator,
  RollbackMonitor
} from './rollback_procedures.ts';

// Re-export commonly used types
export type { ChatMessage } from '../context_builder.ts';
export type { 
  AdvancedChatMessage,
  MessageRole,
  MessageContent,
  MessageMetadata,
  MessageContext,
  ChatRequestV2
} from '../types/message.types.ts';