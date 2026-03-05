import Anthropic from '@anthropic-ai/sdk';
import {
	CHAT_SUMMARIZE_INTERVAL_MS,
	CHAT_MAX_TEXT_LENGTH,
	CHAT_SUMMARY_MODEL,
	CHAT_SUMMARY_MAX_TOKENS,
} from './constants.js';

const PERSONAS = [
	'You are the clueless but lovable boss. You misunderstand technical stuff but try to sound smart and supportive.',
	'You are the sarcastic one. You do your work well but always have a dry, witty comment about it.',
	'You are the overly enthusiastic one. Every task is the best task you have ever been given.',
	'You are the office slacker. You do the bare minimum and try to make everything sound harder than it is.',
	'You are the anxious perfectionist. You worry about everything going wrong and overthink every detail.',
	'You are the office gossip. You relate everything back to drama and what other people are doing.',
	'You are the old-timer who has seen it all. Nothing impresses you. You have a story for everything.',
	'You are the eager new hire. Everything is amazing and you want everyone to know you are contributing.',
	'You are the passive-aggressive one. You are "fine" with everything but your tone says otherwise.',
	'You are the motivational one. You turn every task into a life lesson and try to inspire your coworkers.',
];

const agentPersonas = new Map<number, string>();

function getPersona(agentId: number): string {
	let persona = agentPersonas.get(agentId);
	if (!persona) {
		persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
		agentPersonas.set(agentId, persona);
	}
	return persona;
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
	if (client) return client;
	if (!process.env.ANTHROPIC_API_KEY) return null;
	client = new Anthropic();
	return client;
}

interface PendingText {
	chunks: string[];
	timer: ReturnType<typeof setTimeout> | null;
}

const pending = new Map<number, PendingText>();

export function feedAgentText(
	agentId: number,
	text: string,
	agentName: string,
	onSummary: (agentId: number, sender: string, summary: string) => void,
): void {
	if (!getClient()) return;

	let entry = pending.get(agentId);
	if (!entry) {
		entry = { chunks: [], timer: null };
		pending.set(agentId, entry);
	}

	entry.chunks.push(text);

	if (entry.timer) clearTimeout(entry.timer);
	entry.timer = setTimeout(() => {
		flush(agentId, agentName, onSummary);
	}, CHAT_SUMMARIZE_INTERVAL_MS);
}

export function flushAgent(
	agentId: number,
	agentName: string,
	onSummary: (agentId: number, sender: string, summary: string) => void,
): void {
	flush(agentId, agentName, onSummary);
}

function flush(
	agentId: number,
	agentName: string,
	onSummary: (agentId: number, sender: string, summary: string) => void,
): void {
	const entry = pending.get(agentId);
	if (!entry || entry.chunks.length === 0) return;

	const combined = entry.chunks.join('\n').slice(0, CHAT_MAX_TEXT_LENGTH);
	entry.chunks = [];
	if (entry.timer) {
		clearTimeout(entry.timer);
		entry.timer = null;
	}

	const persona = getPersona(agentId);
	void summarize(combined, persona).then((summary) => {
		if (summary) {
			onSummary(agentId, agentName, summary);
		}
	});
}

async function summarize(text: string, persona: string): Promise<string | null> {
	const api = getClient();
	if (!api) return null;

	try {
		const response = await api.messages.create({
			model: CHAT_SUMMARY_MODEL,
			max_tokens: CHAT_SUMMARY_MAX_TOKENS,
			system: `${persona} You work in an office. Summarize what you're doing in a single short chat message (max 100 chars). React to the task in character. No quotes.`,
			messages: [{
				role: 'user',
				content: text,
			}],
		});

		const block = response.content[0];
		if (block.type === 'text') {
			return block.text.trim();
		}
		return null;
	} catch (err) {
		console.error('[ChatSummarizer] Error:', err);
		return null;
	}
}
