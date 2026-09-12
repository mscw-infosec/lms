import type { components } from "@/api/schema/schema";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import {
	accessTokenNeedsRefresh,
	getAccessToken,
	setAccessToken,
} from "./token";

const DEFAULT_HEADERS: HeadersInit = {
	"Content-Type": "application/json",
};

function getApiBaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_API_BASE_URL || "";
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

let refreshInFlight: Promise<boolean> | null = null;

let sessionRejectedAt = 0;
const SESSION_REJECTED_COOLDOWN_MS = 30_000;

export function refreshAccessToken(): Promise<boolean> {
	if (Date.now() - sessionRejectedAt < SESSION_REJECTED_COOLDOWN_MS) {
		return Promise.resolve(false);
	}

	refreshInFlight ??= requestRefresh().finally(() => {
		refreshInFlight = null;
	});
	return refreshInFlight;
}

export async function forceRefreshAccessToken(): Promise<boolean> {
	await refreshInFlight?.catch(() => false);
	sessionRejectedAt = 0;
	return refreshAccessToken();
}

async function requestRefresh(): Promise<boolean> {
	const attempted = getAccessToken();

	let res: AxiosResponse<components["schemas"]["RefreshResponse"]>;
	try {
		res = await axios.post<components["schemas"]["RefreshResponse"]>(
			`${getApiBaseUrl()}/api/auth/refresh`,
			undefined,
			{
				headers: DEFAULT_HEADERS as Record<string, string>,
				withCredentials: true,
				validateStatus: () => true,
			},
		);
	} catch {
		return false;
	}

	if (res.status >= 200 && res.status < 300 && res.data?.access_token) {
		sessionRejectedAt = 0;
		setAccessToken(res.data.access_token);
		return true;
	}

	if (res.status === 401 || res.status === 403) {
		sessionRejectedAt = Date.now();
		if (getAccessToken() === attempted) setAccessToken(null);
	}

	return false;
}

export async function ensureFreshToken(): Promise<boolean> {
	if (accessTokenNeedsRefresh()) await refreshAccessToken();
	return !!getAccessToken();
}

export interface HttpOptions extends RequestInit {
	withAuth?: boolean;
}

export async function http<T>(
	path: string,
	options: HttpOptions = {},
): Promise<T> {
	const baseUrl = getApiBaseUrl();
	const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
	const headers = new Headers(DEFAULT_HEADERS);

	if (options.headers) {
		const provided = new Headers(options.headers as HeadersInit);
		provided.forEach((value, key) => headers.set(key, value));
	}

	if (options.withAuth) {
		await ensureFreshToken();
		const token = getAccessToken();
		if (token) headers.set("Authorization", `Bearer ${token}`);
	}

	const createConfig = (): AxiosRequestConfig => ({
		url,
		method: (options.method as AxiosRequestConfig["method"]) ?? "get",
		headers: Object.fromEntries(headers.entries()),
		data: (options as RequestInit).body,
		signal: (options.signal ?? undefined) as AbortSignal | undefined,
		withCredentials: options.credentials
			? options.credentials === "include"
			: true,
		validateStatus: () => true,
	});

	const doRequest = async (): Promise<AxiosResponse> =>
		axios.request(createConfig());

	let res = await doRequest();
	if (res.status === 401 && options.withAuth) {
		if (await refreshAccessToken()) {
			const token = getAccessToken();
			if (token) headers.set("Authorization", `Bearer ${token}`);
			res = await doRequest();
		}
	}

	if (res.status < 200 || res.status >= 300) {
		let text = "";
		try {
			text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
		} catch {
			text = "";
		}
		throw new Error(text || `HTTP ${res.status}`);
	}

	if (res.status === 204) return undefined as unknown as T;

	return res.data as T;
}
