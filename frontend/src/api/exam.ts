import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type UpsertExamRequestDTO =
	components["schemas"]["UpsertExamRequestDTO"];
export type CreateExamResponseDTO =
	components["schemas"]["CreateExamResponseDTO"];
export type PublicTaskDTO = components["schemas"]["PublicTaskDTO"];
export type PubExamExtendedEntity =
	components["schemas"]["PubExamExtendedEntity"];
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

export async function getExamEntities(
	exam_id: string,
): Promise<PubExamExtendedEntity[]> {
	return http<PubExamExtendedEntity[]>(`/api/exam/${exam_id}/entities`, {
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

// Get all exams across all courses and topics
export async function getAllExams(): Promise<ExamDTO[]> {
	try {
		const { getAllCourses, getCourseTopics } = await import("./courses");

		const courses = await getAllCourses();
		const allExams: ExamDTO[] = [];

		for (const course of courses) {
			try {
				const topics = await getCourseTopics(course.id);
				for (const topic of topics) {
					try {
						const exams = await getTopicExams(topic.id);
						allExams.push(...exams);
					} catch {}
				}
			} catch {}
		}

		return allExams;
	} catch {
		return [];
	}
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

// --- Entities & Text management helpers ---
export type TextUpsertDTO = components["schemas"]["TextUpsertDTO"];
export type TextEntity = components["schemas"]["TextEntity"];
export type ExamEntity = components["schemas"]["ExamEntity"];

export async function updateExamEntities(
	exam_id: string,
	entities: ExamEntity[],
): Promise<void> {
	await http<void>(`/api/exam/${exam_id}/entities`, {
		method: "PUT",
		body: JSON.stringify(entities),
		withAuth: true,
	});
}

export async function createText(data: TextUpsertDTO): Promise<TextEntity> {
	return http<TextEntity>("/api/exam/text/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function updateText(
	text_id: string,
	data: TextUpsertDTO,
): Promise<TextEntity> {
	return http<TextEntity>(`/api/exam/text/${text_id}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteText(text_id: string): Promise<void> {
	await http<void>(`/api/exam/text/${text_id}`, {
		method: "DELETE",
		withAuth: true,
	});
}

// --- Admin Attempts Panel API ---
export type ExamAttemptAdmin = components["schemas"]["ExamAttemptAdminSchema"];
export type TaskVerdict = components["schemas"]["TaskVerdict"];
export type TaskVerdictPatchRequest =
	components["schemas"]["TaskVerdictPatchRequest"];
export type AttemptVisibilityPatchRequest =
	components["schemas"]["AttemptVisibilityPatchRequest"];

// GET /exam/{exam_id}/admin/attempt/list
export async function listExamAttemptsAdmin(
	exam_id: string,
	params: { limit: number; offset: number; ungraded_first: boolean },
): Promise<ExamAttemptAdmin[]> {
	const query = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		ungraded_first: String(params.ungraded_first),
	}).toString();
	return http<ExamAttemptAdmin[]>(
		`/api/exam/${exam_id}/admin/attempt/list?${query}`,
		{
			withAuth: true,
		},
	);
}

// PATCH /exam/{exam_id}/admin/attempt/verdict/{attempt_id}
export async function patchAttemptTaskVerdict(
	exam_id: string,
	attempt_id: string,
	payload: TaskVerdictPatchRequest,
): Promise<void> {
	await http<void>(`/api/exam/${exam_id}/admin/attempt/verdict/${attempt_id}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
		withAuth: true,
	});
}

// PATCH /exam/admin/attempt/visibility/{attempt_id}
export async function setAttemptVisibility(
	attempt_id: string,
	show_results: boolean,
): Promise<void> {
	const body: AttemptVisibilityPatchRequest = { show_results };
	await http<void>(`/api/exam/admin/attempt/visibility/${attempt_id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
		withAuth: true,
	});
}

// PATCH /exam/{exam_id}/admin/attempt/visibility
export async function setExamAttemptsVisibility(
	exam_id: string,
	show_results: boolean,
): Promise<void> {
	const body: AttemptVisibilityPatchRequest = { show_results };
	await http<void>(`/api/exam/${exam_id}/admin/attempt/visibility`, {
		method: "PATCH",
		body: JSON.stringify(body),
		withAuth: true,
	});
}
