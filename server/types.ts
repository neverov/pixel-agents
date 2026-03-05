export interface AgentState {
	id: number;
	/** node-pty process reference (null for detected external sessions) */
	ptyProcess: import('node-pty').IPty | null;
	projectDir: string;
	jsonlFile: string;
	fileOffset: number;
	lineBuffer: string;
	activeToolIds: Set<string>;
	activeToolStatuses: Map<string, string>;
	activeToolNames: Map<string, string>;
	activeSubagentToolIds: Map<string, Set<string>>;
	activeSubagentToolNames: Map<string, Map<string, string>>;
	isWaiting: boolean;
	permissionSent: boolean;
	hadToolsInTurn: boolean;
	/** Whether this agent was detected from an external session (not spawned by us) */
	isExternal?: boolean;
	/** Display label for the session */
	label?: string;
}

export interface PersistedAgent {
	id: number;
	jsonlFile: string;
	projectDir: string;
	label?: string;
}
