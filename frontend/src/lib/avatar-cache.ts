import { avatarUrl } from "@/api/auth";

const versions = new Map<string, string>();
const existsMap = new Map<string, boolean>();
const checking = new Set<string>();
const listeners = new Set<(userId: string) => void>();

export function getAvatarSrc(userId?: string | null): string | undefined {
	if (!userId) return undefined;
	const v = versions.get(userId);
	return avatarUrl(userId, v);
}

export function getAvatarExists(userId?: string | null): boolean | undefined {
	if (!userId) return undefined;
	return existsMap.get(userId);
}

export function bumpAvatar(userId?: string | null): void {
	if (!userId) return;
	versions.set(userId, String(Date.now()));
	existsMap.delete(userId);
	ensureAvatarChecked(userId).catch(() => void 0);
	for (const cb of listeners) {
		cb(userId);
	}
}

export function subscribeAvatar(
	listener: (userId: string) => void,
): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export async function ensureAvatarChecked(
	userId?: string | null,
): Promise<void> {
	if (!userId) return;
	if (checking.has(userId)) return;
	if (existsMap.has(userId)) return;
	checking.add(userId);
	try {
		const url = getAvatarSrc(userId);
		if (!url) {
			return;
		}
		let ok = false;
		try {
			const resp = await fetch(url, { method: "HEAD", cache: "no-store" });
			ok = resp.ok;
		} catch {
			try {
				const resp = await fetch(url, { method: "GET", cache: "no-store" });
				ok = resp.ok;
			} catch {
				ok = false;
			}
		}
		existsMap.set(userId, ok);
	} finally {
		checking.delete(userId);
		for (const cb of listeners) {
			cb(userId);
		}
	}
}
