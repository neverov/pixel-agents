import { Router } from 'express';
import type { Request, Response } from 'express';
import type * as fs from 'fs';
import type { AgentState } from './types.js';
import { launchNewAgent, killAgent } from './agentManager.js';
import { readLayoutFromFile, writeLayoutToFile } from './layoutPersistence.js';
import { readSettings, writeSettings } from './settingsStore.js';
import type { LayoutWatcher } from './layoutPersistence.js';

export interface RouteContext {
	nextAgentIdRef: { current: number };
	agents: Map<number, AgentState>;
	activeAgentIdRef: { current: number | null };
	knownJsonlFiles: Set<string>;
	fileWatchers: Map<number, fs.FSWatcher>;
	pollingTimers: Map<number, ReturnType<typeof setInterval>>;
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>;
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>;
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>;
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null };
	emit: (msg: unknown) => void;
	persistAgents: () => void;
	cwd: string;
	layoutWatcher: LayoutWatcher | null;
}

export function createRouter(ctx: RouteContext): Router {
	const router = Router();

	// POST /api/agents - Spawn new Claude agent
	router.post('/agents', (req: Request, res: Response) => {
		const { projectDir } = req.body as { projectDir?: string };
		const cwd = projectDir || ctx.cwd;

		const id = launchNewAgent(
			ctx.nextAgentIdRef,
			ctx.agents,
			ctx.activeAgentIdRef,
			ctx.knownJsonlFiles,
			ctx.fileWatchers,
			ctx.pollingTimers,
			ctx.waitingTimers,
			ctx.permissionTimers,
			ctx.jsonlPollTimers,
			ctx.projectScanTimerRef,
			ctx.emit,
			ctx.persistAgents,
			cwd,
		);

		if (id < 0) {
			res.status(500).json({ error: 'Failed to create agent' });
		} else {
			res.json({ id });
		}
	});

	// DELETE /api/agents/:id - Kill agent
	router.delete('/agents/:id', (req: Request, res: Response) => {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id) || !ctx.agents.has(id)) {
			res.status(404).json({ error: 'Agent not found' });
			return;
		}

		killAgent(
			id, ctx.agents, ctx.fileWatchers, ctx.pollingTimers,
			ctx.waitingTimers, ctx.permissionTimers, ctx.jsonlPollTimers,
			ctx.persistAgents, ctx.emit,
		);
		res.json({ ok: true });
	});

	// GET /api/layout - Get current layout
	router.get('/layout', (_req: Request, res: Response) => {
		const layout = readLayoutFromFile();
		res.json(layout || null);
	});

	// PUT /api/layout - Save layout
	router.put('/layout', (req: Request, res: Response) => {
		const layout = req.body as Record<string, unknown>;
		ctx.layoutWatcher?.markOwnWrite();
		writeLayoutToFile(layout);
		res.json({ ok: true });
	});

	// GET /api/settings - Get settings
	router.get('/settings', (_req: Request, res: Response) => {
		res.json(readSettings());
	});

	// PUT /api/settings - Update settings
	router.put('/settings', (req: Request, res: Response) => {
		const updates = req.body as Record<string, unknown>;
		writeSettings(updates);
		res.json({ ok: true });
	});

	return router;
}
