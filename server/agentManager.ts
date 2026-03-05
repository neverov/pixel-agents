import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as pty from 'node-pty';
import type { AgentState, PersistedAgent } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer } from './timerManager.js';
import { startFileWatching, readNewLines, ensureProjectScan } from './fileWatcher.js';
import { JSONL_POLL_INTERVAL_MS } from './constants.js';
import { writePersistedAgents, readPersistedAgents, getAgentSeats } from './settingsStore.js';

export function getProjectDirPath(cwd: string): string | null {
	const dirName = cwd.replace(/[^a-zA-Z0-9-]/g, '-');
	const projectDir = path.join(os.homedir(), '.claude', 'projects', dirName);
	console.log(`[Pixel Agents] Project dir: ${cwd} -> ${dirName}`);
	return projectDir;
}

export function launchNewAgent(
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	emit: (msg: unknown) => void,
	persistAgents: () => void,
	cwd: string,
): number {
	const sessionId = crypto.randomUUID();
	const projectDir = getProjectDirPath(cwd);
	if (!projectDir) {
		console.log(`[Pixel Agents] No project dir, cannot track agent`);
		return -1;
	}

	// Pre-register expected JSONL file
	const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
	knownJsonlFiles.add(expectedFile);

	// Create agent
	const id = nextAgentIdRef.current++;
	const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');
	const ptyProcess = pty.spawn(shell, [], {
		name: 'xterm-256color',
		cols: 120,
		rows: 30,
		cwd,
		env: process.env as Record<string, string>,
	});

	// Send the claude command
	ptyProcess.write(`claude --session-id ${sessionId}\r`);

	const agent: AgentState = {
		id,
		ptyProcess,
		projectDir,
		jsonlFile: expectedFile,
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
	};

	agents.set(id, agent);
	activeAgentIdRef.current = id;
	persistAgents();
	console.log(`[Pixel Agents] Agent ${id}: created with session ${sessionId}`);
	emit({ type: 'agentCreated', id });

	// Detect exit
	ptyProcess.onExit(() => {
		console.log(`[Pixel Agents] Agent ${id}: process exited`);
		if (activeAgentIdRef.current === id) {
			activeAgentIdRef.current = null;
		}
		removeAgent(
			id, agents, fileWatchers, pollingTimers, waitingTimers,
			permissionTimers, jsonlPollTimers, persistAgents,
		);
		emit({ type: 'agentClosed', id });
	});

	ensureProjectScan(
		projectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef,
		nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
		emit, persistAgents,
	);

	// Poll for JSONL file to appear
	const pollTimer = setInterval(() => {
		try {
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Pixel Agents] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				clearInterval(pollTimer);
				jsonlPollTimers.delete(id);
				startFileWatching(id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, emit);
				readNewLines(id, agents, waitingTimers, permissionTimers, emit);
			}
		} catch { /* file may not exist yet */ }
	}, JSONL_POLL_INTERVAL_MS);
	jsonlPollTimers.set(id, pollTimer);

	return id;
}

export function removeAgent(
	agentId: number,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	persistAgents: () => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;

	const jpTimer = jsonlPollTimers.get(agentId);
	if (jpTimer) { clearInterval(jpTimer); }
	jsonlPollTimers.delete(agentId);

	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);
	try { fs.unwatchFile(agent.jsonlFile); } catch { /* ignore */ }

	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);

	agents.delete(agentId);
	persistAgents();
}

export function killAgent(
	agentId: number,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	persistAgents: () => void,
	emit: (msg: unknown) => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;

	// Kill the pty process if we own it
	if (agent.ptyProcess) {
		try {
			agent.ptyProcess.kill();
		} catch { /* may already be dead */ }
	}

	removeAgent(agentId, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, jsonlPollTimers, persistAgents);
	emit({ type: 'agentClosed', id: agentId });
}

export function persistAgents(agents: Map<number, AgentState>): void {
	const persisted: PersistedAgent[] = [];
	for (const agent of agents.values()) {
		persisted.push({
			id: agent.id,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
			label: agent.label,
		});
	}
	writePersistedAgents(persisted);
}

export function restoreAgents(
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	activeAgentIdRef: { current: number | null },
	emit: (msg: unknown) => void,
	doPersist: () => void,
): void {
	const persisted = readPersistedAgents();
	if (persisted.length === 0) return;

	let maxId = 0;
	let restoredProjectDir: string | null = null;

	for (const p of persisted) {
		// Only restore if JSONL file still exists
		if (!fs.existsSync(p.jsonlFile)) continue;

		const agent: AgentState = {
			id: p.id,
			ptyProcess: null,
			projectDir: p.projectDir,
			jsonlFile: p.jsonlFile,
			fileOffset: 0,
			lineBuffer: '',
			activeToolIds: new Set(),
			activeToolStatuses: new Map(),
			activeToolNames: new Map(),
			activeSubagentToolIds: new Map(),
			activeSubagentToolNames: new Map(),
			isWaiting: false,
			permissionSent: false,
			hadToolsInTurn: false,
			isExternal: true,
			label: p.label,
		};

		agents.set(p.id, agent);
		knownJsonlFiles.add(p.jsonlFile);
		console.log(`[Pixel Agents] Restored agent ${p.id} -> ${path.basename(p.jsonlFile)}`);

		if (p.id > maxId) maxId = p.id;
		restoredProjectDir = p.projectDir;

		// Start file watching, skipping to end
		try {
			const stat = fs.statSync(p.jsonlFile);
			agent.fileOffset = stat.size;
			startFileWatching(p.id, p.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, emit);
		} catch { /* ignore */ }
	}

	if (maxId >= nextAgentIdRef.current) {
		nextAgentIdRef.current = maxId + 1;
	}

	doPersist();

	if (restoredProjectDir) {
		ensureProjectScan(
			restoredProjectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef,
			nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			emit, doPersist,
		);
	}
}

export function sendExistingAgents(
	agents: Map<number, AgentState>,
	emit: (msg: unknown) => void,
): void {
	const agentIds: number[] = [];
	for (const id of agents.keys()) {
		agentIds.push(id);
	}
	agentIds.sort((a, b) => a - b);

	const agentMeta = getAgentSeats();

	console.log(`[Pixel Agents] sendExistingAgents: agents=${JSON.stringify(agentIds)}`);

	emit({
		type: 'existingAgents',
		agents: agentIds,
		agentMeta,
		folderNames: {},
	});

	sendCurrentAgentStatuses(agents, emit);
}

export function sendCurrentAgentStatuses(
	agents: Map<number, AgentState>,
	emit: (msg: unknown) => void,
): void {
	for (const [agentId, agent] of agents) {
		for (const [toolId, status] of agent.activeToolStatuses) {
			emit({
				type: 'agentToolStart',
				id: agentId,
				toolId,
				status,
			});
		}
		if (agent.isWaiting) {
			emit({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		}
	}
}
