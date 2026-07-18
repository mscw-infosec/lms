import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type CreateLectureRequestDTO =
	components["schemas"]["CreateLectureRequestDTO"];
export type UpdateLectureRequestDTO =
	components["schemas"]["UpdateLectureRequestDTO"];
export type CreateLectureResponseDTO =
	components["schemas"]["CreateLectureResponseDTO"];
export type LectureResponseDTO = components["schemas"]["LectureResponseDTO"];
export type LectureSummaryDTO = components["schemas"]["LectureSummaryDTO"];

export async function createLecture(
	data: CreateLectureRequestDTO,
): Promise<CreateLectureResponseDTO> {
	return http<CreateLectureResponseDTO>("/api/lecture/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function getLecture(id: number): Promise<LectureResponseDTO> {
	return http<LectureResponseDTO>(`/api/lecture/${id}`, { withAuth: true });
}

export async function getTopicLectures(
	topicId: number,
): Promise<LectureSummaryDTO[]> {
	return http<LectureSummaryDTO[]>(`/api/lecture/topic/${topicId}`, {
		withAuth: true,
	});
}

export async function updateLecture(
	id: number,
	data: UpdateLectureRequestDTO,
): Promise<void> {
	await http<void>(`/api/lecture/${id}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteLecture(id: number): Promise<void> {
	await http<void>(`/api/lecture/${id}`, { method: "DELETE", withAuth: true });
}

export async function completeLecture(id: number): Promise<void> {
	await http<void>(`/api/lecture/${id}/complete`, {
		method: "POST",
		withAuth: true,
	});
}
