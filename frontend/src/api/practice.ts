import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type PracticeSummaryDTO = components["schemas"]["PracticeSummaryDTO"];
export type PracticeDetailDTO = components["schemas"]["PracticeDetailDTO"];
export type PracticeAdminDTO = components["schemas"]["PracticeAdminDTO"];
export type PracticeTaskDTO = components["schemas"]["PracticeTaskDTO"];
export type PracticeSubmitResultDTO =
	components["schemas"]["PracticeSubmitResultDTO"];
export type CreatePracticeRequestDTO =
	components["schemas"]["CreatePracticeRequestDTO"];
export type UpdatePracticeRequestDTO =
	components["schemas"]["UpdatePracticeRequestDTO"];
export type TaskAnswer = components["schemas"]["TaskAnswer"];
export type UpsertTaskRequestDTO =
	components["schemas"]["UpsertTaskRequestDTO"];

export async function listTopicPractices(
	topicId: number,
): Promise<PracticeSummaryDTO[]> {
	return http<PracticeSummaryDTO[]>(`/api/practice/topic/${topicId}`, {
		withAuth: true,
	});
}

export async function createPractice(
	data: CreatePracticeRequestDTO,
): Promise<{ id: number }> {
	return http<{ id: number }>("/api/practice/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function getPractice(id: number): Promise<PracticeDetailDTO> {
	return http<PracticeDetailDTO>(`/api/practice/${id}`, { withAuth: true });
}

export async function getPracticeAdmin(id: number): Promise<PracticeAdminDTO> {
	return http<PracticeAdminDTO>(`/api/practice/${id}/admin`, {
		withAuth: true,
	});
}

export async function updatePractice(
	id: number,
	data: UpdatePracticeRequestDTO,
): Promise<void> {
	await http<void>(`/api/practice/${id}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deletePractice(id: number): Promise<void> {
	await http<void>(`/api/practice/${id}`, { method: "DELETE", withAuth: true });
}

export async function createPracticeTask(
	practiceId: number,
	data: UpsertTaskRequestDTO,
): Promise<{ id: number }> {
	return http<{ id: number }>(`/api/practice/${practiceId}/task`, {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function updatePracticeTask(
	practiceId: number,
	taskId: number,
	data: UpsertTaskRequestDTO,
): Promise<void> {
	await http<void>(`/api/practice/${practiceId}/task/${taskId}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function removePracticeTask(
	practiceId: number,
	taskId: number,
): Promise<void> {
	await http<void>(`/api/practice/${practiceId}/task/${taskId}`, {
		method: "DELETE",
		withAuth: true,
	});
}

export async function submitPractice(
	taskId: number,
	answer: TaskAnswer,
): Promise<PracticeSubmitResultDTO> {
	return http<PracticeSubmitResultDTO>(`/api/practice/task/${taskId}/submit`, {
		method: "POST",
		body: JSON.stringify(answer),
		withAuth: true,
	});
}
