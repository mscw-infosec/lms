import type { components } from "@/api/schema/schema";
import axios from "axios";
import { http } from "./http";
import { getAccessToken } from "./token";

export type UserOverallRating = components["schemas"]["UserOverallRatingDTO"];
export type CourseScore = components["schemas"]["CourseScoreDTO"];
export type CourseLeaderboard = components["schemas"]["CourseLeaderboardDTO"];
export type LeaderboardEntry = components["schemas"]["LeaderboardEntryDTO"];
export type CourseUserRating = components["schemas"]["CourseUserRatingDTO"];
export type RatingBreakdownItem =
	components["schemas"]["RatingBreakdownItemDTO"];

export type ExportFormat = "csv" | "xlsx";

function getApiBaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_API_BASE_URL || "";
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

// GET /rating/me
export async function getMyOverall(): Promise<UserOverallRating> {
	return http<UserOverallRating>("/api/rating/me", { withAuth: true });
}

// GET /rating/user/{user_id}
export async function getUserOverall(
	userId: string,
): Promise<UserOverallRating> {
	return http<UserOverallRating>(`/api/rating/user/${userId}`, {
		withAuth: true,
	});
}

// GET /rating/course/{course_id}?limit&offset&search
export async function getCourseLeaderboard(
	courseId: number,
	opts: { limit: number; offset: number; search?: string },
): Promise<CourseLeaderboard> {
	const params = new URLSearchParams({
		limit: String(opts.limit),
		offset: String(opts.offset),
	});
	if (opts.search?.trim()) params.set("search", opts.search.trim());
	return http<CourseLeaderboard>(
		`/api/rating/course/${courseId}?${params.toString()}`,
		{ withAuth: true },
	);
}

// GET /rating/course/{course_id}/me
export async function getMyCourseRating(
	courseId: number,
): Promise<CourseUserRating> {
	return http<CourseUserRating>(`/api/rating/course/${courseId}/me`, {
		withAuth: true,
	});
}

// GET /rating/course/{course_id}/user/{user_id}
export async function getUserCourseRating(
	courseId: number,
	userId: string,
): Promise<CourseUserRating> {
	return http<CourseUserRating>(
		`/api/rating/course/${courseId}/user/${userId}`,
		{ withAuth: true },
	);
}

function parseFilename(disposition: string | undefined, fallback: string) {
	if (!disposition) return fallback;
	const match = /filename="?([^"]+)"?/.exec(disposition);
	return match?.[1] ?? fallback;
}

async function downloadFile(path: string, fallback: string): Promise<void> {
	const token = getAccessToken();
	const res = await axios.get(`${getApiBaseUrl()}${path}`, {
		responseType: "blob",
		withCredentials: true,
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	});

	const filename = parseFilename(
		res.headers["content-disposition"] as string | undefined,
		fallback,
	);

	const blobUrl = window.URL.createObjectURL(res.data as Blob);
	const link = document.createElement("a");
	link.href = blobUrl;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(blobUrl);
}

// GET /rating/me/export?format=...
export async function downloadMyOverallExport(
	format: ExportFormat,
): Promise<void> {
	return downloadFile(
		`/api/rating/me/export?format=${format}`,
		`rating-overall.${format}`,
	);
}

// GET /rating/user/{user_id}/export?format=...
export async function downloadUserOverallExport(
	userId: string,
	format: ExportFormat,
): Promise<void> {
	return downloadFile(
		`/api/rating/user/${userId}/export?format=${format}`,
		`rating-user-${userId}.${format}`,
	);
}

// GET /rating/course/{course_id}/export?format=...
export async function downloadCourseLeaderboardExport(
	courseId: number,
	format: ExportFormat,
): Promise<void> {
	return downloadFile(
		`/api/rating/course/${courseId}/export?format=${format}`,
		`rating-course-${courseId}-leaderboard.${format}`,
	);
}

// GET /rating/course/{course_id}/me/export?format=...
export async function downloadMyCourseRatingExport(
	courseId: number,
	format: ExportFormat,
): Promise<void> {
	return downloadFile(
		`/api/rating/course/${courseId}/me/export?format=${format}`,
		`rating-course-${courseId}.${format}`,
	);
}

// GET /rating/course/{course_id}/user/{user_id}/export?format=...
export async function downloadUserCourseRatingExport(
	courseId: number,
	userId: string,
	format: ExportFormat,
): Promise<void> {
	return downloadFile(
		`/api/rating/course/${courseId}/user/${userId}/export?format=${format}`,
		`rating-course-${courseId}-user-${userId}.${format}`,
	);
}
