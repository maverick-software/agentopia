import { MCPServerStatus } from '../../mcpService';
import { StatusCache } from '../types';

export function updateStatusCache(
  statusCache: Map<string, StatusCache>,
  serverId: string,
  status: MCPServerStatus
): void {
  const existing = statusCache.get(serverId);
  const now = new Date();

  statusCache.set(serverId, {
    serverId,
    status,
    lastUpdated: now,
    lastChecked: now,
    checkCount: (existing?.checkCount || 0) + 1,
    errorCount: status.health === 'unhealthy' ? (existing?.errorCount || 0) + 1 : 0
  });
}

export function getFromCache(
  statusCache: Map<string, StatusCache>,
  serverId: string
): StatusCache | null {
  return statusCache.get(serverId) || null;
}

export function clearCache(statusCache: Map<string, StatusCache>, serverId?: string): void {
  if (serverId) {
    statusCache.delete(serverId);
    return;
  }

  statusCache.clear();
}

export function cleanupExpiredCache(statusCache: Map<string, StatusCache>): void {
  const maxAge = 5 * 60 * 1000;
  const now = Date.now();

  for (const [serverId, cache] of statusCache.entries()) {
    if (now - cache.lastUpdated.getTime() > maxAge) {
      statusCache.delete(serverId);
    }
  }
}

export function isCacheValid(cache: StatusCache): boolean {
  const maxAge = 2 * 60 * 1000;
  return Date.now() - cache.lastUpdated.getTime() < maxAge;
}

export function calculateCacheHitRate(statusCache: Map<string, StatusCache>): number {
  const totalCacheChecks = Array.from(statusCache.values()).reduce(
    (sum, cache) => sum + cache.checkCount,
    0
  );
  const cacheHits = statusCache.size;
  return totalCacheChecks > 0 ? cacheHits / totalCacheChecks : 0;
}

