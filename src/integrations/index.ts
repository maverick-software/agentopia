/**
 * Gofr Agents Integrations
 * Centralized export for all integration modules
 */

// Shared utilities
export * from './_shared';

// SMTP Integration  
export * from './smtp';

// Web Search Integration
export * from './web-search';

// Discord Integration
export * from './discord';

// Email Relay Integration (Unified SMTP, SendGrid, Mailgun)
export * from './email-relay';

// Pipedream Connect + MCP
export * from './pipedream';

// Agent Integration Management
export * from './agent-management';

// Zapier MCP - to be added when components are moved
