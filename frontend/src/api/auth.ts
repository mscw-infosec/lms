import { http } from "./http";
import { setAccessToken } from "./token";
import type { components } from "@/api/schema/schema";

export type BasicLoginRequest = components["schemas"]["BasicLoginRequest"];
export type BasicLoginResponse = components["schemas"]["BasicLoginResponse"];
export type BasicRegisterRequest = components["schemas"]["BasicRegisterRequest"];
export type GetUserResponseDTO = components["schemas"]["GetUserResponseDTO"];
export type SessionInfo = components["schemas"]["SessionInfo"];
export type AvatarUploadResponse = components["schemas"]["AvatarUploadResponse"];

export async function login(data: BasicLoginRequest): Promise<void> {
	const res = await http<BasicLoginResponse>("/api/basic/login", {
		method: "POST",
		body: JSON.stringify(data),
	});
	setAccessToken(res.access_token);
}

export async function register(data: BasicRegisterRequest): Promise<void> {
	const res = await http<BasicLoginResponse>("/api/basic/register", {
		method: "POST",
		body: JSON.stringify(data),
	});
	setAccessToken(res.access_token);
}

export async function getCurrentUser(): Promise<GetUserResponseDTO> {
	return http<GetUserResponseDTO>("/api/account", { withAuth: true });
}

export type OAuthProvider = "github" | "yandex";

export function getOAuthLoginUrl(provider: OAuthProvider): string {
	const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
	return `${base}/api/oauth/${provider}/login`;
}

export async function getSessions(): Promise<SessionInfo[]> {
    return http<SessionInfo[]>("/api/auth/sessions", { withAuth: true });
}

export async function logoutAllSessions(): Promise<void> {
    await http<void>("/api/auth/logout-all", { method: "POST", withAuth: true });
    setAccessToken(null);
}

export async function logoutSession(jti: string): Promise<void> {
    await http<void>(`/api/auth/logout-session/${jti}`, { method: "POST", withAuth: true });
}

export async function getAvatarUpload(): Promise<AvatarUploadResponse> {
    return http<AvatarUploadResponse>("/api/account/avatar", { method: "PUT", withAuth: true });
}
