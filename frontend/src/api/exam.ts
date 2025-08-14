import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type UpsertExamRequestDTO =
	components["schemas"]["UpsertExamRequestDTO"];
export type CreateExamResponseDTO =
	components["schemas"]["CreateExamResponseDTO"];
export type PublicTaskDTO = components["schemas"]["PublicTaskDTO"];
export type ExamDTO = components["schemas"]["Exam"]; // base exam shape returned by exam endpoints
export type ExamAttempt = components["schemas"]["ExamAttemptSchema"];
export type ExamAttemptsListDTO = components["schemas"]["ExamAttemptsListDTO"];

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

// List exams in a topic
// OpenAPI path: "/topics/{topic_id}/exams" (operationId: get_exams)
// Response schema is not specified in the spec content section, but backend returns a list of exams.
export async function getTopicExams(topic_id: number): Promise<ExamDTO[]> {
	return http<ExamDTO[]>(`/api/topics/${topic_id}/exams`, {
		withAuth: true,
	});
}

// Attempts
// GET /exam/{exam_id}/attempt/list
export async function getUserExamAttempts(
	exam_id: string,
): Promise<ExamAttemptsListDTO> {
	return http<ExamAttemptsListDTO>(`/api/exam/${exam_id}/attempt/list`, {
		withAuth: true,
	});
}

// GET /exam/{exam_id}/attempt/last
export async function getLastAttempt(exam_id: string): Promise<ExamAttempt> {
	return http<ExamAttempt>(`/api/exam/${exam_id}/attempt/last`, {
		withAuth: true,
	});
}

// POST /exam/{exam_id}/attempt/start
export async function startAttempt(exam_id: string): Promise<ExamAttempt> {
	return http<ExamAttempt>(`/api/exam/${exam_id}/attempt/start`, {
		method: "POST",
		withAuth: true,
	});
}

// PATCH /exam/{exam_id}/attempt/patch
// The schema defines a patch to change an answer for an active attempt.
// Keep it generic for now (backend defines payload). Consumers can pass shape as needed.
export async function patchAttempt<TBody = unknown>(
	exam_id: string,
	body: TBody,
): Promise<void> {
	await http<void>(`/api/exam/${exam_id}/attempt/patch`, {
		method: "PATCH",
		body: JSON.stringify(body),
		withAuth: true,
	});
}

// POST /exam/{exam_id}/attempt/stop
export async function stopAttempt(exam_id: string): Promise<void> {
	await http<void>(`/api/exam/${exam_id}/attempt/stop`, {
		method: "POST",
		withAuth: true,
	});
}
