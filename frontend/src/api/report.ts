import type { components } from "@/api/schema/schema";
import axios from "axios";
import { http } from "./http";
import { getAccessToken } from "./token";

export type Gradebook = components["schemas"]["Gradebook"];
export type GradebookRow = components["schemas"]["GradebookRow"];
export type GradebookSummary = components["schemas"]["GradebookSummary"];
export type AttemptStatus = components["schemas"]["AttemptStatus"];

export type ExportFormat = "csv" | "xlsx";

function getApiBaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_API_BASE_URL || "";
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

// GET /report/exam/{exam_id}
export async function getExamGradebook(examId: string): Promise<Gradebook> {
	return http<Gradebook>(`/api/report/exam/${examId}`, { withAuth: true });
}

function parseFilename(disposition: string | undefined, fallback: string) {
	if (!disposition) return fallback;
	const match = /filename="?([^"]+)"?/.exec(disposition);
	return match?.[1] ?? fallback;
}

// GET /report/exam/{exam_id}/export?format=... — downloads a file in the browser.
export async function downloadExamExport(
	examId: string,
	format: ExportFormat,
): Promise<void> {
	const token = getAccessToken();
	const res = await axios.get(
		`${getApiBaseUrl()}/api/report/exam/${examId}/export?format=${format}`,
		{
			responseType: "blob",
			withCredentials: true,
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		},
	);

	const filename = parseFilename(
		res.headers["content-disposition"] as string | undefined,
		`exam-${examId}-results.${format}`,
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
