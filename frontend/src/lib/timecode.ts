const TIMECODE = /(^|[^\d:])((?:(\d{1,2}):)?(\d{1,2}):(\d{2}))(?![\d:])/g;

export type NotePart =
	| { kind: "text"; start: number; value: string }
	| { kind: "timecode"; start: number; value: string; seconds: number };

export function formatTimecode(totalSeconds: number): string {
	const total = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");

	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${pad(minutes)}:${pad(seconds)}`;
}

export function splitByTimecodes(text: string): NotePart[] {
	const parts: NotePart[] = [];
	let last = 0;

	for (const match of text.matchAll(TIMECODE)) {
		const prefix = match[1] ?? "";
		const value = match[2] ?? "";
		const hours = match[3] ? Number(match[3]) : 0;
		const minutes = Number(match[4]);
		const seconds = Number(match[5]);
		if (seconds > 59 || (match[3] && minutes > 59)) continue;

		const start = (match.index ?? 0) + prefix.length;
		if (start > last) {
			parts.push({ kind: "text", start: last, value: text.slice(last, start) });
		}
		parts.push({
			kind: "timecode",
			start,
			value,
			seconds: hours * 3600 + minutes * 60 + seconds,
		});
		last = start + value.length;
	}

	if (last < text.length) {
		parts.push({ kind: "text", start: last, value: text.slice(last) });
	}

	return parts;
}
