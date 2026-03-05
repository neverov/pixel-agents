import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_DIR, SETTINGS_FILE_NAME, AGENTS_FILE_NAME } from './constants.js';
import type { PersistedAgent } from './types.js';

function getDataDir(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR);
}

function ensureDir(): void {
	const dir = getDataDir();
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

// -- Settings --

interface Settings {
	soundEnabled: boolean;
	agentSeats: Record<string, { palette?: number; hueShift?: number; seatId?: string | null }>;
}

const defaultSettings: Settings = {
	soundEnabled: true,
	agentSeats: {},
};

export function readSettings(): Settings {
	try {
		const filePath = path.join(getDataDir(), SETTINGS_FILE_NAME);
		if (!fs.existsSync(filePath)) return { ...defaultSettings };
		const raw = fs.readFileSync(filePath, 'utf-8');
		return { ...defaultSettings, ...JSON.parse(raw) };
	} catch {
		return { ...defaultSettings };
	}
}

export function writeSettings(settings: Partial<Settings>): void {
	ensureDir();
	const current = readSettings();
	const merged = { ...current, ...settings };
	const filePath = path.join(getDataDir(), SETTINGS_FILE_NAME);
	fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
}

export function getSoundEnabled(): boolean {
	return readSettings().soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
	writeSettings({ soundEnabled: enabled });
}

export function getAgentSeats(): Settings['agentSeats'] {
	return readSettings().agentSeats;
}

export function setAgentSeats(seats: Settings['agentSeats']): void {
	writeSettings({ agentSeats: seats });
}

// -- Persisted Agents --

export function readPersistedAgents(): PersistedAgent[] {
	try {
		const filePath = path.join(getDataDir(), AGENTS_FILE_NAME);
		if (!fs.existsSync(filePath)) return [];
		const raw = fs.readFileSync(filePath, 'utf-8');
		return JSON.parse(raw) as PersistedAgent[];
	} catch {
		return [];
	}
}

export function writePersistedAgents(agents: PersistedAgent[]): void {
	ensureDir();
	const filePath = path.join(getDataDir(), AGENTS_FILE_NAME);
	fs.writeFileSync(filePath, JSON.stringify(agents, null, 2), 'utf-8');
}
