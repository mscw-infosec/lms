export const ACCESS_TOKEN_STORAGE_KEY = "lms_access_token";

let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
	if (typeof window === "undefined") return inMemoryAccessToken;
	if (inMemoryAccessToken) return inMemoryAccessToken;
	try {
		const stored = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
		inMemoryAccessToken = stored;
		return stored;
	} catch {
		return inMemoryAccessToken;
	}
}

function notifyTokenChanged(token: string | null): void {
	if (typeof window === "undefined") return;
	try {
		window.dispatchEvent(new CustomEvent("auth:token-changed", { detail: token }));
	} catch {
		// ignore
	}
}

export function setAccessToken(token: string | null): void {
	inMemoryAccessToken = token;
	if (typeof window === "undefined") return;
	try {
		if (token) {
			window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
		} else {
			window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
		}
	} catch {
		// ignore
	} finally {
		notifyTokenChanged(token);
	}
} 