import type { components } from "@/api/schema/schema";
import { http } from "./http";
import { setAccessToken } from "./token";

export type BasicLoginRequest = components["schemas"]["BasicLoginRequest"];
export type BasicLoginResponse = components["schemas"]["BasicLoginResponse"];
export type BasicRegisterRequest =
	components["schemas"]["BasicRegisterRequest"];
export type BasicRegisterResponse =
	components["schemas"]["BasicRegisterResponse"];
export type GetUserResponseDTO = components["schemas"]["GetUserResponseDTO"];
export type UpdateProfileRequest =
	components["schemas"]["UpdateProfileRequest"];
export type SessionInfo = components["schemas"]["SessionInfo"];
export type AvatarUploadResponse =
	components["schemas"]["AvatarUploadResponse"];

export async function login(data: BasicLoginRequest): Promise<void> {
	const res = await http<BasicLoginResponse>("/api/basic/login", {
		method: "POST",
		body: JSON.stringify(data),
	});
	setAccessToken(res.access_token);
}

export async function register(data: BasicRegisterRequest): Promise<void> {
	const res = await http<BasicRegisterResponse>("/api/basic/register", {
		method: "POST",
		body: JSON.stringify(data),
	});
	setAccessToken(res.access_token);
}

/** Confirm an email address from the token embedded in the verification link. */
export async function verifyEmail(token: string): Promise<void> {
	await http<void>("/api/basic/verify-email", {
		method: "POST",
		body: JSON.stringify({ token }),
	});
}

/** Re-send the verification email to the current user. */
export async function resendVerification(): Promise<void> {
	await http<void>("/api/account/resend-verification", {
		method: "POST",
		withAuth: true,
	});
}

/** Update the current user's names (profile edit / OAuth detail completion). */
export async function updateProfile(
	data: UpdateProfileRequest,
): Promise<GetUserResponseDTO> {
	return http<GetUserResponseDTO>("/api/account/profile", {
		method: "PATCH",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

/** Exchange the refresh cookie for a fresh access token (picks up updated gate flags). */
export async function refreshAccessToken(): Promise<void> {
	const res = await http<{ access_token: string }>("/api/auth/refresh", {
		method: "POST",
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
	await http<void>(`/api/auth/logout-session/${jti}`, {
		method: "POST",
		withAuth: true,
	});
}

export async function getAvatarUpload(): Promise<AvatarUploadResponse> {
	return http<AvatarUploadResponse>("/api/account/avatar", {
		method: "PUT",
		withAuth: true,
	});
}

export function avatarUrl(userId: string, version?: string): string {
	const base = "https://storage.yandexcloud.net/lms-infosec-moscow";
	const url = `${base}/avatars/${userId}`;
	return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}
