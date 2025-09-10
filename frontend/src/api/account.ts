import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type CtfdStatus = components["schemas"]["CtfdStatus"]; // { status: boolean }
export type UserRole = components["schemas"]["UserRole"]; // "Student" | "Teacher" | "Admin"
export type PublicAccountDTO = components["schemas"]["PublicAccountDTO"];

/**
 * Checks whether the current authenticated user has a CTFd account registered.
 */
export async function checkCtfdRegistered(): Promise<CtfdStatus> {
	return http<CtfdStatus>("/api/account/ctfd", { withAuth: true });
}

/**
 * List accounts (admin only).
 */
export async function listAccounts(
	limit: number,
	offset: number,
): Promise<PublicAccountDTO[]> {
	const params = new URLSearchParams({
		limit: String(limit),
		offset: String(offset),
	});
	return http<PublicAccountDTO[]>(`/api/account/list?${params.toString()}`, {
		withAuth: true,
	});
}

/**
 * Update user role (admin only).
 */
export async function updateUserRole(
	userId: string,
	role: UserRole,
): Promise<void> {
	await http(`/api/account/${encodeURIComponent(userId)}/role`, {
		method: "PATCH",
		withAuth: true,
		body: JSON.stringify({ role }),
	});
}

/**
 * Upsert user attributes (admin only).
 */
export async function upsertUserAttributes(
	userId: string,
	attributes: Record<string, string>,
): Promise<Record<string, string>> {
	return http<Record<string, string>>(
		`/api/account/${encodeURIComponent(userId)}/attributes`,
		{
			method: "PATCH",
			withAuth: true,
			body: JSON.stringify(attributes),
		},
	);
}

/**
 * Delete single user attribute (admin only).
 */
export async function deleteUserAttribute(
	userId: string,
	key: string,
): Promise<void> {
	await http<void>(
		`/api/account/${encodeURIComponent(userId)}/attributes/${encodeURIComponent(key)}`,
		{
			method: "DELETE",
			withAuth: true,
		},
	);
}
