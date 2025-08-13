import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type UpsertTaskRequestDTO =
	components["schemas"]["UpsertTaskRequestDTO"];
export type CreateTaskResponseDTO =
	components["schemas"]["CreateTaskResponseDTO"];
export type PublicTaskDTO = components["schemas"]["PublicTaskDTO"];

export async function createTask(
	data: UpsertTaskRequestDTO,
): Promise<CreateTaskResponseDTO> {
	return http<CreateTaskResponseDTO>("/api/task/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function getTaskById(task_id: number): Promise<PublicTaskDTO> {
	return http<PublicTaskDTO>(`/api/task/${task_id}`, { withAuth: true });
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
