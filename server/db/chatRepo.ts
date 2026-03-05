import { query } from '../db.js';
import { CHAT_PERSIST_MAX } from '../constants.js';

export interface ChatMessageRow {
	agentId: number;
	sender: string;
	text: string;
	timestamp: number;
}

let insertCount = 0;
const CLEANUP_EVERY = 50;

export async function appendChatMessage(msg: { agentId: number; sender: string; text: string }): Promise<void> {
	await query(
		'INSERT INTO chat_messages (agent_id, sender, text) VALUES ($1, $2, $3)',
		[msg.agentId, msg.sender, msg.text],
	);

	// Periodic trim instead of per-insert
	if (++insertCount % CLEANUP_EVERY === 0) {
		await query(
			`DELETE FROM chat_messages WHERE id NOT IN (
				SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT $1
			)`,
			[CHAT_PERSIST_MAX],
		);
	}
}

export async function getChatMessages(limit = 200): Promise<ChatMessageRow[]> {
	const result = await query(
		'SELECT agent_id, sender, text, created_at FROM chat_messages ORDER BY created_at ASC LIMIT $1',
		[limit],
	);
	if (!result) return [];
	return result.rows.map((row: Record<string, unknown>) => ({
		agentId: row.agent_id as number,
		sender: row.sender as string,
		text: row.text as string,
		timestamp: new Date(row.created_at as string).getTime(),
	}));
}
