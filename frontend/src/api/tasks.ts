import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type TaskDTO = components["schemas"]["PublicTaskDTO"];
export type PublicTaskDTO = components["schemas"]["PublicTaskDTO"];
export type TaskType = components["schemas"]["TaskType"];
export type TaskConfig = components["schemas"]["TaskConfig"];
export type UpsertTaskRequestDTO =
	components["schemas"]["UpsertTaskRequestDTO"];

export async function createTask(
	data: UpsertTaskRequestDTO,
): Promise<components["schemas"]["CreateTaskResponseDTO"]> {
	return http<components["schemas"]["CreateTaskResponseDTO"]>("/api/task/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function getTaskById(task_id: number): Promise<TaskDTO> {
	return http<TaskDTO>(`/api/task/${task_id}`, { withAuth: true });
}

export async function getTaskAdminById(task_id: number): Promise<TaskDTO> {
	return http<TaskDTO>(`/api/task/${task_id}/admin`, { withAuth: true });
}

export async function updateTask(
	task_id: number,
	data: UpsertTaskRequestDTO,
): Promise<void> {
	await http<void>(`/api/task/${task_id}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteTask(task_id: number): Promise<void> {
	await http<void>(`/api/task/${task_id}`, {
		method: "DELETE",
		withAuth: true,
	});
}

export async function listTasks(
	limit: number,
	offset: number,
): Promise<PublicTaskDTO[]> {
	const qs = new URLSearchParams({
		limit: String(limit),
		offset: String(offset),
	});
	return http<PublicTaskDTO[]>(`/api/task/list?${qs.toString()}`, {
		withAuth: true,
	});
}
