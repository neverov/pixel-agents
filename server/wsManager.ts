import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();
let onClientMessage: ((msg: Record<string, unknown>) => void) | null = null;
let onClientConnect: ((ws: WebSocket) => void) | null = null;

export function initWebSocket(server: Server): void {
	wss = new WebSocketServer({ server, path: '/ws' });

	wss.on('connection', (ws) => {
		clients.add(ws);
		console.log(`[WS] Client connected (${clients.size} total)`);

		onClientConnect?.(ws);

		ws.on('message', (data) => {
			try {
				const msg = JSON.parse(data.toString()) as Record<string, unknown>;
				onClientMessage?.(msg);
			} catch (err) {
				console.error('[WS] Failed to parse message:', err);
			}
		});

		ws.on('close', () => {
			clients.delete(ws);
			console.log(`[WS] Client disconnected (${clients.size} total)`);
		});
	});
}

/** Broadcast a message to all connected WebSocket clients */
export function broadcast(msg: unknown): void {
	const data = JSON.stringify(msg);
	for (const ws of clients) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(data);
		}
	}
}

/** Send a message to a single WebSocket client */
export function sendTo(ws: WebSocket, msg: unknown): void {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}

/** Register handler for incoming client messages */
export function setMessageHandler(handler: (msg: Record<string, unknown>) => void): void {
	onClientMessage = handler;
}

/** Register handler for new client connections (to send initial state) */
export function setConnectHandler(handler: (ws: WebSocket) => void): void {
	onClientConnect = handler;
}

export function dispose(): void {
	wss?.close();
	clients.clear();
}
