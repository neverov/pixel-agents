import { query } from '../db.js';
import type { PersistedAgent } from '../types.js';

export async function getPersistedAgents(): Promise<PersistedAgent[]> {
	const result = await query(
		'SELECT id, jsonl_file, project_dir, label, custom_label, session_id, persona FROM agents ORDER BY id',
	);
	if (!result) return [];
	return result.rows.map((row: Record<string, unknown>) => ({
		id: row.id as number,
		jsonlFile: row.jsonl_file as string,
		projectDir: row.project_dir as string,
		label: (row.label as string) || undefined,
		customLabel: (row.custom_label as string) || undefined,
		sessionId: (row.session_id as string) || undefined,
		persona: (row.persona as string) || undefined,
	}));
}

async function findBySessionId(sessionId: string): Promise<{ id: number; persona: string | null } | null> {
	const result = await query(
		'SELECT id, persona FROM agents WHERE session_id = $1',
		[sessionId],
	);
	if (!result || result.rows.length === 0) return null;
	const row = result.rows[0] as Record<string, unknown>;
	return { id: row.id as number, persona: (row.persona as string) || null };
}

/**
 * Look up an existing agent by session ID for stable identity,
 * or allocate a new ID. Returns the resolved ID and any stored persona.
 */
export async function resolveAgentId(
	sessionId: string,
	nextAgentIdRef: { current: number },
): Promise<{ id: number; persona: string | null }> {
	const existing = await findBySessionId(sessionId);
	if (existing) {
		if (existing.id >= nextAgentIdRef.current) nextAgentIdRef.current = existing.id + 1;
		return existing;
	}
	return { id: nextAgentIdRef.current++, persona: null };
}

export async function updatePersona(agentId: number, persona: string): Promise<void> {
	await query('UPDATE agents SET persona = $1 WHERE id = $2', [persona, agentId]);
}

export async function upsertAgent(agent: PersistedAgent): Promise<void> {
	await query(
		`INSERT INTO agents (id, jsonl_file, project_dir, label, custom_label, session_id, persona)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (id) DO UPDATE SET
			jsonl_file = EXCLUDED.jsonl_file,
			project_dir = EXCLUDED.project_dir,
			label = EXCLUDED.label,
			custom_label = EXCLUDED.custom_label,
			session_id = EXCLUDED.session_id,
			persona = EXCLUDED.persona`,
		[agent.id, agent.jsonlFile, agent.projectDir, agent.label || null, agent.customLabel || null, agent.sessionId || null, agent.persona || null],
	);
}

export async function deleteAgent(id: number): Promise<void> {
	await query('DELETE FROM agents WHERE id = $1', [id]);
}

export async function replaceAllAgents(agents: PersistedAgent[]): Promise<void> {
	const result = await query('BEGIN', []);
	if (!result) return;
	try {
		await query('DELETE FROM agents', []);
		for (const agent of agents) {
			await upsertAgent(agent);
		}
		await query('COMMIT', []);
	} catch (err) {
		await query('ROLLBACK', []);
		throw err;
	}
}
