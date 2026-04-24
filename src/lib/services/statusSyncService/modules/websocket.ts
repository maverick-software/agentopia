type WebSocketStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WebSocketRefs {
  connection: WebSocket | null;
  heartbeatInterval: NodeJS.Timeout | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export interface WebSocketHooks {
  getIsRunning: () => boolean;
  onStatusUpdate: (serverId: string) => void;
  onReconnect: () => Promise<void>;
}

export function getWebSocketUrl(): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.host;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  if (supabaseUrl) {
    const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsUrl}/realtime/v1/websocket`;
  }

  return `${wsProtocol}//${wsHost}/ws/mcp-status`;
}

export async function initializeWebSocket(refs: WebSocketRefs, hooks: WebSocketHooks): Promise<void> {
  const wsUrl = getWebSocketUrl();
  refs.connection = new WebSocket(wsUrl);

  refs.connection.onopen = () => {
    refs.connection?.send(
      JSON.stringify({
        type: 'subscribe',
        channel: 'mcp_server_status',
        filters: { table: 'account_tool_instances', filter: 'mcp_server_type=not.is.null' }
      })
    );
    startWebSocketHeartbeat(refs);
  };

  refs.connection.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'status_update' && message.data?.server_id) {
        hooks.onStatusUpdate(message.data.server_id);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  refs.connection.onclose = () => {
    stopWebSocketHeartbeat(refs);
    if (hooks.getIsRunning()) {
      scheduleWebSocketReconnect(refs, hooks);
    }
  };

  refs.connection.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    if (!refs.connection) {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection failed'));
      return;
    }

    refs.connection.onopen = () => {
      clearTimeout(timeout);
      refs.connection?.send(
        JSON.stringify({
          type: 'subscribe',
          channel: 'mcp_server_status',
          filters: { table: 'account_tool_instances', filter: 'mcp_server_type=not.is.null' }
        })
      );
      startWebSocketHeartbeat(refs);
      resolve();
    };

    refs.connection.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection failed'));
    };
  });
}

export function stopWebSocket(refs: WebSocketRefs): void {
  stopWebSocketHeartbeat(refs);
  if (refs.connection) {
    refs.connection.close();
    refs.connection = null;
  }
}

export async function reconnectWebSocket(refs: WebSocketRefs, hooks: WebSocketHooks): Promise<void> {
  if (!hooks.getIsRunning()) {
    return;
  }

  stopWebSocket(refs);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    await hooks.onReconnect();
    refs.reconnectAttempts = 0;
  } catch (error) {
    console.error('WebSocket reconnection failed:', error);
    scheduleWebSocketReconnect(refs, hooks);
  }
}

export function publishStatusUpdate(refs: WebSocketRefs, topic: string, data: any): void {
  if (refs.connection?.readyState === WebSocket.OPEN) {
    refs.connection.send(
      JSON.stringify({
        type: 'publish',
        topic,
        data,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export function getWebSocketStatus(refs: WebSocketRefs): WebSocketStatus {
  if (!refs.connection) {
    return 'disconnected';
  }

  switch (refs.connection.readyState) {
    case WebSocket.OPEN:
      return 'connected';
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      return 'disconnected';
    default:
      return 'error';
  }
}

function startWebSocketHeartbeat(refs: WebSocketRefs): void {
  stopWebSocketHeartbeat(refs);
  refs.heartbeatInterval = setInterval(() => {
    if (refs.connection?.readyState === WebSocket.OPEN) {
      refs.connection.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

function stopWebSocketHeartbeat(refs: WebSocketRefs): void {
  if (refs.heartbeatInterval) {
    clearInterval(refs.heartbeatInterval);
    refs.heartbeatInterval = null;
  }
}

function scheduleWebSocketReconnect(refs: WebSocketRefs, hooks: WebSocketHooks): void {
  if (refs.reconnectAttempts >= refs.maxReconnectAttempts || !hooks.getIsRunning()) {
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, refs.reconnectAttempts), 30000);
  setTimeout(() => {
    refs.reconnectAttempts++;
    reconnectWebSocket(refs, hooks).catch((error) => {
      console.error('Scheduled WebSocket reconnect failed:', error);
    });
  }, delay);
}

