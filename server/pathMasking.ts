/**
 * Replace absolute file system paths in text with a generic placeholder.
 * Handles Windows (C:\..., C:/...) and Unix (/home/..., /Users/...) paths.
 */
export function maskPaths(text: string): string {
	return text
		// Windows absolute paths: C:\foo\bar or C:/foo/bar
		.replace(/[A-Za-z]:[/\\][\w./\\:-]+/g, '\u2026')
		// Unix absolute paths with 2+ segments
		.replace(/\/[\w.-]+(?:\/[\w.-]+)+/g, '\u2026')
		// Home dir shorthand ~/...
		.replace(/~\/[\w./-]+/g, '\u2026');
}

const REDACTED = '[REDACTED]';

/**
 * Strip common secret patterns from text to prevent credential leaks.
 * Applied to chat summaries, tool status strings, and any text sent to clients.
 */
export function redactSecrets(text: string): string {
	return text
		// Private key blocks (PEM)
		.replace(/-----BEGIN[A-Z \t]*PRIVATE KEY-----[\s\S]*?-----END[A-Z \t]*PRIVATE KEY-----/g, REDACTED)
		// Connection strings with credentials: postgres://user:pass@host, mysql://, mongodb://, redis://, amqp://
		.replace(/(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp)s?:\/\/[^\s"'`]+/gi, REDACTED)
		// Known API key prefixes (sk-ant-, sk-proj-, sk-live-, xoxb-, xoxp-, ghp_, gho_, glpat-, ATATT3x)
		.replace(/(?:sk-(?:ant|proj|live|test)-[\w-]{20,}|sk-[\w-]{40,}|xox[bp]-[\w-]{10,}|gh[po]_[\w]{30,}|glpat-[\w-]{20,}|ATATT3x[\w+/=-]{10,})/g, REDACTED)
		// Bearer and Basic auth headers
		.replace(/(?:Bearer|Basic)\s+[A-Za-z0-9+/=_-]{20,}/g, REDACTED)
		// Generic long tokens (40+ alphanumeric/base64 chars preceded by a separator)
		.replace(/(?<=[:=]\s*["'`]?)[A-Za-z0-9+/=_-]{40,}(?=["'`]?\s*$|["'`]?\s)/gm, REDACTED)
		// Password/secret/token assignments: key = "value" or key: value
		.replace(/(?:password|passwd|secret|token|api_?key|apikey|auth_?key|access_?key|private_?key)\s*[:=]\s*["'`]?[^\s"'`]{8,}["'`]?/gi, REDACTED);
}

const ADJECTIVES = [
	'swift', 'bright', 'calm', 'bold', 'keen',
	'warm', 'cool', 'wild', 'sharp', 'soft',
	'quick', 'dark', 'fair', 'deep', 'pure',
	'glad', 'wise', 'true', 'kind', 'rare',
];

const NOUNS = [
	'fox', 'owl', 'wolf', 'bear', 'hawk',
	'deer', 'hare', 'lynx', 'crow', 'wren',
	'pike', 'moth', 'newt', 'seal', 'swan',
	'finch', 'otter', 'raven', 'crane', 'robin',
];

/** Generate a deterministic random name from a seed string. */
export function randomNameFromSeed(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
	}
	// Use absolute value, split into two indices
	const h = Math.abs(hash);
	const adj = ADJECTIVES[h % ADJECTIVES.length];
	const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
	return `${adj}-${noun}`;
}
