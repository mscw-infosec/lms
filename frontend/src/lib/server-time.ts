const STORAGE_KEY = "lms.server-time-offset";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

let offsetMs = 0;
let hydrated = false;

function hydrate(): void {
	if (hydrated) return;
	hydrated = true;
	if (typeof window === "undefined") return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as { offsetMs?: unknown; savedAt?: unknown };
		if (
			typeof parsed.offsetMs !== "number" ||
			!Number.isFinite(parsed.offsetMs) ||
			typeof parsed.savedAt !== "number" ||
			Math.abs(Date.now() - parsed.savedAt) > MAX_AGE_MS
		) {
			return;
		}
		offsetMs = parsed.offsetMs;
	} catch {}
}

export function noteServerNow(serverMs: number): void {
	hydrate();
	if (!Number.isFinite(serverMs)) return;
	offsetMs = serverMs - Date.now();
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ offsetMs, savedAt: Date.now() }),
		);
	} catch {}
}

export function serverNow(): number {
	hydrate();
	return Date.now() + offsetMs;
}

export function getServerTimeOffsetMs(): number {
	hydrate();
	return offsetMs;
}
