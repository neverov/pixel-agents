import { query } from '../db.js';

export interface TokenDelta {
	agentId: number;
	input: number;
	output: number;
	cacheRead: number;
	cacheCreation: number;
}

export async function flushTokenDeltas(deltas: TokenDelta[]): Promise<void> {
	if (deltas.length === 0) return;
	for (const d of deltas) {
		await query(
			`INSERT INTO token_usage (agent_id, input_tokens, output_tokens, cache_read, cache_creation, updated_at)
			 VALUES ($1, $2, $3, $4, $5, now())
			 ON CONFLICT (agent_id) DO UPDATE SET
				input_tokens   = token_usage.input_tokens   + EXCLUDED.input_tokens,
				output_tokens  = token_usage.output_tokens  + EXCLUDED.output_tokens,
				cache_read     = token_usage.cache_read     + EXCLUDED.cache_read,
				cache_creation = token_usage.cache_creation + EXCLUDED.cache_creation,
				updated_at     = now()`,
			[d.agentId, d.input, d.output, d.cacheRead, d.cacheCreation],
		);
	}
}

export interface TokenTotals {
	agentId: number;
	input: number;
	output: number;
	cacheRead: number;
	cacheCreation: number;
}

export async function getTokenTotals(): Promise<TokenTotals[]> {
	const result = await query('SELECT agent_id, input_tokens, output_tokens, cache_read, cache_creation FROM token_usage');
	if (!result) return [];
	return result.rows.map((row: Record<string, unknown>) => ({
		agentId: row.agent_id as number,
		input: Number(row.input_tokens),
		output: Number(row.output_tokens),
		cacheRead: Number(row.cache_read),
		cacheCreation: Number(row.cache_creation),
	}));
}
