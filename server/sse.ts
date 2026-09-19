import { Response } from 'express';
import { Round, RoundWinner } from '../src/types/index';

interface SSEClient {
  id: string;
  res: Response;
}

let clients: SSEClient[] = [];

export function addSSEClient(id: string, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
  res.flushHeaders?.();

  const client: SSEClient = { id, res };
  clients.push(client);

  // Send initial connected event
  sendEventToClient(res, 'connected', {
    message: 'Spin Ethiopia Live Stream Connected',
    timestamp: new Date().toISOString(),
    clientsCount: clients.length,
  });

  return () => {
    clients = clients.filter((c) => c.id !== id);
  };
}

export function sendEventToClient(res: Response, event: string, data: any) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    // Client might have dropped
  }
}

export function broadcastSSE(event: string, data: any) {
  const deadClientIds: string[] = [];
  const payload = typeof data === 'object' && data !== null ? { type: event, ...data } : { type: event, value: data };
  const payloadStr = JSON.stringify(payload);

  for (const client of clients) {
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${payloadStr}\n\n`);
      client.res.flushHeaders?.();
    } catch {
      deadClientIds.push(client.id);
    }
  }
  if (deadClientIds.length > 0) {
    clients = clients.filter((c) => !deadClientIds.includes(c.id));
  }
}

// 15 second heartbeat ping to maintain SSE connection and detect dead clients
const heartbeatTimer = setInterval(() => {
  broadcastSSE('ping', { timestamp: Date.now() });
}, 15000);
if (heartbeatTimer.unref) {
  heartbeatTimer.unref();
}


export function getActiveClientsCount(): number {
  return clients.length;
}
