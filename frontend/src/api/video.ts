import type { components } from "@/api/schema/schema";
import * as tus from "tus-js-client";
import { http } from "./http";

export type GetVideoUrlResponseDTO =
	components["schemas"]["GetVideoUrlResponseDTO"];
export type CreateVideoResponseDTO =
	components["schemas"]["CreateVideoResponseDTO"];

// GET /video/{video_id} — resolves a video id to a playable (signed) URL.
export async function getVideoUrl(videoId: string): Promise<string> {
	const res = await http<GetVideoUrlResponseDTO>(`/api/video/${videoId}`, {
		withAuth: true,
	});
	return res.url;
}

// POST /video/new — creates the video entity and returns its id + TUS upload URL.
export async function createVideo(
	name: string,
	size: number,
): Promise<CreateVideoResponseDTO> {
	return http<CreateVideoResponseDTO>("/api/video/new", {
		method: "POST",
		body: JSON.stringify({ name, size }),
		withAuth: true,
	});
}

/**
 * Uploads a video file to Yandex Cloud Video.
 *
 * Creates the video entity (getting a resumable TUS upload URL), streams the
 * file to it, and resolves with the video id to store on a lecture. The video
 * becomes playable after Yandex finishes transcoding.
 */
export async function uploadVideoFile(
	file: File,
	onProgress?: (percent: number) => void,
): Promise<string> {
	const { id, url } = await createVideo(file.name, file.size);

	if (!url) {
		throw new Error("Server did not return an upload URL.");
	}
	if (!id) {
		throw new Error(
			"Server did not return a video id. The backend may be out of date — rebuild and restart it.",
		);
	}

	await new Promise<void>((resolve, reject) => {
		const upload = new tus.Upload(file, {
			uploadUrl: url,
			retryDelays: [0, 1000, 3000, 5000],
			chunkSize: 8 * 1024 * 1024,
			metadata: {
				filename: file.name,
				filetype: file.type || "video/mp4",
			},
			onError: (error) => reject(error),
			onProgress: (bytesSent, bytesTotal) => {
				if (bytesTotal > 0) {
					onProgress?.(Math.round((bytesSent / bytesTotal) * 100));
				}
			},
			onSuccess: () => resolve(),
		});
		upload.start();
	});

	return id;
}
