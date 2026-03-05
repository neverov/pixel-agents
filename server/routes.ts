import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AgentState } from './types.js';
import { readLayoutFromFile, writeLayoutToFile } from './layoutPersistence.js';
import { readSettings, writeSettings } from './settingsStore.js';
import type { LayoutWatcher } from './layoutPersistence.js';

export interface RouteContext {
	agents: Map<number, AgentState>;
	emit: (msg: unknown) => void;
	layoutWatcher: LayoutWatcher | null;
}

export function createRouter(ctx: RouteContext): Router {
	const router = Router();

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
