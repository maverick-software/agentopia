import { MCPServerStatus } from '../../mcpService';

export function createUnknownStatus(): MCPServerStatus {
  return {
    state: 'unknown',
    health: 'unknown',
    uptime: 0
  };
}

export function statusesEqual(status1: MCPServerStatus, status2: MCPServerStatus): boolean {
  return status1.state === status2.state && status1.health === status2.health;
}

