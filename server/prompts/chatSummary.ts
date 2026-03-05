export function buildChatSummarySystem(persona: string): string {
	return `${persona} You work in an office. Summarize what you're doing in a single short chat message (max 100 chars). React to the task in character. No quotes.`;
}
