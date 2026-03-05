import pg from 'pg';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
	if (pool) return pool;
	const url = process.env.DATABASE_URL;
	if (!url) return null;
	pool = new pg.Pool({ connectionString: url });
	return pool;
}

export async function query(sql: string, params?: unknown[]): Promise<pg.QueryResult | null> {
	const p = getPool();
	if (!p) return null;
	return p.query(sql, params);
}

/** Get a dedicated client for transactions (caller must release). */
export async function getClient(): Promise<pg.PoolClient | null> {
	const p = getPool();
	if (!p) return null;
	return p.connect();
}

export async function initDb(): Promise<void> {
	const p = getPool();
	if (!p) {
		console.log('[DB] No DATABASE_URL — running without database');
		return;
	}

	await p.query(`
		CREATE TABLE IF NOT EXISTS chat_messages (
			id         SERIAL PRIMARY KEY,
			agent_id   INTEGER NOT NULL,
			sender     TEXT NOT NULL,
			text       TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT now()
		)
	`);
	await p.query(`
		CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at)
	`);

	await p.query(`
		CREATE TABLE IF NOT EXISTS agents (
			id           INTEGER PRIMARY KEY,
			jsonl_file   TEXT,
			project_dir  TEXT,
			label        TEXT,
			custom_label TEXT,
			session_id   TEXT UNIQUE,
			persona      TEXT,
			created_at   TIMESTAMPTZ DEFAULT now()
		)
	`);

	// Migration: add columns if they don't exist (for existing DBs)
	await p.query(`
		DO $$ BEGIN
			ALTER TABLE agents ADD COLUMN session_id TEXT UNIQUE;
		EXCEPTION WHEN duplicate_column THEN NULL; END $$
	`);
	await p.query(`
		DO $$ BEGIN
			ALTER TABLE agents ADD COLUMN persona TEXT;
		EXCEPTION WHEN duplicate_column THEN NULL; END $$
	`);

	console.log('[DB] Tables initialized');
}

export async function closeDb(): Promise<void> {
	if (pool) {
		await pool.end();
		pool = null;
	}
}
