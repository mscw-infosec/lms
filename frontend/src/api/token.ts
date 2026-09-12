export const ACCESS_TOKEN_STORAGE_KEY = "lms_access_token";

const EXPIRY_SKEW_MS = 60_000;

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
		window.dispatchEvent(
			new CustomEvent("auth:token-changed", { detail: token }),
		);
	} catch {
		// ignore
	}
}

export function setAccessToken(token: string | null): void {
	if (token === inMemoryAccessToken && readStoredToken() === token) return;

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

function readStoredToken(): string | null {
	if (typeof window === "undefined") return inMemoryAccessToken;
	try {
		return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
	} catch {
		return inMemoryAccessToken;
	}
}

function getTokenExpiry(token: string): number | null {
	const payload = token.split(".")[1];
	if (!payload) return null;
	try {
		const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
		const exp = (JSON.parse(json) as { exp?: number }).exp;
		return typeof exp === "number" ? exp * 1000 : null;
	} catch {
		return null;
	}
}

export function accessTokenNeedsRefresh(): boolean {
	const token = getAccessToken();
	if (!token) return true;

	const expiry = getTokenExpiry(token);
	if (expiry === null) return false;

	return Date.now() >= expiry - EXPIRY_SKEW_MS;
}
