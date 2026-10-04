import type { components } from "@/api/schema/schema";
import axios from "axios";
import { http } from "./http";

export type AttachmentDTO = components["schemas"]["AttachmentDTO"];
export type AttachmentDownloadDTO =
	components["schemas"]["AttachmentDownloadDTO"];
export type AttachmentUploadDTO = components["schemas"]["AttachmentUploadDTO"];

/** What a set of additional materials belongs to. Tasks cover exam and practice tasks. */
export type AttachmentOwner =
	| { kind: "lecture"; id: number }
	| { kind: "task"; id: number };

const ownerPath = (owner: AttachmentOwner) =>
	`/api/attachments/${owner.kind}/${owner.id}`;

export const attachmentsQueryKey = (owner: AttachmentOwner) => [
	"attachments",
	owner.kind,
	owner.id,
];

export async function listAttachments(
	owner: AttachmentOwner,
): Promise<AttachmentDTO[]> {
	return http<AttachmentDTO[]>(ownerPath(owner), { withAuth: true });
}

/** Pending attachment + presigned POST to upload the file straight to storage. */
export async function startAttachmentUpload(
	owner: AttachmentOwner,
	file: File,
): Promise<AttachmentUploadDTO> {
	return http<AttachmentUploadDTO>(ownerPath(owner), {
		method: "POST",
		body: JSON.stringify({
			file_name: file.name,
			content_type: file.type || undefined,
			size: file.size,
		}),
		withAuth: true,
	});
}

export async function completeAttachmentUpload(
	id: string,
): Promise<AttachmentDTO> {
	return http<AttachmentDTO>(`/api/attachments/${id}/complete`, {
		method: "POST",
		withAuth: true,
	});
}

/** Pulls the human-readable reason out of an S3 XML error body. */
function storageErrorMessage(status: number, body: unknown): string {
	const text = typeof body === "string" ? body : "";
	const message = /<Message>([^<]*)<\/Message>/.exec(text)?.[1];
	const code = /<Code>([^<]*)<\/Code>/.exec(text)?.[1];
	if (code === "EntityTooLarge") return "File is too large";
	return message || code || `Storage rejected the upload (HTTP ${status})`;
}

/**
 * Uploads a file straight to storage: the LMS hands out a presigned POST that
 * pins the key, type and size, the browser sends the bytes to S3, then the LMS
 * confirms the object exists. A failed upload is cancelled server-side.
 */
export async function uploadAttachment(
	owner: AttachmentOwner,
	file: File,
	onProgress?: (percent: number) => void,
): Promise<AttachmentDTO> {
	const { attachment_id, url, fields } = await startAttachmentUpload(
		owner,
		file,
	);

	try {
		const form = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			form.append(key, value);
		}
		// S3 ignores every field after the file, so it must come last
		form.append("file", file, file.name);

		// plain axios: our bearer token and cookies must never reach the bucket
		const res = await axios.post(url, form, {
			withCredentials: false,
			responseType: "text",
			validateStatus: () => true,
			onUploadProgress: (e) => {
				if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
			},
		});
		if (res.status < 200 || res.status >= 300) {
			throw new Error(storageErrorMessage(res.status, res.data));
		}

		return await completeAttachmentUpload(attachment_id);
	} catch (e) {
		await deleteAttachment(attachment_id).catch(() => undefined);
		throw e;
	}
}

/** Uploads files one by one; resolves with the names of the ones that failed. */
export async function uploadAttachments(
	owner: AttachmentOwner,
	files: File[],
): Promise<string[]> {
	const failed: string[] = [];
	for (const file of files) {
		try {
			await uploadAttachment(owner, file);
		} catch {
			failed.push(file.name);
		}
	}
	return failed;
}

export async function deleteAttachment(id: string): Promise<void> {
	await http<void>(`/api/attachments/${id}`, {
		method: "DELETE",
		withAuth: true,
	});
}

/** Fetches a short-lived signed link and lets the browser download the file. */
export async function downloadAttachment(id: string): Promise<void> {
	const { url } = await http<AttachmentDownloadDTO>(
		`/api/attachments/${id}/download`,
		{ withAuth: true },
	);
	const a = document.createElement("a");
	a.href = url;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
