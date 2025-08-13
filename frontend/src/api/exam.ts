import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type UpsertExamRequestDTO =
	components["schemas"]["UpsertExamRequestDTO"];
export type CreateExamResponseDTO =
	components["schemas"]["CreateExamResponseDTO"];
export type PublicTaskDTO = components["schemas"]["PublicTaskDTO"];

export async function createExam(
	data: UpsertExamRequestDTO,
): Promise<CreateExamResponseDTO> {
	return http<CreateExamResponseDTO>("/api/exam/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function updateExam(
	exam_id: string,
	data: UpsertExamRequestDTO,
): Promise<void> {
	await http<void>(`/api/exam/${exam_id}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteExam(exam_id: string): Promise<void> {
	await http<void>(`/api/exam/${exam_id}`, {
		method: "DELETE",
		withAuth: true,
	});
}

export async function getExamById(exam_id: string) {
	return http<components["schemas"]["Exam"]>(`/api/exam/${exam_id}`, {
		withAuth: true,
	});
}

export async function updateExamTasks(
	exam_id: string,
	taskIds: number[],
): Promise<void> {
	await http<void>(`/api/exam/${exam_id}/tasks`, {
		method: "PUT",
		body: JSON.stringify(taskIds),
		withAuth: true,
	});
}

export async function getExamTasks(exam_id: string): Promise<PublicTaskDTO[]> {
	return http<PublicTaskDTO[]>(`/api/exam/${exam_id}/tasks`, {
		withAuth: true,
	});
}
