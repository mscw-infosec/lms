import type { components } from "@/api/schema/schema";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { getAccessToken, setAccessToken } from "./token";

const DEFAULT_HEADERS: HeadersInit = {
	"Content-Type": "application/json",
};

function getApiBaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_API_BASE_URL || "";
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function tryRefreshToken(): Promise<boolean> {
	try {
		const res = await axios.post<components["schemas"]["RefreshResponse"]>(
			`${getApiBaseUrl()}/api/auth/refresh`,
			undefined,
			{
				headers: DEFAULT_HEADERS as Record<string, string>,
				withCredentials: true,
				validateStatus: () => true,
			},
		);
		if (res.status < 200 || res.status >= 300) return false;
		setAccessToken(res.data.access_token);
		return true;
	} catch {
		return false;
	}
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
		const refreshed = await tryRefreshToken();
		if (refreshed) {
			const token = getAccessToken();
			if (token) headers.set("Authorization", `Bearer ${token}`);
			res = await doRequest();
		} else {
			setAccessToken(null);
			if (typeof window !== "undefined") {
				window.location.reload();
			}
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
