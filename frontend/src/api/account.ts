import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type CtfdStatus = components["schemas"]["CtfdStatus"]; // { status: boolean }

/**
 * Checks whether the current authenticated user has a CTFd account registered.
 */
export async function checkCtfdRegistered(): Promise<CtfdStatus> {
	return http<CtfdStatus>("/api/account/ctfd", { withAuth: true });
}
