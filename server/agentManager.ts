import { type AgentState, type PersistedAgent, sessionIdFromFile } from './types.js';
import { replaceAllAgents } from './db/agentsRepo.js';

export function persistAgents(agents: Map<number, AgentState>): void {
	const persisted: PersistedAgent[] = [];
	for (const agent of agents.values()) {
		persisted.push({
			id: agent.id,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
			label: agent.label,
			customLabel: agent.customLabel,
			sessionId: agent.sessionId || sessionIdFromFile(agent.jsonlFile),
		});
	}
	replaceAllAgents(persisted).catch(err => console.error('[Persist] Failed:', err));
}
