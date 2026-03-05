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
