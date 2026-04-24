import { StatusSubscription, StatusUpdate, StatusUpdateFilter } from '../types';

export function subscribe(
  subscriptions: Map<string, StatusSubscription>,
  callback: (update: StatusUpdate) => void,
  filters?: StatusUpdateFilter[]
): string {
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  subscriptions.set(subscriptionId, {
    id: subscriptionId,
    callback,
    filters,
    isActive: true,
    createdAt: new Date()
  });

  return subscriptionId;
}

export function subscribeToServer(
  subscriptions: Map<string, StatusSubscription>,
  serverId: string,
  callback: (update: StatusUpdate) => void
): string {
  const filters: StatusUpdateFilter[] = [{ type: 'status_change', serverIds: [serverId] }];
  return subscribe(subscriptions, callback, filters);
}

export function unsubscribe(
  subscriptions: Map<string, StatusSubscription>,
  subscriptionId: string
): boolean {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription) {
    return false;
  }

  subscription.isActive = false;
  subscriptions.delete(subscriptionId);
  return true;
}

export function unsubscribeAll(subscriptions: Map<string, StatusSubscription>): number {
  const count = subscriptions.size;
  subscriptions.clear();
  return count;
}

export function notifySubscribers(
  subscriptions: Map<string, StatusSubscription>,
  update: StatusUpdate
): number {
  let notifiedCount = 0;
  for (const subscription of subscriptions.values()) {
    if (subscription.isActive && shouldNotifySubscriber(subscription, update)) {
      try {
        subscription.callback(update);
        notifiedCount++;
      } catch (error) {
        console.error(`Error notifying subscriber ${subscription.id}:`, error);
      }
    }
  }

  return notifiedCount;
}

function shouldNotifySubscriber(subscription: StatusSubscription, update: StatusUpdate): boolean {
  if (!subscription.filters || subscription.filters.length === 0) {
    return true;
  }

  for (const filter of subscription.filters) {
    if (filter.serverIds && !filter.serverIds.includes(update.serverId)) {
      continue;
    }
    if (filter.statusStates && !filter.statusStates.includes(update.currentStatus.state)) {
      continue;
    }
    if (filter.healthLevels && !filter.healthLevels.includes(update.currentStatus.health)) {
      continue;
    }
    if (filter.type === 'status_change' && update.previousStatus.state === update.currentStatus.state) {
      continue;
    }
    if (filter.type === 'health_change' && update.previousStatus.health === update.currentStatus.health) {
      continue;
    }
    if (filter.type === 'error_state' && update.currentStatus.health !== 'unhealthy') {
      continue;
    }
    if (
      filter.type === 'recovery' &&
      (update.previousStatus.health !== 'unhealthy' || update.currentStatus.health === 'unhealthy')
    ) {
      continue;
    }

    return true;
  }

  return false;
}

