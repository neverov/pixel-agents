import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import express from 'express';
import type { AgentState } from './types.js';
import { initWebSocket, broadcast, sendTo, setMessageHandler, setConnectHandler, setDisconnectHandler, dispose as disposeWs } from './wsManager.js';
import { handlePeerMessage, handlePeerDisconnect } from './peerManager.js';
import type { PeerContext } from './peerManager.js';
import { createRouter } from './routes.js';
import type { RouteContext } from './routes.js';
import { persistAgents as doPersistAgents } from './agentManager.js';
import { loadLayout, watchLayoutFile, writeLayoutToFile, readLayoutFromFile } from './layoutPersistence.js';
import type { LayoutWatcher } from './layoutPersistence.js';
import { readSettings, setAgentSeats, setSoundEnabled } from './settingsStore.js';
import { DEFAULT_PORT, TOKEN_FLUSH_INTERVAL_MS } from './constants.js';
import { feedAgentText, flushAgent } from './chatSummarizer.js';
import { getPersona } from './prompts/personas.js';
import { maskPaths, redactSecrets } from './pathMasking.js';
import { initDb, closeDb } from './db.js';
import { appendChatMessage, getChatMessages } from './db/chatRepo.js';
import { flushTokenDeltas, getTokenTotals } from './db/tokenRepo.js';
import type { TokenDelta } from './db/tokenRepo.js';

// -- Shared state --
const agents = new Map<number, AgentState>();
const nextAgentIdRef = { current: 1 };

let layoutWatcher: LayoutWatcher | null = null;

// -- Token usage accumulator --
const tokenDeltas = new Map<number, TokenDelta>();

function accumulateTokens(agentId: number, input: number, output: number, cacheRead: number, cacheCreation: number): void {
	const cur = tokenDeltas.get(agentId);
	if (cur) {
		cur.input += input;
		cur.output += output;
		cur.cacheRead += cacheRead;
		cur.cacheCreation += cacheCreation;
	} else {
		tokenDeltas.set(agentId, { agentId, input, output, cacheRead, cacheCreation });
	}
}

async function flushTokens(): Promise<void> {
	if (tokenDeltas.size === 0) return;
	const deltas = [...tokenDeltas.values()];
	tokenDeltas.clear();
	try {
		await flushTokenDeltas(deltas);
	} catch (err) {
		// Put deltas back on failure so they'll be retried next flush
		for (const d of deltas) accumulateTokens(d.agentId, d.input, d.output, d.cacheRead, d.cacheCreation);
		console.error('[Tokens] Flush failed:', err);
	}
}

const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

function persistAgents(): void {
	doPersistAgents(agents);
}

// -- Express app --
const app = express();
app.use(express.json({ limit: '10mb' }));

// Serve ui dist (built frontend)
const webviewDistPath = path.join(import.meta.dirname, '..', 'ui', 'dist');
if (fs.existsSync(webviewDistPath)) {
	app.use(express.static(webviewDistPath));
}

// Serve assets (PNGs, catalog JSON, default layout)
const assetsPath = path.join(import.meta.dirname, '..', 'ui', 'public', 'assets');
if (fs.existsSync(assetsPath)) {
	app.use('/assets', express.static(assetsPath));
}
// Also try dist/assets for production builds
const distAssetsPath = path.join(import.meta.dirname, '..', 'ui', 'dist', 'assets');
if (fs.existsSync(distAssetsPath)) {
	app.use('/assets', express.static(distAssetsPath));
}

// Route context
const routeCtx: RouteContext = {
	agents,
	emit: broadcast,
	layoutWatcher,
};

app.use('/api', createRouter(routeCtx));

// SPA fallback — serve index.html for non-API, non-asset routes
app.use((_req, res) => {
	const indexPath = path.join(webviewDistPath, 'index.html');
	if (fs.existsSync(indexPath)) {
		res.sendFile(indexPath);
	} else {
		res.status(404).send('Frontend not built. Run: cd ui && npm run build');
	}
});

// -- HTTP + WebSocket server --
const server = createServer(app);
initWebSocket(server);

// -- Load default layout --
const defaultLayoutPath = path.join(assetsPath, 'default-layout.json');
let defaultLayout: Record<string, unknown> | null = null;
try {
	if (fs.existsSync(defaultLayoutPath)) {
		defaultLayout = JSON.parse(fs.readFileSync(defaultLayoutPath, 'utf-8'));
	}
} catch { /* ignore */ }

const currentLayout = loadLayout(defaultLayout);

// -- Layout watcher --
layoutWatcher = watchLayoutFile((layout) => {
	console.log('[Server] External layout change — broadcasting');
	broadcast({ type: 'layoutLoaded', layout });
});
routeCtx.layoutWatcher = layoutWatcher;

// -- Peer context --
const peerCtx: PeerContext = {
	nextAgentIdRef,
	agents,
	emit: broadcast,
	persistAgents,
	onChatSummary,
};

// -- Chat summarizer callback --
function onChatSummary(agentId: number, sender: string, summary: string): void {
	const sanitized = redactSecrets(maskPaths(summary));
	broadcast({ type: 'chatMessage', agentId, sender, text: sanitized, timestamp: Date.now() });
	void appendChatMessage({ agentId, sender, text: sanitized }).catch(err => console.error('[Chat] Persist failed:', err));
}

// -- Intercept agentText from emit for chat summarization --
const originalBroadcast = broadcast;
function instrumentedBroadcast(msg: unknown): void {
	const m = msg as Record<string, unknown>;
	if (m.type === 'agentText') {
		// Don't broadcast raw agent text to clients — feed to summarizer only
		const agentId = m.id as number;
		const text = m.text as string;
		const agent = agents.get(agentId);
		const name = agent?.label || `Agent ${agentId}`;
		feedAgentText(agentId, text, name, agent?.persona, onChatSummary);
		return;
	}
	if (m.type === 'agentTokens') {
		accumulateTokens(
			m.id as number,
			m.input as number,
			m.output as number,
			m.cacheRead as number,
			m.cacheCreation as number,
		);
	}
	if (m.type === 'agentStatus' && m.status === 'waiting') {
		const agentId = m.id as number;
		const agent = agents.get(agentId);
		const name = agent?.label || `Agent ${agentId}`;
		flushAgent(agentId, name, agent?.persona, onChatSummary);
	}
	originalBroadcast(msg);
}
peerCtx.emit = instrumentedBroadcast;

// -- WS message handler --
setMessageHandler(async (msg, ws) => {
	// Try peer protocol first
	if (await handlePeerMessage(ws, msg, peerCtx)) return;

	if (msg.type === 'saveAgentSeats') {
		setAgentSeats(msg.seats as Record<string, { palette?: number; hueShift?: number; seatId?: string | null }>);
	} else if (msg.type === 'saveLayout') {
		layoutWatcher?.markOwnWrite();
		writeLayoutToFile(msg.layout as Record<string, unknown>);
	} else if (msg.type === 'setSoundEnabled') {
		setSoundEnabled(msg.enabled as boolean);
	} else if (msg.type === 'renameAgent') {
		const id = msg.id as number;
		const name = (msg.name as string || '').trim();
		const agent = agents.get(id);
		if (!agent) return;
		agent.customLabel = name || undefined;
		persistAgents();
		broadcast({ type: 'agentRenamed', id, folderName: agent.customLabel || agent.label });
	} else if (msg.type === 'webviewReady') {
		// Client connected — state is sent via connect handler
	}
});

// -- Peer disconnect handler --
setDisconnectHandler((ws) => {
	handlePeerDisconnect(ws, peerCtx);
});

// -- Send initial state to new WS clients --
setConnectHandler(async (ws) => {
	const settings = readSettings();
	sendTo(ws, { type: 'settingsLoaded', soundEnabled: settings.soundEnabled });

	// Send persisted chat history
	const chatHistory = await getChatMessages();
	if (chatHistory.length > 0) {
		sendTo(ws, { type: 'chatHistory', messages: chatHistory });
	}

	// Send historical token totals (DB + unflushed deltas)
	const dbTotals = await getTokenTotals();
	const tokenMap = new Map<number, { input: number; output: number; cacheRead: number; cacheCreation: number }>();
	for (const t of dbTotals) {
		tokenMap.set(t.agentId, { input: t.input, output: t.output, cacheRead: t.cacheRead, cacheCreation: t.cacheCreation });
	}
	for (const [agentId, d] of tokenDeltas) {
		const cur = tokenMap.get(agentId);
		if (cur) {
			cur.input += d.input;
			cur.output += d.output;
			cur.cacheRead += d.cacheRead;
			cur.cacheCreation += d.cacheCreation;
		} else {
			tokenMap.set(agentId, { input: d.input, output: d.output, cacheRead: d.cacheRead, cacheCreation: d.cacheCreation });
		}
	}
	if (tokenMap.size > 0) {
		const totals: Record<number, { input: number; output: number; cacheRead: number; cacheCreation: number }> = {};
		for (const [id, t] of tokenMap) totals[id] = t;
		sendTo(ws, { type: 'tokenHistory', totals });
	}

	// Send existing agents (all remote, from peers)
	const agentIds = [...agents.keys()].sort((a, b) => a - b);
	const agentSeats = settings.agentSeats || {};
	const folderNames: Record<number, string> = {};
	const personaTaglines: Record<number, string> = {};
	for (const [id, agent] of agents) {
		const displayName = agent.customLabel || agent.label;
		if (displayName) folderNames[id] = displayName;
		personaTaglines[id] = getPersona(agent.persona).tagline;
	}
	sendTo(ws, {
		type: 'existingAgents',
		agents: agentIds,
		agentMeta: agentSeats,
		folderNames,
		personaTaglines,
	});

	// Send current agent statuses
	for (const [agentId, agent] of agents) {
		for (const [toolId, status] of agent.activeToolStatuses) {
			sendTo(ws, { type: 'agentToolStart', id: agentId, toolId, status });
		}
		if (agent.isWaiting) {
			sendTo(ws, { type: 'agentStatus', id: agentId, status: 'waiting' });
		}
	}

	// Send layout
	const layout = readLayoutFromFile() || currentLayout;
	sendTo(ws, { type: 'layoutLoaded', layout });
});

// -- Token flush timer --
const tokenFlushTimer = setInterval(() => void flushTokens(), TOKEN_FLUSH_INTERVAL_MS);

// -- Start server --
void initDb().then(() => {
	server.listen(port, () => {
		console.log(`[Pixel Office] Server running at http://localhost:${port}`);
		console.log(`[Pixel Office] Agents join via: bun cli/join.ts ws://HOST:${port}/ws --name NAME`);
	});
});

// -- Graceful shutdown --
function cleanup(): void {
	console.log('\n[Pixel Office] Shutting down...');
	clearInterval(tokenFlushTimer);
	layoutWatcher?.dispose();
	disposeWs();
	void flushTokens().finally(() => {
		void closeDb();
		server.close();
		process.exit(0);
	});
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
